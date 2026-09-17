# QA Review: Mission D — Worker Economy Authority

- Date: 2026-09-17
- Mode: deep (mandatory escalation: save schema v67 + offline settle + Vue lifecycle)
- Verdict: PASS WITH EVIDENCE
- Task-owned paths:
  - `src/core/production/{WorkerCapacity,WorkforceView}.ts` (new)
  - `src/core/production/{ProductionSystem,ProductionOffline,ProductionCatalog,ProductionBalance,ProductionTypes}.ts`
  - `src/core/game/{GameManagerTickOps,GameManagerSaveRestore,GameManagerBuildingOps,GameManager}.ts`
  - `src/services/save/{SaveSystem,saveTypes,saveShapeValidation,saveVersion}.ts`
  - `src/components/panels/ProductionPanel.vue`, `src/App.vue`
  - `src/locales/{vi,en}.json`

## Scope and Risk Map

Changed systems: production domain (worker lanes only; manual `activeCycle` deleted end-to-end), worker-pool split rule (single helper), realm→tier clamp (single resolver), decompose cadence pin (test-only), workforce read model + panel rewire, save schema v67 (`activeCycle` dropped; stale keys tolerated/whitelisted).

One-hop consumers: `App.vue` boot grant (autoRestart enable), `GameManager.update` tick chain, `save-reload` e2e path, `WorkerLodgePanel` (decompose reservation source), `ChiHienQuan` integration.

Escalation: save/cloud (schema v67), time/offline (settle parity, decompose rebase), Vue lifecycle (derived panel mode) — deep mode applied.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-D-01 | `productionSites` save slice / SaveSystem | restore v66-shaped payload carrying `activeCycle` | Recoverability: stale key tolerated, whitelisted out, never reaches live state | Stale state | restored state has no `activeCycle`; validation issues empty | unit (`saveShapeValidation`, `restoreStates` whitelist at ProductionSystem.ts:127-134) | High — corrupt/old save must boot |
| INV-D-02 | worker-pool split / WorkerCapacity | online tick + offline settle + panel + assignWorkers all consume `resolveProductionWorkerCapacity` | Synchronization: one split rule, decompose-first | Reorder | `GameManagerSaveRestore:418` reads `decomposeSystem.getSettings().workers` AFTER `decomposeSystem.restore` at :400 and `updateCapacity` at :399 | integration (`GameManagerSaveRestore.boundary.test.ts`) | Critical — ordering regression = double-spend of worker pool offline |
| INV-D-03 | lane set / WorkerLaneAdvance | capacity drops below in-flight lane count | Boundedness: retained lanes decay, no respawn beyond slots | Value mutation | lanes beyond slots complete once, then die (`inFlight < slots` gate at :175) | unit (`WorkerLaneAdvance` tests) | High — ghost-lane exploit |
| INV-D-04 | `workerCycles[].completesAtMs` / validator | save payload with NaN/∞ timestamps | Boundedness: non-finite deadlines rejected at boundary | Value mutation | `validateProductionCycleSave` requires `isFiniteNumber(startedAtMs/completesAtMs)` (:878-879) + parent siteId match (:930-939) | unit (`saveShapeValidation.test.ts`) | High — NaN deadline insta-completes online (`NaN > nowMs` false) |
| INV-D-05 | production production / ProductionSystem | site with 0 allocated slots, autoRestart on | Conservation: zero workers → zero output online AND offline | Value mutation | `tickWorkers` early-return capacity<=0 (:293); `settleWorkersOffline` same (:111); lanes seeded only `count < slots` | unit | Critical — workers-as-fuel core contract |
| INV-D-06 | realm→tier / ProductionCatalog | realm above `foundation_establishment`, unknown realm, empty realmIds | Boundedness: clamp to top supported / first supported; never silent -1 | Value mutation | `resolveTerritoryTier` (:293): in-range→self; above→highest supported; unknown→`realmIds[0]`; applied at tick :314, settle :384, rollRewards :439 (idempotent double-clamp on legacy snapshots) | unit (`ProductionSystem.realmTier.test.ts`) | High — unsupported realm used to reject/derail production |
| INV-D-07 | decompose deadline / DecomposeSystem | far-past or far-future `nextCycleAt` | Monotonicity+Boundedness: exactly one cycle per late tick; rebase to now+cycleMs | Timing boundary | `DecomposeSystem.test.ts` regression pin (MA-R3-01) | unit | Medium — catch-up burst or indefinite stall |
| INV-D-08 | panel mode / ProductionPanel | assignedWorkers present vs absent | Synchronization: mode derives from persisted intent, not local ref | Stale state | `workforce.requested` keys; sliders max `workforce.available`; reservation rendered | component (`ChiHienQuan.integration.test.ts`) | Medium — UI lying about engine truth |
| INV-D-09 | `settleOffline` workerCapacity / ProductionOffline | NaN/negative workerCapacity through the seam | Boundedness: NaN capacity must not allocate | Value mutation | sole caller passes helper output (finite ≥0); even if NaN reached `allocateWorkerSlots`, `Math.max(0, floor(NaN))=NaN` → `NaN > 0` false → zero new lanes; saved lanes still forfeit under budget | static | Low — unreachable in practice |
| INV-D-10 | double-settle / payload hash | same payload re-restored (boot retry) | Idempotency: `lastAppliedPayloadHash` commits only after full restore (:465); decompose deadline rebased to wall-clock so second settle is no-op | Repeat | Mission A hash-commit retained; rebase means immediate second tick produces nothing | integration | High — QA-2026-09-08-001 regression class |
| INV-D-11 | `assignWorkers` clamp / BuildingOps | per-site request up to full remainder while other sites also request | Conservation: over-request resolves via allocator Map order, never exceeds pool | Repeat | `assignWorkers` clamps to `capacity` (:178-187); allocator grants manual first in order, remainder round-robin | unit | Medium — documented contention contract, not a defect |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npm run type-check` | PASS | clean |
| `npm run build` | PASS | built 4.27s |
| `npx vitest run` (full) | PASS WITH NOTE | 5202 passed / 1 failed `sessionHandoff.test.ts` — **Flaky**: isolated rerun passed 5/5 (3.11s); combat test untouched by Mission D, load-flake class consistent with Missions B/C |
| Playwright `save-reload.spec.ts` + `boot-fresh.spec.ts` (in-worktree) | PASS | 2/2 — v67 round-trip + boot path without `startProductionCycle` |
| `rg "activeCycle" src/` | PASS | zero code hits; remaining references are comments/tests pinning stale-key tolerance (ProductionOffline:55, ProductionSystem:3/113/275, saveShapeValidation:913-915, saveVersion:66-68) |
| Restore-ordering inspection | PASS | `updateCapacity`(:399) → `decomposeSystem.restore`(:400) → split(:418-421) → `settleOffline`(:412-425) — decompose reservation is post-restore at split time |
| `getSiteView` empty-lane edge | PASS | `cycleRemainingMs`/`cycleTotalMs` undefined when no lanes; earliest-lane scan is straightforward |

## Findings

No Confirmed or Suspected defects. All high-risk hypotheses resolved by direct code evidence plus the task-authored regression suite.

## New or Changed QA Tests

None — every material hypothesis was already pinned by task-authored tests (`WorkerCapacity.test.ts`, `WorkforceView.test.ts`, `ProductionSystem.realmTier.test.ts`, `GameManagerSaveRestore.boundary.test.ts`, `DecomposeSystem.test.ts` pin, `ChiHienQuan.integration.test.ts`, stale-key tolerance in `saveShapeValidation.test.ts`).

## Gaps and Residual Risk

- **INV-D-09 (Nit):** `settleProductionOffline` floors but does not NaN-guard `workerCapacity`; reachable only if a future caller bypasses `resolveProductionWorkerCapacity`. Bounded behavior verified (zero new lanes, saved lanes still forfeit). No fix needed.
- **INV-D-11 (Nit):** per-site `assignWorkers` clamps to the full remainder, so the sum of manual requests can exceed the pool; contention resolves by allocator Map order. Documented contract — surfaced here so future UI work doesn't mistake it for a bug.
- **`resolveTerritoryTier` (Nit):** returns `realmIds[0]!` — undefined if a territory ever ships empty `realmIds`; downstream degrades to `cycleMs=0` (no lanes) rather than a crash. All shipped territories have 3 ids.
- **Panel `requested` includes non-autoRestart sites:** mode shows "manual" if any site retains `assignedWorkers` even while that site is off — correct intent-preserving semantics (assignments reapply on re-enable), noted for future UX passes.
- **Flaky evidence:** `sessionHandoff.test.ts` full-suite failure, isolated pass — recorded as Flaky, not task-caused.

## Pre-existing Failures

- `src/presentation/sessionHandoff.test.ts` full-run timeout-class failure (victory/defeat mismatch under parallel load); passes isolated. Same load-flake class recorded in Mission B/C reports.
- `useAppLifecycle.test.ts` Vue warnings (`onBeforeUnmount` outside component) — pre-existing test-env noise, non-failing.
