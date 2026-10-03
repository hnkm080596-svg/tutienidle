import { MaterialRegistry } from '../material/MaterialRegistry'
import { MaterialBag } from '../material/MaterialBag'
import { BuildingRegistry } from '../building/BuildingRegistry'
import { BuildingManager } from '../building/BuildingManager'
import { BuildingSystem } from '../building/BuildingSystem'
import type { Building } from '../building/Building'
import type { BuildingInstance } from '../building/BuildingInstance'
import { ProductionSystem } from '../production/ProductionSystem'
import type { DecomposeSystem } from '../production/DecomposeSystem'
import { betaEffectiveWorkerCapacity, getWorkerCapacityForLevel, resolveProductionWorkerCapacity } from '../production/WorkerCapacity'
import { buildWorkforceView, type WorkforceView } from '../production/WorkforceView'
import { getRealmTier } from '../realm/RealmTierMap'
import type { PlayerData } from '../player/Player'
import { NotificationQueue } from './NotificationQueue'
import { createBagOverflowEvent } from '../notification/bagOverflow'
import { isCompanionDomainUnlocked } from '../companion/CompanionAvailability'
import {
  betaSurfaceVerdict,
  isScopeHidden,
  BETA_WORKER_LODGE_TABS,
  WORKER_LODGE_TAB_FEATURE,
  type BetaScopeVerdict,
  type BetaWorkerLodgeTabId,
} from '../betaScope'
import { isBetaBuildingSurface } from '../betaScopeSurface'

export interface GameManagerBuildingOpsDeps {
  buildingRegistry: BuildingRegistry
  buildingManager: BuildingManager
  buildingSystem: BuildingSystem
  productionSystem: ProductionSystem
  decomposeSystem: DecomposeSystem
  materialBag: MaterialBag
  materialRegistry: MaterialRegistry
  notifications: NotificationQueue
  // GameManager giu activePlayer nhu field mutable (setActivePlayer) - doc
  // LIVE qua closure thay vi snapshot tai constructor time.
  getActivePlayer: () => PlayerData | undefined
  // Collect-quest + perfection-discovery hook (see GameManager.notifyMaterialGained) -
  // GameManager supplies a closure because the real hook needs
  // questSystem/questRegistry/questManager, states outside building/production scope.
  notifyMaterialGained: (materialId: string, amount: number) => void
}

/**
 * Tach khoi GameManager (2026-09-03, task 2 - GameManager split) - toan bo
 * thao tac Building (xay/nang cap/thu hoach/query) va Production
 * (cycle/upgrade/query), gop 1 file vi Production nho va share worker
 * capacity state voi Building (Chieu Hien Quan). Cung pattern DI voi
 * EquipmentOpsSystem: constructor nhan dependency tuong minh qua object
 * `deps`, KHONG tu import nguoc GameManager.
 */
export class GameManagerBuildingOps {
  constructor(private readonly deps: GameManagerBuildingOpsDeps) {}

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

    for (const instance of added) {
      this.refreshAutoWorkerCapacity(player, instance)
    }
  }

  /**
   * Chieu Hien Quan (chi-hien-quan spec 2026-09-02) - NGUON NHAN CONG
   * DUY NHAT: capacity = 1 + level*2 (getWorkerCapacityForLevel). Goi
   * lai sau moi lan build/upgrade CHQ. gathering_outpost KHONG con cap
   * capacity (nguon cu da go - outpost chi con gate San Xuat + linh mach).
   */
  refreshAutoWorkerCapacity(player: PlayerData, instance: BuildingInstance): void {
    if (instance.buildingId !== 'chi_hien_quan') {
      return
    }

    player.autoWorkerCapacity = getWorkerCapacityForLevel(instance.level)
  }

  /**
   * Chi-hien-quan (2026-09-02) - assignments snapshot tu production states
   * (assignedWorkers persist trong save) - truyen vao tickWorkers/
   * settleOffline de OFFLINE KHOP ONLINE.
   */
  getWorkerAssignments(): Map<string, number> {
    const assignments = new Map<string, number>()

    // BETA SCOPE LOCK v2 sec.4C - manualWorkforce is scope-hidden:
    // persisted assignedWorkers stay inert; the allocator round-robins
    // every site so dormant manual choices cannot starve a live site.
    if (isScopeHidden('manualWorkforce')) {
      return assignments
    }

    for (const state of this.deps.productionSystem.getAllStates()) {
      if (state.assignedWorkers !== undefined) {
        assignments.set(state.siteId, state.assignedWorkers)
      }
    }

    return assignments
  }

  /**
   * Mission D (spec D1) - the ONE workforce read model for the panel:
   * total/reserved/available/requested/effective/idle, all derived from
   * the same split rule the tick uses. The panel renders this verbatim;
   * it does not recompute the split (A7).
   */
  getWorkforceView(): WorkforceView {
    // BETA SCOPE LOCK v2 sec.4C - while manualWorkforce is hidden the
    // view shows the flat auto pool and censors dormant assignments
    // (same precedent as DecomposeSystem.getSettings reporting 0).
    const hidden = isScopeHidden('manualWorkforce')

    return buildWorkforceView(
      betaEffectiveWorkerCapacity(this.deps.getActivePlayer()?.autoWorkerCapacity ?? 0),
      hidden ? 0 : this.deps.decomposeSystem.getSettings().workers,
      hidden
        ? this.deps.productionSystem.getAllStates().map((state) => ({ ...state, assignedWorkers: undefined }))
        : this.deps.productionSystem.getAllStates(),
    )
  }

  /**
   * BETA SCOPE LOCK v2 sec.13 + FINAL POLICY (sec.4C) - the Worker
   * Lodge tab read-model. Each authored tab resolves through the scope
   * authority so the frontend renders verdicts directly and never
   * imports CompanionAvailability to decide which tabs exist. Under
   * beta every tab - nhan_cong included - resolves 'scope-hidden':
   * the lodge is entirely out of scope while automatic production
   * keeps running in the background. manualAssignOffered reports
   * whether the manual split write is live on the workforce tab.
   * Post-beta the companion tabs keep their Tru Co realm gate via
   * ctx.progressionMet - CompanionAvailability feeds the verdict here,
   * never in the frontend.
   */
  getWorkerLodgeSurfaceModel(player: PlayerData): {
    tabs: {
      id: BetaWorkerLodgeTabId
      verdict: BetaScopeVerdict
      manualAssignOffered?: boolean
    }[]
  } {
    return {
      tabs: BETA_WORKER_LODGE_TABS.map((tabId) => {
        const feature = WORKER_LODGE_TAB_FEATURE[tabId]
        const verdict = betaSurfaceVerdict(feature, {
          progressionMet:
            feature === 'companion' ? isCompanionDomainUnlocked(player.realmId) : true,
        })

        if (tabId === 'nhan_cong') {
          return {
            id: tabId,
            verdict,
            manualAssignOffered: verdict === 'available',
          }
        }

        return {
          id: tabId,
          verdict,
        }
      }),
    }
  }

  /**
   * Chi-hien-quan (2026-09-02) - UI phan bo: gan/xoa so slot manual cua
   * 1 site. `count === undefined` = ve AUTO (xoa assignedWorkers).
   * Clamp [0, capacity] phong UI gui sai; khong doi neu site khong ton tai.
   */
  assignWorkers(siteId: string, count: number | undefined): void {
    // BETA SCOPE LOCK v2 sec.13 - manualWorkforce is scope-hidden:
    // automatic allocation is the normal beta path, so the manual write
    // is a no-op (the domain command repeats the check for direct calls).
    if (isScopeHidden('manualWorkforce')) {
      return
    }

    // Clamp bound stays fed by the one split rule - the domain command
    // owns the write itself (D2: no foreign mutation of site state).
    const capacity = resolveProductionWorkerCapacity(
      betaEffectiveWorkerCapacity(this.deps.getActivePlayer()?.autoWorkerCapacity ?? 0),
      this.deps.decomposeSystem.getSettings().workers,
    )

    this.deps.productionSystem.setWorkerAssignment(siteId, count, capacity)
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
    if (upgraded && instance && activePlayer) {
      this.refreshAutoWorkerCapacity(activePlayer, instance)
    }
    return upgraded
  }

  // Linh Tuyen (producesMaterialId) - thu hoach do vao MaterialBag nhu
  // material binh thuong (plan Workstream F); claim() tra amount +
  // materialId, GameManager resolve template va cong bag.
  collectBuilding(instanceId: string, player: PlayerData, currentTime = Date.now() / 1000): number {
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

    const claimed = this.deps.buildingSystem.claim(
      instanceId,
      this.deps.buildingRegistry,
      this.deps.buildingManager,
      currentTime,
      player.realmId,
    )

    if (claimed.amount > 0 && claimed.materialId && this.deps.materialRegistry.has(claimed.materialId)) {
      // 9.8 - bag clamp tai stackLimit; quest chi tinh delivered, tran
      // day toast thay vi mat lang le.
      const overflow = this.deps.materialBag.add(this.deps.materialRegistry.get(claimed.materialId), claimed.amount)

      this.deps.notifyMaterialGained(claimed.materialId, claimed.amount - overflow)

      if (overflow > 0) {
        this.deps.notifications.push(
          createBagOverflowEvent(this.deps.materialRegistry.get(claimed.materialId).name, overflow),
        )
      }
    }

    return claimed.amount
  }

  getBuildingStoredAmount(instanceId: string, currentTime = Date.now() / 1000): number {
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

  isBuildingStorageFull(instanceId: string, currentTime = Date.now() / 1000): boolean {
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

  getProductionViews(nowMs = Date.now()) {
    return this.deps.productionSystem.getSiteDefinitions().map((definition) => {
      const view = this.deps.productionSystem.getSiteView(definition.siteId, nowMs)!

      return {
        definition,

        state: view.state,

        productionSpeedMultiplier: view.productionSpeedMultiplier,

        nextProductionSpeedMultiplier: view.nextProductionSpeedMultiplier,

        cycleRemainingMs: view.cycleRemainingMs,

        cycleTotalMs: view.cycleTotalMs,
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
