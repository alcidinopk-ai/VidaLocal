import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI, Type } from "@google/genai";
import * as dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ ERRO: Credenciais do Supabase ausentes.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("❌ ERRO: Chave GEMINI_API_KEY ausente.");
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

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function geocodeGasStations() {
  console.log("🚀 ===================================================");
  console.log("   INICIANDO GEOMAPEAMENTO DE POSTOS EM GURUPI");
  console.log("===================================================\n");

  // Fetch gas stations in Gurupi
  const { data, error } = await supabase
    .from("establishments")
    .select(`
      id,
      name,
      address,
      latitude,
      longitude,
      cities (
        name,
        states (
          uf
        )
      )
    `);

  if (error) {
    console.error("❌ Erro ao buscar estabelecimentos:", error.message);
    return;
  }

  const gasStations = (data || []).filter(item => {
    const isGasStr = item.name.toLowerCase().includes("posto") || item.name.toLowerCase().includes("combust");
    const isGurupi = (item.cities as any)?.name === "Gurupi";
    return isGasStr && isGurupi;
  });

  console.log(`📌 Encontrados ${gasStations.length} postos de combustível para atualizar.`);

  for (let i = 0; i < gasStations.length; i++) {
    const est = gasStations[i];
    const progress = `[${i + 1}/${gasStations.length}]`;
    const cityInfo: any = est.cities;
    const stateInfo: any = cityInfo?.states;
    const cityName = cityInfo?.name || "Gurupi";
    const cityUf = stateInfo?.uf || "TO";

    console.log(`\n🔍 ${progress} Pesquisando localização real de: "${est.name}"...`);
    
    const query = `Encontre a latitude e longitude reais e exatas para o posto de combustível "${est.name}" localizado na cidade "${cityName} - ${cityUf}", Brasil. O endereço registrado é: "${est.address || "Centro"}". Use a busca do Google para obter o pin de geolocalização mais preciso do Maps para a bomba de combustível desta unidade real hoje.`;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: query,
        config: {
          systemInstruction: `
Você é uma inteligência de SIG focada em mapear postos de combustível por todo o estado do Tocantins com altíssima exatidão de rua.
Utilize a ferramenta Google Search Grounding integrada para encontrar o pin real de coordenadas de latitude e longitude do posto do mundo real.
Você DEVE SEMPRE retornar estritamente no formato JSON estruturado com as chaves 'latitude' e 'longitude' como dados numéricos flutuantes.
`,
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              latitude: { type: Type.NUMBER, description: "Precision GPS latitude coordinate" },
              longitude: { type: Type.NUMBER, description: "Precision GPS longitude coordinate" }
            },
            required: ["latitude", "longitude"]
          },
        },
      });

      const responseText = response.text;
      if (!responseText) {
        console.warn(`⚠️ Sem resposta do modelo para "${est.name}"`);
        continue;
      }

      const parsed = JSON.parse(responseText.trim());
      if (parsed.latitude && parsed.longitude) {
        if (Math.abs(parsed.latitude) < 1 || Math.abs(parsed.longitude) < 1) {
          console.warn(`⚠️ Coordenadas inválidas retornadas: ${parsed.latitude}, ${parsed.longitude}`);
          continue;
        }

        // Save immediately to Supabase
        const { error: updateError } = await supabase
          .from("establishments")
          .update({
            latitude: parsed.latitude,
            longitude: parsed.longitude,
          })
          .eq("id", est.id);

        if (updateError) {
          console.error(`❌ Erro ao salvar "${est.name}" no banco:`, updateError.message);
        } else {
          console.log(`✅ Atualizado com Sucesso: "${est.name}"`);
          console.log(`   De:   (${est.latitude}, ${est.longitude})`);
          console.log(`   Para: (${parsed.latitude}, ${parsed.longitude})`);
        }
      } else {
        console.warn(`⚠️ Não foi possível obter coordenadas para "${est.name}"`);
      }
    } catch (err: any) {
      console.error(`💥 Erro ao geocodificar "${est.name}":`, err.message || err);
    }

    // Rate limiting grace period between calls
    await delay(5000);
  }

  console.log("\n✅ ===================================================");
  console.log("   GEOMAPEAMENTO CONCLUÍDO E ATUALIZADO NO BANCO");
  console.log("===================================================\n");
}

geocodeGasStations();
