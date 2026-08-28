// Đoán Bảo Thạch — tỉ lệ rơi theo tier quái (doc §6), tập trung ở
// đây thay vì rải vào enemy definitions. Chỉ roll khi
// getRealmIndex(enemy.realmId) >= getRealmIndex('foundation_establishment')
// (xem BattleLootSystem.grantArtifactStoneDrop()). Mỗi quái chỉ dùng
// đúng MỘT dòng cao nhất — Boss không roll thêm bảng Elite/Thường.
export const ARTIFACT_STONE_DROP_CHANCE = {
  normal: 0.02,
  elite: 0.08,
  boss: 0.25,
} as const

export const ARTIFACT_STONE_BOSS_QUANTITY_MIN = 1
export const ARTIFACT_STONE_BOSS_QUANTITY_MAX = 2
