# Skill Trigger/Action Engine — Phase 1 (Core Engine + Huy Kiếm Pilot) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the trigger/action skill engine (types + action registry + trigger runner) and prove it end-to-end by fully migrating one real skill — Huy Kiếm (`id: 'tram'`) — off the old field-per-mechanic `SkillEffect` shape.

**Architecture:** Skills gain an optional `triggers: TriggerBinding[]` array. Each binding pairs a `TriggerType` (`onCast` in this phase) with an ordered list of `SkillAction`s (`dealDamage` in this phase), executed through one exhaustive `SkillActionRegistry`. `BattleSystem` branches per skill: skills with `triggers` set run through the new `SkillTriggerRunner`; every other skill keeps running through the untouched `SkillEffectSystem`/`effects` path. No skill is ever on both paths at once.

**Tech Stack:** TypeScript, Vitest, existing `game/src/core/skill`/`game/src/core/battle` modules.

**Spec:** `docs/superpowers/specs/2026-08-31-skill-trigger-action-rework-design.md`

## Global Constraints

- Skill/technique ids and internal data keep Vietnamese pinyin without diacritics; mechanic/system field names stay English (`game/docs/naming-conventions.md` N1–N3).
- No permanent dual representation per skill: a skill is either fully on `effects` or fully on `triggers`, never both.
- Every `SkillActionType` must have a real (non-stub) executor in `SkillActionRegistry` — TypeScript's `Record<SkillActionType, Executor>` must stay exhaustive; a missing case is a compile error.
- Existing `SkillSystem.*.test.ts` / `SkillEffectSystem.test.ts` files are the regression gate: assertions must keep proving the same behavior after migration, even when the data-construction shape changes.
- This phase only wires the `onCast` trigger into production (`BattleSystem`). `onHit`/`onCrit`/`onEvade` context types and runner support are built now (the runner is generic over trigger name), but their firing sites land in a later plan when a skill actually needs a reactive on-hit mechanic — do not add speculative firing sites now.

---

### Task 1: Trigger and action type definitions

**Files:**
- Create: `game/src/core/skill/SkillTrigger.ts`
- Create: `game/src/core/skill/SkillAction.ts`
- Modify: `game/src/core/skill/Skill.ts`

**Interfaces:**
- Produces: `TriggerType`, `OnCastContext`, `OnHitContext`, `OnCritContext`, `OnEvadeContext`, `TriggerContextMap`, `TriggerBinding<T>` (from `SkillTrigger.ts`); `DealDamageAction`, `SkillAction`, `SkillActionType`, `ActionRuntimeContext` (from `SkillAction.ts`); `Skill.triggers?: TriggerBinding[]`.

- [ ] **Step 1: Create `game/src/core/skill/SkillAction.ts`**

```ts
import type { SkillDamageComponent } from './SkillDamageComponent'
import type { StatType } from '../stats/StatTypes'

// Trigger/Action rework (2026-08-31 spec) — replaces the old per-mechanic
// fields on SkillEffect (attributeScaling, swordIntentDamageRatio,
// realmDamageRatio, manaScalingRatio, skillExperienceRatio,
// hitCountByRealm) with one composable action. New action types (heal,
// applyBuff, applyAilment, grantResource, consumeForDamage, spawnZone,
// spawnVfx, ...) get added here + registered in SkillActionRegistry.ts as
// each future path migration needs them — do not add unused ones ahead of
// need.
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
}

export type SkillAction = DealDamageAction

export type SkillActionType = SkillAction['type']

/**
 * Scratch state shared by every action inside one TriggerBinding's action
 * list, seeded from the firing trigger's context. Lets a later action read
 * a value an earlier action produced (e.g. a future `consumeForDamage`
 * writing `consumedDamage` for a following `heal` to read) without either
 * action knowing the other by name.
 */
export interface ActionRuntimeContext {
  damageDealt?: number

  isCrit?: boolean

  consumedDamage?: number
}
```

- [ ] **Step 2: Create `game/src/core/skill/SkillTrigger.ts`**

```ts
import type { CombatEntity } from '../combat/CombatEntity'
import type { Skill } from './Skill'
import type { SkillAction } from './SkillAction'

// Trigger/Action rework (2026-08-31 spec) — only 'onCast' has a production
// firing site in this phase (BattleSystem.resolveSkillEffects). 'onHit'/
// 'onCrit'/'onEvade' are declared now (SkillTriggerRunner is already
// generic over TriggerType) so a later plan can wire their firing site
// with zero changes here — adding a NEW trigger member later still only
// costs one type-union entry + one context interface + one firing call.
export type TriggerType = 'onCast' | 'onHit' | 'onCrit' | 'onEvade'

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

export interface TriggerContextMap {
  onCast: OnCastContext

  onHit: OnHitContext

  onCrit: OnCritContext

  onEvade: OnEvadeContext
}

export interface TriggerBinding<T extends TriggerType = TriggerType> {
  trigger: T

  actions: SkillAction[]
}
```

- [ ] **Step 3: Add `triggers` to `Skill.ts`**

In `game/src/core/skill/Skill.ts`, add the import and field:

```ts
import type { TriggerBinding } from './SkillTrigger'
```

Add near the end of the `Skill` interface (after the `specializations`/`selectedSpecializationId` block, before the closing comment about Node Tree resource fields):

```ts
  // Trigger/Action rework (2026-08-31 spec) — a skill fully migrated off
  // `effects` declares its behavior here instead: each binding pairs a
  // TriggerType with an ordered SkillAction list, run by
  // SkillTriggerRunner. A skill is either on `effects` or on `triggers`,
  // never both — see SkillSystem.getEffectiveSkill()/BattleSystem.
  // resolveSkillEffects() for how the two paths coexist during migration.
  triggers?: TriggerBinding[]
```

- [ ] **Step 4: Type-check**

Run: `cd game && npm run type-check`
Expected: PASS (no errors — these are additive, unused-so-far types).

- [ ] **Step 5: Commit**

```bash
git add game/src/core/skill/SkillAction.ts game/src/core/skill/SkillTrigger.ts game/src/core/skill/Skill.ts
git commit -m "feat(skill): add trigger/action type definitions"
```

---

### Task 2: SkillActionRegistry with the dealDamage executor

**Files:**
- Create: `game/src/core/skill/SkillActionRegistry.ts`
- Test: `game/src/core/skill/SkillActionRegistry.test.ts`

**Interfaces:**
- Consumes: `SkillAction`/`SkillActionType`/`ActionRuntimeContext` (Task 1); `SkillEffectContext` (`game/src/core/skill/SkillEffectSystem.ts`, existing — has `fireHit`, `skillExperience`, etc.); `CombatEntity` (`game/src/core/combat/CombatEntity.ts`, existing).
- Produces: `runSkillAction(action, source, target, ctx, runtime): void`, `SKILL_ACTION_REGISTRY: Record<SkillActionType, ActionExecutor>`.

- [ ] **Step 1: Write the failing test**

Create `game/src/core/skill/SkillActionRegistry.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { runSkillAction, SKILL_ACTION_REGISTRY } from './SkillActionRegistry'
import type { DealDamageAction, SkillActionType } from './SkillAction'
import type { CombatEntity } from '../combat/CombatEntity'
import type { SkillEffectContext } from './SkillEffectSystem'

function makeEntity(overrides: Partial<CombatEntity> = {}): CombatEntity {
  return {
    id: 'entity',
    alive: true,
    realmIndex: 0,
    currentSwordIntent: 0,
    stats: { skillDamagePercent: 0, maxMp: 0, attack: 10 } as CombatEntity['stats'],
    ...overrides,
  } as CombatEntity
}

function makeCtx(overrides: Partial<SkillEffectContext> = {}): SkillEffectContext {
  return {
    combatSystem: {} as SkillEffectContext['combatSystem'],
    fireHit: vi.fn(() => ({ landed: true })),
    buffRegistry: {} as SkillEffectContext['buffRegistry'],
    ailmentRegistry: {} as SkillEffectContext['ailmentRegistry'],
    sourceBuffs: {} as SkillEffectContext['sourceBuffs'],
    targetBuffs: {} as SkillEffectContext['targetBuffs'],
    targetAilments: {} as SkillEffectContext['targetAilments'],
    reactionManager: {} as SkillEffectContext['reactionManager'],
    ...overrides,
  }
}

describe('SKILL_ACTION_REGISTRY', () => {
  it('has an executor for every SkillActionType', () => {
    const types: SkillActionType[] = ['dealDamage']
    for (const type of types) {
      expect(SKILL_ACTION_REGISTRY[type]).toBeTypeOf('function')
    }
  })
})

describe('dealDamage executor', () => {
  it('calls ctx.fireHit once with value × (1 + skillDamagePercent)', () => {
    const source = makeEntity()
    const target = makeEntity()
    const ctx = makeCtx()
    const action: DealDamageAction = { type: 'dealDamage', value: 1, damageType: 'physical' }

    runSkillAction(action, source, target, ctx, {})

    expect(ctx.fireHit).toHaveBeenCalledTimes(1)
    expect(ctx.fireHit).toHaveBeenCalledWith(target, { kind: 'physical', multiplier: 1 })
  })

  it('fires hitCountByRealm+1 hits, stopping early if target dies', () => {
    const source = makeEntity({ realmIndex: 2 })
    const target = makeEntity()
    const ctx = makeCtx({
      fireHit: vi.fn(() => {
        target.alive = false
        return { landed: true }
      }),
    })
    const action: DealDamageAction = { type: 'dealDamage', value: 1, hitCountByRealm: true }

    runSkillAction(action, source, target, ctx, {})

    // realmIndex 2 -> 3 intended hits, but target dies after the first.
    expect(ctx.fireHit).toHaveBeenCalledTimes(1)
  })

  it('applies attributeScaling as additive bonus on top of value', () => {
    const source = makeEntity({ stats: { skillDamagePercent: 0, maxMp: 0, attack: 10 } as CombatEntity['stats'] })
    const target = makeEntity()
    const ctx = makeCtx()
    const action: DealDamageAction = {
      type: 'dealDamage',
      value: 2,
      attributeScaling: [{ attributes: ['attack'], ratioPerPoint: 0.1 }],
    }

    runSkillAction(action, source, target, ctx, {})

    // finalMultiplier = 2 * (1 + 0.1*10) * (1 + 0) = 2 * 2 = 4
    expect(ctx.fireHit).toHaveBeenCalledWith(target, { kind: 'physical', multiplier: 4 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd game && npx vitest run src/core/skill/SkillActionRegistry.test.ts`
Expected: FAIL — `Cannot find module './SkillActionRegistry'`.

- [ ] **Step 3: Write `game/src/core/skill/SkillActionRegistry.ts`**

```ts
import type { ActionRuntimeContext, SkillAction, SkillActionType } from './SkillAction'
import type { CombatEntity } from '../combat/CombatEntity'
import type { SkillEffectContext } from './SkillEffectSystem'

export type ActionExecutor<A extends SkillAction = SkillAction> = (
  action: A,
  source: CombatEntity,
  target: CombatEntity,
  ctx: SkillEffectContext,
  runtime: ActionRuntimeContext,
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
}

export function runSkillAction(
  action: SkillAction,
  source: CombatEntity,
  target: CombatEntity,
  ctx: SkillEffectContext,
  runtime: ActionRuntimeContext,
): void {
  const executor = SKILL_ACTION_REGISTRY[action.type] as ActionExecutor
  executor(action, source, target, ctx, runtime)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd game && npx vitest run src/core/skill/SkillActionRegistry.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add game/src/core/skill/SkillActionRegistry.ts game/src/core/skill/SkillActionRegistry.test.ts
git commit -m "feat(skill): add SkillActionRegistry with dealDamage executor"
```

---

### Task 3: SkillTriggerRunner

**Files:**
- Create: `game/src/core/skill/SkillTriggerRunner.ts`
- Test: `game/src/core/skill/SkillTriggerRunner.test.ts`

**Interfaces:**
- Consumes: `TriggerType`/`TriggerContextMap`/`TriggerBinding` (Task 1); `runSkillAction` (Task 2).
- Produces: `class SkillTriggerRunner { fire<T extends TriggerType>(trigger: T, context: TriggerContextMap[T], triggers: TriggerBinding[] | undefined, source: CombatEntity, target: CombatEntity, ctx: SkillEffectContext): void }`. `triggers` is passed separately from `context.skill` (rather than reading `context.skill.triggers`) because the caller in Task 5 passes the *effective* (already level/flat-bonus-scaled) triggers from `EffectiveSkill.triggers`, while `context.skill` stays the raw `Skill` for identity (`id`/`name`) — `EffectiveSkill` doesn't structurally satisfy `Skill`, so the two must stay separate parameters.

- [ ] **Step 1: Write the failing test**

Create `game/src/core/skill/SkillTriggerRunner.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { SkillTriggerRunner } from './SkillTriggerRunner'
import type { Skill } from './Skill'
import type { CombatEntity } from '../combat/CombatEntity'
import type { SkillEffectContext } from './SkillEffectSystem'

function makeSkill(triggers: Skill['triggers']): Skill {
  return { id: 's', name: 's', description: '', type: 'active', level: 1, maxLevel: 1, cooldown: 0, remainingCooldown: 0, target: 'enemy', effects: [], unlocked: true, equipped: true, triggers } as Skill
}

function makeEntity(): CombatEntity {
  return { id: 'e', alive: true, realmIndex: 0, stats: { skillDamagePercent: 0, maxMp: 0, attack: 1 } as CombatEntity['stats'] } as CombatEntity
}

describe('SkillTriggerRunner', () => {
  it('runs actions bound to the firing trigger, in order', () => {
    const fireHit = vi.fn(() => ({ landed: true }))
    const ctx = { fireHit } as unknown as SkillEffectContext
    const source = makeEntity()
    const target = makeEntity()
    const skill = makeSkill([
      { trigger: 'onCast', actions: [{ type: 'dealDamage', value: 1 }, { type: 'dealDamage', value: 2 }] },
    ])

    new SkillTriggerRunner().fire('onCast', { source, skill }, skill.triggers, source, target, ctx)

    expect(fireHit).toHaveBeenCalledTimes(2)
    expect(fireHit).toHaveBeenNthCalledWith(1, target, { kind: 'physical', multiplier: 1 })
    expect(fireHit).toHaveBeenNthCalledWith(2, target, { kind: 'physical', multiplier: 2 })
  })

  it('ignores bindings for a different trigger', () => {
    const fireHit = vi.fn(() => ({ landed: true }))
    const ctx = { fireHit } as unknown as SkillEffectContext
    const source = makeEntity()
    const target = makeEntity()
    const skill = makeSkill([{ trigger: 'onHit', actions: [{ type: 'dealDamage', value: 1 }] }])

    new SkillTriggerRunner().fire('onCast', { source, skill }, skill.triggers, source, target, ctx)

    expect(fireHit).not.toHaveBeenCalled()
  })

  it('is a no-op when there are no triggers', () => {
    const fireHit = vi.fn()
    const ctx = { fireHit } as unknown as SkillEffectContext
    const source = makeEntity()
    const target = makeEntity()
    const skill = makeSkill(undefined)

    expect(() => new SkillTriggerRunner().fire('onCast', { source, skill }, undefined, source, target, ctx)).not.toThrow()
    expect(fireHit).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd game && npx vitest run src/core/skill/SkillTriggerRunner.test.ts`
Expected: FAIL — `Cannot find module './SkillTriggerRunner'`.

- [ ] **Step 3: Write `game/src/core/skill/SkillTriggerRunner.ts`**

```ts
import type { OnHitContext, TriggerBinding, TriggerContextMap, TriggerType } from './SkillTrigger'
import type { CombatEntity } from '../combat/CombatEntity'
import type { SkillEffectContext } from './SkillEffectSystem'
import type { ActionRuntimeContext } from './SkillAction'
import { runSkillAction } from './SkillActionRegistry'

/**
 * Matches a firing TriggerType against skill.triggers and runs the bound
 * actions in declared order, sharing one ActionRuntimeContext scratch
 * object per binding so a later action can read an earlier action's
 * result (e.g. a future consumeForDamage → heal chain).
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
      const runtime: ActionRuntimeContext =
        hitContext.damageDealt !== undefined
          ? { damageDealt: hitContext.damageDealt, isCrit: hitContext.isCrit }
          : {}

      for (const action of binding.actions) {
        runSkillAction(action, source, target, ctx, runtime)
      }
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd game && npx vitest run src/core/skill/SkillTriggerRunner.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add game/src/core/skill/SkillTriggerRunner.ts game/src/core/skill/SkillTriggerRunner.test.ts
git commit -m "feat(skill): add SkillTriggerRunner"
```

---

### Task 4: EffectiveSkill gains `triggers`, level/flat scaling applies to `dealDamage` too

**Files:**
- Modify: `game/src/core/skill/SkillSystem.ts:52-118`
- Test: `game/src/core/skill/SkillSystem.huyKiem.test.ts` (extend, don't rewrite yet — Task 7 flips the data)

**Interfaces:**
- Consumes: `TriggerBinding`/`DealDamageAction` (Task 1).
- Produces: `EffectiveSkill.triggers?: TriggerBinding[]` — `getEffectiveSkill()` now maps `dealDamage.value` the same way it already maps `effect.value` (Huy Kiếm flat bonus when `skill.id === 'tram'`, else per-level percent multiplier).

- [ ] **Step 1: Write the failing test**

Add to `game/src/core/skill/SkillSystem.huyKiem.test.ts` (new `describe` block, same file):

```ts
describe('Huy Kiếm — flat bonus applies through triggers too (Task 4, engine not yet wired to data)', () => {
  it('getEffectiveSkill maps a dealDamage action.value the same way it maps effect.value', () => {
    const manager = new SkillManager()
    const system = new SkillSystem(manager)
    const template = SKILLS.find((skill) => skill.id === 'tram')!
    system.learn(template)
    const skill = manager.get('tram')!
    skill.totalExperience = 150
    skill.triggers = [{ trigger: 'onCast', actions: [{ type: 'dealDamage', value: 1, damageType: 'physical' }] }]

    const effective = system.getEffectiveSkill(skill)

    const action = effective.triggers?.[0]?.actions[0]
    expect(action?.type).toBe('dealDamage')
    expect((action as { value?: number }).value).toBe(1 + 15)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd game && npx vitest run src/core/skill/SkillSystem.huyKiem.test.ts -t "flat bonus applies through triggers"`
Expected: FAIL — `effective.triggers` is `undefined` (property doesn't exist on `EffectiveSkill` yet, or is `undefined` because `getEffectiveSkill` never copies it).

- [ ] **Step 3: Update `game/src/core/skill/SkillSystem.ts`**

Add the import at the top:

```ts
import type { TriggerBinding } from './SkillTrigger'
import type { DealDamageAction } from './SkillAction'
```

Change the `EffectiveSkill` interface (line 52):

```ts
export interface EffectiveSkill {
  effects: SkillEffect[]

  triggers?: TriggerBinding[]

  passiveModifiers?: StatModifier[]

  passiveTrigger?: PassiveTrigger
}
```

Change `getEffectiveSkill()` (lines 87-118) to also map `skill.triggers`:

```ts
  getEffectiveSkill(skill: Skill, levelOverride?: number): EffectiveSkill {
    const specialization = skill.specializations?.find(
      candidate => candidate.id === skill.selectedSpecializationId,
    )

    const baseEffects = specialization?.effectsOverride ?? skill.effects

    const effectiveLevel = levelOverride ?? skill.level
    const levelMultiplier = 1 + (effectiveLevel - 1) * ACTIVE_SKILL_DAMAGE_PERCENT_PER_LEVEL

    const isHuyKiem = skill.id === 'tram'

    const scaleDamageValue = (value: number): number =>
      isHuyKiem ? value + getHuyKiemFlatDamageBonus(skill.totalExperience ?? 0) : value * levelMultiplier

    const effects = baseEffects.map((effect) => {
      if (effect.type !== 'damage' || effect.value === undefined) {
        return effect
      }

      return { ...effect, value: scaleDamageValue(effect.value) }
    })

    // Trigger/Action rework (2026-08-31 spec) — mirrors the effects
    // mapping above for skills already migrated to `triggers`: a
    // `dealDamage` action's `value` gets the same per-level/flat-bonus
    // treatment `effect.value` gets. Skills still on `effects` have
    // `skill.triggers === undefined`, so this is a no-op for them.
    const triggers = skill.triggers?.map((binding) => ({
      ...binding,
      actions: binding.actions.map((action) => {
        if (action.type !== 'dealDamage' || action.value === undefined) {
          return action
        }

        return { ...action, value: scaleDamageValue(action.value) } satisfies DealDamageAction
      }),
    }))

    return {
      effects,

      triggers,

      passiveModifiers: specialization?.passiveModifiersOverride ?? skill.passiveModifiers,

      passiveTrigger: specialization?.passiveTriggerOverride ?? skill.passiveTrigger,
    }
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd game && npx vitest run src/core/skill/SkillSystem.huyKiem.test.ts`
Expected: PASS (all tests in the file, including the pre-existing ones — this change is additive and must not alter the `effects` mapping's output).

- [ ] **Step 5: Type-check**

Run: `cd game && npm run type-check`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add game/src/core/skill/SkillSystem.ts game/src/core/skill/SkillSystem.huyKiem.test.ts
git commit -m "feat(skill): EffectiveSkill.triggers, scale dealDamage.value like effect.value"
```

---

### Task 5: Wire `onCast` into `BattleSystem.resolveSkillEffects`

**Files:**
- Modify: `game/src/core/battle/BattleSystem.ts:2624-2792` (`resolveSkillEffects`)
- Test: `game/src/core/battle/BattleSystem.skillTriggers.test.ts` (new)

**Interfaces:**
- Consumes: `SkillTriggerRunner` (Task 3), `EffectiveSkill.triggers` (Task 4).
- Produces: `BattleSystem` now has a `private readonly skillTriggerRunner = new SkillTriggerRunner()` field; skills with `effective.triggers?.length` fire `onCast` once per resolved target through the new engine, alongside (not replacing) the existing `effects`-based `applyEffects` calls which stay untouched for every other skill.

- [ ] **Step 1: Write the failing test**

Create `game/src/core/battle/BattleSystem.skillTriggers.test.ts`, reusing the exact harness shape from `BattleSystem.kiemTuResources.test.ts` (same constructor argument order/count — read that file if this drifts):

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

function makeTriggerSkill(): Skill {
  return {
    id: 'test_trigger_skill',
    name: 'Test Trigger Skill',
    description: '',
    type: 'active',
    level: 1,
    maxLevel: 1,
    cooldown: 0,
    remainingCooldown: 0,
    cost: 0,
    resourceType: 'none',
    target: 'enemy',
    effects: [],
    triggers: [
      { trigger: 'onCast', actions: [{ type: 'dealDamage', value: 5, damageType: 'physical' }] },
    ],
    execution: { kind: 'attack_speed', attackSpeedMultiplier: 1 },
    loadoutSlot: 0,
    loadoutSlots: [0],
    unlocked: true,
    equipped: true,
  }
}

function setup(skill: Skill) {
  const eventBus = new EventBus()
  const skillManager = new SkillManager()
  const skillSystem = new SkillSystem(skillManager)
  const system = new BattleSystem(
    new CombatSystem(eventBus),
    skillManager,
    skillSystem,
    new SkillEffectSystem(),
    new BuffRegistry(),
    new AilmentRegistry(),
    eventBus,
    new ActionImpactSystem({ eventBus, rollCritical: () => false }),
    undefined,
    undefined,
    undefined,
    () => 'kiem_tran',
    () => 0,
    () => 0,
  )

  skillManager.add(skill)

  return { system, skillSystem }
}

describe('BattleSystem — onCast trigger wiring', () => {
  it('a skill defined with triggers deals damage through the new engine', () => {
    const skill = makeTriggerSkill()
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

    system.update(3) // clear the opening countdown
    const hpBefore = enemy.currentHp
    system.update(0.2) // let the attack_speed cadence fire one cast

    expect(enemy.currentHp).toBeLessThan(hpBefore)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd game && npx vitest run src/core/battle/BattleSystem.skillTriggers.test.ts`
Expected: FAIL — enemy HP unchanged (triggers not wired yet), or a thrown error if `skillTriggerRunner` doesn't exist.

- [ ] **Step 3: Wire the runner into `BattleSystem.ts`**

Add the import near the other skill imports:

```ts
import { SkillTriggerRunner } from '../skill/SkillTriggerRunner'
```

Add a field alongside the other `private readonly` system instances (near `skillEffectSystem`):

```ts
  private readonly skillTriggerRunner = new SkillTriggerRunner()
```

In `resolveSkillEffects`, immediately after the existing loop:

```ts
    for (const oneTarget of targets) {
      applyEffects(areaEffects, oneTarget)
    }
```

add:

```ts
    // Trigger/Action rework (2026-08-31 spec) — skills fully migrated to
    // `triggers` (effective.effects === []) fire onCast here instead.
    // Reuses the SAME batch (beginSkillBatch() already ran above) so
    // ctx.fireHit still lands inside one action_impact VFX event.
    if (effective.triggers?.length) {
      for (const oneTarget of targets) {
        let landedHit = false
        const targetBuffs = new BuffSystem(this.getBuffsFor(battle, oneTarget))
        const targetAilments = new AilmentSystem(this.getAilmentsFor(battle, oneTarget))

        const triggerCtx: SkillEffectContext = {
          combatSystem: this.combat,
          fireHit: (hitTarget, damageInfo) => {
            const result = this.actionImpact.fireSkillHit(
              battle,
              source,
              hitTarget,
              damageInfo,
              { skillId: skill.id },
              (battleRef, hitSource, hitTargetEntity, hitDamage, hitOptions) =>
                this.applyActionHit(battleRef, hitSource, hitTargetEntity, hitDamage, hitOptions),
            )
            landedHit ||= result.landed
            return result
          },
          didLandHit: () => landedHit,
          buffRegistry: this.buffRegistry,
          ailmentRegistry: this.ailmentRegistry,
          sourceBuffs,
          targetBuffs,
          targetAilments,
          reactionManager: this.reactionManager,
          reactionKeepChance: this.getReactionKeepChance(),
          spawnLavaZone: (spec) => this.spawnLavaZone(battle, spec),
          spawnSwordZone: (spec) => this.spawnSwordZone(battle, spec),
          skillId: skill.id,
          skillExperience: skill.totalExperience ?? skill.experience ?? 0,
        }

        this.skillTriggerRunner.fire(
          'onCast',
          { source, skill },
          effective.triggers,
          source,
          oneTarget,
          triggerCtx,
        )
      }
    }
```

`sourceBuffs` here is the existing `const sourceBuffs = new BuffSystem(this.getBuffsFor(battle, source))` already declared earlier in `resolveSkillEffects` (line 2648) — reuse it, do not redeclare.

Confirm `SkillEffectContext` is already imported in this file (it is, via the existing `applyEffects` closure's usage) — if not, add:

```ts
import type { SkillEffectContext } from '../skill/SkillEffectSystem'
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd game && npx vitest run src/core/battle/BattleSystem.skillTriggers.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the full BattleSystem suite to confirm no regression**

Run: `cd game && npx vitest run src/core/battle/`
Expected: PASS — every existing `effects`-based skill test still passes unchanged (this task only adds a new branch, never touches the old one).

- [ ] **Step 6: Type-check**

Run: `cd game && npm run type-check`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add game/src/core/battle/BattleSystem.ts game/src/core/battle/BattleSystem.skillTriggers.test.ts
git commit -m "feat(battle): wire onCast trigger firing into resolveSkillEffects"
```

---

### Task 6: Parity test — dealDamage action output equals the old damage effect output

**Files:**
- Test: `game/src/core/skill/SkillEffectParity.test.ts` (new)

**Interfaces:**
- Consumes: `SkillEffectSystem.apply` (existing), `runSkillAction` (Task 2).

- [ ] **Step 1: Write the test**

```ts
import { describe, expect, it, vi } from 'vitest'
import { SkillEffectSystem } from './SkillEffectSystem'
import type { SkillEffectContext } from './SkillEffectSystem'
import { runSkillAction } from './SkillActionRegistry'
import type { CombatEntity } from '../combat/CombatEntity'

function makeEntity(): CombatEntity {
  return {
    id: 'e', alive: true, realmIndex: 3, currentSwordIntent: 0,
    stats: { skillDamagePercent: 0.2, maxMp: 50, attack: 12 } as CombatEntity['stats'],
  } as CombatEntity
}

function makeCtx(fireHit: SkillEffectContext['fireHit']): SkillEffectContext {
  return {
    combatSystem: {} as SkillEffectContext['combatSystem'],
    fireHit,
    buffRegistry: {} as SkillEffectContext['buffRegistry'],
    ailmentRegistry: {} as SkillEffectContext['ailmentRegistry'],
    sourceBuffs: {} as SkillEffectContext['sourceBuffs'],
    targetBuffs: {} as SkillEffectContext['targetBuffs'],
    targetAilments: {} as SkillEffectContext['targetAilments'],
    reactionManager: {} as SkillEffectContext['reactionManager'],
    skillExperience: 200,
  }
}

describe('parity — old damage SkillEffect vs new dealDamage SkillAction', () => {
  it('produce the exact same fireHit call for Huy Kiếm-shaped input', () => {
    const source = makeEntity()
    const target = makeEntity()

    const oldCalls: unknown[] = []
    new SkillEffectSystem().apply(
      { type: 'damage', value: 1, damageType: 'physical' },
      source,
      target,
      makeCtx((...args) => {
        oldCalls.push(args)
        return { landed: true }
      }),
    )

    const newCalls: unknown[] = []
    runSkillAction(
      { type: 'dealDamage', value: 1, damageType: 'physical' },
      source,
      target,
      makeCtx((...args) => {
        newCalls.push(args)
        return { landed: true }
      }),
      {},
    )

    expect(newCalls).toEqual(oldCalls)
  })
})
```

- [ ] **Step 2: Run test to verify it passes**

Run: `cd game && npx vitest run src/core/skill/SkillEffectParity.test.ts`
Expected: PASS. If it fails, the `dealDamage` executor in Task 2 has drifted from `SkillEffectSystem.apply()`'s `case 'damage'` — fix the executor, not this test.

- [ ] **Step 3: Commit**

```bash
git add game/src/core/skill/SkillEffectParity.test.ts
git commit -m "test(skill): parity check between old damage effect and new dealDamage action"
```

---

### Task 7: Migrate Huy Kiếm's data to `triggers`, cut over fully

**Files:**
- Modify: `game/src/data/skill/Skills.ts` (the `tram` entry)
- Modify: `game/src/core/skill/SkillSystem.huyKiem.test.ts` (rewrite the 3 assertions that read `effects`)

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Update the failing assertions first**

In `game/src/core/skill/SkillSystem.huyKiem.test.ts`, change the 3 places that currently read `effects.find(effect => effect.type === 'damage')` for the `tram`/Huy Kiếm skill to read the `dealDamage` action instead:

```ts
  it('getEffectiveSkill cộng flat bonus vào action dealDamage của tram', () => {
    const manager = new SkillManager()
    const system = new SkillSystem(manager)
    const template = SKILLS.find((skill) => skill.id === 'tram')!
    system.learn(template)
    const skill = manager.get('tram')!
    skill.totalExperience = 150

    const effective = system.getEffectiveSkill(skill)

    const action = effective.triggers?.[0]?.actions[0]
    expect(action?.type).toBe('dealDamage')
    expect((action as { value?: number }).value).toBe(1 + 15)
  })
```

```ts
  it('action dealDamage của tram KHÔNG còn skillExperienceRatio (flat-only, spec §2)', () => {
    const template = SKILLS.find((skill) => skill.id === 'tram')!
    const action = template.triggers?.[0]?.actions[0]

    expect((action as { skillExperienceRatio?: number })?.skillExperienceRatio).toBeUndefined()
  })
```

The third (`'skill khác KHÔNG nhận flat bonus'`, using `hoa_cau_thuat`) is unaffected — `hoa_cau_thuat` stays on `effects`, leave it unchanged.

Also delete the Task 4 scratch `describe` block added in Task 4 Step 1 (`'flat bonus applies through triggers too (Task 4...)'`) — it was a throwaway proof for the engine change and is now superseded by the real data-driven assertions above.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd game && npx vitest run src/core/skill/SkillSystem.huyKiem.test.ts`
Expected: FAIL — `effective.triggers` is `undefined` because `tram`'s data in `Skills.ts` doesn't declare `triggers` yet.

- [ ] **Step 3: Update `game/src/data/skill/Skills.ts`**

Change the `tram` entry's `effects`/add `triggers` (keep every other field on the object untouched):

```ts
    effects: [],

    triggers: [
      {
        trigger: 'onCast',
        actions: [
          {
            type: 'dealDamage',

            value: 1,

            damageType: 'physical',
          },
        ],
      },
    ],
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd game && npx vitest run src/core/skill/SkillSystem.huyKiem.test.ts`
Expected: PASS (all tests, including the untouched `'3 level mốc'`/`'không thể nâng Huy Kiếm bằng Cảm Ngộ'` blocks — those exercise `useInSlot`/leveling, not `effects` shape, so they must keep passing without modification).

- [ ] **Step 5: Run the full skill + battle suites**

Run: `cd game && npx vitest run src/core/skill/ src/core/battle/`
Expected: PASS. This confirms: (a) no other test anywhere reads `tram`'s `effects` and breaks, (b) `BattleSystem.resolveSkillEffects`'s new `onCast` branch now actually drives Huy Kiếm's real in-battle damage, not just the synthetic test skill from Task 5.

- [ ] **Step 6: Type-check**

Run: `cd game && npm run type-check`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add game/src/data/skill/Skills.ts game/src/core/skill/SkillSystem.huyKiem.test.ts
git commit -m "feat(skill): migrate Huy Kiếm (tram) to the trigger/action engine"
```

---

### Task 8: Usage guide

**Files:**
- Create: `game/docs/skill-trigger-action-usage-guide.md`

- [ ] **Step 1: Write the guide**

```markdown
# Skill Trigger/Action Engine — Usage Guide

How to work with the trigger/action skill engine introduced by
`docs/superpowers/specs/2026-08-31-skill-trigger-action-rework-design.md`.
A skill is either fully on the old `effects: SkillEffect[]` shape or fully
on the new `triggers: TriggerBinding[]` shape — never both.

## Add a new skill using triggers you already have

1. Pick the trigger (`onCast` today — the only one wired into
   `BattleSystem`) and the action(s) you need (`dealDamage` today —
   `game/src/core/skill/SkillAction.ts`).
2. Add the skill to `game/src/data/skill/Skills.ts` with `effects: []` and
   a `triggers` array, e.g.:

   ```ts
   triggers: [
     { trigger: 'onCast', actions: [{ type: 'dealDamage', value: 1, damageType: 'physical' }] },
   ],
   ```
3. `SkillSystem.getEffectiveSkill()` already applies per-level scaling to
   any `dealDamage.value` — no extra work needed unless your skill needs
   the Huy-Kiếm-style flat-per-cast bonus (that special case is keyed off
   `skill.id === 'tram'` in `SkillSystem.ts` — do not copy that pattern for
   a new skill; ask before adding a second hardcoded id there).
4. Write a `SkillSystem.*.test.ts`/`BattleSystem.*.test.ts` covering it,
   same as any existing skill.

## Add a new TriggerType

1. Add the literal to `TriggerType` in `game/src/core/skill/SkillTrigger.ts`.
2. Add its context interface (what data the trigger carries) to the same
   file, and a matching entry in `TriggerContextMap`.
3. Add ONE firing call at the site in the codebase where that moment
   actually happens (e.g. the missile-resolve callback in
   `BattleSystem.ts` for a hit-based trigger, `CombatSystem.ts` for a
   kill/death trigger) — call `skillTriggerRunner.fire(yourTrigger, context, triggers, source, target, ctx)`,
   where `triggers` is the resolved `TriggerBinding[]` for the current
   skill (e.g. `effective.triggers` in production code, not the
   `Skill`/`EffectiveSkill` object itself).
   No other file needs to change: `SkillTriggerRunner` is generic over
   `TriggerType` already.
4. Add a firing-site-level test (see `SkillTriggerRunner.test.ts` for the
   pattern) using a synthetic skill fixture, independent of any real game
   skill.

## Add a new SkillActionType

1. Add the interface to `game/src/core/skill/SkillAction.ts` and union it
   into `SkillAction`.
2. Add its executor to `SKILL_ACTION_REGISTRY` in
   `game/src/core/skill/SkillActionRegistry.ts` — TypeScript will refuse to
   compile until every `SkillActionType` has one, so you cannot forget
   this step.
3. Add a registry-level test (see `SkillActionRegistry.test.ts`) — one
   test per action type, independent of any specific skill or trigger.
4. If porting an existing `SkillEffect` mechanic, keep the numeric formula
   byte-for-byte identical to `SkillEffectSystem.apply()`'s matching case —
   write a parity test like `SkillEffectParity.test.ts` before deleting the
   old field/case.

## Add a new VFX for an action

Do not build a new event pipeline. `spawnVfx` (not yet implemented — add
it the same way as any other action, per the section above) should just
call `eventBus.emit('action_impact', {...})` — the exact event
`ActionImpactSystem.ts` already emits and `CombatScene.ts`/
`CombatVfxSpawner` already subscribe to once. Adding a new VFX *look* is a
`game/src/data/vfx/CombatVfxPresets.ts` entry, not a code change anywhere
else.

## What's NOT migrated yet

Every skill other than Huy Kiếm (`tram`) is still on the old `effects`
shape and works exactly as before — `SkillEffectSystem`/`SkillEffect.ts`
are untouched and will stay in use until each path (Hỏa Tu, Thủy Tu, Mộc
Tu, Thổ Tu, Kim Tu, the rest of Kiếm Tu, Thể Tu) gets its own migration
plan, per the design spec's migration order.
```

- [ ] **Step 2: Commit**

```bash
git add game/docs/skill-trigger-action-usage-guide.md
git commit -m "docs: add skill trigger/action engine usage guide"
```

---

### Task 9: Update the `tutienidle-skill-design` project skill

**Files:**
- Modify: `.agents/skills/tutienidle-skill-design/references/skill-architecture.md`
- Modify: `.agents/skills/tutienidle-skill-design/SKILL.md`

**Interfaces:**
- None (documentation only).

- [ ] **Step 1: Update `SKILL.md`'s workflow step 3**

In `.agents/skills/tutienidle-skill-design/SKILL.md`, replace the line:

```markdown
3. **Draft the data**: `Skill` object in `Skills.ts` (or `ProgressionNode` in `game/src/data/progression/` for a tree branch) with `effects`, `execution`, `resourceType`/`cost`, `targeting`.
```

with:

```markdown
3. **Draft the data**: for a skill using only `onCast`/`dealDamage` (the triggers/actions implemented so far — see `game/docs/skill-trigger-action-usage-guide.md`), use the new `triggers` shape with `effects: []`. For any mechanic not yet ported to an action (everything except a plain hit), use the old `effects: SkillEffect[]` shape — do not half-migrate a skill. `Skill` object goes in `Skills.ts` (or `ProgressionNode` in `game/src/data/progression/` for a tree branch) with `execution`, `resourceType`/`cost`, `targeting` either way.
```

- [ ] **Step 2: Add a section to `references/skill-architecture.md`**

Insert a new section right after "## SkillEffect (`SkillEffect.ts`)" and before "## Ailments":

```markdown
## Trigger/Action engine (in progress — 2026-08-31 rework)

A new, generic alternative to per-skill `SkillEffect` fields is being
phased in (`docs/superpowers/specs/2026-08-31-skill-trigger-action-rework-design.md`),
skill by skill. A skill declares `triggers: TriggerBinding[]` (`game/src/core/skill/SkillTrigger.ts`)
instead of `effects`: each binding pairs a `TriggerType` with an ordered
`SkillAction` list, run through the exhaustive `SkillActionRegistry`
(`game/src/core/skill/SkillActionRegistry.ts`). A skill is EITHER on
`effects` OR on `triggers`, never both.

As of this writing only `onCast`/`dealDamage` are implemented — that
covers a plain-hit active skill (Huy Kiếm/`tram` is the reference
example). Everything else (ailments, buffs, resource grants, Detonate,
ward-consume, sword zones, Kiếm Tu multi-hit, Thổ Tu AOE, ...) is still
only expressible via the old `SkillEffect` fields documented above — check
`game/src/core/skill/SkillAction.ts`'s `SkillAction` union for the current
list before assuming an action exists. See
`game/docs/skill-trigger-action-usage-guide.md` for how to add a new
trigger, action, or skill using this engine.
```

- [ ] **Step 3: Commit**

```bash
git add .agents/skills/tutienidle-skill-design/SKILL.md .agents/skills/tutienidle-skill-design/references/skill-architecture.md
git commit -m "docs(skill): point tutienidle-skill-design at the trigger/action engine"
```

---

## Out of scope for this plan (future plans, per the design spec's migration order)

- Wiring `onHit`/`onCrit`/`onEvade` firing sites into `BattleSystem`'s missile-resolve callback (~`BattleSystem.ts:1321`) — lands with whichever path first needs a reactive on-hit mechanic (e.g. Kiếm Tu's `grantsSwordIntentPerHit`).
- `onKill`/`onDeath`/`onTick`/`onProc`/`onBreak`/`onResourceFull` triggers and their firing sites.
- `heal`/`applyBuff`/`applyDebuff`/`applyAilment`/`addStack`/`removeBuff`/`grantResource`/`consumeResource`/`consumeForDamage`/`spawnZone`/`applyMovement`/`spawnVfx` actions.
- Migrating any skill other than Huy Kiếm (`tram`).
- `Skill.ts`/`SkillEffect.ts` field cleanup and `CURRENT_SAVE_VERSION` bump (only happens after the last path is migrated, per the spec).
- Generic tooltip generation from `skill.triggers` (spec's migration step 5, deliberately last).
- `beginSkillBatch`'s `hitCount`/`earthPureActive` derivation (`BattleSystem.ts:2664-2696`) currently only reads `effective.effects` — a future action with `hitCountByRealm`/AOE behavior will need this updated to also check `effective.triggers`. Not needed for Huy Kiếm (no such flags), but flag it when the first triggers-based skill needs multi-hit or AOE.
