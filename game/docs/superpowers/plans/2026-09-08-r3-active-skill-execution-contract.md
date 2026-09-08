# R3 — Active Skill Execution Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (project convention: opencode has no subagent dispatch — Inline Execution, per P6). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish a sound active skill execution contract: support pure self-buffs without fake damage, preserve critical strikes and dodged hit gating, provide DoT source context, make composite actions generic, and enforce strict converter validation across all reachable beta skills.

**Architecture:** Extend `TurnSkillDefinition` with `targetScope`, optional `damage`, `appliesAilments`, `healPercentOfDamage`, and `compositePicks`; let `CombatSystem.resolveActionHit` own critical roll fallback; consume `DamageResult.dodged` to gate on-hit effects; pass `resolveSource` to `actorBuffSystem.update`; rewrite `SkillToTurnSkillConverter` to support self-buffs, multiple debuffs, and fail explicitly on unsupported effects.

**Tech Stack:** TypeScript + Vue 3 + Vitest (headless core engine).

**Spec:** `game/docs/superpowers/specs/2026-09-08-r3-active-skill-execution-contract-design.md`

## Global Constraints

- Follow Protection Rules (P1–P17) and Architecture Constitution (A1–A12).
- No TypeScript `any` (P8); code comments in English plain ASCII only (P15).
- Do not add new skills or rebalance authored values (spec §7).
- Fail explicitly on unsupported skill effect types; no silent fallback to physical ×1 attack.
- Verification per task: `npx vitest run <file>`; final verification: P3 full (`type-check` + `build` + `npx vitest run`).

---

### Task 1: Worktree Setup & Clean Baseline

**Files:** none (environment setup).

**Interfaces:**
- Consumes: master at HEAD (`376ebd9a`).
- Produces: isolated worktree `.agent-worktrees/r3-skill-execution` on branch `feat/r3-skill-execution` with valid `node_modules` junction and green baseline suite.

- [ ] **Step 1: Create worktree:**
  Run: `git worktree add ".agent-worktrees/r3-skill-execution" -b feat/r3-skill-execution`
  Run: `New-Item -ItemType Junction -Path ".agent-worktrees/r3-skill-execution/game/node_modules" -Target "E:\tutienidle\game\node_modules"`
- [ ] **Step 2: Verify clean baseline:**
  Run: `npm.cmd run type-check` (in worktree `game/`)
  Run: `npx.cmd vitest run src/core/battle/turn src/core/combat src/core/game/SkillToTurnSkillConverter.test.ts`
  Confirm all tests pass.

---

### Task 2: Critical Hit Authority & Dodged Outcome Gating (AR-04)

**Files:**
- Modify: `game/src/core/combat/CombatSystem.ts:144-150`
- Modify: `game/src/core/battle/turn/TurnBattleSystem.ts:880-970`
- Test: `game/src/core/battle/turn/TurnBattleSystem.hitResolution.qa.test.ts` (create)

**Interfaces:**
- `CombatSystem.resolveActionHit(source, target, damage, critical?)`:
  When `critical` is omitted/undefined, evaluates `isCritical = this.rollCritical(source, target)`.
- `TurnBattleSystem.applyActionImpact`:
  Captures `const hitResult = this.combat.resolveActionHit(...)`.
  If `hitResult.dodged`: does NOT add to `targetIds`; does NOT apply `rollOnHitEffects`, `rollReactiveTrigger`, `appliesAilment(s)`, or consume-for-damage.

- [ ] **Step 1: Write failing tests in `TurnBattleSystem.hitResolution.qa.test.ts`:**
  - Test 1 (Critical hit): Entity with `criticalRate: 1.0` vs target with `criticalAvoidance: 0` causes `resolveActionHit` and battle damage event to be `critical: true`.
  - Test 2 (Dodge outcome gating): Target with 100% evasion dodges the attack (`hitResult.dodged === true`); target is NOT added to `targetIds`; no ailment is applied to target buffs; on-hit proc effects do not trigger.
- [ ] **Step 2: Run test to verify failure:**
  Run: `npx.cmd vitest run src/core/battle/turn/TurnBattleSystem.hitResolution.qa.test.ts`
  Confirm failures (critical is false; dodged attack still applies ailments).
- [ ] **Step 3: Implement in `CombatSystem.ts`:**
  In `resolveActionHit`:
  Change `critical = false` to `critical?: boolean`.
  Assign `const isCritical = critical !== undefined ? critical : this.rollCritical(source, target)`.
  Use `isCritical` in `applyMultiplierAndCritical`, `DamageResult.critical`, and `resolveAttack`.
- [ ] **Step 4: Implement in `TurnBattleSystem.ts`:**
  In `applyActionImpact`, capture `hitResult = this.combat.resolveActionHit(...)` at all impact call sites.
  Gate downstream effects behind `if (!hitResult.dodged)`:
  - `targetIds.push(target.id)`
  - consume-for-damage blocks
  - on-hit proc effects & reactive trigger
  - appliesAilment
- [ ] **Step 5: Run tests to verify pass:**
  Run: `npx.cmd vitest run src/core/battle/turn/TurnBattleSystem.hitResolution.qa.test.ts`
  Confirm all tests pass.

---

### Task 3: DoT Source Context & Poison Recovery (AR-06)

**Files:**
- Modify: `game/src/core/battle/turn/TurnBattleSystem.ts:685-700`
- Test: `game/src/core/battle/turn/TurnBattleSystem.dotSource.qa.test.ts` (create)

**Interfaces:**
- `TurnBattleSystem.declareActorAction`:
  Passes `resolveSource: (sourceId: string) => CombatEntity | undefined` to `actorBuffSystem.update(actor.entity, this.combat, this.registry, resolveSource)`.
  Looks up `sourceId` in `battle.players` and `battle.enemies`.

- [ ] **Step 1: Write failing tests in `TurnBattleSystem.dotSource.qa.test.ts`:**
  - Test 1 (DoT source context): Player applies wood DoT to enemy. Player has `poisonRecoveryPercent: 0.5`. When enemy's turn ticks DoT and takes 20 damage, player heals 10 HP via `applyHealing` (reason 'leech').
  - Test 2 (Dead source): If source entity died before DoT ticks, DoT still damages the holder, but no crash occurs and no healing is attempted.
- [ ] **Step 2: Run test to verify failure:**
  Run: `npx.cmd vitest run src/core/battle/turn/TurnBattleSystem.dotSource.qa.test.ts`
  Confirm failure (player with poison recovery does not heal on enemy DoT tick).
- [ ] **Step 3: Implement in `TurnBattleSystem.ts`:**
  Construct `resolveSource` helper inside `declareActorAction`:
  ```typescript
  const resolveSource = (sourceId: string): CombatEntity | undefined => {
    const participant =
      battle.players.find((p) => p.id === sourceId) ??
      battle.enemies.find((e) => e.id === sourceId)
    return participant?.entity
  }
  actorBuffSystem.update(actor.entity, this.combat, this.registry, resolveSource)
  ```
- [ ] **Step 4: Run test to verify pass:**
  Run: `npx.cmd vitest run src/core/battle/turn/TurnBattleSystem.dotSource.qa.test.ts`
  Confirm all tests pass.

---

### Task 4: Generic Composite Skill Policy (AR-18)

**Files:**
- Modify: `game/src/core/battle/turn/TurnSkillAction.ts` (`compositePicks` field on `TurnSkillDefinition`)
- Modify: `game/src/data/skill/TurnReactionPathSkills.ts` (`PHAP_TU_REACTION_SPECIAL`)
- Modify: `game/src/core/battle/turn/TurnBattleSystem.ts` (remove hardcoded ID check)
- Test: `game/src/core/battle/turn/TurnBattleSystem.compositePicks.qa.test.ts` (create)

**Interfaces:**
- `TurnSkillDefinition.compositePicks?: { poolType: 'reaction_path'; count: number }`
- `TurnBattleSystem.declareActorAction`:
  Checks `action.skill?.compositePicks?.poolType === 'reaction_path'` instead of `action.skillId === REACTION_PATH_SPECIAL_ID`.

- [ ] **Step 1: Write test for composite action execution without named ID check:**
  Test that a custom skill with `compositePicks: { poolType: 'reaction_path', count: 2 }` and an arbitrary ID executes two elemental picks from the reaction pool.
- [ ] **Step 2: Run test to verify failure:**
  Run: `npx.cmd vitest run src/core/battle/turn/TurnBattleSystem.compositePicks.qa.test.ts`
- [ ] **Step 3: Add `compositePicks` to `TurnSkillDefinition` in `TurnSkillAction.ts`:**
  ```typescript
  compositePicks?: {
    poolType: 'reaction_path'
    count: number
  }
  ```
- [ ] **Step 4: Update `PHAP_TU_REACTION_SPECIAL` in `TurnReactionPathSkills.ts`:**
  Add `compositePicks: { poolType: 'reaction_path', count: 2 }`.
- [ ] **Step 5: Replace ID check in `TurnBattleSystem.ts`:**
  Remove `import { REACTION_PATH_SPECIAL_ID }`.
  Replace line 808 with `if (action.skill?.compositePicks?.poolType === 'reaction_path' && this.reactionPathPool)`.
  Replace line 811 with `else if (action.skill?.compositePicks)`.
  In `applyActionImpact`, replace `declared.isReactionPath` with `declared.isComposite`.
- [ ] **Step 6: Run tests to verify pass:**
  Run: `npx.cmd vitest run src/core/battle/turn/TurnBattleSystem.compositePicks.qa.test.ts src/core/battle/turn/TurnBattleSystem.reactionPathE2E.test.ts`
  Confirm all tests pass.

---

### Task 5: Target Scope & Pure Self-Buff Execution (AR-03 Part 1)

**Files:**
- Modify: `game/src/core/battle/turn/TurnSkillAction.ts` (`targetScope`, optional `damage`, `healPercentOfDamage`)
- Modify: `game/src/core/battle/turn/TurnBattleSystem.ts` (`declareActorAction` & `applyActionImpact` self targeting)
- Test: `game/src/core/battle/turn/TurnBattleSystem.selfBuff.qa.test.ts` (create)

**Interfaces:**
- `TurnSkillDefinition.targetScope?: 'enemy' | 'self'` (default `'enemy'`)
- `TurnSkillDefinition.damage?: ActionDamageInfo` (optional)
- `TurnSkillDefinition.healPercentOfDamage?: number` (optional)
- In `declareActorAction`:
  If `action.skill?.targetScope === 'self'`, sets `affected = [actor]` and `scaledDamage = null`.
- In `applyActionImpact`:
  `appliesBuff` runs independently of `declared.scaledDamage`.
  If `appliesBuff.target === 'self'`, applies to `actor.buffs` and ensures `actor.id` is in `targetIds`.
  If `action.skill?.healPercentOfDamage && hitResult.finalDamage > 0`, applies leech healing to `actor.entity`.

- [ ] **Step 1: Write failing tests in `TurnBattleSystem.selfBuff.qa.test.ts`:**
  - Test 1: Self-buff skill with `targetScope: 'self'`, no damage, and `appliesBuff: { definitionId: 'dia_tru', target: 'self' }`.
    When cast: enemy takes 0 damage; actor receives `dia_tru` buff in its pool; `targetIds` contains actor ID.
  - Test 2: Leech skill with `healPercentOfDamage: 0.4`. When dealing 100 damage to enemy, actor heals 40 HP with reason `'leech'`.
- [ ] **Step 2: Run test to verify failure:**
  Run: `npx.cmd vitest run src/core/battle/turn/TurnBattleSystem.selfBuff.qa.test.ts`
  Confirm failure.
- [ ] **Step 3: Update `TurnSkillAction.ts`:**
  Add `targetScope?: 'enemy' | 'self'` and `healPercentOfDamage?: number` to `TurnSkillDefinition`.
  Make `damage?: ActionDamageInfo` optional on `TurnSkillDefinition` and `SelectedAction`.
- [ ] **Step 4: Update `TurnBattleSystem.ts`:**
  In `declareActorAction`:
  ```typescript
  const targetScope = action.skill?.targetScope ?? 'enemy'
  if (targetScope === 'self') {
    affected = [actor]
    scaledDamage = null
  } else {
    // existing enemy targeting logic
  }
  ```
  In `applyActionImpact`:
  Decouple `appliesBuff` from `else if (declared.scaledDamage)`.
  Add leech healing after landed damage.
- [ ] **Step 5: Run tests to verify pass:**
  Run: `npx.cmd vitest run src/core/battle/turn/TurnBattleSystem.selfBuff.qa.test.ts`
  Confirm all tests pass.

---

### Task 6: Strict Converter & Reachable Skill Inventory (AR-03 Part 2)

**Files:**
- Modify: `game/src/core/game/SkillToTurnSkillConverter.ts`
- Modify: `game/src/core/battle/turn/TurnSkillAction.ts` (`appliesAilments`)
- Test: `game/src/core/game/SkillToTurnSkillConverter.test.ts`

**Interfaces:**
- `toTurnSkillDefinition(skill, effective)`:
  - If `skill.target === 'self'`, sets `targetScope: 'self'`, `targeting: { shape: 'single' }`.
  - Maps `type: 'buff'` to `appliesBuff`.
  - Collects all `type: 'debuff'` effects into `appliesAilments`.
  - Folds `type: 'add_stack'` into matching ailment's `stacks`.
  - Maps `healPercentOfDamage` from `damage` effect.
  - Throws explicit `Error` if `skill.target !== 'self'` and no `damage` effect, or on unsupported effect types.

- [ ] **Step 1: Write comprehensive tests in `SkillToTurnSkillConverter.test.ts`:**
  - Test pure self-buff conversion (`thanh_tuyen_duong_linh`, `dia_tru_thua_thien`): sets `targetScope: 'self'`, `appliesBuff`, `damage: undefined`.
  - Test specializations (`duong_linh_bang_giap` → `bang_giap` buff; `dia_tru_bich` → `dia_tru_bich` buff).
  - Test multiple debuffs (`cau_mang_can_tri` → both `troi_chan` and `trung_doc` in `appliesAilments`).
  - Test `add_stack` folding (`tam_muoi_tu_diem` → `bong` with 2 stacks).
  - Test `healPercentOfDamage` (`doc_vien_bao_can` → `healPercentOfDamage: 0.4`).
  - Test explicit error on invalid/unsupported effects.
- [ ] **Step 2: Run test to verify failure:**
  Run: `npx.cmd vitest run src/core/game/SkillToTurnSkillConverter.test.ts`
  Confirm failures.
- [ ] **Step 3: Implement strict converter logic in `SkillToTurnSkillConverter.ts`:**
  Support `isBuffEffect`, `isAddStackEffect`, multiple ailments array, self-targeting, and explicit validation error.
- [ ] **Step 4: Support multiple ailments in `TurnBattleSystem.applyActionImpact`:**
  Iterate over `action.skill.appliesAilments ?? (action.skill.appliesAilment ? [action.skill.appliesAilment] : [])`.
  Loop `stacks` count when applying to `TurnBuffSystem`.
- [ ] **Step 5: Run tests to verify pass:**
  Run: `npx.cmd vitest run src/core/game/SkillToTurnSkillConverter.test.ts`
  Confirm all tests pass.

---

### Task 7: Full Beta Content Inventory Characterization

**Files:**
- Test: `game/src/core/game/SkillInventoryParity.qa.test.ts` (create)

- [ ] **Step 1: Write inventory characterization test:**
  Enumerate all 15 skills in `CHAIN_SKILL_IDS` across all 5 elements, plus all specializations for each.
  Assert that `toTurnSkillDefinition(skill, effective)` succeeds for every single one.
  Assert expected semantic properties:
  - Water & Earth specials: `targetScope === 'self'`, `damage === undefined`, `appliesBuff !== undefined`.
  - Wood special: applies both `troi_chan` and `trung_doc`.
  - Wood ultimate: carries `healPercentOfDamage: 0.4` and `consumesAilmentId: 'trung_doc'`.
  - Fire special Tụ Diễm: carries 2 stacks of `bong`.
- [ ] **Step 2: Run test:**
  Run: `npx.cmd vitest run src/core/game/SkillInventoryParity.qa.test.ts`
  Confirm all 15 skills and their specializations pass with zero degradation.

---

### Task 8: Verification, Code Review, QA & Merge

- [ ] **Step 1: P3 Full verification:**
  Run: `npm.cmd run type-check` (in worktree `game/`)
  Run: `npm.cmd run build` (in worktree `game/`)
  Run: `npx.cmd vitest run` (full suite, all 414+ test files)
  Stop on first failure.
- [ ] **Step 2: E3 code-simplifier pass** over task diff.
- [ ] **Step 3: P5 code-review** (post-simplify), resolve findings ≥80 confidence.
- [ ] **Step 4: P4 adversarial QA quick:**
  Write `game/docs/qa/2026-09-08-r3-skill-execution-quick.md` with full invariant ledger and P17 contract record.
- [ ] **Step 5: Commit & Merge:**
  Commit in worktree: `feat(r3): active skill execution contract — self-buffs, critical hits, dodge gating, DoT source (AR-03, AR-04, AR-06, AR-18)`
  Checkout master, merge `feat/r3-skill-execution`.
  Verify merged master: `npm.cmd run type-check` + `npx.cmd vitest run`.
- [ ] **Step 6: Update roadmap:**
  Mark R3 COMPLETE with evidence; advance NEXT pointer to R4.
  Remove R3 worktree and branch.
