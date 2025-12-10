# Quick Reference: Image Download 502 Fix

## What Changed?

### The Problem
❌ Google Search returns Pinterest/Instagram URLs → 502 errors when downloading

### The Solution
✅ Filter out social media URLs + instruct Gemini to avoid them

## Verification Checklist

### ✅ Code Changes Applied
- [ ] `constants.ts`: `IMAGE_SEARCH` constant added
- [ ] `geminiService.ts`: Domain filtering implemented
- [ ] `AppContext.tsx`: Enhanced error logging
- [ ] Build succeeds
- [ ] Tests pass (if any)

### ✅ Testing in Browser
1. **Run a QC Analysis**
   - Upload product with QC images
   - Trigger QC analysis with issues

2. **Check Console Logs**
   ```
   Expected: [Comparison] ✓ Successfully downloaded close-up image for [Section] from [domain]
   Or: [Comparison] Using fallback reference image for [Section]
   
   NOT: GET https://...pinimg.com... 502 (Bad Gateway)
   ```

3. **Verify Filtering**
   ```
   Expected: Image Search: Filtering out problematic domain: i.pinimg.com
   Expected: Image Search: Found X valid images (filtered from Y total)
   ```

### ✅ Success Metrics

**Good:**
- ≥50% of sections get downloaded reference images
- No 502 errors from Pinterest/Instagram/Facebook
- Detailed error logs when failures occur

**Excellent:**
- ≥70% of sections get downloaded reference images
- Most images from official sources
- QC completes successfully even when images fail

## Quick Debug Commands

### 1. Check if worker is working
```bash
curl https://authentiqc-worker.adwate.workers.dev/
# Should return: {"name":"AuthentiqC Image Proxy Worker","version":"1.4.0",...}
```

### 2. Test image proxy directly
```bash
curl "https://authentiqc-worker.adwate.workers.dev/proxy-image?url=https://example.com/image.jpg"
# Should return image data or JSON error
```

### 3. Monitor console for patterns
```javascript
// In DevTools Console, filter for:
[Comparison]
Image Search:
```

## Common Issues & Fixes

### Issue: Still seeing Pinterest URLs
**Fix:** Check that `IMAGE_SEARCH.PROBLEMATIC_DOMAINS` is imported correctly

### Issue: All URLs getting filtered
**Fix:** Check Gemini prompt includes dynamic domain list

### Issue: Worker returning 502
**Fix:** Check worker is deployed and URL is correct in `VITE_IMAGE_PROXY_URL`

### Issue: No images downloading at all
**Fix:** Check `VITE_IMAGE_PROXY_URL` is set and worker health check passes

## Configuration

### Environment Variables Required
```bash
GEMINI_API_KEY=your-api-key
VITE_IMAGE_PROXY_URL=https://authentiqc-worker.adwate.workers.dev
```

### Constants (in `constants.ts`)
```typescript
IMAGE_SEARCH.PROBLEMATIC_DOMAINS = [
  'pinimg.com', 'pinterest.com',
  'instagram.com', 'cdninstagram.com', 
  'fbcdn.net', 'facebook.com',
  'twitter.com', 'twimg.com',
  'tiktok.com'
]
IMAGE_SEARCH.MAX_URLS = 8
IMAGE_SEARCH.MAX_ERROR_TEXT_LENGTH = 100
```

## Expected Console Output

### Success Case
```
[Comparison] Searching for Dial & Hands close-up images...
Image Search: Found 6 valid images for Dial & Hands (filtered from 8 total)
[Comparison] Attempting to download: https://chrono24.com/image1.jpg
[Comparison] ✓ Successfully downloaded close-up image for Dial & Hands from chrono24.com
```

### Fallback Case
```
[Comparison] Searching for Bezel close-up images...
Image Search: Found 3 valid images for Bezel (filtered from 5 total)
[Comparison] Attempting to download: https://example.com/image1.jpg
[Comparison] ✗ Failed to download https://example.com/image1.jpg: HTTP 502
[Comparison] All 3 image URLs failed for Bezel:
  1. example.com: HTTP 502: Failed to fetch image...
  2. another.com: HTTP 403: Forbidden
  3. third.com: Network error
[Comparison] Using fallback reference image for Bezel
```

## Performance Impact

- **Before:** ~2-6 failed HTTP requests per section (502 errors)
- **After:** ~0-2 failed HTTP requests per section (legitimate failures)
- **Net Effect:** Faster QC completion, fewer wasted requests

## Rollback Instructions

If issues occur:

```bash
git revert HEAD
npm run build
# Deploy reverted version
```

Then investigate logs and re-apply fix after addressing issues.

## Support

- **Documentation:** See `IMAGE_DOWNLOAD_FIX_SUMMARY.md`
- **Testing Guide:** See `IMAGE_DOWNLOAD_TESTING_GUIDE.md`
- **Worker Issues:** Check Cloudflare Dashboard → Workers → authentiqc-worker → Logs
