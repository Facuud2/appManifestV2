# 005 — Fade new tab content without delaying navigation

- **Status**: DONE
- **Commit**: Unavailable; this workspace is not a Git repository.
- **Severity**: MEDIUM
- **Category**: Missed opportunities
- **Estimated scope**: 1 file, page content wrapper

## Problem

`src/app/page.tsx` replaces each selected view inside a keyed plain `div`:

```tsx
<div key={activeTab}>
  {activeTab === 'dashboard' && <DashboardView ... />}
  {activeTab === 'manifestations' && <ManifestationsView ... />}
  {activeTab === 'progress' && <ProgressView ... />}
  {activeTab === 'stories' && <SuccessStoriesView ... />}
</div>
```

Changing the key unmounts the old view and mounts the new one immediately, so
the whole content area changes with no visual bridge.

## Target

Fade the newly mounted tab content from `opacity: 0` to `opacity: 1` over
`160ms` using `EMIL_EASE_OUT` (`[0.23, 1, 0.32, 1]`). Do not translate or scale
the page, wait for an exit animation, or block the tab action. The existing
list entrance stagger remains the only movement applied to list contents.

## Repo conventions to follow

- `src/lib/iosSprings.ts` exports `EMIL_EASE_OUT`.
- `src/app/page.tsx` owns `activeTab` and the keyed view wrapper.
- Existing list views use `STAGGER_CONTAINER` and `STAGGER_ITEM`; do not wrap
  those child animations in another stagger.

## Steps

1. Import `motion` from the existing `framer-motion` dependency and
   `EMIL_EASE_OUT` from `src/lib/iosSprings.ts`.
2. Replace only the keyed wrapper with a keyed `motion.div` whose initial
   opacity is `0`, animated opacity is `1`, and transition duration is `0.16`
   seconds with `EMIL_EASE_OUT`.
3. Keep the existing key and conditional view rendering so navigation and
   local state behavior remain unchanged.
4. Do not add `AnimatePresence` wait mode or an exit phase that delays new
   content.

## Boundaries

- Do NOT animate keyboard focus changes, data values, or list items a second
  time.
- Do NOT change navigation state, route behavior, or page structure.
- Do NOT use `y`, `scale`, layout animation, or a delayed exit.
- Respect `prefers-reduced-motion` through
  `plans/002-honor-reduced-motion.md`.

## Verification

- **Mechanical**: Run `npx tsc --noEmit` and `npm run build`; both must pass.
- **Feel check**: Switch among all four tabs repeatedly on desktop and mobile.
  The new view should become visible immediately and settle within `160ms`,
  without a blank pause or page movement.
- Confirm each list retains its existing stagger and navigation remains
  responsive to repeated taps.
- **Done when**: tab changes gain only a brief fade and do not delay interaction.
