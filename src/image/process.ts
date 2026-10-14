import { damaged, sizeProblem, sniffBytes, typeProblem, unreadable, type Kind, type Problem } from './check';

export interface LoadedImage {
  img: HTMLImageElement;
  /** data: URL of the original. data: (not blob:) so it also works on pages with a strict content policy. */
  url: string;
  name: string;
  kind: Kind;
  w: number;
  h: number;
}

export type Result<T> = { ok: true; value: T } | { ok: false; problem: Problem };

const readAsDataURL = (f: Blob) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(f);
  });

/** Reads and checks a file. Never throws; problems come back as plain-language messages. */
export async function loadImageFile(file: File): Promise<Result<LoadedImage>> {
  let kind: Kind;
  try {
    kind = sniffBytes(new Uint8Array(await file.slice(0, 16).arrayBuffer()));
  } catch {
    return { ok: false, problem: unreadable };
  }
  const tp = typeProblem(kind, file.name);
  if (tp) return { ok: false, problem: tp };
  const sp = sizeProblem(file.size);
  if (sp) return { ok: false, problem: sp };

  let url: string;
  try {
    url = await readAsDataURL(file);
  } catch {
    return { ok: false, problem: { what: 'Your browser couldn’t read this file.', fix: 'Try again, or save it to your desktop and upload it from there.' } };
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ ok: true, value: { img, url, name: file.name, kind, w: img.naturalWidth, h: img.naturalHeight } });
    img.onerror = () => resolve({ ok: false, problem: damaged(kind) });
    img.src = url;
  });
}

export const HEADSHOT_PX = 400; // 105 px displayed, ~4× for sharp screens and future layouts

/**
 * Draws the cropped square onto a fresh canvas. Re-encoding drops all metadata
 * (including GPS location) and fixes phone orientation.
 */
export function renderHeadshot(img: HTMLImageElement, sx: number, sy: number, side: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = HEADSHOT_PX;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, HEADSHOT_PX, HEADSHOT_PX);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, sx, sy, side, side, 0, 0, HEADSHOT_PX, HEADSHOT_PX);
  return c;
}

/** The logo's box in the signature (from Figma): up to 150 × 60 px. */
export const LOGO_BOX = { w: 150, h: 60 };

/**
 * Prepares a logo: trims empty margins, puts it on white (as the design asks, so it
 * stays visible when email apps switch to dark mode), and sizes it at 2× its display size.
 */
export function renderLogo(img: HTMLImageElement): { canvas: HTMLCanvasElement; width: number; height: number } {
  const src = document.createElement('canvas');
  src.width = img.naturalWidth;
  src.height = img.naturalHeight;
  const sctx = src.getContext('2d', { willReadFrequently: true })!;
  sctx.fillStyle = '#ffffff';
  sctx.fillRect(0, 0, src.width, src.height);
  sctx.drawImage(img, 0, 0);
  const box = trimBox(sctx.getImageData(0, 0, src.width, src.height));

  const scale = Math.min(LOGO_BOX.w / box.w, LOGO_BOX.h / box.h, 1e9);
  const width = Math.max(1, Math.round(box.w * scale));
  const height = Math.max(1, Math.round(box.h * scale));
  const out = document.createElement('canvas');
  out.width = width * 2;
  out.height = height * 2;
  const ctx = out.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, box.x, box.y, box.w, box.h, 0, 0, out.width, out.height);
  return { canvas: out, width, height };
}

/** Bounding box of everything that isn't (near) white. */
export function trimBox(data: ImageData): { x: number; y: number; w: number; h: number } {
  const { width: W, height: H, data: d } = data;
  let minX = W, minY = H, maxX = -1, maxY = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (d[i] < 245 || d[i + 1] < 245 || d[i + 2] < 245) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return { x: 0, y: 0, w: W, h: H }; // all white: leave as is
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

export const toJpeg = (c: HTMLCanvasElement, q = 0.9) =>
  new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('encode'))), 'image/jpeg', q));
