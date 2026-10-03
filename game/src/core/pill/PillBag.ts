import type { Pill } from './Pill'
import type { PillStack } from './PillStack'
import { MAX_STACK_AMOUNT } from '../inventory/StackLimits'

export class PillBag {
  private readonly pills = new Map<string, PillStack>()

  /**
   * Cong don stack, clamp tai MAX_STACK_AMOUNT. Tra ve luong TRAN bi
   * mat (0 neu vua du cho) - caller duong reward dung de bao "tui day"
   * thay vi mat lang le.
   */
  add(pill: Pill, amount: number): number {
    // Guard NaN/Infinity (cung vector da harden o MaterialBag): NaN <= 0 la
    // false nen lot qua, cong vao stack se poison amount vinh vien.
    if (!Number.isFinite(amount) || amount <= 0) {
      return 0
    }

    const existing = this.pills.get(pill.id)

    if (existing) {
      const next = Math.min(existing.amount + amount, MAX_STACK_AMOUNT)

      const overflow = existing.amount + amount - next

      existing.amount = next

      return overflow
    }

    const stored = Math.min(amount, MAX_STACK_AMOUNT)

    this.pills.set(pill.id, {
      pill,

      amount: stored,
    })

    return amount - stored
  }

  remove(pillId: string, amount: number): boolean {
    // Guard: amount <= 0 KHONG phai remove hop le - amount am se CONG
    // nguoc vao stack (vector nhan ban tiem an). NaN lot qua guard <= 0
    // nen phai chan Number.isFinite truoc.
    if (!Number.isFinite(amount) || amount <= 0) {
      return false
    }

    const existing = this.pills.get(pillId)

    if (!existing) {
      return false
    }

    if (existing.amount < amount) {
      return false
    }

    existing.amount -= amount

    if (existing.amount <= 0) {
      this.pills.delete(pillId)
    }

    return true
  }

  get(pillId: string): Readonly<PillStack> | undefined {
    const stack = this.pills.get(pillId)

    // Snapshot - xem MaterialBag.get.
    return stack === undefined ? undefined : { ...stack }
  }

  getAmount(pillId: string): number {
    return this.pills.get(pillId)?.amount ?? 0
  }

  has(pillId: string, amount: number): boolean {
    return this.getAmount(pillId) >= amount
  }

  getAll(): Readonly<PillStack>[] {
    return Array.from(this.pills.values(), (stack) => ({ ...stack }))
  }

  clear() {
    this.pills.clear()
  }
}
