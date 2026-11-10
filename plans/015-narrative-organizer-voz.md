# 015 — Organizador Narrativo Conversacional por Voz (estilo Siri)

- **Estado:** IMPLEMENTADO Y VERIFICADO (Rediseño Estilo Siri Minimalista, 12/12 Playwright tests + Next.js build verdes)
- **Prioridad:** HIGH
- **Área:** IA multimodal, voz en tiempo real, UI Apple Siri, persistencia Turso
- **Archivo:** `plans/015-narrative-organizer-voz.md`

---

## 1. Veredicto sobre el plan inicial

El plan inicial es correcto en producto y dirección, pero **no es implementable tal cual** contra el código actual sin resolver estas brechas:

1. El perfil real se llama `shared`, no `juntos`.
2. El contrato JSON propuesto no se puede persistir completo: `metadata` no existe como columna y `linkedToId` es ambiguo.
3. La "transacción única de Turso" no existe en `/api/sync`; hay que crear un endpoint de commit con `turso.batch(..., 'write')`.
4. El esquema `SuccessStorySchema` no declara `manifestationId` y el route usa un hack con `goalId`.
5. No hay soporte de sandbox determinista para probar voz sin micrófono real.
6. No hay idempotencia: doble tap en "Sí" puede duplicar registros.
7. El overlay no puede reutilizar `VoiceActionToast` ni `VoiceActionOrb` tal cual, porque esos componentes tienen botones "Listo", "Deshacer" y "Cambiar tipo", prohibidos por la especificación.
8. El long press del botón `+` ya está ocupado por `useVoiceActionRouter`; hay que decidir explícitamente si el nuevo organizador lo reemplaza o convive detrás de un flag.
9. `LayoutGroup` + `layout` de Framer ya usa `ResizeObserver` internamente; no hace falta un `ResizeObserver` manual.
10. La UI actual tiene z-index `40` (bottom nav), `50` (VoiceActionOrb), `60/61` (CreateActionMenu); el nuevo overlay necesita una capa superior y un orden de cierre claro.

La propuesta corregida mantiene intacta la experiencia de producto: **un solo botón afirmativo**, **orbe para corregir por voz**, **backdrop para cancelar**, **cero escrituras hasta confirmar**.

---

## 2. Estado actual verificado del proyecto

### 2.1 Stack

- Next.js `15.1.7` (App Router), React `19`, TypeScript `5.7`, Tailwind `3.4`.
- Framer Motion `12.4.7`.
- Zustand `5.0.3` para estado global.
- `@libsql/client` `0.18` contra Turso.
- `@google/genai` `2.32` con `gemini-3.5-flash` y `responseMimeType: "application/json"`.
- No hay `@playwright/test` en `package.json`; Playwright se ejecuta vía `npx` (versión disponible `1.65.0`).

### 2.2 Archivos clave que se van a tocar o reutilizar

| Archivo | Rol actual | Impacto |
|---|---|---|
| `src/app/page.tsx` | Orquesta tabs, modales, `useVoiceActionRouter` y `VoiceActionOrb` | Integrar el nuevo hook/overlay y decidir el long press |
| `src/hooks/useVoiceActionRouter.ts` | Long press de 300 ms, MediaRecorder, VAD, fetch a `/api/ai/voice-command` | Se reutilizan helpers de micrófono; se reemplaza o se pone detrás de flag |
| `src/lib/microphone.ts` | `getMicrophoneStream`, `createSafeMediaRecorder`, `connectAudioAnalyser` | Reutilizar sin cambios |
| `src/components/voice/VoiceActionOrb.tsx` | Orbe Siri y panel de respuesta con botones "Listo/Deshacer" | Exporta `SiriOrb` reutilizable; el panel viejo no se usa en el nuevo flujo |
| `src/components/layout/BottomNavigation.tsx` | Acepta `createGestureProps` en el botón `+` | No requiere cambios de API; se le pasa el nuevo gesto |
| `src/components/layout/CreateActionMenu.tsx` | Menú de creación con backdrop en `z-[60]` y panel `z-[61]` | Se mantiene para el tap corto |
| `src/app/api/sync/route.ts` | CRUD por entidad, validación Zod, sin batch transaccional | Se agrega endpoint de commit; no se mete la lógica de IA acá |
| `src/store/index.ts` | Colecciones por scope, `addManifestation`, `addProgressLog`, `addSuccessStory`, `addAffirmation` | Agregar `applyNarrativeCommit` para reflejar el commit atómico sin refetch |
| `src/schemas/index.ts` | Esquemas Zod de mutaciones | Corregir `SuccessStorySchema` y agregar esquemas del organizador |
| `src/lib/gemini.ts` | Cliente Gemini, cuota diaria, prompt de Voice Action Router | Agregar el módulo de organizador sin romper el router existente |
| `src/lib/affirmationEngine.ts` | `findPoeticTerm`, `sanitizeAffirmations`, fallbacks | Validar afirmaciones generadas |
| `src/types/index.ts` | `UserScope = 'facu' \| 'maia' \| 'shared'` | Usar `shared`, no `juntos` |
| `scripts/migrate.js` | Crea tablas y columnas | No requiere migración nueva si se usa `description` para contexto |

### 2.3 Restricciones reales del modelo de datos

- `ManifestationItem` (`src/store/index.ts:53`) tiene: `id`, `userId`, `author`, `title`, `description`, `sensoryAnchor`, `category`, `status`, `targetDate`, `songAttachment`, `mediaAttachment`, `createdAt`, `updatedAt`.
  - **No tiene `metadata`.** El contexto del relato se debe guardar dentro de `description` o en `sensoryAnchor`. Se elige `description` con un bloque `Contexto:` para no migrar la tabla.
- `ProgressLog` (`src/store/index.ts:43`) tiene: `id`, `manifestationId`, `userId`, `note`, `signType`, `voiceTranscript`, `createdAt`.
  - **No tiene `title`.** `ProgressTimeline` genera el título a partir de la primera línea de `note` (`generateCleanTitle`) y usa las líneas siguientes como descripción. Por eso el commit debe guardar `note = "{title}\n{content}"`.
- `SuccessStory` (`src/types/index.ts:167`) tiene `manifestationId`, `title`, `story`, `manifestedDate`, `gratitudeNote`, etc.
  - `SuccessStorySchema` (`src/schemas/index.ts:41`) **no declara `manifestationId`** y `/api/sync` usa `valid.goalId || data.manifestationId` (`src/app/api/sync/route.ts:358`). Hay que corregirlo antes de reutilizar el esquema.
- `Affirmation` (`src/types/index.ts:75`) tiene `text`, `category`, `repeatCount`, `pinned`, `order`, `createdAt`.
  - El commit debe calcular `sort_order` al final de las no fijadas.
- `MediaRecorder` usa 32 kbps solo para `audio/webm` (`src/lib/microphone.ts:107-109`). En iOS se usa `audio/mp4`/`audio/aac` sin control de bitrate. Es aceptable.

---

## 3. Correcciones concretas al plan inicial

| # | Plan inicial | Problema | Corrección |
|---|---|---|---|
| 1 | `profileId: 'facu' \| 'maia' \| 'juntos'` | `UserScope` real es `'facu' \| 'maia' \| 'shared'` | Usar `'facu' \| 'maia' \| 'shared'`; la etiqueta UI sigue siendo "Juntos". Si llega `'juntos'`, mapear a `'shared'`. |
| 2 | `metadata` en manifestación | No existe columna | Persistir `content` en `description` y agregar `\n\nContexto: {metadata}`. El `summary` para `existingContext` sale de `description`. |
| 3 | `linkedToId` + `isLinkedToTemp` | Ambigüedad si un ID existe y otro no | Usar `link: { kind: 'existing' \| 'temp' \| 'none', id?: string }`. Aceptar el formato viejo solo como compatibilidad de entrada. |
| 4 | `progressLogs` sin `tempId` | No se puede animar ni idempotizar por elemento | Agregar `tempId` a manifestaciones, avances, éxitos y afirmaciones. |
| 5 | `successStories` sin `tempId` ni vínculo explícito | Mismo problema | Agregar `tempId` y `link`. |
| 6 | `rampageToStart` sin contenido | Si solo trae un tema, hace falta una segunda llamada a IA | Incluir `title`, `count`, `affirmations[]`, `ambientSound` en la misma respuesta. Si no hay afirmaciones válidas, `rampageToStart = null`. |
| 7 | "Transacción única de Turso" | `/api/sync` no tiene batch | Crear `POST /api/ai/narrative-organizer/commit` y usar `turso.batch(statements, 'write')`. |
| 8 | Sin idempotencia | Doble tap puede duplicar | `draftId` + `tempId` generan IDs deterministas; el botón se bloquea durante el commit; el SQL usa `ON CONFLICT(id) DO UPDATE`. |
| 9 | Sin sandbox | Playwright no tiene micrófono real | `sandbox=true` + `scenario` + `spokenText` producen un plan determinista sin llamar a Gemini. |
| 10 | `LayoutGroup` + `ResizeObserver` | Framer ya usa ResizeObserver para `layout` | Usar `LayoutGroup` + `motion.div layout`; no agregar observer manual salvo que aparezca un caso real. |
| 11 | Overlay con "Orbe flotando en la base del panel" | El orbe debe seguir siendo interactivo y no cerrar el backdrop | El orbe va dentro del panel con `stopPropagation`; el backdrop solo cancela si el target es el contenedor exterior. |
| 12 | "Cancelar en cualquier momento tocando fuera" | En mobile un gesto que empieza dentro y termina fuera puede disparar el click del backdrop | Usar un contenedor full-screen con `onClick` y `event.target === event.currentTarget`; el panel hace `stopPropagation`. |
| 13 | "Limpiar estado al cancelar" | Si se limpia antes de la animación de salida, el overlay se vacía | Abortar y detener micrófono inmediatamente; limpiar draft/transcript en `onExitComplete` o a los ~200 ms. |
| 14 | "Sin botón de cerrar" | Accesibilidad de teclado | Agregar `Escape` como equivalente de cancelación y `aria-describedby` con "Toca fuera para cancelar". No agregar botón visible "Cancelar". |
| 15 | "Feedback háptico/visual" | iOS Safari no soporta `navigator.vibrate` | Haptics best-effort + check visual animado; el feedback visual es el principal. |
| 16 | `gemini-3.5-flash` | El proyecto ya usa ese modelo con fallback a `gemini-2.5-flash` | Mantener `gemini-3.5-flash`; un solo fallback, contando cuota. No hacer fallback automático múltiple para no gastar RPD. |
| 17 | `siriResponse` | Puede ser largo y empujar el CTA fuera de pantalla | Limitar a 2 oraciones / ~220 caracteres en el prompt y truncar en el normalizador. |
| 18 | "Afirmaciones / Rampages" como cuarta categoría | Rampage no es una entidad persistida en este flujo | Tratarlo como acción opcional `rampageToStart`; no crear un registro en `rampage_sets` salvo pedido explícito futuro. |

---

## 4. Arquitectura propuesta

### 4.1 Archivos nuevos

```
src/app/api/ai/narrative-organizer/route.ts          # analiza audio + draft + contexto
src/app/api/ai/narrative-organizer/commit/route.ts   # commit atómico del plan confirmado
src/lib/narrativeOrganizer.ts                        # tipos, Zod, prompt, normalizador, sandbox
src/lib/narrativeCommit.ts                           # mapeo plan -> statements SQL + IDs
src/hooks/useNarrativeOrganizer.ts                   # grabación, VAD, abort, estado, commit
src/components/voice/SiriOrganizerOverlay.tsx        # overlay de propuesta + orbe + CTA único
src/components/voice/NarrativePreviewCard.tsx        # tarjeta/píldora de vista previa (opcional)
scripts/test-narrative-organizer.mjs                 # E2E Playwright en sandbox
tests/narrativeOrganizer.test.ts                     # unit tests del normalizador (opcional)
```

### 4.2 Archivos modificados

```
src/app/page.tsx                     # integra hook + overlay; decide long press
src/store/index.ts                   # applyNarrativeCommit()
src/schemas/index.ts                 # SuccessStorySchema + esquemas del organizador
src/types/index.ts                   # (opcional) tipos compartidos del draft
src/components/voice/VoiceActionOrb.tsx  # reutilizar SiriOrb; no romper export
package.json                         # @playwright/test y script de test
```

No se modifica `src/lib/turso.ts`, no se agregan tablas ni columnas.

### 4.3 Flujo de datos

```
[Long press +]
     │
     ▼
useNarrativeOrganizer.open()
     │  getUserMedia + MediaRecorder + AnalyserNode
     ▼
[Usuario habla] ──VAD 2s de silencio──► stopAndSubmit()
     │
     ▼
POST /api/ai/narrative-organizer (multipart)
  audio + profileId + currentDraft + existingContext + draftId + sandbox
     │
     ▼
Gemini 3.5 Flash (1 sola llamada)
     │  JSON validado y normalizado
     ▼
NarrativeDraft { userTranscript, siriResponse, proposedPlan }
     │
     ├──► [Review] tarjetas + CTA "Sí, registrar todo ✨" + Orbe
     │
     ├──► [Orbe] re-grabar -> nuevo POST con currentDraft
     │
     ├──► [Backdrop] abort + cleanup + cerrar (sin DB)
     │
     └──► [Sí] POST /api/ai/narrative-organizer/commit
                │
                ▼
          turso.batch(..., 'write')  // atómico
                │
                ▼
          applyNarrativeCommit() -> feedback -> cerrar
```

---

## 5. Contrato JSON corregido

### 5.1 Tipos TypeScript

```ts
export type NarrativeProfileId = 'facu' | 'maia' | 'shared';

export interface ExistingContextItem {
  id: string;
  title: string;
  personNames: string[];
  summary: string;
}

export type NarrativeLink =
  | { kind: 'existing'; id: string }
  | { kind: 'temp'; id: string }
  | { kind: 'none' };

export interface ProposedManifestation {
  tempId: string;                    // m_1, m_2...
  isNewPersonWithSameName: boolean;  // true si el usuario aclaró que NO es la persona anterior
  title: string;                     // max 280
  content: string;                   // presente cumplido, max 10000
  context?: string;                  // metadata del relato (edad, cómo se conocieron)
  category?: string;                 // relaciones, abundancia, etc.
  status?: 'semilla' | 'alineacion' | 'evidencia' | 'materializado';
}

export interface ProposedProgress {
  tempId: string;                    // p_1...
  title: string;
  content: string;
  link: NarrativeLink;
  signType?: 'coincidence' | 'angel_number' | 'dream' | 'intuitive';
}

export interface ProposedSuccess {
  tempId: string;                    // s_1...
  title: string;
  content: string;
  link: NarrativeLink;
  manifestedDate?: string;           // YYYY-MM-DD
}

export interface ProposedAffirmation {
  tempId: string;                    // a_1...
  text: string;                      // max 1000
  category?: string;
}

export interface ProposedRampage {
  title: string;
  count: 5 | 11 | 15;
  affirmations: string[];
  ambientSound: 'white_noise' | 'astral_rain' | 'none';
}

export interface NarrativeDraft {
  draftId: string;                   // lo genera el cliente, no la IA
  userTranscript: string;
  siriResponse: string;
  proposedPlan: {
    manifestations: ProposedManifestation[];
    progressLogs: ProposedProgress[];
    successStories: ProposedSuccess[];
    affirmations: ProposedAffirmation[];
    rampageToStart: ProposedRampage | null;
  };
}
```

### 5.2 Ejemplo de respuesta esperada

```json
{
  "userTranscript": "Vengo manifestando conocer a una chica tierna y cálida. Conocí a Sabrina en Tinder, volvimos a hablar, me pasó su número y tuvimos un buen encuentro. Próximamente quiero entablar una relación con ella.",
  "siriResponse": "Entendido. Voy a crear una manifestación para Sabrina, registrar el encuentro de Tinder como avance vinculado y sumar la afirmación sobre tener una chica tierna y cálida.",
  "proposedPlan": {
    "manifestations": [
      {
        "tempId": "m_1",
        "isNewPersonWithSameName": false,
        "title": "Relación y juntadas con Sabrina",
        "content": "Estoy en una relación increíble con Sabrina y compartimos muchísimas juntadas.",
        "context": "Conocida en Tinder; tierna, cálida y siempre está para mí.",
        "category": "relaciones",
        "status": "semilla"
      }
    ],
    "progressLogs": [
      {
        "tempId": "p_1",
        "title": "Primer encuentro con Sabrina",
        "content": "Volvimos a hablar por Tinder, me pasó su número y tuvimos un muy buen encuentro.",
        "link": { "kind": "temp", "id": "m_1" },
        "signType": "coincidence"
      }
    ],
    "successStories": [],
    "affirmations": [
      {
        "tempId": "a_1",
        "text": "Tengo una chica tierna y cálida que siempre está para mí y me habla con la mejor onda",
        "category": "Vínculos"
      }
    ],
    "rampageToStart": null
  }
}
```

### 5.3 Reglas de normalización del servidor

El servidor **nunca confía** en el JSON del modelo ni del cliente. `normalizeNarrativeDraft()` debe:

1. Quitar code fences y parsear JSON.
2. Validar con Zod; si falla, intentar reparar campos faltantes con defaults.
3. Forzar `draftId` del request (ignorar el que devuelva el modelo).
4. Garantizar `tempId` único por tipo; generar `m_1`, `p_1`, etc. si faltan.
5. Limitar cantidades: máx. 10 manifestaciones, 20 avances, 10 éxitos, 20 afirmaciones, 1 rampage.
6. Truncar textos a los límites de DB:
   - título 280, descripción/contenido 10000, afirmación 1000, contexto 1000.
7. Validar `link`:
   - `kind: 'existing'`: el ID debe existir en `existingContext` o en la DB del perfil.
   - `kind: 'temp'`: el ID debe existir en `proposedPlan.manifestations`.
   - Si no se puede resolver, dejar `{ kind: 'none' }`.
8. Si un avance/éxito no tiene vínculo, permitir `none` (la DB lo permite) y mostrarlo como "Sin vincular". No inventar una manifestación automáticamente.
9. Aceptar el formato legacy `linkedToId` + `isLinkedToTemp` y convertirlo a `link`.
10. Filtrar afirmaciones con `findPoeticTerm()`; descartar duplicadas normalizadas (sin acentos/mayúsculas).
11. Validar `rampageToStart`: `count` en 5/11/15, `affirmations.length >= count`, `ambientSound` válido; si no, `null`.
12. Si `proposedPlan` queda vacío, `siriResponse` debe invitar a repetir y la UI no muestra el CTA.

---

## 6. System prompt del organizador

Va en `src/lib/narrativeOrganizer.ts` como `buildNarrativeOrganizerSystemPrompt({ existingContext, currentDraft })`. Debe ser explícito y en español rioplatense neutro.

### 6.1 Bloques obligatorios

1. **Rol y límites:** "Sos el organizador narrativo de Manifest. Escuchás un relato libre y lo separás en registros. No inventás datos."
2. **Separación multi-temporal:**
   - Intención pasada / cualidades buscadas → `affirmations` en presente simple.
   - Hecho reciente / paso intermedio → `progressLogs`.
   - Materialización final → `successStories`.
   - Deseo a futuro → `manifestations` en presente cumplido.
3. **Estilo Ley de la Asunción:** primera persona, presente, cero lenguaje poético/New Age. Lista negra explícita: `fluir`, `latido`, `sagrado`, `vibrar`, `frecuencia`, `sintonizar`, `sendero`, `brisa`, `gratitud`, `universo conspiró`, `certeza plena`, `luz`, `energía`, `merecer`.
4. **Homónimos:**
   - Por defecto, si un nombre coincide con `existingContext`, vincular al `id` existente.
   - Si el usuario dice "no es la misma", "otra", "nueva", "distinta", "una Sabrina diferente": crear manifestación nueva con `isNewPersonWithSameName: true`, `tempId: "new_m_1"`, título con diferenciador (`Sabrina (Tinder)`) y **prohibido** vincular al `existingId`.
   - Si `currentDraft` ya estaba vinculado al ID viejo y el nuevo audio aclara, mover el `link` del avance/éxito al nuevo `tempId` y quitar el vínculo viejo.
   - Si hay ambigüedad, vincular por defecto y explicarlo en `siriResponse`: "Lo vinculé a la Sabrina que ya tenías; si es otra, tocá el orbe y decime 'no es la misma'".
5. **Ajuste acumulativo:**
   - Si `currentDraft` no es `null`, el audio es una corrección/adición.
   - Modificar solo las piezas indicadas; mantener el resto intacto.
   - Actualizar `siriResponse` explicando el ajuste.
6. **Vínculos:**
   - Todo avance/éxito debe intentar vincularse a una manifestación existente o a una temporal.
   - Si no hay coincidencia, crear una manifestación temporal con el deseo inferido, salvo que el relato no lo permita; en ese caso `link: none`.
7. **Rampage:**
   - Solo si el usuario lo pide explícitamente ("hacé un rampage", "quiero escuchar afirmaciones").
   - Generar 5, 11 o 15 afirmaciones en la misma respuesta, con el estilo directo.
   - Si no se pide, `rampageToStart: null`.
8. **Formato:**
   - `userTranscript`: transcripción limpia y puntuada.
   - `siriResponse`: máximo 2 oraciones, explica exactamente qué se va a guardar.
   - `proposedPlan`: arrays; pueden ser vacíos.
   - Sin markdown, sin texto fuera del JSON.
9. **Prohibiciones:**
   - No inventar nombres, edades, fechas ni lugares que no estén en el audio, `currentDraft` o `existingContext`.
   - No usar "metadata" como campo; usar `context`.
   - No devolver IDs de DB que no estén en `existingContext`.
   - No mezclar perfiles (`facu`, `maia`, `shared`).

### 6.2 Llamada a Gemini

```ts
const response = await ai.models.generateContent({
  model: 'gemini-3.5-flash',
  contents: [{
    role: 'user',
    parts: [
      { inlineData: { mimeType: cleanMime, data: audioBuffer.toString('base64') } },
      { text: prompt },
    ],
  }],
  config: {
    systemInstruction,
    temperature: 0.2,
    responseMimeType: 'application/json',
    maxOutputTokens: 4096,
  },
});
```

- `cleanMime`: normalizar `audio/m4a`, `audio/x-m4a`, `video/mp4` → `audio/mp4`; default `audio/webm`.
- Timeout de servidor: 45 s. Si el SDK no acepta `AbortSignal`, usar `Promise.race` y registrar el error.
- Cuota: `getDailyAiUsage()` antes; `incrementDailyAiUsage(1)` después de recibir respuesta (aunque el parseo falle, porque la llamada ya se consumió).
- Sandbox: no llamar a Gemini y no incrementar cuota.

---

## 7. Endpoints

### 7.1 `POST /api/ai/narrative-organizer`

**Archivo:** `src/app/api/ai/narrative-organizer/route.ts`

- `export const dynamic = 'force-dynamic'`
- `export const runtime = 'nodejs'`
- Acepta `multipart/form-data` y `application/json` (para tests de API).
- Campos:
  - `audio`: `File` (multipart) o `audioBase64` (JSON).
  - `profileId`: `'facu' | 'maia' | 'shared'` (mapear `'juntos'` → `'shared'`).
  - `draftId`: string.
  - `currentDraft`: JSON string o `null`.
  - `existingContext`: JSON string `ExistingContextItem[]`.
  - `sandbox`: `'true' | 'false'`.
  - `spokenText`: solo sandbox/test.
  - `scenario`: solo sandbox/test (`'sabrina_initial' | 'sabrina_add_age' | 'sabrina_homonym' | 'sabrina_unlink' | 'unclear'`).
- Validaciones:
  - Cuota diaria (`>= 100` → 429).
  - `audioBuffer.length >= 200` si no es sandbox.
  - Tamaño máximo 10 MB.
  - `profileId` válido.
  - `existingContext` máximo 50 ítems, `summary` máximo 300 caracteres.
- Respuesta:
  ```json
  {
    "success": true,
    "data": { "...NarrativeDraft": true },
    "quotaUsedToday": 12,
    "source": "GEMINI_LIVE" | "SANDBOX_MOCK"
  }
  ```
- Errores:
  - 400 input inválido.
  - 413 audio demasiado grande.
  - 429 cuota.
  - 502 Gemini falló.
  - 504 timeout.
- Logs: nunca loguear `audioBase64` ni el buffer. Solo `error.message`.

### 7.2 `POST /api/ai/narrative-organizer/commit`

**Archivo:** `src/app/api/ai/narrative-organizer/commit/route.ts`

- Body JSON:
  ```json
  {
    "draftId": "uuid",
    "profileId": "shared",
    "currentDraft": { "...NarrativeDraft": true }
  }
  ```
- Validaciones:
  - Mismo origin check que `/api/sync` (helper compartido).
  - `profileId` válido.
  - `currentDraft.proposedPlan` normalizado de nuevo en servidor.
  - IDs `existing` pertenecen al perfil (`SELECT id FROM manifestations WHERE user_id = ? AND id IN (...)`).
  - No confiar en `author` ni `userId` del cliente; derivarlos del perfil.
- IDs deterministas:
  - `manif_${draftIdShort}_${tempId}`
  - `prog_${draftIdShort}_${tempId}`
  - `story_${draftIdShort}_${tempId}`
  - `aff_${draftIdShort}_${tempId}`
  - `draftIdShort` = primeros 8 chars de `draftId` sin guiones. Longitud final < 128.
- Transacción:
  ```ts
  await turso.batch(statements, 'write');
  ```
  Si una sentencia falla, Turso revierte todo el batch.
- Respuesta:
  ```json
  {
    "success": true,
    "data": {
      "manifestations": [],
      "progressLogs": [],
      "successStories": [],
      "affirmations": [],
      "skippedAffirmations": [],
      "rampageToStart": null
    }
  }
  ```
- No incrementa cuota de IA.
- Si `draftId` ya fue commiteado, el upsert por ID determinista evita duplicados y devuelve los mismos IDs.

### 7.3 SQL del commit

```sql
-- Manifestaciones
INSERT INTO manifestations
  (id, user_id, author, title, description, sensory_anchor, category, status, target_date, song_attachment, media_attachment, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, '', ?, ?, NULL, NULL, NULL, ?, ?)
ON CONFLICT(id) DO UPDATE SET
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  status = excluded.status,
  updated_at = excluded.updated_at;

-- Avances
INSERT INTO manifestation_progress
  (id, manifestation_id, user_id, note, sign_type, voice_transcript, created_at)
VALUES (?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET
  manifestation_id = excluded.manifestation_id,
  note = excluded.note,
  sign_type = excluded.sign_type,
  voice_transcript = excluded.voice_transcript;

-- Éxitos
INSERT INTO success_stories
  (id, manifestation_id, user_id, author, title, story, gratitude_note, manifested_date, created_at)
VALUES (?, ?, ?, ?, ?, ?, '', ?, ?)
ON CONFLICT(id) DO UPDATE SET
  manifestation_id = excluded.manifestation_id,
  title = excluded.title,
  story = excluded.story,
  manifested_date = excluded.manifested_date;

-- Afirmaciones
INSERT INTO affirmations
  (id, user_id, text, category, repeat_count, pinned, sort_order, created_at)
VALUES (?, ?, ?, ?, 0, 0, ?, ?)
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  category = excluded.category,
  sort_order = excluded.sort_order;

-- Si un éxito está vinculado, marcar la manifestación como materializada
UPDATE manifestations
SET status = 'materializado', updated_at = ?
WHERE id = ? AND user_id = ?;
```

Notas:
- `description` de manifestación: `content` + `\n\nContexto: ` + `context` si existe.
- `note` de avance: `${title}\n${content}` para que `ProgressTimeline` lo divida bien.
- `voice_transcript` del avance: `userTranscript` (opcional, por privacidad se puede dejar `null`; se recomienda guardarlo solo si el usuario confirma, que es el caso).
- `sort_order` de afirmaciones: `SELECT COALESCE(MAX(sort_order), -1) + 1 FROM affirmations WHERE user_id = ? AND pinned = 0` antes del batch. Si hay varias, incrementar.
- `manifestedDate`: `YYYY-MM-DD`; si falta, `new Date().toISOString().split('T')[0]`.

---

## 8. Hook `useNarrativeOrganizer`

**Archivo:** `src/hooks/useNarrativeOrganizer.ts`

### 8.1 Estado

```ts
type Phase = 'idle' | 'listening' | 'processing' | 'review' | 'committing' | 'success' | 'error';

interface State {
  isOpen: boolean;
  phase: Phase;
  draft: NarrativeDraft | null;
  transcript: string;
  error: string | null;
  holdProgress: number;
  analyserNode: AnalyserNode | null;
  quotaUsedToday: number | null;
}
```

### 8.2 Acciones

| Acción | Comportamiento |
|---|---|
| `open()` | Genera `draftId`, abre overlay, pide micrófono y empieza a grabar. |
| `startListening()` | Si está `processing`/`committing`, ignora. Si hay draft, lo conserva para el próximo turno. |
| `stopAndSubmit()` | Detiene el recorder, construye el Blob y hace `POST /api/ai/narrative-organizer`. |
| `reRecord()` | Desde `review`/`error`: mantiene `currentDraft`, vuelve a `listening`. |
| `confirm()` | `committing` → `POST /commit`; al éxito aplica el store, vibra y cierra. |
| `cancelAll()` | Aborta fetch, detiene tracks, cierra AudioContext, limpia timers, cierra overlay sin escribir. |
| `retryCommit()` | Reintenta el commit con el mismo draft; el botón "Sí" hace esto si el error fue de commit. |

### 8.3 Grabación

Reutilizar:

```ts
import {
  connectAudioAnalyser,
  createSafeMediaRecorder,
  getMicrophoneStream,
} from '@/lib/microphone';
```

- VAD igual al existente: calibrar ruido ~500 ms, detectar voz, 2 s de silencio → `stopAndSubmit()`.
- Duración máxima: 90 s; auto-stop.
- En `cancelAll()`:
  ```ts
  abortRef.current?.abort();
  mediaRecorderRef.current?.stop();
  mediaStreamRef.current?.getTracks().forEach(t => { t.stop(); t.enabled = false; });
  audioContextRef.current?.close();
  ```
- `currentDraft` se lee de `draftRef.current` para evitar closures viejos.
- `profileId` se lee de `activeScope`.
- `existingContext` se construye desde el store:
  ```ts
  manifestations
    .filter(m => m.userId === activeScope)
    .slice(0, 50)
    .map(m => ({
      id: m.id,
      title: m.title,
      personNames: extractPersonNames(`${m.title} ${m.description}`),
      summary: m.description.slice(0, 300),
    }));
  ```
- `extractPersonNames()`: helper simple que detecta palabras capitalizadas después de "con", "de", "para", "a" y descarta stopwords. Es solo una pista para el prompt; el modelo decide.

### 8.4 Commit y store

1. `confirm()` setea `phase='committing'`, `isCommittingRef=true`.
2. POST commit con `draftId`, `profileId`, `currentDraft`.
3. Si `success`:
   - `applyNarrativeCommit(data)` en el store.
   - `navigator.vibrate?.([20, 40, 20])` best-effort.
   - `phase='success'`.
   - Si `data.rampageToStart`, guardar payload para que `page.tsx` abra el reproductor después del cierre.
   - Cerrar overlay a los ~700 ms.
4. Si falla:
   - `phase='error'`, mostrar mensaje, mantener draft.
   - El CTA "Sí, registrar todo ✨" vuelve a estar activo para reintentar.
5. `applyNarrativeCommit`:
   - Inserta/actualiza por `id` en `manifestations`, `progressLogs`, `successStories`, `affirmations`.
   - Actualiza `scopeCollections[scope]`.
   - Deduplica por `id`.
   - No dispara `fetchRemoteData()` para evitar carreras con `syncRequestSequence`; opcionalmente se puede reconciliar en segundo plano después de cerrar.

### 8.5 Ciclo de vida

- `useEffect` al cambiar `activeScope`: `cancelAll()`.
- `useEffect` al desmontar: `cancelAll()`.
- `useEffect` al abrir: bloquear scroll del body (`overflow: hidden`), restaurar al cerrar.
- `isMountedRef` para no hacer `setState` después de desmontar durante un fetch abortado.

---

## 9. UI: `SiriOrganizerOverlay`

**Archivo:** `src/components/voice/SiriOrganizerOverlay.tsx`

### 9.1 Props

```ts
interface SiriOrganizerOverlayProps {
  isOpen: boolean;
  phase: Phase;
  draft: NarrativeDraft | null;
  transcript: string;
  error: string | null;
  analyserNode: AnalyserNode | null;
  onCancel: () => void;
  onConfirm: () => void;
  onReRecord: () => void;
  onStopAndSubmit: () => void;
  onExitComplete?: () => void;
}
```

### 9.2 Estructura visual

```
<AnimatePresence onExitComplete={onExitComplete}>
  <motion.div
    data-testid="narrative-organizer-overlay"
    role="dialog"
    aria-modal="true"
    aria-labelledby="narrative-organizer-title"
    aria-describedby="narrative-organizer-hint"
    className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center"
    onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
  >
    <motion.div className="absolute inset-0 bg-black/25 backdrop-blur-md" aria-hidden="true" />
    <motion.div
      className="relative z-[81] w-full max-w-[30rem] ... pointer-events-auto"
      onClick={(e) => e.stopPropagation()}
    >
      <header>Orbe pequeño + "Organizador" + "Gemini"</header>
      <p id="narrative-organizer-hint">Toca fuera para cancelar</p>

      {phase === 'listening' && <ListeningView ... />}
      {phase === 'processing' && <ProcessingView ... />}
      {phase === 'review' && <ReviewView ... />}
      {phase === 'committing' && <CommittingView ... />}
      {phase === 'success' && <SuccessView ... />}
      {phase === 'error' && <ErrorView ... />}
    </motion.div>
  </motion.div>
</AnimatePresence>
```

### 9.3 Estados

| Fase | Contenido | CTA |
|---|---|---|
| `listening` | Orbe 104, "Te escucho…", "Hablá y tocá el orbe para enviar". Si hay draft previo, mostrarlo atenuado. | Ninguno (el orbe envía). |
| `processing` | Orbe animado, "Ordenando tu relato…", skeleton de píldoras. | Ninguno. |
| `review` | `siriResponse`, transcript colapsado, tarjetas por categoría, orbe 64. | `Sí, registrar todo ✨` |
| `committing` | Tarjetas + spinner en el CTA. | `Registrando…` (disabled) |
| `success` | Check animado + "Listo, quedó registrado." | Ninguno; cierra solo. |
| `error` | Mensaje + detalle. Si fue analyze: orbe para reintentar. Si fue commit: CTA sigue visible. | `Sí, registrar todo ✨` (solo commit) / orbe (analyze). |

### 9.4 Tarjetas de vista previa

Cada tarjeta es **no interactiva** (no editar, no borrar):

- 🌱 **Manifestación** — título, `content`, `context`, badge "Nueva" o "Vinculada a {title}". Si `isNewPersonWithSameName`, badge "Persona nueva con el mismo nombre".
- 👣 **Avance** — título, `content`, badge "Vinculado a {title}" o "Sin vincular".
- 🏆 **Éxito** — título, `content`, badge de vínculo.
- ✨ **Afirmación** — texto, categoría.
- 🎧 **Rampage** — "Se va a iniciar al guardar · 11 afirmaciones".

Usar `<ul>`/`<li>` con `role="list"`, texto plano, `break-words`, `min-w-0`.
Colores con tokens existentes:
- Manifestación: `--pastel-sage` / `--pastel-sage-ink`.
- Avance: `--pastel-sky` / `--pastel-sky-ink`.
- Éxito: `--pastel-butter` / `--pastel-butter-ink`.
- Afirmación: `--pastel-peri` / `--pastel-peri-ink`.
- Rampage: `--pastel-peach` / `--pastel-peach-ink`.

No usar gradientes decorativos nuevos; el orbe ya usa su gradiente propio.

### 9.5 CTA único

```tsx
<button
  type="button"
  data-testid="narrative-confirm"
  onClick={onConfirm}
  disabled={phase === 'committing' || !hasItems}
  aria-busy={phase === 'committing'}
  className="swiss-btn-primary inline-flex min-h-12 w-full items-center justify-center gap-2 px-6 text-sm font-semibold disabled:opacity-60"
>
  {phase === 'committing' ? 'Registrando…' : 'Sí, registrar todo ✨'}
</button>
```

- **No** debe existir ningún botón "No", "Cancelar", "Editar", "Listo", "Deshacer" ni "Cambiar tipo" dentro del overlay.
- El backdrop y `Escape` son la cancelación.
- El orbe es la corrección.

### 9.6 Orbe

Reutilizar `SiriOrb` exportado de `src/components/voice/VoiceActionOrb.tsx`.

```tsx
<div className="flex flex-col items-center gap-1.5">
  <SiriOrb
    size={64}
    audioLevel={audioLevel}
    isProcessing={phase === 'processing' || phase === 'committing'}
    interactive={phase === 'review' || phase === 'listening' || phase === 'error'}
    onClick={phase === 'review' ? onReRecord : onStopAndSubmit}
  />
  <p className="text-xs text-swiss-ink-muted">
    {phase === 'review' ? 'Tocá el orbe para corregir por voz' : 'Tocá el orbe para enviar'}
  </p>
</div>
```

- `SiriOrb` hoy es un `div` con `role="button"` y `tabIndex=0`, pero no maneja teclado. Hay que agregarle `onKeyDown` (Enter/Space) y `aria-disabled`.
- El orbe debe estar dentro del panel con `stopPropagation` para que no cierre el overlay.

### 9.7 Movimiento

- Usar `APPLE_ELASTIC_SPRING`, `EMIL_EASE_OUT`, `MODAL_TRANSITION`, `BACKDROP_TRANSITION` de `src/lib/iosSprings.ts`.
- Entrada mobile: `y: 32 → 0`, `scale: 0.96 → 1`, `opacity: 0 → 1` en ~280 ms.
- Salida (cancelación): `scale: 0.95`, `opacity: 0`, ~180 ms.
- Tarjetas: `LayoutGroup` + `motion.div layout` + `AnimatePresence mode="popLayout"`, `staggerChildren: 0.04`.
- `prefers-reduced-motion`: sin `y`, sin `scale`; solo fade de 120 ms. Usar `useReducedMotion()`.
- No animar `filter: blur` en móvil si hay muchas tarjetas; puede costar frames.

### 9.8 Accesibilidad

- `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, `aria-describedby`.
- Focus trap entre el CTA y el orbe (solo 2 focusables).
- `Escape` → `onCancel()`.
- `aria-live="polite"` en el contenedor de `siriResponse` y en el estado "Ordenando tu relato…".
- Anuncio: "Se encontraron X manifestaciones, Y avances, Z afirmaciones. Revisá y confirmá."
- El backdrop es `aria-hidden`; no debe ser focusable.
- El CTA tiene `aria-busy` durante el commit.
- Touch targets: CTA `min-h-12`, orbe 64 px, botón `+` 44 px.
- Contraste: usar tokens; validar con axe.

### 9.9 z-index y stacking

| Capa | z-index actual | Acción |
|---|---|---|
| Bottom nav | `z-40` | Sin cambios |
| `VoiceActionOrb` viejo | `z-50` | No se monta en el nuevo flujo |
| `CreateActionMenu` backdrop/panel | `z-[60]` / `z-[61]` | Sin cambios; se cierra al abrir el organizador |
| Nuevo overlay | `z-[80]` / panel `z-[81]` | Por encima de todo |
| `RampagePlayerModal` | `z-50` | Cerrar overlay antes de abrirlo |

---

## 10. Integración en `page.tsx`

### 10.1 Decisión de producto recomendada

**El long press de `+` abre el Organizador Narrativo.** El tap corto sigue abriendo el menú de creación actual (`CreateActionMenu`), sin cambios.

Para no romper el flujo viejo de comandos de voz:

- Agregar flag `NEXT_PUBLIC_NARRATIVE_ORGANIZER` (default `'1'`).
- Si el flag está activo:
  - `BottomNavigation` recibe `createGestureProps` del nuevo `useNarrativeOrganizer`.
  - No se monta `useVoiceActionRouter` ni `VoiceActionOrb`.
  - Se monta `<SiriOrganizerOverlay />`.
- Si el flag está apagado:
  - Se conserva el comportamiento actual (`useVoiceActionRouter` + `VoiceActionOrb`).
- El código viejo no se borra en esta iteración; queda como rollback.

### 10.2 Cambios concretos

1. Importar `useNarrativeOrganizer` y `SiriOrganizerOverlay`.
2. Llamar al hook con `profileId: activeScope`, `existingContext`, `isSandboxMode`, `onCommitted`, `onStartRampage`.
3. Pasar `buttonGestureProps` a `BottomNavigation` en lugar de `voiceRouter.buttonGestureProps` cuando el flag esté activo.
4. Renderizar `<SiriOrganizerOverlay ... />` después de `<CreateActionMenu />`.
5. `isMobileCreateActive` debe incluir `narrative.isOpen` para que el botón `+` muestre el estado "X" mientras el overlay está abierto.
6. En `onCommitted`:
   - `applyNarrativeCommit` ya lo hace el hook.
   - Si `rampageToStart`, guardar en estado y abrir `RampagePlayerModal` cuando el overlay termine de cerrarse:
     ```ts
     setRampageToResume(null);
     setDirectRampagePayload({
       title: rampage.title,
       affirmations: rampage.affirmations,
       ambientSound: rampage.ambientSound,
       requestId: Date.now(),
     });
     setRampageOpenMode('new');
     setIsRampageOpen(true);
     ```
7. En `useEffect` de cambio de `activeScope`: `narrative.cancelAll()`.
8. Al abrir el organizador, cerrar `CreateActionMenu` y `quickAddSection` para evitar dos capas.

### 10.3 Gesto

Implementar en `useNarrativeOrganizer`:

- `onPointerDown`: guardar `clientY`, iniciar timer de 300 ms, `navigator.vibrate(20)` opcional.
- `onPointerMove`: si `|clientY - startY| > 8`, cancelar timer.
- `onPointerUp`:
  - Si el timer sigue vivo (<300 ms): `onOpenManualCreate()` (menú actual).
  - Si ya se disparó: el overlay está abierto; no hacer nada.
- `onPointerCancel`: cancelar timer.
- `onContextMenu`: `preventDefault()`.
- Teclado:
  - `onKeyDown` con `Space`/`Enter`: iniciar timer de 300 ms.
  - `onKeyUp`: si <300 ms, abrir menú; si ya se disparó, no hacer nada.
  - `Escape` dentro del overlay: cancelar.
- Evitar doble disparo: `isLongPressActiveRef`.

---

## 11. Modo Sandbox y fixtures deterministas

El modo sandbox es obligatorio para Playwright y para desarrollo sin micrófono.

### 11.1 Activación

- `isSandboxMode` del store (`detectAutomatedSandbox()` + `navigator.webdriver`).
- `sandbox=true` en el request.
- `AI_SANDBOX=true` en el servidor.
- En sandbox no se llama a Gemini y no se incrementa `ai_usage_daily`.

### 11.2 Escenarios

`src/lib/narrativeOrganizer.ts` exporta `buildSandboxNarrativeDraft({ scenario, spokenText, currentDraft, existingContext })`:

| Escenario | Resultado |
|---|---|
| `sabrina_initial` | Manifestación "Relación y juntadas con Sabrina" + avance "Primer encuentro con Sabrina" vinculado + afirmación "Tengo una chica tierna y cálida...". |
| `sabrina_add_age` | Toma `currentDraft`, agrega "23 años" al `context` de Sabrina y mueve el avance a `successStories` (o lo deja como avance, según el texto). |
| `sabrina_homonym` | Con `existingContext` que contiene una Sabrina vieja, crea una manifestación nueva `"Sabrina (Tinder)"` con `isNewPersonWithSameName: true` y **no** vincula al ID existente. |
| `sabrina_unlink` | Toma un `currentDraft` vinculado a la Sabrina vieja, lo desvincula y crea la nueva entidad. |
| `unclear` | `proposedPlan` vacío, `siriResponse` "No te entendí. Tocá el orbe y contámelo de nuevo." |

El escenario se lee de:
- `scenario` en el request (tests de API).
- `?narrativeScenario=sabrina_initial` en la URL (solo dev/test), que el hook pasa al endpoint.

### 11.3 Texto simulado

Si no hay audio real, el hook envía un Blob dummy de `audio/webm` y `spokenText` con el relato del escenario. El endpoint en sandbox ignora el audio y usa `spokenText`/`scenario`.

---

## 12. Fases de implementación

### Fase 0 — Preparación y red de seguridad

- Ejecutar baseline: `npx tsc --noEmit` y `npm run build`.
- Agregar flag `NEXT_PUBLIC_NARRATIVE_ORGANIZER`.
- Corregir `SuccessStorySchema`:
  ```ts
  manifestationId: z.string().max(128).nullable().optional(),
  goalId: z.string().max(128).optional(), // legacy
  ```
- Ajustar `/api/sync` para usar `valid.manifestationId ?? null` y eliminar el hack `valid.goalId || data.manifestationId`.
- Agregar `@playwright/test` y `tsx` como devDependencies (o usar `npx playwright` y `node --import tsx`).
- Crear `tests/` y `scripts/test-narrative-organizer.mjs`.

**Criterio de salida:** build y typecheck verdes; el flujo actual sigue funcionando.

### Fase 1 — Dominio, prompt y normalizador

- Crear `src/lib/narrativeOrganizer.ts` con:
  - Tipos.
  - Zod schemas.
  - `buildNarrativeOrganizerSystemPrompt()`.
  - `normalizeNarrativeDraft()`.
  - `buildSandboxNarrativeDraft()`.
  - `extractPersonNames()`.
- Tests unitarios:
  - Homónimo por defecto vincula a `existing`.
  - Aclaración "no es la misma" crea `new_m_1` y no vincula.
  - `currentDraft` con vínculo viejo se mueve al nuevo temp.
  - `link` inválido se convierte en `none`.
  - Afirmación poética se descarta.
  - `rampageToStart` inválido se anula.

**Criterio de salida:** tests unitarios verdes; ningún `any` nuevo.

### Fase 2 — Endpoint de análisis

- Crear `src/app/api/ai/narrative-organizer/route.ts`.
- Soportar multipart y JSON.
- Cuota, tamaño, mime, timeout, sandbox.
- Probar con `curl`/script:
  - Sandbox `sabrina_initial`.
  - Sandbox `sabrina_homonym` con `existingContext`.
  - Audio real corto (opcional).
- Verificar que un request sandbox no incrementa cuota.

**Criterio de salida:** respuesta JSON válida y normalizada; errores 400/413/429/502/504.

### Fase 3 — Endpoint de commit

- Crear `src/lib/narrativeCommit.ts`:
  - `buildCommitStatements({ draft, profileId })`.
  - Resolución de `tempId` → ID DB.
  - Dedupe de afirmaciones.
  - Cálculo de `sort_order`.
- Crear `src/app/api/ai/narrative-organizer/commit/route.ts`.
- Usar `turso.batch(statements, 'write')`.
- Probar:
  - Commit de manifestación + avance + afirmación.
  - Commit de éxito que actualiza `status='materializado'`.
  - Doble commit del mismo `draftId` no duplica.
  - Fallo forzado en una sentencia revierte todo (test con ID inválido o constraint).

**Criterio de salida:** transacción atómica verificada; respuesta con entidades creadas.

### Fase 4 — Hook de captura y estado

- Crear `src/hooks/useNarrativeOrganizer.ts`.
- Reutilizar `microphone.ts`.
- Implementar:
  - `open`, `startListening`, `stopAndSubmit`, `reRecord`, `confirm`, `cancelAll`, `retryCommit`.
  - VAD 2 s, max 90 s.
  - AbortController.
  - Limpieza de tracks/AudioContext.
  - `draftRef` y `isMountedRef`.
- Probar manualmente en Chrome y Safari iOS (si hay dispositivo).

**Criterio de salida:** cancelar detiene el micrófono y aborta el fetch; re-grabar conserva el draft.

### Fase 5 — Overlay UI

- Crear `src/components/voice/SiriOrganizerOverlay.tsx`.
- Crear `NarrativePreviewCard.tsx` si ayuda a mantener el archivo principal < 400 líneas.
- Implementar estados, tarjetas, CTA único, orbe, focus trap, Escape, `aria-live`.
- Reutilizar `SiriOrb` y `iosSprings`.
- Probar en 402x874 y 375x667.

**Criterio de salida:** no hay botones prohibidos; el overlay no se rompe con textos largos; reduced motion funciona.

### Fase 6 — Integración y store

- Agregar `applyNarrativeCommit` al store.
- Integrar en `page.tsx` con flag.
- Pasar gesture props a `BottomNavigation`.
- Conectar `rampageToStart`.
- Cancelar al cambiar de perfil.
- Probar tap corto (menú actual) y long press (organizador).

**Criterio de salida:** ambos gestos conviven; no hay doble apertura; el menú viejo sigue funcionando.

### Fase 7 — QA, Playwright y documentación

- Escribir `scripts/test-narrative-organizer.mjs` o `tests/narrative-organizer.spec.ts`.
- Ejecutar los escenarios de la sección 13.
- Correr `npx tsc --noEmit`, `npm run build`, `npm run lint`.
- Documentar en `docs/features/narrative-organizer.md` (o `docs/audits/`).
- Actualizar `plans/README.md` si se mueve el plan al repo.

**Criterio de salida:** todos los escenarios PASS; cero errores de consola; sin overflow horizontal.

---

## 13. Plan de pruebas

### 13.1 Preparación

```bash
# Dependencias de test (si se agregan)
npm i -D @playwright/test tsx
npx playwright install chromium

# Base de datos local aislada
TURSO_DATABASE_URL=file:/tmp/manifest-narrative-test.db \
TURSO_AUTH_TOKEN= \
node scripts/migrate.js

# Servidor de test
TURSO_DATABASE_URL=file:/tmp/manifest-narrative-test.db \
TURSO_AUTH_TOKEN= \
AI_SANDBOX=true \
npm run dev -- -p 3044
```

- No usar la Turso de producción para los tests E2E.
- Si se usa la DB real por limitación del entorno, crear registros con prefijo `narrative_test_` y borrarlos en `finally`.
- Playwright: viewport `402x874`, `deviceScaleFactor: 2`, `isMobile: true`, `hasTouch: true`.
- En `beforeEach`: `page.addInitScript(() => localStorage.setItem('manifest_ai_sandbox', 'true'))`.

### 13.2 Escenarios obligatorios

| # | Escenario | Pasos | Aserciones |
|---|---|---|---|
| 1 | Desglose y re-ajuste | Long press `+` 350 ms → overlay → escenario `sabrina_initial` → revisar → tocar orbe → escenario `sabrina_add_age` → revisar | `siriResponse` visible; tarjetas 🌱👣✨; un solo CTA "Sí, registrar todo ✨"; no hay botones "No/Cancelar/Editar"; el draft cambia y conserva lo anterior. |
| 2 | Homónimos | Sembrar manifestación "Sabrina" en `shared`; long press → escenario `sabrina_homonym` → revisar | Aparece "Sabrina (Tinder)" o badge "Persona nueva"; el avance no apunta al ID viejo; al confirmar, hay 2 manifestaciones Sabrina y el avance apunta a la nueva. |
| 3 | Desvincular en segundo turno | Primer turno `sabrina_initial` con Sabrina existente; orbe → escenario `sabrina_unlink` → revisar | El avance deja de apuntar al ID viejo; se crea la nueva entidad; el `siriResponse` lo explica. |
| 4 | Cancelación táctil externa | Abrir overlay, esperar propuesta, click en el backdrop | Overlay se cierra con animación; `mediaStream` detenido; no hay POST a `/commit`; conteos en DB iguales al baseline. |
| 5 | Cancelación durante processing | Abrir overlay, enviar, click en backdrop mientras "Ordenando…" | `AbortController` aborta; no hay escrituras; no hay error de consola no controlado. |
| 6 | Doble tap en Sí | Click rápido 2 veces en el CTA | Un solo set de registros; no hay duplicados por ID. |
| 7 | Error de commit | Interceptar `/commit` y responder 500 | El overlay queda en error, el draft no se pierde, el CTA permite reintentar; no se cierra. |
| 8 | Cuota 429 | Interceptar `/api/ai/narrative-organizer` con 429 | Mensaje de límite diario; el orbe permite reintentar; no se rompe el layout. |
| 9 | Sin ítems | Escenario `unclear` | No hay CTA "Sí"; el orbe invita a repetir; `siriResponse` visible. |
| 10 | Accesibilidad | Abrir overlay; Tab; Escape; axe | Focus atrapado entre CTA y orbe; Escape cancela; 0 violaciones critical/serious; labels correctos. |
| 11 | Reduced motion | `page.emulateMedia({ reducedMotion: 'reduce' })`; abrir/cerrar | Sin desplazamientos/zooms; solo fade; sin errores. |
| 12 | Textos extremos | Inyectar títulos/afirmaciones de 280/1000 chars | Sin overflow horizontal; `break-words`; el CTA sigue visible. |
| 13 | Cambio de perfil | Abrir overlay y cambiar `activeScope` | El overlay se cancela y limpia; no se guarda nada en el perfil anterior. |
| 14 | iOS mime | Simular `audio/mp4` en el request | El endpoint normaliza a `audio/mp4`; no hay error 400. |

### 13.3 Comandos

```bash
npx tsc --noEmit
npm run build
npm run lint
npx playwright test tests/narrative-organizer.spec.ts --project=chromium
# o el script existente:
node scripts/test-narrative-organizer.mjs
```

### 13.4 Criterios de aceptación de QA

- 0 errores de consola en el flujo nominal.
- 0 respuestas 5xx no esperadas.
- 0 overflow horizontal en 375 px y 402 px.
- 0 violaciones axe critical/serious.
- 0 botones "No", "Cancelar", "Editar" dentro del overlay.
- 1 sola llamada a Gemini por turno de voz; 0 en el commit.
- 0 escrituras si se cancela.
- `npx tsc --noEmit` y `npm run build` verdes.

---

## 14. Skills: instaladas, disponibles y recomendadas

### 14.1 Instaladas en el proyecto (`.agents/skills/`)

Estas ya están en el repo y son las de uso prioritario:

| Skill | Para qué sirve en este proyecto | Fase |
|---|---|---|
| `playwright-automation` | Escribir los E2E del overlay con POM, fixtures, auto-waiting y CI. Es la guía principal para `tests/narrative-organizer.spec.ts`. | 7 |
| `ux-audit` | Walkthrough real del flujo, hard gates (consola, red, overflow, axe, performance), evidencia con screenshots. | 7 |
| `agentic-browser-testing` | Exploración goal-driven del overlay ("abrí el organizador, corregí por voz, cancelá"). Útil para descubrir flujos no previstos. | 7 |
| `exploratory-testing` | Chartas SBTM para homónimos, cancelación, ruido, silencios, textos largos, cambio de perfil. | 7 |
| `bug-reproduction` | Reproducir de forma determinista un fallo de vínculo/homónimo o de cancelación antes de corregirlo. | 7 |
| `ai-bug-triage` | Clasificar y deduplicar fallos de Playwright/CI; generar tickets con severidad. | 7 |
| `web-audio-analyser-fx` | Afinar el orbe reactivo al `AnalyserNode`, halos y ondas sin romper performance. | 5 |

### 14.2 Disponibles en este entorno (catálogo global)

Estas no están necesariamente en `.agents/skills`, pero están disponibles para invocar en la sesión:

| Skill | Uso recomendado | Fase |
|---|---|---|
| `design-taste-frontend` / `anti-slop-frontend` | Dirección visual del overlay, evitar "AI slop", revisar tipografía/espaciado/contraste. | 5 |
| `ui-ux-pro-max` | Patrones de componentes, accesibilidad, paletas y stack UI. | 5 |
| `apple-design` | Materiales, profundidad, springs y sensación Siri/iOS. | 5 |
| `animate` | Decidir qué animar, curvas y duración. | 5 |
| `transitions-dev` / `transitions-polish` | Transiciones concretas y pulido de timing/stagger. | 5 |
| `choreograph` | Coordinar orbe + tarjetas + CTA + salida. | 5 |
| `mobile-native` | Safe areas, 100vh/dvh, tap highlights, inputs, gestos en móvil. | 5/7 |
| `accessibility-testing` | WCAG 2.2 AA, axe, teclado, focus trap, screen reader. | 7 |
| `api-testing` | Tests de contrato de los dos endpoints, multipart, errores, cuota. | 2/3 |
| `unit-testing` | Tests puros del normalizador y de las reglas de homónimos. | 1 |
| `database-testing` | Verificar atomicidad, rollback, constraints y migración local. | 3 |
| `ai-system-testing` | Evals del prompt, regresión de calidad, alucinaciones, formato JSON, grounding. | 1/7 |
| `ai-test-generation` | Generar casos de prueba desde este plan y desde el contrato JSON. | 7 |
| `test-reliability` | Estabilizar tests de voz/tiempo real; cuarentena si hay flakiness. | 7 |
| `visual-testing` | Baselines de screenshot del overlay en 402x874 y 375x667. | 7 |
| `security-testing` | Prompt injection, validación de IDs, origin check, privacidad de audio. | 2/3 |
| `service-virtualization` | Mockear Gemini/Turso para tests deterministas si se quiere evitar la DB real. | 7 |
| `playwright-skill` | Automatización ad-hoc y verificación en vivo con browser. | 7 |
| `ai-qa-review` | Revisar la calidad de los tests generados (assertions, smells). | 7 |
| `test-planning` | Convertir este plan en una matriz de pruebas por sprint. | 0 |
| `qa-project-context` | Registrar stack, convenciones y entorno del proyecto para futuras skills QA. | 0 |
| `release-readiness` | Go/no-go antes de publicar el flujo. | 7 |
| `compliance-testing` | Revisar consentimiento y privacidad del audio/transcript si se publica. | 7 |

### 14.3 Recomendadas para instalar en el proyecto

Si se quiere que el flujo quede cubierto por skills versionadas en `.agents/skills` y `skills-lock.json`, instalar estas (las que no estén ya):

| Skill | Motivo | Prioridad |
|---|---|---|
| `api-testing` | El proyecto tiene dos endpoints nuevos con multipart, JSON y errores; conviene un contrato repetible. | ALTA |
| `unit-testing` | El normalizador de homónimos es lógica pura y crítica; tests unitarios baratos. | ALTA |
| `database-testing` | La atomicidad del commit es el corazón del "todo o nada". | ALTA |
| `ai-system-testing` | El prompt es el producto; hay que medir regresiones de calidad y formato. | ALTA |
| `accessibility-testing` | El overlay tiene un solo CTA y cancelación por backdrop; hay que garantizar teclado/lector. | MEDIA |
| `test-reliability` | Los tests de voz y timing son propensos a flakiness. | MEDIA |
| `visual-testing` | El overlay es visualmente delicado; baselines ayudan. | MEDIA |
| `security-testing` | Audio, IDs de DB y prompt injection merecen una pasada. | MEDIA |
| `test-data-management` | Fixtures de Sabrina/homónimos y limpieza de DB. | MEDIA |
| `ai-test-generation` | Generar casos desde el contrato y este plan. | BAJA |

**Fuente probable:** `petrkindlmann/qa-skills`, que es la fuente de las skills QA ya instaladas (`skills-lock.json`). Para las de diseño/motion, ya están disponibles globalmente; no hace falta duplicarlas en el repo.

Comando orientativo (verificar el CLI disponible antes de ejecutarlo):

```bash
npx skills --help

# Ejemplos; el flag exacto depende de la versión del CLI:
npx skills add petrkindlmann/qa-skills --skill api-testing
npx skills add petrkindlmann/qa-skills --skill unit-testing
npx skills add petrkindlmann/qa-skills --skill database-testing
npx skills add petrkindlmann/qa-skills --skill ai-system-testing
npx skills add petrkindlmann/qa-skills --skill accessibility-testing
```

Después de instalar, actualizar `skills-lock.json` y verificar que las skills aparezcan en `.agents/skills/`.

### 14.4 Herramientas que no son skills pero hacen falta

| Herramienta | Para qué | Instalación |
|---|---|---|
| `@playwright/test` | Runner E2E y assertions. | `npm i -D @playwright/test` |
| Chromium de Playwright | Navegador de test. | `npx playwright install chromium` |
| `tsx` | Ejecutar tests TypeScript con el runner de Node. | `npm i -D tsx` |
| `@axe-core/playwright` | Auditoría a11y automatizada. | `npm i -D @axe-core/playwright` |
| DB local libSQL | Tests sin tocar Turso producción. | `TURSO_DATABASE_URL=file:/tmp/...` + `scripts/migrate.js` |

---

## 15. Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| El modelo devuelve JSON inválido | Overlay roto | Zod + normalizador + sandbox + reintento por orbe. |
| El modelo inventa un nombre/edad | Datos falsos | Prompt estricto + `siriResponse` transparente + revisión visual antes de confirmar. |
| Homónimo mal vinculado | Datos mezclados | Regla por defecto + aclaración por voz + `isNewPersonWithSameName` + test E2E. |
| Doble commit | Duplicados | IDs deterministas + `ON CONFLICT` + bloqueo del CTA. |
| Cancelación no detiene el micrófono | Privacidad/UX | `cancelAll()` con `abort`, `track.stop()`, `audioContext.close()`. |
| Cuota de 100 RPD | Bloqueo del flujo | 1 llamada por turno, commit sin IA, mensaje 429 claro. |
| Audio grande/largo | 413/timeout | Cap 10 MB, 90 s, VAD 2 s. |
| Safari iOS `MediaRecorder` | Sin audio | Reutilizar `microphone.ts`; mime `audio/mp4`; probar en dispositivo. |
| z-index conflictivo | Overlay detrás de modales | `z-[80]/[81]`; cerrar `CreateActionMenu`; cerrar overlay antes de Rampage. |
| Race con `fetchRemoteData` | Estado viejo | `applyNarrativeCommit` local; no refetch durante el commit. |
| Cambio de perfil con overlay abierto | Draft en perfil equivocado | `cancelAll()` en `useEffect([activeScope])`. |
| Tests contaminan Turso | Datos de prueba | DB local `file:` o limpieza `finally`. |
| Textos largos rompen layout | Overflow | `min-w-0`, `break-words`, `overflow-y-auto`, tests worst-case. |
| Reduced motion ignorado | Accesibilidad | `useReducedMotion()` + CSS media query. |

---

## 16. Definition of Done

- [ ] Long press de `+` (300 ms) abre el Organizador; tap corto abre el menú actual.
- [ ] El organizador hace **una sola** llamada a Gemini por turno de voz; el commit no usa IA.
- [ ] El draft muestra Manifestaciones, Avances, Éxitos, Afirmaciones y, si aplica, Rampage.
- [ ] Existe **un único** botón afirmativo: `Sí, registrar todo ✨`.
- [ ] No hay botones "No", "Cancelar" ni "Editar" dentro del overlay.
- [ ] Tocar fuera cancela, detiene el micrófono, aborta el fetch, limpia el estado y **no escribe en DB**.
- [ ] El orbe permite re-grabar y envía `currentDraft`; las tarjetas se actualizan con `LayoutGroup`.
- [ ] La aclaración "no es la misma Sabrina" crea una entidad nueva y no vincula a la anterior.
- [ ] El commit es atómico con `turso.batch(..., 'write')`.
- [ ] Doble tap en "Sí" no duplica registros.
- [ ] `applyNarrativeCommit` refleja los cambios sin recargar.
- [ ] Sandbox determinista para los 5 escenarios.
- [ ] Playwright 402x874: los 14 escenarios de la sección 13 pasan.
- [ ] `npx tsc --noEmit`, `npm run build` y `npm run lint` pasan.
- [ ] 0 errores de consola, 0 overflow horizontal, 0 violaciones axe critical/serious.
- [ ] `prefers-reduced-motion` respetado.
- [ ] Documentación del flujo y del contrato JSON agregada.
- [ ] Plan movido a `plans/` del repo cuando se salga de Plan Mode (si el equipo lo quiere versionar).

---

## 17. Decisiones confirmadas e implementadas

1. **Reemplazo del flujo de `useVoiceActionRouter` en el long press:**
   - **Acción:** El long press del botón `+` (300 ms) activa el nuevo Organizador Narrativo. Se incorpora el flag `NEXT_PUBLIC_NARRATIVE_ORGANIZER` (por defecto `'1'`), permitiendo un rollback limpio al router viejo si fuese necesario.
2. **Persistencia de `voiceTranscript`:**
   - **Acción:** Sí se guarda en cada avance (`manifestation_progress.voice_transcript`) cuando el usuario pulsa "Sí, registrar todo ✨", habilitando trazabilidad auditada del relato original.
3. **Persistencia de `rampageToStart`:**
   - **Acción:** Al dispararse un Rampage derivado del organizador, la UI interactiva consulta al usuario si desea guardar dicho Rampage en `rampage_sets`. Si confirma, queda guardado para ser reutilizado en días posteriores sin requerir volver a enunciar la orden. Si elige solo reproducir, se ejecuta directamente en memoria sin ensuciar la base de datos.
4. **Accesibilidad y salida de la UI:**
   - **Acción:** Se respeta estrictamente la estética minimalista (cero botones invasivos de "Cancelar" o "No"). La salida está implementada mediante click en el backdrop translúcido, toque de la tecla `Escape` y anuncio en `aria-describedby="narrative-organizer-hint"`.
5. **Entorno local de pruebas libSQL:**
   - **Acción:** Configurada una base de datos local SQLite/libSQL en `/tmp/manifest-narrative-test.db` con scripts automatizados (`npm run db:local:fresh`, `npm run dev:local`), permitiendo ejecutar toda la suite de pruebas E2E deterministas sin tocar las credenciales de producción de Turso.

---

## 17.1 Paleta de colores y tokens (Auditoría con ui-ux-pro-max y better-colors)

En alineación con la directiva "Pastel cutie palette (Pinkie Pie, sin gradientes)" y las directrices de `better-colors` y `ui-ux-pro-max`:
- **Un color para cada tipo de entidad:**
  - 🌱 **Manifestación:** Fondo `--pastel-sage` (`#ddf7ec`), texto `--pastel-sage-ink` (`#0d6a4c`), ratio 5.84:1 (pasa WCAG AA).
  - 👣 **Avance:** Fondo `--pastel-sky` (`#ddf0ff`), texto `--pastel-sky-ink` (`#14587f`), ratio 6.58:1 (pasa WCAG AA).
  - 🏆 **Historia de Éxito:** Fondo `--pastel-butter` (`#fff4cc`), texto `--pastel-butter-ink` (`#6a5000`), ratio 6.91:1 (pasa WCAG AA).
  - ✨ **Afirmación:** Fondo `--pastel-peri` (`#eee7ff`), texto `--pastel-peri-ink` (`#54408f`), ratio 6.98:1 (pasa WCAG AA).
  - 🎧 **Rampage:** Fondo `--pastel-peach` (`#ffe8d8`), texto `--pastel-peach-ink` (`#8a4218`), ratio 6.19:1 (pasa WCAG AA).
- **Acción única:**
  - Botón primario con `--color-accent` (`#c8397c`) y texto blanco (`#ffffff`), ratio 4.85:1.
  - Backdrop con desenfoque `backdrop-blur-md` y scrim neutro ciruela (`rgba(43, 24, 33, 0.32)`), garantizando legibilidad y aislamiento modal sin gradientes estridentes ni destellos AI no deseados.
---

## 17.2 Refinamiento de Interfaz: Eliminación de AI Slop y Experiencia Siri Pura

A partir del feedback del usuario sobre la sobrecarga visual de la versión inicial, se aplicó una depuración estética profunda:
- **Cero emojis:** Eliminados todos los emojis decorativos (`🌱`, `👣`, `🏆`, `✨`, `🎧`) tanto en etiquetas como en botones.
- **Cero bloques de colores artificiales:** Descartados los fondos pastel (`pastel-sage`, `pastel-sky`, etc.) que daban aspecto de "dashboard generado por IA". La interfaz ahora utiliza superficies translúcidas neutras de cristal esmerilado (`backdrop-blur-3xl`, bordes sutiles y contraste de texto puro).
- **Eliminación del acordeón de transcripción:** Se removió por completo el bloque redundante de "Ver transcripción", manteniendo el foco exclusivamente en la respuesta conversacional.
- **Foco conversacional:** La respuesta directa y humana de Siri (`siriResponse`) es el elemento protagónico, acompañada de una síntesis sobria y un botón de decisión directo e integrado (`Sí, registrar todo`).
- **Orbe de Voz en Tiempo Real:** El orbe Siri flotante con halo acústico e iluminación óptica está siempre presente para reaccionar a la voz del usuario y permitir correcciones fluidas e instantáneas.

---

## 17.3 Refinamiento con apple-design, mobile-native y better-colors

Para lograr una sensación 100% nativa de iOS y Apple Intelligence preservando la armonía con el resto del sitio:
- **Materiales de Cristal Frosted (Apple iOS):** Superficie modal con desenfoque de cristal ultra-profundo (`backdrop-blur-3xl`), resalte especular interno (`box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.45)`) y radio de curvatura suave `rounded-[32px] sm:rounded-[28px]`.
- **Detalle Físico de Sheet:** Incorporado el clásico *grabber handle* nativo de iOS en la parte superior en vista móvil (`w-9 h-1 rounded-full bg-black/15 dark:bg-white/20`).
- **Tipografía y Jerarquía SF Pro:**
  - Respuestas de Siri: tamaño y ritmo de lectura amplio (`text-[16px] leading-[1.45] tracking-[-0.01em]`).
  - Tarjetas en formato *Inset Grouped Table View*: radio `rounded-2xl`, bordes capilares sutiles (`border-[var(--border-subtle)]`), etiquetas en mayúsculas `tracking-[0.06em]`.
- **Botón de Acción Primaria iOS Pill:**
  - `rounded-full` de 50px de altura, color de acción consistente (`--color-accent`), tipografía de 16px semibold y micro-respuesta física al pulsar (`active:scale-[0.98]`).
  - Control de Rampage con especificación auténtica de `UISwitch` de iOS (51x31px con palanca deslizante circular de 27px y física elástica).
- **Mobile-Native Ergonomics:**
  - `touch-action: manipulation` y `select-none` para evitar selección accidental de texto o retardo de 300 ms en toques.
  - Safe-areas estrictas con `env(safe-area-inset-bottom)` y contención de scroll (`overscroll-contain`).
- **Consistencia Cromática con better-colors:**
  - Cumplimiento de WCAG AA (>4.5:1) en todas las duplas de texto y fondo (`--color-ink`, `--color-ink-muted`, `--color-accent`, `--control-bg`). 0 violaciones reportadas en `@axe-core/playwright`.

---

## 18. Orden de ejecución recomendado

1. Fase 0 (schema + flag + baseline).
2. Fase 1 (normalizador + prompt + unit tests).
3. Fase 2 (endpoint analyze + sandbox).
4. Fase 3 (endpoint commit + transacción).
5. Fase 4 (hook).
6. Fase 5 (overlay).
7. Fase 6 (integración + store).
8. Fase 7 (Playwright + a11y + docs).

No avanzar a la Fase 4 sin que las Fases 1-3 tengan tests verdes. No avanzar a la Fase 6 sin que el overlay pase una revisión visual y de accesibilidad en 402x874 y 375x667.
