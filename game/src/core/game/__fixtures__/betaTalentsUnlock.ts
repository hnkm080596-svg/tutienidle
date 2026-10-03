// BETA SCOPE LOCK v2 - test-only flag-flip seam, the talent roster's
// counterpart to betaWaysUnlock.ts. Production gates stay beta-locked;
// a suite exercising talent DATA wiring that predates the lock (the V4
// effect-table tests resolve ids outside the beta roster, e.g.
// pham_cot) unlocks the roster for the file's own duration. Vitest
// isolates modules per test file, so an unlock here can never leak
// into a sibling suite or into production.
//
// The seam is a roster-open flag, not a catalog mutation: it imports
// no talent data modules, so it never pre-caches a catalog a test file
// intends to vi.mock.
import { BETA_TALENT_ROSTER } from '../../betaScope'

/** Admit every defined talent for the duration of the calling test file. */
export function unlockAllTalentsForTests(): void {
  BETA_TALENT_ROSTER.unlocked = true
}

/** Restore the canonical beta roster (creation allow-list +
 *  breakthrough pools) for the duration of the calling test file.
 *  Suites asserting beta gating call this to undo the global test
 *  setup's unlock. */
export function lockBetaTalentsForTests(): void {
  BETA_TALENT_ROSTER.unlocked = false
}
