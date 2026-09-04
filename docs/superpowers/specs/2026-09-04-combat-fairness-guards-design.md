# Combat Fairness Guards — Bá Thể (CC-lock guard) + Sudden Death (stalemate escalation) — Design Spec

Date: 2026-09-04
Status: Approved (design)

## 1. Motivation

Both mechanics come from the Deep Review session
([roadmap](../../game/docs/turn-based-combat-roadmap.md) — Deep Review
§4 and §6/§8) and were locked with the user in the same short
brainstorm. They are unrelated in code path (one gates the CC-check
step of `resolveActorTurn()`, the other scales damage/heal at the hit
resolution step) but share a theme — both are small, symmetric
**combat fairness/safety guards**, not content. Per explicit user
instruction, they share **one** spec and **one** plan rather than being
split (the earlier per-slice "one plan per system" convention still
holds for actual content/system slices; these two are small enough and
requested together).

## 2. Dependencies (locked)

- **Bá Thể** needs Slice 3's CC-check flow
  (`TurnBuffSystem.isStunned()`/`isFrozen()` gating `resolveActorTurn()`)
  merged first — Slice 3 is 🟡 plan written, not yet executed.
- **Sudden Death** needs Slice 4's `totalTurnsElapsed` counter
  (`TurnBattle.totalTurnsElapsed`) merged first — Slice 4 is 🟡 plan
  written, not yet executed.

This spec/plan is written now (survey/design-ahead-of-time pattern,
same as Slice 7 being designed before Slice 6 merges), but **the
implementation plan cannot be handed to an executor until both Slice 3
and Slice 4 are merged to master.**

## 3. Bá Thể — CC-Lock Guard

### 3.1 Problem

`TurnBuffSystem.isStunned()`/`isFrozen()` (Slice 3) blocks a
participant's action absolutely whenever a `cc:stun`/`cc:freeze`
effect is active, with no limit on how many consecutive turns this can
happen. An attacker with ≥2 overlapping/refreshing hard-CC sources can
lock a target's action indefinitely — no counterplay (Deep Review §4).

### 3.2 Mechanism (locked, 2026-09-04)

New field on `TurnBattleParticipant`: `consecutiveHardCcTurns: number`
(default `0`). Symmetric — every participant (player and enemy alike)
tracks its own counter.

At the CC-check step inside `resolveActorTurn()` (the same point
Slice 3 wires `isStunned()`/`isFrozen()` today):

```
if (actor.buffs.isStunned() || actor.buffs.isFrozen()) {
  if (actor.consecutiveHardCcTurns >= 3) {
    // Bá Thể fires — this is the 4th consecutive blocked turn
    actor.buffs.clearCcEffects()       // removes ALL active cc:stun/cc:freeze
    actor.consecutiveHardCcTurns = 0
    actor.baTheTriggeredAtTurn = battle.totalTurnsElapsed  // marker for future UI/log, not gameplay-affecting
    // fall through to normal action selection this turn — actor acts
  } else {
    actor.consecutiveHardCcTurns += 1
    ccBlocked = true
    // skip action selection this turn (existing Slice 3 behavior)
  }
} else {
  actor.consecutiveHardCcTurns = 0
  // normal action selection
}
```

Threshold semantics: turns 1-3 blocked by CC increment the counter
and block normally (Slice 3's existing behavior, unchanged). On the
**4th** consecutive blocked turn (counter already at 3), Bá Thể fires
instead of blocking again.

### 3.3 Simplification from the original "apply a 1-turn immune buff" framing

The user's original phrasing described Bá Thể as "áp 1 buff 1-lượt...
miễn nhiễm CC cứng mới trong lượt đó." Survey of `resolveActorTurn()`'s
control flow shows **no code path can apply a new CC effect to this
actor between the CC-check and its own action resolving** within the
same call — nothing else touches this actor until its skill resolves.
A full immune-status buff object (requiring either a new `TurnBuffTypes`
effect kind or special-casing `TurnBuffPool`) would carry no gameplay
effect beyond what `clearCcEffects()` + falling through to act already
guarantees. **Design decision: no new buff/effect kind is added.**
`clearCcEffects()` (a new method on `TurnBuffPool`, removing all active
`cc:stun`/`cc:freeze` entries) plus the plain `baTheTriggeredAtTurn?:
number` marker field (for a future UI/battle-log line — Slice 7 will
want to show "Bá Thể!" when this fires, per the Deep Review's approved
turn-order-preview/battle-log additions to Slice 7) is functionally
identical and avoids inventing dead-weight buff infrastructure (YAGNI).
If a future need arises for actual mid-turn CC-immunity (e.g. a
multi-hit skill that could re-apply CC to the same actor within one
resolution), that is a different, currently-nonexistent code path and
out of scope here.

### 3.4 Scope

**In scope:** `consecutiveHardCcTurns` + `baTheTriggeredAtTurn` fields
on `TurnBattleParticipant`; `TurnBuffPool.clearCcEffects()`; the
CC-check branch above wired into `resolveActorTurn()`. Fixture-only
tests (reuse Slice 3's fixture stun/freeze buffs).

**Out of scope:** any UI/battle-log rendering of the "Bá Thể!" moment
(Slice 7's job, once its spec is updated per the Deep Review decision);
soft-CC (slow/silence-style, non-action-blocking effects) — Bá Thể only
guards against action-blocking hard CC (`cc:stun`/`cc:freeze`), nothing
else exists in `TurnBuffTypes.ts` today that blocks actions.

## 4. Sudden Death — Stalemate Escalation

### 4.1 Problem

`TurnBattleSystem.runToCompletion()`'s only stalemate protection is
`DEFAULT_MAX_TURNS = 10_000` (`TurnBattleSystem.ts:65`), silently
resolving to `'defeat'` if reached. A "turtle" build (very high
defense/regen on both sides, low mutual damage) could grind for
thousands of turns before losing with no in-fiction explanation
(Deep Review §6/§8).

### 4.2 Mechanism (locked, 2026-09-04)

Uses `TurnBattle.totalTurnsElapsed` (Slice 4). From turn 11 onward
(i.e. `totalTurnsElapsed > 10`), apply a **linear, additive** escalation,
symmetric for both sides:

- **Damage-dealt multiplier**: `1 + 0.3 × (totalTurnsElapsed - 10)`
  — turn 11: ×1.3, turn 12: ×1.6, turn 15: ×2.5, turn 20: ×4.0, etc.
- **Heal/shield-received multiplier**: `max(0, 1 - 0.3 × (totalTurnsElapsed - 10))`
  — turn 11: ×0.7, turn 12: ×0.4, turn 13: ×0.1, turn 14+: ×0 (floored,
  never negative).

`DEFAULT_MAX_TURNS = 10_000` is **kept unchanged** as the final
technical safety net (in case some future mechanic defeats even Sudden
Death's escalation) — not removed.

### 4.3 Integration point (surveyed, 2026-09-04)

`TurnBattleSystem.ts:115` calls
`this.combat.resolveActionHit(actor.entity, target.entity, action.damage)`,
where `action.damage: ActionDamageInfo` already carries a `multiplier`
field consumed at `CombatSystem.ts:139`
(`effectiveMultiplier = damage.multiplier * getRealmPressureMultiplier(...)`).
**The damage-dealt side of Sudden Death is wired by scaling
`action.damage.multiplier` by the Sudden Death factor before calling
`resolveActionHit()`** — reusing the existing pure helper
`scaleActionDamage(info: ActionDamageInfo, percent: number):
ActionDamageInfo` (`game/src/core/battle/ActionImpactSystem.ts:22-26`,
already handles both the `'physical'|'primordial'` and `'elemental'`
variants of `ActionDamageInfo` correctly, already used elsewhere for
this exact "return a scaled copy" pattern) — call it with
`(suddenDeathMultiplier - 1) * 100` as `percent` (its signature scales
by a percent-of-original, confirm exact semantics against its existing
call sites at plan-writing time) to get a scaled copy of `action.damage`,
pass that copy into `resolveActionHit()` instead of `action.damage`
directly. Zero lines of the live `CombatSystem.ts` touched — only a new
call site in `TurnBattleSystem.ts`. HP subtraction happens **inside**
`resolveActionHit()`
(`CombatSystem.ts:337`, `vitals.applyHpDamageFromSnapshot`) — there is
no "apply damage then scale after" option, the multiplier must go in
before the call.

**The heal/shield-received side has no integration point yet.**
Survey confirms `TurnBattleSystem.ts`/`TurnSkillAction.ts` never call
`CombatSystem.applyHealing()` (`CombatSystem.ts:126`) or apply any
shield/ward mechanic — no heal or shield skill effect exists in the
turn-based engine at all (Slice 3 only wires `dot`+`cc`; heal/shield
would be a new `TurnSkillDefinition`/`TurnBuffTypes` effect kind, not
yet designed). **This spec documents the intended formula (§4.2) but
the heal/shield multiplier has nothing to hook into today** — wiring it
is deferred until a heal/shield mechanism exists in the turn-based
engine (tracked as a follow-up, not blocking this plan's damage-side
task).

### 4.4 Scope

**In scope:** compute the Sudden Death damage multiplier from
`battle.totalTurnsElapsed` inside `TurnBattleSystem`'s resolution step;
scale `action.damage.multiplier` by it before calling
`resolveActionHit()`; applies symmetrically to player and enemy hits.

**Out of scope (deferred, tracked in roadmap):** heal/shield-received
multiplier (§4.3 — no hook exists yet); any UI/warning distinguishing
"Sudden Death active" state (cosmetic, Slice 7's domain if wanted later,
not requested).

## 5. What This Spec Unblocks

Once both land: a hard-CC chain can no longer lock any participant out
past 3 consecutive blocked turns, and a battle can no longer grind
past turn ~14 without either side's healing being fully negated and
damage output already multiplied — both bounded by
`totalTurnsElapsed`, both symmetric, neither touching live real-time
`BattleSystem.ts`/`CombatSystem.ts` beyond reading the already-public
`ActionDamageInfo.multiplier` field.
