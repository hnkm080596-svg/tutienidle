import type { Equipment } from './Equipment'
import type { Affix, AffixPool } from './Affix'
import type { RolledAffix } from './RolledAffix'
import type { StatType } from '../stats/StatTypes'
import type { AffixRegistry } from './AffixRegistry'
import { isValidEquipmentSubstat } from './EquipmentStatPolicy'

/**
 * Task 8 (phase7-gamemanager-split) - primitives roll-affix dung CHUNG
 * giua EquipmentSystem.createInstance() va EquipmentWash.ts (Tay
 * Luyen). Tach khoi EquipmentSystem.ts de wash khong phai sao chep lai
 * logic roll - hanh vi giu NGUYEN 1:1, chi doi cho o. EquipmentSystem.ts
 * re-export lai cac ham public de moi import site cu (`from
 * './EquipmentSystem'`) khong phai doi.
 */

// Tran TUYET DOI so Affix 1 item co the mang (base rarity cap + Exalted
// Affix bonus + Yem Phu tich luy tren slot) - cao hon muc cap tu nhien
// cua thien_duyen (3 prefix + 3 suffix + 1 exalted = 7) de Yem Phu van
// co gia tri that ngay ca tren do thien_duyen da co Exalted Affix.
// Export (2026-08-15) - tooltip Equipment (useEquipmentTooltip.ts) can
// hien dung dung luong Affix toi da, khong duoc tu lap lai so "8".
export const GLOBAL_MAX_AFFIXES = 8

// Affix co ca mien so nguyen (Attack, HP...) lan mien thap phan
// (criticalRate, cooldownReduction...). randomInt truc tiep lam mien 0.01-0.09
// co lai sai thanh 1, nen moi duong roll affix phai di qua ham nay.
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

  // Du lieu cu tung luu percent theo diem nguyen hoac bi randomInt ep thanh
  // 1. Uu tien phuc hoi theo /100, sau do moi clamp vao tier hien tai.
  const legacyPercent = value / 100
  if (legacyPercent >= min && legacyPercent <= max) return legacyPercent
  return Math.min(max, Math.max(min, legacyPercent))
}

// Dung chung boi applyModifiers() (ap modifier that luc equip) VA
// useEquipmentTooltip.ts (hien so trong tooltip) - 1 nguon tinh "gia tri
// hieu luc" cua 1 RolledAffix duy nhat, tranh combat va tooltip lech so
// neu sau nay doi cach xu ly tier khong khop (vd data cu thieu tier).
export function getEffectiveAffixValue(rolled: RolledAffix, affix: Affix): number {
  const tier = affix.tiers.find((candidate) => candidate.tier === rolled.tier)
  if (tier) {
    return normalizeRolledAffixValue(rolled.value, tier.min, tier.max)
  }
  // A roll naming no authored tier carries no authored range (legacy
  // drift or a forged value) - the emitted number normalizes against
  // the union of the affix's authored tiers rather than trusting the
  // raw claim.
  if (affix.tiers.length === 0) {
    return rolled.value
  }
  const min = Math.min(...affix.tiers.map((candidate) => candidate.min))
  const max = Math.max(...affix.tiers.map((candidate) => candidate.max))
  return normalizeRolledAffixValue(rolled.value, min, max)
}

/**
 * P2 cleanup (plan "Audit findings") - predicate chon affix hop le
 * (dung slot/pool, chua trung excluded stat, stat hop le tren slot)
 * dung CHUNG cho roll thuong (rollEligibleAffix, createInstance) va Tay
 * Luyen (washAffixes candidates + fallback) - mot rule duy nhat, khong lap.
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
 * Roll 1 affix o DUNG tier cho truoc (dung cho Exalted Affix - ca
 * createInstance lan washAffixes reserve 1 dong 'supreme' o tier cao
 * nhat truoc khi roll cac dong base). Tra ve null neu khong con
 * candidate hop le o tier do.
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
