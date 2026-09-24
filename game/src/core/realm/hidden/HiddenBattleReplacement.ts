// Hidden battle-replacement seam (design 2026-09-23 sec.9, master spec sec.8
// HIDDEN-B pin) - the Mortal Ancient Beast trial replaces the player's
// CURRENT stage battle with a single survival fight. This module owns
// the resolver+runner registries; GameManagerTurnBattleOps.startStage
// owns the single dispatch point. Skeleton ships the registries empty -
// no stage is ever replaced until HIDDEN-B registers its pair.
//
// Contract:
//   - a resolver inspects (player, stage) and returns a plan ONLY when
//     the stage battle must be replaced by the hidden trial battle.
//     Returning undefined keeps the normal stage flow.
//   - a runner executes one plan kind against the battle ops (it owns
//     enemy pick, survival rounds, reward binding); it returns true
//     when the replacement launched - the caller then returns without
//     touching stage wave state. A plan with no registered runner is
//     contract-corrupt: startStage treats it as no plan (fail-open to
//     the normal stage, never a soft-lock).

import type { PlayerData } from '../../player/Player'
import type { Stage } from '../../stage/Stage'

/** Mechanism-produced replacement plan (kind per HIDDEN_BODY_REALMS). */
export interface HiddenBattlePlan {
  /** Mechanism tag that produced this plan - runner registry key. */
  kind: string
  /** Trial enemy template id (resolved by the mechanism). */
  enemyId: string
  /** Survival rounds the trial demands (authored by the mechanism). */
  survivalRounds: number
  /** Mechanism-owned extra payload the runner may need. */
  details?: Record<string, unknown>
}

/**
 * Narrow launch surface the battle ops hand to runners (HIDDEN-B): the
 * ops implements it so a runner can spawn the replacement cycle without
 * depending on GameManagerTurnBattleOps directly.
 */
export interface HiddenBattleOps {
  launchHiddenBattle(ctx: HiddenBattleContext): boolean
}

export interface HiddenBattleContext {
  player: PlayerData
  stage: Stage
  plan: HiddenBattlePlan
  ops: HiddenBattleOps
  /** Would the interrupted cycle have repeated? startStage passes its
   * repeatContinuously param; the repeat path passes the live flag.
   * The trial records it so its victory can resume the stage's loop
   * (design sec.9.3 - farming continues after the hidden battle). */
  resumeRepeat: boolean
}

export type HiddenBattleReplacementResolver = (
  player: PlayerData,
  stage: Stage,
) => HiddenBattlePlan | undefined

const RESOLVERS: HiddenBattleReplacementResolver[] = []

const RUNNERS: Record<string, (ctx: HiddenBattleContext) => boolean> = {}

/** HIDDEN-B registers its resolver here (mortal ancient_beast_trial). */
export function registerHiddenBattleResolver(resolver: HiddenBattleReplacementResolver): void {
  RESOLVERS.push(resolver)
}

/** HIDDEN-B registers the runner for its plan kind. */
export function registerHiddenBattleRunner(
  kind: string,
  runner: (ctx: HiddenBattleContext) => boolean,
): void {
  RUNNERS[kind] = runner
}

/** Test hook only. */
export function clearHiddenBattleRegistrations(): void {
  RESOLVERS.length = 0
  for (const key of Object.keys(RUNNERS)) {
    delete RUNNERS[key]
  }
}

/** First resolver to produce a plan wins (one authored trial today). */
export function resolveHiddenBattleReplacement(
  player: PlayerData,
  stage: Stage,
): HiddenBattlePlan | undefined {
  for (const resolver of RESOLVERS) {
    const plan = resolver(player, stage)
    if (plan !== undefined) {
      return plan
    }
  }
  return undefined
}

/**
 * Dispatch a resolved plan to its registered runner. Returns true when
 * the replacement launched; false (or a missing runner) means the
 * caller proceeds with the normal stage battle.
 */
export function runHiddenBattleReplacement(ctx: HiddenBattleContext): boolean {
  const runner = RUNNERS[ctx.plan.kind]
  if (runner === undefined) {
    return false
  }
  return runner(ctx)
}
