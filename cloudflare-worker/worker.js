addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

// Validate URL to prevent SSRF attacks (moved to module scope for performance)
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
      // Validate octets are in valid range
      const octets = [1, 2, 3, 4].map(i => parseInt(ipv4Match[i], 10));
      if (octets.some(o => o > 255)) {
        return true; // Invalid IP
      }
      
      const [a, b, c, d] = octets;
      
      // Block loopback (127.0.0.0/8)
      if (a === 127) return true;
      
      // Block private networks
      if (a === 10) return true; // 10.0.0.0/8
      if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
      if (a === 192 && b === 168) return true; // 192.168.0.0/16
      
      // Block link-local (169.254.0.0/16)
      if (a === 169 && b === 254) return true;
      
      // Block multicast (224.0.0.0/4)
      if (a >= 224 && a <= 239) return true;
      
      // Block reserved/special use
      if (a === 0) return true; // 0.0.0.0/8
      if (a === 255) return true; // 255.x.x.x range (includes broadcast)
    }
    
    // Check for IPv6 private/reserved ranges
    if (hostname.includes(':')) {
      // Block IPv6 private networks (fc00::/7 - ULA)
      if (hostname.startsWith('fc') || hostname.startsWith('fd')) return true;
      // Block IPv6 link-local (fe80::/10)
      if (hostname.startsWith('fe80:')) return true;
      // Block IPv6 multicast (ff00::/8)
      if (hostname.startsWith('ff')) return true;
    }
    
    return false;
  } catch (e) {
    return true; // Treat invalid URLs as internal
  }
}

async function handleRequest(request) {
  const url = new URL(request.url);
  const pathname = url.pathname.replace(/\/+$/, '');

  // Handle /proxy endpoint - proxy external resources with CORS (exact path match)
  if (pathname === '/proxy') {
    // Handle CORS preflight requests for this endpoint
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

    // Only allow GET requests
    if (request.method !== 'GET') {
      return new Response(JSON.stringify({ error: 'method not allowed' }), {
        status: 405,
        headers: { 
          'Content-Type': 'application/json', 
          'Access-Control-Allow-Origin': '*',
          'Allow': 'GET, OPTIONS'
        }
      });
    }

    const target = url.searchParams.get('url');
    if (!target) return new Response(JSON.stringify({ error: 'missing url parameter' }), { 
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
    
    if (isInternalUrl(target)) {
      return new Response(JSON.stringify({ error: 'access to internal resources not allowed' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
    
    try {
      // Use manual redirect to validate each redirect destination
      const resp = await fetch(target, { redirect: 'manual' });
      
      // Handle redirects manually to prevent SSRF
      if (resp.status >= 300 && resp.status < 400) {
        const location = resp.headers.get('location');
        if (!location) {
          return new Response(JSON.stringify({ error: 'redirect without location header' }), {
            status: 502,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        }
        
        // Resolve relative redirects and validate the redirect URL
        const redirectUrl = new URL(location, target);
        const redirectUrlString = redirectUrl.toString();
        
        // Validate redirect destination
        if (isInternalUrl(redirectUrlString)) {
          return new Response(JSON.stringify({ error: 'redirect to internal resources not allowed' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        }
        
        // Follow the redirect (limited to one redirect for simplicity and security)
        const redirectResp = await fetch(redirectUrlString, { redirect: 'manual' });
        
        // If there's another redirect, don't follow it
        if (redirectResp.status >= 300 && redirectResp.status < 400) {
          return new Response(JSON.stringify({ error: 'multiple redirects not supported' }), {
            status: 502,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        }
        
        if (!redirectResp.ok) {
          return new Response(JSON.stringify({ error: 'fetch failed', status: redirectResp.status, statusText: redirectResp.statusText }), {
            status: 502,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        }
        
        const contentType = redirectResp.headers.get('content-type') || 'application/octet-stream';
        const body = await redirectResp.arrayBuffer();

        return new Response(body, {
          headers: {
            'Content-Type': contentType,
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=3600'
          }
        });
      }
      
      if (!resp.ok) {
        return new Response(JSON.stringify({ error: 'fetch failed', status: resp.status, statusText: resp.statusText }), {
          status: 502,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }

      const contentType = resp.headers.get('content-type') || 'application/octet-stream';
      const body = await resp.arrayBuffer();

      return new Response(body, {
        headers: {
          'Content-Type': contentType,
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=3600'
        }
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: String(e) }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
  }

  if (pathname.endsWith('/fetch-metadata')) {
    // Handle CORS preflight
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

    const target = url.searchParams.get('url');
    if (!target) return new Response(JSON.stringify({ error: 'missing url' }), { 
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
    
    // Validate URL to prevent SSRF
    if (isInternalUrl(target)) {
      return new Response(JSON.stringify({ error: 'access to internal resources not allowed' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
    
    try {
      const resp = await fetch(target, { 
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; AuthentiQC/1.0; +https://authentiqc.app)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
      });
      if (!resp.ok) {
        return new Response(JSON.stringify({ 
          error: 'fetch failed', 
          status: resp.status,
          statusText: resp.statusText,
          message: `Failed to fetch URL (${resp.status} ${resp.statusText})`
        }), { 
          status: 502,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
      
      const text = await resp.text();

      // Use regex-based parsing instead of DOMParser (which doesn't exist in Cloudflare Workers)
      
      // Open Graph images (og:image)
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
      
      // Also try reverse order attributes
      const imgRegex2 = /<img\s+[^>]*?[^>]*src=["']([^"']+)["']/gi;
      while ((match = imgRegex2.exec(text)) !== null) {
        if (!imgTags.includes(match[1])) {
          imgTags.push(match[1]);
        }
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
      return new Response(JSON.stringify({ error: String(e), message: 'Failed to fetch or parse metadata' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
  }

  if (pathname.endsWith('/proxy-image')) {
    // Handle CORS preflight
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
    
    try {
      // Some hosts block non-browser user agents or require referer headers.
      const targetUrl = new URL(target);
      // Allow optional override of Referer and User-Agent via query params for testing
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

      // If target is same-origin or allows it, this will succeed; otherwise host may still block.
      const resp = await fetch(target, fetchOpts);
      if (!resp.ok) {
        return new Response(JSON.stringify({ error: 'fetch failed', status: resp.status, statusText: resp.statusText }), { 
          status: 502,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }

      const contentType = resp.headers.get('content-type') || 'application/octet-stream';
      const body = await resp.arrayBuffer();

      const out = new Response(body, {
        headers: {
          'Content-Type': contentType,
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=3600'
        }
      });

      return out;
    } catch (e) {
      return new Response(JSON.stringify({ error: String(e), message: 'Failed to fetch image' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
  }

  // Test endpoint: tries different header strategies and reports back status/headers
  if (pathname.endsWith('/proxy-test')) {
    const target = url.searchParams.get('url');
    if (!target) return new Response(JSON.stringify({ error: 'missing url' }), { status: 400 });

    const mode = url.searchParams.get('mode') || 'referer_origin';
    const results = [];

    const strategies = {
      referer_origin: {
        'User-Agent': 'Mozilla/5.0 (compatible; AuthentiQC/1.0; +https://example.com)',
        'Accept': 'image/*,*/*;q=0.8',
        'Referer': new URL(target).origin
      },
      no_headers: {},
      fake_ua: {
        'User-Agent': 'curl/7.79.1',
        'Referer': new URL(target).origin
      },
      custom_referer: {
        'User-Agent': 'Mozilla/5.0 (compatible; AuthentiQC/1.0; +https://example.com)',
        'Referer': 'https://example.com'
      }
    };

    const tryStrategy = async (name, headers) => {
      try {
        const resp = await fetch(target, { redirect: 'follow', headers });
        const ct = resp.headers.get('content-type');
        return { name, status: resp.status, statusText: resp.statusText, contentType: ct };
      } catch (e) {
        return { name, error: String(e) };
      }
    };

    if (mode === 'all') {
      for (const k of Object.keys(strategies)) {
        // eslint-disable-next-line no-await-in-loop
        results.push(await tryStrategy(k, strategies[k]));
      }
    } else {
      const strat = strategies[mode] || strategies['referer_origin'];
      results.push(await tryStrategy(mode, strat));
    }

    return new Response(JSON.stringify({ url: target, results }), { headers: { 'Content-Type': 'application/json' } });
  }

  if (pathname.endsWith('/search-image')) {
    const query = url.searchParams.get('query');
    if (!query) return new Response(JSON.stringify({ error: 'missing query' }), { status: 400 });
    
    try {
      // Use Google Custom Search API or similar service to search for images
      // For this implementation, we'll use a simplified approach
      // In production, you'd integrate with Google Custom Search API, Bing Image Search API, etc.
      
      // This is a placeholder implementation that returns a mock response
      // In production, replace this with actual image search API integration
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&tbm=isch`;
      
      // Return a placeholder response indicating search should be implemented
      return new Response(JSON.stringify({ 
        error: 'Image search API not yet configured',
        query: query,
        suggestion: 'Please configure Google Custom Search API or Bing Image Search API',
        placeholder: true
      }), { 
        status: 501,
        headers: { 'Content-Type': 'application/json' } 
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
    }
  }

  if (pathname.endsWith('/diff')) {
    // Query params: imageA, imageB (URLs)
    const imageA = url.searchParams.get('imageA');
    const imageB = url.searchParams.get('imageB');
    if (!imageA || !imageB) return new Response(JSON.stringify({ error: 'missing images' }), { status: 400 });

    try {
      const [ra, rb] = await Promise.all([fetch(imageA), fetch(imageB)]);
      const [ab, bb] = await Promise.all([ra.arrayBuffer(), rb.arrayBuffer()]);

      // Simple byte-diff sampling to create a small SVG heatmap as a visual diff
      const aBytes = new Uint8Array(ab);
      const bBytes = new Uint8Array(bb);
      const len = Math.min(aBytes.length, bBytes.length);

      const gridSize = 32; // 32x32 heatmap
      const totalSamples = gridSize * gridSize;
      const step = Math.max(1, Math.floor(len / totalSamples));
      const diffs = [];
      let diffSum = 0;
      for (let i = 0, s = 0; i < totalSamples && s < len; i++, s += step) {
        const va = aBytes[s] || 0;
        const vb = bBytes[s] || 0;
        const d = Math.abs(va - vb);
        diffs.push(d);
        diffSum += d;
      }
      const avgDiff = diffSum / totalSamples;
      const maxPossible = 255;
      const diffScore = Math.round((avgDiff / maxPossible) * 100);

      // Build SVG heatmap
      const cellSize = 8;
      let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${gridSize * cellSize}" height="${gridSize * cellSize}">`;
      for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
          const idx = y * gridSize + x;
          const d = diffs[idx] || 0;
          const gray = 255 - Math.round((d / 255) * 255);
          svg += `<rect x="${x * cellSize}" y="${y * cellSize}" width="${cellSize}" height="${cellSize}" fill="rgb(${gray},${gray},${gray})"/>`;
        }
      }
      svg += `</svg>`;

      const svgBase64 = `data:image/svg+xml;base64,${btoa(svg)}`;

      // Also return base64 of the authoritative image B and the uploaded image A (useful for client display)
      const aBase64 = `data:${ra.headers.get('content-type') || 'image/jpeg'};base64,${arrayBufferToBase64(ab)}`;
      const bBase64 = `data:${rb.headers.get('content-type') || 'image/jpeg'};base64,${arrayBufferToBase64(bb)}`;

      return new Response(JSON.stringify({ diffScore, diffImage: svgBase64, imageA: aBase64, imageB: bBase64 }), { headers: { 'Content-Type': 'application/json' } });
    } catch (e) {
      return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
    }
  }

  return new Response('Not found', { status: 404 });
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

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
