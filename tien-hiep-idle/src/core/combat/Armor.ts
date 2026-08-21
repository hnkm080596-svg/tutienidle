// Đường cong giảm dần kiểu Last Epoch — thay hẳn công thức trừ thẳng
// "attack - defense" cũ (dễ vô hiệu hoàn toàn hoặc vô dụng tuỳ chênh
// lệch, không mượt xuyên suốt game). Dùng cho damage type 'physical'
// (attack vs defense) — Hỗn Nguyên (primordial) KHÔNG đi qua đây
// (bỏ qua Armor hoàn toàn theo đúng yêu cầu).
const ARMOR_K = 50

// Trần 75% — không thể trở nên bất tử chỉ bằng cách stack Armor,
// đúng tinh thần Last Epoch thật.
const ARMOR_CAP = 0.75

/**
 * armor=10 (quái yếu) -> 10/60 ≈ 16.7%. armor=150 (build phòng thủ
 * nặng) -> 150/200 = 75% (chạm trần). Số ARMOR_K=50 chọn để khớp
 * biên độ attack/defense hiện tại (quái 5-30 defense, 10-35 attack) —
 * cần tinh chỉnh qua playtest, không phải số chốt cứng.
 */
export function getArmorMitigationPercent(armor: number): number {
  if (armor <= 0) {
    return 0
  }

  return Math.min(ARMOR_CAP, armor / (armor + ARMOR_K))
}
