import { createClient } from '@supabase/supabase-js';

// Helper to safely get env vars in different environments (Vite vs others)
const getEnv = (key: string) => {
  // Check import.meta.env (Vite)
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
    // @ts-ignore
    return import.meta.env[key];
  }
  // Check process.env (Node/Webpack)
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key];
  }
  return '';
};

// 1. Try LocalStorage (for dynamic setup in browser)
const storedUrl = typeof localStorage !== 'undefined' ? localStorage.getItem('VITE_SUPABASE_URL') : null;
const storedKey = typeof localStorage !== 'undefined' ? localStorage.getItem('VITE_SUPABASE_ANON_KEY') : null;

// 2. Try Environment Variables
const envUrl = getEnv('VITE_SUPABASE_URL');
const envKey = getEnv('VITE_SUPABASE_ANON_KEY');

// 3. Use Stored or Environment Credentials (no hardcoded defaults for security)
export const supabaseUrl = storedUrl || envUrl || '';
const supabaseKey = storedKey || envKey || '';

// Helper to check if we are using real credentials
export const isSupabaseConfigured = () => {
  return supabaseUrl !== 'https://placeholder-project.supabase.co' && 
         supabaseUrl !== '' &&
         supabaseKey !== 'placeholder-key' &&
         supabaseKey !== '';
};

// Only create client if credentials are configured to avoid "supabaseUrl is required" error
export const supabase = isSupabaseConfigured() 
  ? createClient(supabaseUrl, supabaseKey)
  : null as any; // Type assertion for backwards compatibility, but won't be used when not configured

export const saveSupabaseConfig = (url: string, key: string) => {
  localStorage.setItem('VITE_SUPABASE_URL', url);
  localStorage.setItem('VITE_SUPABASE_ANON_KEY', key);
  window.location.reload(); // Reload to re-init client
};