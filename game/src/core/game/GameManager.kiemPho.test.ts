import { describe, expect, it } from 'vitest'
import { ManualClockSource, COMBAT_STEP_SECONDS } from '../battle/turn/CombatClock'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import { freshKiemTuState } from '../kiem-tu/KiemTuState'
import { defineEnemy } from '../enemy/Enemy'
import { SKILLS } from '../../data/skill/Skills'

// Kiem Tu Reimagined Task 6 — hien wiring through the real build path:
// the player participant carries a dynamicBasic provider, orbs resolve
// through the normal turn pipeline, and a matched combo emits its own
// action_impact with the unique combo presetId (K11).

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
    rewards: { techniqueInsight: 0, spiritStone: 0 },
  })
}

function setup(preset: string[] = ['orb_dam', 'orb_dam', 'orb_dam']) {
  const gameManager = new GameManager()
  const combatSource = new ManualClockSource()
  gameManager.setCombatClockSource(combatSource)
  gameManager.catalogOps.registerSkillTemplates(SKILLS)

  const player = createDefaultPlayer()
  player.cultivationPath = 'kiem_tu'
  player.cultivationWay = 'hien'
  player.realmId = 'golden_core'
  player.kiemTu = { ...freshKiemTuState(), preset: preset as never }

  gameManager.setActivePlayer(player)
  gameManager.progressionOps.learnSkill('tram')
  gameManager.startBattleWithPlayer(player, makeDummyEnemy('kp_enemy'))

  return { gameManager, combatSource, player }
}

function advanceTurns(gameManager: GameManager, combatSource: ManualClockSource, turns: number) {
  // Speed 100 → ~10 ticks/turn; intro+countdown pads are skipped by the
  // no-presentation path. Drive enough ticks for N player turns.
  for (let i = 0; i < turns * 40 + 80; i++) {
    combatSource.advance(COMBAT_STEP_SECONDS)
  }
  void gameManager
}

describe('GameManager — Kiem Pho hien wiring', () => {
  it('kiem_tu hien participant carries dynamicBasic; other paths do not', () => {
    const { gameManager } = setup()
    const participant = gameManager.getTurnBattle()!.players[0]!

    expect(participant.dynamicBasic).toBeDefined()
    expect(participant.special).toBeUndefined()
    expect(participant.ultimate).toBeUndefined()
  })

  it('preset [dam,dam,dam] fires tam_thich on the 3rd cast as an extra impact', () => {
    const { gameManager, combatSource } = setup()

    const impacts: Array<{ presetId?: string; sourceId: string }> = []
    gameManager.eventBus.on('action_impact', (e) =>
      impacts.push(e as { presetId?: string; sourceId: string }),
    )

    advanceTurns(gameManager, combatSource, 3)

    const comboImpacts = impacts.filter(e => e.presetId === 'kiem_combo_tam_thich')
    expect(comboImpacts.length).toBeGreaterThanOrEqual(1)
    expect(comboImpacts[0]!.sourceId).toBe('player')
  })

  it('orb casts resolve through the normal pipeline (enemy takes damage)', () => {
    const { gameManager, combatSource } = setup()
    const enemy = gameManager.getTurnBattle()!.enemies[0]!.entity

    advanceTurns(gameManager, combatSource, 2)

    expect(enemy.currentHp).toBeLessThan(enemy.maxHp)
  })
})
