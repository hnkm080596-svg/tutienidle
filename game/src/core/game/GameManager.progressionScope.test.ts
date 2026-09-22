import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'

describe('GameManager current realm progression scope', () => {
  it('mortal tầng 12 → canTriggerBreakthrough true', () => {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()
    player.realmId = 'mortal'
    player.realmLevel = 12

    expect(gameManager.realmAdvanceOps.canTriggerBreakthrough(player)).toBe(true)
  })

  it('mortal tầng 11 → canTriggerBreakthrough false', () => {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()
    player.realmId = 'mortal'
    player.realmLevel = 11

    expect(gameManager.realmAdvanceOps.canTriggerBreakthrough(player)).toBe(false)
  })

  it('qi_refining tầng 12 + Quật 10 clear → canTriggerBreakthrough true', () => {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()
    player.realmId = 'qi_refining'
    player.realmLevel = 12
    player.completedStageIds = ['qi_refining_abyssal_pool']

    expect(gameManager.realmAdvanceOps.canTriggerBreakthrough(player)).toBe(true)
  })

  it('qi_refining tầng 12 chưa clear Quật 10 → canTriggerBreakthrough false', () => {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()
    player.realmId = 'qi_refining'
    player.realmLevel = 12
    player.completedStageIds = [
      'qi_refining_forest',
      'qi_refining_deep_forest',
      'qi_refining_ember_canyon',
      'qi_refining_scorched_ridge',
      'qi_refining_sand_plain',
      'qi_refining_stone_range',
      'qi_refining_blade_peak',
      'qi_refining_mineral_pit',
      'qi_refining_mystic_marsh',
    ]

    expect(gameManager.realmAdvanceOps.canTriggerBreakthrough(player)).toBe(false)
  })

  it('qi_refining tầng 11 đã clear Quật 10 → canTriggerBreakthrough false (cả 2 điều kiện bắt buộc)', () => {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()
    player.realmId = 'qi_refining'
    player.realmLevel = 11
    player.completedStageIds = ['qi_refining_abyssal_pool']

    expect(gameManager.realmAdvanceOps.canTriggerBreakthrough(player)).toBe(false)
  })

  it('không mở đột phá sau Trúc Cơ tầng 18', () => {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()
    player.realmId = 'foundation_establishment'
    player.realmLevel = 18

    expect(gameManager.realmAdvanceOps.canTriggerBreakthrough(player)).toBe(false)
  })

  it('không mở API tổng quát cho các realm placeholder', () => {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()
    player.realmId = 'golden_core'
    player.realmLevel = 9

    expect(gameManager.realmAdvanceOps.canTriggerBreakthrough(player)).toBe(false)
  })
})
