import type { BuildingInstance } from './BuildingInstance'

// Mang phang cac building da xay - 1:1 pattern voi EquipmentBag.
export class BuildingManager {
  /**
   * GP-01 - authorized live-time owner for the future-stamp clamp.
   * GameManager injects `() => time.now()`; direct-construction
   * fixtures fall back to the wall clock, preserving pre-migration
   * behavior.
   */
  constructor(private readonly deps: { now?: () => number } = {}) {}

  /** lastCollectedAt is a SECONDS-domain stamp - see restore() below. */
  private nowSeconds(): number {
    return (this.deps.now?.() ?? Date.now()) / 1000
  }

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
  // instanceId o noi goi (vi du GameManager).
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
    // lastCollectedAt is a SECONDS-domain stamp - BuildingSystem accrual
    // math subtracts it from the injected field clock's seconds - so the
    // bound compares seconds to seconds (r13-INT-01).
    const nowSeconds = this.nowSeconds()
    this.instances = entries.map((entry) => {
      const instance = structuredClone(entry)
      // r12-AUT: a crafted FUTURE lastCollectedAt freezes production
      // accrual (elapsed <= 0 forever) - clamp to now, same class as
      // the lastCheckedMs/lastDailyResetAtMs anchors.
      if (Number.isFinite(instance.lastCollectedAt) && instance.lastCollectedAt > nowSeconds) {
        instance.lastCollectedAt = nowSeconds
      }
      return instance
    })
  }
}
