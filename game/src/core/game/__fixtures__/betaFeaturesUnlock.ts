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
// with the PRODUCTION feature table admitted - the mixed on/off set in
// betaFeatureFlags.ts - while suites asserting the lock call
// lockBetaFeaturesForTests() to re-pin the canonical all-false table
// and suites exercising hidden machinery call unlockAllFeaturesForTests().
import { BETA_FEATURES, type BetaFeatureName } from '../../betaScope'

const mutableFeatures = BETA_FEATURES as Record<BetaFeatureName, boolean>

// Snapshot of the authored table, captured at module init - before any
// suite's pin/unlock mutates it. Vitest isolates modules per test file,
// so this capture always equals the shipped betaFeatureFlags.ts values.
const PRODUCTION_FEATURES = { ...BETA_FEATURES } as Record<BetaFeatureName, boolean>

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

/** Re-pin the authored production table - the mixed on/off set shipped
 *  in betaFeatureFlags.ts - for the duration of the calling test file.
 *  The global setup calls this so every suite runs the real beta scope
 *  by default; a suite that unlocked mid-file calls it to restore
 *  production instead of the all-false lock. */
export function mirrorProductionFeaturesForTests(): void {
  for (const [name, admitted] of Object.entries(PRODUCTION_FEATURES)) {
    mutableFeatures[name as BetaFeatureName] = admitted
  }
}
