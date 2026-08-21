import type { Equipment } from './Equipment'

export class EquipmentRegistry {
  private readonly equipment = new Map<string, Equipment>()

  register(equipment: Equipment): void {
    if (this.equipment.has(equipment.id)) {
      throw new Error(`Equipment already registered: ${equipment.id}`)
    }

    this.equipment.set(equipment.id, equipment)
  }

  get(equipmentId: string): Equipment {
    const equipment = this.equipment.get(equipmentId)

    if (!equipment) {
      throw new Error(`Equipment not found: ${equipmentId}`)
    }

    return equipment
  }

  has(equipmentId: string): boolean {
    return this.equipment.has(equipmentId)
  }

  getAll(): Equipment[] {
    return Array.from(this.equipment.values())
  }
}
