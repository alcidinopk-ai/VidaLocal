import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

async function checkMetadata() {
  console.log("🏙️ BUSCANDO CIDADES NO BANCO...");
  const { data: cities, error: hError } = await supabase.from("cities").select("*");
  if (hError) {
    console.error("Erro ao buscar cidades:", hError.message);
  } else {
    console.log(`Encontradas ${cities?.length} cidades:`);
    console.log(cities?.map(c => ({ id: c.id, name: c.name, state_id: c.state_id })).slice(0, 30));
  }

  console.log("\n🇧🇷 BUSCANDO ESTADOS NO BANCO...");
  const { data: states, error: sError } = await supabase.from("states").select("*");
  if (sError) {
    console.error("Erro ao buscar estados:", sError.message);
  } else {
    console.log(`Encontrados ${states?.length} estados:`);
    console.log(states?.map(s => ({ id: s.id, name: s.name, uf: s.uf })));
  }

  // Let's also list categories if a table exists
  console.log("\n📁 BUSCANDO CATEGORIAS NO BANCO INTERNO (taxonomia)...");
}

checkMetadata();
