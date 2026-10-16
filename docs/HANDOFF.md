# Handover notes

Status of the Heights Email Signature Builder as of 16 Oct 2026. Read this with the README.

## What it is
A web tool where a client's team fills in a form, uploads and crops a headshot, and copies an email signature into Gmail / Outlook / Apple Mail. Static site (Vite + TypeScript, built to one self-contained `index.html`) plus Cloudinary for image hosting. One client settings file per client in `clients/`.

## Where things are
- GitHub: `anastasiia-cherevychna/signature-builder` (public for now; can go private once the Claude GitHub app has push access). Empty until the first push.
- Cloudinary: cloud name `fvkcrpgg`, unsigned upload preset `Signature Tool` (on Anastasiia's personal account; move to Heights later).
- Design: Figma "Heights SaaS", node 3302:11234 (file key `o2RRR4R7ejjII9XjQQUUtM`).
- Hosting: not set up yet. Netlify (free, 300 credits/month, 15 per production deploy) or Vercel (Pro needed for commercial use). `netlify.toml`, `vercel.json` and `public/_redirects` are already in place.

## Working on it
```
npm install
npm test                                         # 32 unit tests
PW_CHROMIUM=/opt/pw-browsers/chromium npm run test:e2e   # 14 browser tests (Cloudinary is simulated)
npm run build                                    # dist/
npm run build:preview                            # dist-preview/ (single-file preview, hosting off)
```
Commit as "Heights Digital <design@heights.digital>".

## Decisions already made (with the client, Anastasiia)
- Form fields and layout follow the Figma frame; labels say "(optional)" except CTA link/colour.
- Contact details are a horizontal row of clickable 28 px icons (email → mailto, website, phone → tel, LinkedIn). Only filled-in fields get an icon.
- Icons: charcoal with a white outline (`icons/<name>.png`) plus solid white versions (`icons/<name>-white.png`) swapped in by a small dark-mode `<style>` block. Gmail strips the style and keeps the outlined ones.
- Logo: preview shows a grey LOGO placeholder until a logo is uploaded (never copied). Uploaded logos are trimmed and baked onto a white box with an 8 px margin and 4 px corners (PNG), so they stay visible in dark mode. A client can lock a fixed logo via `logo` + `locked: ["logo"]`.
- CTA colour has a custom picker with a HEX field (native picker hid hex in Chrome).
- Preview column is sticky on desktop.
- Light/Dark toggle is a preview of dark mode, not a setting.

## Next steps
1. Push this repo to GitHub (`git remote add origin https://github.com/anastasiia-cherevychna/signature-builder && git push -u origin main`).
2. Connect a host to the repo so pushes deploy automatically; start with "straight to live", move to preview-then-publish once clients use it.
3. Before real clients: signed Cloudinary uploads via a small server function (only `src/upload/cloudinary.ts` changes; also enables deleting photos on Remove), move Cloudinary to a Heights account, privacy note / GDPR check, real-inbox tests (`docs/inbox-checklist.md`).
