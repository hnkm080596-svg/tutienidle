# Dong Fu Building Art V2 Design

**Date:** 2026-08-30

**Status:** Approved for implementation planning

**Worktree:** `E:/tutienidle/.agent-worktrees/dong-fu-building-art-v2`

**Branch:** `agent/dong-fu-building-art-v2`

## 1. Goal

Replace the current detached 2.5D-looking Dong Fu building art with five unique 2D ink-painting buildings that belong inside the seasonal parallax landscape. Each building must remain immediately recognizable at gameplay scale, sit on a straight horizontal baseline, and support static interaction states without baking buildings into the background.

The five buildings in scope are:

1. `spirit_spring` — Linh Tuyền.
2. `equipment_hall` — Khí Đường.
3. `pill_room` — Đan Phòng.
4. `teleport_array` — Truyền Tống Trận.
5. `gathering_outpost` — display name changes from “Điều Phối Nhân Công” to **Khai Vật Đường**.

The technical ID `gathering_outpost` remains unchanged. This is a presentation rename only; it must not introduce save migration or BuildingSystem changes.

## 2. Scope

### Included

- One approved base illustration for each of the five runtime buildings.
- A shared front-facing, slightly offset camera language compatible with the flat Dong Fu building baseline.
- Genuine transparent PNG output.
- A silhouette mask, contact shadow, and locked overlay derived from each approved base.
- Static seasonal treatment for spring, summer, autumn, and winter.
- Time-of-day compatibility through runtime lighting and color treatment rather than sixteen separately rendered building variants.
- Runtime placement metadata, sprite rendering, hitboxes, hover/focus, selected, locked, ready, active, upgradeable, disabled, and error presentation.
- Gameplay-scale contact sheets and whole-scene composition previews.
- Tests for asset contracts, metadata, state mapping, navigation, and accessibility.

### Deferred

All animated or particle VFX are deliberately deferred to a later task. This includes water animation, forge sparks, alchemy smoke, rotating portal glyphs, command tokens, moving transport lines, animated seasonal debris, and other ambient motion.

The current task records future VFX anchor points in metadata but does not produce or integrate VFX textures or animation code.

### Excluded

- Tàng Kinh Các; it is a static world object rather than a BuildingSystem building.
- Legacy buildings removed by the resource-professions rework: `herb_garden`, `smelter`, `artisan_workshop`, `formation_altar`, and `talisman_institute`.
- Reworking the Dong Fu background itself.
- Changing building economics, levels, construction rules, navigation, save shape, or function panels.
- Rendering characters, labels, UI text, badges, or nameplates into building textures.
- Merging or committing the task branch without a later explicit user decision.

## 3. Visual Direction

### 3.1 Shared language

- Traditional Chinese ink painting on white xuan paper, translated into transparent game sprites.
- Brush-and-ink structure is dominant. Color is a restrained functional accent, never glossy high-fantasy rendering.
- The camera is primarily frontal with a slight horizontal offset. A small amount of side wall and roof depth may be visible, but the building must not read as an elevated isometric or 2.5D object.
- Every building rests on one horizontal contact baseline. No elliptical terrain pedestal, floating diorama base, or top-down floor plane is allowed.
- Roofs, walls, rocks, water, and props use varied ink density, dry-brush edges, paper bleed, and a small amount of controlled mineral pigment.
- Silhouettes must remain clear at the actual runtime size. Fine decoration is secondary to roofline, entrance, function prop, and overall mass.
- No text, signboard lettering, seal signatures, watermark, characters, purple chroma, magenta, checkerboard pattern, or opaque paper rectangle.

### 3.2 Building identities

#### Linh Tuyền

- Low, wide, open silhouette.
- A natural semicircular stone pool, a small descending waterfall, pale-jade crystal formations, and a thin shelter roof behind the spring.
- Water and open negative space dominate; the object must not become a literal cave entrance.
- Accent palette: pale jade, cool gray ink, and restrained turquoise water.

#### Khí Đường

- Heavy, broad, slightly asymmetric silhouette.
- A low forge hall, dense roof mass, chimney, visible deep-red furnace entrance, and two stone supports carrying abstract hammer-and-sword motifs without text.
- The building should feel weight-bearing and heat-darkened, not like a generic temple.
- Accent palette: charcoal ink, iron gray, restrained cinnabar, and warm furnace amber.

#### Đan Phòng

- Balanced octagonal silhouette, lighter and rounder than Khí Đường.
- Curved roof, visible alchemy furnace through the main entrance, circular lattice windows, herb racks, and a small chimney.
- The building should communicate controlled refinement rather than industrial forging.
- Accent palette: warm paper, soot gray, muted vermilion, and herbal olive.

#### Truyền Tống Trận

- Tall, open silhouette with a genuinely transparent center.
- An ancient stone gate, paired rune pillars, and a shallow horizontal formation platform.
- It must remain architectural and ink-painted, not become an oversized glowing fantasy portal.
- The empty center and future portal plane must be independently compositable.
- Accent palette: weathered stone, pale mineral blue, and faint antique gold.

#### Khai Vật Đường

- Wide administrative-and-storage silhouette with a clear horizontal rhythm.
- An open-front sect office, long roof, two offset storage wings, map rack, command slips, bundles of spirit wood, and baskets of ore.
- Props must communicate assignment and resource logistics without showing workers or turning the building into a crafting workshop.
- Accent palette: timber brown, graphite ink, faded ochre, and small jade details.

## 4. Asset Contract

### 4.1 Canvas and alignment

- Every per-building texture uses a `1254 × 1254` canvas.
- All files for one building share exactly the same canvas, bounds, and baseline.
- Runtime scale may differ per placement, but source geometry may not shift between states or seasons.
- Pixels outside the painted subject must have genuine alpha zero.
- Pale brush edges must preserve partial alpha without retaining white paper halos.

### 4.2 Files per building

Each directory under `public/assets/buildings/dong-fu/v2/<building-id>/` contains:

- `base.png` — approved RGBA building illustration.
- `silhouette-mask.png` — single-channel-equivalent RGBA or grayscale mask derived from the final base alpha.
- `ground-shadow.png` — soft ink contact shadow on a transparent canvas.
- `locked-overlay.png` — cold ink wash and a period-appropriate sealing talisman/印 mark, aligned to the base.
- `metadata.json` — placement and interaction geometry.

Source masters, prompts, rejected concepts, and production notes live under `art-source/buildings/dong-fu/v2/`. Runtime never loads art-source files.

Shared seasonal atmosphere lives under `public/assets/buildings/dong-fu/v2/shared/seasons/`:

- `spring.png`
- `summer.png`
- `autumn.png`
- `winter.png`

These four files are transparent `1672 × 941` scene-space overlays. They are rendered once above the complete building group, not once per building. Hover/selection outlines and the static ground selection ring are generated by CSS from masks and do not add more bitmap files.

### 4.3 Metadata

Metadata is typed in TypeScript at runtime even if authored as JSON. Required fields are:

```ts
interface DongFuBuildingArtMetadata {
  buildingId: 'spirit_spring' | 'equipment_hall' | 'pill_room' | 'teleport_array' | 'gathering_outpost'
  canvas: { width: 1254; height: 1254 }
  visualBounds: { x: number; y: number; width: number; height: number }
  baselineY: number
  hitbox: { x: number; y: number; width: number; height: number }
  scenePlacement: { xPercent: number; yPercent: number; scale: number; zIndex: number }
  futureVfxAnchors: Readonly<Record<string, { x: number; y: number }>>
}
```

Coordinates inside a texture are source pixels. Scene placement uses the same `1672 × 941` cover-fit art-space as the Dong Fu background.

### 4.4 Seasonal treatment

The base painting remains canonical. Seasonal variation combines deterministic runtime color treatment on each base with one of four shared, aligned scene-space overlays:

- Spring: pale shoots, restrained blossom marks, damp mist tint.
- Summer: fuller dark-green foliage and humid ink density.
- Autumn: sparse ochre/cinnabar leaves and drier warm stone.
- Winter: sparse foreground snow drift and flakes in the shared overlay, with a cold gray building tint. Roof-specific accumulated snow is deferred because a shared overlay cannot track five different silhouettes reliably.

Season overlays must not change silhouette, visual bounds, hitbox, baseline, doors, or functional props. The shared overlay is decorative and never participates in hit testing.

Time-of-day uses runtime filters and existing scene lighting tokens:

- Morning: warm ivory lift.
- Noon: neutral paper and sharper ink.
- Evening: antique gold/cinnabar warmth.
- Night: charcoal-indigo reduction with readable door and edge values.

No separate 4 × 4 building render matrix is produced.

## 5. Static Interaction States

The building base is never rerendered for an interaction state. Runtime combines the base, silhouette mask, locked overlay, CSS filters, and existing UI badges.

| State | Static presentation |
|---|---|
| `normal` | Canonical base and ground shadow. |
| `hover` / `focus` | Translate upward 3–4 px; ink-gold outline derived from the silhouette mask; small contrast lift. |
| `selected` | Stable jade-gold outline and separate static ground selection ring. |
| `locked` / `unbuilt` | Lower saturation and brightness, cold ink overlay, period sealing mark; no modern padlock baked into art. |
| `ready` | Existing jade UI badge/nameplate treatment; base remains unchanged. |
| `active` | Existing active badge/nameplate treatment; no animated building VFX in this task. |
| `upgradeable` | Existing gold badge/nameplate treatment; no pulse texture is added in this task. |
| `disabled` / `error` | Faded ink and no elevation; the hotspot stays actionable where existing navigation requires an explanation. |

Keyboard focus must remain at least as visible as pointer hover. Under `prefers-reduced-motion`, the elevation transition becomes instantaneous or is removed; all semantic state cues remain visible.

## 6. Scene Composition

The central cultivation platform and character lane remain clear. Buildings are staggered by position, scale, ink density, and z-index without creating rigid horizontal tiers:

- Đan Phòng: distant-left; smaller and lighter.
- Khai Vật Đường: distant-right; wide and visually balanced against Đan Phòng.
- Khí Đường: nearer-left; heavier ink and stronger mass.
- Linh Tuyền: nearer-right; low silhouette preserving the landscape view.
- Truyền Tống Trận: offset behind the central platform; its transparent opening frames depth without covering the cultivator.

Final percentages and scales are approved through a whole-scene composition preview rather than guessed in code. Placement metadata becomes the single source of truth for both sprites and hit targets.

The implementation replaces invisible hard-coded hotspot geometry in `HomeBuildingIcons.vue` with building sprite anchors. Existing navigation, tooltips, state derivation, nameplates, and `BuildingDetailPopover` behavior remain intact.

## 7. Production Workflow

### 7.1 Concept gate

1. Use the accepted seasonal Dong Fu background and current building sheet as style and subject references, not edit targets.
2. Generate one concept contact sheet containing all five buildings with matching camera, ink language, and baseline.
3. Review uniqueness, gameplay-scale readability, absence of 2.5D pedestals, and visual compatibility with the background.
4. Revise individual buildings without changing already approved buildings.
5. Obtain user approval before treating any concept as a production master.

### 7.2 Production masters

1. Generate or isolate each approved building independently on a uniform white extraction plate or genuine transparent canvas.
2. Normalize to `1254 × 1254` without recentering the approved subject unexpectedly.
3. Convert white plates using a white-unmatte process when necessary; reject checkerboard or colored chroma outputs.
4. Derive silhouette masks and ground shadows mechanically from the approved base.
5. Create locked overlays without repainting or moving the building.
6. Add seasonal static overlays only after base geometry is locked.

Image generation uses the built-in ImageGen path by default. Final project assets must be copied into the task worktree; generated-image cache paths are not valid runtime locations.

### 7.3 Preview gates

Produce the following QA artifacts:

- Five-building concept contact sheet.
- Gameplay-scale sheet on transparent and neutral paper backgrounds.
- State sheet comparing `normal`, `hover`, `selected`, and `locked` for all five buildings.
- Whole-scene placement preview over the approved Dong Fu landscape.
- Four-season comparison sheet at one representative time of day.
- Night readability preview for all five buildings.

Preview files are QA-only and must not be loaded by runtime code.

## 8. Runtime Architecture

Create a small building-art manifest independent of BuildingSystem rules. It maps stable building IDs to asset URLs and typed metadata. `HomeBuildingIcons.vue` consumes the manifest while continuing to obtain built/locked/upgradeable state from `useBuildingNavigation`.

The render stack for one building is:

1. Ground shadow.
2. Base building.
3. Locked overlay when locked/unbuilt.
4. CSS mask outline for hover/focus/selection.
5. Existing semantic nameplate and badge.

After all five building anchors, the scene renders one shared seasonal atmosphere overlay. It remains pointer-transparent and outside every building hitbox.

Image load failure must not remove navigation. If an art texture fails, the anchor retains an accessible button, nameplate, tooltip, and existing state label. A visual fallback may use the current transparent hotspot outline rather than a broken-image icon.

No building art is baked into any of the ten background parallax layers. Building placement remains a separate DOM layer above the background and below the player/UI layers.

## 9. Validation and Tests

### Asset contract tests

- Exactly five V2 building directories exist.
- Required files exist for every building.
- PNG dimensions are `1254 × 1254`.
- Base, shadow, and locked overlays contain genuine alpha.
- Teleport gate center remains transparent.
- Masks align with base alpha within the documented tolerance.
- Metadata IDs, canvas size, bounds, baseline, hitbox, placement, and anchor coordinates are valid.

### Component tests

- Five sprite anchors render in metadata z-order.
- Sprite URL and state classes match each building ID.
- Hover/focus, selected, locked, disabled, and reduced-motion classes map correctly.
- Locked/unbuilt buildings remain clickable to show requirements.
- Existing navigation destinations, tooltips, nameplates, and popover behavior remain unchanged.
- A failed image preserves the accessible hotspot fallback.

### Visual QA

- No purple/magenta contamination, checkerboard, opaque white rectangle, watermark, or unwanted text.
- Buildings share one camera and baseline while retaining unique silhouettes.
- Buildings remain readable at smallest expected gameplay scale.
- Central cultivation platform and character are not obscured.
- Four seasonal treatments preserve exact geometry.
- Night treatment remains readable without neon lighting.
- Layout remains aligned under cover-fit viewport changes.

Run relevant focused tests, the full Vitest suite, `npm.cmd run type-check`, and `npm.cmd run build` before any completion or integration decision. Failures already present on the task base must be reported separately from task-caused failures.

## 10. Acceptance Criteria

- The user approves the five-building concept sheet before final extraction.
- Each building is recognizable by silhouette and functional props without text.
- Art looks embedded in the ink landscape rather than placed as an isometric game icon.
- All base assets and technical layers follow the transparent `1254 × 1254` contract.
- Hover, focus, selected, and locked states work through stable derived layers without rerendering the base.
- Four shared seasonal atmosphere overlays and deterministic building tints support all four seasons without geometry drift.
- Time-of-day treatment supports all four times without producing sixteen copies per building.
- VFX is clearly deferred and no placeholder animation silently becomes final art.
- The central cultivation area remains open and all five buildings can be placed with convincing depth.
- Existing building navigation and gameplay behavior remain intact.
- Work remains isolated in the task worktree until the user explicitly chooses integration.

## 11. Known Baseline Limitation

Before this spec was written, the isolated branch baseline produced 1 unrelated failing test: `src/components/common/InkWashPrimitives.test.ts` expected the circular button to render `frame-xs-ink-line`. The user explicitly approved continuing the building spec while temporarily ignoring this pre-existing UI failure. The building task must not modify that test or primitive unless separately authorized.
