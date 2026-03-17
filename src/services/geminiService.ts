import { GoogleGenAI } from "@google/genai";
import { CATEGORIES, SUB_CATEGORIES } from "../constants/taxonomy";

const TAXONOMY_CONTEXT = `
Abaixo está a taxonomia oficial do VidaLocal que você deve usar para categorizar estabelecimentos:
${CATEGORIES.map(c => `- Categoria: ${c.name} (ID: ${c.id})
  Tipos: ${SUB_CATEGORIES.filter(sc => sc.categoryId === c.id).map(sc => sc.name).join(", ")}`).join("\n")}
`;

export interface GroundingChunk {
  maps?: {
    id?: string;
    uri: string;
    title: string;
    categoryId?: number;
    cityId?: number;
    subCategory?: string;
    address?: string;
    hours?: string;
    description?: string;
    phone?: string;
    whatsapp?: string;
    user_id?: string;
    is_featured?: boolean;
    is_verified?: boolean;
    is_premium?: boolean;
    location?: {
      latitude: number;
      longitude: number;
    };
    rating?: string | number;
  };
  web?: {
    uri: string;
    title: string;
  };
}

export interface ChatMessage {
  role: "user" | "model";
  text: string;
  groundingChunks?: GroundingChunk[];
}

const responseCache = new Map<string, ChatMessage>();

// Initialize Gemini on the frontend
const getAI = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY não configurada.");
  }
  return new GoogleGenAI({ apiKey });
};

export async function chatWithMaps(
  message: string,
  city: { name: string; uf: string; latitude: number; longitude: number },
  userLocation?: { latitude: number; longitude: number },
  localContext?: string,
  categoryFilter?: string,
  subCategoryFilter?: string
): Promise<ChatMessage> {
  const cacheKey = `${city.name}-${city.uf}:${message.trim().toLowerCase()}:${userLocation ? 'geo' : 'city'}:${localContext ? 'ctx' : 'no-ctx'}:${categoryFilter || ''}:${subCategoryFilter || ''}`;
  if (responseCache.has(cacheKey)) {
    return responseCache.get(cacheKey)!;
  }

  try {
    const ai = getAI();
    const lat = userLocation?.latitude || city.latitude;
    const lng = userLocation?.longitude || city.longitude;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: message,
      config: {
        systemInstruction: `Você é VidaLocal, um guia para ${city.name}. Ajude o usuário a encontrar locais.
        ${TAXONOMY_CONTEXT}
        Contexto local (estabelecimentos já cadastrados): ${localContext || 'Nenhum'}
        ${categoryFilter ? `Filtro de categoria: ${categoryFilter}` : ''}
        ${subCategoryFilter ? `Filtro de tipo: ${subCategoryFilter}` : ''}
        `,
        tools: [{ googleMaps: {} }],
        toolConfig: {
          retrievalConfig: {
            latLng: { latitude: lat, longitude: lng },
          },
        },
      },
    });

    const text = response.text || "Sem resposta textual.";
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((chunk: any) => ({
      maps: chunk.maps ? { 
        uri: chunk.maps.uri, 
        title: chunk.maps.title,
        location: chunk.maps.location
      } : undefined,
      web: chunk.web ? { uri: chunk.web.uri, title: chunk.web.title } : undefined,
    })).filter((c: any) => c.maps || c.web) || [];

    const result: ChatMessage = { role: "model", text, groundingChunks };
    responseCache.set(cacheKey, result);
    return result;
  } catch (error: any) {
    console.error("Chat API Error:", error);
    
    const errorMessage = error?.message || String(error);
    const isQuotaExceeded = errorMessage.includes("429") || 
                           errorMessage.includes("RESOURCE_EXHAUSTED") || 
                           errorMessage.includes("quota");

    if (isQuotaExceeded) {
      return {
        role: "model",
        text: "Desculpe, o limite de buscas gratuitas da IA foi atingido para este período. Por favor, tente novamente em alguns minutos ou utilize as categorias para navegar pelos estabelecimentos já cadastrados.",
      };
    }

    return {
      role: "model",
      text: "Desculpe, não consegui processar sua busca agora. Verifique sua conexão ou tente novamente mais tarde.",
    };
  }
}

/**
 * Uses Gemini with Maps grounding to suggest business hours for a given establishment.
 */
export async function suggestBusinessHours(
  name: string,
  city: string,
  address?: string
): Promise<string | null> {
  try {
    const ai = getAI();
    const prompt = `Quais são os horários de funcionamento de "${name}" em ${city}${address ? `, no endereço ${address}` : ''}? 
    Responda APENAS os horários em uma única linha, formatado como "Seg-Sex: 08h às 18h, Sáb: 08h às 12h". 
    Se não encontrar, responda "Não encontrado".`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        tools: [{ googleMaps: {} }],
      },
    });

    const text = response.text?.trim();
    if (text && !text.toLowerCase().includes("não encontrado")) {
      return text;
    }
    return null;
  } catch (error) {
    console.error("Error suggesting hours:", error);
    return null;
  }
}
