import type { ElementType } from '../element/ElementType'
import type { DomainDeltaDeriver, StatModifier } from '../stats/StatCalculator'
import type { Stats } from '../stats/StatBlock'
import type { StatDomain } from '../stats/StatDomain'
import type { MainStatKey } from '../stats/StatTypes'
import type { ArtifactId } from '../artifact/Artifact'
import type { PlayerData } from './Player'
import { getCastLeveledSkillLevel } from '../skill/CastLeveling'
import { getSkillCoreLevel } from '../progression/SkillCoreLevel'
import {
  HIDDEN_SPELL_PATHWAY,
  SPELL_PATHWAY,
  validateSpellPathPersistedState,
} from '../phap-tu/PhapTuPath'
import { BODY_PATHWAY, HIDDEN_BODY_PATHWAY } from '../the-tu/TheTuPath'
import {
  createSwordPathInitialState,
  SWORD_PATHWAY,
  HIDDEN_SWORD_PATHWAY,
  validateSwordPathPersistedState,
} from '../kiem-tu/KiemTuPath'

// M4 - the hidden_spell_pathway kit identity lives in the Phap Tu path module
// (core/phap-tu/PhapTuPath.ts); re-exported so existing consumers keep
// their import site.
export {
  HIDDEN_SPELL_BASIC_ID,
  HIDDEN_SPELL_PASSIVE_ID,
  HIDDEN_SPELL_REQUIRED_SKILLS,
  HIDDEN_SPELL_SPECIAL_ID,
} from '../phap-tu/PhapTuPath'

// Phap Tu Redesign (magicpath, 2026-08-18) - 5 path Ngu Hanh cu
// (phap_tu_hoa/moc/thuy/kim/tho) da GOP thanh 1 "spell" duy nhat
// (muc 1 magicpath: "Phap Tu khong con duoc thiet ke thanh nhieu he
// nguyen to tach biet"). Kiem Tu van dung RIENG (nhanh song song, co
// che kit co dinh KHAC han - chua di qua Element/Node Tree). Them gia
// tri moi khi The Tu duoc thiet ke sau nay - KHONG BAO GIO tai cau
// truc union nay, chi mo rong them string.
//
// Cultivation Path Framework (spec 2026-09-16, M7) - the persisted
// union is now exactly the three BASE path ids. The hidden variants
// (hidden_spell_pathway under spell, hidden_body_pathway under body, hidden_sword_pathway under sword)
// are WAYS on player.cultivationWay, never path ids: the transition-
// era 'phap_tu_an'/'the_tu_an' ids and the LEGACY_PATH_TO_WAY adapter
// are deleted; saves carrying them fail the v66 shape check.
//
// P7-M1 -- the identity spine is semantic English: 'sword'|'spell'|'body'
// paths, each with a canonical + hidden way in the strict union below.
export type CultivationPathId = 'sword' | 'spell' | 'body'

// P7-M1 -- strict six-way union replaces the open way-id string.
// Each path owns a two-member sub-union; the pair (path, way) remains
// the atomic identity.
export type SwordWayId = 'sword_pathway' | 'hidden_sword_pathway'
export type SpellWayId = 'spell_pathway' | 'hidden_spell_pathway'
export type BodyWayId = 'body_pathway' | 'hidden_body_pathway'
export type CultivationWayId = SwordWayId | SpellWayId | BodyWayId

// The canonical way-id set each path owns -- the catalog contract's
// completeness/pairing source (contract test asserts module keys match).
export const CULTIVATION_PATH_WAY_IDS = {
  sword: ['sword_pathway', 'hidden_sword_pathway'],
  spell: ['spell_pathway', 'hidden_spell_pathway'],
  body: ['body_pathway', 'hidden_body_pathway'],
} as const satisfies Record<CultivationPathId, readonly CultivationWayId[]>

export interface CultivationPathRealmReward {
  artifactId?: ArtifactId
  // P7-M2 - realm-entry passive grant, delivered by syncRealmPassive
  // (NOT by grantCultivationPathRealmReward). Ways compose their table
  // from CANONICAL_REALM_PASSIVE_LADDER; null is an authored directive
  // suppressing the canonical pick for this realm.
  passiveSkillId?: string | null
}

// Ritual-time offer gate, evaluated live against the player (never
// stored). requiresSkillLevel reads the canonical core level (hidden_body_pathway's
// huy_quyen Lv3; hidden_sword_pathway's tram Lv3 - nodeLevels[core_<id>]
// via getSkillCoreLevel, M-QI-05). The linh_bao
// gate for hidden_spell_pathway is cast-count based, so it gets a bespoke field:
// requiresSkillCastLevel is evaluated by isCultivationPathOffered via
// skillCastCounts + CAST_LEVELING_THRESHOLDS (through
// getCastLeveledSkillLevel), replacing the bespoke isPhapTuAnEligible
// call inside the offer path.
export type PathOfferGate = {
  requiresSkillLevel?: { skillId: string; level: number }
  requiresSkillCastLevel?: { skillId: string; level: number }
}

// ---------------------------------------------------------------------------
// P1 - Canonical Path Authority (spec 2026-09-20 section P1): the capability
// contract. A capability is a '<path>.<thing>' authority string derived from
// the committed (path, way) pair plus owning-domain state - the semantic
// consumers ask about, never a second identity source. No new capability may
// be added without a real downstream consumer (M0 inventory table).
// ---------------------------------------------------------------------------

export type PathCapability =
  // spell - spell_pathway element machinery, the The pool, node-empowered ult
  | 'spell.elemental_casting'
  | 'spell.essence_pool'
  | 'spell.empowered_ult'
  // spell - ngo_dao conditional aura (predicate: ngo_dao_hon_don learned)
  | 'spell.reaction_aura'
  // sword
  | 'sword.sword_scroll'
  | 'sword.sword_riding'
  // body
  | 'body.essence_economy'

/**
 * The narrow player shape conditional capability predicates and subpath
 * reads may consume - the identity pair plus the slices the current
 * capabilities read (spellPath for element, nodeLevels for node ownership,
 * swordPath for the preset). Every slice is OPTIONAL at the contract
 * boundary: the module's predicate knows which slices it needs and
 * null-guards them, and narrow presentation slices (KiemBarPlayerState
 * carries only swordPath, TheBarPlayerState only spellPath+nodeLevels) satisfy
 * the same shape. PlayerData is a superset.
 */
export type PathConditionalRead = PathWayRead &
  Partial<Pick<PlayerData, 'nodeLevels' | 'spellPath' | 'swordPath'>>

/**
 * Runtime dependencies a conditional capability may consume - learned-skill
 * membership lives in SkillManager, not PlayerData, so it arrives as an
 * injected predicate (GameManager binds skillManager.has). Predicates never
 * receive the manager itself - one narrow function, no state authority leak.
 */
export interface PathCapabilityDeps {
  hasSkill(skillId: string): boolean
}

/**
 * A way's capability facet - the same module-runtime facet shape as `stats`:
 * `static` lists capabilities implied by way membership alone (pure data);
 * `conditional` maps a capability to its module-owned predicate evaluated
 * against player state + injected deps. Static wins first in resolution;
 * a capability MUST NOT appear in both (the contract test enforces it).
 */
export interface PathCapabilityFacet {
  static?: readonly PathCapability[];
  conditional?: Readonly<
    Partial<
      Record<
        PathCapability,
        (player: PathConditionalRead, deps: PathCapabilityDeps) => boolean
      >
    >
  >
}

/**
 * P1-M3 - one formalized in-way branch axis, DATA ONLY (spec section 8.1):
 * `state` records the persisted field the axis owns (the ownership record);
 * `requiresCapability` names the STATIC capability authorizing the axis -
 * contract-tested to be a capability the SAME way declares. The concrete
 * reads live in CultivationPathSystem (getActiveElement/getActiveRoute/
 * getSwordScrollPreset) - way definitions never carry executable callbacks.
 */
export interface PathSubpathAxis {
  requiresCapability?: PathCapability
  /** Persisted field path, e.g. 'player.spellPath.element'. */
  state: string
}

/**
 * The in-way branch axes a way may formalize. Keys are the canonical axis
 * ids. Absent axis = the way does not own that branch (hidden_spell_pathway has no
 * element axis even if a stale spellPath.element lingers - reads fail closed).
 * An axis without a canonical reader (body `root`) is a declared
 * ownership record - the documentation of which slice the branch lives in.
 */
export interface PathWaySubpaths {
  /** spell_pathway: player.spellPath.element - commit via selectSpellPathElement. */
  element?: PathSubpathAxis
  /** spell_pathway: player.spellPath.route - same atomic commit; switchRoute writes. */
  route?: PathSubpathAxis
  /** sword_pathway: player.swordPath.preset - write via setKiemPhoPreset. */
  preset?: PathSubpathAxis
  /** body: the root node family on player.nodeLevels (mutex on body_pathway,
   * non-mutex on hidden_body_pathway). Ownership record only - node investment stays
   * owned by NodeSystem; no external reader exists today. */
  root?: PathSubpathAxis
}

// Cultivation Path Framework (spec 2026-09-16, M4) - a way's stat
// contribution channel: totals-driven emission reading the RESOLVED
// attribute totals (resolveAttributeTotals) and emitting domain-tagged
// StatModifiers BEFORE calculateStats runs - the D12 assembly-time
// channel. `domains` declares which StatDomains the facet emits into
// (catalog/documentation contract; the runtime gate enforces the
// modifier's own domain tag regardless).
export interface PathWayStatFacet {
  collectModifiers(
    player: PlayerData,
    totals: Pick<Stats, MainStatKey>,
  ): readonly StatModifier[]

  domains: readonly StatDomain[]

  // M8 - the way's MID-BATTLE domain delta channel (INV-10): each
  // entry declares the DomainDeltaDeriver for a domain this facet
  // owns. The framework registers every declared deriver at catalog
  // load (CultivationPathSystem); calculateEffectiveStats invokes a
  // deriver only when the entity's activeDomains contain the domain,
  // so a delta on a foreign domain never leaks stats cross-way.
  deltaDerivers?: Readonly<Partial<Record<StatDomain, DomainDeltaDeriver>>>
}

// Cultivation Path Framework (spec 2026-09-16, M1) - PathWayDefinition
// is the CultivationPathKit fields re-scoped to a WAY inside a path
// module. Same data, new home; no behavior change.
export interface PathWayDefinition {
  id: CultivationWayId

  pathId: CultivationPathId // base path id ('spell' etc)

  name: string

  // Phap Tu has no fixed kit element: the chosen element lives on
  // player.spellPath.element (single authority, picked at the element-root
  // node). Optional - only the base ways of sword / body declare
  // one (identity + UI color).
  element?: ElementType

  // P7-M3 - the way's ONE canonical technique, granted by
  // GameManagerRealmAdvanceOps.chooseCultivationPath() into the 0-or-1
  // holder after the mortal -> qi_refining promotion.
  techniqueId: string

  // Base stats of the cultivation way. Aggregated from data on each
  // stat pass; never written back into PlayerData.
  statModifiers?: readonly StatModifier[]

  // Major-realm rewards. Consumers must be idempotent so a repeat call
  // cannot overwrite player progress.
  realmRewards?: Readonly<Record<string, CultivationPathRealmReward>>

  // Skills learned at path choice (learn-only; combat roles resolve
  // from the kit via the path runtime, P7-M4). M9 - the
  // hidden_spell_pathway kit rides this channel too; its third member
  // is a passive, not an active, so it lives on passiveSkillIds instead.
  skillIds?: readonly string[]

  // M-QI-05 / QI-D3 - Core Nodes this way owns and grants at
  // initiation: native TurnSkillDefinition actions (body/sword/hidden
  // kits) have no Skill template, so their canonical level rides the
  // nodeLevels authority directly via grantsSkillCore-style Core
  // Nodes (core_<skillId>). chooseCultivationPath preflights every
  // member's registered core BEFORE the irreversible path/way commit
  // and grants them inside the commit block - a missing/mismatched
  // core fails the whole ritual with zero mutation.
  coreSkillIds?: readonly string[]

  // Ngu Kiem Beta -- node ids granted at way commit through the same
  // grantSkillCore seam (evolution layers like ngu_kiem_khoi: real
  // nodes on the way's tag subtree, nodeLevels-owned, respec-preserved,
  // unpurchasable via grantedOnly). chooseCultivationPath preflights
  // every member's registry presence BEFORE commit and grants inside
  // the commit block -- a missing node fails the ritual.
  grantedNodeIds?: readonly string[]

  // P7-M2 - passives learned at path initiation (replaces the retired
  // technique-carried innateSkillId).
  // Declared way content: every member must also appear in
  // ownedContent.skillIds (contract-tested) and is template-preflighted
  // by chooseCultivationPath before the path/way commit.
  passiveSkillIds?: readonly string[]

  // P7-M4 - the way's STARTER basic: a learned precursor skill the
  // runtime resolves as the basic fallback until the way's own kit
  // supersedes it (spell: element kit; body: root kit). Absent = the
  // kit fully owns basic resolution from initiation (sword orb
  // machinery, both hidden ways' fixed kits). The ritual preflights
  // the template and learns it inside the commit block, so a
  // successful initiation always yields a learned starter. Resolved
  // through getActiveWayDefinition - never a literal inside runtimes.
  starterBasicSkillId?: string

  // Ritual offer gate - consumed by isCultivationPathOffered, the
  // single predicate both the offer panel and chooseCultivationPath
  // consult.
  offerGate?: PathOfferGate

  // M9 - the offer panel renders this way as a sealed hidden-path card
  // (named way, permanent-choice warning, danger styling) instead of a
  // plain choice button. Presentation flag on the way so the panel
  // never branches on a concrete way id.
  sealedOffer?: boolean

  // P1-M2 - content this way owns (catalog-validated, unique across
  // ways): skills granted or exclusive to the way; buff/marker def ids
  // it plants at build. Pure data (spec section 8.1). The aura's
  // APPLICATION stays runtime-owned (grantsElementalReactionAura) -
  // ownedContent declares OWNERSHIP, not timing. Consumers never read
  // this field directly; the contract suite validates refs resolve and
  // no id is claimed by two ways.
  ownedContent?: {
    skillIds?: readonly string[]
    buffIds?: readonly string[]
  }

  // M4 - totals-driven stat contribution (the D12 assembly channel):
  // collectActiveWayStatModifiers resolves the active way and calls
  // this facet's collectModifiers during resolvePlayerFinalStats.
  // Module-level declaration, never persisted. M7 - every way declares
  // a facet: `domains` is the authoritative owned-domain list consumed
  // by resolveActiveWayStatDomains; ways with no totals-driven channel
  // (both sword ways) emit nothing from collectModifiers.
  stats?: PathWayStatFacet

  // P1 - the way's capability facet (module runtime, same facet shape as
  // `stats`). Static members are pure data resolved by way membership;
  // conditional members are module-owned predicates evaluated with the
  // injected PathCapabilityDeps. Resolved by resolvePathCapabilities in
  // CultivationPathSystem - consumers never read this field directly.
  capabilities?: PathCapabilityFacet

  // P1-M3 - formalized in-way branch axes with module-owned reads.
  // Resolved by the canonical reads in CultivationPathSystem
  // (getActiveElement / getActiveRoute / getSwordScrollPreset); consumers
  // never read this field directly.
  subpaths?: PathWaySubpaths

  // P1 - the node-tree view tag this way renders in SkillPathPanel
  // (kiem hien -> 'kiem_pho', ngu -> 'ngu_kiem', body hien -> 'body',
  // ung_the -> 'hidden_body'). Ways without a fixed tree (spell_pathway's tag
  // is the browsed element; hidden_spell_pathway shows no tree) declare none - the
  // panel never branches on a concrete way id.
  nodeTreeTag?: string
}

/**
 * P1-M6 - layer-neutral issue emitted by module persisted-state
 * validators; the save boundary adapts it to its local ShapeIssue.
 * Lives in core so path modules never import services/.
 */
export interface PathStateIssue {
  /** JSON path relative to save root, e.g. 'player.spellPath.element'. */
  readonly path: string
  readonly message: string
}

// M1 -- one module per base path; ways keyed by CultivationWayId.
export interface CultivationPathModule {
  id: CultivationPathId
  name: string // e.g. 'Kiem Tu'
  ways: Readonly<Partial<Record<CultivationWayId, PathWayDefinition>>>

  // M8 - optional path-state slice factory, invoked by applyPathChoice
  // at ritual commit. The MODULE owns which PlayerData field it writes
  // (sword -> player.swordPath); the framework never branches on the
  // concrete path to create slices.
  createInitialState?: (player: PlayerData) => void

  /**
   * P1-M6 - validate this module's persisted fields from the RAW player
   * payload (untrusted - narrow with guards, do not cast to PlayerData).
   * Runs for EVERY save; the module itself decides presence/shape/pair
   * rules, e.g.:
   *   spell: player.spellPath required + shaped on every save (mortal and
   *            other-path saves included); element/route only under the
   *            committed spell_pathway way.
   *   sword: player.swordPath optional shape; REQUIRED when the committed
   *            pair is sword - the module reads the raw pair fields
   *            itself to decide.
   * The boundary supplies no path knowledge - modules are the only place
   * that knows which fields they own. Modules owning no persisted slice
   * (body) declare no hook.
   */
  validatePersistedState?(
    playerPayload: unknown,
    emit: (issue: PathStateIssue) => void,
  ): void
}

export const CULTIVATION_PATH_MODULES: Readonly<Record<CultivationPathId, CultivationPathModule>> = {
  spell: {
    id: 'spell',
    name: 'Pháp Tu',
    // M4 - the way definitions live in the path module
    // (core/phap-tu/PhapTuPath.ts) alongside the machinery they own:
    // the shared 'spell' stat facet, the way predicates, and the
    // hidden_spell_pathway kit identity.
    ways: {
      spell_pathway: SPELL_PATHWAY,
      hidden_spell_pathway: HIDDEN_SPELL_PATHWAY,
    },
    // P1-M6 - the module owns player.spellPath validation (required shape
    // on every save; element/route pair ownership is spell_pathway-only).
    validatePersistedState: validateSpellPathPersistedState,
  },

  sword: {
    id: 'sword',
    name: 'Kiếm Tu',
    // M6 - the way definitions live in the path module
    // (core/kiem-tu/KiemTuPath.ts) alongside the machinery they own:
    // the way predicates and the hidden_sword_pathway ritual-only offer gate. sword
    // never had a hidden-variant path id - both ways persist
    // cultivationPath 'sword'; cultivationWay is the discriminator.
    ways: {
      sword_pathway: SWORD_PATHWAY,
      hidden_sword_pathway: HIDDEN_SWORD_PATHWAY,
    },
    // M8 - the path owns its state slice: the canonical fresh
    // player.swordPath is way-agnostic (the Kiem Y fields start at hidden_sword_pathway's
    // defaults; sword_pathway simply never reads them).
    createInitialState: createSwordPathInitialState,
    // P1-M6 - the module owns player.swordPath validation (optional shape;
    // required once the committed pair is sword).
    validatePersistedState: validateSwordPathPersistedState,
  },

  body: {
    id: 'body',
    name: 'Thể Tu',
    // M5 - the way definitions live in the path module
    // (core/the-tu/TheTuPath.ts) alongside the machinery they own: the
    // way predicates and the per-way stat facets ('body' endurance /
    // 'hidden_body' reactive chances).
    ways: {
      body_pathway: BODY_PATHWAY,
      hidden_body_pathway: HIDDEN_BODY_PATHWAY,
    },
  },
}

/**
 * Structural read shape for the active-way resolver - PlayerData and
 * presentation-side player slices both satisfy it; fields stay
 * nullable because slices keep the persisted `| null` convention.
 */
export interface PathWayRead {
  cultivationPath?: CultivationPathId | null
  cultivationWay?: CultivationWayId | null
}

/**
 * M7 - resolves the ACTIVE way definition straight from the persisted
 * (cultivationPath, cultivationWay) pair against the module catalog.
 * There is no fallback: a path with no way, a way id the path module
 * does not own, or an absent path all return undefined - a way-less
 * save is corrupt post-M7 (the ritual writes both fields atomically).
 */
export function getActiveWayDefinition(player: PathWayRead): PathWayDefinition | undefined {
  if (
    player.cultivationPath === undefined ||
    player.cultivationPath === null ||
    player.cultivationWay === undefined ||
    player.cultivationWay === null
  ) {
    return undefined
  }

  return CULTIVATION_PATH_MODULES[player.cultivationPath]?.ways[player.cultivationWay]
}

// Nghi Le Nhap Mon (2026-08-16) - gate cu (moc realmLevel co dinh
// trong qi_refining) da bi THAY THE: chon nghe gio CHINH LA nghi le
// dot pha Pham Nhan -> Luyen Khi, nen dieu kien mo khoa gan voi viec
// hoan thanh Pham Nhan canh (realmId === 'mortal' && realmLevel ===
// maxLevel), xem CharacterPanel.vue's canChooseCultivationPath. Khong
// con hang so rieng o day nua - doc thang maxLevel cua REALMS.

// Single offer predicate consumed by BOTH the Quan Khi offer list
// (QuanKhiPanel.vue via listOfferableWays) and
// chooseCultivationPath() so the UI can never show a choice the ritual
// would reject. A way with no offerGate is always offered. Gates read
// the canonical mirrors: requiresSkillLevel -> nodeLevels[core_<id>]
// via getSkillCoreLevel (M-QI-05); requiresSkillCastLevel -> the
// cast-leveled skill's level derived from player.skillCastCounts via
// CAST_LEVELING_THRESHOLDS.
export function isCultivationPathOffered(way: PathWayDefinition, player: PlayerData): boolean {
  const requiredSkill = way.offerGate?.requiresSkillLevel

  if (requiredSkill && getSkillCoreLevel(player, requiredSkill.skillId) < requiredSkill.level) {
    return false
  }

  const requiredCast = way.offerGate?.requiresSkillCastLevel

  if (requiredCast) {
    const casts = player.skillCastCounts?.[requiredCast.skillId] ?? 0
    const castLevel = getCastLeveledSkillLevel(requiredCast.skillId, casts) ?? 0

    if (castLevel < requiredCast.level) {
      return false
    }
  }

  return true
}
