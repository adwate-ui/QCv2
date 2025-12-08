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

// 3. Use Provided Credentials as Default
export const supabaseUrl = storedUrl || envUrl || 'https://gbsgkvmjtsjpmjrpupma.supabase.co';
const supabaseKey = storedKey || envKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdic2drdm1qdHNqcG1qcnB1cG1hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUwOTQ4MjQsImV4cCI6MjA4MDY3MDgyNH0.GYsoEO8qJXOsiOjK2QHYMOOI0OFAdc9KqX1SA-Z-3ac';

export const supabase = createClient(supabaseUrl, supabaseKey);

// Helper to check if we are using real credentials
export const isSupabaseConfigured = () => {
  return supabaseUrl !== 'https://placeholder-project.supabase.co' && 
         supabaseUrl !== '' &&
         supabaseKey !== 'placeholder-key' &&
         supabaseKey !== '';
};

export const saveSupabaseConfig = (url: string, key: string) => {
  localStorage.setItem('VITE_SUPABASE_URL', url);
  localStorage.setItem('VITE_SUPABASE_ANON_KEY', key);
  window.location.reload(); // Reload to re-init client
};