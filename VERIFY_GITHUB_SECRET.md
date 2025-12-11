# How to Verify VITE_IMAGE_PROXY_URL GitHub Secret

## Quick Check

After merging this PR, if the error still appears, follow these steps to verify the GitHub secret is correctly configured:

## Step 1: Navigate to Repository Settings

1. Go to your repository: https://github.com/adwate-ui/QCv2
2. Click **Settings** (top menu bar)
3. In the left sidebar, expand **Secrets and variables**
4. Click **Actions**

## Step 2: Verify the Secret Exists

You should see a section called **Repository secrets**. Look for:

```
Name: VITE_IMAGE_PROXY_URL
Updated: [some date]
```

### If the Secret is Missing

Click **New repository secret** and add:
- **Name**: `VITE_IMAGE_PROXY_URL`
- **Secret**: Your Cloudflare Worker URL (see format below)
- Click **Add secret**

### If the Secret Exists

You cannot view the value directly (GitHub hides it for security), but you can:
1. Click **Update** next to VITE_IMAGE_PROXY_URL
2. Enter the value again to verify it's correct
3. Click **Update secret**

## Step 3: Verify the Secret Value Format

The secret value should be your Cloudflare Worker URL in this exact format:

### ✅ CORRECT FORMAT
```
https://your-worker-name.your-subdomain.workers.dev
```

Examples:
- `https://image-proxy.my-account.workers.dev`
- `https://authentiqc-worker.john.workers.dev`
- `https://qcv2-worker.company.workers.dev`

### ❌ WRONG FORMAT

Do NOT include any path after the domain:
- ❌ `https://your-worker.workers.dev/`
- ❌ `https://your-worker.workers.dev/fetch-metadata`
- ❌ `https://your-worker.workers.dev/proxy-image`

Do NOT use localhost or development URLs:
- ❌ `http://localhost:8787`
- ❌ `http://127.0.0.1:8787`

## Step 4: Find Your Worker URL

If you don't know your worker URL, you can find it by:

### Option A: Check Cloudflare Dashboard
1. Log in to https://dash.cloudflare.com
2. Go to **Workers & Pages**
3. Find your image proxy worker
4. The URL is shown on the worker details page

### Option B: Deploy the Worker
```bash
cd workers/image-proxy
npx wrangler@4 deploy index.mjs
```

After deployment, Wrangler will output:
```
Published image-proxy (1.23 sec)
  https://image-proxy.your-account.workers.dev
```

Copy the URL from the output (without the path).

### Option C: Check wrangler.toml
```bash
cat workers/image-proxy/wrangler.toml
```

Look for the `name` field:
```toml
name = "your-worker-name"
```

Your URL will be: `https://your-worker-name.your-account.workers.dev`

Replace `your-account` with your Cloudflare account subdomain.

## Step 5: Test the Worker URL

Before saving it as a secret, verify the worker is working:

1. Open the URL in your browser: `https://your-worker.workers.dev`
2. You should see a JSON response like:
   ```json
   {
     "message": "Image Proxy Worker",
     "endpoints": [...],
     "version": "2.0.0"
   }
   ```

3. If you see HTML or a 404 error, the worker is not deployed correctly.

## Step 6: Update the Secret

If you found that the secret was wrong or missing:

1. Update/add the secret in GitHub (Settings → Secrets → Actions)
2. Wait for the change to be saved (GitHub will show a success message)
3. Re-run the latest deployment:
   - Go to **Actions** tab
   - Find the latest "Deploy Pages to Cloudflare" workflow
   - Click **Re-run all jobs**

## Step 7: Verify the Fix

After the deployment completes:

1. Visit your production site
2. Open browser console (F12 → Console)
3. You should NOT see: `[WorkerHealth] VITE_IMAGE_PROXY_URL not configured`
4. Try identifying a product from a URL - it should work

## Common Issues

### Issue: "Secret is set but error still appears"

**Possible causes:**
1. The secret value has extra whitespace (spaces, newlines)
   - Solution: Update the secret, carefully copy just the URL
   
2. The secret includes a path (e.g., `/fetch-metadata`)
   - Solution: Remove everything after `.workers.dev`
   
3. Cloudflare Pages cache
   - Solution: Clear cache by re-running the deployment

### Issue: "Worker URL returns 404"

**Possible causes:**
1. Worker not deployed
   - Solution: Run `cd workers/image-proxy && npx wrangler@4 deploy index.mjs`
   
2. Wrong worker name
   - Solution: Check the actual worker name in Cloudflare dashboard

3. Wrong Cloudflare account subdomain
   - Solution: Check your account subdomain in Cloudflare dashboard

### Issue: "Still getting CORS errors"

This is a different issue from the VITE_IMAGE_PROXY_URL configuration error.

**Possible causes:**
1. Worker is deployed but has CORS issues
   - Solution: Check worker logs in Cloudflare dashboard
   
2. Worker is behind a firewall or blocked
   - Solution: Test the worker URL from different networks

## Need More Help?

See `FIX_SUMMARY_VITE_IMAGE_PROXY_URL.md` for:
- Complete technical explanation
- Additional troubleshooting steps
- How Vite handles environment variables
- Related files and configurations

## Quick Reference Card

```
┌─────────────────────────────────────────────────────────┐
│ GitHub Secret Configuration                             │
├─────────────────────────────────────────────────────────┤
│ Location:  Settings → Secrets → Actions                │
│ Name:      VITE_IMAGE_PROXY_URL                         │
│ Format:    https://worker-name.account.workers.dev      │
│                                                          │
│ ✅ DO include: Protocol (https://)                      │
│ ✅ DO include: Worker name and domain                   │
│ ❌ DON'T include: Trailing slash                        │
│ ❌ DON'T include: Endpoint paths                        │
│ ❌ DON'T include: Query parameters                      │
└─────────────────────────────────────────────────────────┘
```
