import type {
  CultivationPathId,
  PathWayDefinition,
  PathWayId,
  PathWayStatFacet,
} from '../player/CultivationPathKit'
import type { StatModifier } from '../stats/StatCalculator'

// Cultivation Path Framework (spec 2026-09-16, M4) — the Phap Tu path
// module: the two way definitions + the path-domain machinery they own.
//
//   ngu_hanh — ordinary Phap Tu (kit dai_ngu_hanh_chan_quyet): the
//     element/route/The machinery. In-way state lives on
//     player.phapTu { element, route } (PhapTuState stays the single
//     authority — INV-13 atomic commit unchanged).
//   ngo_dao — Phap Tu An (kit ngo_dao_chan_quyet): hidden way offered
//     only at the Initiation Ritual when linh_bao is cast-Lv3. Fixed
//     three-skill kit (PHAP_TU_AN_REQUIRED_SKILLS), NO element/route/
//     The machinery.
//
// Both ways own the same 'phap_tu' stat domain: the attunement -> MP
// emission is identical for ngu_hanh and ngo_dao, so they share one
// PathWayStatFacet instance below.
//
// Dependency direction: this file is a leaf — type-only imports only.
// CultivationPathKit (catalog) and CultivationPathSystem (authority)
// import FROM here; nothing here imports back, so domain code
// (NodeSystem/PhapTuRoutes) can consume the way predicates without a
// runtime cycle.

// D12 (stat-system-reimagined spec section 5): Linh Can (attunement)
// feeds MP through the phap_tu domain gate — the path's own conversion
// channel, not the generic attribute derivation (MP is a Phap Tu
// resource, D9). Ratios are playtest-tunable first passes, same
// convention as the ATTRIBUTE_* constants in StatCalculator.ts.
export const PHAP_TU_ATTUNEMENT_MAX_MP_PER_POINT = 4
export const PHAP_TU_ATTUNEMENT_MANA_REGEN_PER_POINT = 0.05

/**
 * The phap_tu-domain attunement -> MP modifier pair. Shared by the way
 * stat facet (assembly-time emission, id prefix 'phap_tu:attunement')
 * and the 'phap_tu' domain deltaDeriver registered in
 * CultivationPathSystem (mid-battle deltas, prefix
 * 'phap_tu:attunement_delta') — one emitter, two channels (INV-10).
 */
export function phapTuAttunementMpModifiers(attunement: number, idPrefix: string): StatModifier[] {
  return [
    {
      id: `${idPrefix}:maxMp`,
      sourceId: 'phap_tu',
      sourceType: 'attribute',
      stat: 'maxMp',
      flat: attunement * PHAP_TU_ATTUNEMENT_MAX_MP_PER_POINT,
      domain: 'phap_tu',
    },
    {
      id: `${idPrefix}:manaRegen`,
      sourceId: 'phap_tu',
      sourceType: 'attribute',
      stat: 'manaRegenPerTurn',
      flat: attunement * PHAP_TU_ATTUNEMENT_MANA_REGEN_PER_POINT,
      domain: 'phap_tu',
    },
  ]
}

// The shared way stat facet — identical for both Phap Tu ways (spec §6:
// the hidden way rides the same 'phap_tu' stat channel). Assembly-time
// emission reads the resolved attribute totals and emits the gated MP
// modifiers BEFORE calculateStats runs; collectActiveWayStatModifiers
// in CultivationPathSystem is the single consumer.
const PHAP_TU_WAY_STATS: PathWayStatFacet = {
  domains: ['phap_tu'],
  collectModifiers: (_player, totals) =>
    phapTuAttunementMpModifiers(totals.attunement, 'phap_tu:attunement'),
}

/**
 * Structural read shape for the way predicates — PlayerData and the
 * presentation-side player slices (e.g. TheBarPlayerState) both satisfy
 * it; the fields stay nullable because slices keep the persisted
 * `| null` convention.
 */
export interface PhapTuWayRead {
  cultivationPath?: CultivationPathId | null
  cultivationWay?: PathWayId | null
}

/**
 * ngu_hanh membership — the gate for ALL element/route/The machinery
 * (the R6 audit target: a bare `cultivationPath === 'phap_tu'` check
 * would leak element machinery to ngo_dao players once the M7 collapse
 * folds phap_tu_an into the base path id).
 *
 * Reads the RAW fields, same contract as NodeSystem.nodeWayApplies:
 * cultivationWay is authoritative once the ritual writes it. A
 * legacy-shaped player (cultivationPath only, no way) is NOT ngu_hanh
 * — the gate fails closed so element machinery never runs for a state
 * the path authority did not commit.
 */
export function isPhapTuNguHanh(player: PhapTuWayRead | null | undefined): boolean {
  return player?.cultivationPath === 'phap_tu' && player?.cultivationWay === 'ngu_hanh'
}

/**
 * ngo_dao membership — the gate for the hidden way's fixed-kit
 * machinery (applyAnKitToBasic/Special, the kit-learned assertion, the
 * combat emblem). M7 — strict base-pair predicate: only the persisted
 * pair ('phap_tu', 'ngo_dao') matches; the legacy 'phap_tu_an' path id
 * is gone from the union and can never satisfy this.
 */
export function isPhapTuNgoDao(player: PhapTuWayRead | null | undefined): boolean {
  return player?.cultivationPath === 'phap_tu' && player?.cultivationWay === 'ngo_dao'
}

// ---------------------------------------------------------------------------
// Way definitions — consumed by CULTIVATION_PATH_MODULES.phap_tu.ways in
// CultivationPathKit (the catalog is the single aggregation point).
// ---------------------------------------------------------------------------

export const PHAP_TU_NGU_HANH_WAY: PathWayDefinition = {
  id: 'ngu_hanh',
  pathId: 'phap_tu',
  name: 'Pháp Tu — Đại Ngũ Hành Chân Quyết',
  techniqueId: 'dai_ngu_hanh_chan_quyet',
  // MP-pool + mana-shield grants carry domain:'phap_tu' so the domain
  // gate keeps accepting them once those stats are gated to the
  // phap_tu domain.
  statModifiers: [
    {
      id: 'phap_tu_linh_luc',
      sourceId: 'phap_tu',
      sourceType: 'realm',
      stat: 'maxMp',
      flat: 100,
      domain: 'phap_tu',
    },
    {
      id: 'phap_tu_linh_luc_regen',
      sourceId: 'phap_tu',
      sourceType: 'realm',
      stat: 'manaRegenPerTurn',
      flat: 2,
      domain: 'phap_tu',
    },
    {
      id: 'phap_tu_ho_the',
      sourceId: 'phap_tu',
      sourceType: 'realm',
      stat: 'manaShieldPercent',
      flat: 0.25,
      domain: 'phap_tu',
    },
  ],
  stats: PHAP_TU_WAY_STATS,
  realmRewards: {
    foundation_establishment: {
      techniqueId: 'dai_ngu_hanh_quyet_truc_co',
      artifactId: 'ngu_hanh_chau',
    },
  },
}

export const PHAP_TU_NGO_DAO_WAY: PathWayDefinition = {
  id: 'ngo_dao',
  pathId: 'phap_tu',
  name: 'Pháp Tu Ẩn — Ngộ Đạo Chân Quyết',
  techniqueId: 'ngo_dao_chan_quyet',
  // Former phap_tu_an kit — hidden way. Owns the same 'phap_tu' stat
  // domain (the shared PHAP_TU_WAY_STATS facet) so its MP-shield line
  // passes the domain gate. skillIds intentionally absent: the kit is
  // granted in a bespoke branch (the ult slot is a passive via the
  // technique's innateSkillId, not a loadout skill). Modifier ids keep
  // the ngo_dao name now that 'phap_tu_an' is no longer a path id.
  statModifiers: [
    {
      id: 'ngo_dao_linh_luc',
      sourceId: 'phap_tu',
      sourceType: 'realm',
      stat: 'maxMp',
      flat: 100,
      domain: 'phap_tu',
    },
    {
      id: 'ngo_dao_linh_luc_regen',
      sourceId: 'phap_tu',
      sourceType: 'realm',
      stat: 'manaRegenPerTurn',
      flat: 2,
      domain: 'phap_tu',
    },
    {
      id: 'ngo_dao_ho_the',
      sourceId: 'phap_tu',
      sourceType: 'realm',
      stat: 'manaShieldPercent',
      flat: 0.25,
      domain: 'phap_tu',
    },
  ],
  stats: PHAP_TU_WAY_STATS,
  offerGate: { requiresSkillCastLevel: { skillId: 'linh_bao', level: 3 } },
}

// Ngo Dao required kit (review round-4, MEDIUM) — the ritual grants
// exactly these three skills atomically: two loadout actives + the dao
// passive carried by ngo_dao_chan_quyet.innateSkillId (the skillIds
// tuple cannot express a passive member). Battle construction asserts
// the full set is learned; a partial kit is corrupt progression state
// and must fail loudly, never silently drop a slot. Re-exported from
// CultivationPathKit so existing consumers keep their import site.
export const PHAP_TU_AN_BASIC_ID = 'van_phap_tuy_tam'
export const PHAP_TU_AN_SPECIAL_ID = 'da_phap_lien_tuyen'
export const PHAP_TU_AN_PASSIVE_ID = 'ngo_dao_hon_don'
export const PHAP_TU_AN_REQUIRED_SKILLS: readonly string[] = [
  PHAP_TU_AN_BASIC_ID,
  PHAP_TU_AN_SPECIAL_ID,
  PHAP_TU_AN_PASSIVE_ID,
]
