import type { ClientConfig, FieldKey } from './types';

// Every JSON file in /clients is bundled in at build time.
const files = import.meta.glob<ClientConfig>('../../clients/*.json', { eager: true, import: 'default' });

export const DEFAULT_CLIENT = 'heights';

const ALL_FIELDS: FieldKey[] = [
  'name', 'title', 'headshot', 'logo', 'website', 'email', 'phone', 'linkedin',
  'ctaText', 'ctaLink', 'ctaColour', 'quoteText', 'quoteAuthor',
];

export function allClients(): Record<string, ClientConfig> {
  const out: Record<string, ClientConfig> = {};
  for (const [path, cfg] of Object.entries(files)) {
    const id = path.split('/').pop()!.replace(/\.json$/, '');
    out[id] = cfg;
  }
  return out;
}

/** Problems with a client file, in plain words. Empty array = all good. */
export function validateClient(id: string, cfg: ClientConfig): string[] {
  const p: string[] = [];
  if (cfg.id !== id) p.push(`"id" is "${cfg.id}" but the file is called ${id}.json. They must match.`);
  if (!cfg.name) p.push('"name" is missing.');
  for (const f of [...(cfg.locked ?? []), ...(cfg.required ?? [])]) {
    if (!ALL_FIELDS.includes(f)) p.push(`"${f}" isn't a known field. Use one of: ${ALL_FIELDS.join(', ')}.`);
  }
  for (const f of cfg.locked ?? []) {
    if (f === 'name' || f === 'title' || f === 'headshot') p.push(`"${f}" is personal and can't be locked.`);
  }
  if (cfg.logo) {
    if (/\.svg($|\?)/i.test(cfg.logo.src)) p.push('The logo is an SVG. Gmail and Outlook don’t show SVGs; use a PNG or JPG.');
    if (!(cfg.logo.width > 0 && cfg.logo.height > 0)) p.push('The logo needs a width and height.');
  }
  const colour = cfg.defaults?.ctaColour;
  if (colour && !/^#[0-9a-f]{6}$/i.test(colour)) p.push(`CTA colour "${colour}" should look like #1A2B3C.`);
  if (cfg.upload && (!cfg.upload.cloudName || !cfg.upload.uploadPreset)) p.push('"upload" needs both cloudName and uploadPreset.');
  return p;
}

/**
 * Which client is this link for?
 *   signatures.heights.digital/acme   → acme
 *   ...?client=acme                    → acme (works anywhere, including file previews)
 *   signatures.heights.digital/        → the default client
 */
export function clientIdFromLocation(loc: Pick<Location, 'pathname' | 'search'>): string {
  const q = new URLSearchParams(loc.search).get('client');
  if (q) return q.toLowerCase();
  const seg = loc.pathname.split('/').filter(Boolean).pop() ?? '';
  if (!seg || /\.html?$/i.test(seg)) return DEFAULT_CLIENT;
  return seg.toLowerCase();
}

export function loadClient(id: string): ClientConfig | null {
  return allClients()[id] ?? null;
}
