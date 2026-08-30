# Động Phủ Seasonal Parallax Design

## Goal

Replace the current home background with an outdoor immortal-sect landscape rendered as layered Chinese ink painting. “Động Phủ” remains the screen name; the environment is not a literal cave. The scene must support separately placed 2D buildings, a central cultivation character, four seasons, four times of day, and deep cloud-and-mist parallax.

The home scene shares the active `ThanhVanVariant` with combat, so season and time remain visually consistent when moving between home and battle.

## Approved visual composition

- Wide `1672 × 941` side-view canvas.
- Open sky, distant mountains, river and cloud sea; no cave roof, enclosing walls, isometric terrain, circular arena, or visible receding floor.
- A long, straight natural cliff edge across the lower foreground provides generous building placement space. Scenic variety comes from trees, rocks, waterfalls, vegetation and mist, not from bending this baseline.
- Large natural rock ledges appear on both sides and at staggered middle/far depths. Distant ledges are smaller, paler and softened by mist, but retain substantial rock bodies rather than resembling floating platform-game tiles.
- One low side-view cultivation dais sits at the exact center. It has a thin top rim, a vertical stone face, restrained carved formation lines, and space for one seated cultivator plus aura effects.
- Building sprites are never baked into the background. Future buildings can be staggered across far, middle and foreground positions, with scale and ink density conveying depth.

## Art direction

- Premium `shui-mo` / Chinese ink painting on ivory `xuan` paper.
- Dominant carbon black, charcoal and smoke gray. Warm ochre, antique gold, pale jade and cinnabar are restrained seasonal or lighting accents.
- No purple or magenta in final art.
- Transparent overlays are produced from white-paper plates and converted to genuine alpha. Chroma-magenta intermediates are not project deliverables or review images.
- Mountains, ledges, ground and dais keep identical geometry across all seasons so building anchors remain stable.

## Seasonal art

| Season | Treatment |
| --- | --- |
| Spring | Soft gray ink, pale jade shoots, restrained blossom marks, light rain mist. |
| Summer | Deeper ink, full dark-green pines, stronger waterfalls and humid rolling cloud. |
| Autumn | Warm earth and restrained cinnabar, sparse falling leaves, clearer dry air. |
| Winter | Near-monochrome ink, snow on ledges and pines, thinner vegetation and cold fog. |

## Time-of-day art

| Time | Treatment |
| --- | --- |
| Morning | Warm ivory dawn, low luminous haze and long soft cloud bands. |
| Noon | Whiter paper light, crisp ink contrast and reduced warmth. |
| Evening | Muted antique-gold and cinnabar wash, darker cloud undersides. |
| Night | Charcoal-indigo ink wash, moonlit paper highlights and no neon-blue glow. |

Time controls sky, high clouds and distant illumination. Season controls landscape, vegetation, water, snow/leaves and low atmosphere.

## Modular asset architecture

Runtime composes ten aligned layers. Four time sets provide three layers each; four season sets provide seven layers each. This yields all sixteen season/time combinations from forty source textures rather than authoring 160 independent layer files.

| Order | Variant source | File | Content | Maximum pointer shift |
| ---: | --- | --- | --- | ---: |
| 0 | Time | `00-sky.png` | Opaque paper sky and primary light | `0px` |
| 1 | Time | `01-high-clouds.png` | Transparent high cloud bands | `1px` |
| 2 | Time | `02-light-veil.png` | Transparent distant light and haze | `2px` |
| 3 | Season | `03-far-mountains.png` | Pale far peaks | `4px` |
| 4 | Season | `04-distant-ledges.png` | Far rock ledges and sparse pines | `6px` |
| 5 | Season | `05-mid-landscape.png` | Mid mountains, cliffs, pines and waterfalls | `8px` |
| 6 | Season | `06-water-valley.png` | River, islands and valley mist | `10px` |
| 7 | Season | `07-sect-ground.png` | Straight buildable cliff and cultivation dais | `12px` |
| 8 | Season | `08-low-mist.png` | Rolling cloud/mist bands crossing the landscape | `14px` |
| 9 | Season | `09-foreground.png` | Near rocks, branches, vegetation and mist | `18px` |

All files use the full `1672 × 941` canvas. `00-sky.png` is opaque; every other file must contain genuine alpha. QA composites are stored separately and are never loaded at runtime.

Proposed asset tree:

```text
public/assets/backgrounds/dong-fu/modular/
  times/{morning,noon,evening,night}/
    00-sky.png
    01-high-clouds.png
    02-light-veil.png
  seasons/{spring,summer,autumn,winter}/
    03-far-mountains.png
    04-distant-ledges.png
    05-mid-landscape.png
    06-water-valley.png
    07-sect-ground.png
    08-low-mist.png
    09-foreground.png
  previews/
    all-16-contact-sheet.png
    <season>-<time>.png
  README.md
```

## Runtime behavior

`DongFuScene.vue` reads `peekThanhVanVariant()` from the existing combat art module. It does not create another store or variant cache.

- At boot, home uses the same default or deterministic QA override as combat.
- Combat continues to choose and commit its next variant with the existing lifecycle.
- When `stageActive` changes back to false, home reads `peekThanhVanVariant()` again.
- If the variant changed, the scene loads the complete incoming ten-layer stack and crossfades it as one unit. It never exposes a half-old, half-new combination.
- If any incoming texture fails, the old complete stack stays visible. With no valid stack, the existing paper/ink CSS fallback remains visible.
- Existing `dev.thanhvanSeason` and `dev.thanhvanTime` overrides control both combat and home.

High clouds, distant veil and low mist drift horizontally at different slow speeds. Pointer parallax uses the maximum shifts in the layer table. `prefers-reduced-motion: reduce` disables pointer transforms, cloud drift, mist drift and crossfade motion.

The character, cultivation aura, motes, command-wheel trigger and building interaction layer remain above the background stack. No building navigation state moves into the background component.

## Loading and performance

- Normally only the active ten-layer combination is mounted. During a variant transition, the old and incoming stacks may coexist briefly; the old stack is removed after crossfade completion.
- Full-canvas layers include a small bleed margin in rendering/CSS so maximum parallax movement never exposes an empty edge.
- PNG optimization may reduce disk size without resizing, palette-shifting or flattening alpha.
- Runtime should not load QA previews or rejected draft art.

## Testing and verification

Automated tests cover:

- A pure load-list builder returns three time paths and seven season paths in exact depth order for every one of the sixteen variants.
- `DongFuScene` renders ten aligned layers with the correct active variant.
- Returning from combat refreshes home from the shared cached `ThanhVanVariant`.
- A failed incoming stack leaves the previous complete stack active.
- Near layers move farther than far layers during pointer parallax.
- Reduced-motion keeps all parallax offsets at zero and disables drifting animation.
- All forty runtime files exist, are `1672 × 941` PNGs, and all overlays use an alpha-bearing PNG color type.
- The central cultivation dais and building baselines retain the same coordinates across seasonal QA composites through a fixed layout overlay check.

Visual QA includes the sixteen-combination contact sheet, individual full-resolution composites, alpha-edge inspection against dark and light checkerless backgrounds, and viewport crop checks at representative desktop/tablet/mobile aspect ratios.

Before completion, run the affected Vitest files, the full test suite, `npm.cmd run type-check`, and `npm.cmd run build` in the task worktree. After safe integration, rerun affected checks in the primary worktree.

## Superseded work

The earlier four-layer literal-cave draft and its code integration are superseded by this design. They must not be integrated. The approved outdoor sect master with the straight buildable cliff, layered ledges, scenic detail and central cultivation dais is the geometry/style anchor for the new modular assets.
