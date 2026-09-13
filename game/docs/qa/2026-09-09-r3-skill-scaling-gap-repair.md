# QA Review: R3 skill-scaling gap (AR-03) — repair

- Date: 2026-09-09
- Mode: quick (single confirmed finding, narrow repair, no new probing scope opened)
- Verdict: **PASS WITH EVIDENCE**
- Trigger: user-requested audit-driven check of the combat authority chain (Mission 0 audit, `game/docs/architecture/mission-0-architecture-audit-2026-09-08.md`), focused on the combat/vitals repair mission (R1/AR-01) and its chain (R1-R5, already merged per `2026-09-09-combat-r1-r5-repair-verification.md`).
- Production edits: `game/src/core/combat/DamageCalculator.ts`, `game/src/core/battle/ActionImpactSystem.ts`, `game/src/core/game/SkillToTurnSkillConverter.ts`, `game/src/core/combat/CombatSystem.ts`. New test: `game/src/core/combat/CombatSystem.skillScaling.test.ts`. Extended test: `game/src/core/game/SkillToTurnSkillConverter.test.ts`.

## Scope and finding

Re-verified the merged R1-R5 combat/vitals repair chain first: all four reaudit regression files (F1-F7/S1-S3) pass on current `master` (12/12 green), `type-check`/`build` clean. That chain is confirmed healthy — no regression, no action needed there.

While tracing the live damage path for AR-03 (skill-execution contract), found a **new, previously undetected defect** in the same chain, not covered by any existing reaudit: `SkillToTurnSkillConverter.toTurnSkillDefinition()` (the strict R3 converter, the only path from authored `Skill`/`SkillEffect` data into the actually-active `TurnBattleSystem`) mapped a damage effect's `.value` into `ActionDamageInfo.multiplier` but silently discarded `attributeScaling`, `manaScalingRatio`, and `swordIntentDamageRatio`. Separately, `CombatSystem.resolveActionHit()` — the sole authoritative hit-resolution entry point — never read `source.stats.skillDamagePercent` at all.

Both formulas exist and are correctly applied in `SkillEffectSystem.apply()`, but that class is a retired/parallel execution engine — `TurnBattleSystem.ts` never calls it (confirmed by search). Since the R3 "strict converter" contract (`§4.2`) only throws on unsupported *effect types*, these silently-dropped optional numeric fields never tripped that guard, and `SkillInventoryParity.qa.test.ts` (the R3 verification gate) only asserted that conversion *succeeds*, never that scaling fields survive it.

Real-content impact: every damage effect in the 5 Pháp Tu chains + specializations (mandated by `Skills.chain.test.ts` to carry `manaScalingRatio`/`attributeScaling`) and the 9 Kiếm Trận skills (`swordIntentDamageRatio`) had **zero effect from those fields** in actual combat. The `skillDamagePercent` stat (fed by equipment affixes, Kiếm Ý tier, and Kiếm Tu/Pháp Tu progression nodes) had **zero effect on any turn action, basic or skill**.

## Repair

- `DamageCalculator.ts`: new `DamageScalingConfig` type + `calculateScalingBonus()` — single shared formula (attribute max-per-entry, sword intent, mana ratio), read by `CombatSystem.resolveActionHit()` only (does not touch the retired `SkillEffectSystem`, out of scope for this repair).
- `ActionImpactSystem.ts`: `ActionDamageInfo` gains optional `scaling?: DamageScalingConfig`; `scaleActionDamage()` (used by sudden-death scaling and Reaction Path composite picks) now carries it through instead of reconstructing a bare object — otherwise those two call sites would have reintroduced the same silent-drop bug.
- `SkillToTurnSkillConverter.ts`: attaches `scaling` from the damage effect's authored fields when any are present; `undefined` when a skill authors none, so unaffected skills keep an identical `ActionDamageInfo` shape.
- `CombatSystem.ts`: `effectiveMultiplier` now folds in `(1 + calculateScalingBonus(source, damage.scaling)) * (1 + clampStatValue('skillDamagePercent', source.stats.skillDamagePercent))`, applied generically to all `resolveActionHit` calls (matches `EnemyStatInput.skillDamagePercent` existing on both sides).

## Verification Evidence

| Command | Result |
| --- | --- |
| New tests against pre-fix code (`git stash` the 4 production files) | 5 failed as expected (proves the bug and that the tests catch it) |
| Same tests after restoring the fix | `game/src/core/combat/CombatSystem.skillScaling.test.ts` (4/4) + `SkillToTurnSkillConverter.test.ts` (13/13) green |
| `npm run type-check` | Exit 0 |
| `npx vitest run` (full suite) | 434 files / 2947 tests passed, no regressions |
| `npm run build` | Exit 0, pre-existing large-chunk warning only |

## Gaps and Residual Risk

- `SkillEffectSystem`/`SkillActionRegistry` (the retired/parallel execution engines) were not touched — they already applied this formula correctly; this repair only closes the gap in the actually-active `TurnBattleSystem` path. Their continued existence as a second, unused execution model is AR-25 (R13, parked), not repaired here.
- `realmDamageRatio` and `skillExperienceRatio` (also present on `SkillEffect`) were **not** carried through — grep confirmed zero real-content usage of either field, so there is no live defect to fix; adding untested plumbing for them would be speculative.
- No new balance/content change: existing skill data already authors these scaling numbers (per `Skills.chain.test.ts`), so real damage output will now be *higher* than before for Pháp Tu/Kiếm Trận casts and for any build with `skillDamagePercent` sources — this is a correctness fix restoring authored intent, not a balance pass, and no rebalancing was performed.
