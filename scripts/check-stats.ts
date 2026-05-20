import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

async function showStats() {
  const { data, error } = await supabase
    .from("establishments")
    .select("id, name, latitude, longitude");

  if (error) {
    console.error("Error:", error.message);
    return;
  }

  const freq: {[key: string]: number} = {};
  for (const item of data || []) {
    freq[item.name] = (freq[item.name] || 0) + 1;
  }

  const sorted = Object.entries(freq).sort((a,b) => b[1] - a[1]);
  console.log(`\n📊 Total de Estabelecimentos Únicos por nome: ${sorted.length}`);
  console.log("Os 20 nomes mais frequentes:");
  console.log(JSON.stringify(sorted.slice(0, 20), null, 2));
}

showStats();
