/**
 * Photo hosting. The rest of the app only calls `uploadImage`, so swapping provider
 * (or moving to a signed upload through a server function) only touches this file.
 */
import type { UploadConfig } from '../config/types';
import type { Problem } from '../image/check';

export class UploadError extends Error {
  constructor(public problem: Problem) {
    super(problem.what);
  }
}

export async function uploadImage(blob: Blob, cfg: UploadConfig, fileName: string): Promise<string> {
  const fd = new FormData();
  fd.append('file', blob, fileName);
  fd.append('upload_preset', cfg.uploadPreset);
  let res: Response;
  try {
    res = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cfg.cloudName)}/image/upload`, { method: 'POST', body: fd });
  } catch {
    throw new UploadError(
      navigator.onLine
        ? { what: 'Couldn’t reach the photo service.', fix: 'Check your connection. If you’re on a work network, it may be blocking api.cloudinary.com.' }
        : { what: 'You seem to be offline, so the image couldn’t be uploaded.', fix: 'Reconnect to the internet and try again.' },
    );
  }
  let data: { secure_url?: string; error?: { message?: string } } = {};
  try {
    data = await res.json();
  } catch {
    /* non-JSON error page */
  }
  if (res.ok && data.secure_url) return data.secure_url;
  throw new UploadError(explain(data.error?.message ?? `HTTP ${res.status}`));
}

export function explain(m: string): Problem {
  const setup = 'This is a setup issue, not your image. Please let the Heights team know.';
  if (/preset/i.test(m)) return { what: `The photo service rejected the upload settings (${m}).`, fix: setup };
  if (/cloud_name|cloud name|HTTP 401|HTTP 404/i.test(m)) return { what: `The photo service account wasn’t recognised (${m}).`, fix: setup };
  if (/size|large/i.test(m)) return { what: 'The photo service rejected this image as too large.', fix: 'Try a smaller image.' };
  if (/format|type/i.test(m)) return { what: 'The photo service rejected this file type.', fix: 'Use a JPG or PNG.' };
  if (/HTTP 5\d\d/.test(m)) return { what: 'The photo service is having problems right now.', fix: 'Wait a minute and try again.' };
  return { what: `The image couldn’t be uploaded (${m}).`, fix: 'Try again. If it keeps happening, let the Heights team know.' };
}
