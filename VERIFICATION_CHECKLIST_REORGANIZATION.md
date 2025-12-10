# Verification Checklist

Use this checklist to verify the repository reorganization is working correctly.

## Repository Structure

- [ ] `/pages` directory exists with complete frontend code
- [ ] `/pages/src` contains all React components, services, and pages
- [ ] `/pages/package.json` exists with frontend dependencies
- [ ] `/pages/vite.config.ts` exists
- [ ] `/pages/tsconfig.json` exists
- [ ] `/workers` directory exists
- [ ] `/workers/image-proxy` contains worker code
- [ ] `/workers/image-proxy/wrangler.toml` exists
- [ ] Root `package.json` has workspace configuration

## Build Verification

### Pages Build

```bash
cd pages
npm install
npm run build
```

Expected output:
- [ ] TypeScript compilation succeeds
- [ ] Vite build completes
- [ ] `pages/dist` directory is created
- [ ] `pages/dist/index.html` exists
- [ ] JavaScript bundles are created in `pages/dist/assets/js/`

### Pages Dev Server

```bash
cd pages
npm run dev
```

Expected output:
- [ ] Dev server starts on http://localhost:3000
- [ ] No build errors
- [ ] Can access the application in browser

### Type Checking

```bash
cd pages
npm run typecheck
```

Expected output:
- [ ] No TypeScript errors
- [ ] All imports resolve correctly

## Worker Verification

### Worker Structure

```bash
ls -la workers/image-proxy/
```

Expected files:
- [ ] `index.mjs` - Worker code
- [ ] `wrangler.toml` - Worker configuration
- [ ] `package.json` - Worker dependencies (if any)
- [ ] `README.md` - Worker documentation

### Worker Syntax Check

```bash
cd workers/image-proxy
node --check index.mjs
```

Expected output:
- [ ] No syntax errors

## Cloudflare Configuration

### Pages Settings

In Cloudflare Pages dashboard:
- [ ] Root Directory: `pages`
- [ ] Build Command: `npm run build`
- [ ] Build Output Directory: `dist`
- [ ] Environment Variable: `GEMINI_API_KEY` is set
- [ ] Environment Variable: `VITE_IMAGE_PROXY_URL` is set

### Worker Settings

In Cloudflare Workers dashboard:
- [ ] Worker name: `authentiqc-worker` (or your configured name)
- [ ] Worker is deployed and active
- [ ] Worker URL is accessible

## GitHub Actions

### CI Workflow

Check `.github/workflows/ci.yml`:
- [ ] Workflow exists
- [ ] Uses `pages` working directory for pages build
- [ ] Uses `workers/image-proxy` for worker verification
- [ ] Installs dependencies for both pages and workers

### Deployment Workflows

Check deployment workflows:
- [ ] `deploy-pages.yml` exists
- [ ] `deploy-workers.yml` exists
- [ ] Pages workflow uses `pages` as root directory
- [ ] Workers workflow uses `workers/image-proxy` as working directory

## Import Paths

Verify import paths in source files:

```bash
# Check that types are imported correctly
cd pages
grep -r "from.*types" src/ | head -5
```

Expected output:
- [ ] Imports use `../types` from services
- [ ] Imports use `./types` from components in same directory
- [ ] No imports reference paths outside of pages directory

## Runtime Verification

### Development Mode

```bash
cd pages
npm run dev
```

In browser at http://localhost:3000:
- [ ] Application loads without errors
- [ ] Console shows no errors
- [ ] Network tab shows resources loading correctly
- [ ] Can navigate between pages

### Production Build

```bash
cd pages
npm run build
npm run preview
```

In browser at the preview URL:
- [ ] Application loads
- [ ] All features work
- [ ] Assets load correctly
- [ ] No console errors

## Deployment Verification

### Pages Deployment

After deploying to Cloudflare Pages:
- [ ] Deployment succeeds
- [ ] Site is accessible at production URL
- [ ] All pages load correctly
- [ ] Assets load correctly
- [ ] Environment variables are working

### Worker Deployment

After deploying worker:
- [ ] Worker deploys successfully
- [ ] Worker URL responds to requests
- [ ] Image proxy functionality works
- [ ] CORS headers are present

## File Permissions

```bash
# Check that deploy scripts are executable
ls -la workers/deploy-all.sh
ls -la workers/image-proxy/deploy.sh
```

Expected:
- [ ] Deploy scripts have execute permissions (`-rwxr-xr-x`)

## Documentation

- [ ] Root `README.md` updated with new structure
- [ ] `/pages/README.md` exists with frontend documentation
- [ ] `/workers/README.md` exists with worker documentation
- [ ] `MIGRATION_GUIDE.md` exists

## Cleanup

- [ ] No old build artifacts in root directory
- [ ] `.backup_old_structure` directory can be removed (after verification)
- [ ] No duplicate files between old and new structure

## Common Issues

### Issue: TypeScript can't find modules

**Solution:**
```bash
cd pages
rm -rf node_modules package-lock.json
npm install
```

### Issue: Build fails with "Cannot find module"

**Solution:**
Check that all imports use correct relative paths for the new structure.

### Issue: Cloudflare Pages build fails

**Solution:**
Verify that Root Directory is set to `pages` in Cloudflare Pages settings.

### Issue: Worker deployment fails

**Solution:**
```bash
cd workers/image-proxy
npx wrangler@4 deploy
```

Make sure you're in the worker directory before deploying.

## Success Criteria

All checks should pass:
- ✅ Pages build succeeds
- ✅ Pages dev server runs
- ✅ Type checking passes
- ✅ Worker structure is correct
- ✅ GitHub Actions workflows are updated
- ✅ Documentation is complete
- ✅ Application runs in development
- ✅ Application builds for production

## Next Steps

Once all verifications pass:

1. Remove `.backup_old_structure` directory:
   ```bash
   rm -rf .backup_old_structure
   ```

2. Commit and push any remaining changes

3. Update Cloudflare configuration if needed

4. Test deployment to staging/production

5. Monitor deployment for any issues

## Need Help?

If any checks fail:
1. Review the `MIGRATION_GUIDE.md`
2. Check the relevant README files
3. Review GitHub Actions logs
4. Open an issue on GitHub with details of the failure
