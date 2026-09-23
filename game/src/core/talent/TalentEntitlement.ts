import type { PlayerData } from '../player/Player'
import type { TalentDefinition, TalentEffect } from './Talent'
import { getTalentDefinition } from '@/data/talent/Talents'
import { BREAKTHROUGH_TALENT_POOLS } from '@/data/talent/BreakthroughTalentPools'
import { isBreakthroughAcquisitionEnabled } from '../realm/ReleasePolicy'

// M-F-TALENT (ruling S15-18, Truc Co mission graph) - the mandatory
// breakthrough talent transaction. ONE committed victory originates ONE
// persisted entitlement; the decision surface offers NEW cards (a
// realm-scoped pool draw bound at settle - deduped vs ownership,
// weighted without replacement, NO reroll in Beta) and UPGRADE rows
// (owned talents with a legal next level); ONE resolution grants ONE
// result. The record persists on PlayerData so the decision survives
// reload; nothing clears it except a successful resolveTalentEntitlement
// (cancel-safe by construction - there is no dismiss path).

/**
 * Canonical entitlement record, created at breakthrough settle inside
 * TribulationOutcomeService.resolveVictory (the committed-outcome seam).
 * `realmId` is the realm the victory is INTO (pool key); `offeredTalentIds`
 * are the NEW-branch cards bound once at origination.
 */
export interface TalentEntitlement {
  realmId: string
  offeredTalentIds: string[]
}

/** The single-result decision: take ONE offered card or upgrade ONE owned talent. */
export type TalentEntitlementDecision =
  | { kind: 'new'; talentId: string }
  | { kind: 'upgrade'; talentId: string }

/** NEW draws at most this many cards (ruling: 3). */
export const BREAKTHROUGH_TALENT_OFFER_COUNT = 3

/** Current level of an owned talent - absent talentLevels entry reads as 1. */
export function getTalentLevel(
  player: Pick<PlayerData, 'talentLevels'>,
  talentId: string,
): number {
  return player.talentLevels[talentId] ?? 1
}

/** Highest legal level: 1 + authored level rows (absent table = maxLevel 1). */
export function getTalentMaxLevel(talent: TalentDefinition): number {
  return 1 + (talent.levels?.length ?? 0)
}

/**
 * The effect table at a level - `effects` for level 1, `levels[level - 2]`
 * beyond. Out-of-range levels fall back to the base table (defensive;
 * getTalentLevel + getTalentMaxLevel bound legal reads).
 */
export function getTalentEffectsAtLevel(talent: TalentDefinition, level: number): TalentEffect[] {
  if (level <= 1) {
    return talent.effects
  }
  return talent.levels?.[level - 2] ?? talent.effects
}

/**
 * Owned talents with a legal next level - the UPGRADE branch. Unknown /
 * retired ids in selectedTalentIds are ignored (same tolerated-save
 * contract as collectTalentEffects); a tolerated duplicate id surfaces
 * once - the decision list never renders two rows for one talent.
 */
export function getUpgradeableTalentIds(
  player: Pick<PlayerData, 'selectedTalentIds' | 'talentLevels'>,
): string[] {
  return [...new Set(player.selectedTalentIds)].filter((talentId) => {
    const talent = getTalentDefinition(talentId)
    return talent !== undefined && getTalentLevel(player, talentId) < getTalentMaxLevel(talent)
  })
}

/**
 * Realm-scoped NEW draw: up to BREAKTHROUGH_TALENT_OFFER_COUNT weighted
 * picks without replacement from the realm's pool. Eligibility = weight
 * > 0 AND not already owned; ReleasePolicy decides at origination
 * whether the realm's pool is live at all (a dormant future-realm pool
 * yields []). rng is injectable for deterministic tests.
 */
export function drawBreakthroughTalentOffers(
  player: Pick<PlayerData, 'selectedTalentIds'>,
  realmId: string,
  rng: () => number = Math.random,
): string[] {
  if (!isBreakthroughAcquisitionEnabled(realmId)) {
    return []
  }

  const remaining = (BREAKTHROUGH_TALENT_POOLS[realmId] ?? []).filter(
    (talent) => talent.weight > 0 && !player.selectedTalentIds.includes(talent.id),
  )

  const offers: string[] = []

  while (offers.length < BREAKTHROUGH_TALENT_OFFER_COUNT && remaining.length > 0) {
    const totalWeight = remaining.reduce((sum, talent) => sum + talent.weight, 0)
    let roll = rng() * totalWeight
    let index = 0

    for (; index < remaining.length - 1; index++) {
      roll -= remaining[index]!.weight
      if (roll <= 0) break
    }

    offers.push(remaining.splice(index, 1)[0]!.id)
  }

  return offers
}

/**
 * Originate the mandatory entitlement for a breakthrough INTO realmId.
 * Returns the effective record: the freshly created one, or the already
 * pending record untouched (a re-settle never overwrites bound cards -
 * the receipt-level dedup makes this unreachable on the live seam, but
 * the record itself is the second safety). Returns undefined when no
 * decision exists: acquisition suppressed by ReleasePolicy, or neither
 * branch has a legal choice (unreachable with authored pools - kept as
 * the degenerate-state contract, never a silent empty modal).
 */
export function createTalentEntitlement(
  player: Pick<PlayerData, 'selectedTalentIds' | 'talentLevels' | 'pendingTalentEntitlement'>,
  realmId: string,
  rng: () => number = Math.random,
): TalentEntitlement | undefined {
  if (player.pendingTalentEntitlement !== undefined) {
    return player.pendingTalentEntitlement
  }

  if (!isBreakthroughAcquisitionEnabled(realmId)) {
    return undefined
  }

  const offeredTalentIds = drawBreakthroughTalentOffers(player, realmId, rng)

  if (offeredTalentIds.length === 0 && getUpgradeableTalentIds(player).length === 0) {
    return undefined
  }

  const record: TalentEntitlement = { realmId, offeredTalentIds }
  player.pendingTalentEntitlement = record
  return record
}

/**
 * Whether a pending record still offers one legal decision - the drain
 * lock and the modal both trust it. A record is actionable when its
 * realm pool is release-enabled AND (at least one offered card is an
 * unowned, resolvable pool member OR an owned talent has a legal next
 * level). A persisted record can rot without any save drift: offers
 * bound at origination may all be granted by a later path before the
 * decision resolves.
 */
export function isTalentEntitlementActionable(
  player: Pick<PlayerData, 'selectedTalentIds' | 'talentLevels' | 'pendingTalentEntitlement'>,
): boolean {
  const entitlement = player.pendingTalentEntitlement

  if (entitlement === undefined) {
    return true
  }

  if (!isBreakthroughAcquisitionEnabled(entitlement.realmId)) {
    return false
  }

  const poolIds = new Set((BREAKTHROUGH_TALENT_POOLS[entitlement.realmId] ?? []).map((t) => t.id))
  const hasLegalNewOffer = entitlement.offeredTalentIds.some(
    (talentId) =>
      poolIds.has(talentId) &&
      !player.selectedTalentIds.includes(talentId) &&
      getTalentDefinition(talentId) !== undefined,
  )

  return hasLegalNewOffer || getUpgradeableTalentIds(player).length > 0
}

/**
 * Clear a pending record that no longer holds one legal decision. Called
 * on the drain seam before the lock check - a stale, unreleased, or
 * fully-consumed record must never hold the uncancellable modal open
 * with nothing to decide (the soft-lock the load-time validator guards
 * against can also arise post-load). A valid record is untouched.
 */
export function reconcileTalentEntitlement(
  player: Pick<PlayerData, 'selectedTalentIds' | 'talentLevels' | 'pendingTalentEntitlement'>,
): void {
  if (player.pendingTalentEntitlement !== undefined && !isTalentEntitlementActionable(player)) {
    player.pendingTalentEntitlement = undefined
  }
}

/**
 * Resolve the pending entitlement into its ONE granted result. Validates
 * BEFORE mutating: NEW requires an offered, unowned, resolvable id that
 * belongs to the record's realm pool under a release-enabled policy;
 * UPGRADE requires an owned talent below maxLevel. The same pool/policy
 * authority as origination is re-enforced here - a persisted record is
 * never trusted to carry catalog-legal offers. On success the grant
 * applies and the record clears in the same call - a rejected decision
 * leaves the record (and the lock) untouched, never a partial grant.
 */
export function resolveTalentEntitlement(
  player: Pick<PlayerData, 'selectedTalentIds' | 'talentLevels' | 'pendingTalentEntitlement'>,
  decision: TalentEntitlementDecision,
): boolean {
  const entitlement = player.pendingTalentEntitlement

  if (entitlement === undefined) {
    return false
  }

  if (decision.kind === 'new') {
    if (!entitlement.offeredTalentIds.includes(decision.talentId)) {
      return false
    }
    if (!isBreakthroughAcquisitionEnabled(entitlement.realmId)) {
      return false
    }
    const poolIds = new Set((BREAKTHROUGH_TALENT_POOLS[entitlement.realmId] ?? []).map((t) => t.id))
    if (!poolIds.has(decision.talentId)) {
      return false
    }
    if (player.selectedTalentIds.includes(decision.talentId)) {
      return false
    }
    if (getTalentDefinition(decision.talentId) === undefined) {
      return false
    }

    player.selectedTalentIds.push(decision.talentId)
    // NEW grants level 1 by contract: overwrite any latent level-map
    // entry for the (previously unowned) id so a shaped save cannot
    // activate a higher level on first ownership.
    player.talentLevels[decision.talentId] = 1
  } else {
    if (!player.selectedTalentIds.includes(decision.talentId)) {
      return false
    }

    const talent = getTalentDefinition(decision.talentId)

    if (talent === undefined) {
      return false
    }

    const level = getTalentLevel(player, decision.talentId)

    if (level >= getTalentMaxLevel(talent)) {
      return false
    }

    player.talentLevels[decision.talentId] = level + 1
  }

  player.pendingTalentEntitlement = undefined
  return true
}
