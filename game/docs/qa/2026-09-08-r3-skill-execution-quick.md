# R3 — Active Skill Execution Contract — QA Quick Report

Date: 2026-09-08
Worktree: E:/tutienidle/.agent-worktrees/r3-skill-execution
Branch: feat/r3-skill-execution
Mission: R3 (roadmap 0.6) based on Mission 0 findings AR-03 + AR-04 + AR-06 + relevant AR-18.
Spec: game/docs/superpowers/specs/2026-09-08-r3-active-skill-execution-contract-design.md
Plan: game/docs/superpowers/plans/2026-09-08-r3-active-skill-execution-contract.md

## P17 Contract Evidence

The maintained combat reference `docs/superpowers/specs/2026-09-07-turn-based-combat-reference.md` is absent (2026-09-08). The combat skill execution contract below was established from production consumers, authored skill data, and tests before modifying behavior:

- **Skill execution authority:** `TurnBattleSystem` sequences actions through `declareActorAction` → `applyActionImpact` → `completeAction`.
- **Targeting contract:** Skills declaring `target: 'self'` must target the caster (`affected = [actor]`, `targetScope: 'self'`) and never deal damage to opposing enemies. Non-damaging skills (pure buff / debuff) have `scaledDamage = null`.
- **Hit outcome authority:** `CombatSystem.resolveActionHit` is the authoritative owner of hit resolution. When `critical` is omitted, `CombatSystem` rolls critical hits based on `source.stats.criticalRate - target.stats.criticalAvoidance`.
- **Downstream outcome gating:** `DamageResult.dodged === true` must gate all on-hit effects: no `targetIds` inclusion, no on-hit procs, no reactive triggers, no ailment applications, and no consume-for-damage.
- **DoT source context:** DoT ticks must resolve the living source entity from the battle state, enabling elemental penetration (`getElementalPenetration`) and Mộc Tu poison recovery (`poisonRecoveryPercent`). Missing or dead sources return `undefined` and are handled gracefully.
- **Generic composite action:** Reaction Path special actions declare `compositePicks: { poolType: 'reaction_path', count: 2 }` instead of the generic engine checking hardcoded content IDs.
- **Strict converter:** `toTurnSkillDefinition` converts authored `Skill` definitions into executable `TurnSkillDefinition`. All 15 chain skills in current beta content are supported with exact semantics. Unsupported effect types throw an explicit `Error` instead of silently degrading to a physical ×1 attack.

## Changes Reviewed (12 files)

- Production:
  - `game/src/core/battle/turn/TurnSkillAction.ts` (`targetScope`, optional `damage`, `appliesAilments`, `healPercentOfDamage`, `compositePicks`).
  - `game/src/core/combat/CombatSystem.ts` (`resolveActionHit` critical roll fallback).
  - `game/src/core/battle/turn/TurnBattleSystem.ts` (self-buff declare/impact, dodge outcome gating, DoT `resolveSource`, generic composite action, extracted `applySkillAilments`).
  - `game/src/core/game/SkillToTurnSkillConverter.ts` (strict conversion, self-buffs, multiple debuffs, `add_stack` folding, leech healing, fail-explicitly guard).
  - `game/src/data/skill/TurnReactionPathSkills.ts` (`compositePicks` policy on `PHAP_TU_REACTION_SPECIAL`).
- Tests:
  - `TurnBattleSystem.hitResolution.qa.test.ts` (new, AR-04).
  - `TurnBattleSystem.dotSource.qa.test.ts` (new, AR-06).
  - `TurnBattleSystem.compositePicks.qa.test.ts` (new, AR-18).
  - `TurnBattleSystem.selfBuff.qa.test.ts` (new, AR-03).
  - `SkillInventoryParity.qa.test.ts` (new, inventory parity across all 15 beta chain skills).
  - `SkillToTurnSkillConverter.test.ts` (extended with 7 strictness tests).
  - `TurnReactionPathSkills.test.ts` (optional damage guard).

## Invariant Ledger (Quick Mode)

| ID | State / Owner | Action & Transition | Invariant | Attack Operator | Observable Oracle | Test Layer | Result |
|---|---|---|---|---|---|---|---|
| INV-R3-1 | Skill converter / `toTurnSkillDefinition` | Convert Water special (`thanh_tuyen_duong_linh`) | Semantic fidelity: pure self-buff must not fabricate physical damage | Authored skill with `target: 'self'`, `type: 'buff'` | `targetScope === 'self'`, `damage === undefined`, `appliesBuff.target === 'self'` | Unit | PASS |
| INV-R3-2 | Skill converter / `toTurnSkillDefinition` | Convert Earth special (`dia_tru_thua_thien`) | Semantic fidelity: pure self-buff must not fabricate physical damage | Authored skill with `target: 'self'`, `type: 'buff'` | `targetScope === 'self'`, `damage === undefined`, `appliesBuff.target === 'self'` | Unit | PASS |
| INV-R3-3 | Battle execution / `TurnBattleSystem` | Cast pure self-buff in battle | Non-interference: self-buff deals 0 damage to enemy, applies buff to caster | Full turn step execution | Enemy HP unchanged, 0 damage events, caster buffs has `dia_tru`, `targetIds` has caster | Integration | PASS |
| INV-R3-4 | Hit resolution / `CombatSystem` | Turn action with 100% crit rate | Critical authority: critical roll executes naturally in turn battles | `criticalRate: 1.0`, omit critical argument | `resolveActionHit` returns `critical: true`, damage event has `critical: true` | Integration | PASS |
| INV-R3-5 | Hit resolution / `TurnBattleSystem` | Attack dodged by 100% evasion target | Outcome gating: dodged attacks must not trigger on-hit side effects | Target dodges attack | Target not in `targetIds`, no ailments applied, no on-hit procs, no consume triggers | Integration | PASS |
| INV-R3-6 | DoT resolution / `TurnBattleSystem` | Enemy ticks wood DoT applied by player | Source context: DoT must supply living source to damage authority | Player has `poisonRecoveryPercent: 0.5` | Player heals for 50% of DoT damage dealt via leech | Integration | PASS |
| INV-R3-7 | DoT resolution / `TurnBattleSystem` | Source dies before DoT ticks | Graceful degradation: dead source must not crash battle tick | Source `alive: false`, `currentHp: 0` | Turn executes safely without throwing, DoT damages holder | Integration | PASS |
| INV-R3-8 | Composite action / `TurnBattleSystem` | Action with `compositePicks` policy | Generic policy: composite selection operates on declarative policy, not ID | Custom skill ID `custom_composite_skill_999` | 2 elemental picks executed from pool without hardcoded ID check | Integration | PASS |
| INV-R3-9 | Multiple ailments / `TurnBattleSystem` | Skill with multiple debuffs (`cau_mang_can_tri`) | Conservation: all authored debuffs applied on landed hit | Skill with `troi_chan` and `trung_doc` | Both buffs present on target, multiple stacks applied | Integration | PASS |
| INV-R3-10 | Leech healing / `TurnBattleSystem` | Wood ultimate (`doc_vien_bao_can`) hits enemy | Conservation: leech heals caster for authored percentage | `healPercentOfDamage: 0.4` | Caster heals 40% of damage dealt | Integration | PASS |
| INV-R3-11 | Beta inventory / `SkillInventoryParity` | Convert all 15 skills in 5 pure chains + specs | Completeness: 100% reachable skills convert with zero degradation | Enumerate all 15 skills × all specializations | All convert successfully, zero errors, correct scopes | Integration | PASS |
| INV-R3-12 | Error safety / `toTurnSkillDefinition` | Unsupported effect type passed | Explicit failure: invalid effects fail loudly | Synthetic skill with unknown effect type | Throws `Error(/Unsupported/)` | Unit | PASS |

## Verification Evidence

- P3 full:
  - `npm.cmd run type-check`: PASS (0 errors).
  - `npm.cmd run build`: PASS (0 errors).
  - `npx.cmd vitest run`: **419 files / 2886 tests PASS** (all green, 0 failures).
- P5 code review: PASS (pre-simplified with E3, 25 duplicated lines eliminated).
- P13 runtime wiring: no app-shell lifecycle or timer paths modified; 47 files in `src/core/battle/turn` pass.
- P14: deferred to main checkout per isolated-worktree exception.

## Verdict

**PASS WITH EVIDENCE**
