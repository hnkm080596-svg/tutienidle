import { describe, expect, it } from 'vitest'
import { MAX_KIEM_THE, MAX_KIEM_Y_TEMP_CAP, KIEM_Y_DMG_TAKEN_GAIN_PER_MAXHP_PERCENT } from './CombatTypes'

// Kiếm Thế / Kiếm Ý (spec 2026-08-29-kiem-the-kiem-y) — hằng số nền
// của 2 tài nguyên route Kiếm Tu. Số liệu là "khởi điểm tinh chỉnh
// playtest" theo spec mục 2/3.2.
describe('Kiếm Tu resource constants', () => {
  it('MAX_KIEM_THE = 100 (pool trong trận route Kiếm Trận)', () => {
    expect(MAX_KIEM_THE).toBe(100)
  })

  it('MAX_KIEM_Y_TEMP_CAP = 900 (cap kiếm ý tạm cộng lên nền vĩnh viễn)', () => {
    expect(MAX_KIEM_Y_TEMP_CAP).toBe(900)
  })

  it('KIEM_Y_DMG_TAKEN_GAIN_PER_MAXHP_PERCENT = 5 (+1 kiếm ý mỗi 5% maxHP mất)', () => {
    expect(KIEM_Y_DMG_TAKEN_GAIN_PER_MAXHP_PERCENT).toBe(5)
  })
})
