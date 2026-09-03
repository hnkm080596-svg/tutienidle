# WaveSpawnTrigger — Design Spec

Date: 2026-09-04
Status: Approved (design), not yet planned/implemented

## 1. Motivation

`StageWaveSystem.ts` (`game/src/core/game/StageWaveSystem.ts`) is called
by `GameManager.ts` (4 call sites) inside the live real-time tick loop —
same live-coupling situation already found for `BuffSystem.ts` and
`HazardZoneSystem.ts`: it must not be edited in place. Its `update()`
paces individual-enemy spawns within a stage via
`active.spawnCountdown -= deltaSeconds` (a real-seconds throttle used
only while the arena still has a living/pending enemy) with an
already-time-agnostic fallback: "if the arena is completely empty
(`aliveCount === 0`), spawn the next enemy immediately regardless of the
countdown."

## 2. Decision (locked via brainstorming, 2026-09-04)

**Drop the countdown/throttle entirely.** In turn-based combat there is
no real-time "too fast" to guard against — every entity is already
paced by its own ATB turn, so an artificial real-seconds gap between
spawns serves no purpose. The turn-based rule becomes unconditional:
spawn the next enemy in the stage the instant the arena is empty
(`aliveCount === 0` and `spawnedCount < totalEnemyCount`); otherwise
wait. A newly spawned enemy's `ActionGauge` initializes to `0`, exactly
like any other `TurnQueueActor` (`ActionGauge.ts`, Foundation
Milestone 1) — no special re-timing logic needed.

This eliminates `spawnCountdown`/`stage.spawnIntervalSeconds` from the
turn-based path entirely — they are not renamed to a turn-unit
equivalent, they are removed as a concept.

## 3. Scope

**In scope:**
- New pure function file `game/src/core/battle/turn/WaveSpawnTrigger.ts`
  — mirrors the existing `BossTurnTriggers.ts` pattern (a tiny,
  side-effect-free decision function, not a class): given the current
  wave-spawn counters, decide whether the next enemy should spawn now.
- `shouldSpawnNextEnemy(spawnedCount: number, totalEnemyCount: number, aliveCount: number): boolean`
  — `true` iff `spawnedCount < totalEnemyCount && aliveCount === 0`.
- `isStageComplete(spawnedCount: number, totalEnemyCount: number, aliveCount: number): boolean`
  — `true` iff `spawnedCount >= totalEnemyCount && aliveCount === 0`
  (mirrors `StageWaveSystem.update()`'s existing victory-check
  condition, ported as a pure predicate).
- Unit tests only.

**Explicitly out of scope:**
- Any change to `StageWaveSystem.ts` or `GameManager.ts` — untouched,
  continues driving live real-time combat.
- Boss-priority enemy selection (`pickEnemyForSpawn`'s "last enemy in a
  1-total stage must be the boss" rule) — this logic is already pure
  and time-agnostic in the live file; when the real cutover happens it
  can be reused as-is, no turn-based twin needed for it.
- `resolveBossSummons()` (mid-battle boss summon spawning, driven by
  `TribulationPhase.summonEnemyIds`) — unrelated to the countdown being
  removed here; it already spawns immediately with no timer.
- Wiring this into any real turn-based battle loop (`TurnBattleSystem`
  Slice 1 has no wave concept today — single fixed enemy list only).

## 4. Testing

Vitest unit tests for both functions:
- `shouldSpawnNextEnemy`: true when arena empty and enemies remain;
  false when arena has a living enemy; false when the stage's enemy
  count is already exhausted (even if arena is empty — that's
  "complete," not "spawn more").
- `isStageComplete`: true only when both the count is exhausted AND the
  arena is empty; false while any enemy remains alive or pending.

## 5. What This Does Not Prove

Not validated here: real wave/stage content wiring, boss-summon
interaction, any UI/telegraph presentation of a spawning enemy. This is
the smallest possible standalone piece — a pure decision function ready
for the eventual `StageWaveSystem` replacement to consume.
