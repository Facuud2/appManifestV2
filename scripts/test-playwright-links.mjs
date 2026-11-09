import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs/promises';

const BASE_URL = 'http://localhost:3088';
const SCREENSHOT_PATH = path.resolve(process.cwd(), 'artifacts/playwright-verification/link-preview-test.png');

async function runBrowserTest() {
  console.log('Launching browser for Playwright E2E verification...');
  await fs.mkdir(path.dirname(SCREENSHOT_PATH), { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 402, height: 874 }, // iPhone 16 Pro mobile viewport
  });
  const page = await context.newPage();

  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    console.log('Page loaded successfully.');

    // 1. Navigate to Manifestations tab or open Create menu
    const manifTab = page.locator('button:has-text("Manifestaciones"), a:has-text("Manifestaciones")').first();
    if (await manifTab.isVisible()) {
      await manifTab.click();
      await page.waitForTimeout(500);
    }

    // 2. Open quick add composer or plus button
    const openComposerBtn = page.locator('button[aria-label*="Nueva manifestación"], button:has-text("Manifestar")').first();
    if (await openComposerBtn.isVisible()) {
      await openComposerBtn.click();
      await page.waitForTimeout(500);
    }

    // 3. Type text with URL
    const textarea = page.locator('textarea.quick-add-field, textarea[placeholder*="Escribí tu manifestación"]').first();
    await textarea.waitFor({ state: 'visible', timeout: 5000 });
    const testInput = 'un vinculo ASI https://www.instagram.com/reel/DeVLieIM6hJ/?rpxt=MTZq';
    await textarea.fill(testInput);

    console.log('Typed text with Instagram link into composer.');
    await page.waitForTimeout(1000);

    // 4. Verify preview appears in composer
    const composerPreview = page.locator('.group\\/preview, a:has-text("instagram.com")').first();
    await composerPreview.waitFor({ state: 'visible', timeout: 5000 });
    console.log('Verified: Link preview rendered in composer while typing!');

    // 5. Submit manifestation
    const submitBtn = page.locator('.quick-add-submit').first();
    await submitBtn.click();
    await page.waitForTimeout(1000);

    // 6. Verify manifestation in feed
    // The title must be strictly "un vinculo ASI", NOT including "https://www"
    const savedCardTitle = page.locator('h2:has-text("un vinculo ASI")').first();
    await savedCardTitle.waitFor({ state: 'visible', timeout: 5000 });
    const titleText = (await savedCardTitle.textContent())?.trim();

    console.log(`Saved card title: "${titleText}"`);
    assert.equal(titleText, 'un vinculo ASI', `Expected title to be "un vinculo ASI" but got "${titleText}"`);

    // Verify preview card in feed
    const feedPreview = page.locator('.group\\/preview').first();
    await feedPreview.waitFor({ state: 'visible', timeout: 5000 });
    console.log('Verified: RichLinkPreview card rendered on saved manifestation card!');

    // Capture screenshot
    await page.screenshot({ path: SCREENSHOT_PATH, fullPage: false });
    console.log(`Screenshot saved to: ${SCREENSHOT_PATH}`);

    console.log('ALL PLAYWRIGHT TESTS PASSED SUCCESSFULLY! 🎉');
  } finally {
    await browser.close();
  }
}

runBrowserTest().catch((err) => {
  console.error('Playwright verification error:', err);
  process.exit(1);
});
