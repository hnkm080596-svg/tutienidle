// ProductionSystem (plan sec4) - engine production dung chung cho Lam,
// Mine, Grotto. Mission D (spec D3): production runs on worker
// lanes ONLY - workers are required fuel; the manual activeCycle path
// is deleted. Start-time conditions snapshot (realm/level/table
// version/seed), CHI roll reward khi cycle hoan thanh, delivery vao Bag
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
import { getRealmTier, PRODUCIBLE_REALM_TIER_LEAD } from '../realm/RealmTierMap'
import { isBreakthroughAcquisitionEnabled } from '../realm/ReleasePolicy'
import { betaRecipeFamilyOfId, isScopeHidden } from '../betaScope'

/** Mot giao dich settle da xay ra - dung cho notification UI (sec9.1). */
export interface ProductionSettlementEvent {
  siteId: string

  materialId: string

  amount: number

  /** Luong tran stack bi mat (tui day) - 0/undefined neu khong tran. */
  overflow?: number
}

export interface ResolvedProductionReward {
  materialId: string

  amount: number

  /** Metadata hien thi (tier realm / pham / nien dai) - khong gameplay. */
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

  /** Settle events tich luy ke tu lan drain gan nhat (UI notification). */
  private pendingEvents: ProductionSettlementEvent[] = []

  constructor(deps: ProductionSystemDeps) {
    this.deps = deps
    this.siteDefinitionsById = new Map(deps.sites.map((site) => [site.siteId, site]))
  }

  // =========================
  // State management
  // =========================

  /** Tao state level 1 idle cho site chua co trong save (migration/boot). */
  ensureSiteState(siteId: string): ProductionSiteState {
    let state = this.states.get(siteId)

    if (!state) {
      state = { siteId, level: 1, autoRestart: false, activeWorkerSlots: 0, workerCycles: [] }

      this.states.set(siteId, state)
    }

    return state
  }

  /**
   * M1 (ARCH-001) - restore REPLACES the whole site-state map, and every
   * restored entry is a detached copy (workerCycles included): the
   * payload is a value, so mutating it afterwards must not leak into
   * live state (A3). Whitelisted fields only - legacy keys (e.g. the
   * removed `activeCycle`) are dropped here, not migrated.
   */
  restoreStates(states: ProductionSiteState[], restoreNowMs: number = Date.now()): void {
    // r29-COR-F1: the shift only fires under a sane restore clock -
    // a non-finite or exact-integer-domain-overflow restoreNowMs from
    // an ungated caller must not re-anchor every began-pair
    // (restoreNowMs = -Infinity turns shiftMs into +Infinity and
    // mints every lane head on the next honest tick). Bad clock ->
    // verbatim restore: post-dated cycles stay parked (deny), honest
    // pairs were never shifted anyway.
    // r30-AUT-3: tightened to [0, 2^52) - a negative re-anchor
    // deep-pasts the lane (next tick mints), and a stamp re-grounded
    // at >= 2^52 self-refuses the next save write.
    const clockOk = Number.isFinite(restoreNowMs) && restoreNowMs >= 0 && restoreNowMs < 2 ** 52
    this.states.clear()

    for (const state of states) {
      // Mission A review (MA-R1-04) defense-in-depth: a payload that
      // bypassed preflight can carry an unknown siteId - such a site
      // holds allocated worker slots but never produces (no definition
      // -> cycleMs 0), draining capacity. Drop at the boundary.
      if (!this.siteDefinitionsById.has(state.siteId)) {
        continue
      }

      this.states.set(state.siteId, {
        siteId: state.siteId,
        level: state.level,
        autoRestart: state.autoRestart,
        activeWorkerSlots: state.activeWorkerSlots ?? 0,
        assignedWorkers: state.assignedWorkers,
        workerCycles: (state.workerCycles ?? []).map((cycle) => {
          // r26-COR-1/AUT-1: a cycle head post-dating the restore clock
          // is impossible-authored - startedAtMs is a began-time pinned
          // <= lastSavedAt at admission, so only a uniformly-shifted
          // (skewed-clock/crafted) pair reaches here. Re-ground it at the
          // restore clock, shifting completesAtMs by the same delta so
          // the authored span stays exact: the lane resumes as a live
          // in-flight cycle instead of idling past the next save marker
          // and self-bricking every write. Honest stamps are untouched.
          if (clockOk && cycle.startedAtMs > restoreNowMs) {
            const shiftMs = cycle.startedAtMs - restoreNowMs
            return {
              ...cycle,
              startedAtMs: cycle.startedAtMs - shiftMs,
              completesAtMs: cycle.completesAtMs - shiftMs,
            }
          }
          return { ...cycle }
        }),
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
    // BETA SCOPE LOCK v2 sec.13 - manualWorkforce is scope-hidden: the
    // domain fails closed so a stored request cannot be rewritten through
    // a direct call; persisted assignedWorkers keep their values and the
    // allocator's automatic path covers the site (restored data is not
    // re-checked per the single-check invariant).
    if (isScopeHidden('manualWorkforce')) {
      return false
    }

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
  // Cycle lifecycle (sec4.1)
  // =========================

  setAutoRestart(siteId: string, enabled: boolean): boolean {
    if (!this.getSiteDefinition(siteId)) {
      return false
    }

    this.ensureSiteState(siteId).autoRestart = enabled

    return true
  }

  /**
   * Nang level nguon bang Go + Linh Thach (sink Lam sec5.2). Cycle dang
   * chay giu nguyen levelAtStart. Plan Workstream F - Linh Thach la
   * MATERIAL: check/tru truc tiep tren MaterialBag.
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
  // Tick & offline settle (sec4.3)
  // =========================

  /**
   * Mission D (spec D3) - every lane comes from the shared worker pool;
   * lane count = activeWorkerSlots (no manual slot, no activeCycle).
   *
   * Chi-hien-quan spec (2026-09-02): `assignments` tuy chon - Map
   * siteId -> so slot MANUAL. Sites co assignment (va autoRestart) nhan
   * dung min(assigned, capacity con lai) theo thu tu Map; phan du
   * capacity -> round-robin cho sites auto KHONG co assignment. Khong
   * truyen (hoac Map rong) = auto hoan toan - hanh vi cu giu nguyen.
   */
  tickWorkers(
    nowMs: number,
    bag: MaterialBag,
    registry: MaterialRegistry,
    currentRealmId: string,
    capacity: number,
    assignments?: Map<string, number>,
    rng?: () => number,
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

      // M11 (ARCH-007) - same per-lane advancement mechanism as
      // settleWorkersOffline (A9): 'observe' = single tick - due heads
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
        rng,
      })

      state.workerCycles = result.pending

      for (const cycle of result.completed) {
        this.grantCycleRewards(cycle, bag, registry)
      }
    }
  }

  /**
   * Offline settle tuan tu (sec4.3): settle cac cycle hoan thanh truoc
   * nowMs theo thu tu thoi gian, MOI auto-cycle mot seed/roll rieng -
   * khong nhan mot roll voi so cycle. Ngan sach tong bi chan o cap
   * (sec4.3): khi tong thoi gian cycle da settle vuot cap thi dung.
   *
   * Backlog con lai sau khi het ngan sach (cycle hoan thanh truoc nowMs
   * nhung chua settle) bi HUY khong cap reward va auto-restart bat dau
   * lai tu nowMs - neu de nguyen, tick() online se tra dan toan bo
   * backlog nhieu ngay va cap mat tac dung (review 2026-08-28).
   *
   * Worker (T3 economy-ecosystem-plan): cycle do dang cua worker duoc
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
      /** Chi-hien-quan - assignments snapshot (tu states truoc settle) de
       *  offline khop online. */
      workerAssignments?: Map<string, number>
      /** Seeded stream for rollSeed mints on spawned cycles. */
      rng?: () => number
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

  /** Deps injection cho ProductionOffline.ts - cung pattern washDeps()/refineDeps(). */
  private offlineDeps(): ProductionOfflineDeps {
    return {
      states: this.states,

      getSiteDefinition: (siteId) => this.getSiteDefinition(siteId),

      grantCycleRewards: (cycle, bag, registry) =>
        this.grantCycleRewards(cycle, bag, registry),
    }
  }

  /** Cong reward cua mot cycle vao Bag + ghi settle event (dung chung moi duong settle). */
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
    // BETA SCOPE LOCK v2 sec.14 - hidden channels are part of the
    // scope-hidden hidden domain: while hiddenContent is off the channel
    // engine stays frozen (no counter advance, no draw, no emission),
    // matching the HiddenBeastSystem counter freeze.
    if (isScopeHidden('hiddenContent')) {
      return []
    }

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
  // Reward rolls (sec5/sec6) - roll SAU hoan thanh bang seed snapshot
  // =========================

  /**
   * Roll toan bo reward cua mot cycle tu seed + bang theo version
   * snapshot. Cung collectionRealmId + level -> cung deadline, bat ke
   * pham/nien dai roll ra (sec4.1).
   */
  rollRewards(cycle: ProductionCycle): ResolvedProductionReward[] {
    const random = mulberry32(cycle.rollSeed)

    const definition = this.getSiteDefinition(cycle.siteId)

    if (!definition) {
      return []
    }

    const collectionRealmId = resolveTerritoryTier(
      this.deps.territory,
      cycle.collectionRealmId,
    )

    const profile = getTierWeightProfile(
      collectionRealmId,
      this.deps.territory.realmIds,
    )

    // F-MAT-REALM (saveShapeValidation): a holding more than
    // PRODUCIBLE_REALM_TIER_LEAD realm tiers above the collector fails
    // producibility, so the tier roll caps at the same ceiling - a
    // mortal cycle can still pull qi_refining materials but can never
    // mint foundation_establishment ones (the un-capped low profile
    // leaked them ~11% of the time and corrupted mortal saves). The
    // bound compares real realm tiers, not realmIds positions, so a
    // territory ladder with gaps stays inside the validator window.
    const collectionTier = getRealmTier(collectionRealmId)

    const cappedProfile = profile.map((weight, index) => {
      const candidateRealmId = this.deps.territory.realmIds[index]
      return candidateRealmId !== undefined &&
        getRealmTier(candidateRealmId) <= collectionTier + PRODUCIBLE_REALM_TIER_LEAD
        ? weight
        : 0
    })

    const tierIndex = rollWeightedIndex(cappedProfile, random)

    // r14-INT-4: the all-zero pool returns the -1 sentinel - guard it
    // explicitly like the ageIndex sites below instead of relying on
    // realmIds[-1] -> undefined.
    if (tierIndex < 0) {
      return []
    }

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

      // r13-AUT-3: all-zero pool returns -1 - no eligible entry pays.
      const age = ageIndex >= 0 ? HERB_AGES[ageIndex] : undefined
      if (age === undefined) {
        return []
      }

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

      // r13-AUT-3: all-zero pool returns -1 - no eligible entry pays.
      const age = ageIndex >= 0 ? HERB_AGES[ageIndex] : undefined
      if (age === undefined) {
        return []
      }

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

    // Grotto: tier -> thao trong pool tier -> nien dai (sec6.1 hai buoc roll).
    // BETA SCOPE LOCK v2 sec.12/sec.17 - herbs of dormant recipe families
    // have no beta sink (the brew gate rejects them), so the faucet
    // closes at the roll: identity admission is filtered to
    // beta-enabled families, which also concentrates the live pool's
    // odds onto herbs beta recipes can consume.
    const pool = this.deps.grottoHerbs.filter(
      (herb) =>
        herb.realmId === tierRealmId && betaRecipeFamilyOfId(herb.pillRecipeId) !== null,
    )

    if (pool.length === 0) {
      return []
    }

    // Nhom theo dan phuong (identity), roll identity deu truoc roi roll
    // nien dai theo trong so (sec6.2 - nien dai roll doc lap trong tier).
    const identities = Array.from(new Set(pool.map((herb) => herb.pillRecipeId)))

    const identityId = identities[Math.floor(random() * identities.length) % identities.length]

    const ageVariants = pool.filter((herb) => herb.pillRecipeId === identityId)

    const ageIndex = rollWeightedIndex(
      HERB_AGES.map((age) => HERB_AGE_WEIGHTS[age]),
      random,
    )

    // r13-AUT-3: all-zero pool returns -1 - no eligible entry pays.
    const age = ageIndex >= 0 ? HERB_AGES[ageIndex] : undefined
    if (age === undefined) {
      return []
    }

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

  /** Hieu ung speed hien tai/ke cho UI card (sec9.1). */
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
// Helpers noi bo
// =========================
