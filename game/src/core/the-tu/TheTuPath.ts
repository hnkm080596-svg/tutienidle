import type {
  CultivationPathId,
  PathWayDefinition,
  CultivationWayId,
  PathWayStatFacet,
} from '../player/CultivationPathKit'
import type { StatModifier } from '../stats/StatCalculator'
import type { Stats } from '../stats/StatBlock'
import type { MainStatKey } from '../stats/StatTypes'
import {
  HIDDEN_BODY_DEX_COUNTER_PER_POINT,
  HIDDEN_BODY_DEX_FOLLOWUP_PER_POINT,
  HIDDEN_BODY_DEX_PROTECT_PER_POINT,
  HIDDEN_BODY_INT_FOLLOWUP_PER_POINT,
  HIDDEN_BODY_STR_COUNTER_PER_POINT,
  HIDDEN_BODY_VIT_PROTECT_PER_POINT,
  BODY_VITALITY_ENDURANCE_THRESHOLD_PER_POINT,
} from '../stats/TheTuStatChannels'
import {
  BACH_UNG,
  PHAN_KICH,
  THAM_THE,
  THE_TU_KIT_BY_ROOT,
  TRO_KICH,
  TRONG_PHAN_KICH,
  TU_THE,
} from '../../data/skill/TheTuSkills'
import {
  BACH_UNG_BUFF,
  BAT_TU_BA_THE_BUFF,
  HO_MON_MARKER,
  HO_VE_BUFF,
  KHIEM_KHICH_DEBUFF,
  PHAN_CHINH_BUFF,
  PHAN_MON_MARKER,
  SON_NHAC_BUFF,
  SON_NHAC_HO_THE_BUFF,
  TRO_MON_MARKER,
  TU_THE_BUFF,
  UNG_THE_BUFF,
} from '../../data/buff/TheTuBuffs'
import { composeRealmRewards } from '../../data/progression/RealmPassiveLadder'

// Cultivation Path Framework (spec 2026-09-16, M5) — the The Tu path
// module: the two way definitions + the path machinery they own.
//
//   body_pathway — ordinary The Tu (kit kim_cang_bat_hoai_the): the root-mutex
//     kit (cuong_chien XOR tran_the) + the 'body' stat domain
//     (vitality -> enduranceThreshold channel).
//   ung_the — The Tu An (kit ung_the_than_quyet): hidden way offered
//     only at the Initiation Ritual when huy_quyen reaches Lv3. Fixed
//     tham_the/tu_the/bach_ung kit with the The resource pool and the
//     reactive-chance 'hidden_body' stat domain.
//
// Each way owns exactly one stat facet: body_pathway emits enduranceThreshold
// on 'body', ung_the emits the three reactive chances on 'hidden_body'
// — same D12 two-channel pattern as spell (assembly emitter here,
// mid-battle deltaDeriver registered in CultivationPathSystem).
//
// Dependency direction: this file is a leaf — type-only imports plus
// the tuning constants in BodyStatChannels. CultivationPathKit
// (catalog) and CultivationPathSystem (authority) import FROM here;
// nothing here imports back, so domain code (GameManager, NodeSystem,
// UI bridges) can consume the way predicates without a runtime cycle.

/**
 * The hidden_body-domain attribute -> reactive-chance modifier triple
 * (spec 2026-09-15 section 3). Shared by the way stat facet (assembly-
 * time emission, id prefix 'hidden_body:attributes') and the 'hidden_body'
 * domain deltaDeriver registered in CultivationPathSystem (mid-battle
 * deltas, prefix 'hidden_body:attributes_delta') — one emitter, two
 * channels (INV-10).
 *
 * RAW uncapped linear values — REACTIVE_CHANCE_CAP is a metadata bound
 * consumed at the roll/display site, never inside the pipeline, so a
 * mid-battle attribute debuff composes against an over-cap base.
 */
export function hiddenBodyReactiveModifiers(
  totals: Pick<Stats, MainStatKey>,
  idPrefix: string,
): StatModifier[] {
  return [
    {
      id: `${idPrefix}:counterChance`,
      sourceId: 'hidden_body',
      sourceType: 'attribute',
      stat: 'counterChance',
      flat:
        totals.strength * HIDDEN_BODY_STR_COUNTER_PER_POINT +
        totals.dexterity * HIDDEN_BODY_DEX_COUNTER_PER_POINT,
      domain: 'hidden_body',
    },
    {
      id: `${idPrefix}:protectChance`,
      sourceId: 'hidden_body',
      sourceType: 'attribute',
      stat: 'protectChance',
      flat:
        totals.vitality * HIDDEN_BODY_VIT_PROTECT_PER_POINT +
        totals.dexterity * HIDDEN_BODY_DEX_PROTECT_PER_POINT,
      domain: 'hidden_body',
    },
    {
      id: `${idPrefix}:followUpChance`,
      sourceId: 'hidden_body',
      sourceType: 'attribute',
      stat: 'followUpChance',
      flat:
        totals.dexterity * HIDDEN_BODY_DEX_FOLLOWUP_PER_POINT +
        totals.intelligence * HIDDEN_BODY_INT_FOLLOWUP_PER_POINT,
      domain: 'hidden_body',
    },
  ]
}

/**
 * The body-domain vitality -> enduranceThreshold modifier (spec
 * section 3.3). Same two-channel sharing as the reactive triple above:
 * facet prefix 'body:vitality', deltaDeriver prefix
 * 'body:vitality_delta'.
 */
export function bodyEnduranceModifiers(vitality: number, idPrefix: string): StatModifier[] {
  return [
    {
      id: `${idPrefix}:enduranceThreshold`,
      sourceId: 'body',
      sourceType: 'attribute',
      stat: 'enduranceThreshold',
      flat: vitality * BODY_VITALITY_ENDURANCE_THRESHOLD_PER_POINT,
      domain: 'body',
    },
  ]
}

// The body_pathway way stat facet — vitality -> enduranceThreshold on the
// 'body' domain. collectActiveWayStatModifiers in
// CultivationPathSystem is the single assembly-time consumer.
const BODY_PATHWAY_STATS: PathWayStatFacet = {
  domains: ['body'],
  collectModifiers: (_player, totals) =>
    bodyEnduranceModifiers(totals.vitality, 'body:vitality'),
  // M8 — mid-battle vitality deltas re-emit the endurance threshold on
  // the same domain (INV-10: deltas only, never the base).
  deltaDerivers: {
    body: (delta) =>
      delta.vitality === 0 ? [] : bodyEnduranceModifiers(delta.vitality, 'body:vitality_delta'),
  },
}

// The hidden_body_pathway way stat facet — the three reactive chances on the
// 'hidden_body' domain.
const HIDDEN_BODY_PATHWAY_STATS: PathWayStatFacet = {
  domains: ['hidden_body'],
  collectModifiers: (_player, totals) =>
    hiddenBodyReactiveModifiers(totals, 'hidden_body:attributes'),
  // M8 — mid-battle attribute deltas re-derive the reactive chances.
  deltaDerivers: {
    hidden_body: (delta) => hiddenBodyReactiveModifiers(delta, 'hidden_body:attributes_delta'),
  },
}

/**
 * Structural read shape for the way predicates — PlayerData and
 * presentation-side player slices both satisfy it; the fields stay
 * nullable because slices keep the persisted `| null` convention.
 */
export interface BodyWayRead {
  cultivationPath?: CultivationPathId | null
  cultivationWay?: CultivationWayId | null
}

/**
 * body_pathway membership — the gate for ALL body_pathway-only machinery: the root-
 * mutex kit resolution (cuong_chien/tran_the), the Bất Tử Ba Thể
 * survival source, the 'body' endurance facet, the Hiện node tree.
 *
 * Reads the RAW fields, same contract as NodeSystem.nodeWayApplies:
 * cultivationWay is authoritative once the ritual writes it. A
 * legacy-shaped player (cultivationPath only, no way) is NOT body_pathway —
 * the gate fails closed so way machinery never runs for a state the
 * path authority did not commit.
 */
export function isBodyPathway(player: BodyWayRead | null | undefined): boolean {
  return player?.cultivationPath === 'body' && player?.cultivationWay === 'body_pathway'
}

/**
 * hidden_body_pathway membership — the gate for the hidden way's fixed-kit
 * machinery (tham_the/tu_the/bach_ung, reactive payloads, the The
 * pool, the 'hidden_body' reactive facet, the An node tree). M7 — strict
 * base-pair predicate: only the persisted pair ('body', 'hidden_body_pathway')
 * matches; the legacy 'the_tu_an' path id is gone from the union and
 * can never satisfy this.
 */
export function isHiddenBodyPathway(player: BodyWayRead | null | undefined): boolean {
  return player?.cultivationPath === 'body' && player?.cultivationWay === 'hidden_body_pathway'
}

// ---------------------------------------------------------------------------
// Way definitions — consumed by CULTIVATION_PATH_MODULES.body.ways in
// CultivationPathKit (the catalog is the single aggregation point).
// ---------------------------------------------------------------------------

export const BODY_PATHWAY: PathWayDefinition = {
  id: 'body_pathway',
  pathId: 'body',
  name: 'Thể Tu — Kim Cang Bất Hoại Thể',
  element: 'metal',
  techniqueId: 'kim_cang_bat_hoai_the',
  // The Tu Reimagined (T5) — root-mutex kit: the chosen progression
  // root (cuong_chien XOR tran_the) resolves the kit at battle build;
  // no loadout tuple. M9 — the ritual strips the two Thể Tu mortal
  // basics so a lingering tram/huy_quyen cannot occupy the mortal slot.
  unequipSkillIds: ['tram', 'huy_quyen'],
  // P7-M2 - canonical realm-entry passive ladder (delivered by
  // syncRealmPassive); the initiation passive below replaces the
  // retired kim_cang_bat_hoai_the.innateSkillId grant.
  realmRewards: composeRealmRewards(),
  passiveSkillIds: ['passive_kim_cang_y_chi'],
  stats: BODY_PATHWAY_STATS,
  // P1 - the fixed tree tag (cuong_chien XOR tran_the root-mutex tree).
  nodeTreeTag: 'the_tu',
  // P1-M3 - the root axis is an ownership record: the cuong_chien /
  // tran_the mutex roots live on player.nodeLevels, written by
  // NodeSystem's purchase path. No canonical reader exists - nothing
  // outside the module consumes it (M0 inventory decision).
  subpaths: {
    root: { state: 'player.nodeLevels' },
  },
  // P1-M2 - both root kits (cuong_chien + tran_the) resolve at battle
  // build from THE_TU_KIT_BY_ROOT; the buff list is what those kits
  // plant (bat_tu_ba_the survival, phan_chinh reflect emblem, son_nhac
  // ward + ho_the ally ward, khiem_khich taunt).
  ownedContent: {
    skillIds: [
      ...Object.values(THE_TU_KIT_BY_ROOT).flatMap((kit) => [
        kit.basic.id,
        kit.special.id,
        kit.ultimate.id,
      ]),
      'passive_kim_cang_y_chi',
    ],
    buffIds: [
      BAT_TU_BA_THE_BUFF.id,
      PHAN_CHINH_BUFF.id,
      SON_NHAC_BUFF.id,
      SON_NHAC_HO_THE_BUFF.id,
      KHIEM_KHICH_DEBUFF.id,
    ],
  },
}

export const HIDDEN_BODY_PATHWAY: PathWayDefinition = {
  id: 'hidden_body_pathway',
  pathId: 'body',
  name: 'Thể Tu Ẩn — Ứng Thế Thần Quyết',
  techniqueId: 'ung_the_than_quyet',
  // P7-M2 - canonical realm-entry passive ladder; no initiation passive
  // (ung_the_than_quyet carried none).
  realmRewards: composeRealmRewards(),
  // Former hidden_body kit — hidden way. Offered at the Initiation
  // Ritual only when the mortal skill huy_quyen reaches Lv3. Owns the
  // 'hidden_body' stat domain (reactive chances) and the The pool.
  offerGate: { requiresSkillLevel: { skillId: 'huy_quyen', level: 3 } },
  // P1 - hidden_body_pathway owns the The-economy machinery (the combat HUD's The
  // bar + participant The pool). The capability is the discriminator -
  // the retired usesTheResource flag is gone.
  capabilities: {
    static: ['body.essence_economy'],
  },
  // P1-M2 - the fixed kit plus the reactive-payload defs, the hidden
  // markers (ung_the economy + the three mon procs), and the buffs the
  // kit plants (tu_the/bach_ung self-buffs, ho_ve intercept ward).
  ownedContent: {
    skillIds: [THAM_THE.id, TU_THE.id, BACH_UNG.id, PHAN_KICH.id, TRO_KICH.id, TRONG_PHAN_KICH.id],
    buffIds: [
      UNG_THE_BUFF.id,
      HO_MON_MARKER.id,
      PHAN_MON_MARKER.id,
      TRO_MON_MARKER.id,
      TU_THE_BUFF.id,
      BACH_UNG_BUFF.id,
      HO_VE_BUFF.id,
    ],
  },
  // P1 - the hidden way's fixed tree tag (TheTuAnNodes).
  nodeTreeTag: 'the_tu_an',
  // P1-M3 - same root ownership record as body_pathway; the hidden_body_pathway roots are
  // non-mutex but live on the same player.nodeLevels slice.
  subpaths: {
    root: { state: 'player.nodeLevels' },
  },
  // M9 — same mortal-basic strip as body_pathway.
  unequipSkillIds: ['tram', 'huy_quyen'],
  stats: HIDDEN_BODY_PATHWAY_STATS,
}
