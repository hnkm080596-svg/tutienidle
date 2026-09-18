# QA — skilldef M5 legacy-path retirement (quick)

Date: 2026-09-21 · Mode: quick · Scope: `feat/skill-definition` M5 diff (44 files, +5143/-648)

## Verdict

**PASS WITH EVIDENCE**

## Scope and routing

Task-owned paths: `game/src/core/battle/turn/**` (TurnBattleSystem lane surgery, TurnSkillPlanRuntime new, TurnSkillAction fallback def, TurnRuntimeFixtures), `game/src/core/skilldef/**` (resolver/executor/adapter/hooks/registry), `game/src/core/battle/contracts/operations.ts`, scheduler adapters (damage/resource), `game/src/core/game/GameManagerTurnBattleOps.ts`, `NguKiemDaoProvider`, `CultivationPathRegistry`, `SkillSystem`/`Skill*` comment+seam changes, test files, docs.

`changed-risk-map.mjs` routed to `combat-and-tribulation`; `deepAuditCandidate: false`. All 13 `unmappedPaths` are the new `skilldef/*` module — manually routed to the same domain (the skill-definition pipeline IS the active-cast execution path). One-hop consumers (combat presentation, post-combat loot/progression) are unchanged by M5 — the pipeline changes how casts execute, not what a settled battle emits downstream.

## Invariant ledger

| ID | State/owner | Attack operator | Invariant | Oracle | Result |
|---|---|---|---|---|---|
| INV-M5-1 | Cast commit (cooldown/cost/onSkillCast) — `plan.commitsCast` gate, `SkillCastCommitPort` | Repeat/reorder across root, charge-init, charge-resolve, composite extras, queued follow-ups, extras | Exactly-once commit per cast | Scheduler trace op counts + slot/cost state | Holds — `commitsCast` stamped `input.commitsCast ?? subcastIndex===0`; extras/follow-ups/charge-resolve all forced false; skillPlan tests assert single commit + cost-before-hit ordering |
| INV-M5-2 | Registry id slots — `mergeAdaptedCatalogs` | Reorder: auxiliaries claim before roots; same-id collisions | Deterministic, no wrong-def resolution | `require()` only ever targets auxiliary ids (payloads/picks/empowered); roots resolve by reference (`input.definition`) | Holds — `preResolved` stamped only when `payloadDef.id !== rootDef.id`; yielded root ids never reach `require()`; aux-vs-aux different-shape collision surfaces as `duplicate_id` fault |
| INV-M5-3 | Rng stream — `skill_hit` policy rolls in `CombatSystemDamageAdapter` | Determinism: same seed, same consumption order | Declared policy rolls (crit then armor) match legacy provider order | `NguKiemDaoProvider` closure rolls crit(L83) then armor(L88); adapter `resolveHitOptions` same order/position (options before `resolveActionHit`) | Holds — identical count and order; shared cycle `CombatRng` injected at both production (`GameManagerTurnBattleOps`) and fixture wiring |
| INV-M5-4 | Charge lane — init commits, resolve payload-only | Timing boundary + interruption (target death mid-charge) | Init commits once; resolve never recommits; targets = live set at resolve | `declared.affected` materialized for charge-resolve (HIGH-2 fix, `chargeTargetIds` = alive-filtered copy); routed lane reads `affected` | Holds — `chargeInit` plan: commits, no steps/grants/extras; resolve: `payloadOnly`+`commitsCast:false`; dead targets skip at authority |
| INV-M5-5 | Unsupported defs on live battles | Degraded input | Loud no-op, never silent legacy fallback | `reportUnroutedCast` fires once per cast identity (`declined` flag for known-null call sites); 12 warnings in suite = intentionally-broken QA fixtures | Holds — verified no spurious warnings on covered casts; `skill:null`/`self_ping` + unresolvable-buff fixtures warn by design |
| INV-M5-6 | Engine-unit lane (`runtime === undefined`) | Cross-system chain | Documented test lane keeps legacy resolveDeclaredHit | `engineUnitLane = runtime === undefined` gates all legacy hit paths; ~18 test files use it | Holds — production always wires runtime; lane documented in code + skills.md |
| INV-M5-7 | `externalWardGrant` replay | Value mutation (dead target, replace semantics) | Source-tagged REPLACE write only on resolved settle; existence-bound via reconcile | `grantExternalWard` delegate mirrors retired `applyDeclaredBuff` lane (max(0, maxHp*ratio), exempt wardMax) | Holds — apply_buff settling skipped on dead targets ⇒ no grant write; reconcile at refresh seam |
| INV-M5-8 | Fallback basic (`skill:null` → `FALLBACK_BASIC_SKILL`) | Stale state: `skill === null` consumers | Identical action-tag and charge semantics | `actionTagsOfSkill` infers `['attack']` from `damage` — same as the null lane's hardcoded `['attack']`; no `chargeTurns`/`instances`/`empowerment` fields | Holds — Cam Cong restriction, basic-action identity (`skillId:'basic_attack'`), costless consume all unchanged |
| INV-M5-9 | Grants — `emitGrants` gate (`hasHitOps ? anyDamageLanded : anyLanded`) | Edge: root whiffs + composite extra lands | Grant iff any landed hit across lanes (legacy `targetIds>0`) | Extras fold `anyLanded`+`anyDamageLanded`+`critLanded` into root state (fold fixed this pass); composite roots never carry grants in production (ngo_dao kit has no The loop) | Holds post-fix; was Low-severity latent gap (unreachable today) — now faithful IR |
| INV-M5-10 | Blocked cast (resource drops declare→resolve) | Reorder | Fizzle: no commit, no ops, no ghost consequences | Executor PRECHECK early-returns `blocked`; TBS consumes only landed/applied lists → empty = whiff-equivalent | Holds — safer than legacy (unconditional cost consume); commit never runs |

## Findings

- **FIXED (Low)**: `SkillExecutor.expandCompositeExtras` did not fold `extraOutcome.anyDamageLanded` into root state — a future composite def carrying `grants` could under-grant when the root whiffed but an extra landed. Unreachable in production (only composite roots are the ngo_dao An kit, which carries no The gains). Fixed by folding the flag; 159/159 affected tests green.
- **Coverage gap (noted, not blocking)**: the production coverage census (`LegacySkillCoverage.test.ts`) is a snapshot — future unsupported defs warn loudly at cast time rather than failing a gate. The loud report is the designed mitigation.
- **Pre-existing**: `asciiComments` architecture test fails on 127 pre-existing branch-drift offenders; zero net-new from this diff (baseline renamed for the moved converter test; new comments kept ASCII).

## Evidence

- `npx vitest run src/core/skilldef src/core/battle/turn/TurnBattleSystem.skillPlan.test.ts` — 159/159 (post-fold-fix)
- Prior: 507/507 turn scope, 742/742 extras scope, 969/969 affected scope, 5770 full suite (1 failure = pre-existing asciiComments drift)
- Code inspection: `TurnSkillPlanRuntime.routeCast/routeExtraCast`, `SkillExecutor.executePlan/emitGrants/expandCompositeExtras`, `LegacySkillAdapter.mergeAdaptedCatalogs`, `CombatSystemDamageAdapter.resolveHitOptions`, TBS lane gates (~1951-2248), `ActionValidator.actionTagsOf`
