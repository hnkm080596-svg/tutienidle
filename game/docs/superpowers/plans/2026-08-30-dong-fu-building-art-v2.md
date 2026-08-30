# Dong Fu Building Art V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce and integrate five unique transparent ink-painting Dong Fu buildings with static hover, selection, lock, season, and time-of-day presentation while preserving existing building gameplay and navigation.

**Architecture:** A typed `DongFuBuildingArt` manifest owns stable asset URLs, scene placement, hitboxes, and future VFX anchors. `DongFuBuildingSprite.vue` renders each technical image stack, while `HomeBuildingIcons.vue` continues to own the accessible button, navigation, tooltip, and semantic nameplate. Five canonical base sprites generate masks, contact shadows, and locked overlays; four shared scene-space seasonal overlays and CSS time grading avoid multiplying art into eighty variants.

**Tech Stack:** Vue 3, TypeScript, Vite, Vitest, Pinia, DOM/CSS rendering, built-in ImageGen, ImageMagick for deterministic alpha/mask processing.

**Spec:** `game/docs/superpowers/specs/2026-08-30-dong-fu-building-art-v2-design.md`

## Global Constraints

- Work only in `E:/tutienidle/.agent-worktrees/dong-fu-building-art-v2` on branch `agent/dong-fu-building-art-v2`.
- Do not merge, commit, push, deploy, or modify the primary worktree.
- The five in-scope IDs are exactly `spirit_spring`, `equipment_hall`, `pill_room`, `teleport_array`, and `gathering_outpost`.
- Rename only the displayed building name for `gathering_outpost` to `Khai Vật Đường`; preserve its ID, save shape, function type, costs, and behavior.
- Do not add Tàng Kinh Các or the five legacy buildings removed from gameplay.
- All per-building runtime PNGs are exactly `1254 × 1254`; all shared seasonal overlays are exactly `1672 × 941`.
- Base, shadow, locked overlay, and shared season textures require genuine alpha. Never accept checkerboard, purple/magenta chroma, opaque paper rectangles, text, characters, signatures, or watermarks.
- Camera is front-facing with a slight horizontal offset. Every building uses a horizontal contact baseline and must not have an isometric pedestal or top-down floor plane.
- VFX animation and particles are deferred. Do not add water, spark, smoke, portal, command-token, leaf, snow, or transport animation code in this plan.
- Preserve existing `useBuildingNavigation`, `BuildingDetailPopover`, tooltip, nameplate, construction, upgrade, and function-panel behavior.
- Do not add dependencies or use `any`.
- The base branch has one acknowledged unrelated test failure in `InkWashPrimitives.test.ts`; never edit that file as part of this plan.
- Standard skill commit steps are replaced by explicit diff-review checkpoints because repository rules forbid agent commits.

---

### Task 1: Materialize the Approved Background Dependency in the Isolated Worktree

The branch predates the approved modular Dong Fu background. Building integration must not be developed over `thanh-van-dong-fu-master-buildings-v1.png`, because that legacy image already bakes buildings into the background.

**Files:**
- Copy when absent: `game/art-source/backgrounds/dong-fu/**`
- Copy when absent: `game/public/assets/backgrounds/dong-fu/modular/**`
- Copy when absent: `game/src/game/support/DongFuArt.ts`
- Copy when absent: `game/src/game/support/DongFuArt.test.ts`
- Copy when absent: `game/src/game/support/DongFuStackLoader.ts`
- Copy when absent: `game/src/game/support/DongFuStackLoader.test.ts`
- Copy when absent: `game/src/assets/dongFuBackgroundAssets.test.ts`
- Modify from approved task output: `game/src/components/game/DongFuScene.vue`
- Modify from approved task output: `game/src/components/game/DongFuScene.test.ts`
- Reference source: `E:/tutienidle/.agent-worktrees/dong-fu-2d-parallax/game/`

**Interfaces:**
- Consumes: approved ten-layer Dong Fu background output from the prior isolated task.
- Produces: a building task worktree whose background has no baked buildings and whose variant is driven by `peekThanhVanVariant()`.

- [ ] **Step 1: Verify both worktrees and exact dependency paths**

Run:

```powershell
git worktree list --porcelain
git status --short
Get-ChildItem -LiteralPath 'E:/tutienidle/.agent-worktrees/dong-fu-2d-parallax/game/public/assets/backgrounds/dong-fu/modular' -Recurse -File
```

Expected: the current worktree is `dong-fu-building-art-v2`; the source contains 40 runtime PNGs plus previews; no current worker changes the building V2 paths.

- [ ] **Step 2: Copy only the approved dependency paths**

Use explicit `Copy-Item -LiteralPath` operations for the paths listed above. Do not copy `.tmp-*`, `public/assets/backgrounds/dong-fu/parallax/`, or any rejected art directory. Do not copy unrelated source files from either worktree.

- [ ] **Step 3: Verify the background contract**

Run:

```powershell
npm.cmd test -- --run src/game/support/DongFuArt.test.ts src/game/support/DongFuStackLoader.test.ts src/assets/dongFuBackgroundAssets.test.ts src/components/game/DongFuScene.test.ts
```

Expected: 4 test files and 11 tests pass.

- [ ] **Step 4: Review the dependency diff**

Run:

```powershell
git diff --check
git status --short
```

Expected: only the approved Dong Fu background dependency and the existing spec/plan are present. Do not commit.

---

### Task 2: Define the Building Art Manifest and Rename Khai Vật Đường

**Files:**
- Create: `game/src/game/support/DongFuBuildingArt.ts`
- Create: `game/src/game/support/DongFuBuildingArt.test.ts`
- Modify: `game/src/data/building/buildings.ts`
- Modify: `game/src/data/building/buildings.rework.test.ts`

**Interfaces:**
- Consumes: `ThanhVanSeason` and `ThanhVanTime` from `game/src/game/support/ThanhVanArt.ts`.
- Produces: `DongFuBuildingId`, `DongFuBuildingArtEntry`, `DONG_FU_BUILDING_ART`, `dongFuBuildingAssetUrls(entry)`, `dongFuSeasonOverlayUrl(season)`, and `dongFuBuildingTimeClass(time)`.

- [ ] **Step 1: Write failing manifest and display-name tests**

Add tests equivalent to:

```ts
import { describe, expect, it } from 'vitest'
import {
  DONG_FU_BUILDING_ART,
  dongFuBuildingAssetUrls,
  dongFuBuildingTimeClass,
  dongFuSeasonOverlayUrl,
} from './DongFuBuildingArt'
import { buildings } from '@/data/building/buildings'

describe('DongFuBuildingArt', () => {
  it('defines exactly five stable building IDs and unique placements', () => {
    expect(DONG_FU_BUILDING_ART.map((entry) => entry.buildingId)).toEqual([
      'pill_room',
      'gathering_outpost',
      'teleport_array',
      'equipment_hall',
      'spirit_spring',
    ])
    expect(new Set(DONG_FU_BUILDING_ART.map((entry) => entry.scenePlacement.zIndex)).size).toBe(5)
  })

  it('maps every building to aligned V2 technical assets', () => {
    for (const entry of DONG_FU_BUILDING_ART) {
      expect(dongFuBuildingAssetUrls(entry)).toEqual({
        base: `/assets/buildings/dong-fu/v2/${entry.buildingId}/base.png`,
        silhouetteMask: `/assets/buildings/dong-fu/v2/${entry.buildingId}/silhouette-mask.png`,
        groundShadow: `/assets/buildings/dong-fu/v2/${entry.buildingId}/ground-shadow.png`,
        lockedOverlay: `/assets/buildings/dong-fu/v2/${entry.buildingId}/locked-overlay.png`,
      })
    }
  })

  it('maps shared season and time presentation without building variants', () => {
    expect(dongFuSeasonOverlayUrl('winter')).toBe(
      '/assets/buildings/dong-fu/v2/shared/seasons/winter.png',
    )
    expect(dongFuBuildingTimeClass('night')).toBe('is-time-night')
  })

  it('uses the approved Khai Vật Đường display name without changing its ID', () => {
    expect(buildings.find((entry) => entry.id === 'gathering_outpost')?.name).toBe('Khai Vật Đường')
  })
})
```

- [ ] **Step 2: Run the tests to verify RED**

Run:

```powershell
npm.cmd test -- --run src/game/support/DongFuBuildingArt.test.ts src/data/building/buildings.rework.test.ts
```

Expected: FAIL because `DongFuBuildingArt.ts` does not exist and the old display name remains.

- [ ] **Step 3: Implement the typed manifest**

Use the following public shape:

```ts
import type { ThanhVanSeason, ThanhVanTime } from './ThanhVanArt'

export const DONG_FU_BUILDING_IDS = [
  'spirit_spring',
  'equipment_hall',
  'pill_room',
  'teleport_array',
  'gathering_outpost',
] as const

export type DongFuBuildingId = (typeof DONG_FU_BUILDING_IDS)[number]

export interface DongFuBuildingArtEntry {
  buildingId: DongFuBuildingId
  canvas: { readonly width: 1254; readonly height: 1254 }
  visualBounds: Readonly<{ x: number; y: number; width: number; height: number }>
  baselineY: number
  hitbox: Readonly<{ x: number; y: number; width: number; height: number }>
  scenePlacement: Readonly<{ xPercent: number; yPercent: number; scale: number; zIndex: number }>
  futureVfxAnchors: Readonly<Record<string, Readonly<{ x: number; y: number }>>>
}

export interface DongFuBuildingAssetUrls {
  base: string
  silhouetteMask: string
  groundShadow: string
  lockedOverlay: string
}
```

Seed the placement review with these values, where `scale` is the fraction of the `1672`-pixel art-space width occupied by the `1254`-pixel source canvas. Use this explicit helper so the manifest is complete and type-safe before final measurements replace the conservative geometry:

```ts
function initialArtEntry(
  buildingId: DongFuBuildingId,
  scenePlacement: DongFuBuildingArtEntry['scenePlacement'],
): DongFuBuildingArtEntry {
  return {
    buildingId,
    canvas: { width: 1254, height: 1254 },
    visualBounds: { x: 0, y: 0, width: 1254, height: 1254 },
    baselineY: 1254,
    hitbox: { x: 0, y: 0, width: 1254, height: 1254 },
    scenePlacement,
    futureVfxAnchors: {},
  }
}

export const DONG_FU_BUILDING_ART: readonly DongFuBuildingArtEntry[] = [
  initialArtEntry('pill_room', { xPercent: 16, yPercent: 63, scale: 0.21, zIndex: 11 }),
  initialArtEntry('gathering_outpost', { xPercent: 83, yPercent: 62, scale: 0.22, zIndex: 12 }),
  initialArtEntry('teleport_array', { xPercent: 58, yPercent: 58, scale: 0.19, zIndex: 10 }),
  initialArtEntry('equipment_hall', { xPercent: 28, yPercent: 74, scale: 0.27, zIndex: 21 }),
  initialArtEntry('spirit_spring', { xPercent: 74, yPercent: 75, scale: 0.28, zIndex: 22 }),
]
```

Fill `visualBounds`, `baselineY`, `hitbox`, and `futureVfxAnchors` only after measuring the final approved PNGs in Task 4. Until then, use conservative full-canvas bounds in this task so the interface compiles; Task 4 replaces every provisional numeric bound before asset approval. Do not use sentinel values, optional fields, or `any`.

Implement URL functions as pure string builders. Change only the `name` of `gathering_outpost` in `buildings.ts`.

- [ ] **Step 4: Run the focused tests to verify GREEN**

Run:

```powershell
npm.cmd test -- --run src/game/support/DongFuBuildingArt.test.ts src/data/building/buildings.rework.test.ts
```

Expected: PASS.

- [ ] **Step 5: Review the manifest diff**

Run `git diff --check` and inspect `git diff -- game/src/game/support/DongFuBuildingArt.ts game/src/data/building/buildings.ts`. Confirm that only the display label changed in building data. Do not commit.

---

### Task 3: Render and Approve the Five-Building Concept Sheet

**Files:**
- Create: `game/art-source/buildings/dong-fu/v2/README.md`
- Create: `game/art-source/buildings/dong-fu/v2/prompts/concept-sheet.md`
- Create after generation: `game/art-source/buildings/dong-fu/v2/concepts/buildings-concept-sheet-v1.png`
- Reference only: `game/public/assets/buildings/dong-fu/buildings-contact-sheet.png`
- Reference only: approved `game/public/assets/backgrounds/dong-fu/modular/previews/spring-morning.png`

**Interfaces:**
- Consumes: the five visual identities and exclusions in the design spec.
- Produces: one user-approved concept sheet that becomes the visual source of truth for Task 4.

- [ ] **Step 1: Record the exact concept prompt**

Save this normalized prompt in `concept-sheet.md`:

```text
Use case: stylized-concept
Asset type: concept sheet for five separately rendered 2D game buildings
Primary request: Design exactly five distinct buildings for an outdoor immortal-sect Dong Fu scene: Linh Tuyền, Khí Đường, Đan Phòng, Truyền Tống Trận, and Khai Vật Đường.
Input images: Image 1 is the current building contact sheet for subject/function reference only; Image 2 is the approved Dong Fu spring-morning background for ink style, palette, camera, baseline, and atmosphere reference.
Scene/backdrop: neutral white xuan paper concept sheet with five separated cells; no environmental panorama baked behind a building.
Style/medium: traditional Chinese ink painting, dry brush and paper bleed, restrained mineral pigments, production-quality 2D game art.
Composition/framing: front-facing with a slight horizontal offset, minimal side depth, horizontal contact baseline, all five at comparable gameplay scale, no isometric pedestal or top-down floor plane.
Subjects: Linh Tuyền is low and wide with semicircular spring, small waterfall, jade crystals, thin shelter; Khí Đường is heavy and asymmetric with low forge hall, chimney, deep-red furnace and hammer-sword stone supports; Đan Phòng is balanced and octagonal with curved roof, visible alchemy furnace, round windows and herb racks; Truyền Tống Trận is a tall weathered stone gate with a truly empty center, paired rune pillars and shallow horizontal platform; Khai Vật Đường is a wide open-front sect office with offset storage wings, map rack, command slips, spirit-wood bundles and ore baskets.
Color palette: charcoal and warm paper with restrained jade, cinnabar, antique gold, timber ochre and mineral blue accents.
Constraints: exactly five buildings; each silhouette unique and readable when small; no people; no lettering; no labels inside the art cells; no VFX; keep the central opening of the teleport gate empty.
Avoid: glossy fantasy rendering, photorealism, 3D icon look, 2.5D diorama, floating base, cave entrance, purple, magenta, checkerboard, watermark, signature, seal text, UI frames.
```

- [ ] **Step 2: Generate the sheet with built-in ImageGen**

Use the current building contact sheet as subject reference and the approved spring-morning composite as style/environment reference. This is `stylized-concept` generation, not an edit target. Render the output inline and copy the selected file into `concepts/buildings-concept-sheet-v1.png`.

- [ ] **Step 3: Inspect at original resolution and gameplay scale**

Use `view_image` for original-resolution inspection. Create a QA downscale with five cells no taller than the intended scene occupancy. Reject the sheet if any building has an elevated oval base, wrong camera, duplicated roof silhouette, illegible function, baked text, or opaque/checkerboard background.

- [ ] **Step 4: Present the concept sheet to the user and stop**

This is a hard art gate. Report the exact prompt, built-in mode, and saved path. Do not generate final bases until the user approves the sheet or gives building-specific revisions.

- [ ] **Step 5: Record approval and review scope**

After approval, add a short approval note and date to `art-source/buildings/dong-fu/v2/README.md`. Run `git status --short` and confirm no generated cache or temporary extraction files are inside the worktree. Do not commit.

---

### Task 4: Produce Five Canonical Base Sprites and Technical Layers

**Files:**
- Create: `game/art-source/buildings/dong-fu/v2/masters/<building-id>.png` for five IDs
- Create: `game/art-source/buildings/dong-fu/v2/prompts/<building-id>.md` for five IDs
- Create: `game/public/assets/buildings/dong-fu/v2/<building-id>/base.png` for five IDs
- Create: `game/public/assets/buildings/dong-fu/v2/<building-id>/silhouette-mask.png` for five IDs
- Create: `game/public/assets/buildings/dong-fu/v2/<building-id>/ground-shadow.png` for five IDs
- Create: `game/public/assets/buildings/dong-fu/v2/<building-id>/locked-overlay.png` for five IDs
- Create: `game/src/assets/dongFuBuildingAssets.test.ts`
- Create: `game/scripts/verify-dong-fu-building-alpha.mjs`
- Modify: `game/src/game/support/DongFuBuildingArt.ts`

**Interfaces:**
- Consumes: the approved Task 3 concept sheet and Task 2 manifest types.
- Produces: twenty aligned runtime PNGs and final measured metadata for all five buildings.

- [ ] **Step 1: Write the failing asset-contract test before generating final files**

The test must enumerate URLs from `DONG_FU_BUILDING_ART`, read PNG headers, and assert:

```ts
expect(DONG_FU_BUILDING_ART).toHaveLength(5)
expect(runtimeFiles).toHaveLength(20)
expect(pngWidth).toBe(1254)
expect(pngHeight).toBe(1254)
expect(colorType).toBe(6)
expect(entry.baselineY).toBeGreaterThan(entry.visualBounds.y)
expect(entry.baselineY).toBeLessThanOrEqual(
  entry.visualBounds.y + entry.visualBounds.height,
)
```

Parse PNG signature/IHDR using the existing project test pattern; do not add a PNG library. Color type 6 proves an alpha channel exists, while the next step's dedicated verifier proves that transparent pixels actually occur.

Create `verify-dong-fu-building-alpha.mjs` using only Node built-ins and the installed ImageMagick executable:

```js
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const root = fileURLToPath(new URL('../public/assets/buildings/dong-fu/v2/', import.meta.url))
const buildingIds = ['spirit_spring', 'equipment_hall', 'pill_room', 'teleport_array', 'gathering_outpost']
const requiredNames = ['base.png', 'silhouette-mask.png', 'ground-shadow.png', 'locked-overlay.png']
const files = buildingIds.flatMap((buildingId) =>
  requiredNames.map((name) => join(root, buildingId, name)),
)

if (files.length !== 20) throw new Error(`Expected 20 technical PNGs, found ${files.length}`)

for (const file of files) {
  const result = execFileSync(
    'magick',
    ['identify', '-format', '%w %h %[channels] %[fx:minima.a] %[fx:maxima.a]', file],
    { encoding: 'utf8' },
  ).trim()
  const [width, height, channels, alphaMin, alphaMax] = result.split(/\s+/)
  if (width !== '1254' || height !== '1254' || !channels.includes('a') || Number(alphaMin) !== 0 || Number(alphaMax) <= 0) {
    throw new Error(`${file}: invalid alpha contract (${result})`)
  }
}
```

- [ ] **Step 2: Run the asset test to verify RED**

Run:

```powershell
npm.cmd test -- --run src/assets/dongFuBuildingAssets.test.ts
```

Expected: FAIL because twenty required V2 PNGs do not exist.

- [ ] **Step 3: Generate each base with one dedicated built-in ImageGen call**

For each building, reuse the full shared style/camera/constraints from Task 3 and add the exact subject paragraph from Spec §3.2. Use the concept sheet as the composition and identity reference. Request a uniform white xuan extraction background or genuine transparency, centered on a square canvas with generous safe margins and one horizontal baseline.

Persist the final prompt in `prompts/<building-id>.md`. A building is accepted only if it preserves the approved identity. Do not use one multi-subject output as five final crops.

- [ ] **Step 4: Validate and normalize each base**

Inspect each generated image before processing. If ImageGen returns a checkerboard or colored chroma, reject it rather than treating the pattern as transparency. If it returns uniform white paper, use a white-unmatte conversion that preserves pale brush-edge alpha. Normalize without stretching:

```powershell
magick input.png -resize '1120x1120>' -gravity south -background none -extent 1254x1254 base.png
magick identify -format '%wx%h %[channels] alpha-min=%[fx:minima.a] alpha-max=%[fx:maxima.a]' base.png
```

Expected: `1254x1254`, RGBA, `alpha-min=0`, and a nonzero alpha maximum. Never recenter after metadata measurement.

- [ ] **Step 5: Derive technical layers from the accepted base**

Derive, do not regenerate, the silhouette and shadow:

```powershell
magick base.png -alpha extract -threshold 1% -write mpr:mask +delete -size 1254x1254 xc:white mpr:mask -alpha off -compose CopyOpacity -composite silhouette-mask.png
magick base.png -alpha extract -threshold 2% -blur 0x14 -distort SRT '1,0,1,0,0,42' -write mpr:shadow +delete -size 1254x1254 xc:'#171713' mpr:shadow -alpha off -compose CopyOpacity -composite ground-shadow.png
```

Generate one shared source seal with built-in ImageGen using: “a single abstract ancient Chinese rectangular sealing talisman mark, dark cinnabar brush strokes with no legible writing or characters, isolated on genuine transparency, centered, no paper rectangle, no glow, no shadow, no watermark.” Normalize it to a maximum `240 × 300` RGBA source under `art-source/buildings/dong-fu/v2/shared/locked-seal-source.png`.

For each building, create `locked-overlay.png` from the base alpha: a `#667078` wash at 42% opacity clipped to the silhouette, then composite the shared seal centered on the measured `entrance` anchor. Use explicit per-building `$sealX`/`$sealY` values calculated from that anchor; do not estimate a common position. Verify all four files remain pixel-aligned by compositing them over a high-contrast checker only for QA; never save the checker into a runtime file.

- [ ] **Step 6: Measure and replace all provisional metadata**

Use ImageMagick trim information for `visualBounds`; choose `baselineY` at the lowest intentional architectural contact line, excluding loose mist or shadow; inset the hitbox to the opaque architectural mass. Record future anchors for the spec-defined deferred effects, for example:

```ts
futureVfxAnchors: {
  entrance: { x: 628, y: 860 },
  roof: { x: 628, y: 320 },
  functionCore: { x: 628, y: 720 },
}
```

Numbers must be measured per building. Remove every conservative full-canvas bound introduced in Task 2.

- [ ] **Step 7: Run the asset and manifest tests to verify GREEN**

Run:

```powershell
npm.cmd test -- --run src/assets/dongFuBuildingAssets.test.ts src/game/support/DongFuBuildingArt.test.ts
node scripts/verify-dong-fu-building-alpha.mjs
```

Expected: PASS with exactly twenty per-building runtime PNGs and genuine transparent pixels in every technical layer. Inspect the teleport gate center at original resolution and reject it if the opening is not transparent.

- [ ] **Step 8: Review the production asset checkpoint**

Create a contact sheet on neutral paper and dark gray solely to expose halos. Inspect with `view_image`, run `git diff --check`, and list all runtime/source files. Do not commit.

---

### Task 5: Produce Four Shared Seasonal Overlays and QA Composites

**Files:**
- Create: `game/public/assets/buildings/dong-fu/v2/shared/seasons/spring.png`
- Create: `game/public/assets/buildings/dong-fu/v2/shared/seasons/summer.png`
- Create: `game/public/assets/buildings/dong-fu/v2/shared/seasons/autumn.png`
- Create: `game/public/assets/buildings/dong-fu/v2/shared/seasons/winter.png`
- Create: `game/art-source/buildings/dong-fu/v2/prompts/season-overlays.md`
- Create: `game/public/assets/buildings/dong-fu/v2/previews/gameplay-scale.png`
- Create: `game/public/assets/buildings/dong-fu/v2/previews/states.png`
- Create: `game/public/assets/buildings/dong-fu/v2/previews/scene-placement.png`
- Create: `game/public/assets/buildings/dong-fu/v2/previews/seasons.png`
- Create: `game/public/assets/buildings/dong-fu/v2/previews/night-readability.png`
- Modify: `game/src/assets/dongFuBuildingAssets.test.ts`
- Modify: `game/scripts/verify-dong-fu-building-alpha.mjs`

**Interfaces:**
- Consumes: five final bases and the approved `1672 × 941` Dong Fu spring-morning composite.
- Produces: four pointer-transparent seasonal atmosphere textures and five QA-only preview sheets.

- [ ] **Step 1: Extend the asset test for shared overlays**

Assert exactly four files, `1672 × 941`, PNG color type 6, and assert preview paths are absent from all runtime URL builders. Extend `verify-dong-fu-building-alpha.mjs` with these exact files and expected dimensions:

```js
const seasonFiles = ['spring', 'summer', 'autumn', 'winter'].map((season) => ({
  file: join(root, 'shared', 'seasons', `${season}.png`),
  width: 1672,
  height: 941,
}))
```

Refactor the existing verification loop to accept `{ file, width, height }` records for both the twenty `1254 × 1254` technical files and four season files; retain the alpha-minimum-zero and alpha-maximum-positive checks.

- [ ] **Step 2: Run the test to verify RED**

Run `npm.cmd test -- --run src/assets/dongFuBuildingAssets.test.ts`.

Expected: FAIL because the four shared overlays are missing.

- [ ] **Step 3: Generate four distinct static overlay plates**

Use one built-in ImageGen call per season. Each prompt must request only sparse scene-space atmospheric marks on genuine transparency:

- Spring: a few pale shoots, restrained blossom petals, and damp mist accents.
- Summer: sparse fuller leaf clusters and humid ink haze.
- Autumn: sparse ochre/cinnabar leaves and dry brush specks.
- Winter: sparse foreground snow drift and a few static flakes; no roof-specific snow.

All four use the same `1672 × 941` canvas and must leave the central cultivation platform readable. No building, mountain, UI, text, character, or full-paper background is allowed.

- [ ] **Step 4: Compose the five QA previews**

Use deterministic ImageMagick composition from the final runtime assets and manifest placement. Preview state columns are `normal`, `hover`, `selected`, and `locked`. Scene preview uses the accepted background and keeps the cultivation platform clear. Seasonal preview uses one representative time. Night preview applies the planned CSS-equivalent charcoal-indigo grade.

- [ ] **Step 5: Inspect and adjust placement through metadata only**

Use `view_image` on all five previews. Adjust only `scenePlacement` in `DongFuBuildingArt.ts` until the user-approved stagger is achieved. Do not move pixels inside building canvases and do not bend the background baseline.

- [ ] **Step 6: Present the scene and state previews to the user and stop**

This is the second hard art gate. Report all saved preview paths and ask for approval of placement, scale, locked art, and seasonal compatibility before runtime component work.

- [ ] **Step 7: Verify GREEN after approval**

Run:

```powershell
npm.cmd test -- --run src/assets/dongFuBuildingAssets.test.ts src/game/support/DongFuBuildingArt.test.ts
node scripts/verify-dong-fu-building-alpha.mjs
git diff --check
```

Expected: all asset/manifest tests pass and all twenty-four runtime PNGs satisfy their dimension/alpha contracts. Do not commit.

---

### Task 6: Build the Static Building Sprite Component with TDD

**Files:**
- Create: `game/src/components/game/DongFuBuildingSprite.vue`
- Create: `game/src/components/game/DongFuBuildingSprite.test.ts`

**Interfaces:**
- Consumes: `DongFuBuildingArtEntry`, `DongFuBuildingAssetUrls`, `ThanhVanSeason`, `ThanhVanTime`, and `BuildingBadgeStatus`.
- Produces: a decorative sprite stack that emits `asset-error` while leaving the parent interactive button in control.

- [ ] **Step 1: Write failing component tests**

Mount one manifest entry and assert:

```ts
expect(root.dataset.buildingId).toBe('pill_room')
expect(root.classList).toContain('is-locked')
expect(root.classList).toContain('is-time-night')
expect(base.getAttribute('src')).toBe('/assets/buildings/dong-fu/v2/pill_room/base.png')
expect(mask.getAttribute('src')).toBe('/assets/buildings/dong-fu/v2/pill_room/silhouette-mask.png')
expect(locked.hidden).toBe(false)
expect(base.alt).toBe('')
expect(base.draggable).toBe(false)
```

Also dispatch an `error` event on the base and assert an `asset-error` emission plus `.has-asset-error`. Add a reduced-motion test asserting that the component has no animated class and hover elevation is disabled under the explicit prop used by tests.

- [ ] **Step 2: Run tests to verify RED**

Run `npm.cmd test -- --run src/components/game/DongFuBuildingSprite.test.ts`.

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement the minimal component**

Use this public prop/emits contract:

```ts
const props = defineProps<{
  art: DongFuBuildingArtEntry
  status: BuildingBadgeStatus
  selected: boolean
  disabled: boolean
  season: ThanhVanSeason
  time: ThanhVanTime
  reducedMotion: boolean
}>()

const emit = defineEmits<{
  assetError: [buildingId: DongFuBuildingId]
}>()
```

Render `ground-shadow`, `base`, a mask-backed outline, and `locked-overlay`. Do not render nameplates, buttons, badges, seasonal scene overlays, or VFX here. Set CSS variables for mask URL, time grade, and source-bound alignment. Mark every image decorative.

- [ ] **Step 4: Implement static styles**

Use layer-local CSS only:

- `hover/focus` state is driven by the parent button using `:deep()` or a parent class, lifts 3–4 px, and reveals a mask-derived ink-gold outline.
- `selected` keeps the outline and adds a static ground ring.
- `locked` lowers saturation/brightness and reveals `locked-overlay`.
- `disabled/error` fades the base without hiding it.
- time classes apply restrained filter/custom-property grading.
- reduced motion removes transitions and translation without removing outlines.

No keyframes or particle elements are allowed.

- [ ] **Step 5: Run tests to verify GREEN**

Run `npm.cmd test -- --run src/components/game/DongFuBuildingSprite.test.ts`.

Expected: PASS.

- [ ] **Step 6: Review the component boundary**

Confirm the component has no imports from Pinia, GameManager, `useBuildingNavigation`, or UI stores. Run `git diff --check`. Do not commit.

---

### Task 7: Replace Invisible Hotspots with Sprite-Anchored Building Buttons

**Files:**
- Modify: `game/src/components/game/HomeBuildingIcons.vue`
- Modify: `game/src/components/game/HomeBuildingIcons.test.ts`
- Test transitively: `game/src/components/game/BuildingDetailPopover.vue`
- Test transitively: `game/src/composables/useBuildingNavigation.ts`

**Interfaces:**
- Consumes: `DONG_FU_BUILDING_ART`, `DongFuBuildingSprite`, `peekThanhVanVariant()`, and current `useBuildingNavigation()` results.
- Produces: five accessible art-aligned building buttons plus one shared seasonal overlay.

- [ ] **Step 1: Extend HomeBuildingIcons tests before implementation**

Keep every existing navigation/nameplate test and add assertions for:

```ts
expect(buildingAnchors.map((node) => node.dataset.buildingId)).toEqual([
  'pill_room',
  'gathering_outpost',
  'teleport_array',
  'equipment_hall',
  'spirit_spring',
])
expect(sprite('pill_room')).not.toBeNull()
expect(button('pill_room')?.getAttribute('aria-label')).toContain('Đan Phòng')
expect(sprite('pill_room')?.classList).toContain('is-locked')
expect(seasonOverlay.getAttribute('src')).toBe(
  '/assets/buildings/dong-fu/v2/shared/seasons/spring.png',
)
```

Add tests that a built `pill_room` retains direct panel navigation, an unbuilt building opens construction requirements, an asset error preserves the button/nameplate, and `gathering_outpost` displays “Khai Vật Đường”.

- [ ] **Step 2: Run tests to verify RED**

Run:

```powershell
npm.cmd test -- --run src/components/game/HomeBuildingIcons.test.ts
```

Expected: new sprite, order, seasonal overlay, error fallback, and display-name assertions fail.

- [ ] **Step 3: Replace hard-coded hotspot geometry with manifest anchors**

Iterate `DONG_FU_BUILDING_ART`, resolve the corresponding building template by ID, and render an anchor using:

```ts
function anchorStyle(entry: DongFuBuildingArtEntry) {
  return {
    left: `${entry.scenePlacement.xPercent}%`,
    top: `${entry.scenePlacement.yPercent}%`,
    width: `${entry.scenePlacement.scale * 100}%`,
    zIndex: entry.scenePlacement.zIndex,
  }
}
```

The button remains the semantic and pointer owner. Its hit area is derived from metadata bounds using CSS variables relative to the `1254 × 1254` sprite canvas. Remove `BUILDING_HOTSPOTS`, `hotspotFor`, and effect-specific VFX DOM/CSS. Preserve tooltip and click handlers.

- [ ] **Step 4: Map state and selection without new stores**

Use `navigation.getBuildingStatus(buildingId)` for badge/static visual state. Treat a building as selected when either its popover ID is active or its built `functionType` equals the current `ui.leftPanelMode`. Keep locked buttons clickable.

Track image errors in `Set<DongFuBuildingId>` held by a typed `ref`; an error adds `.has-asset-error` but never removes the button, label, tooltip, or navigation handler. Pass `disabled=false` for the current five definitions; the prop exists for the spec-defined static disabled presentation without inventing new gameplay rules.

- [ ] **Step 5: Synchronize season/time and reduced motion**

Initialize from `peekThanhVanVariant()`. Refresh after a stage transitions from active to inactive, matching the background lifecycle. Use one shared seasonal overlay image after all anchors. Read `matchMedia('(prefers-reduced-motion: reduce)')`, pass the boolean to sprites, and remove listeners on unmount.

- [ ] **Step 6: Run focused tests to verify GREEN**

Run:

```powershell
npm.cmd test -- --run src/components/game/DongFuBuildingSprite.test.ts src/components/game/HomeBuildingIcons.test.ts src/game/support/DongFuBuildingArt.test.ts src/assets/dongFuBuildingAssets.test.ts
```

Expected: PASS, including all pre-existing HomeBuildingIcons navigation tests.

- [ ] **Step 7: Review DOM and stacking behavior**

Confirm building art renders above the ten-layer background, below the player and UI, and the seasonal overlay is `pointer-events: none`. Confirm no old `building-hotspot__vfx` or effect keyframes remain. Run `git diff --check`. Do not commit.

---

### Task 8: Documentation, Browser QA, and Final Verification

**Files:**
- Create: `game/public/assets/buildings/dong-fu/v2/README.md`
- Modify: `game/public/assets/buildings/dong-fu/README.md`
- Modify if measurements changed: `game/src/game/support/DongFuBuildingArt.ts`
- Modify only for task-caused defects: files already listed in Tasks 2–7

**Interfaces:**
- Consumes: the complete art and component implementation.
- Produces: verified, documented work preserved on the isolated branch for user review, without integration.

- [ ] **Step 1: Document runtime and source contracts**

The V2 README must list all five IDs, the Khai Vật Đường display rename, exact canvas sizes, technical layer order, four shared seasonal overlays, time-grade behavior, metadata meaning, preview-only files, and explicitly deferred VFX. Update the legacy README so V2 is the intended future runtime set while old files remain reference/rollback assets.

- [ ] **Step 2: Run focused verification**

Run:

```powershell
npm.cmd test -- --run src/game/support/DongFuBuildingArt.test.ts src/assets/dongFuBuildingAssets.test.ts src/components/game/DongFuBuildingSprite.test.ts src/components/game/HomeBuildingIcons.test.ts
```

Expected: all building-focused tests pass.

- [ ] **Step 3: Run browser visual QA when a browser backend is available**

Start Vite locally and inspect at minimum `1672 × 941`, `1366 × 768`, and a narrow mobile viewport. Force spring/morning and winter/night via the existing Thanh Van QA overrides. Verify cover-fit alignment, staggered depth, open cultivation platform, keyboard focus, locked click behavior, nameplates, and image-error fallback. Inspect the console for missing assets.

If no browser backend is connected, do not substitute unrelated browser tooling. Report the limitation and rely on the deterministic scene/state contact sheets plus component tests.

- [ ] **Step 4: Run repository-required verification**

Run fresh commands from `game/`:

```powershell
npm.cmd test -- --run
npm.cmd run type-check
npm.cmd run build
```

Expected task result: no new failures caused by building work. Separately report the acknowledged base failure in `InkWashPrimitives.test.ts` if it remains, plus any unrelated type/build failures already present on the imported baseline. Do not edit unrelated files to make the suite green.

- [ ] **Step 5: Audit deliverables and diff**

Run:

```powershell
git diff --check
git status --short
git diff --stat
rg -n "building-hotspot__vfx|hotspot-spin|hotspot-rise|hotspot-ripple" game/src/components/game/HomeBuildingIcons.vue
```

Expected: no whitespace errors; no temporary ImageGen/extraction directories; no runtime references to preview files; no old hotspot VFX code; only task-scoped paths changed.

- [ ] **Step 6: Preserve the worktree for user review**

Report:

- Worktree and branch.
- Every changed source/art/runtime path.
- Built-in ImageGen prompts and final asset paths.
- Focused/full test, type-check, and build results.
- Browser QA result or limitation.
- Deferred VFX and any baseline failures.

Do not commit, merge, push, remove the worktree, or delete the branch. Wait for the user’s explicit integration decision.
