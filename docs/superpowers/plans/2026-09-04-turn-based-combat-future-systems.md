# Turn-Based Combat — Future Systems (Node Tree, Reaction Path, Gauge-Delta, Channel Skill, Party) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the 5 systems locked in the Future Systems design spec: Node Tree's 3-skill-shaped redesign, the Pháp Tu Reaction Path (hidden path), a new gauge-delta buff effect, Channel Skill support (Bạt Kiếm Thuật's Thế/Trảm split), and the Party/companion structural migration.

**Architecture:** 5 phases, one per system, in the order already brainstormed (Node Tree → Reaction Path → Gauge-Delta → Channel → Party). Phase A (Node Tree) is pure content/data work with zero engine changes. Phases B-E all touch `TurnBattleSystem.ts` and are explicitly gated behind two other in-flight plans finishing first (see Global Constraints) — do not start Phase B until that gate clears, even though this plan can be assigned/read in full immediately.

**Tech Stack:** TypeScript, Vitest, Vue 3.

**Spec:** `docs/superpowers/specs/2026-09-04-turn-based-combat-future-systems-design.md`

## Global Constraints

- **Hard gate on Phases B-E (not Phase A)**: `docs/superpowers/plans/2026-09-04-combat-fairness-guards.md`
  and `docs/superpowers/plans/2026-09-04-turn-based-combat-completion.md`
  are both actively being executed against `game/src/core/battle/turn/TurnBattleSystem.ts`
  concurrently as this plan is written. **Before starting Task 4 (the
  first task touching `TurnBattleSystem.ts`), confirm both of those
  plans are fully merged to master** — re-read the real current file
  first regardless, since this plan's code snippets are written
  against a snapshot taken 2026-09-04 (Combat Fairness Guards' Task 1+2
  already merged at snapshot time: `consecutiveHardCcTurns`/
  `baTheTriggeredAtTurn`/`scaleActionDamage` Sudden Death wiring are
  all already present; Completion plan's Task 1 multi-target hardening
  was NOT yet present at snapshot time — check whether it's landed
  before writing Task 8's diff below, the exact insertion line may
  shift by a few lines either way).
- No `any` types.
- No rebalance beyond what's explicitly specified (Node Tree's 5→3
  chain redesign is content work with real balance implications —
  that's expected and approved, not an accidental rebalance).
- Do not touch Party/companion recruitment, UI, or content — Phase E
  is engine-structure only (per spec §6.2).
- Do not implement anything for the live real-time `BattleSystem.ts` —
  every phase here targets `TurnBattleSystem.ts`/`TurnBuffTypes.ts`/
  progression data files only.
- Run `npx vitest run` and `npx vue-tsc --noEmit` after every task.

---

# Phase A — Node Tree Redesign (no dependencies, no engine changes)

### Task 1: Redesign each element's skill chain from 5 to 3 skills

**Files:**
- Modify: `game/src/data/skill/Skills.ts` (the `CHAIN_SKILL_IDS` constant, `Skills.ts:2287-2293`)
- Test: wherever `CHAIN_SKILL_IDS`/`getPhapTuThuanElement` already has test coverage (search for its test file before assuming one exists)

- [ ] **Step 1: Read the current 5-skill chains in full**

Read `Skills.ts:2287-2293` (`CHAIN_SKILL_IDS`) and the 5 skill entries
it references per element (Hỏa: `hoa_cau_thuat, nam_minh_liet_hoa,
tam_muoi_chan_hoa, chuc_dung_dan_no, hoa_ha_cuu_thien` — confirmed this
session; the other 4 elements' chains need the same read).

- [ ] **Step 2: Decide which 3 of 5 abilities survive per element (or redesign)**

Per spec §2.2, this is real content work — for each element, choose 3
of the 5 existing skills to keep as basic/special/ultimate (simplest:
keep positions A/C/E or A/B/E — pick a consistent rule across all 5
elements for symmetry, e.g. "1st chain skill = basic (no cooldown
already, matches basic's requirement), 3rd = special, 5th = ultimate")
or write 3 new abilities from scratch if the existing 5 don't cleanly
split into a no-cooldown-basic + 2 cooldown-gated tiers. Document the
final mapping table (5 elements × 3 roles) in this task's commit
message.

- [ ] **Step 3: Update `CHAIN_SKILL_IDS` to the new 3-entry shape**

```typescript
export const CHAIN_SKILL_IDS: Record<ElementType, [string, string, string]> = {
  fire: ['hoa_cau_thuat', /* chosen special */, /* chosen ultimate */],
  // ... 4 more elements, same 3-tuple shape
}
```

(Adjust the exact type/element keys to match the real current
`ElementType` union and whatever the constant's real current type
signature is — read it before editing, do not assume the shape above
is exact.)

- [ ] **Step 4: Update every call site consuming `CHAIN_SKILL_IDS` as a 5-tuple**

Grep for `CHAIN_SKILL_IDS` usage — any code indexing `[3]`/`[4]` or
iterating assuming 5 entries needs updating to the new 3-entry shape.

- [ ] **Step 5: Run tests, typecheck, commit**

```bash
git add game/src/data/skill/Skills.ts
git commit -m "feat(node-tree): redesign 5-skill element chains down to 3 (basic/special/ultimate)"
```

---

### Task 2: Keystone Reaction side unlocks the hidden Reaction Path instead of in-tree specializations

**Files:**
- Modify: `game/src/data/progression/PhapTuNodes.ts` (`buildBranch()`, `PhapTuNodes.ts:111-254`)
- Modify: `game/src/core/progression/ProgressionNode.ts` (only if `NodeEffect` needs a new field — check first whether `unlocksSkillIds` is already sufficient to express "unlock Reaction Path's special/ultimate skill ids", which it likely is)
- Test: `PhapTuNodes.test.ts` or equivalent (check for existing coverage first)

- [ ] **Step 1: Read the current keystone + specialization node definitions**

Read `PhapTuNodes.ts:111-254` in full — the existing Reaction-side
specialization nodes (2-3 per element per the earlier survey) are what
this task replaces.

- [ ] **Step 2: Replace Reaction-side specializations with a single unlock node**

Remove the Reaction keystone's specialization children; add instead a
single node (still `role: 'keystone'` or a new minimal `role:
'specialization'` node directly under the Reaction keystone) whose
`effect.unlocksSkillIds` points at Phase B's Reaction Path
special/ultimate skill ids (Task 4 defines the real ids — if Task 2 is
executed before Task 4, use placeholder ids matching Task 4's naming
convention, e.g. `phap_tu_reaction_special`/`phap_tu_reaction_ultimate`,
and verify they match exactly once Task 4 lands).

- [ ] **Step 3: Write/update tests proving the Pure side is unaffected and the Reaction side now grants the Reaction Path skill ids**

- [ ] **Step 4: Run tests, typecheck, commit**

```bash
git add game/src/data/progression/PhapTuNodes.ts
git commit -m "feat(node-tree): Reaction keystone now unlocks the hidden Reaction Path instead of in-tree specializations"
```

---

### Task 3: Repurpose the "cadence" growth node to speed/dexterity

**Files:**
- Modify: `game/src/data/progression/PhapTuNodes.ts`
- Test: same file as Task 2's tests

- [ ] **Step 1: Find the cadence growth node's current `effect.statModifiers`**

Read the growth node in `buildBranch()` currently targeting the
real-time cadence stat (likely `attackSpeed`-adjacent before the Stat
System rename — verify it wasn't already silently broken by that
rename, since `attackSpeed` no longer exists as a `StatType`).

- [ ] **Step 2: Change its `statModifiers` target to `speed` or `dexterity`**

```typescript
statModifiers: [{ stat: 'speed', flat: /* same per-level value already there, or dexterity per spec's alternate framing — pick speed since that's what the spec text names */ }]
```

(Verify the real `StatModifier` shape — `stat`/`flat`/`percent` field
names — against `StatCalculator.ts` before finalizing, same as every
other stat-touching task this session.)

- [ ] **Step 3: Run tests, typecheck, commit**

```bash
git add game/src/data/progression/PhapTuNodes.ts
git commit -m "feat(node-tree): cadence growth node now grants speed instead of retired real-time cadence stat"
```

---

# Phase B — Pháp Tu Reaction Path (gated — see Global Constraints)

### Task 4: Define the Reaction Path's basic/special/ultimate `TurnSkillDefinition`s + random-2-distinct-element selection

**Files:**
- Create: `game/src/data/skill/TurnReactionPathSkills.ts`
- Modify: `game/src/core/battle/turn/TurnSkillAction.ts`
- Test: `game/src/data/skill/TurnReactionPathSkills.test.ts`
- Test: `game/src/core/battle/turn/TurnSkillAction.test.ts`

**Interfaces:**
- Consumes: `TurnSkillDefinition` (`TurnSkillAction.ts:22-30`, current shape confirmed this session).
- Produces: `selectRandomDistinctElementPair(pool: TurnSkillDefinition[]): [TurnSkillDefinition, TurnSkillDefinition]` — consumed by Task 5.

- [ ] **Step 1: Write the failing test for random-distinct-pair selection**

```typescript
// TurnSkillAction.test.ts addition
describe('selectRandomDistinctElementPair', () => {
  it('always returns 2 different skill ids from the pool', () => {
    const pool: TurnSkillDefinition[] = [
      { id: 'fire_bolt', cooldownTurns: 0, damage: { kind: 'elemental', components: [{ kind: 'element', element: 'fire', ratio: 1 }], multiplier: 1 }, targeting: { shape: 'single' } },
      { id: 'water_bolt', cooldownTurns: 0, damage: { kind: 'elemental', components: [{ kind: 'element', element: 'water', ratio: 1 }], multiplier: 1 }, targeting: { shape: 'single' } },
      { id: 'wood_bolt', cooldownTurns: 0, damage: { kind: 'elemental', components: [{ kind: 'element', element: 'wood', ratio: 1 }], multiplier: 1 }, targeting: { shape: 'single' } },
    ]

    for (let i = 0; i < 50; i++) {
      const [a, b] = selectRandomDistinctElementPair(pool)
      expect(a.id).not.toBe(b.id)
      expect(pool).toContain(a)
      expect(pool).toContain(b)
    }
  })

  it('throws if the pool has fewer than 2 entries', () => {
    expect(() => selectRandomDistinctElementPair([/* single entry */])).toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run game/src/core/battle/turn/TurnSkillAction.test.ts`
Expected: FAIL — function doesn't exist.

- [ ] **Step 3: Implement the selector**

```typescript
export function selectRandomDistinctElementPair(pool: TurnSkillDefinition[]): [TurnSkillDefinition, TurnSkillDefinition] {
  if (pool.length < 2) {
    throw new Error('selectRandomDistinctElementPair requires at least 2 skills in the pool')
  }

  const shuffled = [...pool].sort(() => Math.random() - 0.5)

  return [shuffled[0]!, shuffled[1]!]
}
```

- [ ] **Step 4: Define the Reaction Path's real skill content**

Create `TurnReactionPathSkills.ts` exporting:
- A pool of single-element `TurnSkillDefinition`s (one per unlocked
  element — 5 max, reusing the SAME elemental damage components each
  element's real basic attack uses, per Task 1's redesigned chains, so
  Reaction Path doesn't need entirely separate elemental damage data).
- `phap_tu_reaction_special: TurnSkillDefinition` — a marker
  definition (its own `damage`/`targeting` fields are placeholders,
  never directly resolved — Task 5 intercepts this specific id and
  substitutes 2 real pool picks instead of resolving it directly).
- `phap_tu_reaction_ultimate: TurnSkillDefinition` — `appliesBuff`
  pointing at a new `TurnBuffDefinition` (define alongside, e.g.
  `reaction_empowerment`, `effects: [{type: 'statModifier', stat:
  ???, percent: ???}]` — the exact stat/percent for "boosts reaction
  damage" needs a real hook once Completion plan's Item F/G land
  (dpsRatio real content + stats recompute); until then this is a
  structurally-correct but functionally-inert buff, matching this
  session's established pattern of building mechanism ahead of content).

- [ ] **Step 5: Run tests, typecheck, commit**

```bash
git add game/src/data/skill/TurnReactionPathSkills.ts game/src/data/skill/TurnReactionPathSkills.test.ts game/src/core/battle/turn/TurnSkillAction.ts game/src/core/battle/turn/TurnSkillAction.test.ts
git commit -m "feat(reaction-path): random-distinct-element-pair selector + Reaction Path skill content"
```

---

### Task 5: Wire the double-cast into `resolveNextStep()`'s special resolution

**Files:**
- Modify: `game/src/core/battle/turn/TurnBattleSystem.ts`
- Test: `game/src/core/battle/turn/TurnBattleSystem.test.ts`

**Interfaces:**
- Consumes: `selectRandomDistinctElementPair()` (Task 4), the existing hit-resolution loop (read the REAL current file per the Global Constraints gate before writing this diff).
- Produces: nothing consumed by a later task.

**Known limitation, stated honestly**: this task makes the special
role fire 2 real, separate `resolveActionHit()` calls against the
target sequentially — it does NOT yet make those two hits actually
check for/trigger an elemental reaction (that requires
`ReactionManager`'s turn-based conversion, scoped as Item F in
`docs/superpowers/plans/2026-09-04-turn-based-combat-completion.md`,
not yet executed). This task proves the "2 distinct elements fire"
mechanism only — reaction-triggering payoff activates automatically
once Completion's Item F lands and reads the same `TurnBuffPool`
debuffs this task's hits apply, no further change needed here at that
point.

- [ ] **Step 1: Write the failing test**

```typescript
describe('TurnBattleSystem special role — Reaction Path double-cast', () => {
  it("fires 2 separate resolveActionHit calls with different elements when the actor's special is the Reaction Path marker skill", () => {
    // Set up a player participant whose `special` slot's skill id is
    // 'phap_tu_reaction_special', with a resolution pool of >=2 fixture
    // elemental skills injected via whatever mechanism Task 4's real
    // TurnReactionPathSkills.ts exposes for lookup (a registry/map
    // parameter — design this at implementation time based on Task 4's
    // real exports; a constructor-injected pool map is the simplest
    // shape, mirroring the existing `registry?: TurnBuffRegistry`
    // constructor pattern already used for buffs).
    // Assert: after resolveNextStep() picks 'special', targetIds has
    // exactly 2 entries pushed (both hits against the same target,
    // since this is a single-target special) OR the resolveActionHit
    // spy was called exactly twice with different damage.components[0].element.
  })
})
```

(This test's exact fixture setup depends on how Task 4's pool gets
injected into `TurnBattleSystem` — resolve that design question
concretely at implementation time, it is a real open decision this
plan intentionally leaves for the executor since it depends on Task
4's final real shape.)

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Special-case the marker skill id in the hit-resolution branch**

In `resolveNextStep()`, after `selectAction(actor)` returns (which
still just returns whatever `TurnSkillSlot` priority-selection already
picked — `phap_tu_reaction_special` if that's what's equipped), branch
before the normal single-hit loop:

```typescript
      if (primaryTarget) {
        const affected = collectTurnTargets(primaryTarget, opposingSide, action.targeting)

        if (action.skillId === 'phap_tu_reaction_special' && this.reactionPathPool) {
          const [first, second] = selectRandomDistinctElementPair(this.reactionPathPool)

          for (const pickedSkill of [first, second]) {
            for (const target of affected) {
              this.combat.resolveActionHit(actor.entity, target.entity, pickedSkill.damage)
              targetIds.push(target.id)
            }
          }
        } else {
          // existing single-hit loop, unchanged
        }

        commitAction(actor.entity, action)
        // existing appliesBuff block, unchanged
      }
```

(Add a `reactionPathPool?: TurnSkillDefinition[]` constructor
parameter to `TurnBattleSystem`, matching the existing optional-param
pattern already used for `registry`/`spawnEnemy`.)

- [ ] **Step 4: Run tests, typecheck, commit**

```bash
git add game/src/core/battle/turn/TurnBattleSystem.ts game/src/core/battle/turn/TurnBattleSystem.test.ts
git commit -m "feat(reaction-path): special role double-casts 2 random distinct elements"
```

---

# Phase C — Gauge-Delta Buff Effect (gated — see Global Constraints)

### Task 6: `TurnGaugeDeltaEffect` type + one-shot application via existing `refundGauge()`

**Files:**
- Modify: `game/src/core/battle/turn/TurnBuffTypes.ts`
- Modify: `game/src/core/battle/turn/TurnBattleSystem.ts`
- Test: `game/src/core/battle/turn/TurnBattleSystem.test.ts`

**Interfaces:**
- Consumes: `refundGauge(actor: GaugeActor, amount: number): void` (`ActionGauge.ts:40-42`, already exists — confirmed this session it already clamps `[0, GAUGE_MAX]` and already accepts negative `amount` correctly since `Math.max(0, current + amount)` handles subtraction fine).
- Produces: nothing consumed by a later task.

- [ ] **Step 1: Add the effect type**

In `TurnBuffTypes.ts`, add to both the template and runtime effect
unions (it needs no separate runtime shape since it carries no
per-turn state, unlike `dot`):

```typescript
export interface TurnGaugeDeltaEffect {
  type: 'gaugeDelta'
  percentOfMax: number // signed: positive = Haste (advance), negative = Slow (delay)
}

export type TurnBuffEffectTemplate =
  | TurnStatModifierEffect
  | TurnDotEffectTemplate
  | TurnCcEffect
  | TurnOnHitProcEffect
  | TurnGaugeDeltaEffect

export type TurnBuffEffect = TurnStatModifierEffect | TurnDotEffect | TurnCcEffect | TurnOnHitProcEffect | TurnGaugeDeltaEffect
```

- [ ] **Step 2: Write the failing test**

```typescript
import { GAUGE_MAX } from './ActionGauge'

const HASTE_DEFINITION: TurnBuffDefinition = {
  id: 'fixture_haste',
  name: 'Fixture Haste',
  polarity: 'buff',
  duration: 1,
  stackMode: 'refresh',
  effects: [{ type: 'gaugeDelta', percentOfMax: 30 }],
}

describe('TurnBattleSystem gauge-delta buff (one-shot)', () => {
  it('advances actionGauge by percentOfMax once when the buff is applied via appliesBuff', () => {
    // Set up a player with a basic skill that has
    // appliesBuff: { definitionId: 'fixture_haste', target: 'self' },
    // an enemy target, run resolveNextStep(), and assert
    // playerParticipant.actionGauge increased by GAUGE_MAX * 0.30
    // relative to what consumeGaugeAfterAction() alone would have left
    // it at (0, since a normal action fully consumes gauge) — so the
    // expected final actionGauge is exactly GAUGE_MAX * 0.30, not 0.
  })

  it('clamps to GAUGE_MAX, never overshooting', () => {
    // Same setup with a much larger percentOfMax (e.g. 500) — assert
    // actionGauge caps at GAUGE_MAX exactly.
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

- [ ] **Step 4: Wire the one-shot application at the `appliesBuff` call site**

In `resolveNextStep()`'s existing `appliesBuff` block (the one added by
Slice 3, still present per the file read this session), after each
`new TurnBuffSystem(...).apply(definition, ...)` call, add:

```typescript
        for (const effect of definition.effects) {
          if (effect.type === 'gaugeDelta') {
            const targetParticipant = /* whichever participant object (actor or target) this specific apply() call just targeted */
            refundGauge(targetParticipant, GAUGE_MAX * (effect.percentOfMax / 100))
          }
        }
```

(Apply this inside BOTH branches of the existing `if (target === 'self') {...} else {...}` structure, using the correct participant reference for each — `actor` for the self branch, the loop's `target` for the other. Import `refundGauge`/`GAUGE_MAX` from `./ActionGauge` at the top of the file.)

- [ ] **Step 5: Run tests, typecheck, commit**

```bash
git add game/src/core/battle/turn/TurnBuffTypes.ts game/src/core/battle/turn/TurnBattleSystem.ts game/src/core/battle/turn/TurnBattleSystem.test.ts
git commit -m "feat(turn-combat): gauge-delta buff effect — one-shot ATB push via existing refundGauge()"
```

---

# Phase D — Channel Skill Support (gated — see Global Constraints)

### Task 7: "Thế"/"Trảm" resource-gated skills + the `chargingTurnsRemaining` primitive

**Files:**
- Modify: `game/src/core/battle/turn/TurnSkillAction.ts` (add `chargeTurns?: number` to `TurnSkillDefinition`)
- Modify: `game/src/core/battle/turn/TurnBattleSystem.ts` (add `chargingTurnsRemaining?: number` to `TurnBattleParticipant`, wire the charge branch)
- Test: `game/src/core/battle/turn/TurnBattleSystem.test.ts`

**Interfaces:**
- Consumes: `TurnResourcePool`/`applyTurnStartDeltas` (Slice 4, merged) for Thế's resource accumulation.
- Produces: `TurnBattleParticipant.chargingTurnsRemaining?: number`, `TurnSkillDefinition.chargeTurns?: number` — self-contained, nothing consumed by a later task in this plan.

- [ ] **Step 1: Add `chargeTurns` to `TurnSkillDefinition`**

```typescript
export interface TurnSkillDefinition {
  id: string
  cooldownTurns: number
  resourceType?: SkillResourceType
  resourceCost?: number
  damage: ActionDamageInfo
  targeting: ActionTargeting
  appliesBuff?: { definitionId: string; target: 'self' | 'target' }
  chargeTurns?: number
}
```

- [ ] **Step 2: Add `chargingTurnsRemaining` to `TurnBattleParticipant`**

```typescript
export interface TurnBattleParticipant {
  // ...existing fields unchanged...
  chargingTurnsRemaining?: number
  pendingChargedSkillId?: string
}
```

- [ ] **Step 3: Write the failing tests**

```typescript
describe('TurnBattleSystem charge skill (Thế/Trảm)', () => {
  it('casting a chargeTurns skill blocks the next (chargeTurns) turns without touching consecutiveHardCcTurns', () => {
    // playerParticipant.special = { id: 'tram', cooldownTurns: 0, chargeTurns: 2, damage: {...}, targeting: {shape: 'single'} }
    // Force special to be selected (e.g. no ultimate, basic on cooldown, or however selectAction's priority is triggered in existing tests).
    // After the casting step: expect(playerParticipant.chargingTurnsRemaining).toBe(2), expect(step.targetIds).toEqual([]) (no hit yet).
    // After 1 more of the player's own turns: chargingTurnsRemaining === 1, still no hit, consecutiveHardCcTurns stays 0.
    // After the charge completes: the skill's real damage resolves THIS turn, targetIds has the real hit, chargingTurnsRemaining is gone/0.
  })

  it('a charging actor is immune to Bá Thể-style CC-lock counting even if independently hard-CC\'d by an enemy mid-charge', () => {
    // Apply a hard-CC buff to the charging actor during its charge window;
    // assert consecutiveHardCcTurns does NOT increment on charging turns
    // (design decision: charging and CC are independent states, charging
    // takes precedence — actor is already immobile either way, no double
    // penalty).
  })
})
```

- [ ] **Step 4: Run tests to verify they fail**

- [ ] **Step 5: Wire the charge branch**

In `resolveNextStep()`, insert a new branch BEFORE the existing
`hardCcActive` CC-check block (charging takes precedence — a charging
actor never processes the normal CC-lock counter):

```typescript
    if (actor.chargingTurnsRemaining !== undefined && actor.chargingTurnsRemaining > 0) {
      actor.chargingTurnsRemaining -= 1

      if (actor.chargingTurnsRemaining === 0) {
        // Charge complete — resolve the pending skill's real hit this turn.
        const chargedSkillId = actor.pendingChargedSkillId
        const chargedSkill = actor.special?.skill.id === chargedSkillId ? actor.special.skill
          : actor.ultimate?.skill.id === chargedSkillId ? actor.ultimate.skill
          : undefined

        actor.pendingChargedSkillId = undefined

        if (chargedSkill) {
          const opposingSide = actor === battle.player ? battle.enemies : [battle.player]
          const primaryTarget = selectTarget(actor, opposingSide)

          if (primaryTarget) {
            const affected = collectTurnTargets(primaryTarget, opposingSide, chargedSkill.targeting)

            for (const target of affected) {
              this.combat.resolveActionHit(actor.entity, target.entity, chargedSkill.damage)
              targetIds.push(target.id)
            }
          }
        }
      }

      consumeGaugeAfterAction(actor)
      // ... existing wave-spawn/win-condition tail logic still runs ...
      return { state: battle.state, actorId: actor.id, skillId: chargedSkillId ?? '', targetIds, ccBlocked: false }
    }
```

(This is a structural sketch — the exact insertion point/early-return
shape needs to be reconciled against the REAL current
`resolveNextStep()` body at execution time, particularly the
wave-spawn and win-condition tail logic which must still run on the
charge-completion turn. Do not skip that tail logic — copy it into
this branch or restructure the function so both paths share it, per
the executor's judgment matching the existing code's style.)

- [ ] **Step 6: Wire charge INITIATION when a `chargeTurns` skill is selected**

In the normal action-resolution branch, when `selectAction()` returns
an action whose skill has `chargeTurns` set, don't resolve it
immediately — instead set `actor.chargingTurnsRemaining =
action.skill.chargeTurns` and `actor.pendingChargedSkillId =
action.skillId`, skip the hit-resolution loop for this turn (the skill
fires later, per Step 5).

- [ ] **Step 7: Run tests, typecheck, commit**

```bash
git add game/src/core/battle/turn/TurnSkillAction.ts game/src/core/battle/turn/TurnBattleSystem.ts game/src/core/battle/turn/TurnBattleSystem.test.ts
git commit -m "feat(channel-skill): chargingTurnsRemaining primitive — Thế/Trảm charge-and-release"
```

---

### Task 8: Kiếm Tu real content — "Thế" (basic, resource-building) + "Trảm" (special, resource-gated + charge)

**Files:**
- Create/modify: wherever Kiếm Tu's real skill content lives (`game/src/data/skill/Skills.ts` or a Kiếm Tu-specific file — check Task 1's survey findings for the real Kiếm Tu basic id `tram` before creating a new file).
- Test: corresponding test file.

- [ ] **Step 1: Define "Thế" as Kiếm Tu's `basic`**

A `TurnSkillDefinition` with `resourceType`/`resourceCost` unset (basic
never costs resource per the 3-skill model) but which, when resolved,
also feeds the existing Kiếm Tu resource pool via
`ResourceTurnHook`-compatible deltas (Slice 4's mechanism) — or, if
resource gain is on-cast rather than per-turn-tick, this needs a small
new hook at the hit-resolution point specifically for Thế (read
`ResourceTurnHook.ts`'s real shape before deciding which mechanism
fits; per-turn-tick resource gain doesn't naturally represent
"gain resource FROM CASTING Thế" — this may need
`consumeResourceFor`'s inverse, a `grantResourceFor`, as a new small
function in `TurnSkillAction.ts`).

- [ ] **Step 2: Define "Trảm" as Kiếm Tu's `special`**

`resourceType`/`resourceCost` gated on Thế's resource pool reaching a
real cap value (content decision — pick a real number matching
whatever the live Kiếm Ý/Kiếm Thế cap is, per the Completion plan's
Item A survey of real resource content if that's landed by now; if
not, use a placeholder cap and flag it for a follow-up content pass),
`chargeTurns` set (content decision — pick a real number, e.g. 2-3
turns, matching the live channel skill's rough real-time channel
duration converted to turns per the "no rebalance" policy where
possible).

- [ ] **Step 3: Run tests, typecheck, commit**

```bash
git commit -m "feat(channel-skill): Kiếm Tu real content — Thế (basic) + Trảm (special, charge+resource-gated)"
```

---

# Phase E — Party Structural Migration (gated — see Global Constraints)

### Task 9: `TurnBattle.player` (singular) → `players: TurnBattleParticipant[]`

**Files:**
- Modify: `game/src/core/battle/turn/TurnBattleSystem.ts` (every `battle.player` reference)
- Modify: `game/src/core/battle/turn/TurnSkillAction.ts` (if it references `battle.player` anywhere — check)
- Modify: every test file under `game/src/core/battle/turn/` constructing a `TurnBattle` literal (`player: ...` → `players: [...]`)
- Test: `game/src/core/battle/turn/TurnBattleSystem.party.test.ts` (new file, party-specific cases)

**Interfaces:**
- Consumes: nothing new.
- Produces: `TurnBattle.players: TurnBattleParticipant[]` — this is the plan's final structural change, nothing downstream in THIS plan consumes it, but every future slice/system built after this point must use the array form.

**This is explicitly the largest, riskiest task in this plan** (per the
design spec §7's honest framing) — budget real time for it, do not
rush.

- [ ] **Step 1: Read the REAL current `TurnBattleSystem.ts` in full**

Every phase before this one (B/C/D) may have added new `battle.player`
references of their own — re-read the file fresh at this exact point,
do not rely on this plan's earlier task snippets as the source of
truth for what needs changing.

- [ ] **Step 2: Change the type**

```typescript
export interface TurnBattle {
  players: TurnBattleParticipant[]
  enemies: TurnBattleParticipant[]
  state: TurnBattleState
  totalTurnsElapsed?: number
  wave?: { totalEnemyCount: number; spawnedCount: number }
}
```

- [ ] **Step 3: Update `resolveNextStep()`'s participant collection**

```typescript
    const allParticipants = [...battle.players, ...battle.enemies]
```

- [ ] **Step 4: Update the `opposingSide` selection**

```typescript
      const opposingSide = battle.players.includes(actor) ? battle.enemies : battle.players
```

(Replace every `actor === battle.player ? battle.enemies : [battle.player]`
occurrence — there may be more than one, per Phase D's Task 7 charge
branch potentially duplicating this logic; grep for the pattern across
the whole file before editing.)

- [ ] **Step 5: Update win/defeat conditions**

```typescript
    if (battle.players.every((p) => !p.entity.alive)) {
      battle.state = 'defeat'
    } else if (
      battle.wave
        ? isStageComplete(battle.wave.spawnedCount, battle.wave.totalEnemyCount, finalAliveEnemyCount)
        : battle.enemies.every((enemy) => !enemy.entity.alive)
    ) {
      battle.state = 'victory'
    }
```

- [ ] **Step 6: Write failing tests for multi-player-unit battles**

```typescript
describe('TurnBattleSystem party (multi player-side unit)', () => {
  it('interleaves multiple player-side units into the same ATB queue as enemies, ordered purely by speed/priority', () => {
    // 2 player participants with different speeds + 1 enemy — assert the
    // resolution order across several resolveNextStep() calls matches
    // pure gauge-fill order, not any "player side goes first" grouping.
  })

  it('battle continues (state stays fighting) when one party member dies but another survives', () => {
    // 2 player participants, kill one via a scripted high-damage hit,
    // assert battle.state is still 'fighting' as long as the other lives
    // and enemies remain.
  })

  it('battle resolves to defeat only when EVERY player-side participant is dead', () => {
  })

  it('an enemy\'s opposingSide correctly targets across all living player-side units, not just players[0]', () => {
  })
})
```

- [ ] **Step 7: Run tests to verify they fail, then implement, then pass**

- [ ] **Step 8: Update every existing test file's `TurnBattle` literals**

Every `player: makeParticipant(...)` in every `.test.ts` file under
`game/src/core/battle/turn/` becomes `players: [makeParticipant(...)]`
— mechanical find-and-replace, but verify each one compiles (some
tests may destructure `battle.player` directly elsewhere in the same
test body, which also needs updating to `battle.players[0]`).

- [ ] **Step 9: Run the full turn/ suite, typecheck, commit**

```bash
git add -A
git commit -m "feat(party): TurnBattle.player -> players[] — engine-level multi-player-unit support"
```

---

# Final Task: Full-suite verification

### Task 10: Full-suite verification

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: PASS, zero regressions.

- [ ] **Step 2: Run typecheck**

Run: `npx vue-tsc --noEmit`

- [ ] **Step 3: Commit any fixups**

```bash
git add -A
git commit -m "fix: address regressions found during Future Systems full-suite verification"
```

## Not Covered By This Plan

- Reaction Path's actual reaction-triggering payoff (Task 5's double-cast
  fires 2 real hits, but nothing checks whether they combo into a
  reaction yet — depends on Completion plan's Item F).
- Reaction Path ultimate's exact damage-boost % and duration (Task 4
  leaves this as a placeholder value).
- Node Tree's exact 5→3 skill content choices beyond the mapping rule
  (Task 1 documents the final choice in its own commit, not pre-decided
  here).
- Channel skill's exact resource cap / charge-turn-count real numbers
  (Task 8 flags these as content decisions to finalize at execution
  time).
- Party recruitment, UI, companion content/progression — engine only.
- Manual UI for any of these 5 systems (Slice 7's own scope, separate).
