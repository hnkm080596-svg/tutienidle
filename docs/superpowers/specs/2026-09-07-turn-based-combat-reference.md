# Turn-Based Combat — System Reference

**Status:** Authoritative. This document describes how combat works today
(after the P17 runtime-separation rework) and constrains how it may
change. If a future change would make the real system disagree with this
document, **update this document in the same change** — do not let the
two drift apart. This is not an implementation plan; it has no tasks and
nothing left to build. It exists so that "what does combat do" always has
exactly one place to look, instead of being re-derived from reading five
files each time.

## Design Principles (read before changing anything in combat)

1. **Manageable over easy.** When a fix has a quick, local patch and a
   slightly larger, structurally correct fix, take the structurally
   correct one — unless the user explicitly asks for the quick patch. A
   quick patch that adds a fourth special-case `if` to a function is
   "easy" today and unmanageable in three months. This document exists
   because of a session where the opposite happened repeatedly.
2. **One state, one flag, one meaning.** Combat phase is a single
   enum (`TurnBattleState`), never inferred from a combination of other
   fields being null/non-null/truthy. If you find yourself writing
   `if (fieldA && !fieldB && stateVersion > 2)` to answer "what phase are
   we in," that is a sign a new explicit state is missing, not a sign to
   add another condition.
3. **Runtime does timing, logic does decisions, presentation does
   rendering — see AGENTS.md P17.** This document's structure follows
   that split: state machine and gauge (logic), `CombatAnimationRuntime`
   (timing/ack), `CombatScene.ts` (presentation). Every subsection below
   is filed under exactly one of those three.
4. **No mechanic exists here unless it earns its complexity.** This
   combat system deliberately has **no** elemental-weakness/Break system,
   **no** per-turn banked resource (Boost/BP-style), and **no**
   requirement that every Pháp Tu path have an elemental "hệ" to
   participate in combat. Simplicity is a requirement, not a placeholder
   for "not implemented yet." Do not add one of these without the user
   explicitly asking for it as a new, separately-brainstormed feature.
5. **This is not a clone of any commercial game.** Earlier discussion in
   this project referenced ATB (Final Fantasy IV–IX), turn-order preview
   (Final Fantasy X), and gauge/turn-order-preview patterns broadly
   similar to Honkai: Star Rail's Action Value system, purely as
   **public, genre-level design vocabulary** to explain what the gauge
   and turn-order strip do. Nothing in this codebase is derived from, or
   needs to match, any specific commercial game's source or exact numbers.

## 1. Battle Lifecycle (the state machine)

`TurnBattleState = 'intro' | 'countdown' | 'fighting' | 'victory' | 'defeat'`

One field (`TurnBattle.state`), defined in
`game/src/core/battle/turn/TurnBattleSystem.ts`. `GameManager.ts`'s
`updateBattleFixedStep()` is the single driver: every real 0.1s
(`BATTLE_FIXED_STEP_SECONDS`) it advances whichever state the battle is
currently in. `battle.state` is the only thing anything should ever
switch on to answer "what is combat doing right now."

```
intro  ──(introTurnsRemaining hits 0)──▶  countdown
countdown  ──(countdownTurnsRemaining hits 0, spawns place)──▶  fighting
fighting  ──(all enemies dead, no wave left)──▶  victory
fighting  ──(all players dead)──▶  defeat
```

- **`intro`** (Task 4, pending merge as of this writing): a pure
  presentation delay — curtain closes, zone/floor name shown, curtain
  opens. Nothing about damage, targeting, or spawning happens here.
  Ticked down by `introTurnsRemaining`.
- **`countdown`**: the 3-2-1 beat before the fight starts. Enemies and
  players are placed onto their standing slots (`standingSlotPosition()`,
  `STANDING_SLOT_COUNT * STANDING_SLOT_COUNT` = 9 slots per side) here.
  Ticked down by `countdownTurnsRemaining`.
- **`fighting`**: the only state where `tickPacing()` runs (see §2, §3).
  Everything about "who acts, in what order, against whom" lives here
  and only here.
- **`victory` / `defeat`**: terminal. Reward granting and UI transition
  happen off this flag; combat logic itself does nothing further.

**Rule:** no new state is ever inferred by combining `state` with another
field. If a future feature needs a new distinct phase (e.g. a scripted
cutscene mid-battle), it gets a new named value in `TurnBattleState`, not
a second boolean layered on top of `'fighting'`.

## 2. Turn Order (the gauge)

File: `game/src/core/battle/turn/ActionGauge.ts`.

- `GAUGE_MAX = 1000`.
- Every fixed-step tick during `'fighting'`, every living participant's
  `actionGauge` increases by `speed` (`advanceGauge`).
- The first participant whose gauge reaches `GAUGE_MAX` acts. Ties break
  by `priority`. This is the entire turn-order rule — there is no hidden
  second sort key anywhere else.
- After acting, `consumeGaugeAfterAction()` resets the actor's gauge
  (fully, or partially for a follow-up/counter action that doesn't cost a
  full turn).
- **Cadence math**: an actor's real-time seconds-per-turn is
  `GAUGE_MAX / (speed * 10)` (10 = ticks per second at the current fixed
  step). A `speed = 100` actor acts once per real second.

This is the ONLY turn-order mechanism. There is no separate "initiative
roll," no hidden priority queue independent of the gauge, and (per
Design Principle 4) no Boost/BP resource that lets an actor skip ahead of
where their gauge says they are, outside the existing follow-up/counter
queue described in §4.

## 3. The Empty-Arena Rule (no-target guard)

File: `TurnBattleSystem.ts`'s `tickPacing()`, first block inside the
`'fighting'` state (added 2026-09-07, this session).

**The rule, stated once, here, so it is never re-derived:** a turn is
never declared, and no gauge advances toward the next turn, while
`battle.enemies` has zero living members. Concretely:

- If more enemies are still coming (mid spawn-telegraph, or a future
  wave not yet queued): every participant's `actionGauge` resets to `0`
  and the tick does nothing else. Combat is fully paused, not just
  "no one happens to be ready."
- If no more enemies will ever come (`isStageComplete()` true):
  `battle.state = 'victory'` immediately — no further ticks needed.

This was previously a real bug: a turn could be declared against nothing,
producing a visible "attack into an empty cell." The rule above is now
the single, structural fix — not a special case bolted onto targeting.
Any future change to wave/spawn timing must preserve this invariant:
**`tickPacing()` must never let a turn resolve while `battle.enemies` has
zero living members.**

## 4. Wave / Spawn (materialization, not combat logic)

Same file, the block immediately before §3's guard.

- A wave is queued all at once (`shouldStartNextWave()`,
  `WaveSpawnTrigger.ts`) when the arena is fully clear and waves remain.
- Each queued enemy starts as a `PendingEnemySpawn` with a countdown
  (`SPAWN_TELEGRAPH_TICKS`: normal 8 ticks / elite 10 / boss 14 — 0.8s to
  1.4s real time) before it materializes into `battle.enemies`.
- **Standing-slot dedupe** (2026-09-07): enemies spawned within the SAME
  wave-batch claim distinct standing slots via a shared `occupiedSlots`
  set (`EnemySpawnPlacement.ts`). A later wave gets a fresh set — it may
  legitimately reuse a slot an earlier wave's dead enemy vacated. This is
  the only scope of the dedupe; it does not, and should not, prevent
  cross-wave slot reuse.
- The Boss spawn branch (`centerOfRegion()`) is untouched by any of the
  above — bosses always spawn at the region center, never through the
  standing-slot pool.

## 5. Targeting

`selectTarget()` in `TurnBattleSystem.ts`. One rule, no exceptions:
prefer a living opponent in the same row (nearest by column); if none,
the nearest living opponent anywhere (Chebyshev distance). If no living
opponent exists at all, no target is selected — which, per §3, should
never actually be reachable from `tickPacing()`'s normal flow anymore.

## 6. Action Resolution (declare → apply → complete)

Three explicit steps, always in this order, every time an actor acts
(`resolveActorTurn()` runs all three back-to-back in the headless/test
path; the presentation path in §7 spreads them across real time):

1. **Declare** (`declareActorAction`) — pick the skill, pick the
   target(s), compute (but do not yet apply) damage. Pure decision, no
   side effects on HP.
2. **Apply** (`applyActionImpact`) — call into the damage engine
   (`CombatSystem.resolveActionHit`, a separate system per P17) to
   actually apply the computed damage/effects.
3. **Complete** (`completeAction`) — consume the actor's gauge, log the
   turn, check follow-up/counter triggers.

Damage math itself lives entirely in `CombatSystem`/`ActionImpactSystem`
— `TurnBattleSystem` calls into it but never computes damage inline.
This boundary is load-bearing: it is what makes "no Break system" (§
Design Principle 4) a one-line true statement instead of something
scattered across multiple files to verify.

## 7. Presentation Timing (`CombatAnimationRuntime`)

File: `game/src/core/battle/turn/CombatAnimationRuntime.ts` (extracted
from `GameManager.ts`, 2026-09-07, per AGENTS.md P17).

This class's only job is sequencing the three steps in §6 across real
frames instead of resolving them all in the same tick, so the player can
actually watch what happens. It owns a single per-actor animation state:

```
idle → ready → cast → standby → idle
```

- **`idle`**: nothing pending for this actor.
- **`ready`**: `tickPacing()` picked this actor as next; waiting for
  Phaser's "ready" flourish (`CombatScene.onTurnReady`) to finish, then
  Phaser acks via `acknowledgeTurnReady()` → §6 step 1 runs.
- **`cast`**: §6 step 1 done, target(s) known; waiting for Phaser's
  attack lunge animation, then Phaser acks via
  `acknowledgeActionImpact()` at the lunge's midpoint → §6 step 2 runs.
- **`standby`**: §6 step 2 done, damage applied; waiting for Phaser's
  impact VFX to finish, then Phaser acks via `acknowledgeActionComplete()`
  → §6 step 3 runs, actor returns to `idle`.

**Manual mode**: `battleManualMode`/`awaitedManualActor` on this class
pause exactly at the `ready → cast` transition for a player-controlled
actor, waiting for `submitTurnChoice()` instead of auto-selecting. As of
this writing, no UI calls `submitTurnChoice()` — manual mode is fully
implemented in the engine but has no player-facing entry point. Auto
mode (the AI always selects and acts) is the only reachable path in the
shipped game today.

**What this class must never do** (P17): decide targeting, decide
damage, decide whether a wave should spawn, decide victory/defeat. If a
future change to this file starts reading `battle.enemies` to make a
combat decision rather than to pick an animation, that change belongs in
`TurnBattleSystem.ts` instead.

## 8. What Combat Does NOT Have (intentional, not a gap)

Restating Design Principle 4 with the specific things ruled out, so a
future session doesn't reintroduce them "to be thorough":

- No elemental weakness/resistance triggering a stagger or "Break" state.
- No toughness/poise bar on enemies.
- No per-turn banked resource (Boost Points or similar) that lets an
  actor bank extra actions.
- No requirement that every Pháp Tu path have an elemental "hệ" — combat
  must work identically for a path that has one and a path that doesn't.
- No manual-mode UI (tracked as a possible future feature, not missing
  by accident).

If any of the above is wanted later, it is a new brainstorming
conversation with its own design doc — not a drive-by addition to this
system.
