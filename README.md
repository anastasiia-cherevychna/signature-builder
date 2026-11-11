# Heights Email Signature Builder

A web tool that lets each client's team make a consistent email signature: fill in the form, upload and crop a photo, click **Copy signature**, paste into Gmail or Outlook.

- Live link per client: `signatures.heights.digital/<client>` (or `?client=<client>` anywhere)
- Photos and logos are stored in Cloudinary; everything else runs in the browser
- No database, no logins

## Everyday tasks

### Adding a client

1. Copy `clients/heights.json` to `clients/<client-id>.json` (lowercase, dashes, e.g. `acme-studio`).
2. Change `id` (must match the file name) and `name`.
3. Choose what to pre-fill in `defaults`, what to fix in `locked`, and anything extra in `required`.
4. By default people upload their own logo (the preview shows a LOGO placeholder until they do). To fix one logo for the whole company instead: put a PNG at `public/clients/<client-id>/logo.png`, **2× the display size**, on a white box with an 8 px margin; set `logo.width` / `logo.height` to the display size; and add `"logo"` to `locked`.
5. Run `npm test`. It checks every client file and explains any mistake.
6. Commit. The client's link is `…/<client-id>`.

Field names you can use in `defaults`, `locked` and `required`:
`name, title, headshot, logo, website, email, phone, linkedin, ctaText, ctaLink, ctaColour, quoteText, quoteAuthor`.
Personal fields (`name`, `title`, `headshot`) can't be locked.

### Changing a client's logo or brand colour

- Fixed logo: replace the PNG at the same path. Signatures people already use pick up the new file automatically, because they point at that link. The same goes for the icons in `public/icons/` (`<name>.png` for light, `<name>-white.png` for dark mode).
- Anything else (colours, text, layout): people need to re-copy their signature. Tell the client.

### Releasing a change

1. `npm run check` (unit tests, build, browser tests). All must pass.
2. Check the inbox list in `docs/inbox-checklist.md` for any change to the signature itself (`src/template/`).
3. Push to `main`. The host deploys it.

## Working on the code

```
npm install
npm run dev          # local site at http://localhost:5173  (try /demo-locked or ?client=demo-locked)
npm test             # unit tests (template, client files, form logic)
npm run test:e2e     # browser tests; the photo service is simulated, nothing real is uploaded
npm run build        # production site in dist/
npm run build:preview  # one self-contained HTML file in dist-preview/, for quick review links
```

If Playwright can't find a browser, set `PW_CHROMIUM` to a Chromium executable.

### Where things are

| Folder | What it is |
| --- | --- |
| `clients/` | One settings file per client |
| `public/clients/` | Client logos (served at a fixed public link) |
| `src/template/` | **The email signature HTML.** The fragile part; read the rules at the top of `signature.ts` before changing it |
| `src/builder/` | The form: field list (`fields.ts`), form → signature data (`data.ts`), upload boxes |
| `src/image/` | File checks with plain-language errors, crop dialog, resizing |
| `src/upload/` | Photo hosting (Cloudinary). The only file to change to switch provider or move to signed uploads |
| `src/config/` | Client file format and loading |
| `src/styles/tokens.css` | Colours, type and spacing from Figma |
| `tests/` | `unit/` (Vitest) and `e2e/` (Playwright) |

### Adding a form field

1. Add it to `FIELDS` in `src/builder/fields.ts` (label, placeholder, section, check).
2. Add its key to `FieldKey` in `src/config/types.ts`.
3. Map it in `toSignatureData` (`src/builder/data.ts`) and render it in `src/template/signature.ts`.
4. Add a test in `tests/unit/signature.test.ts`.

## Hosting

Any static host works. It needs:
- build command `npm test && npm run build`, output folder `dist` (so a change that breaks the unit tests never goes live)
- every unknown path (e.g. `/acme`) served by `index.html`. `netlify.toml` and `vercel.json` already do this.

## Before launch (not done yet)

- **Signed uploads.** Uploads currently use an *unsigned* Cloudinary preset, so anyone who finds the page could upload images to the account. Add a small server function that signs uploads, and lets **Remove** delete the photo. Only `src/upload/cloudinary.ts` changes.
- **Cloudinary account** is on a personal login; move it to Heights before clients use it.
- **Privacy note and GDPR check** for headshots.
- **Real inbox tests**: `docs/inbox-checklist.md`.
