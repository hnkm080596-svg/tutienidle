import type { Equipment, RecipeMaterialCost } from './Equipment'
import type { EquipmentInstance } from './EquipmentInstance'
import { EquipmentBag } from './EquipmentBag'
import { EquipmentRegistry } from './EquipmentRegistry'
import {
  EQUIPMENT_QUALITY_ORDER,
  EQUIPMENT_QUALITY_MAX_AFFIX_TIER,
  EQUIPMENT_QUALITY_MAX_FORGE_POINTS,
  EQUIPMENT_QUALITY_IMPLICIT_MULTIPLIER,
  EQUIPMENT_QUALITY_UNLOCKED_POOLS,
  EQUIPMENT_QUALITY_REALM_WEIGHTS,
} from './EquipmentQuality'
import type { EquipmentQuality } from './EquipmentQuality'
import {
  EQUIPMENT_RARITY_ORDER,
  EQUIPMENT_RARITY_DROP_WEIGHT,
  EQUIPMENT_RARITY_AFFIX_SLOTS,
  EQUIPMENT_RARITY_EXALTED_AFFIX_CHANCE,
} from './EquipmentRarity'
import type { EquipmentRarity } from './EquipmentRarity'
import type { EquipmentSlot } from './EquipmentTypes'
import { EquipmentSlotManager } from './EquipmentSlotManager'
import type { EquipmentSlotState } from './EquipmentSlotState'
import { AffixRegistry } from './AffixRegistry'
import type { Affix, AffixKind, AffixPool } from './Affix'
import type { RolledAffix } from './RolledAffix'
import { ModifierSystem } from '../stats/ModifierSystem'
import type { StatType } from '../stats/StatTypes'
import type { StatModifier } from '../stats/StatCalculator'
import { MaterialBag } from '../material/MaterialBag'
import {
  SPIRIT_STONE_MATERIAL_ID,
  getSpiritStoneMaterialIdForEnhanceLevel,
  getSpiritStoneMaterialIdForRealmTier,
} from '../material/SpiritStoneMaterial'
import { getRealmTier } from '../realm/RealmTierMap'
import type { PlayerData } from '../player/Player'
import { getGlobalCultivationLevel, getRealmIndex } from '../realm/realmSystem'
import { randomInt, weightedRandom, rollChance } from '../reward/DropRoll'
import { assertValidEquipmentMainStats, isValidEquipmentSubstat } from './EquipmentStatPolicy'
import type {
  EquipmentOperation,
  EquipmentOperationCost,
  EquipmentOperationCostCatalog,
  EquipmentOperationCostContext,
} from './EquipmentOperationCostCatalog'
import type { OreQuality } from '../production/ProductionTypes'
import { rollWeightedIndex } from '../production/ProductionBalance'
import {
  DISSOLVE_ESSENCE_RANGE_BY_QUALITY,
  REFINE_MAX_LOCKS,
  REFINE_REFINEMENT_COST,
  REFINE_SPIRIT_STONE_PER_UNIT,
  REFINE_VALUE_VARIANCE,
  WASH_LINE_COUNT_WEIGHTS,
  WASH_ORE_AMOUNT,
  WASH_REFINEMENT_COST,
  WASH_SPIRIT_STONE_COST,
  WASH_TIER_WEIGHTS,
  equipmentEssenceMaterialId,
} from './RefinementBalance'

// Hệ số nhân thêm mỗi bậc cường hóa. Export để UI (EquipmentHallPanel's
// Enhance preview) tính trước giá trị SAU khi cường hóa mà không phải
// lặp lại công thức.
export const ENHANCE_PERCENT_PER_LEVEL = 0.08

/**
 * Slot-level rework (yêu cầu 2026-08-26) — SLOT TRỐNG vẫn cường hóa
 * được: trần mặc định khi không tra được template của item đang mặc.
 */
export const DEFAULT_MAX_ENHANCE_LEVEL = 10

// Equipment Rework (2026-08-14) — trần forgePoints cao hơn nhiều
// enhanceLevel (tới 200, xem EQUIPMENT_QUALITY_MAX_FORGE_POINTS) nên
// hệ số/điểm phải nhỏ hơn nhiều REFINE_PERCENT_PER_LEVEL cũ (0.05/level)
// để không vượt quá enhanceLevel về độ ảnh hưởng ở cùng mức đầu tư.
export const FORGE_PERCENT_PER_POINT = 0.005

/**
 * Hệ số nhân hiệu lực của 1 instance theo enhanceLevel/forgePoints —
 * dùng lại y hệt trong applyModifiers() lẫn UI preview (Enhance tab),
 * đảm bảo 2 nơi luôn khớp công thức.
 */
export function calculateEquipmentScale(enhanceLevel: number, forgePoints: number): number {
  return 1 + enhanceLevel * ENHANCE_PERCENT_PER_LEVEL + forgePoints * FORGE_PERCENT_PER_POINT
}

/**
 * "EquipemtnQuality&rarity" pass (2026-08-14) — trần Rèn THẬT của 1
 * instance = % forgePotential của trần chung theo Quality
 * (EQUIPMENT_QUALITY_MAX_FORGE_POINTS), KHÔNG phải chính
 * EQUIPMENT_QUALITY_MAX_FORGE_POINTS[quality] nữa (đó giờ chỉ là trần
 * TUYỆT ĐỐI của cả tier, không phải trần của 1 instance cụ thể). Ví
 * dụ: Phàm Khí trần 20, instance forgePotential 50 -> trần thật 10.
 */
export function getMaxForgePoints(quality: EquipmentQuality, forgePotential: number): number {
  return Math.round((forgePotential / 100) * EQUIPMENT_QUALITY_MAX_FORGE_POINTS[quality])
}

// Affix có cả miền số nguyên (Attack, HP...) lẫn miền thập phân
// (criticalRate, cooldownReduction...). randomInt trực tiếp làm miền 0.01–0.09
// co lại sai thành 1, nên mọi đường roll affix phải đi qua hàm này.
export function rollAffixRange(min: number, max: number): number {
  const precision = 10_000
  return randomInt(Math.round(min * precision), Math.round(max * precision)) / precision
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

// Trần TUYỆT ĐỐI số Affix 1 item có thể mang (base rarity cap + Exalted
// Affix bonus + Yểm Phù tích luỹ trên slot) — cao hơn mức cap tự nhiên
// của thien_duyen (3 prefix + 3 suffix + 1 exalted = 7) để Yểm Phù vẫn
// có giá trị thật ngay cả trên đồ thien_duyen đã có Exalted Affix.
// Export (2026-08-15) — tooltip Equipment (useEquipmentTooltip.ts) cần
// hiện đúng dung lượng Affix tối đa, không được tự lặp lại số "8".
export const GLOBAL_MAX_AFFIXES = 8

// Chỉ số chính scale thêm theo cảnh giới người chơi lúc rớt/tạo đồ
// — quy đổi qua getGlobalCultivationLevel() (xuyên suốt 9 đại cảnh
// giới) để đồ ở cảnh giới cao luôn mạnh hơn đồ cùng phẩm ở cảnh
// giới thấp.
export const MAIN_STAT_REALM_SCALE = 0.05

/**
 * Modifier của equipment là "tĩnh" (xem ghi chú trong Player.ts:
 * modifiers vs externalModifiers) — chỉ đổi khi người chơi
 * equip/unequip/enhance/wash/refine/hóa luyện,
 * KHÔNG tổng hợp lại mỗi tick như Buff/Technique. EquipmentSystem
 * tự giữ một ModifierSystem riêng, add/remove theo sourceId =
 * instanceId để gỡ đúng modifier khi unequip. Caller (GameManager
 * -> player store) đọc lại qua getModifiers() và tự gán vào
 * player.modifiers sau mỗi hành động.
 *
 * Core Loop Foundation checklist (Mục AFFIX/RARITY) — chỉ số phụ giờ
 * là Affix (Prefix/Suffix có Tier, xem Affix.ts) thay vì substat roll
 * ngẫu nhiên phẳng cũ. Quality (9 bậc) đổi vai trò thành GATE tier
 * affix cao nhất roll được; Rarity (trục mới, xem EquipmentRarity.ts)
 * quyết định SỐ LƯỢNG affix.
 */
export class EquipmentSystem {
  private readonly modifierSystem = new ModifierSystem()

  constructor(costCatalog?: EquipmentOperationCostCatalog) {
    this.costCatalog = costCatalog
  }

  /**
   * Cost catalog nghề (2026-08-24, resource-professions-rework §6) —
   * optional: resolve được → ưu tiên hơn template cost; không resolve
   * (operation/realm chưa author) → fallback template cost legacy để
   * data cũ/test cũ không vỡ.
   */
  private costCatalog?: EquipmentOperationCostCatalog

  setCostCatalog(catalog: EquipmentOperationCostCatalog | undefined) {
    this.costCatalog = catalog
  }

  /**
   * W5 (2026-08-27) — discount chi phí Khí Đường theo level building
   * (equipment_hall). GameManager đồng bộ trước mỗi lần query/spend;
   * EquipmentSystem không tự biết building để giữ core độc lập.
   */
  private costDiscountPercent = 0

  setCostDiscountPercent(percent: number) {
    this.costDiscountPercent = Math.min(0.9, Math.max(0, percent))
  }

  getCostDiscountPercent(): number {
    return this.costDiscountPercent
  }

  private applyCostDiscount(amount: number): number {
    if (amount <= 0) {
      return 0
    }

    if (this.costDiscountPercent <= 0) {
      return amount
    }

    return Math.max(1, Math.floor(amount * (1 - this.costDiscountPercent)))
  }

  private resolveCatalogCost(
    operation: EquipmentOperation,
    realmId: string,
    context: EquipmentOperationCostContext = {},
  ): EquipmentOperationCost | undefined {
    return this.costCatalog?.resolve(operation, realmId, context)
  }

  /**
   * Roll 1 instance mới từ template: phẩm chất + độ hiếm (2 trục độc
   * lập, trọng số giảm dần theo bậc), affix (số lượng theo rarity,
   * tier theo quality), và chỉ số chính (scale theo cảnh giới hiện
   * tại của player). Cùng 1 template có thể sinh nhiều instance hoàn
   * toàn khác nhau — đúng tinh thần "roll đồ" thay vì đồ cố định.
   */
  createInstance(
    template: Equipment,
    player: PlayerData,
    affixRegistry: AffixRegistry,
    zoneId?: string,
  ): EquipmentInstance {
    assertValidEquipmentMainStats(template)

    const quality = this.rollQuality(player.realmId)

    const rarity = this.rollRarity()

    const mainStat = this.rollMainStat(template, player, quality)

    // Điểm Rèn per-item (rework 2026-08-26) — item sinh ra với TÌNH
    // TRẠNG RÈN ĐẦY (forgePoints = trần theo potential roll). Đây là
    // ngân sách dùng cho CẢ Rèn (power) LẪN Tẩy/Tinh Luyện; tiêu cạn
    // là món ngừng phát triển (plan §8 mount review).
    const forgePotential = this.rollForgePotential()

    return {
      instanceId: crypto.randomUUID(),

      itemId: template.id,

      slot: template.slot,

      equipped: false,

      quality,

      rarity,

      realmId: player.realmId,

      realmLevel: player.realmLevel,

      zoneId,

      icon: this.rollIcon(template),

      mainStat,

      affixes: this.rollAffixes(template, mainStat.stat, rarity, quality, affixRegistry),

      forgePoints: getMaxForgePoints(quality, forgePotential),

      forgePotential,
    }
  }
  private rollIcon(template: Equipment): string | undefined {
    const pool = template.iconPool?.filter(Boolean) ?? []
    return pool.length > 0 ? pool[randomInt(0, pool.length - 1)] : template.icon
  }

  // "EquipemtnQuality&rarity" pass — roll đều 0-100, độc lập hoàn
  // toàn với quality/rarity (xem ghi chú EquipmentInstance.forgePotential).
  private rollForgePotential(): number {
    return randomInt(0, 100)
  }

  private rollQuality(realmId: string): EquipmentQuality {
    const realmIndex = Math.max(0, getRealmIndex(realmId))
    const weights =
      EQUIPMENT_QUALITY_REALM_WEIGHTS[
        Math.min(realmIndex, EQUIPMENT_QUALITY_REALM_WEIGHTS.length - 1)
      ]!

    return weightedRandom(
      EQUIPMENT_QUALITY_ORDER.map((quality, index) => ({
        value: quality,
        weight: weights[index] ?? 0,
      })).filter((entry) => entry.weight > 0),
    )
  }

  private rollRarity(): EquipmentRarity {
    return weightedRandom(
      EQUIPMENT_RARITY_ORDER.map((rarity) => ({
        value: rarity,

        weight: EQUIPMENT_RARITY_DROP_WEIGHT[rarity],
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
  private rollMainStat(
    template: Equipment,
    player: PlayerData,
    quality: EquipmentQuality,
    retainedStat?: StatType,
  ): StatModifier {
    const range = retainedStat
      ? template.mainStats.find((candidate) => candidate.stat === retainedStat)
      : template.mainStats[randomInt(0, template.mainStats.length - 1)]
    if (!range) {
      throw new Error(`Missing main stat range ${retainedStat ?? ''} for equipment ${template.id}`)
    }
    const stat = range.stat
    const qualityMultiplier = EQUIPMENT_QUALITY_IMPLICIT_MULTIPLIER[quality]

    const base = rollAffixRange(range.min * qualityMultiplier, range.max * qualityMultiplier)

    const globalLevel = getGlobalCultivationLevel(player.realmId, player.realmLevel)

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
   * Roll đủ bộ Affix cho 1 instance mới — N prefix + M suffix theo
   * EQUIPMENT_RARITY_AFFIX_SLOTS, mỗi affix roll tier ngẫu nhiên trong
   * giới hạn EQUIPMENT_QUALITY_MAX_AFFIX_TIER và pool mở theo
   * EQUIPMENT_QUALITY_UNLOCKED_POOLS.
   *
   * Equipment Rework mục 2 ("Exalted Affix") — rarity cao nhất
   * (tien_pham) có thêm EQUIPMENT_RARITY_EXALTED_AFFIX_CHANCE cơ hội
   * roll 1 affix BONUS từ pool 'supreme' — bỏ qua giới hạn pool theo
   * Quality của chính item (đặc quyền của rarity, không phải quality),
   * vẫn random hoàn toàn (không phải item cố định kiểu Unique cũ).
   */
  private rollAffixes(
    template: Equipment,
    mainStat: StatType,
    rarity: EquipmentRarity,
    quality: EquipmentQuality,
    affixRegistry: AffixRegistry,
  ): RolledAffix[] {
    const slots = EQUIPMENT_RARITY_AFFIX_SLOTS[rarity]

    const maxTier = EQUIPMENT_QUALITY_MAX_AFFIX_TIER[quality]

    const unlockedPools = EQUIPMENT_QUALITY_UNLOCKED_POOLS[quality]

    // Mảng dùng CHUNG, mutate qua từng lượt roll — đảm bảo prefix và
    // suffix không bao giờ trùng STAT với nhau lẫn với Implicit
    // (mainStat), giống hệt cách rollAdditionalSubstats cũ tránh
    // trùng lặp.
    const excludeStats: StatType[] = [mainStat]

    const prefixes = this.rollAffixesOfKind(
      template,
      'prefix',
      slots.prefix,
      maxTier,
      unlockedPools,
      excludeStats,
      affixRegistry,
    )

    const suffixes = this.rollAffixesOfKind(
      template,
      'suffix',
      slots.suffix,
      maxTier,
      unlockedPools,
      excludeStats,
      affixRegistry,
    )

    const result = [...prefixes, ...suffixes]

    if (rarity === 'tien' && rollChance(EQUIPMENT_RARITY_EXALTED_AFFIX_CHANCE)) {
      const exaltedKind: AffixKind = rollChance(0.5) ? 'prefix' : 'suffix'

      const exalted = this.rollEligibleAffix(
        template,
        exaltedKind,
        EQUIPMENT_QUALITY_MAX_AFFIX_TIER.thien_dia_trong_khi,
        ['supreme'],
        excludeStats,
        affixRegistry,
      )

      if (exalted) {
        result.push(exalted)
      }
    }

    return result
  }

  private rollAffixesOfKind(
    template: Equipment,
    kind: AffixKind,
    count: number,
    maxTier: number,
    pools: AffixPool[],
    excludeStats: StatType[],
    affixRegistry: AffixRegistry,
  ): RolledAffix[] {
    const result: RolledAffix[] = []

    for (let i = 0; i < count; i++) {
      const rolled = this.rollEligibleAffix(
        template,
        kind,
        maxTier,
        pools,
        excludeStats,
        affixRegistry,
      )

      if (!rolled) {
        break
      }

      result.push(rolled)

      excludeStats.push(affixRegistry.get(rolled.affixId).stat)
    }

    return result
  }

  /**
   * P2 cleanup (plan "Audit findings") — predicate chọn affix hợp lệ
   * (đúng slot/pool, chưa trùng excluded stat, stat hợp lệ trên slot)
   * dùng CHUNG cho roll thường (rollEligibleAffix) và Tẩy Luyện
   * (washAffixes candidates + fallback) — một rule duy nhất, không lặp.
   */
  private filterEligibleAffixes(
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
   * Roll 1 affix hợp lệ (đúng kind, đúng slot, đúng pool, chưa trùng
   * stat) — primitive dùng chung cho roll hàng loạt lúc tạo instance
   * (rollAffixesOfKind), roll Exalted Affix (rollAffixes) VÀ Tẩy
   * Luyện. Trả về null nếu không còn candidate hợp lệ. `maxTier` dùng
   * làm TRẦN roll được (Exalted Affix roll truyền trần cao nhất toàn
   * hệ thống để không tự giới hạn oan tier 4-5 của chính pool
   * supreme).
   */
  private rollEligibleAffix(
    template: Equipment,
    kind: AffixKind,
    maxTier: number,
    pools: AffixPool[],
    excludeStats: StatType[],
    affixRegistry: AffixRegistry,
  ): RolledAffix | null {
    const candidates = this.filterEligibleAffixes(
      affixRegistry.getByKind(kind),
      template,
      pools,
      excludeStats,
    )

    if (candidates.length === 0) {
      return null
    }

    const affix = candidates[randomInt(0, candidates.length - 1)]!

    return this.rollAffixValue(affix, maxTier)
  }

  private rollAffixValue(affix: Affix, maxTier: number): RolledAffix {
    const eligibleTiers = affix.tiers.filter((tierDef) => tierDef.tier <= maxTier)

    const tierDef =
      eligibleTiers.length > 0
        ? eligibleTiers[randomInt(0, eligibleTiers.length - 1)]!
        : affix.tiers[0]!

    return {
      affixId: affix.id,
      tier: tierDef.tier,
      value: rollAffixRange(tierDef.min, tierDef.max),
    }
  }

  equip(
    instanceId: string,
    inventory: EquipmentBag,
    registry: EquipmentRegistry,
    slotManager: EquipmentSlotManager,
    player: PlayerData,
    affixRegistry: AffixRegistry,
  ): boolean {
    const instance = inventory.get(instanceId)

    if (!instance) {
      return false
    }

    if (instance.equipped) {
      return true
    }

    const template = registry.get(instance.itemId)

    // Equipment KHÔNG có requiredRealmId trên template (khác Recipe/
    // Building/Skill) — không gate trang bị theo cảnh giới. Sức mạnh
    // theo cảnh giới nằm ở instance.realmId (set lúc rớt đồ), không
    // phải điều kiện equip.
    const current = inventory.getEquippedInSlot(instance.slot)

    if (current) {
      this.unequip(current.instanceId, inventory)
    }

    instance.equipped = true

    this.applyModifiers(instance, slotManager, affixRegistry)

    return true
  }

  unequip(instanceId: string, inventory: EquipmentBag): boolean {
    const instance = inventory.get(instanceId)

    if (!instance) {
      return false
    }

    instance.equipped = false

    this.modifierSystem.removeBySource(instance.instanceId)

    return true
  }

  /**
   * ĐIỂM RÈN của món đồ (rework 2026-08-26) = forgePoints hiện tại —
   * CHÍNH LÀ "Tình trạng rèn x/y" trong tooltip, KHÔNG phải pool nào
   * khác. Tẩy Luyện/Tinh Luyện tiêu thụ tài nguyên này; item sinh ra
   * với tình trạng ĐẦY (xem createInstance).
   */
  itemRefinementPoints(instance: EquipmentInstance): number {
    return instance.forgePoints
  }

  private spendItemRefinementPoints(instance: EquipmentInstance, amount: number) {
    instance.forgePoints = Math.max(0, instance.forgePoints - amount)
  }

  /** registry.get() ném lỗi khi thiếu template — wrapper an toàn cho dữ liệu dev cũ. */
  private tryGetTemplate(registry: EquipmentRegistry, itemId: string): Equipment | undefined {
    try {
      return registry.get(itemId)
    } catch {
      return undefined
    }
  }

  /**
   * Slot-level rework (yêu cầu 2026-08-26) — Cường Hóa gắn SLOT, KHÔNG
   * cần item trong slot mới được cường hóa. Trần mặc định + chi phí
   * fallback khi không tra được catalog/template.
   */
  getMaxEnhanceLevel(template?: Equipment): number {
    return template?.maxEnhanceLevel ?? DEFAULT_MAX_ENHANCE_LEVEL
  }

  /** Một nguồn resolve cost Cường Hóa: catalog nghề → template → fallback. */
  private resolveEnhanceCost(
    realmId: string,

    enhanceLevel: number,

    template?: Equipment,
  ): { materials: RecipeMaterialCost[]; spiritStone: number } {
    // Catalog nghề ưu tiên (plan §6) — scale theo level như template.
    const catalogCost = this.resolveCatalogCost('enhance', realmId, { enhanceLevel })

    if (catalogCost) {
      return {
        materials: this.getScaledCost(catalogCost.materials, enhanceLevel).map((entry) => ({
          materialId: entry.materialId,
          amount: this.applyCostDiscount(entry.amount),
        })),

        spiritStone: this.applyCostDiscount(catalogCost.spiritStone ?? 0),
      }
    }

    if (template?.enhanceCost || template?.enhanceSpiritStoneCost) {
      return {
        materials: this.getScaledCost(template.enhanceCost, enhanceLevel).map((entry) => ({
          materialId: entry.materialId,
          amount: this.applyCostDiscount(entry.amount),
        })),

        spiritStone: this.applyCostDiscount(template.enhanceSpiritStoneCost ?? 0),
      }
    }

    // Fallback khi không có catalog lẫn template — Linh Thạch thuần,
    // giá tăng tuyến tính theo cấp để vẫn "phát triển được".
    return {
      materials: [],

      spiritStone: this.applyCostDiscount(40 * (enhanceLevel + 1)),
    }
  }

  /**
   * Linh Thạch là MATERIAL (plan Workstream F) — mọi check/trừ của hệ
   * equipment đi qua 2 helper này trên MaterialBag.
   */
  private hasSpiritStones(
    materialBag: MaterialBag,
    amount: number,
    materialId = SPIRIT_STONE_MATERIAL_ID,
  ): boolean {
    return amount <= 0 || materialBag.has(materialId, amount)
  }

  private spendSpiritStones(
    materialBag: MaterialBag,
    amount: number,
    materialId = SPIRIT_STONE_MATERIAL_ID,
  ): void {
    if (amount > 0) {
      materialBag.remove(materialId, amount)
    }
  }

  /**
   * T2 (review 2026-08-28, economy-ecosystem-plan): phẩm Linh Thạch của
   * Tẩy Luyện/Tinh Luyện resolve theo realm TRANG BỊ thay vì hard-code
   * Hạ Phẩm — trang bị realm 4+ tiêu Trung Phẩm, realm 7+ tiêu Thượng
   * Phẩm, nhất quán với nguồn phát (Linh Tuyền/quái rơi theo realm).
   */
  spiritStoneIdForRealm(realmId: string): string {
    return getSpiritStoneMaterialIdForRealmTier(getRealmTier(realmId))
  }

  getEnhanceCost(
    slot: EquipmentSlot,

    realmId: string,

    inventory: EquipmentBag,

    registry: EquipmentRegistry,

    slotManager: EquipmentSlotManager,
  ) {
    const equipped = inventory.getEquippedInSlot(slot)

    const template = equipped ? this.tryGetTemplate(registry, equipped.itemId) : undefined

    const enhanceLevel = slotManager.get(slot).enhanceLevel

    return this.resolveEnhanceCost(realmId, enhanceLevel, template).materials
  }

  getEnhanceSpiritStoneCost(
    slot: EquipmentSlot,

    realmId: string,

    inventory: EquipmentBag,

    registry: EquipmentRegistry,

    slotManager: EquipmentSlotManager,
  ): number {
    const equipped = inventory.getEquippedInSlot(slot)

    const template = equipped ? this.tryGetTemplate(registry, equipped.itemId) : undefined

    const enhanceLevel = slotManager.get(slot).enhanceLevel

    return this.resolveEnhanceCost(realmId, enhanceLevel, template).spiritStone
  }

  /** W5 — cost Tẩy Luyện sau discount Khí Đường (UI và logic dùng chung).
   * realmId của trang bị quyết định PHẨM Linh Thạch tiêu (T2); không có
   * realmId → Hạ Phẩm (mặc định tương thích). */
  getWashCost(realmId?: string): {
    oreAmount: number
    spiritStone: number
    spiritStoneMaterialId: string
    refinementPoints: number
  } {
    return {
      oreAmount: this.applyCostDiscount(WASH_ORE_AMOUNT),
      spiritStone: this.applyCostDiscount(WASH_SPIRIT_STONE_COST),
      spiritStoneMaterialId: realmId ? this.spiritStoneIdForRealm(realmId) : SPIRIT_STONE_MATERIAL_ID,
      refinementPoints: WASH_REFINEMENT_COST,
    }
  }

  /** W5 — cost Tinh Luyện sau discount Khí Đường (UI và logic dùng chung).
   * realmId của trang bị quyết định PHẨM Linh Thạch tiêu (T2). */
  getRefineCost(
    lineCount: number,
    lockedCount: number,
    realmId?: string,
  ): {
    essenceUnits: number
    spiritStone: number
    spiritStoneMaterialId: string
    refinementPoints: number
  } {
    const baseUnits = Math.max(0, lineCount) + Math.max(0, lockedCount)

    return {
      essenceUnits: this.applyCostDiscount(baseUnits),
      spiritStone: this.applyCostDiscount(baseUnits * REFINE_SPIRIT_STONE_PER_UNIT),
      spiritStoneMaterialId: realmId ? this.spiritStoneIdForRealm(realmId) : SPIRIT_STONE_MATERIAL_ID,
      refinementPoints: REFINE_REFINEMENT_COST,
    }
  }
  /**
   * MASTER SPEC Mục XVI — Cường Hóa gắn SLOT (đổi trang bị KHÔNG mất
   * cấp) + slot-level rework (yêu cầu 2026-08-26): SLOT TRỐNG vẫn
   * cường hóa được — trần mặc định DEFAULT_MAX_ENHANCE_LEVEL, chi phí
   * resolve theo realmId hiện hành (catalog nghề → template của item
   * đang mặc nếu có → fallback Linh Thạch thuần).
   */
  enhance(
    slot: EquipmentSlot,

    realmId: string,

    inventory: EquipmentBag,

    registry: EquipmentRegistry,

    materialBag: MaterialBag,

    slotManager: EquipmentSlotManager,

    affixRegistry: AffixRegistry,
  ): { ok: boolean; reason?: string } {
    const slotState = slotManager.get(slot)

    const equipped = inventory.getEquippedInSlot(slot)

    const template = equipped ? this.tryGetTemplate(registry, equipped.itemId) : undefined

    const maxLevel = this.getMaxEnhanceLevel(template)

    if (slotState.enhanceLevel >= maxLevel) {
      return { ok: false, reason: 'max_level' }
    }

    const enhanceLevel = slotState.enhanceLevel

    const cost = this.resolveEnhanceCost(realmId, enhanceLevel, template)
    const spiritStoneMaterialId = getSpiritStoneMaterialIdForEnhanceLevel(enhanceLevel)

    // Plan Workstream F — Linh Thạch là MATERIAL: check/trừ qua
    // MaterialBag (spiritStone trong cost chỉ còn authoring sugar được
    // normalize tại boundary này).
    if (!this.hasSpiritStones(materialBag, cost.spiritStone, spiritStoneMaterialId)) {
      return { ok: false, reason: 'missing_spirit_stone' }
    }

    for (const entry of cost.materials) {
      if (!materialBag.has(entry.materialId, entry.amount)) {
        return { ok: false, reason: 'missing_material' }
      }
    }

    this.spendSpiritStones(materialBag, cost.spiritStone, spiritStoneMaterialId)

    for (const entry of cost.materials) {
      materialBag.remove(entry.materialId, entry.amount)
    }

    slotState.enhanceLevel++

    if (equipped?.equipped) {
      this.modifierSystem.removeBySource(equipped.instanceId)

      this.applyModifiers(equipped, slotManager, affixRegistry)
    }

    return { ok: true }
  }

  /**
   * TẦY LUYỆN (2026-08-25, resource-professions-rework plan §7.3) —
   * reroll TOÀN BỘ identity substat: số dòng (weighted theo phẩm Quáng,
   * cap theo rarity/quality của item), identity từ pool hợp lệ, tier
   * ban đầu (weighted theo phẩm Quáng, cap quality gate). KHÔNG đổi
   * main stat, quality, realm, cấp Cường Hóa slot.
   *
   * Chi phí bắt buộc: Điểm Rèn + Quáng CÙNG cảnh giới item (1 stack
   * cùng material/phẩm — MVP chống trộn phẩm, §5.3) + Linh Thạch.
   * Validation trước, trừ toàn bộ sau khi thành công.
   */
  washAffixes(
    instanceId: string,
    oreMaterialId: string,
    inventory: EquipmentBag,
    registry: EquipmentRegistry,
    materialBag: MaterialBag,
    slotManager: EquipmentSlotManager,
    affixRegistry: AffixRegistry,
    random: () => number = Math.random,
  ): { ok: boolean; reason?: string } {
    const instance = inventory.get(instanceId)

    if (!instance || !registry.has(instance.itemId)) {
      return { ok: false, reason: 'not_found' }
    }

    // Guard nhất quán với Hóa Luyện (§7.5) — item locked/favorite
    // không được Tẩy Luyện.
    if (instance.locked) {
      return { ok: false, reason: 'locked' }
    }

    if (instance.favorite) {
      return { ok: false, reason: 'favorite' }
    }

    // Quáng phải cùng cảnh giới item và có meta nghề đầy đủ.
    const oreMeta = this.oreQualityOf(oreMaterialId)

    if (!this.canUseOreForInstance(oreMaterialId, instance.realmId)) {
      return { ok: false, reason: 'ore_realm_mismatch' }
    }

    if (!oreMeta) {
      return { ok: false, reason: 'ore_invalid' }
    }

    const oreAmount = this.applyCostDiscount(WASH_ORE_AMOUNT)
    const washSpiritStoneCost = this.applyCostDiscount(WASH_SPIRIT_STONE_COST)
    const washSpiritStoneId = this.spiritStoneIdForRealm(instance.realmId)

    if (!materialBag.has(oreMaterialId, oreAmount)) {
      return { ok: false, reason: 'missing_ore' }
    }

    // Điểm Rèn PER-ITEM (rework 2026-08-26) — tiêu vào CHÍNH món đồ.
    if (this.itemRefinementPoints(instance) < WASH_REFINEMENT_COST) {
      return { ok: false, reason: 'missing_refinement_points' }
    }

    if (!materialBag.has(washSpiritStoneId, washSpiritStoneCost)) {
      return { ok: false, reason: 'missing_spirit_stone' }
    }

    const template = this.tryGetTemplate(registry, instance.itemId)

    if (!template) {
      return { ok: false, reason: 'template_not_found' }
    }

    const rarityCap = EQUIPMENT_RARITY_AFFIX_SLOTS[instance.rarity]

    const maxLines = Math.min(
      GLOBAL_MAX_AFFIXES,
      rarityCap.prefix + rarityCap.suffix,
      WASH_LINE_COUNT_WEIGHTS[oreMeta].length,
    )

    // Roll SỐ DÒNG weighted theo phẩm Quáng (§7.3 bảng 1).
    const lineWeights = WASH_LINE_COUNT_WEIGHTS[oreMeta].slice(0, maxLines)

    // maxLines = 0 (đồ phẩm Hoàng, 0 affix slot theo thiết kế) → không
    // có gì để roll, lineCount PHẢI là 0 — sàn Math.max(1, ...) chỉ áp
    // dụng khi thật sự có slot (maxLines > 0).
    const lineCount = maxLines <= 0 ? 0 : Math.max(1, rollWeightedIndex(lineWeights, random) + 1)

    const maxTier = EQUIPMENT_QUALITY_MAX_AFFIX_TIER[instance.quality]

    const unlockedPools = EQUIPMENT_QUALITY_UNLOCKED_POOLS[instance.quality]

    const prefixCap = rarityCap.prefix

    const suffixCap = rarityCap.suffix

    let prefixCount = 0

    let suffixCount = 0

    const excludeStats: StatType[] = [instance.mainStat.stat]

    const rolled: RolledAffix[] = []

    for (let index = 0; index < lineCount; index++) {
      const kind: AffixKind =
        prefixCount < prefixCap ? 'prefix' : suffixCount < suffixCap ? 'suffix' : 'prefix'

      // P2 cleanup — cùng predicate với roll thường qua filterEligibleAffixes().
      const candidates = this.filterEligibleAffixes(
        affixRegistry.getByKind(kind),
        template,
        unlockedPools,
        excludeStats,
      )

      const fallbackCandidates =
        candidates.length > 0
          ? candidates
          : this.filterEligibleAffixes(
              affixRegistry.getByKind(kind === 'prefix' ? 'suffix' : 'prefix'),
              template,
              unlockedPools,
              excludeStats,
            )

      if (fallbackCandidates.length === 0) {
        break
      }

      const affix = fallbackCandidates[randomInt(0, fallbackCandidates.length - 1)]!

      const eligibleTiers = affix.tiers.filter((tierDef) => tierDef.tier <= maxTier)

      if (eligibleTiers.length === 0) {
        break
      }

      // Roll TIER BAN ĐẦU weighted theo phẩm Quáng (§7.3 bảng 2).
      const tierWeights = eligibleTiers.map(
        (tierDef) => WASH_TIER_WEIGHTS[oreMeta][tierDef.tier - 1] ?? 1,
      )

      const chosenTier = eligibleTiers[rollWeightedIndex(tierWeights, random)]!

      rolled.push({
        affixId: affix.id,

        tier: chosenTier.tier,

        value: rollAffixRange(chosenTier.min, chosenTier.max),
      })

      if (kind === 'prefix') {
        prefixCount += 1
      } else {
        suffixCount += 1
      }

      excludeStats.push(affix.stat)
    }

    if (rolled.length === 0) {
      return { ok: false, reason: 'no_eligible_affix' }
    }

    // Validation xong — trừ toàn bộ cost rồi áp kết quả.
    // Điểm Rèn trừ vào INSTANCE (per-item), Linh Thạch là MATERIAL
    // trong MaterialBag (plan Workstream F).

    this.spendItemRefinementPoints(instance, WASH_REFINEMENT_COST)

    materialBag.remove(washSpiritStoneId, washSpiritStoneCost)

    materialBag.remove(oreMaterialId, oreAmount)

    instance.affixes = rolled

    if (instance.equipped) {
      this.modifierSystem.removeBySource(instance.instanceId)

      this.applyModifiers(instance, slotManager, affixRegistry)
    }

    return { ok: true }
  }

  /**
   * TINH LUYỆN (2026-08-25, resource-professions-rework plan §7.4) —
   * giữ NGUYÊN identity của mọi substat, roll lại GIÁ TRỊ từng dòng
   * KHÔNG khóa trong khoảng ±20% so với giá trị hiện tại (clamp trong
   * min/max hợp lệ của tier). Khóa L dòng → cost hệ số N + L; KHÔNG
   * cho khóa toàn bộ.
   *
   * Chi phí bắt buộc: Điểm Rèn + Tinh Hoa cùng tier/cảnh giới item
   * (N + L) + Linh Thạch (đơn giá × N + L).
   */
  refineAffixValues(
    instanceId: string,
    lockedIndices: readonly number[],
    inventory: EquipmentBag,
    registry: EquipmentRegistry,
    materialBag: MaterialBag,
    slotManager: EquipmentSlotManager,
    affixRegistry: AffixRegistry,
    random: () => number = Math.random,
  ): { ok: boolean; reason?: string } {
    const instance = inventory.get(instanceId)

    if (!instance || !registry.has(instance.itemId)) {
      return { ok: false, reason: 'not_found' }
    }

    // Guard nhất quán với Hóa Luyện (§7.5) — item locked/favorite
    // không được Tinh Luyện.
    if (instance.locked) {
      return { ok: false, reason: 'locked' }
    }

    if (instance.favorite) {
      return { ok: false, reason: 'favorite' }
    }

    const lineCount = instance.affixes.length

    if (lineCount === 0) {
      return { ok: false, reason: 'no_affixes' }
    }

    // Validate locks: unique, in-range, ≤ max, và không được khóa toàn bộ.
    const uniqueLocks = Array.from(new Set(lockedIndices)).filter(
      (index) => Number.isInteger(index) && index >= 0 && index < lineCount,
    )

    if (uniqueLocks.length !== lockedIndices.length) {
      return { ok: false, reason: 'invalid_lock' }
    }

    if (uniqueLocks.length > REFINE_MAX_LOCKS) {
      return { ok: false, reason: 'too_many_locks' }
    }

    if (uniqueLocks.length >= lineCount) {
      return { ok: false, reason: 'cannot_lock_all' }
    }

    if (this.itemRefinementPoints(instance) < REFINE_REFINEMENT_COST) {
      return { ok: false, reason: 'missing_refinement_points' }
    }

    const essenceUnits = this.applyCostDiscount(lineCount + uniqueLocks.length)

    const essenceId = equipmentEssenceMaterialId(instance.realmId)

    if (!essenceId) {
      return { ok: false, reason: 'no_conversion_rule' }
    }

    if (!materialBag.has(essenceId, essenceUnits)) {
      return { ok: false, reason: 'missing_essence' }
    }

    const spiritStoneCost = this.applyCostDiscount(
      (lineCount + uniqueLocks.length) * REFINE_SPIRIT_STONE_PER_UNIT,
    )

    const refineSpiritStoneId = this.spiritStoneIdForRealm(instance.realmId)

    if (!materialBag.has(refineSpiritStoneId, spiritStoneCost)) {
      return { ok: false, reason: 'missing_spirit_stone' }
    }

    // Roll giá trị mới cho từng dòng KHÔNG khóa — ±20% hiện tại, clamp
    // range tier. Kết quả thu thập trước, áp sau khi mọi thứ pass.
    const newValues = new Map<number, number>()

    for (let index = 0; index < lineCount; index++) {
      if (uniqueLocks.includes(index)) {
        continue
      }

      const rolled = instance.affixes[index]!

      const affix = affixRegistry.get(rolled.affixId)

      const tierDef = affix.tiers.find((candidate) => candidate.tier === rolled.tier)

      if (!tierDef) {
        continue
      }

      const current = getEffectiveAffixValue(rolled, affix)

      const low = Math.max(tierDef.min, current * (1 - REFINE_VALUE_VARIANCE))

      const high = Math.min(tierDef.max, current * (1 + REFINE_VALUE_VARIANCE))

      newValues.set(index, rollAffixRange(Math.min(low, high), Math.max(low, high)))
    }

    this.spendItemRefinementPoints(instance, REFINE_REFINEMENT_COST)

    materialBag.remove(refineSpiritStoneId, spiritStoneCost)

    materialBag.remove(essenceId, essenceUnits)

    for (const [index, value] of newValues) {
      instance.affixes[index]!.value = value
    }

    if (instance.equipped) {
      this.modifierSystem.removeBySource(instance.instanceId)

      this.applyModifiers(instance, slotManager, affixRegistry)
    }

    return { ok: true }
  }

  /**
   * HÓA LUYỆN (2026-08-25, resource-professions-rework plan §7.5) —
   * phân giải DESTRUCTIVE trang bị thành Tinh Hoa theo tier cảnh giới
   * và quality. Batch all-or-nothing: không xoá một phần item nếu cộng
   * reward thất bại. Không tiêu hao Điểm Rèn.
   *
   * Guards (§7.5): item đang trang bị / locked / favorite bị từ chối.
   * Số Tinh Hoa theo bảng DISSOLVE_ESSENCE_RANGE_BY_QUALITY; tier
   * Tinh Hoa theo realm của item.
   */
  dissolveInstances(
    instanceIds: readonly string[],
    inventory: EquipmentBag,
    random: () => number = Math.random,
  ): { ok: boolean; reason?: string; rewards?: Array<{ materialId: string; amount: number }> } {
    if (instanceIds.length === 0) {
      return { ok: false, reason: 'empty_selection' }
    }

    // Dedupe — selection trùng id (UI double-submit/race) từng khiến pass 1
    // tính reward 2 lần trong khi pass 2 chỉ remove 1 lần → nhân bản Tinh
    // Hoa (review 2026-08-28).
    const uniqueIds = Array.from(new Set(instanceIds))

    const instances: EquipmentInstance[] = []

    const rewards: Array<{ materialId: string; amount: number }> = []

    // Pass 1 — validate TOÀN BỘ selection + tính trước rewards.
    for (const instanceId of uniqueIds) {
      const instance = inventory.get(instanceId)

      if (!instance) {
        return { ok: false, reason: 'not_found' }
      }

      if (instance.equipped) {
        return { ok: false, reason: 'equipped' }
      }

      if (instance.locked) {
        return { ok: false, reason: 'locked' }
      }

      if (instance.favorite) {
        return { ok: false, reason: 'favorite' }
      }

      const essenceId = equipmentEssenceMaterialId(instance.realmId)

      if (!essenceId) {
        return { ok: false, reason: 'no_conversion_rule' }
      }

      const range = DISSOLVE_ESSENCE_RANGE_BY_QUALITY[instance.rarity]

      if (!range) {
        return { ok: false, reason: 'no_conversion_rule' }
      }

      const amount = Math.floor(range.min + random() * (range.max - range.min + 1))

      instances.push(instance)

      rewards.push({ materialId: essenceId, amount })
    }

    // Pass 2 — all-or-nothing transaction: xoá đúng item rồi cộng
    // Tinh Hoa trong cùng thao tác (§7.5).
    for (const instance of instances) {
      inventory.remove(instance.instanceId)
    }

    return { ok: true, rewards }
  }

  /** Meta phẩm Quáng của material id — null nếu không phải quáng nghề. */
  private oreQualityOf(materialId: string): OreQuality | null {
    const match =
      /^(mortal|qi_refining|foundation_establishment)_ore_(hoang|huyen|dia|thien|tien)$/.exec(
        materialId,
      )

    return match ? (match[2] as OreQuality) : null
  }

  private canUseOreForInstance(oreMaterialId: string, instanceRealmId: string): boolean {
    const match = /^(mortal|qi_refining|foundation_establishment)_ore_/.exec(oreMaterialId)

    return match !== null && match[1] === instanceRealmId
  }

  getModifiers(): StatModifier[] {
    return this.modifierSystem.getAll()
  }

  /**
   * Build lại modifierSystem nội bộ từ toàn bộ instance đang
   * equipped trong inventory — cần gọi sau khi nạp EquipmentBag
   * từ save, vì modifierSystem là state trong bộ nhớ của
   * EquipmentSystem, không tự phục hồi theo EquipmentBag.
   */
  refreshModifiers(
    inventory: EquipmentBag,
    slotManager: EquipmentSlotManager,
    affixRegistry: AffixRegistry,
  ) {
    this.modifierSystem.clear()

    for (const instance of inventory.getEquipped()) {
      this.applyModifiers(instance, slotManager, affixRegistry)
    }
  }

  /**
   * Build modifier từ chỉ số ĐÃ ROLL của instance (Implicit/mainStat +
   * affixes), nhân hệ số theo enhanceLevel (đọc từ SLOT, Phase 9) +
   * forgePoints (item-level, Equipment Rework) — 2 trục cộng dồn cùng
   * lúc. Formation (Khắc Trận) được áp riêng qua GameManager.
   * getAggregatedModifiers(), không nằm trong hàm này.
   */
  private applyModifiers(
    instance: EquipmentInstance,
    slotManager: EquipmentSlotManager,
    affixRegistry: AffixRegistry,
  ) {
    const enhanceLevel = slotManager.get(instance.slot).enhanceLevel

    const scale = calculateEquipmentScale(enhanceLevel, instance.forgePoints)

    this.applyScaledModifier(
      instance.instanceId,
      instance.mainStat.stat,
      instance.mainStat.flat ?? 0,
      scale,
    )

    for (const rolled of instance.affixes) {
      const affix = affixRegistry.get(rolled.affixId)
      const value = getEffectiveAffixValue(rolled, affix)

      this.applyScaledModifier(instance.instanceId, affix.stat, value, scale)
    }
  }

  private applyScaledModifier(instanceId: string, stat: StatType, baseFlat: number, scale: number) {
    this.modifierSystem.add({
      id: `${instanceId}:${stat}`,

      sourceId: instanceId,

      sourceType: 'equipment',

      stat,

      flat: baseFlat * scale,
    })
  }

  private getScaledCost(cost: Equipment['enhanceCost'], currentLevel: number) {
    if (!cost) {
      return []
    }

    const multiplier = currentLevel + 1

    return cost.map((entry) => ({
      materialId: entry.materialId,

      amount: entry.amount * multiplier,
    }))
  }
}
