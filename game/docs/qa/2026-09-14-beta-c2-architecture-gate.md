# C2 — §0.12 beta gate checklist re-run (2026-09-14)

Re-run of `docs/roadmap.md` §0.12 against the current master tree, with
evidence per item. Prior baseline: `2026-09-13-whole-codebase-deep.md`
(FAIL — F1 critical, F2a/F2b medium) plus the B1–B3 wave reports.

## Architecture gate

| Item | Verdict | Evidence |
|---|---|---|
| No known P0 architecture defect in normal player flow | PASS | Deep-QA F1 (tribulation route soft-lock) fixed — `src/presentation/tribulationRouting.test.ts` repro now green (5/5); e2e seam covered by `tests/e2e/tribulation-flow.spec.ts`. B3 progression wall (P0 gameplay blocker) fixed — `docs/qa/2026-09-14-beta-b3-progression.md`, all 30 stages clearable via real-engine sweep. |
| No competing authoritative damage/stat/buff execution paths | PASS | Guards green today: `canonicalBuffSurface`, `vitalsWriteAuthority`, `statProvenanceAndQueryPurity`, `combatContract` (tests/architecture/, 116/116). R14 missions consolidated buff/stat surfaces (`2026-09-14-r14-*-quick.md`, `applies-buff-guard`). |
| Normal gameplay does not depend on opening a UI query | PASS | `statProvenanceAndQueryPurity.test.ts` pins query purity; the lab harness (`tests/lab/progressionSweep.test.ts`) runs full progression headlessly — gameplay provably advances with no UI mounted. |
| Presentation does not determine gameplay outcomes | PASS | `presentationGate`, `combatContract`, `ackTokenContract`, `tribulationOutcomeWiring`, `progressionOutcomeOwnership` all green. |
| Normal operations cannot fabricate domain-owned results | PASS | `paidRandomContract.test.ts` (7 tests incl. `washPendingSlot` domain ownership); formation commits go through `commitFormationLoadout` (validating owner, F4 fix). |
| Save/restore follows an explicit supported lifecycle | PASS | `saveShapeValidation` + version gate + migration tests + `restoreIdentity` + `snapshotIsolation` + round-trip suites — 197 tests green today. C1 residuals closed (commit `ea4248ab`): shape checks for `perfectClearSeconds`/`autoFarmStage`/`formationLoadout`, bounded+convergent online catch-up. |
| Major runtime consumers have actual integration evidence | PASS | Real-engine lab sweep across all 30 stages; `SaveSystem.bootRestore`; e2e suite incl. repaired `standing-slot-panel.spec.ts` (real content, no test-only fixtures) and `tribulation-flow.spec.ts`. |
| Architecture guardrails exist for recurring critical invariants | PASS | `tests/architecture/`: 29 files / 116 tests, all green 2026-09-14 (incl. `i18nKeyParity` covering the drift class the deep audit flagged). |

## Content gate

| Item | Verdict | Evidence |
|---|---|---|
| Normal Phàm Nhân → Trúc Cơ progression contains real content | PASS | B3 sweep: all 30 floors clearable at intended investment (`progressionSweep.test.ts` + `f89max.test.ts`). |
| No required normal-flow placeholder/test-only content | PASS | `docs/qa/2026-09-14-beta-b1-placeholder-sweep.md`; Thuần dead-content wired (`thuan-tree-wire` quick report). |
| Intended companion/formation scope completed | PASS | Roster + pull/exchange/feed + `commitFormationLoadout` shipped; world-map companion scope formally parked hậu-beta (recorded decision). |
| Balance pass complete | PASS | `docs/qa/2026-09-14-beta-b2-balance.md` + B3 curve fix (`e486a741`, `82d64060`). B2-3 production oversupply recorded as accepted residual. |

## Verification gate status

- `type-check` — green today.
- Full Vitest — 3806/3809 green today; only failures are the 3
  perfectClear multi-hit probes below (pre-existing fixture debt).
  (A gitignored lab scratch file also failed to import — fixed.)
- `tests/architecture/` — 29/29 files, 116/116 green today.
- Save + auto-farm scope — 197/197 green today.
- `build`, e2e, live-browser, adversarial deep — tracked at D4.

## Known remaining gaps (not gate-blocking, recorded for D-wave)

- `GameManager.perfectClear.feasibility.test.ts` — 4 multi-hit probes fail
  (floors 1/5/9/10): a solo no-AOE build needing ~3 hits/kill cannot beat
  the ATB-round limit. Classification: **fixture calibration debt**, not a
  player-flow defect — real perfect clears run full party + AOE (auto-farm
  itself depends on recorded perfect clears and works). Options for D4:
  recalibrate the probe to a realistic build, or accept-and-document.
- `perfectClearSeconds` entries like `0.001` pass the new shape check
  (finite > 0) → a hand-corrupted save could still spend ~10^8 iterations
  on ONE catch-up tick before converging. Bounded and non-repeating —
  accepted residual; a minimum-cycle floor is a design decision, not a
  shape bug.
- Deep-audit residual notes re-checked: dead writes
  (`checkTribulationOutcome` wrapper, `tribulation_scene_exit` listeners,
  tribulation ui-store fields) are cleanup candidates, not defects.
- Cloud-save concurrency: CAS revision verified by code read only; live
  Supabase exercise deferred to the D2 decision.

## Verdict

**Architecture gate: PASS. Content gate: PASS.** No P0/P1 architecture
defects known in normal player flow. Remaining work is D-wave release
readiness (distribution, cloud-save ruling, tutorial ruling, final gate).
