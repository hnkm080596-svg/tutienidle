// BETA SCOPE LOCK v2 (phase-2) - vitest setup file. The historical
// suite was authored pre-lock: sword/body/hidden rituals all ride
// chooseCultivationPath, which now fails closed on non-beta ways.
// Replaying that suite against the locked allow-list would turn every
// way exercise into a false negative, so each test file's module graph
// starts with the FULL catalog admitted - pre-beta behavior - while
// suites asserting the lock call lockBetaWaysForTests() to re-pin the
// canonical {spell_pathway} set. Vitest isolates modules per file, so
// the unlock can never leak into a sibling suite or into production.
import { unlockAllWaysForTests } from '../src/core/game/__fixtures__/betaWaysUnlock'

unlockAllWaysForTests()
