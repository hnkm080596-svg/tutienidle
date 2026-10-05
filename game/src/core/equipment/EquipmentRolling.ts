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
  AFFIX_TIER_ROLL_WEIGHT,
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

// Chi so chinh scale them theo canh gioi nguoi choi luc rot/tao do
// - quy doi qua getGlobalCultivationLevel() (xuyen suot 9 dai canh
// gioi) de do o canh gioi cao luon manh hon do cung pham o canh
// gioi thap. (large-file-split: chuyen tu EquipmentSystem - song cung
// pipeline roll vi chi rollMainStat + quoteMainStatRange dung.)
export const MAIN_STAT_REALM_SCALE = 0.05

/**
 * Roll 1 instance moi tu template. Grade theo realm cua nguoi choi;
 * quality roll doc lap theo trong so co dinh va quyet dinh implicit,
 * so luong/tier/pool substat cung ngan sach Ren.
 * (large-file-split: EquipmentSystem.createInstance() -> free function,
 * hanh vi giu NGUYEN 1:1.)
 */
export function createEquipmentInstance(
  template: Equipment,
  player: PlayerData,
  affixRegistry: AffixRegistry,
  zoneId?: string,
  qualityBonusSteps = 0,
  rng: () => number = Math.random,
  maxQuality?: ItemQuality,
): EquipmentInstance {
  assertValidEquipmentMainStats(template)

  const grade = getProfessionGradeForRealm(player.realmId)
  if (!grade) {
    throw new Error(`Missing profession grade for equipment realm ${player.realmId}`)
  }

  const quality = applyQualityBonusSteps(rollItemQuality(rng, maxQuality), qualityBonusSteps)

  const mainStat = rollMainStat(template, grade, player, quality, undefined, rng)

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

    icon: rollIcon(template, rng),

    mainStat,

    affixes: rollAffixes(template, mainStat.stat, quality, affixRegistry, rng),

    forgeUsesTotal: forgeUses,

    forgeUsesRemaining: forgeUses,
  }
}

function rollIcon(template: Equipment, rng: () => number): string | undefined {
  const pool = template.iconPool?.filter(Boolean) ?? []
  return pool.length > 0 ? pool[randomInt(0, pool.length - 1, rng)] : template.icon
}

// Gear-pace retune (2026-10-05): the caller may pass a roll ceiling
// (stage-floor band, itemQualityCeilingForFloor in ItemQualityBalance).
// Qualities above the ceiling are simply dropped from the weight table and
// the remainder renormalizes - the odds inside the band do not pile onto
// the ceiling quality. Omitting the ceiling preserves the flat ladder.
function rollItemQuality(rng: () => number, maxQuality?: ItemQuality): ItemQuality {
  const maxRank = maxQuality === undefined ? ITEM_QUALITY_ORDER.length - 1 : ITEM_QUALITY_ORDER.indexOf(maxQuality)

  return weightedRandom(
    ITEM_QUALITY_ORDER.filter((_, index) => index <= maxRank).map((quality) => ({
      value: quality,
      weight: ITEM_QUALITY_DROP_WEIGHT[quality],
    })),
    rng,
  )
}

// Roll trong mien so nguyen co scale de giu duoc main stat dang
// ti le 0~1 (criticalRate/attackSpeed...) ma khong lam tron ve 0.
//
// Equipment Rework - Quality scale RANGE truoc khi roll (muc 6 ke
// hoach "Quality chi anh huong range, khong cong truc tiep
// multiplier"), Realm scale KET QUA sau khi roll - 2 truc nhan don
// doc lap (Quality = tiem nang cua BAN THAN mon do, Realm = suc
// manh chung cua nguoi choi luc rot do).
function rollMainStat(
  template: Equipment,
  grade: EquipmentInstance['grade'],
  player: PlayerData,
  quality: ItemQuality,
  retainedStat: StatType | undefined,
  rng: () => number,
): StatModifier {
  const range = retainedStat
    ? template.mainStats.find((candidate) => candidate.stat === retainedStat)
    : template.mainStats[randomInt(0, template.mainStats.length - 1, rng)]
  if (!range) {
    throw new Error(`Missing main stat range ${retainedStat ?? ''} for equipment ${template.id}`)
  }
  const stat = range.stat
  const qualityMultiplier = ITEM_QUALITY_IMPLICIT_MULTIPLIER[quality]

  const base = rollAffixRange(range.min * qualityMultiplier, range.max * qualityMultiplier, rng)

  const globalLevel = getGlobalCultivationLevel(realmFromGrade(grade), player.realmLevel)

  const scaled = base * (1 + globalLevel * MAIN_STAT_REALM_SCALE)

  return {
    // id/sourceId o day chi la placeholder - applyModifiers() se
    // build lai modifier that (id theo instanceId) khi equip.
    id: `roll-main-${stat}`,

    sourceId: 'roll-main',

    sourceType: 'equipment',

    stat,

    flat: scaled,
  }
}

/**
 * Roll so substat trong mien cua quality; so le uu tien prefix.
 *
 * Equipment Rework muc 2 ("Exalted Affix") - quality cao nhat
 * (tien) co them ITEM_QUALITY_EXALTED_AFFIX_CHANCE co hoi
 * roll 1 affix BONUS tu pool 'supreme' - bo qua gioi han pool theo
 * Quality cua chinh item,
 * van random hoan toan (khong phai item co dinh kieu Unique cu).
 */
function rollAffixes(
  template: Equipment,
  mainStat: StatType,
  quality: ItemQuality,
  affixRegistry: AffixRegistry,
  rng: () => number,
): RolledAffix[] {
  const countRange = ITEM_QUALITY_SUBSTATS_RANGE[quality]
  const count = randomInt(countRange.min, countRange.max, rng)
  const prefixCount = Math.ceil(count / 2)
  const suffixCount = Math.floor(count / 2)
  const requestedKinds: AffixKind[] = [
    ...Array<AffixKind>(prefixCount).fill('prefix'),
    ...Array<AffixKind>(suffixCount).fill('suffix'),
  ]

  const maxTier = ITEM_QUALITY_AFFIX_TIER[quality]

  const unlockedPools = ITEM_QUALITY_UNLOCKED_POOLS[quality]

  // Mang dung CHUNG, mutate qua tung luot roll - dam bao prefix va
  // suffix khong bao gio trung STAT voi nhau lan voi Implicit
  // (mainStat), giong het cach rollAdditionalSubstats cu tranh
  // trung lap.
  const excludeStats: StatType[] = [mainStat]

  // Resolve and reserve the compatible bonus before base rolls so a
  // supreme base candidate cannot consume the only valid Exalted stat.
  let exalted: RolledAffix | null = null
  if (quality === 'tien' && rollChance(ITEM_QUALITY_EXALTED_AFFIX_CHANCE, rng)) {
    exalted = rollEligibleAffixAtTier(
      template,
      ITEM_QUALITY_AFFIX_TIER.tien,
      ['supreme'],
      excludeStats,
      affixRegistry,
      rng,
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
    rng,
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
  rng: () => number,
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
        rng,
      ) ??
      rollEligibleAffix(template, fallbackKind, maxTier, pools, excludeStats, affixRegistry, rng)

    if (!rolled) {
      break
    }

    result.push(rolled)

    excludeStats.push(affixRegistry.get(rolled.affixId).stat)
  }

  return result
}

/**
 * Roll 1 affix hop le (dung kind, dung slot, dung pool, chua trung
 * stat) - primitive dung chung cho roll hang loat luc tao instance
 * (rollAffixesWithKindFallback) VA Tay
 * Luyen. Tra ve null neu khong con candidate hop le. `maxTier` dung
 * lam TRAN roll duoc (Exalted Affix roll truyen tran cao nhat toan
 * he thong de khong tu gioi han oan tier 4-5 cua chinh pool
 * supreme).
 */
function rollEligibleAffix(
  template: Equipment,
  kind: AffixKind,
  maxTier: number,
  pools: AffixPool[],
  excludeStats: StatType[],
  affixRegistry: AffixRegistry,
  rng: () => number,
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

  const affix = candidates[randomInt(0, candidates.length - 1, rng)]!

  return rollAffixValue(affix, maxTier, rng)
}

function rollAffixValue(affix: Affix, maxTier: number, rng: () => number): RolledAffix | null {
  const eligibleTiers = affix.tiers.filter((tierDef) => tierDef.tier <= maxTier)

  if (eligibleTiers.length === 0) {
    return null
  }

  // Gear-pace retune (2026-10-05): tiers roll weighted toward the LOW end
  // (AFFIX_TIER_ROLL_WEIGHT) so better-tiered affixes keep demanding more
  // drops inside the same quality band. weightedRandom still consumes
  // exactly one rng() call - same draw cadence as the old randomInt pick.
  const tierDef = weightedRandom(
    eligibleTiers.map((candidate) => ({
      value: candidate,
      weight: AFFIX_TIER_ROLL_WEIGHT[candidate.tier] ?? 0,
    })),
    rng,
  )!

  return {
    affixId: affix.id,
    tier: tierDef.tier,
    value: rollAffixRange(tierDef.min, tierDef.max, rng),
  }
}
