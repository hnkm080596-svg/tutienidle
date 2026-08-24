export interface TribulationProfile {
  durationSeconds: number
  strikeIntervalSeconds: number
  lightningMaxHpDamagePercent: number
}

// Cấu hình theo cảnh giới ĐÍCH của lần Độ Kiếp. Tách khỏi GameManager để
// cân bằng thời lượng và sát thương mà không phải sửa vòng lặp thời gian.
// Các cảnh giới Kim Đan+ hiện chưa mở trong progression, nhưng vẫn khai báo
// sẵn để API tổng quát không âm thầm dùng nhầm cấu hình Trúc Cơ.
export const TRIBULATION_PROFILES: Readonly<Record<string, TribulationProfile>> = {
  qi_refining: {
    durationSeconds: 12,
    strikeIntervalSeconds: 2,
    lightningMaxHpDamagePercent: 0.08,
  },
  foundation_establishment: {
    durationSeconds: 20,
    strikeIntervalSeconds: 2,
    lightningMaxHpDamagePercent: 0.13,
  },
  golden_core: {
    durationSeconds: 24,
    strikeIntervalSeconds: 2,
    lightningMaxHpDamagePercent: 0.15,
  },
  nascent_soul: {
    durationSeconds: 28,
    strikeIntervalSeconds: 2,
    lightningMaxHpDamagePercent: 0.17,
  },
  soul_transformation: {
    durationSeconds: 32,
    strikeIntervalSeconds: 2,
    lightningMaxHpDamagePercent: 0.19,
  },
  void_refinement: {
    durationSeconds: 36,
    strikeIntervalSeconds: 2,
    lightningMaxHpDamagePercent: 0.21,
  },
  body_integration: {
    durationSeconds: 40,
    strikeIntervalSeconds: 2,
    lightningMaxHpDamagePercent: 0.23,
  },
  mahayana: {
    durationSeconds: 44,
    strikeIntervalSeconds: 2,
    lightningMaxHpDamagePercent: 0.25,
  },
  tribulation: {
    durationSeconds: 50,
    strikeIntervalSeconds: 2,
    lightningMaxHpDamagePercent: 0.27,
  },
}

export function getTribulationProfile(targetRealmId: string): TribulationProfile | undefined {
  return TRIBULATION_PROFILES[targetRealmId]
}
