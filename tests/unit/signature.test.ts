import { describe, expect, it } from 'vitest';
import { buildSignatureDocument, buildSignatureHtml, buildSignatureText, type SignatureData } from '../../src/template/signature';
import { contrastRatio, displayUrl, isEmail, normaliseHex, normaliseUrl, telHref, textOn } from '../../src/template/format';

const full: SignatureData = {
  name: 'Anastasiia Cherevychna',
  title: 'Designer',
  photo: { src: 'https://res.cloudinary.com/x/image/upload/v1/a.jpg' },
  logo: { src: 'https://signatures.heights.digital/clients/heights/logo.png', width: 142, height: 23, alt: 'Heights Digital' },
  website: 'https://heights.digital/',
  email: 'name@heights.digital',
  phone: { display: '+351 912 345 678', href: 'tel:+351912345678' },
  linkedin: 'https://linkedin.com/in/someone',
  cta: { text: 'Book a call', href: 'https://calendly.com/x', colour: '#CAFC3B' },
  quote: { text: 'The best agency we’ve worked with.', author: 'Sarah Lee, Acme Ltd' },
  icons: {
    email: 'https://signatures.heights.digital/icons/email.png',
    website: 'https://signatures.heights.digital/icons/website.png',
    phone: 'https://signatures.heights.digital/icons/phone.png',
    linkedin: 'https://signatures.heights.digital/icons/linkedin.png',
  },
};

describe('signature HTML is email-safe', () => {
  const html = buildSignatureHtml(full);

  it('stays well under Gmail’s 10,000 character limit', () => {
    expect(html.length).toBeLessThan(6000);
  });
  it('uses no style blocks, classes, SVG, data URLs, rgba or opacity', () => {
    expect(html).not.toMatch(/<style|class=|<svg|data:|rgba\(|opacity/i);
  });
  it('gives every image explicit width and height', () => {
    const imgs = html.match(/<img [^>]+>/g)!;
    expect(imgs).toHaveLength(6); // photo, logo, 4 contact icons
    for (const img of imgs) expect(img).toMatch(/width="\d+" height="\d+"/);
  });
  it('includes every filled-in part', () => {
    for (const s of ['Anastasiia Cherevychna', 'Designer', 'heights.digital', 'mailto:name@heights.digital',
      'tel:+351912345678', 'LinkedIn', 'Book a call', 'bgcolor="#CAFC3B"', 'Sarah Lee']) expect(html).toContain(s);
  });
  it('shows email, website, phone and LinkedIn as a row of clickable icons', () => {
    const row = html.match(/<table[^>]*margin-top:10px;"><tr>(.*?)<\/tr><\/table>/)![1];
    const links = [...row.matchAll(/<a href="([^"]+)"[^>]*><img src="[^"]+icons\/(\w+)\.png" width="24" height="24" alt="([^"]+)"/g)].map((m) => [m[2], m[1], m[3]]);
    expect(links).toEqual([
      ['email', 'mailto:name@heights.digital', 'name@heights.digital'],
      ['website', 'https://heights.digital/', 'heights.digital'],
      ['phone', 'tel:+351912345678', '+351 912 345 678'],
      ['linkedin', 'https://linkedin.com/in/someone', 'LinkedIn'],
    ]);
  });
  it('only shows icons for filled-in fields', () => {
    const h = buildSignatureHtml({ name: 'J', title: 'T', email: 'j@x.com', icons: full.icons });
    expect(h).toContain('icons/email.png');
    expect(h).not.toMatch(/icons\/(website|phone|linkedin)/);
  });
  it('falls back to text links when icons aren’t available', () => {
    const h = buildSignatureHtml({ ...full, icons: {} });
    expect(h).not.toContain('icons/');
    expect(h).toContain('>name@heights.digital</span>');
    expect(h).toContain('>LinkedIn</span>');
  });
  it('leaves out empty parts', () => {
    const min = buildSignatureHtml({ name: 'Jane', title: 'CTO' });
    expect(min).not.toMatch(/<img|mailto|bgcolor|border-top/);
  });
  it('escapes what people type', () => {
    const h = buildSignatureHtml({ name: '<b>Jane</b>', title: 'A & B "quoted"' });
    expect(h).toContain('&lt;b&gt;Jane&lt;/b&gt;');
    expect(h).toContain('A &amp; B &quot;quoted&quot;');
    expect(h).not.toContain('<b>');
  });
  it('doesn’t double up quote marks or dashes people type themselves', () => {
    const h = buildSignatureHtml({ name: 'J', title: 'T', quote: { text: '"Great"', author: '- Sam' } });
    expect(h).toContain('“Great”');
    expect(h).toContain('–Sam');
  });
  it('picks readable button text', () => {
    expect(buildSignatureHtml({ ...full, cta: { ...full.cta!, colour: '#1E3A8A' } })).toContain('color:#FFFFFF;text-decoration:none;text-transform');
    expect(html).toContain('color:#01000C;text-decoration:none;text-transform');
  });
});

describe('text and file versions', () => {
  it('plain text has the essentials', () => {
    expect(buildSignatureText(full)).toBe(
      'Anastasiia Cherevychna\nDesigner\nheights.digital | name@heights.digital | +351 912 345 678 | https://linkedin.com/in/someone\nBook a call: https://calendly.com/x\n\n“The best agency we’ve worked with.” –Sarah Lee, Acme Ltd',
    );
  });
  it('download is a full HTML document', () => {
    const doc = buildSignatureDocument(full);
    expect(doc.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(doc).toContain('<meta charset="utf-8">');
  });
});

describe('format helpers', () => {
  it('normalises links', () => {
    expect(normaliseUrl('company.com')).toBe('https://company.com/');
    expect(normaliseUrl('http://a.co/x')).toBe('http://a.co/x');
    expect(normaliseUrl('javascript:alert(1)')).toBe('');
    expect(normaliseUrl('not a link')).toBe('');
    expect(normaliseUrl('localhost')).toBe('');
    expect(displayUrl('https://www.company.com/')).toBe('company.com');
  });
  it('checks emails and phones', () => {
    expect(isEmail('name@company.com')).toBe(true);
    expect(isEmail('name@company')).toBe(false);
    expect(telHref('+351 912 345 678')).toBe('tel:+351912345678');
    expect(telHref('(020) 7946-0018')).toBe('tel:02079460018');
    expect(telHref('123')).toBe('');
  });
  it('normalises colours and contrast', () => {
    expect(normaliseHex('abc')).toBe('#AABBCC');
    expect(normaliseHex('#d4f53c')).toBe('#D4F53C');
    expect(normaliseHex('red')).toBe('');
    expect(textOn('#FFFFFF')).toBe('#01000C');
    expect(textOn('#000000')).toBe('#FFFFFF');
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 0);
  });
});
