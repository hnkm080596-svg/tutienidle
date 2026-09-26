import type {
  CultivationPathId,
  PathStateIssue,
  PathWayDefinition,
  CultivationWayId,
  PathWayStatFacet,
} from '../player/CultivationPathKit'
import type { StatModifier } from '../stats/StatCalculator'
import { SPELL_KIT_IDS } from '../../data/skill/Skills'
import { VAN_PHAP_THAN_HOA_ID } from '../../data/buff/ReactionStatusBuffs'
import { composeRealmRewards } from '../../data/progression/RealmPassiveLadder'
import { masteryGrantRecord } from '../../data/progression/PhapTuRealmRewardNodes'
import { ARTIFACT_UNLOCK_REALM_ID } from '../artifact/ArtifactDomain'
import { ELEMENT_ORDER } from '../element/ElementLabels'
import { MAX_THE } from '../combat/CombatTypes'

// Cultivation Path Framework (spec 2026-09-16, M4) — the Phap Tu path
// module: the two way definitions + the path-domain machinery they own.
//
//   spell_pathway — ordinary Phap Tu (kit dai_ngu_hanh_chan_quyet): the
//     element/The machinery. In-way state lives on
//     player.spellPath { element } (SpellPathState stays the single
//     authority - the atomic commit is unchanged).
//   ngo_dao — Phap Tu An (kit ngo_dao_chan_quyet): hidden way offered
//     only at the Initiation Ritual when linh_bao is cast-Lv3. Fixed
//     three-skill kit (HIDDEN_SPELL_REQUIRED_SKILLS), NO element/The
//     machinery (spec: hidden basics never gain The).
//
// Both ways own the same 'spell' stat domain: the attunement -> MP
// emission is identical for spell_pathway and ngo_dao, so they share one
// PathWayStatFacet instance below.
//
// Dependency direction: this file stays acyclic - it imports only leaf
// modules (RealmPassiveLadder, ArtifactDomain, data catalogs) plus types.
// CultivationPathKit (catalog) and CultivationPathSystem (authority)
// import FROM here; nothing here imports back, so domain code
// (NodeSystem) can consume the way predicates without a
// runtime cycle.

// D12 (stat-system-reimagined spec section 5): Linh Can (attunement)
// feeds MP through the spell domain gate — the path's own conversion
// channel, not the generic attribute derivation (MP is a Phap Tu
// resource, D9). Ratios are playtest-tunable first passes, same
// convention as the ATTRIBUTE_* constants in StatCalculator.ts.
export const SPELL_ATTUNEMENT_MAX_MP_PER_POINT = 4
export const SPELL_ATTUNEMENT_MANA_REGEN_PER_POINT = 0.05

/**
 * The spell-domain attunement -> MP modifier pair. Shared by the way
 * stat facet (assembly-time emission, id prefix 'spell:attunement')
 * and the 'spell' domain deltaDeriver registered in
 * CultivationPathSystem (mid-battle deltas, prefix
 * 'spell:attunement_delta') — one emitter, two channels (INV-10).
 */
export function spellPathAttunementMpModifiers(attunement: number, idPrefix: string): StatModifier[] {
  return [
    {
      id: `${idPrefix}:maxMp`,
      sourceId: 'spell',
      sourceType: 'attribute',
      stat: 'maxMp',
      flat: attunement * SPELL_ATTUNEMENT_MAX_MP_PER_POINT,
      domain: 'spell',
    },
    {
      id: `${idPrefix}:manaRegen`,
      sourceId: 'spell',
      sourceType: 'attribute',
      stat: 'manaRegenPerTurn',
      flat: attunement * SPELL_ATTUNEMENT_MANA_REGEN_PER_POINT,
      domain: 'spell',
    },
  ]
}

// The shared way stat facet — identical for both Phap Tu ways (spec §6:
// the hidden way rides the same 'spell' stat channel). Assembly-time
// emission reads the resolved attribute totals and emits the gated MP
// modifiers BEFORE calculateStats runs; collectActiveWayStatModifiers
// in CultivationPathSystem is the single consumer.
const SPELL_WAY_STATS: PathWayStatFacet = {
  domains: ['spell'],
  collectModifiers: (_player, totals) =>
    spellPathAttunementMpModifiers(totals.attunement, 'spell:attunement'),
  // M8 — the mid-battle attunement-delta channel is declared here too:
  // the deriver sees only deltas, never the base, so a stacked
  // attunement buff cannot double-count the assembly-time emission
  // (INV-10). The framework registers it at catalog load.
  deltaDerivers: {
    spell: (delta) =>
      delta.attunement === 0
        ? []
        : spellPathAttunementMpModifiers(delta.attunement, 'spell:attunement_delta'),
  },
}

/**
 * Structural read shape for the way predicates — PlayerData and the
 * presentation-side player slices (e.g. TheBarPlayerState) both satisfy
 * it; the fields stay nullable because slices keep the persisted
 * `| null` convention.
 */
export interface SpellPathWayRead {
  cultivationPath?: CultivationPathId | null
  cultivationWay?: CultivationWayId | null
}

/**
 * spell_pathway membership — the gate for ALL element/The machinery
 * (the R6 audit target: a bare `cultivationPath === 'spell'` check
 * would leak element machinery to hidden_spell_pathway players once the M7 collapse
 * folds phap_tu_an into the base path id).
 *
 * Reads the RAW fields, same contract as NodeSystem.nodeWayApplies:
 * cultivationWay is authoritative once the ritual writes it. A
 * legacy-shaped player (cultivationPath only, no way) is NOT spell_pathway
 * — the gate fails closed so element machinery never runs for a state
 * the path authority did not commit.
 */
export function isSpellPathway(player: SpellPathWayRead | null | undefined): boolean {
  return player?.cultivationPath === 'spell' && player?.cultivationWay === 'spell_pathway'
}

// Phap Tu Reimagined (spec D1) -- the spell_pathway The cap is a flat
// 5: Phap The is a per-cast rider at threshold, never a bankable pool.
// The legacy +cap-per-node machinery (truong_the, MAX_THE + bonus) is
// retired; every other path keeps the shared MAX_THE default.
export const SPELL_PATH_MAX_THE = 5

/** Battle-scoped The-cap authority (reads onto entity.maxThe at
    participant build via CombatBuild -> runtime.resolveMaxThe). */
export function resolveMaxThe(player: SpellPathWayRead | null | undefined): number {
  return isSpellPathway(player) ? SPELL_PATH_MAX_THE : MAX_THE
}

/**
 * hidden_spell_pathway membership — the gate for the hidden way's fixed-kit
 * machinery (applyAnKitToBasic/Special, the kit-learned assertion, the
 * combat emblem). M7 — strict base-pair predicate: only the persisted
 * pair ('spell', 'hidden_spell_pathway') matches; the legacy 'phap_tu_an' path id
 * is gone from the union and can never satisfy this.
 */
export function isHiddenSpellPathway(player: SpellPathWayRead | null | undefined): boolean {
  return player?.cultivationPath === 'spell' && player?.cultivationWay === 'hidden_spell_pathway'
}

// ---------------------------------------------------------------------------
// P1-M6 - module-owned persisted-slice validation. The save boundary
// iterates this hook generically for EVERY save; the module owns ALL
// rules for player.spellPath: required + shaped on every save (mortal and
// other-path saves included - a missing/garbage object crashes
// selectSpellPathElement reads downstream), and the element field is
// spell_pathway-owned only. The payload is untrusted -
// narrow with guards, never cast; the module reads the raw pair fields
// itself for the ownership gate.
// ---------------------------------------------------------------------------
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function validateSpellPathPersistedState(
  playerPayload: unknown,
  emit: (issue: PathStateIssue) => void,
): void {
  if (!isRecord(playerPayload)) {
    return
  }

  const spellPath = playerPayload.spellPath

  if (!isRecord(spellPath)) {
    emit({ path: 'player.spellPath', message: 'phải là object' })
    return
  }

  if (
    spellPath.element !== null &&
    !ELEMENT_ORDER.some((element) => element === spellPath.element)
  ) {
    emit({ path: 'player.spellPath.element', message: 'phải là ElementType hoặc null' })
  }

  // Phap Tu Reimagined -- the route axis is retired: a persisted
  // `route` key belongs to the legacy {element, route} shape and is
  // never valid on a current save (the version gate already rejects
  // old saves; this is the defensive backstop).
  if ('route' in spellPath) {
    emit({ path: 'player.spellPath', message: 'không còn tồn tại' })
  }

  // Element ownership is spell_pathway-only - a ('spell','hidden_spell_pathway')
  // pair, a way-less pair, and every foreign pair reject ownership.
  if (
    spellPath.element !== null &&
    !(
      playerPayload.cultivationPath === 'spell' &&
      playerPayload.cultivationWay === 'spell_pathway'
    )
  ) {
    emit({
      path: 'player.spellPath',
      message: "element chỉ thuộc way 'spell_pathway' của path 'spell'",
    })
  }
}

// ---------------------------------------------------------------------------
// Way definitions — consumed by CULTIVATION_PATH_MODULES.spell.ways in
// CultivationPathKit (the catalog is the single aggregation point).
// ---------------------------------------------------------------------------

export const SPELL_PATHWAY: PathWayDefinition = {
  id: 'spell_pathway',
  pathId: 'spell',
  name: 'Pháp Tu — Đại Ngũ Hành Chân Quyết',
  techniqueId: 'five_elements_art',
  // P7-M4 - starter basic: the mortal linh_bao precursor stays the
  // basic until selectSpellPathElement() commits the element kit.
  starterBasicSkillId: 'linh_bao',
  // MP-pool + mana-shield grants carry domain:'spell' so the domain
  // gate keeps accepting them once those stats are gated to the
  // spell domain.
  statModifiers: [
    {
      id: 'phap_tu_linh_luc',
      sourceId: 'spell',
      sourceType: 'realm',
      stat: 'maxMp',
      flat: 100,
      domain: 'spell',
    },
    {
      id: 'phap_tu_linh_luc_regen',
      sourceId: 'spell',
      sourceType: 'realm',
      stat: 'manaRegenPerTurn',
      flat: 2,
      domain: 'spell',
    },
    // Phap Tu Reimagined spec D9 -- the path-level manaShieldPercent
    // grant ('phap_tu_ho_the' 0.25 LQ leak) is retired: Ho The is the
    // TC-unlocked linhLucHoTheCap DR ratio, not a static shield.
  ],
  stats: SPELL_WAY_STATS,
  // P7-M2 - canonical realm-entry passive ladder composed with the
  // way's own realm kit reward (the artifact record merges into the
  // canonical passive record). P7-M3 - the retired
  // dai_ngu_hanh_quyet_truc_co technique swap folded into
  // five_elements_art.gradeEffects[2], so no techniqueId here.
  // M-F-ARTIFACT-DEFER: the artifact grant is keyed by the shared
  // domain declaration (Kim Dan+ deferred), never a realm literal - the
  // integrity test pins the unique artifact-bearing record to
  // ARTIFACT_UNLOCK_REALM_ID.
  realmRewards: composeRealmRewards({
    [ARTIFACT_UNLOCK_REALM_ID]: {
      artifactId: 'ngu_hanh_chau',
    },
    // Three-path design (2026-09-25, sec.4-b + ruling #19) — Truc Co
    // breakthrough: mastery per element (the element gate activates only
    // the committed element's grant). Phap Tu Reimagined: the legacy
    // the_thuc_tinh The-pool-deepening grant is retired (spec D1 cap
    // is a flat 5 via resolveMaxThe, no node grants it).
    // Hidden way gets the same kinds at level 2.
    foundation_establishment: {
      grantedNodeLevels: {
        ...masteryGrantRecord(1),
      },
    },
  }),
  // P1 - spell_pathway owns the element machinery (elemental_casting:
  // element commit, MP pills, the element node-tree tabs) and the The
  // resource pool.
  capabilities: {
    static: ['spell.elemental_casting', 'spell.essence_pool'],
  },
  // P1-M3 - the element axis lives on player.spellPath (the slice owns
  // the state; selectSpellPathElement is the atomic commit). Data-only
  // declaration - the reads live in CultivationPathSystem and null-guard
  // the slice for presentation contracts that omit it.
  subpaths: {
    element: {
      requiresCapability: 'spell.elemental_casting',
      state: 'player.spellPath.element',
    },
  },
  // P1-M2 - every element kit tuple is spell_pathway-exclusive content
  // (ngo_dao never touches element machinery).
  ownedContent: {
    skillIds: [
      ...Object.values(SPELL_KIT_IDS).flat(),
    ],
  },
}

// Ngo Dao required kit (review round-4, MEDIUM) — the ritual grants
// exactly these three skills atomically (learn-only): two actives +
// the dao passive declared on the way's passiveSkillIds (the skillIds
// list cannot express a passive member). Battle construction asserts
// the full set is learned; a partial kit is corrupt progression state
// and must fail loudly, never silently drop a role. P1-M2 — the kit's
// declaration of record is the way's ownedContent.skillIds below;
// HIDDEN_SPELL_REQUIRED_SKILLS derives FROM it (single source) and is
// re-exported from CultivationPathKit so existing consumers keep their
// import site.
export const HIDDEN_SPELL_BASIC_ID = 'van_phap_tuy_tam'
export const HIDDEN_SPELL_SPECIAL_ID = 'da_phap_lien_tuyen'
export const HIDDEN_SPELL_PASSIVE_ID = 'ngo_dao_hon_don'

export const HIDDEN_SPELL_PATHWAY: PathWayDefinition = {
  id: 'hidden_spell_pathway',
  pathId: 'spell',
  name: 'Pháp Tu Ẩn — Ngộ Đạo Chân Quyết',
  techniqueId: 'dao_insight_art',
  // Former phap_tu_an kit — hidden way. Owns the same 'spell' stat
  // domain (the shared SPELL_WAY_STATS facet) so its MP-shield line
  // passes the domain gate. M9 — the two actives ride the generic
  // skillIds channel (learn-only; the path runtime resolves basic/
  // special roles from the kit, P7-M4); the kit's third member is the
  // dao passive declared on passiveSkillIds (P7-M2 - replaces the
  // retired technique innateSkillId). Modifier ids keep the ngo_dao
  // name now that 'phap_tu_an' is no longer a path id.
  skillIds: [HIDDEN_SPELL_BASIC_ID, HIDDEN_SPELL_SPECIAL_ID],
  passiveSkillIds: [HIDDEN_SPELL_PASSIVE_ID],
  // P7-M2 - canonical realm-entry passive ladder.
  // Three-path design (2026-09-25, sec.4-b) — hidden way takes the same
  // grant kinds at level 2; the_thuc_tinh is omitted because ngo_dao
  // owns no The pool (M4/R6 — a granted gain would be a dead write).
  realmRewards: composeRealmRewards({
    foundation_establishment: {
      grantedNodeLevels: {
        ...masteryGrantRecord(2),
      },
    },
  }),
  statModifiers: [
    {
      id: 'ngo_dao_linh_luc',
      sourceId: 'spell',
      sourceType: 'realm',
      stat: 'maxMp',
      flat: 100,
      domain: 'spell',
    },
    {
      id: 'ngo_dao_linh_luc_regen',
      sourceId: 'spell',
      sourceType: 'realm',
      stat: 'manaRegenPerTurn',
      flat: 2,
      domain: 'spell',
    },
    {
      id: 'ngo_dao_ho_the',
      sourceId: 'spell',
      sourceType: 'realm',
      stat: 'manaShieldPercent',
      flat: 0.25,
      domain: 'spell',
    },
  ],
  stats: SPELL_WAY_STATS,
  // P1 - the reaction aura is the SAME conditional the runtime has always
  // owned (grantsElementalReactionAura): the aura exists only while the
  // ngo_dao_hon_don passive is learned. The predicate reads skill
  // membership through the injected dep - learned skills live in
  // SkillManager, never on PlayerData. Both grant seams (battle entry +
  // dormant-source revive) consume this single capability.
  capabilities: {
    conditional: {
      'spell.reaction_aura': (_player, deps) => deps.hasSkill(HIDDEN_SPELL_PASSIVE_ID),
    },
  },
  // P1-M2 - the fixed kit plus the reaction-aura buff the runtime grant
  // plants (carrier A: ownership is declared here, the APPLICATION stays
  // with grantsElementalReactionAura).
  ownedContent: {
    skillIds: [HIDDEN_SPELL_BASIC_ID, HIDDEN_SPELL_SPECIAL_ID, HIDDEN_SPELL_PASSIVE_ID],
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
export const HIDDEN_SPELL_REQUIRED_SKILLS: readonly string[] =
  HIDDEN_SPELL_PATHWAY.ownedContent?.skillIds ?? []

