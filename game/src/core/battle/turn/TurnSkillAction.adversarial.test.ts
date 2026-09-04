import { describe, expect, it, vi } from 'vitest'
import {
  selectAction,
  tickCooldowns,
  commitAction,
  collectTurnTargets,
  type TurnSkillDefinition,
} from './TurnSkillAction'
import { TurnBattleSystem, type TurnBattle, type TurnBattleParticipant } from './TurnBattleSystem'
import type { CombatEntity } from '../../combat/CombatEntity'
import { CombatSystem } from '../../combat/CombatSystem'
import { EventBus } from '../../events/EventBus'
import { createBaseStats } from '../../stats/StatBlock'

// QA adversarial probes (2026-09-04 quick review) — Slice 2 skill actions.

function entity(overrides: Partial<CombatEntity> = {}): CombatEntity {
  const stats = { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, blockChance: 0 }

  return {
    id: 'id',
    name: 'name',
    type: 'enemy',
    baseStats: stats,
    stats,
    currentHp: stats.maxHp,
    maxHp: stats.maxHp,
    currentMp: 50,
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

function skill(overrides: Partial<TurnSkillDefinition> = {}): TurnSkillDefinition {
  return {
    id: 'fixture_skill',
    cooldownTurns: 0,
    damage: { kind: 'physical', multiplier: 1 },
    targeting: { shape: 'single' },
    ...overrides,
  }
}

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

describe('Slice 2 adversarial (QA probes)', () => {
  it('INV-S2-1: ultimate trên cooldown + special hết resource → fallback basic_attack (không crash)', () => {
    const actor = participant({
      special: {
        skill: skill({ id: 'sp', resourceType: 'mana', resourceCost: 999 }),
        remainingCooldownTurns: 0,
      },
      ultimate: { skill: skill({ id: 'ult' }), remainingCooldownTurns: 2 },
      entity: entity({ currentMp: 0 }),
    })

    expect(selectAction(actor).skillId).toBe('basic_attack')
  })

  it('INV-S2-2: tickCooldowns giảm từ giá trị âm không xảy ra — floor 0 giữ', () => {
    const ultimate = { skill: skill({ id: 'u' }), remainingCooldownTurns: 0 }
    const actor = participant({ ultimate })

    tickCooldowns(actor)
    tickCooldowns(actor)
    tickCooldowns(actor)

    expect(ultimate.remainingCooldownTurns).toBe(0)
  })

  it('INV-S2-3: selectAction KHÔNG tiêu resource — chỉ commitAction mới trừ', () => {
    const actorEntity = entity({ currentMp: 50 })
    const actor = participant({
      special: { skill: skill({ id: 'sp', resourceType: 'mana', resourceCost: 20 }), remainingCooldownTurns: 0 },
      entity: actorEntity,
    })

    const action = selectAction(actor)
    expect(actorEntity.currentMp).toBe(50)

    commitAction(actorEntity, action)
    expect(actorEntity.currentMp).toBe(30)
  })

  it('INV-S2-4: collectTurnTargets với targeting shape không có areaFor mapping (cross radius 0) vẫn trả primary', () => {
    const primary = participant({ id: 'primary', entity: entity({ id: 'primary', x: 2, row: 2 }) })
    const other = participant({ id: 'other', entity: entity({ id: 'other', x: 3, row: 3 }) })

    // cross radius 0: chỉ đúng ô anchor — other (chéo) bị loại.
    const affected = collectTurnTargets(primary, [primary, other], { shape: 'cross', laneRadius: 0 })

    expect(affected.map((p) => p.id)).toEqual(['primary'])
  })

  it('INV-S2-5: multi-target AOE qua resolveNextStep — mọi target bị hit, step report đủ targetIds', () => {
    const playerEntity = entity({ id: 'player', type: 'player' as never, x: 1, row: 2, stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 50 } })
    const enemyA = entity({ id: 'enemyA', x: 2, row: 2, currentHp: 100, stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 } })
    const enemyB = entity({ id: 'enemyB', x: 2, row: 3, currentHp: 100, stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 } })

    const playerParticipant = participant({ id: 'player', entity: playerEntity, speed: 100, priority: 0 })
    playerParticipant.special = {
      skill: skill({ id: 'aoe', targeting: { shape: 'square', laneRadius: 1, columnRadius: 1 } }),
      remainingCooldownTurns: 0,
    }

    const battle: TurnBattle = {
      player: playerParticipant,
      enemies: [
        participant({ id: 'enemyA', entity: enemyA, speed: 1, priority: 1 }),
        participant({ id: 'enemyB', entity: enemyB, speed: 1, priority: 2 }),
      ],
      state: 'fighting',
    }

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()))
    const step = system.resolveNextStep(battle)

    expect(step.actorId).toBe('player')
    expect(step.skillId).toBe('aoe')
    expect(step.targetIds.sort()).toEqual(['enemyA', 'enemyB'])
    expect(enemyA.currentHp).toBeLessThan(100)
    expect(enemyB.currentHp).toBeLessThan(100)
  })

  it('INV-S2-6: special bị xào cooldown vẫn nhảy sang basic — combat không dừng', () => {
    const playerEntity = entity({ id: 'player', type: 'player' as never, stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 10 } })
    const enemy = entity({ id: 'enemy', currentHp: 5, maxHp: 5, stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 } })

    const playerParticipant = participant({ id: 'player', entity: playerEntity, speed: 10, priority: 0 })
    playerParticipant.basic = skill({ id: 'basic_skill', damage: { kind: 'physical', multiplier: 2 } })
    playerParticipant.special = {
      skill: skill({ id: 'sp', cooldownTurns: 1, damage: { kind: 'physical', multiplier: 5 } }),
      remainingCooldownTurns: 0,
    }

    const battle: TurnBattle = {
      player: playerParticipant,
      enemies: [participant({ id: 'enemy', entity: enemy, speed: 5, priority: 1 })],
      state: 'fighting',
    }

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()))
    const result = system.runToCompletion(battle)

    expect(result).toBe('victory')
  })
})
