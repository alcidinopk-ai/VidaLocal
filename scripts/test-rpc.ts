import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

async function tryRPC() {
  console.log("⏱️ Testando RPC para executar SQL no Supabase...");
  
  const sql = `ALTER TABLE establishments ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;`;
  
  // Try common RPC names for executing SQL
  const rpcNames = ['exec_sql', 'execute_sql', 'run_sql', 'sql'];
  
  for (const rpcName of rpcNames) {
    try {
      console.log(`⏱️ Tentando RPC: ${rpcName}...`);
      const { data, error } = await supabase.rpc(rpcName, { query: sql, sql: sql, sql_query: sql });
      if (!error) {
        console.log(`🎉 Sucesso com o RPC ${rpcName}! Retorno:`, data);
        return;
      }
      console.log(`❌ RPC ${rpcName} falhou:`, error.message);
    } catch (err: any) {
      console.log(`❌ Erro ao chamar RPC ${rpcName}:`, err.message);
    }
  }
}

tryRPC();
