import type { Equipment } from './Equipment'
import type { EquipmentInstance } from './EquipmentInstance'
import type { AffixRegistry } from './AffixRegistry'
import type { Affix, AffixKind, AffixPool } from './Affix'
import type { RolledAffix } from './RolledAffix'
import type { StatType } from '../stats/StatTypes'
import type { StatModifier } from '../stats/StatCalculator'
import type { PlayerData } from '../player/Player'
import { ITEM_QUALITY_ORDER, type ItemQuality } from '../item/ItemQuality'
import {
  ITEM_QUALITY_AFFIX_TIER,
  ITEM_QUALITY_DROP_WEIGHT,
  ITEM_QUALITY_EXALTED_AFFIX_CHANCE,
  ITEM_QUALITY_FORGE_USES,
  ITEM_QUALITY_IMPLICIT_MULTIPLIER,
  ITEM_QUALITY_SUBSTATS_RANGE,
  ITEM_QUALITY_UNLOCKED_POOLS,
  applyQualityBonusSteps,
} from './ItemQualityBalance'
import { getGlobalCultivationLevel } from '../realm/realmSystem'
import {
  getProfessionGradeForRealm,
  realmFromGrade,
} from '../profession/ProfessionGrade'
import { randomInt, weightedRandom, rollChance } from '../reward/DropRoll'
import { assertValidEquipmentMainStats } from './EquipmentStatPolicy'
import {
  filterEligibleAffixes,
  rollAffixRange,
  rollEligibleAffixAtTier,
} from './EquipmentRollPrimitives'

// Chỉ số chính scale thêm theo cảnh giới người chơi lúc rớt/tạo đồ
// — quy đổi qua getGlobalCultivationLevel() (xuyên suốt 9 đại cảnh
// giới) để đồ ở cảnh giới cao luôn mạnh hơn đồ cùng phẩm ở cảnh
// giới thấp. (large-file-split: chuyển từ EquipmentSystem — sống cùng
// pipeline roll vì chỉ rollMainStat + quoteMainStatRange dùng.)
export const MAIN_STAT_REALM_SCALE = 0.05

/**
 * Roll 1 instance mới từ template. Grade theo realm của người chơi;
 * quality roll độc lập theo trọng số cố định và quyết định implicit,
 * số lượng/tier/pool substat cùng ngân sách Rèn.
 * (large-file-split: EquipmentSystem.createInstance() -> free function,
 * hành vi giữ NGUYÊN 1:1.)
 */
export function createEquipmentInstance(
  template: Equipment,
  player: PlayerData,
  affixRegistry: AffixRegistry,
  zoneId?: string,
  qualityBonusSteps = 0,
): EquipmentInstance {
  assertValidEquipmentMainStats(template)

  const grade = getProfessionGradeForRealm(player.realmId)
  if (!grade) {
    throw new Error(`Missing profession grade for equipment realm ${player.realmId}`)
  }

  const quality = applyQualityBonusSteps(rollItemQuality(), qualityBonusSteps)

  const mainStat = rollMainStat(template, grade, player, quality)

  const forgeUses = ITEM_QUALITY_FORGE_USES[quality]

  // New drops start with their full quality-defined forge-use budget.
  return {
    instanceId: crypto.randomUUID(),

    itemId: template.id,

    slot: template.slot,

    equipped: false,

    grade,

    quality,

    realmLevel: player.realmLevel,

    zoneId,

    icon: rollIcon(template),

    mainStat,

    affixes: rollAffixes(template, mainStat.stat, quality, affixRegistry),

    forgeUsesTotal: forgeUses,

    forgeUsesRemaining: forgeUses,
  }
}

function rollIcon(template: Equipment): string | undefined {
  const pool = template.iconPool?.filter(Boolean) ?? []
  return pool.length > 0 ? pool[randomInt(0, pool.length - 1)] : template.icon
}

function rollItemQuality(): ItemQuality {
  return weightedRandom(
    ITEM_QUALITY_ORDER.map((quality) => ({
      value: quality,
      weight: ITEM_QUALITY_DROP_WEIGHT[quality],
    })),
  )
}

// Roll trong miền số nguyên có scale để giữ được main stat dạng
// tỉ lệ 0~1 (criticalRate/attackSpeed...) mà không làm tròn về 0.
//
// Equipment Rework — Quality scale RANGE trước khi roll (mục 6 kế
// hoạch "Quality chỉ ảnh hưởng range, không cộng trực tiếp
// multiplier"), Realm scale KẾT QUẢ sau khi roll — 2 trục nhân dồn
// độc lập (Quality = tiềm năng của BẢN THÂN món đồ, Realm = sức
// mạnh chung của người chơi lúc rớt đồ).
function rollMainStat(
  template: Equipment,
  grade: EquipmentInstance['grade'],
  player: PlayerData,
  quality: ItemQuality,
  retainedStat?: StatType,
): StatModifier {
  const range = retainedStat
    ? template.mainStats.find((candidate) => candidate.stat === retainedStat)
    : template.mainStats[randomInt(0, template.mainStats.length - 1)]
  if (!range) {
    throw new Error(`Missing main stat range ${retainedStat ?? ''} for equipment ${template.id}`)
  }
  const stat = range.stat
  const qualityMultiplier = ITEM_QUALITY_IMPLICIT_MULTIPLIER[quality]

  const base = rollAffixRange(range.min * qualityMultiplier, range.max * qualityMultiplier)

  const globalLevel = getGlobalCultivationLevel(realmFromGrade(grade), player.realmLevel)

  const scaled = base * (1 + globalLevel * MAIN_STAT_REALM_SCALE)

  return {
    // id/sourceId ở đây chỉ là placeholder — applyModifiers() sẽ
    // build lại modifier thật (id theo instanceId) khi equip.
    id: `roll-main-${stat}`,

    sourceId: 'roll-main',

    sourceType: 'equipment',

    stat,

    flat: scaled,
  }
}

/**
 * Roll số substat trong miền của quality; số lẻ ưu tiên prefix.
 *
 * Equipment Rework mục 2 ("Exalted Affix") — quality cao nhất
 * (tien) có thêm ITEM_QUALITY_EXALTED_AFFIX_CHANCE cơ hội
 * roll 1 affix BONUS từ pool 'supreme' — bỏ qua giới hạn pool theo
 * Quality của chính item,
 * vẫn random hoàn toàn (không phải item cố định kiểu Unique cũ).
 */
function rollAffixes(
  template: Equipment,
  mainStat: StatType,
  quality: ItemQuality,
  affixRegistry: AffixRegistry,
): RolledAffix[] {
  const countRange = ITEM_QUALITY_SUBSTATS_RANGE[quality]
  const count = randomInt(countRange.min, countRange.max)
  const prefixCount = Math.ceil(count / 2)
  const suffixCount = Math.floor(count / 2)
  const requestedKinds: AffixKind[] = [
    ...Array<AffixKind>(prefixCount).fill('prefix'),
    ...Array<AffixKind>(suffixCount).fill('suffix'),
  ]

  const maxTier = ITEM_QUALITY_AFFIX_TIER[quality]

  const unlockedPools = ITEM_QUALITY_UNLOCKED_POOLS[quality]

  // Mảng dùng CHUNG, mutate qua từng lượt roll — đảm bảo prefix và
  // suffix không bao giờ trùng STAT với nhau lẫn với Implicit
  // (mainStat), giống hệt cách rollAdditionalSubstats cũ tránh
  // trùng lặp.
  const excludeStats: StatType[] = [mainStat]

  // Resolve and reserve the compatible bonus before base rolls so a
  // supreme base candidate cannot consume the only valid Exalted stat.
  let exalted: RolledAffix | null = null
  if (quality === 'tien' && rollChance(ITEM_QUALITY_EXALTED_AFFIX_CHANCE)) {
    exalted = rollEligibleAffixAtTier(
      template,
      ITEM_QUALITY_AFFIX_TIER.tien,
      ['supreme'],
      excludeStats,
      affixRegistry,
    )

    if (exalted) {
      excludeStats.push(affixRegistry.get(exalted.affixId).stat)
    }
  }

  const result = rollAffixesWithKindFallback(
    template,
    requestedKinds,
    maxTier,
    unlockedPools,
    excludeStats,
    affixRegistry,
  )

  if (exalted) {
    result.push(exalted)
  }

  return result
}

function rollAffixesWithKindFallback(
  template: Equipment,
  requestedKinds: readonly AffixKind[],
  maxTier: number,
  pools: AffixPool[],
  excludeStats: StatType[],
  affixRegistry: AffixRegistry,
): RolledAffix[] {
  const result: RolledAffix[] = []

  // Preserve the prefix-first target split whenever that kind has a
  // candidate; otherwise use the opposite kind to realize the rolled count.
  for (const requestedKind of requestedKinds) {
    const fallbackKind: AffixKind = requestedKind === 'prefix' ? 'suffix' : 'prefix'
    const rolled =
      rollEligibleAffix(
        template,
        requestedKind,
        maxTier,
        pools,
        excludeStats,
        affixRegistry,
      ) ??
      rollEligibleAffix(template, fallbackKind, maxTier, pools, excludeStats, affixRegistry)

    if (!rolled) {
      break
    }

    result.push(rolled)

    excludeStats.push(affixRegistry.get(rolled.affixId).stat)
  }

  return result
}

/**
 * Roll 1 affix hợp lệ (đúng kind, đúng slot, đúng pool, chưa trùng
 * stat) — primitive dùng chung cho roll hàng loạt lúc tạo instance
 * (rollAffixesWithKindFallback) VÀ Tẩy
 * Luyện. Trả về null nếu không còn candidate hợp lệ. `maxTier` dùng
 * làm TRẦN roll được (Exalted Affix roll truyền trần cao nhất toàn
 * hệ thống để không tự giới hạn oan tier 4-5 của chính pool
 * supreme).
 */
function rollEligibleAffix(
  template: Equipment,
  kind: AffixKind,
  maxTier: number,
  pools: AffixPool[],
  excludeStats: StatType[],
  affixRegistry: AffixRegistry,
): RolledAffix | null {
  const candidates = filterEligibleAffixes(
    affixRegistry.getByKind(kind),
    template,
    pools,
    excludeStats,
  ).filter((affix) => affix.tiers.some((tierDef) => tierDef.tier <= maxTier))

  if (candidates.length === 0) {
    return null
  }

  const affix = candidates[randomInt(0, candidates.length - 1)]!

  return rollAffixValue(affix, maxTier)
}

function rollAffixValue(affix: Affix, maxTier: number): RolledAffix | null {
  const eligibleTiers = affix.tiers.filter((tierDef) => tierDef.tier <= maxTier)

  if (eligibleTiers.length === 0) {
    return null
  }

  const tierDef = eligibleTiers[randomInt(0, eligibleTiers.length - 1)]!

  return {
    affixId: affix.id,
    tier: tierDef.tier,
    value: rollAffixRange(tierDef.min, tierDef.max),
  }
}
