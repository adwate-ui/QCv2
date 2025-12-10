/**
 * Environment variable validation and configuration
 * Ensures all required environment variables are available and valid
 */

interface EnvConfig {
  GEMINI_API_KEY: string;
  VITE_IMAGE_PROXY_URL: string;
  VITE_SUPABASE_URL: string;
  VITE_SUPABASE_ANON_KEY: string;
}

/**
 * Get environment variable from various sources (Vite, Node, etc.)
 */
const getEnvVar = (key: string): string => {
  // Check import.meta.env (Vite)
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
    return import.meta.env[key] as string;
  }
  
  // Check process.env (Node/Webpack)
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key] as string;
  }
  
  // Check localStorage for dynamic configuration
  if (typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem(key);
    if (stored) return stored;
  }
  
  return '';
};

/**
 * Validate that a URL is properly formatted
 */
const isValidUrl = (url: string): boolean => {
  if (!url) return false;
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

/**
 * Validate environment variables
 * Returns array of validation errors
 */
export const validateEnv = (): string[] => {
  const errors: string[] = [];
  
  // GEMINI_API_KEY is required for core functionality
  const geminiKey = getEnvVar('GEMINI_API_KEY');
  if (!geminiKey) {
    errors.push('GEMINI_API_KEY is not set. Product identification and QC analysis will not work.');
  } else if (geminiKey.includes('your_') || geminiKey === 'placeholder') {
    errors.push('GEMINI_API_KEY appears to be a placeholder. Please set a valid API key.');
  }
  
  // IMAGE_PROXY_URL is optional but recommended
  const proxyUrl = getEnvVar('VITE_IMAGE_PROXY_URL');
  if (!proxyUrl) {
    console.warn('VITE_IMAGE_PROXY_URL is not set. Image fetching from URLs will be limited.');
  } else if (!isValidUrl(proxyUrl)) {
    errors.push('VITE_IMAGE_PROXY_URL is not a valid URL.');
  }
  
  // Supabase config is optional (falls back to in-memory storage)
  const supabaseUrl = getEnvVar('VITE_SUPABASE_URL');
  const supabaseKey = getEnvVar('VITE_SUPABASE_ANON_KEY');
  
  if (supabaseUrl && !isValidUrl(supabaseUrl)) {
    errors.push('VITE_SUPABASE_URL is not a valid URL.');
  }
  
  if (supabaseUrl && !supabaseKey) {
    errors.push('VITE_SUPABASE_URL is set but VITE_SUPABASE_ANON_KEY is missing.');
  }
  
  if (!supabaseUrl && supabaseKey) {
    console.warn('VITE_SUPABASE_ANON_KEY is set but VITE_SUPABASE_URL is missing.');
  }
  
  return errors;
};

/**
 * Get validated environment configuration
 */
export const getEnvConfig = (): Partial<EnvConfig> => {
  return {
    GEMINI_API_KEY: getEnvVar('GEMINI_API_KEY'),
    VITE_IMAGE_PROXY_URL: getEnvVar('VITE_IMAGE_PROXY_URL'),
    VITE_SUPABASE_URL: getEnvVar('VITE_SUPABASE_URL'),
    VITE_SUPABASE_ANON_KEY: getEnvVar('VITE_SUPABASE_ANON_KEY'),
  };
};

/**
 * Check if app is in production mode
 */
export const isProduction = (): boolean => {
  return import.meta.env.PROD || import.meta.env.MODE === 'production';
};

/**
 * Check if app is in development mode
 */
export const isDevelopment = (): boolean => {
  return import.meta.env.DEV || import.meta.env.MODE === 'development';
};

/**
 * Log environment validation errors
 * In production, only logs errors. In development, also logs warnings.
 */
export const logEnvValidation = (): void => {
  const errors = validateEnv();
  
  if (errors.length > 0) {
    console.error('❌ Environment Configuration Errors:');
    errors.forEach(error => console.error(`  - ${error}`));
    
    if (isProduction()) {
      console.error('⚠️  Application may not function correctly in production mode.');
    }
  } else if (isDevelopment()) {
    console.info('✅ Environment configuration validated successfully');
  }
};
