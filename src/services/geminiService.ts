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
    const ai = getAI();
    const lat = userLocation?.latitude || city.latitude;
    const lng = userLocation?.longitude || city.longitude;

    const stream = await ai.models.generateContentStream({
      model: "gemini-3-flash-preview",
      contents: message,
      config: {
        systemInstruction: `Você é VidaLocal, um guia para ${city.name}. Ajude o usuário a encontrar locais.
        ${TAXONOMY_CONTEXT}
        Contexto local (estabelecimentos já cadastrados): ${localContext || 'Nenhum'}
        ${categoryFilter ? `Filtro de categoria: ${categoryFilter}` : ''}
        ${subCategoryFilter ? `Filtro de tipo: ${subCategoryFilter}` : ''}
        
        Comece sua resposta sempre com uma frase clara como: "Em ${city.name} - ${city.uf}, você pode encontrar os seguintes estabelecimentos que oferecem serviços de [Busca]:"
        
        Sempre use a ferramenta Google Maps para encontrar e confirmar a localização de todos os estabelecimentos que você mencionar na resposta.
        Ao listar estabelecimentos, use SEMPRE o formato de lista (usando asteriscos *) para que cada local apareça em um box separado no chat.
        Para cada local, coloque o nome em negrito e descreva brevemente o endereço e o que o local oferece.
        `,
        tools: [{ googleMaps: {} }],
        toolConfig: {
          retrievalConfig: {
            latLng: { latitude: lat, longitude: lng },
          },
        },
      },
    });

    let fullText = "";
    let lastChunk: GenerateContentResponse | null = null;

    for await (const chunk of stream) {
      lastChunk = chunk;
      const chunkText = chunk.text || "";
      fullText += chunkText;
      if (onStream) onStream(fullText);
    }

    const text = fullText || "Sem resposta textual.";
    const groundingChunks = lastChunk?.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((chunk: any) => {
      const categoryId = CATEGORIES.find(c => c.name === categoryFilter)?.id;
      
      return {
        maps: chunk.maps ? { 
          uri: chunk.maps.uri, 
          title: chunk.maps.title,
          location: chunk.maps.location,
          address: chunk.maps.address || chunk.maps.formattedAddress || chunk.maps.formatted_address,
          phone: chunk.maps.phone || chunk.maps.phoneNumber || chunk.maps.phone_number,
          whatsapp: chunk.maps.whatsapp || chunk.maps.whatsappNumber || chunk.maps.whatsapp_number,
          plusCode: chunk.maps.plusCode || chunk.maps.plus_code || chunk.maps.plusCodeGlobalCode || chunk.maps.globalCode,
          rating: chunk.maps.rating,
          categoryId: categoryId,
          subCategory: subCategoryFilter,
        } : undefined,
        web: chunk.web ? { uri: chunk.web.uri, title: chunk.web.title } : undefined,
      };
    }).filter((c: any) => c.maps || c.web) || [];

    const finalResult: ChatMessage = { role: "model", text, groundingChunks };
    responseCache.set(cacheKey, finalResult);
    return finalResult;
  } catch (error: any) {
    console.error("Chat API Error:", error);
    
    const errorMessage = error?.message || String(error);
    const isQuotaExceeded = errorMessage.includes("429") || 
                           errorMessage.includes("RESOURCE_EXHAUSTED") || 
                           errorMessage.includes("quota");

    if (isQuotaExceeded) {
      return {
        role: "model",
        text: "Puxa, parece que atingimos o limite de buscas gratuitas da nossa inteligência artificial por agora. Já estamos trabalhando para ampliar isso! Enquanto isso, você pode navegar pelas categorias ou tentar novamente em alguns minutinhos. Agradecemos sua paciência! 😊",
        isError: true
      };
    }

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
