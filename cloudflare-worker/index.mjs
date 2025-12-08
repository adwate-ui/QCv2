import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import jpeg from 'jpeg-js';

async function handleRequest(request) {
  const url = new URL(request.url);
  const pathname = url.pathname.replace(/\/+$/, '');

  if (pathname.endsWith('/fetch-metadata')) {
    const target = url.searchParams.get('url');
    if (!target) return new Response(JSON.stringify({ error: 'missing url' }), { status: 400 });
    try {
      const resp = await fetch(target, { redirect: 'follow' });
      const text = await resp.text();
      // Simple parsing: extract og:image and JSON-LD and img srcs by regex to avoid DOMParser dependency
      const ogImgRe = /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/ig;
      const metaImgRe = /<meta[^>]+name=["']image["'][^>]+content=["']([^"']+)["']/ig;
      const imgTagRe = /<img[^>]+src=["']([^"']+)["']/ig;
      const ldRe = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/ig;

      const images = [];
      let m;
      while ((m = ogImgRe.exec(text))) images.push(m[1]);
      while ((m = metaImgRe.exec(text))) images.push(m[1]);
      while ((m = imgTagRe.exec(text))) images.push(m[1]);
      while ((m = ldRe.exec(text))) {
        try {
          const parsed = JSON.parse(m[1]);
          collectImagesFromLd(parsed, images);
        } catch (e) {}
      }

      const out = Array.from(new Set(images)).slice(0, 12);
      return new Response(JSON.stringify({ images: out }), { headers: { 'content-type': 'application/json' } });
    } catch (e) {
      return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
    }
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

  return new Response('Not found', { status: 404 });
}

function collectImagesFromLd(obj, out) {
  if (!obj) return;
  if (Array.isArray(obj)) return obj.forEach(v => collectImagesFromLd(v, out));
  if (typeof obj === 'object') {
    if (obj.image) {
      if (typeof obj.image === 'string') out.push(obj.image);
      else if (Array.isArray(obj.image)) out.push(...obj.image.filter(Boolean));
      else if (obj.image.url) out.push(obj.image.url);
    }
    Object.keys(obj).forEach(k => collectImagesFromLd(obj[k], out));
  }
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
