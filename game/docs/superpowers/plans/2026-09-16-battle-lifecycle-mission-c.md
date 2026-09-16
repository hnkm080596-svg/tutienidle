# Mission C — Battle Lifecycle Constitution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development or executing-plans. Steps use checkbox syntax for tracking.

**Goal:** One authority owns the battle lifecycle; repeat cycles have a defined contract; combat RNG is unified; path integration goes through one interface.

**Architecture:** `beginBattleCycle(policy)` owns the full setup/reset list per policy (`fresh` | `stage` | `repeat` | `tribulation` | `test`). Repeat = FRESH BATTLE (locked decision). One session RNG reaches every combat roll. `CultivationPathRuntime` interface absorbs path-specific branching out of `GameManagerTurnBattleOps`.

**Tech Stack:** TypeScript, Vitest. No Vue/Phaser in `core/`.

**Spec:** `docs/specs/2026-09-16-audit-remediation-spec.md` Mission C. Audit: `docs/qa/2026-09-16-full-project-scout-audit.md` T5-41..44, T3-19, T3-22.

## Global Constraints

- Dev-stage rule; P8 no `any`; P15 English ASCII comments; A2/A5 (one rule/owner, orchestrators coordinate); A8 (no content-id branching in generic mechanisms); P17 — this mission changes combat contracts → update `docs/roadmap.md` combat-chain section in the same change.
- Worktree: `.agent-worktrees/battle-lifecycle` (branch `refactor/battle-lifecycle`).
- This is the heaviest mission — implementers must read the real call graph before editing. Each task names its read-first files.

---

### Task 1: `RepeatCarryPolicy` constant + reset inventory

**Files:**
- Create: `game/src/core/battle/BattleCyclePolicy.ts`
- Modify: `game/docs/roadmap.md` (combat-chain section — document fresh-battle repeat)
- Test: `game/src/core/battle/BattleCyclePolicy.test.ts`

- [ ] **Step 1: Read first** — `GameManagerTurnBattleOps.ts` (all `startBattle`/`startStage`/`restartTurnBattleCycle` paths), `GameManagerBattleRewardOps.ts` (repeat path). Enumerate every field each path resets today into the report — the inventory IS the deliverable's evidence.
- [ ] **Step 2: Failing test** — assert `REPEAT_CYCLE_POLICY` requires full reset of the enumerated fields (list them as keys; test asserts the policy object's coverage matches the canonical field list exported beside it).
- [ ] **Step 3: Implement** — `BattleCyclePolicy.ts` exports:

```ts
export const BATTLE_CYCLE_FIELDS = [
  'hp', 'mp', 'ward', 'buffs', 'debuffs', 'cooldowns', 'actionGauge',
  'surviveCharges', 'pathRuntime', 'procCounters', 'ccCounters',
  'dynamicBasic', 'currentThe', 'pendingReactions', 'lootState',
] as const
export type BattleCycleField = (typeof BATTLE_CYCLE_FIELDS)[number]
export interface BattleCyclePolicy { reset: ReadonlySet<BattleCycleField> }
// Locked decision: repeat = fresh battle — every field resets.
export const REPEAT_CYCLE_POLICY: BattleCyclePolicy = { reset: new Set(BATTLE_CYCLE_FIELDS) }
export const FRESH_BATTLE_POLICY = REPEAT_CYCLE_POLICY
```

Field list must be completed from the Step-1 inventory (the literal list above is the audit's enumeration — verify against code, add anything missing).
- [ ] **Step 4: PASS + type-check.** Update roadmap section.
- [ ] **Step 5: Commit** `feat(battle): codify fresh-battle repeat policy`

---

### Task 2: `beginBattleCycle(policy)` owner

**Files:**
- Modify: `game/src/core/game/GameManagerTurnBattleOps.ts`, `game/src/core/game/GameManagerBattleRewardOps.ts`; possibly create `game/src/core/battle/BattleCycleRunner.ts`
- Test: extend the turn-battle ops tests — each entry path test asserts identical reset coverage.

- [ ] **Step 1: Read first** — all four entry paths (`startBattle`, `startBattleWithPlayer`, `startStage`, `restartTurnBattleCycle`) and what each resets today (Task-1 inventory).
- [ ] **Step 2: Failing test** — entering a repeat cycle leaves no field at its previous-battle value (assert on the enumerated fields, e.g. survive charges refreshed, `currentThe` reset).
- [ ] **Step 3: Implement** — a single `beginBattleCycle(policy)` that performs the complete reset list; entry paths become `validate → beginBattleCycle(policy) → setup`. No path keeps its own partial reset list.
- [ ] **Step 4: PASS + full `npx vitest run src/core/battle src/core/game`.**
- [ ] **Step 5: Commit** `refactor(battle): single battle-cycle lifecycle owner`

---

### Task 3: Unified combat RNG

**Files:**
- Modify: `game/src/core/battle/turn/TurnBattleSystem.ts` (thread injected RNG), hit/block/crit/ignore-resist call sites, enemy placement (`StageWaveSystem` or wherever `Math.random` enters orchestration)
- Test: seeded-RNG determinism test — same seed + same script → identical battle log.

- [ ] **Step 1: Read first** — grep `Math.random` under `src/core/battle` and `src/core/game`; list every combat-relevant call site in the report.
- [ ] **Step 2: Failing test** — inject a seeded PRNG; run the same scripted battle twice; assert identical outcomes/log.
- [ ] **Step 3: Implement** — single `RngSource` per battle session; all combat rolls consume it. Visual-only randomness in `src/game` is out of scope.
- [ ] **Step 4: PASS.**
- [ ] **Step 5: Commit** `refactor(combat): unify battle RNG under one session authority`

---

### Task 4: `CultivationPathRuntime` boundary

**Files:**
- Create: `game/src/core/player/CultivationPathRuntime.ts` (interface + registry)
- Modify: `game/src/core/game/GameManagerTurnBattleOps.ts` (remove path branches → interface calls)
- Test: interface contract tests per path (kiem_tu, phap_tu, the_tu, mortal/an variants).

- [ ] **Step 1: Read first** — participant-build code in `GameManagerTurnBattleOps.ts` (kiem_tu mode branch ~line 936+, route providers, special/ultimate markers, survive sources).
- [ ] **Step 2: Failing test** — a new fake path implementing the interface plugs into battle setup without touching `GameManagerTurnBattleOps`.
- [ ] **Step 3: Implement** — interface surface: `basicProvider`, `special`, `ultimate`, `battleStartBuffs`, `resetHooks`, `surviveSources`. Each path module provides an implementation; orchestration only speaks the interface (A8: no `if path === 'kiem_tu'` in orchestration).
- [ ] **Step 4: PASS + type-check.**
- [ ] **Step 5: Commit** `refactor(battle): route path integration through CultivationPathRuntime`

---

### Task 5: Skill-semantic correctness fixes

**Files:**
- Modify: `game/src/data/skill/PhapTuEmpoweredUlts.ts` (`thanh_luy` target), `game/src/data/buff/ThuanHeBuffs.ts` (`thach_hoa` proc owner), `game/src/core/battle/turn/TurnBattleSystem.ts` or converter (`elementApplicationPercent` application, `ailmentStackBonus` default stacks=1), `game/src/core/game/SkillToTurnSkillConverter.ts` (extend unsupported-field lists: `scope`, `refresh`)
- Test: one failing content test per bug.

- [ ] **Step 1: Failing tests:**
  - `thanh_luy` ult → buff lands on caster, not enemy.
  - `thach_hoa` debuff on enemy → enemy does NOT gain a stun proc vs player.
  - skill with `elementApplicationPercent` bonus → application chance actually raised in turn combat.
  - `ailmentStackBonus` with omitted `stacks` → treated as 1 stack.
  - authored skill with `scope`/`refresh` fields → converter reports it as unsupported (not silently dropped).
- [ ] **Step 2: FAIL each.**
- [ ] **Step 3: Implement** the five fixes; each minimal and content/data-side where the bug is data (`thanh_luy`, `thach_hoa`), engine-side where it's semantics.
- [ ] **Step 4: PASS + `npx vitest run src/core/skill src/core/battle src/data`.**
- [ ] **Step 5: Commit** `fix(skill): correct empowered-ult target, debuff proc owner, application stats`

---

## Mission C done-criteria

- Repeat cycles provably reset every battle-scoped field (fresh-battle contract in code + roadmap).
- One lifecycle owner; entry paths delegate.
- Seeded combat is deterministic.
- No path-id branches in battle orchestration.
- Five skill/buff semantics corrected with regression tests.
- `npm run type-check` + `npx vitest run src/core` green; P4 deep QA on combat chain; P5 code-review; roadmap updated.
