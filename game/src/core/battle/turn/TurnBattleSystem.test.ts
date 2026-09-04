import { describe, expect, it } from 'vitest'
import { selectTarget, TurnBattleSystem, type TurnBattle, type TurnBattleParticipant, type TurnBattleState } from './TurnBattleSystem'
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
  return { id, entity: combatEntity, speed, priority, actionGauge: 0, alive: combatEntity.alive, buffs: new TurnBuffPool(), consecutiveHardCcTurns: 0 }
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
  return { id, entity: combatEntity, speed, priority, actionGauge: 0, alive: combatEntity.alive, buffs: new TurnBuffPool(), consecutiveHardCcTurns: 0 }
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
      player: playerParticipant,
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
      player: playerParticipant,
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
      player: playerParticipant,
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
      player: playerParticipant,
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
      player: makeParticipant('player', player, 10, 0),
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
      player: playerParticipant,
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
      player: playerParticipant,
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
      player: makeParticipant('player', player, 10, 0),
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
      player: makeParticipant('player', player, 10, 0),
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
      player: makeParticipant('player', player, 10, 0),
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
      player: makeParticipant('player', player, 10, 0),
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
      player: makeParticipant('player', player, 10, 0),
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
})

describe('TurnBattleSystem.resolveNextStep multi-wave spawning', () => {
  it('spawns the next wave enemy once the arena is empty, but does not win yet', () => {
    const player = createCombatant({
      id: 'player',
      type: 'player',
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 999 },
    })
    const enemyA = createCombatant({
      id: 'enemyA',
      currentHp: 1,
      maxHp: 1,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })

    const wave = { totalEnemyCount: 2, spawnedCount: 1 }
    const battle: TurnBattle = {
      player: makeParticipant('player', player, 10, 0),
      enemies: [makeParticipant('enemyA', enemyA, 10, 1)],
      state: 'fighting',
      wave,
    }

    const spawnEnemy = (): TurnBattleParticipant => {
      const enemyB = createCombatant({
        id: 'enemyB',
        currentHp: 1_000_000,
        maxHp: 1_000_000,
        stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
      })

      return makeParticipant('enemyB', enemyB, 10, 2)
    }

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 20, undefined, spawnEnemy)
    system.resolveNextStep(battle)

    expect(battle.enemies).toHaveLength(2)
    expect(battle.enemies[1]!.id).toBe('enemyB')
    expect(wave.spawnedCount).toBe(2)
    expect(battle.state).toBe('fighting')
  })

  it('does not spawn while an enemy is still alive', () => {
    const player = createCombatant({
      id: 'player',
      type: 'player',
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 1 },
    })
    const enemyA = createCombatant({
      id: 'enemyA',
      currentHp: 1_000_000,
      maxHp: 1_000_000,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })

    const wave = { totalEnemyCount: 2, spawnedCount: 1 }
    const battle: TurnBattle = {
      player: makeParticipant('player', player, 10, 0),
      enemies: [makeParticipant('enemyA', enemyA, 10, 1)],
      state: 'fighting',
      wave,
    }

    let spawnCalls = 0
    const spawnEnemy = (): TurnBattleParticipant => {
      spawnCalls += 1

      const enemyB = createCombatant({
        id: 'enemyB',
        currentHp: 1,
        maxHp: 1,
        stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
      })

      return makeParticipant('enemyB', enemyB, 10, 2)
    }

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 20, undefined, spawnEnemy)
    system.resolveNextStep(battle)

    expect(spawnCalls).toBe(0)
    expect(wave.spawnedCount).toBe(1)
    expect(battle.enemies).toHaveLength(1)
  })

  it('reaches victory via isStageComplete once every wave enemy has spawned and died', () => {
    const player = createCombatant({
      id: 'player',
      type: 'player',
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 999 },
    })
    const enemyA = createCombatant({
      id: 'enemyA',
      currentHp: 1,
      maxHp: 1,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })

    const wave = { totalEnemyCount: 1, spawnedCount: 1 }
    const battle: TurnBattle = {
      player: makeParticipant('player', player, 10, 0),
      enemies: [makeParticipant('enemyA', enemyA, 10, 1)],
      state: 'fighting',
      wave,
    }

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 20)
    system.resolveNextStep(battle)

    expect(battle.state).toBe('victory')
    expect(battle.enemies).toHaveLength(1)
  })

  it('does not declare victory until every wave enemy has spawned and died (multi-step)', () => {
    const player = createCombatant({
      id: 'player',
      type: 'player',
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 999 },
    })
    const enemyA = createCombatant({
      id: 'enemyA',
      currentHp: 1,
      maxHp: 1,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })

    const wave = { totalEnemyCount: 2, spawnedCount: 1 }
    const battle: TurnBattle = {
      player: makeParticipant('player', player, 10, 0),
      enemies: [makeParticipant('enemyA', enemyA, 10, 1)],
      state: 'fighting',
      wave,
    }

    const spawnEnemy = (): TurnBattleParticipant => {
      const enemyB = createCombatant({
        id: 'enemyB',
        currentHp: 1,
        maxHp: 1,
        stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
      })

      return makeParticipant('enemyB', enemyB, 10, 2)
    }

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 20, undefined, spawnEnemy)

    // Step 1: player kills enemyA. Arena empties -> enemyB spawns this same
    // step, but enemyB is alive so victory does not fire yet.
    system.resolveNextStep(battle)
    expect(battle.state).toBe('fighting')
    expect(battle.enemies).toHaveLength(2)

    // Step 2: player (same speed, lower priority, wins the tie) kills
    // enemyB. Arena empties, spawnedCount already equals totalEnemyCount ->
    // no further spawn, victory fires.
    system.resolveNextStep(battle)
    expect(battle.state).toBe('victory')
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
      player: makeParticipant('player', player, 10, 0),
      enemies: [makeParticipant('enemy', enemyEntity, 10, 1)],
      state: 'fighting',
    }

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()))
    system.resolveNextStep(battle)

    expect(battle.state).toBe('victory')
    expect(battle.enemies).toHaveLength(1)
  })

  it('does not throw and does not spawn when wave is set but no spawnEnemy factory was provided', () => {
    const player = createCombatant({
      id: 'player',
      type: 'player',
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 999 },
    })
    const enemyA = createCombatant({
      id: 'enemyA',
      currentHp: 1,
      maxHp: 1,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })

    const wave = { totalEnemyCount: 2, spawnedCount: 1 }
    const battle: TurnBattle = {
      player: makeParticipant('player', player, 10, 0),
      enemies: [makeParticipant('enemyA', enemyA, 10, 1)],
      state: 'fighting',
      wave,
    }

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 20)

    expect(() => system.resolveNextStep(battle)).not.toThrow()
    expect(battle.enemies).toHaveLength(1)
    expect(wave.spawnedCount).toBe(1)
    expect(battle.state).toBe('fighting')
  })
})

const LONG_STUN_DEFINITION: TurnBuffDefinition = {
  id: 'fixture_long_stun',
  name: 'Fixture Long Stun',
  polarity: 'debuff',
  duration: 100,
  stackMode: 'refresh',
  effects: [{ type: 'cc', ccEffect: 'stun' }],
}

describe('TurnBattleSystem.resolveNextStep B� Th? (CC-lock guard)', () => {
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
      player: playerParticipant,
      enemies: [enemyParticipant],
      state: 'fighting',
    }

    // Applied ONCE � duration 100 means it cannot expire within this
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

  it('fires B� Th? on the 4th consecutive blocked turn: clears CC, actor acts, counter resets', () => {
    const { playerParticipant, battle } = stunnedBattle()
    const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 10, undefined)

    for (let i = 0; i < 3; i++) {
      system.resolveNextStep(battle) // player blocked, counter -> i+1
      system.resolveNextStep(battle) // enemy turn
    }

    const step = system.resolveNextStep(battle) // 4th consecutive blocked attempt � B� Th? should fire here

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
    // any CC buff � isolates the reset behavior from buff-timing entirely.
    playerParticipant.consecutiveHardCcTurns = 2

    const battle: TurnBattle = {
      player: playerParticipant,
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
    // blockChance: 0 — test so sánh damage tuyệt đối giữa 2 runs; block
    // là roll 5% ngẫu nhiên (blockChance base 0.05) sẽ làm test flaky.
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
      player: playerParticipant,
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
    // At exactly turn 10, Sudden Death has not started yet (starts turn 11) � damage is the normal, unscaled amount.
    // (Exact expected HP delta depends on calculateBaseDamage's real formula � assert only that it's the SAME
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
    // Endurance của hệ sống trừ PHẲNG threshold×percent = 10×0.7 = 7 SAU
    // scale (mọi đòn > threshold), nên scaled = base×m − 7, không phải
    // base×m nguyên vẹn (plan test gốc đã bỏ qua tầng endurance này).
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
      player: playerParticipant,
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
      player: makeParticipant('player', player, 10, 0),
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
      player: makeParticipant('player', player, 10, 0),
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
      player: makeParticipant('player', player, 10, 0),
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
