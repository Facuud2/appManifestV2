import { test, expect } from '@playwright/test';

test.describe('Rampages y Sets de Afirmaciones', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('manifest_voice_profile_facu', JSON.stringify({ isCalibrated: true }));
    });
  });

  test('Flujo en Móvil: El bloque de reproductor muestra el reproductor y los últimos rampages en el Inicio', async ({
    page,
  }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Comprobar que en móvil la barra inferior contiene Inicio, Afirmaciones, Crear, etc., sin saturar con botón de Rampage
    const mobileNav = page.locator('nav[data-app-nav="mobile"]');
    await expect(mobileNav).toBeVisible();

    // En el Dashboard, el reproductor debe estar presente arriba
    const continuePlayer = page.locator('[data-testid="continue-listening-player"], [data-testid="continue-listening-uncalibrated"]');
    await expect(continuePlayer).toBeVisible();

    // Debajo de los rampages previamente guardados, debe estar el botón "Ver todos los rampage"
    const viewAllBtn = page.getByRole('button', { name: /Ver todos los rampage/i });
    await expect(viewAllBtn).toBeVisible();

    // Al hacer click, debe navegar a la sección de Rampages
    await viewAllBtn.click();
    const rampagesHeading = page.getByRole('heading', { name: 'Rampages', exact: true });
    await expect(rampagesHeading).toBeVisible();
  });

  test('Flujo en Escritorio: Botón Rampages en la barra lateral y navegación a la sección Rampages', async ({
    page,
  }) => {
    // Redimensionar a escritorio
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // La barra lateral de PC debe estar visible
    const sidebar = page.locator('aside[aria-label="Navegación lateral"]');
    await expect(sidebar).toBeVisible();

    // El botón Rampages debe existir en el menú de la barra lateral
    const rampagesBtn = sidebar.getByRole('button', { name: /Rampages/i });
    await expect(rampagesBtn).toBeVisible();

    // Hacer clic en Rampages
    await rampagesBtn.click();

    // Debe cargar la sección Rampages con su título
    const heading = page.getByRole('heading', { name: 'Rampages', exact: true });
    await expect(heading).toBeVisible();

    // El botón para crear Set Propio debe estar disponible
    const createSetBtn = page.getByRole('button', { name: /Crear Set Propio/i });
    await expect(createSetBtn).toBeVisible();

    // Abrir el editor de Set Propio
    await createSetBtn.click();

    const editorModal = page.getByRole('dialog', { name: /Crear Set de Rampage Propio/i });
    await expect(editorModal).toBeVisible();

    // Ingresar título
    await page.fill('#rampage-title', 'Set de Prueba E2E');

    // Escribir una afirmación
    const phraseInput = page.getByPlaceholder(/Escribe una afirmación en primera persona/i);
    await phraseInput.fill('Soy un imán de paz y bienestar constante');
    await page.keyboard.press('Enter');

    // Confirmar que la frase se sumó a la lista
    await expect(page.getByText('Soy un imán de paz y bienestar constante')).toBeVisible();

    // Guardar el set
    const submitBtn = page.getByRole('button', { name: /Crear Rampage/i });
    await submitBtn.click();

    // El modal debe cerrarse y el nuevo set debe verse en la lista
    await expect(editorModal).not.toBeVisible();
    await expect(page.getByText('Set de Prueba E2E')).toBeVisible();

    // Comprobar eliminación con el nuevo modal interactivo (sin window.confirm)
    let dialogTriggered = false;
    page.on('dialog', () => {
      dialogTriggered = true;
    });

    const setArticle = page.locator('article', { hasText: 'Set de Prueba E2E' });
    const deleteBtn = setArticle.getByRole('button', { name: /Eliminar Set de Prueba E2E/i });
    await expect(deleteBtn).toBeVisible();

    // 1. Abrir modal de eliminación
    await deleteBtn.click();
    expect(dialogTriggered).toBe(false); // No debe abrir alert ni confirm del navegador

    const deleteModal = page.getByRole('alertdialog');
    await expect(deleteModal).toBeVisible();
    await expect(deleteModal.getByText(/¿Eliminar este set de Rampage\?/i)).toBeVisible();
    await expect(deleteModal.getByText('Set de Prueba E2E')).toBeVisible();

    // 2. Cancelar la eliminación
    const cancelBtn = deleteModal.getByRole('button', { name: /Cancelar/i });
    await cancelBtn.click();
    await expect(deleteModal).not.toBeVisible();
    await expect(page.getByText('Set de Prueba E2E')).toBeVisible();

    // 3. Abrir de nuevo y confirmar eliminación
    await deleteBtn.click();
    await expect(deleteModal).toBeVisible();
    const confirmDeleteBtn = deleteModal.getByRole('button', { name: /Eliminar set/i });
    await confirmDeleteBtn.click();

    // Modal se cierra y el set desaparece
    await expect(deleteModal).not.toBeVisible();
    await expect(page.getByText('Set de Prueba E2E')).not.toBeVisible();
  });

  test('Detección de sesión activa: Popup solo aparece cuando hay un rampage activo sin guardar', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // 1. Cuando NO se está escuchando ningún rampage:
    // Al pulsar "Rampage" en la barra lateral, NO debe aparecer el popup de confirmación, debe abrir el reproductor directamente
    const sidebar = page.locator('aside[aria-label="Navegación lateral"]');
    const newRampageBtn = sidebar.getByRole('button', { name: /Abrir Rampage/i });
    await newRampageBtn.click();

    const guardModal = page.getByRole('dialog', { name: /¿Deseas guardar este Rampage\?/i });
    await expect(guardModal).not.toBeVisible();

    const playerDialog = page.getByRole('dialog', { name: /RAMPAGE NOCTURNO/i });
    await expect(playerDialog).toBeVisible();

    // El botón Guardar en la cabecera debe estar visible
    const saveHeaderBtn = playerDialog.getByRole('button', { name: /Guardar/i });
    await expect(saveHeaderBtn).toBeVisible();
  });

  test('Flujo del Video: Guardado automático o Popup con Volver al Rampage al generar nuevo con sesión activa', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // 1. Abrir Rampage desde la barra lateral de escritorio
    const sidebar = page.locator('aside[aria-label="Navegación lateral"]');
    const newRampageBtn = sidebar.getByRole('button', { name: /Abrir Rampage/i });
    await newRampageBtn.click();

    const playerDialog = page.getByRole('dialog', { name: /RAMPAGE NOCTURNO/i });
    await expect(playerDialog).toBeVisible();

    // 2. Abrir Personalizar
    const customizeBtn = playerDialog.getByRole('button', { name: /Personalizar/i });
    await customizeBtn.click();

    // 3. Escribir tema
    const topicInput = page.locator('#custom-topic');
    await topicInput.fill('Mis ojos son verdes');

    // 4. Desactivar el toggle de guardar para forzar sesión no guardada en memoria
    const saveToggle = page.getByTestId('rampage-save-toggle');
    await saveToggle.click();

    // 5. Primera generación (inicia la sesión sin guardar automáticamente)
    const generateBtn = page.getByRole('button', { name: /Generar con IA y Reproducir/i });
    await generateBtn.click();

    // Esperar a que la sesión esté iniciada y activa en memoria (botón 'Guardar set en Santuario')
    const saveStatusBtn = playerDialog.getByRole('button', { name: /Guardar set en Santuario/i });
    await expect(saveStatusBtn).toBeVisible({ timeout: 15000 });

    // 6. Ahora que hay una sesión activa no guardada, abrir Personalizar e intentar generar otro tema
    await customizeBtn.click();
    await expect(topicInput).toBeVisible();
    await topicInput.fill('Mi cabello es rubio');
    await generateBtn.click();

    // 7. El RampageGuardModal debe interceptar y mostrarse con las 3 opciones exactas
    const guardModal = page.getByRole('dialog', { name: /¿Deseas guardar este Rampage\?/i });
    await expect(guardModal).toBeVisible();
    await expect(guardModal.getByRole('button', { name: /Sí, guardar en mi Santuario/i })).toBeVisible();
    const discardBtn = guardModal.getByRole('button', { name: /No, descartar/i });
    await expect(discardBtn).toBeVisible();
    const backBtn = guardModal.getByRole('button', { name: /Volver al rampage/i });
    await expect(backBtn).toBeVisible();

    // 8. Probar "Volver al rampage" -> no descarta ni sobrescribe la sesión activa
    await backBtn.click();
    await expect(guardModal).not.toBeVisible();
    await expect(playerDialog).toBeVisible();

    // 9. Si volvemos a pulsar generar y elegimos "No, descartar", procede con la nueva generación
    await customizeBtn.click();
    await expect(generateBtn).toBeVisible();
    await generateBtn.click();
    await expect(guardModal).toBeVisible();
    await discardBtn.click();
    await expect(guardModal).not.toBeVisible();
  });

  test('Al pulsar sobre el orbe para crear un rampage, abre el menú de personalización', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Ocultar dev fixture toggle si está presente para no interceptar clics
    await page.addStyleTag({
      content: '[data-testid="break-ui-toggle"]{display:none !important;pointer-events:none !important;}',
    });

    // 1. Pulsar sobre el orbe en el Dashboard para abrir el menú de creación
    const heroOrb = page.locator('button.hero-orb');
    await expect(heroOrb).toBeVisible();
    await heroOrb.click({ force: true });

    // 2. En el menú de creación, seleccionar la opción "Rampage" visible (sea móvil o escritorio)
    const rampageActionBtn = page.locator('.create-action:visible', { hasText: 'Rampage' });
    await expect(rampageActionBtn).toBeVisible();
    await rampageActionBtn.click({ force: true });

    // 3. Debe abrir el reproductor y desplegar INMEDIATAMENTE el menú de personalización
    const customizerHeading = page.getByRole('heading', { name: /Personalizar tu Rampage/i });
    await expect(customizerHeading).toBeVisible();

    const topicInput = page.locator('#custom-topic');
    await expect(topicInput).toBeVisible();

    // 4. El usuario puede escribir su intención personalizada
    await topicInput.fill('Abundancia y éxito absoluto en mis proyectos');
    await expect(topicInput).toHaveValue('Abundancia y éxito absoluto en mis proyectos');

    // 5. El botón de generación con IA está listo para iniciar
    const generateBtn = page.getByRole('button', { name: /Generar con IA y Reproducir/i });
    await expect(generateBtn).toBeVisible();
  });

  test('Al crear un nuevo rampage y luego otro, el anterior cuenta como reproducido 1 vez y se coloca bajo el reproductor', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // 1. Ir a la sección Rampages y crear el primer Rampage (Set 1)
    const sidebar = page.locator('aside[aria-label="Navegación lateral"]');
    await sidebar.getByRole('button', { name: /Rampages/i }).click();

    await page.getByRole('button', { name: /Crear Set Propio/i }).click();
    const editorModal = page.getByRole('dialog', { name: /Crear Set de Rampage Propio/i });
    await expect(editorModal).toBeVisible();

    await page.fill('#rampage-title', 'Primer Rampage de Prueba');
    const phraseInput = page.getByPlaceholder(/Escribe una afirmación en primera persona/i);
    await phraseInput.fill('Mi energía crea abundancia ilimitada');
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: /Crear Rampage/i }).click();
    await expect(editorModal).not.toBeVisible();

    // 2. Crear el segundo Rampage (Set 2)
    await page.getByRole('button', { name: /Crear Set Propio/i }).click();
    await expect(editorModal).toBeVisible();
    await page.fill('#rampage-title', 'Segundo Rampage de Prueba');
    await phraseInput.fill('Todo fluye en perfecta armonía y paz');
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: /Crear Rampage/i }).click();
    await expect(editorModal).not.toBeVisible();

    // 3. Volver al Inicio / Dashboard
    await sidebar.getByRole('button', { name: /Inicio/i }).click();

    // 4. El reproductor principal debe mostrar el último creado (Segundo Rampage de Prueba)
    const continuePlayer = page.locator('[data-testid="continue-listening-player"]');
    await expect(continuePlayer).toBeVisible();
    await expect(continuePlayer.getByText('Segundo Rampage de Prueba')).toBeVisible();

    // 5. Justo debajo del reproductor, en "Últimos reproducidos", debe figurar el primer rampage ("el anterior")
    // contando como reproducido 1 vez
    const recentBlock = page.locator('p:has-text("Últimos reproducidos")').locator('..').locator('..');
    await expect(recentBlock).toBeVisible();
    const previousCard = recentBlock.locator('div[role="button"]', { hasText: 'Primer Rampage de Prueba' });
    await expect(previousCard).toBeVisible();
    await expect(previousCard.getByText(/1 reproducción/i)).toBeVisible();

    // 6. El rampage actualmente en el reproductor NO debe repetirse en el historial / últimos reproducidos
    const activeCardInRecent = recentBlock.locator('div[role="button"]', { hasText: 'Segundo Rampage de Prueba' });
    await expect(activeCardInRecent).not.toBeVisible();
  });
});
