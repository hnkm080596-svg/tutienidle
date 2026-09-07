import { describe, expect, it } from 'vitest'
import {
  hasResourceFor,
  consumeResourceFor,
  selectAction,
  tickCooldowns,
  commitAction,
  collectTurnTargets,
  selectRandomDistinctElementPair,
  type TurnSkillDefinition,
} from './TurnSkillAction'
import type { TurnBattleParticipant } from './TurnBattleSystem'
import type { CombatEntity } from '../../combat/CombatEntity'
import { createBaseStats } from '../../stats/StatBlock'
import { TurnBuffPool } from './TurnBuffPool'

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
    buffs: new TurnBuffPool(), consecutiveHardCcTurns: 0,
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

describe('collectTurnTargets', () => {
  it('single shape: only the primary target', () => {
    const primary = participant({ id: 'primary', entity: entity({ id: 'primary', x: 2, row: 2 }) })
    const other = participant({ id: 'other', entity: entity({ id: 'other', x: 5, row: 2 }) })

    const affected = collectTurnTargets(primary, [primary, other], { shape: 'single' })

    expect(affected.map((p) => p.id)).toEqual(['primary'])
  })

  it('square shape: includes participants within laneRadius/columnRadius of the primary', () => {
    const primary = participant({ id: 'primary', entity: entity({ id: 'primary', x: 2, row: 2 }) })
    const near = participant({ id: 'near', entity: entity({ id: 'near', x: 3, row: 2 }) })
    const far = participant({ id: 'far', entity: entity({ id: 'far', x: 10, row: 2 }) })

    const affected = collectTurnTargets(primary, [primary, near, far], {
      shape: 'square',
      laneRadius: 1,
      columnRadius: 1,
    })

    expect(affected.map((p) => p.id).sort()).toEqual(['near', 'primary'])
  })

  it('cross shape: includes same row/column within radius, excludes diagonal', () => {
    const primary = participant({ id: 'primary', entity: entity({ id: 'primary', x: 4, row: 4 }) })
    const sameRow = participant({ id: 'sameRow', entity: entity({ id: 'sameRow', x: 5, row: 4 }) })
    const diagonal = participant({ id: 'diagonal', entity: entity({ id: 'diagonal', x: 5, row: 5 }) })

    const affected = collectTurnTargets(primary, [primary, sameRow, diagonal], {
      shape: 'cross',
      laneRadius: 2,
    })

    expect(affected.map((p) => p.id).sort()).toEqual(['primary', 'sameRow'])
  })

  it('excludes dead participants even if inside the shape', () => {
    const primary = participant({ id: 'primary', entity: entity({ id: 'primary', x: 2, row: 2 }) })
    const dead = participant({
      id: 'dead',
      entity: entity({ id: 'dead', x: 2, row: 2, alive: false }),
      alive: false,
    })

    const affected = collectTurnTargets(primary, [primary, dead], { shape: 'square', laneRadius: 2, columnRadius: 2 })

    expect(affected.map((p) => p.id)).toEqual(['primary'])
  })

  it('always includes the primary target even outside the shape bounds (defensive)', () => {
    const primary = participant({ id: 'primary', entity: entity({ id: 'primary', x: 2, row: 2 }) })

    const affected = collectTurnTargets(primary, [primary], { shape: 'column' })

    expect(affected.map((p) => p.id)).toEqual(['primary'])
  })
})


// ---------------------------------------------------------------------------
// Future Systems Task 4 â€” Reaction Path random-2-distinct-element selector
// ---------------------------------------------------------------------------

describe('selectRandomDistinctElementPair', () => {
  const pool: TurnSkillDefinition[] = [
    {
      id: 'fire_bolt', cooldownTurns: 0,
      damage: { kind: 'elemental', multiplier: 1, components: [{ kind: 'element', element: 'fire', ratio: 1 }] },
      targeting: { shape: 'single' },
    },
    {
      id: 'water_bolt', cooldownTurns: 0,
      damage: { kind: 'elemental', multiplier: 1, components: [{ kind: 'element', element: 'water', ratio: 1 }] },
      targeting: { shape: 'single' },
    },
    {
      id: 'wood_bolt', cooldownTurns: 0,
      damage: { kind: 'elemental', multiplier: 1, components: [{ kind: 'element', element: 'wood', ratio: 1 }] },
      targeting: { shape: 'single' },
    },
  ]

  it('tráº£ 2 skill id KHÃC nhau tá»« pool, luÃ´n thuá»™c pool', () => {
    for (let i = 0; i < 50; i++) {
      const [a, b] = selectRandomDistinctElementPair(pool)

      expect(a.id).not.toBe(b.id)
      expect(pool).toContain(a)
      expect(pool).toContain(b)
    }
  })

  it('nÃ©m lá»—i khi pool cÃ³ Ã­t hÆ¡n 2 pháº§n tá»­', () => {
    const single = pool.slice(0, 1)

    expect(() => selectRandomDistinctElementPair(single)).toThrow()
    expect(() => selectRandomDistinctElementPair([])).toThrow()
  })
})

describe('the resource type (Phase A3)', () => {
  it('gates on currentThe reaching the resource cost', () => {
    const theEntity = entity({ currentThe: 40 })
    const theSkill = skill({ resourceType: 'the', resourceCost: 100 })

    expect(hasResourceFor(theEntity, theSkill)).toBe(false)

    theEntity.currentThe = 100

    expect(hasResourceFor(theEntity, theSkill)).toBe(true)
  })

  it('consumes the full pool on cast, matching legacy consumeTheForUlt reset-to-zero', () => {
    const theEntity = entity({ currentThe: 100 })
    const theSkill = skill({ resourceType: 'the', resourceCost: 100 })

    consumeResourceFor(theEntity, theSkill)

    expect(theEntity.currentThe).toBe(0)
  })
})
