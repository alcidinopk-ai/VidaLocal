import { CATEGORIES, SUB_CATEGORIES } from "../constants/taxonomy";

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

const responseCache = new Map<string, ChatMessage>();

export async function chatWithMaps(
  message: string,
  city: { name: string; uf: string; latitude: number; longitude: number },
  userLocation?: { latitude: number; longitude: number },
  localContext?: string
): Promise<ChatMessage> {
  const cacheKey = `${city.name}-${city.uf}:${message.trim().toLowerCase()}:${userLocation ? 'geo' : 'city'}:${localContext ? 'ctx' : 'no-ctx'}`;
  if (responseCache.has(cacheKey)) {
    return responseCache.get(cacheKey)!;
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
        taxonomyContext: TAXONOMY_CONTEXT
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      return {
        role: "model",
        text: errorData.text || "Desculpe, ocorreu um erro no servidor ao processar sua busca."
      };
    }

    const result: ChatMessage = await response.json();

    // Cache the successful result
    responseCache.set(cacheKey, result);
    if (responseCache.size > 50) {
      const firstKey = responseCache.keys().next().value;
      if (firstKey) responseCache.delete(firstKey);
    }

    return result;
  } catch (error: any) {
    console.error("Chat API Error:", error);
    return {
      role: "model",
      text: "Desculpe, não consegui me conectar ao servidor. Verifique sua conexão e tente novamente.",
    };
  }
}
