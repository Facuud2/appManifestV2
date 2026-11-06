# Animation plans

These are implementation specifications only; application source has not been
modified. The workspace is not a Git repository, so plan commit stamps are
unavailable.

| # | Plan | Severity | Status |
|---|---|---|---|
| 001 | [Stop rerendering Rampage for every audio frame](./001-rampage-reactive-halo-performance.md) | HIGH | DONE |
| 002 | [Honor reduced motion across CSS and Framer Motion](./002-honor-reduced-motion.md) | MEDIUM | DONE |
| 003 | [Make the mobile affirmation editor enter as a sheet](./003-affirmation-mobile-sheet-motion.md) | MEDIUM | DONE |
| 004 | [Connect the creation menu motion to its trigger](./004-create-menu-spatial-motion.md) | MEDIUM | DONE |
| 005 | [Fade new tab content without delaying navigation](./005-tab-content-fade.md) | MEDIUM | DONE |
| 006 | [Animate profile and preference popovers from their triggers](./006-header-popover-motion.md) | LOW | DONE |
| 007 | [Animate calibration progress without layout movement](./007-calibration-step-indicator.md) | LOW | DONE |
| 008 | [Unify the shared ease-out curve](./008-unify-motion-easing-token.md) | LOW | DONE |
| 009 | [Reveal the progress timeline connector once](./009-progress-timeline-line-reveal.md) | LOW | DONE |
| 010 | [Crossfade the Rampage play and pause states](./010-rampage-transport-state-crossfade.md) | LOW | DONE |
| 011 | [Pastel cutie palette (Pinkie Pie, sin gradientes)](./011-pastel-cutie-palette.md) | HIGH | DONE |

## Recommended execution order

1. **008** — establish one shared ease-out token before adding more transitions.
2. **002** — make the reduced-motion behavior consistent before expanding
   motion.
3. **001** — remove per-frame React rendering from Rampage before tuning its
   motion further.
4. **003, 004, 005, 006** — implement the sheet, creation menu, page fade, and
   header popovers.
5. **007, 009, 010** — make the calibration indicator, timeline connector,
   and Rampage transport refinements.

## Dependencies

- **002** should precede **003–007** and **009–010**, so new motion is checked
  against the reduced-motion behavior while being implemented.
- **008** should precede **003–007** and **009–010** to reuse the unified
  easing token.
- **001** is independent of the other plans.
- **005** should be validated after **002** because its fade is part of the
  reduced-motion behavior.
- **009** should preserve the existing list stagger; it does not depend on
  card animation changes.
