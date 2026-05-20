import { GoogleGenAI, Type } from "@google/genai";
import * as dotenv from "dotenv";

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("❌ GEMINI_API_KEY is missing");
  process.exit(1);
}

const ai = new GoogleGenAI({
  apiKey,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

async function runTest() {
  console.log("⏱️ Step 1: Starting single-item test query against Gemini...");
  
  const query = 'Encontre a latitude e longitude exatas para o estabelecimento "Hotel Imperador" em Gurupi - TO, Brasil. Retorne em JSON.';
  
  try {
    console.log("⏱️ Step 2: Calling ai.models.generateContent...");
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: query,
      config: {
        systemInstruction: "Retorne a latitude e longitude exatas em JSON.",
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            latitude: { type: Type.NUMBER },
            longitude: { type: Type.NUMBER },
          },
          required: ["latitude", "longitude"]
        },
      },
    });

    console.log("⏱️ Step 3: Response received successfully!");
    console.log("Response text:", response.text);
  } catch (err: any) {
    console.error("❌ Step 3: Error calling Gemini API:", err.message || err);
  }
}

runTest();
