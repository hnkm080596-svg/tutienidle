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
import type { PlayerData } from '../player/Player'
import type { StatModifier } from '../stats/StatCalculator'
import { BuildingRegistry } from '../building/BuildingRegistry'
import { BuildingManager } from '../building/BuildingManager'
import { BuildingSystem } from '../building/BuildingSystem'
import { NotificationQueue } from './NotificationQueue'
import { createBagOverflowEvent } from '../notification/bagOverflow'
import { getEnhanceGuarantee } from '../talent/TalentEffects'

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
  // Collect-quest hook (xem GameManager.notifyQuestMaterialGained) - GameManager
  // cung cap closure vi hook that can questSystem/questRegistry/questManager,
  // nhung state khong thuoc pham vi trang bi.
  notifyQuestMaterialGained: (materialId: string, amount: number) => void
  // Talent policy reads the active player per call (same pattern as
  // GameManagerBuildingOps) - enhance guarantee follows the CURRENT
  // selectedTalentIds, not a snapshot.
  getActivePlayer: () => PlayerData | undefined
}

/**
 * Tach khoi GameManager (2026-09-02, task 1 - GameManager split) - toan bo
 * thao tac trang bi (equip/unequip, Cuong Hoa, Tay Luyen, Tinh Luyen, Hoa
 * Luyen, obtain/roll, slot state query, breakthrough-unequip-guard). Cung
 * pattern DI voi BattleLootSystem/StageWaveSystem: constructor nhan
 * dependency tuong minh qua object `deps`, KHONG tu import nguoc GameManager.
 */
export class EquipmentOpsSystem {
  constructor(private readonly deps: EquipmentOpsSystemDeps) {}

  /**
   * W5 (2026-08-27) - level Khi Duong giam chi phi Cuong Hoa/Tay Luyen/
   * Tinh Luyen. Dong bo discount vao EquipmentSystem truoc moi query/spend.
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

  /**
   * M3 (spec S4.2) - Bach Luyen Thanh Khi: enhance policy (never fail +
   * x3 cost) synced per call, same pattern as syncEquipmentCostDiscount.
   */
  private syncEnhancePolicy() {
    const player = this.deps.getActivePlayer()
    const guarantee = getEnhanceGuarantee(player?.selectedTalentIds, player?.talentLevels)

    this.deps.equipmentSystem.setEnhancePolicy(
      guarantee
        ? { alwaysSucceed: true, costMultiplier: guarantee.costMultiplier }
        : { alwaysSucceed: false, costMultiplier: 1 },
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
   * Cap mem tui trang bi (audit 2026-08-31) - EquipmentBag.add() tu Hoa
   * Luyen item "rac" nhat khi vuot cap va TRA rewards Tinh Hoa cho caller
   * cong. Null-safe voi mock tests (add tra undefined khi bi mock). Cong
   * qua materialBag + quest hook (mirror dissolveItems()), toast 1 lan
   * moi batch qua NotificationQueue san co.
   */
  private grantAutoDissolveRewards(rewards: AutoDissolveReward[] | undefined) {
    const autoDissolved = rewards ?? []

    if (autoDissolved.length === 0) {
      return
    }

    for (const reward of autoDissolved) {
      if (this.deps.materialRegistry.has(reward.materialId)) {
        // 9.8 - tran tui: quest chi tinh delivered + toast bag.overflow.
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

  /** Cuong Hoa gan SLOT - slot trong van nang duoc (slot-level rework). */
  enhanceSlot(slot: EquipmentSlot, player: PlayerData): { ok: boolean; reason?: string } {
    this.syncEquipmentCostDiscount()
    this.syncEnhancePolicy()

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
    this.syncEnhancePolicy()

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
    this.syncEnhancePolicy()

    return this.deps.equipmentSystem.getEnhanceSpiritStoneCost(
      slot,

      realmId,

      this.deps.equipmentBag,

      this.deps.equipmentRegistry,

      this.deps.equipmentSlotManager,
    )
  }

  /**
   * Task 10 (rework P3) - slot-level enhance: tran la MAX_SLOT_ENHANCE_LEVEL
   * (100 = 10 realm x 10 cap), KHONG con theo template. Giu method cho API
   * on dinh; tham so legacy bo qua.
   */
  getSlotMaxEnhanceLevel(_slot: EquipmentSlot, _realmId: string): number {
    return MAX_SLOT_ENHANCE_LEVEL
  }

  /** Template tra an toan - registry.get() nem loi voi id la, UI can undefined. */
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
   * TINH LUYEN (plan S7.4) - moi dong eligible khong khoa tang 5-20%
   * roi clamp theo tran tier; toi da khoa 3 dong. Tra ve reason loi cho UI.
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
   * Xem truoc Tay Luyen (2026-08-30, UI "giu/bo") - roll + tru cost NGAY,
   * KHONG ghi affixes moi vao instance. R9 (AR-21): tra mot-use TICKET -
   * affixes hien thi doc qua getWashPreviewAffixes(ticketId).
   */
  previewWashItem(instanceId: string): { ok: boolean; reason?: string; ticketId?: string } {
    this.syncEquipmentCostDiscount()

    return this.deps.equipmentSystem.previewWashAffixes(
      instanceId,
      this.deps.equipmentBag,
      this.deps.equipmentRegistry,
      this.deps.materialBag,
      this.deps.affixRegistry,
    )
  }

  /** R9 (AR-21) - display copy of the pending wash roll by ticket. */
  getWashPreviewAffixes(ticketId: string): { affixes: RolledAffix[] } | undefined {
    return this.deps.equipmentSystem.getWashPreviewAffixes(ticketId)
  }

  /** R9 (AR-21) - drop a pending wash ticket (UI cancel/re-roll). */
  discardWashTicket(ticketId: string): void {
    this.deps.equipmentSystem.discardWashTicket(ticketId)
  }

  /**
   * Chot ket qua da preview (previewWashItem) - khong tru cost lan nua.
   * R9 (AR-21): commit nhan TICKET ID; affixes ap la ban domain-owned.
   */
  commitWashItem(instanceId: string, ticketId: string): { ok: boolean; reason?: string } {
    return this.deps.equipmentSystem.commitWashAffixes(
      instanceId,
      ticketId,
      this.deps.equipmentBag,
      this.deps.equipmentSlotManager,
      this.deps.affixRegistry,
    )
  }

  /**
   * Xem truoc Tinh Luyen (2026-08-30, UI "giu/bo") - cung co che voi
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

  /** Chot values da preview (previewRefineItem) - khong tru cost lan nua. */
  commitRefineItem(instanceId: string, values: RefineValueEntry[]): { ok: boolean; reason?: string } {
    return this.deps.equipmentSystem.commitRefineValues(
      instanceId,
      values,
      this.deps.equipmentBag,
      this.deps.equipmentSlotManager,
      this.deps.affixRegistry,
    )
  }

  /** Huy Refine preview da tra phi khi UI bo ket qua hoac doi context. */
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
   * HOA LUYEN (plan S7.5) - phan giai batch trang bi thanh Tinh Hoa,
   * all-or-nothing. Khong tieu hao Diem Ren.
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
          // 9.8 - tran tui: quest chi tinh delivered + toast (contract
          // result.rewards GIU NGUYEN - tong Tinh Hoa phan giai).
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

  /**
   * R9 (AR-23 4d) - dissolve quote delegated to the DOMAIN (same dedupe
   * + rejection semantics as dissolveItems). The old ops-level duplicate
   * skipped invalid items silently; the domain quote now rejects
   * explicitly.
   */
  previewDissolveRewards(
    instanceIds: readonly string[],
  ): Array<{ materialId: string; minAmount: number; maxAmount: number }> {
    const result = this.deps.equipmentSystem.quoteDissolveInstances(instanceIds, this.deps.equipmentBag)

    return result.ok ? result.totals ?? [] : []
  }

  /**
   * State cuong hoa/formation/bonus affix slots cua 1 slot cu the -
   * dung cho UI hien thong tin NGAY CA KHI slot dang trong (MASTER
   * SPEC Muc XVI, Phase 9).
   */
  getSlotState(slot: EquipmentSlot): EquipmentSlotState {
    return this.deps.equipmentSlotManager.get(slot)
  }

  getAllSlotStates(): EquipmentSlotState[] {
    return this.deps.equipmentSlotManager.getAll()
  }

  /**
   * Modifier "tinh" tu equipment - xem ghi chu trong Player.ts va
   * EquipmentSystem. Chi doi khi equip/unequip/enhance, caller
   * (player store) tu gan lai vao player.modifiers sau moi hanh
   * dong, KHONG goi moi tick nhu getAggregatedModifiers().
   */
  getEquipmentModifiers(): StatModifier[] {
    return this.deps.equipmentSystem.getModifiers()
  }

  /**
   * Task 17 (rework P5) - Dot Pha dai canh gioi doi player.realmId nen
   * moi item dang mac co the lech pham moi (Task 16 gate canUseItemGrade
   * chan re-equip khi lech, nhung KHONG tu thao do cu) -> thao TOAN BO
   * trang bi dang mac ngay sau khi breakthrough de tranh ket trang thai
   * "mac do gio lech pham nhung khong the equip lai neu lo thao tay".
   * Slot state (enhanceLevel/enhanceFailStreak/Formation/Talisman) song
   * doc lap theo SLOT (MASTER SPEC Muc XVI) - KHONG dung toi, chi doi
   * equipped flag + modifier tren tung EquipmentInstance.
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
