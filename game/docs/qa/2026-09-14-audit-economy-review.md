# Economy, progression and player-stat audit — 2026-09-14

## Scope and result

Read-only review at HEAD f2846064a4b15d4d20a94540855b6194b77eb21c, worktree E:/tutienidle/.agent-worktrees/full-project-audit-2026-09-14, branch codex/full-project-audit-2026-09-14.

Task card: [full-project audit task card](2026-09-14-full-project-audit-task-card.md). Reviewed AGENTS.md, AstraDoctrine.md, architecture-worker-workflow.md, the R2/R7/R8/R9 roadmap contracts and current QA reports. Documentation describes intent; the findings below come from current source and the explicitly listed diagnostics.

**Review verdict: Request changes.** Three bounded defects were executed against current production modules; one additional consumer defect is established from source. This audit made no production fixes, test changes, configuration changes or commits. Severity describes player impact, not exploitability against a server.

| ID | Priority | Confidence | Evidence | Finding |
|---|---|---:|---|---|
| AUD-E01 | P1 | 99% | EXECUTED + SOURCE | Offline workers grant a completed cycle before any worker completes, while retaining the original pending cycles. |
| AUD-E02 | P2 | 99% | EXECUTED + SOURCE | A paid wash ticket accepts a different same-ID item and ignores changed lock/favorite eligibility. |
| AUD-E03 | P2 | 99% | EXECUTED + SOURCE + SPEC DRIFT | Current Hoi Xuan pill content is craftable and consumable but its only authored benefit is deliberately discarded. |
| AUD-E04 | P2 | 98% | SOURCE | Production/alchemy notification consumers discard delivery receipts and report rewards that overflowed. |

The coordinator owns the full build/test run and app/browser verification. The aggregate audit is not certified by this worker's results. Combat passive refresh, effective combat stats and regeneration consumption are owned by the combat reviewer. Save identity, additive restore and snapshot detachment are owned by the lifecycle reviewer.

## Authority and state map

### Canonical player stats

| Stage / state | Current owner and readers | Observations |
|---|---|---|
| Raw attributes and baseline | Player.ts:createDefaultPlayer -> createBaseStats; PlayerData.baseStats | BaseStats now has a nominal brand. The baseline speed is 100. PlayerStatAssembly is a test file, not a production assembly class. |
| Attribute investment | GameManagerProgressionOps.ts:294-307 allocateAttributePoint | Checks remaining points and realm cap, then writes the raw stat and point balance. UI calls the operation. |
| Permanent body-refinement modifiers | BodyRefinementSystem:investTinhHoa -> applyTierModifiers; GameManagerRealmAdvanceOps:investBodyRefinement | The domain rebuilds its own modifier IDs rather than reverse-subtracting earlier values; the operation removes the exact consumed essence. GameManagerTickOps drives this independently of the panel. |
| Realm stat grants | RealmPassiveSystem:grantRealmPassive; RealmPassives data | grantedRealmPassiveIds prevents duplicate grants. Nhap Dao reads locked breakthroughGrade; Kien Co reads highestFoundationAchieved. Distinct from technique-granted passive skills. |
| Static equipment stats | EquipmentSystem:applyModifiers, refreshModifiers; EquipmentSlotManager owns enhancement | Main stat and affixes share calculateEquipmentScale. Slot enhancement survives item exchange. useEquipmentActions copies the current equipment modifier bucket into the player store after success. Restore performs an explicit refresh. |
| Technique / path / node / persistent buffs | GameManagerPersistentEffectOps:getAggregatedModifiers | Aggregates scaled passive skills, equipped-technique tier and combat modifiers, path modifiers, node levels and persistent BuffSystem modifiers. App.vue:486 refreshes player.externalModifiers. Runtime timed/socket modifiers deliberately use a separate provider. |
| Final menu/start snapshot | stores/player.ts:131-150 finalStats -> StatCalculator:calculateStats | One two-pass attribute derivation implementation. Kiem Y modifiers are added here for the matching route. Player.ts:432 playerToCombatEntity consumes already-resolved Stats. |
| Effective battle stats | StatCalculator:calculateEffectiveStats -> TurnStatsRecompute | Resolved-to-effective calculation avoids a second attribute derivation. Whether all live modifiers reach this path is a separate confirmed combat-review finding; do not infer it from the presence of this helper. |
| Persistence | SaveSystem player slice and GameManagerSaveRestore registry/manager slices | Player modifiers and externalModifiers are saved; equipment modifiers are rebuilt. Snapshot/replacement defects are covered by the lifecycle reviewer. |

The stat primitive boundaries are materially better than re-running attribute derivation on a resolved snapshot. The remaining risk is consumer refresh and runtime wiring, not a need for another arithmetic helper. Menu/start-snapshot assembly is still hosted in Pinia plus the App refresh loop; this audit did not certify a fully headless final-stat assembly entry point.

### Equipment operations

| Responsibility | Owner / actual caller | Validation and lifecycle observed |
|---|---|---|
| Creation | EquipmentOpsSystem:obtainEquipment and battle drop path -> EquipmentSystem.createInstance -> EquipmentRolling | Real template/slot policy, quality, grade, main range and affix pools are shared. Authored IDs are registered rather than inferred from filenames. |
| Membership / equipped index | EquipmentBag | ID dedupe, slot index and exact-object membership generations exist. Exposes live instances; this is why generated operations must bind identity rather than trust a string ID. |
| Equip / unequip | useEquipmentActions -> EquipmentOpsSystem -> EquipmentSystem:239-290 | Domain equipment mutation; UI follows with equipment modifier synchronization. Slot state is separate from item state. |
| Enhancement | EquipmentOpsSystem syncs discount/talent policy -> EquipmentSystem:480-555 | Cost query and spend use the same resolver; slot-level pity and enhancement own outcomes. No new defect established in this path. |
| Wash | WashTab.vue -> useEquipmentActions:125-155 -> EquipmentOpsSystem -> EquipmentWash | Paid roll and ticket are domain-held; display affixes are cloned; every commit consumes the pending slot. Identity and eligibility are insufficient: AUD-E02. |
| Refine | RefineTab.vue -> useEquipmentActions -> EquipmentRefine | Pending preview binds exact object, membership generation, complete relevant item snapshot and exact payload. Charges before returning display values; rejects replay/stale payload; refreshes equipped modifiers. This is the existing reusable precedent for wash. |
| Dissolve / overflow | EquipmentSystem -> EquipmentDissolve; EquipmentBag auto-dissolve -> ops/battle/restore delivery | Domain quote and commit share validation/deduplication. Delivery paths generally account for material overflow and collect-quest progress. Result.rewards still describes generated rewards, not a general delivered receipt. |
| Forge uses | EquipmentInstance.forgeUsesTotal / forgeUsesRemaining | Budget belongs to the item; wash/refine spend it. Slot enhancement is a different state axis. No separate live forge/crafting authority was inferred from the label. |

### Economy, progression, production and companions

| System / mutable state | Current authority and real production chain | Reset / persistence and limitations |
|---|---|---|
| Material stacks | MaterialBag.add/remove/canAcceptAmount; callers below | Finite positive mutation guards and bounded stack limits. get/getAll return live stack references, so no encapsulation guarantee was assumed solely from private Map. |
| Pill stacks | PillBag; GameManagerPillOps owns use sequence | Current authored ordinary pills reach the profession or permanent-stat branch. Legacy heal/buff branches have no current authored item consumer; they are not reported as a normal-flow crash. |
| Direct reward | GameManagerRewardOps.buildPlayerRewardReceiver -> RewardSystem | Cultivation uses addCultivation; technique insight is directed to the equipped technique; currency enters the realm-appropriate MaterialBag stack with overflow handling and quest notification. |
| Vendor exchange | VendorPanel -> GameManagerEconomyOps -> VendorSystem | Shared eligibility/price rule, realm-grade gate, sole-ingredient guard and complete currency-capacity preflight before debit/credit. This is a healthy atomic exchange boundary. |
| Building build/upgrade/claim | GameManagerBuildingOps -> BuildingSystem + BuildingManager | Domain cost/realm gates; capacity formula for Chi Hien Quan; claims validate material resolution before resetting harvest time. Return amount and delivery are not the same concept. |
| Production | ProductionPanel / WorkerLodge -> GameManagerBuildingOps -> ProductionSystem | Cycle snapshots own realm/level/seed/deadline; grantCycleRewards is shared. WorkerAllocator is shared by online/offline allocation. Time advancement is still separately implemented; AUD-E01 disproves reward parity. |
| Decompose | GameManagerTickOps -> DecomposeSystem -> shared deliverDecomposeOutput; restore also calls this delivery path | Live capacity supplied before work, domain consumes ore, bounded catch-up and output drain. Material overflow is surfaced. Collect-quest notification is absent, but current quest catalog has no refined-essence collect quest, so this is retained coverage debt, not a current quest blocker. |
| Alchemy | AlchemyPanel -> GameManagerAlchemyOps -> AlchemySystem; GameManagerTickOps settles | Real recipe registry, herb/fuel/special checks, reserved inputs, job identity and room level snapshot. Ops subtract the spirit-stone cost returned by the domain. Offline forwards the same M3 yield multiplier. Output receipts exist but consumer ignores them: AUD-E04. |
| Cultivation / minor realm | App tick -> player.cultivate -> addCultivation; breakthrough operation -> CultivationSystem | Cap/bank/pour mechanism, attribute-point grant and minor-level transition. Major-realm transition remains separate; no automatic major skip in ordinary breakthrough. |
| Major realm / path / artifacts | GameManagerRealmAdvanceOps and TribulationOutcomeService / BreakthroughOutcomeService | Path selection establishes route and kit; outcome services own realm consequences. Tribulation persistence and repeat-resolution are lifecycle review scope. ArtifactProgression owns XP cap/bank and grade cost; gameplay ops gate path/grade changes outside an active fight. |
| Node/skill progression | GameManagerProgressionOps -> NodeSystem / SkillSystem | Current node modifiers are derived from nodeLevels; old imperative modifier pushing is not the current path. Authored active-skill execution parity is combat review scope. |
| Quest lifecycle | QuestPanel -> QuestOps queries/claim; GameManagerTickOps reconcile/daily reset; battle/material events -> QuestSystem | Query no longer activates quests. Realm flag, boot/restore and daily reset reconcile independently of panel visibility. Claim revalidates turn-in stock and claimed state. Current collect targets are Qi Refiner herbs/ore. |
| Stage progression | StageSystem/StageManager plus turn battle reward/autofarm owners | Stage selection and spawn state were inspected; victory/perfect-clear/auto-farm reward ownership and encounter execution are combat/coordinator scope, not re-certified here. |
| Companion roster/pity/currency | Companion panel -> GameManagerCompanionOps -> CompanionGacha / CompanionProgression | Pull spends one token and refunds on roll exception; roster/pity/Duyen Phan mutate together. Exchange rejects max constellation/insufficient currency first; feed validates real material type/count and dynamic realm cap before debit. Authored roster is populated now; old roadmap mechanism-only/empty-roster text is historical. |
| Companion combat | CompanionProgression.resolveCompanionSkillKit and companionStatsAt -> CompanionCombat | Pure level/rank progression, threshold gates and cloned skill kit. The combat reviewer owns downstream action semantics. |

Material acquisition writers found in the source scan: App.vue starter grant; ProductionSystem; AlchemySystem; EquipmentOpsSystem; BattleLootSystem; GameManagerRewardOps; GameManagerBuildingOps; GameManagerTickOps decompose; QuestSystem; VendorSystem and companion-token refund; GameManagerSaveRestore hydration/overflow. Material spenders include equipment wash/refine/enhance, vendor, buildings, production upgrades, alchemy, companion pull/feed, artifact grade, Tu Linh Tran, body refinement and tribulation penalties. Pill spenders are GameManagerPillOps and the meridian/progression path. This is a responsibility inventory from targeted source searches, not proof that arbitrary property writes cannot bypass a bag.

## Findings

### AUD-E01 — Offline partial worker cycles award extra production

- **Priority P1, confidence 99%, EXECUTED + SOURCE.**
- Location: [ProductionOffline.ts](../../src/core/production/ProductionOffline.ts), lines 210-244 and 248-257. Production entry: [GameManagerSaveRestore.ts](../../src/core/game/GameManagerSaveRestore.ts), lines 339-361. Online comparison: [ProductionSystem.ts](../../src/core/production/ProductionSystem.ts), lines 363-376.
- Actual: two mortal level-1 worker cycles start at T, each due T+100 seconds. At T+65 seconds the offline path keeps both future cycles, but also grants one newly synthesized cycle. Online grants zero.
- Expected owner/invariant: the production cycle authority must award only completed worker lanes. The same saved state and elapsed time must produce the same completed-cycle count within the documented cap. Sum of partial work across independent workers is not a completed cycle.
- Root cause: future pending cycles are copied into kept without reserving their lanes. Then floor(windowMs * slots / cycleMs) pools fractional lane time; a synthesized cycle is backdated from now and granted immediately.
- Consequence: ordinary loading after more than 60 seconds can increase yield ahead of deadlines. Original pending work remains, so the added grant is not merely replacing that work. Save/reload timing can distort the economy. The concrete test proves one extra grant; it did not quantify an unlimited exploit.
- Reproduction: real ProductionSystem, current THANH_VAN catalog and authored materials, capacity 2, only thanh_van_lam auto, mortal level 1. Run tickWorkers(T), clone states, compare tickWorkers(T+65000) against restoreStates + settleOffline(T+65000, offlineSinceMs=T).
- Observed output: elapsedMs=65000; saved deadlines both 1100000 for start 1000000; onlineRewards=[]; offlineSettled=1; offlineRewards=[{siteId:"thanh_van_lam",materialId:"qi_refining_wood_decade",amount:3}]; offlinePending=2.
- Repair direction: maintain per-lane completion and remaining partial cycles, using the same advancement semantics online/offline; keep the declared shared work-budget cap. Add real-catalog parity cases with fractional durations, multiple lanes, retained future cycles and repeated partial saves.
- Tests missed it: ProductionSystem.workers.test.ts:109-156 compares activeWorkerSlots, not earned output or deadlines. Existing worker-cycle tests do not cover two future lanes at a fractional window.
- Introduction: current formula is preserved by the 63fef9e6 large-file split; no claim that the split introduced the original arithmetic bug.

### AUD-E02 — Wash tickets do not bind the paid item lifecycle

- **Priority P2, confidence 99%, EXECUTED + SOURCE.**
- Location: [EquipmentWash.ts](../../src/core/equipment/EquipmentWash.ts), lines 246-250, 307-325 and 334-361. Existing stronger mechanism: [EquipmentRefine.ts](../../src/core/equipment/EquipmentRefine.ts), commitRefineValues / snapshot matching; [EquipmentBag.ts](../../src/core/equipment/EquipmentBag.ts), lines 29-31 and 112-140.
- Actual: preview a real factory-created base_kiem; remove it and add a distinct same-ID instance marked locked=true and favorite=true; commit the old ticket. It returns ok=true and overwrites the replacement's affixes with the old paid roll.
- Expected owner/invariant: the paid generated result belongs to one exact item membership/session and current eligibility. A same string ID is not a lifetime capability.
- Root cause: pending wash stores only ticketId, instanceId and affixes. Commit checks strings only. It does not compare the exact object, membership generation, item shape/quality or lock/favorite state.
- Consequence: stale callers can alter a replacement/protected item, and changes between preview/commit are silently overwritten. The result cannot be forged from an affix payload, but its authorization is still insufficient.
- Production chain: WashTab.vue:125-137 -> useEquipmentActions.ts:125-155 -> EquipmentOpsSystem -> EquipmentSystem -> EquipmentWash. Domain state outlives local UI preview state. Normal cloud/session replacement replay was **not** executed: current GameManagerSaveRestore adds equipment without clearing it, as the lifecycle reviewer found. Therefore this is P2 state-integrity/API evidence, not a claimed P1 ordinary reload exploit or a server-security vulnerability.
- Observed output: template="base_kiem", previewOk=true, replacedExactObject=true, locked=true, favorite=true, commit={ok:true}, after=[].
- Repair direction: reuse refine's exact-object/membership/snapshot capability and bind pending wash to the session; revalidate protected state and clear pending operations on owner/session reset. Do not merely make ticket text more random.
- Tests missed it: EquipmentWash.pending.test.ts covers missing item, wrong ticket, replay, explicit discard and successful application, but not same-ID replacement / remove-add generation / changed lock/favorite. Its header promises identity/membership checks that the implementation does not perform.
- Introduction: exact original commit was not established. The current extracted implementation preserves the weak pending shape.

### AUD-E03 — Hoi Xuan pills consume resources for a zero-effect result

- **Priority P2, confidence 99%, EXECUTED + SOURCE + SPEC DRIFT.**
- Locations: [PillFamilies.ts](../../src/data/pill/PillFamilies.ts), lines 17-22; [pills.ts](../../src/data/pill/pills.ts), lines 16-24; [alchemyRecipes.ts](../../src/data/alchemy/alchemyRecipes.ts), lines 18-30; [PillSystem.ts](../../src/core/pill/PillSystem.ts), lines 208-237; [GameManagerPillOps.ts](../../src/core/game/GameManagerPillOps.ts), lines 52-83; [PillBagSection.vue](../../src/components/panels/bag-sections/PillBagSection.vue), lines 82 and 169.
- Actual: hoi_xuan_dan_mortal is still a generated ordinary pill with regen.hpPerSecond=4, duration 60s, its own normal alchemy recipe, and an HP/s description in the bag. usePillDetailed accepts it, removes the pill, and creates only a manaRegenPerSecond modifier with flat=0.
- Expected owner/invariant: published content must execute its authored benefit or be explicitly unavailable. Removing an effect must retire/migrate its real recipe, drop and presentation consumers as one content change.
- Root cause: the HP modifier was intentionally removed from the executor on 2026-09-05; the Hoi Xuan family/generator/recipe/UI remains authored against that retired effect.
- Consequence: player spends ingredients, stone and job time on an item whose use reports success and has no benefit. The metadata claims the retired effect.
- Executed production chain: current PILL_FAMILIES -> pills/alchemyRecipes -> PillRegistry/PillBag -> GameManagerPillOps.usePillDetailed -> PillSystem. The test supplied an in-memory timed-effect sink and asserted no legacy heal/buff target was used.
- Observed output: recipe="alchemy_hoi_xuan_dan_mortal"; authoredEffects=[{type:"regen",hpPerSecond:4,durationSeconds:60,effectGroup:"hoi_xuan_dan",stackable:true}]; result={ok:true}; remaining=0; timed.modifiers=[{stat:"manaRegenPerSecond",flat:0}].
- Repair direction: honor the user's HP-pill retirement decision by removing/disabling this unsupported family through the shared pill/recipe/drop/UI catalog, or obtain a product decision for a supported replacement effect. Reintroducing the removed HP mechanic is not assumed authorized.
- Tests missed it: the generic effect and retirement tests do not execute every currently authored pill through the actual use operation and assert a meaningful supported outcome.
- Intent evidence: roadmap lines 2639/2675 and the current executor comment explicitly say HP pill regeneration was removed by user request. This finding concerns the remaining content pipeline, not that design decision.

### AUD-E04 — Output receipts are generated but not consumed by notifications

- **Priority P2, confidence 98%, SOURCE (not separately executed).**
- Locations: [GameManagerTickOps.ts](../../src/core/game/GameManagerTickOps.ts), lines 170-184 and 198-209; [ProductionSystem.ts](../../src/core/production/ProductionSystem.ts), lines 435-449; [AlchemySystem.ts](../../src/core/alchemy/AlchemySystem.ts), lines 348-360.
- Actual: MaterialBag/PillBag clamp output and return overflow. Production emits amount plus overflow; alchemy emits pills, delivered and overflow. TickOps always formats production amount and alchemy pills, never delivered or an overflow warning for those events.
- Concrete source path: fill the relevant stack to its limit, complete a production cycle / successful alchemy job, then run GameManager.update. Bag delivery is zero; production can display "+N" and alchemy "xN". Quest production progress correctly uses amount-overflow, making the UI disagree with both the bag and quest.
- Expected owner/invariant: acquisition consumers must distinguish generated, delivered and lost quantities. R9 receipt types alone do not close the cross-system contract.
- Root cause: the actual notification adapter was not migrated when receipts were added. Domain bookkeeping is already available.
- Consequence: resource loss is concealed as success in the primary completion message; users cannot reconcile advertised yield with inventory.
- Repair direction: display delivered quantities and route overflow to the existing bag-overflow event factory, keeping loss policy unchanged. Add one orchestration test per event kind with a full stack, asserting bag, quest and notifications together.
- Scope: no claim that the domain duplicated grants. This is a receipt-consumer correctness defect, not a reason to redesign transaction policy.

## Retained debt, rejected hypotheses and limits

- Equipment speed data remains on old fractional units: equipment.ts necklace 0.03-0.08; affixes.ts speed ranges 0.01-0.13; runtime baseline speed is 100. The 2026-09-04 stat-conversion QA explicitly deferred equipment affix range authoring, so this is known retained balance debt rather than a newly proven critical regression. No rebalance was performed.
- Decompose output does not notify collect quests. Current authored collect quests target Qi Refiner herbs/ore, not refined essence; no current-player quest blocker was asserted.
- Hai Na plus Ngo Dao was considered, executed and rejected as a normal-flow defect: TalentEffects.collectTalentEffects intentionally reads only the first selected talent. Both online and offline probes produced zero insight with Hai Na first. This test did not establish a valid combined-talent scenario.
- Source-only follow-up, **not counted as a confirmed finding**: chooseCultivationPath resets cultivation when moving mortal -> qi_refining but contains no pourCultivationOvercharge call; the other breakthrough paths do. A focused Hai Na initiation test should determine whether this is intended. No production-factory reproduction was completed within the bounded audit.
- New-character starter building/material grants remain in App.vue's lifecycle callback. That is a current composition boundary to record, not evidence by itself of duplicate rewards.
- No browser interaction was performed by this worker. Screenshots, worker UI behavior, save/import replay reachability and pill notifications remain coordinator/runtime checks.
- The existing architecture tests do not prove canonical calculation reaches all live consumers. The combat reviewer separately executed a passive current-fight refresh / next-fight snapshot leak; do not double-count it here.
- This was targeted responsibility tracing, not exhaustive enumeration of every condition of every authored recipe/companion perk or late-realm placeholder. Those unexecuted surfaces remain gaps.

## Reproduction method and verification record

All three executed findings used current TypeScript production modules compiled **in memory** by the installed TypeScript compiler, loaded as CommonJS with an in-memory cache. No module implementation or test file was edited. Alias resolution mapped @/ to game/src. import.meta.env was replaced with a test environment object only in the diagnostic loader; the audited pure economy branches do not use that flag. Outputs were printed to the tool log.

A first Vite SSR attempt for AUD-E01 failed with "transport invoke timed out after 60000ms" while fetching ProductionBalance.ts. This was an environment/diagnostic limitation, not a game failure. The subsequent in-memory TypeScript runs succeeded (exit 0).

Run the following shared loader in Node from the worktree's game directory, then append one diagnostic below:

    const fs = require('node:fs');
    const path = require('node:path');
    const vm = require('node:vm');
    const ts = require('typescript');
    const cache = new Map();
    function load(file) {
      file = path.resolve(file);
      if (cache.has(file)) return cache.get(file).exports;
      const m = { exports: {} };
      cache.set(file, m);
      const src = fs.readFileSync(file, 'utf8')
        .replaceAll('import.meta.env', '({ DEV: false, MODE: "test" })');
      const out = ts.transpileModule(src, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
      }).outputText;
      const req = id => id.startsWith('.')
        ? load(path.resolve(path.dirname(file), id) + (path.extname(id) ? '' : '.ts'))
        : id.startsWith('@/') ? load(path.resolve('src', id.slice(2)) + '.ts') : require(id);
      new vm.Script('(function(exports,require,module,__filename,__dirname){' + out + '\n})',
        { filename: file }).runInThisContext()(m.exports, req, m, file, path.dirname(file));
      return m.exports;
    }

AUD-E01 minimal real-catalog diagnostic:

    const { ProductionSystem } = load('src/core/production/ProductionSystem.ts');
    const C = load('src/core/production/ProductionCatalog.ts');
    const { MaterialBag } = load('src/core/material/MaterialBag.ts');
    const { MaterialRegistry } = load('src/core/material/MaterialRegistry.ts');
    const { materials } = load('src/data/materials/materials.ts');
    const registry = new MaterialRegistry();
    for (const m of materials) registry.register(m);
    const make = () => new ProductionSystem({
      territory: C.TERRITORY_THANH_VAN, sites: C.THANH_VAN_PRODUCTION_SITES,
      forestRewards: C.THANH_VAN_FOREST_REWARDS, mineRewards: C.THANH_VAN_MINE_REWARDS,
      grottoHerbs: C.THANH_VAN_GROTTO_HERBS
    });
    const online = make(), onlineBag = new MaterialBag();
    online.restoreStates([{ siteId: 'thanh_van_lam', level: 1, autoRestart: true,
      activeWorkerSlots: 0, workerCycles: [] }]);
    const start = 1000000, now = start + 65000;
    const assignments = new Map([['thanh_van_lam', 2]]);
    online.tickWorkers(start, onlineBag, registry, 'mortal', 2, assignments);
    const saved = structuredClone(online.getAllStates());
    online.tickWorkers(now, onlineBag, registry, 'mortal', 2, assignments);
    const offline = make(), offlineBag = new MaterialBag();
    offline.restoreStates(saved);
    const settled = offline.settleOffline(offlineBag, registry, 'mortal', now, {
      workerCapacity: 2, offlineSinceMs: start, workerAssignments: assignments
    });
    console.log({ saved, online: online.drainSettlementEvents(), settled,
      offline: offline.drainSettlementEvents(), pending: offline.getState('thanh_van_lam').workerCycles });

AUD-E02 diagnostic setup and action:

    const { EquipmentSystem } = load('src/core/equipment/EquipmentSystem.ts');
    const { EquipmentBag } = load('src/core/equipment/EquipmentBag.ts');
    const { EquipmentRegistry } = load('src/core/equipment/EquipmentRegistry.ts');
    const { EquipmentSlotManager } = load('src/core/equipment/EquipmentSlotManager.ts');
    const { AffixRegistry } = load('src/core/equipment/AffixRegistry.ts');
    const { MaterialBag } = load('src/core/material/MaterialBag.ts');
    const { equipment } = load('src/data/equipment/equipment.ts');
    const { affixes } = load('src/data/equipment/affixes.ts');
    const { materials } = load('src/data/materials/materials.ts');
    const { createDefaultPlayer } = load('src/core/player/Player.ts');
    const { LUYEN_KHI_TINH_HOA_ID } = load('src/core/equipment/TinhHoaMaterial.ts');
    const { SPIRIT_STONE_MATERIAL } = load('src/core/material/SpiritStoneMaterial.ts');
    const system = new EquipmentSystem(), bag = new EquipmentBag();
    const registry = new EquipmentRegistry(), ar = new AffixRegistry();
    const slots = new EquipmentSlotManager(), mb = new MaterialBag();
    for (const e of equipment) registry.register(e);
    for (const a of affixes) ar.register(a);
    mb.add(materials.find(m => m.id === LUYEN_KHI_TINH_HOA_ID), 100000);
    mb.add(SPIRIT_STONE_MATERIAL, 100000);
    const item = system.createInstance(equipment.find(e => e.slot === 'weapon'), createDefaultPlayer(), ar);
    bag.add(item);
    const preview = system.previewWashAffixes(item.instanceId, bag, registry, mb, ar, () => 0);
    const replacement = structuredClone(item);
    replacement.locked = true; replacement.favorite = true;
    replacement.affixes = [{ affixId: affixes[0].id, tier: 1, value: 123 }];
    bag.remove(item.instanceId); bag.add(replacement);
    console.log(system.commitWashAffixes(item.instanceId, preview.ticketId, bag, slots, ar), replacement);

AUD-E03 diagnostic:

    const { GameManagerPillOps } = load('src/core/game/GameManagerPillOps.ts');
    const { PillSystem } = load('src/core/pill/PillSystem.ts');
    const { PillBag } = load('src/core/pill/PillBag.ts');
    const { PillRegistry } = load('src/core/pill/PillRegistry.ts');
    const { pills } = load('src/data/pill/pills.ts');
    const { alchemyRecipes } = load('src/data/alchemy/alchemyRecipes.ts');
    const { createDefaultPlayer } = load('src/core/player/Player.ts');
    const bag = new PillBag(), registry = new PillRegistry();
    for (const p of pills) registry.register(p);
    const pill = pills.find(p => p.id === 'hoi_xuan_dan_mortal');
    bag.add(pill, 1);
    const player = createDefaultPlayer();
    const ops = new GameManagerPillOps({
      pillBag: bag, pillRegistry: registry, pillSystem: new PillSystem(),
      applyTimedEffect: (p, e) => p.persistentTimedEffects.push(e)
    });
    const result = ops.usePillDetailed(pill.id, {
      addCultivation() { throw Error('unexpected legacy path'); },
      heal() { throw Error('unexpected legacy path'); },
      applyBuff() { throw Error('unexpected legacy path'); }
    }, player);
    console.log({ recipe: alchemyRecipes.find(r => r.pillId === pill.id),
      authored: pill.effects, result, remaining: bag.getAmount(pill.id),
      effects: player.persistentTimedEffects });

## G5 worker handoff

- Worktree / branch: as above; baseline unchanged.
- Only worker write: this report, documenting source review and diagnostics.
- Behavior before -> after: unchanged; no repair authorized.
- Q1: evidence-backed audit findings and healthy boundaries delivered; failure paths checked through actual production modules where stated.
- Q2/Q3: authority and state tables above; gaps at paid wash identity, output-consumer receipts and worker completion semantics.
- Q4: production caller chains recorded for each finding; AUD-E02 normal session-replacement UI reachability remains unexecuted.
- Q5: existing reusable mechanisms identified: WorkerAllocator, cycle snapshots, MaterialBag.canAcceptAmount, refinement membership capability, StatCalculator provenance, PillFamilies.
- Q6: core arithmetic/data mechanisms stay below ops/UI in the reviewed chains; a repository-wide transitive dependency audit belongs to the coordinator.
- Q7: production/alchemy clocks commit independently of UI; App holds some startup/refresh composition. No visual acknowledgment used as reward proof.
- Q8: current authored Hoi Xuan case fails capability parity; other authored skills are combat review scope.
- Q9: quest queries are observational; paid wash/refine preview is explicitly a command. Production getSiteView can initialize idle state; no consequential reward mutation established there.
- Q10: audited duplicate/stale/full-stack/partial-time paths; three executed failures, receipt adapter source defect; cross-session save outcomes delegated.
- Q11: known live alternate paths and dormant pill branches identified, without deleting or treating their names as proof of non-use.
- Q12: only assigned report written; no production diff; tests/build not rerun by worker, no full verification duplicated.
- Triggered modules: C2 reviewed; E1-E6 reviewed proportionally with explicit failures/gaps above; L1/L2 source tracing supports quest lifecycle direction, L3/L4 runtime certification remains with coordinator; S1-S4 coordinated with lifecycle reviewer. C1/C3-C7 and P13/P14 are not certified by this worker.
- G2/G3: N/A, read-only audit. Repair tests described above are PLANNED, not passed.
- P3: coordinator-owned baseline run. Worker execution consists only of the three recorded Node diagnostics and the rejected combined-talent probe.
- P4: feature/fix gate N/A because no feature/fix was implemented; no production PASS claim.
- P5: read-only engineering review verdict is Request changes; no production change required simplification.
- P13/P14: no worker browser/progression run. Runtime reachability limits are stated above.
- Unresolved work: coordinator spot-check, aggregate findings/dependency order, full verification results and browser evidence consolidation. No further worker production work is authorized.

