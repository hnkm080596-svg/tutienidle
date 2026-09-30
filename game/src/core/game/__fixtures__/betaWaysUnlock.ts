// BETA SCOPE LOCK v2 (phase-2) - test-only flag-flip seam. Production
// gates stay beta-locked; a suite that exercises a non-beta way
// (sword/body/hidden rituals are all out of beta scope) unlocks the
// allow-list for the file's own duration. Vitest isolates modules per
// test file, so an unlock here can never leak into a sibling suite or
// into production.
//
// spell_pathway needs NO unlock to ride commitFiveElementInitiation -
// it is the only beta way. It simply can never ride
// chooseCultivationPath (a permanent contract, not a flag).
import { BETA_PLAYABLE_WAYS } from '../../betaScope'
import {
  CULTIVATION_PATH_MODULES,
  type CultivationWayId,
} from '../../player/CultivationPathKit'
import { CAST_LEVELING_THRESHOLDS } from '../../skill/CastLeveling'
import { PHAP_TU_NODES } from '../../../data/progression/PhapTuNodes'
import { SKILL_CORE_NODES } from '../../../data/progression/SkillCoreNodes'
import type { ElementType } from '../../element/ElementType'
import type { GameManager } from '../GameManager'
import type { PlayerData } from '../../player/Player'

const mutableWays = BETA_PLAYABLE_WAYS as Set<CultivationWayId>

/** Admit every catalog way for the duration of the calling test file. */
export function unlockAllWaysForTests(): void {
  for (const path of Object.values(CULTIVATION_PATH_MODULES)) {
    for (const wayId of Object.keys(path.ways)) {
      mutableWays.add(wayId as CultivationWayId)
    }
  }
}

/** Restore the canonical beta allow-list ({spell_pathway}) for the
 *  duration of the calling test file. Suites asserting beta gating
 *  call this to undo the global test setup's unlock. */
export function lockBetaWaysForTests(): void {
  mutableWays.clear()
  mutableWays.add('spell_pathway')
}

/** Arrange + run the ONE canonical spell initiation for suites that
 *  need a committed spell_pathway player: the offer gate (linh_bao
 *  Lv3 casts) and the phap_tu node catalog are arranged first, then
 *  the atomic op commits path + way + element + realm in one call.
 *  Throws when the op rejects so call sites fail loudly, not with a
 *  quietly uncommitted player. */
export function commitSpellInitiationForTest(
  gameManager: GameManager,
  player: PlayerData,
  element: ElementType = 'fire',
): void {
  gameManager.catalogOps.registerProgressionNodes(PHAP_TU_NODES)
  gameManager.catalogOps.registerProgressionNodes(SKILL_CORE_NODES)
  player.skillCastCounts = {
    ...player.skillCastCounts,
    linh_bao: CAST_LEVELING_THRESHOLDS.linh_bao!.lv3,
  }
  const result = gameManager.realmAdvanceOps.commitFiveElementInitiation(element, player)
  if (!result.ok) {
    throw new Error(`commitSpellInitiationForTest(${element}) failed: ${result.reason}`)
  }
}
