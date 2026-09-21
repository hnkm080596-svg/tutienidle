import type { ElementType } from '../element/ElementType'
import type { PhapTuRoute } from '../phap-tu/PhapTuState'
import type { OrbId } from '../kiem-tu/KiemTuState'
import type { DomainDeltaDeriver, StatModifier } from '../stats/StatCalculator'
import type { Stats } from '../stats/StatBlock'
import type { StatDomain } from '../stats/StatDomain'
import type { MainStatKey } from '../stats/StatTypes'
import type { ArtifactId } from '../artifact/Artifact'
import type { PlayerData } from './Player'
import { getCastLeveledSkillLevel } from '../skill/CastLeveling'
import {
  PHAP_TU_NGO_DAO_WAY,
  PHAP_TU_NGU_HANH_WAY,
  validatePhapTuPersistedState,
} from '../phap-tu/PhapTuPath'
import { THE_TU_HIEN_WAY, THE_TU_UNG_THE_WAY } from '../the-tu/TheTuPath'
import {
  createKiemTuInitialState,
  KIEM_TU_HIEN_WAY,
  KIEM_TU_NGU_WAY,
  validateKiemTuPersistedState,
} from '../kiem-tu/KiemTuPath'

// M4 — the ngo_dao kit identity lives in the Phap Tu path module
// (core/phap-tu/PhapTuPath.ts); re-exported so existing consumers keep
// their import site.
export {
  PHAP_TU_AN_BASIC_ID,
  PHAP_TU_AN_PASSIVE_ID,
  PHAP_TU_AN_REQUIRED_SKILLS,
  PHAP_TU_AN_SPECIAL_ID,
} from '../phap-tu/PhapTuPath'

// Pháp Tu Redesign (magicpath, 2026-08-18) — 5 path Ngũ Hành cũ
// (phap_tu_hoa/moc/thuy/kim/tho) đã GỘP thành 1 "phap_tu" duy nhất
// (mục 1 magicpath: "Pháp Tu không còn được thiết kế thành nhiều hệ
// nguyên tố tách biệt"). Kiếm Tu vẫn đứng RIÊNG (nhánh song song, cơ
// chế kit cố định KHÁC hẳn — chưa đi qua Element/Node Tree). Thêm giá
// trị mới khi Thể Tu được thiết kế sau này — KHÔNG BAO GIỜ tái cấu
// trúc union này, chỉ mở rộng thêm string.
//
// Cultivation Path Framework (spec 2026-09-16, M7) — the persisted
// union is now exactly the three BASE path ids. The hidden variants
// (ngo_dao under phap_tu, ung_the under the_tu, ngu under kiem_tu)
// are WAYS on player.cultivationWay, never path ids: the transition-
// era 'phap_tu_an'/'the_tu_an' ids and the LEGACY_PATH_TO_WAY adapter
// are deleted; saves carrying them fail the v66 shape check.
export type CultivationPathId = 'kiem_tu' | 'phap_tu' | 'the_tu'

// Path-scoped way id (content string, like node ids — spec §24).
export type PathWayId = string

export interface CultivationPathRealmReward {
  techniqueId?: string
  artifactId?: ArtifactId
}

// Ritual-time offer gate, evaluated live against the player (never
// stored). requiresSkillLevel reads the skillLevels mirror (ung_the's
// huy_quyen Lv3; ngu's tram Lv3 — exact port of the kiem_tu_an node's
// skillCastCount level gate, which reads skillLevels). The linh_bao
// gate for ngo_dao is cast-count based, so it gets a bespoke field:
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
  // phap_tu - ngu_hanh element machinery, the The pool, node-empowered ult
  | 'phap_tu.elemental_casting'
  | 'phap_tu.the_pool'
  | 'phap_tu.empowered_ult'
  // phap_tu - ngo_dao conditional aura (predicate: ngo_dao_hon_don learned)
  | 'phap_tu.reaction_aura'
  // kiem_tu
  | 'kiem_tu.kiem_pho'
  | 'kiem_tu.ngu_kiem_dao'
  // the_tu
  | 'the_tu.the_economy'

/**
 * The narrow player shape conditional capability predicates and subpath
 * reads may consume - the identity pair plus the slices the current
 * capabilities read (phapTu for element, nodeLevels for node ownership,
 * kiemTu for the preset). Every slice is OPTIONAL at the contract
 * boundary: the module's predicate knows which slices it needs and
 * null-guards them, and narrow presentation slices (KiemBarPlayerState
 * carries only kiemTu, TheBarPlayerState only phapTu+nodeLevels) satisfy
 * the same shape. PlayerData is a superset.
 */
export type PathConditionalRead = PathWayRead &
  Partial<Pick<PlayerData, 'nodeLevels' | 'phapTu' | 'kiemTu'>>

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
 * getKiemTuPreset) - way definitions never carry executable callbacks.
 */
export interface PathSubpathAxis {
  requiresCapability?: PathCapability
  /** Persisted field path, e.g. 'player.phapTu.element'. */
  state: string
}

/**
 * The in-way branch axes a way may formalize. Keys are the canonical axis
 * ids. Absent axis = the way does not own that branch (ngo_dao has no
 * element axis even if a stale phapTu.element lingers - reads fail closed).
 * An axis without a canonical reader (the_tu `root`) is a declared
 * ownership record - the documentation of which slice the branch lives in.
 */
export interface PathWaySubpaths {
  /** ngu_hanh: player.phapTu.element - commit via selectPhapTuElement. */
  element?: PathSubpathAxis
  /** ngu_hanh: player.phapTu.route - same atomic commit; switchRoute writes. */
  route?: PathSubpathAxis
  /** kiem_tu hien: player.kiemTu.preset - write via setKiemPhoPreset. */
  preset?: PathSubpathAxis
  /** the_tu: the root node family on player.nodeLevels (mutex on hien,
   * non-mutex on ung_the). Ownership record only - node investment stays
   * owned by NodeSystem; no external reader exists today. */
  root?: PathSubpathAxis
}

// Cultivation Path Framework (spec 2026-09-16, M4) — a way's stat
// contribution channel: totals-driven emission reading the RESOLVED
// attribute totals (resolveAttributeTotals) and emitting domain-tagged
// StatModifiers BEFORE calculateStats runs — the D12 assembly-time
// channel. `domains` declares which StatDomains the facet emits into
// (catalog/documentation contract; the runtime gate enforces the
// modifier's own domain tag regardless).
export interface PathWayStatFacet {
  collectModifiers(
    player: PlayerData,
    totals: Pick<Stats, MainStatKey>,
  ): readonly StatModifier[]

  domains: readonly StatDomain[]

  // M8 — the way's MID-BATTLE domain delta channel (INV-10): each
  // entry declares the DomainDeltaDeriver for a domain this facet
  // owns. The framework registers every declared deriver at catalog
  // load (CultivationPathSystem); calculateEffectiveStats invokes a
  // deriver only when the entity's activeDomains contain the domain,
  // so a delta on a foreign domain never leaks stats cross-way.
  deltaDerivers?: Readonly<Partial<Record<StatDomain, DomainDeltaDeriver>>>
}

// Cultivation Path Framework (spec 2026-09-16, M1) — PathWayDefinition
// is the CultivationPathKit fields re-scoped to a WAY inside a path
// module. Same data, new home; no behavior change.
export interface PathWayDefinition {
  id: PathWayId

  pathId: CultivationPathId // base path id ('phap_tu' etc)

  name: string

  // Phap Tu has no fixed kit element: the chosen element lives on
  // player.phapTu.element (single authority, picked at the element-root
  // node). Optional — only the hien ways of Kiem Tu / The Tu declare
  // one (identity + UI color).
  element?: ElementType

  // Tam Phap merge (2026-08-15) — ONE technique, auto-learned+equipped
  // by GameManagerRealmAdvanceOps.chooseCultivationPath(), OVERWRITING
  // whatever is equipped (including the starter 'tu_linh_quyet').
  techniqueId: string

  // Base stats of the cultivation way. Aggregated from data on each
  // stat pass; never written back into PlayerData.
  statModifiers?: readonly StatModifier[]

  // Major-realm rewards. Consumers must be idempotent so a repeat call
  // cannot overwrite player progress.
  realmRewards?: Readonly<Record<string, CultivationPathRealmReward>>

  // Skills learned + equipped into Skill Loadout slots IN ORDER at path
  // choice (slot index = array position). M9 — the ngo_dao kit rides
  // this channel too; its third member is a technique-carried passive,
  // not a loadout skill, so it is not listed here.
  skillIds?: readonly string[]

  // Skills unequipped (NOT unlearned) from the loadout at ritual
  // commit — the mortal-precursor strip. Declared per way so the
  // ritual orchestrator never branches on concrete path/way ids.
  unequipSkillIds?: readonly string[]

  // Ritual offer gate — consumed by isCultivationPathOffered, the
  // single predicate both the offer panel and chooseCultivationPath
  // consult.
  offerGate?: PathOfferGate

  // M9 — the offer panel renders this way as a sealed hidden-path card
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

  // M4 — totals-driven stat contribution (the D12 assembly channel):
  // collectActiveWayStatModifiers resolves the active way and calls
  // this facet's collectModifiers during resolvePlayerFinalStats.
  // Module-level declaration, never persisted. M7 — every way declares
  // a facet: `domains` is the authoritative owned-domain list consumed
  // by resolveActiveWayStatDomains; ways with no totals-driven channel
  // (both kiem_tu ways) emit nothing from collectModifiers.
  stats?: PathWayStatFacet

  // P1 - the way's capability facet (module runtime, same facet shape as
  // `stats`). Static members are pure data resolved by way membership;
  // conditional members are module-owned predicates evaluated with the
  // injected PathCapabilityDeps. Resolved by resolvePathCapabilities in
  // CultivationPathSystem - consumers never read this field directly.
  capabilities?: PathCapabilityFacet

  // P1-M3 - formalized in-way branch axes with module-owned reads.
  // Resolved by the canonical reads in CultivationPathSystem
  // (getActiveElement / getActiveRoute / getKiemTuPreset); consumers
  // never read this field directly.
  subpaths?: PathWaySubpaths

  // P1 - the node-tree view tag this way renders in SkillPathPanel
  // (kiem hien -> 'kiem_pho', ngu -> 'ngu_kiem', the_tu hien -> 'the_tu',
  // ung_the -> 'the_tu_an'). Ways without a fixed tree (ngu_hanh's tag
  // is the browsed element; ngo_dao shows no tree) declare none - the
  // panel never branches on a concrete way id.
  nodeTreeTag?: string
}

/**
 * P1-M6 - layer-neutral issue emitted by module persisted-state
 * validators; the save boundary adapts it to its local ShapeIssue.
 * Lives in core so path modules never import services/.
 */
export interface PathStateIssue {
  /** JSON path relative to save root, e.g. 'player.phapTu.element'. */
  readonly path: string
  readonly message: string
}

// M1 — one module per base path; ways keyed by PathWayId.
export interface CultivationPathModule {
  id: CultivationPathId
  name: string // e.g. 'Kiếm Tu'
  ways: Readonly<Record<PathWayId, PathWayDefinition>>

  // M8 — optional path-state slice factory, invoked by applyPathChoice
  // at ritual commit. The MODULE owns which PlayerData field it writes
  // (kiem_tu -> player.kiemTu); the framework never branches on the
  // concrete path to create slices.
  createInitialState?: (player: PlayerData) => void

  /**
   * P1-M6 - validate this module's persisted fields from the RAW player
   * payload (untrusted - narrow with guards, do not cast to PlayerData).
   * Runs for EVERY save; the module itself decides presence/shape/pair
   * rules, e.g.:
   *   phap_tu: player.phapTu required + shaped on every save (mortal and
   *            other-path saves included); element/route only under the
   *            committed ngu_hanh way.
   *   kiem_tu: player.kiemTu optional shape; REQUIRED when the committed
   *            pair is kiem_tu - the module reads the raw pair fields
   *            itself to decide.
   * The boundary supplies no path knowledge - modules are the only place
   * that knows which fields they own. Modules owning no persisted slice
   * (the_tu) declare no hook.
   */
  validatePersistedState?(
    playerPayload: unknown,
    emit: (issue: PathStateIssue) => void,
  ): void
}

export const CULTIVATION_PATH_MODULES: Readonly<Record<CultivationPathId, CultivationPathModule>> = {
  phap_tu: {
    id: 'phap_tu',
    name: 'Pháp Tu',
    // M4 — the way definitions live in the path module
    // (core/phap-tu/PhapTuPath.ts) alongside the machinery they own:
    // the shared 'phap_tu' stat facet, the way predicates, and the
    // ngo_dao kit identity.
    ways: {
      ngu_hanh: PHAP_TU_NGU_HANH_WAY,
      ngo_dao: PHAP_TU_NGO_DAO_WAY,
    },
    // P1-M6 - the module owns player.phapTu validation (required shape
    // on every save; element/route pair ownership is ngu_hanh-only).
    validatePersistedState: validatePhapTuPersistedState,
  },

  kiem_tu: {
    id: 'kiem_tu',
    name: 'Kiếm Tu',
    // M6 — the way definitions live in the path module
    // (core/kiem-tu/KiemTuPath.ts) alongside the machinery they own:
    // the way predicates and the ngu ritual-only offer gate. kiem_tu
    // never had a hidden-variant path id — both ways persist
    // cultivationPath 'kiem_tu'; cultivationWay is the discriminator.
    ways: {
      hien: KIEM_TU_HIEN_WAY,
      ngu: KIEM_TU_NGU_WAY,
    },
    // M8 — the path owns its state slice: the canonical fresh
    // player.kiemTu is way-agnostic (the Kiem Y fields start at ngu's
    // defaults; hien simply never reads them).
    createInitialState: createKiemTuInitialState,
    // P1-M6 - the module owns player.kiemTu validation (optional shape;
    // required once the committed pair is kiem_tu).
    validatePersistedState: validateKiemTuPersistedState,
  },

  the_tu: {
    id: 'the_tu',
    name: 'Thể Tu',
    // M5 — the way definitions live in the path module
    // (core/the-tu/TheTuPath.ts) alongside the machinery they own: the
    // way predicates and the per-way stat facets ('the_tu' endurance /
    // 'the_tu_an' reactive chances).
    ways: {
      hien: THE_TU_HIEN_WAY,
      ung_the: THE_TU_UNG_THE_WAY,
    },
  },
}

/**
 * Structural read shape for the active-way resolver — PlayerData and
 * presentation-side player slices both satisfy it; fields stay
 * nullable because slices keep the persisted `| null` convention.
 */
export interface PathWayRead {
  cultivationPath?: CultivationPathId | null
  cultivationWay?: PathWayId | null
}

/**
 * M7 — resolves the ACTIVE way definition straight from the persisted
 * (cultivationPath, cultivationWay) pair against the module catalog.
 * There is no fallback: a path with no way, a way id the path module
 * does not own, or an absent path all return undefined — a way-less
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

// Nghi Lễ Nhập Môn (2026-08-16) — gate cũ (mốc realmLevel cố định
// trong qi_refining) đã bị THAY THẾ: chọn nghề giờ CHÍNH LÀ nghi lễ
// đột phá Phàm Nhân -> Luyện Khí, nên điều kiện mở khoá gắn với việc
// hoàn thành Phàm Nhân cảnh (realmId === 'mortal' && realmLevel ===
// maxLevel), xem CharacterPanel.vue's canChooseCultivationPath. Không
// còn hằng số riêng ở đây nữa — đọc thẳng maxLevel của REALMS.

// Single offer predicate consumed by BOTH the Quan Khi offer list
// (QuanKhiPanel.vue via listOfferableWays) and
// chooseCultivationPath() so the UI can never show a choice the ritual
// would reject. A way with no offerGate is always offered. Gates read
// the live mirrors: requiresSkillLevel -> player.skillLevels;
// requiresSkillCastLevel -> the cast-leveled skill's level derived from
// player.skillCastCounts via CAST_LEVELING_THRESHOLDS.
export function isCultivationPathOffered(way: PathWayDefinition, player: PlayerData): boolean {
  const requiredSkill = way.offerGate?.requiresSkillLevel

  if (requiredSkill && (player.skillLevels?.[requiredSkill.skillId] ?? 0) < requiredSkill.level) {
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
