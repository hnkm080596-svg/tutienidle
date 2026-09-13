# QA Review: Combat repair chain R1-R5 re-audit

- Date: 2026-09-08
- Mode: deep (R5 materially changes runtime/presentation ownership; R4 changes buff lifecycle).
- Verdict: **FAIL**
- Code-review verdict: **Request changes**
- Reviewed HEAD: `3ef2aca5`; comparison base: `7dcdd0b2` (before R1).
- Worktree: `E:/tutienidle/.agent-worktrees/combat-r1-r5-reaudit`
- Branch: `codex/combat-r1-r5-reaudit`
- Outcome: **6 confirmed findings**, represented by **8 failing tests**; one explicit stale-token control passes. Three additional architectural closure gaps are static evidence, not separately confirmed gameplay defects.
- Production edits: none. No commit, merge, push, or deployment.

## Scope and Risk Map

Re-audited R1 vitals authority, R2 resolved/effective stat provenance, R3 active-skill semantics, R4 canonical buff lifecycle, and R5 runtime/presentation separation. Compared actual code and production consumers with maintained R2-R5 specs, R1 evidence, and Mission 0 findings. Relevant repair commits: `66af189e`, `0863e228`, `3c29f921`, `00a3c721`, `17300d3a`.

The risk mapper ran against the explicit changed paths below, not dirty files. It returned combat, economy/progression, inventory/equipment, Pinia/Phaser sync, time/offline, and UI/lifecycle, with `deepAuditCandidate: true`. Deep escalation was accepted. Save/cloud was loaded as an adjacent pack but no backend or persistence migration was audited.

Unmapped paths were inspected and manually routed: App wiring test to UI/lifecycle; ArtifactSystem test to combat; GameManagerTurnBattleOps, SkillInventoryParity, converter and its test, and TurnBattleAdapter to combat plus composition-root wiring; stat conversion test to stats/equipment; CombatAnimationSet to presentation. One-hop consumers included GameManager construction/ticks, passive event subscribers, real Reaction Path definitions/pool, survival session wiring, App auto-investment, scene ACK callbacks and mutable map users.

Excluded: main-checkout untracked R7 worker-allocation and R8.1 quest-lifecycle plans/specs, unrelated Mission 0 findings, visual asset redesign/R6, online services, and historical-save compatibility. Neither the main checkout nor the previous audit worktree was edited.

## Repair closure assessment

| Mission | Assessment | Evidence and limit |
| --- | --- | --- |
| R1 / AR-01 | Core repair present; no additional R1-only defect confirmed | Bonus damage routes through combat authority; Ward consumption and regen through vitals; existing regression suite passes. R4 cleanse ordering still undermines survival across multiple DoTs. |
| R2 / AR-02, AR-05 | No new defect found in reviewed paths | Resolved player input, normalized enemy input, effective-stat computation and speed refresh inspected; existing stat/speed regressions pass. This is bounded evidence, not proof for every modifier combination. |
| R3 / AR-03, AR-04, AR-06, AR-18 | Incomplete | Normal self-buff converter, crit/dodge gate and source resolver improved. Actual composite ailments and actual empowerment definition still violate maintained capability matrix. Content-ID fallback remains. |
| R4 / AR-19, AR-18 | Canonical implementation established; lifecycle and policy closure incomplete | Turn classes are aliases to canonical buff classes. Cleansed DoT can still kill the protected player; generic survival still supplies a talent-specific default. |
| R5 / AR-14, AR-20, AR-24, AR-29 | Incomplete, including a new event duplication regression | Constants/types moved downward. Explicit scene tokens improve safety, but undefined ACKs are accepted; gameplay attack now emits twice in presentation mode; auto-invest is still App-owned; mutable helper state is still exposed. |

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority / result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-01 | Combat/vitals | Apply bonus damage, Ward consume, regen | Consistent HP/alive/events | Lethal and resource boundary | Existing consumeDamage and surviveLethal regressions | Domain, baseline suite | High; existing repairs present |
| INV-02 | Stats and pacing | Production entity creation then buff recompute | Attribute derivation once; current speed drives gauge | Real factory inputs / cache refresh | Existing turnConversion, TurnStatsRecompute, effectiveSpeed tests plus consumers | Domain/integration | High; no new finding |
| INV-03 | Reaction composite | Execute actual special with real pool | Picked ailments survive composition | Production content instead of synthetic damage-only picks | Enemy buff pool nonempty | Domain integration | High; F3 confirmed |
| INV-04 | Reaction empowerment | Cast actual ultimate | Self buff leaves enemy HP unchanged | Production definition | Buff applies; enemy HP unchanged | Domain integration | Medium; F4 confirmed |
| INV-05 | Buff pool/survival | First DoT triggers cleanse before second DoT | Removed effects cannot execute; survival remains valid | Reentrant mutation / ordered DoTs | One damage event, empty debuff pool, alive at HP 1 | Domain integration | High; F2 confirmed |
| INV-06 | Gameplay event owner | Resolve same action headlessly and with runtime ACKs | One committed attack event in either mode | Presentation toggle | Event count 1 versus 1 | Runtime/domain integration | High; F1 confirmed (actual 1 versus 2) |
| INV-07 | Runtime pending phases | Omit token at ready/impact/complete | Missing identity cannot advance phase or damage | Omission / stale callback | Phase and HP unchanged | Runtime/domain integration | Medium; F5 confirmed at all three methods |
| INV-08 | Runtime generation | Reset, start new action, send old explicit token | Stale generation rejected | Reset / replay | New ready phase retained | Runtime/domain integration | Medium; control passes |
| INV-09 | Headless progression | Manager update with eligible player and essence | Domain tick auto-invests without App/Phaser | Remove presentation consumer | Progress 1, material 0 | Real GameManager integration | Medium; F6 confirmed |
| INV-10 | App/Phaser lifecycle | Start combat, finish, refight | Runtime actually advances; no orphaned driver | Real browser sequence | Fighting snapshots, terminal result, successful refight | Playwright | High; relevant E2E pass |
| INV-11 | Wave timing/presentation | Countdown to pending to live enemies | Runtime telegraph transitions advance | Real clock and browser | Progress max 0.9667, max pending 3, final pending 0 | Playwright + screenshots | High; runtime transition passes; visual conclusions bounded |
| INV-12 | Policy/helper boundaries | Inspect remaining consumers | One semantic/state owner | Search fallback IDs and writable map exposure | Source evidence | Static review | Medium; S1-S3 closure gaps |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npm.cmd run type-check` | Exit 0 | Before probes; rerun after all new tests also exit 0. |
| `npm.cmd run build` | Exit 0 | Vite build succeeds; existing large-chunk warning remains. |
| `npx.cmd vitest run --exclude '**/*.reaudit.test.ts' --reporter=dot` | Exit 0; 421 files / 2892 tests passed | Deliberately measures checked-in baseline separately from new failing audit probes; 110.82 seconds. No existing test was skipped or weakened. |
| Four new reproduction files, run together with `--reporter=verbose` | Exit 1; 4 files, 8 failed / 1 passed | Same intended failures independently reproduced; aggregate 2.85 seconds. Multiple soft assertions account for more assertion errors than failed test cases. |
| R5 runtime file independently twice | Exit 1; 4 failed / 1 passed both times | Visual path emits 2 attacks; all three omitted-token transitions accepted; explicit stale token rejected. |
| R5 refinement valid fixture twice | Exit 1; same two state assertions | An initial fixture omitted material registration and was corrected before defect classification. Registered real catalog; manual domain call succeeds as eligibility control. |
| R3 real-content file independently twice | Exit 1; 2 failed both times | Actual pool ailments missing; actual ultimate enemy HP 100000 to 99999. |
| R4 cleanse file independently twice | Exit 1; intended failures | Removed poison still damages, player dead at HP 0. |
| `DEV_PORT=5191 npm.cmd run test:e2e -- --reporter=line --workers=2 --output=docs/qa/2026-09-08-combat-r1-r5-e2e` | Exit 1; 15 passed / 1 failed, 2.0 minutes | Dev server Local URL read as `http://localhost:5191/`. Combat entry/result/refight, wave capture and three overlay viewports pass. Accessibility fails console-error assertion. |
| Accessibility spec alone, one rerun | Exit 1, same failure | `Failed to load resource: net::ERR_NETWORK_ACCESS_DENIED`; not labeled flaky and not attributed to R1-R5. |
| Browser image inspection | Bounded rendering evidence | Inspected desktop intro and combat frame. Intro text, player sprite, target controls and kill counter render. Frame does not prove all enemy sprites/VFX or ACK timing are correct. |

P3 full baseline commands ran in project order; new failing QA tests are intentionally retained. No production repair was attempted to make them green. The deep matrix additionally ran the existing E2E suite. Existing Vue/i18n fixture warnings and build chunk warnings are not new combat findings.

Logs (local, ignored by Git): `2026-09-08-combat-r1-r5-baseline.log`, `2026-09-08-combat-r1-r5-reproductions.log`, `2026-09-08-combat-r1-r5-e2e.log`, `2026-09-08-combat-r1-r5-e2e-retry.log` in this report directory. Intentional E2E screenshots/error contexts are under the corresponding QA output folders. The existing wave-capture test additionally writes `game/test-results/wave-vfx-frames/`; its runtime proof and screenshots were inspected.

## Findings

### F1 / QA-2026-09-08-RR1: Presentation mode emits two gameplay attacks per action

- Severity: High. Status: Confirmed. Confidence: 100.
- Owner: `game/src/core/battle/turn/TurnBattleSystem.ts:929` and `TurnActionPresentationEvents.ts:35`.
- Invariant: one committed action produces one authoritative event regardless of presentation.
- Preconditions/reproduction: real CombatAnimationRuntime + TurnBattleSystem + CombatSystem; resolve one identical basic attack headlessly, then through ready/impact/complete ACKs with valid token.
- Expected: one attack event in both executions.
- Actual: headless 1, presentation 2. Cast-start presentation still emits `attack`; R5 adds another at impact. This also re-enters CombatScene's attack handler and creates an extra presentation callback/lunge.
- Evidence/test: `game/src/core/battle/turn/CombatAnimationRuntime.r5.reaudit.test.ts:85`, repeated twice plus aggregate.
- Blast radius: every normal presented action; attack subscribers can process it twice. PassiveSystem consumes this event, but this audit does not claim a particular late-game passive loadout was exercised.
- Origin: new duplication introduced by R5 adding the domain emit without retiring the presentation emit.
- Repair direction: separate the visual cast-start signal from the single gameplay event, migrate every listener, and keep mode-parity regression coverage.

### F2 / QA-2026-09-08-RR2: A cleansed DoT still executes and kills a survivor

- Severity: High. Status: Confirmed. Confidence: 100.
- Owner: `game/src/core/buff/BuffSystem.ts:269-300`; survival cleanse at `CombatSystem.ts:508-511`.
- Invariant: removed effects cannot continue executing from an old iteration snapshot.
- Preconditions/reproduction: production `bong` and `trung_doc` on a player at HP 1 with an unused Bat Tu The survival guard; tick canonical BuffSystem once. First lethal DoT triggers the real cleanse.
- Expected: only first damage event, no debuffs remain, player alive at HP 1.
- Actual: debuff pool is empty, but damage events are `bong`, then `trung_doc`; player ends dead at HP 0.
- Evidence/test: `game/src/core/buff/BuffSystem.r4-cleanse.reaudit.test.ts`, same outcome twice and aggregate.
- Blast radius: cleanse/removal during buff iteration; survival with concurrent DoTs.
- Origin: retained from the former turn buff implementation, not newly created by consolidation; unresolved within R4 lifecycle closure.
- Repair direction: revalidate instance membership/lifecycle after callbacks or use an owner-controlled iteration contract that respects removals.

### F3 / QA-2026-09-08-RR3: Reaction composite drops the selected skills' ailments

- Severity: High. Status: Confirmed. Confidence: 100.
- Owner: `game/src/core/battle/turn/TurnBattleSystem.ts:936-954`.
- Invariant: composition preserves each picked action's supported on-hit/ailment semantics.
- Preconditions/reproduction: actual PHAP_TU_REACTION_SPECIAL, REACTION_PATH_POOL and registry, deterministic randomness, live enemy.
- Expected: selected elemental basics apply their authored ailments (R3 capability matrix: ailments from picks).
- Actual: composite resolves damage and target IDs only; target buff pool is empty.
- Evidence/test: first case in `game/src/core/battle/turn/TurnBattleSystem.r3Content.reaudit.test.ts`, repeated twice plus aggregate.
- Blast radius: Reaction Path special cannot supply the expected ailments for reaction behavior. Production pool is injected by GameManagerTurnBattleOps.
- Origin: retained execution defect within R3 completion scope.
- Repair direction: compose complete hit-resolution behavior, rather than a damage-only loop.

### F4 / QA-2026-09-08-RR4: Actual self-empowerment ultimate still damages an enemy

- Severity: Medium. Status: Confirmed. Confidence: 100.
- Owner: `game/src/data/skill/TurnReactionPathSkills.ts:45-52`; target selection in TurnBattleSystem.
- Invariant: self-buff action has self scope and no damage, per R3 maintained capability matrix.
- Preconditions/reproduction: execute actual PHAP_TU_REACTION_ULTIMATE with sufficient mana.
- Expected: source empowerment applies; opponent remains unchanged.
- Actual: empowerment applies but enemy HP falls from 100000 to 99999. Definition retains enemy-default scope and physical multiplier 0, which becomes damage through the minimum-hit floor.
- Evidence/test: second case in the R3 content test, repeated twice plus aggregate.
- Blast radius: unintended enemy hit and hit-side effects from a self buff.
- Origin: retained production content missed by migration, despite synthetic self-buff coverage.
- Repair direction: migrate the actual definition to the explicit self/no-damage contract and exercise real inventory entries.

### F5 / QA-2026-09-08-RR5: Missing ACK tokens still bypass generation validation

- Severity: Medium. Status: Confirmed. Confidence: 100.
- Owner: `game/src/core/battle/turn/CombatAnimationRuntime.ts:185-189`, `213-217`, `264-268`; manager methods also expose optional parameters.
- Invariant: R5 requires missing/null/mismatched tokens to be rejected at all three ACK boundaries.
- Preconditions/reproduction: place runtime in each pending phase using valid preceding calls; pass undefined to that phase's ACK.
- Expected: no phase transition or domain damage.
- Actual: ready becomes cast, impact changes enemy HP 100 to 97.27272727272727, completion clears pending state to idle.
- Evidence/test: three cases in the R5 runtime test; old explicit token control passes.
- Blast radius: unversioned callers can act on current pending state. Scene callbacks now capture tokens, so current normal scene risk is reduced; this is a still-open public boundary, not proof every scene callback is stale.
- Origin: pre-existing bypass retained; R5 only adds empty-string rejection.
- Repair direction: require identity at the public boundary, reject omission at runtime, and migrate tokenless callers/tests instead of preserving the bypass.

### F6 / QA-2026-09-08-RR6: Body-refinement auto-investment remains dependent on App's tick

- Severity: Medium. Status: Confirmed. Confidence: 100.
- Owner: `game/src/App.vue:303-309`, `game/src/core/game/GameManager.ts:1786`, manager update at line 2718.
- Invariant: maintained R5 design requires headless/domain auto-investment independent of App/Phaser.
- Preconditions/reproduction: real GameManager, registered production materials, active Qi Refining player with unlocked first tier, one essence; call manager.update(0.1).
- Expected: progress 1, material 0.
- Actual: progress 0, material 1; an explicit manager.investBodyRefinement(player) immediately succeeds, proving eligibility and operation are valid.
- Evidence/test: `game/src/core/game/GameManager.r5Refinement.reaudit.test.ts`; intended result repeated after fixing fixture registration.
- Blast radius: headless manager execution differs from App-driven execution. The live App no longer waits for particles, which is a real improvement; this is incomplete ownership migration rather than proof live auto-invest is broken.
- Origin: retained headless wiring gap; R5 moved the trigger within App rather than into domain/runtime orchestration.
- Repair direction: place auto-invest invocation in the intended domain update/reward sequence with exactly-once resource handling.

## Static architectural closure gaps (not extra confirmed gameplay defects)

- **S1 / AR-18:** CombatSystem still defaults `grantBuffId` to `tu_sinh_ngo` and cleanse to enabled, while production GameManagerTurnBattleOps omits these policy fields. R4 spec explicitly requires content configuration to own this policy. Adding optional fields without migrating production configuration does not remove the old authority.
- **S2 / AR-18:** TurnBattleSystem still ORs composite policy with literal `phap_tu_reaction_special` at lines 824-826. The compatibility check remains despite R3's content-agnostic completion claim.
- **S3 / AR-29:** Helpers now store maps, but expose writable Map getters and replacement setters; CombatScene directly deletes/clears through them at lines 1156, 1265-1266, 1352, 2098, 2217. This preserves external mutation rather than completing state/lifecycle encapsulation. No separate runtime crash was reproduced from this alone.

## Gaps and Residual Risk

- Converter loss of authored `attributeScaling` / `manaScalingRatio` remains Suspected: static inspection sees fields discarded, but no independent damage-scaling reproduction was added in this audit.
- The R3 maintained spec requests base-hit leech while the older SkillEffect contract describes leech from consumed-ailment bonus. Reported as contract drift requiring an intent decision; not counted as an implementation defect against the newer spec.
- Charge and every special/ultimate policy were not exhaustively enumerated. No claim that one green basic attack covers all action branches.
- R1/R2 no-new-finding assessments are bounded. Full suite success does not establish complete semantic parity.
- Visual inspection confirms the visible intro/player/chrome in captured frames; it does not establish full enemy/VFX correctness, smooth timing, or a soak guarantee. No visual-only bug is asserted from a single frame.
- No live backend, cloud, Electron, two-tab persistence, or long-session soak run; outside the repair-chain request.

## Pre-existing or Environment Failures

The accessibility E2E completed its journey but failed the console-error guard with `net::ERR_NETWORK_ACCESS_DENIED`; one isolated repeat failed identically. Resource URL/root cause was not captured, so attribution to a particular resource or commit is not established. This is recorded separately from the six combat findings; the overall E2E run is not green.

The baseline unit suite and build have no blocking failure. F2-F6 are retained repair-closure defects; F1 is the identified new R5 regression. The initial missing material registry in the new F6 fixture was a test setup error, corrected before using the evidence.

## New or Changed QA Tests

- `game/src/core/battle/turn/CombatAnimationRuntime.r5.reaudit.test.ts`: one mode-parity check, three missing-token checks, one stale-explicit-token control.
- `game/src/core/battle/turn/TurnBattleSystem.r3Content.reaudit.test.ts`: actual composite/pool and ultimate definitions through real turn execution.
- `game/src/core/buff/BuffSystem.r4-cleanse.reaudit.test.ts`: production DoTs, real survival guard and canonical mutation ordering.
- `game/src/core/game/GameManager.r5Refinement.reaudit.test.ts`: real catalog/manager/update with manual eligibility control.

All failing tests remain intact for repair. Existing tests, production, configuration and requirements were not altered. Learned-defect ledger receives only these six confirmed patterns. Supporting bounded sub-reports: `2026-09-08-r1-r4-reaudit-quick.md` and `2026-09-08-r2-r3-reaudit-quick.md`; this deep report owns the aggregate verdict.

## Notes / Suggestions

Reopen R3-R5 completion until these contracts are repaired and the new tests pass. Prioritize duplicate gameplay emission and cleanse iteration, then complete real-content migration and mandatory ACK/headless wiring. Keep the scope as these coherent responsibilities; no broad rewrite or unrelated R7/R8.1 change is needed. Add behavior-level parity to completion gates instead of treating source-shape assertions or synthetic content coverage as inventory parity.

## Task-owned Changed Paths Reviewed

- `game/src/App.vue`
- `game/src/App.wiring.test.ts`
- `game/src/core/artifact/ArtifactSystem.test.ts`
- `game/src/core/battle/CombatAnimationTypes.ts`
- `game/src/core/battle/turn/CombatAnimationRuntime.test.ts`
- `game/src/core/battle/turn/CombatAnimationRuntime.ts`
- `game/src/core/battle/turn/TurnActionPresentationEvents.ts`
- `game/src/core/battle/turn/TurnBattleConstants.ts`
- `game/src/core/battle/turn/TurnBattleSystem.attackEvent.qa.test.ts`
- `game/src/core/battle/turn/TurnBattleSystem.compositePicks.qa.test.ts`
- `game/src/core/battle/turn/TurnBattleSystem.consumeDamage.test.ts`
- `game/src/core/battle/turn/TurnBattleSystem.dotSource.qa.test.ts`
- `game/src/core/battle/turn/TurnBattleSystem.effectiveSpeed.test.ts`
- `game/src/core/battle/turn/TurnBattleSystem.hitResolution.qa.test.ts`
- `game/src/core/battle/turn/TurnBattleSystem.selfBuff.qa.test.ts`
- `game/src/core/battle/turn/TurnBattleSystem.slice3qa.test.ts`
- `game/src/core/battle/turn/TurnBattleSystem.slice4qa.test.ts`
- `game/src/core/battle/turn/TurnBattleSystem.ts`
- `game/src/core/battle/turn/TurnBuffNames.ts`
- `game/src/core/battle/turn/TurnBuffPool.ts`
- `game/src/core/battle/turn/TurnBuffSystem.ts`
- `game/src/core/battle/turn/TurnBuffTypes.ts`
- `game/src/core/battle/turn/TurnSkillAction.ts`
- `game/src/core/battle/turn/TurnStatsRecompute.test.ts`
- `game/src/core/battle/turn/TurnStatsRecompute.ts`
- `game/src/core/buff/Buff.ts`
- `game/src/core/buff/BuffDefinition.ts`
- `game/src/core/buff/BuffNames.ts`
- `game/src/core/buff/BuffPool.test.ts`
- `game/src/core/buff/BuffPool.ts`
- `game/src/core/buff/BuffSystem.test.ts`
- `game/src/core/buff/BuffSystem.ts`
- `game/src/core/buff/BuffTypes.ts`
- `game/src/core/combat/CombatSystem.surviveLethal.test.ts`
- `game/src/core/combat/CombatSystem.ts`
- `game/src/core/combat/EntityVitalsSystem.ts`
- `game/src/core/game/GameManager.ts`
- `game/src/core/game/GameManagerTurnBattleOps.ts`
- `game/src/core/game/SkillInventoryParity.qa.test.ts`
- `game/src/core/game/SkillToTurnSkillConverter.test.ts`
- `game/src/core/game/SkillToTurnSkillConverter.ts`
- `game/src/core/game/TurnBattleAdapter.ts`
- `game/src/core/stats/StatCalculator.ts`
- `game/src/core/stats/StatCalculator.turnConversion.test.ts`
- `game/src/data/buff/TurnBuffRegistry.ts`
- `game/src/data/skill/TurnReactionPathSkills.test.ts`
- `game/src/data/skill/TurnReactionPathSkills.ts`
- `game/src/game/scenes/CombatScene.ts`
- `game/src/game/scenes/combat/combat-cast-bar.ts`
- `game/src/game/scenes/combat/combat-helpers-encapsulation.qa.test.ts`
- `game/src/game/scenes/combat/combat-position-interpolation.ts`
- `game/src/game/support/CombatAnimationSet.ts`
