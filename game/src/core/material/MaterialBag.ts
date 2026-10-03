import type { Material } from './Material'
import type { MaterialStack } from './MaterialStack'
import { MAX_STACK_AMOUNT } from '../inventory/StackLimits'


export class MaterialBag {
  private readonly materials =
    new Map<string, MaterialStack>()


  /**
   * Cong don stack, clamp tai stackLimit (mac dinh MAX_STACK_AMOUNT).
   * Tra ve luong TRAN bi mat (0 neu vua du cho) - caller duong reward
   * dung de bao "tui day" thay vi mat lang le.
   */
  add(
    material: Material,
    amount: number,
  ): number {
    // Guard NaN/Infinity: `NaN <= 0` la false nen check cu lot NaN -
    // NaN cong vao stack se poison vinh vien amount do (moi has() tra
    // false, UI hien NaN). amount phai la so huu han duong.
    if (!Number.isFinite(amount) || amount <= 0) {
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

  /**
   * R9 (AR-22) - preflight how much of `amount` fits WITHOUT mutating.
   * The exchange owner (e.g. VendorSystem) checks this BEFORE any
   * debit/credit so a failed compound trade leaves all balances
   * unchanged (A9: failed exchanges preserve all involved balances).
   */
  canAcceptAmount(
    material: Material,
    amount: number,
  ): number {
    if (!Number.isFinite(amount) || amount <= 0) {
      return 0
    }

    const limit = material.stackLimit ?? MAX_STACK_AMOUNT

    const existing =
      this.materials.get(
        material.id,
      )

    if (!existing) {
      return Math.min(amount, limit)
    }

    return Math.max(0, Math.min(amount, limit - existing.amount))
  }


  remove(
    materialId: string,
    amount: number,
  ): boolean {
    // Guard: amount <= 0 KHONG phai remove hop le - amount am se CONG
    // nguoc vao stack (vector nhan ban tiem an). NaN cung bi chan:
    // `existing.amount < NaN` la false nen NaN se lot qua va tru NaN
    // khoi stack (poison amount).
    if (!Number.isFinite(amount) || amount <= 0) {
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
  ): Readonly<MaterialStack> | undefined {
    const stack = this.materials.get(
      materialId,
    )

    // Snapshot - the live stack in the map is internal state, callers only read.
    return stack === undefined
      ? undefined
      : { ...stack }
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


  getAll(): Readonly<MaterialStack>[] {
    return Array.from(
      this.materials.values(),
      (stack) => ({ ...stack }),
    )
  }


  clear() {
    this.materials.clear()
  }
}
