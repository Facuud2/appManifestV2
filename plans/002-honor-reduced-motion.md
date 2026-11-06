# 002 — Honor reduced motion across CSS and Framer Motion

- **Status**: DONE
- **Commit**: Unavailable; this workspace is not a Git repository.
- **Severity**: MEDIUM
- **Category**: Accessibility
- **Estimated scope**: 2 files, shared behavior

## Problem

`src/app/globals.css` currently disables CSS animation and transition feedback
almost completely:

```css
@media (prefers-reduced-motion: reduce) {
  *, ::before, ::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

This removes useful opacity/color feedback rather than only reducing movement.
Framer Motion transitions, including `MODAL_TRANSITION` in
`src/lib/iosSprings.ts` and the Rampage entrance, are not adapted by this CSS
rule.

## Target

Use Framer Motion's user preference support and retain brief non-spatial
feedback:

- Wrap the rendered application in `MotionConfig reducedMotion="user"` from
  `framer-motion` in `src/app/layout.tsx`.
- In the CSS media query, disable decorative keyframe animations, remove
  transform transitions, and retain opacity/color feedback at
  `var(--duration-fast)` (currently `160ms`).
- Keep `scroll-behavior: auto` for the reduced-motion preference.
- Do not add a separate preference store or a parallel motion token system.

## Repo conventions to follow

- CSS duration tokens are defined in `src/app/globals.css`; use
  `--duration-fast: 160ms`.
- Shared Framer Motion variants are in `src/lib/iosSprings.ts`.
- The root document and body are owned by the server component
  `src/app/layout.tsx`; wrap `{children}` without converting that file to a
  client component.

## Steps

1. Wrap `{children}` in `src/app/layout.tsx` with
   `<MotionConfig reducedMotion="user">`.
2. Update the reduced-motion CSS rule so infinite/decorative CSS keyframes do
   not run, transform movement is not transitioned, and opacity/color feedback
   remains at `var(--duration-fast)`.
3. Confirm Framer Motion continues to render opacity changes when reduced
   motion is enabled while suppressing spatial transforms.
4. Keep default-motion behavior unchanged.

## Boundaries

- Do NOT remove normal animation or interaction feedback for users without
  reduced motion enabled.
- Do NOT replace opacity feedback with a blanket `animation: none` treatment
  for all transitions.
- Do NOT modify audio or playback behavior.

## Verification

- **Mechanical**: Run `npx tsc --noEmit` and `npm run build`; both must pass.
- **Feel check**: Emulate `prefers-reduced-motion: reduce`. Open/close a modal
  and the create menu, switch tabs, and record voice. Confirm movement/pulsing
  is removed or reduced while fades and state/color feedback remain perceivable.
- Emulate `no-preference` and confirm existing modal, sheet, list, and Rampage
  motion remains intact.
- **Done when**: CSS and Framer Motion both respond to the system preference,
  with comprehension/feedback preserved and unnecessary movement removed.
