/**
 * Colour picker with a hex field, so it looks and works the same in every browser
 * (the built-in <input type="color"> differs per browser and hides hex in Chrome).
 * Shade square + hue bar + hex field + eyedropper (where the browser supports it).
 */
import { normaliseHex } from '../template/format';

type HSV = { h: number; s: number; v: number };

export function hexToHsv(hex: string): HSV {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return { h, s: max ? d / max : 0, v: max };
}

export function hsvToHex({ h, s, v }: HSV): string {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return Math.round((v - v * s * Math.max(0, Math.min(k, 4 - k, 1))) * 255);
  };
  return '#' + [f(5), f(3), f(1)].map((x) => x.toString(16).padStart(2, '0')).join('').toUpperCase();
}

export function attachColourPicker(button: HTMLButtonElement, getHex: () => string, onPick: (hex: string) => void) {
  const pop = document.createElement('div');
  pop.className = 'cp';
  pop.hidden = true;
  pop.setAttribute('role', 'dialog');
  pop.setAttribute('aria-label', 'Pick a colour');
  pop.innerHTML = `
    <div class="cp-sv" tabindex="0" aria-label="Shade. Use arrow keys to adjust."><div class="cp-knob"></div></div>
    <div class="cp-row">
      <span class="cp-preview"></span>
      <input class="cp-hue" type="range" min="0" max="360" step="1" aria-label="Hue">
    </div>
    <div class="cp-row">
      <label class="cp-hex-label">HEX <input class="cp-hex" type="text" maxlength="7" spellcheck="false" autocomplete="off" aria-label="Hex colour"></label>
      <button type="button" class="cp-eye" aria-label="Pick a colour from the screen" title="Pick from screen" hidden>
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M20.7 5.6 18.4 3.3a1 1 0 0 0-1.4 0l-3.1 3.1-1.9-1.9-1.4 1.4 1.4 1.4L3 16.3V21h4.7l9-9 1.4 1.4 1.4-1.4-1.9-1.9 3.1-3.1a1 1 0 0 0 0-1.4ZM6.9 19H5v-1.9l8.1-8.1 1.9 1.9L6.9 19Z"/></svg>
      </button>
    </div>
    <p class="cp-err" aria-live="polite"></p>`;
  button.after(pop);

  const q = <T extends HTMLElement>(s: string) => pop.querySelector(s) as T;
  const sv = q<HTMLDivElement>('.cp-sv');
  const knob = q<HTMLDivElement>('.cp-knob');
  const hue = q<HTMLInputElement>('.cp-hue');
  const hexIn = q<HTMLInputElement>('.cp-hex');
  const preview = q<HTMLSpanElement>('.cp-preview');
  const eye = q<HTMLButtonElement>('.cp-eye');
  const err = q<HTMLParagraphElement>('.cp-err');
  let hsv: HSV = { h: 0, s: 0, v: 0 };

  function paint(fromHexField = false) {
    const hex = hsvToHex(hsv);
    sv.style.background = `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${hsv.h} 100% 50%))`;
    knob.style.left = `${hsv.s * 100}%`;
    knob.style.top = `${(1 - hsv.v) * 100}%`;
    knob.style.background = hex;
    preview.style.background = hex;
    hue.value = String(Math.round(hsv.h));
    if (!fromHexField) hexIn.value = hex;
  }
  const emit = () => onPick(hsvToHex(hsv));

  // Shade square: drag with mouse, touch or pen; arrow keys for fine control.
  const fromPointer = (e: PointerEvent) => {
    const r = sv.getBoundingClientRect();
    hsv.s = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    hsv.v = Math.min(1, Math.max(0, 1 - (e.clientY - r.top) / r.height));
    paint();
    emit();
  };
  sv.addEventListener('pointerdown', (e) => { sv.setPointerCapture(e.pointerId); fromPointer(e); });
  sv.addEventListener('pointermove', (e) => { if (sv.hasPointerCapture(e.pointerId)) fromPointer(e); });
  sv.addEventListener('keydown', (e) => {
    const step = e.shiftKey ? 0.1 : 0.02;
    const map: Record<string, () => void> = {
      ArrowLeft: () => (hsv.s = Math.max(0, hsv.s - step)),
      ArrowRight: () => (hsv.s = Math.min(1, hsv.s + step)),
      ArrowUp: () => (hsv.v = Math.min(1, hsv.v + step)),
      ArrowDown: () => (hsv.v = Math.max(0, hsv.v - step)),
    };
    if (!map[e.key]) return;
    e.preventDefault();
    map[e.key]();
    paint();
    emit();
  });
  hue.addEventListener('input', () => { hsv.h = Number(hue.value); paint(); emit(); });
  hexIn.addEventListener('input', () => {
    const hex = normaliseHex(hexIn.value);
    err.textContent = '';
    if (hex && hexIn.value.replace('#', '').length >= 6) { hsv = hexToHsv(hex); paint(true); emit(); }
  });
  hexIn.addEventListener('change', () => {
    const hex = normaliseHex(hexIn.value);
    if (!hex) { err.textContent = 'Use 6 characters, 0–9 and A–F, like #D4F53C.'; return; }
    hsv = hexToHsv(hex);
    paint();
    emit();
  });

  // Eyedropper: Chrome and Edge only; hidden elsewhere.
  const EyeDropperCtor = (window as unknown as { EyeDropper?: new () => { open(): Promise<{ sRGBHex: string }> } }).EyeDropper;
  if (EyeDropperCtor) {
    eye.hidden = false;
    eye.addEventListener('click', async () => {
      try {
        const { sRGBHex } = await new EyeDropperCtor().open();
        const hex = normaliseHex(sRGBHex);
        if (hex) { hsv = hexToHsv(hex); paint(); emit(); }
      } catch { /* cancelled */ }
    });
  }

  function open() {
    hsv = hexToHsv(normaliseHex(getHex()) || '#CAFC3B');
    err.textContent = '';
    paint();
    pop.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    hexIn.focus();
    hexIn.select();
  }
  function close() {
    if (pop.hidden) return;
    pop.hidden = true;
    button.setAttribute('aria-expanded', 'false');
  }
  button.setAttribute('aria-haspopup', 'dialog');
  button.setAttribute('aria-expanded', 'false');
  button.addEventListener('click', () => (pop.hidden ? open() : close()));
  document.addEventListener('pointerdown', (e) => {
    if (!pop.hidden && !pop.contains(e.target as Node) && !button.contains(e.target as Node)) close();
  });
  pop.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' || (e.key === 'Enter' && e.target === hexIn)) { e.preventDefault(); hexIn.dispatchEvent(new Event('change')); close(); button.focus(); }
  });
  return { open, close };
}
