# R5 — Combat Runtime & Presentation Boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (project convention: opencode has no subagent dispatch — Inline Execution, per P6). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish complete separation between gameplay facts, runtime scheduling, and presentation playback: enforce mandatory token validation on all 3 presentation ACKs, emit gameplay `attack` events on action commit, decouple body refinement from visual particles, invert upward imports, and encapsulate scene helper maps.

**Architecture:** Create `TurnBattleConstants.ts` and `CombatAnimationTypes.ts` to invert upward imports; enforce `token: string` on `acknowledgeTurnReady`, `acknowledgeActionImpact`, and `acknowledgeActionComplete` in `CombatAnimationRuntime` and `CombatScene`; emit `attack` event from `TurnBattleSystem.applyActionImpact`; run body refinement auto-investment directly in domain logic; encapsulate `castBars` and `interpolations` maps inside their respective helper classes.

**Tech Stack:** TypeScript + Vue 3 + Phaser 3 + Vitest.

**Spec:** `game/docs/superpowers/specs/2026-09-08-r5-combat-runtime-presentation-boundary-design.md`

## Global Constraints

- Follow Protection Rules (P1–P17) and Architecture Constitution (A1–A12).
- Do NOT split `CombatScene` because of line count alone (roadmap mandate §CombatScene rule).
- No TypeScript `any` (P8); code comments in English plain ASCII only (P15).
- Presentation failure or absence must never stall gameplay progression or change gameplay outcomes.
- Verification per task: `npx vitest run <file>`; final verification: P3 full (`type-check` + `build` + `npx vitest run`).

---

### Task 1: Worktree Setup & Clean Baseline

**Files:** none (environment setup).

**Interfaces:**
- Consumes: master at HEAD (`c7bdf3f5`).
- Produces: isolated worktree `.agent-worktrees/r5-runtime-presentation` on branch `feat/r5-runtime-presentation` with valid `node_modules` junction and green baseline suite.

- [ ] **Step 1: Create worktree:**
  Run: `git worktree add ".agent-worktrees/r5-runtime-presentation" -b feat/r5-runtime-presentation`
  Run: `New-Item -ItemType Junction -Path ".agent-worktrees/r5-runtime-presentation/game/node_modules" -Target "E:\tutienidle\game\node_modules"`
- [ ] **Step 2: Verify clean baseline:**
  Run: `npm.cmd run type-check` (in worktree `game/`)
  Run: `npx.cmd vitest run src/core/battle/turn src/game/scenes/combat src/core/game`
  Confirm all tests pass.

---

### Task 2: Dependency Inversion & Cycle Elimination (AR-24)

**Files:**
- Create: `game/src/core/battle/turn/TurnBattleConstants.ts`
- Create: `game/src/core/battle/CombatAnimationTypes.ts`
- Modify: `game/src/core/battle/turn/TurnActionPresentationEvents.ts:6`
- Modify: `game/src/core/game/GameManagerTurnBattleOps.ts:53-56`
- Modify: `game/src/core/game/GameManager.ts:157`
- Modify: `game/src/core/battle/turn/CombatAnimationRuntime.ts:6`
- Modify: `game/src/game/support/CombatAnimationSet.ts:1-10`

**Interfaces:**
- `TurnBattleConstants.ts`:
  ```typescript
  export const COUNTDOWN_TOTAL_TICKS = 30
  export const INTRO_TOTAL_TICKS = 30
  ```
- `CombatAnimationTypes.ts`:
  ```typescript
  export type CombatAnimationName =
    | 'idle'
    | 'ready'
    | 'cast'
    | 'standby'
    | 'hit'
    | 'death'
    | 'basic_attack'
    | 'victory'
  ```

- [ ] **Step 1: Create `TurnBattleConstants.ts` and `CombatAnimationTypes.ts`:**
  Write both foundation files.
- [ ] **Step 2: Update callers:**
  - `TurnActionPresentationEvents.ts`: import `COUNTDOWN_TOTAL_TICKS` from `./TurnBattleConstants`.
  - `GameManagerTurnBattleOps.ts`: import `COUNTDOWN_TOTAL_TICKS` and `INTRO_TOTAL_TICKS` from `../battle/turn/TurnBattleConstants`.
  - `CombatAnimationRuntime.ts`: import `CombatAnimationName` from `../CombatAnimationTypes`.
  - `CombatAnimationSet.ts`: import and re-export `CombatAnimationName` from `@/core/battle/CombatAnimationTypes`.
- [ ] **Step 3: Run type-check to verify no import cycle remains:**
  Run: `npm.cmd run type-check`
  Confirm clean compilation.

---

### Task 3: Mandatory Token Protection on Ready & Impact ACKs (AR-20, TDD)

**Files:**
- Modify: `game/src/core/battle/turn/CombatAnimationRuntime.ts:184-230, 255-270`
- Modify: `game/src/game/scenes/CombatScene.ts:511-517, 1815-1827, 2227-2279`
- Test: `game/src/core/battle/turn/CombatAnimationRuntime.test.ts`

**Interfaces:**
- `CombatAnimationRuntime`:
  - `acknowledgeTurnReady(token: string): void` — rejects if `!token || token !== this.playbackToken`.
  - `acknowledgeActionImpact(token: string): void` — rejects if `!token || token !== this.playbackToken`.
  - `acknowledgeActionComplete(token: string): void` — rejects if `!token || token !== this.playbackToken`.
- `CombatScene`:
  - `onTurnReady`: captures `token` at trigger; passes to `acknowledgeTurnReady(token)`.
  - `onAttack`: captures `token` at trigger; passes to `acknowledgeActionImpact(token)`.
  - `onActionImpact`: captures `token` at trigger; passes to `acknowledgeActionComplete(token)`.

- [ ] **Step 1: Write failing tests in `CombatAnimationRuntime.test.ts`:**
  Test that calling `acknowledgeTurnReady()` with `undefined` or with an outdated token is rejected as a stale no-op.
  Test that calling `acknowledgeActionImpact()` with `undefined` or an outdated token is rejected as a stale no-op.
- [ ] **Step 2: Run test to verify failure:**
  Run: `npx.cmd vitest run src/core/battle/turn/CombatAnimationRuntime.test.ts`
  Confirm failures (undefined tokens currently pass through).
- [ ] **Step 3: Enforce token validation in `CombatAnimationRuntime.ts`:**
  Change `if (token !== undefined && token !== this.playbackToken)` to `if (!token || token !== this.playbackToken)` across all 3 ACK methods.
- [ ] **Step 4: Update `CombatScene.ts`:**
  Update `gameManagerRef` signature to require `(token: string) => void`.
  Capture `const token = this.gameManagerRef?.getPendingPlaybackToken() ?? ''` at event entry in `onTurnReady` and `onAttack`, and pass `token` into the delayed call / tween completion.
- [ ] **Step 5: Run tests to verify pass:**
  Run: `npx.cmd vitest run src/core/battle/turn/CombatAnimationRuntime.test.ts src/game/scenes/CombatScene.hudWiring.test.ts`
  Confirm all tests pass.

---

### Task 4: Gameplay `attack` Event & Decoupled Progression Timing (AR-14, TDD)

**Files:**
- Modify: `game/src/core/battle/turn/TurnBattleSystem.ts:910-940`
- Modify: `game/src/core/game/GameManager.ts:1780-1815, 2650-2670`
- Modify: `game/src/App.vue:305-325`
- Modify: `game/src/composables/useAppLifecycle.ts:110-128, 300-310`
- Test: `game/src/core/battle/turn/TurnBattleSystem.attackEvent.qa.test.ts` (create)

**Interfaces:**
- `TurnBattleSystem.applyActionImpact`:
  Emits `eventBus.emit('attack', { type: 'attack', sourceId, targetId, skillId })` when actions resolve, ensuring headless and presentation modes behave identically for passive listeners.
- `GameManager.investBodyRefinement`:
  Can be called directly upon loot grant without waiting for `essence_arrived` or 2s timeout.

- [ ] **Step 1: Write test in `TurnBattleSystem.attackEvent.qa.test.ts`:**
  Test that resolving a turn in headless mode emits `'attack'` on the EventBus with the correct `sourceId`, `targetId`, and `skillId`.
- [ ] **Step 2: Run test to verify failure:**
  Run: `npx.cmd vitest run src/core/battle/turn/TurnBattleSystem.attackEvent.qa.test.ts`
  Confirm failure.
- [ ] **Step 3: Emit `attack` in `TurnBattleSystem.applyActionImpact`:**
  Emit `'attack'` event when action impacts targets (damaging or self-buff).
- [ ] **Step 4: Decouple body refinement in `App.vue` & `useAppLifecycle.ts`:**
  In `App.vue`: auto-invest body refinement directly in tick when essence is available in inventory, or upon loot grant, without gating behind `essenceArrivalSeen` or `isEssenceHeadlessTimedOut`.
- [ ] **Step 5: Run tests to verify pass:**
  Run: `npx.cmd vitest run src/core/battle/turn/TurnBattleSystem.attackEvent.qa.test.ts src/composables/useAppLifecycle.test.ts`
  Confirm all tests pass.

---

### Task 5: Encapsulate Scene Helpers (AR-29, TDD)

**Files:**
- Modify: `game/src/game/scenes/combat/combat-cast-bar.ts`
- Modify: `game/src/game/scenes/combat/combat-position-interpolation.ts`
- Modify: `game/src/game/scenes/CombatScene.ts:1220-1290`
- Test: `game/src/game/scenes/combat/combat-cast-bar.test.ts` (create or update)

**Interfaces:**
- `CombatCastBar`:
  - `private readonly castBars = new Map<string, CastBarSprite>()`
  - `getCastBars(): ReadonlyMap<string, CastBarSprite>`
  - `destroyCastBar(sourceId: string): void`
  - `destroyAll(): void`
- `CombatPositionInterpolation`:
  - `private readonly interpolations = new Map<string, PositionInterpolation>()`
  - `getInterpolations(): ReadonlyMap<string, PositionInterpolation>`
  - `clear(): void`
- `CombatScene`:
  - Delegates `castBars` and `interpolations` getters to the helpers, eliminating direct map mutation by external classes.

- [ ] **Step 1: Write test asserting helper encapsulation:**
  Verify that `CombatCastBar` and `CombatPositionInterpolation` manage and clear their own maps without mutating `CombatScene` properties directly.
- [ ] **Step 2: Refactor `combat-cast-bar.ts`:**
  Move `castBars` map into `CombatCastBar`.
- [ ] **Step 3: Refactor `combat-position-interpolation.ts`:**
  Move `interpolations` map into `CombatPositionInterpolation`.
- [ ] **Step 4: Update `CombatScene.ts`:**
  Delegate calls to helper methods.
- [ ] **Step 5: Run tests to verify pass:**
  Run: `npx.cmd vitest run src/game/scenes/combat`
  Confirm all tests pass.

---

### Task 6: Full Verification, QA & Merge

- [ ] **Step 1: P3 Full verification:**
  Run: `npm.cmd run type-check` (in worktree `game/`)
  Run: `npm.cmd run build` (in worktree `game/`)
  Run: `npx.cmd vitest run` (full suite, all 419+ test files)
  Stop on first failure.
- [ ] **Step 2: E3 code-simplifier pass** over task diff.
- [ ] **Step 3: P5 code-review** (post-simplify), resolve findings ≥80 confidence.
- [ ] **Step 4: P4 adversarial QA quick:**
  Write `game/docs/qa/2026-09-08-r5-runtime-presentation-quick.md` with full invariant ledger and P17 contract record.
- [ ] **Step 5: Commit & Merge:**
  Commit in worktree: `feat(r5): combat runtime and presentation boundary separation (AR-14, AR-20, AR-24, AR-29)`
  Checkout master, merge `feat/r5-runtime-presentation`.
  Verify merged master: `npm.cmd run type-check` + `npx.cmd vitest run`.
- [ ] **Step 6: Update roadmap:**
  Mark R5 COMPLETE with evidence; advance NEXT pointer to R6.
  Remove R5 worktree and branch.
