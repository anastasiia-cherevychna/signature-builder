/**
 * The form's text fields, in display order. To add a field: add it here, add its key to
 * FieldKey (config/types.ts) and use it in toSignatureData (builder/data.ts) and the template.
 */
import type { FieldKey } from '../config/types';
import { isEmail, normaliseHex, normaliseUrl, telHref } from '../template/format';

export type TextKey = Exclude<FieldKey, 'headshot' | 'logo'>;
export type Section = 'personal' | 'contact' | 'extra';

export interface FieldDef {
  key: TextKey;
  section: Section;
  label: string;
  placeholder: string;
  type?: 'text' | 'email' | 'tel' | 'url';
  autocomplete?: string;
  /** Returns a message if the value is filled in but unusable. Empty values are handled separately. */
  check?: (v: string, all: Record<TextKey, string>) => string | null;
}

const link = (v: string) => (normaliseUrl(v) ? null : 'This doesn’t look like a web link. Use something like company.com.');

export const FIELDS: FieldDef[] = [
  { key: 'name', section: 'personal', label: 'Name', placeholder: 'e.g. Jane Smith', autocomplete: 'name' },
  { key: 'title', section: 'personal', label: 'Job title', placeholder: 'e.g. CTO', autocomplete: 'organization-title' },
  // headshot + logo uploads sit here (see index.html)
  { key: 'website', section: 'contact', label: 'Website', placeholder: 'https://company.com', type: 'url', check: link },
  { key: 'email', section: 'contact', label: 'Email', placeholder: 'name@company.com', type: 'email', autocomplete: 'email',
    check: (v) => (isEmail(v) ? null : 'This email address looks incomplete. It should be like name@company.com.') },
  { key: 'phone', section: 'contact', label: 'Phone', placeholder: '+351 912 345 678', type: 'tel', autocomplete: 'tel',
    check: (v) => (telHref(v) ? null : 'This phone number is too short. Include the area or country code.') },
  { key: 'linkedin', section: 'contact', label: 'LinkedIn', placeholder: 'https://linkedin.com/in/…', type: 'url',
    check: (v) => link(v) ?? (/linkedin\.com\//i.test(v) ? null : 'This isn’t a LinkedIn link. Copy the address from your LinkedIn profile page.') },
  { key: 'ctaText', section: 'extra', label: 'CTA button text', placeholder: 'e.g. Book a call',
    check: (v, all) => (v.length > 30 ? 'Keep the button text short, under 30 characters.' : !all.ctaLink.trim() ? 'Add a CTA link too, so the button has somewhere to go.' : null) },
  { key: 'ctaLink', section: 'extra', label: 'CTA link', placeholder: 'https://calendly.com/…', type: 'url',
    check: (v, all) => link(v) ?? (!all.ctaText.trim() ? 'Add the CTA button text too, so the button has a label.' : null) },
  { key: 'ctaColour', section: 'extra', label: 'CTA colour', placeholder: '#D4F53C',
    check: (v) => (normaliseHex(v) ? null : 'Use a hex colour like #D4F53C, or tap the swatch to pick one.') },
  { key: 'quoteText', section: 'extra', label: 'Quote text', placeholder: 'e.g. The best agency we’ve worked with.',
    check: (v) => (v.length > 120 ? `This quote is ${v.length} characters. Keep it under 120 so it fits on one or two lines.` : null) },
  { key: 'quoteAuthor', section: 'extra', label: 'Quote author', placeholder: 'e.g. Sarah Lee, Acme Ltd',
    check: (_v, all) => (!all.quoteText.trim() ? 'Add the quote text too, or clear this field.' : null) },
];

export const SECTION_TITLES: Record<Section, string> = {
  personal: 'Personal Details',
  contact: 'Contact & Social links',
  extra: 'Extra',
};

export const ALWAYS_REQUIRED: FieldKey[] = ['name', 'title', 'headshot'];
