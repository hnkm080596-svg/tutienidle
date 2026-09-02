/** Nhân công tối đa theo cấp Chiêu Hiền Quán — công thức user chốt
 *  (roadmap 6C: "Nhân công tối đa = 1 + cấp Chiêu Hiền Quán × 2").
 *  Chưa xây CHQ (level 0) = 0 nhân công; cấp 1 → 3; cấp 9 → 19. */
export function getWorkerCapacityForLevel(chiHienQuanLevel: number): number {
  if (!Number.isFinite(chiHienQuanLevel) || chiHienQuanLevel <= 0) {
    return 0
  }

  return 1 + chiHienQuanLevel * 2
}
