# Combat Turn Mechanism and Turn-End Authority

**Status:** Draft, awaiting review
**Date:** 2026-09-10
**Supersedes:** Turn-mechanism portion of
`2026-09-10-combat-realtime-turn-authority-design.md`
**Relates to:** the combat-realtime-turn-authority spec's sections on
off-screen handling, the closed-curtain work window, and the external command
boundary. Those sections remain in force; this document refines the turn
mechanism they depend on.

---

## 1. Scope

This spec defines how combat decides who acts, when a turn begins, what a turn
contains, and when a turn ends. It applies to the battle engine only. It does
not restate the rules for the presentation curtain, the off-screen clock
freeze, or the world tick, which are governed by the combat-realtime-turn-
authority spec.

The engine is turn-based with a gauge that determines turn order. Between turns,
each actor's gauge fills at a rate determined by its current speed. When a
gauge reaches its maximum, that actor acts, and no other actor or system
advances until the action and everything it triggers has fully resolved.

---

## 2. The turn token

Only one turn token exists per battle. Whoever holds the token has agency.
Every other actor is waiting.

The token is data, not a scene object. Its state is the sole authority on
whether combat is between turns or inside one. There is no separate "in flight"
flag on the gauge, no mirrored boolean on the clock, no second representation
of the same fact anywhere in the engine.

---

## 3. State machine
                       ┌─────────────────┐
                       │                 │
                       ▼                 │
                  ┌─────────┐            │
     ┌───────────>│  IDLE   │            │
     │            └────┬────┘            │
     │                 │                 │
     │        gauge reaches max          │
     │                 │                 │
     │                 ▼                 │
     │            ┌─────────┐            │
     │            │ CLAIMED │            │
     │            └────┬────┘            │
     │                 │                 │
     │      ┌──────────┴──────────┐      │
     │      │                     │      │
     │      ▼                     ▼      │
     │  manual +              auto /     │
     │  player team           enemy      │
     │      │                     │      │
     │      ▼                     │      │
     │  ┌──────────────┐          │      │
     │  │AWAITING_INPUT│          │      │
     │  └──────┬───────┘          │      │
     │         │                  │      │
     │         │ player submits   │      │
     │         ▼                  ▼      │
     │       ┌──────────────────────┐    │
     │       │      RESOLVING       │────┘  pipeline empty
     │       └──────────┬───────────┘       & combat not over
     │                  │
     │                  │ pipeline empty
     │                  │ & combat over
     │                  ▼
     │           ┌──────────────┐
     └───────────│  COMBAT_OVER │
                 └──────────────┘



### 3.1 States

| State | Holder | Clock | Gauge |
|---|---|---|---|
| `IDLE` | none | running | filling |
| `CLAIMED` | holder | frozen | frozen |
| `AWAITING_INPUT` | player | frozen | frozen |
| `RESOLVING` | holder | frozen | frozen |
| `COMBAT_OVER` | none | stopped | stopped |

`CLAIMED` is transient. It exists only to route the token into one of the two
resolve paths.

### 3.2 Transitions

- `IDLE → CLAIMED` — an actor's gauge reaches maximum during a step.
- `CLAIMED → AWAITING_INPUT` — the actor is on the player team and manual mode
  is enabled.
- `CLAIMED → RESOLVING` — otherwise.
- `AWAITING_INPUT → RESOLVING` — the player submits a valid action.
- `RESOLVING → IDLE` — the pipeline is empty and both sides have a living
  actor.
- `RESOLVING → COMBAT_OVER` — the pipeline is empty and one side has no living
  actor.
- `COMBAT_OVER` is terminal. Only a new battle resets the machine.

### 3.3 Relationship to `TurnBattleState`

`TurnBattleSystem` has its own phase field, `'intro' | 'countdown' | 'fighting' |
'victory' | 'defeat'`. The two machines live at different layers and must not be
confused.

**The turn token is active only while the phase is `'fighting'`.** During
`'intro'` and `'countdown'` the token is `IDLE` and nothing may claim it: those
phases advance on clock steps and contain no combat logic, so there is no turn
to hold. The first claim becomes possible on the step after the phase turns
`'fighting'`.

`startStage` resets the token to `IDLE`. A token left in `COMBAT_OVER` by the
previous battle must never be inherited by the next one — a stale terminal token
would reject the first claim of a fresh battle and freeze it permanently.

---

## 4. Resolution pipeline

The pipeline is a serial queue of steps. Steps run one at a time, in order. A
step fully completes before the next begins. Animations do not overlap.

### 4.1 Step types

| Step | Pushed by | Blocks turn-end |
|---|---|---|
| `AWAITING_INPUT` | claiming a player-team turn in manual mode | yes |
| `ANIMATION` | action chosen | yes |
| `HIT_RESOLUTION` | animation hit frame | yes |
| `REACTION` | hit resolving | yes |
| `DEATH_CHECK` | damage applying | yes |
| `SEMANTIC_VFX` | hit or reaction | yes |
| `IDLE_CHECK` | pipeline empty | yes |

Cosmetic VFX and auras are not steps and never block.

### 4.1a Step completion is asynchronous

A step signals its own completion. `ANIMATION` and `SEMANTIC_VFX` finish when
the renderer says so, which is not the same instant they started, so the
pipeline cannot be a synchronous loop: it advances until it reaches a step that
has not yet completed, parks there, and resumes when that step reports done.

Every step therefore receives a completion callback and must call it exactly
once. Mechanical steps (`HIT_RESOLUTION`, `REACTION`, `DEATH_CHECK`,
`IDLE_CHECK`) call it synchronously and behave exactly like a serial loop.

**Completion signal for `ANIMATION` and `SEMANTIC_VFX`** — both of these, in
order of precedence:

1. Phaser's `animationcomplete` / tween `onComplete` event for the specific
   clip or tween the step started.
2. A fallback timer of the clip's known duration plus a margin, in case the
   event never arrives — a destroyed sprite, a cancelled tween, a texture that
   failed to load.

Whichever fires first completes the step; the other is discarded. The fallback
is not an optimisation, it is the thing that stops a missing event from parking
the pipeline forever, which would leave the token non-`IDLE` and the clock
frozen for the rest of the session.

A step that would complete twice — event and timer racing — completes once. The
callback is idempotent per step.

`drain()` is **not re-entrant.** While it is advancing, a `push()` from inside a
running step appends to the queue and returns; it never starts a second
traversal. The chain-depth counter belongs to the turn, not to a `drain()` call,
so it survives parking and resumption — otherwise an async step in the middle of
a reaction chain would silently reset the guard.

### 4.2 Dynamic queue

Reactions push reactions. Death checks push on-death effects. The queue grows
during resolution. This is how counters, reflects, on-death, and on-revive
chain naturally.

### 4.3 Chain depth limit

A hard limit of 10 chained reactions per turn. When the limit is reached:

- A warning is logged:
  `[combat] reaction chain depth limit (10) reached; forcing resolution`.
- The reaction queue is cleared.
- The pipeline drains its remaining mechanical steps (`SEMANTIC_VFX`,
  `IDLE_CHECK`) and terminates normally.
- HP, buffs, and every state applied up to depth 10 are kept.

The limit exists because two abilities that each trigger on the other's death
can ping-pong indefinitely. Ten is above any practical chain in the game's
design space; if a legitimate case needs more, raise the constant rather than
remove the guard.

### 4.4 Effect timing

Every mechanical effect — damage, healing, buff apply, debuff apply, gauge
fill, stat change — applies immediately at its `HIT_RESOLUTION` step, the same
way damage applies. Effects are not deferred to turn-end.

This is what allows a speed buff applied mid-turn to take effect before the
next gauge tick. When the clock resumes, an actor whose gauge was behind can
immediately catch up if the buff is large enough.

### 4.5 Death check timing

Death check runs after every damage apply, not at the end of the pipeline.

Consequences:

- An actor marked dead during resolution still participates in the pipeline
  until it drains. Its death animation runs as an `ANIMATION` step; its
  on-death effects resolve as `REACTION` steps; its semantic VFX settle.
- Reactions targeting a dead actor after its death frame are skipped.
- Removal from rotation happens only at `RESOLVING → IDLE`, not at death.

A caster killed by reflect still finishes their action animation. Their turn is
not cancelled; only their participation in future turns is revoked.

**Ordering when the token holder dies mid-turn.** The action animation runs to
completion first, then the death animation is pushed as a further `ANIMATION`
step. The two never blend and never overlap: the pipeline is serial, and a
holder dying does not earn an exception to that. So a caster killed by their
target's counter finishes the swing, then falls.

---

## 5. VFX classification

Three categories.

### 5.1 Semantic VFX

Visuals whose state is mechanically meaningful: a projectile that must reach
its target before damage applies, a telegraph that must be fully drawn before
the hit registers, an impact whose duration gates the reaction that follows.

Semantic VFX block turn-end. They are represented as a `SEMANTIC_VFX` step.

### 5.2 Cosmetic VFX

Screen shake, damage popups, particle sparks, hit flashes. They decorate a
moment that has already resolved.

Cosmetic VFX do not block turn-end. They are never a step and never tracked by
the pipeline.

### 5.3 Aura

Persistent visuals attached to a buff or debuff: the coloured ring under a
burned actor, a shield silhouette, speed-lines around a hasted target.

Auras do not block turn-end. They are not steps. Their lifetime is governed by
the buff, not by the turn. An aura appears when the buff applies — inside the
`HIT_RESOLUTION` step that applied it — and disappears when the buff expires,
which happens during an `IDLE` state tick, not during a pipeline event.

---

## 6. Buffs, debuffs, aura lifetime

A buff lasts for a number of its holder's turns, as declared by the skill. A
buff is decremented at the start of its holder's next turn, in the
`CLAIMED → RESOLVING` transition.

An aura is owned by its buff. When the buff expires, the aura is removed. An
aura never outlives its buff and never appears without one.

Buff duration is counted in turns. It is never counted in seconds. This is the
same authority rule that governs cooldowns.

---

## 7. Manual mode

Manual mode applies to player-team turns only. Enemy turns are always auto.

When a player-team actor claims the turn and manual mode is enabled, the
machine enters `AWAITING_INPUT`. The clock is frozen while the machine is in
this state. The player submits an action, and the machine transitions to
`RESOLVING`.

Reactions — counter, on-hit, on-death — run automatically even during a
player-team turn. Manual mode gates the primary action, never the reaction
chain.

### 7.1 Counter configuration

A skill declares whether it can be used as a counter and which skill an actor
uses when countering.

interface TurnSkillAction {
counterable: boolean
counterSkillId: string | null
}


Counter selection is not player input. When an actor is hit by a counterable
attack and has an available counter skill, its counter is pushed as a
`REACTION` step. There is no mid-turn UI for choosing a counter. A player who
wants a different counter configures it before the battle or through a
per-encounter override.

---

## 8. Combat over

Combat-over is evaluated exactly once, at the `RESOLVING → IDLE` transition:
if any side has no living actor:
tokenState = COMBAT_OVER
clock.stop()
else:
tokenState = IDLE
clock.resume('turn-in-flight')

The player sees the last action resolve — including every chained reaction,
death animation, and semantic VFX — before the victory or defeat screen
appears. There is no force-end path. If a chain takes ten reactions and a two-
second death animation, that time is spent.

`COMBAT_OVER` stops the clock outright. It does not freeze it. The battle is
over and nothing more will advance.

---

## 9. External command boundary

External commands arrive on wall-clock time. Combat state changes on turn
boundaries. The boundary is the instant after the token transitions
`RESOLVING → IDLE` and before the next `IDLE → CLAIMED`.

### 9.1 Internal vs external

| Source | Timing |
|---|---|
| Internal effect (damage, buff, debuff, gauge fill from a skill) | Immediate, at its `HIT_RESOLUTION` step |
| External command (gear change, item use, party swap, manual-mode toggle, **flee / retreat**) | Queued to the next turn boundary |

Flee is an external command with no special case. In manual mode this means a
player who wants to flee submits their action, that turn resolves, and the flee
runs at the boundary — flight costs the turn already claimed. That is the price
of having exactly one instant at which outside state may change; an immediate
flee would be a second exception to §9 and would have to define what happens to
a pipeline abandoned mid-chain.

Realtime speed updates come from internal effects and are therefore immediate.
A speed buff applied by a skill takes effect the instant the hit resolves.

### 9.2 Boundary queue

- Commands submitted while `tokenState !== IDLE` are queued in submission
  order.
- Commands are drained exactly once, at the boundary, before the next gauge
  check.
- A command submitted while `tokenState === IDLE` runs immediately.
- Commands queued against a battle that ends before the boundary is reached
  are discarded when the battle terminates. **The queue is cleared on the
  `RESOLVING → COMBAT_OVER` transition**, not only on `startStage` and abandon:
  a victory or defeat never passes through abandon, so a command queued in the
  last turn of one battle would otherwise drain into the next one.
- `submitTurnChoice` is not an external command. It is consumed by the
  `AWAITING_INPUT` state and never queued past it.

---

## 10. Clock interaction

| Token state | Clock state | Extra freeze reason | Gauge |
|---|---|---|---|
| `IDLE` | running | — | filling |
| `CLAIMED` | frozen | `turn-in-flight` | frozen |
| `AWAITING_INPUT` | frozen | `turn-in-flight` | frozen |
| `RESOLVING` | frozen | `turn-in-flight` | frozen |
| `COMBAT_OVER` | stopped | — | stopped |

The clock's freeze reason set is the only channel through which the turn engine
affects time. The clock itself has no concept of a turn, an actor, or a
pipeline. It knows only whether it is allowed to count and, if not, which
reasons are holding it back.

The `turn-in-flight` reason is added on every transition into a non-`IDLE`
state and removed on the transition back to `IDLE`. It composes uniformly with
the off-screen reasons defined by the combat-realtime-turn-authority spec.

---

## 11. Acceptance criteria

Each item is a test to write against the turn engine.

**AC-1 Basic hit.** A attacks B; B survives; no reactions, no semantic VFX.
Pipeline drains. Token returns to `IDLE`; clock transitions `frozen → running`;
elapsed steps preserved (no reset).

**AC-2 Counter miss.** A attacks B; B counters; counter misses. Both animations
reach idle before token returns. Neither actor's HP changed from the counter.

**AC-3 Counter kills A.** A attacks B; B counters; counter kills A; A has no
on-death. A's death animation plays within A's turn. Token returns to `IDLE`.
A is removed from rotation only after pipeline empty. Clock resumes without A.

**AC-4 On-death attacks A.** A attacks B; B dies; B's on-death attacks A. B's
death animation plays. B's on-death resolves as a reaction. A takes damage.
Token returns to `IDLE`. Clock resumes.

**AC-5 Manual wait.** Player-team actor's gauge is full; manual mode on. State
enters `AWAITING_INPUT`. Clock frozen, all gauges frozen, manual UI shown.
Clock resumes only after pipeline empty.

**AC-6 Reflect kills A.** A attacks B; B has reflect; reflect kills A; A has
no on-death. A's death animation plays. A's action animation still completes.
Token returns to `IDLE`. Clock resumes. A removed.

**AC-7 B revives.** A attacks B; B dies; B's on-death revives B. B is alive at
end of pipeline. A's turn is not cancelled. Token returns to `IDLE`. B
participates normally in future turns.

**AC-8 Chain depth limit.** A reaction chain would exceed depth 10. At depth
10: a warning is logged, the reaction queue is cleared, remaining mechanical
steps drain, token returns to `IDLE`, all state applied up to depth 10 kept.

**AC-9 Clock is frozen during turn.** For any non-`IDLE` token state,
`CombatClock.getState()` is `'frozen'` and `getFreezeReasons()` includes
`'turn-in-flight'`.

**AC-10 Cosmetic VFX do not extend turn.** A hit spawns a screen shake with a
500 ms tween. When the pipeline is otherwise empty, the token returns to
`IDLE` immediately, without waiting for the tween.

**AC-11 Aura does not extend turn.** A buff applied mid-turn with an aura that
persists for three turns. The aura is not a pipeline step. The turn ends when
mechanical steps drain. The aura remains visible across the following turns.

**AC-12 Effects apply immediately.** A skill buffs an actor's speed by +50%
mid-turn. When the hit resolves, the actor's effective speed is updated before
the clock resumes, so the first gauge tick after resume reflects the new value.

**AC-13 External command is queued.** An external command submitted while
`tokenState !== IDLE`. Before the pipeline drains, the command's effect is not
yet visible in battle state.

**AC-14 External command drains at boundary.** The same command, once the
pipeline drains, runs exactly once, at the boundary, before the next
`IDLE → CLAIMED`.

**AC-15 Death check is per damage.** A chain in which A kills B, then B's
on-death damages A. B's death state is set before B's on-death step executes,
so a "if dead, do X" effect reads B as dead.

---

## 12. Retained debt

The following are out of scope and remain as recorded in the
combat-realtime-turn-authority spec:

- No mid-combat save or load. Combat state is ephemeral.
- Multi-tab leader election is not addressed. One instance is assumed.
- OS sleep and lid-closed events resume the clock source without catch-up. No
  banking.
- Browser throttling is mitigated at the Electron layer via
  `backgroundThrottling: false` and a main-process clock. The combat engine
  sees only the clock source's callbacks and is unaware of the mitigation.
- **The "animation never stops" rule is scoped to a visible window.** The
  combat-realtime-turn-authority spec's A7 holds while the document is visible:
  through a manual wait, through a turn in flight, through any freeze the engine
  causes. When the document is hidden the browser throttles `requestAnimationFrame`
  and Phaser's loop stops with it — that is platform behaviour, not a defect,
  and the pause overlay (A11) is the response to it. A7 must not be read as a
  promise the platform cannot keep.

---

## 13. Document control

This document replaces the turn-mechanism portion of the
combat-realtime-turn-authority spec. Where the two disagree on turn order,
turn-end, manual mode, or the boundary for external commands, this document
wins. All other sections of the combat-realtime-turn-authority spec remain in
force.