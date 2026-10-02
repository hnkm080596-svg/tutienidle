// Wave-2 provenance fixture builders - committedOutcome and alchemyJob
// literals in probe tests must now carry the provenance records the
// real writers stamp (qa-fixpoint wave 2: F-TRB-FORGE +
// F-ALCH-JOB-FORGE). These helpers build replay-VALID records so a
// probe exercises its own claim instead of tripping the witness
// check; forgery probes mutate the witness deliberately and expect
// rejection. Implementations live beside the systems they witness
// (src *.fixture.ts convention); this barrel keeps architecture
// probes on a single import path.
//
// ASCII only (P15).

export { commitWitnessFor as witnessedCommitOutcomeFields } from '../../../src/core/tribulation/TribulationCommitWitness.fixture'
export { alchemyJobFixture as witnessedAlchemyJob } from '../../../src/core/alchemy/AlchemyJob.fixture'
