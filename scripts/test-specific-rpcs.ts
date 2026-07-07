import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

async function tryRPC() {
  console.log("⏱️ Testing RPC with single arguments...");
  const sql = `ALTER TABLE establishments ADD COLUMN IF NOT EXISTS telegram_url TEXT;`;
  
  const rpcs = [
    { name: 'exec_sql', param: 'query' },
    { name: 'exec_sql', param: 'sql' },
    { name: 'execute_sql', param: 'query' },
    { name: 'execute_sql', param: 'sql' },
    { name: 'run_sql', param: 'query' },
    { name: 'run_sql', param: 'sql' },
  ];

  for (const rpc of rpcs) {
    try {
      console.log(`⏱️ Trying RPC: ${rpc.name} with parameter: ${rpc.param}...`);
      const { data, error } = await supabase.rpc(rpc.name, { [rpc.param]: sql });
      if (!error) {
        console.log(`🎉 Success with ${rpc.name}!`, data);
        return;
      }
      console.log(`❌ ${rpc.name}(${rpc.param}) failed:`, error.message);
    } catch (err: any) {
      console.log(`❌ Error:`, err.message);
    }
  }
}

tryRPC();
