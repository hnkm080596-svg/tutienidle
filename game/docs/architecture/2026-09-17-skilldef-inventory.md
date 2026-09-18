# Skill Definition — Mission 0 Inventory + Prerequisite Verification

Read-only inventory per megaplan v2.1 Mission 0 (docs/specs/2026-09-17-skill-definition-system-spec.md v1.3, docs/superpowers/plans/2026-09-17-megaplan-skill-definition.md v2.1). Records evidence; decides nothing the rulings already locked.

## Step 1 — Baseline lock

- Worktree: `.agent-worktrees/skill-definition`, branch `feat/skill-definition`.
- Baseline commit: `2e2a7df1` (docs commit carrying megaplan v2.1 + spec v1.3 + contract/buff v1.6 addenda) on top of master `d8bc90f3` (buff M5 deletion sweep merge).
- Baseline verification: `npm run type-check` clean; `npx vitest run` = 664 files passed / 1 failed, 5615 tests passed / 1 failed / 4 expected-fail.
- **P12 pre-existing failure (not task-caused):** `tests/architecture/asciiComments.test.ts` — "no comment token carries non-ASCII beyond the recorded baseline". The offender list (~40 files: `TurnSkillAction.ts`, `CombatSystem.ts`, `buff2/BuffNames.ts`, `data/buff/*.ts`, …) consists of non-ASCII comments (`—`, `→`, Vietnamese) that landed with the buff M5 merge `d8bc90f3`. The baseline file `tests/architecture/baselines/asciiComments.json` predates that merge. Fix = regenerate baseline (`node scripts/p15-baseline.mjs`) or clean comments — owner: buff M5 lane / user decision. This branch's only prior commit touched `.md` files (not scanned). Recorded, not fixed here (P12 classification: pre-existing; out of authorized scope).

## Step 2 — Prerequisite verification (post-cutover baseline)

| Prerequisite | Status | Evidence |
|---|---|---|
| Contract ops union | PASS | `contracts/operations.ts:89-108` — `CombatOperation` union: deal_damage, heal, apply_buff, add/remove/consume/set buff stacks, add/remove buff modifier, refresh/extend/set buff duration, trigger_buff_periodic, remove_buff, cleanse_buff, push_gauge, gain/consume resource, apply_shield |
| `CombatOperationOrigin{kind:'skill',castId,subcastIndex}` + `originId` | PASS | `contracts/origin.ts:14-35` — kind union includes `'skill'` (:15), `originId` (:23), `castId?` (:32), `subcastIndex?` (:33). NOTE: `castId`/`subcastIndex` are minted by NO production code today — contract scaffolding for this program (grep over `src/` returns zero non-test hits outside `contracts/origin.ts`). |
| Scheduler `enqueueAuthored`/`run()` + per-op settlement barrier | PASS | `runtime/scheduler/CombatScheduler.ts:188` `enqueueAuthored(ops)`, `:319` `run(): CombatTrace`; in-run enqueue is a structural fault (:149). Turn lane wraps it: `TurnBattleSystem.emitAndSettle` (`:568`) = enqueueAuthored → run → sweepBuffDeaths. |
| `CombatAuthorityPorts` (Buff/Damage/Gauge/Resource/Shield/Heal) | PASS | `runtime/scheduler/CombatAuthorityPorts.ts:31,118,128,136,156,164,171` — all six authorities + the ports bundle |
| `CombatOperationBatchRunner` / `DeferredOperation` | PASS | `CombatOperationBatchRunner.ts:97` class + `:45` `isDeferredOperation` + `:62` `BatchResultStore`; `contracts/settlement.ts:48` `DeferredOperation` |
| `ApplyBuffRequest.reactionEligibility` | PASS | `core/buff2/BuffSystem.ts:319` (`reactionEligibility: req.reactionEligibility`), `:215`/`:1128` suppressed continuation lanes |
| `BuffReadPort` (`getStacks`/`getInstance`/`has`) | PASS | `core/buff2/BuffQuery.ts:21,28,37` interface + `:87,106,197` implementation |
| `triggerPeriodic` | PASS | `core/buff2/BuffSystem.ts:~612` — emits first unit's request, pending continuation per unit (never advances lifetimes) |
| `consumeStacks` | PASS | `core/buff2/BuffSystem.ts:396` |
| `cleanse` | PASS | `core/buff2/BuffSystem.ts:584` — iterates `sortedForTarget` (:1216), removes EVERY matching dispellable (`'cleansed'`), non-dispellable matches → `skipped`. Signature has NO `limit` today — contract v1.6 adds it (M1). |
| Cutover: buff2 `BuffSystem` in battle lane, no `BuffPool` | PASS | `TurnCombatRuntime.buffs` (`TurnBattleSystem.ts:438`); `BuffPool` only survives in comments (`BuffStore.ts:1`, `BattleCyclePolicy.ts:17`, `GameManagerTurnBattleOps.ts:1562`) |
| `TurnReactionManager` / `canInitiateWuxingReactions` absent | PASS | zero grep hits across `src/` |
| `ElementalStateRegistry` five canonical ấn | PASS | `contracts/elemental.ts:7-12` — fire→hoa_an, water→han_tuc, wood→doc_can, metal→liet_thuong, earth→tran_an |

**Newly verified facts that shape M1–M4:**

- `ConsumeResourceOperation.payload` already carries `amount: number | 'all'` and `valueSource: 'current' | 'cast_snapshot'` (`operations.ts:253-263`) — the spec §26 `theBurned` freeze already has its contract carrier; `'all'` + `'cast_snapshot'` is explicitly contradictory by contract comment. The consume-all-The path is `amount:'all'` resolved at execution; `CastSnapshot.resourcesConsumed` feeds `theScaling` (a coefficient input), not the spend amount.
- `DealDamageOperation.payload` (`operations.ts:110-137`) fields today: `targetId`, `element?`, `damageProfile`, `coefficient`, `hitCount`, `canCrit`, `canMiss`, `periodicId?`, `tags?`, `stackCount?`, `snapshot?`, `statSourceId?`. Contract v1.6 adds `hitPolicy`/`critPolicy`/`armorPolicy` (M1) — confirmed absent.
- `CleanseBuffOperation.payload` (`operations.ts:233-236`) = `{targetId, query: BuffCleanseQuery}` — no `limit` today (M1 adds). `BuffCleanseQuery` (`:221-231`) = `kind?`/`polarity?`/`tags?`/`element?`/`definitionId?`; `polarity:'debuff'` covers debuff+ailment via `sourceTypeOf(def)`.
- `SkillToTurnSkillConverter.ts` is the ONLY surviving bridge — `toTurnSkillDefinition` (:112) + `collectUnsupportedSkillSemantics` (:73) are the direct ancestors of `LegacySkillAdapter` + `adapterUnsupportedMetadata`. `SUPPORTED_EFFECT_TYPES` = {damage, debuff, buff, add_stack} — 'heal' and 'remove_buff' THROW today (:117).

## Step 3 — Skill producer census

### 3a. `data/skill/` producers

| File | Produces | Export/keying | Lane |
|---|---|---|---|
| `CoreSkills.ts` | `Skill` | `CORE_SKILLS: Skill[]` — tram, linh_bao, huy_quyen, van_phap_tuy_tam, da_phap_lien_tuyen, ngo_dao_hon_don, hoa_cau_thuat, doc_chuong, thuy_tien_thuat, diem_kim_thuat, tho_cau_thuat, passive_kiem_tam_lanh_liet | Legacy→converter. 3 basics carry the ONLY converter-legal trigger shape (`onCast`→`dealDamage`); van_phap/da_phap are data shells — composite/repeat/multicast injected by `applyAnKitTo*`; ngo_dao_hon_don is a passive emblem shell; passive_kiem_tam_lanh_liet is a PassiveSystem passive |
| `PhapTuChainSkills.ts` | `Skill` | chain-skill `Skill[]` | Legacy→converter |
| `PhapTuUltimates.ts` | `Skill` + `PHAP_TU_ULTIMATE_IDS`/`PROFILES` | ultimate `Skill[]` | Legacy→converter (route mutates effective skill pre-conversion via `applyRouteToEffectiveSkill`) |
| `PhapTuEmpoweredUlts.ts` | `TurnSkillDefinition` | `PHAP_TU_EMPOWERED_ULTS[element][variant]` | Native turn defs — `consumesAllThe`, `detonateDoT`, `theScaling`, `consumesAilmentId`/`damagePerStack` |
| `TheTuSkills.ts` | `TurnSkillDefinition` | `CUONG_QUYEN`, `LOAN_DAU`, `BAT_TU_BA_THE`, `TRAN_AP`, `PHAN_CHINH`, `SON_NHAC`, An-kit defs (`THAM_THE`,`TU_THE`,`BACH_UNG`,`PHAN_KICH`,`TRO_KICH`,`TRONG_PHAN_KICH`), `buildTheTuKit`/`buildTheTuAnKit` | Native turn defs + orchestrator clone factories |
| `NguKiemDaoSkills.ts` | `TurnSkillDefinition` | `NGU_KIEM_THUAT`, `TU_KIEM_Y_EMBLEM`, `KIEM_DAO_CASCADE_EMBLEM` | Native turn defs + 2 emblem defs (`emblemOnly`); `instances`/`perInstanceOptions` injected by provider, not authored here |
| `KiemPhoOrbs.ts` | `TurnSkillDefinition` | `KIEM_PHO_ORBS: Record<OrbId,TurnSkillDefinition>` (orb_dam/chem/bo/hat/quet), `ORB_UNLOCK_REALM`, `unlockedOrbs(realmIndex)` | Native turn defs — the dynamic-basic orb pool |
| `KiemPhoCombos.ts` | `KiemPhoCombo[]` (NEITHER Skill nor TurnSkillDefinition) | `KIEM_PHO_COMBOS` — 37 combos: id/name/pattern/presetId + scaffold damage/buffPayload | Provider-consumed match table (`KiemPhoSystem.recordCastAndMatch`) — combo mechanic is provider-level, not a castable skill |
| `TurnAnKitSkills.ts` | `TurnSkillDefinition` mutators | `applyAnKitToBasic`, `applyAnKitToSpecial` | Orchestrator — attaches `compositePicks`/`repeatCasts`/`multicast` onto clones |
| `TurnBasicAttacks.ts` | `TurnSkillDefinition` | `KIEM_TU_BASIC`, `PHAP_TU_BASICS`, `GENERIC_PHYSICAL_BASIC`, `BASIC_ATTACKS_BY_BUILD` | Native turn defs — basics + enemy specials |
| `PassiveSkills.ts` | `Skill` (all `type:'passive'`) | `PASSIVE_SKILLS: Skill[]` | PassiveSystem runtime — never converted |
| `TalentPassives.ts` | `Skill` (passive) | `TALENT_PASSIVE_SKILLS`, `getTalentPassiveSkill(id)` | PassiveSystem; granted/revoked into `SkillManager` by `syncTalentCombatPassive` |
| `Skills.ts` | `Skill` aggregate + kit id registry | `SKILLS: Skill[]`, `PHAP_TU_KIT_IDS` | Template registry — `registerSkillTemplates(SKILLS)` at `App.vue` |
| `TurnSkillDisplayMeta.ts` | display map (not execution) | `TURN_SKILL_DISPLAY_META`, `turnSkillDisplayMetaOf` | UI seam — `TurnSkillDefinition` carries no name/description; `SkillDefinition.name` fills this gap |
| `data/companion/Companions.ts` | `TurnSkillDefinition` | companion kits via `resolveCompanionSkillKit` (`CompanionProgression.ts:218`) | Native turn defs with constellation `skill_override` perks |

### 3b. Orchestrator-authored `TurnSkillDefinition`s

| Mechanism | Site | Semantics |
|---|---|---|
| `resolveAuthoredBasic` | `CultivationPathRegistry.ts:194` | `skillManager.get` → `getEffectiveSkill` → `collectUnsupportedSkillSemantics` (warn) → `toTurnSkillDefinition` → `applyRouteToTurnSkill` → An-kit attach → `applyPhapTuTheGains` → forced `cooldownTurns:0`/`resourceType:'none'`/`resourceCost:undefined` |
| `resolveAnElementBasicPool` | `CultivationPathRegistry.ts:114` | composite pool = CANONICAL `Skill`→converter of the five element basics (missing template throws) |
| `applyPhapTuTheGains` | `CultivationPathRegistry.ts:136` | `theGainOnLandedCast`/`theGainOnCrit` attach — base + node `aggregateTurnSkillResourceModifiers` + route profile `critTheGain`; ngu_hanh-gated |
| `applyPhapTuEmpowerment` (`linh_ngo_*`) | `CultivationPathRegistry.ts:165` | `linh_ngo_<godUltId>` node gate → `empowerment:{theThreshold,empowered}` attach; route profile picks 'dot'/'no' variant |
| `applyAnKitToBasic`/`applyAnKitToSpecial` | `TurnAnKitSkills.ts:36,55` | attaches `compositePicks` (basic), `repeatCasts`/`compositePicks` (special), `multicast` (ngo_dao_hon_don passive owned) |
| `resolveSpecialUltimate` (ngu_hanh) | `CultivationPathRegistry.ts:386` | special = converter + route + theGains; ultimate = same + empowerment |
| `resolveTheTuKit`/`resolveTheTuAnKit` | `CultivationPathRegistry.ts:274,297` | TheTu kit selection by owned root |
| `buildTheTuKit`/`buildTheTuAnKit` | `TheTuSkills.ts:375,238` | participant-local `structuredClone`s with `collectTheTuKitModifiers`/`collectTheTuAnMechanicModifiers` baked in (damage/duration/reflect/ward/taunt/income fields); An kit also builds `reactivePayloads` map + `maxThe`; `grantsBuffsAtBuild` carries ung_the + root markers |
| `collectTheTuAnMechanicModifiers` | `TheTuAnMechanicModifiers.ts:72` | aggregates `node.effect.theTuAnMechanicModifiers` × level (path+way gated) |
| `emblemSlots` | `CultivationPathRegistry.ts:367` | ngu → `{special: TU_KIEM_Y_EMBLEM, ultimate: KIEM_DAO_CASCADE_EMBLEM}` — `emblemOnly` defs, never selectable (`slotReady` skips, `TurnSkillAction.ts:516`) |
| `dynamicBasic` providers | `NguKiemDaoProvider.ts:63`, `KiemPhoProvider.ts:52` | provider OWNS the basic slot (`basicAction` reads `dynamicBasic.resolveBasic` at `TurnSkillAction.ts:492`); manual picks via `resolveManualPick` |
| Ngũ Kiếm Đạo `instances`+`perInstanceOptions` | `NguKiemDaoProvider.ts:68-105` | per-instance `guaranteedHit:true`; unlock a → execute `hpRatio < min(0.5, 0.1*realmIndex)` → `damageMultiplier=EXECUTE_MULT`; unlock e → `rng < CASCADE_CRIT_CHANCE` → `critical`; unlock d → `rng < CASCADE_PIERCE_CHANCE` → `armorBypass` else `armorPierceFraction=PIERCE_FRACTION`; `count = kiemDaoCount` (live PlayerData read, mid-battle forge reflected); `onCastResolved` → `gainKiemY(player,1)` |
| `resolveCompanionSkillKit` | `CompanionProgression.ts:218` | companion basic/special/ultimate; `unlockThresholds` gate, constellation `skill_override` perks |
| `reactivePayloads` | `buildTheTuAnKit` (`TheTuSkills.ts:303-330`) | participant-local PHAN_KICH/TRONG_PHAN_KICH/TRO_KICH clones resolved by the typed follow-up queue via `QueuedFollowUp.payloadSkillId` |

### 3c. `SkillSystem` surface (progression owner — feeds `SkillProgressionState`)

`core/skill/SkillSystem.ts` (409 lines): `getEffectiveSkill` (specialization resolution — full replace via `SkillSpecialization` overrides), `selectSpecialization`, `equipToSlot`/`getLoadoutSkills`/`getEquippedInSlot`, `recordCast` (:381 — the cast-count sink: `totalExperience`++ → `CAST_LEVELING_THRESHOLDS` auto-level for tram/huy_quyen → `castCountSink`), `upgradeSkill` (Cam Ngo leveling), `getCastLeveledSkillLevel`/`getHuyKiemFlatDamageBonus` (xp→damage inputs the resolver's `statScalars` must feed).

### 3d. `PassiveSystem` surface (separate runtime — R-S7 deferred)

`core/skill/PassiveSystem.ts` (291 lines): `passiveTrigger`/`passiveModifiers`/`passiveCondition{hpBelow}`/`passiveConvertsTo{buffId}` on `Skill`; `getScaledPassiveModifiers` (:207), `resetStacks`, `bankBattleCarryStacks`/`seedBattleCarryStacks` (phaGiap carry), `tick` (per-second accumulator), `passiveConvertsTo` threshold conversion. `SkillEvents.ts` passive vocabulary: `cast,hit,kill,damage_taken,attack,critical,dodge,block` + `per_second`. Census documents the surface; PassiveSystem stays the passive runtime.

## Step 4 — Cast-path trace

Entry → exit, with the seams the new pipeline must replace:

```
resolveNextStep / resolveActorTurn (TBS:3153)
→ declareActorAction (TBS:1116)
   ├─ queued-execution branch: pendingQueuedExecution → declareQueuedExecution (:2425)
   │    re-rolls compositePool per execution; builds TurnSkillExecution{source:'repeat'|'multicast', multicastDepth}; NO selectAction/CC/turn machinery
   ├─ reactive bypass: pendingReactiveEntry → declareReactiveBypass (:2978)
   │    payload = reactivePayloads[payloadSkillId] ?? basic; bach_ung riders merge payloadAilments; slotless action (no commit)
   └─ natural turn:
        totalTurnsElapsed++; round boundary (actedThisRound sweep → round income gain_resource ops → onRoundEnd lifecycle)
        → onHolderTurnStart lifecycle → charge tick/resolve (chargingTurnsRemaining--; resolve captures chargedSkill + chargeTargetIds)
        → onCastBegin reactive trigger (procs.rollReactiveTrigger)
        → CC check (bat_tu_ba_the suppress / hard-CC counter / Ba The 3-turn clear)
        → cooldown snapshot → onHolderTurnEnd lifecycle (DoT ticks) → refreshParticipantStats
        → post-status death boundary (early return) → applyTurnRegen → resource deltas → bossTrigger
        → tickCooldowns (exclude status-phase commits) → selectAction/selectForcedAction (slotReady: !emblemOnly + cooldown 0 + hasResourceFor; Cam Cong forbiddenActionTags)
        → specialAttackCounter everyNth replace (enemy scripted specials)
        → execution record {rootSkillId, resolvedSkill, source:'original'}
        → empowerment swap (currentThe >= theThreshold → resolvedSkill=empowered, source='empowered')
        → compositePicks roll (pickCompositePool; picks[0]=payload, source='composite', extras→compositePickedSkills)
        → sealed-payload check (resolved payload tags vs forbiddenActionTags → NULL_ACTION)
        → consumesAllThe → execution.theBurned = currentThe (PRE-BURN capture, Task 13)
        → charge-init (chargeTurns>0 → chargingTurnsRemaining + pendingChargedSkillId; NO immediate resolve)
        → selectTarget (taunt→row→Chebyshev) → collectTurnTargets (AOE shape, primary guaranteed)
        → scaledDamage = damage × suddenDeathMultiplier × (1 + theBurned/100 × theScaling.coeff)
→ applyActionImpact (TBS:1703)
   ├─ resolveInterceptWindow (Ho substitution rewrites declared.affected)
   ├─ charge-resolve branch (:1736): per chargeTargetId → resolveDeclaredHit → grantTheFromCast (chargedSkill fields) → early return
   ├─ charge-init commit (:1809): chargeTurns>0 && executionCommitsCast → commitCast — fires HERE because affected=[] for enemy-targeted charge skills
   └─ normal path (declared.action && affected.length>0 — a cast with NO valid targets never commits):
        eventBus.emit('attack') → composite extras lane → per-target loop:
          instances loop (count, perInstanceOptions → hitOptions) → resolveDeclaredHit per (target × instance)
          mid-impact death breaks (actor dead → stop all; target dead → next target)
        non-damaging lane: applySkillAilments + detonateDoT per target
        → executionCommitsCast → commitCast (:1957) — POST-hit-loop commit
        → grantTheFromCast (post-commit: gain lands on post-consume pool)
        → appliesBuffs loop (applyDeclaredBuff → apply_buff ops, 'suppressed')
        → dynamicBasic.onCastResolved → extra impacts (applyExtraImpact: own targeting + instances + resolveDeclaredHit)
   → resolveAllyActionWindow (Tro procs)
→ completeAction (TBS:3088): consumeGauge → enqueueFollowUpExecutions (:2533 — repeatCasts queue 'repeat' entries ONLY from committing sources; multicast rolls chance for 'multicast' at depth+1, cap min(maxExtraCasts, MAX_MULTICAST=3); requires affected.length>0) → staged gauge pushes → wave/win-loss/log
```

**Where ids mint:**
- `rootActionId` — minted per op-group at each emit site: `skill.ailments.<turn>.<actor>.<target>.<occ>` (:3242), `hit.consume...` (:2097), `skill.applybuff...` (:2276), `skill.detonate...` (:3289), `hit.proc...` (:2140), `status.round...`/`status.turn...` lifecycle roots. `opOrigin(sourceId, rootActionId, label)` stamps `kind:'skill'` (:617).
- `castId`/`subcastIndex` — **minted nowhere today** (contract fields awaiting this program). The closest existing carrier is `TurnSkillExecution{rootSkillId, resolvedSkill, source, theBurned, multicastDepth}` — the declared action's execution identity. `TurnQueuedExecution{actorId, rootSkill, source, multicastDepth}` is the follow-up descriptor; `dequeueFollowUpActor` drains `queuedExecutions` BEFORE `queuedFollowUps` (:794-818).

**commitAction anatomy** (`TurnSkillAction.ts:652`): `slot.remainingCooldownTurns = slot.skill.cooldownTurns` + `consumeResourceFor(entity, skill)` (RESOURCE_FIELD: mana→currentMp, the→currentThe). `commitCast` (`TBS:2599`) = commitAction + `onSkillCast` sink + `consumesAllThe` → `currentThe = 0`. `executionCommitsCast` (:428) = `execution===undefined || source!=='repeat' && source!=='multicast'`.

**Commit semantics preserved (R-S9 adapter contract):**
- Normal cast commits post-hit-loop, gated on `affected.length>0` (a whiffed-into-empty cast commits NOTHING — no cooldown, no resource, no cast-count).
- Charge-init commits at its own point (pre-hit, because affected=[]); charge-resolve never commits (already committed at init).
- Follow-up executions never recommit/repay.
- `grantTheFromCast` runs after commit → gain-after-consume ordering.
- `theBurned` captured at DECLARE before the burn.

**Cast-count sink:** `onSkillCast` (`TBS:2603`) → `GameManagerTurnBattleOps.onSkillCast` (:198, players[0] only) → `deps.recordPrimaryPlayerCast` → `SkillSystem.recordCast` (:381) → `totalExperience`++ + cast-leveled auto-level + `castCountSink` mirror.

## Step 5 — Trigger-path census (live vs dead)

| Symbol | Verdict | Evidence |
|---|---|---|
| `SkillTriggerRunner` / `SkillActionRegistry` / `SkillEffectSystem` / `SkillTriggerSystem` / `SkillEffectResolver` | **DEAD — do not exist** | zero hits across `src/` (only the names survive in comments, e.g. `CombatScene.ts` documents the retired resolver) |
| `TriggerBinding` / `SkillAction` types | **Live as authored data + converter input only** | `core/skill/SkillTrigger.ts:115`, `SkillAction.ts:126`; the ONLY live consumption is `resolveTriggerDamage` (converter :245) accepting exactly one `onCast`→`dealDamage` binding, else throw |
| `triggers:` in data | **3 skills, all the strict shape** | `CoreSkills.ts` — tram, linh_bao, huy_quyen (`onCast`→`dealDamage`) |
| Trigger vocabulary (`onHit/onCrit/onEvade/onKill/onDeath/onTick/onProc/onBreak/onResourceFull`) | **Dead vocabulary** | typed in SkillTrigger.ts:9-19, never consumed |
| SkillAction taxonomy (`heal/applyBuff/applyDebuff/grantResource/consumeResource/consumeForDamage/spawnZone/spawnVfx`) | **Dead vocabulary** | typed in SkillAction.ts; `grantResource` pool key resolves to `never`; `spawnZone` parked |
| Live reactive authority | `CombatProcSystem` + buff2 capability grants | `rollReactiveTrigger` (`TBS:1276`, `:2151`), `ReactiveTriggerName` = onCastBegin/onImpactLanded/onEvade/onAllyTargeted/onAllyActionComplete (`ProcCapabilities.ts`) — the real replacement for the retired trigger runtime |

## Step 6 — Authority matrix + ruling verification

| Ruling | Verdict | Evidence |
|---|---|---|
| R6 — three state layers (Definition / Progression / CombatRuntime) | CONFIRMED against reality | Persistent fields live on `Skill` (`level`,`experience`,`totalExperience`,`unlocked`,`equipped`,`loadoutSlot(s)`,`selectedSpecializationId`) owned by `SkillSystem`/`SkillManager` (save surface); battle-scoped fields live on `TurnSkillSlot.remainingCooldownTurns` + `actor.chargingTurnsRemaining`/`pendingChargedSkillId` (battle-scoped, not saved); authored immutable data is the `Skill` content surface. The split exists de facto — the program formalizes it. |
| R8 — turn units are the only combat-authoritative cadence | CONFIRMED | `cooldownTurns`/`chargeTurns`/`remainingCooldownTurns` are the only cadence the engine reads; `Skill.cooldown` (seconds) is copied as a NUMBER into cooldownTurns by the converter (:163) — the authored-second value is already used as a turn count. `Skill.execution`/`castTime` are real-time leftovers the turn engine never consumes (converter ignores them; `Skill.ts:15-29` comment). |
| R-S1 — subcasts as separate sequential plans | CONFIRMED map | repeat→N queued executions (`repeatCasts`, :2551), multicast→chance×depth-cap chain (:2559), composite→payload swap + extras lane (:1573, :1849). All drain via `queuedExecutions` FIFO ahead of `queuedFollowUps` — each is a separate declare→impact pass. |
| R-S2 — landed semantics | CONFIRMED map | `targetIds` collects only !dodged landed targets; self-scope pushes actor.id (:1982); whiffed (affected=[]) → no commit, no follow-ups (:2546); `targetIds.length>0` gates theGain + follow-up queue |
| R-S3 — reads via narrow readonly ports | CONFIRMED map | live reads today: `buffs.getForTarget` (:2091), `buffs.getCapabilities` (:1192,2995), `buffs.hasControl` (:1309), entity fields direct — the new `SkillBuffQuery`/`SkillVitalsQuery`/`SkillResourceQuery`/`SkillOpResultQuery` ports wrap these |
| R-S4 — reaction as producer metadata | CONFIRMED | `applyBuffOp` carries `reactionEligibility` ('eligible' for ailments :3255, 'suppressed' for buffs :2286, re-seeds :3375); capability gate owns firing |
| R-S5 — unsupported → `adapterUnsupportedMetadata` | CONFIRMED map | `collectUnsupportedSkillSemantics` (:73) is the direct ancestor — reports hitCountByRealm/hitCount/realmDamageRatio/skillExperienceRatio/spreads*/stacksPerAffectedTarget/scope/refresh/zone fields/breakDamagePerHit + non-`onCast` triggers + non-`dealDamage` actions |
| R-S6 — specialization resolved before cast | CONFIRMED | `getEffectiveSkill` applies `SkillSpecialization` overrides (full replace) BEFORE the converter — resolver receives the already-resolved definition (R-S6 parity) |
| R-S7 — passive schema, parallel runtime | CONFIRMED | PassiveSystem surface (§3d) is a separate live runtime; passive `Skill` defs never convert |
| R-S8 — declarative `instances.each` | CONFIRMED map | `NguKiemDaoProvider.perInstanceOptions` (:68-96) maps: guaranteedHit→`hitPolicy`; unlock-a execute→`each.execute{hpPercentBelow:ScalarExpression(min(0.5,0.1*realmIndex)), damageMultiplier:EXECUTE_MULT}` (branch folds coefficient); unlock-e→`critPolicy.bonusChance=CASCADE_CRIT_CHANCE`; unlock-d→`armorPolicy{bypassChance:CASCADE_PIERCE_CHANCE, pierceFractionOnFail:PIERCE_FRACTION}`; `count` = `ScalarExpression` reading `kiemDaoCount`; unlock gating = adapter-side conditional authoring (unlocks are persistent node state read at def-build, not a runtime condition). `onCastResolved→gainKiemY` is provider-level, not a def field — maps to the dynamicBasic adapter channel (progression write on cast resolve, NOT an operation). |
| R-S9 — cast-commit ownership | CONFIRMED map | `commitCast`(:2599) = `commitAction`(cooldown+resource) + cast sink + `consumesAllThe` zeroing. Normal casts commit post-hit-loop iff `affected.length>0`; charge-init commits at its own point; follow-ups never recommit (`executionCommitsCast`); `grantTheFromCast` post-commit ordering. The new `SkillCastCommitPort` owns: cooldown commit (→`SkillCombatRuntimeState.cooldownRemainingTurns`), cast-sink notification (→`SkillSystem.recordCast`), the consume-all-The zeroing (→`ConsumeResourceOperation{amount:'all'}`); resource cost → first `ConsumeResourceOperation` settled before plan steps. |

## Field classification table (M1 Step 2 input)

### `Skill` fields → layer

| Field | Layer |
|---|---|
| `id`,`name`,`description`,`type`,`cooldown`,`cost`,`resourceType`,`target`,`effects`,`triggers`,`targeting`,`laneRadius`,`columnRadius`,`requiredRealmId`,`requiredRealmLevel`,`maxLevel`,`specializations` | `SkillDefinition` (authored) |
| `level`,`experience`,`totalExperience`,`unlocked`,`equipped`,`loadoutSlot`,`loadoutSlots`,`selectedSpecializationId` | `SkillProgressionState` (persistent, save surface) |
| `passiveModifiers`,`passiveTrigger`,`passiveCondition`,`passiveConvertsTo` | `PassiveSkillDefinition` authored fields (PassiveSystem consumes — R-S7) |
| `execution` (attack_speed/cooldown/cast_time/attack_speed_cast/channel), `castTime` | **Authored real-time leftovers** — turn engine never reads; classify authored-presentation (UI reference) or drop at M5 (real-time BattleSystem is a non-goal) |
| `buildTag` ('core'/'dot'/'burst'/'ult'), `unreleased` | authored-presentation (UI grouping/badge) — `SkillDefinition` presentation-adjacent metadata, not gameplay |
| `vfxPresetId` | `SkillDefinition.presentation.presetId` |
| `breakDamagePerHit` | **adapterUnsupported** today (reported by converter); Thể Tu break-gauge semantic — real-time mechanic, `currentBreakGauge` not in the turn entity surface |

### `TurnSkillDefinition` fields → `SkillDefinition`/`AuthoredSkillOperation`

| Field | Target |
|---|---|
| `id`,`actionTags`,`emblemOnly`,`counterable`,`counterSkillId`,`presetId` | `ActiveSkillDefinition.id`/`actionTags`/`emblemOnly`/`counterable`/`counterSkillId`/`presentation.presetId` |
| `cooldownTurns`,`chargeTurns` | `cadence{cooldownTurns,chargeTurns}` |
| `resourceType`,`resourceCost` | `cost{resourceType,amount}` |
| `targetScope`,`targeting` | `targetIntent` + damage op target (`'self'`→`'self'`; `'enemy'`+`ActionTargeting`→`'primary_target'`/`'affected_targets'` per shape) |
| `damage` (`ActionDamageInfo` kind/multiplier/scaling/missingHp*) | `deal_damage` op (components/damageType/coefficient/scaling; `missingHpBonus*`→ authored scaling read) |
| `appliesBuff`/`appliesBuffs` | `apply_buff` ops (target scope map: self/target|action_targets/allies_except_self/all_enemies; stacks/duration/durationOverride/stacksPerAffectedTarget/externalWardGrant — `externalWardGrant` needs a decision: ward grant is a `TurnSkillBuffApplication` field, not an op — `apply_shield` or adapter-authored op) |
| `appliesAilment`/`appliesAilments` | `apply_buff` ops with `chance` + `reactionEligibility:'eligible'` |
| `consumesAilmentId`,`damagePerStack` | `deal_damage.consumeBuff{definitionId,damagePerStack}` (consume-for-damage lane :2086-2125 — read stacks → consume_buff_stacks 'all' → legacy_flat damage) |
| `consumesWardForDamage`,`damagePerWardPoint` | `deal_damage.consumeWard{damagePerWardPoint}` (:2127-2134) |
| `healPercentOfDamage` | `deal_damage.healPercentOfDamage` (leech on hpDamage — :2067) |
| `repeatCasts`,`multicast`,`compositePicks` | `subcasts{count,multicast,compositePool,compositeCount}` |
| `empowerment`,`consumesAllThe`,`theScaling` | `variants.empowerment{theThreshold,empoweredSkillId,consumesAllThe}` + `theScaling` |
| `detonateDoT` | `detonate{amp}` |
| `theGainOnLandedCast`,`theGainOnCrit` | `grants{theOnLandedCast,theOnCrit}` |
| `instances` | `instances{count:ScalarExpression, each{...}}` (per-instance → contract policies) |
| `grantsBuffsAtBuild` | **adapter/orchestrator note** — entry-apply lane (`applyEntryBuffs`), not a cast op; maps to participant-build channel, not `SkillDefinition` |
| `specialAttackCounter`/`specialAttacks` (entity) | enemy scripted specials — entity-level field, not a def field; stays in the turn engine lane (adapter note) |

### `SkillEffect` fields → operations or unsupported

| Field(s) | Target |
|---|---|
| `type:'damage'` + `value`,`damageType`,`components`,`attributeScaling`,`manaScalingRatio`,`hitCount`,`hitCountByRealm`,`realmDamageRatio`,`skillExperienceRatio`,`healPercentOfDamage`,`consumesAilmentId`,`damagePerStack`,`consumesWardForDamage`,`damagePerWardPoint` | `deal_damage` — NOTE `hitCountByRealm`/`realmDamageRatio`/`skillExperienceRatio` are UNSUPPORTED today (converter reports); adapter decision: map to `scaling`/instances or keep unsupported (M4 coverage decision — `skillExperienceRatio` and `realmDamageRatio` have no current turn semantic; `hitCountByRealm` ≅ `instances.count` by realmIndex) |
| `type:'heal'` + `value` | `heal` op — NOTE: converter THROWS on 'heal' today (:117); the new adapter adds coverage |
| `type:'buff'`/`'debuff'`/`'add_stack'` + `buffId`,`stacks`,`duration`,`ailmentChance`,`stacksPerAffectedTarget` | `apply_buff`/`add_buff_stacks` ops |
| `type:'remove_buff'` + `buffId`/`polarity`/`count`/`refresh` | `buffId` → `remove_buff` selector op; `polarity` → `cleanse{query:{polarity}, limit:count ?? 1}` (BLOCKER-2 parity); `refresh` → unsupported-or-extend (no authored consumer today — check census) |
| `scope` | UNSUPPORTED today (reported); maps to `SkillTargetIntent` where possible |
| `spreadsAilmentId`,`spreadStackPercent`,`spreadRefreshesPrimary` | **UNSUPPORTED today** (reported). Vân Mộc Lan Độc semantic: post-hit read primary's stacks → apply ceil(total×pct) stacks to affected-minus-primary. Expressible as read_stacks + for_each_target apply_buff with `primary_target` exclusion — needs a `SkillTargetIntent` covering "affected minus primary" or a spread op; M4 coverage decision. |
| `grantsZone`,`zoneElement`,`swordZone*` | parked zone channel — `adapterUnsupportedMetadata` |
| `damageType`/`components` | `deal_damage.damageType`/`components` |
| `ailmentChance` | `apply_buff.chance` |

### Trigger/SkillAction surface → operations

| Shape | Target |
|---|---|
| `onCast`→`dealDamage{value,damageType,components,attributeScaling,manaScalingRatio}` | `deal_damage` op (the ONLY live shape — tram/linh_bao/huy_quyen) |
| `dealDamage` extras (`realmDamageRatio`,`skillExperienceRatio`,`hitCountByRealm`,`knockbackDistance`) | reported unsupported today → same decision as the SkillEffect row |
| every other trigger × action | dead vocabulary — no authored consumers; no adapter needed (delete at M5 if `Skill.triggers`/`TriggerBinding`/`SkillAction` types retire) |

## Findings the plan should absorb (M1–M4 notes, not scope changes)

1. **`valueSource:'cast_snapshot'` already exists** on `ConsumeResourceOperation` — the spec §26 freeze has its carrier; `theBurned` flows as a `CastSnapshot` scalar feeding `theScaling` coefficient (authored intent), while the spend op is `amount:'all'`.
2. **'heal' and 'remove_buff' throw in the current converter** — the new adapter EXTENDS coverage; the M4 census must classify every currently-throwing effect type as (a) newly supported, or (b) `adapterUnsupportedMetadata`.
3. **`affected.length===0` → no commit** is a real gameplay semantic — R-S9's CAST_COMMIT must preserve it (a cast that never resolves a target set never commits; a cast that resolves targets but whiffs all hits DOES commit — verify in M3 test: "whiffed all-miss → commit + landed:false").
4. **`spreadsAilmentId` needs a target intent or op decision** — "affected targets minus primary" has no `SkillTargetIntent` member today.
5. **`externalWardGrant`** (`TurnSkillBuffApplication`) — ward pool grant on buff application; `apply_shield` is the closest op but semantics differ (source-tagged existence-bound pool, REPLACE not stack) → adapter decision or authored-op extension.
6. **`KiemPhoCombo`/`dynamicBasic.onCastResolved`/`reactivePayloads`/`reactive_proc`/`the_economy`** are provider/buff-capability lanes, NOT cast-skill semantics — they stay out of `SkillDefinition`; the adapter boundary note must say so explicitly.
7. **`grantResource` SkillAction pool key = `never`** — dead type, no adapter needed.
8. **`specialAttacks`/`specialAttackCounter`** live on the entity, not the def — enemy scripted specials stay in the turn-engine lane.
9. **Pre-existing baseline failure:** asciiComments (Step 1) — user's buff M5 merge drift; flagged for user decision.

## Exit criteria check

- [x] Every authored-skill producer mapped (§3a/3b) — each file classified Legacy→converter / native TurnSkillDefinition / passive / display / provider-table.
- [x] Every `TurnSkillDefinition` field mapped (field table) or explicit adapter note (grantsBuffsAtBuild, specialAttacks).
- [x] Every `SkillEffect`/trigger surface classified (field table).
- [x] Live-vs-dead trigger path confirmed (Step 5 — no runner classes exist; converter's strict lane is the only live consumer).
- [x] Prerequisites verified (Step 2 — all PASS).
