# Buff System Reimagined — Mission 0 Inventory

- Date: 2026-09-17
- Baseline: `feat/buff-core` @ `6ed1ea33` (stacked on amended `feat/combat-contract`; includes contract v7.1–v7.6 amendments)
- Scope: read-only census per buff megaplan M0 (plan v7 / spec v1.5)

## Step 1 — Baseline

`git rev-parse HEAD` = `6ed1ea33` — post-amendment contract tip. All M1–M3 contract dependencies are present on this branch.

## Step 2 — Contract prerequisites (BLOCKING) — ALL PRESENT

| Required surface | Status |
|---|---|
| `SetBuffStacksOperation` / `SetBuffDurationOperation` / `CleanseBuffOperation` / `BuffCleanseQuery` | ✅ `contracts/operations.ts` |
| `CleanseResult` / `RemoveBuffResult` | ✅ `contracts/results.ts` |
| `BuffInstanceSelector` (`target_definition`/`targetId` — `holder_*` fully removed) | ✅ `contracts/selectors.ts` |
| `ApplyBuffRequest` / `ApplyBuffResult` / `ConsumeStacksResult` | ✅ operations.ts / results.ts |
| `ElementalApplicationCommitted` / `BuffApplicationFailedEvent` | ✅ `contracts/events.ts` |
| `PeriodicRequestsCommitted.trigger {type, anchorEntityId?}` (NOT `holderId`) | ✅ `contracts/events.ts:92` |
| `CombatRng` | ✅ `contracts/rng.ts` + `runtime/rng/FunctionCombatRng.ts` |
| `CapabilityGrantDefinition` / `ActiveCapabilityGrant` / `CapabilityType` | ✅ `contracts/capability.ts` |
| `ElementalStateRegistry` + `createElementalStateRegistry` (all-5 validating factory) | ✅ `contracts/elemental.ts` + `runtime/elemental/ElementalStateRegistryImpl.ts` |
| `CombatAuthorityExecutionContext.combatSequence` | ✅ `contracts/context.ts` |
| Periodic requests with `requestId` + `snapshot?` | ✅ `contracts/periodic.ts` |
| `execute(op, ctx)` (scheduler builds whole ctx) | ✅ `CombatOperationExecutor.ts:57` |
| `BuffAuthority` ctx-methods incl. `setStacks`/`setRemainingDuration`/`cleanse`, `remove` → `RemoveBuffResult`, `addModifier` → runtimeId, `removeModifier` → all-matching `removedRuntimeIds`, `triggerPeriodic` → `TriggerPeriodicStartResult` | ✅ `CombatAuthorityPorts.ts` |
| `createLifecycleSink` → `{sink, sequence, settle}` | ✅ `CombatScheduler.ts:251` |
| `enqueueEvent` / `enqueueAuthored` | ✅ CombatScheduler |
| `CapabilityValidatorRegistry` (unknown type → throw) | ✅ `runtime/capability/CapabilityValidatorRegistry.ts` |
| `PeriodicOperationSettled` in `CombatEvent` union, NOT in sink-payload unions; scheduler-private `operationId→requestId` map; canonical `evt.${opId}.${ordinal}` stamping; `causationOperationId`/`rootActionId`/`allocateSeq()` | ✅ `contracts/events.ts:143`, `CombatScheduler.ts:607` |
| `TriggerPeriodicStartResult` on `triggerPeriodic` | ✅ ports + executor |

**Verdict: UNBLOCKED** — nothing missing; no local re-declaration needed anywhere.

## Step 3 — Consumer census (drives M4)

### Pools (`new BuffPool()` sites — complete list)

| Site | Role | Holder |
|---|---|---|
| `GameManager.ts:223` `readonly buffPool` + `:224 buffSystem` | Out-of-battle persistent buff pool (kiep_thuong debuff, pill buffs) | player entity |
| `TurnBattleAdapter.ts:44` `buffs: new BuffPool()` | Per-participant battle pool built at battle construction | each participant |

No other pool construction sites exist. `BattleEnemy.buffs` referenced in `Battle.ts:39` is a comment only.

### Apply lanes — holder==target invariant audit (BLOCKING check)

Every `new BuffSystem(P.buffs).apply(def, source, P.entity)` call constructs the system on the pool belonging to the entity named by `targetId`. **Invariant holds on all 9 lanes — zero exceptions found:**

| Lane | Site | Pool | targetId | ✓ |
|---|---|---|---|---|
| Self-apply (Kim Thức kit etc.) | `TurnBattleSystem.ts:1210` | `actor.buffs` | `actor.entity` | ✓ |
| appliesBuffs (skill riders) | `TurnBattleSystem.ts:1984` | `target.buffs` | `target.entity` | ✓ |
| Redirect/intercept retarget | `TurnBattleSystem.ts:2681` | `original.buffs` | `original.entity` | ✓ |
| Ailment lane (elemental) | `TurnBattleSystem.ts:2991` | `target.buffs` | `target.entity` | ✓ |
| onHitProc application | `BuffSystem.rollOnHitEffects` via `:1841` | `targetBuffs` param = `target.buffs` | `target.entity` | ✓ (ARCH-009) |
| reactiveTrigger self-application | `BuffSystem.rollReactiveTrigger:521` via `:1851` | `this.pool` = reactor's pool | reactor entity | ✓ |
| Formation grant | `GameManagerTurnBattleOps.ts:1358` | `participant.buffs` | `participant.entity` | ✓ |
| grantsBuffsAtBuild (emblem/node) | `GameManagerTurnBattleOps.ts:1382` | `participant.buffs` | `participant.entity` | ✓ |
| Talent passiveConvertsTo | `GameManager.ts:272` | `player.buffs` (battle) | `player.entity` | ✓ |
| Persistent apply (pill/kiep_thuong) | `GameManagerPersistentEffectOps.ts:406` → `deps.buffSystem` | `GameManager.buffPool` | resolved player entity | ✓ |
| PillBagSection out-of-battle | `PillBagSection.vue:201` | `gameManager.buffPool` via `buffSystem` | battle/player entity | ✓ |
| Survive-lethal cleanse grant (`tu_sinh_ngo`) | `GameManagerTurnBattleOps.ts:1149` `surviveEffects.buffSystem` | `playerParticipant.buffs` | player entity | ✓ |

**Conclusion:** `targetId` alone can absorb the "holder" role — the M1 single-store design needs no separate holder key. Proc-routed buffs already land on the victim's pool (ARCH-009 fix held).

### Reads

| Consumer | Site | API |
|---|---|---|
| Effective-stat recompute | `TurnStatsRecompute.ts:24` via `TurnBattleSystem.ts:549` | `new BuffSystem(buffs).getActiveModifiers()` per participant |
| Live modifier provider (player only) | `GameManagerTurnBattleOps.ts:192` `liveStatModifiers` → `getLiveBattleModifiers` | persistent pool `getActiveModifiers` (`GameManagerPersistentEffectOps.ts:82,138`) |
| CC gate before action | `TurnBattleSystem.ts:1077` | `isStunned/isFrozen` on `actorBuffSystem`; `:1080` `clearCcEffects` (Bá Thể) |
| Taunt redirect | `TurnBattleSystem.ts:270` | `actor.buffs.getAllById('khiem_khich')` |
| Bất Tử Bá Thể check | `TurnBattleSystem.ts:1069`, `TheTuBatTuSurvival.ts:47` | `getAllById('bat_tu_ba_the')` |
| consumesAilmentId (detonate) | `TurnBattleSystem.ts:1819-1824` | `getStacks` + `removeAllById` on `target.buffs` |
| Thể economy | `TheEconomy.ts:37,81,96` | `hasAny('ung_the')`, `getAllById('ung_the')` on holder pool |
| UngThe combatant check | `TurnBattleSystem.ts:984,2348` (`isUngTheCombatant`) + `:985,2354-2356,2699` (theGain*) | reads `participant.buffs`/`actor.buffs`/`target.buffs` |
| Proc cost check | `TurnBattleSystem.ts:2415` (`resolveProcCost`) | reads `holder.buffs` |
| DoT source trigger resolution | `TurnBattleSystem.ts:1105-1110` `resolveSourceBuffs` | `participant.buffs.getAll()` (READ — DoT ticks from source's pool entries) |
| dotRecovery triggers | `CombatSystem.ts:596` `dotRecoveryTriggers(source, element, sourceBuffs)` | source pool getAll via `resolveSourceBuffs` |
| CC removal check | `CombatSystem.ts:649,664` (survive/cleanse lane) | `effects.buffSystem.remove`, `clearCcEffects` |
| Turn buff tick enumeration | `TurnBattleSystem.ts:1110` | `participant?.buffs.getAll()` |
| Status presentation | `TurnStatusPresentationEvents` + `GameManagerTurnBattleOps` snapshot diff | pool `getAll()` per participant (key `target:buff:source`) |
| UI badge row | `TurnOrderStrip.vue:87` | `member.buffs.getAll()` + `BUFF_REGISTRY` + `buffDisplayName` |
| Formation def lookup | `GameManagerTurnBattleOps.ts:1349` | `BUFF_REGISTRY.get(...)` |
| Reaction consumption | `TurnReactionManager.ts:81` | `targetBuffs.getFromSource(newBuffId, source.id)` — **to be REMOVED at M-INT** |

### Writes / removals

| Lane | Site | Op |
|---|---|---|
| appliesBuffs loop | `TurnBattleSystem.ts:1984` | `apply` × stacks |
| Ailment lane | `TurnBattleSystem.ts:2991` | `apply` × stackCount |
| Detonate consume | `TurnBattleSystem.ts:1824` | `removeAllById(consumesAilmentId)` |
| CC clears | `TurnBattleSystem.ts:1080,1980`; `CombatSystem.ts:664` | `clearCcEffects()` |
| Survive cleanse | `CombatSystem.ts:649` | `buffSystem.remove(buff.id, buff.sourceId)` |
| Reaction manager call | `TurnBattleSystem.ts:2996` `reactionManager.checkAndTrigger(target.buffs, ailment.buffDefinitionId, actor.entity, target.entity, this.combat)` | **REMOVE at M-INT** — reaction consumption moves to the reaction engine |
| externalWard reconcile | `TurnBattleSystem.ts:547` `reconcileExternalWard(entity, participant.buffs, registry)` + `:1998` `entity.externalWard` + `:2682` | entity-field ward pool + pool reconcile — TheTu-owned lifecycle |
| Gauge-delta | `TurnBattleSystem.ts:2013-2014` records `pendingGaugeDeltaTargets`/`pendingGaugeDeltaDefinition`; `:2842-2848` `applyGaugeDeltaEffects` refunds gauge on recipient | fires once per apply — capability `gauge_delta` candidate |

### Executing-effect consumers (payload readers → capability mapping)

| Effect kind | Consumer today | New home |
|---|---|---|
| `statModifier` | `getActiveModifiers` → `recomputeEffectiveStats`/`liveStatModifiers`/menu aggregation | `getStatModifiers(targetId)` (R-B5) |
| `dot` | `resolveSourceBuffs` → `CombatSystem.applyDotDamage` tick | `periodic[{type:'damage', timing:'holder_turn_end', scaling:'dynamic'}]` (R-B2) |
| `cc` | `isStunned/isFrozen/isRooted` + `clearCcEffects` | `control`/cc query + `hasControl(targetId, cc)` |
| `onHitProc` | `rollOnHitEffects` (:1841) | capability grant `on_hit_proc` (proc domain owns payload) |
| `reactiveTrigger` | `rollReactiveTrigger` (:1851) — reflection/follow-up resolution | capability grant `reactive_trigger` |
| `reactiveProc` | TheTu proc lanes (`:2399-2415`) | capability grant `reactive_proc` |
| `reactiveEconomy`/`theEconomy` | `isUngTheCombatant`/`theGain*`/`tryPayProcCost` (TheEconomy.ts, :984-985, :2348-2356, :2699, :2415) | capability grants `the_economy`/`reactive_economy` (TheTu module) |
| `gaugeDelta` | `pendingGaugeDelta*` + `applyGaugeDeltaEffects` (:2842) | capability grant `gauge_delta` |
| `dotRecovery` | `dotRecoveryTriggers` (`CombatSystem.ts:596`) — Độc Căn | capability grant `dot_recovery` |
| `marker` | `hidden`/marker reads (presentation skip, externalWard reconcile) | `kind:'marker'` + marker semantics |

## Step 4 — Data census (`game/src/data/buff/` — 60 defs / 8 files)

**Registry shape note:** `data/buff/BuffRegistry.ts` wraps defs through `toBuffDefinition(live)` — a load-time converter that already maps `convertsAfterContinuousSeconds → convertsAfterContinuousTurns` and keeps `duration` numerically unchanged (seconds→turns same number). M4 data migration replaces this converter with direct authoring.

| File | Defs | Notable |
|---|---|---|
| BossBuffs.ts (3) | `foundation_dragon_enrage`, `mortal_crocodile_enrage`, `qi_refining_serpent_enrage` | all `stackMode:'replace'`, `duration:Infinity`, statModifier only |
| KiemPhoBuffs.ts (1) | `kiem_thuong` | `stack`, element `physical`, maxStacks 3, dot — persistent debuff applied via buffPool |
| LegacyBuffs.ts (22) | ailments `bong`(fire,stack5), `trung_doc`(wood,stack5), `chay_mau`(metal,stack5), `te_cong`(water,refresh), `hoai_tu`(earth,stack4), `dung_nham`(fire), `huyet_doc`(metal), `van_kiem_vu`(metal); cc `troi_chan`(earth), `choang`, `dong_bang`; stat `thach_giap_buff`,`ngung_lo`,`khai_son`(stack3),`lam_cham`,`han_khi`(stack5),`cuong_bao`,`suy_nhuoc`,`uy_ap`,`giap_ran`; `thach_hoa`(stat+onHitProc,earth); `doc_the`(stat+dotRecovery,wood,stack5) | **convertsToId chain: `lam_cham`+`han_khi` → `dong_bang`** (NOT te_cong as plan estimated); `lam_cham` is the ONLY `convertsAfterContinuousSeconds` user — already normalized to turns by the registry converter (see blocking note) |
| TalentBuffs.ts (5) | `kiem_vuc`, `trong_kich_burst`, `thach_nham`, `sat_na`, `tu_sinh_ngo` | all refresh/statModifier; `tu_sinh_ngo` = survive-lethal grant |
| TheTuBuffs.ts (8) | `bat_tu_ba_the`(marker+reactiveTrigger+statModifier+theEconomy, uniquePerTarget, clearsCcOnApply, fixed_holder_turns, hidden), `phan_chinh`(reactiveTrigger, ∞), `son_nhac`(stat, fixed_holder_turns, SON_NHAC_TURNS), `son_nhac_ho_the`(marker, uniquePerTarget, fixed_holder_turns), `khiem_khich`(theEconomy+reactiveProc, uniquePerTarget, hidden, KHIEM_KHICH_TURNS), `tu_the`/`bach_ung`(reactiveEconomy, fixed_holder_turns), `ho_ve`(marker, uniquePerTarget, fixed_holder_turns, hidden) | ALL `stackMode:'replace'`; 6× `durationPolicy:'fixed_holder_turns'` → `{clock:'holder_turns', scaling:'fixed'}`; 3× uniquePerTarget; ~230 lines of marker/economy carriers — biggest capability-mapping file |
| ThuanHeBuffs.ts (14) | `thanh_tuyen`,`bang_giap`,`hoi_luu`,`cau_mang_can`(cc,wood),`kim_giap`,`dia_tru`,`thanh_luy`(stack8),`dia_tru_bich`,`dia_tru_thu`,`the_man_{fire,water,wood,metal,earth}`(stat,∞) | formation/path buffs |
| ZoneDotBuffs.ts (1) | `dung_nham_burn` | refresh, fire dot — zone DoT |
| buffs.ts (6) | `kiep_thuong`(stat, refresh, duration 60), `tran_phap_{doc_hanh,luong_nghi,tam_tai,ngu_hanh,cuu_cung}_buff`(stat, refresh, ∞) | `kiep_thuong` = persistent debuff (buffPool, wall-clock 60s → `clock:'seconds'`); tran_phap_* persistent formation buffs |

**Counts:** stackMode `refresh`×41 / `replace`×12 / `stack`×9 · effect kinds `statModifier`×80 / `dot`×13 / `cc`×7 / `onHitProc`×3 / `reactiveProc`×4 / `reactiveEconomy`×2 / `marker`×3 / `reactiveTrigger`×1 / `theEconomy`×1 / `dotRecovery`×2 / `gaugeDelta`×0-def (payload exists on defs applied via gauge path — verify at M4 per-def) · `uniquePerTarget`×3 defs · `clearsCcOnApply`×1 def · `convertsToId`×2 defs · `element:`×~17 defs · `hidden`×3 defs.

**`convertsAfterContinuousSeconds` blocking check — RESOLVED:** only `lam_cham` uses it, and the registry converter already remaps it to `convertsAfterContinuousTurns` at load (`BuffRegistry.ts:38`). No battle def relies on runtime wall-clock continuousSeconds advance. M4 data migration: author `convertsAfterContinuousTurns` directly; drop the converter.

**Duration semantics:** turn-battle defs tick `remainingTurns` per holder turn (`clock:'holder_turns'`); persistent-pool defs (`kiep_thuong`, tran_phap_*, pill buffs) tick `remainingTime` by deltaSeconds (`clock:'seconds'`); `duration:Infinity` = permanent until removed.

**Canonical ấn status:** `ElementalStateRegistryImpl` factory exists but has **no production binding** — canonical ấn definitionIds are seal-batch content (reaction M-INT binds them). ALL current element-tagged defs (`bong`,`trung_doc`,`chay_mau`,`te_cong`,`hoai_tu`,`cau_mang_can`,etc.) are element-tagged **noncanonical** — they produce no `ElementalApplicationCommitted` post-M-INT. `kiem_thuong`/`thach_hoa`/etc. element fields are tags, not ấn.

## Step 5 — Effect/capability usage matrix

| `BuffEffectTemplate` kind | Defs using it | Spec/capability mapping |
|---|---|---|
| `statModifier` | 48 defs | spec `statModifiers[]` — projected via `getStatModifiers` (R-B5) |
| `dot` | 13 defs | spec `periodic[{type:'damage'}]` (R-B2); `dpsRatio`→coefficient; `armorIgnorePercentByRealm`→request `tags` |
| `cc` | 7 defs | spec `control`/`cc` effect + `hasControl` query; `forbiddenActionTags` (R-B6) |
| `onHitProc` | `thach_hoa` + proc defs | capability grant `on_hit_proc` (proc module schema) |
| `reactiveTrigger` | `bat_tu_ba_the`, `phan_chinh` | capability grant `reactive_trigger` |
| `reactiveProc` | `khiem_khich` + TheTu lanes | capability grant `reactive_proc` |
| `reactiveEconomy` | `tu_the`, `bach_ung` | capability grant `reactive_economy` |
| `theEconomy` | `bat_tu_ba_the`, `khiem_khich` | capability grant `the_economy` |
| `dotRecovery` | `doc_the` | capability grant `dot_recovery` |
| `marker` | `bat_tu_ba_the`, `son_nhac_ho_the`, `ho_ve` (+hidden flag) | `kind:'marker'`/`hidden` semantics |
| `gaugeDelta` | gauge-path defs (pendingGaugeDelta lane) | capability grant `gauge_delta` |

No silent drops: every in-use kind has a mapped home. Unused template kinds (if any beyond these 9) get no capability — fine per spec.

## Step 6 — Authority matrix + rulings (for sign-off)

| Ruling | Locked decision | Census evidence |
|---|---|---|
| R1 | NO separate turn-native impl to absorb — `core/buff/` is already canonical; `TurnBuff*.test.ts` files exercise it. `docs/systems/buffs.md:5` is STALE (claims `TurnBuffSystem.ts`/`TurnBuffPool.ts`/`TurnBuffs.ts`/`TurnBuffRegistry.ts` exist — they don't). | `ls src/core/battle/turn/` — only `*.test.ts`; `docs/systems/buffs.md` vs reality |
| R2 | Persistent buff authority = `GameManager.buffPool`/`buffSystem` (`GameManager.ts:223-224`) via `GameManagerPersistentEffectOps.applyPersistentBuff` (`:406`) + per-tick update. Migrates to `BuffPersistence` (standalone per-player pool, own sink+sequence, NO scheduler). `player.persistentTimedEffects` is a DIFFERENT system (deadline `expiresAtMs`, pills/Tu Linh Tran) — untouched. | `GameManagerPersistentEffectOps.ts` vs `player.persistentTimedEffects` ops — confirmed distinct |
| R-B1 | `BuffInstanceId` = `buff.${battleId}.${counter}`; `battleId` minted at composition root (`GameManagerTurnBattleOps`); persistent mode `buff.persistent.${ownerId}.${counter}` local counter. | — |
| R-B2 | DoT → `periodic[{type:'damage', timing:'holder_turn_end', scaling:'dynamic', stackScaling:'multiply', damageProfile:'legacy_dot'}]`; wall-clock → `timing:'interval'`+`clock:'seconds'`; `scaleBuffPotency`→`AddBuffModifier{channel:'potency',reapply:'max'}`; `armorIgnorePercentByRealm`→request `tags`. | tick site `:1110`; potency amp (Cong Minh) parity preserved as data |
| R-B3 | Multiplicative application chance (spec §12), exactly one `rng.rollChance` per apply. Legacy additive `AilmentChance` NOT carried over — deliberate spec-directed change; re-tune = seal batch. | — |
| R-B4 | `instanceScope` `per_source`(default)/`per_target`(replaces `uniquePerTarget`); `per_target` keeps ONE instance, `sourceId` transfers per `sourceOwnership`(default `'latest'`), instanceId STABLE. | 3 defs use `uniquePerTarget` — all TheTu |
| R-B5 | `getStatModifiers(targetId)` returns legacy `StatModifier[]` shape (stacks, sourceType from polarity); `potency` channel scales magnitudes. | `liveStatModifiers` closure + `recomputeEffectiveStats` consumers keep shape |
| R-B6 | `forbiddenActionTags` on BuffDefinition → ActionValidator; `hasForbiddenTags`/`hasControl` read-only queries. | cc defs: `troi_chan`,`choang`,`dong_bang`,`cau_mang_can` |
| R-B7 | `convertsToId` re-applies through `apply()` with `reactionEligibility:'suppressed'` + lifecycle-scoped ctx; removal reason `'replaced'`; `convertsAtStackCap` = stack-mode reach-cap conversion. | `lam_cham`+`han_khi` → `dong_bang` (2 defs; NO convertsAtStackCap users today) |
| R-B8 | Lifecycle barrier protocol: entry points take `BuffLifecycleContext{rootActionId, sequence, events, settle}` from `createLifecycleSink`; order = sorted periodics → per-unit {revalidate→compute→emit→settle} → liveness sweeps → lifetimes/conversion/expiry → lifecycle events → final settle. | contract `createLifecycleSink{sink,sequence,settle}` verified present |
| R-B9 | Snapshot periodics: `scaling:'snapshot'`+`snapshotFields` ⊆ profile schema; capture on EVERY successful apply after source-ownership resolution; request carries `snapshot`. | contract `snapshot?` on requests verified present |

## Exit criteria status

- ✅ Every consumer accounted (pools×2, apply lanes×12, reads×17, writes×8, payload consumers×10).
- ✅ Every definition accounted (60 defs, 8 files, full flag matrix).
- ✅ Contract prereqs verified incl. v7.1–v7.6 — UNBLOCKED.
- ✅ holder==target invariant PROVEN — zero exceptions across all apply lanes.
- ✅ Stale doc recorded: `docs/systems/buffs.md:5` (TurnBuff* claims) — flag for M5 doc sweep.
- ✅ `convertsAfterContinuousSeconds` blocking check RESOLVED — registry already normalizes; `lam_cham` authors turns directly at M4.

**M0 verdict: COMPLETE — ready for M1.**
