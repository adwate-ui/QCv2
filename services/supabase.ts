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

// 3. Default credentials for the shared Supabase account
const DEFAULT_SUPABASE_URL = 'https://gbsgkvmjtsjpmjrpupma.supabase.co';
const DEFAULT_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdic2drdm1qdHNqcG1qcnB1cG1hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUwOTQ4MjQsImV4cCI6MjA4MDY3MDgyNH0.GYsoEO8qJXOsiOjK2QHYMOOI0OFAdc9KqX1SA-Z-3ac';

// 4. Use Stored, Environment, or Default Credentials
export const supabaseUrl = storedUrl || envUrl || DEFAULT_SUPABASE_URL;
const supabaseKey = storedKey || envKey || DEFAULT_SUPABASE_KEY;

// Helper to check if we are using real credentials
export const isSupabaseConfigured = () => {
  return supabaseUrl !== 'https://placeholder-project.supabase.co' && 
         supabaseUrl !== '' &&
         supabaseKey !== 'placeholder-key' &&
         supabaseKey !== '';
};

// Only create client if credentials are configured to avoid "supabaseUrl is required" error
// Note: App.tsx checks isSupabaseConfigured() before mounting AppProvider, so supabase
// will never be null when actually used by components. The null case only exists during
// initial module load when credentials haven't been set up yet.
export const supabase = isSupabaseConfigured() 
  ? createClient(supabaseUrl, supabaseKey)
  : null as any; // Type assertion for backwards compatibility, but won't be used when not configured

export const saveSupabaseConfig = (url: string, key: string) => {
  localStorage.setItem('VITE_SUPABASE_URL', url);
  localStorage.setItem('VITE_SUPABASE_ANON_KEY', key);
  window.location.reload(); // Reload to re-init client
};