# 004 — Connect the creation menu motion to its trigger

- **Status**: DONE
- **Commit**: Unavailable; this workspace is not a Git repository.
- **Severity**: MEDIUM
- **Category**: Physicality & origin
- **Estimated scope**: 1 file, responsive menu transitions

## Problem

`src/components/layout/CreateActionMenu.tsx` immediately returns `null` while
closed:

```tsx
if (!isOpen) return null;
```

The mobile sheet and desktop popover are rendered without motion wrappers:

```tsx
<div className="fixed inset-0 ... lg:hidden">
  <div ref={mobileMenuRef} role="dialog" ... className="swiss-modal ...">
```

```tsx
<div className="fixed inset-0 hidden lg:block">
  <div ref={desktopMenuRef} role="dialog" ... className="swiss-card absolute ...">
```

Both surfaces appear and disappear instantly even though the component
already records the trigger's bounding rectangle and computes the popover
position.

## Target

- Render conditionally inside `AnimatePresence` so exits can complete.
- Mobile: fade the backdrop and bring the sheet from `y: "100%"` to `y: 0`
  using the existing `EMIL_SHEET_SPRING` (`duration: 0.32`, `bounce: 0.12`);
  dismiss along the same edge.
- Desktop: fade and scale from `0.97` to `1` over `180ms` using
  `EMIL_EASE_OUT` (`[0.23, 1, 0.32, 1]`); set transform origin toward the
  trigger (the popover is positioned to its left).
- Keep the backdrop/modal relationship, anchor calculations, responsive
  visibility, and focus/keyboard handling intact.

## Repo conventions to follow

- `src/lib/iosSprings.ts` exports `EMIL_EASE_OUT`, `EMIL_SHEET_SPRING`,
  `BACKDROP_TRANSITION`, and modal variants.
- `AffirmationEditorModal` demonstrates `AnimatePresence` enter/exit handling.
- `CreateActionMenu` owns focus restoration and tab cycling; keep those refs
  attached to the actual visible dialog.

## Steps

1. Replace the early return with an `AnimatePresence` conditional around the
   open surfaces.
2. Add motion wrappers for the mobile backdrop and sheet using
   `EMIL_SHEET_SPRING`; preserve the existing focusable dialog element.
3. Add a desktop popover motion wrapper with `opacity` and `scale` only,
   `180ms`, `EMIL_EASE_OUT`, and a trigger-facing transform origin.
4. Ensure exit variants run for backdrop clicks, Escape, close, and selection.
5. Keep `requestAnimationFrame` focus entry and focus restoration behavior
   synchronized with the rendered menu.

## Boundaries

- Do NOT change the three action choices, their callbacks, or their labels.
- Do NOT change anchor positioning or mobile safe-area layout.
- Do NOT add item-by-item stagger; the three choices are frequent actions.
- Do NOT add movement for users requesting reduced motion; coordinate with
  `plans/002-honor-reduced-motion.md`.

## Verification

- **Mechanical**: Run `npx tsc --noEmit` and `npm run build`; both must pass.
- **Feel check**: Open the menu from the dashboard orb and mobile Create
  control. Confirm the sheet travels from the bottom and the desktop popover
  grows toward the orb, then exits by its entry path.
- Check that Escape, backdrop dismissal, action selection, focus trapping, and
  trigger focus restoration still work.
- Emulate reduced motion and confirm spatial movement is removed.
- **Done when**: both breakpoints have spatially coherent entry/exit without
  regressing menu behavior.
