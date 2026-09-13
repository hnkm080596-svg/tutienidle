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
  GROTTO_HERB_AMOUNT,
  HERB_AGE_WEIGHTS,
  MATERIAL_AGE_AMOUNTS,
  MATERIAL_AGE_WEIGHTS,
  PRODUCTION_OFFLINE_CAP_SECONDS,
  computeCycleSeconds,
  getSiteSpeedMultiplier,
  getTierWeightProfile,
  mulberry32,
  rollWeightedIndex,
} from './ProductionBalance'
import { HERB_AGES } from './ProductionTypes'
import { allocateWorkerSlots } from './WorkerAllocator'
import { advanceWorkerLanes } from './WorkerLaneAdvance'
import { buildProductionCycle as buildCycle } from './ProductionCycles'
import {
  settleProductionOffline,
  type ProductionOfflineDeps,
} from './ProductionOffline'

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

  /**
   * M1 (ARCH-001) — restore REPLACES the whole site-state map, and every
   * restored entry is a detached copy (activeCycle/workerCycles included):
   * the payload is a value, so mutating it afterwards must not leak into
   * live state (A3).
   */
  restoreStates(states: ProductionSiteState[]): void {
    this.states.clear()

    for (const state of states) {
      this.states.set(state.siteId, {
        ...state,
        activeWorkerSlots: state.activeWorkerSlots ?? 0,
        activeCycle: state.activeCycle ? { ...state.activeCycle } : undefined,
        workerCycles: (state.workerCycles ?? []).map((cycle) => ({ ...cycle })),
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

  /**
   * R9 (AR-23) - authoritative upgrade quote: the operation's own read
   * model for costs/gate/affordability. Presentation renders this instead
   * of reproducing the gate logic (ProductionPanel duplicate removed).
   */
  quoteSiteUpgrade(
    siteId: string,
    bag: MaterialBag,
    currentRealmTier?: number,
  ): {
    upgradable: boolean
    reasons: Array<'max_level' | 'no_cost' | 'realm_gate' | 'missing_wood' | 'missing_spirit_stone'>
    cost: { woodMaterialId: string; woodAmount: number; spiritStone: number; spiritStoneId: string } | undefined
  } {
    const definition = this.getSiteDefinition(siteId)

    const state = this.states.get(siteId)

    const reasons: Array<'max_level' | 'no_cost' | 'realm_gate' | 'missing_wood' | 'missing_spirit_stone'> = []

    if (!definition || !state || state.level >= definition.maxLevel) {
      return { upgradable: false, reasons: ['max_level'], cost: undefined }
    }

    const cost = definition.upgradeCosts[state.level - 1]

    if (!cost) {
      return { upgradable: false, reasons: ['no_cost'], cost: undefined }
    }

    const targetLevel = state.level + 1

    const spiritStoneId = getSpiritStoneMaterialIdForRealmTier(targetLevel)

    if (currentRealmTier !== undefined && currentRealmTier < targetLevel) {
      reasons.push('realm_gate')
    }

    if (!bag.has(cost.woodMaterialId, cost.woodAmount)) {
      reasons.push('missing_wood')
    }

    if (!bag.has(spiritStoneId, cost.spiritStone)) {
      reasons.push('missing_spirit_stone')
    }

    return {
      upgradable: reasons.length === 0,
      reasons,
      cost: { woodMaterialId: cost.woodMaterialId, woodAmount: cost.woodAmount, spiritStone: cost.spiritStone, spiritStoneId },
    }
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

      this.grantCycleRewards(cycle, bag, registry)

      if (state.autoRestart && this.canStart(cycle.siteId)) {
        // Chặn backdate quá cap — tab bị throttle/đóng lâu ngày từng khiến
        // chuỗi auto-restart nối ngược về quá khứ và trả TOÀN BỘ backlog
        // nhiều ngày trong vài phút, vô hiệu hoá cap offline (review
        // 2026-08-28). Chain chỉ được lùi tối đa bằng cap.
        const earliestRestartMs = nowMs - PRODUCTION_OFFLINE_CAP_SECONDS * 1000

        this.startCycle(cycle.siteId, currentRealmId, Math.max(cycle.completesAtMs, earliestRestartMs))
      }
    }
  }

  /**
   * Phân bổ pool worker và vận hành các cycle bổ sung. Slot đầu tiên
   * vẫn là activeCycle thủ công để không đổi contract UI cũ.
   *
   * Chi-hien-quan spec (2026-09-02): `assignments` tùy chọn — Map
   * siteId → số slot MANUAL. Sites có assignment (và autoRestart) nhận
   * đúng min(assigned, capacity còn lại) theo thứ tự Map; phần dư
   * capacity → round-robin cho sites auto KHÔNG có assignment. Không
   * truyền (hoặc Map rỗng) = auto hoàn toàn — hành vi cũ giữ nguyên.
   */
  tickWorkers(
    nowMs: number,
    bag: MaterialBag,
    registry: MaterialRegistry,
    currentRealmId: string,
    capacity: number,
    assignments?: Map<string, number>,
  ): void {
    const activeStates = [...this.states.values()].filter(state => state.autoRestart)
    for (const state of this.states.values()) state.activeWorkerSlots = 0
    if (activeStates.length === 0 || capacity <= 0) return

    const assignmentMap = assignments ?? new Map<string, number>()

    // R7 (AR-07): one allocation rule - the shared pure allocator.
    // Manual sites first (min(assigned, remaining)); remainder
    // round-robins UNASSIGNED sites; leftover capacity stays idle
    // instead of crashing (no zero-eligible-site exception).
    const slotsBySite = allocateWorkerSlots(
      activeStates.map(state => state.siteId),
      assignmentMap,
      capacity,
    )

    for (const state of activeStates) {
      state.activeWorkerSlots = slotsBySite.get(state.siteId) ?? 0
    }

    for (const state of activeStates) {
      state.workerCycles ??= []

      const definition = this.getSiteDefinition(state.siteId)

      const baseSeconds = CYCLE_BASE_SECONDS_BY_REALM[currentRealmId]

      const cycleMs =
        definition && baseSeconds ? computeCycleSeconds(baseSeconds, state.level) * 1000 : 0

      // M11 (ARCH-007) — same per-lane advancement mechanism as
      // settleWorkersOffline (A9): 'observe' = single tick — due heads
      // grant once, freed lanes refill on the NEXT tick via
      // emptyLaneStartMs (top-up-then-settle order preserved).
      const result = advanceWorkerLanes({
        siteId: state.siteId,
        collectionRealmId: currentRealmId,
        siteLevel: state.level,
        baseSeconds: baseSeconds ?? 0,
        cycleMs,
        pending: state.workerCycles,
        slots: state.activeWorkerSlots,
        nowMs,
        emptyLaneStartMs: nowMs,
        advanceMode: 'observe',
      })

      state.workerCycles = result.pending

      for (const cycle of result.completed) {
        this.grantCycleRewards(cycle, bag, registry)
      }
    }
  }

  /**
   * Offline settle tuần tự (§4.3): settle các cycle hoàn thành trước
   * nowMs theo thứ tự thời gian, MỖI auto-cycle một seed/roll riêng —
   * không nhân một roll với số cycle. Ngân sách tổng bị chặn ở cap
   * (§4.3): khi tổng thời gian cycle đã settle vượt cap thì dừng.
   *
   * Backlog còn lại sau khi hết ngân sách (cycle hoàn thành trước nowMs
   * nhưng chưa settle) bị HUỶ không cấp reward và auto-restart bắt đầu
   * lại từ nowMs — nếu để nguyên, tick() online sẽ trả dần toàn bộ
   * backlog nhiều ngày và cap mất tác dụng (review 2026-08-28).
   *
   * Worker (T3 economy-ecosystem-plan): cycle dở dang của worker được
   * persist vào save và settle offline trong phần ngân sách còn lại,
   * chạy nối tiếp như slot tay. Trả về số cycle đã settle (manual + worker).
   */
  settleOffline(
    bag: MaterialBag,
    registry: MaterialRegistry,
    currentRealmId: string,
    nowMs: number = Date.now(),
    options: {
      workerCapacity?: number
      offlineSinceMs?: number
      /** Chi-hien-quan — assignments snapshot (từ states trước settle) để
       *  offline khớp online. */
      workerAssignments?: Map<string, number>
    } = {},
  ): number {
    return settleProductionOffline(
      this.offlineDeps(),
      bag,
      registry,
      currentRealmId,
      nowMs,
      options,
    )
  }

  /** Deps injection cho ProductionOffline.ts — cùng pattern washDeps()/refineDeps(). */
  private offlineDeps(): ProductionOfflineDeps {
    return {
      states: this.states,

      getSiteDefinition: (siteId) => this.getSiteDefinition(siteId),

      canStart: (siteId) => this.canStart(siteId),

      startCycle: (siteId, collectionRealmId, nowMs) =>
        this.startCycle(siteId, collectionRealmId, nowMs),

      grantCycleRewards: (cycle, bag, registry) =>
        this.grantCycleRewards(cycle, bag, registry),
    }
  }

  /** Cộng reward của một cycle vào Bag + ghi settle event (dùng chung mọi đường settle). */
  private grantCycleRewards(cycle: ProductionCycle, bag: MaterialBag, registry: MaterialRegistry): void {
    for (const reward of this.rollRewards(cycle)) {
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
      const pool = this.deps.forestRewards.filter((reward) => reward.realmId === tierRealmId)

      if (pool.length === 0) {
        return []
      }

      const ageIndex = rollWeightedIndex(
        HERB_AGES.map((age) => MATERIAL_AGE_WEIGHTS[age]),
        random,
      )

      const age = HERB_AGES[ageIndex] ?? 'decade'

      const entry = pool.find((reward) => reward.age === age)

      if (!entry) {
        return []
      }

      return [
        {
          materialId: entry.materialId,
          amount: entry.amount > 0 ? entry.amount : MATERIAL_AGE_AMOUNTS[age],
          detail: age,
        },
      ]
    }

    if (definition.kind === 'mine') {
      const pool = this.deps.mineRewards.filter((reward) => reward.realmId === tierRealmId)

      if (pool.length === 0) {
        return []
      }

      const ageIndex = rollWeightedIndex(
        HERB_AGES.map((age) => MATERIAL_AGE_WEIGHTS[age]),
        random,
      )

      const age = HERB_AGES[ageIndex] ?? 'decade'

      const entry = pool.find((reward) => reward.age === age)

      if (!entry) {
        return []
      }

      return [
        {
          materialId: entry.materialId,
          amount: MATERIAL_AGE_AMOUNTS[age],
          detail: age,
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
