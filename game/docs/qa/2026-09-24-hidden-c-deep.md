# HIDDEN-C Deep QA — 2026-09-24

Scope: `beta/rc` worktree `.agent-worktrees/hidden-c` — Zhou Tian discrete-step rework (0..36)
+ Nghich Chu Thien mechanic + UI + save v83. Mode: P18 OCR + P4 deep audit + P5 sequential
passes (3, evidence below).

## P18 OCR (Delegation Mode)

23/23 changed files reviewed. F1 fixed (frozen record revealed an active row), F2/F3 nits
fixed (stale 1170→3690 comment, stray blank). F4 Nit deferred: validator does not correlate
`completed`/`pityByLevel`/`active` — corrupted-save surface only, consistent with the
per-field validator contract.

## P4 Deep Audit — adversarial ledger

| # | Hypothesis | Verdict |
|---|---|---|
| H1 | `pityByLevel[level]=x` sparse write → `JSON.stringify` emits `null` holes → integer validator rejects whole save | **CONFIRMED — CRITICAL**: first failure at any level > 0 poisons persistence. FIXED: dense-write loop in `attemptNghichChuTian` + pin (asserts `[0,0,0,0,0,1]` + clean JSON round-trip) |
| H2 | Eligible-but-undiscovered dead-end: lineage opens after 36/36 → capacity full → `consumed=0` → discovery hook can never re-fire → row renders "Done" with no attempt arm | **CONFIRMED — Medium**. FIXED: `nghichActive` falls back to `isNghichChuTianEligible` when no record exists (first attempt auto-discovers); `isNghichChuTianRevealed` ORs eligibility; 2 mount pins |
| H3 | Frozen record reveals an active row | Fixed at OCR F1 + pinned (frozen-record-hidden test) |
| H4 | Discovery bypass via non-ops invest | Rejected: every `zhou_tian` writer funnels through `realmAdvanceOps.investBodyChapter`; the two real apply sites (legacy path L595, essence-substitution apply L664) both hook; probe L622 mutates a discarded JSON clone; `investBodyChapterState` has zero non-ops callers |
| H5 | Probe path writes discovery on clone | Rejected: hook lives in the ops wrapper, not in `investBodyChapterState` |
| H6 | Partial debit between the two costs | Rejected: `has()`×2 preflight before `remove()`×2, single-threaded + pinned |
| H7 | `completeHiddenBody` double-grant +10pp | Rejected: strict-prefix idempotent writer |
| H8 | `completed > capacity` corrupt save | Covered: integrity check emits (C2C-75 analogue) |
| H9 | Save-level populated-payload round trip | **Coverage gap → FIXED**: new SaveRoundTrip test exercises skeleton dispatch → authored mechanicKind → registered validator end-to-end |
| H10 | Chance endpoints monotonic | Pinned: level0=1.0, level35=0.01, `Math.random()<1` always true at 0 |
| H11 | Pity guarantee + no-transfer | Pinned: threshold short-circuits RNG at `pity>=limit`; index-bound counters never transfer |
| H12 | Validator vs nulls/non-array | Emits per-field issues; dense write prevents producer side |
| H13 | `nghichChancePercent` rounding | Display-only; canonical used for the roll |
| H14 | `mechanicKind` dispatch | Authored `foundation_establishment → nghich_chu_tian` matches payload kind |
| H15 | Sequentiality (meridian before zhou) | Unchanged contract, enforced by dispatch + integrity |
| H16 | EarlyGameSession snapshot symmetry | Output-only field (read at :666); no restore path consumes it |
| H17 | Cold save-validation before GameManager boot | Fail-closed by design: unregistered kind emits explicit issue; all live validation runs post-construction |

## P5 Sequential Review

**Pass 1 — Local Correctness** (post-audit state): LOW ×2 found+fixed —
(a) `attemptNghich` skipped `bumpState()` on `insufficient`, but a first attempt
auto-discovers (record write) before the cost check fails → state mutated without a
reactivity signal → now bumps unless outcome is `ineligible`/`complete` (the two
provably write-free outcomes);
(b) Nit: done row displayed phantom next-attempt costs → detail line gated to active.

**Pass 2 — Architecture/Authority** (post-Pass-1): clean. Single rule owner
(`attemptNghichChuTian`); discovery sole-writer with write-time skeleton gating;
data-layer constants / core-layer mechanism split mirrors hidden-b; ops-665 hook is
unreachable today for `tinh_hoa_phap_the` (phap essence takes the legacy branch) — kept
as defensive symmetry with a comment. No Medium+.

**Pass 3 — Adversarial Integration** (post-Pass-2): Nit fixed (template `:max="36"` →
`NGHICH_CHU_TIAN_TOTAL_STEPS`). Rejected scenarios documented in H4-H16.

## Verification evidence

- `npm run type-check`: clean.
- Scoped: `RealmBodySections` 22, `NghichChuTian` unit, `GameManager.nghichChuTian`
  integration, `SaveRoundTrip` 22 — 66/66 green.
- Full `npx vitest run`: 7000 passed / 2 failed / 4 expected-fail / 36 suite-load fails —
  identical to master baseline (canvas `libuuid.so.1` Phaser load + `spawnSync magick
  ENOENT`), zero task-caused failures.

## Deferred (recorded, safe)

- Validator field-correlation (corrupted-save surface) — Nit.
- `active:false + completed<36` corrupt payload renders "Done" with no button — same
  fail-closed surface as above — Nit.

## Sealed-review chain (post-report)

Independent blind reviewers on the frozen head — none had access to this doc.

- **Closure reviewer** (criticals re-verification, aa8d1c0e): **SEAL** — sparse-pity
  closure adversarially confirmed (only writers = install + dense push; crafted nulls
  rejected at every acceptance seam); eligible-undiscovered closure confirmed at
  mechanism level. 3 lows recorded (reachability caveat until HIDDEN-B mechanics land,
  crafted-save validator correlations — deferred class).
- **Clean-A round** (aa8d1c0e): CORRECTNESS **SEAL** (10 verified claims, 597 tests) /
  INTEGRATION **SEAL** (all seams traced, 597 tests) / AUTHORITY **SEAL** (all authored
  pins vs design sec.11/12 + spec sec.8.3).
- **Clean-B round** (8d830bec, comment-only delta): CORRECTNESS **SEAL** (594 tests) /
  AUTHORITY **SEAL** / INTEGRATION in flight.
- Deferred carried over: crafted-save mechanic-vs-record coherence; frozen-record
  `active=true` residue (inert — all consumers gate on `frozen`); `stepCost` shows
  "Giá bước kế: 0" at capacity cap (UI polish, BETA-BALANCE); missing literal
  NON-CANONICAL token; bare `Math.random` convention (rng-injectability sweep
  candidate); EN 'Reverse Circulation' gloss.
