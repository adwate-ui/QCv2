#!/usr/bin/env node
/**
 * Build script for Cloudflare Pages (Frontend)
 * 
 * This script uses Vite to build the React frontend into optimized
 * static files ready for deployment to Cloudflare Pages.
 * 
 * Input:  React app source files
 * Output: dist/pages/ (static HTML, CSS, JS, assets)
 */

import { build } from 'vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { mkdir, cp } from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function buildPages() {
  console.log('🔨 Building Cloudflare Pages (Frontend)...\n');

  try {
    // Build with Vite
    console.log('📦 Building React app with Vite...');
    
    await build({
      root: __dirname,
      base: '/',
      build: {
        outDir: resolve(__dirname, 'dist'),
        emptyOutDir: false, // Don't delete workers output
        sourcemap: false,
        minify: 'esbuild',
        target: 'es2022',
      },
    });

    // After Vite build completes, copy the output to dist/pages
    const distDir = resolve(__dirname, 'dist');
    const pagesDir = resolve(__dirname, 'dist', 'pages');

    console.log('\n📂 Organizing build output...');

    // Check if dist/pages already exists from a previous build
    if (!existsSync(pagesDir)) {
      await mkdir(pagesDir, { recursive: true });
    }

    // Copy dist/* to dist/pages/* (excluding workers directory)
    // This is a workaround since Vite doesn't support nested outDir well
    // In practice, we keep the Vite output at dist/ for Cloudflare Pages
    // and just document that Pages should deploy from dist/ not dist/pages/
    
    console.log('\n✨ Successfully built frontend!');
    console.log(`\n📂 Output directory: ${distDir}/`);
    console.log('   (Ready for Cloudflare Pages deployment)');
    console.log('\n💡 To deploy:');
    console.log('   - Deploy dist/ directory to Cloudflare Pages');
    console.log('   - Or use: wrangler pages deploy dist\n');

  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

buildPages();
