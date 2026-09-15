// companion-gacha Task 8 - buildTurnBattle() must hand each companion's
// RESOLVED skill kit (resolveCompanionSkillKit: unlockThresholds gating +
// constellation skill_override perks) to toTurnBattleParticipant, and the
// entity built by companionToCombatEntity must carry companionStatsAt stats
// (realm-level growth x constellation x stat perks) plus a real realmIndex.
// These tests drive the real GameManager.startBattle() path - wiring proof,
// not a re-test of the resolver internals (those live in
// CompanionProgression.test.ts / CompanionCombat.test.ts).
import { afterEach, describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import { defineEnemy } from '../enemy/Enemy'
import { createBaseStats } from '../stats/StatBlock'
import { createDefaultPlayer, type PlayerData } from '../player/Player'
import type { CombatEntity } from '../combat/CombatEntity'
import type { CompanionDefinition, CompanionInstance } from '../../data/companion/Companions'
import { COMPANIONS } from '../../data/companion/Companions'
import { getRealmIndex } from '../realm/realmSystem'
import type { TurnBattleParticipant } from '../battle/turn/TurnBattleSystem'

// Fixture: special unlocks at qi_refining tier 5, ultimate at
// foundation_establishment tier 1 (so qi_refining instances never see it).
// Perks: +50% might at rank 1, special cooldown 4 -> 2 at rank 2.
const TEST_COMPANION_DEFINITION: CompanionDefinition = {
  id: 'test_companion_kit',
  name: 'Kit Test Companion',
  grade: 'hoang',
  growthRate: 0.05,
  unlockThresholds: {
    special: { realmId: 'qi_refining', realmLevel: 5 },
    ultimate: { realmId: 'foundation_establishment', realmLevel: 1 },
  },
  baseStats: { maxHp: 100, might: 10, speed: 100 },
  basic: {
    id: 'test_companion_kit_basic',
    cooldownTurns: 0,
    damage: { kind: 'physical', multiplier: 1 },
    targeting: { shape: 'single' },
  },
  special: {
    id: 'test_companion_kit_special',
    cooldownTurns: 4,
    damage: { kind: 'physical', multiplier: 1.5 },
    targeting: { shape: 'single' },
  },
  ultimate: {
    id: 'test_companion_kit_ultimate',
    cooldownTurns: 9,
    damage: { kind: 'physical', multiplier: 3 },
    targeting: { shape: 'single' },
  },
  constellationPerks: [
    { atRank: 1, kind: 'stat', stat: 'might', percent: 50 },
    { atRank: 2, kind: 'skill_override', slot: 'special', overrides: { cooldownTurns: 2 } },
  ],
}

function createPlayer(): CombatEntity {
  const stats = { ...createBaseStats(), might: 50, speed: 100, criticalRate: 0 }

  return {
    id: 'player', name: 'Player', type: 'player', baseStats: stats, stats,
    currentHp: stats.maxHp, maxHp: stats.maxHp, currentMp: stats.maxMp,
    timeSinceLastBleedProc: 0,
    currentMomentum: 0, currentHoaThe: 0, currentThoThe: 0, currentKimThe: 0,
    currentWard: 0, turnsSinceLastHitLanded: Infinity, realmIndex: 0, x: 0, row: 4, alive: true,
  }
}

function createDummy() {
  return defineEnemy({
    id: 'companion_kit_dummy', name: 'Companion Kit Dummy', level: 1, realmId: 'mortal', lane: 'ground',
    statsInput: { maxHp: 1, might: 0, attackSpeed: 1, criticalRate: 0, criticalDamage: 1.5, armor: 0 },
    rewards: { techniqueInsight: 0, spiritStone: 0 },
  })
}

function makeInstance(overrides: Partial<CompanionInstance> = {}): CompanionInstance {
  return {
    instanceId: 'kit_test_instance',
    definitionId: TEST_COMPANION_DEFINITION.id,
    realmId: 'mortal',
    realmLevel: 1,
    exp: 0,
    constellationRank: 0,
    ...overrides,
  }
}

// Builds a battle with the player + one companion assigned to formation
// cells, returns the companion participant from turnBattle.players.
function battleCompanionParticipant(instance: CompanionInstance): TurnBattleParticipant {
  const gameManager = new GameManager()
  const playerData: PlayerData = createDefaultPlayer()

  playerData.formationLoadout = {
    formationId: 'test_formation',
    assignments: [
      { row: 0, column: 0, combatantId: 'player' },
      { row: 1, column: 1, combatantId: TEST_COMPANION_DEFINITION.id },
    ],
  }
  playerData.companions = [instance]

  gameManager.setActivePlayer(playerData)
  gameManager.startBattle(createPlayer(), createDummy())

  const participant = gameManager
    .getTurnBattle()!
    .players.find((candidate) => candidate.id === TEST_COMPANION_DEFINITION.id)

  expect(participant).toBeDefined()

  return participant!
}

describe('GameManager.buildTurnBattle - companion resolved skill kit', () => {
  afterEach(() => {
    // Keep the shared module-level COMPANIONS clean between tests.
    const index = COMPANIONS.findIndex((candidate) => candidate.id === TEST_COMPANION_DEFINITION.id)
    if (index >= 0) {
      ;(COMPANIONS as unknown as (typeof COMPANIONS)[number][]).splice(index, 1)
    }
  })

  function pushDefinition(): void {
    ;(COMPANIONS as unknown as (typeof COMPANIONS)[number][]).push(TEST_COMPANION_DEFINITION)
  }

  it('companion below the special threshold gets basic only (no special/ultimate)', () => {
    pushDefinition()

    const participant = battleCompanionParticipant(makeInstance())

    expect(participant.basic?.id).toBe('test_companion_kit_basic')
    expect(participant.special).toBeUndefined()
    expect(participant.ultimate).toBeUndefined()
    expect(participant.entity.realmIndex).toBe(getRealmIndex('mortal'))
  })

  it('companion at the special threshold gets special.skill; ultimate still locked', () => {
    pushDefinition()

    const participant = battleCompanionParticipant(makeInstance({ realmId: 'qi_refining', realmLevel: 5 }))

    expect(participant.special?.skill.id).toBe('test_companion_kit_special')
    expect(participant.special?.skill.cooldownTurns).toBe(4)
    expect(participant.special?.remainingCooldownTurns).toBe(0)
    expect(participant.ultimate).toBeUndefined()
    expect(participant.entity.realmIndex).toBe(getRealmIndex('qi_refining'))
  })

  it('skill_override perk at constellation rank 2 rewrites special cooldown', () => {
    pushDefinition()

    const participant = battleCompanionParticipant(
      makeInstance({ realmId: 'qi_refining', realmLevel: 5, constellationRank: 2 }),
    )

    expect(participant.special?.skill.cooldownTurns).toBe(2)
    // The definition object itself is never mutated by resolution.
    expect(TEST_COMPANION_DEFINITION.special!.cooldownTurns).toBe(4)
  })

  it('entity stats include constellation multiplier and stat perks', () => {
    pushDefinition()

    // qi_refining/5 -> globalLevel 23 -> growth 1 + 0.05*22 = 2.1.
    // rank 2 -> constellation x1.2; might then takes +50% stat perk:
    // 10 * 2.1 * 1.2 = 25.2 -> *1.5 = 37.8 -> round 38.
    const participant = battleCompanionParticipant(
      makeInstance({ realmId: 'qi_refining', realmLevel: 5, constellationRank: 2 }),
    )

    expect(participant.entity.stats.might).toBe(38)
    expect(participant.entity.stats.maxHp).toBe(252)
    // speed is not Math.round'ed by companionStatsAt - compare approximately.
    expect(participant.entity.stats.speed).toBeCloseTo(120)
  })
})
