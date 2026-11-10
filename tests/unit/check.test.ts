import { describe, expect, it } from 'vitest';
import { gifSizeProblem, imageDimensionProblem, MAX_GIF_BYTES, sniffBytes, typeProblem } from '../../src/image/check';
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
  it('keeps GIFs under 1 MB', () => {
    expect(gifSizeProblem(MAX_GIF_BYTES)).toBeNull();
    expect(gifSizeProblem(MAX_GIF_BYTES + 1)?.what).toMatch(/under 1 MB/);
  });
  it('explains an upload the hosting service refuses for a GIF as a setup issue, not the image', () => {
    const p = explain('Format gif not allowed', 'image.gif');
    expect(p.what).toMatch(/rejected this GIF/);
    expect(p.fix).toMatch(/setup issue/);
    expect(explain('Format gif not allowed', 'image.png').fix).toBe('Use a JPG or PNG.');
  });
});

describe('128 × 128 image size checks', () => {
  it('asks for at least 128 px on both sides', () => {
    expect(imageDimensionProblem('png', 100, 300)?.what).toMatch(/only 100×300 px/);
    expect(imageDimensionProblem('png', 128, 128)).toBeNull();
  });
  it('fits a still image of any ordinary shape without complaint', () => {
    expect(imageDimensionProblem('png', 400, 200)).toBeNull();
    expect(imageDimensionProblem('jpg', 300, 500)).toBeNull();
  });
  it('turns away a very wide or tall still image', () => {
    expect(imageDimensionProblem('png', 1200, 200)?.what).toMatch(/very wide/);
    expect(imageDimensionProblem('jpg', 200, 1200)?.what).toMatch(/very tall/);
  });
  it('requires a GIF to be square, within 2%, because it can’t be re-drawn without losing the animation', () => {
    expect(imageDimensionProblem('gif', 256, 256)).toBeNull();
    expect(imageDimensionProblem('gif', 256, 260)).toBeNull();
    expect(imageDimensionProblem('gif', 300, 150)?.what).toMatch(/isn’t square/);
  });
});
