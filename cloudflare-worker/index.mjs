import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import jpeg from 'jpeg-js';

// Constants for retry and validation
const BASE_RETRY_DELAY_MS = 1000;
const MIN_VALID_IMAGE_SIZE = 100;

// Validate URL to prevent SSRF attacks
function isInternalUrl(urlString) {
  try {
    const parsedUrl = new URL(urlString);
    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return true;
    }
    // Block access to localhost and private/reserved IP ranges
    let hostname = parsedUrl.hostname.toLowerCase();
    
    // Remove brackets from IPv6 addresses
    if (hostname.startsWith('[') && hostname.endsWith(']')) {
      hostname = hostname.slice(1, -1);
    }
    
    // Check for localhost
    if (hostname === 'localhost' || hostname === '::1') {
      return true;
    }
    
    // Check for IPv4 patterns
    const ipv4Pattern = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const ipv4Match = hostname.match(ipv4Pattern);
    
    if (ipv4Match) {
      const octets = [1, 2, 3, 4].map(i => parseInt(ipv4Match[i], 10));
      if (octets.some(o => o > 255)) {
        return true;
      }
      
      const [a, b, c, d] = octets;
      
      if (a === 127) return true; // loopback
      if (a === 10) return true; // 10.0.0.0/8
      if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
      if (a === 192 && b === 168) return true; // 192.168.0.0/16
      if (a === 169 && b === 254) return true; // link-local
      if (a >= 224 && a <= 239) return true; // multicast
      if (a === 0) return true;
      if (a === 255) return true;
    }
    
    // Check for IPv6 private/reserved ranges
    if (hostname.includes(':')) {
      if (hostname.startsWith('fc') || hostname.startsWith('fd')) return true;
      if (hostname.startsWith('fe80:')) return true;
      if (hostname.startsWith('ff')) return true;
    }
    
    return false;
  } catch (e) {
    return true;
  }
}

async function handleRequest(request) {
  const url = new URL(request.url);
  const pathname = url.pathname.replace(/\/+$/, '');

  // Handle CORS preflight for all endpoints
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400'
      }
    });
  }

  if (pathname.endsWith('/fetch-metadata')) {
    const target = url.searchParams.get('url');
    if (!target) {
      return new Response(JSON.stringify({ error: 'missing url' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
    
    // Validate URL to prevent SSRF
    if (isInternalUrl(target)) {
      return new Response(JSON.stringify({ error: 'access to internal resources not allowed' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
    
    // Add retry logic for transient failures
    const maxRetries = 2;
    let lastError = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const fetchOpts = {
          redirect: 'follow',
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; AuthentiQC/1.0; +https://example.com)',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
          }
        };
        
        const resp = await fetch(target, fetchOpts);
        if (!resp.ok) {
          // Check if this is a retriable error
          const isRetriable = resp.status >= 500 || resp.status === 429;
          
          if (isRetriable && attempt < maxRetries) {
            // Wait before retrying (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * BASE_RETRY_DELAY_MS));
            lastError = { status: resp.status };
            continue;
          }
          
          return new Response(JSON.stringify({ 
            error: 'fetch failed', 
            status: resp.status,
            message: `Failed to fetch page metadata. Server returned ${resp.status}.`
          }), { 
            status: 502,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        }
        
        const text = await resp.text();
        
        // Use regex-based parsing (DOMParser doesn't exist in Cloudflare Workers)
        const ogImgs = [];
        const ogImageRegex = /<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/gi;
        let match;
        while ((match = ogImageRegex.exec(text)) !== null) {
          ogImgs.push(match[1]);
        }
        
        // Also try reverse order (content before property)
        const ogImageRegex2 = /<meta\s+content=["']([^"']+)["']\s+property=["']og:image["']/gi;
        while ((match = ogImageRegex2.exec(text)) !== null) {
          ogImgs.push(match[1]);
        }
        
        // Twitter Card images (twitter:image)
        const twitterImgs = [];
        const twitterImageRegex = /<meta\s+(?:name|property)=["']twitter:image(?::src)?["']\s+content=["']([^"']+)["']/gi;
        while ((match = twitterImageRegex.exec(text)) !== null) {
          twitterImgs.push(match[1]);
        }
        
        // Twitter Card images (reverse order)
        const twitterImageRegex2 = /<meta\s+content=["']([^"']+)["']\s+(?:name|property)=["']twitter:image(?::src)?["']/gi;
        while ((match = twitterImageRegex2.exec(text)) !== null) {
          twitterImgs.push(match[1]);
        }
        
        // JSON-LD images
        const ldImgs = [];
        const jsonldRegex = /<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
        while ((match = jsonldRegex.exec(text)) !== null) {
          try {
            const parsed = JSON.parse(match[1]);
            const images = extractImagesFromLd(parsed);
            ldImgs.push(...images);
          } catch (e) {
            // ignore invalid JSON
          }
        }
        
        // img tags - extract src attribute
        const imgTags = [];
        const imgRegex = /<img\s+[^>]*src=["']([^"']+)["'][^>]*>/gi;
        while ((match = imgRegex.exec(text)) !== null) {
          imgTags.push(match[1]);
        }
        
        // Resolve relative URLs to absolute URLs
        const targetUrl = new URL(target);
        const resolveUrl = (urlString) => {
          if (!urlString) return null;
          try {
            // Handle protocol-relative URLs
            if (urlString.startsWith('//')) {
              return targetUrl.protocol + urlString;
            }
            // Handle absolute URLs
            if (urlString.startsWith('http://') || urlString.startsWith('https://')) {
              return urlString;
            }
            // Handle root-relative URLs
            if (urlString.startsWith('/')) {
              return targetUrl.origin + urlString;
            }
            // Handle relative URLs
            return new URL(urlString, target).href;
          } catch (e) {
            return null;
          }
        };
        
        // Resolve and filter images
        const allImages = [...ogImgs, ...twitterImgs, ...ldImgs, ...imgTags]
          .map(resolveUrl)
          .filter(Boolean)
          .filter(url => {
            // Filter out common tracking pixels, small images, and data URIs
            const lower = url.toLowerCase();
            return !lower.startsWith('data:') &&
                   !lower.includes('1x1') && 
                   !lower.includes('tracking') && 
                   !lower.includes('pixel') &&
                   !lower.includes('spacer.gif') &&
                   !lower.includes('blank.gif') &&
                   !lower.includes('transparent.gif') &&
                   !lower.includes('logo.svg') && // Often small logos, not product images
                   !lower.includes('icon') &&
                   !lower.match(/\d+x\d+\.(gif|png)/) && // Small fixed-size images like 10x10.gif
                   url.length < 2048; // Avoid extremely long URLs which are likely data URIs or malformed
          });
        
        // Prioritize OG and Twitter images first as they're usually the main product image
        const uniqueImages = Array.from(new Set(allImages));
        const ogTwitterImages = uniqueImages.filter(url => 
          ogImgs.includes(url) || twitterImgs.includes(url)
        );
        const otherImages = uniqueImages.filter(url => 
          !ogImgs.includes(url) && !twitterImgs.includes(url)
        );
        
        const images = [...ogTwitterImages, ...otherImages].slice(0, 12);
        
        return new Response(JSON.stringify({ images }), { 
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=300'
          } 
        });
      } catch (e) {
        lastError = e;
        
        // Retry on network errors
        if (attempt < maxRetries && (e.name === 'TypeError' || e.message.includes('fetch'))) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * BASE_RETRY_DELAY_MS));
          continue;
        }
        
        return new Response(JSON.stringify({ 
          error: String(e), 
          message: `Failed to fetch or parse metadata after ${attempt + 1} attempts: ${e.message || String(e)}`
        }), { 
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
    }
    
    // Fallback if loop completes without returning
    return new Response(JSON.stringify({ 
      error: 'max retries exceeded',
      message: `Failed to fetch metadata after ${maxRetries + 1} attempts`,
      lastError: lastError ? String(lastError) : 'unknown'
    }), { 
      status: 502,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  if (pathname.endsWith('/proxy-image')) {
    const target = url.searchParams.get('url');
    if (!target) {
      return new Response(JSON.stringify({ error: 'missing url' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
    
    // Validate URL to prevent SSRF
    if (isInternalUrl(target)) {
      return new Response(JSON.stringify({ error: 'access to internal resources not allowed' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
    
    // Add retry logic for transient failures
    const maxRetries = 2;
    let lastError = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const targetUrl = new URL(target);
        const refererOverride = url.searchParams.get('referer');
        const uaOverride = url.searchParams.get('ua');
        const acceptOverride = url.searchParams.get('accept');

        const fetchOpts = {
          redirect: 'follow',
          headers: {
            'User-Agent': uaOverride || 'Mozilla/5.0 (compatible; AuthentiQC/1.0; +https://example.com)',
            'Accept': acceptOverride || 'image/*,*/*;q=0.8',
            'Referer': refererOverride || targetUrl.origin
          }
        };

        const resp = await fetch(target, fetchOpts);
        if (!resp.ok) {
          // Check if this is a retriable error
          const isRetriable = resp.status >= 500 || resp.status === 429;
          
          if (isRetriable && attempt < maxRetries) {
            // Wait before retrying (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * BASE_RETRY_DELAY_MS));
            lastError = { status: resp.status, statusText: resp.statusText };
            continue;
          }
          
          // Return detailed error for non-retriable or final attempt
          return new Response(JSON.stringify({ 
            error: 'fetch failed', 
            status: resp.status, 
            statusText: resp.statusText,
            target: target,
            message: `Failed to fetch image from ${targetUrl.hostname}. The server returned ${resp.status} ${resp.statusText}. This may be due to rate limiting, authentication requirements, or the image being unavailable.`
          }), { 
            status: 502,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        }

        const contentType = resp.headers.get('content-type') || 'application/octet-stream';
        const body = await resp.arrayBuffer();
        
        // Validate that we got actual image data
        if (!contentType.startsWith('image/') && body.byteLength < MIN_VALID_IMAGE_SIZE) {
          return new Response(JSON.stringify({ 
            error: 'invalid response', 
            message: `Expected image data but received ${contentType} with ${body.byteLength} bytes`
          }), { 
            status: 502,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        }

        return new Response(body, {
          headers: {
            'Content-Type': contentType,
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=3600',
            'X-Proxy-Status': 'success'
          }
        });
      } catch (e) {
        lastError = e;
        
        // Retry on network errors
        if (attempt < maxRetries && (e.name === 'TypeError' || e.message.includes('fetch'))) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * BASE_RETRY_DELAY_MS));
          continue;
        }
        
        // Final error after all retries
        return new Response(JSON.stringify({ 
          error: String(e), 
          message: `Failed to fetch image after ${attempt + 1} attempts: ${e.message || String(e)}`,
          target: target
        }), { 
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
    }
    
    // Fallback if loop completes without returning (shouldn't happen)
    return new Response(JSON.stringify({ 
      error: 'max retries exceeded', 
      message: `Failed to fetch image after ${maxRetries + 1} attempts`,
      lastError: lastError ? String(lastError) : 'unknown'
    }), { 
      status: 502,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  if (pathname.endsWith('/diff')) {
    const imageA = url.searchParams.get('imageA');
    const imageB = url.searchParams.get('imageB');
    if (!imageA || !imageB) return new Response(JSON.stringify({ error: 'missing images' }), { status: 400 });

    try {
      const [ra, rb] = await Promise.all([fetch(imageA), fetch(imageB)]);
      if (!ra.ok || !rb.ok) return new Response(JSON.stringify({ error: 'failed fetching images' }), { status: 502 });
      const [ab, bb] = await Promise.all([ra.arrayBuffer(), rb.arrayBuffer()]);

      const imgA = decodeImage(Buffer.from(ab));
      const imgB = decodeImage(Buffer.from(bb));

      // Resize to common dimensions (use smaller of the two)
      const width = Math.min(imgA.width, imgB.width);
      const height = Math.min(imgA.height, imgB.height);

      const dataA = resizeToRGBA(imgA, width, height);
      const dataB = resizeToRGBA(imgB, width, height);

      const diff = new Uint8Array(width * height * 4);
      const diffPixels = pixelmatch(dataA, dataB, diff, width, height, { threshold: 0.1 });

      // Build PNG from diff buffer
      const png = new PNG({ width, height });
      png.data = Buffer.from(diff);
      const pngBuffer = PNG.sync.write(png);

      const aBase64 = `data:${ra.headers.get('content-type') || 'image/jpeg'};base64,${Buffer.from(ab).toString('base64')}`;
      const bBase64 = `data:${rb.headers.get('content-type') || 'image/jpeg'};base64,${Buffer.from(bb).toString('base64')}`;
      const diffBase64 = `data:image/png;base64,${pngBuffer.toString('base64')}`;

      const diffScore = Math.round((diffPixels / (width * height)) * 100);

      return new Response(JSON.stringify({ diffScore, diffImage: diffBase64, imageA: aBase64, imageB: bBase64 }), { headers: { 'content-type': 'application/json' } });
    } catch (e) {
      return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
    }
  }

  return new Response(JSON.stringify({ error: 'Not found' }), { 
    status: 404,
    headers: { 
      'Content-Type': 'application/json', 
      'Access-Control-Allow-Origin': '*' 
    }
  });
}

function extractImagesFromLd(obj) {
  const results = [];
  if (!obj) return results;
  if (Array.isArray(obj)) {
    for (const v of obj) results.push(...extractImagesFromLd(v));
    return results;
  }
  if (typeof obj === 'object') {
    if (obj.image) {
      if (typeof obj.image === 'string') results.push(obj.image);
      else if (Array.isArray(obj.image)) results.push(...obj.image.filter(Boolean));
      else if (obj.image['@type'] && obj.image['@type'] === 'ImageObject' && obj.image.url) results.push(obj.image.url);
    }
    for (const k of Object.keys(obj)) results.push(...extractImagesFromLd(obj[k]));
  }
  return results.filter(Boolean);
}

function decodeImage(buffer) {
  // Try PNG first
  try {
    const png = PNG.sync.read(buffer);
    return { width: png.width, height: png.height, data: png.data };
  } catch (e) {}

  // Try JPEG
  try {
    const decoded = jpeg.decode(buffer, { useTArray: true });
    return { width: decoded.width, height: decoded.height, data: decoded.data };
  } catch (e) {}

  throw new Error('Unsupported image format');
}

function resizeToRGBA(img, width, height) {
  const out = new Uint8Array(width * height * 4);
  const sx = img.width / width;
  const sy = img.height / height;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcX = Math.floor(x * sx);
      const srcY = Math.floor(y * sy);
      const srcIdx = (srcY * img.width + srcX) * 4;
      const dstIdx = (y * width + x) * 4;
      out[dstIdx] = img.data[srcIdx];
      out[dstIdx + 1] = img.data[srcIdx + 1];
      out[dstIdx + 2] = img.data[srcIdx + 2];
      out[dstIdx + 3] = img.data[srcIdx + 3] !== undefined ? img.data[srcIdx + 3] : 255;
    }
  }
  return out;
}

// Export as an ES Module Worker (module format) so hybrid-nodejs_compat
// can detect the module worker and bundle node built-ins.
export default {
  fetch: (request, env, ctx) => {
    return handleRequest(request);
  }
};
