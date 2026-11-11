import { decompressFrames, parseGIF } from 'gifuct-js';
import { applyPalette, GIFEncoder, quantize } from 'gifenc';
import { imageDisplaySize, MAX_GIF_BYTES, IMAGE_SIZE } from './check';

/** A GIF is stored at up to twice the size it is shown (sharp on high-density screens), then tried smaller if the file is still heavy. */
export const GIF_SIZES = [IMAGE_SIZE * 2, IMAGE_SIZE * 1.5, IMAGE_SIZE]; // longest side, px

/** The longest-side sizes worth trying for a GIF of this size: never bigger than the original. */
export function gifSizesToTry(w: number, h: number): number[] {
  return GIF_SIZES.filter((s) => s <= Math.max(w, h));
}

/** A GIF can stay exactly as uploaded when it's already no bigger than it needs to be and light enough. */
export function gifFitsAsIs(w: number, h: number, bytes: number): boolean {
  return Math.max(w, h) <= GIF_SIZES[0] && bytes <= MAX_GIF_BYTES;
}

/**
 * Reducing a frame to 256 colours is slow for pure noise (seconds per frame) and quick for everything else.
 * Frames with a huge number of distinct colours (noise, grain) use a coarser colour grid instead, which is fast.
 */
const NOISY_COLOURS = 20000;
function frameFormat(rgba: Uint8ClampedArray): 'rgb565' | 'rgb444' {
  const seen = new Uint8Array(65536);
  let n = 0;
  for (let i = 0; i < rgba.length; i += 4) {
    const k = ((rgba[i] >> 3) << 11) | ((rgba[i + 1] >> 2) << 5) | (rgba[i + 2] >> 3);
    if (!seen[k]) { seen[k] = 1; n++; }
  }
  return n > NOISY_COLOURS ? 'rgb444' : 'rgb565';
}

const yieldToBrowser = () => new Promise<void>((r) => setTimeout(r));

/**
 * Re-draws every frame of an animated GIF at `longest` px on its longest side, keeping its proportions
 * and its timing. Frames are first rebuilt in full (GIF frames are often only the part that changed),
 * then put on white, as for the logo, so a see-through GIF doesn't turn dark in an email app's dark mode.
 */
export async function resizeGif(buf: ArrayBuffer, longest: number, onFrame?: (done: number, total: number) => void): Promise<Blob> {
  const gif = parseGIF(buf);
  const frames = decompressFrames(gif, true);
  const W = gif.lsd.width;
  const H = gif.lsd.height;
  const { width: outW, height: outH } = imageDisplaySize(W, H, longest);

  const full = document.createElement('canvas');
  full.width = W;
  full.height = H;
  const fullCtx = full.getContext('2d', { willReadFrequently: true })!;
  const patchCanvas = document.createElement('canvas');
  const patchCtx = patchCanvas.getContext('2d')!;
  const out = document.createElement('canvas');
  out.width = outW;
  out.height = outH;
  const outCtx = out.getContext('2d', { willReadFrequently: true })!;
  outCtx.imageSmoothingQuality = 'high';

  const enc = GIFEncoder();
  let restore: ImageData | null = null;
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    if (f.disposalType === 3) restore = fullCtx.getImageData(0, 0, W, H); // "put back what was here" after this frame
    patchCanvas.width = f.dims.width;
    patchCanvas.height = f.dims.height;
    patchCtx.putImageData(new ImageData(new Uint8ClampedArray(f.patch), f.dims.width, f.dims.height), 0, 0);
    fullCtx.drawImage(patchCanvas, f.dims.left, f.dims.top); // drawn (not put) so see-through pixels let the earlier frame show

    outCtx.fillStyle = '#ffffff';
    outCtx.fillRect(0, 0, outW, outH);
    outCtx.drawImage(full, 0, 0, outW, outH);
    const rgba = outCtx.getImageData(0, 0, outW, outH).data;
    const format = frameFormat(rgba);
    const palette = quantize(rgba, 256, { format });
    enc.writeFrame(applyPalette(rgba, palette, format), outW, outH, {
      palette,
      delay: f.delay > 0 ? f.delay : 100, // browsers play a 0 delay as 0.1 s
      repeat: 0, // loop forever
    });

    if (f.disposalType === 2) fullCtx.clearRect(f.dims.left, f.dims.top, f.dims.width, f.dims.height);
    else if (f.disposalType === 3 && restore) fullCtx.putImageData(restore, 0, 0);

    onFrame?.(i + 1, frames.length);
    if (i % 4 === 3) await yieldToBrowser(); // keep the page responsive on long GIFs
  }
  enc.finish();
  return new Blob([new Uint8Array(enc.bytes())], { type: 'image/gif' });
}
