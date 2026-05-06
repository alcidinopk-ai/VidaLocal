import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
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
    is_open_24_hours?: boolean;
    plusCode?: string;
    opening_hours?: {
      day_of_week: number;
      open_time: string | null;
      close_time: string | null;
      is_closed: boolean;
    }[];
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
  isError?: boolean;
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
  subCategoryFilter?: string,
  onStream?: (text: string) => void
): Promise<ChatMessage> {
  const cacheKey = `${city.name}-${city.uf}:${message.trim().toLowerCase()}:${userLocation ? 'geo' : 'city'}:${localContext ? 'ctx' : 'no-ctx'}:${categoryFilter || ''}:${subCategoryFilter || ''}`;
  if (responseCache.has(cacheKey)) {
    const cached = responseCache.get(cacheKey)!;
    if (onStream) onStream(cached.text);
    return cached;
  }

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        city,
        userLocation,
        localContext,
        categoryFilter,
        subCategoryFilter
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      if (response.status === 429 || errorData.error === "QUOTA_EXCEEDED") {
        return {
          role: "model",
          text: "Puxa, parece que atingimos o limite de buscas gratuitas da nossa inteligência artificial por agora. Já estamos trabalhando para ampliar isso! Enquanto isso, você pode navegar pelas categorias ou tentar novamente em alguns minutinhos. Agradecemos sua paciência! 😊",
          isError: true
        };
      }
      throw new Error(errorData.message || "Erro no servidor de chat");
    }

    const data = await response.json();
    if (onStream) onStream(data.text);
    
    responseCache.set(cacheKey, data);
    return data;
  } catch (error: any) {
    console.error("Chat API Proxy Error:", error);
    
    return {
      role: "model",
      text: "Ops! Tivemos um pequeno probleminha técnico ao processar sua busca. Nossa equipe já foi avisada e está trabalhando para resolver o quanto antes. Por favor, tente novamente em instantes ou explore as categorias locais. Obrigado por compreender! ✨",
      isError: true
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
): Promise<{ 
  summary: string; 
  is24h: boolean;
  structured?: { day: number; closed: boolean; slots: { open: string; close: string }[] }[] 
} | null> {
  try {
    const ai = getAI();
    const prompt = `Quais são os horários de funcionamento de "${name}" em ${city}${address ? `, no endereço ${address}` : ''}? 
    Responda em formato JSON com os seguintes campos:
    - summary: uma string curta resumindo os horários (ex: "Seg-Sex: 08h às 18h, Sáb: 08h às 12h")
    - is24h: booleano indicando se funciona 24 horas
    - structured: um array de 7 objetos (um para cada dia, 0=Domingo a 6=Sábado) com:
      - day: número do dia (0-6)
      - closed: booleano indicando se está fechado no dia
      - slots: um array de objetos com { open: "HH:MM", close: "HH:MM" }. Se fechado, o array deve ser vazio.
    
    Se houver fechamento para almoço, inclua dois slots no array.
    Se não encontrar, responda apenas null.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        tools: [{ googleMaps: {} }],
        responseMimeType: "application/json"
      },
    });

    const result = JSON.parse(response.text || "null");
    return result;
  } catch (error: any) {
    console.error("Error suggesting hours:", error);
    
    const errorMessage = error?.message || String(error);
    if (errorMessage.includes("429") || errorMessage.includes("RESOURCE_EXHAUSTED") || errorMessage.includes("quota")) {
      throw new Error("QUOTA_EXCEEDED");
    }
    
    return null;
  }
}
