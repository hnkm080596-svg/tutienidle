// HIDDEN-C - the ops seam for Nghich Chu Thien: investBodyChapter to
// 36/36 fires the discovery hook on BOTH invest paths, and
// realmAdvanceOps.attemptNghichChuTian routes the real materialBag.
import { describe, expect, it } from 'vitest'

import { materials } from '../../data/materials/materials'
import { pills } from '../../data/pill/pills'
import { MERIDIANS } from '../../data/realm/Meridians'
import {
  ZHOU_TIAN_CURRENCY_MATERIAL_ID,
  zhouTianStepCost,
} from '../../data/realm/ZhouTian'
import { SPIRIT_STONE_MATERIAL_ID } from '../material/SpiritStoneMaterial'
import { createDefaultPlayer } from '../player/Player'
import type { PlayerData } from '../player/Player'
import {
  getNghichChuTianMechanic,
  isNghichChuTianRevealed,
  nghichChuTianEssenceCost,
  nghichChuTianStoneCost,
} from '../realm/hidden/NghichChuTian'
import { GameManager } from './GameManager'

function managerWithCatalogs(): GameManager {
  const manager = new GameManager()
  manager.catalogOps.registerMaterials(materials)
  manager.catalogOps.registerPills(pills)
  return manager
}

/** A Truc Co Lv18 player with the sequential prereqs met, the lineage
 * open, and strict-prefix predecessors complete - one essence invest
 * away from Dai Chu Thien. */
function readyPlayer(): PlayerData {
  const player = createDefaultPlayer()
  player.realmId = 'foundation_establishment'
  player.realmLevel = 18
  player.physiqueGrade = 'bao'
  player.bodyProgression.body_refinement.completedTiers = 6
  player.bodyProgression.meridian.openedIds = MERIDIANS.map(m => m.id)
  player.hiddenPerfection.lineageActive = true
  player.hiddenPerfection.completedHiddenBodyRealmIds = ['mortal', 'qi_refining']
  return player
}

const TOTAL_STEP_COST = Array.from({ length: 36 }, (_, step) => zhouTianStepCost(step))
  .reduce((sum, cost) => sum + cost, 0)

/** Essence stacks clamp at MAX_STACK_AMOUNT (1000) and the full ladder
 * costs 3690 - the real game invests across refills, so mirror that
 * loop and return total consumed. */
function investZhouTianToDai(manager: GameManager, player: PlayerData): number {
  const essence = manager.materialRegistry.get(ZHOU_TIAN_CURRENCY_MATERIAL_ID)
  let consumed = 0
  while (player.bodyProgression.zhou_tian.completed < 36) {
    manager.materialBag.add(essence, 1000)
    const used = manager.realmAdvanceOps.investBodyChapter(player, 'zhou_tian')
    if (used <= 0) {
      break
    }
    consumed += used
  }
  return consumed
}

describe('GameManagerRealmAdvanceOps - Nghich Chu Thien seam', () => {
  it('investBodyChapter to 36/36 discovers the hidden continuation', () => {
    const manager = managerWithCatalogs()
    const player = readyPlayer()
    manager.setActivePlayer(player)

    // Before Dai: the continuation is undiscovered.
    expect(getNghichChuTianMechanic(player)).toBeUndefined()

    const consumed = investZhouTianToDai(manager, player)

    expect(consumed).toBe(TOTAL_STEP_COST)
    expect(player.bodyProgression.zhou_tian.completed).toBe(36)
    // Post-invest discovery: record + mechanic installed, active.
    const mechanic = getNghichChuTianMechanic(player)
    expect(mechanic).toEqual({
      kind: 'nghich_chu_tian',
      completed: 0,
      pityByLevel: [],
      active: true,
    })
    expect(isNghichChuTianRevealed(player)).toBe(true)
  })

  it('attemptNghichChuTian debits the real materialBag and advances on the locked 100% first level', () => {
    const manager = managerWithCatalogs()
    const player = readyPlayer()
    manager.setActivePlayer(player)
    investZhouTianToDai(manager, player)
    manager.materialBag.add(
      manager.materialRegistry.get(ZHOU_TIAN_CURRENCY_MATERIAL_ID),
      nghichChuTianEssenceCost(0),
    )
    manager.materialBag.add(
      manager.materialRegistry.get(SPIRIT_STONE_MATERIAL_ID),
      nghichChuTianStoneCost(0),
    )
    const essenceBefore = manager.materialBag.getAmount(ZHOU_TIAN_CURRENCY_MATERIAL_ID)
    const stonesBefore = manager.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)

    const result = manager.realmAdvanceOps.attemptNghichChuTian(player)

    // Level 0 locks p=1.0 - the first advancement can never fail.
    expect(result.outcome).toBe('success')
    expect(result.level).toBe(1)
    expect(essenceBefore - manager.materialBag.getAmount(ZHOU_TIAN_CURRENCY_MATERIAL_ID))
      .toBe(nghichChuTianEssenceCost(0))
    expect(stonesBefore - manager.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID))
      .toBe(nghichChuTianStoneCost(0))
    expect(getNghichChuTianMechanic(player)!.completed).toBe(1)
  })

  it('closed lineage: invest completes normally but the continuation never appears', () => {
    const manager = managerWithCatalogs()
    const player = readyPlayer()
    player.hiddenPerfection.lineageActive = false
    manager.setActivePlayer(player)

    investZhouTianToDai(manager, player)

    expect(player.bodyProgression.zhou_tian.completed).toBe(36)
    expect(getNghichChuTianMechanic(player)).toBeUndefined()
    expect(isNghichChuTianRevealed(player)).toBe(false)
    expect(
      manager.realmAdvanceOps.attemptNghichChuTian(player).outcome,
    ).toBe('ineligible')
  })
})
