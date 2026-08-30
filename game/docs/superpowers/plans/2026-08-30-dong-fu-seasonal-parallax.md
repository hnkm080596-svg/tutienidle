# Động Phủ Seasonal Parallax Implementation Plan

> **For implementation:** REQUIRED SUB-SKILL: Use superpowers:executing-plans and follow this plan task-by-task in the current task worktree. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the literal-cave/four-layer draft with a production-ready outdoor immortal-sect home background composed from ten parallax layers, four seasons, four times of day, shared combat variants, moving cloud/mist, and a fixed central cultivation dais.

**Architecture:** Add a pure `DongFuArt` manifest that maps the existing `ThanhVanVariant` to three time textures and seven season textures. `DongFuScene.vue` consumes this manifest, preloads a complete incoming stack before atomic crossfade, and refreshes from the shared combat cache when home becomes visible. Forty aligned PNG textures provide all sixteen combinations without duplicating full composites.

**Tech Stack:** Vue 3 `<script setup>`, TypeScript 6, Vitest/jsdom, existing `ThanhVanArt` variant module, CSS transforms/animations, built-in ImageGen, ImageMagick for offline alpha conversion and QA compositing.

**Spec:** `game/docs/superpowers/specs/2026-08-30-dong-fu-seasonal-parallax-design.md`

## Global Constraints

- Application root is `game/`; no new dependency and no architecture change outside the home-background flow.
- Canvas is exactly `1672 × 941` for every runtime texture.
- Runtime stack is exactly ten aligned layers: three time layers followed by seven season layers.
- `00-sky.png` is opaque; the other thirty-six textures contain genuine PNG alpha.
- Final palette is Chinese ink painting on ivory paper; no purple or magenta deliverables.
- The outdoor sect geometry, long straight building baseline, large natural ledges and central cultivation dais remain identical across seasons.
- No building, character, UI, text, seal, combat grid or VFX is baked into the background.
- Home reuses `ThanhVanVariant`, `peekThanhVanVariant()`, and the existing QA overrides; it does not create another season/time store.
- `prefers-reduced-motion: reduce` disables pointer parallax, cloud drift, mist drift and animated crossfade.
- Rejected literal-cave assets and their four-layer runtime draft must not be integrated.
- Repository rules prohibit commits, pushes and destructive Git operations. Commit steps from the generic skill are replaced with diff/status review checkpoints.

---

## File Structure

**Create**

- `game/src/game/support/DongFuArt.ts` — pure ten-layer manifest and variant-to-URL mapping.
- `game/src/game/support/DongFuArt.test.ts` — all sixteen mapping/order/depth tests.
- `game/src/game/support/DongFuStackLoader.ts` — atomic browser-image preloader with an injectable single-image loader.
- `game/src/game/support/DongFuStackLoader.test.ts` — complete-success and any-failure loading behavior.
- `game/src/assets/dongFuBackgroundAssets.test.ts` — filesystem, PNG dimension and alpha validation for all forty textures.
- `game/art-source/backgrounds/dong-fu/README.md` — approved master, layer prompts, white-paper-to-alpha workflow and season invariants.
- `game/art-source/backgrounds/dong-fu/approved/dong-fu-master.png` — approved outdoor master with ledges, straight ground and center dais.
- `game/public/assets/backgrounds/dong-fu/modular/README.md` — runtime asset contract.
- `game/public/assets/backgrounds/dong-fu/modular/times/{morning,noon,evening,night}/{00-sky,01-high-clouds,02-light-veil}.png` — twelve time textures.
- `game/public/assets/backgrounds/dong-fu/modular/seasons/{spring,summer,autumn,winter}/{03-far-mountains,04-distant-ledges,05-mid-landscape,06-water-valley,07-sect-ground,08-low-mist,09-foreground}.png` — twenty-eight season textures.
- `game/public/assets/backgrounds/dong-fu/modular/previews/<season>-<time>.png` — sixteen QA composites.
- `game/public/assets/backgrounds/dong-fu/modular/previews/all-16-contact-sheet.png` — visual regression sheet.

**Modify**

- `game/src/components/game/DongFuScene.vue:20-330` — replace the four-layer draft with manifest-driven stacks, shared variant refresh, atomic crossfade and ten parallax depths.
- `game/src/components/game/DongFuScene.test.ts:17-168` — replace four-layer expectations with variant, loading, order, crossfade and reduced-motion behavior.
- `game/public/assets/backgrounds/dong-fu/README.md` — describe the modular outdoor scene and mark older flattened files as legacy/reference only.

**Remove after replacement passes verification**

- `game/public/assets/backgrounds/dong-fu/parallax/00-far-background.png`
- `game/public/assets/backgrounds/dong-fu/parallax/01-mid-cliffs.png`
- `game/public/assets/backgrounds/dong-fu/parallax/02-buildable-ground.png`
- `game/public/assets/backgrounds/dong-fu/parallax/03-foreground-cave.png`
- `game/public/assets/backgrounds/dong-fu/parallax/preview-composite.png`
- `game/public/assets/backgrounds/dong-fu/parallax/preview-master.png`

---

### Task 1: Pure ten-layer Dong Fu manifest

**Files:**
- Create: `game/src/game/support/DongFuArt.ts`
- Create: `game/src/game/support/DongFuArt.test.ts`
- Read: `game/src/game/support/ThanhVanArt.ts`

**Interfaces:**
- Consumes: `ThanhVanVariant`, `ThanhVanSeason`, and `ThanhVanTime` from `./ThanhVanArt`.
- Produces: `DONG_FU_LAYER_COUNT`, `DongFuLayerDescriptor`, and `dongFuLayerList(variant: ThanhVanVariant): readonly DongFuLayerDescriptor[]`.

- [ ] **Step 1: Write the failing manifest tests**

```ts
import { describe, expect, it } from 'vitest'
import { THANH_VAN_SEASONS, THANH_VAN_TIMES } from './ThanhVanArt'
import { DONG_FU_LAYER_COUNT, dongFuLayerList } from './DongFuArt'

describe('DongFuArt', () => {
  it('maps one variant to three time layers then seven season layers', () => {
    const layers = dongFuLayerList({ season: 'winter', time: 'night' })

    expect(layers).toHaveLength(10)
    expect(layers.map((layer) => layer.url)).toEqual([
      '/assets/backgrounds/dong-fu/modular/times/night/00-sky.png',
      '/assets/backgrounds/dong-fu/modular/times/night/01-high-clouds.png',
      '/assets/backgrounds/dong-fu/modular/times/night/02-light-veil.png',
      '/assets/backgrounds/dong-fu/modular/seasons/winter/03-far-mountains.png',
      '/assets/backgrounds/dong-fu/modular/seasons/winter/04-distant-ledges.png',
      '/assets/backgrounds/dong-fu/modular/seasons/winter/05-mid-landscape.png',
      '/assets/backgrounds/dong-fu/modular/seasons/winter/06-water-valley.png',
      '/assets/backgrounds/dong-fu/modular/seasons/winter/07-sect-ground.png',
      '/assets/backgrounds/dong-fu/modular/seasons/winter/08-low-mist.png',
      '/assets/backgrounds/dong-fu/modular/seasons/winter/09-foreground.png',
    ])
    expect(layers.map((layer) => layer.shiftX)).toEqual([0, 1, 2, 4, 6, 8, 10, 12, 14, 18])
    expect(DONG_FU_LAYER_COUNT).toBe(10)
  })

  it('produces ten unique keys for all sixteen variants', () => {
    for (const season of THANH_VAN_SEASONS) {
      for (const time of THANH_VAN_TIMES) {
        const layers = dongFuLayerList({ season, time })
        expect(new Set(layers.map((layer) => layer.key)).size).toBe(10)
      }
    }
  })
})
```

- [ ] **Step 2: Run the test and confirm RED**

Run: `npm.cmd test -- --run src/game/support/DongFuArt.test.ts`

Expected: FAIL because `./DongFuArt` does not exist.

- [ ] **Step 3: Implement the minimal typed manifest**

```ts
import type { ThanhVanVariant } from './ThanhVanArt'

const TIME_LAYERS = [
  { file: '00-sky', shiftX: 0, shiftY: 0, motion: 'static' },
  { file: '01-high-clouds', shiftX: 1, shiftY: 1, motion: 'cloud-slow' },
  { file: '02-light-veil', shiftX: 2, shiftY: 1, motion: 'cloud-medium' },
] as const

const SEASON_LAYERS = [
  { file: '03-far-mountains', shiftX: 4, shiftY: 2, motion: 'static' },
  { file: '04-distant-ledges', shiftX: 6, shiftY: 3, motion: 'static' },
  { file: '05-mid-landscape', shiftX: 8, shiftY: 4, motion: 'static' },
  { file: '06-water-valley', shiftX: 10, shiftY: 5, motion: 'static' },
  { file: '07-sect-ground', shiftX: 12, shiftY: 6, motion: 'static' },
  { file: '08-low-mist', shiftX: 14, shiftY: 7, motion: 'mist-slow' },
  { file: '09-foreground', shiftX: 18, shiftY: 9, motion: 'static' },
] as const

export type DongFuLayerMotion = 'static' | 'cloud-slow' | 'cloud-medium' | 'mist-slow'

export interface DongFuLayerDescriptor {
  key: string
  name: string
  url: string
  shiftX: number
  shiftY: number
  motion: DongFuLayerMotion
}

export const DONG_FU_LAYER_COUNT = TIME_LAYERS.length + SEASON_LAYERS.length

export function dongFuLayerList(variant: ThanhVanVariant): readonly DongFuLayerDescriptor[] {
  return [
    ...TIME_LAYERS.map((layer) => ({
      key: `df-${variant.time}-${layer.file}`,
      name: layer.file,
      url: `/assets/backgrounds/dong-fu/modular/times/${variant.time}/${layer.file}.png`,
      shiftX: layer.shiftX,
      shiftY: layer.shiftY,
      motion: layer.motion,
    })),
    ...SEASON_LAYERS.map((layer) => ({
      key: `df-${variant.season}-${layer.file}`,
      name: layer.file,
      url: `/assets/backgrounds/dong-fu/modular/seasons/${variant.season}/${layer.file}.png`,
      shiftX: layer.shiftX,
      shiftY: layer.shiftY,
      motion: layer.motion,
    })),
  ]
}
```

- [ ] **Step 4: Run the focused test and confirm GREEN**

Run: `npm.cmd test -- --run src/game/support/DongFuArt.test.ts`

Expected: 2 tests pass.

- [ ] **Step 5: Review checkpoint**

Run: `git diff --check -- game/src/game/support/DongFuArt.ts game/src/game/support/DongFuArt.test.ts`

Expected: no whitespace errors. Do not commit.

---

### Task 2: Atomic stack preloader

**Files:**
- Create: `game/src/game/support/DongFuStackLoader.ts`
- Create: `game/src/game/support/DongFuStackLoader.test.ts`

**Interfaces:**
- Consumes: `readonly DongFuLayerDescriptor[]` from Task 1.
- Produces: `type DongFuImageLoader = (url: string) => Promise<void>` and `preloadDongFuStack(layers, loadImage?): Promise<readonly DongFuLayerDescriptor[]>`.

- [ ] **Step 1: Write failing success/failure tests**

```ts
import { describe, expect, it, vi } from 'vitest'
import { preloadDongFuStack } from './DongFuStackLoader'
import { dongFuLayerList } from './DongFuArt'

describe('preloadDongFuStack', () => {
  const layers = dongFuLayerList({ season: 'spring', time: 'morning' })

  it('resolves only after every layer loads', async () => {
    const loadImage = vi.fn(async () => undefined)
    await expect(preloadDongFuStack(layers, loadImage)).resolves.toEqual(layers)
    expect(loadImage).toHaveBeenCalledTimes(10)
  })

  it('rejects the complete stack when any layer fails', async () => {
    const loadImage = vi.fn(async (url: string) => {
      if (url.endsWith('08-low-mist.png')) throw new Error('missing mist')
    })
    await expect(preloadDongFuStack(layers, loadImage)).rejects.toThrow('missing mist')
  })
})
```

- [ ] **Step 2: Run the test and confirm RED**

Run: `npm.cmd test -- --run src/game/support/DongFuStackLoader.test.ts`

Expected: FAIL because `DongFuStackLoader` does not exist.

- [ ] **Step 3: Implement browser loading without new dependencies**

```ts
import type { DongFuLayerDescriptor } from './DongFuArt'

export type DongFuImageLoader = (url: string) => Promise<void>

function loadBrowserImage(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve()
    image.onerror = () => reject(new Error(`Unable to load Dong Fu layer: ${url}`))
    image.src = url
  })
}

export async function preloadDongFuStack(
  layers: readonly DongFuLayerDescriptor[],
  loadImage: DongFuImageLoader = loadBrowserImage,
): Promise<readonly DongFuLayerDescriptor[]> {
  await Promise.all(layers.map((layer) => loadImage(layer.url)))
  return layers
}
```

- [ ] **Step 4: Run Task 1 and Task 2 tests**

Run: `npm.cmd test -- --run src/game/support/DongFuArt.test.ts src/game/support/DongFuStackLoader.test.ts`

Expected: 4 tests pass.

- [ ] **Step 5: Review checkpoint**

Run: `git diff --check -- game/src/game/support/DongFuStackLoader.ts game/src/game/support/DongFuStackLoader.test.ts`

Expected: no whitespace errors. Do not commit.

---

### Task 3: Lock the approved master and write failing asset contracts

**Files:**
- Create: `game/art-source/backgrounds/dong-fu/approved/dong-fu-master.png`
- Create: `game/art-source/backgrounds/dong-fu/README.md`
- Create: `game/src/assets/dongFuBackgroundAssets.test.ts`

**Interfaces:**
- Consumes: `dongFuLayerList()` and the four `ThanhVan` seasons/times.
- Produces: a reproducible art anchor and a filesystem contract that Tasks 4–5 must satisfy.

- [ ] **Step 1: Copy the approved master non-destructively into art source**

Source: `C:\Users\hnkm0\.codex\generated_images\01a04d40-3c47-7643-9761-d0b3dee80e82\exec-5a9e973a-2896-4b2e-b938-572e8e91fd2c.png`

Destination: `game/art-source/backgrounds/dong-fu/approved/dong-fu-master.png`

Do not delete or modify the generated-image source. Confirm with:

```powershell
magick identify -format '%wx%h %[channels]' game/art-source/backgrounds/dong-fu/approved/dong-fu-master.png
```

Expected: `1672x941` and an opaque RGB image.

- [ ] **Step 2: Document the exact invariant prompt and white-paper alpha workflow**

Create `game/art-source/backgrounds/dong-fu/README.md` with these fixed requirements:

```text
Edit target: approved/dong-fu-master.png
Preserve in every season: mountain/ledge silhouettes, river islands, long straight cliff baseline, building gaps, exact center dais, canvas alignment.
Generate each overlay on perfectly uniform white xuan paper with no checkerboard and no colored chroma.
Never add buildings, characters, UI, text, seals, purple or magenta.
Time plates: sky/light only. Season plates: landscape/weather only.
```

Include the season and time treatments verbatim from the design spec.

- [ ] **Step 3: Write the failing filesystem/PNG tests before generating textures**

```ts
// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { THANH_VAN_SEASONS, THANH_VAN_TIMES } from '@/game/support/ThanhVanArt'
import { dongFuLayerList } from '@/game/support/DongFuArt'

const variants = THANH_VAN_SEASONS.flatMap((season) =>
  THANH_VAN_TIMES.map((time) => ({ season, time })),
)
const urls = [...new Set(variants.flatMap((variant) => dongFuLayerList(variant).map((layer) => layer.url)))]

describe('Dong Fu modular background assets', () => {
  it('contains exactly forty aligned runtime PNGs', () => {
    expect(urls).toHaveLength(40)
    for (const url of urls) {
      const png = readFileSync(resolve(__dirname, `../../public${url}`))
      expect([...png.subarray(0, 8)], url).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      expect(png.readUInt32BE(16), url).toBe(1672)
      expect(png.readUInt32BE(20), url).toBe(941)
      const isSky = url.endsWith('/00-sky.png')
      expect(png[25], url).toBe(isSky ? 2 : 6)
    }
  })
})
```

- [ ] **Step 4: Run the asset test and confirm RED**

Run: `npm.cmd test -- --run src/assets/dongFuBackgroundAssets.test.ts`

Expected: FAIL with `ENOENT` for the first missing modular texture.

- [ ] **Step 5: Review checkpoint**

Run: `git status --short -- game/art-source/backgrounds/dong-fu game/src/assets/dongFuBackgroundAssets.test.ts`

Expected: only the approved master, README and failing contract test are new. Do not commit.

---

### Task 4: Produce the twelve time textures

**Files:**
- Create: `game/public/assets/backgrounds/dong-fu/modular/times/morning/*.png`
- Create: `game/public/assets/backgrounds/dong-fu/modular/times/noon/*.png`
- Create: `game/public/assets/backgrounds/dong-fu/modular/times/evening/*.png`
- Create: `game/public/assets/backgrounds/dong-fu/modular/times/night/*.png`

**Interfaces:**
- Consumes: approved master and art-source prompt contract from Task 3.
- Produces: four opaque skies plus eight transparent time overlays used by `dongFuLayerList()`.

- [ ] **Step 1: Generate four opaque sky plates with built-in ImageGen**

Issue one ImageGen edit call per time using the approved master as reference. Each prompt must preserve the `1672 × 941` alignment and remove all landscape, ground, dais and foreground content. Output only paper sky/light:

```text
morning: warm ivory dawn, low luminous horizon, soft gray-gold cloud wash
noon: pale white xuan paper, crisp high light, neutral smoke-gray clouds
evening: restrained antique-gold and cinnabar horizon, charcoal cloud undersides
night: charcoal-indigo ink sky, moonlit ivory paper highlights, no neon blue
```

Copy the selected files to each `times/<time>/00-sky.png` path.
Normalize each selected sky with `magick input.png PNG24:00-sky.png` so the asset contract records it as opaque PNG color type `2`.

- [ ] **Step 2: Generate eight white-paper overlay plates**

For each time, issue separate ImageGen calls for:

```text
01-high-clouds: only long high cloud bands, exact full canvas, pure uniform white background, no landscape or light veil
02-light-veil: only diffuse horizon light and distant haze, exact full canvas, pure uniform white background, no distinct clouds or landscape
```

Use the time-specific treatment from Step 1. Do not request transparency from ImageGen; request uniform white paper so no checkerboard/chroma is baked.

- [ ] **Step 3: Convert the eight white-paper plates to genuine alpha**

For every overlay plate, derive alpha from distance to white and preserve ink color. Use a task-local temporary directory under `.tmp-dong-fu-alpha/`, never write intermediates into `public/`. The conversion must produce RGBA PNG color type `6`; verify with `magick identify` before copying to the final path.

Use this ImageMagick channel workflow for each plate:

```powershell
magick input.png -fx "1-min(r,min(g,b))" alpha.png
magick input.png alpha.png -fx "aa=u[1].r; aa<0.01?0:max(0,min(1,(u[0].r-(1-aa))/aa))" red.png
magick input.png alpha.png -fx "aa=u[1].r; aa<0.01?0:max(0,min(1,(u[0].g-(1-aa))/aa))" green.png
magick input.png alpha.png -fx "aa=u[1].r; aa<0.01?0:max(0,min(1,(u[0].b-(1-aa))/aa))" blue.png
magick red.png green.png blue.png alpha.png -combine output.png
```

- [ ] **Step 4: Verify only the remaining season assets are missing**

Run: `npm.cmd test -- --run src/assets/dongFuBackgroundAssets.test.ts`

Expected: FAIL with `ENOENT` under `modular/seasons/`; no time texture may be the reported failure.

- [ ] **Step 5: Visual review checkpoint**

Composite each time sky with its two overlays over a white canvas. Check morning/noon/evening/night side by side for no purple, no checkerboard, no landscape leakage, aligned clouds and readable night values. Do not commit.

---

### Task 5: Produce the twenty-eight seasonal landscape textures

**Files:**
- Create: `game/public/assets/backgrounds/dong-fu/modular/seasons/spring/*.png`
- Create: `game/public/assets/backgrounds/dong-fu/modular/seasons/summer/*.png`
- Create: `game/public/assets/backgrounds/dong-fu/modular/seasons/autumn/*.png`
- Create: `game/public/assets/backgrounds/dong-fu/modular/seasons/winter/*.png`

**Interfaces:**
- Consumes: approved master geometry and Task 3 prompt contract.
- Produces: seven aligned RGBA layers per season; every season preserves the same ground, ledges, building gaps and dais coordinates.

- [ ] **Step 1: Generate four full seasonal QA masters first**

Use one precise ImageGen edit per season. Preserve all geometry and change only vegetation/weather/seasonal surface treatment:

```text
spring: pale jade shoots, restrained blossoms, light rain mist
summer: deeper ink, full pines, stronger water, humid cloud
autumn: warm earth, restrained cinnabar leaves, clearer dry air
winter: near-monochrome ink, snow caps, sparse trees, cold fog
```

Reject and regenerate any result that moves the center dais, bends the long baseline, changes ledge silhouettes, adds buildings, or introduces purple/magenta.

- [ ] **Step 2: Extract seven white-paper plates from each approved seasonal master**

Issue one built-in ImageGen edit per requested plate and season, always preserving exact full-canvas placement:

```text
03-far-mountains: only pale far peak silhouettes
04-distant-ledges: only substantial far rock ledges and their sparse pines
05-mid-landscape: only middle cliffs, mountains, pines and waterfalls
06-water-valley: only river, islands, reflections and valley haze
07-sect-ground: only the long straight foreground cliff, clean building gaps and exact center cultivation dais
08-low-mist: only layered low cloud/mist ribbons crossing the landscape
09-foreground: only near rocks, branches, shrubs and bottom-edge mist
```

Every plate uses perfectly uniform white xuan paper; no checkerboard and no colored chroma.

- [ ] **Step 3: Convert all twenty-eight plates to RGBA**

Use the exact white-paper-to-alpha commands from Task 4 Step 3. Confirm each final texture is `1672 × 941`, channel set `srgba`, PNG color type `6`, and visually clean over both ivory and charcoal test backgrounds.

- [ ] **Step 4: Run the asset contract and confirm GREEN**

Run: `npm.cmd test -- --run src/assets/dongFuBackgroundAssets.test.ts`

Expected: 1 test passes; forty unique assets validated.

- [ ] **Step 5: Geometry review checkpoint**

Composite each season over the same morning time stack and overlay fixed guide lines for:

```text
straight buildable baseline: unchanged y-coordinate across the full central span
cultivation dais: unchanged center x/y and width
large left/right ledges: unchanged top-edge positions
clean building gaps: unchanged anchor regions
```

Reject any season that drifts. Do not “fix” drift by changing runtime hotspot coordinates per season.

---

### Task 6: Generate sixteen QA composites and contact sheet

**Files:**
- Create: `game/public/assets/backgrounds/dong-fu/modular/previews/*.png`
- Create: `game/public/assets/backgrounds/dong-fu/modular/README.md`

**Interfaces:**
- Consumes: all forty textures from Tasks 4–5.
- Produces: sixteen flattened review images and one contact sheet; none are runtime-loaded.

- [ ] **Step 1: Compose every season/time combination in manifest order**

For each combination, composite layers `00` through `09` with ImageMagick `over` composition and write `<season>-<time>.png`. The output remains `1672 × 941` and opaque.

- [ ] **Step 2: Build the labeled 4 × 4 contact sheet**

Rows: spring, summer, autumn, winter. Columns: morning, noon, evening, night. Labels sit outside the art cells so no text contaminates previews.

- [ ] **Step 3: Inspect full-resolution edge cases**

Check at minimum:

```text
spring/morning: base ink-and-paper balance
summer/noon: highlight clipping and saturated greens
autumn/evening: ochre/cinnabar stacking without orange washout
winter/night: readable black values, snow separation and no neon blue
```

Also inspect all transparent layers on light and dark solid backgrounds for white halos, checkerboard, purple/magenta spill and cut-off bleed.

- [ ] **Step 4: Document runtime versus QA files**

`modular/README.md` must state the ten-layer order, source counts, canvas, alpha contract, season/time roles, shared combat variant, and that `previews/` is QA-only.

- [ ] **Step 5: Review checkpoint**

Run: `git status --short -- game/public/assets/backgrounds/dong-fu/modular game/art-source/backgrounds/dong-fu`

Expected: exactly the art-source anchor/docs, forty runtime textures, sixteen previews, one contact sheet and modular README. Do not commit.

---

### Task 7: Render ten layers and shared variant in `DongFuScene`

**Files:**
- Modify: `game/src/components/game/DongFuScene.test.ts`
- Modify: `game/src/components/game/DongFuScene.vue`
- Consume: `game/src/game/support/DongFuArt.ts`
- Consume: `game/src/game/support/DongFuStackLoader.ts`
- Consume: `game/src/game/support/ThanhVanArt.ts`

**Interfaces:**
- Consumes: `dongFuLayerList()`, `preloadDongFuStack()`, `peekThanhVanVariant()`, and reactive `stageActive`.
- Produces: ten-layer active stack, optional previous stack during crossfade, atomic refresh on return from combat.

- [ ] **Step 1: Replace four-layer tests with failing ten-layer behavior**

Add assertions that initial spring/morning renders exactly ten URLs in manifest order and that the DOM exposes `data-layer`, `data-season`, `data-time`, and motion class names. Preserve the existing character-trigger test.

```ts
expect(mounted.layers()).toHaveLength(10)
expect(mounted.layers().map((layer) => layer.dataset.layer)).toEqual([
  '00-sky', '01-high-clouds', '02-light-veil', '03-far-mountains',
  '04-distant-ledges', '05-mid-landscape', '06-water-valley',
  '07-sect-ground', '08-low-mist', '09-foreground',
])
```

- [ ] **Step 2: Add a failing shared-variant refresh test**

Stub only the `useStageActive()` boundary with a controllable ref-like object, and install a fake global `Image` whose queued instances expose `onload`/`onerror`. Mount home at spring/morning, set stage-active to true, call `commitThanhVanVariant({ season: 'winter', time: 'night' })`, set stage-active to false, then resolve nine queued image loads and assert the old stack remains intact. Resolve the tenth load and assert the active URLs switch atomically to winter/night.

- [ ] **Step 3: Add a failing load-error preservation test**

Make one incoming image reject and assert the complete spring/morning stack remains active with no winter/night layer mixed in.

- [ ] **Step 4: Run focused tests and confirm RED**

Run: `npm.cmd test -- --run src/components/game/DongFuScene.test.ts`

Expected: FAIL because the component still uses the superseded four-layer constants and never reads `ThanhVanVariant`.

- [ ] **Step 5: Implement manifest-driven stacks**

Represent each rendered stack explicitly so its layer URLs and metadata always refer to the same variant:

```ts
interface DongFuRenderStack {
  variant: ThanhVanVariant
  layers: readonly DongFuLayerDescriptor[]
}

function createRenderStack(variant: ThanhVanVariant): DongFuRenderStack {
  return { variant, layers: dongFuLayerList(variant) }
}

const activeStack = ref<DongFuRenderStack>(createRenderStack(peekThanhVanVariant()))
const previousStack = ref<DongFuRenderStack | null>(null)
const transitionActive = ref(false)
let refreshGeneration = 0
```

Watch `stageActive`; when it becomes false, compare `peekThanhVanVariant()` to `activeStack.value.variant`. Preload every layer in a newly created incoming stack, discard stale generations, then move `activeStack` to `previousStack`, install the incoming stack atomically, and set `transitionActive`. On rejection, keep the current stack unchanged.

- [ ] **Step 6: Render active and previous stacks with stable metadata**

Use one wrapper per stack and one `<img>` per descriptor. Bind:

```vue
:data-layer="layer.name"
:data-season="stack.variant.season"
:data-time="stack.variant.time"
:class="[`home-scene__parallax-layer--${layer.motion}`]"
:style="parallaxStyle(layer)"
```

The previous wrapper receives `is-leaving`; the active wrapper receives `is-entering`. Both stay below cultivation aura, motes, character and vignette.

- [ ] **Step 7: Run focused tests and confirm GREEN**

Run: `npm.cmd test -- --run src/components/game/DongFuScene.test.ts src/game/support/DongFuArt.test.ts src/game/support/DongFuStackLoader.test.ts`

Expected: all focused tests pass.

- [ ] **Step 8: Review checkpoint**

Run: `git diff --check -- game/src/components/game/DongFuScene.vue game/src/components/game/DongFuScene.test.ts`

Expected: no whitespace errors. Do not commit.

---

### Task 8: Cloud/mist motion, reduced motion and transition cleanup

**Files:**
- Modify: `game/src/components/game/DongFuScene.test.ts`
- Modify: `game/src/components/game/DongFuScene.vue`

**Interfaces:**
- Consumes: `DongFuLayerMotion`, `shiftX`, `shiftY`, `transitionActive` from Task 7.
- Produces: pointer depth, three independent drift rates, whole-stack crossfade and reduced-motion zero-motion behavior.

- [ ] **Step 1: Write failing motion tests**

Assert at maximum pointer position:

```ts
expect(byLayer('00-sky').style.getPropertyValue('--parallax-x')).toBe('0px')
expect(byLayer('03-far-mountains').style.getPropertyValue('--parallax-x')).toBe('-4px')
expect(byLayer('09-foreground').style.getPropertyValue('--parallax-x')).toBe('-18px')
```

Assert motion classes exist only on `01-high-clouds`, `02-light-veil`, and `08-low-mist`.

- [ ] **Step 2: Write a failing reduced-motion test**

With `matchMedia('(prefers-reduced-motion: reduce)').matches === true`, dispatch pointer movement and assert all ten `--parallax-x/y` values remain `0px`; assert stack wrappers receive a no-motion class and previous stack cleanup occurs without waiting for animation.

- [ ] **Step 3: Run the test and confirm RED**

Run: `npm.cmd test -- --run src/components/game/DongFuScene.test.ts`

Expected: FAIL on ten-layer depth or drift/reduced-motion expectations.

- [ ] **Step 4: Add scoped CSS motion**

Implement separate keyframes with small percentages so the full-canvas bleed hides edges:

```css
.home-scene__parallax-layer--cloud-slow { animation: dong-fu-cloud-slow 48s ease-in-out infinite alternate; }
.home-scene__parallax-layer--cloud-medium { animation: dong-fu-cloud-medium 36s ease-in-out infinite alternate; }
.home-scene__parallax-layer--mist-slow { animation: dong-fu-mist-slow 28s ease-in-out infinite alternate; }

@keyframes dong-fu-cloud-slow { to { translate: 0.8% 0; } }
@keyframes dong-fu-cloud-medium { to { translate: -1.1% 0.2%; } }
@keyframes dong-fu-mist-slow { to { translate: 1.4% -0.2%; } }
```

Keep pointer parallax on a wrapper or compose it with CSS variables so animation does not overwrite the transform.

- [ ] **Step 5: Add stack crossfade and reduced-motion CSS**

Crossfade opacity for the complete wrapper, not individual images. In the reduced-motion media query set animations/transitions to `none` and transforms to zero.

- [ ] **Step 6: Run focused tests and confirm GREEN**

Run: `npm.cmd test -- --run src/components/game/DongFuScene.test.ts`

Expected: all scene tests pass.

- [ ] **Step 7: Manual browser QA**

Run: `npm.cmd run dev`

Check home at representative viewports and each deterministic override. Confirm no exposed edges, no per-layer flash, no pointer hit-test regression on the character, and cloud/mist motion remains slow and unobtrusive.

---

### Task 9: Remove superseded draft, update documentation and run full verification

**Files:**
- Modify: `game/public/assets/backgrounds/dong-fu/README.md`
- Remove: `game/public/assets/backgrounds/dong-fu/parallax/` six rejected draft files listed above.
- Verify all files from Tasks 1–8.

**Interfaces:**
- Consumes: completed modular asset and runtime stack.
- Produces: clean task diff containing only the approved outdoor seasonal system.

- [ ] **Step 1: Update the root Dong Fu README**

Document the outdoor sect interpretation, modular folder, shared variant, ten-layer runtime order, central dais, separate building art contract, QA preview locations, and the fact that older flattened `thanh-van-dong-fu-*.png` files are not runtime textures.

- [ ] **Step 2: Verify exact removal targets, then remove only the rejected draft directory**

Before removal run:

```powershell
Resolve-Path game/public/assets/backgrounds/dong-fu/parallax
Get-ChildItem game/public/assets/backgrounds/dong-fu/parallax | Select-Object Name
```

The resolved path must remain inside the task worktree and contain only the six rejected files listed in this plan. Then remove that directory. Do not remove `modular/` or legacy tracked references.

- [ ] **Step 3: Run focused verification**

```powershell
npm.cmd test -- --run src/game/support/DongFuArt.test.ts src/game/support/DongFuStackLoader.test.ts src/assets/dongFuBackgroundAssets.test.ts src/components/game/DongFuScene.test.ts
```

Expected: all focused files pass with zero failed tests.

- [ ] **Step 4: Run full project verification**

```powershell
npm.cmd test -- --run
npm.cmd run type-check
npm.cmd run build
```

Expected: 0 failed tests; type-check exits `0`; production build exits `0`.

- [ ] **Step 5: Inspect final diff and asset inventory**

```powershell
git status --short
git diff --check
git diff --stat
$runtimeTextures = Get-ChildItem -LiteralPath game/public/assets/backgrounds/dong-fu/modular/times,game/public/assets/backgrounds/dong-fu/modular/seasons -Filter '*.png' -Recurse
$runtimeTextures | ForEach-Object { magick identify -format '%f %wx%h %[channels]\n' $_.FullName }
```

Confirm there are exactly forty runtime textures, all `1672 × 941`, four opaque sky images and thirty-six RGBA overlays. Confirm the final diff contains no `.tmp-*`, chroma source, rejected cave art or unrelated project changes.

- [ ] **Step 6: Integration safety check**

Before any primary-worktree integration, inspect current primary branch, status and the exact target paths. If primary or another active worktree now changes `DongFuScene.vue`, its test, `DongFuArt*`, `DongFuStackLoader*`, or `public/assets/backgrounds/dong-fu/`, stop and report the overlap. Never stash, overwrite or discard unrelated user changes.

- [ ] **Step 7: Post-integration verification**

After coordinator-approved integration, rerun the focused test command, `npm.cmd run type-check`, and `npm.cmd run build` in the primary worktree. Leave all changes uncommitted for the user.
