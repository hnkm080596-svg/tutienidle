import type { ElementType } from '../element/ElementType'
import type { ProgressionNode } from '../progression/ProgressionNode'
import { getNodeMaxLevel } from '../progression/ProgressionNode'
import type { SpellPathRoute } from '../phap-tu/PhapTuState'
import type { OrbId } from '../kiem-tu/KiemTuState'
import {
  createDefaultArtifactProgress,
  isArtifactDomainUnlocked,
} from '../artifact/ArtifactProgression'
import type { PlayerData } from './Player'
import {
  CULTIVATION_PATH_MODULES,
  getActiveWayDefinition,
  isCultivationPathOffered,
  type CultivationPathId,
  type PathCapability,
  type PathCapabilityDeps,
  type PathConditionalRead,
  type PathSubpathAxis,
  type PathWayDefinition,
  type CultivationWayId,
  type PathWayRead,
} from './CultivationPathKit'
import { registerDomainDeltaDeriver, type StatModifier } from '../stats/StatCalculator'
import { isRealmAvailable } from '../realm/ReleasePolicy'
import { type StatDomain } from '../stats/StatDomain'
import type { MainStatKey } from '../stats/StatTypes'
import type { Stats } from '../stats/StatBlock'
// D12 (stat-system-reimagined spec section 5): Linh Can (attunement)
// feeds MP through the spell domain gate. M4 — the emitter and its
// tuning constants moved to the Phap Tu path module
// (core/phap-tu/PhapTuPath.ts) where the way definitions live; the
// constants are re-exported here so existing consumers keep working.
export {
  SPELL_ATTUNEMENT_MANA_REGEN_PER_POINT,
  SPELL_ATTUNEMENT_MAX_MP_PER_POINT,
} from '../phap-tu/PhapTuPath'

// M8 — mid-battle domain delta derivers are MODULE-DECLARED on each
// way's PathWayStatFacet (deltaDerivers); the framework registers them
// generically from the catalog. The derivers see attribute
// deltas for entities whose activeDomains already resolved the way's
// domain (resolveActiveWayStatDomains), never the base — INV-10 holds:
// a stacked attribute buff cannot double-count the assembly emission,
// and a foreign-domain delta never leaks stats cross-way.
// P1 - registration is EAGER at module eval, same lifecycle as the
// pre-P1 framework: the Kit -> SkillSystem edge that closed the
// NodeSystem -> here -> Kit -> SkillSystem -> SpellPathRoutes ->
// NodeSystem cycle is severed (the cast-leveling table lives in the
// leaf core/skill/CastLeveling.ts), so the catalog is fully
// initialized before this module body runs.
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
  wayId: CultivationWayId
  /** Live offerGate evaluation at THIS moment — never stored. */
  eligible: boolean
  /** Why an ineligible way cannot be picked (display/debug text). */
  reason?: string
}

export type PathChoiceResult = { ok: true } | { ok: false; reason: string }

// Offer order — preserves the pre-framework ritual list: the three base
// ways first (spell/sword/body), then the gated hidden ways in the same
// path order (hidden_spell_pathway before hidden_body_pathway), so the sealed cards stay last.
const RITUAL_PATH_ORDER: readonly CultivationPathId[] = ['spell', 'sword', 'body']

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
export function getActivePath(player: PathWayRead): CultivationPathId | undefined {
  return getActiveWayDefinition(player)?.pathId
}

/**
 * The active way, or undefined before the ritual / for a corrupt pair.
 * cultivationWay is authoritative; a way-less save is corrupt post-M7
 * and resolves nothing.
 */
export function getActiveWay(player: PathWayRead): CultivationWayId | undefined {
  return getActiveWayDefinition(player)?.id
}

/**
 * P1 - generic identity membership reads for consumers that need "is the
 * player on this path/way" without importing a concrete module predicate.
 * Both resolve through the catalog (fail closed on a corrupt pair), so a
 * way id the module does not own can never satisfy the check. The literal
 * comparison lives HERE inside the authority - callers pass the id they
 * need, keeping concrete-literal branches out of generic code.
 */
export function isActivePath(player: PathWayRead, path: CultivationPathId): boolean {
  return getActiveWayDefinition(player)?.pathId === path
}

export function isActiveWay(player: PathWayRead, way: CultivationWayId): boolean {
  return getActiveWayDefinition(player)?.id === way
}

/**
 * P1 - the resolved capability set for the player's committed pair. Static
 * capabilities come straight from the way definition; conditional ones run
 * their module-owned predicate against the narrow read shape + injected
 * deps (skill membership lives in SkillManager, not PlayerData). A mortal
 * player, a way-less pair, or a mismatched pair resolves the empty set -
 * fail closed, same as getActiveWayDefinition.
 */
/**
 * THE capability derivation - the single resolver every capability check
 * funnels through (pair -> active way -> declared facet -> resolved set).
 * mode 'static' answers from the declared static list only: conditional
 * predicates never run, so a conditional cap fails closed for callers
 * that cannot supply PathCapabilityDeps (deps is ignored in that mode).
 */
export function resolvePathCapabilities(
  player: PathConditionalRead,
  deps: PathCapabilityDeps,
  mode: 'all' | 'static' = 'all',
): ReadonlySet<PathCapability> {
  const facet = getActiveWayDefinition(player)?.capabilities

  if (!facet) {
    return new Set()
  }

  const caps = new Set<PathCapability>(facet.static ?? [])

  if (mode === 'static') {
    return caps
  }

  for (const [cap, predicate] of Object.entries(facet.conditional ?? {})) {
    if (predicate?.(player, deps)) {
      caps.add(cap as PathCapability)
    }
  }

  return caps
}

/**
 * Full capability check - the canonical consumer read for any capability
 * that may be conditional. Presentation bridges reach this through the
 * bound GameManager facade (deps + activePlayer pre-bound).
 */
export function hasPathCapability(
  player: PathConditionalRead,
  capability: PathCapability,
  deps: PathCapabilityDeps,
): boolean {
  return resolvePathCapabilities(player, deps).has(capability)
}

// Static-mode resolution never consults deps - a fixed empty surface keeps
// the signature honest without fabricating skill membership.
const NO_CAPABILITY_DEPS: PathCapabilityDeps = { hasSkill: () => false }

/**
 * Deps-free capability check - the SAME resolver in 'static' mode, on the
 * narrow PathWayRead pair shape (the bridge/kit-readable subset). A
 * conditional capability returns false here: the static read cannot prove
 * it, and failing closed is the honest answer - use hasPathCapability (or
 * the facade) for conditional caps.
 */
export function hasStaticPathCapability(player: PathWayRead, capability: PathCapability): boolean {
  return resolvePathCapabilities(player, NO_CAPABILITY_DEPS, 'static').has(capability)
}

// ---------------------------------------------------------------------------
// P1-M3 - canonical subpath reads. Each in-way branch axis is declared on
// the owning way as DATA-ONLY metadata (subpaths.{axis} = { state,
// requiresCapability }); the concrete reads live HERE in the authority -
// way definitions carry no executable callbacks (spec section 8.1).
// Resolution gates on the axis's requiresCapability (a static capability
// the same way declares) and fails closed on absent axes, absent slices,
// and corrupt pairs. State ownership stays where it already is (spellPath
// slice, swordPath slice, nodeLevels) - these reads expose it, never write.
// ---------------------------------------------------------------------------

function subpathAxisResolves(player: PathWayRead, axis: PathSubpathAxis | undefined): boolean {
  return (
    axis !== undefined &&
    (axis.requiresCapability === undefined ||
      hasStaticPathCapability(player, axis.requiresCapability))
  )
}

/** The committed element - spell_pathway only; undefined for any other way. */
export function getActiveElement(player: PathConditionalRead): ElementType | undefined {
  if (!subpathAxisResolves(player, getActiveWayDefinition(player)?.subpaths?.element)) {
    return undefined
  }
  return player.spellPath?.element ?? undefined
}

/** The committed route - spell_pathway only; undefined for any other way. */
export function getActiveRoute(player: PathConditionalRead): SpellPathRoute | undefined {
  if (!subpathAxisResolves(player, getActiveWayDefinition(player)?.subpaths?.route)) {
    return undefined
  }
  return player.spellPath?.route ?? undefined
}

/** The persisted Kiem Pho preset - sword_pathway only (defensive copy). */
export function getSwordScrollPreset(player: PathConditionalRead): readonly OrbId[] | undefined {
  if (!subpathAxisResolves(player, getActiveWayDefinition(player)?.subpaths?.preset)) {
    return undefined
  }
  const preset = player.swordPath?.preset
  return preset === undefined ? undefined : [...preset]
}

/**
 * M4 — generic active-way stat collection (the D12 assembly channel).
 * Resolves the player's active way — cultivationWay authoritative once
 * written; a way-less or mismatched pair is corrupt and emits nothing —
 * and delegates to the way's PathWayStatFacet. resolvePlayerFinalStats
 * calls this before calculateStats so facet emissions are gated by
 * their own domain tags. Ways with no totals-driven channel (sword)
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
 * stat facet — the single authority post-M7 (body_pathway -> 'body', hidden_body_pathway
 * -> 'hidden_body', both spell ways -> 'spell', both sword ways ->
 * 'sword'). Consumed by GameManagerTurnBattleOps when stamping
 * participant.activeDomains — the mid-battle domain deltaDerivers gate
 * on it, so the WAY — never the raw path id — decides the domain (a
 * path-level lookup would give 'body' for ('body','hidden_body_pathway')).
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
 * path-state slice where the path declares one (today only sword ->
 * freshSwordPathState()).
 */
export function applyPathChoice(
  player: PlayerData,
  pathId: CultivationPathId,
  wayId: CultivationWayId,
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
  // the module contract. Only sword declares createInitialState
  // today: the canonical fresh player.swordPath is way-agnostic (the Kiem
  // Y fields start at hidden_sword_pathway's defaults; sword_pathway simply never reads them).
  pathModule.createInitialState?.(player)

  return { ok: true }
}

export function getCultivationPathStatModifiers(player: PlayerData) {
  const way = getActiveWayDefinition(player)

  return [...(way?.statModifiers ?? [])]
}

// P7-M3 - realm rewards are artifact-only delivery (the canonical
// technique is granted once at initiation; the retired spell Truc Co
// technique swap folded into five_elements_art.gradeEffects[2]). The
// passiveSkillId field on the record is delivered by syncRealmPassive,
// NOT here.
export function grantCultivationPathRealmReward(
  player: PlayerData,
  realmId: string,
  resolveNode: (nodeId: string) => ProgressionNode | undefined,
): boolean {
  if (!player.cultivationPath) {
    return false
  }

  // M-F-CEILING - realm-entry rewards for unreleased realms stay dormant
  // (authored records such as the canonical golden_core+ passive ladder
  // are kept; the release policy suppresses the grant itself).
  if (!isRealmAvailable(realmId)) {
    return false
  }

  const reward = getActiveWayDefinition(player)?.realmRewards?.[realmId]

  if (!reward) {
    return false
  }

  // M-F-ARTIFACT-DEFER - the release check above alone would let any
  // caller passing 'golden_core' awaken the domain on a below-unlock
  // player once the window opens; the artifact leg also requires the
  // player to have REACHED the unlock realm (reach+window, same seam
  // every other artifact action composes).
  if (
    reward.artifactId &&
    !player.artifact &&
    isArtifactDomainUnlocked(player.realmId)
  ) {
    player.artifact = createDefaultArtifactProgress(reward.artifactId)
  }

  // Three-path design (2026-09-25, sec.4-b) - realm-entry node grants:
  // idempotent max-write (a re-entry or a deeper earlier grant never
  // downgrades). Effect activation stays behind the standard
  // element/route/way gates in NodeSystem.
  // Ownership: only rewardOnly-authored registry members may receive a
  // grant, clamped to getNodeMaxLevel - anything else is refused and
  // warned (a record entry naming a purchasable/core node would
  // otherwise hand out gated power for free or corrupt the
  // purchasedNodeIds mirror).
  if (reward.grantedNodeLevels) {
    player.nodeLevels ??= {}

    for (const [nodeId, level] of Object.entries(reward.grantedNodeLevels)) {
      const node = resolveNode(nodeId)

      if (!node || node.rewardOnly !== true) {
        console.warn(
          `grantedNodeLevels entry '${nodeId}' is not a rewardOnly-authored node - grant skipped`,
        )
        continue
      }

      // core_ ids need the purchasedNodeIds mirror per save validation;
      // a grant writes nodeLevels only, so one would corrupt the save.
      if (nodeId.startsWith('core_')) {
        console.warn(
          `grantedNodeLevels entry '${nodeId}' targets a core_ id - grant skipped`,
        )
        continue
      }

      // Transactional effects (one-shot grants, spec claims, purchases)
      // are dead on a levels-only grant - warn so the author notices.
      if (
        node.effect.unlocksSkillIds !== undefined ||
        node.effect.selectsSpecialization !== undefined ||
        node.effect.kiemYGrant !== undefined ||
        node.effect.kiemDaoGrant !== undefined
      ) {
        console.warn(
          `grantedNodeLevels entry '${nodeId}' carries transactional effects that node-level grants do not fire`,
        )
      }

      const clamped = Math.min(level, getNodeMaxLevel(node))
      player.nodeLevels[nodeId] = Math.max(player.nodeLevels[nodeId] ?? 0, clamped)
    }
  }

  return true
}
