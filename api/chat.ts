import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from "@google/genai";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { message, city, userLocation } = req.body || {};
    
    if (message === 'ping') {
      return res.status(200).json({ role: 'model', text: 'pong (isolated chat handler)' });
    }

    const rawKey = process.env.GEMINI_API_KEY || process.env.API_KEY || "";
    const apiKey = rawKey.trim();
    
    if (!apiKey || apiKey.length < 10 || apiKey.includes("YOUR_API_KEY") || apiKey.includes("MY_GEMINI_API_KEY")) {
      return res.status(200).json({ 
        role: 'model', 
        text: 'Chave API Gemini não configurada corretamente nos Secrets do projeto. Por favor, configure a GEMINI_API_KEY.' 
      });
    }

    const ai = new GoogleGenAI({ apiKey });
    
    // Use the model recommended by the gemini-api skill
    const modelName = "gemini-3.5-flash";
    const lat = Number(userLocation?.latitude || city?.latitude || -11.7298);
    const lng = Number(userLocation?.longitude || city?.longitude || -49.0678);

    const response = await ai.models.generateContent({
      model: modelName,
      contents: [{ role: "user", parts: [{ text: message }] }],
      config: {
        systemInstruction: `Você é VidaLocal, um guia para ${city?.name || 'sua cidade'}. 
Ajude o usuário a encontrar locais. Sempre use o Google Maps para confirmar locais.
Ao listar estabelecimentos, use o formato de lista (*) e inclua telefone/WhatsApp se disponível.`,
        tools: [{ googleMaps: {} } as any],
        toolConfig: {
          retrievalConfig: {
            latLng: { latitude: lat, longitude: lng },
          },
        } as any,
      },
    });

    const text = response.text || "Sem resposta textual.";
    
    // Process grounding chunks
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((chunk: any) => {
      return {
        maps: chunk.maps ? { 
          uri: chunk.maps.uri, 
          title: chunk.maps.title,
          location: chunk.maps.location,
          address: chunk.maps.address || chunk.maps.formattedAddress,
          phone: chunk.maps.phone || chunk.maps.phoneNumber,
          rating: chunk.maps.rating,
        } : undefined,
        web: chunk.web ? { uri: chunk.web.uri, title: chunk.web.title } : undefined,
      };
    }).filter((c: any) => c.maps || c.web) || [];

    return res.status(200).json({ role: "model", text, groundingChunks });

  } catch (error: any) {
    console.error("[Chat API Error]:", error);
    
    let userMessage = "Desculpe, ocorreu um erro ao processar sua busca.";
    
    if (error.message && (error.message.includes("429") || error.message.includes("quota") || error.message.includes("RESOURCE_EXHAUSTED"))) {
      userMessage = "O limite de buscas gratuitas foi atingido para hoje. Por favor, tente novamente em alguns instantes ou amanhã. Estamos trabalhando para aumentar nossa capacidade!";
    } else if (error.message && (error.message.includes("500") || error.message.includes("Internal Server Error"))) {
      userMessage = "O servidor da IA está temporariamente instável. Por favor, tente novamente em alguns segundos.";
    } else if (error.message && error.message.includes("API key")) {
      userMessage = "Erro de configuração: Chave de API inválida ou não encontrada.";
    } else {
      userMessage = `Erro no serviço de busca: ${error.message || "Falha na comunicação com a IA"}.`;
    }

    return res.status(200).json({ 
      role: 'model', 
      text: userMessage
    });
  }
}
