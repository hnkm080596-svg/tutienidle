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
