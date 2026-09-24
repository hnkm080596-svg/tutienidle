// M-D (decision D6) - deterministic measurement of the mortal
// early-game economy: does the current authored source set support
// "Pham Nhan hoan my optional, giu kho"? Analysis only - drives
// EarlyGameSession through production seams with
// combatCultivationParity on (production cultivates, auto-breaks
// through, and auto-invests during battles). The driven run owns the
// verdict; the analytic budget is a cross-check, not the verdict owner.
//
// Spec: docs/p7/missions/md-perfection-sim.spec.md v12
import { EarlyGameSession } from './EarlyGameSession'
import { CANONICAL_EARLY_LOOP, runLoop } from './EarlyGameLoop'
import type { EarlyGameCreationProfile } from '../../game/EarlyGameBootstrap'
import { MAIN_STAT_KEYS, type MainStatKey } from '../../stats/StatTypes'
import { createBaseStats } from '../../stats/StatBlock'
import { createDefaultPlayer } from '../../player/Player'
import { getMainStatCap } from '../../stats/StatCap'
import { getRequiredCultivation } from '../../realm/realmSystem'
import { getBodyRefinementCompletedTiers } from '../../realm/body/BodyProgressionSystem'
import { REALMS } from '../../../data/realms/realm'
import { STAGE_DROP_TABLES } from '../../../data/drop/StageDropTables'
import {
  BODY_REFINEMENT_TIERS,
  TINH_HOA_PHAM_THE_MATERIAL_ID,
} from '../../../data/realm/BodyRefinement'
import { pills } from '../../../data/pill/pills'
import { QUESTS } from '../../../data/quest/quests'
import type { Reward } from '../../reward/Reward'
import { MORTAL_DEFAULT_BASIC_ID } from '../../skill/MortalPrecursors'

/** Canonical measurement profile - one fixed creation identity so runs
 * differ only by seed. Combat passive, no economy subsidy. */
const MEASUREMENT_PROFILE: EarlyGameCreationProfile = {
  name: 'economy-measure',
  talentIds: ['hap_linh'],
  mortalBasicSkillId: MORTAL_DEFAULT_BASIC_ID,
}

export type PerfectionOutcome = 'achieved' | 'proven_infeasible' | 'safety_bound'
export type StatAxisVerdict = 'achieved' | 'proven_infeasible' | 'unresolved'

/** Which guard fired when outcome === 'safety_bound' (spec sec.3.5) -
 * max_kills is the primary bound; the rest are stall guards that must
 * stay distinguishable so a degenerate loop isn't conflated with the
 * specified bound. 'transition_incomplete' marks a normal run that
 * could not reach qi_refining (not a perfection bound). */
export type SafetyBoundReason =
  | 'max_kills'
  | 'max_iterations'
  | 'no_cleared_stage'
  | 'transition_incomplete'

export interface EconomyMeasurement {
  seed: number
  outcome: PerfectionOutcome
  /** Non-null iff outcome === 'safety_bound'. */
  boundReason: SafetyBoundReason | null
  realmId: string
  statAxisVerdict: StatAxisVerdict
  statAxisResolvedAtSeconds: number | null
  bodyTiersCompleted: number
  bodyAxisResolvedAtSeconds: number | null
  cultivationSeconds: number
  battleSeconds: number
  wallSeconds: number
  stageRuns: number
  victories: number
  defeats: number
  enemiesDefeated: number
  uncountedStageRuns: number
  tinhHoaGained: number
  attributePointsEarned: number
  attributePointsSpent: number
  realmLevelReached: number
  finalBaseStats: Record<MainStatKey, number>
  perfectionPredicateWouldPass: boolean
  /** Normal-run only: CANONICAL_EARLY_LOOP slice's failedAt, if any. */
  loopFailedAt: number | null
}

export interface MortalStatBudget {
  required: number
  available: number
  shortfall: number
  baseline: Record<MainStatKey, number>
  cap: number
  creationPoints: number
  breakthroughPoints: number
}

/** Enumerated-source budget (spec sec.3.4) - a cross-check describing the
 * sources enumerated TODAY, not a universal impossibility proof. */
export function mortalStatBudget(): MortalStatBudget {
  const baseline = createBaseStats()
  const cap = getMainStatCap('mortal')
  const mortal = REALMS.find((realm) => realm.id === 'mortal')
  if (!mortal) throw new Error('mortal realm definition missing')
  const required = MAIN_STAT_KEYS.reduce(
    (sum, stat) => sum + (cap - baseline[stat]),
    0,
  )
  const breakthroughPoints = mortal.maxLevel - createDefaultPlayer().realmLevel
  // Creation grants no points post-BETA-CREATION - the only
  // enumerated stat source is breakthrough.
  const creationPoints = 0
  const available = creationPoints + breakthroughPoints
  return {
    required,
    available,
    shortfall: required - available,
    baseline: Object.fromEntries(
      MAIN_STAT_KEYS.map((stat) => [stat, baseline[stat]]),
    ) as Record<MainStatKey, number>,
    cap,
    creationPoints,
    breakthroughPoints,
  }
}

export interface StatSourceCensus {
  /** Reward is a closed type (skillInsight|cultivation|spiritStone) -
   * no attribute-point channel exists for quests to grant stats. */
  rewardChannelsClosed: boolean
  /** Authored pills carrying random_main_stat - the only pill path that
   * writes raw baseStats. Empty = unreachable today. */
  pillsWithRandomMainStat: string[]
  /** Pill ids reachable via quest itemDrops - transitively clean when
   * pillsWithRandomMainStat is empty. */
  questItemDropPillIds: string[]
}

// Compile-time exhaustiveness pin: adding ANY field to Reward (e.g. an
// attribute-point channel) fails the build here before the census can
// go stale - a plain (keyof Reward)[] would silently pass.
const REWARD_KEY_MAP: Record<keyof Reward, true> = {
  skillInsight: true,
  cultivation: true,
  spiritStone: true,
}
const REWARD_KEYS = Object.keys(REWARD_KEY_MAP)

/** Data-verifiable census of raw-baseStats sources reachable at mortal
 * (spec sec.3.5). Deliberately enumerates only what exists today - a
 * future source flips one of these assertions, surfacing the change. */
export function reachableStatSourceCensus(): StatSourceCensus {
  const rewardChannelsClosed = REWARD_KEYS.every(
    (key) => !/attribute|stat/i.test(key),
  )
  const pillsWithRandomMainStat = pills
    .filter((pill) => pill.effects.some((effect) => effect.type === 'random_main_stat'))
    .map((pill) => pill.id)
  const questItemDropPillIds = QUESTS.flatMap((quest) =>
    (quest.reward.itemDrops ?? [])
      .filter((drop) => drop.kind === 'pill')
      .map((drop) => drop.itemId),
  )
  return { rewardChannelsClosed, pillsWithRandomMainStat, questItemDropPillIds }
}

/** Expected tinh_hoa_pham_the per kill from the mortal stage table's
 * guaranteed material lines (chance x mean(amount)). */
export function expectedEssencePerKill(): number {
  const mortalTable = STAGE_DROP_TABLES.find((table) => table.realmId === 'mortal')
  if (!mortalTable) throw new Error('mortal stage drop table missing')
  return mortalTable.guaranteed
    .filter(
      (entry) =>
        entry.kind === 'material' && entry.itemId === TINH_HOA_PHAM_THE_MATERIAL_ID,
    )
    .reduce((sum, entry) => {
      const amount = entry.amount ?? { min: 1, max: 1 }
      return sum + entry.chance * ((amount.min + amount.max) / 2)
    }, 0)
}

/** Analytic kills to complete all body tiers at expected income. */
export function expectedKillsForBody(): number {
  const totalCap = BODY_REFINEMENT_TIERS.reduce((sum, tier) => sum + tier.cap, 0)
  return totalCap / expectedEssencePerKill()
}

function makeSession(seed: number): EarlyGameSession {
  const session = new EarlyGameSession({ seed, profile: MEASUREMENT_PROFILE })
  session.combatCultivationParity = true
  return session
}

function toMeasurement(
  session: EarlyGameSession,
  outcome: PerfectionOutcome,
  boundReason: SafetyBoundReason | null,
  statAxisVerdict: StatAxisVerdict,
  statAxisResolvedAtSeconds: number | null,
  loopFailedAt: number | null,
): EconomyMeasurement {
  const totals = session.simRunTotals
  const player = session.player
  const cap = getMainStatCap('mortal')
  const bodyTiersCompleted = getBodyRefinementCompletedTiers(player)
  const perfectionPredicateWouldPass =
    bodyTiersCompleted >= BODY_REFINEMENT_TIERS.length &&
    MAIN_STAT_KEYS.every((stat) => player.baseStats[stat] >= cap)
  return {
    seed: session.seedValue,
    outcome,
    boundReason,
    realmId: player.realmId,
    statAxisVerdict,
    statAxisResolvedAtSeconds,
    bodyTiersCompleted,
    bodyAxisResolvedAtSeconds: totals.bodyCompletedAtSeconds,
    cultivationSeconds: totals.idleCultivationSeconds,
    battleSeconds: totals.battleSeconds,
    wallSeconds: totals.battleSeconds + totals.idleCultivationSeconds,
    stageRuns: totals.stageRuns,
    victories: totals.victories,
    defeats: totals.defeats,
    enemiesDefeated: totals.enemiesDefeated,
    uncountedStageRuns: totals.uncountedStageRuns,
    tinhHoaGained: totals.tinhHoaGained,
    attributePointsEarned: totals.attributePointsEarned,
    attributePointsSpent: totals.attributePointsSpent,
    realmLevelReached: player.realmLevel,
    finalBaseStats: Object.fromEntries(
      MAIN_STAT_KEYS.map((stat) => [stat, player.baseStats[stat]]),
    ) as Record<MainStatKey, number>,
    perfectionPredicateWouldPass,
    loopFailedAt,
  }
}

/** T_normal = time to the successful mortal -> qi_refining transition.
 * The canonical loop sliced through `ritual` runs best-effort; if the
 * scripted floor chain stalls (mortal_dong_5 is a characterized wall),
 * the run completes the transition the economy actually supports:
 * grind to realmLevel 12 -> tribulation -> ritual. loopFailedAt is
 * reported so the stall is visible, not absorbed. */
export function measureNormalRun(seed: number): EconomyMeasurement {
  const session = makeSession(seed)
  const ritualIndex = CANONICAL_EARLY_LOOP.findIndex((step) => step.kind === 'ritual')
  if (ritualIndex < 0) throw new Error('canonical loop has no ritual step')
  const report = runLoop(session, CANONICAL_EARLY_LOOP.slice(0, ritualIndex + 1))

  const player = session.player
  if (player.realmId === 'mortal') {
    // The transition gates on realmLevel only (tribulation >= 12) -
    // floors are a side path. Grind to eligibility, then drive the
    // real tribulation + ritual.
    const mortal = REALMS.find((realm) => realm.id === 'mortal')!
    while (player.realmLevel < 12 && player.realmLevel < mortal.maxLevel) {
      const required = getRequiredCultivation(player.realmId, player.realmLevel)
      const deficit = required - player.cultivation
      if (deficit > 0 && player.cultivationPerSecond > 0) {
        session.cultivate(deficit / player.cultivationPerSecond + 1)
      }
      if (!session.breakthroughIfReady()) break
    }
    if (session.runTribulation('qi_refining') === 'victory') {
      session.performRitual('sword', 'sword_pathway')
    }
  }
  return toMeasurement(
    session,
    player.realmId === 'qi_refining' ? 'achieved' : 'safety_bound',
    // Not a perfection bound - the reason names the failed transition
    // so it can't be conflated with a kill/iteration bound hit.
    player.realmId === 'qi_refining' ? null : 'transition_incomplete',
    'unresolved',
    null,
    report.failedAt,
  )
}

export interface PerfectionRunOptions {
  /** Kill bound guarding runaway measurement (default ~40k). */
  maxKills?: number
  /** Secondary stall guard (default maxKills/4) - catches degenerate
   * zero-kill loops a pure kill bound can't reach. */
  maxIterations?: number
}

/** Mortal prefix + perfection window (levels 12 -> 18). Two axes
 * resolve independently (spec sec.3.3): stat resolves on all-capped
 * (achieved) or level-cap + starved pool (proven_infeasible); the body
 * axis resolves only at 6/6. Outcome precedence: achieved ->
 * safety_bound -> proven_infeasible. */
export function measurePerfectionRun(
  seed: number,
  opts?: PerfectionRunOptions,
): EconomyMeasurement {
  const maxKills = opts?.maxKills ?? 40_000
  // Secondary stall guard: a permanently-defeated best floor can yield
  // zero kills, so maxKills alone can't catch every degenerate loop.
  const maxIterations = opts?.maxIterations ?? Math.ceil(maxKills / 4)
  const session = makeSession(seed)
  const player = session.player
  const totals = session.simRunTotals
  const cap = getMainStatCap('mortal')

  // Mortal prefix = canonical loop minus the tribulation/ritual tail.
  const tribulationIndex = CANONICAL_EARLY_LOOP.findIndex(
    (step) => step.kind === 'tribulation',
  )
  if (tribulationIndex < 0) throw new Error('canonical loop has no tribulation step')
  runLoop(session, CANONICAL_EARLY_LOOP.slice(0, tribulationIndex))

  const mortal = REALMS.find((realm) => realm.id === 'mortal')!
  const allCapped = () =>
    MAIN_STAT_KEYS.every((stat) => player.baseStats[stat] >= cap)
  const bodyDone = () =>
    getBodyRefinementCompletedTiers(player) >= BODY_REFINEMENT_TIERS.length
  const predicate = () => bodyDone() && allCapped()
  const tWall = () => totals.battleSeconds + totals.idleCultivationSeconds

  let statAxisVerdict: StatAxisVerdict = 'unresolved'
  let statAxisResolvedAtSeconds: number | null = null
  let outcome: PerfectionOutcome | null = null

  let allocateCursor = 0
  const spendPointsRoundRobin = () => {
    while (player.attributePoints > 0) {
      const uncapped = MAIN_STAT_KEYS.filter((stat) => player.baseStats[stat] < cap)
      if (uncapped.length === 0) break
      const stat = uncapped[allocateCursor++ % uncapped.length]
      if (stat === undefined || !session.allocateAttribute(stat)) break
    }
  }

  let iterations = 0
  let boundReason: SafetyBoundReason | null = null
  while (outcome === null) {
    // Termination precedence (spec sec.3.3 step 5) - each bound records
    // WHICH guard fired so a stall can't masquerade as maxKills.
    if (predicate()) {
      outcome = 'achieved'
      break
    }
    if (totals.enemiesDefeated >= maxKills) {
      outcome = 'safety_bound'
      boundReason = 'max_kills'
      break
    }
    if (iterations >= maxIterations) {
      outcome = 'safety_bound'
      boundReason = 'max_iterations'
      break
    }
    if (statAxisVerdict === 'proven_infeasible' && bodyDone()) {
      outcome = 'proven_infeasible'
      break
    }
    iterations++

    // Iteration: farm best cleared floor -> gear -> invest -> allocate.
    const best = player.completedStageIds[player.completedStageIds.length - 1]
    if (!best) {
      outcome = 'safety_bound'
      boundReason = 'no_cleared_stage'
      break
    }
    session.runStage(best)
    session.equipAll()
    while (session.investRefinement() > 0) { /* drain */ }
    spendPointsRoundRobin()

    // Stat axis resolution (first condition wins, checked per iteration).
    if (statAxisVerdict === 'unresolved') {
      if (allCapped()) {
        statAxisVerdict = 'achieved'
        statAxisResolvedAtSeconds = tWall()
      } else if (player.realmLevel >= mortal.maxLevel && player.attributePoints === 0) {
        statAxisVerdict = 'proven_infeasible'
        statAxisResolvedAtSeconds = tWall()
      }
    }

    // Grind breakthroughs toward the level cap - one level per pass;
    // cultivateTick clamps at the current level's requirement.
    if (player.realmLevel < mortal.maxLevel && player.realmId === 'mortal') {
      const required = getRequiredCultivation(player.realmId, player.realmLevel)
      const deficit = required - player.cultivation
      if (deficit > 0) {
        const perSecond = player.cultivationPerSecond
        if (perSecond > 0) {
          session.cultivate(deficit / perSecond + 1)
        }
      }
      session.breakthroughIfReady()
    }
  }

  return toMeasurement(
    session,
    outcome,
    boundReason,
    statAxisVerdict,
    statAxisResolvedAtSeconds,
    null,
  )
}
