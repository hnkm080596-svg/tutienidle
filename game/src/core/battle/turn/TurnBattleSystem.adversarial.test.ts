import { describe, expect, it } from 'vitest'
import {
  TurnBattleSystem,
  selectTarget,
  type TurnBattle,
  type TurnBattleParticipant,
} from './TurnBattleSystem'
import type { CombatEntity } from '../../combat/CombatEntity'
import { CombatSystem } from '../../combat/CombatSystem'
import { EventBus } from '../../events/EventBus'
import { createBaseStats } from '../../stats/StatBlock'
import { TurnBuffPool } from './TurnBuffPool'

// QA adversarial probes (2026-09-04 quick review) — Slice 1 TurnBattleSystem.

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

describe('TurnBattleSystem adversarial (QA probes)', () => {
  it('INV-S1-2: maxTurns=0 terminate ngay với state defeat, không hang', () => {
    const battle: TurnBattle = {
      players: [makeParticipant(
        'player',
        createCombatant({ id: 'player', type: 'player' }),
        10,
        0,
      ),],
      enemies: [makeParticipant('enemy', createCombatant({ id: 'enemy' }), 10, 1)],
      state: 'fighting',
    }

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 0)
    expect(system.runToCompletion(battle)).toBe('defeat')
    expect(battle.players[0]!.entity.alive).toBe(true)
  })

  it('INV-S1-3: selectTarget tie khoảng cách — winner cố định theo thứ tự mảng (first-min)', () => {
    const actor = makeParticipant(
      'actor',
      createCombatant({ id: 'actor', x: 2, row: 2 }),
      10,
      0,
    )
    const left = makeParticipant(
      'left',
      createCombatant({ id: 'left', x: 1, row: 2 }),
      10,
      1,
    )
    const right = makeParticipant(
      'right',
      createCombatant({ id: 'right', x: 3, row: 2 }),
      10,
      2,
    )

    // Determinism: cùng 1 thứ tự input → cùng winner (first-min wins).
    expect(selectTarget(actor, [right, left])?.id).toBe('right')
    expect(selectTarget(actor, [right, left])?.id).toBe('right')
    expect(selectTarget(actor, [left, right])?.id).toBe('left')
  })

  it('INV-S1-4: cùng hàng ưu tiên hơn khoảng cách Chebyshev tổng thể gần hơn', () => {
    const actor = makeParticipant(
      'actor',
      createCombatant({ id: 'actor', x: 0, row: 4 }),
      10,
      0,
    )
    const otherRowNear = makeParticipant(
      'otherRowNear',
      createCombatant({ id: 'otherRowNear', x: 1, row: 5 }),
      10,
      1,
    )
    const sameRowFar = makeParticipant(
      'sameRowFar',
      createCombatant({ id: 'sameRowFar', x: 3, row: 4 }),
      10,
      2,
    )

    expect(selectTarget(actor, [otherRowNear, sameRowFar])?.id).toBe('sameRowFar')
  })

  it('INV-S1-5: entity chết giữa trận — loop tiếp tục với enemy còn sống, terminal đúng', () => {
    const player = createCombatant({
      id: 'player',
      type: 'player',
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 100 },
    })
    const enemyA = createCombatant({
      id: 'enemyA',
      currentHp: 1,
      maxHp: 1,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })
    const enemyB = createCombatant({
      id: 'enemyB',
      currentHp: 5,
      maxHp: 5,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })

    const battle: TurnBattle = {
      players: [makeParticipant('player', player, 10, 0)],
      enemies: [makeParticipant('enemyA', enemyA, 10, 1), makeParticipant('enemyB', enemyB, 10, 2)],
      state: 'fighting',
    }

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()))
    expect(system.runToCompletion(battle)).toBe('victory')
  })
})
