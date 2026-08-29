import { describe, it, expect } from 'vitest'
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

    // Deps controlled-roll: luôn trúng 5%
    const alwaysSystem = new HiddenBeastSystem({ getEnemyTemplate: (id) => ({ id } as never) })
    const open = luyenKhiPlayer()
    open.luyenKhiKillsSinceBeast = HIDDEN_BEAST_KILL_THRESHOLD
    let sawBeast = 0
    for (let i = 0; i < 100; i++) {
      const replaced = alwaysSystem.maybeReplaceSpawn(open, 'qi_refining')
      if (replaced?.id === 'huyet_mong') sawBeast++
    }
    // 5%/spawn × 100 lần — chấp nhận khoảng dao động binomial rộng
    expect(sawBeast).toBeGreaterThan(0)
    expect(sawBeast).toBeLessThan(20)
  })

  it('maybeReplaceSpawn ngoài stage Luyện Khí → undefined', () => {
    const player = luyenKhiPlayer()
    player.luyenKhiKillsSinceBeast = HIDDEN_BEAST_KILL_THRESHOLD
    expect(system.maybeReplaceSpawn(player, 'foundation_establishment')).toBeUndefined()
  })
})
