// ProductionSystem (plan §4) — engine production dùng chung cho Lâm,
// Quáng, Động Thiên. Snapshot điều kiện lúc start (realm/level/table
// version/seed), CHỈ roll reward khi cycle hoàn thành, delivery vào Bag
// idempotent, auto-restart tạo cycle mới với seed riêng, offline settle
// tuần tự trong cap (§4.3).

import type { MaterialBag } from '../material/MaterialBag'
import type { MaterialRegistry } from '../material/MaterialRegistry'
import { getSpiritStoneMaterialIdForRealmTier } from '../material/SpiritStoneMaterial'
import type {
  ForestRewardDefinition,
  GrottoHerbDefinition,
  MineRewardDefinition,
  ProductionCycle,
  ProductionSiteDefinition,
  ProductionSiteState,
  TerritoryDefinition,
} from './ProductionTypes'
import {
  CYCLE_BASE_SECONDS_BY_REALM,
  FOREST_WOOD_AMOUNTS_BY_TIER_INDEX,
  GROTTO_HERB_AMOUNT,
  HERB_AGE_WEIGHTS,
  ORE_QUALITY_AMOUNTS,
  ORE_QUALITY_WEIGHTS,
  PRODUCTION_OFFLINE_CAP_SECONDS,
  computeCycleSeconds,
  getSiteSpeedMultiplier,
  getTierWeightProfile,
  mulberry32,
  rollWeightedIndex,
} from './ProductionBalance'
import { HERB_AGES, ORE_QUALITIES } from './ProductionTypes'

/** Một giao dịch settle đã xảy ra — dùng cho notification UI (§9.1). */
export interface ProductionSettlementEvent {
  siteId: string

  materialId: string

  amount: number

  /** Lượng tràn stack bị mất (túi đầy) — 0/undefined nếu không tràn. */
  overflow?: number
}

export interface ResolvedProductionReward {
  materialId: string

  amount: number

  /** Metadata hiển thị (tier realm / phẩm / niên đại) — không gameplay. */
  detail?: string
}

export interface ProductionSystemDeps {
  territory: TerritoryDefinition

  sites: readonly ProductionSiteDefinition[]

  forestRewards: readonly ForestRewardDefinition[]

  mineRewards: readonly MineRewardDefinition[]

  grottoHerbs: readonly GrottoHerbDefinition[]
}

let cycleCounter = 0

function nextCycleId(siteId: string): string {
  cycleCounter += 1

  return `cycle_${siteId}_${Date.now().toString(36)}_${cycleCounter}`
}

function buildCycle(
  siteId: string,
  collectionRealmId: string,
  siteLevelAtStart: number,
  baseSeconds: number,
  nowMs: number,
): ProductionCycle {
  const seconds = computeCycleSeconds(baseSeconds, siteLevelAtStart)

  return {
    cycleId: nextCycleId(siteId),
    siteId,
    collectionRealmId,
    siteLevelAtStart,
    rewardTableVersion: REWARD_TABLE_VERSION,
    rollSeed: Math.floor(Math.random() * 0x7fffffff),
    startedAtMs: nowMs,
    completesAtMs: nowMs + seconds * 1000,
  }
}

export class ProductionSystem {
  private readonly deps: ProductionSystemDeps

  private readonly states = new Map<string, ProductionSiteState>()

  private readonly siteDefinitionsById: Map<string, ProductionSiteDefinition>

  /** Settle events tích luỹ kể từ lần drain gần nhất (UI notification). */
  private pendingEvents: ProductionSettlementEvent[] = []

  constructor(deps: ProductionSystemDeps) {
    this.deps = deps
    this.siteDefinitionsById = new Map(deps.sites.map((site) => [site.siteId, site]))
  }

  // =========================
  // State management
  // =========================

  /** Tạo state level 1 idle cho site chưa có trong save (migration/boot). */
  ensureSiteState(siteId: string): ProductionSiteState {
    let state = this.states.get(siteId)

    if (!state) {
      state = { siteId, level: 1, autoRestart: false, activeWorkerSlots: 0, workerCycles: [] }

      this.states.set(siteId, state)
    }

    return state
  }

  restoreStates(states: ProductionSiteState[]): void {
    this.states.clear()

    for (const state of states) {
      this.states.set(state.siteId, {
        ...state,
        activeWorkerSlots: state.activeWorkerSlots ?? 0,
        workerCycles: state.workerCycles?.length ? [...state.workerCycles] : [],
      })
    }
  }

  getAllStates(): ProductionSiteState[] {
    return Array.from(this.states.values())
  }

  getState(siteId: string): ProductionSiteState | undefined {
    return this.states.get(siteId)
  }

  getSiteDefinition(siteId: string): ProductionSiteDefinition | undefined {
    return this.siteDefinitionsById.get(siteId)
  }

  getSiteDefinitions(): readonly ProductionSiteDefinition[] {
    return this.deps.sites
  }

  drainSettlementEvents(): ProductionSettlementEvent[] {
    const events = this.pendingEvents

    this.pendingEvents = []

    return events
  }

  // =========================
  // Cycle lifecycle (§4.1)
  // =========================

  canStart(siteId: string): boolean {
    const definition = this.getSiteDefinition(siteId)

    if (!definition) {
      return false
    }

    const state = this.states.get(siteId)

    return !state?.activeCycle
  }

  /**
   * Bắt đầu cycle — snapshot collectionRealmId + level + table version +
   * seed; deadline chỉ từ hai giá trị snapshot (nâng level giữa cycle
   * chỉ hiệu lực cycle kế tiếp, §4.2).
   */
  startCycle(siteId: string, collectionRealmId: string, nowMs: number): boolean {
    const definition = this.getSiteDefinition(siteId)

    if (!definition || !this.canStart(siteId)) {
      return false
    }

    if (!this.deps.territory.realmIds.includes(collectionRealmId)) {
      return false
    }

    const state = this.ensureSiteState(siteId)

    const baseSeconds = CYCLE_BASE_SECONDS_BY_REALM[collectionRealmId]

    if (!baseSeconds) {
      return false
    }

    state.activeCycle = buildCycle(siteId, collectionRealmId, state.level, baseSeconds, nowMs)

    return true
  }

  setAutoRestart(siteId: string, enabled: boolean): boolean {
    if (!this.getSiteDefinition(siteId)) {
      return false
    }

    this.ensureSiteState(siteId).autoRestart = enabled

    return true
  }

  /**
   * Nâng level nguồn bằng Gỗ + Linh Thạch (sink Lâm §5.2). Cycle đang
   * chạy giữ nguyên levelAtStart. Plan Workstream F — Linh Thạch là
   * MATERIAL: check/trừ trực tiếp trên MaterialBag.
   */
  upgradeSite(siteId: string, bag: MaterialBag, currentRealmTier?: number): boolean {
    const definition = this.getSiteDefinition(siteId)

    const state = this.states.get(siteId)

    if (!definition || !state || state.level >= definition.maxLevel) {
      return false
    }

    const cost = definition.upgradeCosts[state.level - 1]

    if (!cost) {
      return false
    }

    const targetLevel = state.level + 1
    if (currentRealmTier !== undefined && currentRealmTier < targetLevel) return false
    const spiritStoneId = getSpiritStoneMaterialIdForRealmTier(targetLevel)

    if (
      !bag.has(cost.woodMaterialId, cost.woodAmount) ||
      !bag.has(spiritStoneId, cost.spiritStone)
    ) {
      return false
    }

    bag.remove(cost.woodMaterialId, cost.woodAmount)

    bag.remove(spiritStoneId, cost.spiritStone)

    state.level += 1

    return true
  }

  // =========================
  // Tick & offline settle (§4.3)
  // =========================

  /**
   * Settle mọi cycle hoàn thành ở thời điểm nowMs. Auto-restart bắt đầu
   * cycle mới NGAY sau settle với seed riêng và cảnh giới HIỆN TẠI của
   * người chơi (caller truyền currentRealmId). Idempotent: settle xoá
   * activeCycle trước khi roll — tick/reload lặp không cấp đôi.
   */
  tick(nowMs: number, bag: MaterialBag, registry: MaterialRegistry, currentRealmId: string): void {
    for (const state of this.states.values()) {
      const cycle = state.activeCycle

      if (!cycle || nowMs < cycle.completesAtMs) {
        continue
      }

      state.activeCycle = undefined

      const rewards = this.rollRewards(cycle)

      for (const reward of rewards) {
        if (!registry.has(reward.materialId) || reward.amount <= 0) {
          continue
        }

        const overflow = bag.add(registry.get(reward.materialId), reward.amount)

        this.pendingEvents.push({
          siteId: cycle.siteId,
          materialId: reward.materialId,
          amount: reward.amount,
          overflow: overflow > 0 ? overflow : undefined,
        })
      }

      if (state.autoRestart && this.canStart(cycle.siteId)) {
        this.startCycle(cycle.siteId, currentRealmId, cycle.completesAtMs)
      }
    }
  }

  /**
   * Phân bổ pool worker theo round-robin và vận hành các cycle bổ sung.
   * Slot đầu tiên vẫn là activeCycle thủ công để không đổi contract UI cũ.
   */
  tickWorkers(
    nowMs: number,
    bag: MaterialBag,
    registry: MaterialRegistry,
    currentRealmId: string,
    capacity: number,
  ): void {
    const activeStates = [...this.states.values()].filter(state => state.autoRestart)
    for (const state of this.states.values()) state.activeWorkerSlots = 0
    if (activeStates.length === 0 || capacity <= 0) return

    for (let index = 0; index < Math.floor(capacity); index++) {
      activeStates[index % activeStates.length]!.activeWorkerSlots++
    }

    for (const state of activeStates) {
      state.workerCycles ??= []
      while (state.workerCycles.length < state.activeWorkerSlots) {
        const definition = this.getSiteDefinition(state.siteId)
        const baseSeconds = CYCLE_BASE_SECONDS_BY_REALM[currentRealmId]
        if (!definition || !baseSeconds) break
        state.workerCycles.push(buildCycle(state.siteId, currentRealmId, state.level, baseSeconds, nowMs))
      }

      const completed = state.workerCycles.filter(cycle => cycle.completesAtMs <= nowMs)
      state.workerCycles = state.workerCycles.filter(cycle => cycle.completesAtMs > nowMs)
      for (const cycle of completed) {
        for (const reward of this.rollRewards(cycle)) {
          if (!registry.has(reward.materialId) || reward.amount <= 0) continue
          const overflow = bag.add(registry.get(reward.materialId), reward.amount)
          this.pendingEvents.push({
            siteId: cycle.siteId,
            materialId: reward.materialId,
            amount: reward.amount,
            overflow: overflow > 0 ? overflow : undefined,
          })
        }
      }
    }
  }

  /**
   * Offline settle tuần tự (§4.3): settle các cycle hoàn thành trước
   * nowMs theo thứ tự thời gian, MỖI auto-cycle một seed/roll riêng —
   * không nhân một roll với số cycle. Ngân sách tổng bị chặn ở cap
   * (§4.3): khi tổng thời gian cycle đã settle vượt cap thì dừng —
   * cycle kế tiếp còn nguyên cho tick online. Trả về số cycle đã settle.
   */
  settleOffline(
    bag: MaterialBag,
    registry: MaterialRegistry,
    currentRealmId: string,
    nowMs: number = Date.now(),
  ): number {
    let budgetUsedMs = 0

    let settled = 0

    let guard = 0

    while (guard < 5000) {
      guard += 1

      // Tìm cycle hoàn thành SỚM NHẤT trong quá khứ của nowMs.
      let targetState: ProductionSiteState | undefined

      let targetCycle: ProductionCycle | undefined

      for (const state of this.states.values()) {
        const cycle = state.activeCycle

        if (!cycle || cycle.completesAtMs > nowMs) {
          continue
        }

        if (!targetCycle || cycle.completesAtMs < targetCycle.completesAtMs) {
          targetState = state

          targetCycle = cycle
        }
      }

      if (!targetState || !targetCycle) {
        break
      }

      const durationMs = Math.max(0, targetCycle.completesAtMs - targetCycle.startedAtMs)

      if (budgetUsedMs + durationMs > PRODUCTION_OFFLINE_CAP_SECONDS * 1000) {
        break
      }

      budgetUsedMs += durationMs

      targetState.activeCycle = undefined

      for (const reward of this.rollRewards(targetCycle)) {
        if (!registry.has(reward.materialId) || reward.amount <= 0) {
          continue
        }

        const overflow = bag.add(registry.get(reward.materialId), reward.amount)

        this.pendingEvents.push({
          siteId: targetCycle.siteId,
          materialId: reward.materialId,
          amount: reward.amount,
          overflow: overflow > 0 ? overflow : undefined,
        })
      }

      settled += 1

      if (targetState.autoRestart && this.canStart(targetCycle.siteId)) {
        this.startCycle(targetCycle.siteId, currentRealmId, targetCycle.completesAtMs)
      }
    }

    return settled
  }

  // =========================
  // Reward rolls (§5/§6) — roll SAU hoàn thành bằng seed snapshot
  // =========================

  /**
   * Roll toàn bộ reward của một cycle từ seed + bảng theo version
   * snapshot. Cùng collectionRealmId + level → cùng deadline, bất kể
   * phẩm/niên đại roll ra (§4.1).
   */
  rollRewards(cycle: ProductionCycle): ResolvedProductionReward[] {
    const random = mulberry32(cycle.rollSeed)

    const definition = this.getSiteDefinition(cycle.siteId)

    if (!definition) {
      return []
    }

    const profile = getTierWeightProfile(cycle.collectionRealmId, this.deps.territory.realmIds)

    const tierIndex = rollWeightedIndex(profile, random)

    const tierRealmId = this.deps.territory.realmIds[tierIndex]

    if (!tierRealmId) {
      return []
    }

    if (definition.kind === 'forest') {
      const entry = this.deps.forestRewards.find((reward) => reward.realmId === tierRealmId)

      if (!entry) {
        return []
      }

      const amount =
        entry.amount > 0 ? entry.amount : (FOREST_WOOD_AMOUNTS_BY_TIER_INDEX[tierIndex] ?? 1)

      return [{ materialId: entry.materialId, amount }]
    }

    if (definition.kind === 'mine') {
      const pool = this.deps.mineRewards.filter((reward) => reward.realmId === tierRealmId)

      if (pool.length === 0) {
        return []
      }

      const qualityIndex = rollWeightedIndex(
        ORE_QUALITIES.map((quality) => ORE_QUALITY_WEIGHTS[quality]),
        random,
      )

      const quality = ORE_QUALITIES[qualityIndex] ?? 'hoang'

      const entry = pool.find((reward) => reward.quality === quality)

      if (!entry) {
        return []
      }

      return [
        {
          materialId: entry.materialId,
          amount: ORE_QUALITY_AMOUNTS[quality],
          detail: quality,
        },
      ]
    }

    // Grotto: tier → thảo trong pool tier → niên đại (§6.1 hai bước roll).
    const pool = this.deps.grottoHerbs.filter((herb) => herb.realmId === tierRealmId)

    if (pool.length === 0) {
      return []
    }

    // Nhóm theo đan phương (identity), roll identity đều trước rồi roll
    // niên đại theo trọng số (§6.2 — niên đại roll độc lập trong tier).
    const identities = Array.from(new Set(pool.map((herb) => herb.pillRecipeId)))

    const identityId = identities[Math.floor(random() * identities.length) % identities.length]

    const ageVariants = pool.filter((herb) => herb.pillRecipeId === identityId)

    const ageIndex = rollWeightedIndex(
      HERB_AGES.map((age) => HERB_AGE_WEIGHTS[age]),
      random,
    )

    const age = HERB_AGES[ageIndex] ?? 'decade'

    const chosen = ageVariants.find((herb) => herb.age === age) ?? ageVariants[0]

    if (!chosen) {
      return []
    }

    return [
      {
        materialId: chosen.materialId,
        amount: GROTTO_HERB_AMOUNT,
        detail: age,
      },
    ]
  }

  /** Hiệu ứng speed hiện tại/kế cho UI card (§9.1). */
  getSiteView(siteId: string, nowMs: number):
    | {
        definition: ProductionSiteDefinition

        state: ProductionSiteState

        speedMultiplier: number

        nextSpeedMultiplier?: number

        cycleRemainingMs?: number

        cycleTotalMs?: number
      }
    | undefined {
    const definition = this.getSiteDefinition(siteId)

    if (!definition) {
      return undefined
    }

    const state = this.ensureSiteState(siteId)

    const view = {
      definition,
      state,
      speedMultiplier: getSiteSpeedMultiplier(state.level),
      nextSpeedMultiplier:
        state.level < definition.maxLevel ? getSiteSpeedMultiplier(state.level + 1) : undefined,
      cycleRemainingMs: undefined as number | undefined,
      cycleTotalMs: undefined as number | undefined,
    }

    const cycle = state.activeCycle

    if (cycle) {
      const baseSeconds = CYCLE_BASE_SECONDS_BY_REALM[cycle.collectionRealmId] ?? 100

      view.cycleTotalMs = computeCycleSeconds(baseSeconds, cycle.siteLevelAtStart) * 1000

      view.cycleRemainingMs = Math.max(0, cycle.completesAtMs - nowMs)
    }

    return view
  }
}

// =========================
// Helpers nội bộ
// =========================

/**
 * Version bảng reward hiện hành — bump khi đổi balance data để cycle
 * đang chạy vẫn roll theo bảng cũ (snapshot §4.1).
 */
const REWARD_TABLE_VERSION = 1
