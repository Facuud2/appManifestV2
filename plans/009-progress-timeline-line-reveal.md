# 009 — Reveal the progress timeline connector once

- **Status**: DONE
- **Commit**: Unavailable; this workspace is not a Git repository.
- **Severity**: LOW
- **Category**: Missed opportunities
- **Estimated scope**: 1 file, timeline connector only

## Problem

`src/features/tracking/ProgressView.tsx` renders the timeline connector as a
static border on the same container as the list:

```tsx
<motion.div
  variants={STAGGER_CONTAINER}
  initial="hidden"
  animate="show"
  className="relative border-l border-zinc-200 dark:border-zinc-800 ml-3 sm:ml-4 space-y-5 py-2"
>
```

The entries already have a `45ms` stagger and `250ms` fade/transform entrance
through `STAGGER_CONTAINER` and `STAGGER_ITEM`. Animating all card content again
would be redundant; the connector itself has no motion explaining the timeline
relationship.

## Target

Animate only the connector from `scaleY(0)` to `scaleY(1)` with
`transform-origin: top`, opacity `0` to `1`, `250ms`, and `EMIL_EASE_OUT`
(`[0.23, 1, 0.32, 1]`). Keep entries and their existing stagger unchanged.

## Repo conventions to follow

- `src/lib/iosSprings.ts` exports `EMIL_EASE_OUT`, `STAGGER_CONTAINER`, and
  `STAGGER_ITEM`.
- `ProgressView` already uses Framer Motion.
- The list marker is positioned at the timeline's left edge; preserve its
  alignment and the current `ml-3 sm:ml-4` offsets.

## Steps

1. Remove the container's static left border and keep it positioned relative.
2. Add one decorative, `aria-hidden` absolute connector element behind the
   entries, aligned to the former border position.
3. Animate the connector with opacity and `scaleY` from top to bottom using
   the exact target duration and curve; do not animate its width/height.
4. Keep card wrappers, dots, and their existing list variants unchanged.

## Boundaries

- Do NOT animate the text, card positions, timestamps, or progress values.
- Do NOT add scroll-triggered animation or replay the connector on each data
  update.
- Respect reduced motion via `plans/002-honor-reduced-motion.md`.

## Verification

- **Mechanical**: Run `npx tsc --noEmit` and `npm run build`; both must pass.
- **Feel check**: Open the Avances view with several entries. Confirm the
  connector draws once from top to bottom and remains aligned with every dot
  at mobile and desktop widths.
- Confirm entries retain their current stagger and reduced-motion mode removes
  the scale movement.
- **Done when**: the connector clarifies the timeline without moving its data.
