import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'

describe('GameManager current realm progression scope', () => {
  it('mortal tầng 12 → canTriggerBreakthrough true', () => {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()
    player.realmId = 'mortal'
    player.realmLevel = 12

    expect(gameManager.canTriggerBreakthrough(player)).toBe(true)
  })

  it('mortal tầng 11 → canTriggerBreakthrough false', () => {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()
    player.realmId = 'mortal'
    player.realmLevel = 11

    expect(gameManager.canTriggerBreakthrough(player)).toBe(false)
  })

  it('qi_refining tầng 12 → canTriggerBreakthrough true', () => {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()
    player.realmId = 'qi_refining'
    player.realmLevel = 12

    expect(gameManager.canTriggerBreakthrough(player)).toBe(true)
  })

  it('không mở đột phá sau Trúc Cơ tầng 18', () => {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()
    player.realmId = 'foundation_establishment'
    player.realmLevel = 18

    expect(gameManager.canTriggerBreakthrough(player)).toBe(false)
  })

  it('không mở API tổng quát cho các realm placeholder', () => {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()
    player.realmId = 'golden_core'
    player.realmLevel = 9

    expect(gameManager.canTriggerBreakthrough(player)).toBe(false)
  })
})
