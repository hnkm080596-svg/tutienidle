// GameManagerCompanionOps (companion-gacha Task 4, 2026-09-12) -
// orchestration for the companion gacha surface: token pull, Duyen Phan
// exchange, material feeding. Same DI pattern as GameManagerQuestOps:
// explicit deps object, live active-player closure, no GameManager import.
// Domain rules (rate table, pity, exp curve, feed values) stay in
// core/companion/* - this class only sequences them and owns the
// currency/state mutation (A5).
import { MaterialBag } from '../material/MaterialBag'
import { MaterialRegistry } from '../material/MaterialRegistry'
import { NotificationQueue } from './NotificationQueue'
import type { PlayerData } from '../player/Player'
import type { ItemGrade } from '../item/ItemGrade'
import type { CompanionDefinition } from '../../data/companion/Companions'
import {
  createCompanionInstance,
  DUPLICATE_MAXED_DUYEN_PHAN,
  pullCompanion as rollCompanionPull,
} from '../companion/CompanionGacha'
import type { CompanionPullOutcome } from '../companion/CompanionGacha'
import {
  applyCompanionExp,
  applyConstellationRank,
  companionFeedExpValue,
  isCompanionFeedable,
  isCompanionLevelMaxed,
  MAX_CONSTELLATION_RANK,
} from '../companion/CompanionProgression'
import {
  companionAcquirablePool,
  isCompanionDomainUnlocked,
} from '../companion/CompanionAvailability'
import { COMPANIONS, isBetaCompanionGift } from '../../data/companion/Companions'

// Pull currency. The registry entry ships in Task 6; the ops layer only
// needs the id because MaterialBag stacks carry their own Material object.
export const COMPANION_PULL_TOKEN_ID = 'chieu_hien_lenh'

// Duyen Phan cost per companion grade for the pick-your-own exchange.
export const EXCHANGE_COST: Record<ItemGrade, number> = {
  hoang: 20,
  huyen: 30,
  dia: 60,
  thien: 150,
  tien: 300,
}

// +1 Duyen Phan per pull, including duplicates (design spec section 5).
// The maxed-duplicate bonus rides on outcome.duyenPhanBonus.
const DUYEN_PHAN_PER_PULL = 1

export type PullCompanionResult =
  | { ok: true; outcome: CompanionPullOutcome; duyenPhan: number; pullsSinceRare: number }
  | { ok: false; reason: 'pool_unavailable' | 'missing_token' | 'realm_locked' | 'no_active_player' }

export type ExchangeCompanionResult =
  | { ok: true; definition: CompanionDefinition; kind: 'new' | 'constellation_up'; constellationRankAfter?: number; duyenPhan: number }
  | { ok: false; reason: 'pool_unavailable' | 'unknown_definition' | 'constellation_maxed' | 'insufficient_duyen_phan' | 'realm_locked' | 'no_active_player' }

// M-F-COMPANION-GIFT - the mail/gift claim transaction. The Beta
// companion acquisition channel while the pull pool is closed: record
// lookup -> one-way consume -> grant at pull parity -> one loot toast.
export type ClaimCompanionGiftResult =
  | {
      ok: true
      alreadyClaimed: false
      definition: CompanionDefinition
      kind: 'new' | 'constellation_up' | 'constellation_maxed'
      constellationRankAfter?: number
      duyenPhan: number
    }
  | { ok: true; alreadyClaimed: true; definition: CompanionDefinition }
  | { ok: false; reason: 'unknown_gift' | 'realm_locked' | 'no_active_player' }

export type FeedCompanionResult =
  | { ok: true; expGained: number; levelsGained: number; realmBreakthroughs: string[]; clampedExp: number }
  | { ok: false; reason: 'unknown_instance' | 'unknown_material' | 'not_feedable' | 'level_maxed' | 'insufficient_material' | 'realm_locked' | 'no_active_player' }

export interface GameManagerCompanionOpsDeps {
  materialBag: MaterialBag
  materialRegistry: MaterialRegistry
  notifications: NotificationQueue
  // Live read - GameManager assigns activePlayer via setActivePlayer()
  // AFTER construction, so ops read it through this closure (same
  // deferred pattern as GameManagerQuestOps/GameManagerBuildingOps).
  getActivePlayer: () => PlayerData | undefined
}

export class GameManagerCompanionOps {
  constructor(private readonly deps: GameManagerCompanionOpsDeps) {}

  /**
   * Spend 1 Chieu Hien Lenh and roll the companion pool. Token is removed
   * BEFORE the roll (atomic convention, same as vendor): every post-filter
   * roll yields a result, so a consumed token always produces an outcome.
   */
  pullCompanion(): PullCompanionResult {
    const player = this.deps.getActivePlayer()

    if (!player) {
      return { ok: false, reason: 'no_active_player' }
    }

    if (!isCompanionDomainUnlocked(player.realmId)) {
      return { ok: false, reason: 'realm_locked' }
    }

    // M-F-COMPANION-GIFT: empty pool is an explicit valid state -
    // reject BEFORE any currency check or debit so a closed (or
    // enabled-but-authored-empty) pool can never reach the roll or
    // consume a token.
    const pool = companionAcquirablePool()
    if (pool.length === 0) {
      return { ok: false, reason: 'pool_unavailable' }
    }

    if (!this.deps.materialBag.has(COMPANION_PULL_TOKEN_ID, 1)) {
      return { ok: false, reason: 'missing_token' }
    }

    // Capture the token's Material template BEFORE remove so a throwing
    // roll can refund it (the bag stack carries the template, which keeps
    // this path independent of the Task 6 registry entry).
    const tokenMaterial = this.deps.materialBag.get(COMPANION_PULL_TOKEN_ID)?.material

    this.deps.materialBag.remove(COMPANION_PULL_TOKEN_ID, 1)

    let rolled: ReturnType<typeof rollCompanionPull>

    try {
      // P7-M-G: acquisition reads the acquirable pool only - the full
      // COMPANIONS catalog stays resolvable for owned/future-content
      // instances. Same view the gate above just proved non-empty.
      rolled = rollCompanionPull(player.companions, pool, player.companionPullsSinceRare)
    } catch (error) {
      // Belt-and-suspenders: effective rates are pool-filtered so the roll
      // cannot legitimately throw - refund anyway to keep the op atomic.
      if (tokenMaterial) {
        this.deps.materialBag.add(tokenMaterial, 1)
      }

      throw error
    }

    player.companions = rolled.owned
    player.companionPullsSinceRare = rolled.pullsSinceRare
    player.duyenPhan += DUYEN_PHAN_PER_PULL + rolled.outcome.duyenPhanBonus

    this.deps.notifications.push({ kind: 'loot', message: `Chiêu mộ: ${rolled.outcome.definition.name}` })

    return {
      ok: true,
      outcome: rolled.outcome,
      duyenPhan: player.duyenPhan,
      pullsSinceRare: player.companionPullsSinceRare,
    }
  }

  /**
   * Buy a specific companion with Duyen Phan. Handles exactly like the
   * pull's duplicate path: unowned pushes a fresh instance, owned raises
   * constellationRank in place - and the only hard gate is a maxed
   * constellation (rejected BEFORE touching points, A9).
   */
  exchangeCompanion(definitionId: string): ExchangeCompanionResult {
    const player = this.deps.getActivePlayer()

    if (!player) {
      return { ok: false, reason: 'no_active_player' }
    }

    if (!isCompanionDomainUnlocked(player.realmId)) {
      return { ok: false, reason: 'realm_locked' }
    }

    // M-F-COMPANION-GIFT: same empty-pool contract as pull - rejected
    // before the definition lookup so a closed pool never debits.
    const pool = companionAcquirablePool()
    if (pool.length === 0) {
      return { ok: false, reason: 'pool_unavailable' }
    }

    // P7-M-G: the exchange sells the acquirable pool only - a full-catalog
    // id that is not acquirable reports unknown_definition.
    const definition = pool.find((entry) => entry.id === definitionId)

    if (!definition) {
      return { ok: false, reason: 'unknown_definition' }
    }

    const owned = player.companions.find((instance) => instance.definitionId === definition.id)

    if (owned && owned.constellationRank >= MAX_CONSTELLATION_RANK) {
      return { ok: false, reason: 'constellation_maxed' }
    }

    const cost = EXCHANGE_COST[definition.grade]

    if (player.duyenPhan < cost) {
      return { ok: false, reason: 'insufficient_duyen_phan' }
    }

    player.duyenPhan -= cost

    if (!owned) {
      player.companions.push(createCompanionInstance(definition))

      this.deps.notifications.push({ kind: 'loot', message: `Đổi Duyên Phận: ${definition.name}` })

      return { ok: true, definition, kind: 'new', duyenPhan: player.duyenPhan }
    }

    // PlayerData is a mutable struct: rank up the located instance in
    // place - the 1-instance-per-definition invariant forbids clone-push.
    owned.constellationRank += 1

    this.deps.notifications.push({ kind: 'loot', message: `Đổi Duyên Phận: ${definition.name}` })

    return {
      ok: true,
      definition,
      kind: 'constellation_up',
      constellationRankAfter: owned.constellationRank,
      duyenPhan: player.duyenPhan,
    }
  }

  /**
   * M-F-COMPANION-GIFT - claim one issued gift record: pull-parity
   * grant (new instance / constellation rank-up / maxed -> +5 duyenPhan),
   * one-way consume mark written only after the grant decision, and ONE
   * ops-owned loot notification. Fully idempotent: an already-claimed
   * record is a pure read returning prior state - no grant, no toast.
   */
  claimCompanionGift(giftId: string): ClaimCompanionGiftResult {
    const player = this.deps.getActivePlayer()

    if (!player) {
      return { ok: false, reason: 'no_active_player' }
    }

    if (!isCompanionDomainUnlocked(player.realmId)) {
      return { ok: false, reason: 'realm_locked' }
    }

    const record = player.companionGifts.find((entry) => entry.id === giftId)

    // Defensive: an absent record, an unresolvable definitionId, or a
    // definition outside the Beta gift authority is all unknown to this
    // op (save validation rejects the malformed shapes anyway).
    const definition = record
      ? COMPANIONS.find((entry) => entry.id === record.definitionId)
      : undefined

    if (!record || !definition || !isBetaCompanionGift(definition.id)) {
      return { ok: false, reason: 'unknown_gift' }
    }

    if (record.claimed) {
      return { ok: true, alreadyClaimed: true, definition }
    }

    const owned = player.companions.find(
      (instance) => instance.definitionId === definition.id,
    )

    let kind: 'new' | 'constellation_up' | 'constellation_maxed'
    let constellationRankAfter: number | undefined
    let duyenPhan = 0

    if (!owned) {
      player.companions.push(createCompanionInstance(definition))
      kind = 'new'
    } else {
      const ranked = applyConstellationRank(owned)

      if (ranked.maxed) {
        duyenPhan = DUPLICATE_MAXED_DUYEN_PHAN
        player.duyenPhan += duyenPhan
        kind = 'constellation_maxed'
      } else {
        owned.constellationRank = ranked.instance.constellationRank
        kind = 'constellation_up'
        constellationRankAfter = owned.constellationRank
      }
    }

    // Consume mark lands only on a completed grant.
    record.claimed = true

    this.deps.notifications.push({ kind: 'loot', message: `Quà tặng: ${definition.name}` })

    return {
      ok: true,
      alreadyClaimed: false,
      definition,
      kind,
      constellationRankAfter,
      duyenPhan,
    }
  }

  /**
   * Feed `count` copies of a material to a companion. Level-max rejects
   * BEFORE materialBag.remove so a refused feed leaves the bag untouched.
   */
  feedCompanion(instanceId: string, materialId: string, count: number): FeedCompanionResult {
    const player = this.deps.getActivePlayer()

    if (!player) {
      return { ok: false, reason: 'no_active_player' }
    }

    if (!isCompanionDomainUnlocked(player.realmId)) {
      return { ok: false, reason: 'realm_locked' }
    }

    const index = player.companions.findIndex((instance) => instance.instanceId === instanceId)

    if (index === -1) {
      return { ok: false, reason: 'unknown_instance' }
    }

    const instance = player.companions[index]!

    // "Level-maxed" is the dynamic cap at the player's current realm - it
    // rises when the player breaks through, so this is a per-feed check.
    if (isCompanionLevelMaxed(instance, player.realmId)) {
      return { ok: false, reason: 'level_maxed' }
    }

    if (!this.deps.materialRegistry.has(materialId)) {
      return { ok: false, reason: 'unknown_material' }
    }

    const material = this.deps.materialRegistry.get(materialId)

    // Feed scope is owned by CompanionProgression (isCompanionFeedable):
    // currency/pity tokens and profession inputs reject BEFORE the bag is
    // touched - the panel filters its picker through the same predicate.
    if (!isCompanionFeedable(material)) {
      return { ok: false, reason: 'not_feedable' }
    }

    // A non-positive count is "the bag cannot supply it" - has(id, 0)
    // would otherwise pass vacuously and report a 0-exp success.
    if (!Number.isInteger(count) || count <= 0 || !this.deps.materialBag.has(materialId, count)) {
      return { ok: false, reason: 'insufficient_material' }
    }

    const expGained = companionFeedExpValue(material) * count

    this.deps.materialBag.remove(materialId, count)

    const applied = applyCompanionExp(instance, expGained, player.realmId)
    player.companions[index] = applied.instance

    return {
      ok: true,
      expGained,
      levelsGained: applied.levelsGained,
      realmBreakthroughs: applied.realmBreakthroughs,
      clampedExp: applied.clampedExp,
    }
  }
}
