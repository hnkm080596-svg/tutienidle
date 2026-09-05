import { describe, expect, it, vi } from 'vitest'
import { GameManager } from './GameManager'
import { defineEnemy } from '../enemy/Enemy'
import { createBaseStats } from '../stats/StatBlock'
import { HERO_LANE_INDEX, HERO_COLUMN } from '../battle/BattleLane'
import type { CombatEntity } from '../combat/CombatEntity'
import type { Skill } from '../skill/Skill'

// Formation slot deliberately DISTINCT from HERO_LANE_INDEX(4)/HERO_COLUMN(1)
// so this test can only pass if buildTurnBattle() actually reads
// DEFAULT_PARTY_FORMATION. Legacy BattleSystem.start() unconditionally
// writes HERO_LANE_INDEX/HERO_COLUMN onto the same CombatEntity right before
// buildTurnBattle() runs, so without the formation-lookup block the entity
// would still land on HERO_LANE_INDEX/HERO_COLUMN — a formation-agnostic
// buildTurnBattle() would fail the assertions below instead of coincidentally
// passing. MOCK_ROW/MOCK_COLUMN stay inside PLAYER_SIDE_REGION (rows 3-8,
// columns 0-5).
vi.mock('./PartyFormation', () => ({
  DEFAULT_PARTY_FORMATION: [{ combatantId: 'player', row: 6, column: 3 }],
}))

// Mirror of the literals baked into the vi.mock factory above — vi.mock is
// hoisted above top-level const declarations, so the factory cannot close
// over named constants; keep these in sync with the object literal above.
const MOCK_ROW = 6
const MOCK_COLUMN = 3

function createPlayer(): CombatEntity {
  const stats = { ...createBaseStats(), attack: 50, speed: 100, criticalRate: 0 }

  return {
    id: 'player', name: 'Player', type: 'player', baseStats: stats, stats,
    currentHp: stats.maxHp, maxHp: stats.maxHp, currentMp: stats.maxMp,
    currentSwordIntent: 0, currentMomentum: 0, currentHoaThe: 0, currentThoThe: 0, currentKimThe: 0,
    timeSinceLastBleedProc: 0, tuLucActive: false, tuLucElapsed: 0, tuLucDamageTakenPercent: 0,
    currentWard: 0, timeSinceLastHitTaken: Infinity, realmIndex: 0, x: 0, row: 4, alive: true,
  }
}

function createBasicSkill(): Skill {
  return {
    id: 'basic_test', name: 'Basic', description: '', type: 'active', level: 1, maxLevel: 10,
    cooldown: 0, remainingCooldown: 0, cost: 0, target: 'enemy',
    effects: [{ type: 'damage', value: 1, damageType: 'physical' }],
    execution: { kind: 'attack_speed' }, resourceType: 'none',
    unlocked: true, equipped: true, loadoutSlot: 0, loadoutSlots: [0],
  }
}

function createDummy() {
  return defineEnemy({
    id: 'formation_dummy', name: 'Formation Dummy', level: 1, realmId: 'mortal', lane: 'ground',
    statsInput: { maxHp: 1, attack: 0, attackSpeed: 1, attackRangeRanks: 9, criticalRate: 0, criticalDamage: 1.5, armor: 0 },
    rewards: { techniqueInsight: 0, spiritStone: 0 },
  })
}

describe('GameManager.buildTurnBattle — reads DEFAULT_PARTY_FORMATION when no formation is configured', () => {
  it('places the player at the MOCKED formation slot, not at HERO_LANE_INDEX/HERO_COLUMN — proves buildTurnBattle() is driven by DEFAULT_PARTY_FORMATION', () => {
    const gameManager = new GameManager()
    const player = createPlayer()

    gameManager.registerSkillTemplates([createBasicSkill()])
    gameManager.learnSkill('basic_test')
    gameManager.skillSystem.equipToSlot('basic_test', 0)
    gameManager.startBattle(player, createDummy())

    const battle = gameManager.getTurnBattle()!

    expect(battle.players).toHaveLength(1)
    expect(battle.players[0]!.id).toBe('player')
    expect(battle.players[0]!.entity.row).toBe(MOCK_ROW)
    expect(battle.players[0]!.entity.x).toBe(MOCK_COLUMN)
    // Sanity: the mocked slot really is different from the legacy default —
    // otherwise this assertion would pass for the wrong reason.
    expect(MOCK_ROW).not.toBe(HERO_LANE_INDEX)
    expect(MOCK_COLUMN).not.toBe(HERO_COLUMN)
  })
})
