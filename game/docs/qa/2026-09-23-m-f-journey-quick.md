# QA Review: M-F-JOURNEY (TrucCoJourney + EarlyGameSession seams + docs)

- Date: 2026-09-23
- Mode: quick
- Verdict: PASS WITH EVIDENCE
- Task-owned paths:
  - `game/src/core/simulation/earlygame/EarlyGameSession.ts`
  - `game/src/core/simulation/earlygame/EarlyGameSession.test.ts`
  - `game/src/core/simulation/earlygame/TrucCoJourney.test.ts`
  - `game/docs/p7/missions/mf-journey.notes.md`
  - `game/docs/specs/m-f-journey-spec.md`
  - `game/docs/plans/m-f-journey-plan.md`
  - `game/docs/roadmap.md`, `game/docs/p7/mission-graph.md`, `game/docs/naming-conventions.md`

## Scope and Risk Map

`changed-risk-map.mjs` returned all paths `unmapped` (docs + test
infrastructure); `deepAuditCandidate: false`. Manual routing:

- `EarlyGameSession.ts` — test-harness seams only. One-hop consumers:
  the earlygame test suites (MortalChapterJourney, TrucCoJourney,
  EarlyGameSession.test). Zero production consumers import this file —
  grep-verified (`src/` non-test imports of `EarlyGameSession`: none
  outside `core/simulation/earlygame/`). Risk is bounded: a wrong seam
  produces a test defect, not shipped behavior. Domain packs routed:
  save-and-cloud (checkpoint/snapshot parity), combat-and-tribulation
  (settle/drain two-phase), economy-and-progression (investChapter,
  bags, gifts, auto-farm), time-and-offline (fake-timer + nowMs),
  pinia-phaser-sync (playerOwner store seam; no Phaser surface).
- `TrucCoJourney.test.ts` + `EarlyGameSession.test.ts` — test files;
  oracle = whether they exercise real production contracts (no mock
  seams), assert observable state, and cannot pass vacuously.
- Docs files — doc-only, no runtime risk.

Deep-escalation check: none triggered. Save/clock/progression risk is
present but BOUNDED — the change adds read/seed seams over existing
persisted slices; it writes no save-format code, no migration, no
production behavior. CURRENT_SAVE_VERSION stays 81.

## Invariant Ledger

| Invariant | Oracle | Evidence |
| --- | --- | --- |
| settle binds once; repeat settle is receipt-idempotent (no double-apply) | same receipt object identity + no second realm write | `EarlyGameSession.test.ts` seam pin: `settleTribulationOutcome()` twice → `toBe(receipt)`; realmId stays 'mortal' (announcement-only victory) |
| drain holds while `pendingTalentEntitlement` unresolved; clears exactly once post-resolution | `drain → false`, committed outcome retained; post-`resolveTalentEntitlement` `drain → true`, director cleared | seam pin asserts the full two-phase chain; production ordering mirrors `checkTribulationOutcomeAction` (useTribulation) |
| writer() targets store while player IS $state; falls back to live PlayerData post-restore | `isWriterOwner` structural check; `playerOwner` re-armed only on ok restore | `restoreCheckpoint` sets `playerOwner = isWriterOwner(owner) ? owner : undefined`; minimal-owner restores get `undefined` → live-player writes |
| snapshot parity is deterministic: volatile content normalized out | same-seed `driveJourneyCore()` twice → `toEqual` | `perfectClearSeconds`/`lastCheckedMs` excluded by construction; `perfectClearStageIds` sorted; `pendingTalentEntitlement` reduced to realmId; `hiddenChannelCycles` normalized to cycle-carrying sites only |
| site-list session-history noise must not enter parity | fresh session `getAllStates()` lazy vs restore seeds all sites | OCR finding: pre-normalize, parity failed `[]` vs 3 seeded sites — fixed by filtering to `cycles.length > 0` carriers; re-run green |
| census cannot pass vacuously | enumeration inputs asserted non-empty | `tables.size > 0`, `emitted.size > 0`, `signature.size > 0` guards added (OCR finding) |
| seeded inputs ride real bag APIs; no landing-funnel acquisition events | `holdPill`/`holdMaterial` call `bag.add` directly | declared fixture semantics (spec §4 two-class split); `pillAmount`/`materialAmount` read back post-add held |
| floor_N unlock at realmLevel N; perfect-clear exactly-once; auto-farm gated on recorded perfect + valid cycleSeconds | E.2 asserts `runStage → 'locked'` below N, victory at N; I asserts record-once + startAutoFarm gate | `resolveValidAutoFarmStage` requires `perfectClearStageIds` + `isValidCycleSeconds(>0)`; seeded `perfectClearSeconds=30` survives restore reconcile |
| equip grade gate: `cuu_pham` equips only at `realmId==='mortal'` | equip before ritual in seed + leg A | `canUseItemGrade` requires `getProfessionGradeForRealm === instance.grade` — equip moved pre-ritual (OCR-era fix, verified) |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npx vitest run src/core/simulation/earlygame/` | 48/48 pass | post-OCR-fix state; includes restore-parity + determinism + grade ladder + census + save-integrity |
| `npm run type-check` (vue-tsc) | clean | post-fix state |
| `npm run verify` (full gate, earlier state) | 7188 pass / 3 fail | all 3 pre-existing base/env (2× `magick ENOENT`, 1× SettingsPanel `.confirm-modal__confirm` null — deterministic on pristine base, zero overlap with this diff) |
| `ocr delegate preview` | 3 reviewable files, 100% coverage | 6 docs excluded `unsupported_ext` (doc-only, manually reviewed) |
| `settle/drain` vs `useTribulation` production source | ordering match | settle=domain half; drain=reconcile→hold→clear post-resolution |
| `assertBodyProgressionIntegrity` preflight | rejected | incoherent-save test: progressed zhou_tian with incomplete meridian → `restoreCheckpoint.status === 'rejected'` |

## Findings

No `Confirmed` defects. Two findings recorded from the OCR/QA pass and
FIXED during implementation review (they were in-mission defects, not
pre-existing):

### QA-2026-09-23-1: snapshot omitted v81 `hiddenChannelCycles` and compared a history-dependent site list
- Severity: Medium (in-mission, fixed)
- Status: Confirmed (failing parity assert `[]` vs 3 seeded sites)
- Invariant: snapshot parity compares only persisted content
- Reproduction: leg G `parityBefore.toEqual(parityAfter)` — restored
  session seeds all site states, live session's are lazy → `[]` vs
  `[thanh_van_lam, thanh_van_quang, thanh_van_dong_thien]`
- Fix: `hiddenChannelCycles` snapshot field normalized to
  cycle-carrying sites only + typed snapshot field added;
  leg L asserts `toEqual([])` (TC journey runs no grotto channel)
- Owner subsystem: `EarlyGameSession.snapshot()`
- Blast radius: test-harness parity only; no production path

### QA-2026-09-23-2: census could report a false-clean on empty enumeration inputs
- Severity: Medium (in-mission, fixed)
- Status: Confirmed (static analysis — a `STAGE_DROP_TABLES`/
  `FAMILY_DROP_TABLES`/channel-shape refactor reading zero entries
  would satisfy `routeLess`/`duplicated`/`bypass === []`)
- Invariant: a sweep census asserts it actually enumerated the lattice
- Fix: input-size guards `tables.size > 0`, `emitted.size > 0`,
  `signature.size > 0` before the result asserts
- Owner subsystem: census describe in `TrucCoJourney.test.ts`
- Blast radius: test only

## New or Changed QA Tests

None beyond the task-owned suite itself (the task IS the test surface;
the two fixes above landed in it).

## Gaps and Residual Risk

- Day-paced seeded inputs (thong_mach_dan ×133, truc_co_dan, meridian
  aux, 6/6 refinement) ride bag-API fixture seams, not honest
  acquisition — spec §4's declared two-class split, approved upstream;
  production acquisition paths for those items are exercised by their
  sibling-mission suites, not this journey.
- Fake-timer disarm happens at test end; a mid-test throw leaves
  timers armed for a following test — Nit, matches existing
  MortalChapterJourney convention, cannot mask a failure (the throwing
  test already failed). Deferred.
- Leg I grade ladder uses seeded fixtures (documented in spec; honest
  great_dao build needs a second wall-crossing run — deferred to
  authored content per C2C).
- `hiddenChannelCycles` parity covers `[]` only for the TC journey —
  the grotto cycle path itself is BODY-HIDDEN's own suite's domain.

## Pre-existing Failures

- `src/assets/dongFuBackgroundAssets.test.ts`,
  `src/assets/dongFuBuildingPipeline.test.ts` — `spawnSync magick
  ENOENT` (ImageMagick absent in env; identical env failure recorded
  on M-QI-09/10 merges).
- `src/components/panels/SettingsPanel.test.ts` —
  `.confirm-modal__confirm` null click; fails deterministically in
  isolation on the pristine base (file untouched since `ed35f246`);
  zero overlap with this diff.
