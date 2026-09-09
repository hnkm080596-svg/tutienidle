# QA Review: R1/R4 combat vitals and canonical buffs

- Date: 2026-09-08
- Mode: quick (bounded combat sub-audit within coordinator re-audit)
- Verdict: FAIL
- Worktree: E:/tutienidle/.agent-worktrees/combat-r1-r5-reaudit
- Branch: codex/combat-r1-r5-reaudit
- Reviewed HEAD: 3ef2aca5; comparison base: 7dcdd0b2
- Task-owned paths: game/src/core/buff/**; game/src/core/combat/CombatSystem.ts; game/src/core/combat/EntityVitalsSystem.ts; game/src/core/battle/turn/TurnBuff*.ts; game/src/core/battle/turn/TurnStatsRecompute.ts; R1 consumption/regen paths in TurnBattleSystem.ts; R4 GameManager persistent-buff tick.

## Scope and Risk Map

Manual routing: combat-and-tribulation domain, buff lifecycle -> survive-lethal cleanse -> damage/death and turn outcome. Read one-hop production registry and GameManagerTurnBattleOps session wiring. R2/R3/R5 and aggregate verification remain coordinator-owned. No production edits. Cross-system hypothesis is bounded to synchronous combat state; no save/reward/presentation behavior was changed or tested here.

## Invariant Ledger

| Requirement | Current owner/evidence | Attack | Expected | Observed | Status |
|---|---|---|---|---|---|
| Removed buffs cannot perform later effects | BuffSystem update + CombatSystem survive cleanse | Two active authored DoTs; first lethal tick cleanses both | Only first ticks; player remains alive at 1 HP | Both tick; player dies at 0 HP | Confirmed |
| Consumption damage completes death and survive intervention | CombatSystem.applyDirectDamage, existing R1 consumption tests | Inspect migrated call chain | Authority handles terminal outcome | Calls vitals then killIfDead | Static inspection only |
| Canonical modifiers retain stack multiplier | TurnStatsRecompute -> BuffSystem.getActiveModifiers | Inspect shared calculator input | Stacks and provenance supplied once | Correct fields passed to calculator | Static inspection only |
| Generic survive policy owns no content identity | CombatSystem.ts515 and GameManagerTurnBattleOps.ts202 | Inspect production policy | Composition supplies content ID | Optional ID falls back to tu_sinh_ngo; caller omits it | Suspected architectural closure gap |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
|---|---|---|
| npx.cmd vitest run src/core/buff/BuffSystem.r4-cleanse.reaudit.test.ts | FAIL, repeated | First run: removed trung_doc emits damage; second run also records alive=false, HP=0 |
| git show 7dcdd0b2:game/src/core/battle/turn/TurnBuffSystem.ts | Existing snapshot iteration found | Residual pre-existing defect carried into canonical owner, not a newly introduced regression |
| Full/typecheck/build | Coordinator-owned | Not run by this sub-audit |

## Findings

### R4-CLEANSE: Removed DoT still ticks after survive-lethal cleanse

- Severity: High; confidence: 100.
- Status: Confirmed residual defect.
- Invariant: Buff removal ends the instance's authority to deal further damage.
- Preconditions: Player has bat_tu_the, 1 HP, authored bong and trung_doc active.
- Reproduction: Apply both through canonical BuffSystem using TURN_BUFF_REGISTRY; wire real CombatSystem survive session with that pool; update once.
- Expected: bong consumes survival, both debuffs are removed, no trung_doc damage, alive at HP 1.
- Actual: debuff pool is empty but trung_doc still damages player; alive=false and HP=0.
- Evidence: BuffSystem.ts269 snapshots instances through BuffPool.getAll; CombatSystem.ts508-511 removes them during first tick; BuffSystem.ts285-300 continues using detached instances.
- Test file: game/src/core/buff/BuffSystem.r4-cleanse.reaudit.test.ts.
- Owner subsystem: canonical buff lifecycle.
- Blast radius: survival under multiple simultaneous ailments; analogous mid-iteration removals.

### R4-POLICY: Content fallback remains in generic combat

- Severity: Medium; confidence: 100 for static architecture observation.
- Status: Suspected architectural closure gap (no runtime defect asserted).
- CombatSystem.ts515 still uses effects.grantBuffId ?? 'tu_sinh_ngo'. GameManagerTurnBattleOps.ts202 supplies no grantBuffId. Thus production still relies on generic combat owning the content choice despite R4's decoupling claim.

## New or Changed QA Tests

Only game/src/core/buff/BuffSystem.r4-cleanse.reaudit.test.ts added. Real canonical pool, combat, guard, and authored buff registry; no mocks, casts, production hooks, or randomness dependency. Initial shell attempt used an incorrect nested game/game path and wrote nothing; corrected before obtaining evidence.

## Gaps and Residual Risk

No browser checks or full verification by this sub-agent; coordinator owns those. Duration/stack/expiry APIs and consumers were inspected, but exhaustive property testing was not performed. The two mutable remaining-time fields and optional source context remain design risks, not confirmed additional defects. R1 bonus final-modifier concern was discarded because the legacy skill owner explicitly documents already-mitigated cash-in semantics.

## Pre-existing Failures

R4-CLEANSE is pre-existing in the base turn buff implementation and survives consolidation; do not characterize it as a regression introduced by 00a3c721. No unrelated baseline tests were run here.
