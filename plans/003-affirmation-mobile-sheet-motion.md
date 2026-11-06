# 003 — Make the mobile affirmation editor enter as a sheet

- **Status**: DONE
- **Commit**: Unavailable; this workspace is not a Git repository.
- **Severity**: MEDIUM
- **Category**: Physicality & origin
- **Estimated scope**: 1 file, focused responsive transition

## Problem

`src/components/journal/AffirmationEditorModal.tsx` renders its editor at the
bottom of mobile screens, but applies the same centered modal variants at every
viewport:

```tsx
<motion.section
  variants={MODAL_TRANSITION}
  initial="hidden"
  animate="visible"
  exit="exit"
  className="swiss-modal w-full max-w-lg rounded-t-[var(--radius-modal)] rounded-b-none ..."
>
```

The shared desktop modal transition in `src/lib/iosSprings.ts` starts at
`scale: 0.96, y: 8`; this does not explain the mobile sheet's bottom-anchored
position.

## Target

- At widths below Tailwind's `sm` breakpoint (`640px`), enter from
  `y: "100%"` with `opacity: 0` to `y: 0` and `opacity: 1`, using the existing
  `EMIL_SHEET_SPRING` (`duration: 0.32`, `bounce: 0.12`).
- Exit along the same bottom edge.
- At `sm` and wider, preserve `MODAL_TRANSITION` unchanged.
- Respect the user's reduced-motion preference as described in
  `plans/002-honor-reduced-motion.md`.

## Repo conventions to follow

- Modal backdrop and panel use `AnimatePresence` and shared variants from
  `src/lib/iosSprings.ts`.
- The existing sheet spring is exported as `EMIL_SHEET_SPRING`; reuse it rather
  than defining another spring.
- Tailwind's responsive breakpoint for the current desktop panel classes is
  `sm` (`640px`).

## Steps

1. Add responsive state for the `sm` media query, including a resize listener
   cleanup; do not duplicate the form or dialog markup.
2. Select mobile sheet variants and `EMIL_SHEET_SPRING` below `640px`; select
   `MODAL_TRANSITION` at `640px` and above.
3. Preserve existing backdrop behavior, safe-area padding, focus management,
   validation, save logic, and close behavior.
4. Ensure the sheet's exit direction matches its entrance.

## Boundaries

- Do NOT change form fields, validation, store actions, or copy.
- Do NOT alter desktop modal geometry or timing.
- Do NOT add a new animation dependency.

## Verification

- **Mechanical**: Run `npx tsc --noEmit` and `npm run build`; both must pass.
- **Feel check**: At `375px`, open and dismiss the editor by close button,
  backdrop, and Escape; confirm it moves from and returns to the bottom edge.
  At `640px` and desktop width, confirm the editor remains centered.
- Emulate reduced motion; confirm the sheet loses its slide/spring while
  retaining a subtle opacity transition.
- **Done when**: one dialog keeps its existing behavior and uses an origin
  appropriate to each viewport.
