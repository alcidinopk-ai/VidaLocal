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
      console.warn('[Supabase Server] initialization skipped: Config incomplete or placeholder.');
      return null;
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.SUPABASE_SERVICE_KEY) {
      console.warn('[Supabase Server] WARNING: SERVICE_ROLE_KEY missing. Falling back to ANON_KEY. RLS will be active!');
    }

    // Ensure URL has protocol
    const finalUrl = url.startsWith('http') ? url : `https://${url}`;
    
    cachedAdminClient = createClient(finalUrl, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      },
      global: {
        headers: { 'x-application-name': 'vidalocal_backend' },
        // Add fetch options with retries to handle network flakiness in Vercel
        fetch: async (url, options) => {
          let lastError;
          for (let i = 0; i < 3; i++) {
            try {
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 15000);
              
              const res = await fetch(url, {
                ...options,
                signal: controller.signal
              });
              clearTimeout(timeoutId);
              return res;
            } catch (err: any) {
              lastError = err;
              console.warn(`[Supabase Fetch] Attempt ${i + 1} failed:`, err.message);
              // Wait a bit before retrying (exponential backoff pattern)
              if (i < 2) await new Promise(resolve => setTimeout(resolve, 100 * (i + 1)));
            }
          }
          throw lastError;
        }
      },
      db: {
        schema: 'public'
      }
    });
    console.log('[Supabase Server] Admin client initialized successfully.');
    return cachedAdminClient;
  } catch (e: any) {
    console.error('[Supabase Server] CRITICAL initialization error:', e.message);
    return null;
  }
};

// For backward compatibility, but prefer getSupabaseAdmin()
export const supabaseAdmin = (() => {
  try {
    const admin = getSupabaseAdmin();
    if (admin) return admin;
  } catch (e) {
    console.error('[Supabase Server] Top-level fallback triggered');
  }
  
  return {
    from: () => ({
      select: () => ({
        limit: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } }),
        eq: () => ({ limit: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } }) }),
        in: () => ({ limit: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } }) }),
        order: () => ({ limit: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } }) }),
        or: () => ({ limit: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } }) }),
      }),
      insert: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } }),
      update: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } }),
    })
  };
})() as any;
