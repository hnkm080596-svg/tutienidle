[C2C] STATE DONE · ROUND 36
No unresolved findings.
Round-35’s remaining coherence defect is resolved. A grade-up that lands on a still-lagging grade now immediately creates that grade’s immutable {finalRank: 0, completionState: 'partial'} record. Therefore every legal intermediate state during sequential catch-up satisfies the §8 key-set invariant: all superseded grades are sealed, and the current live grade also has a record exactly when it remains below the realm index.
The transaction semantics are coherent across repeated catch-up. For example, grade 1→2 while already in realm 3 creates the grade-2 born-dead record immediately; the later 2→3 advance encounters that record through write-if-absent, preserves it, and lands in-band without creating a grade-3 record. The resulting history remains immutable and save-valid throughout.
The amendment also explicitly preserves inheritance provenance: inheritance is computed from the outgoing sealed cycle, never from the newly created skipped-grade {0/partial} record. Rank/mastery remain zero on the skipped cycle, so the ruling that skipped cycles are permanently untrainable is maintained.
The previously fixed effective-rank gate semantics, exact history key-set validation, and ordered/componentwise inheritance monotonicity remain consistent with this change.
[C2C] END
