# THỂ TU ẨN — ỨNG THẾ beta spec (spec -> plan -> implement)

Design authority: `game/docs/design/the-tu-an-ung-the-design.txt` (branch
`devin/1790308404-the-tu-beta`). Window: Luyện Khí -> Trúc Cơ
(`foundation_establishment` ceiling). Contract: the 60 invariants in
Part XX — each mapped to code or reported unimplementable.

Thesis: "Quan sát sinh Thế. Ứng biến tiêu Thế." Strength comes from
breaking action economy (borrowed turns), never from stats.

---

## 1. AUDIT — classification of every hidden_body_pathway surface

Legend: ALIGNS (already correct) / CONFLICTS (works but wrong semantics — must
change) / LEGACY-SUPERSEDED (design retires) / REUSABLE (keep as-is, reused by
new spec) / MISSING (nothing exists).

### Kit + defs (`src/data/skill/TheTuSkills.ts`)

| Surface | Classification | Note |
|---|---|---|
| `THAM_THE` (phys single-target basic, levelScaling) | ALIGNS | damage pipeline + `progressionOwnerId` authority unchanged |
| `TU_THE` (special, procCostFlatDelta buff) | LEGACY-SUPERSEDED | parked def; removed from kit + way.coreSkillIds (like parked `bat_tu_ba_the`) |
| `BACH_UNG` (ultimate, freeProcs + choang rider) | LEGACY-SUPERSEDED | parked future content; removed from kit + way.coreSkillIds |
| `PHAN_KICH` / `TRONG_PHAN_KICH` / `TRO_KICH` payload defs | REUSABLE | progressionOwnerId `tham_the` already correct; gain Phản Kình armor-pierce rider at build |
| `buildTheTuAnKit(ownedRoots, mods)` | CONFLICTS | rebuild signature: `(mods, {quanTheOwned, quanTheCoreLevel})` — no roots |
| `TheTuAnKit {basic, special, ultimate, reactivePayloads, maxThe}` | REUSABLE | special/ultimate become optional (special only while `core_quan_the` owned) |
| `TheTuAnRootId` ('ho_mon'/'phan_mon'/'tro_mon') | LEGACY-SUPERSEDED | roots deleted — Phản baseline, Hộ/Trợ ride Quan Thế |
| `QUAN_THE` skill def | MISSING | new: self-cast special, `theGainOnLandedCast` baked from Core Level, `appliesBuffs` self `quan_the` marker |
| `UNRANKED_INTERNAL_ACTIONS` (payload membership) | ALIGNS | payloads stay non-levelled internals |

### Markers + buffs (`src/data/buff/TheTuBuffs.ts`)

| Surface | Classification | Note |
|---|---|---|
| `makeHiddenMarker` + `ung_the` marker | CONFLICTS | the_economy payload: keep `gainOnBasicHit` (Thám Thế landed); replace evade/taken/round with `gainOnObservedAction` (+ Thấu Thế bonus baked on clone) |
| `HO_MON_MARKER` (onAllyTargeted/intercept) | REUSABLE | planted only when `core_quan_the` owned; ward rider keeps `grantsWardToOriginalTarget` |
| `PHAN_MON_MARKER` (onImpactLanded + onEvade -> phan_kich) | REUSABLE | planted unconditionally for ung_the (Phản is baseline); onEvade payloadId swapped to trong_phan_kich by Trọng Phản at build |
| `TRO_MON_MARKER` (onAllyActionComplete/follow_up) | REUSABLE | planted only when `core_quan_the` owned |
| `TU_THE_BUFF`, `BACH_UNG_BUFF` | LEGACY-SUPERSEDED | parked with their skill defs (never planted in beta) |
| `HO_VE_BUFF` + `grantsExternalWard` + reconcileExternalWard | REUSABLE | Hộ Bích ward channel, existence-bound to protector-sourced marker |
| `QUAN_THE_BUFF` | MISSING | new hidden marker, per_source, FIXED_TURNS(4 holder turns), dispellable:false — presence IS `quanTheActive` |
| `DAN_THE_BUFF` | MISSING | new marker on the ENEMY (per_target, latest, hidden) — one-shot boost consumed at observation income |

### Economy (`src/core/the-tu/TheEconomy.ts`, `TheTuCapabilities.ts`)

| Surface | Classification | Note |
|---|---|---|
| `theCap` / `grantThe` / `isUngTheCombatant` | REUSABLE | centralized mutation/cap unchanged |
| `THE_PROC_COST=15` | REUSABLE | flat authored `theCost` fallback stays |
| `resolveProcCost`/`tryPayProcCost`/`onProcSuccess` (pay-before-roll + refund) | LEGACY-SUPERSEDED | success-only consume inside the roll lane |
| `THE_GAIN_ON_EVADE`/`ON_HIT_TAKEN`/`PER_ROUND` + `theGainOn*` readers | LEGACY-SUPERSEDED | income channels retired |
| `the_economy` payload {gainOnBasicHit, gainOnEvade, gainOnHitTaken, gainPerRound} | CONFLICTS | becomes {gainOnBasicHit, gainOnObservedAction}; validator updated |
| `reactive_economy` payload + validators | LEGACY-SUPERSEDED | type stays registered (parked defs still validate); consumers retired |
| `theGainOnSuccess` proc field + gain-on-success settle | LEGACY-SUPERSEDED | no reactive refund (INV-9) |
| Ứng Trệ / Quá Thế state | MISSING | participant fields `reactionDebt` (+ `QUA_THE_CAP`), gauge subtraction per committed reaction, reset on natural action |
| `isObserved` / observation income / Thám focus | MISSING | `participant.thamTargetId` + quan_the marker presence |
| Dẫn Thế consume | MISSING | `dan_the` marker on enemy consumed by first observed-action income (remove_buff op) |

### Proc system (`src/core/proc/CombatProcSystem.ts`, `ProcCapabilities.ts`)

| Surface | Classification | Note |
|---|---|---|
| `resolveReactiveProcs` seam | CONFLICTS | reorder to fail-fast: gate (supplied by caller) -> roll -> pay-on-success -> commit. Retire resolveProcCost freeProcs/delta, theGainOnSuccess, healsTriggeringAllyMaxHpRatio; keep queuedAction + grantsWardToOriginalTarget |
| `ReactiveProcPayload` fields | CONFLICTS | drop `theGainOnSuccess`, `healsTriggeringAllyMaxHpRatio`, `firesOnNonDamagingAction`; keep theCost, queuedAction, grantsWardToOriginalTarget; validator updated |
| `onHitLanded` on_hit_proc lane | REUSABLE | untouched (generic engine proc channel) |
| `rollReactiveTrigger` + pendingReflects/flushReflects (Phan Chan) | REUSABLE | normal-path reflect keeps hpDamage>0 semantics — untouched |
| hard-CC / Quá Thế / observed gates | MISSING | fail-fast gates live at the TBS window layer (no RNG consumed) |

### Battle engine (`src/core/battle/turn/TurnBattleSystem.ts`, `TurnSkillAction.ts`)

| Surface | Classification | Note |
|---|---|---|
| `reactive_bypass` queue + `declareReactiveBypass` + `QueuedFollowUp`/`actionSource`/`triggerContext` | REUSABLE | payload resolution unchanged (dead actor -> alive-filtered targetIds -> no resolve, no refund — INV-50 already structural) |
| `followUpChainDepth` cap in `dequeueFollowUpActor` | REUSABLE | chain-depth safety net stays (design 79) |
| `resolveInterceptWindow` (pre-impact, authored-'single' + affected.length===1, nearest Chebyshev, once:true, substitution + ward grant) | CONFLICTS | add gates: attacker observed by candidate + candidate not hard-CC'd + not Quá Thế; substitution + ward-on-commit kept |
| `resolveEvadeWindow`/`resolveTakenWindow` per-hit Phản rolls | LEGACY-SUPERSEDED | replaced by ONE post-action `resolvePhanWindow` per affected ung_the defender (multi-hit/AoE = one window; outcome aggregated per target) |
| `resolveAllyActionWindow` (per-ally onAllyActionComplete roll) | CONFLICTS | gate canonical target on observed; fire only on authored-damaging actions; triggeringTargets := canonical observed target; drop nonDamaging fan-out + heal |
| `grantHitOutcomeIncome` hook (dodged/taken income) | LEGACY-SUPERSEDED | repurposed into `recordHitOutcome` — per-target outcome aggregation feeding the post-action Phản window (fires in BOTH plan and legacy lanes) |
| `grantBasicLandedIncome` (actor basic landed -> the) | CONFLICTS | keeps `gainOnBasicHit` channel (Thám Thế landed income); round income block at actedThisRound boundary retires |
| `turn end` holder lifecycle / `bat_tu_ba_the` suppress / `hasControl('stun'|'freeze')` | REUSABLE | hard-CC gate reuses the same predicate at the window layer |
| `TurnBattleParticipant` fields (actionGauge, dynamicBasic, consecutiveHardCcTurns…) | CONFLICTS | add `thamTargetId`, `reactionDebt` (battle-scoped; quaThe derived) |
| `ActionGauge` consume/refund | REUSABLE | debt applies `actionGauge -= UNG_TRE_GAUGE_PENALTY` (may go negative — delays the next natural turn) |
| Thám mark set seam | MISSING | in applyActionImpact: `skillId === 'tham_the'` && enemy target -> `actor.thamTargetId`, before hits (mark survives miss) |
| observation income seam | MISSING | post-Phản-window `grantObservationIncome` — income lands after that action's own windows close (INV-10) |

### Path / progression (`src/core/the-tu/TheTuPath.ts`, `CultivationPathRegistry.ts`, `SkillCoreNodes.ts`, `TheTuAnNodes.ts`, `TheTuAnMechanicModifiers.ts`)

| Surface | Classification | Note |
|---|---|---|
| `HIDDEN_BODY_PATHWAY` def (offerGate huy_quyen Lv3, `body.essence_economy` static cap) | CONFLICTS | `coreSkillIds` -> `[tham_the]`; ownedContent drops tu_the/bach_ung grants (parked defs stay authored) |
| `resolveHiddenBodyKit` / `createHiddenBodyPathwayRuntime` | CONFLICTS | kit inputs become `{mods, quanTheOwned, quanTheCoreLevel}` |
| `hiddenBodyReactiveModifiers` (chance triangle) | ALIGNS | Hộ=Thể+Mẫn, Phản=Lực+Mẫn, Trợ=Mẫn+Thần already correct |
| `major_quan_the` keystone + `grantsSkillCoreIds` seam | MISSING (pattern proven) | mirror `major_loan_dau`/`major_phan_chan`: realm foundation_establishment + `techniqueRank 5` prereq + grants `core_quan_the` |
| `NATIVE_CORE_SKILL_IDS` | CONFLICTS | +`quan_the` (maxLevel 10 — the design authors its progression channel); keep `tu_the`/`bach_ung` cores parked-registered |
| `TheTuAnNodes.ts` 26-node tree (stat trunk, economy fillers, LQ roots) | LEGACY-SUPERSEDED | rewrite to 6 nodes: `minor_thau_the`, `minor_phan_kinh`, `major_quan_the`, `major_ho_bi`, `major_trong_phan`, `major_dan_the` |
| `HiddenBodyMechanicModifierValues` 14 channels | CONFLICTS | -> 4 channels: `observationGainBonus`, `phanKinhArmorPierce`, `interceptWardRatio`, `evadeCounterMultiplierBonus` (+`danTheBonus` flag for the Dẫn Thế marker rider) |
| `grantSkillCoreBySkillId` at ritual + node `grantsSkillCoreIds` | REUSABLE | quan_the core granted by `major_quan_the` |

### Save / validation (`src/services/save/saveShapeValidation.ts`, `saveVersion.ts`)

| Surface | Classification | Note |
|---|---|---|
| `CURRENT_SAVE_VERSION = 85` | CONFLICTS | bump to 86 — way.coreSkillIds shrink (core_tu_the/core_bach_ung would orphan) + retired node ids in nodeLevels |
| `validateSkillCoreCoverage` | REUSABLE | works: way core grant + node grant + learned-skill coverage all enforced |
| `LEVELLED_SKILL_IDS` coverage check | REUSABLE | unchanged — natives aren't learned skills |

### UI / presentation

| Surface | Classification | Note |
|---|---|---|
| `SkillPathPanel` / `NodeTreePanel` 'the_tu_an' branchTag rendering | REUSABLE | data-driven; topology change is content |
| `theBarBridge` `THE_BAR_READER_KEY` | CONFLICTS | gate `spell.essence_pool` -> accept `body.essence_economy`; snapshot gains `thamTargetId`/`quanTheActive`/`reactionDebt`/`quaThe` for HUD feedback |
| `PlayerHudLayer.updateThe(current,max,threshold,armed)` | CONFLICTS | extended signature draws Thế + Ứng Trệ/Quá Thế state for the hidden bar |
| enemy-sprite Thám outline / Quan Thế battlefield visual (design §92) | MISSING (partial) | beta: bar snapshot exposes the state; sprite-side visual noted as stretch, not blocking invariants |
| `TurnSkillDisplayMeta` | CONFLICTS | +`quan_the` entry; tu_the/bach_ung entries stay (parked defs keep meta) |
| auto combat (selectAction ultimate->special->basic) | REUSABLE | Quan Thế auto-cast = special-slot readiness; reactions already forced/automatic |

---

## 2. SPEC (beta semantics -> code seams)

### Tunables (first-pass, design says "deferred")

| Constant | Value | Site |
|---|---|---|
| `THE_PROC_COST` | 15 | TheEconomy (existing) |
| `THE_GAIN_ON_BASIC_HIT` (Thám Thế landed) | 4 | UNG_THE_BUFF `gainOnBasicHit` (existing) |
| `THE_GAIN_ON_OBSERVED_ACTION` | 4 | UNG_THE_BUFF `gainOnObservedAction` |
| `THAU_THE_OBSERVATION_BONUS` | +2/level | `minor_thau_the` -> `observationGainBonus`, baked on marker clone |
| `PHAN_KINH_ARMOR_PIERCE` | 0.15/level pierce fraction | `minor_phan_kinh` -> `phanKinhArmorPierce`, baked as `instances.each.armorPierce{bypassChance:1,pierceFraction}` on phan_kich/trong_phan_kich clones |
| `QUAN_THE_THE_GRANT` | 25 | `theGainOnLandedCast` baked: `25 + 10*(coreLevel-1)` |
| `QUAN_THE_GAIN_PER_LEVEL` | 10 | same bake site |
| `QUAN_THE_TURNS` | 4 holder turns | QUAN_THE_BUFF FIXED_TURNS; cooldownTurns 6 |
| `REACTION_DEBT_CAP` (Quá Thế) | 3 | TheEconomy/TBS const |
| `UNG_TRE_GAUGE_PENALTY` | 400 actionGauge per debt | applied at commit; next natural turn consumes to 0 as usual |
| `HO_BICH_WARD_RATIO` | 0.15 source MaxHP | `major_ho_bi` -> `interceptWardRatio` (existing channel) |
| `TRONG_PHAN_DAMAGE_MULT` | 1.6x via `evadeCounterMultiplierBonus: 0.6` baked onto trong_phan_kich's `damage.coefficient` (existing bake site) | `major_trong_phan` |
| `DAN_THE_INCOME_MULT` | x3 observed-action income | `major_dan_the` -> `danTheBonus` presence gate |

### Runtime model

```
participant (ung_the, participant-local fields):
  thamTargetId?: string      // Thám Ấn focus, set by Thám Thế cast (pre-hit), lazy-dead-read
  reactionDebt?: number      // +1 per committed Hộ/Phản/Trợ; >= REACTION_DEBT_CAP => Quá Thế
entity: currentThe/maxThe    // battle-scoped (unchanged)
buffs:  quan_the marker on holder = quanTheActive
        dan_the marker on enemy  = Dẫn Thế instance (one-shot)

isObservedBy(holder, enemy) =
  (holder.thamTargetId === enemy.id && enemy.entity.alive)
  || holder carries live 'quan_the' instance

isReactiveBlocked(holder) =
  buffs.hasControl(holder,'stun') || hasControl(holder,'freeze')
  || (holder.reactionDebt ?? 0) >= REACTION_DEBT_CAP
```

### Action pipeline order (applyActionImpact, per source action)

```
declare -> (charge lanes) -> resolveInterceptWindow (Hộ)
  gates: enemy actor, natural source, authored 'single', affected==1,
         original alive player; candidate observes actor, alive,
         not hard-CC, not Quá Thế, carries intercept proc -> nearest -> roll
  success: pay Thế (inside proc), +1 debt, affected=[protector],
           intercepted/By, chargeTargetIds mirror, Hộ Bích ward grant
-> hits resolve (plan OR engine lane; recordHitOutcome per target per hit)
-> flushReflects (Phan Chan, untouched)
-> resolvePhanWindow (new): for each affected player-side ung_the holder
   observing the enemy actor, alive, not blocked:
     outcome = any landed hit on holder ? 'taken' : 'evaded' (or 'taken'
               when the action carried no hit rolls at all)
     trigger = 'onEvade' | 'onImpactLanded' -> ONE roll -> pay on
     success -> +1 debt -> queue payload (phan_kich | trong_phan_kich)
-> resolveAllyActionWindow (Trợ): player actor, natural, authoredDamaging;
   canonical target = first observed enemy in landed?? affected (alive);
   for each OTHER alive ung_the player observing it: roll -> pay -> +1
   debt -> queue tro_kich at canonical target
-> grantObservationIncome (new): enemy actor, natural action, alive;
   every ung_the player observing it gains gainOnObservedAction
   (+Thấu Thế bake); actor's dan_the instance -> x3 then remove_buff.
   POSITION LOCKED LAST — income can never fund this action's own windows.
-> completeAction: on a NATURAL actionSource, actor.reactionDebt = 0
   (Quá Thế clears — Ứng Trệ "paid" by the delayed action)
```

### Proc lane (CombatProcSystem.resolveReactiveProcs) new order

```
for each matching reactive_proc grant (once => first only):
  if holder dead -> whole call no-op (existing guard)
  cost = proc.theCost ?? THE_PROC_COST            // flat, no economy mods
  if (currentThe ?? 0) < cost -> skip (no RNG)    // pay gate = read only
  roll clampStatValue(holder.stats[chanceStat])
  success -> settleOp(consume_resource cost)      // pay AFTER roll
             + queuedAction follow-up descriptor
             + grantsWardToOriginalTarget descriptor (Hộ Bích)
  caller (TBS) adds +1 reactionDebt + gauge penalty per success
```

Hard-CC / Quá Thế / isObserved gates sit in the TBS window callers
(pre-roll), keeping "invalid window consumes no RNG" (INV-48).

### Kit + grant

- `way.coreSkillIds = [tham_the]` — ritual grants only Thám Thế core.
- `resolveHiddenBodyKit`: `getSkillCoreLevel(player,'quan_the') > 0` =>
  `special` = QUAN_THE clone (theGainOnLandedCast baked by core level),
  marker set gains HO_MON + TRO_MON, reactivePayloads gain tro_kich.
- `major_quan_the` (realm foundation_establishment + techniqueRank 5)
  `grantsSkillCoreIds: ['quan_the']` — sibling keystone convention.
- Markers plant on `basic.grantsBuffsAtBuild` (participant-local clones —
  the existing emblem-buff channel).

### Tree (`TheTuAnNodes.ts`, all `requiredCultivationPath:'body'` + `requiredWay:'hidden_body_pathway'` + `branchTag:'the_tu_an'`)

| id | name | realm | maxLevel | effect | prereq |
|---|---|---|---|---|---|
| `minor_thau_the` | Thấu Thế | qi_refining | 3 | `observationGainBonus:+2/lv` | realm |
| `minor_phan_kinh` | Phản Kình | qi_refining | 3 | `phanKinhArmorPierce:+0.15/lv` | realm |
| `major_quan_the` | Quan Thế | foundation_establishment | 1 | `grantsSkillCoreIds:['quan_the']` | realm + techniqueRank 5 |
| `major_ho_bi` | Hộ Bích | foundation_establishment | 1 | `interceptWardRatio:0.15` | major_quan_the |
| `major_trong_phan` | Trọng Phản | foundation_establishment | 1 | `evadeCounterMultiplierBonus:0.6` | major_quan_the |
| `major_dan_the` | Dẫn Thế | foundation_establishment | 1 | `danTheBonus` | major_quan_the |

(Trọng Phân = evade payload swap already a build-time channel; Dẫn Thế =
tro_kich clone gains `appliesAilments:[{dan_the, chance 1}]` — landed-only
application.)

### Save

`CURRENT_SAVE_VERSION` 85 -> 86: hidden-path saves carry retired
`core_tu_the`/`core_bach_ung`/node ids that the coverage validator would
reject as orphans — dev-phase rejection is the project's convention (no
migration).

### UI

- `theBarBridge`: `hasStaticPathCapability` accepts `'body.essence_economy'`
  (hidden body) — bar shows `current/max` with threshold 0 (no
  empowerment). Snapshot extended: `thamTargetId`, `quanTheActive`,
  `reactionDebt`, `quaThe`; `PlayerHudLayer.updateThe` signature extended
  to render the debt/Quá Thế/observation state on the hidden-path bar.
- NodeTreePanel already renders `the_tu_an` — new topology is data-only.
- `TURN_SKILL_DISPLAY_META['quan_the']` added; parked tu_the/bach_ung metas
  stay.
- Sprite-level Thám outline / Quan Thế battlefield visuals: bar-snapshot
  fields land the state; cosmetic sprite work deferred (no invariant).

### Auto combat

`selectAction` already auto-casts a ready special — Quan Thế rides it
(INV/design 99 accepted risk). Reactions are forced inside the proc lane
(no decline path). No new auto machinery.

---

## 3. PLAN (execution order)

1. `TheEconomy.ts`: retire taken/evade/round readers + proc-cost helpers;
   add `REACTION_DEBT_CAP`, `UNG_TRE_GAUGE_PENALTY`, observed-action gain
   reader.
2. `TheTuCapabilities.ts`: `the_economy` payload -> {gainOnBasicHit,
   gainOnObservedAction}; keep `reactive_economy` type (parked defs).
3. `ProcCapabilities.ts`: drop theGainOnSuccess/heals/firesOnNonDamaging.
4. `CombatProcSystem.ts`: pay-on-success reorder; drop the dead lanes.
5. `TheTuBuffs.ts`: UNG_THE economy payload; +QUAN_THE_BUFF, +DAN_THE_BUFF;
   HO_MON ward rider unchanged; (TU/BACH parked — keep defs, unplanted).
6. `TheTuSkills.ts`: +QUAN_THE def; `buildTheTuAnKit` signature rework;
   Phản Kình armor-pierce bake; Dẫn Thế ailment rider on tro_kich clone.
7. `TurnSkillAction.ts`/`TurnBattleSystem.ts`: participant fields +
   mark seam + recordHitOutcome + resolvePhanWindow + gated
   resolveInterceptWindow + gated resolveAllyActionWindow +
   grantObservationIncome + debt/gauge/reset; orchestration hook renames
   (`grantHitOutcomeIncome`->`recordHitOutcome`, retire taken/evade window
   calls into the pipeline's noop lane — keep the interface minimal).
8. `TurnSkillPlanRuntime.ts`: orchestration hook rename + drop
   resolveTakenWindow/resolveEvadeWindow calls (hits still record outcomes).
9. `TheTuAnNodes.ts` rewrite; `TheTuAnMechanicModifiers.ts` 4 channels.
10. `TheTuPath.ts` coreSkillIds/ownedContent; `SkillCoreNodes.ts`
    +quan_the; `CultivationPathRegistry.ts` kit inputs.
11. `saveVersion.ts` bump 86.
12. `theBarBridge.ts` + `PlayerHudLayer` + `TurnSkillDisplayMeta`.
13. Tests: pin invariants (see below) + update the stale hidden-path test
    files to the new contract.
14. Verify: `npm run type-check` + `npx vitest run` scoped +
    `npx eslint` changed files. Then P4/P5 gates.

### Invariant test pins

- observation income ordering: enemy action can never fund its own Phản
  (grant AFTER window; pool check inside window reads pre-income balance)
- Thám mark on miss (dodge run -> thamTargetId set, income observed next
  enemy turn)
- one Thám target: recast transfers; target death -> no observation until
  recast (no auto-transfer)
- forced success + pay-on-success (roll success -> cost paid; no RNG on
  Quá Thế / hard-CC / insufficient Thế)
- Ứng Trệ: each commit delays next natural action; cap -> Quá Thế (no
  windows, income still flows); next natural action resets debt
- once-per-channel-per-action (multi-hit -> single window)
- Hộ substitution resolves fully on protector incl. lethal; Hộ Bích ward
  on rescued ally survives protector death
- Trợ queues at canonical target only on authored-damaging actions into
  observed enemy; Dẫn Thế consumed once
- dead actor -> queued payload drops (no refund)
- save round-trip: version bump + hidden-path state validates

---

## 4. Explicitly deferred / out of beta

- `Bách Ứng` (parked ultimate content) — defs + cores stay authored but
  ungranted; `reactive_economy` capability type stays registered.
- `Tú Thế` — superseded; parked def.
- Sprite/VFX layer for Thám outline / Quan Thế battlefield / Hộ dash /
  Trọng Phản presentation (design Part XV cosmetic layer; the state is
  exposed on the HUD snapshot).
- "Reactive Web" bespoke tree layout — the existing branchTag panel
  renders the new topology; a dedicated web layout is cosmetic.
- Reaction-debt tree relief ("no node reduces Ứng Trệ in beta" — by
  design, high-realm future).
