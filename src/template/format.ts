/** Small, pure helpers shared by the signature template and the form. */

export const escapeHtml = (v: string): string =>
  v.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** "company.com" → "https://company.com". Returns '' for anything that isn't a usable web link. */
export function normaliseUrl(raw: string): string {
  const v = raw.trim();
  if (!v) return '';
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return '';
    if (!u.hostname.includes('.')) return '';
    return u.href;
  } catch {
    return '';
  }
}

/** "https://www.company.com/" → "company.com" for display. */
export function displayUrl(href: string): string {
  return href.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '');
}

export const isEmail = (v: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

/** "+351 912 345 678" → "tel:+351912345678" */
export function telHref(raw: string): string {
  const digits = raw.trim().replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '');
  return digits.replace(/\D/g, '').length >= 6 ? `tel:${digits}` : '';
}

export const isHex = (v: string): boolean => /^#[0-9a-f]{6}$/i.test(v.trim());

/** "#abc" or "abc123" → "#AABBCC" / "#ABC123"; '' if it isn't a colour. */
export function normaliseHex(raw: string): string {
  let v = raw.trim().replace(/^#?/, '#');
  if (/^#[0-9a-f]{3}$/i.test(v)) v = '#' + [...v.slice(1)].map((c) => c + c).join('');
  return isHex(v) ? v.toUpperCase() : '';
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two hex colours. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export const INK = '#01000C';
export const WHITE = '#FFFFFF';

/** Black or white, whichever reads better on the button colour. */
export function textOn(bg: string): string {
  return contrastRatio(bg, INK) >= contrastRatio(bg, WHITE) ? INK : WHITE;
}
