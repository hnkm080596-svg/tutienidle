import { describe, expect, it } from 'vitest'
import { ManualClockSource } from '../battle/turn/CombatClock'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import { defineEnemy } from '../enemy/Enemy'
import type { Stage } from '../stage/Stage'
import { SKILLS } from '../../data/skill/Skills'
import { PHAP_TU_NODES } from '../../data/progression/PhapTuNodes'
import { PHAP_TU_ULTIMATE_IDS } from '../../data/skill/PhapTuUltimates'
import { PHAP_TU_EMPOWERMENT_THE_THRESHOLD } from '../phap-tu/PhapTuRoutes'

// Phap Tu Reimagined Task 10 — the empowerment ATTACH lives in
// orchestration (A8): resolvePlayerSpecialUltimate adds `empowerment`
// to the equipped chain-E ultimate only when the player owns
// `linh_ngo_<godUltId>`, and the route profile picks the payload
// variant ('dot' -> detonate, 'no' -> nuke).

function makeManager() {
  const gameManager = new GameManager()
  gameManager.setCombatClockSource(new ManualClockSource())
  gameManager.catalogOps.registerSkillTemplates(SKILLS)
  gameManager.catalogOps.registerProgressionNodes(PHAP_TU_NODES)

  const bossTemplate = defineEnemy({
    id: 'empower_boss', name: 'Empower Boss', level: 1, realmId: 'mortal', lane: 'ground', isBoss: true,
    statsInput: { maxHp: 1_000_000, might: 0, attackSpeed: 1, criticalRate: 0, criticalDamage: 1.5, armor: 0 },
    rewards: { techniqueInsight: 0, spiritStone: 0 },
  })

  const stage: Stage = {
    id: 'empower_stage', name: 'Empower Stage', description: '',
    floor: 10, bossEnemyId: 'empower_boss',
    enemyPool: [{ enemyId: 'empower_boss', weight: 1 }],
    totalEnemyCount: 1, waves: [1],
    spawnIntervalSeconds: 0,
  }

  gameManager.catalogOps.registerEnemyTemplates([bossTemplate])
  gameManager.catalogOps.registerStages([stage])

  const player = createDefaultPlayer()
  player.cultivationPath = 'phap_tu'
  // The realm-gated special node (golden_core) grants the kit's
  // remaining slots — [special, chain-E ult] — so a golden_core player
  // with insight can learn the ultimate.
  player.realmId = 'golden_core'
  player.skillInsight = 100
  gameManager.setActivePlayer(player)

  return { gameManager, player, stage }
}

/** Learns the kit's ultimate via the realm-gated special node. */
function learnKitUltimate(gameManager: GameManager, player: ReturnType<typeof createDefaultPlayer>, specialId: string) {
  expect(gameManager.progressionOps.purchaseNode(`linh_ngo_${specialId}`, player)).toBe(true)
}

function ultimateSkillOf(gameManager: GameManager) {
  return gameManager.getTurnBattle()!.players[0]!.ultimate?.skill
}

describe('god-ult empowerment attach (Task 10)', () => {
  it('no linh_ngo node -> the chain-E ultimate carries NO empowerment', () => {
    const { gameManager, player, stage } = makeManager()

    gameManager.progressionOps.selectPhapTuElement('fire', 'no', player)
    learnKitUltimate(gameManager, player, 'tam_muoi_chan_hoa')
    expect(gameManager.turnBattleOps.startStage(player, stage, true)).toBe(true)

    const ult = ultimateSkillOf(gameManager)
    expect(ult?.id).toBe('hoa_ha_cuu_thien')
    expect(ult?.empowerment).toBeUndefined()
  })

  it('linh_ngo owned -> empowerment attaches; route picks the variant payload', () => {
    const { gameManager, player, stage } = makeManager()

    gameManager.progressionOps.selectPhapTuElement('fire', 'no', player)
    learnKitUltimate(gameManager, player, 'tam_muoi_chan_hoa')
    player.nodeLevels[`linh_ngo_${PHAP_TU_ULTIMATE_IDS.fire}`] = 1

    expect(gameManager.turnBattleOps.startStage(player, stage, true)).toBe(true)

    const ult = ultimateSkillOf(gameManager)
    expect(ult?.id).toBe('hoa_ha_cuu_thien')
    expect(ult?.empowerment?.theThreshold).toBe(PHAP_TU_EMPOWERMENT_THE_THRESHOLD)
    expect(ult?.empowerment?.empowered.id).toBe('tat_phuong_giang_the')
    expect(ult?.empowerment?.empowered.consumesAllThe).toBe(true)
  })

  it('the empowered payload follows the route variant key (dot -> detonate entry)', () => {
    const { gameManager, player, stage } = makeManager()

    gameManager.progressionOps.selectPhapTuElement('water', 'dot', player)
    learnKitUltimate(gameManager, player, 'thanh_tuyen_duong_linh')
    player.nodeLevels[`linh_ngo_${PHAP_TU_ULTIMATE_IDS.water}`] = 1

    expect(gameManager.turnBattleOps.startStage(player, stage, true)).toBe(true)

    const ult = ultimateSkillOf(gameManager)
    expect(ult?.id).toBe('bac_hai_cuong_lan')
    expect(ult?.empowerment?.empowered.id).toBe('bat_thu_can_quet')
  })
})
