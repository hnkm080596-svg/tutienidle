import { useGameManager } from './useGameState'
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

  const ui = useUiStore()

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

    if (instance.level < template.maxLevel) {
      const cost = template.upgradeCost[instance.level] ?? []

      if (cost.every((entry) => gameManager.materialBag.has(entry.materialId, entry.amount))) {
        return 'upgradeable'
      }
    }

    return 'default'
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
      ui.openLeftPanel(presentation.template.functionType as Exclude<LeftPanelMode, null>)
    }
  }

  return {
    openBuilding,

    getBuildingPresentation,

    getBuildingStatus,
  }
}
