import type { BuildingInstance } from './BuildingInstance'

// Mảng phẳng các building đã xây — 1:1 pattern với EquipmentBag.
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

  // BUILDing spec — building crafting-station (pill_room/formation_altar/
  // talisman_institute/equipment_hall) chỉ xây được 1 lần/loại (khác
  // resource building như Herb Garden có thể xây nhiều instance) —
  // tra theo buildingId để biết "đã xây X chưa" mà không cần giữ
  // instanceId ở nơi gọi (Construction Gate/GameManager).
  getByBuildingId(buildingId: string): BuildingInstance | undefined {
    return this.instances.find((instance) => instance.buildingId === buildingId)
  }

  getAll(): BuildingInstance[] {
    return [...this.instances]
  }

  /**
   * Nạp lại state từ save — bỏ qua toàn bộ state cũ, giống
   * ExplorationManager.restore()/CraftingManager.restore().
   *
   * M1 (ARCH-001) — restored entries are detached copies: the payload is
   * a value, so mutating it afterwards must not leak into live state.
   */
  restore(entries: BuildingInstance[]) {
    this.instances = entries.map((entry) => structuredClone(entry))
  }
}
