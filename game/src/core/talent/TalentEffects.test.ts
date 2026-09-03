import { describe, expect, it } from 'vitest'
import {
  collectTalentEffects,
  getAlchemySuccessBonusPercentPoints,
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

// Talent v4 (spec 2026-09-03) — các getter v3 vẫn còn cho kind được giữ
// (survive_lethal của Bất Tử Th thể, cultivation_speed của Phàm Cốt +
// Phàm Nhân Chi Cốt). Id v3 retired resolve được nhưng effects [] — mọi
// getter kinh tế v3 giờ trả giá trị mặc định với id retired (chính là
// hành vi "save cũ an toàn" của spec §4.4). Đa talent bị siết chỉ đọc id
// đầu (spec §3.2 — test riêng ở TalentsV4Wiring.test.ts).

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
    // M1: ngo_dao chưa về pool nhưng definition vẫn trong catalog v4
    // theo spec §4.3 — getter giữ nguyên hành vi 2000.
    expect(getInsightPerCultivation([])).toBeUndefined()
    expect(getInsightPerCultivation(['kiem_quang'])).toBeUndefined()
  })

  it('getter kinh tế v3 — id retired trả mặc định (không effect)', () => {
    expect(getInsightGainMultiplier(['dai_tri_nhuoc_ngu'])).toBe(1)
    expect(getSpiritStoneGainMultiplier(['tu_bao'])).toBe(1)
    expect(getEquipmentDropChanceMultiplier(['co_duyen'])).toBe(1)
    expect(getBodyRefinementProgressMultiplier(['luyen_the_ky_tai'])).toBe(1)
    expect(getAlchemySuccessBonusPercentPoints(['dan_duyen'])).toBe(0)
    expect(getReactionKeepChance(['phan_phac'])).toBe(0)
    expect(getHealOnKillMaxHpPercent(['huyet_chien'])).toBe(0)
  })
})
