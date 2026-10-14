/** Wires one upload box (headshot or logo): drag & drop, browse, progress, done state, errors. */
import { multipleFiles, nothingDropped, type Problem } from '../image/check';

type State = 'empty' | 'working' | 'done';

export interface UploadField {
  show(state: State): void;
  progress(text: string, pct: number): void;
  done(thumb: string, fileName: string): void;
  error(p: Problem | null): void;
  setDisabled(off: boolean): void;
  root: HTMLElement;
}

export function createUploadField(root: HTMLElement, onFile: (f: File) => void, handlers: { remove: () => void; recrop?: () => void }): UploadField {
  const q = <T extends HTMLElement>(s: string) => root.querySelector(s) as T;
  const drop = q<HTMLDivElement>('[data-state="empty"]');
  const working = q<HTMLDivElement>('[data-state="working"]');
  const done = q<HTMLDivElement>('[data-state="done"]');
  const err = q<HTMLDivElement>('.error');
  const input = q<HTMLInputElement>('input[type=file]');

  root.querySelectorAll<HTMLButtonElement>('[data-browse]').forEach((b) => b.addEventListener('click', () => input.click()));
  input.addEventListener('change', () => {
    const f = input.files?.[0];
    input.value = '';
    if (f) onFile(f);
  });
  q<HTMLButtonElement>('[data-remove]').addEventListener('click', handlers.remove);
  root.querySelector<HTMLButtonElement>('[data-recrop]')?.addEventListener('click', () => handlers.recrop?.());

  const over = (on: boolean) => drop.classList.toggle('over', on);
  drop.addEventListener('dragenter', (e) => { e.preventDefault(); over(true); });
  drop.addEventListener('dragover', (e) => { e.preventDefault(); over(true); });
  drop.addEventListener('dragleave', (e) => { if (!drop.contains(e.relatedTarget as Node)) over(false); });
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    over(false);
    const fs = e.dataTransfer?.files;
    if (!fs || !fs.length) return api.error(nothingDropped);
    if (fs.length > 1) return api.error(multipleFiles(fs.length));
    onFile(fs[0]);
  });

  const api: UploadField = {
    root,
    show(state) {
      drop.hidden = state !== 'empty';
      working.hidden = state !== 'working';
      done.hidden = state !== 'done';
    },
    progress(text, pct) {
      api.show('working');
      q<HTMLSpanElement>('[data-working-text]').textContent = text;
      q<HTMLElement>('.bar i').style.width = `${pct}%`;
    },
    done(thumb, fileName) {
      q<HTMLImageElement>('.thumb').src = thumb;
      q<HTMLSpanElement>('.file-name').textContent = fileName;
      api.show('done');
    },
    error(p) {
      err.replaceChildren();
      if (!p) return;
      const a = document.createElement('strong');
      a.textContent = p.what;
      const b = document.createElement('span');
      b.textContent = p.fix;
      err.append(a, b);
    },
    setDisabled(off) {
      [drop, working, done].forEach((el) => el.classList.toggle('off', off));
      root.querySelector('.label .req')?.toggleAttribute('hidden', off);
      drop.style.display = working.style.display = done.style.display = off ? 'none' : '';
      if (off) api.error(null);
    },
  };
  return api;
}

// Stop the browser from opening a file dropped outside the boxes.
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => e.preventDefault());
