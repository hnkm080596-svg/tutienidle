import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import { calculateStats } from '../stats/StatCalculator'
import { defineEnemy } from '../enemy/Enemy'
import { SKILLS } from '../../data/skill/Skills'
import type { Stage } from '../stage/Stage'

// Phase A4 (2026-09-07) — Reaction Path gating: a Pháp Tu player who
// purchased ANY `reaction_path_unlock_<tag>` node gets the hidden path's
// marker special/ultimate in their turn battle participant instead of the
// element chain's. Gating reads player.nodeLevels (§6.8 authority — no
// skillManager learned-state dependency).

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

function makeEnemy(id: string) {
  return defineEnemy({
    id,
    name: id,
    level: 1,
    realmId: 'mortal',
    lane: 'ground',
    statsInput: { maxHp: 500, attack: 0, attackSpeed: 1, attackRangeRanks: 9, criticalRate: 0, criticalDamage: 1.5, armor: 0 },
    rewards: { techniqueInsight: 0, spiritStone: 0 },
  })
}

function makePlayer(path: 'phap_tu', withUnlock: boolean) {
  const player = createDefaultPlayer()

  player.cultivationPath = path
  player.realmId = 'qi_refining'
  player.realmLevel = 5
  // Thuần Hỏa pháp tu: chain element resolved to fire.
  player.nodeLevels['lap_dao_thuan_fire'] = 1

  if (withUnlock) {
    player.nodeLevels['reaction_path_unlock_fire'] = 1
  }

  return player
}

describe('Reaction Path gating + slot population (Phase A4)', () => {
  // Both variants learn the element chain skills (a progressing fire Pháp
  // Tu has them learned); only the unlock node differs.
  function learnChainSkills(manager: GameManager) {
    manager.learnSkill('tam_muoi_chan_hoa')
    manager.learnSkill('hoa_ha_cuu_thien')
  }

  it('reaction-awakened player gets the marker special/ultimate in their participant', () => {
    const manager = new GameManager()
    manager.registerSkillTemplates(SKILLS)

    const player = makePlayer('phap_tu', true)
    const enemy = makeEnemy('a4_dummy')
    const stage = makeStage('a4_stage', enemy.id)

    manager.registerEnemyTemplates([enemy])
    manager.registerStages([stage])
    manager.setActivePlayer(player)
    learnChainSkills(manager)

    const stats = calculateStats(player.baseStats, player.modifiers)
    expect(manager.startStage(player, stats, stage, false)).toBe(true)

    const participant = manager.getTurnBattle()!.players[0]!

    expect(participant.special?.skill.id).toBe('phap_tu_reaction_special')
    expect(participant.ultimate?.skill.id).toBe('phap_tu_reaction_ultimate')
  })

  it('non-awakened player keeps the element chain special/ultimate', () => {
    const manager = new GameManager()
    manager.registerSkillTemplates(SKILLS)

    const player = makePlayer('phap_tu', false)
    const enemy = makeEnemy('a4_dummy2')
    const stage = makeStage('a4_stage2', enemy.id)

    manager.registerEnemyTemplates([enemy])
    manager.registerStages([stage])
    manager.setActivePlayer(player)
    learnChainSkills(manager)

    const stats = calculateStats(player.baseStats, player.modifiers)
    expect(manager.startStage(player, stats, stage, false)).toBe(true)

    const participant = manager.getTurnBattle()!.players[0]!

    expect(participant.special?.skill.id).toBe('tam_muoi_chan_hoa')
    expect(participant.ultimate?.skill.id).toBe('hoa_ha_cuu_thien')
    // Authored chain-E nuke carries no resource gate (number-preserved
    // legacy data) — assert authored targeting shape, not an A3 'the' gate.
    expect(participant.ultimate?.skill.targeting).toEqual({ shape: 'line' })
  })
})
