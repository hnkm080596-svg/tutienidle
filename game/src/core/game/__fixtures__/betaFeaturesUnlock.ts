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
// with the FULL feature table admitted - pre-beta behavior. Suites
// asserting the shipped beta state call
// restoreAuthoredFeaturesForTests(); suites asserting fail-closed
// machinery call lockBetaFeaturesForTests() to force every feature
// off.
import { BETA_FEATURES, type BetaFeatureName } from '../../betaScope'

const mutableFeatures = BETA_FEATURES as Record<BetaFeatureName, boolean>

/**
 * Snapshot of the authored feature table, captured at module
 * evaluation - before the global setup's unlockAllFeaturesForTests()
 * mutates the live table. restoreAuthoredFeaturesForTests() pins the
 * real beta offer state (as of 2026-10-09: only equipmentWash +
 * equipmentRefine enabled; every other feature still false).
 */
const AUTHORED_BETA_FEATURES: Readonly<Record<BetaFeatureName, boolean>> =
  Object.freeze({ ...BETA_FEATURES })

export { AUTHORED_BETA_FEATURES }

/** Admit every feature for the duration of the calling test file. */
export function unlockAllFeaturesForTests(): void {
  for (const name of Object.keys(mutableFeatures) as BetaFeatureName[]) {
    mutableFeatures[name] = true
  }
}

/** Force EVERY feature off for the duration of the calling test file -
 *  stricter than the authored beta table (wash/refine ship in beta).
 *  Use for fail-closed mechanism coverage (a disabled feature must
 *  still reject); suites asserting the shipped beta state call
 *  restoreAuthoredFeaturesForTests() instead. */
export function lockBetaFeaturesForTests(): void {
  for (const name of Object.keys(mutableFeatures) as BetaFeatureName[]) {
    mutableFeatures[name] = false
  }
}

/** Restore the authored beta feature table exactly as
 *  betaFeatureFlags.ts ships it. Suites asserting the canonical beta
 *  offer state call this to undo the global test setup's unlock. */
export function restoreAuthoredFeaturesForTests(): void {
  for (const name of Object.keys(mutableFeatures) as BetaFeatureName[]) {
    mutableFeatures[name] = AUTHORED_BETA_FEATURES[name]
  }
}
