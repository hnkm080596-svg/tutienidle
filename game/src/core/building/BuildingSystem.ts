import type { Building } from './Building'
import type { BuildingInstance } from './BuildingInstance'
import { BuildingRegistry } from './BuildingRegistry'
import { BuildingManager } from './BuildingManager'
import type { MaterialBag } from '../material/MaterialBag'
import type { PlayerData } from '../player/Player'
import { getRealmIndex } from '../realm/realmSystem'
import type { CraftModifiers } from './BuildingLevelEffect'
import { isTestModeUnlockAll } from '../dev/DevMode'

// Lý do từ chối xây — UI (popover/toast) dùng để báo người chơi thay vì
// im lặng (fix "không thể xây dựng" không rõ nguyên nhân, 2026-08-26).
export type BuildRejectReason =
  | 'unknown_building'
  | 'already_built'
  | 'realm_locked'
  | 'missing_materials'

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

// Rate/Capacity tăng tuyến tính theo level — +20%/level.
const LEVEL_BONUS_PER_LEVEL = 0.2

/**
 * Building KHÔNG giữ state nội bộ (giống EquipmentSystem) — bag/
 * registry/manager truyền theo từng method, để GameManager tự quản
 * lý instance của các Manager/Registry đó (đúng kiến trúc project).
 *
 * (2026-08-25, resource-professions-rework plan §2) — sau rework chỉ
 * còn Linh Tuyền (producesSpiritStone): vòng sản xuất nguyên liệu đã
 * chuyển sang ProductionSystem, processing jobs/garden đã bị loại bỏ.
 */
export class BuildingSystem {
  /**
   * Check chi tiết kèm lý do — UI/toast báo đúng nguyên nhân thay vì
   * im lặng; canBuild() boolean wrapper giữ cho caller cũ.
   */
  canBuildDetailed(
    buildingId: string,
    registry: BuildingRegistry,
    manager: BuildingManager,
    player: PlayerData,
    materialBag: MaterialBag,
  ): { ok: boolean; reason?: BuildRejectReason } {
    if (!registry.has(buildingId)) {
      return { ok: false, reason: 'unknown_building' }
    }

    const template = registry.get(buildingId)

    // Crafting-station (BUILDing spec) chỉ xây được 1 lần/loại.
    if (template.category === 'crafting_station' && manager.getByBuildingId(buildingId)) {
      return { ok: false, reason: 'already_built' }
    }

    // Cờ test (2026-08-20, override qua localStorage từ 2026-08-26) —
    // bỏ qua gate cảnh giới/nguyên liệu để test chức năng.
    if (isTestModeUnlockAll()) {
      return { ok: true }
    }

    if (
      template.requiredRealmId &&
      getRealmIndex(player.realmId) < getRealmIndex(template.requiredRealmId)
    ) {
      return { ok: false, reason: 'realm_locked' }
    }

    const cost = template.upgradeCost[0] ?? []

    if (!cost.every((entry) => materialBag.has(entry.materialId, entry.amount))) {
      return { ok: false, reason: 'missing_materials' }
    }

    return { ok: true }
  }

  canBuild(
    buildingId: string,
    registry: BuildingRegistry,
    manager: BuildingManager,
    player: PlayerData,
    materialBag: MaterialBag,
  ): boolean {
    return this.canBuildDetailed(buildingId, registry, manager, player, materialBag).ok
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

  upgrade(
    instanceId: string,
    registry: BuildingRegistry,
    manager: BuildingManager,
    materialBag: MaterialBag,
  ): boolean {
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

    if (!cost.every((entry) => materialBag.has(entry.materialId, entry.amount))) {
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
   * (level ≤ instance.level). `template.levels` phải sắp theo level
   * tăng dần để "level cao nhất đã đạt" xử lý sau cùng.
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

  /**
   * Sản lượng ĐÃ TÍCH LUỸ tính THUẦN từ thời gian trôi qua kể từ lần
   * thu hoạch gần nhất — không mutate gì, dùng cả cho UI hiển thị lẫn
   * claim() thật bên dưới. Chỉ áp dụng cho resource building (Linh
   * Tuyền) sau rework.
   */
  getStoredAmount(
    instance: BuildingInstance,
    template: Building,
    currentTime: number,
  ): number {
    if (template.producesMaterialId && template.baseProductionRate) {
      const elapsedSeconds = Math.min(
        currentTime - instance.lastCollectedAt,
        OFFLINE_PRODUCTION_CAP_SECONDS,
      )

      if (elapsedSeconds <= 0) {
        return 0
      }

      const rate = this.getEffectiveRate(template, instance.level)
      const capacity = this.getEffectiveCapacity(template, instance.level)

      return Math.min(elapsedSeconds * rate, capacity)
    }

    return 0
  }

  /**
   * Thu hoạch — resource building (Linh Tuyền): cộng phần nguyên (floor)
   * sản lượng đã tích luỹ vào MaterialBag qua GameManager (claim chỉ
   * trả amount + materialId, không cầm bag/registry material — plan
   * Workstream F: Linh Thạch là MATERIAL thật trong MaterialBag) rồi
   * reset mốc thời gian về currentTime (phần thời gian vượt sức chứa
   * coi như mất, đúng "Production Paused khi đầy").
   */
  claim(
    instanceId: string,
    registry: BuildingRegistry,
    manager: BuildingManager,
    currentTime: number,
  ): { amount: number; materialId?: string } {
    const instance = manager.get(instanceId)

    if (!instance) {
      return { amount: 0 }
    }

    const template = registry.get(instance.buildingId)

    if (!template.producesMaterialId) {
      return { amount: 0 }
    }

    const amount = Math.floor(this.getStoredAmount(instance, template, currentTime))

    if (amount <= 0) {
      return { amount: 0 }
    }

    instance.lastCollectedAt = currentTime

    return { amount, materialId: template.producesMaterialId }
  }
}
