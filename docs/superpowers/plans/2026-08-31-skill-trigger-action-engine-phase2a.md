# Skill Trigger/Action Engine — Phase 2A (Complete Vocabulary) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the trigger/action engine's vocabulary — all 10 `TriggerType`s and all 10 `SkillActionType`s — so any future skill (player OR enemy) can express any current combat mechanic through `triggers`, with zero remaining `effects`-only mechanic.

**Architecture:** Extends the Phase 1 engine (`SkillAction.ts`/`SkillTrigger.ts`/`SkillActionRegistry.ts`/`SkillTriggerRunner.ts`, already shipped) rather than replacing it. Three triggers (`onProc`/`onResourceFull`/`onBreak`) fire *from inside* the action executor that causes them via a new `fireNested` helper threaded into every `ActionExecutor` — no hand-wired call site needed for those three. The other three new triggers (`onHit`/`onCrit`/`onEvade`, `onKill`/`onDeath`, `onTick`) get real call sites at their one true firing location each (already located during design: `BattleSystem.ts`'s missile-resolve callback, `CombatSystem.killIfDead()`, `BattleSystem.resolveChannelTick()`).

**Tech Stack:** TypeScript, Vitest, existing `game/src/core/skill`/`game/src/core/battle`/`game/src/core/combat` modules.

**Spec:** `docs/superpowers/specs/2026-08-31-skill-trigger-action-rework-design.md` (see "Phase 2 — complete vocabulary + universal entity model" section)

## Global Constraints

- No skill's real data changes in this plan — this completes the *engine*, not migrated content. `Skills.ts`/enemy data files are untouched.
- `SkillActionType` stays exhaustive: `SKILL_ACTION_REGISTRY`'s mapped type must have every member; a missing executor is a compile error.
- `applyMovement` is NOT a new action — knockback becomes a field on `dealDamage` (`knockbackDistance?`), root is already covered by `applyAilment` (the `troi_chan` ailment). Do not add a movement action.
- `addStack`/`removeBuff` (old `SkillEffectType` members) are NOT ported — dead code in `SkillEffectSystem.apply()`, no consumer. Do not build executors for them.
- Universal entity model (enemies using `Skill[]`/`triggers` instead of `specialAttacks[]`) is explicitly **out of scope for this plan** — it is Phase 2B, a separate plan, because it depends on this plan's actions existing and is a large, separable data-migration task (per spec's "Scope Check" splitting guidance). This plan only needs every action/trigger to work for an arbitrary `CombatEntity` (never assume `source`/`target` is the player) — that generic contract already holds from Phase 1 and must not regress.

---

### Task 1: Extend `SkillAction.ts` and `SkillTrigger.ts` with the full vocabulary

**Files:**
- Modify: `game/src/core/skill/SkillAction.ts`
- Modify: `game/src/core/skill/SkillTrigger.ts`

**Interfaces:**
- Produces: 10 new `SkillAction` union members (`HealAction`, `ApplyBuffAction`, `ApplyDebuffAction`, `ApplyAilmentAction`, `GrantResourceAction`, `ConsumeResourceAction`, `ConsumeForDamageAction`, `SpawnZoneAction`, `SpawnVfxAction`, plus `DealDamageAction` gains `knockbackDistance?: number`); `SkillResourcePoolKey` type; 7 new `TriggerType` members (`onKill`, `onDeath`, `onTick`, `onProc`, `onBreak`, `onResourceFull` — `onDodge` from the original spec table is dropped, see note below) with their context types.

Note on scope vs. the original spec table: the spec's trigger table listed `onDodge` (self evaded an incoming attack) as a candidate. No firing site for it was identified during design (only `onEvade` — the *attacker's* skill reacting to being evaded — has a located call site), and no action in this plan's vocabulary needs it. Per YAGNI, do not add `onDodge` in this task; a future plan adds it when something needs it (one union member + one context type + one firing call, per the engine's own extensibility promise).

- [ ] **Step 1: Add `SkillResourcePoolKey` and the 10 new action interfaces to `game/src/core/skill/SkillAction.ts`**

Replace the file's contents with:

```ts
import type { SkillDamageComponent } from './SkillDamageComponent'
import type { StatType } from '../stats/StatTypes'
import type { AilmentId } from '../ailment/AilmentTypes'
import type { CombatVfxPresetId } from '../battle/CombatAction'

// Trigger/Action rework (2026-08-31 spec, Phase 2A) — replaces the old
// per-mechanic fields on SkillEffect/Skill with composable actions. Every
// SkillActionType has a real executor in SkillActionRegistry.ts — the
// mapped-type registry there is exhaustive, so a missing executor is a
// compile error, not a silent no-op.
export interface DealDamageAction {
  type: 'dealDamage'

  value?: number

  damageType?: 'physical' | 'primordial'

  components?: SkillDamageComponent[]

  attributeScaling?: { attributes: StatType[]; ratioPerPoint: number }[]

  swordIntentDamageRatio?: number

  realmDamageRatio?: number

  manaScalingRatio?: number

  skillExperienceRatio?: number

  hitCountByRealm?: boolean

  // Phase 2A — batch-level knockback (Thổ Tu pattern). Read at
  // beginSkillBatch() time in BattleSystem.ts, same as
  // earthPureAreaBehavior today; NOT a per-hit field on the executor.
  knockbackDistance?: number
}

export interface HealAction {
  type: 'heal'

  value?: number

  // Reads runtime.consumedDamage, written by a prior consumeForDamage
  // action in the same TriggerBinding's action list.
  healPercentOfDamage?: number
}

export interface ApplyBuffAction {
  type: 'applyBuff'

  buffId: string
}

export interface ApplyDebuffAction {
  type: 'applyDebuff'

  buffId: string
}

export interface ApplyAilmentAction {
  type: 'applyAilment'

  ailmentId: AilmentId

  chance?: number
}

// Named resource pools every path can grant/consume — mirrors the fields
// already on CombatEntity (currentSwordIntent, currentMomentum,
// currentHoaThe, currentThoThe, currentKimThe, currentHuyetPha).
export type SkillResourcePoolKey =
  | 'swordIntent'
  | 'momentum'
  | 'hoaThe'
  | 'thoThe'
  | 'kimThe'
  | 'huyetPha'

export interface GrantResourceAction {
  type: 'grantResource'

  pool: SkillResourcePoolKey

  amount: number
}

export interface ConsumeResourceAction {
  type: 'consumeResource'

  // 'breakGauge' targets the TARGET entity's Break Gauge (not source's
  // pool) — the only pool this action reads off `target` instead of
  // `source`. Fires onBreak when it reaches 0.
  pool: SkillResourcePoolKey | 'breakGauge'

  amount: number | 'all'
}

export interface ConsumeForDamageAction {
  type: 'consumeForDamage'

  // 'ailment' = Detonate (consumesAilmentId+damagePerStack pattern),
  // 'ward' = ward-break (consumesWardForDamage+damagePerWardPoint pattern).
  source: 'ailment' | 'ward'

  ailmentId?: AilmentId

  damagePerUnit: number

  healPercentOfDamage?: number
}

export interface SpawnZoneAction {
  type: 'spawnZone'

  zoneKind: 'lava' | 'sword'

  charges: number

  tickInterval: number

  damageRatio: number

  position: 'source' | 'target'
}

export interface SpawnVfxAction {
  type: 'spawnVfx'

  presetId: CombatVfxPresetId

  target?: 'source' | 'target'
}

export type SkillAction =
  | DealDamageAction
  | HealAction
  | ApplyBuffAction
  | ApplyDebuffAction
  | ApplyAilmentAction
  | GrantResourceAction
  | ConsumeResourceAction
  | ConsumeForDamageAction
  | SpawnZoneAction
  | SpawnVfxAction

export type SkillActionType = SkillAction['type']

/**
 * Scratch state shared by every action inside one TriggerBinding's action
 * list, seeded from the firing trigger's context. Lets a later action read
 * a value an earlier action produced (e.g. consumeForDamage writing
 * consumedDamage for a following heal to read) without either action
 * knowing the other by name.
 */
export interface ActionRuntimeContext {
  damageDealt?: number

  isCrit?: boolean

  consumedDamage?: number

  consumedAmount?: number
}
```

- [ ] **Step 2: Add the 6 new trigger context types to `game/src/core/skill/SkillTrigger.ts`**

Replace the file's contents with:

```ts
import type { CombatEntity } from '../combat/CombatEntity'
import type { Skill } from './Skill'
import type { SkillAction } from './SkillAction'
import type { AilmentId } from '../ailment/AilmentTypes'
import type { SkillResourcePoolKey } from './SkillAction'

// Trigger/Action rework (2026-08-31 spec, Phase 2A) — full vocabulary.
// onHit/onCrit/onEvade, onKill/onDeath, and onTick have real hand-wired
// firing sites (see the plan's Task 9/10/11). onProc/onResourceFull/
// onBreak fire from INSIDE the action executor that causes them (see
// SkillActionRegistry.ts's fireNested helper) — no separate firing site.
export type TriggerType =
  | 'onCast'
  | 'onHit'
  | 'onCrit'
  | 'onEvade'
  | 'onKill'
  | 'onDeath'
  | 'onTick'
  | 'onProc'
  | 'onBreak'
  | 'onResourceFull'

export interface OnCastContext {
  source: CombatEntity

  skill: Skill
}

export interface OnHitContext {
  source: CombatEntity

  target: CombatEntity

  skill: Skill

  damageDealt: number

  isCrit: boolean
}

export type OnCritContext = OnHitContext

export interface OnEvadeContext {
  source: CombatEntity

  target: CombatEntity

  skill: Skill
}

export interface OnKillContext {
  source: CombatEntity

  target: CombatEntity

  skill: Skill
}

export interface OnDeathContext {
  source: CombatEntity
}

export interface OnTickContext {
  source: CombatEntity

  target: CombatEntity

  skill: Skill

  tickIndex: number
}

export interface OnProcContext {
  source: CombatEntity

  target: CombatEntity

  skill: Skill

  ailmentId: AilmentId
}

export interface OnBreakContext {
  source: CombatEntity

  target: CombatEntity
}

export interface OnResourceFullContext {
  source: CombatEntity

  resource: SkillResourcePoolKey
}

export interface TriggerContextMap {
  onCast: OnCastContext

  onHit: OnHitContext

  onCrit: OnCritContext

  onEvade: OnEvadeContext

  onKill: OnKillContext

  onDeath: OnDeathContext

  onTick: OnTickContext

  onProc: OnProcContext

  onBreak: OnBreakContext

  onResourceFull: OnResourceFullContext
}

export interface TriggerBinding<T extends TriggerType = TriggerType> {
  trigger: T

  actions: SkillAction[]
}
```

- [ ] **Step 3: Type-check**

Run: `cd game && npm run type-check`
Expected: FAIL — `SkillActionRegistry.ts`'s `SKILL_ACTION_REGISTRY` is no
longer exhaustive (`Record<SkillActionType, ...>` is now missing 9
executors). This is the correct, expected failure — Task 2 fixes it. Do not
add stub executors here to make it pass; that belongs to Task 2 alongside
its tests.

- [ ] **Step 4: Commit**

```bash
git add game/src/core/skill/SkillAction.ts game/src/core/skill/SkillTrigger.ts
git commit -m "feat(skill): extend trigger/action vocabulary — 6 new trigger contexts, 9 new action interfaces"
```

---

### Task 2: Nested-firing plumbing (`fireNested`) in `SkillActionRegistry.ts`/`SkillTriggerRunner.ts`

**Files:**
- Modify: `game/src/core/skill/SkillActionRegistry.ts`
- Modify: `game/src/core/skill/SkillTriggerRunner.ts`
- Modify: `game/src/core/skill/SkillActionRegistry.test.ts` (existing `dealDamage` tests call `runSkillAction` — signature changes, update call sites)
- Modify: `game/src/core/skill/SkillTriggerRunner.test.ts` (existing tests call `.fire()` — signature unchanged, but the runner's internals change; re-run to confirm no regression)
- Modify: `game/src/core/skill/SkillEffectParity.test.ts` (calls `runSkillAction` directly — update call site)

**Interfaces:**
- Produces: `ActionExecutionHelpers { fireNested: <T extends TriggerType>(trigger: T, context: TriggerContextMap[T]) => void }`; `ActionExecutor<A>` signature becomes `(action: A, source: CombatEntity, target: CombatEntity, ctx: SkillEffectContext, runtime: ActionRuntimeContext, helpers: ActionExecutionHelpers) => void`; `runSkillAction(action, source, target, ctx, runtime, helpers)`.
- Consumes: `TriggerType`/`TriggerContextMap`/`TriggerBinding` (Task 1).

This task is pure plumbing — it does not implement any of the 9 new
executors yet (Tasks 3-8 do). `dealDamage` is the only real executor today;
it gets the new 6th parameter added to its signature but does not use it
(it has no nested trigger to fire).

- [ ] **Step 1: Update `game/src/core/skill/SkillActionRegistry.ts`**

```ts
import type { ActionRuntimeContext, SkillAction, SkillActionType } from './SkillAction'
import type { CombatEntity } from '../combat/CombatEntity'
import type { SkillEffectContext } from './SkillEffectSystem'
import type { TriggerContextMap, TriggerType } from './SkillTrigger'

export interface ActionExecutionHelpers {
  fireNested: <T extends TriggerType>(trigger: T, context: TriggerContextMap[T]) => void
}

export type ActionExecutor<A extends SkillAction = SkillAction> = (
  action: A,
  source: CombatEntity,
  target: CombatEntity,
  ctx: SkillEffectContext,
  runtime: ActionRuntimeContext,
  helpers: ActionExecutionHelpers,
) => void

// Ported verbatim from SkillEffectSystem.apply()'s case 'damage' — same
// scaling formula, same fireHit contract. consumesAilmentId/
// consumesWardForDamage/grantsSwordZone stay on the OLD SkillEffect path
// until their own dedicated actions (consumeForDamage/spawnZone) are built
// in a later plan; dealDamage only owns the plain-hit subset.
const dealDamage: ActionExecutor<Extract<SkillAction, { type: 'dealDamage' }>> = (
  action,
  source,
  target,
  ctx,
) => {
  const scalingBonus =
    (action.attributeScaling ?? []).reduce(
      (sum, entry) =>
        sum +
        (entry.attributes.length === 0
          ? 0
          : entry.ratioPerPoint * Math.max(...entry.attributes.map((stat) => source.stats[stat]))),
      0,
    ) +
    (action.swordIntentDamageRatio ? action.swordIntentDamageRatio * source.currentSwordIntent : 0) +
    (action.realmDamageRatio ? action.realmDamageRatio * source.realmIndex : 0) +
    (action.manaScalingRatio ? action.manaScalingRatio * source.stats.maxMp : 0) +
    (action.skillExperienceRatio
      ? (action.skillExperienceRatio * (ctx.skillExperience ?? 0)) / Math.max(1, source.stats.attack)
      : 0)

  const finalMultiplier = (action.value ?? 1) * (1 + scalingBonus) * (1 + source.stats.skillDamagePercent)

  const hitCount = action.hitCountByRealm ? source.realmIndex + 1 : 1

  for (let hitIndex = 0; hitIndex < hitCount; hitIndex++) {
    if (!target.alive) {
      break
    }

    if (action.components) {
      ctx.fireHit(target, { kind: 'elemental', components: action.components, multiplier: finalMultiplier })
    } else {
      ctx.fireHit(target, { kind: action.damageType ?? 'physical', multiplier: finalMultiplier })
    }
  }
}

export const SKILL_ACTION_REGISTRY: { [K in SkillActionType]: ActionExecutor<Extract<SkillAction, { type: K }>> } = {
  dealDamage,
} as { [K in SkillActionType]: ActionExecutor<Extract<SkillAction, { type: K }>> }

export function runSkillAction(
  action: SkillAction,
  source: CombatEntity,
  target: CombatEntity,
  ctx: SkillEffectContext,
  runtime: ActionRuntimeContext,
  helpers: ActionExecutionHelpers,
): void {
  const executor = SKILL_ACTION_REGISTRY[action.type] as ActionExecutor
  executor(action, source, target, ctx, runtime, helpers)
}
```

Note the `as { [K in SkillActionType]: ... }` cast on `SKILL_ACTION_REGISTRY`:
this is temporary and INTENTIONAL for this task only — with only `dealDamage`
implemented, the object literal is genuinely missing 9 keys, so without the
cast the assignment doesn't compile. Tasks 3-8 add the missing executors one
by one; the LAST of those tasks (Task 8) removes this cast once the object
literal is genuinely exhaustive, restoring the compile-time safety net
(a missing executor becomes a compile error again). Do not skip removing it.

- [ ] **Step 2: Update `game/src/core/skill/SkillTriggerRunner.ts`**

```ts
import type { OnHitContext, TriggerBinding, TriggerContextMap, TriggerType } from './SkillTrigger'
import type { CombatEntity } from '../combat/CombatEntity'
import type { SkillEffectContext } from './SkillEffectSystem'
import type { ActionExecutionHelpers } from './SkillActionRegistry'
import { runSkillAction } from './SkillActionRegistry'

/**
 * Matches a firing TriggerType against skill.triggers and runs the bound
 * actions in declared order, sharing one ActionRuntimeContext scratch
 * object per binding so a later action can read an earlier action's
 * result. Each action also receives a `fireNested` helper bound to the
 * SAME triggers/source/target/ctx, so an executor (applyAilment,
 * grantResource, consumeResource) can fire onProc/onResourceFull/onBreak
 * on the same skill without needing its own copy of the runner.
 */
export class SkillTriggerRunner {
  fire<T extends TriggerType>(
    trigger: T,
    context: TriggerContextMap[T],
    triggers: TriggerBinding[] | undefined,
    source: CombatEntity,
    target: CombatEntity,
    ctx: SkillEffectContext,
  ): void {
    const bindings = (triggers ?? []).filter(
      (binding): binding is TriggerBinding<T> => binding.trigger === trigger,
    )

    for (const binding of bindings) {
      const hitContext = context as Partial<OnHitContext>
      const runtime = {
        ...(hitContext.damageDealt !== undefined
          ? { damageDealt: hitContext.damageDealt, isCrit: hitContext.isCrit }
          : {}),
      }

      const helpers: ActionExecutionHelpers = {
        fireNested: (nestedTrigger, nestedContext) => {
          this.fire(nestedTrigger, nestedContext, triggers, source, target, ctx)
        },
      }

      for (const action of binding.actions) {
        runSkillAction(action, source, target, ctx, runtime, helpers)
      }
    }
  }
}
```

- [ ] **Step 3: Update the 3 existing test files' `runSkillAction`/`ActionExecutor` call sites**

In `game/src/core/skill/SkillActionRegistry.test.ts`, every call to
`runSkillAction(action, source, target, ctx, runtime)` gains a 6th argument.
Add a no-op helpers object at the top of the file, right after the existing
`makeCtx` helper:

```ts
function makeHelpers(): ActionExecutionHelpers {
  return { fireNested: () => {} }
}
```

(add `import type { ActionExecutionHelpers } from './SkillActionRegistry'` to
the file's imports), then change every `runSkillAction(action, source,
target, ctx, {})` call to `runSkillAction(action, source, target, ctx, {},
makeHelpers())`.

In `game/src/core/skill/SkillEffectParity.test.ts`, the single
`runSkillAction({ type: 'dealDamage', ... }, source, target, makeCtx(...),
{})` call gains the same 6th argument — add the same `makeHelpers()` helper
and pass it.

`SkillTriggerRunner.test.ts` needs no signature changes (its `.fire()` calls
are unchanged) — just re-run it to confirm.

- [ ] **Step 4: Run all 3 test files**

Run: `cd game && npx vitest run src/core/skill/SkillActionRegistry.test.ts src/core/skill/SkillTriggerRunner.test.ts src/core/skill/SkillEffectParity.test.ts`
Expected: PASS (all previously-passing tests still pass — this task changes
signatures, not behavior, for the one executor that exists).

- [ ] **Step 5: Type-check**

Run: `cd game && npm run type-check`
Expected: still FAIL for the same reason as Task 1 Step 3 (the temporary
cast in Step 1 above suppresses the exhaustiveness error, so this should
now actually PASS — if it still fails, something in Step 1's cast is wrong;
fix before proceeding).

- [ ] **Step 6: Commit**

```bash
git add game/src/core/skill/SkillActionRegistry.ts game/src/core/skill/SkillTriggerRunner.ts game/src/core/skill/SkillActionRegistry.test.ts game/src/core/skill/SkillEffectParity.test.ts
git commit -m "feat(skill): add fireNested plumbing for onProc/onResourceFull/onBreak"
```

---

### Task 3: `heal` / `applyBuff` / `applyDebuff` executors

**Files:**
- Modify: `game/src/core/skill/SkillActionRegistry.ts`
- Modify: `game/src/core/skill/SkillActionRegistry.test.ts`

**Interfaces:**
- Consumes: `HealAction`/`ApplyBuffAction`/`ApplyDebuffAction` (Task 1); `SkillEffectContext.combatSystem.applyHealing`, `.sourceBuffs`, `.targetBuffs`, `.buffRegistry` (all pre-existing, used identically to `SkillEffectSystem.apply()`'s `case 'heal'`/`'buff'`/`'debuff'`).
- Produces: 3 more entries in `SKILL_ACTION_REGISTRY`.

These three are the simplest remaining actions — no nested firing, direct
ports of `SkillEffectSystem.apply()`'s corresponding cases.

- [ ] **Step 1: Write the failing tests**

Add to `game/src/core/skill/SkillActionRegistry.test.ts`:

```ts
describe('heal executor', () => {
  it('calls ctx.combatSystem.applyHealing(target, value, source.id, "healing")', () => {
    const source = makeEntity()
    const target = makeEntity()
    const applyHealing = vi.fn()
    const ctx = makeCtx({ combatSystem: { applyHealing } as unknown as SkillEffectContext['combatSystem'] })

    runSkillAction({ type: 'heal', value: 10 }, source, target, ctx, {}, makeHelpers())

    expect(applyHealing).toHaveBeenCalledWith(target, 10, source.id, 'healing')
  })

  it('healPercentOfDamage scales off runtime.consumedDamage', () => {
    const source = makeEntity()
    const target = makeEntity()
    const applyHealing = vi.fn()
    const ctx = makeCtx({ combatSystem: { applyHealing } as unknown as SkillEffectContext['combatSystem'] })

    runSkillAction(
      { type: 'heal', healPercentOfDamage: 0.5 },
      source,
      target,
      ctx,
      { consumedDamage: 100 },
      makeHelpers(),
    )

    expect(applyHealing).toHaveBeenCalledWith(target, 50, source.id, 'healing')
  })
})

describe('applyBuff executor', () => {
  it('applies buffId to ctx.sourceBuffs via ctx.buffRegistry', () => {
    const source = makeEntity()
    const target = makeEntity()
    const apply = vi.fn()
    const get = vi.fn(() => ({ id: 'khiem_phong' }))
    const ctx = makeCtx({
      sourceBuffs: { apply } as unknown as SkillEffectContext['sourceBuffs'],
      buffRegistry: { get } as unknown as SkillEffectContext['buffRegistry'],
    })

    runSkillAction({ type: 'applyBuff', buffId: 'khiem_phong' }, source, target, ctx, {}, makeHelpers())

    expect(get).toHaveBeenCalledWith('khiem_phong')
    expect(apply).toHaveBeenCalledWith({ id: 'khiem_phong' })
  })
})

describe('applyDebuff executor', () => {
  it('applies buffId to ctx.targetBuffs via ctx.buffRegistry', () => {
    const source = makeEntity()
    const target = makeEntity()
    const apply = vi.fn()
    const get = vi.fn(() => ({ id: 'suy_nhuoc' }))
    const ctx = makeCtx({
      targetBuffs: { apply } as unknown as SkillEffectContext['targetBuffs'],
      buffRegistry: { get } as unknown as SkillEffectContext['buffRegistry'],
    })

    runSkillAction({ type: 'applyDebuff', buffId: 'suy_nhuoc' }, source, target, ctx, {}, makeHelpers())

    expect(get).toHaveBeenCalledWith('suy_nhuoc')
    expect(apply).toHaveBeenCalledWith({ id: 'suy_nhuoc' })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd game && npx vitest run src/core/skill/SkillActionRegistry.test.ts`
Expected: FAIL — `SKILL_ACTION_REGISTRY.heal`/`.applyBuff`/`.applyDebuff` are
`undefined` (property access on the registry object throws, or the cast
from Task 2 hides it — either way `runSkillAction` throws or no-ops
incorrectly).

- [ ] **Step 3: Add the 3 executors to `SkillActionRegistry.ts`**

Add above the `SKILL_ACTION_REGISTRY` object literal:

```ts
const heal: ActionExecutor<Extract<SkillAction, { type: 'heal' }>> = (action, source, target, ctx, runtime) => {
  const value = (action.value ?? 0) + (action.healPercentOfDamage ? action.healPercentOfDamage * (runtime.consumedDamage ?? 0) : 0)

  ctx.combatSystem.applyHealing(target, value, source.id, 'healing')
}

const applyBuff: ActionExecutor<Extract<SkillAction, { type: 'applyBuff' }>> = (action, _source, _target, ctx) => {
  ctx.sourceBuffs.apply(ctx.buffRegistry.get(action.buffId))
}

const applyDebuff: ActionExecutor<Extract<SkillAction, { type: 'applyDebuff' }>> = (action, _source, _target, ctx) => {
  ctx.targetBuffs.apply(ctx.buffRegistry.get(action.buffId))
}
```

Add the 3 entries to `SKILL_ACTION_REGISTRY`:

```ts
export const SKILL_ACTION_REGISTRY: { [K in SkillActionType]: ActionExecutor<Extract<SkillAction, { type: K }>> } = {
  dealDamage,
  heal,
  applyBuff,
  applyDebuff,
} as { [K in SkillActionType]: ActionExecutor<Extract<SkillAction, { type: K }>> }
```

(the cast stays until Task 8 — see Task 2's note).

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd game && npx vitest run src/core/skill/SkillActionRegistry.test.ts`
Expected: PASS (all tests in the file, including Phase 1's `dealDamage` ones).

- [ ] **Step 5: Commit**

```bash
git add game/src/core/skill/SkillActionRegistry.ts game/src/core/skill/SkillActionRegistry.test.ts
git commit -m "feat(skill): add heal/applyBuff/applyDebuff executors"
```

---

### Task 4: `applyAilment` executor + `onProc` nested firing

**Files:**
- Modify: `game/src/core/skill/SkillActionRegistry.ts`
- Modify: `game/src/core/skill/SkillActionRegistry.test.ts`

**Interfaces:**
- Consumes: `ApplyAilmentAction` (Task 1); `ActionExecutionHelpers.fireNested` (Task 2); `SkillEffectContext.targetAilments.apply`, `.ailmentRegistry.get`, `.reactionManager.checkAndTrigger` (all pre-existing).
- Produces: 1 more entry in `SKILL_ACTION_REGISTRY`.

Ported from `SkillEffectSystem.apply()`'s `case 'ailment'`, MINUS the
`grantsKimThePerProc`/`grantsHuyetPhaPerProc` flags — those become separate
`onProc`-bound `grantResource` actions once a skill migrates, not flags on
this action (per the spec's Actions table). This executor's only new
responsibility versus the old code is firing `onProc` on a successful roll,
via `helpers.fireNested`.

- [ ] **Step 1: Write the failing test**

Add to `game/src/core/skill/SkillActionRegistry.test.ts`:

```ts
describe('applyAilment executor', () => {
  it('applies the ailment and fires onProc on a successful roll', () => {
    const source = makeEntity({ stats: { skillDamagePercent: 0, maxMp: 0, attack: 10, elementApplicationPercent: 0 } as CombatEntity['stats'] })
    const target = makeEntity()
    const apply = vi.fn()
    const get = vi.fn(() => ({ id: 'bong' }))
    const checkAndTrigger = vi.fn()
    const fireNested = vi.fn()
    const ctx = makeCtx({
      targetAilments: { apply } as unknown as SkillEffectContext['targetAilments'],
      ailmentRegistry: { get } as unknown as SkillEffectContext['ailmentRegistry'],
      reactionManager: { checkAndTrigger } as unknown as SkillEffectContext['reactionManager'],
    })
    vi.spyOn(Math, 'random').mockReturnValue(0)

    runSkillAction(
      { type: 'applyAilment', ailmentId: 'bong', chance: 1 },
      source,
      target,
      ctx,
      {},
      { fireNested },
    )

    expect(apply).toHaveBeenCalledWith({ id: 'bong' }, source, target, { get })
    expect(fireNested).toHaveBeenCalledWith('onProc', { source, target, skill: undefined, ailmentId: 'bong' })
    expect(checkAndTrigger).toHaveBeenCalled()

    vi.restoreAllMocks()
  })

  it('does not apply or fire onProc when the roll fails', () => {
    const source = makeEntity({ stats: { skillDamagePercent: 0, maxMp: 0, attack: 10, elementApplicationPercent: 0 } as CombatEntity['stats'] })
    const target = makeEntity()
    const apply = vi.fn()
    const fireNested = vi.fn()
    const ctx = makeCtx({ targetAilments: { apply } as unknown as SkillEffectContext['targetAilments'] })
    vi.spyOn(Math, 'random').mockReturnValue(0.99)

    runSkillAction(
      { type: 'applyAilment', ailmentId: 'bong', chance: 0.5 },
      source,
      target,
      ctx,
      {},
      { fireNested },
    )

    expect(apply).not.toHaveBeenCalled()
    expect(fireNested).not.toHaveBeenCalled()

    vi.restoreAllMocks()
  })
})
```

Note: `skill: undefined` in the first assertion's expected `fireNested`
call — this executor has no access to the `Skill`/`EffectiveSkill` object
(only `action`/`source`/`target`/`ctx`/`runtime`/`helpers`), so the
`OnProcContext.skill` field is populated by `SkillTriggerRunner` itself
when it threads the nested `fire()` call through, NOT by this executor. Fix
the test to match once Step 3 is implemented — if the executor cannot
reasonably supply `skill`, adjust `OnProcContext` (Task 1) to drop the
`skill` field rather than pass `undefined` at runtime; use your judgment
here and note the choice in your report. (Recommended: keep `OnProcContext`
without a real `skill` reference is inconsistent with every other trigger
context having one — instead, thread `ctx.skillId` — already present on
`SkillEffectContext` — is a string not a `Skill`. Simplest correct fix:
executors do not build the nested context's `skill` field themselves;
`SkillTriggerRunner.fire()`'s outer call always knows the real `Skill`
because IT was called with a `skill` in its own trigger context — but
nested contexts are built by the EXECUTOR, which never received it. Resolve
this by adding `skill: Skill` as an explicit parameter the outer `fire()`
call passes down through `helpers` construction, so `fireNested`'s closure
already has it in scope and the executor only supplies the parts it
actually knows — `ailmentId`. Update `ActionExecutionHelpers.fireNested`'s
call sites accordingly: the executor calls
`helpers.fireNested('onProc', { source, target, ailmentId: action.ailmentId })`
(no `skill` field passed by the executor), and `SkillTriggerRunner`'s
`helpers.fireNested` closure merges in the `skill` it already has from its
own outer invocation before calling `this.fire()`. This requires changing
`ActionExecutionHelpers.fireNested`'s type to accept
`Omit<TriggerContextMap[T], 'skill'>` and have the runner merge `skill`
back in. Apply this correction to Task 2's `SkillTriggerRunner.ts` code
before writing this task's test, and update this test's expected call to
`fireNested).toHaveBeenCalledWith('onProc', { source, target, ailmentId: 'bong' })`
(no `skill` key).)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd game && npx vitest run src/core/skill/SkillActionRegistry.test.ts -t applyAilment`
Expected: FAIL — executor doesn't exist yet.

- [ ] **Step 3: Fix `SkillTriggerRunner.ts`'s `fireNested` to auto-merge `skill`, then add the executor**

In `game/src/core/skill/SkillTriggerRunner.ts`, change `ActionExecutionHelpers`'s
call inside `fire()`:

```ts
      const helpers: ActionExecutionHelpers = {
        fireNested: (nestedTrigger, nestedContext) => {
          this.fire(nestedTrigger, { ...nestedContext, skill: context.skill } as TriggerContextMap[typeof nestedTrigger], triggers, source, target, ctx)
        },
      }
```

This requires `context.skill` to exist on every context that can trigger a
nested fire — true for `onCast` (the only outer trigger that currently owns
an action capable of nesting: `applyAilment`/`grantResource`/
`consumeResource` are all called from within an `onCast`-bound action list
in this plan's scope, since those are the only actions with nested firing
and the only outer trigger wired so far is `onCast`). Also update
`ActionExecutionHelpers` in `SkillActionRegistry.ts`:

```ts
export interface ActionExecutionHelpers {
  fireNested: <T extends TriggerType>(trigger: T, context: Omit<TriggerContextMap[T], 'skill'>) => void
}
```

Now add the executor to `SkillActionRegistry.ts`, above `SKILL_ACTION_REGISTRY`:

```ts
const applyAilment: ActionExecutor<Extract<SkillAction, { type: 'applyAilment' }>> = (
  action,
  source,
  target,
  ctx,
  _runtime,
  helpers,
) => {
  const ailmentChance = Math.min(1, (action.chance ?? 1) + source.stats.elementApplicationPercent)

  if (Math.random() >= ailmentChance) {
    return
  }

  ctx.targetAilments.apply(ctx.ailmentRegistry.get(action.ailmentId), source, target, ctx.ailmentRegistry)

  helpers.fireNested('onProc', { source, target, ailmentId: action.ailmentId })

  ctx.reactionManager.checkAndTrigger(
    ctx.targetAilments,
    action.ailmentId,
    source,
    target,
    ctx.combatSystem,
    ctx.ailmentRegistry,
    ctx.sourceBuffs,
    ctx.buffRegistry,
    ctx.spawnLavaZone,
    ctx.reactionKeepChance ?? 0,
  )
}
```

Add `applyAilment,` to `SKILL_ACTION_REGISTRY`.

- [ ] **Step 4: Update and run the test**

Fix the test's expected `fireNested` call per Step 1's note (drop `skill`
key). Run: `cd game && npx vitest run src/core/skill/SkillActionRegistry.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Run `SkillTriggerRunner.test.ts` to confirm no regression from the helpers-type change**

Run: `cd game && npx vitest run src/core/skill/SkillTriggerRunner.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add game/src/core/skill/SkillActionRegistry.ts game/src/core/skill/SkillTriggerRunner.ts game/src/core/skill/SkillActionRegistry.test.ts
git commit -m "feat(skill): add applyAilment executor with onProc nested firing"
```

---

### Task 5: `grantResource` executor + `onResourceFull` nested firing

**Files:**
- Modify: `game/src/core/skill/SkillActionRegistry.ts`
- Modify: `game/src/core/skill/SkillActionRegistry.test.ts`

**Interfaces:**
- Consumes: `GrantResourceAction`/`SkillResourcePoolKey` (Task 1); `helpers.fireNested` (Task 2/4's corrected shape).
- Produces: 1 more entry in `SKILL_ACTION_REGISTRY`; a `RESOURCE_POOL_MAX`/`RESOURCE_POOL_FIELD` lookup table (also consumed by Task 6).

- [ ] **Step 1: Write the failing tests**

Add to `game/src/core/skill/SkillActionRegistry.test.ts`:

```ts
describe('grantResource executor', () => {
  it('adds amount to the pool field, clamped to the pool max', () => {
    const source = makeEntity({ currentHoaThe: 3 } as Partial<CombatEntity> as CombatEntity)
    const target = makeEntity()
    const fireNested = vi.fn()

    runSkillAction({ type: 'grantResource', pool: 'hoaThe', amount: 1 }, source, target, makeCtx(), {}, { fireNested })

    expect(source.currentHoaThe).toBe(4)
    expect(fireNested).not.toHaveBeenCalled()
  })

  it('fires onResourceFull when the write clamps to max', () => {
    const source = makeEntity({ currentHoaThe: 5 } as Partial<CombatEntity> as CombatEntity) // MAX_HOA_THE = 5
    const target = makeEntity()
    const fireNested = vi.fn()

    runSkillAction({ type: 'grantResource', pool: 'hoaThe', amount: 1 }, source, target, makeCtx(), {}, { fireNested })

    expect(source.currentHoaThe).toBe(5)
    expect(fireNested).toHaveBeenCalledWith('onResourceFull', { source, resource: 'hoaThe' })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd game && npx vitest run src/core/skill/SkillActionRegistry.test.ts -t grantResource`
Expected: FAIL.

- [ ] **Step 3: Add the pool lookup tables and executor to `SkillActionRegistry.ts`**

Add the import and lookup tables near the top of the file (below existing imports):

```ts
import { MAX_SWORD_INTENT, MAX_MOMENTUM, MAX_HOA_THE, MAX_THO_THE, MAX_KIM_THE, MAX_HUYET_PHA } from '../combat/CombatTypes'
import type { SkillResourcePoolKey } from './SkillAction'

// Shared by grantResource (Task 5) and consumeResource (Task 6) — every
// named pool's CombatEntity field and hard cap. Pools with no cap in
// today's game (none currently) would map to Infinity; all 6 current
// pools have one.
export const RESOURCE_POOL_FIELD: Record<SkillResourcePoolKey, keyof CombatEntity> = {
  swordIntent: 'currentSwordIntent',
  momentum: 'currentMomentum',
  hoaThe: 'currentHoaThe',
  thoThe: 'currentThoThe',
  kimThe: 'currentKimThe',
  huyetPha: 'currentHuyetPha',
}

export const RESOURCE_POOL_MAX: Record<SkillResourcePoolKey, number> = {
  swordIntent: MAX_SWORD_INTENT,
  momentum: MAX_MOMENTUM,
  hoaThe: MAX_HOA_THE,
  thoThe: MAX_THO_THE,
  kimThe: MAX_KIM_THE,
  huyetPha: MAX_HUYET_PHA,
}
```

Add the executor above `SKILL_ACTION_REGISTRY`:

```ts
const grantResource: ActionExecutor<Extract<SkillAction, { type: 'grantResource' }>> = (
  action,
  source,
  _target,
  _ctx,
  _runtime,
  helpers,
) => {
  const field = RESOURCE_POOL_FIELD[action.pool]
  const max = RESOURCE_POOL_MAX[action.pool]
  const current = (source[field] as number | undefined) ?? 0

  const next = Math.min(max, current + action.amount)

  ;(source[field] as number) = next

  if (next >= max) {
    helpers.fireNested('onResourceFull', { source, resource: action.pool })
  }
}
```

Add `grantResource,` to `SKILL_ACTION_REGISTRY`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd game && npx vitest run src/core/skill/SkillActionRegistry.test.ts`
Expected: PASS.

- [ ] **Step 5: Type-check**

Run: `cd game && npm run type-check`
Expected: PASS — `(source[field] as number) = next` is a deliberate cast;
confirm it compiles cleanly (if TS rejects assigning through a computed
`keyof CombatEntity` cast, use `Reflect.set(source, field, next)` instead
and re-verify).

- [ ] **Step 6: Commit**

```bash
git add game/src/core/skill/SkillActionRegistry.ts game/src/core/skill/SkillActionRegistry.test.ts
git commit -m "feat(skill): add grantResource executor with onResourceFull nested firing"
```

---

### Task 6: `consumeResource` executor + `onBreak` nested firing

**Files:**
- Modify: `game/src/core/skill/SkillActionRegistry.ts`
- Modify: `game/src/core/skill/SkillActionRegistry.test.ts`

**Interfaces:**
- Consumes: `ConsumeResourceAction` (Task 1); `RESOURCE_POOL_FIELD` (Task 5, for the non-`'breakGauge'` branch); `helpers.fireNested`.
- Produces: 1 more entry in `SKILL_ACTION_REGISTRY`.

Two branches: normal pools (subtract from `source`, write `runtime.consumedAmount`)
and `'breakGauge'` (subtract from `target.currentBreakGauge`, fire `onBreak`
at 0 — replaces `breakDamagePerHit`).

- [ ] **Step 1: Write the failing tests**

Add to `game/src/core/skill/SkillActionRegistry.test.ts`:

```ts
describe('consumeResource executor', () => {
  it('subtracts amount from the pool and writes runtime.consumedAmount', () => {
    const source = makeEntity({ currentKimThe: 5 } as Partial<CombatEntity> as CombatEntity)
    const target = makeEntity()
    const runtime: ActionRuntimeContext = {}

    runSkillAction({ type: 'consumeResource', pool: 'kimThe', amount: 2 }, source, target, makeCtx(), runtime, makeHelpers())

    expect(source.currentKimThe).toBe(3)
    expect(runtime.consumedAmount).toBe(2)
  })

  it("'all' consumes the entire pool", () => {
    const source = makeEntity({ currentKimThe: 5 } as Partial<CombatEntity> as CombatEntity)
    const target = makeEntity()
    const runtime: ActionRuntimeContext = {}

    runSkillAction({ type: 'consumeResource', pool: 'kimThe', amount: 'all' }, source, target, makeCtx(), runtime, makeHelpers())

    expect(source.currentKimThe).toBe(0)
    expect(runtime.consumedAmount).toBe(5)
  })

  it("pool 'breakGauge' subtracts from TARGET and fires onBreak at 0", () => {
    const source = makeEntity()
    const target = makeEntity({ currentBreakGauge: 3, breakGaugeMax: 100 } as Partial<CombatEntity> as CombatEntity)
    const fireNested = vi.fn()

    runSkillAction({ type: 'consumeResource', pool: 'breakGauge', amount: 3 }, source, target, makeCtx(), {}, { fireNested })

    expect(target.currentBreakGauge).toBe(0)
    expect(fireNested).toHaveBeenCalledWith('onBreak', { source, target })
  })

  it("pool 'breakGauge' does NOT fire onBreak above 0", () => {
    const source = makeEntity()
    const target = makeEntity({ currentBreakGauge: 10, breakGaugeMax: 100 } as Partial<CombatEntity> as CombatEntity)
    const fireNested = vi.fn()

    runSkillAction({ type: 'consumeResource', pool: 'breakGauge', amount: 3 }, source, target, makeCtx(), {}, { fireNested })

    expect(target.currentBreakGauge).toBe(7)
    expect(fireNested).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd game && npx vitest run src/core/skill/SkillActionRegistry.test.ts -t consumeResource`
Expected: FAIL.

- [ ] **Step 3: Add the executor to `SkillActionRegistry.ts`**

```ts
const consumeResource: ActionExecutor<Extract<SkillAction, { type: 'consumeResource' }>> = (
  action,
  source,
  target,
  _ctx,
  runtime,
  helpers,
) => {
  if (action.pool === 'breakGauge') {
    const current = target.currentBreakGauge

    if (current === undefined) {
      return
    }

    const amount = action.amount === 'all' ? current : action.amount
    const next = Math.max(0, current - amount)

    target.currentBreakGauge = next
    runtime.consumedAmount = current - next

    if (next <= 0) {
      helpers.fireNested('onBreak', { source, target })
    }

    return
  }

  const field = RESOURCE_POOL_FIELD[action.pool]
  const current = (source[field] as number | undefined) ?? 0
  const amount = action.amount === 'all' ? current : action.amount
  const next = Math.max(0, current - amount)

  ;(source[field] as number) = next
  runtime.consumedAmount = current - next
}
```

Add `consumeResource,` to `SKILL_ACTION_REGISTRY`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd game && npx vitest run src/core/skill/SkillActionRegistry.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add game/src/core/skill/SkillActionRegistry.ts game/src/core/skill/SkillActionRegistry.test.ts
git commit -m "feat(skill): add consumeResource executor with onBreak nested firing"
```

---

### Task 7: `consumeForDamage` and `spawnZone` executors

**Files:**
- Modify: `game/src/core/skill/SkillActionRegistry.ts`
- Modify: `game/src/core/skill/SkillActionRegistry.test.ts`

**Interfaces:**
- Consumes: `ConsumeForDamageAction`/`SpawnZoneAction` (Task 1); `ctx.targetAilments.getStacks`/`.remove`, `ctx.combatSystem.applyDirectDamage`/`.killIfDead`, `ctx.spawnLavaZone`/`.spawnSwordZone` (all pre-existing).
- Produces: 2 more entries in `SKILL_ACTION_REGISTRY`.

`consumeForDamage` unifies the old Detonate (`consumesAilmentId`+
`damagePerStack`) and ward-break (`consumesWardForDamage`+
`damagePerWardPoint`) mechanics, ported from `SkillEffectSystem.apply()`'s
matching branches inside `case 'damage'`.

- [ ] **Step 1: Write the failing tests**

Add to `game/src/core/skill/SkillActionRegistry.test.ts`:

```ts
describe('consumeForDamage executor', () => {
  it("source: 'ailment' consumes stacks for true damage and writes runtime.consumedDamage", () => {
    const source = makeEntity()
    const target = makeEntity({ alive: true } as Partial<CombatEntity> as CombatEntity)
    const getStacks = vi.fn(() => 4)
    const remove = vi.fn()
    const applyDirectDamage = vi.fn()
    const killIfDead = vi.fn()
    const ctx = makeCtx({
      targetAilments: { getStacks, remove } as unknown as SkillEffectContext['targetAilments'],
      combatSystem: { applyDirectDamage, killIfDead } as unknown as SkillEffectContext['combatSystem'],
    })
    const runtime: ActionRuntimeContext = {}

    runSkillAction(
      { type: 'consumeForDamage', source: 'ailment', ailmentId: 'bong', damagePerUnit: 10 },
      source,
      target,
      ctx,
      runtime,
      makeHelpers(),
    )

    expect(applyDirectDamage).toHaveBeenCalledWith(target, 40, source.id, 'damage')
    expect(remove).toHaveBeenCalledWith('bong')
    expect(runtime.consumedDamage).toBe(40)
  })

  it("source: 'ward' consumes source.currentWard for true damage, zeroes it", () => {
    const source = makeEntity({ currentWard: 20 } as Partial<CombatEntity> as CombatEntity)
    const target = makeEntity()
    const applyDirectDamage = vi.fn()
    const ctx = makeCtx({ combatSystem: { applyDirectDamage } as unknown as SkillEffectContext['combatSystem'] })

    runSkillAction(
      { type: 'consumeForDamage', source: 'ward', damagePerUnit: 2 },
      source,
      target,
      ctx,
      {},
      makeHelpers(),
    )

    expect(applyDirectDamage).toHaveBeenCalledWith(target, 40, source.id, 'ward_break')
    expect(source.currentWard).toBe(0)
  })
})

describe('spawnZone executor', () => {
  it("zoneKind 'sword' calls ctx.spawnSwordZone with target position", () => {
    const source = makeEntity({ id: 'p1' } as Partial<CombatEntity> as CombatEntity)
    const target = makeEntity({ row: 2, x: 3 } as Partial<CombatEntity> as CombatEntity)
    const spawnSwordZone = vi.fn()
    const ctx = makeCtx({ spawnSwordZone })

    runSkillAction(
      { type: 'spawnZone', zoneKind: 'sword', charges: 3, tickInterval: 1, damageRatio: 0.3, position: 'target' },
      source,
      target,
      ctx,
      {},
      makeHelpers(),
    )

    expect(spawnSwordZone).toHaveBeenCalledWith(expect.objectContaining({ ownerId: 'p1', row: 2, charges: 3 }))
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd game && npx vitest run src/core/skill/SkillActionRegistry.test.ts -t "consumeForDamage|spawnZone"`
Expected: FAIL.

- [ ] **Step 3: Add both executors to `SkillActionRegistry.ts`**

```ts
const consumeForDamage: ActionExecutor<Extract<SkillAction, { type: 'consumeForDamage' }>> = (
  action,
  source,
  target,
  ctx,
  runtime,
) => {
  if (!target.alive) {
    return
  }

  let bonusDamage = 0

  if (action.source === 'ailment' && action.ailmentId) {
    const stacks = ctx.targetAilments.getStacks(action.ailmentId)

    if (stacks <= 0) {
      return
    }

    bonusDamage = stacks * action.damagePerUnit

    ctx.combatSystem.applyDirectDamage(target, bonusDamage, source.id, 'damage')
    ctx.targetAilments.remove(action.ailmentId)
    ctx.combatSystem.killIfDead(target, source.id)
  } else if (action.source === 'ward' && source.currentWard > 0) {
    bonusDamage = source.currentWard * action.damagePerUnit

    source.currentWard = 0

    ctx.combatSystem.applyDirectDamage(target, bonusDamage, source.id, 'ward_break')
  } else {
    return
  }

  runtime.consumedDamage = bonusDamage
}

const spawnZone: ActionExecutor<Extract<SkillAction, { type: 'spawnZone' }>> = (action, source, target, ctx) => {
  const anchor = action.position === 'source' ? source : target

  if (action.zoneKind === 'sword' && ctx.spawnSwordZone) {
    ctx.spawnSwordZone({
      ownerId: source.id,
      row: anchor.row,
      column: Math.round(anchor.x),
      laneRadius: 0,
      columnRadius: 1,
      charges: action.charges,
      tickInterval: action.tickInterval,
      damagePerTick: action.damageRatio * source.stats.attack,
    })
  } else if (action.zoneKind === 'lava' && ctx.spawnLavaZone) {
    ctx.spawnLavaZone({
      ownerId: source.id,
      row: anchor.row,
      column: Math.round(anchor.x),
      laneRadius: 0,
      columnRadius: 1,
      duration: action.charges * action.tickInterval,
      tickInterval: action.tickInterval,
      damagePerTick: action.damageRatio * source.stats.attack,
      element: 'fire',
    })
  }
}
```

Add `consumeForDamage,` and `spawnZone,` to `SKILL_ACTION_REGISTRY`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd game && npx vitest run src/core/skill/SkillActionRegistry.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add game/src/core/skill/SkillActionRegistry.ts game/src/core/skill/SkillActionRegistry.test.ts
git commit -m "feat(skill): add consumeForDamage and spawnZone executors"
```

---

### Task 8: `spawnVfx` executor — closes the registry, removes the temporary cast

**Files:**
- Modify: `game/src/core/skill/SkillEffectSystem.ts` (add `eventBus` to `SkillEffectContext`)
- Modify: `game/src/core/skill/SkillActionRegistry.ts`
- Modify: `game/src/core/skill/SkillActionRegistry.test.ts`
- Modify: `game/src/core/battle/BattleSystem.ts` (the two `SkillEffectContext` object literals — Task 5 of Phase 1's `onCast` block, and the pre-existing `applyEffects` closure — both need `eventBus: this.eventBus` added so `spawnVfx` has something to call)

**Interfaces:**
- Consumes: `SpawnVfxAction` (Task 1); `EventBus` (`game/src/core/events/EventBus.ts`, pre-existing).
- Produces: the 11th and final entry in `SKILL_ACTION_REGISTRY` — the mapped type becomes genuinely exhaustive; the `as {...}` cast from Task 2 is removed here.

`spawnVfx` reuses the `action_impact` event exactly as investigated in the
original spec ("VFX — reusing the existing pipeline") — no new event bus,
no Phaser code.

- [ ] **Step 1: Add `eventBus` to `SkillEffectContext` in `game/src/core/skill/SkillEffectSystem.ts`**

Add near the top of the `SkillEffectContext` interface (after `combatSystem`):

```ts
  eventBus?: import('../events/EventBus').EventBus
```

(optional — most tests construct a partial context and don't need it;
production call sites in `BattleSystem.ts` always provide it after Step 4).

- [ ] **Step 2: Write the failing test**

Add to `game/src/core/skill/SkillActionRegistry.test.ts`:

```ts
describe('spawnVfx executor', () => {
  it("emits 'action_impact' via ctx.eventBus with the source/target ids and presetId", () => {
    const source = makeEntity({ id: 'p1' } as Partial<CombatEntity> as CombatEntity)
    const target = makeEntity({ id: 'e1' } as Partial<CombatEntity> as CombatEntity)
    const emit = vi.fn()
    const ctx = makeCtx({ eventBus: { emit } as unknown as EventBus })

    runSkillAction({ type: 'spawnVfx', presetId: 'fire_burst' }, source, target, ctx, {}, makeHelpers())

    expect(emit).toHaveBeenCalledWith('action_impact', expect.objectContaining({
      sourceId: 'p1',
      primaryTargetId: 'e1',
      presetId: 'fire_burst',
    }))
  })
})
```

Add `import type { EventBus } from '../events/EventBus'` to the test file's imports.

- [ ] **Step 3: Run test to verify it fails**

Run: `cd game && npx vitest run src/core/skill/SkillActionRegistry.test.ts -t spawnVfx`
Expected: FAIL.

- [ ] **Step 4: Add the executor, remove the temporary cast**

Add to `SkillActionRegistry.ts`:

```ts
let spawnVfxInstanceCounter = 0

const spawnVfx: ActionExecutor<Extract<SkillAction, { type: 'spawnVfx' }>> = (action, source, target, ctx) => {
  if (!ctx.eventBus) {
    return
  }

  const anchor = action.target === 'source' ? source : target

  ctx.eventBus.emit('action_impact', {
    type: 'action_impact',
    actionId: `spawnVfx:${action.presetId}`,
    actionInstanceId: `spawnvfx-${++spawnVfxInstanceCounter}`,
    sourceId: source.id,
    primaryTargetId: anchor.id,
    anchorCell: { row: anchor.row, column: Math.round(anchor.x) },
    affectedTargetIds: [anchor.id],
    landedTargetIds: [anchor.id],
    dodgedTargetIds: [],
    affectedArea: { row: anchor.row, columnStart: Math.round(anchor.x), columnEnd: Math.round(anchor.x), shape: 'single' },
    hitCount: 1,
    presetId: action.presetId,
  })
}
```

Change the registry's type and final assignment (removing the cast from Task 2/3):

```ts
export const SKILL_ACTION_REGISTRY: { [K in SkillActionType]: ActionExecutor<Extract<SkillAction, { type: K }>> } = {
  dealDamage,
  heal,
  applyBuff,
  applyDebuff,
  applyAilment,
  grantResource,
  consumeResource,
  consumeForDamage,
  spawnZone,
  spawnVfx,
}
```

(no trailing `as {...}` — if this doesn't compile, an executor from a prior
task is missing or misnamed; fix that, don't re-add the cast).

- [ ] **Step 5: Add `eventBus` to `BattleSystem.ts`'s two `SkillEffectContext` builders**

In `game/src/core/battle/BattleSystem.ts`, both the `applyEffects` closure's
object literal (around line 2718-2768, pre-existing) and the `onCast`
trigger block added in Phase 1 Task 5 (around line 2806-2833) build a
`SkillEffectContext` object literal — add `eventBus: this.eventBus,` to
BOTH (find them by their shared `skillExperience: skill.totalExperience ??
skill.experience ?? 0,` closing field and add the new field right after it
in each).

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd game && npx vitest run src/core/skill/SkillActionRegistry.test.ts`
Expected: PASS (all tests — this is the full, final registry).

- [ ] **Step 7: Type-check and run the full skill + battle suites**

Run: `cd game && npm run type-check`
Expected: PASS (registry is exhaustive now, no cast).

Run: `cd game && npx vitest run src/core/skill/ src/core/battle/`
Expected: PASS — zero regressions in either the new engine's own tests or
the untouched `effects`-based skill tests (Huy Kiếm's `onCast` firing still
works; every other skill is still on the old path entirely).

- [ ] **Step 8: Commit**

```bash
git add game/src/core/skill/SkillEffectSystem.ts game/src/core/skill/SkillActionRegistry.ts game/src/core/skill/SkillActionRegistry.test.ts game/src/core/battle/BattleSystem.ts
git commit -m "feat(skill): add spawnVfx executor, close out the action registry"
```

---

### Task 9: Wire `onHit`/`onCrit`/`onEvade` at the missile-resolve callback

**Files:**
- Modify: `game/src/core/battle/BattleSystem.ts`
- Test: `game/src/core/battle/BattleSystem.reactiveTriggers.test.ts` (new)

**Interfaces:**
- Consumes: `SkillTriggerRunner` (already a field on `BattleSystem` since Phase 1); `OnHitContext`/`OnCritContext`/`OnEvadeContext` (Task 1).

The current per-hit special-case block (`grantsSwordIntentPerHit`/
`grantsMomentumPerHit`/`breakDamagePerHit`, read from the raw `Skill`
fetched via `this.skillManager.get(options.skillId)`) sits at
`BattleSystem.ts` around line 1321-1345 (search for
`if (!result.dodged && options.skillId)` to find it precisely — line
numbers may have shifted since Phase 1). Add trigger firing alongside it
(NOT replacing the old fields yet — those still belong to skills still on
`effects`; this task only makes the NEW firing available for skills that
opt in via `triggers`).

- [ ] **Step 1: Write the failing test**

Create `game/src/core/battle/BattleSystem.reactiveTriggers.test.ts`. Reuse
the harness shape from `BattleSystem.skillTriggers.test.ts` (Phase 1) —
same `createCombatant`/`setup` pattern, same constructor argument order.

```ts
import { describe, expect, it } from 'vitest'
import { BattleSystem } from './BattleSystem'
import { CombatSystem } from '../combat/CombatSystem'
import { SkillManager } from '../skill/SkillManager'
import { SkillSystem } from '../skill/SkillSystem'
import { SkillEffectSystem } from '../skill/SkillEffectSystem'
import { BuffRegistry } from '../buff/BuffRegistry'
import { AilmentRegistry } from '../ailment/AilmentRegistry'
import { EventBus } from '../events/EventBus'
import { ActionImpactSystem } from './ActionImpactSystem'
import { createBaseStats } from '../stats/StatBlock'
import { HERO_COLUMN } from './BattleLane'
import type { CombatEntity } from '../combat/CombatEntity'
import type { Skill } from '../skill/Skill'

function createCombatant(overrides: Partial<CombatEntity>): CombatEntity {
  const stats = {
    ...createBaseStats(),
    attack: 0, defense: 0, evasionRate: 0, criticalRate: 0, blockChance: 0,
    dexterity: 0, attackRange: 0, attackSpeed: 0, movementSpeed: 0,
  }

  return {
    id: 'id', name: 'name', type: 'enemy', baseStats: stats, stats,
    currentHp: stats.maxHp, maxHp: stats.maxHp, currentMp: stats.maxMp,
    currentSwordIntent: 0, currentKiemThe: 0, currentKiemYTemp: 0,
    currentMomentum: 0, currentHoaThe: 0, currentThoThe: 0, currentKimThe: 0,
    timeSinceLastBleedProc: 0, tuLucActive: false, tuLucElapsed: 0,
    tuLucDamageTakenPercent: 0, currentWard: 0, timeSinceLastHitTaken: Infinity,
    realmIndex: 0, x: 0, row: 2, alive: true,
    ...overrides,
  }
}

function makeOnHitSkill(): Skill {
  return {
    id: 'test_onhit_skill', name: 'Test onHit Skill', description: '',
    type: 'active', level: 1, maxLevel: 1, cooldown: 0, remainingCooldown: 0,
    cost: 0, resourceType: 'none', target: 'enemy', effects: [],
    triggers: [
      { trigger: 'onCast', actions: [{ type: 'dealDamage', value: 5, damageType: 'physical' }] },
      { trigger: 'onHit', actions: [{ type: 'grantResource', pool: 'kimThe', amount: 1 }] },
    ],
    execution: { kind: 'attack_speed', attackSpeedMultiplier: 1 },
    loadoutSlot: 0, loadoutSlots: [0], unlocked: true, equipped: true,
  }
}

function setup(skill: Skill) {
  const eventBus = new EventBus()
  const skillManager = new SkillManager()
  const skillSystem = new SkillSystem(skillManager)
  const system = new BattleSystem(
    new CombatSystem(eventBus), skillManager, skillSystem, new SkillEffectSystem(),
    new BuffRegistry(), new AilmentRegistry(), eventBus,
    new ActionImpactSystem({ eventBus, rollCritical: () => false }),
    undefined, undefined, undefined,
    () => 'kiem_tran', () => 0, () => 0,
  )
  skillManager.add(skill)
  return { system }
}

describe('BattleSystem — onHit/onCrit/onEvade trigger wiring', () => {
  it('a skill with an onHit-bound action runs it after a landed hit', () => {
    const skill = makeOnHitSkill()
    const { system } = setup(skill)

    const player = createCombatant({ id: 'player', type: 'player' })
    player.stats.attackSpeed = 10
    player.stats.attackRange = 999999
    const enemy = createCombatant({ id: 'enemy' })
    enemy.stats.maxHp = 100000
    enemy.maxHp = 100000
    enemy.currentHp = 100000

    system.start(player, enemy)
    system.flushPendingSpawns()
    enemy.x = HERO_COLUMN

    system.update(3)
    system.update(0.2)

    expect(player.currentKimThe).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd game && npx vitest run src/core/battle/BattleSystem.reactiveTriggers.test.ts`
Expected: FAIL — `player.currentKimThe` stays `0` (no firing site yet).

- [ ] **Step 3: Wire the firing site**

In `game/src/core/battle/BattleSystem.ts`, find the block (search for
`if (!result.dodged && options.skillId)`):

```ts
    if (!result.dodged && options.skillId) {
      const skill = this.skillManager.get(options.skillId)

      if (skill?.grantsSwordIntentPerHit) {
```

Immediately BEFORE this `if (!result.dodged && options.skillId) {` block,
insert:

```ts
    if (options.skillId) {
      const firedSkill = this.skillManager.get(options.skillId)

      if (firedSkill?.triggers?.length) {
        const hitCtx: SkillEffectContext = {
          combatSystem: this.combat,
          fireHit: () => ({ landed: true }),
          buffRegistry: this.buffRegistry,
          ailmentRegistry: this.ailmentRegistry,
          sourceBuffs: new BuffSystem(this.getBuffsFor(battle, source)),
          targetBuffs: new BuffSystem(this.getBuffsFor(battle, target)),
          targetAilments: new AilmentSystem(this.getAilmentsFor(battle, target)),
          reactionManager: this.reactionManager,
          reactionKeepChance: this.getReactionKeepChance(),
          spawnLavaZone: (spec) => this.spawnLavaZone(battle, spec),
          spawnSwordZone: (spec) => this.spawnSwordZone(battle, spec),
          skillId: firedSkill.id,
          skillExperience: firedSkill.totalExperience ?? firedSkill.experience ?? 0,
          eventBus: this.eventBus,
        }

        if (!result.dodged) {
          this.skillTriggerRunner.fire(
            'onHit',
            { source, target, skill: firedSkill, damageDealt: result.finalDamage, isCrit: result.critical },
            firedSkill.triggers,
            source, target, hitCtx,
          )

          if (result.critical) {
            this.skillTriggerRunner.fire(
              'onCrit',
              { source, target, skill: firedSkill, damageDealt: result.finalDamage, isCrit: result.critical },
              firedSkill.triggers,
              source, target, hitCtx,
            )
          }
        } else {
          this.skillTriggerRunner.fire(
            'onEvade',
            { source, target, skill: firedSkill },
            firedSkill.triggers,
            source, target, hitCtx,
          )
        }
      }
    }

```

Check this insertion point's exact local variable names (`source`, `target`,
`result`, `options`, `battle`) against the surrounding function signature —
read the full enclosing method before editing, since this plan's line
reference is approximate (Phase 1's own note about this file applies here
too: locate by the literal code shown, not by trusting line numbers).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd game && npx vitest run src/core/battle/BattleSystem.reactiveTriggers.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the full battle suite**

Run: `cd game && npx vitest run src/core/battle/`
Expected: PASS — zero regressions (every existing skill has
`triggers === undefined`, so `firedSkill?.triggers?.length` is falsy for
all of them, making this new block a guaranteed no-op for current content).

- [ ] **Step 6: Type-check**

Run: `cd game && npm run type-check`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add game/src/core/battle/BattleSystem.ts game/src/core/battle/BattleSystem.reactiveTriggers.test.ts
git commit -m "feat(battle): wire onHit/onCrit/onEvade trigger firing"
```

---

### Task 10: Wire `onKill`/`onDeath` at `CombatSystem.killIfDead()`

**Files:**
- Modify: `game/src/core/combat/CombatSystem.ts`
- Test: `game/src/core/combat/CombatSystem.triggers.test.ts` (new)

**Interfaces:**
- Consumes: `SkillTriggerRunner`, `OnKillContext`/`OnDeathContext` (Task 1).
- Produces: `CombatSystem` gains a `private readonly skillTriggerRunner = new SkillTriggerRunner()` field and (for `onKill`, which needs a `Skill` reference) a way to look up the killing skill — `CombatSystem` does not currently hold a `SkillManager` reference, so `onKill`'s firing needs the killer's CURRENTLY EQUIPPED/CASTING skill, which `killIfDead()` cannot know on its own. Resolve this the same way `BattleSystem`'s missile-resolve callback does: `killIfDead()` gains an optional `skillId` parameter threaded from its callers (all of which already know which skill caused the kill), defaulting to `undefined` (skips `onKill` firing) when not provided — this keeps every non-skill-caused death path (e.g. talent/environmental damage) unaffected.

`killIfDead()` is called from several `CombatSystem` methods (`resolveAttack`
being the main skill-driven one). This task threads a skill reference only
through the ONE call site that already has it in scope; other callers pass
no `skillId`, and `onKill`/`onDeath` simply don't fire for those (a
non-skill kill, e.g. a DoT tick that has no "casting skill" concept, doesn't
need to fire either trigger for skill purposes — DoT-driven kills stay
untouched by this task; `onKill`/`onDeath` are reachable via
`resolveAttack`'s skill-driven path today, and future callers can pass a
`skillId` the same way when they have one).

- [ ] **Step 1: Write the failing test**

Create `game/src/core/combat/CombatSystem.triggers.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { CombatSystem } from './CombatSystem'
import { EventBus } from '../events/EventBus'
import { SkillManager } from '../skill/SkillManager'
import { createBaseStats } from '../stats/StatBlock'
import type { CombatEntity } from './CombatEntity'
import type { Skill } from '../skill/Skill'

function makeEntity(overrides: Partial<CombatEntity>): CombatEntity {
  const stats = { ...createBaseStats(), evasionRate: 0, criticalRate: 0, blockChance: 0 }
  return {
    id: 'id', name: 'name', type: 'enemy', baseStats: stats, stats,
    currentHp: 100, maxHp: 100, currentMp: 0, currentSwordIntent: 0,
    currentMomentum: 0, currentHoaThe: 0, currentThoThe: 0, currentKimThe: 0,
    currentWard: 0, alive: true, realmIndex: 0, x: 0, row: 0,
    ...overrides,
  }
}

function makeKillSkill(): Skill {
  return {
    id: 'test_kill_skill', name: 'Test Kill Skill', description: '', type: 'active',
    level: 1, maxLevel: 1, cooldown: 0, remainingCooldown: 0, target: 'enemy',
    effects: [], triggers: [{ trigger: 'onKill', actions: [{ type: 'grantResource', pool: 'kimThe', amount: 1 }] }],
    unlocked: true, equipped: true,
  }
}

describe('CombatSystem — onKill/onDeath trigger wiring', () => {
  it('killIfDead() fires onKill on the killer when a skillId is passed', () => {
    const eventBus = new EventBus()
    const skillManager = new SkillManager()
    skillManager.add(makeKillSkill())
    const combat = new CombatSystem(eventBus, skillManager)

    const killer = makeEntity({ id: 'killer' })
    const victim = makeEntity({ id: 'victim', currentHp: 0 })

    combat.killIfDead(victim, 'killer', 'test_kill_skill')

    // onKill fires with source = the entity CombatSystem is told the
    // killerId belongs to — CombatSystem only has ids, not entity refs,
    // for the killer in this call; adjust per Step 3's actual resolution
    // strategy and update this assertion to match what's implementable
    // (see Step 3 note on entity resolution).
  })
})
```

- [ ] **Step 2: Investigate `killIfDead()`'s actual signature and callers before writing Step 3**

Read `game/src/core/combat/CombatSystem.ts:418-462` in full (already partially
quoted during design — re-read the complete function and its 3+ call sites
listed in the file: `applyDirectDamage`, `applyModifiedDirectDamage`,
`applyDotDamage`) to determine: does `CombatSystem` have direct access to
the killer `CombatEntity` (not just `killerId: string`) at any call site? If
`killIfDead(entity, killerId)`'s callers only ever have a `killerId` string
(not the killer's full `CombatEntity`), `onKill`'s `OnKillContext.source:
CombatEntity` cannot be built without a lookup. Since `CombatSystem` has no
entity registry, the pragmatic fix is: `killIfDead()` gains an optional
`killer?: CombatEntity` parameter (not just `killerId`) alongside the
optional `skillId?: string`, and ONLY fires `onKill`/`onDeath` when the
caller supplies both `killer` and `skillId` — callers that only have a
`killerId` string (no full entity) skip firing, same as callers with no
`skillId` at all. Update the test in Step 1 to construct
`combat.killIfDead(victim, 'killer', { killer: killerEntity, skillId:
'test_kill_skill' })` (bundle the two optional pieces into one options
object rather than two positional optional params, since positional
optionals get error-prone past one) and assert against a `SkillTriggerRunner`
spy or a real resource-grant side effect (`killerEntity.currentKimThe`)
rather than a mocked runner, matching Phase 1's testing style (assert real
side effects, not internal calls, wherever the executor is already proven
correct by its own unit tests). Rewrite Step 1's test using this shape
before implementing Step 3.

- [ ] **Step 3: Implement `killIfDead()`'s new optional parameter and firing**

In `game/src/core/combat/CombatSystem.ts`, change `killIfDead`'s signature
to accept the new optional bundle and, after the existing
`entity.alive = false` / `'death'`/`'kill'` EventBus emits, add:

```ts
  killIfDead(
    entity: CombatEntity,
    killerId: string,
    skillContext?: { killer: CombatEntity; skillId: string },
  ) {
    // ...existing body unchanged up through the 'kill' eventBus.emit...

    if (skillContext) {
      const skill = this.skillManager?.get(skillContext.skillId)

      if (skill?.triggers?.length) {
        const minimalCtx: SkillEffectContext = {
          combatSystem: this,
          fireHit: () => ({ landed: true }),
          buffRegistry: this.deps.buffRegistry,
          ailmentRegistry: this.deps.ailmentRegistry,
          sourceBuffs: /* resolve per existing CombatSystem buff-pool access pattern */,
          targetBuffs: /* same */,
          targetAilments: /* same */,
          reactionManager: this.deps.reactionManager,
        }

        this.skillTriggerRunner.fire('onKill', { source: skillContext.killer, target: entity, skill }, skill.triggers, skillContext.killer, entity, minimalCtx)
        this.skillTriggerRunner.fire('onDeath', { source: entity }, skill.triggers, entity, entity, minimalCtx)
      }
    }
  }
```

`CombatSystem` does not currently hold `buffRegistry`/`ailmentRegistry`/
`reactionManager`/`skillManager` references directly — check its
constructor and `deps` shape (read the file's top ~80 lines) and either (a)
add the missing dependencies as new optional constructor parameters
(defaulting to `undefined`, making `onKill`/`onDeath` a safe no-op
everywhere `CombatSystem` is constructed without them — every EXISTING
`new CombatSystem(eventBus)` call site across the test suite stays
unchanged), or (b) if `CombatSystem` already receives an object bag with
these, adapt the snippet above to that shape. Do NOT change
`CombatSystem`'s constructor's required (non-optional) parameters — this
would break every existing call site across dozens of test files, which is
out of proportion to this task. If (a), add `skillManager?: SkillManager`
as one new final optional constructor parameter (this is the only piece
Task 3's investigation confirmed `CombatSystem` definitely lacks); resolve
`buffRegistry`/`ailmentRegistry`/`reactionManager` from whatever
`CombatSystem` already has in scope for its own existing methods (it must
have SOME access to buff/ailment systems already, since `resolveAttack`
elsewhere reads/writes them — reuse that, do not add new dependencies for
fields already reachable another way).

- [ ] **Step 4: Update all `killIfDead()` call sites**

`applyDirectDamage`/`applyModifiedDirectDamage`/`applyDotDamage`/`resolveAttack`
(wherever `killIfDead` is called in this file) keep calling it exactly as
before EXCEPT the one call site inside `resolveAttack()` (the skill-driven
melee/ranged hit path) — thread through whatever `skillId`/killer entity
`resolveAttack` already has in scope (check its parameters; if it does not
currently receive a `skillId`, this task does NOT invent a new parameter
threading chain through `resolveAttack` itself — that is a larger, separate
change. In that case, skip wiring a real call site in this task and instead
leave `killIfDead()`'s new capability real-but-unused (structurally
complete, tested via Step 1's direct unit test), noting in your report that
`onKill`/`onDeath` have no live production firing site yet pending
`resolveAttack()`'s own skillId threading — this is an acceptable, explicitly
flagged gap for this task, matching Phase 1's "declare the capability,
wire the first real site when a concrete skill needs it" pattern).

- [ ] **Step 5: Run tests**

Run: `cd game && npx vitest run src/core/combat/CombatSystem.triggers.test.ts src/core/combat/`
Expected: PASS.

- [ ] **Step 6: Type-check**

Run: `cd game && npm run type-check`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add game/src/core/combat/CombatSystem.ts game/src/core/combat/CombatSystem.triggers.test.ts
git commit -m "feat(combat): add onKill/onDeath trigger firing capability to killIfDead()"
```

---

### Task 11: Wire `onTick` at `BattleSystem.resolveChannelTick()`

**Files:**
- Modify: `game/src/core/battle/BattleSystem.ts`
- Test: `game/src/core/battle/BattleSystem.onTick.test.ts` (new)

**Interfaces:**
- Consumes: `SkillTriggerRunner`, `OnTickContext` (Task 1).

`resolveChannelTick()` is the only place a channel skill (currently only
Bạt Kiếm, still on `effects`) ticks. It already calls `resolveSkillEffects`
each tick (which fires `onCast` unconditionally per Phase 1 — an existing,
harmless side effect of reusing that function for ticks). This task adds a
SEPARATE, explicit `onTick` firing so a future triggers-based channel skill
can distinguish "the channel resolved this tick" from "the skill was cast."

- [ ] **Step 1: Write the failing test**

Create `game/src/core/battle/BattleSystem.onTick.test.ts` reusing the same
harness as Task 9 (`createCombatant`/`setup` — copy those two helpers
verbatim from `BattleSystem.reactiveTriggers.test.ts`):

```ts
import { describe, expect, it } from 'vitest'
import { BattleSystem } from './BattleSystem'
import { CombatSystem } from '../combat/CombatSystem'
import { SkillManager } from '../skill/SkillManager'
import { SkillSystem } from '../skill/SkillSystem'
import { SkillEffectSystem } from '../skill/SkillEffectSystem'
import { BuffRegistry } from '../buff/BuffRegistry'
import { AilmentRegistry } from '../ailment/AilmentRegistry'
import { EventBus } from '../events/EventBus'
import { ActionImpactSystem } from './ActionImpactSystem'
import { createBaseStats } from '../stats/StatBlock'
import type { CombatEntity } from '../combat/CombatEntity'
import type { Skill } from '../skill/Skill'

function createCombatant(overrides: Partial<CombatEntity>): CombatEntity {
  const stats = { ...createBaseStats(), attack: 0, defense: 0, evasionRate: 0, criticalRate: 0, blockChance: 0, dexterity: 0, attackRange: 0, attackSpeed: 0, movementSpeed: 0 }
  return {
    id: 'id', name: 'name', type: 'enemy', baseStats: stats, stats,
    currentHp: stats.maxHp, maxHp: stats.maxHp, currentMp: stats.maxMp,
    currentSwordIntent: 0, currentKiemThe: 0, currentKiemYTemp: 0, currentMomentum: 0,
    currentHoaThe: 0, currentThoThe: 0, currentKimThe: 0, timeSinceLastBleedProc: 0,
    tuLucActive: false, tuLucElapsed: 0, tuLucDamageTakenPercent: 0, currentWard: 0,
    timeSinceLastHitTaken: Infinity, realmIndex: 0, x: 0, row: 2, alive: true,
    ...overrides,
  }
}

function makeChannelSkill(): Skill {
  return {
    id: 'test_channel_skill', name: 'Test Channel', description: '', type: 'active',
    level: 1, maxLevel: 1, cooldown: 0, remainingCooldown: 0, target: 'all_enemies',
    effects: [], triggers: [{ trigger: 'onTick', actions: [{ type: 'grantResource', pool: 'kimThe', amount: 1 }] }],
    execution: { kind: 'channel', tickSeconds: 3 },
    unlocked: true, equipped: true,
  }
}

describe('BattleSystem — onTick trigger wiring', () => {
  it('a channel skill with an onTick-bound action runs it once per tick', () => {
    const eventBus = new EventBus()
    const skillManager = new SkillManager()
    const skillSystem = new SkillSystem(skillManager)
    const system = new BattleSystem(
      new CombatSystem(eventBus), skillManager, skillSystem, new SkillEffectSystem(),
      new BuffRegistry(), new AilmentRegistry(), eventBus,
      new ActionImpactSystem({ eventBus, rollCritical: () => false }),
      undefined, undefined, undefined,
      () => 'bat_kiem', () => 0, () => 0,
    )
    const skill = makeChannelSkill()
    skillManager.add(skill)

    const player = createCombatant({ id: 'player', type: 'player' })
    const enemy = createCombatant({ id: 'enemy' })
    enemy.stats.maxHp = 100000
    enemy.maxHp = 100000
    enemy.currentHp = 100000

    system.start(player, enemy)
    system.flushPendingSpawns()
    player.tuLucActive = true
    // channelSkillId is a private field set by startChannel(); if there is
    // no public setter, this test must go through the real cast entrypoint
    // instead of poking private state — check BattleSystem.ts's
    // startChannel()/updateChanneling() for the actual public path to
    // begin a channel (likely casting the skill via the normal
    // beginPlayerCast → 'channel' execution branch) and use that instead
    // of setting private fields directly.

    system.update(5) // past the 3s tick

    expect(player.currentKimThe).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Verify the test's channel-start mechanism against the real code**

`BattleSystem.startChannel()` (private) is called from the `'channel'`
execution-kind branch inside the player cast-dispatch switch (not shown in
full during design — read it before finalizing this test). Adjust the
test's arrange section to trigger a channel start through whatever public
surface actually exists (calling `system.update()` after equipping/casting
the skill normally, the same way `BattleSystem.kiemTuResources.test.ts`'s
`bat_kiem` tests already do — read that file's `route: 'bat_kiem'` tests
for the exact pattern and copy it) rather than the placeholder comment
above. This step exists specifically because the private-field concern is
real — resolve it with the actual pattern before writing Step 3.

- [ ] **Step 3: Run test to verify it fails**

Run: `cd game && npx vitest run src/core/battle/BattleSystem.onTick.test.ts`
Expected: FAIL — `player.currentKimThe` stays `0`.

- [ ] **Step 4: Wire the firing site in `resolveChannelTick()`**

In `game/src/core/battle/BattleSystem.ts`, inside `resolveChannelTick()`
(search for `private resolveChannelTick(battle: Battle, skill: Skill,
damageTakenPercent: number, tickSeconds: number)`), after the existing
`resolveSkillEffects(...)` call inside its `try` block (read the full
`try`/`finally` first — the existing call restores
`player.stats.finalDamagePercent` in a `finally`, so any addition must not
disturb that), add:

```ts
      if (effectiveSkill.triggers?.length) {
        const tickCtx: SkillEffectContext = {
          combatSystem: this.combat,
          fireHit: () => ({ landed: true }),
          buffRegistry: this.buffRegistry,
          ailmentRegistry: this.ailmentRegistry,
          sourceBuffs: new BuffSystem(this.getBuffsFor(battle, player)),
          targetBuffs: new BuffSystem(this.getBuffsFor(battle, target)),
          targetAilments: new AilmentSystem(this.getAilmentsFor(battle, target)),
          reactionManager: this.reactionManager,
          reactionKeepChance: this.getReactionKeepChance(),
          spawnLavaZone: (spec) => this.spawnLavaZone(battle, spec),
          spawnSwordZone: (spec) => this.spawnSwordZone(battle, spec),
          skillId: skill.id,
          skillExperience: skill.totalExperience ?? skill.experience ?? 0,
          eventBus: this.eventBus,
        }

        this.skillTriggerRunner.fire(
          'onTick',
          { source: player, target, skill, tickIndex: this.channelTickCounter?.get(skill.id) ?? 0 },
          effectiveSkill.triggers,
          player, target, tickCtx,
        )
      }
```

`this.channelTickCounter` does not exist yet — if a per-skill tick counter
isn't already tracked anywhere reachable, use `0` as a placeholder-free
literal (`tickIndex: 0`) rather than inventing new state for a value no
current action reads (`OnTickContext.tickIndex` exists for future actions
that care about "which tick is this" — Phase 2A has none). Prefer `0` over
inventing unused tracking state; note this simplification in your report.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd game && npx vitest run src/core/battle/BattleSystem.onTick.test.ts`
Expected: PASS.

- [ ] **Step 6: Run the full battle suite (Bạt Kiếm is real production content — check carefully)**

Run: `cd game && npx vitest run src/core/battle/`
Expected: PASS — Bạt Kiếm is still on `effects` (`triggers === undefined`),
so the new `if (effectiveSkill.triggers?.length)` guard is a no-op for it;
confirm the existing `BattleSystem.kiemTuResources.test.ts`/`.batKiem.test.ts`
suites are unaffected.

- [ ] **Step 7: Type-check**

Run: `cd game && npm run type-check`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add game/src/core/battle/BattleSystem.ts game/src/core/battle/BattleSystem.onTick.test.ts
git commit -m "feat(battle): wire onTick trigger firing into resolveChannelTick"
```

---

### Task 12: Close the `beginSkillBatch` VFX/AOE gap for `triggers`-based skills

**Files:**
- Modify: `game/src/core/battle/BattleSystem.ts`

**Interfaces:**
- Consumes: `DealDamageAction.hitCountByRealm`/`.knockbackDistance` (Task 1).

Phase 1's final review (Important #1, documented in
`game/docs/skill-trigger-action-usage-guide.md`) flagged that
`beginSkillBatch`'s `hitCount`/`earthPureActive`/knockback derivation reads
only `effective.effects`, never `effective.triggers` — meaning a
triggers-based skill using `dealDamage`'s `hitCountByRealm` or the new
`knockbackDistance` field (Task 1) would deal correct damage but get a
wrong (single-hit, no-knockback) VFX/hit-resolution batch. Close it now that
`dealDamage` actually has these fields.

- [ ] **Step 1: Write the failing test**

Add to `game/src/core/battle/BattleSystem.reactiveTriggers.test.ts` (from
Task 9 — same file, new `describe` block):

```ts
describe('BattleSystem — beginSkillBatch reads triggers-based hitCountByRealm too', () => {
  it('a triggers-based skill with hitCountByRealm fires (realmIndex+1) hits in one batch', () => {
    const skill: Skill = {
      id: 'test_multihit_skill', name: 'Test Multihit', description: '', type: 'active',
      level: 1, maxLevel: 1, cooldown: 0, remainingCooldown: 0, cost: 0, resourceType: 'none',
      target: 'enemy', effects: [],
      triggers: [{ trigger: 'onCast', actions: [{ type: 'dealDamage', value: 1, damageType: 'physical', hitCountByRealm: true }] }],
      execution: { kind: 'cooldown' }, loadoutSlot: 0, loadoutSlots: [0], unlocked: true, equipped: true,
    }
    const { system } = setup(skill)

    const player = createCombatant({ id: 'player', type: 'player', realmIndex: 2 })
    player.stats.attackRange = 999999
    const enemy = createCombatant({ id: 'enemy' })
    enemy.stats.maxHp = 100000
    enemy.maxHp = 100000
    enemy.currentHp = 100000

    system.start(player, enemy)
    system.flushPendingSpawns()
    enemy.x = HERO_COLUMN

    system.update(3)
    const hpBefore = enemy.currentHp
    system.update(1)

    // 1 dmg × (realmIndex 2 + 1) = 3 hits minimum, each floored at 1 dmg —
    // if the batch's hitCount stayed 1 (the bug this task fixes), only 1
    // hit's worth would be visible in the impact batch metadata; the
    // damage itself is already correct either way (dealDamage's own loop
    // fires 3 real hits regardless of batch hitCount — this test's REAL
    // assertion is on the batch metadata reaching the VFX layer, not on
    // HP, since HP already proves correct pre-fix). Assert via a spy on
    // ActionImpactSystem.beginSkillBatch instead of HP — adjust this test
    // once Step 2's investigation confirms the right seam to spy on.
    expect(enemy.currentHp).toBeLessThan(hpBefore)
  })
})
```

- [ ] **Step 2: Investigate the right assertion seam**

`ActionImpactSystem.beginSkillBatch` is called with a `hitCount` field
(`BattleSystem.ts` ~line 2694-2696 per Phase 1's read). Since it's a private
call inside `resolveSkillEffects`, the cleanest test seam is spying on
`this.actionImpact.beginSkillBatch` — but `actionImpact` is constructed
inside `setup()`, not exposed. Change `setup()` in this test file to also
return `actionImpact` (construct it as a local `const actionImpact = new
ActionImpactSystem(...)` before passing it into `new BattleSystem(...)`,
and return `{ system, actionImpact }`), then `vi.spyOn(actionImpact,
'beginSkillBatch')` and assert the spy's call argument's `hitCount` is `3`
(realmIndex 2 + 1), not `1`. Rewrite Step 1's test with this real
assertion before implementing Step 3.

- [ ] **Step 3: Run test to verify it fails**

Run: `cd game && npx vitest run src/core/battle/BattleSystem.reactiveTriggers.test.ts -t "beginSkillBatch reads triggers"`
Expected: FAIL — spied `hitCount` is `1`.

- [ ] **Step 4: Fix the derivation in `BattleSystem.ts`**

Find (per Phase 1's plan, ~line 2664-2696):

```ts
    const earthPureActive =
      effective.effects.some((effect) => effect.earthPureAreaBehavior === true) &&
      getSkillRuntimeStat(source, 'earthAoeRadius') > 0
```

and

```ts
      hitCount: effective.effects.some((effect) => effect.hitCountByRealm)
        ? source.realmIndex + 1
        : 1,
```

Change the `hitCount` line to also check `triggers`:

```ts
      hitCount:
        effective.effects.some((effect) => effect.hitCountByRealm) ||
        effective.triggers?.some((binding) =>
          binding.actions.some((action) => action.type === 'dealDamage' && action.hitCountByRealm),
        )
          ? source.realmIndex + 1
          : 1,
```

(`earthPureActive`/AOE stays `effects`-only in this task — no
triggers-based skill uses `earthPureAreaBehavior` since that field doesn't
exist on `DealDamageAction`, per Task 1's deliberate scope; only
`hitCountByRealm` and `knockbackDistance` were added to `dealDamage`. Add
similar handling for `knockbackDistance` at the `knockbackDistance:
earthPureActive ? ... : undefined` line if `dealDamage`'s
`knockbackDistance` should also reach the batch — check whether any test in
this task actually needs it; if not, note the gap explicitly in your report
rather than silently leaving it, since it's the same shape of bug this task
is closing).

- [ ] **Step 5: Run test to verify it passes**

Run: `cd game && npx vitest run src/core/battle/BattleSystem.reactiveTriggers.test.ts`
Expected: PASS.

- [ ] **Step 6: Run the full battle suite**

Run: `cd game && npx vitest run src/core/battle/`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add game/src/core/battle/BattleSystem.ts game/src/core/battle/BattleSystem.reactiveTriggers.test.ts
git commit -m "fix(battle): beginSkillBatch reads triggers-based hitCountByRealm too"
```

---

### Task 13: Update the usage guide and skill-architecture reference

**Files:**
- Modify: `game/docs/skill-trigger-action-usage-guide.md`
- Modify: `.agents/skills/tutienidle-skill-design/references/skill-architecture.md`

**Interfaces:**
- None (documentation only).

- [ ] **Step 1: Update `game/docs/skill-trigger-action-usage-guide.md`**

Replace the "What's NOT migrated yet" section's content with:

```markdown
## What's NOT migrated yet

The full trigger/action vocabulary now exists (10 triggers, 10 actions) —
every current `SkillEffect`/`Skill` mechanic has an equivalent. What's
still outstanding:

- Every skill except Huy Kiếm (`tram`) is still on the old `effects` shape
  and works exactly as before — `SkillEffectSystem`/`SkillEffect.ts` are
  untouched and will stay in use until each path (Hỏa Tu, Thủy Tu, Mộc Tu,
  Thổ Tu, Kim Tu, the rest of Kiếm Tu, Thể Tu) gets its own migration plan.
- Enemies still use `specialAttacks[]`, a separate, simpler pipeline that
  cannot use ailments/buffs/resources — the "universal entity model"
  (enemies authored as real `Skill[]`, cast through the exact same
  `resolveSkillEffects()` pipeline as the player) is Phase 2B, a follow-up
  plan.
- `onKill`/`onDeath` are structurally complete (`CombatSystem.killIfDead()`
  can fire them) but may not have a live production firing site yet,
  pending `resolveAttack()`'s own skill-id threading — check the Phase 2A
  plan's Task 10 report before assuming they fire in a real battle.
```

Add a new subsection right after "Add a new skill using triggers you
already have"'s existing numbered steps:

```markdown
### Available triggers and actions (Phase 2A)

Triggers: `onCast`, `onHit`, `onCrit`, `onEvade`, `onKill`, `onDeath`,
`onTick`, `onProc`, `onBreak`, `onResourceFull`. Actions: `dealDamage`,
`heal`, `applyBuff`, `applyDebuff`, `applyAilment`, `grantResource`,
`consumeResource`, `consumeForDamage`, `spawnZone`, `spawnVfx`.

`onProc` (fires inside `applyAilment` on a successful roll),
`onResourceFull` (fires inside `grantResource` when a pool clamps to max),
and `onBreak` (fires inside `consumeResource` when `pool: 'breakGauge'`
reaches 0) don't need a firing-site call anywhere — bind them the same way
as any other trigger in `skill.triggers`, and they'll fire automatically
whenever the causing action runs, on ANY skill, without touching
`BattleSystem.ts`. This is the concrete case of "add a parameter, every
related system picks it up automatically."
```

- [ ] **Step 2: Update `.agents/skills/tutienidle-skill-design/references/skill-architecture.md`**

In the existing "## Trigger/Action engine" section, replace the paragraph
starting "As of this writing only `onCast`/`dealDamage` are implemented"
with:

```markdown
As of this writing the full vocabulary is implemented: 10 triggers
(`onCast`/`onHit`/`onCrit`/`onEvade`/`onKill`/`onDeath`/`onTick`/`onProc`/
`onBreak`/`onResourceFull`) and 10 actions (`dealDamage`/`heal`/
`applyBuff`/`applyDebuff`/`applyAilment`/`grantResource`/
`consumeResource`/`consumeForDamage`/`spawnZone`/`spawnVfx`) — enough to
express every mechanic the old `SkillEffect` fields covered. `onProc`/
`onResourceFull`/`onBreak` fire from inside their causing action's
executor (no firing site to wire per new skill). Only Huy Kiếm (`tram`) has
actually migrated its DATA to `triggers` so far — every other skill is
still on `effects` and behaves identically; enemies still use a separate
`specialAttacks[]` pipeline pending a follow-up "universal entity model"
plan. See `game/docs/skill-trigger-action-usage-guide.md` for the current
trigger/action list and how to add a new skill, trigger, or action.
```

- [ ] **Step 3: Commit**

```bash
git add game/docs/skill-trigger-action-usage-guide.md .agents/skills/tutienidle-skill-design/references/skill-architecture.md
git commit -m "docs: document the complete Phase 2A trigger/action vocabulary"
```

---

## Out of scope for this plan

- **Phase 2B — universal entity model**: enemies migrating from
  `specialAttacks[]` to real `Skill[]`/`triggers`, `fireEnemyAttack()`
  rewritten to call `resolveSkillEffects()`. Separate plan, depends on this
  plan's actions existing.
- Migrating any player skill's real data off `effects` (still per-path,
  per the original migration plan's order).
- `onDodge` trigger (self evaded an incoming attack) — no located firing
  site, no action needs it yet; add when something does.
- `resolveAttack()`'s own `skillId` threading, if Task 10 finds it's
  missing — needed to give `onKill`/`onDeath` a live production firing
  site; flagged explicitly in that task's report rather than silently
  left undone.
- Tooltip generic-ization, `CURRENT_SAVE_VERSION` bump — unchanged from
  Phase 1's stated deferrals.
