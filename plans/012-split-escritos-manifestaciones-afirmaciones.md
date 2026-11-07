# 012 — Dividir "Escritos" en Manifestaciones y Afirmaciones

- **Status**: DONE
- **Severity**: HIGH
- **Category**: Information Architecture, UI/UX Design & Motion System
- **Skills applied**: `ui-ux-pro-max`, `web-artifacts-builder`, `transitions-dev`, `transitions-polish`
- **Target files**:
  - `src/features/journal/ManifestationsView.tsx`
  - `src/features/journal/AffirmationsView.tsx` *(new)*
  - `src/components/layout/DesktopSidebar.tsx`
  - `src/components/layout/BottomNavigation.tsx`
  - `src/app/page.tsx`

---

## 1. Problema y Objetivo de Producto

Actualmente la sección **Escritos** (`src/features/journal/ManifestationsView.tsx`) sólo renderiza la colección `manifestations` (deseos extensos con anclaje sensorial y estado evolutivo), mientras que el repertorio completo de **Afirmaciones** (`affirmations` en `useAppStore`, sembradas desde `src/lib/affirmationDefaults.json` y creadas con `AffirmationEditorModal`) carece de una vista dedicada para explorarlas, filtrarlas por categoría (`Autoconcepto`, `SP`, `Maia`, `Fijadas`), fijarlas (`togglePinAffirmation`) o practicar su repetición consciente (`incrementAffirmationRepeat`).

El objetivo es **reemplazar la sección genérica "Escritos" por dos secciones especializadas y hermanadas**:

1. **Manifestaciones (`ManifestationsView`)**: El jardín de intenciones sensoriales a mediano/largo plazo, con filtro por estado (`Semilla`, `Alineación`, `Evidencia`, `Materializado`), cambio interactivo de estado (`updateManifestationStatus`), anclaje sensorial y conexión directa con `Avances` e `Historias de éxito`.
2. **Afirmaciones (`AffirmationsView`)**: El repertorio de decretos cortos en primera persona (Ley de la Asunción, validados con `findPoeticTerm` de `src/lib/affirmationEngine.ts`), con sección destacada de decretos fijados, filtros por categoría con pigmentos pastel, contador interactivo de repeticiones con animación *Number Pop-In*, y puente directo hacia el reproductor de voz `Rampage`.

---

## 2. Sistema de Diseño y Estética (`ui-ux-pro-max` + `011-pastel-cutie-palette`)

Se respeta estrictamente la dirección **Blush Paper & Plum Ink (Pastel Cutie Sanctuary, cero gradientes decorativos)**:

### 2.1 Superficies y Tinta Semántica
| Rol | Token CSS | Light | Dark | Uso en las nuevas vistas |
|---|---|---|---|---|
| Fondo de página | `--color-base` | `#fdf4f7` | `#171014` | Lienzo base sin gradientes |
| Tarjeta estándar | `.swiss-card` / `--color-surface-card` | `#fffbfc` | `#21161d` | Tarjetas de manifestaciones y afirmaciones en reposo (planas con borde `--border-card`) |
| Tinta primaria | `--color-ink` | `#2b1f26` | `#fbeef3` | Títulos de intenciones y texto de decretos (contraste >= 14.6:1) |
| Tinta secundaria | `--color-ink-muted` | `#6f5762` | `#c3a7b2` | Descripciones sensoriales y subtítulos (contraste >= 6.0:1) |
| Tinta terciaria | `--color-ink-light` | `#806b75` | `#9d828d` | Fechas, metadatos `tabular-nums`, contadores secundarios |
| Acción primaria | `--color-accent` / `.swiss-btn-primary` | `#c8397c` | `#ff9ec4` | Un único botón relleno por cabecera (`Nueva manifestación` / `Nueva afirmación`) |

### 2.2 Asignación de Pigmentos Pastel (Campos Planos)
En **Manifestaciones** (por estado de maduración):
- **Semilla**: `--pastel-butter` (`#fff4cc`) + `--pastel-butter-ink` (`#6a5000`)
- **Alineación**: `--pastel-sky` (`#ddf0ff`) + `--pastel-sky-ink` (`#14587f`)
- **Evidencia**: `--pastel-sage` (`#ddf7ec`) + `--pastel-sage-ink` (`#0d6a4c`)
- **Materializado**: `--pastel-rose` (`#ffe1ec`) + `--pastel-rose-ink` (`#8c2a4f`)

En **Afirmaciones** (por categoría de asunción):
- **Autoconcepto**: `--pastel-peri` (`#eee7ff`) + `--pastel-peri-ink` (`#54408f`) — superficie destacada `.surface-peri`
- **SP (Persona Específica)**: `--pastel-rose` (`#ffe1ec`) + `--pastel-rose-ink` (`#8c2a4f`) — superficie `.surface-rose`
- **Maia / Vínculo**: `--pastel-peach` (`#ffe8d8`) + `--pastel-peach-ink` (`#8a4218`) — superficie `.surface-peach`
- **Personalizadas / Abundancia**: `--pastel-sage` (`#ddf7ec`) + `--pastel-sage-ink` (`#0d6a4c`) — superficie `.surface-sage`

---

## 3. Arquitectura de Navegación y Ergonomía

1. **Tipo `NavTab` (`src/components/layout/BottomNavigation.tsx`)**:
   ```ts
   export type NavTab =
     | 'dashboard'
     | 'manifestations'
     | 'affirmations'
     | 'rampage'
     | 'progress'
     | 'stories';
   ```
2. **Rail Lateral de Escritorio (`src/components/layout/DesktopSidebar.tsx`)**:
   - Se reemplaza el ítem único `Escritos` por dos entradas independientes bajo *Tu espacio*:
     - **Manifestaciones** (icono `Feather`, badge con `manifestations.length`)
     - **Afirmaciones** (icono `Quote` / `MessageSquareQuote`, badge con `affirmations.length`)
3. **Conmutador Superior Compartido (`JournalSectionSwitcher`)**:
   - En la parte superior de `ManifestationsView` y `AffirmationsView` se incluye un control segmentado accesible (`role="tablist"`, hitboxes `min-h-11` >= 44px) con píldora deslizante (`t-tabs` / `layoutId="journalSectionPill"`) que permite alternar en 1 toque entre **Manifestaciones** y **Afirmaciones**, garantizando acceso inmediato tanto en móvil como en escritorio.
4. **Accesos desde `DashboardView`**:
   - La sección *¿Qué necesitás hoy?* y la tarjeta de afirmación destacada en el inicio permiten navegar directamente tanto a `manifestations` como a `affirmations`.

---

## 4. Especificación de Movimiento (`iosSprings.ts` + `transitions-dev` + `transitions-polish`)

- **Curva única de salida**: `EMIL_EASE_OUT` (`cubic-bezier(0.23, 1, 0.32, 1)`) y `--ease-smooth-out` (`cubic-bezier(0.22, 1, 0.36, 1)`).
- **Conmutador de sección y filtros (`16-tabs-sliding.md`)**:
  - Duración simétrica de `220ms–250ms` (`--duration-fast`). En el primer render la píldora aparece en posición sin transición inicial.
- **Entrada escalonada de tarjetas (`STAGGER_CONTAINER` / `STAGGER_ITEM`)**:
  - `staggerChildren: 0.04` (40ms = `--duration-stagger`). Se aplica sólo cuando la lista visible tiene `<= 6` elementos para que el total de stagger nunca supere `240ms`.
- **Contador de repetición de afirmaciones (`02-number-pop-in.md`)**:
  - Al pulsar `Repetir` en una afirmación (`incrementAffirmationRepeat(id)`), el dígito actualizado entra con desplazamiento vertical corto (`4px–8px`) y desenfoque suave (`--blur-small: 2px` → `0`) en `180ms`.
- **Asimetría Open/Close en compositores rápidos**:
  - Apertura en `240ms` (`--duration-fast`), cierre en `150ms` (`--duration-quick`).
- **Guarda obligatoria de movimiento reducido**:
  - `@media (prefers-reduced-motion: reduce)` y `useReducedMotion()` desactivan traslaciones (`y: 0`), giros y escalas en todas las transiciones nuevas.

---

## 5. Plan de Producción Paso a Paso

### Paso 1: Crear `src/features/journal/components/JournalSectionSwitcher.tsx`
- Componente compartido para la cabecera de ambas vistas con dos pestañas (`Manifestaciones` con contador y `Afirmaciones` con contador), atributos ARIA completos y píldora activa animada.

### Paso 2: Actualizar `src/features/journal/ManifestationsView.tsx`
- Cambiar título principal de `"Escritos"` a `"Manifestaciones"` y CTA a `"Nueva manifestación"`.
- Integrar `JournalSectionSwitcher` para conmutar hacia `AffirmationsView`.
- Añadir barra de filtrado por estado (`Todas`, `Semilla`, `Alineación`, `Evidencia`, `Materializado`) con conteo en vivo.
- Conectar `updateManifestationStatus` del store en cada tarjeta mediante un selector en píldora accesible para evolucionar el estado sin salir de la vista.

### Paso 3: Crear `src/features/journal/AffirmationsView.tsx`
- Cabecera con eyebrow `"Asunción en primera persona"`, título `"Afirmaciones"`, subtítulo explicativo del estilo directo (sin lenguaje poético) y botón primario `"Nueva afirmación"`.
- **Spotlight de Decretos Fijados (`.surface-peri`)**: Muestra las afirmaciones con `pinned: true` en la parte superior con botón de repetición consciente (`incrementAffirmationRepeat`) y acceso directo a `Rampage` (`onOpenRampage`).
- **Filtro por Categorías**: Píldoras para `Todas`, `Fijadas`, `Autoconcepto`, `SP`, `Maia` y `Personalizadas`, coloreadas con sus pigmentos pastel correspondientes.
- **Compositor Rápido con Validador de Ley de la Asunción**: Permite escribir o dictar por voz (`VoiceDictationButton`) una nueva afirmación en línea o abrir `AffirmationEditorModal`, mostrando aviso inmediato si `findPoeticTerm(text)` detecta términos poéticos/New Age de `POETIC_BLACKLIST`.
- **Grilla de Tarjetas de Afirmaciones**: Cada tarjeta incluye insignia de categoría con `.pastel-dot`, botón de fijar (`Pin`, `aria-pressed={ Boolean(item.pinned) }`), frase en tipografía display legible, botón interactivo `Repetida X veces` con animación de dígito y acción de eliminar (`deleteAffirmation`).

### Paso 4: Conectar Navegación Global (`DesktopSidebar.tsx`, `BottomNavigation.tsx`, `DashboardView.tsx`, `page.tsx`)
- Añadir `'affirmations'` a `NavTab`.
- En `DesktopSidebar.tsx`, separar `Escritos` en `Manifestaciones` y `Afirmaciones` con sus respectivos contadores.
- En `page.tsx`, renderizar `<ManifestationsView />` cuando `activeTab === 'manifestations'` y `<AffirmationsView />` cuando `activeTab === 'affirmations'`, pasando el callback `onSwitchSection={(tab) => setActiveTab(tab)}`.

---

## 6. Verificación y Criterios de Aceptación

- **Mecánica**: `npx tsc --noEmit` y `npm run build` deben pasar sin errores ni advertencias de tipos.
- **Accesibilidad (`ui-ux-pro-max`)**:
  - Todos los botones de solo icono (`Pin`, `Trash2`) tienen `aria-label` descriptivo con el texto/título del elemento y `aria-pressed` cuando tienen estado.
  - Todos los controles interactivos cumplen área táctil mínima (`min-h-11` / `>= 44px` en controles primarios y tabs).
  - Ninguna etiqueta compacta (badge/chip) se parte en dos líneas (`whitespace-nowrap`).
- **Anti-Slop (`web-artifacts-builder`)**:
  - Cero degradados índigo/violeta genéricos; uso exclusivo de los tokens CSS semánticos de `src/app/globals.css`.
  - Textos reales basados en `src/lib/affirmationDefaults.json` y el dominio real de Facu & Maia.
