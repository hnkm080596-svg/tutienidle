import { useGameManager, useStateVersion } from './useGameState'
import { useUiStore, type LeftPanelMode } from '@/stores/ui'
import { isBetaBuildingSurface } from '@/core/betaScopeSurface'
import type { Building } from '@/core/building/Building'

// Building navigation controller (plan Workstream C) - logic dieu huong
// DUY NHAT dung chung cho HAI entry point cua building that: hotspot
// tren background va shortcut ring 3 cua command wheel. Khong entry nao
// tu giu navigation rieng.
//
// Quy tac (post default-built 2026-10-03): moi building luon co instance
// lv1 - khong con trang thai chua xay, khong con popover xay dung.
// - functionType -> mo panel chuc nang (leftPanelMode).
// - Building khong functionType -> khong mo gi (hien chua co loai nao).

/** Trinh bay building cho hotspot/wheel - suy ra tu state hien hanh. */
export interface BuildingPresentation {
  template: Building | undefined

  isBuilt: boolean

  level: number | null

  isUpgradeable: boolean
}

/**
 * Trang thai badge nameplate (plan ui-discoverability sec3.1) - suy ra THUAN
 * tu BuildingSystem/ProductionSystem state hien hanh, khong co store moi.
 * Uu tien: locked > ready > active > upgradeable > default.
 */
export type BuildingBadgeStatus =
  | 'locked'
  | 'upgradeable'
  | 'active'
  | 'ready'
  | 'default'

export function useBuildingNavigation() {
  const gameManager = useGameManager()

  const { bumpState } = useStateVersion()

  function getBuildingPresentation(buildingId: string): BuildingPresentation {
    const template = gameManager.buildingOps.getBuildingDefinitions().find((entry) => entry.id === buildingId)

    const instance = gameManager.buildingManager.getByBuildingId(buildingId)

    const isUpgradeable = Boolean(
      template &&
      instance &&
      instance.level < template.maxLevel,
    )

    return {
      template,

      isBuilt: instance !== undefined,

      level: instance?.level ?? null,

      isUpgradeable,
    }
  }

  /**
   * Badge trang thai nameplate (plan ui-discoverability sec3.1) - DOC THUAN
   * tu system hien co qua GameManager facade, khong mutate gi:
   * - locked: chua co instance (can xay ra duy nhat voi save cu chua
   *   reconcile / id khong dang ky).
   * - ready: resource building (Linh Tuyen) day kho san luong -
   *   BuildingSystem.isStorageFull (cham tran tich luy thuc te).
   * - active: dang co job chay - vong job DUY NHAT cua building la luyen
   *   dan pill_room (AlchemySystem qua getAlchemyJobs()).
   * - upgradeable: built + chua max + du nguyen lieu nang KE TIEP
   *   (upgradeCost[level], cung luat cost index voi BuildingSystem.upgrade()).
   *   Doc qua quoteBuildingUpgrade - cung authority voi nut Nang cap:
   *   hasNextLevel + meetsRealmRequirement + canAfford, nen badge chi
   *   sang khi nut thuc su an duoc (realm-gated thi an han).
   */
  function getBuildingStatus(buildingId: string): BuildingBadgeStatus {
    const template = gameManager.buildingOps.getBuildingDefinitions().find((entry) => entry.id === buildingId)

    const instance = gameManager.buildingManager.getByBuildingId(buildingId)

    if (!template || !instance) {
      return 'locked'
    }

    if (template.producesMaterialId) {
      if (gameManager.buildingOps.isBuildingStorageFull(instance.instanceId, Date.now() / 1000)) {
        return 'ready'
      }
    }

    if (template.id === 'pill_room' && gameManager.alchemyOps.getAlchemyJobs().length > 0) {
      return 'active'
    }

    const quote = gameManager.buildingOps.quoteBuildingUpgrade(instance.instanceId)

    if (quote && quote.hasNextLevel && quote.meetsRealmRequirement && quote.canAfford) {
      return 'upgradeable'
    }

    return 'default'
  }

  /**
   * Write path DUY NHAT cho nang cap cong trinh tu moi entry point
   * (chip tren plaque ngoai dong phu + nut trong panel): predicate gioi
   * han la quoteBuildingUpgrade - cung 3 co upgrade() ap, khong re-derive
   * cost/dieu kien o day. Tra ve false khi khong con upgradeable.
   */
  function upgradeBuilding(buildingId: string): boolean {
    const instance = gameManager.buildingManager.getByBuildingId(buildingId)

    if (!instance) {
      return false
    }

    const quote = gameManager.buildingOps.quoteBuildingUpgrade(instance.instanceId)

    if (!quote || !quote.hasNextLevel || !quote.meetsRealmRequirement || !quote.canAfford) {
      return false
    }

    if (!gameManager.buildingOps.upgradeBuilding(instance.instanceId)) {
      return false
    }

    bumpState()

    return true
  }

  function openBuilding(buildingId: string): void {
    // BETA SCOPE LOCK v2 (Phase-6): the single navigation funnel fails
    // closed - a scope-hidden building (chi_hien_quan) opens no
    // function panel from ANY caller (hotspot, wheel, deep-link).
    if (!isBetaBuildingSurface(buildingId)) {
      return
    }

    const presentation = getBuildingPresentation(buildingId)

    if (!presentation.template) {
      return
    }

    // Da xay + functionType -> mo thang panel chuc nang.
    if (presentation.template.functionType) {
      useUiStore().openLeftPanel(presentation.template.functionType as Exclude<LeftPanelMode, null>)
    }
  }

  return {
    openBuilding,

    upgradeBuilding,

    getBuildingPresentation,

    getBuildingStatus,
  }
}
