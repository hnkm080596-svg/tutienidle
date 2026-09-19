# M7 Contract Closure Matrix

Date: 2026-09-21
Mission: M7 — Final Battle Wiring & Contract Closure (`../superpowers/plans/2026-09-19-megaplan-final-battle-wiring.md`)
Contract: `../specs/2026-09-17-combat-systems-contract-spec.md` v1.6 (base §§1–105 + addenda v1.2–v1.6)

## Classification legend

- **A** — covered by a new M7 integration/architecture test written under this mission.
- **B** — covered by an existing named lower-level test (no duplication added).
- **C** — not applicable to the final production composition, with explicit reason.

New M7 evidence artifacts referenced below:

- `src/core/battle/turn/TurnBattleSystem.contract.test.ts` — whole-stack canonical composition suite (M7.3, reaction scenarios use fixture composition only).
- `tests/architecture/damageAuthorityRng.test.ts` — RNG-ownership gate (extended M7.1).
- `docs/architecture/2026-09-21-m7-final-battle-wiring-inventory.md` — M7.0 authority matrix, composition map, mutation-bypass/allocator sweep.
- `docs/qa/2026-09-21-m7-contract-closure-deep.md` — M7.5 per-invariant deep evidence (companion to this matrix).

---

## Part 1 — Contract base sections §§1–90

| § | Requirement | Cls | Evidence (implementation + named test) |
|---|---|---|---|
| 1 | Fundamental rule: no cross-authority direct mutation | A | M7.1 mutation-bypass audit (`inventory` §5); `tests/architecture/damageAuthorityRng.test.ts`; B backstop: `CombatScheduler.test.ts` 'sinks strip smuggled causation fields' |
| 2 | Authority map (Skill/Buff/Damage/Gauge/Resource/Reaction) | A | `inventory` §4 production authority matrix; `CombatOperationExecutor.test.ts` 'routes every buff op type to the buffs port exactly once', 'routes gauge/resource/shield/heal ops to their ports' |
| 3 | Authored operation ≠ runtime operation | B | `SkillResolver.test.ts`; `operations.test.ts` (origin stamped by scheduler, not producer) |
| 4 | ResolvedCombatOperation shape (v1.5: `CombatOperation & {operationId, origin}`, no top-level sourceId) | B | `operations.test.ts` (type + origin); `CombatOperationExecutor.test.ts` 'composes ApplyBuffRequest from payload + origin envelope (r2 HIGH 3)' |
| 5 | Core CombatOperation type set | B | `operations.test.ts` validation per member; `CombatOperationExecutor.test.ts` per-type routing |
| 6 | Persistent control is Buff state | B | `BuffAcceptance.test.ts` 'control status: stun def answers hasControl + forbiddenActionTags' |
| 7 | Secondary persistent effects (modifiers) are Buff-owned | B | `BuffModifierEngine.test.ts`; `BuffAcceptance.test.ts` 'modifier reapply: same replace modifier applied twice -> x1.5, not x2.25' |
| 8 | External mutation rule: cross-domain writes only via CombatOperation | A | `inventory` §5 bypass audit (0 battle-reachable bypasses post-M7.1); B backstop `CombatScheduler.test.ts` 'sinks strip smuggled causation fields -- scope mints, never inherits (P5 F-F)' |
| 9 | Internal lifecycle exception | B | `BuffLifecycle.test.ts` (onHolderTurnEnd/onSourceTurnEnd/onRoundEnd/onTimePassed mutate own store); contract §102 row below |
| 10 | CombatOperationOrigin taxonomy | B | `CombatScheduler.test.ts` op-scoped sink origin stamping; `CombatTraceExporter.test.ts` 'export reconstructs a multi-root causal tree' |
| 11 | Causal chain fields (rootActionId/parentOperationId/causationEventId/causationOperationId) | B | `CombatScheduler.test.ts` 'handler-emitted events carry causationEventId -- trace shows op->event->op edges', 'trace renders the causal tree from causation fields, not sequence order'; `CombatTraceExporter.test.ts` |
| 12 | combatSequence sole allocator = CombatScheduler | B | `CombatScheduler.test.ts` 'ctx.combatSequence equals the op record sequence (v7.1 read channel)', 'op sequence is allocated at execution-START; a cause precedes its effects'; A: `inventory` §6 allocator sweep — `BuffPersistence` synthetic seq documented as out-of-battle persistent lane (no scheduler exists there; periodic defs rejected) |
| 13 | Operation ID global uniqueness | B | `CombatScheduler.test.ts` 'enqueueAuthored([A,B]) with a pre-seen B id faults before A executes', 'authored-vs-authored collision throws', 'handler-returned group reserves atomically', 'authored-vs-immediate collision throws', 'batch duplicate id faults', 'batch-vs-deferred in-batch id collision is a structural fault', 'batch id colliding with a globally reserved id faults' |
| 14 | Reaction eligibility is runtime metadata (ApplyBuffRequest), not def flag | B | `ReactionTriggerGate.test.ts`; `CombatOperationExecutor.test.ts` ApplyBuffRequest composition |
| 15 | ApplyBuffOperation payload contract | B | `operations.test.ts`; `BuffSystemApply.test.ts` |
| 16 | Buff application authority = BuffSystem only | B | `BuffSystemApply.test.ts`, `ApplicationResolver.test.ts`; executor routes apply_buff to buffs port |
| 17 | ApplyBuffResult fields (applied/addedStacks/refreshed/overflow...) | B | `BuffAcceptance.test.ts` stack/refresh/overflow rows |
| 18 | Failed application commits nothing | B | `BuffAcceptance.test.ts` 'failed application: no state change'; A: §91 whole-stack row below |
| 19 | ElementalStateRegistry authoritative elemental view | B | `ElementalStateRegistry.test.ts` |
| 20 | ElementalApplicationCommitted emitted post-commit only | B | `BuffAcceptance.test.ts` 'canonical reaction interaction: hoa_an apply emits elemental_application_committed' |
| 21 | Pure refresh (addedStacks=0) is not an application | B | `BuffAcceptance.test.ts` 'refresh: 5 stacks / 1 remaining -> successful reapply -> 5 stacks / 3'; gate verdicts in `ReactionTriggerGate.test.ts`; A: §92 row |
| 22 | Manual stack mutation (AddBuffStacks/SetBuffStacks) ≠ elemental application | B | `BuffStacks.test.ts`; `operations.test.ts`; A: §93 row |
| 23 | Reaction Trigger Gate | B | `ReactionTriggerGate.test.ts`; `ReactionGate.production.test.ts` |
| 24 | Reaction capability (`elemental_reaction_enabled`) gating | B | `ReactionGate.production.test.ts` 'no production dispatcher before canonical content: the minted runtime carries no reaction members'; `StaticCapabilityQuery` + `CapabilityValidatorRegistry.test.ts` |
| 25 | Visible Pháp Tu contract — canonical ailment applies, no Reaction, no Pháp Tu branch | B | `ReactionGate.production.test.ts` 'visible phap tu: a canonical hoa_an application emits the committed event and triggers NO reaction' |
| 26 | Reaction board query = readonly, same source/target | B | `ReactionBoard.test.ts` 'reads same-source stacks only (spec sec.7 / contract sec.27)', 'board is per (source,target) pair' |
| 27 | Source isolation | B | `ReactionBoard.test.ts` same-source rows; A: §99 whole-stack row |
| 28 | Candidate generation | B | `ReactionCandidate.test.ts` |
| 29 | Sinh strength | B | `ReactionCandidate.test.ts`; `ReactionPayoff.sinh.test.ts` |
| 30 | Khắc strength | B | `ReactionPayoff.khac.test.ts` |
| 31 | Reaction bias | B | `ReactionBias.test.ts` |
| 32 | Final selection weight | B | `ReactionSelection.test.ts` |
| 33 | Tie break = authored `selectionTiePriority` | B | `ReactionSelection.test.ts`; `ReactionRegistry.test.ts` (unique-priority validation) |
| 34 | No lexical-ID gameplay rule | B | `ReactionRegistry.test.ts` validation; `ReactionSelection.test.ts` |
| 35 | No payoff-aware candidate selection | B | `ReactionSelection.test.ts` (selection is payoff-blind) |
| 36 | Reaction snapshot | B | `ReactionSnapshot.test.ts` |
| 37 | Participant snapshot (exact instances/stacks) | B | `ReactionSnapshot.test.ts` 'captures pre-consume stacks for both sinh participants', 'captures attacker+defender for khac', 'mirrors every participant for sinh (2) and khac (2)' |
| 38 | Reaction snapshot is authoritative for payoff | B | `ReactionSnapshot.test.ts` 'payoff emitter receives the frozen context and appends after consumes', 'context carries the causal chain from the trigger event' |
| 39 | ReactionResolution shape (consume ops then payoff) | B | `ReactionBatch.test.ts` 'consume ops strictly precede payoff ops'; `ReactionSnapshot.test.ts` 'resolution emits consume ops first with removalReason reaction' |
| 40 | Reaction preconditions on batch ops | B | `CombatBatchRunner.test.ts` 'buff_participant requires an exact source/target/stacks match', 'entity_alive passes only while the checker reports alive' |
| 41 | Preconditions rationale (stale-detection) | B | same §40 tests + `CombatScheduler.test.ts` 'preflight fail -> zero ops run + atomic stale-skip is recorded' |
| 42 | Stale reaction rule | B | `ReactionBatch.test.ts` 'a stale participant skips the whole reaction (sec.95)', 'a missing participant instance is stale'; `CombatScheduler.test.ts` preflight-fail atomic skip |
| 43 | Reaction batch execution | B | `CombatScheduler.test.ts` 'preflight pass -> ops run in order; authored ops cannot interleave mid-batch', 'per-op settle inside the batch frame', 'nested batch runs to completion inside the parent frame'; `ReactionBatch.test.ts` |
| 44 | Reaction consumption order (consume → payoff) | B | `ReactionBatch.test.ts` 'consume ops strictly precede payoff ops'; `ReactionBatch.test.ts` 'khac batch consumes both participants' |
| 45 | Sinh consumption | B | `ReactionPayoff.sinh.test.ts`; `ReactionBatch.test.ts` |
| 46 | Khắc consumption | B | `ReactionBatch.test.ts` 'khac batch consumes both participants'; `ReactionPayoff.khac.test.ts` |
| 47 | Reaction removal reason | B | `ReactionSnapshot.test.ts` 'resolution emits consume ops first with removalReason reaction' |
| 48 | No rollback after batch start | B | `ReactionBatch.test.ts` 'death mid-batch keeps committed ops, trailing op skips' |
| 49 | Target death during payoff | B | `ReactionBatch.test.ts` same test; `CombatBatchRunner.test.ts` entity_alive precondition; A: §96 whole-stack row |
| 50 | Structural failure contract | B | `CombatScheduler.test.ts` 'an unknown settlement kind is a structural fault, not a silent no-op', 'a missing authority port records structural_fault'; `CombatOperationExecutor.test.ts` 'missing port throws a structural fault, never a failed result' |
| 51 | Runtime skip contract | B | `CombatOperationExecutor.test.ts` 'converts a CombatOperationSkip into a typed skipped result (sec.51)'; `CombatScheduler.test.ts` 'skipped periodic ops still emit their settled event with the mirrored status' |
| 52 | Operation result typing | B | `CombatOperationExecutor.test.ts` 'populates typed result payloads (push_gauge before/after)'; `results.ts` union; `operations.test.ts` |
| 53 | ApplyBuff result type | B | `BuffAcceptance.test.ts`; executor result mapping in `CombatOperationExecutor.test.ts` |
| 54 | Elemental event timing (post-commit, same barrier) | B | `BuffAcceptance.test.ts` 'canonical reaction interaction'; `ReactionDispatcher.test.ts` trigger consumption |
| 55 | Post-commit settlement barrier | B | `CombatScheduler.test.ts` 'handler-returned ops complete before the next authored op', 'X emits E2 -> Z settles inside X barrier: order X, Z, Y', 'nested event isolation: E3 settles inside X barrier before E2' |
| 56 | Immediate queue quiescence | B | `CombatScheduler.test.ts` 'chained immediate consequences fully drain before the next authored op', 'Option B: an event consequence tree completes before the next queued event handler', 'a root event\'s consequence tree drains before the next queued root (Option B)' |
| 57 | Infinite-loop protection | B | `CombatScheduler.test.ts` 'recursive op->event->op nesting past maxSettlementNestingDepth faults', 'flat handler-emitted chain past maxImmediateWorkPerBarrier faults', 'a root-scope emission loop faults on the work budget', 'mid-run lifecycle-sink intake ... whole-drain budget faults the ping-pong' |
| 58 | Exactly-once event processing | B | `CombatScheduler.test.ts` 'exactly-once: a duplicated enqueueEvent is stamped once and drained once'; `ReactionDispatcher.test.ts` 'double-invoke with the same event is idempotent (scheduler owns dedup)'; A: §97 whole-stack row |
| 59 | Event causation fields | B | `CombatScheduler.test.ts` 'handler-emitted events carry causationEventId', 'sinks strip smuggled causation fields' |
| 60 | Multicast sequential settlement | B | `SkillSubcast.test.ts` 'multicast{chance:1,maxExtraCasts:2} spawns 2 chained executions, each settling in order', 'caps the chain at min(maxExtraCasts, SKILL_MAX_MULTICAST)', 'a failed roll stops the chain'; A: §98 whole-stack row |
| 61 | Multicast and Reaction (each subcast sees settled board) | B | `ReactionDispatcher.test.ts` 'sequential multicast: a settled reaction is visible to the NEXT application (spec sec.79)' |
| 62 | Target death between subcasts | B | `SkillExecutor.test.ts` 'dead target mid-plan -> trailing ops skipped, earlier committed, no rollback'; `SkillSubcast.test.ts` 'a dead source between subcasts stops the remaining repeats'; `TurnBattleSystem.midImpactDeath.test.ts` |
| 63 | Skill operation ordering (authored order, settle-between) | B | `SkillExecutor.test.ts` 'settles each operation before the next step (op order log = authored order)' |
| 64 | Snapshot-before-reaction mechanics | B | `ReactionSnapshot.test.ts`; `ReactionDispatcher.test.ts` |
| 65 | Cast outcome survives downstream consume | B | `SkillExecutor.test.ts` 'landed survives a downstream settlement-time reaction consume (sec.41/65)', 'all-dodged plan -> landed:false whiffed:true' |
| 66 | Damage origin — skill | B | origin field on `deal_damage` ops (`operations.test.ts`); `CombatScheduler.test.ts` origin stamping; A: §100 whole-stack origins row |
| 67 | Damage origin — periodic | B | `BuffPeriodic.test.ts`; periodic bridge origins `CombatScheduler.test.ts` 'lifecycle sink emits PeriodicRequestsCommitted while quiescent -> built-in handler mints per-request origins'; A: §100 row |
| 68 | Damage origin — reaction | B | `ReactionPayoff.sinh.test.ts`/`ReactionPayoff.khac.test.ts` (fixture reaction origin ops); A: §100 row |
| 69 | Origin-specific modifiers stay separate | B | `CombatSystemDamageAdapter.test.ts` (profile dispatch by origin); `BuffAcceptance.test.ts` 'snapshot periodic: tick request carries the apply-time snapshot verbatim' |
| 70 | Gauge contract — PushGauge op, gauge authority owns mutation | B | `CombatOperationExecutor.test.ts` 'routes gauge/resource/shield/heal ops to their ports' + 'populates typed result payloads (push_gauge before/after)'; `ActionGauge.test.ts`; `ActionGauge.adversarial.test.ts` |
| 71 | Cấm Công contract — generic restriction state + ActionValidator | B | `TurnBattleSystem.camCong.test.ts` 'forced basic pick is rejected and falls back to the legal special', 'seal expires with the buff instance'; `ActionValidator.test.ts` |
| 72 | Cấm Công ≠ stun (turn retained; only attack forbidden) | B | `TurnBattleSystem.camCong.test.ts` 'heal/buff/cleanse-tagged actions remain legal under the seal', 'an untagged damageless action is also legal', 'sealed actor with only attacks yields an empty turn (R-E)'; A: §101 whole-stack row |
| 73 | Manual periodic trigger (no lifetime advance) | B | `SkillExecutor.test.ts` 'manual tick (sec.73): trigger_buff_periodic mints + settles, never advancing lifetime'; `BuffAcceptance.test.ts` 'manual tick: triggerPeriodic emits the request and leaves duration unchanged' |
| 74 | Periodic damage produces no ElementalApplicationCommitted → no Reaction | B | `BuffPeriodic.test.ts`; gate coverage `ReactionTriggerGate.test.ts`; periodic bridge emits damage ops not elemental events (`CombatScheduler.test.ts` periodic rows) |
| 75 | Reaction-generated elemental stack = AddBuffStacks (non-application) | B | `ReactionPayoff.noRecursion.test.ts`; `ReactionPayoff.sinh.test.ts` |
| 76 | Reaction-generated genuine application uses `reactionEligibility = suppressed` | B | `ReactionPayoff.noRecursion.test.ts` (no recursive Reaction on generated stacks) |
| 77 | Modifier contract — shared AddBuffModifier, BuffSystem owns policy | B | `BuffModifierEngine.test.ts`; `BuffAcceptance.test.ts` modifier rows |
| 78 | Sinh modifier (reapply=max, child lifetime) | B | `BuffModifierEngine.test.ts`; `ReactionPayoff.sinh.test.ts` |
| 79 | Reaction bias query | B | `ReactionBias.test.ts` |
| 80 | Bias snapshot | B | `ReactionBias.test.ts`; `ReactionSnapshot.test.ts` |
| 81 | Reaction definition shape | B | `ReactionRegistry.test.ts`; `ReactionDefinition.ts` |
| 82 | Registry validation (unique ids, unique tie priority, complete payloads) | B | `ReactionRegistry.test.ts` |
| 83 | Dependency direction (core systems never reach upward) | B | `tests/architecture/` import-direction guards (`statDomainWhitelist.test.ts`, `invariants.test.ts`); `skillDefProducerSources.test.ts` |
| 84 | Suggested shared contract layer | C | Advisory placement guidance only — already satisfied by `src/core/battle/contracts/`; no behavioral requirement to test. |
| 85 | Debug trace requirement | B | `CombatTraceExporter.test.ts`; `ReactionTrace.test.ts`; `ReactionSnapshot.test.ts` 'resolved result carries the trace (contract sec.85)'; A: `TurnBattleSystem.determinism.test.ts` 'exposes executions/events/faults/batchSkips/skippedResults/journal + causal fields', 'a stale batch lands in batchSkips AND skippedResults' |
| 86 | No hidden mutation | A | `inventory` §5 bypass audit; B `CombatScheduler.test.ts` 'sinks strip smuggled causation fields' |
| 87 | Determinism contract | A | `TurnBattleSystem.determinism.test.ts` 'identical seed + identical commands -> identical state and exported trace', 'rolls on opposite sides of the 0.5 hit threshold diverge exactly'; B `BuffAcceptance.test.ts` 'determinism: identical command stream on two worlds -> identical state + event order', `ReactionDeterminism.test.ts`, `CombatTraceExporter.test.ts` 'the same scenario twice produces identical exported traces', `TurnBattleSystem.rngContract.test.ts` |
| 88 | RNG ownership | A | `tests/architecture/damageAuthorityRng.test.ts` (adapter never mints rng; every production TBS construction injects `CombatRng`); B `CombatSystemDamageAdapter.test.ts` rng-contract suite, `SkillCastCommit.test.ts` 'the executor rng spy sees NO hit/crit/armor rolls on policy-carrying plans', `TurnBattleSystem.rngContract.test.ts` |
| 89 | Forbidden cross-authority mutation | A | `inventory` §5 audit (externalWard write seam unified; no second gameplay authority); B same sinks-strip test |
| 90 | Forbidden core special cases | A | M7.5 deletion sweep; B `LegacySkillCoverage.test.ts` producer census (no per-id handler lane), `skillDefProducerSources.test.ts` |

## Part 2 — Contract tests §§91–102 (whole-stack canonical composition)

All twelve are implemented as **A** rows in `src/core/battle/turn/TurnBattleSystem.contract.test.ts` (M7.3): real `TurnCombatRuntime`/`CombatScheduler`/authority adapters; reaction scenarios attach the fixture composition (fixture `ElementalStateRegistry`/`ReactionRegistry`/capability query + `ReactionSystem`/`ReactionDispatcher`) inside the test only — production reaction stays inert.

| § | Scenario | Cls | Whole-stack test | Lower-level backstop (B) |
|---|---|---|---|---|
| 91 | Failed application → no state, no committed event, no Reaction eval | A | contract suite `application failure` | `BuffAcceptance.test.ts` 'failed application: no state change'; `ReactionTriggerGate.test.ts` |
| 92 | Max-stack refresh → addedStacks=0, duration refresh, no Reaction | A | contract suite `cap refresh` | `BuffAcceptance.test.ts` 'refresh: 5 stacks / 1 remaining' |
| 93 | Generic AddStacks → no committed event, no recursive Reaction | A | contract suite `addStacks non-application` | `BuffStacks.test.ts`; `ReactionPayoff.noRecursion.test.ts` |
| 94 | Immediate settlement → post-Reaction read sees consumed board | A | contract suite `post-settlement read` | `SkillExecutor.test.ts` 'a read step after apply_buff+reaction sees post-settlement stacks = 0'; `ReactionDispatcher.test.ts` sequential-visibility |
| 95 | Stale snapshot → whole batch skipped atomically | A | contract suite `stale reaction batch` | `ReactionBatch.test.ts` 'a stale participant skips the whole reaction (sec.95)'; `CombatScheduler.test.ts` 'preflight fail -> zero ops run + atomic stale-skip is recorded' |
| 96 | Death mid-batch → committed stays, trailing skips, no rollback | A | contract suite `death mid-batch` | `ReactionBatch.test.ts` 'death mid-batch keeps committed ops, trailing op skips' |
| 97 | Duplicate eventId → processed exactly once | A | contract suite `duplicate event` | `CombatScheduler.test.ts` 'exactly-once: a duplicated enqueueEvent is stamped once and drained once' |
| 98 | Sequential multicast → each subcast settles before next resolves | A | contract suite `sequential multicast` | `SkillSubcast.test.ts` multicast chain; `ReactionDispatcher.test.ts` 'sequential multicast: a settled reaction is visible to the NEXT application' |
| 99 | Source isolation → caster cannot consume another's stacks | A | contract suite `source isolation` | `ReactionBoard.test.ts` 'reads same-source stacks only' |
| 100 | Damage origins — `skill` / `buff_periodic` / `reaction` distinct | A | contract suite `damage origins` | origin stamping `CombatScheduler.test.ts`; `BuffPeriodic.test.ts`; `ReactionPayoff.*` |
| 101 | Cấm Công → attack rejected, non-attack allowed, not stunned | A | contract suite `cam cong` | `TurnBattleSystem.camCong.test.ts` (7 rows) |
| 102 | Lifecycle exception — BuffSystem internal mutation needs no op | A | contract suite `lifecycle exception` | `BuffLifecycle.test.ts` (4 decrement/expire rows) |

## Part 3 — Skill whole-stack acceptance (M7.3 contract suite, real TurnBattleSystem)

| Requirement | Cls | Evidence |
|---|---|---|
| Root cooldown commits once | A | contract suite `cast commit`; B `TurnBattleSystem.skillPlan.test.ts` 'commits cost + cooldown through the plan exactly once, cost op before the hit' |
| Root resource cost commits once | A | same + `SkillCastCommit.test.ts` 'commits the root cast exactly once and settles cost BEFORE the first plan step' |
| Whiff does not roll back committed cost/cooldown | A | contract suite `whiff commit`; B `SkillCastCommit.test.ts` 'never rolls back committed cooldown + cost on a whiff'; `TurnBattleSystem.skillPlan.test.ts` 'a dodged hit settles landed:false' |
| Repeat does not repay | A | contract suite `repeat no-repay`; B `TurnBattleSystem.skillPlan.test.ts` 'a queued repeat execution re-resolves damage without re-committing the cast'; `SkillSubcast.test.ts` 'subcasts.count fires exactly N non-committing follow-up plans' |
| Multicast does not repay | A | contract suite; B `SkillSubcast.test.ts` 'multicast ... 2 chained executions' + `SkillCastCommit.test.ts` 'skips commit + cost for subcastIndex>0 follow-up plans' |
| Composite extras do not repay | A | contract suite; B `TurnBattleSystem.skillPlan.test.ts` 'a composite cast executes primary + extra payloads in one plan while the root commits once', 'routes two casts whose defs share one composite pool (An kit parity)' |
| Charge init commits | A | contract suite `charge commit`; B `SkillCastCommit.test.ts` 'commits the charge-init plan through the same seam (chargeProgress rides the port)' |
| Charge resolve does not recommit | A | same; B `TurnBattleSystem.skillPlan.test.ts` 'a charge resolves through the plan pipeline: init commits, resolve mints one hit, no re-commit' |
| Dead target during charge resolves safely | A | contract suite `charge dead target`; B `TurnBattleSystem.chargeCcInteraction.test.ts`, `TurnBattleSystem.midImpactDeath.test.ts` |
| Unsupported runtime cast = loud no-op | A | contract suite `unrouted cast`; B `TurnBattleSystem.skillPlan.test.ts` 'a def with unexpressible semantics (runtime-closure perInstanceOptions) reports loudly and no-ops' |
| Unsupported runtime cast never uses production legacy fallback | A | contract suite; B `damageAuthorityRng.test.ts` + `inventory` §3 (runtime-present lane throws without a runtime; only `runtime === undefined` engine-unit lane retains legacy semantics) |

### M7.3 implementation findings closed while building the suite

- **§49 gate existed only headlessly (fixed).** The contract's per-op validity gate (`invalid_target_state` on a dead target / vanished selector instance, batch continues) lived only in the headless `ReactionBatchRunner`; the production `CombatScheduler.runBatchFrame` dispatched every batch op unconditionally — an `apply_buff` payoff on a mid-batch-killed target committed on a corpse. The gate moved into the shared `CombatOperationBatchRunner.opTargetSkipReason` (new optional `PreconditionChecker.getBuffInstanceBySelector` probe resolving all three selector kinds); the scheduler frame and the headless runner now consult the same authority. Both composition roots (`GameManagerTurnBattleOps.mintCycleScheduler`, `makeTurnRuntime`) wire the probe. §96 whole-stack evidence is the acceptance.
- **Fixture RNG channel gap (fixed).** `makeTurnRuntime` injected `CombatRng` into the application resolver, damage-adapter policy rolls and proc system, but never bound `combatSystem.setRandomSource` — the accuracy/evasion/crit/block rolls inside `resolveActionHit` ran on unseeded `Math.random` while production binds the same instance (`GameManagerTurnBattleOps:1245`). The fixture now binds `setRandomSource(() => rng.roll())`, matching production and enabling the M7.4 same-seed determinism proof. One pre-existing test (`theTuAnRiders` dead-holder no-draw assertion) was updated to pin `rollChance` specifically — the hit channel's `roll()` draws are a separate legitimate channel.

## Part 4 — Addenda v1.2–v1.6

| Addendum item | Requirement | Cls | Evidence |
|---|---|---|---|
| v1.2.1 | `SetBuffStacks`/`SetBuffDuration`/`CleanseBuff` ops + authority methods | B | `operations.test.ts`; `operations.cleanse-limit.test.ts`; `BuffCleanse.test.ts`; `BuffSystem.r4-cleanse.reaudit.test.ts`; executor 'routes every buff op type to the buffs port exactly once' |
| v1.2.2 | `ctx.combatSequence` read channel; scheduler builds complete ctx | B | `CombatScheduler.test.ts` 'ctx.combatSequence equals the op record sequence (v7.1 read channel)' |
| v1.2.3 | `createLifecycleSink(rootActionId)` + `settle()` outcome map | B | `CombatScheduler.test.ts` 'sequence is allocated at creation; settle() drains and reports opId -> status' |
| v1.2.4 | `PeriodicRequestsCommitted` trigger shape + `requestId` + `periodic.${requestId}` naming | B | `CombatScheduler.test.ts` 'lifecycle sink emits PeriodicRequestsCommitted while quiescent -> built-in handler mints per-request origins', 'two requests sharing one requestId inside one event -> group-atomic duplicate fault', 'a later event reusing an already-reserved requestId -> reserved-id fault' |
| v1.2.5 | Periodic `snapshot?` scaling | B | `BuffAcceptance.test.ts` 'snapshot periodic: tick request carries the apply-time snapshot verbatim', 'dynamic periodic: tick request carries NO snapshot' |
| v1.2.6 | `remove_buff` returns `RemoveBuffResult` | B | `operations.test.ts`; `BuffCleanse.test.ts` |
| v1.2.7 | Generic capability grants + `CapabilityValidatorRegistry` | B | `CapabilityValidatorRegistry.test.ts`; `StaticCapabilityQuery.ts`; buff stores grants without interpreting payloads |
| v1.3.1 | `PeriodicOperationSettled` scheduler-originated event | B | `CombatScheduler.test.ts` 'one periodic op -> exactly ONE settled event; canonical scope id + causation + seq ordering' |
| v1.3.2 | `settle()` per sequential periodic unit | B | `CombatScheduler.test.ts` 'sequential periodic units may settle once each -- several settles per lifecycle entry are legal (v7.3)' |
| v1.4.1 | Typed `periodicRequestId` field | C | Superseded by v1.5.2 — public field removed; correlation is scheduler-private (see v1.5.2). |
| v1.4.2 | Settled-event stamping (deterministic id, causation, seq ordering, exactly-once) | B | `CombatScheduler.test.ts` 'one periodic op -> exactly ONE settled event' (eventId minting superseded by v1.5.3 — still canonical-scope and collision-proof) |
| v1.4.3 | Manual-trigger continuation chain | B | `CombatScheduler.test.ts` 'a registered handler sees the settled event and can continue the series (manual-trigger continuation lane)' |
| v1.5.1 | `ResolvedCombatOperation` = `CombatOperation & {operationId, origin}`; no top-level `sourceId` | B | `operations.test.ts`; `CombatOperationExecutor.test.ts` origin-envelope composition |
| v1.5.2 | Periodic correlation is scheduler-private (no public field) | B | `CombatScheduler.test.ts` 'a NON-periodic op produces NO settled event -- correlation is private, unforgeable (r5 HIGH 3)' |
| v1.5.3 | Synthetic event ids via canonical scope allocator | B | `CombatScheduler.test.ts` 'settled events share the op scope counter -- zero eventId collisions vs the op sink emissions (r5 HIGH 2 adversarial)' |
| v1.5.4 | `trigger_buff_periodic` result = start metadata only | B | `CombatOperationExecutor.test.ts` 'maps trigger_buff_periodic to TriggerPeriodicStartResult (v7.5)' |
| v1.5.5 | `modifierRuntimeId` on modifier events; `all_matching` removal | B | `BuffModifierEngine.test.ts`; `BuffAcceptance.test.ts` 'modifier reapply' |
| v1.6.1 | Declared hit/crit/armor intent policies on `deal_damage`; authority rolls | B | `operations.test.ts` (policy validation + contradictory-flag fault + non-hit-profile fault); `CombatSystemDamageAdapter.test.ts` (policy order on injected rng); `SkillCastCommit.test.ts` 'the executor rng spy sees NO hit/crit/armor rolls on policy-carrying plans'; A `damageAuthorityRng.test.ts` |

## Part 5 — Final invariants CON-01–CON-23

Full per-invariant deep evidence (implementation + named test + file) lives in `2026-09-21-m7-contract-closure-deep.md` (M7.5). Coverage classification here:

| ID | Invariant | Cls | Primary evidence |
|---|---|---|---|
| CON-01 | Static definitions = authored intent only | B | `SkillDefinition.test.ts`; `LegacySkillCoverage.test.ts` census (defs carry no runtime ids) |
| CON-02 | Runtime ops carry resolved context | B | `SkillResolver.test.ts`; `operations.test.ts` origin stamping |
| CON-03 | Cross-authority mutation via CombatOperations | A | `inventory` §5 audit; contract suite (A rows §§91–102 route through scheduler) |
| CON-04 | Internal lifecycle needs no artificial ops | B | `BuffLifecycle.test.ts`; contract suite §102 |
| CON-05 | BuffSystem sole BuffInstance authority | A | `inventory` §4/§5 (all writes via buffs port or own lifecycle); B `BuffSystemApply.test.ts` |
| CON-06 | ReactionSystem selects/resolves, never mutates | B | `ReactionSystem.ts` returns `ReactionResolution` ops only; `ReactionDispatcher.test.ts` 'returns void when selection produces no candidate'; `ReactionBatch.test.ts` (mutation happens through batch ops on authorities) |
| CON-07 | DamageSystem = damage/HP authority | A | `damageAuthorityRng.test.ts`; `inventory` §4 (post-M7.1 no direct `resolveActionHit` on routed lane); B `CombatSystemDamageAdapter.test.ts` |
| CON-08 | Gauge authority owns gauge mutation | B | `ActionGauge.test.ts`; executor routes `push_gauge` to gauge port only |
| CON-09 | Reaction observes committed Buff state only | B | `ReactionDispatcher.test.ts` sequential-visibility; `SkillExecutor.test.ts` post-settlement read |
| CON-10 | ElementalApplicationCommitted post-commit | B | `BuffAcceptance.test.ts` 'canonical reaction interaction' |
| CON-11 | `addedStacks > 0` required for baseline Reaction | B | `ReactionTriggerGate.test.ts`; contract suite §92 |
| CON-12 | Generic stack mutation is not elemental application | B | `BuffStacks.test.ts`; contract suite §93 |
| CON-13 | Reaction-generated elemental changes non-reactive | B | `ReactionPayoff.noRecursion.test.ts` |
| CON-14 | Reaction settles before next authored op | B | `CombatScheduler.test.ts` 'handler-returned ops complete before the next authored op'; `ReactionDispatcher.test.ts` |
| CON-15 | Multicast settles sequentially | B | `SkillSubcast.test.ts`; contract suite §98 |
| CON-16 | Batch preflight validates snapshot | B | `CombatBatchRunner.test.ts`; `CombatScheduler.test.ts` preflight rows |
| CON-17 | Stale Reaction skipped atomically | B | `ReactionBatch.test.ts` sec.95 rows; contract suite §95 |
| CON-18 | No rollback after batch start | B | `ReactionBatch.test.ts` 'death mid-batch keeps committed ops, trailing op skips' |
| CON-19 | Immediate events exactly once | B | `CombatScheduler.test.ts` exactly-once; contract suite §97 |
| CON-20 | Scheduler alone owns combatSequence | A | `inventory` §6 allocator sweep + `CombatScheduler.test.ts` 'op sequence is allocated at execution-START'; BuffPersistence synthetic seq documented as out-of-battle |
| CON-21 | Tie-break = authored priority, never id spelling | B | `ReactionRegistry.test.ts` unique-priority validation; `ReactionSelection.test.ts` |
| CON-22 | All runtime mutations causally traceable | B | `CombatScheduler.test.ts` causation rows; `CombatTraceExporter.test.ts` 'export reconstructs a multi-root causal tree'; A `TurnBattleSystem.determinism.test.ts` causal-graph pair |
| CON-23 | No path-specific special-case logic in core | A | M7.5 deletion sweep; B `LegacySkillCoverage.test.ts` (no per-id handlers), `operations.test.ts` (uniform op validation) |

## Part 6 — Definition of Done (§104) mapping

| DoD item | Cls | Evidence |
|---|---|---|
| SkillDefinition contains no runtime IDs | B | `SkillDefinition.test.ts` immutability; `LegacySkillCoverage.test.ts` |
| SkillResolver produces runtime ResolvedSkillPlan | B | `SkillResolver.test.ts`; `ResolvedSkillPlan.test.ts` |
| Skill and Reaction share the CombatOperation layer | B | `SkillExecutor.test.ts` (ops through scheduler); `ReactionBatch.test.ts`/`ReactionDispatcher.test.ts` (batch ops through scheduler) |
| CombatOperationExecutor = routing, not domain formulas | B | `CombatOperationExecutor.test.ts` per-port routing; no stat math in `CombatOperationExecutor.ts` (§2 authority map) |
| BuffSystem commits before Reaction inspection | B | `BuffAcceptance.test.ts` 'canonical reaction interaction'; `ReactionDispatcher.test.ts` |
| Elemental application emits authoritative post-commit data | B | `BuffAcceptance.test.ts` 'canonical reaction interaction' |
| Failed applications cannot Reaction | A | contract suite §91; B gate tests |
| Max-stack refresh cannot Reaction | A | contract suite §92; B `BuffAcceptance.test.ts` refresh row |
| Same-source Reaction board works | B | `ReactionBoard.test.ts` |
| Candidate selection is deterministic | B | `ReactionDeterminism.test.ts`; `ReactionSelection.test.ts` |
| Reaction tie priority explicit and stable | B | `ReactionRegistry.test.ts`; `ReactionSelection.test.ts` |
| Reaction snapshot records exact participating instances/stacks | B | `ReactionSnapshot.test.ts` 'captures pre-consume stacks', 'mirrors every participant' |
| Reaction batch preflight prevents stale partial consumption | B | `CombatScheduler.test.ts` 'preflight fail -> zero ops run + atomic stale-skip'; `CombatBatchRunner.test.ts` |
| Consumption happens before Reaction payoff | B | `ReactionBatch.test.ts` 'consume ops strictly precede payoff ops' |
| No rollback after batch execution starts | B | `ReactionBatch.test.ts` 'death mid-batch keeps committed ops' |
| Target death safely skips invalid later payoff | B | `ReactionBatch.test.ts` same; `CombatBatchRunner.test.ts` entity_alive |
| Reaction-generated stacks do not recursively Reaction | B | `ReactionPayoff.noRecursion.test.ts` |
| Immediate settlement completes before next Skill operation | B | `SkillExecutor.test.ts` 'a read step after apply_buff+reaction sees post-settlement stacks = 0'; `CombatScheduler.test.ts` barrier rows |
| Each multicast subcast sees fully settled previous state | B | `ReactionDispatcher.test.ts` sequential-multicast; `SkillSubcast.test.ts` |
| Buff lifecycle remains internal to BuffSystem | B | `BuffLifecycle.test.ts`; contract suite §102 |
| Cấm Công uses generic action restriction state | B | `TurnBattleSystem.camCong.test.ts`; `BuffAcceptance.test.ts` 'control status' |
| Skill, Periodic, Reaction damage origins distinct | A | contract suite §100; B origin stamping rows |
| Exactly-once event handling is tested | B | `CombatScheduler.test.ts` exactly-once row; contract suite §97 |
| Causal trace reconstructs cast → operation → event → Reaction → payoff | A | `TurnBattleSystem.determinism.test.ts` 'the named chain apply_buff -> committed event -> reaction ops -> resolved event resolves', 'every causation field resolves to a real parent inside the export'; B `CombatTraceExporter.test.ts` multi-root tree, `CombatScheduler.test.ts` causation rows, `ReactionTrace.test.ts` |
| Same initial state + same seed → identical trace and combat state | A | `TurnBattleSystem.determinism.test.ts` same-seed parity + controlled-divergence pair; B `BuffAcceptance.test.ts` determinism row, `ReactionDeterminism.test.ts`, `CombatTraceExporter.test.ts` identical-export row, `TurnBattleSystem.rngContract.test.ts` |

Explicit DoD emphasis items:

- **Skill damage-policy RNG authority** — B `operations.test.ts` policy-validation faults + `CombatSystemDamageAdapter.test.ts` + `SkillCastCommit.test.ts` rng-spy; A `damageAuthorityRng.test.ts` (no adapter-side rng minting, production TBS construction injects `CombatRng`).
- **Cleanse limit** — B `operations.cleanse-limit.test.ts`, `BuffCleanse.test.ts`, `BuffSystem.r4-cleanse.reaudit.test.ts`.
- **Skill cast commit** — B `SkillCastCommit.test.ts` (all 7 rows); A contract suite Part 3 rows.
- **Scheduler settlement barriers** — B `CombatScheduler.test.ts` §55/§56 rows; A contract suite §§94/98.
- **Periodic correlation** — B `CombatScheduler.test.ts` settled-event rows (v1.4/v1.5); `BuffAcceptance.test.ts` manual-tick row.
- **Causal provenance** — B scheduler causation + `CombatTraceExporter.test.ts`; A `TurnBattleSystem.determinism.test.ts` causal-graph reconstruction.
- **Stale Reaction semantics** — B `ReactionBatch.test.ts` sec.95; A contract suite §95.
- **Sequence ownership** — A `inventory` §6 + B `CombatScheduler.test.ts` ctx.sequence row.

## Unmapped check

Every contract section §1–§105, every addendum item v1.2–v1.6, every CON-01–23 invariant, and every §104 DoD item appears exactly once above with an A/B/C classification. No requirement is unmapped. Sections with no standalone row (§77/§78 listed with the modifier contract, §84 advisory) are explicitly classified C or B with reasons.

Production boundary note: Reaction rows classify against the fixture composition (`src/core/reaction/testing/ReactionTestFixtures.ts`). Production reaction remains inert — `ReactionGate.production.test.ts` proves the minted runtime carries no reaction members and grants `elemental_reaction_enabled` to nobody; M7 does not change that.
