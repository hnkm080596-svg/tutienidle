import type { Building } from './Building'
import type { BuildingInstance } from './BuildingInstance'
import { BuildingRegistry } from './BuildingRegistry'
import { BuildingManager } from './BuildingManager'
import type { ProcessingRecipe } from './ProcessingRecipe'
import type { ProcessingRecipeRegistry } from './ProcessingRecipeRegistry'
import type { MaterialBag } from '../material/MaterialBag'
import type { MaterialRegistry } from '../material/MaterialRegistry'
import type { PlayerData } from '../player/Player'
import { getRealmIndex } from '../realm/realmSystem'
import type { CraftModifiers } from './BuildingLevelEffect'
import { TEST_MODE_UNLOCK_ALL } from '../dev/DevMode'

const DEFAULT_CRAFT_MODIFIERS: CraftModifiers = {
  timeReductionPercent: 0,

  qualityBonusPercent: 0,

  concurrentJobSlots: 1,
}

// Trần offline production (MASTER SPEC Mục VII — "8-12 giờ là điểm
// khởi đầu hợp lý") — áp dụng cho CẢ lúc online lẫn offline, chỉ khác
// ở việc elapsed lúc offline có thể rất lớn (chặn ở đây để không tích
// vô hạn nếu người chơi bỏ máy nhiều ngày).
const OFFLINE_PRODUCTION_CAP_SECONDS = 10 * 60 * 60

// Rate/Capacity tăng tuyến tính theo level — +20%/level, hệ số khởi
// điểm hợp lý, tinh chỉnh ở Phase 10 (Economy Balancing).
const LEVEL_BONUS_PER_LEVEL = 0.2

/**
 * Building KHÔNG giữ state nội bộ (giống EquipmentSystem) — bag/
 * registry/manager truyền theo từng method, để GameManager tự quản
 * lý instance của các Manager/Registry đó (đúng kiến trúc project).
 */
export class BuildingSystem {
  canBuild(
    buildingId: string,
    registry: BuildingRegistry,
    manager: BuildingManager,
    player: PlayerData,
    materialBag: MaterialBag,
  ): boolean {
    if (!registry.has(buildingId)) {
      return false
    }

    const template = registry.get(buildingId)

    // Crafting-station (BUILDing spec) chỉ xây được 1 lần/loại — khác
    // resource building (Herb Garden...) vẫn cho phép nhiều instance.
    if (template.category === 'crafting_station' && manager.getByBuildingId(buildingId)) {
      return false
    }

    // Cờ test (2026-08-20) — bỏ qua gate cảnh giới/nguyên liệu, xem
    // core/dev/DevMode.ts.
    if (TEST_MODE_UNLOCK_ALL) {
      return true
    }

    if (template.requiredRealmId && getRealmIndex(player.realmId) < getRealmIndex(template.requiredRealmId)) {
      return false
    }

    const cost = template.upgradeCost[0] ?? []

    return cost.every(entry => materialBag.has(entry.materialId, entry.amount))
  }

  build(
    buildingId: string,
    registry: BuildingRegistry,
    manager: BuildingManager,
    player: PlayerData,
    materialBag: MaterialBag,
    currentTime: number,
  ): BuildingInstance | null {
    if (!this.canBuild(buildingId, registry, manager, player, materialBag)) {
      return null
    }

    const template = registry.get(buildingId)

    const cost = template.upgradeCost[0] ?? []

    for (const entry of cost) {
      materialBag.remove(entry.materialId, entry.amount)
    }

    const instance: BuildingInstance = {
      instanceId: crypto.randomUUID(),

      buildingId,

      level: 1,

      lastCollectedAt: currentTime,
    }

    manager.add(instance)

    return instance
  }

  upgrade(instanceId: string, registry: BuildingRegistry, manager: BuildingManager, materialBag: MaterialBag): boolean {
    const instance = manager.get(instanceId)

    if (!instance) {
      return false
    }

    const template = registry.get(instance.buildingId)

    if (instance.level >= template.maxLevel) {
      return false
    }

    // upgradeCost[0] = chi phí xây (level 0->1, đã trả lúc build()),
    // upgradeCost[level] = chi phí nâng từ level hiện tại lên level+1.
    const cost = template.upgradeCost[instance.level] ?? []

    if (!cost.every(entry => materialBag.has(entry.materialId, entry.amount))) {
      return false
    }

    for (const entry of cost) {
      materialBag.remove(entry.materialId, entry.amount)
    }

    instance.level++

    return true
  }

  /**
   * BUILDing spec mục 15-16 — cộng dồn effects của MỌI level đã đạt
   * (level ≤ instance.level), KHÔNG chỉ level hiện tại (giống cách
   * game thường làm — nâng cấp không mất hiệu ứng mốc trước). Building
   * không có `levels` (3 building resource/processing cũ) trả về
   * default (1 job slot, không bonus) — KHÔNG dùng LEVEL_BONUS_PER_LEVEL
   * ở đây, đó là công thức RIÊNG cho production/capacity/processing
   * speed của nhóm building khác, không liên quan crafting-station.
   *
   * `concurrent_job_slots.amount` là TỔNG SỐ slot tuyệt đối kể từ
   * level đó (vd "Lv4 → 2 slot", "Lv5 → 3 slot"), KHÔNG phải delta
   * cộng dồn — effect ở level cao nhất đã đạt GHI ĐÈ, không cộng với
   * effect ở level thấp hơn (khác 2 effect kia thực sự cộng dồn).
   * `template.levels` phải sắp theo level tăng dần (đúng cách khai báo
   * trong data/building/buildings.ts) để "level cao nhất đã đạt" luôn
   * là phần tử xử lý sau cùng trong vòng lặp.
   */
  getCraftModifiers(instance: BuildingInstance, template: Building): CraftModifiers {
    if (!template.levels) {
      return { ...DEFAULT_CRAFT_MODIFIERS }
    }

    const result = { ...DEFAULT_CRAFT_MODIFIERS }

    for (const levelDef of template.levels) {
      if (levelDef.level > instance.level) {
        continue
      }

      for (const effect of levelDef.effects) {
        if (effect.kind === 'craft_time_reduction') {
          result.timeReductionPercent += effect.percent
        } else if (effect.kind === 'craft_quality_bonus') {
          result.qualityBonusPercent += effect.percent
        } else if (effect.kind === 'concurrent_job_slots') {
          result.concurrentJobSlots = effect.amount
        }
      }
    }

    return result
  }

  private getEffectiveRate(template: Building, level: number): number {
    return (template.baseProductionRate ?? 0) * (1 + (level - 1) * LEVEL_BONUS_PER_LEVEL)
  }

  private getEffectiveCapacity(template: Building, level: number): number {
    return template.baseStorageCapacity * (1 + (level - 1) * LEVEL_BONUS_PER_LEVEL)
  }

  private getEffectiveProcessingSpeed(template: Building, level: number): number {
    return (template.baseProcessingSpeed ?? 1) * (1 + (level - 1) * LEVEL_BONUS_PER_LEVEL)
  }

  /**
   * Số lượt xử lý HOÀN THÀNH được — chặn bởi CẢ 3: thời gian trôi qua
   * (cap offline), sức chứa (storedAmount == output đã tích luỹ,
   * "Storage đầy = Production Paused" áp dụng luôn cho Processing), và
   * nguyên liệu đầu vào THẬT có trong MaterialBag lúc gọi. Đọc
   * materialBag chỉ qua getAmount() (thuần, không mutate) nên gọi lại
   * nhiều lần (mỗi giây, cho UI) vẫn an toàn — chỉ claim() mới thực sự
   * remove()/add().
   */
  private getProcessingCycles(
    instance: BuildingInstance,
    template: Building,
    recipe: ProcessingRecipe,
    materialBag: MaterialBag,
    currentTime: number,
  ): number {
    const elapsedSeconds = Math.min(currentTime - instance.lastCollectedAt, OFFLINE_PRODUCTION_CAP_SECONDS)

    if (elapsedSeconds <= 0) {
      return 0
    }

    const secondsPerCycle = recipe.processingSeconds / this.getEffectiveProcessingSpeed(template, instance.level)

    const cyclesByTime = Math.floor(elapsedSeconds / secondsPerCycle)

    const capacity = this.getEffectiveCapacity(template, instance.level)
    const cyclesByCapacity = Math.floor(capacity / recipe.outputAmount)

    const cyclesByInput = Math.floor(materialBag.getAmount(recipe.inputMaterialId) / recipe.inputAmount)

    return Math.min(cyclesByTime, cyclesByCapacity, cyclesByInput)
  }

  /**
   * Sản lượng ĐÃ TÍCH LUỸ tính THUẦN từ thời gian trôi qua kể từ lần
   * thu hoạch gần nhất — không mutate gì (giống cách ExplorationPanel.vue
   * tính `progress`/`claimableRuns` từ `active.startedAt`), dùng cả
   * cho UI hiển thị lẫn claim() thật bên dưới.
   */
  getStoredAmount(
    instance: BuildingInstance,
    template: Building,
    currentTime: number,
    materialBag: MaterialBag,
    recipeRegistry: ProcessingRecipeRegistry,
  ): number {
    // Linh Tuyền (producesSpiritStone) dùng CHUNG rate/capacity với
    // resource building thường — chỉ khác NƠI claim() đổ sản lượng
    // vào (player.spiritStone thay vì materialBag).
    if ((template.producesMaterialId || template.producesSpiritStone) && template.baseProductionRate) {
      const elapsedSeconds = Math.min(currentTime - instance.lastCollectedAt, OFFLINE_PRODUCTION_CAP_SECONDS)

      if (elapsedSeconds <= 0) {
        return 0
      }

      const rate = this.getEffectiveRate(template, instance.level)
      const capacity = this.getEffectiveCapacity(template, instance.level)

      return Math.min(elapsedSeconds * rate, capacity)
    }

    if (template.processingRecipeId) {
      const recipe = recipeRegistry.get(template.processingRecipeId)

      return this.getProcessingCycles(instance, template, recipe, materialBag, currentTime) * recipe.outputAmount
    }

    return 0
  }

  /**
   * Thu hoạch — resource building: cộng phần nguyên (floor) sản lượng
   * đã tích luỹ vào MaterialBag rồi reset hẳn mốc thời gian về
   * currentTime (phần thời gian vượt sức chứa coi như mất, đúng
   * "Production Paused khi đầy"). Processing building: RÚT nguyên liệu
   * đầu vào + CỘNG nguyên liệu đầu ra theo đúng số lượt hoàn thành, chỉ
   * tiến mốc thời gian đúng bằng thời gian các lượt đó tiêu tốn (KHÔNG
   * reset hẳn về currentTime) — để phần thời gian "dư" do thiếu
   * nguyên liệu đầu vào được giữ lại, tính tiếp khi có nguyên liệu bù
   * vào sau đó thay vì mất trắng.
   */
  claim(
    instanceId: string,
    registry: BuildingRegistry,
    manager: BuildingManager,
    materialBag: MaterialBag,
    materialRegistry: MaterialRegistry,
    recipeRegistry: ProcessingRecipeRegistry,
    currentTime: number,
    player: PlayerData,
  ): number {
    const instance = manager.get(instanceId)

    if (!instance) {
      return 0
    }

    const template = registry.get(instance.buildingId)

    if (template.producesSpiritStone) {
      const amount = Math.floor(this.getStoredAmount(instance, template, currentTime, materialBag, recipeRegistry))

      if (amount <= 0) {
        return 0
      }

      player.spiritStone += amount

      instance.lastCollectedAt = currentTime

      return amount
    }

    if (template.producesMaterialId) {
      const amount = Math.floor(this.getStoredAmount(instance, template, currentTime, materialBag, recipeRegistry))

      if (amount <= 0) {
        return 0
      }

      materialBag.add(materialRegistry.get(template.producesMaterialId), amount)

      instance.lastCollectedAt = currentTime

      return amount
    }

    if (template.processingRecipeId) {
      const recipe = recipeRegistry.get(template.processingRecipeId)

      const cycles = this.getProcessingCycles(instance, template, recipe, materialBag, currentTime)

      if (cycles <= 0) {
        return 0
      }

      const secondsPerCycle = recipe.processingSeconds / this.getEffectiveProcessingSpeed(template, instance.level)

      materialBag.remove(recipe.inputMaterialId, recipe.inputAmount * cycles)
      materialBag.add(materialRegistry.get(recipe.outputMaterialId), recipe.outputAmount * cycles)

      instance.lastCollectedAt += cycles * secondsPerCycle

      return recipe.outputAmount * cycles
    }

    return 0
  }
}
