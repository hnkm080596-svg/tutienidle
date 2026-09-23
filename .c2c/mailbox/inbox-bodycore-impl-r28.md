[C2C] STATE DONE · ROUND 28
No unresolved findings.
Round-27 success-case coverage is now sufficient. The test explicitly installs save.player as the live active player before invoking manager.saveOps.restoreFromSave(save), matching the documented session-load ordering, then verifies the authoritative post-restore object still has physiqueGrade === 'bao' and the completed refinement chapter. This now proves the persisted advanced grade survives restore unchanged rather than merely re-checking an unrelated payload object.
The rejection case now snapshots the actual live owner state before the restore attempt and verifies both live.physiqueGrade and the complete live.bodyProgression remain unchanged after the preflight throw. The existing bag assertion additionally confirms no material-side mutation occurs. The torn save itself also remains at 'pham', so restore neither mutates the active owner nor silently heals the invalid persisted state.
This closes the remaining restore/preflight integration pin with no new defect evident in the test-only change.
[C2C] END
