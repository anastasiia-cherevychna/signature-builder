import { describe, expect, it } from 'vitest';
import { hexToHsv, hsvToHex } from '../../src/builder/colour-picker';

describe('colour picker maths', () => {
  it('round-trips hex → HSV → hex', () => {
    for (const hex of ['#7A9334', '#CAFC3B', '#000000', '#FFFFFF', '#1E3A8A', '#FE6C23', '#808080']) {
      expect(hsvToHex(hexToHsv(hex))).toBe(hex);
    }
  });
  it('knows pure colours', () => {
    expect(hexToHsv('#FF0000')).toEqual({ h: 0, s: 1, v: 1 });
    expect(hsvToHex({ h: 120, s: 1, v: 1 })).toBe('#00FF00');
  });
});
