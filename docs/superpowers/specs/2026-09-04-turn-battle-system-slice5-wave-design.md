# Turn Battle System — Slice 5: Wave / Stage — Design Spec

Date: 2026-09-04
Status: Approved (design), plan not yet written

## 1. Motivation

Slice 1 gives `TurnBattle` a fixed enemy list (`enemies: TurnBattleParticipant[]`)
set once at battle start — no concept of a multi-enemy stage where
enemies spawn in waves as the arena empties. `WaveSpawnTrigger.ts`
(Foundation, Milestone 1, already merged/tested) provides the pure
spawn/complete decision (`shouldSpawnNextEnemy`/`isStageComplete`),
dropping the live `spawnCountdown`/`spawnIntervalSeconds` real-seconds
throttle entirely (turn-based combat has no "too fast" to guard
against — spawn the instant the arena is empty). This slice wires that
decision into `TurnBattleSystem`.

Live `StageWaveSystem.pickEnemyForSpawn(stage, isFinalSpawn)` — the
real "which enemy spawns next" logic (enemy pool roll, elite chance,
hidden-beast trà-trộn, boss-on-floor-10 override) — needs
`enemyTemplates`/`stageSystem`/`hiddenBeast`, real game registries.
This was already flagged out of scope by `WaveSpawnTrigger`'s own
design spec ("khi cutover thật có thể tái dùng as-is, không cần Turn*
twin") and stays out of scope here too (§5).

## 2. Scope

**In scope:**
- `TurnBattle` gains an optional wave state:
  ```typescript
  interface TurnWaveState {
    totalEnemyCount: number
    spawnedCount: number
  }
  ```
  `TurnBattle.wave?: TurnWaveState`.
- `TurnBattleSystem`'s constructor gains an optional 5th parameter:
  `spawnEnemy?: () => TurnBattleParticipant` — a caller-supplied
  factory. Tests supply a fixture factory (a closure building a plain
  `TurnBattleParticipant`); no real `Enemy`/`Stage` content is read.
- In `resolveNextStep()`, when `battle.wave` is set and the enemy side
  is empty (`aliveCount === 0`) and `shouldSpawnNextEnemy(wave.spawnedCount,
  wave.totalEnemyCount, aliveCount)` is true and `spawnEnemy` was
  provided: call `spawnEnemy()`, push the result into `battle.enemies`,
  increment `wave.spawnedCount`.
- **Win condition changes when `battle.wave` is present**: instead of
  "every current enemy is dead," victory requires
  `isStageComplete(wave.spawnedCount, wave.totalEnemyCount, aliveCount)`
  — every enemy in the stage has spawned AND the arena is currently
  empty. When `battle.wave` is absent, the win condition is **unchanged**
  from Slices 1-4 ("every enemy in `battle.enemies` is dead") — this
  keeps every existing test (none of which set `wave`) passing without
  modification.
- Spawn check timing: checked once per `resolveNextStep()` call, before
  the win/defeat check at the end (so a freshly spawned enemy is
  correctly alive for the NEXT step's targeting, and `isStageComplete()`
  correctly sees the post-spawn `aliveCount` when deciding victory this
  step).

**Explicitly out of scope (deferred, tracked in roadmap):**
- Real content: `pickEnemyForSpawn()`'s enemy-pool roll, elite chance,
  hidden-beast substitution, and boss-on-final-spawn override — not
  ported, not migrated. `spawnEnemy` in this slice is a test fixture
  closure only.
- Boss-priority spawn ordering — already noted in the original
  `WaveSpawnTrigger` design spec as pure/time-agnostic in the live file,
  reusable as-is at real cutover time, not touched here.
- Any change to `StageWaveSystem.ts`, `StageManager.ts`, `Stage.ts`, or
  `GameManager.ts`.

## 3. What This Slice Proves

A `TurnBattle` configured with a `wave` and a `spawnEnemy` factory
correctly spawns additional enemies the instant the arena empties, and
correctly delays victory until every wave enemy has both spawned and
died — matching live `StageWaveSystem`'s spawn/victory semantics minus
the real-seconds throttle (already removed by `WaveSpawnTrigger.ts`)
and minus real enemy-selection content (§2).

## 4. Roadmap Note (to be copied into the roadmap doc)

- **Wave/Stage content migration**: wiring `pickEnemyForSpawn()`'s real
  enemy-pool/elite/hidden-beast/boss logic as the real `spawnEnemy`
  factory for `TurnBattleSystem` — deferred, separate content/wiring
  work for the real cutover (Slice 6).
