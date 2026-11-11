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
- Icon style (added 11 Nov 2026): the contact icons come in Solid (the original, default) and Outline (Figma frame "Upload", node 8215:1579 in the CarbonChain file: thin charcoal and white outlines, no white edge). Outline files are in `public/icons/outline/<name>[-white].png` (56 × 56, shown at 28); Solid keeps its original paths in `public/icons/` because emails people already sent link to them, so never move or rename those. `ICON_PATH(key, mode, style)` in `src/builder/data.ts` is the only place that knows the folders; the signature template just receives links, so the dark-mode swap and text-link fallback work for every style. The control ("Icon style: Solid | Outline") is at the bottom of Contact & Social links. A client file can set the starting style (`iconStyle`) and hide the control (`iconStyleLocked`); it's a form setting otherwise, so it's not remembered between visits. To add a style: put its 8 PNGs in `public/icons/<style>/`, add the name to `IconStyle`/`ICON_STYLES` in `src/config/types.ts` and a button in `index.html`. Outline caveat: with no white edge, charcoal outline icons are hard to see in Gmail's dark mode, which ignores the dark-mode swap; check it and consider a mid-grey stroke if the designer agrees. The Outline website icon is a plain globe (the Solid one has a pointer arrow); that's intentional for now.
- Logo: preview shows a grey LOGO placeholder until a logo is uploaded (never copied). Uploaded logos are trimmed and baked onto a white box with an 8 px margin and 4 px corners (PNG), so they stay visible in dark mode. A client can lock a fixed logo via `logo` + `locked: ["logo"]`.
- CTA colour has a custom picker with a HEX field (native picker hid hex in Chrome).
- Preview column is sticky on desktop.
- Light/Dark toggle is a preview of dark mode, not a setting.

## Next steps
1. Push this repo to GitHub (`git remote add origin https://github.com/anastasiia-cherevychna/signature-builder && git push -u origin main`).
2. Connect a host to the repo so pushes deploy automatically; start with "straight to live", move to preview-then-publish once clients use it.
3. Before real clients: signed Cloudinary uploads via a small server function (only `src/upload/cloudinary.ts` changes; also enables deleting photos on Remove), move Cloudinary to a Heights account, privacy note / GDPR check, real-inbox tests (`docs/inbox-checklist.md`).
