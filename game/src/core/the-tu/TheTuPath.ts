import type {
  CultivationPathId,
  PathWayDefinition,
  PathWayId,
  PathWayStatFacet,
} from '../player/CultivationPathKit'
import type { StatModifier } from '../stats/StatCalculator'
import type { Stats } from '../stats/StatBlock'
import type { MainStatKey } from '../stats/StatTypes'
import {
  THE_TU_AN_DEX_COUNTER_PER_POINT,
  THE_TU_AN_DEX_FOLLOWUP_PER_POINT,
  THE_TU_AN_DEX_PROTECT_PER_POINT,
  THE_TU_AN_INT_FOLLOWUP_PER_POINT,
  THE_TU_AN_STR_COUNTER_PER_POINT,
  THE_TU_AN_VIT_PROTECT_PER_POINT,
  THE_TU_VITALITY_ENDURANCE_THRESHOLD_PER_POINT,
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

// Cultivation Path Framework (spec 2026-09-16, M5) — the The Tu path
// module: the two way definitions + the path machinery they own.
//
//   hien — ordinary The Tu (kit kim_cang_bat_hoai_the): the root-mutex
//     kit (cuong_chien XOR tran_the) + the 'the_tu' stat domain
//     (vitality -> enduranceThreshold channel).
//   ung_the — The Tu An (kit ung_the_than_quyet): hidden way offered
//     only at the Initiation Ritual when huy_quyen reaches Lv3. Fixed
//     tham_the/tu_the/bach_ung kit with the The resource pool and the
//     reactive-chance 'the_tu_an' stat domain.
//
// Each way owns exactly one stat facet: hien emits enduranceThreshold
// on 'the_tu', ung_the emits the three reactive chances on 'the_tu_an'
// — same D12 two-channel pattern as phap_tu (assembly emitter here,
// mid-battle deltaDeriver registered in CultivationPathSystem).
//
// Dependency direction: this file is a leaf — type-only imports plus
// the tuning constants in TheTuStatChannels. CultivationPathKit
// (catalog) and CultivationPathSystem (authority) import FROM here;
// nothing here imports back, so domain code (GameManager, NodeSystem,
// UI bridges) can consume the way predicates without a runtime cycle.

/**
 * The ung_the-domain attribute -> reactive-chance modifier triple
 * (spec 2026-09-15 section 3). Shared by the way stat facet (assembly-
 * time emission, id prefix 'the_tu_an:attributes') and the 'the_tu_an'
 * domain deltaDeriver registered in CultivationPathSystem (mid-battle
 * deltas, prefix 'the_tu_an:attributes_delta') — one emitter, two
 * channels (INV-10).
 *
 * RAW uncapped linear values — REACTIVE_CHANCE_CAP is a metadata bound
 * consumed at the roll/display site, never inside the pipeline, so a
 * mid-battle attribute debuff composes against an over-cap base.
 */
export function theTuAnReactiveModifiers(
  totals: Pick<Stats, MainStatKey>,
  idPrefix: string,
): StatModifier[] {
  return [
    {
      id: `${idPrefix}:counterChance`,
      sourceId: 'the_tu_an',
      sourceType: 'attribute',
      stat: 'counterChance',
      flat:
        totals.strength * THE_TU_AN_STR_COUNTER_PER_POINT +
        totals.dexterity * THE_TU_AN_DEX_COUNTER_PER_POINT,
      domain: 'the_tu_an',
    },
    {
      id: `${idPrefix}:protectChance`,
      sourceId: 'the_tu_an',
      sourceType: 'attribute',
      stat: 'protectChance',
      flat:
        totals.vitality * THE_TU_AN_VIT_PROTECT_PER_POINT +
        totals.dexterity * THE_TU_AN_DEX_PROTECT_PER_POINT,
      domain: 'the_tu_an',
    },
    {
      id: `${idPrefix}:followUpChance`,
      sourceId: 'the_tu_an',
      sourceType: 'attribute',
      stat: 'followUpChance',
      flat:
        totals.dexterity * THE_TU_AN_DEX_FOLLOWUP_PER_POINT +
        totals.intelligence * THE_TU_AN_INT_FOLLOWUP_PER_POINT,
      domain: 'the_tu_an',
    },
  ]
}

/**
 * The the_tu-domain vitality -> enduranceThreshold modifier (spec
 * section 3.3). Same two-channel sharing as the reactive triple above:
 * facet prefix 'the_tu:vitality', deltaDeriver prefix
 * 'the_tu:vitality_delta'.
 */
export function theTuEnduranceModifiers(vitality: number, idPrefix: string): StatModifier[] {
  return [
    {
      id: `${idPrefix}:enduranceThreshold`,
      sourceId: 'the_tu',
      sourceType: 'attribute',
      stat: 'enduranceThreshold',
      flat: vitality * THE_TU_VITALITY_ENDURANCE_THRESHOLD_PER_POINT,
      domain: 'the_tu',
    },
  ]
}

// The hien way stat facet — vitality -> enduranceThreshold on the
// 'the_tu' domain. collectActiveWayStatModifiers in
// CultivationPathSystem is the single assembly-time consumer.
const THE_TU_HIEN_STATS: PathWayStatFacet = {
  domains: ['the_tu'],
  collectModifiers: (_player, totals) =>
    theTuEnduranceModifiers(totals.vitality, 'the_tu:vitality'),
  // M8 — mid-battle vitality deltas re-emit the endurance threshold on
  // the same domain (INV-10: deltas only, never the base).
  deltaDerivers: {
    the_tu: (delta) =>
      delta.vitality === 0 ? [] : theTuEnduranceModifiers(delta.vitality, 'the_tu:vitality_delta'),
  },
}

// The ung_the way stat facet — the three reactive chances on the
// 'the_tu_an' domain.
const THE_TU_UNG_THE_STATS: PathWayStatFacet = {
  domains: ['the_tu_an'],
  collectModifiers: (_player, totals) =>
    theTuAnReactiveModifiers(totals, 'the_tu_an:attributes'),
  // M8 — mid-battle attribute deltas re-derive the reactive chances.
  deltaDerivers: {
    the_tu_an: (delta) => theTuAnReactiveModifiers(delta, 'the_tu_an:attributes_delta'),
  },
}

/**
 * Structural read shape for the way predicates — PlayerData and
 * presentation-side player slices both satisfy it; the fields stay
 * nullable because slices keep the persisted `| null` convention.
 */
export interface TheTuWayRead {
  cultivationPath?: CultivationPathId | null
  cultivationWay?: PathWayId | null
}

/**
 * hien membership — the gate for ALL Hiện-only machinery: the root-
 * mutex kit resolution (cuong_chien/tran_the), the Bất Tử Ba Thể
 * survival source, the 'the_tu' endurance facet, the Hiện node tree.
 *
 * Reads the RAW fields, same contract as NodeSystem.nodeWayApplies:
 * cultivationWay is authoritative once the ritual writes it. A
 * legacy-shaped player (cultivationPath only, no way) is NOT hien —
 * the gate fails closed so way machinery never runs for a state the
 * path authority did not commit.
 */
export function isTheTuHien(player: TheTuWayRead | null | undefined): boolean {
  return player?.cultivationPath === 'the_tu' && player?.cultivationWay === 'hien'
}

/**
 * ung_the membership — the gate for the hidden way's fixed-kit
 * machinery (tham_the/tu_the/bach_ung, reactive payloads, the The
 * pool, the 'the_tu_an' reactive facet, the An node tree). M7 — strict
 * base-pair predicate: only the persisted pair ('the_tu', 'ung_the')
 * matches; the legacy 'the_tu_an' path id is gone from the union and
 * can never satisfy this.
 */
export function isTheTuUngThe(player: TheTuWayRead | null | undefined): boolean {
  return player?.cultivationPath === 'the_tu' && player?.cultivationWay === 'ung_the'
}

// ---------------------------------------------------------------------------
// Way definitions — consumed by CULTIVATION_PATH_MODULES.the_tu.ways in
// CultivationPathKit (the catalog is the single aggregation point).
// ---------------------------------------------------------------------------

export const THE_TU_HIEN_WAY: PathWayDefinition = {
  id: 'hien',
  pathId: 'the_tu',
  name: 'Thể Tu — Kim Cang Bất Hoại Thể',
  element: 'metal',
  techniqueId: 'kim_cang_bat_hoai_the',
  // The Tu Reimagined (T5) — root-mutex kit: the chosen progression
  // root (cuong_chien XOR tran_the) resolves the kit at battle build;
  // no loadout tuple. M9 — the ritual strips the two Thể Tu mortal
  // basics so a lingering tram/huy_quyen cannot occupy the mortal slot.
  unequipSkillIds: ['tram', 'huy_quyen'],
  stats: THE_TU_HIEN_STATS,
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
    skillIds: Object.values(THE_TU_KIT_BY_ROOT).flatMap((kit) => [
      kit.basic.id,
      kit.special.id,
      kit.ultimate.id,
    ]),
    buffIds: [
      BAT_TU_BA_THE_BUFF.id,
      PHAN_CHINH_BUFF.id,
      SON_NHAC_BUFF.id,
      SON_NHAC_HO_THE_BUFF.id,
      KHIEM_KHICH_DEBUFF.id,
    ],
  },
}

export const THE_TU_UNG_THE_WAY: PathWayDefinition = {
  id: 'ung_the',
  pathId: 'the_tu',
  name: 'Thể Tu Ẩn — Ứng Thế Thần Quyết',
  techniqueId: 'ung_the_than_quyet',
  // Former the_tu_an kit — hidden way. Offered at the Initiation
  // Ritual only when the mortal skill huy_quyen reaches Lv3. Owns the
  // 'the_tu_an' stat domain (reactive chances) and the The pool.
  offerGate: { requiresSkillLevel: { skillId: 'huy_quyen', level: 3 } },
  // P1 - ung_the owns the The-economy machinery (the combat HUD's The
  // bar + participant The pool). The capability is the discriminator -
  // the retired usesTheResource flag is gone.
  capabilities: {
    static: ['the_tu.the_economy'],
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
  // P1-M3 - same root ownership record as hien; the ung_the roots are
  // non-mutex but live on the same player.nodeLevels slice.
  subpaths: {
    root: { state: 'player.nodeLevels' },
  },
  // M9 — same mortal-basic strip as hien.
  unequipSkillIds: ['tram', 'huy_quyen'],
  stats: THE_TU_UNG_THE_STATS,
}
