import type { Pill } from './Pill'
import type { PillStack } from './PillStack'
import { MAX_STACK_AMOUNT } from '../inventory/StackLimits'

export class PillBag {
  private readonly pills = new Map<string, PillStack>()

  /**
   * Cộng dồn stack, clamp tại MAX_STACK_AMOUNT. Trả về lượng TRÀN bị
   * mất (0 nếu vừa đủ chỗ) — caller đường reward dùng để báo "túi đầy"
   * thay vì mất lặng lẽ.
   */
  add(pill: Pill, amount: number): number {
    if (amount <= 0) {
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
    // Guard: amount <= 0 KHÔNG phải remove hợp lệ — amount âm sẽ CỘNG
    // ngược vào stack (vector nhân bản tiềm ẩn).
    if (amount <= 0) {
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

  get(pillId: string): PillStack | undefined {
    return this.pills.get(pillId)
  }

  getAmount(pillId: string): number {
    return this.pills.get(pillId)?.amount ?? 0
  }

  has(pillId: string, amount: number): boolean {
    return this.getAmount(pillId) >= amount
  }

  getAll(): PillStack[] {
    return Array.from(this.pills.values())
  }

  clear() {
    this.pills.clear()
  }
}
