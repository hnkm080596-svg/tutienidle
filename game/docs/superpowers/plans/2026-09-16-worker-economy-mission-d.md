# Mission D — Worker Economy Authority Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development or executing-plans. Steps use checkbox syntax for tracking.

**Goal:** One workforce authority — workers are required fuel for all production; the manual `activeCycle` path is removed; UI renders the domain's read model.

**Architecture:** `ProductionSystem` owns allocation and exposes `getWorkforceView()` (`{total, reserved, available, requested, effective, idle}`). Realm→tier resolution clamps at one boundary. Decompose cadence follows the documented no-burst contract.

**Tech Stack:** TypeScript, Vue 3 (panel rewire), Vitest.

**Spec:** `docs/specs/2026-09-16-audit-remediation-spec.md` Mission D (decisions locked: workers-as-fuel, clamp-to-top-tier, HUD+panel controls). Audit: `docs/qa/2026-09-16-full-project-scout-audit.md` T3-17, T3-18, T4-29, T4-30, T5-47, N-02.

## Global Constraints

- Dev-stage rule: remove the manual cycle path outright — no deprecation bridge.
- D3 decision: **workers required for production** — `activeCycle` deleted; lane count = `activeWorkerSlots` exactly.
- D2 decision: clamp realm→top supported territory tier; leave a documented extension point.
- A2/A5/A9: one allocation owner; UI consumes the read model, never recomputes.
- P8 no `any`; P15 English comments; P16 UI strings via `t()`.
- Worktree: `.agent-worktrees/worker-economy` (branch `refactor/worker-economy`).

---

### Task 1: Workforce read model + panel rewire

**Files:**
- Modify: `game/src/core/production/ProductionSystem.ts` (add `getWorkforceView`), `game/src/components/panels/ProductionPanel.vue` (consume it; delete local `workerMode` ref ~line 216)
- Test: `game/src/core/production/` colocated test for the view model; component test for panel mode derivation

**Interfaces:**
- Produces: `getWorkforceView(): { total: number; reserved: number; available: number; requested: Record<siteId, number>; effective: Record<siteId, number>; idle: number }` — exact field names finalized by implementer after reading `WorkerAllocator`/`GameManagerTickOps.ts:154-159`.

- [ ] **Step 1: Read first** — `WorkerAllocator.ts`, `GameManagerTickOps.ts:154-165`, `GameManagerBuildingOps.ts:116-165` (assignment API), `ProductionPanel.vue` (rows/slider/capacity usage).
- [ ] **Step 2: Failing tests** — view model reflects `reserved` (decompose) vs `available` (production); panel mode derives `manual` when any `assignedWorkers` present (no local ref).
- [ ] **Step 3: Implement** — `getWorkforceView` on the production/workforce owner; panel consumes it; `workerMode = computed(() => hasManualAssignments ? 'manual' : 'auto')`; slider maxes = `available`, not `total`.
- [ ] **Step 4: PASS + type-check.**
- [ ] **Step 5: Commit** `refactor(production): single workforce read model consumed by UI`

---

### Task 2: Realm→territory-tier clamp at the boundary

**Files:**
- Modify: `game/src/core/production/ProductionSystem.ts:179` (validation), `game/src/core/production/ProductionOffline.ts:106,121`, `game/src/core/production/ProductionCatalog.ts:23`, worker lane tier-profile lookup (`indexOf → -1` site)
- Test: production tests — realm `golden_core`+ resolves to top supported tier, no rejection.

- [ ] **Step 1: Failing test** — player realm `golden_core`: `start`/`autoRestart`/`settleOffline` all succeed using the highest supported territory tier (foundation_establishment profile).
- [ ] **Step 2: FAIL.**
- [ ] **Step 3: Implement** — `resolveTerritoryTier(realmId): TerritoryTier` helper (clamp, documented extension point); all entry points call it; delete the `indexOf`-fallback lane profile.
- [ ] **Step 4: PASS.**
- [ ] **Step 5: Commit** `fix(production): clamp realm to supported territory tier`

---

### Task 3: Workers-as-fuel — remove manual `activeCycle`

**Files:**
- Modify: `game/src/core/production/ProductionSystem.ts`, `ProductionOffline.ts`, `ProductionTypes.ts` (drop `activeCycle` from state/save), `game/src/services/save/saveTypes.ts` (`ProductionSiteStateSave.activeCycle` removal), `SaveSystem.ts` serializer, `GameManagerBuildingOps.ts` (start/cancel manual ops), `ProductionPanel.vue` (start-cycle UI)
- Test: production test suite — remove/replace manual-cycle tests with workers-required equivalents.

**Interfaces:**
- Produces: production runs iff `assignedWorkers > 0`; `workerCycles` is the only cycle kind. Save type drops `activeCycle`.

- [ ] **Step 1: Read first** — enumerate every `activeCycle` consumer (grep) before deleting; list in report.
- [ ] **Step 2: Failing tests** — site with 0 workers produces nothing online or offline; site with workers produces via `workerCycles` only.
- [ ] **Step 3: Implement** — delete the manual cycle path end-to-end (state, save field, ops, UI start button). Dev-stage: no save migration for the removed field — validator tolerates its absence; strip it if present (normalizedSave drop or `assignedWorkers`-style optional handling — pick per validator conventions).
- [ ] **Step 4: PASS + `npx vitest run src/core/production src/services/save`.**
- [ ] **Step 5: Commit** `refactor(production): workers-as-fuel; remove manual cycle path`

---

### Task 4: Decompose cadence — no catch-up burst

**Files:**
- Modify: `game/src/core/production/DecomposeSystem.ts:114-143` (tick)
- Test: `DecomposeSystem.test.ts` / `saveRestore.test.ts`

- [ ] **Step 1: Failing test** — cycle 30s, stall to t=300s → tick(300s) runs exactly ONE cycle and `nextCycleAt === 300s + 30s` (not `60s`).
- [ ] **Step 2: FAIL.**
- [ ] **Step 3: Implement** — after running a late cycle: `this.nextCycleAt = nowMs + this.cycleMs` (next cycle anchored to now, per the documented no-burst contract). Keep the single-cycle-per-tick structure.
- [ ] **Step 4: PASS.**
- [ ] **Step 5: Commit** `fix(decompose): anchor next cycle to now — no per-tick catch-up burst`

---

### Task 5: Shared capacity split

**Files:**
- Modify: `game/src/core/game/GameManagerTickOps.ts:154-159`, `game/src/core/game/GameManagerSaveRestore.ts:388,407-411` — extract shared `resolveProductionWorkerCapacity` helper (home: `core/production/` near `WorkerAllocator`)
- Test: parity test — online and offline paths produce identical capacity for identical state.

- [ ] **Step 1: Failing test** — same `autoWorkerCapacity` + same decompose workers → both paths return the same `productionCapacity` via the shared helper.
- [ ] **Step 2: FAIL** (two copies today).
- [ ] **Step 3: Implement** — `resolveProductionWorkerCapacity(player, decomposeSystem)` single owner; both call sites consume it.
- [ ] **Step 4: PASS.**
- [ ] **Step 5: Commit** `refactor(production): shared worker-capacity split for online/offline`

---

## Mission D done-criteria

- UI shows engine truth: mode + capacity derive from domain state.
- Realms above Trúc Cơ clamp to top supported tier; production never silently dies.
- No manual cycle path exists; workers are required fuel.
- Decompose never bursts; one cycle per tick, next deadline anchored to now.
- Online/offline capacity computed by one function.
- `npm run type-check` + `npx vitest run src/core/production src/core/game src/services/save` green; P4 quick QA; P5 review.
