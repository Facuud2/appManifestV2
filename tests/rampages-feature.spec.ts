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
});
