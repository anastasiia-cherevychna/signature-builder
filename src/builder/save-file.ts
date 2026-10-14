/**
 * Saves a generated file. On the live site this is a normal browser download.
 * Inside a claude.ai preview link, plain downloads are blocked, so it asks the
 * viewer through the preview's own save prompt instead.
 */
interface PreviewDownloads {
  save(r: { filename: string; data: string | Blob }): Promise<{ status: string }>;
}
type PreviewHost = { use(name: 'downloads'): Promise<PreviewDownloads | null> };

export type SaveOutcome = 'saved' | 'declined' | 'unavailable';

export async function saveFile(filename: string, data: string, type = 'text/html'): Promise<SaveOutcome> {
  const host = (window as unknown as { claude?: PreviewHost }).claude;
  if (import.meta.env.MODE === 'preview' && host?.use) {
    const downloads = await host.use('downloads').catch(() => null);
    if (downloads) {
      try {
        await downloads.save({ filename, data });
        return 'saved';
      } catch (e) {
        return (e as { code?: string })?.code === 'declined' ? 'declined' : 'unavailable';
      }
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([data], { type }));
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  return 'saved';
}
