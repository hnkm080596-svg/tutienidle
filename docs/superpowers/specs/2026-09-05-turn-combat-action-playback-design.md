# Turn Combat — Action Playback Layer — Design Spec

Date: 2026-09-05
Status: Approved (design)

## 1. Motivation

Since Slice 6's cutover, `TurnBattleSystem` is the sole combat engine —
but it resolves every turn synchronously and instantly (`resolveActorTurn()`
mutates HP/gauge/buffs in one call, `GameManager`'s fixed-step loop calls
it every 0.1s with no pacing). The result: battles finish in a handful
of fixed-steps, far faster than any animation could play, and — more
importantly — `TurnBattleSystem` never calls into `ActionImpactSystem.ts`
(the `attack`/`action_impact` events that drive lunge animations and VFX
presets), because that system was only ever wired to the now-retired
real-time `BattleSystem.ts`. Combat feels instant and silent even though
a rich presentation pipeline (`CombatScene.ts`'s ~20 event handlers,
`ActionImpactVfx.ts`, `CombatVfxPresets.ts`, `StatusVfxPresets.ts`)
already exists and works — it's simply orphaned.

This spec designs the **Action Playback layer**: a per-actor state
machine (`idle → ready → cast → standby → idle/ready`) that synchronizes
logic resolution with Phaser's rendering, so damage is only actually
applied at the moment its VFX visually lands, and the engine only
advances to the next actor once that actor's full presentation sequence
has finished. Per user request, this also designs generic **hook
points** at each state transition so future mechanics (counter/follow-up,
punish-on-cast) can plug in without re-architecting the state machine.

## 2. Survey (2026-09-04/05)

- `CombatSystem.resolveActionHit()` (`CombatSystem.ts:129`) — called
  directly by `TurnBattleSystem.resolveActorTurn()` today — **already
  emits** `dodge`, `critical`, `block`, `hit`, `damage`, `death`, `kill`
  via `this.eventBus.emit(...)` at various points in its body. These
  events already reach `CombatScene.ts`'s handlers today for turn-based
  combat (damage numbers, floating kill/heal text likely already work).
- `ActionImpactSystem.ts` emits `attack` (`:136,147`) and `action_impact`
  (`:209,271`) — these are **never called by `TurnBattleSystem`**, only
  by the retired `BattleSystem.ts`. This is the missing piece: no lunge
  animation, no VFX-preset spawn, no screen-shake, no hit-flash for
  turn-based combat.
- `CombatScene.ts`'s `getCombatEventBindings()` (`:477-531`) is the full
  list of presentation event names this spec must emit into, reusing
  existing names (`attack`, `action_impact`, `hit`, etc.) wherever the
  existing handler's payload shape still fits — no renaming for its own
  sake.
- `ActionImpactVfx.ts`'s existing invariant: "MỘT action_impact = MỘT VFX
  instance," multi-hit expressed as `pulses` within one timeline — this
  spec's multi-target handling (§5) relies on this already-built
  behavior rather than redesigning it.
- `TurnBuffTypes.ts` currently has effect kinds `dot`/`cc`/`statModifier`/
  `onHitProc`. §6 adds one more: `reactiveTrigger`.
- Slice 7 (Manual UI, plan already written) already introduces a
  "player paused, waiting for input" concept (`isWaitingForPlayerChoice`)
  — this spec's `ready` state reuses that exact wait for player-controlled
  manual turns; for auto/enemy turns, `ready` becomes a NEW wait (§4).
- `GameManager`'s doc comment confirms it's a plain class, not
  Vue/Phaser-reactive state — this spec's `presentationActive` flag
  (§4) is designed specifically to preserve that boundary: `GameManager`/
  `TurnBattleSystem` never import Phaser or query scene state directly,
  they only check a boolean and, when true, wait for callback methods
  Phaser calls into them.

## 3. Decisions (locked, 2026-09-04/05)

- **Damage applies at VFX impact, not at declare time.** This is the
  core requirement: `combat.resolveActionHit()` (and therefore the
  hit/damage/death events it emits) does NOT run when an action is
  decided — it runs only when Phaser signals the impact frame has been
  reached.
- **`presentationActive: boolean` gates all waiting.** Set by
  `CombatScene` on mount, cleared on unmount. When `false` (every
  existing test, and any future headless driver), the whole state
  machine collapses to instant sequential execution — **byte-identical
  behavior to today, zero existing test rewrites forced by this spec**.
  When `true`, each transition genuinely waits for an external
  acknowledgement call.
- **`ready` always waits for its animation, including auto/enemy turns**
  (explicit user decision) — every turn gets a visible "it's this
  actor's turn" beat before acting, matching HSR/FF-style ATB pacing,
  not just manual player turns.
- **No mid-animation interruption.** ATB is inherently sequential — one
  actor's full `idle→ready→cast→standby` cycle always completes before
  `peekNextActor()` runs again. Counter/follow-up mechanics are modeled
  as a **queued next cycle**, appended sequentially after the current
  one finishes, never overlapping an in-flight animation.
- **Multi-target/AOE stays one declare → one impact → one standby**,
  regardless of how many targets a skill hits — matches the existing
  `ActionImpactVfx.ts` pulse-within-one-timeline invariant, no per-target
  sub-cycles.
- **Hook points reuse existing patterns, not new machinery**: presentation
  hooks go through the existing `EventBus` (fire-and-forget, matches
  every other combat event in the codebase); control-flow-affecting
  hooks (block cast, queue follow-up) are buff-system queries, matching
  the existing CC-check pattern (`actorBuffSystem.isStunned()`) rather
  than a parallel hook registry.

## 4. The State Machine

Five states per acting participant, each transition backed by (a) an
`EventBus` emit for presentation and (b) for two specific transitions, a
buff-system query that can affect control flow:

```
idle → ready → cast → standby → idle
                              ↘ ready  (follow-up queued)
```

### 4.1 `idle → ready`

Triggered when `peekNextActor()` (existing, Slice 7) identifies this
actor as up. Emits `turn_ready: { actorId: string }`. No control-flow
hook here — every ready-eligible actor always enters `ready`.

If `presentationActive`, the engine waits for
`acknowledgeTurnReady(actorId)` (called by `CombatScene` once the
ready-transition animation finishes) before proceeding — **for every
actor, auto and manual alike** (§3). If `!presentationActive`, proceed
immediately (synchronous, same call).

### 4.2 `ready → cast`

This is where the action is decided: for a manual-mode player turn,
this is exactly Slice 7's existing wait for `submitPlayerSkillChoice()`;
for auto/enemy turns, `selectAction()` runs immediately (no new wait
beyond `ready`'s own).

Once an action is decided, BEFORE transitioning to `cast`:

1. **Fire `onCastBegin` reactive-trigger effects** (§6) in the actor's
   buff pool — these may apply a new buff to the actor (e.g., a
   punish-on-cast stun).
2. **Re-run the existing CC-check** (`isStunned()`/`isFrozen()` +
   Bá Thể's `consecutiveHardCcTurns` logic, `TurnBattleSystem.ts:183-198`,
   unchanged logic) using the buff state AS-OF-NOW (i.e., including
   whatever Step 1 just applied). If blocked, the actor skips `cast`
   entirely and goes straight to `idle` (turn ends this cycle without
   acting — same observable outcome as today's `ccBlocked` handling,
   just reached via a different route when Step 1's punish effect was
   what caused it).
3. If not blocked, emit `cast_start: { actorId, skillId, targetIds }`
   (reuses the existing event name from `CombatScenePayload` — the old
   real-time cast-bar concept doesn't apply, but the name/shape already
   fits "an actor beginning to perform a skill"). `CombatScene` plays
   the skill's windup/attack animation.

If `presentationActive`, wait for `acknowledgeActionImpact(actorId)`
(called by `CombatScene` at the animation's impact frame) before
proceeding to §4.3. If `!presentationActive`, proceed immediately.

### 4.3 `cast → impact` (damage actually applies here)

On the impact acknowledgement (or immediately, if `!presentationActive`):

1. Call `combat.resolveActionHit()` for each resolved target — this
   already emits `hit`/`critical`/`dodge`/`block`/`damage`/`death`/`kill`
   (§2, unchanged, no new code needed for these).
2. Fire the existing `onHitProc` reaction (`TurnBuffSystem.rollOnHitEffects`,
   unchanged) plus the **new `onImpactLanded` reactive-trigger effects**
   (§6) on each hit target's buff pool — these may queue a follow-up
   actor (stored on `battle`, e.g. `battle.queuedFollowUpActorId?: string`).
3. Emit `action_impact: { presetId, affectedArea, anchorCell, hitCount,
   landedTargetIds }` (reuses the existing `ActionImpactEvent` shape
   `ActionImpactSystem.ts` already produces — this spec's job is calling
   the existing emit at the right point, not inventing a new payload).

### 4.4 `impact → standby`

Purely a presentation wait: `CombatScene` plays out remaining VFX
(hit-reactions, damage number pop, death sequence). If `presentationActive`,
wait for `acknowledgeActionComplete(actorId)`. If not, proceed immediately.

### 4.5 `standby → idle` or `standby → ready`

Engine runs the existing turn-cleanup logic (`consumeGaugeAfterAction`,
wave-spawn check via `shouldSpawnNextEnemy`, win/loss check — all
unchanged, currently at the tail of `resolveActorTurn()`). Then:

- If `battle.queuedFollowUpActorId` is set (from §4.3 step 2), clear it
  and transition THAT actor directly to `ready` (§4.1) — skips `idle`,
  chains immediately, still sequential (no overlap with the action that
  just finished).
- Otherwise, this actor returns to `idle`; the main loop calls
  `peekNextActor()` normally for whoever's gauge is next ready.

Emits `turn_standby_complete: { actorId }` (presentation-only, no
control-flow effect beyond what was already decided above).

## 5. Multi-Target / AOE

One `cast`/`impact`/`standby` cycle covers ALL targets a skill hits —
§4.3 step 1 loops over every resolved target within the single impact
phase (this is the existing loop in `resolveActorTurn()`, unchanged in
shape). `action_impact`'s existing `hitCount`/`landedTargetIds` fields
already carry per-target information into a single VFX instance's pulse
count (`ActionImpactVfx.ts`, unchanged). No per-target sub-states.

## 6. New Buff Effect Kind: `reactiveTrigger`

Added to `TurnBuffTypes.ts`'s effect union (alongside `dot`/`cc`/
`statModifier`/`onHitProc`):

```ts
interface TurnReactiveTriggerEffect {
  type: 'reactiveTrigger'
  trigger: 'onCastBegin' | 'onImpactLanded'
  chance: number // 0..1, rolled each time the trigger condition is met
  appliesDefinitionId?: string // onCastBegin: buff to apply to the caster (e.g. a punish stun)
  queuesFollowUp?: boolean // onImpactLanded: holder gets a chained 'ready' cycle after standby
}
```

One effect kind covers both example mechanics from this session's
brainstorm:
- **Punish-on-cast** ("cast while standing in a debuff zone → stunned"):
  a debuff on the actor with `trigger: 'onCastBegin'`,
  `appliesDefinitionId: '<stun buff id>'`. Whether this actually cancels
  the in-progress cast falls out for free from §4.2's step ordering (if
  the applied buff is a hard CC, the immediately-following CC-check
  catches it) — no extra design needed.
- **Counter/follow-up**: a buff on a participant with
  `trigger: 'onImpactLanded'`, `queuesFollowUp: true` — when this
  participant is hit (i.e., their buff pool is scanned during §4.3 step
  2), on a successful `chance` roll they get queued for `ready` right
  after the current actor's `standby` finishes.

**Explicitly out of scope**: actual game content using this effect kind
(which skills/enemies grant a punish-on-cast debuff, what % counter
chance any build gets) — this spec locks the mechanism only, matching
this rework's standing "mechanism first, content later" pattern. No
existing skill/enemy is wired to use `reactiveTrigger` by this spec.

## 7. Headless / Test Compatibility

`presentationActive` defaults to `false`. `CombatScene`'s existing
mount/unmount lifecycle (`subscribeCombatEvents`/`unsubscribeCombatEvents`,
`CombatScene.ts:1148-1166`) is the natural place to flip it true/false —
no new lifecycle concept needed. Every existing `TurnBattleSystem.*.test.ts`
file continues calling `resolveNextStep()`/`resolveActorTurn()` exactly
as today and gets synchronous, instant, single-call behavior — **this
spec requires zero rewrites to any existing test**. Auto-farm (Hoàn Mỹ)
never touches this at all (confirmed with user: it's pure reward-roll
simulation, no `TurnBattleSystem` involvement whatsoever).

## 8. What This Spec Does Not Cover

- Actual VFX/animation authoring for `ready`'s "turn transition" pose,
  or any specific skill's cast animation — those are content/art work,
  this spec only wires the signal contract.
- Camera behavior (focus/pan to the active actor), turn banners,
  hit-stop on crit, or other presentation polish — not raised by the
  user for this spec; can be layered on top of the `turn_ready`/
  `cast_start`/`action_impact` events later without changing this
  spec's contract.
- `reactiveTrigger` content (§6) — mechanism only.
- Extra-turn/revival as a standalone mechanic (distinct from the
  `queuesFollowUp` primitive this spec builds) — still the roadmap's
  standing "future design space" note, unaffected by this spec beyond
  now having a concrete primitive (`queuesFollowUp`) it could reuse if
  designed later.

## 9. Risks / Notes for the Implementation Plan

- `resolveActorTurn()` (Slice 7's already-split method) needs a FURTHER
  split into the 5 phases above — the plan should read Slice 7's actual
  merged code fresh (this spec is written concurrently with Slice 7's
  plan existing but not yet executed — verify execution order/merge
  status before writing the playback plan's tasks).
- `battle.queuedFollowUpActorId` is a new `TurnBattle` field — the plan
  must confirm no existing field name collides.
- The exact method names for Phaser's 3 acknowledgement callbacks
  (`acknowledgeTurnReady`/`acknowledgeActionImpact`/`acknowledgeActionComplete`)
  are this spec's proposal — the plan should confirm where they live
  (`GameManager` methods, mirroring `submitPlayerSkillChoice`'s existing
  pattern from Slice 7) and their exact signatures against real code.
- `CombatScene.ts` is a very large file (2000+ lines per earlier survey
  excerpts) — the plan should scope its CombatScene changes carefully,
  likely as new methods/handlers rather than restructuring the file.
