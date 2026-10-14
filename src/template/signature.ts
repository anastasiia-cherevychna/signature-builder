/**
 * The email signature itself.
 *
 * This is the fragile part of the product: it has to survive Gmail, Outlook (web, new and classic desktop),
 * Apple Mail and phones. Rules it follows, and that any change must keep:
 *   - tables for layout, every style inline, no <style> blocks, no classes
 *   - web-safe fonts only (Arial / Helvetica)
 *   - images are hosted https PNG/JPG with explicit width + height, never SVG or data: URLs
 *   - no opacity or rgba (colours are pre-blended onto white)
 *   - stays well under Gmail's 10,000-character signature limit
 *
 * The builder preview renders this exact HTML, so what people see is what they copy.
 */
import { displayUrl, escapeHtml as esc, normaliseHex, textOn } from './format';

export interface SignatureData {
  name: string;
  title: string;
  /** Square headshot. `src` must be a hosted https URL when copying (a data: URL is fine for preview). */
  photo?: { src: string; alt?: string };
  logo?: { src: string; width: number; height: number; alt: string };
  website?: string; // full href
  email?: string;
  phone?: { display: string; href: string };
  linkedin?: string; // full href
  cta?: { text: string; href: string; colour: string };
  quote?: { text: string; author?: string };
  /** Hosted https PNG icons (48 × 48, shown at 24). Without them the row falls back to text links. */
  icons?: Partial<Record<IconKey, string>>;
}

export type IconKey = 'email' | 'website' | 'phone' | 'linkedin';
const ICON = 24;
const ICON_GAP = 12;

// Figma colours, pre-blended onto white where the design uses opacity.
export const COLOURS = {
  name: '#34333D', // Black #01000C at 80%
  title: '#332D28', // Charcoal
  meta: '#5C5753', // Charcoal at 80%
  separator: '#CCCAC9', // Light Grey
  link: '#332D28',
};

const FONT = 'font-family:Arial,Helvetica,sans-serif;';
const PHOTO = 105;
const TABLE = 'cellpadding="0" cellspacing="0" border="0" role="presentation"';

/**
 * Email, website, phone and LinkedIn as a row of icons. Each icon is a link (mailto:, the site,
 * tel:, the profile), and only filled-in fields get one. If icons aren't available, the same row
 * is shown as text links instead. Alt and title text carry the address, so it's still readable
 * when an email app blocks images.
 */
function contactRow(d: SignatureData): string {
  const icons = d.icons ?? {};
  const items: { key: IconKey; href: string; label: string }[] = [];
  if (d.email) items.push({ key: 'email', href: `mailto:${d.email}`, label: d.email });
  if (d.website) items.push({ key: 'website', href: d.website, label: displayUrl(d.website) });
  if (d.phone) items.push({ key: 'phone', href: d.phone.href, label: d.phone.display });
  if (d.linkedin) items.push({ key: 'linkedin', href: d.linkedin, label: 'LinkedIn' });
  if (!items.length) return '';
  const cells = items.map((it, i) => {
    const pad = i < items.length - 1 ? `padding:0 ${ICON_GAP}px 0 0;` : 'padding:0;';
    const icon = icons[it.key];
    const inner = icon
      ? `<img src="${esc(icon)}" width="${ICON}" height="${ICON}" alt="${esc(it.label)}" ` +
        `style="display:block;width:${ICON}px;height:${ICON}px;border:0;outline:none;">`
      : `<span style="${FONT}font-size:14px;line-height:20px;color:${COLOURS.link};white-space:nowrap;">${esc(it.label)}</span>`;
    return `<td valign="middle" style="${pad}"><a href="${esc(it.href)}" title="${esc(it.label)}" style="text-decoration:none;">${inner}</a></td>`;
  });
  return `<table ${TABLE} style="border-collapse:collapse;margin-top:10px;"><tr>${cells.join('')}</tr></table>`;
}

function ctaButton(cta: SignatureData['cta']): string {
  if (!cta) return '';
  const bg = normaliseHex(cta.colour) || '#CAFC3B';
  const fg = textOn(bg);
  // "Bulletproof" button: the coloured cell works in Outlook desktop, the padded link is the click area elsewhere.
  return (
    `<table ${TABLE} style="border-collapse:separate;margin-top:12px;"><tr>` +
    `<td bgcolor="${bg}" style="background-color:${bg};border-radius:100px;mso-padding-alt:10px 20px;">` +
    `<a href="${esc(cta.href)}" style="display:inline-block;padding:10px 20px;${FONT}font-size:14px;line-height:14px;` +
    `color:${fg};text-decoration:none;text-transform:uppercase;border-radius:100px;">${esc(cta.text)}</a>` +
    `</td></tr></table>`
  );
}

export function buildSignatureHtml(d: SignatureData): string {
  const name = esc(d.name);
  const photo = d.photo
    ? `<td valign="top" width="${PHOTO}" style="padding:0 20px 0 0;width:${PHOTO}px;">` +
      `<img src="${esc(d.photo.src)}" width="${PHOTO}" height="${PHOTO}" alt="${esc(d.photo.alt ?? d.name)}" ` +
      `style="display:block;width:${PHOTO}px;height:${PHOTO}px;border:0;outline:none;"></td>`
    : '';
  const logo = d.logo
    ? `<td valign="top" align="right" style="padding:0 0 0 24px;">` +
      `<img src="${esc(d.logo.src)}" width="${d.logo.width}" height="${d.logo.height}" alt="${esc(d.logo.alt)}" ` +
      `style="display:block;width:${d.logo.width}px;height:${d.logo.height}px;border:0;outline:none;"></td>`
    : '';

  const details =
    `<td valign="top" style="padding:0;${FONT}">` +
    `<div style="${FONT}font-size:24px;line-height:35px;color:${COLOURS.name};">${name}</div>` +
    (d.title ? `<div style="${FONT}font-size:18px;line-height:26px;color:${COLOURS.title};">${esc(d.title)}</div>` : '') +
    contactRow(d) +
    ctaButton(d.cta) +
    `</td>`;

  const top = `<table ${TABLE} width="100%" style="border-collapse:collapse;"><tr>${photo}${details}${logo}</tr></table>`;

  const quote = d.quote?.text
    ? `<tr><td style="padding:20px 0 0 0;"><table ${TABLE} width="100%" style="border-collapse:collapse;"><tr>` +
      `<td height="1" style="border-top:1px solid ${COLOURS.separator};font-size:0;line-height:0;">&nbsp;</td></tr></table></td></tr>` +
      `<tr><td style="padding:20px 0 0 0;${FONT}">` +
      `<div style="${FONT}font-size:20px;line-height:29px;color:${COLOURS.name};">“${esc(d.quote.text.replace(/^["“‘']+|["”’']+$/g, ''))}”</div>` +
      (d.quote.author
        ? `<div style="${FONT}font-size:18px;line-height:26px;color:${COLOURS.meta};">–${esc(d.quote.author.replace(/^[-–—\s]+/, ''))}</div>`
        : '') +
      `</td></tr>`
    : '';

  return (
    `<table ${TABLE} width="100%" style="border-collapse:collapse;width:100%;max-width:652px;${FONT}">` +
    `<tr><td style="padding:0;">${top}</td></tr>${quote}</table>`
  );
}

/** Plain-text fallback for apps that don't take HTML. */
export function buildSignatureText(d: SignatureData): string {
  const lines = [d.name, d.title];
  const contact = [d.website && displayUrl(d.website), d.email, d.phone?.display, d.linkedin].filter(Boolean);
  if (contact.length) lines.push(contact.join(' | '));
  if (d.cta) lines.push(`${d.cta.text}: ${d.cta.href}`);
  if (d.quote?.text) lines.push('', `“${d.quote.text}”${d.quote.author ? ` –${d.quote.author}` : ''}`);
  return lines.filter((l) => l !== undefined).join('\n');
}

/** A complete .html file, for Outlook desktop and Apple Mail. */
export function buildSignatureDocument(d: SignatureData): string {
  return (
    `<!DOCTYPE html>\n<html lang="en"><head><meta charset="utf-8"><title>${esc(d.name)} – email signature</title></head>` +
    `<body style="margin:0;padding:24px;background:#ffffff;">\n${buildSignatureHtml(d)}\n</body></html>\n`
  );
}
