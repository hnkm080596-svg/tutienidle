import type { MaterialReceipt } from '../material/MaterialReceipt'
import { MaterialRegistry } from '../material/MaterialRegistry'
import { MaterialBag } from '../material/MaterialBag'
import { BuildingRegistry } from '../building/BuildingRegistry'
import { BuildingManager } from '../building/BuildingManager'
import { BuildingSystem } from '../building/BuildingSystem'
import type { Building } from '../building/Building'
import type { BuildingInstance } from '../building/BuildingInstance'
import { ProductionSystem } from '../production/ProductionSystem'
import { getRealmTier } from '../realm/RealmTierMap'
import type { PlayerData } from '../player/Player'
import { NotificationQueue } from './NotificationQueue'
import { createBagOverflowEvent } from '../notification/bagOverflow'
import { isBetaBuildingSurface } from '../betaScopeSurface'
import type { TimeAuthority } from '../idle/TimeAuthority'

export interface GameManagerBuildingOpsDeps {
  buildingRegistry: BuildingRegistry
  buildingManager: BuildingManager
  buildingSystem: BuildingSystem
  productionSystem: ProductionSystem
  materialBag: MaterialBag
  materialRegistry: MaterialRegistry
  notifications: NotificationQueue
  // GameManager giu activePlayer nhu field mutable (setActivePlayer) - doc
  // LIVE qua closure thay vi snapshot tai constructor time.
  getActivePlayer: () => PlayerData | undefined
  // Collect-quest + perfection-discovery hook (see GameManager.notifyMaterialGained) -
  // GameManager supplies a closure because the real hook needs
  // questSystem/questRegistry/questManager, states outside building/production scope.
  notifyMaterialGained: (materialId: string, amount: number, receipt: MaterialReceipt | null) => void
  // GP-01 - authorized live-time owner for the building accrual clock
  // (seconds domain) and production previews (ms domain). Optional for
  // B1: direct constructor fixtures keep wall-clock behavior;
  // GameManager always injects the shared TimeAuthority.
  time?: TimeAuthority
}

/**
 * Extracted from GameManager (2026-09-03, task 2). This module coordinates
 * building operations and production-site commands at one manager boundary.
 * Dependencies are explicit through `deps`; it does not import GameManager.
 */
export class GameManagerBuildingOps {
  constructor(private readonly deps: GameManagerBuildingOpsDeps) {}

  /**
   * Building accrual runs in SECONDS (lastAccrualAtSec) - the authority's
   * nowSeconds() is the same instant as now()/1000, so the default
   * argument preserves the pre-migration wall-clock contract.
   */
  private nowSeconds(): number {
    return this.deps.time?.nowSeconds() ?? Date.now() / 1000
  }

  private nowMs(): number {
    return this.deps.time?.now() ?? Date.now()
  }

  getBuildingDefinitions(): Building[] {
    return this.deps.buildingRegistry.getAll()
  }

  /**
   * Default-built reconcile (2026-10-03): grant every registered building
   * at level 1 (no build action, no unbuilt state). Runs at character
   * init and after each save restore so old saves gain missing buildings.
   * Scope-hidden buildings are granted too - the scope rule hides their
   * surfaces, it never strips a carried instance.
   */
  reconcileBuildings(player: PlayerData, currentTime: number): void {
    const added = this.deps.buildingSystem.ensureAllBuilt(
      this.deps.buildingRegistry,
      this.deps.buildingManager,
      currentTime,
      player.realmId,
    )

  }

  /**
   * Authoritative upgrade quote for the building header (Mission G Task
   * 36) - the SAME rules upgradeBuilding enforces, read-side only.
   * Mirrors quoteProductionUpgrade.
   */
  quoteBuildingUpgrade(instanceId: string) {
    return this.deps.buildingSystem.quoteUpgrade(
      instanceId,
      this.deps.buildingRegistry,
      this.deps.buildingManager,
      this.deps.materialBag,
      this.deps.getActivePlayer()?.realmId,
    )
  }

  upgradeBuilding(instanceId: string): boolean {
    // BETA SCOPE LOCK - a carried instance of a scope-hidden building is
    // preserved, never upgraded (an upgrade would spend live materials
    // into a dormant record).
    const existing = this.deps.buildingManager.get(instanceId)
    if (existing !== undefined && !isBetaBuildingSurface(existing.buildingId)) {
      return false
    }
    const upgraded = this.deps.buildingSystem.upgrade(
      instanceId,
      this.deps.buildingRegistry,
      this.deps.buildingManager,
      this.deps.materialBag,
      this.deps.getActivePlayer()?.realmId,
    )
    const instance = this.deps.buildingManager.get(instanceId)
    const activePlayer = this.deps.getActivePlayer()
    return upgraded
  }

  // Linh Tuyen (producesMaterialId) - thu hoach do vao MaterialBag nhu
  // material binh thuong (plan Workstream F); claim() tra amount +
  // materialId, GameManager resolve template va cong bag.
  collectBuilding(instanceId: string, player: PlayerData, currentTime = this.nowSeconds(), cycles = false): number {
    return this.deps.materialBag.withAcquisition<number>(() => {
    // Pre-check registry TRUOC khi claim reset moc thoi gian (review
    // 2026-08-28): neu materialId khong resolve duoc ma van claim, san
    // luong bi mat trang (moc da reset, bag khong duoc cong).
    const instance = this.deps.buildingManager.get(instanceId)

    const template = instance ? this.deps.buildingRegistry.get(instance.buildingId) : undefined

    const expectedMaterialId = template
      ? this.deps.buildingSystem.resolveProducesMaterialId(template, player.realmId)
      : undefined

    if (!expectedMaterialId || !this.deps.materialRegistry.has(expectedMaterialId)) {
      return 0
    }

    const claimed = cycles ? this.deps.buildingSystem.claimCycles(instanceId, this.deps.buildingRegistry, this.deps.buildingManager, currentTime, player.realmId) : this.deps.buildingSystem.claim(
      instanceId,
      this.deps.buildingRegistry,
      this.deps.buildingManager,
      currentTime,
      player.realmId,
    )

    if (claimed.amount > 0 && claimed.materialId && this.deps.materialRegistry.has(claimed.materialId)) {
      // 9.8 - bag clamp tai stackLimit; quest chi tinh delivered, tran
      // day toast thay vi mat lang le.
      const { overflow, receipt } = this.deps.materialBag.credit(this.deps.materialRegistry.get(claimed.materialId), claimed.amount)

      this.deps.notifyMaterialGained(claimed.materialId, claimed.amount - overflow, receipt)

      if (overflow > 0) {
        this.deps.notifications.push(
          createBagOverflowEvent(this.deps.materialRegistry.get(claimed.materialId).name, overflow),
        )
      }
    }

    return claimed.amount

    })
  }

  settleAutomaticProduction(player: PlayerData): void {
    for (const definition of this.deps.productionSystem.getSiteDefinitions()) {
      this.deps.productionSystem.setAutoRestart(definition.siteId, true)
    }
    const vein = this.deps.buildingManager.getByBuildingId('gathering_outpost')
    if (vein) this.collectBuilding(vein.instanceId, player, this.nowSeconds(), true)
  }

  getAutomaticProductionView(instanceId: string, currentTime = this.nowSeconds()): { seconds: number; amount: number; progress: number } | undefined {
    const instance = this.deps.buildingManager.get(instanceId)
    const player = this.deps.getActivePlayer()
    if (!instance || !player) return undefined
    const seconds = this.deps.buildingSystem.getCycleSeconds(instance, player.realmId)
    return { seconds, amount: this.getBuildingRatePerMinute(instanceId) * seconds / 60, progress: Math.min(1, Math.max(0, (currentTime - instance.lastCollectedAt) / seconds)) }
  }

  getBuildingStoredAmount(instanceId: string, currentTime = this.nowSeconds()): number {
    const instance = this.deps.buildingManager.get(instanceId)

    if (!instance) {
      return 0
    }

    return this.deps.buildingSystem.getStoredAmount(
      instance,
      this.deps.buildingRegistry.get(instance.buildingId),
      currentTime,
      this.deps.getActivePlayer()?.realmId,
    )
  }

  getBuildingCapacity(instanceId: string): number {
    const instance = this.deps.buildingManager.get(instanceId)

    if (!instance) {
      return 0
    }

    return this.deps.buildingSystem.getCapacity(
      instance,
      this.deps.buildingRegistry.get(instance.buildingId),
      this.deps.getActivePlayer()?.realmId,
    )
  }

  getBuildingRatePerMinute(instanceId: string): number {
    const instance = this.deps.buildingManager.get(instanceId)

    if (!instance) {
      return 0
    }

    return this.deps.buildingSystem.getRatePerMinute(
      instance,
      this.deps.buildingRegistry.get(instance.buildingId),
      this.deps.getActivePlayer()?.realmId,
    )
  }

  isBuildingStorageFull(instanceId: string, currentTime = this.nowSeconds()): boolean {
    const instance = this.deps.buildingManager.get(instanceId)

    if (!instance) {
      return false
    }

    return this.deps.buildingSystem.isStorageFull(
      instance,
      this.deps.buildingRegistry.get(instance.buildingId),
      currentTime,
      this.deps.getActivePlayer()?.realmId,
    )
  }

  // =========================
  // PRODUCTION (2026-08-25 - Lam/Quang/Dong Thien, plan sec4/sec9)
  // =========================

  getProductionViews(nowMs = this.nowMs()) {
    return this.deps.productionSystem.getSiteDefinitions().map((definition) => {
      const view = this.deps.productionSystem.getSiteView(definition.siteId, nowMs)!

      return {
        definition,

        state: view.state,

        productionSpeedMultiplier: view.productionSpeedMultiplier,

        nextProductionSpeedMultiplier: view.nextProductionSpeedMultiplier,

        cycleRemainingMs: view.cycleRemainingMs,

        cycleTotalMs: view.cycleTotalMs,
        baseOutputPerSecond: view.baseOutputPerSecond,
      }
    })
  }

  setProductionAutoRestart(siteId: string, enabled: boolean): boolean {
    return this.deps.productionSystem.setAutoRestart(siteId, enabled)
  }

  /** Nang level nguon - cost Go + Linh Thach (sink chinh cua Lam, sec5.2). */
  upgradeProductionSite(siteId: string, player: PlayerData): boolean {
    // Plan Workstream F - Linh Thach check/tru truc tiep tren MaterialBag.
    return this.deps.productionSystem.upgradeSite(siteId, this.deps.materialBag, getRealmTier(player.realmId))
  }

  /**
   * R9 (AR-23) - authoritative upgrade quote for the panel (replaces the
   * duplicated gate/cost logic in ProductionPanel.vue).
   */
  quoteProductionUpgrade(siteId: string, player: PlayerData) {
    return this.deps.productionSystem.quoteSiteUpgrade(
      siteId,
      this.deps.materialBag,
      getRealmTier(player.realmId),
    )
  }

  getProductionUpgradeCost(siteId: string) {
    return this.deps.productionSystem.getSiteDefinition(siteId)?.upgradeCosts
  }
}
