// M-QI-09 (QI-D4c) - deterministic measurement for the essence
// substitution ratio lock: drives the canonical progression through
// production seams (combatCultivationParity on, like M-D), measures a
// band residency's kill budget, and derives the locked adjacent
// conversionRatio from the pinned authored band drops.
//
// Lock rule (spec docs/p7/missions/mqi-09-essence-substitution.spec.md
// sec.3.4 - band-redemption invariant via authored parity): the
// smallest integer >= 2 such that the stranded band's expected
// essence income over one gate arc covers the full authored
// lower-chapter requirement. The chapter caps were tuned so that the
// required band's own essence income over its residency covers them
// (BodyRefinement.ts: "doi chieu tong nguon Tinh Hoa farm duoc trong
// 18 tang Pham Nhan"), so one authored residency == the residual at
// 1:1. Every band drops essence at the same pinned rate
// (0.7 chance, 1-3 amount -> 1.4 per kill), so the stranded band's
// authored residency income is identical - substitution at parity
// needs ratio 1, and the spec's >=2 premium floor for a strictly
// more valuable grade locks ratio 2.
//
// The scripted residency measurement below is deterministic evidence
// for the drive (boundary reached across the seed set) - it is NOT
// the income proxy: a scripted journey performs far fewer refarm
// kills than a real residency (hundreds vs thousands), which would
// inflate the lock by an order of magnitude. Income parity is the
// authored anchor, not scripted kill counts.
//
// This module is simulation infrastructure - nothing on the gameplay
// path may import it (same rule as PerfectionEconomy).
import { EarlyGameSession } from './EarlyGameSession'
import { CANONICAL_EARLY_LOOP, runLoop } from './EarlyGameLoop'
import type { EarlyGameCreationProfile } from '../../game/EarlyGameBootstrap'
import { BODY_REFINEMENT_TIERS } from '../../../data/realm/BodyRefinement'
import {
  PHYSIQUE_ESSENCE_BAND_DROPS,
  physiqueEssenceBand,
  physiqueEssenceConversionRatio,
  physiqueEssenceMaterialId,
  type PhysiqueEssenceBandRealm,
} from '../../../data/realm/PhysiqueEssence'
import { getBodyRefinementCompletedTiers } from '../../realm/body/BodyProgressionSystem'
import { MAX_STACK_AMOUNT } from '../../inventory/StackLimits'
import { getRequiredCultivation } from '../../realm/realmSystem'
import { REALMS } from '../../../data/realms/realm'

/** Same canonical measurement profile as M-D - one fixed creation
 * identity so runs differ only by seed. */
const MEASUREMENT_PROFILE: EarlyGameCreationProfile = {
  name: 'substitution-economy-measure',
  talentIds: ['hap_linh'],
  mortalBasicSkillId: 'tram',
}

function makeSession(seed: number): EarlyGameSession {
  const session = new EarlyGameSession({ seed, profile: MEASUREMENT_PROFILE })
  session.combatCultivationParity = true
  return session
}

/** Fixed seed set for the lock measurement - min arc kills across it
 * is the worst-case surplus the lock must cover. */
export const ESSENCE_LOCK_SEEDS = [11, 22, 33, 44] as const

export interface BandResidencyMeasurement {
  seed: number
  realmId: string
  /** Enemies defeated from session start to the band boundary - the
   * scripted residency kill budget. */
  kills: number
  /** True when the drive reached the next realm's boundary. */
  boundaryReached: boolean
}

/** Drive the scripted mortal prefix tolerating scripted-floor failures
 * (floors are a side path - the transition gates on realmLevel only),
 * then force the real transition exactly like measureNormalRun: grind
 * to level 12, win the tribulation, perform the ritual. Returns the
 * session post-attempt in every case - callers check
 * `player.realmId === targetRealmId` for the boundary. */
function driveToBandBoundary(
  seed: number,
  targetRealmId: 'qi_refining',
): EarlyGameSession {
  const session = makeSession(seed)
  const ritualIndex = CANONICAL_EARLY_LOOP.findIndex(
    (step) => step.kind === 'ritual',
  )
  if (ritualIndex < 0) throw new Error('canonical loop has no ritual step')

  runLoop(session, CANONICAL_EARLY_LOOP.slice(0, ritualIndex - 1))

  const player = session.player
  const mortal = REALMS.find((realm) => realm.id === 'mortal')
  if (mortal === undefined) throw new Error('mortal realm definition missing')
  while (player.realmLevel < 12 && player.realmLevel < mortal.maxLevel) {
    const required = getRequiredCultivation(player.realmId, player.realmLevel)
    const deficit = required - player.cultivation
    if (deficit > 0 && player.cultivationPerSecond > 0) {
      session.cultivate(deficit / player.cultivationPerSecond + 1)
    }
    if (!session.breakthroughIfReady()) break
  }
  if (session.runTribulation(targetRealmId) === 'victory') {
    session.performRitual('sword', 'sword_pathway')
  }
  return session
}

/** Measure one band residency: session start through the real
 * transition to the next realm. `kills` is the scripted residency
 * budget - progression floor pushes plus refarm kills inside the
 * scripted growth recipe. */
export function measureBandResidency(
  seed: number,
  nextRealmId: 'qi_refining' = 'qi_refining',
): BandResidencyMeasurement {
  const session = driveToBandBoundary(seed, nextRealmId)
  return {
    seed,
    realmId: nextRealmId,
    kills: session.simRunTotals.enemiesDefeated,
    boundaryReached: session.player.realmId === nextRealmId,
  }
}

/** Expected essence per kill for a band, derived from the pinned
 * authored drop entry: `chance * mean(amount)` (0.7 * 2 = 1.4 for
 * every pinned band). */
export function expectedBandEssencePerKill(realmId: string): number {
  const entry = PHYSIQUE_ESSENCE_BAND_DROPS[realmId as PhysiqueEssenceBandRealm]
  if (entry === undefined || entry.kind !== 'material' || entry.amount === undefined) return 0
  return entry.chance * ((entry.amount.min + entry.amount.max) / 2)
}

/** Expected essence income over a kill budget for the band. */
export function expectedBandEssence(realmId: string, kills: number): number {
  return kills * expectedBandEssencePerKill(realmId)
}

/** Full authored requirement of the mortal Body chapter - the sum of
 * its tier caps; the worst-case stranded residual. */
export function bodyChapterRequirement(): number {
  return BODY_REFINEMENT_TIERS.reduce((sum, tier) => sum + tier.cap, 0)
}

/** Candidate adjacent ratios the sim evaluates (C2C 4): the spec's
 * premium floor is 2 (a higher grade strictly more valuable), so
 * candidates run upward from there. The deterministic selection is
 * the smallest candidate whose authored-residency coverage retires
 * the full residual. */
export const ESSENCE_RATIO_CANDIDATES = [2, 3, 4, 5, 6] as const

/** The lock derivation: smallest candidate >= 2 covering `residual`
 * with `surplus` units of the substituting essence. */
export function lockConversionRatio(residual: number, surplus: number): number {
  if (surplus <= 0) return Number.MAX_SAFE_INTEGER
  return (
    ESSENCE_RATIO_CANDIDATES.find(
      (candidate) => surplus * candidate >= residual,
    ) ?? Number.MAX_SAFE_INTEGER
  )
}

export interface EssenceRatioLockMeasurement {
  seeds: readonly number[]
  arcs: readonly BandResidencyMeasurement[]
  /** Residency kill budget the authored requirement implies at the
   * required band's own drop rate (residual / per-kill income). */
  authoredResidencyKills: number
  /** Min scripted residency kills across completed arcs - reported
   * as drive evidence, never used as the income proxy. */
  minArcKills: number
  residual: number
  surplus: number
  lockedRatio: number
  /** Authored production value the lock is compared against. */
  authoredRatio: number
}

/** Measure band residencies over the seed set (drive evidence) and
 * compute the lock for that band's grade ratio from authored
 * parity: `residual` is the full authored requirement of the
 * chapter the grade substitutes into; `surplus` is the stranded
 * band's expected income over the authored residency (the kill
 * budget the required band's caps imply at their own rate). */
export function measureEssenceRatioLock(
  substituteRealm: PhysiqueEssenceBandRealm,
  seeds: readonly number[] = ESSENCE_LOCK_SEEDS,
): EssenceRatioLockMeasurement {
  // Only the qi_refining substitution hop is measurable today: the
  // mortal -> qi_refining arc is the only driveable residency, and
  // body_refinement (Pham) is the only authored essence chapter -
  // the same lock is authored for every adjacent hop downstream.
  if (substituteRealm !== 'qi_refining') {
    throw new Error(`residency measurement is not driveable for ${substituteRealm}`)
  }
  const arcs = seeds.map((seed) => measureBandResidency(seed))
  const completed = arcs.filter((arc) => arc.boundaryReached)
  const minArcKills =
    completed.length === 0
      ? 0
      : Math.min(...completed.map((arc) => arc.kills))
  const residual = bodyChapterRequirement()
  const requiredRealm = 'mortal'
  const authoredResidencyKills = Math.ceil(
    residual / expectedBandEssencePerKill(requiredRealm),
  )
  const surplus = expectedBandEssence(
    substituteRealm,
    authoredResidencyKills,
  )
  const substituteGrade = physiqueEssenceBand(substituteRealm)
  const authoredRatio =
    substituteGrade === undefined
      ? 0
      : (physiqueEssenceConversionRatio(substituteGrade) ?? 0)
  return {
    seeds,
    arcs,
    authoredResidencyKills,
    minArcKills,
    residual,
    surplus,
    lockedRatio: lockConversionRatio(residual, surplus),
    authoredRatio,
  }
}

export interface StrandedCompletionMeasurement {
  seed: number
  substituteGranted: number
  substituteSpent: number
  /** Required-grade units left in the bag after the drain - the seam
   * spends required first, so this isolates the substitution share. */
  requiredLeft: number
  tiersCompleted: number
  completed: boolean
}

/** End-to-end contract exercise on production seams: drive to the
 * band boundary, grant `substituteAmount` units of the band's
 * essence, then drain the real invest seam until the lower chapter
 * completes. The lock's guarantee says one arc's surplus at the
 * locked ratio retires the whole lower requirement - this measures
 * whether the real seam honours it, including per-hop rounding
 * loss. */
export function measureStrandedCompletion(
  seed: number,
  substituteRealm: PhysiqueEssenceBandRealm,
  substituteAmount: number,
): StrandedCompletionMeasurement {
  const session = driveToBandBoundary(seed, 'qi_refining')
  if (session.player.realmId !== 'qi_refining') {
    throw new Error('band boundary unreachable - transition failed')
  }

  const manager = session.gameManager
  const player = session.player
  const substituteGrade = physiqueEssenceBand(substituteRealm)
  const substituteMaterialId =
    substituteGrade === undefined
      ? undefined
      : physiqueEssenceMaterialId(substituteGrade)
  if (substituteMaterialId === undefined) {
    throw new Error('substitute essence material not authored')
  }
  const substituteMaterial = manager.materialRegistry.get(substituteMaterialId)

  // Isolate the substitution contract on the FULL residual: drain any
  // pre-existing required essence and zero the chapter progress the
  // scripted mortal arc already bought (a real stranded player may
  // arrive with any partial progress - the lock must cover the worst
  // case of none).
  const requiredMaterialId = physiqueEssenceMaterialId('pham')
  if (requiredMaterialId === undefined) {
    throw new Error('required essence material not authored')
  }
  manager.materialBag.remove(
    requiredMaterialId,
    manager.materialBag.getAmount(requiredMaterialId),
  )
  const refinement = player.bodyProgression.body_refinement
  refinement.completedTiers = 0
  refinement.currentTierProgress = 0

  // Feed-drain: the substitute essence arrives in bounded stacks
  // (MaterialBag.add clamps at the material's stackLimit), exactly as
  // it would from real drop income - grant up to headroom, run the
  // invest seam until it stops consuming, repeat until the grant
  // budget is exhausted or the chapter completes.
  const stackLimit = substituteMaterial.stackLimit ?? MAX_STACK_AMOUNT
  let granted = 0
  let guard = 0
  while (
    getBodyRefinementCompletedTiers(player) < BODY_REFINEMENT_TIERS.length &&
    guard++ < 100_000
  ) {
    const headroom =
      stackLimit - manager.materialBag.getAmount(substituteMaterialId)
    const topUp = Math.min(substituteAmount - granted, headroom)
    if (topUp > 0) {
      manager.materialBag.add(substituteMaterial, topUp)
      granted += topUp
      continue
    }
    const consumed = manager.realmAdvanceOps.investBodyChapter(
      player,
      'body_refinement',
    )
    if (consumed === 0) break
  }

  return {
    seed,
    substituteGranted: granted,
    substituteSpent:
      granted - manager.materialBag.getAmount(substituteMaterialId),
    requiredLeft: manager.materialBag.getAmount(requiredMaterialId),
    tiersCompleted: getBodyRefinementCompletedTiers(player),
    completed:
      getBodyRefinementCompletedTiers(player) >= BODY_REFINEMENT_TIERS.length,
  }
}
