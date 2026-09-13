# Combat Real-Time / Turn Authority — Design

Date: 2026-09-10
Status: In force, **partially superseded**
Builds on `2026-09-09-game-presentation-coordinator-design.md` (route/readiness
authority), which this document assumes is in effect.

> **Superseded on turn mechanism by
> `2026-09-10-combat-turn-mechanism-design.md`.** That document owns turn order,
> turn-end, the resolution pipeline, manual mode and the external-command
> boundary, and it wins wherever the two disagree.
>
> Concretely, the following items in *this* document are **dead** and have been
> rewritten below to point at the new spec: A6, A6a, the `OffScreenReason`
> union in §6, the §7 turn diagram, AC-5, AC-7b and AC-7c. The turn engine now
> holds a single `TurnToken` whose non-`IDLE` states freeze the clock through a
> `'turn-in-flight'` reason — the opposite of what this document said before.
>
> Everything else here remains in force: the two-clock separation, no catch-up,
> the off-screen pause, the closed-curtain work window, `presentationActive`
> ownership, the cooldown authority, and the §5 classification.

---

## 1. Why this document exists

Four symptoms were reported against the merged presentation-coordinator build:

1. Scene transitions — including combat retry — show the new scene before the
   curtain finishes closing.
2. The party spawn telegraph moves in three visible beats instead of a smooth
   three-second count.
3. Units appear to attack simultaneously.
4. Real-time commands interleaved with turn logic are a standing corruption
   risk, with no written rule for what is real-time and what is turn-bound.

Investigation found **five distinct verified defects**, not four symptoms. (4)
is the missing law that lets defects of this class keep appearing. This document
fixes the law first, then binds each defect to it.

The law, in three sentences:

> **Combat owns a clock that counts for itself.** It never receives time from
> the world and never gives time back; time that did not elapse on screen did
> not elapse at all.
>
> **That clock drives exactly two things: the gauge and the picture.** Both are
> the same kind of thing — the visible passage of time.
>
> **A turn is not time.** It is mechanism, detected when the gauge crosses.

---

## 2. Verified root causes

Each was confirmed by reading the merged code, not inferred.

### RC-1 — The domain command runs before the curtain closes

`createGamePresentation.runAdmitted()` decides admission, then executes the
domain command, and only afterwards asks the coordinator to run the transition.
The coordinator's own sequence closes the curtain at step 2
(`GamePresentationCoordinator.executeTransition`).

For `home → combat` this is invisible: `CombatScene` is not mounted yet, so the
command has nothing to show. But `ALLOWED_EDGES.combat` includes `'combat'`, so
**refight / retry is a `combat → combat` transition against a renderer that is
already live**. `startStage()` resets the battle, respawns the wave and starts
the countdown while the curtain is still open.

*Class:* work with visible effect performed outside the closed-curtain window.

### RC-2 — Curtain reopen can silently skip its animation

`PresentationTransitionOverlay.animateCurtain()` resolves on `transitionend`.
If the panels already sit at the open transform — the overlay remounted, or a
close aborted — setting `is-opening` changes no property, **no `transitionend`
ever fires**, and the promise resolves only via the 600 ms safety timeout with
nothing animated. Reads as "closes slowly, snaps open". Both directions are
already `0.4s ease-in-out`, so this is a state defect, not a duration defect.

### RC-3 — `setPresentationActive()` has no caller

`CombatAnimationRuntime.setPresentationActive()` is reachable through
`GameManager.setPresentationActive()`, and `CombatScene` declares it in its
registry bridge type — **and nothing in production ever calls it.** Therefore:

```
isPresentationActive() === false, permanently
  -> tickPacing(battle, resolveImmediately = true)
  -> no acknowledgement gate
  -> every ready actor resolves inside the same synchronous burst
```

This is why units appear to act at once. The three-step handshake
(`acknowledgeTurnReady` → `acknowledgeActionImpact` → `acknowledgeActionComplete`,
with stale-token rejection) is fully built and entirely dormant.

`setPresentationMode('interactive')` is a **different** authority: `mode` governs
the session hold, `presentationActive` governs acknowledgement-gated playback.
The second has no owner. This defect predates the coordinator merge — the
pre-merge `App.vue` comment described the wiring as if it existed.

*Class:* wired callee, silent caller (AGENTS.md P13). Same class as the retired
`PresentationGate`.

### RC-4 — Combat is driven by the world's 1 Hz interval

`useAppLifecycle.TICK_INTERVAL_MS = 1_000` drives `App.vue`'s `tick()`, which
calls `gameManager.update(~1.0s)`. `updateBattleFixedStep` then splits that into
**ten 0.1 s steps inside a single JS frame**, emitting
`turn_battle_entity_snapshot` on each.

Phaser renders at 60 fps but receives fresh data once per second, in a burst of
ten. `COUNTDOWN_TOTAL_TICKS = 30` is a three-second count delivered in **three
bursts** — the reported three beats, exactly.

The defect is not that 1000 ms is too coarse. The defect is that **combat is
driven by the world's clock at all.**

### RC-5 — Two cooldown authorities

`TurnSkillAction` counts cooldowns in **turns** (`cooldownTurns`,
`remainingCooldownTurns`, decremented at the holder's own turn) and gives the
basic slot no cooldown by construction.

`GameManager.update()` nonetheless calls `skillSystem.update(deltaSeconds, 0)`
**unconditionally every tick** — the legacy **seconds-based** cooldown clock,
under a comment that already calls its engine doomed.

*Class:* old authority left running in parallel after consumers migrated
(AstraDoctrine §8, AGENTS.md A12).

---

## 3. Axioms

Decisions, not derivations. Everything below follows from them.

- **A1 — Turn order is absolute.** Units act one at a time. Two units never
  resolve actions in the same rendered frame. Structural, never an outcome of
  tuning speeds.
- **A2 — A turn has no duration.** It ends when the presentation says it ends.
  In manual mode it may wait indefinitely for the player's choice. In auto mode
  it does not wait for input but still lasts as long as its own steps take.
- **A3 — A turn ends on `done with skill VFX`.** Phaser's acknowledgement is the
  terminator: the acting unit leaves standby, returns to idle, and only then may
  the next turn be called.
- **A4 — A turn is not a unit of time.** `tick` and `step` are time. A turn is
  **mechanism**: it says when a unit acts, when a cooldown recovers, when a
  debuff deals its damage. Mechanism is subject to change without touching the
  clock, and the clock is not to be reasoned about in turns.
- **A5 — The gauge is the visible speed race.** It is fundamentally an
  animation: it shows time passing and units racing on speed. Crossing
  `GAUGE_MAX` is the event that *detects* a turn. Detection and depiction are the
  same object here, and that is what ATB is.
- **A6 — SUPERSEDED.** Combat time stops for the duration of a turn. The turn
  engine holds one `TurnToken`; every non-`IDLE` token state adds the
  `'turn-in-flight'` reason to the clock's freeze set, and the token is the sole
  authority on whether combat is between turns or inside one — there is no
  second representation of that fact on the gauge or the clock. See
  `2026-09-10-combat-turn-mechanism-design.md` §2, §3 and §10.
- **A6a — SUPERSEDED.** The clock's freeze-reason set is the only channel
  through which the turn engine affects time, and it composes uniformly with the
  off-screen reasons defined here. The clock still knows nothing about actors,
  pipelines or gauges; it knows only which reasons hold it back. See the turn
  mechanism spec §10.
- **A7 — Character animation never stops.** A unit is alive on screen for the
  whole battle: its idle, standby and loop clips keep playing through every
  freeze, every pause, and every wait for a manual choice. Freezing combat time
  freezes the gauge, not the picture.
  Skill VFX are **episodic** — they exist only while an action is playing, so
  starting and stopping is their normal life, not a defect. Character animation
  is **continuous** and has no such excuse: if it ever stops, that is a bug.
- **A8 — The world never stops, and never touches combat.** Cultivation,
  production and autosave are unaffected by combat freezing. An indefinite
  manual wait costs the player nothing outside the battle.
- **A9 — Cooldowns are counted in turns.** A skill with CD *x* is unavailable
  for *x* of its holder's own turns. The basic attack slot (slot 1 — Trảm, Hỏa
  Cầu Thuật and their peers) has **zero cooldown, by construction**. No cooldown
  anywhere in combat is measured in seconds.
- **A10 — Combat has no catch-up.** Combat time that did not elapse on screen
  did not elapse. There is no banking, no ceiling, no replay of missed time.
  This is coherent because a real battle is always watched: auto-farm is a
  wall-clock reward cycle with no battle at all, and there is no production path
  that resolves a turn battle without a renderer.
- **A11 — An unwatched battle pauses, visibly.** When the battle stops being
  watched it does not merely stall: it enters an explicit pause with an overlay,
  and resumes only when the player presses Continue. Returning attention is not
  consent to resume. This is what makes A10 honest — the player is never asked
  to reason about time they did not see.

---

## 4. Two clocks that never meet

### 4.1 Why a second clock is justified

A clock that receives its delta from another clock is not a clock; it is a
subscriber, and it inherits every property of its source — cadence, catch-up
behaviour, throttling. It would add a name and no isolation.

`CombatClock` is justified only because it **counts for itself**. It has its own
time source, its own cadence, its own freeze semantics, and no catch-up. That
independence is the entire reason it exists, and it is what makes RC-4
disappear without the world tick changing at all.

| | **WorldClock** (existing `GameClock`) | **CombatClock** (new) |
|---|---|---|
| Time source | its own 1 Hz interval + `lastOnlineAt` | its own render-cadence source |
| Lifetime | the whole session | only while a battle is on screen |
| Owner | `GameManager.update()` | `GameManagerTurnBattleOps` — not exported, no singleton, no global accessor |
| Freezes | **never** | while the battle is off screen, and while a turn is in flight |
| Catch-up | offline cap, tab-throttle clamp | **none, by design (A10)** |
| Drives | cultivation, production, decompose, out-of-battle buffs, autosave, auto-farm | the gauge, and the picture |
| Unit | seconds | **step** — a defined fraction of time |
| Verb | `tick` | `advance` / `step` |

### 4.2 The four separation laws

1. **Zero borders.** Neither clock passes time to the other. There is no
   `advance(dt)` call from the world tick, no shared timestamp, no shared delta.
   `updateBattleFixedStep` stops driving combat time entirely.
2. **No catch-up, ever (A10).** A hidden tab, a stalled frame, a long
   deliberation — none of it is replayed into the battle. The battle simply did
   not advance, which is the truthful account of what the player saw.
3. **Freezing does not propagate.** An off-screen freeze stops combat time only.
   An unbounded manual wait — which does not freeze the clock at all, only holds
   the gauge — leaves cultivation and production running (the existing rule
   *"Cultivation progresses alongside combat"* is preserved verbatim).
4. **No field has two owners.** Section 5 assigns every time-dependent combat
   field to exactly one authority. A parity test enumerates the classification
   and fails when a new time-dependent field appears unclassified.

The vocabulary rule in 4.1 is enforceable and is meant to be enforced:
reviewers should treat the word `tick` on a combat-time path as a defect.

### 4.3 Units, and the one place seconds appear

Inside combat, time is measured in **steps**. A step is a defined fraction of
time; the name is arbitrary and carries no player-facing meaning.

**The pre-battle countdown is the sole exception.** It counts down in real
seconds, because the player is reading a number: 3, 2, 1. That display is the
only place in combat where a second is a meaningful quantity. Everywhere else,
expressing a duration in seconds is a defect.

### 4.4 Frame-rate independence

Because `CombatClock` runs at render cadence, the gauge must advance by
**elapsed time**, never by frame count. A 144 Hz machine and a 30 Hz machine
must produce the same race and the same turn order from the same starting state.
This replaces the headless-determinism guarantee, which no longer applies: there
is no production headless battle (A10), and `'headless'` survives only as the
default for standalone component tests.

---

## 5. Classification

Every time-dependent thing in combat belongs to exactly one row.

### 5.0 How to read this section

`CombatClock` publishes steps to whoever is listening. It holds no rules of its
own; it holds only reasons it has been given. A step reaches a consumer only
when the clock is running, which means no reason is held — including
`'turn-in-flight'`, which the `TurnToken` adds and removes.

### 5.1 CombatClock — the gauge

Action gauge accumulation: `speed × elapsed combat time`, while the token is
`IDLE`. Every non-`IDLE` token state freezes the clock, so no step reaches the
gauge during a turn and nothing accumulates behind it — an unbounded turn buys
nobody a head start.

The wave spawn telegraph advances on the same steps and for the same reason: a
materialising enemy is a combat event and must not land in the middle of
someone else's turn.

This is the only consumer of `CombatClock` that is not purely visual, and by A5
it is only barely so.

### 5.2 CombatClock — the depiction of combat time

Visuals whose *progress* is combat time.

- `intro` and `countdown` phase progression, and the seconds the countdown shows
  (§4.3). **Their rule:** advance on every step while in that phase. No turn can
  be in flight during intro or countdown, so there is nothing to hold for.
- The gauge bar's fill and the spawn telegraph. **Their rule:** they depict 5.1,
  so they follow 5.1's rule exactly — a bar that keeps filling while the gauge
  behind it holds would be lying to the player.

Nothing in 5.2 may write combat state. It reads targets and interpolates.

### 5.2a Phaser's render clock — continuous, never halted

Driven by Phaser's own loop and by nothing else. **These keep running through
every freeze, every pause, and every unbounded manual wait:**

- **Character animation.** Idle, standby and loop clips for every living unit —
  played through `AnimationManager` (`sprite.play(key)`), which Phaser advances
  on its own render loop. A frozen battle still breathes.
- Camera work, HP bar interpolation, floating status text, position
  interpolation.

Episodic by nature, and legitimately absent between actions:

- Skill VFX, impact flashes, projectile tweens. They belong to an action, so
  they exist while one plays and not otherwise.

**The freeze is a data concept only.** It stops the gauge advancing; it must
never be implemented by pausing the scene. Specifically prohibited:
`scene.pause()`, `scene.scene.pause()`, `anims.pauseAll()`, setting
`anims.paused`, or halting the Phaser game loop for any battle-state reason.
Reaching for those is the obvious way to build a pause and would silently
violate A7 — the units would freeze mid-pose and the battle would look broken
rather than paused.

### 5.3 Turn domain — mechanism, clock-independent

Indexed by turns, not by time. None of this consults either clock:

- **Skill cooldowns** (`cooldownTurns` / `remainingCooldownTurns`), decremented
  at the holder's own turn. Basic slot: always ready.
- Actor selection, target selection, action declaration.
- Damage, crit, hit resolution, pierce / bounce / AOE resolution.
- Ailment application, reaction resolution.
- Buff and DoT durations, and **when a debuff deals its damage**, counted in
  turns and ticked at the holder's own turn.
- Death, wave triggers, boss phase / enrage triggers.
- Victory and defeat determination.

Per A4 this list is mechanism and may be redesigned freely. Such a redesign is
not a clock change and must not become one.

### 5.4 WorldClock — never halted, never combat

- Cultivation progress, production, decomposition, gathering.
- Out-of-battle buff durations (`buffSystem.updateTime`), including Kiếp Thương.
- Autosave, offline catch-up.
- **Auto-farm.** It has no `turnBattle`; it is a wall-clock reward cycle keyed on
  `perfectClearSeconds` and `lastCheckedMs`. It is a depiction of farming, not a
  battle, and it produces no combat time.

---

## 6. `CombatClock` contract

```ts
type CombatClockState = 'running' | 'frozen' | 'stopped'

/**
 * SUPERSEDED union. The canonical set is defined by the turn mechanism spec:
 *   'tab-hidden' | 'not-revealed' | 'turn-in-flight'
 * The first two mean "the battle is not on screen" and are owned here. The
 * third is owned by the turn engine and is added and removed by the TurnToken.
 */
type FreezeReason = 'tab-hidden' | 'not-revealed' | 'turn-in-flight'

interface CombatClock {
  start(): void                        // begins counting from its own source
  stop(): void                         // battle over; the clock ceases to exist
  freeze(reason: FreezeReason): void
  resume(reason: FreezeReason): void   // clears one reason only
  getState(): CombatClockState
  getFreezeReasons(): readonly FreezeReason[]
  getElapsedSteps(): number            // combat steps, excluding frozen time
  onStep(listener: (steps: number) => void): () => void
}
```

**Reasons are a set, not a flag,** because they genuinely overlap: a tab hidden
during a turn holds both `'tab-hidden'` and `'turn-in-flight'`, and a boolean
would let whichever resumed first restart a battle the other still had stopped.

**The clock still holds no rules of its own.** It knows which reasons are
holding it back and nothing else — no actor, no pipeline, no gauge. Who adds a
reason, and when, belongs to whoever owns that reason.

`freeze()` and `resume()` are idempotent per reason: freezing a held reason and
resuming an absent one are both no-ops.

- The clock **pulls** its own time. It exposes no `advance(dt)` and nothing
  outside it may inject time. This is law 4.2-1 expressed as an interface.
- Frozen time is **discarded, never banked** — banking it would let a long
  deliberation burst the gauge forward on resume, violating A6.
- There is no catch-up parameter, ceiling or clamp anywhere in this interface
  (A10). If frames stop arriving, the battle stops where it stood.
- `getElapsedSteps()` is the only legitimate source of combat time for any
  consumer. The countdown converts steps to displayed seconds at its own edge
  (§4.3); nobody else does.

### 6.1 The pause (A11)

`'tab-hidden'` is held while the document is hidden. It is **not** released when
the document becomes visible again: it is released only by the player pressing
Continue on the pause overlay.

```
document hidden          -> freeze('tab-hidden'), show pause overlay
document visible again   -> overlay remains; the battle stays stopped
player presses Continue  -> resume('tab-hidden'), hide overlay
```

If a turn was in flight when the tab was hidden, that turn is still in flight
when the clock resumes — the gauge simply stays held by its own rule (A6), and a
manual turn is still waiting for its choice. Continue resumes the clock, never
the turn. Nothing special is needed for this case, which is the point of keeping
the two rules apart.

**Units keep animating behind the pause overlay** (A7, §5.2a). The overlay dims
and blocks input; it does not stop the scene. A paused battle looks like a
battle waiting, not like a screenshot.

**The pause overlay is not the curtain.** The curtain belongs to the presentation
coordinator and covers route transitions; the pause overlay belongs to the
battle and covers a stopped clock. They have separate owners, separate state and
separate z-layers, and neither may drive the other. Conflating them would
recreate the dead-control defect the coordinator design already had to fix once.

Frame throttling short of a hidden document is deliberately **not** handled
(§12). The pause covers the case that matters; below that threshold the battle
simply runs slower in wall-clock terms while remaining correct, because the
gauge advances by elapsed time rather than by frames (§4.4).

---

## 7. Turn lifecycle — SUPERSEDED

> Replaced in full by `2026-09-10-combat-turn-mechanism-design.md` §3 (the
> `TurnToken` state machine) and §4 (the resolution pipeline). The sketch below
> is kept only as the historical account of how this section read before the
> token existed; **do not implement from it.** In particular its "clock still
> running / gauge holding" labels are exactly what the new spec reverses.

A turn is a mechanism boundary (A4). The diagram below shows when it opens and
closes, not how long it is — it has no length.

```
        ┌──────────────────────────────────────────────┐
        │ CLOCK RUNNING — gauge APPLYING steps          │
        │  gauge advances by speed × elapsed            │
        │  intro / countdown / telegraph animate        │
        └───────────────┬──────────────────────────────┘
                        │ a gauge crosses GAUGE_MAX — a turn is DETECTED
                        ▼
        ┌───────────────▼──────────────────────────────┐
        │ CLOCK STILL RUNNING — gauge HOLDING           │
        │ the turn (mechanism)                          │
        │  steps keep arriving and are dropped, not     │
        │  accumulated — an unbounded turn buys no      │
        │  head start (A6)                              │
        │                                               │
        │  manual: wait for submitTurnChoice (unbounded)│
        │  auto:   select action immediately            │
        │                                               │
        │  cooldowns tick, debuff damage lands,         │
        │  damage/reactions resolve — all by turn       │
        │                                               │
        │  acknowledgeTurnReady    (ready flourish)     │
        │  acknowledgeActionImpact (impact frame)       │
        │  acknowledgeActionComplete (VFX done)         │
        │                                               │
        │  animation and world time continue throughout │
        └───────────────┬──────────────────────────────┘
                        │ complete acknowledged, standby -> idle
                        ▼
                  consume gauge, gauge resumes APPLYING
                        │
                        ▼
        CLOCK RUNNING — gauge APPLYING steps
```

Rules:

- **The gauge detects the turn; the acknowledgement ends it.** Neither role may
  be taken by the other.
- At most one turn is in flight. A second actor cannot cross `GAUGE_MAX` because
  the gauge is holding. A1 is therefore structural, not enforced by a separate
  check — the hold *is* the check, and it lives with the thing it governs.
- Acknowledgements are token-scoped (`getPendingPlaybackToken`). A token from a
  superseded turn is rejected and cannot resume the clock. This mechanism exists
  today and is retained unchanged.
- **Failure to acknowledge is a defect, not a state.** There is no wall-clock
  rescue timer — that was `PresentationGate`'s mistake, and it is not
  reintroduced. If a battle can hang on a missing acknowledgement, the fix is at
  the emitter.

---

## 8. `presentationActive` ownership

`presentationActive` gets exactly one owner: **the presentation coordinator.**

It is `true` if and only if the committed route is `combat` **and** the combat
session is attached — coordinator step 6 — and false again on deactivate, on
transition failure, and on dispose.

No other caller sets it. `CombatScene` does not set it for itself: a scene
asserting its own readiness is the self-reporting pattern already rejected in
the coordinator design, where READY must be evidence rather than a claim.

`setPresentationMode()` and `setPresentationActive()` remain distinct and are
documented as such at both definitions, because their confusability is what let
RC-3 survive review.

---

## 9. Defect remedies

### 9.1 RC-1 — closed-curtain work window

The coordinator gains an explicit window: work with visible effect runs **after
the curtain is closed and before the target is revealed**. The domain command
supplied to `runAdmitted` executes inside `executeTransition`, after step 2,
instead of before the transition starts.

Admission is still decided before the command runs — that ordering (F07/D2) is
preserved and is not weakened. What changes is only *when* the accepted command
executes.

Consequence: a `combat → combat` refight closes the curtain, resets the battle
behind it, and reveals a battle already at its starting state. No reset is ever
visible.

### 9.2 RC-2 — curtain symmetry

`animateCurtain` must not depend on a transition it may not cause. Before
arming, it compares the requested state against the current one: when the panels
already sit at the requested transform it resolves immediately rather than
waiting out the safety timeout, and when a close was interrupted it restores a
known state first so the following open genuinely animates.

The 600 ms safety timeout stays a **safety net**, not a code path with expected
traffic. Close and open remain the same duration.

### 9.3 RC-3 — wire the gate

`presentationActive` is set per section 8. With it live, `tickPacing` no longer
receives `resolveImmediately = true` during interactive combat, the
acknowledgement handshake becomes load-bearing, and A1 holds.

The reported "all units attack at once" is expected to disappear entirely
without touching a single speed value. Differentiating speeds is **not** part of
this fix; if a perception issue remains once the gate is live, it is a separate
animation-length question and gets its own investigation.

### 9.4 RC-4 — combat leaves the world's clock

`CombatClock` starts when a battle appears on screen and stops when it leaves.
It counts from its own render-cadence source, so:

- The telegraph advances every frame, not in three bursts. `countdownProgress`
  and spawn `progress` become **targets** that `CombatScene` interpolates toward
  on its own clock, exactly as `positionInterp` / `snapInterpolationTarget`
  already do for positions. `CombatScene.update()` — currently declared without
  arguments — takes `(time, delta)`.
- Resuming after an acknowledgement is immediate. There is no world-tick
  boundary to wait for, so no dead air after a turn.
- **The world's 1 Hz interval is not changed.** Cultivation, production, offline
  catch-up and autosave keep their existing cadence and their existing tests.
  `updateBattleFixedStep` stops carrying combat time; what remains of it is
  world-side work.

A hidden tab therefore stops the battle rather than banking it (A10, law 4.2-2)
and surfaces the explicit pause of §6.1. That is the intended behaviour: the
battle is a performance, and it does not happen while nobody is watching.

### 9.5 RC-5 — retire the seconds cooldown clock

Per A9 there is one cooldown authority and it counts turns. The legacy
seconds-based clock is retired in three steps, in this order:

1. **Characterize.** Prove no turn-combat path reads `remainingCooldownBySlot`
   or any seconds-derived cooldown, with a test that fails if one appears.
2. **Sever.** Remove the `skillSystem.update(deltaSeconds, 0)` call from
   `GameManager.update()`.
3. **Verify at the level changed.** Full unit gate plus a browser pass through a
   real battle using a skill with a non-zero cooldown.

Characterization precedes removal (AstraDoctrine: characterize before
migration). The call is not removed on the assumption that it is dead.

---

## 10. Real-time commands

A command is any player- or system-initiated request that arrives on wall-clock
time: `submitTurnChoice`, refight, abandon, route transitions, run-mode and
speed changes, equipment changes.

**Law: a command never mutates battle state at the moment it arrives.** It is
recorded and applied at the next turn boundary — the instant between one turn's
acknowledged completion and the next turn being detected.

- `submitTurnChoice` is the sole exception in *timing* only: it is what a
  waiting manual turn exists for, so it is consumed by the turn already in
  flight.
  It still mutates nothing outside that turn's declaration.
- Refight, abandon and route changes go through the coordinator and therefore
  through the closed-curtain window (9.1); they never land mid-turn.
- Equipment and speed changes are recorded and applied at the boundary. A change
  submitted mid-turn does not retroactively alter the action being resolved.

This closes the interleaving-corruption class the report raised: there is
exactly one instant at which combat state may change from outside, and at that
instant no action is in flight and the clock is already stopped.

---

## 11. Acceptance criteria

Each maps to a reported symptom or a law, and each is falsifiable.

| # | Criterion | Evidence |
|---|---|---|
| AC-1 | A `combat → combat` refight never renders a frame of the reset battle before the curtain is fully closed | E2E: curtain reaches `data-curtain="closed"` before the battle's start state is observable |
| AC-2 | Curtain open and close take the same time, and open always animates | Unit test on `animateCurtain` for the already-at-target case; E2E timing symmetry |
| AC-3 | No two units resolve actions in the same rendered frame | Instrumented browser run: action-complete timestamps strictly ordered and separated by their animations |
| AC-4 | The spawn telegraph advances smoothly across its full duration | Browser capture: telegraph progress changes on render frames, not in three steps |
| AC-5 | SUPERSEDED — see turn mechanism spec AC-5 and AC-9. An indefinite manual wait freezes the clock (`'turn-in-flight'`) and every gauge | Unit test in the turn mechanism plan |
| AC-6 | An indefinite manual wait does not stall cultivation or production | Unit test: same freeze, assert world-side progress advanced |
| AC-7 | Combat never catches up | Unit test: withhold the clock's source for 60 s, resume, assert the battle advanced by the frames actually delivered and not by the gap |
| AC-7a | Hiding the tab pauses the battle, and returning does not resume it | E2E: hide the document mid-battle, restore it, assert the pause overlay is present and the gauge unchanged until Continue is pressed |
| AC-7b | Overlapping freeze reasons cannot be lifted by one resume | Unit test: freeze `'tab-hidden'` and `'turn-in-flight'`, resume one, assert the clock is still frozen |
| AC-7c | The clock holds no rules of its own | Static test: `CombatClock.ts` names its reasons and nothing else — no reference to actors, pipelines or gauges beyond the reason literals |
| AC-8 | The two clocks share no time | Static test: no call path passes a delta, timestamp or step count between `GameClock` and `CombatClock` |
| AC-9 | Turn order is frame-rate independent | Unit test: the same battle at simulated 30 / 60 / 144 Hz yields identical turn order |
| AC-9a | Character animation continues through every freeze | Browser: during an unbounded manual wait and behind the pause overlay, idle clips keep advancing frames |
| AC-9b | No freeze is implemented by pausing the scene | Static test: no production source calls `scene.pause`, `anims.pauseAll`, or assigns `anims.paused` |
| AC-10 | Exactly one cooldown authority remains, counted in turns; basic slot is always ready | Characterization test from 9.5 step 1, retained as a regression guard |
| AC-11 | Every time-dependent combat field is classified under section 5 | Parity test enumerating the classification |
| AC-12 | Seconds appear in exactly one combat surface | Test asserting the countdown display is the only seconds-valued combat output |

---

## 12. Out of scope

- Rebalancing speed values, cooldown numbers or animation lengths. Section 9.3
  deliberately fixes the structure and changes no tuning value.
- Redesigning what a turn *does* — targeting, damage and reaction rules are
  untouched here. A4 explicitly leaves that free to change later, without a
  clock change.
- The world tick's cadence, offline catch-up and autosave, which this document
  deliberately does not modify.
- **Frame-rate throttling short of a hidden document.** Background throttling,
  slow machines and heavy tabs are left to the player. A11's pause covers the
  case worth covering; adding heuristics below it would reintroduce the
  guess-how-much-time-passed reasoning that A10 exists to eliminate.
- The parallel E2E flake and the transitional `CombatScene.preload()` asset
  queue, both carried forward from the presentation-coordinator QA notes.
- Tribulation. It has its own director and its own time handling.

---

## 13. Open questions

None. The decisions that shaped this document — the gauge is real-time and the
clock freezes for a turn; a turn is mechanism rather than time; cooldowns are
counted in turns with a free basic slot; `CombatClock` must count for itself,
with no catch-up and no shared time; an unwatched battle pauses and waits for
Continue; the countdown is the only place seconds appear — were settled during
brainstorming and are recorded as A5/A6, A4, A9, A10 with §4, A11 with §6.1, and
§4.3 respectively.
