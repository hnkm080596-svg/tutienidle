import type { ElementType } from '../element/ElementType'
import type { StatModifier } from '../stats/StatCalculator'
import type { Stats } from '../stats/StatBlock'
import type { StatDomain } from '../stats/StatDomain'
import type { MainStatKey } from '../stats/StatTypes'
import type { ArtifactId } from '../artifact/Artifact'
import type { PlayerData } from './Player'
import { getCastLeveledSkillLevel } from '../skill/SkillSystem'
import {
  PHAP_TU_NGO_DAO_WAY,
  PHAP_TU_NGU_HANH_WAY,
} from '../phap-tu/PhapTuPath'
import { THE_TU_HIEN_WAY, THE_TU_UNG_THE_WAY } from '../the-tu/TheTuPath'
import { LEGACY_PATH_TO_WAY } from './PathWayIdentity'

// M5 — the legacy-id -> (base path, way) adapter lives in the
// PathWayIdentity leaf so domain systems can resolve era-tolerant path
// identity without importing this catalog; re-exported so existing
// consumers keep their import site.
export { LEGACY_PATH_TO_WAY } from './PathWayIdentity'

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
// Phap Tu Reimagined (Task 7) — 'phap_tu_an' is a first-class hidden
// path (not a node/mode): offered only inside the initiation ritual
// when linh_bao is Lv3, permanent, mutually exclusive with phap_tu.
//
// The Tu Reimagined (spec 2026-09-15, T1) — the_tu (Hien) and the_tu_an
// (An) are SEPARATE path ids offered at the Initiation Ritual; picking
// An excludes the ordinary path permanently (no node/mode flip).
//
// Cultivation Path Framework (spec 2026-09-16) — this union stays at 5
// ids through the transition and shrinks to the three base ids at M7.
export type CultivationPathId = 'phap_tu' | 'phap_tu_an' | 'kiem_tu' | 'the_tu' | 'the_tu_an'

// M1 — the module catalog is keyed by the three BASE path ids while the
// 5-id union above still exists; legacy _an ids resolve through
// LEGACY_PATH_TO_WAY below. Collapses back to CultivationPathId at M7.
export type CultivationPathBaseId = 'kiem_tu' | 'phap_tu' | 'the_tu'

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
}

// Cultivation Path Framework (spec 2026-09-16, M1) — PathWayDefinition
// is the CultivationPathKit fields re-scoped to a WAY inside a path
// module. Same data, new home; no behavior change.
export interface PathWayDefinition {
  id: PathWayId

  pathId: CultivationPathId // base path id ('phap_tu' etc — base even during transition)

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

  // Exactly 3 fixed skills into Skill Loadout slots 0/1/2 at path
  // choice (the first tuple entry uses the 'attack_speed' execution
  // policy but is still a normal loadout skill). Optional: no current
  // way declares one — Kiem Tu basics come from the Kiem Pho orb
  // preset, Phap Tu skills open through the Node Tree, The Tu resolves
  // its kit at battle build, ngo_dao grants a bespoke set.
  skillIds?: readonly [string, string, string]

  // Ritual offer gate — consumed by isCultivationPathOffered, the
  // single predicate both the offer panel and chooseCultivationPath
  // consult.
  offerGate?: PathOfferGate

  // The combat HUD's path resource bar reads this flag (data-driven):
  // the way's battle participant carries the The pool
  // (currentThe/maxThe on CombatEntity). UI never checks path ids —
  // only this flag.
  usesTheResource?: boolean

  // M4 — totals-driven stat contribution (the D12 assembly channel):
  // collectActiveWayStatModifiers resolves the active way and calls
  // this facet's collectModifiers during resolvePlayerFinalStats.
  // Module-level declaration, never persisted. Optional — ways without
  // a totals-driven channel emit nothing (kiem_tu/the_tu facets land
  // with M5/M6; their emitters stay hardcoded until then).
  stats?: PathWayStatFacet
}

// M1 — one module per base path; ways keyed by PathWayId. During the
// transition the module is a pure view over the former kit rows (no
// createInitialState/stats/lifecycle facets yet — they land in M2/M4
// with their consumers).
export interface CultivationPathModule {
  id: CultivationPathId // base path id
  name: string // e.g. 'Kiếm Tu'
  ways: Readonly<Record<PathWayId, PathWayDefinition>>
}

export const CULTIVATION_PATH_MODULES: Readonly<Record<CultivationPathBaseId, CultivationPathModule>> = {
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
  },

  kiem_tu: {
    id: 'kiem_tu',
    name: 'Kiếm Tu',
    ways: {
      hien: {
        id: 'hien',
        pathId: 'kiem_tu',
        name: 'Kiếm Tu — Ngự Kiếm Tâm Kinh',
        element: 'metal',
        techniqueId: 'ngu_kiem',
        // Kiem Tu Reimagined (spec 2026-09-15) — no authored skill
        // grants: hien basics come from the Kiem Pho orb preset
        // (KiemPhoProvider).
      },

      // Ngu Kiem Dao (An) — catalogued in M1 but NOT offerable until
      // M6: no legacy path id maps to it and getOfferableCultivationPaths
      // still returns only the pre-framework ids (R2). The gate is the
      // exact port of the deleted-in-M6 kiem_tu_an node prereq
      // (skillCastCount {tram, 3} reads the skillLevels mirror).
      ngu: {
        id: 'ngu',
        pathId: 'kiem_tu',
        name: 'Kiếm Tu Ẩn — Vạn Kiếm Quyết',
        techniqueId: 'van_kiem_quyet',
        offerGate: { requiresSkillLevel: { skillId: 'tram', level: 3 } },
      },
    },
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

// Resolves a legacy path id to its way definition via
// LEGACY_PATH_TO_WAY + CULTIVATION_PATH_MODULES. Undefined for ids
// outside the legacy union — callers handle per site (these sites only
// run when the path is set and valid).
export function getPathWayDefinition(pathId: CultivationPathId): PathWayDefinition | undefined {
  const mapping = LEGACY_PATH_TO_WAY[pathId]

  if (!mapping) {
    return undefined
  }

  return CULTIVATION_PATH_MODULES[mapping.pathId].ways[mapping.wayId]
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
 * M5 — resolves the ACTIVE way definition: cultivationWay is
 * authoritative once the ritual writes it; a legacy-shaped player
 * (cultivationPath only, no way) derives through LEGACY_PATH_TO_WAY so
 * pre-M2 reads keep working. Unlike getPathWayDefinition this honours
 * the persisted way id, so collapsed saves ('the_tu' + 'ung_the')
 * resolve the same way as transition saves ('the_tu_an' + 'ung_the').
 * A (path, way) pair the catalog does not know returns undefined.
 */
export function getActiveWayDefinition(player: PathWayRead): PathWayDefinition | undefined {
  const mapping =
    player.cultivationPath !== undefined && player.cultivationPath !== null
      ? LEGACY_PATH_TO_WAY[player.cultivationPath]
      : undefined

  if (!mapping) {
    return undefined
  }

  const wayId = player.cultivationWay ?? mapping.wayId

  return CULTIVATION_PATH_MODULES[mapping.pathId].ways[wayId]
}

// M7 deletion adapter — the INVERSE of LEGACY_PATH_TO_WAY: resolves a
// (base path, way) pair back to the legacy 5-id path id that
// player.cultivationPath still carries during the transition so
// unmigrated consumers keep working (e.g. ('phap_tu','ngo_dao') ->
// 'phap_tu_an'). Every way committable in this phase MUST map to a
// legacy id; 'kiem_tu/ngu' deliberately has none and stays unofferable
// until M6. Deleted with LEGACY_PATH_TO_WAY in M7.
export function getLegacyPathIdForWay(
  pathId: CultivationPathBaseId,
  wayId: PathWayId,
): CultivationPathId | undefined {
  for (const legacyId of Object.keys(LEGACY_PATH_TO_WAY) as CultivationPathId[]) {
    const mapping = LEGACY_PATH_TO_WAY[legacyId]

    if (mapping.pathId === pathId && mapping.wayId === wayId) {
      return legacyId
    }
  }

  return undefined
}

// Nghi Lễ Nhập Môn (2026-08-16) — gate cũ (mốc realmLevel cố định
// trong qi_refining) đã bị THAY THẾ: chọn nghề giờ CHÍNH LÀ nghi lễ
// đột phá Phàm Nhân -> Luyện Khí, nên điều kiện mở khoá gắn với việc
// hoàn thành Phàm Nhân cảnh (realmId === 'mortal' && realmLevel ===
// maxLevel), xem CharacterPanel.vue's canChooseCultivationPath. Không
// còn hằng số riêng ở đây nữa — đọc thẳng maxLevel của REALMS.

// Single offer predicate consumed by BOTH the Quan Khi offer list
// (QuanKhiPanel.vue via getOfferableCultivationPaths) and
// chooseCultivationPath() so the UI can never show a choice the ritual
// would reject. A way with no offerGate is always offered. Gates read
// the live mirrors: requiresSkillLevel -> player.skillLevels;
// requiresSkillCastLevel -> the cast-leveled skill's level derived from
// player.skillCastCounts via CAST_LEVELING_THRESHOLDS (the
// isPhapTuAnEligible semantic, now data-driven).
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
