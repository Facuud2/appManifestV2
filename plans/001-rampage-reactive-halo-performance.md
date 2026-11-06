# 001 — Stop rerendering Rampage for every audio frame

- **Status**: DONE
- **Commit**: Unavailable; this workspace is not a Git repository.
- **Severity**: HIGH
- **Category**: Performance
- **Estimated scope**: 1 file, focused change

## Problem

`src/components/goals/RampagePlayerModal.tsx` samples audio energy in
`requestAnimationFrame` and stores every sample in React state:

```tsx
const [reactiveHaloEnergy, setReactiveHaloEnergy] = useState(0);
```

```tsx
const loop = () => {
  if (audioEngine) {
    setReactiveHaloEnergy(audioEngine.getReactiveEnergy());
  }
  animId = requestAnimationFrame(loop);
};
```

While speech is playing, the energy changes each frame. Updating component
state at that rate can rerender the full player, including its text and
controls, at up to 60 times per second.

The rings consume that state through Framer Motion's `scale` shorthand:

```tsx
animate={{
  scale: isPlaying ? 1 + reactiveHaloEnergy * 0.35 : 1,
  opacity: isPlaying ? 0.8 : 0.3,
}}
```

The project uses `framer-motion` 12.4.7 (`package.json`). Avoid relying on
hardware acceleration of `x`, `y`, or `scale` shorthands in this version.

## Target

Keep the audio sampling loop, but write samples to a Framer Motion value rather
than React state. Derive the outer and middle ring values from that MotionValue
and apply a full CSS `transform` string to each ring. Preserve the existing
energy mapping exactly:

- Outer ring scale: `1 + energy * 0.35` while playing, otherwise `1`.
- Outer ring opacity: `0.8` while playing, otherwise `0.3`.
- Middle ring scale: `1 + energy * 0.18` while playing, otherwise `1`.
- The React component must not rerender for each audio sample.

Use `useMotionValue`, `useTransform`, and `useMotionTemplate` from the already
installed `framer-motion` package. Keep updates on `transform` and `opacity`;
do not animate layout dimensions or drive child transforms through a CSS custom
property.

## Repo conventions to follow

- The audio sampling loop is already isolated in `RampagePlayerModal.tsx`.
- Existing Framer Motion values and transitions are centralized in
  `src/lib/iosSprings.ts`.
- Preserve the current audio-engine contract; `getReactiveEnergy()` is a
  read-only accessor in `src/lib/audioEngine.ts`.

## Steps

1. Replace `reactiveHaloEnergy` state with MotionValues for the sampled energy
   and derived ring transforms/opacities.
2. In the existing animation-frame callback, call `.set(audioEngine.getReactiveEnergy())`
   on the energy MotionValue. Do not call a React state setter from this loop.
3. Replace each ring's `animate={{ scale: ... }}` with a `style` using a full
   transform string MotionValue and the derived opacity. Keep `isPlaying`
   changes reflected without adding per-frame React state.
4. Preserve requestAnimationFrame cleanup and the existing audio playback and
   fade behavior when playback stops.

## Boundaries

- Do NOT change `src/lib/audioEngine.ts`, audio timing, voice behavior, or the
  affirmation queue.
- Do NOT add dependencies or remove the core halo response.
- Do NOT add decorative motion to other Rampage content in this change.

## Verification

- **Mechanical**: Run `npx tsc --noEmit` and `npm run build`; both must pass.
- **Feel check**: Play Rampage with audio, pause, skip, and close it. The rings
  must follow audio energy smoothly and settle at their original idle state.
- In React DevTools Profiler, confirm audio samples no longer cause
  `RampagePlayerModal` React commits every frame.
- In browser Performance tools, record playback on a representative mobile
  viewport and confirm the animation remains smooth without recurring React
  render work for each sample.
- **Done when**: the same energy response is visible while the player no longer
  rerenders the component for every sampled audio frame.
