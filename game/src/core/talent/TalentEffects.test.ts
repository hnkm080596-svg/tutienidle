import { describe, expect, it } from 'vitest'
import {
  collectTalentEffects,
  getAlchemyDoublePill,
  getEnhanceGuarantee,
  getBodyRefinementProgressMultiplier,
  getCultivationSpeedMultiplier,
  getCultivationSpeedPercent,
  getEquipmentDropChanceMultiplier,
  getHealOnKillMaxHpPercent,
  getInsightGainMultiplier,
  getInsightPerCultivation,
  getReactionKeepChance,
  getSpiritStoneGainMultiplier,
  getSurviveLethalUsesPerBattle,
} from './TalentEffects'

// Talent v4 (spec 2026-09-03) - cac getter v3 van con cho kind duoc giu
// (survive_lethal cua Bat Tu Th the, cultivation_speed cua Pham Cot +
// Pham Nhan Chi Cot). Id v3 retired resolve duoc nhung effects [] - moi
// getter kinh te v3 gio tra gia tri mac dinh voi id retired (chinh la
// hanh vi "save cu an toan" cua spec S4.4). Da talent bi siet chi doc id
// dau (spec S3.2 - test rieng o TalentsV4Wiring.test.ts).

describe('collectTalentEffects', () => {
  it('gom effect từ thiên phú đã chọn', () => {
    const effects = collectTalentEffects(['bat_tu_the'])
    expect(effects.some(e => e.kind === 'survive_lethal')).toBe(true)
    expect(effects.some(e => e.kind === 'combat_passive')).toBe(true)
  })

  it('id lạ trong save cũ bị bỏ qua an toàn', () => {
    expect(collectTalentEffects(['unknown_talent'])).toHaveLength(0)
  })

  it('id retired resolve được nhưng KHÔNG còn effect (an toàn save cũ)', () => {
    expect(collectTalentEffects(['nghich_thien'])).toEqual([])
    expect(collectTalentEffects(['tu_bao'])).toEqual([])
  })
})

describe('M3 — production talent getters (spec 2026-09-03 §4.2)', () => {
  it('Hỏa Hầu Thông Thần — trả bộ multiplier đan đôi/potency/chi phí', () => {
    expect(getAlchemyDoublePill(['hoa_hau_thong_than'])).toEqual({
      yieldMultiplier: 2,
      potencyMultiplier: 1.5,
      costMultiplier: 2,
    })
  })

  it('không có talent đan → undefined (hành vi mặc định nguyên vẹn)', () => {
    expect(getAlchemyDoublePill([])).toBeUndefined()
    expect(getAlchemyDoublePill(undefined)).toBeUndefined()
    expect(getAlchemyDoublePill(['kiem_quang'])).toBeUndefined()
  })

  it('Bách Luyện Thành Khí — trả costMultiplier của cường hóa bảo đảm', () => {
    expect(getEnhanceGuarantee(['bach_luyen_thanh_khi'])).toEqual({ costMultiplier: 3 })
  })

  it('không có talent khí → undefined', () => {
    expect(getEnhanceGuarantee([])).toBeUndefined()
    expect(getEnhanceGuarantee(['hoa_hau_thong_than'])).toBeUndefined()
  })

  it('đa talent (M-F-TALENT supersede §3.2) — id thứ hai cũng kích hoạt', () => {
    expect(getAlchemyDoublePill(['kiem_quang', 'hoa_hau_thong_than'])).toEqual({
      yieldMultiplier: 2,
      potencyMultiplier: 1.5,
      costMultiplier: 2,
    })
    expect(getEnhanceGuarantee(['kiem_quang', 'bach_luyen_thanh_khi'])).toEqual({ costMultiplier: 3 })
  })
})

describe('getCultivationSpeedMultiplier', () => {
  it('không có thiên phú tu luyện -> ×1.00', () => {
    expect(getCultivationSpeedMultiplier([])).toBe(1)
    expect(getCultivationSpeedMultiplier(['kiem_quang'])).toBe(1)
  })

  it('Phàm Cốt trừ 75% -> ×0.25 (2.5/s với base 10/s)', () => {
    expect(getCultivationSpeedPercent(['pham_cot'])).toBeCloseTo(-0.75)
    expect(getCultivationSpeedMultiplier(['pham_cot'])).toBeCloseTo(0.25)
  })

  it('Phàm Nhân Chi Cốt (thưởng Đại Đạo) cộng 75% -> ×1.75', () => {
    expect(getCultivationSpeedMultiplier(['pham_nhan_chi_cot'])).toBeCloseTo(1.75)
  })

  it('id retired ở đầu danh sách — không kéo tốc độ tu (effect rỗng)', () => {
    expect(getCultivationSpeedMultiplier(['tien_thien_dao_the'])).toBe(1)
    expect(getCultivationSpeedMultiplier(['nghich_thien'])).toBe(1)
  })

  it('guard không bao giờ về 0 hoặc âm', () => {
    expect(getCultivationSpeedMultiplier(['pham_cot', 'pham_cot', 'pham_cot', 'pham_cot'])).toBeGreaterThanOrEqual(0.01)
  })
})

describe('getter còn hiệu lực với kind v3 được giữ', () => {
  it('Bất Tử Th thể 1 lượt sống sót mỗi trận', () => {
    expect(getSurviveLethalUsesPerBattle(['bat_tu_the'])).toBe(1)
    expect(getSurviveLethalUsesPerBattle([])).toBe(0)
  })

  it('Ngộ Đạo — kind insight_per_cultivation vẫn hoạt động cho M2 (id về pool M2)', () => {
    // M1: ngo_dao chua ve pool nhung definition van trong catalog v4
    // theo spec S4.3 - getter giu nguyen hanh vi 2000.
    expect(getInsightPerCultivation([])).toBeUndefined()
    expect(getInsightPerCultivation(['kiem_quang'])).toBeUndefined()
  })

  it('getter kinh tế v3 — id retired trả mặc định (không effect)', () => {
    expect(getInsightGainMultiplier(['dai_tri_nhuoc_ngu'])).toBe(1)
    expect(getSpiritStoneGainMultiplier(['tu_bao'])).toBe(1)
    expect(getEquipmentDropChanceMultiplier(['co_duyen'])).toBe(1)
    expect(getBodyRefinementProgressMultiplier(['luyen_the_ky_tai'])).toBe(1)
    expect(getReactionKeepChance(['phan_phac'])).toBe(0)
    expect(getHealOnKillMaxHpPercent(['huyet_chien'])).toBe(0)
  })
})
