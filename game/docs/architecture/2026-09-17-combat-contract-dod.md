# Combat Contract — Definition of Done Sweep (spec sec.104)

**Mission:** M5 of `2026-09-17-megaplan-combat-contract` (`.superpowers/sdd/2026-09-17-megaplan-combat-contract/`).
**Branch / worktree:** `feat/combat-contract` @ `.agent-worktrees/combat-contract`.
**Spec:** `.superpowers/sdd/2026-09-17-combat-systems-contract-spec.md` sec.104.

Every sec.104 row maps to a named test/proof on this branch, or to the
sibling plan that owns it. Test paths are under `game/src/`; scheduler
tests live in `core/battle/runtime/scheduler/CombatScheduler.test.ts`
unless another file is named.

Sibling plan names used below (megaplan sec."Deferred / owned by
sibling plans"): **buff megaplan** (BuffAuthority impl,
`ApplyBuffResult` production, `ElementalApplicationCommitted`
emission), **skill megaplan** (`SkillResolver`/`ResolvedSkillPlan`,
executor emission, multicast subcast production), **reaction
megaplan** (`ReactionSystem`/`ReactionBatchRunner`,
`ElementalStateRegistry` binding), **seal batch** (an definitions,
capability grant, legacy reaction retirement).

| # | sec.104 row | Status | Proof / owner |
|---|---|---|---|
| 1 | SkillDefinition contains no runtime IDs | Sibling | skill megaplan (owns SkillDefinition). Contract side here: `ResolvedCombatOperation` requires `origin` with resolved context (`contracts/operations.test.ts`). |
| 2 | SkillResolver produces a runtime ResolvedSkillPlan | Sibling | skill megaplan. |
| 3 | Both Skill and Reaction use the shared CombatOperation layer | Layer DONE here; producers sibling | The layer accepts any `ResolvedCombatOperation`: `CombatOperationExecutor.test.ts` routes all 16 op types; `operations.test.ts` "discriminates all 16 members by type". Skill/reaction producers: skill megaplan + reaction megaplan. |
| 4 | CombatOperationExecutor contains routing, not domain formulas | DONE | `CombatOperationExecutor.test.ts` ("routes ... to port with payload + ctx" describes; "missing port throws a structural fault"; "converts a CombatOperationSkip into a typed skipped result"). The executor is a pure type-switch over ports; formulas live in authorities/adapters (e.g. `CombatSystemDamageAdapter` profile dispatch). |
| 5 | BuffSystem commits before Reaction inspection | Mechanism DONE; emission sibling | An op's consequences settle only inside its post-commit barrier: `CombatScheduler.test.ts` "handler-returned ops complete before the next authored op". The commit-then-emit point inside the real BuffSystem: buff megaplan (CON-10). |
| 6 | Elemental application emits authoritative post-commit data | Contract DONE; emission sibling | `contracts/events.ts` `ElementalApplicationCommitted` carries stacksBefore/stacksAfter/requestedStacks/addedStacks/reactionEligibility + origin. Emission: buff megaplan. |
| 7 | Failed applications cannot Reaction (sec.91) | Sibling | buff megaplan (`BuffApplicationFailedEvent`, `applied:false` result) + reaction megaplan (evaluates committed eligible applications only). |
| 8 | Max-stack refresh cannot Reaction (sec.92) | Sibling | buff megaplan produces `addedStacks:0`; reaction megaplan gates on it (CON-11). The eligibility fields exist on the event contract here. |
| 9 | Same-source Reaction board works (sec.99) | Sibling | reaction megaplan (source-scoped board isolation). |
| 10 | Candidate selection is deterministic | Sibling | reaction megaplan (sec.88: selection uses ZERO RNG). |
| 11 | Reaction tie priority is explicit and stable | Sibling | reaction megaplan (`selectionTiePriority`, CON-21). |
| 12 | Reaction snapshot records exact participating instances/stacks | Mechanism DONE; production sibling | `CombatBatchRunner.test.ts` "buff_participant requires an exact source/target/stacks match" — the precondition primitive consumes exact instance/source/target/stacks. Snapshot production: reaction megaplan. |
| 13 | Reaction batch preflight prevents stale partial consumption | DONE (mechanism) | `CombatScheduler.test.ts` "preflight fail -> zero ops run + atomic stale-skip is recorded"; `CombatBatchRunner.test.ts` preflight describe (sec.40-42). Snapshot->precondition mapping: reaction megaplan. |
| 14 | Consumption happens before Reaction payoff | Mechanism DONE; ordering sibling | `CombatScheduler.test.ts` "preflight pass -> ops run in order; authored ops cannot interleave mid-batch" — batch entries execute ordered and non-interleaved. The consume-first op order inside the batch: reaction megaplan (sec.44). |
| 15 | No rollback occurs after batch execution starts | DONE | No rollback machinery exists; committed executions stay `resolved` — `CombatScheduler.test.ts` "fault event reaches diagnosticSink + trace but NEVER any event queue; committed op stays resolved" and both guard tests; a mid-batch skip never undoes earlier results ("deferred runtime dependency" test). |
| 16 | Target death safely skips invalid later payoff (sec.49/96) | Mechanism DONE; reaction batch sibling | `CombatSystemDamageAdapter.test.ts` "throws CombatOperationSkip(invalid_target_state) on a dead target"; scheduler converts it to a typed skipped result and the batch continues ("deferred runtime dependency" — later entries still process). The sec.96-shaped reaction batch: reaction megaplan. |
| 17 | Reaction-generated stacks do not recursively Reaction (sec.75/93) | Contract split DONE; emission sibling | `add_buff_stacks` (generic stack mutation, CON-12) vs `apply_buff` with `reactionEligibility:'suppressed'` both exist in the op union. No-eligible-event -> no evaluation is guaranteed by construction (only `elemental_application_committed` drives evaluation). Emission discipline: buff megaplan; evaluation: reaction megaplan. |
| 18 | Immediate settlement completes before next Skill operation (sec.55) | DONE | `CombatScheduler.test.ts` "handler-returned ops complete before the next authored op" + "chained immediate consequences fully drain before the next authored op" + the depth-first frame describes (CON-14). |
| 19 | Each multicast subcast sees the fully settled previous state (sec.60) | Mechanism DONE; producer sibling | Same per-op barrier tests — every authored op's consequences fully drain before the next authored op (CON-15). Sequential subcast production: skill megaplan. |
| 20 | Buff lifecycle remains internal to BuffSystem (sec.102) | Lane DONE; lifecycle sibling | `createLifecycleSink(rootActionId)` is the public lifecycle event lane — `CombatScheduler.test.ts` lifecycle-root tests (two sinks share ordinals; periodic bridge on a lifecycle root). "Lifecycle needs no artificial ops" enforcement: buff megaplan (CON-04). |
| 21 | Cam Cong uses generic action restriction state (sec.71-72/101) | Vocabulary DONE; content sibling | No path-specific op exists (CON-23 — 16 generic members only; `blocked_by_restriction` reason is in the result taxonomy). The `cam_cong` definition + forbiddenActionTags + ActionValidator read: seal batch + skill megaplan. |
| 22 | Skill, Periodic and Reaction damage origins remain distinct (sec.66-69/100) | DONE (channels) | `CombatSystemDamageAdapter.test.ts`: 'legacy_dot' profile -> `applyDotDamage` (reason 'dot'); `reaction_*` profile or `origin.kind:'reaction'` -> `applyReactionDamage` (reason 'reaction', no hit layer); else `applyModifiedDirectDamage` (reason 'damage'). The sec.100 one-target/three-origins log assertion: reaction megaplan contract test. |
| 23 | Exactly-once event handling is tested (sec.58/97) | DONE | `CombatScheduler.test.ts` "exactly-once: a duplicated enqueueEvent is stamped once and drained once" (CON-19 — single dedup point in `commitEvent`). |
| 24 | Causal trace reconstructs cast -> operation -> event -> Reaction -> payoff (sec.85) | DONE (mechanism) | `CombatScheduler.test.ts` "trace renders the causal tree from causation fields, not sequence order"; `CombatTraceExporter.test.ts` "export reconstructs a multi-root causal tree". Reaction-evaluation node kinds arrive with the reaction megaplan via the same causation fields. |
| 25 | Same initial state + same RNG seed produces identical final trace and combat state (sec.87) | DONE | Trace half: `CombatTraceExporter.test.ts` "the same scenario twice produces identical exported traces (ops, events, combatSequence)" — same scenario, two runs, deep-equal exports (operation order, event order, sequence assignment). Combat-state half: `TurnBattleSystem.rngContract.test.ts` "two battles on the same SeededCombatRng produce identical outcomes" (+ different-seed divergence guard); `rng.test.ts` SeededCombatRng sequence identity + rollChance one-consumption parity. |

## CON rows provable on this branch

| Invariant | Proof |
|---|---|
| CON-19 immediate events processed exactly once | `commitEvent` is the single dedup point (`acceptedEventIds`); named test above. |
| CON-20 scheduler alone owns combatSequence | `nextSequence`/`allocateSeq` exist only in `CombatScheduler.ts` (grep-verified); ops stamp at execution-start, events at enqueue-commit — "op sequence is allocated at execution-START" test. |
| CON-22 all runtime mutations causally traceable | Every executed op lands in `trace.records` with `origin` causation fields; every event lands in `trace.events` with `causationOperationId`/`causationEventId`; `CombatTraceExporter.test.ts` reconstructs the graph from those fields. |
| CON-23 no path-specific special-case logic | The op union is 16 generic members; `contracts/` + `runtime/` contain path ids (hoa_an/dung_kim/cam_cong/...) only in comments and test fixtures — no production branch on them (grep-verified). |
