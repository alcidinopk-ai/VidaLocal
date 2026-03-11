import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const sUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const sKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  
  let supabase_status = "not_configured";
  let table_schema: any = null;

  if (sUrl && sKey) {
    try {
      const supabase = createClient(sUrl, sKey);
      const { data, error } = await supabase.from('establishments').select('*').limit(1);
      if (error) {
        supabase_status = `error: ${error.message}`;
      } else {
        supabase_status = "connected";
        if (data && data.length > 0) {
          table_schema = Object.keys(data[0]);
        } else {
          supabase_status = "connected_but_empty";
        }
      }
    } catch (e: any) {
      supabase_status = `exception: ${e.message}`;
    }
  }

  res.json({ 
    status: "ok", 
    timestamp: new Date().toISOString(),
    supabase: supabase_status,
    schema: table_schema,
    env: process.env.NODE_ENV
  });
}
