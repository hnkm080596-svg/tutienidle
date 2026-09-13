# Lifecycle, presentation and persistence audit

Date: 2026-09-14. Baseline: `f2846064a4b15d4d20a94540855b6194b77eb21c`.
Worktree: `E:/tutienidle/.agent-worktrees/full-project-audit-2026-09-14`.
Branch: `codex/full-project-audit-2026-09-14`.
Task card: [full-project audit](2026-09-14-full-project-audit-task-card.md).

Audit only: no production, configuration or test edits, no commit, no account/network calls. This worker changed only this report. `using-superpowers` explicitly exempts dispatched workers; `code-review` was read and used. The requested memory registry did not exist at its supplied path; no memory-derived assertion is used. Roadmap R5/R8/R10/R12, the coordinator specification, current coordinator/R10 QA reports and actual production callers were compared. Prior QA pass claims are historical evidence, not this audit's execution results.

## G0/G1 conclusion

There is already a central route and transition owner: `GamePresentationCoordinator`. A second general Scene Manager would duplicate authority. The current defects are incomplete contracts between existing owners, not absence of an orchestrator. The strongest findings are a partially implemented save-value boundary, lost session identity in admitted transitions, and an incorrect terminal transition in tribulation. These were reproduced against current modules without changing their source.

Evidence vocabulary: **EXECUTED** means the in-memory diagnostic ran here; **SOURCE** means the current production path establishes the behavior; **INFERRED** is explicitly limited; **SPEC DRIFT** compares maintained claims with current source. Browser/build/full-suite execution belongs to the parent coordinator; this report does not claim those gates passed.

## Authority and lifecycle map

| Responsibility | Actual authority and production path | Lifecycle / persistence |
|---|---|---|
| Application construction | `main.ts` creates Vue/Pinia/router/i18n, installs global Vue error handler, mounts `App.vue`. `App.vue:117-195` constructs GameClock, GameManager, presentation adapters/coordinator and provides bridges. | App-level instances live until root unmount. App registers the actual content registries at `267-288`. |
| Entry and auth | `App.vue:600-605` starts a three-second intro; `useBootFlow` derives entry stage from coordinator routes. `AuthEntryScreen.authenticate` calls auth service then emits authenticated; App calls boot. | Mock or Supabase auth is selected by AuthServiceFactory; it is separate from save ownership. No actual Phaser AuthScene is registered or implemented. |
| Character creation | CharacterCreationScreen validates a draft, rolls through CharacterCreationService, and emits a payload. `App.vue:579-598` writes initial player fields, calls new-character boot, and saves locally. | Starter grant/production activation is in `App.vue:520-557`. Character service result ID is not a local save identity. Supabase schema drift is L05. |
| Boot / world clock | `useAppLifecycle.bootGame:191-276`: load -> classify -> restore or initialize -> clock.start -> one interval -> request Home. `App.vue:395-489` owns actual one-second world update callback. | Duplicate concurrent boot is blocked by a boolean. stopAll removes listeners/intervals but does not invalidate pending boot: L04. |
| Combat clock | App chooses `MainProcessClockSource` in Electron or `RafClockSource` on web (`134-137`); GameManagerTurnBattleOps owns CombatClock and fixed-step execution. | Separate from the world interval. Visibility pause has a document listener removed by disposeCombatPause. Root unmount has no explicit combat-clock disposal; see notes. |
| Route admission and transition | `createGamePresentation.runAdmitted` reserves synchronously, checks canEnter, runs domain command behind curtain; coordinator sequences hold/close/assets/deactivate/prepare/attach/open/release. | Per-transition AbortController/deadlines; same in-flight target/session dedupes; conflicting requests reject; failed sessions stay held. Lost returned session is L03. |
| Vue route projection | VueRouteAdapter projects readonly coordinator state; CompositeRenderer awaits mounted RouteMount evidence plus Phaser READY where required. useBootFlow promotes host mounting after curtain close. | RouteMount mount/unmount signals; coordinator subscription disposal. Independent Vue Router infrastructure is installed at entry but game route authority is coordinator. |
| Phaser primary activation | `PhaserSceneAdapter`: Home -> MainScene, combat -> CombatScene, tribulation -> TribulationScene. | One primary active scene tracked; stop previous before start; CombatScene same-route rebind. Waiter registered before scene.start. Game-generation change rejects old waiter. |
| Phaser host | `PhaserCanvas.vue` -> `useDynamicRegion`, dynamically imports Phaser + four primary-host scene classes, seeds registry, waits for nonzero measured container, publishes host. | ResizeObserver, seed cleanup, generation invalidation, Phaser.Game destruction. Formation preview is a separate dynamic region, not an alternate primary router. |
| Resources | AssetBundleCatalog describes route bundles; AssetBundleManager ensures/dedupes resources; AssetLoaderScene serializes actual Phaser loads and verifies cache. DOM images use Image/decode. | Global Phaser cache lasts with game host; resource keys cached in manager; no per-route eviction policy. Consumers retain scene preload fallbacks. |
| Tribulation | GameManager.startTribulation delegates to TribulationDirector. Director owns chapters, ghost entity/vitals, snapshot HP/defense, question/tank timers, presentation session and cooldown. | Interactive hold blocks update/answer. `getState()` returns mutable active object and also writes its hp field. `clear()` ends session and drops state. Runtime is ephemeral, no save slice. |
| Tribulation consequences | `App.tick -> checkTribulationOutcomeAction -> TribulationOutcomeService` writes realm/foundation/talents/penalties; adapter displays announcement and clears Director. | Consequence command currently waits inside a curtain callback, and service has no one-use outcome identity. Domain logic was moved, execution remains presentation-gated; see notes. |
| Save value | `player.save -> buildGameSave -> cloudSaveCoordinator.save -> LocalCloudSaveService -> writeGameSave`. | Player/quest/decompose snapshots detached; several manager slices alias live objects. L01. |
| Restore | `loadGame` checks exact version and shape; `restoreGameSession` registry preflight -> Pinia restore -> active player -> manager restore -> equipment modifiers. | Registry preflight precedes mutation; identity gate and replacement incomplete, L01. No general rollback transaction. |
| Local revision | CloudSaveCoordinator tracks revision, retries once after conflict, intentionally last-writer-wins. LocalCloudSaveService writes revision then payload, attempts rollback on write failure. | Local-only capability is explicit and factory-enforced. Two localStorage keys are not atomic across tabs. No deployed remote capability was tested. |

### Actual Phaser scene inventory

| Scene | Construction/readiness/loading | Cleanup |
|---|---|---|
| AssetLoaderScene | First in PhaserCanvas scene config. create registers itself with bundle manager. Primary scenes stay dormant until adapter starts one. loadDescriptors serializes batches; FILE_LOAD_ERROR and post-COMPLETE texture existence determine success. | Loader listeners are removed when each batch settles/aborts. Host teardown calls setLoaderScene(null). No independent shutdown cancellation of an unresolved physical batch was found. |
| MainScene | preload empty (`146-148`); create reads profile gate, builds sprite/layout, subscribes, reports READY (`158-189`). Assets arrive via Home bundle. | shutdown unsubscribes profile listener and resize and clears references (`123-133`, `283-298`). |
| CombatScene | Transitional `queueCombatAssets` in preload (`689-696`); create builds visuals, subscribes, attempts session snapshot, reports READY (`795-822`). Same-route `rebindSession:1902-1920`. Runtime art change can also load backdrop directly (`2083-2101`). | shutdown (`833-837`) removes resize/event bindings and clears visual resources/maps. Shared binding enumeration supplies on/off (`1469-1492`); Phaser owns scene child/tween teardown. |
| TribulationScene | Own fallback cultivate multiatlas + ink atlas preload (`57-61`); creates ceremony visual, subscribes lightning/damage/vitals, reports READY (`64-109`). | shutdown removes resize and all three event-bus handlers (`35-39`, `136-139`). Resize only resizes frame; other visuals retain original positions. |
| TranPhapCombatPreviewScene | Separate preview host via useDynamicRegion; preloads placeholder atlas and profile images (`129-141`); subscribes region assignment event (`144-155`). | Removes assignment handler on shutdown; dynamic region destroys independent game when preview closes. It does not need primary-route ownership. |

No AuthScene exists in the current scene inventory. Historical comments in PhaserCanvas/MainScene/CombatScene saying MainScene starts CombatScene on battle_start are stale; executable calls now belong to adapter.

## Findings (confidence at least 80)

### AUD-L01 — P1 — Save boundary is partial: omitted identity slices, aliased snapshots, nonreplacement restore

**Confidence 100. Evidence EXECUTED + SOURCE + SPEC DRIFT.** These are separate proof obligations under one incomplete snapshot/restore boundary; fixing only the fingerprint will not repair replacement or aliasing.

- **Identity omission:** `game/src/services/save/saveTypes.ts:212-217` serializes only version, player without timestamp, materials and quests. Equipment, skills, techniques, pills, buildings, equipmentSlots, productionSites, alchemyJobs and decompose do not participate. `stores/player.ts:347-351` and `core/game/GameManagerSaveRestore.ts:153-156` therefore skip a payload changed solely in those slices. Roadmap R10 and comments claim whole-payload identity.
- **Snapshot aliasing:** `services/save/SaveSystem.ts:319-321,329,342,346-358` uses shallow manager getters. `SkillManager.ts:23-24`, `TechniqueManager.ts:18-19`, `EquipmentBag.ts:140-141`, `BuildingManager.ts:28-29`, `ProductionSystem.ts:119-120` and `AlchemySystem.ts:182-183` retain nested/live object identities. Updating live skill level after build changed the saved level from 1 to 11. This also lets a snapshot consumer mutate live state. Player/quests/decompose detachment does not cover the remaining slices.
- **Replacement omission:** `GameManagerSaveRestore.ts:161-179` retains existing skills/techniques and skips saved replacements with same IDs. `257-261` adds equipment without removing absent instances; EquipmentBag.add (`40-48`) keeps first same-ID object. Only materials/pills are cleared (`220-221`). Changing player.name to bypass identity then restoring an empty skills array left one live skill. Player restore uses Object.assign (`stores/player.ts:375`) without reset of optional absent fields; this is additional source-level replacement debt.
- **Input aliasing:** manager restore mutates passed technique/skill objects (`169-170,192-208`) and adds them by reference (`173,211`); equipment/buildings/jobs likewise retain input objects. A detached input contract is not satisfied globally even though player restore clones.

**Owner / root cause:** SaveSystem and GameManagerSaveRestore should jointly define one complete serialized value and session replacement contract. The R10 repair protects selected slices rather than every actual manager consumer.

**Consequence:** valid save changes silently ignored on repeated restore; stale inventory/learned state retained; captured snapshots change before a conflict retry or later serialization. Local save writes are synchronous in the first attempt, so snapshot aliasing alone is not a claim that every autosave loses data. It is a proven contract failure, with asynchronous conflict retry and public snapshot use as real exposure paths.

**Repair direction:** enumerate every GameSave slice in identity (explicitly preserving any intended timestamp exclusion); detach all slice values at the save boundary; replace all corresponding managers and reset transient operations through their owners; validate the complete candidate before committing identity. Add real-manager per-slice mutation/replacement matrices. Existing tests are too narrow: snapshotIsolation's manager test only mutates quests; restoreIdentity tests player/materials; replacement tests only material/pill bags. Coordinate pending wash/refine ticket invalidation with the economy report.

### AUD-L02 — P1 — Lethal final tribulation strike becomes victory

**Confidence 100. Evidence EXECUTED + SOURCE.** `game/src/core/tribulation/TribulationDirector.ts:388-407` applies a strike, then advances the chapter whenever timer is zero. `applyLightningDamage:454-457` sets defeat and emits defeat. `enterChapter:464-471` unconditionally sets victory when the final chapter ends, even after that defeat.

**Executed input:** real foundation_establishment chapter definitions, createDefaultPlayer in qi_refining, calculateStats with defense set to **105**, correctly answer each current mind question, advance **0.1s** until terminal. Output: `{defense:105,outcomes:["defeat","victory"],state:"victory",hp:0,chapterIndex:2}`. No private fields or authored chapter data were mutated. Correct mind answers came from the public current-question contract for the diagnostic.

**Owner / consequence:** TribulationDirector must commit exactly one terminal outcome. The caller sees final victory and invokes victory consequences for a dead player; emitted observers receive contradictory facts. This can grant foundation/realm/talent rewards and bypass defeat penalties.

**Repair direction:** enforce terminal state and survival before advancing chapter, ideally through a single terminal transition command that cannot replace an already committed outcome. Keep complete vitals/outcome event assertions; test lethal ordinary strike and lethal finalStrike at chapter boundary with actual authored chapters. Existing survival/defeat tests miss the last-strike boundary.

### AUD-L03 — P1 — Admitted session identity is lost between command, coordinator and renderer

**Confidence 100. Evidence EXECUTED + SOURCE + SPEC DRIFT.** `createGamePresentation.ts:124-148` receives the command's RouteRequest but converts it to boolean plus behindCurtain. `GamePresentationCoordinator.ts:337-348` reconstructs the session from unscoped `sessionPort.getCurrentSession()`. The GameManager port (`GameManager.ts:972-990`) prefers a retained combat session before tribulation. The coordinator then passes the **original** sessionless request to renderer.prepare (`397-402`) instead of its adopted session.

**Proof A — real retained combat:** real `mortal_dong_1` from STAGES, real enemy/skill/content registration and ManualClockSource reached victory with combat session 1. With route Home (the normal terminal dismissal state), runAdmitted started a real tribulation session 2 and the command returned that kind-scoped session. Transition failed with `Domain command produced no session for the target route`; retry rejected. Both sessions remained. `useTribulation.ts:44-46` allows terminal battle, and `74-75` correctly reads kind-scoped; that correctness is discarded downstream. App's failed-tribulation Back guard (`221-238`) prohibits leaving while the created tribulation session exists, making the failure a soft lock until reload.

**Proof B — normal entry:** real GameManager/director/coordinator/runAdmitted with successful rendering ports returned entered; renderer request had no session while coordinator committed tribulation session 1. `PhaserSceneAdapter.ts:136-157` therefore sends undefined sessionId on start/rebind. CombatScene's explicit session snapshot path (`798-808`, `1910-1914`) is bypassed. READY currently permits missing session/gameGeneration (`PhaserSceneAdapter.ts:93-105`), so it cannot detect this missing contract.

**Owner / root cause:** admission/coordinator handoff needs the accepted typed request, not a boolean plus a second query. The unscoped port was adequate only while one domain session existed. Terminal combat and new tribulation are intentionally allowed to overlap.

**Repair direction:** preserve/adopt the exact accepted session once, verify its kind/current identity, pass it to asset/renderer preparation and retry. Do not clear an unrelated terminal battle as a workaround. Make scene READY require the applicable identity. Test full real-manager terminal-dismissal -> tribulation flow and assert prepare's session matches adopted session. Integration mocks with no retained combat and fake scene READY conceal both failures.

### AUD-L04 — P2 — Pending boot can restore state and restart intervals after teardown

**Confidence 100. Evidence EXECUTED + SOURCE.** `useAppLifecycle.ts:205-207` awaits load, then continues through restore (`232-254`) and clock/interval/route start (`257-270`) without a stopped or generation check. `stopAll:316-335` removes current listeners/timers but does not invalidate bootInFlight or pending continuation. The stopped boolean is used only to suppress repeated unsubscribe.

**Executed:** deferred load -> call real stopAll -> resolve load status ok. Output `{intervals:1,restores:1,entries:1,handle:1}` after teardown. Diagnostic injected external dependencies and explicitly called stopAll; it was not a mounted browser test. Vue's no-active-instance warning only concerns automatic hook registration in this direct invocation, not the executed stopAll path.

**Owner / consequence:** useAppLifecycle owns boot lifetime, not the cloud service. Root HMR/unmount or reset while boot awaits can allow a disposed App's continuation to restore/write shared player state, start a leaked world tick and invoke App post-boot work. Actual local adapter resolves quickly, reducing the race window; a slow remote adapter is not required to establish the public lifecycle defect and is not claimed to exist.

**Repair direction:** generation/disposed fence spanning all awaited boot work; explicit terminal teardown; reject stale post-boot callbacks. Test stop/unmount during load and during save, then resolve old work and assert no restore/start/route/listener. Current tests cover concurrent boot and cleanup separately, not their composition.

### AUD-L05 — P1 (configured remote mode) — Tracked server character schema rejects the current one-talent client

**Confidence 100 on repository contract mismatch; deployment status unknown. Evidence SOURCE + SPEC DRIFT.** `services/character/CharacterCreationService.ts:7,45-52` requires exactly one selected talent; CharacterCreationScreen.toggleTalent selects a singleton (`39-44`). `game/supabase/migrations/202608240001_online_auth_character.sql:54` requires cardinality 3, and create_character also requires three selections (`148-154`). Only this migration was found. SupabaseCharacterCreationService sends the current one-talent draft to this RPC (`58-72`) and reports generic unavailable on non-409 failure (`75-79`).

**Owner / consequence:** tracked client/server capability must agree before remote mode is considered usable. Deploying this migration with the current configured client prevents normal character creation. This audit did not read config secrets, connect to Supabase or establish which schema is deployed; local mock onboarding is unaffected.

**Repair direction:** update server validation/schema and seed content in the same remote capability mission; verify a real one-talent draft against a local disposable database and the server RPC. Remote save remains a separate unimplemented capability: factory always creates LocalCloudSaveService, character RPC sends `p_initial_save: {}`, and no load/write remote save adapter is wired. Tables/interface names are not proof of account-bound persistence.

## Transition and resource decision

**Another central Scene Manager is unnecessary.** Keep coordinator as route/admission/error/phase owner, adapter as Phaser lifecycle owner, AssetBundleManager as resource mechanism, and destination scenes as rendering/resource consumers. The missing primitive is an explicit accepted-session handoff and a complete resource/host readiness lifecycle, not a new manager that decides routes again.

**Destination-driven resource requirements are appropriate and partly present.** Current getBundlesForRoute maps boot/auth/character/error to no Phaser bundles, Home to core-ui/home, combat to core-ui/combat, tribulation to core-ui/tribulation. Coordinator ensures destination resources behind curtain **before** deactivating the prior renderer. That is preferable to giving each primary scene an independent loading/error router. MainScene now depends on ensured bundles. CombatScene and TribulationScene still have preload fallback calls; preview has a separate host/cache and owns its preload.

To make the destination contract complete: carry exact destination/session requirements through admitted start; validate actual atlas frames/animations rather than texture-key existence alone; unify fallback and bundle enumeration before retiring proven preload paths; provide recoverable host bootstrap; fence resource cache publication by host generation; explicitly decide cache retention/eviction only when actual memory measurements justify it. Current bundles load all player profiles and a whole combat art batch, not a minimal per-encounter list. More granular bundles increase manifest/query/retry/cache testing cost and are not justified merely by scene count. No new architecture implementation is authorized by this audit.

## Lower-priority source notes and retained debt

1. **Outcome execution still waits for visual success.** `useTribulation.ts:149-176` invokes permanent TribulationOutcomeService writes and Director.clear only inside behindCurtain, which coordinator invokes after successful curtain.close (`314-328`). If curtain never closes, terminal outcome remains pending; reloading loses that ephemeral outcome. Domain formulas are extracted, but P17/A7 execution independence is not achieved. Roadmap R12 expressly moved all visible-effect domain work behind curtain, conflicting with P17's visual-completion restriction. Repair should commit a domain-owned one-use outcome and let presentation consume it. This source-established boundary concern is separated from the deterministic lethal-outcome defect and from product decisions about pacing.
2. **Host bootstrap retry gap.** PhaserCanvas invokes region.start only onMounted (`204`). useDynamicRegion import/construct failure tears down and records local error (`158-181`). useBootFlow keeps the failed game-route host mounted (`53-61`), while coordinator.retry only reruns transition. No restart hook is wired, so a failed host import appears to leave Retry waiting for a loader that will not restart. This is SOURCE/INFERRED; no browser chunk-failure interception was executed by this worker. Ordinary asset-load failure retry is a different, implemented path.
3. **RAF stop residue.** Executed a RafClockSource callback that invokes its own stop: one RAF remains scheduled afterward. `RafClockSource.ts:43-44` rearms after `onFrame`, even when stop ran from that callback (`51-57`). Terminal combat calls stop from its clock callback. This establishes a residual loop, not a refight freeze: same clock's stopped guard rejects advancement, and startStage performs stop/start. Root App unmount (`608-637`) also stops the world clock but has no explicit disposal for combatClockSource/GameManager; Electron event subscriptions in useElectronBridge have no returned unsubscribe. Long-session/HMR lifecycle needs a coherent disposal contract.
4. AssetBundleManager clears cache/maps on loader replacement (`100-105`) but old physical load continuations can still publish loadedResources (`241-246`, `270-279`) without generation checks; dispose clears pending resolver sets without rejecting signal-less prefetch. No current host-replacement race was executed; record as S4/S5 gap, not a proven user-visible failure.
5. Save restore is not atomic after registry preflight. Both player and manager record last-applied identity before completing mutation (`player.ts:362`, `GameManagerSaveRestore.ts:159`); unexpected downstream throw can leave partial state and suppress retry. Import/reset backup writes also throw on quota (`SaveSystem.ts:499-504,612-614`) despite boolean import result. These need failure-injection coverage; no additional regression was claimed from these paths here.
6. Tribulation cooldown/active state and persistent buff instances have no explicit save slice. Injury/cooldown persistence across reload needs characterization before specifying a repair. getState exposes mutable active state; domain outcome service lacks identity/once-only guard, so caller clear presently supplies repeat protection.
7. Current adapter's optional session/gameGeneration checks accept partial READY. Actual primary scene callbacks omit gameGeneration; transitionId still rejects ordinary stale callbacks. This is not proof that every stale scene ACK succeeds. L03 proves a real missing session path.

## Executed diagnostic evidence and reproduction

No new test files were created. Each script was passed as a PowerShell single-quoted here-string to `node --input-type=module -e $auditScript` from the worktree's `game/`. This runs current source through Vite SSR without app config/env loading or a listening web server. The first diagnostic emitted a harmless default HMR port-in-use warning and still exited 0; subsequent scripts set hmr:false. The snippets below preserve the executed setup and assertions; resource logging and loop outputs are the observed evidence.

Shared wrapper for the snippets:

```js
import { createServer } from 'vite';
const server = await createServer({
  configFile: false, envFile: false,
  resolve: { alias: { '@': process.cwd() + '/src' } },
  server: { middlewareMode: true, hmr: false, watch: { ignored: ['**/*'] } },
  appType: 'custom', logLevel: 'error',
});
const load = p => server.ssrLoadModule('/src/' + p);
try {
  // Insert one diagnostic body below.
} finally { await server.close(); }
```

L01 and L02 body:

```js
const { GameManager } = await load('core/game/GameManager.ts');
const { createDefaultPlayer } = await load('core/player/Player.ts');
const { buildGameSave, computeRestoreIdentity } = await load('services/save/SaveSystem.ts');
const { SKILLS } = await load('data/skill/Skills.ts');
const { equipment } = await load('data/equipment/equipment.ts');
const { affixes } = await load('data/equipment/affixes.ts');
const { buildings } = await load('data/building/buildings.ts');
const gm = new GameManager(), player = createDefaultPlayer();
gm.catalogOps.registerEquipment(equipment);
gm.catalogOps.registerAffixes(affixes);
gm.catalogOps.registerBuildings(buildings);
gm.catalogOps.registerSkillTemplates(SKILLS);
gm.setActivePlayer(player);
gm.skillManager.add(structuredClone(SKILLS[0]));
gm.buildingManager.add({ instanceId:'audit-building', buildingId:buildings[0].id,
  level:1, lastCollectedAt:0 });
const a = buildGameSave(player, gm), b = structuredClone(a);
b.pills.push({ pillId:'audit-only', amount:1 }); // identity-only, not restored
console.log('IDENTITY_PILLS_ONLY', computeRestoreIdentity(a) === computeRestoreIdentity(b));
const before = a.skills[0].level;
gm.skillManager.get(SKILLS[0].id).level = before + 10;
console.log('SNAPSHOT_ALIAS_SKILL', JSON.stringify({ before,
  snapshotAfterLiveMutation:a.skills[0].level,
  sameReference:a.skills[0] === gm.skillManager.get(SKILLS[0].id) }));
const s = buildGameSave(player, gm); s.player.name = 'restore-A';
gm.saveOps.restoreFromSave(s);
const t = structuredClone(s); t.player.name = 'restore-B'; t.skills = [];
gm.saveOps.restoreFromSave(t);
console.log('RESTORE_EMPTY_SKILLS', JSON.stringify({
  payloadSkills:t.skills.length, liveSkills:gm.skillManager.getAll().length }));
const { TribulationDirector } = await load('core/tribulation/TribulationDirector.ts');
const { EventBus } = await load('core/events/EventBus.ts');
const { calculateStats } = await load('core/stats/StatCalculator.ts');
let found = null;
for (let defense = 0; defense <= 2000 && !found; defense++) {
  const bus = new EventBus(), outcomes = [];
  bus.on('tribulation_outcome', e => outcomes.push(e.state));
  const d = new TribulationDirector({ eventBus:bus }), p = createDefaultPlayer();
  p.realmId = 'qi_refining';
  const stats = calculateStats(p.baseStats, []); stats.defense = defense;
  d.start(p, stats, false, 'foundation_establishment');
  for (let n=0; n<1000 && d.getState()?.state === 'ongoing'; n++) {
    const state = d.getState();
    if (state.currentQuestion) d.answerQuestion(state.currentQuestion.correctAnswerIndex);
    d.update(0.1);
  }
  const state = d.getState();
  if (outcomes.includes('defeat') && outcomes.includes('victory')) {
    found = { defense, outcomes, state:state.state, hp:state.hp, chapterIndex:state.chapterIndex };
  }
}
console.log('TRIBULATION_LETHAL_END', JSON.stringify(found));
```

Observed stdout, exit 0:

```text
IDENTITY_PILLS_ONLY true
SNAPSHOT_ALIAS_SKILL {"before":1,"snapshotAfterLiveMutation":11,"sameReference":true}
RESTORE_EMPTY_SKILLS {"payloadSkills":0,"liveSkills":1}
TRIBULATION_LETHAL_END {"defense":105,"outcomes":["defeat","victory"],"state":"victory","hp":0,"chapterIndex":2}
```

L03 retained-session body:

```js
const { GameManager } = await load('core/game/GameManager.ts');
const { createDefaultPlayer } = await load('core/player/Player.ts');
const { calculateStats } = await load('core/stats/StatCalculator.ts');
const { ManualClockSource } = await load('core/battle/turn/CombatClock.ts');
const gm = new GameManager(), source = new ManualClockSource(), p = createDefaultPlayer();
gm.setCombatClockSource(source); gm.setActivePlayer(p);
const stats = calculateStats({ ...p.baseStats, attack:1000000, speed:100 }, []);
for (const [file,key,method] of [
  ['data/enemy/Enemies.ts','ENEMIES','registerEnemyTemplates'],
  ['data/stage/Stages.ts','STAGES','registerStages'],
  ['data/materials/materials.ts','materials','registerMaterials'],
  ['data/skill/Skills.ts','SKILLS','registerSkillTemplates'],
  ['data/buff/buffs.ts','buffs','registerBuffs'],
  ['data/equipment/equipment.ts','equipment','registerEquipment'],
  ['data/equipment/affixes.ts','affixes','registerAffixes'],
]) gm.catalogOps[method]((await load(file))[key]);
gm.progressionOps.learnSkill('tram'); gm.progressionOps.setSkillLoadoutSlot(p,0,'tram');
const { STAGES } = await load('data/stage/Stages.ts');
const stage = STAGES.find(s => s.id === 'mortal_forest') ?? STAGES.find(s => s.id.startsWith('mortal'));
const started = gm.turnBattleOps.startStage(p,stats,stage,false);
for (let n=0; n<10000 && !['victory','defeat'].includes(gm.getBattle()?.state); n++) source.advance(0.1);
console.log('TERMINAL', JSON.stringify({ started, stage:stage.id,
  state:gm.getBattle()?.state, session:gm.getCurrentPresentationSession('combat') }));
gm.setPresentationMode('interactive');
const { GamePresentationCoordinator } = await load('presentation/GamePresentationCoordinator.ts');
const { createGamePresentation } = await load('presentation/createGamePresentation.ts');
const coordinator = new GamePresentationCoordinator({
  sessionPort:gm.getPresentationPort(), initialRoute:'home',
  renderer:{ prepare:async()=>{}, deactivate:async()=>{} },
  assets:{ ensureFor:async()=>{} }, curtain:{ close:async()=>{}, open:async()=>{} },
});
const pres = createGamePresentation({ coordinator, eventBus:gm.eventBus });
const result = await pres.runAdmitted('tribulation', () => {
  const ok = gm.tribulationDirector.start(p,stats,false,'qi_refining');
  const session = gm.getCurrentPresentationSession('tribulation');
  return ok && session ? { target:'tribulation',session } : null;
});
console.log('COLLISION', JSON.stringify({ result, error:coordinator.getSnapshot().error,
  combat:gm.getCurrentPresentationSession('combat'),
  tribulation:gm.getCurrentPresentationSession('tribulation'), retry:await coordinator.retry() }));
pres.dispose();
```

Observed stdout, exit 0:

```text
TERMINAL {"started":true,"stage":"mortal_dong_1","state":"victory","session":{"kind":"combat","sessionId":1}}
COLLISION {"result":{"status":"failed","transitionId":1},"error":{"message":"Domain command produced no session for the target route","failedRequest":{"target":"tribulation"},"availableRenderer":"home"},"combat":{"kind":"combat","sessionId":1},"tribulation":{"kind":"tribulation","sessionId":2},"retry":{"status":"rejected","transitionId":1}}
```

L03 normal handoff and L04 teardown body:

```js
const { GameManager } = await load('core/game/GameManager.ts');
const { createDefaultPlayer } = await load('core/player/Player.ts');
const { calculateStats } = await load('core/stats/StatCalculator.ts');
const { GamePresentationCoordinator } = await load('presentation/GamePresentationCoordinator.ts');
const { createGamePresentation } = await load('presentation/createGamePresentation.ts');
const gm = new GameManager(), p = createDefaultPlayer(), stats = calculateStats(p.baseStats,[]);
gm.setPresentationMode('interactive'); let prepared;
const co = new GamePresentationCoordinator({
  sessionPort:gm.getPresentationPort(), initialRoute:'home', assets:{ensureFor:async()=>{}},
  curtain:{close:async()=>{},open:async()=>{}},
  renderer:{prepare:async r=>{prepared=r},deactivate:async()=>{}},
});
const pr = createGamePresentation({coordinator:co,eventBus:gm.eventBus});
const result = await pr.runAdmitted('tribulation',()=>{
  if (!gm.tribulationDirector.start(p,stats,false,'qi_refining')) return null;
  return {target:'tribulation',session:gm.getCurrentPresentationSession('tribulation')};
});
console.log('ADMITTED_RENDERER_SESSION',JSON.stringify({result,
  rendererHasSession:'session' in prepared,coordinatorSession:co.getSnapshot().currentSession}));
pr.dispose();
const {useAppLifecycle} = await load('composables/useAppLifecycle.ts');
let resolve, intervals=0, restores=0, entries=0;
const lc = useAppLifecycle({
  clock:{start(){},stop(){},nowSeconds:()=>0},
  scheduleInterval:()=>++intervals,clearHandle(){},addEventListener(){},removeEventListener(){},
  boot:{startSaveLoad(){},startInitializing(){},enterGame(){entries++},fail(){},requireCharacter(){},showAuth(){}},
  coordinator:{load:()=>new Promise(r=>resolve=r),reset(){},save:async()=>({status:'ok'})},
  player:{$state:{},save:async()=>{}},gameManager:gm,tick(){},offlineSummary:{show(){}},
  saveIssue:{report(){}},entryStage:{value:'auth'},
  restoreGameSession:()=>{restores++;return {status:'ok'}},persistPlayer:async()=>{},onError(){},
});
const boot=lc.bootGame({createNewCharacter:false});
lc.stopAll(); resolve({status:'ok',save:{}}); await boot;
console.log('BOOT_COMPLETES_AFTER_STOP',JSON.stringify({intervals,restores,entries,handle:lc.getTickHandle()}));
lc.stopAll();
```

Observed stdout, exit 0 (with the disclosed Vue hook warning):

```text
ADMITTED_RENDERER_SESSION {"result":{"status":"entered","transitionId":1},"rendererHasSession":false,"coordinatorSession":{"kind":"tribulation","sessionId":1}}
BOOT_COMPLETES_AFTER_STOP {"intervals":1,"restores":1,"entries":1,"handle":1}
```

The RAF note can be reproduced in the same wrapper by loading RafClockSource, injecting requestAnimationFrame/cancelAnimationFrame backed by a Map, calling start(() => source.stop()), invoking queued callbacks at 0 and 16ms, then observing Map.size === 1. Cleanup source.stop removes the final frame.

## Coverage and G5 handoff

| Question / module | Evidence assessment |
|---|---|
| Q1/Q2 observable invariant and owner | GAP: L01 save value/replacement, L02 exactly one terminal outcome, L03 exact accepted session; owner paths identified above. |
| Q3 state lifecycle | Mapped for App/coordinator/host/director/save/revision; optional player fields, ephemeral injuries/cooldowns and failure rollback remain gaps. |
| Q4 actual production chain | SOURCE App entry/callback/registry chain; EXECUTED actual GM/content for lethal and retained battle; no private-state writes used. |
| Q5 existing primitives | PresentationSession, coordinator, adapters, bundle catalog, save shape/preflight and manager APIs already exist. No new generic manager needed. |
| Q6 dependency direction | Core SaveRestore depends on services/save/saveTypes; outcome service sequences GameManager owners. Broader transitive/AST dependency audit assigned to parent. |
| Q7 timing/gameplay/presentation | Combat clock/world clock separated; tribulation consequence execution remains behind visual close. |
| Q8 consumer parity | GAP: runAdmitted loses session; restore/snapshot omit manager semantics; configured remote creation diverges from SQL. |
| Q9 observational queries | getCombatPresentationSnapshot is an explicit query; TribulationDirector.getState mutates active.hp and returns live state. |
| Q10 stale/duplicate/failure | EXECUTED stop/late-load failure, retained-session collision and conflicting terminal events; source cleanup observations above. |
| Q11 alternate paths | Local-only save live; Supabase auth/character conditional; remote save unwired; scene preload fallbacks live/transitional; old MainScene route comments stale. |
| Q12 scope and stop condition | Only report written; no repairs. Current findings/repros/maps complete; parent owns aggregate verification. |
| S1/S2/S3 | GAP: L01; positive version/shape + registry preflight, but no complete transaction. |
| S4/S5 | GAP: L04 plus resource/clock disposal notes. |
| S6 | Current schema only; no backward migration proposed. |
| L2/L3/L4 | GAP: terminal outcome corruption and presentation-triggered commit; source App tick wiring traced. Parent E2E required for real progression. |
| U3/U4 | Catalog and bundle owner present; exact session and host/cache lifecycle incomplete. |
| U1/U2/U5/U6 | No UI implementation in this worker; style/interaction/layout and visual verification assigned to parent. Source scene resize note is not browser proof. |

Review verdict: **Request changes for L01-L04 before architecture completion claims; L05 blocks configured remote-character readiness until client/schema parity is established.** This is an audit verdict, not authorization to implement. P4 feature/fix QA verdict is N/A because nothing was implemented. P3 full tests/build and P13/P14 runtime verification are parent-owned and not duplicated. G2/G3 implementation gates are N/A. No known task-caused regression or introduced `any` exists: production diff is unchanged by this worker.

Suggested dependency order: complete save boundary characterization/ownership (L01); preserve session handoff before resource/readiness refinements (L03); repair tribulation terminal command and then one-use outcome execution (L02 plus note 1); fence application/clock/host teardown (L04 plus notes); implement/verify remote onboarding and persistence as an explicit separate capability mission (L05). Existing debts unrelated to those boundaries remain out of scope.
