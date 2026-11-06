# 006 — Animate profile and preference popovers from their triggers

- **Status**: DONE
- **Commit**: Unavailable; this workspace is not a Git repository.
- **Severity**: LOW
- **Category**: Physicality & origin
- **Estimated scope**: 2 files, shared popover behavior

## Problem

The profile menu in `src/components/layout/UserScopeSwitcher.tsx` appears
immediately:

```tsx
{isOpen && (
  <div role="group" aria-label="Perfiles disponibles"
    className="swiss-card absolute right-0 top-full z-50 mt-2 min-w-40 p-1.5">
```

The mobile preferences menu in `src/components/layout/AppHeader.tsx` is also
inserted instantly by native `<details>`:

```tsx
<details className="relative lg:hidden">
  <summary ...><Ellipsis ... /></summary>
  <div className="swiss-card absolute right-0 top-full z-50 mt-2 w-52 p-2 shadow-dropdown">
```

The profile chevron already rotates when `isOpen` changes; the menu surface
itself has no corresponding transition.

## Target

- Both popovers enter with `opacity: 0, scale: 0.97` to `opacity: 1, scale: 1`,
  and exit in reverse.
- Use `160ms` and `EMIL_EASE_OUT` (`[0.23, 1, 0.32, 1]`).
- Set transform origin toward each trigger, which is above and right-aligned
  with the menu.
- Preserve visible focus, labels, selected state, click-away behavior, and
  keyboard operation. The mobile preferences trigger must expose
  `aria-expanded`.

## Repo conventions to follow

- `UserScopeSwitcher` already uses React state for open/closed state and
  handles outside pointer events and Escape.
- `src/lib/iosSprings.ts` exports `EMIL_EASE_OUT`.
- Use `AnimatePresence` and motion wrappers as in
  `src/components/journal/AffirmationEditorModal.tsx`.

## Steps

1. In `UserScopeSwitcher.tsx`, wrap the conditional menu in `AnimatePresence`
   and render the surface as a motion element with the target opacity/scale
   variants and origin.
2. In `AppHeader.tsx`, replace the mobile `<details>/<summary>` toggle with a
   controlled button and open state so the menu can finish its exit transition.
3. Preserve the existing preference actions and add equivalent outside-click
   and Escape closing for the controlled menu; expose `aria-expanded` and
   restore focus to its trigger on Escape.
4. Ensure the profile chevron's existing rotation stays synchronized with the
   profile menu's state.

## Boundaries

- Do NOT change profile choices, theme switching, calibration actions, or
  desktop header controls.
- Do NOT add a new popover library.
- Do NOT add bounce or per-item stagger to these small menus.
- Respect reduced motion via `plans/002-honor-reduced-motion.md`.

## Verification

- **Mechanical**: Run `npx tsc --noEmit` and `npm run build`; both must pass.
- **Feel check**: Open/close each popover by pointer and keyboard. Confirm it
  grows from the trigger-facing edge and exits symmetrically.
- Confirm outside click, Escape, focus return, and `aria-expanded` state.
- Emulate reduced motion and confirm the popover fades without scaling.
- **Done when**: both menus gain the same restrained spatial behavior without
  changing their actions.
