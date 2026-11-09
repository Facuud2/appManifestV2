const { chromium } = require('/home/facuud2/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs/promises');

const BASE_URL = 'http://localhost:3088';
const SCREENSHOT_PATH = path.resolve(process.cwd(), 'artifacts/playwright-verification/link-preview-test.png');

async function runBrowserTest() {
  console.log('Launching browser for Playwright E2E verification...');
  await fs.mkdir(path.dirname(SCREENSHOT_PATH), { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    console.log('Page loaded successfully.');

    // 1. Click "Escribir manifestación" button on Dashboard
    const openBtn = page.getByRole('button', { name: /Escribir manifestación/i }).first();
    await openBtn.waitFor({ state: 'visible', timeout: 5000 });
    await openBtn.click();
    console.log('Clicked "Escribir manifestación".');
    await page.waitForTimeout(500);

    // 2. Type description with URL into ManifestationEditorModal (leave title empty so auto-title is derived)
    const descTextarea = page.locator('#manifestation-description');
    await descTextarea.waitFor({ state: 'visible', timeout: 5000 });
    const testInput = 'un vinculo ASI https://www.instagram.com/reel/DeVLieIM6hJ/?rpxt=MTZq';
    await descTextarea.fill(testInput);
    console.log('Filled description with test link: ' + testInput);
    await page.waitForTimeout(400);

    // 3. Submit modal
    const saveBtn = page.getByRole('button', { name: /Guardar intención/i });
    await saveBtn.click();
    console.log('Submitted manifestation modal.');
    await page.waitForTimeout(1000);

    // 4. Navigate to "Manifestaciones" tab to view the saved card
    const manifBtn = page.locator('button[title="Manifestaciones"], button[aria-label*="Manifestaciones"]').first();
    await manifBtn.click();
    console.log('Navigated to Manifestaciones view.');
    await page.waitForTimeout(1000);

    // 5. Verify the card title is strictly "un vinculo ASI" (NOT "un vinculo ASI https://www")
    const cardTitle = page.locator('h2:has-text("un vinculo ASI")').first();
    await cardTitle.waitFor({ state: 'visible', timeout: 5000 });
    const titleText = (await cardTitle.textContent())?.trim();
    console.log(`Saved card title verified: "${titleText}"`);
    assert.equal(titleText, 'un vinculo ASI', `Title expected to be "un vinculo ASI" but got "${titleText}"`);

    // 6. Verify that RichLinkPreview card is rendered under it
    const previewContainer = page.locator('.group\\/preview').first();
    await previewContainer.waitFor({ state: 'visible', timeout: 6000 });
    console.log('Verified: RichLinkPreview card is visible!');

    const openLink = previewContainer.getByRole('link', { name: /Abrir/i }).first();
    assert.ok(await openLink.isVisible(), 'Expected "Abrir" link button to be visible in preview card');
    const href = await openLink.getAttribute('href');
    console.log(`External link href: ${href}`);
    assert.ok(href?.includes('instagram.com/reel/DeVLieIM6hJ'), 'Expected href to point to clean Instagram Reel');

    // 7. Save screenshot
    await page.screenshot({ path: SCREENSHOT_PATH, fullPage: false });
    console.log(`Saved verification screenshot to ${SCREENSHOT_PATH}`);

    console.log('ALL PLAYWRIGHT TESTS PASSED SUCCESSFULLY! 🎯');
  } finally {
    await browser.close();
  }
}

runBrowserTest().catch((err) => {
  console.error('Playwright verification error:', err);
  process.exit(1);
});
