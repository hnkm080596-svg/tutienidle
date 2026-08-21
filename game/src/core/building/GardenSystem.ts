import type { Building } from './Building'
import type { BuildingInstance } from './BuildingInstance'
import { GARDEN_PLOT_COUNT } from './GardenPlot'
import type { MaterialBag } from '../material/MaterialBag'
import type { MaterialRegistry } from '../material/MaterialRegistry'

export type GardenPlotStatus = 'locked' | 'empty' | 'growing' | 'ready'

export interface GardenPlotView {
  index: number

  status: GardenPlotStatus

  // Chỉ có ý nghĩa khi status === 'growing'.
  remainingSeconds: number
}

/**
 * Linh Thảo Viên rework — 9 ô vuông, mỗi ô tự lớn RIÊNG (gieo → chờ
 * gardenGrowSeconds → thu hoạch), tách biệt hoàn toàn khỏi cơ chế
 * producesMaterialId/processingRecipeId cũ (xem BuildingSystem.ts —
 * 3 kiểu building loại trừ nhau qua field nào được set trên template).
 * Số ô đã MỞ KHOÁ = instance.level (mỗi level +1 ô, đúng yêu cầu) —
 * KHÔNG cần BuildingSystem.upgrade() biết gì thêm, chỉ đọc lại level
 * sẵn có.
 */
export class GardenSystem {
  getPlots(instance: BuildingInstance, template: Building, currentTime: number): GardenPlotView[] {
    const growSeconds = template.gardenGrowSeconds ?? 0
    const plots = instance.gardenPlots ?? []

    return Array.from({ length: GARDEN_PLOT_COUNT }, (_, index) => {
      if (index >= instance.level) {
        return { index, status: 'locked' as const, remainingSeconds: 0 }
      }

      const plantedAt = plots[index]?.plantedAt

      if (plantedAt === undefined) {
        return { index, status: 'empty' as const, remainingSeconds: 0 }
      }

      const remainingSeconds = Math.max(0, growSeconds - (currentTime - plantedAt))

      return {
        index,

        status: remainingSeconds <= 0 ? ('ready' as const) : ('growing' as const),

        remainingSeconds,
      }
    })
  }

  plant(instance: BuildingInstance, template: Building, plotIndex: number, materialBag: MaterialBag, currentTime: number): boolean {
    if (!template.gardenSeedMaterialId || plotIndex < 0 || plotIndex >= instance.level) {
      return false
    }

    if (!instance.gardenPlots) {
      instance.gardenPlots = Array.from({ length: GARDEN_PLOT_COUNT }, () => ({}))
    }

    if (instance.gardenPlots[plotIndex]?.plantedAt !== undefined) {
      return false
    }

    if (!materialBag.remove(template.gardenSeedMaterialId, 1)) {
      return false
    }

    instance.gardenPlots[plotIndex] = { plantedAt: currentTime }

    return true
  }

  harvest(
    instance: BuildingInstance,
    template: Building,
    plotIndex: number,
    materialBag: MaterialBag,
    materialRegistry: MaterialRegistry,
    currentTime: number,
  ): boolean {
    const plantedAt = instance.gardenPlots?.[plotIndex]?.plantedAt

    if (!template.gardenYieldMaterialId || plantedAt === undefined) {
      return false
    }

    if (currentTime - plantedAt < (template.gardenGrowSeconds ?? 0)) {
      return false
    }

    materialBag.add(materialRegistry.get(template.gardenYieldMaterialId), template.gardenYieldAmount ?? 1)

    instance.gardenPlots![plotIndex] = {}

    return true
  }

  // "Thu Hoạch Tất Cả" — gom mọi ô đã chín trong 1 lượt bấm, khỏi phải
  // click từng ô/9 ô.
  harvestAll(instance: BuildingInstance, template: Building, materialBag: MaterialBag, materialRegistry: MaterialRegistry, currentTime: number): number {
    let harvested = 0

    for (let index = 0; index < GARDEN_PLOT_COUNT; index++) {
      if (this.harvest(instance, template, index, materialBag, materialRegistry, currentTime)) {
        harvested++
      }
    }

    return harvested
  }
}
