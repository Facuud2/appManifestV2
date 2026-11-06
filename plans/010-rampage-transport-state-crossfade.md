# 010 — Crossfade the Rampage play and pause states

- **Status**: DONE
- **Commit**: Unavailable; this workspace is not a Git repository.
- **Severity**: LOW
- **Category**: Missed opportunities
- **Estimated scope**: 1 file, transport icon state only

## Problem

The Rampage play button gives press feedback, but its icon swaps immediately
when playback state changes in `src/components/goals/RampagePlayerModal.tsx`:

```tsx
<motion.button
  whileTap={{ scale: 0.95 }}
  onClick={togglePlayback}
  ...
>
  {isPlaying ? <Pause size={24} /> : <Play size={24} className="translate-x-0.5" />}
</motion.button>
```

The player already has audio-reactive rings and a phrase crossfade. The
transport control's state indication is the remaining abrupt swap; no
additional always-on decoration is needed.

## Target

Crossfade only the play/pause glyph using `AnimatePresence mode="wait"` and
Framer Motion opacity from `0` to `1` (and back) over `160ms` with
`EMIL_EASE_OUT` (`[0.23, 1, 0.32, 1]`). Do not scale or move the icon. Keep the
existing button `whileTap` scale and playback callback unchanged.

## Repo conventions to follow

- `RampagePlayerModal.tsx` already imports `AnimatePresence` and `motion`.
- `EMIL_EASE_OUT` is exported from `src/lib/iosSprings.ts`.
- The affirmation text transition in `RampagePlayerModal.tsx` demonstrates
  keyed `AnimatePresence mode="wait"`; use an opacity-only variant for this
  frequent control state.

## Steps

1. Import `EMIL_EASE_OUT` from `src/lib/iosSprings.ts`.
2. Wrap the conditional `Pause`/`Play` glyph in keyed motion elements inside
   `AnimatePresence mode="wait"` with `initial={false}`.
3. Animate opacity only over `160ms` using `EMIL_EASE_OUT`.
4. Preserve the button's accessible title, playback function, and `whileTap`
   feedback.

## Boundaries

- Do NOT delay, debounce, or otherwise alter the audio start/pause action.
- Do NOT add continuous animation to idle Rampage controls.
- Do NOT change the audio-reactive rings, affirmation text, or ambience
  controls.
- Respect reduced motion via `plans/002-honor-reduced-motion.md`.

## Verification

- **Mechanical**: Run `npx tsc --noEmit` and `npm run build`; both must pass.
- **Feel check**: Start and pause playback repeatedly. The audio action should
  respond immediately while the icon crossfades within `160ms`.
- Confirm the button retains its existing press feedback and is still
  keyboard-operable.
- Emulate reduced motion and confirm the state remains perceivable without
  spatial movement.
- **Done when**: play/pause state changes gain a brief opacity bridge without
  delaying audio or introducing extra persistent motion.
