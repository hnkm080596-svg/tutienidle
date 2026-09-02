import type { Equipment } from './Equipment'
import type { Affix, AffixPool } from './Affix'
import type { RolledAffix } from './RolledAffix'
import type { StatType } from '../stats/StatTypes'
import type { AffixRegistry } from './AffixRegistry'
import { isValidEquipmentSubstat } from './EquipmentStatPolicy'

/**
 * Task 8 (phase7-gamemanager-split) — primitives roll-affix dùng CHUNG
 * giữa EquipmentSystem.createInstance() và EquipmentWash.ts (Tẩy
 * Luyện). Tách khỏi EquipmentSystem.ts để wash không phải sao chép lại
 * logic roll — hành vi giữ NGUYÊN 1:1, chỉ đổi chỗ ở. EquipmentSystem.ts
 * re-export lại các hàm public để mọi import site cũ (`from
 * './EquipmentSystem'`) không phải đổi.
 */

// Trần TUYỆT ĐỐI số Affix 1 item có thể mang (base rarity cap + Exalted
// Affix bonus + Yểm Phù tích luỹ trên slot) — cao hơn mức cap tự nhiên
// của thien_duyen (3 prefix + 3 suffix + 1 exalted = 7) để Yểm Phù vẫn
// có giá trị thật ngay cả trên đồ thien_duyen đã có Exalted Affix.
// Export (2026-08-15) — tooltip Equipment (useEquipmentTooltip.ts) cần
// hiện đúng dung lượng Affix tối đa, không được tự lặp lại số "8".
export const GLOBAL_MAX_AFFIXES = 8

// Affix có cả miền số nguyên (Attack, HP...) lẫn miền thập phân
// (criticalRate, cooldownReduction...). randomInt trực tiếp làm miền 0.01–0.09
// co lại sai thành 1, nên mọi đường roll affix phải đi qua hàm này.
export function rollAffixRange(
  min: number,
  max: number,
  random: () => number = Math.random,
): number {
  const precision = 10_000
  const low = Math.round(min * precision)
  const high = Math.round(max * precision)
  return (Math.floor(random() * (high - low + 1)) + low) / precision
}

export function normalizeRolledAffixValue(value: number, min: number, max: number): number {
  if (value >= min && value <= max) return value

  // Dữ liệu cũ từng lưu percent theo điểm nguyên hoặc bị randomInt ép thành
  // 1. Ưu tiên phục hồi theo /100, sau đó mới clamp vào tier hiện tại.
  const legacyPercent = value / 100
  if (legacyPercent >= min && legacyPercent <= max) return legacyPercent
  return Math.min(max, Math.max(min, legacyPercent))
}

// Dùng chung bởi applyModifiers() (áp modifier thật lúc equip) VÀ
// useEquipmentTooltip.ts (hiện số trong tooltip) — 1 nguồn tính "giá trị
// hiệu lực" của 1 RolledAffix duy nhất, tránh combat và tooltip lệch số
// nếu sau này đổi cách xử lý tier không khớp (vd data cũ thiếu tier).
export function getEffectiveAffixValue(rolled: RolledAffix, affix: Affix): number {
  const tier = affix.tiers.find((candidate) => candidate.tier === rolled.tier)
  return tier ? normalizeRolledAffixValue(rolled.value, tier.min, tier.max) : rolled.value
}

/**
 * P2 cleanup (plan "Audit findings") — predicate chọn affix hợp lệ
 * (đúng slot/pool, chưa trùng excluded stat, stat hợp lệ trên slot)
 * dùng CHUNG cho roll thường (rollEligibleAffix, createInstance) và Tẩy
 * Luyện (washAffixes candidates + fallback) — một rule duy nhất, không lặp.
 */
export function filterEligibleAffixes(
  affixes: readonly Affix[],

  template: Equipment,

  pools: readonly AffixPool[],

  excludeStats: readonly StatType[],
): Affix[] {
  return affixes.filter(
    (affix) =>
      pools.includes(affix.pool) &&
      !excludeStats.includes(affix.stat) &&
      (!affix.slots || affix.slots.includes(template.slot)) &&
      isValidEquipmentSubstat(template.slot, affix.stat),
  )
}

/**
 * Roll 1 affix ở ĐÚNG tier cho trước (dùng cho Exalted Affix — cả
 * createInstance lẫn washAffixes reserve 1 dòng 'supreme' ở tier cao
 * nhất trước khi roll các dòng base). Trả về null nếu không còn
 * candidate hợp lệ ở tier đó.
 */
export function rollEligibleAffixAtTier(
  template: Equipment,
  tier: number,
  pools: AffixPool[],
  excludeStats: StatType[],
  affixRegistry: AffixRegistry,
  random: () => number = Math.random,
): RolledAffix | null {
  const candidates = filterEligibleAffixes(
    affixRegistry.getAll(),
    template,
    pools,
    excludeStats,
  ).filter((affix) => affix.tiers.some((tierDef) => tierDef.tier === tier))

  if (candidates.length === 0) {
    return null
  }

  const affix = candidates[Math.floor(random() * candidates.length)]!
  const tierDef = affix.tiers.find((candidate) => candidate.tier === tier)!

  return {
    affixId: affix.id,
    tier: tierDef.tier,
    value: rollAffixRange(tierDef.min, tierDef.max, random),
  }
}
