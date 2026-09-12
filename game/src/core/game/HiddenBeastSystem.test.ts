import { describe, it, expect, vi } from 'vitest'
import { HiddenBeastSystem, HIDDEN_BEAST_KILL_THRESHOLD } from './HiddenBeastSystem'
import { createDefaultPlayer, type PlayerData } from '../player/Player'

function luyenKhiPlayer(): PlayerData {
  const player = createDefaultPlayer()
  player.realmId = 'qi_refining'
  return player
}

// Template stub — system chỉ cần object có id là đủ để test logic window.
const system = new HiddenBeastSystem({ getEnemyTemplate: (id) => ({ id } as never) })

describe('HiddenBeastSystem — cửa sổ quái ẩn (spec dot-pha-loi-kiep §4.1c)', () => {
  it('999 kill: cửa sổ ĐÓNG; 1000 kill: MỞ', () => {
    const player = luyenKhiPlayer()
    player.luyenKhiKillsSinceBeast = HIDDEN_BEAST_KILL_THRESHOLD - 1
    expect(system.isWindowOpen(player)).toBe(false)
    player.luyenKhiKillsSinceBeast = HIDDEN_BEAST_KILL_THRESHOLD
    expect(system.isWindowOpen(player)).toBe(true)
  })

  it('giết quái ẩn (kể cả không drop) → reset đếm về 0', () => {
    const player = luyenKhiPlayer()
    player.luyenKhiKillsSinceBeast = HIDDEN_BEAST_KILL_THRESHOLD + 50
    system.onEnemyDefeated(player, 'huyet_mong', 'qi_refining')
    expect(player.luyenKhiKillsSinceBeast).toBe(0)
  })

  it('giết quái THƯỜNG trong window: đếm tiếp tục tăng (KHÔNG reset)', () => {
    const player = luyenKhiPlayer()
    player.luyenKhiKillsSinceBeast = HIDDEN_BEAST_KILL_THRESHOLD
    system.onEnemyDefeated(player, 'pool_toad', 'qi_refining')
    expect(player.luyenKhiKillsSinceBeast).toBe(HIDDEN_BEAST_KILL_THRESHOLD + 1)
  })

  it('không phải quái Luyện Khí: đếm không đổi', () => {
    const player = luyenKhiPlayer()
    player.luyenKhiKillsSinceBeast = 500
    system.onEnemyDefeated(player, 'foundation_stone_fungus', 'foundation_establishment')
    expect(player.luyenKhiKillsSinceBeast).toBe(500)
  })

  it('maybeReplaceSpawn: window ĐÓNG → undefined; window MỞ + roll trúng → template Huyết Mông', () => {
    const closed = luyenKhiPlayer()
    closed.luyenKhiKillsSinceBeast = 0
    expect(system.maybeReplaceSpawn(closed, 'qi_refining')).toBeUndefined()

    // Deps controlled-roll. Math.random is PINNED (same discipline as
    // CombatSystem.skillScaling.test.ts, fd22f2b6): the old unpinned loop
    // "accepted real binomial variance" on 100 rolls of 5% -> ~0.59% chance
    // of zero hits per run, which surfaced as a full-suite flake. The pinned
    // sequence hits on every 20th roll -> exactly 5 hits in 100 rolls,
    // deterministically inside the (0, 20) bound below.
    const alwaysSystem = new HiddenBeastSystem({ getEnemyTemplate: (id) => ({ id } as never) })
    const open = luyenKhiPlayer()
    open.luyenKhiKillsSinceBeast = HIDDEN_BEAST_KILL_THRESHOLD
    let rollIndex = 0
    const randomSpy = vi.spyOn(Math, 'random').mockImplementation(() => (rollIndex++ % 20 === 0 ? 0.01 : 0.99))
    let sawBeast = 0
    for (let i = 0; i < 100; i++) {
      const replaced = alwaysSystem.maybeReplaceSpawn(open, 'qi_refining')
      if (replaced?.id === 'huyet_mong') sawBeast++
    }
    randomSpy.mockRestore()

    expect(sawBeast).toBeGreaterThan(0)
    expect(sawBeast).toBeLessThan(20)
  })

  it('maybeReplaceSpawn ngoài stage Luyện Khí → undefined', () => {
    const player = luyenKhiPlayer()
    player.luyenKhiKillsSinceBeast = HIDDEN_BEAST_KILL_THRESHOLD
    expect(system.maybeReplaceSpawn(player, 'foundation_establishment')).toBeUndefined()
  })
})
