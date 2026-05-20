import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

async function checkProgress() {
  const { data, error } = await supabase
    .from("establishments")
    .select(`
      id,
      name,
      latitude,
      longitude
    `);

  if (error) {
    console.error("Error:", error.message);
    return;
  }

  let autoCount = 0;
  let sample: any[] = [];
  for (const item of data || []) {
    const isAuto = item.id.includes("-") && item.id.length > 10;
    if (isAuto) {
      autoCount++;
      sample.push(item);
    }
  }

  console.log(`\n📊 Total de Estabelecimentos Integrados Automáticos encontrados: ${autoCount}`);
  console.log("Amostra dos primeiros 10 registros:");
  console.log(JSON.stringify(sample.slice(0, 10), null, 2));
}

checkProgress();
