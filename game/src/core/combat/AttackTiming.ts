// electron-combat-timing-smoothing-plan.md mục 9 — công thức DUY NHẤT
// quy đổi attackSpeed -> khoảng cách giữa 2 lần kích hoạt (giây) cho
// nhịp đánh enemy và cadence Attack Speed của skill execution policy
// 'attack_speed'/'attack_speed_cast'.
// Trước đây `1 / Math.max(1, attackSpeed)` bị lặp lại ở 3 nơi
// và có bug: MỌI attackSpeed < 1 vẫn bị ép về đúng 1 đòn/giây (Math.max
// sàn ở 1, không phải ở attackSpeed), khiến debuff làm chậm (giảm
// attackSpeed xuống dưới 1) hoàn toàn vô tác dụng ở baseline. Sàn giờ
// chuyển sang tính bằng "số đòn/giây tối thiểu" (MIN_ATTACKS_PER_SECOND)
// thay vì sàn cứng trên attackSpeed — chỉ chặn interval tiến tới vô cực
// khi attackSpeed <= 0, không còn che mất hiệu ứng làm chậm hợp lệ.
export const MIN_ATTACKS_PER_SECOND = 0.05

export function getAttackIntervalSeconds(attackSpeed: number): number {
  return 1 / Math.max(MIN_ATTACKS_PER_SECOND, attackSpeed)
}
