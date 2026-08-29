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

/**
 * Trạng thái badge nameplate (plan ui-discoverability §3.1) — suy ra THUẦN
 * từ BuildingSystem/ProductionSystem state hiện hành, không có store mới.
 * Ưu tiên: locked > ready > active > upgradeable > default.
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

  /**
   * Badge trạng thái nameplate (plan ui-discoverability §3.1) — ĐỌC THUẦN
   * từ system hiện có qua GameManager facade, không mutate gì:
   * - locked: chưa có instance (canBuild ĐÚNG nguồn sự thật với popover).
   * - ready: resource building (Linh Tuyền) có sản lượng claim được
   *   (getStoredAmount ≥ 1, cùng nguồn với nút thu hoạch popover).
   * - active: đang có job chạy — vòng job DUY NHẤT của building là luyện
   *   đan pill_room (AlchemySystem qua getAlchemyJobs()).
   * - upgradeable: built + chưa max + đủ nguyên liệu nâng KẾ TIẾP
   *   (upgradeCost[level], cùng luật cost index với BuildingSystem.upgrade()).
   */
  function getBuildingStatus(buildingId: string): BuildingBadgeStatus {
    const template = gameManager.getBuildingDefinitions().find((entry) => entry.id === buildingId)

    const instance = gameManager.buildingManager.getByBuildingId(buildingId)

    if (!template || !instance) {
      return 'locked'
    }

    if (template.producesMaterialId) {
      const stored = gameManager.getBuildingStoredAmount(instance.instanceId, Date.now() / 1000)

      if (stored >= 1) {
        return 'ready'
      }
    }

    if (template.id === 'pill_room' && gameManager.getAlchemyJobs().length > 0) {
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

    getBuildingStatus,
  }
}
