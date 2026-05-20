import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

async function showCreationTimes() {
  const { data, error } = await supabase
    .from("establishments")
    .select("id, name, created_at, latitude, longitude");

  if (error) {
    console.error("Error:", error.message);
    return;
  }

  const times: {[key: string]: number} = {};
  for (const item of data || []) {
    const minStr = String(item.created_at).slice(0, 16); // YYYY-MM-DD HH:mm
    times[minStr] = (times[minStr] || 0) + 1;
  }

  console.log("\n📊 Distribuição dos tempos de criação (por minuto):");
  console.log(JSON.stringify(times, null, 2));
}

showCreationTimes();
