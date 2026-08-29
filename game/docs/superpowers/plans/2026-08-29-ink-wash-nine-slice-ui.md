# Ink-Wash Nine-Slice UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce and integrate a shared XS-to-XL ink-wash nine-slice UI asset kit for Vue DOM and Phaser while preserving live text, interaction behavior, and semantic gameplay colors.

**Architecture:** Eleven canonical raster assets are described by one typed JSON manifest. Vue renders them through a decorative `InkNineSlice` primitive using CSS `border-image`; Phaser loads a generated atlas and creates `Phaser.GameObjects.NineSlice` objects through a small adapter that consumes the same manifest. Image generation produces art masters, while a deterministic Node/canvas pipeline validates dimensions and alpha, exports `@1x`/`@2x`, builds the Phaser atlas, and generates review contact sheets.

**Tech Stack:** Vue 3, TypeScript, CSS `border-image`, Phaser 4.2, Vite, Vitest, Playwright, existing `canvas` dev dependency, built-in ImageGen.

**Spec:** `game/docs/superpowers/specs/2026-08-29-ink-wash-nine-slice-ui-design.md`

## Global Constraints

- Work only in the dedicated task worktree and branch after checking every active worktree and changed path.
- Stop before implementation if another active task still changes `game/src/assets/theme.css` or another file listed in the current task; report the overlap instead of editing.
- Do not commit, push, deploy, or perform destructive Git operations. The “Commit” step normally required by writing-plans is replaced by a diff/review checkpoint after every task.
- Do not add dependencies; use the existing `canvas` package for PNG inspection, resizing, atlas packing, extrusion, and contact sheets.
- Do not use `any` unless a documented framework boundary genuinely requires it.
- Mutable text, numbers, icons, hit areas, focus behavior, and gameplay state remain code-rendered.
- Canonical art direction is “Mực & Giấy”: warm white xuan paper, carbon ink, smoky wash, a dark ink data surface, restrained cinnabar/jade/azure/mineral-gold pigment, and no metallic chrome or neon glow.
- Ornament density increases XS → XL; large landscape motifs never enter stretchable edge centers.
- Neutral grayscale masters are tintable. Bake another variant only when its silhouette or brush pressure changes.
- Generate one distinct asset per ImageGen call; do not request several unrelated runtime assets in a single generated sheet.
- Keep accepted editable masters in `game/art-source/ui/ink-wash/approved/`; keep runtime exports in `game/public/assets/ui/ink-wash/`.
- Run relevant focused tests after each task. Before completion run `npm.cmd test`, `npm.cmd run type-check`, and `npm.cmd run build` from `game/`, plus the dedicated asset check and relevant Playwright spec.

## File Map

### Canonical metadata and tooling

- Create `game/src/assets/ink-wash-ui-slices.json` — single source of truth for asset IDs, dimensions, slice insets, center mode, edge mode, and tintability.
- Create `game/src/assets/inkWashUi.ts` — typed accessors over the JSON manifest for Vue and Phaser.
- Create `game/src/assets/inkWashUi.test.ts` — contract, ID, geometry, and URL tests.
- Create `game/src/assets/inkWashAssetValidation.ts` — pure validation functions shared by tests and the Node build script.
- Create `game/src/assets/inkWashAssetValidation.test.ts` — invalid-dimension, invalid-slice, duplicate-ID, and alpha-rule tests.
- Create `game/scripts/build-ink-wash-assets.mjs` — deterministic export, validation, atlas, extrusion, and contact-sheet pipeline.
- Modify `game/package.json` — add `assets:ink-ui` and `assets:ink-ui:check` scripts only.

### Art sources and runtime output

- Create `game/art-source/ui/ink-wash/approved/*.png` — eleven approved `4x` masters and six transparent painting bridges.
- Create `game/art-source/ui/ink-wash/style-anchor.png` — approved paper/ink/pigment reference.
- Create `game/public/assets/ui/ink-wash/slices/*.png` — eleven `@1x` and eleven `@2x` nine-slice exports.
- Create `game/public/assets/ui/ink-wash/overlays/*.png` — six transparent overlays.
- Create `game/public/assets/ui/ink-wash/atlas/ink-wash-ui.png` and `.json` — Phaser atlas with two-pixel extrusion.
- Create `game/public/assets/ui/ink-wash/ink-wash-ui-slices.json` — generated copy of canonical metadata.
- Create `game/public/assets/ui/ink-wash/review/*.png` — size-matrix and full-kit contact sheets.

### Vue rendering and integration

- Create `game/src/components/common/primitives/InkNineSlice.vue` — non-interactive decorative nine-slice layer.
- Create `game/src/components/common/primitives/InkNineSlice.test.ts` — DOM style and accessibility contract.
- Modify `game/src/assets/theme.css` — add paper/brush/pigment tokens without deleting scene semantic tokens.
- Modify `game/src/App.vue` — paper fallback for non-world full-screen flows.
- Modify `game/src/components/common/GameButton.vue` — S button family.
- Modify `game/src/components/common/primitives/Chip.vue` — XS frame.
- Modify `game/src/components/common/SlotView.vue` — S slot frame.
- Modify `game/src/components/common/NotificationBadge.vue` — XS ink/seal treatment.
- Create `game/src/components/common/InkWashPrimitives.test.ts` — shared primitive integration tests.
- Modify `game/src/components/common/Tooltip.vue` — M surface and frame.
- Modify `game/src/components/game/BuildingDetailPopover.vue` — M surface and frame.
- Modify `game/src/components/panels/loadout-sections/TechniqueSlotCard.vue` — M frame.
- Create `game/src/components/common/InkWashMediumSurfaces.test.ts` — representative M-tier tests.
- Modify `game/src/components/common/GamePanel.vue` — L paper/dark-data surface plus L frame.
- Modify `game/src/components/common/OverlayPanel.vue` — XL paper-scroll surface and ceremonial frame.
- Modify `game/src/components/common/ConfirmModal.vue` — XL ceremonial shell.
- Modify `game/src/components/common/OfflineSummaryModal.vue` — inherit and verify XL shell.
- Modify `game/src/components/onboarding/AuthEntryScreen.vue` — XL paper-scroll composition.
- Modify `game/src/components/onboarding/CharacterCreationScreen.vue` — XL paper-scroll composition.
- Modify `game/src/components/game/combat/CombatVictoryPanel.vue` — XL result treatment.
- Modify `game/src/components/game/combat/CombatDefeatPanel.vue` — XL result treatment.
- Create `game/src/components/common/InkWashLargeSurfaces.test.ts` — shell and asset-ID tests.
- Create `game/src/components/common/InkWashBackdrop.vue` — non-interactive painting-bridge composition.
- Create `game/src/components/common/InkWashBackdrop.test.ts` — overlay, safe-zone, and accessibility tests.

### Phaser rendering and visual verification

- Create `game/src/game/support/InkWashUiPhaser.ts` — atlas preload and NineSlice factory.
- Create `game/src/game/support/InkWashUiPhaser.test.ts` — preload dedupe and factory-argument tests.
- Modify `game/src/game/scenes/TribulationScene.ts` — first real Phaser consumer: responsive XL ceremonial viewport frame.
- Create `game/src/game/scenes/TribulationScene.inkWashUi.test.ts` — source-level scene contract around preload/create/resize cleanup.
- Create `game/tests/e2e/ink-wash-ui.spec.ts` — screenshots and layout assertions at desktop, compact desktop, and tall-narrow viewports.
- Modify `game/docs/ui-components.md` — document the new visual primitives and mapping.

---

### Task 1: Define the Canonical Slice Manifest

**Files:**

- Create: `game/src/assets/ink-wash-ui-slices.json`
- Create: `game/src/assets/inkWashUi.ts`
- Create: `game/src/assets/inkWashUi.test.ts`

**Interfaces:**

- Produces: `InkWashUiAssetId`, `InkWashUiAsset`, `INK_WASH_UI_ASSET_IDS`, `INK_WASH_UI_ASSETS`, `getInkWashUiAsset(id)`.
- Consumed by: Vue `InkNineSlice`, Phaser adapter, asset validator, atlas builder.

- [ ] **Step 1: Write the failing manifest contract test**

```ts
import { describe, expect, it } from 'vitest'
import {
  INK_WASH_UI_ASSET_IDS,
  INK_WASH_UI_ASSETS,
  getInkWashUiAsset,
} from './inkWashUi'

const EXPECTED_IDS = [
  'frame-xs-ink-line',
  'button-s-paper',
  'button-s-ink',
  'button-s-seal',
  'frame-s-slot',
  'surface-m-paper',
  'frame-m-seal-corner',
  'surface-l-ink-data',
  'frame-l-landscape',
  'surface-xl-paper-scroll',
  'frame-xl-ceremony',
] as const

describe('ink-wash UI manifest', () => {
  it('contains the exact approved XS-to-XL asset set', () => {
    expect(INK_WASH_UI_ASSET_IDS).toEqual(EXPECTED_IDS)
    expect(Object.keys(INK_WASH_UI_ASSETS)).toEqual(EXPECTED_IDS)
  })

  it('keeps every slice inside its source and derives minimum size', () => {
    for (const asset of Object.values(INK_WASH_UI_ASSETS)) {
      expect(asset.slices.left + asset.slices.right).toBeLessThanOrEqual(asset.sourceWidth)
      expect(asset.slices.top + asset.slices.bottom).toBeLessThanOrEqual(asset.sourceHeight)
      expect(asset.minimumWidth).toBe(asset.slices.left + asset.slices.right)
      expect(asset.minimumHeight).toBe(asset.slices.top + asset.slices.bottom)
      expect(asset.url1x).toBe(`/assets/ui/ink-wash/slices/${asset.id}@1x.png`)
      expect(asset.url2x).toBe(`/assets/ui/ink-wash/slices/${asset.id}@2x.png`)
    }
  })

  it('returns the same canonical object by ID', () => {
    expect(getInkWashUiAsset('frame-xl-ceremony')).toBe(
      INK_WASH_UI_ASSETS['frame-xl-ceremony'],
    )
  })
})
```

- [ ] **Step 2: Run the focused test and confirm the missing-module failure**

Run: `npm.cmd test -- src/assets/inkWashUi.test.ts`

Expected: FAIL because `./inkWashUi` does not exist.

- [ ] **Step 3: Create the exact manifest JSON**

Use `{ "version": 1, "assets": [...] }` and these exact records:

```json
[
  ["frame-xs-ink-line",64,64,12,12,12,12,"transparent","stretch",true],
  ["button-s-paper",192,64,24,24,16,16,"fill","stretch",false],
  ["button-s-ink",192,64,24,24,16,16,"fill","stretch",true],
  ["button-s-seal",192,64,24,24,16,16,"fill","stretch",true],
  ["frame-s-slot",96,96,20,20,20,20,"transparent","stretch",true],
  ["surface-m-paper",192,192,32,32,32,32,"fill","stretch",false],
  ["frame-m-seal-corner",192,192,32,32,32,32,"transparent","stretch",true],
  ["surface-l-ink-data",320,320,48,48,48,48,"fill","stretch",true],
  ["frame-l-landscape",320,320,48,48,48,48,"transparent","stretch",true],
  ["surface-xl-paper-scroll",512,512,80,80,80,80,"fill","stretch",false],
  ["frame-xl-ceremony",512,512,80,80,80,80,"transparent","stretch",true]
]
```

Expand each compact row into named JSON fields: `id`, `sourceWidth`, `sourceHeight`, `slices`, `center`, `edgeMode`, `tintable`, `minimumWidth`, `minimumHeight`, `url1x`, and `url2x`. Do not keep the compact array form in the production file.

- [ ] **Step 4: Implement typed accessors without unsafe casts at call sites**

```ts
import rawManifest from './ink-wash-ui-slices.json'

export const INK_WASH_UI_ASSET_IDS = [
  'frame-xs-ink-line',
  'button-s-paper',
  'button-s-ink',
  'button-s-seal',
  'frame-s-slot',
  'surface-m-paper',
  'frame-m-seal-corner',
  'surface-l-ink-data',
  'frame-l-landscape',
  'surface-xl-paper-scroll',
  'frame-xl-ceremony',
] as const

export type InkWashUiAssetId = (typeof INK_WASH_UI_ASSET_IDS)[number]
export type InkWashUiCenterMode = 'transparent' | 'fill'
export type InkWashUiEdgeMode = 'stretch' | 'tile'

export interface InkWashUiAsset {
  id: InkWashUiAssetId
  url1x: string
  url2x: string
  sourceWidth: number
  sourceHeight: number
  slices: { left: number; right: number; top: number; bottom: number }
  center: InkWashUiCenterMode
  edgeMode: InkWashUiEdgeMode
  tintable: boolean
  minimumWidth: number
  minimumHeight: number
}

const assets = rawManifest.assets as InkWashUiAsset[]

export const INK_WASH_UI_ASSETS = Object.fromEntries(
  assets.map((asset) => [asset.id, Object.freeze(asset)]),
) as Readonly<Record<InkWashUiAssetId, Readonly<InkWashUiAsset>>>

export function getInkWashUiAsset(id: InkWashUiAssetId): Readonly<InkWashUiAsset> {
  return INK_WASH_UI_ASSETS[id]
}
```

The two structural assertions are localized at the JSON boundary. No consumer may cast manifest data.

- [ ] **Step 5: Run the focused test**

Run: `npm.cmd test -- src/assets/inkWashUi.test.ts`

Expected: PASS, 3 tests.

- [ ] **Step 6: Review checkpoint**

Run: `git diff --check` and `git status --short`. Verify only the three task files changed. Do not commit.

---

### Task 2: Build Deterministic Validation, Export, Atlas, and Contact-Sheet Tooling

**Files:**

- Create: `game/src/assets/inkWashAssetValidation.ts`
- Create: `game/src/assets/inkWashAssetValidation.test.ts`
- Create: `game/scripts/build-ink-wash-assets.mjs`
- Modify: `game/package.json`

**Interfaces:**

- Consumes: `InkWashUiAsset` records from Task 1 and approved `4x` masters.
- Produces: `validateAssetDefinitions()`, `validateRasterFacts()`, CLI scripts `assets:ink-ui` and `assets:ink-ui:check`, runtime PNGs, atlas JSON/PNG, metadata copy, and review sheets.

- [ ] **Step 1: Write failing pure validation tests**

```ts
import { describe, expect, it } from 'vitest'
import { validateAssetDefinitions, validateRasterFacts } from './inkWashAssetValidation'

describe('ink-wash asset validation', () => {
  it('rejects duplicate IDs and impossible slice geometry', () => {
    const errors = validateAssetDefinitions([
      { id: 'x', width: 64, height: 64, left: 40, right: 40, top: 12, bottom: 12 },
      { id: 'x', width: 64, height: 64, left: 12, right: 12, top: 12, bottom: 12 },
    ])
    expect(errors).toContain('duplicate asset id: x')
    expect(errors).toContain('x: left + right exceeds source width')
  })

  it('requires exact dimensions and alpha for transparent-center frames', () => {
    expect(validateRasterFacts(
      { id: 'frame-xs-ink-line', sourceWidth: 64, sourceHeight: 64, center: 'transparent' },
      { width: 63, height: 64, centerAlpha: 255 },
    )).toEqual([
      'frame-xs-ink-line: expected 64x64, received 63x64',
      'frame-xs-ink-line: transparent center contains opaque pixels',
    ])
  })
})
```

- [ ] **Step 2: Run the test and confirm the missing-module failure**

Run: `npm.cmd test -- src/assets/inkWashAssetValidation.test.ts`

Expected: FAIL because the validator does not exist.

- [ ] **Step 3: Implement pure validation functions**

Use explicit structural input types. Return `string[]`; do not throw inside the pure functions. Check duplicate IDs, positive integer dimensions, non-negative integer slices, slice sums, exact raster size, a 4-logical-pixel safety inset, and center alpha. The CLI converts non-empty errors into exit code `1`.

- [ ] **Step 4: Implement the Node/canvas pipeline**

`build-ink-wash-assets.mjs` must:

1. resolve all paths from `import.meta.url`;
2. load the JSON manifest;
3. read masters from `art-source/ui/ink-wash/approved/<id>@4x.png`;
4. require master dimensions equal to four times the manifest dimensions;
5. export high-quality `@2x` and `@1x` PNGs with `imageSmoothingQuality = 'high'`;
6. verify transparent-center alpha in the central rectangle for `frame-*` assets;
7. copy six overlay masters without resizing unless their source record requests a target size;
8. pack all `@1x` slice assets into `atlas/ink-wash-ui.png` with 2 px padding and duplicated edge extrusion;
9. write Phaser-compatible atlas frames named by canonical asset ID;
10. copy the manifest to the runtime directory;
11. render `review/ink-wash-ui-size-matrix.png` showing minimum, typical, ultrawide, and tall-narrow samples;
12. support `--check`, which validates existing outputs without rewriting them.

Use the existing `canvas` imports:

```js
import { createCanvas, loadImage } from 'canvas'
import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
```

The atlas JSON frame for each asset must include `frame`, `rotated: false`, `trimmed: false`, `spriteSourceSize`, and `sourceSize`. Do not rotate frames because Phaser slice directions must remain stable.

- [ ] **Step 5: Add package scripts**

```json
"assets:ink-ui": "node scripts/build-ink-wash-assets.mjs",
"assets:ink-ui:check": "node scripts/build-ink-wash-assets.mjs --check"
```

- [ ] **Step 6: Run validation tests**

Run: `npm.cmd test -- src/assets/inkWashAssetValidation.test.ts`

Expected: PASS.

- [ ] **Step 7: Confirm the asset check fails for the right reason**

Run: `npm.cmd run assets:ink-ui:check`

Expected: FAIL with a deterministic list of missing approved masters, beginning with `frame-xs-ink-line@4x.png`; no stack trace for ordinary missing assets.

- [ ] **Step 8: Review checkpoint**

Run: `git diff --check` and inspect `package.json` to confirm no dependency changes. Do not commit.

---

### Task 3: Render and Approve the Style Anchor plus XS/S Assets

**Files:**

- Create: `game/art-source/ui/ink-wash/style-anchor.png`
- Create: `game/art-source/ui/ink-wash/approved/frame-xs-ink-line@4x.png`
- Create: `game/art-source/ui/ink-wash/approved/button-s-paper@4x.png`
- Create: `game/art-source/ui/ink-wash/approved/button-s-ink@4x.png`
- Create: `game/art-source/ui/ink-wash/approved/button-s-seal@4x.png`
- Create: `game/art-source/ui/ink-wash/approved/frame-s-slot@4x.png`
- Create: `game/art-source/ui/ink-wash/README.md`
- Generate: corresponding runtime slice exports and review sheet.

**Interfaces:**

- Consumes: Task 1 dimensions and Task 2 pipeline.
- Produces: five approved small-tier masters with clean stretch regions.

- [ ] **Step 1: Generate the style anchor**

Use built-in ImageGen with the approved concept as visual reference and this exact prompt:

```text
Use case: stylized-concept
Asset type: production style anchor for an ink-wash game UI kit
Primary request: one clean material reference sheet showing warm white xuan paper, carbon-black dry brush, smoky gray wash, a dark ink data surface, cinnabar seal pigment, muted mineral jade, pale azure, and pale mineral gold; arrange as unlabeled swatches and brush samples with generous separation
Style/medium: refined East Asian ink wash on absorbent rice paper, handcrafted but production-clean
Constraints: no readable text, no letters, no numbers, no UI mockup, no characters, no metallic silver, no neon, no watermark
```

Save the approved preview as `style-anchor.png`.

- [ ] **Step 2: Run the pipeline check and capture the five expected small-tier failures**

Run: `npm.cmd run assets:ink-ui:check`

Expected: the five XS/S master IDs are reported missing alongside later tiers.

- [ ] **Step 3: Generate each XS/S master in a separate ImageGen call**

Every call uses: transparent outside background where applicable, no text/icon/character/watermark, orthographic flat UI texture, exact requested aspect ratio, fixed ornate corners, straight calm edge centers, and no decoration crossing the slice lines.

| ID | Exact primary request |
|---|---|
| `frame-xs-ink-line` | A square transparent-center 4x UI frame made from one restrained carbon dry-brush line on transparent background; almost no ornament; all four corner stroke endings inside the outer 48 logical pixels; long straight calm centers on every edge. |
| `button-s-paper` | A wide warm-xuan-paper button texture with transparent outside, carbon ink perimeter, one short asymmetric corner flick, clean paper center, and no baked symbol; designed for a 192×64 logical nine-slice. |
| `button-s-ink` | A wide dense carbon-ink button texture with transparent outside, subtle dry-brush edge, quiet near-black center safe for white live text, and restrained corners; designed for a 192×64 logical nine-slice. |
| `button-s-seal` | A wide neutral grayscale seal-inspired button texture with transparent outside, compressed stamp-like brush perimeter, quiet center, no baked red so code can tint it cinnabar; designed for a 192×64 logical nine-slice. |
| `frame-s-slot` | A square transparent-center slot frame in carbon ink, one small stamp-like corner accent, strong readable silhouette at 56–96 pixels, and clean stretch-safe edge centers; designed for a 96×96 logical nine-slice. |

- [ ] **Step 4: Inspect every generated master at original resolution**

Reject any output with text-like marks, uneven pseudo-letters, opaque frame centers, cut-off corner strokes, modern bevels, periodic edge motifs, or decoration crossing the approved slice boundary.

- [ ] **Step 5: Normalize accepted masters**

Use ImageGen targeted edits only for a single visual defect at a time. Preserve approved corners when correcting a center edge. Save masters at exactly 4x logical dimensions:

- XS: 256×256;
- S buttons: 768×256;
- S slot: 384×384.

- [ ] **Step 6: Build exports and review contact sheet**

Run: `npm.cmd run assets:ink-ui`

Expected: the five small-tier assets export successfully; the command may still fail after export with a clear list of missing M/L/XL masters.

- [ ] **Step 7: Review at actual use sizes**

Open the generated size matrix and approve all of these displays: 24, 32, and 40 px for XS; 40, 44, and 52 px button heights; 56, 72, and 96 px slots. Confirm no seam and no lost corner.

- [ ] **Step 8: Review checkpoint**

Record accepted master filenames and the final ImageGen prompts in `game/art-source/ui/ink-wash/README.md`. Do not commit.

---

### Task 4: Add the Vue Nine-Slice Primitive and Paper/Ink Tokens

**Files:**

- Create: `game/src/components/common/primitives/InkNineSlice.vue`
- Create: `game/src/components/common/primitives/InkNineSlice.test.ts`
- Modify: `game/src/assets/theme.css`
- Modify: `game/src/App.vue`

**Interfaces:**

- Consumes: `InkWashUiAssetId`, `getInkWashUiAsset()`.
- Produces: `<InkNineSlice asset-id layer opacity tint-var />` decorative component.

- [ ] **Step 1: Re-check active worktree overlap**

Run this read-only PowerShell check. If another task still changes `game/src/assets/theme.css` or `game/src/App.vue`, stop and report the exact overlapping path.

```powershell
$entries = git worktree list --porcelain
$paths = foreach ($line in $entries) {
  if ($line -like 'worktree *') { $line.Substring(9) }
}
foreach ($path in $paths) {
  Write-Output "WORKTREE $path"
  git -C $path status --short
}
```

- [ ] **Step 2: Write the failing DOM contract test**

```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { createApp, h } from 'vue'
import InkNineSlice from './InkNineSlice.vue'

describe('InkNineSlice', () => {
  it('renders an inert frame with manifest-derived CSS variables', () => {
    const host = document.createElement('div')
    const app = createApp({
      render: () => h(InkNineSlice, { assetId: 'frame-xs-ink-line', layer: 'frame' }),
    })
    app.mount(host)
    const layer = host.querySelector('[data-ink-slice="frame-xs-ink-line"]') as HTMLElement
    expect(layer.getAttribute('aria-hidden')).toBe('true')
    expect(layer.style.getPropertyValue('--ink-slice-top')).toBe('12')
    expect(layer.style.getPropertyValue('--ink-slice-layer')).toBe('2')
    expect(layer.style.pointerEvents).toBe('none')
    app.unmount()
  })
})
```

- [ ] **Step 3: Run the focused test and confirm failure**

Run: `npm.cmd test -- src/components/common/primitives/InkNineSlice.test.ts`

Expected: FAIL because the component does not exist.

- [ ] **Step 4: Implement `InkNineSlice.vue`**

Props:

```ts
withDefaults(defineProps<{
  assetId: InkWashUiAssetId
  layer?: 'surface' | 'frame'
  opacity?: number
  tintVar?: string
}>(), {
  layer: 'surface',
  opacity: 1,
  tintVar: undefined,
})
```

Compute `image-set()` from `asset.url1x` at `1x` and `asset.url2x` at `2x`, four slice values, `fill` only for filled-center assets, `stretch` or `round`, opacity, and z-layer. Render one `<span aria-hidden="true">`; CSS is absolute, inset `0`, `pointer-events: none`, and uses `border-style: solid` plus `border-image`. Tint only an isolated pseudo-element/mask for tintable frame ink; never multiply the paper center.

- [ ] **Step 5: Add paper/ink tokens**

Add, without deleting existing scene tokens:

```css
--paper-50: #f5f0e4;
--paper-100: #ebe3d2;
--paper-200: #d9cfbb;
--brush-950: #171713;
--brush-800: #2a2924;
--brush-600: #5e5a50;
--brush-400: #8f897c;
--cinnabar: #b54432;
--mineral-jade: #668f78;
--mineral-azure: #66899b;
--mineral-gold: #b79653;
--paper-text: #211f1a;
--paper-text-soft: #5e5a50;
--paper-line: rgba(42, 41, 36, 0.42);
```

Change only non-world fallback surfaces in `App.vue` from `--ink-950` to `--paper-50` and dark text. Do not recolor `DongFuScene` or Phaser battle backgrounds in this task.

- [ ] **Step 6: Run focused and baseline component tests**

Run: `npm.cmd test -- src/components/common/primitives/InkNineSlice.test.ts src/components/common/SlotView.test.ts`

Expected: PASS.

- [ ] **Step 7: Review checkpoint**

Run `git diff --check`; inspect the rendered component in jsdom output and confirm `InkNineSlice` cannot intercept clicks. Do not commit.

---

### Task 5: Integrate XS/S Assets into Shared Vue Primitives

**Files:**

- Modify: `game/src/components/common/GameButton.vue`
- Modify: `game/src/components/common/primitives/Chip.vue`
- Modify: `game/src/components/common/SlotView.vue`
- Modify: `game/src/components/common/NotificationBadge.vue`
- Create: `game/src/components/common/InkWashPrimitives.test.ts`

**Interfaces:**

- Consumes: `InkNineSlice` from Task 4 and XS/S exports from Task 3.
- Produces: unchanged public props/events for all four existing components.

- [ ] **Step 1: Write failing integration tests**

Mount the real SFCs with `createApp`/`h` and assert:

```ts
expect(primary.querySelector('[data-ink-slice="button-s-paper"]')).not.toBeNull()
expect(secondary.querySelector('[data-ink-slice="button-s-ink"]')).not.toBeNull()
expect(danger.querySelector('[data-ink-slice="button-s-seal"]')).not.toBeNull()
expect(chip.querySelector('[data-ink-slice="frame-xs-ink-line"]')).not.toBeNull()
expect(slot.querySelector('[data-ink-slice="frame-s-slot"]')).not.toBeNull()
```

Also click enabled and disabled buttons to prove the decorative layers do not change existing behavior.

- [ ] **Step 2: Run tests and verify they fail on missing slice layers**

Run: `npm.cmd test -- src/components/common/InkWashPrimitives.test.ts src/components/common/SlotView.test.ts`

- [ ] **Step 3: Integrate `GameButton`**

Map variants exactly:

- primary → `button-s-paper`;
- secondary → `button-s-ink`;
- danger → `button-s-seal` with `--cinnabar`;
- ghost → `frame-xs-ink-line` with transparent center;
- circle → retain the code-native circle and add only `frame-xs-ink-line` as an ink ring.

Place the slice below spinner and label. Replace glossy gradients and glow with paper/ink contrast, 1 px pressed translation, and ink-density change. Preserve `accentVar`, loading, disabled, type, size, and click behavior.

- [ ] **Step 4: Integrate Chip, SlotView, and NotificationBadge**

Use the approved mapping. Preserve all rank, validation, marker, badge, keyboard, tooltip, and `aria-*` behavior. For NotificationBadge, keep the semantic cinnabar fill code-rendered and use the XS asset only as a brush perimeter.

- [ ] **Step 5: Run focused tests**

Run: `npm.cmd test -- src/components/common/InkWashPrimitives.test.ts src/components/common/SlotView.test.ts`

Expected: all new and existing tests pass.

- [ ] **Step 6: Run type-check**

Run: `npm.cmd run type-check`

Expected: PASS with no new cast or implicit-`any` error.

- [ ] **Step 7: Visual checkpoint**

Inspect long Vietnamese labels at 90%, 100%, 110%, and 125% UI scale. Confirm ink corners never overlap label/spinner content and all hit areas remain at least 40 px.

- [ ] **Step 8: Review checkpoint**

Run `git diff --check` and review only these primitive files plus tests. Do not commit.

---

### Task 6: Render and Integrate M-Tier Paper Cards and Tooltips

**Files:**

- Create: `game/art-source/ui/ink-wash/approved/surface-m-paper@4x.png`
- Create: `game/art-source/ui/ink-wash/approved/frame-m-seal-corner@4x.png`
- Modify: `game/src/components/common/Tooltip.vue`
- Modify: `game/src/components/game/BuildingDetailPopover.vue`
- Modify: `game/src/components/panels/loadout-sections/TechniqueSlotCard.vue`
- Create: `game/src/components/common/InkWashMediumSurfaces.test.ts`

**Interfaces:**

- Consumes: Task 2 pipeline and Task 4 primitive.
- Produces: reusable M-tier paper surface/frame and representative medium-surface consumers.

- [ ] **Step 1: Confirm the two M masters fail validation as missing**

Run: `npm.cmd run assets:ink-ui:check`

- [ ] **Step 2: Generate both masters in separate calls**

| ID | Exact primary request |
|---|---|
| `surface-m-paper` | A square warm xuan-paper UI surface with transparent outside, subtle fiber, quiet clean center, and one extremely faint smoky wash along a single edge; no border motif, text, symbol, or shadow; designed for a 192×192 logical filled-center nine-slice. |
| `frame-m-seal-corner` | A square transparent-center carbon ink UI frame with two restrained brush lines and one asymmetric stamp-like corner accent; all expressive detail confined to the outer 128 pixels of the 4x master; straight calm middle edges; no baked pigment or text. |

Save at 768×768 each. Reject text-like marks and any dark stain in the content-safe center.

- [ ] **Step 3: Export and inspect M assets**

Run: `npm.cmd run assets:ink-ui`; inspect samples at 160×96, 240×160, 320×260, and 380×600.

- [ ] **Step 4: Write failing M integration tests**

Assert Tooltip and BuildingDetailPopover contain `surface-m-paper` plus `frame-m-seal-corner`, while TechniqueSlotCard contains `frame-m-seal-corner`. Preserve Tooltip Teleport and floating positioning assertions.

- [ ] **Step 5: Integrate M surfaces**

Add surface below content and frame above content. Replace card gradients, chrome borders, and modern shadows with paper text colors and semantic pigment confined to the existing tooltip accent stroke. Do not change max-width, max-height, Floating UI middleware, slots, or events.

- [ ] **Step 6: Run focused tests**

Run: `npm.cmd test -- src/components/common/InkWashMediumSurfaces.test.ts src/components/common/SlotView.test.ts`

- [ ] **Step 7: Visual checkpoint**

Verify plain, technique, material, equipment, and building tooltips. Check 240/320/380 px caps, Alt advanced view, long Vietnamese text, rank 9 gradient text, and viewport flipping.

- [ ] **Step 8: Review checkpoint**

Run `git diff --check`. Do not commit.

---

### Task 7: Render and Integrate L/XL Panels and Ceremonial Surfaces

**Files:**

- Create four L/XL approved masters listed below.
- Modify: `game/src/components/common/GamePanel.vue`
- Modify: `game/src/components/common/OverlayPanel.vue`
- Modify: `game/src/components/common/ConfirmModal.vue`
- Modify: `game/src/components/common/OfflineSummaryModal.vue`
- Modify: `game/src/components/onboarding/AuthEntryScreen.vue`
- Modify: `game/src/components/onboarding/CharacterCreationScreen.vue`
- Modify: `game/src/components/game/combat/CombatVictoryPanel.vue`
- Modify: `game/src/components/game/combat/CombatDefeatPanel.vue`
- Create: `game/src/components/common/InkWashLargeSurfaces.test.ts`

**Interfaces:**

- Produces: shared L/XL shells; existing child components inherit them without individual rewrites.

- [ ] **Step 1: Re-check worktree overlaps for every listed component**

Stop on any active overlap. Preserve unrelated local work.

- [ ] **Step 2: Generate four masters in separate calls**

| ID | Exact primary request |
|---|---|
| `surface-l-ink-data` | A square dark carbon-ink wash data-panel surface with transparent outside, subtly feathered transition at its perimeter, quiet nearly uniform center for pale live text, no border decoration, no text or symbols; designed for a 320×320 logical filled-center nine-slice. |
| `frame-l-landscape` | A square transparent-center ink-wash panel frame with stronger dry-brush corners and sparse rock/cloud fragments confined entirely to fixed 48-pixel logical corner regions; straight calm edge centers, no mountain crossing the stretch zone, no text. |
| `surface-xl-paper-scroll` | A square broad warm xuan-paper ceremonial surface with transparent outside, scroll-like absorbent ink perimeter, very clean center for forms and long copy, no literal scroll rods, no text or symbols; designed for a 512×512 logical filled-center nine-slice. |
| `frame-xl-ceremony` | A square transparent-center ceremonial ink frame with layered brush perimeter, cloud curls and seal-like accents confined to fixed 80-pixel logical corners, elegant asymmetry, clean stretch-safe edge centers, no baked color or text. |

Save L masters at 1280×1280 and XL masters at 2048×2048.

- [ ] **Step 3: Build exports and inspect extreme sizes**

Run: `npm.cmd run assets:ink-ui`. Inspect L at 320×180, 640×420, 900×700; inspect XL at 600×360, 1200×760, and 94vw×94vh.

- [ ] **Step 4: Write failing large-surface tests**

Assert:

- default/compact `GamePanel` contains `surface-m-paper` plus `frame-l-landscape`;
- `GamePanel variant="ornate"` uses `surface-xl-paper-scroll` plus `frame-xl-ceremony`;
- `OverlayPanel` uses XL assets and retains `role="dialog"`, `aria-modal="true"`, backdrop-close, and close-button behavior;
- victory/defeat panels render the ceremonial frame but keep all action buttons and countdown behavior.

- [ ] **Step 5: Integrate shared shells first**

Modify `GamePanel` and `OverlayPanel` before consumers. Preserve component props, slots, flex budgets, container queries, scroll behavior, transitions, and overlay layers. Replace the old `.ornate-frame` visual only after all ornate consumers render the new layer.

- [ ] **Step 6: Integrate direct ceremonial consumers**

Add XL layers to ConfirmModal, onboarding, and result screens only where they do not already inherit GamePanel/OverlayPanel. Never double-frame a consumer.

- [ ] **Step 7: Run focused tests and type-check**

Run: `npm.cmd test -- src/components/common/InkWashLargeSurfaces.test.ts src/components/panels/SettingsPanel.test.ts src/components/layout/LeftPanel.building.test.ts`

Run: `npm.cmd run type-check`

Expected: PASS.

- [ ] **Step 8: Visual checkpoint**

Check panel fit at 1366×768, 1600×900, 2560×1440, and tall-narrow 900×1200. Confirm no double border, no clipped corner, and no loss of close/action controls.

- [ ] **Step 9: Review checkpoint**

Run `git diff --check`. Do not commit.

---

### Task 8: Add the Phaser Atlas Adapter and First Real Consumer

**Files:**

- Create: `game/src/game/support/InkWashUiPhaser.ts`
- Create: `game/src/game/support/InkWashUiPhaser.test.ts`
- Modify: `game/src/game/scenes/TribulationScene.ts`
- Create: `game/src/game/scenes/TribulationScene.inkWashUi.test.ts`

**Interfaces:**

- Consumes: Task 1 manifest and Task 2 atlas.
- Produces: `INK_WASH_UI_ATLAS_KEY`, `queueInkWashUiAtlas(scene)`, and `addInkWashNineSlice(scene, options)`.

- [ ] **Step 1: Write failing preload and factory tests**

```ts
import { describe, expect, it, vi } from 'vitest'
import { addInkWashNineSlice, queueInkWashUiAtlas } from './InkWashUiPhaser'

it('queues the atlas only when missing', () => {
  const atlas = vi.fn()
  const scene = { textures: { exists: () => false }, load: { atlas } } as never
  queueInkWashUiAtlas(scene)
  expect(atlas).toHaveBeenCalledWith(
    'ink-wash-ui',
    'assets/ui/ink-wash/atlas/ink-wash-ui.png',
    'assets/ui/ink-wash/atlas/ink-wash-ui.json',
  )
})

it('passes manifest slices to Phaser nineslice', () => {
  const setOrigin = vi.fn().mockReturnThis()
  const nineslice = vi.fn(() => ({ setOrigin }))
  const scene = { add: { nineslice } } as never
  addInkWashNineSlice(scene, {
    id: 'frame-xl-ceremony', x: 0, y: 0, width: 900, height: 600, origin: 0,
  })
  expect(nineslice).toHaveBeenCalledWith(
    0, 0, 'ink-wash-ui', 'frame-xl-ceremony', 900, 600, 80, 80, 80, 80,
  )
  expect(setOrigin).toHaveBeenCalledWith(0)
})
```

- [ ] **Step 2: Run tests and confirm missing-module failure**

Run: `npm.cmd test -- src/game/support/InkWashUiPhaser.test.ts`

- [ ] **Step 3: Implement the adapter**

```ts
export interface AddInkWashNineSliceOptions {
  id: InkWashUiAssetId
  x: number
  y: number
  width: number
  height: number
  origin?: number
  tint?: number
  alpha?: number
}
```

Use `this.add.nineslice` arguments in the exact documented order. Set `tileX`/`tileY` only when the manifest edge mode is `tile`; initial assets remain stretched. Apply tint only when `asset.tintable` is true. Return `Phaser.GameObjects.NineSlice`.

- [ ] **Step 4: Integrate TribulationScene preload and viewport frame**

- call `queueInkWashUiAtlas(this)` from `preload()`;
- add one `frame-xl-ceremony` at origin `(12, 12)` sized `width - 24` × `height - 24` with origin `0`;
- keep it below lightning/damage VFX and above the background;
- on Phaser scale `resize`, call `setSize(newWidth - 24, newHeight - 24)`;
- remove the resize listener on scene shutdown;
- preserve all existing battle-event subscriptions and animation behavior.

- [ ] **Step 5: Add the scene contract test**

Mock only preload/factory boundaries. Assert queueing, initial dimensions, resize dimensions, and listener cleanup. Do not instantiate a WebGL renderer in Vitest.

- [ ] **Step 6: Run focused tests**

Run: `npm.cmd test -- src/game/support/InkWashUiPhaser.test.ts src/game/scenes/TribulationScene.inkWashUi.test.ts`

- [ ] **Step 7: Manual Phaser verification**

Open the tribulation scene in the running game. Resize through 1366×768, 1600×900, and 900×1200. Confirm corners stay fixed, edges stretch without seams, and the frame never intercepts input.

- [ ] **Step 8: Review checkpoint**

Run `git diff --check`. Do not commit.

---

### Task 9: Render Painting Bridges and Compose Full-Screen Flows

**Files:**

- Create six approved transparent overlay masters.
- Create: `game/src/components/common/InkWashBackdrop.vue`
- Create: `game/src/components/common/InkWashBackdrop.test.ts`
- Modify: `game/src/components/onboarding/AuthEntryScreen.vue`
- Modify: `game/src/components/onboarding/CharacterCreationScreen.vue`
- Modify: `game/src/components/game/combat/CombatVictoryPanel.vue`
- Modify: `game/src/components/game/combat/CombatDefeatPanel.vue`

**Interfaces:**

- Produces: one inert backdrop component with optional left mountain, right mountain, bottom mist, bamboo, and seal layers.

- [ ] **Step 1: Generate each overlay in a separate ImageGen call**

All six calls require actual transparent background, no frame, no text, no characters, no watermark, and generous transparent padding.

| ID | Exact primary request |
|---|---|
| `wash-corner-mountain-left` | A pale carbon-and-smoky-gray ink-wash mountain and pine fragment entering from the lower-left corner, fading completely to transparency toward center and top. |
| `wash-corner-mountain-right` | A distant pale ink-wash mountain and mist fragment entering from the lower-right corner, visually lighter than the left version and fading completely inward. |
| `wash-bottom-mist` | A wide low bank of feathered rice-paper mist and faint rock silhouettes, transparent at top and sides, seamless enough to span the bottom of a 16:9 UI. |
| `wash-bamboo-right` | A sparse black-and-gray bamboo brush study entering from the upper-right edge, with leaves confined near the edge and full transparency toward the content center. |
| `seal-cinnabar-small` | A small abstract square cinnabar stamp texture with no readable glyph, rough absorbent edges, transparent outside. |
| `seal-cinnabar-large` | A larger abstract rectangular cinnabar stamp texture with no readable glyph, weathered rice-paper transfer, transparent outside. |

- [ ] **Step 2: Inspect alpha and content-safe zones**

Reject any pseudo-writing. Ensure every overlay reaches alpha `0` before the documented safe-zone boundary.

- [ ] **Step 3: Write failing backdrop tests**

Assert all images have `alt=""`, `aria-hidden="true"`, `draggable="false"`, and the backdrop root has `pointer-events: none`. Assert props select exact overlay URLs.

- [ ] **Step 4: Implement `InkWashBackdrop.vue`**

Props:

```ts
withDefaults(defineProps<{
  leftMountain?: boolean
  rightMountain?: boolean
  bottomMist?: boolean
  bamboo?: boolean
  seal?: 'none' | 'small' | 'large'
}>(), {
  leftMountain: true,
  rightMountain: false,
  bottomMist: true,
  bamboo: false,
  seal: 'none',
})
```

Render only requested layers. Use absolute positioning and CSS `clamp()`; do not use viewport-hardcoded transforms that break tall-narrow layouts.

- [ ] **Step 5: Compose full-screen flows**

- Auth: left mountain + right bamboo + small seal.
- Character creation: left/right mountain + bottom mist.
- Victory: bottom mist + large cinnabar seal at low opacity.
- Defeat: heavier left mountain + bottom mist, no colored seal.

Keep all form controls and result actions above the inert backdrop.

- [ ] **Step 6: Run focused tests**

Run: `npm.cmd test -- src/components/common/InkWashBackdrop.test.ts src/components/common/InkWashLargeSurfaces.test.ts`

- [ ] **Step 7: Full-screen visual approval checkpoint**

Compare the implemented Auth, Character Creation, Victory, and Defeat screens with the approved concept. The screen must read as one continuous painting, not a set of cards. If it does not, adjust overlay placement/opacity only; do not alter approved nine-slice geometry.

- [ ] **Step 8: Review checkpoint**

Run `git diff --check`. Do not commit.

---

### Task 10: Visual Regression, Documentation, and Final Verification

**Files:**

- Create: `game/tests/e2e/ink-wash-ui.spec.ts`
- Modify: `game/docs/ui-components.md`
- Modify: `game/art-source/ui/ink-wash/README.md`

**Interfaces:**

- Consumes: all completed tasks.
- Produces: repeatable visual smoke coverage, updated component documentation, final handoff evidence.

- [ ] **Step 1: Write the failing Playwright spec**

Cover three viewport profiles:

```ts
const VIEWPORTS = [
  { name: 'desktop', width: 1600, height: 900 },
  { name: 'compact', width: 1366, height: 768 },
  { name: 'tall', width: 900, height: 1200 },
] as const
```

For each size:

- open fresh boot/auth;
- assert no horizontal document overflow;
- assert primary action hit area is at least 40×40;
- assert the XL frame stays inside the viewport;
- capture `ink-wash-auth-<name>.png`;
- create/restore the deterministic fixture from `tests/e2e/helpers.ts`;
- open one GamePanel, one Tooltip, and one result screen;
- capture stable screenshots after animations settle.

Do not use pixel-perfect snapshot thresholds as the only assertion. Add DOM geometry assertions so minor raster resampling does not make the suite flaky.

- [ ] **Step 2: Run the spec and confirm failures before final wiring**

Run: `npm.cmd run test:e2e -- tests/e2e/ink-wash-ui.spec.ts`

Expected before final fixture wiring: FAIL on missing selectors or missing asset layers.

- [ ] **Step 3: Add stable selectors only where necessary**

Use `data-testid` only on root visual shells required by the E2E test. Do not expose internal art-layer implementation through gameplay code.

- [ ] **Step 4: Update `ui-components.md`**

Document:

- the new `InkNineSlice` primitive;
- paper/brush/pigment tokens;
- XS/S/M/L/XL mapping;
- state treatment;
- Vue and Phaser consumption;
- the exact runtime asset directory and manifest;
- the rule that landscape overlays remain separate from stretchable edge centers.

- [ ] **Step 5: Run the deterministic asset check**

Run: `npm.cmd run assets:ink-ui:check`

Expected: PASS for all eleven slice assets, six overlays, atlas frames, metadata, alpha rules, and contact sheets.

- [ ] **Step 6: Run all unit tests**

Run: `npm.cmd test`

Expected: all test files pass.

- [ ] **Step 7: Run type-check**

Run: `npm.cmd run type-check`

Expected: PASS.

- [ ] **Step 8: Run production build**

Run: `npm.cmd run build`

Expected: PASS; emitted bundle resolves all `/assets/ui/ink-wash/` URLs.

- [ ] **Step 9: Run the ink-wash E2E spec**

Run: `npm.cmd run test:e2e -- tests/e2e/ink-wash-ui.spec.ts`

Expected: PASS at all three viewport profiles.

- [ ] **Step 10: Inspect final artifacts**

Open the full-kit contact sheet and the three E2E screenshots. Confirm:

- no slice seam;
- fixed corners remain fixed;
- ornament density grows XS → XL;
- paper centers keep text readable;
- dark data panels retain icon/text contrast;
- the full screen reads as one ink-wash painting;
- semantic states remain distinguishable without color alone.

- [ ] **Step 11: Final diff and worktree report**

Run:

```powershell
git diff --check
git status --short
git diff --stat
```

Report the worktree path, branch, changed files, generated asset counts, verification commands/results, visual review artifacts, and remaining limitations. Do not commit or integrate without explicit coordinator authority; leave the final commit decision to the user.
