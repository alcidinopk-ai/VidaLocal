import { getSupabaseAdmin } from "./src/lib/supabase-server";

async function run() {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  console.log("Checking if catalog or schema views are exposed directly:");
  const targets = ['pg_proc', 'pg_tables', 'information_schema.tables', 'information_schema.routines'];
  for (const t of targets) {
    const { data, error } = await supabase.from(t).select('*').limit(1);
    if (error) {
      console.log(`❌ ${t}: ${error.message}`);
    } else {
      console.log(`✅ ${t} is exposed!`, data);
    }
  }
}

run();
