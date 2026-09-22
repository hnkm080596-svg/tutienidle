import { describe, expect, it } from 'vitest'
import { ManualClockSource, COMBAT_STEP_SECONDS } from '../battle/turn/CombatClock'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import { freshSwordPathState } from '../kiem-tu/KiemTuState'
import { forgeCost } from '../kiem-tu/NguKiemDao'
import { defineEnemy } from '../enemy/Enemy'
import { SKILLS } from '../../data/skill/Skills'
import { SKILL_CORE_NODES } from '@/data/progression/SkillCoreNodes'

// Kiem Tu Reimagined Task 9 — ngu wiring through the real build path:
// emblem slots on the participant, multi-instance casts land N hits,
// and each resolved cast banks +1 Kiem Y.

const ENEMY_STATS_INPUT = {
  maxHp: 10_000_000,
  might: 0,
  attackSpeed: 1,
  criticalRate: 0,
  criticalDamage: 1.5,
  armor: 0,
  evasionRate: 0,
}

function makeDummyEnemy(id: string) {
  return defineEnemy({
    id,
    name: 'Dummy',
    level: 1,
    realmId: 'mortal',
    lane: 'ground',
    statsInput: { ...ENEMY_STATS_INPUT },
    rewards: { techniqueMastery: 0, spiritStone: 0 },
  })
}

function setup(kiemDaoCount = 3) {
  const gameManager = new GameManager()
  const combatSource = new ManualClockSource()
  gameManager.setCombatClockSource(combatSource)
  gameManager.catalogOps.registerSkillTemplates(SKILLS)
  gameManager.catalogOps.registerProgressionNodes(SKILL_CORE_NODES)

  const player = createDefaultPlayer()
  player.cultivationPath = 'sword'
  player.cultivationWay = 'hidden_sword_pathway'
  player.realmId = 'golden_core'
  player.swordPath = { ...freshSwordPathState(), kiemDaoCount }

  gameManager.setActivePlayer(player)
  gameManager.progressionOps.learnSkill('tram', player)
  gameManager.startBattleWithPlayer(player, makeDummyEnemy('ngu_enemy'))

  return { gameManager, combatSource, player }
}

function advanceTurns(combatSource: ManualClockSource, turns: number) {
  for (let i = 0; i < turns * 40 + 80; i++) {
    combatSource.advance(COMBAT_STEP_SECONDS)
  }
}

describe('GameManager — ngu participant wiring', () => {
  it('carries dynamicBasic + tu_kiem_y/kiem_dao_cascade emblem slots', () => {
    const { gameManager } = setup()
    const participant = gameManager.getTurnBattle()!.players[0]!

    expect(participant.dynamicBasic).toBeDefined()
    expect(participant.special?.skill.id).toBe('tu_kiem_y')
    expect(participant.special?.skill.emblemOnly).toBe(true)
    expect(participant.ultimate?.skill.id).toBe('kiem_dao_cascade')
    expect(participant.ultimate?.skill.emblemOnly).toBe(true)
  })

  it('one cast resolves kiemDaoCount independent hits (multi-instance)', () => {
    const { gameManager, combatSource } = setup(3)
    const impacts: Array<{ sourceId: string }> = []
    gameManager.eventBus.on('action_impact', (e) =>
      impacts.push(e as { sourceId: string }),
    )

    advanceTurns(combatSource, 1)

    // The player turn emits one action_impact per resolved hit instance
    // (multi-instance fires count hit events on the same target).
    const playerImpacts = impacts.filter(e => e.sourceId === 'player')
    expect(playerImpacts.length).toBeGreaterThanOrEqual(3)
  })

  it('each resolved cast banks +1 Kiem Y via the provider hook', () => {
    const { gameManager, combatSource, player } = setup()

    advanceTurns(combatSource, 2)

    expect(player.swordPath!.kiemY).toBeGreaterThanOrEqual(2)
    expect(player.swordPath!.kiemY).toBeLessThanOrEqual(forgeCost(3))
  })
})
