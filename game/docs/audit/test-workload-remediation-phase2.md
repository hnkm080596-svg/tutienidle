# Test Workload Remediation — Phase 2 Evidence

Basis: `test-workload-remediation-mission.txt` Phase 2 scope (Tier-B decision,
Playwright triage, platform-aware env cleanup). Executed in worktree
`.agent-worktrees/twl-phase2`, branch `devin/1790533372-twl-phase2`, Node 22,
Vitest 4.1.11, Playwright on Windows 11.

Base: `master` post-PR40 (`0f1d84d1 Merge pull request #40 from
hnkm080596-svg/devin/1790423750-phap-tu-reimagine`). The branch was
fast-forwarded onto the post-merge master before any commit; file overlap
check found no textual conflict with the Phase 2 surface (PR40's test-area
touch is `cultivationPathIsolation.test.ts`, plus production phap-tu/save
code that the Playwright triage accounts for below).

## Việc 1 — Tier-B decision: KEEP in the default gate

Default-gate measurements on post-PR40 `master`, this Windows host:

| Run | Files | Executed cases | Wall time | Failures |
|---|---:|---:|---:|---|
| 1 (cold transform cache) | 790 | 6,977 | 309.47 s | 7 — all scan-guard timeouts |
| 2 (warm) | 790 | 6,977 | 266.24 s | 2 — `kiem-tu/invariants` scan guards |
| 3 (warm) | 790 | 6,977 | 240.57 s | 2 — `kiem-tu/invariants`, `eslintCoreSeverity` |

Standalone Tier-B set (`EssenceSubstitutionEconomy`, `TrucCoJourney`, the 6
optional balance cases): 8 files / 58 cases / ~45.5 s cumulative test time /
~26.9 s wall on this machine. The two heavy sims dominate:
`EssenceSubstitutionEconomy` ~22.3 s, `TrucCoJourney` ~12.2 s standalone
(both inflate under full-suite load: 52 s / 36 s observed in-run).

**Decision: Tier-B stays in the default gate.** Evidence:

- Moving it would save ~15 % of a ~4-minute Windows gate — no qualitative
  developer-feedback improvement, because the bottleneck is systemic
  (790 files through vitest forks + import graph + filesystem contention),
  not the 58 Tier-B cases.
- On the Linux reference host the Phase-1 gate already measured ~55 s
  (inside the mission's 55–60 s target band) with Tier-B ~16 s — the
  Windows wall time is a platform property, not a regression.
- Tier-B carries the repo's highest-value real-seam coverage (full
  journey + economy simulations). Trading it for ~15 % wall time fails
  mission §7's "meaningful benefit" bar on both platforms.
- No CI exists (`test:balance` is opt-in); `npm run verify` is the
  canonical P3 gate — moving Tier-B out would silently drop 58
  integration cases from the verification path developers actually run.

Census reconciliation vs the Phase-1 ledger: 6,774 → **6,977** default
executions (+203 across 15 files) — the delta is PR40's merged test
surface, verified by `vitest run` on the fast-forwarded base. Balance gate
remains the opt-in `test:balance` config (8 cases, unchanged).

## Việc 3 — platform-aware asset tests (env-noise cleanup)

New helper `src/assets/testing/nativeToolProbe.ts` (test-only, under the
existing `src/**/testing/` helper convention; `node:*` imports carry the
`@ts-expect-error` markers the `types: []` app tsconfig requires):

- `probeBinary(command, args)` — spawnSync + 15 s budget.
- `resolveMagick()` — IM7 `magick`, else IM6 `convert` on POSIX only.
  `convert` is never probed on Windows because System32 ships an
  unrelated filesystem tool under that name.
- `resolvePowerShell()` — `powershell.exe` on Windows, else `pwsh`.

Consumers:

- `dongFuBackgroundAssets.test.ts` — the 40-PNG signature/dimension
  assertions are pure fs and run everywhere; only the alpha-sampling case
  is `it.skipIf(magick === null)`. When IM exists the test still executes
  every sample assertion — nothing is weakened.
- `dongFuBuildingPipeline.test.ts` — gated on both `magick` (the `.ps1`
  hardcodes `& magick` internally, so an IM6 `convert` shim cannot
  satisfy it) and a PowerShell host. The Windows-only
  `-ExecutionPolicy Bypass` flag is emitted only for `powershell.exe`;
  `pwsh` on POSIX runs unsigned local scripts without it.

Windows result: both tests execute fully (pipeline ~16.1 s standalone) —
no skip on a provisioned host.

## Scan-guard timeout hardening (Windows full-suite flakes)

Root cause of all 11 measured full-suite failures across the 3 gate runs:
filesystem-scanning architecture guards starved past their per-test
budget under worker contention — assertion logic never failed. Fixes
reuse the documented `SCAN_TIMEOUT` convention (`deadReferences.test.ts`
precedent) instead of weakening rules:

- `tests/architecture/helpers/scanTs.ts` — `SCAN_TIMEOUT` 60 s → 120 s
  (Windows measured >60 s for a full tokenizer/scan pass under load).
- `tests/architecture/damageAuthorityRng.test.ts` — hoisted
  `listProductionTs(SRC)` to module scope (one tree walk per worker
  instead of one per guard) + `{ timeout: SCAN_TIMEOUT }` on the 3 scan
  guards.
- `tests/architecture/eslintCoreSeverity.test.ts` — `LINT_GUARD_TIMEOUT`
  60 s → 120 s (the ESLint subprocess was starved past its own budget).
- `src/presentation/presentationOwnership.test.ts` — AST guard 30 s →
  120 s.
- `src/core/kiem-tu/invariants.test.ts` — local `SCAN_GUARD_TIMEOUT` =
  120 s applied to the INV-7 grep guard, INV-12 dead-id sweep, and INV-14
  `the`-isolation scan (src tests cannot import the `tests/architecture`
  helper — the app tsconfig omits Node types).

Sibling sweep: `listSourceFiles`/`listProductionTs`/`readdirSync` census
over `src/` found no other scanning test without headroom —
`deadReferences.test.ts` already carries the cached-contents + timeout
pattern.

## Việc 2 — Playwright triage (33 tests, 2 workers)

Full post-PR40 run: **5 failures** — the audit's 3 known + 2 exposed by
PR40's behavior changes. All diagnosed to root cause; none is a product
defect.

| Spec | Root cause | Classification | Fix |
|---|---|---|---|
| `combat-idle-motion-capture` | `ENTITY_ART_MODE='static'` (2026-09-19): player is a still + bob tween, never plays a clip | Stale assertion | Reworked to the static-art contract: no clip, idle `offsetY` moves within amplitude; tagged `@capture` |
| `create-to-combat` | Real-time turn loop (~20 rendered turns) exceeded the 180 s poll under 2-worker contention — snapshot showed live progress at turn 14/20 | Timing budget | Test timeout 210→360 s, result poll 180→300 s; assertion unchanged |
| `cultivation-path-ritual` (spell) | PR40 retired `spellPath.route`; save now persists `{ element }` only | Stale assertion | Interface + expectation updated to `{ element: null }` |
| `standing-slot-panel` | `formation_slot` requires `foundation_establishment`, and `mortalBoundaryContractViolation` rejects a non-mortal save with no `cultivationPath` — a realm-only seed can never restore | Stale fixture | Drives the real Quan Khi ritual → commits the phap-tu way → bumps the coherent `qi_refining` save to `foundation_establishment` (+ born-sealed `gradeHistory` for the lagging technique grade, + seeded companion) |
| `technique-frozen-warning` | Post-Quán-Khí victory now mints a blocking `talent-entitlement-modal`; the wheel never returns until a pick resolves it | Stale flow | Resolve the entitlement (first offer) before asserting wheel/panel |

`@capture` tags: `combat-idle-motion-capture` and `wave-vfx-capture` are
tagged on their `describe` blocks. They stay in the default e2e run —
both assert real runtime contracts (idle-motion invariant, wave-telegraph
ordering); the tag enables opt-out via `--grep-invert @capture` for
capture-only reruns.

## Verification

| Gate | Result |
|---|---|
| `npm run verify` (type-check + build + full vitest) | **PASS** — 790 files / 6,972 passed + 5 expected-fail / **0 failures**, 253.00 s (transform 280.96s, import 1017.82s). One P15 self-failure (non-ASCII comments authored in this diff) was fixed by scrubbing those comments to ASCII and re-verified green. |
| `npm run test:balance` | **PASS** — 8/8 cases, 1,021.85 s (heavy sims; e.g. `normal run` 283 s, `seed 11` 260 s) |
| `npx playwright test` (33 tests, 2 workers) | **PASS** — 33/33, 13.5 m clean run (all five previously-failing specs included) |
| Targeted rerun, 5 fixed specs | 11/11 passed |
| `combat-vertical-slice` standalone (post-contamination) | 2/2 passed — victory loop 2.5 m |

Targeted evidence: all five fixed specs pass — `combat-idle-motion-capture`
~84 s, `create-to-combat` ~156 s, six `cultivation-path-ritual` cases,
`technique-frozen-warning` ~46 s, `standing-slot-panel` 43.7 s.
The 8 touched Vitest files pass uncontended (52 cases; pipeline 16.1 s).

Contamination note: full-suite run 3 showed one `combat-vertical-slice`
failure (240 s poll starved) **only** because a standalone spec was launched
concurrently, doubling browser load. Clean standalone rerun passed (2.5 m);
the budget is sufficient under clean 2-worker load. No code change —
recorded as a Windows-contention sensitivity of real-time specs.

## Remaining limitations

- Windows wall time (~240–310 s) is a platform property of this host —
  the Linux reference measured ~55 s in Phase 1. The scan-guard budgets
  now absorb Windows contention rather than failing on it.
- `standing-slot-panel` now pays the real Quan Khi ritual (~40 s of its
  ~44 s) — accepted cost for a coherent foundation-tier save; the
  alternative (hand-authoring a post-mortal payload) cannot satisfy the
  mortal-boundary contract.

## QA gates

- **P18 OCR (Delegation Mode):** 14/14 reviewable files covered, 0
  skipped (the audit `.md` is `unsupported_ext`); rules = built-in TS +
  project test-defect rules; **0 unresolved Medium+** (one Low —
  pre-poll enemy-undefined window — fixed in-pass and re-verified).
- **P4 adversarial QA (quick):** `docs/qa/2026-10-19-test-workload-phase2-quick.md`
  — 8 hypotheses attacked, all refuted by executed or source-proof
  evidence; verdict label PASS WITH GAPS closed by the clean suite.
- **P5 sequential review:** Pass 1 (local correctness/regression),
  Pass 2 (architecture/authority), Pass 3 (adversarial integration incl.
  sibling search over e2e realm seeds) — each on the state produced by
  the previous pass; **zero unresolved Medium+**; two Nits recorded
  (per-spec ritual-helper duplication, pre-existing 300 ms settle wait).

[TEST-WORKLOAD-PHASE2] PASS
