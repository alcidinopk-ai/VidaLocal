import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

async function check() {
  const { data, error } = await supabase
    .from("establishment_opening_hours")
    .select("*")
    .limit(1);

  if (error) {
    console.error("Erro:", error);
  } else if (data && data.length > 0) {
    console.log("Colunas em 'establishment_opening_hours':", Object.keys(data[0]));
  } else {
    console.log("Sem registros em 'establishment_opening_hours'.");
  }
}

check();
