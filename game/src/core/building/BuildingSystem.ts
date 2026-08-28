import type { Building } from './Building'
import type { BuildingInstance } from './BuildingInstance'
import { BuildingRegistry } from './BuildingRegistry'
import { BuildingManager } from './BuildingManager'
import type { MaterialBag } from '../material/MaterialBag'
import type { PlayerData } from '../player/Player'
import { getRealmIndex } from '../realm/realmSystem'
import type { CraftModifiers } from './BuildingLevelEffect'
import { isTestModeUnlockAll } from '../dev/DevMode'
import { getRealmTier } from '../realm/RealmTierMap'
import { getSpiritStoneMaterialIdForRealmTier } from '../material/SpiritStoneMaterial'
import { PRODUCTION_OFFLINE_CAP_SECONDS } from '../production/ProductionBalance'

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

  equipmentCostDiscountPercent: 0,
}

// Trần offline production — dùng CHUNG một hằng số với production
// (PRODUCTION_OFFLINE_CAP_SECONDS, ProductionBalance.ts) để Linh Tuyền và
// slot sản xuất không bao giờ lệch cap (review 2026-08-28,
// economy-ecosystem-plan T8: trước đây khai báo trùng 2 nơi).

// Rate/Capacity tăng tuyến tính theo level — +20%/level.
const LEVEL_BONUS_PER_LEVEL = 0.2

// Linh Tuyền — engine thạch offline chính (balance playtest 2026-08-28).
// Mục tiêu sản lượng ở level MAX = 5% rate farm online của realm, tương
// đương ~30 phút farm cho mỗi 10h offline (đúng cap). Đơn vị: thạch/phút.
// Realm trên Trúc Cơ scale ×3 mỗi bậc (khớp getRealmRewardMultiplier bên
// core/reward/RealmRewardScale.ts — farm online cũng tăng ×3 nên offline giữ
// tỉ lệ 5%).
const SPIRIT_SPRING_TARGET_PER_MINUTE: Record<string, number> = {
  mortal: 5.5,
  qi_refining: 31,
  foundation_establishment: 93,
}

const SPIRIT_SPRING_REALM_GROWTH_BASE = 3
const SPIRIT_SPRING_MORTAL_FALLBACK = 5.5
const SPIRIT_SPRING_FOUNDATION_FALLBACK = 93

function getSpiritSpringTargetRatePerMinute(realmId: string | undefined): number {
  if (realmId) {
    const tableRate = SPIRIT_SPRING_TARGET_PER_MINUTE[realmId]

    if (tableRate !== undefined) {
      return tableRate
    }
  }

  const realmIndex = realmId ? getRealmIndex(realmId) : -1
  const foundationIndex = getRealmIndex('foundation_establishment')

  if (realmIndex > foundationIndex) {
    return (
      SPIRIT_SPRING_FOUNDATION_FALLBACK *
      Math.pow(SPIRIT_SPRING_REALM_GROWTH_BASE, realmIndex - foundationIndex)
    )
  }

  return SPIRIT_SPRING_MORTAL_FALLBACK
}

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
    currentRealmId?: string,
  ): boolean {
    const instance = manager.get(instanceId)

    if (!instance) {
      return false
    }

    const template = registry.get(instance.buildingId)

    if (instance.level >= template.maxLevel) {
      return false
    }

    // Building level N corresponds to realm tier N. Direct system callers
    // may omit realm for isolated tests/tools; gameplay always supplies it.
    if (currentRealmId && getRealmTier(currentRealmId) < instance.level + 1) {
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
        } else if (effect.kind === 'concurrent_job_slots') {
          result.concurrentJobSlots += effect.amount
        } else if (effect.kind === 'equipment_cost_discount') {
          result.equipmentCostDiscountPercent += effect.percent
        }
      }
    }

    return result
  }

  private getEffectiveRate(template: Building, level: number, realmId?: string): number {
    if (template.id === 'spirit_spring') {
      return this.getSpiritSpringRatePerSecond(template, level, realmId)
    }

    return (template.baseProductionRate ?? 0) * (1 + (level - 1) * LEVEL_BONUS_PER_LEVEL)
  }

  // Linh Tuyền — rate neo theo realm (bảng SPIRIT_SPRING_TARGET_PER_MINUTE),
  // level scaling giữ +20%/level; level MAX đạt đúng target 5% farm online.
  private getSpiritSpringRatePerSecond(template: Building, level: number, realmId?: string): number {
    const targetPerMinute = getSpiritSpringTargetRatePerMinute(realmId)
    const maxLevelMultiplier = 1 + (template.maxLevel - 1) * LEVEL_BONUS_PER_LEVEL
    const levelOneRatePerSecond = targetPerMinute / 60 / maxLevelMultiplier

    return levelOneRatePerSecond * (1 + (level - 1) * LEVEL_BONUS_PER_LEVEL)
  }

  private getEffectiveCapacity(template: Building, level: number, realmId?: string): number {
    if (template.id === 'spirit_spring') {
      // Storage = đúng 10h sản lượng ở level/realm đó để offline không bao
      // giờ cap TRƯỚC cap thời gian (2026-08-28 — thay 100^level cũ khiến
      // L1 chỉ chứa 100 thạch, đầy sau ~47 phút). Epsilon chặn float drift
      // (rate×36000 = 18600.000000000004 không bị ceil lên 18601).
      const tenHourYield = this.getSpiritSpringRatePerSecond(template, level, realmId) * PRODUCTION_OFFLINE_CAP_SECONDS
      return Math.ceil(tenHourYield - 1e-6)
    }

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
    realmId?: string,
  ): number {
    if (template.producesMaterialId && template.baseProductionRate) {
      const elapsedSeconds = Math.min(
        currentTime - instance.lastCollectedAt,
        PRODUCTION_OFFLINE_CAP_SECONDS,
      )

      if (elapsedSeconds <= 0) {
        return 0
      }

      const rate = this.getEffectiveRate(template, instance.level, realmId)
      const capacity = this.getEffectiveCapacity(template, instance.level, realmId)

      return Math.min(elapsedSeconds * rate, capacity)
    }

    return 0
  }

  // UI đọc sức chứa + tốc độ (Linh Tuyền) để hiển thị, cùng nguồn với
  // getStoredAmount/claim nên luôn khớp (2026-08-28).
  getCapacity(instance: BuildingInstance, template: Building, realmId?: string): number {
    return this.getEffectiveCapacity(template, instance.level, realmId)
  }

  getRatePerMinute(instance: BuildingInstance, template: Building, realmId?: string): number {
    return this.getEffectiveRate(template, instance.level, realmId) * 60
  }

  /**
   * Resolve materialId mà claim() sẽ trả — spirit_spring cấp Linh Thạch
   * đúng PHẨM theo realm thu thập, building khác dùng template. Tách riêng
   * để caller (GameManager.collectBuilding) pre-check registry TRƯỚC khi
   * claim reset mốc thời gian — tránh mất sản lượng nếu id không resolve
   * được (review 2026-08-28).
   */
  resolveProducesMaterialId(template: Building, currentRealmId?: string): string | undefined {
    return template.id === 'spirit_spring' && currentRealmId
      ? getSpiritStoneMaterialIdForRealmTier(getRealmTier(currentRealmId))
      : template.producesMaterialId
  }

  /**
   * Thu hoạch — resource building (Linh Tuyền): cộng phần nguyên (floor)
   * sản lượng đã tích luỹ vào MaterialBag qua GameManager (claim chỉ
   * trả amount + materialId, không cầm bag/registry material — plan
   * Workstream F: Linh Thạch là MATERIAL thật trong MaterialBag).
   *
   * Giữ PHẦN LẺ (review 2026-08-28): thay vì reset mốc về currentTime
   * (mất tới ~0.99 đơn vị mỗi lần claim), mốc được LÙI về quá khứ đúng
   * bằng thời gian đã sản xuất phần lẻ còn lại — lần claim kế tiếp sẽ
   * cộng dồn tiếp phần đó. Phần thời gian vượt sức chứa vẫn coi như mất
   * (đúng "Production Paused khi đầy").
   */
  claim(
    instanceId: string,
    registry: BuildingRegistry,
    manager: BuildingManager,
    currentTime: number,
    currentRealmId?: string,
  ): { amount: number; materialId?: string } {
    const instance = manager.get(instanceId)

    if (!instance) {
      return { amount: 0 }
    }

    const template = registry.get(instance.buildingId)

    if (!template.producesMaterialId) {
      return { amount: 0 }
    }

    const stored = this.getStoredAmount(instance, template, currentTime, currentRealmId)

    const amount = Math.floor(stored)

    if (amount <= 0) {
      return { amount: 0 }
    }

    // Giữ phần lẻ: lùi mốc về quá khứ đúng bằng thời gian sản xuất phần
    // lẻ (stored - amount), thay vì reset về currentTime làm mất phần đó.
    const rate = this.getEffectiveRate(template, instance.level, currentRealmId)

    const fraction = stored - amount

    instance.lastCollectedAt =
      rate > 0 ? currentTime - fraction / rate : currentTime

    const materialId = this.resolveProducesMaterialId(template, currentRealmId)

    return { amount, materialId }
  }
}
