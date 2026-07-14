import { getSupabaseAdmin } from "./src/lib/supabase-server";

async function run() {
  console.log("=== LIST OF TABLES IN DATABASE ===");
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    console.error("Failed to initialize Supabase client.");
    return;
  }

  // Since Supabase JS has no raw sql execution unless we use RPC or direct SQL,
  // we can try fetching from different suspected tables or call an RPC to list them.
  // Wait, does our database have an RPC to run arbitrary SQL or do we have direct PostgreSQL connection info?
  // Let's inspect our process.env variables to see if there's a DATABASE_URL or direct connection string.
  console.log("Environment variables:", {
    HAS_DATABASE_URL: !!process.env.DATABASE_URL,
    HAS_SUPABASE_URL: !!process.env.SUPABASE_URL,
    HAS_VITE_SUPABASE_URL: !!process.env.VITE_SUPABASE_URL,
  });

  // Let's try fetching a single row from several tables to see which ones exist
  const tables = [
    'establishments',
    'profiles',
    'business_claims',
    'search_intents',
    'cities',
    'states'
  ];

  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.log(`❌ Table '${table}' check error:`, error.message);
    } else {
      console.log(`✅ Table '${table}' exists! Row count in sample:`, data?.length);
    }
  }
}

run();
