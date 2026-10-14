import { describe, expect, it } from 'vitest';
import { missingFromEmail, toSignatureData, type FormState } from '../../src/builder/data';
import { FIELDS, type TextKey } from '../../src/builder/fields';
import type { ClientConfig } from '../../src/config/types';

const blank = () => Object.fromEntries(FIELDS.map((f) => [f.key, ''])) as Record<TextKey, string>;
const client: ClientConfig = { id: 'x', name: 'X Ltd', logo: { src: '/clients/x/logo.png', width: 100, height: 20, alt: 'X' } };
const live = (src: string) => new URL(src, 'https://signatures.heights.digital/').href;
const local = (src: string) => new URL(src, 'http://localhost:5173/').href;

function form(over: Partial<FormState> = {}): FormState {
  return { values: { ...blank(), name: 'Jane', title: 'CTO' }, noHeadshot: false, headshot: null, logo: null, ...over };
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
  it('makes the client logo a full public link, but not on a local machine', () => {
    expect(toSignatureData(form(), client, 'email', live).logo?.src).toBe('https://signatures.heights.digital/clients/x/logo.png');
    expect(toSignatureData(form(), client, 'email', local).logo).toBeUndefined();
    expect(missingFromEmail(form(), client, local)).toEqual(['client-logo']);
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
