/**
 * Checks an uploaded file and explains, in plain words, exactly what's wrong and how to fix it.
 * Reads the file's first bytes, because names and browser-reported types can be wrong.
 */

export type Kind = 'jpg' | 'png' | 'heic' | 'avif' | 'webp' | 'gif' | 'pdf' | 'tiff' | 'bmp' | 'svg' | 'video' | 'empty' | 'unknown';

export interface Problem {
  what: string;
  fix: string;
}

export const MAX_BYTES = 10 * 1024 * 1024;

export function sniffBytes(b: Uint8Array): Kind {
  if (b.length === 0) return 'empty';
  const hex = [...b.slice(0, 16)].map((x) => x.toString(16).padStart(2, '0')).join('');
  const ascii = String.fromCharCode(...b.slice(0, 16));
  if (hex.startsWith('ffd8ff')) return 'jpg';
  if (hex.startsWith('89504e47')) return 'png';
  if (ascii.slice(4, 8) === 'ftyp') {
    const brand = ascii.slice(8, 12).toLowerCase();
    if (/heic|heix|hevc|mif1|msf1|heis/.test(brand)) return 'heic';
    if (/avif|avis/.test(brand)) return 'avif';
    return 'video';
  }
  if (ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP') return 'webp';
  if (ascii.startsWith('GIF8')) return 'gif';
  if (ascii.startsWith('%PDF')) return 'pdf';
  if (hex.startsWith('49492a00') || hex.startsWith('4d4d002a')) return 'tiff';
  if (ascii.startsWith('BM')) return 'bmp';
  if (/^\s*<(\?xml|svg)/i.test(ascii)) return 'svg';
  return 'unknown';
}

const WRONG_TYPE: Record<Exclude<Kind, 'jpg' | 'png'>, Problem> = {
  heic: { what: 'This is an iPhone HEIC photo, which email apps can’t display.', fix: 'On iPhone: Settings › Camera › Formats › Most Compatible, then retake it. Or on a Mac, open it in Preview and choose File › Export › JPEG.' },
  avif: { what: 'This is an AVIF image, which most email apps can’t display.', fix: 'Open it in Preview (Mac) or Paint (Windows) and save it as JPG or PNG.' },
  webp: { what: 'This is a WebP image (common when saving pictures from websites), which Outlook can’t display.', fix: 'Open it in Preview (Mac) or Paint (Windows) and save it as JPG or PNG.' },
  gif: { what: 'This is a GIF, which doesn’t work well in a signature.', fix: 'Use a JPG or PNG instead.' },
  pdf: { what: 'This is a PDF document, not an image.', fix: 'Export the page as JPG or PNG, or take a screenshot.' },
  tiff: { what: 'This is a TIFF image, which email apps can’t display.', fix: 'Open it in Preview (Mac) or Photos (Windows) and export it as JPG.' },
  bmp: { what: 'This is a BMP image, which email apps can’t display.', fix: 'Open it in Paint or Preview and save it as JPG or PNG.' },
  svg: { what: 'This is an SVG. Gmail and Outlook don’t show SVGs, and they can contain code.', fix: 'Export it as PNG or JPG from your design tool.' },
  video: { what: 'This looks like a video, not an image.', fix: 'Pick a still image in JPG or PNG format.' },
  empty: { what: 'This file is empty (0 bytes). It may not have finished downloading or syncing.', fix: 'Check the file opens on your computer, then try again.' },
  unknown: { what: 'We couldn’t recognise this file as an image.', fix: 'Make sure it’s a JPG or PNG. If it came from a phone or cloud drive, download it fully first.' },
};

export function typeProblem(kind: Kind, fileName: string): Problem | null {
  if (kind === 'jpg' || kind === 'png') return null;
  const p = { ...WRONG_TYPE[kind] };
  const ext = (fileName.split('.').pop() ?? '').toUpperCase();
  if (kind !== 'empty' && /^(JPE?G|PNG)$/.test(ext)) {
    p.what += ` It’s named “.${ext.toLowerCase()}”, but the file inside isn’t actually a ${ext === 'PNG' ? 'PNG' : 'JPG'}.`;
  }
  return p;
}

export const mb = (n: number) => (n / 1048576).toFixed(1) + ' MB';

export function sizeProblem(bytes: number): Problem | null {
  return bytes > MAX_BYTES
    ? { what: `This file is ${mb(bytes)}, and the limit is 10 MB.`, fix: 'Resize it first: on Mac, Preview › Tools › Adjust Size; on Windows, Photos › Resize. Around 1000 px wide is plenty.' }
    : null;
}

export function headshotDimensionProblem(w: number, h: number, minSide = 200): Problem | null {
  if (Math.min(w, h) < minSide)
    return { what: `This photo is only ${w}×${h} px, so it would look blurry in your signature.`, fix: `Use one at least ${minSide}×${minSide} px. Avoid thumbnails saved from LinkedIn or Slack; use the original photo.` };
  if (w / h > 4 || h / w > 4)
    return { what: `This image is very ${w > h ? 'wide' : 'tall'} (${w}×${h} px), so a square crop would cut most of it off.`, fix: 'Use a portrait or square photo of yourself.' };
  return null;
}

export function logoDimensionProblem(w: number, h: number): Problem | null {
  if (w < 120 && h < 40)
    return { what: `This logo is only ${w}×${h} px, so it would look blurry.`, fix: 'Use a larger version, at least 300 px wide. Your designer or brand guidelines should have one.' };
  if (h / w > 3)
    return { what: `This logo is very tall and narrow (${w}×${h} px).`, fix: 'Use the horizontal version of your logo.' };
  return null;
}

export const multipleFiles = (n: number): Problem => ({ what: `You dropped ${n} files.`, fix: 'Drop just one image.' });
export const nothingDropped: Problem = { what: 'Nothing was dropped.', fix: 'If you dragged an image from a website or app, save it to your computer first, then drag the file in.' };
export const unreadable: Problem = { what: 'We couldn’t open this file.', fix: 'If it’s in iCloud, Google Drive or Dropbox, download it to your computer first, then upload it from there.' };
export const damaged = (kind: Kind): Problem => ({ what: `This ${kind.toUpperCase()} file looks damaged and won’t open.`, fix: 'Open it on your computer to check, then re-save or re-export it and try again.' });
