import { describe, expect, it } from 'vitest'
import { createDefaultPlayer } from '../player/Player'
import { asBaseStats } from '../stats/StatBlock'
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

    expect(gameManager.startTribulation(player, 'qi_refining')).toBe(true)

    const active = gameManager.tribulationDirector.getState()
    expect(active).not.toBeNull()
    expect(active!.grade).toBe('human')
    expect(active!.chaptersTotal).toBe(2)
    expect(gameManager.getTurnBattle()).toBeNull()
  })

  it('startTribulation Trúc Cơ (đủ Địa Đạo): grade earth; thiếu đan → human', () => {
    const gameManager = new GameManager()
    // Đăng ký pills data thật để PillBag add/has Trúc Cơ Đan hoạt động
    // (GameManager trần chưa register gì — pattern các test khác).
    gameManager.catalogOps.registerPills(pills)
    const player = createDefaultPlayer()
    player.realmId = 'qi_refining'
    player.realmLevel = 12
    player.bodyProgression.body_refinement.completedTiers = 3

    // KHÔNG có Trúc Cơ Đan trong túi → human
    expect(gameManager.startTribulation(player, 'foundation_establishment')).toBe(true)
    expect(gameManager.tribulationDirector.getState()!.grade).toBe('human')
    gameManager.tribulationDirector.clear()

    // Có Trúc Cơ Đan → earth
    const trucCoDan = gameManager.pillRegistry.get('truc_co_dan')
    expect(trucCoDan).toBeDefined()
    gameManager.pillBag.add(trucCoDan!, 1)
    expect(gameManager.startTribulation(player, 'foundation_establishment')).toBe(true)
    expect(gameManager.tribulationDirector.getState()!.grade).toBe('earth')
  })

  it('answerTribulationQuestion xử lý câu hỏi (đúng → true, state câu kế)', () => {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()
    player.realmId = 'mortal'
    player.realmLevel = 12

    gameManager.startTribulation(player, 'qi_refining')
    const q = gameManager.tribulationDirector.getState()!.currentQuestion!
    expect(gameManager.tribulationDirector.answerQuestion(q.correctAnswerIndex)).toBe(true)
    expect(gameManager.tribulationDirector.answerQuestion(0)).toBe(false) // đang nghỉ giữa câu
  })

  it('unknown realm → start false', () => {
    const gameManager = new GameManager()
    expect(gameManager.startTribulation(createDefaultPlayer(), 'golden_core')).toBe(false)
    expect(gameManager.tribulationDirector.getState()).toBeNull()
  })

  it('update() chạy chương kiếp qua Director — hết kiếp sống sót thì state victory', () => {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()
    player.realmId = 'mortal'
    player.realmLevel = 12
    // ARCH-002 (M7): resolved internally — patch the raw base.
    player.baseStats = asBaseStats({ ...player.baseStats, maxHp: 5000, defense: 0, hpRegenPerTurn: 0 })

    gameManager.startTribulation(player, 'qi_refining')

    let guard = 0
    while (gameManager.tribulationDirector.getState()?.state === 'ongoing' && guard++ < 2000) {
      gameManager.tickOps.update(1)
      const q = gameManager.tribulationDirector.getState()!.currentQuestion
      if (q) gameManager.tribulationDirector.answerQuestion(q.correctAnswerIndex)
    }

    expect(gameManager.tribulationDirector.getState()!.state).toBe('victory')
  })

  it('KHÔNG còn craftBreakthroughToken/canCraftBreakthroughToken (Đột Phá Lệnh đã dỡ)', () => {
    const gameManager = new GameManager() as unknown as Record<string, unknown>
    expect(gameManager['craftBreakthroughToken']).toBeUndefined()
    expect(gameManager['canCraftBreakthroughToken']).toBeUndefined()
  })
})
