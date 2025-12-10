# Image Download 502 Error Fix - Summary

## Problem Statement

During the QC process, when the app attempts to download additional reference images for section-specific comparisons, it frequently encounters `502 Bad Gateway` errors from the Cloudflare worker. 

Example error:
```
GET https://authentiqc-worker.adwate.workers.dev/proxy-image?url=https%3A%2F%2Fi.pinimg.com%2Foriginals%2F82%2F38%2F26%2F823826066265787654321.jpg 502 (Bad Gateway)
```

## Root Cause Analysis

### The Flow
1. **QC Analysis Initiated**: User uploads QC images for a product
2. **AI Analysis**: Gemini analyzes the QC images and identifies sections with potential issues
3. **Image Search**: For each problematic section, the app calls `searchSectionSpecificImages()` which:
   - Uses Gemini's Google Search tool to find reference images
   - Searches for: `[brand] [product name] [section name]` (e.g., "Rolex Submariner Dial & Hands")
4. **Image Download**: The app attempts to download found images through the Cloudflare worker proxy
5. **FAILURE**: Many URLs (especially from Pinterest, Instagram, etc.) return 502 errors because:
   - These sites block automated requests
   - They require authentication/cookies
   - They have aggressive rate limiting
   - They detect and block Cloudflare Workers

### Why This Happens
- **Gemini's Google Search** returns whatever URLs Google Images finds, which often includes social media sites
- **Social media sites** (Pinterest, Instagram, Facebook, Twitter) are designed to block automated access
- **Cloudflare Worker** makes HTTP requests that these sites detect and reject
- **No URL filtering** was in place, so all URLs were attempted regardless of source

## Solution Implemented

### 1. Domain Filtering (`geminiService.ts`)

Added a blocklist of problematic domains that are filtered out before attempting downloads:

```typescript
const problematicDomains = [
  'pinimg.com',        // Pinterest - blocks proxy requests with 403/502
  'pinterest.com',
  'instagram.com',
  'fbcdn.net',         // Facebook CDN
  'cdninstagram.com',
  'facebook.com',
  'twitter.com',
  'twimg.com',         // Twitter images
  'tiktok.com'
];
```

**Impact**: Prevents wasted attempts to download from sources that will always fail.

### 2. Improved Gemini Prompts

#### Updated Search Prompt
- Explicitly instructs Gemini to avoid social media sites
- Provides clear priority list of acceptable sources
- Requests 5-8 URLs (up from 3-5) to compensate for filtering

#### Updated System Instruction
```
CRITICAL: Only return image URLs from websites that allow automated access. 
AVOID social media sites (Pinterest, Instagram, Facebook) as they block automated downloads.
Prioritize official brand websites, authorized retailers, and e-commerce sites with accessible image CDNs.
```

**Impact**: Gemini is more likely to return URLs from accessible sources.

### 3. Enhanced Error Logging (`AppContext.tsx`)

Added comprehensive logging for image download attempts:

- **Before**: Silent failures with minimal logging
- **After**: 
  - Log each download attempt with full URL
  - Log success with hostname
  - Track all failures with specific reasons (HTTP status, error messages)
  - Provide summary when all URLs fail

Example output:
```
[Comparison] Attempting to download: https://example.com/image.jpg
[Comparison] ✗ Failed to download https://i.pinimg.com/image.jpg: HTTP 502
[Comparison] ✓ Successfully downloaded close-up image for Dial & Hands from chrono24.com
```

**Impact**: Makes debugging much easier and helps identify patterns in failures.

### 4. Increased URL Limit

Changed from requesting 3-5 images to 5-8 images, then filtering to ensure we still have enough candidates after removing problematic domains.

**Impact**: Better chance of finding at least one downloadable image.

## Expected Results

### Before Fix
- Gemini returns 5 URLs: 3 from Pinterest, 1 from Instagram, 1 from retailer
- All Pinterest and Instagram URLs fail with 502
- Only 1 URL succeeds
- High failure rate (~80%)

### After Fix
- Gemini returns 8 URLs, prioritizing non-social media sources
- Filter removes any Pinterest/Instagram URLs that slip through
- 5-6 URLs from accessible sources remain
- Higher success rate (~70-80%)

## Fallback Behavior

If all downloaded attempts fail, the app gracefully falls back to:
1. Product's uploaded reference images (`product.profile.imageUrls`)
2. Product's manually uploaded reference images (`product.referenceImageIds`)

This ensures QC analysis can still complete even when external image search fails entirely.

## Testing Recommendations

1. **Monitor Console Logs**: Check for patterns in failed URLs
2. **Success Metrics**: Track what percentage of sections get external reference images
3. **Hostname Distribution**: Verify that social media URLs are filtered out
4. **Error Analysis**: If 502 errors persist, identify new problematic domains and add to blocklist

## Future Improvements

1. **Allowlist Approach**: Instead of blocking bad domains, only allow known-good domains
2. **Image CDN Detection**: Detect and prioritize URLs from common CDNs (Cloudinary, Imgix, etc.)
3. **Custom Image Search API**: Implement dedicated image search using Google Custom Search API or similar for better control
4. **Image Caching**: Cache successfully downloaded images to avoid repeated requests
5. **Rate Limiting**: Track success/failure rates per domain and automatically blocklist domains with high failure rates
6. **User Feedback**: Allow users to report when reference images are consistently unavailable

## Related Files

- `pages/src/services/geminiService.ts` - Image search and URL filtering
- `pages/src/context/AppContext.tsx` - Image download logic and error handling
- `workers/image-proxy/index.mjs` - Worker that proxies image requests

## Monitoring

After deployment, monitor:
- Console error logs for `[Comparison] All X image URLs failed`
- Success rate of image downloads per section
- Specific domains that are still causing 502 errors
- User feedback on QC comparison quality
