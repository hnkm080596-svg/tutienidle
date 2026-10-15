# QA Run Report — `beta-stabilization-phase1-2026-10-15` (Phase 1 + Phase 2)

- **Branch**: `phase-1-beta-fixes`
- **Worktree**: `E:\tutienidle\.agent-worktrees\phase-1-beta-fixes`
- **Base Commit**: `796034053`
- **Scope**:
  - Phase 1 Slices 1.1–1.6 (`R1, R5, D1, D2, D3, D7, V4c`) + E2E scope-leak fix (`TurnCombatSkillBar.vue` `scope-hidden` ultimate card) + `CharacterFidelityIdentity.vue` test IDs.
  - Phase 2 Slices 2.1–2.7 (`R2, R3, R4` + integrated functional repairs from `codex/qa-findings-reconciliation`: `MaterialReceipt`, `ProductionReceiptCursor`, 64/65/500-item bulk dissolve batching, `computeRestoreIdentity` receipt payload, `cancelPendingCycles()`, `AssetBaseUrl.ts`, `AssetBundleCatalog.ts`, `ArchitectureBuildingCard.vue`, and 93 test contract updates).

## 1. Verification Evidence (P3 + Release Scripts + P13/P14 Browser E2E)

- **Type-check (`npm run type-check`)**: PASS (`0` errors).
- **Production Build (`npm run build`)**: PASS (`built in 9.81s`).
- **Full Vitest Suite (`npx vitest run`)**: `1,105 / 1,105` active test files PASS (`10,623` passing tests, `0` deterministic failures, `4` skipped files, `16` todo).
- **Release Scripts (`node --test "scripts/release/*.test.mjs"`)**: `116 / 116` tests PASS.
- **Playwright E2E & P14 Visual/Runtime Verification (MS Edge against worktree dev server)**:
  - `tests/e2e/boot-fresh.spec.ts`: 1/1 PASS
  - `tests/e2e/create-to-combat.spec.ts`: 1/1 PASS
  - `tests/e2e/time-authority.spec.ts`: 1/1 PASS
  - `tests/e2e/beta-readiness-transition.qa.spec.ts`: 1/1 PASS
  - `tests/e2e/beta-journey.spec.ts`: 10/10 PASS (includes P14 runtime checks for mortal `Tâm Pháp` lock, `Shift+Tab` `:focus-visible` `2px solid` gold outline, and `hoa_diem_uy` localized `levelEffects` via `describeNodeLevelEffects`)
  - `tests/e2e/architecture-panel.spec.ts`: 2/2 PASS
  - `tests/e2e/save-reload.spec.ts`: 1/1 PASS

## 2. P18 Open Code Review (`ocr delegate preview -f json`)

- **Total workspace files**: 156
- **Reviewable files**: 153 (`149` source/test files reviewed; `4` generated QA ledger JSON files under `game/docs/qa/runs/beta-stabilization-phase1-2026-10-15/` skipped with reason `"generated QA run ledger artifact"`).
- **Excluded files**: 3 (`unsupported_ext` `.md` / `.jsonl` files reviewed manually).

## 3. P4 Adversarial QA Summary

- **Verdict**: `PASS WITH EVIDENCE`
- **Adversarial checks executed**:
  - Material receipt producer/consumer frontier & outbox persistence (`MaterialBag.receipts.test.ts`, `MaterialBag.compaction.test.ts`, `GameManager.materialReceipts.test.ts`, `EquipmentOpsSystem.receipts.test.ts`).
  - Bulk dissolve 64/65/500-item reward preservation (`EquipmentOpsSystem.receipts.test.ts`).
  - Restore identity tampering on `materialReceipts` (`GameManagerSaveRestore.boundary.test.ts`).
  - Default standing position 5 full mortal journey (`PartyFormation.defaultJourney.test.ts`, `BetaJourney.test.ts`, `TrucCoJourney.test.ts`, `BalanceMatrix.test.ts`).
  - Minor floor breakthrough commit-before-FX under FX rejection (`RealmSurface.advanceFloor.test.ts`).
  - Scope-hidden ultimate card token leak (`TurnCombatSkillBar.display.test.ts`, `betaScopeRenderedTokens.test.ts`).

## 4. P5 Sequential Multi-Pass Review Chronology

```
Sequential Review Pass 1 — Local Correctness / Regression
  Reviewed state: post-OCR implementation state (149 source/test files)
  Findings:
    - [Medium] `game/src/components/scenes/realm/RealmSurface.vue:110`: `gameManager.realmAdvanceOps.breakthroughWithConsequences(player)` returns `BreakthroughOutcomeResult` (`{ kind: 'success' | 'failure' }`), not `boolean`. Checking `if (!ok)` would treat `{ kind: 'failure' }` as truthy if `canAdvanceFloor` ever diverged from the domain guard.
  Fixes:
    - Updated `RealmSurface.vue:110-115` to check `if (result.kind === 'failure')` and added 3 unit tests in `game/src/components/scenes/realm/RealmSurface.advanceFloor.test.ts` covering commit-before-FX, FX rejection resilience, and domain failure handling.
  Verification:
    - `npx vitest run src/components/scenes/realm/RealmSurface.advanceFloor.test.ts` (3/3 PASS) + `npm run type-check` (PASS) + `ocr delegate preview -f json` re-run on updated state.

Sequential Review Pass 2 — Architecture / Authority / Ownership
  Reviewed state after Pass 1 fixes: YES
  Findings: None (0 Critical / High / Medium / Low). Verified P17 runtime/presentation/logic separation in `RealmSurface.vue`, V4c pure domain read-model `describeNodeLevelEffects` in `NodeSystem.ts`, `ui.openStandalonePanel('skill')` panel authority in `ExplorationSurface.vue`, and bounded receipt frontiers in `MaterialBag.ts` / `ProductionSystem.ts` / `QuestManager.ts`.
  Fixes: None.
  Verification: Existing Pass 1 verification remains valid.

Sequential Review Pass 3 — Adversarial Integration
  Reviewed state after Pass 2 fixes: YES
  Findings: None (0 Critical / High / Medium / Low). Verified re-entry protection (`advancing.value`), watcher interaction (`displayedFloor.value === null`), CSS `@scope` boundary for `:focus-visible` in real MS Edge (`beta-journey.spec.ts`), and 64-receipt batch splitting across multi-item equipment dissolution.
  Fixes: None.
  Verification: Existing verification + Playwright E2E evidence remains valid.

Sequential Review Pass 4 — Post-Pass-1 Third Consecutive Clean Pass
  Reviewed state after Pass 3 fixes: YES
  Findings: None (0 Critical / High / Medium / Low). Three consecutive passes after the Pass 1 Medium fix completed with zero unresolved confirmed findings.
  Fixes: None.
  Verification: Gate complete.
```
