import { describe, expect, it } from 'vitest'
import { toTurnBattleParticipant } from './TurnBattleAdapter'
import { createBaseStats } from '../stats/StatBlock'
import type { CombatEntity } from '../combat/CombatEntity'

function entity(overrides: Partial<CombatEntity> = {}): CombatEntity {
  const stats = { ...createBaseStats(), evasionRate: 0, criticalRate: 0, blockChance: 0, speed: 130, ...overrides.stats }
  return {
    id: 'fixture', name: 'Fixture', type: 'enemy', baseStats: stats, stats,
    currentHp: 100, maxHp: 100, currentMp: 0,
    currentSwordIntent: 0, currentMomentum: 0, currentHoaThe: 0, currentThoThe: 0, currentKimThe: 0,
    timeSinceLastBleedProc: 0, tuLucActive: false, tuLucElapsed: 0, tuLucDamageTakenPercent: 0,
    currentWard: 0, timeSinceLastHitTaken: Infinity, realmIndex: 0, x: 0, row: 2, alive: true,
    ...overrides,
  } as CombatEntity
}

const BASIC = { id: 'fixture_basic', cooldownTurns: 0, damage: { kind: 'physical' as const, multiplier: 1 }, targeting: { shape: 'single' as const } }

describe('toTurnBattleParticipant adapter', () => {
  it('wraps a CombatEntity with real speed stat, priority, fresh buff pool, and basic skill', () => {
    const combatEntity = entity({ id: 'player_1' })

    const participant = toTurnBattleParticipant(combatEntity, 0, BASIC)

    expect(participant.id).toBe('player_1')
    expect(participant.entity).toBe(combatEntity)
    expect(participant.speed).toBe(130)
    expect(participant.priority).toBe(0)
    expect(participant.actionGauge).toBe(0)
    expect(participant.alive).toBe(true)
    expect(participant.consecutiveHardCcTurns).toBe(0)
    expect(participant.buffs).toBeDefined()
    expect(participant.buffs.getAll()).toHaveLength(0)
    expect(participant.basic?.id).toBe('fixture_basic')
  })

  it('reflects entity.alive at wrap time', () => {
    const dead = entity({ alive: false })

    const participant = toTurnBattleParticipant(dead, 1, BASIC)

    expect(participant.alive).toBe(false)
  })
})
