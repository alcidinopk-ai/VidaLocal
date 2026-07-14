import { getSupabaseAdmin } from "./src/lib/supabase-server";

async function run() {
  console.log("=== SPECIFIC ESTABLISHMENT DETAILS ===");
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    console.error("Failed to initialize Supabase client.");
    return;
  }

  // Fetch the matched Polly rows with all columns
  const { data: pollys, error } = await supabase
    .from('establishments')
    .select('*')
    .in('id', ['276b7443-fc47-49c6-8078-7ff69d1b3665', '8ef7b5ec-4cd1-493e-98d4-2a49ed138130']);
  
  if (error) {
    console.error("Error fetching specific establishments:", error.message);
  } else {
    console.log("Columns on establishments:", Object.keys(pollys?.[0] || {}));
    console.log("Polly rows details:", JSON.stringify(pollys, null, 2));
  }
}

run();
