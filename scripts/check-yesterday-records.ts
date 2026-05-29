import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

async function checkYesterday() {
  console.log("🔍 BUSCANDO REGISTROS DE ONTEM (2026-05-28/29)...");
  
  const { data, error } = await supabase
    .from("establishments")
    .select("id, name, created_at, user_id, user_email, address")
    .gte("created_at", "2026-05-28T00:00:00Z")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erro:", error.message);
    return;
  }

  console.log(`📊 Encontrados ${data.length} estabelecimentos criados desde ontem.`);
  console.log("\nAmostra detalhada (primeiros 30 registros):");
  
  data.slice(0, 30).forEach((item, index) => {
    console.log(`[${index + 1}] Nome: "${item.name}" | Criado em: ${item.created_at} | email: ${item.user_email || 'null'} | Endereço: "${item.address}"`);
  });
}

checkYesterday();
