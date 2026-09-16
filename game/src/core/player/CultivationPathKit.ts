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
import { KIEM_TU_HIEN_WAY, KIEM_TU_NGU_WAY } from '../kiem-tu/KiemTuPath'

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
  // Module-level declaration, never persisted. M7 — every way declares
  // a facet: `domains` is the authoritative owned-domain list consumed
  // by resolveActiveWayStatDomains; ways with no totals-driven channel
  // (both kiem_tu ways) emit nothing from collectModifiers.
  stats?: PathWayStatFacet
}

// M1 — one module per base path; ways keyed by PathWayId.
export interface CultivationPathModule {
  id: CultivationPathId
  name: string // e.g. 'Kiếm Tu'
  ways: Readonly<Record<PathWayId, PathWayDefinition>>
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
