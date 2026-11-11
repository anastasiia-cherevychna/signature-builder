import { describe, expect, it } from 'vitest';
import { missingFromEmail, toSignatureData, type FormState } from '../../src/builder/data';
import { FIELDS, type TextKey } from '../../src/builder/fields';
import type { ClientConfig } from '../../src/config/types';

const blank = () => Object.fromEntries(FIELDS.map((f) => [f.key, ''])) as Record<TextKey, string>;
const client: ClientConfig = { id: 'x', name: 'X Ltd', logo: { src: '/clients/x/logo.png', width: 100, height: 20, alt: 'X' } };
const live = (src: string) => new URL(src, 'https://signatures.heights.digital/').href;
const local = (src: string) => new URL(src, 'http://localhost:5173/').href;

function form(over: Partial<FormState> = {}): FormState {
  return { values: { ...blank(), name: 'Jane', title: 'CTO' }, noHeadshot: false, headshot: null, logo: null, slot: 'logo', image: null, ...over };
}

describe('form → signature data', () => {
  it('preview uses the local photo, email uses only the hosted one', () => {
    const s = form({ headshot: { preview: 'data:image/jpeg;base64,xx', hosted: 'https://res.cloudinary.com/a.jpg' } });
    expect(toSignatureData(s, client, 'preview', live).photo?.src).toMatch(/^data:/);
    expect(toSignatureData(s, client, 'email', live).photo?.src).toBe('https://res.cloudinary.com/a.jpg');
  });
  it('leaves an un-hosted photo out of the email and says so', () => {
    const s = form({ headshot: { preview: 'data:image/jpeg;base64,xx' } });
    expect(toSignatureData(s, client, 'email', live).photo).toBeUndefined();
    expect(missingFromEmail(s, client, live)).toEqual(['photo']);
  });
  it('drops the photo when "without a headshot" is on', () => {
    const s = form({ noHeadshot: true, headshot: { preview: 'data:x', hosted: 'https://h/a.jpg' } });
    expect(toSignatureData(s, client, 'email', live).photo).toBeUndefined();
    expect(missingFromEmail(s, client, live)).toEqual([]);
  });
  it('shows a logo placeholder in the preview until one is uploaded, and nothing in the email', () => {
    expect(toSignatureData(form(), client, 'preview', live).logoPlaceholder).toBe(true);
    expect(toSignatureData(form(), client, 'preview', live).logo).toBeUndefined();
    const e = toSignatureData(form(), client, 'email', live);
    expect(e.logo).toBeUndefined();
    expect(e.logoPlaceholder).toBeUndefined();
    expect(missingFromEmail(form(), client, live)).toEqual([]);
  });
  it('uses the uploaded logo, or the fixed one when the client locks it', () => {
    const s = form({ logo: { preview: 'data:x', hosted: 'https://res.cloudinary.com/l.jpg', width: 120, height: 30 } });
    expect(toSignatureData(s, client, 'email', live).logo?.src).toBe('https://res.cloudinary.com/l.jpg');
    const locked = { ...client, locked: ['logo' as const] };
    expect(toSignatureData(s, locked, 'email', live).logo?.src).toBe('https://signatures.heights.digital/clients/x/logo.png');
    expect(toSignatureData(form(), locked, 'email', local).logo).toBeUndefined();
    expect(missingFromEmail(form(), locked, local)).toEqual(['client-logo']);
  });
  it('icons are full public links on the live site, and left out (and reported) on a local machine', () => {
    const values = { ...blank(), name: 'J', title: 'T', email: 'j@x.com' };
    expect(toSignatureData(form({ values }), client, 'email', live).icons?.email).toEqual({
      light: 'https://signatures.heights.digital/icons/email.png',
      dark: 'https://signatures.heights.digital/icons/email-white.png',
    });
    expect(toSignatureData(form({ values }), client, 'email', local).icons).toEqual({});
    expect(missingFromEmail(form({ values }), client, local)).toContain('icons');
  });
  it('only adds a CTA when it has both text and a working link', () => {
    const v = { ...blank(), name: 'J', title: 'T', ctaText: 'Book a call' };
    expect(toSignatureData(form({ values: v }), client, 'email', live).cta).toBeUndefined();
    const d = toSignatureData(form({ values: { ...v, ctaLink: 'cal.com/j', ctaColour: 'abc' } }), client, 'email', live);
    expect(d.cta).toEqual({ text: 'Book a call', href: 'https://cal.com/j', colour: '#AABBCC' });
  });
  it('ignores links that aren’t LinkedIn in the LinkedIn field', () => {
    const d = toSignatureData(form({ values: { ...blank(), name: 'J', title: 'T', linkedin: 'twitter.com/j' } }), client, 'email', live);
    expect(d.linkedin).toBeUndefined();
  });
});

describe('the 128 × 128 image option (an alternative to the logo)', () => {
  const logo = { preview: 'data:logo', hosted: 'https://res.cloudinary.com/l.png', width: 120, height: 30 };
  const image = { preview: 'data:image/gif;base64,xx', hosted: 'https://res.cloudinary.com/i.gif', width: 128, height: 64 };

  it('uses the image, and not the logo, when "image" is chosen', () => {
    const s = form({ slot: 'image', logo, image });
    const e = toSignatureData(s, client, 'email', live);
    expect(e.image).toEqual({ src: 'https://res.cloudinary.com/i.gif', width: 128, height: 64, alt: 'X Ltd' }); // the size it's shown at, not forced to 128 × 128
    expect(e.logo).toBeUndefined();
    expect(toSignatureData(s, client, 'preview', live).image?.src).toBe('data:image/gif;base64,xx');
  });
  it('uses the logo, and not the image, when "logo" is chosen, and keeps both uploads when switching', () => {
    const s = form({ slot: 'logo', logo, image });
    const e = toSignatureData(s, client, 'email', live);
    expect(e.logo?.src).toBe(logo.hosted);
    expect(e.image).toBeUndefined();
    expect(toSignatureData({ ...s, slot: 'image' }, client, 'email', live).image?.src).toBe(image.hosted);
  });
  it('shows an IMAGE placeholder in the preview until one is uploaded, and nothing in the email', () => {
    const s = form({ slot: 'image', logo });
    expect(toSignatureData(s, client, 'preview', live).imagePlaceholder).toBe(true);
    expect(toSignatureData(s, client, 'preview', live).logoPlaceholder).toBeUndefined();
    const e = toSignatureData(s, client, 'email', live);
    expect(e.image).toBeUndefined();
    expect(e.imagePlaceholder).toBeUndefined();
    expect(e.logo).toBeUndefined(); // the logo isn't used while the image option is chosen
    expect(missingFromEmail(s, client, live)).toEqual([]);
  });
  it('leaves an un-hosted image out of the email and says so (but ignores an un-hosted logo that isn’t in use)', () => {
    const s = form({ slot: 'image', logo: { preview: 'data:logo' }, image: { preview: 'data:image' } });
    expect(toSignatureData(s, client, 'email', live).image).toBeUndefined();
    expect(missingFromEmail(s, client, live)).toEqual(['image']);
  });
  it('a client’s locked logo always wins, whatever was chosen', () => {
    const locked = { ...client, locked: ['logo' as const] };
    const e = toSignatureData(form({ slot: 'image', image }), locked, 'email', live);
    expect(e.logo?.src).toBe('https://signatures.heights.digital/clients/x/logo.png');
    expect(e.image).toBeUndefined();
    expect(missingFromEmail(form({ slot: 'image', image: { preview: 'data:x' } }), locked, live)).toEqual([]);
  });
});
