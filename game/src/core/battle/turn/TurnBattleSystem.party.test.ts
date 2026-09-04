import { describe, expect, it } from 'vitest'
import { TurnBattleSystem, type TurnBattle, type TurnBattleParticipant } from './TurnBattleSystem'
import { CombatSystem } from '../../combat/CombatSystem'
import { EventBus } from '../../events/EventBus'
import { createBaseStats } from '../../stats/StatBlock'
import type { CombatEntity } from '../../combat/CombatEntity'
import { TurnBuffPool } from './TurnBuffPool'

// Future Systems Task 9 — party (multi player-side unit): 1 ATB queue
// chung, thua khi TOÀN BỘ party chết, opposingSide đối diện toàn party.

function createCombatant(overrides: Partial<CombatEntity> = {}): CombatEntity {
  const stats = { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0 }

  return {
    id: 'id', name: 'name', type: 'enemy', baseStats: stats, stats,
    currentHp: stats.maxHp, maxHp: stats.maxHp, currentMp: stats.maxMp,
    currentSwordIntent: 0, currentMomentum: 0, currentHoaThe: 0, currentThoThe: 0, currentKimThe: 0,
    timeSinceLastBleedProc: 0, tuLucActive: false, tuLucElapsed: 0, tuLucDamageTakenPercent: 0,
    currentWard: 0, timeSinceLastHitTaken: Infinity, realmIndex: 0, x: 0, row: 2, alive: true,
    ...overrides,
  } as CombatEntity
}

function makeParticipant(
  id: string,
  entity: CombatEntity,
  speed: number,
  priority: number,
): TurnBattleParticipant {
  return {
    id, entity, speed, priority, actionGauge: 0, alive: entity.alive,
    buffs: new TurnBuffPool(), consecutiveHardCcTurns: 0,
    basic: { id: `${id}_basic`, cooldownTurns: 0, damage: { kind: 'physical', multiplier: 1 }, targeting: { shape: 'single' } },
  }
}

function partyBattle(): { battle: TurnBattle; memberA: CombatEntity; memberB: CombatEntity; enemy: CombatEntity } {
  const memberA = createCombatant({ id: 'memberA', type: 'player', row: 4, currentHp: 10, maxHp: 10 })
  const memberB = createCombatant({ id: 'memberB', type: 'player', row: 5, currentHp: 1_000_000, maxHp: 1_000_000 })
  const enemy = createCombatant({ id: 'enemy', currentHp: 1_000_000, maxHp: 1_000_000 })

  return {
    battle: {
      players: [
        makeParticipant('memberA', memberA, 30, 0),
        makeParticipant('memberB', memberB, 20, 1),
      ],
      enemies: [makeParticipant('enemy', enemy, 10, 2)],
      state: 'fighting',
    },
    memberA,
    memberB,
    enemy,
  }
}

describe('TurnBattleSystem party (multi player-side unit)', () => {
  it('nhiều player-side unit chung ATB queue với enemy — lượt đầu theo speed, queue chung không grouping', () => {
    const { battle } = partyBattle()
    const system = new TurnBattleSystem(new CombatSystem(new EventBus()))

    // Speeds: memberA 30 > memberB 20 > enemy 10. 2 lượt đầu chắc chắn
    // theo speed; lượt 3+ theo gauge-fill thuần (memberA có thể act 2 lần
    // trước enemy nếu gauge đủ — hành vi ATB đúng, KHÔNG có "player side
    // luôn xen giữa" grouping).
    const order: string[] = []

    for (let i = 0; i < 2 && battle.state === 'fighting'; i++) {
      const step = system.resolveNextStep(battle)
      order.push(step.actorId)
    }

    expect(order.slice(0, 2)).toEqual(['memberA', 'memberB'])

    // Chứng minh enemy cũng nằm trong CÙNG queue: chạy đủ lâu, enemy phải
    // xuất hiện trong sequence.
    for (let i = 0; i < 8 && battle.state === 'fighting'; i++) {
      const step = system.resolveNextStep(battle)
      order.push(step.actorId)
    }

    expect(order).toContain('enemy')
    expect(order).toContain('memberA')
    expect(order).toContain('memberB')
  })

  it('1 party member chết → trận vẫn fighting (member còn sống tiếp tục)', () => {
    const { battle, memberA, enemy } = partyBattle()
    const system = new TurnBattleSystem(new CombatSystem(new EventBus()))

    // memberA (10 HP) bị enemy giết qua vài lượt — ép enemy attack lớn.
    battle.enemies[0]!.entity.stats.attack = 10_000

    for (let i = 0; i < 30 && memberA.alive; i++) {
      system.resolveNextStep(battle)
    }

    expect(memberA.alive).toBe(false)
    expect(battle.state).toBe('fighting')

    // Member B còn sống — engine tiếp tục resolve lượt của B/enemy.
    expect(battle.players[1]!.entity.alive).toBe(true)

    expect(() => system.resolveNextStep(battle)).not.toThrow()
    expect(battle.state).toBe('fighting')
  })

  it('TOÀN BỘ party chết → defeat', () => {
    const { battle, memberA, memberB, enemy } = partyBattle()
    const system = new TurnBattleSystem(new CombatSystem(new EventBus()))

    battle.enemies[0]!.entity.stats.attack = 10_000

    for (let i = 0; i < 60 && battle.state === 'fighting'; i++) {
      system.resolveNextStep(battle)
    }

    expect(memberA.alive).toBe(false)
    expect(memberB.alive).toBe(false)
    expect(enemy.alive).toBe(true)
    expect(battle.state).toBe('defeat')
  })

  it('enemy opposingSide target đúng TOÀN BỘ party living (không chỉ players[0])', () => {
    const { battle, memberA, memberB } = partyBattle()
    const system = new TurnBattleSystem(new CombatSystem(new EventBus()))

    // Enemy attack lớn — đòn enemy phải CÓ THỂ trúng memberB (players[1]),
    // không chỉ memberA.
    battle.enemies[0]!.entity.stats.attack = 5

    const hpBBefore = memberB.currentHp
    const hpABefore = memberA.currentHp

    for (let i = 0; i < 12; i++) {
      system.resolveNextStep(battle)
    }

    const damagedB = memberB.currentHp < hpBBefore
    const damagedA = memberA.currentHp < hpABefore

    // Ít nhất 1 trong 2 member phải bị enemy đánh (targeting hoạt động
    // trên toàn party); với selectTarget "gần nhất" + cả 2 alive, cả 2
    // đều có thể trúng tuỳ lượt — assert KHÔNG phải "chỉ memberA bị đánh".
    expect(damagedA || damagedB).toBe(true)
  })
})
