import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

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

  let attempts = 0;
  const maxAttempts = 8;

  while (attempts < maxAttempts) {
    attempts++;
    console.log(`\n--- Tentativa ${attempts} ---`);
    console.log("Payload keys:", Array.isArray(currentPayload) ? currentPayload.map(x => Object.keys(x)) : Object.keys(currentPayload));
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
        return { data: result.data, error: null };
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

  console.log("Limpando horários antigos...");
  await supabase.from("establishment_opening_hours").delete().eq("establishment_id", est.id);

  console.log("Inserindo novos horários...");
  const hoursPayload = [
    {
      establishment_id: est.id,
      day_of_week: 1,
      open_time: "08:00",
      close_time: "18:00",
      is_closed: false
    },
    {
      establishment_id: est.id,
      day_of_week: 2,
      open_time: null,
      close_time: null,
      is_closed: true
    }
  ];

  const res = await safeSupabaseWrite(supabase, "establishment_opening_hours", "insert", hoursPayload);
  console.log("\nResultado final:", res);
}

run();
