import type { EquipmentInstance } from './EquipmentInstance'
import type { EquipmentSlot } from './EquipmentTypes'
import { ITEM_QUALITY_ORDER } from '../item/ItemQuality'
import { PROFESSION_GRADE_ORDER } from '../profession/ProfessionGrade'
import { ITEM_QUALITY_ESSENCE_RANGE } from './ItemQualityBalance'
import { LUYEN_KHI_TINH_HOA_ID } from './TinhHoaMaterial'

/**
 * Cap mềm túi trang bị (audit 2026-08-31) — túi từng KHÔNG giới hạn: mọi
 * equipment drop đều add() và không gì tự remove, save phình dần vượt
 * localStorage quota (~5MB) khiến autosave chết im lặng. 500 đủ thoải
 * mái chơi tay (đồ cần giữ đều lock/favorite) mà giữ save < ~2MB.
 */
export const EQUIPMENT_BAG_SOFT_CAP = 500

/**
 * Reward Tinh Hoa khi auto-dissolve vượt cap — bag KHÔNG tự cộng vào
 * material system (tránh circular dependency với GameManager): add()
 * trả rewards, CALLER cộng bag + toast.
 */
export interface AutoDissolveReward {
  materialId: string
  amount: number
}

export class EquipmentBag {
  private instances: EquipmentInstance[] = []

  private readonly membershipGenerationByInstance = new WeakMap<EquipmentInstance, number>()

  private nextMembershipGeneration = 1

  add(instance: EquipmentInstance): AutoDissolveReward[] {
    // Dedupe theo instanceId — save import/hand-edit chứa trùng instanceId
    // từng gây nhân bản trang bị + double stat modifier sau
    // refreshModifiers() (review 2026-08-28). Bản ghi đầu thắng.
    if (this.has(instance.instanceId)) {
      return []
    }

    this.instances.push(instance)
    this.membershipGenerationByInstance.set(instance, this.nextMembershipGeneration)
    this.nextMembershipGeneration += 1

    if (this.instances.length <= EQUIPMENT_BAG_SOFT_CAP) {
      return []
    }

    // Cap mềm (audit 2026-08-31): vượt ngưỡng → tự động Hóa Luyện item
    // "rác" nhất — không trang bị/lock/favorite, phẩm chất thấp trước.
    // Rewards trả về cho CALLER cộng (bag không biết material system —
    // tránh circular dependency với GameManager).
    return this.autoDissolveOverflow()
  }

  /**
   * Auto Hóa Luyện đúng số lượng vượt cap. Candidate KHÔNG được
   * equipped/locked/favorite (đồ người chơi chủ động giữ). Item không
   * có rule chuyển đổi Tinh Hoa (range missing) → KHÔNG
   * dissolve mù — bỏ qua, giữ item (túi được vượt cap trong case bệnh
   * hoạn thay vì mất đồ oan). Amount dùng range.min CỐ ĐỊNH —
   * deterministic; người chơi muốn roll random (range.min..max) phải
   * Hóa Luyện tay qua EquipmentSystem.dissolveInstances().
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
        continue // không có rule chuyển đổi → giữ item, không dissolve mù
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
      }
    }

    this.instances = this.instances.filter((instance) => instance.instanceId !== instanceId)
  }

  /**
   * Capability vòng đời của exact object trong bag. Cùng object remove/add lại
   * nhận generation mới; object thay thế cùng instanceId cũng không thể dùng
   * generation của bản cũ.
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
    return this.instances.filter((instance) => instance.equipped)
  }

  getEquippedInSlot(slot: EquipmentSlot) {
    return this.instances.find((instance) => instance.equipped && instance.slot === slot)
  }

  has(instanceId: string): boolean {
    return this.instances.some((instance) => instance.instanceId === instanceId)
  }
}
