// BETA SCOPE LOCK v2 (phase-2) - vitest setup file. The historical
// suite was authored pre-lock: sword/body/hidden rituals all ride
// chooseCultivationPath, which now fails closed on non-beta ways.
// Replaying that suite against the locked allow-list would turn every
// way exercise into a false negative, so each test file's module graph
// starts with the FULL catalog admitted - pre-beta behavior - while
// suites asserting the lock call lockBetaWaysForTests() to re-pin the
// canonical {spell_pathway} set. Vitest isolates modules per file, so
// the unlock can never leak into a sibling suite or into production.
//
// Phase-6 extends the same contract to BETA_FEATURES: the historical
// suite exercises hidden/companion/daily machinery the lock now gates,
// so the feature table also starts fully admitted and lock suites call
// lockBetaFeaturesForTests().
//
// The same contract applies to BETA_TALENT_IDS: pre-lock effect-table
// suites resolve ids outside the beta roster (the Great Dao reward
// pham_nhan_chi_cot, PARKED talents), so the talent roster also starts
// fully admitted and lock suites call lockBetaTalentsForTests().
// The same contract applies to BETA_PLAYABLE_ELEMENTS: the beta opens
// fire only, but the historical suite (element boss matrix, phap_tu
// node catalogs) commits water/wood/metal/earth, so the element set
// also starts fully admitted and lock suites call
// lockBetaElementsForTests().
import { unlockAllWaysForTests } from '../src/core/game/__fixtures__/betaWaysUnlock'
import { unlockAllFeaturesForTests } from '../src/core/game/__fixtures__/betaFeaturesUnlock'
import { unlockAllTalentsForTests } from '../src/core/game/__fixtures__/betaTalentsUnlock'
import { unlockAllElementsForTests } from '../src/core/game/__fixtures__/betaElementsUnlock'

unlockAllWaysForTests()
unlockAllFeaturesForTests()
unlockAllTalentsForTests()
unlockAllElementsForTests()
