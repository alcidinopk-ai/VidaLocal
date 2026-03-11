import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('Supabase server-side credentials missing. Check VITE_SUPABASE_URL/SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SERVICE_KEY');
}

let client: any;
try {
  const url = supabaseUrl || 'https://placeholder.supabase.co';
  const key = supabaseServiceKey || 'placeholder';
  client = createClient(url, key);
} catch (e: any) {
  console.error('Critical error initializing Supabase client:', e.message);
  // Create a mock client that returns errors instead of crashing
  client = {
    from: () => ({
      select: () => ({
        limit: () => Promise.resolve({ data: null, error: { message: `Client init failed: ${e.message}` } }),
        eq: () => ({ limit: () => Promise.resolve({ data: null, error: { message: `Client init failed: ${e.message}` } }) }),
        in: () => ({ limit: () => Promise.resolve({ data: null, error: { message: `Client init failed: ${e.message}` } }) }),
      }),
      insert: () => Promise.resolve({ data: null, error: { message: `Client init failed: ${e.message}` } }),
      update: () => Promise.resolve({ data: null, error: { message: `Client init failed: ${e.message}` } }),
    })
  };
}

export const supabaseAdmin = client;
