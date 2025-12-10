# Post-Merge Checklist - Worker Connection Fix

After merging this PR, follow this checklist to ensure everything is working:

## ☐ 1. Verify GitHub Actions Deployment (2-3 minutes)

1. Go to: https://github.com/adwate-ui/QCv2/actions
2. Look for "Deploy Cloudflare Worker" workflow
3. Check that it:
   - ✅ Started automatically after merge
   - ✅ Validation step passed
   - ✅ Worker deployment completed
   - ✅ Health check verification passed

**Expected Output in Logs:**
```
Validating wrangler configurations...
✓ Found root wrangler.jsonc with name: qcv2
✓ Found worker wrangler.toml with name: authentiqc-worker
✓ Names are different - no conflict
✓✓✓ Wrangler configuration validation passed ✓✓✓
```

## ☐ 2. Test Worker Endpoint Directly

Run this in terminal:
```bash
curl https://authentiqc-worker.adwate.workers.dev/
```

**✅ Expected Response (JSON):**
```json
{
  "name": "AuthentiqC Image Proxy Worker",
  "version": "1.2.0",
  "status": "ok",
  "endpoints": [...]
}
```

**❌ If you see HTML:** Worker not deployed correctly. Check GitHub Actions logs.

## ☐ 3. Check Worker Health in UI

1. Open: https://qcv2.pages.dev/
2. Look at the header/navigation area
3. Worker Health Indicator should show:
   - 🟢 Green badge
   - Text: "Worker Online (v1.2.0)"
   - On hover: Shows "Worker is healthy" message

**If red "Worker Offline":**
- Wait 1-2 minutes and refresh
- Click refresh button on indicator
- Check GitHub Actions deployment status

## ☐ 4. Test Image Fetching from URL

1. Navigate to "Add Product" page
2. Enter a product URL (e.g., https://www.amazon.com/dp/B08N5WRWNW)
3. Click "Fetch Images" or equivalent button
4. Images should load successfully
5. No CORS errors in browser console

**If it fails:**
- Check browser console for errors
- Verify worker is online (step 2 & 3)
- Check VITE_IMAGE_PROXY_URL is set in production

## ☐ 5. Verify No CORS Errors

Open browser DevTools (F12) → Console tab
- ✅ Should see: No CORS-related errors
- ✅ Should see: API calls to worker succeeding

**If you see CORS errors:**
```
Access to fetch at 'https://authentiqc-worker.adwate.workers.dev/...' 
has been blocked by CORS policy
```
Then worker is not properly deployed. Check GitHub Actions.

## ☐ 6. Verify Configuration

Run validation locally (if you have repo cloned):
```bash
cd /path/to/QCv2
.github/scripts/validate-wrangler-configs.sh
```

Should output:
```
✓ Found root wrangler.jsonc with name: qcv2
✓ Found worker wrangler.toml with name: authentiqc-worker
✓ Names are different - no conflict
✓✓✓ Wrangler configuration validation passed ✓✓✓
```

## ☐ 7. Optional: Test All Worker Endpoints

Test each endpoint to ensure full functionality:

### Root Endpoint (Health Check)
```bash
curl https://authentiqc-worker.adwate.workers.dev/
# Should return JSON with status "ok"
```

### Fetch Metadata Endpoint
```bash
curl "https://authentiqc-worker.adwate.workers.dev/fetch-metadata?url=https://www.cloudflare.com"
# Should return JSON with array of image URLs
```

### Proxy Image Endpoint
```bash
curl -I "https://authentiqc-worker.adwate.workers.dev/proxy-image?url=https://picsum.photos/200"
# Should return 200 OK with image content-type
```

## Troubleshooting

### Worker Still Offline After 5 Minutes

1. **Check GitHub Actions logs:**
   - Look for errors in "Publish worker" step
   - Look for failures in "Verify worker deployment" step

2. **Check Cloudflare Dashboard:**
   - Go to: https://dash.cloudflare.com
   - Navigate to Workers & Pages
   - Find "authentiqc-worker"
   - Check status and recent logs

3. **Manual Deployment:**
   If automatic deployment failed, deploy manually:
   ```bash
   cd cloudflare-worker
   npx wrangler@4 deploy --config wrangler.toml
   ```

### Validation Fails

If validation fails in CI/CD:
1. Check that `wrangler.jsonc` has `"name": "qcv2"`
2. Check that `cloudflare-worker/wrangler.toml` has `name = "authentiqc-worker"`
3. Make sure names are different
4. Review `PREVENT_WORKER_CONFLICTS.md` for guidance

### UI Shows Wrong Status

If UI shows incorrect worker status:
1. Hard refresh browser (Ctrl+Shift+R or Cmd+Shift+R)
2. Clear browser cache
3. Wait 30 seconds (health check cache timeout)
4. Click refresh button on Worker Health Indicator
5. Check Network tab in DevTools for actual responses

## Success Criteria

✅ **All checks passed when:**
- GitHub Actions deployment succeeded
- Worker endpoint returns JSON (not HTML)
- UI shows green "Worker Online" badge
- Image fetching from URLs works
- No CORS errors in browser console
- Validation script passes

## Additional Resources

- **Technical Details:** `WORKER_NAME_CONFLICT_FIX.md`
- **Verification Guide:** `WORKER_FIX_VERIFICATION.md`
- **Prevention Guide:** `PREVENT_WORKER_CONFLICTS.md`
- **Quick Summary:** `WORKER_FIX_SUMMARY_DEC10.md`

## Timeline

- ⏱️ **Merge to deployment:** ~2-3 minutes
- ⏱️ **Deployment to live:** Instant
- ⏱️ **DNS propagation:** Usually instant (already configured)
- ⏱️ **Total downtime:** 0 (worker deploys over existing)

## Support

If worker remains offline after following all steps:
1. Review GitHub Actions logs for specific errors
2. Check Cloudflare Dashboard worker status
3. Contact Cloudflare support if worker shows errors
4. Open GitHub issue with:
   - GitHub Actions logs
   - Browser console errors
   - curl output from step 2

---

**Remember:** This fix prevents the issue from happening again through automated validation in CI/CD.
