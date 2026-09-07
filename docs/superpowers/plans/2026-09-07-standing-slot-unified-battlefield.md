# Standing Slot 3x3 + Unified Battlefield Rendering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: this project's convention
> is **Inline Execution** (`superpowers:executing-plans`), not
> Subagent-Driven Development — execute task-by-task in the current
> session, with checkpoints for review. Steps use checkbox (`- [ ]`)
> syntax for tracking.

**Goal:** Reduce each side's placement resolution from 6x6 (36 cells) to
3x3 (9 "standing slots"), unify the Trận Pháp panel's grid size constant
with the real battlefield's, fix a confirmed crash when dropping a unit
into the panel, fix a CSS state-indistinguishability bug, and route the
panel's 3 hardcoded Vietnamese UI strings through i18n.

**Architecture:** One new pure function (`standingSlotPosition`) becomes
the single source of truth for turning a (slotRow, slotColumn) pair into
an absolute `GridPosition` inside a `BattlefieldUsableRegion`. Combat math
(distance/AOE/targeting) is untouched — it only ever consumes resolved
`GridPosition` values, exactly as it already does today.

**Tech Stack:** Vue 3 + TypeScript + Vite + Vitest + Pinia + Phaser (source root `game/`).

**Spec:** `docs/superpowers/specs/2026-09-07-standing-slot-unified-battlefield-design.md`

## Global Constraints

- Combat math (Chebyshev distance, AOE, targeting) is not changed — it only consumes resolved `GridPosition`.
- The real combat grid (`CombatScene`, 10x16) keeps its exact current visuals — no marker/overlay for the 9 standing slots.
- New/edited code comments are English only, plain ASCII (P15, `AGENTS.md`).
- New UI strings in `TranPhapPanel.vue` go through i18n, not hardcoded (P16, `AGENTS.md`).
- Do not edit files outside this plan's task list (P10).
- No new dependencies.
- Do not touch codebase-wide Vietnamese comments outside the files this plan already edits — that is a separate, parallel migration (`docs/superpowers/plans/2026-09-07-vietnamese-comment-to-english-migration.md`).

---

### Task 1: `standingSlotPosition()` in BattlefieldRegions.ts

**Files:**
- Modify: `game/src/core/battle/BattlefieldRegions.ts`
- Test: `game/src/core/battle/BattlefieldRegions.test.ts`

**Interfaces:**
- Produces: `STANDING_SLOT_COUNT: number` (value `3`), `standingSlotPosition(region: BattlefieldUsableRegion, slotRow: number, slotColumn: number): GridPosition` — both exported from `BattlefieldRegions.ts`, consumed by Tasks 2 and 3.

- [ ] **Step 1: Write the failing tests**

Add to `game/src/core/battle/BattlefieldRegions.test.ts` (append near the existing `centerOfRegion` tests):

```ts
import { standingSlotPosition, STANDING_SLOT_COUNT, PLAYER_SIDE_REGION, ENEMY_SIDE_REGION } from './BattlefieldRegions'

describe('standingSlotPosition', () => {
  it('anchors slot (0,0) at the region origin', () => {
    expect(standingSlotPosition(PLAYER_SIDE_REGION, 0, 0)).toEqual({ row: 3, column: 0 })
  })

  it('spaces slots 2 units apart on both axes', () => {
    expect(standingSlotPosition(PLAYER_SIDE_REGION, 1, 1)).toEqual({ row: 5, column: 2 })
    expect(standingSlotPosition(PLAYER_SIDE_REGION, 2, 2)).toEqual({ row: 7, column: 4 })
  })

  it('works for the enemy region using its own columnMin', () => {
    expect(standingSlotPosition(ENEMY_SIDE_REGION, 0, 0)).toEqual({ row: 3, column: 7 })
    expect(standingSlotPosition(ENEMY_SIDE_REGION, 1, 1)).toEqual({ row: 5, column: 9 })
    expect(standingSlotPosition(ENEMY_SIDE_REGION, 2, 2)).toEqual({ row: 7, column: 11 })
  })

  it('the middle slot matches centerOfRegion for both regions', () => {
    expect(standingSlotPosition(PLAYER_SIDE_REGION, 1, 1)).toEqual(centerOfRegion(PLAYER_SIDE_REGION))
    expect(standingSlotPosition(ENEMY_SIDE_REGION, 1, 1)).toEqual(centerOfRegion(ENEMY_SIDE_REGION))
  })
})

describe('STANDING_SLOT_COUNT', () => {
  it('is 3', () => {
    expect(STANDING_SLOT_COUNT).toBe(3)
  })
})
```

Also add `centerOfRegion` to the existing import line at the top of the test file if not already imported.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx.cmd vitest run game/src/core/battle/BattlefieldRegions.test.ts`
Expected: FAIL — `standingSlotPosition`/`STANDING_SLOT_COUNT` not exported.

- [ ] **Step 3: Implement**

In `game/src/core/battle/BattlefieldRegions.ts`, add after the `centerOfRegion` function:

```ts
export const STANDING_SLOT_COUNT = 3

// Merge each old 2x2 block into one standing slot, anchored at the first
// physical row/column of the pair (offsets 0, 2, 4 across a 6-wide
// region). Distance/AOE math is untouched -- it only ever consumes the
// resolved GridPosition, same as it already does via
// resolvePartyFormation()/resolveEnemySpawnPosition().
export function standingSlotPosition(
  region: BattlefieldUsableRegion,
  slotRow: number,
  slotColumn: number,
): GridPosition {
  return {
    row: (region.rowMin + slotRow * 2) as LaneIndex,
    column: region.columnMin + slotColumn * 2,
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx.cmd vitest run game/src/core/battle/BattlefieldRegions.test.ts`
Expected: PASS (all cases above).

- [ ] **Step 5: Commit**

```bash
git add game/src/core/battle/BattlefieldRegions.ts game/src/core/battle/BattlefieldRegions.test.ts
git commit -m "feat(battlefield): add standingSlotPosition, 3x3 standing-slot anchor helper"
```

---

### Task 2: FormationPlacement.ts uses standing slots

**Files:**
- Modify: `game/src/core/game/FormationPlacement.ts`
- Test: `game/src/core/game/FormationPlacement.test.ts`

**Interfaces:**
- Consumes: `standingSlotPosition(region, slotRow, slotColumn): GridPosition`, `PLAYER_SIDE_REGION` from Task 1 / `BattlefieldRegions.ts`.
- Produces: `localCellToAbsolute(cell): GridPosition` — unchanged signature, changed semantics (`cell.row`/`cell.column` are now local slot indices 0-2, not 0-5).

- [ ] **Step 1: Update the failing test**

In `game/src/core/game/FormationPlacement.test.ts`, update existing `localCellToAbsolute` assertions from local 0-5 coordinates to local 0-2 slot indices with the new expected absolute positions, e.g.:

```ts
it('converts local slot (0,0) to the region origin', () => {
  expect(localCellToAbsolute({ row: 0, column: 0 })).toEqual({ row: 3, column: 0 })
})

it('converts local slot (2,2) to the far corner of the player region', () => {
  expect(localCellToAbsolute({ row: 2, column: 2 })).toEqual({ row: 7, column: 4 })
})
```

Also update any `resolvePartyFormation` test fixtures in this file that build `formationLoadout.assignments` with row/column values outside 0-2.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx.cmd vitest run game/src/core/game/FormationPlacement.test.ts`
Expected: FAIL — old implementation still adds the cell directly instead of doubling it.

- [ ] **Step 3: Implement**

```ts
import type { GridPosition } from '../battle/BattleGrid'
import { PLAYER_SIDE_REGION, standingSlotPosition } from '../battle/BattlefieldRegions'
import type { PlayerData } from '../player/Player'
import { DEFAULT_PARTY_FORMATION, type PartyFormationSlot } from './PartyFormation'

// Converts a local standing-slot index (0..STANDING_SLOT_COUNT-1 on each
// axis, within the player's own 3x3 grid) into an absolute battlefield
// position, via the single standingSlotPosition() anchor formula shared
// with enemy spawn placement (EnemySpawnPlacement.ts).
export function localCellToAbsolute(cell: { row: number; column: number }): GridPosition {
  return standingSlotPosition(PLAYER_SIDE_REGION, cell.row, cell.column)
}
```

`resolvePartyFormation()` below it is unchanged (it already just calls `localCellToAbsolute()`). Remove the now-unused `LaneIndex` import if it becomes unused after this edit (check with type-check).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx.cmd vitest run game/src/core/game/FormationPlacement.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add game/src/core/game/FormationPlacement.ts game/src/core/game/FormationPlacement.test.ts
git commit -m "refactor(formation): localCellToAbsolute uses shared standingSlotPosition"
```

---

### Task 3: EnemySpawnPlacement.ts random branch uses standing slots

**Files:**
- Modify: `game/src/core/battle/EnemySpawnPlacement.ts`
- Test: `game/src/core/battle/EnemySpawnPlacement.test.ts`

**Interfaces:**
- Consumes: `standingSlotPosition`, `STANDING_SLOT_COUNT` from Task 1.
- Produces: `resolveEnemySpawnPosition(input, region?): GridPosition` — unchanged signature; random branch now returns one of exactly 9 positions instead of any of 36.

- [ ] **Step 1: Update the failing test**

In `game/src/core/battle/EnemySpawnPlacement.test.ts`, update the "random placement stays inside the region" style test(s) to assert the result is one of the 9 standing-slot positions rather than any row/column within `rowMin..rowMax`/`columnMin..columnMax`. Example:

```ts
import { standingSlotPosition, STANDING_SLOT_COUNT, ENEMY_SIDE_REGION } from '../battle/BattlefieldRegions'

it('random placement always lands on one of the 9 standing slots', () => {
  const validPositions = []
  for (let r = 0; r < STANDING_SLOT_COUNT; r++) {
    for (let c = 0; c < STANDING_SLOT_COUNT; c++) {
      validPositions.push(standingSlotPosition(ENEMY_SIDE_REGION, r, c))
    }
  }

  for (let i = 0; i < 50; i++) {
    const position = resolveEnemySpawnPosition({ isBoss: false, random: Math.random })
    expect(validPositions).toContainEqual(position)
  }
})
```

Keep the existing boss-centers test as-is (its expected value does not change — see Task 1's "middle slot matches centerOfRegion" test).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx.cmd vitest run game/src/core/battle/EnemySpawnPlacement.test.ts`
Expected: FAIL — current implementation returns continuous random positions across all 36 cells, most of which are not standing slots.

- [ ] **Step 3: Implement**

```ts
import type { GridPosition } from './BattleGrid'
import {
  ENEMY_SIDE_REGION,
  centerOfRegion,
  standingSlotPosition,
  STANDING_SLOT_COUNT,
  type BattlefieldUsableRegion,
} from './BattlefieldRegions'

export interface EnemySpawnPlacementInput {
  isBoss: boolean
  random: () => number
}

function randomIntInclusive(random: () => number, min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1))
}

export function resolveEnemySpawnPosition(
  input: EnemySpawnPlacementInput,
  region: BattlefieldUsableRegion = ENEMY_SIDE_REGION,
): GridPosition {
  if (input.isBoss) {
    return centerOfRegion(region)
  }

  const slotRow = randomIntInclusive(input.random, 0, STANDING_SLOT_COUNT - 1)
  const slotColumn = randomIntInclusive(input.random, 0, STANDING_SLOT_COUNT - 1)

  return standingSlotPosition(region, slotRow, slotColumn)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx.cmd vitest run game/src/core/battle/EnemySpawnPlacement.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add game/src/core/battle/EnemySpawnPlacement.ts game/src/core/battle/EnemySpawnPlacement.test.ts
git commit -m "refactor(enemy-spawn): random placement restricted to the 9 standing slots"
```

---

### Task 4: TranPhap.ts formation data — 9 cells instead of 36

**Files:**
- Modify: `game/src/data/formation/TranPhap.ts`
- Test: `game/src/data/formation/TranPhap.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `TRAN_PHAP_FORMATIONS` — `HON_DON_TRAN.cellPattern` now has 9 entries (local rows/columns 0-2) instead of 36.

- [ ] **Step 1: Update the failing test**

In `game/src/data/formation/TranPhap.test.ts`, update any assertion of `HON_DON_TRAN.cellPattern.length` (or equivalent) from `36` to `9`, and any assertion checking a specific cell's presence to use 0-2 coordinates.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx.cmd vitest run game/src/data/formation/TranPhap.test.ts`
Expected: FAIL — `cellPattern.length` is still 36.

- [ ] **Step 3: Implement**

```ts
export interface TranPhapCell {
  row: number
  column: number
}

export interface TranPhapDefinition {
  id: string
  name: string
  cellPattern: readonly TranPhapCell[]
  buff: { definitionId: string }
  description: string
}

// Hon Don Tran (2026-09-06, visual test tooling) -- TEST-ONLY: opens all
// 9 standing slots of the local 3x3 grid, used to test panel/wiring
// before real Tran Phap content exists. Remove once a real formation
// replaces this "stress-test every slot" role.
function allLocalCells(): TranPhapCell[] {
  const cells: TranPhapCell[] = []

  for (let row = 0; row <= 2; row++) {
    for (let column = 0; column <= 2; column++) {
      cells.push({ row, column })
    }
  }

  return cells
}

const HON_DON_TRAN: TranPhapDefinition = {
  id: 'hon_don_tran',
  name: 'Hỗn Độn Trận',
  cellPattern: allLocalCells(),
  buff: { definitionId: 'hon_don_tran_test_buff' },
  description: 'TEST-ONLY — mở toàn bộ 9 ô để kiểm tra wiring đội hình.',
}

export const TRAN_PHAP_FORMATIONS: readonly TranPhapDefinition[] = [HON_DON_TRAN]
```

Note: the top-of-file comment block (lines 1-8) also says "6x6" / references `localCellToAbsolute()` — update "6x6" to "3x3" there too. `name`/`description` stay Vietnamese (UI-facing content data, not touched by P15/P16 per the spec's Non-Goals).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx.cmd vitest run game/src/data/formation/TranPhap.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add game/src/data/formation/TranPhap.ts game/src/data/formation/TranPhap.test.ts
git commit -m "feat(formation): Hon Don Tran opens 9 standing slots (3x3) instead of 36"
```

---

### Task 5: TranPhapCombatPreviewScene.ts — single source of truth for grid size

**Files:**
- Modify: `game/src/game/scenes/TranPhapCombatPreviewScene.ts`
- Test: `game/src/game/scenes/TranPhapCombatPreviewScene.test.ts`

**Interfaces:**
- Consumes: `STANDING_SLOT_COUNT` from `@/core/battle/BattlefieldRegions` (Task 1).
- Produces: same public class `TranPhapCombatPreviewScene` and constants `PANEL_WIDTH`/`PANEL_HEIGHT`/`PERSPECTIVE_MIN_ROAD_HEIGHT_PANEL` (unchanged). Removes: `PREVIEW_GRID_SIZE`, `PREVIEW_CELL_SIZE`, `previewCellTopLeft()` (dead code — confirmed zero production call sites, only referenced by its own test).

- [ ] **Step 1: Update the failing test**

In `game/src/game/scenes/TranPhapCombatPreviewScene.test.ts`:
- Delete the `describe('previewCellTopLeft', ...)` block entirely (the function is being removed as dead code).
- Delete the import of `previewCellTopLeft`/`PREVIEW_CELL_SIZE` from this test file.
- Replace any remaining reference to `PREVIEW_GRID_SIZE` with `STANDING_SLOT_COUNT` imported from `@/core/battle/BattlefieldRegions`, and update the expected grid-size value from `6` to `3` (it's already `3` if inherited from the constant — the point is the test now reads the constant instead of a local one).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx.cmd vitest run game/src/game/scenes/TranPhapCombatPreviewScene.test.ts`
Expected: FAIL — `PREVIEW_GRID_SIZE`/`previewCellTopLeft` still exist and are still imported from the old location; new import from `BattlefieldRegions` not yet exported by the scene module (irrelevant — it's a direct import, so this step's "fail" is really about the scene still using the old constant name if any test asserts on the new import path). If the test edits alone don't produce a red state because the values coincidentally still match, proceed to Step 3 directly — the primary correctness gate here is Step 4's full pass plus the dead-code removal.

- [ ] **Step 3: Implement**

In `game/src/game/scenes/TranPhapCombatPreviewScene.ts`:

```ts
import Phaser from 'phaser'
import {
  PLACEHOLDER_SHEET_KEY,
  PLACEHOLDER_SHEET_URL,
  PLACEHOLDER_FRAME_WIDTH,
  PLACEHOLDER_FRAME_HEIGHT,
  PLACEHOLDER_FRAME_COUNT,
  PLACEHOLDER_FRAME_RATE,
} from '@/game/support/CombatAnimationSet'
import {
  createBattleGridProjection,
  computePerspectiveGeometry,
  type BattleGridProjection,
} from '@/game/support/BattleGridProjection'
import { STANDING_SLOT_COUNT } from '@/core/battle/BattlefieldRegions'
import type { FormationSlotAssignment } from '@/core/player/Player'
import type { LaneIndex } from '@/core/battle/BattleLane'
import { CombatGridView } from './combat/combat-grid-view'
import type { CombatGridViewHost } from './combat/CombatGridViewHost'
import type { EntitySprite } from './combat/combatTypes'

// PANEL_WIDTH/HEIGHT must match PANEL_CANVAS_WIDTH/HEIGHT in
// TranPhapPanel.vue exactly (Task 3, battlefield-perspective-panel plan)
// -- the two files can't share scope, so this stays a duplicated
// constant pair; changing one requires changing the other.
export const PANEL_WIDTH = 420
export const PANEL_HEIGHT = 480
export const PERSPECTIVE_MIN_ROAD_HEIGHT_PANEL = 140

const PANEL_SKY_COLOR = 0x22283a
const PANEL_GROUND_COLOR = 0x1a1a1a

const PREVIEW_IDLE_ANIMATION_KEY = 'tran-phap-preview-idle'

export class TranPhapCombatPreviewScene extends Phaser.Scene implements CombatGridViewHost {
  readonly isPerspective = true
  projection: BattleGridProjection | undefined
  gridGraphics: Phaser.GameObjects.Graphics | undefined
  readonly usingArtBackdrop = false
  arenaRect: Phaser.GameObjects.Rectangle | undefined
  private skyLayer: Phaser.GameObjects.Rectangle | undefined
  private groundLayer: Phaser.GameObjects.Rectangle | undefined
  // 0.8 x cell -- reproduces the sprite/cell ratio of the pre-perspective
  // scene (setDisplaySize(cell * 0.8, cell * 0.8)); cell size now comes
  // from the projection at STANDING_SLOT_COUNT resolution, not a fixed
  // PREVIEW_CELL_SIZE constant.
  characterWidth = (PANEL_WIDTH / STANDING_SLOT_COUNT) * 0.8
  characterHeight = (PANEL_WIDTH / STANDING_SLOT_COUNT) * 0.8
  readonly playerSourceSize = { w: 1, h: 1 }
  readonly playerProfile = { combatTextureKey: PLACEHOLDER_SHEET_KEY }
  sprites = new Map<string, EntitySprite>()
  entityFootMinY = 0
  entityFootMaxY = 1
  readonly interpolations = new Map<string, unknown>()

  private gridView!: CombatGridView

  constructor() {
    super('TranPhapCombatPreviewScene')
  }

  fallbackSpriteTextureKey(_id: string): string | undefined {
    return PLACEHOLDER_SHEET_KEY
  }

  preload(): void {
    this.load.spritesheet(PLACEHOLDER_SHEET_KEY, PLACEHOLDER_SHEET_URL, {
      frameWidth: PLACEHOLDER_FRAME_WIDTH,
      frameHeight: PLACEHOLDER_FRAME_HEIGHT,
    })
  }

  create(): void {
    this.gridView = new CombatGridView(this)

    const geometry = computePerspectiveGeometry(
      { width: PANEL_WIDTH, height: PANEL_HEIGHT, topInset: 0, bottomInset: 0 },
      PERSPECTIVE_MIN_ROAD_HEIGHT_PANEL,
    )

    this.skyLayer = this.add.rectangle(0, 0, PANEL_WIDTH, geometry.horizonY, PANEL_SKY_COLOR).setOrigin(0, 0)
    this.groundLayer = this.add
      .rectangle(0, geometry.horizonY, PANEL_WIDTH, geometry.roadHeight, PANEL_GROUND_COLOR)
      .setOrigin(0, 0)

    this.projection = createBattleGridProjection(
      'perspective',
      { width: PANEL_WIDTH, height: PANEL_HEIGHT, topInset: 0, bottomInset: 0 },
      STANDING_SLOT_COUNT,
      STANDING_SLOT_COUNT,
      PERSPECTIVE_MIN_ROAD_HEIGHT_PANEL,
    )
    this.gridGraphics = this.add.graphics()
    this.gridView.redrawGridLines()

    if (!this.anims.exists(PREVIEW_IDLE_ANIMATION_KEY)) {
      this.anims.create({
        key: PREVIEW_IDLE_ANIMATION_KEY,
        frames: this.anims.generateFrameNumbers(PLACEHOLDER_SHEET_KEY, { start: 0, end: PLACEHOLDER_FRAME_COUNT - 1 }),
        frameRate: PLACEHOLDER_FRAME_RATE,
        repeat: -1,
      })
    }
  }

  syncAssignments(assignments: FormationSlotAssignment[]): void {
    const nextIds = new Set(assignments.map((a) => a.combatantId))

    for (const [id, sprite] of this.sprites) {
      if (!nextIds.has(id)) {
        this.gridView.destroyEntitySprite(sprite)
        this.sprites.delete(id)
      }
    }

    for (const assignment of assignments) {
      const sprite = this.gridView.getOrCreateSprite(
        assignment.combatantId,
        0x4caf50,
        assignment.combatantId,
        assignment.row as LaneIndex,
      )

      if (sprite.kind === 'sprite' && !(sprite.rect as Phaser.GameObjects.Sprite).anims.isPlaying) {
        ;(sprite.rect as Phaser.GameObjects.Sprite).play(PREVIEW_IDLE_ANIMATION_KEY)
      }

      this.gridView.positionSprite(sprite, assignment.column)
    }
  }
}
```

Removed: `PREVIEW_CELL_SIZE`, `PREVIEW_GRID_SIZE`, `previewCellTopLeft()`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx.cmd vitest run game/src/game/scenes/TranPhapCombatPreviewScene.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add game/src/game/scenes/TranPhapCombatPreviewScene.ts game/src/game/scenes/TranPhapCombatPreviewScene.test.ts
git commit -m "refactor(tran-phap-preview): use shared STANDING_SLOT_COUNT, remove dead previewCellTopLeft"
```

---

### Task 6: TranPhapPanel.vue — fix crash, fix CSS state, migrate to i18n

**Files:**
- Modify: `game/src/components/panels/TranPhapPanel.vue`
- Modify: `game/src/locales/vi.json`
- Modify: `game/src/locales/en.json`

**Interfaces:**
- Consumes: `STANDING_SLOT_COUNT` from `@/core/battle/BattlefieldRegions` (Task 1/5).

- [ ] **Step 1: Add i18n locale keys**

In `game/src/locales/vi.json`, inside the `panels` object (alongside the existing `bag` key at line 270), add:

```json
"tranPhap": {
  "title": "Trận Pháp",
  "confirm": "Lưu Trận Pháp",
  "grantTest": "[TEST-ONLY] Cấp 5 Companion Test"
}
```

In `game/src/locales/en.json`, inside the equivalent `panels` object, add:

```json
"tranPhap": {
  "title": "Formation",
  "confirm": "Save Formation",
  "grantTest": "[TEST-ONLY] Grant 5 Test Companions"
}
```

- [ ] **Step 2: Update imports and template in TranPhapPanel.vue**

Replace the dead-import block:

```ts
import { PREVIEW_CELL_SIZE, PREVIEW_GRID_SIZE } from '@/game/scenes/TranPhapCombatPreviewScene'
```

with:

```ts
import { STANDING_SLOT_COUNT } from '@/core/battle/BattlefieldRegions'
```

Add `useI18n` alongside the existing store imports (following the `BagGrid.vue` pattern):

```ts
import { useI18n } from 'vue-i18n'
```

and near the top of `<script setup>`, alongside `const ui = useUiStore()`:

```ts
const { t } = useI18n({ useScope: 'local' })
```

In the `<template>`, replace every `PREVIEW_GRID_SIZE` with `STANDING_SLOT_COUNT` (both the row loop and the column loop, lines matching `v-for row in PREVIEW_GRID_SIZE` / `v-for column in PREVIEW_GRID_SIZE`).

Replace the hardcoded title/labels:

```vue
<OverlayPanel :open="ui.standalonePanel === 'tran_phap'" :title="t('panels.tranPhap.title')" width="min(1000px, 94vw)" height="min(680px, 88vh)" @close="close">
```

```vue
<button
  v-if="hasUngrantedTestCompanions"
  type="button"
  class="tran-phap-panel__grant-test"
  @click="grantTestCompanions"
>
  {{ t('panels.tranPhap.grantTest') }}
</button>
```

```vue
<button type="button" class="tran-phap-panel__confirm" :disabled="!selectedFormation" @click="onConfirm">
  {{ t('panels.tranPhap.confirm') }}
</button>
```

- [ ] **Step 3: Fix the Phaser.Game bootstrap (crash fix)**

Locate the `new Phaser.Game({...})` call and add the missing `physics` block, matching `PhaserCanvas.vue`'s real-combat bootstrap exactly:

```ts
previewGame = new Phaser.Game({
  type: Phaser.AUTO,
  parent: previewContainerRef.value,
  width: PANEL_CANVAS_WIDTH,
  height: PANEL_CANVAS_HEIGHT,
  transparent: true,
  physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 0 }, debug: false } },
  scene: [TranPhapCombatPreviewSceneClass],
})
```

- [ ] **Step 4: Fix the occupied/enabled CSS distinction**

In the `<style scoped>` block, replace:

```css
.tran-phap-panel__cell--enabled,
.tran-phap-panel__cell--occupied {
  opacity: 1;
  border-color: var(--jade, #4caf50);
}
```

with:

```css
.tran-phap-panel__cell--enabled {
  opacity: 1;
  border-color: var(--jade, #4caf50);
}

.tran-phap-panel__cell--occupied {
  opacity: 1;
  border-color: var(--jade, #4caf50);
  background: rgba(76, 175, 80, 0.22);
}
```

- [ ] **Step 5: Update the stale canvas-size comment**

The comment above `.tran-phap-panel__preview-canvas` still says "360px / 356px" (a pre-existing stale reference from before the perspective-panel rework, unrelated to this plan's grid-size change but adjacent to code being touched) — leave it as a known limitation; do not attempt the canvas/overlay alignment fix here (out of scope per the spec's Non-Goals — needs its own future plan).

- [ ] **Step 6: Type-check and full suite**

Run: `npm.cmd run type-check`
Expected: 0 errors.

Run: `npx.cmd vitest run`
Expected: all tests pass (2809+ baseline, no regressions).

- [ ] **Step 7: P14 — Playwright real-browser verification (mandatory, this is exactly the change class P14 exists for)**

1. `npm.cmd run dev` (background), read the printed Local URL.
2. `playwright-cli open <url> --browser=msedge`, load an existing save or create a character to reach Trúc Cơ/home.
3. Open the Trận Pháp panel, select "Hỗn Độn Trận".
4. Drag the player card into a cell — confirm no console error (this is the crash fix from Step 3).
5. Drag a companion card into a different cell — confirm it also succeeds.
6. Screenshot/snapshot: confirm the overlay grid is 3x3 (9 cells), the occupied cells show a distinct green-tinted background vs. the empty enabled cells (Step 4's fix), and the Phaser canvas underneath renders a 3x3 perspective grid.
7. `playwright-cli console` — confirm no unexpected errors.
8. `playwright-cli close`, delete `.playwright-cli/` scratch files.

- [ ] **Step 8: Commit**

```bash
git add game/src/components/panels/TranPhapPanel.vue game/src/locales/vi.json game/src/locales/en.json
git commit -m "fix(tran-phap-panel): fix drop crash (missing physics config), distinguish occupied cells, migrate UI strings to i18n"
```

---

### Task 7: Final full-suite verification

**Files:** none (verification only).

- [ ] **Step 1: Full verification**

Run: `npm.cmd run type-check`
Run: `npm.cmd run build`
Run: `npx.cmd vitest run`

Expected: all green, matching or exceeding the pre-plan baseline test count (2809 baseline + new tests added in Tasks 1-6).

- [ ] **Step 2: Grep-check no lingering references to removed symbols**

Run: `grep -rn "PREVIEW_GRID_SIZE\|PREVIEW_CELL_SIZE\|previewCellTopLeft" game/src`
Expected: no matches.

- [ ] **Step 3: Summarize**

State in the final summary: what changed, P3 mode used (`full`), P14 evidence (screenshot/snapshot description from Task 6 Step 7), and confirmation that the crash bug and the CSS state bug are both fixed with browser evidence, not just code inspection.
