import { describe, expect, it } from 'vitest'
import { selectTarget, TurnBattleSystem, type TurnBattle, type TurnBattleParticipant } from './TurnBattleSystem'
import type { CombatEntity } from '../../combat/CombatEntity'
import { CombatSystem } from '../../combat/CombatSystem'
import { EventBus } from '../../events/EventBus'
import { createBaseStats } from '../../stats/StatBlock'
import type { TurnSkillDefinition } from './TurnSkillAction'
import { TurnBuffPool } from './TurnBuffPool'

// Fixture giống hệt quy ước đã dùng trong ActionTargetingSystem.test.ts —
// selectTarget chỉ đọc id/x/row/alive, không cần Stats đầy đủ.
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
  return { id, entity: combatEntity, speed, priority, actionGauge: 0, alive: combatEntity.alive, buffs: new TurnBuffPool() }
}

describe('selectTarget', () => {
  it('cùng hàng: chọn entity gần nhất theo cột', () => {
    const actor = participant('actor', entity('actor', 0, 4))
    const near = participant('near', entity('near', 2, 4))
    const far = participant('far', entity('far', 5, 4))

    expect(selectTarget(actor, [far, near])?.id).toBe('near')
  })

  it('không có ai cùng hàng: chọn gần nhất theo Chebyshev toàn bàn cờ', () => {
    const actor = participant('actor', entity('actor', 0, 4))
    const otherRowNear = participant('otherRowNear', entity('otherRowNear', 1, 5))
    const otherRowFar = participant('otherRowFar', entity('otherRowFar', 8, 8))

    expect(selectTarget(actor, [otherRowFar, otherRowNear])?.id).toBe('otherRowNear')
  })

  it('bỏ qua entity đã chết', () => {
    const actor = participant('actor', entity('actor', 0, 4))
    const dead = participant('dead', entity('dead', 1, 4, false))
    const alive = participant('alive', entity('alive', 3, 4))

    expect(selectTarget(actor, [dead, alive])?.id).toBe('alive')
  })

  it('toàn bộ phe đối diện đã chết: trả về undefined', () => {
    const actor = participant('actor', entity('actor', 0, 4))
    const dead = participant('dead', entity('dead', 1, 4, false))

    expect(selectTarget(actor, [dead])).toBeUndefined()
  })
})

// Fixture giống hệt quy ước CombatSystem.damageFloor.test.ts — cần Stats
// đầy đủ vì runToCompletion gọi thật CombatSystem.resolveActionHit().
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
  return { id, entity: combatEntity, speed, priority, actionGauge: 0, alive: combatEntity.alive, buffs: new TurnBuffPool() }
}

describe('TurnBattleSystem.runToCompletion', () => {
  it('đòn trúng làm giảm HP, trận kết thúc đúng trạng thái khi enemy chết', () => {
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
      player: makeParticipant('player', player, 10, 0),
      enemies: [makeParticipant('enemy', enemyEntity, 10, 1)],
      state: 'fighting',
    }

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()))
    const result = system.runToCompletion(battle)

    expect(result).toBe('victory')
    expect(battle.state).toBe('victory')
  })

  it('player chết trước => defeat', () => {
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
      player: makeParticipant('player', player, 10, 0),
      enemies: [makeParticipant('enemy', enemyEntity, 10, 1)],
      state: 'fighting',
    }

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()))
    const result = system.runToCompletion(battle)

    expect(result).toBe('defeat')
  })

  it('nhiều enemy: target chuyển sang enemy gần kế tiếp sau khi enemy gần nhất chết', () => {
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
      player: makeParticipant('player', player, 10, 0),
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

  it('vượt quá số lượt tối đa: dừng an toàn ở defeat, không treo', () => {
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
      player: makeParticipant('player', player, 10, 0),
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
      player: makeParticipant('player', player, 10, 0),
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
      player: playerParticipant,
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
      player: makeParticipant('player', player, 10, 0),
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
      player: playerParticipant,
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
      player: playerParticipant,
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
      player: makeParticipant('player', player, 10, 0),
      enemies: [makeParticipant('enemy', enemyEntity, 10, 1)],
      state: 'fighting',
    }

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()))
    const step = system.resolveNextStep(battle)

    expect(step.ccBlocked).toBe(false)
    expect(step.targetIds).toEqual(['enemy'])
  })
})
