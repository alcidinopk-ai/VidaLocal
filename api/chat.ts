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
    const lat = Number(userLocation?.latitude || city?.latitude || -11.7298);
    const lng = Number(userLocation?.longitude || city?.longitude || -49.0678);

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: message,
      config: {
        systemInstruction: `Você é VidaLocal, um guia para ${city?.name || 'sua cidade'}.
Sua missão é ajudar o usuário a encontrar estabelecimentos e serviços.
Ao listar estabelecimentos, SEMPRE tente incluir o telefone ou WhatsApp no formato (XX) 9XXXX-XXXX ou (XX) XXXX-XXXX e o HORÁRIO DE FUNCIONAMENTO (ex: "Aberto até as 18:00" ou "08:00 - 18:00") logo após o nome do local.
Seja prestativo e forneça informações precisas sobre localização, contato e horários.`,
        tools: [{ googleMaps: {} }],
        toolConfig: {
          retrievalConfig: {
            latLng: { latitude: lat, longitude: lng },
          },
        },
      },
    });

    const text = response.text || "Sem resposta.";
    
    // Improved regex for Brazilian phone numbers (handles various formats)
    const phoneRegex = /(?:\(?\d{2}\)?\s?)?(?:9\s?)?\d{4}[-\s]?\d{4}/g;
    const foundPhones = text.match(phoneRegex) || [];

    // Regex for business hours (e.g., "08:00 - 18:00", "Aberto até as 22h", "Aberto agora", "Fechado", etc.)
    const hoursRegex = /(?:aberto|fechado|horário|funcionamento)[^.\n]*?(?:\d{1,2}[:h]\d{2}|\d{1,2}h|agora|24h|hoje)/gi;

    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((chunk: any, index: number) => {
      const maps = chunk.maps ? { 
        uri: chunk.maps.uri, 
        title: chunk.maps.title,
        location: chunk.maps.location,
        address: chunk.maps.address,
        hours: chunk.maps.hours,
        rating: chunk.maps.rating,
        // Try to find a phone number that appears near the title in the text
        phone: undefined as string | undefined,
        whatsapp: undefined as string | undefined
      } : undefined;

      if (maps && maps.title) {
        // Find the position of the title in the text
        const titlePos = text.indexOf(maps.title);
        if (titlePos !== -1) {
          // Look for the closest phone number AFTER the title (within 300 chars)
          const searchArea = text.substring(titlePos, titlePos + 300);
          
          const areaPhones = searchArea.match(phoneRegex);
          if (areaPhones && areaPhones.length > 0) {
            maps.phone = areaPhones[0];
            maps.whatsapp = areaPhones[0];
          }

          // Also try to extract hours from the text if missing
          if (!maps.hours) {
            const areaHours = searchArea.match(hoursRegex);
            if (areaHours && areaHours.length > 0) {
              maps.hours = areaHours[0].trim();
            }
          }
        }
        
        // If still not found, check if the title appears in a list and pick the phone/hours from that line
        if (!maps.phone || !maps.hours) {
          const lines = text.split('\n');
          const titleLine = lines.find(line => line.includes(maps.title));
          if (titleLine) {
            if (!maps.phone) {
              const linePhones = titleLine.match(phoneRegex);
              if (linePhones && linePhones.length > 0) {
                maps.phone = linePhones[0];
                maps.whatsapp = linePhones[0];
              }
            }
            if (!maps.hours) {
              const lineHours = titleLine.match(hoursRegex);
              if (lineHours && lineHours.length > 0) {
                maps.hours = lineHours[0].trim();
              }
            }
          }
        }

        // Fallback to index-based if not found near title
        if (!maps.phone && foundPhones[index]) {
          maps.phone = foundPhones[index];
          maps.whatsapp = foundPhones[index];
        }
      }

      return {
        maps,
        web: chunk.web ? { uri: chunk.web.uri, title: chunk.web.title } : undefined,
      };
    }).filter((c: any) => c.maps || c.web) || [];

    return res.status(200).json({ role: 'model', text, groundingChunks });

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
