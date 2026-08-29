# Ink-Wash Nine-Slice UI Asset Design

**Date:** 2026-08-29
**Status:** Approved art direction; ready for implementation planning after user review
**Source context:** `docs/ui-components.md`, `src/assets/theme.css`, the user's supplied UI reference, and the approved concept render from this design session

## 1. Goal

Create a reusable raster UI skin for both Vue DOM components and Phaser scenes. The UI must feel like it belongs to one continuous ink-wash painting: warm white xuan paper is the visual canvas, carbon ink creates structure, negative space carries content, and restrained mineral pigments communicate gameplay state.

The asset system is ordered from small to large. Small controls stay legible and restrained; larger surfaces gain progressively richer brushwork, seal corners, mountains, mist, and ceremonial framing. The same canonical assets and slice metadata drive CSS `border-image` in Vue and `Phaser.GameObjects.NineSlice` in Phaser.

## 2. Decisions Already Approved

- Scope: one shared asset system for both Vue and Phaser.
- Format: reusable nine-slice assets for frames, buttons, cards, panels, and modal surfaces.
- Density: ornamentation increases with component size.
- Render strategy: neutral masters plus runtime tint; only distinctive ceremonial assets bake limited mineral pigment.
- Art direction: UI is part of a continuous ink-wash painting, not white cards floating above a dark game screen.
- Key visual anchor: warm white xuan paper, carbon-black and smoky-gray ink, an optional dark-ink data panel, pale landscape wash, and sparse cinnabar, jade, azure, or mineral-gold accents.
- Production constraint: letters, labels, numbers, gameplay icons, and live values remain code-rendered. Raster assets never bake mutable text.

## 3. Relationship to the Current Project

The current theme is documented as “Mực & Bạc” and uses dark ink surfaces with warm silver chrome. This design intentionally changes the UI art direction to “Mực & Giấy”: paper becomes the main visual field, while ink becomes both structure and contrast. Existing semantic meanings remain intact:

- jade: success, valid state, mana;
- crimson/cinnabar: error, danger, seals;
- azure/mineral blue: information, water, portal, tribulation;
- mineral gold: rank/data emphasis and exceptional actions only;
- scene accents: fire, portal, water, forest, mine, grotto, and tribulation remain semantic tints rather than chrome.

This design does not require save migration and does not alter gameplay behavior.

## 4. Visual Grammar

### 4.1 Paper

- Base color: warm white, not digital pure white.
- Texture: subtle xuan-paper fiber and gentle tonal variation; no stains that reduce text contrast.
- Center regions remain quiet enough for `--text-primary` equivalents adapted to dark ink text.
- A paper surface may be fully opaque for full-screen UI or partially transparent when composited over painted scenery.

### 4.2 Ink

- Primary structural ink: carbon black with visible dry-brush grain.
- Secondary wash: smoky gray with feathered absorbent edges.
- Stroke weight scales by tier; the same large frame must never be shrunk and reused as a small button.
- Straight edge segments remain compositionally calm so horizontal and vertical stretching does not reveal obvious distortion.

### 4.3 Pigment

- Pigment occupies less than roughly 10% of any neutral asset.
- Tintable masters contain neutral grayscale only.
- Cinnabar seals and rare ceremonial marks may be baked because their material behavior differs from runtime tint.
- Glow, glossy gradients, metallic chrome, neon edges, and photorealistic bevels are excluded.

### 4.4 Depth

- Depth comes from ink density, overlapping wash, and paper-edge contrast.
- Modern card shadows are excluded from the art itself.
- A very soft code-rendered drop shadow may be used only to protect legibility over a busy painted backdrop.

## 5. Asset Hierarchy: Small to Large

All dimensions below are logical `@1x` export dimensions. Every raster master is painted at `4x`, cleaned at `2x`, then exported at `@1x` and `@2x`. Slice values in the manifest are recorded separately for each export scale.

| Tier | Canonical asset | @1x canvas | Slice L/R/T/B | Intended use | Ornament density |
|---|---|---:|---:|---|---|
| XS | `frame-xs-ink-line` | 64×64 | 12/12/12/12 | Chip, tab, badge shell, compact selection ring | Single dry-brush line; no landscape motif |
| S | `button-s-paper` | 192×64 | 24/24/16/16 | Light primary/secondary text button | Paper fill, ink perimeter, one short corner flick |
| S | `button-s-ink` | 192×64 | 24/24/16/16 | Dark navigation/action button | Dense ink fill, paper-text safe zone |
| S | `button-s-seal` | 192×64 | 24/24/16/16 | Danger or exceptional action | Neutral base plus optional cinnabar export |
| S | `frame-s-slot` | 96×96 | 20/20/20/20 | SlotView, combat skill slot, icon button | Square brush frame, restrained corner stamp |
| M | `surface-m-paper` | 192×192 | 32/32/32/32 | Card and tooltip body | Quiet paper center, faint wash at one edge |
| M | `frame-m-seal-corner` | 192×192 | 32/32/32/32 | Tooltip, popover, technique card | Two-line frame, one asymmetric seal corner |
| L | `surface-l-ink-data` | 320×320 | 48/48/48/48 | Character stats, combat data block | Dark ink wash center with feathered paper transition |
| L | `frame-l-landscape` | 320×320 | 48/48/48/48 | GamePanel, side panel, HUD block | Stronger corners; sparse rock/cloud wash confined to fixed regions |
| XL | `surface-xl-paper-scroll` | 512×512 | 80/80/80/80 | Modal, onboarding, result screen | Broad clean paper center, scroll-like ink perimeter |
| XL | `frame-xl-ceremony` | 512×512 | 80/80/80/80 | Ritual, victory, defeat, breakthrough | Multi-layer brush frame, clouds/seal accents in fixed corners |

### 5.1 Separate painting bridges

Large mountains, bamboo, mist banks, and character-adjacent washes cannot live in stretchable edge centers without visible distortion. They are therefore separate transparent overlays, still part of the same UI kit:

- `wash-corner-mountain-left`;
- `wash-corner-mountain-right`;
- `wash-bottom-mist`;
- `wash-bamboo-right`;
- `seal-cinnabar-small`;
- `seal-cinnabar-large`.

These overlays visually connect panels to the full painting while nine-slice assets remain mechanically safe.

## 6. Component Mapping

### XS and S

- `Chip`, `TabBar`, `NotificationBadge`: `frame-xs-ink-line` with semantic tint or opacity.
- `GameButton`: `button-s-paper`, `button-s-ink`, or `button-s-seal`; text and spinner remain DOM.
- `SlotView`, `CombatSkillSlot`, `ArtifactCombatSlot`: `frame-s-slot`; quality/rank color stays code-driven.
- Circular controls remain circular code-native hit areas with an ink-ring image overlay; nine-slice is not forced onto a shape that does not stretch.

### M

- `Tooltip`, `BuildingDetailPopover`, `TechniqueSlotCard`, inventory cards: `surface-m-paper` plus `frame-m-seal-corner`.
- Rich tooltip rank accents tint only the left stroke or corner seal, never the entire paper body.

### L

- `GamePanel`, `OverlayPanel`, `LeftPanel`, `RightPanel`, `FunctionOverlayPanel`: paper or dark-data surface plus `frame-l-landscape`.
- Combat top/status/event/control blocks use the same family at lower opacity so the battlefield remains readable.
- Dark `surface-l-ink-data` is reserved for dense stats or tactical data, matching the approved concept render.

### XL

- `ConfirmModal`, `OfflineSummaryModal`, onboarding screens, combat victory/defeat, breakthrough ritual: `surface-xl-paper-scroll` plus `frame-xl-ceremony`.
- Landscape bridge overlays connect the modal perimeter to the screen edges; they never enter text safe zones.

## 7. State Model

The neutral master avoids an explosion of baked variants.

| State | Asset treatment | Code treatment |
|---|---|---|
| Idle | Base grayscale asset | No tint or semantic tint at low strength |
| Hover/focus | Same asset | Increase ink contrast; add a thin focus stroke; no glow |
| Pressed | Same asset | Translate content 1 px and deepen edge wash |
| Selected | Same asset | Add jade/azure/mineral-gold pigment to one fixed stroke or seal |
| Disabled | Same asset | Reduce contrast and opacity; retain readable silhouette |
| Danger | `button-s-seal` | Cinnabar tint or baked cinnabar-seal variant |

Only a state whose silhouette or brush pressure materially changes receives another raster export. Color-only differences remain runtime effects.

## 8. Nine-Slice Rules

### 8.1 Stretch-safe geometry

- Corners contain all curls, seals, rocks, bamboo joints, and stroke terminations.
- Horizontal edge centers contain a mostly straight stroke and may stretch only on X.
- Vertical edge centers contain a mostly straight stroke and may stretch only on Y.
- The center is either transparent, quiet paper, or uniform ink wash depending on the asset.
- Decorative details must stay at least 4 logical pixels inside a slice boundary at `@1x` to avoid sampling bleed.
- Runtime minimum width is `left + right`; minimum height is `top + bottom`.

### 8.2 Edge mode

- Default: stretch, because freehand texture must not create obvious periodic seams.
- Optional: tile/round only for deliberately repeating paper fiber or a designed bead/dash pattern.
- Phaser 4 supports `tileX` and `tileY`; these remain disabled for the initial production set.

### 8.3 Center mode

- `frame-*`: transparent center; content background is separate.
- `surface-*`: center filled.
- `button-*`: center filled so the control needs one render layer.

## 9. Shared Manifest

The production pipeline creates one metadata file, conceptually shaped as:

```ts
type InkUiSliceAsset = {
  id: string
  url1x: string
  url2x: string
  sourceWidth: number
  sourceHeight: number
  slices: {
    left: number
    right: number
    top: number
    bottom: number
  }
  center: 'transparent' | 'fill'
  edgeMode: 'stretch' | 'tile'
  tintable: boolean
  minimumWidth: number
  minimumHeight: number
}
```

Vue maps the values to `border-image-source`, `border-image-slice`, `border-image-width`, and `border-image-repeat`. Phaser creates `this.add.nineslice(...)` with the same left, right, top, and bottom values. Phaser's documented NineSlice keeps corners fixed and stretches the edge/center regions; CSS `border-image-slice` divides the source into the same nine regions.

References:

- [Phaser Nine Slice documentation](https://docs.phaser.io/phaser/concepts/gameobjects/nine-slice)
- [MDN `border-image-slice`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/border-image-slice)
- [MDN `border-image-repeat`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/border-image-repeat)

## 10. Render Workflow

Production proceeds strictly from small to large so early assets establish brush weight and sampling rules before expensive ceremonial work.

1. Produce a style anchor sheet containing paper, dry-brush lines, ink washes, mineral pigments, and seal texture.
2. Render XS line frame and validate at actual 24–40 px display sizes.
3. Render the three S button families and S slot frame; validate long Vietnamese labels, icon-only controls, and 40/44/52 px heights.
4. Render M paper surface and seal-corner frame; validate tooltip sizes from 160 to 380 px.
5. Render L dark-data surface and landscape frame; validate side panels, GamePanel, and combat HUD blocks.
6. Render XL paper-scroll surface and ceremonial frame only after L geometry passes.
7. Render the six non-stretch painting bridges and compose a full-screen reference mockup.
8. Export individual PNGs and a Phaser atlas from the same approved masters.
9. Generate contact sheets at `@1x`, `@2x`, minimum size, typical size, and extreme aspect ratios.
10. Integrate progressively: primitives first, then common composites, panels, combat HUD, and onboarding/results.

## 11. File and Naming Layout

```text
game/public/assets/ui/ink-wash/
  slices/
    frame-xs-ink-line@1x.png
    frame-xs-ink-line@2x.png
    button-s-paper@1x.png
    button-s-paper@2x.png
    button-s-ink@1x.png
    button-s-ink@2x.png
    button-s-seal@1x.png
    button-s-seal@2x.png
    frame-s-slot@1x.png
    frame-s-slot@2x.png
    surface-m-paper@1x.png
    surface-m-paper@2x.png
    frame-m-seal-corner@1x.png
    frame-m-seal-corner@2x.png
    surface-l-ink-data@1x.png
    surface-l-ink-data@2x.png
    frame-l-landscape@1x.png
    frame-l-landscape@2x.png
    surface-xl-paper-scroll@1x.png
    surface-xl-paper-scroll@2x.png
    frame-xl-ceremony@1x.png
    frame-xl-ceremony@2x.png
  overlays/
    wash-corner-mountain-left.png
    wash-corner-mountain-right.png
    wash-bottom-mist.png
    wash-bamboo-right.png
    seal-cinnabar-small.png
    seal-cinnabar-large.png
  atlas/
    ink-wash-ui.png
    ink-wash-ui.json
  ink-wash-ui-slices.json
```

Source masters and rejected generations do not live in the runtime asset directory. Approved editable masters live under `game/art-source/ui/ink-wash/`, while runtime exports remain under `game/public/assets/ui/ink-wash/`.

## 12. Validation Matrix

### Visual

- No slice seam at minimum, typical, ultrawide, and tall-narrow sizes.
- Corners retain shape and brush texture.
- Paper center preserves text contrast.
- Dark ink panels do not swallow thin icons or secondary text.
- The full screen reads as one painting rather than a stack of cards.
- Ornament density clearly increases from XS to XL.

### Functional

- Vue assets scale at UI settings 90%, 100%, 110%, and 125%.
- Phaser NineSlice uses the same logical slice values from the manifest.
- Pointer/hit areas remain code-defined and are never inferred from transparent raster pixels.
- Hover, focus, selected, disabled, and danger states remain distinguishable without relying on color alone.
- `prefers-reduced-motion` is unaffected; the base asset set is static.

### Performance

- Individual DOM images are cacheable and do not exceed their approved runtime dimensions.
- Phaser uses a shared atlas to reduce texture switching.
- Large wash overlays are loaded only by screens that use them.
- Alpha padding and atlas extrusion prevent texture bleeding.

## 13. Acceptance Criteria

- All eleven canonical nine-slice assets exist at `@1x` and `@2x`.
- All six painting-bridge overlays exist with transparent backgrounds.
- Every asset has explicit, verified slice metadata.
- The same metadata drives a Vue test fixture and a Phaser test fixture.
- A contact sheet demonstrates XS through XL at minimum and extreme sizes without visible distortion.
- A full-screen mockup preserves the approved concept: white xuan paper canvas, integrated ink UI, dark data panel, restrained pigment, and progressive ornament density.
- No runtime UI asset contains mutable text, numbers, or gameplay-specific labels.
- Relevant tests, `npm.cmd run type-check`, and `npm.cmd run build` pass after integration.

## 14. Explicit Non-Goals

- Repainting characters, buildings, enemies, equipment, or combat VFX in this asset task.
- Baking complete screenshots into the game.
- Replacing semantic gameplay colors with monochrome-only feedback.
- Adding a UI framework or a new runtime dependency.
- Maintaining compatibility with old visual save data; UI assets do not participate in save state.

## 15. Risks and Mitigations

- **AI-generated edges may not tile cleanly:** clean and reconstruct stretch regions manually after generation; never ship raw generations directly.
- **Paper UI may lose contrast over existing backgrounds:** use opaque paper surfaces or dark ink data surfaces where needed, plus optional bridge overlays.
- **One master may look different between CSS and WebGL sampling:** compare both consumers using the same fixture dimensions before approving a tier.
- **Large landscape decoration may stretch:** keep landscape detail out of scalable edge centers and use separate overlays.
- **Tint may muddy warm paper:** tint only grayscale ink pixels or isolated masks; do not multiply the whole paper surface.
- **Asset count may expand through states:** bake only silhouette/brush-pressure changes; handle color, opacity, and small transforms in code.
