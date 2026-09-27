// P6-M1 - declarative early-game loop driver: the canonical mortal ->
// Quan Khi -> qi_refining script as data, executed through the session's
// step primitives, producing a LoopReport as closure evidence. Steps are
// CLOSED-UNION actions on production seams only - a step needing a debug
// hook is a gap, not a script entry.
import { getRequiredCultivation } from '../../realm/realmSystem'
import type { CultivationPathId, CultivationWayId } from '../../player/CultivationPathKit'
import type { EarlyGameSession, EarlyGameSnapshot, StageRunResult, TribulationRunResult } from './EarlyGameSession'

export type LoopStep =
  | { kind: 'cultivate'; seconds: number }
  | { kind: 'breakthrough' }
  /** Cultivate -> breakthrough repeatedly until `level` (or cap). */
  | { kind: 'grind_to_level'; level: number }
  | { kind: 'stage'; stageId: string }
  /** Re-farm a cleared stage N times (gear/insight income). */
  | { kind: 'farm'; stageId: string; runs: number }
  /** The grind-retry loop: attempt, cultivate+breakthrough, retry. */
  | { kind: 'stage_until_victory'; stageId: string; maxAttempts: number }
  | { kind: 'equip_all' }
  /** Spend every attributePoint on `stat` via allocateAttributePoint. */
  | { kind: 'allocate_all'; stat: 'strength' | 'dexterity' | 'intelligence' | 'attunement' | 'vitality' }
  /** Invest held Tinh Hoa Pham The into body refinement. */
  | { kind: 'invest_refinement' }
  /** The wall response a real player uses: farm the best cleared
   * floor `runs` times, then equip + refine + allocate the spoils. */
  | { kind: 'growth_cycle'; runs: number }
  | { kind: 'tribulation'; targetRealmId: string }
  | { kind: 'ritual'; path: CultivationPathId; way: CultivationWayId }
  | { kind: 'purchase_node'; nodeId: string }

export interface LoopStepRecord {
  step: LoopStep
  result: string
  realmAt: string
}

export interface LoopReport {
  seed: number
  steps: LoopStepRecord[]
  /** First step that did not achieve its intent, if any. */
  failedAt: number | null
  snapshot: EarlyGameSnapshot
}

/** The canonical P6 loop: creation -> mortal floors -> Quan Khi ->
 * ritual -> qi_refining floor. Includes the full growth surface a real
 * player uses (farming, gear, refinement, attributes, node spend) -
 * the loop is evidence that the game progresses without dev
 * intervention, so every step rides a production seam. */
export const CANONICAL_EARLY_LOOP: readonly LoopStep[] = [
  // The production mortal chain is 10 floors (thanh_van zone, linear
  // unlock); floor N requires realmLevel N - the loop grinds between
  // defeats and realm-gates exactly like a real player.
  { kind: 'stage_until_victory', stageId: 'mortal_dong_1', maxAttempts: 8 },
  { kind: 'allocate_all', stat: 'strength' },
  { kind: 'stage_until_victory', stageId: 'mortal_dong_2', maxAttempts: 8 },
  { kind: 'stage_until_victory', stageId: 'mortal_dong_3', maxAttempts: 8 },
  { kind: 'growth_cycle', runs: 5 },
  { kind: 'stage_until_victory', stageId: 'mortal_dong_4', maxAttempts: 8 },
  { kind: 'stage_until_victory', stageId: 'mortal_dong_5', maxAttempts: 8 },
  { kind: 'growth_cycle', runs: 5 },
  { kind: 'stage_until_victory', stageId: 'mortal_dong_6', maxAttempts: 8 },
  { kind: 'stage_until_victory', stageId: 'mortal_dong_7', maxAttempts: 8 },
  { kind: 'growth_cycle', runs: 5 },
  { kind: 'stage_until_victory', stageId: 'mortal_dong_8', maxAttempts: 8 },
  { kind: 'stage_until_victory', stageId: 'mortal_dong_9', maxAttempts: 8 },
  { kind: 'growth_cycle', runs: 5 },
  { kind: 'stage_until_victory', stageId: 'mortal_dong_10', maxAttempts: 8 },
  { kind: 'growth_cycle', runs: 10 },
  { kind: 'tribulation', targetRealmId: 'qi_refining' },
  { kind: 'ritual', path: 'sword', way: 'sword_pathway' },
  { kind: 'purchase_node', nodeId: 'thich_can' },
  { kind: 'stage_until_victory', stageId: 'qi_refining_forest', maxAttempts: 10 },
]

export function runLoop(
  session: EarlyGameSession,
  steps: readonly LoopStep[],
): LoopReport {
  const records: LoopStepRecord[] = []
  let failedAt: number | null = null

  const realmAt = () => `${session.player.realmId}:${session.player.realmLevel}`
  const record = (step: LoopStep, result: string) =>
    records.push({ step, result, realmAt: realmAt() })

  steps.forEach((step, index) => {
    if (failedAt !== null) return

    let ok = true
    switch (step.kind) {
      case 'cultivate': {
        session.cultivate(step.seconds)
        record(step, 'ok')
        break
      }
      case 'breakthrough': {
        ok = session.breakthroughIfReady()
        record(step, ok ? 'ok' : 'not-ready')
        break
      }
      case 'grind_to_level': {
        // Descending target (already past `level`) is a no-op success.
        while (session.player.realmLevel < step.level) {
          const req = getRequiredCultivation(
            session.player.realmId,
            session.player.realmLevel,
          )
          session.cultivate(req / session.player.cultivationPerSecond + 1)
          if (!session.breakthroughIfReady()) {
            ok = false
            break
          }
        }
        record(step, ok ? 'ok' : 'stalled')
        break
      }
      case 'stage': {
        const result: StageRunResult = session.runStage(step.stageId)
        ok = result === 'victory'
        record(step, result)
        break
      }
      case 'farm': {
        let wins = 0
        for (let i = 0; i < step.runs; i++) {
          if (session.runStage(step.stageId) === 'victory') wins++
        }
        record(step, `${wins}/${step.runs}`)
        break
      }
      case 'equip_all': {
        record(step, `+${session.equipAll()}`)
        break
      }
      case 'allocate_all': {
        let spent = 0
        while (session.player.attributePoints > 0 && session.allocateAttribute(step.stat)) {
          spent++
        }
        record(step, `+${spent}`)
        break
      }
      case 'invest_refinement': {
        record(step, `+${session.investRefinement()}`)
        break
      }
      case 'growth_cycle': {
        const best = session.player.completedStageIds[
          session.player.completedStageIds.length - 1
        ]
        let wins = 0
        if (best) {
          for (let i = 0; i < step.runs; i++) {
            if (session.runStage(best) === 'victory') wins++
          }
        }
        const equipped = session.equipAll()
        const refined = session.investRefinement()
        let spent = 0
        while (session.player.attributePoints > 0 && session.allocateAttribute('strength')) {
          spent++
        }
        record(step, `${wins}/${step.runs} eq+${equipped} rf+${refined} attr+${spent}`)
        break
      }
      case 'stage_until_victory': {
        let outcome: StageRunResult = 'missing'
        for (let attempt = 0; attempt < step.maxAttempts; attempt++) {
          outcome = session.runStage(step.stageId)
          if (outcome === 'victory') break
          if (outcome === 'refused' || outcome === 'missing') break
          // 'defeat' and 'locked' both resolve through growth: floors
          // are realmLevel-gated, and a real player's wall response is
          // re-farm the best cleared floor for drops, then re-equip +
          // refine + allocate, then grind cultivation - not just level.
          const best = session.player.completedStageIds[
            session.player.completedStageIds.length - 1
          ]
          if (best) session.runStage(best)
          session.equipAll()
          session.investRefinement()
          while (
            session.player.attributePoints > 0 &&
            session.allocateAttribute('strength')
          ) { /* spend until dry */ }
          const req = getRequiredCultivation(
            session.player.realmId,
            session.player.realmLevel,
          )
          session.cultivate(req / session.player.cultivationPerSecond + 1)
          session.breakthroughIfReady()
        }
        ok = outcome === 'victory'
        record(step, outcome!)
        break
      }
      case 'tribulation': {
        const result: TribulationRunResult = session.runTribulation(step.targetRealmId)
        ok = result === 'victory'
        record(step, result)
        break
      }
      case 'ritual': {
        ok = session.performRitual(step.path, step.way)
        record(step, ok ? 'ok' : 'refused')
        break
      }
      case 'purchase_node': {
        const before = session.player.skillInsight
        ok = session.purchaseNode(step.nodeId)
        record(step, ok ? `ok:-${before - session.player.skillInsight}` : 'refused')
        break
      }
    }

    if (!ok) failedAt = index
  })

  return {
    seed: session.seedValue,
    steps: records,
    failedAt,
    snapshot: session.snapshot(),
  }
}
