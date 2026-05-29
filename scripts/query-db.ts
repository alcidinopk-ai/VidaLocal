import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

async function query() {
  console.log("--- Querying establishments_backup ---");
  const { data, error } = await supabase.from("establishments_backup").select("*").limit(5);
  if (error) {
    console.error("establishments_backup error:", error.message);
  } else {
    console.log("establishments_backup data count:", data?.length);
    console.log("establishments_backup sample:", data);
  }

  console.log("\n--- Querying backup ---");
  const { data: bData, error: bError } = await supabase.from("backup").select("*").limit(5);
  if (bError) {
    console.error("backup error:", bError.message);
  } else {
    console.log("backup data count:", bData?.length);
    console.log("backup sample:", bData);
  }

  console.log("\n--- Querying deleted_establishments ---");
  const { data: dData, error: dError } = await supabase.from("deleted_establishments").select("*").limit(5);
  if (dError) {
    console.error("deleted_establishments error:", dError.message);
  } else {
    console.log("deleted_establishments data count:", dData?.length);
    console.log("deleted_establishments sample:", dData);
  }
}

query();
