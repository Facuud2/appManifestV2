# 007 — Animate calibration progress without layout movement

- **Status**: DONE
- **Commit**: Unavailable; this workspace is not a Git repository.
- **Severity**: LOW
- **Category**: Performance
- **Estimated scope**: 1 file, step indicator only

## Problem

The three step bars in `src/components/voice/VoiceCalibrationModal.tsx` change
their width via `transition-all`:

```tsx
className={`h-1 rounded-sm transition-all duration-300 ${
  idx === currentStep
    ? 'w-6 bg-swiss-accent'
    : idx < currentStep
    ? 'w-3 bg-zinc-900 dark:bg-zinc-100'
    : 'w-3 bg-zinc-200 dark:border-zinc-800 dark:bg-zinc-800'
}`}
```

The active width change participates in layout and moves later bars. The
300ms `transition-all` also includes properties that do not need to animate.

## Target

Keep the step indicator layout fixed and animate the active bar with
`transform: scaleX(2)` from its center, with a `220ms` transition using
`var(--ease-out)`. Use a fixed `w-3` base width and make the transform origin
explicit. Keep the existing completed/current/future colors.

## Repo conventions to follow

- `src/app/globals.css` defines `--duration-normal: 220ms` and
  `--ease-out`.
- This indicator is a three-step status indicator in the calibration modal;
  do not change its semantics or phrase content.
- Global reduced-motion CSS is in `src/app/globals.css`; coordinate with
  `plans/002-honor-reduced-motion.md`.

## Steps

1. Replace width-changing utility classes with a fixed base width for each
   indicator.
2. Apply `scaleX(2)` to the active indicator and `scaleX(1)` to inactive
   indicators, with `transform-origin: center`.
3. Replace `transition-all duration-300` with a transform/color transition
   using `220ms` and `var(--ease-out)`.
4. Keep the same active, completed, and future color mapping.

## Boundaries

- Do NOT animate phrase text, calibration audio, or the microphone button as
  part of this plan.
- Do NOT change the step order, current-step logic, or modal behavior.
- Do NOT add Framer Motion to the indicator.

## Verification

- **Mechanical**: Run `npx tsc --noEmit` and `npm run build`; both must pass.
- **Feel check**: Advance through all three calibration phrases. The active
  bar should lengthen without pushing adjacent bars or shifting the group.
- Check light/dark colors and reduced-motion behavior.
- **Done when**: only transform/color animate; no width transition or layout
  shift remains.
