import { describe, expect, it } from 'vitest'
import { toTurnBattleParticipant } from './TurnBattleAdapter'
import { createBaseStats } from '../stats/StatBlock'
import type { CombatEntity } from '../combat/CombatEntity'
import type { TurnSkillDefinition } from '../battle/turn/TurnSkillAction'

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


describe('Future Systems Task 8 â€” Kiáº¿m Tu special = Báº¡t Kiáº¿m Thuáº­t (2-phase charge)', () => {
  it('kiem_tu participant nháº­n special bat_kiem_thuat vá»›i chargeTurns 3 + multiplier 3', () => {
    const participant = toTurnBattleParticipant(entity(), 0, BASIC, 'kiem_tu')

    expect(participant.special?.skill.id).toBe('bat_kiem_thuat')
    expect(participant.special?.skill.chargeTurns).toBe(3)
    expect(participant.special?.skill.damage).toEqual({ kind: 'physical', multiplier: 3 })
    expect(participant.special?.remainingCooldownTurns).toBe(0)
  })

  it('build khÃ¡c (pham_nhan) KHÃ”NG cÃ³ special', () => {
    const participant = toTurnBattleParticipant(entity(), 0, BASIC, 'pham_nhan')

    expect(participant.special).toBeUndefined()
  })
})

describe('Phase A2 â€” bossTrigger population on spawn', () => {
  it('populates bossTrigger with firedAlready: false when entity.bossTrigger is set', () => {
    const combatEntity = entity({ bossTrigger: { afterTurns: 60, buffDefinitionId: 'fixture_enrage' } })

    const participant = toTurnBattleParticipant(combatEntity, 0, BASIC)

    expect(participant.bossTrigger).toEqual({
      afterTurns: 60,
      buffDefinitionId: 'fixture_enrage',
      firedAlready: false,
    })
  })

  it('leaves bossTrigger undefined when entity.bossTrigger is not set', () => {
    const combatEntity = entity()

    const participant = toTurnBattleParticipant(combatEntity, 0, BASIC)

    expect(participant.bossTrigger).toBeUndefined()
  })
})

describe('Phase A3 — resolved special/ultimate override (Pháp Tu buildId fix)', () => {
  const SPECIAL: TurnSkillDefinition = {
    id: 'tam_muoi_chan_hoa',
    cooldownTurns: 3,
    damage: { kind: 'elemental', components: [{ kind: 'element', element: 'fire', ratio: 1 }], multiplier: 1.3 },
    targeting: { shape: 'single' },
  }

  const ULTIMATE: TurnSkillDefinition = {
    id: 'hoa_ha_cuu_thien',
    cooldownTurns: 8,
    resourceType: 'mana',
    resourceCost: 30,
    damage: { kind: 'elemental', components: [{ kind: 'element', element: 'fire', ratio: 1 }], multiplier: 2 },
    targeting: { shape: 'single' },
  }

  it('populates special/ultimate from the resolved override when provided', () => {
    const combatEntity = entity()

    const participant = toTurnBattleParticipant(combatEntity, 0, BASIC, 'phap_tu', {
      special: SPECIAL,
      ultimate: ULTIMATE,
    })

    expect(participant.special?.skill.id).toBe('tam_muoi_chan_hoa')
    expect(participant.ultimate?.skill.id).toBe('hoa_ha_cuu_thien')
    expect(participant.ultimate?.remainingCooldownTurns).toBe(0)
  })

  it('override takes precedence over the static buildId map (Pháp Tu no longer silently empty)', () => {
    const combatEntity = entity()

    // 'phap_tu' as buildId matches nothing in SPECIALS_BY_BUILD (the A3
    // Component 1 bug) — but with the override the slots still populate.
    const participant = toTurnBattleParticipant(combatEntity, 0, BASIC, 'phap_tu', { special: SPECIAL })

    expect(participant.special?.skill.id).toBe('tam_muoi_chan_hoa')
  })

  it('omits both slots when neither override nor matching buildId exists', () => {
    const combatEntity = entity()

    const participant = toTurnBattleParticipant(combatEntity, 0, BASIC, 'phap_tu')

    expect(participant.special).toBeUndefined()
    expect(participant.ultimate).toBeUndefined()
  })
})
