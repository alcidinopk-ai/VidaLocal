import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing SUPABASE credentials!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  console.log("Checking columns on 'establishments' table...");
  const { data, error } = await supabase
    .from("establishments")
    .select("*")
    .limit(1);

  if (error) {
    console.error("Error fetching table schema:", error);
    return;
  }

  const existingCols = data && data.length > 0 ? Object.keys(data[0]) : [];
  console.log("Existing columns:", existingCols);

  const targetCols = [
    "instagram_url",
    "facebook_url",
    "whatsapp_url",
    "youtube_url",
    "tiktok_url",
    "linkedin_url",
    "twitter_url",
    "telegram_url",
    "google_maps_url"
  ];

  console.log("Validating missing columns...");
  const missing = targetCols.filter(c => !existingCols.includes(c));
  console.log("Missing columns:", missing);

  if (missing.length > 0) {
    console.log("Adding missing columns via direct SQL if possible, or we will need to create them.");
    // In Supabase, if we have service key, we can try to execute sql via rpc, but let's check if there's an api for SQL or migration.
    // If not, we can run them or report them. Let's see if we have an rpc for running sql or if we can use sql_execution.
    // Note that Supabase doesn't have a direct REST API for ALTER TABLE unless an RPC exists.
    // Let's check if there is an RPC we can use or if we can use postgres.
  }
}

run();
