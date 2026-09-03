# Turn-Based Combat Engine — Design Spec

Date: 2026-09-03
Status: Approved (design), not yet planned/implemented

## 1. Motivation

Combat is currently a real-time auto-battler: `BattleSystem.tick(deltaSeconds)`
drives continuous position movement, projectile travel, cast bars, and
momentum decay. This has grown into the most complex subsystem in the
codebase (`BattleSystem` alone has 60+ external callers, `CombatSystem` has
91), and every new mechanic (Cast Time, Momentum/Break, Projectile
Pierce/Bounce/Homing) has had to solve timing and physics problems on top of
the actual combat design problem.

The user's assessment, confirmed during brainstorming: the game has been
unconsciously converging on turn-based design already (grid positions,
discrete skill resources, phase/enrage triggers). Moving combat to
turn-based removes an entire axis of complexity (continuous time
simulation) while keeping the tactical depth (elemental Reaction Engine,
positioning, boss mechanics). Production/cultivation stays idle and
untouched — this is a combat-only rework.

## 2. Scope

**In scope:** the turn-based combat engine for a single player-controlled
main character vs. a grid of enemies — turn order, targeting/AOE shapes,
resource economy, Reaction Engine integration, boss Phase/Enrage/Summon,
Momentum/Break redesign, and the idle/offline boundary.

**Explicitly out of scope (deferred to a future spec):** the secondary
character/party system (recruit, per-character skills, bậc/phẩm power
scaling). This spec's data model must not block adding N combatants per
side later, but no party recruitment, UI, or content is designed here.

**Migration:** the project is pre-release (dev phase, no live saves to
preserve). This is a big-bang replacement of the real-time combat internals
— no dual-running period, no save-compat shims. Tests tied to the old
time-based mechanics (Cast Time, Momentum decay-by-seconds, projectile
physics) will be rewritten, not preserved.

## 3. Turn Engine — Continuous ATB Gauge

Each `CombatEntity` gets an `actionGauge: number` (range `0..GAUGE_MAX`,
e.g. 1000). Combat resolves in discrete **steps**, not real seconds: each
step, every living entity's gauge increases by `speed * stepRate`. The
first entity to reach `GAUGE_MAX` takes its turn immediately; steps are
resolved as fast as needed to find the next actor — there is no
real-time/animation blocking inside the engine itself. Presentation
(animation pacing, xSpeed) is a layer on top of a result log, not part of
the turn resolution.

**Tie-break:** if multiple entities reach `GAUGE_MAX` in the same step,
higher Speed acts first. If Speed is also equal, fall back to a fixed
order: player > allies (by slot) > enemies (by spawn order).

**Gauge reset:** after acting, an entity's gauge resets to 0 (not
overflow-carry) — simplest to reason about and test.

**Extensibility (required by design, not optional):**
- Effects can grant an **instant gauge refund** (e.g. "+300 gauge on kill").
- Effects can make an action **cost partial gauge** instead of a full
  reset (e.g. "this attack only consumes half your gauge", leaving the
  entity closer to its next turn).
- Both are modeled as gauge deltas applied at the moment of turn
  resolution, not new invariants baked into the queue itself — the queue
  only cares about "whoever has the highest gauge, above max, acts next."

**Delayed/channeled actions (replaces real-time Cast Time):** a skill may
declare `chargeSteps: number`. Choosing it on your turn does not resolve
immediately — the entity is locked into a "casting" state and does not
re-enter the gauge race; when its own `chargeSteps` have elapsed (counted
in the same step clock, so opponents keep acting normally in between) the
skill resolves. A channeling entity **cannot act again or be skipped
early** — it is committed for the charge duration, confirmed as correct by
design (mirrors the old Kiếm Tu channel ult intent, now turn-safe).

## 4. Grid & Targeting

The existing grid (`BattleGrid.ts`: 10 rows × 16 columns, Chebyshev
distance, `getCellsInArea(anchor, laneRadius, columnRadius)`) is reused
as-is — no changes to core grid math.

**Valid targets:** within the same row as the actor, only the **nearest
entity directly ahead** is targetable (cannot target through a blocker).
Across rows, if there is no entity "directly ahead" in a given row, the
**nearest entity overall** (Chebyshev distance) becomes targetable instead.

**AOE Shape** — a skill property, always anchored on the **targeted cell**
(not the actor's own cell):
- `single` — only the target cell.
- `cross` — the target's row + column, radius N.
- `square` — N-radius block around the target (9-cell, 18-cell, etc.) —
  implemented directly via `getCellsInArea(anchor, N, N)`.
- `line` — replaces the old Pierce: a long rectangle along one axis
  (large radius on one axis, 0 on the other) via
  `getCellsInArea(anchor, laneRadius, columnRadius)` with skewed radii.
- `row` / `column` — full-width special cases of `line`.

All shapes route through the existing `getCellsInArea` helper via a
shape-preset → `(laneRadius, columnRadius)` mapping layered on top —
`BattleGrid.ts` itself does not need to change.

**Correction (post-Foundation-plan survey, 2026-09-04):** `MissileSystem`
does not exist in the current codebase — it was already deleted and
replaced by `game/src/core/battle/CombatAction.ts` +
`ActionTargetingSystem.ts` (windup→impact model, already grid-based, no
projectile flight) in a prior "Combat Grid Rework." That system already
has a shape enum (`ActionTargetingShape: 'single' | 'area' | 'line' |
'all_lanes'`) and `areaFor()`/`collectAffected()` helpers used by 68 call
sites. **This spec's AOE shapes above are implemented by extending
`CombatAction.ts`/`ActionTargetingSystem.ts` directly — adding `'cross'`
to the existing shape enum and wiring Bounce/TrueShot into it — not by
building a second, parallel shape system.**

**Bounce (replaces Projectile Bounce):** not an AOE shape — a separate
targeting resolver. From the current target, repeatedly jump to the
nearest living entity within `bounceArea` that hasn't been hit yet in this
chain, up to `bounceCount` times. If no valid entity remains in range, the
chain ends early (not an error).

**TrueShot (replaces Homing):** not a targeting mechanic — a damage flag
on the skill that ignores Dodge/Evasion at resolution. The target must
still be selected through the normal targeting rules above; TrueShot does
not bypass line-of-sight/blocking, only evasion.

## 4.5 Skill Loadout & Manual Input

Each combatant has **5 freely-assignable skill slots**, plus a 6th slot
reserved for the **Ultimate**, which is always the default granted by the
character's path (not player-chosen, not swappable) — this mirrors the
existing "5 element paths each grant a starter skill" pattern, extended
with one more fixed slot on top. 5 + 1 = 6 total equipped skills per
combatant, matching the Loadout concept already in the codebase
([[tienhiep-phap-tu-system]] unified this from 3-slot to 1-slot for the
old real-time system — this spec re-expands it to 6 for turn-based).

**Manual (non-Auto) input:** when it's the player's turn and Auto is off,
the player only **picks which of the 6 equipped skills to use** — they do
**not** pick a target. Targeting is always resolved automatically by the
engine using the rules in Section 4 (nearest-ahead-in-row, else
nearest-overall) and the skill's own AOE shape/bounce/TrueShot properties.
This keeps manual play fast (one tap per turn) and means the AI
action-policy for Auto mode (spec §9) only has to decide *which skill*,
never *which target* — targeting logic is shared and identical between
manual and Auto play, one source of truth.

**Main character vs. other party members (forward-compat note only —
party system itself stays out of scope per Section 2/7):** the main
character's 5 regular slots are freely reassignable by the player at any
time. Any other party member (once that system exists) has a **fixed,
pre-set skill list** the player cannot rearrange — but is still capped at
the same 5-slot + Ultimate structure, so the turn engine and UI never need
to distinguish "main" from "ally" beyond who owns the loadout data.

## 5. Resource Economy, Reaction Engine, Boss Mechanics, Momentum/Break

**Resource regen/decay** (Ngũ Hành Thế, Kiếm Thế/Kiếm Ý, Kim Thế decay,
etc.): all real-time (`deltaSeconds`-based) regen/decay is removed. Every
resource change happens **at the moment an entity's own turn begins**
(when its gauge reaches max and it's about to act) — there is no second
clock running alongside the ATB gauge. E.g. "Kim Thế slow discrete decay"
becomes "-N Kim Thế each time this entity's turn comes up without a proc."

**Reaction Engine (Ngũ Hành Khắc/Sinh):** unchanged in logic — it's
event-triggered (ailment application, hit resolution), not time-based.
Only the call site changes: `ReactionManager` fires synchronously inside
turn/action resolution instead of inside a per-frame `tick()`.

**Boss Phase/Enrage/Summon:** Phase triggers (%HP thresholds) are
unchanged — already checked at damage-resolution time. `enrage.afterSeconds`
becomes `enrage.afterTurns`, counted as **total turns elapsed since battle
start** (not the boss's own turn count) — matches the "clear a wave, next
wave spawns" cadence already discussed. Summon triggers move to the same
`afterTurns` field or stay %HP-gated.

**Momentum/Break (Thể Tu):** momentum gain (+N per landed hit) is already
event-based and needs no change. Decay changes from per-second to: -N
whenever this entity's own turn comes up **without having landed a hit**
since its last turn. Break, once triggered, applies its stun/vulnerability
for **N turns** instead of N seconds.

## 6. Idle/Offline Boundary

Production and cultivation systems are **entirely unchanged** by this
rework — offline calculation, idle reward accrual, etc. remain exactly as
they are today.

**Combat never runs while offline**, full stop. There is no separate
"simplified offline combat formula" — "Auto" is not a distinct reward
system, it is the same turn-based engine with an **AI action-policy**
substituting player input, plus skipped/fast-forwarded presentation
(reviving the old xSpeed toggle concept). Because Auto is the real engine
running faster rather than a parallel simulation, there is only one source
of truth for combat outcomes — no risk of manual-clear and auto-clear
disagreeing. Auto only unlocks for a stage after the player has cleared it
manually at least once, and only runs in the foreground.

## 7. Party Extension Point (not implemented here)

Turn queue, targeting, and grid logic above are designed generically for N
combatants per side from day one — today the player side has exactly one
occupant (the main character). No separate "future-proofing" interface is
needed; adding companions later is a data/UI problem (recruitment, per-slot
skills, bậc/phẩm scaling), not an engine rearchitecture. That system is
explicitly deferred to its own spec.

## 8. What Gets Removed

- Real-time position movement / projectile travel physics.
- Real-time cast bar (`castTime`/`castSpeedPercent` continuous countdown)
  — replaced by `chargeSteps` (Section 3).
- Homing as a distinct mechanic — replaced by TrueShot (damage flag).
- Pierce as a distinct mechanic — replaced by the `line` AOE shape.
- `deltaSeconds`-based resource regen/decay everywhere in combat.
- Any `BattleSystem.tick(deltaSeconds)` semantics tied to wall-clock time.

## 9. Open Items For Implementation Planning

- Exact `GAUGE_MAX` / `stepRate` / speed-stat scaling constants — tuning,
  not architecture; decide during implementation.
- AI action-policy design for Auto mode — out of scope for this spec,
  needs its own short design pass before implementation (what does the
  default policy optimize for: fastest clear, safest clear, resource
  efficiency?).
- Exact list of skills/effects needing conversion from the old
  Momentum/Cast Time/Projectile model to the new one — an implementation
  inventory task, not a design decision.
