# Pin tests for the 4 survived mutants

- F-MUT-RESTORE-PURGE: store-side stale `$state` key purge pinned
  (player.restoreFromSave.test.ts)
- F-MUT-ALCHEMY-ROUNDTRIP: populated alchemy job serialize->restore equality
  (SaveRoundTrip.test.ts)
- F-MUT-MASTERY-DEFEAT: kill-then-defeat battle leaves pending mastery
  unflushed; mutant `if(true)` flush killed
  (GameManager.battleEndPublication.test.ts)
- F-MUT-COMPLETION-ENUM: bogus completionState on an otherwise-canonical
  gradeHistory record rejected (saveAcceptance.test.ts)
