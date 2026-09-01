// Đường cong giảm dần kiểu Last Epoch — thay hẳn công thức trừ thẳng
// "attack - defense" cũ (dễ vô hiệu hoàn toàn hoặc vô dụng tuỳ chênh
// lệch, không mượt xuyên suốt game). Dùng cho damage type 'physical'
// (attack vs defense) — Hỗn Nguyên (primordial) KHÔNG đi qua đây
// (bỏ qua Armor hoàn toàn theo đúng yêu cầu).
//
// T5.4 (2026-09-01, user-approved phương án A): K scale theo
// realmIndex của TARGET (bên chịu đòn) — K = 50 × (1 + realmIndex × 0.8).
// DNA Last Epoch giữ nguyên (armor cùng giá trị giảm hiệu lực dần theo
// tiến trình, ép farm armor mới khi lên realm), nhưng bậc là realm
// (10 bậc) thay vì per-level — khớp mô hình realm-tier của game, không
// phạt trong cùng realm (tầng không làm armor kém đi).
const ARMOR_K_BASE = 50
const ARMOR_K_PER_REALM = 0.8

// Trần 75% — không thể trở nên bất tử chỉ bằng cách stack Armor,
// đúng tinh thần Last Epoch thật.
const ARMOR_CAP = 0.75

/**
 * Hằng số K của đường cong armor theo realm của bên CHỊU ĐÒN.
 * Phàm Nhân (0): 50. Kim Đan (4): 210. Độ Kiếp (9): 410.
 */
export function armorKForRealm(realmIndex: number): number {
  const safeIndex = Number.isFinite(realmIndex) ? Math.max(0, realmIndex) : 0

  return ARMOR_K_BASE * (1 + safeIndex * ARMOR_K_PER_REALM)
}

/**
 * armor=10 (quái yếu, Phàm Nhân) -> 10/60 ≈ 16.7%. armor=150 ở
 * Phàm Nhân -> 150/200 = 75% (chạm trần); cùng armor 150 ở Độ Kiếp
 * (K=410) -> 27% — armor cũ tự giảm hiệu lực, đúng nhịp với attack
 * scale theo realm (mainStat globalLevel — 2 trục đi cùng nhịp).
 *
 * @param armor     chỉ số armor (defense) của bên chịu đòn
 * @param realmIndex realmIndex của bên chịu đòn (default 0 — giữ
 *                  tương thích callers cũ; hãy truyền từ CombatEntity)
 */
export function getArmorMitigationPercent(armor: number, realmIndex = 0): number {
  if (armor <= 0) {
    return 0
  }

  const k = armorKForRealm(realmIndex)

  return Math.min(ARMOR_CAP, armor / (armor + k))
}
