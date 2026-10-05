// BETA SCOPE LOCK v2 (phase-2) - test-only flag-flip seam, same
// contract as betaWaysUnlock / betaFeaturesUnlock / betaTalentsUnlock.
// The beta playable element set is {fire}; the historical suite
// exercises water/wood/metal/earth initiations (element boss matrix,
// phap_tu node catalogs), which the lock now fails closed on. A suite
// unlocking here admits every catalog element for the file's own
// duration. Vitest isolates modules per test file, so the unlock can
// never leak into a sibling suite or into production.
import { BETA_PLAYABLE_ELEMENTS } from '../../betaScope'
import { ELEMENT_ORDER } from '../../element/ElementLabels'
import type { ElementType } from '../../element/ElementType'

const mutableElements = BETA_PLAYABLE_ELEMENTS as Set<ElementType>

/** Admit every catalog element for the duration of the calling test file. */
export function unlockAllElementsForTests(): void {
  for (const element of ELEMENT_ORDER) {
    mutableElements.add(element)
  }
}

/** Restore the canonical beta allow-list ({fire}) for the duration of
 *  the calling test file. Suites asserting beta element gating call
 *  this to undo the global test setup's unlock. */
export function lockBetaElementsForTests(): void {
  mutableElements.clear()
  mutableElements.add('fire')
}
