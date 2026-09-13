import { describe, expect, it, vi } from 'vitest'
import { TurnBattleSystem, type TurnBattle, type TurnBattleParticipant } from './TurnBattleSystem'
import { CombatSystem } from '../../combat/CombatSystem'
import { EventBus } from '../../events/EventBus'
import { createBaseStats } from '../../stats/StatBlock'
import { BuffPool } from '../../buff/BuffPool'
import { BuffSystem } from '../../buff/BuffSystem'
import type { BuffDefinition, BuffDefinitionCatalog } from '../../buff/BuffTypes'
import type { CombatEntity } from '../../combat/CombatEntity'
import type { TurnSkillDefinition } from './TurnSkillAction'

// AR-03 QA Probes:
// 1. Pure self-buff execution: targetScope: 'self', damage undefined.
//    Enemy takes 0 damage; actor receives buff; targetIds contains actor ID.
// 2. Leech healing: healPercentOfDamage on hit heals source entity via vitals.

const DIA_TRU_BUFF: BuffDefinition = {
  id: 'dia_tru',
  name: 'Địa Trụ',
  polarity: 'buff',
  duration: 3,
  stackMode: 'refresh',
  effects: [{ type: 'statModifier', stat: 'wardMax', flat: 100 }],
}

const REGISTRY: BuffDefinitionCatalog = {
  get: (id: string): BuffDefinition => {
    if (id === DIA_TRU_BUFF.id) return DIA_TRU_BUFF
    throw new Error(`unknown buff id: ${id}`)
  },
}

function makeEntity(id: string, overrides: Partial<CombatEntity> = {}): CombatEntity {
  const stats = createBaseStats({ attack: 100, ...overrides.stats })
  return {
    id,
    name: id,
    type: 'player',
    baseStats: stats,
    stats,
    currentHp: 1_000_000,
    maxHp: 1_000_000,
    currentMp: stats.maxMp,
    currentSwordIntent: 0,
    currentMomentum: 0,
    currentHoaThe: 0,
    currentThoThe: 0,
    currentKimThe: 0,
    currentThe: 0,
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

function makeParticipant(id: string, entity: CombatEntity, priority: number): TurnBattleParticipant {
  return {
    id,
    entity,
    speed: entity.stats.speed,
    priority,
    actionGauge: 0,
    alive: entity.alive,
    buffs: new BuffPool(),
    consecutiveHardCcTurns: 0,
  }
}

describe('AR-03: Self-buff execution and leech healing', () => {
  it('executes a pure self-buff skill without dealing damage to enemy', () => {
    const eventBus = new EventBus()
    const combat = new CombatSystem(eventBus)
    const system = new TurnBattleSystem(combat, 10, REGISTRY)

    const player = makeEntity('player')
    const enemy = makeEntity('enemy', { currentHp: 10_000, maxHp: 10_000 })
    enemy.type = 'enemy'

    const playerP = makeParticipant('player', player, 0)
    const enemyP = makeParticipant('enemy', enemy, 1)

    // Pure self buff skill
    const selfBuffSkill: TurnSkillDefinition = {
      id: 'dia_tru_thua_thien',
      cooldownTurns: 3,
      targetScope: 'self',
      targeting: { shape: 'single' },
      appliesBuff: { definitionId: 'dia_tru', target: 'self' },
    }

    playerP.basic = selfBuffSkill

    const battle: TurnBattle = {
      players: [playerP],
      enemies: [enemyP],
      state: 'fighting',
    }

    const damageEvents: Array<{ targetId: string }> = []
    eventBus.on<{ targetId: string }>('damage', (e) => damageEvents.push(e))

    const stepResult = system.resolveNextStep(battle)

    // 1. Enemy takes 0 damage and enemy HP is unchanged.
    expect(enemy.currentHp).toBe(10_000)
    expect(damageEvents).toHaveLength(0)

    // 2. Player receives the dia_tru buff.
    expect(playerP.buffs.getAllById('dia_tru')).toHaveLength(1)

    // 3. Step result reflects actor as target.
    expect(stepResult.targetIds).toContain('player')
  })

  it('heals actor for healPercentOfDamage on landed hit', () => {
    const eventBus = new EventBus()
    const combat = new CombatSystem(eventBus)
    const system = new TurnBattleSystem(combat, 10, REGISTRY)

    // Player with missing HP
    const player = makeEntity('player', { currentHp: 500, maxHp: 1000 })
    const enemy = makeEntity('enemy', { currentHp: 10_000, maxHp: 10_000 })
    enemy.type = 'enemy'

    const playerP = makeParticipant('player', player, 0)
    const enemyP = makeParticipant('enemy', enemy, 1)

    // Wood ultimate style: deals damage + 40% leech
    const leechSkill: TurnSkillDefinition = {
      id: 'doc_vien_bao_can',
      cooldownTurns: 6,
      damage: { kind: 'physical', multiplier: 1 },
      targeting: { shape: 'single' },
      healPercentOfDamage: 0.4,
    }

    playerP.basic = leechSkill

    const battle: TurnBattle = {
      players: [playerP],
      enemies: [enemyP],
      state: 'fighting',
    }

    const hpBefore = player.currentHp

    // Pin the hit/crit dice (fd22f2b6 discipline): base stats carry 5%
    // criticalRate and rating-based hit chance, so an unpinned resolve can
    // miss or crit — this suite flaked as "expected 500 to be greater than
    // 500" when the attack missed and leech healed 0. 0.5 lands the hit
    // without a crit for the default rating spread.
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5)
    try {
      system.resolveNextStep(battle)
    } finally {
      randomSpy.mockRestore()
    }

    // Player should heal 40% of the damage dealt.
    expect(player.currentHp).toBeGreaterThan(hpBefore)
  })

  it('applies multiple ailments and multi-stack applications on landed hit', () => {
    const eventBus = new EventBus()
    const combat = new CombatSystem(eventBus)

    const POISON_BUFF: BuffDefinition = {
      id: 'trung_doc',
      name: 'Trúng Độc',
      polarity: 'debuff',
      duration: 3,
      maxStacks: 5,
      stackMode: 'stack',
      effects: [{ type: 'dot', dpsRatio: 1, element: 'wood' }],
    }
    const ROOT_BUFF: BuffDefinition = {
      id: 'troi_chan',
      name: 'Trói Chân',
      polarity: 'debuff',
      duration: 2,
      stackMode: 'refresh',
      effects: [{ type: 'cc', ccEffect: 'root' }],
    }

    const registry: BuffDefinitionCatalog = {
      get: (id: string): BuffDefinition => {
        if (id === 'trung_doc') return POISON_BUFF
        if (id === 'troi_chan') return ROOT_BUFF
        throw new Error(`unknown buff id: ${id}`)
      },
    }

    const system = new TurnBattleSystem(combat, 10, registry)

    const player = makeEntity('player')
    const enemy = makeEntity('enemy', { currentHp: 10_000, maxHp: 10_000 })
    enemy.type = 'enemy'

    const playerP = makeParticipant('player', player, 0)
    const enemyP = makeParticipant('enemy', enemy, 1)

    // Skill with 2 ailments: 1 root + 2 poison stacks
    const multiAilmentSkill: TurnSkillDefinition = {
      id: 'cau_mang_can_tri',
      cooldownTurns: 3,
      damage: { kind: 'physical', multiplier: 1 },
      targeting: { shape: 'single' },
      appliesAilments: [
        { buffDefinitionId: 'troi_chan', chance: 1 },
        { buffDefinitionId: 'trung_doc', chance: 1, stacks: 2 },
      ],
    }

    playerP.basic = multiAilmentSkill

    const battle: TurnBattle = {
      players: [playerP],
      enemies: [enemyP],
      state: 'fighting',
    }

    system.resolveNextStep(battle)

    // Enemy should have both buffs, with trung_doc having 2 stacks.
    expect(enemyP.buffs.getAllById('troi_chan')).toHaveLength(1)
    expect(new BuffSystem(enemyP.buffs).getStacks('trung_doc')).toBe(2)
  })
})
