# Unified Buff System (Buff + Ailment merge) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the two parallel `Buff`/`Ailment` systems with one `Buff`
concept whose behavior is pluggable (`effects: BuffEffect[]`), where every
instance carries a real `sourceId` and storage keys on `(id, sourceId)` so
multiple sources coexist instead of colliding.

**Architecture:** New `game/src/core/buff/` module (`BuffTypes.ts`,
`Buff.ts`/`BuffDefinition.ts`, `BuffPool.ts`, `BuffSystem.ts`) replaces
`BuffManager`+`AilmentManager`+`BuffSystem`+`AilmentSystem` outright — no
migration shim, per the user's explicit go-ahead to rip out and rebuild
since nothing here is persisted (`Battle.ts:125` confirms Buff/Ailment
instances are 100% ephemeral, never saved). `game/src/core/ailment/` is
deleted once every call site and test case has moved over.

**Tech Stack:** TypeScript, Vitest, existing `game/src/core/battle`/
`game/src/core/skill`/`game/src/core/combat`/`game/src/core/element` modules.

**Spec:** `docs/superpowers/specs/2026-09-01-unified-buff-system-design.md`

## Global Constraints

- No skill/ailment balance numbers change — every ported formula must be
  byte-for-byte identical to today's `AilmentSystem`/`SkillEffectSystem`
  math. Parity tests enforce this per task.
- `BuffEffect` stays a closed, exhaustive union (4 kinds: `statModifier`,
  `dot`, `cc`, `onHitProc`) — not an open-ended DSL. New kinds are added by
  extending the union + the exhaustive switch in each consumer method (see
  "Spec deviation" below), same compile-error-on-missing-case guarantee
  `SKILL_ACTION_REGISTRY` already gives, achieved without forcing every kind
  through one artificial function signature.
- **Spec deviation (decided during this plan, not a scope change):** the
  spec's "Registry & definitions" section suggested `BuffRegistry` holds
  `Buff` objects directly with no separate template type, mirroring how
  today's `BuffRegistry` works. This plan corrects that: a `dot` effect's
  damage-per-second must be *resolved* from a ratio against `source.stats`/
  `target.stats` at apply time (exactly how `AilmentTemplate.dpsRatio` →
  `Ailment.damagePerSecond` works today) — a template cannot pre-bake that
  number. So `BuffRegistry` holds `BuffDefinition` (template: `dot` effect
  carries `dpsRatio`), and `BuffSystem.apply()` produces a runtime `Buff`
  (its `dot` effect carries the resolved `damagePerSecond`). `statModifier`/
  `cc`/`onHitProc` effects are identical between template and runtime (no
  resolution step needed), so only `dot` has two shapes. This is the same
  template/instance split `AilmentTemplate`/`Ailment` already had — the
  merge collapses Buff and Ailment into one concept, but does not collapse
  template and runtime-instance, which were never the same thing for DoT.
- Every ported `Ailment`/`AilmentTemplate` field keeps its original
  semantics and comment intent — see Task 7's per-definition port table.
- `game/src/core/ailment/` and `game/src/data/ailment/ailments.ts` are
  deleted only in Task 16/17, after everything that depended on them has
  moved — do not delete early.

---

### Task 1: `BuffTypes.ts` — polarity, stack mode, effect unions (template + runtime)

**Files:**
- Create: `game/src/core/buff/BuffTypes.ts`
- Test: `game/src/core/buff/BuffTypes.test.ts`

**Interfaces:**
- Produces: `BuffPolarity`, `BuffStackMode`, `BuffCcEffect`,
  `BuffEffectTemplate` (union, for `BuffDefinition`), `BuffEffect` (union,
  for runtime `Buff`) — every later task imports from here.

This task is pure types — the "test" is a type-level compile check plus one
smoke test confirming the module has no runtime side effects (importing it
does not throw), since there is no runtime behavior yet to unit test.

- [ ] **Step 1: Write `BuffTypes.ts`**

```ts
import type { StatType } from '../stats/StatTypes'
import type { ElementType } from '../element/ElementType'

export type BuffPolarity = 'buff' | 'debuff'

export type BuffStackMode = 'stack' | 'refresh' | 'replace'

export type BuffCcEffect = 'stun' | 'freeze' | 'root'

// --- Template-time shapes (BuffDefinition.effects) ---

export interface StatModifierEffect {
  type: 'statModifier'
  stat: StatType
  percent?: number
  flat?: number
}

export interface DotEffectTemplate {
  type: 'dot'
  // Ratio against source Power (ATK or elemental Power depending on
  // `element`) — resolved into a snapshotted `damagePerSecond` number by
  // BuffSystem.apply(), exactly like AilmentTemplate.dpsRatio did.
  dpsRatio: number
  element?: ElementType | 'physical'
  // Mộc Tu "Độc Căn" DoT scaling — ported verbatim from
  // AilmentTemplate.poisonRootPercentPerStack/poisonRootMaxStacks/
  // poisonRootThresholdBonusPercent (static, not resolved — copied as-is
  // onto the runtime effect).
  poisonRootPercentPerStack?: number
  poisonRootMaxStacks?: number
  poisonRootThresholdBonusPercent?: number
}

export interface CcEffect {
  type: 'cc'
  ccEffect: BuffCcEffect
}

export interface OnHitProcEffect {
  type: 'onHitProc'
  chance: number
  appliesBuffId: string
}

export type BuffEffectTemplate = StatModifierEffect | DotEffectTemplate | CcEffect | OnHitProcEffect

// --- Runtime shapes (Buff.effects) ---

export interface DotEffect {
  type: 'dot'
  // Resolved once at apply time (source.stats snapshot) — see
  // BuffSystem.apply(). NOT re-read from source every tick.
  damagePerSecond: number
  element?: ElementType | 'physical'
  poisonRootPercentPerStack?: number
  poisonRootMaxStacks?: number
  poisonRootThresholdBonusPercent?: number
}

export type BuffEffect = StatModifierEffect | DotEffect | CcEffect | OnHitProcEffect
```

- [ ] **Step 2: Write the smoke test**

```ts
import { describe, it, expect } from 'vitest'
import type { BuffEffect, BuffEffectTemplate } from './BuffTypes'

describe('BuffTypes', () => {
  it('StatModifierEffect/CcEffect/OnHitProcEffect are structurally identical between template and runtime', () => {
    const template: BuffEffectTemplate = { type: 'cc', ccEffect: 'stun' }
    const runtime: BuffEffect = template

    expect(runtime.type).toBe('cc')
  })

  it('DotEffectTemplate carries dpsRatio, runtime DotEffect carries damagePerSecond', () => {
    const template: BuffEffectTemplate = { type: 'dot', dpsRatio: 0.5, element: 'fire' }
    const runtime: BuffEffect = { type: 'dot', damagePerSecond: 12.5, element: 'fire' }

    expect(template.type).toBe('dot')
    expect(runtime.type).toBe('dot')
  })
})
```

- [ ] **Step 3: Run test to verify it passes**

Run: `cd game && npx vitest run src/core/buff/BuffTypes.test.ts`
Expected: PASS (this is a compile-then-trivially-pass test — its real job is
making `npm run type-check` fail loudly if the two unions ever drift apart
incompatibly).

- [ ] **Step 4: Type-check**

Run: `cd game && npm run type-check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add game/src/core/buff/BuffTypes.ts game/src/core/buff/BuffTypes.test.ts
git commit -m "feat(buff): add unified BuffEffect/BuffEffectTemplate vocabulary"
```

---

### Task 2: `BuffDefinition.ts` + `Buff.ts` — template and runtime instance types

**Files:**
- Create: `game/src/core/buff/BuffDefinition.ts`
- Modify: `game/src/core/buff/Buff.ts` (full rewrite)
- Test: none (pure types, covered by Task 1's compile-check pattern via
  downstream tasks that actually construct these)

**Interfaces:**
- Consumes: `BuffPolarity`, `BuffStackMode`, `BuffEffectTemplate`,
  `BuffEffect` (Task 1).
- Produces: `BuffDefinition`, `Buff` — every later task's core data shape.

- [ ] **Step 1: Write `BuffDefinition.ts`**

```ts
import type { BuffPolarity, BuffStackMode, BuffEffectTemplate } from './BuffTypes'

/**
 * Static, authored data — registered once into BuffRegistry, never
 * mutated. `BuffSystem.apply()` reads this to produce a runtime `Buff`
 * instance (Buff.ts) with any ratio-based effect resolved against the
 * casting source's stats.
 */
export interface BuffDefinition {
  id: string
  name: string
  description?: string
  polarity: BuffPolarity
  hidden?: boolean

  duration: number
  maxStacks?: number
  stackMode: BuffStackMode

  convertsToId?: string
  convertsAfterContinuousSeconds?: number

  effects: BuffEffectTemplate[]
}
```

- [ ] **Step 2: Rewrite `Buff.ts`**

```ts
import type { BuffPolarity, BuffStackMode, BuffEffect } from './BuffTypes'

/**
 * A buff/debuff/DoT/CC instance active on one entity, granted by one
 * source. Storage key is `(id, sourceId)` — see BuffPool.ts — so two
 * different sources each get their own independent instance of the same
 * buff `id` on one target; only the SAME source re-applying triggers
 * stack/refresh/replace (BuffSystem.apply()).
 */
export interface Buff {
  id: string
  sourceId: string
  targetId: string
  polarity: BuffPolarity
  hidden?: boolean

  duration: number
  remainingTime: number
  stacks: number
  maxStacks?: number
  stackMode: BuffStackMode

  // Whole-instance replacement chain (Làm Chậm -> Đóng Băng) — ported
  // verbatim from Ailment.continuousSeconds/convertsToId/
  // convertsAfterContinuousSeconds. Lives on the envelope, not inside an
  // effect, because it replaces the ENTIRE buff, not one behavior within it.
  continuousSeconds: number
  convertsToId?: string
  convertsAfterContinuousSeconds?: number

  effects: BuffEffect[]
}
```

- [ ] **Step 3: Type-check**

Run: `cd game && npm run type-check`
Expected: FAIL — every current consumer of the old `Buff` shape
(`category`/`modifiers` fields, now gone) and the old `Ailment` type breaks.
This is the correct, expected failure — later tasks fix each consumer.
Confirm the failure list includes `BuffSystem.ts`, `BuffManager.ts`,
`BuffRegistry.ts`, `game/src/data/buff/buffs.ts` at minimum (do not fix any
of them yet — that's Tasks 3-7).

- [ ] **Step 4: Commit**

```bash
git add game/src/core/buff/BuffDefinition.ts game/src/core/buff/Buff.ts
git commit -m "feat(buff): rewrite Buff as unified runtime instance, add BuffDefinition template"
```

---

### Task 3: `BuffPool.ts` — composite-key `(id, sourceId)` storage (replaces `BuffManager`)

**Files:**
- Create: `game/src/core/buff/BuffPool.ts`
- Test: `game/src/core/buff/BuffPool.test.ts`
- Delete: `game/src/core/buff/BuffManager.ts` (this task — nothing outside
  `BuffSystem.ts` constructs `BuffManager` directly except test fixtures,
  which Task 17's sweep handles; `BuffManager`'s only remaining internal
  consumer, `BuffSystem.ts`, is rewritten in Task 4, so deleting the old
  file now and leaving `BuffSystem.ts` broken until Task 4 is fine — same
  spirit as Task 2's Step 3)

**Interfaces:**
- Consumes: `Buff` (Task 2).
- Produces: `BuffPool` class — `getAllById(id): Buff[]`,
  `getFromSource(id, sourceId): Buff | undefined`, `getAll(): Buff[]`,
  `hasAny(id): boolean`, `add(buff): void`, `removeInstance(id, sourceId): void`,
  `removeAllById(id): void`, `clear(): void`.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { BuffPool } from './BuffPool'
import type { Buff } from './Buff'

function makeBuff(overrides: Partial<Buff> = {}): Buff {
  return {
    id: 'test_buff', sourceId: 'source_1', targetId: 'target_1',
    polarity: 'debuff', duration: 5, remainingTime: 5, stacks: 1,
    stackMode: 'refresh', continuousSeconds: 0, effects: [],
    ...overrides,
  }
}

describe('BuffPool', () => {
  let pool: BuffPool

  beforeEach(() => {
    pool = new BuffPool()
  })

  it('getFromSource returns the exact (id, sourceId) instance', () => {
    pool.add(makeBuff({ sourceId: 'a' }))
    pool.add(makeBuff({ sourceId: 'b' }))

    expect(pool.getFromSource('test_buff', 'a')?.sourceId).toBe('a')
    expect(pool.getFromSource('test_buff', 'b')?.sourceId).toBe('b')
    expect(pool.getFromSource('test_buff', 'c')).toBeUndefined()
  })

  it('getAllById returns every source instance of one id', () => {
    pool.add(makeBuff({ sourceId: 'a' }))
    pool.add(makeBuff({ sourceId: 'b' }))
    pool.add(makeBuff({ id: 'other', sourceId: 'a' }))

    expect(pool.getAllById('test_buff')).toHaveLength(2)
    expect(pool.getAllById('other')).toHaveLength(1)
  })

  it('two sources applying the same id coexist as separate instances', () => {
    pool.add(makeBuff({ sourceId: 'a', stacks: 1 }))
    pool.add(makeBuff({ sourceId: 'b', stacks: 3 }))

    expect(pool.getFromSource('test_buff', 'a')?.stacks).toBe(1)
    expect(pool.getFromSource('test_buff', 'b')?.stacks).toBe(3)
  })

  it('removeInstance only removes the (id, sourceId) match, not other sources', () => {
    pool.add(makeBuff({ sourceId: 'a' }))
    pool.add(makeBuff({ sourceId: 'b' }))

    pool.removeInstance('test_buff', 'a')

    expect(pool.getFromSource('test_buff', 'a')).toBeUndefined()
    expect(pool.getFromSource('test_buff', 'b')).toBeDefined()
  })

  it('removeAllById removes every source instance of one id', () => {
    pool.add(makeBuff({ sourceId: 'a' }))
    pool.add(makeBuff({ sourceId: 'b' }))
    pool.add(makeBuff({ id: 'other', sourceId: 'a' }))

    pool.removeAllById('test_buff')

    expect(pool.getAllById('test_buff')).toHaveLength(0)
    expect(pool.getAllById('other')).toHaveLength(1)
  })

  it('hasAny is true if any source has the id', () => {
    expect(pool.hasAny('test_buff')).toBe(false)
    pool.add(makeBuff())
    expect(pool.hasAny('test_buff')).toBe(true)
  })

  it('getAll returns every instance across every id and source', () => {
    pool.add(makeBuff({ sourceId: 'a' }))
    pool.add(makeBuff({ id: 'other', sourceId: 'b' }))

    expect(pool.getAll()).toHaveLength(2)
  })

  it('clear empties the pool', () => {
    pool.add(makeBuff())
    pool.clear()
    expect(pool.getAll()).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd game && npx vitest run src/core/buff/BuffPool.test.ts`
Expected: FAIL — `BuffPool` module doesn't exist yet.

- [ ] **Step 3: Write `BuffPool.ts`, delete `BuffManager.ts`**

```ts
import type { Buff } from './Buff'

export class BuffPool {
  private buffs: Buff[] = []

  getAllById(id: string): Buff[] {
    return this.buffs.filter((buff) => buff.id === id)
  }

  getFromSource(id: string, sourceId: string): Buff | undefined {
    return this.buffs.find((buff) => buff.id === id && buff.sourceId === sourceId)
  }

  getAll(): Buff[] {
    return [...this.buffs]
  }

  hasAny(id: string): boolean {
    return this.buffs.some((buff) => buff.id === id)
  }

  add(buff: Buff): void {
    this.buffs.push(buff)
  }

  removeInstance(id: string, sourceId: string): void {
    this.buffs = this.buffs.filter((buff) => !(buff.id === id && buff.sourceId === sourceId))
  }

  removeAllById(id: string): void {
    this.buffs = this.buffs.filter((buff) => buff.id !== id)
  }

  clear(): void {
    this.buffs = []
  }
}
```

Delete `game/src/core/buff/BuffManager.ts`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd game && npx vitest run src/core/buff/BuffPool.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add game/src/core/buff/BuffPool.ts game/src/core/buff/BuffPool.test.ts
git rm game/src/core/buff/BuffManager.ts
git commit -m "feat(buff): add composite-key BuffPool, remove single-key BuffManager"
```

---

### Task 4: `BuffSystem.ts` — apply/update/query methods (absorbs `AilmentSystem`)

**Files:**
- Modify: `game/src/core/buff/BuffSystem.ts` (full rewrite)
- Test: `game/src/core/buff/BuffSystem.test.ts` (extend existing file — keep
  its 3 existing `describe` blocks passing, add new ones below)
- Consumes (read-only reference, do not modify yet): `game/src/core/ailment/AilmentSystem.ts`
  (source of the ported math — `calculateDamagePerSecond`,
  `getPoisonRootMultiplier`, `AILMENT_RESIST_CAP`), `game/src/core/skill/SkillRuntimeStats.ts`
  (`getSkillRuntimeStat`), `game/src/core/combat/Armor.ts`
  (`getArmorMitigationPercent`), `game/src/core/combat/Resistance.ts`
  (`getResistanceMitigationPercent`), `game/src/core/combat/ElementDamageCalculator.ts`
  (`elementalBasePower`)

**Interfaces:**
- Consumes: `BuffPool` (Task 3), `Buff`/`BuffDefinition` (Task 2),
  `BuffEffect`/`BuffEffectTemplate`/`BuffCcEffect` (Task 1).
- Produces: `BuffSystem` class — `apply(definition, source, target, registry?)`,
  `update(deltaSeconds, target, combatSystem, registry?, resolveSource?)`,
  `getActiveModifiers(): StatModifier[]`, `isStunned()`, `isFrozen()`,
  `isRooted()`, `rollOnHitEffects(source, target, registry)`,
  `getStacks(id, sourceId?): number`, `getFromSource(id, sourceId)`,
  `getAllById(id)`, `getActiveIds(): string[]`, `remove(id, sourceId)`,
  `renewWithExtension(id, sourceId, extraSeconds)`.

This is the biggest single task — it ports `AilmentSystem`'s entire
DoT-scaling/CC/conversion-chain logic verbatim, generalized to iterate
`effects[]` and index by `(id, sourceId)`. Read `game/src/core/ailment/AilmentSystem.ts`
in full before starting (already quoted in the spec's investigation, but
re-read the live file — it may have moved since).

- [ ] **Step 1: Write the failing tests (multi-source cases — the NEW behavior; existing single-source cases are already covered by the 3 `describe` blocks already in the file, keep them)**

Add to `game/src/core/buff/BuffSystem.test.ts`:

```ts
describe('BuffSystem — multi-source coexistence (2026-09-01 unified buff system)', () => {
  it('two sources applying the same debuff id each get an independent instance', () => {
    const pool = new BuffPool()
    const system = new BuffSystem(pool)
    const source1 = makeEntity({ id: 'enemy_1' })
    const source2 = makeEntity({ id: 'enemy_2' })
    const target = makeEntity({ id: 'player' })

    const definition: BuffDefinition = {
      id: 'poison_weak', name: 'Poison', polarity: 'debuff',
      duration: 5, stackMode: 'refresh',
      effects: [{ type: 'dot', dpsRatio: 1, element: 'physical' }],
    }

    system.apply(definition, source1, target)
    system.apply(definition, source2, target)

    expect(pool.getAllById('poison_weak')).toHaveLength(2)
    expect(pool.getFromSource('poison_weak', 'enemy_1')).toBeDefined()
    expect(pool.getFromSource('poison_weak', 'enemy_2')).toBeDefined()
  })

  it('the SAME source re-applying stacks/refreshes/replaces per stackMode without affecting other sources', () => {
    const pool = new BuffPool()
    const system = new BuffSystem(pool)
    const source1 = makeEntity({ id: 'enemy_1' })
    const source2 = makeEntity({ id: 'enemy_2' })
    const target = makeEntity({ id: 'player' })

    const definition: BuffDefinition = {
      id: 'poison_weak', name: 'Poison', polarity: 'debuff',
      duration: 5, maxStacks: 3, stackMode: 'stack',
      effects: [{ type: 'dot', dpsRatio: 1, element: 'physical' }],
    }

    system.apply(definition, source1, target)
    system.apply(definition, source2, target)
    system.apply(definition, source1, target) // source1 re-applies

    expect(pool.getFromSource('poison_weak', 'enemy_1')?.stacks).toBe(2)
    expect(pool.getFromSource('poison_weak', 'enemy_2')?.stacks).toBe(1)
  })

  it('update() ticks DoT damage independently per source instance', () => {
    const pool = new BuffPool()
    const system = new BuffSystem(pool)
    const source1 = makeEntity({ id: 'enemy_1', stats: { attack: 10 } as CombatEntity['stats'] })
    const source2 = makeEntity({ id: 'enemy_2', stats: { attack: 20 } as CombatEntity['stats'] })
    const target = makeEntity({ id: 'player' })
    const combatSystem = { applyDotDamage: vi.fn() } as unknown as CombatSystem

    const definition: BuffDefinition = {
      id: 'poison_weak', name: 'Poison', polarity: 'debuff',
      duration: 5, stackMode: 'refresh',
      effects: [{ type: 'dot', dpsRatio: 1, element: 'physical' }],
    }

    system.apply(definition, source1, target)
    system.apply(definition, source2, target)
    system.update(1, target, combatSystem)

    expect(combatSystem.applyDotDamage).toHaveBeenCalledTimes(2)
  })
})

describe('BuffSystem — getStacks under multi-source', () => {
  it('getStacks(id, sourceId) returns that one source instance\'s stacks', () => {
    const pool = new BuffPool()
    const system = new BuffSystem(pool)
    pool.add(makeRuntimeBuff({ id: 'x', sourceId: 'a', stacks: 2 }))
    pool.add(makeRuntimeBuff({ id: 'x', sourceId: 'b', stacks: 5 }))

    expect(system.getStacks('x', 'a')).toBe(2)
    expect(system.getStacks('x', 'b')).toBe(5)
  })

  it('getStacks(id) with no sourceId sums stacks across every source', () => {
    const pool = new BuffPool()
    const system = new BuffSystem(pool)
    pool.add(makeRuntimeBuff({ id: 'x', sourceId: 'a', stacks: 2 }))
    pool.add(makeRuntimeBuff({ id: 'x', sourceId: 'b', stacks: 5 }))

    expect(system.getStacks('x')).toBe(7)
  })
})
```

(`makeEntity`/`makeRuntimeBuff` are test helpers you write alongside these —
`makeRuntimeBuff` builds a full `Buff` runtime object like `Task 3`'s
`makeBuff`; `makeEntity` is likely already present in the file from the
existing 3 `describe` blocks — check before re-adding it.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd game && npx vitest run src/core/buff/BuffSystem.test.ts`
Expected: FAIL — `BuffSystem` still has the old `Buff`-only, single-key API.

- [ ] **Step 3: Rewrite `BuffSystem.ts`**

```ts
import type { Buff } from './Buff'
import type { BuffDefinition } from './BuffDefinition'
import { BuffPool } from './BuffPool'
import type { StatModifier } from '../stats/StatCalculator'
import type { CombatEntity } from '../combat/CombatEntity'
import type { CombatSystem } from '../combat/CombatSystem'
import type { BuffRegistry } from './BuffRegistry'
import { getSkillRuntimeStat } from '../skill/SkillRuntimeStats'
import { getArmorMitigationPercent } from '../combat/Armor'
import { getResistanceMitigationPercent } from '../combat/Resistance'
import { elementalBasePower } from '../combat/ElementDamageCalculator'

const AILMENT_RESIST_CAP = 0.75
const POISON_ROOT_THRESHOLD_STACKS = 3

export class BuffSystem {
  constructor(private readonly pool: BuffPool) {}

  apply(definition: BuffDefinition, source: CombatEntity, target: CombatEntity, registry?: BuffRegistry) {
    const resolvedEffects = definition.effects.map((effect) =>
      effect.type === 'dot'
        ? {
            type: 'dot' as const,
            damagePerSecond: this.calculateDamagePerSecond(effect, source, target),
            element: effect.element,
            poisonRootPercentPerStack: effect.poisonRootPercentPerStack,
            poisonRootMaxStacks: effect.poisonRootMaxStacks,
            poisonRootThresholdBonusPercent: effect.poisonRootThresholdBonusPercent,
          }
        : effect,
    )

    const resistMultiplier = 1 - Math.min(AILMENT_RESIST_CAP, Math.max(0, target.stats.ailmentResistPercent))
    const duration = definition.duration * resistMultiplier * (1 + source.stats.ailmentDurationPercent)

    const existing = this.pool.getFromSource(definition.id, source.id)

    if (!existing) {
      this.pool.add({
        id: definition.id,
        sourceId: source.id,
        targetId: target.id,
        polarity: definition.polarity,
        hidden: definition.hidden,
        duration,
        remainingTime: duration,
        stacks: 1,
        maxStacks: definition.maxStacks,
        stackMode: definition.stackMode,
        continuousSeconds: 0,
        convertsToId: definition.convertsToId,
        convertsAfterContinuousSeconds: definition.convertsAfterContinuousSeconds,
        effects: resolvedEffects,
      })
      return
    }

    this.handleExisting(existing, definition, source, target, duration, resolvedEffects, registry)
  }

  private handleExisting(
    existing: Buff,
    definition: BuffDefinition,
    source: CombatEntity,
    target: CombatEntity,
    duration: number,
    resolvedEffects: Buff['effects'],
    registry?: BuffRegistry,
  ) {
    switch (definition.stackMode) {
      case 'stack': {
        let nextStacks = existing.stacks + 1
        if (existing.maxStacks !== undefined) {
          nextStacks = Math.min(nextStacks, existing.maxStacks)
        }

        if (
          definition.convertsToId &&
          registry &&
          existing.maxStacks !== undefined &&
          nextStacks >= existing.maxStacks
        ) {
          this.pool.removeInstance(existing.id, existing.sourceId)
          this.apply(registry.get(definition.convertsToId), source, target, registry)
          return
        }

        existing.stacks = nextStacks
        existing.remainingTime = duration
        break
      }

      case 'refresh':
        existing.remainingTime = duration
        break

      case 'replace':
        this.pool.removeInstance(existing.id, existing.sourceId)
        this.pool.add({
          ...existing,
          duration,
          remainingTime: duration,
          effects: resolvedEffects,
        })
        break
    }
  }

  private getPoisonRootMultiplier(effect: Extract<Buff['effects'][number], { type: 'dot' }>, continuousSeconds: number): number {
    if (!effect.poisonRootMaxStacks) {
      return 1
    }

    const rootStacks = Math.min(effect.poisonRootMaxStacks, Math.floor(continuousSeconds))
    const thresholdBonus =
      rootStacks >= POISON_ROOT_THRESHOLD_STACKS ? (effect.poisonRootThresholdBonusPercent ?? 0) : 0

    return 1 + (effect.poisonRootPercentPerStack ?? 0) * rootStacks + thresholdBonus
  }

  private calculateDamagePerSecond(
    effect: Extract<import('./BuffTypes').BuffEffectTemplate, { type: 'dot' }>,
    source: CombatEntity,
    target: CombatEntity,
  ): number {
    const ratio = effect.dpsRatio ?? 1

    if (!effect.element || effect.element === 'physical') {
      const power = source.stats.attack
      const mitigation = getArmorMitigationPercent(target.stats.defense)
      return Math.max(0, power * ratio * (1 - mitigation)) * (1 + source.stats.ailmentPotencyPercent)
    }

    const power = elementalBasePower(source, effect.element)
    const resistance = target.stats[`${effect.element}Resistance`]
    const penetration = source.stats[`${effect.element}Penetration`]
    const mitigation = getResistanceMitigationPercent(resistance, penetration)

    const kimTheMultiplier =
      effect.element === 'metal'
        ? 1 +
          source.currentKimThe * getSkillRuntimeStat(source, 'kimTheDotDamagePercentPerStack') +
          getSkillRuntimeStat(source, 'metalAilmentPotencyPercent')
        : 1

    return Math.max(0, power * ratio * (1 - mitigation)) * (1 + source.stats.ailmentPotencyPercent) * kimTheMultiplier
  }

  update(
    deltaSeconds: number,
    target: CombatEntity,
    combatSystem: CombatSystem,
    registry?: BuffRegistry,
    resolveSource?: (sourceId: string) => CombatEntity | undefined,
  ) {
    const expired: Buff[] = []

    for (const buff of this.pool.getAll()) {
      buff.continuousSeconds += deltaSeconds

      if (
        registry &&
        buff.convertsToId &&
        buff.convertsAfterContinuousSeconds !== undefined &&
        buff.continuousSeconds >= buff.convertsAfterContinuousSeconds
      ) {
        this.convert(buff, registry, target, resolveSource?.(buff.sourceId))
        continue
      }

      for (const effect of buff.effects) {
        if (effect.type === 'dot' && target.alive) {
          const rawDamage =
            effect.damagePerSecond * buff.stacks * this.getPoisonRootMultiplier(effect, buff.continuousSeconds) * deltaSeconds

          combatSystem.applyDotDamage({
            sourceId: buff.sourceId,
            source: resolveSource?.(buff.sourceId),
            target,
            rawDamage,
            element: effect.element,
            effectId: buff.id,
          })
        }
      }

      buff.remainingTime -= deltaSeconds
      if (buff.remainingTime <= 0) {
        expired.push(buff)
      }
    }

    for (const buff of expired) {
      this.pool.removeInstance(buff.id, buff.sourceId)
    }
  }

  private convert(buff: Buff, registry: BuffRegistry, target: CombatEntity, source?: CombatEntity) {
    const nextDefinition = registry.get(buff.convertsToId!)

    this.pool.removeInstance(buff.id, buff.sourceId)

    const resistMultiplier = 1 - Math.min(AILMENT_RESIST_CAP, Math.max(0, target.stats.ailmentResistPercent))
    const duration = nextDefinition.duration * resistMultiplier * (1 + (source?.stats.ailmentDurationPercent ?? 0))

    // Dedupe: same-source instance of the destination id gets replaced.
    this.pool.removeInstance(nextDefinition.id, buff.sourceId)

    this.pool.add({
      id: nextDefinition.id,
      sourceId: buff.sourceId,
      targetId: buff.targetId,
      polarity: nextDefinition.polarity,
      duration,
      remainingTime: duration,
      stacks: 1,
      maxStacks: nextDefinition.maxStacks,
      stackMode: nextDefinition.stackMode,
      continuousSeconds: 0,
      convertsToId: nextDefinition.convertsToId,
      convertsAfterContinuousSeconds: nextDefinition.convertsAfterContinuousSeconds,
      effects: nextDefinition.effects.map((effect) =>
        effect.type === 'dot' ? { ...effect, damagePerSecond: 0 } : effect,
      ),
    })
  }

  getActiveModifiers(): StatModifier[] {
    const modifiers: StatModifier[] = []

    for (const buff of this.pool.getAll()) {
      for (const effect of buff.effects) {
        if (effect.type === 'statModifier') {
          modifiers.push({
            id: `buff:${buff.id}:${buff.sourceId}:${effect.stat}`,
            sourceId: buff.sourceId,
            sourceType: buff.polarity,
            stat: effect.stat,
            flat: effect.flat,
            percent: effect.percent,
            stacks: buff.stacks,
          })
        }
      }
    }

    return modifiers
  }

  isStunned(): boolean {
    return this.pool.getAll().some((buff) => buff.effects.some((e) => e.type === 'cc' && e.ccEffect === 'stun'))
  }

  isFrozen(): boolean {
    return this.pool.getAll().some((buff) => buff.effects.some((e) => e.type === 'cc' && e.ccEffect === 'freeze'))
  }

  isRooted(): boolean {
    return this.pool.getAll().some((buff) => buff.effects.some((e) => e.type === 'cc' && e.ccEffect === 'root'))
  }

  rollOnHitEffects(source: CombatEntity, target: CombatEntity, registry: BuffRegistry) {
    for (const buff of this.pool.getAll()) {
      for (const effect of buff.effects) {
        if (effect.type === 'onHitProc' && Math.random() < effect.chance) {
          this.apply(registry.get(effect.appliesBuffId), source, target, registry)
        }
      }
    }
  }

  getStacks(id: string, sourceId?: string): number {
    if (sourceId !== undefined) {
      return this.pool.getFromSource(id, sourceId)?.stacks ?? 0
    }
    return this.pool.getAllById(id).reduce((sum, buff) => sum + buff.stacks, 0)
  }

  getFromSource(id: string, sourceId: string): Buff | undefined {
    return this.pool.getFromSource(id, sourceId)
  }

  getAllById(id: string): Buff[] {
    return this.pool.getAllById(id)
  }

  getActiveIds(): string[] {
    return this.pool.getAll().map((buff) => buff.id)
  }

  remove(id: string, sourceId: string): void {
    this.pool.removeInstance(id, sourceId)
  }

  removeAllById(id: string): void {
    this.pool.removeAllById(id)
  }

  renewWithExtension(id: string, sourceId: string, extraSeconds: number): void {
    const existing = this.pool.getFromSource(id, sourceId)
    if (!existing) {
      return
    }

    this.pool.removeInstance(id, sourceId)
    this.pool.add({ ...existing, remainingTime: existing.remainingTime + extraSeconds })
  }
}
```

Note: `getActiveModifiers()`'s `sourceType: buff.polarity` relies on
`ModifierSourceType` accepting `'buff'|'debuff'` (already true today) — do
NOT add `'ailment'` back; Task 5 removes it from the enum.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd game && npx vitest run src/core/buff/BuffSystem.test.ts`
Expected: PASS — both the 3 pre-existing `describe` blocks (stack/refresh/
replace, expiry) and the new multi-source ones.

- [ ] **Step 5: Type-check**

Run: `cd game && npm run type-check`
Expected: still FAIL (many files elsewhere still reference the deleted
`AilmentSystem`/`AilmentManager`/old `Buff` shape) — confirm the failure
list has SHRUNK compared to Task 2 Step 3 (BuffSystem.ts itself should no
longer appear in it).

- [ ] **Step 6: Commit**

```bash
git add game/src/core/buff/BuffSystem.ts game/src/core/buff/BuffSystem.test.ts
git commit -m "feat(buff): rewrite BuffSystem to absorb AilmentSystem's DoT/CC/conversion logic"
```

---

### Task 5: `StatCalculator.ts` — retire `'ailment'` from `ModifierSourceType`

**Files:**
- Modify: `game/src/core/stats/StatCalculator.ts`
- Test: run existing `StatCalculator.test.ts` (no new test needed — this is
  a type-level narrowing, existing tests catch any runtime break)

**Interfaces:**
- Consumes: nothing new.
- Produces: `ModifierSourceType` without `'ailment'`.

- [ ] **Step 1: Remove `'ailment'` from the `ModifierSourceType` union**

Find and remove the `| 'ailment'` member from `ModifierSourceType` in
`game/src/core/stats/StatCalculator.ts`.

- [ ] **Step 2: Type-check**

Run: `cd game && npm run type-check`
Expected: FAIL at any remaining `sourceType: 'ailment'` literal — this
should only be inside `game/src/core/ailment/AilmentSystem.ts` itself at
this point (Task 4 already moved `BuffSystem.getActiveModifiers()` off it).
Confirm no OTHER file breaks — if one does, note it, it's a real remaining
call site to fix in a later task, not a reason to revert this step.

- [ ] **Step 3: Run the stat test suite**

Run: `cd game && npx vitest run src/core/stats`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add game/src/core/stats/StatCalculator.ts
git commit -m "refactor(stats): retire 'ailment' ModifierSourceType, buffs/debuffs cover it now"
```

---

### Task 6: `BuffRegistry.ts` — hold `BuffDefinition`, not runtime `Buff`

**Files:**
- Modify: `game/src/core/buff/BuffRegistry.ts`
- Test: `game/src/core/buff/BuffRegistry.test.ts` (extend if it exists,
  create if not — check first)

**Interfaces:**
- Consumes: `BuffDefinition` (Task 2).
- Produces: `BuffRegistry` typed over `BuffDefinition` (was `Buff`) —
  `register(definition)`, `get(id): BuffDefinition`, `has(id)`, `getAll()`.

- [ ] **Step 1: Check the existing file's shape**

Read `game/src/core/buff/BuffRegistry.ts` — it's a small `Map`-backed class
(`register`/`get`/`has`/`getAll`, throws on duplicate register / missing
get). Confirm whether it's already generic-typed over `Buff` by name or
hardcoded — the only change needed is the type parameter, not the logic.

- [ ] **Step 2: Change the type parameter from `Buff` to `BuffDefinition`**

Update every `Buff` reference in this file to `BuffDefinition`, update the
import accordingly.

- [ ] **Step 3: Run/extend the registry test**

If `game/src/core/buff/BuffRegistry.test.ts` exists, update its fixtures to
construct `BuffDefinition` objects (`polarity`/`effects` instead of
`category`/`modifiers`) and confirm it passes. If it doesn't exist, write:

```ts
import { describe, it, expect } from 'vitest'
import { BuffRegistry } from './BuffRegistry'
import type { BuffDefinition } from './BuffDefinition'

describe('BuffRegistry', () => {
  it('registers and retrieves a BuffDefinition by id', () => {
    const registry = new BuffRegistry()
    const definition: BuffDefinition = {
      id: 'x', name: 'X', polarity: 'buff', duration: 5, stackMode: 'refresh', effects: [],
    }

    registry.register(definition)

    expect(registry.get('x')).toBe(definition)
    expect(registry.has('x')).toBe(true)
  })

  it('throws on duplicate register', () => {
    const registry = new BuffRegistry()
    const definition: BuffDefinition = {
      id: 'x', name: 'X', polarity: 'buff', duration: 5, stackMode: 'refresh', effects: [],
    }

    registry.register(definition)
    expect(() => registry.register(definition)).toThrow()
  })

  it('throws on get of a missing id', () => {
    const registry = new BuffRegistry()
    expect(() => registry.get('missing')).toThrow()
  })
})
```

Run: `cd game && npx vitest run src/core/buff/BuffRegistry.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add game/src/core/buff/BuffRegistry.ts game/src/core/buff/BuffRegistry.test.ts
git commit -m "refactor(buff): BuffRegistry holds BuffDefinition templates, not runtime Buff"
```

---

### Task 7: Port all 13 buff + 18 ailment definitions into `BuffDefinition` data

**Files:**
- Modify: `game/src/data/buff/buffs.ts` (13 existing entries reshape to
  `BuffDefinition`; 18 ported entries added)
- Read (source of the port, do not modify): `game/src/data/ailment/ailments.ts`
- Test: `game/src/data/buff/buffs.test.ts` (create if it doesn't exist —
  check first) — one assertion per ported definition confirming its
  `effects[]` matches the original field-for-field.

This is a data-only task — no new logic, every definition's numbers must
match its origin exactly. Read the CURRENT content of both source files
before starting (they may have gained entries since this plan was written —
do not work from memory of the 13/18 counts, re-count from the live files).

- [ ] **Step 1: Read both data files in full**

Read `game/src/data/buff/buffs.ts` and `game/src/data/ailment/ailments.ts`
completely. Build a mapping table (old field → new field) per entry as you
go — this becomes your working notes for Step 2, not a plan artifact.

- [ ] **Step 2: Reshape the 13 existing buff entries**

Each entry's `category: 'buff'|'debuff'` → `polarity`; `modifiers:
StatModifier[]` → `effects: [{type:'statModifier', stat, percent, flat}]`
(drop `id`/`sourceId`/`sourceType`/`stacks` from each modifier — those are
now runtime-only, computed by `BuffSystem.getActiveModifiers()`, not
authored on the definition).

- [ ] **Step 3: Port the 18 ailment entries as new `BuffDefinition` entries**

For each `AilmentTemplate`, port field-for-field:
- `category: 'dot'` → `polarity: 'debuff'`, `effects: [{type:'dot', dpsRatio: <old dpsRatio>, element, poisonRootPercentPerStack, poisonRootMaxStacks, poisonRootThresholdBonusPercent}]`
- `category: 'cc'` → `polarity: 'debuff'`, `effects: [{type:'cc', ccEffect}]`
- `category: 'modifier'` → `polarity: 'debuff'`, `effects: [{type:'statModifier', ...} for each statModifiers entry]`
- `onHitChance`/`onHitAppliesAilmentId` (Thạch Hóa) → an ADDITIONAL entry in
  `effects[]`: `{type:'onHitProc', chance: onHitChance, appliesBuffId: onHitAppliesAilmentId}`
  alongside whatever other effect(s) that same ailment already has (Thạch
  Hóa's own definition has `statModifiers` for its evasionRate debuff AND
  the onHitProc that applies Choáng — both become entries in the SAME
  definition's `effects[]`, not two definitions).
- `duration`/`maxStacks`/`stackMode`/`convertsToOnMaxStacks`(→`convertsToId`)/
  `convertsAfterContinuousSeconds` port straight across (renaming
  `convertsToOnMaxStacks` if that was its old field name — confirm exact
  name against the live file, do not assume).

- [ ] **Step 4: Write the parity test**

For at least these 4 representative ported entries (one per old
`AilmentCategory`, plus the on-hit-proc special case), assert the new
`BuffDefinition`'s `effects[]` matches the source `AilmentTemplate`'s
values exactly:

```ts
import { describe, it, expect } from 'vitest'
import { BUFFS } from './buffs'

describe('buffs.ts — ported ailment definitions match original AilmentTemplate values', () => {
  it('bong (dot) — dpsRatio and element port unchanged', () => {
    const bong = BUFFS.find((b) => b.id === 'bong')!
    const dot = bong.effects.find((e) => e.type === 'dot')

    expect(dot).toMatchObject({ type: 'dot', /* exact dpsRatio/element from ailments.ts */ })
  })

  it('choang (cc) — ccEffect ports unchanged', () => {
    const choang = BUFFS.find((b) => b.id === 'choang')!
    expect(choang.effects).toContainEqual({ type: 'cc', ccEffect: 'stun' })
  })

  it('lam_cham (modifier) — statModifier effects port unchanged', () => {
    const lamCham = BUFFS.find((b) => b.id === 'lam_cham')!
    const modifier = lamCham.effects.find((e) => e.type === 'statModifier')

    expect(modifier).toBeDefined()
  })

  it('thach_hoa — carries BOTH its statModifier AND onHitProc effect in one definition', () => {
    const thachHoa = BUFFS.find((b) => b.id === 'thach_hoa')!

    expect(thachHoa.effects.some((e) => e.type === 'statModifier')).toBe(true)
    expect(thachHoa.effects.some((e) => e.type === 'onHitProc')).toBe(true)
  })
})
```

(Fill in the exact `dpsRatio`/`element`/percent/flat values from what you
read in Step 1 — do not guess them; this plan does not have the live
numbers memorized.)

- [ ] **Step 5: Run the test**

Run: `cd game && npx vitest run src/data/buff/buffs.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add game/src/data/buff/buffs.ts game/src/data/buff/buffs.test.ts
git commit -m "feat(buff): port all 18 ailment definitions into unified BuffDefinition data"
```

(`game/src/data/ailment/ailments.ts` is NOT deleted yet — Task 16 deletes
it once every consumer has moved off `AilmentRegistry`.)

---

### Task 8: `Battle.ts` — delete `playerAilments`/`BattleEnemy.ailments`

**Files:**
- Modify: `game/src/core/battle/Battle.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `Battle`/`BattleEnemy` without the `*Ailments`/`ailments`
  fields — `BattleSystem.ts` (Task 9) is the only real consumer, breaks
  until that task lands; expected.

- [ ] **Step 1: Remove the fields**

In `BattleEnemy` (`Battle.ts:20-56`), delete `ailments: AilmentManager` and
its import. In `Battle` (`Battle.ts:58-162`), delete `playerAilments:
AilmentManager` and its doc comment (`Battle.ts:107-109`).

- [ ] **Step 2: Type-check**

Run: `cd game && npm run type-check`
Expected: FAIL — `BattleSystem.ts`'s `createBattleEnemy()` and `start()`
factory sites still construct `ailments: new AilmentManager()`/
`playerAilments: new AilmentManager()`. Confirm the failure is ONLY in
`BattleSystem.ts` (Task 9 fixes it) — if it appears elsewhere, note the
extra file for Task 9's scope.

- [ ] **Step 3: Commit**

```bash
git add game/src/core/battle/Battle.ts
git commit -m "refactor(battle): remove playerAilments/BattleEnemy.ailments — one buffs pool per entity now"
```

---

### Task 9: `BattleSystem.ts` — merge tick loop, query methods, all 4 `SkillEffectContext` sites

**Files:**
- Modify: `game/src/core/battle/BattleSystem.ts`

**Interfaces:**
- Consumes: `BuffSystem`/`BuffPool` (Tasks 3-4), `Battle`/`BattleEnemy`
  without ailment fields (Task 8).
- Produces: `getBuffsFor()` is the only pool accessor (`getAilmentsFor()`
  deleted); `SkillEffectContext` construction sites no longer set
  `targetAilments`/`ailmentRegistry`.

This task has many small, mechanical edits across one large file. Do them
in this order, running type-check after each group to catch the next
error, rather than trying to fix everything blind.

- [ ] **Step 1: `getAilmentsFor()` deleted, factory sites fixed**

Delete `getAilmentsFor()` (`BattleSystem.ts:1251-1271`'s second half). In
`createBattleEnemy()` (`~774-786`), delete `ailments: new AilmentManager()`.
In `start()`'s battle object literal (`~402-450`), delete `playerAilments:
new AilmentManager()`. Remove the now-unused `AilmentManager` import if
nothing else in the file uses it (check after Step 6).

- [ ] **Step 2: `updateAilments()` merges into the buff tick**

Delete `updateAilments()` entirely (`BattleSystem.ts:1502-1538`). At its
call site (`~894`), replace with a call that ticks EVERY entity's ONE buff
pool (this was already happening for stat-only buffs somewhere — find that
existing buff-tick call site, likely adjacent, and confirm whether it
already loops player+enemies; if so, this task's job is just deleting the
now-redundant `updateAilments()` call, since `BuffSystem.update()` already
does DoT+CC+expire in one pass per Task 4). Confirm via the type-checker
and by running `BattleSystem.test.ts` that DoT ticking still happens
exactly once per entity per frame (not zero times, not twice).

- [ ] **Step 3: `isIncapacitated`/`isFrozen`/`isRooted` call sites**

`BattleSystem.ts:1124-1128`'s `isIncapacitated(ailments)` — rename its
parameter type from `AilmentManager` to `BuffPool`, change `new
AilmentSystem(ailments)` to `new BuffSystem(ailments)`. Its caller passes
`getAilmentsFor(...)` today — change to `getBuffsFor(...)`.
`BattleSystem.ts:1156,1164`'s `new AilmentSystem(battleEnemy.ailments)` →
`new BuffSystem(battleEnemy.buffs)`.

- [ ] **Step 4: `rollOnHitEffects()` call site**

`BattleSystem.ts:1318-1324` — change `new
AilmentSystem(this.getAilmentsFor(battle, target))` to `new
BuffSystem(this.getBuffsFor(battle, target))`, change
`this.ailmentRegistry` to `this.buffRegistry` in the call's 3rd argument.

- [ ] **Step 5: Break-gauge stun apply, on-hit-proc kinds**

`BattleSystem.ts:1410-1420` — `const targetAilments = new
AilmentSystem(this.getAilmentsFor(battle, target)); targetAilments.apply(
this.ailmentRegistry.get('choang'), source, target, this.ailmentRegistry)`
becomes `const targetBuffs = new BuffSystem(this.getBuffsFor(battle,
target)); targetBuffs.apply(this.buffRegistry.get('choang'), source,
target, this.buffRegistry)`. Same rename pattern at `~2618-2643`'s
`xuat_huyet_dot`/`tran_tru_cc` cases (`this.ailmentRegistry.get(...)` →
`this.buffRegistry.get(...)`, `new AilmentSystem(...)` → `new
BuffSystem(...)`).

- [ ] **Step 6: All 4 `SkillEffectContext` construction sites**

At `~1338-1364` (reactive-trigger), `~2780-2838` (`applyEffects` closure),
`~2865-2899` (triggers `onCast` loop), `~3066-3080` (onTick channel) —
delete the `ailmentRegistry: this.ailmentRegistry,` and `targetAilments:
new AilmentSystem(this.getAilmentsFor(battle, ...)),` lines from each
object literal (Task 10's `SkillEffectContext` interface change removes
these fields, so leaving them in is a type error, not just dead code —
delete, don't just ignore). Also delete the now-unused local `const
targetAilments = new AilmentSystem(...)` declarations at `~2784` and
`~2869` (their only use was populating the deleted context field).

- [ ] **Step 7: Type-check**

Run: `cd game && npm run type-check`
Expected: FAIL only in files this task doesn't touch (`SkillEffectSystem.ts`,
`SkillAction.ts`, `SkillActionRegistry.ts`, `ReactionManager.ts`,
`CombatSystem.ts` — Tasks 10-13 fix these) — `BattleSystem.ts` itself
should show ZERO errors once Steps 1-6 are done. If `BattleSystem.ts`
itself still errors, you missed a call site — search the file for
`Ailment`/`ailment` (case-insensitive) and confirm zero remaining matches
before moving on.

- [ ] **Step 8: Commit**

```bash
git add game/src/core/battle/BattleSystem.ts
git commit -m "refactor(battle): BattleSystem uses one BuffSystem pool per entity, drop AilmentSystem"
```

(Do not run the full test suite yet — many test files still reference the
old API and will fail until Task 17's sweep. Type-check passing for THIS
file is the task's actual gate.)

---

### Task 10: `SkillAction.ts` + `SkillActionRegistry.ts` — fold `applyAilment` into `applyDebuff`, add `scope`

**Files:**
- Modify: `game/src/core/skill/SkillAction.ts`
- Modify: `game/src/core/skill/SkillActionRegistry.ts`
- Test: `game/src/core/skill/SkillActionRegistry.test.ts`

**Interfaces:**
- Consumes: `BuffSystem`/`BuffRegistry` (Tasks 4/6).
- Produces: `ApplyDebuffAction` gains `chance?: number`;
  `ApplyAilmentAction`/`'applyAilment'` deleted; `ConsumeForDamageAction`
  gains `scope?: 'own' | 'any'` (default `'own'`), its `ailmentId?:
  AilmentId` field renamed `buffId?: string`.

- [ ] **Step 1: Update `SkillAction.ts`**

```ts
export interface ApplyBuffAction {
  type: 'applyBuff'
  buffId: string
  chance?: number
}

export interface ApplyDebuffAction {
  type: 'applyDebuff'
  buffId: string
  chance?: number
}

export interface ConsumeForDamageAction {
  type: 'consumeForDamage'
  source: 'ailment' | 'ward'
  buffId?: string
  damagePerUnit: number
  healPercentOfDamage?: number
  // 'own' (default) — only the executing skill's own source instance.
  // 'any' — every source's instance, summed, all removed.
  scope?: 'own' | 'any'
}
```

Delete `ApplyAilmentAction` entirely. Remove it from the `SkillAction`
union in this file. (`chance?` on `ApplyBuffAction` is new too — today's
`applyBuff` never rolled a chance; adding the field as optional is
backward-safe, every existing `applyBuff` usage with no `chance` keeps
always-applying via the `?? 1` default in Step 2.)

- [ ] **Step 2: Write the failing tests**

Add to `game/src/core/skill/SkillActionRegistry.test.ts`:

```ts
describe('applyDebuff executor — chance roll + fireNested onProc (absorbs old applyAilment)', () => {
  it('applies and fires onProc on a successful roll', () => {
    const source = makeEntity({ stats: { elementApplicationPercent: 0 } as CombatEntity['stats'] })
    const target = makeEntity()
    const apply = vi.fn()
    const get = vi.fn(() => ({ id: 'bong' }))
    const fireNested = vi.fn()
    const ctx = makeCtx({
      targetBuffs: { apply } as unknown as SkillEffectContext['targetBuffs'],
      buffRegistry: { get } as unknown as SkillEffectContext['buffRegistry'],
    })
    vi.spyOn(Math, 'random').mockReturnValue(0)

    runSkillAction({ type: 'applyDebuff', buffId: 'bong', chance: 1 }, source, target, ctx, {}, { fireNested })

    expect(apply).toHaveBeenCalledWith({ id: 'bong' }, source, target, ctx.buffRegistry)
    expect(fireNested).toHaveBeenCalledWith('onProc', { source, target, buffId: 'bong' })

    vi.restoreAllMocks()
  })

  it('no chance specified — always applies (matches old plain applyDebuff/applyBuff behavior)', () => {
    const source = makeEntity({ stats: { elementApplicationPercent: 0 } as CombatEntity['stats'] })
    const target = makeEntity()
    const apply = vi.fn()
    const ctx = makeCtx({ targetBuffs: { apply } as unknown as SkillEffectContext['targetBuffs'] })

    runSkillAction({ type: 'applyDebuff', buffId: 'x' }, source, target, ctx, {}, makeHelpers())

    expect(apply).toHaveBeenCalled()
  })

  it('roll fails — does not apply, does not fire onProc', () => {
    const source = makeEntity({ stats: { elementApplicationPercent: 0 } as CombatEntity['stats'] })
    const target = makeEntity()
    const apply = vi.fn()
    const fireNested = vi.fn()
    const ctx = makeCtx({ targetBuffs: { apply } as unknown as SkillEffectContext['targetBuffs'] })
    vi.spyOn(Math, 'random').mockReturnValue(0.99)

    runSkillAction({ type: 'applyDebuff', buffId: 'x', chance: 0.5 }, source, target, ctx, {}, { fireNested })

    expect(apply).not.toHaveBeenCalled()
    expect(fireNested).not.toHaveBeenCalled()

    vi.restoreAllMocks()
  })
})

describe('consumeForDamage executor — scope', () => {
  it("scope 'own' (default) reads/removes only the executing source's instance", () => {
    const source = makeEntity({ id: 'caster' })
    const target = makeEntity({ alive: true } as Partial<CombatEntity> as CombatEntity)
    const getStacks = vi.fn(() => 4)
    const remove = vi.fn()
    const applyDirectDamage = vi.fn()
    const killIfDead = vi.fn()
    const ctx = makeCtx({
      targetBuffs: { getStacks, remove } as unknown as SkillEffectContext['targetBuffs'],
      combatSystem: { applyDirectDamage, killIfDead } as unknown as SkillEffectContext['combatSystem'],
    })

    runSkillAction(
      { type: 'consumeForDamage', source: 'ailment', buffId: 'bong', damagePerUnit: 10 },
      source, target, ctx, {}, makeHelpers(),
    )

    expect(getStacks).toHaveBeenCalledWith('bong', 'caster')
    expect(remove).toHaveBeenCalledWith('bong', 'caster')
    expect(applyDirectDamage).toHaveBeenCalledWith(target, 40, 'caster', 'damage')
  })

  it("scope 'any' sums/removes every source's instance", () => {
    const source = makeEntity({ id: 'caster' })
    const target = makeEntity({ alive: true } as Partial<CombatEntity> as CombatEntity)
    const getStacks = vi.fn(() => 7)
    const removeAllById = vi.fn()
    const applyDirectDamage = vi.fn()
    const killIfDead = vi.fn()
    const ctx = makeCtx({
      targetBuffs: { getStacks, removeAllById } as unknown as SkillEffectContext['targetBuffs'],
      combatSystem: { applyDirectDamage, killIfDead } as unknown as SkillEffectContext['combatSystem'],
    })

    runSkillAction(
      { type: 'consumeForDamage', source: 'ailment', buffId: 'bong', damagePerUnit: 10, scope: 'any' },
      source, target, ctx, {}, makeHelpers(),
    )

    expect(getStacks).toHaveBeenCalledWith('bong')
    expect(removeAllById).toHaveBeenCalledWith('bong')
    expect(applyDirectDamage).toHaveBeenCalledWith(target, 70, 'caster', 'damage')
  })
})
```

(Delete the OLD `applyAilment executor` `describe` block from this test
file — its behavior is now covered by `applyDebuff`'s tests above.)

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd game && npx vitest run src/core/skill/SkillActionRegistry.test.ts`
Expected: FAIL.

- [ ] **Step 4: Rewrite the executors in `SkillActionRegistry.ts`**

```ts
const applyBuff: ActionExecutor<Extract<SkillAction, { type: 'applyBuff' }>> = (
  action, source, target, ctx, _runtime, helpers,
) => {
  const chance = Math.min(1, action.chance ?? 1)
  if (Math.random() >= chance) return

  ctx.sourceBuffs.apply(ctx.buffRegistry.get(action.buffId), source, source, ctx.buffRegistry)
  if (action.chance !== undefined) {
    helpers.fireNested('onProc', { source, target, buffId: action.buffId })
  }
}

const applyDebuff: ActionExecutor<Extract<SkillAction, { type: 'applyDebuff' }>> = (
  action, source, target, ctx, _runtime, helpers,
) => {
  const chance = Math.min(1, (action.chance ?? 1) + source.stats.elementApplicationPercent)
  if (Math.random() >= chance) return

  ctx.targetBuffs.apply(ctx.buffRegistry.get(action.buffId), source, target, ctx.buffRegistry)
  helpers.fireNested('onProc', { source, target, buffId: action.buffId })

  ctx.reactionManager.checkAndTrigger(
    ctx.targetBuffs, action.buffId, source, target, ctx.combatSystem,
    ctx.buffRegistry, ctx.sourceBuffs, ctx.spawnLavaZone,
    ctx.reactionKeepChance ?? 0,
  )
}
```

Delete the `applyAilment` executor entirely.

```ts
const consumeForDamage: ActionExecutor<Extract<SkillAction, { type: 'consumeForDamage' }>> = (
  action, source, target, ctx, runtime,
) => {
  if (!target.alive) return
  let bonusDamage = 0

  if (action.source === 'ailment' && action.buffId) {
    const scope = action.scope ?? 'own'
    const stacks = scope === 'own' ? ctx.targetBuffs.getStacks(action.buffId, source.id) : ctx.targetBuffs.getStacks(action.buffId)
    if (stacks <= 0) return

    bonusDamage = stacks * action.damagePerUnit
    ctx.combatSystem.applyDirectDamage(target, bonusDamage, source.id, 'damage')

    if (scope === 'own') {
      ctx.targetBuffs.remove(action.buffId, source.id)
    } else {
      ctx.targetBuffs.removeAllById(action.buffId)
    }

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
```

Update `SKILL_ACTION_REGISTRY`:

```ts
export const SKILL_ACTION_REGISTRY: { [K in SkillActionType]: ActionExecutor<Extract<SkillAction, { type: K }>> } = {
  dealDamage, heal, applyBuff, applyDebuff,
  grantResource, consumeResource, consumeForDamage, spawnZone, spawnVfx,
}
```

(`applyAilment` key removed — the mapped type now has one fewer member
since `ApplyAilmentAction` is gone from the union, so this stays
exhaustive.)

Note: `BuffSystem.apply()`'s signature is `apply(definition, source,
target, registry?)` (Task 4) — `applyBuff`/`applyDebuff` above must pass
all 4 arguments (`ctx.buffRegistry` twice: once to `.get()`, once as the
4th `apply()` argument for conversion-chain support), unlike the OLD
`ctx.sourceBuffs.apply(ctx.buffRegistry.get(action.buffId))` single-argument
call — this is a real signature change, not a copy-paste artifact.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd game && npx vitest run src/core/skill/SkillActionRegistry.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add game/src/core/skill/SkillAction.ts game/src/core/skill/SkillActionRegistry.ts game/src/core/skill/SkillActionRegistry.test.ts
git commit -m "refactor(skill): fold applyAilment into applyDebuff, add consumeForDamage scope"
```

---

### Task 11: `SkillEffectSystem.ts` — `SkillEffectContext` interface, fold `case 'ailment'` into `case 'debuff'`

**Files:**
- Modify: `game/src/core/skill/SkillEffectSystem.ts`
- Test: `game/src/core/skill/SkillEffectSystem.test.ts`

**Interfaces:**
- Consumes: `BuffSystem`/`BuffRegistry` (Tasks 4/6).
- Produces: `SkillEffectContext` without `targetAilments`/`ailmentRegistry`
  fields; `apply()`'s `case 'ailment'` deleted, `case 'debuff'` absorbs its
  chance-roll + resource-proc + reaction-check logic.

- [ ] **Step 1: Update the `SkillEffectContext` interface**

Delete the `ailmentRegistry: AilmentRegistry` and `targetAilments:
AilmentSystem` fields. Remove the now-unused `AilmentRegistry`/
`AilmentSystem` imports if nothing else in the file needs them.

- [ ] **Step 2: Write the failing test**

Add/update in `game/src/core/skill/SkillEffectSystem.test.ts` (find the
existing `case 'ailment'` test block and REPLACE it, don't duplicate):

```ts
describe("apply() — case 'debuff' (absorbs old case 'ailment': chance roll, Kim Thế/Huyết Phá procs, reaction check)", () => {
  it('rolls chance + elementApplicationPercent, applies via targetBuffs, fires reaction check', () => {
    const source = makeEntity({ stats: { elementApplicationPercent: 0.1 } as CombatEntity['stats'] })
    const target = makeEntity()
    const apply = vi.fn()
    const checkAndTrigger = vi.fn()
    const ctx = makeCtx({
      targetBuffs: { apply } as unknown as SkillEffectContext['targetBuffs'],
      reactionManager: { checkAndTrigger } as unknown as SkillEffectContext['reactionManager'],
    })
    vi.spyOn(Math, 'random').mockReturnValue(0)

    system.apply([{ type: 'debuff', buffId: 'bong', ailmentChance: 0.8 }], source, target, ctx)

    expect(apply).toHaveBeenCalled()
    expect(checkAndTrigger).toHaveBeenCalled()

    vi.restoreAllMocks()
  })

  it('grantsKimThePerProc still grants Kim Thế on a successful debuff proc', () => {
    const source = makeEntity({ currentKimThe: 0 })
    const target = makeEntity()
    const ctx = makeCtx()
    vi.spyOn(Math, 'random').mockReturnValue(0)

    system.apply(
      [{ type: 'debuff', buffId: 'bong', ailmentChance: 1, grantsKimThePerProc: true }],
      source, target, ctx,
    )

    expect(source.currentKimThe).toBeGreaterThan(0)

    vi.restoreAllMocks()
  })
})
```

(Keep whatever the existing `case 'buff'`/simple `case 'debuff'` tests
already cover — this task ADDS the ported ailment-proc behavior onto
`case 'debuff'`, it doesn't remove the plain-apply behavior.)

- [ ] **Step 3: Run test to verify it fails**

Run: `cd game && npx vitest run src/core/skill/SkillEffectSystem.test.ts`
Expected: FAIL — `case 'ailment'` still exists separately, `case 'debuff'`
doesn't yet do chance-rolling/resource-procs.

- [ ] **Step 4: Rewrite the `case 'buff'`/`case 'debuff'`/`case 'ailment'` branches**

Delete `case 'ailment'` entirely. Rewrite `case 'debuff'` to absorb its
body (same logic Task 10 already ported into `SkillActionRegistry.ts`'s
`applyDebuff` — this is the SAME logic, now also needed here since
`SkillEffectSystem.ts` is the OTHER path skills use, per the spec's
"Call site impact" note that this file is the highest-traffic single file
in the merge):

```ts
case 'buff':
  if (effect.buffId) {
    ctx.sourceBuffs.apply(ctx.buffRegistry.get(effect.buffId), source, source, ctx.buffRegistry)
  }
  break

case 'debuff': {
  if (!effect.buffId) break

  const chance = Math.min(1, (effect.ailmentChance ?? 1) + source.stats.elementApplicationPercent)
  if (Math.random() >= chance) break

  ctx.targetBuffs.apply(ctx.buffRegistry.get(effect.buffId), source, target, ctx.buffRegistry)

  const kimTheGain = getSkillRuntimeStat(source, 'kimTheGainPerProc')
  if (effect.grantsKimThePerProc && kimTheGain > 0) {
    source.currentKimThe = Math.min(
      MAX_KIM_THE + getSkillRuntimeStat(source, 'kimTheMaxStacksBonus'),
      source.currentKimThe + kimTheGain,
    )
    source.timeSinceLastBleedProc = 0
  }

  const huyetPhaGain = getSkillRuntimeStat(source, 'huyetPhaGainPerProc')
  if (effect.grantsHuyetPhaPerProc && huyetPhaGain > 0) {
    const nextCharge = (source.currentHuyetPha ?? 0) + huyetPhaGain

    if (nextCharge >= MAX_HUYET_PHA) {
      source.currentHuyetPha = 0
      const burstDamage = getSkillRuntimeStat(source, 'huyetPhaBurstDamage')
      if (burstDamage > 0) {
        ctx.combatSystem.applyDotDamage({
          sourceId: source.id, source, target, rawDamage: burstDamage,
          element: 'metal', effectId: 'huyet_pha_burst',
        })
      }
    } else {
      source.currentHuyetPha = nextCharge
    }
  }

  ctx.reactionManager.checkAndTrigger(
    ctx.targetBuffs, effect.buffId, source, target, ctx.combatSystem,
    ctx.buffRegistry, ctx.sourceBuffs, ctx.spawnLavaZone,
    ctx.reactionKeepChance ?? 0,
  )
  break
}
```

`SkillEffect.ts`'s `buffId`/`ailmentId`/`ailmentChance` fields: check
whether `SkillEffect` (the OLD `effects:` shape, still primary for 5 of 6
combat paths) has SEPARATE `buffId` (for `case 'buff'`/`'debuff'`) and
`ailmentId` (for the old `case 'ailment'`) fields — if so, rename
`ailmentId`→reuse `buffId` on the `'debuff'` case type so a `SkillEffect`
authored for the old `case 'ailment'` now needs `type: 'debuff', buffId:
<old ailmentId>, ailmentChance: <old ailmentChance>` instead of `type:
'ailment', ailmentId, ailmentChance`. This means every SKILL DATA FILE
using `type: 'ailment'` also needs updating — grep `game/src/data/skill/`
for `type: 'ailment'` and fix each occurrence as part of this task (this is
real content, not test fixtures — do not skip it or the game breaks for
every skill using an ailment).

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd game && npx vitest run src/core/skill/SkillEffectSystem.test.ts`
Expected: PASS.

- [ ] **Step 6: Type-check**

Run: `cd game && npm run type-check`
Expected: FAIL only in `ReactionManager.ts`/`CombatSystem.ts` (Tasks 12-13)
and test files (Task 17) — confirm `SkillEffectSystem.ts` and every skill
data file under `game/src/data/skill/` show zero errors.

- [ ] **Step 7: Commit**

```bash
git add game/src/core/skill/SkillEffectSystem.ts game/src/core/skill/SkillEffectSystem.test.ts game/src/data/skill/
git commit -m "refactor(skill): fold SkillEffectSystem's case 'ailment' into case 'debuff'"
```

---

### Task 12: `ReactionManager.ts` — `targetAilments` → `targetBuffs`

**Files:**
- Modify: `game/src/core/element/ReactionManager.ts`
- Test: `game/src/core/element/ReactionManager.test.ts`,
  `game/src/core/element/ReactionManager.powerScaling.test.ts`,
  `game/src/core/element/ReactionManager.phanPhac.test.ts`

**Interfaces:**
- Consumes: `BuffSystem` (Task 4).
- Produces: `checkAndTrigger()`'s 1st parameter renamed `targetBuffs:
  BuffSystem`; every internal `AilmentId`→`string`,
  `ailmentRegistry`→`buffRegistry`.

- [ ] **Step 1: Rewrite `checkAndTrigger()`**

```ts
checkAndTrigger(
  targetBuffs: BuffSystem,
  newBuffId: string,
  source: CombatEntity,
  target: CombatEntity,
  combatSystem: CombatSystem,
  buffRegistry?: BuffRegistry,
  sourceBuffs?: BuffSystem,
  spawnLavaZone?: (spec: {
    ownerId: string; row: number; column: number; laneRadius: number; columnRadius: number
    duration: number; tickInterval: number; damagePerTick: number; element: ElementType | 'physical'
  }) => void,
  reactionKeepChance = 0,
) {
  for (const existingId of targetBuffs.getActiveIds()) {
    if (existingId === newBuffId) continue

    const reaction = ELEMENT_REACTIONS[newBuffId]?.[existingId] ?? ELEMENT_REACTIONS[existingId]?.[newBuffId]
    if (!reaction) continue

    const newBuffInstance = targetBuffs.getFromSource(newBuffId, source.id)
    const dotEffect = newBuffInstance?.effects.find((e): e is Extract<typeof e, { type: 'dot' }> => e.type === 'dot')
    const powerElement = dotEffect?.element

    const sourcePower =
      reaction.powerScalingRatio && powerElement && powerElement !== 'physical'
        ? elementalBasePower(source, powerElement) * reaction.powerScalingRatio
        : 0

    const flatAndPercentDamage =
      reaction.baseDamage + sourcePower +
      (reaction.percentOfTargetCurrentHp ? target.currentHp * reaction.percentOfTargetCurrentHp : 0)

    const reactionDamage = flatAndPercentDamage * (1 + source.stats.reactionEffectPercent)
    combatSystem.applyModifiedDirectDamage(target, reactionDamage, source, 'reaction')

    if (reaction.maxHpReductionPercent) {
      const alreadyReduced = target.totalMaxHpReductionPercent ?? 0
      const appliedPercent = Math.min(reaction.maxHpReductionPercent, MAX_HP_REDUCTION_CAP_PERCENT - alreadyReduced)
      if (appliedPercent > 0) {
        target.maxHp = Math.max(1, target.maxHp * (1 - appliedPercent))
        combatSystem.vitals.clampToMaxHp(target, 'reaction', source.id)
        target.totalMaxHpReductionPercent = alreadyReduced + appliedPercent
      }
    }

    // Existing-instance sourceId for removal — the reaction removes the
    // instance THIS source placed, not every source's copy of that id
    // (matches "own" consume-scope default reasoning: a reaction you
    // trigger consumes the pieces YOU own on this target).
    const existingSourceId = source.id

    if (reaction.appliesBuffId && sourceBuffs && buffRegistry) {
      targetBuffs.remove(existingId, existingSourceId)
      targetBuffs.remove(newBuffId, source.id)
      sourceBuffs.apply(buffRegistry.get(reaction.appliesBuffId), source, source, buffRegistry)
    } else if (reaction.appliesAilmentId && buffRegistry) {
      targetBuffs.remove(existingId, existingSourceId)
      targetBuffs.remove(newBuffId, source.id)
      const definition = buffRegistry.get(reaction.appliesAilmentId)
      targetBuffs.apply(definition, source, target, buffRegistry)
      if (source.stats.reactionEffectPercent > 0) {
        targetBuffs.renewWithExtension(reaction.appliesAilmentId, source.id, definition.duration * source.stats.reactionEffectPercent)
      }
      if (reaction.spawnsLavaZone && spawnLavaZone) {
        spawnLavaZone({ ownerId: source.id, row: target.row, column: Math.round(target.x), ...reaction.spawnsLavaZone })
      }
    } else {
      const keptBuffId =
        reaction.keepsAilmentId === existingId ? existingId : reaction.keepsAilmentId === newBuffId ? newBuffId : undefined
      const extensionSeconds = getSkillRuntimeStat(source, 'waterReactionExtensionSeconds')
      if (keptBuffId && extensionSeconds > 0) {
        const otherBuffId = keptBuffId === existingId ? newBuffId : existingId
        targetBuffs.remove(otherBuffId, source.id)
        targetBuffs.renewWithExtension(keptBuffId, source.id, extensionSeconds)
      } else if (reactionKeepChance > 0 && Math.random() < reactionKeepChance) {
        // roll trúng: giữ nguyên cả 2, không remove
      } else {
        targetBuffs.remove(existingId, existingSourceId)
        targetBuffs.remove(newBuffId, source.id)
      }
    }

    this.eventBus.emit('reaction', {
      type: 'reaction', sourceId: source.id, targetId: target.id, name: reaction.name, damage: reactionDamage,
    })

    combatSystem.killIfDead(target, source.id)
    return
  }
}
```

**Important caveat to verify, not assume:** the old code's `existingId`
removal (`targetAilments.remove(existingId)`) had NO source concept — it
removed whichever single instance existed, full stop. Under multi-source,
"the existing debuff instance to react against" could theoretically belong
to a DIFFERENT source than the one triggering this reaction (e.g. enemy A's
DoT reacting with the player's freshly-applied debuff). This plan's rewrite
above assumes `existingSourceId = source.id` (the REACTING source owns
both halves) as the simplest interpretation consistent with the "own"
default elsewhere in this plan — but confirm this against
`ReactionManager.test.ts`'s actual fixtures before finalizing: if any
existing test applies the "existing" ailment from a DIFFERENT source than
the "new" one, this assumption is wrong and needs
`targetBuffs.getAllById(existingId)` disambiguation instead. Flag this
explicitly in your task completion report either way.

- [ ] **Step 2: Update the 3 test files' call sites**

`ReactionManager.test.ts`, `.powerScaling.test.ts`, `.phanPhac.test.ts` —
every `new AilmentSystem(...)`/`AilmentManager`/`.getAilment(...)` fixture
becomes `new BuffSystem(...)`/`BuffPool`/`.getFromSource(id, sourceId)`.
Run each file individually after fixing, don't batch-guess.

- [ ] **Step 3: Run tests to verify they pass**

Run: `cd game && npx vitest run src/core/element/ReactionManager.test.ts src/core/element/ReactionManager.powerScaling.test.ts src/core/element/ReactionManager.phanPhac.test.ts`
Expected: PASS (all ~30+ cases across the 3 files).

- [ ] **Step 4: Commit**

```bash
git add game/src/core/element/ReactionManager.ts game/src/core/element/ReactionManager.test.ts game/src/core/element/ReactionManager.powerScaling.test.ts game/src/core/element/ReactionManager.phanPhac.test.ts
git commit -m "refactor(element): ReactionManager reads targetBuffs instead of targetAilments"
```

---

### Task 13: `CombatSystem.ts` — `fireKillTriggers()`'s throwaway context

**Files:**
- Modify: `game/src/core/combat/CombatSystem.ts`
- Test: `game/src/core/combat/CombatSystem.triggers.test.ts`,
  `game/src/core/combat/CombatSystem.ailmentDamage.test.ts`

**Interfaces:**
- Consumes: `BuffPool`/`BuffSystem` (Tasks 3-4).
- Produces: `fireKillTriggers()`'s `SkillEffectContext` construction updated.

- [ ] **Step 1: Update `fireKillTriggers()`**

```ts
private fireKillTriggers(
  victim: CombatEntity,
  skillContext?: { killer: CombatEntity; skillId: string },
): void {
  if (!skillContext || !this.skillManager || !this.buffRegistry || !this.reactionManager) {
    return
  }
  const skill = this.skillManager.get(skillContext.skillId)
  if (!skill?.triggers?.length) return

  const ctx: SkillEffectContext = {
    combatSystem: this,
    fireHit: () => ({ landed: true }),
    buffRegistry: this.buffRegistry,
    sourceBuffs: new BuffSystem(new BuffPool()),
    targetBuffs: new BuffSystem(new BuffPool()),
    reactionManager: this.reactionManager,
  }

  this.skillTriggerRunner.fire('onKill', { source: skillContext.killer, target: victim, skill },
    skill.triggers, skillContext.killer, victim, ctx)
}
```

(`this.ailmentRegistry` guard/field removed from the class entirely if this
was its only use — check the constructor and other methods for other
`ailmentRegistry` references before deleting the field/constructor
parameter.)

- [ ] **Step 2: Update the 2 test files**

`CombatSystem.triggers.test.ts`/`CombatSystem.ailmentDamage.test.ts` —
update any `AilmentManager`/`AilmentSystem`/`ailmentRegistry` fixture
construction to `BuffPool`/`BuffSystem`/`buffRegistry`.

- [ ] **Step 3: Run tests to verify they pass**

Run: `cd game && npx vitest run src/core/combat/CombatSystem.triggers.test.ts src/core/combat/CombatSystem.ailmentDamage.test.ts`
Expected: PASS.

- [ ] **Step 4: Type-check**

Run: `cd game && npm run type-check`
Expected: PASS with ZERO errors in every production `.ts` file (not test
files — those are Task 17). If any production file still errors, that's a
call site this plan's task list missed — investigate and fix before
proceeding; do not defer a production-code type error to the test-sweep
task.

- [ ] **Step 5: Commit**

```bash
git add game/src/core/combat/CombatSystem.ts game/src/core/combat/CombatSystem.triggers.test.ts game/src/core/combat/CombatSystem.ailmentDamage.test.ts
git commit -m "refactor(combat): fireKillTriggers uses BuffPool/BuffSystem throwaway context"
```

---

### Task 14: Port `AilmentSystem`'s 4 specialized test files into `BuffSystem.test.ts`

**Files:**
- Modify: `game/src/core/buff/BuffSystem.test.ts` (add 4 new `describe`
  blocks, ported from the files below)
- Read (source of the port): `game/src/core/ailment/AilmentSystem.poisonRoot.test.ts`,
  `game/src/core/ailment/AilmentSystem.kimThe.test.ts`,
  `game/src/core/ailment/AilmentSystem.onHitProc.test.ts`,
  `game/src/core/ailment/AilmentSystem.convert.test.ts`

**Interfaces:**
- Consumes: `BuffSystem`/`BuffPool`/`BuffDefinition` (Tasks 2-4).

Every test case in these 4 files must survive with equivalent coverage —
this is the plan's main regression guard for `BuffSystem.apply()`'s ported
DoT/CC/conversion math (Task 4). Port test-by-test, not file-by-file
skimmed — read each source file's actual assertions before writing its
`BuffSystem` equivalent, since the exact expected numbers must carry over
unchanged.

- [ ] **Step 1: Port `AilmentSystem.poisonRoot.test.ts`'s 5 cases**

Add a `describe('BuffSystem — Độc Căn (ported from AilmentSystem.poisonRoot.test.ts)', ...)` block to
`BuffSystem.test.ts` with equivalent cases, using `BuffDefinition`/`Buff`
fixtures (`effects: [{type:'dot', dpsRatio, poisonRootPercentPerStack,
poisonRootMaxStacks, poisonRootThresholdBonusPercent}]`) instead of the old
flat `Ailment` fields, asserting the same numeric expectations the source
file asserts (re-read the source file's actual `expect(...)` values — do
not approximate them).

- [ ] **Step 2: Port `AilmentSystem.kimThe.test.ts`'s 4 cases**

Same pattern, `describe('BuffSystem — Kim Thế (ported from AilmentSystem.kimThe.test.ts)', ...)`.

- [ ] **Step 3: Port `AilmentSystem.onHitProc.test.ts`'s cases**

Same pattern, `describe('BuffSystem — on-hit proc / Thạch Hóa (ported from AilmentSystem.onHitProc.test.ts)', ...)`
— covers both the `statModifier`+`onHitProc` co-occurrence on one
definition (per Task 7's Thạch Hóa port) and `rollOnHitEffects()`'s
boundary cases (chance 0/1, wrong sourceId attribution).

- [ ] **Step 4: Port `AilmentSystem.convert.test.ts`'s 3 cases**

Same pattern, `describe('BuffSystem — conversion chain, Làm Chậm -> Đóng Băng (ported from AilmentSystem.convert.test.ts)', ...)`.

- [ ] **Step 5: Run the full file**

Run: `cd game && npx vitest run src/core/buff/BuffSystem.test.ts`
Expected: PASS — every ported case plus everything from Tasks 3-4.

- [ ] **Step 6: Commit**

```bash
git add game/src/core/buff/BuffSystem.test.ts
git commit -m "test(buff): port AilmentSystem's poisonRoot/kimThe/onHitProc/convert coverage into BuffSystem"
```

(The 4 source `AilmentSystem.*.test.ts` files are NOT deleted yet — Task 16
deletes them alongside the rest of `game/src/core/ailment/`.)

---

### Task 15: Mechanical sweep — every remaining test file, using the rename table

**Files:** every file from this rename table's "affected test files" list
(the 40 files enumerated during this plan's research, minus the ones
Tasks 10-13 already fixed: `SkillActionRegistry.test.ts`,
`SkillEffectSystem.test.ts`, `ReactionManager.test.ts`/
`.powerScaling.test.ts`/`.phanPhac.test.ts`, `CombatSystem.triggers.test.ts`/
`.ailmentDamage.test.ts` — roughly 33 files remain). Also confirm
`UltimateSystem.test.ts` and any file with a `playerAilments`/
`ailments: new AilmentManager()` fixture not caught by the original grep
pattern (flagged as a gap during this plan's research — re-run the grep
below fresh before starting, do not trust the count from research).

**Rename table (apply exactly, no deviation):**

| Old | New |
|---|---|
| `import { AilmentManager } from '.../AilmentManager'` | `import { BuffPool } from '.../BuffPool'` |
| `import { AilmentSystem } from '.../AilmentSystem'` | `import { BuffSystem } from '.../BuffSystem'` |
| `new AilmentManager()` | `new BuffPool()` |
| `new AilmentSystem(x)` | `new BuffSystem(x)` |
| `playerAilments: new AilmentManager()` (Battle fixture) | delete the line entirely |
| `ailments: new AilmentManager()` (BattleEnemy fixture) | delete the line entirely |
| `ailmentRegistry` (any variable/param/field name) | `buffRegistry` |
| `AilmentRegistry` (type/import) | `BuffRegistry` |
| `AilmentId` (type/import) | `string` |
| `.getAilment(id)` | `.getFromSource(id, sourceId)` — supply the correct `sourceId` from the test's own fixture context, do not guess a placeholder value |
| `targetAilments:` (in a `SkillEffectContext`/`makeCtx` fixture) | delete the field entirely |
| `type: 'applyAilment', ailmentId: X, chance: Y` | `type: 'applyDebuff', buffId: X, chance: Y` |
| `type: 'ailment', ailmentId: X, ailmentChance: Y` (`SkillEffect` fixture) | `type: 'debuff', buffId: X, ailmentChance: Y` |

- [ ] **Step 1: Re-run the discovery grep fresh**

Run: `cd game && grep -rl "AilmentManager\|AilmentSystem\|targetAilments\|ailmentRegistry\|AilmentRegistry\|AilmentId\|playerAilments" src --include="*.test.ts"`
This is the authoritative, current list — do not rely on the count from
this plan's research phase, which may be stale by the time you reach this
task.

- [ ] **Step 2: Fix each file, one at a time**

For each file in the Step 1 list: apply the rename table, run ONLY that
file, confirm PASS before moving to the next file. If a file has a case the
rename table doesn't cover (something genuinely novel, not a mechanical
rename), stop and think about it as a real design question rather than
forcing the table — note it in your task report rather than silently
inventing a workaround.

Run per-file: `cd game && npx vitest run src/path/to/File.test.ts`

- [ ] **Step 3: Run the FULL suite**

Run: `cd game && npx vitest run`
Expected: PASS, zero failures, zero unhandled errors (a single flaky
timeout unrelated to this change is acceptable — re-run that one file in
isolation to confirm it's not a real regression before treating it as
noise, same verification standard as the Phase 2A plan used).

- [ ] **Step 4: Commit**

```bash
git add game/src
git commit -m "test: sweep every remaining test file off AilmentManager/AilmentSystem onto BuffPool/BuffSystem"
```

---

### Task 16: Delete `game/src/core/ailment/` and `game/src/data/ailment/`

**Files:**
- Delete: `game/src/core/ailment/AilmentManager.ts`,
  `game/src/core/ailment/AilmentSystem.ts`, `game/src/core/ailment/Ailment.ts`,
  `game/src/core/ailment/AilmentTypes.ts`, `game/src/core/ailment/AilmentRegistry.ts`,
  `game/src/core/ailment/AilmentSystem.poisonRoot.test.ts`,
  `game/src/core/ailment/AilmentSystem.kimThe.test.ts`,
  `game/src/core/ailment/AilmentSystem.onHitProc.test.ts`,
  `game/src/core/ailment/AilmentSystem.convert.test.ts`
- Delete: `game/src/data/ailment/ailments.ts`
- Modify: `game/src/App.vue` (delete `AilmentRegistry` registration setup —
  find the exact registration call from the spec's research, likely
  alongside `BuffRegistry`'s own setup)

- [ ] **Step 1: Confirm zero remaining references**

Run: `cd game && grep -rl "core/ailment\|data/ailment\|AilmentManager\|AilmentSystem\|AilmentRegistry\|AilmentTemplate\|AilmentId\b" src`
Expected: EMPTY (if anything shows up, Tasks 9-15 missed a call site — fix
it before deleting, don't delete first and fix breakage after).

- [ ] **Step 2: Delete the files**

```bash
git rm -r game/src/core/ailment
git rm -r game/src/data/ailment
```

- [ ] **Step 3: Update `game/src/App.vue`**

Delete the `AilmentRegistry` instantiation/registration lines (find via
the same grep pattern from Step 1 if `App.vue` didn't show up there,
double-check it directly since setup files sometimes escape grep patterns
tied to type names rather than import paths).

- [ ] **Step 4: Type-check + full test suite + build**

Run: `cd game && npm run type-check`
Expected: PASS, zero errors anywhere.

Run: `cd game && npx vitest run`
Expected: PASS, same standard as Task 15 Step 3.

Run: `cd game && npm run build`
Expected: clean build, no new warnings beyond the pre-existing chunk-size
warning this project already has.

- [ ] **Step 5: Commit**

```bash
git add game/src/App.vue
git commit -m "refactor(buff): delete game/src/core/ailment + game/src/data/ailment — fully merged into buff/"
```

---

### Task 17: Final full verification

**Files:** none — verification only.

- [ ] **Step 1: Type-check**

Run: `cd game && npm run type-check`
Expected: PASS.

- [ ] **Step 2: Full test suite**

Run: `cd game && npx vitest run`
Expected: PASS, zero failures. Pay special attention to every Ngũ Hành
element suite (`BattleSystem.hoaThe.test.ts`, `BattleSystem.kimPath.test.ts`,
`BattleSystem.earthPath.test.ts`, `BattleSystem.thachHoa.test.ts`, and any
Thủy/Mộc-named files) plus `Playtest.continuousCombat.test.ts` — these are
the real regression surface per the spec's testing section.

- [ ] **Step 3: Build**

Run: `cd game && npm run build`
Expected: clean.

- [ ] **Step 4: Playwright boot-fresh smoke test**

Run: `cd game && npx playwright test tests/e2e/boot-fresh.spec.ts`
Expected: PASS — confirms the game still boots and a fresh character can
be created (this doesn't exercise combat/buffs directly but catches any
import-graph breakage the unit tests wouldn't).

- [ ] **Step 5: Manual combat smoke check (documented in task report, not automated)**

Since this plan touches DoT/CC/reaction logic across all 5 shipped Ngũ
Hành elements, run the dev server and fight at least one battle with a
DoT-applying skill (any element) and confirm in the browser console/UI
that damage ticks, the buff icon/tooltip shows, and it expires on schedule
— report this check's outcome explicitly, do not just claim "tests pass
therefore it works."

No commit for this task — it's pure verification. If Step 2/3/4 fail,
return to the relevant earlier task and fix, then re-run this task from
Step 1.
