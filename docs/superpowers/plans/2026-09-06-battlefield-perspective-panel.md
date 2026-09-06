# Battlefield Perspective Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the Trận Pháp panel the same 2.5D perspective look as real combat by generalizing `BattleGridProjection` and `combat-grid-view.ts`'s `redrawGridLines()` to accept a configurable grid size, removing obsolete turn-based-incompatible "defense gate" decor along the way, and switching `TranPhapCombatPreviewScene` to perspective mode with an enlarged canvas and a two-layer sky/ground backdrop.

**Architecture:** `BattleGridProjection.ts`'s two concrete classes stop importing `GRID_ROW_COUNT`/`GRID_COLUMN_COUNT` as module-level constants and instead store `rows`/`columns` from their constructor, exposed as new readonly fields on the `BattleGridProjection` interface. `combat-grid-view.ts`'s `redrawGridLines()` reads grid size from `projection.rows`/`projection.columns` instead of importing the same hardcoded constants, and drops the hero-column "defense gate" polygon fill (a real-time-only visual, meaningless under turn-based combat). `TranPhapCombatPreviewScene` (shipped by the prerequisite plan below) then requests a 6x6 perspective projection instead of drawing its own flat grid by hand.

**Tech Stack:** TypeScript, Phaser 4, Vue 3 `<script setup>`, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-06-battlefield-perspective-panel-design.md`

**Prerequisite (BLOCKING):** This plan requires
`docs/superpowers/plans/2026-09-06-battlefield-slot-shared-gridview.md`
(Part 1 of 4) to be merged first — it introduces `CombatGridViewHost.ts`
and `TranPhapCombatPreviewScene.ts`, both edited by this plan. Before
starting Task 1, run `git log --oneline -- game/src/game/scenes/TranPhapCombatPreviewScene.ts`
— if it returns nothing, Part 1 has not landed yet; stop and report
instead of proceeding.

## Global Constraints

- TypeScript strict, no `any` anywhere.
- Explanatory comments MUST be in Vietnamese (short English technical terms/identifiers as lead-ins only) — this project's house style.
- The ONLY correct type-check gate is `npm.cmd run type-check` (runs `vue-tsc --build`). `npx vue-tsc --noEmit` walks zero files in this repo — NEVER use it.
- `BattleGridProjection.ts` and `combat-grid-view.ts` are production combat code — every task touching them must run the full existing suite (`npx vitest run`) and confirm zero regressions, not just the new/changed test file.
- Every new parameter added to an existing exported function/class in this plan MUST default to the value that reproduces today's real-combat behavior exactly — no call site outside this plan's own files may need to change to keep compiling and passing.
- Do not touch `BattlefieldBackdrop.ts` (the procedural sky/ridges/ground art for real combat) — it receives an already-built `BattleGridProjection` and never calls `createBattleGridProjection()` itself, so it is unaffected by this plan and out of scope.
- Do not remove the `HERO_COLUMN` constant itself (`@/core/battle/BattleLane`) — it is still used by `PartyFormation.ts`, `BattleLane.ts`, and `EnemyAttackSystem.ts` for real gameplay. Only the code that *draws* the defense-gate highlight in `redrawGridLines()` is removed.
- No behavior change to real combat's rendering in any task — every new function parameter defaults to real combat's current values (10 rows, 16 columns, `PERSPECTIVE_MIN_ROAD_HEIGHT` = 320).

---

### Task 1: Generalize `BattleGridProjection.ts` — configurable rows/columns/minRoadHeight

**Files:**
- Modify: `game/src/game/support/BattleGridProjection.ts`
- Modify: `game/src/game/support/BattleGridProjection.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `BattleGridProjection` interface gains `readonly rows: number` and `readonly columns: number`. `computePerspectiveGeometry(viewport, minRoadHeight?)` gains an optional second parameter. `createBattleGridProjection(mode, viewport, rows?, columns?, minRoadHeight?)` gains three optional parameters, all defaulting to real combat's current values.

- [ ] **Step 1: Write the failing tests**

Add to `game/src/game/support/BattleGridProjection.test.ts` (near the other `describe` blocks, after the existing perspective/flat describes):

```ts
describe('BattleGridProjection — configurable grid size (Battlefield Perspective Panel, 2026-09-06)', () => {
  it('createBattleGridProjection sem đối số rows/columns → mặc định 10x16 như combat thật (parity)', () => {
    const projection = createBattleGridProjection('perspective', VIEWPORT)

    expect(projection.rows).toBe(GRID_ROW_COUNT)
    expect(projection.columns).toBe(GRID_COLUMN_COUNT)
  })

  it('createBattleGridProjection với rows=6, columns=6 → gridToScreen dùng ĐÚNG lưới 6x6, không phải 10x16', () => {
    const small = createBattleGridProjection('perspective', VIEWPORT, 6, 6)

    expect(small.rows).toBe(6)
    expect(small.columns).toBe(6)

    // Hàng gần (row 5, cuối lưới 6 hàng) phải có scale = 1 (near edge),
    // giống hệt cách hàng gần (row 9) của lưới 10 hàng có scale = 1 —
    // xác nhận công thức đọc this.rows chứ không phải hằng số 10 cứng.
    const near = small.gridToScreen(5, 0)
    const far = small.gridToScreen(0, 0)

    expect(near.scale).toBeCloseTo(1, 6)
    expect(far.scale).toBeLessThan(near.scale)
  })

  it('flat mode với rows=6, columns=6 → cellSizeAt() tính theo lưới nhỏ, ô to hơn lưới 10x16 với cùng viewport', () => {
    const bigGrid = createBattleGridProjection('flat', VIEWPORT)
    const smallGrid = createBattleGridProjection('flat', VIEWPORT, 6, 6)

    expect(smallGrid.cellSizeAt(0).width).toBeGreaterThan(bigGrid.cellSizeAt(0).width)
  })

  it('computePerspectiveGeometry với minRoadHeight tùy chỉnh → roadHeight tôn trọng sàn mới thay vì 320 mặc định', () => {
    const shortViewport = { width: 420, height: 480, topInset: 0, bottomInset: 0 }

    const defaultFloor = computePerspectiveGeometry(shortViewport)
    const customFloor = computePerspectiveGeometry(shortViewport, 140)

    expect(customFloor.roadHeight).toBeGreaterThanOrEqual(140)
    // sàn mặc định (320) trên viewport 480px cao buộc roadHeight sát mức
    // sàn 320 — chứng minh tham số minRoadHeight THỰC SỰ đổi kết quả,
    // không phải no-op.
    expect(defaultFloor.roadHeight).not.toBeCloseTo(customFloor.roadHeight, 0)
  })

  it('createBattleGridProjection với minRoadHeight tùy chỉnh truyền xuống PerspectiveGridProjection (không phải bị bỏ qua)', () => {
    const shortViewport = { width: 420, height: 480, topInset: 0, bottomInset: 0 }
    const projection = createBattleGridProjection('perspective', shortViewport, 6, 6, 140)

    // bounds().top xấp xỉ horizonY — với sàn 140 (thấp hơn mặc định 320),
    // horizonY phải THẤP hơn (số nhỏ hơn = gần đỉnh màn hình hơn) so với
    // dùng sàn mặc định trên cùng viewport.
    const defaultFloorProjection = createBattleGridProjection('perspective', shortViewport, 6, 6)

    expect(projection.bounds().top).toBeLessThan(defaultFloorProjection.bounds().top)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run BattleGridProjection.test.ts`
Expected: FAIL (`rows`/`columns` don't exist on the returned object; `minRoadHeight` param doesn't exist).

- [ ] **Step 3: Implement — `computePerspectiveGeometry`**

In `game/src/game/support/BattleGridProjection.ts`, change:

```ts
export function computePerspectiveGeometry(viewport: ProjectionViewport): PerspectiveGeometry {
  const availableHeight = Math.max(1, viewport.height - viewport.topInset - viewport.bottomInset)
  const desiredScenery = availableHeight * PERSPECTIVE_SCENERY_RATIO
  const maxScenery = Math.max(0, availableHeight - PERSPECTIVE_MIN_ROAD_HEIGHT)
  const sceneryHeight = Math.min(desiredScenery, maxScenery)

  return {
    horizonY: viewport.topInset + sceneryHeight,
    roadBottomY: viewport.topInset + availableHeight,
    sceneryHeight,
    roadHeight: availableHeight - sceneryHeight,
  }
}
```

to:

```ts
export function computePerspectiveGeometry(
  viewport: ProjectionViewport,
  minRoadHeight: number = PERSPECTIVE_MIN_ROAD_HEIGHT,
): PerspectiveGeometry {
  const availableHeight = Math.max(1, viewport.height - viewport.topInset - viewport.bottomInset)
  const desiredScenery = availableHeight * PERSPECTIVE_SCENERY_RATIO
  const maxScenery = Math.max(0, availableHeight - minRoadHeight)
  const sceneryHeight = Math.min(desiredScenery, maxScenery)

  return {
    horizonY: viewport.topInset + sceneryHeight,
    roadBottomY: viewport.topInset + availableHeight,
    sceneryHeight,
    roadHeight: availableHeight - sceneryHeight,
  }
}
```

- [ ] **Step 4: Implement — `BattleGridProjection` interface**

Add two fields right after `readonly viewport: ProjectionViewport`:

```ts
export interface BattleGridProjection {
  readonly mode: BattlefieldRenderMode
  readonly viewport: ProjectionViewport
  // Battlefield Perspective Panel (2026-09-06) — nguồn sự thật DUY NHẤT
  // cho kích thước lưới; combat-grid-view.ts's redrawGridLines() đọc trực
  // tiếp 2 field này thay vì import hằng số cứng, nên panel Trận Pháp
  // (6x6) và combat thật (10x16) dùng chung được 1 hàm vẽ lưới.
  readonly rows: number
  readonly columns: number

  gridToScreen(row: number, column: number): GridScreenPoint
  // ... (rest unchanged)
```

- [ ] **Step 5: Implement — `FlatGridProjection`**

Change the constructor and every internal use of `GRID_ROW_COUNT`/`GRID_COLUMN_COUNT` inside this class:

```ts
class FlatGridProjection implements BattleGridProjection {
  readonly mode = 'flat' as const

  viewport: Required<ProjectionViewport>
  readonly rows: number
  readonly columns: number

  private cellSizePx = 0
  private gridLeft = 0
  private gridTop = 0

  constructor(viewport: ProjectionViewport, rows: number = GRID_ROW_COUNT, columns: number = GRID_COLUMN_COUNT) {
    this.viewport = makeViewport(viewport)
    this.rows = rows
    this.columns = columns
    this.recalculate()
  }
```

Then in `recalculate()`, change:

```ts
    this.cellSizePx = Math.max(
      1,
      Math.min((availableWidth - 24) / GRID_COLUMN_COUNT, availableHeight / GRID_ROW_COUNT),
    )
    this.gridLeft = availableWidth / 2 - (this.cellSizePx * GRID_COLUMN_COUNT) / 2
    this.gridTop = this.viewport.topInset + (availableHeight - this.cellSizePx * GRID_ROW_COUNT) / 2
```

to:

```ts
    this.cellSizePx = Math.max(
      1,
      Math.min((availableWidth - 24) / this.columns, availableHeight / this.rows),
    )
    this.gridLeft = availableWidth / 2 - (this.cellSizePx * this.columns) / 2
    this.gridTop = this.viewport.topInset + (availableHeight - this.cellSizePx * this.rows) / 2
```

And in `screenToGridUnclamped()`:

```ts
  screenToGridUnclamped(x: number, y: number): GridFloatPosition | null {
    const bottom = this.gridTop + this.cellSizePx * this.rows

    if (y < this.gridTop || y > bottom) {
      return null
    }

    return this.screenToGrid(x, y)
  }
```

And in `containsScreenPoint()`:

```ts
  containsScreenPoint(x: number, y: number): boolean {
    const hit = this.screenToGridUnclamped(x, y)

    if (!hit) {
      return false
    }

    return hit.column >= -0.5 && hit.column <= this.columns - 0.5
  }
```

And in `bounds()`:

```ts
  bounds(): ProjectionBounds {
    return {
      left: this.gridLeft,
      top: this.gridTop,
      right: this.gridLeft + this.cellSizePx * this.columns,
      bottom: this.gridTop + this.cellSizePx * this.rows,
      centerX: this.gridLeft + (this.cellSizePx * this.columns) / 2,
    }
  }
```

- [ ] **Step 6: Implement — `PerspectiveGridProjection`**

Change the constructor:

```ts
class PerspectiveGridProjection implements BattleGridProjection {
  readonly mode = 'perspective' as const

  viewport: Required<ProjectionViewport>
  readonly rows: number
  readonly columns: number

  private q = 1 + PERSPECTIVE_STRENGTH
  private bandTop = 0
  private bandHeight = 1
  private nearWidth = 1
  private centerX = 0
  private minRoadHeight: number

  constructor(
    viewport: ProjectionViewport,
    rows: number = GRID_ROW_COUNT,
    columns: number = GRID_COLUMN_COUNT,
    minRoadHeight: number = PERSPECTIVE_MIN_ROAD_HEIGHT,
  ) {
    this.viewport = makeViewport(viewport)
    this.rows = rows
    this.columns = columns
    this.minRoadHeight = minRoadHeight
    this.recalculate()
  }
```

Then in `recalculate()`, change:

```ts
    const geometry = computePerspectiveGeometry(this.viewport)
```

to:

```ts
    const geometry = computePerspectiveGeometry(this.viewport, this.minRoadHeight)
```

Then replace every remaining `GRID_ROW_COUNT`/`GRID_COLUMN_COUNT` reference in this class (`gridToScreen`, `screenToGrid`, `screenToGridUnclamped`, `containsScreenPoint`, `cellSizeAt`) with `this.rows`/`this.columns`:

```ts
  gridToScreen(row: number, column: number): GridScreenPoint {
    const v = clamp01((row + 0.5) / this.rows)
    const denominator = this.denominatorAt(v)
    const scale = 1 / (denominator * denominator)

    return {
      x: this.centerX + ((column + 0.5) / this.columns - 0.5) * this.nearWidth * scale,
      y: this.bandTop + this.bandHeight * (v / denominator),
      scale,
    }
  }

  screenToGrid(x: number, y: number): GridFloatPosition {
    const f = clamp01((y - this.bandTop) / this.bandHeight)
    const inverseDenominator = 1 - f * (1 - this.q)
    const v = (f * this.q) / inverseDenominator
    const denominator = this.denominatorAt(v)
    const scale = 1 / (denominator * denominator)

    return {
      row: v * this.rows - 0.5,
      column: ((x - this.centerX) / (this.nearWidth * scale) + 0.5) * this.columns - 0.5,
    }
  }
```

```ts
  containsScreenPoint(x: number, y: number): boolean {
    const hit = this.screenToGridUnclamped(x, y)

    if (!hit) {
      return false
    }

    return hit.column >= -0.5 && hit.column <= this.columns - 0.5
  }

  cellSizeAt(row: number): CellPixelSize {
    const v = clamp01((row + 0.5) / this.rows)
    const scale = 1 / this.denominatorAt(v) ** 2

    return {
      width: (this.nearWidth / this.columns) * scale,
      height: (this.bandHeight / this.rows) * this.q * scale,
    }
  }
```

(`screenToGridUnclamped()` itself has no `GRID_*` reference — leave unchanged.)

- [ ] **Step 7: Implement — `createBattleGridProjection` factory**

Change:

```ts
export function createBattleGridProjection(
  mode: BattlefieldRenderMode,
  viewport: ProjectionViewport,
): BattleGridProjection {
  return mode === 'perspective'
    ? new PerspectiveGridProjection(viewport)
    : new FlatGridProjection(viewport)
}
```

to:

```ts
export function createBattleGridProjection(
  mode: BattlefieldRenderMode,
  viewport: ProjectionViewport,
  rows: number = GRID_ROW_COUNT,
  columns: number = GRID_COLUMN_COUNT,
  minRoadHeight: number = PERSPECTIVE_MIN_ROAD_HEIGHT,
): BattleGridProjection {
  return mode === 'perspective'
    ? new PerspectiveGridProjection(viewport, rows, columns, minRoadHeight)
    : new FlatGridProjection(viewport, rows, columns)
}
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `npx vitest run BattleGridProjection.test.ts` — all pass (existing + 5 new).

- [ ] **Step 9: Type-check + full regression**

Run: `npm.cmd run type-check` + `npx vitest run` (full, no filter) — both green, zero regressions (`EnemySpawnVfx.test.ts`, `ActionImpactVfx.test.ts`, `CombatScene.spawnVfx.test.ts` all call `createBattleGridProjection('perspective', {...})` with 2 args — must still pass unchanged, proving the new params are truly optional/defaulted).

- [ ] **Step 10: Commit**

```bash
git add game/src/game/support/BattleGridProjection.ts game/src/game/support/BattleGridProjection.test.ts
git commit -m "feat(battlefield-perspective-panel): generalize BattleGridProjection rows/columns/minRoadHeight"
```

---

### Task 2: `combat-grid-view.ts`'s `redrawGridLines()` — shared grid size, drop obsolete gate decor

**Files:**
- Modify: `game/src/game/scenes/combat/combat-grid-view.ts`
- Modify: `game/src/game/scenes/combat/combat-grid-view.test.ts`

**Interfaces:**
- Consumes: `BattleGridProjection.rows`/`.columns` (Task 1).
- Produces: `redrawGridLines()`'s behavior for real combat's 10x16 grid is pixel-identical MINUS the gate highlight fill (which no longer draws for anyone — see Global Constraints, this is the one intentional visual removal in this plan, approved by the user as obsolete under turn-based combat).

- [ ] **Step 1: Write the failing tests**

Add to `game/src/game/scenes/combat/combat-grid-view.test.ts` (the existing `createFakeScene()` fixture already provides `projection: undefined` by default for most tests — these new tests build their own minimal fake projection instead):

```ts
describe('CombatGridView.redrawGridLines() — kích thước lưới lấy từ projection (Battlefield Perspective Panel, 2026-09-06)', () => {
  function createFakeGraphics() {
    return {
      clear: vi.fn(),
      lineStyle: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      strokePath: vi.fn(),
      strokePoints: vi.fn(),
      fillStyle: vi.fn(),
      fillPoints: vi.fn(),
    }
  }

  function createFakeProjection(rows: number, columns: number) {
    return {
      rows,
      columns,
      gridToScreen: (row: number, column: number) => ({ x: column, y: row, scale: 1 }),
      footprintPolygon: () => [],
    }
  }

  it('lưới 6x6 (panel) → 7 đường ngang + 7 đường dọc (rows+1, columns+1), KHÔNG phải 11/17 của lưới thật', () => {
    const { scene, gridView } = createFakeScene()
    const graphics = createFakeGraphics()

    scene.gridGraphics = graphics
    scene.projection = createFakeProjection(6, 6)
    scene.usingArtBackdrop = false
    scene.arenaRect = undefined

    gridView.redrawGridLines()

    expect(graphics.moveTo).toHaveBeenCalledTimes(7 + 7)
  })

  it('KHÔNG còn gọi fillPoints (cổng phòng thủ HERO_COLUMN đã bị xóa — obsolete với turn-based)', () => {
    const { scene, gridView } = createFakeScene()
    const graphics = createFakeGraphics()

    scene.gridGraphics = graphics
    scene.projection = createFakeProjection(10, 16)
    scene.usingArtBackdrop = false
    scene.arenaRect = undefined

    gridView.redrawGridLines()

    expect(graphics.fillPoints).not.toHaveBeenCalled()
  })

  it('perspective mode (arenaRect undefined) vẫn vẽ viền ngoài qua strokePoints (viền KHÔNG bị xóa, chỉ gate polygon bị xóa)', () => {
    const { scene, gridView } = createFakeScene()
    const graphics = createFakeGraphics()

    scene.gridGraphics = graphics
    scene.projection = createFakeProjection(10, 16)
    scene.usingArtBackdrop = false
    scene.arenaRect = undefined

    gridView.redrawGridLines()

    expect(graphics.strokePoints).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run combat-grid-view.test.ts`
Expected: FAIL — `fillPoints` still called (gate code not yet removed); loop count still 11/17 (reads `GRID_ROW_COUNT`/`GRID_COLUMN_COUNT`, not the fake projection's 6/6).

- [ ] **Step 3: Update the import**

In `game/src/game/scenes/combat/combat-grid-view.ts`, change:

```ts
import { GRID_ROW_COUNT, GRID_COLUMN_COUNT, HERO_COLUMN, HERO_LANE_INDEX } from '@/core/battle/BattleLane'
```

to:

```ts
import { HERO_LANE_INDEX } from '@/core/battle/BattleLane'
```

(`GRID_ROW_COUNT`/`GRID_COLUMN_COUNT`/`HERO_COLUMN` are no longer used anywhere in this file after Step 4 — `HERO_LANE_INDEX` stays, it is still used at line 256 for an unrelated default parameter.)

- [ ] **Step 4: Rewrite `redrawGridLines()`**

Replace the entire method body with:

```ts
  redrawGridLines() {
    const graphics = this.host.gridGraphics
    const projection = this.host.projection

    if (!graphics || !projection) {
      return
    }

    graphics.clear()

    // Thanh Vân art mount (yêu cầu 2026-08-26) — art đã có battle-ground
    // riêng ("No layer contains a battle grid") nên KHÔNG vẽ đường chia ô
    // đè lên; giữ grid động cho flat mode dev fallback.
    if (this.host.usingArtBackdrop) {
      return
    }

    const isFlat = Boolean(this.host.arenaRect)

    graphics.lineStyle(
      1,
      isFlat ? LANE_DIVIDER_COLOR : PERSPECTIVE_GRID_COLOR,
      isFlat ? 0.55 : PERSPECTIVE_GRID_ALPHA,
    )

    for (let boundaryRow = 0; boundaryRow <= projection.rows; boundaryRow++) {
      const rowFloat = boundaryRow - 0.5
      const left = projection.gridToScreen(rowFloat, -0.5)
      const right = projection.gridToScreen(rowFloat, projection.columns - 0.5)

      graphics.beginPath()
      graphics.moveTo(left.x, left.y)
      graphics.lineTo(right.x, right.y)
      graphics.strokePath()
    }

    for (let boundaryColumn = 0; boundaryColumn <= projection.columns; boundaryColumn++) {
      const columnFloat = boundaryColumn - 0.5
      const far = projection.gridToScreen(-0.5, columnFloat)
      const near = projection.gridToScreen(projection.rows - 0.5, columnFloat)

      graphics.beginPath()
      graphics.moveTo(far.x, far.y)
      graphics.lineTo(near.x, near.y)
      graphics.strokePath()
    }

    if (!isFlat) {
      // Viền ngoài lưới perspective — dùng chung cho combat thật lẫn panel.
      // (Cổng phòng thủ HERO_COLUMN đã XÓA 2026-09-06: obsolete, cơ chế
      // real-time cũ "quái tiếp cận cổng" không còn tồn tại dưới turn-based.)
      const corners = [
        projection.gridToScreen(-0.5, -0.5),
        projection.gridToScreen(-0.5, projection.columns - 0.5),
        projection.gridToScreen(projection.rows - 0.5, projection.columns - 0.5),
        projection.gridToScreen(projection.rows - 0.5, -0.5),
      ]

      graphics.lineStyle(1.5, PERSPECTIVE_BORDER_COLOR, PERSPECTIVE_BORDER_ALPHA)
      graphics.strokePoints(toVector2Points(corners), true, true)
    }
  }
```

- [ ] **Step 5: Remove now-unused imports/references**

Check whether `PLAYER_COLOR` is still used elsewhere in `combat-grid-view.ts` (it was previously used only by the deleted gate-fill code plus possibly other call sites):

```bash
grep -n "PLAYER_COLOR" game/src/game/scenes/combat/combat-grid-view.ts
```

If the only remaining match is the import line itself, remove `PLAYER_COLOR` from the `import { ... } from './combatConstants'` block. If other call sites still use it, leave the import untouched. (`toVector2Points` stays — still used by the `corners` block above.)

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run combat-grid-view.test.ts` — all pass (existing 8 from Part 1 + 3 new = 11).

- [ ] **Step 7: Type-check + full regression**

Run: `npm.cmd run type-check` + `npx vitest run` (full, no filter) — both green, zero regressions in any `CombatScene.*.test.ts` file.

- [ ] **Step 8: Commit**

```bash
git add game/src/game/scenes/combat/combat-grid-view.ts game/src/game/scenes/combat/combat-grid-view.test.ts
git commit -m "feat(battlefield-perspective-panel): redrawGridLines reads grid size from projection, drop obsolete gate decor"
```

---

### Task 3: Enlarge the panel canvas (360x360 → 420x480)

**Files:**
- Modify: `game/src/components/panels/TranPhapPanel.vue`

**Interfaces:**
- Consumes: nothing new from other tasks (this is a pure size-constant change, independent of Tasks 1-2 and 4).

- [ ] **Step 1: Add the panel size constants**

Near the top of the `<script setup>` block in `TranPhapPanel.vue` (alongside the existing `PREVIEW_CELL_SIZE`/`PREVIEW_GRID_SIZE` import), add:

```ts
// Battlefield Perspective Panel (2026-09-06) — canvas Phaser to hơn kích
// thước lưới thuần (PREVIEW_CELL_SIZE * PREVIEW_GRID_SIZE = 360x360) để có
// không gian thể hiện chiều sâu phối cảnh (xem spec §3). Không đổi CSS
// layout của formation cards/roster queue xung quanh — chỉ canvas Phaser.
const PANEL_CANVAS_WIDTH = 420
const PANEL_CANVAS_HEIGHT = 480
```

- [ ] **Step 2: Use the new constants for the Phaser.Game size**

Change:

```ts
previewGame = new Phaser.Game({
  // ...
  width: PREVIEW_CELL_SIZE * PREVIEW_GRID_SIZE,
  height: PREVIEW_CELL_SIZE * PREVIEW_GRID_SIZE,
  // ...
```

to:

```ts
previewGame = new Phaser.Game({
  // ...
  width: PANEL_CANVAS_WIDTH,
  height: PANEL_CANVAS_HEIGHT,
  // ...
```

- [ ] **Step 3: Type-check**

Run: `npm.cmd run type-check` — 0 errors. (No test file exists for `TranPhapPanel.vue` — this is a pure config-value change with no unit-testable logic; verification happens visually in Task 5.)

- [ ] **Step 4: Commit**

```bash
git add game/src/components/panels/TranPhapPanel.vue
git commit -m "feat(battlefield-perspective-panel): enlarge Tran Phap panel canvas to 420x480"
```

---

### Task 4: `TranPhapCombatPreviewScene` — switch to perspective, two-layer backdrop

**Files:**
- Modify: `game/src/game/scenes/TranPhapCombatPreviewScene.ts`
- Modify: `game/src/game/scenes/TranPhapCombatPreviewScene.test.ts`

**Interfaces:**
- Consumes: `createBattleGridProjection`/`computePerspectiveGeometry` (Task 1), `redrawGridLines()` (Task 2), `PANEL_CANVAS_WIDTH`/`PANEL_CANVAS_HEIGHT` values (Task 3 — duplicated here as local constants since this file has no access to the `.vue` component's script scope; both MUST stay in sync, see Step 3 note).

- [ ] **Step 1: Write the failing test**

Add to `game/src/game/scenes/TranPhapCombatPreviewScene.test.ts`:

```ts
describe('TranPhapCombatPreviewScene — perspective geometry constant (Battlefield Perspective Panel, 2026-09-06)', () => {
  it('PANEL_WIDTH/PANEL_HEIGHT khớp CHÍNH XÁC với canvas Phaser thật trong TranPhapPanel.vue (420x480)', () => {
    expect(PANEL_WIDTH).toBe(420)
    expect(PANEL_HEIGHT).toBe(480)
  })

  it('PERSPECTIVE_MIN_ROAD_HEIGHT_PANEL nhỏ hơn hằng số combat thật (320) — panel cần sàn thấp hơn cho canvas nhỏ', () => {
    expect(PERSPECTIVE_MIN_ROAD_HEIGHT_PANEL).toBeLessThan(320)
  })
})
```

Merge the new names into the test file's existing import line — change:

```ts
import { PREVIEW_CELL_SIZE, previewCellTopLeft } from './TranPhapCombatPreviewScene'
```

to:

```ts
import {
  PREVIEW_CELL_SIZE,
  previewCellTopLeft,
  PANEL_WIDTH,
  PANEL_HEIGHT,
  PERSPECTIVE_MIN_ROAD_HEIGHT_PANEL,
} from './TranPhapCombatPreviewScene'
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run TranPhapCombatPreviewScene.test.ts`
Expected: FAIL — `PANEL_WIDTH`/`PANEL_HEIGHT`/`PERSPECTIVE_MIN_ROAD_HEIGHT_PANEL` are not exported yet.

- [ ] **Step 3: Add the new constants and imports**

In `game/src/game/scenes/TranPhapCombatPreviewScene.ts`, add to the imports:

```ts
import { createBattleGridProjection, computePerspectiveGeometry } from '@/game/support/BattleGridProjection'
```

Add near `PREVIEW_CELL_SIZE`/`PREVIEW_GRID_SIZE`:

```ts
// PHẢI khớp CHÍNH XÁC với PANEL_CANVAS_WIDTH/HEIGHT trong TranPhapPanel.vue
// (Task 3, cùng plan) — 2 nơi định nghĩa vì .vue component và scene này
// không chia sẻ được scope; đổi 1 bên PHẢI đổi bên kia. Nếu lệch, canvas
// Phaser thật sẽ khác kích thước scene tự tính (méo layout nhưng không
// crash — an toàn nhưng sai hình).
export const PANEL_WIDTH = 420
export const PANEL_HEIGHT = 480
export const PERSPECTIVE_MIN_ROAD_HEIGHT_PANEL = 140

const PANEL_SKY_COLOR = 0x22283a
const PANEL_GROUND_COLOR = 0x1a1a1a
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run TranPhapCombatPreviewScene.test.ts` — 5/5 pass (3 existing `previewCellTopLeft` + 2 new).

- [ ] **Step 5: Switch `isPerspective` and add sky/ground layer fields**

Change:

```ts
export class TranPhapCombatPreviewScene extends Phaser.Scene implements CombatGridViewHost {
  readonly isPerspective = false
  projection: BattleGridProjection | undefined
  gridGraphics: Phaser.GameObjects.Graphics | undefined
  readonly usingArtBackdrop = false
  arenaRect: Phaser.GameObjects.Rectangle | undefined
```

to:

```ts
export class TranPhapCombatPreviewScene extends Phaser.Scene implements CombatGridViewHost {
  // Battlefield Perspective Panel (2026-09-06) — chuyển từ flat sang
  // perspective; combat-grid-view.ts's applySpriteSize()/positionSprite()
  // tự rẽ nhánh áp dụng applyEntityDepthScale() khi cờ này true (đã build
  // sẵn từ Part 1, không cần sửa gì thêm ở 2 hàm đó).
  readonly isPerspective = true
  projection: BattleGridProjection | undefined
  gridGraphics: Phaser.GameObjects.Graphics | undefined
  readonly usingArtBackdrop = false
  // arenaRect luôn undefined ở panel (chỉ combat thật's flat mode dùng nó
  // để CombatGridView.redrawGridLines() phân biệt flat/perspective qua
  // Boolean(this.host.arenaRect) — panel LUÔN perspective nên giữ
  // undefined là đúng, KHÔNG gán Rectangle nào vào field này).
  arenaRect: Phaser.GameObjects.Rectangle | undefined
  private skyLayer: Phaser.GameObjects.Rectangle | undefined
  private groundLayer: Phaser.GameObjects.Rectangle | undefined
```

- [ ] **Step 6: Rewrite `create()`**

Replace the entire `create()` method body:

```ts
  create(): void {
    this.gridView = new CombatGridView(this)

    const geometry = computePerspectiveGeometry(
      { width: PANEL_WIDTH, height: PANEL_HEIGHT, topInset: 0, bottomInset: 0 },
      PERSPECTIVE_MIN_ROAD_HEIGHT_PANEL,
    )

    // 2 lớp nền phẳng (sky/ground) — KHÔNG dùng attachBattlefieldBackdrop()
    // của combat thật (sao/trăng/núi/đá quá cầu kỳ cho panel test, và
    // cũng hardcode GRID_ROW_COUNT/COLUMN_COUNT). Đặt tên rõ ràng để sau
    // này thay Rectangle bằng Image thật chỉ cần đổi loại GameObject, giữ
    // nguyên vị trí gọi.
    this.skyLayer = this.add.rectangle(0, 0, PANEL_WIDTH, geometry.horizonY, PANEL_SKY_COLOR).setOrigin(0, 0)
    this.groundLayer = this.add
      .rectangle(0, geometry.horizonY, PANEL_WIDTH, geometry.roadHeight, PANEL_GROUND_COLOR)
      .setOrigin(0, 0)

    this.projection = createBattleGridProjection(
      'perspective',
      { width: PANEL_WIDTH, height: PANEL_HEIGHT, topInset: 0, bottomInset: 0 },
      PREVIEW_GRID_SIZE,
      PREVIEW_GRID_SIZE,
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
```

(This removes the old hand-rolled flat background rectangle + hand-rolled `Graphics` grid-line loop entirely — both are now provided by `computePerspectiveGeometry()`/`redrawGridLines()`.)

- [ ] **Step 7: Update `syncAssignments()`'s sprite positioning call**

`positionSprite(sprite, worldColumn, _id)` already reads `this.host.isPerspective` internally (from Part 1) to decide foot-anchor vs. center-anchor positioning — no call-site change is needed in `syncAssignments()` itself. Re-read the method to confirm no other flat-specific assumption remains:

```bash
grep -n "isPerspective\|arenaRect" game/src/game/scenes/TranPhapCombatPreviewScene.ts
```

Expected: `isPerspective` appears once (the field declaration, now `true`), `arenaRect` appears once (the field declaration, still `undefined`). No other conditional logic in this file branches on either — confirming `syncAssignments()` needs no edits.

- [ ] **Step 8: Run tests to verify**

Run: `npx vitest run TranPhapCombatPreviewScene.test.ts` — 5/5 pass.

- [ ] **Step 9: Type-check + full regression**

Run: `npm.cmd run type-check` + `npx vitest run` (full, no filter) — both green.

- [ ] **Step 10: Commit**

```bash
git add game/src/game/scenes/TranPhapCombatPreviewScene.ts game/src/game/scenes/TranPhapCombatPreviewScene.test.ts
git commit -m "feat(battlefield-perspective-panel): TranPhapCombatPreviewScene switches to perspective mode with sky/ground backdrop"
```

---

### Task 5: Final verification + roadmap update

- [ ] Run `npx vitest run` — full suite green, confirm test count only grew by the new tests added in Tasks 1, 2, and 4 (no unrelated file changed test counts).
- [ ] Run `npm.cmd run type-check` — zero errors.
- [ ] Run `npx vitest run BattleGridProjection.test.ts combat-grid-view.test.ts TranPhapCombatPreviewScene.test.ts` explicitly and confirm all new + existing tests pass — the three files with the highest blast-radius risk in this plan.
- [ ] Grep-diff every `CombatScene.*.test.ts` file's pass/fail count against the Task 1 baseline (`npx vitest run` output before this plan started vs. now) — must be identical counts, proving zero behavior change to real combat (both the projection generalization AND the gate-decor removal must not affect any assertion in these files — if a test explicitly asserted on the old gate-fill visual, STOP and report rather than silently deleting the assertion).
- [ ] Playwright manual pass: `npm run dev`, open the Trận Pháp panel, select "Hỗn Độn Trận" — confirm: (a) canvas is visibly larger and taller than before; (b) a horizon line is visible separating a lighter "sky" band from a darker "ground" band; (c) grid lines converge toward the horizon (far row visibly narrower than near row); (d) drag the player card into a far row (row 0) and a near row (row 5) — the far-row sprite renders visibly smaller than the near-row sprite (depth scale working).
- [ ] Start one real battle (any stage) and confirm combat renders exactly as before this plan (player visible and animating, enemies render correctly, grid lines and outer border still visible, no visual regression from the gate-decor removal beyond the intended removal itself) — proves Task 1/2's generalization introduced no regression to the live game, not just to test files.
- [ ] Update `game/docs/roadmap.md` with a section noting: `BattleGridProjection` and `combat-grid-view.ts`'s `redrawGridLines()` are now grid-size-agnostic (rows/columns parameterized); the obsolete real-time "defense gate" highlight is removed from grid rendering; the Trận Pháp panel (`TranPhapCombatPreviewScene`) now renders in full 2.5D perspective at 420x480 with a two-layer sky/ground backdrop; this is Part 2 of a four-part initiative — Parts 3 (wave spawn redesign) and 4 (spawn VFX wiring for turn-based combat) are separate future specs, not started.
- [ ] Commit: `git commit -m "docs: roadmap - Battlefield Perspective Panel shipped (Part 2 of 4)"`.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-09-06-battlefield-perspective-panel.md`. This plan is written for a **separate executor session/agent** (per the user's standing preference from Part 1) — set up an isolated worktree first (`superpowers:using-git-worktrees`, `.agent-worktrees/battlefield-perspective-panel` per this project's convention) **based on `master` AFTER Part 1 has merged**, then run it with `superpowers:executing-plans` (batch execution with human checkpoints) or `superpowers:subagent-driven-development` (fresh subagent per task, automated review loop) — either works; Tasks 1 and 2 are the ones that warrant a careful, unhurried reviewer given their blast radius on live combat rendering (both the real 10x16 grid AND the visual removal of the gate decor).
