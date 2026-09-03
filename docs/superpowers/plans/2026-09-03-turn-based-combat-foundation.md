# Turn-Based Combat Engine — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the standalone, unit-tested primitives of the turn-based
combat engine (ATB gauge/turn queue, charge/channel locking, AOE shape
resolution, bounce chains, TrueShot flag, boss turn-triggers, and the
Momentum/Break turn conversion) as new modules under
`game/src/core/battle/turn/`, without yet touching `BattleSystem.ts` or
`CombatSystem.ts`.

**Architecture:** Each primitive is a small pure-function module with its
own narrow input type, decoupled from the real `CombatEntity`/`Battle`
types so it can be built and fully tested in isolation. AOE shapes and
bounce reuse the existing `BattleGrid.ts` grid math
(`getCellsInArea`, `getChebyshevDistance`) rather than reinventing grid
logic. This plan produces no player-visible behavior change — it is pure
scaffolding for the wiring/cutover plan that follows it.

**Tech Stack:** TypeScript, Vitest (`describe`/`expect`/`it`, matching the
existing `BattleGrid.test.ts` convention). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-03-turn-based-combat-design.md`

## Global Constraints

- Grid is 10 rows × 16 columns, already defined in
  `game/src/core/battle/BattleGrid.ts` — reuse it, do not redefine grid
  dimensions or coordinate math anywhere in this plan.
- `GAUGE_MAX = 1000` is the starting tuning constant (spec §9 leaves exact
  tuning open — this value is a placeholder deliberately chosen to be
  round and easy to reason about in tests; it is not a design decision
  that needs revisiting to build the engine).
- No project dependency changes. No `any` unless truly unavoidable (project
  rule in `game/CLAUDE.md`).
- This plan does NOT modify `BattleSystem.ts`, `CombatSystem.ts`,
  `SkillEffectResolver.ts`, or any other existing production file — every
  task creates new files only. Wiring these primitives into the live
  combat loop, converting Reaction Engine call sites, and migrating
  individual skills (Kiếm Trận, Bạt Kiếm, Momentum/Break's real current
  home, etc.) is significant additional work and is explicitly left to a
  follow-up plan (see "Not Covered" at the end of this document).

---

## Task 1: ActionGauge — core gauge primitives

**Files:**
- Create: `game/src/core/battle/turn/ActionGauge.ts`
- Test: `game/src/core/battle/turn/ActionGauge.test.ts`

**Interfaces:**
- Produces: `GAUGE_MAX: number`, `interface GaugeActor { id: string; speed: number; actionGauge: number; alive: boolean }`, `advanceGauge(actor: GaugeActor, stepRate: number): void`, `isGaugeReady(actor: GaugeActor): boolean`, `consumeGaugeAfterAction(actor: GaugeActor, fractionConsumed?: number): void`, `refundGauge(actor: GaugeActor, amount: number): void`.

- [ ] **Step 1: Write the failing test**

```typescript
// game/src/core/battle/turn/ActionGauge.test.ts
import { describe, expect, it } from 'vitest'
import {
  GAUGE_MAX,
  advanceGauge,
  isGaugeReady,
  consumeGaugeAfterAction,
  refundGauge,
  type GaugeActor,
} from './ActionGauge'

function makeActor(speed: number, actionGauge = 0): GaugeActor {
  return { id: 'a', speed, actionGauge, alive: true }
}

describe('ActionGauge', () => {
  it('advanceGauge: gauge tăng theo speed * stepRate', () => {
    const actor = makeActor(10)
    advanceGauge(actor, 1)
    expect(actor.actionGauge).toBe(10)
    advanceGauge(actor, 2)
    expect(actor.actionGauge).toBe(30)
  })

  it('isGaugeReady: true khi gauge >= GAUGE_MAX', () => {
    const actor = makeActor(0, GAUGE_MAX - 1)
    expect(isGaugeReady(actor)).toBe(false)
    actor.actionGauge = GAUGE_MAX
    expect(isGaugeReady(actor)).toBe(true)
    actor.actionGauge = GAUGE_MAX + 50
    expect(isGaugeReady(actor)).toBe(true)
  })

  it('consumeGaugeAfterAction: mặc định reset toàn bộ (full turn)', () => {
    const actor = makeActor(0, GAUGE_MAX + 50)
    consumeGaugeAfterAction(actor)
    expect(actor.actionGauge).toBe(0)
  })

  it('consumeGaugeAfterAction: fractionConsumed=0.5 chỉ trừ nửa GAUGE_MAX', () => {
    const actor = makeActor(0, GAUGE_MAX)
    consumeGaugeAfterAction(actor, 0.5)
    expect(actor.actionGauge).toBe(GAUGE_MAX * 0.5)
  })

  it('consumeGaugeAfterAction: không âm khi trừ nhiều hơn gauge hiện có', () => {
    const actor = makeActor(0, 100)
    consumeGaugeAfterAction(actor, 1)
    expect(actor.actionGauge).toBe(0)
  })

  it('refundGauge: cộng thêm nhưng clamp ở GAUGE_MAX', () => {
    const actor = makeActor(0, GAUGE_MAX - 100)
    refundGauge(actor, 300)
    expect(actor.actionGauge).toBe(GAUGE_MAX)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run game/src/core/battle/turn/ActionGauge.test.ts`
Expected: FAIL — `./ActionGauge` does not exist.

- [ ] **Step 3: Write minimal implementation**

```typescript
// game/src/core/battle/turn/ActionGauge.ts
// Turn-Based Combat Foundation (2026-09-03 spec, Phần 3) — thanh hành
// động ATB: mỗi entity tích luỹ actionGauge theo speed mỗi "step" (đơn vị
// logic rời rạc, KHÔNG phải giây thực). Ai đạt GAUGE_MAX trước hành động
// trước — xem TurnQueue.ts cho vòng lặp tìm actor kế tiếp.

export const GAUGE_MAX = 1000

export interface GaugeActor {
  id: string
  speed: number
  actionGauge: number
  alive: boolean
}

export function advanceGauge(actor: GaugeActor, stepRate: number): void {
  actor.actionGauge += actor.speed * stepRate
}

export function isGaugeReady(actor: GaugeActor): boolean {
  return actor.actionGauge >= GAUGE_MAX
}

/**
 * Tiêu hao gauge sau khi hành động. fractionConsumed=1 (mặc định) = reset
 * hoàn toàn (lượt thường). fractionConsumed<1 = hành động "rẻ" (spec: chỉ
 * tốn nửa gauge), actor còn lại gần lượt kế hơn.
 */
export function consumeGaugeAfterAction(actor: GaugeActor, fractionConsumed = 1): void {
  const clamped = Math.min(1, Math.max(0, fractionConsumed))
  actor.actionGauge = Math.max(0, actor.actionGauge - GAUGE_MAX * clamped)
}

/** Hồi gauge tức thời (vd buff "+300 gauge khi kill") — clamp ở GAUGE_MAX. */
export function refundGauge(actor: GaugeActor, amount: number): void {
  actor.actionGauge = Math.min(GAUGE_MAX, actor.actionGauge + amount)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run game/src/core/battle/turn/ActionGauge.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add game/src/core/battle/turn/ActionGauge.ts game/src/core/battle/turn/ActionGauge.test.ts
git commit -m "feat(turn-combat): add ActionGauge primitives for ATB engine"
```

---

## Task 2: TurnQueue — find the next actor to act

**Files:**
- Create: `game/src/core/battle/turn/TurnQueue.ts`
- Test: `game/src/core/battle/turn/TurnQueue.test.ts`

**Interfaces:**
- Consumes: `GaugeActor`, `advanceGauge`, `isGaugeReady` from `./ActionGauge` (Task 1).
- Produces: `interface TurnQueueActor extends GaugeActor { priority: number }`, `interface ResolvedTurn<T> { actor: T; steps: number }`, `resolveNextTurn<T extends TurnQueueActor>(actors: T[]): ResolvedTurn<T> | null`.

- [ ] **Step 1: Write the failing test**

```typescript
// game/src/core/battle/turn/TurnQueue.test.ts
import { describe, expect, it } from 'vitest'
import { resolveNextTurn, type TurnQueueActor } from './TurnQueue'

function makeActor(id: string, speed: number, priority: number): TurnQueueActor {
  return { id, speed, priority, actionGauge: 0, alive: true }
}

describe('TurnQueue.resolveNextTurn', () => {
  it('actor speed cao nhất luôn đến lượt trước tính từ 0', () => {
    const fast = makeActor('fast', 20, 0)
    const slow = makeActor('slow', 5, 1)
    const result = resolveNextTurn([fast, slow])
    expect(result?.actor.id).toBe('fast')
  })

  it('tie-break: speed bằng nhau thì priority thấp hơn đi trước', () => {
    const a = makeActor('a', 10, 1)
    const b = makeActor('b', 10, 0)
    const result = resolveNextTurn([a, b])
    expect(result?.actor.id).toBe('b')
  })

  it('actor đã chết bị loại khỏi hàng đợi', () => {
    const dead = makeActor('dead', 999, 0)
    dead.alive = false
    const alive = makeActor('alive', 1, 1)
    const result = resolveNextTurn([dead, alive])
    expect(result?.actor.id).toBe('alive')
  })

  it('mảng rỗng hoặc toàn bộ đã chết trả về null', () => {
    const dead = makeActor('dead', 10, 0)
    dead.alive = false
    expect(resolveNextTurn([dead])).toBeNull()
    expect(resolveNextTurn([])).toBeNull()
  })

  it('gauge của actor thắng lượt được tính đúng theo speed * steps', () => {
    const actor = makeActor('a', 100, 0)
    const result = resolveNextTurn([actor])
    expect(result?.actor.actionGauge).toBe((result?.steps ?? 0) * 100)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run game/src/core/battle/turn/TurnQueue.test.ts`
Expected: FAIL — `./TurnQueue` does not exist.

- [ ] **Step 3: Write minimal implementation**

```typescript
// game/src/core/battle/turn/TurnQueue.ts
// Turn-Based Combat Foundation (spec Phần 3) — vòng lặp step tìm actor kế
// tiếp đến lượt. priority chỉ dùng khi speed bằng nhau tuyệt đối (spec:
// player > ally theo slot > enemy theo spawn — caller truyền priority
// theo đúng thứ tự đó, số nhỏ hơn = ưu tiên cao hơn).
import { advanceGauge, isGaugeReady, type GaugeActor } from './ActionGauge'

export interface TurnQueueActor extends GaugeActor {
  priority: number
}

export interface ResolvedTurn<T extends TurnQueueActor> {
  actor: T
  steps: number
}

const STEP_RATE = 1

// Chặn vòng lặp vô hạn nếu MỌI actor còn sống đều có speed <= 0 (vd toàn
// bộ bị debuff speed=0) — không phải edge case bịa ra, Break/CC có thể
// đưa speed về 0 (xem MomentumBreak.ts).
const MAX_STEPS = 100_000

export function resolveNextTurn<T extends TurnQueueActor>(actors: T[]): ResolvedTurn<T> | null {
  const living = actors.filter((actor) => actor.alive)
  if (living.length === 0) {
    return null
  }

  for (let steps = 1; steps <= MAX_STEPS; steps++) {
    for (const actor of living) {
      advanceGauge(actor, STEP_RATE)
    }

    const ready = living.filter(isGaugeReady)
    if (ready.length === 0) {
      continue
    }

    ready.sort((a, b) => {
      if (a.speed !== b.speed) {
        return b.speed - a.speed
      }
      return a.priority - b.priority
    })

    return { actor: ready[0]!, steps }
  }

  return null
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run game/src/core/battle/turn/TurnQueue.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add game/src/core/battle/turn/TurnQueue.ts game/src/core/battle/turn/TurnQueue.test.ts
git commit -m "feat(turn-combat): add TurnQueue.resolveNextTurn ATB resolver"
```

---

## Task 3: ChannelQueue — charge/channel lock (replaces real-time Cast Time)

**Files:**
- Create: `game/src/core/battle/turn/ChannelQueue.ts`
- Test: `game/src/core/battle/turn/ChannelQueue.test.ts`

**Interfaces:**
- Produces: `interface ChargingAction { actorId: string; remainingTurns: number }`, `beginCharge(actorId: string, chargeSteps: number): ChargingAction`, `isCharging(charges: ChargingAction[], actorId: string): boolean`, `interface ChargeTickResult { resolved: string[]; remaining: ChargingAction[] }`, `tickChargesOnTurnResolved(charges: ChargingAction[]): ChargeTickResult`.
- Integration note (for the follow-up wiring plan, not built here): the
  caller excludes any `actorId` present in `charges` from the array passed
  to `resolveNextTurn` (Task 2) — that is how a channeling entity "does not
  re-enter the gauge race" per spec §3. `tickChargesOnTurnResolved` is
  called once every time `resolveNextTurn` returns a turn for ANY actor.

- [ ] **Step 1: Write the failing test**

```typescript
// game/src/core/battle/turn/ChannelQueue.test.ts
import { describe, expect, it } from 'vitest'
import { beginCharge, isCharging, tickChargesOnTurnResolved } from './ChannelQueue'

describe('ChannelQueue', () => {
  it('beginCharge: chargeSteps < 1 vẫn chốt tối thiểu 1 lượt', () => {
    expect(beginCharge('boss', 0).remainingTurns).toBe(1)
    expect(beginCharge('boss', 3).remainingTurns).toBe(3)
  })

  it('isCharging: true khi actorId có mặt trong danh sách charges', () => {
    const charges = [beginCharge('boss', 2)]
    expect(isCharging(charges, 'boss')).toBe(true)
    expect(isCharging(charges, 'player')).toBe(false)
  })

  it('tickChargesOnTurnResolved: giảm dần, chưa hết thì còn trong remaining', () => {
    const charges = [beginCharge('boss', 2)]
    const first = tickChargesOnTurnResolved(charges)
    expect(first.resolved).toEqual([])
    expect(first.remaining).toEqual([{ actorId: 'boss', remainingTurns: 1 }])
  })

  it('tickChargesOnTurnResolved: về 0 thì actorId chuyển sang resolved', () => {
    const charges = [{ actorId: 'boss', remainingTurns: 1 }]
    const result = tickChargesOnTurnResolved(charges)
    expect(result.resolved).toEqual(['boss'])
    expect(result.remaining).toEqual([])
  })

  it('tickChargesOnTurnResolved: nhiều charge độc lập nhau', () => {
    const charges = [
      { actorId: 'boss', remainingTurns: 1 },
      { actorId: 'kiem_tu', remainingTurns: 3 },
    ]
    const result = tickChargesOnTurnResolved(charges)
    expect(result.resolved).toEqual(['boss'])
    expect(result.remaining).toEqual([{ actorId: 'kiem_tu', remainingTurns: 2 }])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run game/src/core/battle/turn/ChannelQueue.test.ts`
Expected: FAIL — `./ChannelQueue` does not exist.

- [ ] **Step 3: Write minimal implementation**

```typescript
// game/src/core/battle/turn/ChannelQueue.ts
// Turn-Based Combat Foundation (spec Phần 3) — thay thế Cast Time thời
// gian thực: entity chọn skill có chargeSteps thì KHÔNG resolve ngay,
// bị khoá khỏi vòng đua gauge (integration layer loại actorId này khỏi
// resolveNextTurn) cho đến khi đủ remainingTurns lượt của NGƯỜI KHÁC đã
// trôi qua. Không cho phép hành động sớm hoặc bị bỏ qua giữa chừng.

export interface ChargingAction {
  actorId: string
  remainingTurns: number
}

export function beginCharge(actorId: string, chargeSteps: number): ChargingAction {
  return { actorId, remainingTurns: Math.max(1, chargeSteps) }
}

export function isCharging(charges: ChargingAction[], actorId: string): boolean {
  return charges.some((charge) => charge.actorId === actorId)
}

export interface ChargeTickResult {
  resolved: string[]
  remaining: ChargingAction[]
}

export function tickChargesOnTurnResolved(charges: ChargingAction[]): ChargeTickResult {
  const resolved: string[] = []
  const remaining: ChargingAction[] = []

  for (const charge of charges) {
    const remainingTurns = charge.remainingTurns - 1

    if (remainingTurns <= 0) {
      resolved.push(charge.actorId)
    } else {
      remaining.push({ actorId: charge.actorId, remainingTurns })
    }
  }

  return { resolved, remaining }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run game/src/core/battle/turn/ChannelQueue.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add game/src/core/battle/turn/ChannelQueue.ts game/src/core/battle/turn/ChannelQueue.test.ts
git commit -m "feat(turn-combat): add ChannelQueue charge-lock for delayed actions"
```

---

## Task 4: AoeShape — targeting shapes anchored on the target cell

**Files:**
- Create: `game/src/core/battle/turn/AoeShape.ts`
- Test: `game/src/core/battle/turn/AoeShape.test.ts`

**Interfaces:**
- Consumes: `getCellsInArea`, `type CellArea`, `type GridPosition` from `../BattleGrid` (existing file, unchanged).
- Produces: `type AoeShapeId = 'single' | 'cross' | 'square' | 'line' | 'row' | 'column'`, `interface AoeShapeSpec { shape: AoeShapeId; radius: number; axis?: 'row' | 'column' }`, `boundingBoxForShape(anchor: GridPosition, spec: AoeShapeSpec): CellArea`, `isCellInShape(anchor: GridPosition, spec: AoeShapeSpec, cell: GridPosition): boolean`.

- [ ] **Step 1: Write the failing test**

```typescript
// game/src/core/battle/turn/AoeShape.test.ts
import { describe, expect, it } from 'vitest'
import { boundingBoxForShape, isCellInShape, type AoeShapeSpec } from './AoeShape'
import type { GridPosition } from '../BattleGrid'

const anchor: GridPosition = { row: 5, column: 8 }

describe('AoeShape', () => {
  it('single: chỉ đúng 1 ô anchor', () => {
    const spec: AoeShapeSpec = { shape: 'single', radius: 0 }
    expect(isCellInShape(anchor, spec, anchor)).toBe(true)
    expect(isCellInShape(anchor, spec, { row: 5, column: 9 })).toBe(false)
  })

  it('cross: cùng hàng hoặc cùng cột trong bán kính — KHÔNG phải khối vuông', () => {
    const spec: AoeShapeSpec = { shape: 'cross', radius: 1 }
    expect(isCellInShape(anchor, spec, { row: 5, column: 9 })).toBe(true) // cùng hàng, cách 1
    expect(isCellInShape(anchor, spec, { row: 6, column: 8 })).toBe(true) // cùng cột, cách 1
    expect(isCellInShape(anchor, spec, { row: 6, column: 9 })).toBe(false) // chéo — KHÔNG thuộc cross
    expect(isCellInShape(anchor, spec, { row: 5, column: 10 })).toBe(false) // cùng hàng nhưng ngoài bán kính
  })

  it('square: khối vuông đầy đủ quanh anchor (bao gồm cả ô chéo)', () => {
    const spec: AoeShapeSpec = { shape: 'square', radius: 1 }
    expect(isCellInShape(anchor, spec, { row: 6, column: 9 })).toBe(true) // chéo, trong square
    expect(isCellInShape(anchor, spec, { row: 7, column: 8 })).toBe(false) // ngoài bán kính
  })

  it('line: dải chữ nhật dài theo 1 trục (thay Pierce)', () => {
    const spec: AoeShapeSpec = { shape: 'line', radius: 3, axis: 'column' }
    expect(isCellInShape(anchor, spec, { row: 5, column: 11 })).toBe(true)
    expect(isCellInShape(anchor, spec, { row: 6, column: 11 })).toBe(false) // khác hàng
  })

  it('row/column: phủ hết chiều grid, clamp ở biên qua getCellsInArea', () => {
    const rowSpec: AoeShapeSpec = { shape: 'row', radius: 0 }
    expect(isCellInShape(anchor, rowSpec, { row: 5, column: 0 })).toBe(true)
    expect(isCellInShape(anchor, rowSpec, { row: 5, column: 15 })).toBe(true)
    expect(isCellInShape(anchor, rowSpec, { row: 4, column: 0 })).toBe(false)
  })

  it('boundingBoxForShape: square trả về CellArea clamp đúng biên grid', () => {
    const box = boundingBoxForShape({ row: 0, column: 0 }, { shape: 'square', radius: 2 })
    expect(box.rowStart).toBe(0)
    expect(box.colStart).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run game/src/core/battle/turn/AoeShape.test.ts`
Expected: FAIL — `./AoeShape` does not exist.

- [ ] **Step 3: Write minimal implementation**

```typescript
// game/src/core/battle/turn/AoeShape.ts
// Turn-Based Combat Foundation (spec Phần 4) — mọi shape neo tại Ô MỤC
// TIÊU (anchor = target cell, KHÔNG phải ô người thực hiện). boundingBox
// dùng cho VFX (khối chữ nhật clamp biên qua getCellsInArea sẵn có);
// isCellInShape mới là luật targeting THẬT — cross là hình chữ thập, một
// khối chữ nhật clamp sẽ SAI (sẽ lẫn cả ô chéo).
import { getCellsInArea, type CellArea, type GridPosition } from '../BattleGrid'

export type AoeShapeId = 'single' | 'cross' | 'square' | 'line' | 'row' | 'column'

export interface AoeShapeSpec {
  shape: AoeShapeId
  radius: number
  /** Bắt buộc cho 'line': trục nào là chiều dài (thay Pierce cũ). */
  axis?: 'row' | 'column'
}

// Đủ lớn để phủ hết 10x16 khi dùng cho 'row'/'column' — getCellsInArea tự
// clamp về biên grid thật, không cần biết GRID_ROW_COUNT/GRID_COLUMN_COUNT
// ở đây.
const FULL_GRID_RADIUS = 999

export function boundingBoxForShape(anchor: GridPosition, spec: AoeShapeSpec): CellArea {
  switch (spec.shape) {
    case 'single':
      return getCellsInArea(anchor, 0, 0)
    case 'cross':
    case 'square':
      return getCellsInArea(anchor, spec.radius, spec.radius)
    case 'line':
      return spec.axis === 'row'
        ? getCellsInArea(anchor, spec.radius, 0)
        : getCellsInArea(anchor, 0, spec.radius)
    case 'row':
      return getCellsInArea(anchor, 0, FULL_GRID_RADIUS)
    case 'column':
      return getCellsInArea(anchor, FULL_GRID_RADIUS, 0)
  }
}

function isWithinBox(cell: GridPosition, box: CellArea): boolean {
  return (
    cell.row >= box.rowStart &&
    cell.row <= box.rowEnd &&
    cell.column >= box.colStart &&
    cell.column <= box.colEnd
  )
}

export function isCellInShape(anchor: GridPosition, spec: AoeShapeSpec, cell: GridPosition): boolean {
  switch (spec.shape) {
    case 'single':
      return cell.row === anchor.row && cell.column === anchor.column
    case 'cross':
      return (
        (cell.column === anchor.column && Math.abs(cell.row - anchor.row) <= spec.radius) ||
        (cell.row === anchor.row && Math.abs(cell.column - anchor.column) <= spec.radius)
      )
    case 'row':
      return cell.row === anchor.row
    case 'column':
      return cell.column === anchor.column
    case 'square':
    case 'line':
      return isWithinBox(cell, boundingBoxForShape(anchor, spec))
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run game/src/core/battle/turn/AoeShape.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add game/src/core/battle/turn/AoeShape.ts game/src/core/battle/turn/AoeShape.test.ts
git commit -m "feat(turn-combat): add AoeShape targeting shapes (single/cross/square/line/row/column)"
```

---

## Task 5: BounceChain — chain to nearest untouched target

**Files:**
- Create: `game/src/core/battle/turn/BounceChain.ts`
- Test: `game/src/core/battle/turn/BounceChain.test.ts`

**Interfaces:**
- Consumes: `getChebyshevDistance`, `type GridPosition` from `../BattleGrid`.
- Produces: `interface BounceCandidate { id: string; position: GridPosition; alive: boolean }`, `resolveBounceChain(candidates: BounceCandidate[], startTargetId: string, bounceArea: number, bounceCount: number): string[]`.

- [ ] **Step 1: Write the failing test**

```typescript
// game/src/core/battle/turn/BounceChain.test.ts
import { describe, expect, it } from 'vitest'
import { resolveBounceChain, type BounceCandidate } from './BounceChain'

const candidates: BounceCandidate[] = [
  { id: 'target', position: { row: 0, column: 0 }, alive: true },
  { id: 'near', position: { row: 0, column: 1 }, alive: true },
  { id: 'far', position: { row: 0, column: 10 }, alive: true },
  { id: 'dead', position: { row: 0, column: 2 }, alive: false },
]

describe('resolveBounceChain', () => {
  it('nảy tới entity gần nhất còn sống, chưa bị chain, trong bounceArea', () => {
    const chain = resolveBounceChain(candidates, 'target', 3, 1)
    expect(chain).toEqual(['target', 'near'])
  })

  it('bỏ qua entity đã chết', () => {
    const onlyDead: BounceCandidate[] = [
      { id: 'target', position: { row: 0, column: 0 }, alive: true },
      { id: 'dead', position: { row: 0, column: 1 }, alive: false },
    ]
    const chain = resolveBounceChain(onlyDead, 'target', 3, 1)
    expect(chain).toEqual(['target'])
  })

  it('dừng sớm nếu không còn entity hợp lệ trong bounceArea (không lỗi)', () => {
    const chain = resolveBounceChain(candidates, 'target', 1, 5)
    expect(chain).toEqual(['target', 'near'])
  })

  it('không bounce tới entity đã bị chain trước đó', () => {
    const trio: BounceCandidate[] = [
      { id: 'a', position: { row: 0, column: 0 }, alive: true },
      { id: 'b', position: { row: 0, column: 1 }, alive: true },
      { id: 'c', position: { row: 0, column: 2 }, alive: true },
    ]
    const chain = resolveBounceChain(trio, 'a', 5, 2)
    expect(chain).toEqual(['a', 'b', 'c'])
  })

  it('bounceCount=0 chỉ trả về target gốc', () => {
    expect(resolveBounceChain(candidates, 'target', 5, 0)).toEqual(['target'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run game/src/core/battle/turn/BounceChain.test.ts`
Expected: FAIL — `./BounceChain` does not exist.

- [ ] **Step 3: Write minimal implementation**

```typescript
// game/src/core/battle/turn/BounceChain.ts
// Turn-Based Combat Foundation (spec Phần 4) — thay Projectile Bounce cũ:
// không còn vật lý di chuyển, resolve toàn bộ chuỗi nảy tức thời trong 1
// lần gọi. Không tìm được mục tiêu hợp lệ thì DỪNG SỚM, không phải lỗi.
import { getChebyshevDistance, type GridPosition } from '../BattleGrid'

export interface BounceCandidate {
  id: string
  position: GridPosition
  alive: boolean
}

export function resolveBounceChain(
  candidates: BounceCandidate[],
  startTargetId: string,
  bounceArea: number,
  bounceCount: number,
): string[] {
  const chain: string[] = [startTargetId]
  const visited = new Set<string>([startTargetId])
  let currentId = startTargetId

  for (let hop = 0; hop < bounceCount; hop++) {
    const current = candidates.find((candidate) => candidate.id === currentId)
    if (!current) {
      break
    }

    const next = candidates
      .filter((candidate) => candidate.alive && !visited.has(candidate.id))
      .filter(
        (candidate) => getChebyshevDistance(current.position, candidate.position) <= bounceArea,
      )
      .sort(
        (a, b) =>
          getChebyshevDistance(current.position, a.position) -
          getChebyshevDistance(current.position, b.position),
      )[0]

    if (!next) {
      break
    }

    chain.push(next.id)
    visited.add(next.id)
    currentId = next.id
  }

  return chain
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run game/src/core/battle/turn/BounceChain.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add game/src/core/battle/turn/BounceChain.ts game/src/core/battle/turn/BounceChain.test.ts
git commit -m "feat(turn-combat): add BounceChain nearest-target chain resolver"
```

---

## Task 6: TrueShot — evasion-ignore flag (replaces Homing)

**Files:**
- Create: `game/src/core/battle/turn/TrueShot.ts`
- Test: `game/src/core/battle/turn/TrueShot.test.ts`

**Interfaces:**
- Produces: `interface TrueShotFlaggable { ignoresEvasion?: boolean }`, `bypassesEvasion(skill: TrueShotFlaggable): boolean`.

- [ ] **Step 1: Write the failing test**

```typescript
// game/src/core/battle/turn/TrueShot.test.ts
import { describe, expect, it } from 'vitest'
import { bypassesEvasion } from './TrueShot'

describe('bypassesEvasion', () => {
  it('true khi skill có ignoresEvasion: true', () => {
    expect(bypassesEvasion({ ignoresEvasion: true })).toBe(true)
  })

  it('false khi ignoresEvasion: false hoặc không khai báo', () => {
    expect(bypassesEvasion({ ignoresEvasion: false })).toBe(false)
    expect(bypassesEvasion({})).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run game/src/core/battle/turn/TrueShot.test.ts`
Expected: FAIL — `./TrueShot` does not exist.

- [ ] **Step 3: Write minimal implementation**

```typescript
// game/src/core/battle/turn/TrueShot.ts
// Turn-Based Combat Foundation (spec Phần 4) — thay Homing cũ: không còn
// là cơ chế targeting (không "xuyên tường" tìm mục tiêu ẩn), chỉ là 1 cờ
// damage bỏ qua Dodge/Evasion lúc resolve. Target vẫn phải hợp lệ theo
// luật targeting bình thường (xem AoeShape.ts / grid targeting).
export interface TrueShotFlaggable {
  ignoresEvasion?: boolean
}

export function bypassesEvasion(skill: TrueShotFlaggable): boolean {
  return skill.ignoresEvasion === true
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run game/src/core/battle/turn/TrueShot.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add game/src/core/battle/turn/TrueShot.ts game/src/core/battle/turn/TrueShot.test.ts
git commit -m "feat(turn-combat): add TrueShot evasion-bypass flag (replaces Homing)"
```

---

## Task 7: BossTurnTriggers — afterTurns Enrage/Summon condition

**Files:**
- Create: `game/src/core/battle/turn/BossTurnTriggers.ts`
- Test: `game/src/core/battle/turn/BossTurnTriggers.test.ts`

**Interfaces:**
- Produces: `interface TurnTriggerCondition { afterTurns: number }`, `isTurnTriggerReady(condition: TurnTriggerCondition, totalTurnsElapsed: number): boolean`.
- Integration note: `totalTurnsElapsed` is a counter the wiring layer
  increments once per resolved turn (any actor) since battle start — this
  replaces `battle.elapsedSeconds` from the old `updateEnrage()`. The
  caller still owns a "has this already fired" flag per boss, exactly like
  the current `battleEnemy.enrageApplied` — that flag is not part of this
  primitive.

- [ ] **Step 1: Write the failing test**

```typescript
// game/src/core/battle/turn/BossTurnTriggers.test.ts
import { describe, expect, it } from 'vitest'
import { isTurnTriggerReady, type TurnTriggerCondition } from './BossTurnTriggers'

describe('isTurnTriggerReady', () => {
  it('false trước khi đủ số lượt', () => {
    const condition: TurnTriggerCondition = { afterTurns: 5 }
    expect(isTurnTriggerReady(condition, 4)).toBe(false)
  })

  it('true đúng lúc đạt mốc và sau đó', () => {
    const condition: TurnTriggerCondition = { afterTurns: 5 }
    expect(isTurnTriggerReady(condition, 5)).toBe(true)
    expect(isTurnTriggerReady(condition, 10)).toBe(true)
  })

  it('afterTurns=0 luôn sẵn sàng ngay từ lượt đầu', () => {
    expect(isTurnTriggerReady({ afterTurns: 0 }, 0)).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run game/src/core/battle/turn/BossTurnTriggers.test.ts`
Expected: FAIL — `./BossTurnTriggers` does not exist.

- [ ] **Step 3: Write minimal implementation**

```typescript
// game/src/core/battle/turn/BossTurnTriggers.ts
// Turn-Based Combat Foundation (spec Phần 5) — thay enrage.afterSeconds
// cũ: đếm theo TỔNG SỐ LƯỢT đã trôi qua từ đầu trận (không phải lượt
// riêng của boss), khớp cadence "đánh hết wave mới spawn wave mới".
export interface TurnTriggerCondition {
  afterTurns: number
}

export function isTurnTriggerReady(
  condition: TurnTriggerCondition,
  totalTurnsElapsed: number,
): boolean {
  return totalTurnsElapsed >= condition.afterTurns
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run game/src/core/battle/turn/BossTurnTriggers.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add game/src/core/battle/turn/BossTurnTriggers.ts game/src/core/battle/turn/BossTurnTriggers.test.ts
git commit -m "feat(turn-combat): add BossTurnTriggers afterTurns Enrage/Summon condition"
```

---

## Task 8: MomentumBreak — turn-based Momentum decay and Break duration

**Files:**
- Create: `game/src/core/battle/turn/MomentumBreak.ts`
- Test: `game/src/core/battle/turn/MomentumBreak.test.ts`

**Interfaces:**
- Produces: `interface MomentumState { stack: number; breakTurnsRemaining: number }`, `onHitLanded(state: MomentumState, gain: number): MomentumState`, `onTurnStartWithoutHit(state: MomentumState, decay: number): MomentumState`, `checkBreakThreshold(state: MomentumState, threshold: number, breakDurationTurns: number): MomentumState`, `tickBreakOnTurnStart(state: MomentumState): MomentumState`, `isBroken(state: MomentumState): boolean`.

- [ ] **Step 1: Write the failing test**

```typescript
// game/src/core/battle/turn/MomentumBreak.test.ts
import { describe, expect, it } from 'vitest'
import {
  onHitLanded,
  onTurnStartWithoutHit,
  checkBreakThreshold,
  tickBreakOnTurnStart,
  isBroken,
  type MomentumState,
} from './MomentumBreak'

describe('MomentumBreak', () => {
  it('onHitLanded: stack cộng dồn theo gain', () => {
    const state: MomentumState = { stack: 10, breakTurnsRemaining: 0 }
    expect(onHitLanded(state, 5).stack).toBe(15)
  })

  it('onTurnStartWithoutHit: decay không xuống dưới 0', () => {
    const state: MomentumState = { stack: 3, breakTurnsRemaining: 0 }
    expect(onTurnStartWithoutHit(state, 5).stack).toBe(0)
  })

  it('checkBreakThreshold: vượt ngưỡng thì reset stack và bắt đầu Break N lượt', () => {
    const state: MomentumState = { stack: 100, breakTurnsRemaining: 0 }
    const result = checkBreakThreshold(state, 100, 3)
    expect(result).toEqual({ stack: 0, breakTurnsRemaining: 3 })
  })

  it('checkBreakThreshold: chưa đủ ngưỡng thì giữ nguyên state', () => {
    const state: MomentumState = { stack: 50, breakTurnsRemaining: 0 }
    expect(checkBreakThreshold(state, 100, 3)).toEqual(state)
  })

  it('tickBreakOnTurnStart: đếm lùi breakTurnsRemaining mỗi lượt', () => {
    const state: MomentumState = { stack: 0, breakTurnsRemaining: 2 }
    const afterOne = tickBreakOnTurnStart(state)
    expect(afterOne.breakTurnsRemaining).toBe(1)
    expect(isBroken(afterOne)).toBe(true)
    const afterTwo = tickBreakOnTurnStart(afterOne)
    expect(afterTwo.breakTurnsRemaining).toBe(0)
    expect(isBroken(afterTwo)).toBe(false)
  })

  it('tickBreakOnTurnStart: không xuống âm khi đã hết Break', () => {
    const state: MomentumState = { stack: 0, breakTurnsRemaining: 0 }
    expect(tickBreakOnTurnStart(state).breakTurnsRemaining).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run game/src/core/battle/turn/MomentumBreak.test.ts`
Expected: FAIL — `./MomentumBreak` does not exist.

- [ ] **Step 3: Write minimal implementation**

```typescript
// game/src/core/battle/turn/MomentumBreak.ts
// Turn-Based Combat Foundation (spec Phần 5) — Momentum gain vẫn theo sự
// kiện (đòn trúng, không đổi). Decay đổi từ "mỗi giây thực" sang "mỗi lần
// đến lượt mà KHÔNG đánh trúng kể từ lượt trước". Break đổi từ "N giây"
// sang "N lượt".
export interface MomentumState {
  stack: number
  breakTurnsRemaining: number
}

export function onHitLanded(state: MomentumState, gain: number): MomentumState {
  return { ...state, stack: state.stack + gain }
}

export function onTurnStartWithoutHit(state: MomentumState, decay: number): MomentumState {
  return { ...state, stack: Math.max(0, state.stack - decay) }
}

export function checkBreakThreshold(
  state: MomentumState,
  threshold: number,
  breakDurationTurns: number,
): MomentumState {
  if (state.stack < threshold) {
    return state
  }

  return { stack: 0, breakTurnsRemaining: breakDurationTurns }
}

export function tickBreakOnTurnStart(state: MomentumState): MomentumState {
  if (state.breakTurnsRemaining <= 0) {
    return state
  }

  return { ...state, breakTurnsRemaining: state.breakTurnsRemaining - 1 }
}

export function isBroken(state: MomentumState): boolean {
  return state.breakTurnsRemaining > 0
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run game/src/core/battle/turn/MomentumBreak.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add game/src/core/battle/turn/MomentumBreak.ts game/src/core/battle/turn/MomentumBreak.test.ts
git commit -m "feat(turn-combat): add MomentumBreak turn-based decay/Break duration"
```

---

## Task 9: ResourceTurnHook — generic turn-start resource delta

**Files:**
- Create: `game/src/core/battle/turn/ResourceTurnHook.ts`
- Test: `game/src/core/battle/turn/ResourceTurnHook.test.ts`

**Interfaces:**
- Produces: `interface TurnResourceDelta { stat: string; amount: number; min?: number; max?: number }`, `applyTurnStartDeltas(current: Record<string, number>, deltas: TurnResourceDelta[]): Record<string, number>`.
- This is the general-purpose primitive behind spec §5's rule ("every
  resource change happens at the moment an entity's own turn begins") —
  covers Ngũ Hành Thế, Kiếm Thế/Kiếm Ý, and Kim Thế decay generically.
  `MomentumBreak.ts` (Task 8) is a separate, Thể-Tu-specific consumer of
  the same rule and does not depend on this module — it exists because
  Momentum/Break also carries Break-duration state that a flat
  stat-delta map can't represent.

- [ ] **Step 1: Write the failing test**

```typescript
// game/src/core/battle/turn/ResourceTurnHook.test.ts
import { describe, expect, it } from 'vitest'
import { applyTurnStartDeltas, type TurnResourceDelta } from './ResourceTurnHook'

describe('applyTurnStartDeltas', () => {
  it('cộng amount vào stat hiện có', () => {
    const result = applyTurnStartDeltas({ hoaThe: 2 }, [{ stat: 'hoaThe', amount: 1 }])
    expect(result.hoaThe).toBe(3)
  })

  it('stat chưa tồn tại coi như bắt đầu từ 0', () => {
    const result = applyTurnStartDeltas({}, [{ stat: 'kiemThe', amount: 5 }])
    expect(result.kiemThe).toBe(5)
  })

  it('amount âm dùng để decay (vd Kim Thế discrete decay)', () => {
    const result = applyTurnStartDeltas({ kimThe: 10 }, [{ stat: 'kimThe', amount: -3 }])
    expect(result.kimThe).toBe(7)
  })

  it('clamp theo min/max nếu có khai báo', () => {
    const result = applyTurnStartDeltas({ kimThe: 1 }, [
      { stat: 'kimThe', amount: -10, min: 0 },
    ])
    expect(result.kimThe).toBe(0)
  })

  it('không mutate object đầu vào (trả về object mới)', () => {
    const current = { hoaThe: 2 }
    const result = applyTurnStartDeltas(current, [{ stat: 'hoaThe', amount: 1 }])
    expect(current.hoaThe).toBe(2)
    expect(result).not.toBe(current)
  })

  it('nhiều delta độc lập trong cùng 1 lượt', () => {
    const result = applyTurnStartDeltas({ hoaThe: 0, kimThe: 5 }, [
      { stat: 'hoaThe', amount: 2 },
      { stat: 'kimThe', amount: -1 },
    ])
    expect(result).toEqual({ hoaThe: 2, kimThe: 4 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run game/src/core/battle/turn/ResourceTurnHook.test.ts`
Expected: FAIL — `./ResourceTurnHook` does not exist.

- [ ] **Step 3: Write minimal implementation**

```typescript
// game/src/core/battle/turn/ResourceTurnHook.ts
// Turn-Based Combat Foundation (spec Phần 5) — thay MỌI regen/decay
// resource theo deltaSeconds (Ngũ Hành Thế, Kiếm Thế/Kiếm Ý, Kim Thế
// decay...): áp dụng đúng 1 lần tại thời điểm entity bắt đầu lượt của
// chính nó, không có clock thứ hai song song với ActionGauge.
export interface TurnResourceDelta {
  stat: string
  amount: number
  min?: number
  max?: number
}

export function applyTurnStartDeltas(
  current: Record<string, number>,
  deltas: TurnResourceDelta[],
): Record<string, number> {
  const next = { ...current }

  for (const delta of deltas) {
    const min = delta.min ?? -Infinity
    const max = delta.max ?? Infinity
    const value = (next[delta.stat] ?? 0) + delta.amount

    next[delta.stat] = Math.min(max, Math.max(min, value))
  }

  return next
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run game/src/core/battle/turn/ResourceTurnHook.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add game/src/core/battle/turn/ResourceTurnHook.ts game/src/core/battle/turn/ResourceTurnHook.test.ts
git commit -m "feat(turn-combat): add generic ResourceTurnHook for turn-start stat deltas"
```

---

## Task 10: Full-suite verification

- [ ] **Step 1: Run the entire new `turn/` test suite together**

Run: `npx vitest run game/src/core/battle/turn/`
Expected: PASS — 8 files, 34 tests total (6+5+5+6+5+2+3+7 — see Tasks 1-8).

- [ ] **Step 2: Run the project's full existing test suite to confirm zero regressions**

Run: `cd game && npx vitest run`
Expected: PASS — identical pass count to before this plan (every task in this plan only adds new files under `game/src/core/battle/turn/`; nothing existing was modified, imported, or wired in).

- [ ] **Step 3: Run typecheck**

Run: `cd game && npx vue-tsc --noEmit` (or the project's existing typecheck script — check `game/package.json` `"scripts"` for the exact name, e.g. `npm run typecheck`)
Expected: PASS, no new errors.

- [ ] **Step 4: Commit if any fixups were needed**

```bash
git add -A
git commit -m "test(turn-combat): verify foundation suite + no regressions"
```

(Skip this commit if Steps 1-3 all passed with no changes needed.)

---

## Not Covered By This Plan

This plan only builds and unit-tests the standalone primitives. It
deliberately does **not**:

- Wire any of these modules into `BattleSystem.ts` or replace its
  `tick(deltaSeconds)` loop.
- Convert the Reaction Engine's call site from per-frame `tick()` to
  synchronous action resolution (spec §5).
- Migrate any specific skill (Kiếm Trận, Bạt Kiếm, the 5 Ngũ Hành
  elements, etc.) from the real-time model to the turn model.
- Design or implement the AI action-policy for Auto mode (spec §9 —
  explicitly flagged as needing its own short design pass first).
- Remove any existing real-time code (`MissileSystem`, cast-bar UI,
  `deltaSeconds`-based resource regen in `PhapTuBattleResourceSystem.ts`,
  `KiemTuResourceSystem.ts`, etc.).
- Touch the party/companion system (explicitly out of scope per the spec).
- Build the Skill Loadout system (5 freely-assignable slots + fixed
  Ultimate slot, spec §4.5) or any manual-play skill-selection UI —
  that's a data/UI layer on top of this engine, not a turn-engine
  primitive, and needs its own plan.

These are substantial, separate efforts — each should get its own
brainstorming pass and plan once this foundation is merged, rather than
being bolted onto this plan as vague "integrate everything" tasks.
