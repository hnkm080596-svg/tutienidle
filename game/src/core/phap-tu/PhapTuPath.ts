import type {
  CultivationPathId,
  PathStateIssue,
  PathWayDefinition,
  PathWayId,
  PathWayStatFacet,
} from '../player/CultivationPathKit'
import type { StatModifier } from '../stats/StatCalculator'
import { PHAP_TU_ULTIMATE_IDS } from '../../data/skill/PhapTuUltimates'
import { PHAP_TU_KIT_IDS, PHAP_TU_ROUTE_SKILL_IDS } from '../../data/skill/Skills'
import { VAN_PHAP_THAN_HOA_ID } from '../../data/buff/ReactionStatusBuffs'
import { ELEMENT_ORDER } from '../element/ElementLabels'

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
  // M8 — the mid-battle attunement-delta channel is declared here too:
  // the deriver sees only deltas, never the base, so a stacked
  // attunement buff cannot double-count the assembly-time emission
  // (INV-10). The framework registers it at catalog load.
  deltaDerivers: {
    phap_tu: (delta) =>
      delta.attunement === 0
        ? []
        : phapTuAttunementMpModifiers(delta.attunement, 'phap_tu:attunement_delta'),
  },
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
// P1-M6 - module-owned persisted-slice validation. The save boundary
// iterates this hook generically for EVERY save; the module owns ALL
// rules for player.phapTu: required + shaped on every save (mortal and
// other-path saves included - a missing/garbage object crashes
// selectPhapTuElement/resolveRouteProfile reads downstream), and the
// element/route pair is ngu_hanh-owned only. The payload is untrusted -
// narrow with guards, never cast; the module reads the raw pair fields
// itself for the ownership gate.
// ---------------------------------------------------------------------------
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function validatePhapTuPersistedState(
  playerPayload: unknown,
  emit: (issue: PathStateIssue) => void,
): void {
  if (!isRecord(playerPayload)) {
    return
  }

  const phapTu = playerPayload.phapTu

  if (!isRecord(phapTu)) {
    emit({ path: 'player.phapTu', message: 'phải là object' })
    return
  }

  if (
    phapTu.element !== null &&
    !ELEMENT_ORDER.some((element) => element === phapTu.element)
  ) {
    emit({ path: 'player.phapTu.element', message: 'phải là ElementType hoặc null' })
  }

  if (
    phapTu.route !== null &&
    phapTu.route !== 'dot' &&
    phapTu.route !== 'no'
  ) {
    emit({ path: 'player.phapTu.route', message: "phải là 'dot' | 'no' | null" })
  }

  // Atomic-pair invariant: writers commit {element, route} together
  // (selectPhapTuElement), so a half-set pair is always corrupt - and
  // only the ngu_hanh way owns the state at all (ngo_dao, kiem_tu,
  // mortal must stay {null, null} or route stats leak cross-path).
  const hasElement = phapTu.element !== null
  const hasRoute = phapTu.route !== null
  if (hasElement !== hasRoute) {
    emit({
      path: 'player.phapTu',
      message: 'element và route phải cùng null hoặc cùng đã chọn (commit nguyên tử)',
    })
  } else if (
    hasElement &&
    !(
      playerPayload.cultivationPath === 'phap_tu' &&
      playerPayload.cultivationWay === 'ngu_hanh'
    )
  ) {
    // Element/route ownership is ngu_hanh-only - a ('phap_tu','ngo_dao')
    // pair, a way-less pair, and every foreign pair reject ownership.
    emit({
      path: 'player.phapTu',
      message: "element/route chỉ thuộc way 'ngu_hanh' của path 'phap_tu'",
    })
  }
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
  // P1 - ngu_hanh owns the element/route machinery (elemental_casting:
  // element commit, route switch, route profiles, MP pills, the element
  // node-tree tabs) and the The resource pool. empowered_ult is
  // conditional on owning the linh_ngo_<element> node of the COMMITTED
  // element - node ownership stays in player.nodeLevels (NodeSystem);
  // the predicate only reads it.
  capabilities: {
    static: ['phap_tu.elemental_casting', 'phap_tu.the_pool'],
    conditional: {
      'phap_tu.empowered_ult': (player) => {
        const element = player.phapTu?.element
        return (
          element !== null &&
          element !== undefined &&
          (player.nodeLevels?.[`linh_ngo_${PHAP_TU_ULTIMATE_IDS[element]}`] ?? 0) > 0
        )
      },
    },
  },
  // P1-M3 - the element/route axes live on player.phapTu (the slice owns
  // the state; selectPhapTuElement is the atomic commit). Data-only
  // declarations - the reads live in CultivationPathSystem and null-guard
  // the slice for presentation contracts that omit it.
  subpaths: {
    element: {
      requiresCapability: 'phap_tu.elemental_casting',
      state: 'player.phapTu.element',
    },
    route: {
      requiresCapability: 'phap_tu.elemental_casting',
      state: 'player.phapTu.route',
    },
  },
  // P1-M2 - every element kit tuple plus the route skills is
  // ngu_hanh-exclusive content (ngo_dao never touches element
  // machinery). The empowered god-ult defs are node-granted variants
  // owned by the linh_ngo nodes, not the way's base kit.
  ownedContent: {
    skillIds: [
      ...Object.values(PHAP_TU_KIT_IDS).flat(),
      ...Object.values(PHAP_TU_ROUTE_SKILL_IDS).flat(),
    ],
  },
}

// Ngo Dao required kit (review round-4, MEDIUM) — the ritual grants
// exactly these three skills atomically: two loadout actives + the dao
// passive carried by ngo_dao_chan_quyet.innateSkillId (the skillIds
// list cannot express a passive member). Battle construction asserts
// the full set is learned; a partial kit is corrupt progression state
// and must fail loudly, never silently drop a slot. P1-M2 — the kit's
// declaration of record is the way's ownedContent.skillIds below;
// PHAP_TU_AN_REQUIRED_SKILLS derives FROM it (single source) and is
// re-exported from CultivationPathKit so existing consumers keep their
// import site.
export const PHAP_TU_AN_BASIC_ID = 'van_phap_tuy_tam'
export const PHAP_TU_AN_SPECIAL_ID = 'da_phap_lien_tuyen'
export const PHAP_TU_AN_PASSIVE_ID = 'ngo_dao_hon_don'

export const PHAP_TU_NGO_DAO_WAY: PathWayDefinition = {
  id: 'ngo_dao',
  pathId: 'phap_tu',
  name: 'Pháp Tu Ẩn — Ngộ Đạo Chân Quyết',
  techniqueId: 'ngo_dao_chan_quyet',
  // Former phap_tu_an kit — hidden way. Owns the same 'phap_tu' stat
  // domain (the shared PHAP_TU_WAY_STATS facet) so its MP-shield line
  // passes the domain gate. M9 — the two loadout actives ride the
  // generic skillIds channel (learned + equipped at slots 0/1); the
  // kit's third member is the dao passive carried by the technique's
  // innateSkillId, not a loadout skill. Modifier ids keep the ngo_dao
  // name now that 'phap_tu_an' is no longer a path id.
  skillIds: [PHAP_TU_AN_BASIC_ID, PHAP_TU_AN_SPECIAL_ID],
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
  // P1 - the reaction aura is the SAME conditional the runtime has always
  // owned (grantsElementalReactionAura): the aura exists only while the
  // ngo_dao_hon_don passive is learned. The predicate reads skill
  // membership through the injected dep - learned skills live in
  // SkillManager, never on PlayerData. Both grant seams (battle entry +
  // dormant-source revive) consume this single capability.
  capabilities: {
    conditional: {
      'phap_tu.reaction_aura': (_player, deps) => deps.hasSkill(PHAP_TU_AN_PASSIVE_ID),
    },
  },
  // P1-M2 - the fixed kit plus the reaction-aura buff the runtime grant
  // plants (carrier A: ownership is declared here, the APPLICATION stays
  // with grantsElementalReactionAura).
  ownedContent: {
    skillIds: [PHAP_TU_AN_BASIC_ID, PHAP_TU_AN_SPECIAL_ID, PHAP_TU_AN_PASSIVE_ID],
    buffIds: [VAN_PHAP_THAN_HOA_ID],
  },
  offerGate: { requiresSkillCastLevel: { skillId: 'linh_bao', level: 3 } },
  // Sealed hidden-path card at the ritual (named way + permanent-choice
  // warning, no plain button) — the panel reads this flag, never the id.
  sealedOffer: true,
}

// P1-M2 - the kit's declaration of record is ownedContent.skillIds
// above; this alias preserves the existing export site for the
// registry's kit assertion and the runtime dep surfaces.
export const PHAP_TU_AN_REQUIRED_SKILLS: readonly string[] =
  PHAP_TU_NGO_DAO_WAY.ownedContent?.skillIds ?? []

