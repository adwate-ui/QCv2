#!/usr/bin/env node
/**
 * Build script for Cloudflare Workers
 * 
 * This script uses esbuild to bundle worker entry points into optimized
 * JavaScript files ready for deployment to Cloudflare Workers.
 * 
 * Input:  workers/*.ts, workers/*.mjs, workers/*.js
 * Output: dist/workers/*.js
 */

import * as esbuild from 'esbuild';
import { readdir } from 'fs/promises';
import { join, basename, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const WORKERS_DIR = join(__dirname, 'workers');
const OUTPUT_DIR = join(__dirname, 'dist', 'workers');

async function buildWorkers() {
  console.log('🔨 Building Cloudflare Workers...\n');

  try {
    // Find all worker entry points
    const files = await readdir(WORKERS_DIR);
    const workerFiles = files.filter(file => 
      /\.(ts|mjs|js)$/.test(file) && !file.endsWith('.d.ts')
    );

    if (workerFiles.length === 0) {
      console.log('⚠️  No worker files found in workers/ directory');
      return;
    }

    console.log(`Found ${workerFiles.length} worker(s) to build:`);
    workerFiles.forEach(file => console.log(`  - ${file}`));
    console.log();

    // Build each worker
    for (const file of workerFiles) {
      const inputPath = join(WORKERS_DIR, file);
      const outputName = basename(file, extname(file)) + '.js';
      const outputPath = join(OUTPUT_DIR, outputName);

      console.log(`📦 Building ${file}...`);

      await esbuild.build({
        entryPoints: [inputPath],
        bundle: true,
        outfile: outputPath,
        format: 'esm',
        target: 'es2022',
        platform: 'browser', // Workers use browser-like environment
        minify: true,
        sourcemap: false,
        treeShaking: true,
        // Cloudflare Workers have Node.js compatibility layer
        conditions: ['worker', 'browser'],
        mainFields: ['browser', 'module', 'main'],
        logLevel: 'info',
      });

      console.log(`  ✅ Built to dist/workers/${outputName}`);
    }

    console.log(`\n✨ Successfully built ${workerFiles.length} worker(s)!`);
    console.log(`\n📂 Output directory: dist/workers/`);
    console.log('\n💡 To deploy a worker:');
    console.log('   wrangler deploy dist/workers/<worker-name>.js\n');

  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

buildWorkers();
