import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

function deserializeEstablishment(item: any): any {
  if (!item) return item;
  
  if (Array.isArray(item)) {
    return item.map(deserializeEstablishment);
  }
  
  if (typeof item !== 'object') return item;
  
  if (typeof item.tags === 'string' && item.tags.includes('[meta:')) {
    const match = item.tags.match(/\[meta:(.*?)\]/);
    if (match && match[1]) {
      try {
        const meta = JSON.parse(match[1]);
        if (meta.telegram_url !== undefined) {
          item.telegram_url = meta.telegram_url;
          item.telegramUrl = meta.telegram_url;
        }
        if (meta.google_maps_url !== undefined) {
          item.google_maps_url = meta.google_maps_url;
          item.googleMapsUrl = meta.google_maps_url;
        }
      } catch (e) {
        console.error('[Metadata] Error parsing establishment meta from tags:', e);
      }
      // Remove the meta block from tags so it doesn't pollute the UI
      item.tags = item.tags.replace(/\s*\[meta:.*?\]/g, '').trim();
    }
  }
  
  // Recursively process any other properties
  for (const key of Object.keys(item)) {
    if (item[key] && typeof item[key] === 'object') {
      item[key] = deserializeEstablishment(item[key]);
    }
  }
  
  return item;
}

async function safeSupabaseWrite(
  supabase: any,
  tableName: string,
  operation: 'insert' | 'update',
  payload: any,
  idToUpdate?: string
): Promise<{ data: any[] | null; error: any }> {
  let currentPayload = Array.isArray(payload) 
    ? payload.map((p: any) => ({ ...p }))
    : { ...payload };

  const serializeMetadata = (item: any) => {
    const meta: any = {};
    if (item.telegram_url !== undefined) {
      meta.telegram_url = item.telegram_url;
    }
    if (item.telegramUrl !== undefined) {
      meta.telegram_url = item.telegramUrl;
    }
    if (item.google_maps_url !== undefined) {
      meta.google_maps_url = item.google_maps_url;
    }
    if (item.googleMapsUrl !== undefined) {
      meta.google_maps_url = item.googleMapsUrl;
    }

    if (Object.keys(meta).length > 0) {
      let tagsStr = item.tags || '';
      // Strip any existing metadata block first to avoid duplication
      tagsStr = tagsStr.replace(/\s*\[meta:.*?\]/g, '');
      item.tags = `${tagsStr} [meta:${JSON.stringify(meta)}]`.trim();
    }
  };

  if (tableName === 'establishments') {
    if (Array.isArray(currentPayload)) {
      currentPayload.forEach(serializeMetadata);
    } else {
      serializeMetadata(currentPayload);
    }
  }

  let attempts = 0;
  const maxAttempts = 8;

  while (attempts < maxAttempts) {
    attempts++;
    console.log(`\n--- Tentativa ${attempts} ---`);
    console.log("Payload:", JSON.stringify(currentPayload, null, 2));
    try {
      let result;
      if (operation === 'insert') {
        const toInsert = Array.isArray(currentPayload) ? currentPayload : [currentPayload];
        result = await supabase.from(tableName).insert(toInsert).select();
      } else {
        result = await supabase.from(tableName).update(currentPayload).eq('id', idToUpdate).select();
      }

      if (!result.error) {
        console.log("✅ Sucesso!");
        const deserializedData = result.data ? result.data.map(deserializeEstablishment) : result.data;
        return { data: deserializedData, error: null };
      }

      const error = result.error;
      console.log(`❌ Erro recebido (Código: ${error.code}): ${error.message}`);
      
      const isMissingColumnError = 
        error.code === '42703' || 
        error.code === 'PGRST204' || 
        (error.message && error.message.toLowerCase().includes('could not find') && error.message.toLowerCase().includes('column'));

      if (isMissingColumnError && error.message) {
        let match = error.message.match(/Could not find the '([^']+)' column/i);
        if (!match) {
          match = error.message.match(/column "([^"]+)" of relation/i);
        }
        if (!match) {
          match = error.message.match(/column '([^']+)' does not exist/i);
        }

        if (match && match[1]) {
          const columnName = match[1];
          console.warn(`[SafeSupabaseWrite] Coluna ausente detectada: '${columnName}'. Removendo do payload.`);
          
          if (Array.isArray(currentPayload)) {
            currentPayload = currentPayload.map((p: any) => {
              const newP = { ...p };
              delete newP[columnName];
              return newP;
            });
          } else {
            delete currentPayload[columnName];
          }
          continue;
        }

        console.log("⚠️ Erro de coluna ausente, mas nenhum nome de coluna foi capturado pelo regex.");
      } else {
        console.log("⚠️ Não é um erro de coluna ausente.");
      }

      return { data: null, error };

    } catch (err: any) {
      console.error(`Erro inesperado na tentativa ${attempts}:`, err);
      return { data: null, error: { message: err.message, code: err.code || 'UNEXPECTED' } };
    }
  }

  return { data: null, error: { message: "Maximum recovery retries reached.", code: "MAX_RETRIES" } };
}

async function run() {
  const { data: ests } = await supabase.from("establishments").select("*").limit(1);
  if (!ests || ests.length === 0) return;
  const est = ests[0];

  const payload = {
    name: est.name,
    telegram_url: 'https://t.me/test',
    google_maps_url: 'https://maps.google.com/?cid=123',
    instagram_url: 'https://instagram.com/test',
    state_id: est.state_id
  };

  const res = await safeSupabaseWrite(supabase, "establishments", "update", payload, est.id);
  console.log("\nResultado final:", res);
}

run();
