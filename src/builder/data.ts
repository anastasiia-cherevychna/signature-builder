/** Turns what's on the form into the data the signature template needs. Pure, so it's easy to test. */
import type { ClientConfig } from '../config/types';
import { isEmail, normaliseHex, normaliseUrl, telHref } from '../template/format';
import type { SignatureData } from '../template/signature';
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

  if (client.logo) {
    const src = resolve(client.logo.src);
    if (purpose === 'preview' || /^https:\/\//.test(src)) d.logo = { ...client.logo, src };
  } else if (s.logo) {
    const src = img(s.logo);
    if (src) d.logo = { src, width: s.logo.width!, height: s.logo.height!, alt: client.name };
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
  return d;
}

export type Missing = 'photo' | 'logo' | 'client-logo';

/** Images that won't make it into the email copy, so we can say so. */
export function missingFromEmail(s: FormState, client: ClientConfig, resolve: (src: string) => string): Missing[] {
  const out: Missing[] = [];
  if (!s.noHeadshot && s.headshot && !s.headshot.hosted) out.push('photo');
  if (!client.logo && s.logo && !s.logo.hosted) out.push('logo');
  if (client.logo && !/^https:\/\//.test(resolve(client.logo.src))) out.push('client-logo');
  return out;
}
