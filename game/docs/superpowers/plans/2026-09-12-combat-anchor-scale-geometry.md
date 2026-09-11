# Combat Anchor & Scale Geometry — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (project convention per P6 — Inline Execution). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Size a combat entity by the **character** its art draws rather than by the art's bounding box, and compute the five body anchors from the **battlefield cell** rather than from each artwork.

**Architecture:** Two pure functions in `src/presentation/geometry/` — `resolveEntityDisplaySize()` (scale) and `bodyAnchor()` (anchors) — plus one measured datum, `ArtExtent`, carried on the presentation catalogue and guarded against the atlas JSON on disk. `combat-grid-view.ts` stops carrying two copies of the sizing formula; `combat-reward-gourd.ts` and the debug overlay stop reading a hand-authored anchor table. No gameplay, no core, no timing.

**Tech Stack:** Vue 3 + TypeScript + Vite + Vitest + Phaser + Playwright (no new dependencies).

**Spec:** `game/docs/superpowers/specs/2026-09-12-combat-anchor-scale-geometry-design.md`

## Global Constraints

- Run every command from `game/`. All paths in this plan are relative to `game/`.
- Worktree `E:\tutienidle\.agent-worktrees\frontend-boundary`, branch `feat/combat-anchor-geometry`. **P1:** no edits outside it.
- **P3 quick** per task: `npm.cmd run type-check` + `npx.cmd vitest run <scope>`. Task 7 runs the full gate.
- **P7:** every task's commit command is written out but **NOT executed** until the user authorizes.
- **P8:** no new `any`. **P15:** new/edited code comments in English, plain ASCII only. **P16:** no new user-facing strings here at all.
- **P14:** steps that change pixels require Playwright, not jsdom. Tasks 3 and 6 say so explicitly.
- **P17:** this plan touches presentation only. Nothing under `src/core/` changes. If a task seems to need a core edit, stop and report.
- **E2E port:** always `DEV_PORT=5182 npx.cmd playwright test ...`. Port 5175 is served by the main checkout and a run there silently tests master's code (this cost a false 17/17 earlier on this branch).
- Spec decisions that are INVARIANT: anchors read nothing about the art (§3.1); `extent` is used by scale only (§4.1); `ENEMY_NEUTRAL_BODY_ANCHOR` is deleted in Task 6 and not before (§6); `PlayerVisualProfile.bodyAnchors` and `SpriteBodyAnchor.ts` are **not deleted** (§4.4).
- Known pre-existing flake, not caused by this work: `src/core/battle/turn/TurnBattleSystem.selfBuff.qa.test.ts` fails roughly 1 run in 5. Do not "fix" it inside this plan (P12: pre-existing, and P17: it is core).

## File Structure

**Created:**
- `src/presentation/geometry/combatEntityScale.ts` — `ArtExtent` consumers' sizing maths; one responsibility: turn a cell width + depth + class + extent into display and person sizes.
- `src/presentation/geometry/combatEntityScale.test.ts`
- `src/presentation/geometry/combatBodyAnchors.ts` — the five directional anchors from a body box. Deliberately a separate file from the scale maths: they share numbers but answer different questions, and the guard in Task 5 asserts this one cannot see a texture.
- `src/presentation/geometry/combatBodyAnchors.test.ts`
- `tests/architecture/artExtentDeclared.test.ts` — extent-vs-atlas-JSON guard.

**Modified:**
- `src/presentation/art/CombatEntityPresentation.ts` — add `ArtExtent`, add `extent` to `AtlasClip` and `StaticEntityArt` (Task 1)
- `src/presentation/art/CombatPresentationCatalogue.ts` — populate both (Task 1)
- `src/game/scenes/combat/combat-grid-view.ts` — both sizing methods call the resolver (Task 3)
- `src/game/scenes/combat/combatTypes.ts` — `EntitySprite` carries its resolved person size (Task 4)
- `src/game/scenes/combat/combat-reward-gourd.ts` — `centre` from the slot (Task 6)
- `src/game/scenes/combat/combat-vfx-spawner.ts` — debug overlay takes slot anchors (Task 6)
- `src/game/scenes/combat/combatConstants.ts` — delete `ENEMY_NEUTRAL_BODY_ANCHOR` (Task 6)
- `tests/e2e/combat-idle-motion-capture.spec.ts` — assert character height, not box height (Task 7)

---

## Task 1: `ArtExtent` on the catalogue, measured and guarded

**Files:**
- Modify: `src/presentation/art/CombatEntityPresentation.ts`
- Modify: `src/presentation/art/CombatPresentationCatalogue.ts`
- Create: `tests/architecture/artExtentDeclared.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `ArtExtent { x: number; y: number; w: number; h: number }` exported from `CombatEntityPresentation.ts`; `AtlasClip.extent: ArtExtent`; `StaticEntityArt.extent: ArtExtent`.

Data only. Nothing reads `extent` until Task 2, which is why this task cannot change a pixel.

The placeholder atlas's frames are trimmed differently per frame (the figure breathes). The clip declares **one** extent — taken from the **tallest** frame, because that is the frame that must still fit when the box is sized from it. `game/public/assets/characters/placeholder/combat-anim-32frame.json` is the source; the tallest `spriteSourceSize.h` there is **278** (`frame_007`, at x56 y33 w88), against
`sourceSize` 200x350 — so the four fractions are 0.28 / 0.0943 / 0.44 / 0.7943.

- [ ] **Step 1: Write the failing guard**

Create `tests/architecture/artExtentDeclared.test.ts`:

```ts
/**
 * Guard (Spec C §5) — the declared extent is the box the art actually occupies.
 *
 * Spec: docs/superpowers/specs/2026-09-12-combat-anchor-scale-geometry-design.md
 * §4.1 and §5.
 *
 * This is the datum that sizes every animated character (§3.2). When the size
 * came from a different file than the pixels did, the player rendered 3.44x too
 * wide and nothing failed (commit c0826723). This guard reads the atlas JSON on
 * disk so that cannot recur silently.
 *
 * Guards police app code, so they re-read the catalogue's constants from source
 * rather than importing it — the same rule `atlasFramesExist.test.ts` follows.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { SCAN_TIMEOUT } from './helpers/scanTs'

const GAME_ROOT = process.cwd()

const CATALOGUE_SOURCE = join(
  GAME_ROOT,
  'src',
  'presentation',
  'art',
  'CombatPresentationCatalogue.ts',
)

const source = readFileSync(CATALOGUE_SOURCE, 'utf8')

function numberConstant(name: string): number {
  const match = new RegExp(`export const ${name} = ([\\d.]+)`).exec(source)

  if (!match) {
    throw new Error(`constant ${name} not found in CombatPresentationCatalogue.ts`)
  }

  return Number(match[1])
}

function stringConstant(name: string): string {
  const match = new RegExp(`export const ${name} = '([^']*)'`).exec(source)

  if (!match) {
    throw new Error(`constant ${name} not found in CombatPresentationCatalogue.ts`)
  }

  return match[1]!
}

interface AtlasFrame {
  spriteSourceSize: { x: number; y: number; w: number; h: number }
  sourceSize: { w: number; h: number }
}

const atlas = JSON.parse(
  readFileSync(join(GAME_ROOT, 'public', stringConstant('PLACEHOLDER_ATLAS_URL')), 'utf8'),
) as { frames: Record<string, AtlasFrame> }

/** The frame whose art is tallest — the one the declared extent must describe. */
function tallestFrame(): AtlasFrame {
  return Object.values(atlas.frames).reduce((tallest, frame) =>
    frame.spriteSourceSize.h > tallest.spriteSourceSize.h ? frame : tallest,
  )
}

describe('declared art extent', () => {
  it(
    'the placeholder clip extent matches the tallest frame in the atlas on disk',
    () => {
      const frame = tallestFrame()

      expect(numberConstant('PLACEHOLDER_EXTENT_X')).toBeCloseTo(
        frame.spriteSourceSize.x / frame.sourceSize.w,
        4,
      )
      expect(numberConstant('PLACEHOLDER_EXTENT_Y')).toBeCloseTo(
        frame.spriteSourceSize.y / frame.sourceSize.h,
        4,
      )
      expect(numberConstant('PLACEHOLDER_EXTENT_W')).toBeCloseTo(
        frame.spriteSourceSize.w / frame.sourceSize.w,
        4,
      )
      expect(numberConstant('PLACEHOLDER_EXTENT_H')).toBeCloseTo(
        frame.spriteSourceSize.h / frame.sourceSize.h,
        4,
      )
    },
    SCAN_TIMEOUT,
  )

  it(
    'the placeholder art is genuinely trimmed, so the extent path is exercised',
    () => {
      // An extent of {0,0,1,1} would make every formula in §3.2 collapse to the
      // old box-sizing behaviour, and this guard would pass while proving
      // nothing. Enemies legitimately have that; the placeholder must not.
      expect(numberConstant('PLACEHOLDER_EXTENT_H')).toBeLessThan(1)
      expect(numberConstant('PLACEHOLDER_EXTENT_W')).toBeLessThan(1)
    },
    SCAN_TIMEOUT,
  )
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx.cmd vitest run tests/architecture/artExtentDeclared.test.ts`
Expected: FAIL with `constant PLACEHOLDER_EXTENT_X not found in CombatPresentationCatalogue.ts`.

- [ ] **Step 3: Add the type**

In `src/presentation/art/CombatEntityPresentation.ts`, above `AtlasClip`:

```ts
/**
 * Where the character's own pixels sit inside the authored box, as fractions of
 * that box — the atlas's `spriteSourceSize` normalised by `sourceSize`.
 *
 * Measured from the art, never hand-written. Used by SCALE alone (Spec C §4.1):
 * anchors do not read it, because they come from the battlefield cell (§3.1).
 *
 * `{ x: 0, y: 0, w: 1, h: 1 }` for untrimmed art, which makes every formula in
 * §3.2 collapse to sizing the box directly.
 */
export interface ArtExtent {
  x: number
  y: number
  w: number
  h: number
}
```

Add to `AtlasClip`, directly after its existing `sourceSize` field:

```ts
  /**
   * The character's own box inside `sourceSize`. One per clip, taken from the
   * TALLEST frame: a per-frame extent would resize the character every frame,
   * which is a defect rather than a feature.
   */
  extent: ArtExtent
```

Add to `StaticEntityArt`, after its `sourceSize`:

```ts
  /** Untrimmed PNGs occupy their whole box; see `ArtExtent`. */
  extent: ArtExtent
```

- [ ] **Step 4: Populate both in the catalogue**

In `src/presentation/art/CombatPresentationCatalogue.ts`, beside the other
`PLACEHOLDER_*` constants:

```ts
/**
 * The placeholder figure's own box inside the 200x350 authored frame, as
 * fractions, taken from the tallest frame the generator emits.
 *
 * Checked against the atlas JSON by tests/architecture/artExtentDeclared.test.ts,
 * so regenerating the art with different margins fails a test rather than
 * silently resizing every character (Spec C §2.3).
 */
export const PLACEHOLDER_EXTENT_X = 0.28
export const PLACEHOLDER_EXTENT_Y = 0.0943
export const PLACEHOLDER_EXTENT_W = 0.44
export const PLACEHOLDER_EXTENT_H = 0.7943
```

Add `extent` to the object returned by `clip()`, after `sourceSize`:

```ts
      extent: {
        x: PLACEHOLDER_EXTENT_X,
        y: PLACEHOLDER_EXTENT_Y,
        w: PLACEHOLDER_EXTENT_W,
        h: PLACEHOLDER_EXTENT_H,
      },
```

And add `extent` to the static enemy entry, after its `sourceSize`:

```ts
        // The Mortal PNGs are untrimmed: the animal fills its own file.
        extent: { x: 0, y: 0, w: 1, h: 1 },
```

- [ ] **Step 5: Run the guard and the type-check**

Run: `npx.cmd vitest run tests/architecture/artExtentDeclared.test.ts`
Expected: PASS, 2 tests.

If the numbers disagree, the guard prints the expected value — take it from the
failure and correct the constants. Do **not** relax the guard.

Run: `npm.cmd run type-check`
Expected: no output (clean).

- [ ] **Step 6: Probe the guard red**

Temporarily set `PLACEHOLDER_EXTENT_H = 1`, run the guard, confirm **both** tests
fail, then restore `0.7943`. A guard nobody has seen fail proves nothing (Spec A §7).

Run: `npx.cmd vitest run tests/architecture/artExtentDeclared.test.ts`
Expected while probing: FAIL, 2 failed.

- [ ] **Step 7: Run the affected suites**

Run: `npx.cmd vitest run src/presentation/art tests/architecture`
Expected: PASS.

- [ ] **Step 8: Commit (P7 — do not run without authorization)**

```bash
git add src/presentation/art/CombatEntityPresentation.ts src/presentation/art/CombatPresentationCatalogue.ts tests/architecture/artExtentDeclared.test.ts
git commit -m "feat(combat): declare the box the art actually occupies

Spec C §4.1. Data only: nothing reads it yet, so no pixel moves.

One extent per clip, from the TALLEST frame — a per-frame extent would
resize the character on every frame. Guarded against the atlas JSON on
disk, because this is the datum whose absence let the player render
3.44x too wide (c0826723)."
```

---

## Task 2: `resolveEntityDisplaySize()` — the scale maths, called by nothing

**Files:**
- Create: `src/presentation/geometry/combatEntityScale.ts`
- Create: `src/presentation/geometry/combatEntityScale.test.ts`

**Interfaces:**
- Consumes: `ArtExtent` from Task 1.
- Produces:
  ```ts
  export const PERSON_HEIGHT_IN_CELLS = 1.84
  export const PERSON_WIDTH_IN_CELLS = 0.42
  export interface EntityScaleInput {
    nearCellWidth: number
    depthScale: number
    classFactor: number
    extent: ArtExtent
    sourceSize: { w: number; h: number }
  }
  export interface EntityDisplaySize {
    boxWidth: number
    boxHeight: number
    personWidth: number
    personHeight: number
  }
  export function resolveEntityDisplaySize(input: EntityScaleInput): EntityDisplaySize
  ```

- [ ] **Step 1: Write the failing tests**

Create `src/presentation/geometry/combatEntityScale.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  PERSON_HEIGHT_IN_CELLS,
  resolveEntityDisplaySize,
  type EntityScaleInput,
} from './combatEntityScale'

const UNTRIMMED = { x: 0, y: 0, w: 1, h: 1 }

/** The measured battlefield: near cell 94.49px, enemy row depth 0.70735. */
function enemyInput(overrides: Partial<EntityScaleInput> = {}): EntityScaleInput {
  return {
    nearCellWidth: 94.49,
    depthScale: 0.70735,
    classFactor: 1,
    extent: UNTRIMMED,
    sourceSize: { w: 1254, h: 1254 },
    ...overrides,
  }
}

describe('resolveEntityDisplaySize', () => {
  it('reproduces the existing enemy size exactly — this change is a no-op for real art', () => {
    // Spec C §3.2: PERSON_HEIGHT_IN_CELLS is 0.92 x 2, the product of the two
    // magic numbers already in the tree. Enemies must not move by a pixel, which
    // is what makes a visible change in step 3 attributable to the player alone.
    const size = resolveEntityDisplaySize(enemyInput())

    expect(size.personHeight).toBeCloseTo(122.98, 1)
    expect(size.boxHeight).toBeCloseTo(122.98, 1)
  })

  it('specifies the CHARACTER height and lets the box be whatever makes it true', () => {
    // The assertion whose absence let c0826723 ship.
    const trimmed = resolveEntityDisplaySize(
      enemyInput({ extent: { x: 0.28, y: 0.0943, w: 0.44, h: 0.7943 } }),
    )
    const untrimmed = resolveEntityDisplaySize(enemyInput())

    expect(trimmed.personHeight).toBeCloseTo(untrimmed.personHeight, 5)
    expect(trimmed.boxHeight).toBeGreaterThan(untrimmed.boxHeight)
    expect(trimmed.boxHeight).toBeCloseTo(untrimmed.personHeight / 0.7943, 4)
  })

  it('keeps the box at the art aspect ratio, so nothing is stretched', () => {
    const size = resolveEntityDisplaySize(enemyInput({ sourceSize: { w: 200, h: 350 } }))

    expect(size.boxWidth / size.boxHeight).toBeCloseTo(200 / 350, 5)
  })

  it('a boss is twice a person; an ordinary enemy and the player are equal', () => {
    const ordinary = resolveEntityDisplaySize(enemyInput())
    const boss = resolveEntityDisplaySize(enemyInput({ classFactor: 2 }))

    // The player differs only in its ART, never in its class.
    const player = resolveEntityDisplaySize(
      enemyInput({ extent: { x: 0.28, y: 0.0943, w: 0.44, h: 0.7943 }, sourceSize: { w: 200, h: 350 } }),
    )

    expect(player.personHeight).toBeCloseTo(ordinary.personHeight, 5)
    expect(boss.personHeight).toBeCloseTo(ordinary.personHeight * 2, 5)
  })

  it('scales with depth, so a far entity is smaller', () => {
    const near = resolveEntityDisplaySize(enemyInput({ depthScale: 1 }))
    const far = resolveEntityDisplaySize(enemyInput({ depthScale: 0.5 }))

    expect(far.personHeight).toBeCloseTo(near.personHeight / 2, 5)
  })

  it('person width comes from the cell, not from the art', () => {
    // Spec C §3.2: front/back anchors use this, and it must not depend on how
    // wide a particular drawing happens to be.
    const wide = resolveEntityDisplaySize(enemyInput({ sourceSize: { w: 2000, h: 350 } }))
    const narrow = resolveEntityDisplaySize(enemyInput({ sourceSize: { w: 100, h: 350 } }))

    expect(wide.personWidth).toBeCloseTo(narrow.personWidth, 5)
  })

  it('the calibration constant is the product the tree already had', () => {
    expect(PERSON_HEIGHT_IN_CELLS).toBeCloseTo(0.92 * 2, 5)
  })

  it('refuses an extent that would divide by zero', () => {
    expect(() => resolveEntityDisplaySize(enemyInput({ extent: { x: 0, y: 0, w: 1, h: 0 } }))).toThrow(
      /extent\.h/,
    )
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx.cmd vitest run src/presentation/geometry/combatEntityScale.test.ts`
Expected: FAIL — cannot resolve `./combatEntityScale`.

- [ ] **Step 3: Write the implementation**

Create `src/presentation/geometry/combatEntityScale.ts`:

```ts
// combatEntityScale — how big a combat entity is drawn.
//
// Spec C §3.2/§4.3
// (docs/superpowers/specs/2026-09-12-combat-anchor-scale-geometry-design.md).
//
// A pure module: no Phaser, no GameObject, no scene. It lives beside
// BattleGridProjection for the same reason that one does — it is arithmetic, and
// arithmetic should be testable without a canvas (Spec A §3.6).
//
// THE CLAIM THIS FILE MAKES, and the reason it exists: what gets specified is
// the size of the CHARACTER, and the sprite's box is whatever it has to be to
// make that true. Sizing the box instead is how the player came to render 3.44x
// too wide while every test stayed green (c0826723).
import type { ArtExtent } from '@/presentation/art/CombatEntityPresentation'

/**
 * An adult person stands this many near-row cell widths tall.
 *
 * The near cell's WIDTH is the ruler because the cell's HEIGHT is
 * perspective-compressed and is not a ruler for anything upright — a reason the
 * tree already carried in a comment and never turned into a number.
 *
 * 1.84 is not a new guess: it is 0.92 (the old `characterHeight` factor) times 2
 * (the old `ENEMY_DISPLAY_SCALE_MULTIPLIER`), so existing enemy art renders at
 * bit-identical size. Measured 2026-09-12 at 1600x900: near cell 94.49px, enemy
 * at depth 0.70735 rendered 122.98px, and 122.98 / (94.49 * 0.70735) = 1.840.
 */
export const PERSON_HEIGHT_IN_CELLS = 1.84

/**
 * And this many across. Used ONLY by the front/back body anchors.
 *
 * This one has no anchor in the existing code — nothing ever expressed a
 * person's width for a Sprite (`CHARACTER_WIDTH_RATIO` is a health-bar
 * measurement). 0.42 is a judgement from looking at the enemy art, and Spec C
 * §8 records that it is the weakest number in the design.
 */
export const PERSON_WIDTH_IN_CELLS = 0.42

export interface EntityScaleInput {
  /** Width of a cell on the NEAR row. The ruler; see PERSON_HEIGHT_IN_CELLS. */
  nearCellWidth: number

  /** Perspective factor for the entity's own row (near = 1). */
  depthScale: number

  /** 1 for a person, 2 for a boss. The only thing class changes. */
  classFactor: number

  /** How much of its authored box the art fills. */
  extent: ArtExtent

  /** The authored box, for aspect ratio only. */
  sourceSize: { w: number; h: number }
}

export interface EntityDisplaySize {
  /** What to pass to setDisplaySize — the whole authored box. */
  boxWidth: number
  boxHeight: number

  /** The character inside it. What the anchors and the design talk about. */
  personWidth: number
  personHeight: number
}

export function resolveEntityDisplaySize(input: EntityScaleInput): EntityDisplaySize {
  if (input.extent.h <= 0) {
    throw new Error('resolveEntityDisplaySize: extent.h must be greater than zero')
  }

  const unit = input.nearCellWidth * input.depthScale * input.classFactor

  const personHeight = unit * PERSON_HEIGHT_IN_CELLS
  const personWidth = unit * PERSON_WIDTH_IN_CELLS

  // The division is the whole design: the box grows to accommodate the art's
  // empty margin so that the CHARACTER lands at personHeight.
  const boxHeight = personHeight / input.extent.h
  const boxWidth = boxHeight * (input.sourceSize.w / input.sourceSize.h)

  return { boxWidth, boxHeight, personWidth, personHeight }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx.cmd vitest run src/presentation/geometry/combatEntityScale.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Probe two assertions red**

Temporarily change `const boxHeight = personHeight / input.extent.h` to
`const boxHeight = personHeight`, run the suite, confirm the "specifies the
CHARACTER height" test fails, then restore it.

Temporarily change `PERSON_WIDTH_IN_CELLS` usage to derive from `sourceSize.w`,
confirm "person width comes from the cell" fails, then restore.

Run: `npx.cmd vitest run src/presentation/geometry/combatEntityScale.test.ts`
Expected while probing: FAIL on exactly the named test each time.

- [ ] **Step 6: Type-check**

Run: `npm.cmd run type-check`
Expected: clean.

- [ ] **Step 7: Commit (P7 — do not run without authorization)**

```bash
git add src/presentation/geometry/combatEntityScale.ts src/presentation/geometry/combatEntityScale.test.ts
git commit -m "feat(presentation): one resolver for combat entity size

Spec C §3.2/§4.3. Pure arithmetic, called by nothing yet, so no pixel
moves.

States the design as a claim that can be checked: a person stands
PERSON_HEIGHT_IN_CELLS near-cell widths tall, and the sprite's box is
whatever makes that true. 1.84 turns out to be 0.92 x 2 — the product of
the two magic numbers already in the tree, so real enemy art is a
bit-exact no-op."
```

---

## Task 3: `combat-grid-view.ts` calls the resolver — the only step that moves pixels

**Files:**
- Modify: `src/game/scenes/combat/combat-grid-view.ts` (`applySpriteSize`, `applyEntityDepthScale`)
- Modify: `src/game/scenes/combat/combatTypes.ts` (`EntitySprite` gains `extent`)

**Interfaces:**
- Consumes: `resolveEntityDisplaySize`, `EntityDisplaySize` (Task 2); `ArtExtent` (Task 1).
- Produces: `EntitySprite.extent?: ArtExtent`.

**P14 applies from here on.** jsdom cannot see this. The unit tests below pin the
wiring; Task 7's Playwright run is what proves the pixels.

The two methods currently each carry their own copy of the sizing formula, which
is how they came to disagree about `sourceSize`. Both now call the resolver.

`classFactor` maps from the existing multipliers: `sizeMultiplier` 2 becomes
`classFactor` 1, and 4 becomes 2. Keep `sizeMultiplier` as the stored field —
renaming it is a bigger refactor than this task, and P9 says not to.

- [ ] **Step 1: Add `extent` to `EntitySprite`**

In `src/game/scenes/combat/combatTypes.ts`, after the existing `sourceSize` field:

```ts
  /**
   * How much of its authored box this sprite's art fills (Spec C §4.1).
   *
   * Undefined for a Rectangle fallback and for the Tran Phap preview panel,
   * where it defaults to a full box — those cases have no trimmed art.
   */
  extent?: { x: number; y: number; w: number; h: number }
```

- [ ] **Step 2: Write the failing test**

Append to `src/game/scenes/combat/combat-grid-view.test.ts`:

```ts
describe('CombatGridView — size is the character, not the box (Spec C §3.2)', () => {
  function perspectiveHost() {
    const { scene, gridView } = createFakeScene()

    scene.isPerspective = true
    scene.projection = {
      rows: 10,
      columns: 16,
      gridToScreen: () => ({ x: 100, y: 200, scale: 0.70735 }),
      cellSizeAt: () => ({ width: 94.49, height: 41.4 }),
      footprintPolygon: () => [],
    }

    return { scene, gridView }
  }

  it('trimmed art gets a BIGGER box so the character lands at the same height', () => {
    const { gridView } = perspectiveHost()

    const untrimmed = gridView.getOrCreateSprite('mortal_wild_boar_1', 0xd94a4a, 'Boar', 4, {
      currentHp: 10,
      maxHp: 10,
      isBoss: false,
    })

    const boxHeight = (untrimmed.rect as unknown as { setDisplaySize: ReturnType<typeof vi.fn> })
      .setDisplaySize.mock.calls.at(-1)![1] as number

    // The boar's PNG is untrimmed, so its box IS its character height. Spec C
    // §3.2's calibration says that must stay 122.98 at this depth.
    expect(boxHeight).toBeCloseTo(122.98, 0)
  })
})
```

Note: `createFakeScene()`'s `chainable()` already records `setDisplaySize` — if it
does not, add `setDisplaySize: vi.fn(() => obj)` to it alongside `setPosition`.

- [ ] **Step 3: Run to verify it fails**

Run: `npx.cmd vitest run src/game/scenes/combat/combat-grid-view.test.ts`
Expected: FAIL — either `setDisplaySize.mock` is undefined (fix the stub as noted)
or the height is the old value.

- [ ] **Step 4: Rewrite both sizing methods**

In `src/game/scenes/combat/combat-grid-view.ts`, add the import:

```ts
import { resolveEntityDisplaySize } from '@/presentation/geometry/combatEntityScale'
```

Add a private helper on `CombatGridView`:

```ts
  /**
   * Spec C §4.3 — one place that turns a sprite into a size.
   *
   * `sizeMultiplier` is the OLD field and keeps its stored values (2 for a
   * person, 4 for a boss); `classFactor` is what the resolver speaks, where a
   * person is 1. Halving here rather than renaming the field keeps this task to
   * one responsibility (P9).
   */
  private entityDisplaySize(sprite: EntitySprite, depthScale: number) {
    const sourceSize = sprite.sourceSize ?? this.host.playerSourceSize

    return resolveEntityDisplaySize({
      nearCellWidth: this.host.projection
        ? this.host.projection.cellSizeAt(this.host.projection.rows - 1).width
        : this.host.characterHeight,
      depthScale,
      classFactor: sprite.sizeMultiplier / 2,
      extent: sprite.extent ?? { x: 0, y: 0, w: 1, h: 1 },
      sourceSize,
    })
  }
```

Replace the `sprite.kind === 'sprite'` branch of `applySpriteSize` with:

```ts
    if (sprite.kind === 'sprite') {
      const size = this.entityDisplaySize(sprite, 1)
      const gameSprite = sprite.rect as Phaser.GameObjects.Sprite

      gameSprite.setDisplaySize(size.boxWidth, size.boxHeight)
      sprite.personHeight = size.personHeight
      sprite.personWidth = size.personWidth

      return
    }
```

Replace the `sprite.kind === 'sprite'` branch of `applyEntityDepthScale` with:

```ts
    if (sprite.kind === 'sprite') {
      const size = this.entityDisplaySize(sprite, Math.max(0.05, depthScale * sprite.boost.value))
      const gameSprite = sprite.rect as Phaser.GameObjects.Sprite

      gameSprite.setDisplaySize(size.boxWidth, size.boxHeight)
      sprite.personHeight = size.personHeight
      sprite.personWidth = size.personWidth
    } else {
```

Leave the Rectangle branch, the health-bar block and the shadow block exactly as
they are — they are HUD geometry, not body geometry (Spec C §3.2).

- [ ] **Step 5: Add the two fields `EntitySprite` now stores**

In `src/game/scenes/combat/combatTypes.ts`, beside `extent`:

```ts
  /**
   * The character's size on screen, as resolved by Spec C §4.3 — NOT the
   * sprite's box. Task 4's anchors read these, and storing them here is what
   * stops the two halves computing them differently.
   */
  personWidth?: number
  personHeight?: number
```

- [ ] **Step 6: Populate `extent` where sprites are created**

In `getOrCreateSprite`, the player branch already sets `sourceSize` from
`playerArtSourceSize()`. Add a sibling helper beside it:

```ts
/** The art's own box inside its authored frame, for the entity being drawn. */
function artExtentFor(entityKey: string): { x: number; y: number; w: number; h: number } | undefined {
  const presentation = presentationFor(entityKey)

  if (presentation?.kind === 'animated') {
    return { ...presentation.clips.idle.extent }
  }

  if (presentation?.kind === 'static') {
    return { ...presentation.texture.extent }
  }

  return undefined
}
```

Add `extent: artExtentFor(this.host.playerProfile.combatTextureKey),` to the
player sprite literal, and `extent: artExtentFor(enemyTextureKey),` to the enemy
sprite literal. Leave the host-fallback branch without one — the Tran Phap panel
has no trimmed art to describe.

- [ ] **Step 7: Run to verify it passes**

Run: `npx.cmd vitest run src/game/scenes/combat/combat-grid-view.test.ts`
Expected: PASS.

Run: `npx.cmd vitest run src/game/scenes`
Expected: PASS. If `CombatScene.enemyScale.test.ts` or `CombatScene.playerScale.test.ts`
fails, read the assertion before changing it: an enemy expectation that moved is a
REGRESSION (§3.2 promises bit-exact), a player expectation that moved is the
intended +25.9%. Update only the latter, and say which in the commit.

- [ ] **Step 8: Type-check**

Run: `npm.cmd run type-check`
Expected: clean.

- [ ] **Step 9: See it (P14)**

Run: `DEV_PORT=5182 npx.cmd playwright test tests/e2e/combat-idle-motion-capture.spec.ts`
Expected: PASS.

Then open `test-results/combat-idle-motion/frame-3.png` and look. The player
should stand at comparable height to the boar rather than noticeably shorter.
A green test here proves the aspect ratio; only the image proves the height.

- [ ] **Step 10: Commit (P7 — do not run without authorization)**

```bash
git add src/game/scenes/combat/combat-grid-view.ts src/game/scenes/combat/combatTypes.ts src/game/scenes/combat/combat-grid-view.test.ts
git commit -m "feat(combat): size entities by the character, not by the art box

Spec C §4.3, step 3 of §6 — the one step that moves pixels.

Both sizing methods carried their own copy of the formula, which is how
they came to disagree about sourceSize. They now share one resolver.

Enemies are bit-exact unchanged (§3.2 calibration); the player grows
25.9%, because its placeholder fills only 79.4% of its authored box and
the old code sized the box."
```

---

## Task 4: `bodyAnchor()` — the five anchors from the slot, called by nothing

**Files:**
- Create: `src/presentation/geometry/combatBodyAnchors.ts`
- Create: `src/presentation/geometry/combatBodyAnchors.test.ts`

**Interfaces:**
- Consumes: nothing (deliberately — §3.1 forbids it reading art).
- Produces:
  ```ts
  export type BodyAnchorId = 'top' | 'bottom' | 'centre' | 'front' | 'back'
  export type Facing = 'right' | 'left'
  export interface BodyBox {
    footX: number
    footY: number
    personWidth: number
    personHeight: number
    facing: Facing
  }
  export interface AnchorPoint { x: number; y: number }
  export function bodyAnchor(id: BodyAnchorId, body: BodyBox): AnchorPoint
  ```

- [ ] **Step 1: Write the failing tests**

Create `src/presentation/geometry/combatBodyAnchors.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { bodyAnchor, type BodyBox } from './combatBodyAnchors'

function body(overrides: Partial<BodyBox> = {}): BodyBox {
  return {
    footX: 100,
    footY: 200,
    personWidth: 40,
    personHeight: 120,
    facing: 'right',
    ...overrides,
  }
}

describe('bodyAnchor', () => {
  it('bottom is the foot point itself', () => {
    expect(bodyAnchor('bottom', body())).toEqual({ x: 100, y: 200 })
  })

  it('top is a person height above the feet', () => {
    expect(bodyAnchor('top', body())).toEqual({ x: 100, y: 80 })
  })

  it('centre is exactly halfway between them', () => {
    const top = bodyAnchor('top', body())
    const bottom = bodyAnchor('bottom', body())
    const centre = bodyAnchor('centre', body())

    expect(centre.y).toBeCloseTo((top.y + bottom.y) / 2, 5)
    expect(centre.x).toBe(100)
  })

  it('front leads the facing direction and back trails it', () => {
    const right = body({ facing: 'right' })

    expect(bodyAnchor('front', right).x).toBe(120)
    expect(bodyAnchor('back', right).x).toBe(80)
  })

  it('front and back SWAP when facing does, so an enemy faces the player', () => {
    // The one piece of state in an otherwise pure derivation. Getting it
    // backwards puts every enemy's effects behind it, which looks deliberate
    // until somebody stares at it (Spec C §4.2).
    const left = body({ facing: 'left' })

    expect(bodyAnchor('front', left).x).toBe(80)
    expect(bodyAnchor('back', left).x).toBe(120)
  })

  it('facing does not move top, bottom or centre', () => {
    for (const id of ['top', 'bottom', 'centre'] as const) {
      expect(bodyAnchor(id, body({ facing: 'right' }))).toEqual(
        bodyAnchor(id, body({ facing: 'left' })),
      )
    }
  })

  it('front and back sit at centre height', () => {
    const centre = bodyAnchor('centre', body())

    expect(bodyAnchor('front', body()).y).toBe(centre.y)
    expect(bodyAnchor('back', body()).y).toBe(centre.y)
  })

  it('two entities on one cell get identical anchors whatever their art', () => {
    // Spec C §5: this is what makes "one mechanism" true rather than claimed.
    // The function takes no art, so the only way to fail this is to add one.
    const wolf = body()
    const player = body()

    for (const id of ['top', 'bottom', 'centre', 'front', 'back'] as const) {
      expect(bodyAnchor(id, wolf)).toEqual(bodyAnchor(id, player))
    }
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx.cmd vitest run src/presentation/geometry/combatBodyAnchors.test.ts`
Expected: FAIL — cannot resolve `./combatBodyAnchors`.

- [ ] **Step 3: Write the implementation**

Create `src/presentation/geometry/combatBodyAnchors.ts`:

```ts
// combatBodyAnchors — the five points on a combat entity that effects attach to.
//
// Spec C §3.1/§4.2
// (docs/superpowers/specs/2026-09-12-combat-anchor-scale-geometry-design.md).
//
// THEY COME FROM THE BATTLEFIELD CELL, NOT FROM THE ART. Nothing here reads a
// texture, a frame, a trim offset or a sprite transform, and that is the whole
// design rather than a simplification of it:
//
//   - it is UNIFORM: an enemy outside the Mortal art batch renders as a
//     Rectangle and has no art to measure, and used to need a separate hardcoded
//     path for exactly that reason;
//   - it is STABLE: an art-derived anchor moves as the character breathes, so an
//     effect pinned to the head would jitter with the idle bob;
//   - it CANNOT GO STALE: there is no datum describing the art, so there is no
//     datum that can describe the wrong art — which is the defect that motivated
//     this spec.
//
// What it gives up, knowingly: the anchors describe a notional body standing in
// a cell, not the character drawn in it. An effect at `front` leaves a body edge,
// not the actual hand. "Lech khong quan trong" — the product owner's call.
export type BodyAnchorId = 'top' | 'bottom' | 'centre' | 'front' | 'back'

/** Which way the entity faces. The player faces right; enemies face left. */
export type Facing = 'right' | 'left'

export interface BodyBox {
  /** Projected foot point at the centre of the entity's cell. */
  footX: number
  footY: number

  /** Character size, from combatEntityScale — NOT the sprite's box. */
  personWidth: number
  personHeight: number

  facing: Facing
}

export interface AnchorPoint {
  x: number
  y: number
}

export function bodyAnchor(id: BodyAnchorId, body: BodyBox): AnchorPoint {
  const midY = body.footY - body.personHeight / 2
  const halfW = body.personWidth / 2

  // Screen y grows downward, so "up" is subtraction.
  switch (id) {
    case 'bottom':
      return { x: body.footX, y: body.footY }
    case 'top':
      return { x: body.footX, y: body.footY - body.personHeight }
    case 'centre':
      return { x: body.footX, y: midY }
    case 'front':
      return { x: body.facing === 'right' ? body.footX + halfW : body.footX - halfW, y: midY }
    case 'back':
      return { x: body.facing === 'right' ? body.footX - halfW : body.footX + halfW, y: midY }
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx.cmd vitest run src/presentation/geometry/combatBodyAnchors.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Probe the facing assertion red**

Temporarily drop the facing check from `front`/`back` (always `+halfW` /
`-halfW`), run the suite, confirm "front and back SWAP" fails, then restore.

Run: `npx.cmd vitest run src/presentation/geometry/combatBodyAnchors.test.ts`
Expected while probing: FAIL on "front and back SWAP when facing does".

- [ ] **Step 6: Type-check and commit (P7 — do not run without authorization)**

Run: `npm.cmd run type-check`
Expected: clean.

```bash
git add src/presentation/geometry/combatBodyAnchors.ts src/presentation/geometry/combatBodyAnchors.test.ts
git commit -m "feat(presentation): five body anchors computed from the cell

Spec C §3.1/§4.2. Called by nothing yet.

The function takes no art — no texture, frame, trim or sprite transform.
That is the design: uniform across Sprite and Rectangle entities, stable
across animation frames, and impossible to make stale, because there is
no datum describing art that could describe the wrong art."
```

---

## Task 5: `CombatScene` exposes a body box per entity

**Files:**
- Modify: `src/game/scenes/CombatScene.ts` (add `bodyBoxFor`, replace `getPlayerBodyAnchorScreen`)
- Modify: `src/game/scenes/combat/combat-player-visual.ts`

**Interfaces:**
- Consumes: `bodyAnchor`, `BodyBox`, `BodyAnchorId`, `Facing` (Task 4); `EntitySprite.personWidth/personHeight` (Task 3).
- Produces on `CombatScene`:
  ```ts
  bodyAnchorScreen(entityId: string, id: BodyAnchorId): AnchorPoint | undefined
  ```

One accessor, used by both consumers in Task 6. It replaces
`getPlayerBodyAnchorScreen(anchorId)`, which only ever answered for the player.

Facing rule: `PLAYER_ID` faces `'right'`, everything else faces `'left'`. That is
the battlefield's layout — the player stands on the left column and enemies
advance from the right.

- [ ] **Step 1: Write the failing test**

Create `src/game/scenes/CombatScene.bodyAnchors.test.ts`:

```ts
// @vitest-environment jsdom
//
// Spec C §4.2 — the scene turns an entity id into a body box and asks
// combatBodyAnchors for a point. No Phaser runtime needed: the sprite's
// personWidth/personHeight are set by the grid view (Task 3) and read here.
import { describe, expect, it } from 'vitest'
import { createTestScene } from './combat/combatTestHarness'
import { PLAYER_ID } from './combat/combatConstants'

function sceneWith(id: string, row: number) {
  const scene = createTestScene('bare')

  scene.sprites = new Map()
  scene.isPerspective = true
  scene.projection = {
    rows: 10,
    columns: 16,
    gridToScreen: () => ({ x: 300, y: 500, scale: 1 }),
    cellSizeAt: () => ({ width: 94.49, height: 41.4 }),
    footprintPolygon: () => [],
  }

  scene.sprites.set(id, {
    kind: 'sprite',
    rect: { x: 300, y: 500 },
    row,
    footY: 500,
    columnFloat: 8,
    personWidth: 40,
    personHeight: 120,
    boost: { value: 1 },
  })

  return scene
}

describe('CombatScene.bodyAnchorScreen()', () => {
  it('bottom is the foot point; top is a person height above it', () => {
    const scene = sceneWith(PLAYER_ID, 4)

    expect(scene.bodyAnchorScreen(PLAYER_ID, 'bottom')).toEqual({ x: 300, y: 500 })
    expect(scene.bodyAnchorScreen(PLAYER_ID, 'top')).toEqual({ x: 300, y: 380 })
  })

  it('the player faces right and an enemy faces left', () => {
    const player = sceneWith(PLAYER_ID, 4)
    const enemy = sceneWith('mortal_wild_boar_1', 6)

    expect(player.bodyAnchorScreen(PLAYER_ID, 'front')!.x).toBe(320)
    expect(enemy.bodyAnchorScreen('mortal_wild_boar_1', 'front')!.x).toBe(280)
  })

  it('an entity with no sprite yields undefined rather than a guess', () => {
    const scene = sceneWith(PLAYER_ID, 4)

    expect(scene.bodyAnchorScreen('nobody', 'centre')).toBeUndefined()
  })

  it('a Rectangle fallback still gets anchors — it stands in a cell like anything else', () => {
    // The uniformity claim in Spec C §3.1, asserted rather than described.
    const scene = sceneWith('mortal_unknown_1', 5)
    const sprite = scene.sprites.get('mortal_unknown_1')

    sprite.kind = 'rect'

    expect(scene.bodyAnchorScreen('mortal_unknown_1', 'centre')).toEqual({ x: 300, y: 440 })
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx.cmd vitest run src/game/scenes/CombatScene.bodyAnchors.test.ts`
Expected: FAIL — `scene.bodyAnchorScreen is not a function`.

- [ ] **Step 3: Implement on `CombatScene`**

Add the import:

```ts
import {
  bodyAnchor,
  type AnchorPoint,
  type BodyAnchorId,
  type BodyBox,
} from '@/presentation/geometry/combatBodyAnchors'
```

Replace `getPlayerBodyAnchorScreen` (`CombatScene.ts:1164`) with:

```ts
  /**
   * Spec C §4.2 — a body anchor in screen space, for any entity.
   *
   * Replaces getPlayerBodyAnchorScreen(), which could only answer for the
   * player and read a hand-authored table describing the profile's static PNG
   * rather than the art actually on screen.
   *
   * Works for a Rectangle fallback as well as a Sprite: the anchors describe a
   * notional body standing in a cell, and a Rectangle stands in one too.
   */
  bodyAnchorScreen(entityId: string, id: BodyAnchorId): AnchorPoint | undefined {
    const box = this.bodyBoxFor(entityId)

    return box ? bodyAnchor(id, box) : undefined
  }

  private bodyBoxFor(entityId: string): BodyBox | undefined {
    const sprite = this.sprites.get(entityId)

    if (!sprite) {
      return undefined
    }

    // Fall back to the character baseline when the grid view has not sized this
    // sprite yet (first frame after spawn). Better an anchor at the default body
    // size than none at all.
    const personHeight = sprite.personHeight ?? this.characterHeight
    const personWidth = sprite.personWidth ?? this.characterWidth

    return {
      footX: sprite.rect.x,
      footY: sprite.footY,
      personWidth,
      personHeight,
      facing: entityId === PLAYER_ID ? 'right' : 'left',
    }
  }
```

- [ ] **Step 4: Point the debug overlay at it**

In `src/game/scenes/combat/combat-player-visual.ts`, delete
`playerTransformSnapshot()` and `getPlayerBodyAnchorScreen()` entirely, and delete
the now-unused imports of `resolveSpriteBodyAnchor` and `getBodyAnchors`.

Leave the rest of the class alone.

- [ ] **Step 5: Run to verify it passes**

Run: `npx.cmd vitest run src/game/scenes/CombatScene.bodyAnchors.test.ts`
Expected: PASS, 4 tests.

Run: `npm.cmd run type-check`
Expected: two errors, both in `combat-vfx-spawner.ts` and
`combat-reward-gourd.ts`, which still call the removed method. Task 6 fixes them —
this is the compiler naming the exact call sites to migrate, which is why the
method was removed before its callers.

- [ ] **Step 6: Commit (P7 — do not run without authorization)**

Do not commit a tree that does not type-check. Fold this commit into Task 6, or
complete Task 6 first and commit both together.

---

## Task 6: The two call sites, and `ENEMY_NEUTRAL_BODY_ANCHOR` goes

**Files:**
- Modify: `src/game/scenes/combat/combat-vfx-spawner.ts` (`drawDebugBodyAnchors`)
- Modify: `src/game/scenes/combat/combat-reward-gourd.ts` (`resolveRewardSourcePoint`)
- Modify: `src/game/scenes/combat/combatConstants.ts` (delete `ENEMY_NEUTRAL_BODY_ANCHOR`)

**Interfaces:**
- Consumes: `CombatScene.bodyAnchorScreen` (Task 5).
- Produces: nothing new.

- [ ] **Step 1: Write the failing test**

Append to `src/game/scenes/combat/combat-reward-gourd.test.ts` (create the file if
it does not exist, following the harness pattern in
`CombatScene.bodyAnchors.test.ts`):

```ts
describe('CombatRewardGourd — reward source (Spec C §3.1)', () => {
  it('player and enemy launch from the SAME rule, not two code paths', () => {
    // The regression this pins: the gourd used the player's hand-authored
    // `chest` for the player and a hardcoded "~40% of height" for everyone else,
    // so a companion would have needed a third rule.
    const scene = sceneWith(PLAYER_ID, 4)

    scene.sprites.set('mortal_wild_boar_1', {
      kind: 'sprite',
      rect: { x: 300, y: 500 },
      row: 4,
      footY: 500,
      columnFloat: 8,
      personWidth: 40,
      personHeight: 120,
      boost: { value: 1 },
    })

    const gourd = new CombatRewardGourd(scene)

    expect(gourd.resolveRewardSourcePoint(PLAYER_ID)).toEqual(
      gourd.resolveRewardSourcePoint('mortal_wild_boar_1'),
    )
    expect(gourd.resolveRewardSourcePoint(PLAYER_ID)).toEqual({ x: 300, y: 440 })
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx.cmd vitest run src/game/scenes/combat/combat-reward-gourd.test.ts`
Expected: FAIL.

- [ ] **Step 3: Migrate the reward gourd**

In `src/game/scenes/combat/combat-reward-gourd.ts`, replace the whole
`if (source) { … }` block at the head of `resolveRewardSourcePoint` with:

```ts
    // Spec C §3.1 — one rule for every entity. This used to branch: the player's
    // hand-authored `chest` anchor, and a hardcoded "~40% of height from the
    // feet" for everything else. The audit ruling behind that branch (never
    // borrow one character's proportions for another) is kept; what goes is the
    // second code path, because an anchor derived from the CELL borrows nothing.
    const bodyCentre = this.scene.bodyAnchorScreen(sourceId, 'centre')

    if (bodyCentre) {
      return bodyCentre
    }
```

Delete the now-unused imports of `resolveSpriteBodyAnchor`, `getBodyAnchors` and
`ENEMY_NEUTRAL_BODY_ANCHOR`. Leave the `lastKnownScreenPositions` and
`lastKnownGridPositions` fallbacks below exactly as they are — they answer for an
entity whose sprite is already gone.

- [ ] **Step 4: Migrate the debug overlay**

In `src/game/scenes/combat/combat-vfx-spawner.ts`, replace the body of
`drawDebugBodyAnchors()` after the `graphics.clear()` line with:

```ts
    const colors: Record<BodyAnchorId, number> = {
      top: 0xffffff,
      centre: 0x00ffff,
      front: 0xff8800,
      back: 0x0088ff,
      bottom: 0xff00ff,
    }

    for (const id of Object.keys(colors) as BodyAnchorId[]) {
      const point = this.scene.bodyAnchorScreen(PLAYER_ID, id)

      if (!point) {
        continue
      }

      graphics.fillStyle(colors[id]!, 0.9)

      graphics.fillCircle(point.x, point.y, 3)
    }
```

Add `import type { BodyAnchorId } from '@/presentation/geometry/combatBodyAnchors'`
and remove the now-unused `PlayerBodyAnchorId` import.

- [ ] **Step 5: Delete the constant**

In `src/game/scenes/combat/combatConstants.ts`, delete line 92:

```ts
export const ENEMY_NEUTRAL_BODY_ANCHOR = { x: 0.5, y: 0.4 } as const
```

Leave `CHARACTER_HEIGHT_RATIO` and `CHARACTER_WIDTH_RATIO` — they are health-bar
and Rectangle geometry (Spec C §3.2).

- [ ] **Step 6: Verify**

Run: `npx.cmd vitest run src/game/scenes`
Expected: PASS.

Run: `npm.cmd run type-check`
Expected: clean. If anything still references `ENEMY_NEUTRAL_BODY_ANCHOR`,
`getPlayerBodyAnchorScreen` or `resolveSpriteBodyAnchor` from a combat file, the
compiler names it here.

Run: `npx.cmd eslint src/game/scenes/combat src/presentation`
Expected: no NEW errors. Master's baseline is 171 problems / 4 errors across the
repo; none of them are in these paths.

- [ ] **Step 7: Confirm the dead code, and leave it (Spec C §4.4)**

Run: `npx.cmd grep -rn "resolveSpriteBodyAnchor\|bodyAnchors" src --include=*.ts --include=*.vue`
(or `grep` directly)

Expected: `SpriteBodyAnchor.ts` defines `resolveSpriteBodyAnchor` and nothing
calls it; `PlayerVisualProfiles.ts` defines `bodyAnchors` and only its own test
reads it.

**Do not delete either.** `bodyAnchors` describes the profile's static PNG, which
MainScene and the cultivation pose still draw. Deleting a capability is a product
decision (P9), not a tidying decision. Note both in the task summary so the user
can decide.

- [ ] **Step 8: Commit (P7 — do not run without authorization)**

```bash
git add src/game/scenes/CombatScene.ts src/game/scenes/CombatScene.bodyAnchors.test.ts src/game/scenes/combat/combat-player-visual.ts src/game/scenes/combat/combat-vfx-spawner.ts src/game/scenes/combat/combat-reward-gourd.ts src/game/scenes/combat/combat-reward-gourd.test.ts src/game/scenes/combat/combatConstants.ts
git commit -m "feat(combat): body anchors come from the cell, for every entity

Spec C §3.1/§4.2, steps 4-5 of §6.

The reward gourd branched: the player's hand-authored 'chest' anchor, and
a hardcoded '~40% of height from the feet' for everything else. The audit
ruling behind that branch is kept — no entity borrows another's
proportions — but an anchor derived from the CELL borrows nothing, so the
second path goes and ENEMY_NEUTRAL_BODY_ANCHOR with it.

resolveSpriteBodyAnchor and PlayerVisualProfile.bodyAnchors now have no
combat caller. Both are LEFT IN PLACE: bodyAnchors still describes the PNG
the home and cultivation scenes draw, and deleting a capability is a
product decision."
```

---

## Task 7: Prove it on screen, and close the gate

**Files:**
- Modify: `tests/e2e/combat-idle-motion-capture.spec.ts`

**Interfaces:**
- Consumes: everything above.
- Produces: nothing.

- [ ] **Step 1: Extend the capture spec**

In `tests/e2e/combat-idle-motion-capture.spec.ts`, inside the `page.evaluate` that
already reads `shape`, also read the enemy, and add the assertion:

```ts
    // Spec C §7 criterion 3 — the CHARACTER heights match, not the box heights.
    //
    // Measured before this spec: player 91.1px against boar 123.0px, while both
    // carried the same multiplier and the boar was the one further away. A box
    // comparison would have passed that.
    const heights = await page.evaluate(() => {
      const w = window as unknown as {
        __tutienPhaserGame?: { scene: { getScene(k: string): unknown } }
      }

      const scene = w.__tutienPhaserGame?.scene.getScene('CombatScene') as {
        sprites: Map<string, { row: number; personHeight?: number }>
        projection?: { gridToScreen(row: number, col: number): { scale: number } }
      }

      const at = (id: string) => {
        const s = scene.sprites.get(id)

        if (!s?.personHeight) return undefined

        // Normalise out perspective so two entities on different rows compare.
        const depth = scene.projection?.gridToScreen(s.row, 8).scale ?? 1

        return s.personHeight / depth
      }

      const enemyId = [...scene.sprites.keys()].find((k) => k !== 'player') as string

      return { player: at('player'), enemy: at(enemyId) }
    })

    expect(heights.player, 'player has no resolved person height').toBeDefined()
    expect(heights.enemy, 'enemy has no resolved person height').toBeDefined()

    expect(
      heights.player! / heights.enemy!,
      `player ${heights.player!.toFixed(1)}px vs enemy ${heights.enemy!.toFixed(1)}px, depth-normalised`,
    ).toBeCloseTo(1, 1)
```

- [ ] **Step 2: Run it**

Run: `DEV_PORT=5182 npx.cmd playwright test tests/e2e/combat-idle-motion-capture.spec.ts`
Expected: PASS.

- [ ] **Step 3: Probe it red**

> **CORRECTED 2026-09-12 during execution — the probe below is INERT.** The
> player and an ordinary enemy both carry `sizeMultiplier: 2`, so replacing
> `/ 2` scales BOTH by the same factor, and the assertion compares a RATIO of
> their heights, which cancels. It cannot fail. A probe that cannot fail proves
> nothing — the exact defect this project's probe discipline exists to catch,
> committed here in the plan itself.
>
> Use an ASYMMETRIC probe instead: break the symmetry so only one side moves,
> e.g. `classFactor: sprite.healthBar ? sprite.sizeMultiplier : sprite.sizeMultiplier / 2`
> (enemies carry a health bar, the player does not). Measured red: player
> 123.4px vs enemy 246.9px, ratio 0.5 against an expected ~1.

Apply the asymmetric probe above, re-run, confirm the height-ratio assertion
fails, then restore.

- [ ] **Step 4: Regenerate the art and prove criterion 4**

This is the criterion that protects the whole design, and it is demonstrated, not
asserted (Spec C §7).

> **CORRECTED 2026-09-12 during execution — changing `PADDING` is INERT here.**
> `PADDING` feeds only `cellWidth`/`cellHeight` and where each frame is placed in
> the packed sheet. `spriteSourceSize` comes from `opaqueBounds()`, measured on
> the untrimmed frame canvas BEFORE packing, so the guard reads a number padding
> never touches and stays green.
>
> Change what the figure actually occupies instead: `bodyH` from
> `FRAME_HEIGHT * 0.56` to `FRAME_HEIGHT * 0.4`. Measured red: the guard reported
> declared 0.7943 against measured 0.6343.

Edit `scripts/generate-hon-don-tran-placeholder-art.mjs` and change `bodyH`'s
factor from `0.56` to `0.4`, then:

Run: `node scripts/generate-hon-don-tran-placeholder-art.mjs`
Run: `npx.cmd vitest run tests/architecture/artExtentDeclared.test.ts`
Expected: **FAIL** — the guard notices the art moved and the declared extent did
not. That is the guard doing its job.

Update the four `PLACEHOLDER_EXTENT_*` constants to the values the failure prints,
then:

Run: `DEV_PORT=5182 npx.cmd playwright test tests/e2e/combat-idle-motion-capture.spec.ts`
Expected: **PASS** — the character is still the same size on screen, which is
criterion 4.

Then restore `bodyH`'s `0.56`, re-run the generator, restore the constants, and
confirm the guard passes again. Record both numbers in the task summary, and
verify the regenerated PNG and JSON are byte-identical to their committed state
(`git hash-object` against `git rev-parse HEAD:<path>`) — a line-ending-only
difference is expected and harmless; a content difference means the restore
failed.

- [ ] **Step 5: Full gate (P3 full)**

Run: `npm.cmd run type-check` — expected clean
Run: `npm.cmd run build` — expected clean
Run: `npx.cmd vitest run` — expected all pass except the known
`TurnBattleSystem.selfBuff.qa` flake (re-run that file alone to confirm it is the
flake and not a regression; this plan touches no core file)
Run: `npx.cmd eslint .` — expected 171 problems / 4 errors, master's own baseline,
no new entries
Run: `DEV_PORT=5182 npx.cmd playwright test` — expected all pass

- [ ] **Step 6: Look at it (P14)**

Open `test-results/combat-idle-motion/frame-3.png`. The player and the boar should
read as comparable in height. Green tests prove the numbers; only the image proves
the design was the right one (Spec C §5.1).

- [ ] **Step 7: Code review (P5)**

Run `code-review` over the branch diff. Resolve findings at confidence ≥80.

- [ ] **Step 8: Adversarial QA (P4)**

Run `tutienidle-adversarial-qa` quick mode. QA-pass writes are restricted to
`**/*.test.ts`, `tests/e2e/**`, `docs/qa/**`.

- [ ] **Step 9: Commit (P7 — do not run without authorization)**

```bash
git add tests/e2e/combat-idle-motion-capture.spec.ts
git commit -m "test(e2e): assert character height, not box height

Spec C §7 criteria 3 and 4.

Measured before this spec: player 91.1px against boar 123.0px, with the
same multiplier, and the boar further away. A box comparison passes that;
a depth-normalised character comparison does not.

Criterion 4 demonstrated by regenerating the placeholder art with
different margins: the extent guard goes red, and once the declared
extent is corrected the character's size on screen is unchanged."
```

---

## Self-Review

**Spec coverage.**

| Spec section | Task |
|---|---|
| §1.1 `anchorForFrame` cancelled | Nothing to build — it was never written. Criterion 1 is satisfied by Spec B's amendment, already committed (`ea98d141`). |
| §3.1 five anchors from the slot | 4, 5, 6 |
| §3.2 scale from a person height | 2, 3 |
| §4.1 `ArtExtent` | 1 |
| §4.2 `bodyAnchor()` | 4 |
| §4.3 `resolveEntityDisplaySize()` | 2, 3 |
| §4.4 `SpriteBodyAnchor` left in place | 6, step 7 |
| §5 seven guards | 1 (2), 2 (2), 4 (3), 7 (1 e2e) — **see gap below** |
| §6 sequencing | Task order matches exactly |
| §7 criteria 1-9 | 7 |

**Gap found and closed:** §5's table lists a guard that "two entities on the same
cell with different ART get identical anchors". Task 4 covers it, but only because
`bodyAnchor()` takes no art — the test can never fail while the signature holds.
That is weak. The stronger form is in Task 5's fourth test, which asserts a
**Rectangle fallback** gets the same anchors as a Sprite: that one would genuinely
break if somebody reached for the texture. Both are kept.

**Second gap:** Spec §7 criterion 6 says "the reward gourd uses the same `centre`
for the player and for every enemy". Task 6's first test asserts exactly that.
Covered.

**Placeholder scan:** no TBD/TODO. Every code step carries the code. Task 5 step 6
deliberately has no commit — it says why, and points at Task 6.

**Type consistency:** `ArtExtent` (Task 1) is consumed by `EntityScaleInput.extent`
(Task 2) and `EntitySprite.extent` (Task 3) with identical shape. `BodyBox`
(Task 4) is produced by `bodyBoxFor` (Task 5) with matching field names
`footX`/`footY`/`personWidth`/`personHeight`/`facing`. `personWidth`/`personHeight`
are written by Task 3 and read by Task 5. `bodyAnchorScreen` is defined in Task 5
and called in Task 6 with the same signature. `EntityDisplaySize` field names
(`boxWidth`/`boxHeight`/`personWidth`/`personHeight`) are used consistently in
Tasks 2 and 3.

**One risk worth naming.** Task 3 changes `applyEntityDepthScale`, which runs every
frame for every entity, and the resolver now calls `projection.cellSizeAt()` inside
it. If that turns out to be measurably expensive, cache the near-cell width on the
view when the layout changes rather than reverting the resolver.
