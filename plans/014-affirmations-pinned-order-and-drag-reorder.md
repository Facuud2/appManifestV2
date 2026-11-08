# 014 — Fijado Prioritario y Reordenamiento Táctil/PC en Afirmaciones (`ui-ux-pro-max`)

- **Status**: DONE
- **Severity**: HIGH
- **Category**: Interaction Design, Information Architecture, WCAG 2.2 AA Dragging Movements & State Persistence
- **Skills applied**: `ui-ux-pro-max`, `transitions-dev`, `transitions-polish`
- **Target files**:
  - `src/lib/affirmationEngine.ts`
  - `src/lib/affirmationSeed.ts`
  - `src/schemas/index.ts`
  - `src/app/api/sync/route.ts`
  - `src/store/index.ts`
  - `src/features/journal/AffirmationsView.tsx`
  - `src/app/globals.css`
  - `scripts/migrate.js`

---

## 1. Diagnóstico y Objetivo de Producto

En la vista actual de **Afirmaciones** (`src/features/journal/AffirmationsView.tsx`):
1. **Las afirmaciones fijadas (`En foco`) no se mantienen primeras en la lista inferior**:
   - El endpoint `GET /api/sync` ordenaba únicamente por `repeat_count DESC, created_at DESC`, provocando que afirmaciones no fijadas con más repeticiones desplazaran hacia abajo a las afirmaciones fijadas (`pinned: true`).
   - Al pulsar el icono de pincho (`togglePinAffirmation`), el estado invertía `pinned` en su misma posición sin reubicar la tarjeta al inicio de la lista ni persistir un orden canónico.
2. **Ausencia del control de reacomodación ("las 3 rayitas") en móvil y PC**:
   - Las tarjetas carecían del tirador de tres líneas horizontales (`≡`) para arrastrar y reposicionar afirmaciones tanto en la grilla principal (1 columna en móvil, 2 columnas en PC) como en el bloque superior de *Decretos fijados en foco*.

---

## 2. Reglas de Diseño e Interacción (`ui-ux-pro-max`)

### 2.1 Jerarquía Canónica de Orden (`sortAffirmations`)
1. **Grupo Primario — En Foco (`pinned: true`)**: Todas las afirmaciones fijadas se mantienen siempre en las primeras posiciones de la lista inferior y en el mismo orden exacto que muestra el bloque superior *Decretos fijados en foco*.
2. **Grupo Secundario — Decretos (`pinned: false`)**: Se listan inmediatamente después de las afirmaciones fijadas, respetando el orden personalizado (`order` / `sort_order`).
3. **Transiciones al Fijar / Desfijar**:
   - Al fijar un decreto (`pinned: false → true`), se incorpora al grupo superior de fijadas manteniéndose primero por encima de cualquier afirmación no fijada.
   - Al desfijar un decreto (`pinned: true → false`), pasa al inicio del bloque de no fijadas, dejando en primer lugar a las que siguen fijadas.

### 2.2 Control de 3 Rayitas (`≡`) — Drag & Drop 2D + Alternativa WCAG 2.2 AA
Siguiendo la directriz de `ui-ux-pro-max` (`"dragging movements" --domain ux` — WCAG 2.2 AA SC 2.5.7):
- **Iconografía Vectorial Consistente**: Tirador SVG de 3 líneas horizontales (`ThreeLinesGripIcon`, `strokeWidth="1.65"`, `aria-hidden="true"`) integrado junto a los controles de tarjeta (`Volume2`, `Pin`, `Trash2`) y en las tarjetas del bloque *Decretos fijados en foco*.
- **Soporte Multi-dispositivo (Móvil Touch + PC Mouse 2D Grid)**:
  - `.affirmation-drag-handle` aplica `touch-action: none` para que en pantallas táctiles móviles el arrastre vertical no sea cancelado por el scroll nativo del navegador.
  - Detección espacial mediante `document.elementsFromPoint(clientX, clientY)` con auto-scroll en bordes del viewport (`80px`), permitiendo reacomodar tanto en listas verticales (móvil) como en grillas de 2 y 3 columnas (PC).
  - Animación de reacomodación con `layout="position"` y resorte físico (`APPLE_ELASTIC_SPRING`), respetando `prefers-reduced-motion`.
- **Alternativa de Puntero Único y Teclado (WCAG 2.2 AA)**:
  - Al hacer un toque/clic simple sin arrastrar sobre el botón de las 3 rayitas (`≡`), se despliega un control compacto con acciones directas **Subir** (`↑`) y **Bajar** (`↓`) para reposicionar con un solo toque.
  - Con foco de teclado en las 3 rayitas, las teclas `ArrowUp`/`ArrowLeft` y `ArrowDown`/`ArrowRight` mueven la afirmación hacia arriba/adelante o abajo/atrás dentro de su grupo, anunciando su posición.

### 2.3 Persistencia Dual (Turso SQLite + Caché Local por Perfil)
- Migración automática idempotente de la columna `sort_order INTEGER` en la tabla `affirmations` (`src/lib/affirmationSeed.ts` y `scripts/migrate.js`).
- Acción `reorder` por lotes (`turso.batch`) en `POST /api/sync` y respaldo inmediato en `localStorage` por perfil (`facu`, `maia`, `shared`).
