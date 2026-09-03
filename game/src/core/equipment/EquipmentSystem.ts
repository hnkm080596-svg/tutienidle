import type { Equipment, RecipeMaterialCost } from './Equipment'
import type { EquipmentInstance } from './EquipmentInstance'
import { EquipmentBag } from './EquipmentBag'
import { EquipmentRegistry } from './EquipmentRegistry'
import { ITEM_QUALITY_ORDER, type ItemQuality } from '../item/ItemQuality'
import {
  ITEM_QUALITY_AFFIX_TIER,
  ITEM_QUALITY_DROP_WEIGHT,
  ITEM_QUALITY_EXALTED_AFFIX_CHANCE,
  ITEM_QUALITY_FORGE_USES,
  ITEM_QUALITY_IMPLICIT_MULTIPLIER,
  ITEM_QUALITY_SUBSTATS_RANGE,
  ITEM_QUALITY_UNLOCKED_POOLS,
} from './ItemQualityBalance'
import type { EquipmentSlot } from './EquipmentTypes'
import { EquipmentSlotManager } from './EquipmentSlotManager'
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
import { getGlobalCultivationLevel } from '../realm/realmSystem'
import {
  getProfessionGradeForRealm,
  realmFromGrade,
} from '../profession/ProfessionGrade'
import { randomInt, weightedRandom, rollChance } from '../reward/DropRoll'
import { assertValidEquipmentMainStats, isValidEquipmentSubstat } from './EquipmentStatPolicy'
import type {
  EquipmentOperation,
  EquipmentOperationCost,
  EquipmentOperationCostCatalog,
  EquipmentOperationCostContext,
} from './EquipmentOperationCostCatalog'
import {
  REFINE_INCREASE_MAX,
  REFINE_INCREASE_MIN,
  REFINE_MAX_LOCKS,
  REFINE_SPIRIT_STONE_PER_UNIT,
  REFINE_TINH_HOA_COST_BY_QUALITY,
  WASH_SPIRIT_STONE_COST,
  WASH_TINH_HOA_COST_BY_QUALITY,
} from './RefinementBalance'
import { LUYEN_KHI_TINH_HOA_ID } from './TinhHoaMaterial'
import { canUseItemGrade } from './canUseItem'
import { dissolveInstances as dissolveInstancesImpl } from './EquipmentDissolve'
import {
  GLOBAL_MAX_AFFIXES,
  filterEligibleAffixes,
  getEffectiveAffixValue,
  normalizeRolledAffixValue,
  rollAffixRange,
  rollEligibleAffixAtTier,
} from './EquipmentRollPrimitives'
import {
  commitWashAffixes as commitWashAffixesImpl,
  previewWashAffixes as previewWashAffixesImpl,
  washAffixes as washAffixesImpl,
  type WashDeps,
} from './EquipmentWash'

// Task 8 (phase7-gamemanager-split) — rollAffixRange/normalizeRolledAffixValue/
// getEffectiveAffixValue/GLOBAL_MAX_AFFIXES sống ở EquipmentRollPrimitives.ts
// (dùng chung với EquipmentWash.ts); re-export lại ở đây để mọi import site
// cũ (`from './EquipmentSystem'`) không phải đổi.
export { GLOBAL_MAX_AFFIXES, getEffectiveAffixValue, normalizeRolledAffixValue, rollAffixRange }

// Hệ số nhân thêm mỗi bậc cường hóa. Export để UI (EquipmentHallPanel's
// Enhance preview) tính trước giá trị SAU khi cường hóa mà không phải
// lặp lại công thức.
//
// Task 10 (rework P3, 2026-09-01) — ENHANCE_PERCENT_PER_LEVEL (0.08) và
// FORGE_PERCENT_PER_POINT ĐÃ XÓA: scale giờ slot-only `1 + level ×
// ENHANCE_SLOT_SCALE (0.06)` — forgeUses là ngân sách tẩy/tinh của
// item, KHÔNG scale. Curve mũ 0.956 + pity 10 ở EnhanceCurve.ts.
import {
  ENHANCE_PITY_THRESHOLD,
  ENHANCE_SLOT_SCALE,
  MAX_SLOT_ENHANCE_LEVEL,
  enhanceSuccessRate,
} from './EnhanceCurve'

/**
 * Hệ số nhân hiệu lực của 1 instance theo SLOT enhanceLevel — dùng lại
 * y hệt trong applyModifiers() lẫn UI preview (Enhance tab), đảm bảo 2
 * nơi luôn khớp công thức.
 */
export function calculateEquipmentScale(enhanceLevel: number): number {
  return 1 + enhanceLevel * ENHANCE_SLOT_SCALE
}

/**
 * 1 dòng giá trị Tinh Luyện đã roll (preview/commit — 2026-08-30, UI
 * "giữ/bỏ") — index trỏ vào instance.affixes, value là giá trị mới đã
 * roll tăng 5–20% cho dòng đó, clamp theo trần tier.
 */
export interface RefineValueEntry {
  index: number

  value: number
}

interface RefineAffixSnapshot {
  affixId: string

  tier: number

  value: number
}

interface RefineInstanceSnapshot {
  instanceId: string

  itemId: string

  slot: EquipmentSlot

  equipped: boolean

  locked: boolean | undefined

  favorite: boolean | undefined

  grade: EquipmentInstance['grade']

  quality: EquipmentInstance['quality']

  realmLevel: number | undefined

  zoneId: string | undefined

  icon: string | undefined

  forgeUsesTotal: number

  forgeUsesRemaining: number

  mainStat: StatModifier

  affixes: RefineAffixSnapshot[]
}

interface PendingRefinePreview {
  instance: EquipmentInstance

  membershipGeneration: number

  snapshot: RefineInstanceSnapshot

  values: RefineValueEntry[]
}

function cloneRefineMainStat(mainStat: StatModifier): StatModifier {
  return {
    id: mainStat.id,
    sourceId: mainStat.sourceId,
    sourceType: mainStat.sourceType,
    stat: mainStat.stat,
    tag: mainStat.tag,
    flat: mainStat.flat,
    percent: mainStat.percent,
    multiplier: mainStat.multiplier,
    stacks: mainStat.stacks,
    maxStacks: mainStat.maxStacks,
    perLevelFlat: mainStat.perLevelFlat,
    perLevelPercent: mainStat.perLevelPercent,
  }
}

function refineMainStatMatches(current: StatModifier, expected: StatModifier): boolean {
  return (
    current.id === expected.id &&
    current.sourceId === expected.sourceId &&
    current.sourceType === expected.sourceType &&
    current.stat === expected.stat &&
    current.tag === expected.tag &&
    current.flat === expected.flat &&
    current.percent === expected.percent &&
    current.multiplier === expected.multiplier &&
    current.stacks === expected.stacks &&
    current.maxStacks === expected.maxStacks &&
    current.perLevelFlat === expected.perLevelFlat &&
    current.perLevelPercent === expected.perLevelPercent
  )
}

function isExactRefineValueEntry(value: unknown): value is RefineValueEntry {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }

  const candidate = value as Record<string, unknown>
  const keys = Object.keys(candidate)

  return (
    keys.length === 2 &&
    keys.includes('index') &&
    keys.includes('value') &&
    typeof candidate.index === 'number' &&
    Number.isInteger(candidate.index) &&
    typeof candidate.value === 'number' &&
    Number.isFinite(candidate.value)
  )
}

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
 * Chỉ số phụ là Affix (Prefix/Suffix có Tier, xem Affix.ts). Grade cố
 * định theo realm; quality Ngũ Chất quyết định số lượng/tier/pool affix
 * và hệ số implicit của item.
 */
export class EquipmentSystem {
  private readonly modifierSystem = new ModifierSystem()

  // Khí Đường chỉ hiển thị một Refine preview tại một thời điểm. Một capability
  // duy nhất vừa chặn provenance tích lũy vô hạn, vừa bảo đảm attempt mới (kể cả
  // thất bại) vô hiệu hóa payload trả phí trước đó ở bất kỳ item nào.
  private pendingRefinePreview: PendingRefinePreview | null = null

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
   * Roll 1 instance mới từ template. Grade theo realm của người chơi;
   * quality roll độc lập theo trọng số cố định và quyết định implicit,
   * số lượng/tier/pool substat cùng ngân sách Rèn.
   */
  createInstance(
    template: Equipment,
    player: PlayerData,
    affixRegistry: AffixRegistry,
    zoneId?: string,
  ): EquipmentInstance {
    assertValidEquipmentMainStats(template)

    const grade = getProfessionGradeForRealm(player.realmId)
    if (!grade) {
      throw new Error(`Missing profession grade for equipment realm ${player.realmId}`)
    }

    const quality = this.rollItemQuality()

    const mainStat = this.rollMainStat(template, grade, player, quality)

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

      icon: this.rollIcon(template),

      mainStat,

      affixes: this.rollAffixes(template, mainStat.stat, quality, affixRegistry),

      forgeUsesTotal: forgeUses,

      forgeUsesRemaining: forgeUses,
    }
  }
  private rollIcon(template: Equipment): string | undefined {
    const pool = template.iconPool?.filter(Boolean) ?? []
    return pool.length > 0 ? pool[randomInt(0, pool.length - 1)] : template.icon
  }

  private rollItemQuality(): ItemQuality {
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
  private rollMainStat(
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
  private rollAffixes(
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

    const result = this.rollAffixesWithKindFallback(
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

  private rollAffixesWithKindFallback(
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
        this.rollEligibleAffix(
          template,
          requestedKind,
          maxTier,
          pools,
          excludeStats,
          affixRegistry,
        ) ??
        this.rollEligibleAffix(template, fallbackKind, maxTier, pools, excludeStats, affixRegistry)

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
  private rollEligibleAffix(
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

    return this.rollAffixValue(affix, maxTier)
  }

  private rollAffixValue(affix: Affix, maxTier: number): RolledAffix | null {
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

  /**
   * (rework P5, Task 16) — Equipment KHÔNG có requiredRealmId trên
   * template (khác Recipe/Building/Skill): gate không dựa vào template mà
   * vào instance.grade (phẩm nghề set lúc rớt đồ) so với phẩm nghề hiện
   * tại của người chơi (canUseItemGrade) — lệch bậc nào (cao hoặc thấp)
   * cũng bị chặn, không phải "đủ hoặc cao hơn". Item ĐANG MẶC luôn
   * idempotent ok:true bất kể lệch phẩm (tránh tự unequip đồ cũ khi
   * cảnh giới người chơi đổi qua save/breakthrough).
   */
  equip(
    instanceId: string,
    inventory: EquipmentBag,
    registry: EquipmentRegistry,
    slotManager: EquipmentSlotManager,
    player: PlayerData,
    affixRegistry: AffixRegistry,
  ): { ok: boolean; reason?: string } {
    const instance = inventory.get(instanceId)

    if (!instance) {
      return { ok: false, reason: 'not_found' }
    }

    if (instance.equipped) {
      return { ok: true }
    }

    if (!canUseItemGrade(instance.grade, player.realmId)) {
      return { ok: false, reason: 'grade_mismatch' }
    }

    const current = inventory.getEquippedInSlot(instance.slot)

    if (current) {
      this.unequip(current.instanceId, inventory)
    }

    instance.equipped = true

    this.applyModifiers(instance, slotManager, affixRegistry)

    return { ok: true }
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
   * ĐIỂM RÈN của món đồ = forgeUsesRemaining hiện tại —
   * CHÍNH LÀ "Tình trạng rèn x/y" trong tooltip, KHÔNG phải pool nào
   * khác. Tẩy Luyện/Tinh Luyện tiêu thụ tài nguyên này; item sinh ra
   * với tình trạng ĐẦY (xem createInstance).
   */
  itemRefinementPoints(instance: EquipmentInstance): number {
    return instance.forgeUsesRemaining
  }

  private spendItemRefinementPoints(instance: EquipmentInstance, amount: number) {
    instance.forgeUsesRemaining = Math.max(0, instance.forgeUsesRemaining - amount)
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
  /** Một nguồn resolve cost Cường Hóa: catalog nghi�m  template  fallback. */
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

  /** Cost Tẩy Luyện sau discount Khí Đường; UI và transaction dùng chung. */
  getWashCost(quality: ItemQuality): { tinhHoa: number; spiritStone: number } {
    return {
      tinhHoa: this.applyCostDiscount(WASH_TINH_HOA_COST_BY_QUALITY[quality]),
      spiritStone: this.applyCostDiscount(WASH_SPIRIT_STONE_COST),
    }
  }

  /** Cost Tinh Luyện sau discount Khí Đường; UI và transaction dùng chung. */
  getRefineCost(
    lineCount: number,
    lockedCount: number,
    quality: ItemQuality = ITEM_QUALITY_ORDER[0]!,
  ): {
    essenceUnits: number
    spiritStone: number
    spiritStoneMaterialId: string
    refinementPoints: number
  } {
    const baseUnits = Math.max(0, lineCount) + Math.max(0, lockedCount)

    return {
      essenceUnits: this.applyCostDiscount(REFINE_TINH_HOA_COST_BY_QUALITY[quality]),
      spiritStone: this.applyCostDiscount(baseUnits * REFINE_SPIRIT_STONE_PER_UNIT),
      spiritStoneMaterialId: SPIRIT_STONE_MATERIAL_ID,
      refinementPoints: 1,
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

    random: () => number = Math.random,
  ): { ok: boolean; reason?: string } {
    const slotState = slotManager.get(slot)

    const equipped = inventory.getEquippedInSlot(slot)

    const template = equipped ? this.tryGetTemplate(registry, equipped.itemId) : undefined

    if (slotState.enhanceLevel >= MAX_SLOT_ENHANCE_LEVEL) {
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

    // Task 10 pity roll: rate theo level ke + 1; streak cham nguong
    // -> chac chan thanh cong bat chap random. FAIL chi mat nguyen
    // lieu lan thu (da tru o tren), KHONG doi level.
    const successRate = enhanceSuccessRate(enhanceLevel + 1)
    const pityGuaranteed = slotState.enhanceFailStreak >= ENHANCE_PITY_THRESHOLD
    const success = pityGuaranteed || random() * 100 < successRate

    if (!success) {
      slotState.enhanceFailStreak += 1

      return { ok: false, reason: 'enhance_failed' }
    }

    slotState.enhanceLevel++
    slotState.enhanceFailStreak = 0

    if (equipped?.equipped) {
      this.modifierSystem.removeBySource(equipped.instanceId)

      this.applyModifiers(equipped, slotManager, affixRegistry)
    }

    return { ok: true }
  }

  /**
   * TẦY LUYỆN (2026-08-25, resource-professions-rework plan §7.3) —
   * reroll TOÀN BỘ identity substat: số dòng trong trần Chất,
   * identity từ pool hợp lệ, tier weighted theo Chất. KHÔNG đổi
   * main stat, quality, realm, cấp Cường Hóa slot.
   *
   * Chi phí bắt buộc: 1 lượt Rèn + Luyện Khí Tinh Hoa + Linh Thạch.
   * Validation trước, trừ toàn bộ sau khi thành công.
   *
   * Task 8 (phase7-gamemanager-split) — logic thật tách sang
   * EquipmentWash.ts (roll-affix primitives dùng chung với
   * createInstance ở EquipmentRollPrimitives.ts); EquipmentSystem chỉ
   * còn bind state riêng (cost discount, ModifierSystem) qua
   * washDeps().
   */
  washAffixes(
    instanceId: string,
    inventory: EquipmentBag,
    registry: EquipmentRegistry,
    materialBag: MaterialBag,
    slotManager: EquipmentSlotManager,
    affixRegistry: AffixRegistry,
    random: () => number = Math.random,
  ): { ok: boolean; reason?: string } {
    return washAffixesImpl(
      instanceId,
      inventory,
      registry,
      materialBag,
      slotManager,
      affixRegistry,
      this.washDeps(),
      random,
    )
  }

  /**
   * Xem trước Tẩy Luyện (2026-08-30, UI "giữ/bỏ") — roll + validate + TRỪ
   * COST giống hệt washAffixes(), nhưng KHÔNG ghi affixes mới vào
   * instance. Trả affixes đã roll cho UI hiển thị cột "sau khi Tẩy" —
   * người chơi bấm lại (trả cost lần nữa, roll mới) hoặc "Giữ"
   * (commitWashAffixes, không tốn thêm) để chốt.
   */
  previewWashAffixes(
    instanceId: string,
    inventory: EquipmentBag,
    registry: EquipmentRegistry,
    materialBag: MaterialBag,
    affixRegistry: AffixRegistry,
    random: () => number = Math.random,
  ): { ok: boolean; reason?: string; affixes?: RolledAffix[] } {
    return previewWashAffixesImpl(
      instanceId,
      inventory,
      registry,
      materialBag,
      affixRegistry,
      this.washDeps(),
      random,
    )
  }

  /** Chốt kết quả đã preview (previewWashAffixes) — không kiểm tra/trừ cost lần nữa. */
  commitWashAffixes(
    instanceId: string,
    affixes: RolledAffix[],
    inventory: EquipmentBag,
    slotManager: EquipmentSlotManager,
    affixRegistry: AffixRegistry,
  ): { ok: boolean; reason?: string } {
    return commitWashAffixesImpl(
      instanceId,
      affixes,
      inventory,
      slotManager,
      affixRegistry,
      this.washDeps(),
    )
  }

  /** Deps injection cho EquipmentWash.ts — xem ghi chú washAffixes(). */
  private washDeps(): WashDeps {
    return {
      tryGetTemplate: (registry, itemId) => this.tryGetTemplate(registry, itemId),

      getWashCost: (quality) => this.getWashCost(quality),

      spendItemRefinementPoints: (instance, amount) =>
        this.spendItemRefinementPoints(instance, amount),

      refreshEquippedModifiers: (instance, slotManager, affixRegistry) => {
        if (instance.equipped) {
          this.modifierSystem.removeBySource(instance.instanceId)

          this.applyModifiers(instance, slotManager, affixRegistry)
        }
      },
    }
  }

  /**
   * TINH LUYỆN (2026-08-25, resource-professions-rework plan §7.4) —
   * giữ NGUYÊN identity của mọi substat, tăng GIÁ TRỊ từng dòng
   * KHÔNG khóa trong khoảng 5–20% (clamp trong min/max hợp lệ của
   * tier). Khóa L dòng → cost Linh Thạch hệ số N + L; KHÔNG
   * cho khóa toàn bộ.
   *
   * Chi phí bắt buộc: 1 lượt Rèn + Luyện Khí Tinh Hoa theo Chất
   * + Linh Thạch phổ thông (đơn giá × N + L).
   */
  refineAffixValues(
    instanceId: string,
    lockedIndices: readonly number[],
    inventory: EquipmentBag,
    registry: EquipmentRegistry,
    materialBag: MaterialBag,
    slotManager: EquipmentSlotManager,
    affixRegistry: AffixRegistry,
    _random: () => number = Math.random,
  ): { ok: boolean; reason?: string } {
    const result = this.rollRefineValues(
      instanceId,
      lockedIndices,
      inventory,
      registry,
      materialBag,
      affixRegistry,
      _random,
    )

    if (!result.ok) {
      return result
    }

    return this.commitRefineValues(instanceId, result.values, inventory, slotManager, affixRegistry)
  }

  /**
   * Xem trước Tinh Luyện (2026-08-30, UI "giữ/bỏ") — cùng cơ chế preview/
   * commit với previewWashAffixes/commitWashAffixes: roll + validate + TRỪ
   * COST giống refineAffixValues() nhưng KHÔNG ghi value mới vào instance.
   */
  previewRefineValues(
    instanceId: string,
    lockedIndices: readonly number[],
    inventory: EquipmentBag,
    registry: EquipmentRegistry,
    materialBag: MaterialBag,
    affixRegistry: AffixRegistry,
    random: () => number = Math.random,
  ): { ok: boolean; reason?: string; values?: RefineValueEntry[] } {
    return this.rollRefineValues(
      instanceId,
      lockedIndices,
      inventory,
      registry,
      materialBag,
      affixRegistry,
      random,
    )
  }

  /** Hủy capability Refine đang chờ; UI gọi khi người chơi bấm Bỏ/đổi context. */
  discardRefinePreview(instanceId?: string): void {
    if (
      instanceId === undefined ||
      this.pendingRefinePreview?.instance.instanceId === instanceId
    ) {
      this.pendingRefinePreview = null
    }
  }

  /** Chốt đúng một lần payload do previewRefineValues/refineAffixValues vừa tạo. */
  commitRefineValues(
    instanceId: string,
    values: readonly RefineValueEntry[],
    inventory: EquipmentBag,
    slotManager: EquipmentSlotManager,
    affixRegistry: AffixRegistry,
  ): { ok: boolean; reason?: string } {
    const pending = this.pendingRefinePreview

    // Một commit attempt luôn tiêu capability nội bộ, kể cả item đã biến mất.
    this.pendingRefinePreview = null

    const instance = inventory.get(instanceId)

    if (!instance) {
      return { ok: false, reason: 'not_found' }
    }

    if (!pending) {
      return { ok: false, reason: 'invalid_refine_preview' }
    }

    const snapshot = pending.snapshot
    const snapshotMatches =
      pending.instance === instance &&
      inventory.getMembershipGeneration(instance) === pending.membershipGeneration &&
      instance.instanceId === snapshot.instanceId &&
      instance.itemId === snapshot.itemId &&
      instance.slot === snapshot.slot &&
      instance.equipped === snapshot.equipped &&
      instance.locked === snapshot.locked &&
      instance.favorite === snapshot.favorite &&
      instance.grade === snapshot.grade &&
      instance.quality === snapshot.quality &&
      instance.realmLevel === snapshot.realmLevel &&
      instance.zoneId === snapshot.zoneId &&
      instance.icon === snapshot.icon &&
      instance.forgeUsesTotal === snapshot.forgeUsesTotal &&
      instance.forgeUsesRemaining === snapshot.forgeUsesRemaining &&
      refineMainStatMatches(instance.mainStat, snapshot.mainStat) &&
      instance.affixes.length === snapshot.affixes.length &&
      instance.affixes.every((affix, index) => {
        const expected = snapshot.affixes[index]

        return (
          expected !== undefined &&
          affix.affixId === expected.affixId &&
          affix.tier === expected.tier &&
          affix.value === expected.value
        )
      })

    const payloadMatches =
      Array.isArray(values) &&
      values.length === pending.values.length &&
      values.every((entry, index) => {
        const expected = pending.values[index]

        return (
          expected !== undefined &&
          isExactRefineValueEntry(entry) &&
          entry.index === expected.index &&
          entry.value === expected.value
        )
      })

    if (!snapshotMatches || !payloadMatches) {
      return { ok: false, reason: 'invalid_refine_preview' }
    }

    for (const entry of values) {
      if (instance.affixes[entry.index]) {
        instance.affixes[entry.index]!.value = entry.value
      }
    }

    if (instance.equipped) {
      this.modifierSystem.removeBySource(instance.instanceId)

      this.applyModifiers(instance, slotManager, affixRegistry)
    }

    return { ok: true }
  }

  private rollRefineValues(
    instanceId: string,
    lockedIndices: readonly number[],
    inventory: EquipmentBag,
    registry: EquipmentRegistry,
    materialBag: MaterialBag,
    affixRegistry: AffixRegistry,
    _random: () => number = Math.random,
  ): { ok: true; values: RefineValueEntry[] } | { ok: false; reason: string } {
    // Mọi attempt mới thay thế capability cũ, kể cả attempt này bị từ chối.
    // Vì vậy preview lỗi không thể làm sống lại một payload đã trả phí trước đó.
    this.pendingRefinePreview = null

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

    if (instance.affixes.some((rolled) => !Number.isFinite(rolled.value))) {
      return { ok: false, reason: 'invalid_affix_value' }
    }

    if (this.itemRefinementPoints(instance) <= 0) {
      return { ok: false, reason: 'no_forge_uses' }
    }

    const eligibleLines: Array<{
      index: number
      current: number
      tierMin: number
      tierMax: number
    }> = []

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

      const current = rolled.value

      if (current >= tierDef.max) {
        continue
      }

      eligibleLines.push({
        index,
        current,
        tierMin: tierDef.min,
        tierMax: tierDef.max,
      })
    }

    if (eligibleLines.length === 0) {
      return { ok: false, reason: 'no_eligible_affix' }
    }

    const essenceUnits = this.applyCostDiscount(
      REFINE_TINH_HOA_COST_BY_QUALITY[instance.quality],
    )

    if (!materialBag.has(LUYEN_KHI_TINH_HOA_ID, essenceUnits)) {
      return { ok: false, reason: 'missing_essence' }
    }

    const spiritStoneCost = this.applyCostDiscount(
      (lineCount + uniqueLocks.length) * REFINE_SPIRIT_STONE_PER_UNIT,
    )

    if (!materialBag.has(SPIRIT_STONE_MATERIAL_ID, spiritStoneCost)) {
      return { ok: false, reason: 'missing_spirit_stone' }
    }

    // Roll giá trị mới cho từng dòng eligible KHÔNG khóa. Mỗi dòng
    // tăng 5–20% từ giá trị hiệu lực riêng rồi clamp theo tier.
    const newValues = new Map<number, number>()

    for (const { index, current, tierMin, tierMax } of eligibleLines) {
      const roll = _random()

      if (!Number.isFinite(roll) || roll < 0 || roll > 1) {
        return { ok: false, reason: 'invalid_random_roll' }
      }

      const increase = REFINE_INCREASE_MIN + roll * (REFINE_INCREASE_MAX - REFINE_INCREASE_MIN)
      const increased = current * (1 + increase)
      const value = Math.min(tierMax, Math.max(tierMin, increased))

      newValues.set(index, value)
    }

    const membershipGeneration = inventory.getMembershipGeneration(instance)

    // Lookup đã chứng minh instance đang là exact live object trong bag. Guard
    // này nằm trước transaction để một EquipmentBag sai contract vẫn không
    // thể làm mất tài nguyên.
    if (membershipGeneration === undefined) {
      return { ok: false, reason: 'not_found' }
    }

    // Trừ cost NGAY (mỗi lần roll/preview đều trả phí, xem ghi chú
    // previewRefineValues) — KHÔNG ghi value vào instance ở đây nữa,
    // commitRefineValues() làm việc đó khi người chơi bấm "Giữ". Cost
    // Tinh Hoa leo thang theo Chất; lượt Rèn luôn trừ đúng 1.
    this.spendItemRefinementPoints(instance, 1)

    materialBag.remove(SPIRIT_STONE_MATERIAL_ID, spiritStoneCost)

    materialBag.remove(LUYEN_KHI_TINH_HOA_ID, essenceUnits)

    const values = Array.from(newValues, ([index, value]) => ({ index, value }))

    this.pendingRefinePreview = {
      instance,
      membershipGeneration,
      snapshot: {
        instanceId: instance.instanceId,
        itemId: instance.itemId,
        slot: instance.slot,
        equipped: instance.equipped,
        locked: instance.locked,
        favorite: instance.favorite,
        grade: instance.grade,
        quality: instance.quality,
        realmLevel: instance.realmLevel,
        zoneId: instance.zoneId,
        icon: instance.icon,
        forgeUsesTotal: instance.forgeUsesTotal,
        forgeUsesRemaining: instance.forgeUsesRemaining,
        mainStat: cloneRefineMainStat(instance.mainStat),
        affixes: instance.affixes.map(({ affixId, tier, value }) => ({ affixId, tier, value })),
      },
      values: values.map(({ index, value }) => ({ index, value })),
    }

    return { ok: true, values }
  }

  /**
   * HÓA LUYỆN (2026-08-25, resource-professions-rework plan §7.5) —
   * phân giải DESTRUCTIVE trang bị thành Tinh Hoa theo tier cảnh giới
   * và quality. Batch all-or-nothing: không xoá một phần item nếu cộng
   * reward thất bại. Không tiêu hao Điểm Rèn.
   *
   * Guards (§7.5): item đang trang bị / locked / favorite bị từ chối.
   * Số Tinh Hoa theo bảng ITEM_QUALITY_ESSENCE_RANGE; mọi Phẩm trang bị
   * cùng trả một loại Luyện Khí Tinh Hoa.
   */
  dissolveInstances(
    instanceIds: readonly string[],
    inventory: EquipmentBag,
    random: () => number = Math.random,
  ): { ok: boolean; reason?: string; rewards?: Array<{ materialId: string; amount: number }> } {
    return dissolveInstancesImpl(
      instanceIds,
      inventory,
      (instanceId) => this.discardRefinePreview(instanceId),
      random,
    )
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

    const scale = calculateEquipmentScale(enhanceLevel)

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
