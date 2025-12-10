# Cloudflare Pages and Workers Separation - Architecture Guide

This document describes the separated architecture for Cloudflare Pages (frontend) and Workers (backend).

## 📁 Directory Structure

```
.
├── pages/                      # React page components (UI)
├── workers/                    # Cloudflare Worker entry points
│   ├── sample-worker.ts       # Example worker
│   └── image-proxy-worker.mjs # Image proxy worker (nodejs_compat)
├── packages/
│   └── shared/                # Shared types and utilities
│       ├── types.ts           # TypeScript type definitions
│       ├── tsconfig.json      # TypeScript config for shared code
│       └── README.md          # Documentation
├── components/                # React UI components
├── context/                   # React context providers
├── services/                  # Frontend service layer
├── src/                       # Additional source files
├── public/                    # Static assets
│   └── samples/               # Sample static pages
├── dist/                      # Build output (gitignored)
│   ├── index.html            # Frontend entry point
│   ├── assets/               # Frontend assets (CSS, JS, images)
│   └── workers/              # Compiled workers
│       ├── sample-worker.js
│       └── image-proxy-worker.mjs
├── build-pages.mjs           # Pages build script
├── build-workers.mjs         # Workers build script
├── tsconfig.base.json        # Base TypeScript config
├── tsconfig.pages.json       # Pages TypeScript config
├── wrangler.toml             # Cloudflare configuration
└── package.json              # Dependencies and scripts
```

## 🔨 Build System

### Build Scripts

- **`npm run build:pages`** - Build frontend (React app) to `dist/`
- **`npm run build:workers`** - Build workers to `dist/workers/`
- **`npm run build`** - Build both pages and workers
- **`npm run typecheck`** - Type-check all TypeScript projects

### Build Process

1. **Pages Build** (Vite):
   - Input: React source files, components, pages
   - Output: `dist/` - Static HTML, CSS, JS bundles
   - Process: TypeScript compile → Vite bundle → Optimize assets

2. **Workers Build** (ESBuild):
   - Input: `workers/*.ts`, `workers/*.mjs`
   - Output: `dist/workers/*.js`, `dist/workers/*.mjs`
   - Process: 
     - `.ts` files → ESBuild bundle → Minify
     - `.mjs` files → Copy as-is (nodejs_compat workers)

### TypeScript Configuration

Three separate TypeScript projects:

1. **Pages** (`tsconfig.pages.json`)
   - Frontend code with React/DOM types
   - Can import from `packages/shared/`

2. **Workers** (`workers/tsconfig.json`)
   - Cloudflare Workers types
   - Can import from `packages/shared/`

3. **Shared** (`packages/shared/tsconfig.json`)
   - Pure TypeScript types/utilities
   - No dependencies on frontend or workers

## 🚀 Deployment

### Cloudflare Pages (Frontend)

```bash
# Build frontend
npm run build:pages

# Deploy to Cloudflare Pages
wrangler pages deploy dist --project-name=qcv2
```

**GitHub Actions**: `.github/workflows/deploy.yml`

### Cloudflare Workers (Backend)

```bash
# Build workers
npm run build:workers

# Deploy individual worker
cd dist/workers
wrangler deploy sample-worker.js
wrangler deploy image-proxy-worker.mjs
```

**GitHub Actions**: `.github/workflows/deploy-worker.yml`

### CI/CD

**Continuous Integration**: `.github/workflows/ci.yml`
- Runs on every push and pull request
- Type-checks all projects
- Builds pages and workers
- Verifies build outputs

## 🔧 Configuration

### wrangler.toml

Main configuration file for Cloudflare deployment:

```toml
name = "qcv2"
compatibility_date = "2025-12-10"
workers_dev = false

# REQUIRED: Set your account ID
# account_id = "YOUR_ACCOUNT_ID_HERE"

[assets]
directory = "./dist"
```

**⚠️ Maintainer Action Required:**
1. Find your account ID at https://dash.cloudflare.com
2. Uncomment and fill `account_id` in `wrangler.toml`
3. Set `CF_API_TOKEN` and `CF_ACCOUNT_ID` in GitHub Secrets

### Environment Variables

**Development:**
- `GEMINI_API_KEY` - Google Gemini API key
- `VITE_IMAGE_PROXY_URL` - Worker URL for image proxy

**Production (GitHub Secrets):**
- `CF_API_TOKEN` - Cloudflare API token
- `CF_ACCOUNT_ID` - Cloudflare account ID
- `GEMINI_API_KEY` - Google Gemini API key
- `VITE_IMAGE_PROXY_URL` - Deployed worker URL

## 📝 Adding New Workers

1. Create worker file in `workers/`:
   ```typescript
   // workers/my-worker.ts
   export default {
     async fetch(request: Request) {
       return new Response('Hello from worker!');
     }
   };
   ```

2. Build workers:
   ```bash
   npm run build:workers
   ```

3. Deploy:
   ```bash
   wrangler deploy dist/workers/my-worker.js
   ```

## 📦 Using Shared Types

**In Workers:**
```typescript
import type { MetadataResponse } from '../packages/shared/types';

const response: MetadataResponse = {
  images: ['https://example.com/image.jpg'],
};
```

**In Pages:**
```typescript
import type { MetadataResponse } from '@shared/types';

const data: MetadataResponse = await fetch(...);
```

## 🔍 Troubleshooting

### Build Issues

**"Module not found"**
- Run `npm install` to ensure all dependencies are installed
- Check import paths are correct

**"Cannot find tsconfig"**
- Ensure all `tsconfig.json` files exist
- Check extends paths in `tsconfig.pages.json`

### Deployment Issues

**"Account ID not set"**
- Set `account_id` in `wrangler.toml`
- Or set `CLOUDFLARE_ACCOUNT_ID` environment variable

**"Permission denied"**
- Ensure `CF_API_TOKEN` has correct permissions:
  - Account Settings → Workers Scripts → Edit
  - Account Settings → Cloudflare Pages → Edit

## 📚 Resources

- [Cloudflare Pages Docs](https://developers.cloudflare.com/pages/)
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Wrangler CLI Docs](https://developers.cloudflare.com/workers/wrangler/)
- [Shared Types README](./packages/shared/README.md)

## 🎯 Next Steps for Maintainers

1. ✅ Review this architecture
2. ⬜ Set `account_id` in `wrangler.toml`
3. ⬜ Configure GitHub Secrets
4. ⬜ Test builds locally: `npm run build`
5. ⬜ Test deployment: `wrangler pages deploy dist`
6. ⬜ Update project-specific documentation
7. ⬜ Train team on new structure
