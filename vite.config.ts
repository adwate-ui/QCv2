import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const isProd = mode === 'production';
    
    return {
      base: '/',
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        // Also expose GEMINI_API_KEY via import.meta.env for consistency
        'import.meta.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        // Production optimizations
        target: 'es2022',
        outDir: 'dist',
        assetsDir: 'assets',
        sourcemap: !isProd, // Source maps only in development
        minify: isProd ? 'esbuild' : false, // Use esbuild (built-in, faster than terser)
        cssMinify: isProd,
        
        // Chunk splitting for better caching
        rollupOptions: {
          output: {
            manualChunks: {
              // Vendor chunks
              'react-vendor': ['react', 'react-dom', 'react-router-dom'],
              'gemini-vendor': ['@google/genai'],
              'supabase-vendor': ['@supabase/supabase-js'],
              'image-vendor': ['pixelmatch', 'pngjs', 'jpeg-js'],
            },
            // Asset naming for better caching
            chunkFileNames: isProd ? 'assets/js/[name]-[hash].js' : 'assets/js/[name].js',
            entryFileNames: isProd ? 'assets/js/[name]-[hash].js' : 'assets/js/[name].js',
            assetFileNames: isProd ? 'assets/[ext]/[name]-[hash][extname]' : 'assets/[ext]/[name][extname]',
          }
        },
        
        // esbuild minify options for production
        esbuild: isProd ? {
          drop: ['console', 'debugger'], // Remove console and debugger statements
        } : undefined,
        
        // Optimize chunk size
        chunkSizeWarningLimit: 1000, // Warn for chunks larger than 1000kb
      },
      
      // Optimize dependencies
      optimizeDeps: {
        include: ['react', 'react-dom', 'react-router-dom'],
        exclude: [],
      },
    };
});
