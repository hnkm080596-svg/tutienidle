import type { Technique } from '../technique/Technique'
import { createDefaultArtifactProgress } from '../artifact/ArtifactProgression'
import type { PlayerData } from './Player'
import {
  CULTIVATION_PATH_MODULES,
  getActiveWayDefinition,
  isCultivationPathOffered,
  type CultivationPathId,
  type PathWayDefinition,
  type PathWayId,
  type PathWayRead,
} from './CultivationPathKit'
import { registerDomainDeltaDeriver, type StatModifier } from '../stats/StatCalculator'
import { type StatDomain } from '../stats/StatDomain'
import type { MainStatKey } from '../stats/StatTypes'
import type { Stats } from '../stats/StatBlock'
// D12 (stat-system-reimagined spec section 5): Linh Can (attunement)
// feeds MP through the phap_tu domain gate. M4 — the emitter and its
// tuning constants moved to the Phap Tu path module
// (core/phap-tu/PhapTuPath.ts) where the way definitions live; the
// constants are re-exported here so existing consumers keep working.
export {
  PHAP_TU_ATTUNEMENT_MANA_REGEN_PER_POINT,
  PHAP_TU_ATTUNEMENT_MAX_MP_PER_POINT,
} from '../phap-tu/PhapTuPath'

// M8 — mid-battle domain delta derivers are MODULE-DECLARED on each
// way's PathWayStatFacet (deltaDerivers); the framework registers them
// generically from the catalog at load. The derivers see attribute
// deltas for entities whose activeDomains already resolved the way's
// domain (resolveActiveWayStatDomains), never the base — INV-10 holds:
// a stacked attribute buff cannot double-count the assembly emission,
// and a foreign-domain delta never leaks stats cross-way.
for (const pathModule of Object.values(CULTIVATION_PATH_MODULES)) {
  for (const way of Object.values(pathModule.ways)) {
    for (const [domain, deriver] of Object.entries(way.stats?.deltaDerivers ?? {})) {
      if (deriver) {
        registerDomainDeltaDeriver(domain as StatDomain, deriver)
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Cultivation Path Framework (spec 2026-09-16, M2) — path/way authority.
// CultivationPathSystem is the sole writer of player.cultivationPath /
// player.cultivationWay and owns ritual offer evaluation + choice commit.
// ---------------------------------------------------------------------------

/** One offerable (path, way) pair for the Initiation Ritual offer list. */
export interface PathWayOffer {
  pathId: CultivationPathId
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
const RITUAL_PATH_ORDER: readonly CultivationPathId[] = ['phap_tu', 'kiem_tu', 'the_tu']

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
 * flag — gated ways stay listed so the UI can render locked cards.
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
 * The active path id, or undefined before the ritual / for a corrupt
 * (path, way) pair — the read fails closed through the same catalog
 * resolution as getActiveWayDefinition.
 */
export function getActivePath(player: PlayerData): CultivationPathId | undefined {
  return getActiveWayDefinition(player)?.pathId
}

/**
 * The active way, or undefined before the ritual / for a corrupt pair.
 * cultivationWay is authoritative; a way-less save is corrupt post-M7
 * and resolves nothing.
 */
export function getActiveWay(player: PlayerData): PathWayId | undefined {
  return getActiveWayDefinition(player)?.id
}

/**
 * M4 — generic active-way stat collection (the D12 assembly channel).
 * Resolves the player's active way — cultivationWay authoritative once
 * written; a way-less or mismatched pair is corrupt and emits nothing —
 * and delegates to the way's PathWayStatFacet. resolvePlayerFinalStats
 * calls this before calculateStats so facet emissions are gated by
 * their own domain tags. Ways with no totals-driven channel (kiem_tu)
 * emit nothing.
 */
export function collectActiveWayStatModifiers(
  player: PlayerData,
  totals: Pick<Stats, MainStatKey>,
): readonly StatModifier[] {
  const way = getActiveWayDefinition(player)

  return way?.stats?.collectModifiers(player, totals) ?? []
}

/**
 * M5 — the active way's OWNED stat domains, resolved from the way's
 * stat facet — the single authority post-M7 (hien -> 'the_tu', ung_the
 * -> 'the_tu_an', both phap_tu ways -> 'phap_tu', both kiem_tu ways ->
 * 'kiem_tu'). Consumed by GameManagerTurnBattleOps when stamping
 * participant.activeDomains — the mid-battle domain deltaDerivers gate
 * on it, so the WAY — never the raw path id — decides the domain (a
 * path-level lookup would give 'the_tu' for ('the_tu','ung_the')).
 * Corrupt/way-less pairs resolve nothing.
 */
export function resolveActiveWayStatDomains(player: PathWayRead): readonly StatDomain[] | undefined {
  return getActiveWayDefinition(player)?.stats?.domains
}

/**
 * THE path/way write authority — invoked by RealmAdvanceOps inside the
 * ritual transaction. Validates: the path exists in the catalog, the
 * way belongs to that path, the player has no existing choice, and the
 * way is currently offerable (live offerGate eval). ZERO mutation on
 * any failure.
 *
 * On success writes cultivationWay AND cultivationPath (the BASE path
 * id directly — M7 removed the legacy-id adapter), then creates the
 * path-state slice where the path declares one (today only kiem_tu ->
 * freshKiemTuState()).
 */
export function applyPathChoice(
  player: PlayerData,
  pathId: CultivationPathId,
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

  if (!isCultivationPathOffered(way, player)) {
    return { ok: false, reason: `way '${wayId}' is not currently offerable` }
  }

  player.cultivationWay = wayId
  player.cultivationPath = pathId

  // State-slice lifecycle — created at commit by the authority through
  // the module contract. Only kiem_tu declares createInitialState
  // today: the canonical fresh player.kiemTu is way-agnostic (the Kiem
  // Y fields start at ngu's defaults; hien simply never reads them).
  pathModule.createInitialState?.(player)

  return { ok: true }
}

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
