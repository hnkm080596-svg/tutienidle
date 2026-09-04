import { describe, expect, it } from 'vitest'
import { hasResourceFor, consumeResourceFor, type TurnSkillDefinition } from './TurnSkillAction'
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
