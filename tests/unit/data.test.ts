import { describe, expect, it } from 'vitest';
import { missingFromEmail, toSignatureData, type FormState } from '../../src/builder/data';
import { FIELDS, type TextKey } from '../../src/builder/fields';
import { buildSignatureHtml } from '../../src/template/signature';
import { isEmail } from '../../src/template/format';
import type { ClientConfig } from '../../src/config/types';

const blank = () => Object.fromEntries(FIELDS.map((f) => [f.key, ''])) as Record<TextKey, string>;
const client: ClientConfig = { id: 'x', name: 'X Ltd', logo: { src: '/clients/x/logo.png', width: 100, height: 20, alt: 'X' } };
const live = (src: string) => new URL(src, 'https://signatures.heights.digital/').href;
const local = (src: string) => new URL(src, 'http://localhost:5173/').href;

function form(over: Partial<FormState> = {}): FormState {
  return { values: { ...blank(), name: 'Jane', title: 'CTO' }, noHeadshot: false, emailAsIcon: true, headshot: null, logo: null, ...over };
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

describe('the one Email field, with its "Email address as icon" switch', () => {
  const field = FIELDS.find((f) => f.key === 'email')!;
  const make = (v: string, emailAsIcon: boolean) =>
    toSignatureData(form({ emailAsIcon, values: { ...blank(), name: 'J', title: 'T', email: v } }), client, 'email', live);

  it('is a single optional field, in Contact & Social links', () => {
    expect(field.section).toBe('contact');
    expect(FIELDS.filter((f) => /email/i.test(f.key))).toHaveLength(1);
    expect(make('', true).email).toBeUndefined();
    expect(make('', false).emailLine).toBeUndefined();
  });
  it('switch on (the default): the address becomes the envelope icon, not a line of text', () => {
    const d = make('jane@company.com', true);
    expect([d.email, d.emailLine]).toEqual(['jane@company.com', undefined]);
  });
  it('switch off: the address is written under the job title, not an icon', () => {
    const d = make('  jane@company.com ', false);
    expect([d.email, d.emailLine]).toEqual([undefined, 'jane@company.com']);
    const html = buildSignatureHtml(d);
    expect(html).not.toContain('icons/email'); // no envelope when it's written out
    expect(html).toContain('>jane@company.com</a>');
    expect(missingFromEmail(form({ emailAsIcon: false, values: { ...blank(), name: 'J', title: 'T', email: 'j@x.com' } }), client, local)).not.toContain('icons');
  });
  it('accepts a normal address', () => {
    expect(field.check!('jane@company.com', blank())).toBeNull();
    expect(field.check!('jane.smith+news@sub.company.co.uk', blank())).toBeNull();
  });
  it('turns away anything without an @, saying so, whichever way the switch is', () => {
    for (const bad of ['jane', 'jane.company.com', 'company.com', 'Jane Smith']) {
      expect(field.check!(bad, blank())).toMatch(/needs an @/);
      for (const on of [true, false]) { const d = make(bad, on); expect([d.email, d.emailLine]).toEqual([undefined, undefined]); }
    }
  });
  it('turns away an address that has an @ but isn’t complete', () => {
    for (const bad of ['jane@', '@company.com', 'jane@company', 'jane@company.', 'jane@@company.com', 'jane @company.com', 'jane@com pany.com', 'jane@company.c']) {
      expect(field.check!(bad, blank()), bad).toMatch(/looks incomplete/);
      expect(isEmail(bad), bad).toBe(false);
      for (const on of [true, false]) { const d = make(bad, on); expect([d.email, d.emailLine], bad).toEqual([undefined, undefined]); }
    }
  });
});
