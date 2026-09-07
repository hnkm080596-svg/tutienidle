import { describe, expect, it } from 'vitest'
import { selectTarget, TurnBattleSystem, type TurnBattle, type TurnBattleParticipant, type TurnBattleState } from './TurnBattleSystem'
import type { CombatEntity } from '../../combat/CombatEntity'
import { CombatSystem } from '../../combat/CombatSystem'
import { EventBus } from '../../events/EventBus'
import { createBaseStats } from '../../stats/StatBlock'
import type { TurnSkillDefinition } from './TurnSkillAction'
import { TurnBuffPool } from './TurnBuffPool'
import { GAUGE_MAX } from './ActionGauge'
import { defineEnemy, enemyToCombatEntity } from '../../enemy/Enemy'
import { toTurnBattleParticipant } from '../../game/TurnBattleAdapter'
import { TURN_BUFF_REGISTRY } from '../../../data/buff/TurnBuffRegistry'
import { PHAP_TU_BASICS } from '../../../data/skill/TurnBasicAttacks'
import { TurnReactionManager } from './TurnReactionManager'

// Fixture giá»‘ng há»‡t quy Æ°á»›c Ä‘Ã£ dÃ¹ng trong ActionTargetingSystem.test.ts â€”
// selectTarget chá»‰ Ä‘á»c id/x/row/alive, khÃ´ng cáº§n Stats Ä‘áº§y Ä‘á»§.
function entity(id: string, column: number, row: number, alive = true): CombatEntity {
  return {
    id,
    x: column,
    row: row as never,
    alive,
  } as unknown as CombatEntity
}

function participant(
  id: string,
  combatEntity: CombatEntity,
  speed = 10,
  priority = 0,
): TurnBattleParticipant {
  return { id, entity: combatEntity, speed, priority, actionGauge: 0, alive: combatEntity.alive, buffs: new TurnBuffPool(), consecutiveHardCcTurns: 0 }
}

describe('selectTarget', () => {
  it('cÃ¹ng hÃ ng: chá»n entity gáº§n nháº¥t theo cá»™t', () => {
    const actor = participant('actor', entity('actor', 0, 4))
    const near = participant('near', entity('near', 2, 4))
    const far = participant('far', entity('far', 5, 4))

    expect(selectTarget(actor, [far, near])?.id).toBe('near')
  })

  it('khÃ´ng cÃ³ ai cÃ¹ng hÃ ng: chá»n gáº§n nháº¥t theo Chebyshev toÃ n bÃ n cá»', () => {
    const actor = participant('actor', entity('actor', 0, 4))
    const otherRowNear = participant('otherRowNear', entity('otherRowNear', 1, 5))
    const otherRowFar = participant('otherRowFar', entity('otherRowFar', 8, 8))

    expect(selectTarget(actor, [otherRowFar, otherRowNear])?.id).toBe('otherRowNear')
  })

  it('bá» qua entity Ä‘Ã£ cháº¿t', () => {
    const actor = participant('actor', entity('actor', 0, 4))
    const dead = participant('dead', entity('dead', 1, 4, false))
    const alive = participant('alive', entity('alive', 3, 4))

    expect(selectTarget(actor, [dead, alive])?.id).toBe('alive')
  })

  it('toÃ n bá»™ phe Ä‘á»‘i diá»‡n Ä‘Ã£ cháº¿t: tráº£ vá» undefined', () => {
    const actor = participant('actor', entity('actor', 0, 4))
    const dead = participant('dead', entity('dead', 1, 4, false))

    expect(selectTarget(actor, [dead])).toBeUndefined()
  })
})

// Fixture giá»‘ng há»‡t quy Æ°á»›c CombatSystem.damageFloor.test.ts â€” cáº§n Stats
// Ä‘áº§y Ä‘á»§ vÃ¬ runToCompletion gá»i tháº­t CombatSystem.resolveActionHit().
function createCombatant(overrides: Partial<CombatEntity> = {}): CombatEntity {
  const stats = { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0 }

  return {
    id: 'id',
    name: 'name',
    type: 'enemy',
    baseStats: stats,
    stats,
    currentHp: stats.maxHp,
    maxHp: stats.maxHp,
    currentMp: stats.maxMp,
    currentSwordIntent: 0,
    currentMomentum: 0,
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

function makeParticipant(
  id: string,
  combatEntity: CombatEntity,
  speed: number,
  priority: number,
): TurnBattleParticipant {
  return { id, entity: combatEntity, speed, priority, actionGauge: 0, alive: combatEntity.alive, buffs: new TurnBuffPool(), consecutiveHardCcTurns: 0 }
}

describe('TurnBattleSystem.runToCompletion', () => {
  it('Ä‘Ã²n trÃºng lÃ m giáº£m HP, tráº­n káº¿t thÃºc Ä‘Ãºng tráº¡ng thÃ¡i khi enemy cháº¿t', () => {
    const player = createCombatant({
      id: 'player',
      type: 'player',
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 999 },
    })
    const enemyEntity = createCombatant({
      id: 'enemy',
      currentHp: 1,
      maxHp: 1,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })

    const battle: TurnBattle = {
      players: [makeParticipant('player', player, 10, 0)],
      enemies: [makeParticipant('enemy', enemyEntity, 10, 1)],
      state: 'fighting',
    }

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()))
    const result = system.runToCompletion(battle)

    expect(result).toBe('victory')
    expect(battle.state).toBe('victory')
  })

  it('player cháº¿t trÆ°á»›c => defeat', () => {
    const player = createCombatant({
      id: 'player',
      type: 'player',
      currentHp: 1,
      maxHp: 1,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })
    const enemyEntity = createCombatant({
      id: 'enemy',
      currentHp: 1_000_000,
      maxHp: 1_000_000,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 999 },
    })

    const battle: TurnBattle = {
      players: [makeParticipant('player', player, 10, 0)],
      enemies: [makeParticipant('enemy', enemyEntity, 10, 1)],
      state: 'fighting',
    }

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()))
    const result = system.runToCompletion(battle)

    expect(result).toBe('defeat')
  })

  it('nhiá»u enemy: target chuyá»ƒn sang enemy gáº§n káº¿ tiáº¿p sau khi enemy gáº§n nháº¥t cháº¿t', () => {
    const player = createCombatant({
      id: 'player',
      type: 'player',
      row: 4,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 50 },
    })
    const near = createCombatant({
      id: 'near',
      row: 4,
      x: 1,
      currentHp: 1,
      maxHp: 1,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })
    const far = createCombatant({
      id: 'far',
      row: 4,
      x: 5,
      currentHp: 10,
      maxHp: 10,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })

    const battle: TurnBattle = {
      players: [makeParticipant('player', player, 10, 0)],
      enemies: [makeParticipant('near', near, 5, 1), makeParticipant('far', far, 5, 2)],
      state: 'fighting',
    }

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()))
    const result = system.runToCompletion(battle)

    expect(result).toBe('victory')
    expect(near.alive).toBe(false)
    expect(far.alive).toBe(false)
    expect(far.currentHp).toBeLessThan(10)
  })

  it('vÆ°á»£t quÃ¡ sá»‘ lÆ°á»£t tá»‘i Ä‘a: dá»«ng an toÃ n á»Ÿ defeat, khÃ´ng treo', () => {
    const player = createCombatant({
      id: 'player',
      type: 'player',
      currentHp: 1_000_000,
      maxHp: 1_000_000,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 1 },
    })
    const enemyEntity = createCombatant({
      id: 'enemy',
      currentHp: 1_000_000,
      maxHp: 1_000_000,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 1 },
    })

    const battle: TurnBattle = {
      players: [makeParticipant('player', player, 10, 0)],
      enemies: [makeParticipant('enemy', enemyEntity, 10, 1)],
      state: 'fighting',
    }

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 3)
    const result = system.runToCompletion(battle)

    expect(result).toBe('defeat')
    expect(player.alive).toBe(true)
    expect(enemyEntity.alive).toBe(true)
  })
})

function fixtureSkill(overrides: Partial<TurnSkillDefinition> = {}): TurnSkillDefinition {
  return {
    id: 'fixture_skill',
    cooldownTurns: 0,
    damage: { kind: 'physical', multiplier: 1 },
    targeting: { shape: 'single' },
    ...overrides,
  }
}

describe('TurnBattleSystem.resolveNextStep', () => {
  it('reports the acting participant, chosen skillId, and hit target for one step', () => {
    const player = createCombatant({
      id: 'player',
      type: 'player',
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 999 },
    })
    const enemyEntity = createCombatant({
      id: 'enemy',
      currentHp: 1_000_000,
      maxHp: 1_000_000,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })

    const battle: TurnBattle = {
      players: [makeParticipant('player', player, 10, 0)],
      enemies: [makeParticipant('enemy', enemyEntity, 10, 1)],
      state: 'fighting',
    }

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()))
    const step = system.resolveNextStep(battle)

    expect(step.state).toBe('fighting')
    expect(step.actorId).toBe('player')
    expect(step.skillId).toBe('basic_attack')
    expect(step.targetIds).toEqual(['enemy'])
    expect(enemyEntity.currentHp).toBeLessThan(1_000_000)
  })

  it('uses the special skill when set instead of the hardcoded basic attack', () => {
    const player = createCombatant({
      id: 'player',
      type: 'player',
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 999 },
    })
    const enemyEntity = createCombatant({
      id: 'enemy',
      currentHp: 1_000_000,
      maxHp: 1_000_000,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })

    const playerParticipant = makeParticipant('player', player, 10, 0)
    playerParticipant.special = { skill: fixtureSkill({ id: 'special_skill', cooldownTurns: 2 }), remainingCooldownTurns: 0 }

    const battle: TurnBattle = {
      players: [playerParticipant],
      enemies: [makeParticipant('enemy', enemyEntity, 10, 1)],
      state: 'fighting',
    }

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()))
    const step = system.resolveNextStep(battle)

    expect(step.skillId).toBe('special_skill')
    expect(playerParticipant.special.remainingCooldownTurns).toBe(2)
  })

  it('runToCompletion still resolves a full battle to victory using resolveNextStep under the hood', () => {
    const player = createCombatant({
      id: 'player',
      type: 'player',
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 999 },
    })
    const enemyEntity = createCombatant({
      id: 'enemy',
      currentHp: 1,
      maxHp: 1,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })

    const battle: TurnBattle = {
      players: [makeParticipant('player', player, 10, 0)],
      enemies: [makeParticipant('enemy', enemyEntity, 10, 1)],
      state: 'fighting',
    }

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()))
    const result = system.runToCompletion(battle)

    expect(result).toBe('victory')
  })
})

import { TurnBuffSystem } from './TurnBuffSystem'
import type { TurnBuffDefinition, TurnBuffRegistry } from './TurnBuffTypes'

class FixtureBuffRegistry implements TurnBuffRegistry {
  private readonly definitions = new Map<string, TurnBuffDefinition>()

  constructor(definitions: TurnBuffDefinition[]) {
    for (const definition of definitions) {
      this.definitions.set(definition.id, definition)
    }
  }

  get(id: string): TurnBuffDefinition {
    const definition = this.definitions.get(id)

    if (!definition) {
      throw new Error(`fixture buff not found: ${id}`)
    }

    return definition
  }
}

const STUN_DEFINITION: TurnBuffDefinition = {
  id: 'fixture_stun',
  name: 'Fixture Stun',
  polarity: 'debuff',
  duration: 1,
  stackMode: 'refresh',
  effects: [{ type: 'cc', ccEffect: 'stun' }],
}

describe('TurnBattleSystem.resolveNextStep buff/CC wiring', () => {
  it('ticks the acting participant own buffs down by 1 turn before acting', () => {
    const player = createCombatant({
      id: 'player',
      type: 'player',
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 999 },
    })
    const enemyEntity = createCombatant({
      id: 'enemy',
      currentHp: 1_000_000,
      maxHp: 1_000_000,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })

    const playerParticipant = makeParticipant('player', player, 10, 0)

    const registry = new FixtureBuffRegistry([STUN_DEFINITION])
    new TurnBuffSystem(playerParticipant.buffs).apply(STUN_DEFINITION, enemyEntity, player, registry)

    const battle: TurnBattle = {
      players: [playerParticipant],
      enemies: [makeParticipant('enemy', enemyEntity, 10, 1)],
      state: 'fighting',
    }

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 10, registry)
    const step = system.resolveNextStep(battle)

    expect(step.ccBlocked).toBe(true)
    expect(playerParticipant.buffs.getAll()).toEqual([])
  })

  it('a stunned actor deals no damage this step but the battle continues', () => {
    const player = createCombatant({
      id: 'player',
      type: 'player',
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 999 },
    })
    const enemyEntity = createCombatant({
      id: 'enemy',
      currentHp: 1_000_000,
      maxHp: 1_000_000,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })

    const playerParticipant = makeParticipant('player', player, 10, 0)

    const registry = new FixtureBuffRegistry([STUN_DEFINITION])
    new TurnBuffSystem(playerParticipant.buffs).apply(STUN_DEFINITION, enemyEntity, player, registry)

    const battle: TurnBattle = {
      players: [playerParticipant],
      enemies: [makeParticipant('enemy', enemyEntity, 10, 1)],
      state: 'fighting',
    }

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 10, registry)
    const step = system.resolveNextStep(battle)

    expect(step.targetIds).toEqual([])
    expect(enemyEntity.currentHp).toBe(1_000_000)
    expect(battle.state).toBe('fighting')
  })

  it('a non-stunned actor is unaffected (ccBlocked false, acts normally)', () => {
    const player = createCombatant({
      id: 'player',
      type: 'player',
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 999 },
    })
    const enemyEntity = createCombatant({
      id: 'enemy',
      currentHp: 1_000_000,
      maxHp: 1_000_000,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })

    const battle: TurnBattle = {
      players: [makeParticipant('player', player, 10, 0)],
      enemies: [makeParticipant('enemy', enemyEntity, 10, 1)],
      state: 'fighting',
    }

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()))
    const step = system.resolveNextStep(battle)

    expect(step.ccBlocked).toBe(false)
    expect(step.targetIds).toEqual(['enemy'])
  })
})

const BURN_DEFINITION: TurnBuffDefinition = {
  id: 'fixture_burn',
  name: 'Fixture Burn',
  polarity: 'debuff',
  duration: 3,
  stackMode: 'refresh',
  effects: [{ type: 'dot', dpsRatio: 0.5, element: 'physical' }],
}

describe('TurnBattleSystem.resolveNextStep appliesBuff (zone-as-dot proof)', () => {
  it("applies the skill's buff to the target it hit", () => {
    const player = createCombatant({
      id: 'player',
      type: 'player',
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 999 },
    })
    const enemyEntity = createCombatant({
      id: 'enemy',
      currentHp: 1_000_000,
      maxHp: 1_000_000,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })

    const playerParticipant = makeParticipant('player', player, 10, 0)
    playerParticipant.basic = {
      id: 'fixture_burning_strike',
      cooldownTurns: 0,
      damage: { kind: 'physical', multiplier: 1 },
      targeting: { shape: 'single' },
      appliesBuff: { definitionId: 'fixture_burn', target: 'target' },
    }

    const enemyParticipant = makeParticipant('enemy', enemyEntity, 10, 1)

    const battle: TurnBattle = {
      players: [playerParticipant],
      enemies: [enemyParticipant],
      state: 'fighting',
    }

    const registry = new FixtureBuffRegistry([BURN_DEFINITION])
    const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 10, registry)
    system.resolveNextStep(battle)

    const applied = enemyParticipant.buffs.getAll()

    expect(applied).toHaveLength(1)
    expect(applied[0]!.id).toBe('fixture_burn')
    expect(applied[0]!.sourceId).toBe('player')
  })

  it("applies the skill's buff to self when target is 'self'", () => {
    const player = createCombatant({
      id: 'player',
      type: 'player',
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 999 },
    })
    const enemyEntity = createCombatant({
      id: 'enemy',
      currentHp: 1_000_000,
      maxHp: 1_000_000,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })

    const playerParticipant = makeParticipant('player', player, 10, 0)
    playerParticipant.basic = {
      id: 'fixture_self_burn',
      cooldownTurns: 0,
      damage: { kind: 'physical', multiplier: 1 },
      targeting: { shape: 'single' },
      appliesBuff: { definitionId: 'fixture_burn', target: 'self' },
    }

    const battle: TurnBattle = {
      players: [playerParticipant],
      enemies: [makeParticipant('enemy', enemyEntity, 10, 1)],
      state: 'fighting',
    }

    const registry = new FixtureBuffRegistry([BURN_DEFINITION])
    const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 10, registry)
    system.resolveNextStep(battle)

    expect(playerParticipant.buffs.getAll()).toHaveLength(1)
  })

  it('AOE skill applies the buff to every hit target (zone-as-dot: no positional zone entity needed)', () => {
    const player = createCombatant({
      id: 'player',
      type: 'player',
      row: 4,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 999 },
    })
    const enemyA = createCombatant({
      id: 'enemyA',
      row: 4,
      x: 1,
      currentHp: 1_000_000,
      maxHp: 1_000_000,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })
    const enemyB = createCombatant({
      id: 'enemyB',
      row: 4,
      x: 2,
      currentHp: 1_000_000,
      maxHp: 1_000_000,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })

    const playerParticipant = makeParticipant('player', player, 10, 0)
    playerParticipant.basic = {
      id: 'fixture_burning_field',
      cooldownTurns: 0,
      damage: { kind: 'physical', multiplier: 1 },
      targeting: { shape: 'row' },
      appliesBuff: { definitionId: 'fixture_burn', target: 'target' },
    }

    const enemyAParticipant = makeParticipant('enemyA', enemyA, 10, 1)
    const enemyBParticipant = makeParticipant('enemyB', enemyB, 10, 2)

    const battle: TurnBattle = {
      players: [playerParticipant],
      enemies: [enemyAParticipant, enemyBParticipant],
      state: 'fighting',
    }

    const registry = new FixtureBuffRegistry([BURN_DEFINITION])
    const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 10, registry)
    system.resolveNextStep(battle)

    expect(enemyAParticipant.buffs.getAll()).toHaveLength(1)
    expect(enemyBParticipant.buffs.getAll()).toHaveLength(1)
  })

  it('does not throw and applies no buff when appliesBuff is set but no registry was provided', () => {
    const player = createCombatant({
      id: 'player',
      type: 'player',
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 999 },
    })
    const enemyEntity = createCombatant({
      id: 'enemy',
      currentHp: 1_000_000,
      maxHp: 1_000_000,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })

    const playerParticipant = makeParticipant('player', player, 10, 0)
    playerParticipant.basic = {
      id: 'fixture_burning_strike',
      cooldownTurns: 0,
      damage: { kind: 'physical', multiplier: 1 },
      targeting: { shape: 'single' },
      appliesBuff: { definitionId: 'fixture_burn', target: 'target' },
    }

    const enemyParticipant = makeParticipant('enemy', enemyEntity, 10, 1)

    const battle: TurnBattle = {
      players: [playerParticipant],
      enemies: [enemyParticipant],
      state: 'fighting',
    }

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()))

    expect(() => system.resolveNextStep(battle)).not.toThrow()
    expect(enemyParticipant.buffs.getAll()).toEqual([])
  })
})

describe('TurnBattleSystem.resolveNextStep resource tick + totalTurnsElapsed', () => {
  it('increments totalTurnsElapsed by 1 on every step', () => {
    const player = createCombatant({
      id: 'player',
      type: 'player',
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 999 },
    })
    const enemyEntity = createCombatant({
      id: 'enemy',
      currentHp: 1_000_000,
      maxHp: 1_000_000,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })

    const battle: TurnBattle = {
      players: [makeParticipant('player', player, 10, 0)],
      enemies: [makeParticipant('enemy', enemyEntity, 10, 1)],
      state: 'fighting',
    }

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()))

    system.resolveNextStep(battle)
    expect(battle.totalTurnsElapsed).toBe(1)

    system.resolveNextStep(battle)
    expect(battle.totalTurnsElapsed).toBe(2)
  })

  it('applies resource deltas to the acting participant at the start of their own turn', () => {
    const player = createCombatant({
      id: 'player',
      type: 'player',
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 999 },
    })
    const enemyEntity = createCombatant({
      id: 'enemy',
      currentHp: 1_000_000,
      maxHp: 1_000_000,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })

    const playerParticipant = makeParticipant('player', player, 10, 0)
    const resources = {
      values: { fixture_resource: 5 },
      deltasPerTurn: [{ stat: 'fixture_resource', amount: 2, min: 0, max: 10 }],
    }
    playerParticipant.resources = resources

    const battle: TurnBattle = {
      players: [playerParticipant],
      enemies: [makeParticipant('enemy', enemyEntity, 10, 1)],
      state: 'fighting',
    }

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()))
    system.resolveNextStep(battle)

    expect(resources.values.fixture_resource).toBe(7)
  })

  it('clamps the resource delta at max', () => {
    const player = createCombatant({
      id: 'player',
      type: 'player',
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 999 },
    })
    const enemyEntity = createCombatant({
      id: 'enemy',
      currentHp: 1_000_000,
      maxHp: 1_000_000,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })

    const playerParticipant = makeParticipant('player', player, 10, 0)
    const resources = {
      values: { fixture_resource: 9 },
      deltasPerTurn: [{ stat: 'fixture_resource', amount: 5, min: 0, max: 10 }],
    }
    playerParticipant.resources = resources

    const battle: TurnBattle = {
      players: [playerParticipant],
      enemies: [makeParticipant('enemy', enemyEntity, 10, 1)],
      state: 'fighting',
    }

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()))
    system.resolveNextStep(battle)

    expect(resources.values.fixture_resource).toBe(10)
  })

  it('does not tick a resource pool the participant does not have', () => {
    const player = createCombatant({
      id: 'player',
      type: 'player',
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 999 },
    })
    const enemyEntity = createCombatant({
      id: 'enemy',
      currentHp: 1_000_000,
      maxHp: 1_000_000,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })

    const battle: TurnBattle = {
      players: [makeParticipant('player', player, 10, 0)],
      enemies: [makeParticipant('enemy', enemyEntity, 10, 1)],
      state: 'fighting',
    }

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()))

    expect(() => system.resolveNextStep(battle)).not.toThrow()
  })
})

const ENRAGE_DEFINITION: TurnBuffDefinition = {
  id: 'fixture_enrage',
  name: 'Fixture Enrage',
  polarity: 'buff',
  duration: 999,
  stackMode: 'refresh',
  effects: [{ type: 'dot', dpsRatio: 0.1, element: 'physical' }],
}

describe('TurnBattleSystem.resolveNextStep boss trigger', () => {
  it('fires the boss trigger and applies the buff to self once totalTurnsElapsed reaches afterTurns', () => {
    const player = createCombatant({
      id: 'player',
      type: 'player',
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })
    const enemyEntity = createCombatant({
      id: 'enemy',
      currentHp: 1_000_000,
      maxHp: 1_000_000,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })

    const enemyParticipant = makeParticipant('enemy', enemyEntity, 10, 1)
    const bossTrigger = { afterTurns: 1, buffDefinitionId: 'fixture_enrage', firedAlready: false }
    enemyParticipant.bossTrigger = bossTrigger

    const battle: TurnBattle = {
      players: [makeParticipant('player', player, 10, 0)],
      enemies: [enemyParticipant],
      state: 'fighting',
    }

    const registry = new FixtureBuffRegistry([ENRAGE_DEFINITION])
    const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 10, registry)

    // Turn 1: player acts (totalTurnsElapsed becomes 1). Turn 2: enemy acts
    // (totalTurnsElapsed becomes 2, already >= afterTurns 1 by then).
    system.resolveNextStep(battle)
    system.resolveNextStep(battle)

    expect(bossTrigger.firedAlready).toBe(true)
    expect(enemyParticipant.buffs.getAll().some((buff) => buff.id === 'fixture_enrage')).toBe(true)
  })

  it('does not fire twice even after many more of the boss own turns', () => {
    const player = createCombatant({
      id: 'player',
      type: 'player',
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })
    const enemyEntity = createCombatant({
      id: 'enemy',
      currentHp: 1_000_000,
      maxHp: 1_000_000,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })

    const enemyParticipant = makeParticipant('enemy', enemyEntity, 10, 1)
    enemyParticipant.bossTrigger = { afterTurns: 1, buffDefinitionId: 'fixture_enrage', firedAlready: false }

    const battle: TurnBattle = {
      players: [makeParticipant('player', player, 10, 0)],
      enemies: [enemyParticipant],
      state: 'fighting',
    }

    const registry = new FixtureBuffRegistry([ENRAGE_DEFINITION])
    const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 10, registry)

    for (let i = 0; i < 6; i++) {
      system.resolveNextStep(battle)
    }

    const afterBuffs = enemyParticipant.buffs.getAll().filter((buff) => buff.id === 'fixture_enrage')

    expect(afterBuffs).toHaveLength(1)
  })

  it('does not fire before totalTurnsElapsed reaches afterTurns', () => {
    const player = createCombatant({
      id: 'player',
      type: 'player',
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })
    const enemyEntity = createCombatant({
      id: 'enemy',
      currentHp: 1_000_000,
      maxHp: 1_000_000,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })

    const enemyParticipant = makeParticipant('enemy', enemyEntity, 10, 1)
    const bossTrigger = { afterTurns: 999, buffDefinitionId: 'fixture_enrage', firedAlready: false }
    enemyParticipant.bossTrigger = bossTrigger

    const battle: TurnBattle = {
      players: [makeParticipant('player', player, 10, 0)],
      enemies: [enemyParticipant],
      state: 'fighting',
    }

    const registry = new FixtureBuffRegistry([ENRAGE_DEFINITION])
    const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 10, registry)

    system.resolveNextStep(battle)
    system.resolveNextStep(battle)

    expect(bossTrigger.firedAlready).toBe(false)
    expect(enemyParticipant.buffs.getAll()).toEqual([])
  })

  it('does not throw and does not fire when no registry was provided', () => {
    const player = createCombatant({
      id: 'player',
      type: 'player',
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })
    const enemyEntity = createCombatant({
      id: 'enemy',
      currentHp: 1_000_000,
      maxHp: 1_000_000,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })

    const enemyParticipant = makeParticipant('enemy', enemyEntity, 10, 1)
    const bossTrigger = { afterTurns: 1, buffDefinitionId: 'fixture_enrage', firedAlready: false }
    enemyParticipant.bossTrigger = bossTrigger

    const battle: TurnBattle = {
      players: [makeParticipant('player', player, 10, 0)],
      enemies: [enemyParticipant],
      state: 'fighting',
    }

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()))

    expect(() => {
      system.resolveNextStep(battle)
      system.resolveNextStep(battle)
    }).not.toThrow()

    expect(bossTrigger.firedAlready).toBe(false)
  })

  it('fires real production boss enrage content (mortal_crocodile_enrage) after 60 turns', () => {
    // Player must survive ~600 boss turns while dealing no damage, so it
    // gets a huge HP pool and zero attack. NOTE: totalTurnsElapsed only
    // increments when an actor actually acts, and gauge build-up means the
    // speed-100 boss acts roughly once every 10 resolveNextStep calls —
    // hence the 650-call loop (60 boss turns + margin), not the naive 61.
    const player = createCombatant({
      id: 'player',
      type: 'player',
      currentHp: 1_000_000,
      maxHp: 1_000_000,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })

    const bossEnemy = defineEnemy({
      id: 'test_boss',
      name: 'Test Boss',
      level: 1,
      realmId: 'mortal',
      lane: 'ground',
      statsInput: {
        maxHp: 1_000_000,
        attack: 10,
        attackSpeed: 1,
        attackRangeRanks: 1,
        criticalRate: 0,
        criticalDamage: 1.5,
        armor: 0,
        evasionRate: 0,
      },
      rewards: { techniqueInsight: 1, spiritStone: 1 },
      bossTrigger: { afterTurns: 60, buffDefinitionId: 'mortal_crocodile_enrage' },
    })

    const basicSkill: TurnSkillDefinition = {
      id: 'fixture_basic',
      cooldownTurns: 0,
      damage: { kind: 'physical' as const, multiplier: 1 },
      targeting: { shape: 'single' as const },
    }

    const enemyParticipant = toTurnBattleParticipant(enemyToCombatEntity(bossEnemy), 1, basicSkill)

    const battle: TurnBattle = {
      players: [makeParticipant('player', player, 10, 0)],
      enemies: [enemyParticipant],
      state: 'fighting',
    }

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 10, TURN_BUFF_REGISTRY)

    for (let i = 0; i < 650; i++) {
      system.resolveNextStep(battle)
    }

    expect(enemyParticipant.bossTrigger?.firedAlready).toBe(true)
    expect(enemyParticipant.buffs.getAll().some((buff) => buff.id === 'mortal_crocodile_enrage')).toBe(true)
  })
})

describe('TurnBattleSystem.tickPacing wave-batch spawning', () => {
  it('spawns an entire wave as pending telegraphs once the arena is empty, not one at a time', () => {
    const player = createCombatant({
      id: 'player',
      type: 'player',
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })

    const wave = { totalEnemyCount: 3, spawnedCount: 0, waves: [3], waveIndex: 0, pendingEnemySpawns: [] }
    const battle: TurnBattle = {
      players: [makeParticipant('player', player, 10, 0)],
      enemies: [],
      state: 'fighting',
      wave,
    }

    let spawnCalls = 0
    const spawnEnemy = (): TurnBattleParticipant => {
      spawnCalls += 1

      const enemy = createCombatant({
        id: `enemy${spawnCalls}`,
        currentHp: 10,
        maxHp: 10,
        stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
      })

      return makeParticipant(`enemy${spawnCalls}`, enemy, 10, 1)
    }

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 20, undefined, spawnEnemy)

    system.tickPacing(battle)

    expect(spawnCalls).toBe(3)
    expect(wave.spawnedCount).toBe(3)
    expect(wave.waveIndex).toBe(1)
    expect(wave.pendingEnemySpawns).toHaveLength(3)
    expect(battle.enemies).toHaveLength(0)
  })

  it('materializes a pending enemy into battle.enemies only after its telegraph ticks reach 0', () => {
    const player = createCombatant({
      id: 'player',
      type: 'player',
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })
    const enemy = createCombatant({
      id: 'enemy1',
      currentHp: 10,
      maxHp: 10,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })
    const pendingParticipant = makeParticipant('enemy1', enemy, 10, 1)

    const wave = {
      totalEnemyCount: 1,
      spawnedCount: 1,
      waves: [1],
      waveIndex: 1,
      pendingEnemySpawns: [{ participant: pendingParticipant, ticksRemaining: 2, totalTicks: 8 }],
    }
    const battle: TurnBattle = {
      players: [makeParticipant('player', player, 10, 0)],
      enemies: [],
      state: 'fighting',
      wave,
    }

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()))

    system.tickPacing(battle)
    expect(battle.enemies).toHaveLength(0)
    expect(wave.pendingEnemySpawns[0]!.ticksRemaining).toBe(1)

    system.tickPacing(battle)
    expect(battle.enemies).toHaveLength(1)
    expect(battle.enemies[0]!.id).toBe('enemy1')
    expect(wave.pendingEnemySpawns).toHaveLength(0)
  })

  it('does not start wave 2 until wave 1 is both dead AND fully materialized (no pending left)', () => {
    const player = createCombatant({
      id: 'player',
      type: 'player',
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })

    const wave = { totalEnemyCount: 2, spawnedCount: 1, waves: [1, 1], waveIndex: 1, pendingEnemySpawns: [] }
    const battle: TurnBattle = {
      players: [makeParticipant('player', player, 10, 0)],
      enemies: [],
      state: 'fighting',
      wave,
    }

    let spawnCalls = 0
    const spawnEnemy = (): TurnBattleParticipant => {
      spawnCalls += 1

      const enemy = createCombatant({
        id: `enemy${spawnCalls}`,
        currentHp: 10,
        maxHp: 10,
        stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
      })

      return makeParticipant(`enemy${spawnCalls}`, enemy, 10, 1)
    }

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 20, undefined, spawnEnemy)

    // Arena empty, waveIndex=1 < waveCount=2 -> wave 2 starts immediately
    // (nothing from wave 1 was ever pushed into battle.enemies here, so
    // this simulates "wave 1 already fully cleared before this tick").
    system.tickPacing(battle)

    expect(spawnCalls).toBe(1)
    expect(wave.waveIndex).toBe(2)
    expect(wave.pendingEnemySpawns).toHaveLength(1)

    // waveIndex now 2 === waveCount 2 -> no further wave starts even
    // though arena is still empty (pending just queued, not yet alive).
    system.tickPacing(battle)
    expect(spawnCalls).toBe(1)
  })

  it('behaves exactly like Slices 1-4 when wave is not set (no regression)', () => {
    const player = createCombatant({
      id: 'player',
      type: 'player',
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 999 },
    })
    const enemyEntity = createCombatant({
      id: 'enemy',
      currentHp: 1,
      maxHp: 1,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })

    const battle: TurnBattle = {
      players: [makeParticipant('player', player, 10, 0)],
      enemies: [makeParticipant('enemy', enemyEntity, 10, 1)],
      state: 'fighting',
    }

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()))
    system.resolveNextStep(battle)

    expect(battle.state).toBe('victory')
    expect(battle.enemies).toHaveLength(1)
  })

  it('freezes and resets gauges when the arena is empty but more enemies are coming', () => {
    const player = createCombatant({
      id: 'player',
      type: 'player',
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })

    const battle: TurnBattle = {
      players: [makeParticipant('player', player, 10, 0)],
      enemies: [],
      state: 'fighting',
      wave: {
        totalEnemyCount: 3,
        spawnedCount: 1,
        waves: [3],
        waveIndex: 1,
        pendingEnemySpawns: [
          { participant: makeParticipant('enemy1', createCombatant({ id: 'enemy1' }), 10, 1), ticksRemaining: 5, totalTicks: 8 },
        ],
      },
    }

    battle.players[0]!.actionGauge = GAUGE_MAX - 1

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()))

    const ready = system.tickPacing(battle)

    expect(ready).toBeNull()
    expect(battle.players[0]!.actionGauge).toBe(0)
  })

const LONG_STUN_DEFINITION: TurnBuffDefinition = {
  id: 'fixture_long_stun',
  name: 'Fixture Long Stun',
  polarity: 'debuff',
  duration: 100,
  stackMode: 'refresh',
  effects: [{ type: 'cc', ccEffect: 'stun' }],
}

describe('TurnBattleSystem.resolveNextStep Bï¿½ Th? (CC-lock guard)', () => {
  function stunnedBattle() {
    const player = createCombatant({
      id: 'player',
      type: 'player',
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 999 },
    })
    const enemyEntity = createCombatant({
      id: 'enemy',
      currentHp: 1_000_000,
      maxHp: 1_000_000,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })

    const playerParticipant = makeParticipant('player', player, 10, 0)
    playerParticipant.basic = {
      id: 'fixture_basic',
      cooldownTurns: 0,
      damage: { kind: 'physical', multiplier: 1 },
      targeting: { shape: 'single' },
    }

    const registry = new FixtureBuffRegistry([LONG_STUN_DEFINITION])
    const enemyParticipant = makeParticipant('enemy', enemyEntity, 10, 1)

    const battle: TurnBattle = {
      players: [playerParticipant],
      enemies: [enemyParticipant],
      state: 'fighting',
    }

    // Applied ONCE ï¿½ duration 100 means it cannot expire within this
    // test's turn count, so every subsequent player turn stays hard-CC'd
    // without needing to reason about Slice 3's tick/expiry ordering.
    new TurnBuffSystem(playerParticipant.buffs).apply(LONG_STUN_DEFINITION, enemyEntity, player, registry)

    return { player, playerParticipant, enemyEntity, enemyParticipant, battle, registry }
  }

  it('blocks normally for the first 3 consecutive hard-CC turns, incrementing the counter', () => {
    const { playerParticipant, battle } = stunnedBattle()
    const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 10, undefined)

    for (let i = 0; i < 3; i++) {
      const step = system.resolveNextStep(battle) // player's turn (speed tie broken by priority: player priority 0 < enemy 1)
      expect(step.ccBlocked).toBe(true)
      expect(playerParticipant.consecutiveHardCcTurns).toBe(i + 1)
      system.resolveNextStep(battle) // enemy's turn, consumes the enemy's gauge tick
    }
  })

  it('fires Bï¿½ Th? on the 4th consecutive blocked turn: clears CC, actor acts, counter resets', () => {
    const { playerParticipant, battle } = stunnedBattle()
    const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 10, undefined)

    for (let i = 0; i < 3; i++) {
      system.resolveNextStep(battle) // player blocked, counter -> i+1
      system.resolveNextStep(battle) // enemy turn
    }

    const step = system.resolveNextStep(battle) // 4th consecutive blocked attempt ï¿½ Bï¿½ Th? should fire here

    expect(step.ccBlocked).toBe(false)
    expect(step.targetIds).toEqual(['enemy'])
    expect(playerParticipant.consecutiveHardCcTurns).toBe(0)
    expect(playerParticipant.buffs.getAll()).toEqual([])
    expect(playerParticipant.baTheTriggeredAtTurn).toBeDefined()
  })

  it('resets the counter to 0 the moment the actor is not CC-blocked on its own turn', () => {
    const player = createCombatant({
      id: 'player',
      type: 'player',
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 999 },
    })
    const enemyEntity = createCombatant({
      id: 'enemy',
      currentHp: 1_000_000,
      maxHp: 1_000_000,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })

    const playerParticipant = makeParticipant('player', player, 10, 0)
    playerParticipant.basic = {
      id: 'fixture_basic',
      cooldownTurns: 0,
      damage: { kind: 'physical', multiplier: 1 },
      targeting: { shape: 'single' },
    }
    // Simulates "already had 2 consecutive blocked turns" WITHOUT applying
    // any CC buff ï¿½ isolates the reset behavior from buff-timing entirely.
    playerParticipant.consecutiveHardCcTurns = 2

    const battle: TurnBattle = {
      players: [playerParticipant],
      enemies: [makeParticipant('enemy', enemyEntity, 10, 1)],
      state: 'fighting',
    }

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()))
    const step = system.resolveNextStep(battle) // player's turn, not CC'd (no buff applied)

    expect(step.ccBlocked).toBe(false)
    expect(playerParticipant.consecutiveHardCcTurns).toBe(0)
  })
})

describe('TurnBattleSystem.resolveNextStep Sudden Death escalation', () => {
  function bareBattle(totalTurnsElapsed: number) {
    // blockChance: 0 â€” test so sÃ¡nh damage tuyá»‡t Ä‘á»‘i giá»¯a 2 runs; block
    // lÃ  roll 5% ngáº«u nhiÃªn (blockChance base 0.05) sáº½ lÃ m test flaky.
    const player = createCombatant({
      id: 'player',
      type: 'player',
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, blockChance: 0, attack: 100 },
    })
    const enemyEntity = createCombatant({
      id: 'enemy',
      currentHp: 1_000_000,
      maxHp: 1_000_000,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, blockChance: 0, attack: 0, defense: 0 },
    })

    const playerParticipant = makeParticipant('player', player, 10, 0)
    playerParticipant.basic = {
      id: 'fixture_basic',
      cooldownTurns: 0,
      damage: { kind: 'physical', multiplier: 1 },
      targeting: { shape: 'single' },
    }

    const battle: TurnBattle = {
      players: [playerParticipant],
      enemies: [makeParticipant('enemy', enemyEntity, 10, 1)],
      state: 'fighting',
      totalTurnsElapsed,
    }

    return { player, enemyEntity, battle }
  }

  it('deals unscaled damage (x1) when totalTurnsElapsed is 10 or below', () => {
    const { enemyEntity, battle } = bareBattle(9) // becomes 10 after this step's own increment
    const system = new TurnBattleSystem(new CombatSystem(new EventBus()))
    const hpBefore = enemyEntity.currentHp

    system.resolveNextStep(battle)

    const rawDamageDealt = hpBefore - enemyEntity.currentHp
    expect(battle.totalTurnsElapsed).toBe(10)
    // At exactly turn 10, Sudden Death has not started yet (starts turn 11) ï¿½ damage is the normal, unscaled amount.
    // (Exact expected HP delta depends on calculateBaseDamage's real formula ï¿½ assert only that it's the SAME
    // as a control run at turn 1, not a hardcoded number, to avoid coupling this test to damage-formula internals.)
    const { enemyEntity: controlEnemy, battle: controlBattle } = bareBattle(0)
    const controlHpBefore = controlEnemy.currentHp
    system.resolveNextStep(controlBattle)
    const controlDamage = controlHpBefore - controlEnemy.currentHp

    expect(rawDamageDealt).toBe(controlDamage)
  })

  it('scales damage by x1.3 at turn 11 (first Sudden Death turn)', () => {
    const { enemyEntity, battle } = bareBattle(10) // becomes 11 after this step's own increment
    const system = new TurnBattleSystem(new CombatSystem(new EventBus()))
    const hpBefore = enemyEntity.currentHp

    system.resolveNextStep(battle)

    const scaledDamage = hpBefore - enemyEntity.currentHp

    const { enemyEntity: controlEnemy, battle: controlBattle } = bareBattle(0)
    const controlHpBefore = controlEnemy.currentHp
    system.resolveNextStep(controlBattle)
    const baseDamage = controlHpBefore - controlEnemy.currentHp

    expect(battle.totalTurnsElapsed).toBe(11)
    // Endurance cá»§a há»‡ sá»‘ng trá»« PHáº²NG thresholdÃ—percent = 10Ã—0.7 = 7 SAU
    // scale (má»i Ä‘Ã²n > threshold), nÃªn scaled = baseÃ—m âˆ’ 7, khÃ´ng pháº£i
    // baseÃ—m nguyÃªn váº¹n (plan test gá»‘c Ä‘Ã£ bá» qua táº§ng endurance nÃ y).
    const enduranceFlat = (10 * 0.7)
    expect(scaledDamage).toBeCloseTo((baseDamage + enduranceFlat) * 1.3 - enduranceFlat, 1)
  })

  it('scales damage by x2.5 at turn 15 (linear, additive: 1 + 0.3*(15-10))', () => {
    const { enemyEntity, battle } = bareBattle(14) // becomes 15 after this step's own increment
    const system = new TurnBattleSystem(new CombatSystem(new EventBus()))
    const hpBefore = enemyEntity.currentHp

    system.resolveNextStep(battle)

    const scaledDamage = hpBefore - enemyEntity.currentHp

    const { enemyEntity: controlEnemy, battle: controlBattle } = bareBattle(0)
    const controlHpBefore = controlEnemy.currentHp
    system.resolveNextStep(controlBattle)
    const baseDamage = controlHpBefore - controlEnemy.currentHp

    const enduranceFlat = (10 * 0.7)
    expect(scaledDamage).toBeCloseTo((baseDamage + enduranceFlat) * 2.5 - enduranceFlat, 1)
  })
})

describe('TurnBattleSystem multi-target death-mid-resolution hardening', () => {
  it('does not apply a second hit to a target already killed by an earlier hit in the same AOE skill', () => {
    const player = createCombatant({
      id: 'player',
      type: 'player',
      row: 4,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 999999 },
    })
    const enemyA = createCombatant({
      id: 'enemyA',
      row: 4,
      x: 1,
      currentHp: 1,
      maxHp: 1,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })
    const enemyB = createCombatant({
      id: 'enemyB',
      row: 4,
      x: 2,
      currentHp: 1_000_000,
      maxHp: 1_000_000,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })

    const playerParticipant = makeParticipant('player', player, 10, 0)
    playerParticipant.basic = {
      id: 'fixture_aoe_basic',
      cooldownTurns: 0,
      damage: { kind: 'physical', multiplier: 1 },
      targeting: { shape: 'row' },
    }
    const battle: TurnBattle = {
      players: [playerParticipant],
      enemies: [makeParticipant('enemyA', enemyA, 10, 1), makeParticipant('enemyB', enemyB, 10, 2)],
      state: 'fighting',
    }

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()))
    const step = system.resolveNextStep(battle)

    expect(enemyA.currentHp).toBe(0)
    expect(enemyA.alive).toBe(false)
    expect(step.targetIds.filter((id) => id === 'enemyA')).toHaveLength(1)
  })
})

describe('TurnBattleSystem hpRegenPerTurn', () => {
  it("regenerates HP by the actor's hpRegenPerTurn stat at the start of their own turn, clamped to maxHp", () => {
    const player = createCombatant({
      id: 'player',
      type: 'player',
      currentHp: 50,
      maxHp: 100,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0, hpRegenPerTurn: 10 },
    })
    const enemyEntity = createCombatant({
      id: 'enemy',
      currentHp: 1_000_000,
      maxHp: 1_000_000,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })

    const battle: TurnBattle = {
      players: [makeParticipant('player', player, 10, 0)],
      enemies: [makeParticipant('enemy', enemyEntity, 10, 1)],
      state: 'fighting',
    }

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()))
    system.resolveNextStep(battle)

    expect(player.currentHp).toBe(60)
  })

  it('clamps regen to maxHp, never overhealing', () => {
    const player = createCombatant({
      id: 'player',
      type: 'player',
      currentHp: 95,
      maxHp: 100,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0, hpRegenPerTurn: 10 },
    })
    const enemyEntity = createCombatant({
      id: 'enemy',
      currentHp: 1_000_000,
      maxHp: 1_000_000,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })

    const battle: TurnBattle = {
      players: [makeParticipant('player', player, 10, 0)],
      enemies: [makeParticipant('enemy', enemyEntity, 10, 1)],
      state: 'fighting',
    }

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()))
    system.resolveNextStep(battle)

    expect(player.currentHp).toBe(100)
  })
})

describe('TurnBattleSystem countdown phase (unified flow)', () => {
  function countdownBattle(countdownTurns: number): TurnBattle {
    const player = createCombatant({
      id: 'player',
      type: 'player',
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, blockChance: 0, attack: 999 },
    })
    const enemyEntity = createCombatant({
      id: 'enemy',
      currentHp: 1_000_000,
      maxHp: 1_000_000,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, blockChance: 0, attack: 0 },
    })

    return {
      players: [makeParticipant('player', player, 10, 0)],
      enemies: [makeParticipant('enemy', enemyEntity, 10, 1)],
      state: 'countdown',
      countdownTurnsRemaining: countdownTurns,
    }
  }

  it('resolveNextStep is a safe no-op during countdown (no combat, state unchanged)', () => {
    const battle = countdownBattle(3)
    const system = new TurnBattleSystem(new CombatSystem(new EventBus()))

    const step = system.resolveNextStep(battle)

    expect(step.state).toBe('countdown')
    expect(step.actorId).toBe('')
    expect(step.targetIds).toEqual([])
    expect(battle.state).toBe('countdown')
    expect(battle.enemies[0]!.entity.currentHp).toBe(1_000_000)
  })

  it('tickCountdown decrements and flips to fighting at 0', () => {
    const battle = countdownBattle(2)
    const system = new TurnBattleSystem(new CombatSystem(new EventBus()))

    expect(system.tickCountdown(battle)).toBe('countdown')
    expect(battle.countdownTurnsRemaining).toBe(1)
    expect(battle.state).toBe('countdown')

    expect(system.tickCountdown(battle)).toBe('fighting')
    expect(battle.countdownTurnsRemaining).toBe(0)
    expect(battle.state).toBe('fighting')
  })

  it('after countdown reaches fighting, combat resolves normally (full flow: countdown -> gauge combat)', () => {
    const battle = countdownBattle(1)
    const system = new TurnBattleSystem(new CombatSystem(new EventBus()))

    system.tickCountdown(battle)
    expect(battle.state).toBe('fighting')

    const step = system.resolveNextStep(battle)
    expect(step.state).toBe('fighting')
    expect(step.actorId).toBe('player')
    expect(step.targetIds).toEqual(['enemy'])
  })

  it('tickCountdown on a non-countdown battle is a no-op passthrough', () => {
    const battle = countdownBattle(0)
    battle.state = 'fighting'

    expect(system_tickCountdownPassthrough(battle, new TurnBattleSystem(new CombatSystem(new EventBus())))).toBe('fighting')
  })
})

function system_tickCountdownPassthrough(battle: TurnBattle, system: TurnBattleSystem): TurnBattleState {
  return system.tickCountdown(battle)
}

// ---------------------------------------------------------------------------
// Slice 7 (Completion Task 10) â€” peekNextActor / resolveActorTurn split
// ---------------------------------------------------------------------------

describe('TurnBattleSystem.peekNextActor', () => {
  it('returns the next ready actor WITHOUT resolving anything (no turn consumed, state unchanged)', () => {
    const player = createCombatant({
      id: 'player',
      type: 'player',
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 999 },
    })
    const enemyEntity = createCombatant({
      id: 'enemy',
      currentHp: 1_000_000,
      maxHp: 1_000_000,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })

    const battle: TurnBattle = {
      players: [makeParticipant('player', player, 10, 0)],
      enemies: [makeParticipant('enemy', enemyEntity, 10, 1)],
      state: 'fighting',
    }

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()))
    const actor = system.peekNextActor(battle)

    expect(actor?.id).toBe('player')
    expect(battle.totalTurnsElapsed ?? 0).toBe(0)
    expect(battle.state).toBe('fighting')
    expect(enemyEntity.currentHp).toBe(1_000_000)
  })

  it('peek is idempotent until resolved â€” calling twice returns the same actor', () => {
    const player = createCombatant({
      id: 'player',
      type: 'player',
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 999 },
    })
    const enemyEntity = createCombatant({
      id: 'enemy',
      currentHp: 1_000_000,
      maxHp: 1_000_000,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })

    const battle: TurnBattle = {
      players: [makeParticipant('player', player, 10, 0)],
      enemies: [makeParticipant('enemy', enemyEntity, 10, 1)],
      state: 'fighting',
    }

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()))

    expect(system.peekNextActor(battle)?.id).toBe('player')
    expect(system.peekNextActor(battle)?.id).toBe('player')
  })

  it('returns null when no living combatant remains', () => {
    const player = createCombatant({
      id: 'player',
      type: 'player',
      alive: false,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })
    const enemyEntity = createCombatant({
      id: 'enemy',
      alive: false,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })

    const battle: TurnBattle = {
      players: [makeParticipant('player', player, 10, 0)],
      enemies: [makeParticipant('enemy', enemyEntity, 10, 1)],
      state: 'fighting',
    }

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()))

    expect(system.peekNextActor(battle)).toBeNull()
  })
})

describe('TurnBattleSystem.resolveActorTurn', () => {
  it('resolveNextStep sau khi battle káº¿t thÃºc (victory) giá»¯ nguyÃªn state, KHÃ”NG ghi Ä‘Ã¨ thÃ nh defeat', () => {
    const player = createCombatant({
      id: 'player',
      type: 'player',
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 999 },
    })
    const enemyEntity = createCombatant({
      id: 'enemy',
      currentHp: 1,
      maxHp: 1,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })

    const battle: TurnBattle = {
      players: [makeParticipant('player', player, 10, 0)],
      enemies: [makeParticipant('enemy', enemyEntity, 10, 1)],
      state: 'fighting',
    }

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()))

    expect(system.resolveNextStep(battle).state).toBe('victory')

    // Caller gá»i thá»«a 1 láº§n sau victory (fixed-step loop cÃ³ thá»ƒ trÃ´i 1 tick
    // trÆ°á»›c khi GameManager dá»«ng) â€” state pháº£i giá»¯ nguyÃªn victory.
    expect(system.resolveNextStep(battle).state).toBe('victory')
    expect(battle.state).toBe('victory')
  })
  it('resolves the given actor exactly like resolveNextStep would (buff tick, action, gauge consume, wave spawn)', () => {
    const player = createCombatant({
      id: 'player',
      type: 'player',
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 999 },
    })
    const enemyEntity = createCombatant({
      id: 'enemy',
      currentHp: 1,
      maxHp: 1,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })

    const battle: TurnBattle = {
      players: [makeParticipant('player', player, 10, 0)],
      enemies: [makeParticipant('enemy', enemyEntity, 10, 1)],
      state: 'fighting',
    }

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()))
    const actor = system.peekNextActor(battle)

    expect(actor).not.toBeNull()

    const step = system.resolveActorTurn(battle, actor!)

    expect(step.state).toBe('victory')
    expect(step.actorId).toBe('player')
    expect(enemyEntity.currentHp).toBe(0)
    expect(battle.totalTurnsElapsed).toBe(1)
  })

  it('forcedSkillSlot overrides auto priority when the slot is ready (special instead of ultimate)', () => {
    const player = createCombatant({
      id: 'player',
      type: 'player',
      currentMp: 100,
      stats: {
        ...createBaseStats(),
        evasionRate: 0,
        dexterity: 0,
        criticalRate: 0,
        attack: 999,
        maxMp: 100,
      },
    })
    const enemyEntity = createCombatant({
      id: 'enemy',
      currentHp: 10_000,
      maxHp: 10_000,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })

    const playerParticipant = makeParticipant('player', player, 10, 0)
    playerParticipant.basic = {
      id: 'fixture_basic',
      cooldownTurns: 0,
      damage: { kind: 'physical', multiplier: 1 },
      targeting: { shape: 'single' },
    }
    playerParticipant.special = {
      skill: {
        id: 'fixture_special',
        cooldownTurns: 5,
        resourceType: 'mana',
        resourceCost: 10,
        damage: { kind: 'physical', multiplier: 2 },
        targeting: { shape: 'single' },
      },
      remainingCooldownTurns: 0,
    }
    playerParticipant.ultimate = {
      skill: {
        id: 'fixture_ultimate',
        cooldownTurns: 5,
        resourceType: 'mana',
        resourceCost: 10,
        damage: { kind: 'physical', multiplier: 9 },
        targeting: { shape: 'single' },
      },
      remainingCooldownTurns: 0,
    }

    const battle: TurnBattle = {
      players: [playerParticipant],
      enemies: [makeParticipant('enemy', enemyEntity, 10, 1)],
      state: 'fighting',
    }

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()))
    const actor = system.peekNextActor(battle)

    expect(actor).not.toBeNull()

    const step = system.resolveActorTurn(battle, actor!, 'special')

    expect(step.skillId).toBe('fixture_special')
    // resource consumed by the forced cast
    expect(player.currentMp).toBe(90)
  })

  it('an UNREADY forced slot is silently ignored in favor of normal priority (defensive backstop, not an error)', () => {
    const player = createCombatant({
      id: 'player',
      type: 'player',
      currentMp: 100,
      stats: {
        ...createBaseStats(),
        evasionRate: 0,
        dexterity: 0,
        criticalRate: 0,
        attack: 999,
        maxMp: 100,
      },
    })
    const enemyEntity = createCombatant({
      id: 'enemy',
      currentHp: 10_000,
      maxHp: 10_000,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })

    const playerParticipant = makeParticipant('player', player, 10, 0)
    playerParticipant.basic = {
      id: 'fixture_basic',
      cooldownTurns: 0,
      damage: { kind: 'physical', multiplier: 1 },
      targeting: { shape: 'single' },
    }
    playerParticipant.special = {
      skill: {
        id: 'fixture_special',
        cooldownTurns: 5,
        resourceType: 'mana',
        resourceCost: 10,
        damage: { kind: 'physical', multiplier: 2 },
        targeting: { shape: 'single' },
      },
      remainingCooldownTurns: 2, // ON cooldown â€” unready
    }

    const battle: TurnBattle = {
      players: [playerParticipant],
      enemies: [makeParticipant('enemy', enemyEntity, 10, 1)],
      state: 'fighting',
    }

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()))
    const actor = system.peekNextActor(battle)

    const step = system.resolveActorTurn(battle, actor!, 'special')

    // special unready â†’ forced slot ignored â†’ normal priority â†’ basic
    expect(step.skillId).toBe('fixture_basic')
    // resource NOT consumed (special was never cast)
    expect(player.currentMp).toBe(100)
  })

  it('resolveNextStep still behaves identically (thin wrapper: peek + resolve with no forced slot)', () => {
    const player = createCombatant({
      id: 'player',
      type: 'player',
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 999 },
    })
    const enemyEntity = createCombatant({
      id: 'enemy',
      currentHp: 1,
      maxHp: 1,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })

    const battle: TurnBattle = {
      players: [makeParticipant('player', player, 10, 0)],
      enemies: [makeParticipant('enemy', enemyEntity, 10, 1)],
      state: 'fighting',
    }

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()))
    const step = system.resolveNextStep(battle)

    expect(step.state).toBe('victory')
    expect(step.actorId).toBe('player')
  })
})


// ---------------------------------------------------------------------------
// Future Systems Task 5 â€” Reaction Path double-cast (special marker)
// ---------------------------------------------------------------------------

describe('TurnBattleSystem special role â€” Reaction Path double-cast', () => {
  function reactionBattleFixture() {
    const player = createCombatant({
      id: 'player',
      type: 'player',
      currentMp: 100,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 100, maxMp: 100 },
    })
    const enemyEntity = createCombatant({
      id: 'enemy',
      currentHp: 1_000_000,
      maxHp: 1_000_000,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })

    const playerParticipant = makeParticipant('player', player, 10, 0)

    playerParticipant.special = {
      skill: {
        id: 'phap_tu_reaction_special',
        cooldownTurns: 4,
        resourceType: 'mana',
        resourceCost: 10,
        damage: { kind: 'physical', multiplier: 0 },
        targeting: { shape: 'single' },
      },
      remainingCooldownTurns: 0,
    }

    playerParticipant.basic = {
      id: 'fixture_basic',
      cooldownTurns: 0,
      damage: { kind: 'physical', multiplier: 1 },
      targeting: { shape: 'single' },
    }

    const battle: TurnBattle = {
      players: [playerParticipant],
      enemies: [makeParticipant('enemy', enemyEntity, 10, 1)],
      state: 'fighting',
    }

    return { battle, enemyEntity }
  }

  it('special marker â†’ 2 resolveActionHit vá»›i 2 element KHÃC nhau (pool inject qua constructor)', () => {
    const { battle } = reactionBattleFixture()

    const pool: TurnSkillDefinition[] = [
      { id: 'p_fire', cooldownTurns: 0, damage: { kind: 'elemental', multiplier: 1, components: [{ kind: 'element', element: 'fire', ratio: 1 }] }, targeting: { shape: 'single' } },
      { id: 'p_water', cooldownTurns: 0, damage: { kind: 'elemental', multiplier: 1, components: [{ kind: 'element', element: 'water', ratio: 1 }] }, targeting: { shape: 'single' } },
    ]

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 10_000, undefined, undefined, pool)

    const step = system.resolveNextStep(battle)

    expect(step.skillId).toBe('phap_tu_reaction_special')
    // Double-cast: 2 hit push 2 targetIds (cÃ¹ng target â€” single targeting)
    expect(step.targetIds).toEqual(['enemy', 'enemy'])
  })

  it('marker mÃ  KHÃ”NG cÃ³ pool â†’ fallback 0 hit (placeholder damage, khÃ´ng crash)', () => {
    const { battle } = reactionBattleFixture()

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()))

    const step = system.resolveNextStep(battle)

    expect(step.skillId).toBe('phap_tu_reaction_special')
    expect(step.targetIds).toEqual([])
  })
})


// ---------------------------------------------------------------------------
// Future Systems Task 6 â€” gauge-delta buff effect (one-shot ATB push)
// ---------------------------------------------------------------------------

describe('TurnBattleSystem gauge-delta buff (one-shot)', () => {
  function gaugeFixture(percentOfMax: number) {
    const player = createCombatant({
      id: 'player',
      type: 'player',
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 100 },
    })
    const enemyEntity = createCombatant({
      id: 'enemy',
      currentHp: 1_000_000,
      maxHp: 1_000_000,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })

    const playerParticipant = makeParticipant('player', player, 10, 0)
    playerParticipant.basic = {
      id: 'fixture_basic',
      cooldownTurns: 0,
      damage: { kind: 'physical', multiplier: 1 },
      targeting: { shape: 'single' },
      appliesBuff: { definitionId: 'fixture_haste', target: 'self' },
    }

    const battle: TurnBattle = {
      players: [playerParticipant],
      enemies: [makeParticipant('enemy', enemyEntity, 10, 1)],
      state: 'fighting',
    }

    const registry: TurnBuffRegistry = {
      get: (id) => {
        if (id !== 'fixture_haste') throw new Error(`unknown buff ${id}`)
        return {
          id: 'fixture_haste',
          name: 'Fixture Haste',
          polarity: 'buff',
          duration: 1,
          stackMode: 'refresh',
          effects: [{ type: 'gaugeDelta', percentOfMax }],
        }
      },
    }

    return { battle, registry, playerParticipant }
  }

  it('Ã¡p buff gaugeDelta +30% â†’ actionGauge = GAUGE_MAX Ã— 0.30 (one-shot sau consume=0)', () => {
    const { battle, registry } = gaugeFixture(30)
    const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 10_000, registry)

    system.resolveNextStep(battle)

    expect(battle.players[0]!.actionGauge).toBeCloseTo(GAUGE_MAX * 0.3, 0)
  })

  it('percentOfMax lá»›n clamp táº¡i GAUGE_MAX, khÃ´ng overshoot', () => {
    const { battle, registry } = gaugeFixture(500)
    const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 10_000, registry)

    system.resolveNextStep(battle)

    expect(battle.players[0]!.actionGauge).toBe(GAUGE_MAX)
  })
})


// ---------------------------------------------------------------------------
// Future Systems Task 7 — channel/charge skill primitive (Thế/Trảm)
// ---------------------------------------------------------------------------

describe('TurnBattleSystem charge skill (Thế/Trảm)', () => {
  function chargeFixture() {
    const player = createCombatant({
      id: 'player',
      type: 'player',
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 100 },
    })
    const enemyEntity = createCombatant({
      id: 'enemy',
      currentHp: 1_000_000,
      maxHp: 1_000_000,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })

    const playerParticipant = makeParticipant('player', player, 10, 0)

    playerParticipant.special = {
      skill: {
        id: 'fixture_charge',
        cooldownTurns: 5,
        chargeTurns: 2,
        damage: { kind: 'physical', multiplier: 6 },
        targeting: { shape: 'single' },
      },
      remainingCooldownTurns: 0,
    }

    playerParticipant.basic = {
      id: 'fixture_basic',
      cooldownTurns: 0,
      damage: { kind: 'physical', multiplier: 1 },
      targeting: { shape: 'single' },
    }

    const battle: TurnBattle = {
      players: [playerParticipant],
      enemies: [makeParticipant('enemy', enemyEntity, 10, 1)],
      state: 'fighting',
    }

    return { battle, enemyEntity, playerParticipant }
  }

  it('cast chargeTurns=2 → lượt cast KHÔNG hit (bắt đầu charge), 2 lượt sau charge xong tự resolve', () => {
    const { battle, enemyEntity } = chargeFixture()
    const system = new TurnBattleSystem(new CombatSystem(new EventBus()))

    // Lượt 1 (player): bắt đầu charge — không hit
    const step1 = system.resolveNextStep(battle)

    expect(step1.skillId).toBe('fixture_charge')
    expect(step1.targetIds).toEqual([])
    expect(battle.players[0]!.chargingTurnsRemaining).toBe(2)
    expect(battle.players[0]!.pendingChargedSkillId).toBe('fixture_charge')

    // Lượt 2 (enemy tự chạy) — player chưa tới lượt
    system.resolveNextStep(battle)

    // Lượt 3 (player): charge đếm 2→1 — vẫn không hit
    const step3 = system.resolveNextStep(battle)

    expect(battle.players[0]!.chargingTurnsRemaining).toBe(1)
    expect(step3.targetIds).toEqual([])

    // Lượt 4 (enemy)
    system.resolveNextStep(battle)

    // Lượt 5 (player): charge xong — resolve đòn thật
    const hpBefore = enemyEntity.currentHp
    const step5 = system.resolveNextStep(battle)

    expect(step5.skillId).toBe('fixture_charge')
    expect(step5.targetIds).toEqual(['enemy'])
    expect(enemyEntity.currentHp).toBeLessThan(hpBefore)
    expect(battle.players[0]!.chargingTurnsRemaining).toBeUndefined()
  })

  it('charge KHÔNG đụng consecutiveHardCcTurns (tách biệt CC Bá Thể)', () => {
    const { battle } = chargeFixture()
    const system = new TurnBattleSystem(new CombatSystem(new EventBus()))

    system.resolveNextStep(battle) // start charge
    system.resolveNextStep(battle) // enemy
    system.resolveNextStep(battle) // charge tick 1

    expect(battle.players[0]!.consecutiveHardCcTurns).toBe(0)
  })
})


// ---------------------------------------------------------------------------
// Gameplay fixes (2026-09-05) — wall-clock pacing: 1 tick = 1 gauge-step,
// KHÔNG resolve-scan trong cùng tick (bug: trận chớp mắt vì mỗi 0.1s tick
// resolve cả 1 turn nguyên).
// ---------------------------------------------------------------------------

describe('TurnBattleSystem.tickPacing — wall-clock pacing', () => {
  it('1 tick chỉ advance gauge speed điểm; actor KHÔNG resolve khi gauge chưa đầy', () => {
    const player = createCombatant({
      id: 'player',
      type: 'player',
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, speed: 100, attack: 999 },
    })
    const enemyEntity = createCombatant({
      id: 'enemy',
      currentHp: 1_000_000,
      maxHp: 1_000_000,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, speed: 100, attack: 0 },
    })

    const battle: TurnBattle = {
      players: [makeParticipant('player', player, 100, 0)],
      enemies: [makeParticipant('enemy', enemyEntity, 100, 1)],
      state: 'fighting',
    }

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()))

    // 5 ticks × speed 100 = gauge 500 < GAUGE_MAX 1000 — chưa ai tới lượt.
    for (let i = 0; i < 5; i++) {
      system.tickPacing(battle)
    }

    expect(battle.totalTurnsElapsed ?? 0).toBe(0)
    expect(enemyEntity.currentHp).toBe(1_000_000)
  })

  it('đúng 10 ticks × speed 100 → player turn resolve (1 turn/giây — pacing hệ sống)', () => {
    const player = createCombatant({
      id: 'player',
      type: 'player',
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, speed: 100, attack: 999 },
    })
    const enemyEntity = createCombatant({
      id: 'enemy',
      currentHp: 1_000_000,
      maxHp: 1_000_000,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, speed: 100, attack: 0 },
    })

    const battle: TurnBattle = {
      players: [makeParticipant('player', player, 100, 0)],
      enemies: [makeParticipant('enemy', enemyEntity, 100, 1)],
      state: 'fighting',
    }

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()))

    for (let i = 0; i < 9; i++) {
      system.tickPacing(battle)
    }

    expect(battle.totalTurnsElapsed ?? 0).toBe(0)

    system.tickPacing(battle)

    expect(battle.totalTurnsElapsed).toBe(1)
    expect(enemyEntity.currentHp).toBeLessThan(1_000_000)
  })

  it('đồng thời trả actor ready (cho GameManager pause-on-player-turn)', () => {
    const player = createCombatant({
      id: 'player',
      type: 'player',
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, speed: 100, attack: 999 },
    })
    const enemyEntity = createCombatant({
      id: 'enemy',
      currentHp: 1_000_000,
      maxHp: 1_000_000,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, speed: 100, attack: 0 },
    })

    const battle: TurnBattle = {
      players: [makeParticipant('player', player, 100, 0)],
      enemies: [makeParticipant('enemy', enemyEntity, 100, 1)],
      state: 'fighting',
    }

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()))

    for (let i = 0; i < 9; i++) {
      system.tickPacing(battle)
    }

    const readyActor = system.tickPacing(battle)

    expect(readyActor?.id).toBe('player')
    expect(battle.totalTurnsElapsed).toBe(1)
  })
})
})

describe('TurnBattleSystem appliesAilment (Phase A1)', () => {
  const AILMENT_DEF: TurnBuffDefinition = {
    id: 'fixture_ailment',
    name: 'Fixture Ailment',
    polarity: 'debuff',
    duration: 5,
    stackMode: 'refresh',
    effects: [{ type: 'dot', dpsRatio: 0.1, element: 'physical' }],
  }

  function ailmentBattle(chance: number) {
    const player = createCombatant({
      id: 'player',
      type: 'player',
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 100 },
    })
    const enemyEntity = createCombatant({
      id: 'enemy',
      currentHp: 1_000_000,
      maxHp: 1_000_000,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })

    const playerParticipant = makeParticipant('player', player, 100, 0)
    playerParticipant.basic = {
      id: 'fixture_ailment_skill',
      cooldownTurns: 0,
      damage: { kind: 'physical' as const, multiplier: 1 },
      targeting: { shape: 'single' as const },
      appliesAilment: { buffDefinitionId: 'fixture_ailment', chance },
    }

    const enemyParticipant = makeParticipant('enemy', enemyEntity, 1, 1)

    const battle: TurnBattle = {
      players: [playerParticipant],
      enemies: [enemyParticipant],
      state: 'fighting',
    }

    return { battle, playerParticipant, enemyParticipant }
  }

  it('applies the ailment buff to the target on a successful chance roll', () => {
    const { battle, enemyParticipant } = ailmentBattle(1)

    const registry = new FixtureBuffRegistry([AILMENT_DEF])
    const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 10, registry)

    system.resolveNextStep(battle) // player acts first (priority 0)

    expect(enemyParticipant.buffs.hasAny('fixture_ailment')).toBe(true)
  })

  it('does not apply the ailment when the chance roll fails', () => {
    const { battle, enemyParticipant } = ailmentBattle(0)

    const registry = new FixtureBuffRegistry([AILMENT_DEF])
    const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 10, registry)

    system.resolveNextStep(battle)

    expect(enemyParticipant.buffs.hasAny('fixture_ailment')).toBe(false)
  })

  it('does not throw when appliesAilment is set but no registry was provided', () => {
    const { battle, enemyParticipant } = ailmentBattle(1)

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()))

    expect(() => system.resolveNextStep(battle)).not.toThrow()
    expect(enemyParticipant.buffs.hasAny('fixture_ailment')).toBe(false)
  })
})

describe('TurnBattleSystem Phase A1 end-to-end � real production reaction content', () => {
  it('real production content: H?a (hoa_cau_thuat) then Th?y T� C�ng triggers B?c Hoi', () => {
    const eventBus = new EventBus()
    const combatSystem = new CombatSystem(eventBus)
    const reactionManager = new TurnReactionManager(eventBus)

    const firePlayer = createCombatant({
      id: 'fire_player',
      type: 'player',
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 100 },
    })
    const target = createCombatant({
      id: 'target',
      currentHp: 1_000_000,
      maxHp: 1_000_000,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })

    const firePlayerParticipant = makeParticipant('fire_player', firePlayer, 100, 0)
    firePlayerParticipant.basic = PHAP_TU_BASICS.fire

    const enemyParticipant = makeParticipant('target', target, 1, 1)

    const battle: TurnBattle = {
      players: [firePlayerParticipant],
      enemies: [enemyParticipant],
      state: 'fighting',
    }

    const system = new TurnBattleSystem(combatSystem, 10, TURN_BUFF_REGISTRY, undefined, undefined, reactionManager)

    const reactionEvents: unknown[] = []
    eventBus.on('reaction', (event) => reactionEvents.push(event))

    // Force the second ailment (Th?y side of "B?c Hoi") � this test proves
    // the WIRING works end-to-end with real data, not re-testing RNG.
    new TurnBuffSystem(enemyParticipant.buffs).apply(
      TURN_BUFF_REGISTRY.get('te_cong'),
      firePlayer,
      target,
      TURN_BUFF_REGISTRY,
    )

    // hoa_cau_thuat's ailment chance is 0.5 � loop until a fire hit lands
    // with overwhelming probability (matches this file's convention of
    // looping enough iterations for chance-based content).
    for (let i = 0; i < 50; i++) {
      if (enemyParticipant.buffs.hasAny('bong')) break
      system.resolveNextStep(battle)
    }

    expect(enemyParticipant.buffs.hasAny('bong')).toBe(true)
    expect(reactionEvents.length).toBeGreaterThan(0)
  })
})
