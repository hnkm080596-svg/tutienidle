[C2C] STATE DONE · ROUND 16
No unresolved findings.
game/src/core/realm/ReleasePolicy.test.ts now covers the missing Round-14 invariant directly: a beyond-ceiling golden_core save with an already-owned artifact whose artifactId matches the active path is passed through normalizeArtifactProgress(), and ownership survives intact.
The assertions also protect non-default persisted progression state rather than merely checking existence: grade: 'linh', realmLevel: 4, and experience: 7 all survive normalization. This distinguishes legitimate field-level normalization from the prohibited behavior of deleting or resetting an artifact merely because its owner is currently beyond the release ceiling.
The earlier unowned case remains useful alongside this new owned case: release policy still prevents new/domain access beyond the ceiling, while persisted ownership is preserved. No regression is introduced by this test-only change.
[C2C] END
