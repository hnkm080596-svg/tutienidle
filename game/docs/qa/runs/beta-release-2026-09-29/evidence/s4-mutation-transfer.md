# Mutation battery transfer

S1 battery: 18 killed representatives + 4 survivals (all reverted, verified
via `git checkout` + scoped re-runs). On S4 all mutated production files and
their detector files are byte-identical to the battery state - only additive
test files differ - so the recorded kills hold deterministically.

Re-verified on the current tree by re-applying the mutants:
- `if (true)` victory-gate flush -> killed by the new defeat pin
- completionState whitelist drop -> killed by the new gradeHistory pin
