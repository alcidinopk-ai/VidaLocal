import { createClient } from '@supabase/supabase-js';

const getSupabaseConfig = () => {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  return { url, key };
};

let cachedAdminClient: any = null;

export const getSupabaseAdmin = () => {
  if (cachedAdminClient) return cachedAdminClient;

  const { url, key } = getSupabaseConfig();
  
  if (!url || !key || url.includes('placeholder')) {
    return null;
  }
  
  try {
    cachedAdminClient = createClient(url, key);
    return cachedAdminClient;
  } catch (e) {
    console.error('Error creating Supabase admin client:', e);
    return null;
  }
};

// For backward compatibility, but prefer getSupabaseAdmin()
export const supabaseAdmin = getSupabaseAdmin() || {
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
