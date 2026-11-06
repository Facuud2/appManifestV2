# 011 — Pastel cutie palette (Pinkie Pie, sin gradientes)

## What the product is

**Manifest Sanctuary** is an intimate manifestation journal delivered as a
mobile-first PWA. The user writes intentions, pins affirmations, logs progress,
collects success stories and records a voice "Rampage". Navigation is a bottom
tab bar on phones and a collapsible glass rail on desktop. The tone is calm,
personal and a little ceremonial: a sanctuary, not a productivity dashboard.

The current palette already separates **content colour** (six pastel category
pigments) from **chrome** (paper neutrals + one deep pine action colour). That
structure is right. The direction being replaced is the *mood*: warm grey paper,
deep pine accent and a sage hero read editorial/Swiss, not cute.

## Direction

Translate "pastel cutie / chica aesthetic / Pinkie Pie" into a system that still
feels like a sanctuary:

- **Blush paper, plum ink.** The page is a very pale pink, not grey. Body text
  is a soft plum-black, never pure black.
- **Raspberry rose is the only action colour.** Pastels stay content; chrome
  stays quiet. One filled action per view, as before.
- **Candy pigments for the six categories.** Mint, apricot, baby blue, rose,
  lemon and lilac are all lightened and slightly warmed.
- **Flat colour fields, no gradients.** Pigment lives in solid washes, dots,
  borders and small icon tiles. No purple-blue gradients, no glowing blobs, no
  iridescent AI-style meshes. Glass is reserved for floating chrome, exactly as
  the codebase already does.
- **Playful, not childish.** Rounded shapes and candy colour carry the
  personality; type, spacing and contrast stay disciplined.

## Ramps

### Neutral (hue 350, low chroma)

| Step | Hex | Role |
|---|---|---|
| 50 | `#fdf8fa` | page background (implemented slightly warmer: `#fdf4f7`) |
| 100 | `#f8f2f4` | subtle background |
| 200 | `#f1e8eb` | component hover / separator |
| 300 | `#e5dbdf` | border |
| 400 | `#d4c8cd` | hovered border |
| 600 | `#9e9297` | disabled text |
| 700 | `#80767a` | low-contrast text candidate |
| 800 | `#696064` | secondary text candidate |
| 950 | `#241f21` | primary text candidate |

### Accent — raspberry rose (hue 356)

| Step | Hex | Role |
|---|---|---|
| 50 | `#fff3f7` | accent wash |
| 100 | `#ffe3ee` | accent subtle background |
| 200 | `#ffcbe0` | accent border |
| 300 | `#ffabce` | focus / hovered border |
| 500 | `#e46199` | decorative |
| 600 | `#c8397c` | **solid fill** (white text 4.85:1) |
| 700 | `#ab2968` | **accent text** on light (5.99:1 on page) |
| 800 | `#8b2154` | pressed / strong text |
| 950 | `#46142a` | deep accent |

### Status

| Token | Hex | Check |
|---|---|---|
| success | `#048254` | 4.50:1 on page, white 4.85:1 |
| warning | `#9d6500` | 4.53:1 on page, white 4.89:1 |
| danger | `#b83837` | 5.32:1 on page, white 5.74:1 |

Danger sits ~29° from the accent hue, so destructive and primary actions do not
read as the same colour.

### Content pigments

| Pigment | Fill | Ink | Ink/fill |
|---|---|---|---|
| sage (mint) | `#ddf7ec` | `#0d6a4c` | 5.84:1 |
| peach (apricot) | `#ffe8d8` | `#8a4218` | 6.19:1 |
| sky (baby blue) | `#ddf0ff` | `#14587f` | 6.58:1 |
| rose (bubblegum) | `#ffe1ec` | `#8c2a4f` | 6.73:1 |
| butter (lemon) | `#fff4cc` | `#6a5000` | 6.91:1 |
| peri (lilac) | `#eee7ff` | `#54408f` | 6.98:1 |

### Dark appearance

The dark theme is a plum-black sanctuary, not an inversion: `#171014` page,
`#21161d` cards, `#ff9ec4` accent, `#2a0d18` text on the accent. Vividness is
reduced relative to the light ramp and every pair was re-measured:

- primary text on page: 16.6:1
- secondary text on page: 8.5:1
- low-contrast text on page: 5.4:1
- accent text on page: 11.2:1
- accent foreground on accent fill: 9.4:1

## Measured pairs (light)

| Pair | Ratio | Requirement |
|---|---|---|
| ink / page | 14.67:1 | 4.5:1 |
| ink-muted / page | 6.05:1 | 4.5:1 |
| ink-light / page | 4.55:1 | 4.5:1 |
| ink / card | 15.42:1 | 4.5:1 |
| white / accent solid | 4.85:1 | 4.5:1 |
| accent text / page | 5.99:1 | 4.5:1 |
| accent text / hero field | 5.30:1 | 4.5:1 |
| ink-muted / hero field | 5.36:1 | 4.5:1 |

All ratios were measured with `culori`'s `wcagContrast`, not estimated.

## Implementation

- `src/app/globals.css` — light and dark token blocks, reduced-transparency
  fallbacks, hero field switched from sage to rose.
- `tailwind.config.ts` — adds the semantic `swiss.accentText` alias so solid
  fills and accent-coloured text stop sharing one value.
- `src/**/*.tsx` — `text-swiss-accent` becomes `text-swiss-accentText`.
- `src/app/layout.tsx`, `src/store/index.ts`, `public/manifest.json` — theme
  colour follows the new page background.

Gradients: none added. The only material effects remain flat washes, solid
pigment shapes and glass blur on floating chrome.
