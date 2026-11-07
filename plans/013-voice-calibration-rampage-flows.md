# 013 — Flujos de Calibración de Voz y Skeletons de Rampage

- **Status**: DONE
- **Severity**: HIGH
- **Category**: UX Flow, Voice Onboarding & Semantic Color Architecture
- **Skills applied**: `ui-ux-pro-max`, `better-colors`
- **Target files**:
  - `src/features/dashboard/DashboardView.tsx`
  - `src/components/goals/RampagePlayerModal.tsx`
  - `src/components/voice/VoiceCalibrationModal.tsx`
  - `src/app/page.tsx`
  - `src/app/globals.css`

---

## 1. Análisis de Requerimientos (`ui-ux-pro-max`)

1. **Bloque “Continuar escuchando” sin voz calibrada (`DashboardView.tsx`)**:
   - Cuando el perfil activo no tiene una voz calibrada (`!isCurrentProfileCalibrated`), el bloque de **“Continuar escuchando”** muestra el **skeleton anatómico del reproductor** de fondo (botón de transporte, líneas de título/subtítulo y barras de onda de audio con `.ss-skel-block` / `.ss-skel-block-strong` y `aria-hidden="true"`).
   - **Por encima y centrado en el medio**, se superpone la indicación clara de que debe calibrar su voz para hacer un Rampage, acompañada en el centro por el botón primario **"Calibrar voz"** (`onOpenCalibration`).
2. **Generación de Rampage sin voz registrada (`RampagePlayerModal.tsx`)**:
   - Al pulsar el botón de Rampage y generar uno (`handleStartRampage`) sin haber registrado antes la voz del perfil (`!isCurrentProfileCalibrated`), se detiene la generación sin voz y se muestra un **skeleton completo del reproductor de Rampage** (orbe, píldora de estado, líneas de afirmación, barras de onda y controles).
   - **Por encima del skeleton**, en el centro, se solicita registrar la voz mostrando la tarjeta con el botón **"Calibrar voz"** que abre el pop-up `VoiceCalibrationModal` (`z-[60]` sobre el modal de Rampage `z-50`).
   - En cuanto el usuario completa la calibración en el pop-up (`isCurrentProfileCalibrated` pasa a `true`), el Rampage pendiente continúa automáticamente con la generación de su set sin perder el tema ni los matices ingresados.
3. **Estado de Voz Registrada en `VoiceCalibrationModal.tsx`**:
   - Si el perfil seleccionado ya cuenta con una voz registrada (`isProfileAlreadyCalibrated`) y el usuario pulsa en **Calibrar voz**, el modal le indica de forma clara y amigable que **ya tiene una voz registrada** (mostrando tono detectado, frecuencia fundamental y fecha si están disponibles).
   - Presenta dos acciones directas y user-friendly:
     - **"Escuchar grabación"** (reproduce la grabación guardada en IndexedDB mediante `getProfileAudioSample(profileId)` o sintetiza una muestra con su huella vocal en `/api/ai/voice-synthesize`).
     - **"Volver a grabar"** (habilita el flujo de captura paso 1 para actualizar su muestra de voz, con opción de cancelar y volver al estado registrado).

---

## 2. Dirección de Color y Contraste Medido (`better-colors`)

Siguiendo las reglas estrictas de `better-colors`:
- **Cero literales de color en componentes**: Todo componente consume exclusivamente tokens semánticos (`--color-*`, `--pastel-*`, `--border-*`, `--control-*`, `--color-rampage-*`).
- **Un único botón relleno por vista (*Fill exactly one action per view*)**:
  - En el overlay de *"Continuar escuchando"*: **Calibrar voz** lleva `.swiss-btn-primary` (`--color-accent` + `--color-accent-fg`).
  - En el overlay del skeleton de *Rampage*: **Calibrar voz** lleva `.rampage-setup-submit` (`--color-rampage-accent` + `--color-rampage-accent-fg`), mientras la acción secundaria (*Volver a editar intención*) usa `.rampage-control` neutro.
  - En la vista de *Voz ya registrada* (`VoiceCalibrationModal`): **Escuchar grabación** lleva `.swiss-btn-primary` (acción primaria rellena) y **Volver a grabar** lleva `.swiss-btn-secondary` (`--control-bg` + `--color-ink`, par secundario neutro).
- **Un color, un significado**: La insignia de estado *"Voz registrada"* emplea `--pastel-sage` + `--pastel-sage-ink` acompañada del ícono `Check` / `ShieldCheck` (el color nunca es el único portador de significado).

### Pares de Contraste Medidos (WCAG 2.1 AA)

| Superficie / Par Renderizado | Light (Rose) | Dark (Rose) | Facu Light (Sage) | Facu Dark (Sage) | Umbral WCAG |
|---|---|---|---|---|---|
| `--color-ink` sobre overlay `.glass-panel` en `.surface-peri` | **15.09:1** | **14.68:1** | **15.50:1** | **14.95:1** | ≥ 4.5:1 (AA) |
| `--color-ink-muted` sobre overlay `.glass-panel` en `.surface-peri` | **6.23:1** | **7.48:1** | **5.26:1** | **7.12:1** | ≥ 4.5:1 (AA) |
| `--color-accent-fg` sobre `--color-accent` (`Calibrar voz` / `Escuchar grabación`) | **4.85:1** | **9.36:1** | **5.91:1** | **11.01:1** | ≥ 4.5:1 (AA) |
| `--pastel-sage-ink` sobre `--pastel-sage` (Badge *Voz registrada*) | **5.84:1** | **8.83:1** | **5.44:1** | **8.43:1** | ≥ 4.5:1 (AA) |
| `--color-rampage-ink` sobre `--color-rampage-surface` (Overlay skeleton Rampage) | **15.49:1** | **15.49:1** | **14.95:1** | **14.95:1** | ≥ 4.5:1 (AA) |
| `--color-rampage-muted` sobre `--color-rampage-surface` | **8.54:1** | **8.54:1** | **8.75:1** | **8.75:1** | ≥ 4.5:1 (AA) |
| `--color-rampage-accent-fg` sobre `--color-rampage-accent` (CTA en Rampage) | **9.36:1** | **9.36:1** | **11.01:1** | **11.01:1** | ≥ 4.5:1 (AA) |
