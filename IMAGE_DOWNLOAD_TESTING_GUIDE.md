# Testing Guide: Image Download 502 Fix

## Overview
This guide explains how to test the fixes for image download 502 errors during QC analysis.

## Pre-Deployment Testing

### 1. Console Log Monitoring

**What to Check:**
- Open browser DevTools Console
- Run a QC analysis with section-specific issues
- Look for the following log patterns:

**Expected Success Pattern:**
```
[Comparison] Searching for Dial & Hands close-up images...
[Comparison] Attempting to download: https://example.com/image1.jpg
[Comparison] ✓ Successfully downloaded close-up image for Dial & Hands from example.com
```

**Expected Filtering Pattern:**
```
Image Search: Filtering out problematic domain: i.pinimg.com
Image Search: Found 5 valid images for Dial & Hands (filtered from 8 total)
```

**Expected Failure Pattern (with fallback):**
```
[Comparison] Attempting to download: https://example.com/image1.jpg
[Comparison] ✗ Failed to download https://example.com/image1.jpg: HTTP 502
[Comparison] All 3 image URLs failed for Dial & Hands:
  1. example.com: HTTP 502: Failed to fetch image from example.com...
  2. another.com: HTTP 403: Forbidden
  3. third.com: Network error
[Comparison] Using fallback reference image for Dial & Hands
```

### 2. Domain Filtering Verification

**Steps:**
1. Add console.log in `geminiService.ts` before filtering:
   ```typescript
   console.log('URLs before filtering:', matches);
   ```
2. Run QC analysis
3. Check that Pinterest/Instagram URLs are NOT in the filtered list
4. Verify that legitimate URLs (brand sites, retailers) ARE included

**Expected Results:**
- No URLs from: `pinimg.com`, `pinterest.com`, `instagram.com`, `fbcdn.net`, `twitter.com`, `tiktok.com`
- URLs from: Official brand sites, Chrono24, TheRealReal, authorized retailers

### 3. Gemini Prompt Effectiveness

**Manual Verification:**
1. Check the generated search prompt includes dynamic domain list:
   ```
   IMPORTANT: Avoid social media sites (pinterest, instagram, facebook, twitter, tiktok)
   ```
2. Verify the prompt prioritizes:
   - Official brand websites
   - Authorized retailers
   - E-commerce sites

**Testing:**
- Run searches for different product types (watches, bags, jewelry)
- Compare URL sources before and after fix
- Track percentage of social media URLs (should be minimal)

### 4. Error Handling Tests

**Test Cases:**

#### A. Invalid URLs
```javascript
// Manually inject invalid URL in failedUrls
failedUrls.push({ url: 'not-a-url', reason: 'Test' });
// Should NOT crash when trying to parse hostname
```

#### B. Large Error Responses
```javascript
// Mock a large error response
const largeError = 'x'.repeat(1000);
// Should truncate to 100 chars + '...'
```

#### C. Non-JSON Error Response
```javascript
// Mock HTML error page
response.headers.get('content-type') = 'text/html';
// Should fall back to statusText
```

### 5. Performance Testing

**Metrics to Track:**
- Time to complete QC analysis (should be similar or faster)
- Number of HTTP requests made
- Success rate of image downloads

**Baseline (Before Fix):**
- Average: 8 URLs returned, 2-3 succeed, 5-6 fail
- Success Rate: ~25-37%

**Expected (After Fix):**
- Average: 8 URLs returned, 5-6 filtered, 3-4 attempted, 2-3 succeed
- Success Rate: ~50-75%

## Post-Deployment Monitoring

### 1. Browser Console Logs

**Filter for Errors:**
```javascript
// In DevTools Console
console.log = console.log; // Keep normal logs
// Filter for [Comparison] logs
```

**What to Monitor:**
- Frequency of "All X image URLs failed" messages
- Most common failure reasons (HTTP status codes)
- Most common problematic domains

### 2. Success Metrics

**Track These Numbers:**
```
Total QC Analyses: X
Sections with External Images Found: Y
Sections with Images Successfully Downloaded: Z
Success Rate: Z/Y * 100%
```

**Target Success Rate:** 60-80%

### 3. Error Patterns

**Watch for:**
- New problematic domains (add to `IMAGE_SEARCH.PROBLEMATIC_DOMAINS`)
- Consistent failures from specific sites
- Timeout errors (may need to increase timeout)
- 403/429 errors (rate limiting)

## Manual Testing Scenarios

### Scenario 1: Luxury Watch QC
```
Product: Rolex Submariner
Sections with Issues: "Dial & Hands", "Bezel", "Crown"
Expected: Find high-quality close-ups from Chrono24, official retailers
```

**Test Steps:**
1. Upload QC images showing detail issues in these sections
2. Run QC analysis
3. Check console for image search results
4. Verify comparison images are generated
5. Confirm no Pinterest/Instagram URLs attempted

### Scenario 2: Designer Bag QC
```
Product: Louis Vuitton Neverfull
Sections with Issues: "Hardware & Zippers", "Stitching"
Expected: Find detail images from luxury resale sites
```

**Test Steps:**
1. Upload QC images with hardware/stitching close-ups
2. Run QC analysis
3. Verify section-specific images are found
4. Check fallback works if all URLs fail

### Scenario 3: Jewelry QC
```
Product: Cartier Love Bracelet
Sections with Issues: "Clasp/Closure", "Engravings"
Expected: Find official product shots and authentication guides
```

**Test Steps:**
1. Upload QC images of clasp and engravings
2. Run QC analysis  
3. Monitor success rate of downloads
4. Verify quality of comparison images

## Debugging Failed Downloads

### Step 1: Check Console Logs
Look for detailed failure information:
```
[Comparison] ✗ Failed to download https://example.com/image.jpg: HTTP 502
```

### Step 2: Test URL Manually
Try fetching the URL directly through the worker:
```
https://authentiqc-worker.adwate.workers.dev/proxy-image?url=<encoded-url>
```

### Step 3: Check Worker Logs
In Cloudflare Dashboard:
1. Go to Workers & Pages
2. Select authentiqc-worker
3. View Logs (Real-time logs)
4. Look for fetch failures

### Step 4: Analyze Patterns
- Same domain failing repeatedly? Add to blocklist
- Specific HTTP status? May need special handling
- Timeout errors? Increase timeout or add retry

## Success Criteria

✅ **Must Have:**
- Build succeeds without errors
- No TypeScript compilation errors
- No CodeQL security alerts
- QC analysis completes successfully
- Fallback works when all URLs fail

✅ **Should Have:**
- 60%+ success rate for image downloads
- No Pinterest/Instagram URLs attempted
- Detailed error logs for debugging
- Faster QC completion time (less failed attempts)

✅ **Nice to Have:**
- 80%+ success rate for image downloads
- Most images from official sources
- Users don't notice any change (seamless)

## Rollback Plan

If critical issues are found:

1. **Immediate:** Revert to previous commit
2. **Investigate:** Check console logs and error patterns
3. **Fix:** Address specific issues
4. **Re-test:** Follow this guide again
5. **Re-deploy:** When all tests pass

## Future Improvements

Based on testing results:

1. **Add more domains** to blocklist if needed
2. **Implement caching** for successfully downloaded images
3. **Add allowlist** for known-good domains
4. **Implement rate limiting** tracking
5. **Add user feedback** mechanism for poor results
