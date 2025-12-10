# QC Image Assignment & 502 Error Fix Summary

## Date: 2025-12-10

## Problems Fixed

### 1. QC Image Section Assignment Issue

**Problem**: When users uploaded multiple QC images for inspection, all images were sent to the AI together, but the system didn't track which specific images corresponded to which sections of the product (e.g., "Dial & Hands", "Clasp", "Bracelet"). This resulted in:
- Comparison images using random/round-robin image selection
- No visibility into which images were used for each section
- Less accurate section-specific comparisons

**Solution**: Implemented AI-based image-to-section assignment system:

1. **New Function**: `assignImagesToSections()` in `services/geminiService.ts`
   - Uses Google Gemini AI to analyze which sections are visible in each QC image
   - Returns a mapping of section names to arrays of image IDs
   - Uses FAST model tier for quick processing (~8 seconds)

2. **Integration**: Modified QC analysis workflow
   - After QC report generation, automatically calls `assignImagesToSections()`
   - Stores assignments in `QCSection.imageIds` array
   - Persists with the report for future reference

3. **Comparison Images**: Updated `context/AppContext.tsx`
   - Uses section-assigned images when generating comparison images
   - Falls back to round-robin if no assignments available
   - Logs which images are used for debugging

4. **UI Enhancement**: Updated `pages/ProductDetailPage.tsx`
   - Displays thumbnails of section-specific images when section is expanded
   - Users can click thumbnails to view full images
   - Shows "Images showing this section:" header with image gallery
   - Improves transparency and user understanding

### 2. 502 Bad Gateway Error from Image Proxy

**Problem**: The Cloudflare Worker proxy returned 502 errors when fetching images from Google and other sites that block bot-like user agents. The error was:
```
GET https://authentiqc-worker.adwate.workers.dev/proxy-image?url=https://...google.com/.../image.png 502 (Bad Gateway)
```

**Root Cause**: Sites like Google block requests from non-browser user agents. The worker was using a simple "AuthentiQC/1.0" user agent that triggered anti-bot protections.

**Solution**: Enhanced Cloudflare Worker headers to mimic real browser behavior:

1. **Realistic Browser Headers** (`cloudflare-worker/index.mjs`):
   ```javascript
   'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
   'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
   'Accept-Language': 'en-US,en;q=0.9',
   'Accept-Encoding': 'gzip, deflate, br',
   'Sec-Fetch-Dest': 'image',
   'Sec-Fetch-Mode': 'no-cors',
   'Sec-Fetch-Site': 'cross-site',
   ```

2. **Retry Logic Enhancement**:
   - Added 403 (Forbidden) to retriable status codes
   - Google and other sites may temporarily return 403 before allowing access
   - Exponential backoff retry on transient errors

3. **Applied to Both Endpoints**:
   - `/proxy-image`: Fetches individual images with CORS bypass
   - `/fetch-metadata`: Extracts image URLs from product pages
   - Both now use realistic browser headers

## Files Modified

1. **services/geminiService.ts** (+147 lines)
   - New function: `assignImagesToSections()`
   - Modified: `runQCAnalysis()` to call image assignment
   - Modified: `runFinalQCAnalysis()` to call image assignment

2. **context/AppContext.tsx** (+14 lines)
   - Modified comparison image selection logic
   - Uses section-assigned images when available
   - Added logging for debugging

3. **pages/ProductDetailPage.tsx** (+21 lines)
   - Added section-specific image gallery UI
   - Shows thumbnails when section is expanded
   - Click to view full image

4. **cloudflare-worker/index.mjs** (+19 lines)
   - Enhanced browser headers for `/proxy-image`
   - Enhanced browser headers for `/fetch-metadata`
   - Added 403 to retriable errors
   - Updated version to 1.4.0

## How to Test

### Test Image Assignment

1. **Create/Identify a Product**:
   - Use the "Add Product" page or identify from URL/images
   - Make sure you have a product with reference images

2. **Upload Multiple QC Images**:
   - Go to the product detail page
   - Upload 3-5 different images showing different parts of the product
   - Example for a watch: dial shot, clasp shot, case back shot, bracelet shot

3. **Run QC Inspection**:
   - Click "Start Background Analysis"
   - Wait for preliminary report (will take longer due to image assignment)
   - Submit feedback or save directly

4. **Verify Image Assignments**:
   - Expand each section in the report
   - Look for "Images showing this section:" header
   - Verify that thumbnails show relevant images
   - Example: "Clasp" section should show the clasp image
   - Click thumbnails to view full images

5. **Check Comparison Images**:
   - Look at sections with CAUTION or FAIL grades
   - Verify comparison images use section-specific images
   - Should not be random round-robin anymore

### Test Image Proxy Fix

1. **Test Google Images**:
   - Try to identify a product from a Google search result URL
   - Or manually fetch: `https://authentiqc-worker.adwate.workers.dev/proxy-image?url=https://...google.com/.../image.png`
   - Should succeed instead of 502

2. **Check Worker Logs** (Cloudflare Dashboard):
   - Look for successful image fetches
   - Verify retry attempts if 403 occurs
   - Check that headers are being sent correctly

3. **Test Product Identification**:
   - Use "Add Product" with a URL
   - The system should fetch images from the URL
   - Previously failing Google images should now work

## Expected Behavior

### Image Assignment
- **After QC Analysis**: Each section should have 0-N images assigned
- **If Multiple Images Show Same Section**: All should be listed in `imageIds`
- **If Image Shows Multiple Sections**: Same image ID appears in multiple sections
- **If No Assignment**: Falls back to round-robin (old behavior)

### Image Proxy
- **Google Images**: Should fetch successfully with realistic headers
- **403 Errors**: Should retry with exponential backoff
- **Other Blocks**: Should provide clear error message
- **Cache**: Images cached for 1 hour to reduce repeated fetches

## Troubleshooting

### Images Not Assigned to Sections
1. Check browser console for errors during QC analysis
2. Look for `[Image Assignment]` log messages
3. Verify `QCSection.imageIds` field exists in report
4. May need to wait slightly longer for AI processing

### 502 Errors Still Occurring
1. Check if worker is deployed: `https://authentiqc-worker.adwate.workers.dev/`
2. Verify worker version is 1.4.0 or higher
3. Check if the specific URL is blocked (try direct access)
4. Review Cloudflare Worker logs for detailed error info
5. Some sites may still block despite headers (add to known limitations)

### Comparison Images Not Using Section Images
1. Verify image assignments are present in report
2. Check `[Comparison]` log messages in console
3. Ensure `report.qcImageIds` matches the image IDs used
4. May fall back to round-robin if assignments missing

## Performance Impact

- **Image Assignment**: Adds ~8-15 seconds to QC analysis
- **Uses FAST Model**: Minimizes impact (Flash 2.5)
- **Parallel Processing**: Assignment happens after main analysis
- **One-Time Cost**: Results stored with report, no re-processing needed

## Future Enhancements

1. **Manual Image Assignment**: Allow users to manually assign images to sections
2. **Confidence Scores**: Show how confident AI is about assignments
3. **Image Recommendations**: Suggest which sections need more images
4. **Smart Cropping**: Auto-crop images to focus on assigned sections
5. **Assignment History**: Track how assignments improve over time

## Technical Notes

### Why AI for Image Assignment?
- Traditional computer vision would require training data
- AI can understand context (e.g., "dial" vs "case")
- Works across different product categories
- Handles varying image quality and angles
- Adapts to new product types automatically

### Why Realistic Browser Headers?
- Many sites use bot detection that checks User-Agent
- Sec-Fetch-* headers signal legitimate browser behavior
- Accept headers show proper content negotiation
- Reduces likelihood of being blocked or rate-limited
- Common practice for web scraping and proxying

## Related Documentation

- `IMAGE_FETCHING_GUIDE.md`: General image fetching troubleshooting
- `CLOUDFLARE_DEPLOYMENT_GUIDE.md`: How to deploy the worker
- `TROUBLESHOOTING_WORKER_ERROR.md`: Common worker issues

## References

- QC Section Assignment: `services/geminiService.ts:661-758`
- Image Proxy Headers: `cloudflare-worker/index.mjs:334-349`
- UI Display: `pages/ProductDetailPage.tsx:323-341`
- Comparison Logic: `context/AppContext.tsx:534-557`
