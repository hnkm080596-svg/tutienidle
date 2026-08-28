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

describe('collectTalentEffects', () => {
  it('gom effect từ mọi thiên phú đã chọn', () => {
    const effects = collectTalentEffects(['nghich_thien'])
    expect(effects).toHaveLength(2)
    expect(effects.some(e => e.kind === 'cultivation_speed')).toBe(true)
    expect(effects.some(e => e.kind === 'insight_gain')).toBe(true)
  })

  it('id lạ trong save cũ bị bỏ qua an toàn', () => {
    expect(collectTalentEffects(['unknown_talent'])).toHaveLength(0)
    expect(collectTalentEffects(['unknown_talent', 'pham_cot'])).toHaveLength(1)
  })
})

describe('getCultivationSpeedMultiplier', () => {
  it('không có thiên phú tu luyện -> ×1.00', () => {
    expect(getCultivationSpeedMultiplier([])).toBe(1)
    expect(getCultivationSpeedMultiplier(['tu_bao'])).toBe(1)
  })

  it('Tiên Thiên Đạo Thể cộng 100%', () => {
    expect(getCultivationSpeedPercent(['tien_thien_dao_the'])).toBeCloseTo(1)
    expect(getCultivationSpeedMultiplier(['tien_thien_dao_the'])).toBeCloseTo(2)
  })

  it('Phàm Cốt trừ 75% -> ×0.25 (2.5/s với base 10/s)', () => {
    expect(getCultivationSpeedPercent(['pham_cot'])).toBeCloseTo(-0.75)
    expect(getCultivationSpeedMultiplier(['pham_cot'])).toBeCloseTo(0.25)
  })

  it('Nghịch Thiên +50%, Đại Trí Nhược Ngu −25%', () => {
    expect(getCultivationSpeedMultiplier(['nghich_thien'])).toBeCloseTo(1.5)
    expect(getCultivationSpeedMultiplier(['dai_tri_nhuoc_ngu'])).toBeCloseTo(0.75)
  })

  it('save cũ 3 thiên phú cultivation_speed vẫn cộng dồn', () => {
    expect(getCultivationSpeedMultiplier(['tien_thien_dao_the', 'nghich_thien'])).toBeCloseTo(2.5)
  })

  it('guard không bao giờ về 0 hoặc âm', () => {
    expect(getCultivationSpeedMultiplier(['pham_cot', 'pham_cot', 'pham_cot', 'pham_cot'])).toBeGreaterThanOrEqual(0.01)
  })
})

describe('getInsightGainMultiplier', () => {
  it('mặc định ×1', () => {
    expect(getInsightGainMultiplier([])).toBe(1)
  })

  it('Đại Trí Nhược Ngu ×2, Nghịch Thiên −30%', () => {
    expect(getInsightGainMultiplier(['dai_tri_nhuoc_ngu'])).toBeCloseTo(2)
    expect(getInsightGainMultiplier(['nghich_thien'])).toBeCloseTo(0.7)
  })

  it('guard không âm', () => {
    expect(getInsightGainMultiplier(['nghich_thien', 'nghich_thien', 'nghich_thien', 'nghich_thien'])).toBeGreaterThanOrEqual(0)
  })
})

describe('getInsightPerCultivation', () => {
  it('không có Ngộ Đạo -> undefined', () => {
    expect(getInsightPerCultivation([])).toBeUndefined()
    expect(getInsightPerCultivation(['tu_bao'])).toBeUndefined()
  })

  it('Ngộ Đạo -> 2000 tu vi / Cảm Ngộ', () => {
    expect(getInsightPerCultivation(['ngo_dao'])).toBe(2000)
  })
})

describe('getter các hook kinh tế / chế tạo', () => {
  it('Tụ Bảo +50% Linh Thạch', () => {
    expect(getSpiritStoneGainMultiplier(['tu_bao'])).toBeCloseTo(1.5)
    expect(getSpiritStoneGainMultiplier([])).toBe(1)
  })

  it('Cơ Duyên +50% tỷ lệ rơi trang bị', () => {
    expect(getEquipmentDropChanceMultiplier(['co_duyen'])).toBeCloseTo(1.5)
    expect(getEquipmentDropChanceMultiplier([])).toBe(1)
  })

  it('Luyện Thể Kỳ Tài ×2 tiến độ', () => {
    expect(getBodyRefinementProgressMultiplier(['luyen_the_ky_tai'])).toBeCloseTo(2)
    expect(getBodyRefinementProgressMultiplier([])).toBe(1)
  })

  it('Đan Duyên +15 điểm % thành đan', () => {
    expect(getAlchemySuccessBonusPercentPoints(['dan_duyen'])).toBe(15)
    expect(getAlchemySuccessBonusPercentPoints([])).toBe(0)
  })
})

describe('getter các hook chiến đấu', () => {
  it('Bất Tử Thể 1 lượt sống sót mỗi trận', () => {
    expect(getSurviveLethalUsesPerBattle(['bat_tu_the'])).toBe(1)
    expect(getSurviveLethalUsesPerBattle([])).toBe(0)
  })

  it('Phản Phác 25% giữ trạng thái', () => {
    expect(getReactionKeepChance(['phan_phac'])).toBeCloseTo(0.25)
    expect(getReactionKeepChance([])).toBe(0)
  })

  it('Huyết Chiến hồi 2% max HP mỗi kill', () => {
    expect(getHealOnKillMaxHpPercent(['huyet_chien'])).toBeCloseTo(0.02)
    expect(getHealOnKillMaxHpPercent([])).toBe(0)
  })
})
