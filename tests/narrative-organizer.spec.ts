import { test, expect, type Page } from '@playwright/test';
import { createClient, type Client } from '@libsql/client';
import AxeBuilder from '@axe-core/playwright';

const DB_URL = 'file:/tmp/manifest-narrative-test.db';

let db: Client;

test.beforeAll(() => {
  db = createClient({ url: DB_URL });
});

test.afterAll(async () => {
  await db.close();
});

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

async function boot(page: Page, scenario: string) {
  await page.addInitScript((value) => {
    window.localStorage.setItem('manifest_narrative_scenario', value);
    window.localStorage.removeItem('manifest_narrative_speech');
  }, scenario);
  await page.goto('/');
  await hideDevChrome(page);
  await expect(page.locator('[data-quick-add-trigger="true"]')).toBeVisible();
}

/**
 * The dev-only Break UI fixture toggle sits at the bottom center with z-[9999]
 * and intercepts pointer events. It never ships in production.
 */
async function hideDevChrome(page: Page) {
  await page.addStyleTag({
    content: '[data-testid="break-ui-toggle"]{display:none !important;pointer-events:none !important;}',
  });
}

async function setScenario(page: Page, scenario: string) {
  await page.evaluate((value) => {
    window.localStorage.setItem('manifest_narrative_scenario', value);
  }, scenario);
}

async function openOrganizer(page: Page) {
  const trigger = page.locator('[data-quick-add-trigger="true"]');
  await trigger.dispatchEvent('pointerdown', {
    pointerId: 1,
    pointerType: 'touch',
    clientY: 800,
    bubbles: true,
  });
  await page.waitForTimeout(380);
  await trigger.dispatchEvent('pointerup', {
    pointerId: 1,
    pointerType: 'touch',
    clientY: 800,
    bubbles: true,
  });
  await expect(page.getByTestId('narrative-organizer-overlay')).toBeVisible();
}

async function submitListening(page: Page) {
  await page.getByRole('button', { name: 'Enviar el relato al organizador' }).click();
}

async function waitForReview(page: Page) {
  await expect(page.getByTestId('narrative-plan-list')).toBeVisible();
  await expect(page.getByTestId('narrative-confirm')).toBeVisible();
}

async function correctByVoice(page: Page, scenario: string) {
  await setScenario(page, scenario);
  await page.getByRole('button', { name: 'Corregir el borrador por voz' }).click();
  await expect(
    page.getByRole('button', { name: 'Enviar el relato al organizador' })
  ).toBeVisible();
  await submitListening(page);
}

async function confirmAndCapture(page: Page) {
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().includes('/api/ai/narrative-organizer/commit') &&
      response.request().method() === 'POST'
  );
  await page.getByTestId('narrative-confirm').click();
  const response = await responsePromise;
  expect(response.status()).toBe(200);
  return (await response.json()) as {
    success: boolean;
    data: {
      draftId: string;
      profileId: string;
      manifestations: Array<{ id: string; title: string; description: string }>;
      progressLogs: Array<{ id: string; manifestationId: string | null; note: string }>;
      successStories: Array<{ id: string; manifestationId: string | null }>;
      affirmations: Array<{ id: string; text: string }>;
    };
  };
}

async function countRows(table: 'manifestations' | 'manifestation_progress' | 'success_stories' | 'affirmations' | 'rampage_sets') {
  const result = await db.execute(`SELECT COUNT(*) AS total FROM ${table};`);
  return Number(result.rows[0]?.total ?? 0);
}

/* -------------------------------------------------------------------------- */
/*  Tests                                                                     */
/* -------------------------------------------------------------------------- */

test('1 · long-press abre el organizador y el backdrop cancela sin escribir', async ({ page }) => {
  await boot(page, 'sabrina_initial');

  const before = {
    manifestations: await countRows('manifestations'),
    progress: await countRows('manifestation_progress'),
    affirmations: await countRows('affirmations'),
  };

  await openOrganizer(page);
  await expect(page.getByRole('heading', { name: 'Te escucho' })).toBeVisible();

  await page.mouse.click(8, 8);
  await expect(page.getByTestId('narrative-organizer-overlay')).toBeHidden();

  expect(await countRows('manifestations')).toBe(before.manifestations);
  expect(await countRows('manifestation_progress')).toBe(before.progress);
  expect(await countRows('affirmations')).toBe(before.affirmations);
});

test('2 · un toque corto abre el menú manual, no el organizador', async ({ page }) => {
  await boot(page, 'sabrina_initial');
  await page.locator('[data-quick-add-trigger="true"]').click();
  await expect(page.getByTestId('narrative-organizer-overlay')).toBeHidden();
  await expect(page.getByRole('dialog', { name: 'Crear' })).toBeVisible();
});

test('3 · propone manifestación, avance y afirmación con un único CTA', async ({ page }) => {
  await boot(page, 'sabrina_initial');
  await openOrganizer(page);
  await submitListening(page);
  await waitForReview(page);

  await expect(page.getByTestId('narrative-card-manifestation')).toHaveCount(1);
  await expect(page.getByTestId('narrative-card-progress')).toHaveCount(1);
  await expect(page.getByTestId('narrative-card-affirmation')).toHaveCount(1);
  await expect(page.getByTestId('narrative-card-manifestation')).toContainText(
    'Relación y juntadas con Sabrina'
  );

  const confirm = page.getByTestId('narrative-confirm');
  await expect(confirm).toHaveCount(1);
  await expect(confirm).toContainText('Sí, registrar todo');

  for (const forbidden of [/editar/i, /cancelar/i, /^no$/i, /descartar/i]) {
    await expect(page.getByRole('button', { name: forbidden })).toHaveCount(0);
  }
});

test('4 · confirma y persiste todo con voiceTranscript y contexto', async ({ page }) => {
  await boot(page, 'sabrina_initial');
  await openOrganizer(page);
  await submitListening(page);
  await waitForReview(page);

  const { success, data } = await confirmAndCapture(page);
  expect(success).toBe(true);
  await expect(page.getByTestId('narrative-organizer-overlay')).toBeHidden({ timeout: 10_000 });

  const manifestation = await db.execute({
    sql: 'SELECT title, description, status FROM manifestations WHERE id = ?',
    args: [data.manifestations[0].id],
  });
  expect(manifestation.rows).toHaveLength(1);
  expect(String(manifestation.rows[0].description)).not.toContain('\n\n');
  expect(String(manifestation.rows[0].description)).toContain('Sabrina');
  expect(String(manifestation.rows[0].status)).toBe('semilla');

  const progress = await db.execute({
    sql: 'SELECT note, voice_transcript, manifestation_id FROM manifestation_progress WHERE id = ?',
    args: [data.progressLogs[0].id],
  });
  expect(progress.rows).toHaveLength(1);
  expect(String(progress.rows[0].note)).toContain('Primer encuentro con Sabrina');
  expect(String(progress.rows[0].voice_transcript)).toContain('Sabrina');
  expect(String(progress.rows[0].manifestation_id)).toBe(data.manifestations[0].id);

  const affirmation = await db.execute({
    sql: 'SELECT text FROM affirmations WHERE id = ?',
    args: [data.affirmations[0].id],
  });
  expect(affirmation.rows).toHaveLength(1);
  expect(String(affirmation.rows[0].text)).toContain('chica tierna y cálida');
});

test('5 · cancelar durante el procesamiento aborta la petición y no escribe nada', async ({
  page,
}) => {
  let commitRequests = 0;
  page.on('request', (request) => {
    if (request.url().includes('/api/ai/narrative-organizer/commit')) commitRequests += 1;
  });

  await page.route('**/api/ai/narrative-organizer', async (route) => {
    if (route.request().method() === 'POST') {
      await new Promise((resolve) => setTimeout(resolve, 1_500));
    }
    await route.continue();
  });

  await boot(page, 'sabrina_initial');

  const before = await countRows('manifestations');
  await openOrganizer(page);
  await submitListening(page);
  await expect(page.getByRole('heading', { name: 'Ordenando tu relato' })).toBeVisible();

  await page.mouse.click(8, 8);
  await expect(page.getByTestId('narrative-organizer-overlay')).toBeHidden();

  await page.waitForTimeout(1_800);
  expect(commitRequests).toBe(0);
  expect(await countRows('manifestations')).toBe(before);
});

test('6 · corrige por voz de forma acumulativa sin perder el borrador', async ({ page }) => {
  await boot(page, 'sabrina_initial');
  await openOrganizer(page);
  await submitListening(page);
  await waitForReview(page);

  await correctByVoice(page, 'sabrina_add_age');
  await waitForReview(page);

  await expect(page.getByTestId('narrative-plan-list')).toContainText('23 años');
  await expect(page.getByTestId('narrative-siri-response')).toContainText('23 años');

  const { data } = await confirmAndCapture(page);
  const manifestation = await db.execute({
    sql: 'SELECT description FROM manifestations WHERE id = ?',
    args: [data.manifestations[0].id],
  });
  expect(String(manifestation.rows[0].description)).toContain('23 años');
});

test('7 · reconoce un homónimo y crea una Sabrina nueva', async ({ page }) => {
  await boot(page, 'sabrina_homonym');
  await openOrganizer(page);
  await submitListening(page);
  await waitForReview(page);

  const card = page.getByTestId('narrative-card-manifestation');
  await expect(card).toHaveCount(1);
  await expect(card).toContainText('Persona nueva · mismo nombre');
  await expect(card).toContainText('Sabrina (Tinder)');

  const { data } = await confirmAndCapture(page);
  const manifestation = await db.execute({
    sql: 'SELECT title FROM manifestations WHERE id = ?',
    args: [data.manifestations[0].id],
  });
  expect(String(manifestation.rows[0].title)).toBe('Sabrina (Tinder)');
});

test('8 · desvincula el avance de la Sabrina anterior', async ({ page }) => {
  await boot(page, 'sabrina_initial');
  await openOrganizer(page);
  await submitListening(page);
  await waitForReview(page);

  await correctByVoice(page, 'sabrina_unlink');
  await waitForReview(page);

  await expect(page.getByTestId('narrative-card-manifestation')).toHaveCount(2);
  await expect(page.getByTestId('narrative-card-progress')).toContainText(
    'Vinculada al borrador'
  );

  const { data } = await confirmAndCapture(page);
  const newSabrina = data.manifestations.find((item) => item.title === 'Sabrina (Tinder)');
  expect(newSabrina).toBeTruthy();
  expect(data.progressLogs[0].manifestationId).toBe(newSabrina?.id);
});

test('9 · no muestra CTA cuando el relato no se entiende', async ({ page }) => {
  await boot(page, 'unclear');
  await openOrganizer(page);
  await submitListening(page);

  await expect(page.getByTestId('narrative-siri-response')).toContainText('No te entendí');
  await expect(page.getByTestId('narrative-confirm')).toBeHidden();
  await expect(page.getByTestId('narrative-plan-list')).toBeHidden();
});

test('10 · Escape cancela y limpia el borrador', async ({ page }) => {
  await boot(page, 'sabrina_initial');
  await openOrganizer(page);
  await submitListening(page);
  await waitForReview(page);

  await page.keyboard.press('Escape');
  await expect(page.getByTestId('narrative-organizer-overlay')).toBeHidden();

  await openOrganizer(page);
  await expect(page.getByRole('heading', { name: 'Te escucho' })).toBeVisible();
  await expect(page.getByTestId('narrative-plan-list')).toBeHidden();
});

test('11 · pregunta si guardar el Rampage y respeta el no guardar', async ({ page }) => {
  await boot(page, 'sabrina_rampage');
  await openOrganizer(page);
  await submitListening(page);
  await waitForReview(page);

  await expect(page.getByTestId('narrative-card-rampage')).toBeVisible();
  const toggle = page.getByTestId('narrative-save-rampage');
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');

  const { data } = await confirmAndCapture(page);
  expect(data.manifestations).toHaveLength(1);

  // The Rampage player opens after committing.
  await expect(page.getByRole('dialog', { name: /RAMPAGE NOCTURNO/i })).toBeVisible({
    timeout: 15_000,
  });

  const stored = await db.execute({
    sql: 'SELECT COUNT(*) AS total FROM rampage_sets WHERE title = ?;',
    args: ['Rampage de Sabrina'],
  });
  expect(Number(stored.rows[0]?.total ?? 0)).toBe(0);

  const preference = await page.evaluate(() =>
    window.localStorage.getItem('manifest_rampage_save_set')
  );
  expect(preference).toBe('false');
});

test('12 · axe sin hallazgos critical/serious en la revisión', async ({ page }) => {
  await boot(page, 'sabrina_initial');
  await openOrganizer(page);
  await submitListening(page);
  await waitForReview(page);

  const results = await new AxeBuilder({ page })
    .include('[data-testid="narrative-organizer-panel"]')
    .analyze();

  const blocking = results.violations.filter(
    (violation) => violation.impact === 'critical' || violation.impact === 'serious'
  );
  expect(blocking).toEqual([]);
});

test('13 · si se repite una afirmación presente, por defecto la repite e incrementa repeat_count', async ({ page }) => {
  await db.execute({
    sql: 'INSERT OR REPLACE INTO affirmations (id, user_id, text, repeat_count, pinned, sort_order, created_at) VALUES (?, ?, ?, 0, 0, 0, ?);',
    args: ['aff_existing_1', 'facu', 'Soy siempre la primera opción', new Date().toISOString()],
  });

  await boot(page, 'repeat_affirmation');
  await openOrganizer(page);
  await submitListening(page);
  await waitForReview(page);

  const card = page.getByTestId('narrative-card-affirmation');
  await expect(card).toContainText('Repetir · ya presente');
  const toggleBtn = page.getByTestId('toggle-save-new-affirmation');
  await expect(toggleBtn).toBeVisible();
  await expect(toggleBtn).toHaveText('Guardar nueva afirmación');

  // Por defecto, confirma sin pulsar el botón
  await confirmAndCapture(page);

  const res = await db.execute({
    sql: 'SELECT repeat_count FROM affirmations WHERE id = ?;',
    args: ['aff_existing_1'],
  });
  expect(Number(res.rows[0]?.repeat_count)).toBe(1);
});

test('14 · si se pulsa en guardar nueva afirmación, la guarda como nueva sin incrementar la existente', async ({ page }) => {
  await db.execute({
    sql: 'INSERT OR REPLACE INTO affirmations (id, user_id, text, repeat_count, pinned, sort_order, created_at) VALUES (?, ?, ?, 0, 0, 0, ?);',
    args: ['aff_existing_1', 'facu', 'Soy siempre la primera opción', new Date().toISOString()],
  });

  await boot(page, 'repeat_affirmation');
  await openOrganizer(page);
  await submitListening(page);
  await waitForReview(page);

  const toggleBtn = page.getByTestId('toggle-save-new-affirmation');
  await expect(toggleBtn).toBeVisible();
  // El usuario pulsa en el botón guardar nueva afirmación
  await toggleBtn.click();

  const card = page.getByTestId('narrative-card-affirmation');
  await expect(card).toContainText('Nueva afirmación');
  await expect(toggleBtn).toHaveText('Repetir afirmación (por defecto)');

  await confirmAndCapture(page);

  // La existente no fue incrementada
  const resExisting = await db.execute({
    sql: 'SELECT repeat_count FROM affirmations WHERE id = ?;',
    args: ['aff_existing_1'],
  });
  expect(Number(resExisting.rows[0]?.repeat_count)).toBe(0);

  // Se guardó una nueva afirmación con el mismo texto
  const total = await db.execute({
    sql: 'SELECT COUNT(*) AS total FROM affirmations WHERE text = ?;',
    args: ['Soy siempre la primera opción'],
  });
  expect(Number(total.rows[0]?.total)).toBeGreaterThanOrEqual(2);
});

test('15 · si se repite una manifestación presente, por defecto la repite e incrementa repeat_count', async ({ page }) => {
  const now = new Date().toISOString();
  await db.execute({
    sql: `INSERT OR REPLACE INTO manifestations
      (id, user_id, author, title, description, sensory_anchor, category, status, repeat_count, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, '', 'relaciones', 'semilla', 0, ?, ?);`,
    args: ['m_existing_1', 'facu', 'Facu', 'Relación y juntadas con Sabrina', 'Descripción inicial', now, now],
  });

  await boot(page, 'repeat_manifestation');
  await openOrganizer(page);
  await submitListening(page);
  await waitForReview(page);

  const card = page.getByTestId('narrative-card-manifestation');
  await expect(card).toContainText('Repetir · ya presente');
  const toggleBtn = page.getByTestId('toggle-save-new-manifestation');
  await expect(toggleBtn).toBeVisible();
  await expect(toggleBtn).toHaveText('Guardar nueva manifestación');

  // Por defecto, confirma sin pulsar el botón
  await confirmAndCapture(page);

  const res = await db.execute({
    sql: 'SELECT repeat_count FROM manifestations WHERE id = ?;',
    args: ['m_existing_1'],
  });
  expect(Number(res.rows[0]?.repeat_count)).toBe(1);
});

test('16 · si se pulsa en guardar nueva manifestación, la guarda como nueva', async ({ page }) => {
  const now = new Date().toISOString();
  await db.execute({
    sql: `INSERT OR REPLACE INTO manifestations
      (id, user_id, author, title, description, sensory_anchor, category, status, repeat_count, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, '', 'relaciones', 'semilla', 0, ?, ?);`,
    args: ['m_existing_1', 'facu', 'Facu', 'Relación y juntadas con Sabrina', 'Descripción inicial', now, now],
  });

  await boot(page, 'repeat_manifestation');
  await openOrganizer(page);
  await submitListening(page);
  await waitForReview(page);

  const toggleBtn = page.getByTestId('toggle-save-new-manifestation');
  await expect(toggleBtn).toBeVisible();
  // El usuario pulsa en el botón guardar nueva manifestación
  await toggleBtn.click();

  const card = page.getByTestId('narrative-card-manifestation');
  await expect(card).toContainText('Nueva manifestación');
  await expect(toggleBtn).toHaveText('Repetir manifestación (por defecto)');

  const { data } = await confirmAndCapture(page);
  expect(data.manifestations).toHaveLength(1);
  // El ID debe ser uno nuevo, no el existente
  expect(data.manifestations[0].id).not.toBe('m_existing_1');

  // La existente no fue incrementada
  const resExisting = await db.execute({
    sql: 'SELECT repeat_count FROM manifestations WHERE id = ?;',
    args: ['m_existing_1'],
  });
  expect(Number(resExisting.rows[0]?.repeat_count)).toBe(0);

  // Hay dos manifestaciones con ese título en la BD
  const total = await db.execute({
    sql: 'SELECT COUNT(*) AS total FROM manifestations WHERE title = ?;',
    args: ['Relación y juntadas con Sabrina'],
  });
  expect(Number(total.rows[0]?.total)).toBeGreaterThanOrEqual(2);
});
