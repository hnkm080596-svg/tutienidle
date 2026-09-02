import { describe, expect, it, vi } from 'vitest'
import { SkillEffectSystem } from './SkillEffectSystem'
import type { SkillEffectContext } from './SkillEffectSystem'
import { runSkillAction } from './SkillActionRegistry'
import type { ActionExecutionHelpers } from './SkillActionRegistry'
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
    sourceBuffs: {} as SkillEffectContext['sourceBuffs'],
    targetBuffs: {} as SkillEffectContext['targetBuffs'],
    reactionManager: {} as SkillEffectContext['reactionManager'],
    skillExperience: 200,
  }
}

function makeHelpers(): ActionExecutionHelpers {
  return { fireNested: () => {} }
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
      makeHelpers(),
    )

    expect(newCalls).toEqual(oldCalls)
  })
})
