import type { Equipment, RecipeMaterialCost } from './Equipment'
import type { EquipmentInstance } from './EquipmentInstance'
import { EquipmentBag } from './EquipmentBag'
import { EquipmentRegistry } from './EquipmentRegistry'
import { ITEM_QUALITY_ORDER, type ItemQuality } from '../item/ItemQuality'
import {
  ITEM_QUALITY_IMPLICIT_MULTIPLIER,
} from './ItemQualityBalance'
import type { EquipmentSlot } from './EquipmentTypes'
import { EquipmentSlotManager } from './EquipmentSlotManager'
import { AffixRegistry } from './AffixRegistry'
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
  realmFromGrade,
} from '../profession/ProfessionGrade'
import type {
  EquipmentOperation,
  EquipmentOperationCost,
  EquipmentOperationCostCatalog,
  EquipmentOperationCostContext,
} from './EquipmentOperationCostCatalog'
import {
  REFINE_SPIRIT_STONE_PER_UNIT,
  REFINE_TINH_HOA_COST_BY_QUALITY,
  WASH_SPIRIT_STONE_COST,
  WASH_TINH_HOA_COST_BY_QUALITY,
} from './RefinementBalance'
import { canUseItemGrade } from './canUseItem'
import { dissolveInstances as dissolveInstancesImpl, quoteDissolveRewards } from './EquipmentDissolve'
import {
  GLOBAL_MAX_AFFIXES,
  getEffectiveAffixValue,
  normalizeRolledAffixValue,
  rollAffixRange,
} from './EquipmentRollPrimitives'
import {
  commitWashAffixes as commitWashAffixesImpl,
  createWashPendingSlotAccessor,
  discardWashTicket as discardWashTicketImpl,
  invalidatePendingWashTicket as invalidatePendingWashTicketImpl,
  getWashPreviewAffixes as getWashPreviewAffixesImpl,
  previewWashAffixes as previewWashAffixesImpl,
  washAffixes as washAffixesImpl,
  type WashDeps,
} from './EquipmentWash'
import {
  commitRefineValues as commitRefineValuesImpl,
  createRefinePendingSlotAccessor,
  discardRefinePreview as discardRefinePreviewImpl,
  invalidatePendingRefinePreview as invalidatePendingRefinePreviewImpl,
  previewRefineValues as previewRefineValuesImpl,
  refineAffixValues as refineAffixValuesImpl,
  type RefineDeps,
  type RefineValueEntry,
} from './EquipmentRefine'
import { createEquipmentInstance, MAIN_STAT_REALM_SCALE } from './EquipmentRolling'

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

// large-file-split — applyQualityBonusSteps sống ở ItemQualityBalance.ts
// (pure function trên ITEM_QUALITY_ORDER), MAIN_STAT_REALM_SCALE ở
// EquipmentRolling.ts (dùng bởi roll pipeline), RefineValueEntry +
// refine impls ở EquipmentRefine.ts. Re-export để import site cũ
// (`from './EquipmentSystem'`) không phải đổi.
export { applyQualityBonusSteps } from './ItemQualityBalance'
export { MAIN_STAT_REALM_SCALE } from './EquipmentRolling'
export type { RefineValueEntry } from './EquipmentRefine'

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
  // (large-file-split: state vẫn thuộc system instance, qua accessor như
  // washPendingSlot — impl sống ở EquipmentRefine.ts.)
  private readonly refinePendingSlot = createRefinePendingSlotAccessor()

  // R9 (AR-21) - instance-owned pending wash slot: the paid wash result
  // dies with this system instance (restore into a fresh manager starts
  // clean; no cross-session ticket replay).
  private readonly washPendingSlot = createWashPendingSlotAccessor()

  /**
   * M1 (ARCH-001) — pending-operations invalidation hook. A session
   * restore replaces the item set wholesale: the pending wash ticket and
   * refine preview were issued against pre-restore item objects and must
   * not commit onto the restored set (a stale wash ticket would overwrite
   * freshly-restored affixes — see QA-R9-001's cross-session ticket
   * finding). GameManagerSaveRestore calls this on every applied payload;
   * M2 (ARCH-011) additionally binds each issued ticket to its item's
   * exact-object/membership/snapshot lifetime inside EquipmentWash.ts.
   */
  invalidatePendingOperationTickets(): void {
    // Writes stay inside the domain owner modules (R14 paid-random
    // contract): EquipmentSystem issues the invalidation command, the
    // pending slots themselves are only mutated by
    // EquipmentRefine.ts/EquipmentWash.ts.
    invalidatePendingRefinePreviewImpl(this.refineDeps())
    invalidatePendingWashTicketImpl(this.washPendingSlot)
  }

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

  /**
   * M3 (talent v4 §4.2) — Bach Luyen Thanh Khi policy: enhance never
   * fails; each attempt pays costMultiplier on materials + spirit stone.
   * Synced per-call by EquipmentOpsSystem (same pattern as costDiscount).
   */
  private enhanceAlwaysSucceed = false
  private enhanceCostMultiplier = 1

  setEnhancePolicy(policy: { alwaysSucceed: boolean; costMultiplier: number }) {
    this.enhanceAlwaysSucceed = policy.alwaysSucceed
    this.enhanceCostMultiplier = Math.max(1, policy.costMultiplier)
  }

  /** Cost Cường Hóa sau policy talent — applied on the resolved cost. */
  private applyEnhanceCostPolicy(cost: { materials: RecipeMaterialCost[]; spiritStone: number }) {
    if (this.enhanceCostMultiplier <= 1) {
      return cost
    }

    return {
      materials: cost.materials.map((entry) => ({
        materialId: entry.materialId,
        amount: Math.ceil(entry.amount * this.enhanceCostMultiplier),
      })),
      spiritStone: Math.ceil(cost.spiritStone * this.enhanceCostMultiplier),
    }
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
    qualityBonusSteps = 0,
  ): EquipmentInstance {
    return createEquipmentInstance(template, player, affixRegistry, zoneId, qualityBonusSteps)
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

    // OPT-04 — flip qua bag API để giữ slotIndex nhất quán.
    inventory.setEquippedInternal(instance.instanceId, true)

    this.applyModifiers(instance, slotManager, affixRegistry)

    return { ok: true }
  }

  unequip(instanceId: string, inventory: EquipmentBag): boolean {
    const instance = inventory.get(instanceId)

    if (!instance) {
      return false
    }

    // OPT-04 — flip qua bag API để giữ slotIndex nhất quán.
    inventory.setEquippedInternal(instance.instanceId, false)

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
    // M3 — Bach Luyen Thanh Khi: xN the resolved cost so preview
    // (getEnhanceCost/getEnhanceSpiritStoneCost) and enhance() spend the
    // same authoritative amount.
    return this.applyEnhanceCostPolicy(this.resolveEnhanceCostBase(realmId, enhanceLevel, template))
  }

  private resolveEnhanceCostBase(
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
    // M3 — Bach Luyen Thanh Khi: enhance never fails while the policy is on.
    const success = pityGuaranteed || this.enhanceAlwaysSucceed || random() * 100 < successRate

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
   * instance. R9 (AR-21): trả về một-use TICKET — affixes hiển thị đọc
   * qua getWashPreviewAffixes(ticketId); người chơi bấm lại (ticket cũ
   * bị thay, trả cost lần nữa, roll mới) hoặc "Giữ"
   * (commitWashAffixes, không tốn thêm) để chốt.
   */
  previewWashAffixes(
    instanceId: string,
    inventory: EquipmentBag,
    registry: EquipmentRegistry,
    materialBag: MaterialBag,
    affixRegistry: AffixRegistry,
    random: () => number = Math.random,
  ): { ok: boolean; reason?: string; ticketId?: string } {
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

  /** R9 (AR-21) — display copy of the pending roll (never authoritative). */
  getWashPreviewAffixes(ticketId: string): { affixes: RolledAffix[] } | undefined {
    return getWashPreviewAffixesImpl(this.washPendingSlot, ticketId)
  }

  /** R9 (AR-21) — drop the pending wash ticket (UI cancel/re-roll). */
  discardWashTicket(ticketId: string): void {
    discardWashTicketImpl(this.washPendingSlot, ticketId)
  }

  /**
   * R9 (AR-23 4c) — authoritative main-stat range quote. The tooltip used
   * to reproduce the quality/realm scaling here; now it renders this
   * read model instead. Mirrors the createInstance roll pipeline:
   * range x qualityMultiplier x (1 + globalLevel x MAIN_STAT_REALM_SCALE).
   */
  quoteMainStatRange(
    instance: EquipmentInstance,
    registry: EquipmentRegistry,
  ): { min: number; max: number } | undefined {
    const template = this.tryGetTemplate(registry, instance.itemId)

    const range = template?.mainStats.find((candidate) => candidate.stat === instance.mainStat.stat)

    if (!range) {
      return undefined
    }

    const qualityMultiplier = ITEM_QUALITY_IMPLICIT_MULTIPLIER[instance.quality]

    const globalLevel = getGlobalCultivationLevel(
      realmFromGrade(instance.grade),
      instance.realmLevel ?? 1,
    )

    const realmScale = 1 + globalLevel * MAIN_STAT_REALM_SCALE

    return {
      min: range.min * qualityMultiplier * realmScale,
      max: range.max * qualityMultiplier * realmScale,
    }
  }

  /**
   * Chốt kết quả đã preview (previewWashAffixes) — không kiểm tra/trừ cost
   * lần nữa. R9 (AR-21): commit nhận TICKET ID, affixes áp vào instance
   * là bản domain-owned; mọi attempt tiêu ticket (refine precedent).
   */
  commitWashAffixes(
    instanceId: string,
    ticketId: string,
    inventory: EquipmentBag,
    slotManager: EquipmentSlotManager,
    affixRegistry: AffixRegistry,
  ): { ok: boolean; reason?: string } {
    return commitWashAffixesImpl(
      instanceId,
      ticketId,
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

      // R9 (AR-21) - INSTANCE-owned pending slot (QA-R9-001: a module
      // singleton survived restore and accepted cross-session commits).
      washPendingSlot: this.washPendingSlot,
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
    return refineAffixValuesImpl(
      instanceId,
      lockedIndices,
      inventory,
      registry,
      materialBag,
      slotManager,
      affixRegistry,
      this.refineDeps(),
      _random,
    )
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
    return previewRefineValuesImpl(
      instanceId,
      lockedIndices,
      inventory,
      registry,
      materialBag,
      affixRegistry,
      this.refineDeps(),
      random,
    )
  }

  /** Hủy capability Refine đang chờ; UI gọi khi người chơi bấm Bỏ/đổi context. */
  discardRefinePreview(instanceId?: string): void {
    discardRefinePreviewImpl(this.refineDeps(), instanceId)
  }

  /** Chốt đúng một lần payload do previewRefineValues/refineAffixValues vừa tạo. */
  commitRefineValues(
    instanceId: string,
    values: readonly RefineValueEntry[],
    inventory: EquipmentBag,
    slotManager: EquipmentSlotManager,
    affixRegistry: AffixRegistry,
  ): { ok: boolean; reason?: string } {
    return commitRefineValuesImpl(
      instanceId,
      values,
      inventory,
      slotManager,
      affixRegistry,
      this.refineDeps(),
    )
  }

  /** Deps injection cho EquipmentRefine.ts — cùng pattern washDeps(). */
  private refineDeps(): RefineDeps {
    return {
      applyCostDiscount: (amount) => this.applyCostDiscount(amount),

      itemRefinementPoints: (instance) => this.itemRefinementPoints(instance),

      spendItemRefinementPoints: (instance, amount) =>
        this.spendItemRefinementPoints(instance, amount),

      refreshEquippedModifiers: (instance, slotManager, affixRegistry) => {
        if (instance.equipped) {
          this.modifierSystem.removeBySource(instance.instanceId)

          this.applyModifiers(instance, slotManager, affixRegistry)
        }
      },

      refinePendingSlot: this.refinePendingSlot,
    }
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

  /**
   * R9 (AR-23 4d) - authoritative dissolve quote (same validation +
   * dedupe as the commit path); presentation renders it instead of
   * reconstructing eligibility.
   */
  quoteDissolveInstances(
    instanceIds: readonly string[],
    inventory: EquipmentBag,
  ): { ok: boolean; reason?: string; totals?: Array<{ materialId: string; minAmount: number; maxAmount: number }> } {
    return quoteDissolveRewards(instanceIds, inventory)
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
