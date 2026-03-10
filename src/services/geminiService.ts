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
    phone?: string;
    whatsapp?: string;
    user_id?: string;
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
  localContext?: string,
  categoryFilter?: string,
  subCategoryFilter?: string
): Promise<ChatMessage> {
  const cacheKey = `${city.name}-${city.uf}:${message.trim().toLowerCase()}:${userLocation ? 'geo' : 'city'}:${localContext ? 'ctx' : 'no-ctx'}:${categoryFilter || ''}:${subCategoryFilter || ''}`;
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
        taxonomyContext: TAXONOMY_CONTEXT,
        categoryFilter,
        subCategoryFilter
      })
    });

    if (!response.ok) {
      let errorText = "Desculpe, ocorreu um erro no servidor ao processar sua busca.";
      try {
        const errorData = await response.json();
        errorText = errorData.text || errorText;
      } catch (e) {
        // If response is not JSON (e.g. Vercel timeout page), use a more descriptive message
        if (response.status === 504) {
          errorText = "O servidor demorou muito para responder (Timeout). Isso geralmente acontece em buscas complexas no plano gratuito da Vercel. Por favor, tente uma pergunta mais simples ou tente novamente.";
        } else {
          errorText = `Erro do servidor (${response.status}): Não foi possível processar a resposta.`;
        }
      }
      return {
        role: "model",
        text: errorText
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
