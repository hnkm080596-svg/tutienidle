# Ink-wash UI art source

This directory preserves the production source and review trail for the scalable
ink-wash UI kit. Runtime files are generated into `public/assets/ui/ink-wash`.

## Style anchor

`style-anchor.png` fixes the shared material language: warm white xuan paper,
carbon-black dry brush, smoky gray wash, cinnabar pigment, muted mineral jade,
pale azure, and pale mineral gold. Metallic silver, neon, bevels, readable text,
and baked UI labels are outside the approved style.

Final prompt:

> One clean production material reference sheet showing warm white xuan paper,
> carbon-black dry brush, smoky gray wash, a dark ink data surface, cinnabar seal
> pigment, muted mineral jade, pale azure, and pale mineral gold. Refined East
> Asian ink wash on absorbent rice paper; unlabeled swatches and brush samples,
> generous separation, no text, UI mockup, character, metallic silver, neon, or
> watermark.

## Approved XS/S masters

| Asset | Master | Art direction |
|---|---|---|
| `frame-xs-ink-line` | `approved/frame-xs-ink-line@4x.png` | Restrained carbon dry-brush line, transparent center, calm stretch regions. |
| `button-s-paper` | `approved/button-s-paper@4x.png` | Warm xuan paper, transparent exterior, carbon perimeter, empty text-safe center. |
| `button-s-ink` | `approved/button-s-ink@4x.png` | Dense near-black ink center, dry-brush edge, transparent exterior. |
| `button-s-seal` | `approved/button-s-seal@4x.png` | Neutral grayscale stamp-like perimeter, tint-safe for code-rendered cinnabar. |
| `frame-s-slot` | `approved/frame-s-slot@4x.png` | Strong square ink silhouette with transparent center and restrained corner flicks. |

Shared generation constraints:

> Orthographic flat UI texture; exact requested aspect ratio; fixed expressive
> corners; straight calm edge centers; no decoration crossing slice boundaries;
> no text, icon, character, watermark, modern bevel, glow, or metallic silver.
> Use genuine transparent alpha outside filled assets and in frame centers.

Each source was generated independently, then corrected one defect at a time to
remove baked checkerboard backgrounds. `scripts/prepare-ink-wash-small-masters.mjs`
normalizes accepted sources to exact @4x dimensions. The seal master deliberately
remains grayscale: danger-state cinnabar is applied in code instead of being baked
into the raster.

Run:

```bash
node scripts/prepare-ink-wash-small-masters.mjs
npm.cmd run assets:ink-ui
```

During incremental production, the asset build exports all approved tiers and
reports the still-missing later-tier masters. Review the generated size matrix at
`public/assets/ui/ink-wash/review/ink-wash-ui-size-matrix.png`.

## Approved M/L/XL masters

| Asset | Master | Production role |
|---|---|---|
| `surface-m-paper` | `approved/surface-m-paper@4x.png` | Quiet xuan-paper card/tooltip surface. |
| `frame-m-seal-corner` | `approved/frame-m-seal-corner@4x.png` | Transparent card frame with restrained stamp corner. |
| `surface-l-ink-data` | `approved/surface-l-ink-data@4x.png` | Near-black live-data surface for pale text. |
| `frame-l-landscape` | `approved/frame-l-landscape@4x.png` | Transparent landscape frame; scenery compressed inside 48px logical corners. |
| `surface-xl-paper-scroll` | `approved/surface-xl-paper-scroll@4x.png` | Broad ceremonial paper for forms and long copy. |
| `frame-xl-ceremony` | `approved/frame-xl-ceremony@4x.png` | Ceremonial frame; cloud curls confined inside 80px logical corners. |

Each master used the style anchor and the exact tier request recorded in
`docs/superpowers/plans/2026-08-29-ink-wash-nine-slice-ui.md`. Targeted frame
edits reduced corner scenery to the outermost 15% before normalization.
`scripts/prepare-ink-wash-large-masters.mjs` produces exact 768/1280/2048px
masters and extracts real alpha from accepted grayscale ink edits.

## Approved painting overlays

`wash-corner-mountain-left`, `wash-corner-mountain-right`, `wash-bottom-mist`,
`wash-bamboo-right`, `seal-cinnabar-small`, and `seal-cinnabar-large` are
transparent, text-free composition bridges. Their final prompts follow one rule:
the named subject enters only from its documented edge, fades to alpha 0 before
the content-safe center, and contains no frame, character, readable glyph,
checkerboard, or watermark. The cinnabar seals use abstract broken pigment and
geometric negative space rather than writing.
