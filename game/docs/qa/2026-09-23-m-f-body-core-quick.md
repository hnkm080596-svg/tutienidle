# QA Review: M-F-BODY-CORE — chapter-kind + physique completion seam + base-stat channel

- Date: 2026-09-23
- Mode: quick
- Verdict: PASS WITH EVIDENCE
- Task-owned paths:
  - `game/src/core/realm/body/BodyChapter.ts`
  - `game/src/core/realm/body/BodyProgressionSystem.ts`
  - `game/src/core/realm/body/BodyRefinementChapter.ts`
  - `game/src/core/realm/body/MeridianChapter.ts`
  - `game/src/core/realm/body/BodyChapter.test.ts`
  - `game/src/core/realm/body/BodyProgressionSystem.physique.test.ts`
  - `game/src/core/realm/body/BodyBaseStatAssembly.test.ts`
  - `game/src/data/realm/PhysiqueLadder.test.ts`

## Scope and Risk Map

Changed systems: BodyProgression chapter registry + dispatch (economy/progression domain). One-hop consumers from the risk mapper: UI affordability/unlock state (`GameManagerRealmAdvanceOps.investBodyChapter` → MeridianSection + tick auto-invest + EarlyGameSession), save and offline progression (`applyAllBodyModifiers` restore rebuild, `assertBodyProgressionIntegrity` preflight, `resolvePlayerStatAssembly` effective-stat pipeline).

Escalation check: no persisted-shape change (`chapterKind` is authored-definition data; `BodyProgressionState` unchanged; `physiqueGrade` and save version untouched), no clock/offline change, no Vue/Pinia/Phaser surface, `deepAuditCandidate: false`, no `unmappedPaths` → quick mode sufficient, no deep escalation.

Exclusions: none (working tree contains only task-owned paths).

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-QA-1 | `physiqueGrade` / `investBodyChapterState` | Invest completing a full normal chapter advances one rung, once | Exactly-once + Idempotency | Repeat: re-invest on complete chapter, re-call seam | `physiqueGrade` stays `bao` | unit | High — core mission invariant |
| INV-QA-2 | module `BodyChapter.ts` | Import order: `assertBodyChapterRegistry()` runs after `BODY_CHAPTER_BY_ID` init | Recoverability (fail-closed on authored corruption, NOT on valid data) | Reorder / module evaluation | Every importer loads; 1500+ tests green | unit (import-level) | Critical — a wrong order bricks the whole app |
| INV-QA-3 | `collectBodyBaseStatDeltas` | Capability-driven collection replaces kind-gated collection | Conservation | Stale state: meridian-only progress | `{}` for modifier-only player; deltas for refinement player | unit | High — the channel contract |
| INV-QA-4 | `validateBodyChapterRegistry` | Synthetic malformed catalogs surface issues; real catalog clean | Recoverability | Value mutation (dup id, bad kind, missing impls, gapped chain, missing/orphan slice) | issue paths/messages per rule | unit | High — the registry-validation mandate |
| INV-QA-5 | `applyPhysiqueAdvancement` seam | Non-invest completion path (direct state + seam call) still advances; grade past `from` never rewritten | Monotonicity + Idempotency | Reorder / repeat | grade moves `pham→bao`, `phap` untouched, double-call no-op | unit | High — the TC-ready seam |
| INV-QA-6 | Restore (`applyAllBodyModifiers`) | Post-transform save restored | Idempotency + Monotonicity | Interruption: restore path never re-derives/re-applies | grade stays `bao` without invest | unit | Medium — INV-2 pin |
| INV-QA-7 | `BodyProgressionState` defaults | Registry↔state-slice coherence | Atomicity of authoring | Value mutation (chapter w/o slice, orphan slice) | issues at `bodyProgression.*` | unit | Medium — enforces 1:1 keying |
| INV-QA-8 | Emission `kind` discriminant | `applyChapterEffect` exhaustiveness unchanged | (unchanged) | — | existing suites | unit | Low — untouched by mission |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npm run type-check` (vue-tsc --build) | PASS, exit 0 | Full project type-check |
| `npx vitest run src/core/realm/body src/data/realm/PhysiqueLadder.test.ts src/data/realm/PhysiqueEssence.test.ts src/services/save/saveShapeValidation.test.ts src/services/save/SaveRoundTrip.test.ts` | 11 files / 444 tests PASS | Scoped: registry, chapters, assembly, physique, save boundary |
| `npx vitest run src/core/game src/stores src/core/simulation src/core/progression tests/lab` | 160 files / 1084 tests PASS (+4 expected-fail) | Wider one-hop consumers (GameManager ops, stores, sim, node ops) |
| Module-load assertion exercised | PASS | `assertBodyChapterRegistry()` executes at every test/app import — no throw on the real registry |
| `ocr delegate preview` (P18) | 8/8 reviewable, 100% reviewed | Clean pass, no confirmed Medium+ findings |

## Findings

No Confirmed findings. No Suspected findings material to this diff.

Notes (non-blocking):
- `assertBodyChapterRegistry()` is a deliberate module-load data guard (mirrors `SkillDefinitionRegistry` constructor validation for a static const catalog). It is not directly test-instrumented for the throw path — the throw is exercised by `validateBodyChapterRegistry` unit coverage; instrumentation would require a malformed real registry, which is exactly what the guard forbids.
- `'zhou_tian'` exists in `BODY_CHAPTER_KINDS` before any chapter uses it (declared seam, not content). Registry validation treats it as a valid kind value; a chapter id union + state slice still arrive with M-F-CHU-THIEN.

## New or Changed QA Tests

None — the mission's own test additions provide the reproduction/evidence surface (registry-validation synthetic catalogs, seam idempotency/late-completion, restore non-recompute, channel skip). QA author scope untouched.

## Gaps and Residual Risk

- Synthetic malformed-registry coverage asserts issue *presence* per rule, not exhaustive pairings; residual risk is a rule silently skipped — bounded by the real-registry clean assertion + module-load throw.
- No runtime/browser evidence needed: no UI surface, no wiring-critical path (`GameManager.update`, boot, lifecycle) changed — P13/P14 not triggered.

## Pre-existing Failures

None observed. 4 expected-fail tests in `src/core/game` scope are pre-existing marked cases, unrelated.
