import type { EquipmentSet } from './EquipmentSet'

export class EquipmentSetRegistry {
  private readonly sets = new Map<string, EquipmentSet>()

  register(set: EquipmentSet): void {
    if (this.sets.has(set.id)) {
      throw new Error(`EquipmentSet already registered: ${set.id}`)
    }

    this.sets.set(set.id, set)
  }

  get(setId: string): EquipmentSet {
    const set = this.sets.get(setId)

    if (!set) {
      throw new Error(`EquipmentSet not found: ${setId}`)
    }

    return set
  }

  has(setId: string): boolean {
    return this.sets.has(setId)
  }

  getAll(): EquipmentSet[] {
    return Array.from(this.sets.values())
  }
}
