# Migration Guide: Repository Reorganization

This document explains the repository reorganization and provides migration instructions.

## What Changed

The repository has been reorganized from a mixed structure to a monorepo with complete separation between frontend (pages) and backend (workers).

### Before (Old Structure)

```
/
├── pages/              # Only page components
├── components/         # React components
├── context/           # React context
├── services/          # Frontend services
├── src/               # Additional source files
├── cloudflare-worker/ # Image proxy worker
├── workers/           # Build output directory
├── App.tsx            # Root level files
├── vite.config.ts
├── index.html
└── package.json       # Single package.json
```

### After (New Structure)

```
/
├── pages/              # Complete frontend application
│   ├── src/
│   │   ├── components/  # All React components
│   │   ├── context/     # React context
│   │   ├── services/    # Frontend services
│   │   ├── pages/       # Page components
│   │   ├── App.tsx      # Main app
│   │   ├── main.tsx     # Entry point
│   │   └── types.ts     # Type definitions
│   ├── public/         # Static assets
│   ├── package.json    # Frontend dependencies
│   └── vite.config.ts  # Vite config
│
├── workers/           # Backend workers
│   └── image-proxy/   # Image proxy worker
│       ├── index.mjs
│       ├── wrangler.toml
│       └── package.json
│
└── package.json       # Root workspace manager
```

## Migration Steps

### For Local Development

1. **Pull the latest changes:**
   ```bash
   git pull origin main
   ```

2. **Clean old dependencies:**
   ```bash
   rm -rf node_modules package-lock.json
   rm -rf pages/node_modules pages/package-lock.json
   rm -rf workers/image-proxy/node_modules workers/image-proxy/package-lock.json
   ```

3. **Install new dependencies:**
   ```bash
   # Install from root (installs all workspaces)
   npm install
   
   # Or install individually
   cd pages && npm install
   cd ../workers/image-proxy && npm install
   ```

4. **Development:**
   ```bash
   # From root
   npm run dev
   
   # Or from pages directory
   cd pages && npm run dev
   ```

5. **Building:**
   ```bash
   # From root (builds pages)
   npm run build:pages
   
   # Or from pages directory
   cd pages && npm run build
   ```

### For Cloudflare Pages Deployment

Update your Cloudflare Pages project settings:

1. **Root Directory:** Change from `.` to `pages`
2. **Build Command:** Keep as `npm run build`
3. **Build Output Directory:** Keep as `dist`
4. **Environment Variables:** 
   - Keep `GEMINI_API_KEY`
   - Keep `VITE_IMAGE_PROXY_URL`

**Important:** The build will now run from the `pages/` directory, so relative paths are different.

### For Cloudflare Workers Deployment

Workers are now in their own independent directory:

1. **Location:** `workers/image-proxy/`
2. **Deploy Command:** 
   ```bash
   cd workers/image-proxy
   npx wrangler@4 deploy
   ```

**GitHub Actions:** The deployment workflow has been updated to use the new paths automatically.

### For CI/CD

The GitHub Actions workflows have been updated:

- **ci.yml** - Builds and tests the new structure
- **deploy-pages.yml** - Deploys frontend from `pages/` directory
- **deploy-workers.yml** - Deploys workers from `workers/` directory

No manual changes needed for GitHub Actions.

## What to Update in Your Code

### Import Paths

If you were using custom imports or references:

**Before:**
```typescript
import { Product } from '../types';
import { someService } from '../services/someService';
```

**After (from within src/):**
```typescript
import { Product } from '../types';  // types.ts is now in src/
import { someService } from '../services/someService';  // Still works
```

### File Locations

| Old Location | New Location |
|-------------|--------------|
| `/components/` | `/pages/src/components/` |
| `/context/` | `/pages/src/context/` |
| `/services/` | `/pages/src/services/` |
| `/pages/` | `/pages/src/pages/` |
| `/src/` | `/pages/src/` |
| `/App.tsx` | `/pages/src/App.tsx` |
| `/index.html` | `/pages/index.html` |
| `/vite.config.ts` | `/pages/vite.config.ts` |
| `/types.ts` | `/pages/src/types.ts` |
| `/cloudflare-worker/` | `/workers/image-proxy/` |

## Troubleshooting

### Build Fails

If the build fails after migration:

1. **Clear node_modules:**
   ```bash
   rm -rf node_modules pages/node_modules workers/image-proxy/node_modules
   npm install
   ```

2. **Check working directory:**
   ```bash
   cd pages
   npm run build
   ```

3. **Verify TypeScript:**
   ```bash
   cd pages
   npm run typecheck
   ```

### Worker Deployment Fails

1. **Check you're in the right directory:**
   ```bash
   cd workers/image-proxy
   npx wrangler@4 deploy
   ```

2. **Verify wrangler.toml exists:**
   ```bash
   ls -la workers/image-proxy/wrangler.toml
   ```

### Cloudflare Pages Build Fails

Make sure the **Root Directory** is set to `pages` in Cloudflare Pages settings.

## Benefits of New Structure

1. **Clear Separation:** Frontend and backend are completely independent
2. **Independent Deployments:** Deploy pages and workers separately
3. **Better Organization:** All related files are grouped together
4. **Workspace Support:** npm workspaces for better dependency management
5. **Cloudflare-Ready:** Each deployment target has its own clear root directory

## Getting Help

If you encounter issues after migration:

1. Check this migration guide
2. Review the updated README.md
3. Check `/pages/README.md` for frontend docs
4. Check `/workers/README.md` for worker docs
5. Open an issue on GitHub

## Rollback (If Needed)

If you need to rollback temporarily:

```bash
# Checkout the old structure
git checkout <previous-commit-hash>

# Or create a branch from before migration
git checkout -b pre-migration <commit-before-reorganization>
```

However, we recommend moving forward with the new structure as it provides better organization and deployment flexibility.
