import { useGameManager } from './useGameState'
import { useUiStore, type LeftPanelMode } from '@/stores/ui'
import { isBetaBuildingSurface } from '@/core/betaScopeSurface'
import type { Building } from '@/core/building/Building'

// Building navigation controller (plan Workstream C) - logic dieu huong
// DUY NHAT dung chung cho HAI entry point cua building that: hotspot
// tren background va shortcut ring 3 cua command wheel. Khong entry nao
// tu giu navigation rieng.
//
// Quy tac:
// - Chua xay -> mo popover xay dung (shared popover authority).
// - Da xay + functionType -> mo panel chuc nang (leftPanelMode).
// - Da xay + functionType (bao gom Linh Tuyen) -> LeftPanel.
// - Resource building tuong lai khong co functionType -> popover fallback.
// - CHI MOT BuildingDetailPopover o GameRoot, dieu khien qua
//   ui.activeBuildingPopoverId.

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
   * - locked: chua co instance (canBuild DUNG nguon su that voi popover).
   * - ready: resource building (Linh Tuyen) co san luong claim duoc
   *   (getStoredAmount >= 1, cung nguon voi nut thu hoach popover).
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
      const stored = gameManager.buildingOps.getBuildingStoredAmount(instance.instanceId, Date.now() / 1000)

      if (stored >= 1) {
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
    // closed - a scope-hidden building (chi_hien_quan) opens no popover
    // and no function panel from ANY caller (hotspot, wheel, popover
    // deep-link).
    if (!isBetaBuildingSurface(buildingId)) {
      return
    }

    const presentation = getBuildingPresentation(buildingId)

    if (!presentation.template) {
      return
    }

    // Chua xay -> popover xay dung.
    if (!presentation.isBuilt) {
      ui.openBuildingPopover(buildingId)

      return
    }

    // Da xay + functionType -> mo thang panel chuc nang.
    if (presentation.template.functionType) {
      ui.openLeftPanel(presentation.template.functionType as Exclude<LeftPanelMode, null>)

      return
    }

    // Resource building (Linh Tuyen) -> popover thu hoach/nang cap.
    ui.openBuildingPopover(buildingId)
  }

  return {
    openBuilding,

    getBuildingPresentation,

    getBuildingStatus,
  }
}
