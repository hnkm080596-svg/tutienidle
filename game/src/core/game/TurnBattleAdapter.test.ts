import { describe, expect, it } from 'vitest'
import { toTurnBattleParticipant } from './TurnBattleAdapter'
import { createBaseStats } from '../stats/StatBlock'
import type { CombatEntity } from '../combat/CombatEntity'
import type { TurnSkillDefinition } from '../battle/turn/TurnSkillAction'

function entity(overrides: Partial<CombatEntity> = {}): CombatEntity {
  const stats = createBaseStats({ evasionRate: 0, criticalRate: 0, blockChance: 0, speed: 130, ...overrides.stats })
  return {
    id: 'fixture', name: 'Fixture', type: 'enemy', baseStats: stats, stats,
    currentHp: 100, maxHp: 100, currentMp: 0,
    currentWard: 0, turnsSinceLastHitLanded: Infinity, realmIndex: 0, x: 0, row: 2, alive: true,
    ...overrides,
  } as CombatEntity
}

const BASIC = { id: 'fixture_basic', cooldownTurns: 0, damage: { kind: 'physical' as const, multiplier: 1 }, targeting: { shape: 'single' as const } }

describe('toTurnBattleParticipant adapter', () => {
  it('wraps a CombatEntity with real speed stat, priority, and basic skill', () => {
    const combatEntity = entity({ id: 'player_1' })

    const participant = toTurnBattleParticipant(combatEntity, 0, BASIC)

    expect(participant.id).toBe('player_1')
    expect(participant.entity).toBe(combatEntity)
    expect(participant.speed).toBe(130)
    expect(participant.priority).toBe(0)
    expect(participant.actionGauge).toBe(0)
    expect(participant.alive).toBe(true)
    expect(participant.consecutiveHardCcTurns).toBe(0)
    expect(participant.basic?.id).toBe('fixture_basic')
  })

  it('reflects entity.alive at wrap time', () => {
    const dead = entity({ alive: false })

    const participant = toTurnBattleParticipant(dead, 1, BASIC)

    expect(participant.alive).toBe(false)
  })

  it('a resolved domain list grants the declared active domains', () => {
    // M5 — the adapter takes the way-resolved domain list; path-id ->
    // domain mapping lives upstream (resolveActiveWayStatDomains).
    const participant = toTurnBattleParticipant(entity(), 0, BASIC, ['phap_tu'])

    expect(participant.activeDomains?.has('phap_tu')).toBe(true)
  })

  it('kiem_tu domains grant kiem_tu — and NOT phap_tu', () => {
    const participant = toTurnBattleParticipant(entity(), 0, BASIC, ['kiem_tu'])

    expect(participant.activeDomains?.has('kiem_tu')).toBe(true)
    expect(participant.activeDomains?.has('phap_tu')).toBe(false)
  })

  it('the the_tu_an way domain is distinct from the hien family domain', () => {
    const participant = toTurnBattleParticipant(entity(), 0, BASIC, ['the_tu_an'])

    expect(participant.activeDomains?.has('the_tu_an')).toBe(true)
    expect(participant.activeDomains?.has('the_tu')).toBe(false)
  })

  it('no domains (enemy/companion) leaves activeDomains undefined', () => {
    const participant = toTurnBattleParticipant(entity(), 0, BASIC)

    expect(participant.activeDomains).toBeUndefined()
  })

})


describe('Kiem Tu Reimagined Task 6 — no buildId special/ultimate map', () => {
  it('kiem_tu domains grant NO special/ultimate — hien kit is the orb preset; ngu emblems arrive via override (Task 9)', () => {
    const participant = toTurnBattleParticipant(entity(), 0, BASIC, ['kiem_tu'])

    expect(participant.special).toBeUndefined()
    expect(participant.ultimate).toBeUndefined()
  })

  it('a participant without resolved domains has no special', () => {
    const participant = toTurnBattleParticipant(entity(), 0, BASIC)

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

    const participant = toTurnBattleParticipant(combatEntity, 0, BASIC, ['phap_tu'], {
      special: SPECIAL,
      ultimate: ULTIMATE,
    })

    expect(participant.special?.skill.id).toBe('tam_muoi_chan_hoa')
    expect(participant.ultimate?.skill.id).toBe('hoa_ha_cuu_thien')
    expect(participant.ultimate?.remainingCooldownTurns).toBe(0)
  })

  it('override takes precedence over the domain slot (Pháp Tu no longer silently empty)', () => {
    const combatEntity = entity()

    // The domain list only declares stat-domain ownership — the
    // special/ultimate slots come solely from the resolved override.
    const participant = toTurnBattleParticipant(combatEntity, 0, BASIC, ['phap_tu'], { special: SPECIAL })

    expect(participant.special?.skill.id).toBe('tam_muoi_chan_hoa')
  })

  it('omits both slots when no override is resolved', () => {
    const combatEntity = entity()

    const participant = toTurnBattleParticipant(combatEntity, 0, BASIC, ['phap_tu'])

    expect(participant.special).toBeUndefined()
    expect(participant.ultimate).toBeUndefined()
  })

  it('a Kiem Tu player gets slots only via the resolved override (ngu emblems, Task 9) — domains alone map nothing', () => {
    const combatEntity = entity()

    const participant = toTurnBattleParticipant(combatEntity, 0, BASIC, ['kiem_tu'])
    expect(participant.special).toBeUndefined()
    expect(participant.ultimate).toBeUndefined()

    const withEmblems = toTurnBattleParticipant(combatEntity, 0, BASIC, ['kiem_tu'], {
      special: SPECIAL,
      ultimate: ULTIMATE,
    })
    expect(withEmblems.special?.skill.id).toBe('tam_muoi_chan_hoa')
    expect(withEmblems.ultimate?.skill.id).toBe('hoa_ha_cuu_thien')
  })
})
