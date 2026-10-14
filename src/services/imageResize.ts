// Client-side image preparation for /api/appraise.
// Phone photos are 3-6 MB each and Vercel rejects request bodies over 4.5 MB (413), so every image is
// re-encoded as JPEG (long side <= 1600 px, quality 0.8) before upload. Re-encoding also makes the
// "image/jpeg" mimeType sent to Gemini truthful (PNG screenshots labelled JPEG were rejected with 400).

export const MAX_SIDE = 1600;
export const JPEG_QUALITY = 0.8;
/** Total base64 budget for all images: leaves headroom under Vercel's 4.5 MB for the prompt + schema. */
export const MAX_TOTAL_IMAGE_BYTES = 4 * 1024 * 1024 - 400 * 1024;
/** Progressively smaller passes used when the total is still over budget. */
export const SHRINK_STEPS: ReadonlyArray<{ maxSide: number; quality: number }> = [
  { maxSide: MAX_SIDE, quality: JPEG_QUALITY },
  { maxSide: 1200, quality: 0.7 },
  { maxSide: 900, quality: 0.6 },
];

export type ShrinkFn = (dataUrl: string, maxSide: number, quality: number) => Promise<string>;

/** Target size keeping aspect ratio; never upscales. */
export const fitWithin = (w: number, h: number, maxSide: number): { width: number; height: number } => {
  if (!(w > 0) || !(h > 0)) return { width: 0, height: 0 };
  const scale = Math.min(1, maxSide / Math.max(w, h));
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
};

export const isDataUrl = (s: string): boolean => /^data:image\//i.test(s);
/** Size of the string as sent in the JSON body (base64 part only). */
export const payloadBytes = (s: string): number => (s.split(',')[1] ?? s).length;
const total = (imgs: string[]) => imgs.reduce((n, s) => n + (isDataUrl(s) ? payloadBytes(s) : 0), 0);

/** Browser re-encode through a canvas. White background so transparent PNGs don't turn black. */
export const shrinkDataUrl: ShrinkFn = (dataUrl, maxSide, quality) => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => {
    try {
      const { width, height } = fitWithin(img.naturalWidth || img.width, img.naturalHeight || img.height, maxSide);
      if (!width || !height) return reject(new Error('Unreadable image'));
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas unavailable'));
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    } catch (e) { reject(e); }
  };
  img.onerror = () => reject(new Error('Unreadable image'));
  img.src = dataUrl;
});

/**
 * Re-encode every data-URL image as JPEG and keep the total under budget: shrink further step by step,
 * then, as a last resort, drop the trailing images. Non-data URLs (lot photo links) pass through.
 * An image that cannot be decoded is dropped rather than sent mislabelled.
 */
export const prepareImagesForUpload = async (images: string[], shrink: ShrinkFn = shrinkDataUrl, budget = MAX_TOTAL_IMAGE_BYTES): Promise<string[]> => {
  const originals = images.filter(Boolean);
  let out: string[] = [];
  for (const step of SHRINK_STEPS) {
    out = [];
    for (const src of originals) {
      if (!isDataUrl(src)) { out.push(src); continue; }
      try { out.push(await shrink(src, step.maxSide, step.quality)); } catch { /* undecodable: skip */ }
    }
    if (total(out) <= budget) return out;
  }
  while (out.length > 1 && total(out) > budget) out = out.slice(0, -1);
  return out;
};
