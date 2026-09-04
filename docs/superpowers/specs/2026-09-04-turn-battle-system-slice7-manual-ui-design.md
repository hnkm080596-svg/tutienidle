# Turn Battle System — Slice 7: Manual UI — Design Spec

Date: 2026-09-04
Status: Approved (design), plan not yet written. **Depends on Slice 6 landing first** (needs the post-cutover `GameManager` contract to build against — per the original overview spec's sequencing).

## 1. Motivation

Nothing before this slice lets the player choose which skill fires on
their own turn — `TurnBattleSystem.resolveNextStep()` (Slices 2-5)
always auto-selects via priority (ultimate → special → basic). This
slice adds a real tap-to-cast UI, reusing `CombatSkillSlot.vue`
(confirmed presentational-only, no click handler) and rewriting
`CombatSkillPresentation.ts`'s `deriveState()` for turn-based state
(the original manual-cast-ui-survey found it 100% real-seconds based).

## 2. Core Architecture Decision: Split `resolveNextStep()` (locked, 2026-09-04)

`resolveNextStep()` currently discovers "who's up next" and "resolves
their action" atomically in one call — `GameManager` has no way to
learn the next actor without also committing their turn. This slice
splits it into 2 methods:

```typescript
peekNextActor(battle: TurnBattle): TurnBattleParticipant | null
```
Runs the same `resolveNextTurn()` gauge-advancement loop Slice 1 built,
but returns the ready actor without resolving anything — this IS the
mutation that finds who's up (gauge state changes are real and stay),
it just stops short of acting.

```typescript
resolveActorTurn(
  battle: TurnBattle,
  actor: TurnBattleParticipant,
  forcedSkillSlot?: 'basic' | 'special' | 'ultimate',
): TurnStepResult
```
Does everything `resolveNextStep()` used to do AFTER finding the actor:
buff tick, resource tick, boss trigger check, CC check, and — new —
action selection either via the existing auto-priority (`forcedSkillSlot`
omitted) or a forced override (`forcedSkillSlot` provided, used only if
that slot is actually ready; per §4, invalid forced choices are
expected to never reach the engine because the UI disables ineligible
buttons, but `selectAction()`'s existing readiness checks apply
regardless as a defensive backstop — an unready forced slot is silently
ignored in favor of the normal priority order, not an error).

`resolveNextStep()` itself becomes a thin wrapper: `peekNextActor()` +
`resolveActorTurn()` with no forced slot, preserving its existing
signature/behavior for every Slice 1-6 caller that doesn't care about
manual pausing (auto mode, `runToCompletion()`, every existing test).

## 3. `GameManager` Manual-Mode Loop

The auto-loop Slice 6 built (fixed-interval `resolveNextStep()` calls)
becomes: call `peekNextActor()` first. If the actor is the player AND
the player is in manual mode AND no choice has been submitted yet for
this actor, stop the loop and wait — the actor's gauge state is already
correctly advanced (that mutation already happened), so resuming later
just calls `resolveActorTurn(battle, actor, chosenSlot)` once the UI
submits a choice. Otherwise (actor is an enemy, or player is in auto
mode, or a choice was already submitted), call `resolveActorTurn()`
immediately with no forced slot (or the submitted one) and continue the
loop. Auto mode never pauses regardless of whose turn it is — matches
the roadmap's standing principle ("Auto là chính engine chạy nhanh
hơn").

## 4. UI: 3 Fixed Buttons, No Target Selection

`CombatSkillSlot.vue` gets a click handler added (currently none exists
by design) wired to 3 fixed instances — basic/special/ultimate — not a
dynamic loadout list, matching the Slice 2 3-skill model. Tapping a
slot only chooses WHICH skill fires; targeting stays fully automatic
per the original design spec §4.5 (unchanged). A slot is only tappable
when: it is currently the player's turn (per `peekNextActor()` having
returned the player and the game paused waiting), manual mode is on,
and that skill is off cooldown and resource-affordable — an ineligible
slot is disabled, not tappable-and-rejected (locked decision, this
session).

`CombatSkillPresentation.ts`'s `deriveState()` is rewritten for a
turn-based `CombatSkillPresentationStateKind` — replacing the old
real-seconds-based `'ready' | 'cadence' | 'cooldown' | 'casting' |
'blocked_resource' | 'out_of_range' | 'locked' | 'empty' | 'unreleased'`
union. The turn-based union drops `'cadence'`/`'casting'`/`'out_of_range'`
(real-time-only concepts with no turn-based equivalent — cadence
collapses into the ATB gauge itself, casting/cast-time isn't built,
targeting is never player-facing) and adds `'not_your_turn'` (skill
would be usable but it isn't currently the player's paused turn):
`'ready' | 'not_your_turn' | 'cooldown' | 'blocked_resource' | 'locked' | 'empty'`.
`'cooldown'`'s displayed value is `remainingCooldownTurns` (an integer
turn count), not a seconds countdown — `CombatSkillSlot.vue`'s existing
`remaining`/`total` props are unit-agnostic ratio math (already
confirmed reusable as-is by the original survey), so this is a data
sourcing change, not a component change.

Ultimate (slot role `'ultimate'`) uses the exact same tap flow as
basic/special — no separate button, no auto-toggle, matching the
already-locked "Ultimate is just a tagged skill role" decision.
`KiemTuCombatHud.vue`'s old Ult button/`ultAutoEnabled` toggle (already
retired by Slice 6) stay retired; this slice does not reintroduce them.

## 5. Scope

**In scope:**
- `TurnBattleSystem.peekNextActor()`/`resolveActorTurn()` split (§2),
  `resolveNextStep()` becomes a thin wrapper over both.
- `GameManager`'s auto-loop (Slice 6) gains the pause-on-player-turn
  check (§3) and a way for UI to submit a chosen slot for the paused
  actor.
- `CombatSkillSlot.vue` click handler, wired to exactly 3 fixed slots
  (basic/special/ultimate).
- `CombatSkillPresentation.ts`'s `deriveState()` rewritten for the
  turn-based state union (§4).
- A manual/auto mode toggle (the actual UI control — exact placement/
  visual not designed here, functional requirement only: player can
  switch modes, matching this rework's standing "Auto = same engine,
  faster" principle, not a separate simulation).

**Explicitly out of scope (deferred, tracked in roadmap):**
- Any change to targeting — always automatic, never player-facing (per
  the original design spec §4.5, unchanged).
- Channel skill manual casting — channel execution policy still doesn't
  exist in the turn-based engine (known gap since Slice 2/confirmed
  regression at Slice 6's flip); nothing to wire here for it.
- Redesigning the Bạt Kiếm channel-tick slider — still unresolved from
  the original GameManager contract survey, not decided by this slice.

## 6. What This Slice Proves

A player can pause on their own turn, see 3 skill slots reflecting real
turn-based readiness (cooldown-in-turns, resource affordability,
whose-turn-is-it), tap one to cast it, and the engine correctly resumes
using that exact choice instead of its own auto-priority — while auto
mode continues to never pause, exercising the exact same underlying
`resolveActorTurn()` path either way.
