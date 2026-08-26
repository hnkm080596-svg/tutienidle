# Mortal Enemy Art Batch Plan

## Scope

Render the 19 missing enemy assets for the Mortal realm. The existing
`mortal-mountain-bandit-v1.png` remains the visual baseline and is not
overwritten.

Every enemy ID receives its own PNG. Ferocious variants are not implemented as
a runtime tint because they need a visibly stronger silhouette while preserving
the identity of their base species.

## Shared art direction

- 2D chibi mac-hoa / ink-painted xianxia game art.
- Three-quarter combat pose facing screen-left toward the player.
- Full body or full creature silhouette, centered with even transparent padding.
- Readable at approximately 96 px combat display size.
- Mortal-scale threat: grounded anatomy and materials, with elemental cues kept
  subtle rather than turning the creature into a high-realm magical beast.
- Genuine RGBA transparency; no checkerboard, scene, ground, cast shadow, text,
  frame, logo, or watermark.
- Base species use a clear, restrained silhouette. Ferocious variants retain the
  species design but gain heavier mass, more aggressive posture, rougher edges,
  scars or worn details, and slightly stronger elemental accents.

## Asset matrix

| Floors | Element | Base asset | Ferocious asset |
| --- | --- | --- | --- |
| 1-2 | Wood | `mortal-wild-boar-v1.png` | `mortal-ferocious-wild-boar-v1.png` |
| 1-2 | Wood | Existing `mortal-mountain-bandit-v1.png` | `mortal-ferocious-mountain-bandit-v1.png` |
| 3-4 | Fire | `mortal-feral-dog-v1.png` | `mortal-ferocious-feral-dog-v1.png` |
| 3-4 | Fire | `mortal-savage-tiger-v1.png` | `mortal-ferocious-savage-tiger-v1.png` |
| 5-6 | Earth | `mortal-stone-lynx-v1.png` | `mortal-ferocious-stone-lynx-v1.png` |
| 5-6 | Earth | `mortal-mud-ox-v1.png` | `mortal-ferocious-mud-ox-v1.png` |
| 7-8 | Metal | `mortal-silver-fox-v1.png` | `mortal-ferocious-silver-fox-v1.png` |
| 7-8 | Metal | `mortal-iron-boar-v1.png` | `mortal-ferocious-iron-boar-v1.png` |
| 9-10 | Water | `mortal-water-wolf-v1.png` | `mortal-ferocious-water-wolf-v1.png` |
| 9-10 | Water | `mortal-giant-crocodile-v1.png` | `mortal-ferocious-giant-crocodile-v1.png` |

## Production order

1. Generate and inspect all nine missing base species.
2. Generate each ferocious variant using its approved base species as an
   identity reference; use the existing mountain bandit for its ferocious form.
3. Extract baked backgrounds only when ImageGen fails to return real alpha.
4. Validate dimensions, RGBA channels, non-opaque background, transparent trim,
   orientation, cropping, and 96 px readability.
5. Keep art production separate from CombatScene texture mapping. Integration
   and per-enemy display sizing are a follow-up implementation step.

## Acceptance checklist

- 19 new versioned PNG files are present under
  `public/assets/enemies/mortal/`.
- All 20 Mortal enemy IDs have an art candidate when the existing bandit is
  included.
- Base/ferocious pairs are immediately recognizable as the same species.
- Each asset faces screen-left and has a clear ground-contact or body baseline.
- Every delivered PNG has a real alpha channel and remains legible at 96 px.
