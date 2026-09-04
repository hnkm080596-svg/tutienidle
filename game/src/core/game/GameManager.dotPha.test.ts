import { describe, expect, it } from 'vitest'
import { createDefaultPlayer } from '../player/Player'
import { createBaseStats } from '../stats/StatBlock'
import { GameManager } from './GameManager'
import { pills } from '../../data/pill/pills'

// GameManager facade mới (spec dot-pha-loi-kiep §5.1) — TribulationSystem
// cũ đã bị dỡ thay bằng TribulationDirector: KHÔNG còn battle mode
// 'tribulation' (getBattle() null suốt kiếp), state bậc + chương nằm
// trong getActiveTribulation() (ActiveTribulationState mới).
describe('GameManager — facade TribulationDirector', () => {
  it('startTribulation Quán Khí: getActiveTribulation() có grade + 2 chương, KHÔNG có battle', () => {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()
    player.realmId = 'mortal'
    player.realmLevel = 12

    expect(gameManager.startTribulation(player, createBaseStats(), 'qi_refining')).toBe(true)

    const active = gameManager.getActiveTribulation()
    expect(active).not.toBeNull()
    expect(active!.grade).toBe('human')
    expect(active!.chaptersTotal).toBe(2)
    expect(gameManager.getBattle()).toBeNull()
  })

  it('startTribulation Trúc Cơ (đủ Địa Đạo): grade earth; thiếu đan → human', () => {
    const gameManager = new GameManager()
    // Đăng ký pills data thật để PillBag add/has Trúc Cơ Đan hoạt động
    // (GameManager trần chưa register gì — pattern các test khác).
    gameManager.registerPills(pills)
    const player = createDefaultPlayer()
    player.realmId = 'qi_refining'
    player.realmLevel = 12
    player.bodyRefinementCompletedTiers = 3

    // KHÔNG có Trúc Cơ Đan trong túi → human
    expect(gameManager.startTribulation(player, createBaseStats(), 'foundation_establishment')).toBe(true)
    expect(gameManager.getActiveTribulation()!.grade).toBe('human')
    gameManager.clearActiveTribulation()

    // Có Trúc Cơ Đan → earth
    const trucCoDan = gameManager.pillRegistry.get('truc_co_dan')
    expect(trucCoDan).toBeDefined()
    gameManager.pillBag.add(trucCoDan!, 1)
    expect(gameManager.startTribulation(player, createBaseStats(), 'foundation_establishment')).toBe(true)
    expect(gameManager.getActiveTribulation()!.grade).toBe('earth')
  })

  it('answerTribulationQuestion xử lý câu hỏi (đúng → true, state câu kế)', () => {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()
    player.realmId = 'mortal'
    player.realmLevel = 12

    gameManager.startTribulation(player, createBaseStats(), 'qi_refining')
    const q = gameManager.getActiveTribulation()!.currentQuestion!
    expect(gameManager.answerTribulationQuestion(q.correctAnswerIndex)).toBe(true)
    expect(gameManager.answerTribulationQuestion(0)).toBe(false) // đang nghỉ giữa câu
  })

  it('unknown realm → start false', () => {
    const gameManager = new GameManager()
    expect(gameManager.startTribulation(createDefaultPlayer(), createBaseStats(), 'golden_core')).toBe(false)
    expect(gameManager.getActiveTribulation()).toBeNull()
  })

  it('update() chạy chương kiếp qua Director — hết kiếp sống sót thì state victory', () => {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()
    player.realmId = 'mortal'
    player.realmLevel = 12
    const stats = createBaseStats()
    stats.maxHp = 5000
    stats.defense = 0
    stats.hpRegenPerTurn = 0

    gameManager.startTribulation(player, stats, 'qi_refining')

    let guard = 0
    while (gameManager.getActiveTribulation()?.state === 'ongoing' && guard++ < 2000) {
      gameManager.update(1)
      const q = gameManager.getActiveTribulation()!.currentQuestion
      if (q) gameManager.answerTribulationQuestion(q.correctAnswerIndex)
    }

    expect(gameManager.getActiveTribulation()!.state).toBe('victory')
  })

  it('KHÔNG còn craftBreakthroughToken/canCraftBreakthroughToken (Đột Phá Lệnh đã dỡ)', () => {
    const gameManager = new GameManager() as unknown as Record<string, unknown>
    expect(gameManager['craftBreakthroughToken']).toBeUndefined()
    expect(gameManager['canCraftBreakthroughToken']).toBeUndefined()
  })
})
