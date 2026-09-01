import { describe, expect, it, vi } from 'vitest'
import { runSkillAction, SKILL_ACTION_REGISTRY } from './SkillActionRegistry'
import type { ActionExecutionHelpers } from './SkillActionRegistry'
import type { ActionRuntimeContext, DealDamageAction, SkillActionType } from './SkillAction'
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

function makeHelpers(): ActionExecutionHelpers {
  return { fireNested: () => {} }
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

    runSkillAction(action, source, target, ctx, {}, makeHelpers())

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

    runSkillAction(action, source, target, ctx, {}, makeHelpers())

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

    runSkillAction(action, source, target, ctx, {}, makeHelpers())

    // finalMultiplier = 2 * (1 + 0.1*10) * (1 + 0) = 2 * 2 = 4
    expect(ctx.fireHit).toHaveBeenCalledWith(target, { kind: 'physical', multiplier: 4 })
  })
})

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
    expect(fireNested).toHaveBeenCalledWith('onProc', { source, target, ailmentId: 'bong' })
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
