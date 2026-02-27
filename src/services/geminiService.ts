import { GoogleGenAI, GenerateContentResponse, Modality } from "@google/genai";
import { CATEGORIES, SUB_CATEGORIES } from "../constants/taxonomy";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

const TAXONOMY_CONTEXT = `
Abaixo está a taxonomia oficial do VidaLocal que você deve usar para categorizar estabelecimentos:
${CATEGORIES.map(c => `- Categoria: ${c.name} (ID: ${c.id})
  Tipos: ${SUB_CATEGORIES.filter(sc => sc.categoryId === c.id).map(sc => sc.name).join(", ")}`).join("\n")}
`;

export interface GroundingChunk {
  maps?: {
    uri: string;
    title: string;
    location?: {
      latitude: number;
      longitude: number;
    };
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

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const responseCache = new Map<string, ChatMessage>();

async function callWithRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // Improved error detection for various SDK error formats
      const errorString = JSON.stringify(error).toLowerCase();
      const isRateLimit = 
        errorString.includes("429") || 
        errorString.includes("resource_exhausted") ||
        errorString.includes("quota exceeded");

      if (isRateLimit && i < maxRetries - 1) {
        const waitTime = Math.pow(2, i) * 2000 + Math.random() * 1000; // Increased base wait time
        console.warn(`Rate limit hit (429). Retrying in ${waitTime.toFixed(0)}ms... (Attempt ${i + 1}/${maxRetries})`);
        await sleep(waitTime);
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

export async function chatWithMaps(
  message: string,
  city: { name: string; uf: string; latitude: number; longitude: number },
  userLocation?: { latitude: number; longitude: number }
): Promise<ChatMessage> {
  const cacheKey = `${city.name}-${city.uf}:${message.trim().toLowerCase()}:${userLocation ? 'geo' : 'city'}`;
  if (responseCache.has(cacheKey)) {
    console.log("Returning cached response for:", cacheKey);
    return responseCache.get(cacheKey)!;
  }

  try {
    const response = await callWithRetry(() => ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: message,
      config: {
        systemInstruction: `Você é VidaLocal, um assistente de guia urbano premium para a cidade de ${city.name}-${city.uf}. 
        Quando os usuários perguntarem sobre lugares, serviços ou empresas, você DEVE fornecer uma lista estruturada de opções relevantes.
        Para cada empresa, inclua: 1. Nome, 2. Endereço Completo, 3. Número de Telefone (se disponível), e 4. Uma breve descrição.
        Use listas Markdown para clareza. Sempre priorize a precisão e os dados em tempo real do Google Maps.
        
        ${TAXONOMY_CONTEXT}
        
        Sempre tente enquadrar os estabelecimentos encontrados nas categorias e tipos acima.`,
        tools: [{ googleMaps: {} }, { googleSearch: {} }],
        toolConfig: {
          retrievalConfig: {
            latLng: {
              latitude: userLocation?.latitude || city.latitude,
              longitude: userLocation?.longitude || city.longitude,
            },
          },
        },
      },
    }));

    const text = response.text || "I couldn't find an answer for that.";
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks as any[];
    
    const groundingChunks: GroundingChunk[] = chunks?.map(chunk => ({
      maps: chunk.maps ? { 
        uri: chunk.maps.uri, 
        title: chunk.maps.title,
        location: chunk.maps.location ? {
          latitude: chunk.maps.location.latitude,
          longitude: chunk.maps.location.longitude
        } : undefined
      } : undefined,
      web: chunk.web ? { uri: chunk.web.uri, title: chunk.web.title } : undefined,
    })).filter(c => c.maps || c.web) || [];

    const result: ChatMessage = {
      role: "model",
      text,
      groundingChunks,
    };

    // Cache the successful result
    responseCache.set(cacheKey, result);
    // Limit cache size
    if (responseCache.size > 50) {
      const firstKey = responseCache.keys().next().value;
      if (firstKey) responseCache.delete(firstKey);
    }

    return result;
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    const errorString = JSON.stringify(error).toLowerCase();
    const isRateLimit = 
      errorString.includes("429") || 
      errorString.includes("resource_exhausted") ||
      errorString.includes("quota exceeded");

    return {
      role: "model",
      text: isRateLimit 
        ? "Desculpe, o serviço está temporariamente sobrecarregado devido ao alto volume de buscas. Por favor, tente novamente em alguns instantes."
        : "Desculpe, encontrei um erro ao processar sua solicitação. Por favor, tente novamente.",
    };
  }
}
