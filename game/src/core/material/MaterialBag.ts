import type { Material } from './Material'
import type { MaterialStack } from './MaterialStack'
import { MAX_STACK_AMOUNT } from '../inventory/StackLimits'


export class MaterialBag {
  private readonly materials =
    new Map<string, MaterialStack>()


  /**
   * Cộng dồn stack, clamp tại stackLimit (mặc định MAX_STACK_AMOUNT).
   * Trả về lượng TRÀN bị mất (0 nếu vừa đủ chỗ) — caller đường reward
   * dùng để báo "túi đầy" thay vì mất lặng lẽ.
   */
  add(
    material: Material,
    amount: number,
  ): number {
    if (amount <= 0) {
      return 0
    }

    const limit = material.stackLimit ?? MAX_STACK_AMOUNT

    const existing =
      this.materials.get(
        material.id,
      )

    if (existing) {
      const next = Math.min(existing.amount + amount, limit)

      const overflow = existing.amount + amount - next

      existing.amount = next

      return overflow
    }

    const stored = Math.min(amount, limit)

    this.materials.set(
      material.id,
      {
        material,

        amount: stored,
      },
    )

    return amount - stored
  }


  remove(
    materialId: string,
    amount: number,
  ): boolean {
    // Guard: amount <= 0 KHÔNG phải remove hợp lệ — amount âm sẽ CỘNG
    // ngược vào stack (vector nhân bản tiềm ẩn).
    if (amount <= 0) {
      return false
    }

    const existing =
      this.materials.get(
        materialId,
      )

    if (!existing) {
      return false
    }

    if (
      existing.amount < amount
    ) {
      return false
    }

    existing.amount -= amount

    if (
      existing.amount <= 0
    ) {
      this.materials.delete(
        materialId,
      )
    }

    return true
  }


  get(
    materialId: string,
  ): MaterialStack | undefined {
    return this.materials.get(
      materialId,
    )
  }


  getAmount(
    materialId: string,
  ): number {
    return (
      this.materials.get(
        materialId,
      )?.amount ?? 0
    )
  }


  has(
    materialId: string,
    amount: number,
  ): boolean {
    return (
      this.getAmount(
        materialId,
      ) >= amount
    )
  }


  getAll(): MaterialStack[] {
    return Array.from(
      this.materials.values(),
    )
  }


  clear() {
    this.materials.clear()
  }
}
