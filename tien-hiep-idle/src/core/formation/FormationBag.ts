import type { Formation } from './Formation'
import type { FormationStack } from './FormationStack'
import { MAX_STACK_AMOUNT } from '../inventory/StackLimits'

export class FormationBag {
  private readonly formations = new Map<string, FormationStack>()

  add(formation: Formation, amount: number) {
    if (amount <= 0) {
      return
    }

    const existing = this.formations.get(formation.id)

    if (existing) {
      existing.amount = Math.min(existing.amount + amount, MAX_STACK_AMOUNT)

      return
    }

    this.formations.set(formation.id, {
      formation,

      amount: Math.min(amount, MAX_STACK_AMOUNT),
    })
  }

  remove(formationId: string, amount: number): boolean {
    const existing = this.formations.get(formationId)

    if (!existing) {
      return false
    }

    if (existing.amount < amount) {
      return false
    }

    existing.amount -= amount

    if (existing.amount <= 0) {
      this.formations.delete(formationId)
    }

    return true
  }

  get(formationId: string): FormationStack | undefined {
    return this.formations.get(formationId)
  }

  getAmount(formationId: string): number {
    return this.formations.get(formationId)?.amount ?? 0
  }

  has(formationId: string, amount: number): boolean {
    return this.getAmount(formationId) >= amount
  }

  getAll(): FormationStack[] {
    return Array.from(this.formations.values())
  }

  clear() {
    this.formations.clear()
  }
}
