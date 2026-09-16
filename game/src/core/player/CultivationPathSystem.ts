import type { Technique } from '../technique/Technique'
import { createDefaultArtifactProgress } from '../artifact/ArtifactProgression'
import type { PlayerData } from './Player'
import {
  CULTIVATION_PATH_MODULES,
  getActiveWayDefinition,
  getLegacyPathIdForWay,
  isCultivationPathOffered,
  LEGACY_PATH_TO_WAY,
  type CultivationPathBaseId,
  type CultivationPathId,
  type PathWayDefinition,
  type PathWayId,
  type PathWayRead,
} from './CultivationPathKit'
import { freshKiemTuState } from '../kiem-tu/KiemTuState'
import { registerDomainDeltaDeriver, type StatModifier } from '../stats/StatCalculator'
import { CULTIVATION_PATH_STAT_DOMAINS, type StatDomain } from '../stats/StatDomain'
import type { MainStatKey } from '../stats/StatTypes'
import type { Stats } from '../stats/StatBlock'
import { phapTuAttunementMpModifiers } from '../phap-tu/PhapTuPath'
import { theTuAnReactiveModifiers, theTuEnduranceModifiers } from '../the-tu/TheTuPath'

// D12 (stat-system-reimagined spec section 5): Linh Can (attunement)
// feeds MP through the phap_tu domain gate. M4 — the emitter and its
// tuning constants moved to the Phap Tu path module
// (core/phap-tu/PhapTuPath.ts) where the way definitions live; the
// constants are re-exported here so existing consumers keep working.
export {
  PHAP_TU_ATTUNEMENT_MANA_REGEN_PER_POINT,
  PHAP_TU_ATTUNEMENT_MAX_MP_PER_POINT,
} from '../phap-tu/PhapTuPath'

// Mid-battle channel (D12): attunement deltas re-emit the gated MP delta
// through the registered deltaDeriver -- the deriver sees only deltas,
// never the base, so a stacked attunement buff cannot double-count the
// assembly-time emission (INV-10). Registered at module load;
// calculateEffectiveStats invokes it only for entities whose
// EffectiveStatContext.activeDomains contains 'phap_tu', so a non-phap_tu
// entity gaining attunement mid-battle never leaks MP stats.
registerDomainDeltaDeriver('phap_tu', (delta) =>
  delta.attunement === 0 ? [] : phapTuAttunementMpModifiers(delta.attunement, 'phap_tu:attunement_delta'),
)

// ---------------------------------------------------------------------------
// Cultivation Path Framework (spec 2026-09-16, M2) — path/way authority.
// CultivationPathSystem is the sole writer of player.cultivationPath /
// player.cultivationWay and owns ritual offer evaluation + choice commit.
// ---------------------------------------------------------------------------

/** One offerable (path, way) pair for the Initiation Ritual offer list. */
export interface PathWayOffer {
  pathId: CultivationPathBaseId
  wayId: PathWayId
  /** Live offerGate evaluation at THIS moment — never stored. */
  eligible: boolean
  /** Why an ineligible way cannot be picked (display/debug text). */
  reason?: string
}

export type PathChoiceResult = { ok: true } | { ok: false; reason: string }

// Offer order — preserves the pre-framework ritual list: the three base
// ways first (phap/kiem/the), then the gated hidden ways in the same
// path order (ngo_dao before ung_the), so the sealed cards stay last.
const RITUAL_PATH_ORDER: readonly CultivationPathBaseId[] = ['phap_tu', 'kiem_tu', 'the_tu']

// Temporary M6 exclusion — the kiem_tu 'ngu' way is catalogued but NOT
// offerable until M6 lands its ritual entry (way slice mode, node
// requiredWay migration). listOfferableWays omits it entirely and
// applyPathChoice rejects it — both read this one predicate.
function isWayExcludedUntilM6(way: PathWayDefinition): boolean {
  return way.pathId === 'kiem_tu' && way.id === 'ngu'
}

function offerGateReason(way: PathWayDefinition): string | undefined {
  const requiredSkill = way.offerGate?.requiresSkillLevel
  if (requiredSkill) {
    return `requires ${requiredSkill.skillId} Lv${requiredSkill.level}`
  }

  const requiredCast = way.offerGate?.requiresSkillCastLevel
  if (requiredCast) {
    return `requires ${requiredCast.skillId} cast Lv${requiredCast.level}`
  }

  return undefined
}

/**
 * Every (path, way) pair the ritual may show, with a live `eligible`
 * flag — gated ways stay listed so the UI can render locked cards;
 * kiem_tu/ngu is excluded entirely until M6 (see isWayExcludedUntilM6).
 * Order: base ways in RITUAL_PATH_ORDER, then gated ways same order.
 */
export function listOfferableWays(player: PlayerData): readonly PathWayOffer[] {
  const offers: PathWayOffer[] = []

  for (const gated of [false, true] as const) {
    for (const pathId of RITUAL_PATH_ORDER) {
      for (const way of Object.values(CULTIVATION_PATH_MODULES[pathId].ways)) {
        if ((way.offerGate !== undefined) !== gated) {
          continue
        }

        // The M6-excluded way never appears — not even as a locked card.
        if (isWayExcludedUntilM6(way)) {
          continue
        }

        const eligible = isCultivationPathOffered(way, player)

        offers.push({
          pathId,
          wayId: way.id,
          eligible,
          reason: eligible ? undefined : offerGateReason(way),
        })
      }
    }
  }

  return offers
}

/**
 * The active BASE path id, or undefined before the ritual. Reads
 * through LEGACY_PATH_TO_WAY so legacy _an path ids still resolve to
 * their base path during the transition.
 */
export function getActivePath(player: PlayerData): CultivationPathBaseId | undefined {
  return player.cultivationPath !== undefined
    ? LEGACY_PATH_TO_WAY[player.cultivationPath]?.pathId
    : undefined
}

/**
 * The active way. cultivationWay is authoritative once written; a
 * legacy-shaped player (cultivationPath only) derives through
 * LEGACY_PATH_TO_WAY so pre-M2 reads keep working.
 */
export function getActiveWay(player: PlayerData): PathWayId | undefined {
  if (player.cultivationWay !== undefined) {
    return player.cultivationWay
  }

  return player.cultivationPath !== undefined
    ? LEGACY_PATH_TO_WAY[player.cultivationPath]?.wayId
    : undefined
}

/**
 * M4 — generic active-way stat collection (the D12 assembly channel).
 * Resolves the player's active way — cultivationWay authoritative once
 * written, LEGACY_PATH_TO_WAY fallback for legacy-shaped saves — and
 * delegates to the way's PathWayStatFacet. resolvePlayerFinalStats calls
 * this before calculateStats so facet emissions are gated by their own
 * domain tags. Ways without a facet (kiem_tu until M6) emit nothing.
 */
export function collectActiveWayStatModifiers(
  player: PlayerData,
  totals: Pick<Stats, MainStatKey>,
): readonly StatModifier[] {
  const way = getActiveWayDefinition(player)

  return way?.stats?.collectModifiers(player, totals) ?? []
}

/**
 * M5 — the active way's OWNED stat domains: the way's stat facet is the
 * authority when it declares one (hien -> 'the_tu', ung_the ->
 * 'the_tu_an', both phap_tu ways -> 'phap_tu'); facet-less ways fall
 * back to the legacy path-id map row so kiem_tu keeps working until
 * M6. Consumed by GameManagerTurnBattleOps when stamping
 * participant.activeDomains — the mid-battle domain deltaDerivers gate
 * on it, so a collapsed save must not resolve the WRONG way's domain
 * (raw-path lookup would give 'the_tu' for ('the_tu','ung_the')).
 */
export function resolveActiveWayStatDomains(player: PathWayRead): readonly StatDomain[] | undefined {
  return (
    getActiveWayDefinition(player)?.stats?.domains ??
    (player.cultivationPath !== undefined && player.cultivationPath !== null
      ? CULTIVATION_PATH_STAT_DOMAINS[player.cultivationPath]
      : undefined)
  )
}

/**
 * THE path/way write authority — invoked by RealmAdvanceOps inside the
 * ritual transaction. Validates: the path exists in the catalog, the
 * way belongs to that path, the player has no existing choice, and the
 * way is currently offerable (live offerGate eval, incl. the M6 ngu
 * exclusion). ZERO mutation on any failure.
 *
 * On success writes cultivationWay AND the legacy-effective
 * cultivationPath id (M7 deletion adapter via getLegacyPathIdForWay —
 * ('phap_tu','ngo_dao') persists 'phap_tu_an' so unmigrated consumers
 * keep working), then creates the path-state slice where the path
 * declares one (today only kiem_tu -> freshKiemTuState()).
 */
export function applyPathChoice(
  player: PlayerData,
  pathId: CultivationPathBaseId,
  wayId: PathWayId,
): PathChoiceResult {
  const pathModule = CULTIVATION_PATH_MODULES[pathId]

  if (!pathModule) {
    return { ok: false, reason: `unknown path '${pathId}'` }
  }

  const way = pathModule.ways[wayId]

  if (!way) {
    return { ok: false, reason: `unknown way '${wayId}' for path '${pathId}'` }
  }

  if (player.cultivationPath !== undefined || player.cultivationWay !== undefined) {
    return { ok: false, reason: 'cultivation path already chosen' }
  }

  if (isWayExcludedUntilM6(way) || !isCultivationPathOffered(way, player)) {
    return { ok: false, reason: `way '${wayId}' is not currently offerable` }
  }

  const legacyPathId = getLegacyPathIdForWay(pathId, wayId)

  if (!legacyPathId) {
    return { ok: false, reason: `no legacy path id for (${pathId}, ${wayId})` }
  }

  player.cultivationWay = wayId
  player.cultivationPath = legacyPathId

  // Way-slice lifecycle — created at commit by the authority. Only
  // kiem_tu declares a slice today: the canonical fresh state enters
  // mode 'hien' (ngu's slice shape lands with its M6 ritual entry).
  if (pathId === 'kiem_tu') {
    player.kiemTu = freshKiemTuState()
  }

  return { ok: true }
}

/**
 * Phap Tu Reimagined (Task 7) — paths the initiation ritual may offer.
 * 'phap_tu_an' appears ONLY when linh_bao has reached its Lv3 cast
 * threshold at this moment — the offer is evaluated at ritual time,
 * never stored, and post-ritual casts cannot reopen it (the ritual
 * itself rejects any second choice). The Tu Reimagined adds 'the_tu'
 * as an always-offered base path and 'the_tu_an' behind the same
 * ritual-time evaluation via its way offerGate (huy_quyen Lv3).
 *
 * M2 — now a delegate over listOfferableWays: returns the legacy path
 * ids of the eligible offers (the cataloged kiem_tu 'ngu' way has no
 * legacy id and is never listed until M6 — R2).
 */
export function getOfferableCultivationPaths(player: PlayerData): CultivationPathId[] {
  return listOfferableWays(player)
    .filter((offer) => offer.eligible)
    .map((offer) => getLegacyPathIdForWay(offer.pathId, offer.wayId))
    .filter((pathId): pathId is CultivationPathId => pathId !== undefined)
}

/** linh_bao Lv3 gate — shared by the offer query and the ritual commit.
 * M1: the rule now lives on the ngo_dao way's requiresSkillCastLevel
 * offerGate. M2: delegates to the offer list (the gate eval inside
 * applyPathChoice subsumes the ritual-side check). */
export function isPhapTuAnEligible(player: PlayerData): boolean {
  return listOfferableWays(player).some(
    (offer) => offer.pathId === 'phap_tu' && offer.wayId === 'ngo_dao' && offer.eligible,
  )
}

// ---------------------------------------------------------------------------
// The Tu Reimagined (spec 2026-09-15 section 3) — the_tu_an reactive
// chances + the_tu endurance channel. M5 — the emitters and the
// path-id gates moved to the The Tu path module (core/the-tu/
// TheTuPath.ts): each way's PathWayStatFacet owns the assembly-time
// channel via collectActiveWayStatModifiers above. Only the mid-battle
// deltaDeriver registrations stay here — the derivers see attribute
// deltas for entities whose activeDomains already resolved the way's
// domain (resolveActiveWayStatDomains), never the base.
// ---------------------------------------------------------------------------

registerDomainDeltaDeriver('the_tu_an', (delta) =>
  theTuAnReactiveModifiers(delta, 'the_tu_an:attributes_delta'),
)

registerDomainDeltaDeriver('the_tu', (delta) =>
  delta.vitality === 0 ? [] : theTuEnduranceModifiers(delta.vitality, 'the_tu:vitality_delta'),
)

export interface CultivationPathRewardDeps {
  getEquippedTechnique: () => Technique | undefined
  getTechnique: (techniqueId: string) => Technique | undefined
  learnTechnique: (techniqueId: string) => boolean
  equipTechnique: (techniqueId: string) => boolean
}

export function getCultivationPathStatModifiers(player: PlayerData) {
  const way = getActiveWayDefinition(player)

  return [...(way?.statModifiers ?? [])]
}

export function grantCultivationPathRealmReward(
  player: PlayerData,
  realmId: string,
  deps: CultivationPathRewardDeps,
): boolean {
  if (!player.cultivationPath) {
    return false
  }

  const reward = getActiveWayDefinition(player)?.realmRewards?.[realmId]

  if (!reward) {
    return false
  }

  if (reward.techniqueId) {
    const inheritedInsight = deps.getEquippedTechnique()?.insight ?? 0

    deps.learnTechnique(reward.techniqueId)

    const nextTechnique = deps.getTechnique(reward.techniqueId)

    if (nextTechnique) {
      nextTechnique.insight = Math.max(nextTechnique.insight ?? 0, inheritedInsight)
    }

    deps.equipTechnique(reward.techniqueId)
  }

  if (reward.artifactId && !player.artifact) {
    player.artifact = createDefaultArtifactProgress(reward.artifactId)
  }

  return true
}
