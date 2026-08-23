import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'

describe('GameManager current realm progression scope', () => {
  it('không mở đột phá sau Trúc Cơ tầng 18', () => {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()
    player.realmId = 'foundation'
    player.realmLevel = 18

    expect(gameManager.canTriggerRealmBreakthrough(player)).toBe(false)
  })

  it('không mở API tổng quát cho các realm placeholder', () => {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()
    player.realmId = 'golden_core'
    player.realmLevel = 9

    expect(gameManager.canTriggerRealmBreakthrough(player)).toBe(false)
  })
})
