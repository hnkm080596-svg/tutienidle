# Buff System Reimagined — Implementation Megaplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Non-trivial production missions MUST follow `game/docs/architecture/architecture-worker-workflow.md` (G0–G5) and return the G5 evidence report.

> **Review revision:** v3 — incorporates code review round 2 (verdict REQUEST CHANGES on `5a7f21b1`: 5 BLOCKER / 6 HIGH / 4 MEDIUM). Fixes in this revision:
> - **BLOCKER 1 (contract):** `ctx.combatSequence` was unfillable — the executor built the ctx but never received `opSequence`. Contract v7.2: scheduler builds the complete ctx, `execute(op, ctx)`; batch entries run via the injected `executeEntry` lane.
> - **BLOCKER 2:** lifecycle now has a SECOND settle — Phase B emits lifecycle domain events then `settle()` again, so reactions to expiry/removal/conversion resolve inside the same root transaction (spec §28.7–8).
> - **BLOCKER 3:** `BuffCapability` is no longer a typed union inside buff2 — buff2 holds the generic contract `CapabilityGrantDefinition {id, type, payload: unknown}` (spec §47 verbatim); typed payloads (`reactive_proc`, `the_economy`, …) live in the OWNING domains (`core/proc/`, `core/path/the-tu/`) and are enforced via `CapabilityValidatorRegistry`. Buff core holds zero Thể Tu/path vocabulary.
> - **BLOCKER 4:** snapshot recaptured on EVERY successful apply (incl. reapply) AFTER source-ownership resolution — a `per_target` transfer can never leave `sourceId=B` with `snapshot=stats(A)`.
> - **BLOCKER 5 (contract):** `PeriodicRequestsCommitted.holderId` → `trigger {type: PeriodicTriggerKind, anchorEntityId?}` — source-turn anchors and battle-wide `onTimePassed` now express cleanly; requests are self-contained.
> - **HIGH 1:** `uses` consumption is resolution-gated — requests carry `requestId`, generated ops are `periodic.${requestId}`, `settle()` returns opId→status; only `'resolved'` ops consume (a skipped tick never burns the modifier). Marks are computed per-request inside Phase A so earlier crossings in one `onTimePassed` batch don't double-fold.
> - **HIGH 2:** Phase B revalidates every collected instance via `store.get(instanceId)` after the barrier — stale references are skipped, never mutated.
> - **HIGH 3:** zero-stack rule generalized — ANY stacks mutation at 0 removes the instance (`removeStacks`/`setStacks` → `'consumed'`; `consumeStacks` → its passed reason).
> - **HIGH 4:** interval multi-crossing locked — `floor(elapsed/interval)` requests per `onTimePassed`, sequential request computation, remainder carries.
> - **HIGH 5:** capability execution moves to a new narrow owner — `core/proc/CombatProcSystem` — created at M4, not hosted in `TurnBattleSystem` (no interim proc engine inside the turn engine).
> - **HIGH 6:** `gauge_delta` fires from the `buff_applied` event (immediate handler → `PushGaugeOperation`) — only a committed application pushes gauge; failed rolls can't.
> - **HIGH 7:** Final specs synced — contract spec v1.2 addendum + buff spec v1.1 addendum record every locked delta (result shapes, periodic-event supersession, uses/snapshot/interval/capability semantics).
> - **MEDIUM 1–4:** `remove()` returns `RemoveBuffResult`; `snapshotFields` are validated against the damage profile's declared snapshot schema (profile owns the semantics, not the def author); M4 is documented as an atomic worktree mission (file-level compile-red between data flip and consumer cutover is expected — the gate is mission-level); R-B7 conversion suppression is LOCKED (continuation, not a new application — reaction may observe `buff_applied` directly if ever needed).
>
> v2 — incorporates code review round 1 (verdict REQUEST CHANGES: 10 BLOCKER / 10 HIGH / 4 MEDIUM). Fixes in that revision:
> - **BLOCKER 1:** proc/reactive/economy execution REMOVED from buff2 entirely — `on_hit_proc`/`reactive_trigger`/`reactive_proc`/`reactive_economy`/`the_economy`/`gauge_delta`/`dot_recovery`/marker-flags migrate to typed `capabilities` descriptors (spec §47); owning systems (turn-engine proc lane, gauge lane, damage adapter) consume them. `rollOnHitEffects`/`rollReactiveTrigger` are NOT ported (spec §66/§73 deletion list).
> - **BLOCKER 2:** stacking split back into spec §9's two independent axes (`onReapplyStacks` × `onReapplyDuration` + `replaceInstanceOnReapply`).
> - **BLOCKER 3:** lifetime split into spec §17–20's three independent concepts (`clock` / `duration?` / `scaling` + `removeOnSourceDeath`); `fixed_holder_turns` becomes `{clock:'holder_turns', scaling:'fixed'}`; `duration` optional and absent for `permanent`.
> - **BLOCKER 4:** lifecycle surface completed to spec §21/§67 — `onHolderTurnStart`/`onSourceTurnStart` added, `onEntityDeath` (unified), `setStacks`/`setRemainingDuration`/`cleanse` added, full periodic `timing` set incl. `interval`.
> - **BLOCKER 5:** natural periodic ordering now has an EXPLICIT barrier — `BuffLifecycleContext.settle()` separates the periodic-request phase from the lifetime-advance phase (spec §28); a buff can no longer expire before its last tick's damage settles.
> - **BLOCKER 6:** periodic resolver no longer reads offensive stats — it computes `authored coefficient × stackScaling × BuffModifiers` and emits the contract request; DamageSystem resolves live stats via `damageProfile` (spec §23–24). The stats port is restricted to application resolution + snapshot capture.
> - **BLOCKER 7:** `BuffPeriodicDefinition` carries `damageProfile`/`canCrit`/`canMiss`/`hitCount` — the request is fully formed from definition + instance.
> - **BLOCKER 8:** snapshot scaling restored — `scaling:'snapshot'` + `snapshotFields` on the def, `instance.snapshot` captured at apply, `request.snapshot` rides the request (contract v7.1).
> - **BLOCKER 9:** modifier resolution order corrected to spec §31 — BASE → ADD → MULTIPLY → SET (set: highest priority, stable modifier-id tiebreak).
> - **BLOCKER 10:** death semantics corrected — `onEntityDeath` removes EVERY instance targeting the dead entity (reason `death`, unconditional); `source_death` stays conditional on `removeOnSourceDeath`. `dispellable` + `cleanse()` added; `CleanseBuffOperation` lands via contract amendment v7.1. Application chance uses spec §12's multiplicative formula (no legacy additive carry-over). No compatibility adapter, no dual-run (spec §73) — data migrates first, consumers cut, old authority deleted.
> - **HIGH 1–10:** `holderId` dropped (canonical subject = `targetId`); `per_target` keeps one instance with `sourceOwnership` transfer; `readSeq` replaced by `ctx.combatSequence` (v7.1); elemental event gated by `ElementalStateRegistry` canonical check (contract §19–20); canonical §55 comparator locked for all multi-instance sweeps; registry validation expanded to spec §56 full list; `duration`/`application_chance` channels have real consume sites; `buff_periodic_resolved.amount` removed (request event is the buff-side fact; Damage/Heal own actual amounts); persistent mode gets its own sink/sequence story (and R2 corrected — the persistent buff pool is `GameManager.buffPool`, NOT `player.persistentTimedEffects`); `battleId` minted at the composition root, never derived from `rootActionId`.
> - **MEDIUM 1–4:** `kind:'stance'` and `instanceScope:'all'` removed (not in spec §6/§7, no consumer); snapshots are deep-frozen copies; `BuffHooks` dropped (not in spec — consumers subscribe to domain events); resolver consumes exactly one `rollChance` per apply even at chance 0/≥1 (contract rng parity).

**Goal:** Rebuild the canonical buff authority as `core/buff2/` — a single battle-scoped `BuffInstance` store with real `instanceId`s, per-resolution `BuffPeriodic` recipes resolved to typed damage/heal **requests** (replaces apply-time DoT snapshot AND direct `applyDotDamage` calls), a `BuffModifier` layer with identity/reapply/lifetime (replaces `scaleBuffPotency` mutation), explicit spec-§21 lifecycle entry points (replace the catch-all `update()`), domain-event emission (`ElementalApplicationCommitted` gated on canonical elemental state), and spec §6 definition fields (`instanceScope`/`stacking`/`lifetime`/`application`/`periodic`/`statModifiers`/`controls`/`capabilities`/`dispellable`/`forbiddenActionTags`) — then cut over EVERY consumer and delete the old pool-authority model.

**Architecture:** New package `game/src/core/buff2/` implementing the spec's two-layer model: `BuffDefinition` (immutable authored data — no runtime mutation, no catch-all `effects` union) + `BuffInstance` (mutable runtime: `instanceId`/`stacks`/`remaining`/`modifiers`/`snapshot`). `BuffSystem` is the ONLY mutation authority; reads go through narrow query methods returning deep-frozen `BuffInstanceSnapshot`s. BuffSystem executes NO proc/reactive/economy mechanics — those are `capabilities` descriptors on the definition, consumed by their owning systems (spec §47–48). Periodic execution emits `PeriodicRequestsCommitted` carrying `BuffPeriodicDamageRequest`/`BuffPeriodicHealRequest`; the scheduler's built-in handler converts each request 1:1 into `deal_damage`/`heal` ops settled in the same barrier — buff2 never imports a damage authority. `ApplicationResolver` owns the application roll: spec §12 multiplicative chance, one `CombatRng` consumption per apply, instance-scope resolution, stack cap, duration resolution — Skill/Reaction never roll.

**Tech Stack:** Vue 3, TypeScript, Vite, Vitest, Pinia, Phaser.

**Specs:**
- `game/docs/specs/2026-09-17-buff-system-reimagined-spec.md` (v1.0 — THE source of truth; section numbers below cite it)
- `game/docs/specs/2026-09-17-combat-systems-contract-spec.md` (v1.1 — `ApplyBuffRequest`/`ApplyBuffResult`, removal reasons, event payloads, batch semantics; supersedes conflicting points in the buff spec)
- `game/docs/specs/2026-09-17-reaction-system-reimagined-spec.md` (consumed surface: `BuffInstanceSnapshot.instanceId`, `ConsumeStacksResult`, modifier `reapply:'max'`/`buff_lifetime`, per-source instances)
- `game/docs/specs/2026-09-17-skill-definition-system-spec.md` (`ApplyAilment`/`TriggerAilmentTick`/`ConsumeAilment` operations map onto the contract buff ops)

**Sibling-plan dependency:** Expansion of the buff scope in `game/docs/superpowers/plans/2026-09-17-combat-systems-reimagined.md` (its M3–M4). **Hard prerequisite:** the contract megaplan's M1–M2 **including the v7.1 amendments below** must have landed (`game/src/core/battle/contracts/**`, `core/battle/runtime/scheduler/**`). M0 verifies; if absent → BLOCKED — do not re-declare `ApplyBuffRequest`/`ApplyBuffResult`/`ConsumeStacksResult`/`CombatRng`/events locally (contract plan §Canonical-names owns them; buff2 fills the *implementations*).

## Required contract amendments (landed in contract megaplan v7.1 + v7.2)

These were gaps the buff spec exposes in the contract surface — additive only, no v7 semantics changed. Buff M0 verifies each:

1. **`CleanseBuffOperation` + `SetBuffStacksOperation` + `SetBuffDurationOperation`** in the `CombatOperation` union, matching result members, and `BuffAuthority.cleanse`/`setStacks`/`setRemainingDuration` port methods — spec §36/§38/§42/§67 require the APIs; contract §8 requires ops to reach them. `BuffCleanseQuery`/`CleanseResult`/`RemoveBuffResult` types live in `contracts/`.
2. **`CombatAuthorityExecutionContext.combatSequence`** — the executing op's own execution-start allocation (contract r6). Read channel for `BuffInstance.createdSequence`/`lastAppliedSequence`; replaces the rejected `readSeq` port. **v7.2:** the SCHEDULER builds the ctx (`execute(op, ctx)` — the executor pure-routes; batch entries via the injected `executeEntry` lane), so the field is always populated.
3. **`createLifecycleSink(rootActionId)` → `{sink, sequence, settle}`** — allocates the root transaction's `combatSequence` at creation; `BuffLifecycleContext` carries it so lifecycle-created instances (convertsToId) get a truthful `createdSequence` without touching scheduler internals. **v7.2:** `settle()` drains the scheduler and returns `ReadonlyMap<CombatOperationId, status>` for ops executed during that call — the spec-§28 barrier AND the uses-consumption correlation channel.
4. **`BuffPeriodicDamageRequest.snapshot?: Readonly<Record<string, number>>`** — carries the apply-time captured offensive context for `scaling:'snapshot'` periodics (spec §25); DamageSystem resolves against it instead of live source stats.
5. **Buff domain events** (`BuffApplied`/`BuffStacksChanged`/`BuffDurationChanged`/`BuffModifierAdded`/`BuffModifierRemoved`/`BuffRemoved`) join `CombatEventPayload`/`PendingCombatEvent` by editing the closed unions in `contracts/events.ts` — the declared mechanism for sibling plans (contract v4+).
6. **v7.2 — `PeriodicRequestsCommitted.holderId` → `trigger {type, anchorEntityId?}`** (BLOCKER 5); requests carry emitter-minted `requestId`, generated ops named `periodic.${requestId}` (HIGH 1 correlation).
7. **v7.2 — `remove()` → `RemoveBuffResult`** (spec §53 no-void rule).
8. **v7.2 — `contracts/capability.ts` gains `CapabilityGrantDefinition`/`ActiveCapabilityGrant`/`CapabilityType` + `runtime/capability/CapabilityValidatorRegistry`** (BLOCKER 3 — generic grants, owner-registered payload validators).

## Global Constraints

- **One canonical authority.** This replaces `BuffSystem`+`BuffPool` in `core/buff/` — the codebase already retired `TurnBuffSystem`/`TurnBuffPool` impls (only their *test files* remain, importing `core/buff` — verify + rename in M5). No third store.
- **Per-entity pools → single battle store.** Today every `TurnBattleParticipant.buffs` is a private `BuffPool`; new `BuffSystem` owns ALL instances battle-wide keyed by `instanceId` (`buff.${battleId}.${n}`), queryable by target/source/definition. This is the deepest cut — M0's consumer census drives the migration map.
- **No compatibility layer, no dual-run, no fallback (spec §73).** M4 migrates ALL `data/buff/` definitions to the new shape FIRST (mechanical), then cuts consumers, then deletes the old package. No `LegacyBuffDefinitionAdapter`, no legacy `TurnReactionManager` bridge left firing.
- **Effects carry no magnitudes; procs are descriptors (spec §10, §22, §47).** The legacy `effects` catch-all splits into spec fields: `dot` → `periodic[]` recipe; `statModifier` → `statModifiers[]`; `cc` → `controls[]`; `onHitProc`/`reactiveTrigger`/`reactiveProc`/`reactiveEconomy`/`theEconomy`/`gaugeDelta`/`dotRecovery`/marker-flags → `capabilities[]` descriptors. BuffSystem exposes them via `getCapabilities(targetId)` and NEVER executes them.
- **BuffSystem computes no combat math (spec §23).** No armor/resistance/elemental-power/crit/HP access in periodic paths. The periodic resolver folds `coefficient × stackScaling × modifiers` into a request; `damageProfile` + live stats resolve downstream in DamageSystem.
- **No RNG in buff2 except the application roll** — one `CombatRng`, consumed by `ApplicationResolver`, exactly one `rollChance` per apply (contract rng semantics: a roll is consumed even at chance ≤0/≥1 — stream parity). Proc/reactive rolls move to their consuming systems.
- **Deterministic ordering everywhere (spec §55).** Every multi-instance sweep (periodic collection, expiry, death, cleanse, stat projection) sorts by the canonical comparator — never Map insertion order.
- **Explicit lifecycle barriers (spec §26/§28).** Periodic-capable entry points take `BuffLifecycleContext` and settle TWICE: after the periodic phase (damage/heal ops resolve before lifetime advances) and after lifecycle-event emission (reaction/proc consequences resolve in the same root transaction). `triggerPeriodic` (manual) never advances lifetimes.
- **Legacy observable behavior preserved unless spec changes it:** `convertsToId`/`convertsAtStackCap`, `clearsCcOnApply`, `uniquePerTarget`→`per_target`, duration scaling incl. `fixed`, ailment resist cap 0.75, reflect/proc/economy *descriptors* (execution moves to owners). Spec CHANGES that must not be silently preserved: application formula (§12), unconditional death removal (§40), single-instance `per_target` with ownership transfer (§7), snapshot periodic (§25).
- **No ấn authoring** — fixture ids `test_*` for reaction-facing definitions; the real five are seal-batch scope.
- **P3:** quick per mission; **full mandatory for M4/M5** (cuts live `TurnBattleSystem` paths). **P4** quick per mission, deep at M4/M5. **P5** round per mission. **P7** commits need explicit authorization. **P13/P14** Playwright real battle at M4/M5 — run from the implementation worktree.
- **Per-mission report:** changed / files / authority moved / tests / build status / behavior changes / risks / next.

## Canonical names (locked across sibling plans)

**Consumes (contract plan owns — never redefine locally):** `CombatRng`, `CombatOperationOrigin`, `CombatOperation` (ops targeting this system: `ApplyBuffOperation`, `AddBuffStacksOperation`, `RemoveBuffStacksOperation`, `ConsumeBuffStacksOperation`, `SetBuffStacksOperation` (v7.1), `AddBuffModifierOperation`, `RemoveBuffModifierOperation`, `RefreshBuffDurationOperation`, `ExtendBuffDurationOperation`, `SetBuffDurationOperation` (v7.1), `TriggerBuffPeriodicOperation`, `RemoveBuffOperation`, `CleanseBuffOperation` (v7.1)), `ApplyBuffRequest` (contract §15 shape verbatim — `stacks`/`baseChance`/`reactionEligibility`/`origin` all present), `ApplyBuffResult`, `ConsumeStacksResult`, `BuffInstanceSelector` (discriminated union; `target_definition.targetId` — the canonical persistent subject; v7.2 renamed from `holder_definition`), `BuffRemovalReason`, `BuffCleanseQuery`, `CleanseResult` (v7.1), `ElementalApplicationCommitted`, `BuffApplicationFailedEvent`, `PendingCombatEvent` + `CombatEventSink`, `BuffPeriodicDamageRequest`/`BuffPeriodicHealRequest`/`PeriodicResolution` (contract `periodic.ts`), `PeriodicRequestsCommitted` (contract `events.ts` — the periodic bridge; carries `trigger {type, anchorEntityId?}` — v7.2), `CombatAuthorityExecutionContext` (carries `{operationId, origin, events, combatSequence}` — v7.1/v7.2), `BuffAuthority` port, `CapabilityGrantDefinition`/`ActiveCapabilityGrant`/`CapabilityType`/`CapabilityValidatorRegistry` (v7.2), `PeriodicTriggerKind` (v7.2), `ElementalStateRegistry` (contract §19 — canonical elemental-state lookup), `ElementType`.

**Produces (everyone else imports):** `BuffDefinition` (spec §6 shape), `BuffInstance`, `BuffInstanceId` minting, `BuffInstanceSnapshot`, `BuffSnapshotData`, `BuffModifier`, `BuffModifierChannel`, `BuffModifierLifetime`, `BuffPeriodicDefinition` (`PeriodicDamageDefinition`/`PeriodicHealDefinition`), `BuffStatModifierDefinition`, `BuffControlDefinition`, `BuffQuery`/`BuffReadPort`, `ApplicationResolver`, `BuffLifecycleContext`, buff `CombatEventPayload` members (`BuffApplied`/`BuffStacksChanged`/`BuffDurationChanged`/`BuffModifierAdded`/`BuffModifierRemoved`/`BuffRemoved` — edited into the closed union per amendment 5), `BuffSystem` (buff2 — `BuffAuthority` + `BuffReadPort` impl), `BuffRegistry` (buff2), `BuffPersistence` (standalone out-of-battle pool mode), `BuffTestFixtures` (owns `test_*` ids — shared naming with the reaction plan's fixtures).

## Ruling assumptions — pending user sign-off

| # | Assumption | Rationale |
|---|---|---|
| R1 | There is NO separate turn-native impl to absorb — `TurnBuffSystem.ts`/`TurnBuffPool.ts` were retired; tests under `core/battle/turn/TurnBuff*.test.ts` already exercise `core/buff`. | Verified: `TurnBuffSystem.test.ts` imports `../../buff/BuffSystem`. buffs.md doc is stale. |
| R2 (revised) | The out-of-battle persistent buff pool is `GameManager.buffPool`/`buffSystem` (`GameManager.ts:222-223` — the `kiep_thuong` path via `GameManagerPersistentEffectOps.applyPersistentBuff`/`updateTime`). It migrates to `BuffPersistence` — a standalone per-player pool with its own sink + local sequence, no scheduler. **`player.persistentTimedEffects` is NOT a buff pool** (`PersistentTimedEffect[]`, deadline-`expiresAtMs` authority — pills/Tu Linh Tran) and stays untouched. | Spec gap noted in spec header; census confirms the two systems are distinct. |
| R-B1 (revised) | `BuffInstanceId` format `buff.${battleId}.${counter}` — minted by buff2, never by callers. **`battleId` is minted at the composition root** (`GameManagerTurnBattleOps`, alongside `CombatScheduler`+cycle `CombatRng`) and passed to the BuffSystem ctor — NEVER derived from `rootActionId` (a per-transaction id: `action.turn.N.*`/`status.turn.N.*`). Persistent mode: `buff.persistent.${ownerId}.${counter}` with a local counter. | Reaction preconditions need stable ids across a settlement barrier; per-transaction roots change every action — they are the wrong scope. |
| R-B2 | DoT under the new model = `periodic[{type:'damage', timing:'holder_turn_end', scaling:'dynamic', stackScaling:'multiply', damageProfile:'legacy_dot'}]` (matches today's tick site `TurnBattleSystem.ts:1110`); wall-clock effects use `timing:'interval'` + `clock:'seconds'`. Dynamic resolution replaces the apply-time snapshot; `scaleBuffPotency`-dependent content (Cong Minh amp) migrates to `AddBuffModifier {channel:'potency', reapply:'max', lifetime:'buff_lifetime'}` — `potencyAmplified` dies. `armorIgnorePercentByRealm` becomes a request `tags` entry honored by the damage profile. | Spec §22/§24/§29–31; preserves Cong Minh semantics ("amplify once, strongest wins") as data. |
| R-B3 (revised — LOCKED by review) | Application chance = spec §12 multiplicative formula: `finalChance = clampChance(baseChance × sourceApplicationModifier × targetResistanceModifier)` where `sourceApplicationModifier = (1 + source.elementApplicationPercent) × applicationChanceChannelFactor(resolved instance's modifiers)` and `targetResistanceModifier = (application.resistance==='ailment') ? 1 − min(0.75, max(0, target.ailmentResistPercent)) : 1`. Clamp `[0,1]` unless `application.clampChance === false`. Exactly ONE `rng.rollChance` per apply, always consumed. The legacy additive `base + elementApplicationPercent` (`AilmentChance.ts`) is NOT carried over — this is a deliberate spec-directed behavior change; numeric re-tune is seal-batch scope. | Review ruling: "chốt formula mới ngay; đừng mang legacy ailment roll sang buff2". |
| R-B4 (revised) | `instanceScope`: `'per_source'` (default — legacy `(id,sourceId)` pool key) or `'per_target'` (replaces `uniquePerTarget`). `per_target` keeps ONE instance on the target: reapply by a new source transfers `sourceId` per `sourceOwnership` (default `'latest'`) and applies the stacking axes — the `instanceId` STAYS STABLE (reaction preconditions key on it). No `'all'` scope — not in spec §7, no consumer. | spec §7; reviewer HIGH — "remove old + create new" broke instance identity. |
| R-B5 | `stat_modifier` effects project as `StatModifier[]` via `getStatModifiers(targetId)` — same shape as legacy `getActiveModifiers` (incl. `stacks` and `sourceType` derived from `polarity`); the `liveStatModifiers` closure consumer keeps its shape. The `potency` modifier channel scales projected magnitudes (Cong Minh parity). | The ops-layer modifier closure contract is preserved; buff2 changes the source, not the projection. |
| R-B6 | `forbiddenActionTags` lives on `BuffDefinition` — consumed by the reaction plan's `ActionValidator`; `hasForbiddenTags(entityId)`/`hasControl(targetId, cc)` are read-only queries. | Contract §6/§71–72. |
| R-B7 | `convertsToId` re-application goes through the same `apply()` path with `reactionEligibility:'suppressed'` and a lifecycle-scoped ctx (`lctx.events` mints `evt.${rootActionId}.${n}`, no causationOperationId — lifecycle scope). Removal reason for the converted instance: `'replaced'`. `convertsAtStackCap` preserves legacy reach-cap conversion (`stack` mode, `nextStacks >= maxStacks`). | LOCKED (round 2): conversion is a continuation, not a new application — suppressed is the semantic. |
| R-B8 (new) | **Lifecycle barrier protocol.** Periodic-capable entry points (`onHolderTurnStart/End`, `onSourceTurnStart/End`, `onRoundEnd`, `onTimePassed`) take `BuffLifecycleContext {rootActionId, sequence, events, settle(): ReadonlyMap<opId, status>}` — produced by `scheduler.createLifecycleSink` (v7.2). Internal order: collect+sort periodics → compute requests (sequential, pending uses-marks) → emit `PeriodicRequestsCommitted` → **`settle()` (barrier 1)** → revalidate instances → commit/release uses-marks per resolved op status → modifier/buff lifetimes + conversion + expiry → emit lifecycle events → **`settle()` (barrier 2 — reaction/proc consequences resolve in-root)**. | Spec §28 canonical order requires periodic *resolution* before lifetime advancement AND reaction resolution after event publication; under the request bridge both are explicit barriers. |
| R-B9 (revised) | **Snapshot periodic.** `scaling:'snapshot'` + `snapshotFields: readonly string[]` on the def — validated ⊆ the damage profile's declared snapshot schema (profile owns the semantics — MEDIUM 2). `apply()` captures the listed source stats into `instance.snapshot.stats` **on EVERY successful apply — creation AND reapply — AFTER source-ownership resolution** (BLOCKER 4: `sourceId` and `snapshot` can never disagree); each tick emits the request with `snapshot` attached (v7.1). | Spec §25 + addendum §4; contract amendment carries the field. Legacy parity: `damagePerTurn` recomputed per apply anyway. |

---

## Mission 0 — Inventory + prerequisite verification (read-only)

**Files:**
- Create: `game/docs/architecture/2026-09-17-buff-inventory.md`

- [ ] **Step 1 — Lock baseline:** `git rev-parse HEAD`.
- [ ] **Step 2 — Verify contract prerequisites (BLOCKING):** `contracts/operations.ts` buff op subset **incl. v7.1 additions** (`SetBuffStacksOperation`/`SetBuffDurationOperation`/`CleanseBuffOperation`/`BuffCleanseQuery`/`CleanseResult`/`RemoveBuffResult`) + `BuffInstanceSelector`/`ApplyBuffRequest`/`ApplyBuffResult`/`ConsumeStacksResult`; `contracts/results.ts`; `contracts/events.ts` `ElementalApplicationCommitted`/`BuffApplicationFailedEvent` + **`PeriodicRequestsCommitted.trigger` (NOT `holderId`)**; `contracts/rng.ts` `CombatRng`; `contracts/capability.ts` **`CapabilityGrantDefinition`/`ActiveCapabilityGrant`/`CapabilityType`**; `contracts/elemental.ts` `ElementalStateRegistry`; `contracts/context.ts` `CombatAuthorityExecutionContext` **with `combatSequence`**; `contracts/periodic.ts` requests **with `snapshot?` + `requestId`**; `runtime/scheduler/CombatOperationExecutor.ts` — **`execute(op, ctx)` signature (scheduler builds ctx)** — + `BuffAuthority` port (all methods take ctx, **incl. `setStacks`/`setRemainingDuration`/`cleanse`, `remove` → `RemoveBuffResult`**); `CombatScheduler.enqueueEvent`/`enqueueAuthored`/`createLifecycleSink` **returning `{sink, sequence, settle}`**; `runtime/capability/CapabilityValidatorRegistry`; `runtime/elemental/ElementalStateRegistryImpl` (all-5 canonical mapping). Missing → BLOCKED.
- [ ] **Step 3 — BuffPool/BuffSystem consumer census (drives M4):**
  - **Pools:** every `new BuffPool()` site — `TurnBattleParticipant.buffs` field decl (`TurnBattleSystem.ts`; `TurnBattleAdapter.ts` build), allies' pools, **`GameManager.buffPool` (`GameManager.ts:222`)** — the persistent buff pool (distinct from `player.persistentTimedEffects`), `pendingGaugeDeltaTargets`/`pendingGaugeDeltaDefinition` path (`:486-487`, `:1996`, `:2825-2831`).
  - **Holder==target invariant check (BLOCKING):** audit EVERY apply lane (`:1110` tick, `:1824` appliesBuffs, `:2973` ailment lane, proc lanes, `GameManagerTurnBattleOps:1046/1252/1276`, grantsAtBuild, external-ward grants, `applyPersistentBuff`) — confirm every applied instance lands in the pool of the entity its `targetId` names. Any pool-owner≠targetId case must be recorded: it decides whether `targetId` alone can absorb the "holder" role (expected: yes — ARCH-009 already routes proc'd buffs to the victim's pool).
  - **Reads:** `getActiveModifiers` consumers (`liveStatModifiers` closure `:470`, `recomputeEffectiveStats`), `getStacks`/`getFromSource`/`getAllById`/`hasAny` call sites (skill conditions, detonate `dot` scan, `consumesAilmentId` reads, UI `buffState` snapshot in `action_executed` payload → `BattleFloatingStatusBar`/`battleHUDStore`), CC queries `isStunned/isFrozen/isRooted` (`declareActorAction` CC check ~`:960+`), `clearCcEffects` (Bá Thể), proc rollers `rollOnHitEffects` (`:1824`) / `rollReactiveTrigger` (`:1834`) call sites, `dotRecoveryTriggers` consumption in `CombatSystem.applyDotDamage` (`:600`, via `resolveSourceBuffs` `:1089`), `renewWithExtension` callers.
  - **Writes:** every `new BuffSystem(pool).apply(...)` site (above), `remove`/`removeAllById` (cleanse lanes, detonate, `consumesAilmentId`), `reactionManager.checkAndTrigger` invocation at `:2979` (to be REMOVED — reaction consumption is the reaction megaplan's).
  - **Executing-effect consumers:** who reads `onHitProc`/`reactiveTrigger`/`reactiveProc`/`reactiveEconomy`/`theEconomy`/`gaugeDelta`/`dotRecovery` payloads today (turn engine lanes, TheTu economy, gauge, CombatSystem) — each becomes a `capabilities` consumer; map consumer → capability type.
- [ ] **Step 4 — Data census:** every file under `game/src/data/buff/` — count defs per `stackMode`, defs using `convertsToId` (te_cong→dong_bang chain), `convertsAtStackCap` candidates (stack-mode + convertsToId), `uniquePerTarget` (taunt, son_nhac_ho_the), `clearsCcOnApply` (Bá Thể), `durationPolicy:'fixed_holder_turns'` (Thế Tu kit → `{clock:'holder_turns', scaling:'fixed'}`), `element:` field (current ailments — `bong`,`trung_doc`,`chay_mau`,`te_cong`,`hoai_tu`,`thach_hoa` — and whether each is a CANONICAL elemental state per `ElementalStateRegistry` or just element-tagged), marker/theEconomy/reactiveProc/reactiveEconomy carriers (~230 lines in `TheTuBuffs.ts`), `dotRecovery` (Độc Căn inside `trung_doc`), `gaugeDelta`, `dot` (`dpsRatio`/`armorIgnorePercentByRealm`), `duration` semantics per def (turns vs seconds — wall-clock defs map to `clock:'seconds'`). **`convertsAfterContinuousSeconds` check (BLOCKING if any battle def uses it):** `continuousSeconds` now advances ONLY on `onTimePassed` — a battle-scoped def that relied on the legacy dual-increment (update(deltaSeconds=1) bumped both counters per turn) must be remapped to `convertsAfterContinuousTurns` or flagged. Output: per-file def-id table → migration mapping.
- [ ] **Step 5 — Effect/capability usage matrix:** which of the 11 `BuffEffectTemplate` kinds are used by which def — each maps to a spec field or a capability-grant `type` + typed payload (owner-module schema); no silent drops.
- [ ] **Step 6 — Write authority matrix + R1/R2/R-B1..R-B9 table** for sign-off.

**Exit criteria:** every consumer + every definition accounted; prereqs verified (incl. v7.1); holder==target invariant proven or exceptions listed; stale-doc note recorded (`docs/systems/buffs.md` claims TurnBuffSystem exists).

---

## Mission 1 — buff2 types + store + queries (no behavior, pure model)

**Files:**
- Create: `game/src/core/buff2/BuffDefinition.ts` — spec §6 shape
- Create: `game/src/core/buff2/BuffInstance.ts` — spec §8 runtime instance + `BuffInstanceSnapshot`
- Create: `game/src/core/buff2/BuffModifier.ts` — spec §29/§33 modifier types
- (no `BuffCapability.ts` — grants are the contract's generic `CapabilityGrantDefinition`; typed payloads live in owner modules, see M1 capability note)
- Create: `game/src/core/buff2/BuffStore.ts` — battle-scoped instance store (the pool replacement)
- Create: `game/src/core/buff2/BuffQuery.ts` — `BuffReadPort` read surface (spec §51)
- Create: `game/src/core/buff2/BuffRegistry.ts` — definition catalog + spec §56 startup validation
- Create: `game/src/core/buff2/testing/BuffTestFixtures.ts` — fixture world builder (owns `test_*` ids — shared naming with reaction plan's fixtures module; this plan creates them, reaction plan imports)
- Test: `BuffStore.test.ts`, `BuffRegistry.test.ts`, `BuffQuery.test.ts`

**Interfaces — Produces (exact shapes):**

```ts
// BuffDefinition.ts — spec §6–9, §11, §17–20, §22, §42, §44, §47; immutable authored data.
// NO `effects` union — each legacy effect kind has a spec-shaped home or a capability.
export type BuffKind = 'buff' | 'debuff' | 'ailment' | 'marker'            // spec §6 — no 'stance'
export type BuffInstanceScope = 'per_source' | 'per_target'               // spec §7 — no 'all'
export type BuffSourceOwnership = 'latest' | 'first'                      // per_target reapply policy (spec §7)

// spec §9 — stacks and duration are INDEPENDENT axes (Hỏa Ấn = add + refresh)
export interface BuffStackingDefinition {
  maxStacks: number                        // >= 1 (registry-validated; legacy uncapped stackers get an authored cap per census)
  onReapplyStacks: 'add' | 'replace' | 'keep'
  onReapplyDuration: 'refresh' | 'keep' | 'extend'
  replaceInstanceOnReapply?: boolean       // legacy stackMode:'replace' parity — default false keeps instanceId stable
}

// spec §17–20 — duration amount / clock / scaling are three INDEPENDENT concepts
export type BuffLifetimeClock = 'holder_turns' | 'source_turns' | 'rounds' | 'seconds' | 'permanent'
export type BuffDurationScaling = 'fixed' | 'ailment_scaled'
export interface BuffLifetimeDefinition {
  clock: BuffLifetimeClock
  duration?: number                        // required unless clock==='permanent' (validated); absent for permanent
  scaling: BuffDurationScaling
  removeOnSourceDeath?: boolean            // default false — spec §41
}

// spec §11 — whether target resistance gates the application roll
export interface BuffApplicationDefinition {
  resistance: 'none' | 'ailment'
  clampChance?: boolean                    // default true → clamp [0,1]
}

// spec §22 — periodic recipe. DamageSystem owns the combat formula via damageProfile;
// the def carries everything the contract request needs (review BLOCKER 7).
export interface PeriodicDamageDefinition {
  id: string
  type: 'damage'
  element: ElementType | 'physical'
  damageProfile: string                    // DamageProfileId — profile owns stats/mitigation/crit channel
  coefficient: number                      // authored scalar (legacy `dpsRatio` → this field)
  scaling: 'dynamic' | 'snapshot'          // spec §24/§25
  snapshotFields?: readonly string[]       // REQUIRED iff scaling==='snapshot' — source stat keys captured at apply
  timing: 'holder_turn_start' | 'holder_turn_end' | 'source_turn_start' | 'source_turn_end' | 'interval'
  intervalSeconds?: number                 // REQUIRED iff timing==='interval' (validated)
  stackScaling: 'multiply' | 'ignore'
  canCrit: boolean
  canMiss: boolean
  hitCount: number
  tags?: readonly string[]                 // forwarded to the request (e.g. 'armor_ignore_by_realm')
}
export interface PeriodicHealDefinition {
  id: string
  type: 'heal'
  amount: number                           // flat authored amount
  timing: 'holder_turn_start' | 'holder_turn_end' | 'source_turn_start' | 'source_turn_end' | 'interval'
  intervalSeconds?: number
  stackScaling: 'multiply' | 'ignore'
  tags?: readonly string[]
}
export type BuffPeriodicDefinition = PeriodicDamageDefinition | PeriodicHealDefinition
// Union extends ONLY when real gameplay needs it — no catch-all callback (spec §22).

// Capabilities — spec §47 verbatim: buff2 stores/exposes the GENERIC grant and
// never interprets payloads (review BLOCKER 3 — no `theCost`/`counterChance`/
// `intercept` vocabulary inside core/buff2).
//   capability type on BuffDefinition: capabilities?: readonly CapabilityGrantDefinition[]
//   getCapabilities returns ActiveCapabilityGrant[]                      (contract types)
// Payload schemas are owned by the CONSUMING domains — the migration mapping is:
//   core/proc/ProcCapabilities.ts      → 'on_hit_proc' | 'reactive_trigger' payloads
//                                        + typed narrowing helpers + validator
//   core/path/the-tu/TheTuCapabilities.ts → 'reactive_proc' | 'reactive_economy'
//                                        | 'the_economy' payloads + validators
//   core/battle/gauge (or proc)        → 'gauge_delta' payload + validator
//   core/combat (dotRecovery owner)    → 'dot_recovery' payload + validator
//   marker flags                       → 'marker' payload (consumed by path/proc modules)
// Each owner registers its validator into CapabilityValidatorRegistry at
// composition; BuffRegistry validates every grant via the registry at def load
// (spec §56) — unknown type or invalid payload throws. Consumers narrow:
//   const p = theTuCaps.asReactiveProc(grant)  // typed guard in the OWNER module

export interface BuffStatModifierDefinition { stat: StatType; percent?: number; flat?: number; domain?: StatDomain }
export interface BuffControlDefinition { type: 'stun' | 'freeze' | 'root' }

export interface BuffDefinition {          // spec §6 — all fields readonly; registry freezes at load
  id: BuffDefinitionId
  name: string
  description?: string
  kind: BuffKind
  polarity?: 'buff' | 'debuff'             // StatModifier.sourceType feed — default: buff→'buff', debuff/ailment→'debuff', marker→'buff' unless declared
  element?: ElementType                    // canonical element tag (today's `element` field)
  hidden?: boolean
  instanceScope: BuffInstanceScope
  sourceOwnership?: BuffSourceOwnership    // per_target only; default 'latest'
  stacking: BuffStackingDefinition
  lifetime: BuffLifetimeDefinition
  application?: BuffApplicationDefinition
  periodic?: readonly BuffPeriodicDefinition[]
  statModifiers?: readonly BuffStatModifierDefinition[]
  controls?: readonly BuffControlDefinition[]
  capabilities?: readonly CapabilityGrantDefinition[]   // contract type — generic grants, owner-validated payloads
  forbiddenActionTags?: readonly string[]  // contract §6 — Cấm Công channel
  dispellable: boolean                     // spec §42 — cleanse() gate
  tags?: readonly string[]
  // legacy-parity lifecycle fields (not in spec §6 — documented deviations)
  clearsCcOnApply?: boolean                // strips target's control instances before own apply commits
  convertsToId?: BuffDefinitionId
  convertsAfterContinuousTurns?: number
  convertsAfterContinuousSeconds?: number
  convertsAtStackCap?: boolean             // legacy: stack-mode reapply reaching maxStacks converts instead
}

// BuffInstance.ts — spec §8. Runtime state only; no effects, no holderId, no potencyAmplified.
export interface BuffInstance {
  instanceId: BuffInstanceId               // buff.${battleId}.${counter} — battleId from composition root (R-B1)
  definitionId: BuffDefinitionId
  sourceId: CombatEntityId
  targetId: CombatEntityId                 // THE canonical persistent subject — absorbs the legacy "pool owner"/holder role
  stacks: number
  remaining?: number                       // units of lifetime.clock; undefined for permanent
  continuousTurns: number                  // convertsAfterContinuousTurns bookkeeping (holder boundaries only)
  continuousSeconds: number                // convertsAfterContinuousSeconds bookkeeping (onTimePassed only)
  modifiers: BuffModifier[]                // internal mutable — snapshots expose frozen copies
  snapshot?: BuffSnapshotData              // captured at apply when any periodic is scaling:'snapshot' (R-B9)
  intervalElapsed?: Record<string, number> // periodicId → seconds since last 'interval' tick;
                                           // NOT reset by duration refresh (accumulator ≠ lifetime)
  periodicTickCount?: Record<string, number> // periodicId → emitted-tick ordinal — mints
                                           // requestId `req.${instanceId}.${periodicId}.${n}`;
                                           // globally unique WITHOUT depending on event/root ids
                                           // (two manual triggers under one rootActionId never collide)
  createdSequence: number                  // ctx.combatSequence / lifecycle-root sequence — never readSeq
  lastAppliedSequence: number
}
export interface BuffSnapshotData { stats: Readonly<Record<string, number>> }   // source offensive context (spec §25)
// BuffInstanceSnapshot = deep-frozen readonly copy (MEDIUM 2 — Readonly<> alone is
// shallow; nested modifiers/snapshot must not be mutable through a snapshot).
```

```ts
// BuffStore.ts — replaces per-entity BuffPool. Keyed by instanceId.
export class BuffStore {
  constructor(private readonly mintInstanceId: () => BuffInstanceId)
  add(instance: BuffInstance): void
  get(instanceId: BuffInstanceId): BuffInstance | undefined
  remove(instanceId: BuffInstanceId): BuffInstance | undefined          // returns removed (events need stacks-at-removal)
  forTarget(targetId: CombatEntityId): readonly BuffInstance[]          // canonical subject index
  fromSource(sourceId: CombatEntityId): readonly BuffInstance[]
  byDefinition(definitionId: BuffDefinitionId): readonly BuffInstance[]
  find(definitionId: BuffDefinitionId, sourceId: CombatEntityId, targetId: CombatEntityId): BuffInstance | undefined   // per_source key
  findOnTarget(definitionId: BuffDefinitionId, targetId: CombatEntityId): BuffInstance | undefined                     // per_target key (any source)
  all(): readonly BuffInstance[]
}
// NOTE: iteration order is insertion — any sweep producing OBSERVABLE order
// (periodic, expiry, death, cleanse, stat projection) sorts by the spec §55
// comparator (targetId → definitionId → sourceId → instanceId → periodicId) first.

// BuffQuery.ts — spec §51 read-only surface handed to Reaction/Skill/UI/ops layer.
export interface BuffReadPort {
  getInstance(sel: BuffInstanceSelector): BuffInstanceSnapshot | undefined
  getForTarget(targetId: CombatEntityId): readonly BuffInstanceSnapshot[]
  getForSource(sourceId: CombatEntityId): readonly BuffInstanceSnapshot[]
  getByDefinition(targetId: CombatEntityId, definitionId: BuffDefinitionId): readonly BuffInstanceSnapshot[]
  getStacks(sel: BuffInstanceSelector): number
  getModifiers(sel: BuffInstanceSelector): readonly BuffModifier[]        // frozen copies
  getStatModifiers(targetId: CombatEntityId): StatModifier[]              // R-B5 — legacy StatModifier shape incl. stacks
  getCapabilities(targetId: CombatEntityId): readonly ActiveCapabilityGrant[]  // spec §51 — generic descriptors for owner systems
  hasControl(targetId: CombatEntityId, control: 'stun' | 'freeze' | 'root'): boolean  // spec §50
  hasForbiddenTags(entityId: CombatEntityId): ReadonlySet<string>         // resolves def.forbiddenActionTags over target's instances
  has(sel: BuffInstanceSelector): boolean
}
```

- [ ] **Step 1 — Failing tests (store):** keying by `instanceId`; `forTarget`/`fromSource`/`byDefinition`/`find`/`findOnTarget` filters; `findOnTarget` returns the single `per_target` instance regardless of source; remove returns the instance (event needs stacks-at-removal).
- [ ] **Step 2 — Failing tests (registry — spec §56 full list):** duplicate id throws; `maxStacks >= 1`; valid `instanceScope`; `duration` required unless `clock==='permanent'` (and absent for permanent); non-negative duration; periodic ids unique per definition; `intervalSeconds` required iff `timing==='interval'`; `snapshotFields` required iff `scaling==='snapshot'` AND ⊆ the damage profile's declared `snapshotFields` schema (profile owns the semantic keys — MEDIUM 2); valid `damageProfile` (catalog lookup port); valid `element`; valid control types; valid capability grants via `CapabilityValidatorRegistry` (registry ctor takes the validator registry — each grant's `type` must be registered and its `payload` must pass the owner's validator; e.g. `convertsToId` refs resolvable); valid modifier channels on any def-authored modifier refs; unknown `StatType` rejected; `dispellable` boolean present. Dev build throws — no silent fallback.
- [ ] **Step 3 — Failing tests (query):** snapshots are DEEP-frozen copies (mutating `snapshot.modifiers[0]` doesn't corrupt the store); `getStacks` instance/identity selectors match spec §52; `getCapabilities` returns typed descriptors; `hasControl` matches `controls[]` on `targetId` (ARCH-009 semantics — structurally impossible to misroute in a single store).
- [ ] **Step 4 — Implement** all files. **Migration mapping table** (in code comments + inventory doc): `stackMode:'stack'` → `stacking{onReapplyStacks:'add', onReapplyDuration:'refresh'}` (+`convertsAtStackCap` when convertsToId present); `'refresh'` → `{onReapplyStacks:'keep', onReapplyDuration:'refresh'}`; `'replace'` → `{onReapplyStacks:'replace', onReapplyDuration:'refresh', replaceInstanceOnReapply:true}`; `uniquePerTarget` → `instanceScope:'per_target'` + `sourceOwnership:'latest'` + `{onReapplyStacks:'replace', onReapplyDuration:'refresh'}`; `durationPolicy:'ailment_scaled'`/`'fixed_holder_turns'` → `lifetime.scaling:'ailment_scaled'`/`'fixed'`; `duration`+turn-ticks → `clock:'holder_turns'`; wall-clock → `clock:'seconds'`; `cc` → `controls[]`; `statModifier` → `statModifiers[]`; `dot` → `periodic[{type:'damage', timing:'holder_turn_end', scaling:'dynamic', stackScaling:'multiply', damageProfile:'legacy_dot', canCrit:false, canMiss:false, hitCount:1}]` (+ `tags:['armor_ignore_by_realm']` when legacy flag set); `onHitProc`/`reactiveTrigger`/`reactiveProc`/`reactiveEconomy`/`theEconomy`/`gaugeDelta`/`dotRecovery`/marker-flags → `capabilities[]` members of the same name.
- [ ] **Step 5 — Verify (P3 quick).**

**Exit criteria:** model compiles; store/query/registry proven; full legacy-field→new-field mapping written down — M4's data migration is mechanical from here.

---

## Mission 2 — Modifier engine + ApplicationResolver + BuffSystem surface

**Files:**
- Create: `game/src/core/buff2/BuffModifierEngine.ts` — apply/remove/reapply/expiry + spec §31 resolution math
- Create: `game/src/core/buff2/ApplicationResolver.ts` — spec §12 chance/duration resolution + rng
- Create: `game/src/core/buff2/BuffSystem.ts` — mutation authority (spec §67 full surface)
- Modify: `game/src/core/battle/contracts/events.ts` — edit the buff `CombatEventPayload`/`PendingCombatEvent` member shapes into the CLOSED unions (amendment 5 — contract-owned file; buff2 declares no event types locally, only emit helpers if needed)
- Create: `game/src/core/buff2/BuffLifecycleContext.ts` — `{rootActionId, sequence, events, settle}` (R-B8; `settle` = contract v7.2 `createLifecycleSink` lane)
- Test: `ApplicationResolver.test.ts`, `BuffModifierEngine.test.ts`, `BuffSystemApply.test.ts`, `BuffStacks.test.ts`, `BuffCleanse.test.ts`

**Interfaces — Produces:**

```ts
// ApplicationResolver.ts — spec §11–12; sole owner of the application roll.
export class ApplicationResolver {
  constructor(private readonly rng: CombatRng, private readonly caps?: { ailmentResistCap?: number })  // cap default 0.75
  resolve(req: ApplyBuffRequest, ctx: {
    source: { stats: { elementApplicationPercent?: number; ailmentDurationPercent?: number } }
    target: { stats: { ailmentResistPercent?: number } }
    definition: BuffDefinition
    existing?: BuffInstance            // reapply target — its modifiers feed the chance/duration channels
  }): { success: boolean; duration?: number; chance: number }
}
// Chance (spec §12 — MULTIPLICATIVE; R-B3 locked):
//   sourceApplicationModifier = (1 + (source.elementApplicationPercent ?? 0))
//                               × modifierFactor(existing?.modifiers, 'application_chance')
//   targetResistanceModifier  = def.application?.resistance === 'ailment'
//                               ? 1 − min(cap, max(0, target.ailmentResistPercent)) : 1
//   chance = baseChance × sourceApplicationModifier × targetResistanceModifier
//   clamp [0,1] unless application.clampChance === false
//   success = rng.rollChance(chance)  — ALWAYS exactly one roll, even at
//   chance ≤0/≥1 (contract rng semantics — stream parity).
// Duration (three independent concepts, spec §17–20):
//   base = req.durationOverride ?? def.lifetime.duration   (undefined for 'permanent')
//   scaling 'fixed'          → base verbatim (absorbs legacy fixed_holder_turns)
//   scaling 'ailment_scaled' → base × (1 − min(cap, max(0, target.ailmentResistPercent)))
//                              × (1 + (source.ailmentDurationPercent ?? 0))
//                              × modifierFactor(existing?.modifiers, 'duration')
// `duration`/`application_chance` channels are consumed HERE — read off the
// RESOLVED instance on reapply (a fresh apply has no instance to modify).
```

```ts
// BuffModifierEngine.ts — spec §29–35.
// Resolution order per channel (spec §31 — review BLOCKER 9 fix):
//   resolved = base
//   + Σ(all 'add' modifiers)        — ordered by (priority asc, modifierId asc)
//   × Π(all 'multiply' modifiers)   — same ordering (products commute; order locked for determinism)
//   → if any 'set' exists: the SET wins outright — highest priority;
//     priority tie → lexicographically smallest modifier id wins (locked choice).
// Reapply (spec §32): identity = modifier.id (+appliedBy where relevant);
//   'replace' overwrites same-id; 'stack' appends a distinct entry; 'max'/'min' keep extreme.
// Lifetimes (spec §33–34): 'uses' consumed by the effect resolution that reads it
//   (marked during periodic phase, removed in post-settle phase); 'holder_turns'/
//   'source_turns'/'rounds' decrement ONLY in the matching post-settle lifecycle
//   phase — never on manual triggerPeriodic; 'buff_lifetime' dies with the instance;
//   'battle' ends at onBattleEnd; 'explicit' only via removeModifier.
// Refresh isolation (spec §35): buff duration refresh NEVER refreshes modifier lifetime.
export function resolveChannel(mods: readonly BuffModifier[], channel: BuffModifierChannel, base: number): number
```

```ts
// BuffSystem.ts — spec §67 surface; every mutator takes a ctx; every lifecycle
// method takes lctx. BuffAuthority port impl + BuffReadPort impl.

// Bounded stat-read port — application resolution (§12/§19) + snapshot capture
// (§25) + liveness (Phase-B dead-target sweep) ONLY. Periodic resolution NEVER
// touches stats (BLOCKER 6).
export interface BuffStatReadPort {
  getStats(entityId: CombatEntityId): Readonly<{
    elementApplicationPercent?: number
    ailmentDurationPercent?: number
    ailmentResistPercent?: number
    [key: string]: number | undefined   // snapshotFields values read through this index
  }> | undefined
  isAlive(entityId: CombatEntityId): boolean   // post-barrier revalidation (HIGH 2)
                                             // + death-reason correctness
}

export class BuffSystem {
  constructor(
    private readonly store: BuffStore,
    private readonly registry: BuffRegistry,
    private readonly resolver: ApplicationResolver,
    private readonly stats: BuffStatReadPort,         // application resolution + snapshot capture ONLY — never periodic math
    private readonly elemental: ElementalStateRegistry, // canonical-state gate for ElementalApplicationCommitted (contract §19–20)
  )
  // NOTE: no readSeq port — createdSequence/lastAppliedSequence come from
  // ctx.combatSequence (ops) or lctx.sequence (lifecycle-created instances).
  // battleId reaches the store's mintInstanceId via the composition root (R-B1).

  // === BuffAuthority port (cross-authority surface — every method takes ctx) ===
  apply(req: ApplyBuffRequest, ctx: CombatAuthorityExecutionContext): ApplyBuffResult
  addStacks(sel, stacks, ctx): StacksResult
  removeStacks(sel, stacks, ctx): StacksResult
  setStacks(sel, stacks, ctx): StacksResult                       // spec §36 (v7.1 op + port)
  consumeStacks(sel, stacks | 'all', reason 'consumed'|'reaction', ctx): ConsumeStacksResult  // spec §37 — zero stacks → removed, passed reason
  // ZERO-STACK RULE (spec addendum §7 — HIGH 3): ANY stacks mutation landing
  // at 0 removes the instance. removeStacks/setStacks → reason 'consumed';
  // consumeStacks → its passed reason ('consumed'|'reaction'). A buff with
  // zero stacks is nothing — no stacks:0 instance may persist.
  addModifier(sel, mod: BuffModifierPayload, ctx): { applied: boolean }
  removeModifier(sel, modifierId, ctx): { removed: boolean }
  refreshDuration(sel, duration|undefined, ctx): { durationBefore: number; durationAfter: number }  // contract inline shape
  extendDuration(sel, turns, maxRemaining|undefined, ctx): { durationBefore: number; durationAfter: number }
  setRemainingDuration(sel, duration, ctx): { durationBefore: number; durationAfter: number }       // spec §38 (v7.1 op + port)
  remove(sel, reason: BuffRemovalReason, ctx): RemoveBuffResult   // spec §53/§67 — no void returns
  cleanse(targetId, query: BuffCleanseQuery, ctx): CleanseResult  // spec §42 — dispellable-only, reason 'cleansed'
  // Manual periodic trigger (spec §27/§62): commits periodic semantics +
  // emits PeriodicRequestsCommitted via ctx.events; NEVER advances lifetimes,
  // NEVER decrements turn-based modifier lifetimes; 'uses' modifiers consumed.
  triggerPeriodic(sel, periodicId|undefined, ctx): readonly PeriodicResolution[]

  // === lifecycle entry points (spec §21; replaces catch-all update()) ===
  // BuffLifecycleContext = { rootActionId, sequence, events: CombatEventSink,
  //   settle(): ReadonlyMap<CombatOperationId, CombatOperationResult['status']> }
  //   — settle() drains the scheduler AND reports which ops executed (R-B8
  //   barrier + uses-consumption correlation, contract v7.2).
  onHolderTurnStart(entityId: CombatEntityId, lctx: BuffLifecycleContext): readonly PeriodicResolution[]
  onHolderTurnEnd(entityId: CombatEntityId, lctx: BuffLifecycleContext): readonly PeriodicResolution[]
  onSourceTurnStart(entityId: CombatEntityId, lctx: BuffLifecycleContext): readonly PeriodicResolution[]
  onSourceTurnEnd(entityId: CombatEntityId, lctx: BuffLifecycleContext): readonly PeriodicResolution[]
  onRoundEnd(lctx: BuffLifecycleContext): readonly PeriodicResolution[]
  onTimePassed(seconds: number, lctx: BuffLifecycleContext): readonly PeriodicResolution[]  // 'seconds' clocks + 'interval' timing
  onEntityDeath(entityId: CombatEntityId, lctx: BuffLifecycleContext): void   // spec §40–41 — unified death
  onBattleEnd(lctx: BuffLifecycleContext): void

  // === queries (BuffReadPort impl — spec §51) ===
  getInstance / getForTarget / getForSource / getByDefinition / getStacks
  getModifiers / getStatModifiers / getCapabilities / hasControl / hasForbiddenTags / has
}
```

```ts
// contracts/events.ts (amendment 5) — every event post-commit (spec §45, contract
// §20–22). Envelope-free payloads inside the CLOSED CombatEventPayload/
// PendingCombatEvent unions. NO buff_periodic_resolved.amount — the buff-side fact IS
// PeriodicRequestsCommitted; actual damage/heal outcomes live on the deal_damage/
// heal op results (Damage/Heal authority — review HIGH: amount isn't Buff-owned).
export type BuffEventPayload =
  | { type: 'buff_applied'; instanceId; definitionId; sourceId; targetId; created: boolean }
  | { type: 'buff_stacks_changed'; instanceId; stacksBefore; stacksAfter; addedStacks }
  | { type: 'buff_duration_changed'; instanceId; durationBefore; durationAfter }
  | { type: 'buff_modifier_added' | 'buff_modifier_removed'; instanceId; modifierId }
  | { type: 'buff_removed'; instanceId; definitionId; sourceId; targetId; reason: BuffRemovalReason; stacksAtRemoval: number }
  // ElementalApplicationCommitted + BuffApplicationFailedEvent are contract-owned members.
  // spec §54's PeriodicResolution.damageResult is served by the scheduler's op
  // results (deal_damage CombatOperationResult), not a buff event — divergence note.
```

**Application flow (spec §10–16 + contract §15–22):**
```
apply(req, ctx):                          // req = contract §15 shape (stacks/baseChance/reactionEligibility/origin)
  def = registry.get(req.definitionId)    // unknown → throw (structural, contract §50)
  existing = resolve instance by instanceScope:
    per_source → find(defId, req.sourceId, req.targetId)
    per_target → findOnTarget(defId, req.targetId)     // any source — single instance
  {success, duration, chance} = resolver.resolve(req, {source, target, def, existing})
                                     // ONE rollChance — always consumed (R-B3)
  if !success: ctx.events.emit(buff_application_failed{definitionId, sourceId, targetId, reason})
               return {applied:false}  // spec §14 — no state touched, no reaction
  if def.clearsCcOnApply: strip target's control instances (reason 'cleansed') BEFORE own commit
  mutate:
    !existing → create instance (stacks = min(req.stacks, maxStacks); remaining = duration;
                 createdSequence = ctx.combatSequence)
    existing:
      stacks axis  — add: min(stacks + req.stacks, maxStacks) | replace: req.stacks (clamp) | keep: unchanged
      duration axis — refresh: remaining = duration | keep: unchanged | extend: remaining += duration (uncapped — open question 5)
      per_target + sourceOwnership 'latest' → existing.sourceId = req.sourceId (instanceId UNCHANGED — R-B4)
      replaceInstanceOnReapply → remove (reason 'replaced') + create new
      lastAppliedSequence = ctx.combatSequence
    snapshot recapture — EVERY successful apply, AFTER source-ownership
      resolution (R-B9/BLOCKER 4): if any periodic is scaling==='snapshot',
      instance.snapshot.stats = capture(union of snapshotFields, sourceId) via
      stats port — sourceId and snapshot can never disagree.
    convertsToId && convertsAtStackCap && add-axis reaches maxStacks → convert instead (R-B7)
  commit → ctx.events.emit buff_applied / buff_stacks_changed (+buff_duration_changed)
  // canonical gate (contract §19–20 — review HIGH fix): NOT every element-tagged
  // ailment — only registry-canonical elemental states emit:
  if elemental.getElement(def.id) !== null && addedStacks > 0:
    ctx.events.emit ElementalApplicationCommitted{..., element: canonical element,
      reactionEligibility: req.reactionEligibility, origin: req.origin}
  return full ApplyBuffResult (requestedStacks/addedStacks/overflowStacks/durationBefore/After — spec §16/§53)
```

- [ ] **Step 1 — Failing tests (resolver):** spec §12 formula — `base × (1 + elementApplicationPercent) × application_chance-channel × targetResist`; `resistance:'none'` defs ignore target resist; `clampChance:false` passes chance through unclamped; **exactly one rollChance consumed at chance 0 / 0.5 / ≥1** (stream parity — MEDIUM 4); `ailment_scaled` duration = base × resist × (1+dur%) × duration-channel; `fixed` verbatim; `permanent` → undefined duration.
- [ ] **Step 2 — Failing tests (apply):** new vs reapply per axis (`add`/`replace`/`keep` × `refresh`/`keep`/`extend` — all 9 combos where authored); at-cap add → `addedStacks:0`, `overflowStacks` counted, duration refreshed per axis (spec §16); `per_target` reapply keeps instanceId, transfers sourceId (`sourceOwnership:'latest'`); `replaceInstanceOnReapply` mints a new instanceId + emits `replaced`; failed roll mutates nothing and emits only `buff_application_failed`; `clearsCcOnApply` strips control instances first.
- [ ] **Step 3 — Failing tests (canonical gate):** canonical def (`elemental.getElement → non-null`) + `addedStacks>0` → exactly one `ElementalApplicationCommitted` carrying `reactionEligibility`/`origin`; element-tagged NON-canonical def (`getElement → null`) → NO event even with stacks added (review HIGH — the registry, not `def.element`, is the gate); cap refresh (`addedStacks:0`) → none; `AddBuffStacks`/`ConsumeStacks` → none (contract §22).
- [ ] **Step 4 — Failing tests (stacks/modifiers/cleanse):** `setStacks` sets absolutely (clamp 0..maxStacks); `consumeStacks('all','reaction')` → removed `{consumed, remaining:0, removed:true}`; modifier math — `(base + Σadd) × Πmultiply`, `set` override, priority+id tiebreak; `reapply:'max'` keeps larger; `uses` marks consumed at read; `cleanse` removes only `dispellable` matching query (`kind`/`tags`/`element`/`definitionId`), reason `'cleansed'`, non-dispellable matches land in `skipped`.
- [ ] **Step 5 — Implement.**
- [ ] **Step 6 — Verify (P3 quick).**

**Exit criteria:** full spec §67 surface exists; apply/consume/modifier/cleanse semantics proven on fixtures; canonical-only elemental event honored post-commit; exactly one rng roll per apply; zero RNG elsewhere; no proc/reactive execution paths exist in buff2.

---

## Mission 3 — Periodic engine + lifecycle protocol + persistence mode

**Files:**
- Create: `game/src/core/buff2/BuffPeriodicResolver.ts` — request computation only (no combat math)
- Modify: `game/src/core/buff2/BuffSystem.ts` — lifecycle methods wired
- Create: `game/src/core/buff2/BuffPersistence.ts` — standalone per-player pool mode (R2)
- Test: `BuffPeriodic.test.ts`, `BuffLifecycle.test.ts`, `BuffConversion.test.ts`, `BuffPersistence.test.ts`, `BuffOrdering.test.ts`

```ts
// BuffPeriodicResolver.ts — spec §22–28; requests only, NEVER damage.
// NO stats port in this module (review BLOCKER 6): the resolver computes
//   effectiveCoefficient = periodic.coefficient
//     × (stackScaling==='multiply' ? instance.stacks : 1)
//     × resolveChannel(mods, 'periodic_damage', 1)
//     × resolveChannel(mods, 'potency', 1)          // Cong Minh channel — also scales statModifiers (R-B5)
//     × resolveChannel(mods, 'next_periodic_damage', 1)   // pending-marks its 'uses' (commit gated on the generated op resolving — spec addendum §3)
// then emits BuffPeriodicDamageRequest{instanceId, periodicId,
//   sourceId: instance.sourceId, targetId: instance.targetId, element,
//   damageProfile, coefficient: effectiveCoefficient, hitCount, canCrit, canMiss,
//   stackCount: instance.stacks, tags, snapshot?: instance.snapshot.stats}  // snapshot iff scaling==='snapshot' (R-B9)
// 'dynamic' scaling needs NO snapshot field — DamageSystem reads live stats at
// tick (spec §24). Heal requests: amount = def.amount × stackScaling →
// BuffPeriodicHealRequest{instanceId, periodicId, sourceId, targetId, amount}.
// Requests reach the ops layer ONLY via PeriodicRequestsCommitted (lctx.events
// or ctx.events) — the built-in handler converts each 1:1 (contract bridge).
```

**Lifecycle protocol (spec §21/§26/§28 — review BLOCKER 5 fix):**

```
Periodic-capable boundary (onHolderTurnStart/End, onSourceTurnStart/End,
onRoundEnd, onTimePassed) — TWO PHASES around TWO barriers:

Phase A (periodic):
  collect instances whose defs carry a periodic with matching `timing`
    (holder_*  → instances where targetId===entityId;   // 'holder' = the subject the state persists on
     source_*  → instances where sourceId===entityId;
     interval  → per-instance intervalElapsed accumulator, floor(elapsed/interval)
                crossings EACH produce a request — sequential computation, see below)
  sort by canonical comparator (targetId→definitionId→sourceId→instanceId→periodicId)  // spec §55
  compute requests SEQUENTIALLY in sorted order:
    requestId = `req.${instanceId}.${periodicId}.${++instance.periodicTickCount[periodicId]}`
      — per-instance monotonic tick ordinal; globally unique across boundaries,
      manual triggers, and multi-crossing batches (rootActionId-scoped minting
      WOULD collide when two triggerPeriodic calls share a root transaction)
    fold coefficient (stackScaling + modifier channels); mark 'uses' modifiers
    PENDING-consumed per request — a pending mark excludes the modifier from
    folding into LATER requests in the same batch (HIGH 1/4: one uses-charge
    feeds exactly one tick, never two crossings at once)
  emit PeriodicRequestsCommitted{trigger:{type: <this boundary's PeriodicTriggerKind>,
    anchorEntityId: entityId (absent for 'interval'/battle-wide)}, rootActionId,
    requests} via lctx.events                   // v7.2 — no holderId (BLOCKER 5);
                                                // triggerPeriodic emits type:'manual'
                                                // with anchorEntityId = instance.targetId
  outcomes = lctx.settle()   // ← BARRIER 1 — scheduler drains: requests →
                             //   deal_damage/heal ops (`periodic.${requestId}`)
                             //   settle; deaths/consequences resolve.
                             //   INVARIANT: settle() must run while the scheduler
                             //   is quiescent — lifecycle roots are root
                             //   transactions, never invoked mid-settlement.
Phase B (post-settle lifecycle — spec §28 steps 3–8):
  // HIGH 2 — revalidate: barrier-1 damage may have killed the target and
  // removed collected instances. Re-read the store; skip gone instances.
  live = instances.filter(i => store.get(i.instanceId) !== undefined)
  // DEAD-TARGET SWEEP FIRST — a tick that killed the holder inside barrier 1
  // must not let its OTHER buffs fall into the expiry sweep below. Any live
  // instance whose targetId is dead → remove reason 'death' BEFORE lifetime
  // processing (spec §40 reason correctness; onEntityDeath remains the entry
  // for out-of-band deaths — both paths converge on 'death', idempotent).
  for i of live where !stats.isAlive(i.targetId) → remove 'death'; drop from live
  // HIGH 1 — resolution-gated uses consumption (spec §34 'removed immediately
  // after resolution'): for each request whose generated op status ===
  // 'resolved' (outcomes.get(`periodic.${requestId}`)), commit its pending
  // uses-marks → remove those modifiers. 'skipped'/'failed' ops release their
  // pending marks — the modifier survives for the next tick.
  decrement matching modifier lifetimes (holder_turns at holder end, etc.) — live only
  continuousTurns++ (holder boundaries) / continuousSeconds += (onTimePassed)
  convertsAfter* threshold check → convert via internal apply (R-B7, suppressed)
  decrement matching buff lifetimes (clock: holder_turns→targetId match, etc.) — live only
  expire (remaining ≤ 0 → remove, reason 'expired') — canonical-sorted sweep
  emit lifecycle domain events via lctx.events (buff_removed / buff_applied from
    conversions / stacks+duration changes)
  lctx.settle()              // ← BARRIER 2 (BLOCKER 2) — spec §28.7–8: committed
                             //   lifecycle events publish AND their queued
                             //   Reaction/Proc consequences resolve INSIDE this
                             //   root transaction. Without it, a buff_removed→
                             //   proc could leak into a later scheduler run.
  return

Non-periodic boundaries (onEntityDeath/onBattleEnd): single phase —
mutate → emit → settle() (same barrier-2 semantics — death/battle-end
removals' consequences resolve before return).

Manual triggerPeriodic: phase A only (emit via ctx.events; NO internal barrier —
the calling op's own settlement barrier drains the request event); never advances
lifetimes, never decrements turn-based modifier lifetimes (spec §62). 'uses'
marks from a manual trigger stay PENDING on the instance: they are excluded
from folding into any later request immediately, and commit-or-release at the
instance's next lifecycle Phase B — pending marks die with the instance if it is
removed first (a modifier never outlives its instance). LOCKED: a manual-trigger
request that resolves still consumed its mark — pending is bookkeeping, not
double-use.

onEntityDeath(e):  // spec §40–41 — replaces split onHolderDeath/onSourceDeath
  // INVOKED ONLY AT A QUIESCENT POINT by the engine (post-action death-check /
  // turn boundary) — never mid-settlement; deaths inside barrier 1 are already
  // handled by Phase B's dead-target sweep (same 'death' reason, idempotent).
  every instance with targetId===e → remove, reason 'death'   // UNCONDITIONAL — no
    // removalConditions list; dead entities hold no buff state (review BLOCKER 10)
  every instance with sourceId===e && def.lifetime.removeOnSourceDeath → 'source_death'
  canonical-sorted; no onExpire fired; emit + settle() (barrier-2 semantics)

onBattleEnd: all instances → 'battle_end' (canonical-sorted); emit + settle()
```

**Interval multi-crossing (HIGH 4, spec §26 locked):** `onTimePassed(seconds)` —
per interval periodic: `elapsed += seconds`; `ticks = floor(elapsed / intervalSeconds)`;
`elapsed -= ticks * intervalSeconds`. Each tick produces one request in Phase A's
sequential computation (distinct requestId each). If tick k's op kills the target,
ticks k+1.. skip as `skipped` → their pending uses-marks release (rule above) —
the modifier isn't burned by ticks that never resolved.

| Entry point | Decrements (clock / modifier lifetimes) | Periodic timing | Converts check |
|---|---|---|---|
| `onHolderTurnStart(e)` | — | `holder_turn_start` (targetId==e) | — |
| `onHolderTurnEnd(e)` | `holder_turns` on targetId==e | `holder_turn_end` | continuousTurns++ → convertsToId |
| `onSourceTurnStart(e)` | — | `source_turn_start` (sourceId==e) | — |
| `onSourceTurnEnd(e)` | `source_turns` on sourceId==e | `source_turn_end` | — |
| `onRoundEnd` | `rounds` (all) | — (spec §22 has no round timing) | — |
| `onTimePassed(s)` | `seconds` (all in scope) | `interval` accumulators | continuousSeconds → converts |
| `onEntityDeath(e)` | — | — | removal only |
| `onBattleEnd` | — | — | removal only |

- [ ] **Step 1 — Failing tests (periodic):** 3-stack DoT → request `coefficient` = authored×3×modifiers; request carries `damageProfile`/`canCrit`/`canMiss`/`hitCount`; `next_periodic_damage` folds once then consumed; **dynamic vs snapshot:** mutate source stats between ticks → dynamic tick's damage differs via the damage authority (integration test), snapshot tick's request carries the apply-time `snapshot` and its damage is stats-independent; `stackScaling:'ignore'` flat; heal periodic → `BuffPeriodicHealRequest`; source dead + `removeOnSourceDeath:false` → requests still emitted (damage authority handles absent source).
- [ ] **Step 2 — Failing tests (lifecycle):** per-anchor decrement matrix (each entry point decrements ONLY its clock); **barrier ordering (spec §28 — THE regression test):** instance at `remaining:1` whose tick kills the target → deal_damage op settles BEFORE the expiry sweep; a still-alive buff on the killed target is removed with reason `'death'` not `'expired'`; **post-settle revalidation:** an instance removed inside barrier 1 is skipped by Phase B, never mutated through a stale reference; **barrier 2:** a reaction queued on `buff_removed`/`buff_applied` resolves inside the same root transaction (spy handler observes it before the lifecycle method returns); **resolution-gated uses:** `next_periodic_damage uses=1` consumed iff its op resolved — a `skipped` tick leaves the modifier; **interval multi-crossing:** `onTimePassed(10)` on interval 3 → 3 requests (distinct requestIds) + remainder 1; tick-1 kill → ticks 2–3 skipped, marks released; manual `triggerPeriodic` doesn't advance lifetime or turn-modifiers; `convertsToId` at threshold fires once, new instance stacks=1, suppressed eligibility, `replaced` reason; canonical sort proven on simultaneous periodics.
- [ ] **Step 3 — Failing tests (persistence):** `BuffPersistence` — apply/remove/query/`onTimePassed` work with NO scheduler. It wraps a `BuffSystem` whose store mints `buff.persistent.${ownerId}.${n}` and synthesizes every ctx/lctx locally — apply ctx = `{operationId:'persistent.apply.${n}', origin:{kind:'scripted', originId:'persistent', sourceId, rootActionId:'persistent'}, events: collectingSink, combatSequence: localSeq++}`; lifecycle ctx = `{rootActionId:'persistent', sequence: localSeq, events: collectingSink, settle: () => new Map()}` (empty-map settle is legal ONLY because periodic defs are rejected — see below). The resolver still consumes exactly one `rollChance` per apply — persistent mode injects a local `CombatRng` instance (deterministic stream, no scheduler needed); the roll contract is uniform across modes. Defs carrying `periodic` are REJECTED by the persistent pool (no barrier exists to settle requests — construction-time guard); events reach the injected sink for log/debug.
- [ ] **Step 4 — Implement + verify (P3 quick).**

**Exit criteria:** periodic is request-based, barrier-ordered, dynamic+snapshot capable; all 8 lifecycle entry points proven; conversion + persistence ported; every mutation still evented; zero combat-math imports inside buff2.

---

## Mission 4 — Cutover part A: data migration + TurnBattleSystem reroute

**Files:**
- Modify: `game/src/data/buff/**` — migrate ALL ~7 def files to the new `BuffDefinition` shape (mechanical per M1 mapping — **data migrates FIRST, no adapter**); `BuffRegistry.ts` becomes the buff2 registry
- Create: `game/src/core/proc/CombatProcSystem.ts` — narrow capability owner (HIGH 5): consumes `getCapabilities` descriptors, rolls `CombatRng`, emits ops through the scheduler. Owns `on_hit_proc`/`reactive_trigger`/`reactive_proc`/`reactive_economy`/`the_economy`/`gauge_delta`/`dot_recovery` consumption. `core/proc/ProcCapabilities.ts` + `core/path/the-tu/TheTuCapabilities.ts` hold the typed payload schemas + validators (BLOCKER 3). NOT hosted inside `TurnBattleSystem` — no interim proc engine in the turn engine.
- Modify: `game/src/core/battle/turn/TurnBattleSystem.ts` — participants stop owning `BuffPool`; single battle `BuffSystem`; ailment/buff apply lanes → `ApplyBuffOperation` through the scheduler; tick at `:1110` → `onHolderTurnEnd`; CC checks → `hasControl`; proc/reactive lanes DELEGATE to `CombatProcSystem` at the same seam points; `reactionManager.checkAndTrigger` call REMOVED
- Modify: `game/src/core/battle/turn/TurnBattleAdapter.ts` — construct buff2 `BuffSystem` + `CombatProcSystem` + registry + resolver + stats port + `ElementalStateRegistry` + `CapabilityValidatorRegistry` at battle build; `battleId` arrives from the composition root (R-B1)
- Modify: `game/src/core/game/GameManagerTurnBattleOps.ts` — mint `battleId` (`battle.${n}`) alongside scheduler/rng; hand into the adapter
- Modify: `game/src/core/combat/CombatSystem.ts` — `applyDotDamage`'s `sourceBuffs` seam reads capability descriptors (dotRecovery bridge — see below)
- Test: `TurnBattleSystem.buff2.test.ts` (port the relevant `TurnBuffSystem*.test.ts` assertions), `data/buff/*.test.ts` updated

**Reroute map (exact call-site changes):**

| Today | After |
|---|---|
| `actor.buffs: BuffPool` per participant | `battleBuffs: BuffSystem` single store; participant keeps `entity.id` only |
| `new BuffSystem(actor.buffs).update(actor.entity, this.combat, registry, resolveSource, resolveSourceBuffs)` `:1110` | `buffs.onHolderTurnEnd(actor.id, lctx)` — `const {sink, sequence, settle} = scheduler.createLifecycleSink('status.turn.N.*')`; `lctx = {rootActionId, sequence, events: sink, settle}` (v7.2 — settle returns the op-status map); requests → `PeriodicRequestsCommitted` → built-in handler → `deal_damage` ops (contract bridge). Turn-start site (action declaration entry) → `onHolderTurnStart`; the acting entity's own turn-end → `onSourceTurnEnd` for its outgoing instances; round rollover → `onRoundEnd` — all with the same lctx shape, each a separate lifecycle root transaction |
| `applySkillAilments` loop `new BuffSystem(target.buffs).apply(def,...)` per stack `:2973` | ONE `ApplyBuffOperation{definitionId, stacks: ailment.stacks ?? 1, baseChance: ailment.chance, reactionEligibility: initiatesReactions ? 'eligible' : 'suppressed'}` through the executor — the resolver rolls ONCE (today: `this.rng() < resolveAilmentApplicationChance(...)` at `:2959` — the roll MOVES into buff2's resolver; `AilmentChance.ts` retires) |
| `reactionManager.checkAndTrigger(...)` `:2979` | **REMOVED (spec §73 — no dual-run).** buff2 emits `ElementalApplicationCommitted`; the reaction megaplan owns consumption. **Merge gate:** M4 is not merge-ready until the reaction plan's `elemental_application_committed` consumer exists on the same branch — otherwise elemental reactions silently stop firing (P14 battle check must cover this explicitly). |
| `new BuffSystem(target.buffs).apply(def,...)` appliesBuffs lane `:1824` (resolveBuff) | `ApplyBuffOperation` route, `reactionEligibility:'suppressed'` (not elemental applications); per-target loop kept; `clearsCcOnApply` handled inside `apply()` |
| `rollOnHitEffects` `:1824` (actor pool → victim pool) | `CombatProcSystem.onHitLanded(attacker, target)` — reads `buffs.getCapabilities(attacker)` filtered `type==='on_hit_proc'` → `rng.rollChance(cap.payload.chance)` → `ApplyBuffOperation{payload.appliesBuffId, targetId: target}` through the scheduler. TBS calls the proc system at the seam; the proc engine lives in `core/proc/`, never in buff2 or TBS |
| `rollReactiveTrigger` `:1834` (victim pool, onImpactLanded) | `CombatProcSystem.onImpactLanded(victim, attacker)` — same pattern on victim's `reactive_trigger` grants: roll → `appliesDefinitionId` → `ApplyBuffOperation`; `queuesFollowUp` → `battle.queuedFollowUps` (unchanged); `reflectsDamage` → `DealDamageOperation` through the scheduler (damage authority owns reflect damage). `onCastBegin` site `:1033` routes the same way |
| Thể Tu reactive economy lanes (`resolveReactiveProcs` `:2407`, theCost/theGain counters, `the_economy` gains) | `CombatProcSystem` + `TheTuCapabilities` payloads — proc system rolls the chance stat (`payload.chanceStat`), TheTu resource ops via `ResourceAuthority` port; mechanics vocabulary lives in `core/proc/`/`core/path/the-tu/`, not buff2 |
| `BuffSystem.isStunned/isFrozen/isRooted(targetId)` CC checks | `buffs.hasControl(targetId, 'stun')` — same targetId guard, structurally enforced by the single store (ARCH-009) |
| `getActiveModifiers()` per participant → `liveStatModifiers` `:470` | `buffs.getStatModifiers(entityId)` per participant — identical `StatModifier[]` output (potency-channel folding included) |
| `pendingGaugeDeltaTargets`/`applyGaugeDeltaEffects` `:486/:1996/:2825` | **Event-driven (HIGH 6):** `CombatProcSystem` registers an immediate handler on `buff_applied` → applied def carries a `gauge_delta` grant → `PushGaugeOperation` through the scheduler. Only a COMMITTED application pushes gauge — the caller never needs `ApplyBuffResult`, and a failed roll can't leak a push. Ordering note: fires inside the apply op's barrier (earlier than legacy's post-impact phase but same action — gauge is only read at boundaries/next actions; semantics preserved) |
| `dotRecoveryTriggers(source, element, sourceBuffs)` in `applyDotDamage` `:600` | `resolveSourceBuffs` adapter → `buffs.getCapabilities(sourceId)` filtered `type==='dot_recovery'` (+element match) — CombatSystem narrows the grant payload via the dotRecovery owner's helper, still inside the `legacy_dot` profile channel |
| `scaleBuffPotency` call sites (Cong Minh amp) | `AddBuffModifierOperation{channel:'potency', operation:'multiply', reapply:'max', lifetime:'buff_lifetime'}` — deletes `potencyAmplified` |
| `consumesAilmentId`/detonate reads (`getStacks`+`removeAllById`) | `buffs.getStacks(selector)` / `ConsumeBuffStacksOperation` |
| `renewWithExtension` | `ExtendBuffDurationOperation` |
| `BuffPool.clearCcEffects` (Bá Thể) | inside `apply()` via `clearsCcOnApply` |
| `uniquePerTarget` | `instanceScope:'per_target'` — instance persists, `sourceId` transfers (R-B4) |
| `player.persistentTimedEffects` | **UNTOUCHED** — different system (deadline-ms effects, not buffs — R2) |

**ATOMIC MISSION (MEDIUM 3 — locked):** M4 runs as ONE worktree mission. Between the data flip and the consumer cutover the tree may not compile — that is EXPECTED; the P3/P13/P14 gates apply at mission end, not per file flip. Do not split M4 into separately-mergable commits.

- [ ] **Step 1 — Migrate `data/buff/` files first** (mechanical per M1 mapping) with a per-file test flip (`buffs.test.ts`, `TheTuBuffs.test.ts`, `ZoneDotBuffs.test.ts`, `BuffRegistry.test.ts`, `buffs.registryConsistency.test.ts`). No adapter is created — the new registry loads only the new shape.
- [ ] **Step 2 — Failing tests:** source isolation (A's burn on T vs B's burn on T = two instances); ailment apply through scheduler emits `ElementalApplicationCommitted` for canonical defs only; periodic requests reach the damage authority through the executor; capability-consuming lanes (proc/reactive/gauge/dotRecovery) read descriptors and behave identically to legacy.
- [ ] **Step 3 — Reroute TurnBattleSystem + adapter** per the map.
- [ ] **Step 4 — Verify (P3 FULL)** + **P13/P14 Playwright** real battle from the worktree: ailment applies, DoT ticks (damage lands before expiry), buffs expire, CC blocks a turn, elemental reaction fires iff the reaction consumer has landed (merge gate). **P4 deep + P5 round.**

**Exit criteria:** no production `new BuffPool()` remains except inside `BuffPersistence`; all data migrated to the new shape (zero legacy-shape defs); no `TurnReactionManager` invocation on the ailment lane; full suite green; real battle verified.

---

## Mission 5 — Cutover part B: UI/persistence/ops-layer + deletion list

**Files:**
- Modify: `game/src/core/game/GameManager.ts` — `buffPool`/`buffSystem` (`:222-223`) → `BuffPersistence` pool; `GameManagerPersistentEffectOps.applyPersistentBuff` + per-tick `updateTime` → `onTimePassed`; its `getActiveModifiers` reads (`PersistentEffectOps` live-modifier feed) → `persistence.getStatModifiers('player')`; **`player.persistentTimedEffects` untouched**
- Modify: presentation snapshot — `action_executed` `buffState` payload source → `getForTarget` snapshots (keep payload shape identical — UI untouched if possible)
- Modify: `game/src/ui/**` (`BattleFloatingStatusBar`, `battleHUDStore`) ONLY if payload shape forces it
- Delete: `game/src/core/buff/BuffPool.ts`, `BuffSystem.ts` (incl. `rollOnHitEffects`/`rollReactiveTrigger`/`calculateDamagePerTurn`/`update`/`scaleBuffPotency`), `BuffTypes.ts`, `Buff.ts`, `BuffDefinition.ts`, `BuffRegistry.ts`, `BuffNames.ts` (if supplanted), `core/battle/turn/AilmentChance.ts` (roll moved into the resolver)
- Rename/move: `core/battle/turn/TurnBuff*.test.ts` → `core/buff2/` (they test the canonical system — R1)
- Update: `game/docs/systems/buffs.md` (rewrite to buff2), `roadmap.md`

- [ ] **Step 1 — Migrate remaining consumers** per M0 census (search residual `import.*core/buff/` hits; every hit gets a mapped replacement — NO import left of the old package).
- [ ] **Step 2 — Deletion list execution** (spec §73) + spec §66 forbidden-pattern grep (`Math.random`, `potencyAmplified`, `scaleBuffPotency`, `rollOnHitEffects`, `rollReactiveTrigger`, `calculateDamagePerTurn`, overloaded `update`, mutable `buff.effects`) + full suite.
- [ ] **Step 3 — Spec DoD sweep (§69/§74):** each invariant + DoD row → named test or "owned by sibling plan"; §70 required tests + §71 Hỏa Ấn acceptance + §72 second-status acceptance all green.
- [ ] **Step 4 — Docs + verify (P3 FULL) + P13/P14 + P4 deep + P5 round.**

**Exit criteria:** `core/buff/` package gone; buff2 is THE authority; DoD rows accounted; zero `Math.random`/direct-damage/proc-execution inside buff2; `git grep "core/buff/"` returns only doc references.

---

## Test matrix — spec/contract → named tests

| Source | Requirement | Test |
|---|---|---|
| §14–16 | failed app: no mutation, no event, no reaction; at-cap overflow accounting | `BuffSystemApply.test.ts :: failed roll commits nothing` / `:: cap apply reports overflow` |
| §12 + rng | multiplicative chance; exactly one rollChance even at 0/≥1 | `ApplicationResolver.test.ts :: formula` / `:: one roll always` |
| §19–22 (contract) | canonical-only elemental event; iff `addedStacks>0`; none from stack ops | `BuffSystemApply.test.ts :: canonical gate` / `BuffStacks.test.ts :: stack mutation is silent` |
| §7 | `per_target` single instance + ownership transfer, instanceId stable | `BuffSystemApply.test.ts :: per_target ownership` |
| §24–25 | dynamic tick sees live stats (integration); snapshot tick carries apply-time context; reapply/ownership-transfer recaptures snapshot | `BuffPeriodic.test.ts :: dynamic` / `:: snapshot` / `:: snapshot recapture on transfer` |
| §39/§37 | `remove()` returns `RemoveBuffResult`; zero-stack via removeStacks/setStacks → `'consumed'` removal | `BuffStacks.test.ts :: zero stacks remove` / `:: remove result` |
| §47 | capability grants are generic — buff2 holds no path vocabulary; unknown type throws at load; owner-registered validators gate payloads | `BuffRegistry.test.ts :: capability validation` |
| §26–28 | barrier: damage settles before lifetime advance/expiry; Phase-B revalidation; barrier-2 drains lifecycle-event reactions in-root; manual tick advances nothing | `BuffLifecycle.test.ts :: settle before expire` / `:: stale instance skipped` / `:: barrier 2 drains reactions` / `:: manual tick is pure` |
| §34 + v7.2 | `uses` consumed iff generated op `'resolved'`; skipped ticks release marks; one charge feeds one tick even across multi-crossing batches | `BuffLifecycle.test.ts :: uses gated on resolution` / `BuffPeriodic.test.ts :: multi-crossing uses` |
| §26 | interval multi-crossing: `floor(elapsed/interval)` requests, distinct requestIds, remainder carries | `BuffLifecycle.test.ts :: interval crossings` |
| §29–32 | modifier BASE→ADD→MULTIPLY→SET; priority+id tiebreak; reapply no-compound | `BuffModifierEngine.test.ts` |
| §33–35 | modifier lifetimes per boundary; uses-consume; refresh isolation | `BuffLifecycle.test.ts :: modifier boundaries` |
| §36–38 | setStacks/setRemainingDuration/consume first-class | `BuffStacks.test.ts` |
| §40–42 | death removes ALL target buffs (reason 'death', no onExpire); source death conditional on `removeOnSourceDeath`; cleanse dispellable-only | `BuffLifecycle.test.ts :: death sweep` / `BuffCleanse.test.ts` |
| §44 | no reentrancy — events emitted post-commit only | `BuffSystemApply.test.ts :: commit then emit` |
| §52 | selector discrimination | `BuffQuery.test.ts` |
| §55 | canonical sort on simultaneous sweeps | `BuffOrdering.test.ts` |
| §56 | registry validation rows | `BuffRegistry.test.ts` |
| §62–64 | manual tick purity; next-tick modifier; potency modifier | `BuffPeriodic.test.ts` / `BuffModifierEngine.test.ts` |
| §67 | full API surface present | `BuffSystemApply.test.ts :: surface` (compile-level) |
| §70–72 | Hỏa Ấn + second status on generic primitives | `BuffAcceptance.test.ts` |
| Contract §8 | every mutator reachable via op (incl. v7.1 cleanse/set ops) | `TurnBattleSystem.buff2.test.ts :: op routing` |
| Contract §20 | `ElementalApplicationCommitted` carries `reactionEligibility`/`origin` | `BuffSystemApply.test.ts :: event payload` |
| ARCH-009 | cc targets `targetId`; single store makes misroute impossible | `BuffQuery.test.ts :: hasControl` |
| Legacy | `clearsCcOnApply`/`convertsToId`/`convertsAtStackCap`/`fixed` scaling/`per_target` | `BuffConversion.test.ts` + `BuffSystemApply.test.ts` |
| Contract v7.1 | `ctx.combatSequence` on `createdSequence`; lifecycle `sequence` on converted instances; `snapshot` rides the request | `BuffLifecycle.test.ts` / `BuffPeriodic.test.ts` |

## Deferred to sibling plans / seal batch

- `ElementalApplicationCommitted` consumption + `ReactionSystem` wiring → reaction megaplan (**M4 merge gate** — see reroute map)
- `TriggerBuffPeriodic`/`read_stacks` operation producers → skill megaplan
- Five real ấn defs + `doc_can` rename collision + legacy `bong` overlap ruling → seal batch
- `ActionValidator` consumption of `hasForbiddenTags`/`hasControl` → reaction megaplan
- `ELEMENTAL_REACTION_CAPABILITY` grant (Ngộ Đạo) → seal batch
- Application-formula numeric re-tune (R-B3 behavior change) → seal batch balance pass
- ProcSystem/owning-domain reaction-trigger depth beyond `on_hit_proc`/`reactive_trigger`/`reactive_proc`/`reactive_economy`/`the_economy`/`gauge_delta`/`dot_recovery` (e.g. full `CombatCapabilityQuery`-driven dispatch) → reaction/skill megaplans; `CombatProcSystem` itself lands at M4

## Open questions for coordinator

1. RESOLVED (review ruling): application chance uses spec §12 multiplicative formula with target resistance at application (`resistance:'ailment'` gated) — legacy additive formula retired; numeric parity intentionally broken, re-tune at seal batch.
2. RESOLVED (review round 2 — R-B7 locked): `convertsToId` re-application is `reactionEligibility:'suppressed'` — a conversion is a CONTINUATION of state, not a new application for reaction purposes. If a future design needs conversion-triggered reactions, ReactionSystem observes `buff_applied`/`buff_removed('replaced')` events directly — the eligibility field stays honest.
3. Flat-`coefficient` damage profiles (legacy `powerDomain:'buff'`/`baseCoefficient` analog): coefficient units = absolute damage per tick vs ratio — assumed absolute via a flat profile; confirm at seal batch.
4. Capability consolidation — the 6 legacy effect kinds + marker flags become capability grants whose typed payloads are owned by `core/proc/` + path modules; confirm no external code discriminates by `effect.type` string (M0 step 5 — if presentation reads `theEconomy`/`marker` directly, the payload keeps the data but ownership moves).
5. `onReapplyDuration:'extend'` — `remaining += granted duration` uncapped (no spec'd cap); flag if a real def needs a cap.
6. M4 merge gate — elemental reactions pause between `checkAndTrigger` removal and the reaction consumer landing; confirm "same integration branch" vs documented gap is acceptable.
