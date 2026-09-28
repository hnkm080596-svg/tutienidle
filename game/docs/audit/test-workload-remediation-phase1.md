# Test Workload Remediation — Phase 1 Evidence

Basis: `test-workload-remediation-mission.txt` (PR #36 follow-up), changes A–D only.
Executed in worktree `.agent-worktrees/twl1-worker`, Node 22, Vitest 4.1.11.

## Implementation changes

- **Change A — PerfectionEconomy split.**
  - `src/core/simulation/earlygame/PerfectionEconomy.test.ts` keeps the 7 cheap
    analytic/invariant cases: `mortalStatBudget` (2), `reachableStatSourceCensus`
    (3), `analytic body expectations` (2). Stays in the default regression gate.
  - `tests/balance/PerfectionEconomy.test.ts` (new) holds the 8 driven-sim cases:
    `measureNormalRun` (1), `measurePerfectionRun` (3: full accounting,
    determinism seed 23, safety-bound maxKills=1), `three-seed measurement`
    (`it.each` 11/23/7 = 3), `cross-run consistency` (1). Every assertion, seed,
    timeout, and the `[md-econ]` console line are preserved verbatim; only the
    import paths were rebased to `../../src/...` and one dead import
    (`TINH_HOA_PHAM_THE_MATERIAL_ID`, unused in the original too) was dropped.
- **Change B — eager-glob fixes.** Both sites now carry the glob negation
  per the `LegacySkillCoverage.test.ts` precedent:
  - `tests/architecture/statDomainWhitelist.test.ts`: include root
    `../../src/data/**/*.ts` → exclusion `!../../src/data/**/*.test.ts`.
  - `src/core/stats/StatCalculator.theTu.test.ts`: include root
    `../../data/**/TheTu*.ts` → exclusion `!../../data/**/*.test.ts`.
  - Also dropped the file's pre-existing unused `import type { Stats }` (it was
    the file's only lint error on HEAD; removing it keeps a touched file clean).
  - The in-loop `path.endsWith('.test.ts')` continue checks were kept as a
    defensive no-op layer; they never prevented registration — only the glob
    negation does.
  - New guard `tests/architecture/eagerGlobTestExclusion.test.ts`: scans every
    gated test file's source via `import.meta.glob(..., { query: '?raw' })` and
    fails when an `eager: true` glob call contains a positive pattern whose
    final segment can incidentally match `*.test.ts` (`*.ts`, `TheTu*.ts`, ...)
    without a `*.test.ts` negation in the same call. Verified to flag both
    pre-fix call sites when replayed against the HEAD blobs.
- **Change C — SAFE_DELETE.** Deleted:
  - `src/core/game/GameManager.bossSummon.test.ts` (retired `expect(true)` stub)
  - `src/core/game/GameManager.phapTuChain.test.ts` (retired `expect(true)` stub)
  - `src/core/battle/turn/TurnBattleSystem.qadebug.test.ts` (probe-hygiene test;
    strictly subsumed by `TurnBattleSystem.adversarial.test.ts` INV-S1-4 —
    identical actor/candidate geometry asserting `sameRowFar`)
  - `GameManager.turnManualMode.test.ts` case `'submit khi KHÔNG pause → false
    (no-op an toàn)'` — strictly subsumed by `GameManager.turnManualQa.test.ts`
    INV-TM-5, which asserts the same `false` return AND that
    `totalTurnsElapsed` does not move.
- **Change D — commands/config.**
  - `vitest.balance.config.mts` (new): `include: ['tests/balance/**/*.test.ts']`,
    `environment: 'node'`, `@` alias — same shape as `vitest.lab.config.mts`.
    `tests/balance/` sits outside `vite.config.ts`'s include roots
    (`src/**/*.test.ts`, `tests/architecture/**/*.test.ts`), so the balance gate
    cannot leak back into the default run. Verified: `npx vitest list
    tests/balance` under the default config matches nothing.
  - `package.json`: `test:balance` = `vitest run --config
    vitest.balance.config.mts`; `test:all` = `npm run test && npm run
    test:balance`. `test` (regression) and `verify` (type-check + build +
    regression) unchanged.
  - `tsconfig.tests.json` include += `tests/balance/**/*` and
    `tsconfig.node.json` include += `vitest.balance.config.*`, so
    `npm run type-check` covers the new gate.

## Audit verification (mission §step-1), all claims TRUE

| Claim | Result |
|---|---|
| statDomainWhitelist include root `../../src/data/**/*.ts`; exclusion must be `!../../src/data/**/*.test.ts` | TRUE — glob at line ~173 matched all 48 `src/data/**/*.test.ts` files; scoped run executed **428** cases vs 4 own → **424 duplicates** |
| StatCalculator.theTu glob; exclusion matching its data root | TRUE — `../../data/**/TheTu*.ts` matched the 4 `TheTu*.test.ts` data test files; scoped run executed **75** cases vs 16 own → **59 duplicates** |
| `LegacySkillCoverage.test.ts` negation precedent exists | TRUE — `['../../data/**/*.ts', '!../../data/**/*.test.ts']` lines 88–96 |
| 3 file-level SAFE_DELETE + 1 case-level | TRUE — two `expect(true)` retired stubs; qadebug ≡ INV-S1-4; the turnManualMode no-op case ⊂ INV-TM-5 |
| PerfectionEconomy split boundary | TRUE — 7 cheap analytic cases vs 8 `measureNormalRun`/`measurePerfectionRun` cases; `mortalStatBudget`/`expectedKills*`/`getMainStatCap`/`BODY_REFINEMENT_TIERS` shared imports |

## Before/after census + timing

| Gate | Files | Cases | Wall time |
|---|---|---|---|
| Default, BEFORE | 777 | 7,268 (2 env-fail) | 306.46 s |
| Default, AFTER run 1 | 775 | 6,774 | 55.07 s |
| Default, AFTER run 2 | 775 | 6,774 | 54.76 s |
| Default, AFTER run 3 | 775 | 6,774 | 53.39 s |
| Default, AFTER run 4 (final tree) | 775 | 6,774 | 57.37 s |
| Balance gate | 1 | 8 | 286.47 s |

Regression gate: **min 53.39 s / median ~55 s / max 57.37 s** — inside the
mission's 55–60 s target band. Case counts identical across all 4 runs.

Reconciliation: 7,268 − 483 duplicate registrations − 4 subsumed deletions
− 8 moved-to-balance + 1 new guard test = **6,774** default executions.
Unique protection total = 6,774 (default) + 8 (balance) = 6,782 =
7,268 − 483 − 4 + 1. The only count not covered by a pre-existing test is the
+1 new guard — no unique protection lost, 8 sims moved not removed.

## Commands

- Normal regression: `npm test` (or `npx vitest run`)
- Balance simulation: `npm run test:balance`
- Complete validation: `npm run test:all` (regression + balance);
  `npm run verify` stays type-check + build + regression.

## SAFE_DELETE accounting

4 case-instances removed, exactly the approved set: bossSummon (1),
phapTuChain (1), qadebug (1), turnManualMode no-op case (1). No other
`.qa` / `.adversarial` / review-round / regression file was touched.

## Known environment issues (unchanged scope, pre-existing)

- `src/assets/dongFuBuildingPipeline.test.ts` — 1 case fails on this Linux VM:
  the asset-pipeline script is invoked through `powershell.exe`, which does not
  exist here (baseline failed the same file earlier at `spawnSync magick
  ENOENT`). Windows-only test; not a regression.
- `src/assets/dongFuBackgroundAssets.test.ts` — failed at baseline (`magick`
  ENOENT); passes now under a session-local `magick → convert` shim
  (`~/.local/bin/magick`). To make that durable, the environment blueprint
  could install ImageMagick 7 or add the shim.
- Balance gate wall time is ~286 s — unchanged semantically (same sims, same
  seeds); it just runs under its own config now.

[TEST-WORKLOAD-PHASE1] PASS
