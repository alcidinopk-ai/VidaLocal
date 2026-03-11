import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const sUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const sKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  
  const debug: any = {
    timestamp: new Date().toISOString(),
    config: {
      has_url: !!sUrl,
      has_key: !!sKey,
      url_prefix: sUrl ? sUrl.substring(0, 20) : null,
    },
    tables: {}
  };

  if (sUrl && sKey) {
    try {
      const supabase = createClient(sUrl, sKey);
      
      const { data: cities, error: cityErr } = await supabase.from('cities').select('*').limit(5);
      debug.tables.cities = { count: cities?.length || 0, error: cityErr?.message, sample: cities };

      const { data: ests, error: estErr } = await supabase.from('establishments').select('*').limit(5);
      debug.tables.establishments = { count: ests?.length || 0, error: estErr?.message, sample: ests };
      
      if (ests && ests.length > 0) {
        debug.tables.establishments.columns = Object.keys(ests[0]);
      }
    } catch (e: any) {
      debug.error = e.message;
    }
  }

  res.json(debug);
}
