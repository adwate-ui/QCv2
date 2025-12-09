addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  const pathname = url.pathname.replace(/\/+$/, '');

  // Handle CORS preflight requests
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

  // Handle /proxy endpoint - proxy external resources with CORS
  if (pathname.endsWith('/proxy')) {
    const target = url.searchParams.get('url');
    if (!target) return new Response(JSON.stringify({ error: 'missing url parameter' }), { 
      status: 400,
      headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }
    });
    
    // Validate URL to prevent SSRF attacks
    try {
      const targetUrl = new URL(target);
      // Only allow http and https protocols
      if (!['http:', 'https:'].includes(targetUrl.protocol)) {
        return new Response(JSON.stringify({ error: 'invalid protocol' }), {
          status: 400,
          headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }
        });
      }
      // Block access to localhost and private IP ranges
      const hostname = targetUrl.hostname.toLowerCase();
      if (hostname === 'localhost' || hostname === '127.0.0.1' || 
          hostname.startsWith('192.168.') || hostname.startsWith('10.') || 
          hostname.startsWith('172.16.') || hostname === '[::1]' || hostname === '0.0.0.0') {
        return new Response(JSON.stringify({ error: 'access to internal resources not allowed' }), {
          status: 403,
          headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }
        });
      }
    } catch (e) {
      return new Response(JSON.stringify({ error: 'invalid url' }), {
        status: 400,
        headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }
      });
    }
    
    try {
      // Follow redirects with automatic handling (Cloudflare Workers limits this by default)
      const resp = await fetch(target, { redirect: 'follow' });
      if (!resp.ok) {
        return new Response(JSON.stringify({ error: 'fetch failed', status: resp.status, statusText: resp.statusText }), {
          status: 502,
          headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }
        });
      }

      const contentType = resp.headers.get('content-type') || 'application/octet-stream';
      const body = await resp.arrayBuffer();

      return new Response(body, {
        headers: {
          'content-type': contentType,
          'access-control-allow-origin': '*',
          'cache-control': 'public, max-age=3600'
        }
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: String(e) }), {
        status: 500,
        headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }
      });
    }
  }

  if (pathname.endsWith('/fetch-metadata')) {
    const target = url.searchParams.get('url');
    if (!target) return new Response(JSON.stringify({ error: 'missing url' }), { status: 400 });
    try {
      const resp = await fetch(target, { redirect: 'follow' });
      const text = await resp.text();
      const doc = new DOMParser().parseFromString(text, 'text/html');

      // OG images
      const ogImgs = Array.from(doc.querySelectorAll('meta[property="og:image"]')).map(m => m.getAttribute('content')).filter(Boolean);

      // JSON-LD images
      const jsonld = Array.from(doc.querySelectorAll('script[type="application/ld+json"]')).map(s => s.textContent).filter(Boolean);
      const ldImgs = [];
      for (const block of jsonld) {
        try {
          const parsed = JSON.parse(block);
          const images = extractImagesFromLd(parsed);
          ldImgs.push(...images);
        } catch (e) {
          // ignore
        }
      }

      // img tags
      const imgTags = Array.from(doc.querySelectorAll('img')).map(i => i.getAttribute('src')).filter(Boolean);

      const images = Array.from(new Set([...(ogImgs || []), ...(ldImgs || []), ...(imgTags || [])])).slice(0, 12);

      return new Response(JSON.stringify({ images }), { headers: { 'content-type': 'application/json' } });
    } catch (e) {
      return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
    }
  }

  if (pathname.endsWith('/proxy-image')) {
    const target = url.searchParams.get('url');
    if (!target) return new Response(JSON.stringify({ error: 'missing url' }), { status: 400 });
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
      if (!resp.ok) return new Response(JSON.stringify({ error: 'fetch failed', status: resp.status, statusText: resp.statusText }), { status: 502 });

      const contentType = resp.headers.get('content-type') || 'application/octet-stream';
      const body = await resp.arrayBuffer();

      const out = new Response(body, {
        headers: {
          'content-type': contentType,
          'access-control-allow-origin': '*',
          'cache-control': 'public, max-age=60'
        }
      });

      return out;
    } catch (e) {
      return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
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

    return new Response(JSON.stringify({ url: target, results }), { headers: { 'content-type': 'application/json' } });
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

      return new Response(JSON.stringify({ diffScore, diffImage: svgBase64, imageA: aBase64, imageB: bBase64 }), { headers: { 'content-type': 'application/json' } });
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
