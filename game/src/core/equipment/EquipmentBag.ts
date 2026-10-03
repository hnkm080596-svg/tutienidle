import type { EquipmentInstance } from './EquipmentInstance'
import type { EquipmentSlot } from './EquipmentTypes'
import { ITEM_QUALITY_ORDER } from '../item/ItemQuality'
import { PROFESSION_GRADE_ORDER } from '../profession/ProfessionGrade'
import { ITEM_QUALITY_ESSENCE_RANGE } from './ItemQualityBalance'
import { LUYEN_KHI_TINH_HOA_ID } from './TinhHoaMaterial'

/**
 * Cap mem tui trang bi (audit 2026-08-31) - tui tung KHONG gioi han: moi
 * equipment drop deu add() va khong gi tu remove, save phinh dan vuot
 * localStorage quota (~5MB) khien autosave chet im lang. 500 du thoai
 * mai choi tay (do can giu deu lock/favorite) ma giu save < ~2MB.
 */
export const EQUIPMENT_BAG_SOFT_CAP = 500

/**
 * Reward Tinh Hoa khi auto-dissolve vuot cap - bag KHONG tu cong vao
 * material system (tranh circular dependency voi GameManager): add()
 * tra rewards, CALLER cong bag + toast.
 */
export interface AutoDissolveReward {
  materialId: string
  amount: number
}

export class EquipmentBag {
  private instances: EquipmentInstance[] = []

  private readonly membershipGenerationByInstance = new WeakMap<EquipmentInstance, number>()

  private nextMembershipGeneration = 1

  // OPT-04 - index O(1) cho equipped lookups. Bat bien: voi moi instance
  // dang o trong bag, slotIndex.get(slot) === instance khi va chi khi
  // instance.equipped === true (va la instance equipped duy nhat cua
  // slot). MOI flip cua `equipped` phai di qua setEquippedInternal() -
  // EquipmentSystem.equip/unequip la writer duy nhat trong production.
  private readonly slotIndex = new Map<EquipmentSlot, EquipmentInstance>()

  add(instance: EquipmentInstance): AutoDissolveReward[] {
    // Dedupe theo instanceId - save import/hand-edit chua trung instanceId
    // tung gay nhan ban trang bi + double stat modifier sau
    // refreshModifiers() (review 2026-08-28). Ban ghi dau thang.
    if (this.has(instance.instanceId)) {
      return []
    }

    this.instances.push(instance)
    this.membershipGenerationByInstance.set(instance, this.nextMembershipGeneration)
    this.nextMembershipGeneration += 1

    if (instance.equipped) {
      this.indexEquipped(instance)
    }

    if (this.instances.length <= EQUIPMENT_BAG_SOFT_CAP) {
      return []
    }

    // Cap mem (audit 2026-08-31): vuot nguong -> tu dong Hoa Luyen item
    // "rac" nhat - khong trang bi/lock/favorite, pham chat thap truoc.
    // Rewards tra ve cho CALLER cong (bag khong biet material system -
    // tranh circular dependency voi GameManager).
    return this.autoDissolveOverflow()
  }

  /**
   * Auto Hoa Luyen dung so luong vuot cap. Candidate KHONG duoc
   * equipped/locked/favorite (do nguoi choi chu dong giu). Item khong
   * co rule chuyen doi Tinh Hoa (range missing) -> KHONG
   * dissolve mu - bo qua, giu item (tui duoc vuot cap trong case benh
   * hoan thay vi mat do oan). Amount dung range.min CO DINH -
   * deterministic; nguoi choi muon roll random (range.min..max) phai
   * Hoa Luyen tay qua EquipmentSystem.dissolveInstances().
   */
  private autoDissolveOverflow(): AutoDissolveReward[] {
    const overflowCount = this.instances.length - EQUIPMENT_BAG_SOFT_CAP
    const candidates = this.instances
      .filter((instance) => !instance.equipped && !instance.locked && !instance.favorite)
      .sort(
        (a, b) =>
          PROFESSION_GRADE_ORDER.indexOf(a.grade) - PROFESSION_GRADE_ORDER.indexOf(b.grade) ||
          ITEM_QUALITY_ORDER.indexOf(a.quality) - ITEM_QUALITY_ORDER.indexOf(b.quality) ||
          a.forgeUsesRemaining - b.forgeUsesRemaining,
      )

    const rewards: AutoDissolveReward[] = []
    let remaining = overflowCount

    for (const candidate of candidates) {
      if (remaining <= 0) {
        break
      }

      const range = ITEM_QUALITY_ESSENCE_RANGE[candidate.quality]

      if (!range) {
        continue // khong co rule chuyen doi -> giu item, khong dissolve mu
      }

      this.remove(candidate.instanceId)
      rewards.push({ materialId: LUYEN_KHI_TINH_HOA_ID, amount: range.min })
      remaining -= 1
    }

    return rewards
  }

  remove(instanceId: string) {
    for (const instance of this.instances) {
      if (instance.instanceId === instanceId) {
        this.membershipGenerationByInstance.delete(instance)

        if (instance.equipped && this.slotIndex.get(instance.slot) === instance) {
          this.slotIndex.delete(instance.slot)
        }
      }
    }

    this.instances = this.instances.filter((instance) => instance.instanceId !== instanceId)
  }

  /**
   * Capability vong doi cua exact object trong bag. Cung object remove/add lai
   * nhan generation moi; object thay the cung instanceId cung khong the dung
   * generation cua ban cu.
   */
  getMembershipGeneration(instance: EquipmentInstance): number | undefined {
    if (this.get(instance.instanceId) !== instance) {
      return undefined
    }

    return this.membershipGenerationByInstance.get(instance)
  }

  get(instanceId: string) {
    return this.instances.find((instance) => instance.instanceId === instanceId)
  }

  getAll(): EquipmentInstance[] {
    return [...this.instances]
  }

  getEquipped(): EquipmentInstance[] {
    return [...this.slotIndex.values()]
  }

  getEquippedInSlot(slot: EquipmentSlot) {
    return this.slotIndex.get(slot)
  }

  /**
   * OPT-04 - writer DUY NHAT cua `instance.equipped` cho instance dang
   * trong bag: flip flag + giu slotIndex nhat quan. Idempotent.
   */
  setEquippedInternal(instanceId: string, equipped: boolean): boolean {
    const instance = this.get(instanceId)

    if (!instance) {
      return false
    }

    if (instance.equipped === equipped) {
      return true
    }

    instance.equipped = equipped

    if (equipped) {
      this.indexEquipped(instance)
    } else if (this.slotIndex.get(instance.slot) === instance) {
      this.slotIndex.delete(instance.slot)
    }

    return true
  }

  private indexEquipped(instance: EquipmentInstance): void {
    const current = this.slotIndex.get(instance.slot)

    if (current && current !== instance && current.equipped) {
      // Khong bao gio xay ra qua API chuan (equip luon unequip do cu
      // truoc) - phong ho writer ngoai luong, giu index dung 1 muc/slot.
      current.equipped = false
    }

    this.slotIndex.set(instance.slot, instance)
  }

  /**
   * M1 (ARCH-001) - session-restore boundary: drop every live instance so
   * the payload's item set REPLACES the bag instead of merging into it.
   * Membership generations die with their objects (WeakMap self-collects);
   * pending paid-op tickets bound to the removed set are the caller's
   * concern - GameManagerSaveRestore invalidates them via
   * EquipmentSystem.invalidatePendingOperationTickets().
   */
  clear(): void {
    this.instances = []
    this.slotIndex.clear()
  }

  has(instanceId: string): boolean {
    return this.instances.some((instance) => instance.instanceId === instanceId)
  }
}
