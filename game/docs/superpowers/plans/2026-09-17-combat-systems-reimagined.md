# Combat Systems Reimagined — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Non-trivial production missions MUST follow `game/docs/architecture/architecture-worker-workflow.md` (G0–G5) and return the G5 evidence report.
>
> **Review resync (buff-plan review round 7, `7429d14a`):** sibling megaplans are the authority — this parent's orchestration is corrected to their locked rulings: (a) R3 corrected — `TurnReactionManager`/`canInitiateWuxingReactions`/`checkAndTrigger` are DELETED at reaction **M-INT inside buff M4's worktree**, NOT kept until seal batch; (b) mission EXECUTION ORDER corrected — reaction engine (M6) must land BEFORE buff cutover (M4) because M-INT consumes `ReactionDispatcher`/`ReactionRegistry`/`ElementalStateRegistry`; (c) M4 is ONE ATOMIC WORKTREE MISSION — no M4a/M4b split; (d) R1/R2 census corrected — no independent `TurnBuffSystem`/`TurnBuffPool` impl exists to absorb (test files only), `player.persistentTimedEffects` is NOT a buff pool and is untouched (persistent buffs = `GameManager.buffPool` → `BuffPersistence`); (e) M6/M7 exit criteria + Deferred section resynced — legacy engine dead post-M4, seal batch owns only canonical-content items (real ấn defs, production `ReactionRegistry`, dispatcher registration, Ngộ Đạo grant, real payoff defs).
>
> **Execution order (LOCKED — mission numbers are scope labels, not sequence):**
> `M0 → M1 (contracts) → M2 (scheduler) → M3 (buff core) → M6 (reaction engine, fixture/inert) → M4 (buff cutover + reaction M-INT in the SAME worktree) → M5 (skill pipeline) → M7 (battle wiring)`.
> Buff M4 cannot start before reaction M6 completes — its merge gate requires the M-INT sub-steps which consume the reaction package.

**Goal:** Land the shared combat runtime spine (contracts, scheduler, deterministic RNG), rebuild BuffSystem as the single persistent-state authority, introduce the declarative SkillDefinition pipeline, and build the capability-gated Ngũ Hành Reaction engine — **without authoring any of the 5 elemental ấn** (Hỏa Ấn + Hàn Tức/Độc Căn/Liệt Thương/Trấn Ấn ship together in a later batch).

**Architecture:** Four layers in dependency order: (1) `combat/contracts` — shared operation/event/origin/result types + `CombatRng`; (2) `CombatScheduler` + `CombatOperationExecutor` — ordering, settlement barriers, exactly-once events; (3) new `BuffSystem` — definition/instance/modifier model as the single battle-scoped authority (no independent `TurnBuffSystem` impl exists — only test files remain, cleaned in M4/M5); (4) `SkillResolver → ResolvedSkillPlan → executor` and `ReactionSystem` — both emitting `CombatOperation`s, never mutating foreign state.

**Tech Stack:** Vue 3, TypeScript, Vite, Vitest, Pinia, Phaser.

**Specs:**
- `game/docs/specs/2026-09-17-combat-systems-contract-spec.md` (v1.6 — runtime contract, supersedes conflicting points in the other specs)
- `game/docs/specs/2026-09-17-buff-system-reimagined-spec.md` (v1.5)
- `game/docs/specs/2026-09-17-skill-definition-system-spec.md` (v1.3)
- `game/docs/specs/2026-09-17-reaction-system-reimagined-spec.md` (v1.1)
- `game/docs/specs/2026-09-17-hoa-an-ailment-system-spec.md` (v1.1 — **context only; not implemented in this program**)

## Global Constraints

- **No ấn authoring in this program.** `hoa_an`, `han_tuc`, `doc_can`, `liet_thuong`, `tran_an` definitions, Hỏa skills (Dẫn Hỏa Quyết, Xích Viêm, Phần Thiên, Cửu Tiêu), and the `elemental_reaction_enabled` grant are ALL deferred to the seal batch. Every system-level acceptance test uses synthetic fixtures (`test_burn`, `test_mark`, test elements) — never path/Hỏa-specific branches (CON-23, INV-B14).
- **Breaking redesign, no dual-run** for BuffSystem (buff spec §73): no compat layer, no parallel engines. SkillDefinition migration MAY use a resolver-input adapter (skill spec §69) — reconciled by M0 ruling R6.
- **Deterministic RNG only:** all combat randomness flows through `CombatRng`; no `Math.random()` in gameplay systems (contract §88). `TurnBattleSystem`'s existing injectable `rng` closure (`TurnBattleSystem.ts:479`) is the adoption seam.
- **No unused primitives:** every interface/registry lands with a real consumer or test consumer in the same mission. `elemental_reaction_enabled` intentionally ships ungranted — see M0 ruling R7.
- **P3 verification:** `quick` = `npm run type-check` + `npx vitest run <scope>` from `game/`. `full` = + `npm run build` + `npx vitest run` — mandatory for M4 (buff cutover) and M7 (battle wiring).
- **P4** adversarial QA (quick) after every production mission; **deep** for M4 and M7.
- **P5** Sequential Multi-Pass Review per mission (≥3 ordered passes over evolving code states). **P7** — commit steps describe granularity only; every commit needs explicit user authorization.
- **P13/P14:** M4 and M7 touch battle runtime wiring — drive a real battle via Playwright (`npm run dev`, actual port) before merge-ready.
- **Save policy:** strict version rejection; if M4 changes persisted buff shape, schema + consumer + `saveVersion` bump land together. `player.persistentTimedEffects` is NOT a buff pool and is NOT migrated (R2 — corrected census).
- Per-mission report: changed / files / authority moved / adapters remaining / tests / build status / behavior changes / risks / next.

## M0 Rulings (must be resolved before production edits)

| # | Question | Proposed ruling |
|---|---|---|
| R1 | `TurnBuffSystem`/`TurnBuffPool` fate | RESOLVED (corrected census): NO independent `TurnBuff*` impl exists to absorb — only test files importing `core/buff` remain (renamed/verified in M4/M5). New BuffSystem is the single battle-scoped authority. |
| R2 | `player.persistentTimedEffects` (Kiếp Thương, out-of-battle) | RESOLVED: NOT a buff pool — a separate persistent system, untouched by this program. Persistent buffs are `GameManager.buffPool` → `BuffPersistence` (buff megaplan M3). No `persistentTimedEffects` migration input exists. |
| R3 | Legacy `TurnReactionManager` + `ELEMENT_REACTIONS` (live for visible Pháp Tu) | **DELETED at reaction M-INT — inside buff M4's worktree** (the cutover removes the `BuffPool` the legacy engine reads/mutates, so removal must land on the same branch before merge). NOT seal batch. Per spec, visible Pháp Tu gets NO automatic reactions — the behavior is retired, not preserved; `elemental_reaction_enabled` granted to nobody; `ReactionDispatcher` NOT registered until a valid production `ReactionRegistry` exists (seal/Ngộ Đạo mission). |
| R4 | `Độc Căn` name collision (poison-root mechanic inside `trung_doc` vs new Mộc ailment id `doc_can`) | Rename the poison-root mechanic keys (`poisonRoot*` → distinct prefix) at M4 data migration |
| R5 | Thế resource authority for `GainResourceOperation`/`ConsumeResourceOperation` | Locate at M0 inventory (`ResourceTurnHook.ts`, `player.phapTu`); resource ops land only if a real consumer exists — otherwise deferred |
| R6 | Migration stance conflict (buff forbids compat / skill allows adapter) | Buff data = rewrite-in-place; skill legacy path = resolver-input adapter with dated retirement |
| R7 | Reaction engine lands ungranted (no production consumer until seals) | Acceptable — engine is exercised by tests; documented as deferred-grant |
| R8 | `castTime`/`cooldown` units in turn engine | Map to turn units (`cooldownTurns`); real-time `castTime` phased out — final shape at M5 after inventory of `SkillExecutionPolicy` consumers |
| R9 | Production behavior when `maxImmediateSettlementDepth` exceeded | Log + force-stop settlement + surface error event (no silent truncate); exact policy authored in M2 |
| R10 | Cấm Công enforcement point | `ActionValidator` in turn engine reads `forbiddenActionTags` from active buff state — lands in M6 with the restriction buff type |

---

## Mission 0 — Rulings + authority inventory (read-only)

**Files:**
- Create: `game/docs/architecture/2026-09-17-combat-contract-inventory.md`

- [ ] **Step 1 — Lock baseline:** record `git rev-parse HEAD`; all claims reference this SHA.
- [ ] **Step 2 — Resolve M0 rulings R1–R10** with the user; record each decision + reason in the inventory doc.
- [ ] **Step 3 — Buff consumer inventory:** every `BuffPool`/`TurnBuffPool` reader and writer, `new BuffSystem(` sites (`TurnBattleSystem.ts:1033,1824`), `appliesBuff(s)`/`appliesAilments` data fields, `TurnStatusPresentationEvents`, `persistentTimedEffects` writers (confirm R2 — separate system, untouched), `scaleBuffPotency`/`potencyAmplified`/`rollOnHitEffects`/`rollReactiveTrigger`/`Math.random` call sites, `data/buff/*` definition counts.
- [ ] **Step 4 — Skill pipeline inventory:** `Skill`/`SkillEffect`/`SkillAction`/`TriggerBinding` duality sites, `SkillToTurnSkillConverter` consumers, `SkillSystem.getEffectiveSkill`, `TurnSkillDefinition` shape, passive trigger runtime, `SkillExecutionPolicy` consumers (for R8).
- [ ] **Step 5 — Reaction/damage/gauge inventory:** `TurnReactionManager.checkAndTrigger` call site (`TurnBattleSystem.ts:2978`), `ELEMENT_REACTIONS` shape, `CombatSystem`/`EntityVitalsSystem`/`ElementDamageCalculator` public surface (damage authority seam), `ActionGauge` push API, `CombatCapabilityQuery` candidates (existing capability/buff-capability concepts).
- [ ] **Step 6 — Resource authority (R5):** find who owns Thế today and where `resource_gain` would land.
- [ ] **Step 7 — Write authority matrix + migration surface list** (P0 must-move / P1 reroute / P2 delete).

**Exit criteria:** R1–R10 decided in writing; every buff/skill/reaction writer has a named owner; M4 deletion list is complete and verified against real call sites; battle-build seam for capability grant documented.

---

## Mission 1 — Combat contracts layer + deterministic RNG

**Files:**
- Create: `game/src/core/battle/contracts/operations.ts` — `CombatOperation` union (contract §5), `CombatOperationOrigin` (§10), `ResolvedCombatOperation` (§4), `ReactionEligibility` (§14)
- Create: `game/src/core/battle/contracts/results.ts` — `CombatOperationResultBase` + discriminated per-op results (§52–53)
- Create: `game/src/core/battle/contracts/events.ts` — `CombatEvent` base, `ElementalApplicationCommitted` (§20), event ids
- Create: `game/src/core/battle/contracts/rng.ts` — `CombatRng { roll(), rollChance() }`, `SeededCombatRng(seed)`, `CombatRngAdapter` wrapping existing `() => number`
- Create: `game/src/core/battle/contracts/capability.ts` — `CombatCapabilityQuery` interface (§24; impl deferred to M6)
- Test: `game/src/core/battle/contracts/rng.test.ts`, `operations.test.ts`
- Modify: `game/src/core/battle/turn/TurnBattleSystem.ts` — route `this.rng()` call sites through `CombatRng` (adapter wraps the injected closure; zero behavior change)

**Interfaces — Produces:**

```ts
interface CombatRng { roll(): number; rollChance(chance: number): boolean }
class SeededCombatRng implements CombatRng { constructor(seed: number) }

interface CombatOperationOrigin {
  kind: 'skill' | 'reaction' | 'buff_periodic' | 'proc' | 'scripted'
  originId: string
  sourceId: CombatEntityId
  rootActionId: string
  parentOperationId?: string
  causationEventId?: string
  castId?: string
  subcastIndex?: number
  reactionId?: string
}

type CombatOperation =
  | DealDamageOperation | HealOperation
  | ApplyBuffOperation | AddBuffStacksOperation | RemoveBuffStacksOperation
  | ConsumeBuffStacksOperation | AddBuffModifierOperation | RemoveBuffModifierOperation
  | RefreshBuffDurationOperation | ExtendBuffDurationOperation
  | TriggerBuffPeriodicOperation | RemoveBuffOperation
  | PushGaugeOperation | GainResourceOperation | ConsumeResourceOperation
  | ApplyShieldOperation
```

- [ ] **Step 1 — Write failing tests:** seeded rng determinism (same seed → same sequence; `rollChance(0)` always false, `rollChance(1)` always true); operation union discrimination; origin parent linkage.
- [ ] **Step 2 — Implement contracts + SeededCombatRng.**
- [ ] **Step 3 — Adapt TurnBattleSystem rng** through `CombatRngAdapter` — pure refactor, all existing tests must stay green.
- [ ] **Step 4 — Verify (P3 quick):** `npm run type-check` + `npx vitest run src/core/battle`.

**Exit criteria:** contract types compile; rng deterministic; zero behavior change in TurnBattleSystem.

---

## Mission 2 — CombatScheduler + CombatOperationExecutor

**Files:**
- Create: `game/src/core/battle/runtime/scheduler/CombatScheduler.ts` — operation queue, `combatSequence` allocation (sole allocator), settlement barrier, immediate-event drain to quiescence, `eventId` dedup (exactly-once), `seenOperationIds` global uniqueness, dual guard (nesting depth + per-barrier work budget — contract v4), debug trace recorder
- Create: `game/src/core/battle/runtime/scheduler/CombatOperationExecutor.ts` — routes `ResolvedCombatOperation` to authority ports; contains routing only, no formulas
- Create: `game/src/core/battle/runtime/scheduler/CombatAuthorityPorts.ts` — `BuffAuthority`, `DamageAuthority`, `GaugeAuthority`, `ResourceAuthority`, `ActionValidatorAuthority` port interfaces (all take `CombatAuthorityExecutionContext` — contract megaplan v4)
- Create: `game/src/core/battle/runtime/scheduler/CombatTrace.ts` — §85-shaped trace tree (rootAction → subcast → operation → result → event → evaluation)
- Test: `game/src/core/battle/runtime/scheduler/CombatScheduler.test.ts` — synthetic ops + stub authorities

**Interfaces — Produces** (SUPERSEDED by the contract megaplan's canonical names — that plan is authoritative; sketch shown for shape only):

```ts
class CombatScheduler {
  // NO public allocateSequence — scheduler stamps internally (sole allocator)
  enqueueAuthored(ops: readonly ResolvedCombatOperation[]): void  // barrier after EACH op
  enqueueEvent(pending: PendingCombatEvent): void                  // dedup by producer eventId
  reserveOperationId(id: CombatOperationId): void                  // global uniqueness, all paths
  run(): CombatTrace                                               // drains authored + immediate until quiescent
}
class CombatOperationExecutor {
  execute(op: ResolvedCombatOperation, sink: CombatEventSink): CombatOperationResult  // pure router
}
```

- [ ] **Step 1 — Failing tests:** sequential op ordering; settlement barrier drains chained immediate events; duplicate `eventId` processed once; depth guard fires (dev); trace reconstructs §85 shape; `skipped`/`resolved`/`failed` statuses.
- [ ] **Step 2 — Implement scheduler + executor + ports + trace** against stub authorities.
- [ ] **Step 3 — Verify (P3 quick).**

**Exit criteria:** contract §55–59, §87 mechanics proven on synthetic ops; no production wiring yet (M7 wires TurnBattleSystem).

---

## Mission 3 — BuffSystem core (new engine)

**Files:**
- Create: `game/src/core/buff2/BuffDefinition.ts` — spec §6 schema (`kind`, `instanceScope`, `stacking`, `lifetime`, `application`, `periodic`, `statModifiers`, `controls`, `capabilities`, `dispellable`, `tags`) + startup validation (§56)
- Create: `game/src/core/buff2/BuffInstance.ts` — spec §8 (no `effects[]`, no `potencyAmplified`)
- Create: `game/src/core/buff2/BuffModifier.ts` — §29–34 (channels, add/multiply/set order, reapply policy, lifetimes incl. `buff_lifetime`/`uses`/`holder_turns`/`source_turns`/`rounds`/`battle`/`explicit`)
- Create: `game/src/core/buff2/BuffSystem.ts` — §67 API surface; single per-battle instance store; per_source/per_target identity; lifecycle entry points (§21); canonical holder-turn-end ordering (§28); transaction rule (§68); removal reasons (§39); cleanse (§42)
- Create: `game/src/core/buff2/BuffApplicationResolver.ts` — §12 (chance × source mod × target resist → clamp → `CombatRng.rollChance`)
- Create: `game/src/core/buff2/BuffPeriodicResolver.ts` — §22–27 (emits `BuffPeriodicDamageRequest`/`BuffPeriodicHealRequest` via `PeriodicRequestsCommitted` → the scheduler's periodic bridge materializes ops and owns `CombatOperationOrigin`; dynamic vs snapshot scaling; manual `triggerPeriodic` → `TriggerPeriodicStartResult`)
- Create: `game/src/core/buff2/BuffEvents.ts` — §45–46 payloads incl. `addedStacks` on `BuffAppliedEvent`
- Test: `game/src/core/buff2/*.test.ts` — spec §70 suite on synthetic fixtures (`test_burn`, `test_mark`, `test_stun`)

**Interfaces — Consumes:** `CombatRng`, `CombatScheduler` events, `DamageAuthority` port (M2).
**Produces:** the full §67 API; `ApplyBuffResult` (§17); `PeriodicResolution` (§54); readonly `BuffInstanceSnapshot` queries (§51).

- [ ] **Step 1 — Failing tests first** for each §70 case: per-source vs per-target identity, overcap, apply-at-cap refresh, failed application purity, dynamic vs snapshot periodic, manual tick (no duration loss, consumes `uses` modifier, leaves `holder_turns` modifier), refresh isolation (§35), consume/cleanse/expire/death reasons, modifier reapply=max, deterministic ordering (§55).
- [ ] **Step 2 — Implement definition+registry+validation.**
- [ ] **Step 3 — Implement instance store + apply/stack/duration/modifier ops.**
- [ ] **Step 4 — Implement lifecycle + periodic + events.**
- [ ] **Step 5 — Verify (P3 quick).**

**Exit criteria:** every §70 test green on fixtures; zero references to real buff ids; no production wiring (M4).

---

## Mission 4 — Buff cutover: migrate data + reroute consumers + delete old engine (+ Reaction M-INT)

The largest blast radius. **ONE ATOMIC WORKTREE MISSION — do NOT split into separately mergeable commits** (resync r7): the cutover deletes the `BuffPool` that legacy `TurnReactionManager` reads/mutates, so the consumer cutover AND the legacy-engine deletion must land on one branch — no intermediate state may exist where the pool is gone but the legacy reaction still needs it.

**Hard prerequisite:** reaction **M6 must complete first** — the M-INT sub-steps below consume `ElementalStateRegistry` (reaction megaplan M1) which does not exist before then. Sequence: contract M1–M2 → buff M3 → **reaction M6** → this mission.

**Files:**
- Rewrite: `game/src/data/buff/*` (`buffs.ts`, `TurnBuffs.ts`, `BossBuffs.ts`, `KiemPhoBuffs.ts`, `LegacyBuffs.ts`, `TalentBuffs.ts`, `TheTuBuffs.ts`, `ThuanHeBuffs.ts`, `ZoneDotBuffs.ts`, registries) into `BuffDefinition` v2 — **existing buffs only; no ấn ids**
- Modify: `game/src/core/battle/turn/TurnBattleSystem.ts` — all buff apply/query/tick sites route through scheduler ops or new BuffSystem API
- Modify: `TurnStatusPresentationEvents` consumers — event payloads now carry `instanceId`/reason
- Modify: stat-modifier descriptors (§49), control checks (§50), capability descriptors (§47) consumers
- Modify: pills/artifacts/talents/tribulation appliers (M0 list)
- Delete: `BuffPool` authority, runtime `Buff.effects`, `damagePerTurn`/`damagePerSecond` canonical runtime fields, `scaleBuffPotency`, `potencyAmplified`, `rollOnHitEffects`, `rollReactiveTrigger`, overloaded `update()`, direct `Math.random` in buff paths, silent `remove()`
- Per R4: rename poison-root mechanic keys to clear `doc_can` collision
- If persisted buff shape changes: `saveVersion` bump — same mission, per save policy (`persistentTimedEffects` is NOT touched — R2 corrected census)
- **Reaction M-INT sub-steps (same branch — buff megaplan M4 step 4):** bind production `ElementalStateRegistry` to the five canonical ấn ids; delete `TurnReactionManager.ts` + `canInitiateWuxingReactions` (flag + stamp + call site); grant `elemental_reaction_enabled` to NOBODY; do NOT register `ReactionDispatcher`/`ReactionSystem`/`ReactionRegistry` in production (no valid production registry until canonical content — seal/Ngộ Đạo mission owns registration)

- [ ] **Step 1 — Definition migration + registry validation** (§56) with parity tests over migrated data (same stack caps, durations, elements, dispellable).
- [ ] **Step 2 — Consumer reroute** top-down: TurnBattleSystem → presentation → UI read model → non-battle appliers.
- [ ] **Step 3 — Deletion list execution** (§73); grep-verify each deleted symbol has zero references.
- [ ] **Step 4 — Reaction M-INT on this worktree** (see file list above): canonical `ElementalStateRegistry` bound; legacy engine/flag/callsite deleted; no dispatcher registration; no capability grant.
- [ ] **Step 5 — Verify (P3 full) + P13/P14 Playwright battle drive** (apply buff, DoT tick, cleanse, death cleanup visible in UI/log; **visible-Pháp-Tu elemental application fires NO automatic reaction** — spec-correct post-M-INT).
- [ ] **Step 6 — P4 adversarial QA (deep) + P5 sequential review passes.**

**Exit criteria:** zero old-engine symbols; all migrated buffs behave identically (behavior change = none unless approved); `TurnReactionManager`/`canInitiateWuxingReactions` fully deleted; canonical `ElementalStateRegistry` in place; NO production `ReactionDispatcher` (deferred to canonical-content mission); real-battle runtime evidence captured. **Merge gate: M4 does not merge until the M-INT sub-steps are green.**

---

## Mission 5 — SkillDefinition pipeline

**Files:**
- Create: `game/src/core/skilldef/SkillDefinition.ts` — discriminated union (spec §4–6), `SkillIdentity`, `ActiveSkillClassification`, `TargetingDefinition` (§9), `SkillEffectDefinition` (phase/order/cardinality, §16–17)
- Create: `game/src/core/skilldef/ScalarExpression.ts` — §33 AST evaluator (pure; `divide` guards zero; no NaN/Infinity)
- Create: `game/src/core/skilldef/SkillCondition.ts` + `SkillValueQuery.ts` — §34–36 (readonly, deterministic)
- Create: `game/src/core/skilldef/SkillModification.ts` — §42–44 typed addresses; no deep merge (§45); conflict policy (§48)
- Create: `game/src/core/skilldef/SkillResolver.ts` — §46 layers + cast snapshot (§39–41) + variants (§37–38) → `ResolvedSkillPlan` (§49) + `SkillResolutionTrace` (§50)
- Create: `game/src/core/skilldef/SkillExecutor.ts` — runs plan effects in phase/order, emits `CombatOperation`s to scheduler, builds `SkillPrimaryOutcome` + landed semantic (§19–21), post_resolution effects (§22)
- Create: `game/src/core/skilldef/SkillDefinitionRegistry.ts` — §59 validation (dup ids, unknown refs, range checks, variant targeting)
- Modify: `game/src/core/game/SkillToTurnSkillConverter.ts` seam — adapter maps legacy `Skill`/`TurnSkillDefinition` → `ResolvedSkillPlan` per R6, with dated retirement note
- Test: `game/src/core/skilldef/*.test.ts` — §70 suite with synthetic skills (generic damage+ailment+gain pattern, NOT Dẫn Hỏa)

**Interfaces — Consumes:** `CombatScheduler`, `CombatOperation` types, authority ports (M2), BuffSystem API (M3/4).
**Produces:** `ResolvedSkillPlan`, `SkillCastSnapshot`, `SkillPrimaryOutcome`/`SkillEffectResult` (connected semantics), `SkillResolutionTrace`.

- [ ] **Step 1 — Failing tests:** immutability, phase ordering, cardinality, per-target expressions, landed matrix (hit/absorbed/miss/ailment-only/target-dies-mid-cast), variant snapshot-at-commit, resource cast_snapshot, modifier ordering/conflict, deterministic resolution trace.
- [ ] **Step 2 — Schema + expression evaluator + conditions.**
- [ ] **Step 3 — Resolver (layers + variants + snapshot) + trace.**
- [ ] **Step 4 — Executor on CombatOperations + outcome derivation.**
- [ ] **Step 5 — Legacy adapter at converter seam.**
- [ ] **Step 6 — Verify (P3 quick) + P4 quick.**

**Exit criteria:** §70 green on synthetic kit; no Hỏa skill authored; legacy skills still run through adapter/legacy path per R6.

---

## Mission 6 — ReactionSystem engine

**Files:**
- Create: `game/src/core/reaction/ElementalStateRegistry.ts` — contract §19 (element ↔ buffDefinitionId mapping; unit tests use `test_*` fixtures; **production binding to the five canonical ấn ids lands at M-INT inside M4** — never legacy ailments)
- Create: `game/src/core/reaction/ReactionDefinition.ts` + `ReactionRegistry.ts` — §61–63 validation (5 Sinh + 5 Khắc canonical, unique `selectionTiePriority`)
- Create: `game/src/core/reaction/ReactionSystem.ts` — §64 API (`evaluateAfterElementalApplication` → `buildCandidates` → `selectCandidate` → `resolveCandidate`); fixed-point bias math (§31–32); snapshot + preconditions (§36–42); emits `ReactionResolution` operations only
- Create: `game/src/core/reaction/ReactionBoard.ts` — same-source/same-target board query over BuffSystem (§26)
- Create: `game/src/core/reaction/ReactionTriggerGate.ts` — §23 gate chain (committed event → eligible → addedStacks>0 → capability)
- Modify: capability impl — `CombatCapabilityQuery` backed by battle-build flags/buff capability descriptors (M0 seam; `elemental_reaction_enabled` grant deferred to seal batch per R7)
- Modify: turn engine — `ActionValidator` reads `forbiddenActionTags` buffs (R10; Cấm Công lands as generic restriction buff, tested with `test_seal_attack` fixture)
- Test: `game/src/core/reaction/*.test.ts` — §74–82 on fixture elements/relations

**Interfaces — Consumes:** `ElementalApplicationCommitted`, BuffSystem queries/mutation ops, `CombatCapabilityQuery`, scheduler barrier.
**Produces:** `ReactionResolution`/`ReactionContext`/`ReactionParticipantPrecondition`, `ReactionResolvedEvent`, `ReactionBiasQuery` port.

- [ ] **Step 1 — Failing tests:** P²/A×D strengths, candidate gen ≤4 from trigger element, tie rules (weight → Khắc → tiePriority), pure-refresh no-trigger, source isolation, sequential multicast settle, no recursion (AddBuffStacks emits no elemental event), stale-snapshot preflight skip, no-rollback mid-batch, determinism.
- [ ] **Step 2 — Registry + board + gate.**
- [ ] **Step 3 — Selection + snapshot + resolution→ops.**
- [ ] **Step 4 — Executor-side batch semantics (preflight, consume-first order, skipped-not-rollback).**
- [ ] **Step 5 — Cấm Công restriction buff + ActionValidator enforcement.**
- [ ] **Step 6 — Verify (P3 quick) + P4 quick.**

**Exit criteria:** §74–82 green on fixtures; engine inert in production (capability ungranted, no production wiring); legacy `TurnReactionManager` still live AT THIS POINT — its deletion is M-INT inside M4 (corrected R3; M6 executes BEFORE M4 per the locked execution order).

---

## Mission 7 — Battle wiring + contract hardening

**Implementation-detail authority:** `2026-09-19-megaplan-final-battle-wiring.md` — M7 checkpoints (M7.0–M7.5), the authority/composition audits, contract-closure matrix, canonical acceptance scope, determinism/trace closure, runtime/deletion/DoD closure, and all gate requirements live there. This parent owns execution order only — do not maintain a second M7 implementation plan here.

**Scope (locked):** M7 is the final runtime-architecture closure mission — prove and harden the existing pipeline (`TurnSkillDefinition -> LegacySkillAdapter -> SkillDefinition -> SkillResolver -> ResolvedSkillPlan -> SkillExecutor -> CombatScheduler -> CombatOperationExecutor -> domain authorities`), NOT a rewrite. One atomic worktree; checkpoints are not independently mergeable.

**Exit criteria:** contract §104 DoD items all green; CON-01..CON-23 evidenced; `TurnReactionManager` already DELETED at M4's M-INT — visible Pháp Tu has NO automatic reactions (spec-correct); `ReactionDispatcher` still unregistered pending canonical content; no ấn content shipped; P3 full + P13/P14 Playwright + P4 deep + P5 passes at 0 Blocker / 0 High / 0 Medium.

---

## Deferred to seal batch (out of scope, listed for completeness)

- `hoa_an`, `han_tuc`, `doc_can`, `liet_thuong`, `tran_an` BuffDefinitions + `ElementalStateRegistry` population
- Hỏa skill kit (Dẫn Hỏa Quyết / Xích Viêm / Phần Thiên / Cửu Tiêu) on new SkillDefinition
- `elemental_reaction_enabled` grant + Ngộ Đạo random-cast/multicast kit
- **Production reaction wiring (canonical-content mission):** author + validate production `ReactionRegistry` (all 10 relations + `buffExists` on real ids) → construct `ReactionSystem` → register `ReactionDispatcher` on `elemental_application_committed`. (`TurnReactionManager`/`canInitiateWuxingReactions` are already dead — deleted at M-INT inside M4, NOT here.)
- The 10 reaction payoff definitions (Dưỡng Viêm … Trấn Thủy) and Cấm Công production buff
- Độc Căn colliding-name cleanup finalization (R4 completes in seal data)

## Self-review notes

- **Spec coverage:** contract §1–105 → M1 (types/rng), M2 (scheduler/settlement/trace), M3–M4 (buff authority + cutover), M5 (skill pipeline), M6 (reaction engine), M7 (wiring + DoD). Hỏa Ấn spec = deferred batch only.
- **Execution order vs labels:** mission numbers are scope labels; the locked sequence is `M0→M1→M2→M3→M6→M4(+M-INT)→M5→M7` — reaction M6 precedes buff M4 because M-INT consumes the reaction package.
- **Type consistency:** `CombatOperation`, `ApplyBuffResult`, `ReactionEligibility`, `ElementalApplicationCommitted`, `selectionTiePriority`, `forbiddenActionTags`, `combatSequence` — single canonical spelling used across missions.
- **Known risk:** M4 is the make-or-break mission (live-data cutover); M0 inventory must be exhaustive or M4 will surface surprise consumers mid-flight.
