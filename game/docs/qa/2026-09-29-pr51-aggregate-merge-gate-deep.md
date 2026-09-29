# PR #51 aggregate merge-gate QA — 2026-09-29

Scope: full `audit-combined` branch state vs `master` — audit docs (PR45/49),
repo cleanup (PR50), and the audited-findings fix commit (`2d551760`) plus its
P15/stat-pin follow-up. Mode: deep (save/cloud + time/offline + economy +
presentation surfaces changed).

## Evidence base

- `npm run verify` (typecheck + build + full vitest, 800 files / 7118 tests):
  typecheck clean, vite build clean.
- Vitest: 5 failures observed → 2 were branch-caused and are now fixed and
  re-verified green; 3 are pre-existing on `origin/master` (see below).
- Runtime/browser evidence (Playwright, real saves, earlier in session):
  FE-06 authored nameplate in MainScene + CombatScene, FE-08 gourd/HUD spacing,
  FE-17 ceiling note at Truc Co. All PASS.

## Branch-caused failures — FIXED

| Test | Cause | Fix |
|---|---|---|
| `tests/architecture/asciiComments.test.ts` | 57 new non-ASCII comment tokens (em dash, arrow, Vietnamese, x-marks) across fix-commit files and local audit scripts | Rewrote all flagged comments in ASCII English; test green |
| `src/core/player/PlayerStatAssembly.test.ts` | pinned `clampStatValue('finalDamageReductionPercent', -1) -> 0`; CP-01 intentionally widened min to -1 | Updated expectation to -1 plus a below-min probe (-2 -> -1); test green |

## Pre-existing on origin/master — NOT branch-caused (recorded, out of scope)

Identical test files and identical scanned source on master -> identical
failures; the branch does not regress them.

| Test | Root |
|---|---|
| `combatContract.test.ts` R14.4 | searches `'\n  onBattleStart()'`; signature is `onBattleStart(options?: { rebind?: boolean })` on master (line 1883) — always -1 |
| `dynamicRegionHost.test.ts` | `src/dev/skill-vfx.ts` (tracked, commit 342b95c8 on master) constructs `new Game(` outside the host |
| `i18nKeyParity.test.ts` | same file uses `skillVfxLab.*` keys absent from locales |

## Adversarial hypotheses — resolved against source

- Malformed non-array `save.player.persistentTimedEffects` crashing the new
  EM-02 segmentation: REJECTED — `saveShapeValidation.ts:535` `requireArray`
  classifies it corrupted before restore; `?? []` covers absent.
- `flat` x `maxStacks` behaving differently than `percent` x stacks:
  REJECTED — `StatCalculator.ts:241-250` accumulates `flat*stacks` and
  `percent*stacks` identically; `maxStacks` clamps stacks uniformly (:449).
- CAS PATCH racing a concurrent writer: zero rows -> 'unavailable',
  coordinator resyncs; `pushRevision` floored at remote+1 so a lost race
  still advances the shared revision lineage. Covered by tests.
- `accrualRealmId` garbage realm id in a hand-edited save: fails soft —
  `getRealmIndex` -> -1 -> default rate, `getRealmTier` -> 1.
- EM-02 double-apply: `lastSavedAt` advances to now; a repeated restore
  re-segments an empty window and the payload-identity guard (QA-002)
  no-ops identical payloads.
- FE-06 gate member absent (test/dev ports): `getActivePlayerName?.()`
  optional-chains to 'Player' fallback — pre-fix behavior preserved.

## Sequential review passes (P5)

- Pass 1 (local correctness): implementation-time review over every changed
  site + full-suite run; found the 2 branch-caused failures above; fixed and
  re-verified (asciiComments + PlayerStatAssembly green; touched-scope vitest
  83/83 green).
- Pass 2 (architecture/authority) over the post-fix state: accrual pin lives
  on the instance (state owner), revision ordering/CAS lives in the remote
  service (storage owner), seconds->cultivation stays with
  `calculateOfflineProgress`, player name is a reporting (non-deciding) gate
  member. No new authority duplication. No findings.
- Pass 3 (adversarial integration) over the newest state: hypothesis probes
  above; claim() re-pins after paying the pinned window (BuildingSystem.ts
  :443-452); optional-gate fallback verified. Zero unresolved Medium+.

## Verdict

PASS WITH EVIDENCE for the branch's own diff. The aggregate branch is
merge-ready relative to master modulo the three pre-existing master-side
failures, which this PR neither causes nor worsens. Known intentionally
deferred items remain the documented Low/Nit audit findings (quest reward
disclosure, kicker contrast, stage-select hints, etc.) — visible in
`docs/qa/local-audit/` and `docs/ui-audit/`, not silently dropped.
