# QA Review: the-tu-an-ung-the (Ung The redesign of hidden_body_pathway)

- Date: 2026-09-25
- Mode: quick
- Verdict: PASS WITH GAPS
- Task-owned paths: `src/core/battle/turn/{TurnBattleSystem,TurnSkillPlanRuntime}.ts`, `src/core/proc/{CombatProcSystem,ProcCapabilities}.ts`, `src/core/the-tu/{TheEconomy,TheTuAnMechanicModifiers,TheTuCapabilities,TheTuPath}.ts`, `src/data/{skill/TheTuSkills,buff/TheTuBuffs,progression/{TheTuAnNodes,SkillCoreNodes},skill/TurnSkillDisplayMeta}.ts`, `src/core/player/CultivationPathRegistry.ts`, `src/game/scenes/{CombatScene,combat/PlayerHudLayer}.ts`, `src/presentation/bridges/theBarBridge.ts`, `src/services/save/saveVersion.ts`, `docs/specs/the-tu-an-ung-the-spec.md`, plus the task-owned test files.

## Scope and Risk Map

Changed systems: turn-battle reaction windows (Phan/Ho/Tro), The economy (observation-only income), Ung Tre/Qua The tempo debt, Tham An focus, Quan The universal observation, the-tu-an node tree (beta scope LQ->TC), kit construction, save version (85->86), HUD The bar + auto-combat reactive automation. One-hop consumers inspected: CombatProcSystem reactive lanes (affordability-gate ordering), TurnSkillPlanRuntime orchestration contract (recordHitOutcome hook swap), save-shape validation (nodeLevels/core-* round-trip). Mapper flagged `deepAuditCandidate: true` (save boundary + 4 domains) — bounded here: the save change is a version bump that rejects v85 saves outright (dev-phase, no migration to audit); the remaining domains (combat/progression/UI) are covered by the quick packs below.

## Invariant Ledger (Part XX contract)

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-10 income ordering | resolvePostActionWindows tail | Phan -> Tro -> income, same call | income never funds same-action reactions | reorder | the.observed.* op emitted after window attempts settle | unit (theEconomy) | high — verified |
| Tham on miss | applyThamMark pre-hit | mark set before hit resolution | observation != damage | miss branch | thamTargetId set with dodged hit | unit (theEconomy/troFollowUp) | high — verified |
| One-target focus | thamTargetId overwrite + lazy-clear | recast transfers; death clears w/o transfer | single live mark | value mutation + death | isObserved re-reads mark liveness each window | unit | high — verified |
| Forced success | resolvePhanWindow | no decline path on valid window | commit is automatic | rng pinned | attempt recorded, queuedFollowUps pushed | unit (troFollowUp/hoIntercept) | high — verified |
| Ung Tre delay + Qua The cap | commitReaction / isQuaThe | +1 debt + actionGauge -=400 per success; cap 3 blocks windows | uniform debt, no rollback | repeat | gauge drops per commit; 4th window never rolls | unit (theEconomy) | high — verified |
| Debt reset | resolveNextStep natural declare | reactionDebt = 0 on natural action only | queued entries don't reset | order | reactive bypass path returns before reset | static + unit | high — verified |
| No-RNG on invalid window | CombatProcSystem affordability gate | cost check before rollChance | determinism | rng spy | attempts[{paid:false}], rng untouched | unit (theEconomy) | high — verified |
| Commit no-rollback | commitReaction mutations | debt/gauge never restored post-commit | monotonicity | focus loss mid-window | commit survives quan_the expiry/death | static reasoning | medium — verified |
| Dead actor payload drop | dequeueFollowUpActor | !queued.entity.alive -> skip w/o chain-depth | dead cannot receive payload | lethal intercept | queue drains, no counter emitted | unit (midImpactDeath) | high — verified |
| Once-per-channel-per-action | seen-set + hitOutcomeScratch + Ho once:true | one roll per reactor per action | exactly-once | multi-hit composite | 1 counter from 2-hit composite | unit (compositePicks.qa, rewritten) | high — verified |
| Ho substitution + lethal | resolveInterceptWindow | declared.affected=[protector]; full resolve vs protector | substitution is real, no HP safety | lethal roll | protector takes full hit incl. dodge/ward/ailments | unit (hoIntercept) | high — verified |
| Ho Bich ward | grantsWardToOriginalTarget | apply_buff marker + writeExternalWardGrant at commit | ward survives protector death | lethal commit | ally ward pool reconciled post-death | unit (hoIntercept) | high — verified |
| Tro canonical target | resolveAllyActionWindow | first landed->affected candidate alive+observed | canonical = action's real target | ordering | triggeringTargets[0] = landed target | unit (troFollowUp) | high — verified |
| Dan The consume | grantObservationIncome (b) | income x3 then remove_buff consumed | one-shot, dies with target | repeat | dan_the.consume op after first boosted yield | unit (troFollowUp) | high — verified |
| Hard-CC block | isHardCcBlocked + ccBlocked income gate | stun/freeze blocks windows AND observed income | incapacitation seals the turn | stun applied | zero the.observed.* ops on ccBlocked declare | unit (theEconomy, mutation-verified) | high — verified |
| Success-only cost | CombatProcSystem reorder | roll -> consume -> queue | failures cost nothing | failed roll | currentThe unchanged on miss | unit | high — verified |
| Save round-trip | saveVersion 85->86 | v85 rejected; nodeLevels persist | recoverability | restore | nodeLevels round-trips, forged techniqueProgress rejected | unit (save tests) | high — verified |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npm run type-check` (vue-tsc) | clean | full project |
| `npx vitest run src/core/{battle/turn,the-tu,proc,game,data,progression,player,save}` | 270 files / 2183 tests green (+4 expected-fail) | covers full task surface + one-hop consumers |
| `npx eslint` (37 changed files) | 0 errors, 34 warnings | warnings pre-existing unused-var in PlayerHudLayer/CombatScene fixtures |
| Mutation check: ccBlocked income gate removed | theEconomy 'hard-CC-blocked observed enemy' test fails | gate proven load-bearing |
| compositePicks.qa rewrite (2-hit -> 1 window) | green under new once-per-action semantic | supersedes pre-fix per-hit contract |

## Findings

No Confirmed defect remains after the sequential passes below.

### QA-2026-09-25-U1: Tham mark plants on the post-substitution target when a hypothetical intercept fires on an ung_the basic
- Severity: Nit
- Status: Suspected -> rejected as defect (unreachable in beta)
- Evidence: `applyThamMark` runs after `resolveInterceptWindow`, so `declared.affected[0]` is the protector post-substitution. Unreachable: Ho requires enemy actor + player-side target and candidate reactors are player-side; players' basics are never intercepted in beta. Recorded for future Ho symmetry work.
- Owner subsystem: turn-battle
- Blast radius: none in beta scope

### QA-2026-09-25-U2: Enemy-side ung_the reactors can carry quan_the/phan_mon and react
- Severity: Low
- Status: Suspected -> accepted (design-neutral)
- Evidence: isObserved/resolvePhanWindow are side-agnostic — an enemy with quan_the observes all players and Phan's on its attackers. Design restricts ung_the ownership to the player in beta content; the engine doesn't need a side gate. compositePicks.qa exploits this to exercise the window symmetrically.
- Owner subsystem: turn-battle
- Blast radius: none — no enemy ung_the content exists

### QA-2026-09-25-U3: HUD/auto-combat reactive presentation not browser-verified
- Severity: Low
- Status: Coverage gap
- Evidence: theBarBridge/PlayerHudLayer/CombatScene changes verified by type-check + unit pins only; no Playwright pass this session
- Owner subsystem: presentation
- Blast radius: display only; combat correctness unaffected

### QA-2026-09-25-U4: TurnBattleSystem.ts implementation was rebuilt once in-session after an accidental `git checkout` reverted uncommitted work
- Severity: process note (not a defect)
- Evidence: file reconstructed from HEAD + verbatim captured reads + intact TurnSkillPlanRuntime orchestration contract; verification re-run post-rebuild (type-check clean, 2183 tests green). Two stale-contract tests migrated (compositePicks once-per-action; deadIds allowlist + major_quan_the).
- Blast radius: none — the executable spec (44+ test files incl. invariant pins) all passes on the rebuilt state

## New or Changed QA Tests

- `TurnBattleSystem.theEconomy.test.ts` — new hard-CC income-gate regression test (mutation-verified load-bearing).
- `TurnBattleSystem.compositePicks.qa.test.ts` — rewritten to once-per-action window semantic + observation gate.
- `GameManager.deadIds.test.ts` — TECHNIQUE_UNLOCK_ALLOWLIST extended for `major_quan_the` (the mission's Truc Co unlock major, same gate pattern as siblings).
- Invariant pins landed pre-rebuild and re-verified: mark-on-miss, focus death no-transfer, forced success, debt cap/reset, no-RNG invalid window, dead-actor drop, Ho substitution/ward/lethal, Tro canonical + Dan The consume, save round-trip.

## Sequential Review Pass 1 — Local Correctness / Regression
- Reviewed state: post-rebuild TurnBattleSystem.ts + task diff (the file was reconstructed; every method re-verified against the captured contract)
- Findings: (a) two tests asserted superseded per-hit window semantics (compositePicks) and stale allowlist (deadIds) — test defects, not production; (b) ccBlocked income leak — stunned enemy still yielded observed income pre-gate.
- Fixes: compositePicks rewritten to once-per-action + observation; deadIds allowlist extended; `declared.ccBlocked` gate added to grantObservationIncome (earlier pass).
- Verification: type-check clean; scoped vitest 2183 green; the ccBlocked test mutation-verified.

## Sequential Review Pass 2 — Architecture / Authority / Ownership
- Reviewed state after Pass 1 fixes: YES
- Findings: (a) observation predicate (isObserved), debt commit (commitReaction), scratch (hitOutcomeScratch), windows (resolvePhan/Ho/Tro) all live on TurnBattleSystem as the single authority — consistent with the orchestration contract's removal of grantHitOutcomeIncome/resolveTakenWindow/resolveEvadeWindow hooks; (b) proc cost stays inside CombatProcSystem's affordability gate — TBS never rolls or pays directly; (c) reactivePayloads participant clone = sole payload source (bach_ung rider removed cleanly, no second mutation site); (d) hitOutcomeScratch is per-action scratch on TBS, not participant state — correct ownership, cleared at applyActionImpact top.
- Fixes: none — no ownership violations found.
- Verification: type-check + scoped suite re-run post-review.

## Sequential Review Pass 3 — Adversarial Integration
- Reviewed state after Pass 2 fixes: YES (Pass 2 produced no code changes; reviewed the same verified state adversarially)
- Findings: attacked (a) AoE-on-player -> one Phan per affected reactor (affected.includes dedup + seen-set) — holds; (b) multi-hit mixed outcome (hit1 evaded, hit2 taken) — scratch 'taken' wins, one onImpactLanded window — matches design "the action resolved on them"; (c) intercept on ung_the basic -> mark on protector — rejected as Nit (unreachable, QA-U1); (d) enemy reactors with quan_the — accepted (QA-U2); (e) charge-resolve + intercept interaction — chargeTargetIds mirrors affected on substitution; (f) dead mark mid-window -> lazy-clear no transfer; (g) quan_the expiry post-commit -> no rollback by design.
- Fixes: none — no Medium-or-higher confirmed.
- Verification: full scoped suite green (270 files / 2183 tests).

## Gaps and Residual Risk

- HUD/auto-combat reactive automation verified at unit level only -- no runtime browser pass (QA-U3); coordinator's integration pass should eyeball the The bar + Qua The feedback once.
- Ung Tre gauge penalty uses actionGauge arithmetic on participants — save-restore mid-battle is out of scope (battle state isn't persisted; battle-scoped by design).
- `hitOutcomeScratch` aggregates per participant id — two hits on the same participant collapse correctly; no per-sub-hit granularity needed in beta.

## Pre-existing Failures

- None task-caused. The 4 expected-fail tests are unrelated upstream pins. The 34 eslint warnings are pre-existing unused-var noise in UI fixtures.
