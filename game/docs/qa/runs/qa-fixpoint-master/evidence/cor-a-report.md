# QA report - local-correctness (blind audit)

- Commit under test: `a7d12edf` (branch `devin/qa-fixpoint`, detached worktree, no later commits pulled)
- Mode: quick (local-correctness / regression pass over the aggregate beta-scope state)
- Verdict: **FAIL WITH REASON** - 2 confirmed defects (1 Medium, 1 Low), each with a failing deterministic probe
- Probe file: `game/tests/architecture/betaLocalCorrectnessAudit.qa.test.ts` (34 probes: 30 pass as contract pins, 4 fail as defect evidence)
- Findings JSON: `game/docs/qa/2026-10-01-local-correctness-findings.json`

## Scope / risk map

Contract under attack: beta scope = Pham Nhan -> spell initiation -> Luyen Khi -> Truc Co. Scope-hidden systems must stay dormant (inert, never leak into live play); flagged saves must still LOAD; the luyen the chain (body_refinement -> meridian -> zhou_tian) is LIVE; hidden-breakthrough availability and The Tu / Kiem Tu way selection are user-gated hidden.

Surfaces probed:

- save boundary: `validateGameSaveShape`, `isSaveAcceptable`/`assertSaveAcceptable`, `unsupportedReleaseReason` (reason model + ordering + malformed slices)
- dormancy gates: hidden breakthrough mint (`resolveBreakthroughType`, `recordHiddenBreakthrough`), hidden beast counters, dormant way stat seams, stat-cap hidden bonus, worker capacity pin, quest scope, surface maps
- lifecycle/restore: `TribulationDirector` (start gates, committedOutcome settle/park/dedup, serialize/restoreRuntime round-trip, replacement-complete restore), `TribulationOutcomeService.settleOutcome`, `computeRestoreIdentity`
- transitions: `commitFiveElementInitiation` preflight/idempotent-reject drift, `isRealmTransitionEnabled`, `getBreakthroughRequirements`, `mortalBoundaryContractViolation`
- calculations: `calculateOfflineTime` (negative/over-cap), tu_linh_tran window split + unbuffed base recovery, alchemy job span enforcement

## Invariant ledger

| # | Invariant | Evidence |
|---|-----------|----------|
| 1 | Flagged dormant saves load: dormant alchemy job (pill_room + authored span) passes shape + acceptance and flags `dormant_alchemy_job`; live decompose flags `dormant_decompose_state`; hidden records flag `hidden_progression_state`; companion/artifact/formation/talent flag in order | probes pass |
| 2 | Hidden breakthrough is unforgeable under beta (`normal` resolution; recordHiddenBreakthrough no-op; parked hidden committedOutcome settles inert) | probes pass |
| 3 | Dormant way emits no stat modifiers; flagged `way_out_of_scope` | probes pass |
| 4 | Luyen the LIVE at mortal (body_refinement invests; meridian progression-gated not scope-gated) | probe pass |
| 5 | Hidden records never enter live math (stat cap, worker capacity, beast kills) | probes pass |
| 6 | Tribulation settle is receipt-deduped; parked records don't wedge `start()`; restoreRuntime is replacement-complete | probes pass |
| 7 | Restore identity covers every carried slice, excludes `lastSavedAt` | probe pass |
| 8 | Offline math clamps (no negative, 24h cap, buff windows split at expiry, no NaN at percentAtSave=0) | probes pass |
| 9 | `tribulation.cooldownUntil` bounded by provable forgery limit | **VIOLATED - F-LC-1** |
| 10 | `betaSupportedFor(player)` agrees with the slice-aware reason verdict | **VIOLATED - F-LC-2** |

## Verification evidence

- `npx vitest run tests/architecture/betaLocalCorrectnessAudit.qa.test.ts` -> 30 passed, 4 failed (exactly the defect probes)
- `npm run type-check` -> clean (0 errors)
- Baselines re-verified green earlier this session: `tests/architecture` 83 files / 721 passed / 7 skipped; services+stores+core/game 190 files / 1821 passed / 4 expected-fail

Failing-probe output (deterministic evidence):

```
F-LC-1a: validateGameSaveShape(..., tribulation:{cooldownUntil:9e15}).ok === true
         (expected false - unbounded field accepted)
F-LC-1b: director.restoreRuntime({cooldownUntil:9e15}); getCooldownSeconds() === 8998209119830
         (expected <= 300)
F-LC-1c: director.start(eligiblePlayer, stats, false, 'foundation_establishment') === false
         under the forged cooldown (progression wedge)
F-LC-2:  unsupportedReleaseReason(player, {alchemyJobs:[dormantJob]}) === 'dormant_alchemy_job'
         but betaSupportedFor(player) === true on the same player
```

## Findings

### F-LC-1 (Medium, high confidence) - unbounded `tribulation.cooldownUntil` wedges progression

Surface: `src/services/save/saveShapeValidation.ts` (tribulation slice, ~line 3676) + `src/core/tribulation/TribulationDirector.ts` (`restoreRuntime` ~line 799, `start` ~line 217).

The only legal writer stamps `Date.now() + TRIBULATION_COOLDOWN_SECONDS * 1000` (300 s). The validator accepts ANY non-negative finite value and restore applies it verbatim, so a hostile-but-shape-valid save parks `start()` forever - permanent deadlock on the beta's only forward transition (qi_refining -> foundation_establishment). Same provable-forgery class the codebase already bounds for alchemy job spans (F-A12-4) and building levels (F-A8-2); `lastSavedAt` is available at the validation site for the bound `cooldownUntil <= lastSavedAt + 300_000`.

### F-LC-2 (Low, high confidence) - slice-blind `betaSupportedFor`/facade wrappers

Surface: `src/core/game/GameManagerProgressionOps.ts` lines 1178-1184 + `src/core/betaScopeSurface.ts` line 419.

`unsupportedReleaseReason(player, slices)` reads `alchemyJobs`/`decompose` slices; the facade wrappers and domain `betaSupportedFor(player)` take no slices, so dormant-alchemy-job / dormant-decompose saves report "supported" through those seams. Zero consumers today - live boot (`useAppLifecycle.ts:467`) uses the domain function with slices correctly. Dead-API footgun: any future consumer trusting the player-only seam silently loses two flag classes.

## New / changed QA tests

- `tests/architecture/betaLocalCorrectnessAudit.qa.test.ts` (new, 34 probes). The 4 failing probes are intentional defect evidence and must NOT be "fixed" by weakening assertions; they pass when the underlying defects are fixed.

## Gaps

- Rollback mid-try failure inside `commitFiveElementInitiation` could not be forced deterministically without mocks (every failure leg is preflight). Snapshot coverage of player/skills/techniques verified by inspection; the reject-with-zero-drift probe pins the observable contract.
- No scheduler-level async interleaving exists in the covered paths (all ops are synchronous); race surface covered is the once-only settle + parked-record lifecycle.

## Pre-existing failures

None observed. Baseline suites green before probing; the 4 probe failures are the documented defects, not pre-existing breakage.
