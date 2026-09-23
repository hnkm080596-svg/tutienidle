// ProductionSystem (plan §4) — engine production dùng chung cho Lâm,
// Mine, Grotto. Mission D (spec D3): production runs on worker
// lanes ONLY - workers are required fuel; the manual activeCycle path
// is deleted. Start-time conditions snapshot (realm/level/table
// version/seed), CHỈ roll reward khi cycle hoàn thành, delivery vào Bag
// idempotent, offline settle runs sequentially within the cap (sec 4.3).

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
  computeCycleSeconds,
  getSiteSpeedMultiplier,
  getTierWeightProfile,
  mulberry32,
  rollWeightedIndex,
} from './ProductionBalance'
import { HERB_AGES } from './ProductionTypes'
import { resolveTerritoryTier } from './ProductionCatalog'
import { allocateWorkerSlots } from './WorkerAllocator'
import { advanceWorkerLanes } from './WorkerLaneAdvance'
import {
  settleProductionOffline,
  type ProductionOfflineDeps,
} from './ProductionOffline'
import {
  hiddenGrottoChannels,
  GROTTO_CHANNEL_SEED_TAG,
  type GrottoChannel,
} from '../../data/drop/HiddenMaterialChannels'
import { getRealmIndex } from '../realm/realmSystem'
import { isBreakthroughAcquisitionEnabled } from '../realm/ReleasePolicy'

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

  /** M-F-BODY-HIDDEN (spec sec.4) - hidden grotto emission channels;
      defaults to the canonical registry (empty today = zero channel
      draws, behavior identical). */
  hiddenGrottoChannels?: readonly GrottoChannel[]
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
   * restored entry is a detached copy (workerCycles included): the
   * payload is a value, so mutating it afterwards must not leak into
   * live state (A3). Whitelisted fields only - legacy keys (e.g. the
   * removed `activeCycle`) are dropped here, not migrated.
   */
  restoreStates(states: ProductionSiteState[]): void {
    this.states.clear()

    for (const state of states) {
      // Mission A review (MA-R1-04) defense-in-depth: a payload that
      // bypassed preflight can carry an unknown siteId — such a site
      // holds allocated worker slots but never produces (no definition
      // → cycleMs 0), draining capacity. Drop at the boundary.
      if (!this.siteDefinitionsById.has(state.siteId)) {
        continue
      }

      this.states.set(state.siteId, {
        siteId: state.siteId,
        level: state.level,
        autoRestart: state.autoRestart,
        activeWorkerSlots: state.activeWorkerSlots ?? 0,
        assignedWorkers: state.assignedWorkers,
        workerCycles: (state.workerCycles ?? []).map((cycle) => ({ ...cycle })),
        hiddenChannelCycles: state.hiddenChannelCycles
          ? { ...state.hiddenChannelCycles }
          : undefined,
      })
    }
  }

  // D2 - query surfaces hand out detached snapshots (workerCycles
  // copied too): callers observe, they never mutate the live domain
  // record (A3). Writes go through the domain commands.
  private snapshotState(state: ProductionSiteState): ProductionSiteState {
    return {
      ...state,
      workerCycles: state.workerCycles?.map((cycle) => ({ ...cycle })),
      hiddenChannelCycles: state.hiddenChannelCycles
        ? { ...state.hiddenChannelCycles }
        : undefined,
    }
  }

  getAllStates(): ProductionSiteState[] {
    return Array.from(this.states.values(), (state) => this.snapshotState(state))
  }

  getState(siteId: string): ProductionSiteState | undefined {
    const state = this.states.get(siteId)
    return state ? this.snapshotState(state) : undefined
  }

  /**
   * D2 - the ONE command for the manual worker request: clamps the raw
   * count into [0, productionCapacity] (the caller feeds the already-
   * split pool), a non-finite count acts as 0, and undefined clears the
   * request back to auto. False for an unknown site.
   */
  setWorkerAssignment(
    siteId: string,
    count: number | undefined,
    productionCapacity: number,
  ): boolean {
    if (!this.getSiteDefinition(siteId)) {
      return false
    }

    // Assignment is a write command - materializing the level-1 default
    // on a defined site is part of the write (D4: queries no longer
    // create state, so the command path owns materialization).
    const state = this.ensureSiteState(siteId)

    if (count === undefined) {
      delete state.assignedWorkers
      return true
    }

    const capacity = Number.isFinite(productionCapacity)
      ? Math.max(0, Math.floor(productionCapacity))
      : 0
    const safeCount = Number.isFinite(count) ? count : 0

    state.assignedWorkers = Math.max(0, Math.min(Math.floor(safeCount), capacity))

    return true
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
   * Mission D (spec D3) - every lane comes from the shared worker pool;
   * lane count = activeWorkerSlots (no manual slot, no activeCycle).
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

    // D1 (INV-D-03): in-flight lanes are retained work - they keep
    // their own deadlines and settle once even when the pool drops to
    // zero or the site left the auto set. Only a total absence of
    // advanceable work skips the pass.
    const advanceableStates = [...this.states.values()].filter(
      state => state.autoRestart || (state.workerCycles?.length ?? 0) > 0,
    )
    for (const state of this.states.values()) state.activeWorkerSlots = 0
    if (advanceableStates.length === 0) return

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

    // Mission D (spec D2) - resolve the player's realm to a supported
    // territory tier ONCE at the boundary; every spawned lane snapshots
    // the clamped id.
    const collectionRealmId = resolveTerritoryTier(this.deps.territory, currentRealmId)

    for (const state of advanceableStates) {
      state.workerCycles ??= []

      const definition = this.getSiteDefinition(state.siteId)

      const baseSeconds = CYCLE_BASE_SECONDS_BY_REALM[collectionRealmId]

      const cycleMs =
        definition && baseSeconds ? computeCycleSeconds(baseSeconds, state.level) * 1000 : 0

      // M11 (ARCH-007) — same per-lane advancement mechanism as
      // settleWorkersOffline (A9): 'observe' = single tick — due heads
      // grant once, freed lanes refill on the NEXT tick via
      // emptyLaneStartMs (top-up-then-settle order preserved).
      const result = advanceWorkerLanes({
        siteId: state.siteId,
        collectionRealmId,
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
   * persisted to the save and settles offline under the whole cap
   * budget (Mission D - no manual phase eats budget first anymore).
   * Returns the number of worker cycles settled.
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
      resolveTerritoryTier(this.deps.territory, currentRealmId),
      nowMs,
      options,
    )
  }

  /** Deps injection cho ProductionOffline.ts — cùng pattern washDeps()/refineDeps(). */
  private offlineDeps(): ProductionOfflineDeps {
    return {
      states: this.states,

      getSiteDefinition: (siteId) => this.getSiteDefinition(siteId),

      grantCycleRewards: (cycle, bag, registry) =>
        this.grantCycleRewards(cycle, bag, registry),
    }
  }

  /** Cộng reward của một cycle vào Bag + ghi settle event (dùng chung mọi đường settle). */
  private grantCycleRewards(cycle: ProductionCycle, bag: MaterialBag, registry: MaterialRegistry): void {
    // M-F-BODY-HIDDEN (spec sec.4) - hidden-channel emission appends
    // post-table rewards that RIDE this same bag.add/pendingEvents
    // delivery loop; channel draws consume a dedicated stream
    // (rollSeed ^ GROTTO_CHANNEL_SEED_TAG), never the table stream.
    for (const reward of [...this.rollRewards(cycle), ...this.rollHiddenChannelRewards(cycle, registry)]) {
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

  /**
   * M-F-BODY-HIDDEN (spec sec.4) - hidden-channel settle-cycle emission.
   * Grotto sites only: per-channel counter++ on THIS site (reach
   * eligibility - cycle.collectionRealmId must have REACHED the channel
   * band, so channels never expire), bound-or-chance on the dedicated
   * stream, then the release-policy gate at origination
   * (isBreakthroughAcquisitionEnabled - suppressed = no emission, the
   * counter stays primed and retries next cycle). The counter resets
   * ONLY on emission. Fires identically for online ticks and offline
   * settle (both route through grantCycleRewards); restoreStates itself
   * performs no rolls/emission - it rehydrates counters verbatim.
   */
  private rollHiddenChannelRewards(
    cycle: ProductionCycle,
    registry: MaterialRegistry,
  ): ResolvedProductionReward[] {
    const definition = this.getSiteDefinition(cycle.siteId)
    const channels = this.deps.hiddenGrottoChannels ?? hiddenGrottoChannels()

    if (!definition || definition.kind !== 'grotto' || channels.length === 0) {
      return []
    }

    const state = this.states.get(cycle.siteId)

    if (!state) {
      return []
    }

    const emitted: ResolvedProductionReward[] = []
    const channelRng = mulberry32(cycle.rollSeed ^ GROTTO_CHANNEL_SEED_TAG)
    const counters = (state.hiddenChannelCycles ??= {})
    const cycleTierIndex = getRealmIndex(cycle.collectionRealmId)

    for (const channel of channels) {
      const bandIndex = getRealmIndex(channel.bandRealmId)

      // Reach eligibility: unknown ids fail closed; a cycle below the
      // band advances no counter and consumes no channel draw.
      if (cycleTierIndex < 0 || bandIndex < 0 || cycleTierIndex < bandIndex) {
        continue
      }

      const count = (counters[channel.id] ?? 0) + 1
      counters[channel.id] = count

      const bound = channel.guaranteedAfterCycles
      const boundReached = bound !== undefined && count >= bound

      if (!boundReached && channelRng() >= channel.chancePerCycle) {
        continue
      }

      const material = registry.get(channel.materialId)

      if (!material || !isBreakthroughAcquisitionEnabled(material.breakthroughRealmId)) {
        continue
      }

      emitted.push({ materialId: channel.materialId, amount: 1, detail: 'hidden_channel' })
      counters[channel.id] = 0
    }

    return emitted
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

    const profile = getTierWeightProfile(
      resolveTerritoryTier(this.deps.territory, cycle.collectionRealmId),
      this.deps.territory.realmIds,
    )

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

        productionSpeedMultiplier: number

        nextProductionSpeedMultiplier?: number

        cycleRemainingMs?: number

        cycleTotalMs?: number
      }
    | undefined {
    const definition = this.getSiteDefinition(siteId)

    if (!definition) {
      return undefined
    }

    // D4 - a view query must not materialize domain state (queries
    // observe; commands write). An absent site projects the same
    // level-1 idle default ensureSiteState would create, and the view
    // always hands out a detached snapshot - never the live record.
    const existing = this.states.get(siteId)

    const state: ProductionSiteState = existing
      ? this.snapshotState(existing)
      : { siteId, level: 1, autoRestart: false, activeWorkerSlots: 0, workerCycles: [] }

    const view = {
      definition,
      state,
      productionSpeedMultiplier: getSiteSpeedMultiplier(state.level),
      nextProductionSpeedMultiplier:
        state.level < definition.maxLevel ? getSiteSpeedMultiplier(state.level + 1) : undefined,
      cycleRemainingMs: undefined as number | undefined,
      cycleTotalMs: undefined as number | undefined,
    }

    const lanes = state.workerCycles ?? []

    let earliest: ProductionCycle | undefined

    for (const cycle of lanes) {
      if (!earliest || cycle.completesAtMs < earliest.completesAtMs) {
        earliest = cycle
      }
    }

    if (earliest) {
      view.cycleTotalMs = Math.max(1, earliest.completesAtMs - earliest.startedAtMs)
      view.cycleRemainingMs = Math.max(0, earliest.completesAtMs - nowMs)
    }

    return view
  }
}

// =========================
// Helpers nội bộ
// =========================
