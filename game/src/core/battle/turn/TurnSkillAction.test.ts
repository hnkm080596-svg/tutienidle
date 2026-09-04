import { describe, expect, it } from 'vitest'
import {
  hasResourceFor,
  consumeResourceFor,
  selectAction,
  tickCooldowns,
  commitAction,
  type TurnSkillDefinition,
} from './TurnSkillAction'
import type { TurnBattleParticipant } from './TurnBattleSystem'
import type { CombatEntity } from '../../combat/CombatEntity'
import { createBaseStats } from '../../stats/StatBlock'

function entity(overrides: Partial<CombatEntity> = {}): CombatEntity {
  const stats = createBaseStats()

  return {
    id: 'id',
    name: 'name',
    type: 'player',
    baseStats: stats,
    stats,
    currentHp: stats.maxHp,
    maxHp: stats.maxHp,
    currentMp: 50,
    currentSwordIntent: 30,
    currentMomentum: 10,
    currentHoaThe: 0,
    currentThoThe: 0,
    currentKimThe: 0,
    timeSinceLastBleedProc: 0,
    tuLucActive: false,
    tuLucElapsed: 0,
    tuLucDamageTakenPercent: 0,
    currentWard: 0,
    timeSinceLastHitTaken: Infinity,
    realmIndex: 0,
    x: 0,
    row: 2,
    alive: true,
    ...overrides,
  } as CombatEntity
}

function skill(overrides: Partial<TurnSkillDefinition> = {}): TurnSkillDefinition {
  return {
    id: 'fixture_skill',
    cooldownTurns: 0,
    damage: { kind: 'physical', multiplier: 1 },
    targeting: { shape: 'single' },
    ...overrides,
  }
}

describe('hasResourceFor', () => {
  it('true when skill has no resourceType', () => {
    expect(hasResourceFor(entity(), skill())).toBe(true)
  })

  it('true when resourceType is none', () => {
    expect(hasResourceFor(entity(), skill({ resourceType: 'none', resourceCost: 999 }))).toBe(true)
  })

  it('true when mana cost is affordable', () => {
    expect(hasResourceFor(entity({ currentMp: 50 }), skill({ resourceType: 'mana', resourceCost: 50 }))).toBe(true)
  })

  it('false when mana cost exceeds current mana', () => {
    expect(hasResourceFor(entity({ currentMp: 10 }), skill({ resourceType: 'mana', resourceCost: 50 }))).toBe(false)
  })

  it('checks sword_intent pool', () => {
    expect(hasResourceFor(entity({ currentSwordIntent: 30 }), skill({ resourceType: 'sword_intent', resourceCost: 30 }))).toBe(true)
    expect(hasResourceFor(entity({ currentSwordIntent: 29 }), skill({ resourceType: 'sword_intent', resourceCost: 30 }))).toBe(false)
  })

  it('checks momentum pool', () => {
    expect(hasResourceFor(entity({ currentMomentum: 10 }), skill({ resourceType: 'momentum', resourceCost: 10 }))).toBe(true)
    expect(hasResourceFor(entity({ currentMomentum: 5 }), skill({ resourceType: 'momentum', resourceCost: 10 }))).toBe(false)
  })
})

describe('consumeResourceFor', () => {
  it('subtracts resource cost from the matching pool', () => {
    const source = entity({ currentMp: 50 })

    consumeResourceFor(source, skill({ resourceType: 'mana', resourceCost: 20 }))

    expect(source.currentMp).toBe(30)
  })

  it('no-op when skill has no resourceType', () => {
    const source = entity({ currentMp: 50 })

    consumeResourceFor(source, skill())

    expect(source.currentMp).toBe(50)
  })
})

function participant(overrides: Partial<TurnBattleParticipant> = {}): TurnBattleParticipant {
  return {
    id: 'actor',
    entity: entity(),
    speed: 10,
    priority: 0,
    actionGauge: 0,
    alive: true,
    ...overrides,
  }
}

describe('selectAction priority', () => {
  it('falls back to the hardcoded basic attack when no skill fields are set', () => {
    const action = selectAction(participant())

    expect(action.skillId).toBe('basic_attack')
    expect(action.damage).toEqual({ kind: 'physical', multiplier: 1 })
    expect(action.slot).toBeNull()
  })

  it('uses the basic skill when set and no special/ultimate are ready', () => {
    const basic = skill({ id: 'basic_skill' })

    const action = selectAction(participant({ basic }))

    expect(action.skillId).toBe('basic_skill')
    expect(action.slot).toBeNull()
  })

  it('prefers special over basic when special is off cooldown and affordable', () => {
    const basic = skill({ id: 'basic_skill' })
    const special = { skill: skill({ id: 'special_skill' }), remainingCooldownTurns: 0 }

    const action = selectAction(participant({ basic, special }))

    expect(action.skillId).toBe('special_skill')
    expect(action.slot).toBe(special)
  })

  it('prefers ultimate over special and basic when ultimate is ready', () => {
    const basic = skill({ id: 'basic_skill' })
    const special = { skill: skill({ id: 'special_skill' }), remainingCooldownTurns: 0 }
    const ultimate = { skill: skill({ id: 'ultimate_skill' }), remainingCooldownTurns: 0 }

    const action = selectAction(participant({ basic, special, ultimate }))

    expect(action.skillId).toBe('ultimate_skill')
  })

  it('falls through to special when ultimate is still on cooldown', () => {
    const special = { skill: skill({ id: 'special_skill' }), remainingCooldownTurns: 0 }
    const ultimate = { skill: skill({ id: 'ultimate_skill' }), remainingCooldownTurns: 3 }

    const action = selectAction(participant({ special, ultimate }))

    expect(action.skillId).toBe('special_skill')
  })

  it('falls through to basic when special cannot afford its resource cost', () => {
    const basic = skill({ id: 'basic_skill' })
    const special = {
      skill: skill({ id: 'special_skill', resourceType: 'mana', resourceCost: 999 }),
      remainingCooldownTurns: 0,
    }

    const action = selectAction(participant({ basic, special, entity: entity({ currentMp: 10 }) }))

    expect(action.skillId).toBe('basic_skill')
  })
})

describe('tickCooldowns', () => {
  it('decrements special/ultimate remaining cooldown by 1, floored at 0', () => {
    const special = { skill: skill({ id: 's' }), remainingCooldownTurns: 2 }
    const ultimate = { skill: skill({ id: 'u' }), remainingCooldownTurns: 0 }
    const actor = participant({ special, ultimate })

    tickCooldowns(actor)

    expect(special.remainingCooldownTurns).toBe(1)
    expect(ultimate.remainingCooldownTurns).toBe(0)
  })
})

describe('commitAction', () => {
  it('sets the used slot on cooldown and consumes its resource', () => {
    const special = {
      skill: skill({ id: 's', cooldownTurns: 4, resourceType: 'mana', resourceCost: 20 }),
      remainingCooldownTurns: 0,
    }
    const actor = entity({ currentMp: 50 })

    commitAction(actor, selectAction(participant({ special, entity: actor })))

    expect(special.remainingCooldownTurns).toBe(4)
    expect(actor.currentMp).toBe(30)
  })

  it('is a no-op for the basic-attack fallback (slot is null)', () => {
    const actor = entity({ currentMp: 50 })

    commitAction(actor, selectAction(participant({ entity: actor })))

    expect(actor.currentMp).toBe(50)
  })
})
