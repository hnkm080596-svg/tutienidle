# Combat Art Pipeline + Companion Roster + Trận Pháp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the dead combat-art sync pipeline, add real sprite-sheet animation, redraw the battlefield into two 6×6 side boxes, then build a gacha companion roster and a drag-and-drop Trận Pháp (formation) panel that lets the player preset who enters battle and where.

**Architecture:** Three dependency-ordered parts in one plan (explicit user decision — this project's usual "one spec/plan per system" convention is overridden here because the three systems were designed together and the middle one (Companion Roster) has no other consumer, while the first (Combat Art Pipeline) and third (Trận Pháp) share the same `GameManager.buildTurnBattle()` integration point and must not be edited by two independent, uncoordinated passes.

- **Part A — Combat Art Pipeline** (Tasks 1–9): fixes the dead entity-sync bridge, adds sprite-sheet animation, splits the battlefield into `PLAYER_SIDE_REGION`/`ENEMY_SIDE_REGION`, adds the right-side skill dock.
- **Part B — Companion Roster** (Tasks 10–15): gacha-recruited companions, fixed skill kits, own leveling track, zero equipment.
- **Part C — Trận Pháp** (Tasks 16–21): drag-and-drop formation panel consuming both A and B, replacing Part A's placeholder single-player default with the real feature.

**Tech Stack:** Vue 3 + TypeScript (Composition API, `<script setup>`), Phaser 4, Vitest.

**Spec:**
- `docs/superpowers/specs/2026-09-05-combat-art-pipeline-rework-design.md` (Part A)
- `docs/superpowers/specs/2026-09-05-companion-roster-system-design.md` (Part B)
- `docs/superpowers/specs/2026-09-05-tran-phap-formation-system-design.md` (Part C)

## Global Constraints

- TypeScript, no `any`.
- Vietnamese comments/strings match the codebase's existing convention (see any file in `game/src/core/battle/turn/`).
- No change to `getChebyshevDistance()`, `entityGridPosition()`, `collectTurnTargets()`, `selectTarget()`, or any AoE shape/targeting formula — every region/formation change is a placement constraint only, never a distance-math change (spec §6/§1.3 of Combat Art Pipeline).
- Do not touch `game/src/core/battle/legacy/**` (retired real-time engine).
- New `PlayerData` fields always get an explicit default in `createDefaultPlayer()` (never left `undefined` relying on call-site fallback — established project convention).
- Every new `PlayerData` field bumps `CURRENT_SAVE_VERSION` in `game/src/services/save/saveVersion.ts` with a dated comment block describing the change (dev-phase convention: old saves are rejected, no migration).
- Run `npx vitest run` and `npx vue-tsc --noEmit` clean before moving to the next task.

---

# Part A — Combat Art Pipeline

## Task 1: Battlefield side regions (`PLAYER_SIDE_REGION`/`ENEMY_SIDE_REGION`)

**Files:**
- Create: `game/src/core/battle/BattlefieldRegions.ts`
- Test: `game/src/core/battle/BattlefieldRegions.test.ts`

**Interfaces:**
- Produces: `BattlefieldUsableRegion { rowMin: LaneIndex; rowMax: LaneIndex; columnMin: number; columnMax: number }`, `PLAYER_SIDE_REGION`, `ENEMY_SIDE_REGION`, `NEUTRAL_DIVIDER_COLUMN: number`, `DEFAULT_BATTLEFIELD_USABLE_REGION`, `centerOfRegion(region): GridPosition`.
- Consumes: `LaneIndex`, `GridPosition` from `game/src/core/battle/BattleGrid.ts` (already exported, confirmed at `BattleGrid.ts:28-33`).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import {
  PLAYER_SIDE_REGION,
  ENEMY_SIDE_REGION,
  NEUTRAL_DIVIDER_COLUMN,
  DEFAULT_BATTLEFIELD_USABLE_REGION,
  centerOfRegion,
} from './BattlefieldRegions'

describe('BattlefieldRegions', () => {
  it('player side is rows 3-8, columns 0-5', () => {
    expect(PLAYER_SIDE_REGION).toEqual({ rowMin: 3, rowMax: 8, columnMin: 0, columnMax: 5 })
  })

  it('enemy side is rows 3-8, columns 7-12', () => {
    expect(ENEMY_SIDE_REGION).toEqual({ rowMin: 3, rowMax: 8, columnMin: 7, columnMax: 12 })
  })

  it('column 6 is the neutral divider, excluded from both sides', () => {
    expect(NEUTRAL_DIVIDER_COLUMN).toBe(6)
    expect(PLAYER_SIDE_REGION.columnMax).toBeLessThan(NEUTRAL_DIVIDER_COLUMN)
    expect(ENEMY_SIDE_REGION.columnMin).toBeGreaterThan(NEUTRAL_DIVIDER_COLUMN)
  })

  it('bounding box spans both sides plus the divider', () => {
    expect(DEFAULT_BATTLEFIELD_USABLE_REGION).toEqual({ rowMin: 3, rowMax: 8, columnMin: 0, columnMax: 12 })
  })

  it('centerOfRegion floors to the nearest cell', () => {
    expect(centerOfRegion(ENEMY_SIDE_REGION)).toEqual({ row: 5, column: 9 })
    expect(centerOfRegion(PLAYER_SIDE_REGION)).toEqual({ row: 5, column: 2 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run BattlefieldRegions.test.ts`
Expected: FAIL with "Cannot find module './BattlefieldRegions'".

- [ ] **Step 3: Implement**

Create `game/src/core/battle/BattlefieldRegions.ts`:

```ts
// Battlefield region redesign (2026-09-05, Combat Art Pipeline spec §6) —
// battlefield is two 6x6 boxes (player/enemy), sharing rows 3-8, split by
// a neutral divider column neither side may occupy. Distance/targeting/AoE
// math is UNCHANGED — this only constrains WHERE entities may be placed.
import type { GridPosition, LaneIndex } from './BattleGrid'

export interface BattlefieldUsableRegion {
  rowMin: LaneIndex
  rowMax: LaneIndex
  columnMin: number
  columnMax: number
}

const BATTLEFIELD_ROW_RANGE = { rowMin: 3 as LaneIndex, rowMax: 8 as LaneIndex }

export const PLAYER_SIDE_REGION: BattlefieldUsableRegion = {
  ...BATTLEFIELD_ROW_RANGE,
  columnMin: 0,
  columnMax: 5,
}

export const NEUTRAL_DIVIDER_COLUMN = 6

export const ENEMY_SIDE_REGION: BattlefieldUsableRegion = {
  ...BATTLEFIELD_ROW_RANGE,
  columnMin: 7,
  columnMax: 12,
}

/** Bounding box of both sides + the divider — for camera/projection fit, NOT entity placement. */
export const DEFAULT_BATTLEFIELD_USABLE_REGION: BattlefieldUsableRegion = {
  ...BATTLEFIELD_ROW_RANGE,
  columnMin: 0,
  columnMax: 12,
}

export function centerOfRegion(region: BattlefieldUsableRegion): GridPosition {
  return {
    row: Math.floor((region.rowMin + region.rowMax) / 2) as LaneIndex,
    column: Math.floor((region.columnMin + region.columnMax) / 2),
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run BattlefieldRegions.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add game/src/core/battle/BattlefieldRegions.ts game/src/core/battle/BattlefieldRegions.test.ts
git commit -m "feat(combat-art): add PLAYER_SIDE_REGION/ENEMY_SIDE_REGION battlefield split"
```

## Task 2: Enemy spawn confined to `ENEMY_SIDE_REGION`, boss forced to center

**Files:**
- Modify: `game/src/core/battle/EnemySpawnPlacement.ts` (currently: boss always `HERO_LANE_INDEX` row + random column 7-15; regular enemies random row 0-9 + random column 7-15 — full file read, 35 lines)
- Modify: `game/src/core/battle/EnemySpawnPlacement.test.ts` (existing assertions pin the OLD behavior — must be updated, not left alongside new ones)

**Interfaces:**
- Consumes: `PLAYER_SIDE_REGION`/`ENEMY_SIDE_REGION`/`centerOfRegion` from Task 1's `BattlefieldRegions.ts`.
- Produces: `resolveEnemySpawnPosition(input: EnemySpawnPlacementInput): GridPosition` — same name/signature, new internal behavior.

- [ ] **Step 1: Write the failing tests**

Read the current `game/src/core/battle/EnemySpawnPlacement.test.ts` file first — it has existing tests asserting boss row = `HERO_LANE_INDEX` and regular-enemy row range `[0, GRID_ROW_COUNT)`. Replace its full contents:

```ts
import { describe, expect, it } from 'vitest'
import { resolveEnemySpawnPosition } from './EnemySpawnPlacement'
import { ENEMY_SIDE_REGION } from './BattlefieldRegions'

function fixedRandom(value: number): () => number {
  return () => value
}

describe('resolveEnemySpawnPosition', () => {
  it('regular enemy: row and column both randomized within ENEMY_SIDE_REGION', () => {
    const position = resolveEnemySpawnPosition({ isBoss: false, random: fixedRandom(0) })

    expect(position.row).toBe(ENEMY_SIDE_REGION.rowMin)
    expect(position.column).toBe(ENEMY_SIDE_REGION.columnMin)
  })

  it('regular enemy: random(0.999...) rolls the top of the region range', () => {
    const position = resolveEnemySpawnPosition({ isBoss: false, random: fixedRandom(0.9999) })

    expect(position.row).toBe(ENEMY_SIDE_REGION.rowMax)
    expect(position.column).toBe(ENEMY_SIDE_REGION.columnMax)
  })

  it('boss: always forced to the exact center of ENEMY_SIDE_REGION, ignores random()', () => {
    const position = resolveEnemySpawnPosition({ isBoss: true, random: fixedRandom(0) })

    expect(position).toEqual({ row: 5, column: 9 })

    const positionAgain = resolveEnemySpawnPosition({ isBoss: true, random: fixedRandom(0.9999) })

    expect(positionAgain).toEqual({ row: 5, column: 9 })
  })

  it('never returns a cell in the neutral divider or player side', () => {
    for (const sample of [0, 0.25, 0.5, 0.75, 0.999]) {
      const position = resolveEnemySpawnPosition({ isBoss: false, random: fixedRandom(sample) })

      expect(position.column).toBeGreaterThanOrEqual(ENEMY_SIDE_REGION.columnMin)
      expect(position.column).toBeLessThanOrEqual(ENEMY_SIDE_REGION.columnMax)
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run EnemySpawnPlacement.test.ts`
Expected: FAIL — current implementation rolls row `[0,9]`/column `[7,15]` and boss row is `HERO_LANE_INDEX` (4), not `{row:5, column:9}`.

- [ ] **Step 3: Implement**

Replace `game/src/core/battle/EnemySpawnPlacement.ts`:

```ts
// EnemySpawnPlacement — resolver thuần chọn ô spawn cho quái, giới hạn
// trong ENEMY_SIDE_REGION (Combat Art Pipeline spec §6/§7, 2026-09-05).
// Boss LUÔN ở trung tâm vùng địch (không còn cùng hàng với player).
// NHIỀU quái được phép spawn trùng hoàn toàn một ô — resolver KHÔNG nhận
// occupied/reserved cells và KHÔNG BAO GIỜ trả null.
import type { GridPosition } from './BattleGrid'
import { ENEMY_SIDE_REGION, centerOfRegion, type BattlefieldUsableRegion } from './BattlefieldRegions'

export interface EnemySpawnPlacementInput {
  isBoss: boolean

  /** RNG tiêm từ ngoài (Math.random hoặc seeded) — deterministic test được. */
  random: () => number
}

/** Số nguyên trong [min, max] bằng ĐÚNG MỘT lần gọi random(). */
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

  const row = randomIntInclusive(input.random, region.rowMin, region.rowMax)
  const column = randomIntInclusive(input.random, region.columnMin, region.columnMax)

  return { row: row as GridPosition['row'], column }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run EnemySpawnPlacement.test.ts`
Expected: PASS.

- [ ] **Step 5: Regression check — `GameManager.buildTurnBattle()`'s enemy spawn call site**

`GameManager.ts:2419-2426` calls `resolveEnemySpawnPosition({ isBoss, random: Math.random })` with no `region` arg — the new default parameter (`ENEMY_SIDE_REGION`) keeps this call site working unchanged. Run:

Run: `npx vitest run GameManager`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add game/src/core/battle/EnemySpawnPlacement.ts game/src/core/battle/EnemySpawnPlacement.test.ts
git commit -m "feat(combat-art): confine enemy spawn to ENEMY_SIDE_REGION, force boss to region center"
```

## Task 3: `PartyFormationSlot`/`DEFAULT_PARTY_FORMATION` + `buildTurnBattle()` reads from it

**Files:**
- Create: `game/src/core/game/PartyFormation.ts`
- Test: `game/src/core/game/PartyFormation.test.ts`
- Modify: `game/src/core/game/GameManager.ts:2405-2434` (`buildTurnBattle()`, currently hardcodes `players: [playerParticipant]`)

**Interfaces:**
- Produces: `PartyFormationSlot { combatantId: string; row: LaneIndex; column: number }`, `DEFAULT_PARTY_FORMATION: PartyFormationSlot[]`.
- Consumes: `HERO_LANE_INDEX`/`HERO_COLUMN` from `game/src/core/battle/BattleLane.ts` (confirmed exports at `BattleLane.ts:19,26`).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { DEFAULT_PARTY_FORMATION } from './PartyFormation'
import { HERO_LANE_INDEX, HERO_COLUMN } from '../battle/BattleLane'

describe('DEFAULT_PARTY_FORMATION', () => {
  it('is exactly one slot: the player at the current fixed hero position', () => {
    expect(DEFAULT_PARTY_FORMATION).toEqual([
      { combatantId: 'player', row: HERO_LANE_INDEX, column: HERO_COLUMN },
    ])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run PartyFormation.test.ts`
Expected: FAIL with "Cannot find module './PartyFormation'".

- [ ] **Step 3: Implement**

Create `game/src/core/game/PartyFormation.ts`:

```ts
// PartyFormation (Combat Art Pipeline spec §7, 2026-09-05) — data-driven
// party placement, replacing the hardcoded players: [playerParticipant].
// combatantId is 'player' or a companion's definitionId (Companion Roster
// spec §5) — NOT a numeric index, since the real feature (Trận Pháp)
// mixes the player with companions by id, not an ordered interchangeable
// list. DEFAULT_PARTY_FORMATION is the fallback for a player who has never
// configured a Trận Pháp — byte-identical to today's only real case.
import type { LaneIndex } from '../battle/BattleGrid'
import { HERO_LANE_INDEX, HERO_COLUMN } from '../battle/BattleLane'

export interface PartyFormationSlot {
  combatantId: string
  row: LaneIndex
  column: number
}

export const DEFAULT_PARTY_FORMATION: PartyFormationSlot[] = [
  { combatantId: 'player', row: HERO_LANE_INDEX, column: HERO_COLUMN },
]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run PartyFormation.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing test for `buildTurnBattle()` reading the formation**

Find `GameManager.buildTurnBattle()`'s current body (private method, `GameManager.ts:2405-2434`) and its existing test coverage by running:

Run: `npx vitest run GameManager --grep buildTurnBattle -t ""` (if no test currently names `buildTurnBattle` directly, use any existing `GameManager.*.test.ts` that calls `startBattle`/`startStage` and inspects `getTurnBattle()!.players`, e.g. `GameManager.actionPlayback.test.ts`'s `battleReady()` helper — add a new assertion there rather than guessing a new file).

Add to `game/src/core/game/GameManager.partyFormation.test.ts` (new file, using the same `createPlayer`/`createBasicSkill`/`createDummy` fixture helpers as `GameManager.actionPlayback.test.ts:12-50` — copy them verbatim into this new file, matching this codebase's per-test-file fixture convention):

```ts
import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import { defineEnemy } from '../enemy/Enemy'
import { createBaseStats } from '../stats/StatBlock'
import { HERO_LANE_INDEX, HERO_COLUMN } from '../battle/BattleLane'
import type { CombatEntity } from '../combat/CombatEntity'
import type { Skill } from '../skill/Skill'

function createPlayer(): CombatEntity {
  const stats = { ...createBaseStats(), attack: 50, speed: 100, criticalRate: 0 }

  return {
    id: 'player', name: 'Player', type: 'player', baseStats: stats, stats,
    currentHp: stats.maxHp, maxHp: stats.maxHp, currentMp: stats.maxMp,
    currentSwordIntent: 0, currentMomentum: 0, currentHoaThe: 0, currentThoThe: 0, currentKimThe: 0,
    timeSinceLastBleedProc: 0, tuLucActive: false, tuLucElapsed: 0, tuLucDamageTakenPercent: 0,
    currentWard: 0, timeSinceLastHitTaken: Infinity, realmIndex: 0, x: 0, row: 4, alive: true,
  }
}

function createBasicSkill(): Skill {
  return {
    id: 'basic_test', name: 'Basic', description: '', type: 'active', level: 1, maxLevel: 10,
    cooldown: 0, remainingCooldown: 0, cost: 0, target: 'enemy',
    effects: [{ type: 'damage', value: 1, damageType: 'physical' }],
    execution: { kind: 'attack_speed' }, resourceType: 'none',
    unlocked: true, equipped: true, loadoutSlot: 0, loadoutSlots: [0],
  }
}

function createDummy() {
  return defineEnemy({
    id: 'formation_dummy', name: 'Formation Dummy', level: 1, realmId: 'mortal', lane: 'ground',
    statsInput: { maxHp: 1, attack: 0, attackSpeed: 1, attackRangeRanks: 9, criticalRate: 0, criticalDamage: 1.5, armor: 0 },
    rewards: { techniqueInsight: 0, spiritStone: 0 },
  })
}

describe('GameManager.buildTurnBattle — reads DEFAULT_PARTY_FORMATION when no formation is configured', () => {
  it('places the single player participant at HERO_LANE_INDEX/HERO_COLUMN, id "player"', () => {
    const gameManager = new GameManager()
    const player = createPlayer()

    gameManager.registerSkillTemplates([createBasicSkill()])
    gameManager.learnSkill('basic_test')
    gameManager.skillSystem.equipToSlot('basic_test', 0)
    gameManager.startBattle(player, createDummy())

    const battle = gameManager.getTurnBattle()!

    expect(battle.players).toHaveLength(1)
    expect(battle.players[0]!.id).toBe('player')
    expect(battle.players[0]!.entity.row).toBe(HERO_LANE_INDEX)
    expect(battle.players[0]!.entity.x).toBe(HERO_COLUMN)
  })
})
```

- [ ] **Step 6: Run test to verify it fails (or passes by coincidence — check `entity.x`)**

Run: `npx vitest run GameManager.partyFormation.test.ts`
Expected: likely FAIL on `entity.x` (today's `playerToCombatEntity()` sets `x: 0`, not `HERO_COLUMN`/1 — confirmed at `Player.ts:429`). This is the exact gap Task 3 closes: the player's `x` must become formation-driven instead of left at its placeholder 0.

- [ ] **Step 7: Rewrite `buildTurnBattle()` to apply `PartyFormationSlot` positions**

Read `GameManager.ts:2405-2434` fresh (the plan's paraphrase may drift from the merged codebase) before editing. Replace the enemy-mapping section's player-construction lines and the `players:` array:

```ts
  private buildTurnBattle(playerEntity: CombatEntity, enemyEntities: CombatEntity[]): TurnBattle {
    const playerPath = this.activePlayer

    const formation = DEFAULT_PARTY_FORMATION // Task 16+ (Trận Pháp) replaces this with player.formationLoadout-driven resolution

    const playerSlot = formation.find((slot) => slot.combatantId === 'player')

    if (playerSlot) {
      playerEntity.row = playerSlot.row
      playerEntity.x = playerSlot.column
    }

    const playerParticipant = toTurnBattleParticipant(
      playerEntity,
      0,
      playerPath ? this.resolvePlayerBasicAttack(playerPath) : GENERIC_PHYSICAL_BASIC,
      playerPath?.cultivationPath,
    )

    const enemyParticipants = enemyEntities.map((enemyEntity, index) => {
      const position = resolveEnemySpawnPosition({
        isBoss: enemyEntity.isBoss ?? false,
        random: Math.random,
      })

      enemyEntity.row = position.row
      enemyEntity.x = position.column

      return toTurnBattleParticipant(enemyEntity, index + 1, GENERIC_PHYSICAL_BASIC)
    })

    return {
      players: [playerParticipant],
      enemies: enemyParticipants,
      state: 'countdown',
      // ... rest of the object UNCHANGED — read the current tail of
      // buildTurnBattle() fresh and keep every other field exactly as-is.
```

Add the import at the top of `GameManager.ts` alongside the other `game/` imports:

```ts
import { DEFAULT_PARTY_FORMATION } from './PartyFormation'
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx vitest run GameManager.partyFormation.test.ts`
Expected: PASS.

- [ ] **Step 9: Full regression**

Run: `npx vitest run`
Expected: PASS — `HERO_COLUMN` is 1, close to the old placeholder `x: 0`, but confirm no test asserted the exact old `x: 0` value for the player entity (grep `toBe(0)`/`.x).toBe(0)` scoped to player-entity assertions in the test suite before treating a failure here as unrelated).

- [ ] **Step 10: Commit**

```bash
git add game/src/core/game/PartyFormation.ts game/src/core/game/PartyFormation.test.ts game/src/core/game/GameManager.partyFormation.test.ts game/src/core/game/GameManager.ts
git commit -m "feat(combat-art): buildTurnBattle() places the player via PartyFormationSlot instead of a hardcoded placeholder x"
```

## Task 4: Entity-sync event replaces the dead legacy `positions` bridge

**Files:**
- Modify: `game/src/core/battle/turn/TurnActionPresentationEvents.ts` (existing file — add one new emitter alongside `emitTurnReady`/`emitTurnCastStart`/`emitTurnActionImpact`/`emitTurnStandbyComplete`, read it fresh for the exact `EventBus`-import/emit pattern those four already use)
- Modify: `game/src/core/game/GameManager.ts:3470-3521` (`updateBattleFixedStep()`)
- Test: `game/src/core/battle/turn/TurnActionPresentationEvents.test.ts` (if it doesn't exist yet, check first — the 4 existing emitters likely already have one; add to it)

**Interfaces:**
- Produces: `TurnBattleEntitySnapshotEvent { players: TurnBattleEntityVisualState[]; enemies: TurnBattleEntityVisualState[] }`, `TurnBattleEntityVisualState { id: string; row: number; column: number; currentHp: number; maxHp: number; alive: boolean }`, `emitTurnBattleEntitySnapshot(eventBus: EventBus, battle: TurnBattle): void`.
- Consumes: `entityGridPosition()` from `game/src/core/battle/BattleGrid.ts`, `TurnBattle` from `TurnBattleSystem.ts`.

- [ ] **Step 1: Write the failing test**

Read `TurnActionPresentationEvents.ts` in full first to match its exact `EventBus.emit()` call pattern (`this.eventBus.emit<T>('event_name', payload)` or similar — the plan's code below assumes a plain `eventBus.emit(name, payload)` free function style matching the existing `emitTurnReady(eventBus, actorId)` signature shape; adjust to match whatever the real file does). Add to its test file:

```ts
describe('emitTurnBattleEntitySnapshot', () => {
  it('emits a snapshot with every living/dead players and enemies participant', () => {
    const eventBus = new EventBus()
    const received: TurnBattleEntitySnapshotEvent[] = []

    eventBus.on<TurnBattleEntitySnapshotEvent>('turn_battle_entity_snapshot', (event) => received.push(event))

    const battle: TurnBattle = {
      players: [makeParticipant('player', createCombatant({ id: 'player', row: 4, x: 1, currentHp: 80, maxHp: 100 }), 100, 0)],
      enemies: [makeParticipant('enemy', createCombatant({ id: 'enemy', row: 5, x: 9, currentHp: 0, maxHp: 50, alive: false }), 100, 1)],
      state: 'fighting',
    }

    emitTurnBattleEntitySnapshot(eventBus, battle)

    expect(received).toHaveLength(1)
    expect(received[0]!.players).toEqual([{ id: 'player', row: 4, column: 1, currentHp: 80, maxHp: 100, alive: true }])
    expect(received[0]!.enemies).toEqual([{ id: 'enemy', row: 5, column: 9, currentHp: 0, maxHp: 50, alive: false }])
  })
})
```

(Reuse this file's own `createCombatant`/`makeParticipant` helpers if they already exist for the other 4 emitters' tests — matching this test suite's established per-file fixture convention; otherwise copy the shape used throughout `TurnBattleSystem.*.test.ts` files, e.g. `TurnBattleSystem.followUpQueue.test.ts`'s `createCombatant`/`makeParticipant`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run TurnActionPresentationEvents.test.ts`
Expected: FAIL — `emitTurnBattleEntitySnapshot`/`TurnBattleEntitySnapshotEvent` don't exist yet.

- [ ] **Step 3: Implement the emitter**

Add to `game/src/core/battle/turn/TurnActionPresentationEvents.ts` (match the exact import/emit style already used by the file's other 4 emitters):

```ts
export interface TurnBattleEntityVisualState {
  id: string
  row: number
  column: number
  currentHp: number
  maxHp: number
  alive: boolean
}

export interface TurnBattleEntitySnapshotEvent {
  players: TurnBattleEntityVisualState[]
  enemies: TurnBattleEntityVisualState[]
}

function toVisualState(participant: TurnBattleParticipant): TurnBattleEntityVisualState {
  const position = entityGridPosition(participant.entity)

  return {
    id: participant.id,
    row: position.row,
    column: position.column,
    currentHp: participant.entity.currentHp,
    maxHp: participant.entity.maxHp,
    alive: participant.entity.alive,
  }
}

/**
 * Combat Art Pipeline (2026-09-05) — replaces the dead legacy `positions`
 * bridge for turn-based combat. Reads DIRECTLY from TurnBattle.players/
 * enemies every fixed step while fighting; no dependency on
 * legacy/BattleSystem.ts's emitPositions()/update() at all.
 */
export function emitTurnBattleEntitySnapshot(eventBus: EventBus, battle: TurnBattle): void {
  eventBus.emit<TurnBattleEntitySnapshotEvent>('turn_battle_entity_snapshot', {
    players: battle.players.map(toVisualState),
    enemies: battle.enemies.map(toVisualState),
  })
}
```

Add `entityGridPosition` to the file's existing `BattleGrid` import if not already imported.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run TurnActionPresentationEvents.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire into `GameManager.updateBattleFixedStep()`**

Read `GameManager.ts:3470-3521` fresh. Add a call to `emitTurnBattleEntitySnapshot` once per fixed step while `turnBattle.state === 'fighting'` — placed so it fires regardless of which sub-branch (paused/pending/resolved) the tick took, at the END of the `if (this.turnBattle.state === 'fighting') { ... }` block:

```ts
        } else if (this.turnBattle.state === 'fighting') {
          if (this.awaitedManualActor) {
            // Paused — still waiting for submitTurnChoice.
          } else if (this.presentationActive && (this.pendingReadyActor || this.pendingDeclaredAction || this.pendingImpact)) {
            // Action Playback Task 6 — waiting for a Phaser acknowledgement.
          } else {
            const readyActor = this.turnBattleSystem.tickPacing(this.turnBattle, !this.presentationActive)

            if (readyActor !== null && this.presentationActive) {
              this.pendingReadyActor = readyActor
              emitTurnReady(this.eventBus, readyActor.id)
            } else if (readyActor !== null && this.turnBattle.players.includes(readyActor) && this.battleManualMode && !this.awaitedManualActor) {
              this.awaitedManualActor = readyActor
            }
          }

          emitTurnBattleEntitySnapshot(this.eventBus, this.turnBattle)
        }
```

Add `emitTurnBattleEntitySnapshot` to the existing `TurnActionPresentationEvents` import at the top of `GameManager.ts`.

- [ ] **Step 6: Run full regression**

Run: `npx vitest run`
Expected: PASS — this only ADDS an emission, no existing behavior changes; confirm no test asserts an exact `eventBus` call count that this new emission would break (grep test files for `'turn_battle_entity_snapshot'` — none should exist yet besides Step 1's own test, and grep for exact-call-count assertions on `eventBus.emit` generally, which is unlikely in this codebase's style but worth one check).

- [ ] **Step 7: Commit**

```bash
git add game/src/core/battle/turn/TurnActionPresentationEvents.ts game/src/core/game/GameManager.ts
git commit -m "feat(combat-art): emit turn_battle_entity_snapshot every fixed step, replacing the dead legacy positions bridge"
```

## Task 5: `CombatScene` consumes the new snapshot event, renders N sprites

**Files:**
- Modify: `game/src/game/scenes/CombatScene.ts` (event bindings at `~477-540`, `spriteFor()` at `~1255`, `reconcileEnemySprites()` at `~1129`, `onPositions()`/`applyPendingPositions()` at `~1263-1290`)

**Interfaces:**
- Consumes: `TurnBattleEntitySnapshotEvent` from Task 4.
- Produces: a new handler `onTurnBattleEntitySnapshot(event: TurnBattleEntitySnapshotEvent)` on `CombatScene`.

- [ ] **Step 1: Read the current sprite-pool code fresh**

Read `CombatScene.ts`'s full `reconcileEnemySprites()` (`~1129-1180`), `spriteFor()` (`~1255`), and `onPositions()`/`applyPendingPositions()` (`~1263-1290`) before writing anything — `reconcileEnemySprites()` already generalizes over an array (`enemies: BattlePositionsEvent['enemies']`), which is the exact create/update/remove pattern the new player-side handling needs to mirror. Confirm the exact `EntitySprite` creation/removal API it calls (e.g. `this.spawnEntitySprite(id, ...)`/`this.sprites.delete(id)` — name varies, use whatever this method actually calls).

- [ ] **Step 2: Add `onTurnBattleEntitySnapshot`, mirroring `reconcileEnemySprites()` for BOTH players and enemies**

Add a new private method to `CombatScene`, generalizing `reconcileEnemySprites()`'s existing create/update/remove logic to run for `event.players` the same way it already runs for enemies (read the exact body first — this plan describes the SHAPE of the fix, not a verbatim diff, since the exact sprite-creation call signature must come from the real method):

```ts
  private onTurnBattleEntitySnapshot(event: TurnBattleEntitySnapshotEvent) {
    this.reconcileCombatantSprites('player', event.players)
    this.reconcileCombatantSprites('enemy', event.enemies)
  }
```

Where `reconcileCombatantSprites(side, states)` is `reconcileEnemySprites()` generalized to take a `side` discriminator only if the current sprite visuals (tint/facing/scale) differ between player and enemy sprites — otherwise reuse `reconcileEnemySprites()` directly for `event.enemies` and extract its shared create/update/remove logic into a new method callable for `event.players` too. Read the current method's exact tint/facing logic before deciding whether the discriminator is needed.

For each state in the incoming list: if no sprite exists for `state.id`, create one (positioned via the scene's projection, matching `reconcileEnemySprites()`'s existing creation call); if one exists, update its position/hp-bar from `state.row/column/currentHp/maxHp`; if `!state.alive`, trigger the death animation path (Task 9 wires this to `sprite.play('death')`) instead of immediately destroying it — for THIS task, before Task 9's animation work lands, keep it simple: remove the sprite once `!state.alive` (matching current enemy-death handling, whatever that already does today via the `death` event — read it and reuse the same removal call, don't invent a second one). If a previously-known id is no longer present in the incoming list at all (not even `alive: false`), remove its sprite immediately (this is the "no player 0 anymore" case, e.g. a companion swapped out mid-run — should not occur mid-battle in practice today, but the reconciliation must be correct regardless).

- [ ] **Step 3: Register the event binding**

In `getCombatEventBindings()` (`CombatScene.ts:~477-540`), add:

```ts
      ['turn_battle_entity_snapshot', (event: TurnBattleEntitySnapshotEvent) => this.onTurnBattleEntitySnapshot(event)],
```

Add the type import at the top of `CombatScene.ts`:

```ts
import type { TurnBattleEntitySnapshotEvent } from '@/core/battle/turn/TurnActionPresentationEvents'
```

- [ ] **Step 4: Do NOT remove the legacy `'positions'` binding**

Per the Combat Art Pipeline spec's risk note (§9): confirm nothing else (e.g. `TribulationScene.ts`) still depends on `'positions'` for a live purpose before touching it — this task does not remove or modify the existing `onPositions()`/`'positions'` binding at all, it only ADDS the new turn-battle-specific one alongside it. Grep `'positions'` usage outside `CombatScene.ts` to confirm before finishing this task:

Run: `grep -rn "'positions'" game/src --include=*.ts --include=*.vue`
Expected: confirm the only other consumer (if any) is unrelated to turn-based combat before considering this task done.

- [ ] **Step 5: Manual verification (this is Phaser scene code, not unit-testable in isolation)**

Run: `npm run dev`, start a stage battle, confirm in the browser: (a) more than one enemy appears over the course of a wave (previously frozen at the battle-start snapshot), (b) enemy HP bars update as the fight progresses, (c) the player sprite still renders correctly. Screenshot or describe the observed behavior in the task's completion notes.

- [ ] **Step 6: Run full regression + typecheck**

Run: `npx vitest run`
Run: `npx vue-tsc --noEmit`
Expected: both clean.

- [ ] **Step 7: Commit**

```bash
git add game/src/game/scenes/CombatScene.ts
git commit -m "feat(combat-art): CombatScene renders live entity state from turn_battle_entity_snapshot instead of the frozen legacy positions snapshot"
```

## Task 6: Right-side skill dock — `CombatInsets`/`ProjectionViewport` gain `right`

**Files:**
- Modify: `game/src/game/support/combatInsets.ts` (full file, 58 lines — add `right` field)
- Modify: `game/src/game/support/BattleGridProjection.ts` (`ProjectionViewport` interface `~93-99`, `makeViewport()` `~175-182`, `FlatGridProjection.recalculate()` `~232-244`, `PerspectiveGridProjection.recalculate()` `~323-335`)
- Test: `game/src/game/support/BattleGridProjection.test.ts` (existing file — add cases)

**Interfaces:**
- Produces: `CombatInsets.right: number`, `ProjectionViewport.rightInset: number`.
- Consumes: nothing new.

- [ ] **Step 1: Write the failing test**

Read `BattleGridProjection.test.ts` fully first to match its existing fixture/assertion style (how it constructs a `FlatGridProjection`/`PerspectiveGridProjection` and reads `.bounds()`/`.gridToScreen()`). Add:

```ts
describe('rightInset — reserves screen space on the right without changing height math', () => {
  it('flat mode: grid narrows and shifts left when rightInset is set', () => {
    const noInset = createBattleGridProjection('flat', { width: 1600, height: 900, topInset: 0, bottomInset: 0, rightInset: 0 })
    const withInset = createBattleGridProjection('flat', { width: 1600, height: 900, topInset: 0, bottomInset: 0, rightInset: 400 })

    const boundsNoInset = noInset.bounds()
    const boundsWithInset = withInset.bounds()

    expect(boundsWithInset.right).toBeLessThanOrEqual(1600 - 400)
    expect(boundsWithInset.right).toBeLessThan(boundsNoInset.right)
  })

  it('perspective mode: centerX shifts left when rightInset is set', () => {
    const noInset = createBattleGridProjection('perspective', { width: 1600, height: 900, topInset: 0, bottomInset: 0, rightInset: 0 })
    const withInset = createBattleGridProjection('perspective', { width: 1600, height: 900, topInset: 0, bottomInset: 0, rightInset: 400 })

    const pointNoInset = noInset.gridToScreen(9, 8) // near row, mid column
    const pointWithInset = withInset.gridToScreen(9, 8)

    expect(pointWithInset.x).toBeLessThan(pointNoInset.x)
  })

  it('defaults rightInset to 0 when omitted (backward compatible)', () => {
    const withDefault = createBattleGridProjection('flat', { width: 1600, height: 900, topInset: 0, bottomInset: 0 } as never)
    const explicitZero = createBattleGridProjection('flat', { width: 1600, height: 900, topInset: 0, bottomInset: 0, rightInset: 0 })

    expect(withDefault.bounds()).toEqual(explicitZero.bounds())
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run BattleGridProjection.test.ts`
Expected: FAIL with a TypeScript error (`rightInset` doesn't exist on `ProjectionViewport`) or, if the cast bypasses it, a runtime assertion failure (both `bounds().right` values equal since `rightInset` is currently ignored).

- [ ] **Step 3: Implement**

In `game/src/game/support/BattleGridProjection.ts`:

Add `rightInset: number` to the `ProjectionViewport` interface (`~93-99`):

```ts
export interface ProjectionViewport {
  width: number
  height: number
  topInset: number
  bottomInset: number
  /** Reserved screen-space on the right (skill dock panel, Combat Art Pipeline spec §7.5). Defaults to 0. */
  rightInset?: number
}
```

Update `makeViewport()` (`~175-182`) to default it:

```ts
function makeViewport(viewport: ProjectionViewport): Required<ProjectionViewport> {
  return {
    width: Math.max(1, viewport.width),
    height: Math.max(1, viewport.height),
    topInset: Math.max(0, viewport.topInset),
    bottomInset: Math.max(0, viewport.bottomInset),
    rightInset: Math.max(0, viewport.rightInset ?? 0),
  }
}
```

Update `FlatGridProjection.recalculate()` (`~232-244`) to subtract it from width:

```ts
  private recalculate(): void {
    const availableWidth = Math.max(0, this.viewport.width - this.viewport.rightInset)
    const availableHeight = Math.max(
      0,
      this.viewport.height - this.viewport.topInset - this.viewport.bottomInset,
    )

    this.cellSizePx = Math.min(
      (availableWidth - 24) / GRID_COLUMN_COUNT,
      availableHeight / GRID_ROW_COUNT,
    )
    this.gridLeft = availableWidth / 2 - (this.cellSizePx * GRID_COLUMN_COUNT) / 2
    this.gridTop = this.viewport.topInset + (availableHeight - this.cellSizePx * GRID_ROW_COUNT) / 2
  }
```

Update `PerspectiveGridProjection.recalculate()` (`~323-335`) similarly — read the full method fresh, since `bandTop`/`bandHeight` come from `computePerspectiveGeometry(this.viewport)` (height-only, unaffected) but `nearWidth`/`centerX` are width-only and need the same `availableWidth` treatment:

```ts
  private recalculate(): void {
    this.q = 1 + PERSPECTIVE_STRENGTH

    const geometry = computePerspectiveGeometry(this.viewport)

    this.bandTop = geometry.horizonY
    this.bandHeight = Math.max(1, geometry.roadHeight)

    const availableWidth = Math.max(0, this.viewport.width - this.viewport.rightInset)

    this.nearWidth = Math.max(1, availableWidth - PERSPECTIVE_SIDE_MARGIN * 2)
    this.centerX = availableWidth / 2
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run BattleGridProjection.test.ts`
Expected: PASS.

- [ ] **Step 5: Extend `CombatInsets`**

Replace `game/src/game/support/combatInsets.ts` (58 lines, full file):

```ts
// Cầu nối kích thước giữa DOM chrome (CombatSceneOverlay.vue) và Phaser
// (CombatScene.ts) — WS1 Responsive foundation (2026-08-24).
//
// Combat Art Pipeline (2026-09-05) — thêm `right`: chiều rộng thực (px)
// của skill dock panel mới bám mép phải màn hình (spec §7.5). Cùng pattern
// đo-DOM-thật với `top` — KHÔNG suy từ tỉ lệ trừ khi chưa đo được lần nào.
export interface CombatInsets {
  top: number
  bottom: number
  right: number
}

interface MeasuredCombatInsets extends CombatInsets {
  measured: boolean
}

const current: MeasuredCombatInsets = { top: 0, bottom: 0, right: 0, measured: false }

export function setCombatInsets(insets: CombatInsets): void {
  current.top = Math.max(0, insets.top)
  current.bottom = 0
  current.right = Math.max(0, insets.right)
  current.measured = true
}

export function resetCombatInsets(): void {
  current.top = 0
  current.bottom = 0
  current.right = 0
  current.measured = false
}

export function getCombatInsets(): MeasuredCombatInsets {
  return current
}

const DESIGN_HEIGHT = 1440

const FALLBACK_TOP_BAR = 64
const FALLBACK_STATUS_BAR = 56

export function getFallbackCombatInsets(height: number): CombatInsets {
  return {
    top: (height * (FALLBACK_TOP_BAR + FALLBACK_STATUS_BAR)) / DESIGN_HEIGHT,
    bottom: 0,
    right: 0,
  }
}
```

- [ ] **Step 6: Wire into `CombatScene.applyBattlefieldLayout()`**

Read `CombatScene.ts:766-799` fresh. Add `rightInset` to the `viewport` object it builds:

```ts
    const viewport = {
      width,
      height,
      topInset: measuredInsets.measured ? measuredInsets.top : fallbackInsets.top,
      bottomInset: measuredInsets.measured ? measuredInsets.bottom : fallbackInsets.bottom,
      rightInset: measuredInsets.measured ? measuredInsets.right : fallbackInsets.right,
    }
```

- [ ] **Step 7: Run full regression + typecheck**

Run: `npx vitest run`
Run: `npx vue-tsc --noEmit`
Expected: both clean — every existing caller of `getFallbackCombatInsets()`/`CombatInsets` gains a `right: 0` field, which is additive and doesn't break existing destructuring (unless a test does an exact-shape `toEqual` on the old 2-field object — grep for that and update if found).

- [ ] **Step 8: Commit**

```bash
git add game/src/game/support/combatInsets.ts game/src/game/support/BattleGridProjection.ts game/src/game/support/BattleGridProjection.test.ts game/src/game/scenes/CombatScene.ts
git commit -m "feat(combat-art): add rightInset to CombatInsets/ProjectionViewport for the skill dock panel"
```

## Task 7: `CombatSkillDockPanel.vue` — move skill UI to the right dock

**Files:**
- Create: `game/src/components/game/combat/CombatSkillDockPanel.vue`
- Modify: `game/src/components/game/combat/CombatSceneOverlay.vue` (currently mounts `CombatBuildHud`/`TurnCombatSkillBar` inside `.combat-scene-overlay__battlefield`, `~98-105`; has the `publishInsets()`/`barHeight()`/`ResizeObserver` pattern at `~29-73` to mirror)

**Interfaces:**
- Consumes: `TurnCombatSkillBar` (unchanged), `CombatBuildHud` (unchanged), `setCombatInsets` from Task 6.
- Produces: nothing new consumed elsewhere — this is a pure relocation.

- [ ] **Step 1: Create the dock component**

```vue
<script setup lang="ts">
// Combat Art Pipeline (2026-09-05, spec §7.5) — skill UI moved out of the
// bottom-center battlefield slot into a right-edge dock, styled like
// RightPanel.vue's Động Phủ drawer but as a SEPARATE component (RightPanel
// is gated to !isCombatSceneActive, mutually exclusive with combat —
// GameRoot.vue:65). Unconditionally visible while fighting, no toggle.
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import TurnCombatSkillBar from './hud/TurnCombatSkillBar.vue'
import CombatBuildHud from './hud/CombatBuildHud.vue'
import { setCombatInsets, getCombatInsets } from '@/game/support/combatInsets'

const rootRef = ref<HTMLElement | null>(null)
let observer: ResizeObserver | null = null

function publishWidth() {
  const width = rootRef.value?.offsetWidth ?? 0

  if (width > 0) {
    const current = getCombatInsets()

    setCombatInsets({ top: current.top, bottom: 0, right: width })
  }
}

onMounted(() => {
  void nextTick(publishWidth)

  if (rootRef.value && typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(publishWidth)
    observer.observe(rootRef.value)
  }
})

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null

  const current = getCombatInsets()

  setCombatInsets({ top: current.top, bottom: 0, right: 0 })
})
</script>

<template>
  <aside ref="rootRef" class="combat-skill-dock-panel dark-drawer-fill">
    <CombatBuildHud />
    <TurnCombatSkillBar />
  </aside>
</template>

<style scoped>
.combat-skill-dock-panel {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: clamp(340px, 27vw, 440px);
  display: flex;
  flex-direction: column;
  gap: var(--space-3, 12px);
  padding: var(--space-3, 12px);
  overflow: hidden;
  border-left: 1px solid var(--frame-outer);
  box-shadow: var(--surface-shadow-deep);
  pointer-events: auto;
  z-index: 12;
}

@media (max-width: 900px) {
  .combat-skill-dock-panel {
    width: min(44vw, 400px);
  }
}
</style>
```

- [ ] **Step 2: Remove the skill UI from the battlefield slot, mount the dock**

In `CombatSceneOverlay.vue`, read the template fresh (`~86-120`), then:
- Remove the `<CombatBuildHud class="combat-scene-overlay__build-hud" />` and `<TurnCombatSkillBar class="combat-scene-overlay__turn-skill-bar" />` lines from inside `.combat-scene-overlay__battlefield`.
- Add `<CombatSkillDockPanel />` as a sibling of `<CombatTopBar>`, OUTSIDE `.combat-scene-overlay__battlefield` (it's a screen-space dock, not a battlefield-anchored element):

```vue
    <CombatTopBar class="combat-scene-overlay__top-bar" />

    <CombatSkillDockPanel />

    <div class="combat-scene-overlay__battlefield">
      <CombatAiPanel class="combat-scene-overlay__ai-panel" />
    </div>
```

Add the import: `import CombatSkillDockPanel from './CombatSkillDockPanel.vue'`. Remove the now-unused `CombatBuildHud`/`TurnCombatSkillBar` imports from `CombatSceneOverlay.vue`'s script (they're imported by the new dock component now, not here) and their now-dead CSS rules `.combat-scene-overlay__build-hud`/`.combat-scene-overlay__turn-skill-bar` if present in the `<style>` block.

- [ ] **Step 3: Manual verification**

Run: `npm run dev`, enter a battle. Confirm: the skill bar + build HUD now render in a dark panel flush against the right screen edge (not bottom-center), the battlefield visibly narrows to make room for it, and clicking a skill slot still works (manual mode toggle + submit still functional — no behavior change, only position).

- [ ] **Step 4: Typecheck + full regression**

Run: `npx vue-tsc --noEmit`
Run: `npx vitest run`
Expected: both clean.

- [ ] **Step 5: Commit**

```bash
git add game/src/components/game/combat/CombatSkillDockPanel.vue game/src/components/game/combat/CombatSceneOverlay.vue
git commit -m "feat(combat-art): move combat skill UI into a right-edge dock panel"
```

## Task 8: Sprite-sheet animation data model + placeholder generator

**Files:**
- Create: `game/src/game/support/CombatAnimationSet.ts`
- Test: `game/src/game/support/CombatAnimationSet.test.ts`

**Interfaces:**
- Produces: `CombatAnimationName = 'idle' | 'ready' | 'cast' | 'standby' | 'death'`, `CombatAnimationClip { key; sheetKey; sheetUrl; frameWidth; frameHeight; frameCount; frameRate; repeat }`, `CombatAnimationSet = Record<CombatAnimationName, CombatAnimationClip>`, `buildPlaceholderAnimationSet(entityKey: string, staticTextureUrl: string): CombatAnimationSet`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { buildPlaceholderAnimationSet, type CombatAnimationName } from './CombatAnimationSet'

describe('buildPlaceholderAnimationSet', () => {
  it('produces all 5 named clips, each pointing at the same static texture (single-frame sheet)', () => {
    const set = buildPlaceholderAnimationSet('player-mortal', '/assets/characters/player/mortal/player-mortal-ink-sword-concept-v2.png')

    const names: CombatAnimationName[] = ['idle', 'ready', 'cast', 'standby', 'death']

    for (const name of names) {
      const clip = set[name]

      expect(clip.sheetUrl).toBe('/assets/characters/player/mortal/player-mortal-ink-sword-concept-v2.png')
      expect(clip.key).toBe(`player-mortal-${name}`)
      expect(clip.frameCount).toBe(1)
      expect(clip.sheetKey).toBe(`player-mortal-${name}-sheet`)
    }
  })

  it('cast/death play once (repeat: 0), idle/ready/standby loop (repeat: -1)', () => {
    const set = buildPlaceholderAnimationSet('enemy-wolf', '/assets/enemies/wolf.png')

    expect(set.idle.repeat).toBe(-1)
    expect(set.ready.repeat).toBe(-1)
    expect(set.standby.repeat).toBe(-1)
    expect(set.cast.repeat).toBe(0)
    expect(set.death.repeat).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run CombatAnimationSet.test.ts`
Expected: FAIL with "Cannot find module './CombatAnimationSet'".

- [ ] **Step 3: Implement**

Create `game/src/game/support/CombatAnimationSet.ts`:

```ts
// CombatAnimationSet (Combat Art Pipeline spec §5, 2026-09-05) — sprite
// sheet animation metadata, one clip per Action Playback phase. No real
// sheets exist yet: buildPlaceholderAnimationSet() reuses an entity's
// existing static PNG as a trivial 1-frame "sheet" so the SAME loading/
// AnimationManager code path runs end-to-end today. When real multi-frame
// sheets are dropped in later (asset-drop workflow), only the content
// definition changes — no code path changes.
export type CombatAnimationName = 'idle' | 'ready' | 'cast' | 'standby' | 'death'

export interface CombatAnimationClip {
  key: string
  sheetKey: string
  sheetUrl: string
  frameWidth: number
  frameHeight: number
  frameCount: number
  frameRate: number
  /** -1 = loop (idle/ready/standby), 0 = play once (cast/death). */
  repeat: number
}

export type CombatAnimationSet = Record<CombatAnimationName, CombatAnimationClip>

const LOOPING_NAMES: readonly CombatAnimationName[] = ['idle', 'ready', 'standby']
const ONE_SHOT_NAMES: readonly CombatAnimationName[] = ['cast', 'death']

const ALL_NAMES: readonly CombatAnimationName[] = [...LOOPING_NAMES, ...ONE_SHOT_NAMES]

export function buildPlaceholderAnimationSet(
  entityKey: string,
  staticTextureUrl: string,
  frameSize: { width: number; height: number } = { width: 256, height: 256 },
): CombatAnimationSet {
  const entries = ALL_NAMES.map((name) => {
    const clip: CombatAnimationClip = {
      key: `${entityKey}-${name}`,
      sheetKey: `${entityKey}-${name}-sheet`,
      sheetUrl: staticTextureUrl,
      frameWidth: frameSize.width,
      frameHeight: frameSize.height,
      frameCount: 1,
      frameRate: 1,
      repeat: LOOPING_NAMES.includes(name) ? -1 : 0,
    }

    return [name, clip] as const
  })

  return Object.fromEntries(entries) as CombatAnimationSet
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run CombatAnimationSet.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add game/src/game/support/CombatAnimationSet.ts game/src/game/support/CombatAnimationSet.test.ts
git commit -m "feat(combat-art): CombatAnimationSet data model + static-PNG placeholder generator"
```

## Task 9: Wire animation playback into `CombatPreload`/`CombatScene`'s Action Playback phases

**Files:**
- Modify: `game/src/game/support/CombatPreload.ts` (full file, 102 lines — `queueCombatAssets()`)
- Modify: `game/src/game/scenes/CombatScene.ts` (`onTurnReady`/`onAttack`/impact/standby handlers, `~1409-1900`; `create()` for `scene.anims.create()` registration)

**Interfaces:**
- Consumes: `CombatAnimationSet`/`buildPlaceholderAnimationSet` from Task 8.

- [ ] **Step 1: Replace static-image queueing with spritesheet queueing for combat entities**

Read `CombatPreload.ts` fully fresh (it was already read in full during spec-writing — confirm nothing changed). Replace the `queueOnce`-based `scene.load.image()` calls for `PLAYER_TEXTURE_KEY`, each `PLAYER_VISUAL_PROFILES` entry, and each `ENEMY_TEMPLATE_IDS` entry with `scene.load.spritesheet()` calls driven by `buildPlaceholderAnimationSet()`:

```ts
  // Player visual profiles — placeholder animation sets until real sprite
  // sheets exist (Combat Art Pipeline spec §5). Same static PNG reused as
  // a 1-frame sheet for every one of the 5 named clips.
  for (const profile of Object.values(PLAYER_VISUAL_PROFILES)) {
    const animationSet = buildPlaceholderAnimationSet(profile.combatTextureKey, profile.combatTextureUrl)

    for (const clip of Object.values(animationSet)) {
      if (scene.textures.exists(clip.sheetKey)) {
        continue
      }

      scene.load.spritesheet(clip.sheetKey, clip.sheetUrl, {
        frameWidth: clip.frameWidth,
        frameHeight: clip.frameHeight,
      })
    }

    if (profile.cultivateTextureKey && profile.cultivateTextureUrl) {
      queueOnce(profile.cultivateTextureKey, profile.cultivateTextureUrl) // cultivate pose stays a static image — out of scope (combat-only per spec)
    }
  }
```

Apply the same `buildPlaceholderAnimationSet`-driven spritesheet loading to the `ENEMY_TEMPLATE_IDS` loop, replacing its `queueOnce(textureKey, enemyTextureUrl(textureKey))` call.

- [ ] **Step 2: Register `Phaser.Animations.Animation` objects in `CombatScene.create()`**

Read `CombatScene.ts`'s `create()` method to find where preload/setup happens. Add, once per loaded animation set:

```ts
  private registerCombatAnimations(entityKey: string, animationSet: CombatAnimationSet): void {
    for (const [name, clip] of Object.entries(animationSet)) {
      if (this.anims.exists(clip.key)) {
        continue
      }

      this.anims.create({
        key: clip.key,
        frames: this.anims.generateFrameNumbers(clip.sheetKey, { start: 0, end: clip.frameCount - 1 }),
        frameRate: clip.frameRate,
        repeat: clip.repeat,
      })
    }
  }
```

Call `registerCombatAnimations(profile.combatTextureKey, buildPlaceholderAnimationSet(profile.combatTextureKey, profile.combatTextureUrl))` for each player profile and each enemy template, at the same point in `create()` where textures are confirmed loaded (after `queueCombatAssets`'s load completes — check the existing `load.once('complete', ...)`/`create()` sequencing before placing this call).

- [ ] **Step 3: Play animations on Action Playback phase transitions**

In the existing phase handlers, add `sprite.play(...)` calls alongside (not replacing, where a positional tween like the attack lunge still matters) the current logic:
- `onTurnReady()` (`~1784`): after the existing pulse tween setup, `sprite.rect.play(\`${entityAnimationKeyPrefix(event.actorId)}-ready\`)` if the sprite has a `Phaser.GameObjects.Sprite` (not a plain rect) to call `.play()` on — read `EntitySprite`'s exact shape first; if `rect` is a `Phaser.GameObjects.Rectangle` (not sprite-capable), this step requires checking whether `EntitySprite` already wraps a real animatable `Sprite` object elsewhere, and using that instead. This is the one integration point in this whole plan that depends on `EntitySprite`'s internal shape — read it fresh before writing the actual call, do not assume `.rect` is animatable.
- `onAttack()` (`~1409`): play the `-cast` clip at cast start (before the lunge tween).
- The impact/standby handlers: play `-standby` on return to idle-adjacent state.
- Entity death (wherever `alive: false` is detected per Task 5's snapshot handling): play `-death` once, and defer sprite removal until the `Phaser.Animations.Events.ANIMATION_COMPLETE` event fires for that clip (not immediately) — matching the Combat Art Pipeline spec's risk note (§9) about death timing not being cut off by state-driven cleanup.

- [ ] **Step 4: Manual verification**

Run: `npm run dev`, enter a battle, confirm no console errors from `scene.anims.create()`/`sprite.play()` (a placeholder 1-frame "animation" should just look static, matching today's visual — this task's goal is a working PLUMBING path, not new visible motion, since content is still placeholder).

- [ ] **Step 5: Typecheck + full regression**

Run: `npx vue-tsc --noEmit`
Run: `npx vitest run`
Expected: both clean.

- [ ] **Step 6: Commit**

```bash
git add game/src/game/support/CombatPreload.ts game/src/game/scenes/CombatScene.ts
git commit -m "feat(combat-art): wire placeholder sprite-sheet animations into CombatPreload + Action Playback phase transitions"
```

## Task 9.5: Part A verification + roadmap update

- [ ] Run `npx vitest run` — full suite green.
- [ ] Run `npx vue-tsc --noEmit` — zero errors.
- [ ] Manual playtest: enter 3 stage battles back-to-back, confirm enemies visibly spawn/update/die correctly (Task 4/5), skill dock sits on the right (Task 7), boss (if the current stage pool has one) spawns centered in the enemy box rather than aligned to the player's row (Task 2).
- [ ] Update `game/docs/roadmap.md` (or `game/docs/turn-based-combat-roadmap.md`, whichever this project is currently using — check both, the earlier session's memory notes the index moved once already) with a section noting Part A shipped, linking this plan file and the Combat Art Pipeline spec.
- [ ] Commit the roadmap update: `git commit -m "docs: roadmap — Combat Art Pipeline (Part A) shipped"`.

---

# Part B — Companion Roster

## Task 10: `ItemGrade`-based `CompanionDefinition`/`CompanionInstance` types + empty content file

**Files:**
- Create: `game/src/data/companion/Companions.ts`
- Test: `game/src/data/companion/Companions.test.ts`

**Interfaces:**
- Produces: `CompanionDefinition { id; name; grade: ItemGrade; baseStats; basic: TurnSkillDefinition; special?: TurnSkillDefinition; ultimate?: TurnSkillDefinition }`, `CompanionInstance { definitionId: string; level: number; exp: number }`, `COMPANIONS: readonly CompanionDefinition[]`.
- Consumes: `ItemGrade` from `game/src/core/item/ItemGrade.ts` (confirmed: `'hoang' | 'huyen' | 'dia' | 'thien' | 'tien'`), `TurnSkillDefinition` from `game/src/core/battle/turn/TurnSkillAction.ts`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { COMPANIONS } from './Companions'
import { ITEM_GRADE_ORDER } from '@/core/item/ItemGrade'

describe('Companions content file', () => {
  it('every companion has a valid ItemGrade and a basic skill', () => {
    for (const companion of COMPANIONS) {
      expect(ITEM_GRADE_ORDER).toContain(companion.grade)
      expect(companion.basic).toBeDefined()
      expect(companion.basic.id).toBeTruthy()
    }
  })

  it('every companion id is unique', () => {
    const ids = COMPANIONS.map((companion) => companion.id)

    expect(new Set(ids).size).toBe(ids.length)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run Companions.test.ts`
Expected: FAIL with "Cannot find module './Companions'".

- [ ] **Step 3: Implement**

Create `game/src/data/companion/Companions.ts`:

```ts
// Companions (Companion Roster spec, 2026-09-05) — gacha-recruited
// combatants with a FIXED skill kit (no Ngũ Hành node-tree/loadout) and NO
// equipment (stats scale from grade + level only, see companionStatsAtLevel
// in CompanionCombat.ts). Reuses ItemGrade (Hoàng/Huyền/Địa/Thiên/Tiên
// Chất) for rarity — the SAME 5-tier ladder as Equipment/Pill/Talisman/
// Formation, not the unrelated 10-tier ProfessionGrade.
import type { ItemGrade } from '@/core/item/ItemGrade'
import type { TurnSkillDefinition } from '@/core/battle/turn/TurnSkillAction'

export interface CompanionBaseStats {
  maxHp: number
  attack: number
  speed: number
}

export interface CompanionDefinition {
  id: string
  name: string
  grade: ItemGrade
  baseStats: CompanionBaseStats
  basic: TurnSkillDefinition
  special?: TurnSkillDefinition
  ultimate?: TurnSkillDefinition
}

export interface CompanionInstance {
  definitionId: string
  level: number
  exp: number
}

export const COMPANIONS: readonly CompanionDefinition[] = [
  // Content added in a later balance/content pass — this file ships the
  // mechanism only (Companion Roster spec §8, out of scope: roster content).
]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run Companions.test.ts`
Expected: PASS (vacuously true over an empty array).

- [ ] **Step 5: Commit**

```bash
git add game/src/data/companion/Companions.ts game/src/data/companion/Companions.test.ts
git commit -m "feat(companion-roster): CompanionDefinition/CompanionInstance types, empty content file"
```

## Task 11: `PlayerData.companions` field + save version bump

**Files:**
- Modify: `game/src/core/player/Player.ts` (`PlayerData` interface, add field after `skillLevels?: Record<string, number>` at `~269`; `createDefaultPlayer()`, add init before `lastSavedAt: Date.now(),` at `~347`)
- Modify: `game/src/services/save/saveVersion.ts` (bump `CURRENT_SAVE_VERSION`)
- Test: `game/src/core/player/Player.test.ts` (check if this file exists first via Glob; if not, create it — otherwise add to it)

**Interfaces:**
- Consumes: `CompanionInstance` from Task 10.
- Produces: `PlayerData.companions: CompanionInstance[]`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { createDefaultPlayer } from './Player'

describe('createDefaultPlayer — companions field', () => {
  it('initializes companions as an empty array (never undefined)', () => {
    const player = createDefaultPlayer()

    expect(player.companions).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run Player.test.ts`
Expected: FAIL — `player.companions` is `undefined`, `toEqual([])` fails (or a TS compile error if the test file imports `PlayerData` and destructures `companions` with a non-optional type before the field exists — either way, confirms the gap).

- [ ] **Step 3: Implement**

In `game/src/core/player/Player.ts`, add to the `PlayerData` interface (after `skillLevels?: Record<string, number>`, before `lastSavedAt: number`):

```ts
  // Companion Roster (2026-09-05) — gacha-recruited combatants owned by
  // the player. No equipment/per-character skill tree (fixed kit baked
  // into CompanionDefinition, see data/companion/Companions.ts) — this is
  // the ONLY new field this feature needs on PlayerData.
  companions: CompanionInstance[]
```

Add the import at the top of `Player.ts`:

```ts
import type { CompanionInstance } from '../../data/companion/Companions'
```

In `createDefaultPlayer()`, add before `lastSavedAt: Date.now(),`:

```ts
    companions: [],

    lastSavedAt: Date.now(),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run Player.test.ts`
Expected: PASS.

- [ ] **Step 5: Bump save version**

In `game/src/services/save/saveVersion.ts`, add a new comment block and increment:

```ts
// v57 (2026-09-05, companion-roster spec): 1 field mới — companions
// (CompanionInstance[] sở hữu, definitionId/level/exp). Save v56 bị từ
// chối (dev phase, không migration).
export const CURRENT_SAVE_VERSION = 57 as const
```

- [ ] **Step 6: Full regression**

Run: `npx vitest run`
Expected: PASS — confirm `SaveSystem.saveLoadRoundTrip.test.ts`/`SaveSystem.bootRestore.test.ts` still pass (they should, since this is purely additive and those tests round-trip whatever `createDefaultPlayer()` produces).

- [ ] **Step 7: Commit**

```bash
git add game/src/core/player/Player.ts game/src/services/save/saveVersion.ts game/src/core/player/Player.test.ts
git commit -m "feat(companion-roster): add PlayerData.companions field, bump save v57"
```

## Task 12: `companionToCombatEntity()` + `companionStatsAtLevel()`

**Files:**
- Create: `game/src/core/companion/CompanionCombat.ts`
- Test: `game/src/core/companion/CompanionCombat.test.ts`

**Interfaces:**
- Consumes: `CompanionDefinition`/`CompanionInstance` from Task 10, `CombatEntity` from `game/src/core/combat/CombatEntity.ts`, `toTurnBattleParticipant` from `game/src/core/game/TurnBattleAdapter.ts` (confirmed signature: `(entity: CombatEntity, priority: number, basic: TurnSkillDefinition, buildId?: string) => TurnBattleParticipant`).
- Produces: `companionStatsAtLevel(baseStats: CompanionBaseStats, level: number): CompanionBaseStats`, `companionToCombatEntity(instance: CompanionInstance, definition: CompanionDefinition): CombatEntity`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { companionStatsAtLevel, companionToCombatEntity } from './CompanionCombat'
import type { CompanionDefinition, CompanionInstance } from '@/data/companion/Companions'

const TEST_DEFINITION: CompanionDefinition = {
  id: 'test_companion',
  name: 'Test Companion',
  grade: 'hoang',
  baseStats: { maxHp: 100, attack: 10, speed: 100 },
  basic: { id: 'test_companion_basic', cooldownTurns: 0, damage: { kind: 'physical', multiplier: 1 }, targeting: { shape: 'single' } },
}

describe('companionStatsAtLevel', () => {
  it('level 1 returns base stats unchanged', () => {
    expect(companionStatsAtLevel(TEST_DEFINITION.baseStats, 1)).toEqual(TEST_DEFINITION.baseStats)
  })

  it('higher level scales stats upward', () => {
    const level10 = companionStatsAtLevel(TEST_DEFINITION.baseStats, 10)

    expect(level10.maxHp).toBeGreaterThan(TEST_DEFINITION.baseStats.maxHp)
    expect(level10.attack).toBeGreaterThan(TEST_DEFINITION.baseStats.attack)
  })
})

describe('companionToCombatEntity', () => {
  it('builds a fresh, alive CombatEntity with the definition id and full HP', () => {
    const instance: CompanionInstance = { definitionId: 'test_companion', level: 1, exp: 0 }

    const entity = companionToCombatEntity(instance, TEST_DEFINITION)

    expect(entity.id).toBe('test_companion')
    expect(entity.alive).toBe(true)
    expect(entity.currentHp).toBe(entity.maxHp)
    expect(entity.stats.attack).toBe(TEST_DEFINITION.baseStats.attack)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run CompanionCombat.test.ts`
Expected: FAIL with "Cannot find module './CompanionCombat'".

- [ ] **Step 3: Implement**

Read `game/src/core/combat/CombatEntity.ts`'s full interface first (confirm every required field — the fixture pattern used throughout this session's `TurnBattleSystem.*.test.ts` files, e.g. `TurnBattleSystem.followUpQueue.test.ts`'s `createCombatant()`, is the reference for which fields a valid `CombatEntity` needs). Create `game/src/core/companion/CompanionCombat.ts`:

```ts
// CompanionCombat (Companion Roster spec §5-§6, 2026-09-05) — turns an
// owned CompanionInstance + its static CompanionDefinition into a fresh
// CombatEntity/TurnBattleParticipant EVERY battle, the same ephemeral-
// combat-state pattern already used for enemies. Companions are NEVER
// added to GameManager.activePlayer or PlayerData's complex per-character
// struct — this is the entire integration surface.
import { createBaseStats } from '@/core/stats/StatBlock'
import type { CombatEntity } from '@/core/combat/CombatEntity'
import type { CompanionBaseStats, CompanionDefinition, CompanionInstance } from '@/data/companion/Companions'

/**
 * Linear scaling, exact curve deferred to a balance pass (spec §6): each
 * level above 1 adds 8% of the base stat. Kept as an isolated pure
 * function specifically so tuning never touches combat-integration code.
 */
const PER_LEVEL_GROWTH = 0.08

export function companionStatsAtLevel(baseStats: CompanionBaseStats, level: number): CompanionBaseStats {
  const multiplier = 1 + (level - 1) * PER_LEVEL_GROWTH

  return {
    maxHp: Math.round(baseStats.maxHp * multiplier),
    attack: Math.round(baseStats.attack * multiplier),
    speed: baseStats.speed, // speed does not scale with level — avoids turn-order churn as companions level up
  }
}

export function companionToCombatEntity(instance: CompanionInstance, definition: CompanionDefinition): CombatEntity {
  const scaled = companionStatsAtLevel(definition.baseStats, instance.level)
  const stats = { ...createBaseStats(), ...scaled, evasionRate: 0, dexterity: 0, criticalRate: 0 }

  return {
    id: definition.id,
    name: definition.name,
    type: 'player',
    baseStats: stats,
    stats,
    currentHp: stats.maxHp,
    maxHp: stats.maxHp,
    currentMp: stats.maxMp,
    currentSwordIntent: 0,
    currentMomentum: 0,
    currentHoaThe: 0,
    currentThoThe: 0,
    currentKimThe: 0,
    timeSinceLastBleedProc: 0,
    tuLucActive: false,
    tuLucElapsed: 0,
    tuLucDamageTakenPercent: 0,
    currentWard: 0,
    timeSinceLastHitTaken: Infinity,
    realmIndex: 0,
    x: 0, // overwritten by whichever FormationLoadout/DEFAULT position resolves this companion's cell (Part C)
    row: 4,
    alive: true,
  }
}
```

(If `CombatEntity` requires additional fields beyond what's listed above once read fresh, add them with the same zero/neutral defaults used by `playerToCombatEntity()`/enemy-building helpers — do not guess field names not confirmed by reading the actual interface.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run CompanionCombat.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add game/src/core/companion/CompanionCombat.ts game/src/core/companion/CompanionCombat.test.ts
git commit -m "feat(companion-roster): companionToCombatEntity() + companionStatsAtLevel() — no PlayerData/activePlayer coupling"
```

## Task 13: Companion leveling — `grantCompanionExp`/`companionLevelForExp`

**Files:**
- Create: `game/src/core/companion/CompanionLeveling.ts`
- Test: `game/src/core/companion/CompanionLeveling.test.ts`

**Interfaces:**
- Consumes: `CompanionInstance` from Task 10.
- Produces: `companionLevelForExp(exp: number): number`, `grantCompanionExp(instance: CompanionInstance, amount: number): CompanionInstance`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { companionLevelForExp, grantCompanionExp } from './CompanionLeveling'

describe('companionLevelForExp', () => {
  it('level 1 at 0 exp', () => {
    expect(companionLevelForExp(0)).toBe(1)
  })

  it('level increases as exp crosses thresholds', () => {
    const levelAtLowExp = companionLevelForExp(50)
    const levelAtHighExp = companionLevelForExp(5000)

    expect(levelAtHighExp).toBeGreaterThan(levelAtLowExp)
  })
})

describe('grantCompanionExp', () => {
  it('returns a NEW instance with exp increased and level recalculated', () => {
    const instance = { definitionId: 'test', level: 1, exp: 0 }

    const result = grantCompanionExp(instance, 5000)

    expect(result.exp).toBe(5000)
    expect(result.level).toBe(companionLevelForExp(5000))
    expect(instance.exp).toBe(0) // original untouched (pure function)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run CompanionLeveling.test.ts`
Expected: FAIL with "Cannot find module './CompanionLeveling'".

- [ ] **Step 3: Implement**

```ts
// CompanionLeveling (Companion Roster spec §6, 2026-09-05) — exp/level
// curve isolated in its own file per this project's "balance constants
// live in their own file" convention, so a future balance pass never
// touches combat-integration code (CompanionCombat.ts).
import type { CompanionInstance } from '@/data/companion/Companions'

const EXP_PER_LEVEL = 100

export function companionLevelForExp(exp: number): number {
  return 1 + Math.floor(exp / EXP_PER_LEVEL)
}

export function grantCompanionExp(instance: CompanionInstance, amount: number): CompanionInstance {
  const exp = instance.exp + amount

  return {
    ...instance,
    exp,
    level: companionLevelForExp(exp),
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run CompanionLeveling.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add game/src/core/companion/CompanionLeveling.ts game/src/core/companion/CompanionLeveling.test.ts
git commit -m "feat(companion-roster): companion exp/leveling curve, isolated for future balance tuning"
```

## Task 14: Gacha — `rollCompanionGrade`/`pickDefinitionOfGrade`/duplicate-to-exp

**Files:**
- Create: `game/src/core/companion/CompanionGacha.ts`
- Test: `game/src/core/companion/CompanionGacha.test.ts`

**Interfaces:**
- Consumes: `ItemGrade`, `COMPANIONS` from Task 10, `grantCompanionExp` from Task 13.
- Produces: `rollCompanionGrade(rates: Record<ItemGrade, number>, random?: () => number): ItemGrade`, `pickDefinitionOfGrade(grade: ItemGrade, pool: readonly CompanionDefinition[], random?: () => number): CompanionDefinition`, `pullCompanion(owned: CompanionInstance[], rates: Record<ItemGrade, number>, pool: readonly CompanionDefinition[], random?: () => number): { owned: CompanionInstance[]; result: { definitionId: string; isDuplicate: boolean } }`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { rollCompanionGrade, pickDefinitionOfGrade, pullCompanion } from './CompanionGacha'
import type { CompanionDefinition } from '@/data/companion/Companions'

const RATES = { hoang: 0.5, huyen: 0.3, dia: 0.15, thien: 0.04, tien: 0.01 }

const POOL: CompanionDefinition[] = [
  { id: 'a', name: 'A', grade: 'hoang', baseStats: { maxHp: 100, attack: 10, speed: 100 }, basic: { id: 'a_basic', cooldownTurns: 0, damage: { kind: 'physical', multiplier: 1 }, targeting: { shape: 'single' } } },
  { id: 'b', name: 'B', grade: 'tien', baseStats: { maxHp: 100, attack: 10, speed: 100 }, basic: { id: 'b_basic', cooldownTurns: 0, damage: { kind: 'physical', multiplier: 1 }, targeting: { shape: 'single' } } },
]

describe('rollCompanionGrade', () => {
  it('random(0) rolls the first grade in the rate table', () => {
    expect(rollCompanionGrade(RATES, () => 0)).toBe('hoang')
  })

  it('random(0.999) rolls the last grade', () => {
    expect(rollCompanionGrade(RATES, () => 0.999)).toBe('tien')
  })
})

describe('pickDefinitionOfGrade', () => {
  it('picks only from definitions matching the rolled grade', () => {
    expect(pickDefinitionOfGrade('tien', POOL, () => 0).id).toBe('b')
  })

  it('throws if the pool has no definition of that grade (content gap, should never happen in real content)', () => {
    expect(() => pickDefinitionOfGrade('thien', POOL, () => 0)).toThrow()
  })
})

describe('pullCompanion — duplicate converts to exp instead of a second instance', () => {
  it('new companion: adds a fresh CompanionInstance at level 1', () => {
    const { owned, result } = pullCompanion([], RATES, POOL, () => 0)

    expect(result.isDuplicate).toBe(false)
    expect(owned).toEqual([{ definitionId: 'a', level: 1, exp: 0 }])
  })

  it('duplicate companion: grants exp to the existing instance, does not add a second one', () => {
    const existing = [{ definitionId: 'a', level: 1, exp: 0 }]

    const { owned, result } = pullCompanion(existing, RATES, POOL, () => 0)

    expect(result.isDuplicate).toBe(true)
    expect(owned).toHaveLength(1)
    expect(owned[0]!.exp).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run CompanionGacha.test.ts`
Expected: FAIL with "Cannot find module './CompanionGacha'".

- [ ] **Step 3: Implement**

```ts
// CompanionGacha (Companion Roster spec §7, 2026-09-05) — mechanism only:
// exact rate table values and the pull currency are content/balance
// decisions (spec §8), not designed here. Duplicate pulls convert to exp
// (via CompanionLeveling.grantCompanionExp) rather than a no-op or a
// second owned instance — see spec §7.
import type { ItemGrade } from '@/core/item/ItemGrade'
import type { CompanionDefinition, CompanionInstance } from '@/data/companion/Companions'
import { grantCompanionExp } from './CompanionLeveling'

const GRADE_ORDER: readonly ItemGrade[] = ['hoang', 'huyen', 'dia', 'thien', 'tien']

/** Exp granted to an already-owned companion on a duplicate pull. Content/balance value, isolated here for easy tuning. */
const DUPLICATE_PULL_EXP = 50

export function rollCompanionGrade(rates: Record<ItemGrade, number>, random: () => number = Math.random): ItemGrade {
  const roll = random()

  let cumulative = 0

  for (const grade of GRADE_ORDER) {
    cumulative += rates[grade]

    if (roll < cumulative) {
      return grade
    }
  }

  return GRADE_ORDER[GRADE_ORDER.length - 1]!
}

export function pickDefinitionOfGrade(
  grade: ItemGrade,
  pool: readonly CompanionDefinition[],
  random: () => number = Math.random,
): CompanionDefinition {
  const candidates = pool.filter((definition) => definition.grade === grade)

  if (candidates.length === 0) {
    throw new Error(`pickDefinitionOfGrade: no companion definitions of grade "${grade}" in the pool`)
  }

  const index = Math.floor(random() * candidates.length)

  return candidates[index]!
}

export function pullCompanion(
  owned: CompanionInstance[],
  rates: Record<ItemGrade, number>,
  pool: readonly CompanionDefinition[],
  random: () => number = Math.random,
): { owned: CompanionInstance[]; result: { definitionId: string; isDuplicate: boolean } } {
  const grade = rollCompanionGrade(rates, random)
  const definition = pickDefinitionOfGrade(grade, pool, random)

  const existingIndex = owned.findIndex((instance) => instance.definitionId === definition.id)

  if (existingIndex === -1) {
    return {
      owned: [...owned, { definitionId: definition.id, level: 1, exp: 0 }],
      result: { definitionId: definition.id, isDuplicate: false },
    }
  }

  const updated = [...owned]

  updated[existingIndex] = grantCompanionExp(updated[existingIndex]!, DUPLICATE_PULL_EXP)

  return { owned: updated, result: { definitionId: definition.id, isDuplicate: true } }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run CompanionGacha.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add game/src/core/companion/CompanionGacha.ts game/src/core/companion/CompanionGacha.test.ts
git commit -m "feat(companion-roster): gacha pull mechanism — rate table, duplicate-to-exp conversion"
```

## Task 15: Part B verification

- [ ] Run `npx vitest run` — full suite green.
- [ ] Run `npx vue-tsc --noEmit` — zero errors.
- [ ] Confirm (grep) that no task in Part B touched `GameManager.activePlayer`, `EquipmentSlotManager`, or `SkillLoadoutSlots.ts` — the entire point of the Companion Roster's design was avoiding those three areas (spec §2); a diff touching them here would mean the plan drifted from the spec.
- [ ] Update `game/docs/roadmap.md` with a section noting Part B shipped (mechanism only, no roster content yet), linking this plan file and the Companion Roster spec.
- [ ] Commit: `git commit -m "docs: roadmap — Companion Roster (Part B) shipped, mechanism only"`.

---

# Part C — Trận Pháp

## Task 16: `TranPhapDefinition`/`TranPhapCell` types + empty content file

**Files:**
- Create: `game/src/data/formation/TranPhap.ts`
- Test: `game/src/data/formation/TranPhap.test.ts`

**Interfaces:**
- Produces: `TranPhapCell { row: number; column: number }`, `TranPhapDefinition { id; name; cellPattern: readonly TranPhapCell[]; buff: { definitionId: string }; description: string }`, `TRAN_PHAP_FORMATIONS: readonly TranPhapDefinition[]`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { TRAN_PHAP_FORMATIONS } from './TranPhap'

describe('Trận Pháp content file', () => {
  it('every formation cell is within the local 6x6 pattern space (0-5)', () => {
    for (const formation of TRAN_PHAP_FORMATIONS) {
      for (const cell of formation.cellPattern) {
        expect(cell.row).toBeGreaterThanOrEqual(0)
        expect(cell.row).toBeLessThanOrEqual(5)
        expect(cell.column).toBeGreaterThanOrEqual(0)
        expect(cell.column).toBeLessThanOrEqual(5)
      }
    }
  })

  it('every formation id is unique', () => {
    const ids = TRAN_PHAP_FORMATIONS.map((formation) => formation.id)

    expect(new Set(ids).size).toBe(ids.length)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run TranPhap.test.ts`
Expected: FAIL with "Cannot find module './TranPhap'".

- [ ] **Step 3: Implement**

```ts
// Trận Pháp (Formation) content (spec, 2026-09-05) — fixed cell pattern
// per formation (local 6x6 space, mapped onto PLAYER_SIDE_REGION via
// localCellToAbsolute() in FormationPlacement.ts, Task 18). One uniform
// buff per formation, no per-cell roles. All formations available from
// the start (no unlock gating). Actual roster/buff values are content
// work — this file ships the mechanism only.
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

export const TRAN_PHAP_FORMATIONS: readonly TranPhapDefinition[] = []
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run TranPhap.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add game/src/data/formation/TranPhap.ts game/src/data/formation/TranPhap.test.ts
git commit -m "feat(tran-phap): TranPhapDefinition/TranPhapCell types, empty content file"
```

## Task 17: `FormationLoadout`/`FormationSlotAssignment` + `PlayerData.formationLoadout` + save bump

**Files:**
- Modify: `game/src/core/player/Player.ts` (`PlayerData` interface, add field after `companions: CompanionInstance[]`; `createDefaultPlayer()`, init before `lastSavedAt: Date.now(),`)
- Modify: `game/src/services/save/saveVersion.ts`

**Interfaces:**
- Produces: `FormationSlotAssignment { row: number; column: number; combatantId: string }`, `FormationLoadout { formationId: string; assignments: FormationSlotAssignment[] }`, `PlayerData.formationLoadout: FormationLoadout | null`.

- [ ] **Step 1: Write the failing test**

Add to `game/src/core/player/Player.test.ts` (created/extended in Task 11):

```ts
describe('createDefaultPlayer — formationLoadout field', () => {
  it('initializes formationLoadout as null (no Trận Pháp configured yet)', () => {
    const player = createDefaultPlayer()

    expect(player.formationLoadout).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run Player.test.ts`
Expected: FAIL — `formationLoadout` doesn't exist yet.

- [ ] **Step 3: Implement**

In `game/src/core/player/Player.ts`, add types near the top (or a small local interface block right above `PlayerData`, matching how `CompanionInstance` was imported for Task 11 — this one is small enough to inline directly rather than a separate file, since it has no other consumer needing its own module):

```ts
export interface FormationSlotAssignment {
  row: number
  column: number
  combatantId: string
}

export interface FormationLoadout {
  formationId: string
  assignments: FormationSlotAssignment[]
}
```

Add to the `PlayerData` interface (after `companions: CompanionInstance[]`):

```ts
  // Trận Pháp (2026-09-05) — currently active formation + per-cell
  // assignment. null = player has never configured one; buildTurnBattle()
  // falls back to DEFAULT_PARTY_FORMATION (Combat Art Pipeline spec §7).
  formationLoadout: FormationLoadout | null
```

In `createDefaultPlayer()`, add before `lastSavedAt: Date.now(),`:

```ts
    formationLoadout: null,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run Player.test.ts`
Expected: PASS.

- [ ] **Step 5: Bump save version**

```ts
// v58 (2026-09-05, tran-phap spec): 1 field mới — formationLoadout
// (FormationLoadout | null, Trận Pháp đang active + vị trí từng
// combatant). Save v57 bị từ chối (dev phase, không migration).
export const CURRENT_SAVE_VERSION = 58 as const
```

- [ ] **Step 6: Full regression**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add game/src/core/player/Player.ts game/src/services/save/saveVersion.ts game/src/core/player/Player.test.ts
git commit -m "feat(tran-phap): add PlayerData.formationLoadout field, bump save v58"
```

## Task 18: `localCellToAbsolute()` + `resolvePartyFormation()`

**Files:**
- Create: `game/src/core/game/FormationPlacement.ts`
- Test: `game/src/core/game/FormationPlacement.test.ts`

**Interfaces:**
- Consumes: `PLAYER_SIDE_REGION` from Task 1, `DEFAULT_PARTY_FORMATION`/`PartyFormationSlot` from Task 3, `FormationLoadout`/`FormationSlotAssignment` from Task 17, `GridPosition`/`LaneIndex` from `BattleGrid.ts`.
- Produces: `localCellToAbsolute(cell: { row: number; column: number }): GridPosition`, `resolvePartyFormation(player: PlayerData): PartyFormationSlot[]`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { localCellToAbsolute, resolvePartyFormation } from './FormationPlacement'
import { DEFAULT_PARTY_FORMATION } from './PartyFormation'
import { createDefaultPlayer } from '../player/Player'

describe('localCellToAbsolute', () => {
  it('maps local (0,0) to PLAYER_SIDE_REGION\'s top-left corner (row 3, column 0)', () => {
    expect(localCellToAbsolute({ row: 0, column: 0 })).toEqual({ row: 3, column: 0 })
  })

  it('maps local (5,5) to PLAYER_SIDE_REGION\'s bottom-right corner (row 8, column 5)', () => {
    expect(localCellToAbsolute({ row: 5, column: 5 })).toEqual({ row: 8, column: 5 })
  })
})

describe('resolvePartyFormation', () => {
  it('falls back to DEFAULT_PARTY_FORMATION when player.formationLoadout is null', () => {
    const player = createDefaultPlayer()

    expect(resolvePartyFormation(player)).toEqual(DEFAULT_PARTY_FORMATION)
  })

  it('resolves a configured formationLoadout into absolute PartyFormationSlot positions', () => {
    const player = createDefaultPlayer()

    player.formationLoadout = {
      formationId: 'test_formation',
      assignments: [
        { row: 0, column: 0, combatantId: 'player' },
        { row: 2, column: 3, combatantId: 'companion_a' },
      ],
    }

    expect(resolvePartyFormation(player)).toEqual([
      { combatantId: 'player', row: 3, column: 0 },
      { combatantId: 'companion_a', row: 5, column: 3 },
    ])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run FormationPlacement.test.ts`
Expected: FAIL with "Cannot find module './FormationPlacement'".

- [ ] **Step 3: Implement**

```ts
// FormationPlacement (Trận Pháp spec §6, 2026-09-05) — resolves the
// player's saved FormationLoadout into absolute battlefield positions,
// or falls back to DEFAULT_PARTY_FORMATION if none has ever been
// configured. This is the ONE coordinated seam both the Combat Art
// Pipeline spec and the Trận Pháp spec pointed at buildTurnBattle() —
// implemented here as its own pure function so buildTurnBattle() (Task
// 19) stays a thin caller.
import type { GridPosition, LaneIndex } from '../battle/BattleGrid'
import { PLAYER_SIDE_REGION } from '../battle/BattlefieldRegions'
import type { PlayerData } from '../player/Player'
import { DEFAULT_PARTY_FORMATION, type PartyFormationSlot } from './PartyFormation'

export function localCellToAbsolute(cell: { row: number; column: number }): GridPosition {
  return {
    row: (PLAYER_SIDE_REGION.rowMin + cell.row) as LaneIndex,
    column: PLAYER_SIDE_REGION.columnMin + cell.column,
  }
}

export function resolvePartyFormation(player: PlayerData): PartyFormationSlot[] {
  if (!player.formationLoadout) {
    return DEFAULT_PARTY_FORMATION
  }

  return player.formationLoadout.assignments.map((assignment) => {
    const absolute = localCellToAbsolute(assignment)

    return { combatantId: assignment.combatantId, row: absolute.row, column: absolute.column }
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run FormationPlacement.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add game/src/core/game/FormationPlacement.ts game/src/core/game/FormationPlacement.test.ts
git commit -m "feat(tran-phap): localCellToAbsolute() + resolvePartyFormation(), the buildTurnBattle() integration seam"
```

## Task 19: `buildTurnBattle()` — real formation resolution + companions + formation buff

**Files:**
- Modify: `game/src/core/game/GameManager.ts:2405-2434` (`buildTurnBattle()` — this REPLACES Task 3's `const formation = DEFAULT_PARTY_FORMATION` placeholder line with a real `resolvePartyFormation(player)` call, and adds companion resolution)
- Test: extend `game/src/core/game/GameManager.partyFormation.test.ts` (from Task 3)

**Interfaces:**
- Consumes: `resolvePartyFormation` from Task 18, `companionToCombatEntity` from Task 12, `toTurnBattleParticipant` (existing), `player.companions`/`player.formationLoadout`.

- [ ] **Step 1: Write the failing test**

Add to `game/src/core/game/GameManager.partyFormation.test.ts`:

```ts
import { COMPANIONS } from '@/data/companion/Companions'

const TEST_COMPANION_DEFINITION = {
  id: 'test_companion_for_formation',
  name: 'Formation Test Companion',
  grade: 'hoang' as const,
  baseStats: { maxHp: 100, attack: 10, speed: 100 },
  basic: { id: 'test_companion_for_formation_basic', cooldownTurns: 0, damage: { kind: 'physical' as const, multiplier: 1 }, targeting: { shape: 'single' as const } },
}

describe('GameManager.buildTurnBattle — resolves a real FormationLoadout, includes companions', () => {
  it('places player + a companion at their configured cells, both in turnBattle.players', () => {
    // NOTE: COMPANIONS is empty at this point in the plan (content ships
    // later) — push a test-only definition into the array for this test's
    // duration, matching how other content-driven tests in this codebase
    // register a throwaway fixture rather than depending on real content.
    ;(COMPANIONS as unknown as typeof COMPANIONS[number][]).push(TEST_COMPANION_DEFINITION)

    const gameManager = new GameManager()
    const player = createPlayer()

    gameManager.registerSkillTemplates([createBasicSkill()])
    gameManager.learnSkill('basic_test')
    gameManager.skillSystem.equipToSlot('basic_test', 0)

    // Formation must be set on the PlayerData BEFORE startBattle builds the
    // TurnBattle — read GameManager's actual player-state plumbing (does it
    // hold its own PlayerData copy, or does the caller's `player` object
    // get read by reference?) fresh before assuming this direct mutation
    // is picked up; if GameManager copies PlayerData internally, this test
    // needs GameManager.setActivePlayer(player) called first instead.
    player.formationLoadout = {
      formationId: 'test_formation',
      assignments: [
        { row: 0, column: 0, combatantId: 'player' },
        { row: 1, column: 1, combatantId: 'test_companion_for_formation' },
      ],
    }

    gameManager.setActivePlayer(player)
    gameManager.startBattle(createPlayer(), createDummy())

    const battle = gameManager.getTurnBattle()!

    expect(battle.players).toHaveLength(2)
    expect(battle.players.map((p) => p.id)).toEqual(expect.arrayContaining(['player', 'test_companion_for_formation']))
  })
})
```

(This test's exact `PlayerData`-wiring details depend on how `GameManager.startBattle()`/`activePlayer` actually thread the player object into `buildTurnBattle()` — read `GameManager.ts`'s `startBattle()`/`startBattleWithPlayer()` fresh before finalizing this test; the comment above flags the ambiguity rather than guessing silently.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run GameManager.partyFormation.test.ts`
Expected: FAIL — `battle.players` still has length 1 (Task 3's placeholder ignores `player.formationLoadout` and never adds companions).

- [ ] **Step 3: Implement**

Read `GameManager.ts`'s current `buildTurnBattle()` fresh (post-Task-3 edit). Replace the placeholder line and add companion resolution:

```ts
  private buildTurnBattle(playerEntity: CombatEntity, enemyEntities: CombatEntity[]): TurnBattle {
    const playerPath = this.activePlayer

    const formation = playerPath ? resolvePartyFormation(playerPath) : DEFAULT_PARTY_FORMATION

    const playerSlot = formation.find((slot) => slot.combatantId === 'player')

    if (playerSlot) {
      playerEntity.row = playerSlot.row
      playerEntity.x = playerSlot.column
    }

    const playerParticipant = toTurnBattleParticipant(
      playerEntity,
      0,
      playerPath ? this.resolvePlayerBasicAttack(playerPath) : GENERIC_PHYSICAL_BASIC,
      playerPath?.cultivationPath,
    )

    const companionParticipants = (playerPath?.companions ?? []).flatMap((instance, index) => {
      const definition = COMPANIONS.find((candidate) => candidate.id === instance.definitionId)
      const slot = formation.find((entry) => entry.combatantId === instance.definitionId)

      if (!definition || !slot) {
        return [] // stale roster/formation reference — skip gracefully (spec §8 risk note), don't crash the battle
      }

      const entity = companionToCombatEntity(instance, definition)

      entity.row = slot.row
      entity.x = slot.column

      return [toTurnBattleParticipant(entity, index + 100, definition.basic)]
    })

    const enemyParticipants = enemyEntities.map((enemyEntity, index) => {
      const position = resolveEnemySpawnPosition({
        isBoss: enemyEntity.isBoss ?? false,
        random: Math.random,
      })

      enemyEntity.row = position.row
      enemyEntity.x = position.column

      return toTurnBattleParticipant(enemyEntity, index + 1, GENERIC_PHYSICAL_BASIC)
    })

    return {
      players: [playerParticipant, ...companionParticipants],
      enemies: enemyParticipants,
      state: 'countdown',
      // ... rest of the object UNCHANGED
```

Add imports at the top of `GameManager.ts`:

```ts
import { resolvePartyFormation } from './FormationPlacement'
import { companionToCombatEntity } from '../companion/CompanionCombat'
import { COMPANIONS } from '../../data/companion/Companions'
```

**Formation buff application** — read `TurnBattleSystem.declareActorAction()`'s boss-trigger buff-application block fresh (`TurnBattleSystem.ts:436-447`, applies a `TurnBuffDefinition` via `new TurnBuffSystem(actor.buffs).apply(definition, actor.entity, actor.entity, this.registry)`) to confirm the exact call shape, then apply the formation's buff once to every resolved participant (player + companions) right after they're constructed, inside `buildTurnBattle()`, using whichever `TurnBuffRegistry` `this.turnBattleSystem`/its constructor already holds:

```ts
    if (playerPath?.formationLoadout && this.turnBuffRegistry) {
      const formationDefinition = TRAN_PHAP_FORMATIONS.find((f) => f.id === playerPath.formationLoadout!.formationId)

      if (formationDefinition) {
        const buffDefinition = this.turnBuffRegistry.get(formationDefinition.buff.definitionId)

        for (const participant of [playerParticipant, ...companionParticipants]) {
          new TurnBuffSystem(participant.buffs).apply(buffDefinition, participant.entity, participant.entity, this.turnBuffRegistry)
        }
      }
    }
```

(The exact name of the registry field GameManager holds — `this.turnBuffRegistry` is a guess matching the naming convention seen in `TurnBattleSystem`'s constructor param `registry?: TurnBuffRegistry` — must be confirmed by reading `GameManager.ts`'s own field declarations fresh; if it's named differently or constructed inline when `this.turnBattleSystem` is built, adjust this block to read from wherever the real registry instance actually lives.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run GameManager.partyFormation.test.ts`
Expected: PASS.

- [ ] **Step 5: Full regression + typecheck**

Run: `npx vitest run`
Run: `npx vue-tsc --noEmit`
Expected: both clean.

- [ ] **Step 6: Commit**

```bash
git add game/src/core/game/GameManager.ts game/src/core/game/GameManager.partyFormation.test.ts
git commit -m "feat(tran-phap): buildTurnBattle() resolves real FormationLoadout, includes companions, applies formation buff"
```

## Task 20: `TranPhapPanel.vue` — drag-and-drop UI

**Files:**
- Check first (Glob `game/src/**/*.vue` for any existing drag-drop component, e.g. inventory sort — per the spec's own risk note §8, do not assume a library is already in use) before choosing an implementation approach.
- Create: `game/src/components/panels/TranPhapPanel.vue`
- Modify: `game/src/components/layout/GameRoot.vue` (add the new panel to the existing standalone-panel list, e.g. alongside `<SkillPathPanel />`/`<ArtifactPanel />` at `~82-94`)

**Interfaces:**
- Consumes: `TRAN_PHAP_FORMATIONS` from Task 16, `player.companions`/`player.formationLoadout` from Tasks 11/17, `PLAYER_SIDE_REGION` from Task 1 (for the 6×6 grid's own local coordinate rendering — the panel's grid is ALWAYS 6×6 regardless of absolute battlefield coordinates, per spec §5).

- [ ] **Step 1: Check for an existing drag-drop pattern**

Run: `grep -rln "draggable\|dragstart\|@dragover" game/src/components` — read whatever is found (e.g. inventory bag sorting) to match its exact event-handling style; if nothing exists, use native HTML5 drag events (`draggable="true"`, `@dragstart`, `@dragover.prevent`, `@drop`) as the simplest option requiring no new dependency (matches this project's "no new dependency unless required" constraint).

- [ ] **Step 2: Build the panel**

```vue
<script setup lang="ts">
// Trận Pháp panel (spec, 2026-09-05) — drag player/companion cards into a
// 6x6 grid (local coordinates, mapped to PLAYER_SIDE_REGION at battle
// start via FormationPlacement.localCellToAbsolute — NOT done here, this
// panel only edits PlayerData.formationLoadout). Only cells in the
// selected Trận Pháp's cellPattern accept a drop.
import { computed, ref } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { useStateVersion } from '@/composables/useGameState'
import { TRAN_PHAP_FORMATIONS } from '@/data/formation/TranPhap'
import type { TranPhapDefinition } from '@/data/formation/TranPhap'
import type { FormationSlotAssignment } from '@/core/player/Player'

const player = usePlayerStore()
const { stateVersion, bumpState } = useStateVersion()

const selectedFormationId = ref<string | null>(player.formationLoadout?.formationId ?? null)

const selectedFormation = computed<TranPhapDefinition | null>(() => {
  stateVersion.value

  return TRAN_PHAP_FORMATIONS.find((f) => f.id === selectedFormationId.value) ?? null
})

const currentAssignments = ref<FormationSlotAssignment[]>(player.formationLoadout?.assignments ?? [])

function isLitCell(row: number, column: number): boolean {
  return selectedFormation.value?.cellPattern.some((cell) => cell.row === row && cell.column === column) ?? false
}

function assignmentAt(row: number, column: number): FormationSlotAssignment | undefined {
  return currentAssignments.value.find((a) => a.row === row && a.column === column)
}

function combatantCards(): { combatantId: string; label: string }[] {
  const placed = new Set(currentAssignments.value.map((a) => a.combatantId))
  const cards: { combatantId: string; label: string }[] = []

  if (!placed.has('player')) {
    cards.push({ combatantId: 'player', label: player.name })
  }

  for (const instance of player.companions) {
    if (!placed.has(instance.definitionId)) {
      cards.push({ combatantId: instance.definitionId, label: instance.definitionId })
    }
  }

  return cards
}

function onSelectFormation(formation: TranPhapDefinition) {
  selectedFormationId.value = formation.id

  // Drop any assignment whose cell isn't valid in the new pattern — the
  // combatant returns to the queue automatically (spec §4).
  currentAssignments.value = currentAssignments.value.filter((a) =>
    formation.cellPattern.some((cell) => cell.row === a.row && cell.column === a.column),
  )
}

function onDrop(row: number, column: number, combatantId: string) {
  if (!isLitCell(row, column)) {
    return
  }

  currentAssignments.value = [
    ...currentAssignments.value.filter((a) => a.combatantId !== combatantId && !(a.row === row && a.column === column)),
    { row, column, combatantId },
  ]
}

function onConfirm() {
  if (!selectedFormation.value) {
    return
  }

  player.formationLoadout = {
    formationId: selectedFormation.value.id,
    assignments: currentAssignments.value,
  }

  bumpState()
}
</script>

<template>
  <div v-if="player.standalonePanel === 'tran_phap'" class="tran-phap-panel">
    <div class="tran-phap-panel__grid">
      <div
        v-for="row in 6"
        :key="row"
        class="tran-phap-panel__row"
      >
        <div
          v-for="column in 6"
          :key="column"
          class="tran-phap-panel__cell"
          :class="{ 'tran-phap-panel__cell--lit': isLitCell(row - 1, column - 1) }"
          @dragover.prevent
          @drop="(event) => onDrop(row - 1, column - 1, (event as DragEvent).dataTransfer?.getData('text/plain') ?? '')"
        >
          {{ assignmentAt(row - 1, column - 1)?.combatantId ?? '' }}
        </div>
      </div>
    </div>

    <div class="tran-phap-panel__formation-list">
      <button
        v-for="formation in TRAN_PHAP_FORMATIONS"
        :key="formation.id"
        type="button"
        :class="{ 'is-selected': formation.id === selectedFormationId }"
        @click="onSelectFormation(formation)"
      >
        {{ formation.name }}
      </button>
    </div>

    <div class="tran-phap-panel__queue">
      <div
        v-for="card in combatantCards()"
        :key="card.combatantId"
        draggable="true"
        class="tran-phap-panel__card"
        @dragstart="(event) => (event as DragEvent).dataTransfer?.setData('text/plain', card.combatantId)"
      >
        {{ card.label }}
      </div>
    </div>

    <button type="button" :disabled="!selectedFormation" @click="onConfirm">Lưu Trận Pháp</button>
  </div>
</template>

<style scoped>
.tran-phap-panel {
  position: absolute;
  inset: 0;
  z-index: 30;
  display: grid;
  grid-template-columns: 1fr 200px;
  grid-template-rows: 1fr auto;
  gap: var(--space-3, 12px);
  padding: var(--space-4, 16px);
  background: var(--ink-950);
}

.tran-phap-panel__row {
  display: flex;
}

.tran-phap-panel__cell {
  width: 64px;
  height: 64px;
  border: 1px solid var(--surface-line);
  opacity: 0.35;
}

.tran-phap-panel__cell--lit {
  opacity: 1;
  border-color: var(--jade, #4caf50);
}

.tran-phap-panel__queue {
  grid-column: 1 / -1;
  display: flex;
  gap: var(--space-2, 8px);
}

.tran-phap-panel__card {
  cursor: grab;
  padding: var(--space-2, 8px);
  border: 1px solid var(--surface-line);
}
</style>
```

(The exact `player.standalonePanel === 'tran_phap'` gating mechanism must match however this codebase's OTHER standalone panels — `SkillPathPanel.vue`, `ArtifactPanel.vue` — are shown/hidden; read one of them fresh and match its exact pattern, since this plan's guess at a `standalonePanel` store field name may not be the real mechanism.)

- [ ] **Step 3: Mount in `GameRoot.vue`**

Read `GameRoot.vue`'s existing standalone-panel list (`~82-94`) fresh, add `<TranPhapPanel />` alongside `<SkillPathPanel />`/`<ArtifactPanel />`, matching the exact same conditional-rendering convention those use.

- [ ] **Step 4: Manual verification**

Run: `npm run dev`, open the Trận Pháp panel (via whatever entry point Step 3 wired it to), select a formation, confirm only its cells light up, drag the player card into a lit cell, drag it back out to a different lit cell, switch to a formation whose pattern excludes that cell and confirm the card returns to the queue, click "Lưu Trận Pháp" and confirm `player.formationLoadout` updates (verify via Vue devtools or a temporary console log).

- [ ] **Step 5: Typecheck + full regression**

Run: `npx vue-tsc --noEmit`
Run: `npx vitest run`
Expected: both clean.

- [ ] **Step 6: Commit**

```bash
git add game/src/components/panels/TranPhapPanel.vue game/src/components/layout/GameRoot.vue
git commit -m "feat(tran-phap): drag-and-drop formation panel (grid + formation cards + roster queue)"
```

## Task 21: Part C verification + final roadmap update

- [ ] Run `npx vitest run` — full suite green.
- [ ] Run `npx vue-tsc --noEmit` — zero errors.
- [ ] Manual playtest: configure a Trận Pháp with the player in a non-default cell, start a battle, confirm (via Task 5's rendering work from Part A) the player sprite appears at the configured position rather than the old fixed `HERO_LANE_INDEX`/`HERO_COLUMN`.
- [ ] Confirm `DEFAULT_PARTY_FORMATION` fallback still works for a save with `formationLoadout: null` (a fresh `createDefaultPlayer()`) — battle should look identical to pre-Trận-Pháp behavior.
- [ ] Update `game/docs/roadmap.md` with a final section: all 3 parts (Combat Art Pipeline, Companion Roster, Trận Pháp) shipped, linking this plan and all 3 specs. Note explicitly that `COMPANIONS`/`TRAN_PHAP_FORMATIONS` are still empty arrays (mechanism-only, content is a separate future pass).
- [ ] Commit: `git commit -m "docs: roadmap — Trận Pháp (Part C) shipped, all 3 combat-art/roster/formation systems complete"`.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-09-05-combat-art-roster-tranphap.md`. Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration across all 21 tasks.
2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
