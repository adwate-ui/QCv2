# Troubleshooting: "Worker returned non-JSON response" Error

## The Error

If you see this error in your browser console:

```
[Image Fetch] Worker returned non-JSON response (Content-Type: text/html; charset=utf-8).
```

This means the application is trying to fetch images from a product URL, but the Cloudflare Worker is not responding correctly.

## Root Causes

### 1. VITE_IMAGE_PROXY_URL is Not Set

**Symptom**: The error mentions that the worker URL is not configured.

**Solution**: Set the environment variable.

For **local development**:
```bash
# 1. Copy the example file
cp .env.example .env.local

# 2. Edit .env.local and set your worker URL
VITE_IMAGE_PROXY_URL=https://your-worker-url.workers.dev

# 3. Restart the dev server
npm run dev
```

For **production (Cloudflare Pages)**:
1. Go to your GitHub repository
2. Navigate to: **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Name: `VITE_IMAGE_PROXY_URL`
5. Value: Your Cloudflare Worker URL (e.g., `https://authentiqc-worker.your-subdomain.workers.dev`)
6. Trigger a new deployment (push to main or manually trigger the workflow)

### 2. Worker is Not Deployed

**Symptom**: VITE_IMAGE_PROXY_URL is set, but requests return HTML (404 page) instead of JSON.

**Solution**: Deploy the Cloudflare Worker.

```bash
# Navigate to the worker directory
cd cloudflare-worker

# Deploy the worker
npx wrangler@4 deploy index.mjs --name authentiqc-worker

# Copy the worker URL that's printed
# Example: https://authentiqc-worker.your-subdomain.workers.dev
```

Then update your `VITE_IMAGE_PROXY_URL` with this URL.

### 3. Incorrect Worker URL

**Symptom**: The worker is deployed, but the URL in VITE_IMAGE_PROXY_URL is wrong.

**Common mistakes**:
- Using the Cloudflare Pages URL instead of the Worker URL
- Typos in the URL
- Including extra path segments (e.g., `/fetch-metadata` at the end)

**Solution**: Verify the worker URL.

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Click **Workers & Pages**
3. Find **authentiqc-worker** in the list
4. Copy the exact URL shown (it should look like: `https://authentiqc-worker.your-subdomain.workers.dev`)
5. Update `VITE_IMAGE_PROXY_URL` with this URL (no trailing path)

### 4. Worker URL Format is Invalid

**Symptom**: Error message says "Invalid VITE_IMAGE_PROXY_URL format".

**Solution**: Ensure the URL is properly formatted.

Valid examples:
- `https://authentiqc-worker.your-subdomain.workers.dev`
- `https://your-worker.workers.dev`

Invalid examples:
- `authentiqc-worker.your-subdomain.workers.dev` (missing `https://`)
- `https://authentiqc-worker.your-subdomain.workers.dev/fetch-metadata` (should not include path)
- `http://localhost:8787` (for local worker testing, but won't work in production)

## Quick Verification Steps

### Step 1: Check if VITE_IMAGE_PROXY_URL is Set

**Local development**:
```bash
# Start dev server
npm run dev

# Open browser console (F12)
# Type:
import.meta.env.VITE_IMAGE_PROXY_URL

# Should show your worker URL, not undefined
```

**Production**:
```bash
# Open your deployed app
# Open browser console (F12)
# Type:
import.meta.env.VITE_IMAGE_PROXY_URL

# Should show your worker URL, not undefined
```

If it shows `undefined`, the environment variable is not set correctly.

### Step 2: Test Worker Directly

```bash
# Replace YOUR_WORKER_URL with your actual worker URL
curl "YOUR_WORKER_URL/fetch-metadata?url=https://example.com"

# Expected response (JSON):
# {"images": ["https://example.com/image.jpg", ...]}

# Bad response (HTML):
# <!DOCTYPE html>...
```

If you get HTML, the worker is not deployed at that URL.

### Step 3: Use the Diagnostics Page

The app includes a built-in diagnostics page:

1. Open the app
2. Navigate to: `/diagnostics`
3. Enter a test product URL
4. Click "Run Diagnostics"
5. Review the detailed error messages

## Production Deployment Checklist

Before deploying to production, ensure:

- [ ] Cloudflare Worker is deployed
- [ ] You have the correct worker URL (from Cloudflare Dashboard)
- [ ] GitHub secret `VITE_IMAGE_PROXY_URL` is set with the worker URL
- [ ] You've triggered a new deployment after setting the secret
- [ ] You can verify `import.meta.env.VITE_IMAGE_PROXY_URL` in browser console (not undefined)
- [ ] Testing the worker URL directly returns JSON (not HTML)

## Additional Help

- **Deployment Guide**: [CLOUDFLARE_DEPLOYMENT_GUIDE.md](CLOUDFLARE_DEPLOYMENT_GUIDE.md)
- **Image Fetching Guide**: [IMAGE_FETCHING_GUIDE.md](IMAGE_FETCHING_GUIDE.md)
- **Quick Fix**: [QUICK_FIX.md](QUICK_FIX.md)
- **Setup Checker**: Run `./cloudflare-setup-checker.sh`

## Still Having Issues?

If you've followed all steps and still see the error:

1. Check the browser console for the exact error message
2. Note which worker URL is being used (logged in console)
3. Test the worker URL directly with curl
4. Review the Cloudflare Worker logs in the dashboard
5. Ensure the worker code matches the files in `cloudflare-worker/`

The error messages have been enhanced to provide specific guidance based on the type of error encountered.
