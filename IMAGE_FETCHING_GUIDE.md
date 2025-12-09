# Image Fetching from Product URLs - Troubleshooting Guide

This guide explains how the image fetching system works and how to troubleshoot common issues.

## How It Works

When you add a product via URL, the system follows this multi-stage approach:

### Stage 1: URL Scraping
1. **Metadata Fetching**: The system calls your Cloudflare Worker's `/fetch-metadata` endpoint
   - Scrapes Open Graph meta tags (`og:image`)
   - Scrapes Twitter Card meta tags (`twitter:image`)
   - Scrapes JSON-LD structured data
   - Scrapes regular `<img>` tags from the HTML
2. **Image Downloading**: Downloads up to 5 images through the `/proxy-image` endpoint
3. **Validation**: Filters out tracking pixels, icons, and small images

### Stage 2: AI Image Search (Fallback)
If URL scraping fails or finds no images:
1. **Google Search**: The AI uses Google Search to find product images
2. **Image URLs**: Returns `imageUrls` array with discovered images
3. **Download**: System downloads these AI-found images through the proxy

### Stage 3: Product Identification
Once images are available (from either stage):
1. **AI Analysis**: Gemini AI analyzes the images to identify the product
2. **Profile Generation**: Creates a ProductProfile with name, brand, features, etc.
3. **Review**: User can review and edit before saving

## Requirements

### 1. Environment Variable
You **must** set `VITE_IMAGE_PROXY_URL` in your `.env.local` file:

```bash
VITE_IMAGE_PROXY_URL=https://your-worker.your-subdomain.workers.dev
```

### 2. Cloudflare Worker
The worker must be deployed and accessible. It provides two endpoints:

#### `/fetch-metadata?url=<product_url>`
- Scrapes images from a product page
- Returns: `{ images: string[] }` or `{ error: string }`
- Handles SSRF protection, CORS, URL validation

#### `/proxy-image?url=<image_url>`
- Proxies image downloads with CORS headers
- Returns: image blob with proper content-type
- Adds User-Agent and Referer headers to avoid blocking

## Common Issues and Solutions

### Issue: "No images found on the product page"

**Causes:**
1. The website doesn't use standard meta tags (og:image, twitter:image)
2. Images are loaded dynamically via JavaScript (after page load)
3. The website blocks automated requests

**Solutions:**
- Check if the URL is a direct product page (not a listing/category page)
- Try different products from the same website
- System will automatically fall back to AI image search

### Issue: "VITE_IMAGE_PROXY_URL not configured"

**Cause:** Environment variable is not set or misspelled

**Solution:**
1. Create or edit `.env.local` in the project root
2. Add: `VITE_IMAGE_PROXY_URL=<your-worker-url>`
3. Restart the dev server (`npm run dev`)

For detailed troubleshooting, see: [TROUBLESHOOTING_WORKER_ERROR.md](TROUBLESHOOTING_WORKER_ERROR.md)

### Issue: "Worker returned non-JSON response"

**Cause:** VITE_IMAGE_PROXY_URL is set but points to a location that returns HTML instead of JSON

**Common reasons:**
1. The Cloudflare Worker is not deployed at the configured URL
2. The URL is incorrect or points to a 404 page
3. The worker exists but is misconfigured

**Solution:**
See the comprehensive guide: [TROUBLESHOOTING_WORKER_ERROR.md](TROUBLESHOOTING_WORKER_ERROR.md)

Quick fixes:
1. Verify worker is deployed: Check Cloudflare Dashboard → Workers & Pages
2. Test the worker directly: `curl "https://your-worker-url.workers.dev/fetch-metadata?url=https://example.com"`
3. Use the diagnostics page: Navigate to `/diagnostics` in the app
4. Check browser console for the exact worker URL being used

### Issue: "Request timed out"

**Causes:**
1. Website is very slow to respond
2. Website is blocking the worker's requests
3. Network issues

**Solutions:**
- Try again (system automatically retries 2 times)
- Try a different product URL
- The system will fall back to AI image search

### Issue: "All images failed to download"

**Causes:**
1. Website requires authentication/cookies
2. Images are hotlink-protected
3. Images URLs are dynamically generated or expire quickly

**Solutions:**
- Check if you can access the image URLs directly in a browser
- System will fall back to AI image search
- Consider using direct image upload instead

### Issue: Worker returns 403 Forbidden

**Causes:**
1. Website detects and blocks the worker
2. SSRF protection triggered (internal/private IPs)

**Solutions:**
- Verify the URL is a public website (not localhost, 192.168.x.x, etc.)
- Try a different website
- System will fall back to AI image search

## Monitoring and Debugging

### Browser Console
Open the browser console (F12) to see detailed logs:
- `[Image Fetch]` - URL scraping logs
- `[Identification]` - AI identification logs

Example logs:
```
[Image Fetch] Attempt 1: Fetching metadata from: https://...
[Image Fetch] Found 8 images on page, fetching up to 5
[Image Fetch] (1/5) Fetching: https://...
[Image Fetch] Image 1 success: https://... (256KB)
[Image Fetch] Successfully fetched 4 out of 5 images
```

### Task Status Messages
The UI shows real-time status in the "Recent Identifications" section:
- "Fetching images from URL..." - Stage 1 in progress
- "AI searching for product images..." - Fallback to Stage 2
- "Downloading 3 AI-discovered images..." - Stage 2 downloading
- "Identified with 4 images" - Success!

### Error Messages
Errors are shown in the task card:
- Hover or click for full error details
- Includes both scraping and identification errors

## Best Practices

### For Reliable Image Fetching
1. **Use Direct Product Pages**: Link directly to the product, not category pages
2. **Prefer Major Retailers**: Amazon, eBay, brand websites usually work well
3. **Check Console Logs**: If issues persist, check browser console for details
4. **Trust the Fallback**: AI image search is very effective as a backup

### For Better Results
1. **Provide Multiple Images**: Upload 2-3 images manually for better AI identification
2. **Use Both**: Combine manual upload + URL for best results
3. **Edit After**: You can always edit product details after identification

## Technical Details

### Retry Logic
- URL scraping: 2 retries with exponential backoff (1s, 2s)
- Timeout: 15s for metadata, 10s per image
- Parallel image downloading for speed

### Image Filtering
Automatically filters out:
- Data URIs
- Tracking pixels (1x1 images)
- Images smaller than 1KB
- Common icon/logo patterns
- Invalid or extremely long URLs

### Prioritization
1. Open Graph images (og:image)
2. Twitter Card images (twitter:image)
3. JSON-LD images
4. Regular img tags

Returns up to 12 images, prioritizing social media meta tags.

## Need Help?

If image fetching still doesn't work after troubleshooting:

1. **Check Requirements**: Verify VITE_IMAGE_PROXY_URL and worker deployment
2. **Test with Known URLs**: Try Amazon or eBay product URLs
3. **Use Manual Upload**: Upload images directly as a workaround
4. **Check Worker Logs**: Look at Cloudflare Worker logs for errors
5. **Browser Console**: Check for JavaScript errors or network failures

The system is designed to be resilient with multiple fallback mechanisms, so most issues will self-resolve through AI image search.
