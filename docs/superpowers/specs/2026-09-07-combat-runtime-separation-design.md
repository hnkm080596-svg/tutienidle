# Combat Runtime/Presentation/Logic Separation + Gameplay Fixes — Design

## Context

Playtesting the just-merged Standing Slot rework surfaced 3 symptoms:

1. Enemies spawn overlapping the same standing slot.
2. Combat resolves too fast to observe who attacks whom.
3. A unit visibly attacks the top-left battlefield cell before any enemy
   has spawned.

A code survey (this session) found the turn-based combat engine already
has an ack-driven presentation layer (`GameManager`'s `pendingReadyActor`/
`pendingDeclaredAction`/`pendingImpact`/`playbackToken`/`presentationActive`
fields, `PresentationGate`, and Phaser's `acknowledgeTurnReady()`/
`acknowledgeActionImpact()`/`acknowledgeActionComplete()` call chain) — this
is NOT two parallel clocks fighting each other. But:

- That machinery lives as loose private fields directly on `GameManager`
  (already a very large class), mixed with tick-pacing and legacy-state-sync
  code, instead of being an isolated, named component. This violates the
  project's standing convention that systems own one responsibility and
  don't cross-talk directly — formalized this session as **P17** in
  `AGENTS.md`.
- `acknowledgeActionImpact()` (`GameManager.ts:2674`) computes the VFX
  anchor cell as `row = anchorEntity?.row ?? 0`, `column =
  Math.round(anchorEntity?.x ?? 0)` — when a turn is declared with **no
  living enemy** (a real window exists: a wave is queued the same tick
  `'fighting'` starts, but takes `SPAWN_TELEGRAPH_TICKS` (8-14 ticks =
  0.8-1.4s) to materialize into `battle.enemies`), `anchorEntity` is
  `undefined` and the fallback anchor is literally `(row 0, column 0)` —
  the top-left cell. This is symptom 3's confirmed root cause.
- `ATTACK_LUNGE_DURATION_MS = 75` and the ready-pulse tween `duration: 90`
  (`CombatScene.ts:132`, `:2271`) make one full ready→cast→impact→complete
  cycle take on the order of ~150-300ms real time. With no manual-mode UI
  wired up yet (confirmed: auto mode only, both sides act continuously),
  successive turns chain with no breathing room — this is symptom 2's
  cause.
- Enemy spawn placement (`EnemySpawnPlacement.ts`) has always allowed
  multiple enemies to land on the same standing slot (pre-existing,
  documented intentional design) — the Standing Slot rework's 36→9 slot
  pool made this collide constantly instead of rarely. This is symptom 1.

## Goals

- Extract the presentation-ack machinery out of `GameManager` into a
  dedicated `CombatAnimationRuntime` component, per P17: a runtime's only
  job is timing (advance the gauge tick, hold/select the current
  per-actor animation state, signal Phaser) — never business/gating logic.
- Fix symptom 3 at the root: a turn is never declared/animated when there
  is no living enemy to target. When the arena is empty, the engine
  explicitly pauses (resets gauges) instead of falling into an anchor
  fallback.
- Fix symptom 2: tune animation timings to an observable pace.
- Fix symptom 1: de-duplicate enemy spawn slots within a single wave.
- Add the missing pre-countdown "intro" phase (screen transition + zone/
  floor name reveal) the user described, reusing the existing
  `PresentationGate`/`setPresentationActive` mechanism and the
  `CombatCountdownOverlay.vue` pattern.

## Non-Goals

- No change to damage/effect math (`CombatSystem.resolveActionHit`,
  `ActionImpactSystem`) — already a cleanly separate system per P17, out
  of scope.
- No change to targeting rules (`selectTarget()`), buff/reaction systems,
  or the wave-batch spawn algorithm's overall shape — only the
  within-wave slot-collision behavior.
- No manual-mode UI (skill picker) — confirmed not yet built; auto mode
  is the only path today and stays that way after this plan.
- No Trận Pháp (formation) UI rework — that is a separate, later
  brainstorming topic per the user's own "one system, one plan" habit.

## Component 1: `CombatAnimationRuntime`

**New file:** `game/src/core/battle/turn/CombatAnimationRuntime.ts`

Owns exactly the presentation-ack state and per-actor animation state.
Moves (verbatim behavior, new home) these fields and methods off
`GameManager`:

- Fields: `presentationGate` (`PresentationGate` instance), `pendingReadyActor`,
  `pendingDeclaredAction`, `pendingImpact`, `playbackToken`,
  `presentationActive`, `battleManualMode`, `awaitedManualActor`.
- Methods (same signatures, same behavior — pure relocation): `expectPresentationLayer()`,
  `isAwaitingPresentationLayer()`, `setPresentationActive(active)`,
  `isActionPlaybackWaiting()`, `acknowledgeTurnReady(token?)`,
  `acknowledgeActionImpact(token?)`, `acknowledgeActionComplete(token?)`,
  `setBattleManualMode(enabled)`, `isBattleManualMode()`,
  `isAwaitingManualTurnChoice()`, `submitTurnChoice(role)`,
  `getPendingPlaybackToken()`.

**New capability** (the reason this is a runtime, not just a relocated
grab-bag): a read method that derives the current per-actor animation
state so `CombatScene` stops deciding for itself when to call
`playCombatAnimation()`:

```ts
import type { CombatAnimationName } from '../../../game/support/CombatAnimationSet'

getAnimationState(actorId: string): CombatAnimationName {
  if (this.pendingReadyActor?.id === actorId) return 'ready'
  if (this.pendingDeclaredAction?.actor.id === actorId) return 'cast'
  if (this.pendingImpact?.actor.id === actorId) return 'standby'
  return 'idle'
}
```

`CombatAnimationRuntime` takes `turnBattleSystem: TurnBattleSystem` and
`turnBattle: () => TurnBattle | null` (a getter, since `GameManager`
reassigns `this.turnBattle` on new battles/restarts) via constructor
injection — it calls into `TurnBattleSystem` (declare/apply/complete) the
same way `GameManager` does today, but never computes gauge readiness,
targeting, or damage itself. `GameManager` becomes a thin forwarder:
each of the methods above becomes `return
this.combatAnimationRuntime.methodName(...)` — **no call-site signature
changes**, so `CombatScene.ts` and every existing test
(`GameManager.actionPlayback.test.ts`,
`GameManager.presentationGate.test.ts`,
`GameManager.stageRestart.test.ts`) keep calling
`gameManager.acknowledgeTurnReady()` etc. exactly as before.

`GameManager.updateBattleFixedStep()` keeps calling `tickPacing()`
directly (gauge advancement is a `TurnBattleSystem` decision, per P17 —
the runtime only reacts to its result), but the `pendingReadyActor`
branch inside the `'fighting'` block moves onto the runtime instance.

## Component 2: No-Target Guard (empty-arena pause)

**Modify:** `game/src/core/battle/turn/TurnBattleSystem.ts`'s `tickPacing()`
(currently at line 344).

Add a guard immediately after the wave/telegraph block (after line 395,
before the follow-up-queue check at line 399) — this executes every tick
`'fighting'` is active, before any gauge advancement or readiness check:

```ts
const livingEnemyCount = battle.enemies.filter((enemy) => enemy.entity.alive).length

if (livingEnemyCount === 0) {
  const pendingCount = battle.wave?.pendingEnemySpawns.length ?? 0
  const waveIndex = battle.wave?.waveIndex ?? 0
  const waveCount = battle.wave?.waves.length ?? 0
  const spawnedCount = battle.wave?.spawnedCount ?? 0
  const totalEnemyCount = battle.wave?.totalEnemyCount ?? 0

  const moreComing = pendingCount > 0 || waveIndex < waveCount

  if (moreComing) {
    // Enemies are telegraphing or a future wave remains — freeze the
    // clock. No readyActor detection, no declare, no animation: nothing
    // to fight yet. Reset (not just hold) every participant's gauge, per
    // spec — a turn that would resolve into an empty arena never happens.
    for (const participant of [...battle.players, ...battle.enemies]) {
      participant.actionGauge = 0
    }

    return null
  }

  if (isStageComplete(spawnedCount, totalEnemyCount, livingEnemyCount, pendingCount)) {
    battle.state = 'victory'
    return null
  }
}
```

`isStageComplete` is already imported (`WaveSpawnTrigger.ts:26`, used
elsewhere in this file) — reused as-is, no new function. This guard makes
the anchor-fallback bug structurally unreachable: `declareActorAction()`
is never called while `battle.enemies` has zero living members, so
`applyActionImpact()`'s `anchorEntity` is never `undefined` for this
reason again.

**Test to add:** `TurnBattleSystem.test.ts` — a fixture with `players`
non-empty, `enemies: []`, and a `wave` with `pendingEnemySpawns` non-empty
(mid-telegraph) asserts `tickPacing()` returns `null` and every
participant's `actionGauge` is `0` after the call, even if a player's
gauge was pre-set near `GAUGE_MAX`.

## Component 3: Enemy Spawn Slot Dedupe (within one wave)

**Modify:** `game/src/core/battle/EnemySpawnPlacement.ts` — the random
standing-slot branch (introduced in the Standing Slot plan, calls
`standingSlotPosition(region, slotRow, slotColumn)` with `slotRow`/
`slotColumn` in `[0, STANDING_SLOT_COUNT - 1]`).

The resolver is called once per enemy inside `tickPacing()`'s wave-queue
loop (`TurnBattleSystem.ts:385-391`, `for (let index = 0; index < waveSize;
index++) { const participant = this.spawnEnemy() ... }`). Today
`spawnEnemy()` has no visibility into slots already claimed earlier in the
same loop iteration. Fix: thread an `occupiedSlots: Set<string>` (key
`` `${slotRow}-${slotColumn}` ``) through the wave-spawn loop, built up as
each enemy is placed, and have the random branch draw only from the
remaining `STANDING_SLOT_COUNT * STANDING_SLOT_COUNT - occupiedSlots.size`
free slots (uniform random among free slots, not reject-and-retry, to
keep it O(1) and deterministic under test). When `waveSize >
STANDING_SLOT_COUNT * STANDING_SLOT_COUNT` (9), remaining enemies past
the 9th reuse slots (unavoidable — there are only 9 standing positions
per side; still an improvement, since it now takes 10+ enemies in one
wave to collide instead of colliding almost immediately).

This only changes collision behavior **within one wave's spawn batch**.
Enemies from a later wave may still reuse a slot vacated by a dead
enemy from an earlier wave — that's correct, not a bug.

## Component 4: Intro/Transition Phase

**Modify:** `TurnBattleState` (`TurnBattleSystem.ts:85`) — add `'intro'`
as the new first state: `'intro' | 'countdown' | 'fighting' | 'victory' |
'defeat'`.

**New:** `game/src/components/game/combat/CombatIntroOverlay.vue` —
modeled directly on `CombatCountdownOverlay.vue`'s pattern (reads
`gameManager.getBattle()?.state`, `useStateVersion()` for reactivity):

- Visible when `state === 'intro'`.
- Two curtain panels (CSS `transform: translateX`, matching the existing
  `--gold-300`/`--font-display` token usage) slide closed from left/right
  edges to fully cover the canvas.
- Shows zone name + stage/floor number (read from the same `Stage` data
  `GameManager` already exposes for `CombatTopBar.vue` — reuse that
  accessor, do not add a second source of truth for zone/stage text).
- Once `PresentationGate`/`setPresentationActive(true)` confirms
  `CombatScene`'s background has rendered (already-existing signal, no
  new plumbing needed) AND a minimum readable display duration has
  elapsed, curtains slide back open and `battle.state` advances to
  `'countdown'`.

**Modify:** `GameManager.updateBattleFixedStep()` — add an `'intro'`
branch before the existing `'countdown'`/`'fighting'` branches, ticking
a new `introTurnsRemaining` counter on `TurnBattle` (same tick-counting
pattern as `countdownTurnsRemaining`) down to 0, then setting
`battle.state = 'countdown'`.

**Modify:** wherever `TurnBattle` is constructed for a new battle
(`startStage()`/`restartTurnBattleCycle()` in `GameManager.ts`) — start
at `state: 'intro'` instead of `'countdown'`, with `introTurnsRemaining`
set to a fixed duration (e.g. 20 ticks = 2s, tunable).

Enemy/player spawning stays exactly where it is today (at
`'countdown'`→`'fighting'` transition, via the existing
`reconcileTurnCountdownSpawn` path) — the intro phase adds a pure
presentation delay before countdown, it does not touch spawn timing or
positions.

## Component 5: Animation Timing Tuning

**Modify:** `game/src/game/scenes/CombatScene.ts` — increase:

- `ATTACK_LUNGE_DURATION_MS`: `75` → `350`.
- Ready-pulse tween `duration: 90` (line 2271) → `250`.

These are the only two knobs gating how fast a full turn cycle can
resolve in auto mode (no manual-mode pause exists yet, confirmed by the
user). Values are a starting point for playtesting, not derived from a
formula — call this out in the plan's completion note if the user wants
further tuning after trying it.

## P17 Cross-Reference

This design is the concrete application of `AGENTS.md` P17 (added this
session): `CombatAnimationRuntime` is the runtime (timing only),
`TurnBattleSystem` stays the business-logic system (gauge-advance
decisions, targeting, wave triggers, victory conditions), `CombatSystem`/
`ActionImpactSystem` stay the damage engine, and `CombatScene.ts`
(Phaser) stays presentation (plays whatever animation state the runtime
reports, acks back on completion). No component reaches into another's
private state — coordination is exclusively through the existing
ack-call/event-emit interfaces.

## Testing Strategy

- `CombatAnimationRuntime` gets its own test file
  (`CombatAnimationRuntime.test.ts`), porting the relevant existing cases
  from `GameManager.actionPlayback.test.ts`/
  `GameManager.presentationGate.test.ts` to construct the runtime
  directly (no `GameManager` needed) — proves the extraction preserved
  behavior in isolation.
- `GameManager.actionPlayback.test.ts`/`GameManager.presentationGate.test.ts`/
  `GameManager.stageRestart.test.ts` keep running unmodified against
  `GameManager`'s public methods (now thin forwarders) — proves the
  relocation didn't change the public contract.
- `TurnBattleSystem.test.ts` gets the no-target-guard case described in
  Component 2.
- `EnemySpawnPlacement.test.ts` (existing or new) gets a case asserting
  N enemies spawned in one wave-loop call claim N distinct slots when
  N ≤ 9.
- P14 (Playwright real-browser check): after implementing, run a real
  stage battle and confirm — no attack animation plays before the first
  enemy sprite is visible; a full wave of 3+ enemies shows 3+ visually
  distinct standing positions; a single turn's ready→impact cycle is
  visible at normal playback speed (qualitative, human judgment, not an
  assertion).
