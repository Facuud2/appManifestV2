const { chromium } = require('playwright');
const fs = require('node:fs/promises');
const path = require('node:path');

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3044';
const SCREENSHOT_DIR = path.resolve(process.cwd(), 'artifacts/playwright-verification');

const POETIC_FORBIDDEN = [
  'fluir',
  'pecho',
  'latido',
  'sagrado',
  'vibrar',
  'frecuencia',
  'sintonizar',
  'sendero',
  'brisa',
  'respiro hondo',
  'abro mis brazos',
  'gratitud',
  'orquestó',
  'certeza plena',
  'luz',
];

const VIEWPORTS = [
  { name: 'iphone-16-pro', width: 402, height: 874 },
  { name: 'ipad-11', width: 834, height: 1194 },
  { name: 'mac-desktop', width: 1440, height: 900 },
];

async function runVerification() {
  await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });

  const summary = {
    viewports: {},
    rampageVerification: null,
    tursoRelationalVerification: null,
  };

  try {
    // 1. Multi-viewport visual & selector verification (iPhone 16 Pro 402x874, iPad 11" 834x1194, Mac 1440x900)
    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
      });
      const page = await context.newPage();
      await page.goto(BASE_URL, { waitUntil: 'networkidle' });

      // Screenshot home view
      const homeShot = path.join(SCREENSHOT_DIR, `${vp.name}-home.png`);
      await page.screenshot({ path: homeShot, fullPage: false });

      // Open Rampage creator
      const openRampageBtn = page
        .getByRole('button', { name: /Nuevo Rampage|Abrir Rampage/i })
        .first();
      await openRampageBtn.click();

      const mode5 = page.getByTestId('rampage-mode-5');
      const mode11 = page.getByTestId('rampage-mode-11');
      const mode15 = page.getByTestId('rampage-mode-15');

      await mode11.waitFor({ state: 'visible', timeout: 10000 });
      await page.waitForTimeout(400);

      const is5Visible = await mode5.isVisible();
      const is11Visible = await mode11.isVisible();
      const is15Visible = await mode15.isVisible();
      const is11CheckedByDefault = (await mode11.getAttribute('aria-checked')) === 'true';

      const creatorShot = path.join(SCREENSHOT_DIR, `${vp.name}-rampage-creator.png`);
      await page.screenshot({ path: creatorShot, fullPage: false });

      summary.viewports[vp.name] = {
        dimensions: `${vp.width}x${vp.height}`,
        is5Visible,
        is11Visible,
        is15Visible,
        is11CheckedByDefault,
        screenshots: [homeShot, creatorShot],
      };

      if (!is5Visible || !is11Visible || !is15Visible || !is11CheckedByDefault) {
        throw new Error(
          `[${vp.name}] Falló verificación del selector 5/11/15 con 11 por defecto: ${JSON.stringify(
            summary.viewports[vp.name]
          )}`
        );
      }

      await context.close();
    }

    // 2. Deep verification of 11-Affirmation Rampage:
    //    - 1 single POST to /api/ai/rampage
    //    - 11 direct Law of Assumption affirmations (0 poetic words)
    //    - Cycle all 11 affirmations -> after affirmation 11, loops from cache with breathing pauses and 0 extra network calls
    {
      const context = await browser.newContext({
        viewport: { width: 402, height: 874 },
      });
      const page = await context.newPage();

      const rampageApiCalls = [];
      const ttsApiCalls = [];

      page.on('request', (req) => {
        if (req.url().includes('/api/ai/rampage') && req.method() === 'POST') {
          rampageApiCalls.push({
            url: req.url(),
            postData: req.postDataJSON?.() ?? req.postData(),
            timestamp: Date.now(),
          });
        }
        if (
          (req.url().includes('/api/ai/tts') || req.url().includes('/api/ai/voice-synthesize')) &&
          req.method() === 'POST'
        ) {
          ttsApiCalls.push({
            url: req.url(),
            timestamp: Date.now(),
          });
        }
      });

      let rampageResponseJson = null;
      page.on('response', async (res) => {
        if (res.url().includes('/api/ai/rampage') && res.request().method() === 'POST') {
          try {
            rampageResponseJson = await res.json();
          } catch {
            // ignore
          }
        }
      });

      await page.goto(BASE_URL, { waitUntil: 'networkidle' });

      // Open Rampage creator
      await page
        .getByRole('button', { name: /Nuevo Rampage|Abrir Rampage/i })
        .first()
        .click();
      await page.getByTestId('rampage-mode-11').waitFor({ state: 'visible' });

      // Use mic dictation on topic input (in Playwright Sandbox mode it transcribes automatically)
      const topicMicBtn = page
        .locator('form')
        .getByRole('button', { name: /Dictar por voz|Dictar con IA/i })
        .first();
      await topicMicBtn.click();

      // Ensure topic & nuances include SP + self-concept
      await page.locator('#rampage-topic').fill('Soy Dios y SP me ama');
      await page
        .locator('#rampage-details')
        .fill('Soy siempre la primera opción de SP y mantenemos un vínculo increíble');

      // Start 11-affirmation Rampage
      await page.getByTestId('rampage-start-button').click();

      // Wait for /api/ai/rampage response and active affirmation to appear
      await page.waitForFunction(
        () => {
          const el = document.querySelector('[data-testid="rampage-progress-counter"]');
          return el && el.textContent && el.textContent.includes('/11');
        },
        { timeout: 15000 }
      );

      // Wait a moment for background staggered TTS preloads to finish
      await page.waitForTimeout(2500);

      const affirmations = rampageResponseJson?.data?.affirmations || [];
      if (affirmations.length !== 11) {
        throw new Error(`Expected 11 affirmations, got ${affirmations.length}`);
      }

      // Check zero poetic words
      const lowerJoined = affirmations.join(' | ').toLowerCase();
      const foundPoetic = POETIC_FORBIDDEN.filter((word) => lowerJoined.includes(word));
      if (foundPoetic.length > 0) {
        throw new Error(`Found forbidden poetic words in affirmations: ${foundPoetic.join(', ')}`);
      }

      const activePlayerShot = path.join(SCREENSHOT_DIR, 'iphone-16-pro-rampage-playing.png');
      await page.screenshot({ path: activePlayerShot });

      // Advance through all 11 affirmations to complete Cycle 1 and enter Cycle 2 (Organic Shuffle from Cache)
      const skipBtn = page.getByRole('button', { name: 'Siguiente afirmación' });
      const ttsCallsBeforeCycle2 = ttsApiCalls.length;
      const rampageCallsBeforeCycle2 = rampageApiCalls.length;

      for (let step = 0; step < 11; step += 1) {
        await skipBtn.click();
        await page.waitForTimeout(120);
      }

      // Wait for cycle badge to show Vuelta 2 (completedCyclesCount >= 1)
      await page.waitForSelector('[data-testid="rampage-cycle-badge"]', { timeout: 10000 });
      const cycleBadgeText = await page.getByTestId('rampage-cycle-badge').textContent();

      // Wait for current affirmation audio (~1.8s) to finish naturally so we also observe the variable breathing pause (2.5s - 4.5s)
      await page.waitForFunction(
        () => {
          const dialog = document.querySelector('[role="dialog"][data-breathing-pause="true"]');
          return Boolean(dialog);
        },
        { timeout: 10000 }
      );
      const statusDuringBreathingPause = await page
        .getByTestId('rampage-status-pill')
        .textContent();

      // Wait 1.5s into the breathing pause and verify 0 extra /api/ai/rampage or /api/ai/tts calls happened during Cycle 2
      await page.waitForTimeout(1500);
      const rampageCallsAfterCycle2 = rampageApiCalls.length;
      const ttsCallsAfterCycle2 = ttsApiCalls.length;

      if (rampageCallsBeforeCycle2 !== 1 || rampageCallsAfterCycle2 !== 1) {
        throw new Error(
          `Expected exactly 1 call to /api/ai/rampage, got ${rampageCallsAfterCycle2}`
        );
      }
      if (ttsCallsAfterCycle2 !== ttsCallsBeforeCycle2) {
        throw new Error(
          `Expected 0 additional TTS calls on Cycle 2, but ${
            ttsCallsAfterCycle2 - ttsCallsBeforeCycle2
          } new calls were made.`
        );
      }

      summary.rampageVerification = {
        totalRampageApiCalls: rampageCallsAfterCycle2,
        affirmationCount: affirmations.length,
        sampleAffirmations: affirmations.slice(0, 5),
        forbiddenPoeticWordsFound: foundPoetic,
        cycleBadgeText: cycleBadgeText?.trim(),
        statusDuringBreathingPause: statusDuringBreathingPause?.trim(),
        additionalApiCallsInCycle2:
          rampageCallsAfterCycle2 -
          rampageCallsBeforeCycle2 +
          (ttsCallsAfterCycle2 - ttsCallsBeforeCycle2),
      };

      await context.close();
    }

    // 3. Verify Manifestaciones, Avances & Success Stories with Voice Dictation + Turso DB relational persistence
    {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
      });
      const page = await context.newPage();
      await page.goto(BASE_URL, { waitUntil: 'networkidle' });

      // Go to Manifestaciones tab
      await page.getByRole('button', { name: /Manifestaciones/i }).first().click();
      await page
        .getByRole('button', { name: /Nueva manifestación|Crear manifestación/i })
        .first()
        .click();

      // Use mic button on Manifestation composer
      const manifDialog = page.getByRole('dialog');
      await manifDialog.getByRole('button', { name: /Dictar por voz|Dictar con IA/i }).first().click();
      await manifDialog.getByText('Más opciones').click();
      const uniqueManifTitle = `Vínculo cumplido con SP ${Date.now().toString().slice(-4)}`;
      await page.locator('#manifestation-title').fill(uniqueManifTitle);
      await page
        .locator('#manifestation-description')
        .fill('SP me elige todos los días y compartimos nuestra vida juntos.');
      await manifDialog.getByRole('button', { name: /Guardar intención|Guardar manifestación/i }).click();

      // Wait for card to render in Manifestaciones
      await page.getByText(uniqueManifTitle).first().waitFor({ state: 'visible', timeout: 10000 });

      // Click "Avance" on that Manifestation card to record a linked Progress Log with voice dictation
      const manifCard = page.locator('article', { hasText: uniqueManifTitle }).first();
      await manifCard.getByRole('button', { name: /Avance/i }).click();

      const progressDialog = page.getByRole('dialog');
      await progressDialog.getByRole('button', { name: /Dictar por voz|Dictar con IA/i }).first().click();
      const uniqueProgressNote = `SP me escribió hoy diciendo que me extraña (${Date.now()
        .toString()
        .slice(-4)})`;
      await page.locator('#progress-log-note').fill(uniqueProgressNote);
      await progressDialog.getByRole('button', { name: /Guardar avance/i }).click();

      // Verify badge "1 avance vinculado" appears on the Manifestation card
      await manifCard.getByText(/avance vinculado/i).waitFor({ state: 'visible', timeout: 10000 });

      // Click "¡Se cumplió!" on that Manifestation card to create a linked Success Story with voice dictation
      await manifCard.getByRole('button', { name: /¡Se cumplió!/i }).click();
      const storyDialog = page.getByRole('dialog');
      await storyDialog.getByRole('button', { name: /Dictar por voz|Dictar con IA/i }).nth(1).click();
      const uniqueStoryBody = `Sucedió tal cual lo asumí: SP me declaró su amor literal.`;
      await page.locator('#success-story-body').fill(uniqueStoryBody);
      await storyDialog.getByRole('button', { name: /Guardar historia/i }).click();

      // Verify badge "1 Success Story cumplida" appears on the Manifestation card
      await manifCard
        .getByText(/Success Story cumplida/i)
        .waitFor({ state: 'visible', timeout: 10000 });

      // Wait 1.2s for async Turso DB POSTs to settle, then query /api/sync?scope=facu directly to verify Turso persistence
      await page.waitForTimeout(1200);
      const syncCheck = await page.evaluate(async () => {
        const res = await fetch(`/api/sync?scope=facu&t=${Date.now()}`);
        return res.json();
      });

      const savedManif = (syncCheck?.data?.manifestations || []).find(
        (m) => m.title === uniqueManifTitle
      );
      const savedProgress = (syncCheck?.data?.progressLogs || []).find(
        (p) => p.manifestationId === savedManif?.id
      );
      const savedStory = (syncCheck?.data?.successStories || []).find(
        (s) => s.manifestationId === savedManif?.id
      );

      if (!savedManif || !savedProgress || !savedStory) {
        throw new Error(
          `Turso relational verification failed: manif=${Boolean(savedManif)}, progress=${Boolean(
            savedProgress
          )}, story=${Boolean(savedStory)}`
        );
      }

      const tursoShot = path.join(SCREENSHOT_DIR, 'mac-desktop-manifestation-relations.png');
      await page.screenshot({ path: tursoShot });

      summary.tursoRelationalVerification = {
        manifestationId: savedManif.id,
        manifestationStatus: savedManif.status,
        linkedProgressId: savedProgress.id,
        linkedSuccessStoryId: savedStory.id,
        screenshot: tursoShot,
      };

      await context.close();
    }

    console.log('PLAYWRIGHT_VERIFICATION_SUCCESS');
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await browser.close();
  }
}

runVerification().catch((error) => {
  console.error('PLAYWRIGHT_VERIFICATION_FAILED:', error);
  process.exit(1);
});
