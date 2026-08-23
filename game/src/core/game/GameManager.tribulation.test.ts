import { describe, expect, it } from 'vitest'
import type { CombatEvent } from '../combat/CombatEvent'
import { createDefaultPlayer } from '../player/Player'
import { createBaseStats } from '../stats/StatBlock'
import { TRIBULATION_PROFILES } from '../breakthrough/TribulationProfile'
import { GameManager } from './GameManager'

function startTribulation(targetRealmId: string, defense = 0) {
  const gameManager = new GameManager()
  const player = createDefaultPlayer()
  const stats = createBaseStats()

  stats.defense = defense

  expect(gameManager.startTribulation(player, stats, targetRealmId)).toBe(true)

  return gameManager
}

describe('GameManager — Độ Kiếp sinh tồn', () => {
  it('dùng thời lượng và sát thương lôi kiếp theo cảnh giới đích', () => {
    const qiRefining = startTribulation('qi_refining')
    const foundation = startTribulation('foundation')
    let qiDamage = 0
    let foundationDamage = 0

    qiRefining.eventBus.on<CombatEvent>('damage', event => { qiDamage += event.value ?? 0 })
    foundation.eventBus.on<CombatEvent>('damage', event => { foundationDamage += event.value ?? 0 })

    qiRefining.update(TRIBULATION_PROFILES.qi_refining!.strikeIntervalSeconds)
    foundation.update(TRIBULATION_PROFILES.foundation!.strikeIntervalSeconds)

    expect(qiRefining.getActiveTribulation()?.durationSeconds).toBe(12)
    expect(foundation.getActiveTribulation()?.durationSeconds).toBe(20)
    expect(qiDamage).toBeCloseTo(8)
    expect(foundationDamage).toBeCloseTo(13)
  })

  it('catch-up đủ mọi lôi kích khi Chromium gom cả trận vào một tick dài', () => {
    const gameManager = startTribulation('foundation', 10_000)
    const profile = TRIBULATION_PROFILES.foundation!
    let strikeCount = 0

    gameManager.eventBus.on<CombatEvent>('damage', () => { strikeCount++ })

    gameManager.update(profile.durationSeconds + 30)

    expect(strikeCount).toBe(profile.durationSeconds / profile.strikeIntervalSeconds)
    expect(gameManager.getActiveTribulation()?.secondsRemaining).toBe(0)
    expect(gameManager.getBattle()?.state).toBe('victory')
  })

  it('không cho target realm chưa có profile âm thầm dùng cấu hình sai', () => {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()

    expect(gameManager.startTribulation(player, createBaseStats(), 'unknown_realm')).toBe(false)
    expect(gameManager.getBattle()).toBeNull()
  })
})
