# TurnBattleSystem — Slice 1: Core Turn Loop — Design Spec

Date: 2026-09-04
Status: Approved (design), not yet planned/implemented

## 1. Motivation & Scope Decomposition

`BattleSystem.ts` (the real-time combat engine being replaced) is ~2400
lines across an 18-step `update(deltaSeconds)` pipeline (spawn telegraph,
wave spawning, hazard zones, momentum, cast bars, enrage, regen...). The
user decided this is too large to spec/plan/implement as one unit —
instead it's decomposed into vertical slices, each layering one more piece
of real behavior on top of a proven core, each with its own
spec → plan → implementation cycle.

**Slice 1** is the first and smallest: prove the ATB turn loop +
targeting + damage resolution pipeline (built in
[Milestone 1 — Foundation](../../game/docs/turn-based-combat-roadmap.md))
actually works end-to-end, headless, with zero risk to the live
real-time game. Everything else — skill loadout, AOE shapes, buffs,
Reaction Engine, hazard zones, Momentum/Break, boss mechanics, wave
spawning — is explicitly deferred to later slices.

## 2. Scope

**In scope:**
- A new, fully independent class that runs a turn-based fight between one
  player `CombatEntity` and a fixed list of enemy `CombatEntity` objects.
- Turn order via `TurnQueue.resolveNextTurn` (Foundation, `ActionGauge`-based).
- One action per turn: a single-target "basic attack" resolved through
  `CombatSystem.resolveActionHit` (existing, reused as-is — confirmed by
  survey to already be fully event/instant-resolution, no real-time
  dependency).
- Targeting per design spec §4 (nearest-entity-directly-ahead-in-row,
  else nearest-overall by Chebyshev distance), using the existing
  `getChebyshevDistance` grid math (`BattleGrid.ts`) — no AOE shapes.
- Win/loss detection (all enemies dead → victory; player dead → defeat).
- Unit tests only — no UI, no `GameManager` wiring.

**Explicitly out of scope for Slice 1** (each is a later slice, own plan):
- Skill loadout, AOE shapes, Bounce, TrueShot, cast/`chargeSteps` channeling.
- Buffs, Reaction Engine, Momentum/Break, boss Phase/Enrage/Summon.
- Hazard zones (Lava/Sword Zone).
- Wave spawning / `StageWaveSystem` conversion.
- The Stat System `speed` conversion — Slice 1 does **not** read
  `entity.stats.speed` (that stat doesn't exist yet, per the still-open
  dexterity/intelligence derivation question). Speed is supplied
  per-participant as a plain constructor argument, decoupling this slice
  from that unresolved decision entirely.
- `GameManager`/UI wiring — this remains headless until a later
  cutover slice.

## 3. Architecture

**New files only** (no existing file touched):
- `game/src/core/battle/turn/TurnBattleSystem.ts` — the class.
- `game/src/core/battle/turn/TurnBattleSystem.test.ts` — its tests.

**Data model** — a new, minimal type, not a reuse of the real-time
`Battle`/`BattleEnemy` shape (which is full of `attackTimer`,
`castTimer`, `elapsedSeconds`, `remainingSeconds` pairs that don't apply
here):

```typescript
export type TurnBattleState = 'fighting' | 'victory' | 'defeat'

export interface TurnBattleParticipant {
  entity: CombatEntity
  speed: number
  priority: number
}

export interface TurnBattle {
  player: TurnBattleParticipant
  enemies: TurnBattleParticipant[]
  state: TurnBattleState
}
```

`speed`/`priority` live on the wrapper, not on `CombatEntity` itself —
this is deliberate: it keeps Slice 1 fully decoupled from the
still-undecided Stat System `speed` conversion (Section 2). Priority
follows spec §3's tie-break order (player = 0, enemies by array index
starting at 1).

**Core loop** (`TurnBattleSystem.runToCompletion(battle: TurnBattle): TurnBattleState`):
1. Build the `TurnQueueActor[]` list from living participants (`entity.alive`).
2. Call `resolveNextTurn` (Foundation `TurnQueue.ts`) to get the next actor.
3. If `null` (nobody can act — defensive-only case, e.g. all speeds ≤ 0
   forever), treat as a stalemate — return `'defeat'` (fails safe, never
   hangs).
4. Resolve that actor's target: same-side vs. opposite-side, using the
   Section 4 targeting rule (nearest-ahead-in-row, else nearest-overall).
   If no valid target exists (shouldn't happen while both sides have
   living members, but defensively handled), skip the turn.
5. Call `CombatSystem.resolveActionHit(source, target, { kind: 'physical', multiplier: 1 })`.
6. `consumeGaugeAfterAction` (Foundation `ActionGauge.ts`) resets the
   acting entity's gauge.
7. Check win/loss: no living enemies → `'victory'`; player not alive →
   `'defeat'`. Otherwise loop to step 2.
8. Hard iteration cap (matching `TurnQueue`'s own internal `MAX_STEPS`
   safety pattern) to guarantee termination even under pathological test
   inputs (e.g. both sides at 1 HP with 0 damage) — returns `'defeat'` if
   exceeded, never hangs a test run.

**Targeting helper** — a small new pure function local to this file (not
a new shared module; too small to warrant one, and it's superseded by the
real AOE Shape extension in a later slice anyway):

```typescript
function selectTarget(
  actor: TurnBattleParticipant,
  opposingSide: TurnBattleParticipant[],
): TurnBattleParticipant | undefined
```

## 4. Testing

Standard Vitest unit tests, no mocking of `CombatSystem`/`CombatEntity` —
use real instances, matching the existing test-fixture convention already
established across 69+ test files that construct `CombatEntity` directly
(e.g. `ActionTargetingSystem.test.ts`). Cases to cover:
- Higher-speed participant acts first (ATB ordering, exercised through
  the real `TurnQueue`, not re-tested in isolation here).
- A landed hit reduces `target.currentHp` and, on lethal damage, the
  loop terminates with the correct `state`.
- Multiple enemies: player picks the nearest-ahead target; once it dies,
  targeting moves to the next nearest.
- `victory` when all enemies reach 0 HP; `defeat` when the player does.
- The iteration cap fires (returns `'defeat'`, doesn't hang) under a
  constructed 0-damage stalemate.

## 5. What This Slice Does Not Prove

Explicitly not validated here (left to later slices): skill variety,
AOE/multi-target resolution, Reaction Engine triggers, any resource
economy, any real UI/animation pacing, or the "Auto" AI action-policy
(spec §9 — still an open design item). Slice 1's only job is: does the
ATB gauge + targeting + damage kernel actually resolve a fight correctly
when driven turn-by-turn instead of tick-by-tick.
