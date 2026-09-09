# R2/R3 focused re-audit

- Date: 2026-09-08
- Mode: quick; bounded domain sub-audit of coordinator's larger review.
- Verdict: FAIL
- Worktree: `E:/tutienidle/.agent-worktrees/combat-r1-r5-reaudit`
- Branch: `codex/combat-r1-r5-reaudit`
- Reviewed HEAD: `3ef2aca5`; base: `7dcdd0b2`; primary commits: `0863e228`, `3c29f921`.
- Task-owned production scope: `StatCalculator.ts`, `TurnStatsRecompute.ts`, `TurnBattleAdapter.ts`, `SkillToTurnSkillConverter.ts`, `TurnSkillAction.ts`, `TurnBattleSystem.ts`, `CombatSystem.ts`, `TurnReactionPathSkills.ts`, and their production consumers/tests.

## Scope and risk

Read the maintained R2 and R3 design specifications, actual skill data, effective-skill resolution, player/enemy stat construction, turn adapter, hit resolver, composite execution, and DoT source resolver. Combat domain routing is bounded to stat and action contracts; no persistence, economy, or UI edits. Other agents' R1/R4/R5 files are excluded. Coordinator owns aggregate/full verification and report.

## Invariant ledger

| ID | State/owner | Action/transition | Invariant | Attack | Oracle | Layer | Result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R2-1 | Resolved entity stats | Construct then recompute | Derive attributes once | Trace actual factories | Player receives resolved snapshot; normalized enemies have zero raw attributes; effective pipeline does not derive | Static + existing tests delegated to full run | No new defect found |
| R2-2 | Effective speed/cache | Recompute then pace | Cache follows effective speed | Inspect both pacing paths | Recompute and pacing copy entity speed | Static | No new defect found; no independent runtime claim |
| R3-1 | Composite skill | Execute actual special/pool | Pick effects survive composition | Replace synthetic pool with production pool | Target gets authored ailment | Domain integration | Confirmed failure twice |
| R3-2 | Self empowerment | Execute actual ultimate | Self buff deals no enemy damage | Use production definition | Enemy HP unchanged, source buff applied | Domain integration | Confirmed failure twice |
| R3-3 | Hit authority | Hit/dodge/critical | Downstream normal-hit effects gated | Inspect result handling | Normal branch honors dodge and rolls critical | Static | No new normal-branch defect found |
| R3-4 | DoT source context | Tick sourced DoT | Preserve source collaborator | Trace resolver/update | Source entity supplied | Static | Dead-source resolver returns dead entity, contradicting prose; not reproduced |
| R3-5 | Converter | Convert real chain damage | Preserve or reject authored semantics | Inspect scaling fields | Attribute/mana scaling absent from output | Static | Suspected; no failing runtime probe |

## Confirmed findings

### R3-C1: Reaction special drops picked ailments

- Severity: High; confidence 100.
- Owner: `game/src/core/battle/turn/TurnBattleSystem.ts:936-954`.
- Preconditions: actual `PHAP_TU_REACTION_SPECIAL` and `REACTION_PATH_POOL`, real buff registry, deterministic random 0.1, live enemy.
- Expected: selected elemental basics apply their authored ailments, permitting the reaction path's defining reaction behavior. R3 maintained design section 3 explicitly lists ailments "From picks".
- Actual: target buff pool remains empty after the special. Composite branch resolves damage and IDs only; it never calls ailment/reaction or on-hit processing.
- Production reachability: `GameManager.ts:2278` selects Reaction Path skills; `GameManagerTurnBattleOps.ts:400,479` supplies the real pool. `TurnBasicAttacks.ts:35-39` authors ailments for every pool entry.
- Reproduction: first test in `game/src/core/battle/turn/TurnBattleSystem.r3Content.reaudit.test.ts`; expected positive buff count, received 0, twice.
- Classification: unresolved defect within R3 completion scope; not claiming this began in the R3 commit.

### R3-C2: Actual reaction empowerment still attacks the enemy

- Severity: Medium; confidence 100.
- Owner: `game/src/data/skill/TurnReactionPathSkills.ts:49-56` and consumer `TurnBattleSystem.ts:804-819`.
- Expected: actual ultimate is a self buff with no damage, per R3 maintained capability matrix.
- Actual: source receives empowerment but enemy HP changes 100000 to 99999. Definition lacks `targetScope: 'self'` and retains physical multiplier 0; damage floor turns placeholder into a real hit.
- Reproduction: second test in the same file; buff application assertion passes, unchanged-HP assertion fails identically twice.
- Blast radius: unwanted damage and normal hit-side effects on a self-buff cast.
- Classification: retained real-content defect, not a newly introduced-data regression.

## Suspected and contract drift

- `TurnBattleSystem.ts:824-826` still branches on literal `phap_tu_reaction_special`, directly conflicting with AR-18 completion claim. Static evidence only; no separate behavioral repro.
- `SkillToTurnSkillConverter.ts:36-47` drops authored `manaScalingRatio` and `attributeScaling` present throughout the beta chains. `SkillSystem.getEffectiveSkill()` scales level only. Existing inventory tests merely validate conversion shape and cannot prove these semantics. No added runtime repro; do not label Confirmed.
- New base-hit leech matches the maintained R3 implementation specification, but conflicts with the older `SkillEffect.healPercentOfDamage` contract and `SkillEffectSystem.ts:232-233`, which heal from consumed-ailment bonus. This is specification drift requiring an intent decision, not an independently confirmed R3 implementation defect.

## Verification evidence

`npx.cmd vitest run src/core/battle/turn/TurnBattleSystem.r3Content.reaudit.test.ts` from worktree `game/` ran twice: both executions failed the same two intended assertions (2 tests, 2 failures). No tooling/setup failure. First duration 2.24s; repeat 639ms. Full type-check/build/suite are coordinator-owned and not repeated here.

## Files changed / limitations

Only this report and `game/src/core/battle/turn/TurnBattleSystem.r3Content.reaudit.test.ts` were added. No production code changed. No browser inspection; these findings are headless gameplay contracts. R2 conclusions are bounded static inspection, with existing focused tests covered by coordinator verification. No claim of exhaustive semantic parity. Synthetic entity tuning establishes deterministic execution, while enemy construction, adapter, skill definitions, pool, and registry are production objects.

## Notes / suggestions

Inventory parity should exercise actual selected content through turn execution, including downstream effects, rather than assert conversion succeeds or substitute zero-effect synthetic skills.
