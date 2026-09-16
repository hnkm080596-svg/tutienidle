# Cultivation Path — Current-State Authority Inventory (M0)

Baseline SHA: `1302f07fe792d8c1a3701a6c95ae6bdc678078db` (worktree `cultivation-path-framework`).
Compiled from 5 parallel inventory slices. All paths under `game/src`.

## Verified corrections vs spec §2 / plan

1. **`getCultivationPathKit`, `getCultivationPathRealmRewards`, `hiddenUntilEligible` DO NOT EXIST.** Kit access is direct `CULTIVATION_PATH_KITS[id]` indexing — unguarded at `CultivationPathSystem.ts:203,216`, `kiemBarBridge.ts:98`, `ArtifactPanel.vue:47` (TypeError on unknown path). Hidden paths are simply omitted from `getOfferableCultivationPaths`.
2. **Two asymmetric "Lv3" mirrors:** `isPhapTuAnEligible` reads `skillCastCounts['linh_bao']` vs `CAST_LEVELING_THRESHOLDS` (10000 casts); `the_tu_an` offerGate reads `skillLevels` via `requiresSkillLevel`. The `kiem_tu_an` node gate (`skillCastCount level:3`) reads `skillLevels` → ngu way gate = `requiresSkillLevel {tram, 3}` (exact port).
3. **`phap_tu_an` has NO node subtree** — `PHAP_TU_AN_NODES: ProgressionNode[] = []` (empty stub); its reserved `da_phap` branchTag sits in `HIDDEN_BRANCH_TAGS` (NodeBranchViews.ts:20). M4 node migration is trivial.
4. **`requiredCultivationPath` is only consumed by the two Thể Tu trees** (`TheTuNodes.ts:333`, `TheTuAnNodes.ts:408` export stamps). `KIEM_TU_NODES`/`PHAP_TU_NODES` carry none — exclusivity via `kiemTuMode` tags / prereq chains / ops-layer root block.
5. **`CULTIVATION_PATH_STAT_DOMAINS` (StatDomain.ts:143-152) is keyed by path id** and must become way-aware: `phap_tu_an→['phap_tu']`, `the_tu_an→['the_tu_an']`. Also contains a stale `hoa_tu` row.
6. **No enum check on `cultivationPath` in save validation** — only the phapTu cross-invariant reads it (`saveShapeValidation.ts:232`).
7. **`resolvePlayerFinalStats`** (Player.ts:433-457) is the assembly authority — `PlayerStatAssembly.ts` does not exist.
8. **`authoredBasicSkillId` (GameManager.ts:1043-1061)**: any defined-but-unknown path suppresses the mortal `tram` fallback — way-awareness required.
9. **Pinia `toRefs` gotcha**: new `PlayerData` fields must be declared in `createDefaultPlayer` literal (documented bug pattern Player.ts:349-355).

## Authority matrix

| Concern | Authority | Site |
|---|---|---|
| Path identity | `PlayerData.cultivationPath` (5-id union) | `Player.ts:108`, `CultivationPathKit.ts:20` |
| Sole production writer | `chooseCultivationPath` — `player.cultivationPath = pathId` at :227 | `GameManagerRealmAdvanceOps.ts:172-300` |
| Offer evaluation | `getOfferableCultivationPaths` (base 3 + gated _an), `isCultivationPathOffered`, `isPhapTuAnEligible` | `CultivationPathSystem.ts:84-103`, `CultivationPathKit.ts:213-221` |
| Kit catalog | `CULTIVATION_PATH_KITS` (5 entries; fields: id/name/element?/techniqueId/statModifiers?/realmRewards?/skillIds?/offerGate?/usesTheResource?) | `CultivationPathKit.ts:77-185` |
| phap_tu_an skills | bespoke ritual branch (not kit.skillIds): `van_phap_tuy_tam`+`da_phap_lien_tuyen` learn+equip slots 0/1; passive `ngo_dao_hon_don` via `innateSkillId` | `GameManagerRealmAdvanceOps.ts:218-236`, `CultivationPathKit.ts:193-200` |
| kiem_tu slice | `player.kiemTu = freshKiemTuState()` at ritual; precursors unequipped | `RealmAdvanceOps.ts:244-252` |
| Realm rewards | `grantCultivationPathRealmReward` — kit.realmRewards (only `phap_tu` has one) | `CultivationPathSystem.ts:207-241` ← `TribulationOutcomeService.ts:233` |
| Node investment | `player.nodeLevels` + `NodeSystem` (purchase/upgrade/aggregate/reveal/devReset) | `NodeSystem.ts` |
| Node path gate | `nodePathApplies` — `requiredCultivationPath === player.cultivationPath` exact | `NodeSystem.ts:292-294` |
| Node mode gate | `nodeModeApplies` — `kiemTuMode === player.kiemTu?.mode` | `NodeSystem.ts:283-285` + `canPurchaseNode:139` |
| Kiếm mode switch | `kiemTuModeSwitch` effect → transaction (mode flip → `van_kiem_quyet` learn+equip → full rollback) | `GameManagerProgressionOps.ts:173-249`; gate `passesModeSwitchGate` :379-389 |
| Pháp element/route | `player.phapTu` {element,route} — atomic commit `selectPhapTuElement`; respec `switchRoute` (75% refund) | `GameManagerProgressionOps.ts:274-320`; `NodeSystem.ts:479-538` |
| Thể root mutex | `cuong_chien`/`tran_the` — `excludesNode` prereqs, NodeSystem | `TheTuNodes.ts:151-260` |
| the_tu_an roots | `ho_mon`/`phan_mon`/`tro_mon` — non-mutex presence markers | `TheTuAnNodes.ts:199-223` |
| Stat assembly emitters | `getPhapTuAttunementStatModifiers` (covers phap+phap_an), `getTheTuAnReactiveStatModifiers`, `getTheTuEnduranceStatModifiers` | `CultivationPathSystem.ts:54-184`; consumed `Player.ts:450-453` |
| Mid-battle delta | `registerDomainDeltaDeriver` ×3 ('phap_tu','the_tu_an','the_tu'); gated by `participant.activeDomains` | `CultivationPathSystem.ts:71-73,186-192`; `StatCalculator.ts:348-431` |
| activeDomains source | `CULTIVATION_PATH_STAT_DOMAINS[buildId]`, buildId = cultivationPath | `StatDomain.ts:143-152`; `TurnBattleAdapter.ts:55-65`; `GameManagerTurnBattleOps.ts:996` |
| Kiếm economy | `NguKiemDao` — `gainKiemY`/`grantKiemDao`/`applyBreakthroughMerge`/`forgeCost`/`kiemDaoCap` — all gate `mode==='ngu'` | `NguKiemDao.ts:35-102` |
| Thế economy (ung_the) | `TheEconomy` — marker-presence eligibility (`isUngTheCombatant`), never reads path | `TheEconomy.ts:25-119` |
| Save version | `CURRENT_SAVE_VERSION = 64` — strict equality reject, no migration | `saveVersion.ts:49`; `SaveSystem.ts:418-468` |
| kiemTu save shape | mode/preset/kiemY/kiemDaoCount/kiemDaoBase validation | `saveShapeValidation.ts:259-296` |
| Ritual UI | `QuanKhiPanel.vue` — offers via `getOfferableCultivationPaths`+kit index; submit `chooseCultivationPath(pathId, $state)` :88; `phap_tu_an` sealed card :203-222 (the_tu_an renders as plain button) | `QuanKhiPanel.vue:47-103,199-233` |
| Tree UI | `SkillPathPanel` (showTree/THE_TU_TREE_TAGS — phap_tu_an excluded), `NodeTreePanel` (revealWhen+nodeModeApplies filter :185-189), `NodeInspector` (element roots → `routePickOpen`) | components/panels/ |

## Battle-build seam (the way→combat contract input)

The seam = **artifacts installed on `TurnBattleParticipant`** in `GameManager.ts`/`GameManagerTurnBattleOps.ts` — the engine itself never sees a path id:

| Artifact | phap_tu | phap_tu_an | kiem hien | kiem ngu | the_tu | the_tu_an |
|---|---|---|---|---|---|---|
| basic | element kit skill (converted, route-applied, theGain+5) | `van_phap_tuy_tam` + compositePicks + multicast | `dynamicBasic`=KiemPhoProvider (static basic inert 'tram') | `dynamicBasic`=NguKiemDaoProvider (instances=kiemDaoCount, mult=kiemDaoBase) | root-mutex kit (`cuong_quyen`/`tran_ap`) | `THAM_THE` + ung_the/root markers via grantsBuffsAtBuild |
| special/ultimate | element kit (+theGain/empowerment) | `da_phap_lien_tuyen` repeatCasts; **no ult** | none (emblem-free) | emblemOnly markers | root kit skills | `TU_THE`/`BACH_UNG` |
| reactivePayloads | — | — | — | — | — | phan_kich/tro_kich payloads |
| activeDomains | ['phap_tu'] | ['phap_tu'] | ['kiem_tu'] (inert) | ['kiem_tu'] | ['the_tu'] | ['the_tu_an'] |
| maxThe | resolveMaxThe (element nodes) | none | — | — | — | kit.maxThe |

Branch sites (orchestration — composition point, allowed to know path/way):
`GameManager.ts:899-993` (resolvePlayerBasicAttack), `:943-949` (applyAnKitToBasic), `:1001-1031` (resolveTheTuKit/resolveTheTuAnKit), `:1043-1061` (authoredBasicSkillId), `:1088-1102` (assertPhapTuAnKitLearned), `:1136-1256` (resolvePlayerSpecialUltimate + phap empowerment), `:1273-1285` (applyPhapTuTheGains); `GameManagerTurnBattleOps.ts:1003-1020` (kiem provider install), `:1080-1099` (grantsBuffsAtBuild), `:1154-1157` (resets); `TurnBattleAdapter.ts:55-96` (domains/wuxing/maxThe stamp).

**Contract decision (R5):** no generic `PathCombatContribution`. The seam stays orchestration-side way resolution consuming module-declared refs (kit ids, provider factories) — composition, per spec §4 allowed identity sites.

## Way-gating requirement discovered (R6)

~15 sites gate `=== 'phap_tu'` meaning "ngu_hanh only" (element/route/Thế machinery): `selectPhapTuElement` (ProgressionOps:275), `switchRoute`/`previewRouteSwitch` (NodeSystem:495,582), `getRouteStatModifiers`/`resolveMaxThe` (PhapTuRoutes:214,233), `theBarBridge:73`, `applyPhapTuTheGains` (GameManager:1273), `routeProfileProvider` (GameManager:492), `getPhapTuElement` (ProgressionOps:117), `PillSystem:152`, `CombatBuildHud:18`, `SkillPathPanel:61,168,217`, `NodeTreePanel:97`, `authoredBasicSkillId` element branch. When `cultivationPath` collapses to base ids (M7) these must check `way === 'ngu_hanh'` — otherwise ngo_dao players gain the element tree + Thế pool. **M4 must add the way check alongside the path check** (dual-correct during transition and after).

Symmetrically `the_tu` gates (`resolveTheTuKit`, endurance emitter, `buildTheTuBatTuSurvival`, `theTuE2E` roots) must not leak to `ung_the` players — way checks `way === 'hien'` (the_tu).

## `kiemTu.mode` full consumer list (M6 migration surface)

Writers: `freshKiemTuState` (KiemTuState:49), ritual create (RealmAdvanceOps:244), flip (ProgressionOps:221), rollback (:234), restore overlay (stores/player.ts:395).
Readers: NodeSystem:81-90 (kiemDaoBelowCap), :139 (canPurchaseNode), :283-285 (nodeModeApplies — used :158,:306,:336, KiemPhoNodeModifiers:30, NodeTreePanel:188); NguKiemDao:54,84; RealmAdvanceOps:90 (merge gate); ProgressionOps:173,384,516 (modeSwitch detect/gate/preset gate); TurnBattleOps:1003,1013; kiemBarBridge:111; SkillPathPanel:180; QuanKhiPanel:126,130,247,257; saveShapeValidation:265-266.

Traps: (a) `kiem_tu_an` node carries NO `kiemTuMode` tag by design (hien must buy it) — becomes moot when node deleted; (b) `!kiemTu` in kiemBarBridge:95 means "not Kiem Tu" — must key on `cultivationPath==='kiem_tu'` + way after slice creation moves to applyPathChoice; (c) `KIEM_TU_BASIC` static fallback stays inert in both ways.

## Test files needing rewrite per mission

- M2: `GameManager.phapTuAnPath`, `theTuRitual`, `cultivationRitualFlow.integration`, `kiemTuState`, save shape/round-trip/restoreFromSave, `CultivationPathSystem.test.ts`
- M4: `PhapTuRoutes`, `PhapTuNodes.reimagined`, `NodeSystem.route`, `phapTuAnPath`, `theBarBridge.test`, `combatTechnique` (phap rows), `TurnCombatSkillBar.display`, `authoredParity`, `PillSystem.profession`
- M5: `TheTuNodes`/`TheTuAnNodes`, `theTuKit`/`theTuE2E`/`theTuAnE2E`, `StatCalculator.theTu`, `TheTuSkills`/`TheTuBuffs`, `theEconomy`, `theLifecycle`, `kiemBarBridge.test` (the rows), `NodeSystem.test` path describe
- M6: `invariants` (INV-8 rewrite to ritual), `NguKiemDao*`, `KiemPho*`, `kiemTuTree`, `kiemTuAn` (delete→ritual tests), `kiemTuState`, `kiemPhoPreset`, `kiemBarBridge`, `KiemTuNodes.test`, restoreFromSave
- M7: every fixture using `_an` path literals (see M0-C §10 — ~25 files)

## Open items carried into missions

- `hoa_tu` stale row in `CULTIVATION_PATH_STAT_DOMAINS` — remove at M7 union shrink.
- `PillSystem.ts:152` `requires_phap_tu` excludes phap_tu_an today — likely defect but PRESERVE (no silent gameplay change); way-check `'ngu_hanh'` keeps identical behavior.
- `PlayerVisualForm` default→mortal for the_tu/both _an — preserve as-is.
