# R4 — Buff / Status Foundation Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (project convention: opencode has no subagent dispatch — Inline Execution, per P6). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate the turn-based buff system into the single canonical `BuffSystem` at `src/core/buff/`, retire legacy real-time duplicate code, provide transparent compatibility aliases in `src/core/battle/turn/`, and decouple the survival policy content leak in `CombatSystem`.

**Architecture:** Move `TurnBuffTypes`, `TurnBuffPool`, and `TurnBuffSystem` into `src/core/buff/BuffTypes.ts`, `BuffPool.ts`, and `BuffSystem.ts`; add `updateTime(deltaSeconds)` for out-of-battle persistent buffs; re-export them from `src/core/battle/turn/TurnBuff*.ts`; replace hardcoded `'tu_sinh_ngo'` in `CombatSystem` with `SurviveEffectsPolicy`; deduplicate `TurnStatsRecompute.ts`.

**Tech Stack:** TypeScript + Vue 3 + Vitest.

**Spec:** `game/docs/superpowers/specs/2026-09-08-r4-buff-foundation-closure-design.md`

## Global Constraints

- Follow Protection Rules (P1–P17) and Architecture Constitution (A1–A12).
- No TypeScript `any` (P8); code comments in English plain ASCII only (P15).
- Do not change authored buff duration numbers or values in `buffs.ts` (spec §6).
- Preserve 100% backwards compatibility for existing imports in turn combat via re-export aliases.
- Verification per task: `npx vitest run <file>`; final verification: P3 full (`type-check` + `build` + `npx vitest run`).

---

### Task 1: Worktree Setup & Clean Baseline

**Files:** none (environment setup).

**Interfaces:**
- Consumes: master at HEAD (`1b05c739`).
- Produces: isolated worktree `.agent-worktrees/r4-buff-foundation` on branch `feat/r4-buff-foundation` with valid `node_modules` junction and green baseline suite.

- [ ] **Step 1: Create worktree:**
  Run: `git worktree add ".agent-worktrees/r4-buff-foundation" -b feat/r4-buff-foundation`
  Run: `New-Item -ItemType Junction -Path ".agent-worktrees/r4-buff-foundation/game/node_modules" -Target "E:\tutienidle\game\node_modules"`
- [ ] **Step 2: Verify clean baseline:**
  Run: `npm.cmd run type-check` (in worktree `game/`)
  Run: `npx.cmd vitest run src/core/buff src/core/battle/turn`
  Confirm all tests pass.

---

### Task 2: Decouple Survival Policy in `CombatSystem.ts` (AR-18, TDD)

**Files:**
- Modify: `game/src/core/combat/CombatSystem.ts:65-80, 500-520`
- Modify: `game/src/core/game/GameManagerTurnBattleOps.ts:205-215`
- Test: `game/src/core/combat/CombatSystem.surviveLethal.test.ts`

**Interfaces:**
- `SurviveEffectsPolicy`:
  ```typescript
  export interface SurviveEffectsPolicy {
    buffSystem: TurnBuffSystem
    registry: TurnBuffRegistry
    grantBuffId?: string       // Default: 'tu_sinh_ngo'
    cleanseDebuffs?: boolean   // Default: true
  }
  ```
- `CombatSystem.setSurviveLethalSession`:
  Takes `surviveEffects?: SurviveEffectsPolicy`.
- `CombatSystem.killIfDead`:
  Applies `effects.cleanseDebuffs !== false` and grants `effects.grantBuffId ?? 'tu_sinh_ngo'`.

- [ ] **Step 1: Write failing test in `CombatSystem.surviveLethal.test.ts`:**
  Add a test verifying that passing `grantBuffId: 'custom_phoenix_buff'` in `surviveEffects` applies `'custom_phoenix_buff'` instead of hardcoded `'tu_sinh_ngo'`.
- [ ] **Step 2: Run test to verify failure:**
  Run: `npx.cmd vitest run src/core/combat/CombatSystem.surviveLethal.test.ts`
  Confirm failure (hardcoded 'tu_sinh_ngo' was looked up instead of 'custom_phoenix_buff').
- [ ] **Step 3: Implement decoupling in `CombatSystem.ts`:**
  Define `SurviveEffectsPolicy` interface.
  In `killIfDead`:
  ```typescript
  const effects = surviveSession.surviveEffects
  if (effects) {
    if (effects.cleanseDebuffs !== false) {
      for (const buff of effects.buffSystem.getAll()) {
        if (buff.polarity === 'debuff' && buff.targetId === entity.id) {
          effects.buffSystem.remove(buff.id, buff.sourceId)
        }
      }
    }

    const grantId = effects.grantBuffId ?? 'tu_sinh_ngo'
    const buffDef = effects.registry.get(grantId)
    if (buffDef) {
      effects.buffSystem.apply(buffDef, entity, entity, effects.registry)
    }
  }
  ```
- [ ] **Step 4: Update `GameManagerTurnBattleOps.ts:209-213`:**
  Pass `{ buffSystem: ..., registry: TURN_BUFF_REGISTRY, grantBuffId: 'tu_sinh_ngo', cleanseDebuffs: true }`.
- [ ] **Step 5: Run tests to verify pass:**
  Run: `npx.cmd vitest run src/core/combat/CombatSystem.surviveLethal.test.ts`
  Confirm all tests pass.

---

### Task 3: Canonical `BuffTypes.ts` & `BuffPool.ts` (Consolidation)

**Files:**
- Modify: `game/src/core/buff/BuffTypes.ts`
- Modify: `game/src/core/buff/BuffPool.ts`
- Modify: `game/src/core/battle/turn/TurnBuffTypes.ts` (re-export alias)
- Modify: `game/src/core/battle/turn/TurnBuffPool.ts` (re-export alias)
- Test: `game/src/core/buff/BuffPool.test.ts`

**Interfaces:**
- `src/core/buff/BuffTypes.ts`:
  Canonical `BuffDefinition`, `Buff`, `BuffEffect`, `BuffPolarity`, `BuffStackMode`, `BuffRegistry`.
- `src/core/buff/BuffPool.ts`:
  Canonical `BuffPool` with `clearCcEffects()`, `removeInstance()`, `removeAllById()`, `getFromSource()`.
- `src/core/battle/turn/TurnBuffTypes.ts` & `TurnBuffPool.ts`:
  Clean re-export aliases pointing to `src/core/buff/`.

- [ ] **Step 1: Write test for `BuffPool.clearCcEffects` in `src/core/buff/BuffPool.test.ts`:**
  Test that `clearCcEffects()` removes all CC buffs while keeping other buffs.
- [ ] **Step 2: Run test to verify failure:**
  Run: `npx.cmd vitest run src/core/buff/BuffPool.test.ts`
  Confirm failure (`clearCcEffects is not a function` on old BuffPool).
- [ ] **Step 3: Update `BuffTypes.ts`:**
  Adopt the turn-native definitions from `TurnBuffTypes.ts`.
  Add optional `convertsAfterContinuousSeconds` on `BuffDefinition` for backwards compatibility.
- [ ] **Step 4: Update `BuffPool.ts`:**
  Adopt `TurnBuffPool` implementation (includes `clearCcEffects()`).
- [ ] **Step 5: Re-export aliases in `TurnBuffTypes.ts` and `TurnBuffPool.ts`:**
  ```typescript
  // src/core/battle/turn/TurnBuffTypes.ts
  export * from '../../buff/BuffTypes'
  export type TurnBuffDefinition = import('../../buff/BuffTypes').BuffDefinition
  export type TurnBuff = import('../../buff/BuffTypes').Buff
  export type TurnBuffRegistry = import('../../buff/BuffTypes').BuffRegistry
  export type TurnBuffPolarity = import('../../buff/BuffTypes').BuffPolarity
  export type TurnBuffStackMode = import('../../buff/BuffTypes').BuffStackMode
  export type TurnBuffEffect = import('../../buff/BuffTypes').BuffEffect
  export type TurnBuffEffectTemplate = import('../../buff/BuffTypes').BuffEffectTemplate
  ```
  ```typescript
  // src/core/battle/turn/TurnBuffPool.ts
  export { BuffPool as TurnBuffPool } from '../../buff/BuffPool'
  ```
- [ ] **Step 6: Run tests to verify pass:**
  Run: `npx.cmd vitest run src/core/buff/BuffPool.test.ts src/core/battle/turn/TurnBuffPool.test.ts`
  Confirm all tests pass.

---

### Task 4: Canonical `BuffSystem.ts` with Turn Core + `updateTime()`

**Files:**
- Modify: `game/src/core/buff/BuffSystem.ts`
- Modify: `game/src/core/battle/turn/TurnBuffSystem.ts` (re-export alias)
- Test: `game/src/core/buff/BuffSystem.test.ts`
- Test: `game/src/core/battle/turn/TurnBuffSystem.test.ts`

**Interfaces:**
- `BuffSystem`:
  - `apply(definition, source, target, registry?)`
  - `update(target, combatSystem, registry?, resolveSource?)`: turn-based update (primary).
  - `updateTime(deltaSeconds: number)`: decrements remaining duration for persistent out-of-battle buffs.
  - `getActiveModifiers(): StatModifier[]`
  - `rollOnHitEffects(source, target, registry)`
  - `rollReactiveTrigger(target, triggerEvent, registry)`
  - `isStunned()`, `isFrozen()`, `isRooted()`
  - `getStacks(id)`, `getAll()`, `getAllById(id)`, `remove(id, sourceId?)`, `removeAllById(id)`, `renewWithExtension()`

- [ ] **Step 1: Write test for `BuffSystem.updateTime` in `src/core/buff/BuffSystem.test.ts`:**
  Test that `updateTime(deltaSeconds)` decrements duration and removes expired persistent buffs outside of combat.
- [ ] **Step 2: Run test to verify failure:**
  Run: `npx.cmd vitest run src/core/buff/BuffSystem.test.ts`
- [ ] **Step 3: Update `BuffSystem.ts`:**
  Replace legacy implementation with the robust `TurnBuffSystem` implementation.
  Add `updateTime(deltaSeconds: number)`:
  ```typescript
  updateTime(deltaSeconds: number): void {
    const expired: Buff[] = []
    for (const buff of this.pool.getAll()) {
      buff.remainingTurns -= deltaSeconds
      if (buff.remainingTurns <= 0) {
        expired.push(buff)
      }
    }
    for (const buff of expired) {
      this.pool.removeInstance(buff.id, buff.sourceId)
    }
  }
  ```
- [ ] **Step 4: Update `GameManager.ts:2840`:**
  Call `this.buffSystem.updateTime(deltaSeconds)` instead of old `this.buffSystem.update(...)`.
- [ ] **Step 5: Re-export alias in `src/core/battle/turn/TurnBuffSystem.ts`:**
  `export { BuffSystem as TurnBuffSystem } from '../../buff/BuffSystem'`
- [ ] **Step 6: Run tests to verify pass:**
  Run: `npx.cmd vitest run src/core/buff/BuffSystem.test.ts src/core/battle/turn/TurnBuffSystem.test.ts`
  Confirm all tests pass.

---

### Task 5: Names & Registry Consolidation

**Files:**
- Create/Move: `game/src/core/buff/BuffNames.ts`
- Modify: `game/src/core/battle/turn/TurnBuffNames.ts` (re-export alias)
- Modify: `game/src/core/battle/turn/TurnBuffNames.test.ts`

**Interfaces:**
- `buffDisplayName(buffId: string): string` in `src/core/buff/BuffNames.ts`.
- Re-exported from `src/core/battle/turn/TurnBuffNames.ts`.

- [ ] **Step 1: Create `src/core/buff/BuffNames.ts`:**
  Move logic from `TurnBuffNames.ts` to `BuffNames.ts`.
- [ ] **Step 2: Update `TurnBuffNames.ts`:**
  `export { buffDisplayName } from '../../buff/BuffNames'`
- [ ] **Step 3: Run tests to verify pass:**
  Run: `npx.cmd vitest run src/core/battle/turn/TurnBuffNames.test.ts`
  Confirm all tests pass.

---

### Task 6: Deduplicate `TurnStatsRecompute.ts` & Compatibility Verification

**Files:**
- Modify: `game/src/core/battle/turn/TurnStatsRecompute.ts`
- Test: `game/src/core/battle/turn/TurnStatsRecompute.test.ts`

**Interfaces:**
- `recomputeEffectiveStats(resolvedBase, buffs)`:
  Calls `calculateEffectiveStats(resolvedBase, new BuffSystem(buffs).getActiveModifiers())`.
  Eliminates the duplicate `collectStatModifiers` function.

- [ ] **Step 1: Update `TurnStatsRecompute.ts`:**
  Use `new BuffSystem(buffs).getActiveModifiers()` directly.
  Delete local `collectStatModifiers` function.
- [ ] **Step 2: Run test to verify pass:**
  Run: `npx.cmd vitest run src/core/battle/turn/TurnStatsRecompute.test.ts`
  Confirm all tests pass.
- [ ] **Step 3: Run all buff and battle tests:**
  Run: `npx.cmd vitest run src/core/buff src/core/battle/turn src/core/combat src/core/game`
  Confirm all tests pass.

---

### Task 7: Full Verification, QA & Merge

- [ ] **Step 1: P3 Full verification:**
  Run: `npm.cmd run type-check` (in worktree `game/`)
  Run: `npm.cmd run build` (in worktree `game/`)
  Run: `npx.cmd vitest run` (full suite, all 419+ test files)
  Stop on first failure.
- [ ] **Step 2: E3 code-simplifier pass** over task diff.
- [ ] **Step 3: P5 code-review** (post-simplify), resolve findings ≥80 confidence.
- [ ] **Step 4: P4 adversarial QA quick:**
  Write `game/docs/qa/2026-09-08-r4-buff-foundation-quick.md` with full invariant ledger and P17 contract record.
- [ ] **Step 5: Commit & Merge:**
  Commit in worktree: `feat(r4): buff and status foundation closure — consolidate canonical BuffSystem (AR-19, AR-18)`
  Checkout master, merge `feat/r4-buff-foundation`.
  Verify merged master: `npm.cmd run type-check` + `npx.cmd vitest run`.
- [ ] **Step 6: Update roadmap:**
  Mark R4 COMPLETE with evidence; advance NEXT pointer to R5.
  Remove R4 worktree and branch.
