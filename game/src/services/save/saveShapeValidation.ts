// Shape validation cho save (save-shape-validation-plan.md, Phase 0) -
// pure function, khong dependency runtime, thu hep dan tu unknown,
// KHONG dung any. Chi kiem tra SU HIEN DIEN va KIEU cua field bat buoc;
// KHONG kiem tra gia tri gameplay (balance thuoc he thong load tung phan).
//
// Quy uoc: khi them field BAT BUOC moi vao GameSave/PlayerData, task them
// field phai cap nhat validator nay + SaveRoundTrip.test.ts trong cung
// thay doi (round-trip test se do neu buildGameSave() thieu field ma
// validator doi, va nguoc lai).
import { CURRENT_SAVE_VERSION } from './saveVersion'
import { REALMS } from '../../data/realms/realm'
import { COMPANIONS, isBetaCompanionGift } from '../../data/companion/Companions'
import { COMPANION_GIFT_MOMENTS } from '../../data/companion/CompanionGiftMoments'
import { COMPANION_UNLOCK_REALM_ID } from '../../core/companion/CompanionAvailability'
import {
  companionExpRequiredForLevel,
  MAX_CONSTELLATION_RANK,
} from '../../core/companion/CompanionProgression'
import { ITEM_QUALITY_ORDER, type ItemQuality } from '../../core/item/ItemQuality'
import { getRealmIdForProfessionGrade, isProfessionGrade } from '../../core/profession/ProfessionGrade'
import { isHerbAge } from '../../core/production/ProductionTypes'
import { isAuthoredRealmId, producibleEquippedGrades } from '../../core/equipment/canUseItem'
import { createBaseStats } from '../../core/stats/StatBlock'
import { EQUIPMENT_SLOTS } from '../../core/equipment/EquipmentSlotState'
import type { EquipmentSlot } from '../../core/equipment/EquipmentTypes'
import { ENHANCE_PITY_THRESHOLD, MAX_SLOT_ENHANCE_LEVEL } from '../../core/equipment/EnhanceCurve'
import { MAIN_STAT_REALM_SCALE } from '../../core/equipment/EquipmentRolling'
import { ITEM_QUALITY_IMPLICIT_MULTIPLIER } from '../../core/equipment/ItemQualityBalance'
import { EQUIPMENT_BAG_SOFT_CAP, EQUIPMENT_PROTECTION_CAP } from '../../core/equipment/EquipmentBag'
import { equipment } from '../../data/equipment/equipment'
import {
  CULTIVATION_PATH_MODULES,
  type CultivationPathId,
  type CultivationWayId,
} from '../../core/player/CultivationPathKit'
import { COMBAT_AI_STRATEGIES } from '../../core/battle/CombatAiStrategy'
import { FOUNDATION_LABELS } from '../../core/breakthrough/FoundationType'
import {
  isArtifactGrade,
  isArtifactPath,
  resolveExpectedArtifactId,
} from '../../core/artifact/Artifact'
import { ARTIFACT_UNLOCK_REALM_ID } from '../../core/artifact/ArtifactDomain'
import { validateBodyProgressionPersistedState } from '../../core/realm/body/BodyProgressionSystem'
import { validateHiddenPerfectionPersistedState } from '../../core/realm/hidden/HiddenPerfection'
import { SKILL_CORE_NODES } from '../../data/progression/SkillCoreNodes'
import { SKILLS } from '../../data/skill/Skills'
import { STAGES } from '../../data/stage/Stages'
import { zones } from '../../data/stage/Zones'
import { BREAKTHROUGH_TALENT_POOLS } from '../../data/talent/BreakthroughTalentPools'
import { PHAP_TU_NODES } from '../../data/progression/PhapTuNodes'
import { MORTAL_TIEN_THAN_NODES } from '../../data/progression/MortalTienThanNodes'
import { PHAP_TU_ELEMENT_ROOT_IDS } from '../../data/progression/PhapTuNodes.builders'
import { PHAP_TU_AN_NODES } from '../../data/progression/PhapTuAnNodes'
import { KIEM_TU_NODES } from '../../data/progression/KiemTuNodes'
import { THE_TU_NODES } from '../../data/progression/TheTuNodes'
import { THE_TU_AN_NODES } from '../../data/progression/TheTuAnNodes'
import {
  CHARACTER_CREATION_TALENTS,
  GREAT_DAO_REWARD_TALENTS,
  PARKED_TALENTS,
  getTalentDefinition,
} from '../../data/talent/Talents'
import { TRAN_PHAP_FORMATIONS } from '../../data/formation/TranPhap'
import { authoredRealmPassiveEntries, REALM_PASSIVES } from '../../data/realm/RealmPassives'
import { MERIDIANS } from '../../data/realm/Meridians'
import { resolveKienCoGrade } from '../../data/breakthrough/BreakthroughGrades'
import { CHARACTER_CREATION_TALENT_COUNT } from '../character/CharacterCreationService'
import {
  alchemySecondsFor,
  verifyAlchemyJobReservation,
  type ActiveAlchemyJob,
} from '../../core/alchemy/AlchemySystem'
import { TALENT_PASSIVE_SKILLS } from '../../data/skill/TalentPassives'
import {
  verifyTribulationCommitWitness,
  type TribulationCommitWitnessedRecord,
} from '../../core/tribulation/TribulationCommitWitness'
import {
  CYCLE_BASE_SECONDS_BY_REALM,
  computeCycleSeconds,
} from '../../core/production/ProductionBalance'
import { BETA_MORTAL_STARTER_SKILL_ID } from '../../core/betaScope'
import type { PlayerData } from '../../core/player/Player'
import type { PersistentTimedEffect } from '../../core/player/PersistentTimedEffect'
import { pills } from '../../data/pill/pills'
import {
  TU_LINH_TRAN_BUFF_PERCENT,
  TU_LINH_TRAN_DURATION_MS,
  TU_LINH_TRAN_EFFECT_GROUP,
  getActiveCultivationSpeedPercent,
} from '../../core/economy/TuLinhTranBalance'
import { TRIBULATION_COOLDOWN_SECONDS } from '../../core/tribulation/TribulationDirector'
import { GLOBAL_MAX_AFFIXES } from '../../core/equipment/EquipmentRollPrimitives'
import {
  ITEM_QUALITY_AFFIX_TIER,
  ITEM_QUALITY_FORGE_USES,
  ITEM_QUALITY_SUBSTATS_RANGE,
  ITEM_QUALITY_UNLOCKED_POOLS,
} from '../../core/equipment/ItemQualityBalance'
import { isValidEquipmentSubstat } from '../../core/equipment/EquipmentStatPolicy'
import { affixes } from '../../data/equipment/affixes'
import { alchemyRecipes } from '../../data/alchemy/alchemyRecipes'
import { buildings } from '../../data/building/buildings'
import { THANH_VAN_PRODUCTION_SITES } from '../../core/production/ProductionCatalog'
import { scopeHiddenPillFamilyOfId } from '../../core/betaScope'
import {
  BASE_CULTIVATION_PER_SECOND,
  getGlobalCultivationLevel,
  getRealmIndex,
  getRequiredCultivation,
} from '../../core/realm/realmSystem'
import { getRealmTier, PRODUCIBLE_REALM_TIER_LEAD } from '../../core/realm/RealmTierMap'
import {
  isBeyondReleaseCeiling,
  isBreakthroughAcquisitionEnabled,
  isCompanionPullTokenSourceSuppressed,
  isRealmAvailable,
  progressionCeilingRealmId,
} from '../../core/realm/ReleasePolicy'
import { isBetaStandalonePanel } from '../../core/betaScopeSurface'
import {
  SPIRIT_STONE_THUONG_PHAM_MATERIAL_ID,
  SPIRIT_STONE_TRUNG_PHAM_MATERIAL_ID,
} from '../../core/material/SpiritStoneMaterial'
import { materials as materialCatalog } from '../../data/materials/materials'
import {
  getCultivationRampMultiplier,
  getCultivationSpeedMultiplier,
  getInsightPerCultivation,
  hasCultivationOverflowBank,
} from '../../core/talent/TalentEffects'
import { betaEffectiveWorkerCapacity } from '../../core/production/WorkerCapacity'
import { getTalentMaxLevel, isLegalBreakthroughOffer, isTalentEntitlementActionable } from '../../core/talent/TalentEntitlement'
import { skillCoreNodeId } from '../../core/progression/SkillCoreLevel'
import { isPhysiqueGradeId } from '../../data/realm/PhysiqueLadder'
import { getActiveElement } from '../../core/player/CultivationPathSystem'

// M-QI-05 (v73) - canonical Core Node lookups for the coverage checks:
// a save that loads must leave every levelled learned skill, every
// way-declared core member, and every owned-node grant resolvable
// against player.nodeLevels (+ the purchasedNodeIds mirror). Registered
// metadata only - no nodeRegistry access at the save boundary.
const SKILL_CORE_BY_ID = new Map(SKILL_CORE_NODES.map((node) => [node.id, node]))

const LEVELLED_SKILL_IDS = new Set(SKILLS.filter((skill) => skill.maxLevel > 1).map((skill) => skill.id))

// Wave-2 writer bounds scan the whole authored talent catalog - the
// producible sets below hold for any selection the player could hold.
const ALL_TALENT_DEFINITIONS = [
  ...CHARACTER_CREATION_TALENTS,
  ...GREAT_DAO_REWARD_TALENTS,
  ...PARKED_TALENTS,
]

// F-ALCH-JOB-FORGE - producible costScale set. startJob computes
// costScale = max(1, costMultiplier) from the alchemy_double_pill
// talent effect: 1 is always producible (no counter-cost talent),
// plus every authored costMultiplier. A persisted reservation naming
// any other scale was never produced by startJob.
const ALCHEMY_JOB_PRODUCIBLE_COST_SCALES: ReadonlySet<number> = new Set(
  [1].concat(
    ALL_TALENT_DEFINITIONS.flatMap((talent) =>
      [talent.effects, ...(talent.levels ?? [])]
        .flat()
        .flatMap((effect) =>
          effect.kind === 'alchemy_double_pill' ? [Math.max(1, effect.costMultiplier)] : [],
        ),
    ),
  ),
)

// F-PHAGIAP-CARRY - the sole writer banks floor(passiveStacks *
// carryFraction) at battle end and stacks cap at the bound passive's
// authored maxStacks, so the producible bank max is floor(cap *
// fraction) over every authored passive_stack_carry effect. A carry
// binding a passive with an unbounded stack modifier leaves the claim
// unbounded - the bound stays Infinity and skips enforcement (recorded
// here, never silently dropped).
const PHA_GIAP_CARRY_BANK_MAX: number = (() => {
  let bound = 0

  for (const talent of ALL_TALENT_DEFINITIONS) {
    for (const effects of [talent.effects, ...(talent.levels ?? [])]) {
      for (const effect of effects) {
        if (effect.kind !== 'passive_stack_carry') {
          continue
        }

        const passive = TALENT_PASSIVE_SKILLS.find((skill) => skill.id === effect.passiveSkillId)

        if (passive === undefined) {
          continue
        }

        const modifiers = passive.passiveModifiers ?? []

        if (modifiers.some((modifier) => modifier.maxStacks === undefined)) {
          bound = Number.POSITIVE_INFINITY
          continue
        }

        const stackCap = modifiers.reduce((sum, modifier) => sum + (modifier.maxStacks ?? 0), 0)

        bound = Math.max(bound, Math.floor(stackCap * effect.fraction))
      }
    }
  }

  return bound
})()

// r24-AUT (d) + r25-COR: every player-owned id collection is
// dedup/element-type only - a crafted payload with thousands of unique
// entries validates and inflates every write and restore walk. Honest
// counts are bounded by the authored rosters (quests ~two dozen,
// stages, nodes, talents - all small catalogs); 1024 leaves generous
// headroom for future content while closing the wedge uniformly.
const ID_COLLECTION_CAP = 1024

const SKILL_TEMPLATE_BY_ID = new Map(SKILLS.map((skill) => [skill.id, skill]))

const STAGE_BY_ID = new Map(STAGES.map((stage) => [stage.id, stage]))

// F-A10: realm-earnability lookups - a persisted claim naming a
// realm-gated writer (breakthrough talent pool, realm-ladder passive,
// realm-gated stage) is only coherent while the player's own realm is
// at least the writer's realm. Realm order is monotonic, so a learned
// record can never outrank the holder's realm.
const TALENT_POOL_REALM_BY_ID = new Map<string, string>()
for (const [realmId, pool] of Object.entries(BREAKTHROUGH_TALENT_POOLS)) {
  for (const talent of pool) {
    if (!TALENT_POOL_REALM_BY_ID.has(talent.id)) {
      TALENT_POOL_REALM_BY_ID.set(talent.id, realmId)
    }
  }
}

const PROGRESSION_NODE_BY_ID = new Map(
  [
    ...PHAP_TU_NODES,
    ...PHAP_TU_AN_NODES,
    ...KIEM_TU_NODES,
    ...THE_TU_NODES,
    ...THE_TU_AN_NODES,
    ...SKILL_CORE_NODES,
    ...MORTAL_TIEN_THAN_NODES,
  ].map((node) => [node.id, node]),
)

// F-A19-1: root nodeId -> owning element. commitFiveElementInitiation is
// the only writer and it mints exactly the committed element's root, so
// an owned root is only producible when player.spellPath.element names
// that element (a mortal save can hold none of the five).
const ELEMENT_BY_ROOT_ID = new Map<string, string>(
  Object.entries(PHAP_TU_ELEMENT_ROOT_IDS).map(([element, rootId]) => [rootId, element]),
)

// F-TAL-1 / F-REALM-1 / F-TC10: ownership and claim earnability lookups.
// - Creation grants exactly CHARACTER_CREATION_TALENT_COUNT pick; each
//   major-realm entry mints one entitlement resolving into one pool pick.
// - Parked talents have weight 0 and no writer at all (never rolled).
// - Great Dao rewards exist only via the pham_cot conversion at a hidden
//   foundation breakthrough - the foundation record is the witness.
const CREATION_TALENT_IDS = new Set(CHARACTER_CREATION_TALENTS.map((talent) => talent.id))
const PARKED_TALENT_IDS = new Set(PARKED_TALENTS.map((talent) => talent.id))
const GREAT_DAO_REWARD_TALENT_IDS = new Set(GREAT_DAO_REWARD_TALENTS.map((talent) => talent.id))

const FOUNDATION_CLAIM_RANK: Record<string, number> = {
  human: 1,
  earth: 2,
  heaven: 3,
  great_dao: 4,
}

// F-A12-2: completedTiers monotonic read for the breakthroughGrade
// bound - defensive over a save still being shaped (malformed slices
// are flagged by the body-progression block separately).
function persistedBodyRefinementTiers(player: Record<string, unknown>): number {
  if (!isObject(player.bodyProgression) || !isObject(player.bodyProgression.body_refinement)) {
    return 0
  }

  const tiers = player.bodyProgression.body_refinement.completedTiers

  return isNonNegativeFiniteNumber(tiers) ? Math.floor(tiers as number) : 0
}

// F-A12-1 / F-TRB-1: the foundation-grade ceiling derivable from this
// player's own monotonic records, via the domain resolver (truc_co_dan
// pill condition waived - the witness pill may have left the bag after
// the outcome was recorded). A claim above the resolvable rank is
// fabricated; a malformed body slice resolves 'human'.
function persistedResolvableFoundationRank(player: Record<string, unknown>): number {
  try {
    return FOUNDATION_CLAIM_RANK[resolveKienCoGrade(player as unknown as PlayerData, true)] ?? 1
  } catch {
    return FOUNDATION_CLAIM_RANK.human ?? 1
  }
}

// F-CG-MOMENT: issueCompanionGifts mints record.id = moment.id and
// record.definitionId = moment.definitionId verbatim from this closed
// table, so a persisted entry binds one authored moment - foreign id,
// mismatched pair, or missing trigger witness are all unproducible.
const COMPANION_GIFT_MOMENT_BY_ID = new Map(
  COMPANION_GIFT_MOMENTS.map((moment) => [moment.id, moment]),
)

// F-MAT-REALM: profession materials stamp their authoring realm in
// profession.realmId. Every faucet is realm-bounded (territory tiers
// clamp to the player realm, stage drop tables key on requiredRealmId),
// and authored no-gate collect quests tolerate one tier ahead - the
// producible ceiling for a holding is claimed realm tier + 1.
const PROFESSION_MATERIAL_REALM_TIER_BY_ID = new Map<string, number>(
  materialCatalog.flatMap((material) =>
    material.profession === undefined
      ? []
      : ([[material.id, getRealmTier(material.profession.realmId)]] as [string, number][]),
  ),
)

// F-MAT-DOMAIN-SCOPE: domain-scoped materials (no profession meta -
// they escape the F-MAT-REALM pin) deliver only while
// isDomainScopedAcquisitionEnabled can open: the authored domain-unlock
// realm must sit inside the release window AND within reach of the
// claimed realm.
const DOMAIN_UNLOCK_REALM_ID_BY_MATERIAL_ID = new Map<string, string>(
  materialCatalog.flatMap((material) =>
    material.domainUnlockRealmId === undefined
      ? []
      : ([[material.id, material.domainUnlockRealmId]] as [string, string][]),
  ),
)

// F-PILL-REALM-PIN: realm-keyed pills mint only through same-realm
// alchemy recipes or realm-bounded grants, and breakthroughRealmId pills
// only inside an open acquisition window - the catalog lookup below keys
// the per-record pin.
const CATALOG_PILL_BY_ID = new Map(pills.map((pill) => [pill.id, pill]))

const STAT_TYPES = new Set<string>(Object.keys(createBaseStats()))

// F-TC6-1: the Loi Kiep victory grant upserts one modifier per main
// stat (TribulationOutcomeService) - the claim shape and its victory
// bound are closed: +0.1 per major realm transition at most.
const LOI_KIEP_MAIN_STATS = [
  'strength',
  'dexterity',
  'intelligence',
  'attunement',
  'vitality',
] as const

const STAT_MODIFIER_NUMERIC_FIELDS = [
  'flat',
  'percent',
  'multiplier',
  'stacks',
  'maxStacks',
  'perLevelFlat',
  'perLevelPercent',
] as const

export interface ShapeIssue {
  path: string

  message: string
}

export type ShapeValidationResult =
  | {
      ok: true

      issues: []

      /** Ban save da bo equipment legacy va dien default optional an toan. */
      normalizedSave: unknown

      /** Cau noi cho UI bao so equipment legacy da bo khi load. */
      discardedEquipmentCount: number
    }
  | {
      ok: false

      issues: ShapeIssue[]

      discardedEquipmentCount: number
    }

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isNonNegativeFiniteNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0
}

// F-R21-01/02/03 (COR-1/2/3 same class): persisted timestamp cursors
// feed settle/tick machinery whose mechanism guard rejects
// |stamp| >= 2^53 (outside the exact-integer-ms domain any ms-delta
// absorbs). Finite-only admission let a crafted magnitude record
// through: the mechanism then froze its whole site verbatim on every
// settle + tickWorkers and re-persisted it - a permanent silent wedge
// worse than save rejection. Admission owns the same bound for every
// persisted timestamp cursor.
//
// The bound is 2^52, not 2^53: the derivations downstream do one
// honest-epoch add/subtract on the stamp (offlineSinceMs = min(stamp,
// authorityNow - elapsed*1000) in GameManagerSaveRestore; the /1000
// float64 round-trip re-lands the outermost admitted value EXACTLY on
// -2^53 - QA-r22-int-01). 2^52 keeps ~4.5e15 of headroom between the
// admitted domain and the absorb line, so no derived cursor can drift
// onto the mechanism pin. Honest stamps are epoch-ms (~1.8e12) or
// epoch-seconds (~1.8e9, buildings lastCollectedAt) - the bound is
// still ~2500x beyond anything a real clock writes.
function isBoundedTimestamp(value: unknown): value is number {
  return isFiniteNumber(value) && Math.abs(value) < 2 ** 52
}

function isNonNegativeBoundedTimestamp(value: unknown): value is number {
  return isBoundedTimestamp(value) && value >= 0
}

function isItemQuality(value: unknown): value is ItemQuality {
  return typeof value === 'string' && ITEM_QUALITY_ORDER.some((quality) => quality === value)
}

function isEquipmentSlot(value: unknown): value is EquipmentSlot {
  return typeof value === 'string' && EQUIPMENT_SLOTS.some((slot) => slot === value)
}

/** Field bat buoc kieu array - tra ve array neu hop le de kiem tra phan tu. */
function requireArray(
  target: Record<string, unknown>,
  key: string,
  path: string,
  issues: ShapeIssue[],
): unknown[] | undefined {
  const value = target[key]

  if (!Array.isArray(value)) {
    issues.push({ path: `${path}.${key}`, message: 'phải là array' })

    return undefined
  }

  // Every array that reaches this helper is honestly bounded by an
  // authored roster (catalogs, buildings, slots) - the nested
  // workerCycles lanes carry their own maxLanes bound instead.
  if (value.length > ID_COLLECTION_CAP) {
    issues.push({ path: `${path}.${key}`, message: `vượt ID_COLLECTION_CAP (${ID_COLLECTION_CAP})` })
    // r29-INT-4/AUT-3: a refused collection pays no element walk -
    // return it empty so per-entry validators (incl. per-job digest
    // folds) skip it like the capped record maps.
    return []
  }

  return value
}

/** Field optional - chi kiem kieu khi hien dien (khong bat buoc co mat). */
function optionalArray(
  target: Record<string, unknown>,
  key: string,
  path: string,
  issues: ShapeIssue[],
): unknown[] | undefined {
  const value = target[key]

  if (value === undefined) {
    return undefined
  }

  if (!Array.isArray(value)) {
    issues.push({ path: `${path}.${key}`, message: 'phải là array hoặc vắng mặt' })

    return undefined
  }

  if (value.length > ID_COLLECTION_CAP) {
    issues.push({ path: `${path}.${key}`, message: `vượt ID_COLLECTION_CAP (${ID_COLLECTION_CAP})` })
    return []
  }

  return value
}

function requireString(
  target: Record<string, unknown>,
  key: string,
  path: string,
  issues: ShapeIssue[],
) {
  if (typeof target[key] !== 'string') {
    issues.push({ path: `${path}.${key}`, message: 'phải là string' })
  }
}

function requireBoolean(
  target: Record<string, unknown>,
  key: string,
  path: string,
  issues: ShapeIssue[],
) {
  if (typeof target[key] !== 'boolean') {
    issues.push({ path: `${path}.${key}`, message: 'phải là boolean' })
  }
}

function requireNonNegativeNumber(
  target: Record<string, unknown>,
  key: string,
  path: string,
  issues: ShapeIssue[],
) {
  if (!isNonNegativeFiniteNumber(target[key])) {
    issues.push({ path: `${path}.${key}`, message: 'phải là number hữu hạn >= 0' })
  }
}

// M-F-BODY-HIDDEN (save v81) - per-channel counter maps persist as
// Record<channelId, int>=0>; required maps reject non-objects, optional
// maps validate only when present.
function validateNonNegativeIntMap(
  value: unknown,
  path: string,
  issues: ShapeIssue[],
): void {
  if (!isObject(value)) {
    issues.push({ path, message: 'phải là object map' })

    return
  }

  // r26-AUT-2/INT-04: the map shape itself needs the same count bound
  // every other id collection got - the entries loop alone lets a
  // crafted map inflate the payload and re-tax every validation walk.
  if (Object.keys(value).length > ID_COLLECTION_CAP) {
    issues.push({ path, message: `vượt ID_COLLECTION_CAP (${ID_COLLECTION_CAP})` })
    return
  }

  for (const [key, entry] of Object.entries(value)) {
    if (!Number.isInteger(entry) || (entry as number) < 0) {
      issues.push({ path: `${path}.${key}`, message: 'phải là int không âm' })
    }
  }
}

// Fixups the validator derives but does not flag: values the restore
// seam folds into normalizedSave (like the equipment normalization at
// the tail of this file). A fixup is only ever a DERIVED SNAPSHOT the
// owning writer recomputes anyway, so clamping can never lose state.
interface PlayerShapeNormalization {
  cultivationPerSecond?: number
}

function validatePlayer(player: unknown, issues: ShapeIssue[]): PlayerShapeNormalization {
  const normalization: PlayerShapeNormalization = {}

  if (!isObject(player)) {
    issues.push({ path: 'player', message: 'phải là object' })

    return normalization
  }

  requireString(player, 'name', 'player', issues)
  requireString(player, 'realmId', 'player', issues)

  // Audit fix 2026-08-31 - realmId rac tung pass shape check (chi kiem
  // string) roi crash boot o getCurrentRealm() throw (white-screen).
  if (
    typeof player.realmId === 'string' &&
    !REALMS.some((realm) => realm.id === player.realmId)
  ) {
    issues.push({
      path: 'player.realmId',
      message: `không tồn tại trong danh sách cảnh giới: ${player.realmId}`,
    })
  }

  // F-REALM-CEILING: the beta release ladder ends at
  // progressionCeilingRealmId - a realmId beyond it cannot be produced
  // by any transition writer (isRealmTransitionEnabled fails closed),
  // yet the claim would relax every realmIndex-scaled bound below
  // (talent picks, loi kiep percent, technique grade ceiling, forge
  // budgets). Reject it at the boundary instead of loading an
  // unproducible progression state.
  if (typeof player.realmId === 'string' && isBeyondReleaseCeiling(player.realmId)) {
    issues.push({
      path: 'player.realmId',
      message: `vượt release ceiling (${progressionCeilingRealmId}): ${player.realmId}`,
    })
  }

  // M-QI-07 (v74, QI-D4) - physiqueGrade is required and must be a
  // ladder member. Semantic coherence with completed chapters is the
  // restore preflight's job (derivePhysiqueGrade), not shape's.
  requireString(player, 'physiqueGrade', 'player', issues)

  if (
    typeof player.physiqueGrade === 'string' &&
    !isPhysiqueGradeId(player.physiqueGrade)
  ) {
    issues.push({
      path: 'player.physiqueGrade',
      message: `không phải thành viên thang thể phách: ${player.physiqueGrade}`,
    })
  }

  // realmLevel >= 1 - nen cua moi tinh toan progression; NaN/am o day
  // lay sang cultivation curve.
  if (!isFiniteNumber(player.realmLevel) || player.realmLevel < 1) {
    issues.push({ path: 'player.realmLevel', message: 'phải là number hữu hạn >= 1' })
  } else {
    // A realmLevel past the realm's authored maxLevel is an impossible
    // claim - progression writes stop at maxLevel, and the
    // attributePoints bound below is derived from the same field.
    const realm = REALMS.find((entry) => entry.id === player.realmId)
    if (realm !== undefined && player.realmLevel > realm.maxLevel) {
      issues.push({
        path: 'player.realmLevel',
        message: `vượt maxLevel của realm (${realm.maxLevel})`,
      })
    }
  }

  // cultivation/cultivationPerSecond - thieu cultivationPerSecond tung gay
  // NaN vinh vien cho cultivation qua calculateOfflineProgress (review
  // 2026-08-28 bug #2).
  requireNonNegativeNumber(player, 'cultivation', 'player', issues)

  // F-CULT-OVERCAP: addCultivation is the sole writer and clamps every
  // gain at the current tier's getRequiredCultivation - overflow banks
  // to cultivationOvercharge (Hai Nap) or waits at the cap for the
  // breakthrough ritual - so a persisted value above required is a
  // forged magnitude claim.
  if (
    isNonNegativeFiniteNumber(player.cultivation) &&
    typeof player.realmId === 'string' &&
    REALMS.some((realm) => realm.id === player.realmId) &&
    isNonNegativeFiniteNumber(player.realmLevel) &&
    player.cultivation > getRequiredCultivation(player.realmId, player.realmLevel)
  ) {
    issues.push({
      path: 'player.cultivation',
      message: 'vượt required của tầng hiện tại (writer clamp tại getRequiredCultivation)',
    })
  }

  requireNonNegativeNumber(player, 'cultivationPerSecond', 'player', issues)

  // Mission A review - the player record/array fields below were
  // container-only until now: baseStats.might = 'huge' passed the
  // boundary, slipped through the key whitelist (keys only, not
  // values), and spread NaN through every stat computation.
  if (!isObject(player.baseStats)) {
    issues.push({ path: 'player.baseStats', message: 'phải là object' })
  } else if (Object.keys(player.baseStats).length > ID_COLLECTION_CAP) {
    issues.push({ path: 'player.baseStats', message: `vượt ID_COLLECTION_CAP (${ID_COLLECTION_CAP})` })
  } else {
    for (const [statKey, statValue] of Object.entries(player.baseStats)) {
      if (!isFiniteNumber(statValue)) {
        issues.push({
          path: `player.baseStats.${statKey}`,
          message: 'phải là số hữu hạn',
        })
      }
    }
  }

  const playerModifiers = requireArray(player, 'modifiers', 'player', issues)

  if (playerModifiers) {
    validateStatModifierEntries(playerModifiers, 'player.modifiers', issues)
  }

  const externalModifiers = requireArray(player, 'externalModifiers', 'player', issues)

  if (externalModifiers) {
    validateStatModifierEntries(externalModifiers, 'player.externalModifiers', issues)
  }

  const selectedTalentIds = requireArray(player, 'selectedTalentIds', 'player', issues)

  if (selectedTalentIds) {
    validateStringEntries(selectedTalentIds, 'player.selectedTalentIds', issues)

    // F-A10-1: breakthrough-pool talents are minted by a victory INTO
    // that pool's realm - holding one on a lower realm is a fabricated
    // claim. Creation/reward talents carry no pool key and stay
    // tolerated at any realm.
    const talentRealmIndex =
      typeof player.realmId === 'string' ? getRealmIndex(player.realmId) : -1

    // F-TAL-1: talent count is an earnability claim - creation grants
    // exactly CHARACTER_CREATION_TALENT_COUNT and each major-realm
    // entry mints one entitlement resolving into at most one pool
    // pick, so the total can never exceed count + realmIndex.
    const maxTalentPicks =
      talentRealmIndex >= 0
        ? CHARACTER_CREATION_TALENT_COUNT + talentRealmIndex
        : CHARACTER_CREATION_TALENT_COUNT

    if (selectedTalentIds.length > maxTalentPicks) {
      issues.push({
        path: 'player.selectedTalentIds',
        message: `vượt authored pick ceiling (${maxTalentPicks} = creation + realmIndex)`,
      })
    }

    let creationTalentCount = 0
    const seenTalentIds = new Set<string>()

    for (let i = 0; i < selectedTalentIds.length; i += 1) {
      const talentId = selectedTalentIds[i]

      if (typeof talentId !== 'string') {
        continue
      }

      // F-TALENT-DUP: every writer grants a talent id at most once -
      // a duplicated pool id dodges the count ceiling (one id, one
      // slot) while collectTalentEffects still double-applies its
      // effects at the consumer seam.
      if (seenTalentIds.has(talentId)) {
        issues.push({
          path: `player.selectedTalentIds[${i}]`,
          message: `talent '${talentId}' trùng lặp - writer không bao giờ grant 2 lần`,
        })
      } else {
        seenTalentIds.add(talentId)
      }

      if (CREATION_TALENT_IDS.has(talentId)) {
        creationTalentCount += 1
      }

      // F-TAL-1: parked talents carry weight 0 and are never rolled -
      // no writer can have granted one.
      if (PARKED_TALENT_IDS.has(talentId)) {
        issues.push({
          path: `player.selectedTalentIds[${i}]`,
          message: `talent '${talentId}' là parked (không writer nào grant)`,
        })
      }

      // F-TAL-1: Great Dao rewards mint only from the pham_cot
      // conversion at a hidden foundation breakthrough - the
      // highestFoundationAchieved record is the required witness.
      if (
        GREAT_DAO_REWARD_TALENT_IDS.has(talentId) &&
        player.highestFoundationAchieved !== 'great_dao'
      ) {
        issues.push({
          path: `player.selectedTalentIds[${i}]`,
          message: `talent '${talentId}' là Dai Dao reward nhưng thiếu great_dao witness`,
        })
      }

      if (talentRealmIndex < 0) {
        continue
      }

      const poolRealmId = TALENT_POOL_REALM_BY_ID.get(talentId)
      if (poolRealmId !== undefined && getRealmIndex(poolRealmId) > talentRealmIndex) {
        issues.push({
          path: `player.selectedTalentIds[${i}]`,
          message: `talent '${talentId}' thuộc pool '${poolRealmId}' - realm chưa đạt nên grant bất khả thi`,
        })
      }
    }

    // F-TAL-1: creation resolves exactly CHARACTER_CREATION_TALENT_COUNT
    // id - the Great Dao conversion replaces (never adds) a creation id.
    if (creationTalentCount > CHARACTER_CREATION_TALENT_COUNT) {
      issues.push({
        path: 'player.selectedTalentIds',
        message: `vượt creation pick count (${creationTalentCount} > ${CHARACTER_CREATION_TALENT_COUNT})`,
      })
    }
  }

  // M-F-TALENT (v76) - talentLevels is required (sparse level map; empty
  // object = every owned talent at level 1). Levels are positive
  // integers - a 0/NaN level reads as a corrupt upgrade result, fail
  // loud like nodeLevels.
  if (!isObject(player.talentLevels)) {
    issues.push({ path: 'player.talentLevels', message: 'phải là object' })
  } else if (Object.keys(player.talentLevels).length > ID_COLLECTION_CAP) {
    // r27-COR-3: the ownership pin rejects each unowned entry but the
    // walk itself was the one uncapped collection left - refuse on
    // count like every sibling map before iterating.
    issues.push({ path: 'player.talentLevels', message: `vượt ID_COLLECTION_CAP (${ID_COLLECTION_CAP})` })
  } else {
    for (const [talentId, level] of Object.entries(player.talentLevels)) {
      if (!isNonNegativeFiniteNumber(level) || !Number.isInteger(level) || level < 1) {
        issues.push({
          path: `player.talentLevels.${talentId}`,
          message: 'phải là số nguyên >= 1',
        })

        continue
      }

      // Levels above the authored range cannot be minted by the domain
      // (UPGRADE grants at most level+1 up to maxLevel) - treat as
      // corruption. Unknown ids stay tolerated like selectedTalentIds'
      // retired entries: consumers already skip them.
      const talent = getTalentDefinition(talentId)

      if (talent !== undefined && level > getTalentMaxLevel(talent)) {
        issues.push({
          path: `player.talentLevels.${talentId}`,
          message: 'vượt maxLevel của talent',
        })
      }

      // A level entry for a talent the save does NOT own is latent
      // corruption: NEW ownership grants level 1 by contract, so a
      // stored >1 for an unowned id can only arrive via a shaped save
      // and would bypass the level ladder on first grant. Fail loud.
      if (selectedTalentIds !== undefined && !selectedTalentIds.includes(talentId)) {
        issues.push({
          path: `player.talentLevels.${talentId}`,
          message: 'level của talent chưa sở hữu',
        })
      }
    }
  }

  // F-TC9-4: cultivationPerSecond is a derived snapshot - cultivateTick
  // rewrites it every tick from authored factors (BASE x claimed talent
  // speed x claimed talent ramp x tu linh tran <= +25%). A persisted
  // rate above what the save's own claims can produce is CLAMPED to
  // that ceiling at the normalize seam instead of failing the save:
  // the field is rewritten by the next tick regardless, so the clamp
  // can never lose legitimate state - and it rescues the legit wedge
  // (createDefaultPlayer persists the pre-tick BASE rate, so a
  // revision-1 save of a character holding a speed-shrinking talent
  // like pham_cot or ho_tich_bat_phat would otherwise stay 'corrupted'
  // until a tick-save could land) while still neutralizing a forged
  // high-cps payload before restore pays offlineSeconds x cps.
  if (
    isNonNegativeFiniteNumber(player.cultivationPerSecond) &&
    isNonNegativeFiniteNumber(player.realmLevel)
  ) {
    const cpsTalentIds = (selectedTalentIds ?? []).filter(
      (talentId): talentId is string => typeof talentId === 'string',
    )
    const cpsTalentLevels: Record<string, number> = {}

    // r28-COR-Nit: the root cap covers this sibling walk too - an
    // over-cap record is already refused, so do not pay the unbounded
    // entries iteration here either.
    if (
      isObject(player.talentLevels) &&
      Object.keys(player.talentLevels).length <= ID_COLLECTION_CAP
    ) {
      for (const [talentId, level] of Object.entries(player.talentLevels)) {
        if (isNonNegativeFiniteNumber(level)) {
          cpsTalentLevels[talentId] = level
        }
      }
    }

    // F-TC10-CPS: the +25% tu_linh_tran factor is only derivable while a
    // tu_linh_tran timed-effect record is live at save time - an
    // unconditional headroom lets a TLT-less save claim 25% extra
    // offline accrual magnitude.
    // r15-AUT-1: loosen by the record's OWN live percent, not the
    // authored max. The binary flag let a forged
    // expires=lastSavedAt+1ms + percent=1e-9 claim the whole 1.25x
    // bound - the record is live at windowStart (windowStart <=
    // lastSavedAt always), so the restore's un-buff division barely
    // shrinks the claim and the dead tail pays the loosened rate for
    // the whole window. Sampling the same domain read the restore
    // uses is honest-tight: an authored 0.25 buff still admits its
    // 1.25x snapshot, while every forged (percent, expires) pair now
    // divides back to BASE at payout (claim <= BASE x (1+p) ->
    // unbuffed = claim/(1+p) <= BASE).
    const persistedTimedEffects = player.persistentTimedEffects
    // r30-COR-Low-2: same cap gate - a refused over-cap array pays no
    // element walk in this sibling read either.
    const liveTltPercent =
      Array.isArray(persistedTimedEffects) &&
      persistedTimedEffects.length <= ID_COLLECTION_CAP &&
      isFiniteNumber(player.lastSavedAt)
        ? getActiveCultivationSpeedPercent(
            persistedTimedEffects
              .filter((effect): effect is Record<string, unknown> => isObject(effect))
              .map(
                (effect): PersistentTimedEffect => ({
                  id: '',
                  sourceItemId:
                    typeof effect.sourceItemId === 'string' ? effect.sourceItemId : '',
                  effectGroup:
                    typeof effect.effectGroup === 'string' ? effect.effectGroup : undefined,
                  appliedAtMs: 0,
                  expiresAtMs: isFiniteNumber(effect.expiresAtMs) ? effect.expiresAtMs : 0,
                  modifiers: [],
                  cultivationSpeedPercent: isFiniteNumber(effect.cultivationSpeedPercent)
                    ? effect.cultivationSpeedPercent
                    : undefined,
                }),
              ),
            player.lastSavedAt as number,
          )
        : 0

    const maxPersistedCps =
      BASE_CULTIVATION_PER_SECOND *
      getCultivationSpeedMultiplier(cpsTalentIds, cpsTalentLevels) *
      getCultivationRampMultiplier(cpsTalentIds, player.realmLevel, cpsTalentLevels) *
      (1 + liveTltPercent)

    if (player.cultivationPerSecond > maxPersistedCps + 1e-9) {
      normalization.cultivationPerSecond = maxPersistedCps
    }
  }

  // M-F-TALENT (v76) - pendingTalentEntitlement is optional; when
  // present it is the in-flight mandatory breakthrough decision record:
  // realmId (pool key) + bound offeredTalentIds. A malformed record must
  // fail loud - silently dropping it would strand the transition lock.
  if (player.pendingTalentEntitlement !== undefined) {
    if (!isObject(player.pendingTalentEntitlement)) {
      issues.push({ path: 'player.pendingTalentEntitlement', message: 'phải là object hoặc vắng mặt' })
    } else {
      const entitlement = player.pendingTalentEntitlement

      requireNonEmptyString(entitlement, 'realmId', 'player.pendingTalentEntitlement', issues)
      const offered = requireArray(entitlement, 'offeredTalentIds', 'player.pendingTalentEntitlement', issues)

      if (offered) {
        validateStringEntries(offered, 'player.pendingTalentEntitlement.offeredTalentIds', issues)
      }

      // Registry-drift rule (QA-2026-09-12-013): the record drives a
      // blocking uncancellable modal, so every catalog reference it
      // carries must resolve - an unresolvable offer or realm key would
      // silently strand the transition lock instead of failing loud.
      if (
        typeof entitlement.realmId === 'string' &&
        entitlement.realmId.length > 0 &&
        !REALMS.some((realm) => realm.id === entitlement.realmId)
      ) {
        issues.push({ path: 'player.pendingTalentEntitlement.realmId', message: 'realmId không thuộc danh mục REALMS' })
      }

      // The entitlement mints inside the realm transition it decides -
      // the only writer binds pool realmId to the realm the player just
      // entered, so a record naming any other realm is an impossible
      // claim (the modal cannot represent a decision for a realm the
      // player is not in).
      if (entitlement.realmId !== player.realmId) {
        issues.push({
          path: 'player.pendingTalentEntitlement.realmId',
          message: 'entitlement realmId không khớp realm hiện tại',
        })
      }

      // F-TC10-ENT: the pending record occupies the slot its own pick
      // has not yet consumed - resolved picks can total at most
      // realmIndex - 1 entries (the current realm's is still pending),
      // so a saturated talent list makes the pending claim impossible.
      {
        const entitlementRealmIndex =
          typeof player.realmId === 'string' ? getRealmIndex(player.realmId) : -1

        if (
          entitlementRealmIndex >= 0 &&
          Array.isArray(selectedTalentIds) &&
          selectedTalentIds.length > CHARACTER_CREATION_TALENT_COUNT + entitlementRealmIndex - 1
        ) {
          issues.push({
            path: 'player.pendingTalentEntitlement',
            message: 'entitlement pending trong khi pick ceiling đã resolve',
          })
        }
      }

      if (offered) {
        const seenOfferIds = new Set<unknown>()

        for (const [index, talentId] of offered.entries()) {
          if (typeof talentId === 'string' && getTalentDefinition(talentId) === undefined) {
            issues.push({
              path: `player.pendingTalentEntitlement.offeredTalentIds[${index}]`,
              message: 'talent id không thuộc catalog',
            })
          }

          // EVERY persisted offer must satisfy the same structural
          // legality as the live draw (isLegalBreakthroughOffer):
          // realm-pool member + weight > 0 + catalog-resolvable. A
          // foreign or zero-weight id would survive into the decision
          // UI as a dead card - fail loud, never let it render.
          if (
            typeof talentId === 'string' &&
            typeof entitlement.realmId === 'string' &&
            entitlement.realmId.length > 0 &&
            !isLegalBreakthroughOffer(entitlement.realmId, talentId)
          ) {
            issues.push({
              path: `player.pendingTalentEntitlement.offeredTalentIds[${index}]`,
              message: 'không phải offer hợp lệ của pool realm (ngoài pool hoặc weight 0)',
            })
          }

          // Duplicate offers grant the same talent twice (double-counted
          // effects) - the live draw is deduped, so a dup is corruption.
          if (seenOfferIds.has(talentId)) {
            issues.push({
              path: `player.pendingTalentEntitlement.offeredTalentIds[${index}]`,
              message: 'talent id trùng lặp',
            })
          }
          seenOfferIds.add(talentId)
        }
      }

      // Degenerate-record guard: a persisted entitlement that presents
      // ZERO legal decisions locks the transition forever behind an
      // uncancellable modal - offered cards all owned/unknown/outside
      // the realm pool, realm pool release-suppressed, and no legal
      // upgrade left. The live seam can never author this
      // (createTalentEntitlement returns undefined and resolution
      // enforces the same pool/policy authority), so it can only
      // arrive via corruption: fail loud. Sanitize-then-delegate: the
      // legality rule lives in the domain (isTalentEntitlementActionable);
      // the validator only bridges unknown -> typed shapes it has
      // already checked.
      if (
        typeof entitlement.realmId === 'string' &&
        entitlement.realmId.length > 0 &&
        offered !== undefined
      ) {
        const sanitizedOffers = offered.filter(
          (talentId): talentId is string => typeof talentId === 'string',
        )
        const sanitizedIds = (selectedTalentIds ?? []).filter(
          (talentId): talentId is string => typeof talentId === 'string',
        )
        const sanitizedLevels: Record<string, number> = {}

        // r28-COR-Nit: same cap guard as the root walk - refused
        // over-cap records do not pay sibling entry iterations.
        if (
          isObject(player.talentLevels) &&
          Object.keys(player.talentLevels).length <= ID_COLLECTION_CAP
        ) {
          for (const [talentId, level] of Object.entries(player.talentLevels)) {
            if (isNonNegativeFiniteNumber(level) && Number.isInteger(level)) {
              sanitizedLevels[talentId] = level
            }
          }
        }

        const actionable =
          sanitizedOffers.length === offered.length &&
          isTalentEntitlementActionable({
            selectedTalentIds: sanitizedIds,
            talentLevels: sanitizedLevels,
            pendingTalentEntitlement: {
              realmId: entitlement.realmId,
              offeredTalentIds: sanitizedOffers,
            },
          })

        if (!actionable) {
          issues.push({
            path: 'player.pendingTalentEntitlement',
            message: 'bản ghi không còn quyết định hợp lệ nào',
          })
        }
      }
    }
  }

  requireBoolean(player, 'hasSeenTutorial', 'player', issues)
  requireNonNegativeNumber(player, 'autoWorkerCapacity', 'player', issues)
  // F-R22-03: capacity feeds WorkerLaneAdvance slots, whose mechanism
  // guard pins 0..65536 - a larger persisted value re-trips the r21
  // per-site freeze the moment a scope-hidden feature consumes it.
  if (
    isNonNegativeFiniteNumber(player.autoWorkerCapacity) &&
    (player.autoWorkerCapacity as number) > 65_536
  ) {
    issues.push({
      path: 'player.autoWorkerCapacity',
      message: 'vượt trần slot cơ chế 65536',
    })
  }
  requireNonNegativeNumber(player, 'totalCultivationGained', 'player', issues)
  requireNonNegativeNumber(player, 'bossKillCount', 'player', issues)
  requireNonNegativeNumber(player, 'skillInsight', 'player', issues)
  requireNonNegativeNumber(player, 'totalSkillInsightGained', 'player', issues)
  requireNonNegativeNumber(player, 'cultivationInsightAccumulator', 'player', issues)

  // F-A11-3: every skillInsight mint bumps totalSkillInsightGained in
  // the same statement and spends only decrement skillInsight
  // (refunds repay already-minted insight), so insight can never
  // exceed the lifetime tally - a larger claim is a forged currency
  // grant.
  if (
    isNonNegativeFiniteNumber(player.skillInsight) &&
    isNonNegativeFiniteNumber(player.totalSkillInsightGained) &&
    (player.skillInsight as number) > (player.totalSkillInsightGained as number)
  ) {
    issues.push({
      path: 'player.skillInsight',
      message: 'skillInsight vượt totalSkillInsightGained (currency claim bất khả thi)',
    })
  }

  // F-A11-2: accrueCultivationInsight early-returns without an
  // insight_per_cultivation talent and its drain loop always exits
  // below threshold, so a persisted accumulator is only legal while
  // under the claimed talents' threshold - anything else is a
  // deferred skillInsight mint.
  const insightThreshold = getInsightPerCultivation(
    (selectedTalentIds ?? []).filter(
      (talentId): talentId is string => typeof talentId === 'string',
    ),
    isObject(player.talentLevels) ? (player.talentLevels as Record<string, number>) : undefined,
  )

  if (isNonNegativeFiniteNumber(player.cultivationInsightAccumulator)) {
    if (insightThreshold === undefined && (player.cultivationInsightAccumulator as number) > 0) {
      issues.push({
        path: 'player.cultivationInsightAccumulator',
        message: 'accumulator > 0 khi không có talent insight_per_cultivation',
      })
    } else if (
      insightThreshold !== undefined &&
      (player.cultivationInsightAccumulator as number) >= insightThreshold
    ) {
      issues.push({
        path: 'player.cultivationInsightAccumulator',
        message: 'accumulator đạt ngưỡng mint (drain loop luôn thoát dưới ngưỡng)',
      })
    }
  }
  requireNonNegativeNumber(player, 'attributePoints', 'player', issues)
  // F-TC6-6: 1 attribute point mints per tier climbed (levelUp +
  // breakthrough each grant exactly one), so unspent points can never
  // exceed the player's cumulative tier position.
  if (
    isNonNegativeFiniteNumber(player.attributePoints) &&
    typeof player.realmId === 'string' &&
    isNonNegativeFiniteNumber(player.realmLevel) &&
    player.attributePoints > getGlobalCultivationLevel(player.realmId, player.realmLevel)
  ) {
    issues.push({
      path: 'player.attributePoints',
      message: 'vượt số điểm có thể kiếm được ở vị trí cảnh giới hiện tại',
    })
  }

  // F-AP-DOUBLE-COUNT (deferred exception): unspent + spent cannot be
  // reconciled against the earnable ceiling because baseStats grow
  // through TWO unobservable-in-save channels - allocateAttributePoint
  // spend AND permanent_stat pills, which are unlimited-use craftable
  // consumables with no persisted consumption ledger. A saturated-stat
  // plus full-pool claim is indistinguishable from a pill-fed player
  // without an event ledger; recorded as human-accepted exception
  // (same class as forged totalExperience - online-authority defense).
  requireNonNegativeNumber(player, 'breakthroughGrade', 'player', issues)

  // F-TC8-1: computeBreakthroughGrade clamps the grade into [1,6]
  // (breakthroughGradeMinimum=1 .. 6), so a persisted grade above the
  // authored ceiling is an impossible claim that nhap_dao scales on.
  if (isFiniteNumber(player.breakthroughGrade) && (player.breakthroughGrade as number) > 6) {
    issues.push({
      path: 'player.breakthroughGrade',
      message: 'vượt authored grade ceiling (6)',
    })
  }

  // F-A12-2: the sole writer is clamp(completedTiers, 1, 6) at the
  // initiation ritual - completedTiers only ever grows afterward, so a
  // grade above max(1, tiers) is a fabricated magnitude replay. The
  // bound only applies post-initiation: at mortal the field is an
  // inert placeholder (spawn default 6) that no consumer reads until
  // the nhap_dao passive exists.
  if (
    typeof player.realmId === 'string' &&
    getRealmIndex(player.realmId) >= getRealmIndex('qi_refining') &&
    isFiniteNumber(player.breakthroughGrade) &&
    (player.breakthroughGrade as number) > Math.max(1, persistedBodyRefinementTiers(player))
  ) {
    issues.push({
      path: 'player.breakthroughGrade',
      message: 'vượt grade derivable từ completedTiers (writer clamp)',
    })
  }

  const purchasedNodeIds = requireArray(player, 'purchasedNodeIds', 'player', issues)

  if (purchasedNodeIds) {
    validateStringEntries(purchasedNodeIds, 'player.purchasedNodeIds', issues)

    // F-A11-6: purchasedNodeIds is a compat mirror of nodeLevels - the
    // purchase path and grantSkillCore write both, and every removal
    // seam (revokeNodeOwnership, respec clawback) drops both, so an
    // entry without level >= 1 is forged ownership that authorizes
    // specialization claims.
    if (isObject(player.nodeLevels)) {
      for (let i = 0; i < purchasedNodeIds.length; i += 1) {
        const nodeId = purchasedNodeIds[i]
        const level = player.nodeLevels[nodeId as string]

        if (
          typeof nodeId === 'string' &&
          (!isFiniteNumber(level) || (level as number) < 1)
        ) {
          issues.push({
            path: `player.purchasedNodeIds[${i}]`,
            message: `node '${nodeId}' không có nodeLevels >= 1 (ownership mirror bất khả thi)`,
          })
        }
      }
    }
  }

  const completedStageIds = requireArray(player, 'completedStageIds', 'player', issues)

  if (completedStageIds) {
    validateStringEntries(completedStageIds, 'player.completedStageIds', issues)
  }

  const perfectClearStageIds = requireArray(player, 'perfectClearStageIds', 'player', issues)

  if (perfectClearStageIds) {
    validateStringEntries(perfectClearStageIds, 'player.perfectClearStageIds', issues)
  }

  // F-A10-6/-8: stage-clear claims are realm-earnability claims too - a
  // stage's requiredRealmId gates entry, so a clear/autofarm record on
  // a stage above the player's realm is a fabricated claim. Stage
  // requiredRealmId resolves through the same monotonic realm order.
  const stageClaimRealmIndex =
    typeof player.realmId === 'string' ? getRealmIndex(player.realmId) : -1

  if (stageClaimRealmIndex >= 0) {
    for (const [field, entries] of [
      ['completedStageIds', completedStageIds],
      ['perfectClearStageIds', perfectClearStageIds],
    ] as const) {
      if (!entries) {
        continue
      }

      for (let i = 0; i < entries.length; i += 1) {
        const stageId = entries[i]

        if (typeof stageId !== 'string') {
          continue
        }

        const stage = STAGE_BY_ID.get(stageId)
        if (
          stage?.requiredRealmId !== undefined &&
          getRealmIndex(stage.requiredRealmId) > stageClaimRealmIndex
        ) {
          issues.push({
            path: `player.${field}[${i}]`,
            message: `stage '${stageId}' yêu cầu realm '${stage.requiredRealmId}' - realm chưa đạt nên clear bất khả thi`,
          })
        }
      }
    }
  }

  // F-TC9-2: stage-chain coherence - isStageUnlocked requires the
  // immediately preceding chain stage to be completed, so a clear claim
  // whose earlier floors are unclaimed is provably impossible; and a
  // perfect-clear is a same-tick co-write of completion, so every
  // perfect claim must also be a completed claim.
  if (completedStageIds) {
    const claimedStages = new Set(
      completedStageIds.filter((stageId): stageId is string => typeof stageId === 'string'),
    )

    for (const stageId of claimedStages) {
      const zone = zones.find((candidate) => candidate.stageIds.includes(stageId))

      if (!zone) {
        continue
      }

      const index = zone.stageIds.indexOf(stageId)

      if (index > 0 && !claimedStages.has(zone.stageIds[index - 1]!)) {
        issues.push({
          path: 'player.completedStageIds',
          message: `stage '${stageId}' thiếu clear trước '${zone.stageIds[index - 1]}' (skip-chain bất khả thi)`,
        })
      }
    }

    if (perfectClearStageIds) {
      for (let i = 0; i < perfectClearStageIds.length; i += 1) {
        const stageId = perfectClearStageIds[i]

        if (typeof stageId === 'string' && !claimedStages.has(stageId)) {
          issues.push({
            path: `player.perfectClearStageIds[${i}]`,
            message: `perfect claim '${stageId}' không nằm trong completedStageIds`,
          })
        }
      }
    }
  }

  const grantedRealmPassiveIds = requireArray(player, 'grantedRealmPassiveIds', 'player', issues)

  if (grantedRealmPassiveIds) {
    validateStringEntries(grantedRealmPassiveIds, 'player.grantedRealmPassiveIds', issues)

    // F-W-9 (v82): marker/payload two-slice authority - moi id da grant
    // phai resolve trong REALM_PASSIVES VA con it nhat mot modifier song
    // phat tu definition do; truong hop grantRealmPassive() chi push
    // marker sau khi da push modifiers nen marker-mo-coi la corrupt.
    for (let i = 0; i < grantedRealmPassiveIds.length; i += 1) {
      const grantedId = grantedRealmPassiveIds[i]

      if (typeof grantedId !== 'string') {
        continue
      }

      const definition = REALM_PASSIVES.find((passive) => passive.id === grantedId)

      if (!definition) {
        issues.push({
          path: `player.grantedRealmPassiveIds[${i}]`,
          message: 'realm passive không tồn tại trong registry',
        })
        continue
      }

      // F-TC8-2: marker realm-order eligibility - grantRealmPassive
      // only writes the marker on a realm advance INTO that realm, so
      // a marker indexed above the player's own realm is impossible.
      const markerRealmIndex = getRealmIndex(grantedId)
      const playerRealmIndex =
        typeof player.realmId === 'string' ? getRealmIndex(player.realmId) : -1
      if (markerRealmIndex > playerRealmIndex) {
        issues.push({
          path: `player.grantedRealmPassiveIds[${i}]`,
          message: 'marker của realm chưa đạt - grant bất khả thi',
        })
      }

      const hasLiveModifier =
        Array.isArray(playerModifiers) &&
        playerModifiers.some(
          (modifier) =>
            isObject(modifier) &&
            modifier.sourceType === 'realm' &&
            modifier.sourceId === definition.sourceId,
        )

      if (!hasLiveModifier) {
        issues.push({
          path: `player.grantedRealmPassiveIds[${i}]`,
          message: 'đã grant nhưng không có modifier sống nào từ passive này',
        })
      }
    }

    // F-BS3: payload -> marker direction - a realm-passive modifier
    // whose source passive was never granted is a forged carry-in, same
    // corruption class as the orphan marker above. Non-passive realm
    // sources (meridian/body chapters) own their own marker space and
    // stay outside this check.
    if (Array.isArray(playerModifiers)) {
      const grantedSourceIds = new Set(
        grantedRealmPassiveIds
          .filter((grantedId): grantedId is string => typeof grantedId === 'string')
          .map((grantedId) => REALM_PASSIVES.find((passive) => passive.id === grantedId)?.sourceId)
          .filter((sourceId): sourceId is string => typeof sourceId === 'string'),
      )

      for (let i = 0; i < playerModifiers.length; i += 1) {
        const modifier = playerModifiers[i]

        if (!isObject(modifier) || modifier.sourceType !== 'realm') {
          continue
        }

        const passive = REALM_PASSIVES.find((entry) => entry.sourceId === modifier.sourceId)
        if (passive === undefined) {
          continue
        }

        if (!grantedSourceIds.has(modifier.sourceId as string)) {
          issues.push({
            path: `player.modifiers[${i}]`,
            message: `modifier phát từ realm passive chưa được grant (${String(modifier.sourceId)})`,
          })
          continue
        }

        // F-MOD-1: the marker only proves the passive was granted - the
        // entry itself must byte-match an authored emission for this
        // player (variant selected by the same hidden-lineage rule the
        // grant seam uses). A free-magnitude or free-stat claim is
        // fabricated.
        const expected = authoredRealmPassiveEntries(passive, player as unknown as PlayerData)

        if (
          !expected.some(
            (authored) =>
              authored.id === modifier.id &&
              authored.stat === modifier.stat &&
              authored.percent === modifier.percent &&
              authored.flat === modifier.flat &&
              authored.domain === modifier.domain,
          )
        ) {
          issues.push({
            path: `player.modifiers[${i}]`,
            message: `realm-passive modifier ngoài envelope authored (${String(modifier.id)})`,
          })
        }
      }
    }

    // F-A7-1: claimed-source coherence. On a current-version save the
    // persisted writers are enumerable - realm passives (marker-checked
    // above), the meridian chapter rebuild, the loi kiep outcome grant
    // ('talent' + 'loi_kiep'), and the equipment slice that restore
    // rebuilds from equipped items. Any other claimed source is a
    // fabricated entry, the same provable-forgery class as the
    // ungranted passive payload.
    const claimedModifiers = Array.isArray(playerModifiers) ? playerModifiers : []

    // QA-FS-1/2b: every persisted writer emits at most one entry per
    // modifier id (realm-passive template, bat-mach:<m>:<stat>,
    // talent_loi_kiep_<stat>) - and the mint seams emit once per
    // persisted entry (authored rebuild or verbatim push), so a
    // duplicated id mints N x the authored package. Equipment entries
    // are rebuilt at restore and stay outside this check.
    const seenClaimedIds = new Set<string>()

    for (let i = 0; i < claimedModifiers.length; i += 1) {
      const modifier = claimedModifiers[i]

      if (!isObject(modifier) || modifier.sourceType === 'equipment') {
        continue
      }

      if (typeof modifier.id === 'string') {
        if (seenClaimedIds.has(modifier.id)) {
          issues.push({
            path: `player.modifiers[${i}]`,
            message: `modifier id trùng lặp (writer upsert - không sản xuất được: ${modifier.id})`,
          })
        } else {
          seenClaimedIds.add(modifier.id)
        }
      }

      if (modifier.sourceType === 'realm') {
        const passiveSource = REALM_PASSIVES.some(
          (entry) => entry.sourceId === modifier.sourceId,
        )
        const meridianSource = MERIDIANS.find(
          (entry) => entry.id === modifier.sourceId,
        )

        if (!passiveSource && meridianSource === undefined) {
          issues.push({
            path: `player.modifiers[${i}]`,
            message: `realm-source modifier không có writer nào (${String(modifier.sourceId)})`,
          })
        }

        // F-TC6-9: the meridian writer emits exactly
        // 'bat-mach:<meridian>:<stat>' entries at the authored
        // percentAtFullTier - a claim in another id shape, another
        // stat, or another magnitude is forged and would emit live
        // once bodyPath unlocks (the bat-mach: strip never sees it).
        if (meridianSource !== undefined) {
          if (
            modifier.id !== `bat-mach:${meridianSource.id}:${String(modifier.stat)}` ||
            !meridianSource.stats.some((stat) => stat === modifier.stat) ||
            modifier.percent !== meridianSource.percentAtFullTier
          ) {
            issues.push({
              path: `player.modifiers[${i}]`,
              message: `meridian modifier ngoài shape writer bat-mach (${String(modifier.id)})`,
            })
          }
        }

        continue
      }

      if (modifier.sourceType === 'talent' && modifier.sourceId === 'loi_kiep') {
        // F-TC6-1: the loi kiep grant has an ownership witness (the
        // talent itself) and a closed writer shape - id
        // 'talent_loi_kiep_<stat>' on the five main attributes, percent
        // accumulation only (a victory grants +0.1 per major realm
        // transition), never flat.
        const mainStat = LOI_KIEP_MAIN_STATS.find(
          (stat) => modifier.stat === stat && modifier.id === `talent_loi_kiep_${stat}`,
        )
        if (
          !(selectedTalentIds ?? []).includes('loi_kiep') ||
          mainStat === undefined ||
          !isFiniteNumber(modifier.percent) ||
          (modifier.percent as number) < 0 ||
          // F-TC8-3: the victory grant writes exactly +0.1 per realm
          // transition, so the authored bound scales with the player's
          // own realm index - the old all-realm bound only excluded a
          // claim no in-scope writer can mint anyway.
          (modifier.percent as number) >
            0.1 *
              Math.max(
                0,
                typeof player.realmId === 'string' ? getRealmIndex(player.realmId) : 0,
              ) +
              1e-9 ||
          modifier.flat !== undefined ||
          // QA-FS-2a: the writer emits exactly
          // {id, sourceId, sourceType, stat, percent} and the emit
          // seam pushes the persisted object verbatim - every other
          // StatModifier field reaches runPipeline unchecked
          // (multiplier^stacks More product, tag Increased tier).
          modifier.multiplier !== undefined ||
          modifier.stacks !== undefined ||
          modifier.maxStacks !== undefined ||
          modifier.perLevelFlat !== undefined ||
          modifier.perLevelPercent !== undefined ||
          modifier.tag !== undefined ||
          modifier.domain !== undefined
        ) {
          issues.push({
            path: `player.modifiers[${i}]`,
            message: 'loi kiep modifier ngoài shape writer/talent chưa sở hữu',
          })
        }

        continue
      }

      issues.push({
        path: `player.modifiers[${i}]`,
        message: `modifier claim nguồn không thuộc writer đã biết (${String(
          modifier.sourceType,
        )}:${String(modifier.sourceId)})`,
      })
    }
  }

  // persistentTimedEffects - expiresAtMs is the absolute authority
  // (see PersistentTimedEffect.ts): a NaN deadline never expires.
  const timedEffects = requireArray(player, 'persistentTimedEffects', 'player', issues)

  if (timedEffects) {
    // F-A7-2: claimed-source coherence for timed effects - the writers
    // are activateTuLinhTran (sourceItemId 'tu_linh_tran') and pill regen
    // consumption (sourceItemId = authored pill id). A claim that
    // resolves to neither is fabricated, and per-source surface bounds
    // mirror exactly what each writer can mint.
    const seenEffectGroups = new Set<string>()

    for (let i = 0; i < timedEffects.length; i += 1) {
      const effect = timedEffects[i]
      const effectPath = `player.persistentTimedEffects[${i}]`

      if (!isObject(effect)) {
        issues.push({ path: effectPath, message: 'phải là object' })
        continue
      }

      requireNonEmptyString(effect, 'id', effectPath, issues)
      requireNonEmptyString(effect, 'sourceItemId', effectPath, issues)

      if (!isBoundedTimestamp(effect.appliedAtMs)) {
        issues.push({ path: `${effectPath}.appliedAtMs`, message: 'phải là timestamp trong miền |x| < 2^52' })
      }
      if (!isBoundedTimestamp(effect.expiresAtMs)) {
        issues.push({ path: `${effectPath}.expiresAtMs`, message: 'phải là timestamp trong miền |x| < 2^52' })
      }

      // F-TC9-1: every writer stamps appliedAtMs=now before the save's
      // lastSavedAt - an activation after the save timestamp is
      // provably impossible, and liveness keys on expiresAtMs alone so
      // a future-dated window mints a live buff without any coherence
      // check.
      if (
        isFiniteNumber(effect.appliedAtMs) &&
        isFiniteNumber(player.lastSavedAt) &&
        (effect.appliedAtMs as number) > (player.lastSavedAt as number)
      ) {
        issues.push({
          path: `${effectPath}.appliedAtMs`,
          message: 'appliedAtMs vượt lastSavedAt (activation sau thời điểm save là bất khả thi)',
        })
      }

      const effectModifiers = requireArray(effect, 'modifiers', effectPath, issues)

      if (effectModifiers) {
        validateStatModifierEntries(effectModifiers, `${effectPath}.modifiers`, issues)
      }

      // r15-AUT-3: the writers only ever emit a boolean here (or omit
      // it) - a non-boolean claim is crafted shape even though the
      // stackable comparisons below already fail it closed.
      if (effect.durationStackable !== undefined && typeof effect.durationStackable !== 'boolean') {
        issues.push({
          path: `${effectPath}.durationStackable`,
          message: 'phải là boolean khi khai báo',
        })
      }

      if (typeof effect.effectGroup === 'string' && effect.effectGroup.length > 0) {
        if (seenEffectGroups.has(effect.effectGroup)) {
          // applyTimedEffect merges same-group entries into one record -
          // two persisted entries sharing a group cannot be authored.
          issues.push({
            path: `${effectPath}.effectGroup`,
            message: `effectGroup trùng lặp (${effect.effectGroup})`,
          })
        }
        seenEffectGroups.add(effect.effectGroup)
      }

      if (typeof effect.sourceItemId === 'string' && effect.sourceItemId.length > 0) {
        if (effect.sourceItemId === 'tu_linh_tran') {
          if (
            effect.effectGroup !== TU_LINH_TRAN_EFFECT_GROUP ||
            (effectModifiers !== undefined && effectModifiers.length > 0) ||
            effect.durationStackable === true ||
            !isFiniteNumber(effect.cultivationSpeedPercent) ||
            (effect.cultivationSpeedPercent as number) <= 0 ||
            (effect.cultivationSpeedPercent as number) > TU_LINH_TRAN_BUFF_PERCENT ||
            (isFiniteNumber(effect.appliedAtMs) &&
              isFiniteNumber(effect.expiresAtMs) &&
              // r13-COR-1: the span check this replaced was WRONG -
              // applyTimedEffect keeps appliedAtMs at the FIRST
              // application and max-extends expiresAtMs on rebuy, so an
              // honest repeat purchase legitimately produces a span
              // beyond TU_LINH_TRAN_DURATION_MS (and a forever-chain is
              // unbounded). The only impossible honest order is
              // expires BEFORE applied. Forward-honesty bounds live at
              // the restore seam (boundTimedEffectClocks), not in the
              // shape gate.
              (effect.expiresAtMs as number) < (effect.appliedAtMs as number)) ||
            (isFiniteNumber(effect.expiresAtMs) &&
              isFiniteNumber(player.lastSavedAt) &&
              // r14-AUT-2/3: expires - appliedAt is honestly unbounded
              // over rebuys, but expires - lastSavedAt is NOT: every
              // extension is appTime + TU_LINH_TRAN_DURATION_MS with
              // appTime <= lastSavedAt, so a deadline past
              // lastSavedAt + duration is impossible provenance (and a
              // forged one would also loosen the cps cap via the live-
              // TLT check above and revive at restore).
              // r15-COR-D: +7d provenance allowance - that bound only
              // holds inside ONE clock epoch; a rebuy stamped under a
              // fast-clock stretch whose skew then rolls back before
              // the save legitimately exceeds it (appliedAt stays at
              // the first apply, so F-TC9-1 stays silent). The
              // allowance rescues that honest shape; anything it
              // admits is still clamped to <=24h live at the restore
              // seam, so it buys a forge nothing.
              (effect.expiresAtMs as number) >
                (player.lastSavedAt as number) +
                  TU_LINH_TRAN_DURATION_MS +
                  7 * 86_400_000)
          ) {
            issues.push({
              path: effectPath,
              message: 'tu_linh_tran effect vượt biên writer',
            })
          }
        } else {
          // F-A8-1: the pill writer is regen consumption only - a pill
          // without a 'regen' effect (cultivation/permanent/material)
          // never mints a timed effect, and a regen claim must match
          // the authored effect's own shape.
          // F-TC6-8: a dormant-family pill (hoi_xuan_dan etc.) is a
          // scope-hidden artifact - its claim is rejected outright
          // even when the authored regen shape matches.
          const claimedPill = pills.find((pill) => pill.id === effect.sourceItemId)
          const regenEffect = claimedPill?.effects.find(
            (pillEffect) => pillEffect.type === 'regen',
          )

          if (scopeHiddenPillFamilyOfId(effect.sourceItemId) !== null) {
            issues.push({
              path: `${effectPath}.sourceItemId`,
              message: `timed effect claim nguồn thuộc family dormant (${String(effect.sourceItemId)})`,
            })
          } else if (claimedPill !== undefined && regenEffect !== undefined) {
            // F-A10-r15 (r15-AUT-2): the claimed source pill's realm is
            // an earnability claim - the consume writer only mints this
            // effect while the player is IN the pill's exact realm, and
            // realms are monotonic, so a save below the pill's realm is
            // impossible provenance (a mortal save was claiming the
            // tribulation-tier regen flat bound).
            const pillSourceRealmIndex =
              claimedPill.realmId !== undefined ? getRealmIndex(claimedPill.realmId) : -1
            const saveRealmIndex =
              typeof player.realmId === 'string' ? getRealmIndex(player.realmId) : -1
            if (
              pillSourceRealmIndex >= 0 &&
              saveRealmIndex >= 0 &&
              pillSourceRealmIndex > saveRealmIndex
            ) {
              issues.push({
                path: `${effectPath}.sourceItemId`,
                message: `pill regen nguồn '${String(effect.sourceItemId)}' thuộc realm '${String(claimedPill.realmId)}' cao hơn realm của save`,
              })
            }
            if (effect.cultivationSpeedPercent !== undefined) {
              issues.push({
                path: `${effectPath}.cultivationSpeedPercent`,
                message: 'pill effect không thể ghi cultivationSpeedPercent',
              })
            }
            // The writer always emits effectGroup and durationStackable;
            // expiresAtMs-appliedAtMs is NOT bound at admission - the
            // stackable refresh legitimately widens it (unbounded over
            // drinks). The forward bound lives at the restore seam
            // instead (r22-AUT-1: boundTimedEffectClocks clamps stackable
            // expiry to provenance + 24h like every sibling class - a
            // far-future parked expiry mints liveness, so admission
            // can't leave it verbatim).
            const expectedGroup = regenEffect.effectGroup ?? 'pill_regen'
            if (effect.effectGroup !== expectedGroup) {
              issues.push({
                path: `${effectPath}.effectGroup`,
                message: `pill regen effectGroup phải là ${expectedGroup}`,
              })
            }
            if (effect.durationStackable !== (regenEffect.stackable ?? false)) {
              issues.push({
                path: `${effectPath}.durationStackable`,
                message: 'pill regen durationStackable khác authored',
              })
            }
            if (effectModifiers !== undefined) {
              // The writer emits exactly one manaRegenPerTurn modifier
              // with flat = mpPerSecond x potency; alchemy_double_pill
              // authors the potency ceiling (1.5).
              const maxFlat = (regenEffect.mpPerSecond ?? 0) * 1.5
              if (effectModifiers.length > 1) {
                issues.push({
                  path: `${effectPath}.modifiers`,
                  message: 'pill regen chỉ emit đúng một modifier',
                })
              }
              for (let j = 0; j < effectModifiers.length; j += 1) {
                const modifier = effectModifiers[j]
                if (isObject(modifier) && modifier.stat !== 'manaRegenPerTurn') {
                  issues.push({
                    path: `${effectPath}.modifiers[${j}]`,
                    message: `pill regen chỉ emit manaRegenPerTurn (${String(modifier.stat)})`,
                  })
                }
                if (
                  isObject(modifier) &&
                  (!isFiniteNumber(modifier.flat) ||
                    (modifier.flat as number) < 0 ||
                    (modifier.flat as number) > maxFlat)
                ) {
                  issues.push({
                    path: `${effectPath}.modifiers[${j}].flat`,
                    message: `pill regen flat vượt authored bound (${maxFlat})`,
                  })
                }
                // The writer emits exactly one flat modifier - a
                // percent/multiplier field is an impossible claim.
                // QA-FS-3: same for every other StatModifier field -
                // the timed-modifier seam flatMaps the persisted
                // entries verbatim into the live pipeline, so a
                // forged stacks/multiplier/tag mints flat*stacks
                // past the authored bound, and a foreign domain
                // claims a gated channel the writer never emits.
                if (
                  isObject(modifier) &&
                  ((isFiniteNumber(modifier.percent) && (modifier.percent as number) !== 0) ||
                    (isFiniteNumber(modifier.multiplier) &&
                      (modifier.multiplier as number) !== 1) ||
                    modifier.stacks !== undefined ||
                    modifier.maxStacks !== undefined ||
                    modifier.perLevelFlat !== undefined ||
                    modifier.perLevelPercent !== undefined ||
                    modifier.tag !== undefined ||
                    (modifier.domain !== undefined && modifier.domain !== 'spell'))
                ) {
                  issues.push({
                    path: `${effectPath}.modifiers[${j}]`,
                    message: 'pill regen chỉ emit flat+domain:spell - field phụ không authored',
                  })
                }
              }
            }
          } else {
            issues.push({
              path: `${effectPath}.sourceItemId`,
              message: `timed effect claim nguồn không resolve (${String(effect.sourceItemId)})`,
            })
          }
        }
      }
    }
  }

  if (
    player.highestFoundationAchieved !== undefined &&
    (typeof player.highestFoundationAchieved !== 'string' ||
      !Object.prototype.hasOwnProperty.call(FOUNDATION_LABELS, player.highestFoundationAchieved))
  ) {
    issues.push({
      path: 'player.highestFoundationAchieved',
      message: 'phải là FoundationType hợp lệ hoặc vắng mặt',
    })
  } else if (
    // F-TC8-2b: highestFoundationAchieved is a free enum with no realm
    // coherence - it is written only at the foundation_establishment
    // breakthrough, so a record on a lower realm is impossible.
    player.highestFoundationAchieved !== undefined &&
    getRealmIndex(typeof player.realmId === 'string' ? player.realmId : '') <
      getRealmIndex('foundation_establishment')
  ) {
    issues.push({
      path: 'player.highestFoundationAchieved',
      message: 'khai foundation nhưng realm chưa đạt foundation_establishment',
    })
  }

  // F-A12-1: the grade itself is an earnability claim - its only writer
  // resolves against monotonic body records (completedTiers, opened
  // meridians), so a grade above what those inputs can produce is a
  // fabricated claim minting the kien_co main-stat multiplier.
  if (
    typeof player.highestFoundationAchieved === 'string' &&
    Object.prototype.hasOwnProperty.call(FOUNDATION_LABELS, player.highestFoundationAchieved)
  ) {
    if (player.highestFoundationAchieved === 'great_dao') {
      // Dai Dao is the hidden foundation entry - the persisted
      // hiddenBreakthroughRealmIds marker is the required witness.
      const hiddenIds =
        isObject(player.hiddenPerfection) && Array.isArray(player.hiddenPerfection.hiddenBreakthroughRealmIds)
          ? (player.hiddenPerfection.hiddenBreakthroughRealmIds as unknown[])
          : []

      if (!hiddenIds.includes('foundation_establishment')) {
        issues.push({
          path: 'player.highestFoundationAchieved',
          message: "'great_dao' thiếu hidden foundation witness (hiddenBreakthroughRealmIds)",
        })
      }
    } else if (
      (FOUNDATION_CLAIM_RANK[player.highestFoundationAchieved] ?? 0) >
      persistedResolvableFoundationRank(player)
    ) {
      issues.push({
        path: 'player.highestFoundationAchieved',
        message: `grade '${String(player.highestFoundationAchieved)}' vượt điều kiện derivable từ body records`,
      })
    }
  }

  // r26-COR-2: the witness array itself had no count bound - cap it
  // like every other id collection (id validity stays restore-side).
  if (
    isObject(player.hiddenPerfection)
    && Array.isArray(player.hiddenPerfection.hiddenBreakthroughRealmIds)
    && player.hiddenPerfection.hiddenBreakthroughRealmIds.length > ID_COLLECTION_CAP
  ) {
    issues.push({
      path: 'player.hiddenPerfection.hiddenBreakthroughRealmIds',
      message: `vượt ID_COLLECTION_CAP (${ID_COLLECTION_CAP})`,
    })
  }

  if (!COMBAT_AI_STRATEGIES.some((strategy) => strategy === player.combatAiStrategy)) {
    issues.push({ path: 'player.combatAiStrategy', message: 'phải thuộc COMBAT_AI_STRATEGIES' })
  }

  // M-QI-05 (v73) - the retired dual authority must not persist: any
  // surviving skillLevels key means the save predates the canonical
  // Core Node model and is rejected (no migration, no translator).
  if (Object.prototype.hasOwnProperty.call(player, 'skillLevels')) {
    issues.push({
      path: 'player.skillLevels',
      message: 'field đã retire (v73 — canonical level lives in nodeLevels[core_<id>])',
    })
  }

  // skillCastCounts is an optional record - NaN/negative
  // values leak into cast gates the same way nodeLevels did.
  for (const recordKey of ['skillCastCounts'] as const) {
    const record = player[recordKey]

    if (record === undefined) {
      continue
    }

    if (!isObject(record)) {
      issues.push({ path: `player.${recordKey}`, message: 'phải là object hoặc vắng mặt' })
      continue
    }

    if (Object.keys(record).length > ID_COLLECTION_CAP) {
      issues.push({ path: `player.${recordKey}`, message: `vượt ID_COLLECTION_CAP (${ID_COLLECTION_CAP})` })
      continue
    }

    for (const [skillId, value] of Object.entries(record)) {
      if (!isNonNegativeFiniteNumber(value)) {
        issues.push({
          path: `player.${recordKey}.${skillId}`,
          message: 'phải là số hữu hạn >= 0',
        })
      }
    }
  }

  // P7-M6 - techniqueProgress is an optional derived mirror of the
  // canonical technique holder ({rank, grade}). Shape is type-checked;
  // consistency vs techniques[] is deliberately NOT enforced here - the
  // holder republishes the mirror through TechniqueSystem.restore.
  if (player.techniqueProgress !== undefined) {
    const progress = player.techniqueProgress

    if (!isObject(progress)) {
      issues.push({ path: 'player.techniqueProgress', message: 'phải là object hoặc vắng mặt' })
    } else {
      for (const key of ['rank', 'grade'] as const) {
        const value = (progress as Record<string, unknown>)[key]

        if (!isNonNegativeFiniteNumber(value) || !Number.isInteger(value)) {
          issues.push({
            path: `player.techniqueProgress.${key}`,
            message: 'phải là số nguyên >= 0',
          })
        }
      }
    }
  }

  // artifact optional (ArtifactProgress) - a malformed grade/experience
  // makes ArtifactPanel index ARTIFACT_GRADE_ORDER -> -1 / NaN exp bar.
  if (player.artifact !== undefined) {
    if (!isObject(player.artifact)) {
      issues.push({ path: 'player.artifact', message: 'phải là object hoặc vắng mặt' })
    } else {
      requireNonEmptyString(player.artifact, 'artifactId', 'player.artifact', issues)
      requireNonEmptyString(player.artifact, 'realmId', 'player.artifact', issues)

      if (!isFiniteNumber(player.artifact.realmLevel) || player.artifact.realmLevel < 1) {
        issues.push({ path: 'player.artifact.realmLevel', message: 'phải là số hữu hạn >= 1' })
      }

      requireNonNegativeNumber(player.artifact, 'experience', 'player.artifact', issues)

      if (!isArtifactGrade(player.artifact.grade)) {
        issues.push({ path: 'player.artifact.grade', message: 'phải là ArtifactGrade hợp lệ' })
      }

      if (
        player.artifact.selectedPath !== undefined &&
        !isArtifactPath(player.artifact.selectedPath)
      ) {
        issues.push({
          path: 'player.artifact.selectedPath',
          message: 'phải là ArtifactPath hoặc vắng mặt',
        })
      }

      // F-ARTIFACT-SUBGATE: the awaken seam is the only writer and it
      // opens at ARTIFACT_UNLOCK_REALM_ID; realm order is monotonic, so
      // a persisted record under the unlock realm is unproducible. The
      // bound keys on realm order rather than isArtifactDomainUnlocked
      // because the domain is scope-hidden in beta - a carried record
      // must still load once the realm claim reaches the unlock tier.
      const artifactHolderRealmIndex =
        typeof player.realmId === 'string' ? getRealmIndex(player.realmId) : -1

      if (
        artifactHolderRealmIndex >= 0 &&
        artifactHolderRealmIndex < getRealmIndex(ARTIFACT_UNLOCK_REALM_ID)
      ) {
        issues.push({
          path: 'player.artifact',
          message: `realm chưa đạt '${ARTIFACT_UNLOCK_REALM_ID}' - artifact bất khả thi`,
        })
      }

      // The awaken grant resolves the artifact the active way entitles
      // (resolveExpectedArtifactId): a record whose artifactId does not
      // match the claimed way's grant - or a way granting none - could
      // not be produced by that seam.
      if (
        typeof player.artifact.artifactId === 'string' &&
        player.artifact.artifactId.trim().length > 0
      ) {
        const expectedArtifactId =
          typeof player.cultivationPath === 'string' &&
          player.cultivationPath in CULTIVATION_PATH_MODULES &&
          typeof player.cultivationWay === 'string'
            ? resolveExpectedArtifactId({
                cultivationPath: player.cultivationPath as CultivationPathId,
                cultivationWay: player.cultivationWay as CultivationWayId,
              })
            : undefined

        if (player.artifact.artifactId !== expectedArtifactId) {
          issues.push({
            path: 'player.artifact.artifactId',
            message: 'không khớp artifact mà cultivation way hiện tại entitle',
          })
        }
      }
    }
  }

  // nodeLevels - field tung gay crash boot v47 (SaveSystem.ts comment v47).
  if (!isObject(player.nodeLevels)) {
    issues.push({ path: 'player.nodeLevels', message: 'phải là object' })
  } else if (Object.keys(player.nodeLevels).length > ID_COLLECTION_CAP) {
    issues.push({ path: 'player.nodeLevels', message: `vượt ID_COLLECTION_CAP (${ID_COLLECTION_CAP})` })
  } else {
    for (const [nodeId, level] of Object.entries(player.nodeLevels)) {
      if (!isNonNegativeFiniteNumber(level)) {
        issues.push({
          path: `player.nodeLevels.${nodeId}`,
          message: 'phải là số hữu hạn >= 0',
        })
        continue
      }

      // M-QI-05 (v73) - core_<skillId> entries are stricter: registered
      // catalog member, integer level inside [1, maxLevel], and present
      // in the purchasedNodeIds mirror (grant = ownership).
      if (nodeId.startsWith('core_')) {
        const core = SKILL_CORE_BY_ID.get(nodeId)

        if (core === undefined) {
          issues.push({
            path: `player.nodeLevels.${nodeId}`,
            message: 'core node không tồn tại trong catalog đã đăng ký',
          })
          continue
        }

        if (!Number.isInteger(level) || level < 1 || level > (core.maxLevel ?? 1)) {
          issues.push({
            path: `player.nodeLevels.${nodeId}`,
            message: `phải là số nguyên trong [1, ${core.maxLevel ?? 1}]`,
          })
        }

        if (purchasedNodeIds && !purchasedNodeIds.includes(nodeId)) {
          issues.push({
            path: `player.nodeLevels.${nodeId}`,
            message: 'core node đã grant phải nằm trong purchasedNodeIds',
          })
        }
      } else {
        // F-TT-CLNB-INT (clean-B INT) -- non-core progression nodes get
        // the same canonicality replay as core_* and talents. The
        // buy-side gates are MONOTONIC invariants (respec only ever
        // removes levels, devResetBranch cascade-revokes orphans), so an
        // owned level that still violates them at load time is only
        // reachable via a crafted save:
        //   - integer level inside [0, maxLevel]
        //   - kind 'node': the parent node must still be owned
        //   - kind 'excludesNode': the mutex peer must be unowned
        //   - kind 'realm': player realm must still meet the gate
        //   - kind 'nodeCount': enough member nodes still owned
        // Laggy gates are deliberately NOT replayed (NodeSystem
        // :122-123 -- owned levels above a live gate are legal frozen
        // surplus): techniqueRank, techniqueGrade, skillCastCount,
        // kiemDaoBelowCap.
        const node = PROGRESSION_NODE_BY_ID.get(nodeId)

        if (node === undefined) {
          continue
        }

        if (!Number.isInteger(level) || level > (node.maxLevel ?? 1)) {
          issues.push({
            path: `player.nodeLevels.${nodeId}`,
            message: `phải là số nguyên trong [0, ${node.maxLevel ?? 1}]`,
          })
          continue
        }

        if (level >= 1) {
          const nodeLevelsRecord = player.nodeLevels as Record<string, unknown>

          // rewardOnly nodes are grant-owned (realm rewards write
          // nodeLevels only, no purchase path exists) - the
          // purchasedNodeIds mirror cannot express them.
          if (
            node.rewardOnly !== true &&
            purchasedNodeIds &&
            !purchasedNodeIds.includes(nodeId)
          ) {
            issues.push({
              path: `player.nodeLevels.${nodeId}`,
              message: 'node đã mua phải nằm trong purchasedNodeIds',
            })
          }

          // F-A19-1: an owned element root is producible only on the
          // post-initiation element commit - any other value (incl. null
          // before the ritual) leaves a permanently bricked initiation
          // the excludesNode replay cannot see. getActiveElement is the
          // canonical element read: it resolves only on the element-axis
          // way's committed pair, so a hostile/missing slice fails closed.
          const rootElement = ELEMENT_BY_ROOT_ID.get(nodeId)
          if (rootElement !== undefined) {
            const committedElement = getActiveElement(player as unknown as PlayerData)
            if (committedElement !== rootElement) {
              issues.push({
                path: `player.nodeLevels.${nodeId}`,
                message: `element root '${nodeId}' chỉ sản sinh được khi spellPath.element = '${rootElement}'`,
              })
            }
          }

          for (const prereq of node.prerequisites ?? []) {
            if (prereq.kind === 'node') {
              const parentLevel = nodeLevelsRecord[prereq.nodeId]

              if (typeof parentLevel !== 'number' || parentLevel < 1) {
                issues.push({
                  path: `player.nodeLevels.${nodeId}`,
                  message: `thiếu node tiền điều kiện '${prereq.nodeId}'`,
                })
              }
            } else if (prereq.kind === 'excludesNode') {
              const mutexLevel = nodeLevelsRecord[prereq.nodeId]

              if (typeof mutexLevel === 'number' && mutexLevel > 0) {
                issues.push({
                  path: `player.nodeLevels.${nodeId}`,
                  message: `xung đột loại trừ với node '${prereq.nodeId}' đang sở hữu`,
                })
              }
            } else if (prereq.kind === 'nodeCount') {
              const ownedCount = prereq.nodeIds.filter(
                (memberId) =>
                  typeof nodeLevelsRecord[memberId] === 'number' &&
                  (nodeLevelsRecord[memberId] as number) >= 1,
              ).length

              if (ownedCount < prereq.countRequired) {
                issues.push({
                  path: `player.nodeLevels.${nodeId}`,
                  message: `thiếu điều kiện nodeCount: cần ${prereq.countRequired}/${prereq.nodeIds.length} node, có ${ownedCount}`,
                })
              }
            } else if (prereq.kind === 'realm') {
              const requiredIndex = getRealmIndex(prereq.realmId)
              const playerRealmIndex =
                typeof player.realmId === 'string' ? getRealmIndex(player.realmId) : -1

              if (requiredIndex >= 0 && playerRealmIndex < requiredIndex) {
                issues.push({
                  path: `player.nodeLevels.${nodeId}`,
                  message: `thiếu cảnh giới tiền điều kiện '${prereq.realmId}'`,
                })
              }
            }
          }
        }
      }
    }
  }

  // Cultivation Path Framework (v66) - cultivationPath must be one of
  // the 3 BASE ids (the CULTIVATION_PATH_MODULES keys). M7 removed the
  // legacy _an ids from the union, so a save carrying one fails this
  // enum check and is rejected - dev-phase policy, no migration.
  // cultivationWay is an optional CultivationWayId content string - shape-check
  // the type only; catalog membership belongs to the path authority,
  // not the save boundary.
  if (
    player.cultivationPath !== undefined &&
    (typeof player.cultivationPath !== 'string' ||
      !Object.prototype.hasOwnProperty.call(CULTIVATION_PATH_MODULES, player.cultivationPath))
  ) {
    issues.push({
      path: 'player.cultivationPath',
      message: 'phải là 1 trong 3 cultivation path id hợp lệ hoặc vắng mặt',
    })
  }

  if (player.cultivationWay !== undefined && typeof player.cultivationWay !== 'string') {
    issues.push({ path: 'player.cultivationWay', message: 'phải là string hoặc vắng mặt' })
  }

  // Pair coherence (review cycle, I1) - applyPathChoice writes the
  // (path, way) pair + path slice atomically and the ritual advances
  // realmId in the same commit, so the save boundary rejects every
  // incoherent shape instead of loading a permanently soft-locked
  // player: both-set-or-neither, the way must be owned by its path
  // module, a mortal can never carry the pair, and 'sword' requires
  // its swordPath slice (provider attach + NguKiemDao reads assume it).
  const hasPath = player.cultivationPath !== undefined
  const hasWay = player.cultivationWay !== undefined

  if (hasPath !== hasWay) {
    issues.push({
      path: 'player.cultivationWay',
      message: 'cultivationPath và cultivationWay phải cùng vắng mặt hoặc cùng set (commit nguyên tử)',
    })
  } else if (
    hasPath &&
    typeof player.cultivationPath === 'string' &&
    Object.prototype.hasOwnProperty.call(CULTIVATION_PATH_MODULES, player.cultivationPath) &&
    typeof player.cultivationWay === 'string' &&
    !Object.prototype.hasOwnProperty.call(
      CULTIVATION_PATH_MODULES[player.cultivationPath as CultivationPathId].ways,
      player.cultivationWay,
    )
  ) {
    issues.push({
      path: 'player.cultivationWay',
      message: `way '${player.cultivationWay}' không thuộc path '${player.cultivationPath}'`,
    })
  }

  if (player.realmId === 'mortal' && hasPath) {
    issues.push({
      path: 'player.cultivationPath',
      message: 'không thể set khi realmId là mortal (nghi lễ thăng cảnh trong cùng commit)',
    })
  }

  // P7-M4 (v71) - mortalBasicSkillId's precursor/mortal-only contract
  // is enforced at the restore preflight (preflightSaveRegistryReferences,
  // same hard-fail seam as the way technique-holder check), not here:
  // the shape layer stays structural for the player slice.

  // P1-M6 - persisted path-state validation is MODULE-OWNED: the
  // boundary keeps the identity-pair contract above (enum, atomic
  // pair, way membership, mortal gate) and iterates each module's
  // validatePersistedState hook generically for its own slices
  // (spell -> player.spellPath, sword -> player.swordPath; body owns
  // no slice). A new path carries its own rules - no save-layer edit.
  for (const pathModule of Object.values(CULTIVATION_PATH_MODULES)) {
    pathModule.validatePersistedState?.(player, (issue) => issues.push(issue))
  }

  // P7-M5 (v72) - body progression is module-owned too: the boundary
  // only checks the top-level record exists/is an object (inside the
  // delegated validator), then each chapter validates its own slice.
  // The retired flat fields (bodyRefinementCompletedTiers /
  // bodyRefinementCurrentTierProgress / openedMeridianIds) are gone.
  validateBodyProgressionPersistedState(player, (issue) => issues.push(issue))

  // Hidden Perfection Lineage (v82, 2026-09-23) - the lineage slice
  // replaces the retired bodyPerfection slice: presence + per-field
  // shape validated inside the delegated validator; semantic integrity
  // (strict-prefix completed list, two-view agreement, authored realms)
  // runs at restore preflight via assertHiddenPerfectionIntegrity.
  validateHiddenPerfectionPersistedState(player, (issue) => issues.push(issue))

  // Talent v4 M2 (v61) - 5 field moi: ngan tu vi tran (Hai Nap), tang
  // Loi Kiep, ledger mua node mien phi (Van Dao), tang Pha Giap mang
  // sang tran sau + canh gioi luc bank.
  requireNonNegativeNumber(player, 'cultivationOvercharge', 'player', issues)

  // F-A11-1: addCultivation is the only writer and it banks solely
  // under hasCultivationOverflowBank (cultivation_overflow_bank
  // talent); no removal path can orphan the bank, so a positive
  // overcharge without the talent is a forged cultivation grant that
  // pourCultivationOvercharge pays at every breakthrough.
  if (
    isNonNegativeFiniteNumber(player.cultivationOvercharge) &&
    (player.cultivationOvercharge as number) > 0 &&
    !hasCultivationOverflowBank(
      (selectedTalentIds ?? []).filter(
        (talentId): talentId is string => typeof talentId === 'string',
      ),
      isObject(player.talentLevels) ? (player.talentLevels as Record<string, number>) : undefined,
    )
  ) {
    issues.push({
      path: 'player.cultivationOvercharge',
      message: 'bank > 0 khi không sở hữu talent cultivation_overflow_bank',
    })
  }

  // F-TC10-OC: the bank only ever accrues overflow from cultivation the
  // save has already gained (addCultivation splits into bank), so an
  // overcharge above the lifetime tally is a fabricated accrual grant.
  if (
    isNonNegativeFiniteNumber(player.cultivationOvercharge) &&
    isNonNegativeFiniteNumber(player.totalCultivationGained) &&
    (player.cultivationOvercharge as number) > (player.totalCultivationGained as number)
  ) {
    issues.push({
      path: 'player.cultivationOvercharge',
      message: 'bank vượt totalCultivationGained (accrual claim bất khả thi)',
    })
  }
  // tribulationBonusStacks removed at v82 - Loi Kiep lives only in
  // talent_loi_kiep_* modifiers (was write-only).

  if (!isObject(player.nodeFreePurchaseRecord)) {
    issues.push({ path: 'player.nodeFreePurchaseRecord', message: 'phải là object' })
  } else if (Object.keys(player.nodeFreePurchaseRecord).length > ID_COLLECTION_CAP) {
    issues.push({ path: 'player.nodeFreePurchaseRecord', message: `vượt ID_COLLECTION_CAP (${ID_COLLECTION_CAP})` })
  } else {
    for (const [nodeId, count] of Object.entries(player.nodeFreePurchaseRecord)) {
      if (!isNonNegativeFiniteNumber(count)) {
        issues.push({
          path: `player.nodeFreePurchaseRecord.${nodeId}`,
          message: 'phải là số hữu hạn >= 0',
        })
      }
    }
  }

  // F-W-2 (v82) - provenance record cua grant 1-lan (skill hoc, kiem
  // y/kiem dao, specialization) ma respec phai clawback.
  // Optional per-field nhung khi co phai dung kieu.
  if (!isObject(player.nodeOneShotGrants)) {
    issues.push({ path: 'player.nodeOneShotGrants', message: 'phải là object' })
  } else if (Object.keys(player.nodeOneShotGrants).length > ID_COLLECTION_CAP) {
    issues.push({ path: 'player.nodeOneShotGrants', message: `vượt ID_COLLECTION_CAP (${ID_COLLECTION_CAP})` })
  } else {
    for (const [nodeId, grant] of Object.entries(player.nodeOneShotGrants)) {
      if (!isObject(grant)) {
        issues.push({ path: `player.nodeOneShotGrants.${nodeId}`, message: 'phải là object' })
        continue
      }

      if (grant.learnedSkillIds !== undefined) {
        // r27-COR-6: distinct messages for the cap arm vs the shape arm
        // so a refused payload names the actual bound it hit.
        if (!Array.isArray(grant.learnedSkillIds)) {
          issues.push({
            path: `player.nodeOneShotGrants.${nodeId}.learnedSkillIds`,
            message: 'phải là mảng string',
          })
        } else if (grant.learnedSkillIds.length > ID_COLLECTION_CAP) {
          issues.push({
            path: `player.nodeOneShotGrants.${nodeId}.learnedSkillIds`,
            message: `vượt ID_COLLECTION_CAP (${ID_COLLECTION_CAP})`,
          })
        } else if (!grant.learnedSkillIds.every((id) => typeof id === 'string')) {
          issues.push({
            path: `player.nodeOneShotGrants.${nodeId}.learnedSkillIds`,
            message: 'phải là mảng string',
          })
        }
      }

      if (grant.kiemY !== undefined && !isNonNegativeFiniteNumber(grant.kiemY)) {
        issues.push({
          path: `player.nodeOneShotGrants.${nodeId}.kiemY`,
          message: 'phải là số hữu hạn >= 0',
        })
      }

      if (grant.kiemDao !== undefined && !isNonNegativeFiniteNumber(grant.kiemDao)) {
        issues.push({
          path: `player.nodeOneShotGrants.${nodeId}.kiemDao`,
          message: 'phải là số hữu hạn >= 0',
        })
      }

      if (grant.specializationSkillId !== undefined && typeof grant.specializationSkillId !== 'string') {
        issues.push({
          path: `player.nodeOneShotGrants.${nodeId}.specializationSkillId`,
          message: 'phải là string',
        })
      }

      if (grant.specializationId !== undefined && typeof grant.specializationId !== 'string') {
        issues.push({
          path: `player.nodeOneShotGrants.${nodeId}.specializationId`,
          message: 'phải là string',
        })
      }
    }
  }
  requireNonNegativeNumber(player, 'phaGiapCarryStacks', 'player', issues)
  // F-PHAGIAP-CARRY: the only writer banks floor(passiveStacks *
  // carry.fraction) capped by the bound passive's authored maxStacks -
  // a persisted bank above the producible max is a fabricated claim
  // that re-seeds free stacks into every later battle.
  if (
    Number.isFinite(PHA_GIAP_CARRY_BANK_MAX) &&
    isNonNegativeFiniteNumber(player.phaGiapCarryStacks) &&
    (player.phaGiapCarryStacks as number) > PHA_GIAP_CARRY_BANK_MAX
  ) {
    issues.push({
      path: 'player.phaGiapCarryStacks',
      message: `vượt producible bank max (${PHA_GIAP_CARRY_BANK_MAX})`,
    })
  }
  if (player.phaGiapCarryRealmId !== null && typeof player.phaGiapCarryRealmId !== 'string') {
    issues.push({ path: 'player.phaGiapCarryRealmId', message: 'phải là string hoặc null' })
  }

  // Spec dot-pha-loi-kiep sec.6.1 - the hidden-beast counters. Bat
  // Mach moved into player.bodyProgression.meridian at v72; the scalar
  // kill counter became a per-channel map at v81. mortalPerfectionAchieved
  // + greatDaoOpportunityLost retired at v82 (hidden-perfection
  // lineage). Lineage state validates via the delegated validator
  // above.
  validateNonNegativeIntMap(player.hiddenBeastKills, 'player.hiddenBeastKills', issues)

  // lastSavedAt - buildGameSave() LUON ghi; thieu no khien offline time
  // tinh ra NaN (review 2026-08-28 bug #2). Save hien hanh bat buoc co.
  // r21-AUT-02/COR-3: magnitude bound too - a crafted marker outside
  // the exact-integer-ms domain (like -1e300) derives deep-past
  // cursors that trip the settle guard and wedge sites verbatim.
  if (!isBoundedTimestamp(player.lastSavedAt)) {
    issues.push({ path: 'player.lastSavedAt', message: 'phải là timestamp trong miền |x| < 2^52' })
  }

  // v60 companion gacha - pity counter and Duyen Phan currency. A NaN
  // here would poison every later pull/exchange result.
  requireNonNegativeNumber(player, 'companionPullsSinceRare', 'player', issues)
  requireNonNegativeNumber(player, 'duyenPhan', 'player', issues)

  const companions = requireArray(player, 'companions', 'player', issues)

  if (companions) {
    validateCompanionEntries(companions, 'player.companions', issues, stageClaimRealmIndex)
  }

  // v77 companion gifts - authored mail/gift records. A persisted gift
  // outside the Beta gift catalog is the persisted-bypass class the
  // acquisition boundary exists to kill - fail loud like an unknown
  // definitionId on an owned companion.
  const companionGifts = requireArray(player, 'companionGifts', 'player', issues)

  if (companionGifts) {
    // F-GIFT-CLAIM-WITNESS: claimCompanionGift creates/ranks the roster
    // instance before stamping claimed, so the owned-definition set is
    // the claim's mandatory witness.
    validateCompanionGiftEntries(
      companionGifts,
      'player.companionGifts',
      issues,
      stageClaimRealmIndex,
      new Set(
        (companions ?? [])
          .filter(
            (entry): entry is Record<string, unknown> =>
              isObject(entry) && typeof entry.definitionId === 'string',
          )
          .map((entry) => entry.definitionId as string),
      ),
      new Set(
        (completedStageIds ?? []).filter(
          (stageId): stageId is string => typeof stageId === 'string',
        ),
      ),
    )
  }

  // C1 triage (2026-09-14) - 3 corrupt-save residuals closed save-side:
  // perfectClearSeconds feeds auto-farm cycleSeconds (a missing/non-object
  // field crashes the tick's index read; junk values are additionally
  // guarded at consumption by isValidCycleSeconds).
  if (!isObject(player.perfectClearSeconds)) {
    issues.push({ path: 'player.perfectClearSeconds', message: 'phải là object' })
  } else if (Object.keys(player.perfectClearSeconds).length > ID_COLLECTION_CAP) {
    issues.push({ path: 'player.perfectClearSeconds', message: `vượt ID_COLLECTION_CAP (${ID_COLLECTION_CAP})` })
  } else {
    for (const [stageId, seconds] of Object.entries(player.perfectClearSeconds)) {
      // F-TC8-7: a sub-second clear is below every authored stage
      // minimum and feeds the auto-farm roll rate directly (cycleMs
      // halves it) - a 0.001s claim mints thousands of rolls per tick.
      // F-SEAM-2: the floor is per-stage physical - no wave can land
      // before its spawn tick, so a multi-wave stage cannot clear
      // faster than (waves.length - 1) * spawnIntervalSeconds; a claim
      // below that is a fabricated auto-farm rate grant.
      const claimedStage = STAGES.find((stage) => stage.id === stageId)
      const physicalFloor =
        claimedStage !== undefined
          ? Math.max(1, (claimedStage.waves.length - 1) * claimedStage.spawnIntervalSeconds)
          : 1
      if (!isFiniteNumber(seconds) || (seconds as number) < physicalFloor) {
        issues.push({
          path: `player.perfectClearSeconds.${stageId}`,
          message: `dưới authored floor - stage nhanh nhất vẫn cần >= ${physicalFloor}s`,
        })
      }
    }
  }

  // autoFarmStage: null | { stageId, lastCheckedMs }. A malformed entry
  // previously slipped through shape validation; lastCheckedMs is only
  // shape-checked here - the unbounded catch-up a small-positive value
  // used to cause is bounded in tickAutoFarm's elapsed clamp instead.
  if (player.autoFarmStage !== null) {
    if (!isObject(player.autoFarmStage)) {
      issues.push({ path: 'player.autoFarmStage', message: 'phải là object hoặc null' })
    } else {
      requireNonEmptyString(player.autoFarmStage, 'stageId', 'player.autoFarmStage', issues)
      requireNonNegativeNumber(player.autoFarmStage, 'lastCheckedMs', 'player.autoFarmStage', issues)
      if (
        isNonNegativeFiniteNumber(player.autoFarmStage.lastCheckedMs) &&
        !isBoundedTimestamp(player.autoFarmStage.lastCheckedMs)
      ) {
        issues.push({
          path: 'player.autoFarmStage.lastCheckedMs',
          message: 'ngoài miền timestamp |x| < 2^52',
        })
      }

      // F-A10-6: autofarm mints rewards on the claimed stage - the same
      // realm-earnability bound as the clear claims applies.
      const autoFarmStageId = player.autoFarmStage.stageId
      const autoFarmRealmIndex =
        typeof player.realmId === 'string' ? getRealmIndex(player.realmId) : -1
      const autoFarmStage =
        typeof autoFarmStageId === 'string' ? STAGE_BY_ID.get(autoFarmStageId) : undefined
      if (
        autoFarmRealmIndex >= 0 &&
        autoFarmStage?.requiredRealmId !== undefined &&
        getRealmIndex(autoFarmStage.requiredRealmId) > autoFarmRealmIndex
      ) {
        issues.push({
          path: 'player.autoFarmStage.stageId',
          message: `stage '${autoFarmStageId}' yêu cầu realm '${autoFarmStage.requiredRealmId}' - realm chưa đạt nên autofarm bất khả thi`,
        })
      }
    }
  }

  // idleSkillInsightDaily (2026-10-05 ruling A): optional
  // { dayBucket, minted } ledger - absent on pre-ruling saves means the
  // daily window starts at the first idle mint (migration-lite, same
  // `!== undefined` gate as pendingTalentEntitlement).
  if (player.idleSkillInsightDaily !== undefined) {
    if (!isObject(player.idleSkillInsightDaily)) {
      issues.push({
        path: 'player.idleSkillInsightDaily',
        message: 'phải là object',
      })
    } else {
      requireNonNegativeNumber(
        player.idleSkillInsightDaily,
        'dayBucket',
        'player.idleSkillInsightDaily',
        issues,
      )
      requireNonNegativeNumber(
        player.idleSkillInsightDaily,
        'minted',
        'player.idleSkillInsightDaily',
        issues,
      )
    }
  }

  // formationLoadout: null | { formationId, assignments[] }. Mirror the
  // commitFormationLoadout contract (FormationPlacement.ts): a malformed
  // loadout passes shape-check then resolvePartyFormation() silently
  // drops rows - validate content, not just shape.
  if (player.formationLoadout !== null) {
    const loadout = player.formationLoadout
    if (!isObject(loadout)) {
      issues.push({ path: 'player.formationLoadout', message: 'phải là object hoặc null' })
    } else {
      requireNonEmptyString(loadout, 'formationId', 'player.formationLoadout', issues)
      const assignments = requireArray(loadout, 'assignments', 'player.formationLoadout', issues)
      const formation = TRAN_PHAP_FORMATIONS.find((entry) => entry.id === loadout.formationId)

      if (typeof loadout.formationId === 'string' && formation === undefined) {
        issues.push({ path: 'player.formationLoadout.formationId', message: 'formationId không tồn tại' })
      }

      if (assignments && formation) {
        const seenCombatants = new Set<string>()
        const seenCells = new Set<string>()

        for (let i = 0; i < assignments.length; i += 1) {
          const assignment = assignments[i]
          const assignmentPath = `player.formationLoadout.assignments[${i}]`

          if (!isObject(assignment)) {
            issues.push({ path: assignmentPath, message: 'phải là object' })
            continue
          }

          requireNonEmptyString(assignment, 'combatantId', assignmentPath, issues)

          if (!isFiniteNumber(assignment.row) || !Number.isInteger(assignment.row)) {
            issues.push({ path: `${assignmentPath}.row`, message: 'phải là số nguyên hữu hạn' })
          }

          if (!isFiniteNumber(assignment.column) || !Number.isInteger(assignment.column)) {
            issues.push({ path: `${assignmentPath}.column`, message: 'phải là số nguyên hữu hạn' })
          }

          if (typeof assignment.combatantId === 'string') {
            const isKnownCombatant =
              assignment.combatantId === 'player' ||
              (Array.isArray(companions) &&
                companions.some(
                  (companion) => isObject(companion) && companion.definitionId === assignment.combatantId,
                ))

            if (!isKnownCombatant) {
              issues.push({ path: `${assignmentPath}.combatantId`, message: 'combatant không tồn tại trong đội' })
            } else if (seenCombatants.has(assignment.combatantId)) {
              issues.push({ path: `${assignmentPath}.combatantId`, message: 'combatant bị trùng trong đội hình' })
            } else {
              seenCombatants.add(assignment.combatantId)
            }
          }

          if (Number.isInteger(assignment.row) && Number.isInteger(assignment.column)) {
            const inPattern = formation.cellPattern.some(
              (cell) => cell.row === assignment.row && cell.column === assignment.column,
            )

            if (!inPattern) {
              issues.push({ path: assignmentPath, message: 'ô không nằm trong cellPattern của trận pháp' })
            }

            const cellKey = `${assignment.row}:${assignment.column}`

            if (seenCells.has(cellKey)) {
              issues.push({ path: assignmentPath, message: 'hai combatant chung một ô' })
            } else {
              seenCells.add(cellKey)
            }
          }
        }
      }
    }
  }

  return normalization
}

/**
 * CompanionInstance entries (v60 schema). realmLevel is REJECTED when
 * outside 1..realm.maxLevel - malformed progression data must fail loud
 * like the rest of this validator, not be silently clamped.
 */
function validateCompanionEntries(
  entries: unknown[],
  path: string,
  issues: ShapeIssue[],
  playerRealmIndex: number,
) {
  // Domain invariant: 1 instance per definitionId, and instanceId is the
  // identity key every consumer first-matches on (findIndex). A duplicated
  // id in a corrupted save loads state consumers treat as impossible -
  // same dedupe rationale as the equipment instanceId check below.
  const seenInstanceIds = new Set<string>()
  const seenDefinitionIds = new Set<string>()

  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i]
    const entryPath = `${path}[${i}]`

    if (!isObject(entry)) {
      issues.push({ path: entryPath, message: 'phải là object' })

      continue
    }

    requireNonEmptyString(entry, 'instanceId', entryPath, issues)
    requireNonEmptyString(entry, 'definitionId', entryPath, issues)

    if (typeof entry.instanceId === 'string' && entry.instanceId.trim().length > 0) {
      if (seenInstanceIds.has(entry.instanceId)) {
        issues.push({ path: `${entryPath}.instanceId`, message: 'bị trùng với companion entry khác' })
      } else {
        seenInstanceIds.add(entry.instanceId)
      }
    }

    if (typeof entry.definitionId === 'string' && entry.definitionId.trim().length > 0) {
      if (seenDefinitionIds.has(entry.definitionId)) {
        issues.push({ path: `${entryPath}.definitionId`, message: 'bị trùng với companion entry khác' })
      } else {
        seenDefinitionIds.add(entry.definitionId)
      }

      // An owned companion whose definitionId is absent from the roster
      // loads as permanently inert dead state (every consumer silently
      // skips it) - fail loud like an unknown realmId.
      if (!COMPANIONS.some((definition) => definition.id === entry.definitionId)) {
        issues.push({
          path: `${entryPath}.definitionId`,
          message: 'không tồn tại trong roster companion',
        })
      }
    }

    const realm =
      typeof entry.realmId === 'string'
        ? REALMS.find((candidate) => candidate.id === entry.realmId)
        : undefined

    if (!realm) {
      issues.push({
        path: `${entryPath}.realmId`,
        message: 'không tồn tại trong danh sách cảnh giới',
      })
    }

    // F-COMP-REALM-PIN: every acquisition seam (pull/exchange/gift
    // claim/feed) gates on isCompanionDomainUnlocked - realm order is
    // monotonic, so an owned record on a save below the unlock realm is
    // unproducible. The bound keys on realm order rather than the domain
    // predicate because the domain is scope-hidden in beta - a carried
    // record must still load once the realm claim reaches the tier.
    if (
      playerRealmIndex >= 0 &&
      playerRealmIndex < getRealmIndex(COMPANION_UNLOCK_REALM_ID)
    ) {
      issues.push({
        path: entryPath,
        message: `realm chưa đạt '${COMPANION_UNLOCK_REALM_ID}' - companion bất khả thi`,
      })
    }

    // F-COMP-REALM-PIN: applyCompanionExp hard-caps the companion's
    // realmIndex at the player's own (the ceiling check runs before any
    // level write), so a record out-realming its holder is unproducible.
    const companionRealmIndex = realm !== undefined ? getRealmIndex(realm.id) : -1

    if (
      companionRealmIndex >= 0 &&
      playerRealmIndex >= 0 &&
      companionRealmIndex > playerRealmIndex
    ) {
      issues.push({
        path: `${entryPath}.realmId`,
        message: 'vượt realm người chơi (applyCompanionExp cap tại player realmIndex)',
      })
    }

    if (
      !isFiniteNumber(entry.realmLevel) ||
      !Number.isInteger(entry.realmLevel) ||
      entry.realmLevel < 1 ||
      (realm !== undefined && entry.realmLevel > realm.maxLevel)
    ) {
      issues.push({
        path: `${entryPath}.realmLevel`,
        message: 'phải là số nguyên trong khoảng 1..maxLevel của cảnh giới',
      })
    }

    requireNonNegativeNumber(entry, 'exp', entryPath, issues)

    // F-COMP-EXP-BANK: replay the writer invariant - applyCompanionExp
    // spends exp while exp >= companionExpRequiredForLevel, so a banked
    // value at/above the tier cost is unproducible; and at the player-
    // realm ceiling the writer discards leftover exp into clampedExp,
    // so exp must be exactly 0 there.
    if (
      realm !== undefined &&
      Number.isInteger(entry.realmLevel) &&
      (entry.realmLevel as number) >= 1 &&
      (entry.realmLevel as number) <= realm.maxLevel &&
      isNonNegativeFiniteNumber(entry.exp)
    ) {
      const atPlayerRealmCap =
        companionRealmIndex >= 0 &&
        playerRealmIndex >= 0 &&
        companionRealmIndex >= playerRealmIndex &&
        (entry.realmLevel as number) >= realm.maxLevel

      if (
        (atPlayerRealmCap && (entry.exp as number) !== 0) ||
        (!atPlayerRealmCap &&
          (entry.exp as number) >= companionExpRequiredForLevel(realm.id, entry.realmLevel as number))
      ) {
        issues.push({
          path: `${entryPath}.exp`,
          message: atPlayerRealmCap
            ? 'exp phải là 0 tại trần realm người chơi (clampedExp discard)'
            : 'exp banked >= required của tầng (applyCompanionExp luôn level-up)',
        })
      }
    }

    if (
      !isFiniteNumber(entry.constellationRank) ||
      !Number.isInteger(entry.constellationRank) ||
      entry.constellationRank < 0 ||
      entry.constellationRank > MAX_CONSTELLATION_RANK
    ) {
      issues.push({
        path: `${entryPath}.constellationRank`,
        message: `phải là số nguyên 0..${MAX_CONSTELLATION_RANK}`,
      })
    }
  }
}

/**
 * CompanionGiftRecord entries (v77 schema). `id` binds the authored
 * moment table: the issue seam mints record.id = moment.id and pairs it
 * with moment.definitionId, and the moment's trigger leaves a persisted
 * witness the save must also carry (realm at/above the entered realm,
 * or the completed stage for stage_completed moments).
 */
function validateCompanionGiftEntries(
  entries: unknown[],
  path: string,
  issues: ShapeIssue[],
  playerRealmIndex: number,
  ownedDefinitionIds: ReadonlySet<string>,
  completedStageIds: ReadonlySet<string>,
) {
  const seenIds = new Set<string>()

  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i]
    const entryPath = `${path}[${i}]`

    if (!isObject(entry)) {
      issues.push({ path: entryPath, message: 'phải là object' })

      continue
    }

    requireNonEmptyString(entry, 'id', entryPath, issues)
    requireNonEmptyString(entry, 'definitionId', entryPath, issues)

    if (typeof entry.id === 'string' && entry.id.trim().length > 0) {
      if (seenIds.has(entry.id)) {
        issues.push({ path: `${entryPath}.id`, message: 'bị trùng với gift entry khác' })
      } else {
        seenIds.add(entry.id)
      }
    }

    // F-CG-MOMENT: bind the record to its authored moment - the mint
    // table is closed, so an id no moment mints, a definitionId the
    // moment never pairs, or a trigger witness the save lacks are all
    // unproducible.
    const moment =
      typeof entry.id === 'string' ? COMPANION_GIFT_MOMENT_BY_ID.get(entry.id) : undefined

    if (typeof entry.id === 'string' && entry.id.trim().length > 0 && moment === undefined) {
      issues.push({
        path: `${entryPath}.id`,
        message: 'không thuộc gift moment table đã authored',
      })
    }

    if (
      moment !== undefined &&
      typeof entry.definitionId === 'string' &&
      entry.definitionId.trim().length > 0 &&
      entry.definitionId !== moment.definitionId
    ) {
      issues.push({
        path: `${entryPath}.definitionId`,
        message: `không khớp moment '${moment.id}' (authored '${moment.definitionId}')`,
      })
    }

    if (moment !== undefined) {
      if (moment.trigger.kind === 'realm_entered') {
        const triggerRealmIndex = getRealmIndex(moment.trigger.realmId)

        if (
          playerRealmIndex >= 0 &&
          triggerRealmIndex >= 0 &&
          playerRealmIndex < triggerRealmIndex
        ) {
          issues.push({
            path: `${entryPath}.id`,
            message: `moment '${moment.id}' yêu cầu realm >= '${moment.trigger.realmId}'`,
          })
        }
      } else if (!completedStageIds.has(moment.trigger.stageId)) {
        issues.push({
          path: `${entryPath}.id`,
          message: `moment '${moment.id}' thiếu stage clear witness '${moment.trigger.stageId}'`,
        })
      }
    }

    if (
      typeof entry.definitionId === 'string' &&
      entry.definitionId.trim().length > 0 &&
      !isBetaCompanionGift(entry.definitionId)
    ) {
      issues.push({
        path: `${entryPath}.definitionId`,
        message: 'không phải companion trong danh mục quà tặng Beta',
      })
    }

    if (typeof entry.claimed !== 'boolean') {
      issues.push({ path: `${entryPath}.claimed`, message: 'phải là boolean' })
    }

    // F-GIFT-CLAIM-WITNESS: claimCompanionGift mints/ranks the roster
    // instance before stamping claimed, so claimed=true without a roster
    // companion carrying this definitionId is unproducible.
    if (
      entry.claimed === true &&
      typeof entry.definitionId === 'string' &&
      !ownedDefinitionIds.has(entry.definitionId)
    ) {
      issues.push({
        path: `${entryPath}.claimed`,
        message: 'claimed nhưng roster thiếu instance cho definitionId này',
      })
    }
  }
}

/** Kiem tra phan tu cua stack save (materials/pills) - id string + amount number >= 0. */
function validateStackEntries(
  entries: unknown[],
  idKey: string,
  path: string,
  issues: ShapeIssue[],
) {
  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i]

    if (!isObject(entry)) {
      issues.push({ path: `${path}[${i}]`, message: 'phải là object' })

      continue
    }

    requireString(entry, idKey, `${path}[${i}]`, issues)
    requireNonNegativeNumber(entry, 'amount', `${path}[${i}]`, issues)
  }
}

function validateIdEntries(entries: unknown[], path: string, issues: ShapeIssue[]) {
  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i]

    if (!isObject(entry)) {
      issues.push({ path: `${path}[${i}]`, message: 'phải là object' })

      continue
    }

    requireString(entry, 'id', `${path}[${i}]`, issues)
  }
}

// P7-M4 (v71) - skill entries REJECT the retired loadout surface
// outright (no sanitize-and-load: structuredClone on restore would
// silently carry stale keys into the next save). Learned = membership;
// combat roles resolve from the way kit - these fields have no writer.
const RETIRED_SKILL_ENTRY_KEYS = ['loadoutSlot', 'loadoutSlots', 'equipped', 'unlocked'] as const

function validateSkillEntries(
  entries: unknown[],
  path: string,
  issues: ShapeIssue[],
  skillCastCounts: Record<string, unknown> | undefined,
) {
  // QA-FS-4: SkillSystem.learn dedupes via SkillManager.has, so a
  // duplicate skills[] id is unproducible - each copy re-emits the
  // full passive set and accrues stacks at N x rate.
  const seenIds = new Set<string>()

  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i]

    if (!isObject(entry)) {
      issues.push({ path: `${path}[${i}]`, message: 'phải là object' })

      continue
    }

    requireString(entry, 'id', `${path}[${i}]`, issues)

    if (typeof entry.id === 'string') {
      if (seenIds.has(entry.id)) {
        issues.push({
          path: `${path}[${i}].id`,
          message: `skill record trùng lặp (learn() dedupe - không sản xuất được: ${entry.id})`,
        })
      } else {
        seenIds.add(entry.id)
      }
    }

    for (const retiredKey of RETIRED_SKILL_ENTRY_KEYS) {
      if (Object.prototype.hasOwnProperty.call(entry, retiredKey)) {
        issues.push({
          path: `${path}[${i}].${retiredKey}`,
          message: 'field đã retire (v71 - learned = membership; roles resolve from the way kit)',
        })
      }
    }

    // F-SKILLS-TXP: recordCast() increments totalExperience and writes
    // player.skillCastCounts[id] in the same statement, and the mirror
    // is never cleared (unlearn leaves stale counts, relearn restarts
    // the entry counter). totalExperience <= mirror is therefore the
    // only producible direction - anything above it, or a non-numeric
    // claim, is forged. The field feeds getPrecursorFlatDamageBonus
    // (floor(t/10) flat damage) and getCastLeveledSkillLevel.
    if (Object.prototype.hasOwnProperty.call(entry, 'totalExperience')) {
      const mirror = skillCastCounts !== undefined && typeof entry.id === 'string'
        ? skillCastCounts[entry.id]
        : undefined
      const mirrorValue = typeof mirror === 'number' && Number.isFinite(mirror) ? mirror : 0

      if (!isNonNegativeFiniteNumber(entry.totalExperience) || entry.totalExperience > mirrorValue) {
        issues.push({
          path: `${path}[${i}].totalExperience`,
          message: 'vượt skillCastCounts mirror (cast counter không sản xuất được)',
        })
      }
    }
  }
}

/**
 * M-QI-05 (v73) - Core Node coverage between the learned-skills array,
 * the active way's coreSkillIds, and owned nodes' grantsSkillCoreIds on
 * one side, and player.nodeLevels on the other. Runs only when both
 * slices already shaped (missing nodeLevels is reported there).
 */
function validateSkillCoreCoverage(
  player: Record<string, unknown>,
  skills: unknown[],
  issues: ShapeIssue[],
) {
  // r29-COR-F2: cap-gate like talentLevels - an over-cap record already
  // fails the root check (:2026); skipping its walks here is cost-only
  // (the verdict still refuses).
  const nodeLevels =
    isObject(player.nodeLevels) && Object.keys(player.nodeLevels).length <= ID_COLLECTION_CAP
      ? player.nodeLevels
      : undefined

  const coreGranted = (skillId: string): boolean =>
    nodeLevels !== undefined &&
    isNonNegativeFiniteNumber(nodeLevels[skillCoreNodeId(skillId)]) &&
    (nodeLevels[skillCoreNodeId(skillId)] as number) >= 1

  // 1. Every learned levelled template must own its core.
  for (let i = 0; i < skills.length; i += 1) {
    const entry = skills[i]

    if (!isObject(entry) || typeof entry.id !== 'string' || !LEVELLED_SKILL_IDS.has(entry.id)) {
      continue
    }

    if (!coreGranted(entry.id)) {
      issues.push({
        path: `skills[${i}].id`,
        message: `skill đã học '${entry.id}' thiếu core node ${skillCoreNodeId(entry.id)} (level >= 1)`,
      })
    }
  }

  // 2. The committed way's coreSkillIds must be granted.
  const pathId = typeof player.cultivationPath === 'string' ? player.cultivationPath : undefined
  const wayId = typeof player.cultivationWay === 'string' ? player.cultivationWay : undefined
  const way =
    pathId !== undefined && wayId !== undefined && pathId in CULTIVATION_PATH_MODULES
      ? Object.values(CULTIVATION_PATH_MODULES[pathId as CultivationPathId].ways).find(
          (candidate) => candidate?.id === wayId,
        )
      : undefined

  for (const skillId of way?.coreSkillIds ?? []) {
    if (!coreGranted(skillId)) {
      issues.push({
        path: 'player.cultivationWay',
        message: `way '${wayId}' sở hữu core '${skillId}' nhưng nodeLevels thiếu grant`,
      })
    }
  }

  // 3+4. Canonical ownership (D9d/D9f): a progression node is OWNED
  // exactly when nodeLevels[id] >= 1 - purchasedNodeIds is only the
  // mirror, never the ownership predicate. Collecting grant sources
  // and forward requirements from the same canonical scan keeps a
  // stale/phantom mirror from fabricating or hiding ownership.
  const learnedSkillIds = new Set(
    skills
      .filter(
        (entry): entry is Record<string, unknown> =>
          isObject(entry) && typeof entry.id === 'string' && LEVELLED_SKILL_IDS.has(entry.id),
      )
      .map((entry) => entry.id as string),
  )

  // F-A10-2: skill membership is a realm-earnability claim - templates
  // carrying requiredRealmId (the realm-ladder passives) are granted by
  // a realm advance into that realm, so membership on a lower realm is
  // a fabricated claim even though restore rebuilds the template.
  const memberRealmIndex =
    typeof player.realmId === 'string' ? getRealmIndex(player.realmId) : -1

  if (memberRealmIndex >= 0) {
    for (let i = 0; i < skills.length; i += 1) {
      const entry = skills[i]

      if (!isObject(entry) || typeof entry.id !== 'string') {
        continue
      }

      const template = SKILL_TEMPLATE_BY_ID.get(entry.id)
      if (
        template?.requiredRealmId !== undefined &&
        getRealmIndex(template.requiredRealmId) > memberRealmIndex
      ) {
        issues.push({
          path: `skills[${i}].id`,
          message: `skill '${entry.id}' yêu cầu realm '${template.requiredRealmId}' - realm chưa đạt nên membership bất khả thi`,
        })
      }
    }
  }

  // F-SKL-1: membership itself is a claim - a registered template must
  // name at least one writer this save satisfies:
  //   - the mortal starter skill (granted at creation)
  //   - the owned way's kit (skillIds / coreSkillIds / starter /
  //     passiveSkillIds / realm-reward passives)
  //   - an owned node's unlocksSkillIds / grantsSkillCoreIds
  //   - an owned talent's combat_passive declaration (definitions are
  //     enumerated directly so a dormant-flagged talent carry still
  //     resolves - the talent ownership record is the witness)
  //   - a realm-ladder passive (its own realm legality is F-A10-2)
  //   - a levelled skill (its own core axis is the first loop)
  // Restore already drops unregistered ids, so only registered
  // templates reach this check; an id with no producing writer is a
  // fabricated claim that restore would mint anyway.
  const ownedTalentPassiveSkillIds = new Set<string>()
  // r30-COR-Low-1: bind through the cap gate - a refused over-cap array
  // pays no element walk (requireArray already bound [] upstream and
  // pushed the cap issue).
  const persistedOwnedTalentIds =
    Array.isArray(player.selectedTalentIds) &&
    player.selectedTalentIds.length <= ID_COLLECTION_CAP
      ? player.selectedTalentIds
      : []

  for (const talentId of persistedOwnedTalentIds) {
    if (typeof talentId !== 'string') {
      continue
    }

    for (const effect of getTalentDefinition(talentId)?.effects ?? []) {
      if (effect.kind === 'combat_passive') {
        ownedTalentPassiveSkillIds.add(effect.passiveSkillId)
      }
    }
  }

  const ownedNodeGrantSkillIds = new Set<string>()
  if (nodeLevels !== undefined) {
    for (const [ownedNodeId, ownedLevel] of Object.entries(nodeLevels)) {
      if (!isNonNegativeFiniteNumber(ownedLevel) || ownedLevel < 1) {
        continue
      }

      const ownedNode = PROGRESSION_NODE_BY_ID.get(ownedNodeId)
      for (const id of ownedNode?.effect?.unlocksSkillIds ?? []) {
        ownedNodeGrantSkillIds.add(id)
      }
      for (const id of ownedNode?.effect?.grantsSkillCoreIds ?? []) {
        ownedNodeGrantSkillIds.add(id)
      }
    }
  }

  const ownedWayKitSkillIds = new Set<string>()
  if (way !== undefined) {
    for (const id of way.skillIds ?? []) {
      ownedWayKitSkillIds.add(id)
    }
    for (const id of way.coreSkillIds ?? []) {
      ownedWayKitSkillIds.add(id)
    }
    if (way.starterBasicSkillId !== undefined) {
      ownedWayKitSkillIds.add(way.starterBasicSkillId)
    }
    for (const id of way.passiveSkillIds ?? []) {
      ownedWayKitSkillIds.add(id)
    }
    for (const reward of Object.values(way.realmRewards ?? {})) {
      if (typeof reward?.passiveSkillId === 'string') {
        ownedWayKitSkillIds.add(reward.passiveSkillId)
      }
    }
  }

  for (let i = 0; i < skills.length; i += 1) {
    const entry = skills[i]

    if (!isObject(entry) || typeof entry.id !== 'string') {
      continue
    }

    const template = SKILL_TEMPLATE_BY_ID.get(entry.id)
    if (template === undefined || LEVELLED_SKILL_IDS.has(entry.id)) {
      continue
    }

    const producible =
      entry.id === BETA_MORTAL_STARTER_SKILL_ID ||
      ownedWayKitSkillIds.has(entry.id) ||
      ownedNodeGrantSkillIds.has(entry.id) ||
      ownedTalentPassiveSkillIds.has(entry.id) ||
      template.requiredRealmId !== undefined

    if (!producible) {
      issues.push({
        path: `skills[${i}].id`,
        message: `skill '${entry.id}' không có writer nào trên save này có thể grant`,
      })
    }
  }

  const wayGrantedIds = new Set(way?.coreSkillIds ?? [])
  const nodeGrantedIds = new Set<string>()

  if (nodeLevels !== undefined) {
    for (const [nodeId, level] of Object.entries(nodeLevels)) {
      if (!isNonNegativeFiniteNumber(level) || level < 1) {
        continue
      }

      const node = PROGRESSION_NODE_BY_ID.get(nodeId)

      // 3. (D9d) Every owned node's grantsSkillCoreIds must be granted.
      for (const skillId of node?.effect?.grantsSkillCoreIds ?? []) {
        nodeGrantedIds.add(skillId)

        if (!coreGranted(skillId)) {
          issues.push({
            path: `player.nodeLevels.${nodeId}`,
            message: `node '${nodeId}' grant core '${skillId}' nhưng nodeLevels thiếu grant`,
          })
        }
      }
    }

    // 4. (D9f) Inverse membership: every OWNED registered core must
    // have at least one satisfied declared source - its levelsSkillId
    // is a learned levelled Skill template, OR a canonically-owned
    // node's grantsSkillCoreIds lists it, OR the active way's
    // coreSkillIds lists it. An owned core with no source is a state
    // no legal path can produce (e.g. core_cuong_quyen surviving its
    // cuong_chien reset, or a fake skills[] entry pointing at a native
    // def id - only LEVELLED_SKILL_IDS entries count as learned).
    for (const [nodeId, level] of Object.entries(nodeLevels)) {
      if (!nodeId.startsWith('core_') || !isNonNegativeFiniteNumber(level) || level < 1) {
        continue
      }

      const skillId = SKILL_CORE_BY_ID.get(nodeId)?.levelsSkillId

      // Unregistered cores are already reported by the key validation
      // above; only registered ones reach the source check.
      if (skillId === undefined) {
        continue
      }

      if (!learnedSkillIds.has(skillId) && !nodeGrantedIds.has(skillId) && !wayGrantedIds.has(skillId)) {
        issues.push({
          path: `player.nodeLevels.${nodeId}`,
          message: `core '${nodeId}' không có nguồn grant (learned skill / owned node grant / way.coreSkillIds)`,
        })
      }
    }
  }
}

// Mission A1 - deep per-slice validation. QuestManager.restore spreads
// state.active blindly, so a malformed element must fail the boundary
// instead of crashing restore (quest `active:"x"` -> TypeError).
function validateQuestSave(value: unknown, path: string, issues: ShapeIssue[]): void {
  if (!isObject(value)) {
    issues.push({ path, message: 'phải là object hoặc vắng mặt' })

    return
  }

  const active = value.active

  if (!Array.isArray(active)) {
    issues.push({ path: `${path}.active`, message: 'phải là array' })
  } else if (active.length > ID_COLLECTION_CAP) {
    issues.push({ path: `${path}.active`, message: `vượt ID_COLLECTION_CAP (${ID_COLLECTION_CAP})` })
  } else {
    // F-QUEST-DUP: ensureActive dedupes via getProgress (first-match),
    // so a duplicated active questId is unproducible - the dup would
    // shadow progress/claim state at restore (same class as QA-FS-4
    // skills and equipment instanceId).
    const seenQuestIds = new Set<string>()

    for (let i = 0; i < active.length; i += 1) {
      const entry = active[i]

      if (
        !isObject(entry) ||
        typeof entry.questId !== 'string' ||
        !isNonNegativeFiniteNumber(entry.progress) ||
        typeof entry.claimed !== 'boolean'
      ) {
        issues.push({ path: `${path}.active[${i}]`, message: 'quest progress sai shape' })
      }

      if (isObject(entry) && typeof entry.questId === 'string') {
        if (seenQuestIds.has(entry.questId)) {
          issues.push({
            path: `${path}.active[${i}].questId`,
            message: `questId '${entry.questId}' trùng lặp (ensureActive dedupe - không sản xuất được)`,
          })
        } else {
          seenQuestIds.add(entry.questId)
        }
      }
    }
  }

  // Same dedup-string rule as questFlags: the writer
  // (QuestManager.markCompletedOnce) dedups at the seam, so a duplicated
  // id is unproducible.
  if (
    !Array.isArray(value.completedOnceIds) ||
    // r25-AUT-3: the count bound must precede the per-element walks -
    // .every/new Set on an unbounded crafted array is the wedge the
    // cap exists to close.
    value.completedOnceIds.length > ID_COLLECTION_CAP ||
    !value.completedOnceIds.every((id) => typeof id === 'string') ||
    new Set(value.completedOnceIds).size !== value.completedOnceIds.length
  ) {
    issues.push({ path: `${path}.completedOnceIds`, message: 'phải là string[] không trùng lặp trong ID_COLLECTION_CAP' })
  }

  // Mainline flag witness (kind:'flag' quests): optional slice - saves
  // predating it carry none. Same dedup-string rule as active ids: the
  // writer (QuestSystem.onFlag -> markQuestFlag) dedups at the seam, so
  // a duplicated flag id is unproducible.
  if (value.questFlags !== undefined) {
    if (
      !Array.isArray(value.questFlags) ||
      value.questFlags.length > ID_COLLECTION_CAP ||
      !value.questFlags.every((id) => typeof id === 'string') ||
      new Set(value.questFlags).size !== value.questFlags.length
    ) {
      issues.push({ path: `${path}.questFlags`, message: 'phải là string[] không trùng lặp trong ID_COLLECTION_CAP' })
    }
  }

  if (!isNonNegativeBoundedTimestamp(value.lastDailyResetAtMs)) {
    issues.push({ path: `${path}.lastDailyResetAtMs`, message: 'phải là timestamp không âm trong miền |x| < 2^52' })
  }
}

// Mission A1 - BuildingSystem reads level/lastCollectedAt directly for
// stored-amount math; a non-numeric level used to pass the gate and
// produce NaN rates. Shape-only: maxLevel bounds stay with the building
// catalog (this file does not check gameplay values).
function validateBuildingsSave(
  entries: unknown[],
  path: string,
  issues: ShapeIssue[],
  playerRealmIndex?: number,
  claimedRealmTier?: number,
): void {
  // F-BLD-DUP-1: instanceId comes from crypto.randomUUID() when an
  // instance is created - a duplicate is unproducible and breaks
  // first-match get()/remove() consumers. buildingId duplicates are
  // unproducible for 'crafting_station' templates (a second instance is
  // never created once one exists); resource categories may
  // legitimately hold several instances.
  const seenInstanceIds = new Set<string>()
  const seenSingleInstanceBuildingIds = new Set<string>()

  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i]
    const entryPath = `${path}[${i}]`

    if (
      !isObject(entry) ||
      typeof entry.instanceId !== 'string' ||
      typeof entry.buildingId !== 'string' ||
      !Number.isInteger(entry.level) ||
      (entry.level as number) < 1 ||
      !isNonNegativeBoundedTimestamp(entry.lastCollectedAt)
    ) {
      issues.push({ path: entryPath, message: 'building sai shape' })
      continue
    }

    if (seenInstanceIds.has(entry.instanceId)) {
      issues.push({ path: `${entryPath}.instanceId`, message: 'bị trùng với building entry khác' })
    } else {
      seenInstanceIds.add(entry.instanceId)
    }

    // F-A8-2: level is writer-bounded by the template's maxLevel -
    // upgrade() refuses beyond it, so a higher persisted level is
    // forged accrual magnitude.
    const template = buildings.find((building) => building.id === entry.buildingId)

    if (template !== undefined && template.category === 'crafting_station') {
      if (seenSingleInstanceBuildingIds.has(entry.buildingId)) {
        issues.push({
          path: `${entryPath}.buildingId`,
          message: 'crafting_station chỉ có 1 instance (already_built)',
        })
      } else {
        seenSingleInstanceBuildingIds.add(entry.buildingId)
      }
    }
    if (template !== undefined && (entry.level as number) > template.maxLevel) {
      issues.push({
        path: `${entryPath}.level`,
        message: `level vượt maxLevel authored (${template.maxLevel})`,
      })
    }

    // F-SCOPE-3: upgrade() rejects target levels above the player's
    // realm tier (getRealmTier(currentRealmId) < level + 1) - a
    // persisted level beyond the tier of the claimed realm is
    // unproducible.
    if (claimedRealmTier !== undefined && (entry.level as number) > claimedRealmTier) {
      issues.push({
        path: `${entryPath}.level`,
        message: `level vượt realm tier người chơi (${claimedRealmTier})`,
      })
    }

    // F-TC5-1: the accrual realm pin is only ever written from
    // player.realmId at build/claim time, so a pin above the player's
    // own realm (or an unknown realm) is a forged accrual window -
    // same provable-forgery class as the modifier claims.
    if (entry.accrualRealmId !== undefined) {
      const pinIndex =
        typeof entry.accrualRealmId === 'string' ? getRealmIndex(entry.accrualRealmId) : -1

      if (pinIndex < 0 || (playerRealmIndex !== undefined && pinIndex > playerRealmIndex)) {
        issues.push({
          path: `${entryPath}.accrualRealmId`,
          message: `accrual realm pin vượt quá realm người chơi (${String(entry.accrualRealmId)})`,
        })
      }
    }
  }
}

// Mission A1 - ProductionCycle: every timestamp/seed feeds settle/tick
// math; a non-finite completesAtMs used to pass the gate and run one
// cycle per tick forever.
function validateProductionCycleSave(
  value: unknown,
  path: string,
  issues: ShapeIssue[],
  playerRealmIndex?: number,
  siteMaxLevel?: number,
  lastSavedAt?: number,
  siteCurrentLevel?: number,
): void {
  if (
    !isObject(value) ||
    typeof value.cycleId !== 'string' ||
    typeof value.siteId !== 'string' ||
    typeof value.collectionRealmId !== 'string' ||
    !isFiniteNumber(value.siteLevelAtStart) ||
    !isFiniteNumber(value.rewardTableVersion) ||
    !isFiniteNumber(value.rollSeed) ||
    !isBoundedTimestamp(value.startedAtMs) ||
    !isBoundedTimestamp(value.completesAtMs)
  ) {
    issues.push({ path, message: 'production cycle sai shape' })
    return
  }

  // F-ROLLSEED-RANGE: the mint rolls Math.floor(Math.random() *
  // 0x7fffffff) at cycle spawn - anything outside the integer bound is
  // a forged window feeding reward-table replay.
  if (
    !Number.isInteger(value.rollSeed) ||
    (value.rollSeed as number) < 0 ||
    (value.rollSeed as number) > 0x7fffffff
  ) {
    issues.push({
      path: `${path}.rollSeed`,
      message: 'rollSeed phải là integer trong [0, 0x7fffffff] (khoảng mint)',
    })
  }

  // F-TC5-1 (sibling): the collection realm snapshot is only ever
  // written from the player's realm at cycle start - a pin above the
  // player's realm (or an unknown realm) is a forged window feeding
  // settle-tier math.
  const cycleRealmIndex = getRealmIndex(value.collectionRealmId)

  if (cycleRealmIndex < 0 || (playerRealmIndex !== undefined && cycleRealmIndex > playerRealmIndex)) {
    issues.push({
      path: `${path}.collectionRealmId`,
      message: `collection realm pin vượt quá realm người chơi (${value.collectionRealmId})`,
    })
  }

  // F-A11-4: a spawned lane snapshots completesAtMs = startedAtMs +
  // cycleMs and siteLevelAtStart = state.level <= maxLevel - a
  // reversed span or an over-ceiling level claim is a forged reward
  // window.
  if ((value.completesAtMs as number) <= (value.startedAtMs as number)) {
    issues.push({
      path: `${path}.completesAtMs`,
      message: 'phải sau startedAtMs (writer luôn stamp start + cycleMs)',
    })
  }

  if (siteMaxLevel !== undefined && (value.siteLevelAtStart as number) > siteMaxLevel) {
    issues.push({
      path: `${path}.siteLevelAtStart`,
      message: `vượt maxLevel authored (${siteMaxLevel})`,
    })
  }

  // F-SCOPE-4: the lane writer stamps siteLevelAtStart = state.level
  // at spawn and site level only ever increments (upgradeSite) - an
  // integer outside [1, site.level] is a forged settle window.
  if (
    siteCurrentLevel !== undefined &&
    (!Number.isInteger(value.siteLevelAtStart) ||
      (value.siteLevelAtStart as number) < 1 ||
      (value.siteLevelAtStart as number) > siteCurrentLevel)
  ) {
    issues.push({
      path: `${path}.siteLevelAtStart`,
      message: `ngoài khoảng authored [1, level site hiện tại = ${siteCurrentLevel}]`,
    })
  }

  // F-TC10-WC: the span itself is the authored recipe - the sole writer
  // stamps completesAtMs = startedAtMs + computeCycleSeconds(base,
  // level)*1000 and never mutates it afterward, so a mismatched span is
  // a fabricated reward window (shorter mints faster free settles).
  const cycleBaseSeconds = CYCLE_BASE_SECONDS_BY_REALM[value.collectionRealmId]
  if (cycleBaseSeconds !== undefined) {
    const expectedSpanMs =
      computeCycleSeconds(cycleBaseSeconds, value.siteLevelAtStart as number) * 1000

    if ((value.completesAtMs as number) - (value.startedAtMs as number) !== expectedSpanMs) {
      issues.push({
        path: `${path}.completesAtMs`,
        message: `span không khớp authored cycle window (${expectedSpanMs}ms)`,
      })
    }
  }

  // F-TC10-WC (sibling): a cycle started after the save timestamp could
  // not have been persisted by a legal path.
  if (lastSavedAt !== undefined && (value.startedAtMs as number) > lastSavedAt) {
    issues.push({
      path: `${path}.startedAtMs`,
      message: 'startedAtMs vượt lastSavedAt (cycle bắt đầu sau save là bất khả thi)',
    })
  }
}

function validateProductionSitesSave(
  entries: unknown[],
  path: string,
  issues: ShapeIssue[],
  playerRealmIndex?: number,
  playerLastSavedAt?: number,
  claimedRealmTier?: number,
  claimedWorkerCapacity?: number,
): void {
  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i]
    const entryPath = `${path}[${i}]`

    if (
      !isObject(entry) ||
      typeof entry.siteId !== 'string' ||
      !Number.isInteger(entry.level) ||
      (entry.level as number) < 1 ||
      typeof entry.autoRestart !== 'boolean'
    ) {
      issues.push({ path: entryPath, message: 'production site sai shape' })

      continue
    }

    // F-A8-2: same writer bound as building level - upgradeSite
    // refuses beyond the site definition's maxLevel.
    const siteDefinition = THANH_VAN_PRODUCTION_SITES.find(
      (site) => site.siteId === entry.siteId,
    )
    if (siteDefinition !== undefined && (entry.level as number) > siteDefinition.maxLevel) {
      issues.push({
        path: `${entryPath}.level`,
        message: `level vượt maxLevel authored (${siteDefinition.maxLevel})`,
      })
    }

    // F-SCOPE-3: upgradeSite rejects target levels above the player's
    // realm tier (currentRealmTier < targetLevel) - a persisted level
    // beyond the tier of the claimed realm is unproducible.
    if (claimedRealmTier !== undefined && (entry.level as number) > claimedRealmTier) {
      issues.push({
        path: `${entryPath}.level`,
        message: `level vượt realm tier người chơi (${claimedRealmTier})`,
      })
    }

    if (
      entry.assignedWorkers !== undefined &&
      (!Number.isInteger(entry.assignedWorkers) || (entry.assignedWorkers as number) < 0)
    ) {
      issues.push({ path: `${entryPath}.assignedWorkers`, message: 'phải là int không âm' })
    }

    // M-F-BODY-HIDDEN (save v81): optional per-site grotto-channel
    // settle-cycle counters - same map shape as the player field.
    if (entry.hiddenChannelCycles !== undefined) {
      validateNonNegativeIntMap(
        entry.hiddenChannelCycles,
        `${entryPath}.hiddenChannelCycles`,
        issues,
      )
    }

    // Mission D (spec D3): `activeCycle` was removed from the state
    // shape (workers-as-fuel; workerCycles is the only cycle kind).
    // A stale `activeCycle` key in an old-shaped payload is tolerated
    // here and whitelisted out at restoreStates - it is NOT validated or
    // rejected (dev phase, no migration).

    if (entry.workerCycles !== undefined) {
      if (!Array.isArray(entry.workerCycles)) {
        issues.push({ path: `${entryPath}.workerCycles`, message: 'phải là array' })
      } else {
        // F-WC-LANES (rebounds F-A11-4): lane count can never exceed the
        // producible worker pool. While manualWorkforce is scope-hidden
        // every capacity consumer reads the flat auto pool via
        // betaEffectiveWorkerCapacity (BETA_BASELINE_WORKER_CAPACITY =
        // one lane per Thanh Van site) - the authored chi_hien_quan
        // ceiling is unreachable, so a site holding more in-flight lanes
        // than the effective pool mints free settles.
        const maxLanes = betaEffectiveWorkerCapacity(claimedWorkerCapacity ?? 0)

        if (entry.workerCycles.length > maxLanes) {
          issues.push({
            path: `${entryPath}.workerCycles`,
            message: `vượt authored lane ceiling (${maxLanes})`,
          })
        }

        for (let j = 0; j < entry.workerCycles.length; j += 1) {
          validateProductionCycleSave(
            entry.workerCycles[j],
            `${entryPath}.workerCycles[${j}]`,
            issues,
            playerRealmIndex,
            siteDefinition?.maxLevel,
            playerLastSavedAt,
            entry.level as number,
          )

          if (
            isObject(entry.workerCycles[j]) &&
            (entry.workerCycles[j] as Record<string, unknown>).siteId !== undefined &&
            (entry.workerCycles[j] as Record<string, unknown>).siteId !== entry.siteId
          ) {
            issues.push({
              path: `${entryPath}.workerCycles[${j}].siteId`,
              message: 'phải khớp siteId của site cha',
            })
          }
        }
      }
    }
  }
}

// Mission A1 - AlchemySystem.restoreJobs feeds these into settle/tick;
// a missing id or non-finite deadline must fail the boundary.
function validateAlchemyJobsSave(
  entries: unknown[],
  path: string,
  issues: ShapeIssue[],
  pillRoomLevel: number,
  playerLastSavedAt?: number,
): void {
  // F-ALCH-JOBID-DUP: startJob mints a unique jobId per reservation, so
  // two persisted jobs sharing one id can only be a replayed record -
  // settle would deliver the same pill twice for one burned input set.
  const seenJobIds = new Set<string>()

  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i]
    const entryPath = `${path}[${i}]`

    if (
      !isObject(entry) ||
      typeof entry.jobId !== 'string' ||
      typeof entry.recipeId !== 'string' ||
      typeof entry.pillId !== 'string' ||
      typeof entry.herbMaterialId !== 'string' ||
      !isBoundedTimestamp(entry.startedAtMs) ||
      !isBoundedTimestamp(entry.completesAtMs) ||
      !isFiniteNumber(entry.roomLevelAtStart)
    ) {
      issues.push({ path: entryPath, message: 'alchemy job sai shape' })
      continue
    }

    if (seenJobIds.has(entry.jobId as string)) {
      issues.push({
        path: `${entryPath}.jobId`,
        message: 'jobId trùng - startJob mint id duy nhất, record replay là bất khả thi',
      })
    } else {
      seenJobIds.add(entry.jobId as string)
    }

    // F-TC9-3: jobSuccessPercent reads roomLevelAtStart verbatim into
    // the authored success table, and building level never decreases -
    // a claim above the persisted pill_room level is a forged success
    // rate that settles real pills on every tick.
    if ((entry.roomLevelAtStart as number) > pillRoomLevel) {
      issues.push({
        path: `${entryPath}.roomLevelAtStart`,
        message: `roomLevelAtStart vượt level pill_room hiện tại (${pillRoomLevel})`,
      })
    }

    // F-A11-5: the only writer stamps completesAtMs = startedAtMs +
    // duration - a reversed span is a malformed claim that settles
    // free pills on restore.
    if ((entry.completesAtMs as number) <= (entry.startedAtMs as number)) {
      issues.push({
        path: `${entryPath}.completesAtMs`,
        message: 'phải sau startedAtMs (writer luôn stamp start + duration)',
      })
    }

    // F-A7-3: pillId is denormalized from the authored recipe at
    // startJob - a persisted pillId that disagrees with the recipe is a
    // fabricated claim (forged dormant pill delivery).
    const recipe = alchemyRecipes.find((candidate) => candidate.id === entry.recipeId)

    if (recipe !== undefined && recipe.pillId !== entry.pillId) {
      issues.push({
        path: `${entryPath}.pillId`,
        message: `pillId không khớp recipe (${entry.pillId} != ${recipe.pillId})`,
      })
    }

    // F-A11-5 (sibling): startJob reserves the herb variant at launch
    // - a materialId outside recipe.herbVariants can never have been
    // reserved, so the job could not have been started by any writer.
    if (
      recipe !== undefined &&
      !recipe.herbVariants.some((variant) => variant.materialId === entry.herbMaterialId)
    ) {
      issues.push({
        path: `${entryPath}.herbMaterialId`,
        message: 'herbMaterialId không thuộc herbVariants của recipe',
      })
    }

    // F-A12-4: the span is the authored recipe - startJob stamps
    // completesAtMs = startedAtMs + alchemySecondsFor(recipe,
    // roomLevelAtStart)*1000, so a mismatched span is a fabricated
    // delivery window (shorter mints pills faster than authored).
    if (recipe !== undefined) {
      const expectedSpanMs =
        alchemySecondsFor(recipe, entry.roomLevelAtStart as number) * 1000

      if ((entry.completesAtMs as number) - (entry.startedAtMs as number) !== expectedSpanMs) {
        issues.push({
          path: `${entryPath}.completesAtMs`,
          message: `span không khớp authored duration (${expectedSpanMs}ms)`,
        })
      }
    }

    // F-A12-4 (sibling): a job started after the save timestamp could
    // not have been persisted by a legal path.
    if (playerLastSavedAt !== undefined && (entry.startedAtMs as number) > playerLastSavedAt) {
      issues.push({
        path: `${entryPath}.startedAtMs`,
        message: 'startedAtMs vượt lastSavedAt (job bắt đầu sau save là bất khả thi)',
      })
    }

    // F-ALCH-JOB-FORGE: a persisted job must carry the reservation
    // witness startJob stamps when it burns the inputs. The verifier
    // replays the digest (recipe-independent - it binds the job
    // identity + every reserved input atomically), the cost scale
    // against the authored producible set, and every reserved amount
    // against this save's own recipe. A fabricated finished job that
    // never paid inputs cannot produce the witness and is rejected
    // here instead of settling the pill for free on restore.
    const reservation = entry.reservation

    if (!isObject(reservation)) {
      issues.push({
        path: `${entryPath}.reservation`,
        message: 'thiếu reservation witness (job chưa reserve là bất khả thi)',
      })
    } else {
      const badField = verifyAlchemyJobReservation(
        entry as unknown as ActiveAlchemyJob,
        recipe,
        ALCHEMY_JOB_PRODUCIBLE_COST_SCALES,
      )

      if (badField !== null) {
        issues.push({
          path: `${entryPath}.reservation.${badField}`,
          message: 'reservation witness không replay được (startJob chưa reserve)',
        })
      }
    }
  }
}

interface EquipmentEntriesValidation {
  normalizedEntries: unknown[]

  discardedCount: number
}

function requireNonEmptyString(
  target: Record<string, unknown>,
  key: string,
  path: string,
  issues: ShapeIssue[],
) {
  const value = target[key]

  if (typeof value !== 'string' || value.trim().length === 0) {
    issues.push({ path: `${path}.${key}`, message: 'phải là string không rỗng' })
  }
}

function validateStringEntries(entries: unknown[], path: string, issues: ShapeIssue[]) {
  for (let i = 0; i < entries.length; i += 1) {
    if (typeof entries[i] !== 'string') {
      issues.push({ path: `${path}[${i}]`, message: 'phải là string' })
    }
  }
}

// StatModifier element check - `stat` only needs to be a non-empty
// string, NOT a STAT_TYPES member: the boundary accepts the shape and
// restore drops modifiers whose key is not a current StatType
// (dev-stage rule: drop, never translate).
function validateStatModifierEntries(entries: unknown[], path: string, issues: ShapeIssue[]) {
  for (let i = 0; i < entries.length; i += 1) {
    const modifier = entries[i]
    const modifierPath = `${path}[${i}]`

    if (!isObject(modifier)) {
      issues.push({ path: modifierPath, message: 'phải là object' })
      continue
    }

    requireNonEmptyString(modifier, 'id', modifierPath, issues)
    requireNonEmptyString(modifier, 'sourceId', modifierPath, issues)
    requireNonEmptyString(modifier, 'sourceType', modifierPath, issues)
    requireNonEmptyString(modifier, 'stat', modifierPath, issues)

    for (const field of STAT_MODIFIER_NUMERIC_FIELDS) {
      if (modifier[field] !== undefined && !isFiniteNumber(modifier[field])) {
        issues.push({
          path: `${modifierPath}.${field}`,
          message: 'phải là số hữu hạn hoặc vắng mặt',
        })
      }
    }
  }
}

function validateEquipmentEntries(
  entries: unknown[],
  path: string,
  issues: ShapeIssue[],
  playerRealmId: string | undefined,
): EquipmentEntriesValidation {
  const normalizedEntries: unknown[] = []
  let discardedCount = 0
  let unprotectedCount = 0
  let protectedCount = 0

  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i]

    if (!isObject(entry)) {
      issues.push({ path: `${path}[${i}]`, message: 'phải là object' })

      continue
    }

    // Development build khong migrate item schema cu. Chi rieng entry
    // legacy co realmId/rarity duoc bo co chu dich; phan save
    // con lai van nap duoc. Kiem tra marker TRUOC cac field
    // schema moi de entry cu khong bi bien thanh loi toan save.
    // r30-COR-Nit-1: the discard runs BEFORE the cap counters - a legacy
    // entry is dropped at restore and must not count toward either cap.
    if ('realmId' in entry || 'rarity' in entry) {
      discardedCount += 1
      continue
    }

    // F-EQ-COUNT-1: add() auto-dissolves overflow above the soft cap, so
    // a produced bag holds at most EQUIPMENT_BAG_SOFT_CAP entries that
    // are not equipped/locked/favorite. Beyond that the payload is
    // unproducible - and restore re-feeds every entry through add(),
    // minting essence per dissolved forged item.
    if (entry.equipped !== true && entry.locked !== true && entry.favorite !== true) {
      unprotectedCount += 1
    }

    // Ruling D-02: setProtected() refuses the 11th protected item, so a
    // produced bag holds at most EQUIPMENT_PROTECTION_CAP locked-or-
    // favorite entries. Beyond that the payload is unproducible.
    if (entry.locked === true || entry.favorite === true) {
      protectedCount += 1
    }

    normalizedEntries.push(entry)

    // instanceId trung trong save la vector nhan ban trang bi + double
    // stat modifier (review 2026-08-28 bug #1c) - id phai ton tai de
    // EquipmentBag dedupe duoc.
    requireString(entry, 'instanceId', `${path}[${i}]`, issues)
    requireString(entry, 'itemId', `${path}[${i}]`, issues)

    // F-EQ-REALMLEVEL: the writer stamps realmLevel as a positive int
    // on the entry (roll provenance); zoneId/icon are optional string
    // labels. A present-but-wrong-typed value is unproducible.
    if (
      entry.realmLevel !== undefined &&
      (!Number.isInteger(entry.realmLevel) || (entry.realmLevel as number) < 1)
    ) {
      issues.push({
        path: `${path}[${i}].realmLevel`,
        message: 'phải là số nguyên >= 1 hoặc vắng mặt',
      })
    }
    if (entry.zoneId !== undefined && typeof entry.zoneId !== 'string') {
      issues.push({ path: `${path}[${i}].zoneId`, message: 'phải là string hoặc vắng mặt' })
    }
    if (entry.icon !== undefined && typeof entry.icon !== 'string') {
      issues.push({ path: `${path}[${i}].icon`, message: 'phải là string hoặc vắng mặt' })
    }

    // refreshModifiers (EquipmentSystem.applyModifiers) doc truc tiep cac
    // field nay khi boot. Thieu/sai shape se gay TypeError hoac NaN
    // lan sang modifier, nen entry schema hien hanh phai fail toan save.
    if (!isEquipmentSlot(entry.slot)) {
      issues.push({
        path: `${path}[${i}].slot`,
        message: 'phải thuộc EQUIPMENT_SLOTS',
      })
    }

    // F-EQ-FOREIGN-SLOT: the item template declares exactly one authored
    // slot - a weapon claimed in 'helmet' occupies a slot no writer
    // could place it in and still mints its modifiers from there.
    const equipmentTemplateForSlot = equipment.find((item) => item.id === entry.itemId)
    if (
      equipmentTemplateForSlot !== undefined &&
      isEquipmentSlot(entry.slot) &&
      entry.slot !== equipmentTemplateForSlot.slot
    ) {
      issues.push({
        path: `${path}[${i}].slot`,
        message: `slot ngoài authored slot của template (${equipmentTemplateForSlot.slot})`,
      })
    }

    requireBoolean(entry, 'equipped', `${path}[${i}]`, issues)

    // r30-AUT-2: locked/favorite are optional but must be boolean when
    // present - a truthy non-boolean ('yes') validates clean, restores
    // verbatim into EquipmentBag, and reads protected to every consumer
    // (dissolve/wash/refine guards, auto-dissolve exclusion), wedging
    // the equipment channel behind crafted flags.
    if (entry.locked !== undefined && typeof entry.locked !== 'boolean') {
      issues.push({ path: `${path}[${i}].locked`, message: 'phải là boolean khi khai báo' })
    }
    if (entry.favorite !== undefined && typeof entry.favorite !== 'boolean') {
      issues.push({ path: `${path}[${i}].favorite`, message: 'phải là boolean khi khai báo' })
    }

    // F-SCOPE-EQ-1: equipped:true is a writer-gated claim - equip()
    // enforces canUseItemGrade and every tribulation transition
    // unequips all gear, so an equipped item whose grade cannot be
    // produced at the claimed realm is a fabricated claim (e.g.
    // bat_pham equipped at foundation_establishment). Uneqipped
    // records of any authored grade stay loadable.
    if (
      entry.equipped === true &&
      isProfessionGrade(entry.grade) &&
      typeof playerRealmId === 'string' &&
      isAuthoredRealmId(playerRealmId) &&
      !producibleEquippedGrades(playerRealmId).has(entry.grade)
    ) {
      issues.push({
        path: `${path}[${i}].equipped`,
        message: 'phẩm trang bị bất khả thi tại cảnh giới đã claim',
      })
    }

    if (!isProfessionGrade(entry.grade)) {
      issues.push({
        path: `${path}[${i}].grade`,
        message: 'phải là ProfessionGrade hợp lệ',
      })
    }

    if (!isItemQuality(entry.quality)) {
      issues.push({
        path: `${path}[${i}].quality`,
        message: 'phải thuộc ITEM_QUALITY_ORDER',
      })
    }

    if (!isObject(entry.mainStat)) {
      issues.push({ path: `${path}[${i}].mainStat`, message: 'phải là object' })
    } else {
      const mainStatPath = `${path}[${i}].mainStat`

      requireNonEmptyString(entry.mainStat, 'id', mainStatPath, issues)
      requireNonEmptyString(entry.mainStat, 'sourceId', mainStatPath, issues)

      if (entry.mainStat.sourceType !== 'equipment') {
        issues.push({
          path: `${mainStatPath}.sourceType`,
          message: 'phải là equipment',
        })
      }

      if (
        typeof entry.mainStat.stat !== 'string' ||
        !STAT_TYPES.has(entry.mainStat.stat)
      ) {
        issues.push({
          path: `${mainStatPath}.stat`,
          message: 'phải là StatType hợp lệ',
        })
      }

      if (entry.mainStat.tag !== undefined && typeof entry.mainStat.tag !== 'string') {
        issues.push({ path: `${mainStatPath}.tag`, message: 'phải là string hoặc vắng mặt' })
      }

      for (const field of STAT_MODIFIER_NUMERIC_FIELDS) {
        if (entry.mainStat[field] !== undefined && !isFiniteNumber(entry.mainStat[field])) {
          issues.push({
            path: `${mainStatPath}.${field}`,
            message: 'phải là số hữu hạn hoặc vắng mặt',
          })
        }
      }

      // Writer-shape bound: rollMainStat emits flat-only, rolled inside
      // the template's authored stat range times the quality implicit
      // multiplier and the realm scale of the item's grade realm. A
      // persisted flat above that bound (or a percent/multiplier the
      // writer never emits) is an impossible claim.
      const equipmentTemplate = equipment.find((item) => item.id === entry.itemId)
      if (
        equipmentTemplate !== undefined &&
        isProfessionGrade(entry.grade) &&
        isItemQuality(entry.quality) &&
        typeof entry.mainStat.stat === 'string'
      ) {
        const claimedStat = entry.mainStat.stat
        const statRange = equipmentTemplate.mainStats.find(
          (candidate) => candidate.stat === claimedStat,
        )
        if (statRange === undefined) {
          issues.push({
            path: `${mainStatPath}.stat`,
            message: 'main stat ngoài authored range của template',
          })
        } else {
          const gradeRealmId = getRealmIdForProfessionGrade(entry.grade)
          // rollMainStat scales the roll by the PLAYER's realmLevel
          // (capped by the realmLevel bound above), not the grade
          // realm's - the bound therefore takes the player's own
          // realm maxLevel plus the grade realm's prior-realm sum.
          const playerRealm = REALMS.find((realm) => realm.id === playerRealmId)
          const levelBound = getGlobalCultivationLevel(
            gradeRealmId ?? 'mortal',
            playerRealm?.maxLevel ?? 1,
          )
          const maxFlat =
            statRange.max *
            ITEM_QUALITY_IMPLICIT_MULTIPLIER[entry.quality] *
            (1 + levelBound * MAIN_STAT_REALM_SCALE)
          if (isFiniteNumber(entry.mainStat.flat) && (entry.mainStat.flat as number) > maxFlat) {
            issues.push({
              path: `${mainStatPath}.flat`,
              message: `vượt authored roll bound (${maxFlat})`,
            })
          }
          if (
            (isFiniteNumber(entry.mainStat.percent) && (entry.mainStat.percent as number) !== 0) ||
            (isFiniteNumber(entry.mainStat.multiplier) && (entry.mainStat.multiplier as number) !== 1)
          ) {
            issues.push({
              path: mainStatPath,
              message: 'rollMainStat chỉ emit flat - percent/multiplier không authored',
            })
          }
        }
      }
    }

    const equipmentAffixes = requireArray(entry, 'affixes', `${path}[${i}]`, issues)

    if (equipmentAffixes) {
      // F-TC8-11: the roller caps at GLOBAL_MAX_AFFIXES and never rolls
      // a slotted affix onto a slot its template excludes - both are
      // hard authored bounds a persisted entry cannot exceed.
      if (equipmentAffixes.length > GLOBAL_MAX_AFFIXES) {
        issues.push({
          path: `${path}[${i}].affixes`,
          message: `vượt GLOBAL_MAX_AFFIXES (${GLOBAL_MAX_AFFIXES})`,
        })
      }

      // F-EQ-AFFIX-ENVELOPE: the roller draws at most
      // ITEM_QUALITY_SUBSTATS_RANGE[quality].max base affixes (plus one
      // chance-gated 'supreme' exalted on tien), each at a tier
      // <= ITEM_QUALITY_AFFIX_TIER[quality] from a pool in
      // ITEM_QUALITY_UNLOCKED_POOLS[quality]. Claims beyond that
      // envelope mint modifiers no roll produces.
      if (isItemQuality(entry.quality)) {
        const qualityAffixCeiling =
          ITEM_QUALITY_SUBSTATS_RANGE[entry.quality].max + (entry.quality === 'tien' ? 1 : 0)
        if (equipmentAffixes.length > qualityAffixCeiling) {
          issues.push({
            path: `${path}[${i}].affixes`,
            message: `vượt authored substat ceiling của quality ${entry.quality} (${qualityAffixCeiling})`,
          })
        }
      }

      // F-EQ-AFFIX-DUP + F-EQ-AFFIX-MAINSTAT-OVERLAP: rollAffixes seeds
      // excludeStats with the item's main stat and pushes every rolled
      // stat - a persisted entry can never repeat a stat across its
      // affixes nor restate the main stat.
      const seenAffixStats = new Set<string>()
      const claimedMainStat =
        isObject(entry.mainStat) && typeof entry.mainStat.stat === 'string'
          ? entry.mainStat.stat
          : undefined
      if (claimedMainStat !== undefined) {
        seenAffixStats.add(claimedMainStat)
      }

      for (let affixIndex = 0; affixIndex < equipmentAffixes.length; affixIndex += 1) {
        const affix = equipmentAffixes[affixIndex]
        const affixPath = `${path}[${i}].affixes[${affixIndex}]`

        if (!isObject(affix)) {
          issues.push({ path: affixPath, message: 'phải là object' })
          continue
        }
        requireNonEmptyString(affix, 'affixId', affixPath, issues)

        if (!isFiniteNumber(affix.tier) || !Number.isInteger(affix.tier) || affix.tier <= 0) {
          issues.push({
            path: `${affixPath}.tier`,
            message: 'phải là số nguyên dương hữu hạn',
          })
        }

        if (!isFiniteNumber(affix.value)) {
          issues.push({ path: `${affixPath}.value`, message: 'phải là số hữu hạn' })
        }

        const affixDefinition =
          typeof affix.affixId === 'string'
            ? affixes.find((candidate) => candidate.id === affix.affixId)
            : undefined
        if (
          affixDefinition !== undefined &&
          affixDefinition.slots !== undefined &&
          isEquipmentSlot(entry.slot) &&
          !affixDefinition.slots.includes(entry.slot)
        ) {
          issues.push({
            path: affixPath,
            message: `affix không roll được trên slot ${String(entry.slot)}`,
          })
        }

        if (affixDefinition !== undefined) {
          // F-EQ-AFFIX-SLOT: the roller's candidate filter also applies
          // the stat-vs-slot policy (isValidEquipmentSubstat) even when
          // the affix declares no explicit slots list - a stat the slot
          // forbids mints from a claim the roller could never emit.
          if (isEquipmentSlot(entry.slot) && !isValidEquipmentSubstat(entry.slot, affixDefinition.stat)) {
            issues.push({
              path: affixPath,
              message: `stat '${affixDefinition.stat}' không thuộc substat policy của slot ${String(entry.slot)}`,
            })
          }

          // F-EQ-AFFIX-ENVELOPE: tier must exist on the affix and stay
          // at-or-below the quality cap; pool must be unlocked by the
          // quality. The roller's filters are the authored producers.
          if (isItemQuality(entry.quality)) {
            if (!ITEM_QUALITY_UNLOCKED_POOLS[entry.quality].includes(affixDefinition.pool)) {
              issues.push({
                path: affixPath,
                message: `pool '${affixDefinition.pool}' quality ${entry.quality} chưa mở`,
              })
            }
            if (
              isFiniteNumber(affix.tier) &&
              (affix.tier as number) > ITEM_QUALITY_AFFIX_TIER[entry.quality]
            ) {
              issues.push({
                path: `${affixPath}.tier`,
                message: `vượt authored tier cap của quality ${entry.quality} (${ITEM_QUALITY_AFFIX_TIER[entry.quality]})`,
              })
            }
          }
          if (
            isFiniteNumber(affix.tier) &&
            !affixDefinition.tiers.some((tierDef) => tierDef.tier === affix.tier)
          ) {
            issues.push({
              path: `${affixPath}.tier`,
              message: 'tier không tồn tại trong authored tiers của affix',
            })
          }

          // Stat-uniqueness bound (see the seenAffixStats comment above).
          if (seenAffixStats.has(affixDefinition.stat)) {
            issues.push({
              path: affixPath,
              message: `stat '${affixDefinition.stat}' trùng main stat hoặc affix khác - roller không bao giờ emit`,
            })
          } else {
            seenAffixStats.add(affixDefinition.stat)
          }
        }
      }
    }

    requireNonNegativeNumber(entry, 'forgeUsesTotal', `${path}[${i}]`, issues)
    requireNonNegativeNumber(entry, 'forgeUsesRemaining', `${path}[${i}]`, issues)

    if (
      isNonNegativeFiniteNumber(entry.forgeUsesTotal) &&
      isNonNegativeFiniteNumber(entry.forgeUsesRemaining) &&
      entry.forgeUsesRemaining > entry.forgeUsesTotal
    ) {
      issues.push({
        path: `${path}[${i}].forgeUsesRemaining`,
        message: 'không được vượt forgeUsesTotal',
      })
    }

    // F-FORGE-TOTAL: the writer stamps forgeUsesTotal = the authored
    // ITEM_QUALITY_FORGE_USES[quality] at roll time and only ever
    // decrements forgeUsesRemaining - a persisted total off the
    // authored budget is a fabricated forge allowance.
    if (
      isItemQuality(entry.quality) &&
      isNonNegativeFiniteNumber(entry.forgeUsesTotal) &&
      entry.forgeUsesTotal !== ITEM_QUALITY_FORGE_USES[entry.quality]
    ) {
      issues.push({
        path: `${path}[${i}].forgeUsesTotal`,
        message: `không khớp authored forge budget của quality ${entry.quality} (${ITEM_QUALITY_FORGE_USES[entry.quality]})`,
      })
    }
  }

  if (unprotectedCount > EQUIPMENT_BAG_SOFT_CAP) {
    issues.push({
      path,
      message: `unprotected equipment vượt EQUIPMENT_BAG_SOFT_CAP (${EQUIPMENT_BAG_SOFT_CAP})`,
    })
  }

  if (protectedCount > EQUIPMENT_PROTECTION_CAP) {
    issues.push({
      path,
      message: `protected equipment (locked/favorite) vượt EQUIPMENT_PROTECTION_CAP (${EQUIPMENT_PROTECTION_CAP})`,
    })
  }

  return { normalizedEntries, discardedCount }
}

/**
 * Phan tu equipmentSlots - EquipmentSlotManager.restore ghi de mu quang
 * theo entry.slot; thieu enhanceLevel thi calculateEquipmentScale nhan
 * undefined -> NaN lay sang moi trang bi dang deo o slot do.
 */
function validateEquipmentSlotEntries(
  entries: unknown[],
  path: string,
  issues: ShapeIssue[],
  claimedRealmTier?: number,
): unknown[] {
  const normalizedEntries: unknown[] = []

  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i]

    if (!isObject(entry)) {
      issues.push({ path: `${path}[${i}]`, message: 'phải là object' })

      continue
    }

    if (!isEquipmentSlot(entry.slot)) {
      issues.push({
        path: `${path}[${i}].slot`,
        message: 'phải thuộc EQUIPMENT_SLOTS',
      })
    }
    requireNonNegativeNumber(entry, 'enhanceLevel', `${path}[${i}]`, issues)
    // Enhance writes cap at MAX_SLOT_ENHANCE_LEVEL - a persisted level
    // above it is an impossible claim, not drift.
    if (
      isNonNegativeFiniteNumber(entry.enhanceLevel) &&
      (entry.enhanceLevel as number) > MAX_SLOT_ENHANCE_LEVEL
    ) {
      issues.push({
        path: `${path}[${i}].enhanceLevel`,
        message: `vượt MAX_SLOT_ENHANCE_LEVEL (${MAX_SLOT_ENHANCE_LEVEL})`,
      })
    }

    // F-SCOPE-2: enhancing at level N pays the stone tier of
    // getSpiritStoneMaterialIdForEnhanceLevel(N) - ha-only economies
    // (realm tier < 4) reach at most level 30, trung economies
    // (tier 4-6) reach 60, thuong (tier >= 7) reach the cap. A
    // persisted level past the tier of the claimed realm is
    // unproducible.
    const maxProducibleEnhance =
      claimedRealmTier === undefined
        ? undefined
        : claimedRealmTier >= 7
          ? MAX_SLOT_ENHANCE_LEVEL
          : claimedRealmTier >= 4
            ? 60
            : 30
    if (
      maxProducibleEnhance !== undefined &&
      isNonNegativeFiniteNumber(entry.enhanceLevel) &&
      (entry.enhanceLevel as number) > maxProducibleEnhance
    ) {
      issues.push({
        path: `${path}[${i}].enhanceLevel`,
        message: `vượt trần cường hóa producible theo realm tier (${maxProducibleEnhance})`,
      })
    }

    if (entry.enhanceFailStreak !== undefined) {
      requireNonNegativeNumber(entry, 'enhanceFailStreak', `${path}[${i}]`, issues)
      // F-ENHANCE-STREAK: the only writer increments on failure and
      // resets on success, and the pity threshold makes the next roll
      // succeed - a persisted streak past ENHANCE_PITY_THRESHOLD is
      // unproducible (== threshold IS producible: pity only guarantees
      // the NEXT attempt).
      if (
        isNonNegativeFiniteNumber(entry.enhanceFailStreak) &&
        (entry.enhanceFailStreak as number) > ENHANCE_PITY_THRESHOLD
      ) {
        issues.push({
          path: `${path}[${i}].enhanceFailStreak`,
          message: `vượt ENHANCE_PITY_THRESHOLD (${ENHANCE_PITY_THRESHOLD})`,
        })
      }
    }

    normalizedEntries.push(
      entry.enhanceFailStreak === undefined
        ? { ...entry, enhanceFailStreak: 0 }
        : entry,
    )
  }

  return normalizedEntries
}

function validateGameSaveShapeChecked(parsed: unknown): ShapeValidationResult {
  const issues: ShapeIssue[] = []

  if (!isObject(parsed)) {
    return {
      ok: false,
      issues: [{ path: '', message: 'save không phải object' }],
      discardedEquipmentCount: 0,
    }
  }

  if (parsed.version !== CURRENT_SAVE_VERSION) {
    issues.push({
      path: 'version',
      message: `version phải là ${CURRENT_SAVE_VERSION}`,
    })
  }

  const playerNormalization = validatePlayer(parsed.player, issues)

  const techniques = requireArray(parsed, 'techniques', '', issues)
  const skills = requireArray(parsed, 'skills', '', issues)
  const materials = requireArray(parsed, 'materials', '', issues)
  const equipment = requireArray(parsed, 'equipment', '', issues)
  const pills = requireArray(parsed, 'pills', '', issues)

  const talismans = requireArray(parsed, 'talismans', '', issues)
  const formations = requireArray(parsed, 'formations', '', issues)

  const buildings = requireArray(parsed, 'buildings', '', issues)

  // F-REALM-1: the realm claim is a progression witness - entering
  // qi_refining only happens through an initiation commit that writes
  // grade >= 1 and grants the starter technique, and reaching
  // foundation_establishment only happens through a victory that
  // records highestFoundationAchieved. A realm claim missing its own
  // mandatory receipts is a fabricated profile that mints realm-scaled
  // stats and clears every realm-gated bound.
  if (isObject(parsed.player) && typeof parsed.player.realmId === 'string') {
    const witnessedRealmIndex = getRealmIndex(parsed.player.realmId)

    if (witnessedRealmIndex >= getRealmIndex('qi_refining')) {
      if (Array.isArray(techniques) && techniques.length < 1) {
        issues.push({
          path: 'techniques',
          message: 'realm >= qi_refining nhưng techniques trống (initiation chưa từng commit)',
        })
      }

      if (
        !isFiniteNumber(parsed.player.breakthroughGrade) ||
        (parsed.player.breakthroughGrade as number) < 1
      ) {
        issues.push({
          path: 'player.breakthroughGrade',
          message: 'realm >= qi_refining nhưng grade < 1 (initiation chưa từng commit)',
        })
      }
    }

    if (
      witnessedRealmIndex >= getRealmIndex('foundation_establishment') &&
      parsed.player.highestFoundationAchieved === undefined
    ) {
      issues.push({
        path: 'player.highestFoundationAchieved',
        message: 'realm >= foundation_establishment nhưng thiếu foundation victory record',
      })
    }
  }

  // F-W-16 (v82): restore recomputes autoWorkerCapacity from the chi_hien_quan
  // instance, so a persisted non-zero capacity without that building is
  // always corrupt - fail loud instead of silently clamping on restore.
  if (
    isObject(parsed.player) &&
    isNonNegativeFiniteNumber(parsed.player.autoWorkerCapacity) &&
    (parsed.player.autoWorkerCapacity as number) > 0 &&
    Array.isArray(buildings) &&
    !buildings.some(
      (entry) => isObject(entry) && entry.buildingId === 'chi_hien_quan',
    )
  ) {
    issues.push({
      path: 'player.autoWorkerCapacity',
      message: '> 0 yêu cầu tồn tại instance chi_hien_quan trong buildings',
    })
  }

  const equipmentSlots = requireArray(parsed, 'equipmentSlots', '', issues)

  // Field optional cua GameSave - chi kiem kieu khi hien dien, roi
  // deep-check tung phan tu (Mission A1).
  const productionSites = optionalArray(parsed, 'productionSites', '', issues)
  const alchemyJobs = optionalArray(parsed, 'alchemyJobs', '', issues)

  const playerRealmIndex =
    isObject(parsed.player) && typeof parsed.player.realmId === 'string'
      ? getRealmIndex(parsed.player.realmId)
      : undefined

  const claimedRealmTier =
    isObject(parsed.player) && typeof parsed.player.realmId === 'string'
      ? getRealmTier(parsed.player.realmId)
      : undefined

  if (productionSites) {
    validateProductionSitesSave(
      productionSites,
      'productionSites',
      issues,
      playerRealmIndex !== undefined && playerRealmIndex >= 0 ? playerRealmIndex : undefined,
      isObject(parsed.player) && isFiniteNumber(parsed.player.lastSavedAt)
        ? (parsed.player.lastSavedAt as number)
        : undefined,
      claimedRealmTier,
      isObject(parsed.player) && isNonNegativeFiniteNumber(parsed.player.autoWorkerCapacity)
        ? (parsed.player.autoWorkerCapacity as number)
        : undefined,
    )
  }

  if (alchemyJobs) {
    // F-TC9-3: jobs settle with the room level claimed at start; the
    // only writer stamps the current pill_room level, and building
    // level never decreases - the persisted level is the upper bound.
    const pillRoomLevel = Array.isArray(buildings)
      ? buildings.reduce<number>(
          (max, entry) =>
            isObject(entry) && entry.buildingId === 'pill_room' && isFiniteNumber(entry.level)
              ? Math.max(max, entry.level as number)
              : max,
          0,
        )
      : 0

    // F-A11-5: the authored slot ladder grants +1 concurrent job at
    // pill_room levels 3/6/9 on top of the base slot - a job count the
    // persisted level cannot host is a forged settle window.
    const maxJobs =
      pillRoomLevel <= 0
        ? 0
        : 1 +
          (pillRoomLevel >= 3 ? 1 : 0) +
          (pillRoomLevel >= 6 ? 1 : 0) +
          (pillRoomLevel >= 9 ? 1 : 0)

    if (alchemyJobs.length > maxJobs) {
      issues.push({
        path: 'alchemyJobs',
        message: `vượt concurrent slot authored (${maxJobs})`,
      })
    }

    validateAlchemyJobsSave(
      alchemyJobs,
      'alchemyJobs',
      issues,
      pillRoomLevel,
      isObject(parsed.player) && isFiniteNumber(parsed.player.lastSavedAt)
        ? (parsed.player.lastSavedAt as number)
        : undefined,
    )
  }

  // Mission A1 - deep element checks: a present-but-malformed slice must
  // fail the boundary before restore trusts the declared TS shape.
  if (parsed.quests !== undefined) {
    validateQuestSave(parsed.quests, '.quests', issues)
  }

  // R7 (AR-08) - decompose slice is optional; when present it must be
  // an object with a non-negative finite workers number (restore
  // re-clamps; malformed input is rejected instead of crashing boot).
  // Mission A1 extends it: nextCycleAt/started plus enum membership for
  // the two filters (a bad deadline is a per-tick runaway).
  if (parsed.decompose !== undefined) {
    if (!isObject(parsed.decompose)) {
      issues.push({ path: '.decompose', message: 'phải là object hoặc vắng mặt' })
    } else {
      const decompose = parsed.decompose as Record<string, unknown>
      const settings = decompose.settings

      if (!isObject(settings)) {
        issues.push({ path: '.decompose.settings', message: 'phải là object' })
      } else {
        if (!isNonNegativeFiniteNumber(settings.workers)) {
          issues.push({ path: '.decompose.settings.workers', message: 'phải là số hữu hạn không âm' })
        }

        if (settings.gradeFilter !== 'all' && !isProfessionGrade(settings.gradeFilter)) {
          issues.push({ path: '.decompose.settings.gradeFilter', message: 'phải là ProfessionGrade hoặc all' })
        }

        if (settings.ageFilter !== 'all' && !isHerbAge(settings.ageFilter)) {
          issues.push({ path: '.decompose.settings.ageFilter', message: 'phải là HerbAge hoặc all' })
        }
      }

      if (!isNonNegativeBoundedTimestamp(decompose.nextCycleAt)) {
        issues.push({ path: '.decompose.nextCycleAt', message: 'phải là timestamp không âm trong miền |x| < 2^52' })
      }

      if (typeof decompose.started !== 'boolean') {
        issues.push({ path: '.decompose.started', message: 'phải là boolean' })
      }
    }
  }

  // v82 (F-W-5) - tribulation slice optional; khi co, committedOutcome
  // phai du shape toi thieu de restore dung lai director runtime thay
  // vi crash/restore sai.
  if (parsed.tribulation !== undefined) {
    if (!isObject(parsed.tribulation)) {
      issues.push({ path: '.tribulation', message: 'phải là object hoặc vắng mặt' })
    } else {
      const tribulation = parsed.tribulation as Record<string, unknown>

      if (
        tribulation.cooldownUntil !== undefined &&
        !isNonNegativeBoundedTimestamp(tribulation.cooldownUntil)
      ) {
        issues.push({ path: '.tribulation.cooldownUntil', message: 'phải là timestamp không âm trong miền |x| < 2^52' })
      }

      // F-LC-1: the only writer mints cooldownUntil = now +
      // TRIBULATION_COOLDOWN_SECONDS (300s) - a deadline beyond
      // lastSavedAt + the authored span is unproducible and wedges
      // start() forever (permanent deadlock on the only forward
      // transition), same class as the alchemy/building span bounds.
      const saveClock =
        isObject(parsed.player) && isFiniteNumber(parsed.player.lastSavedAt)
          ? (parsed.player.lastSavedAt as number)
          : undefined
      if (
        isNonNegativeFiniteNumber(tribulation.cooldownUntil) &&
        saveClock !== undefined &&
        (tribulation.cooldownUntil as number) >
          saveClock + TRIBULATION_COOLDOWN_SECONDS * 1000
      ) {
        issues.push({
          path: '.tribulation.cooldownUntil',
          message: 'vượt authored cooldown span (deadlock bất khả thi)',
        })
      }

      if (tribulation.committedOutcome !== undefined) {
        const committed = tribulation.committedOutcome

        if (!isObject(committed)) {
          issues.push({ path: '.tribulation.committedOutcome', message: 'phải là object' })
        } else {
          if (!isNonNegativeFiniteNumber(committed.attemptId)) {
            issues.push({
              path: '.tribulation.committedOutcome.attemptId',
              message: 'phải là số hữu hạn không âm',
            })
          }

          if (committed.outcome !== 'victory' && committed.outcome !== 'defeat') {
            issues.push({
              path: '.tribulation.committedOutcome.outcome',
              message: "phải là 'victory' hoặc 'defeat'",
            })
          }

          if (typeof committed.targetRealmId !== 'string') {
            issues.push({
              path: '.tribulation.committedOutcome.targetRealmId',
              message: 'phải là string',
            })
          }

          if (
            typeof committed.grade !== 'string' ||
            !Object.prototype.hasOwnProperty.call(FOUNDATION_LABELS, committed.grade) ||
            // 'great_dao' is never a persisted ordinary grade - a hidden
            // breakthrough records it via breakthroughType instead.
            committed.grade === 'great_dao'
          ) {
            issues.push({
              path: '.tribulation.committedOutcome.grade',
              message: 'phải là ResolvableKienCoGrade hợp lệ',
            })
          } else if (
            // F-TRB-1: the recorded grade resolves from monotonic body
            // records at commit time - those records only grow after
            // the commit, so a grade above the resolvable rank on this
            // save's own inputs is a fabricated settle (it would mint
            // the kien_co main-stat multiplier + reward outcomes).
            (FOUNDATION_CLAIM_RANK[committed.grade] ?? 0) >
              persistedResolvableFoundationRank(isObject(parsed.player) ? parsed.player : {})
          ) {
            issues.push({
              path: '.tribulation.committedOutcome.grade',
              message: `grade '${String(committed.grade)}' vượt điều kiện derivable từ body records`,
            })
          }

          if (committed.breakthroughType !== 'normal' && committed.breakthroughType !== 'hidden') {
            issues.push({
              path: '.tribulation.committedOutcome.breakthroughType',
              message: "phải là 'normal' hoặc 'hidden'",
            })
          }

          if (committed.receipt !== null && !isObject(committed.receipt)) {
            issues.push({
              path: '.tribulation.committedOutcome.receipt',
              message: 'phải là object hoặc null',
            })
          } else if (isObject(committed.receipt)) {
            // F-TRB-RECEIPT: the persisted receipt replays
            // settleOutcome's emit for THIS committed outcome - kind
            // bound to outcome plus the fields presentOutcome derefs
            // every settle tick. A receipt missing
            // announcement.titleKey crash-loops the tick before
            // consumeReceipt can clear it, so the shape is bound
            // here: an accepted record can never crash the tick.
            const receipt = committed.receipt as Record<string, unknown>
            const receiptPath = '.tribulation.committedOutcome.receipt'

            if (receipt.kind !== 'victory' && receipt.kind !== 'defeat') {
              issues.push({
                path: `${receiptPath}.kind`,
                message: "phải là 'victory' hoặc 'defeat'",
              })
            } else if (receipt.kind !== committed.outcome) {
              issues.push({
                path: `${receiptPath}.kind`,
                message: 'không khớp outcome đã commit (receipt phải replay settleOutcome của outcome này)',
              })
            }

            if (!isObject(receipt.announcement)) {
              issues.push({
                path: `${receiptPath}.announcement`,
                message: 'phải là object (presentOutcome deref mỗi settle tick)',
              })
            } else {
              const announcementPath = `${receiptPath}.announcement`
              requireNonEmptyString(receipt.announcement, 'titleKey', announcementPath, issues)
              requireNonEmptyString(receipt.announcement, 'bodyKey', announcementPath, issues)
              for (const paramsField of ['titleParams', 'bodyParams'] as const) {
                const params = receipt.announcement[paramsField]
                if (
                  params !== undefined &&
                  (!isObject(params) ||
                    !Object.values(params).every((value) => typeof value === 'string'))
                ) {
                  issues.push({
                    path: `${announcementPath}.${paramsField}`,
                    message: 'phải là Record<string, string> hoặc vắng mặt',
                  })
                }
              }
            }

            if (receipt.kind === 'victory') {
              // Writer emit (TribulationOutcomeService.settleOutcome):
              // realmEntered null for the Quan Khi ritual, else the
              // entered targetRealmId; realmName/flags always stamped.
              const expectedRealmEntered =
                committed.targetRealmId === 'qi_refining' ? null : committed.targetRealmId
              if (receipt.realmEntered !== expectedRealmEntered) {
                issues.push({
                  path: `${receiptPath}.realmEntered`,
                  message: `không khớp writer emit cho targetRealmId ${String(committed.targetRealmId)}`,
                })
              }
              requireNonEmptyString(receipt, 'realmName', receiptPath, issues)
              requireBoolean(receipt, 'talentConverted', receiptPath, issues)
              requireBoolean(receipt, 'questRealmTransitionMarked', receiptPath, issues)

              // foundationGrade is emitted only for the
              // foundation_establishment settle (human/earth/heaven, or
              // great_dao on a hidden breakthrough).
              if (committed.targetRealmId === 'foundation_establishment') {
                if (
                  typeof receipt.foundationGrade !== 'string' ||
                  !Object.prototype.hasOwnProperty.call(FOUNDATION_LABELS, receipt.foundationGrade)
                ) {
                  issues.push({
                    path: `${receiptPath}.foundationGrade`,
                    message: 'phải là FoundationType hợp lệ (victory foundation_establishment luôn stamp)',
                  })
                }
              } else if (receipt.foundationGrade !== undefined) {
                issues.push({
                  path: `${receiptPath}.foundationGrade`,
                  message: 'writer chỉ emit cho targetRealmId foundation_establishment',
                })
              }

              // standalonePanel is emitted as 'quan_khi' only on the
              // mortal -> qi_refining ritual; it must also pass the
              // beta standalone-panel gate (a scope-hidden panel id
              // would mount a hidden surface - the seam fix routes
              // presentOutcome through ui.openStandalonePanel too).
              if (receipt.standalonePanel !== undefined) {
                if (
                  typeof receipt.standalonePanel !== 'string' ||
                  !isBetaStandalonePanel(receipt.standalonePanel) ||
                  receipt.standalonePanel !== 'quan_khi' ||
                  committed.targetRealmId !== 'qi_refining'
                ) {
                  issues.push({
                    path: `${receiptPath}.standalonePanel`,
                    message: "writer chỉ emit 'quan_khi' cho targetRealmId qi_refining (và phải qua isBetaStandalonePanel)",
                  })
                }
              }
            } else if (receipt.kind === 'defeat') {
              requireNonNegativeNumber(receipt, 'cultivationLossPercent', receiptPath, issues)
              requireNonEmptyString(receipt, 'spiritStoneId', receiptPath, issues)
              requireNonNegativeNumber(receipt, 'spiritStonesLost', receiptPath, issues)
            }
          }

          if (typeof committed.settlementError !== 'boolean') {
            issues.push({
              path: '.tribulation.committedOutcome.settlementError',
              message: 'phải là boolean',
            })
          }

          // F-TRB-FORGE: the record is provenance-bound - commitOutcome
          // stamps a witness carrying run-derived facts (departing
          // realm, chapter floor, strikes, per-attempt seed) folded
          // into one digest. A fabricated victory that never ran the
          // commit site cannot replay it and is rejected here instead
          // of settling the authored breakthrough free.
          const witness = committed.witness

          if (!isObject(witness)) {
            issues.push({
              path: '.tribulation.committedOutcome.witness',
              message: 'thiếu commit witness (record chưa chạy commitOutcome là bất khả thi)',
            })
          } else {
            const witnessBadField = verifyTribulationCommitWitness(
              committed as unknown as TribulationCommitWitnessedRecord,
            )

            if (witnessBadField !== null) {
              issues.push({
                path: `.tribulation.committedOutcome.witness.${witnessBadField}`,
                message: 'commit witness không replay được (commitOutcome chưa chạy)',
              })
            }

            // Realm binding: the settle-time realm write is what a
            // pending record is still owed. Pending (receipt null)
            // or a bound defeat - the player must still sit in the
            // departing realm; a bound victory has already landed the
            // realm write (realmId === targetRealmId). A
            // settlementError record is terminal-after-first-attempt -
            // mid-apply landed state is unknowable, skip the binding.
            const playerRealmId =
              isObject(parsed.player) && typeof parsed.player.realmId === 'string'
                ? (parsed.player.realmId as string)
                : undefined

            if (
              playerRealmId !== undefined &&
              typeof witness.departingRealmId === 'string' &&
              typeof committed.targetRealmId === 'string' &&
              committed.settlementError === false
            ) {
              const expectedRealmId =
                committed.receipt !== null &&
                committed.receipt !== undefined &&
                committed.outcome === 'victory'
                  ? committed.targetRealmId
                  : witness.departingRealmId

              if (playerRealmId !== expectedRealmId) {
                issues.push({
                  path: '.tribulation.committedOutcome.witness.departingRealmId',
                  message: `departingRealmId không bind vào player.realmId ('${String(playerRealmId)}' != '${String(expectedRealmId)}')`,
                })
              }
            }
          }
        }
      }
    }
  }

  if (techniques) {
    validateIdEntries(techniques, 'techniques', issues)
  }

  if (skills) {
    validateSkillEntries(
      skills,
      'skills',
      issues,
      isObject(parsed.player) && isObject(parsed.player.skillCastCounts)
        ? parsed.player.skillCastCounts
        : undefined,
    )
  }

  // M-QI-05 (v73) - Core Node coverage: the learned levelled skills,
  // the active way's coreSkillIds, and every owned node's
  // grantsSkillCoreIds must resolve to granted cores (level >= 1) in
  // player.nodeLevels - restore never re-derives ownership.
  if (skills && isObject(parsed.player)) {
    validateSkillCoreCoverage(parsed.player, skills, issues)
  }

  if (buildings) {
    validateBuildingsSave(
      buildings,
      'buildings',
      issues,
      playerRealmIndex !== undefined && playerRealmIndex >= 0 ? playerRealmIndex : undefined,
      claimedRealmTier,
    )
  }

  if (materials) {
    validateStackEntries(materials, 'materialId', 'materials', issues)

    for (let i = 0; i < materials.length; i += 1) {
      const entry = materials[i]
      if (!isObject(entry) || typeof entry.materialId !== 'string') continue

      // F-MAT-PULL-TOKEN: the companion pull pool is permanently closed
      // and every token source is suppressed at origination (quest
      // unlock/claim filters + loot delivery all consult it) - no writer
      // mints the id, ever, so the stack is permanently unproducible.
      if (isCompanionPullTokenSourceSuppressed(entry.materialId)) {
        issues.push({
          path: `materials[${i}]`,
          message: `'${entry.materialId}' không có writer mint (pull pool đóng vĩnh viễn, mọi nguồn suppressed)`,
        })
      }

      // F-MAT-DOMAIN-SCOPE: domain-scoped materials have no profession
      // meta (they escape the F-MAT-REALM pin) and deliver only while
      // isDomainScopedAcquisitionEnabled can open - an unlock realm
      // outside the release window is never mintable, and one more than
      // a tier above the claim follows the F-MAT-REALM convention.
      const domainUnlockRealmId = DOMAIN_UNLOCK_REALM_ID_BY_MATERIAL_ID.get(entry.materialId)

      if (domainUnlockRealmId !== undefined) {
        if (!isRealmAvailable(domainUnlockRealmId)) {
          issues.push({
            path: `materials[${i}]`,
            message: `vật liệu domain '${entry.materialId}' ngoài release window ('${domainUnlockRealmId}' không reachable)`,
          })
        } else if (
          claimedRealmTier !== undefined &&
          getRealmTier(domainUnlockRealmId) > claimedRealmTier + PRODUCIBLE_REALM_TIER_LEAD
        ) {
          issues.push({
            path: `materials[${i}]`,
            message: `vật liệu domain '${entry.materialId}' vượt realm tier người chơi (${claimedRealmTier})`,
          })
        }
      }

      if (claimedRealmTier !== undefined) {
        // F-SCOPE-1: every authored stone writer pays the tier keyed by
        // getSpiritStoneMaterialIdForRealmTier(realmTier) - a trung stack
        // needs a tier >= 4 realm claim, thuong needs tier >= 7; below
        // that, the stack is unproducible.
        const requiredTier =
          entry.materialId === SPIRIT_STONE_THUONG_PHAM_MATERIAL_ID
            ? 7
            : entry.materialId === SPIRIT_STONE_TRUNG_PHAM_MATERIAL_ID
              ? 4
              : 0
        if (requiredTier > 0 && claimedRealmTier < requiredTier) {
          issues.push({
            path: `materials[${i}]`,
            message: `linh thạch ${entry.materialId} vượt realm tier người chơi (${claimedRealmTier})`,
          })
        }

        // F-MAT-REALM: realm-keyed profession materials mint from
        // realm-bounded faucets only - a holding more than one tier
        // above the claimed realm (the lead authored no-gate collect
        // quests tolerate) is unproducible.
        const professionRealmTier = PROFESSION_MATERIAL_REALM_TIER_BY_ID.get(entry.materialId)

        if (
          professionRealmTier !== undefined &&
          professionRealmTier > claimedRealmTier + PRODUCIBLE_REALM_TIER_LEAD
        ) {
          issues.push({
            path: `materials[${i}]`,
            message: `nguyên liệu nghề '${entry.materialId}' vượt realm tier người chơi (${claimedRealmTier})`,
          })
        }
      }
    }
  }

  if (pills) {
    validateStackEntries(pills, 'pillId', 'pills', issues)

    // F-PILL-REALM-PIN: the only pill mint route is alchemy, whose
    // recipes bind to same-realm parity - a realm-keyed pill above the
    // claimed realm tier is unproducible, and a breakthrough-scoped pill
    // whose acquisition transition is permanently closed is never
    // producible. A carried save inside the window (e.g. foundation
    // holding truc_co_dan) still validates.
    for (let i = 0; i < pills.length; i += 1) {
      const entry = pills[i]
      if (!isObject(entry) || typeof entry.pillId !== 'string') continue

      const pill = CATALOG_PILL_BY_ID.get(entry.pillId)
      if (pill === undefined) continue

      if (
        pill.breakthroughRealmId !== undefined &&
        !isBreakthroughAcquisitionEnabled(pill.breakthroughRealmId)
      ) {
        issues.push({
          path: `pills[${i}]`,
          message: `đan '${entry.pillId}' ngoài acquisition window ('${pill.breakthroughRealmId}' đóng vĩnh viễn)`,
        })
      }

      if (
        pill.realmId !== undefined &&
        claimedRealmTier !== undefined &&
        getRealmTier(pill.realmId) > claimedRealmTier
      ) {
        issues.push({
          path: `pills[${i}]`,
          message: `đan '${entry.pillId}' vượt realm tier người chơi (${claimedRealmTier})`,
        })
      }
    }
  }

  // Mission A1 - Phu/Tran bags are retired (serializer always emits []),
  // but a present malformed element must still fail the trust boundary.
  if (talismans) {
    validateStackEntries(talismans, 'talismanId', 'talismans', issues)
  }

  if (formations) {
    validateStackEntries(formations, 'formationId', 'formations', issues)
  }

  const equipmentValidation = equipment
    ? validateEquipmentEntries(
        equipment,
        'equipment',
        issues,
        isObject(parsed.player) && typeof parsed.player.realmId === 'string'
          ? parsed.player.realmId
          : undefined,
      )
    : undefined
  const normalizedEquipmentSlots = equipmentSlots
    ? validateEquipmentSlotEntries(equipmentSlots, 'equipmentSlots', issues, claimedRealmTier)
    : undefined
  const discardedEquipmentCount = equipmentValidation?.discardedCount ?? 0

  if (issues.length > 0) {
    return { ok: false, issues, discardedEquipmentCount }
  }

  return {
    ok: true,
    issues: [],
    normalizedSave: {
      ...parsed,
      // F-TC9-4 fixup: the clamped derived snapshot replaces the raw
      // claim so every consumer of normalizedSave (inspect/load, remote
      // pull, pending adoption, import) behaves with the ceiling rate.
      player:
        isObject(parsed.player) && playerNormalization.cultivationPerSecond !== undefined
          ? {
              ...parsed.player,
              cultivationPerSecond: playerNormalization.cultivationPerSecond,
            }
          : parsed.player,
      equipment: equipmentValidation?.normalizedEntries ?? [],
      equipmentSlots: normalizedEquipmentSlots ?? [],
    },
    discardedEquipmentCount,
  }
}

/**
 * The shape gate must never throw. Any internal defect (a field check
 * that itself assumes shape - e.g. a digest fold over an unverified
 * collection) converts to a refused verdict so every caller - remote
 * load, pending-journal replay, local slot read, the driveSave write
 * gate, import/recovery - classifies the payload as corrupted data
 * instead of propagating an unhandled rejection that wedges the boot
 * pipeline or escapes the classified-refuse envelope. (r27-AUT-1)
 */
export function validateGameSaveShape(parsed: unknown): ShapeValidationResult {
  try {
    return validateGameSaveShapeChecked(parsed)
  } catch {
    return {
      ok: false,
      issues: [{ path: '', message: 'validator gặp lỗi nội bộ' }],
      discardedEquipmentCount: 0,
    }
  }
}
