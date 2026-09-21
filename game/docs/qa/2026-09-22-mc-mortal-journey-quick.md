# QA — M-C MortalChapterJourney Suite (quick)

Date: 2026-09-22 · Branch: `feat/mc-mortal-journey` · Mode: quick
Risk map: 0 domains, `deepAuditCandidate: false` — all changed paths unmapped (simulation/test infra + docs). No production runtime file touched (`EarlyGameSession.ts` is the headless harness; `EarlyGameBootstrap.ts`/`BattleDriver.ts` only mention it in comments — no runtime import).

## Task-owned paths

- `core/simulation/earlygame/MortalChapterJourney.test.ts` (new)
- `core/simulation/earlygame/EarlyGameSession.ts` (seam: `restoreCheckpoint`, mutable `player`, save imports)
- `core/simulation/earlygame/EarlyGameSession.test.ts` (trimmed — legs moved to suite)
- `core/simulation/M0LoopProbe.test.ts` (deleted)
- `docs/p7/missions/mc-mortal-journey.{spec,plan}.md`

## Invariant ledger

| # | Invariant | Evidence |
|---|---|---|
| INV-1 | Journey legs use production seams only | All legs call session methods → production ops; creation via `applyCreationProfile` |
| INV-2 | Rejected boundary actions leave touched state identical | Leg C `untouched()` parity asserts (realm/path/way/stages/nodes/points) |
| INV-3 | Restore parity on persisted journey fields | Leg D exact `toEqual` minus documented transient `tribulationState` |
| INV-4 | Same seed → identical snapshot | Leg E |
| INV-5 | No assertions beyond the `mortal_dong_5` wall | `qi_refining_forest` pinned `'locked'` (Zones.ts chain); wall characterization test verbatim |
| INV-6 | Harness free of `stores/*`/Pinia deps | `EarlyGameSession.ts` imports `services/save/*` only; owner injected by caller (external-review pin) |

## Hypotheses (state → action → transition → side effect → persisted)

1. **Restore reject leaves stale pointer** — `restoreCheckpoint` re-points `this.player` only on `status==='ok'`; fail-closed. RESOLVED (code).
2. **Restored Pinia `$state` breaks subsequent ops** — Leg D runs `runStage('mortal_dong_3')` victory + `completedStageIds` on the restored proxy; manager-backed continuation proves catalogs+skills+combat live on the fresh manager. RESOLVED (test).
3. **Session methods cache the old player ref** — all seams read `this.player` at call time; re-point is picked up. RESOLVED (code).
4. **Circular import** `core/simulation → services/save` — `SaveSystem` imports only `type GameManager`; type-check + 476 tests green. RESOLVED.
5. **Fake-timer leak** — `vi.useRealTimers()` in `finally`; timers scoped to Leg D's build+restore window only. RESOLVED (code).
6. **Seed-99 `resumed` RNG fragility** — deterministic seed; the `mortal_dong_3` victory pin is an intentional regression pin, not a flake source. ACCEPTED.
7. **Probe deletion loses coverage** — probe's only assertion was `expect(true)`; semantic parity verified leg-by-leg (bootstrap/floor loop/ladder/tribulation/ritual/node/bag all covered; QR1 debug trace unreachable under canonical wall — pinned as `locked` instead). RESOLVED.
8. **Trimmed session tests lose coverage** — each removed leg has a suite equivalent (mortal loop→A, ritual+node→B/D, determinism→E). RESOLVED.
9. **Save object mutated by restore** — `restoreGameSession` clones internally (`structuredClone` in `player.restoreFromSave`); save treated as value. RESOLVED (code, mirrors R10 AR-12).

## Verdict

**PASS WITH EVIDENCE** — 12/12 focused + 476 simulation/save-scope tests green; type-check clean; zero confirmed defects. No production edits made during QA.
