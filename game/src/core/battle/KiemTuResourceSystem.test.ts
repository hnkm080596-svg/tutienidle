import { describe, expect, it } from 'vitest'
import { MAX_KIEM_THE, MAX_KIEM_Y_TEMP_CAP } from '../combat/CombatTypes'
import {
  consumeKiemYTempFirst,
  gainKiemTheOnFormationCast,
  gainKiemYTempOnChannelTick,
  gainKiemYTempOnDamageTaken,
  initKiemTuBattleResources,
  kiemTheDamageBonusPercent,
  kiemYTempMaxFor,
} from './KiemTuResourceSystem'
import type { CombatEntity } from '../combat/CombatEntity'

function makeEntity(): CombatEntity {
  return { currentKiemThe: 0, currentKiemYTemp: 0 } as CombatEntity
}

// Spec 2026-08-29-kiem-the-kiem-y mục 2/3.2 — Kiếm Thế pool trận của
// route Kiếm Trận, Kiếm Ý tạm của route Bạt Kiếm (temp-first consume).
describe('KiemTuResourceSystem', () => {
  it('gain Kiếm Thế theo số kiếm cast, cap 100', () => {
    const e = makeEntity()
    gainKiemTheOnFormationCast(e, 2)
    expect(e.currentKiemThe).toBe(2)
    gainKiemTheOnFormationCast(e, 3)
    expect(e.currentKiemThe).toBe(5)
    for (let i = 0; i < 40; i++) gainKiemTheOnFormationCast(e, 3)
    expect(e.currentKiemThe).toBe(MAX_KIEM_THE)
  })

  it('init: KT reset Kiếm Thế; BK khởi đầu Kiếm Ý tạm = vĩnh viễn', () => {
    const kt = makeEntity()
    initKiemTuBattleResources(kt, 'kiem_tran', 0)
    expect(kt.currentKiemThe).toBe(0)
    expect(kt.currentKiemYTemp).toBe(0)
    const bk = makeEntity()
    initKiemTuBattleResources(bk, 'bat_kiem', 30)
    expect(bk.currentKiemYTemp).toBe(30)
    expect(bk.currentKiemThe).toBe(0)
  })

  it('consume ăn tạm trước, vĩnh viễn bất khả xâm phạm', () => {
    const e = makeEntity()
    e.currentKiemYTemp = 90
    expect(consumeKiemYTempFirst(e, 100, 10)).toBe(true)
    expect(e.currentKiemYTemp).toBe(0)
    // đủ 90 tạm + 10 vĩnh viễn nhưng tốn 101 → KHÔNG trừ gì
    const e2 = makeEntity()
    e2.currentKiemYTemp = 90
    expect(consumeKiemYTempFirst(e2, 101, 10)).toBe(false)
    expect(e2.currentKiemYTemp).toBe(90)
    // tạm 0, vĩnh viễn 10, tốn 10 → VẪN cast được (tổng đủ) nhưng tạm
    // không âm, vĩnh viễn giữ nguyên 10 — "nền đảm bảo" bất khả xâm phạm
    const e3 = makeEntity()
    e3.currentKiemYTemp = 0
    expect(consumeKiemYTempFirst(e3, 10, 10)).toBe(true)
    expect(e3.currentKiemYTemp).toBe(0)
  })

  it('damage taken gain: 12% maxHP mất = +2 Kiếm Ý tạm', () => {
    const e = makeEntity()
    gainKiemYTempOnDamageTaken(e, 0.12)
    expect(e.currentKiemYTemp).toBe(2)
    // phần lẻ dưới 5% không gom
    gainKiemYTempOnDamageTaken(e, 0.04)
    expect(e.currentKiemYTemp).toBe(2)
  })

  it('channel tick +1 Kiếm Ý, cap = vĩnh viễn + 900', () => {
    const e = makeEntity()
    initKiemTuBattleResources(e, 'bat_kiem', 10)
    for (let i = 0; i < 1000; i++) gainKiemYTempOnChannelTick(e, 10)
    expect(e.currentKiemYTemp).toBe(kiemYTempMaxFor(10))
    expect(e.currentKiemYTemp).toBe(10 + MAX_KIEM_Y_TEMP_CAP)
  })

  it('buff sát thương Kiếm Thế: 0 điểm = 0%, 100 điểm = 50%, 50 = 25%', () => {
    expect(kiemTheDamageBonusPercent(0)).toBe(0)
    expect(kiemTheDamageBonusPercent(100)).toBe(50)
    expect(kiemTheDamageBonusPercent(50)).toBe(25)
  })
})
