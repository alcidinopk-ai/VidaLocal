import { createClient } from '@supabase/supabase-js';

const getSupabaseConfig = () => {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  return { url, key };
};

let cachedAdminClient: any = null;

export const getSupabaseAdmin = () => {
  if (cachedAdminClient) return cachedAdminClient;

  try {
    const { url, key } = getSupabaseConfig();
    
    if (!url || !key || url.includes('placeholder')) {
      if (!url) console.error('[Supabase Server] ERROR: SUPABASE_URL não localizada.');
      if (!key) console.error('[Supabase Server] ERROR: Chave de serviço não localizada.');
      return null;
    }

    // Ensure URL has protocol
    const finalUrl = url.startsWith('http') ? url : `https://${url}`;
    
    cachedAdminClient = createClient(finalUrl, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    });
    console.log('[Supabase Server] Cliente admin inicializado com sucesso.');
    return cachedAdminClient;
  } catch (e: any) {
    console.error('[Supabase Server] CRITICAL ERROR during initialization:', e.message);
    return null;
  }
};

// For backward compatibility, but prefer getSupabaseAdmin()
export const supabaseAdmin = (() => {
  try {
    return getSupabaseAdmin();
  } catch (e) {
    console.error('[Supabase Server] Top-level initialization failed');
    return null;
  }
})() || {
  from: () => ({
    select: () => ({
      limit: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } }),
      eq: () => ({ limit: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } }) }),
      in: () => ({ limit: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } }) }),
    }),
    insert: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } }),
    update: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } }),
  })
};
