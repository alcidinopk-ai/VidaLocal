import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const sUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const sKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  
  const debug: any = {
    timestamp: new Date().toISOString(),
    env: {
      has_url: !!sUrl,
      has_key: !!sKey,
      url_prefix: sUrl ? sUrl.substring(0, 20) : null,
    },
    connection: {}
  };

  if (!sUrl || !sKey) {
    return res.status(200).json({ ...debug, status: 'missing_config' });
  }

  try {
    const supabase = createClient(sUrl, sKey);
    const { data, error } = await supabase.from('cities').select('count', { count: 'exact', head: true });
    
    if (error) {
      debug.connection = { status: 'error', message: error.message };
    } else {
      debug.connection = { status: 'success', count: data };
    }
  } catch (e: any) {
    debug.connection = { status: 'exception', message: e.message };
  }

  return res.status(200).json(debug);
}
