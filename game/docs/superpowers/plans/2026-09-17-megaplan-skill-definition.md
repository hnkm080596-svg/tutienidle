# Skill Definition System — Implementation Megaplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Non-trivial production missions MUST follow `game/docs/architecture/architecture-worker-workflow.md` (G0–G5) and return the G5 evidence report.

**Goal:** Replace today's THREE converging skill representations — legacy `Skill`+`SkillEffect[]` (`core/skill/Skill.ts`), the `TriggerBinding[]`/`SkillAction` path (`SkillTriggerRunner`/`SkillActionRegistry`), and the flat `TurnSkillDefinition` turn-engine shape — with ONE pipeline: immutable `SkillDefinition` (authored intent) → `SkillResolver` (definition + cast snapshot + progression + route → `ResolvedSkillPlan`) → `SkillExecutor` (plan → ordered `ResolvedCombatOperation`s through the `CombatScheduler`). `TurnSkillDefinition` survives ONLY as the executor's adapter input during migration; `Skill` runtime fields (level/xp/loadout/unlocked/equipped) split off into `SkillRuntimeState` owned by `SkillSystem`.

**Architecture:** New package `game/src/core/skilldef/` (definition types, schema validation, resolver, executor) + `game/src/data/skilldef/` (migrated content later; this program ships the SCHEMA + a `LegacySkillAdapter` covering the current authored surface). Cast flow: `TurnBattleSystem.declareActorAction` gains a plan-resolution seam — the selected `TurnSkillDefinition` resolves through `SkillResolver` into a `ResolvedSkillPlan` whose operations the scheduler drains with settlement barriers, so an interleaved `apply_buff` + `read_stacks` + `deal_damage` sequence sees post-reaction state (contract §63).

**Tech Stack:** Vue 3, TypeScript, Vite, Vitest, Pinia, Phaser.

**Specs:**
- `game/docs/specs/2026-09-17-skill-definition-system-spec.md` (v1.1 — THE source of truth)
- `game/docs/specs/2026-09-17-combat-systems-contract-spec.md` (v1.1 — `ResolvedCombatOperation`, origins `kind:'skill'`, `castId`/`subcastIndex`, settlement)
- `game/docs/specs/2026-09-17-buff-system-reimagined-spec.md` (consumed ops: `ApplyBuff`, `TriggerBuffPeriodic`, `ConsumeBuffStacks`, `AddBuffStacks`, `read_stacks` query)

**Sibling-plan dependency:** Expansion of the Skill scope in `game/docs/superpowers/plans/2026-09-17-combat-systems-reimagined.md` (its M5). **Hard prerequisites:** contract megaplan M1–M3 (operations, scheduler, authority ports incl. `fractionOfOperationResult` heal) AND buff megaplan M1–M2 (`BuffDefinition`/`BuffSystem`/`ApplyBuffRequest`). M0 verifies; if absent → BLOCKED. The `SkillExecutor` emits operations — it NEVER calls `BuffSystem`/`CombatSystem` directly.

## Global Constraints

- **One pipeline at the end (spec INV-S2):** the migration is staged — `LegacySkillAdapter` lets ALL current content ride the new pipeline as authored definitions; the OLD `SkillEffectSystem`/`SkillTriggerRunner` execution paths die in M5 (the real-time `BattleSystem`/`SkillEffectSystem` is already superseded — `SkillToTurnSkillConverter` + strict errors is today's effective boundary; confirm census in M0).
- **Definitions never carry runtime state (CON-01):** no `targetId`, `instanceId`, `combatSequence`, cooldown *remaining*, xp, equipped — `SkillRuntimeState` owns those.
- **Resolver snapshots at cast commit (spec §24–27):** variants (`empowerment`, composite pool pick), empowerment `theBurned`, resource costs, stat scalars — captured once; later ops read the snapshot, never re-query mutable state mid-plan.
- **Deterministic ordering (spec §34):** plan ops execute in authored order with scheduler barriers between them; multicast/repeat subcasts settle sequentially (contract §60–61).
- **No path-specific branches (CON-23):** `compositePicks`, `multicast`, `empowerment`, `detonateDoT`, `theScaling`, `counterable`, `chargeTurns` become GENERIC authored fields on `SkillDefinition` — same data, new home. The Hỏa kit lands as data later.
- **P3:** quick per mission; **full for M4** (touches `declareActorAction`/`resolveDeclaredHit` hot path). **P4** quick per mission, deep at M4. **P5** round per mission. **P7** explicit authorization per commit. **P13/P14** Playwright real battle at M4.
- **Per-mission report:** changed / files / authority moved / adapters remaining / tests / build status / behavior changes (=None) / risks / next.

## Canonical names (locked across sibling plans)

**Consumes:** `ResolvedCombatOperation`, `CombatOperationOrigin` (`kind:'skill'`, `castId`, `subcastIndex`), `CombatOperation` union (skill executor emits the WHOLE vocabulary — `DealDamage`, `Heal`, `ApplyBuff`, `ConsumeBuffStacks`, `TriggerBuffPeriodic`, `PushGauge`, `GainResource`, `ConsumeResource`, `ApplyShield`), `CombatScheduler` (barriers between ops), `CombatOperationExecutor`, `CombatRng` (composite picks, multicast, ailment rolls — rolls route through scheduler context, NOT embedded in definitions), `ApplyBuffRequest` (`reactionEligibility` set here — the skill is the eligibility AUTHORITY per contract §14–15).

**Produces:** `SkillDefinition`, `AuthoredSkillOperation`, `SkillTargetIntent`, `SkillCondition`, `SkillPhase`, `SkillRuntimeState`, `CastSnapshot`, `ResolvedSkillPlan`, `SkillPlanOperation`, `SkillResolver`, `SkillExecutor`, `SkillCastOutcome` (`landed`/`whiffed`/`interrupted`/`blocked`), `LandedSemantics` (`landed` independent of damage amount — spec §41), `LegacySkillAdapter` (`Skill`+`EffectiveSkill`+`TurnSkillDefinition` → `SkillDefinition`), `SkillDefinitionRegistry` (startup validation), `OperationResultQuery` (`read_stacks`/`read_hp`/`read_resource` mid-plan reads — spec §30/§63).

## Ruling assumptions — pending user sign-off

| # | Assumption | Rationale |
|---|---|---|
| R6 | `SkillRuntimeState` = `{skillId, level, experience, totalExperience, selectedSpecializationId, unlocked, equipped, loadoutSlots}` — stays owned by `SkillSystem`; `Skill` interface SPLITS into `SkillDefinition` (immutable) + `SkillRuntimeState` (mutable). Save schema gains a migration step at the ops layer (versioned already — check `GameManagerSave*`). | Spec §10–12; `Skill.ts:55–197` mixes all of it today. |
| R8 | `castTime`/`execution` policy: turn engine uses `cooldownTurns`/`chargeTurns` (turn units); real-time `SkillExecutionPolicy` kinds are RETIRED authored metadata — `LegacySkillAdapter` drops them (kept on legacy `Skill` for tooltip). Turn-engine `chargeTurns` maps to authored `phases` with a `charge` phase. | Spec R8; `Skill.execution` doc itself says turn engine doesn't consume it. |
| R-S1 | `ResolvedSkillPlan` is a flat ordered op list with barrier markers (not a tree): `[{op, barrierAfter:boolean}]`. Charge/multicast/repeat produce SEPARATE plans enqueued by the executor after settlement — preserves today's queue semantics (`pendingQueuedExecution`/`enqueueFollowUpExecutions`). | Contract §60: subcast 2 sees post-settle state — sequential plans, not nested. |
| R-S2 | `SkillCastOutcome.landed` = "at least one landed hit on ≥1 valid target OR a non-damage action resolved" — matches today's `landedTargetIds.length > 0` + buff-only self casts; `executionCommitsCast` semantics preserved. Reaction does NOT retro-change it (contract §65). | Spec §41; current behavior `TurnDeclaredAction.landedTargetIds`. |
| R-S3 | `OperationResultQuery` reads go through the SAME authority ports (buff `getStacks`, entity vitals read) but are executor-side synchronous reads BETWEEN barriers — not operations themselves (they mutate nothing). | Contract §63's "read Hỏa stacks" example needs a legal read path mid-plan. |
| R-S4 | `appliesAilment(s)` → authored `apply_ailment` op carrying `reactionEligibility:'eligible'` ONLY when the skill authors it eligible — `initiatesReactions` flag (currently `actor.canInitiateWuxingReactions`, `TurnBattleSystem.ts:1441/2978`) maps to a per-cast decision the ADAPTER computes from the legacy flag; native defs author `reactionEligibility` directly. Bridge keeps legacy `TurnReactionManager` firing until seal batch (reaction plan R3). | Contract §14–16: eligibility is request metadata; who decides = caster authority at resolve time. |
| R-S5 | `SkillEffect` fields the turn engine reports-but-can't-execute (`collectUnsupportedSkillSemantics`: `hitCountByRealm`, `hitCount`, `realmDamageRatio`, `skillExperienceRatio`, `spreadsAilmentId`, `stacksPerAffectedTarget`, `scope`, `refresh`, `grantsZone`, `zoneElement`, `swordZone*`, `breakDamagePerHit`) are IN-SCHEMA authored op fields in the new `SkillDefinition` — the adapter emits them as real ops where a semantic exists (`hitCount` → `hitCount` on DealDamage; `spreadsAilmentId` → `apply_ailment` scoped op; `grantsZone` stays unsupported → still reported, not dropped). | A8: unsupported semantics must stay LOUD; new schema widens what's executable, keeps the honesty channel. |
| R-S6 | `Skill.specializations`/`selectedSpecializationId` resolution stays in `SkillSystem.getEffectiveSkill` — the resolver receives the already-specialized authored def + runtime state. Specialization = choosing WHICH authored def variant resolves; not plan-time branching. | Preserves `SkillSystem.selectSpecialization` API + `EffectiveSkill` contract (`SkillSystem.ts:74`). |

---

## Mission 0 — Inventory + prerequisite verification (read-only)

**Files:**
- Create: `game/docs/architecture/2026-09-17-skilldef-inventory.md`

- [ ] **Step 1 — Lock baseline:** `git rev-parse HEAD`.
- [ ] **Step 2 — Verify prerequisites (BLOCKING):** contract ops union + `CombatOperationOrigin{kind:'skill',castId,subcastIndex}` + `originId`; scheduler `enqueueOperation`/`runUntilQuiescent`; `BuffAuthority`/`DamageAuthority`/`GaugeAuthority`/`ResourceAuthority` ports; buff2 `ApplyBuffRequest.reactionEligibility` + `getStacks` + `triggerPeriodic` + `consumeStacks`. Missing → BLOCKED.
- [ ] **Step 3 — Skill producer census (drives adapter coverage):**
  - `data/skill/` (~9,152 lines total): `CoreSkills.ts`(671), `PhapTuChainSkills.ts`(1020), `PhapTuEmpoweredUlts.ts`(142), `PhapTuUltimates.ts`(30), `TheTuSkills.ts`(404), `NguKiemDaoSkills.ts`(38), `KiemPhoCombos.ts`(88), `KiemPhoOrbs.ts`(77), `PassiveSkills.ts`(522), `TalentPassives.ts`(182), `Skills.ts`(24), `TurnAnKitSkills.ts`(63), `TurnBasicAttacks.ts`(78). For each: does it produce `Skill` (legacy shape), `TurnSkillDefinition` (direct), or both? (`TurnAnKitSkills`/`TurnBasicAttacks` likely author `TurnSkillDefinition` directly — CONFIRM.)
  - Orchestrator-authored `TurnSkillDefinition`s: `buildTheTuAnKit`/`collectTheTuAnMechanicModifiers` (Thế Tu clones with baked node bonuses), `linh_ngo_*` empowerment attach site (`TurnSkillDefinition.empowerment`), `compositePicks.pool` attach (Pháp Tu Ẩn), emblem defs (`emblemOnly`), `dynamicBasic` providers (Ngự Kiếm Đạo `instances`+`perInstanceOptions`).
  - `SkillSystem` surface: `getEffectiveSkill`, `selectSpecialization`, `equipToSlot`/`getLoadoutSkills`, `getCastLeveledSkillLevel`/`getHuyKiemFlatDamageBonus` (xp→damage inputs the resolver snapshot must feed).
  - `PassiveSystem` (`core/passive/`): `passiveTrigger`/`passiveModifiers`/`passiveCondition`/`passiveConvertsTo` — passive defs' separate pipeline; decide absorb-or-parallel (R-S7 below).
- [ ] **Step 4 — Cast-path trace (exact seam list):** `declareActorAction` (`:894`) → queued-execution branch (`:901`) → reactive bypass (`:906`) → round/cooldown/CC/resource commit → `selectAction`/`selectForcedAction` (`:1241-1243`) → `TurnDeclaredAction` → `applyActionImpact` → `resolveDeclaredHit` (`:1748`, per-target loop `:2034-2070`) → `applySkillAilments` (`:2939`) → `enqueueFollowUpExecutions` (`:2217`). Record where `rootActionId`/`castId`/`subcastIndex` mint (declare = rootAction+castId; each queued execution = subcastIndex++).
- [ ] **Step 5 — `SkillActionRegistry`/`SkillTriggerRunner` usage census:** which skills still declare `triggers` (find `triggers:` in `data/skill/**` — `tram` confirmed by converter comment); whether `SkillTriggerRunner`/`SkillActionRegistry`/`SkillEffectSystem` are still invoked ANYWHERE in the live turn path or dead-but-referenced (`grep -rn "SkillTriggerRunner\|SkillActionRegistry\|SkillEffectSystem" src/`).
- [ ] **Step 6 — Write authority matrix + R6/R8/R-S1..R-S7 table.**

**Exit criteria:** every authored-skill producer + every `TurnSkillDefinition` field mapped to a `SkillDefinition` field or an explicit "stays legacy-adapter-only" note; live-vs-dead trigger path confirmed; prereqs verified.

---

## Mission 1 — SkillDefinition schema + runtime state split + validation

**Files:**
- Create: `game/src/core/skilldef/SkillDefinition.ts` — authored shape
- Create: `game/src/core/skilldef/SkillRuntimeState.ts` — mutable state interface
- Create: `game/src/core/skilldef/AuthoredOperation.ts` — `AuthoredSkillOperation` union + target intents + conditions
- Create: `game/src/core/skilldef/SkillDefinitionRegistry.ts` — catalog + startup validation
- Test: `SkillDefinition.test.ts`, `SkillDefinitionRegistry.test.ts`

**Interfaces — Produces:**

```ts
// SkillDefinition.ts — spec §14–20; immutable authored intent
export interface SkillDefinition {
  id: SkillId
  name: string
  type: 'active' | 'passive'
  targetIntent: SkillTargetIntent          // 'self' | 'enemy' | 'all_enemies' | 'ally' | 'all_allies' — authored, no runtime ids
  actionTags?: readonly string[]           // 'attack' | 'heal' | 'buff' | 'cleanse' | 'defend' | 'utility' — Cấm Công's tag taxonomy (reaction plan R-E2 upgrade path)
  cadence: { cooldownTurns: number; chargeTurns?: number }
  cost?: { resourceType: 'none' | 'mana' | 'the'; amount: number }   // 'the' gates Thế Tu ults
  operations: readonly AuthoredSkillOperation[]   // ordered; barriers default between ops
  subcasts?: {                              // replaces multicast/repeatCasts/compositePicks
    count?: number                          // fixed repeats (repeatCasts)
    multicast?: { chance: number; maxExtraCasts: number }
    compositePool?: readonly SkillDefinitionId[]   // element_basic: pick N, resolve picks[0]
    compositeCount?: number
  }
  variants?: {                              // replaces empowerment + specialization-selected payloads
    empowerment?: { theThreshold: number; empoweredSkillId: SkillId; consumesAllThe?: boolean }
  }
  landed?: LandedSemantics                  // override; default = R-S2
  grants?: { theOnLandedCast?: number; theOnCrit?: number }   // theGainOnLandedCast/theGainOnCrit
  presentation?: { presetId?: CombatVfxPresetId }             // vfx only — never gameplay
  counterable?: boolean
  counterSkillId?: SkillId | null
  emblemOnly?: boolean
  detonate?: { amp: number }                // detonateDoT — generic ailment-cash-in op sugar
  theScaling?: { coeff: number }
  instances?: { count: number }             // Ngu Kiem Dao multi-hit (perInstanceOptions is RUNTIME — see R-S8)
}

// AuthoredOperation.ts — contract §3: intent only, zero runtime ids
export type AuthoredSkillOperation =
  | { type: 'deal_damage'; target: SkillTargetIntent; coefficient?: number; components?: SkillDamageComponent[]; damageType?: 'physical' | 'primordial'; hitCount?: number; canCrit?: boolean; canMiss?: boolean; scaling?: AuthoredScaling; consumeBuff?: { definitionId: BuffDefinitionId; damagePerStack: number; scope?: 'own' | 'any'; healPercentOfDamage?: number }; consumeWard?: { damagePerWardPoint: number }; healPercentOfDamage?: number }
  | { type: 'heal'; target: SkillTargetIntent; amount?: number; fractionOfMaxHp?: number; fractionOfOperationResult?: { fraction: number; capFractionOfTargetMaxHp: number } }
  | { type: 'apply_buff'; target: SkillTargetIntent; definitionId: BuffDefinitionId; stacks?: number; chance?: number; durationOverride?: number; reactionEligibility?: ReactionEligibility }   // DEFAULT 'suppressed' — elemental defs must opt in (R-S4 adapter maps legacy flag)
  | { type: 'add_buff_stacks' | 'remove_buff_stacks' | 'consume_buff_stacks'; target: SkillTargetIntent; definitionId: BuffDefinitionId; stacks: number | 'all' }
  | { type: 'add_buff_modifier' | 'remove_buff_modifier'; target: SkillTargetIntent; definitionId: BuffDefinitionId; modifier: AuthoredModifier }
  | { type: 'refresh_buff_duration' | 'extend_buff_duration'; target: SkillTargetIntent; definitionId: BuffDefinitionId; turns?: number }
  | { type: 'trigger_buff_periodic'; target: SkillTargetIntent; definitionId: BuffDefinitionId; periodicId?: string }   // spec §30 — manual DoT cash-in (detonate under it)
  | { type: 'remove_buff'; target: SkillTargetIntent; definitionId: BuffDefinitionId; polarity?: 'buff' | 'debuff'; count?: number }  // cleanse — legacy 'remove_buff' effect
  | { type: 'push_gauge'; target: SkillTargetIntent; fractionOfMax: number }
  | { type: 'gain_resource' | 'consume_resource'; target: SkillTargetIntent; resourceId: string; amount: number | 'all' }
  | { type: 'apply_shield'; target: SkillTargetIntent; amount: number }
  | { type: 'read_stacks'; target: SkillTargetIntent; definitionId: BuffDefinitionId; into: string }     // writes ctx.vars[into] — feeds later op conditions/values
  | { type: 'if'; condition: SkillCondition; then: readonly AuthoredSkillOperation[]; else?: readonly AuthoredSkillOperation[] }
  | { type: 'for_each_target'; target: SkillTargetIntent; ops: readonly AuthoredSkillOperation[] }

export type SkillTargetIntent = 'self' | 'primary_target' | 'affected_targets' | 'all_enemies' | 'allies_except_self' | 'all_allies' | 'attacker' // attacker = reactive context
export type SkillCondition =
  | { kind: 'stacks_at_least'; target: SkillTargetIntent; definitionId: BuffDefinitionId; stacks: number }
  | { kind: 'resource_at_least'; resourceId: string; amount: number }
  | { kind: 'target_alive' }
  | { kind: 'var'; name: string; op: 'gte' | 'lt' | 'eq'; value: number }
  | { kind: 'crit_landed' } | { kind: 'any_target_landed' }

// SkillRuntimeState.ts (R6)
export interface SkillRuntimeState {
  skillId: SkillId; level: number; experience: number; totalExperience: number
  selectedSpecializationId?: string
  unlocked: boolean; equipped: boolean; loadoutSlots: number[]
}
```

- [ ] **Step 1 — Failing tests (schema):** registry validates unique ids, all `definitionId`/op references resolvable (buff registry + skill registry predicates), `subcasts.compositePool` non-empty when present, `empowerment.empoweredSkillId` exists, no authored field carries runtime ids (deep-scan guard: reject keys `targetId|sourceId|instanceId|combatSequence` — CON-01 structural test).
- [ ] **Step 2 — Failing tests (runtime split):** `SkillRuntimeState` covers every non-auth `Skill` field (`level`/`experience`/`totalExperience`/`selectedSpecializationId`/`unlocked`/`equipped`/`loadoutSlot(s)`); `unreleased`/`buildTag`/`castTime`(real-time)/`execution`(real-time)/`vfxPresetId` classified as authored-presentation or dropped — the classification table lands in the inventory doc.
- [ ] **Step 3 — Implement + verify (P3 quick).**

**Exit criteria:** schema covers the FULL `TurnSkillDefinition` surface (every field mapped — census table) + the executable `SkillEffect` surface; structural "no runtime ids" test guards CON-01.

---

## Mission 2 — CastSnapshot + SkillResolver + ResolvedSkillPlan

**Files:**
- Create: `game/src/core/skilldef/CastSnapshot.ts`
- Create: `game/src/core/skilldef/ResolvedSkillPlan.ts` — plan + op list + barrier marks
- Create: `game/src/core/skilldef/SkillResolver.ts`
- Test: `SkillResolver.test.ts`, `ResolvedSkillPlan.test.ts`

**Interfaces — Produces:**

```ts
// CastSnapshot.ts — spec §24–27: frozen at cast commit
export interface CastSnapshot {
  castId: string                        // minted per commit
  rootActionId: string
  sourceId: CombatEntityId
  definitionId: SkillId
  resolvedVariantId?: SkillId           // empowered def id when swapped
  compositePicks?: readonly SkillId[]   // rolled ONCE here (rng at RESOLVE, not in ops)
  resourcesConsumed: Readonly<Record<string, number>>   // {the: burnedAmount} — spec §26 pre-consume capture
  statScalars: Readonly<Record<string, number>>         // attributeScaling inputs, manaScalingRatio base, realmIndex, xp-derived (getCastLeveledSkillLevel/getHuyKiemFlatDamageBonus outputs)
  declaredTargetIds: readonly CombatEntityId[]
}

// ResolvedSkillPlan.ts
export interface SkillPlanOperation {
  operation: ResolvedCombatOperation      // fully resolved payload (contract §4)
  barrierAfter: boolean                   // settlement barrier before next op (contract §55)
}
export interface ResolvedSkillPlan {
  castId: string
  rootActionId: string
  sourceId: CombatEntityId
  definitionId: SkillId
  subcastIndex: number
  operations: readonly SkillPlanOperation[]
  conditions: readonly SkillCondition[]   // evaluated per-op-group at execute
  snapshot: CastSnapshot
}

// SkillResolver.ts — spec §21–23; pure (no combat mutation)
export class SkillResolver {
  constructor(private readonly skills: SkillDefinitionRegistry, private readonly rng: CombatRng)
  resolve(input: {
    definition: SkillDefinition            // already specialization-resolved (R-S6)
    sourceId: CombatEntityId
    declaredTargetIds: readonly CombatEntityId[]
    runtime: SkillRuntimeState             // level/xp feed statScalars
    sourceStats: StatReadPort              // scaling inputs captured into snapshot
    entityQuery: { currentThe(id): number; currentMp(id): number; alive(id): boolean }
    castId: string; rootActionId: string; subcastIndex: number
  }): ResolvedSkillPlan
  // internally: pick variant (empowerment the-check → resolvedVariantId + consumesAllThe capture),
  // roll compositePool, freeze resourcesConsumed BEFORE plan ops, translate each
  // AuthoredSkillOperation → ResolvedCombatOperation (selectors resolved to entity ids,
  // origin {kind:'skill', originId:definitionId, castId, subcastIndex, rootActionId})
}
```

**Target resolution (deterministic, spec §31–33):** `primary_target` → `declaredTargetIds[0]`; `affected_targets` → full declared set; `all_enemies`/`allies_except_self` → resolved at resolve-time from `entityQuery` in STABLE participant order (battle roster order, never set-iteration). `read_stacks`/`if` evaluate at EXECUTE via `OperationResultQuery` (R-S3) — the plan stores the authored condition, the executor evaluates it live between barriers (post-reaction state visible — contract §63).

- [ ] **Step 1 — Failing tests (snapshot):** composite pool rolled once in resolver (same rng sequence → same picks); `consumesAllThe` captures `theBurned` BEFORE the plan's `consume_resource` op zeroes it (Task 13 parity — `theScaling` reads snapshot, not live pool); `statScalars` freeze attribute/mana-scaling inputs.
- [ ] **Step 2 — Failing tests (plan shape):** authored op order preserved; barrier defaults true between ops; `empowerment` below-threshold → base def plan; `if` conditions carried as authored (not pre-evaluated); `read_stacks` emits a plan read-node not a mutation op.
- [ ] **Step 3 — Failing tests (origin):** every emitted op carries `origin{kind:'skill', originId, castId, subcastIndex, rootActionId}`; multicast subcast `subcastIndex` increments.
- [ ] **Step 4 — Implement + verify (P3 quick).**

**Exit criteria:** resolver is pure + deterministic under seeded rng; plan ops carry full causal ids; snapshot freeze proven for the three hard cases (composite pick, the-burn, scaling inputs).

---

## Mission 3 — SkillExecutor + plan reads + subcast driving

**Files:**
- Create: `game/src/core/skilldef/SkillExecutor.ts`
- Create: `game/src/core/skilldef/OperationResultQuery.ts` — mid-plan read port
- Test: `SkillExecutor.test.ts`, `SkillPlanReads.test.ts`, `SkillSubcast.test.ts`

```ts
// SkillExecutor.ts — drives ONE ResolvedSkillPlan through the scheduler
export class SkillExecutor {
  constructor(
    private readonly scheduler: CombatScheduler,
    private readonly resolver: SkillResolver,
    private readonly queries: OperationResultQuery,   // buffs.getStacks, entity vitals, resource reads
    private readonly entityQuery: { alive(id: CombatEntityId): boolean },
  )
  /** Executes plan ops in order; between ops: scheduler.runUntilQuiescent() barrier. */
  execute(plan: ResolvedSkillPlan): SkillCastOutcome
  /** Queues follow-up plans: subcasts (repeat/multicast), composite extra picks — each its own ResolvedSkillPlan with subcastIndex++ and its own settle (contract §60). */
  enqueueSubcasts(plan: ResolvedSkillPlan): void
}

// OperationResultQuery.ts — R-S3: synchronous reads between barriers
export interface OperationResultQuery {
  stacksOf(definitionId: BuffDefinitionId, sourceId: CombatEntityId, targetId: CombatEntityId): number
  alive(id: CombatEntityId): boolean
  resource(id: CombatEntityId, resourceId: string): number
  lastOpResult(operationId: CombatOperationId): CombatOperationResult | undefined   // healPercentOfDamage etc.
}
```

**Execution semantics:**
- `barrierAfter` → `scheduler.runUntilQuiescent()` then evaluate the NEXT op's `if`/`read_stacks` against post-settlement state (the §94 contract test: apply Hỏa → reaction consumes → `read_stacks` sees 0).
- Target death mid-plan: ops with dead required targets → `{status:'skipped', reason:'invalid_target_state'}`, plan continues (contract §49) — BUT `landed` computes from committed results only.
- Subcast driving: `subcasts.count`/`multicast` → after parent plan settles, resolver produces `plan(subcastIndex+1)` (composite re-rolled per subcast — Task 11 parity: "re-rolls compositePicks"); enqueue each, execute sequentially.
- `detonate` sugar expands to: `read_stacks` per dot-ailment → `consume_buff_stacks('all')` → `deal_damage` scaled by read vars → re-seed `apply_buff{stacks:1, reactionEligibility:'suppressed'}` (Task 13 spec: "reaction-silent — never fires TurnReactionManager").

- [ ] **Step 1 — Failing tests (ordering/settlement):** plan `[apply_buff(eligible), read_stacks, deal_damage]` against a stub that consumes the buff on the elemental event → `read_stacks` returns 0 (contract §94 verbatim).
- [ ] **Step 2 — Failing tests (outcome):** all-miss plan → `landed:false`; buff-only self cast → `landed:true` (R-S2); dead-target mid-plan → trailing ops skipped, earlier committed, no rollback.
- [ ] **Step 3 — Failing tests (subcasts):** `multicast{chance:1,maxExtraCasts:2}` → 2 extra plans, each settling before next (order log), composite re-roll per subcast; death between subcasts → remaining queued plans skipped (contract §62).
- [ ] **Step 4 — Failing tests (detonate/re-seed):** detonate consumes only `kind:'ailment'` instances with `dot`/`periodic` effects (utility ailments untouched — Task 13 semantics), re-seed at authored duration with `suppressed` eligibility.
- [ ] **Step 5 — Implement + verify (P3 quick).**

**Exit criteria:** executor drives plans through the scheduler with real barriers; mid-plan reads see post-settlement state; subcast sequencing + death handoff proven.

---

## Mission 4 — LegacySkillAdapter + TurnBattleSystem integration

**Files:**
- Create: `game/src/core/skilldef/LegacySkillAdapter.ts` — `Skill`/`EffectiveSkill`/`TurnSkillDefinition` → `SkillDefinition`
- Modify: `game/src/core/battle/turn/TurnBattleSystem.ts` — `declareActorAction`/`applyActionImpact` resolve the selected action through `SkillResolver`+`SkillExecutor` (behind the adapter); `applySkillAilments`/`appliesBuffs`/`detonate`/`consumesAilmentId` lanes all become authored ops
- Modify: `game/src/core/battle/turn/TurnBattleAdapter.ts` + orchestrator sites (`buildTheTuAnKit`, Pháp Tu Ẩn kit, empowerment attach) — emit `SkillDefinition` fields (or keep emitting `TurnSkillDefinition` and let the adapter lift them — adapter must handle BOTH producers per M0 census)
- Test: `LegacySkillAdapter.test.ts`, `TurnBattleSystem.skilldef.test.ts`

**Adapter coverage map (the critical table — every producer field → authored op):**

| Source field | → SkillDefinition |
|---|---|
| `damage: ActionDamageInfo` (physical/primordial/elemental+scaling) | `deal_damage` op with `components`/`damageType`/`scaling` |
| `appliesBuff`/`appliesBuffs` (+`externalWardGrant`, target modes) | `apply_buff` ops, `reactionEligibility:'suppressed'` |
| `appliesAilment(s)` | `apply_buff` ops, `reactionEligibility` ← `canInitiateWuxingReactions` flag (R-S4) |
| `consumesAilmentId`+`damagePerStack` | `deal_damage.consumeBuff{scope:'own'}` (legacy 'any' via scope field — E-3 spread semantics separate) |
| `consumesWardForDamage` | `deal_damage.consumeWard` |
| `healPercentOfDamage` | `deal_damage.healPercentOfDamage` |
| `chargeTurns`/`cooldownTurns` | `cadence` |
| `compositePicks` | `subcasts.compositePool`/`compositeCount` |
| `repeatCasts` | `subcasts.count` |
| `multicast` | `subcasts.multicast` |
| `empowerment`/`consumesAllThe` | `variants.empowerment` |
| `detonateDoT` | `detonate` sugar (executor expands, M3 step 4) |
| `theScaling` | `theScaling` (snapshot `theBurned` × coeff on the damage op) |
| `theGainOnLandedCast`/`theGainOnCrit` | `grants` → `gain_resource` ops conditioned on `any_target_landed`/`crit_landed` |
| `instances`/`perInstanceOptions` | `instances{count}`; `perInstanceOptions` is a runtime closure — R-S8: keep as an executor-level per-instance options provider injected by the orchestrator (data can't express it) |
| `counterable`/`counterSkillId`/`emblemOnly`/`presetId`/`targetScope`/`resourceType`/`resourceCost`/`targeting`/`chargeTurns` | same-named authored fields |
| `Skill.effects` legacy | adapter: `damage`→`deal_damage`, `buff`/`debuff`/`add_stack`→`apply_buff`/`add_buff_stacks`, `heal`→`heal`, `remove_buff`→`remove_buff`; `SkillEffectSystem`-only fields (spread/zone/hitCountByRealm…) → R-S5 mapping or unsupported-report |
| `Skill.triggers` (onCast→dealDamage only per converter) | `operations` list from actions (`dealDamage`,`heal`,`applyBuff`,`applyDebuff`,`consumeForDamage`→`consumeBuff`,`consumeResource`/`grantResource` — breakGauge legacy pool → resource op) |
| `PassiveSkills`/`TalentPassives` | R-S7: passives stay on `PassiveSystem` THIS program — `SkillDefinition.type:'passive'` schema exists but migration deferred (passive triggers are a separate runtime; folding them in now doubles the blast radius for zero combat-visible gain). Flag for seal batch. |

- [ ] **Step 1 — Failing tests (adapter parity):** for every data/skill producer file, `adapter.convert` output ops == the semantics today's converter produces (`toTurnSkillDefinition` table above); `collectUnsupportedSkillSemantics` parity — adapter reports the SAME unsupported fields (loud channel preserved, R-S5).
- [ ] **Step 2 — Failing tests (integration):** scripted battle — a buff+ailment skill emits `apply_buff`(suppressed) THEN `apply_buff`(eligible) as separate barriered ops; empowered ult captures `theBurned`; multicast queues extra subcasts; `consumesAilmentId` reads live stacks post-settlement.
- [ ] **Step 3 — Implement adapter + reroute** the cast lane (`resolveDeclaredHit` internals map onto plan execution — damage/ailments through ops; the hit-resolution details like evasion/crit/armor stay inside the `DamageAuthority`).
- [ ] **Step 4 — Verify (P3 FULL) + P13/P14 Playwright real battle + P4 deep + P5.**

**Exit criteria:** ONE pipeline — every cast in turn combat resolves through `SkillResolver`→`SkillExecutor`→scheduler; adapter lifts all legacy producers; zero regression in the battle suite.

---

## Mission 5 — Legacy path retirement + DoD sweep + docs

**Files:**
- Delete (only after M4 green): `SkillToTurnSkillConverter.ts` (adapter replaces it), `SkillTriggerRunner.ts`/`SkillActionRegistry.ts`/`SkillAction.ts`/`SkillTrigger.ts` IF census confirmed dead in turn path (else keep as non-combat legacy — record decision), `SkillEffectSystem.ts` same
- Modify: `Skill.ts` — split runtime fields out (consumers migrate to `SkillRuntimeState`); `SkillSystem.getEffectiveSkill` returns `{definition, runtime}` pair
- Update: `docs/systems/skills.md` or equivalent + roadmap

- [ ] **Step 1 — Deletion sweep** gated on `git grep` clean + suite green.
- [ ] **Step 2 — Spec DoD sweep** (§90+ checklist → named tests).
- [ ] **Step 3 — Verify (P3 FULL) + P4 + P5.**

**Exit criteria:** no parallel skill pipeline remains; spec §90 DoD rows all mapped.

## Test matrix — spec/contract → named tests

| Source | Requirement | Test |
|---|---|---|
| §14/CON-01 | no runtime ids in defs | `SkillDefinition.test.ts :: structural runtime-id scan` |
| §21–27 | snapshot freeze | `SkillResolver.test.ts :: composite/the-burn/scaling cases` |
| §30/§63/§94 | op ordering + post-reaction reads | `SkillExecutor.test.ts :: apply-then-read sees 0` |
| §41/§65 | landed semantics vs reaction | `:: landed survives downstream reaction` |
| §34/§60–62 | sequential subcasts, death handoff | `SkillSubcast.test.ts` |
| §73 | trigger_buff_periodic no lifetime advance | `SkillExecutor.test.ts :: manual tick` |
| §88 | seeded determinism | `SkillResolver.test.ts :: seeded composite` |
| INV-S2 | one pipeline | `TurnBattleSystem.skilldef.test.ts :: all casts resolve via plan` |

## Deferred

- Passive migration (`PassiveSystem` → passive `SkillDefinition`s) — R-S7, seal batch
- Real ấn `apply_buff` eligibility + Hỏa kit authoring — seal batch
- `SkillExecutor` driving the legacy real-time `BattleSystem` lane — out of scope (dead lane)
- Reactive-window ops (`counter`/`follow_up` payload skills stay queued through `pendingReactiveEntry`/`pendingQueuedExecution` bridges — adapters emit equivalent `SkillDefinition`s; the QUEUE mechanism is unchanged this program)

## Open questions for coordinator

1. R-S4 — `reactionEligibility` authored default: 'suppressed' unless authored, with the legacy `canInitiateWuxingReactions` flag lifted into eligibility by the adapter. Confirm the adapter (not the def) should own that mapping until seals.
2. R-S8 — `instances.perInstanceOptions` runtime closure can't be data; executor injects a per-skill options provider keyed by def id. Acceptable, or does the seal batch want a data DSL?
3. Passive skills: confirm R-S7 deferral (schema supports `type:'passive'`; `PassiveSystem` stays the passive runtime).
