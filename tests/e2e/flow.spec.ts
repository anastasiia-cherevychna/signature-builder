import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';

const fx = (f: string) => path.join(import.meta.dirname, 'fixtures', f);
const HOSTED = 'https://res.cloudinary.com/fvkcrpgg/image/upload/v1/test.jpg';

/** Simulated Cloudinary: records uploads, never touches the real account. */
async function fakeCloudinary(page: Page, fail?: string) {
  const uploads: string[] = [];
  await page.route('https://api.cloudinary.com/**', async (route) => {
    uploads.push(route.request().url());
    if (fail) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ error: { message: fail } }) });
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ secure_url: HOSTED }) });
  });
  return uploads;
}
const clipboardHtml = (page: Page) =>
  page.evaluate(async () => {
    const [item] = await navigator.clipboard.read();
    return (await item.getType('text/html')).text();
  });

async function addPhoto(page: Page) {
  await page.locator('#headshotField input[type=file]').setInputFiles(fx('photo.jpg'));
  await expect(page.locator('#cropDialog')).toBeVisible();
  await page.locator('#cropDialog [data-apply]').click();
  await expect(page.locator('#headshotField .status')).toBeVisible();
}

test('full signature: fill in, photo, copy with hosted photo', async ({ page }) => {
  const uploads = await fakeCloudinary(page);
  await page.goto('/');
  await page.fill('#f-name', 'Anastasiia Cherevychna');
  await page.fill('#f-title', 'Designer');
  await addPhoto(page);
  await page.fill('#f-email', 'name@heights.digital');
  await page.fill('#f-phone', '+351 912 345 678');
  await page.fill('#f-linkedin', 'linkedin.com/in/someone');
  await page.fill('#f-ctaText', 'Book a call');
  await page.fill('#f-ctaLink', 'calendly.com/heights');
  await page.fill('#f-quoteText', 'Some deep and smart optional quote here');
  await page.fill('#f-quoteAuthor', 'Someone’s name');

  const preview = page.locator('#previewInner');
  await expect(preview).toContainText('Anastasiia Cherevychna');
  await expect(preview).toContainText('Book a call');
  await expect(preview.locator('img:visible')).toHaveCount(5); // photo + 4 contact icons (logo is a placeholder until uploaded)

  await page.click('#copyBtn');
  await expect(page.locator('#actionMsg')).toContainText('Copied');
  expect(uploads).toHaveLength(1);
  expect(uploads[0]).toContain('/v1_1/fvkcrpgg/image/upload');
  const html = await clipboardHtml(page);
  expect(html).toContain(HOSTED);
  expect(html).toContain('href="https://linkedin.com/in/someone"');
  expect(html).toContain('href="https://calendly.com/heights"');
  expect(html).toContain('bgcolor="#CAFC3B"');
  expect(html).not.toContain('data:image');
  await expect(page.locator('#install')).toHaveAttribute('open', '');
  await page.screenshot({ path: 'test-results/full.png', fullPage: true });
});

test('blocks copying until required fields and photo are there, and says why', async ({ page }) => {
  await fakeCloudinary(page);
  await page.goto('/');
  await page.click('#copyBtn');
  await expect(page.locator('#actionMsg')).toContainText('name, job title, headshot');
  await expect(page.locator('#f-name-err')).toHaveText('Add your name.');
  await page.fill('#f-name', 'Jane');
  await page.fill('#f-title', 'CTO');
  await page.check('#noHeadshot', { force: true });
  await page.fill('#f-email', 'jane@company');
  await page.click('#copyBtn');
  await expect(page.locator('#f-email-err')).toContainText('looks incomplete');
  await page.fill('#f-email', 'jane@company.com');
  await page.click('#copyBtn');
  await expect(page.locator('#actionMsg')).toContainText('Copied');
  expect(await clipboardHtml(page)).not.toContain('<img src="https://res');
});

test('explains file problems', async ({ page }) => {
  await page.goto('/');
  const input = page.locator('#headshotField input[type=file]');
  await input.setInputFiles(fx('small.png'));
  await expect(page.locator('#headshotField .error')).toContainText('only 150×150 px');
  await input.setInputFiles(fx('actually-webp.jpg'));
  await expect(page.locator('#headshotField .error')).toContainText('WebP');
  await expect(page.locator('#headshotField .error')).toContainText('isn’t actually a JPG');
});

test('upload setup problems are reported as setup issues', async ({ page }) => {
  await fakeCloudinary(page, 'Upload preset not found');
  await page.goto('/');
  await addPhotoExpectingError(page);
  await expect(page.locator('#headshotField .error')).toContainText('setup issue');
});
async function addPhotoExpectingError(page: Page) {
  await page.locator('#headshotField input[type=file]').setInputFiles(fx('photo.jpg'));
  await page.locator('#cropDialog [data-apply]').click();
}

test('locked fields are hidden, and an uploaded logo is trimmed, put on white and hosted', async ({ page }) => {
  const uploads = await fakeCloudinary(page);
  await page.goto('/?client=demo-locked');
  await expect(page.locator('[data-field="website"]')).toBeHidden();
  await expect(page.locator('[data-field="ctaColour"]')).toBeHidden();
  await page.locator('#logoField input[type=file]').setInputFiles(fx('logo.png'));
  await expect(page.locator('#logoField .status')).toBeVisible();
  expect(uploads).toHaveLength(1);
  // 600×100 bar inside an 800×300 transparent canvas → trimmed, fitted to 142 wide, plus an 8 px white margin
  const logo = page.locator('#previewInner img[alt^="Acme"]');
  await expect(logo).toHaveAttribute('width', '158');
  await expect(logo).toHaveAttribute('height', '40');
  const px = await logo.evaluate(async (img: HTMLImageElement) => {
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    const x = c.getContext('2d')!; x.drawImage(img, 0, 0);
    const at = (a: number, b: number) => [...x.getImageData(a, b, 1, 1).data];
    return { margin: at(10, 40), corner: at(0, 0), bar: at(c.width / 2, c.height / 2), size: [c.width, c.height] };
  });
  expect(px.size).toEqual([316, 80]);
  expect(px.margin).toEqual([255, 255, 255, 255]); // white margin, even where the original was transparent
  expect(px.corner[3]).toBe(0); // rounded corner
  expect(px.bar.slice(0, 3)).toEqual([30, 58, 138]); // the logo itself
  await page.fill('#f-name', 'Jane');
  await page.fill('#f-title', 'CTO');
  await page.check('#noHeadshot', { force: true });
  await page.click('#copyBtn');
  await expect(page.locator('#actionMsg')).toContainText('Copied'); // copying is async; wait before reading the clipboard
  const html = await clipboardHtml(page);
  expect(html).toContain('acme.example'); // locked website comes from the client file
  expect(html).toContain('bgcolor="#1E3A8A"'); // locked CTA colour
  expect(html).toContain(HOSTED); // hosted logo
});

test('the logo shows a placeholder until one is uploaded', async ({ page }) => {
  await fakeCloudinary(page);
  await page.goto('/');
  await expect(page.locator('#logoField')).toBeVisible();
  await expect(page.locator('#previewInner [data-placeholder="logo"]')).toHaveText('LOGO');
  await page.locator('#logoField input[type=file]').setInputFiles(fx('logo.png'));
  await expect(page.locator('#logoField .status')).toBeVisible();
  await expect(page.locator('#previewInner [data-placeholder="logo"]')).toHaveCount(0);
  await expect(page.locator('#previewInner img[alt="Heights Digital"]')).toHaveAttribute('src', /^data:image\/png/);
  await page.locator('#logoField [data-remove]').click();
  await expect(page.locator('#previewInner [data-placeholder="logo"]')).toBeVisible();
});

test('icons turn solid white in the dark preview', async ({ page }) => {
  await page.goto('/');
  await page.fill('#f-email', 'jane@company.com');
  await expect(page.locator('#previewInner .hs-ic-l[src$="icons/email.png"]')).toBeVisible();
  await expect(page.locator('#previewInner .hs-ic-d')).toHaveCount(2); // email + default website
  await expect(page.locator('#previewInner .hs-ic-d').first()).toBeHidden();
  await page.click('[data-theme-btn="dark"]');
  await expect(page.locator('#previewInner .hs-ic-d[src$="icons/email-white.png"]')).toBeVisible();
  await expect(page.locator('#previewInner .hs-ic-l').first()).toBeHidden();
});

/** Fills all four contact fields so all four icons show. */
async function fillContacts(page: Page) {
  await page.fill('#f-email', 'jane@company.com');
  await page.fill('#f-website', 'company.com');
  await page.fill('#f-phone', '+351 912 345 678');
  await page.fill('#f-linkedin', 'linkedin.com/in/jane');
  await expect(page.locator('#previewInner img.hs-ic-l')).toHaveCount(4); // the preview redraws a frame later
}
const ICON_KEYS = ['email', 'website', 'phone', 'linkedin'];
/** Every icon image in the preview (light and dark) actually loads, at the 56 px the files are made at. */
const iconsLoad = (page: Page) =>
  page.evaluate(async () => {
    const imgs = [...document.querySelectorAll<HTMLImageElement>('#previewInner img.hs-ic-l, #previewInner img.hs-ic-d')];
    await Promise.all(imgs.map((i) => i.decode().catch(() => undefined)));
    return imgs.map((i) => [i.getAttribute('src')!.replace(/^.*\/icons\//, ''), i.naturalWidth, i.naturalHeight]);
  });

test('icon style: Solid by default, with the control at the bottom of Contact & Social links', async ({ page }) => {
  await page.goto('/');
  const control = page.locator('#iconStyleField');
  await expect(control.locator('.label')).toHaveText('Icon style');
  await expect(control.locator('button')).toHaveText(['Solid', 'Outline']);
  await expect(page.locator('[data-icon-style="solid"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-icon-style="outline"]')).toHaveAttribute('aria-pressed', 'false');
  // inside the Contact group, below its last field (LinkedIn) and above the next group
  const y = async (sel: string) => (await page.locator(sel).boundingBox())!.y;
  await expect(page.locator('[data-section="contact"] #iconStyleField')).toHaveCount(1);
  expect(await y('#f-linkedin')).toBeLessThan(await y('#iconStyleField'));
  expect(await y('#iconStyleField')).toBeLessThan(await y('[data-section="extra"]'));
  // Solid icons are the original files
  await fillContacts(page);
  const loaded = await iconsLoad(page);
  expect(loaded.map((l) => l[0]).sort()).toEqual(ICON_KEYS.flatMap((k) => [`${k}-white.png`, `${k}.png`]).sort());
  for (const [, w, h] of loaded) expect([w, h]).toEqual([56, 56]);
});

test('icon style: Outline swaps all four icons, in light and dark, and back again', async ({ page }) => {
  await page.goto('/');
  await fillContacts(page);
  const light = (dir: string) => page.locator(`#previewInner img.hs-ic-l[src*="${dir}"]`);
  await expect(light('/icons/outline/')).toHaveCount(0);

  await page.click('[data-icon-style="outline"]');
  await expect(page.locator('[data-icon-style="outline"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-icon-style="solid"]')).toHaveAttribute('aria-pressed', 'false');
  await expect(light('/icons/outline/')).toHaveCount(4);
  const loaded = await iconsLoad(page);
  expect(loaded.map((l) => l[0]).sort()).toEqual(ICON_KEYS.flatMap((k) => [`outline/${k}-white.png`, `outline/${k}.png`]).sort());
  for (const [, w, h] of loaded) expect([w, h]).toEqual([56, 56]);
  // same row, same size, same links as Solid
  for (const k of ICON_KEYS) {
    const box = (await page.locator(`#previewInner img.hs-ic-l[src$="outline/${k}.png"]`).boundingBox())!;
    expect([Math.round(box.width), Math.round(box.height)]).toEqual([28, 28]);
  }
  await expect(page.locator('#previewInner a[href="mailto:jane@company.com"]')).toHaveCount(1);
  // dark preview: the white outline icons swap in
  await page.click('[data-theme-btn="dark"]');
  await expect(page.locator('#previewInner img.hs-ic-d[src$="outline/email-white.png"]')).toBeVisible();
  await expect(page.locator('#previewInner img.hs-ic-l').first()).toBeHidden();
  await page.click('[data-theme-btn="light"]');

  // back to Solid: the original files again
  await page.click('[data-icon-style="solid"]');
  await expect(light('/icons/outline/')).toHaveCount(0);
  await expect(page.locator('#previewInner img.hs-ic-l[src$="icons/email.png"]')).toBeVisible();
});

test('icon style: a client can start on Outline, or fix the style', async ({ page }) => {
  // starts on Outline, and people can still change it
  await page.goto('/?client=demo-outline');
  await expect(page.locator('#iconStyleField')).toBeVisible();
  await expect(page.locator('[data-icon-style="outline"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#previewInner img.hs-ic-l[src$="outline/website.png"]')).toBeVisible(); // website is filled in by default
  await page.click('[data-icon-style="solid"]');
  await expect(page.locator('#previewInner img.hs-ic-l[src$="icons/website.png"]')).toBeVisible();

  // fixed: no control, Outline always
  await page.goto('/?client=demo-outline-locked');
  await expect(page.locator('#iconStyleField')).toBeHidden();
  await expect(page.locator('#previewInner img.hs-ic-l[src$="outline/website.png"]')).toBeVisible();
  // and the section is still there for its fields
  await expect(page.locator('[data-section="contact"]')).toBeVisible();
});

test('icon style: copying warns, as for Solid, when the icons can’t be public (local run)', async ({ page }) => {
  await fakeCloudinary(page);
  await page.goto('/');
  await page.fill('#f-name', 'Jane');
  await page.fill('#f-title', 'CTO');
  await page.check('#noHeadshot', { force: true });
  await page.fill('#f-email', 'jane@company.com');
  await page.click('[data-icon-style="outline"]');
  await page.click('#copyBtn');
  await expect(page.locator('#actionMsg')).toContainText('Copied');
  const html = await clipboardHtml(page);
  expect(html).not.toContain('/icons/'); // local addresses never go into an email
  expect(html).toContain('>jane@company.com</span>'); // the text link takes the icon's place
});

test('contact icons appear as fields are filled in, and each links to the right place', async ({ page }) => {
  await page.goto('/');
  const icon = (k: string) => page.locator(`#previewInner a:has(img.hs-ic-l[src$="icons/${k}.png"])`);
  await page.fill('#f-website', '');
  await expect(page.locator('#previewInner img.hs-ic-l')).toHaveCount(0);
  await page.fill('#f-email', 'jane@company.com');
  await expect(page.locator('#previewInner img.hs-ic-l')).toHaveCount(1);
  await page.fill('#f-website', 'company.com');
  await page.fill('#f-phone', '+351 912 345 678');
  await page.fill('#f-linkedin', 'linkedin.com/in/jane');
  await expect(icon('email')).toHaveAttribute('href', 'mailto:jane@company.com');
  await expect(icon('website')).toHaveAttribute('href', 'https://company.com/');
  await expect(icon('phone')).toHaveAttribute('href', 'tel:+351912345678');
  await expect(icon('linkedin')).toHaveAttribute('href', 'https://linkedin.com/in/jane');
  // one horizontal row, 28 px icons
  const boxes = await Promise.all(['email', 'website', 'phone', 'linkedin'].map((k) => icon(k).locator('img.hs-ic-l').boundingBox()));
  expect(new Set(boxes.map((b) => Math.round(b!.y))).size).toBe(1);
  for (const b of boxes) expect(b!.width).toBe(28);
  await page.locator('#preview').screenshot({ path: 'test-results/icons-row.png' });
});

test('the preview stays on screen while the form scrolls', async ({ page }) => {
  await page.goto('/');
  await page.locator('#f-quoteAuthor').scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const box = await page.locator('#preview').boundingBox();
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeLessThan(200);
  await page.screenshot({ path: 'test-results/sticky.png' });
});

test('unknown client links say so', async ({ page }) => {
  await page.goto('/?client=nobody');
  await expect(page.locator('#banner')).toContainText('isn’t set up');
  await expect(page.locator('#app')).toBeHidden();
});

test('dark preview and install tabs', async ({ page }) => {
  await page.goto('/');
  await page.fill('#f-email', 'jane@company.com');
  await page.fill('#f-linkedin', 'linkedin.com/in/jane');
  await page.click('[data-theme-btn="dark"]');
  await page.locator('#preview').screenshot({ path: 'test-results/dark-icons.png' });
  await expect(page.locator('#preview')).toHaveAttribute('data-theme', 'dark');
  await page.click('#install summary');
  await page.click('[data-tab="apple"]');
  await expect(page.locator('[data-panel="apple"]')).toBeVisible();
  await expect(page.locator('[data-panel="gmail"]')).toBeHidden();
});

test('mobile layout has no sideways scrolling', async ({ page }) => {
  for (const width of [390, 360]) { // iPhone; common Android width
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `sideways scroll at ${width} px`).toBeLessThanOrEqual(0);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/mobile.png', fullPage: true });
});

test('screenshots for design review', async ({ page }) => {
  await fakeCloudinary(page);
  await page.goto('/');
  await page.fill('#f-name', 'Anastasiia Cherevychna');
  await page.fill('#f-title', 'Designer');
  await page.screenshot({ path: 'test-results/empty-photo.png', clip: { x: 600, y: 170, width: 740, height: 480 } });
  await addPhoto(page);
  await page.fill('#f-quoteText', 'Some deep and smart optional quote here');
  await page.fill('#f-quoteAuthor', 'Someone’s name');
  await page.screenshot({ path: 'test-results/design-match.png', clip: { x: 600, y: 170, width: 740, height: 520 } });
  await page.click('[data-theme-btn="dark"]');
  await page.screenshot({ path: 'test-results/dark.png', clip: { x: 600, y: 170, width: 740, height: 520 } });
});

test('CTA colour picker has a hex field that stays in sync', async ({ page }) => {
  await page.goto('/');
  await page.click('.swatch');
  const hex = page.locator('.cp-hex');
  await expect(hex).toBeVisible();
  await expect(hex).toHaveValue('#CAFC3B');
  await hex.fill('#1E3A8A');
  await expect(page.locator('#f-ctaColour')).toHaveValue('#1E3A8A');
  // dragging in the shade square updates both the hex field and the form
  const sv = await page.locator('.cp-sv').boundingBox();
  await page.mouse.click(sv!.x + sv!.width * 0.9, sv!.y + sv!.height * 0.1);
  const picked = await hex.inputValue();
  expect(picked).toMatch(/^#[0-9A-F]{6}$/);
  expect(picked).not.toBe('#1E3A8A');
  await expect(page.locator('#f-ctaColour')).toHaveValue(picked);
  await page.locator('.cp').screenshot({ path: 'test-results/picker.png' });
  await hex.fill('zz');
  await hex.press('Enter');
  await expect(page.locator('.cp')).toBeHidden();
  await expect(page.locator('#f-ctaColour')).toHaveValue(picked);
  // typing straight into the field still works too
  await page.fill('#f-ctaColour', '#FE6C23');
  await expect(page.locator('.swatch')).toHaveCSS('background-color', 'rgb(254, 108, 35)');
});
