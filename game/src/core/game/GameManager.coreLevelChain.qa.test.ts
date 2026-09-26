import { describe, expect, it } from 'vitest'
import { ManualClockSource, COMBAT_STEP_SECONDS } from '../battle/turn/CombatClock'
import { SeededCombatRng } from '../battle/runtime/rng/SeededCombatRng'
import { GameManager } from './GameManager'
import { createDefaultPlayer, type PlayerData } from '../player/Player'
import { freshSwordPathState } from '../kiem-tu/KiemTuState'
import { defineEnemy } from '../enemy/Enemy'
import { SKILLS } from '../../data/skill/Skills'
import { SKILL_CORE_NODES } from '../../data/progression/SkillCoreNodes'
import { HUY_QUYEN_L3_CASTS } from '../skill/CastLeveling'
import { isCultivationPathOffered } from '../player/CultivationPathKit'
import { HIDDEN_BODY_PATHWAY } from '../the-tu/TheTuPath'

// M-QI-05 adversarial QA - cross-system chains the unit tests cover
// only at their ends:
//   QA-1 cast channel -> skillCastCounts mirror + nodeLevels[core]
//       write -> hidden_body_pathway requiresSkillLevel offerGate.
//   QA-2 nodeLevels[core_orb] battle projection -> orb damage scales
//       through the adapter's levelScaling consumption end-to-end.
//       Combo extras inherit the triggering orb's level and carry the
//       stamped levelScaling (spec D11), so every player damage
//       channel scales 1.45x at Lv10 -> ratio ~1.45.

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

describe('QA-1 cast -> canonical core -> hidden way offerGate', () => {
  it('huy_quyen casts open hidden_body_pathway requiresSkillLevel gate', () => {
    const gameManager = new GameManager()
    gameManager.catalogOps.registerSkillTemplates(SKILLS)
    gameManager.catalogOps.registerProgressionNodes(SKILL_CORE_NODES)

    const player = createDefaultPlayer()
    gameManager.setActivePlayer(player)

    expect(gameManager.progressionOps.learnSkill('huy_quyen', player)).toBe(true)
    expect(isCultivationPathOffered(HIDDEN_BODY_PATHWAY, player)).toBe(false)

    for (let i = 0; i < HUY_QUYEN_L3_CASTS; i++) {
      gameManager.skillSystem.recordCast('huy_quyen')
    }

    expect(player.skillCastCounts?.huy_quyen).toBe(HUY_QUYEN_L3_CASTS)
    expect(player.nodeLevels?.core_huy_quyen).toBe(3)
    expect(isCultivationPathOffered(HIDDEN_BODY_PATHWAY, player)).toBe(true)
  })
})

describe('QA-2 canonical core level reaches combat damage', () => {
  function runSeededComboBattle(orbLevel: number): { hpLoss: number; comboFired: boolean } {
    const gameManager = new GameManager()
    const combatSource = new ManualClockSource()
    gameManager.setCombatClockSource(combatSource)
    gameManager.setBattleRngFactory(() => new SeededCombatRng(0xC0FFEE))
    gameManager.catalogOps.registerSkillTemplates(SKILLS)
    gameManager.catalogOps.registerProgressionNodes(SKILL_CORE_NODES)

    const player: PlayerData = createDefaultPlayer()
    player.cultivationPath = 'sword'
    player.cultivationWay = 'sword_pathway'
    player.realmId = 'golden_core'
    player.swordPath = { ...freshSwordPathState(), preset: ['orb_dam', 'orb_dam', 'orb_dam'] as never }

    // Mimic an upgraded granted core (grant writes both fields).
    player.nodeLevels = { ...player.nodeLevels, core_orb_dam: orbLevel }
    player.purchasedNodeIds = [...(player.purchasedNodeIds ?? []), 'core_orb_dam']

    gameManager.setActivePlayer(player)
    gameManager.progressionOps.learnSkill('tram', player)
    gameManager.startBattleWithPlayer(player, makeDummyEnemy('qa_enemy'))

    const impacts: Array<{ presetId?: string }> = []
    gameManager.eventBus.on('action_impact', (e) => impacts.push(e as { presetId?: string }))

    // 4 player turns: orb casts 1-3 build the combo; nhat_tuyen lands
    // on the 3rd cast as an extra impact lane.
    for (let i = 0; i < 4 * 40 + 80; i++) {
      combatSource.advance(COMBAT_STEP_SECONDS)
    }

    const enemy = gameManager.getTurnBattle()!.enemies[0]!.entity

    return {
      hpLoss: enemy.maxHp - enemy.currentHp,
      comboFired: impacts.some((e) => e.presetId === 'kiem_combo_nhat_tuyen'),
    }
  }

  it('orb Lv10 out-damages Lv1 through the real battle pipeline', () => {
    const lv1 = runSeededComboBattle(1)
    const lv10 = runSeededComboBattle(10)

    expect(lv1.comboFired).toBe(true)
    expect(lv10.comboFired).toBe(true)
    expect(lv1.hpLoss).toBeGreaterThan(0)

    // Orbs AND the generated combo damage carry levelScaling 0.05
    // (combo extras inherit the triggering orb's core level via
    // progressionOwnerId - spec D11), so every player damage channel
    // scales x1.45 at Lv10. Same seed -> identical rolls; a ratio at
    // ~1.45 proves the canonical level reached damage resolution
    // end-to-end through both seams.
    const ratio = lv10.hpLoss / lv1.hpLoss

    expect(ratio).toBeGreaterThan(1.42)
    expect(ratio).toBeLessThanOrEqual(1.46)
  })
})
