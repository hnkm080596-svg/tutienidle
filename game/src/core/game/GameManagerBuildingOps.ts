import { MaterialRegistry } from '../material/MaterialRegistry'
import { MaterialBag } from '../material/MaterialBag'
import { BuildingRegistry } from '../building/BuildingRegistry'
import { BuildingManager } from '../building/BuildingManager'
import { BuildingSystem } from '../building/BuildingSystem'
import type { Building } from '../building/Building'
import type { BuildingInstance } from '../building/BuildingInstance'
import { ProductionSystem } from '../production/ProductionSystem'
import { getWorkerCapacityForLevel } from '../production/WorkerCapacity'
import { getRealmTier } from '../realm/RealmTierMap'
import type { PlayerData } from '../player/Player'
import { NotificationQueue } from './NotificationQueue'

export interface GameManagerBuildingOpsDeps {
  buildingRegistry: BuildingRegistry
  buildingManager: BuildingManager
  buildingSystem: BuildingSystem
  productionSystem: ProductionSystem
  materialBag: MaterialBag
  materialRegistry: MaterialRegistry
  notifications: NotificationQueue
  // GameManager giữ activePlayer như field mutable (setActivePlayer) — đọc
  // LIVE qua closure thay vì snapshot tại constructor time.
  getActivePlayer: () => PlayerData | undefined
  // Collect-quest hook (xem GameManager.notifyQuestMaterialGained) — GameManager
  // cung cấp closure vì hook thật cần questSystem/questRegistry/questManager,
  // những state không thuộc phạm vi building/production.
  notifyQuestMaterialGained: (materialId: string, amount: number) => void
}

/**
 * Tách khỏi GameManager (2026-09-03, task 2 — GameManager split) — toàn bộ
 * thao tác Building (xây/nâng cấp/thu hoạch/query) và Production
 * (cycle/upgrade/query), gộp 1 file vì Production nhỏ và share worker
 * capacity state với Building (Chiêu Hiền Quán). Cùng pattern DI với
 * EquipmentOpsSystem: constructor nhận dependency tường minh qua object
 * `deps`, KHÔNG tự import ngược GameManager.
 */
export class GameManagerBuildingOps {
  constructor(private readonly deps: GameManagerBuildingOpsDeps) {}

  getBuildingDefinitions(): Building[] {
    return this.deps.buildingRegistry.getAll()
  }

  /** Gate UI xây mới — delegate BuildingSystem.canBuild (§ popover). */
  canBuildBuilding(buildingId: string, player: PlayerData): boolean {
    return this.deps.buildingSystem.canBuild(
      buildingId,
      this.deps.buildingRegistry,
      this.deps.buildingManager,
      player,
      this.deps.materialBag,
    )
  }

  buildBuilding(buildingId: string, player: PlayerData, currentTime = Date.now() / 1000) {
    const instance = this.deps.buildingSystem.build(
      buildingId,
      this.deps.buildingRegistry,
      this.deps.buildingManager,
      player,
      this.deps.materialBag,
      currentTime,
    )

    // Fix (review 2026-08-26) — build thất bại trước đây IM LẶNG (null
    // không ai đọc): giờ push toast lý do cụ thể để người chơi biết phải
    // làm gì tiếp (thiếu nguyên liệu/cảnh giới...).
    if (!instance) {
      const check = this.deps.buildingSystem.canBuildDetailed(
        buildingId,

        this.deps.buildingRegistry,

        this.deps.buildingManager,

        player,

        this.deps.materialBag,
      )

      this.deps.notifications.push({
        kind: 'error',

        message: `Xây ${this.buildingName(buildingId)} thất bại (${check.reason ?? 'unknown'})`,
      })
    } else {
      this.refreshAutoWorkerCapacity(player, instance)
      this.deps.notifications.push({
        kind: 'upgrade',

        message: `Đã xây ${this.buildingName(buildingId)} · Cấp 1`,
      })
    }

    return instance
  }

  /** Tên building hiển thị cho toast — fallback id khi registry thiếu. */
  private buildingName(buildingId: string): string {
    try {
      return this.deps.buildingRegistry.get(buildingId).name
    } catch {
      return buildingId
    }
  }

  /**
   * Chiêu Hiền Quán (chi-hien-quan spec 2026-09-02) - NGUỒN NHÂN CÔNG
   * DUY NHẤT: capacity = 1 + level*2 (getWorkerCapacityForLevel). Gọi
   * lại sau mỗi lần build/upgrade CHQ. gathering_outpost KHÔNG còn cấp
   * capacity (nguồn cũ đã gỡ — outpost chỉ còn gate Sản Xuất + linh mạch).
   */
  refreshAutoWorkerCapacity(player: PlayerData, instance: BuildingInstance): void {
    if (instance.buildingId !== 'chi_hien_quan') {
      return
    }

    player.autoWorkerCapacity = getWorkerCapacityForLevel(instance.level)
  }

  /**
   * Chi-hien-quan (2026-09-02) — assignments snapshot từ production states
   * (assignedWorkers persist trong save) — truyền vào tickWorkers/
   * settleOffline để OFFLINE KHỚP ONLINE.
   */
  getWorkerAssignments(): Map<string, number> {
    const assignments = new Map<string, number>()

    for (const state of this.deps.productionSystem.getAllStates()) {
      if (state.assignedWorkers !== undefined) {
        assignments.set(state.siteId, state.assignedWorkers)
      }
    }

    return assignments
  }

  /**
   * Chi-hien-quan (2026-09-02) — UI phân bổ: gán/xóa số slot manual của
   * 1 site. `count === undefined` = về AUTO (xóa assignedWorkers).
   * Clamp [0, capacity] phòng UI gửi sai; không đổi nếu site không tồn tại.
   */
  assignWorkers(siteId: string, count: number | undefined): void {
    const state = this.deps.productionSystem.getState(siteId)

    if (!state) {
      return
    }

    if (count === undefined) {
      delete state.assignedWorkers

      return
    }

    const capacity = this.deps.getActivePlayer()?.autoWorkerCapacity ?? 0

    // NaN (UI path lỗi) coi như 0 — không để assignedWorkers = NaN
    // phá regex phân bổ tickWorkers.
    const safeCount = Number.isFinite(count) ? count : 0

    state.assignedWorkers = Math.max(0, Math.min(Math.floor(safeCount), capacity))
  }

  upgradeBuilding(instanceId: string): boolean {
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

  // Linh Tuyền (producesMaterialId) — thu hoạch đổ vào MaterialBag như
  // material bình thường (plan Workstream F); claim() trả amount +
  // materialId, GameManager resolve template và cộng bag.
  collectBuilding(instanceId: string, player: PlayerData, currentTime = Date.now() / 1000): number {
    // Pre-check registry TRƯỚC khi claim reset mốc thời gian (review
    // 2026-08-28): nếu materialId không resolve được mà vẫn claim, sản
    // lượng bị mất trắng (mốc đã reset, bag không được cộng).
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
      this.deps.materialBag.add(this.deps.materialRegistry.get(claimed.materialId), claimed.amount)

      this.deps.notifyQuestMaterialGained(claimed.materialId, claimed.amount)
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

  // =========================
  // PRODUCTION (2026-08-25 — Lâm/Quáng/Động Thiên, plan §4/§9)
  // =========================

  getProductionViews(nowMs = Date.now()) {
    return this.deps.productionSystem.getSiteDefinitions().map((definition) => {
      const view = this.deps.productionSystem.getSiteView(definition.siteId, nowMs)!

      return {
        definition,

        state: view.state,

        speedMultiplier: view.speedMultiplier,

        nextSpeedMultiplier: view.nextSpeedMultiplier,

        cycleRemainingMs: view.cycleRemainingMs,

        cycleTotalMs: view.cycleTotalMs,
      }
    })
  }

  /** Bắt đầu cycle tại cảnh giới HIỆN TẠI của player (snapshot §4.1). */
  startProductionCycle(siteId: string, player: PlayerData): boolean {
    return this.deps.productionSystem.startCycle(siteId, player.realmId, Date.now())
  }

  setProductionAutoRestart(siteId: string, enabled: boolean): boolean {
    return this.deps.productionSystem.setAutoRestart(siteId, enabled)
  }

  /** Nâng level nguồn — cost Gỗ + Linh Thạch (sink chính của Lâm, §5.2). */
  upgradeProductionSite(siteId: string, player: PlayerData): boolean {
    // Plan Workstream F — Linh Thạch check/trừ trực tiếp trên MaterialBag.
    return this.deps.productionSystem.upgradeSite(siteId, this.deps.materialBag, getRealmTier(player.realmId))
  }

  getProductionUpgradeCost(siteId: string) {
    return this.deps.productionSystem.getSiteDefinition(siteId)?.upgradeCosts
  }
}
