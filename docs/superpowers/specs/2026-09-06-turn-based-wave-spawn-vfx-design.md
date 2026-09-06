# Turn-Based Wave Redesign + Spawn VFX Wiring (Part 3+4 of 4) Design

## Problem

Turn-based combat (`TurnBattleSystem`) currently spawns enemies **one at a
time**: `WaveSpawnTrigger.shouldSpawnNextEnemy()` queues the next enemy the
instant the arena is empty, with no telegraph and no concept of "wave" —
just a running `spawnedCount` vs. `stage.totalEnemyCount`. This has two
consequences the user flagged:

1. No difficulty pacing via simultaneous-enemy pressure — every stage feels
   identical regardless of `totalEnemyCount` (10-19 by level), since only
   ever 1 enemy is on the field.
2. **Zero spawn VFX** for turn-based combat. `EnemySpawnVfx.ts`'s
   "telegraph → materialize" effect exists and is fully wired for the
   legacy real-time engine, but turn-based combat's `emitTurnBattleEntitySnapshot()`
   creates entity sprites the instant they appear in `battle.players`/
   `battle.enemies` — no telegraph phase, no VFX. The 3→2→1 countdown before
   a turn-based battle starts shows nothing (player/companions just appear).

Survey of `EffectiveEnemyCount.ts`/`StageWaveSystem.pickEnemyForSpawn()`
also surfaced a fact that shapes this design: **Boss only ever spawns at
floor 10** (the last floor of each of the 3 realms — Luyện Khí, Phàm Nhân,
Trúc Cơ), and `effectiveTotalEnemyCount()` already forces floor-10 stages
into a **solo 1-enemy fight** regardless of the stage's raw `totalEnemyCount`
(19). Floors 1-9 have `bossEnemyId` as unused reserved metadata — no Boss
ever spawns there. This means the wave redesign only has real content on
floors 1-9 (27 of the 30 stages); floor 10 stays a solo fight, unaffected.

## Goals

1. Stage data authors how many enemies spawn **simultaneously** per wave
   (`waves: number[]`), for all 27 non-floor-10 stages, replacing the
   current "always 1 enemy on the field" model. Floor-10 solo-boss stages
   keep their existing override behavior unchanged.
2. `TurnBattleSystem` spawns an entire wave's enemies at once (as pending
   telegraphs) when the arena is fully clear, instead of one enemy at a
   time.
3. Every enemy spawn (wave enemies, from now on) goes through a telegraph
   phase before joining `battle.enemies` — matching the real-time engine's
   existing rule that a telegraphing enemy cannot be targeted or act.
4. The 3→2→1 countdown before a turn-based battle starts shows a spawn
   telegraph for **every** party member (player + companions), not just
   the player — reusing the same visual language as enemy spawn telegraphs.
5. Reuse `EnemySpawnVfx.ts` (`spawnEnemySpawnVfx()`) as-is — turn-based
   combat gets its own snapshot→VFX wiring in `CombatScene`, but the actual
   VFX drawing code is not duplicated.
6. Zero behavior change to the real-time legacy engine (`legacy/BattleSystem.ts`)
   or its existing spawn-telegraph flow — this spec only adds a second,
   independent consumer of the same VFX primitive.

## Non-Goals

- No "revive" mechanic — none exists in turn-based combat today (verified:
  no revive/resurrect code anywhere under `core/battle/turn/`). If one is
  built later, it can reuse `spawnEnemySpawnVfx()`, but that is a separate
  future spec.
- No change to `effectiveTotalEnemyCount()`'s floor-10 override, to
  `pickEnemyForSpawn()`'s boss-at-floor-10 gate, or to any existing
  `isFinalSpawn`/victory-condition logic — this spec adds wave/telegraph
  bookkeeping alongside those, it does not replace them.
- Pacing between waves is **not** a separate idle delay — the telegraph
  duration itself is the pacing (per the user's prior decision "cố định
  theo độ dài spawn animation"). No additional cooldown after a wave
  clears before the next wave's telegraph begins.
- No change to `StageWaveSystem.ts` (the legacy real-time wave driver) —
  it keeps spawning one enemy at a time exactly as today. Only
  `TurnBattleSystem` gets the wave-batch behavior.
- Exact literal `waves: number[]` values for all 30 stages are proposed in
  this spec's Design section (Goal 1 needs concrete numbers to be
  reviewable), but the actual data-file edits happen in the implementation
  plan, not here.

## Design

### 1. `Stage.waves` + `effectiveWaves()`

`game/src/core/stage/Stage.ts` gains a new required field:

```ts
export interface Stage {
  // ... existing fields unchanged ...

  /**
   * Turn-Based Wave Redesign (2026-09-06) — số quái spawn ĐỒNG THỜI mỗi
   * wave, theo thứ tự. sum(waves) PHẢI bằng totalEnemyCount (test bất
   * biến enforce điều này cho mọi stage — xem EffectiveWaves.test.ts).
   * Stage floor 10 (solo boss) vẫn khai waves bình thường (dữ liệu thô,
   * không override) — effectiveWaves() mới là hàm áp override thành [1],
   * y hệt cách effectiveTotalEnemyCount() đã làm cho totalEnemyCount.
   */
  waves: number[]
}
```

New file `game/src/core/stage/EffectiveWaves.ts` (sibling of
`EffectiveEnemyCount.ts`, same override condition):

```ts
// EffectiveWaves (Turn-Based Wave Redesign, 2026-09-06) — mirror đúng
// EffectiveEnemyCount.ts's floor-10 solo-boss override, áp cho waves[]
// thay vì totalEnemyCount. Boss CHỈ xuất hiện ở floor 10 (xem
// StageWaveSystem.pickEnemyForSpawn()'s "DESIGN: boss chỉ xuất hiện ở
// tầng 10" comment) — floor 10 LUÔN là 1 wave duy nhất, 1 quái.
import type { Stage } from './Stage'

export function effectiveWaves(stage: Stage): number[] {
  if (stage.floor === 10 && stage.bossEnemyId) {
    return [1]
  }

  return stage.waves
}
```

Data-integrity test (in `EffectiveWaves.test.ts`, iterating the real
`STAGES` export):

```ts
import { describe, expect, it } from 'vitest'
import { STAGES } from '@/data/stage/Stages'
import { effectiveTotalEnemyCount } from './EffectiveEnemyCount'
import { effectiveWaves } from './EffectiveWaves'

describe('effectiveWaves() sum invariant (Turn-Based Wave Redesign)', () => {
  it.each(STAGES.map((stage) => stage.id))('%s: sum(effectiveWaves) === effectiveTotalEnemyCount', (stageId) => {
    const stage = STAGES.find((candidate) => candidate.id === stageId)!
    const waves = effectiveWaves(stage)
    const sum = waves.reduce((total, count) => total + count, 0)

    expect(sum).toBe(effectiveTotalEnemyCount(stage))
  })
})
```

This test is the safety net for the 30 literal `waves` arrays proposed
below — any future edit to a stage's `totalEnemyCount` or `waves` that
drifts out of sync fails immediately.

### 2. Proposed `waves` values for all 30 stages

All 3 realms (Luyện Khí `qi_refining_*`, Phàm Nhân `mortal_dong_*`, Trúc
Cơ `foundation_floor_*`) share the **identical** `totalEnemyCount` per
level (10 at level 1, up to 19 at level 10 — confirmed by reading
`Stages.ts`'s normalization: `10 + (requiredRealmLevel - 1)` for the first
two realms, and explicit matching values for Trúc Cơ). So one formula
covers all 27 non-floor-10 stages: 3 waves, growing steadily, difficulty
scaling via **wave size** (more simultaneous enemies) rather than wave
*count* — every stage feels like "3 pushes," with each push containing
more enemies as the level rises.

| Level (floor) | `totalEnemyCount` | `waves` (floors 1-9) |
|---|---|---|
| 1 | 10 | `[3, 3, 4]` |
| 2 | 11 | `[3, 4, 4]` |
| 3 | 12 | `[4, 4, 4]` |
| 4 | 13 | `[4, 4, 5]` |
| 5 | 14 | `[4, 5, 5]` |
| 6 | 15 | `[5, 5, 5]` |
| 7 | 16 | `[5, 5, 6]` |
| 8 | 17 | `[5, 6, 6]` |
| 9 | 18 | `[6, 6, 6]` |
| 10 (solo boss) | 19 (raw) → 1 (effective) | `[19]` raw data (unused at runtime — `effectiveWaves()` returns `[1]` instead) |

Applies identically to all three realms at the same level: `qi_refining_forest`
(level 1, no explicit `requiredRealmLevel` = 1) through `qi_refining_abyssal_pool`
(level 10); `mortal_dong_1` through `mortal_dong_10`; `foundation_floor_1`
through `foundation_floor_10`. The floor-10 stages
(`qi_refining_abyssal_pool`, `mortal_dong_10`, `foundation_floor_10`) get
`waves: [19]` as raw data purely so the field is present and the sum
invariant holds against the raw `totalEnemyCount: 19` — `effectiveWaves()`
overrides it to `[1]` at read time, matching `effectiveTotalEnemyCount()`'s
existing override, so no gameplay behavior changes for these 3 stages.

### 3. `TurnBattleSystem` — wave-batch spawn + telegraph

`TurnBattle.wave` (currently `{ totalEnemyCount, spawnedCount }`) gains
three fields. The two existing fields are **unchanged in meaning** — they
still drive `isFinalSpawn`/`isStageComplete` exactly as today:

```ts
wave?: {
  totalEnemyCount: number
  spawnedCount: number
  /** effectiveWaves(stage) snapshot, taken once at battle start. */
  waves: number[]
  /** 0-based index into `waves` — which wave is currently spawning/active. */
  waveIndex: number
  /** Quái đã spawn (dạng pending hoặc materialized) nhưng CHƯA vào trận thật. */
  pendingEnemySpawns: PendingEnemySpawn[]
}
```

New type (in `TurnBattleSystem.ts` or a sibling file):

```ts
export interface PendingEnemySpawn {
  /** Đã build đầy đủ (roll template/elite/boss xong) — chỉ chờ hết telegraph. */
  participant: TurnBattleParticipant
  ticksRemaining: number
  totalTicks: number
}
```

Telegraph duration by rank — direct tick conversion (0.1s/tick, matching
`BATTLE_FIXED_STEP`) from the real-time engine's existing
`SPAWN_TELEGRAPH_SECONDS` (`legacy/BattleSystem.ts:140`):

```ts
// Turn-Based Wave Redesign (2026-09-06) — quy đổi TRỰC TIẾP từ
// SPAWN_TELEGRAPH_SECONDS của legacy/BattleSystem.ts (0.75s/1.0s/1.4s)
// sang tick (0.1s/tick, khớp BATTLE_FIXED_STEP) để giữ đúng cảm giác thời
// gian người chơi đã quen — KHÔNG đổi giá trị giây gốc, chỉ đổi đơn vị.
const SPAWN_TELEGRAPH_TICKS = {
  normal: 8,
  elite: 10,
  boss: 14,
} as const

function spawnTelegraphTicks(entity: Pick<CombatEntity, 'isBoss' | 'isElite'>): number {
  if (entity.isBoss) {
    return SPAWN_TELEGRAPH_TICKS.boss
  }

  if (entity.isElite) {
    return SPAWN_TELEGRAPH_TICKS.elite
  }

  return SPAWN_TELEGRAPH_TICKS.normal
}
```

`WaveSpawnTrigger.ts` gains a wave-aware replacement for
`shouldSpawnNextEnemy()` (kept side-by-side — nothing else calls the old
one after this spec's plan lands, but deleting it is a plan-time decision,
not a spec-time one):

```ts
/**
 * True iff the arena is fully clear (no living enemy, no pending
 * telegraph) AND there is another wave left to spawn.
 */
export function shouldStartNextWave(
  aliveCount: number,
  pendingCount: number,
  waveIndex: number,
  waveCount: number,
): boolean {
  return aliveCount === 0 && pendingCount === 0 && waveIndex < waveCount
}
```

`isStageComplete()` gains a 4th parameter (pending must also be empty —
otherwise victory could fire while the last wave is still telegraphing,
invisible but not yet real):

```ts
export function isStageComplete(
  spawnedCount: number,
  totalEnemyCount: number,
  aliveCount: number,
  pendingCount: number,
): boolean {
  return spawnedCount >= totalEnemyCount && aliveCount === 0 && pendingCount === 0
}
```

`TurnBattleSystem.ts`'s per-tick spawn block (currently
lines 771-778, the `if (battle.wave && this.spawnEnemy)` block) becomes:

```ts
if (battle.wave && this.spawnEnemy) {
  const stillPending: PendingEnemySpawn[] = []

  for (const pending of battle.wave.pendingEnemySpawns) {
    const ticksRemaining = pending.ticksRemaining - 1

    if (ticksRemaining <= 0) {
      battle.enemies.push(pending.participant)
    } else {
      stillPending.push({ ...pending, ticksRemaining })
    }
  }

  battle.wave.pendingEnemySpawns = stillPending

  const aliveEnemyCount = battle.enemies.filter((enemy) => enemy.entity.alive).length

  if (
    shouldStartNextWave(
      aliveEnemyCount,
      battle.wave.pendingEnemySpawns.length,
      battle.wave.waveIndex,
      battle.wave.waves.length,
    )
  ) {
    const waveSize = battle.wave.waves[battle.wave.waveIndex]!

    for (let index = 0; index < waveSize; index++) {
      const participant = this.spawnEnemy()
      const totalTicks = spawnTelegraphTicks(participant.entity)

      battle.wave.pendingEnemySpawns.push({ participant, ticksRemaining: totalTicks, totalTicks })
      battle.wave.spawnedCount += 1
    }

    battle.wave.waveIndex += 1
  }
}

const finalAliveEnemyCount = battle.enemies.filter((enemy) => enemy.entity.alive).length
const finalPendingCount = battle.wave?.pendingEnemySpawns.length ?? 0

if (battle.players.every((member) => !member.entity.alive)) {
  battle.state = 'defeat'
} else if (
  battle.wave
    ? isStageComplete(battle.wave.spawnedCount, battle.wave.totalEnemyCount, finalAliveEnemyCount, finalPendingCount)
    : battle.enemies.every((enemy) => !enemy.entity.alive)
) {
  battle.state = 'victory'
}
```

Note `this.spawnEnemy` (the factory GameManager passes into
`TurnBattleSystem`'s constructor) is called with **no change to its own
signature or internals** — it still builds a fully-formed
`TurnBattleParticipant` (template roll, elite/boss variant, position via
`resolveEnemySpawnPosition()`) exactly as today. The only change is WHEN
the result is pushed into `battle.enemies` — immediately today, after N
telegraph ticks with this spec. `isFinalSpawn` (passed by GameManager's
`spawnEnemy` closure into `pickEnemyForTurnSpawn()`) is computed from
`battle.wave.spawnedCount`/`effectiveTotalEnemyCount()` exactly as today —
unaffected by wave grouping, since `spawnedCount` still increments once
per enemy regardless of which wave it belongs to.

`GameManager.restartTurnBattleCycle()`'s `TurnBattle` construction gains
the three new fields:

```ts
this.turnBattle = {
  players: previous.players,
  enemies: [],
  state: 'fighting',
  totalTurnsElapsed: 0,
  wave: {
    totalEnemyCount: effectiveTotalEnemyCount(stageRef),
    spawnedCount: 0,
    waves: effectiveWaves(stageRef),
    waveIndex: 0,
    pendingEnemySpawns: [],
  },
}
```

(The equivalent construction in `startStage()`, around `GameManager.ts:3283`,
gets the same three new fields added.)

### 4. Countdown telegraph for the whole party

`buildTurnBattle()` already sets `state: 'countdown'`,
`countdownTurnsRemaining: 30` (a 3-second countdown at the 0.1s fixed
step). This is purely presentation — `battle.players` is already fully
populated with real participants at construction time (unlike enemies,
party members do not go through the pending-spawn queue). The countdown
telegraph is therefore a **read-only presentation concern** layered on top
of existing data, not a new gameplay gate.

### 5. Snapshot event extension (`TurnActionPresentationEvents.ts`)

```ts
export interface PendingSpawnVisualState {
  id: string
  row: number
  column: number
  isBoss: boolean
  /** 0 = vừa queue, 1 = sắp materialize (tick kế tiếp vào battle.enemies). */
  progress: number
  presetId: EnemySpawnVfxPresetId
}

export interface TurnBattleEntitySnapshotEvent {
  players: TurnBattleEntityVisualState[]
  enemies: TurnBattleEntityVisualState[]
  /** Turn-Based Wave Redesign (2026-09-06) — quái đang telegraph, CHƯA vào battle.enemies. */
  pendingEnemySpawns: PendingSpawnVisualState[]
  /** Chỉ có mặt khi battle.state === 'countdown'; 0→1 hết 3s countdown. */
  countdownProgress?: number
}
```

`emitTurnBattleEntitySnapshot()` gains the mapping:

```ts
export function emitTurnBattleEntitySnapshot(eventBus: EventBus, battle: TurnBattle): void {
  eventBus.emit('turn_battle_entity_snapshot', {
    players: battle.players.map(toVisualState),
    enemies: battle.enemies.map(toVisualState),
    pendingEnemySpawns: (battle.wave?.pendingEnemySpawns ?? []).map((pending) => {
      const position = entityGridPosition(pending.participant.entity)

      return {
        id: pending.participant.id,
        row: position.row,
        column: position.column,
        isBoss: pending.participant.entity.isBoss ?? false,
        progress: 1 - pending.ticksRemaining / pending.totalTicks,
        presetId: pending.participant.entity.isBoss
          ? 'boss_spawn'
          : pending.participant.entity.isElite
            ? 'elite_spawn'
            : 'enemy_spawn',
      }
    }),
    countdownProgress:
      battle.state === 'countdown' && battle.countdownTurnsRemaining !== undefined
        ? 1 - battle.countdownTurnsRemaining / COUNTDOWN_TOTAL_TICKS
        : undefined,
  })
}
```

`COUNTDOWN_TOTAL_TICKS = 30` is exported from wherever `buildTurnBattle()`
sets `countdownTurnsRemaining: 30` today (`GameManager.ts`) so the two
values can never drift — this spec's plan will move that literal `30` into
a shared named constant both files import.

### 6. `CombatScene` wiring — reuse `EnemySpawnVfx` for two independent flows

Two flows, kept intentionally separate (different data shape, different
risk profile):

**(a) Enemy wave telegraph** — reuses the EXACT SAME reconciliation
function the legacy engine already uses, `CombatVfxSpawner.reconcileSpawnVfx()`,
generalized behind a narrow interface instead of the concrete
`BattlePositionsEvent` it currently takes (same "generalize behind an
interface" pattern already used for `CombatGridViewHost`, Part 1 of this
initiative):

```ts
// combat-vfx-spawner.ts — subset of BattlePositionsEvent that
// reconcileSpawnVfx() actually reads. BattlePositionsEvent already
// satisfies this structurally (TypeScript structural typing) — legacy's
// existing call site needs ZERO changes. Turn-based combat constructs its
// own object of this shape from TurnBattleEntitySnapshotEvent.
export interface SpawnVfxSnapshot {
  spawningEnemies?: {
    id: string
    row: LaneIndex
    column: number
    progress: number
    isBoss: boolean
    presetId: EnemySpawnVfxPresetId
  }[]
}

reconcileSpawnVfx(event: SpawnVfxSnapshot) {
  // ... body UNCHANGED — already only reads event.spawningEnemies ...
}
```

`CombatScene.onTurnBattleEntitySnapshot()` calls it with a turn-based-built
object:

```ts
private onTurnBattleEntitySnapshot(event: TurnBattleEntitySnapshotEvent) {
  this.reconcileCombatantSprites('player', event.players, PLAYER_COLOR)
  this.reconcileCombatantSprites('enemy', event.enemies, ENEMY_COLOR)

  this.vfxSpawner.reconcileSpawnVfx({
    spawningEnemies: event.pendingEnemySpawns.map((pending) => ({
      id: pending.id,
      row: pending.row as LaneIndex,
      column: pending.column,
      progress: pending.progress,
      isBoss: pending.isBoss,
      presetId: pending.presetId,
    })),
  })
}
```

Because `reconcileSpawnVfx()` already handles "id disappears → `complete()`
+ mark `materializingIds`" generically, and `reconcileCombatantSprites()`'s
`'create'` branch already runs on the SAME tick an enemy id first appears
in `event.enemies` (which only happens once its telegraph reaches 0 ticks
— see §3), the existing materialize fade-in hook
(`this.materializingIds.has(id)` → `playMaterializeFadeIn(sprite)`,
currently only wired into the legacy `reconcileEnemySprites()` path) needs
the same one-line check added to `reconcileCombatantSprites()`'s `'create'`
branch:

```ts
if (this.materializingIds.has(action.state.id)) {
  this.materializingIds.delete(action.state.id)
  this.playMaterializeFadeIn(sprite)
}
```

**(b) Party countdown telegraph** — deliberately a **separate, new**
method rather than generalizing `reconcilePlayerSpawn()` (the legacy
single-player telegraph). Reasons: `reconcilePlayerSpawn()` is
single-id-shaped (`playerMaterialized: boolean` + one `playerSpawn`
object) and real-time-only; generalizing it to N ids would touch legacy
code covered by pixel-parity tests for no reuse benefit, since turn-based's
countdown telegraph has a different lifecycle (all party members
materialize simultaneously at one shared `countdownProgress`, not
individually). A new, isolated method avoids risk to the legacy path
entirely — consistent with this plan's Non-Goal of zero legacy behavior
change.

```ts
// CombatScene — new field alongside spawnVfxHandles/materializingIds.
turnCountdownSpawnVfxHandles = new Map<string, EnemySpawnVfxHandle>()
turnCountdownPendingIds = new Set<string>()
```

```ts
private reconcileTurnCountdownSpawn(event: TurnBattleEntitySnapshotEvent) {
  if (event.countdownProgress === undefined) {
    // Countdown vừa kết thúc (hoặc chưa từng bắt đầu) — flush mọi handle
    // còn treo: flash materialize + hiện sprite thật cho từng id.
    for (const [id, handle] of this.turnCountdownSpawnVfxHandles) {
      handle.complete()

      const sprite = this.sprites.get(id)

      sprite?.rect.setVisible(true)
    }

    this.turnCountdownSpawnVfxHandles.clear()
    this.turnCountdownPendingIds.clear()

    return
  }

  for (const player of event.players) {
    this.turnCountdownPendingIds.add(player.id)

    const existing = this.turnCountdownSpawnVfxHandles.get(player.id)

    if (existing) {
      existing.update(event.countdownProgress)
      continue
    }

    if (!this.projection) {
      continue
    }

    const handle = spawnEnemySpawnVfx({
      scene: this,
      projection: this.projection,
      row: player.row,
      column: player.column,
      presetId: 'player_spawn',
      uprightDepth: this.resolveUprightVfxDepth(player),
    })

    this.turnCountdownSpawnVfxHandles.set(player.id, handle)
  }
}
```

`reconcileCombatantSprites()`'s `'create'` branch gains one visibility
check (only affects ids currently mid-countdown — enemies are never in
`turnCountdownPendingIds`, so this is a no-op for them):

```ts
sprite.rect.setVisible(!this.turnCountdownPendingIds.has(action.state.id))
```

`onTurnBattleEntitySnapshot()` calls `reconcileTurnCountdownSpawn(event)`
**before** `reconcileCombatantSprites('player', ...)`, so a party member's
very first `'create'` (while still counting down) is born hidden, and the
countdown-end flush (above) explicitly re-shows it once telegraph
completes — mirroring the legacy player-spawn flow's hide-then-reveal
sequence without touching the legacy method itself.

## Testing

- `EffectiveWaves.test.ts` — the sum-invariant test (§1) across all 30
  real stages; explicit test that floor-10 stages return `[1]` regardless
  of their raw `waves` data.
- `WaveSpawnTrigger.test.ts` — `shouldStartNextWave()` true only when
  alive=0 AND pending=0 AND waveIndex < waveCount; `isStageComplete()`'s
  new pending-aware behavior (false while pending > 0 even if
  spawnedCount/aliveCount already satisfy the old 3-arg condition — direct
  regression test for the "victory fires mid-telegraph" bug this spec
  prevents).
- `TurnBattleSystem.test.ts` — a full wave-cycle test: 3-enemy wave queued
  as pending, ticks down, all 3 materialize into `battle.enemies`
  simultaneously (not staggered) after N ticks; second wave does not start
  until all of wave 1 is both dead AND has 0 pending; `isFinalSpawn` still
  correctly true only for a genuinely final enemy across multi-wave
  bookkeeping.
- `combat-entity-reconciliation.test.ts` / new `CombatVfxSpawner`-focused
  test — `SpawnVfxSnapshot`-typed call proves `reconcileSpawnVfx()` still
  compiles and behaves identically when called from a plain object shape
  (not a real `BattlePositionsEvent`) — the generalization's compile-time
  proof, same technique as `CombatGridViewHost.test.ts` in Part 1.
- New `CombatScene.turnCountdownSpawn.test.ts` — regression test asserting
  a player/companion sprite is NOT visible while `countdownProgress` is
  defined, and IS visible on the tick `countdownProgress` becomes
  `undefined` — direct proof against reintroducing the "player invisible
  in combat" bug (fixed 2026-09-06, `f179a2b`) via this new hide-then-reveal
  path.
- Manual Playwright pass: start any stage, observe the 3→2→1 countdown
  showing spawn telegraph circles for player + every companion
  simultaneously, all materializing together as countdown ends; observe a
  wave of 3+ enemies telegraphing and appearing together (not one at a
  time); confirm a fully-cleared wave's telegraph for the next wave begins
  immediately with no dead pause.

## Self-Review

- **Placeholder scan**: no "TBD"/"TODO" remaining.
- **Internal consistency**: §3's `isStageComplete()` 4-arg signature is
  used consistently in the tick-block code sample; §1's `waves` field and
  §2's literal table agree (floor 10 uses raw `[19]`, overridden to `[1]`
  by `effectiveWaves()`, matching `effectiveTotalEnemyCount()`'s existing
  floor-10 behavior — no new special-casing invented).
- **Scope check**: this is a two-part spec by explicit user request
  ("gom 3 4 lại"), but each part (§1-3 wave data/mechanism, §4-6
  VFX wiring) is independently testable and could ship as separate plan
  tasks/commits even though authored as one spec — the eventual
  implementation plan should still sequence data/mechanism (§1-3) before
  VFX wiring (§4-6), since §6 consumes §3's `pendingEnemySpawns` shape.
- **Ambiguity check**: "materialize fade-in" (§6a) reuses
  `playMaterializeFadeIn()` — confirmed this helper already exists and is
  scene-generic (not legacy-specific) by its current single call site in
  the legacy `reconcileEnemySprites()` path; the plan must verify its
  signature accepts an `EntitySprite` generically (expected, given it's
  already called with a turn-based-shaped `EntitySprite` object structure
  elsewhere in the file) before assuming zero-friction reuse.
