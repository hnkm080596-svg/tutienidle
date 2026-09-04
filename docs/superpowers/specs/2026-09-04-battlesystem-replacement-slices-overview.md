# BattleSystem Replacement (Slice 2→7) — Overview Spec

Date: 2026-09-04
Status: Approved (scope + sequencing), each slice still gets its own
detailed spec+plan when its turn comes — this document locks the
decomposition and dependency order, it is not itself an implementation
plan.

## 1. Motivation

Slice 1 (`TurnBattleSystem.ts`, merged to master) proved the ATB core
loop end-to-end but is deliberately minimal: 1 player vs N fixed
enemies, `TurnQueue`/`ActionGauge` turn order, `selectTarget()`
targeting (§4 nearest-in-row-else-Chebyshev), and basic attack only via
`CombatSystem.resolveActionHit()`. No skills, no buffs, no reactions,
no hazard zones, no wave spawning, no UI, and no `GameManager` wiring —
the live `BattleSystem.ts` (~2400 lines, 18-step `update(deltaSeconds)`
pipeline) still drives 100% of real gameplay, untouched.

The roadmap's "Slice 2+" row was intentionally left unscoped
(`🔴 Chưa khảo sát — quyết định sau khi Slice 1 xong`) until Slice 1's
shape was proven. It has now merged, so this document scopes the
remaining path to a full replacement.

## 2. Decomposition Principle

Same pattern as Slice 1: each slice adds ONE coherent slab of real
behavior on top of the previous slice's `TurnBattleSystem`, has its own
spec + TDD plan, and stays headless/standalone (no `GameManager`/UI
wiring) until Slice 6. This means the live game is never at risk of
regression before Slice 6 — up to that point, `TurnBattleSystem` is
purely additive code nobody calls in production.

## 3. Locked Decisions (this session)

### 3.1 Slice order

Skill Loadout → Buff/Reaction/Zone-as-dot → Resource/Momentum/Boss →
Wave/Stage → GameManager Cutover → Manual UI. Rationale: core gameplay
(skills) before supporting systems (buff/resource/boss) before content
pacing (wave) before the risky "flip the switch" cutover, with UI last
since it needs the post-cutover contract to build against.

### 3.2 Slice 2 scope boundary

Slice 2 (Skill Loadout) covers **pure-damage skills only** — no
buff/debuff application. Any skill whose effect requires applying a
buff (burn, poison, slow, etc.) is deferred to Slice 3 once
`TurnBuffSystem` is wired in. This keeps Slice 2 focused on proving
loadout/cooldown/resource-gate/AOE-targeting mechanics without a
half-wired buff dependency.

### 3.3 API shape change (locked, applies from Slice 2 onward)

Slice 1's `TurnBattleSystem.runToCompletion(battle)` runs the entire
battle to completion in one call — adequate for a headless proof, but
incompatible with Slice 5 (wave spawning needs to pause mid-battle to
spawn the next enemy) and Slice 7 (manual UI needs to pause and wait
for player input). **Decision: replace `runToCompletion()` with a
step-oriented API from Slice 2 onward**, not deferred to Slice 5. The
exact shape (e.g. `resolveNextTurn(battle): TurnBattleState` called
repeatedly by the caller, vs. an async/generator model) is a Slice 2
design decision, not fixed here — but the constraint is locked: no
slice after Slice 2 should need to re-architect the run loop's calling
convention again. `runToCompletion()` may be kept as a thin test/dev
convenience wrapper (loop the step API until non-`'fighting'`) since
existing Slice 1 tests use it, but production callers from Slice 6
onward drive the step API directly.

## 4. Slice Breakdown

### Slice 2 — Skill Loadout

**Adds:** 6-slot skill loadout (5 free + slot index 5 reserved for the
`ultimate`-tagged skill, per the already-locked Ultimate-as-loadout-slot
decision), AOE shape targeting via the `ActionTargetingSystem.ts`
extension (already planned:
[2026-09-04-aoe-shape-extension.md](../plans/2026-09-04-aoe-shape-extension.md)),
cooldown-in-turns and resource-cost gating per slot. Pure-damage skills
only (§3.2). Basic attack (Slice 1) remains the fallback action when no
loadout skill is ready.

**Depends on:** Slice 1 (core loop), AOE Shape extension plan.

**PASS criteria:** actor picks a ready loadout skill over basic attack
when available; AOE shape correctly selects the target set per skill
(single/square/cross/row/column/line/all_lanes); cooldown decrements
per turn and gates re-use; resource cost blocks casting when
insufficient; the step-oriented API (§3.3) is in place and Slice 1's
existing tests are ported to it.

**Explicitly deferred:** any skill effect requiring buff/debuff
application (→ Slice 3), channel/`chargeSteps` skills (no channel model
built yet — flagged here as a gap to resolve when Slice 2 is actually
spec'd, not decided in this overview).

### Slice 3 — Buff / Reaction / Zone-as-dot

**Adds:** wires `TurnBuffSystem` (already planned:
[2026-09-04-turn-buff-system.md](../plans/2026-09-04-turn-buff-system.md))
into skill resolution — skills deferred from Slice 2 now apply their
buff/debuff. `ReactionManager`'s reaction table and
`SkillEffectResolver`'s `grantsSwordZone` are converted from
spawning `HazardZoneSystem` zones to applying a `dot` buff via
`TurnBuffSystem`, per the already-locked "HazardZoneSystem reversal"
decision (zones have no positional meaning in turn-based combat).

**Depends on:** Slice 2 (needs a real skill loadout to attach buff
effects to), TurnBuffSystem plan.

**PASS criteria:** elemental skills (burn/poison/etc.) apply the
correct turn-based buff; reaction chains trigger correctly through
`TurnBuffSystem`; former Lava/Sword Zone effects behave as an
equivalent dot buff on the AOE-shape-selected target set at cast time.

**Explicitly deferred:** `TurnBuffSystem`'s not-yet-ported methods
(`getActiveModifiers()`/`isRooted()`/`rollOnHitEffects()`/`getStacks()`)
get ported here if Slice 3's real content needs them — not decided in
this overview, resolved when Slice 3 is spec'd. Buff content migration
(`buffs.ts`, boss enrage buff, equipment/talent passives → 
`TurnBuffDefinition`) and buff duration balance re-tuning are separate,
still-unsurveyed roadmap rows — Slice 3 only needs enough migrated
content to prove the mechanism, not a full content port.

### Slice 4 — Resource / Momentum / Boss

**Adds:** wires the 3 Foundation primitives already built+tested in
Milestone 1 (`ResourceTurnHook.ts`, `MomentumBreak.ts`,
`BossTurnTriggers.ts`) into real call sites inside `TurnBattleSystem` —
Pháp Tu/Kiếm Tu resource gain/decay per turn, Momentum gain/Break
trigger on hit landed (plus the previously-nonexistent decay-on-no-hit
behavior), boss `afterTurns` enrage/summon triggers.

**Depends on:** Slice 2/3 (needs a turn loop with real skills/buffs to
hook resource and momentum gain into).

**PASS criteria:** resource values move correctly turn-over-turn
matching each path's rules; Momentum accumulates on hits and triggers
Break at threshold; Momentum decays when no hit lands; boss enrage
fires at the correct turn count.

### Slice 5 — Wave / Stage

**Adds:** wires `WaveSpawnTrigger` (already planned:
[2026-09-04-wave-spawn-trigger.md](../plans/2026-09-04-wave-spawn-trigger.md))
so `TurnBattleSystem` supports multi-wave stages instead of Slice 1's
fixed enemy list — spawn the next enemy the instant the arena is empty,
using the step-oriented API (§3.3) to pause between waves.

**Depends on:** Slice 1 core loop, WaveSpawnTrigger plan, the step API
from §3.3 (already in place since Slice 2, not a new architecture
change here).

**PASS criteria:** a multi-enemy stage spawns enemies in the correct
sequence as the arena empties; stage-complete is detected correctly;
boss-priority spawn ordering (already time-agnostic in the live file,
reused as-is) is preserved.

### Slice 6 — GameManager Cutover

**Adds:** replaces `GameManager.updateBattleFixedStep`/
`this.battleSystem.update(step)` with the now feature-complete
`TurnBattleSystem`; redesigns the external contract surveyed in
[2026-09-04-gamemanager-external-contract-survey.md](2026-09-04-gamemanager-external-contract-survey.md)
— `startBattle`/`startStage`/`getStageProgress` entry points, the
7 read-only UI call sites (adapt to new state shape), the 3
`KiemTuCombatHud.vue` direct-write call sites (Ultimate button/
`ultAutoEnabled` retire per the locked decision; `setChannelTickSeconds`
resolved as part of this slice's design). Rewrites the ~16
`BattleSystem.*.test.ts` files pinning real-time behavior.

**Depends on:** Slice 2-5 (the engine must have full behavioral parity
with live `BattleSystem.ts` before flipping the switch — this is the
highest-risk slice in the whole rework, since it's the point where live
gameplay actually changes).

**PASS criteria:** every stage/battle flow that currently exercises
`BattleSystem.ts` now runs through `TurnBattleSystem` with no
regression in loot, stage progress, or tribulation flows; old
real-time-pinned tests are fully replaced, not kept dual.

### Slice 7 — Manual UI

**Adds:** a real click/tap handler on `CombatSkillSlot.vue` (currently
100% presentational, confirmed via
[2026-09-04-manual-cast-ui-survey.md](2026-09-04-manual-cast-ui-survey.md));
rewrites `CombatSkillPresentation.ts`'s `deriveState()` for turn-based
state (ready/not-this-entity's-turn/cooldown/locked/etc., replacing the
real-seconds cadence/cooldown model). Includes the Ultimate slot
(index 5) casting the same way as slots 0-4, per the already-locked
"Ultimate is just a tagged skill" decision.

**Depends on:** Slice 6 (needs the post-cutover contract to read
real turn-based state from).

**PASS criteria:** tapping a ready loadout slot casts that skill on the
player's turn; slot visuals correctly reflect ready/cooldown/blocked/
locked states without any real-seconds assumption; Ultimate slot works
identically to a normal slot.

## 5. What This Document Does Not Do

- Does not fix the exact step-API method signature for §3.3 — that is
  Slice 2's own design decision, this document only locks that the
  change happens then (not later) and is not re-architected again.
- Does not resolve the channel/`chargeSteps` skill model, the Bạt Kiếm
  channel-tick slider's turn-based fate, or `setChannelTickSeconds`'s
  replacement — each flagged as an open question for the slice where
  it becomes relevant (Slice 2 for channel skills generally, Slice 6/7
  for the UI-facing slider).
- Does not write any of the 6 slices' detailed TDD plans — each gets
  its own spec+plan when its turn comes, per the roadmap's standing
  "one system at a time" rule.
- Does not change sequencing for roadmap items already correctly
  identified as blocked regardless of this decomposition (Stat System
  conversion stays blocked until Slice 6, since `speed` is read inside
  the turn loop these slices build).
