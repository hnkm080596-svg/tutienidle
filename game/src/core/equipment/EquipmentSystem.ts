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
  REFINE_SPIRIT_STONE_PER_UNIT_BY_QUALITY,
  REFINE_TINH_HOA_COST_BY_QUALITY,
  WASH_SPIRIT_STONE_COST_BY_QUALITY,
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
import { isScopeHidden } from '../betaScope'

// Task 8 (phase7-gamemanager-split) - rollAffixRange/normalizeRolledAffixValue/
// getEffectiveAffixValue/GLOBAL_MAX_AFFIXES song o EquipmentRollPrimitives.ts
// (dung chung voi EquipmentWash.ts); re-export lai o day de moi import site
// cu (`from './EquipmentSystem'`) khong phai doi.
export { GLOBAL_MAX_AFFIXES, getEffectiveAffixValue, normalizeRolledAffixValue, rollAffixRange }

// He so nhan them moi bac cuong hoa. Export de UI (EquipmentHallPanel's
// Enhance preview) tinh truoc gia tri SAU khi cuong hoa ma khong phai
// lap lai cong thuc.
//
// Task 10 (rework P3, 2026-09-01) - ENHANCE_PERCENT_PER_LEVEL (0.08) va
// FORGE_PERCENT_PER_POINT DA XOA: scale gio slot-only `1 + level x
// ENHANCE_SLOT_SCALE (0.06)` - forgeUses la ngan sach tay/tinh cua
// item, KHONG scale. Curve mu 0.956 + pity 10 o EnhanceCurve.ts.
import {
  ENHANCE_PITY_THRESHOLD,
  ENHANCE_SLOT_SCALE,
  MAX_SLOT_ENHANCE_LEVEL,
  enhanceSuccessRate,
} from './EnhanceCurve'

/**
 * He so nhan hieu luc cua 1 instance theo SLOT enhanceLevel - dung lai
 * y het trong applyModifiers() lan UI preview (Enhance tab), dam bao 2
 * noi luon khop cong thuc.
 */
export function calculateEquipmentScale(enhanceLevel: number): number {
  return 1 + enhanceLevel * ENHANCE_SLOT_SCALE
}

// large-file-split - applyQualityBonusSteps song o ItemQualityBalance.ts
// (pure function tren ITEM_QUALITY_ORDER), MAIN_STAT_REALM_SCALE o
// EquipmentRolling.ts (dung boi roll pipeline), RefineValueEntry +
// refine impls o EquipmentRefine.ts. Re-export de import site cu
// (`from './EquipmentSystem'`) khong phai doi.
export { applyQualityBonusSteps } from './ItemQualityBalance'
export { MAIN_STAT_REALM_SCALE } from './EquipmentRolling'
export type { RefineValueEntry } from './EquipmentRefine'

/**
 * Modifier cua equipment la "tinh" (xem ghi chu trong Player.ts:
 * modifiers vs externalModifiers) - chi doi khi nguoi choi
 * equip/unequip/enhance/wash/refine/hoa luyen,
 * KHONG tong hop lai moi tick nhu Buff/Technique. EquipmentSystem
 * tu giu mot ModifierSystem rieng, add/remove theo sourceId =
 * instanceId de go dung modifier khi unequip. Caller (GameManager
 * -> player store) doc lai qua getModifiers() va tu gan vao
 * player.modifiers sau moi hanh dong.
 *
 * Chi so phu la Affix (Prefix/Suffix co Tier, xem Affix.ts). Grade co
 * dinh theo realm; quality Ngu Chat quyet dinh so luong/tier/pool affix
 * va he so implicit cua item.
 */
export class EquipmentSystem {
  private readonly modifierSystem = new ModifierSystem()

  // Khi Duong chi hien thi mot Refine preview tai mot thoi diem. Mot capability
  // duy nhat vua chan provenance tich luy vo han, vua bao dam attempt moi (ke ca
  // that bai) vo hieu hoa payload tra phi truoc do o bat ky item nao.
  // (large-file-split: state van thuoc system instance, qua accessor nhu
  // washPendingSlot - impl song o EquipmentRefine.ts.)
  private readonly refinePendingSlot = createRefinePendingSlotAccessor()

  // R9 (AR-21) - instance-owned pending wash slot: the paid wash result
  // dies with this system instance (restore into a fresh manager starts
  // clean; no cross-session ticket replay).
  private readonly washPendingSlot = createWashPendingSlotAccessor()

  /**
   * M1 (ARCH-001) - pending-operations invalidation hook. A session
   * restore replaces the item set wholesale: the pending wash ticket and
   * refine preview were issued against pre-restore item objects and must
   * not commit onto the restored set (a stale wash ticket would overwrite
   * freshly-restored affixes - see QA-R9-001's cross-session ticket
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
   * Cost catalog nghe (2026-08-24, resource-professions-rework sec6) -
   * optional: resolve duoc -> uu tien hon template cost; khong resolve
   * (operation/realm chua author) -> fallback template cost legacy de
   * data cu/test cu khong vo.
   */
  private costCatalog?: EquipmentOperationCostCatalog

  setCostCatalog(catalog: EquipmentOperationCostCatalog | undefined) {
    this.costCatalog = catalog
  }

  /**
   * W5 (2026-08-27) - discount chi phi Khi Duong theo level building
   * (equipment_hall). GameManager dong bo truoc moi lan query/spend;
   * EquipmentSystem khong tu biet building de giu core doc lap.
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
   * M3 (talent v4 sec4.2) - Bach Luyen Thanh Khi policy: enhance never
   * fails; each attempt pays costMultiplier on materials + spirit stone.
   * Synced per-call by EquipmentOpsSystem (same pattern as costDiscount).
   */
  private enhanceAlwaysSucceed = false
  private enhanceCostMultiplier = 1

  setEnhancePolicy(policy: { alwaysSucceed: boolean; costMultiplier: number }) {
    this.enhanceAlwaysSucceed = policy.alwaysSucceed
    this.enhanceCostMultiplier = Math.max(1, policy.costMultiplier)
  }

  /** Cost Cuong Hoa sau policy talent - applied on the resolved cost. */
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
   * Roll 1 instance moi tu template. Grade theo realm cua nguoi choi;
   * quality roll doc lap theo trong so co dinh va quyet dinh implicit,
   * so luong/tier/pool substat cung ngan sach Ren.
   */
  createInstance(
    template: Equipment,
    player: PlayerData,
    affixRegistry: AffixRegistry,
    zoneId?: string,
    qualityBonusSteps = 0,
    rng?: () => number,
    maxQuality?: ItemQuality,
  ): EquipmentInstance {
    return createEquipmentInstance(template, player, affixRegistry, zoneId, qualityBonusSteps, rng, maxQuality)
  }

  /**
   * (rework P5, Task 16) - Equipment KHONG co requiredRealmId tren
   * template (khac Recipe/Building/Skill): gate khong dua vao template ma
   * vao instance.grade (pham nghe set luc rot do) so voi pham nghe hien
   * tai cua nguoi choi (canUseItemGrade) - lech bac nao (cao hoac thap)
   * cung bi chan, khong phai "du hoac cao hon". Item DANG MAC luon
   * idempotent ok:true bat ke lech pham (tranh tu unequip do cu khi
   * canh gioi nguoi choi doi qua save/breakthrough).
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

    // OPT-04 - flip qua bag API de giu slotIndex nhat quan.
    inventory.setEquippedInternal(instance.instanceId, true)

    this.applyModifiers(instance, slotManager, affixRegistry)

    return { ok: true }
  }

  unequip(instanceId: string, inventory: EquipmentBag): boolean {
    const instance = inventory.get(instanceId)

    if (!instance) {
      return false
    }

    // OPT-04 - flip qua bag API de giu slotIndex nhat quan.
    inventory.setEquippedInternal(instance.instanceId, false)

    this.modifierSystem.removeBySource(instance.instanceId)

    return true
  }

  /**
   * DIEM REN cua mon do = forgeUsesRemaining hien tai -
   * CHINH LA "Tinh trang ren x/y" trong tooltip, KHONG phai pool nao
   * khac. Tay Luyen/Tinh Luyen tieu thu tai nguyen nay; item sinh ra
   * voi tinh trang DAY (xem createInstance).
   */
  itemRefinementPoints(instance: EquipmentInstance): number {
    return instance.forgeUsesRemaining
  }

  private spendItemRefinementPoints(instance: EquipmentInstance, amount: number) {
    instance.forgeUsesRemaining = Math.max(0, instance.forgeUsesRemaining - amount)
  }

  /** registry.get() nem loi khi thieu template - wrapper an toan cho du lieu dev cu. */
  private tryGetTemplate(registry: EquipmentRegistry, itemId: string): Equipment | undefined {
    try {
      return registry.get(itemId)
    } catch {
      return undefined
    }
  }

  /**
   * Slot-level rework (yeu cau 2026-08-26) - Cuong Hoa gan SLOT, KHONG
   * can item trong slot moi duoc cuong hoa. Tran mac dinh + chi phi
   * fallback khi khong tra duoc catalog/template.
   */
  /** Mot nguon resolve cost Cuong Hoa: catalog nghim  template  fallback. */
  private resolveEnhanceCost(
    realmId: string,

    enhanceLevel: number,

    template?: Equipment,
  ): { materials: RecipeMaterialCost[]; spiritStone: number } {
    // M3 - Bach Luyen Thanh Khi: xN the resolved cost so preview
    // (getEnhanceCost/getEnhanceSpiritStoneCost) and enhance() spend the
    // same authoritative amount.
    return this.applyEnhanceCostPolicy(this.resolveEnhanceCostBase(realmId, enhanceLevel, template))
  }

  private resolveEnhanceCostBase(
    realmId: string,

    enhanceLevel: number,

    template?: Equipment,
  ): { materials: RecipeMaterialCost[]; spiritStone: number } {
    // Catalog nghe uu tien (plan sec6) - scale theo level nhu template.
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

    // Fallback khi khong co catalog lan template - Linh Thach thuan,
    // gia tang tuyen tinh theo cap de van "phat trien duoc".
    return {
      materials: [],

      spiritStone: this.applyCostDiscount(40 * (enhanceLevel + 1)),
    }
  }

  /**
   * Linh Thach la MATERIAL (plan Workstream F) - moi check/tru cua he
   * equipment di qua 2 helper nay tren MaterialBag.
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

  /** Cost Tay Luyen sau discount Khi Duong; UI va transaction dung chung. */
  getWashCost(quality: ItemQuality): { tinhHoa: number; spiritStone: number } {
    return {
      tinhHoa: this.applyCostDiscount(WASH_TINH_HOA_COST_BY_QUALITY[quality]),
      spiritStone: this.applyCostDiscount(WASH_SPIRIT_STONE_COST_BY_QUALITY[quality]),
    }
  }

  /** Cost Tinh Luyen sau discount Khi Duong; UI va transaction dung chung. */
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
      spiritStone: this.applyCostDiscount(
        baseUnits * REFINE_SPIRIT_STONE_PER_UNIT_BY_QUALITY[quality],
      ),
      spiritStoneMaterialId: SPIRIT_STONE_MATERIAL_ID,
      refinementPoints: 1,
    }
  }
  /**
   * MASTER SPEC Muc XVI - Cuong Hoa gan SLOT (doi trang bi KHONG mat
   * cap) + slot-level rework (yeu cau 2026-08-26): SLOT TRONG van
   * cuong hoa duoc - tran mac dinh DEFAULT_MAX_ENHANCE_LEVEL, chi phi
   * resolve theo realmId hien hanh (catalog nghe -> template cua item
   * dang mac neu co -> fallback Linh Thach thuan).
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

    // Plan Workstream F - Linh Thach la MATERIAL: check/tru qua
    // MaterialBag (spiritStone trong cost chi con authoring sugar duoc
    // normalize tai boundary nay).
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
    // M3 - Bach Luyen Thanh Khi: enhance never fails while the policy is on.
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
   * TAY LUYEN (2026-08-25, resource-professions-rework plan sec7.3) -
   * reroll TOAN BO identity substat: so dong trong tran Chat,
   * identity tu pool hop le, tier weighted theo Chat. KHONG doi
   * main stat, quality, realm, cap Cuong Hoa slot.
   *
   * Chi phi bat buoc: 1 luot Ren + Luyen Khi Tinh Hoa + Linh Thach.
   * Validation truoc, tru toan bo sau khi thanh cong.
   *
   * Task 8 (phase7-gamemanager-split) - logic that tach sang
   * EquipmentWash.ts (roll-affix primitives dung chung voi
   * createInstance o EquipmentRollPrimitives.ts); EquipmentSystem chi
   * con bind state rieng (cost discount, ModifierSystem) qua
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
    // BETA SCOPE LOCK v2 sec.11 - equipmentWash is scope-hidden: the
    // domain itself fails closed so a direct call cannot bypass the
    // hidden tab (deferred frontend never reaches this in beta anyway).
    if (isScopeHidden('equipmentWash')) {
      return { ok: false, reason: 'scope_hidden' }
    }

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
   * Xem truoc Tay Luyen (2026-08-30, UI "giu/bo") - roll + validate + TRU
   * COST giong het washAffixes(), nhung KHONG ghi affixes moi vao
   * instance. R9 (AR-21): tra ve mot-use TICKET - affixes hien thi doc
   * qua getWashPreviewAffixes(ticketId); nguoi choi bam lai (ticket cu
   * bi thay, tra cost lan nua, roll moi) hoac "Giu"
   * (commitWashAffixes, khong ton them) de chot.
   */
  previewWashAffixes(
    instanceId: string,
    inventory: EquipmentBag,
    registry: EquipmentRegistry,
    materialBag: MaterialBag,
    affixRegistry: AffixRegistry,
    random: () => number = Math.random,
  ): { ok: boolean; reason?: string; ticketId?: string } {
    if (isScopeHidden('equipmentWash')) {
      return { ok: false, reason: 'scope_hidden' }
    }

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

  /** R9 (AR-21) - display copy of the pending roll (never authoritative). */
  getWashPreviewAffixes(ticketId: string): { affixes: RolledAffix[] } | undefined {
    // Scope-hidden wash cannot mint a ticket, but fail closed anyway -
    // a lingering pre-flag ticket must not render through the domain API.
    if (isScopeHidden('equipmentWash')) {
      return undefined
    }

    return getWashPreviewAffixesImpl(this.washPendingSlot, ticketId)
  }

  /** R9 (AR-21) - drop the pending wash ticket (UI cancel/re-roll). */
  discardWashTicket(ticketId: string): void {
    discardWashTicketImpl(this.washPendingSlot, ticketId)
  }

  /**
   * R9 (AR-23 4c) - authoritative main-stat range quote. The tooltip used
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
   * Chot ket qua da preview (previewWashAffixes) - khong kiem tra/tru cost
   * lan nua. R9 (AR-21): commit nhan TICKET ID, affixes ap vao instance
   * la ban domain-owned; moi attempt tieu ticket (refine precedent).
   */
  commitWashAffixes(
    instanceId: string,
    ticketId: string,
    inventory: EquipmentBag,
    slotManager: EquipmentSlotManager,
    affixRegistry: AffixRegistry,
  ): { ok: boolean; reason?: string } {
    if (isScopeHidden('equipmentWash')) {
      return { ok: false, reason: 'scope_hidden' }
    }

    return commitWashAffixesImpl(
      instanceId,
      ticketId,
      inventory,
      slotManager,
      affixRegistry,
      this.washDeps(),
    )
  }

  /** Deps injection cho EquipmentWash.ts - xem ghi chu washAffixes(). */
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
   * TINH LUYEN (2026-08-25, resource-professions-rework plan sec7.4) -
   * giu NGUYEN identity cua moi substat, tang GIA TRI tung dong
   * KHONG khoa trong khoang 5-20% (clamp trong min/max hop le cua
   * tier). Khoa L dong -> cost Linh Thach he so N + L; KHONG
   * cho khoa toan bo.
   *
   * Chi phi bat buoc: 1 luot Ren + Luyen Khi Tinh Hoa theo Chat
   * + Linh Thach pho thong (don gia x N + L).
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
    // BETA SCOPE LOCK v2 sec.11 - equipmentRefine is scope-hidden
    // (domain-level fail closed, same contract as washAffixes above).
    if (isScopeHidden('equipmentRefine')) {
      return { ok: false, reason: 'scope_hidden' }
    }

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
   * Xem truoc Tinh Luyen (2026-08-30, UI "giu/bo") - cung co che preview/
   * commit voi previewWashAffixes/commitWashAffixes: roll + validate + TRU
   * COST giong refineAffixValues() nhung KHONG ghi value moi vao instance.
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
    if (isScopeHidden('equipmentRefine')) {
      return { ok: false, reason: 'scope_hidden' }
    }

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

  /** Huy capability Refine dang cho; UI goi khi nguoi choi bam Bo/doi context. */
  discardRefinePreview(instanceId?: string): void {
    discardRefinePreviewImpl(this.refineDeps(), instanceId)
  }

  /** Chot dung mot lan payload do previewRefineValues/refineAffixValues vua tao. */
  commitRefineValues(
    instanceId: string,
    values: readonly RefineValueEntry[],
    inventory: EquipmentBag,
    slotManager: EquipmentSlotManager,
    affixRegistry: AffixRegistry,
  ): { ok: boolean; reason?: string } {
    if (isScopeHidden('equipmentRefine')) {
      return { ok: false, reason: 'scope_hidden' }
    }

    return commitRefineValuesImpl(
      instanceId,
      values,
      inventory,
      slotManager,
      affixRegistry,
      this.refineDeps(),
    )
  }

  /** Deps injection cho EquipmentRefine.ts - cung pattern washDeps(). */
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
   * HOA LUYEN (2026-08-25, resource-professions-rework plan sec7.5) -
   * phan giai DESTRUCTIVE trang bi thanh Tinh Hoa theo tier canh gioi
   * va quality. Batch all-or-nothing: khong xoa mot phan item neu cong
   * reward that bai. Khong tieu hao Diem Ren.
   *
   * Guards (sec7.5): item dang trang bi / locked / favorite bi tu choi.
   * So Tinh Hoa theo bang ITEM_QUALITY_ESSENCE_RANGE; moi Pham trang bi
   * cung tra mot loai Luyen Khi Tinh Hoa.
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
   * Build lai modifierSystem noi bo tu toan bo instance dang
   * equipped trong inventory - can goi sau khi nap EquipmentBag
   * tu save, vi modifierSystem la state trong bo nho cua
   * EquipmentSystem, khong tu phuc hoi theo EquipmentBag.
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
   * Build modifier tu chi so DA ROLL cua instance (Implicit/mainStat +
   * affixes). Cuong Hoa (enhanceLevel doc tu SLOT, Phase 9) chi nhan
   * he so len mainStat - stat phu thuoc Tinh Luyen: value da roll
   * trong affixes[] da gom tang truong refine (EquipmentRefine ghi
   * thang vao instance.affixes[i].value), ap nguyen gia tri do,
   * khong nhan lai enhance scale. Formation (Khac Tran) duoc ap rieng
   * qua GameManager. getAggregatedModifiers(), khong nam trong ham nay.
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

      // Affix khong scale theo Cuong Hoa (scale = 1) - tang truong stat
      // phu la trach nhiem cua Tinh Luyen, da nam trong rolled value.
      this.applyScaledModifier(instance.instanceId, affix.stat, value, 1)
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
