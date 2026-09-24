// Normal breakthrough admission gate (extracted from
// GameManagerRealmAdvanceOps so core resolvers - notably
// core/realm/hidden/HiddenLineage.resolveBreakthroughType - can read
// "every ordinary requirement met" without depending on the ops
// class). The ops methods delegate here; the public API stays
// gameManager.realmAdvanceOps.*.
//
// QI-D5 - Truc Co admission has TWO mandatory inputs: realmLevel >=
// CORE_REALM_LEVEL AND the qi_refining chapter-final stage cleared.
// Hidden grade/foundation inputs stay resolver-internal - they are
// not part of this normal admission gate (QI-D6: never rows, never
// rendered). Mortal stays level-only (its real transition is the
// initiation ritual, chooseCultivationPath).

import {
  CORE_REALM_LEVEL,
  QI_REFINING_BREAKTHROUGH_STAGE_ID,
  getNextRealm,
} from './realmSystem'
import { isRealmTransitionEnabled } from './ReleasePolicy'

export interface BreakthroughGatePlayer {
  realmId: string
  realmLevel: number
  completedStageIds: readonly string[]
}

/**
 * M-QI-03 - one row of the normal breakthrough requirement read-model.
 * The UI renders a label per key; `met` is the live predicate flag.
 */
export interface BreakthroughRequirementRow {
  key: 'level' | 'chapterClear'
  met: boolean
}

/**
 * The SAME predicate rows that drive canTriggerBreakthrough, exposed so
 * the UI can render unmet requirements instead of a bare disabled
 * button. mortal: [level]; qi_refining: [level, chapterClear]; other
 * realms: [] (their transitions are not player-gated in the authored
 * window).
 */
export function getBreakthroughRequirements(
  player: BreakthroughGatePlayer,
): BreakthroughRequirementRow[] {
  // M-F-CEILING - release policy decides whether the next transition may
  // be attempted at all; a closed transition reports no requirement rows
  // (TC -> KD stays authored but disabled in the Beta window).
  const nextRealmId = getNextRealm(player.realmId)?.id
  if (nextRealmId === undefined || !isRealmTransitionEnabled(player.realmId, nextRealmId)) {
    return []
  }
  if (player.realmId === 'mortal') {
    return [{ key: 'level', met: player.realmLevel >= CORE_REALM_LEVEL }]
  }
  if (player.realmId === 'qi_refining') {
    return [
      { key: 'level', met: player.realmLevel >= CORE_REALM_LEVEL },
      {
        key: 'chapterClear',
        met: player.completedStageIds.includes(QI_REFINING_BREAKTHROUGH_STAGE_ID),
      },
    ]
  }
  return []
}

/**
 * Unified breakthrough gate - one function for EVERY realm: true when
 * every ordinary requirement row is met. The hidden breakthrough
 * eligibility predicate ADDS its own inputs on top of this - it never
 * weakens the ordinary gate (design sec.6).
 */
export function canTriggerBreakthrough(player: BreakthroughGatePlayer): boolean {
  const requirements = getBreakthroughRequirements(player)
  return requirements.length > 0 && requirements.every((row) => row.met)
}
