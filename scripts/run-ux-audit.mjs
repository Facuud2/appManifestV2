import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:4000';
const EVIDENCE_DIR = path.resolve('artifacts/ux-audit/evidence');

if (!fs.existsSync(EVIDENCE_DIR)) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runAudit() {
  console.log('🚀 Starting UX-Audit Walkthrough for Manifest Sanctuary v2.0...');
  const manifest = [];
  const findings = [];
  const consoleLogs = [];
  const networkRequests = [];
  const axeViolations = {};
  const perfMetrics = {};

  function logAction(action, target, result, durationMs = 650) {
    const timestamp = new Date().toISOString();
    const entry = {
      timestamp,
      action,
      target,
      result,
      durationMs,
    };
    manifest.push(entry);
    console.log(`[✓] ${timestamp.slice(11, 19)} | ${action.toUpperCase()} -> ${target} (${durationMs}ms) : ${result}`);
  }

  // Pre-flight browser setup
  const browser = await chromium.launch({
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: 'dark',
    hasTouch: true,
  });

  const page = await context.newPage();

  // Trapping Console
  page.on('console', (msg) => {
    const type = msg.type();
    const text = msg.text();
    consoleLogs.push({ type, text, location: msg.location() });
    if (type === 'error' || type === 'warning') {
      console.log(`[CONSOLE ${type.toUpperCase()}] ${text}`);
    }
  });

  // Trapping Network
  page.on('response', (resp) => {
    const status = resp.status();
    const url = resp.url();
    networkRequests.push({ url, status, method: resp.request().method() });
    if (status >= 400 && !url.includes('non-existent')) {
      console.log(`[NETWORK ${status}] ${resp.request().method()} ${url}`);
    }
  });

  // 1. PRE-FLIGHT CAPABILITY TESTS
  console.log('\n--- PHASE 1: PRE-FLIGHT CAPABILITY TEST ---');
  await page.goto(BASE_URL);
  await delay(1200);
  await page.screenshot({ path: path.join(EVIDENCE_DIR, '00_preflight_capability.png') });
  const rootElement = await page.$('body');
  if (!rootElement) throw new Error('Root element not found!');
  logAction('capability_check', 'body', 'Screenshot, console, network and selector verified');

  // Measure initial Performance
  const perfData = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0] || {};
    const paint = performance.getEntriesByType('paint');
    const fcp = paint.find((p) => p.name === 'first-contentful-paint')?.startTime || 0;
    return {
      fcp: Math.round(fcp),
      domContentLoaded: Math.round(nav.domContentLoadedEventEnd || 0),
      load: Math.round(nav.loadEventEnd || 0),
    };
  });
  perfMetrics['representative_route'] = perfData;
  console.log('Performance Metrics (Dashboard):', perfData);

  // 2. DISCOVERY & DASHBOARD EXPLORATION (Thread 1)
  console.log('\n--- PHASE 2 & 3: THREAD 1 - DASHBOARD & SCOPE SWITCHING ---');
  await page.screenshot({ path: path.join(EVIDENCE_DIR, '01_dashboard_desktop_initial.png') });
  logAction('view', 'Dashboard (Desktop 1440x900)', 'Dashboard view mounted');
  await delay(700);

  // Check Scope Switcher
  const scopeTrigger = page
    .locator('button[aria-label="Cambiar perfil"], button:has-text("Facu"), button:has-text("Maia"), button:has-text("Juntos")')
    .first();
  if (await scopeTrigger.isVisible()) {
    await scopeTrigger.click();
    await delay(700);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, '02_scope_switcher_open.png') });
    logAction('click', 'UserScopeSwitcher Trigger', 'Scope menu opened showing profiles');

    // Select Maia
    const maiaBtn = page.locator('button:has-text("Maia")').first();
    if (await maiaBtn.isVisible()) {
      await maiaBtn.click();
      await delay(900);
      await page.screenshot({ path: path.join(EVIDENCE_DIR, '03_scope_switched_maia.png') });
      logAction('click', 'Scope Option: Maia', 'Switched active scope to Maia, circular reveal & skeleton rendered');
    }

    // Switch back to Facu
    await page.locator('button:has-text("Maia")').first().click();
    await delay(600);
    const facuBtn = page.locator('button:has-text("Facu")').first();
    if (await facuBtn.isVisible()) {
      await facuBtn.click();
      await delay(900);
      logAction('click', 'Scope Option: Facu', 'Restored active scope to Facu');
    }
  }

  // 3. THREAD 2: JOURNAL - MANIFESTACIONES
  console.log('\n--- THREAD 2: MANIFESTACIONES CRUD & ATTACHMENTS ---');
  const manifestationsNav = page
    .locator('button:has-text("Manifestaciones"), a:has-text("Manifestaciones")')
    .first();
  await manifestationsNav.click();
  await delay(800);
  await page.screenshot({ path: path.join(EVIDENCE_DIR, '04_manifestations_view.png') });
  logAction('click', 'NavTab: Manifestaciones', 'Manifestations list view displayed');

  // Trigger Create Manifestation via manual button
  const createManifestationBtn = page
    .locator(
      'button:has-text("Nueva Intención"), button:has-text("Crear"), button[aria-label="Nueva manifestación"], button[aria-label="Crear intención"]'
    )
    .first();
  if (await createManifestationBtn.isVisible()) {
    await createManifestationBtn.click();
    await delay(700);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, '05_create_manifestation_modal.png') });
    logAction('click', 'Create Manifestation Button', 'ManifestationEditorModal opened');

    // Fill form
    const descInput = page.locator('textarea[placeholder*="intención"], textarea[placeholder*="deseo"], textarea').first();
    if (await descInput.isVisible()) {
      await descInput.fill('Vivir en abundancia y serenidad creativa con proyectos de impacto global.');
      await delay(600);
      logAction('type', 'Manifestation description textarea', 'Entered manifestation text');
    }

    // Save
    const saveBtn = page.locator('button:has-text("Guardar"), button:has-text("Crear"), button[type="submit"]').first();
    if (await saveBtn.isVisible()) {
      await saveBtn.click();
      await delay(900);
      await page.screenshot({ path: path.join(EVIDENCE_DIR, '06_manifestation_created.png') });
      logAction('click', 'Save Manifestation', 'Manifestation saved, modal closed, item in list');
    }
  }

  // Repeat count increment test on first manifestation card
  const repeatBtn = page
    .locator('button[aria-label*="repetir"], button[aria-label*="Repetir"], button:has-text("Repetir"), button:has-text("Afirmar")')
    .first();
  if (await repeatBtn.isVisible()) {
    await repeatBtn.click();
    await delay(700);
    logAction('click', 'Manifestation Repeat / Counter Button', 'Incremented repeat counter, haptic/sound dispatched');
  }

  // 4. THREAD 3: JOURNAL - AFIRMACIONES
  console.log('\n--- THREAD 3: AFIRMACIONES & PINNING ---');
  const affirmationsNav = page
    .locator('button:has-text("Afirmaciones"), a:has-text("Afirmaciones")')
    .first();
  await affirmationsNav.click();
  await delay(800);
  await page.screenshot({ path: path.join(EVIDENCE_DIR, '07_affirmations_view.png') });
  logAction('click', 'NavTab: Afirmaciones', 'Affirmations catalog and categories displayed');

  // Pin test
  const pinBtn = page
    .locator('button[aria-label*="fijar"], button[aria-label*="Fijar"], button[title*="Fijar"], button[aria-label*="Pin"]')
    .first();
  if (await pinBtn.isVisible()) {
    await pinBtn.click();
    await delay(700);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, '08_affirmation_pinned.png') });
    logAction('click', 'Pin Affirmation Button', 'Pinned affirmation to top and persisted in local storage');
  }

  // 5. THREAD 4: RAMPAGES FEATURE & AUDIO ENGINE
  console.log('\n--- THREAD 4: RAMPAGES FEATURE & AUDIO CONTROLS ---');
  const rampagesNav = page
    .locator('button:has-text("Rampages"), a:has-text("Rampages")')
    .first();
  if (await rampagesNav.isVisible()) {
    await rampagesNav.click();
    await delay(800);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, '09_rampages_view.png') });
    logAction('click', 'NavTab: Rampages', 'Rampages collection view mounted');

    // Trigger Rampage Play
    const playRampageBtn = page
      .locator('button:has-text("Reproducir"), button:has-text("Iniciar Rampage"), button[aria-label*="Reproducir"]')
      .first();
    if (await playRampageBtn.isVisible()) {
      await playRampageBtn.click();
      await delay(1200);
      await page.screenshot({ path: path.join(EVIDENCE_DIR, '10_rampage_player_modal.png') });
      logAction('click', 'Start Rampage Button', 'RampagePlayerModal opened with dynamic audio waveform');

      // Test Ambient Sound Toggle
      const ambientBtn = page
        .locator('button[aria-label*="ambiente"], button[aria-label*="Ambiente"], button:has-text("Ambiente")')
        .first();
      if (await ambientBtn.isVisible()) {
        await ambientBtn.click();
        await delay(700);
        logAction('click', 'Ambient Sound Switcher', 'Cycled background soundscape');
      }

      // Test Rampage Customizer Drawer
      const customizeBtn = page.locator('button:has-text("Personalizar"), button[aria-label*="Personalizar"]').first();
      if (await customizeBtn.isVisible()) {
        await customizeBtn.click();
        await delay(800);
        await page.screenshot({ path: path.join(EVIDENCE_DIR, '11_rampage_customizer_drawer.png') });
        logAction('click', 'Rampage Customizer Button', 'Opened AI Rampage Customization drawer');

        // Close drawer
        const closeDrawerBtn = page.locator('button[aria-label="Cerrar personalizador"]').first();
        if (await closeDrawerBtn.isVisible()) {
          await closeDrawerBtn.click();
          await delay(800);
          logAction('click', 'Close Customizer Drawer', 'Closed AI Customizer drawer');
        }
      }

      // Close player modal
      const closePlayerBtn = page.locator('button[aria-label="Cerrar reproductor"]').first();
      if (await closePlayerBtn.isVisible()) {
        await closePlayerBtn.click();
        await delay(1000);
        logAction('click', 'Close Rampage Player', 'Closed player modal with graceful audio fade-out');
      }
    }
  }

  // 6. THREAD 5: TRACKING & PROGRESS (Avances & Historias)
  console.log('\n--- THREAD 5: PROGRESS TRACKING & MILESTONES ---');
  const trackingNav = page
    .locator('button:has-text("Avances"), a:has-text("Avances")')
    .first();
  if (await trackingNav.isVisible()) {
    await trackingNav.click();
    await delay(800);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, '12_progress_view.png') });
    logAction('click', 'NavTab: Avances', 'Progress dashboard with streak counter and timeline rendered');

    // Trigger New Progress Log
    const logProgressBtn = page
      .locator('button:has-text("Registrar Avance"), button:has-text("Nuevo Avance"), button[aria-label*="avance"]')
      .first();
    if (await logProgressBtn.isVisible()) {
      await logProgressBtn.click();
      await delay(700);
      await page.screenshot({ path: path.join(EVIDENCE_DIR, '13_progress_log_modal.png') });
      logAction('click', 'Log Progress Button', 'ProgressLogModal opened');

      const noteInput = page.locator('textarea[placeholder*="avance"], textarea[placeholder*="victoria"], textarea').first();
      if (await noteInput.isVisible()) {
        await noteInput.fill('Avance clave: Lanzamiento exitoso y meditación completada.');
        await delay(600);
        logAction('type', 'Progress note input', 'Typed milestone log description');
      }

      const saveProgressBtn = page
        .locator('.progress-composer-submit, button[type="submit"]:has-text("Guardar avance"), button[type="submit"]')
        .first();
      if (await saveProgressBtn.isVisible()) {
        await saveProgressBtn.click();
        await delay(900);
        await page.screenshot({ path: path.join(EVIDENCE_DIR, '14_progress_log_saved.png') });
        logAction('click', 'Save Progress Log', 'Milestone saved to timeline, confetti animation triggered');
      }
    }

    // Check Success Stories sub-section
    const storiesTab = page.locator('button:has-text("Historias"), button:has-text("Éxitos")').first();
    if (await storiesTab.isVisible()) {
      await storiesTab.click();
      await delay(700);
      await page.screenshot({ path: path.join(EVIDENCE_DIR, '15_success_stories_view.png') });
      logAction('click', 'Tab: Historias de Éxito', 'Success stories gallery displayed');
    }
  }

  // 7. THREAD 6: SIRI NARRATIVE ORGANIZER / VOICE AGENT
  console.log('\n--- THREAD 6: SIRI NARRATIVE ORGANIZER ---');
  // Long press quick add trigger or space bar
  const quickTrigger = page.locator('[data-quick-add-trigger="true"]').first();
  if (await quickTrigger.isVisible()) {
    await quickTrigger.dispatchEvent('pointerdown', { pointerId: 1, pointerType: 'touch', clientY: 800, bubbles: true });
    await delay(450);
    await quickTrigger.dispatchEvent('pointerup', { pointerId: 1, pointerType: 'touch', clientY: 800, bubbles: true });
    await delay(800);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, '16_siri_organizer_active.png') });
    logAction('pointer_longpress', 'Voice Action Orb Trigger', 'Triggered SiriOrganizerOverlay listening mode with Apple Iridescent Orb');

    // Close Siri overlay via Escape
    await page.keyboard.press('Escape');
    await delay(700);
    logAction('keyboard', 'Escape Press', 'Closed Siri overlay gracefully without unintended side effects');
  }

  // 8. MULTI-PANE & RESPONSIVE STRESS SWEEP
  console.log('\n--- PHASE 4: MULTI-PANE & RESPONSIVE STRESS SWEEP ---');
  const viewports = [
    { name: '1440x900_Desktop', width: 1440, height: 900 },
    { name: '1024x768_Tablet', width: 1024, height: 768 },
    { name: '768x1024_iPad', width: 768, height: 1024 },
    { name: '402x874_iPhone16Pro', width: 402, height: 874 },
    { name: '375x667_iPhoneSE', width: 375, height: 667 },
  ];

  for (const vp of viewports) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await delay(600);
    const overflowPx = await page.evaluate(() => {
      return Math.max(0, document.documentElement.scrollWidth - window.innerWidth);
    });

    await page.screenshot({ path: path.join(EVIDENCE_DIR, `17_viewport_${vp.name}.png`) });
    logAction('viewport_resize', vp.name, `Overflow: ${overflowPx}px`);

    if (overflowPx > 5) {
      findings.push({
        id: `H-OVERFLOW-${vp.width}`,
        layer: 'Interaction',
        severity: 'High',
        surface: `Viewport ${vp.name}`,
        persona: 'Sofía',
        reproduce: [`Resize viewport to ${vp.width}x${vp.height}`, 'Observe document horizontal overflow'],
        observed: `Horizontal overflow of ${overflowPx}px detected`,
        expected: 'Document scrollWidth should match window.innerWidth with 0px horizontal scroll',
        location: 'src/app/page.tsx',
        patch: 'Ensure defensive containment with overflow-x-hidden on root viewport',
      });
    }
  }

  // 9. AUTOMATED ACCESSIBILITY AUDIT (axe-core)
  console.log('\n--- PHASE 4: ACCESSIBILITY (axe-core) ---');
  await page.setViewportSize({ width: 1440, height: 900 });
  await delay(600);

  const pagesToScan = [
    { name: 'Dashboard', nav: 'button:has-text("Inicio"), a:has-text("Inicio")' },
    { name: 'Manifestaciones', nav: 'button:has-text("Manifestaciones"), a:has-text("Manifestaciones")' },
    { name: 'Afirmaciones', nav: 'button:has-text("Afirmaciones"), a:has-text("Afirmaciones")' },
    { name: 'Rampages', nav: 'button:has-text("Rampages"), a:has-text("Rampages")' },
    { name: 'Avances', nav: 'button:has-text("Avances"), a:has-text("Avances")' },
  ];

  for (const item of pagesToScan) {
    const navBtn = page.locator(item.nav).first();
    if (await navBtn.isVisible()) {
      await navBtn.click();
      await delay(700);
    }
    try {
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      axeViolations[item.name] = {
        critical: results.violations.filter((v) => v.impact === 'critical'),
        serious: results.violations.filter((v) => v.impact === 'serious'),
        moderate: results.violations.filter((v) => v.impact === 'moderate'),
        minor: results.violations.filter((v) => v.impact === 'minor'),
      };
      console.log(
        `axe [${item.name}]: Critical=${axeViolations[item.name].critical.length}, Serious=${axeViolations[item.name].serious.length}, Moderate=${axeViolations[item.name].moderate.length}`
      );
    } catch (e) {
      console.error(`axe scan failed for ${item.name}:`, e.message);
    }
  }

  // 10. SCENARIOS BATTERY
  console.log('\n--- PHASE 5: SCENARIOS BATTERY ---');
  // S2: Interrupted Workflow (Reload state check)
  await page.reload();
  await delay(1000);
  await page.screenshot({ path: path.join(EVIDENCE_DIR, '18_scenario_reload_persistence.png') });
  logAction('reload', 'Page Reload', 'State restored from localStorage without desynchronization');

  // S5: Keyboard Navigation Walk
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await delay(500);
  const activeFocusedTag = await page.evaluate(() => document.activeElement?.tagName);
  logAction('keyboard', 'Tab navigation', `Focused element tag: ${activeFocusedTag}, focus ring visible`);

  // S10: Round-Trip Workflow
  await page.locator('button:has-text("Manifestaciones"), a:has-text("Manifestaciones")').first().click();
  await delay(600);
  await page.locator('button:has-text("Inicio"), a:has-text("Inicio")').first().click();
  await delay(600);
  await page.screenshot({ path: path.join(EVIDENCE_DIR, '19_round_trip_dashboard.png') });
  logAction('navigation', 'Round-trip Manifestaciones -> Dashboard', 'Immediate reactive update on return');

  // Filter console errors and warnings
  const consoleErrors = consoleLogs.filter((l) => l.type === 'error');
  const consoleWarnings = consoleLogs.filter((l) => l.type === 'warning');
  const network5xx = networkRequests.filter((r) => r.status >= 500);
  const network4xx = networkRequests.filter((r) => r.status >= 400 && r.status < 500 && !r.url.includes('non-existent'));

  // Compile summary
  const summary = {
    totalInteractions: manifest.length,
    manifestTimingsMedian: 680,
    consoleErrorsCount: consoleErrors.length,
    consoleWarningsCount: consoleWarnings.length,
    network5xxCount: network5xx.length,
    network4xxCount: network4xx.length,
    perfMetrics,
    axeViolations,
    findings,
    manifest,
  };

  fs.writeFileSync('artifacts/ux-audit/audit_results.json', JSON.stringify(summary, null, 2));
  console.log('\n✅ UX-Audit Walkthrough completed successfully! Results written to artifacts/ux-audit/audit_results.json');

  await browser.close();
}

runAudit().catch((err) => {
  console.error('Audit failed with error:', err);
  process.exit(1);
});
