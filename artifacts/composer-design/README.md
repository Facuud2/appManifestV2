# Composer en ráfaga — Afirmaciones y Manifestaciones

Diseño de alta rápida al estilo Trello para las dos secciones de escritura.
Objetivo: **escribir → Enter → seguir escribiendo**, sin abrir y cerrar un modal por cada ítem.

- Prototipo desktop: `preview-desktop.html` → `desktop.png`
- Prototipo móvil: `preview-mobile.html` → `mobile.png` / `mobile-320.png`

---

## 1. Decisión de patrón

Se evaluaron tres formas:

| Patrón | Qué es | Veredicto |
|---|---|---|
| **A. Ranura en la grilla** | El composer ocupa la primera celda de la grilla, como una tarjeta fantasma. | Descartado en desktop: la grilla es de 2 columnas y quedaría una celda a media altura, con un hueco al lado. En móvil sí funciona. |
| **B. Franja de captura full-width** | Una franja horizontal arriba de la grilla, con el campo y las acciones. | **Elegido para desktop.** No rompe la grilla, se lee como “ranura” y no compite con las tarjetas. |
| **C. Bottom sheet en modo ráfaga** | Una hoja fija abajo; cada Enter agrega un chip y al final se guarda todo junto. | Descartado como flujo principal: agrega un paso de confirmación y pierde la persistencia inmediata. Queda como alternativa si algún día se cargan 10+ ítems de una vez. |

**Resultado:** un solo componente con dos pieles.

- **Desktop:** franja de captura arriba de la grilla, siempre en el mismo lugar.
- **Móvil:** barra anclada abajo, por encima del teclado, que reemplaza al bottom nav mientras está abierta.

La lógica es la misma: el ítem se guarda al instante y el composer **no se cierra**.

---

## 2. Anatomía

### Desktop

```
┌─ Nueva afirmación ───────────────────── ✓ Guardada · 3 en esta ráfaga ┐
│  Soy siempre la primera opción                                        │
│                                                                       │
├───────────────────────────────────────────────────────────────────────┤
│  Enter guarda y sigue · Shift+Enter baja de línea     [mic] [Agregar] │
└───────────────────────────────────────────────────────────────────────┘
   ↑ fondo rosa pálido (afirmaciones) / manteca (manifestaciones)
```

- Fondo: `--pastel-rose-wash` para afirmaciones, `--pastel-butter-wash` para manifestaciones. Es tinte de contenido, no de chrome.
- Borde: 1px derivado del tono fuerte del pigmento, no un borde gris.
- Radio: `--radius-card` (20px), igual que las tarjetas.
- Sin sombra en reposo. Al enfocar: borde acento + anillo de 3px al 16%.
- El campo no tiene borde propio: la franja ya es el marco.
- Tipografía del campo: 18px / 600 para afirmaciones (igual que la cita de la tarjeta), 16px / 500 para manifestaciones (párrafo).
- El botón `Agregar` es **el único relleno acento** de la zona. El CTA del header, mientras el composer está abierto, pasa a ser un botón fantasma `Listo`.

### Móvil

```
┌─────────────────────────────────────────────┐
│ ● Nueva afirmación      ✓ Guardada · 3      │
│ [ Soy siempre la primera opción ] [mic] [+] │
│ Enter o + guarda y sigue            Listo   │
└─────────────────────────────────────────────┘
   anclado abajo, sobre el teclado
```

- Barra fija (`position: fixed`), no modal, no scrim.
- `padding-bottom: calc(12px + env(safe-area-inset-bottom))`.
- Mientras está abierta, el bottom nav se oculta o la barra se apoya encima; nunca los dos apilados.
- El contenido de la página recibe `padding-bottom` equivalente al alto de la barra + 16px para que la última tarjeta no quede tapada.
- Targets de 44px: campo, micrófono y `+`.
- El botón `+` no debe cerrar el teclado: `onPointerDown={(e) => e.preventDefault()}` antes de guardar.

---

## 3. Estados

| Estado | Qué se ve | Qué no se ve |
|---|---|---|
| **Cerrado** | CTA `Nueva afirmación` / `Nueva manifestación` relleno en el header. | Nada del composer. |
| **Abierto vacío** | Franja con label, placeholder y hint. Foco en el campo. | Chip de guardado ni contador. |
| **Escribiendo** | Campo con texto; `Agregar` habilitado. | Validación agresiva mientras se escribe. |
| **Guardado** | Chip `Guardada` (sage) 1.2s + contador `N en esta ráfaga`. Campo limpio y enfocado. Tarjeta nueva entra arriba con flash de 600ms. | Toast, confeti, modal, scroll jump. |
| **Vacío + Enter** | Nada. El foco se queda. | Error rojo. |
| **Aviso de lenguaje poético** | Línea inline ámbar debajo del campo: “«vibración» es un término poético; probá con algo más directo.” No bloquea el guardado. | Banner global ni modal de error. |
| **Error de red** | El ítem ya está en la lista (el store es optimista). Aviso discreto: “Guardada en este dispositivo. Se sincroniza cuando vuelva la conexión.” | Rollback silencioso ni pérdida de lo escrito. |
| **Draft al cerrar** | Si hay texto y se cierra con `Esc` o `Listo`, el texto se conserva al reabrir. | Confirmación “¿descartar?”. |

### Contador de ráfaga

- Aparece recién después del primer guardado.
- Texto: `1 en esta ráfaga`, `2 en esta ráfaga`, `3 en esta ráfaga`.
- Vive en el estado del composer; se resetea al cerrar.
- Es la prueba de que no se abrió un modal por cada ítem.

---

## 4. Teclado

| Tecla | Acción |
|---|---|
| `Enter` | Guarda y **sigue abierto**. Limpia el campo. Mantiene el foco. |
| `Shift + Enter` | Salto de línea (solo manifestaciones; en afirmaciones no hace falta, pero se permite). |
| `Ctrl/Cmd + Enter` | Guarda y cierra. |
| `Esc` | Cierra y conserva el borrador. |
| `Tab` | Campo → micrófono → `Agregar` → `Listo`. Sin focus trap: no es un modal. |

Guardas de implementación:

- Ignorar `event.repeat` para que mantener Enter no agregue duplicados.
- Ignorar Enter durante composición IME: `event.nativeEvent.isComposing || event.keyCode === 229`.
- `isSubmitting` como guardia de doble submit.
- El campo de afirmaciones es un `textarea` de 1 fila que auto-crece hasta 3; el de manifestaciones auto-crece hasta 4.

---

## 5. Movimiento

Todo con los tokens existentes de `src/lib/iosSprings.ts` y `globals.css`.

| Momento | Movimiento | Duración / curva |
|---|---|---|
| Abrir composer | `opacity 0→1`, `y -6→0` | 180ms, `EMIL_EASE_OUT` |
| Cerrar | `opacity 1→0`, `y 0→-4` | 140ms, `EMIL_EASE_OUT` |
| Tarjeta nueva | `layout` + `opacity/scale 0.99→1` | 220ms, `EMIL_EASE_OUT` |
| Flash de guardado | Fondo `--pastel-*-wash` → `--color-surface-card` | 600ms, ease-out |
| Chip `Guardada` | Check `scale 0.9→1` + fade | 140ms, auto-hide 1200ms |
| Press en `Agregar` | `scale 0.97` | 100ms |
| Focus ring | Borde + anillo | 160ms |

Reglas:

- Nada empieza en `scale(0)`.
- Nada dura más de 300ms salvo el flash de la tarjeta (600ms), que es feedback de estado, no transición.
- `prefers-reduced-motion`: sin `y`, sin flash; solo cambio de opacidad o estado instantáneo.
- El flash de la tarjeta se hace con una animación CSS sobre `background-color` y se limpia al terminar; no se re-dispara en cada render.

---

## 6. Accesibilidad

- Label visible: `Nueva afirmación` / `Nueva manifestación`. No placeholder-only.
- `aria-describedby` apunta al hint y al aviso de lenguaje poético.
- Región `aria-live="polite"` separada del chip visual: al guardar anuncia “Afirmación agregada. 3 en esta ráfaga.”
- El chip `Guardada` puede ser `aria-hidden` para no duplicar el anuncio.
- `role="group"` con `aria-labelledby` en el composer; **no** `role="dialog"` ni `aria-modal`, porque no bloquea la página.
- Foco: al abrir, `requestAnimationFrame(() => field.focus())` + `scrollIntoView({ block: 'center' })`; al cerrar, devolver el foco al CTA del header.
- Targets ≥44px en móvil.
- Contraste: `--color-ink-muted` y `--color-ink-light` ya cumplen sobre `--color-surface-card`; el placeholder usa `ink-light`, no un gris más claro.
- El botón `+` tiene `aria-label="Agregar afirmación y seguir"`; el `Listo` tiene `aria-label="Cerrar composer y conservar lo agregado"`.

---

## 7. Copy

**Afirmaciones**

- Label: `Nueva afirmación`
- Placeholder: `Soy siempre la primera opción`
- Hint: `Enter guarda y sigue · Shift+Enter baja de línea`
- Guardado: `Guardada`
- Contador: `3 en esta ráfaga`
- Cerrar: `Listo`
- Aviso: `«{término}» es un término poético; probá con algo más directo.`

**Manifestaciones**

- Label: `Nueva manifestación`
- Placeholder: `Quiero manifestar…`
- Hint: `Enter guarda y sigue · Shift+Enter baja de línea`
- Guardado: `Intención guardada`
- Contador: `2 en esta ráfaga`
- Opciones: `Título y anclaje sensorial · opcional, se completan solos`
- Cerrar: `Listo`

**Móvil**

- Hint: `Enter o + guarda y sigue`
- El `+` es la acción primaria visible; Enter es el atajo.

---

## 8. Implementación en este repo

### Componentes

```
src/components/journal/QuickAddComposer.tsx        // shell, estados, teclado, contador
src/components/journal/AffirmationQuickAdd.tsx     // campo + validador poético + mic
src/components/journal/ManifestationQuickAdd.tsx   // campo + "Más opciones" + mic
```

`QuickAddComposer` recibe:

```ts
interface QuickAddComposerProps {
  label: string;
  placeholder: string;
  tone: 'rose' | 'butter';
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (text: string) => Promise<void>;
  onDraftChange?: (draft: string) => void;
  initialDraft?: string;
  savedLabel: string;
  children?: React.ReactNode; // "Más opciones" en manifestaciones
}
```

### Dónde se engancha

- `ManifestationsView.tsx`: el botón `Nueva manifestación` deja de llamar a `onOpenNewManifestation` y togglea el composer inline.
- `AffirmationsView.tsx`: ídem con `onOpenNewAffirmation`.
- Los modales actuales (`ManifestationEditorModal`, `AffirmationEditorModal`) **se mantienen** para edición avanzada. El composer es solo alta rápida.
- En manifestaciones, dentro de `ManifestationQuickAdd` va un `<details>` “Título y anclaje sensorial” que reutiliza los campos del modal, pero sin abrir modal.
- El `addAffirmation` / `addManifestation` del store ya actualizan el estado **antes** del `fetch` (optimista). Por eso el campo se puede limpiar inmediatamente y el guardado se siente instantáneo.

### Estados que hay que agregar al store o al componente

No hace falta tocar el store para el contador; vive en el componente:

```ts
const [isOpen, setIsOpen] = useState(false);
const [draft, setDraft] = useState('');
const [savedCount, setSavedCount] = useState(0);
const [justSaved, setJustSaved] = useState(false);
const [warning, setWarning] = useState<string | null>(null);
```

El draft se guarda en el padre o en `sessionStorage` si querés que sobreviva a un unmount.

### Detalles que hacen la diferencia

1. **No cerrar el composer al guardar.** Es la regla central.
2. **Mantener el foco en el campo.** Sin `blur`, sin `document.activeElement` rotando.
3. **Prepend + layout.** La tarjeta nueva entra arriba, el composer queda fijo; la lista crece hacia abajo.
4. **`onPointerDown` preventDefault en `+`** para que el teclado móvil no se cierre.
5. **Contador de ráfaga** para que el usuario vea el progreso sin abrir nada.
6. **Un solo acento relleno.** El `Agregar` del composer; el CTA del header se vuelve fantasma.
7. **Sin toast por cada guardado.** El chip + la tarjeta nueva ya son el feedback.
8. **El aviso poético no bloquea.** Es una línea inline, no un error de validación.
9. **`scrollIntoView` al abrir** en desktop, por si el usuario estaba abajo.
10. **En móvil, ocultar el bottom nav** mientras el composer está abierto; si no, se apilan dos barras.

---

## 9. Qué evitar

- Abrir un modal por cada ítem (el problema original).
- Cerrar el composer después de guardar.
- Un toast por cada guardado.
- Confeti o animación de “celebración” por agregar una frase.
- Validar mientras se escribe y pintar el campo de rojo.
- Un botón `Guardar` lleno en el header y otro lleno en el composer a la vez.
- Un bottom sheet con lista de chips + “Guardar todo”: agrega fricción y pierde la persistencia inmediata.
- Un composer de media celda en la grilla de 2 columnas.
- `scale(0)` o rebotes elásticos en la entrada de la tarjeta.
- Texto de placeholder como única etiqueta.

---

## 10. Por qué este diseño encaja con la app

- Usa los mismos materiales que ya existen: `--color-surface-card`, `--pastel-*-wash`, `--border-card`, `--radius-card`, `--color-accent`.
- No introduce un lenguaje visual nuevo: la franja se lee como una tarjeta más, pero teñida y sin la fila de acciones.
- Respeta la jerarquía actual: un solo CTA relleno por vista.
- Aprovecha que el store ya es optimista: no hay que inventar una capa de guardado.
- La tarjeta nueva entra con el mismo patrón de `layout` + `STAGGER_ITEM` que ya usan las vistas.
- En móvil no compite con el bottom nav: lo reemplaza mientras se escribe.

---

## 11. Criterios de aceptación

- [ ] Escribir una afirmación y presionar Enter la guarda y deja el campo vacío y enfocado.
- [ ] Se pueden agregar 5 afirmaciones seguidas sin que el composer se cierre.
- [ ] El contador muestra `5 en esta ráfaga`.
- [ ] La tarjeta nueva aparece arriba con flash y sin saltar el scroll.
- [ ] `Esc` cierra y al reabrir el borrador sigue ahí.
- [ ] `Ctrl/Cmd + Enter` guarda y cierra.
- [ ] En móvil, tocar `+` no cierra el teclado.
- [ ] En móvil, la última tarjeta no queda tapada por la barra.
- [ ] El bottom nav no se apila con la barra.
- [ ] `aria-live` anuncia cada guardado una sola vez.
- [ ] `prefers-reduced-motion` elimina el desplazamiento y el flash.
- [ ] Un texto con término poético muestra el aviso inline y se puede guardar igual.
- [ ] El modal viejo sigue disponible para edición avanzada.
