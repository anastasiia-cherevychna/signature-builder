import { describe, expect, it } from 'vitest';
import { ICON_PATH, missingFromEmail, toSignatureData, type FormState } from '../../src/builder/data';
import { FIELDS, type TextKey } from '../../src/builder/fields';
import type { ClientConfig } from '../../src/config/types';

const blank = () => Object.fromEntries(FIELDS.map((f) => [f.key, ''])) as Record<TextKey, string>;
const client: ClientConfig = { id: 'x', name: 'X Ltd', logo: { src: '/clients/x/logo.png', width: 100, height: 20, alt: 'X' } };
const live = (src: string) => new URL(src, 'https://signatures.heights.digital/').href;
const local = (src: string) => new URL(src, 'http://localhost:5173/').href;

function form(over: Partial<FormState> = {}): FormState {
  return { iconStyle: 'solid', values: { ...blank(), name: 'Jane', title: 'CTO' }, noHeadshot: false, headshot: null, logo: null, ...over };
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

describe('icon styles', () => {
  const values = { ...blank(), name: 'J', title: 'T', email: 'j@x.com', website: 'https://x.com', phone: '+351 912 345 678', linkedin: 'linkedin.com/in/j' };

  it('Solid keeps the original file paths, so signatures already sent keep working', () => {
    expect(ICON_PATH('email')).toBe('/icons/email.png');
    expect(ICON_PATH('email', 'dark')).toBe('/icons/email-white.png');
    expect(ICON_PATH('phone', 'light', 'solid')).toBe('/icons/phone.png');
  });
  it('Outline has its own folder, in charcoal and white', () => {
    expect(ICON_PATH('email', 'light', 'outline')).toBe('/icons/outline/email.png');
    expect(ICON_PATH('linkedin', 'dark', 'outline')).toBe('/icons/outline/linkedin-white.png');
  });
  it('the form’s style decides which icons go into the signature', () => {
    for (const [style, dir] of [['solid', '/icons/'], ['outline', '/icons/outline/']] as const) {
      const d = toSignatureData(form({ values, iconStyle: style }), client, 'email', live);
      for (const k of ['email', 'website', 'phone', 'linkedin'] as const) {
        expect(d.icons?.[k]).toEqual({
          light: `https://signatures.heights.digital${dir}${k}.png`,
          dark: `https://signatures.heights.digital${dir}${k}-white.png`,
        });
      }
    }
  });
  it('is the same on a local machine: Outline icons are left out and reported, like Solid ones', () => {
    expect(toSignatureData(form({ values, iconStyle: 'outline' }), client, 'email', local).icons).toEqual({});
    expect(missingFromEmail(form({ values, iconStyle: 'outline' }), client, local)).toContain('icons');
  });
});
