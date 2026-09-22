# QA Report — M-D Perfection Economy Simulation (quick)

Scope: `EarlyGameSession.ts` sim seams + `PerfectionEconomy.ts` + `PerfectionEconomy.test.ts` (3 unmapped paths — simulation infrastructure, manually routed: no domain pack applies; closest consumers are the sibling sim suites, verified green).

## Verdict: PASS WITH EVIDENCE

## Hypotheses → resolution

| # | Hypothesis | Evidence | Result |
|---|---|---|---|
| 1 | Parity-off regression on existing consumers | `MortalChapterJourney` + `EarlyGameSession` + `QrProbe` suites: 11/11 green with flag default `false` | Closed |
| 2 | `inStageDrive` leaks if the drive throws → all later `cultivate()` calls misclassified as battle-carried | `try/finally` resets the flag at `runStage` exit — verified in code | Closed |
| 3 | Mid-battle `breakthroughIfReady` mutates player during a frozen combat build | Production parity (`App.vue` auto-breakthroughs during combat); `CombatBuild` freezes entity stats at battle start — mid-battle realm changes can't rewrite the running battle | Closed |
| 4 | `drainRefinement` non-termination | `investBodyChapter` returns essence consumed; each `>0` call reduces bag or advances progress — monotonic, bounded by finite bag; full tiers → `0` | Closed |
| 5 | `tinhHoaGained` delta corrupted by drains | Pinned order: pre-drain → `essenceBefore` → battle (loot adds only) → `essenceAfter` — drains sit outside the measured window | Closed |
| 6 | Zero-kill stall escapes `maxKills` bound | **Was a real gap pre-OCR** — fixed with `maxIterations` secondary guard + `!best` early exit | Closed (fix verified) |
| 7 | `Reward` exhaustiveness check could go stale if `Reward` gains a field | **Was a real gap pre-OCR** — `Record<keyof Reward, true>` literal now fails compile on new fields | Closed (fix verified) |
| 8 | Missing-battle defeat inflates kill count silently | `counted:false` → `uncountedStageRuns++`; suite asserts `=== 0` | Closed |
| 9 | Non-determinism in measurement | Same-seed `toEqual` test green; loot stream seeded `seed ^ 0x9e3779b9` | Closed |
| 10 | `simRunTotals` not reset on `restoreCheckpoint` | Cumulative-by-design (session-activity counters); M-D doesn't use restore; parity-off consumers don't read totals | Low note, not a defect |

## Evidence

- `PerfectionEconomy.test.ts`: 11/11 green (driven run ~60 s/seed).
- 3-seed measurement identical structure; kill/income within ±25% of analytic.
- `uncountedStageRuns === 0` on all runs.
- Imports audit: `EarlyGameSession` imported only by `core/simulation/**` + tests — nothing on the gameplay path.

## Notes / deferred

- `lastRunStats` retains the previous run's record on non-run results (`locked`/`missing`/`refused`) — intended semantics ("last actual run"), documented.
- `bodyCompletedAtSeconds` granularity is stage-boundary by design (spec-pinned).
