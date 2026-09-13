# Combat engineering audit — 2026-09-14

Read-only audit at `f2846064a4b15d4d20a94540855b6194b77eb21c`.

- Worktree: `E:/tutienidle/.agent-worktrees/full-project-audit-2026-09-14`.
- Branch: `codex/full-project-audit-2026-09-14`.
- Scope: live stage/party construction, scheduler, authored skill execution, damage/vitals, status/reactions, passives, rewards and cleanup. No production implementation, refactor, test-file changes or commits.
- Rules read: root AGENTS.md, AstraDoctrine.md, architecture-worker-workflow.md, shared full-project-audit-task-card.md. Applied code-review and systematic-debugging as investigation workflows, then verification-before-completion for the report handoff. G0/G1 completed proportionally; G2/G3 implementation gates N/A. This report is the worker G5 result.
- Current roadmap R1–R6 and later combat-turn/9.5 updates were treated as intent and checked against source. Historical completion labels were not used as proof.
- Verdict: **audit complete; current source has confirmed defects requiring repair**. Nine findings below exceed 80% confidence. No P0 finding established. Browser/Phaser behavior was not certified by this worker.

## Authority and real flow

| Responsibility | Current production path / owner | Assessment |
|---|---|---|
| Stage entry and eligibility | UI supplies player/finalStats -> GameManager -> GameManagerTurnBattleOps.startStage -> StageWaveSystem.start -> stage gate + StageManager.start -> launchBattle | Real stage path inspected, including the discarded bootstrap enemy and subsequent wave factory. |
| Enemy construction | StageWaveSystem.pickEnemyForTurnSpawn -> template/boss/tag/realm policy -> EnemySystem.spawn -> enemyToCombatEntity -> toTurnBattleParticipant | Unique instance IDs; authoritative normalized stats; fresh combat entities. |
| Party construction | buildTurnBattle -> resolvePartyFormation -> playerToCombatEntity / companionToCombatEntity -> resolveCompanionSkillKit -> toTurnBattleParticipant -> canonical formation buff | Real companion definitions and unlock gates reach battle slots. Formation buffs are stored in participant pools but effective-stat refresh is delayed (C03). |
| Timing and ownership | injected ClockSource -> CombatClock -> stepTurnBattle -> tickPacing(false) -> TurnToken claim -> TurnPipeline -> CombatAnimationRuntime -> declare/impact/complete | One runtime pipeline in both headless and presentation modes. In-flight token freezes clock; stale/tokenless ACKs rejected; no frame-based gameplay damage calculation found. |
| Turn logic | TurnBattleSystem: intro/countdown, wave telegraphs, one gauge advance, selection, CC/charge, damage, completeAction | Effective-speed cache is synchronized from entity.stats; the underlying entity.stats refresh is incomplete (C01/C03). |
| Damage and vitals | CombatSystem.resolveActionHit / applyDirectDamage / applyDotDamage -> EntityVitalsSystem + killIfDead | Direct, DoT, reflection and consume damage use the complete death/survival owner. Ordinary hit uses accuracy/crit/block, mitigation, Ward, mana shield, HP, leech/reflection and death. Regen and post-death continuation gaps remain (C02/C06). |
| Buffs | per-participant BuffPool + canonical core/buff/BuffSystem; holder-turn update; persistent manager BuffSystem uses updateTime | Shared lifecycle mechanism, separate pools/clocks. On-hit pool routing is incorrect (C04). |
| Reactions | TurnBattleSystem.applySkillAilments -> TurnReactionManager -> shared ELEMENT_REACTIONS -> CombatSystem | Real elemental basics/companions make reactions reachable; cross-source consumption is wrong (C08). |
| Passives | EventBus -> PassiveSystem -> SkillManager passive modifier stacks -> PersistentEffectOps -> player store aggregation | Stack ownership exists, but combat consumption is missing and reset is ordered after snapshot (C01). |
| Rewards | settleCombatOutcome -> GameManagerBattleRewardOps -> BattleLootSystem -> RewardSystem/bags/quests/companion EXP -> enemy despawn | Per-enemy granted IDs and per-cycle terminal flag prevent repeat grants; no visual arrival is needed to award loot. Natural-defeat terminal caveat below. |
| Cleanup | abandon ends session, resets playback/pipeline/token, clears boundary commands and EnemyManager, stops clock; stage restart rebuilds enemy waves | Explicit abandonment is coherent. Normal terminal has separate paths; see retained concerns. |

## Confirmed findings

### AUD-C01 — P1 — Live passive stacks do not affect this fight and leak into the next fight

Evidence: **EXECUTED + SOURCE**, confidence 99%.

- Locations: `src/core/game/GameManagerTurnBattleOps.ts:798-818` creates the player entity before `startBattle()` resets passive stacks at `741-751`; seed occurs afterward at `818-821`. `src/core/battle/turn/TurnBattleSystem.ts:780-792` recomputes only base stats plus BuffPool. `src/core/battle/turn/TurnStatsRecompute.ts:8-11` has no passive provider. `src/core/game/GameManagerPersistentEffectOps.ts:74-100` supplies the live passive modifiers to the store; `src/App.vue:479-486` refreshes that store aggregation.
- Current behavior: PassiveSystem handles real combat kill/hit events and mutates its own stacks. Those changed modifiers reach menu/store stats, while battle stats continue using the battle-start snapshot. At the next battle, that already-resolved store snapshot is captured before reset, so the previous fight's temporary bonuses become this fight's base.
- Executed through actual `GameManager.startStage`, `ManualClockSource`, `createDefaultPlayer`, selected `tat_phong`, and `defineEnemy`/EnemySystem construction; three enemies were actually killed by the turn loop:

```text
PASSIVE_CURRENT {state:"victory",kills:3,stacks:3,originalSpeed:100.15,
  liveSpeed:100.15,storeEquivalentSpeed:106.159}
PASSIVE_NEXT {stacksAfterReset:0,baseSpeed:106.159,expectedCleanSpeed:100.15}
```

- Expected owner: one combat-effective-stat assembler consumes current battle passive state, with static snapshot distinct from temporary state. Reset/seed belongs before the snapshot or must be excluded from its static input.
- Root cause: migration kept event-driven mutable passive state in SkillManager, but the turn engine replaced its runtime stat input with a closed `baseStats + buffs` calculation.
- Consequence: Tật Phong and other accumulating combat stat talents do not modify current combat as advertised; rematches inherit old temporary bonuses. Pha Giáp carry tests currently verify stack counts, not resulting combat stats.
- Repair direction: characterize store -> battle entry -> real event -> effective stats -> next battle, then restore one temporary-modifier input and a coherent reset/snapshot order. Do not independently patch each talent.

### AUD-C02 — P1 — Authored mana/Ward regeneration has no live combat consumer

Evidence: **EXECUTED + SOURCE**, confidence 99%.

- Locations: `src/core/battle/turn/TurnBattleSystem.ts:727-739` updates buffs and HP regen only. `src/core/player/Player.ts:451-489` initializes MP at maximum and Ward at zero. `src/core/battle/turn/TurnSkillAction.ts:105-130` only checks/spends MP; `src/core/combat/CombatSystem.ts:345-366` only spends Ward and mana shield MP.
- Real authored producers: `src/core/player/CultivationPathKit.ts:60-81` gives Pháp Tu mana regen; `src/data/buff/ThuanHeBuffs.ts:12-24` Thanh Tuyền gives mana regen, `29-41` Băng Giáp and `87-103` Địa Trụ give Ward capacity/regen. These are current chain specializations, not dormant placeholder effects.
- Full production-source search for `manaRegenPerSecond`, `wardRegenPerSecond`, `currentMp` and `currentWard` found no live refill loop. The generic participant `resources.values` hook is not connected to these entity fields by the production adapter.
- Diagnostic using player/enemy factories and ten holder turns:

```text
REGEN {mpAfter10Turns:10,wardAfter10Turns:0,manaRegen:10,wardRegen:10}
```

- Expected owner: combat clock/turn regeneration policy invokes a vitals/resource owner; presentation cannot supply the missing refill.
- Consequence: mana shield drains without the authored recovery; Reaction Path mana costs eventually leave it using basics. A player starts at Ward 0 and has no live refill, so Ward capacity/regen buffs and Ward-consume damage cannot deliver their main benefit.
- Repair direction: define the current intended turn units explicitly, wire mana/Ward accrual and vitals events once, and exercise real Thanh Tuyền/Địa Trụ actions through the stage loop. Do not infer a numerical rebalance from old seconds-based code. The unit choice remains a product contract to preserve/clarify, while the missing consumer is established.

### AUD-C03 — P2 — Newly applied defensive/status modifiers stay inactive until the holder's next actionable turn

Evidence: **EXECUTED + SOURCE**, confidence 99%.

- Locations: `src/core/buff/BuffSystem.ts:31-77` adds pool entries without refreshing effective stats; `src/core/battle/turn/TurnBattleSystem.ts:727-736,780-792` expires/ticks buffs before the only recompute, which is skipped during CC/charging; `1102-1138` applies skill buffs after that recompute. Initial formation buffs are applied at `GameManagerTurnBattleOps.ts:945-954` without recompute before first gauge.
- Executed the real `thiet_y_tang` companion via `companionToCombatEntity`, `toTurnBattleParticipant`, and its authored `thiet_y_tang_special` (`src/data/companion/Companions.ts:350-376`):

```text
AUTHORED_MONK_BUFF {beforeDef:5,
  immediate:{defense:5,thorns:0,buffs:["kim_giap"]},
  enemyHpDeltaFromCounter:0,defenseNextTurn:5.75,thornsNextTurn:0.15}
```

- Current behavior: the stance is visible in the pool but gives no defense/thorns against the immediately following enemy attack. Speed debuffs also wait until the affected actor has already earned a turn; CC can prolong stale stats. A one-turn stat buff can expire before ever being folded.
- Expected owner: the effective-stat layer should derive the current active state before its readers act (damage, gauge, previews), independent of whether the holder may cast.
- Root cause: effective stats are treated as a turn-selection side effect instead of a projection of current modifier state.
- Repair direction: repair shared effective-stat invalidation/recomputation, including apply/remove/expiry/cleanse and initial formation buffs. C01 and C03 should be designed together, with separate regression cases.

### AUD-C04 — P2 — On-hit procs are inserted into the wrong participant pool

Evidence: **EXECUTED + SOURCE**, confidence 100%.

- Locations: `src/core/battle/turn/TurnBattleSystem.ts:1049-1050` invokes `new BuffSystem(actor.buffs).rollOnHitEffects(...)`; `src/core/buff/BuffSystem.ts:397-404` applies the triggered definition through `this.apply`, retaining that source pool, despite passing the victim as `target`. CC queries at `363-372` inspect pool effects without target-ID filtering.
- Real input: `src/data/buff/LegacyBuffs.ts:222-240` authors `thach_hoa` with an onHitProc to `choang`; the Earth basic in `src/data/skill/TurnBasicAttacks.ts:33` applies Thạch Hóa in normal combat. `docs/systems/buffs.md:18` describes onHitProc as the holder's landed-hit proc.
- Execution after a Thạch Hóa holder lands a hit, RNG fixed to 0.2:

```text
ON_HIT_POOL {sourcePool:[{id:"thach_hoa",targetId:"player"},
 {id:"choang",targetId:"diagnostic_dummy"}],targetPool:[],
 sourceStunned:true,targetStunned:false}
```

- Consequence: a status whose target ID names the opponent actually stuns the attacker, and later buff ticks run against the wrong holder.
- Expected owner: target participant's BuffPool; source pool supplies proc definitions only.
- Root cause: a holder-scoped BuffSystem method both enumerates source procs and performs target writes through its own pool.
- Repair direction: provide the target buff authority at the proc boundary, preserve source identity, and assert both pools and both CC outcomes through a real Earth-basic interaction.

### AUD-C05 — P2 — The default Kiếm Tu special never generates Thế, making its ultimate unreachable

Evidence: **EXECUTED + SOURCE**, confidence 100%.

- Locations: `src/core/battle/turn/TurnBattleSystem.ts:925-950` returns from charge resolution before the gain block; `955-958` commits charge initiation without gain; `1089-1100` grants Thế only inside the non-charge branch. `src/core/game/TurnBattleAdapter.ts:26-33` wires the real Kiếm Tu pair. `src/data/skill/BatKiemThuat.ts:23-28,41-48` defines charged Bạt Kiếm Thuật and the ultimate's 100-Thế cost.
- Production entry initializes `currentThe:0` (`Player.ts:475`). Source search found no other live writer that accrues this player's pool.

```text
CHARGE_THE {afterPlayerTurns:60,currentThe:0,ultimateCasts:0,
  chargeSkillTurns:32,damageDealt:5231.200000286102}
```

- Expected owner: action execution/resource outcome contract; a successful charged special should preserve the same authored gain obligation as a successful special.
- Consequence: automatic and manual ultimate affordability remains false for the default Kiếm Tu kit regardless of completed charge hits.
- Root cause: the later charge-init commit repair did not carry charged-hit accrual into the early-return branch.
- Repair direction: give charge completion its required resource/effect outcome while retaining one cast-cost/cooldown commit. Existing `TurnBattleSystem.theResource.test.ts` covers a synthetic non-charging special, not this shipped pair.

### AUD-C06 — P2 — A DoT-killed charging actor regenerates HP and still releases its attack

Evidence: **EXECUTED + SOURCE**, confidence 100%.

- Locations: `src/core/battle/turn/TurnBattleSystem.ts:635-669` captures charged targets before status damage; `727-735` ticks DoT then applies HP regen without checking alive; `925-944` later resolves the captured charge without checking actor.alive. Normal action selection at `781` does have an alive check, so this is a charge-path inconsistency. `src/core/combat/EntityVitalsSystem.ts:86-93` healing does not reject a dead entity.
- Reproduction: real Bạt Kiếm Thuật -> two charge ticks -> set the diagnostic caster to 0.001 HP -> apply real `bong` via BuffSystem -> resolve the final charge turn. This low HP is a test setup for an ordinary lethal DoT boundary; skill and buff definitions are unchanged.

```text
DEAD_CHARGE {alive:false,hp:0.1,damageAfterDeath:301.7999999523163,
  targets:["diag_dummy"]}
```

- Expected owner: turn-start status/death result must control whether the same actor may proceed; vitals must have an explicit no-heal/revive policy for dead entities.
- Consequence: a dead unit deals a charged hit and is presented with positive HP while alive remains false. In a party it can kill a remaining enemy after it has already died.
- Repair direction: stop ordinary/charge action progression after a lethal status update and keep revival distinct from regeneration. Cover surviving-lethal and party outcome cases, not just HP arithmetic.

### AUD-C07 — P2 — Basic attacks bypass the canonical skill progression/scaling output

Evidence: **EXECUTED + SOURCE + SPEC DRIFT**, confidence 100%.

- Locations: `src/core/game/GameManagerTurnBattleOps.ts:843-858,892-897` selects static basic definitions; `src/data/skill/TurnBasicAttacks.ts:17-36` hardcodes multiplier 1 and no authored scaling. `src/core/skill/SkillSystem.ts:94-130` computes level/cast scaling for effective skills, but the basic path does not call it. Specials/ultimates do use the canonical output at `GameManager.ts:858-871`.
- Execution with actual GameManager and real `tram` Skill at 10,000 totalExperience/level 3:

```text
BASIC_PROGRESS {totalExperience:10000,canonicalDamageValue:1001,
 actualBasic:{id:"tram",cooldownTurns:0,damage:{kind:"physical",multiplier:1},
 targeting:{shape:"single"}}}
```

- Consequence: Huy Kiếm cast count/level can advance and unlock progression while its actual basic attack remains the static definition. Elemental basics likewise omit their current authored mana/attribute scaling and levels (for example `CoreSkills.ts:107-124`).
- Expected owner: SkillSystem's resolved authored output, adapted into an explicit basic action policy (no cooldown/cost where intended), rather than a second independent damage definition.
- Root cause: the content inventory test converts basic Skills in isolation, but production uses static TurnBasicAttacks instead. `SkillInventoryParity.qa.test.ts:40-52` therefore tests a non-production basic conversion path.
- Repair direction: characterize real basic damage at multiple progress states, make the production basic adapter consume the canonical values, and preserve the chosen turn cadence. Roadmap 9.5 #9's revived level/count claims are only partly true.

### AUD-C08 — P2 — Cross-source reactions consume the wrong source identity and reuse one ingredient

Evidence: **EXECUTED + SOURCE**, confidence 100%.

- Locations: `src/core/battle/turn/TurnReactionManager.ts:48-64` enumerates active IDs across all sources, but `93-102,134-137` uses the new caster's `source.id` to remove the existing ingredient. `src/core/element/ElementReaction.ts:3-11` explicitly allows different sources and consumes both ingredients.
- Executed through real fire basic plus real `thuy_linh_xa` water companion basic, participant factories and TurnBattleSystem reaction wiring. Fixed RNG 0.2; fire acts once, water acts twice, target does not advance its own duration between these diagnostic turns:

```text
MULTISOURCE_REACTION {afterOne:[{id:"bong",source:"player"}],
 reactionsAfterTwoWater:2,remaining:[{id:"bong",source:"player"}]}
```

- Consequence: each water application retriggers a reaction off the same unconsumed fire ingredient until duration expiry; different-source DoTs persist despite supposed consumption. Companion parties make this a live path.
- Expected owner: reaction resolver selects the specific existing Buff instance and consumes that instance's source identity.
- Root cause: matching collapses instance identity to buff ID, then reconstructs an incorrect source.
- Repair direction: retain both matched instance identities through resolution; define selection when multiple valid sources coexist. Existing TurnReactionManager tests exercise same-source pairs, so they do not expose this defect.

### AUD-C09 — P2 — The live Water duration specialization is silently dropped during conversion

Evidence: **EXECUTED + SOURCE**, confidence 100%.

- Locations: `src/data/skill/PhapTuChainSkills.ts:245-253` authors `duong_linh_tuyen` with buff duration 8. `src/core/game/SkillToTurnSkillConverter.ts:94-102` maps only buff ID/target; `src/core/buff/BuffSystem.ts:44-45` derives duration from the registry definition, whose Thanh Tuyền duration is 6 (`ThuanHeBuffs.ts:12-18`).
- Executed the real specialized Skill through SkillSystem -> converter -> TurnBattleSystem:

```text
SPECIALIZATION_DURATION {specialization:"duong_linh_tuyen",
  authoredDuration:8,actualDuration:5.9879999999999995}
```

- The default player's resistance factor is 0.998: the actual value corresponds to registry 6, whereas preserving the authored 8 under the same existing duration policy would give 7.984. This test establishes a dropped duration field, independently of whether positive buffs should be affected by resistance.
- Consequence: selecting this existing specialization does not extend its buff duration.
- Expected owner: validated execution definition preserves supported effect overrides or rejects them; BuffSystem remains the duration-policy owner.
- Repair direction: carry an explicit per-application duration override through the adapter and add this actual specialization to semantic parity tests. Do not change unrelated dormant chain skills to make an inventory count pass.

## Evidence method and reproducibility

No test or production file was added. Diagnostic commands were PowerShell here-strings piped into `node`, using installed TypeScript to transpile current source in memory. Math.random was fixed to 0.2 for hit/proc determinism. Tests constructed players/enemies/companions with production factories, then called TurnBattleSystem or the actual GameManager/ManualClockSource chain as specified per finding. Elevated HP kept isolated probes alive; explicit HP/MP changes only arranged the boundary under test.

Shared read-only loader used by successful commands (run from this worktree's `game` directory):

```js
const fs = require('fs'), path = require('path'), ts = require('typescript')
const Module = require('module'), originalResolve = Module._resolveFilename
Module._resolveFilename = function (id, parent, ...rest) {
  return originalResolve.call(this,
    id.startsWith('@/') ? path.resolve('src', id.slice(2)) : id, parent, ...rest)
}
require.extensions['.ts'] = (module, file) => module._compile(
  ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, file)
const load = (name) => require('./src/' + name + '.ts')
Math.random = () => 0.2
```

### Recovered diagnostic bodies (C01–C09)

These are the bodies of the successful diagnostic commands already executed, recovered from this worker's tool history; they were not rerun for this supplement. To reproduce, prepend the shared loader above to **one** block below and pipe the combined text to `node` from this worktree's `game` directory, in a fresh process for each block. The second block is an excerpt: two preliminary probes superseded by the third block are omitted. No behavioral statements in the retained probes were changed; line breaks were added for readability. The output labels map directly to the finding logs above. This records the actual factory setup and deliberate boundary arrangements, rather than claiming a diagnostic is an ordinary untouched save.

**C01 — production GameManager, stage and clock path:**

```js
const {GameManager}=load('core/game/GameManager'),{createDefaultPlayer}=load('core/player/Player'),{calculateStats}=load('core/stats/StatCalculator'),{defineEnemy}=load('core/enemy/Enemy'),{ManualClockSource,COMBAT_STEP_SECONDS}=load('core/battle/turn/CombatClock');
Math.random=()=>.2;
const manager=new GameManager(),clock=new ManualClockSource();
manager.setCombatClockSource(clock);
const p=createDefaultPlayer();
p.selectedTalentIds=['tat_phong'];
p.baseStats={...p.baseStats,attack:100,speed:100,maxHp:1e6};
manager.setActivePlayer(p);
manager.passiveSystem.resetStacks();
const resolveStats=()=>calculateStats(p.baseStats,[...p.modifiers,...manager.effectOps.getAggregatedModifiers(p)]);
const enemy=defineEnemy({id:'diag_enemy',name:'Diagnostic Enemy',level:1,realmId:'mortal',lane:'ground',statsInput:{maxHp:1,attack:1,attackSpeed:1,attackRangeRanks:9,criticalRate:0,criticalDamage:1.5,armor:0},rewards:{techniqueInsight:0,spiritStone:0}});
const stage={id:'diag_stage',name:'Diagnostic',description:'',floor:1,enemyPool:[{enemyId:enemy.id,weight:1}],totalEnemyCount:3,waves:[3],spawnIntervalSeconds:0};
manager.catalogOps.registerEnemyTemplates([enemy]);
manager.catalogOps.registerStages([stage]);
const originalSpeed=resolveStats().speed;
manager.turnBattleOps.startStage(p,resolveStats(),stage);
for(let i=0;i<1000&&manager.getTurnBattle().state!=='victory';i++)clock.advance(COMBAT_STEP_SECONDS);
const battle=manager.getTurnBattle();
const passive=manager.skillManager.get('talent_passive_tat_phong');
console.log('PASSIVE_CURRENT',JSON.stringify({state:battle.state,kills:battle.enemies.filter(x=>!x.entity.alive).length,stacks:passive.passiveModifiers[0].stacks,originalSpeed,liveSpeed:battle.players[0].entity.stats.speed,storeEquivalentSpeed:resolveStats().speed}));
manager.turnBattleOps.startStage(p,resolveStats(),stage);
console.log('PASSIVE_NEXT',JSON.stringify({stacksAfterReset:passive.passiveModifiers[0].stacks,baseSpeed:manager.getTurnBattle().players[0].entity.baseStats.speed,expectedCleanSpeed:originalSpeed}));
```

**C02 / C04 / C05 — missing regeneration, wrong proc pool and charge resource:**

```js
const {createDefaultPlayer,playerToCombatEntity}=load('core/player/Player'),{calculateStats}=load('core/stats/StatCalculator'),{defineEnemy,enemyToCombatEntity}=load('core/enemy/Enemy'),{toTurnBattleParticipant}=load('core/game/TurnBattleAdapter'),{TurnBattleSystem}=load('core/battle/turn/TurnBattleSystem'),{CombatSystem}=load('core/combat/CombatSystem'),{EventBus}=load('core/events/EventBus'),{BUFF_REGISTRY}=load('data/buff/BuffRegistry'),{BuffSystem}=load('core/buff/BuffSystem'),{GENERIC_PHYSICAL_BASIC,KIEM_TU_BASIC}=load('data/skill/TurnBasicAttacks');
Math.random=()=>.2;
const pd=createDefaultPlayer();
const stats=calculateStats({...pd.baseStats,maxHp:1e9,attack:100,speed:100,wardMax:100,wardRegenPerSecond:10,manaRegenPerSecond:10,maxMp:100},[]);
const makeBattle=(build,basic=KIEM_TU_BASIC)=>{
  const p=toTurnBattleParticipant(playerToCombatEntity(pd,stats),0,basic,build);
  const e=toTurnBattleParticipant(enemyToCombatEntity(defineEnemy({id:'diagnostic_dummy',name:'Dummy',level:1,realmId:'mortal',lane:'ground',statsInput:{maxHp:1e9,attack:1,attackSpeed:1,attackRangeRanks:9,criticalRate:0,criticalDamage:1.5,armor:0},rewards:{}})),1,GENERIC_PHYSICAL_BASIC);
  return {p,e,b:{players:[p],enemies:[e],state:'fighting'},s:new TurnBattleSystem(new CombatSystem(new EventBus()),10000,BUFF_REGISTRY)};
};
const a=makeBattle('kiem_tu');
const ids=[];
for(let i=0;i<60;i++)ids.push(a.s.resolveActorTurn(a.b,a.p).skillId);
console.log('CHARGE_THE',JSON.stringify({afterPlayerTurns:60,currentThe:a.p.entity.currentThe,ultimateCasts:ids.filter(x=>x==='tru_tien_kiem_tran').length,chargeSkillTurns:ids.filter(x=>x==='bat_kiem_thuat').length,damageDealt:1e9-a.e.entity.currentHp}));
const d=makeBattle(undefined,GENERIC_PHYSICAL_BASIC);
new BuffSystem(d.p.buffs).apply(BUFF_REGISTRY.get('thach_hoa'),d.e.entity,d.p.entity,BUFF_REGISTRY);
d.s.resolveActorTurn(d.b,d.p);
console.log('ON_HIT_POOL',JSON.stringify({sourcePool:d.p.buffs.getAll().map(x=>({id:x.id,targetId:x.targetId})),targetPool:d.e.buffs.getAll().map(x=>x.id),sourceStunned:new BuffSystem(d.p.buffs).isStunned(),targetStunned:new BuffSystem(d.e.buffs).isStunned()}));
const g=makeBattle(undefined,GENERIC_PHYSICAL_BASIC);
g.p.entity.currentMp=10;
for(let i=0;i<10;i++)g.s.resolveActorTurn(g.b,g.p);
console.log('REGEN',JSON.stringify({mpAfter10Turns:g.p.entity.currentMp,wardAfter10Turns:g.p.entity.currentWard,manaRegen:g.p.entity.stats.manaRegenPerSecond,wardRegen:g.p.entity.stats.wardRegenPerSecond}));
```

**C03 / C06 / C07 / C08 / C09 — final discriminating engine and authored-content probes:**

```js
const {createDefaultPlayer,playerToCombatEntity}=load('core/player/Player'),{calculateStats}=load('core/stats/StatCalculator'),{defineEnemy,enemyToCombatEntity}=load('core/enemy/Enemy'),{toTurnBattleParticipant}=load('core/game/TurnBattleAdapter'),{TurnBattleSystem}=load('core/battle/turn/TurnBattleSystem'),{CombatSystem}=load('core/combat/CombatSystem'),{EventBus}=load('core/events/EventBus'),{BUFF_REGISTRY}=load('data/buff/BuffRegistry'),{BuffSystem}=load('core/buff/BuffSystem'),{GENERIC_PHYSICAL_BASIC,KIEM_TU_BASIC,PHAP_TU_BASICS}=load('data/skill/TurnBasicAttacks'),{COMPANIONS}=load('data/companion/Companions'),{companionToCombatEntity}=load('core/companion/CompanionCombat'),{TurnReactionManager}=load('core/battle/turn/TurnReactionManager'),{SkillSystem}=load('core/skill/SkillSystem'),{SkillManager}=load('core/skill/SkillManager'),{SKILLS}=load('data/skill/Skills'),{GameManager}=load('core/game/GameManager');
Math.random=()=>.2;
const pd=createDefaultPlayer(),stats=calculateStats({...pd.baseStats,maxHp:1e9,attack:100,speed:100},[]);
const enemy=()=>enemyToCombatEntity(defineEnemy({id:'diag_dummy',name:'Dummy',level:1,realmId:'mortal',lane:'ground',statsInput:{maxHp:1e9,attack:1,attackSpeed:1,attackRangeRanks:9,criticalRate:0,criticalDamage:1.5,armor:0},rewards:{}}));
const mk=(build,basic=KIEM_TU_BASIC)=>{
  const bus=new EventBus(),p=toTurnBattleParticipant(playerToCombatEntity(pd,stats),0,basic,build),e=toTurnBattleParticipant(enemy(),1,GENERIC_PHYSICAL_BASIC);
  return {p,e,bus,b:{players:[p],enemies:[e],state:'fighting'},s:new TurnBattleSystem(new CombatSystem(bus),10000,BUFF_REGISTRY,undefined,undefined,new TurnReactionManager(bus))};
};
const c=mk('kiem_tu');
for(let i=0;i<3;i++)c.s.resolveActorTurn(c.b,c.p);
c.p.entity.currentHp=.001;
new BuffSystem(c.p.buffs).apply(BUFF_REGISTRY.get('bong'),c.e.entity,c.p.entity,BUFF_REGISTRY);
const hp0=c.e.entity.currentHp;
const result=c.s.resolveActorTurn(c.b,c.p);
console.log('DEAD_CHARGE',JSON.stringify({alive:c.p.entity.alive,hp:c.p.entity.currentHp,damageAfterDeath:hp0-c.e.entity.currentHp,targets:result.targetIds}));
const f=mk();
const d=COMPANIONS.find(x=>x.id==='thiet_y_tang'),instance={instanceId:'diag_monk',definitionId:d.id,realmId:'mortal',realmLevel:14,exp:0,constellationRank:0};
const monk=toTurnBattleParticipant(companionToCombatEntity(instance,d),0,d.basic,undefined,{special:d.special});
f.b.players=[monk];
const beforeDef=monk.entity.stats.defense;
f.s.resolveActorTurn(f.b,monk);
const immediate={defense:monk.entity.stats.defense,thorns:monk.entity.stats.thornsPercent,buffs:monk.buffs.getAll().map(x=>x.id)};
const ehp=f.e.entity.currentHp;
f.s.resolveActorTurn(f.b,f.e);
const reflected=f.e.entity.currentHp-ehp;
f.s.resolveActorTurn(f.b,monk);
console.log('AUTHORED_MONK_BUFF',JSON.stringify({beforeDef,immediate,enemyHpDeltaFromCounter:reflected,defenseNextTurn:monk.entity.stats.defense,thornsNextTurn:monk.entity.stats.thornsPercent}));
const x=mk(undefined,PHAP_TU_BASICS.fire),waterDef=COMPANIONS.find(y=>y.id==='thuy_linh_xa');
const wi={instanceId:'diag_water',definitionId:waterDef.id,realmId:'mortal',realmLevel:1,exp:0,constellationRank:0};
const water=toTurnBattleParticipant(companionToCombatEntity(wi,waterDef),1,waterDef.basic);
x.b.players.push(water);
let reactions=0;
x.bus.on('reaction',()=>reactions++);
x.s.resolveActorTurn(x.b,x.p,'basic');
x.s.resolveActorTurn(x.b,water,'basic');
const afterOne=x.e.buffs.getAll().map(y=>({id:y.id,source:y.sourceId}));
x.s.resolveActorTurn(x.b,water,'basic');
console.log('MULTISOURCE_REACTION',JSON.stringify({afterOne,reactionsAfterTwoWater:reactions,remaining:x.e.buffs.getAll().map(y=>({id:y.id,source:y.sourceId}))}));
const gm=new GameManager();
const kp=createDefaultPlayer();
kp.cultivationPath='kiem_tu';
gm.setActivePlayer(kp);
const sk=structuredClone(SKILLS.find(x=>x.id==='tram'));
sk.unlocked=true;sk.equipped=true;sk.totalExperience=10000;sk.level=3;
gm.skillManager.add(sk);
gm.startBattleWithPlayer(kp,stats,defineEnemy({id:'skill_dummy',name:'Skill Dummy',level:1,realmId:'mortal',lane:'ground',statsInput:{maxHp:1e9,attack:1,attackSpeed:1,attackRangeRanks:9,criticalRate:0,criticalDamage:1.5,armor:0},rewards:{}}));
console.log('BASIC_PROGRESS',JSON.stringify({totalExperience:sk.totalExperience,canonicalDamageValue:gm.skillSystem.getEffectiveSkill(sk).triggers[0].actions[0].value,actualBasic:gm.getTurnBattle().players[0].basic}));
const sm=new SkillManager(),ss=new SkillSystem(sm);
const ws=structuredClone(SKILLS.find(y=>y.id==='thanh_tuyen_duong_linh'));
ws.selectedSpecializationId=ws.specializations[0].id;
const {toTurnSkillDefinition}=load('core/game/SkillToTurnSkillConverter');
const converted=toTurnSkillDefinition(ws,ss.getEffectiveSkill(ws));
const v=mk();
v.p.special={skill:converted,remainingCooldownTurns:0};
v.s.resolveActorTurn(v.b,v.p);
console.log('SPECIALIZATION_DURATION',JSON.stringify({specialization:ws.selectedSpecializationId,authoredDuration:ss.getEffectiveSkill(ws).effects[0].duration,actualDuration:v.p.buffs.getAll()[0].duration}));
```

The original Vite SSR load probe succeeded for TurnBattleAdapter; the larger SSR diagnostic hit a Vite transport fetch timeout before producing behavioral results. No defect claim uses that timeout as game evidence. The successful in-memory commands above exited 0 and produced the recorded outputs. They do not certify browser bundling or Phaser.

Coordinator owns full baseline verification. At handoff the coordinator reported 545 files / 3,800 tests: 3,796 passed and four feasibility failures; all 116 architecture guard tests passed. This worker did not rerun the full suite or independently certify those counts. No assertion that existing tests catch these nine findings is made.

## Test blind spots, false-positive exclusions and retained debt

- `TurnBattleSystem.effectiveSpeed.test.ts` explicitly forces a first actor turn before measuring the buffed rate; it cannot show immediate apply-to-gauge correctness. Current stat tests primarily prove recompute arithmetic, not modifier lifecycle timing.
- Resource tests use a synthetic non-charge special and seed the ultimate pool to 100. This bypasses the only production gain route missing in C05.
- Content parity checks prove IDs/shapes and directly convert basic Skill objects; they do not establish that the game calls that converter for basics, nor preserve duration overrides.
- Passive carry tests verify stored/banked stack counts, not live combat speed/penetration. Snapshot-before-reset needs a store-shaped input, not a precomputed fixed stats fixture reused for both fights.
- `resolveActorTurn` diagnostics prove engine defects; C01 additionally exercises the production runtime clock/token path. P13/P14 real browser checks remain coordinator-owned. This worker made no visual claim.
- Counter/follow-up depth cap, source-resolved DoT application, survival guard and mandatory playback-token validation are present; old historical reports about their complete absence are not current findings.
- `SkillEffectResolver`, legacy action helpers, and the older ReactionManager are not assumed active merely because files exist. Production turn routing uses TurnBattleSystem/TurnReactionManager. Parent's static reachability report is the aggregate source for precise dead-module classification.
- Skills at old chain positions B/D are explicitly retained for future content in `data/skill/Skills.ts:18-23`; they were not counted as live missing cast behavior. `chargeTurns` intentionally bypasses hard CC according to current turn tests; this audit does not propose changing that design.
- `targetKilled` in DamageResult is calculated before Ward/survival, but no current production consumer was found, so it is not promoted to a player-facing finding.
- `getBattle()` returns a TurnBattle cast as the old Battle shape. Pill heal/buff callbacks would dereference missing `battle.player`; parent found no current authored pill of either type, so this remains a dormant API trap, not a current normal-pill crash claim.
- Natural defeat: `GameManagerBattleRewardOps.ts:89-126` marks its terminal flag but emits `battle_end` only for victory. The explicit-abandon path emits defeat and clears EnemyManager, but cannot be called once state is already defeat. Reported to coordinator for actual event/UI consequence review; no additional independent severity assigned here.
- Full mana/Ward seconds-to-turn pacing intent is not established by this audit. The shipped positive stats/buffs and absence of a live writer are established; repair must preserve or explicitly settle the intended units.
- No historical art debt was relabeled a defect. Roadmap R6 explicitly retains Pháp Tu placeholder and boss-form art debt; visual assets are outside this worker's evidence.

## Proportional G1 / domain answers and G5 handoff

| Question | Evidence answer |
|---|---|
| Q1 | Observable outcomes are real stage progression, authored skill/resource behavior, current stats/statuses, one lethal outcome and one reward. C01–C09 give falsifiable counterexamples. |
| Q2 | CombatSystem completes damage/death; EntityVitalsSystem owns HP operations; BuffSystem owns instances; TurnBattleSystem owns action outcomes. Missing integration is not a request for extra owners. |
| Q3 | TurnBattle participants own ephemeral entities/pools/gauges; SkillManager owns mutable passive stacks; PlayerData owns saved progress/carry. C01 exposes the incomplete bridge/reset contract. |
| Q4 | StageWaveSystem -> GameManagerTurnBattleOps -> factory/adapter -> clock/token/pipeline -> TurnBattleSystem -> damage/reaction/reward is traced; C01 exercises it. |
| Q5 | Existing factories, effective-stat calculator, canonical buff pool, clock, token and complete damage authority are reusable; no new universal abstraction is justified by this audit. |
| Q6 | Headless gameplay probes load without Vue/Phaser initialization. Aggregate transitive dependency cycles and old helper reachability are coordinator-owned; no claim that all dependencies are clean. |
| Q7 | Clock/token pace actions; runtime ACK handlers request the three domain phases; renderers do not calculate damage or award loot. C02 is a missing domain timing consumer. |
| Q8 | Authored BAT_KIEM_THUAT, Thạch Hóa, Thiết Y Tăng, Thủy Linh Xà, tram, and Water specialization reveal incomplete semantics. Current retired/dormant content was excluded. |
| Q9 | TurnOrderPreview clones gauge fields and reads entity state; it does not run effects or RNG. peekNextActor is a mutating engine command despite its name and is not a pure UI preview. |
| Q10 | Playback token/pending phase, boundary queue reset, per-enemy grants and terminal flags inspected. C06 demonstrates the unhandled interruption boundary: actor death during turn-start status update. |
| Q11 | Main turn engine is live; old action resolver/ReactionManager are distinct retained paths. No deletion proposed; coordinator maintains entrypoint reachability inventory. |
| Q12 | Only this Markdown report is authored by this worker. Tests/production fixes are out of scope; all findings include evidence, real caller, consequence and bounded repair direction. |
| C1–C2 | Vitals/death routes traced; post-death healing and passive/effective-state defects executed. Raw-to-resolved arithmetic itself was not found duplicated in the live recompute path. |
| C3–C4 | Actual authored skill/companion data used, source context retained for DoT; basic conversion and cross-source reaction identity gaps established. |
| C5–C7 | Holder-turn vs persistent wall time inspected; duration override and missing regen gaps remain; typed ACK contract present. No new content-ID branch or protocol change introduced. |

Suggested repair dependency order (recommendations only): (1) complete temporary-stat source/lifecycle and reset boundaries for C01/C03; (2) resolve regeneration policy and wire the existing vitals authority for C02; (3) fix source/target pool identity for C04/C08; (4) close charged action outcome/death invariants for C05/C06; (5) unify production basic resolution and preserve live specialization overrides for C07/C09. Every mission needs real-construction regression tests and runtime evidence where its callers require it.

G5: **REPORT_ONLY / NO PRODUCTION CHANGES**. File changed: `game/docs/qa/2026-09-14-audit-combat-review.md`. No commit/merge/push. Remaining limitations: no independent browser run, no complete statistical balance study, no exact introduction-commit attribution; diagnostic factories use controlled HP/stats for deterministic boundaries. Historical comments remain untouched. No `any` or production API was introduced. Final report consistency check: nine finding sections, 29 full source/document path references exist and their stated line endpoints are in range; `git diff --stat` is empty (the report is a new untracked Markdown file).
