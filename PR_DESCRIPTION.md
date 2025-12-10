# Separate Cloudflare Pages and Workers roots and add build + CI

## Summary

This PR implements a clear separation between Cloudflare Pages (static frontend) and Cloudflare Workers (server-side functions) with distinct source roots, build scripts, and CI workflow.

### Key Changes

#### 1. New Directory Structure ✅

- **`workers/`** - Worker entry points (one file per worker)
  - `sample-worker.ts` - Example TypeScript worker
  - `image-proxy-worker.mjs` - Existing image proxy worker (nodejs_compat)

- **`packages/shared/`** - Shared types and utilities
  - `types.ts` - Shared TypeScript type definitions
  - `README.md` - Usage documentation
  - `tsconfig.json` - TypeScript configuration

- **`public/samples/`** - Sample static pages
  - `sample.html` - Example static page demonstrating Pages deployment

#### 2. Build System ✅

**ESBuild-based build scripts:**

- **`build-workers.mjs`** - Builds workers to `dist/workers/`
  - Bundles `.ts` files with ESBuild (minified)
  - Copies `.mjs` files as-is (for nodejs_compat workers)

- **`build-pages.mjs`** - Builds frontend to `dist/`
  - Uses Vite to compile React app
  - Outputs optimized static assets

**NPM Scripts:**
```bash
npm run build:pages    # Build frontend
npm run build:workers  # Build workers
npm run build          # Build both
npm run typecheck      # Type-check all projects
```

**Build Outputs:**
- `dist/` - Static frontend (HTML, CSS, JS)
- `dist/workers/` - Bundled workers ready to deploy

#### 3. TypeScript Configuration ✅

Independent type-checking for each project:

- **`tsconfig.base.json`** - Shared base configuration
- **`tsconfig.pages.json`** - Frontend (React + DOM types)
- **`workers/tsconfig.json`** - Workers (Cloudflare Workers types)
- **`packages/shared/tsconfig.json`** - Shared code (strict typing)

All projects can import shared types from `packages/shared/types.ts`.

#### 4. CI/CD Workflow ✅

**New: `.github/workflows/ci.yml`**

Runs on every push and pull request:
1. Install dependencies
2. Type-check all projects (pages, workers, shared)
3. Build workers → `dist/workers/`
4. Build pages → `dist/`
5. Verify build outputs exist

This ensures code quality and build integrity before merging.

#### 5. Updated Configuration ✅

**`wrangler.toml`** - Updated with comprehensive guidance:
- Placeholder for `account_id` (maintainer must fill)
- Documentation for Pages + Workers separation
- Deployment instructions
- Links to CI workflows

**`package.json`** - Updated scripts and dependencies:
- Added `esbuild` for worker bundling
- Added `@cloudflare/workers-types` for worker types
- Updated build and typecheck scripts

#### 6. Documentation ✅

**New Files:**
- **`ARCHITECTURE.md`** - Comprehensive architecture guide
  - Directory structure explanation
  - Build system documentation
  - Deployment instructions
  - Troubleshooting guide
  
- **`packages/shared/README.md`** - Shared types usage guide
  - Purpose and benefits
  - Usage examples for pages and workers
  - Best practices

### Testing ✅

All builds tested and verified:

```bash
# Type-checking passes
npm run typecheck
✅ Pages type-check passed
✅ Workers type-check passed  
✅ Shared type-check passed

# Builds succeed
npm run build
✅ Pages built to dist/
✅ Workers built to dist/workers/

# Output structure verified
dist/
├── index.html
├── assets/
│   └── js/
└── workers/
    ├── sample-worker.js
    └── image-proxy-worker.mjs
```

## Breaking Changes

⚠️ **None** - This PR is additive and doesn't modify existing deployment workflows.

The existing deployment workflows (`.github/workflows/deploy.yml` and `.github/workflows/deploy-worker.yml`) continue to work as before.

## Next Steps for Maintainers

### Required Configuration

1. **Set Cloudflare Account ID** in `wrangler.toml`:
   ```toml
   account_id = "YOUR_ACCOUNT_ID_HERE"
   ```
   
   Find your account ID:
   - Visit https://dash.cloudflare.com
   - Select your account
   - Copy Account ID from URL or sidebar

2. **Verify GitHub Secrets** are set:
   - `CF_API_TOKEN` - Cloudflare API token with Workers + Pages permissions
   - `CF_ACCOUNT_ID` - Your Cloudflare account ID
   - `GEMINI_API_KEY` - Google Gemini API key
   - `VITE_IMAGE_PROXY_URL` - Deployed worker URL

### Testing Deployment

1. **Test Pages Build:**
   ```bash
   npm run build:pages
   # Verify dist/ directory contents
   ```

2. **Test Workers Build:**
   ```bash
   npm run build:workers
   # Verify dist/workers/ directory contents
   ```

3. **Test CI Workflow:**
   - Push to a test branch
   - Verify CI workflow passes on GitHub Actions

4. **Test Deployment (Optional):**
   ```bash
   # Deploy Pages
   wrangler pages deploy dist --project-name=qcv2
   
   # Deploy Workers
   cd dist/workers
   wrangler deploy sample-worker.js
   ```

### Migration Notes

- **Existing code unchanged** - Frontend source files remain in their current locations
- **New structure is additive** - `workers/` and `packages/shared/` are new directories
- **Builds are backwards compatible** - `npm run build` still builds the frontend
- **CI is non-breaking** - Existing deployment workflows continue to function

### Benefits

✅ **Clear separation** - Pages and Workers have distinct source directories  
✅ **Type safety** - Shared types ensure consistency across frontend/backend  
✅ **Independent builds** - Build pages or workers separately as needed  
✅ **CI validation** - Automated type-checking and build verification  
✅ **Better organization** - Logical structure scales with project growth  
✅ **Developer experience** - Clear documentation and examples provided  

## Files Changed

### Added
- `.github/workflows/ci.yml` - CI workflow
- `build-pages.mjs` - Pages build script
- `build-workers.mjs` - Workers build script
- `workers/sample-worker.ts` - Example worker
- `workers/image-proxy-worker.mjs` - Copied from cloudflare-worker/
- `workers/tsconfig.json` - Workers TypeScript config
- `packages/shared/types.ts` - Shared type definitions
- `packages/shared/tsconfig.json` - Shared TypeScript config
- `packages/shared/README.md` - Shared types documentation
- `public/samples/sample.html` - Sample static page
- `tsconfig.base.json` - Base TypeScript config
- `tsconfig.pages.json` - Pages TypeScript config
- `ARCHITECTURE.md` - Architecture documentation

### Modified
- `package.json` - Added scripts and dependencies
- `wrangler.toml` - Updated configuration with guidance
- `.gitignore` - Added `*.tsbuildinfo`

### Preserved
- All existing source files unchanged
- Existing deployment workflows unchanged
- Existing `cloudflare-worker/` directory preserved

## Questions?

See:
- `ARCHITECTURE.md` for detailed architecture documentation
- `packages/shared/README.md` for shared types usage
- `.github/workflows/ci.yml` for CI workflow details

## Checklist

- [x] Directory structure created
- [x] Build scripts implemented and tested
- [x] TypeScript configs for all projects
- [x] CI workflow added
- [x] Sample worker and page provided
- [x] Documentation written
- [x] All builds passing
- [x] Type-checking passing
- [x] No breaking changes to existing code
