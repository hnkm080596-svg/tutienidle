import type { Building, BuildingUpgradeCost } from './Building'
import type { BuildingInstance } from './BuildingInstance'
import { BuildingRegistry } from './BuildingRegistry'
import { BuildingManager } from './BuildingManager'
import type { MaterialBag } from '../material/MaterialBag'
import { getRealmIndex } from '../realm/realmSystem'
import type { CraftModifiers } from './BuildingLevelEffect'
import { getRealmIdForTier, getRealmTier } from '../realm/RealmTierMap'
import { getSpiritStoneMaterialIdForRealmTier } from '../material/SpiritStoneMaterial'
import { PRODUCTION_OFFLINE_CAP_SECONDS } from '../production/ProductionBalance'

const DEFAULT_CRAFT_MODIFIERS: CraftModifiers = {
  timeReductionPercent: 0,

  qualityBonusPercent: 0,

  concurrentJobSlots: 1,

  equipmentCostDiscountPercent: 0,
}

// Tran offline production - dung CHUNG mot hang so voi production
// (PRODUCTION_OFFLINE_CAP_SECONDS, ProductionBalance.ts) de Linh Tuyen va
// slot san xuat khong bao gio lech cap (review 2026-08-28,
// economy-ecosystem-plan T8: truoc day khai bao trung 2 noi).

// Rate/Capacity tang tuyen tinh theo level - +20%/level.
const LEVEL_BONUS_PER_LEVEL = 0.2

// Linh Tuyen - engine thach offline chinh (balance playtest 2026-08-28).
// Muc tieu san luong o level MAX = 5% rate farm online cua realm, tuong
// duong ~30 phut farm cho moi 10h offline (dung cap). Don vi: thach/phut.
// Realm tren Truc Co scale x3 moi bac (khop getRealmRewardMultiplier ben
// core/reward/RealmRewardScale.ts - farm online cung tang x3 nen offline giu
// ti le 5%).
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
 * Building KHONG giu state noi bo (giong EquipmentSystem) - bag/
 * registry/manager truyen theo tung method, de GameManager tu quan
 * ly instance cua cac Manager/Registry do (dung kien truc project).
 *
 * (2026-08-25, resource-professions-rework plan sec2) - sau rework chi
 * con Linh Tuyen (producesSpiritStone): vong san xuat nguyen lieu da
 * chuyen sang ProductionSystem, processing jobs/garden da bi loai bo.
 */
/**
 * F-TC5-1: the accrual realm pin is only ever written from the player's
 * realm when an instance is created (EM-01). A pin that resolves above the
 * current realm - or to no known realm - is a forged accrual window;
 * clamp it to the current realm instead of minting the fabricated
 * window's tier and rate.
 */
function resolveAccrualRealmId(
  instance: BuildingInstance,
  currentRealmId?: string,
): string | undefined {
  const pinned = instance.accrualRealmId ?? currentRealmId

  if (pinned === undefined || currentRealmId === undefined) {
    return pinned
  }

  const pinnedIndex = getRealmIndex(pinned)

  if (pinnedIndex < 0 || pinnedIndex > getRealmIndex(currentRealmId)) {
    return currentRealmId
  }

  return pinned
}

export class BuildingSystem {
  /**
   * Default-built reconcile (2026-10-03): every registered building
   * exists at level 1 by default - there is no build action and no
   * 'unbuilt' state. Called once after character init and after each
   * save restore so old saves gain any missing building. Idempotent:
   * skips buildings that already own an instance. Returns the newly
   * added instances so callers can run side-effects (CHQ capacity).
   */
  ensureAllBuilt(
    registry: BuildingRegistry,
    manager: BuildingManager,
    currentTime: number,
    realmId?: string,
  ): BuildingInstance[] {
    const added: BuildingInstance[] = []

    for (const template of registry.getAll()) {
      if (manager.getByBuildingId(template.id)) {
        continue
      }

      const instance: BuildingInstance = {
        instanceId: crypto.randomUUID(),

        buildingId: template.id,

        level: 1,

        lastCollectedAt: currentTime,

        // EM-01 - the first accrual window runs under the current realm.
        accrualRealmId: realmId,
      }

      manager.add(instance)

      added.push(instance)
    }

    return added
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

    // upgradeCost index = level hien tai (row 0 tro thanh du lieu thua
    // tu khi co che xay bi bo - building mac dinh lv1); cost tra cho
    // level -> level+1.
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
   * Authoritative upgrade quote - the SAME rules upgrade() enforces
   * (cost row, max level, realm tier gate, material affordability), read
   * side only. Panel header state consumes this; upgrade() re-checks.
   */
  quoteUpgrade(
    instanceId: string,
    registry: BuildingRegistry,
    manager: BuildingManager,
    materialBag: MaterialBag,
    currentRealmId?: string,
  ): {
    template: Building
    instance: BuildingInstance
    hasNextLevel: boolean
    meetsRealmRequirement: boolean
    requiredRealmId: string
    nextUpgradeCost: readonly BuildingUpgradeCost[]
    canAfford: boolean
  } | null {
    const instance = manager.get(instanceId)

    if (!instance) {
      return null
    }

    const template = registry.get(instance.buildingId)

    const hasNextLevel = instance.level < template.maxLevel

    const nextUpgradeCost = hasNextLevel
      ? template.upgradeCost[instance.level] ?? []
      : []

    const meetsRealmRequirement =
      currentRealmId === undefined || getRealmTier(currentRealmId) >= instance.level + 1

    const canAfford = nextUpgradeCost.every(
      (entry) => materialBag.has(entry.materialId, entry.amount),
    )

    return {
      template,
      instance,
      hasNextLevel,
      meetsRealmRequirement,
      requiredRealmId: getRealmIdForTier(instance.level + 1),
      nextUpgradeCost,
      canAfford,
    }
  }

  /**
   * BUILDing spec muc 15-16 - cong don effects cua MOI level da dat
   * (level <= instance.level). `template.levels` phai sap theo level
   * tang dan de "level cao nhat da dat" xu ly sau cung.
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
    // F-TC6-5: a forged/unsupported level cannot mint unbounded yield -
    // the authored table tops out at template.maxLevel, so effective
    // level clamps there (the boundary validator already rejects, this
    // is the emit-side defence).
    const effectiveLevel = Math.min(level, template.maxLevel)

    // Linh mach (chi-hien-quan spec) - engine Linh Tuyen cu, nguon gio la
    // gathering_outpost (building spirit_spring da xoa khoi data).
    if (template.id === 'gathering_outpost') {
      return this.getSpiritSpringRatePerSecond(template, effectiveLevel, realmId)
    }

    return (template.baseProductionRate ?? 0) * (1 + (effectiveLevel - 1) * LEVEL_BONUS_PER_LEVEL)
  }

  // Linh Tuyen - rate neo theo realm (bang SPIRIT_SPRING_TARGET_PER_MINUTE),
  // level scaling giu +20%/level; level MAX dat dung target 5% farm online.
  private getSpiritSpringRatePerSecond(template: Building, level: number, realmId?: string): number {
    const targetPerMinute = getSpiritSpringTargetRatePerMinute(realmId)
    const maxLevelMultiplier = 1 + (template.maxLevel - 1) * LEVEL_BONUS_PER_LEVEL
    const levelOneRatePerSecond = targetPerMinute / 60 / maxLevelMultiplier

    return levelOneRatePerSecond * (1 + (level - 1) * LEVEL_BONUS_PER_LEVEL)
  }

  private getEffectiveCapacity(template: Building, level: number, realmId?: string): number {
    const effectiveLevel = Math.min(level, template.maxLevel)

    if (template.id === 'gathering_outpost') {
      // Storage = dung 10h san luong o level/realm do de offline khong bao
      // gio cap TRUOC cap thoi gian (2026-08-28 - thay 100^level cu khien
      // L1 chi chua 100 thach, day sau ~47 phut). Epsilon chan float drift
      // (ratex36000 = 18600.000000000004 khong bi ceil len 18601).
      const tenHourYield = this.getSpiritSpringRatePerSecond(template, effectiveLevel, realmId) * PRODUCTION_OFFLINE_CAP_SECONDS
      return Math.ceil(tenHourYield - 1e-6)
    }

    return template.baseStorageCapacity * (1 + (effectiveLevel - 1) * LEVEL_BONUS_PER_LEVEL)
  }

  /**
   * San luong DA TICH LUY tinh THUAN tu thoi gian troi qua ke tu lan
   * thu hoach gan nhat - khong mutate gi, dung ca cho UI hien thi lan
   * claim() that ben duoi. Chi ap dung cho resource building (Linh
   * Tuyen) sau rework.
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

      // EM-01 - rate/capacity follow the realm the window accrued under,
      // not the claim-time realm: a breakthrough inside the window must
      // not retroactively reprice the whole backlog.
      const accrualRealmId = resolveAccrualRealmId(instance, realmId)
      const rate = this.getEffectiveRate(template, instance.level, accrualRealmId)
      const capacity = this.getEffectiveCapacity(template, instance.level, accrualRealmId)

      return Math.min(elapsedSeconds * rate, capacity)
    }

    return 0
  }

  // UI reads capacity + rate (Linh Tuyen) for display, same source as
  // getStoredAmount/claim so they always agree (2026-08-28). EM-01: same
  // accrualRealmId pin - the UI number is exactly what claim() will pay.
  getCapacity(instance: BuildingInstance, template: Building, realmId?: string): number {
    return this.getEffectiveCapacity(template, instance.level, resolveAccrualRealmId(instance, realmId))
  }

  getRatePerMinute(instance: BuildingInstance, template: Building, realmId?: string): number {
    return this.getEffectiveRate(template, instance.level, resolveAccrualRealmId(instance, realmId)) * 60
  }

  /**
   * "Day kho" cho resource building = san luong cham tran TICH LUY THUC
   * TE - muc toi da la min(capacity, capOffline * rate). Linh mach
   * gathering_outpost duoc thiet ke capacity = ceil(10h yield) nen luon
   * con ~1 don vi headroom so voi muc tich luy toi da: so sanh thang
   * voi capacity se khong bao gio dat "day". Non-producer tra false.
   */
  isStorageFull(
    instance: BuildingInstance,
    template: Building,
    currentTime: number,
    realmId?: string,
  ): boolean {
    const accrualRealmId = resolveAccrualRealmId(instance, realmId)
    const attainable = Math.min(
      this.getEffectiveCapacity(template, instance.level, accrualRealmId),
      PRODUCTION_OFFLINE_CAP_SECONDS * this.getEffectiveRate(template, instance.level, accrualRealmId),
    )

    if (attainable <= 0) {
      return false
    }

    return this.getStoredAmount(instance, template, currentTime, accrualRealmId) >= attainable
  }

  /**
   * Resolve materialId ma claim() se tra - linh mach Khai Vat Duong cap
   * Linh Thach dung PHAM theo realm thu thap, building khac dung template.
   * Tach rieng de caller (GameManager.collectBuilding) pre-check registry
   * TRUOC khi claim reset moc thoi gian - tranh mat san luong neu id khong
   * resolve duoc (review 2026-08-28).
   */
  resolveProducesMaterialId(template: Building, currentRealmId?: string): string | undefined {
    return template.id === 'gathering_outpost' && currentRealmId
      ? getSpiritStoneMaterialIdForRealmTier(getRealmTier(currentRealmId))
      : template.producesMaterialId
  }

  /**
   * Thu hoach - resource building (Linh Tuyen): cong phan nguyen (floor)
   * san luong da tich luy vao MaterialBag qua GameManager (claim chi
   * tra amount + materialId, khong cam bag/registry material - plan
   * Workstream F: Linh Thach la MATERIAL that trong MaterialBag).
   *
   * Giu PHAN LE (review 2026-08-28): thay vi reset moc ve currentTime
   * (mat toi ~0.99 don vi moi lan claim), moc duoc LUI ve qua khu dung
   * bang thoi gian da san xuat phan le con lai - lan claim ke tiep se
   * cong don tiep phan do. Phan thoi gian vuot suc chua van coi nhu mat
   * (dung "Production Paused khi day").
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

    // Giu phan le: lui moc ve qua khu dung bang thoi gian san xuat phan
    // le (stored - amount), thay vi reset ve currentTime lam mat phan do.
    // EM-01 - rate/material tier still follow the just-ended window's
    // realm (pin), then the pin moves to the current realm for the next
    // accrual window.
    const accrualRealmId = resolveAccrualRealmId(instance, currentRealmId)
    const rate = this.getEffectiveRate(template, instance.level, accrualRealmId)

    const fraction = stored - amount

    instance.lastCollectedAt =
      rate > 0 ? currentTime - fraction / rate : currentTime

    const materialId = this.resolveProducesMaterialId(template, accrualRealmId)
    instance.accrualRealmId = currentRealmId

    return { amount, materialId }
  }
}
