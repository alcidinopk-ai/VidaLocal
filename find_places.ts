import { GoogleGenAI } from "@google/genai";

async function findPlaces() {
  console.log("Env keys:", Object.keys(process.env).filter(k => k.includes("KEY") || k.includes("API")));
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) {
    console.error("No API key found in environment.");
    process.exit(1);
  }
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: "List 10 NEW essential places in Gurupi, Tocantins (not including: Farmácia Preço Baixo, Supermercado Araguaia, Posto Central, Hospital Regional de Gurupi, Farmácia DrogaMais, Supermercado Beira Rio, Drogaria Ultra Popular, Posto Décio Gurupi, Supermercado Quartetto, Drogaria Globo, Mercado Municipal de Gurupi, Supermercado Campelo, Farmácia Biofórmula, Drogaria Rosário, Supermercado Supercom, Farmácia do Trabalhador, Drogaria Popular). Include: Name, Category (Farmácia, Supermercado, Posto de Combustível, Hospital, Restaurante), Address, Latitude, Longitude (approximate), and a brief description. Format as a JSON array of objects with keys: name, sub_category, address, latitude, longitude, description.",
    config: {
      tools: [{ googleSearch: {} }]
    }
  });

  console.log(response.text);
}

findPlaces();
