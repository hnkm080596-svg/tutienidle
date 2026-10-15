import { cursorFor, issueProductionIdentity, cycleSettled, markCycleSettled, validateProductionCursor, admitCycleIdentity, rollbackUnpublishedIssuance } from './ProductionReceiptCursor'
import type { MaterialReceipt } from '../material/MaterialReceipt'
// ProductionSystem owns Lam, Mine, and Grotto production. Each active
// site owns one independent cycle. Start-time realm, level, reward-table
// version, and seed are snapshotted; rewards are granted once at
// completion, and offline settlement stays within the configured cap.

import type { MaterialBag } from '../material/MaterialBag'
import type { MaterialRegistry } from '../material/MaterialRegistry'
import { SPIRIT_STONE_MATERIAL_ID } from '../material/SpiritStoneMaterial'
import type {
  ForestRewardDefinition,
  GrottoHerbDefinition,
  MineRewardDefinition,
  ProductionCycle,
  ProductionSiteDefinition,
  ProductionSiteState,
  ProductionSiteStateInput,
  TerritoryDefinition,
} from './ProductionTypes'
import {
  productionBaseSeconds,
  GROTTO_HERB_AMOUNT,
  HERB_AGE_WEIGHTS,
  MATERIAL_AGE_AMOUNTS,
  MATERIAL_AGE_WEIGHTS,
  PRODUCTION_ESSENCE_AMOUNT,
  PRODUCTION_ESSENCE_BY_KIND,
  PRODUCTION_OUTCOME_WEIGHTS,
  computeCycleSeconds,
  getSiteSpeedMultiplier,
  getTierWeightProfile,
  mulberry32,
  rollWeightedIndex,
} from './ProductionBalance'
import { HERB_AGES } from './ProductionTypes'
import { resolveTerritoryTier } from './ProductionCatalog'
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
  receipt: MaterialReceipt | null
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

  /**
   * GP-01 - authorized live-time owner for restore/settle deadlines.
   * GameManager injects `() => time.now()`; direct-construction
   * fixtures fall back to the wall clock, preserving pre-migration
   * behavior. Explicit `nowMs` params still win - callers pass them.
   */
  now?: () => number
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

  private nowMs(): number {
    return this.deps.now?.() ?? Date.now()
  }

  // =========================
  // State management
  // =========================

  /** Tao state level 1 idle cho site chua co trong save (migration/boot). */
  ensureSiteState(siteId: string): ProductionSiteState {
    let state = this.states.get(siteId)

    if (!state) {
      state = { siteId, level: 1, autoRestart: true, productionCycles: [] }

      this.states.set(siteId, state)
    }

    return state
  }

  /** Retire all issued work without rewards; preserve site configuration and delivery state. */
  cancelPendingCycles(): void {
    for (const state of this.states.values()) {
      const cursor = cursorFor(state)
      cursor.settledThrough = cursor.issuedThrough
      cursor.settledAhead = []
      state.productionCycles = []
    }
  }

  /**
   * M1 (ARCH-001) - restore REPLACES the whole site-state map, and every
   * restored entry is a detached copy (productionCycles included): the
   * payload is a value, so mutating it afterwards must not leak into
   * live state (A3). Whitelisted fields only - legacy keys (e.g. the
   * removed `activeCycle`) are dropped here, not migrated.
   */
  restoreStates(states: ProductionSiteStateInput[], restoreNowMs: number = this.nowMs(), replaceReceipts = false): void {
    const previous = new Map(this.states)
    // r29-COR-F1: the shift only fires under a sane restore clock -
    // a non-finite or exact-integer-domain-overflow restoreNowMs from
    // an ungated caller must not re-anchor every began-pair
    // (restoreNowMs = -Infinity turns shiftMs into +Infinity and
    // mints every lane head on the next honest tick). Bad clock ->
    // verbatim restore: post-dated cycles stay parked (deny), honest
    // pairs were never shifted anyway.
    // r30-AUT-3: tightened to [0, 2^52) - a negative re-anchor
    // deep-pasts the cycle (next tick mints), and a stamp re-grounded
    // at >= 2^52 self-refuses the next save write.
    const clockOk = Number.isFinite(restoreNowMs) && restoreNowMs >= 0 && restoreNowMs < 2 ** 52
    this.states.clear()

    for (const state of states) {
      // Mission A review (MA-R1-04) defense-in-depth: a payload that
      // bypassed preflight can carry an unknown siteId - such a site
      // cannot produce without a definition
      // -> cycleMs 0), draining capacity. Drop at the boundary.
      if (!this.siteDefinitionsById.has(state.siteId)) {
        continue
      }

      const priorCursor = replaceReceipts ? undefined : previous.get(state.siteId)?.receiptCursor
      let receiptCursor = state.receiptCursor ? structuredClone(state.receiptCursor) : priorCursor
      if (priorCursor && receiptCursor && !replaceReceipts) {
        const settledThrough = Math.max(priorCursor.settledThrough, receiptCursor.settledThrough)
        receiptCursor = { issuedThrough: Math.max(priorCursor.issuedThrough, receiptCursor.issuedThrough), settledThrough,
          settledAhead: [...new Set([...priorCursor.settledAhead, ...receiptCursor.settledAhead])].filter((ordinal) => ordinal > settledThrough),
          legacyOrigins: [...new Map([...priorCursor.legacyOrigins, ...receiptCursor.legacyOrigins].map((origin) => [origin.cycleId, origin])).values()] }
      }
      if (receiptCursor && !validateProductionCursor(receiptCursor)) throw new Error('Malformed production receipt cursor')
      const identityOwner: ProductionSiteState = { siteId: state.siteId, level: state.level, autoRestart: true,
        receiptCursor: receiptCursor ? structuredClone(receiptCursor) : undefined }
      this.states.set(state.siteId, {
        receiptCursor: cursorFor(identityOwner),
        siteId: state.siteId,
        level: state.level,
        autoRestart: true,
        productionCycles: (state.productionCycles ?? state.workerCycles ?? []).flatMap((cycle) => {
          // r33-COR-F1/AUT-2: ordering parity with restoreJobs and the
          // validator's ordering pin - an INVERTED pair
          // (completesAtMs <= startedAtMs) is impossible-authored.
          // Parking it verbatim denied the whole site's advance
          // (pending.some freezes every healthy sibling cycle) AND
          // refused every later save write on the ordering pin - a
          // whole-save wedge for content that can never be authored.
          // Drop at the boundary, same as the sibling arm. The drop test
          // runs first, so an inverted pair whose stamps are themselves
          // out-of-domain ({2^52,2^52}, {-Inf,-Inf}...) also drops -
          // strictly-safe direction. A NON-inverted out-of-domain pair
          // still parks verbatim below (deny doctrine) - r34-COR-F3.
          if (cycle.completesAtMs <= cycle.startedAtMs) {
            return []
          }
          // r26-COR-1/AUT-1: a cycle head post-dating the restore clock
          // is impossible-authored - startedAtMs is a began-time pinned
          // <= lastSavedAt at admission, so only a uniformly-shifted
          // (skewed-clock/crafted) pair reaches here. Re-ground it at the
          // restore clock, shifting completesAtMs by the same delta so
          // the authored span stays exact: the cycle resumes as a live
          // in-flight cycle instead of idling past the next save marker
          // and self-bricking every write. Honest stamps are untouched.
          // r31-COR-F-HEADROOM (sibling): minted completesAtMs =
          // restoreNowMs + authored span must fit the persisted domain
          // - else keep the pair verbatim (parked, deny).
          // r32-AUT-2: an inverted pair (completes <= started) has a
          // negative span, so the headroom holds trivially and the shift
          // mints a FRESH inverted pair - ordering-denied by
          // the cycle advance yet refusing the persisted ordering pin
          // on every later write. (Handled above: inverted pairs drop.)
          if (
            clockOk &&
            cycle.startedAtMs > restoreNowMs &&
            restoreNowMs + (cycle.completesAtMs - cycle.startedAtMs) < 2 ** 52
          ) {
            const shiftMs = cycle.startedAtMs - restoreNowMs
            return [{
              ...admitCycleIdentity(identityOwner, cycle),
              startedAtMs: cycle.startedAtMs - shiftMs,
              completesAtMs: cycle.completesAtMs - shiftMs,
            }]
          }
          return [admitCycleIdentity(identityOwner, cycle)]
        }),
        hiddenChannelCycles: state.hiddenChannelCycles
          ? { ...state.hiddenChannelCycles }
          : undefined,
      })
    }
  }

  // D2 - query surfaces hand out detached snapshots (cycle values
  // copied too): callers observe, they never mutate the live domain
  // record (A3). Writes go through the domain commands.
  private snapshotState(state: ProductionSiteState): ProductionSiteState {
    return {
      ...state,
      productionCycles: state.productionCycles?.map((cycle) => ({ ...cycle })),
      receiptCursor: state.receiptCursor ? structuredClone(state.receiptCursor) : undefined,
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
    const spiritStoneId = SPIRIT_STONE_MATERIAL_ID

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

    const spiritStoneId = SPIRIT_STONE_MATERIAL_ID

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
   * Each active site advances exactly one independent production cycle.
   * Carried legacy cycles remain eligible to settle, but do not create
   * additional parallel production capacity.
   */
  tick(
    nowMs: number,
    bag: MaterialBag,
    registry: MaterialRegistry,
    currentRealmId: string,
    rng?: () => number,
  ): void {
    // Retained cycles keep their deadlines and settle once even when a
    // site is no longer active. Only a total absence of work skips the pass.
    const advanceableStates = [...this.states.values()].filter(
      state => state.autoRestart || (state.productionCycles?.length ?? 0) > 0,
    )
    if (advanceableStates.length === 0) return

    // Each enabled production site owns one cycle clock. Capacity and
    // legacy assignments are intentionally ignored.

    // Mission D (spec D2) - resolve the player's realm to a supported
    // territory tier ONCE at the boundary; every spawned cycle snapshots
    // the clamped id.
    const collectionRealmId = resolveTerritoryTier(this.deps.territory, currentRealmId)

    for (const state of advanceableStates) {
      bag.prepareCredit()
      const beforeIssued = cursorFor(state).issuedThrough
      state.productionCycles ??= []

      const definition = this.getSiteDefinition(state.siteId)

      const baseSeconds = definition ? productionBaseSeconds(definition.kind, collectionRealmId) : 0

      const cycleMs =
        definition && baseSeconds ? computeCycleSeconds(baseSeconds, state.level) * 1000 : 0

      // Online advancement observes each deadline once. A completed
      // cycle can be followed by at most one new cycle on a later tick.
      const result = advanceWorkerLanes({
        siteId: state.siteId,
        collectionRealmId,
        siteLevel: state.level,
        baseSeconds: baseSeconds ?? 0,
        cycleMs,
        pending: state.productionCycles,
        slots: state.autoRestart ? 1 : 0,
        nowMs,
        emptyLaneStartMs: nowMs,
        advanceMode: 'observe',
        issueIdentity: () => issueProductionIdentity(state),
        rng,
      })

      try {
        for (const cycle of result.completed) this.grantCycleRewards(cycle, bag, registry)
        state.productionCycles = result.pending
      } catch (error) {
        rollbackUnpublishedIssuance(state, beforeIssued)
        throw error
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
   * Pending production cycles are saved and settle offline under the
   * persisted to the save and settles offline under the whole cap
   * configured offline cap budget.
   * Returns the number of completed cycles granted.
   */
  settleOffline(
    bag: MaterialBag,
    registry: MaterialRegistry,
    currentRealmId: string,
    nowMs: number = this.nowMs(),
    options: {
      offlineSinceMs?: number
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

      // GP-01 - persisted completesAtMs stamps live in the epoch the
      // live production tick reads (the authority when injected).
      fieldNow: () => this.nowMs(),
    }
  }

  /** Cong reward cua mot cycle vao Bag + ghi settle event (dung chung moi duong settle). */
  private grantCycleRewards(cycle: ProductionCycle, bag: MaterialBag, registry: MaterialRegistry): void {
    const state = this.states.get(cycle.siteId)
    if (!state || cycleSettled(state, cycle)) return
    bag.prepareCredit()
    const counters = state.hiddenChannelCycles ? { ...state.hiddenChannelCycles } : undefined
    try {
      const rewards = [...this.rollRewards(cycle), ...this.rollHiddenChannelRewards(cycle, registry)]
        .filter((reward) => registry.has(reward.materialId) && reward.amount > 0)
      const grants = bag.creditBatch(rewards.map((reward, index) => ({ material: registry.get(reward.materialId), amount: reward.amount,
        sourceId: `production:${cycle.siteId}:${cycle.receiptOrdinal}:${index}` })))
      for (const [index, grant] of grants.entries()) {
        this.pendingEvents.push({ siteId: cycle.siteId, materialId: grant.materialId, amount: rewards[index]!.amount,
          overflow: grant.overflow > 0 ? grant.overflow : undefined, receipt: grant.receipt })
      }
      markCycleSettled(state, cycle)
    } catch (error) {
      state.hiddenChannelCycles = counters
      throw error
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

    // First roll: 75% dust/essence (index 0) vs 25% site product (index 1).
    // Only when the product branch is chosen does the site proceed to roll
    // the product's quality/age tier.
    const outcomeIndex = rollWeightedIndex(PRODUCTION_OUTCOME_WEIGHTS, random)

    if (outcomeIndex < 0) {
      return []
    }

    if (outcomeIndex === 0) {
      return [
        {
          materialId: PRODUCTION_ESSENCE_BY_KIND[definition.kind],
          amount: PRODUCTION_ESSENCE_AMOUNT,
          detail: 'essence',
        },
      ]
    }

    if (definition.kind === 'forest' || definition.kind === 'mine') {
      const pool = definition.kind === 'forest' ? this.deps.forestRewards : this.deps.mineRewards
      const ageIndex = rollWeightedIndex(HERB_AGES.map(age => MATERIAL_AGE_WEIGHTS[age]), random)
      const age = ageIndex >= 0 ? HERB_AGES[ageIndex] : undefined
      if (age === undefined) return []
      const entry = pool.find(reward => reward.age === age)
      if (!entry) return []
      return [{ materialId: entry.materialId, amount: entry.amount > 0 ? entry.amount : MATERIAL_AGE_AMOUNTS[age], detail: age }]
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
        baseOutputPerSecond?: { min: number; max: number }
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
      : { siteId, level: 1, autoRestart: false, productionCycles: [] }

    const view = {
      definition,
      state,
      productionSpeedMultiplier: getSiteSpeedMultiplier(state.level),
      nextProductionSpeedMultiplier:
        state.level < definition.maxLevel ? getSiteSpeedMultiplier(state.level + 1) : undefined,
      cycleRemainingMs: undefined as number | undefined,
      cycleTotalMs: undefined as number | undefined,
      baseOutputPerSecond: undefined as { min: number; max: number } | undefined,
    }

    const lanes = state.productionCycles ?? []

    let earliest: ProductionCycle | undefined

    for (const cycle of lanes) {
      if (!earliest || cycle.completesAtMs < earliest.completesAtMs) {
        earliest = cycle
      }
    }

    const fallbackRealmId = this.deps.territory.realmIds[0] ?? 'mortal'
    if (earliest) {
      view.cycleTotalMs = Math.max(1, earliest.completesAtMs - earliest.startedAtMs)
      view.cycleRemainingMs = Math.max(0, earliest.completesAtMs - nowMs)
    } else {
      const baseSeconds = productionBaseSeconds(definition.kind, fallbackRealmId)
      if (baseSeconds) {
        view.cycleTotalMs = computeCycleSeconds(baseSeconds, state.level) * 1000
      }
    }

    if (view.cycleTotalMs && view.cycleTotalMs > 0) {
      const rateRealmId = earliest?.collectionRealmId ?? fallbackRealmId
      const profile = getTierWeightProfile(rateRealmId, this.deps.territory.realmIds)
      const reached = getRealmIndex(rateRealmId)
      const realms = this.deps.territory.realmIds.filter((realm, index) =>
        (profile[index] ?? 0) > 0 && getRealmIndex(realm) <= reached,
      )
      const amounts: number[] = [PRODUCTION_ESSENCE_AMOUNT]
      if (definition.kind === 'grotto') {
        for (const realm of realms) {
          const hasHerbs = this.deps.grottoHerbs.some(herb => herb.realmId === realm && betaRecipeFamilyOfId(herb.pillRecipeId) !== null)
          amounts.push(hasHerbs ? GROTTO_HERB_AMOUNT : 0)
        }
      } else {
        const pool = definition.kind === 'forest' ? this.deps.forestRewards : this.deps.mineRewards
        for (const age of HERB_AGES) {
          if (MATERIAL_AGE_WEIGHTS[age] <= 0) continue
          const entry = pool.find(reward => reward.age === age)
          amounts.push(entry ? (entry.amount > 0 ? entry.amount : MATERIAL_AGE_AMOUNTS[age]) : 0)
        }
      }
      if (amounts.length > 0) {
        const seconds = view.cycleTotalMs / 1000
        view.baseOutputPerSecond = { min: Math.min(...amounts) / seconds, max: Math.max(...amounts) / seconds }
      }
    }

    return view
  }
}

// =========================
// Helpers noi bo
// =========================
