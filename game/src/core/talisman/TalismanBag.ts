import type { Talisman } from './Talisman'
import type { TalismanStack } from './TalismanStack'
import { MAX_STACK_AMOUNT } from '../inventory/StackLimits'

export class TalismanBag {
  private readonly talismans = new Map<string, TalismanStack>()

  add(talisman: Talisman, amount: number) {
    if (amount <= 0) {
      return
    }

    const existing = this.talismans.get(talisman.id)

    if (existing) {
      existing.amount = Math.min(existing.amount + amount, MAX_STACK_AMOUNT)

      return
    }

    this.talismans.set(talisman.id, {
      talisman,

      amount: Math.min(amount, MAX_STACK_AMOUNT),
    })
  }

  remove(talismanId: string, amount: number): boolean {
    const existing = this.talismans.get(talismanId)

    if (!existing) {
      return false
    }

    if (existing.amount < amount) {
      return false
    }

    existing.amount -= amount

    if (existing.amount <= 0) {
      this.talismans.delete(talismanId)
    }

    return true
  }

  get(talismanId: string): TalismanStack | undefined {
    return this.talismans.get(talismanId)
  }

  getAmount(talismanId: string): number {
    return this.talismans.get(talismanId)?.amount ?? 0
  }

  has(talismanId: string, amount: number): boolean {
    return this.getAmount(talismanId) >= amount
  }

  getAll(): TalismanStack[] {
    return Array.from(this.talismans.values())
  }

  clear() {
    this.talismans.clear()
  }
}
