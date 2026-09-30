// BETA SCOPE LOCK v2 (Phase-6) - test-only flag-flip seam, the feature
// table's counterpart to betaWaysUnlock.ts. Production gates stay
// beta-locked; a suite exercising machinery owned by a scope-hidden
// feature (hidden lineage, hidden beasts, companion gifts, hidden
// channels, daily reset, scope-hidden surfaces) unlocks the table for
// the file's own duration. Vitest isolates modules per test file, so
// an unlock here can never leak into a sibling suite or into
// production.
//
// The global setup file (tests/setup.betaScope.ts) starts every suite
// with the FULL feature table admitted - pre-beta behavior - while
// suites asserting the lock call lockBetaFeaturesForTests() to re-pin
// the canonical all-false table.
import { BETA_FEATURES, type BetaFeatureName } from '../../betaScope'

const mutableFeatures = BETA_FEATURES as Record<BetaFeatureName, boolean>

/** Admit every feature for the duration of the calling test file. */
export function unlockAllFeaturesForTests(): void {
  for (const name of Object.keys(mutableFeatures) as BetaFeatureName[]) {
    mutableFeatures[name] = true
  }
}

/** Restore the canonical beta table (every feature false) for the
 *  duration of the calling test file. Suites asserting beta gating
 *  call this to undo the global test setup's unlock. */
export function lockBetaFeaturesForTests(): void {
  for (const name of Object.keys(mutableFeatures) as BetaFeatureName[]) {
    mutableFeatures[name] = false
  }
}
