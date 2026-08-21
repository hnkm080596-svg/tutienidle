import type { Pill } from './Pill'
import type { PillStack } from './PillStack'
import { MAX_STACK_AMOUNT } from '../inventory/StackLimits'

export class PillBag {
  private readonly pills = new Map<string, PillStack>()

  add(pill: Pill, amount: number) {
    if (amount <= 0) {
      return
    }

    const existing = this.pills.get(pill.id)

    if (existing) {
      existing.amount = Math.min(existing.amount + amount, MAX_STACK_AMOUNT)

      return
    }

    this.pills.set(pill.id, {
      pill,

      amount: Math.min(amount, MAX_STACK_AMOUNT),
    })
  }

  remove(pillId: string, amount: number): boolean {
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
