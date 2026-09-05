import { MaterialRegistry } from '../material/MaterialRegistry'
import { MaterialBag } from '../material/MaterialBag'
import { EquipmentRegistry } from '../equipment/EquipmentRegistry'
import { EquipmentBag, type AutoDissolveReward } from '../equipment/EquipmentBag'
import { EquipmentSystem, type RefineValueEntry } from '../equipment/EquipmentSystem'
import { MAX_SLOT_ENHANCE_LEVEL } from '../equipment/EnhanceCurve'
import type { RolledAffix } from '../equipment/RolledAffix'
import { EquipmentSlotManager } from '../equipment/EquipmentSlotManager'
import type { EquipmentSlot } from '../equipment/EquipmentTypes'
import type { EquipmentSlotState } from '../equipment/EquipmentSlotState'
import type { Equipment } from '../equipment/Equipment'
import type { EquipmentInstance } from '../equipment/EquipmentInstance'
import type { ItemQuality } from '../item/ItemQuality'
import { AffixRegistry } from '../equipment/AffixRegistry'
import { ITEM_QUALITY_ESSENCE_RANGE } from '../equipment/ItemQualityBalance'
import { LUYEN_KHI_TINH_HOA_ID } from '../equipment/TinhHoaMaterial'
import type { PlayerData } from '../player/Player'
import type { StatModifier } from '../stats/StatCalculator'
import { BuildingRegistry } from '../building/BuildingRegistry'
import { BuildingManager } from '../building/BuildingManager'
import { BuildingSystem } from '../building/BuildingSystem'
import { NotificationQueue } from './NotificationQueue'
import { createBagOverflowEvent } from '../notification/bagOverflow'

export interface EquipmentOpsSystemDeps {
  equipmentSystem: EquipmentSystem
  equipmentBag: EquipmentBag
  equipmentRegistry: EquipmentRegistry
  equipmentSlotManager: EquipmentSlotManager
  affixRegistry: AffixRegistry
  materialBag: MaterialBag
  materialRegistry: MaterialRegistry
  buildingManager: BuildingManager
  buildingRegistry: BuildingRegistry
  buildingSystem: BuildingSystem
  notifications: NotificationQueue
  // Collect-quest hook (xem GameManager.notifyQuestMaterialGained) — GameManager
  // cung cấp closure vì hook thật cần questSystem/questRegistry/questManager,
  // những state không thuộc phạm vi trang bị.
  notifyQuestMaterialGained: (materialId: string, amount: number) => void
}

/**
 * Tách khỏi GameManager (2026-09-02, task 1 — GameManager split) — toàn bộ
 * thao tác trang bị (equip/unequip, Cường Hóa, Tẩy Luyện, Tinh Luyện, Hóa
 * Luyện, obtain/roll, slot state query, breakthrough-unequip-guard). Cùng
 * pattern DI với BattleLootSystem/StageWaveSystem: constructor nhận
 * dependency tường minh qua object `deps`, KHÔNG tự import ngược GameManager.
 */
export class EquipmentOpsSystem {
  constructor(private readonly deps: EquipmentOpsSystemDeps) {}

  /**
   * W5 (2026-08-27) — level Khí Đường giảm chi phí Cường Hóa/Tẩy Luyện/
   * Tinh Luyện. Đồng bộ discount vào EquipmentSystem trước mỗi query/spend.
   */
  private syncEquipmentCostDiscount() {
    const instance = this.deps.buildingManager.getByBuildingId('equipment_hall')

    if (!instance) {
      this.deps.equipmentSystem.setCostDiscountPercent(0)
      return
    }

    const template = this.deps.buildingRegistry.get('equipment_hall')

    this.deps.equipmentSystem.setCostDiscountPercent(
      this.deps.buildingSystem.getCraftModifiers(instance, template).equipmentCostDiscountPercent / 100,
    )
  }

  obtainEquipment(equipmentId: string, player: PlayerData): EquipmentInstance | null {
    if (!this.deps.equipmentRegistry.has(equipmentId)) {
      return null
    }

    const template = this.deps.equipmentRegistry.get(equipmentId)
    const instance = this.deps.equipmentSystem.createInstance(template, player, this.deps.affixRegistry)

    this.grantAutoDissolveRewards(this.deps.equipmentBag.add(instance))

    return instance
  }

  /**
   * Cap mềm túi trang bị (audit 2026-08-31) — EquipmentBag.add() tự Hóa
   * Luyện item "rác" nhất khi vượt cap và TRẢ rewards Tinh Hoa cho caller
   * cộng. Null-safe với mock tests (add trả undefined khi bị mock). Cộng
   * qua materialBag + quest hook (mirror dissolveItems()), toast 1 lần
   * mỗi batch qua NotificationQueue sẵn có.
   */
  private grantAutoDissolveRewards(rewards: AutoDissolveReward[] | undefined) {
    const autoDissolved = rewards ?? []

    if (autoDissolved.length === 0) {
      return
    }

    for (const reward of autoDissolved) {
      if (this.deps.materialRegistry.has(reward.materialId)) {
        // 9.8 — tràn túi: quest chỉ tính delivered + toast bag.overflow.
        const overflow = this.deps.materialBag.add(this.deps.materialRegistry.get(reward.materialId), reward.amount)

        this.deps.notifyQuestMaterialGained(reward.materialId, reward.amount - overflow)

        if (overflow > 0) {
          this.deps.notifications.push(
            createBagOverflowEvent(this.deps.materialRegistry.get(reward.materialId).name, overflow),
          )
        }
      }
    }

    this.deps.notifications.push({
      kind: 'loot',
      message: `Túi đầy — tự Hóa Luyện ${autoDissolved.length} món thành Tinh Hoa`,
    })
  }

  equipItem(instanceId: string, player: PlayerData): { ok: boolean; reason?: string } {
    return this.deps.equipmentSystem.equip(
      instanceId,
      this.deps.equipmentBag,
      this.deps.equipmentRegistry,
      this.deps.equipmentSlotManager,
      player,
      this.deps.affixRegistry,
    )
  }

  unequipItem(instanceId: string): boolean {
    return this.deps.equipmentSystem.unequip(instanceId, this.deps.equipmentBag)
  }

  /** Cường Hóa gắn SLOT — slot trống vẫn nâng được (slot-level rework). */
  enhanceSlot(slot: EquipmentSlot, player: PlayerData): { ok: boolean; reason?: string } {
    this.syncEquipmentCostDiscount()

    return this.deps.equipmentSystem.enhance(
      slot,

      player.realmId,

      this.deps.equipmentBag,

      this.deps.equipmentRegistry,

      this.deps.materialBag,

      this.deps.equipmentSlotManager,

      this.deps.affixRegistry,
    )
  }

  getEnhanceCost(slot: EquipmentSlot, realmId: string) {
    this.syncEquipmentCostDiscount()

    return this.deps.equipmentSystem.getEnhanceCost(
      slot,

      realmId,

      this.deps.equipmentBag,

      this.deps.equipmentRegistry,

      this.deps.equipmentSlotManager,
    )
  }

  getEnhanceSpiritStoneCost(slot: EquipmentSlot, realmId: string): number {
    this.syncEquipmentCostDiscount()

    return this.deps.equipmentSystem.getEnhanceSpiritStoneCost(
      slot,

      realmId,

      this.deps.equipmentBag,

      this.deps.equipmentRegistry,

      this.deps.equipmentSlotManager,
    )
  }

  /**
   * Task 10 (rework P3) — slot-level enhance: trần là MAX_SLOT_ENHANCE_LEVEL
   * (100 = 10 realm × 10 cấp), KHÔNG còn theo template. Giữ method cho API
   * ổn định; tham số legacy bỏ qua.
   */
  getSlotMaxEnhanceLevel(_slot: EquipmentSlot, _realmId: string): number {
    return MAX_SLOT_ENHANCE_LEVEL
  }

  /** Template tra an toàn — registry.get() ném lỗi với id lạ, UI cần undefined. */
  getEquipmentTemplate(itemId: string): Equipment | undefined {
    try {
      return this.deps.equipmentRegistry.get(itemId)
    } catch {
      return undefined
    }
  }

  /** Remaining per-item forge uses (`forgeUsesRemaining`, shown as the forge condition). */
  itemRefinementPoints(instance: EquipmentInstance): number {
    return this.deps.equipmentSystem.itemRefinementPoints(instance)
  }

  /**
   * Wash all affixes using one forge use, quality-scaled equipment essence,
   * and generic spirit stones. Returns a domain reason for presentation.
   */
  washItem(
    instanceId: string,
    player: PlayerData,
  ): { ok: boolean; reason?: string } {
    void player

    this.syncEquipmentCostDiscount()

    return this.deps.equipmentSystem.washAffixes(
      instanceId,
      this.deps.equipmentBag,
      this.deps.equipmentRegistry,
      this.deps.materialBag,
      this.deps.equipmentSlotManager,
      this.deps.affixRegistry,
    )
  }

  /**
   * TINH LUYỆN (plan §7.4) — mỗi dòng eligible không khóa tăng 5–20%
   * rồi clamp theo trần tier; tối đa khóa 3 dòng. Trả về reason lỗi cho UI.
   */
  refineItem(
    instanceId: string,
    lockedIndices: readonly number[],
    player: PlayerData,
  ): { ok: boolean; reason?: string } {
    void player

    this.syncEquipmentCostDiscount()

    return this.deps.equipmentSystem.refineAffixValues(
      instanceId,
      lockedIndices,
      this.deps.equipmentBag,
      this.deps.equipmentRegistry,
      this.deps.materialBag,
      this.deps.equipmentSlotManager,
      this.deps.affixRegistry,
    )
  }

  /**
   * Xem trước Tẩy Luyện (2026-08-30, UI "giữ/bỏ") — roll + trừ cost NGAY,
   * KHÔNG ghi affixes mới vào instance. UI giữ affixes trả về ở state
   * tạm, gọi commitWashItem() khi người chơi bấm "Giữ".
   */
  previewWashItem(instanceId: string): { ok: boolean; reason?: string; affixes?: RolledAffix[] } {
    this.syncEquipmentCostDiscount()

    return this.deps.equipmentSystem.previewWashAffixes(
      instanceId,
      this.deps.equipmentBag,
      this.deps.equipmentRegistry,
      this.deps.materialBag,
      this.deps.affixRegistry,
    )
  }

  /** Chốt affixes đã preview (previewWashItem) — không trừ cost lần nữa. */
  commitWashItem(instanceId: string, affixes: RolledAffix[]): { ok: boolean; reason?: string } {
    return this.deps.equipmentSystem.commitWashAffixes(
      instanceId,
      affixes,
      this.deps.equipmentBag,
      this.deps.equipmentSlotManager,
      this.deps.affixRegistry,
    )
  }

  /**
   * Xem trước Tinh Luyện (2026-08-30, UI "giữ/bỏ") — cùng cơ chế với
   * previewWashItem/commitWashItem.
   */
  previewRefineItem(
    instanceId: string,
    lockedIndices: readonly number[],
  ): { ok: boolean; reason?: string; values?: RefineValueEntry[] } {
    this.syncEquipmentCostDiscount()

    return this.deps.equipmentSystem.previewRefineValues(
      instanceId,
      lockedIndices,
      this.deps.equipmentBag,
      this.deps.equipmentRegistry,
      this.deps.materialBag,
      this.deps.affixRegistry,
    )
  }

  /** Chốt values đã preview (previewRefineItem) — không trừ cost lần nữa. */
  commitRefineItem(instanceId: string, values: RefineValueEntry[]): { ok: boolean; reason?: string } {
    return this.deps.equipmentSystem.commitRefineValues(
      instanceId,
      values,
      this.deps.equipmentBag,
      this.deps.equipmentSlotManager,
      this.deps.affixRegistry,
    )
  }

  /** Hủy Refine preview đã trả phí khi UI bỏ kết quả hoặc đổi context. */
  discardRefinePreview(instanceId?: string): void {
    this.deps.equipmentSystem.discardRefinePreview(instanceId)
  }

  /** Discounted Wash cost for UI, keyed by the item's quality. */
  getWashCost(quality: ItemQuality) {
    this.syncEquipmentCostDiscount()

    return this.deps.equipmentSystem.getWashCost(quality)
  }

  /** Discounted Refine cost for UI, keyed by the item's quality. */
  getRefineCost(
    lineCount: number,
    lockedCount: number,
    quality?: ItemQuality,
  ) {
    this.syncEquipmentCostDiscount()

    return this.deps.equipmentSystem.getRefineCost(lineCount, lockedCount, quality)
  }

  /**
   * HÓA LUYỆN (plan §7.5) — phân giải batch trang bị thành Tinh Hoa,
   * all-or-nothing. Không tiêu hao Điểm Rèn.
   */
  dissolveItems(instanceIds: readonly string[]): {
    ok: boolean
    reason?: string
    rewards?: Array<{ materialId: string; amount: number }>
  } {
    const result = this.deps.equipmentSystem.dissolveInstances(instanceIds, this.deps.equipmentBag)

    if (result.ok && result.rewards) {
      for (const reward of result.rewards) {
        if (this.deps.materialRegistry.has(reward.materialId)) {
          // 9.8 — tràn túi: quest chỉ tính delivered + toast (contract
          // result.rewards GIỮ NGUYÊN — tổng Tinh Hoa phân giải).
          const overflow = this.deps.materialBag.add(this.deps.materialRegistry.get(reward.materialId), reward.amount)

          this.deps.notifyQuestMaterialGained(reward.materialId, reward.amount - overflow)

          if (overflow > 0) {
            this.deps.notifications.push(
              createBagOverflowEvent(this.deps.materialRegistry.get(reward.materialId).name, overflow),
            )
          }
        }
      }
    }

    return result
  }

  /** Preview Tinh Hoa nhận được khi Hóa Luyện selection hiện tại (§9.2). */
  previewDissolveRewards(
    instanceIds: readonly string[],
  ): Array<{ materialId: string; minAmount: number; maxAmount: number }> {
    const totals = new Map<string, { min: number; max: number }>()

    for (const instanceId of instanceIds) {
      const instance = this.deps.equipmentBag.get(instanceId)

      if (!instance || instance.equipped || instance.locked || instance.favorite) {
        continue
      }

      const range = ITEM_QUALITY_ESSENCE_RANGE[instance.quality]

      if (!range) {
        continue
      }

      const entry = totals.get(LUYEN_KHI_TINH_HOA_ID) ?? { min: 0, max: 0 }

      entry.min += range.min

      entry.max += range.max

      totals.set(LUYEN_KHI_TINH_HOA_ID, entry)
    }

    return Array.from(totals, ([materialId, value]) => ({
      materialId,

      minAmount: value.min,

      maxAmount: value.max,
    }))
  }

  /**
   * State cường hóa/formation/bonus affix slots của 1 slot cụ thể —
   * dùng cho UI hiện thông tin NGAY CẢ KHI slot đang trống (MASTER
   * SPEC Mục XVI, Phase 9).
   */
  getSlotState(slot: EquipmentSlot): EquipmentSlotState {
    return this.deps.equipmentSlotManager.get(slot)
  }

  getAllSlotStates(): EquipmentSlotState[] {
    return this.deps.equipmentSlotManager.getAll()
  }

  /**
   * Modifier "tĩnh" từ equipment — xem ghi chú trong Player.ts và
   * EquipmentSystem. Chỉ đổi khi equip/unequip/enhance, caller
   * (player store) tự gán lại vào player.modifiers sau mỗi hành
   * động, KHÔNG gọi mỗi tick như getAggregatedModifiers().
   */
  getEquipmentModifiers(): StatModifier[] {
    return this.deps.equipmentSystem.getModifiers()
  }

  /**
   * Task 17 (rework P5) — Đột Phá đại cảnh giới đổi player.realmId nên
   * mọi item đang mặc có thể lệch phẩm mới (Task 16 gate canUseItemGrade
   * chặn re-equip khi lệch, nhưng KHÔNG tự tháo đồ cũ) → tháo TOÀN BỘ
   * trang bị đang mặc ngay sau khi breakthrough để tránh kẹt trạng thái
   * "mặc đồ giờ lệch phẩm nhưng không thể equip lại nếu lỡ tháo tay".
   * Slot state (enhanceLevel/enhanceFailStreak/Formation/Talisman) sống
   * độc lập theo SLOT (MASTER SPEC Mục XVI) — KHÔNG đụng tới, chỉ đổi
   * equipped flag + modifier trên từng EquipmentInstance.
   */
  unequipAllEquipment(): void {
    for (const instance of this.deps.equipmentBag.getEquipped()) {
      this.deps.equipmentSystem.unequip(instance.instanceId, this.deps.equipmentBag)
    }

    this.deps.equipmentSystem.refreshModifiers(
      this.deps.equipmentBag,
      this.deps.equipmentSlotManager,
      this.deps.affixRegistry,
    )
  }
}
