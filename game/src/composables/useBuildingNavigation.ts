import { useGameManager } from './useGameState'
import { useUiStore, type LeftPanelMode } from '@/stores/ui'
import type { Building } from '@/core/building/Building'

// Building navigation controller (plan Workstream C) — logic điều hướng
// DUY NHẤT dùng chung cho HAI entry point của building thật: hotspot
// trên background và shortcut ring 3 của command wheel. Không entry nào
// tự giữ navigation riêng.
//
// Quy tắc:
// - Chưa xây → mở popover xây dựng (shared popover authority).
// - Đã xây + functionType → mở panel chức năng (leftPanelMode).
// - Đã xây + functionType (bao gồm Linh Tuyền) → LeftPanel.
// - Resource building tương lai không có functionType → popover fallback.
// - CHỈ MỘT BuildingDetailPopover ở GameRoot, điều khiển qua
//   ui.activeBuildingPopoverId.

/** Trình bày building cho hotspot/wheel — suy ra từ state hiện hành. */
export interface BuildingPresentation {
  template: Building | undefined

  isBuilt: boolean

  level: number | null

  isUpgradeable: boolean
}

export function useBuildingNavigation() {
  const gameManager = useGameManager()

  const ui = useUiStore()

  function getBuildingPresentation(buildingId: string): BuildingPresentation {
    const template = gameManager.getBuildingDefinitions().find((entry) => entry.id === buildingId)

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

  function openBuilding(buildingId: string): void {
    const presentation = getBuildingPresentation(buildingId)

    if (!presentation.template) {
      return
    }

    // Chưa xây → popover xây dựng.
    if (!presentation.isBuilt) {
      ui.openBuildingPopover(buildingId)

      return
    }

    // Đã xây + functionType → mở thẳng panel chức năng.
    if (presentation.template.functionType) {
      ui.openLeftPanel(presentation.template.functionType as Exclude<LeftPanelMode, null>)

      return
    }

    // Resource building (Linh Tuyền) → popover thu hoạch/nâng cấp.
    ui.openBuildingPopover(buildingId)
  }

  return {
    openBuilding,

    getBuildingPresentation,
  }
}
