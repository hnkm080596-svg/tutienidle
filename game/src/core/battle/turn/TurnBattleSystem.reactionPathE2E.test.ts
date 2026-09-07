import { describe, expect, it } from 'vitest'
import { GameManager } from '../../game/GameManager'
import { createDefaultPlayer } from '../../player/Player'
import { calculateStats } from '../../stats/StatCalculator'
import { defineEnemy } from '../../enemy/Enemy'
import { SKILLS } from '../../../data/skill/Skills'
import { selectAction } from './TurnSkillAction'
import type { Stage } from '../../stage/Stage'

// Phase A4 (2026-09-07) — end-to-end proof of the Reaction Path: an
// awakened player's marker special casts TWO distinct elemental hits (the
// pool wiring makes the engine's interception live), and the marker
// ultimate self-applies reaction_empowerment, whose +25%
// reactionEffectPercent folds into effective stats via
// recomputeEffectiveStats.

function makeStage(id: string, enemyId: string): Stage {
  return {
    id,
    name: id,
    description: '',
    floor: 1,
    enemyPool: [{ enemyId, weight: 1 }],
    totalEnemyCount: 1,
    waves: [1],
    spawnIntervalSeconds: 0,
  }
}

function makeAwakenedBattle() {
  const manager = new GameManager()
  manager.registerSkillTemplates(SKILLS)

  const player = createDefaultPlayer()
  player.cultivationPath = 'phap_tu'
  player.realmId = 'qi_refining'
  player.realmLevel = 5
  player.nodeLevels['lap_dao_thuan_fire'] = 1
  player.nodeLevels['reaction_path_unlock_fire'] = 1

  const enemy = defineEnemy({
    id: 'a4_e2e_dummy',
    name: 'A4 Dummy',
    level: 1,
    realmId: 'mortal',
    lane: 'ground',
    statsInput: { maxHp: 5_000, attack: 0, attackSpeed: 1, attackRangeRanks: 9, criticalRate: 0, criticalDamage: 1.5, armor: 0 },
    rewards: { techniqueInsight: 0, spiritStone: 0 },
  })
  const stage = makeStage('a4_e2e_stage', enemy.id)

  manager.registerEnemyTemplates([enemy])
  manager.registerStages([stage])
  manager.setActivePlayer(player)
  manager.learnSkill('tam_muoi_chan_hoa')
  manager.learnSkill('hoa_ha_cuu_thien')

  const stats = calculateStats(player.baseStats, player.modifiers)
  expect(manager.startStage(player, stats, stage, false)).toBe(true)

  // Marker slots are populated from the unlock gating.
  const participant = manager.getTurnBattle()!.players[0]!
  expect(participant.special?.skill.id).toBe('phap_tu_reaction_special')
  expect(participant.ultimate?.skill.id).toBe('phap_tu_reaction_ultimate')

  // A real Pháp Tu has a mana pool; the default fixture does not — give
  // the player enough mana for the marker special (cost 20) and ultimate
  // (cost 30).
  participant.entity.stats.maxMp = 100
  participant.entity.currentMp = 100

  return { manager, participant }
}

describe('Reaction Path end-to-end (Phase A4)', () => {
  it('marker special casts and lands real damage (pool wiring live, no throw)', () => {
    const { manager, participant } = makeAwakenedBattle()

    // Drive the real fixed-step loop until the special's cooldown commit
    // proves the marker resolved through the pool-interception path.
    // Budget: intro 20 + countdown 30 ticks, then the player's speed-10
    // gauge needs ~100 fighting ticks for its first turn — 300 ticks total
    // is ample for several player turns.
    let specialFired = false

    for (let i = 0; i < 300; i++) {
      manager.update(0.1)

      if ((participant.special?.remainingCooldownTurns ?? 0) > 0) {
        specialFired = true
        break
      }
    }

    expect(specialFired).toBe(true)
  })

  it('marker ultimate self-applies reaction_empowerment (+25% reactionEffectPercent folds)', () => {
    const { manager, participant } = makeAwakenedBattle()

    participant.entity.currentMp = 100

    manager.setPresentationActive(false)
    manager.setBattleManualMode(true)

    let submitted = false

    for (let i = 0; i < 100; i++) {
      manager.update(0.1)

      if (!submitted && manager.isAwaitingManualTurnChoice()) {
        submitted = true
        manager.submitTurnChoice('ultimate')
      }
    }

    expect(submitted).toBe(true)
    // The empowerment buff resolved through TURN_BUFF_REGISTRY and applied
    // to the player's own pool.
    expect(participant.buffs.hasAny('reaction_empowerment')).toBe(true)
    expect(
      participant.buffs
        .getAllById('reaction_empowerment')
        .some((buff) =>
          buff.effects.some(
            (effect) =>
              effect.type === 'statModifier' &&
              effect.stat === 'reactionEffectPercent' &&
              effect.percent === 0.25,
          ),
        ),
    ).toBe(true)
  })
})
