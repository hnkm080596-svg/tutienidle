# Quick QA — enemy balance retune (2026-10-04)

Scope: `src/data/enemy/FoundationEnemies.ts` (Linh Lang 684/64/26 -> 190/30/15,
Linh Lang Vuong 550/34 -> 420/30), `src/data/enemy/EnemyRealmJump.test.ts` (new),
`tests/lab/enemyJourneyAudit.test.ts` (new lab harness), `docs/balance/enemies-review.md`,
`game/.gitignore` (.audit-out).

Risk map: domain `combat-and-tribulation`; one-hop = combat presentation +
loot/progression/persistence. unmappedPaths (.gitignore, doc, lab test) routed
manually — all non-production: lab test runs only under `vitest.lab.config.mts`
(main include = `src/**/*.test.ts` + `tests/architecture/**`). deepAuditCandidate=false.

## Attack ledger (quick)

| # | Hypothesis | Attack | Evidence | Verdict |
|---|---|---|---|---|
| 1 | Reward/economy invariant broken by retune | EnemyDropSink/AlchemyDrops/ChieuHienLenh + scoped vitest | 125 files / 1098 tests green | Rejected — green; rewards kept t2-equivalent, noted in doc as watch item |
| 2 | Field parity lost vs `foundationBeast` factory | Field-by-field diff of old call vs literal block | bossEligible:false was only the mult=1 path; element/power/resistance map identical; no tribulationPhases/enrage/bossTrigger/specialAttacks/signatureDrops on the old call; family + attackPresetId kept | Rejected |
| 3 | `level` feeds RealmPressure/damage calc | Census `.level` consumers on Enemy | Only `GameManagerStageOps.toDisplayEnemy` (UI label). RealmPressure keys on `realmId` (Enemy.ts comment) | Rejected — display only |
| 4 | Pinned battle outcomes / fingerprints moved | Full scoped suite + BalanceMatrix check | BalanceMatrix uses synthetic SWARM_MOB; BetaJourney/StageWaveSystem tests green | Rejected |
| 5 | Lab test leaks into main suite (slow CI) | Inspect vite.config.ts include | `src/**/*.test.ts` + `tests/architecture/**` only | Rejected |
| 6 | New tune still a wall / over-tune | Honest-entry sim rerun at each candidate | 684/518/260/220 all fail floor 1; 190 clears floor 1-4, frontier 5-9, boss cap — same shape as qi chapter (author intent) | Resolved by tune |
| 7 | Post-tune boss >2x baseline | Recompute shell ratio | 420/190 = 2.2x — still above 2x flag but deliberate cap-check (bite_multi x2.5 + enrage t60 + sudden-death two-sided ramp); GEARED-model loss at floor 10 is expected for an entry-lite build | Accepted, documented |
| 8 | Save/persistence impact | No persisted field changes — enemy stats resolve at spawn from ENEMIES | Saves store progress not enemy stats | Rejected |
| 9 | `.gitignore` hides source | Diff review | Only `.audit-out/` (writeJson dump dir) | Rejected |

Coverage gaps recorded: GEARED/entry sims are lower-bound models (no per-floor
skill/node growth, randomized attribute spend) — flagged in the report doc as
"lower bound, needs real telemetry".

Verdict label (evidence, not run outcome): **PASS WITH EVIDENCE** — all attacks
resolved by inspection or green gates; the one confirmed defect (unplayable
foundation wall, 0 wins in 100+ measured runs across 4 stat candidates) is the
change's own subject and is fixed by this diff.
