import { describe, expect, it } from 'vitest';
import heights from '../../clients/heights.json';
import demo from '../../clients/demo-locked.json';
import { clientIdFromLocation, validateClient } from '../../src/config/load';
import type { ClientConfig } from '../../src/config/types';

// Every client file is checked here, so a typo in a new client fails before it reaches anyone.
const clients: Record<string, ClientConfig> = { heights: heights as ClientConfig, 'demo-locked': demo as ClientConfig };

describe('client files', () => {
  for (const [id, cfg] of Object.entries(clients)) {
    it(`${id}.json is valid`, () => expect(validateClient(id, cfg)).toEqual([]));
  }
  it('catches common mistakes', () => {
    const bad = { id: 'x', name: '', locked: ['name', 'nope'], logo: { src: 'a.svg', width: 0, height: 0, alt: '' }, defaults: { ctaColour: 'red' } };
    expect(validateClient('y', bad as unknown as ClientConfig)).toHaveLength(7);
  });
});

describe('which client a link is for', () => {
  const at = (pathname: string, search = '') => clientIdFromLocation({ pathname, search });
  it('reads the path, the ?client= parameter, or falls back to the default', () => {
    expect(at('/acme')).toBe('acme');
    expect(at('/Acme/')).toBe('acme');
    expect(at('/', '?client=acme')).toBe('acme');
    expect(at('/')).toBe('heights');
    expect(at('/index.html')).toBe('heights');
  });
});
