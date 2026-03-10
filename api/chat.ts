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

    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!apiKey || apiKey.length < 10) {
      return res.status(200).json({ 
        role: 'model', 
        text: 'Chave API Gemini não configurada nos Secrets do projeto.' 
      });
    }

    const ai = new GoogleGenAI({ apiKey });
    const lat = Number(userLocation?.latitude || city?.latitude || -11.7298);
    const lng = Number(userLocation?.longitude || city?.longitude || -49.0678);

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: message,
      config: {
        systemInstruction: `Você é VidaLocal, um guia para ${city?.name || 'sua cidade'}.`,
        tools: [{ googleMaps: {} }],
        toolConfig: {
          retrievalConfig: {
            latLng: { latitude: lat, longitude: lng },
          },
        },
      },
    });

    const text = response.text || "Sem resposta.";
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((chunk: any) => ({
      maps: chunk.maps ? { 
        uri: chunk.maps.uri, 
        title: chunk.maps.title,
        location: chunk.maps.location
      } : undefined,
      web: chunk.web ? { uri: chunk.web.uri, title: chunk.web.title } : undefined,
    })).filter((c: any) => c.maps || c.web) || [];

    return res.status(200).json({ role: 'model', text, groundingChunks });

  } catch (error: any) {
    return res.status(200).json({ 
      role: 'model', 
      text: `Erro no handler isolado: ${error.message}` 
    });
  }
}
