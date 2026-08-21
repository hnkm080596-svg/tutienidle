import type { Material } from './Material'
import type { MaterialStack } from './MaterialStack'
import { MAX_STACK_AMOUNT } from '../inventory/StackLimits'


export class MaterialBag {
  private readonly materials =
    new Map<string, MaterialStack>()


  add(
    material: Material,
    amount: number,
  ) {
    if (amount <= 0) {
      return
    }

    const existing =
      this.materials.get(
        material.id,
      )

    if (existing) {
      existing.amount = Math.min(existing.amount + amount, MAX_STACK_AMOUNT)

      return
    }

    this.materials.set(
      material.id,
      {
        material,

        amount: Math.min(amount, MAX_STACK_AMOUNT),
      },
    )
  }


  remove(
    materialId: string,
    amount: number,
  ): boolean {
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
