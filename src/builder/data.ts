/** Turns what's on the form into the data the signature template needs. Pure, so it's easy to test. */
import type { ClientConfig } from '../config/types';
import { isEmail, normaliseHex, normaliseUrl, telHref } from '../template/format';
import type { IconKey, SignatureData } from '../template/signature';
import type { TextKey } from './fields';

export interface ImageState {
  /** Local copy for the preview (data: URL). */
  preview: string;
  /** Public https URL once uploaded. */
  hosted?: string;
  width?: number;
  height?: number;
}

export interface FormState {
  values: Record<TextKey, string>;
  noHeadshot: boolean;
  headshot: ImageState | null;
  logo: ImageState | null;
}

export type Purpose = 'preview' | 'email';

/**
 * For 'preview', local images are fine. For 'email', only hosted https images are used,
 * because email apps can't show anything else.
 */
export function toSignatureData(s: FormState, client: ClientConfig, purpose: Purpose, resolve: (src: string) => string): SignatureData {
  const v = (k: TextKey) => s.values[k].trim();
  // The preview always uses the local copy (instant, works offline); email only ever gets the hosted link.
  const img = (i: ImageState | null) => (!i ? '' : purpose === 'preview' ? i.preview : i.hosted || '');

  const d: SignatureData = { name: v('name') || 'Full Name', title: v('title') || 'Job title' };

  const photo = s.noHeadshot ? '' : img(s.headshot);
  if (photo) d.photo = { src: photo, alt: v('name') };

  // An uploaded logo replaces the client's default logo, unless the client has locked it.
  const uploaded = !logoLocked(client) && s.logo ? img(s.logo) : '';
  if (uploaded && s.logo) {
    d.logo = { src: uploaded, width: s.logo.width!, height: s.logo.height!, alt: client.name };
  } else if (client.logo && !(s.logo && !logoLocked(client))) {
    const src = resolve(client.logo.src);
    if (purpose === 'preview' || isPublic(src)) d.logo = { ...client.logo, src };
  }

  const website = normaliseUrl(v('website'));
  if (website) d.website = website;
  if (isEmail(v('email'))) d.email = v('email');
  const tel = telHref(v('phone'));
  if (tel) d.phone = { display: v('phone'), href: tel };
  const li = normaliseUrl(v('linkedin'));
  if (li && /linkedin\.com\//i.test(li)) d.linkedin = li;

  const ctaHref = normaliseUrl(v('ctaLink'));
  if (v('ctaText') && ctaHref) d.cta = { text: v('ctaText'), href: ctaHref, colour: normaliseHex(v('ctaColour')) || '#CAFC3B' };

  if (v('quoteText')) d.quote = { text: v('quoteText'), author: v('quoteAuthor') || undefined };

  const icons: SignatureData['icons'] = {};
  for (const k of ICON_KEYS) {
    const src = resolve(ICON_PATH(k));
    if (purpose === 'preview' || isPublic(src)) icons[k] = src;
  }
  d.icons = icons;
  return d;
}

export const ICON_KEYS: IconKey[] = ['email', 'website', 'phone', 'linkedin'];
/** Icons live on this site at a fixed link, so they can be redesigned without anyone re-copying. */
export const ICON_PATH = (k: IconKey) => `/icons/${k}.png`;
const isPublic = (src: string) => /^https:\/\//.test(src);
export const logoLocked = (c: ClientConfig) => (c.locked ?? []).includes('logo');

export type Missing = 'photo' | 'logo' | 'client-logo' | 'icons';

/** Images that won't make it into the email copy, so we can say so. */
export function missingFromEmail(s: FormState, client: ClientConfig, resolve: (src: string) => string): Missing[] {
  const out: Missing[] = [];
  const usingUpload = !logoLocked(client) && !!s.logo;
  if (!s.noHeadshot && s.headshot && !s.headshot.hosted) out.push('photo');
  if (usingUpload && !s.logo!.hosted) out.push('logo');
  if (!usingUpload && client.logo && !isPublic(resolve(client.logo.src))) out.push('client-logo');
  const d = s.values;
  const usesIcons = [d.email, d.website, d.phone, d.linkedin].some((x) => x.trim());
  if (usesIcons && !isPublic(resolve(ICON_PATH('email')))) out.push('icons');
  return out;
}
