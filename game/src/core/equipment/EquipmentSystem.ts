import type { Equipment } from './Equipment'
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
import type { PlayerData } from '../player/Player'
import { getGlobalCultivationLevel, getRealmIndex } from '../realm/realmSystem'
import { randomInt, weightedRandom, rollChance } from '../reward/DropRoll'
import { assertValidEquipmentMainStats, isValidEquipmentSubstat } from './EquipmentStatPolicy'

// Hệ số nhân thêm mỗi bậc — cường hóa (Phase 6) và Rèn (Equipment
// Rework, thay refine cũ — xem forge()) là 2 trục riêng, cộng dồn
// cùng lúc vào effective value. Export để UI (EquipmentHallPanel's
// Enhance preview) tính trước giá trị SAU khi cường hóa/rèn mà không
// phải lặp lại công thức.
export const ENHANCE_PERCENT_PER_LEVEL = 0.08

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
  const tier = affix.tiers.find(candidate => candidate.tier === rolled.tier)
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
 * equip/unequip/enhance/wash/refine/nâng phẩm/nâng cảnh giới,
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

      forgePoints: 0,

      forgePotential: this.rollForgePotential(),
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
    const weights = EQUIPMENT_QUALITY_REALM_WEIGHTS[Math.min(realmIndex, EQUIPMENT_QUALITY_REALM_WEIGHTS.length - 1)]!

    return weightedRandom(EQUIPMENT_QUALITY_ORDER
      .map((quality, index) => ({ value: quality, weight: weights[index] ?? 0 }))
      .filter(entry => entry.weight > 0))
  }

  private rollRarity(): EquipmentRarity {
    return weightedRandom(
      EQUIPMENT_RARITY_ORDER.map(rarity => ({
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
      ? template.mainStats.find(candidate => candidate.stat === retainedStat)
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

  private canRollRetainedMainStat(
    template: Equipment,
    instance: EquipmentInstance,
  ): boolean {
    const range = template.mainStats.find(candidate => candidate.stat === instance.mainStat.stat)

    return range !== undefined
      && Number.isFinite(range.min)
      && Number.isFinite(range.max)
      && range.min <= range.max
      && EQUIPMENT_QUALITY_IMPLICIT_MULTIPLIER[instance.quality] !== undefined
  }

  private getForwardEquipmentProgress(
    instance: EquipmentInstance,
    player: PlayerData,
  ): Pick<PlayerData, 'realmId' | 'realmLevel'> {
    const instanceLevel = instance.realmLevel ?? 1
    const playerGlobalLevel = getGlobalCultivationLevel(player.realmId, player.realmLevel)
    const instanceGlobalLevel = getGlobalCultivationLevel(instance.realmId, instanceLevel)

    return playerGlobalLevel >= instanceGlobalLevel
      ? { realmId: player.realmId, realmLevel: player.realmLevel }
      : { realmId: instance.realmId, realmLevel: instanceLevel }
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

    const prefixes = this.rollAffixesOfKind(template, 'prefix', slots.prefix, maxTier, unlockedPools, excludeStats, affixRegistry)

    const suffixes = this.rollAffixesOfKind(template, 'suffix', slots.suffix, maxTier, unlockedPools, excludeStats, affixRegistry)

    const result = [...prefixes, ...suffixes]

    if (rarity === 'tien' && rollChance(EQUIPMENT_RARITY_EXALTED_AFFIX_CHANCE)) {
      const exaltedKind: AffixKind = rollChance(0.5) ? 'prefix' : 'suffix'

      const exalted = this.rollEligibleAffix(template, exaltedKind, EQUIPMENT_QUALITY_MAX_AFFIX_TIER.thien_dia_trong_khi, ['supreme'], excludeStats, affixRegistry)

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
      const rolled = this.rollEligibleAffix(template, kind, maxTier, pools, excludeStats, affixRegistry)

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
   * (rollAffixesOfKind), roll Exalted Affix (rollAffixes), VÀ thao tác
   * "Thêm Dòng" đơn lẻ (Phase 4, addAffix()). Trả về null nếu không
   * còn candidate hợp lệ. `maxTier` dùng làm TRẦN roll được (Exalted
   * Affix roll truyền trần cao nhất toàn hệ thống để không tự giới
   * hạn oan tier 4-5 của chính pool supreme).
   */
  private rollEligibleAffix(
    template: Equipment,
    kind: AffixKind,
    maxTier: number,
    pools: AffixPool[],
    excludeStats: StatType[],
    affixRegistry: AffixRegistry,
  ): RolledAffix | null {
    const candidates = affixRegistry.getByKind(kind).filter(affix =>
      pools.includes(affix.pool) &&
      !excludeStats.includes(affix.stat) &&
      (!affix.slots || affix.slots.includes(template.slot)) &&
      isValidEquipmentSubstat(template.slot, affix.stat),
    )

    if (candidates.length === 0) {
      return null
    }

    const affix = candidates[randomInt(0, candidates.length - 1)]!

    return this.rollAffixValue(affix, maxTier)
  }

  private rollAffixValue(affix: Affix, maxTier: number): RolledAffix {
    const eligibleTiers = affix.tiers.filter(tierDef => tierDef.tier <= maxTier)

    const tierDef = eligibleTiers.length > 0
      ? eligibleTiers[randomInt(0, eligibleTiers.length - 1)]!
      : affix.tiers[0]!

    return { affixId: affix.id, tier: tierDef.tier, value: rollAffixRange(tierDef.min, tierDef.max) }
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
    // theo cảnh giới nằm ở instance.realmId (set lúc rớt đồ, nâng qua
    // upgradeRealm()), không phải điều kiện equip.
    const current = inventory.getEquippedInSlot(instance.slot)

    if (current) {
      this.unequip(current.instanceId, inventory)
    }

    instance.equipped = true

    // MASTER SPEC Mục XVI — món đồ mới trang bị vào slot phải được
    // "bù" đủ affix theo hạn mức Yểm Phù đã tích luỹ TRÊN SLOT ĐÓ
    // (không phải trên chính món đồ), trước khi build modifier.
    this.reconcileBonusAffixSlots(instance, slotManager.get(instance.slot), registry, affixRegistry)

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
   * Chi phí Cường Hóa THẬT (đã nhân theo enhanceLevel hiện tại) —
   * public để UI hiện đúng số sẽ bị trừ, thay vì đọc thẳng
   * template.enhanceCost (chỉ đúng ở cấp 0, CraftingPanel.vue từng
   * hiện sai con số này).
   */
  getEnhanceCost(
    instanceId: string,
    inventory: EquipmentBag,
    registry: EquipmentRegistry,
    slotManager: EquipmentSlotManager,
  ) {
    const instance = inventory.get(instanceId)

    if (!instance) {
      return []
    }

    const template = registry.get(instance.itemId)

    return this.getScaledCost(template.enhanceCost, slotManager.get(instance.slot).enhanceLevel)
  }

  /**
   * MASTER SPEC Mục XVI — Cường Hóa giờ cộng dồn vào SLOT (đổi trang
   * bị KHÔNG mất cấp đã cường hóa) chứ không phải instance. Vẫn cần
   * 1 item đang trang bị trong slot đó để tra template.enhanceCost/
   * maxEnhanceLevel (slot trống thì không có gì để tính chi phí) —
   * enhanceLevel của slot vẫn hiển thị được ngay cả khi trống, chỉ
   * riêng hành động Cường Hóa mới cần có đồ.
   */
  enhance(
    instanceId: string,
    player: PlayerData,
    inventory: EquipmentBag,
    registry: EquipmentRegistry,
    materialBag: MaterialBag,
    slotManager: EquipmentSlotManager,
    affixRegistry: AffixRegistry,
  ): boolean {
    const instance = inventory.get(instanceId)

    if (!instance) {
      return false
    }

    const template = registry.get(instance.itemId)

    const slotState = slotManager.get(instance.slot)

    if (slotState.enhanceLevel >= template.maxEnhanceLevel) {
      return false
    }

    const cost = this.getScaledCost(template.enhanceCost, slotState.enhanceLevel)

    const spiritStoneCost = template.enhanceSpiritStoneCost ?? 0

    if (player.spiritStone < spiritStoneCost) {
      return false
    }

    for (const entry of cost) {
      if (!materialBag.has(entry.materialId, entry.amount)) {
        return false
      }
    }

    player.spiritStone -= spiritStoneCost

    for (const entry of cost) {
      materialBag.remove(entry.materialId, entry.amount)
    }

    slotState.enhanceLevel++

    if (instance.equipped) {
      this.modifierSystem.removeBySource(instance.instanceId)

      this.applyModifiers(instance, slotManager, affixRegistry)
    }

    return true
  }

  /**
   * Tẩy luyện — reroll lại GIÁ TRỊ từng affix hiện có (không đổi affix
   * nào, không đổi tier), lấy range từ đúng tier hiện tại của affix
   * đó. Không làm gì nếu instance chưa có affix nào.
   */
  wash(
    instanceId: string,
    inventory: EquipmentBag,
    registry: EquipmentRegistry,
    materialBag: MaterialBag,
    slotManager: EquipmentSlotManager,
    affixRegistry: AffixRegistry,
  ): boolean {
    const instance = inventory.get(instanceId)

    if (!instance || instance.affixes.length === 0) {
      return false
    }

    const template = registry.get(instance.itemId)

    const cost = template.washCost ?? []

    for (const entry of cost) {
      if (!materialBag.has(entry.materialId, entry.amount)) {
        return false
      }
    }

    for (const entry of cost) {
      materialBag.remove(entry.materialId, entry.amount)
    }

    for (const rolled of instance.affixes) {
      const affix = affixRegistry.get(rolled.affixId)

      const tierDef = affix.tiers.find(candidate => candidate.tier === rolled.tier)

      if (tierDef) {
        rolled.value = rollAffixRange(tierDef.min, tierDef.max)
      }
    }

    if (instance.equipped) {
      this.modifierSystem.removeBySource(instance.instanceId)

      this.applyModifiers(instance, slotManager, affixRegistry)
    }

    return true
  }

  /**
   * Tinh luyện (Equipment Rework — đổi mục tiêu so với bản cũ) — reroll
   * lại GIÁ TRỊ Implicit (mainStat), KHÔNG còn tăng level/scale (việc
   * đó chuyển sang forge()). Cùng "họ" với wash() (reroll không giới
   * hạn số lần, chỉ tốn nguyên liệu mỗi lần) nhưng nhắm vào Implicit
   * thay vì Affix — 2 thao tác không còn trùng chức năng. Roll lại
   * bằng CHÍNH rollMainStat() nên tự động phản ánh cảnh giới/quality
   * hiện tại của item — instance.realmId cũng cập nhật theo player
   * (không bao giờ lùi, cùng guard hướng với upgradeRealm()).
   */
  refine(
    instanceId: string,
    player: PlayerData,
    inventory: EquipmentBag,
    registry: EquipmentRegistry,
    materialBag: MaterialBag,
    slotManager: EquipmentSlotManager,
    affixRegistry: AffixRegistry,
  ): boolean {
    const instance = inventory.get(instanceId)

    if (!instance) {
      return false
    }

    if (!registry.has(instance.itemId)) {
      return false
    }

    const template = registry.get(instance.itemId)

    if (!this.canRollRetainedMainStat(template, instance)) {
      return false
    }

    const cost = template.refineCost ?? []

    for (const entry of cost) {
      if (!materialBag.has(entry.materialId, entry.amount)) {
        return false
      }
    }

    const progress = this.getForwardEquipmentProgress(instance, player)
    const rerolled = this.rollMainStat(template, { ...player, ...progress }, instance.quality, instance.mainStat.stat)

    for (const entry of cost) {
      materialBag.remove(entry.materialId, entry.amount)
    }

    instance.mainStat.flat = rerolled.flat
    instance.realmId = progress.realmId
    instance.realmLevel = progress.realmLevel

    if (instance.equipped) {
      this.modifierSystem.removeBySource(instance.instanceId)

      this.applyModifiers(instance, slotManager, affixRegistry)
    }

    return true
  }

  /**
   * Rèn (Equipment Rework, mục 7) — hệ thống đầu tư sức mạnh CHÍNH của
   * item, thay vai trò cũ của refineLevel. Deterministic (không roll,
   * không thất bại, không reset — nhất quán với mọi thao tác khác
   * trong hệ thống này) — mỗi lần thành công +1 forgePoints, trần theo
   * Quality (EQUIPMENT_QUALITY_MAX_FORGE_POINTS). Chi phí scale mỗi 10
   * điểm (+50%/mốc) — trần cao hơn enhanceLevel rất nhiều (tới 200)
   * nên không thể dùng công thức scale-mỗi-điểm như enhance được.
   */
  forge(
    instanceId: string,
    inventory: EquipmentBag,
    registry: EquipmentRegistry,
    materialBag: MaterialBag,
    slotManager: EquipmentSlotManager,
    affixRegistry: AffixRegistry,
  ): boolean {
    const instance = inventory.get(instanceId)

    if (!instance) {
      return false
    }

    if (instance.forgePoints >= getMaxForgePoints(instance.quality, instance.forgePotential)) {
      return false
    }

    const template = registry.get(instance.itemId)

    const cost = this.getForgeCost(template, instance.forgePoints)

    for (const entry of cost) {
      if (!materialBag.has(entry.materialId, entry.amount)) {
        return false
      }
    }

    for (const entry of cost) {
      materialBag.remove(entry.materialId, entry.amount)
    }

    instance.forgePoints++

    if (instance.equipped) {
      this.modifierSystem.removeBySource(instance.instanceId)

      this.applyModifiers(instance, slotManager, affixRegistry)
    }

    return true
  }

  /**
   * Chi phí Rèn THẬT (đã nhân theo mốc 10 điểm hiện tại) — public để
   * UI hiện đúng số sẽ bị trừ, cùng pattern getEnhanceCost().
   */
  getForgeCost(template: Equipment, currentForgePoints: number) {
    const cost = template.forgeCost ?? []

    const multiplier = 1 + Math.floor(currentForgePoints / 10) * 0.5

    return cost.map(entry => ({
      materialId: entry.materialId,

      amount: Math.ceil(entry.amount * multiplier),
    }))
  }

  /**
   * Nâng phẩm — quality nhảy lên 1 bậc trong EQUIPMENT_QUALITY_ORDER.
   * Core Loop Foundation checklist — quality giờ CHỈ còn vai trò gate
   * tier affix TƯƠNG LAI (EQUIPMENT_QUALITY_MAX_AFFIX_TIER), không
   * tự roll/thêm affix nào ngay lập tức nên không cần refresh modifier.
   */
  upgradeQuality(
    instanceId: string,
    inventory: EquipmentBag,
    registry: EquipmentRegistry,
    materialBag: MaterialBag,
  ): boolean {
    const instance = inventory.get(instanceId)

    if (!instance) {
      return false
    }

    const currentIndex = EQUIPMENT_QUALITY_ORDER.indexOf(instance.quality)

    if (currentIndex >= EQUIPMENT_QUALITY_ORDER.length - 1) {
      return false
    }

    const template = registry.get(instance.itemId)

    const cost = template.upgradeQualityCost ?? []

    for (const entry of cost) {
      if (!materialBag.has(entry.materialId, entry.amount)) {
        return false
      }
    }

    for (const entry of cost) {
      materialBag.remove(entry.materialId, entry.amount)
    }

    instance.quality = EQUIPMENT_QUALITY_ORDER[currentIndex + 1]!

    return true
  }

  /**
   * Nâng cảnh giới — chỉ cho phép khi player đã tu tới cảnh giới
   * cao hơn cảnh giới hiện tại của trang bị. Roll lại mainStat theo
   * cảnh giới mới (thường mạnh hơn hẳn — xem MAIN_STAT_REALM_SCALE).
   */
  upgradeRealm(
    instanceId: string,
    player: PlayerData,
    inventory: EquipmentBag,
    registry: EquipmentRegistry,
    materialBag: MaterialBag,
    slotManager: EquipmentSlotManager,
    affixRegistry: AffixRegistry,
  ): boolean {
    const instance = inventory.get(instanceId)

    if (!instance) {
      return false
    }

    if (getRealmIndex(player.realmId) <= getRealmIndex(instance.realmId)) {
      return false
    }

    if (!registry.has(instance.itemId)) {
      return false
    }

    const template = registry.get(instance.itemId)

    if (!this.canRollRetainedMainStat(template, instance)) {
      return false
    }

    const cost = template.upgradeRealmCost ?? []

    const spiritStoneCost = template.upgradeRealmSpiritStoneCost ?? 0

    if (player.spiritStone < spiritStoneCost) {
      return false
    }

    for (const entry of cost) {
      if (!materialBag.has(entry.materialId, entry.amount)) {
        return false
      }
    }

    const rerolled = this.rollMainStat(template, player, instance.quality, instance.mainStat.stat)

    player.spiritStone -= spiritStoneCost

    for (const entry of cost) {
      materialBag.remove(entry.materialId, entry.amount)
    }

    instance.realmId = player.realmId
    instance.realmLevel = player.realmLevel
    instance.mainStat = rerolled

    if (instance.equipped) {
      this.modifierSystem.removeBySource(instance.instanceId)

      this.applyModifiers(instance, slotManager, affixRegistry)
    }

    return true
  }

  /**
   * Thêm 1 dòng Affix mới (Phase 4, "Thêm Dòng") — chỉ khả thi nếu
   * chưa đạt hạn mức rarity+bonus của slot. Ưu tiên lấp phe đang
   * thiếu (prefix trước nếu còn room theo rarityCap, else suffix).
   */
  addAffix(
    instanceId: string,
    inventory: EquipmentBag,
    registry: EquipmentRegistry,
    materialBag: MaterialBag,
    slotManager: EquipmentSlotManager,
    affixRegistry: AffixRegistry,
  ): boolean {
    const instance = inventory.get(instanceId)

    if (!instance) {
      return false
    }

    const template = registry.get(instance.itemId)

    const rarityCap = EQUIPMENT_RARITY_AFFIX_SLOTS[instance.rarity]

    const slotState = slotManager.get(instance.slot)

    const target = Math.min(GLOBAL_MAX_AFFIXES, rarityCap.prefix + rarityCap.suffix + slotState.bonusAffixSlots)

    if (instance.affixes.length >= target) {
      return false
    }

    const cost = template.addAffixCost ?? []

    for (const entry of cost) {
      if (!materialBag.has(entry.materialId, entry.amount)) {
        return false
      }
    }

    const prefixCount = instance.affixes.filter(rolled => affixRegistry.get(rolled.affixId).kind === 'prefix').length

    const suffixCount = instance.affixes.length - prefixCount

    const kind: AffixKind = prefixCount < rarityCap.prefix ? 'prefix' : suffixCount < rarityCap.suffix ? 'suffix' : 'prefix'

    const maxTier = EQUIPMENT_QUALITY_MAX_AFFIX_TIER[instance.quality]

    const unlockedPools = EQUIPMENT_QUALITY_UNLOCKED_POOLS[instance.quality]

    const excludeStats = [instance.mainStat.stat, ...instance.affixes.map(rolled => affixRegistry.get(rolled.affixId).stat)]

    const rolled = this.rollEligibleAffix(template, kind, maxTier, unlockedPools, excludeStats, affixRegistry)
      ?? this.rollEligibleAffix(template, kind === 'prefix' ? 'suffix' : 'prefix', maxTier, unlockedPools, excludeStats, affixRegistry)

    if (!rolled) {
      return false
    }

    for (const entry of cost) {
      materialBag.remove(entry.materialId, entry.amount)
    }

    instance.affixes.push(rolled)

    if (instance.equipped) {
      this.modifierSystem.removeBySource(instance.instanceId)

      this.applyModifiers(instance, slotManager, affixRegistry)
    }

    return true
  }

  /**
   * Nâng Tier 1 affix CỤ THỂ (Phase 4, "Nâng Cấp Dòng") — chặn nếu đã
   * ở tier cao nhất của chính affix đó HOẶC đã vượt gate tier của
   * quality hiện tại.
   */
  upgradeAffixTier(
    instanceId: string,
    affixIndex: number,
    inventory: EquipmentBag,
    registry: EquipmentRegistry,
    materialBag: MaterialBag,
    slotManager: EquipmentSlotManager,
    affixRegistry: AffixRegistry,
  ): boolean {
    const instance = inventory.get(instanceId)

    if (!instance) {
      return false
    }

    const rolled = instance.affixes[affixIndex]

    if (!rolled) {
      return false
    }

    const affix = affixRegistry.get(rolled.affixId)

    const maxTier = Math.min(affix.tiers[affix.tiers.length - 1]!.tier, EQUIPMENT_QUALITY_MAX_AFFIX_TIER[instance.quality])

    if (rolled.tier >= maxTier) {
      return false
    }

    const template = registry.get(instance.itemId)

    const cost = template.upgradeAffixCost ?? []

    for (const entry of cost) {
      if (!materialBag.has(entry.materialId, entry.amount)) {
        return false
      }
    }

    const nextTierDef = affix.tiers.find(tierDef => tierDef.tier === rolled.tier + 1)

    if (!nextTierDef) {
      return false
    }

    for (const entry of cost) {
      materialBag.remove(entry.materialId, entry.amount)
    }

    rolled.tier = nextTierDef.tier

    rolled.value = rollAffixRange(nextTierDef.min, nextTierDef.max)

    if (instance.equipped) {
      this.modifierSystem.removeBySource(instance.instanceId)

      this.applyModifiers(instance, slotManager, affixRegistry)
    }

    return true
  }

  /**
   * Talisman áp dụng lên SLOT (MASTER SPEC Mục XVI, Phase 9 — không
   * còn áp lên 1 instance cụ thể) — mở thêm hạn mức slot Affix của cả
   * slot (không vượt GLOBAL_MAX_AFFIXES), rồi nếu slot đang có item
   * trang bị thì lấp ngay affix mới lên item đó. Item khác trang bị
   * vào slot này SAU sẽ tự được lấp bù qua reconcileBonusAffixSlots()
   * (gọi trong equip()) khi tới lượt.
   */
  addBonusAffixSlots(
    slot: EquipmentSlot,
    extraSlots: number,
    slotManager: EquipmentSlotManager,
    inventory: EquipmentBag,
    registry: EquipmentRegistry,
    affixRegistry: AffixRegistry,
  ): boolean {
    const slotState = slotManager.get(slot)

    const room = Math.max(0, GLOBAL_MAX_AFFIXES - slotState.bonusAffixSlots)

    const grantedSlots = Math.min(extraSlots, room)

    if (grantedSlots <= 0) {
      return false
    }

    slotState.bonusAffixSlots += grantedSlots

    const equippedInstance = inventory.getEquippedInSlot(slot)

    if (!equippedInstance) {
      return true
    }

    this.reconcileBonusAffixSlots(equippedInstance, slotState, registry, affixRegistry)

    this.modifierSystem.removeBySource(equippedInstance.instanceId)

    this.applyModifiers(equippedInstance, slotManager, affixRegistry)

    return true
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
  refreshModifiers(inventory: EquipmentBag, slotManager: EquipmentSlotManager, affixRegistry: AffixRegistry) {
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
  private applyModifiers(instance: EquipmentInstance, slotManager: EquipmentSlotManager, affixRegistry: AffixRegistry) {
    const enhanceLevel = slotManager.get(instance.slot).enhanceLevel

    const scale = calculateEquipmentScale(enhanceLevel, instance.forgePoints)

    this.applyScaledModifier(instance.instanceId, instance.mainStat.stat, instance.mainStat.flat ?? 0, scale)

    for (const rolled of instance.affixes) {
      const affix = affixRegistry.get(rolled.affixId)
      const value = getEffectiveAffixValue(rolled, affix)

      this.applyScaledModifier(instance.instanceId, affix.stat, value, scale)
    }
  }

  /**
   * Lấp affix còn thiếu trên 1 instance theo hạn mức của SLOT nó
   * đang chiếm (base rarity cap + bonus Yểm Phù đã tích luỹ trên
   * slot) — hàm THUẦN/idempotent: gọi lại nhiều lần (equip/unequip
   * lặp lại cùng 1 item) không roll thêm quá hạn mức, vì mốc tính
   * dựa vào EQUIPMENT_RARITY_AFFIX_SLOTS[rarity] (cố định theo
   * rarity) thay vì instance.affixes.length hiện tại (tránh cộng dồn
   * sai nếu gọi lặp). Bonus slot KHÔNG phân biệt prefix/suffix (linh
   * hoạt lấp affix hợp lệ bất kỳ kind nào).
   */
  private reconcileBonusAffixSlots(
    instance: EquipmentInstance,
    slotState: EquipmentSlotState,
    registry: EquipmentRegistry,
    affixRegistry: AffixRegistry,
  ) {
    const template = registry.get(instance.itemId)

    const rarityCap = EQUIPMENT_RARITY_AFFIX_SLOTS[instance.rarity]

    const target = Math.min(GLOBAL_MAX_AFFIXES, rarityCap.prefix + rarityCap.suffix + slotState.bonusAffixSlots)

    const missing = target - instance.affixes.length

    if (missing <= 0) {
      return
    }

    const maxTier = EQUIPMENT_QUALITY_MAX_AFFIX_TIER[instance.quality]

    const unlockedPools = EQUIPMENT_QUALITY_UNLOCKED_POOLS[instance.quality]

    const excludeStats = [instance.mainStat.stat, ...instance.affixes.map(rolled => affixRegistry.get(rolled.affixId).stat)]

    for (let i = 0; i < missing; i++) {
      const rolled = this.rollEligibleAffix(template, 'prefix', maxTier, unlockedPools, excludeStats, affixRegistry)
        ?? this.rollEligibleAffix(template, 'suffix', maxTier, unlockedPools, excludeStats, affixRegistry)

      if (!rolled) {
        break
      }

      instance.affixes.push(rolled)

      excludeStats.push(affixRegistry.get(rolled.affixId).stat)
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

    return cost.map(entry => ({
      materialId: entry.materialId,

      amount: entry.amount * multiplier,
    }))
  }
}
