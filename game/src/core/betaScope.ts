// BETA SCOPE LOCK v2 - single release-policy authority for the beta
// build. Phase-1 ships the authority + helpers only; consumers wire in
// later phases.
//
// POLICY = ALLOW-LIST, never deny-list: a surface is offered only when
// it appears in one of the tables below. Every admission helper FAILS
// CLOSED - an unknown, absent, or malformed id answers "not offered"
// (false / null / 'scope-hidden'), so content added to the data files
// without touching this module stays hidden until explicitly admitted.
//
// TWO LOCK CLASSES, kept distinct on purpose:
//   - 'scope-hidden'       -> out of beta scope. NEVER render: no
//     button, card, tooltip, placeholder, coming-soon tag, wheel slot,
//     hotspot, quest, faucet, notification, currency, deep-link, or
//     shortcut.
//   - 'progression-locked' -> in beta scope but its progression gate is
//     unmet. MAY render a locked presentation.
//   - 'available'          -> in scope and ungated.
//
// This is a scope reduction, NOT a removal: mechanisms, persisted
// state, and data stay intact. Re-enabling after beta is a flag flip -
// set a BETA_FEATURES key true or extend an allow-list set.
import type { CultivationWayId } from './player/CultivationPathKit'
import type { ElementType } from './element/ElementType'
import type { Quest } from './quest/Quest'
import { REALM_TIERS } from './realm/RealmTierMap'
import {
  SPIRIT_STONE_MATERIAL_ID,
  SPIRIT_STONE_THUONG_PHAM_MATERIAL_ID,
  SPIRIT_STONE_TRUNG_PHAM_MATERIAL_ID,
} from './material/SpiritStoneMaterial'
import { LUYEN_KHI_TINH_HOA_ID } from './equipment/TinhHoaMaterial'
import { PILL_FAMILIES } from '@/data/pill/PillFamilies'
import { BREAKTHROUGH_TALENT_POOLS } from '@/data/talent/BreakthroughTalentPools'
import {
  isBreakthroughAcquisitionEnabled,
  isCompanionPullTokenSourceSuppressed,
  isDomainScopedAcquisitionEnabled,
} from './realm/ReleasePolicy'

// ---------------------------------------------------------------------------
// Ways and elements
// ---------------------------------------------------------------------------

/**
 * Ways the Initiation Ritual may offer in beta. spell_pathway only -
 * every sword/body/hidden way fails closed.
 */
export const BETA_PLAYABLE_WAYS: ReadonlySet<CultivationWayId> = new Set([
  'spell_pathway',
])

/** All five Ngu Hanh elements stay playable in beta. */
export const BETA_PLAYABLE_ELEMENTS: ReadonlySet<ElementType> = new Set([
  'fire',
  'water',
  'wood',
  'metal',
  'earth',
])

/** Beta-offerable way check - the ritual/path admission gate. */
export function isBetaWay(way: string): boolean {
  return BETA_PLAYABLE_WAYS.has(way as CultivationWayId)
}

/** Beta-offerable element check. */
export function isBetaElement(element: string): boolean {
  return BETA_PLAYABLE_ELEMENTS.has(element as ElementType)
}

// ---------------------------------------------------------------------------
// Creation contract
// ---------------------------------------------------------------------------

/**
 * The mortal starter pick is fixed in beta: every new character
 * carries 'linh_bao' as its opening basic. tram/huy_quyen remain
 * learnable precursors but are never a writable pick - the starter
 * admission (setMortalBasicSkill), the boot seam and the save
 * boundary all fail closed on any other id.
 */
export const BETA_MORTAL_STARTER_SKILL_ID = 'linh_bao'

/** Beta mortal-starter admission - only 'linh_bao' passes. */
export function isBetaMortalStarterId(skillId: string): boolean {
  return skillId === BETA_MORTAL_STARTER_SKILL_ID
}

/**
 * Creation talent offers admitted in beta: the creation catalog
 * minus 'pham_cot' (the hidden/perfection-lineage feeder - its Dai
 * Dao conversion path is out of beta scope). The allow-list covers
 * every exclusion class at once: hidden/perfection feeders,
 * future-realm-only talents, companion/formation/artifact-dependent
 * talents, and talents only meaningful on non-beta paths simply
 * never appear here. A talent added to CHARACTER_CREATION_TALENTS
 * stays unoffered until admitted to this list (fail closed).
 */
export const BETA_CREATION_TALENT_IDS: readonly string[] = [
  // Combat - offense (5)
  'kiem_quang',
  'pha_giap',
  'tat_phong',
  'trong_kich',
  'hap_linh',
  // Combat - defense (6)
  'thach_giap',
  'vo_anh',
  'can_than',
  'ho_the',
  'thu_phat',
  'bat_tu_the',
  // Cultivation (5)
  'ho_tich_bat_phat',
  'loi_kiep',
  'van_dao',
  'hai_na',
  'ngo_dao',
  // Production (2)
  'hoa_hau_thong_than',
  'bach_luyen_thanh_khi',
  // Excluded from the 19-entry creation catalog:
  //   pham_cot  - hidden/perfection-lineage feeder (Dai Dao conversion
  //             is out of beta scope; its only value is the hidden path)
  // PARKED_TALENTS (tran_tam, phu_van) are already outside the creation
  // pool - formation/talisman dependent, never admissible here.
]

/** Beta creation-offer admission check - fails closed for unknown ids. */
export function isBetaCreationTalentId(talentId: string): boolean {
  return BETA_CREATION_TALENT_IDS.includes(talentId)
}

/**
 * Every talent id a beta save can legitimately own - the creation
 * allow-list plus every breakthrough-pool member (the realm-scoped
 * transaction catalogs). Great Dao reward evolutions (pham_nhan_chi_cot
 * via the excluded pham_cot feeder) and parked ids stay inert: their
 * only acquisition paths are out of beta scope, so an owned record is
 * a carried-save record and must not emit through the effect seam.
 * Seeded from static catalogs; the test-only roster-open seam
 * (betaTalentsUnlock) admits every defined talent when the lock is
 * lifted, so suites asserting pre-beta data wiring resolve the full
 * roster.
 */
const BETA_TALENT_IDS: ReadonlySet<string> = new Set([
  ...BETA_CREATION_TALENT_IDS,
  ...Object.entries(BREAKTHROUGH_TALENT_POOLS)
    // Pools are keyed by the realm that grants them; a pool whose realm is
    // suppressed by ReleasePolicy (e.g. golden_core) is authored-but-dormant,
    // so its ids cannot be legitimately owned by a beta save either.
    .filter(([realmId]) => isBreakthroughAcquisitionEnabled(realmId))
    .flatMap(([, pool]) => pool)
    .map((talent) => talent.id),
])

/**
 * Test-only lock state for the talent roster - mutated only by
 * src/core/game/__fixtures__/betaTalentsUnlock.ts (the same pattern as
 * BETA_FEATURES / the ways allow-list). Unlocked means pre-beta
 * semantics: every defined talent id resolves through the effect seam.
 */
export const BETA_TALENT_ROSTER = { unlocked: false }

/** Beta ownership-admission check for the talent EFFECT seam. */
export function isBetaTalentId(talentId: string): boolean {
  return BETA_TALENT_ROSTER.unlocked || BETA_TALENT_IDS.has(talentId)
}

// ---------------------------------------------------------------------------
// Feature flags and lock classes
// ---------------------------------------------------------------------------

// The flag table lives in betaFeatureFlags.ts (zero-dependency leaf -
// e2e specs import it under tsconfig.node without dragging this
// module's graph along). Re-export keeps '@/core/betaScope' the
// canonical import path.
export { BETA_FEATURES } from './betaFeatureFlags'
export type { BetaFeatureName } from './betaFeatureFlags'

import { BETA_FEATURES } from './betaFeatureFlags'
import type { BetaFeatureName } from './betaFeatureFlags'

/** The two lock classes plus the open state a surface can resolve to. */
export type BetaScopeVerdict = 'available' | 'progression-locked' | 'scope-hidden'

export interface BetaScopeQuery {
  /**
   * The surface's beta admission, computed by the caller from the
   * matching allow-list helper (isBetaWay / isBetaEquipmentTab /
   * isBetaFeature / isBetaElement / isBetaEnemyId). false = out of
   * beta scope -> 'scope-hidden'.
   */
  offered: boolean
  /**
   * The consumer's own progression gate for the surface (realm gate,
   * unlock flag, offer condition). false = in scope but unmet ->
   * 'progression-locked'. Omitted/true = no unmet gate.
   */
  progressionMet?: boolean
}

export type BetaSurfaceContext = Pick<BetaScopeQuery, 'progressionMet'>

/** true only when the named feature is enabled in beta scope. */
export function isBetaFeature(name: string): boolean {
  // The `as const` table types every value `false`, so read through a
  // widened record: unknown names resolve to undefined and fail closed.
  return (BETA_FEATURES as Readonly<Record<string, boolean>>)[name] === true
}

/**
 * "Never render in beta" check - true for disabled AND for unknown
 * names (fail closed).
 */
export function isScopeHidden(feature: string): boolean {
  return !isBetaFeature(feature)
}

/**
 * Stat keys whose only writers live inside scope-hidden domains: the
 * The Tu An reactive chances (STAT_DOMAIN 'hidden_body') and the hidden
 * Phap Tu path's reaction scalar. A beta player can never produce them,
 * so stat-row surfaces must not brand the dormant systems - the same
 * contract B18's suppressed-source filters follow.
 */
export const BETA_SCOPE_HIDDEN_STAT_KEYS: ReadonlySet<string> = new Set([
  'counterChance',
  'protectChance',
  'followUpChance',
  'reactionEffectPercent',
])

export function isBetaStatLabelVisible(key: string): boolean {
  return !BETA_SCOPE_HIDDEN_STAT_KEYS.has(key)
}

/**
 * Generic verdict classifier for ANY surface: compose it with the
 * per-surface allow-list check (isBetaWay / isBetaEquipmentTab /
 * isBetaFeature / isBetaElement / isBetaEnemyId) and the consumer's
 * progression gate. Not offered -> 'scope-hidden'; offered + unmet
 * progression -> 'progression-locked'; offered + met -> 'available'.
 */
export function betaScopeVerdict(query: BetaScopeQuery): BetaScopeVerdict {
  if (!query.offered) return 'scope-hidden'
  if (query.progressionMet === false) return 'progression-locked'
  return 'available'
}

/** Feature-namespace verdict - betaScopeVerdict bound to BETA_FEATURES. */
export function betaSurfaceVerdict(
  feature: string,
  ctx?: BetaSurfaceContext,
): BetaScopeVerdict {
  return betaScopeVerdict({
    offered: isBetaFeature(feature),
    progressionMet: ctx?.progressionMet,
  })
}

/**
 * Render/no-render boolean for a feature surface. 'progression-locked'
 * counts as visible - the surface may render a locked state; only
 * 'scope-hidden' hides it.
 */
export function betaSurfaceVisible(
  feature: string,
  ctx?: BetaSurfaceContext,
): boolean {
  return betaSurfaceVerdict(feature, ctx) !== 'scope-hidden'
}

// ---------------------------------------------------------------------------
// Enemy roster authority
// ---------------------------------------------------------------------------

/**
 * Canonical beta enemy roster - 12 identities, 3 normals + 1 boss per
 * act, matching the 3-chapter x 10-floor stage model (floor 10 carries
 * the act boss). Phase-4 consumers gate stages, spawns, drops, quests,
 * and art enumeration against this list.
 */
export type BetaActId = 1 | 2 | 3

export interface BetaEnemyEntry {
  /** Enemy id as declared in data/enemy. */
  id: string
  /** Chapter/act number: 1 mortal, 2 qi_refining, 3 foundation. */
  act: BetaActId
  role: 'normal' | 'boss'
}

export const BETA_ENEMY_ROSTER: readonly BetaEnemyEntry[] = [
  // Act I - mortal (Thanh Van mortal caves)
  { id: 'mortal_wild_boar', act: 1, role: 'normal' },
  { id: 'mortal_savage_tiger', act: 1, role: 'normal' },
  { id: 'mortal_water_wolf', act: 1, role: 'normal' },
  { id: 'mortal_ferocious_giant_crocodile', act: 1, role: 'boss' },
  // Act II - qi_refining
  { id: 'wild_wolf', act: 2, role: 'normal' },
  { id: 'flame_fox', act: 2, role: 'normal' },
  { id: 'giant_earthworm', act: 2, role: 'normal' },
  { id: 'ferocious_flood_serpent', act: 2, role: 'boss' },
  // Act III - foundation_establishment
  { id: 'foundation_lava_hound', act: 3, role: 'normal' },
  { id: 'foundation_sand_scorpion', act: 3, role: 'normal' },
  { id: 'foundation_mud_golem', act: 3, role: 'normal' },
  { id: 'foundation_ferocious_flood_dragon_whelp', act: 3, role: 'boss' },
]

export const BETA_ACT_COUNT = 3
export const BETA_FLOORS_PER_ACT = 10
export const BETA_NORMALS_PER_ACT = 3
export const BETA_BOSSES_PER_ACT = 1

const BETA_ENEMY_INDEX = new Map<BetaEnemyEntry['id'], BetaEnemyEntry>(
  BETA_ENEMY_ROSTER.map((entry) => [entry.id, entry]),
)

/** Roster membership check - fails closed for unknown ids. */
export function isBetaEnemyId(id: string): boolean {
  return BETA_ENEMY_INDEX.has(id)
}

/** Owning act of a roster enemy; null for anything off-roster. */
export function betaActOfEnemy(id: string): BetaActId | null {
  return BETA_ENEMY_INDEX.get(id)?.act ?? null
}

// ---------------------------------------------------------------------------
// Alchemy recipe family authority
// ---------------------------------------------------------------------------

const BETA_ENABLED_RECIPE_FAMILY_IDS = [
  'tu_linh_dan',
  'hoi_linh_dan',
  'khai_linh_dan',
  'thong_mach_dan',
  'truc_co_dan',
] as const

export type BetaRecipeFamily = (typeof BETA_ENABLED_RECIPE_FAMILY_IDS)[number]

/** Pill families craftable in beta - every other family fails closed. */
export const BETA_ENABLED_RECIPE_FAMILIES: ReadonlySet<BetaRecipeFamily> =
  new Set(BETA_ENABLED_RECIPE_FAMILY_IDS)

/** Enabled-family check by family id (e.g. 'tu_linh_dan'). */
export function isBetaRecipeFamily(familyId: string): boolean {
  return BETA_ENABLED_RECIPE_FAMILIES.has(familyId as BetaRecipeFamily)
}

/**
 * Resolve a live recipe-family id from any of its spellings - an
 * alchemy recipe id ('alchemy_<family>_<realm>'), a pill id
 * ('<family>_<realm>'), or a bare family id. Returns null when the id
 * names no enabled beta family. Realm suffixes are matched against
 * REALM_TIERS so a family name can never collide with a suffix.
 */
export function betaRecipeFamilyOfId(id: string): BetaRecipeFamily | null {
  const bare = id.startsWith('alchemy_') ? id.slice('alchemy_'.length) : id
  for (const realm of REALM_TIERS) {
    const suffix = `_${realm}`
    if (bare.endsWith(suffix)) {
      const family = bare.slice(0, -suffix.length)
      return isBetaRecipeFamily(family) ? (family as BetaRecipeFamily) : null
    }
  }
  return isBetaRecipeFamily(bare) ? (bare as BetaRecipeFamily) : null
}

/**
 * Every authored pill id outside the realm matrix too - the two special
 * Truc Co gate pills carry no realm suffix, so the family table alone
 * cannot resolve them.
 */
const AUTHORED_PILL_FAMILY_IDS: ReadonlySet<string> = new Set([
  ...PILL_FAMILIES.map((family) => family.id),
  'thong_mach_dan',
  'truc_co_dan',
])

/**
 * Resolve a scope-hidden recipe family from an authored id spelling -
 * same grammar as betaRecipeFamilyOfId, but returns the family id only
 * when it is a KNOWN authored family that beta does not enable. Unknown
 * spellings (test/legacy ids) return null - they are not a scope
 * question. Companion to betaRecipeFamilyOfId for fail-closed
 * consumption seams that must keep dormant-family artifacts inert on a
 * carried save.
 */
export function scopeHiddenPillFamilyOfId(id: string): string | null {
  const bare = id.startsWith('alchemy_') ? id.slice('alchemy_'.length) : id
  for (const realm of REALM_TIERS) {
    const suffix = `_${realm}`
    if (bare.endsWith(suffix)) {
      const family = bare.slice(0, -suffix.length)
      return AUTHORED_PILL_FAMILY_IDS.has(family) && !isBetaRecipeFamily(family)
        ? family
        : null
    }
  }
  return AUTHORED_PILL_FAMILY_IDS.has(bare) && !isBetaRecipeFamily(bare) ? bare : null
}

// ---------------------------------------------------------------------------
// Equipment hall tabs
// ---------------------------------------------------------------------------

/** Equipment Hall tabs offered in beta; wash/refine/decompose hidden. */
export const BETA_EQUIPMENT_TABS = ['enhance', 'dissolve'] as const

export type BetaEquipmentTab = (typeof BETA_EQUIPMENT_TABS)[number]

/**
 * Authored equipment tab id -> the scope-hidden feature that owns it
 * (null = ships in beta). BETA_EQUIPMENT_TABS is the canonical beta
 * list; the binding keeps one authority so a feature flip re-admits a
 * tab instead of hand-editing the list. A tab id absent from the map
 * fails closed.
 */
const BETA_EQUIPMENT_TAB_FEATURES: Readonly<Record<string, BetaFeatureName | null>> = {
  enhance: null,
  wash: 'equipmentWash',
  refine: 'equipmentRefine',
  dissolve: null,
  decompose: 'equipmentOreDecompose',
}

/** Equipment-tab admission check - fails closed for hidden tabs. */
export function isBetaEquipmentTab(tabId: string): boolean {
  const feature = BETA_EQUIPMENT_TAB_FEATURES[tabId]
  // Unlisted tab id -> fail closed; null feature -> ships in beta.
  if (feature === undefined) {
    return false
  }
  return feature === null || isBetaFeature(feature)
}

// ---------------------------------------------------------------------------
// Quest policy
// ---------------------------------------------------------------------------

/**
 * Beta quest admission. Daily cadence is off entirely (dailyQuest flag)
 * - no enabled path. An enemy-specific kill quest is offered only when
 *   its target is on the beta roster. Generic kill quests (no enemyId)
 *   and collect quests stay enabled.
 */
export function isBetaQuestEnabled(
  quest: Pick<Quest, 'cadence' | 'condition'>,
): boolean {
  if (quest.cadence === 'daily') return false
  const condition = quest.condition
  if (condition.kind === 'kill' && condition.enemyId !== undefined) {
    return isBetaEnemyId(condition.enemyId)
  }
  return true
}

// ---------------------------------------------------------------------------
// Economy census classifications (work-order sec.17)
// ---------------------------------------------------------------------------

/**
 * Economy classes exempt from the beta source>0 && sink>0 census. The
 * census test treats a material as needing BOTH a live beta faucet and a
 * live beta sink; these named classes are the legal exceptions.
 *
 *   lore           - narrative drops deliberately sink-free by design
 *                    (mirrors LORE_ALLOWLIST in EnemyDropSinkInvariant).
 *   store_of_value - banked value whose only consumers are hidden
 *                    systems; the faucet is itself a beta action
 *                    (equipment dissolve cannot pay "nothing"), so the
 *                    material stockpiles for post-beta instead of the
 *                    action being broken.
 *   base_currency  - spirit stone tiers: the settlement currency, not a
 *                    crafting material.
 */
export type BetaEconomyClass = 'lore' | 'store_of_value' | 'base_currency'

/**
 * The ONE classification table the beta economy census consults. Ids not
 * listed here and not suppressed by a domain flag must carry a live beta
 * source AND a live beta sink or the census test fails.
 */
export const BETA_ECONOMY_EXEMPTIONS: ReadonlyMap<string, BetaEconomyClass> =
  new Map([
    ['broken_foundation_scroll', 'lore'],
    ['old_jade_slip', 'lore'],
    ['cultivator_diary', 'lore'],
    ['stele_fragment', 'lore'],
    // Luyen Khi Tinh Hoa is paid by the beta-visible Dissolve action; its
    // only consumers (wash/refine) are scope-hidden this phase, so it is
    // held as banked equipment value rather than suppressed outright.
    [LUYEN_KHI_TINH_HOA_ID, 'store_of_value'],
    [SPIRIT_STONE_MATERIAL_ID, 'base_currency'],
    [SPIRIT_STONE_TRUNG_PHAM_MATERIAL_ID, 'base_currency'],
    [SPIRIT_STONE_THUONG_PHAM_MATERIAL_ID, 'base_currency'],
  ])

/** Exemption lookup for the census test - fails closed (undefined). */
export function betaEconomyClassOf(materialId: string): BetaEconomyClass | undefined {
  return BETA_ECONOMY_EXEMPTIONS.get(materialId)
}

/**
 * Whether a persisted material stack renders on a beta bag/lore surface:
 * the companion pull token is permanently suppressed and domain-scoped
 * materials (the artifact domain today) stay invisible while their
 * domain unlock realm is unreachable. The ONE render verdict panels
 * call - banked balances stay persisted, never deleted.
 */
export function betaMaterialStackVisible(
  material: { id: string; domainUnlockRealmId?: string },
  playerRealmId: string,
): boolean {
  return (
    !isCompanionPullTokenSourceSuppressed(material.id) &&
    isDomainScopedAcquisitionEnabled(material.domainUnlockRealmId, playerRealmId)
  )
}

// ---------------------------------------------------------------------------
// Worker Lodge tabs (work-order sec.13)
// ---------------------------------------------------------------------------

/**
 * Worker Lodge tab ids as the panel authors them today: the workforce
 * tab plus the companion-bound tabs. The read-model
 * (GameManagerBuildingOps.getWorkerLodgeSurfaceModel) resolves each tab's
 * verdict here so the frontend never imports CompanionAvailability to
 * decide which tabs exist.
 */
export const BETA_WORKER_LODGE_TABS = [
  'nhan_cong',
  'qua_tang',
  'chieu_mo',
  'duyen_phan',
] as const

export type BetaWorkerLodgeTabId = (typeof BETA_WORKER_LODGE_TABS)[number]

/**
 * Which feature flag a Worker Lodge tab is gated on. FINAL POLICY
 * (sec.4C): the whole Worker Lodge surface is out of beta scope - the
 * nhan_cong workforce tab is bound to 'manualWorkforce' the same as
 * the building surface, wheel slot and left-panel mode; the other
 * three are companion surfaces. Automatic production keeps running in
 * the background with no UI.
 */
export const WORKER_LODGE_TAB_FEATURE: Readonly<
  Record<BetaWorkerLodgeTabId, BetaFeatureName>
> = {
  nhan_cong: 'manualWorkforce',
  qua_tang: 'companion',
  chieu_mo: 'companion',
  duyen_phan: 'companion',
}
