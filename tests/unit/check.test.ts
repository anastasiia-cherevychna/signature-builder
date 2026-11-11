import { describe, expect, it } from 'vitest';
import { gifFitsAsIs, gifSizesToTry } from '../../src/image/gif';
import { gifSizeProblem, imageDimensionProblem, imageDisplaySize, MAX_GIF_BYTES, sniffBytes, typeProblem } from '../../src/image/check';
import { explain } from '../../src/upload/cloudinary';

const bytes = (s: string) => new Uint8Array([...s].map((c) => c.charCodeAt(0)));

describe('GIFs are accepted only for the 128 × 128 image', () => {
  it('recognises a GIF by its first bytes', () => {
    expect(sniffBytes(bytes('GIF89a\x00\x01'))).toBe('gif');
    expect(sniffBytes(bytes('GIF87a\x00\x01'))).toBe('gif');
  });
  it('rejects a GIF for the headshot and logo, with the existing message', () => {
    expect(typeProblem('gif', 'a.gif')?.what).toMatch(/GIF, which doesn’t work well in a signature/);
  });
  it('accepts a GIF for the image option, and still accepts JPG and PNG', () => {
    expect(typeProblem('gif', 'a.gif', { gif: true })).toBeNull();
    expect(typeProblem('png', 'a.png', { gif: true })).toBeNull();
    expect(typeProblem('jpg', 'a.jpg', { gif: true })).toBeNull();
  });
  it('still rejects other formats there, and names GIF in the advice', () => {
    expect(typeProblem('webp', 'a.webp', { gif: true })?.what).toMatch(/WebP/);
    expect(typeProblem('unknown', 'a.bin', { gif: true })?.fix).toContain('JPG, PNG or GIF');
    expect(typeProblem('unknown', 'a.bin')?.fix).toContain('JPG or PNG.');
  });
  it('notices a file named .gif that isn’t one', () => {
    expect(typeProblem('webp', 'logo.gif', { gif: true })?.what).toMatch(/named “\.gif”, but the file inside isn’t actually a GIF/);
    expect(typeProblem('webp', 'logo.gif')?.what).not.toMatch(/named/); // logo and headshot never take GIFs
  });
  it('keeps the hosted GIF under 1 MB (bigger ones are shrunk first)', () => {
    expect(gifSizeProblem(MAX_GIF_BYTES)).toBeNull();
    expect(gifSizeProblem(MAX_GIF_BYTES + 1)?.what).toMatch(/under 1 MB/);
    expect(gifSizeProblem(MAX_GIF_BYTES + 1)?.what).toMatch(/Even shrunk to fit/);
  });
  it('explains an upload the hosting service refuses for a GIF as a setup issue, not the image', () => {
    const p = explain('Format gif not allowed', 'image.gif');
    expect(p.what).toMatch(/rejected this GIF/);
    expect(p.fix).toMatch(/setup issue/);
    expect(explain('Format gif not allowed', 'image.png').fix).toBe('Use a JPG or PNG.');
  });
});

describe('the image option is shown at up to 128 × 128, keeping its proportions', () => {
  it('shows a square image at exactly 128 × 128', () => {
    expect(imageDisplaySize(256, 256)).toEqual({ width: 128, height: 128 });
    expect(imageDisplaySize(1000, 1000)).toEqual({ width: 128, height: 128 });
  });
  it('shows a shorter image at its own height, so the signature wraps tightly around it', () => {
    expect(imageDisplaySize(400, 200)).toEqual({ width: 128, height: 64 });
    expect(imageDisplaySize(300, 90)).toEqual({ width: 128, height: 38 });
    expect(imageDisplaySize(128, 90)).toEqual({ width: 128, height: 90 });
  });
  it('shows a taller image at its own width', () => {
    expect(imageDisplaySize(200, 400)).toEqual({ width: 64, height: 128 });
    expect(imageDisplaySize(90, 300)).toEqual({ width: 38, height: 128 });
  });
  it('never shows it bigger than 128 on either side, or squashes it', () => {
    for (const [w, h] of [[640, 480], [333, 500], [4000, 1100], [129, 128]]) {
      const d = imageDisplaySize(w, h);
      expect(Math.max(d.width, d.height)).toBe(128);
      expect(Math.abs(d.width / d.height - w / h)).toBeLessThan(0.05);
    }
  });
});

describe('128 × 128 image size checks', () => {
  it('asks for at least 128 px on the longest side (so it stays sharp)', () => {
    expect(imageDimensionProblem(100, 100)?.what).toMatch(/only 100×100 px/);
    expect(imageDimensionProblem(127, 90)?.what).toMatch(/only 127×90 px/);
    expect(imageDimensionProblem(128, 128)).toBeNull();
  });
  it('accepts an image shorter than 128 px, as long as its width is enough', () => {
    expect(imageDimensionProblem(300, 90)).toBeNull();
    expect(imageDimensionProblem(128, 90)).toBeNull();
    expect(imageDimensionProblem(90, 300)).toBeNull();
  });
  it('accepts any ordinary shape, GIFs included', () => {
    expect(imageDimensionProblem(400, 200)).toBeNull();
    expect(imageDimensionProblem(300, 500)).toBeNull();
    expect(imageDimensionProblem(300, 150)).toBeNull();
  });
  it('accepts wide and tall shapes too (they are shrunk to fit), e.g. a 6 : 1 banner', () => {
    expect(imageDimensionProblem(600, 100)).toBeNull();
    expect(imageDimensionProblem(100, 600)).toBeNull();
    expect(imageDimensionProblem(1200, 120)).toBeNull(); // exactly 10 : 1 is fine
  });
  it('turns away an extreme one, which would be a sliver', () => {
    expect(imageDimensionProblem(2000, 150)?.what).toMatch(/very wide/);
    expect(imageDimensionProblem(150, 2000)?.what).toMatch(/very tall/);
  });
});

describe('how a GIF is shrunk to fit', () => {
  it('shows a wide or tall one at 128 on its long side, keeping its proportions', () => {
    expect(imageDisplaySize(600, 100)).toEqual({ width: 128, height: 21 });
    expect(imageDisplaySize(100, 600)).toEqual({ width: 21, height: 128 });
    expect(imageDisplaySize(300, 150)).toEqual({ width: 128, height: 64 });
  });
  it('stores it at up to twice that size, with the same proportions, trying smaller if the file is heavy', () => {
    expect(imageDisplaySize(600, 100, 256)).toEqual({ width: 256, height: 43 });
    expect(gifSizesToTry(600, 100)).toEqual([256, 192, 128]);
  });
  it('never makes a GIF bigger than it was', () => {
    expect(gifSizesToTry(200, 100)).toEqual([192, 128]);
    expect(gifSizesToTry(130, 130)).toEqual([128]);
  });
  it('leaves a GIF that is already small and light exactly as it was', () => {
    expect(gifFitsAsIs(256, 256, 500_000)).toBe(true);
    expect(gifFitsAsIs(200, 100, MAX_GIF_BYTES)).toBe(true);
    expect(gifFitsAsIs(257, 100, 1000)).toBe(false); // too big
    expect(gifFitsAsIs(256, 256, MAX_GIF_BYTES + 1)).toBe(false); // too heavy
  });
});
