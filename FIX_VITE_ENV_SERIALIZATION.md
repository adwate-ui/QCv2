# Fix: VITE_IMAGE_PROXY_URL Environment Variable Serialization Issue

## Problem Statement

After the merge of PR #89 (improve-loading-time-images), users reported the following error even when `VITE_IMAGE_PROXY_URL` was configured correctly:

```
[Identification] VITE_IMAGE_PROXY_URL not configured, cannot fetch AI-provided image URLs. 
See IMAGE_FETCHING_GUIDE.md for setup instructions.
```

## Root Cause

The issue was caused by **Vite's environment variable serialization behavior** during production builds:

1. **Missing Explicit Definition**: `VITE_IMAGE_PROXY_URL`, `VITE_SUPABASE_URL`, and `VITE_SUPABASE_ANON_KEY` were not explicitly defined in `vite.config.ts`'s `define` section

2. **String Serialization**: When these environment variables were not set during build time, Vite serialized them as the **literal string** `"undefined"` in the JavaScript bundle instead of actual `undefined`

3. **Falsy Check Failure**: Code checking `!proxyBase` evaluated to `false` because:
   - `proxyBase = normalizeWorkerUrl("undefined")` returned `"undefined"` (a non-empty string)
   - `!"undefined"` is `false` (because non-empty strings are truthy)
   - So the code thought the proxy URL was configured when it wasn't

## Solution

### 1. Explicitly Define Environment Variables in vite.config.ts

Added explicit `JSON.stringify()` definitions for all VITE_ prefixed environment variables:

```typescript
define: {
  // ... existing GEMINI_API_KEY definitions ...
  
  // Expose other environment variables properly to avoid "undefined" string serialization
  'import.meta.env.VITE_IMAGE_PROXY_URL': JSON.stringify(env.VITE_IMAGE_PROXY_URL),
  'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL),
  'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY),
}
```

**Why this works**: `JSON.stringify(undefined)` returns `undefined` (not the string `"undefined"`), ensuring proper serialization.

### 2. Enhanced normalizeWorkerUrl() Validation

Updated the `normalizeWorkerUrl()` function to detect and handle string literals:

```typescript
export const normalizeWorkerUrl = (workerUrl: string): string => {
  // Handle falsy values and string representations of null/undefined
  if (!workerUrl || workerUrl === 'undefined' || workerUrl === 'null') {
    return '';
  }
  // ... rest of normalization logic
};
```

This provides **defense in depth** - even if somehow the string "undefined" gets through, it will be properly handled.

### 3. User-Visible Feedback

Updated `AppContext.tsx` to provide clear user feedback when the proxy is not configured:

```typescript
if (!proxyBase) {
  console.error('[Identification] VITE_IMAGE_PROXY_URL not configured...');
  
  // Update task to inform user that proxy is not configured
  setTasks(prev => prev.map(t => t.id === taskId ? { 
    ...t, 
    meta: { 
      ...t.meta, 
      subtitle: 'Image proxy not configured - identification completed without images. See IMAGE_FETCHING_GUIDE.md for setup.' 
    } 
  } : t));
}
```

## Technical Details

### Vite Environment Variable Behavior

Vite handles environment variables differently in development vs production:

- **Development**: Vite automatically loads `VITE_*` variables from `.env.local` and injects them as-is
- **Production**: Vite only includes variables that are:
  1. Explicitly defined in `vite.config.ts` using `define`
  2. Or accessed via `import.meta.env.VITE_*` (but may serialize as strings)

### Why GEMINI_API_KEY Worked

`GEMINI_API_KEY` was already explicitly defined:
```typescript
'import.meta.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
```

This prevented the serialization issue, but the same pattern wasn't applied to other environment variables.

## Files Modified

1. **pages/vite.config.ts**
   - Added explicit JSON.stringify() for VITE_IMAGE_PROXY_URL, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY

2. **pages/src/services/utils.ts**
   - Enhanced normalizeWorkerUrl() to check for string "undefined" and "null"

3. **pages/src/context/AppContext.tsx**
   - Added user-visible feedback when proxy is not configured

## Testing

Verified the fix with multiple scenarios:

1. ✅ Build succeeds without VITE_IMAGE_PROXY_URL set
2. ✅ Build succeeds with VITE_IMAGE_PROXY_URL set
3. ✅ normalizeWorkerUrl() correctly handles:
   - Empty strings → returns `''`
   - String `"undefined"` → returns `''`
   - String `"null"` → returns `''`
   - Valid URLs → returns normalized URL

## Prevention

To prevent similar issues in the future:

1. **Always explicitly define environment variables** in `vite.config.ts` using `JSON.stringify()`
2. **Validate environment variables** to check for string "undefined" or "null" values
3. **Document required vs optional** environment variables in `.env.example`
4. **Test builds** without environment variables set to catch serialization issues

## Related Files

- `.env.example` - Documents all environment variables
- `IMAGE_FETCHING_GUIDE.md` - Setup guide for VITE_IMAGE_PROXY_URL
- `pages/src/services/env.ts` - Environment validation utilities

## Impact

- **Before Fix**: Users with correctly configured VITE_IMAGE_PROXY_URL in production would see errors and image fetching would fail
- **After Fix**: Environment variables are properly serialized and validated, preventing false "not configured" errors

## Deployment

No special deployment steps required. The fix is automatically applied when:
1. Code is merged to main branch
2. GitHub Actions builds the app
3. Environment variables are set as GitHub secrets (if needed)
