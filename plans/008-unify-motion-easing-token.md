# 008 — Unify the shared ease-out curve

- **Status**: DONE
- **Commit**: Unavailable; this workspace is not a Git repository.
- **Severity**: LOW
- **Category**: Cohesion & tokens
- **Estimated scope**: 2 files, token alignment

## Problem

The project defines two different ease-out curves for the same semantic token.
In `src/app/globals.css`:

```css
--ease-out: cubic-bezier(0.2, 0.8, 0.2, 1);
```

In `src/lib/iosSprings.ts`:

```ts
export const EMIL_EASE_OUT = [0.23, 1, 0.32, 1] as const;
```

CSS transitions and Framer Motion transitions therefore feel different even
when both are intended to be the app's ease-out.

## Target

Use the existing Framer Motion curve as the shared CSS token:

```css
--ease-out: cubic-bezier(0.23, 1, 0.32, 1);
```

Keep `EMIL_EASE_OUT` unchanged. Do not change `--ease-in-out`, duration tokens,
springs, or individual animation durations.

## Repo conventions to follow

- Semantic CSS motion tokens live in `src/app/globals.css`.
- Reusable Framer Motion constants live in `src/lib/iosSprings.ts`.
- `EMIL_EASE_OUT` is already used by modal variants, list entrances, and
  tap-feedback presets; use it as the source of truth.

## Steps

1. Update only the `--ease-out` value in the light/root token declaration in
   `src/app/globals.css`.
2. Confirm dark mode inherits the shared token and there is no second
   `--ease-out` declaration overriding it.
3. Leave durations, springs, component-specific transitions, and
   `EMIL_EASE_IN_OUT` unchanged.

## Boundaries

- Do NOT rename tokens or introduce a second motion-token file.
- Do NOT alter any component animation or change its timing.
- Do NOT add dependencies.

## Verification

- **Mechanical**: Run `npx tsc --noEmit` and `npm run build`; both must pass.
- Search for `--ease-out` and verify the CSS token and `EMIL_EASE_OUT` represent
  the same curve.
- **Feel check**: Compare one CSS transition (for example a `.swiss-pill`
  hover) with one Framer Motion transition (for example a modal); their
  deceleration should feel consistent, not slower or more bouncy.
- **Done when**: CSS and Framer Motion use the exact same ease-out values and
  no unrelated timing has changed.
