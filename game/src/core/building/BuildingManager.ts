import type { BuildingInstance } from './BuildingInstance'

// Mang phang cac building da xay - 1:1 pattern voi EquipmentBag.
export class BuildingManager {
  private instances: BuildingInstance[] = []

  add(instance: BuildingInstance) {
    this.instances.push(instance)
  }

  remove(instanceId: string) {
    this.instances = this.instances.filter((instance) => instance.instanceId !== instanceId)
  }

  get(instanceId: string): BuildingInstance | undefined {
    return this.instances.find((instance) => instance.instanceId === instanceId)
  }

  // BUILDing spec - building crafting-station (pill_room/formation_altar/
  // talisman_institute/equipment_hall) chi xay duoc 1 lan/loai (khac
  // resource building nhu Herb Garden co the xay nhieu instance) -
  // tra theo buildingId de biet "da xay X chua" ma khong can giu
  // instanceId o noi goi (Construction Gate/GameManager).
  getByBuildingId(buildingId: string): BuildingInstance | undefined {
    return this.instances.find((instance) => instance.buildingId === buildingId)
  }

  getAll(): BuildingInstance[] {
    return [...this.instances]
  }

  /**
   * Nap lai state tu save - bo qua toan bo state cu, giong
   * ExplorationManager.restore()/CraftingManager.restore().
   *
   * M1 (ARCH-001) - restored entries are detached copies: the payload is
   * a value, so mutating it afterwards must not leak into live state.
   */
  restore(entries: BuildingInstance[]) {
    this.instances = entries.map((entry) => structuredClone(entry))
  }
}
