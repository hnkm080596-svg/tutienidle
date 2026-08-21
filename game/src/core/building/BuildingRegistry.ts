import type { Building } from './Building'

export class BuildingRegistry {
  private readonly buildings = new Map<string, Building>()

  register(building: Building): void {
    if (this.buildings.has(building.id)) {
      throw new Error(`Building already registered: ${building.id}`)
    }

    this.buildings.set(building.id, building)
  }

  get(buildingId: string): Building {
    const building = this.buildings.get(buildingId)

    if (!building) {
      throw new Error(`Building not found: ${buildingId}`)
    }

    return building
  }

  has(buildingId: string): boolean {
    return this.buildings.has(buildingId)
  }

  getAll(): Building[] {
    return Array.from(this.buildings.values())
  }
}
