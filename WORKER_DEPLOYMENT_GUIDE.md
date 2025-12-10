# Worker Deployment & Troubleshooting Guide

This guide addresses the issues identified in the deployment:
1. Worker deployment workflow failure (exit code 1)
2. Gemini API schema error for image assignment
3. 502 Bad Gateway from worker

## Issues Fixed

### 1. Worker Deployment Workflow ✅

**Problem:** The GitHub Actions workflow was trying to cache and install npm dependencies from the root `package-lock.json`, but then deploy from the `workers/image-proxy` directory.

**Solution:** Updated `.github/workflows/deploy-workers.yml` to:
- Remove npm cache configuration (pointing to wrong location)
- Install dependencies in the correct directory (`workers/image-proxy`)

**Changes:**
```yaml
- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: 20

- name: Install Worker Dependencies
  working-directory: workers/image-proxy
  run: |
    if [ -f package-lock.json ]; then
      npm ci
    else
      npm install
    fi
```

### 2. Gemini API Schema Error ✅

**Problem:** The `assignImagesToSections` function had an invalid response schema:
```
GenerateContentRequest.generation_config.response_schema.properties["mapping"].properties: 
should be non-empty for OBJECT type
```

The schema defined `mapping` as `Type.OBJECT` but didn't provide the required `properties` field. In Gemini API, when you define a property as OBJECT type, you must specify what properties it contains.

**Root Cause:** Attempting to use a nested object with dynamic keys (section names) without proper schema definition.

**Solution:** Changed the response schema from a nested object to an array of items:

**Before:**
```typescript
const schema: Schema = {
  type: Type.OBJECT,
  properties: {
    mapping: {
      type: Type.OBJECT,  // ❌ Missing 'properties' field
      description: 'Mapping of section names to arrays of image indices'
    }
  },
  required: ['mapping']
};
```

**After:**
```typescript
const schema: Schema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      sectionName: {
        type: Type.STRING,
        description: 'Name of the section'
      },
      imageIndices: {
        type: Type.ARRAY,
        items: {
          type: Type.NUMBER
        },
        description: 'Array of image indices'
      }
    },
    required: ['sectionName', 'imageIndices']
  }
};
```

**Response Format:**
```json
[
  { "sectionName": "Dial & Hands", "imageIndices": [0, 2] },
  { "sectionName": "Case & Bezel", "imageIndices": [0, 1, 2] },
  { "sectionName": "Bracelet/Strap", "imageIndices": [1, 3] }
]
```

Updated the parsing logic to handle the array format and convert it to the expected object format.

### 3. 502 Bad Gateway from Worker ⏳

**Likely Cause:** The worker wasn't successfully deployed due to the workflow error. Once the workflow is fixed and runs successfully, the 502 error should be resolved.

**Verification Steps:**

1. **Check if worker is deployed:**
   ```bash
   curl https://authentiqc-worker.adwate.workers.dev/
   ```
   
   Expected response:
   ```json
   {
     "name": "AuthentiqC Image Proxy Worker",
     "version": "1.4.0",
     "status": "ok",
     "endpoints": [...]
   }
   ```

2. **Test the proxy-image endpoint:**
   ```bash
   curl -I "https://authentiqc-worker.adwate.workers.dev/proxy-image?url=https://via.placeholder.com/150"
   ```
   
   Should return:
   - `Access-Control-Allow-Origin: *` header
   - `Content-Type: image/...` header
   - `X-Proxy-Status: success` header

3. **Use the test script:**
   ```bash
   cd workers/image-proxy
   ./test-worker.sh
   ```

## Manual Deployment

If the GitHub Actions workflow continues to fail, deploy manually:

```bash
# 1. Navigate to worker directory
cd workers/image-proxy

# 2. Install dependencies
npm install

# 3. Deploy with wrangler
export CLOUDFLARE_API_TOKEN="your-api-token"
export CLOUDFLARE_ACCOUNT_ID="your-account-id"
npx wrangler@4 deploy
```

## Common Issues

### Issue: Worker deployment exits with code 1

**Causes:**
- Missing `CLOUDFLARE_API_TOKEN` secret
- Missing `CLOUDFLARE_ACCOUNT_ID` secret
- Invalid wrangler configuration
- Dependencies not installed

**Fix:**
1. Verify GitHub secrets are set
2. Check wrangler.toml is valid
3. Ensure dependencies are installed before deployment

### Issue: 502 Bad Gateway

**Causes:**
- Worker not deployed
- Runtime error in worker code
- Worker exceeded CPU/memory limits
- Network timeout

**Fix:**
1. Verify worker is deployed (check health endpoint)
2. Check Cloudflare Dashboard logs for errors
3. Test with `wrangler dev` locally to identify runtime errors
4. Check worker metrics in Cloudflare Dashboard

### Issue: CORS errors

**Cause:** Worker might be returning HTML error page instead of JSON with CORS headers

**Fix:**
1. Ensure worker is deployed (not serving Cloudflare's 404 page)
2. Check that all error responses include CORS headers
3. Verify OPTIONS preflight requests are handled

## Testing

### Local Development

```bash
cd workers/image-proxy
npm install
npx wrangler dev
```

Then test endpoints at `http://localhost:8787`

### Dry Run Deployment

Test deployment without actually publishing:

```bash
cd workers/image-proxy
npx wrangler@4 deploy --dry-run
```

Should output:
```
Total Upload: 193.13 KiB / gzip: 37.38 KiB
No bindings found.
--dry-run: exiting now.
```

## Monitoring

### Check Worker Logs

```bash
cd workers/image-proxy
npx wrangler tail
```

This streams real-time logs from the deployed worker.

### Cloudflare Dashboard

1. Go to Cloudflare Dashboard
2. Navigate to Workers & Pages
3. Click on "authentiqc-worker"
4. Check:
   - Deployment status
   - Request metrics
   - Error logs
   - CPU/memory usage

## Next Steps

1. ✅ Push the fixes to trigger GitHub Actions workflow
2. ⏳ Monitor the workflow run to ensure deployment succeeds
3. ⏳ Test the worker endpoints after successful deployment
4. ⏳ Verify image assignment works with new schema
5. ⏳ Test QC report generation end-to-end

## Related Files

- `.github/workflows/deploy-workers.yml` - Deployment workflow
- `workers/image-proxy/index.mjs` - Worker code
- `workers/image-proxy/wrangler.toml` - Worker configuration
- `workers/image-proxy/package.json` - Worker dependencies
- `pages/src/services/geminiService.ts` - Image assignment function
- `workers/image-proxy/test-worker.sh` - Test script
