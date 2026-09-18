# Skill Definition System — Implementation Megaplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Non-trivial production missions MUST follow `game/docs/architecture/architecture-worker-workflow.md` (G0–G5) and return the G5 evidence report.
>
> **Review resync v2 (skill-plan review 2026-09-18 — REQUEST CHANGES resolved):** (a) hard prerequisite corrected to the parent program's locked execution order — this plan expands parent M5, which sits AFTER buff M4 + reaction M-INT; that baseline is already merged on master (`d65f28aa` + `0eb2f2c1`); (b) `ResolvedSkillPlan` is now a `ResolvedSkillPlanStep` IR (operation / read / branch) — `read_stacks`/`if`/`for_each_target` are plan steps, never `CombatOperation`s; (c) `SkillDefinition` is the spec's discriminated union `ActiveSkillDefinition | PassiveSkillDefinition` — the passive schema exists, `PassiveSystem` runtime stays a separate deferred lane; (d) state split into THREE layers — `SkillDefinition` / `SkillProgressionState` / `SkillCombatRuntimeState`; (e) R-S8 REJECTED — no id-keyed runtime-closure provider; `instances.each` is declarative per-instance hit options, unrepresentable semantics degrade to loud `adapterUnsupportedMetadata`; (f) mid-plan reads use narrow READONLY query ports (`SkillBuffQuery`/`SkillVitalsQuery`/`SkillResourceQuery`) backed by domain read surfaces (`BuffReadPort` etc.) — NOT the `CombatAuthorityPorts` command surface; (g) authored `remove_buff` (selector) split from `cleanse` (query) matching `RemoveBuffOperation`/`CleanseBuffOperation`; (h) `barrierAfter` removed — contract §55 grants every authored op its own settlement barrier; (i) "ONE pipeline" narrowed to active turn-combat skills; (j) completion gates updated to current P18 OCR + P5 Sequential Multi-Pass Review; (k) R-S5 unsupported semantics classified canonical-field / new-primitive / `adapterUnsupportedMetadata` — never silent canonical schema pollution.

**Goal:** Replace today's THREE converging ACTIVE-skill representations — legacy `Skill`+`SkillEffect[]` (`core/skill/Skill.ts`), the `TriggerBinding[]`/`SkillAction` path (`SkillTriggerRunner`/`SkillActionRegistry`), and the flat `TurnSkillDefinition` turn-engine shape — with ONE active turn-combat skill execution pipeline: immutable `SkillDefinition` (authored intent) → `SkillResolver` (definition + cast snapshot + progression + route → `ResolvedSkillPlan`) → `SkillExecutor` (plan steps → ordered `ResolvedCombatOperation`s through the `CombatScheduler`). `TurnSkillDefinition` survives ONLY as the adapter input during migration; `Skill` progression fields (level/xp/loadout/unlocked/equipped) split off into `SkillProgressionState` owned by `SkillSystem`, and battle-scoped cast state (cooldown/charge/lastCastSequence) into `SkillCombatRuntimeState` owned by the turn runtime. `PassiveSystem` remains a separate event-driven passive runtime — explicitly OUT of this cutover (R-S7).

**Architecture:** New package `game/src/core/skilldef/` (definition types, schema validation, resolver, executor) + `game/src/data/skilldef/` (migrated content later; this program ships the SCHEMA + a `LegacySkillAdapter` covering the current authored surface). Cast flow: `TurnBattleSystem.declareActorAction` gains a plan-resolution seam — the selected `TurnSkillDefinition` resolves through `SkillResolver` into a `ResolvedSkillPlan` whose operation steps the scheduler drains with settlement barriers, so an interleaved `apply_buff` + `read_stacks` + `deal_damage` sequence sees post-reaction state (contract §63).

**Tech Stack:** Vue 3, TypeScript, Vite, Vitest, Pinia, Phaser.

**Specs:**
- `game/docs/specs/2026-09-17-skill-definition-system-spec.md` (v1.2 — THE source of truth)
- `game/docs/specs/2026-09-17-combat-systems-contract-spec.md` (v1.5 — `ResolvedCombatOperation` (no top-level `sourceId`; `origin.sourceId` is sole authority), origins `kind:'skill'`, `castId`/`subcastIndex`, settlement, `TriggerPeriodicStartResult`)
- `game/docs/specs/2026-09-17-buff-system-reimagined-spec.md` (v1.5 — consumed ops: `ApplyBuff`, `TriggerBuffPeriodic`, `ConsumeBuffStacks`, `AddBuffStacks`, `RemoveBuff`, `CleanseBuff`; consumed query surface: `BuffReadPort`)

**Sibling-plan dependency:** Expansion of the Skill scope in `game/docs/superpowers/plans/2026-09-17-combat-systems-reimagined.md` (its M5). Per the parent's LOCKED execution order `M0→M1→M2→M3→M6→M4(+M-INT)→M5→M7`, this program sits AFTER the buff cutover. **Hard prerequisites — the merged atomic post-cutover baseline:** Combat Contract complete (`contracts/**`, scheduler `enqueueAuthored`/`run()`, `CombatAuthorityPorts`, `CombatOperationBatchRunner`/`DeferredOperation`) AND buff megaplan M4 production cutover AND reaction M-INT — i.e. `TurnBattleSystem` runs on buff2 `BuffSystem` as the sole buff/ailment authority, `ElementalStateRegistry` is bound to the five canonical ấn ids, and `TurnReactionManager`/`canInitiateWuxingReactions`/`BuffPool` battle lanes are DELETED. As of `d65f28aa` (+`0eb2f2c1`) this baseline already exists on master — M0 verifies the post-cutover state rather than a pre-cutover one; if absent → BLOCKED. Starting from a pre-cutover tree would force the skill executor to understand BOTH the legacy `BuffPool`/`TurnReactionManager` world and the canonical one — that defeats the cutover architecture. The `SkillExecutor` emits operations — it NEVER calls `BuffSystem`/`CombatSystem` directly.

## Global Constraints

- **One ACTIVE pipeline at the end (spec INV-S2, scoped):** the migration is staged — `LegacySkillAdapter` lets ALL current ACTIVE turn-combat content ride the new pipeline as authored definitions; the OLD `SkillEffectSystem`/`SkillTriggerRunner` active-execution paths die in M5 (the real-time `BattleSystem`/`SkillEffectSystem` is already superseded — `SkillToTurnSkillConverter` + strict errors is today's effective boundary; confirm census in M0). `PassiveSystem` is a SEPARATE event-driven runtime, not a "parallel pipeline" violation — its deferral is an explicit scope boundary (R-S7), not an unfinished migration.
- **Definitions never carry state (CON-01):** no `targetId`, `instanceId`, `combatSequence`, cooldown *remaining*, xp, equipped — THREE state layers exist: `SkillDefinition` (immutable authored) / `SkillProgressionState` (persistent player state — level/xp/unlock/specialization/equipment/loadout — owned by `SkillSystem`, the save surface) / `SkillCombatRuntimeState` (battle-scoped — `cooldownRemainingTurns`/`chargeProgress`/`lastCastSequence` — owned by the turn runtime, today's `TurnSkillSlot.remainingCooldownTurns` home). Per-cast execution data (`theBurned`, `multicastDepth`) lives on `CastSnapshot`/execution context, not on any of the three. The resolver receives progression + combat-runtime as READONLY inputs.
- **Resolver snapshots at cast commit (spec §24–27):** variants (`empowerment`, composite pool pick), empowerment `theBurned`, resource costs, stat scalars — captured once; later ops read the snapshot, never re-query mutable state mid-plan.
- **Deterministic ordering (spec §34):** plan steps execute in authored order; every `kind:'operation'` step receives its own settlement barrier (contract §55); multicast/repeat subcasts settle sequentially (contract §60–61).
- **No path-specific branches (CON-23):** `compositePicks`, `multicast`, `empowerment`, `detonateDoT`, `theScaling`, `counterable`, `chargeTurns` become GENERIC authored fields on `SkillDefinition` — same data, new home. The Hỏa kit lands as data later.
- **P3:** quick per mission; **full for M4** (touches `declareActorAction`/`resolveDeclaredHit` hot path). **P4** quick per mission, deep at M4 (and M5 — deletion sweep). **P18 OpenCodeReview** on the task diff after P3, per mission. **P5 Sequential Multi-Pass Review** per mission — ≥3 ordered passes over evolving code states, fix between passes, a confirmed Medium+ on the last pass forces another pass. **P7** explicit authorization per commit. **P13/P14** Playwright real battle at M4 (run inside the implementation worktree).
- **Per-mission report:** changed / files / authority moved / adapters remaining / tests / build status / behavior changes (=None) / risks / next.

## Canonical names (locked across sibling plans)

**Consumes:** `ResolvedCombatOperation`, `CombatOperationOrigin` (`kind:'skill'`, `castId`, `subcastIndex`), `CombatOperation` union (skill executor emits the WHOLE vocabulary — `DealDamage`, `Heal`, `ApplyBuff`, `ConsumeBuffStacks`, `TriggerBuffPeriodic`, `PushGauge`, `GainResource`, `ConsumeResource`, `ApplyShield`), `CombatScheduler` (barriers between ops), `CombatOperationExecutor`, `CombatRng` (composite picks, multicast, ailment rolls — rolls route through scheduler context, NOT embedded in definitions), `ApplyBuffRequest` (`reactionEligibility` set here — the skill is the eligibility AUTHORITY per contract §14–15).

**Produces:** `SkillDefinition` (`= ActiveSkillDefinition | PassiveSkillDefinition` — spec §4 discriminated union), `AuthoredSkillOperation` (incl. `remove_buff` selector + `cleanse` query ops — contract `RemoveBuffOperation`/`CleanseBuffOperation` parity), `SkillTargetIntent`, `SkillCondition`, `SkillProgressionState`, `SkillCombatRuntimeState`, `CastSnapshot`, `ResolvedSkillPlan`, `ResolvedSkillPlanStep` (operation/read/branch IR — plan steps are NOT `CombatOperation`s), `SkillResolver`, `SkillExecutor`, `SkillCastOutcome` (`landed`/`whiffed`/`interrupted`/`blocked`), `LandedSemantics` (`landed` = a connection-semantic primary effect successfully connects — spec §20/R-S2), `LegacySkillAdapter` (`Skill`+`EffectiveSkill`+`TurnSkillDefinition` → `SkillDefinition`), `SkillDefinitionRegistry` (startup validation), `SkillBuffQuery`/`SkillVitalsQuery`/`SkillResourceQuery`/`SkillOpResultQuery` (narrow READONLY mid-plan read ports — spec §30/§63; backed by `BuffReadPort`/entity-vitals/resource-owner reads at composition root, NEVER the `CombatAuthorityPorts` command surface), `adapterUnsupportedMetadata` (loud channel for unrepresentable authored semantics — R-S5/R-S8).

## Rulings — locked by plan-review v2 (2026-09-18); M0 verifies, does not re-decide

| # | Ruling | Rationale |
|---|---|---|
| R6 | LOCKED — THREE state layers, not two: `SkillDefinition` (immutable authored) / `SkillProgressionState` = `{skillId, level, experience, totalExperience, selectedSpecializationId, unlocked, equipped, loadoutSlots}` — persistent player state owned by `SkillSystem`, the save surface / `SkillCombatRuntimeState` = `{skillId, cooldownRemainingTurns, chargeProgress?, lastCastSequence?}` — battle-scoped state owned by the turn runtime (today's `TurnSkillSlot.remainingCooldownTurns` home). `Skill` interface SPLITS into `SkillDefinition` + `SkillProgressionState`; `SkillSystem.getEffectiveSkill` returns `{definition, progression}`. Conflating progression and combat state corrupts save/restore boundaries (save owns progression; battle owns cooldowns; resolver snapshots what it needs). Save schema gains a migration step at the ops layer (versioned already — check `GameManagerSave*`). | Spec §3 v1.2 (renamed `SkillCombatRuntimeState`); `Skill.ts:55–197` mixes definition+progression today; `TurnSkillSlot` owns battle cooldowns. |
| R8 | LOCKED — canonical ACTIVE turn model: `cooldownTurns`/`chargeTurns` in TURN units are the only combat-authoritative cadence. Real-time `SkillExecutionPolicy` kinds are RETIRED authored metadata — `LegacySkillAdapter` drops them (kept on legacy `Skill` for tooltip only). `chargeTurns` maps to authored `subcasts`/charge semantics, not a real-time cast phase. | Spec R8; `Skill.execution` doc itself says turn engine doesn't consume it. |
| R-S1 | LOCKED — `ResolvedSkillPlan` is a flat ordered list of `ResolvedSkillPlanStep` (operation/read/branch IR — NOT an op-only list; `read_stacks`/`if`/`for_each_target` are plan steps, never widened into `CombatOperation`). Charge/multicast/repeat produce SEPARATE sequential plans enqueued by the executor after settlement — preserves today's queue semantics (`pendingQueuedExecution`/`enqueueFollowUpExecutions`). No `barrierAfter` flag — contract §55 grants every authored op its own settlement barrier. | Contract §60: subcast 2 sees post-settle state — sequential plans, not nested. Contract §63: mid-plan reads must see post-reaction state — needs a real read step. |
| R-S2 | LOCKED — `landed` = at least one PRIMARY effect that defines connection semantics successfully connects/resolves on ≥1 valid target. Examples: damage hit → connected (even fully shield-absorbed); successful ailment application → connected; successful offensive debuff → connected; self-utility skill → successful cast, but not called a "hit". `landed` is NOT synonymous with "not failed" and NOT `damage > 0`. Reaction does NOT retro-change it (contract §65); `executionCommitsCast` semantics preserved. | Spec §20/§41 v1.2; current behavior `TurnDeclaredAction.landedTargetIds` + buff-only self casts. |
| R-S3 | LOCKED — mid-plan reads use narrow READONLY domain query ports: `SkillBuffQuery` (`stacksOf`/`getInstance`/`has` — backed by existing `BuffReadPort`), `SkillVitalsQuery` (`alive`/`hp`/`hpPercent` — entity vitals read), `SkillResourceQuery` (`current`/`max` — resource owner read), `SkillOpResultQuery` (`lastOpResult` — scheduler result trace for `fractionOfPriorDamage` heals). Composition root wires each port to its owning domain. One domain authority ≠ one interface for every use: `CombatAuthorityPorts` are COMMAND ports (every method takes `CombatAuthorityExecutionContext`, returns mutation results — no reads exist on them); reads must NOT route through them. | Contract §63 needs a legal read path mid-plan; `BuffReadPort` already exists (`buff2/BuffQuery.ts`) — reuse it, don't widen command ports. |
| R-S4 | LOCKED — `appliesAilment(s)` → authored `apply_buff` op carrying `reactionEligibility:'eligible'` for normal elemental applications — eligibility is producer-path metadata, NEVER derived from `actor.canInitiateWuxingReactions` (`'suppressed'` is for reaction-generated/recursive lanes only). Whether a reaction actually runs is the ReactionSystem's capability+registry gate (`elemental_reaction_enabled` — ungranted this program). `TurnReactionManager`/`canInitiateWuxingReactions` are already DELETED (merged at M-INT, `d65f28aa`) — the adapter reads no legacy flag. | Contract §14–16/§23–25: eligibility is request metadata; the gate decides execution. |
| R-S5 | AMENDED — `SkillEffect` fields the turn engine reports-but-can't-execute (`collectUnsupportedSkillSemantics`: `hitCountByRealm`, `realmDamageRatio`, `skillExperienceRatio`, `spreadsAilmentId`, `stacksPerAffectedTarget`, `scope`, `refresh`, `grantsZone`, `zoneElement`, `swordZone*`, `breakDamagePerHit`) get a THREE-TIER classification, never blanket in-schema promotion: **(A) canonical semantic exists** → authored field/op (`hitCount` → `deal_damage.hitCount`; `stacksPerAffectedTarget` → `apply_buff` stacks query); **(B) representable via a new generic primitive** → add the primitive + tests (`spreadsAilmentId` → scoped `apply_buff`); **(C) not yet representable** → `adapterUnsupportedMetadata` on the converted def — loud report, NOT canonical gameplay schema (`grantsZone`/`zoneElement`/`swordZone*` stay tier-C until a real Zone authority/operation exists). | A8: unsupported semantics must stay LOUD; canonical schema must not carry fields whose semantics don't exist. |
| R-S6 | LOCKED — `Skill.specializations`/`selectedSpecializationId` resolution stays in `SkillSystem.getEffectiveSkill` — the resolver receives the already-specialized authored def + `SkillProgressionState`. Specialization = choosing WHICH authored def resolves; not plan-time branching. | Preserves `SkillSystem.selectSpecialization` API + `EffectiveSkill` contract (`SkillSystem.ts:74`). |
| R-S7 | LOCKED — passives stay on `PassiveSystem` THIS program. `PassiveSkillDefinition` schema + validation land in M1 (the union is real), but NO passive runtime adapter/migration — `PassiveSystem` is a separate event-driven runtime, explicitly documented as a deferred lane, NOT a "parallel pipeline" violation. Scope phrase everywhere: "ONE active turn-combat skill execution pipeline". | Folding passive triggers into this cutover doubles the blast radius for zero combat-visible gain. |
| R-S8 | LOCKED — REJECT the id-keyed runtime-closure provider (a `perInstanceOptions` registry keyed by def id is a custom-handler lane: violates declarative-definitions/no-callbacks/inspectable-plan invariants — spec §64). Instead: **`instances.each` is DECLARATIVE per-instance hit options** — `{count: ScalarExpression, each?: {guaranteedHit?: boolean, execute?: {hpPercentBelow: ScalarExpression, damageMultiplier: number}, critChance?: number, armorPierce?: {bypassChance: number, pierceFraction: number}}}` — evaluated per (instance, live target) at EXECUTE with per-instance `CombatRng` rolls; `count` may query player state (Ngự Kiếm Đạo's `kiemDaoCount`); unlock gates ride progression `SkillModification`s. Any semantic `instances.each` cannot express → `adapterUnsupportedMetadata` + the def stays flagged (NOT claimed migrated), never a hidden callback. | Verified consumer `NguKiemDaoProvider.perInstanceOptions` (`NguKiemDaoProvider.ts:68-96`): per-instance guaranteedHit + execute-on-live-hp% + crit chance + armor pierce/bypass — needs roll semantics, not index-scaled coefficients. |

---

## Mission 0 — Inventory + prerequisite verification (read-only)

**Files:**
- Create: `game/docs/architecture/2026-09-17-skilldef-inventory.md`

- [ ] **Step 1 — Lock baseline:** `git rev-parse HEAD`.
- [ ] **Step 2 — Verify prerequisites (BLOCKING):** the merged post-cutover baseline — contract ops union + `CombatOperationOrigin{kind:'skill',castId,subcastIndex}` + `originId`; scheduler `enqueueAuthored`/`run()` with per-op settlement barrier; `CombatAuthorityPorts` (`BuffAuthority`/`DamageAuthority`/`GaugeAuthority`/`ResourceAuthority`/`ShieldAuthority`/`HealAuthority`) + `CombatOperationBatchRunner`/`DeferredOperation`; buff2 `ApplyBuffRequest.reactionEligibility` + `BuffReadPort` (`getStacks`/`getInstance`/`has`) + `triggerPeriodic` + `consumeStacks` + `cleanse`; **cutover state:** `TurnBattleSystem` drives casts through buff2 `BuffSystem` (no `BuffPool` in the battle lane), `TurnReactionManager`/`canInitiateWuxingReactions` absent, `ElementalStateRegistry` bound to the five canonical ấn ids. Missing → BLOCKED.
- [ ] **Step 3 — Skill producer census (drives adapter coverage):**
  - `data/skill/` (~9,152 lines total): `CoreSkills.ts`(671), `PhapTuChainSkills.ts`(1020), `PhapTuEmpoweredUlts.ts`(142), `PhapTuUltimates.ts`(30), `TheTuSkills.ts`(404), `NguKiemDaoSkills.ts`(38), `KiemPhoCombos.ts`(88), `KiemPhoOrbs.ts`(77), `PassiveSkills.ts`(522), `TalentPassives.ts`(182), `Skills.ts`(24), `TurnAnKitSkills.ts`(63), `TurnBasicAttacks.ts`(78). For each: does it produce `Skill` (legacy shape), `TurnSkillDefinition` (direct), or both? (`TurnAnKitSkills`/`TurnBasicAttacks` likely author `TurnSkillDefinition` directly — CONFIRM.)
  - Orchestrator-authored `TurnSkillDefinition`s: `buildTheTuAnKit`/`collectTheTuAnMechanicModifiers` (Thế Tu clones with baked node bonuses), `linh_ngo_*` empowerment attach site (`TurnSkillDefinition.empowerment`), `compositePicks.pool` attach (Pháp Tu Ẩn), emblem defs (`emblemOnly`), `dynamicBasic` providers (Ngự Kiếm Đạo `instances`+`perInstanceOptions`).
  - `SkillSystem` surface: `getEffectiveSkill`, `selectSpecialization`, `equipToSlot`/`getLoadoutSkills`, `getCastLeveledSkillLevel`/`getHuyKiemFlatDamageBonus` (xp→damage inputs the resolver snapshot must feed).
  - `PassiveSystem` (`core/passive/`): `passiveTrigger`/`passiveModifiers`/`passiveCondition`/`passiveConvertsTo` — passive defs' separate runtime; R-S7 is LOCKED (parallel runtime, deferred lane) — the census documents its surface for the seal batch, no absorb decision remains.
- [ ] **Step 4 — Cast-path trace (exact seam list):** `declareActorAction` (`:894`) → queued-execution branch (`:901`) → reactive bypass (`:906`) → round/cooldown/CC/resource commit → `selectAction`/`selectForcedAction` (`:1241-1243`) → `TurnDeclaredAction` → `applyActionImpact` → `resolveDeclaredHit` (`:1748`, per-target loop `:2034-2070`) → `applySkillAilments` (`:2939`) → `enqueueFollowUpExecutions` (`:2217`). Record where `rootActionId`/`castId`/`subcastIndex` mint (declare = rootAction+castId; each queued execution = subcastIndex++).
- [ ] **Step 5 — `SkillActionRegistry`/`SkillTriggerRunner` usage census:** which skills still declare `triggers` (find `triggers:` in `data/skill/**` — `tram` confirmed by converter comment); whether `SkillTriggerRunner`/`SkillActionRegistry`/`SkillEffectSystem` are still invoked ANYWHERE in the live turn path or dead-but-referenced (`grep -rn "SkillTriggerRunner\|SkillActionRegistry\|SkillEffectSystem" src/`).
- [ ] **Step 6 — Write authority matrix + verify the locked R6/R8/R-S1..R-S8 table** (rulings are LOCKED by review v2 — M0 confirms each against code reality, records evidence; it does not re-decide them).

**Exit criteria:** every authored-skill producer + every `TurnSkillDefinition` field mapped to a `SkillDefinition` field or an explicit "stays legacy-adapter-only" note; live-vs-dead trigger path confirmed; prereqs verified.

---

## Mission 1 — SkillDefinition schema + state split + validation

**Files:**
- Create: `game/src/core/skilldef/SkillDefinition.ts` — `SkillDefinition = ActiveSkillDefinition | PassiveSkillDefinition` (spec §4–6 discriminated union — passives do NOT inherit active fields)
- Create: `game/src/core/skilldef/SkillProgressionState.ts` — persistent player-state interface (R6)
- Create: `game/src/core/skilldef/SkillCombatRuntimeState.ts` — battle-scoped cast-state interface (R6)
- Create: `game/src/core/skilldef/AuthoredOperation.ts` — `AuthoredSkillOperation` union + target intents + conditions + `AuthoredBuffSelector`/cleanse query + `adapterUnsupportedMetadata`
- Create: `game/src/core/skilldef/ScalarExpression.ts` — spec §33 pure AST evaluator (`add`/`multiply`/`subtract`/`divide`-guards-zero/`min`/`max`/`clamp`/`if` + `SkillValueQuery` reads) — `instances.count`/`execute.hpPercentBelow` consume it; NO arbitrary callbacks (spec §64)
- Create: `game/src/core/skilldef/SkillDefinitionRegistry.ts` — catalog + startup validation
- Test: `SkillDefinition.test.ts`, `SkillDefinitionRegistry.test.ts`

**Interfaces — Produces:**

```ts
// SkillDefinition.ts — spec §4–6 discriminated union; immutable authored intent.
// Passives do NOT inherit active fields (spec: "Không ép passive vào schema
// active với hàng loạt field vô nghĩa"). THIS PROGRAM: ActiveSkillDefinition is
// implemented + production-used; PassiveSkillDefinition is schema + validation
// only — PassiveSystem remains the passive runtime (R-S7).
export type SkillDefinition = ActiveSkillDefinition | PassiveSkillDefinition

export interface ActiveSkillDefinition {
  kind: 'active'
  id: SkillId
  name: string
  targetIntent: SkillTargetIntent          // 'self' | 'enemy' | 'all_enemies' | 'ally' | 'all_allies' — authored, no runtime ids
  actionTags?: readonly string[]           // 'attack' | 'heal' | 'buff' | 'cleanse' | 'defend' | 'utility' — Cấm Công's tag taxonomy (reaction plan R-E2 upgrade path)
  cadence: { cooldownTurns: number; chargeTurns?: number }   // R8: turn units are the ONLY combat-authoritative cadence
  cost?: { resourceType: 'none' | 'mana' | 'the'; amount: number }   // 'the' gates Thế Tu ults
  operations: readonly AuthoredSkillOperation[]   // ordered; every operation step settles before the next plan step (contract §55)
  subcasts?: {                              // replaces multicast/repeatCasts/compositePicks — each a SEPARATE sequential plan (R-S1)
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
  instances?: {                             // R-S8 v2 — DECLARATIVE per-instance hit options (replaces the runtime perInstanceOptions closure)
    count: ScalarExpression                 // may query player state (Ngự Kiếm Đạo kiemDaoCount)
    each?: {
      guaranteedHit?: boolean               // phi kiếm never miss
      execute?: { hpPercentBelow: ScalarExpression; damageMultiplier: number }   // live-target hp% at EXECUTE
      critChance?: number                   // per-instance CombatRng roll
      armorPierce?: { bypassChance: number; pierceFraction: number }             // per-instance roll → bypass, else partial pierce
    }
  }
  /** R-S5/R-S8 tier-C surface — fields the adapter could NOT express as
      canonical semantics. NOT gameplay data: presence marks the def as
      partially-migrated; the report channel stays loud (collectUnsupportedSkillSemantics parity). */
  adapterUnsupportedMetadata?: readonly string[]
}

// PassiveSkillDefinition — spec §6. Schema + validation land this mission;
// NO runtime adapter — PassiveSystem stays the passive runtime (R-S7).
export interface PassiveSkillDefinition {
  kind: 'passive'
  id: SkillId
  name: string
  triggers: readonly PassiveTriggerDefinition[]   // spec §53 semantic combat events
  operations: readonly AuthoredSkillOperation[]   // shared authored op vocabulary (spec §6 `effects` → binding name `operations`)
  requirements?: readonly SkillRequirement[]
  presentation?: { presetId?: CombatVfxPresetId }
  balance?: SkillBalanceMetadata
  adapterUnsupportedMetadata?: readonly string[]
}

// AuthoredOperation.ts — contract §3: intent only, zero runtime ids
export type AuthoredSkillOperation =
  | { type: 'deal_damage'; target: SkillTargetIntent; coefficient?: number; components?: SkillDamageComponent[]; damageType?: 'physical' | 'primordial'; hitCount?: number; canCrit?: boolean; canMiss?: boolean; scaling?: AuthoredScaling; consumeBuff?: { definitionId: BuffDefinitionId; damagePerStack: number; scope?: 'own' | 'any'; healPercentOfDamage?: number }; consumeWard?: { damagePerWardPoint: number }; healPercentOfDamage?: number }
  | { type: 'heal'; target: SkillTargetIntent; amount?: number; fractionOfMaxHp?: number; fractionOfPriorDamage?: { fraction: number; capRatio?: number } }   // authored-level result reference → executor emits a DeferredOperation (pre-minted `operationId`; capRatio clamps the FRACTION at resolution — contract v5 R-C7)
  | { type: 'apply_buff'; target: SkillTargetIntent; definitionId: BuffDefinitionId; stacks?: number; chance?: number; durationOverride?: number; reactionEligibility?: ReactionEligibility }   // DEFAULT 'suppressed' for non-elemental lanes; the adapter writes 'eligible' for appliesAilment(s) unconditionally (r4 — eligibility is path metadata, never the legacy canInitiateWuxingReactions flag; the capability gate decides reactions)
  | { type: 'add_buff_stacks' | 'remove_buff_stacks' | 'consume_buff_stacks'; target: SkillTargetIntent; definitionId: BuffDefinitionId; stacks: number | 'all' }
  | { type: 'add_buff_modifier' | 'remove_buff_modifier'; target: SkillTargetIntent; definitionId: BuffDefinitionId; modifier: AuthoredModifier }
  | { type: 'refresh_buff_duration' | 'extend_buff_duration'; target: SkillTargetIntent; definitionId: BuffDefinitionId; turns?: number }
  | { type: 'trigger_buff_periodic'; target: SkillTargetIntent; definitionId: BuffDefinitionId; periodicId?: string }   // spec §30 — manual DoT cash-in (detonate under it)
  | { type: 'remove_buff'; target: SkillTargetIntent; selector: AuthoredBuffSelector; reason?: BuffRemovalReason }   // identified-instance removal → RemoveBuffOperation
  | { type: 'cleanse'; target: SkillTargetIntent; query: { kind?: 'buff' | 'debuff' | 'ailment'; tags?: readonly string[]; element?: ElementId }; count?: number }   // query-based cleanse → CleanseBuffOperation{targetId, query: BuffCleanseQuery} — the legacy 'remove_buff'-by-polarity effect lands HERE, not on remove_buff
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

// SkillProgressionState.ts (R6) — persistent player state; SkillSystem owns; save surface
export interface SkillProgressionState {
  skillId: SkillId; level: number; experience: number; totalExperience: number
  selectedSpecializationId?: string
  unlocked: boolean; equipped: boolean; loadoutSlots: number[]
}

// SkillCombatRuntimeState.ts (R6) — battle-scoped; turn runtime owns
// (today's TurnSkillSlot.remainingCooldownTurns home); NOT saved
export interface SkillCombatRuntimeState {
  skillId: SkillId
  cooldownRemainingTurns: number
  chargeProgress?: number
  lastCastSequence?: number
}
```

- [ ] **Step 1 — Failing tests (schema):** registry validates unique ids, all `definitionId`/op references resolvable (buff registry + skill registry predicates), `subcasts.compositePool` non-empty when present, `empowerment.empoweredSkillId` exists, active-vs-passive field separation enforced (a `PassiveSkillDefinition` carrying `cadence`/`subcasts`/`detonate`/`instances`/`targetIntent`/`cost`/`variants` fails validation; an `ActiveSkillDefinition` carrying `triggers` fails), `cleanse` queries well-formed, no authored field carries runtime ids (deep-scan guard: reject keys `targetId|sourceId|instanceId|combatSequence` — CON-01 structural test).
- [ ] **Step 2 — Failing tests (state split):** `SkillProgressionState` covers every persistent non-authored `Skill` field (`level`/`experience`/`totalExperience`/`selectedSpecializationId`/`unlocked`/`equipped`/`loadoutSlot(s)`); `SkillCombatRuntimeState` covers battle-scoped fields (`remainingCooldownTurns` → `cooldownRemainingTurns`, charge progress); `unreleased`/`buildTag`/`castTime`(real-time)/`execution`(real-time)/`vfxPresetId` classified as authored-presentation or dropped — the classification table lands in the inventory doc.
- [ ] **Step 3 — Implement + verify (P3 quick).**

**Exit criteria:** schema covers the FULL `TurnSkillDefinition` surface (every field mapped — census table) + the executable `SkillEffect` surface; structural "no runtime ids" test guards CON-01.

---

## Mission 2 — CastSnapshot + SkillResolver + ResolvedSkillPlan

**Files:**
- Create: `game/src/core/skilldef/CastSnapshot.ts`
- Create: `game/src/core/skilldef/ResolvedSkillPlan.ts` — plan + `ResolvedSkillPlanStep` IR
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

// ResolvedSkillPlan.ts — R-S1: plan is a STEP IR, not an op list.
// Combat mutations stay ResolvedCombatOperations; plan control-flow
// (mid-plan reads, conditionals) stays SkillExecutor-owned IR — never
// widened into the CombatOperation union.
export type ResolvedSkillPlanStep =
  | {
      kind: 'operation'
      operation: ResolvedCombatOperation      // fully resolved payload (contract §4)
    }
  | {
      kind: 'read'                            // read_stacks → executor evaluates via query ports BETWEEN barriers, writes ctx.vars[into]
      query: ResolvedSkillRead                // {buff_stacks|resource|hp_percent|var} resolved selectors, readonly
      into: string
    }
  | {
      kind: 'branch'                          // authored `if` → executor evaluates condition live at execute (post-settlement state)
      condition: SkillCondition
      then: readonly ResolvedSkillPlanStep[]
      else?: readonly ResolvedSkillPlanStep[]
    }

export interface ResolvedSkillPlan {
  castId: string
  rootActionId: string
  sourceId: CombatEntityId
  definitionId: SkillId
  subcastIndex: number
  steps: readonly ResolvedSkillPlanStep[]
  snapshot: CastSnapshot
}

// SkillResolver.ts — spec §21–23; pure (no combat mutation)
export class SkillResolver {
  constructor(private readonly skills: SkillDefinitionRegistry, private readonly rng: CombatRng)
  resolve(input: {
    definition: ActiveSkillDefinition      // already specialization-resolved (R-S6); passives never reach the cast resolver
    sourceId: CombatEntityId
    declaredTargetIds: readonly CombatEntityId[]
    progression: SkillProgressionState     // READONLY input — level/xp feed statScalars
    combatRuntime?: SkillCombatRuntimeState// READONLY input — charge/cooldown context when needed
    sourceStats: StatReadPort              // scaling inputs captured into snapshot
    entityQuery: { currentThe(id): number; currentMp(id): number; alive(id): boolean }
    castId: string; rootActionId: string; subcastIndex: number
  }): ResolvedSkillPlan
  // internally: pick variant (empowerment the-check → resolvedVariantId + consumesAllThe capture),
  // roll compositePool, freeze resourcesConsumed BEFORE plan ops, translate each
  // AuthoredSkillOperation → ResolvedSkillPlanStep (deal_damage/apply_buff/… →
  // {kind:'operation'} with selectors resolved to entity ids; read_stacks →
  // {kind:'read'}; if/for_each_target → {kind:'branch'}; origin
  // {kind:'skill', originId:definitionId, castId, subcastIndex, rootActionId})
}
```

**Target resolution (deterministic, spec §31–33):** `primary_target` → `declaredTargetIds[0]`; `affected_targets` → full declared set; `all_enemies`/`allies_except_self` → resolved at resolve-time from `entityQuery` in STABLE participant order (battle roster order, never set-iteration). `read`/`branch` steps evaluate at EXECUTE via the readonly query ports (R-S3) — the plan stores the authored query/condition, the executor evaluates it live between barriers (post-reaction state visible — contract §63). `for_each_target` unrolls at RESOLVE into per-target step copies in deterministic target order (each `kind:'operation'` step carries a concrete resolved targetId); target validity is rechecked per step at EXECUTE — dead/invalid targets skip their steps (spec §10: no applying effects onto a corpse).

- [ ] **Step 1 — Failing tests (snapshot):** composite pool rolled once in resolver (same rng sequence → same picks); `consumesAllThe` captures `theBurned` BEFORE the plan's `consume_resource` op zeroes it (Task 13 parity — `theScaling` reads snapshot, not live pool); `statScalars` freeze attribute/mana-scaling inputs.
- [ ] **Step 2 — Failing tests (plan shape):** authored step order preserved; every `kind:'operation'` step carries a fully-resolved `ResolvedCombatOperation` (settlement is the scheduler's §55 contract — no per-step flag exists); `empowerment` below-threshold → base def plan; `if` compiles to `kind:'branch'` steps with authored conditions (not pre-evaluated); `for_each_target` unrolls at RESOLVE into per-target step copies in deterministic order; `read_stacks` emits a `kind:'read'` plan step, NOT a mutation op.
- [ ] **Step 3 — Failing tests (origin):** every emitted op carries `origin{kind:'skill', originId, castId, subcastIndex, rootActionId}`; multicast subcast `subcastIndex` increments.
- [ ] **Step 4 — Implement + verify (P3 quick).**

**Exit criteria:** resolver is pure + deterministic under seeded rng; plan operation steps carry full causal ids; read/branch steps are executor-owned IR; snapshot freeze proven for the three hard cases (composite pick, the-burn, scaling inputs).

---

## Mission 3 — SkillExecutor + plan reads + subcast driving

**Files:**
- Create: `game/src/core/skilldef/SkillExecutor.ts`
- Create: `game/src/core/skilldef/SkillQueryPorts.ts` — narrow READONLY mid-plan read ports (R-S3 v2)
- Test: `SkillExecutor.test.ts`, `SkillPlanReads.test.ts`, `SkillSubcast.test.ts`

```ts
// SkillExecutor.ts — drives ONE ResolvedSkillPlan through the scheduler
export class SkillExecutor {
  constructor(
    private readonly scheduler: CombatScheduler,
    private readonly resolver: SkillResolver,
    private readonly queries: SkillQueryPorts,        // readonly domain query ports — NEVER CombatAuthorityPorts
  )
  /** Executes plan steps in order — for each {kind:'operation'} step:
      enqueueAuthored([op]) → run() (full settle — contract §55 barrier)
      → evaluate the NEXT step's read/branch against post-settlement
      state via the query ports → repeat. */
  execute(plan: ResolvedSkillPlan): SkillCastOutcome
  /** Queues follow-up plans: subcasts (repeat/multicast), composite extra picks — each its own ResolvedSkillPlan with subcastIndex++ and its own settle (contract §60). */
  enqueueSubcasts(plan: ResolvedSkillPlan): void
}

// SkillQueryPorts.ts — R-S3 v2: synchronous readonly reads between barriers.
// Command and query surfaces stay SEPARATE: CombatAuthorityPorts are mutation
// ports (every method takes CombatAuthorityExecutionContext); reads NEVER route
// through them. Composition root wires each port to its owning domain —
// one domain authority ≠ one interface for every use.
export interface SkillBuffQuery {                    // backed by existing BuffReadPort (buff2/BuffQuery.ts)
  stacksOf(definitionId: BuffDefinitionId, sourceId: CombatEntityId, targetId: CombatEntityId): number
  has(sel: BuffInstanceSelector): boolean
}
export interface SkillVitalsQuery {                  // backed by entity vitals read
  alive(id: CombatEntityId): boolean
  hp(id: CombatEntityId): number
  hpPercent(id: CombatEntityId): number
}
export interface SkillResourceQuery {                // backed by the resource owner (Thế/MP domains)
  current(id: CombatEntityId, resourceId: string): number
  max(id: CombatEntityId, resourceId: string): number
}
export interface SkillOpResultQuery {                // backed by scheduler result trace — fractionOfPriorDamage heals etc.
  lastOpResult(operationId: CombatOperationId): CombatOperationResult | undefined
}
export interface SkillQueryPorts {
  buffs: SkillBuffQuery; vitals: SkillVitalsQuery; resources: SkillResourceQuery; opResults: SkillOpResultQuery
}
```

**Execution semantics:**
- Settlement is the SCHEDULER's contract (§55): the executor enqueues ONE `kind:'operation'` step, `run()` drains the barrier to quiescence, then evaluates the NEXT step's `read`/`branch` against post-settlement state via the query ports (the §94 contract test: apply Hỏa → reaction consumes → `read_stacks` sees 0). No per-step barrier flag exists — every authored op gets its own barrier by contract.
- Target death mid-plan: ops with dead required targets → `{status:'skipped', reason:'invalid_target_state'}`, plan continues (contract §49) — BUT `landed` computes from committed results only.
- Subcast driving: `subcasts.count`/`multicast` → after parent plan settles, resolver produces `plan(subcastIndex+1)` (composite re-rolled per subcast — Task 11 parity: "re-rolls compositePicks"); enqueue each, execute sequentially.
- `detonate` sugar expands to plan steps: `read` per dot-ailment → `consume_buff_stacks('all')` → `deal_damage` scaled by read vars → re-seed `apply_buff{stacks:1, reactionEligibility:'suppressed'}` (Task 13 spec: reaction-silent re-seed — the committed event fails the §23 eligibility gate, so no Reaction evaluation occurs).

- [ ] **Step 1 — Failing tests (ordering/settlement):** plan steps `[operation:apply_buff(eligible), read:stacks, operation:deal_damage]` against a stub that consumes the buff on the elemental event → the `read` step returns 0 (contract §94 verbatim — the read sees post-settlement state).
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
| `appliesAilment(s)` | `apply_buff` ops, `reactionEligibility:'eligible'` — unconditional (R-S4 r4-amended: normal elemental applications are eligible; the legacy `canInitiateWuxingReactions` flag is NEVER read — reactions gate on capability + canonical registry) |
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
| `instances`/`perInstanceOptions` | `instances{count, each}` — DECLARATIVE per-instance hit options (R-S8 v2): the Ngự Kiếm Đạo closure decomposes to `each{guaranteedHit, execute{hpPercentBelow, damageMultiplier}, critChance, armorPierce{bypassChance, pierceFraction}}` + `count` reading `kiemDaoCount`; unlock gates ride progression `SkillModification`s. NO id-keyed runtime-closure provider exists. Semantics `instances.each` cannot express → `adapterUnsupportedMetadata` + def flagged, NOT claimed migrated |
| `counterable`/`counterSkillId`/`emblemOnly`/`presetId`/`targetScope`/`resourceType`/`resourceCost`/`targeting`/`chargeTurns` | same-named authored fields |
| `Skill.effects` legacy | adapter: `damage`→`deal_damage`, `buff`/`debuff`/`add_stack`→`apply_buff`/`add_buff_stacks`, `heal`→`heal`, `remove_buff`-by-polarity→`cleanse` (query op), `remove_buff`-by-id→`remove_buff` (selector op); `SkillEffectSystem`-only fields (spread/zone/hitCountByRealm…) → R-S5 three-tier classification (canonical / new primitive / `adapterUnsupportedMetadata`) |
| `Skill.triggers` (onCast→dealDamage only per converter) | `operations` list from actions (`dealDamage`,`heal`,`applyBuff`,`applyDebuff`,`consumeForDamage`→`consumeBuff`,`consumeResource`/`grantResource` — breakGauge legacy pool → resource op) |
| `PassiveSkills`/`TalentPassives` | R-S7 LOCKED: passives stay on `PassiveSystem` THIS program — `PassiveSkillDefinition` schema + validation land in M1, NO runtime adapter/migration (passive triggers are a separate event-driven runtime; folding them in now doubles the blast radius for zero combat-visible gain). Documented deferred lane — NOT a "parallel pipeline" violation. Flag for seal batch. |

- [ ] **Step 1 — Failing tests (adapter parity):** for every data/skill producer file, `adapter.convert` output ops == the semantics today's converter produces (`toTurnSkillDefinition` table above); `collectUnsupportedSkillSemantics` parity — adapter reports the SAME unsupported fields (loud channel preserved, R-S5).
- [ ] **Step 2 — Failing tests (integration):** scripted battle — a buff+ailment skill emits `apply_buff`(suppressed) THEN `apply_buff`(eligible) as separate barriered ops; empowered ult captures `theBurned`; multicast queues extra subcasts; `consumesAilmentId` reads live stacks post-settlement.
- [ ] **Step 3 — Implement adapter + reroute** the cast lane (`resolveDeclaredHit` internals map onto plan execution — damage/ailments through ops; the hit-resolution details like evasion/crit/armor stay inside the `DamageAuthority`).
- [ ] **Step 4 — Verify (P3 FULL) + P18 OCR + P13/P14 Playwright real battle (inside the implementation worktree) + P4 deep + P5 sequential review passes.**

**Exit criteria:** ONE active turn-combat skill pipeline — every ACTIVE cast in turn combat resolves through `SkillResolver`→`SkillExecutor`→scheduler; adapter lifts all legacy producers; zero regression in the battle suite. `PassiveSystem` untouched — it is a separate runtime, not a parallel pipeline.

---

## Mission 5 — Legacy path retirement + DoD sweep + docs

**Files:**
- Delete (only after M4 green): `SkillToTurnSkillConverter.ts` (adapter replaces it), `SkillTriggerRunner.ts`/`SkillActionRegistry.ts`/`SkillAction.ts`/`SkillTrigger.ts` IF census confirmed dead in turn path (else keep as non-combat legacy — record decision), `SkillEffectSystem.ts` same
- Modify: `Skill.ts` — split progression fields out (consumers migrate to `SkillProgressionState`); `SkillSystem.getEffectiveSkill` returns `{definition, progression}` pair; battle-scoped state (`TurnSkillSlot` cooldown home) consolidates under `SkillCombatRuntimeState` owned by the turn runtime
- Update: `docs/systems/skills.md` or equivalent + roadmap

- [ ] **Step 1 — Deletion sweep** gated on `git grep` clean + suite green.
- [ ] **Step 2 — Spec DoD sweep** (spec §73 checklist → named tests).
- [ ] **Step 3 — Verify (P3 FULL) + P18 OCR + P4 deep + P5 sequential review passes.**

**Exit criteria:** no parallel ACTIVE skill pipeline remains (`PassiveSystem` is the documented separate passive runtime — R-S7 deferred lane, not a violation); spec §73 DoD rows all mapped.

## Test matrix — spec/contract → named tests

| Source | Requirement | Test |
|---|---|---|
| §14/CON-01 | no runtime ids in defs | `SkillDefinition.test.ts :: structural runtime-id scan` |
| §21–27 | snapshot freeze | `SkillResolver.test.ts :: composite/the-burn/scaling cases` |
| §30/§63/§94 | plan-step ordering + post-reaction reads | `SkillExecutor.test.ts :: apply-then-read sees 0` |
| §41/§65 | landed semantics vs reaction | `:: landed survives downstream reaction` |
| §34/§60–62 | sequential subcasts, death handoff | `SkillSubcast.test.ts` |
| §73 | trigger_buff_periodic no lifetime advance | `SkillExecutor.test.ts :: manual tick` |
| §88 | seeded determinism | `SkillResolver.test.ts :: seeded composite` |
| spec §4–6 v1.2 | active/passive union + 3-state split | `SkillDefinition.test.ts :: union discrimination + state ownership` |
| R-S8 v2 | declarative instances, no closures | `SkillExecutor.test.ts :: instances.each rolls per instance` |
| INV-S2 | one ACTIVE pipeline | `TurnBattleSystem.skilldef.test.ts :: all active casts resolve via plan` |

## Deferred

- Passive RUNTIME migration (`PassiveSystem` → passive `SkillDefinition` execution) — R-S7, seal batch (`PassiveSkillDefinition` SCHEMA + validation land in M1 — only the runtime lane is deferred; `PassiveSystem` remains the documented separate passive runtime, not a "parallel pipeline" violation)
- Real ấn `apply_buff` eligibility + Hỏa kit authoring — seal batch
- `SkillExecutor` driving the legacy real-time `BattleSystem` lane — out of scope (dead lane)
- Reactive-window ops (`counter`/`follow_up` payload skills stay queued through `pendingReactiveEntry`/`pendingQueuedExecution` bridges — adapters emit equivalent `SkillDefinition`s; the QUEUE mechanism is unchanged this program)

## Open questions for coordinator

1. RESOLVED (r4 ruling): `reactionEligibility` is producer-path metadata — the adapter writes `'eligible'` for `appliesAilment(s)` lanes unconditionally and `'suppressed'` for non-elemental `apply_buff` lanes; the legacy `canInitiateWuxingReactions` flag is never lifted into eligibility (deleted at M-INT anyway). Whether a reaction runs is ReactionSystem's capability+registry gate.
2. RESOLVED (review v2): R-S8 — REJECTED the per-skill runtime-closure provider (it is a custom-handler lane violating spec §64 invariants). `instances.each` is declarative per-instance hit options evaluated at EXECUTE with per-instance `CombatRng` rolls; semantics it cannot express → `adapterUnsupportedMetadata` (loud, def flagged — never a hidden callback keyed by def id).
3. RESOLVED (review v2): R-S7 LOCKED — `PassiveSkillDefinition` schema + validation land in M1; `PassiveSystem` stays the passive runtime this program (separate event-driven runtime, documented deferred lane). "ONE pipeline" = one ACTIVE turn-combat skill execution pipeline.
