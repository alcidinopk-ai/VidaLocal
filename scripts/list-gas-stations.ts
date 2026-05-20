import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

async function findGasStations() {
  const { data, error } = await supabase
    .from("establishments")
    .select(`
      id,
      name,
      address,
      latitude,
      longitude,
      cities (
        name
      )
    `);

  if (error) {
    console.error("Error:", error.message);
    return;
  }

  const gasStations = (data || []).filter(item => {
    const isGasStr = item.name.toLowerCase().includes("posto") || item.name.toLowerCase().includes("combust");
    const isGurupi = (item.cities as any)?.name === "Gurupi";
    return isGasStr && isGurupi;
  });

  console.log(`\n⛽ Encontrados ${gasStations.length} postos de combustível em Gurupi:`);
  console.log(JSON.stringify(gasStations, null, 2));
}

findGasStations();
