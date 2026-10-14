/**
 * Square crop dialog: drag (mouse, touch, pen), pinch, scroll-wheel or slider zoom, arrow keys.
 * Remembers the last crop so "Adjust crop" reopens where the person left off.
 */
import type { LoadedImage } from './process';

export interface CropRect { sx: number; sy: number; side: number }
interface Norm { scale: number; sx: number; sy: number }

export function createCropper(dlg: HTMLDialogElement) {
  const $ = <T extends HTMLElement>(sel: string) => dlg.querySelector(sel) as T;
  const stage = $<HTMLDivElement>('.stage');
  const img = $<HTMLImageElement>('.stage img');
  const zoom = $<HTMLInputElement>('input[type=range]');

  let src: LoadedImage | null = null;
  let S = 0;
  let crop = { scale: 1, x: 0, y: 0 };
  let resolver: ((r: { rect: CropRect; norm: Norm } | null) => void) | null = null;

  const base = () => Math.max(S / src!.w, S / src!.h);
  function clamp() {
    const s = base() * crop.scale;
    crop.x = Math.min(0, Math.max(S - src!.w * s, crop.x));
    crop.y = Math.min(0, Math.max(S - src!.h * s, crop.y));
  }
  function render() {
    clamp();
    const s = base() * crop.scale;
    img.style.width = `${src!.w}px`;
    img.style.height = `${src!.h}px`;
    img.style.transform = `translate(${crop.x}px, ${crop.y}px) scale(${s})`;
    zoom.value = String(crop.scale);
  }
  const centred = () => {
    const s = base();
    return { scale: 1, x: (S - src!.w * s) / 2, y: (S - src!.h * s) / 2 };
  };
  function zoomTo(next: number, cx = S / 2, cy = S / 2) {
    next = Math.min(4, Math.max(1, next));
    const r = next / crop.scale;
    crop.x = cx - (cx - crop.x) * r;
    crop.y = cy - (cy - crop.y) * r;
    crop.scale = next;
    render();
  }
  const toNorm = (): Norm => {
    const s = base() * crop.scale;
    return { scale: crop.scale, sx: -crop.x / s, sy: -crop.y / s };
  };
  const fromNorm = (n: Norm) => {
    const s = base() * n.scale;
    return { scale: n.scale, x: -n.sx * s, y: -n.sy * s };
  };

  // Pointer drag + pinch
  const pts = new Map<number, { x: number; y: number }>();
  let last: { x: number; y: number } | null = null;
  let pinch0: { d: number; scale: number } | null = null;
  stage.addEventListener('pointerdown', (e) => {
    stage.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    stage.classList.add('dragging');
    if (pts.size === 1) last = { x: e.clientX, y: e.clientY };
    if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      pinch0 = { d: Math.hypot(a.x - b.x, a.y - b.y), scale: crop.scale };
    }
  });
  stage.addEventListener('pointermove', (e) => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2 && pinch0) {
      const [a, b] = [...pts.values()];
      const r = stage.getBoundingClientRect();
      zoomTo((pinch0.scale * Math.hypot(a.x - b.x, a.y - b.y)) / pinch0.d, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
    } else if (pts.size === 1 && last) {
      crop.x += e.clientX - last.x;
      crop.y += e.clientY - last.y;
      last = { x: e.clientX, y: e.clientY };
      render();
    }
  });
  const up = (e: PointerEvent) => {
    pts.delete(e.pointerId);
    if (pts.size < 2) pinch0 = null;
    last = pts.size === 1 ? [...pts.values()][0] : null;
    if (!pts.size) stage.classList.remove('dragging');
  };
  stage.addEventListener('pointerup', up);
  stage.addEventListener('pointercancel', up);
  stage.addEventListener('wheel', (e) => {
    e.preventDefault();
    const r = stage.getBoundingClientRect();
    zoomTo(crop.scale * Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });
  stage.addEventListener('keydown', (e) => {
    const step = e.shiftKey ? 30 : 8;
    const k = e.key;
    if (k === 'ArrowLeft') crop.x += step;
    else if (k === 'ArrowRight') crop.x -= step;
    else if (k === 'ArrowUp') crop.y += step;
    else if (k === 'ArrowDown') crop.y -= step;
    else if (k === '+' || k === '=') return zoomTo(crop.scale + 0.1);
    else if (k === '-' || k === '_') return zoomTo(crop.scale - 0.1);
    else return;
    e.preventDefault();
    render();
  });
  zoom.addEventListener('input', () => zoomTo(parseFloat(zoom.value)));
  $('[data-zoom-in]').addEventListener('click', () => zoomTo(crop.scale + 0.25));
  $('[data-zoom-out]').addEventListener('click', () => zoomTo(crop.scale - 0.25));
  $('[data-reset]').addEventListener('click', () => { crop = centred(); render(); });
  $('[data-cancel]').addEventListener('click', () => dlg.close('cancel'));
  $('[data-apply]').addEventListener('click', () => {
    const s = base() * crop.scale;
    const result = { rect: { sx: -crop.x / s, sy: -crop.y / s, side: S / s }, norm: toNorm() };
    dlg.close('apply');
    resolver?.(result);
    resolver = null;
  });
  dlg.addEventListener('close', () => {
    if (dlg.returnValue !== 'apply') { resolver?.(null); resolver = null; }
  });
  window.addEventListener('resize', () => {
    if (!dlg.open || !src) return;
    const n = toNorm();
    S = stage.clientWidth;
    crop = fromNorm(n);
    render();
  });

  return {
    /** Opens the dialog. Resolves with the crop, or null if cancelled. */
    open(image: LoadedImage, previous?: Norm | null): Promise<{ rect: CropRect; norm: Norm } | null> {
      src = image;
      img.src = image.url;
      dlg.returnValue = '';
      dlg.showModal();
      S = stage.clientWidth;
      crop = previous ? fromNorm(previous) : centred();
      render();
      stage.focus();
      return new Promise((r) => (resolver = r));
    },
  };
}
export type { Norm as CropState };
