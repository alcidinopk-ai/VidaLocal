import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

async function checkHighPrecision() {
  const { data, error } = await supabase
    .from("establishments")
    .select("id, name, latitude, longitude, updated_at")
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("Error:", error.message);
    return;
  }

  let count = 0;
  const list: any[] = [];
  for (const item of data || []) {
    const latStr = String(item.latitude);
    const lngStr = String(item.longitude);
    const decimalsLat = latStr.split(".")[1] || "";
    const decimalsLng = lngStr.split(".")[1] || "";

    // If coordinates have high precision (more than 4 decimal places, typical of Gemini Grounding)
    if (decimalsLat.length > 4 || decimalsLng.length > 4) {
      count++;
      list.push(item);
    }
  }

  console.log(`\n📊 Total de Estabelecimentos com Coordenadas de Alta Precisão (Geradas por Gemini/Maps): ${count}`);
  console.log("Os 15 mais recentes atualizados:");
  console.log(JSON.stringify(list.slice(0, 15), null, 2));
}

checkHighPrecision();
