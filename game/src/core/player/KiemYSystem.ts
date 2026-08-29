// Kiếm Ý VĨNH VIỄN (spec 2026-08-29-kiem-the-kiem-y mục 3.1/3.3) —
// THAY THẾ SwordIntentSystem cũ (tier theo tu vi đã dọn): tầng giờ
// tích theo TỔNG BOSS DIỆT vĩnh viễn (PlayerData.bossKillCount — boss
// stage isBoss + boss Độ Kiếp + elite/mini-boss, đếm ở BattleLoot
// System), tầng N cần tổng cộng 10 + 5×(N-1) boss CỘNG DỒN:
//   t1: 10, t2: 25, t3: 45, t4: 70... (threshold(N) = 10N + 5×N(N-1)/2)
// Mỗi tầng +10 Kiếm Ý vĩnh viễn (bất khả xâm phạm — chỉ kiếm ý TẠM
// trong trận mới bị tiêu hao, xem KiemTuResourceSystem) + 0.5%/tầng
// skill damage/crit rate/crit damage (giữ đúng mức 0.5% của tier cũ
// để không thay đổi đột ngột độ mạnh — "khởi điểm tinh chỉnh playtest").
const TIER_1_BOSS_KILLS = 10
const TIER_STEP_BOSS_KILLS = 5
export const KIEM_Y_PER_TIER = 10

const SKILL_DAMAGE_PERCENT_PER_TIER = 0.005
const CRITICAL_RATE_PER_TIER = 0.005
const CRITICAL_DAMAGE_PER_TIER = 0.005

/** Tầng Kiếm Ý cao nhất đạt được với số boss đã diệt (công thức cộng dồn). */
export function getKiemYTier(bossKillCount: number): number {
  let tier = 0
  // threshold(tier+1) = 10×(tier+1) + 5×(tier+1)×tier/2
  while (
    bossKillCount >=
    TIER_1_BOSS_KILLS * (tier + 1) +
      (TIER_STEP_BOSS_KILLS * (tier + 1) * tier) / 2
  ) {
    tier++
  }
  return tier
}

/** Tổng Kiếm Ý vĩnh viễn = 10 × tầng (spec mục 3.1 — "+10 mỗi tầng"). */
export function getKiemYPermanent(bossKillCount: number): number {
  return getKiemYTier(bossKillCount) * KIEM_Y_PER_TIER
}

/** Multiplier theo tầng (0.5%/tầng mỗi loại) — gọi từ stores/player.ts
 * finalStats thay getSwordIntentModifiers cũ, CHỈ khi route Bạt Kiếm. */
export function getKiemYDamageMultipliers(tier: number): {
  skillDamagePercent: number
  criticalRate: number
  criticalDamage: number
} {
  return {
    skillDamagePercent: tier * SKILL_DAMAGE_PERCENT_PER_TIER,
    criticalRate: tier * CRITICAL_RATE_PER_TIER,
    criticalDamage: tier * CRITICAL_DAMAGE_PER_TIER,
  }
}
