import { describe, expect, it, vi } from 'vitest'
import { resolveAilmentApplicationChance } from './AilmentChance'
import { TurnBattleSystem, type TurnBattle, type TurnBattleParticipant } from './TurnBattleSystem'
import type { CombatEntity } from '../../combat/CombatEntity'
import { CombatSystem } from '../../combat/CombatSystem'
import { EventBus } from '../../events/EventBus'
import { createBaseStats } from '../../stats/StatBlock'
import type { TurnSkillDefinition } from './TurnSkillAction'
import { BUFF_REGISTRY } from '../../../data/buff/BuffRegistry'
import { FunctionCombatRng } from '../runtime/rng/FunctionCombatRng'
import { makeTurnRuntime } from './testing/TurnRuntimeFixtures'

// Mission C Task 10b — elementApplicationPercent must apply to ailment
// application rolls in turn combat (the deleted legacy executor already
// did this; the turn engine rolled the bare chance). buff2 M4: the
// ApplicationResolver owns the roll as MULTIPLICATIVE
// baseChance x (1 + elementApplicationPercent) x targetResistance.

describe('resolveAilmentApplicationChance', () => {
  it('adds the application percent to the base chance', () => {
    expect(resolveAilmentApplicationChance(0.4, 0.04)).toBeCloseTo(0.44, 10)
  })

  it('clamps at 1', () => {
    expect(resolveAilmentApplicationChance(0.9, 0.5)).toBe(1)
  })

  it('undefined/zero percent returns the base chance', () => {
    expect(resolveAilmentApplicationChance(0.4, undefined)).toBe(0.4)
    expect(resolveAilmentApplicationChance(0.4, 0)).toBe(0.4)
  })
})

function createCombatant(id: string, type: 'player' | 'enemy', overrides: Partial<CombatEntity> = {}): CombatEntity {
  const stats = createBaseStats({ evasionRate: 0, dexterity: 0, criticalRate: 0 })

  return {
    id,
    name: id,
    type,
    baseStats: stats,
    stats,
    currentHp: 10_000_000,
    maxHp: 10_000_000,
    currentMp: stats.maxMp,
    currentThe: 0,
    currentWard: 0,
    turnsSinceLastHitLanded: Infinity,
    realmIndex: 0,
    x: 0,
    row: 2,
    alive: true,
    ...overrides,
  } as CombatEntity
}

function makeParticipant(id: string, entity: CombatEntity, priority: number): TurnBattleParticipant {
  return { id, entity, speed: 100, priority, actionGauge: 0, alive: entity.alive, consecutiveHardCcTurns: 0 }
}

describe('applySkillAilments honors elementApplicationPercent', () => {
  it('a 0.6-chance ailment lands for a 0.5-percent actor under a 0.8 roll', () => {
    const playerEntity = createCombatant('player', 'player')
    playerEntity.stats.elementApplicationPercent = 0.5
    const enemyEntity = createCombatant('enemy', 'enemy')

    const player = makeParticipant('player', playerEntity, 0)
    const enemy = makeParticipant('enemy', enemyEntity, 1)
    player.basic = {
      id: 'qa_ailment_basic',
      cooldownTurns: 0,
      damage: { kind: 'physical', multiplier: 0 },
      targeting: { shape: 'single' },
      appliesAilments: [{ buffDefinitionId: 'bong', chance: 0.6 }],
    } as TurnSkillDefinition

    const battle: TurnBattle = { players: [player], enemies: [enemy], state: 'fighting' }
    const combat = new CombatSystem(new EventBus())
    const rng = new FunctionCombatRng(() => 0.8)
    const runtime = makeTurnRuntime({
      registry: BUFF_REGISTRY,
      participants: () => [player, enemy],
      combatSystem: combat,
      rng,
    })

    // Multiplicative formula: 0.6 x (1 + 0.5) = 0.9; roll 0.8 lands --
    // it would miss a bare 0.6 chance.
    const system = new TurnBattleSystem(
      combat,
      100,
      BUFF_REGISTRY,
      undefined,
      runtime,
      vi.fn(),
      undefined,
      rng,
    )

    system.resolveNextStep(battle)

    expect(
      runtime.buffs.getForTarget(enemy.entity.id).some(
        (instance) => instance.definitionId === 'bong',
      ),
    ).toBe(true)
  })

  it('without the stat the same 0.8 roll misses a 0.6-chance ailment', () => {
    const playerEntity = createCombatant('player', 'player')
    const enemyEntity = createCombatant('enemy', 'enemy')

    const player = makeParticipant('player', playerEntity, 0)
    const enemy = makeParticipant('enemy', enemyEntity, 1)
    player.basic = {
      id: 'qa_ailment_basic',
      cooldownTurns: 0,
      damage: { kind: 'physical', multiplier: 0 },
      targeting: { shape: 'single' },
      appliesAilments: [{ buffDefinitionId: 'bong', chance: 0.6 }],
    } as TurnSkillDefinition

    const battle: TurnBattle = { players: [player], enemies: [enemy], state: 'fighting' }
    const combat = new CombatSystem(new EventBus())
    const rng = new FunctionCombatRng(() => 0.8)
    const runtime = makeTurnRuntime({
      registry: BUFF_REGISTRY,
      participants: () => [player, enemy],
      combatSystem: combat,
      rng,
    })

    const system = new TurnBattleSystem(
      combat,
      100,
      BUFF_REGISTRY,
      undefined,
      runtime,
      vi.fn(),
      undefined,
      rng,
    )

    system.resolveNextStep(battle)

    expect(
      runtime.buffs.getForTarget(enemy.entity.id).some(
        (instance) => instance.definitionId === 'bong',
      ),
    ).toBe(false)
  })
})
