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
  await expect(preview.locator('img')).toHaveCount(6); // photo, Heights logo, email/website/phone icons, LinkedIn

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
  // 600×100 bar inside an 800×300 transparent canvas → trimmed and fitted to 150 wide
  const logo = page.locator('#previewInner img[alt^="Acme"]');
  await expect(logo).toHaveAttribute('width', '150');
  await expect(logo).toHaveAttribute('height', '25');
  await page.fill('#f-name', 'Jane');
  await page.fill('#f-title', 'CTO');
  await page.check('#noHeadshot', { force: true });
  await page.click('#copyBtn');
  const html = await clipboardHtml(page);
  expect(html).toContain('acme.example'); // locked website comes from the client file
  expect(html).toContain('bgcolor="#1E3A8A"'); // locked CTA colour
  expect(html).toContain(HOSTED); // hosted logo
});

test('the Heights link shows its logo by default, and an uploaded logo replaces it', async ({ page }) => {
  await fakeCloudinary(page);
  await page.goto('/');
  await expect(page.locator('#logoField')).toBeVisible();
  await expect(page.locator('#logoField .hint')).toContainText('Leave empty to use the Heights Digital logo');
  await expect(page.locator('#previewInner img[alt="Heights Digital"]')).toHaveAttribute('src', /clients\/heights\/logo\.png$/);
  await page.locator('#logoField input[type=file]').setInputFiles(fx('logo.png'));
  await expect(page.locator('#logoField .status')).toBeVisible();
  await expect(page.locator('#previewInner img[alt="Heights Digital"]')).toHaveAttribute('src', /^data:image\/jpeg/);
  await page.locator('#logoField [data-remove]').click();
  await expect(page.locator('#previewInner img[alt="Heights Digital"]')).toHaveAttribute('src', /clients\/heights\/logo\.png$/);
});

test('contact icons appear as fields are filled in, and each links to the right place', async ({ page }) => {
  await page.goto('/');
  const icon = (k: string) => page.locator(`#previewInner a:has(img[src$="icons/${k}.png"])`);
  await page.fill('#f-website', '');
  await expect(page.locator('#previewInner img[src*="icons/"]')).toHaveCount(0);
  await page.fill('#f-email', 'jane@company.com');
  await expect(page.locator('#previewInner img[src*="icons/"]')).toHaveCount(1);
  await page.fill('#f-website', 'company.com');
  await page.fill('#f-phone', '+351 912 345 678');
  await page.fill('#f-linkedin', 'linkedin.com/in/jane');
  await expect(icon('email')).toHaveAttribute('href', 'mailto:jane@company.com');
  await expect(icon('website')).toHaveAttribute('href', 'https://company.com/');
  await expect(icon('phone')).toHaveAttribute('href', 'tel:+351912345678');
  await expect(icon('linkedin')).toHaveAttribute('href', 'https://linkedin.com/in/jane');
  // one horizontal row, 24 px icons
  const boxes = await Promise.all(['email', 'website', 'phone', 'linkedin'].map((k) => icon(k).locator('img').boundingBox()));
  expect(new Set(boxes.map((b) => Math.round(b!.y))).size).toBe(1);
  for (const b of boxes) expect(b!.width).toBe(24);
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
  await page.click('[data-theme-btn="dark"]');
  await expect(page.locator('#preview')).toHaveAttribute('data-theme', 'dark');
  await page.click('#install summary');
  await page.click('[data-tab="apple"]');
  await expect(page.locator('[data-panel="apple"]')).toBeVisible();
  await expect(page.locator('[data-panel="gmail"]')).toBeHidden();
});

test('mobile layout has no sideways scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
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
