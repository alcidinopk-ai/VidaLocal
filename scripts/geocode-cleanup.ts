import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI, Type } from "@google/genai";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

// Load environment variables (.env / .env.example)
dotenv.config();

// ==========================================
// CONFIGURATION
// ==========================================
const RATE_LIMIT_DELAY_MS = 5000; // Safe interval of 5s to stay under Gemini 15 RPM limits

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ ERRO: Credenciais do Supabase ausentes.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("❌ ERRO: Chave GEMINI_API_KEY ausente nas variáveis de ambiente.");
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

const STATE_FILE_PATH = path.join(process.cwd(), "scripts", "geocoded-ids.json");

// Load and save progress state
function getGeocodedIds(): string[] {
  try {
    if (fs.existsSync(STATE_FILE_PATH)) {
      const data = fs.readFileSync(STATE_FILE_PATH, "utf-8");
      return JSON.parse(data);
    }
  } catch (e) {
    console.warn("⚠️ Não foi possível ler o arquivo de estado, iniciando do zero.");
  }
  return [];
}

function saveGeocodedId(id: string) {
  try {
    const ids = getGeocodedIds();
    if (!ids.includes(id)) {
      ids.push(id);
      fs.writeFileSync(STATE_FILE_PATH, JSON.stringify(ids, null, 2), "utf-8");
    }
  } catch (e) {
    console.error("❌ Falha ao salvar ID de progresso:", e);
  }
}

interface AffectedEstablishment {
  id: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  cityName: string;
  cityUf: string;
  cityLat?: number;
  cityLng?: number;
}

async function fetchCandidates(): Promise<AffectedEstablishment[]> {
  console.log("🔍 Buscando estabelecimentos candidatos no banco...");

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
        latitude,
        longitude,
        states (
          uf
        )
      )
    `);

  if (error) {
    throw error;
  }

  if (!data) return [];

  const geocodedIds = getGeocodedIds();
  const candidates: AffectedEstablishment[] = [];

  for (const item of data) {
    // Dynamically added ones have UUIDs
    const isAuto = item.id.includes("-") && item.id.length > 10;
    if (!isAuto) continue;

    // Skip if already successfully geocoded in past runs
    if (geocodedIds.includes(item.id)) continue;

    const lat = Number(item.latitude);
    const lng = Number(item.longitude);

    const cityInfo: any = item.cities;
    const stateInfo: any = cityInfo?.states;

    const cityLat = cityInfo?.latitude ? Number(cityInfo.latitude) : undefined;
    const cityLng = cityInfo?.longitude ? Number(cityInfo.longitude) : undefined;

    candidates.push({
      id: item.id,
      name: item.name,
      address: item.address,
      latitude: lat,
      longitude: lng,
      cityName: cityInfo?.name || "Gurupi",
      cityUf: stateInfo?.uf || "TO",
      cityLat,
      cityLng,
    });
  }

  // Prioritize candidates with longer/detailed names since those are most likely real-world business items
  candidates.sort((a, b) => b.name.length - a.name.length);

  console.log(`✅ Filtrados ${candidates.length} estabelecimentos restantes necessitando de geolocalização precisa.`);
  return candidates;
}

async function resolveCoordinatesWithGemini(
  est: AffectedEstablishment,
  attempt = 1
): Promise<{ latitude?: number; longitude?: number; error?: string }> {
  // Elaborate a search prompt with clear city/state parameters so Google Grounding is extremely precise
  const query = `Encontre a latitude e longitude reais e exatas para o estabelecimento/local comercial "${est.name}" localizado na cidade "${est.cityName} - ${est.cityUf}", Brasil. O endereço registrado é: "${est.address || "Centro"}". Use a busca do Google para obter o pin de geolocalização mais preciso do Maps ou de páginas locais da empresa.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: query,
      config: {
        systemInstruction: `
Você é uma inteligência de SIG focada em conversão precisa de estabelecimentos locais brasileiros em coordenadas de mapa exatas.
Utilize a ferramenta Google Search Grounding integrada para encontrar as coordenadas reais de latitude e longitude do estabelecimento do mundo real correspondente à cidade especificada (como Gurupi, Palmas, etc.).
Você DEVE SEMPRE retornar estritamente no formato JSON estruturado com as chaves 'latitude' e 'longitude' como dados numéricos flutuantes.
Se você identificar que o nome do comércio é fictício ou genérico e não possui localização física de verdade, você pode atribuir uma variação geográfica pequena aleatória próxima ao centro da cidade para não sobrepor tudo, mas para comércios reais, retorne a coordenada de satélite/Maps real.
`,
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            latitude: { type: Type.NUMBER, description: "Precision GPS latitude coordinate" },
            longitude: { type: Type.NUMBER, description: "Precision GPS longitude coordinate" },
            error: { type: Type.STRING, description: "Optional description of search reason if generic" }
          },
          required: ["latitude", "longitude"]
        },
      },
    });

    const responseText = response.text;
    if (!responseText) {
      return { error: "Sem resposta text retornada do modelo." };
    }

    const parsed = JSON.parse(responseText.trim());
    if (parsed.latitude && parsed.longitude) {
      if (Math.abs(parsed.latitude) < 1 || Math.abs(parsed.longitude) < 1) {
        return { error: `Coordenadas inválidas: ${parsed.latitude}, ${parsed.longitude}` };
      }
      return parsed;
    }
    return { error: parsed.error || "Coordenadas ausentes na resposta JSON estruturada" };
  } catch (err: any) {
    const errMsg = err.message || "";
    if (errMsg.includes("quota") || errMsg.includes("429") || errMsg.includes("RESOURCE_EXHAUSTED")) {
      if (attempt <= 3) {
        const sleepTime = 16000 * attempt;
        console.warn(`⏳ [Gemini Quota 429] Limite de requisições ativo para "${est.name}". Re-tentando tentativa ${attempt}/3 em ${sleepTime / 1000}s...`);
        await delay(sleepTime);
        return resolveCoordinatesWithGemini(est, attempt + 1);
      }
      return { error: "COTA_EXCEDIDA" };
    }
    return { error: errMsg };
  }
}

async function runCorrectionPipeline() {
  console.log("🚀 ===================================================");
  console.log("   INICIANDO MOTOR DE ATUALIZAÇÃO GEOGRÁFICA DE ALTA PRECISÃO");
  console.log("===================================================\n");

  const startTime = Date.now();
  let successCount = 0;
  let skippedCount = 0;

  try {
    const records = await fetchCandidates();

    if (records.length === 0) {
      console.log("🎉 Todos os estabelecimentos já estão geocodificados com precisão!");
      return;
    }

    // Set a maximum limit of processing for a single command execution to avoid timing out the HTTP interface
    // 25 records * 5 seconds = 125 seconds (~2 minutes), which fits perfectly within safe execution limits!
    const MAX_RECORDS_THIS_RUN = 5;
    const processCount = Math.min(records.length, MAX_RECORDS_THIS_RUN);

    console.log(`\n⏳ Processando nesta execução o lote inicial de ${processCount} itens prioritários (de ${records.length} totais restantes)...`);
    console.log(`Os restantes serão executados de forma assíncrona ou incremental.\n`);

    for (let i = 0; i < processCount; i++) {
      const record = records[i];
      const progress = `[${i + 1}/${processCount}]`;

      console.log(`🔍 Pesquisando localização real de: "${record.name}"...`);

      const result = await resolveCoordinatesWithGemini(record);

      if (result.latitude && result.longitude) {
        const { error: updateError } = await supabase
          .from("establishments")
          .update({
            latitude: result.latitude,
            longitude: result.longitude,
          })
          .eq("id", record.id);

        if (updateError) {
          console.error(`❌ ${progress} Erro ao salvar no banco:`, updateError.message);
          skippedCount++;
        } else {
          console.log(`✅ ${progress} Gravado com alta precisão: "${record.name}" -> (${result.latitude.toFixed(6)}, ${result.longitude.toFixed(6)})`);
          successCount++;
          saveGeocodedId(record.id);
        }
      } else {
        console.warn(`⚠️ ${progress} Não localizado exato para "${record.name}" | Motivo: ${result.error}`);
        skippedCount++;
        // We can also save dummy state to avoid loop lock if it's completely unresolvable, but let's let next retry try
      }

      await delay(RATE_LIMIT_DELAY_MS);
    }

    const durationSeconds = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log("\n===================================================");
    console.log("📊 RESUMO DESTE LOTE DE EXECUÇÃO:");
    console.log(`- Tempo de Execução: ${durationSeconds} segundos`);
    console.log(`- Corrigidos com Sucesso neste lote: ${successCount}`);
    console.log(`- Desprezados/Ignorados neste lote: ${skippedCount}`);
    console.log(`- Progresso total salvo em: scripts/geocoded-ids.json`);
    console.log("===================================================\n");

  } catch (err: any) {
    console.error("💥 Falha Crítica no Pipeline:", err.message);
  }
}

runCorrectionPipeline();
