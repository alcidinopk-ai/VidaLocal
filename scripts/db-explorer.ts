import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

async function explore() {
  console.log("🔍 EXPLORANDO TABELAS EM SUPABASE...");
  
  // 1. Try to query information_schema or just check if other tables are accessible
  const tables = [
    "establishments",
    "cities",
    "states",
    "profiles",
    "user_permissions",
    "interactions",
    "establishment_opening_hours",
    "search_intents",
    "search_keywords",
    "intent_type_map",
    "establishments_backup",
    "backup",
    "deleted_establishments"
  ];

  for (const table of tables) {
    const { data, error, count } = await supabase
      .from(table)
      .select("*", { count: "exact", head: true });
    
    if (error) {
      console.log(`❌ Tabela [${table}]: Erro ou Não existe (${error.message})`);
    } else {
      console.log(`✅ Tabela [${table}]: Existe! Total de registros: ${count}`);
    }
  }

  // Let's query establishments schema columns if possible
  const { data: cols, error: colErr } = await supabase
    .from("establishments")
    .select("*")
    .limit(1);

  if (!colErr && cols && cols.length > 0) {
    console.log("\n📋 Colunas em 'establishments':", Object.keys(cols[0]));
  }
}

explore();
