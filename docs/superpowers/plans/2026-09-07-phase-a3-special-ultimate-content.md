# Phase A3 — Special/Ultimate Skill Content Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every build (5 Pháp Tu elements + Kiếm Tu) gets a real, resource-gated special and ultimate skill in turn-based combat, sourced from existing legacy content, plus periodic `specialAttacks` for the 3 realm-final bosses.

**Architecture:** Add a `'the'` resource type to the existing generic resource-gating mechanism (no new gating code path); add `TurnBuffSystem.getStacks()` so the ailment/ward-consume damage bonus reads/clears state through the buff system, not bespoke turn-engine bookkeeping; add a pure `Skill` → `TurnSkillDefinition` converter that resolves specialization through the existing `SkillSystem.getEffectiveSkill()` (turn engine never decides specialization itself); author one new native Kiếm Tu ultimate; author boss `specialAttacks` data.

**Tech Stack:** TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-07-phase-a3-special-ultimate-content-design.md`

## Global Constraints

- **No new specialization logic in the turn engine.** Specialization
  resolution is entirely `SkillSystem.getEffectiveSkill()`'s job (already
  live). The converter in Task 3 only ever reads its output — it must
  never inspect `selectedSpecializationId`/`specializations` itself.
- **Buff stack state is read/cleared only through `TurnBuffSystem`/
  `TurnBuffPool`'s own API.** No component in this plan tracks ailment
  stacks or `currentWard` bookkeeping outside those owners.
- **Number-preserved unit conversion.** Any legacy real-seconds numeric
  value (cooldown, duration) is carried over as the same number of turns
  — no rescaling — matching the A1/A2 precedent.
- **No rebalancing of existing legacy numbers.** Damage multipliers and
  resource costs for ported content are copied from the source verbatim,
  except where explicitly marked "starting point" below.
- **Chain-gating (Đạo Sắc combo sequencing,
  `ChainStateSystem.ts`'s `canCastChainSkill`/`advanceChain`) is NOT
  ported in this plan.** The legacy engine restricts a Thuần-path Pháp
  Tu player to casting basic→special→ultimate in strict order; no
  equivalent state exists on `TurnBattleParticipant` today. After this
  plan, a Thuần-path player's special/ultimate become castable purely by
  the normal cooldown + resource gate, without the legacy ordering
  restriction. This is a known, deliberate behavioral divergence — flag
  it to the user, do not silently attempt to port chain-gating as part
  of this plan.
- **`theManBuffId`/"Thế Mãn" is cosmetic-only and out of scope.**
  `TheResourceSystem.updateTheManBuff()` only reflects "currentThe is
  full" as a status buff (likely a UI glow) — it does not gate which
  ultimate is allowed to fire. Do not build any gating logic around it.
- Every step below assumes Windows/PowerShell paths; adjust slashes if
  your shell differs. Run tests from the `game/` directory
  (`cd game && npx vitest run <path>`).

---

## Task 1: `'the'` resource type — generic resource gate + turn-based gain hook

**Files:**
- Modify: `game/src/core/skill/SkillTypes.ts:33-37`
- Modify: `game/src/core/battle/turn/TurnSkillAction.ts:41-48`
- Modify: `game/src/core/player/Player.ts` (`playerToCombatEntity`, ~line 401-467)
- Modify: `game/src/core/battle/turn/TurnBattleSystem.ts` (`applyActionImpact()` per-target hit loop)
- Test: `game/src/core/battle/turn/TurnSkillAction.test.ts`
- Test: `game/src/core/battle/turn/TurnBattleSystem.theResource.test.ts` (new file)

**Interfaces:**
- Consumes: `MAX_THE`, `THE_GAIN_PER_LINK`, `THE_GAIN_PER_FINISHER` from
  `game/src/core/combat/CombatTypes.ts:89-91` (values: 100, 10, 20).
  `CombatEntity.currentThe?: number` (`CombatEntity.ts:77`).
- Produces: `SkillResourceType` gains a `'the'` member. `RESOURCE_FIELD`
  gains a `'the': 'currentThe'` entry, making `hasResourceFor`/
  `consumeResourceFor` (already generic) work for any skill with
  `resourceType: 'the'`. New exported function
  `gainTheOnSuccessfulSpecialHit(entity: CombatEntity): void` in
  `TurnBattleSystem.ts` (or a small new file
  `game/src/core/battle/turn/TurnTheResourceHook.ts` if the implementer
  judges `TurnBattleSystem.ts` is getting crowded) for Task 3/4 skills to
  rely on implicitly (it's called automatically from the hit loop, not
  by content authors).

- [ ] **Step 1: Write the failing test for `'the'` resource gating**

```typescript
// game/src/core/battle/turn/TurnSkillAction.test.ts — add to existing file
import { hasResourceFor, consumeResourceFor } from './TurnSkillAction'
// (CombatEntity fixture builder already exists in this test file — reuse it)

describe('the resource type', () => {
  it('gates on currentThe reaching the resource cost', () => {
    const entity = makeCombatEntity({ currentThe: 40 })
    const skill = makeSkillDefinition({ resourceType: 'the', resourceCost: 100 })

    expect(hasResourceFor(entity, skill)).toBe(false)

    entity.currentThe = 100

    expect(hasResourceFor(entity, skill)).toBe(true)
  })

  it('consumes the full pool on cast, matching legacy consumeTheForUlt reset-to-zero', () => {
    const entity = makeCombatEntity({ currentThe: 100 })
    const skill = makeSkillDefinition({ resourceType: 'the', resourceCost: 100 })

    consumeResourceFor(entity, skill)

    expect(entity.currentThe).toBe(0)
  })
})
```

Adapt `makeCombatEntity`/`makeSkillDefinition` to whatever fixture
helpers `TurnSkillAction.test.ts` already exports/uses (read the file
first — do not invent new helper names that collide with existing ones).

- [ ] **Step 2: Run test to verify it fails**

Run: `cd game && npx vitest run src/core/battle/turn/TurnSkillAction.test.ts -t "the resource type"`
Expected: FAIL — `'the'` is not assignable to `SkillResourceType`, or
`RESOURCE_FIELD` has no `'the'` entry (compile error or runtime
`undefined` field access).

- [ ] **Step 3: Add `'the'` to `SkillResourceType` and `RESOURCE_FIELD`**

In `game/src/core/skill/SkillTypes.ts:33-37`:

```typescript
export type SkillResourceType =
  | 'none'
  | 'mana'
  | 'sword_intent'
  | 'momentum'
  | 'the'
```

In `game/src/core/battle/turn/TurnSkillAction.ts:41-48`:

```typescript
const RESOURCE_FIELD: Record<
  Exclude<SkillResourceType, 'none'>,
  'currentMp' | 'currentSwordIntent' | 'currentMomentum' | 'currentThe'
> = {
  mana: 'currentMp',
  sword_intent: 'currentSwordIntent',
  momentum: 'currentMomentum',
  the: 'currentThe',
}
```

`hasResourceFor`/`consumeResourceFor` (`TurnSkillAction.ts:56-74`) need
no changes — `entity[field]` on an optional `currentThe?: number` reads
as `undefined`, and `undefined >= 100` is `false` (correctly blocks an
uninitialized pool), so Step 4 below (initializing `currentThe: 0`) is
still needed for correctness but not for type-safety.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd game && npx vitest run src/core/battle/turn/TurnSkillAction.test.ts -t "the resource type"`
Expected: PASS

- [ ] **Step 5: Initialize `currentThe: 0` on the player entity**

In `game/src/core/player/Player.ts`'s `playerToCombatEntity()` (currently
sets `currentHoaThe: 0, currentThoThe: 0, currentKimThe: 0` etc. but no
`currentThe`), add:

```typescript
    currentThe: 0,
```

alongside the other `current*The: 0` fields (~line 430, right after
`currentKimThe: 0,`). This mirrors the exact pattern the other 3 Pháp Tu
resource pools already use.

- [ ] **Step 6: Commit**

```bash
git add game/src/core/skill/SkillTypes.ts game/src/core/battle/turn/TurnSkillAction.ts game/src/core/player/Player.ts game/src/core/battle/turn/TurnSkillAction.test.ts
git commit -m "feat(turn-combat): add 'the' resource type for ultimate gating"
```

- [ ] **Step 7: Write the failing test for the chain-link gain hook**

Because chain-gating itself is out of scope (Global Constraints), the
turn-based gain rule is simplified from legacy's "gain only on a
correctly-sequenced chain link": **every landed hit from a participant's
`special` slot grants `THE_GAIN_PER_LINK` (10) to that participant's
`currentThe`, capped at `MAX_THE` (100); every landed hit from the
`ultimate` slot grants `THE_GAIN_PER_FINISHER` (20) instead** (the
ultimate itself still requires/consumes a full pool via Task 1's
resource gate, so this only matters for builds where the ultimate can
land without draining the pool to exactly 0 — e.g. none currently, but
this keeps the rule uniform and simple rather than special-casing "no
gain from the skill that just consumed the pool").

Read `game/src/core/battle/turn/TurnBattleSystem.ts`'s
`applyActionImpact()` method fully first (search for where A1's
`appliesAilment` resolution was added — this hook goes in the same
per-target loop, right after the existing `rollOnHitEffects`/
`rollReactiveTrigger`/`appliesAilment` block) to get the exact current
variable names (`actor`, `target`, `declared.action.slot` or equivalent
— confirm at implementation time, the exact local variable names may
have shifted).

```typescript
// game/src/core/battle/turn/TurnBattleSystem.theResource.test.ts (new file)
import { describe, it, expect } from 'vitest'
import { TurnBattleSystem } from './TurnBattleSystem'
// import whatever fixture builder this test suite family already uses
// (see TurnBattleSystem.adversarial.test.ts or .party.test.ts for the
// established fixture pattern — reuse it, don't invent a new one)

describe('currentThe gain on special/ultimate hits', () => {
  it('grants THE_GAIN_PER_LINK on a landed special hit', () => {
    // Arrange a battle where the player's `special` slot is ready and
    // will land on the enemy (deterministic damage/no dodge fixture,
    // matching how existing hit-loop tests in this suite set up
    // guaranteed hits).
    // Act: resolve one full turn cycle for the player.
    // Assert: player.entity.currentThe === 10 after the special lands.
  })

  it('caps currentThe at MAX_THE (100)', () => {
    // Arrange currentThe: 95 before the hit.
    // Assert: currentThe === 100 after landing (not 105).
  })
})
```

Fill in the arrange/act blocks using this test suite's actual existing
fixture helpers — read `TurnBattleSystem.adversarial.test.ts` first for
the exact builder function names and battle-resolution call shape before
writing these bodies; do not guess field names.

- [ ] **Step 8: Run test to verify it fails**

Run: `cd game && npx vitest run src/core/battle/turn/TurnBattleSystem.theResource.test.ts`
Expected: FAIL — `currentThe` stays `undefined`/`0`, no gain logic exists yet.

- [ ] **Step 9: Implement the gain hook in `applyActionImpact()`**

In `TurnBattleSystem.ts`, in the per-target hit loop (same location as
A1's `appliesAilment` block), after a hit is confirmed to have landed,
add:

```typescript
    // Phase A3 — Thế Thuần Hệ gain, simplified from legacy's
    // chain-link-position rule (no turn-based chain state exists — see
    // spec's Global Constraints). Fires per landed hit from special/
    // ultimate slots only; basic attacks do not generate Thế.
    if (declared.action?.slot === actor.special) {
      actor.entity.currentThe = Math.min(MAX_THE, (actor.entity.currentThe ?? 0) + THE_GAIN_PER_LINK)
    } else if (declared.action?.slot === actor.ultimate) {
      actor.entity.currentThe = Math.min(MAX_THE, (actor.entity.currentThe ?? 0) + THE_GAIN_PER_FINISHER)
    }
```

Adjust the exact condition to whatever the real local variable holding
the declared action/slot is named at the current line (`declared.action`
per `TurnDeclaredAction`'s shape shown in `TurnBattleSystem.ts:214-253`
— confirm the per-target-loop scope still has this in view, since the
loop iterates `affected` targets while `action`/`slot` belong to the
actor, not the target). Import `MAX_THE`, `THE_GAIN_PER_LINK`,
`THE_GAIN_PER_FINISHER` from `../../combat/CombatTypes`.

- [ ] **Step 10: Run test to verify it passes**

Run: `cd game && npx vitest run src/core/battle/turn/TurnBattleSystem.theResource.test.ts`
Expected: PASS

- [ ] **Step 11: Run the full existing `TurnBattleSystem` test suite to check for regressions**

Run: `cd game && npx vitest run src/core/battle/turn/TurnBattleSystem`
Expected: All existing tests still PASS (the new block is additive and
gated on `slot === actor.special`/`actor.ultimate`, both `undefined` for
every participant that doesn't have those slots populated yet — a no-op
for all current content).

- [ ] **Step 12: Commit**

```bash
git add game/src/core/battle/turn/TurnBattleSystem.ts game/src/core/battle/turn/TurnBattleSystem.theResource.test.ts
git commit -m "feat(turn-combat): add currentThe gain hook on special/ultimate hits"
```

---

## Task 2: `TurnBuffSystem.getStacks()` + ailment/ward-consume damage bonus

**Files:**
- Modify: `game/src/core/battle/turn/TurnBuffSystem.ts`
- Modify: `game/src/core/battle/turn/TurnSkillAction.ts` (`TurnSkillDefinition` interface, `TurnSkillAction.ts:22-34`)
- Modify: `game/src/core/battle/turn/TurnBattleSystem.ts` (`applyActionImpact()` per-target loop)
- Test: `game/src/core/battle/turn/TurnBuffSystem.test.ts`
- Test: `game/src/core/battle/turn/TurnBattleSystem.consumeDamage.test.ts` (new file)

**Interfaces:**
- Consumes: `TurnBuffPool.getAllById`/`getFromSource` (`TurnBuffPool.ts:9-15`,
  already exist). Legacy reference:
  `BuffSystem.getStacks()` (`BuffSystem.ts:397-402`).
- Produces: `TurnBuffSystem.getStacks(id: string, sourceId?: string): number`.
  `TurnSkillDefinition.consumesAilmentId?: string`,
  `TurnSkillDefinition.damagePerStack?: number`,
  `TurnSkillDefinition.consumesWardForDamage?: boolean`,
  `TurnSkillDefinition.damagePerWardPoint?: number`.

**Note:** this task assumes A1's plan
(`docs/superpowers/plans/2026-09-07-phase-a1-reaction-manager-wiring.md`)
has already landed `TurnBuffSystem.getActiveIds()`/`.remove()`/
`.renewWithExtension()` and the `appliesAilment` resolution block in
`applyActionImpact()`. If it has not, read that plan's Task 1 and
Component 2 sections first — this task's `getStacks()` sits alongside
those same methods, and this task's hook point is the same per-target
loop A1 already modified.

- [ ] **Step 1: Write the failing test for `TurnBuffSystem.getStacks()`**

```typescript
// game/src/core/battle/turn/TurnBuffSystem.test.ts — add to existing file
describe('getStacks', () => {
  it('sums stacks across all sources when sourceId is omitted', () => {
    const pool = new TurnBuffPool()
    const buffs = new TurnBuffSystem(pool)
    // apply the same buff id from two different sourceIds, 1 stack each
    // (reuse this test file's existing apply()/registry fixture pattern)
    buffs.apply(testDefinition('bong'), sourceA, target, testRegistry)
    buffs.apply(testDefinition('bong'), sourceB, target, testRegistry)

    expect(buffs.getStacks('bong')).toBe(2)
  })

  it('returns stacks for one source only when sourceId is given', () => {
    const pool = new TurnBuffPool()
    const buffs = new TurnBuffSystem(pool)
    buffs.apply(testDefinition('bong'), sourceA, target, testRegistry)

    expect(buffs.getStacks('bong', sourceA.id)).toBe(1)
    expect(buffs.getStacks('bong', 'unrelated_source')).toBe(0)
  })
})
```

Use this test file's existing `testDefinition`/`testRegistry`/fixture
entity helpers — read the file first for exact names.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd game && npx vitest run src/core/battle/turn/TurnBuffSystem.test.ts -t "getStacks"`
Expected: FAIL — `getStacks` is not a method on `TurnBuffSystem`.

- [ ] **Step 3: Implement `getStacks()`, ported verbatim from `BuffSystem.getStacks()`**

Add to `TurnBuffSystem.ts` alongside the existing `getActiveIds()`/
`remove()`/`renewWithExtension()` methods (added by A1's plan):

```typescript
  // Phase A3 — Pháp Tu Detonate ("cash in" stacks of an ailment for a
  // skill burst), ported verbatim from BuffSystem.getStacks(). No
  // sourceId = sum across every source (e.g. multi-source poison);
  // sourceId given = exactly that one instance's stacks.
  getStacks(id: string, sourceId?: string): number {
    if (sourceId !== undefined) {
      return this.pool.getFromSource(id, sourceId)?.stacks ?? 0
    }
    return this.pool.getAllById(id).reduce((sum, buff) => sum + buff.stacks, 0)
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd game && npx vitest run src/core/battle/turn/TurnBuffSystem.test.ts -t "getStacks"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add game/src/core/battle/turn/TurnBuffSystem.ts game/src/core/battle/turn/TurnBuffSystem.test.ts
git commit -m "feat(turn-combat): add TurnBuffSystem.getStacks(), port of BuffSystem.getStacks"
```

- [ ] **Step 6: Add the 4 new fields to `TurnSkillDefinition`**

In `game/src/core/battle/turn/TurnSkillAction.ts:22-34`:

```typescript
export interface TurnSkillDefinition {
  id: string
  cooldownTurns: number
  resourceType?: SkillResourceType
  resourceCost?: number
  damage: ActionDamageInfo
  targeting: ActionTargeting
  appliesBuff?: { definitionId: string; target: 'self' | 'target' }
  /** Future Systems Task 7 — skill charge N lượt (Thế) rồi tự resolve (Trảm). */
  chargeTurns?: number
  /** Action Playback (2026-09-05) — VFX preset cho action_impact. undefined = fallback preset mặc định (Task 4). */
  presetId?: CombatVfxPresetId
  // Phase A3 — Pháp Tu Detonate: consume the target's stacks of this
  // ailment for bonus true damage (bypasses armor/resistance), then
  // clear them. Ported from legacy SkillEffect.consumesAilmentId/
  // damagePerStack (see SkillEffect.ts:72-81). Only meaningful together
  // with damagePerStack.
  consumesAilmentId?: string
  damagePerStack?: number
  // Phase A3 — Thổ Tu "tự nổ khiên": consume the SOURCE's entire
  // currentWard for bonus true damage, then zero it. Ported from legacy
  // SkillEffect.consumesWardForDamage/damagePerWardPoint (see
  // SkillEffect.ts:104-112). Only meaningful together with
  // damagePerWardPoint.
  consumesWardForDamage?: boolean
  damagePerWardPoint?: number
}
```

- [ ] **Step 7: Write the failing integration test for the consume-for-damage resolution**

```typescript
// game/src/core/battle/turn/TurnBattleSystem.consumeDamage.test.ts (new file)
import { describe, it, expect } from 'vitest'
// Reuse the same fixture pattern as TurnBattleSystem.theResource.test.ts (Task 1)

describe('consume-for-damage skill effects', () => {
  it('consumesAilmentId: applies stacks × damagePerStack as true damage, then clears the ailment', () => {
    // Arrange: target has 3 stacks of 'bong' (from a prior hit or
    // pre-seeded via buffs.apply()). Actor's special/ultimate skill has
    // consumesAilmentId: 'bong', damagePerStack: 50.
    // Act: resolve the actor's turn casting that skill.
    // Assert: target.currentHp dropped by (base damage + 3×50), and
    // target.buffs.getStacks('bong') === 0 afterward.
  })

  it('consumesWardForDamage: applies currentWard × damagePerWardPoint as true damage, then zeroes ward', () => {
    // Arrange: actor.entity.currentWard = 20. Skill has
    // consumesWardForDamage: true, damagePerWardPoint: 5.
    // Act: resolve the actor's turn.
    // Assert: target took base damage + 100 bonus true damage, and
    // actor.entity.currentWard === 0 afterward.
  })
})
```

Fill in arrange/act with this suite's real fixture builder calls (same
caveat as Task 1 Step 7 — read a neighboring `TurnBattleSystem.*.test.ts`
file first for the exact API before writing bodies).

- [ ] **Step 8: Run test to verify it fails**

Run: `cd game && npx vitest run src/core/battle/turn/TurnBattleSystem.consumeDamage.test.ts`
Expected: FAIL — no resolution logic exists yet, bonus damage is 0 and
stacks/ward are unchanged.

- [ ] **Step 9: Implement the resolution in `applyActionImpact()`**

In the same per-target hit loop as Task 1 Step 9 (and A1's
`appliesAilment` block), after the base hit damage is applied, add:

```typescript
    // Phase A3 — consume-for-damage (Pháp Tu Detonate / Thổ Tu ward
    // burst). Orchestration only: reads/clears state through
    // TurnBuffSystem's own API (getStacks/remove) and CombatEntity's
    // plain currentWard field — this block does not own stack
    // bookkeeping itself.
    const skill = declared.action?.skill
    if (skill?.consumesAilmentId && skill.damagePerStack) {
      const stacks = target.buffs.getStacks(skill.consumesAilmentId)
      if (stacks > 0) {
        const bonusDamage = stacks * skill.damagePerStack
        target.entity.currentHp = Math.max(0, target.entity.currentHp - bonusDamage)
        target.buffs.removeAllById(skill.consumesAilmentId)
      }
    }
    if (skill?.consumesWardForDamage && skill.damagePerWardPoint) {
      const ward = actor.entity.currentWard
      if (ward > 0) {
        const bonusDamage = ward * skill.damagePerWardPoint
        target.entity.currentHp = Math.max(0, target.entity.currentHp - bonusDamage)
        actor.entity.currentWard = 0
      }
    }
```

Confirm at implementation time: (a) `TurnBuffPool` needs a
`removeAllById()` method — it does NOT exist yet (`TurnBuffPool.ts:9-45`
only has `removeInstance`); add it first, ported verbatim from
`BuffPool.removeAllById()`:

```typescript
  removeAllById(id: string): void {
    this.buffs = this.buffs.filter((buff) => buff.id !== id)
  }
```

and expose it on `TurnBuffSystem` the same way `remove()` wraps
`removeInstance()` (A1's plan already adds `remove()` — add
`removeAllById()` alongside it, or confirm A1's `remove()` already
covers this case before duplicating); (b) confirm `target.entity.currentHp`
direct mutation is consistent with how other true-damage paths in this
file apply damage (e.g. DoT ticks) rather than introducing a new damage
application style — match the existing pattern exactly, adjust the code
above if the file uses a different mutation helper.

- [ ] **Step 10: Run test to verify it passes**

Run: `cd game && npx vitest run src/core/battle/turn/TurnBattleSystem.consumeDamage.test.ts`
Expected: PASS

- [ ] **Step 11: Run the full existing `TurnBattleSystem` test suite**

Run: `cd game && npx vitest run src/core/battle/turn/TurnBattleSystem`
Expected: All existing tests still PASS (both new blocks are gated on
skill fields that are `undefined` for all current content).

- [ ] **Step 12: Commit**

```bash
git add game/src/core/battle/turn/TurnBuffPool.ts game/src/core/battle/turn/TurnBuffSystem.ts game/src/core/battle/turn/TurnSkillAction.ts game/src/core/battle/turn/TurnBattleSystem.ts game/src/core/battle/turn/TurnBattleSystem.consumeDamage.test.ts
git commit -m "feat(turn-combat): add ailment/ward consume-for-damage skill effect resolution"
```

---

## Task 3: `Skill` → `TurnSkillDefinition` converter + fix the buildId bug (5 Pháp Tu elements)

**Files:**
- Create: `game/src/core/game/SkillToTurnSkillConverter.ts`
- Modify: `game/src/core/game/TurnBattleAdapter.ts`
- Modify: `game/src/core/game/GameManager.ts` (~line 2307-2322 `resolvePlayerBasicAttack`, ~line 2364-2369 `buildTurnBattle`)
- Test: `game/src/core/game/SkillToTurnSkillConverter.test.ts` (new file)
- Test: extend `game/src/core/game/TurnBattleAdapter.test.ts`

**Interfaces:**
- Consumes: `SkillSystem.getEffectiveSkill(skill: Skill): EffectiveSkill`
  (`SkillSystem.ts:103-160`, already exists, unchanged). `CHAIN_SKILL_IDS:
  Record<ElementType, readonly [string, string, string]>`
  (`Skills.ts:2289-2295` — `[basicId, specialId, ultimateId]` per
  element). `GameManager.getPhapTuThuanElement(): ElementType | undefined`
  (`GameManager.ts:486-...`, already exists). Task 1's `'the'` resource
  type, Task 2's new `TurnSkillDefinition` fields.
- Produces: `toTurnSkillDefinition(skill: Skill, effective: EffectiveSkill):
  TurnSkillDefinition`. `toTurnBattleParticipant()`'s new signature
  (adds two optional params, see Step 6).

- [ ] **Step 1: Write the failing test for the converter's basic field mapping**

First read `game/src/data/skill/Skills.ts`'s `tam_muoi_chan_hoa`
definition in full (the fire special) to know its exact `effects`/
`targeting`/`cost`/`resourceType`/`cooldown` shape — this determines the
literal expected values in the test below. Also read `SkillEffect.ts` in
full for the exact `'damage'`/`'debuff'` effect variant field names
(`value`, `element`, ailment chance/id fields) before writing the
mapping assertions.

```typescript
// game/src/core/game/SkillToTurnSkillConverter.test.ts (new file)
import { describe, it, expect } from 'vitest'
import { toTurnSkillDefinition } from './SkillToTurnSkillConverter'
import { SKILLS } from '../../data/skill/Skills' // or wherever the raw Skill records live — confirm exact export name
import { SkillSystem } from '../skill/SkillSystem'
import { SkillManager } from '../skill/SkillManager'

describe('toTurnSkillDefinition', () => {
  it('maps a plain (non-specialized-selection) special skill to a TurnSkillDefinition', () => {
    const manager = new SkillManager()
    const skillSystem = new SkillSystem(manager)
    const skill = structuredClone(SKILLS.tam_muoi_chan_hoa) // exact source id — confirm against Skills.ts
    manager.add(skill)

    const effective = skillSystem.getEffectiveSkill(skill)
    const turnSkill = toTurnSkillDefinition(skill, effective)

    expect(turnSkill.id).toBe('tam_muoi_chan_hoa')
    expect(turnSkill.cooldownTurns).toBe(skill.cooldown)
    expect(turnSkill.damage.kind).toBe('elemental') // or whatever ActionDamageInfo.kind this skill actually uses — confirm from the real effect
  })

  it('applies the specialization override when selectedSpecializationId is set', () => {
    const manager = new SkillManager()
    const skillSystem = new SkillSystem(manager)
    const skill = structuredClone(SKILLS.tam_muoi_chan_hoa)
    manager.add(skill)
    const specializationId = skill.specializations![0]!.id
    skillSystem.selectSpecialization(skill.id, specializationId)

    const effective = skillSystem.getEffectiveSkill(manager.get(skill.id)!)
    const turnSkill = toTurnSkillDefinition(manager.get(skill.id)!, effective)

    // Assert whatever the first specialization branch actually overrides
    // — read SkillSpecialization.ts and this skill's specializations
    // array to know which field changed, then assert on that field.
  })
})
```

This test's exact assertions depend on `tam_muoi_chan_hoa`'s real
content — read it fully before finalizing the assertions; do not guess
values.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd game && npx vitest run src/core/game/SkillToTurnSkillConverter.test.ts`
Expected: FAIL — module does not exist yet.

- [ ] **Step 3: Implement the converter**

Read `ActionDamageInfo` (`game/src/core/battle/ActionImpactSystem.ts` or
wherever it's declared — confirm exact import path via
`TurnSkillAction.ts`'s own import) and `ActionTargeting`
(`game/src/core/battle/CombatAction.ts:25`) fully before writing this —
the mapping must produce values these types actually accept.

```typescript
// game/src/core/game/SkillToTurnSkillConverter.ts (new file)
import type { Skill } from '../skill/Skill'
import type { EffectiveSkill } from '../skill/SkillSystem'
import type { TurnSkillDefinition } from '../battle/turn/TurnSkillAction'
import type { ActionDamageInfo } from '../battle/ActionImpactSystem' // confirm exact path
import type { ActionTargeting } from '../battle/CombatAction'

// Phase A3 — pure read of an already-resolved EffectiveSkill (produced
// by SkillSystem.getEffectiveSkill(), which already applies
// specialization override if one is selected). This function makes no
// specialization decision of its own — see spec's Non-Goals.
export function toTurnSkillDefinition(skill: Skill, effective: EffectiveSkill): TurnSkillDefinition {
  const damageEffect = effective.effects.find((effect) => effect.type === 'damage')
  const debuffEffect = effective.effects.find((effect) => effect.type === 'debuff')

  const damage: ActionDamageInfo = damageEffect
    ? {
        kind: damageEffect.element ? 'elemental' : 'physical', // confirm exact ActionDamageInfo shape/kind values against real usage in TurnBasicAttacks.ts before finalizing
        multiplier: damageEffect.value ?? 1,
        element: damageEffect.element,
      }
    : { kind: 'physical', multiplier: 1 }

  const targeting: ActionTargeting = effective.targeting ?? skill.targeting ?? { shape: 'single' }

  const turnSkill: TurnSkillDefinition = {
    id: skill.id,
    cooldownTurns: skill.cooldown,
    resourceType: skill.resourceType,
    resourceCost: skill.cost,
    damage,
    targeting,
  }

  if (debuffEffect?.chance !== undefined && debuffEffect.appliesBuffId) { // confirm exact debuff effect field names against SkillEffect.ts
    turnSkill.appliesAilment = { buffDefinitionId: debuffEffect.appliesBuffId, chance: debuffEffect.chance }
  }

  if (damageEffect?.consumesAilmentId && damageEffect.damagePerStack) {
    turnSkill.consumesAilmentId = damageEffect.consumesAilmentId
    turnSkill.damagePerStack = damageEffect.damagePerStack
  }

  if (damageEffect?.consumesWardForDamage && damageEffect.damagePerWardPoint) {
    turnSkill.consumesWardForDamage = true
    turnSkill.damagePerWardPoint = damageEffect.damagePerWardPoint
  }

  return turnSkill
}
```

This step's exact field names (`ActionDamageInfo.kind`'s valid values,
`SkillEffect`'s debuff-effect field names) MUST be confirmed against the
real type definitions before this compiles — read
`game/src/core/battle/ActionImpactSystem.ts`,
`game/src/core/skill/SkillEffect.ts`, and
`game/src/data/skill/TurnBasicAttacks.ts` (an existing, working example
of building an `ActionDamageInfo`/`appliesAilment` pair for a Pháp Tu
skill) fully before finalizing this function — the sketch above is the
mapping shape, not verified-compiling code.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd game && npx vitest run src/core/game/SkillToTurnSkillConverter.test.ts`
Expected: PASS (after fixing any field-name mismatches found in Step 3).

- [ ] **Step 5: Commit**

```bash
git add game/src/core/game/SkillToTurnSkillConverter.ts game/src/core/game/SkillToTurnSkillConverter.test.ts
git commit -m "feat(turn-combat): add Skill to TurnSkillDefinition converter for Phap Tu content"
```

- [ ] **Step 6: Extend `toTurnBattleParticipant()` to accept resolved special/ultimate directly**

In `game/src/core/game/TurnBattleAdapter.ts`, change the signature to
accept an explicit override, used by Pháp Tu (bypassing the buildId
static-map lookup that was the Component 1 bug):

```typescript
export function toTurnBattleParticipant(
  entity: CombatEntity,
  priority: number,
  basic: TurnSkillDefinition,
  buildId?: string,
  resolvedSpecialUltimate?: { special?: TurnSkillDefinition; ultimate?: TurnSkillDefinition },
): TurnBattleParticipant {
  const participant: TurnBattleParticipant = {
    id: entity.id,
    entity,
    speed: entity.stats.speed,
    priority,
    actionGauge: 0,
    alive: entity.alive,
    buffs: new TurnBuffPool(),
    consecutiveHardCcTurns: 0,
    basic,
  }

  const special = resolvedSpecialUltimate?.special ?? (buildId !== undefined ? SPECIALS_BY_BUILD[buildId] : undefined)
  const ultimate = resolvedSpecialUltimate?.ultimate ?? (buildId !== undefined ? ULTIMATES_BY_BUILD[buildId] : undefined)

  if (special) {
    participant.special = { skill: special, remainingCooldownTurns: 0 } satisfies TurnSkillSlot
  }

  if (ultimate) {
    participant.ultimate = { skill: ultimate, remainingCooldownTurns: 0 } satisfies TurnSkillSlot
  }

  return participant
}
```

Add the `ULTIMATES_BY_BUILD` map (empty for now — Task 4 populates it
with the Kiếm Tu ultimate):

```typescript
const ULTIMATES_BY_BUILD: Record<string, TurnSkillDefinition> = {}
```

The other 6 existing call sites of `toTurnBattleParticipant()` in
`GameManager.ts` (companions, enemies — confirmed via the blast-radius
survey) pass 3 or 4 positional args and are unaffected by an added 5th
optional param — no changes needed there.

- [ ] **Step 7: Add `resolvePlayerSpecialUltimate()` to `GameManager.ts`, mirroring `resolvePlayerBasicAttack()`**

Read `resolvePlayerBasicAttack()` (`GameManager.ts:2307-2322`) once more
immediately before writing this — it is the exact pattern to mirror
(same `cultivationPath`/`getPhapTuThuanElement()` branching), so any
divergence should be deliberate, not accidental.

```typescript
  /**
   * Phase A3 — resolve the player's special/ultimate TurnSkillDefinition
   * for Pháp Tu builds, via the Skill -> TurnSkillDefinition converter
   * (SkillToTurnSkillConverter.ts). Kiếm Tu is unaffected — its special/
   * ultimate stay in TurnBattleAdapter's static SPECIALS_BY_BUILD/
   * ULTIMATES_BY_BUILD maps (BAT_KIEM_THUAT / the Task 4 ultimate), so
   * this returns undefined for kiem_tu and toTurnBattleParticipant()'s
   * buildId-based lookup takes over.
   */
  private resolvePlayerSpecialUltimate(
    player: PlayerData,
  ): { special?: TurnSkillDefinition; ultimate?: TurnSkillDefinition } {
    if (player.cultivationPath !== 'phap_tu') {
      return {}
    }

    const element = this.getPhapTuThuanElement() ?? 'fire'
    const [, specialId, ultimateId] = CHAIN_SKILL_IDS[element]

    const specialSkill = this.skillManager.get(specialId)
    const ultimateSkill = this.skillManager.get(ultimateId)

    return {
      special: specialSkill
        ? toTurnSkillDefinition(specialSkill, this.skillSystem.getEffectiveSkill(specialSkill))
        : undefined,
      ultimate: ultimateSkill
        ? toTurnSkillDefinition(ultimateSkill, this.skillSystem.getEffectiveSkill(ultimateSkill))
        : undefined,
    }
  }
```

Add `import { toTurnSkillDefinition } from './SkillToTurnSkillConverter'`
and `import { CHAIN_SKILL_IDS } from '../../data/skill/Skills'` to
`GameManager.ts`'s import block if not already present (`CHAIN_SKILL_IDS`
is already imported per the `startBattleWithPlayer()` usage at
`GameManager.ts:2710-2711` — confirm and reuse the existing import,
don't duplicate it).

- [ ] **Step 8: Wire `resolvePlayerSpecialUltimate()` into `buildTurnBattle()`**

In `GameManager.ts:2364-2369`, change:

```typescript
    const playerParticipant = toTurnBattleParticipant(
      playerEntity,
      0,
      playerPath ? this.resolvePlayerBasicAttack(playerPath) : GENERIC_PHYSICAL_BASIC,
      playerPath?.cultivationPath,
    )
```

to:

```typescript
    const playerParticipant = toTurnBattleParticipant(
      playerEntity,
      0,
      playerPath ? this.resolvePlayerBasicAttack(playerPath) : GENERIC_PHYSICAL_BASIC,
      playerPath?.cultivationPath,
      playerPath ? this.resolvePlayerSpecialUltimate(playerPath) : undefined,
    )
```

This is the Component 1 bug fix: previously `playerPath?.cultivationPath`
(`'phap_tu'`) was passed as `buildId` and silently matched nothing in
`SPECIALS_BY_BUILD` (only `'kiem_tu'` was ever populated) — a Pháp Tu
player got no special/ultimate at all. Now the 5th param supplies the
real, per-element resolved skills directly, bypassing that broken
lookup path entirely for Pháp Tu.

- [ ] **Step 9: Write the integration test proving a Pháp Tu player's special actually casts**

```typescript
// game/src/core/game/TurnBattleAdapter.test.ts — extend existing file
it('gives a Phap Tu player their element special/ultimate (fixing the buildId lookup bug)', () => {
  // Build a minimal PlayerData with cultivationPath: 'phap_tu' and the
  // lap_dao_thuan_fire node purchased (matching getPhapTuThuanElement's
  // read), pass through GameManager.buildTurnBattle() (or call
  // resolvePlayerSpecialUltimate directly if buildTurnBattle isn't
  // easily testable in isolation — check existing test patterns for
  // this file first).
  // Assert: participant.special?.skill.id === 'tam_muoi_chan_hoa'
  // Assert: participant.ultimate?.skill.id === 'hoa_ha_cuu_thien'
})
```

Fill in using whatever `PlayerData`/`GameManager` test-fixture builder
this codebase already has (search for existing `GameManager`
integration tests that construct a minimal player — do not hand-build a
`PlayerData` object from scratch if a builder already exists).

- [ ] **Step 10: Run test to verify it fails, then implement until it passes**

Run: `cd game && npx vitest run src/core/game/TurnBattleAdapter.test.ts -t "Phap Tu player"`
Expected: FAIL first (confirms the bug existed), then PASS after Steps
6-8 are in place.

- [ ] **Step 11: Run the full existing `TurnBattleAdapter`/`GameManager` test suites**

Run: `cd game && npx vitest run src/core/game/TurnBattleAdapter.test.ts src/core/game/GameManager`
Expected: All existing tests still PASS.

- [ ] **Step 12: Type-check and build**

Run: `cd game && npx vue-tsc --noEmit && npm run build`
Expected: No new errors.

- [ ] **Step 13: Commit**

```bash
git add game/src/core/game/TurnBattleAdapter.ts game/src/core/game/GameManager.ts game/src/core/game/TurnBattleAdapter.test.ts
git commit -m "fix(turn-combat): wire Phap Tu special/ultimate via Skill converter, fix buildId lookup bug"
```

---

## Task 4: Kiếm Tu ultimate content

**Files:**
- Modify: `game/src/data/skill/BatKiemThuat.ts`
- Modify: `game/src/core/game/TurnBattleAdapter.ts` (`ULTIMATES_BY_BUILD`, added in Task 3 Step 6)
- Test: extend `game/src/core/game/TurnBattleAdapter.test.ts`

**Interfaces:**
- Consumes: `TurnSkillDefinition` (unchanged shape from Task 1/2's
  additions — this content just doesn't use the new optional fields).
  Task 1's `'the'` resource type.
- Produces: `TRU_TIEN_KIEM_TRAN: TurnSkillDefinition`, exported from
  `BatKiemThuat.ts` alongside `BAT_KIEM_THUAT`.

- [ ] **Step 1: Write the failing test**

```typescript
// game/src/core/game/TurnBattleAdapter.test.ts — extend existing file
it('gives a Kiem Tu player TRU_TIEN_KIEM_TRAN as their ultimate', () => {
  const participant = toTurnBattleParticipant(makeCombatEntity(), 0, BASIC_ATTACKS_BY_BUILD.kiem_tu!, 'kiem_tu')

  expect(participant.ultimate?.skill.id).toBe('tru_tien_kiem_tran')
  expect(participant.special?.skill.id).toBe('bat_kiem_thuat')
})
```

Use this file's existing `makeCombatEntity`/fixture pattern (already
established for the current `SPECIALS_BY_BUILD` test coverage — read the
file first).

- [ ] **Step 2: Run test to verify it fails**

Run: `cd game && npx vitest run src/core/game/TurnBattleAdapter.test.ts -t "TRU_TIEN_KIEM_TRAN"`
Expected: FAIL — `ULTIMATES_BY_BUILD` is empty (Task 3 Step 6 left it
`{}`), no `TRU_TIEN_KIEM_TRAN` export exists yet.

- [ ] **Step 3: Author the ultimate in `BatKiemThuat.ts`**

```typescript
// game/src/data/skill/BatKiemThuat.ts — add below BAT_KIEM_THUAT
// Phase A3 — Kiếm Tu ultimate: explicit stronger variant of
// BAT_KIEM_THUAT (per locked design decision — "bản mạnh hơn của special
// hiện có"), gated by currentThe (Task 1) instead of BAT_KIEM_THUAT's
// deliberate no-resource-gate design (see that skill's own comment).
// Multiplier/cooldown are starting points for playtesting, not locked
// balance — same convention as Phase A2's boss enrage magnitudes.
export const TRU_TIEN_KIEM_TRAN: TurnSkillDefinition = {
  id: 'tru_tien_kiem_tran',
  cooldownTurns: 8,
  resourceType: 'the',
  resourceCost: 100,
  damage: { kind: 'physical', multiplier: 5 },
  targeting: { shape: 'single' },
}
```

- [ ] **Step 4: Wire it into `ULTIMATES_BY_BUILD`**

In `game/src/core/game/TurnBattleAdapter.ts`:

```typescript
import { BAT_KIEM_THUAT, TRU_TIEN_KIEM_TRAN } from '../../data/skill/BatKiemThuat'

const ULTIMATES_BY_BUILD: Record<string, TurnSkillDefinition> = {
  kiem_tu: TRU_TIEN_KIEM_TRAN,
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd game && npx vitest run src/core/game/TurnBattleAdapter.test.ts -t "TRU_TIEN_KIEM_TRAN"`
Expected: PASS

- [ ] **Step 6: Run the full existing `TurnBattleAdapter` test suite**

Run: `cd game && npx vitest run src/core/game/TurnBattleAdapter.test.ts`
Expected: All existing tests still PASS.

- [ ] **Step 7: Commit**

```bash
git add game/src/data/skill/BatKiemThuat.ts game/src/core/game/TurnBattleAdapter.ts game/src/core/game/TurnBattleAdapter.test.ts
git commit -m "feat(turn-combat): add Kiem Tu ultimate (Tru Tien Kiem Tran), gated by currentThe"
```

---

## Task 5: Boss `specialAttacks` for the 3 A2 realm-final bosses

**Files:**
- Modify: `game/src/data/enemy/Enemies.ts` (3 boss entries:
  `mortal_ferocious_giant_crocodile`, `ferocious_flood_serpent`,
  `foundation_ferocious_flood_dragon_whelp`)
- Modify: `game/src/core/battle/turn/TurnBattleSystem.ts` (only if Step 1's
  investigation finds no existing turn-based reader — see below)
- Test: `game/src/core/battle/turn/TurnBattleSystem.specialAttacks.test.ts` (new file, if a reader needs to be added) OR extend an existing test file if a reader already exists.

**Interfaces:**
- Consumes: `EnemySpecialAttack { everyNth: number; damageMultiplier:
  number; presetId?: CombatVfxPresetId; windupSeconds?: number }`
  (`Enemy.ts:22-30`, already exists). `enemyToCombatEntity()` already
  copies `enemy.specialAttacks` onto `CombatEntity.specialAttacks`
  (`Enemy.ts:371`).

- [ ] **Step 1: Investigate whether the turn-based engine already reads `CombatEntity.specialAttacks`**

Before writing any test, search `game/src/core/battle/turn/` for
`specialAttacks`/`specialAttackCounter` (the legacy counter field lives
on `BattleEnemy`, `Battle.ts:52` — confirm whether `TurnBattleParticipant`
has an equivalent, or whether this is entirely unread on the turn side
today). This determines whether this task is content-only (Steps 2-3
directly) or needs a new reader (insert an additional Step here, mirroring
A2's Component 1 "populate `Enemy` data + wire the participant field +
add the reader in `applyActionImpact()`" shape — if so, add a
`specialAttackCounter?: number` field to `TurnBattleParticipant`
(`TurnBattleSystem.ts:87-105`), increment it once per landed hit from
that enemy, and check `counter % everyNth === 0` to swap in the special
attack's `damageMultiplier` for that hit, matching the legacy
`BattleSystem`'s own `everyNth` semantics exactly — read the legacy
implementation before writing the turn-based equivalent to confirm the
exact modulo/off-by-one convention it uses).

- [ ] **Step 2: Write the failing test**

If a reader already exists, write a content-only integration test
proving the boss's special attack fires on the Nth hit in a real turn
battle (mirror A2 plan's Task 3 pattern — real `defineEnemy`/production
data, not a hand-built fixture only). If no reader exists, write the
reader's unit test first (counter increments per landed hit, resets
never — matches legacy `specialAttackCounter` never resetting mid-battle
per `Battle.ts:52`'s comment), then the integration test.

- [ ] **Step 3: Run test to verify it fails**

Run: `cd game && npx vitest run src/core/battle/turn/TurnBattleSystem.specialAttacks.test.ts`
Expected: FAIL.

- [ ] **Step 4: Implement (reader, if needed, then content)**

Add `specialAttacks` to the 3 boss entries in `Enemies.ts`. Starting
values (playtesting starting points, not locked balance — mirrors the
existing `water_surge` example's proportions):

```typescript
// mortal_ferocious_giant_crocodile (Phàm Nhân realm-final)
specialAttacks: [{ everyNth: 4, damageMultiplier: 2, presetId: 'water_surge' }],

// ferocious_flood_serpent (Luyện Khí realm-final)
specialAttacks: [{ everyNth: 4, damageMultiplier: 2.5, presetId: 'water_surge' }],

// foundation_ferocious_flood_dragon_whelp (Trúc Cơ realm-final)
specialAttacks: [{ everyNth: 4, damageMultiplier: 3, presetId: 'water_surge' }],
```

Insert each into its respective enemy's existing object literal in
`Enemies.ts`, following the exact key ordering/style convention already
used by neighboring entries in that file (read the surrounding lines of
each entry before editing — don't reformat unrelated fields).

- [ ] **Step 5: Run test to verify it passes**

Run: `cd game && npx vitest run src/core/battle/turn/TurnBattleSystem.specialAttacks.test.ts`
Expected: PASS

- [ ] **Step 6: Run the full existing `Enemies.ts`-consuming test suites**

Run: `cd game && npx vitest run src/data/enemy src/core/battle/turn/TurnBattleSystem`
Expected: All existing tests still PASS.

- [ ] **Step 7: Commit**

```bash
git add game/src/data/enemy/Enemies.ts game/src/core/battle/turn/TurnBattleSystem.ts game/src/core/battle/turn/TurnBattleSystem.specialAttacks.test.ts
git commit -m "feat(turn-combat): add specialAttacks content for the 3 realm-final bosses"
```

---

## Final Verification

- [ ] Full suite: `cd game && npx vitest run`
- [ ] Type-check: `cd game && npx vue-tsc --noEmit`
- [ ] Build: `cd game && npm run build`
- [ ] No P14 (visual/playwright) trigger required — this plan is pure
  data/logic content, no new render surface, per the spec's Testing
  Strategy section, UNLESS Task 5 Step 1's investigation finds the
  existing boss special-attack VFX preset (`water_surge`) is already
  wired to a visible on-screen effect that this plan newly makes fire in
  turn-based production for the first time — if so, add a P14 pass for
  that one visual before calling this plan complete.
