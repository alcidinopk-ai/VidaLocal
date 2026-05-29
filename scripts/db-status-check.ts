import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

async function checkStatus() {
  console.log("🔍 ANALISANDO TABELA ESTABLISHMENTS EM SUPABASE...");

  // 1. Total records
  const { count: total, error: totalErr } = await supabase
    .from("establishments")
    .select("*", { count: "exact", head: true });

  if (totalErr) {
    console.error("Erro ao buscar total:", totalErr.message);
    return;
  }
  console.log(`- Total de linhas na tabela establishments: ${total}`);

  // 2. Group by status
  console.log("\n--- Contagem por Status ---");
  const statuses = ["approved", "pending", "rejected", "disabled", "deleted"];
  for (const status of statuses) {
    const { count, error } = await supabase
      .from("establishments")
      .select("*", { count: "exact", head: true })
      .eq("status", status);
    
    if (!error) {
      console.log(`- Status [${status}]: ${count}`);
    }
  }

  // Let's query all distinct values of status to see if there are any other status values
  const { data: allData, error: allError } = await supabase
    .from("establishments")
    .select("status");
  
  if (!allError && allData) {
    const statusSet = new Set(allData.map(d => d.status));
    console.log(`- Todos os valores de status encontrados na tabela:`, Array.from(statusSet));
  }

  // 3. Check for manually added ones versus automatic/seeded ones
  // Typically, seeded ones have short IDs like letters or sequential, or specific created_at dates,
  // whereas manually added ones have specific creators or UUID format ids.
  const { data: ests, error: estsErr } = await supabase
    .from("establishments")
    .select("id, name, created_at, status, user_id, user_email")
    .order("created_at", { ascending: false });

  if (!estsErr && ests) {
    let manualCount = 0;
    let withCreatorCount = 0;
    let uuidCount = 0;
    for (const est of ests) {
      const isUuid = est.id.includes("-") && est.id.length > 20;
      if (isUuid) uuidCount++;
      if (est.user_id || est.user_email) withCreatorCount++;
      // Let's assume manual ones are UUIDs or have creator info
      if (isUuid && (est.user_id || est.user_email)) {
        manualCount++;
      }
    }
    console.log(`\n--- Classificação de Registros ---`);
    console.log(`- Registros com ID formato UUID: ${uuidCount}`);
    console.log(`- Registros com Criador informado (user_id ou user_email): ${withCreatorCount}`);
    console.log(`- Registros identificados como manuais de usuários (UUID e Criador): ${manualCount}`);
  }
}

checkStatus();
