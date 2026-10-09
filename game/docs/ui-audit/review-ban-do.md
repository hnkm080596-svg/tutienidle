# Review: report audit Bản Đồ (`stage_select`)

Đã rà soát từng file:line trong report đối chiếu code tại `devin/artui-c0-foundation` @ `8ffc8e64`, và quét phần report bỏ sót (file trong scope, art chưa map, CSS global động vào panel, import-không-render, listener/interval).

## Missed

1. **File trong scope không được liệt kê**: `scenes/exploration/fidelity/explorationUi.ts` (77 dòng) — định nghĩa toàn bộ contract của surface (`ExplorationNode/Chapter/Zone/ModeChip/Reward/Detail/PaperModel`). Report liệt kê mọi file fidelity trừ file types này; đây là nơi đọc đúng shape `ExplorationPaperModel` khi audit props/emits.

2. **Listener/interval sống trong scope**:
   - `ExplorationSurface.vue:68-73` — `noticeTimer = window.setTimeout(..., 3200)` auto-clear `.notice`; cleanup `onBeforeUnmount` :79-81. Report liệt kê `notice` ref nhưng không nói nó tự tắt sau 3.2s.
   - `SceneDesignCanvas.vue:7,20-25` — `ResizeObserver` live trên `.scene-viewport`, chạy `updateScale` → mọi layout 1440×810 kể cả overlay đều đi qua observer này. Report không nhắc.
   - `useDialogFocus.ts:79` — `document.addEventListener('mousedown')` live trong khi panel mở (focus-outside → `focusCard()`), cùng `keydown` trên card (:65). Report chỉ nhắc Esc.
   - `DongFuStage.vue:389,397,403-408` — `window.addEventListener('keydown')` live: khi map đang mở (`surfaceOpen` true), Tab không mở được wheel và Backquote toggle rail bị chặn — hành vi chrome chịu ảnh hưởng của scope mà report bỏ qua.

3. **Store fields còn thiếu trong inventory §2**:
   - `player.$state.completedStageIds` + `player.$state.perfectClearStageIds` (`ExplorationSurface.vue:186-197,208`) — feed `zoneProgress`/`isSelectedStagePerfectClear` (gate `perfect_farm` :211-213,:227-233). Report không liệt kê.
   - `ui.combatOrigin` (`stores/ui.ts:180`) — `enterCombatScene('stage')` ghi `combatOrigin='stage'` :351; đọc bởi `CombatResultModal`/`useBattleActions.exitCombatToHome` — mảnh state map viết mà §2 bỏ qua.
   - `useUiStore` reads khác: `ui.standalonePanel` ghi trực tiếp ở `openBuild` (:86) — report có nhắc nhưng…

4. **`openBuild` không đóng map**: `ExplorationSurface.vue:85-87` ghi `ui.standalonePanel='skill'` trực tiếp, không qua `openStandalonePanel` (`ui.ts:205-220` vốn `closeHomeOverlays()` trước). Hệ quả: `leftPanelMode==='stage_select'` vẫn true, ExplorationSurface vẫn mounted trong FunctionOverlayPanel trong khi `SkillPathPanel` mount ở `GameRoot.vue:156` — hai overlay cùng sống; đóng skill lộ lại map. Report §2 chỉ ghi "openBuild → real build surface", bỏ qua cửa cạnh tranh (§4-worthy).

5. **Read-model fields không consumer** (§5-worthy): `GameManagerStageOps.ts` trả `autoFarmAvailable` (:66,:190), `act` (:57,:172), `realmId` (:58,:174) — surface không đọc `autoFarmAvailable`/`act`/`realmId` từ model (dùng `stage.chapter`/`stage.requiredRealmId`/`isSelectedStagePerfectClear` thay thế). Logic model chết tại chỗ này.

6. **Global CSS động vào panel mà report chưa map**:
   - `tien-hiep-ui.css:56-59` `:is(#app,body) .slot-view { --slot-bg-image: var(--th-art-slot-frame) }` → mọi reward cell `<SlotView>` trong `.exploration-details` được phủ art `runtime/slot-frame.png` (`SlotView.vue:360-362` đọc `var(--slot-bg-image, inv-slot-backdrop.png)`). Art `slot-frame.png` hoàn toàn vắng trong bảng art §3.
   - `tien-hiep-ui.css:11-24,185-186,202-206,353-357` — toàn bộ khối `.paper-navigation*` global: chỉ consumer là `PaperPanelNavigation.vue`, mount trong preview-only `PaperPreviewSurface.vue` → đoạn CSS chrome chết theo đúng chủ đề §4/§6 (nav-mode stage_select) mà report không quét.
   - `tien-hiep-ui.css:163` report ghi `.df-building[data-df-building='teleport_array']` — đúng; bổ sung: vì DongFuHomeContent chỉ sống trong preview, rule này + cả block `.df-building` phụ thuộc DOM preview (đã xác nhận `DongFuHomeContent.vue:45-46,:51` render plaque).

7. **Art chưa map trong §3**:
   - `boss-seal` — `huyen-kim-chrome.json:686-703` đăng ký `tien-hiep-2026-10/runtime/boss-seal@1x/2x.png` (file tồn tại trên disk), zero consumer trong code. Map chỉ dùng `.boss-label` text + rounded node (`ExplorationPaperMap.vue:26-28`) — cùng loại "chrome art render sẵn nhưng không dùng" như `stage-node` mà report đã liệt kê.
   - `navigation-landscape-seam-v1.png` — `DongFuStage.vue:198` (`navSeamUrl`), render `v-if="surfaceOpen"` tại :471 — art chỉ xuất hiện đúng lúc map mở; thuộc entry chrome của scope, vắng trong §3.
   - `slot-frame.png` — xem mục 6.
   - `inv-slot-backdrop.png` — fallback `--slot-bg-image` trong `SlotView.vue:362`; bị override bởi slot-frame nên chỉ còn vai trò dormant — đáng nêu trong §6 (art thư viện, unwired tại scope này).

8. **Preview fixture nuance**: `ui-preview/ExplorationPreview.vue:29` dựng model 2 zones (thanh_van unlocked + huyen_phong locked) → `.exploration-zones` row + `selectZone`/`chooseZone` :70 vẫn reachable NGAY HÔM NAY trong preview `/legacy/ui-exploration.html`, không chỉ "nếu thêm zone". Report §4 nói zones switcher dead trong prod — đúng, nhưng nên ghi nhận preview vẫn exercise nó (kèm notice `navNotice`).

9. **Preview-only chrome quanh scene**: `ExplorationPreview.vue:7,73-78` mount `DongFuVista` + parallax `--df-x/--df-y` + `<Tooltip/>` — lớp chrome mà scene chạy trong preview mà §1 chưa mô tả.

10. **Comment/audio sót trong inventory**: `start()` cue `farm.arm` (:246) + `ui.error` (:249) — §2 chỉ liệt kê `farm.stop`; rail `ui.wheel.select` (:282) là chrome cue khi mở map. `Stage.ts:20-26` comment "CHỈ còn dùng để HIỂN THỊ số Tầng N (xem StageSelectPanel.vue)" — stale: fidelity surface hiển thị `{chapter}·Tầng {stage}` qua `chapterPrefix`/`stageLabel`, không render `requiredRealmId` tầng N. `Chip.vue:90` comment nói "StageSelectPanel tints" — stale: PaperDetails dùng `<button class="chip">` raw (:32), không dùng component `Chip`.

11. **`subtitle`/`zoneProgress` + `getCurrentRealm` ngoài `disabledReasonLabel`**: report ghi đúng, nhưng sót computed `zoneProgress` :186-197 (progress-fill + aria-valuenow feed) trong danh sách computed feed DOM.

12. **`data-testid` surfaces sót**: `scene-viewport` (`SceneDesignCanvas.vue:29`), `stage-start-button` đã nêu, `autofarm-stop` đã nêu — nhưng `.exploration-paper`-class rules at `tien-hiep-ui.css:25,99-103,135-148` cũng chết với fidelity DOM (report có). Bỏ qua minor.

13. **`mode` computed hai beta gates**: §1 nói "gate mở duy nhất: `ui.openLeftPanel`" — thực tế còn gate thứ hai ở mount-seam: `FunctionOverlayPanel.vue:74` `isBetaFeatureEnabledForPlayer(mode.value …)` trong `paperMode` computed; nếu beta off, `paperMode` trả `null` dù store đã admit → DOM cũng là chỗ chặn.

## Wrong

1. **`StageSelectPanel.vue` comment contract** — report diễn giải "gate teleport_array đã mất khi reskin" (§5,§7-Q2). Code chính xác hơn: `useBuildingNavigation.ts:11-12` comment ghi model post-2026-10-03 "every building always has an lv1 instance" (buildings default-built) → gate xây-dựng moot *by design*; comment `StageSelectPanel.vue:2-9` vẫn mô tả gate "inside the surface" trong khi `ExplorationSurface` không check gì → đây là **stale comment**, không nhất thiết "gate bị mất". Kết luận report về "không tồn tại check getByBuildingId('teleport_array')" thì đúng (đã verify qua grep).

2. **"map luôn init first stage của zone 0"** (§4, two-selection-authorities) — sai chi tiết: `selectFirstStageInZone` (`ExplorationSurface.vue:170-176`) chọn **stage không-locked đầu tiên** (frontier), không phải `stageIds[0]`. Bản chất vấn đề (local refs không hydrate từ `ui.selectedStageId` persisted) vẫn đúng, nhưng mô tả hành vi sai — khi mở lại map sau combat thì map đứng ở frontier, không hẳn lệch hoàn toàn với ải vừa đánh như report nói.

3. **"`ui.battleRunMode` persisted không reset khi mở panel → HUD sau thừa hưởng"** (§4) — quá lời: `exitCombatToHome` (`useBattleActions.ts:110`) reset `battleRunMode='manual'` mỗi lần về home, và `CombatVictoryPanel.vue:86,96,104,111` reset trên mọi nhánh failure/finish. Residue chỉ sống qua reload (localStorage, `loadPersistedUiAutomationFlags`) hoặc đường tắt không qua exit — khung bình thường đã reset. Hai-authority vẫn đúng nhưng phát biểu "vẫn thừa hưởng" không chính xác cho luồng phổ biến.

4. **Line drift nhỏ** (không đổi kết luận):
   - `useBuildingHeaderState.ts:33` `artPath` → thực tế `:36` (`resolveAssetUrl` import :4).
   - `huyen-kim-chrome.json:704-716` `stage-node` → block thực tế `:704-718` (mỗi entry ~15 dòng; `boss-seal` :686-703 nằm ngay trên).
   - `DongFuStage.vue` "`df-scene--covered` ~line 560" → rules tại `:566-567`; `--home-nav-art` tại `:195,:538` đúng.
   - `stores/ui.ts:257-263` `closeHomeOverlays` → `:258-263`.
   - "StableSceneArt.ts" — path đầy đủ `src/presentation/huyenKim/StableSceneArt.ts:189-205` (line đúng).
   - `betaScopeSurface.ts:152-163` cho `BETA_LEFT_PANEL_FEATURES stage_select:null` → thực tế `stage_select: null` tại `:161` trong block.

5. **§2 "`v-tooltip` trên `SlotView` reward item (`PaperDetails.vue:26`)"** — imprecise: directive sống bên trong `SlotView.vue:248` (`v-tooltip="props.static ? undefined : tooltipContent"`); `PaperDetails.vue:26` chỉ truyền `:tooltip` prop. Cơ chế đúng, attribution sai chỗ.

6. **§1 "Gate mở duy nhất: ui.openLeftPanel"** — thiếu gate thứ hai `FunctionOverlayPanel.vue:74` (xem Missed #13).

7. **§3 artPath cite "useBuildingHeaderState.ts:33"** — xem #4; đồng thời `artPath`/`artBroken`/`watch` (:98-100) là dead-path logic tính cho header teleport_array không bao giờ render — đáng vào §5 mà report chỉ nói "computed chạy không render" chung chung.

8. **§5 "không nút đóng hữu hình … khác ImperialScrollScene có X"** — đúng ý (đã verify `ImperialScrollScene.vue:100` `.hk-scroll__close` + `:47` `@click.self` + Esc), nhưng report ghi nhầm chiều so sánh nhẹ: scroll scene có **cả** close-button lẫn backdrop click; paper chỉ có Esc + backdrop qua `DongFuStage.onSceneClick` (root `@click.self` bất lực do `pointer-events:none` :390-400). Phát biểu gốc không sai, chỉ chưa trọn vẹn.

9. **§6 `.df-building` claim** — đúng là preview-only, nhưng report quên nêu `.df-building` trong `DongFuHomeContent.vue:41-53` vẫn render full plaque/symbol/name/upgrade-dot trong preview → "hotspot Bản Đồ" trong preview là button thật emit `action(id)` → `openBuilding` — preview path cần liệt kê trong §1 dormant routes (report có nhắc DongFuFidelityScene nhưng gộp chung, chưa nói emit chain).

## Verified-ok

Các claim đối chiếu chính xác (line-number khớp, cơ chế đúng):

1. **Mount chain**: `GameRoot.vue:140-150` `FunctionOverlayPanel` trong `v-if="!isFullSceneActive"` ✓; `PAPER_MODES` :53-58 chứa `stage_select` ✓; `IMPERIAL_MODES` :41-47 cũng chứa nhưng bị shadow ✓ (`scrollMode` :82-84 loại PAPER_MODES); mount `StageSelectPanel` :114 trong `Transition th-panel-swap` :113 ✓; `BUILDINGS.stage_select='teleport_array'` :65 feed `useBuildingHeaderState` :91 — computed chạy không render ✓.

2. **StageSelectPanel shell**: `:17` `v-if="ui.leftPanelMode==='stage_select'"` + comment :2-9 ✓.

3. **Fidelity scene DOM**: `.paper` class :22 (không phải `exploration-paper`) ✓; zones row `v-if="model.zones.length>1"` :24-26 ✓; `.map-position` :28; progress `aria-valuenow` :29; `ExplorationPaperDetails` :30; `.preview-label` :31; `useDialogFocus` Esc :18 ✓; `@click.self="emit('back')"` :21 ✓.

4. **PaperMap**: `.terrain` img :22; scroll :23; svg `viewBox="0 0 720 140"` :25; `.stage-node` 46px button :26-28,:39; `node-ring` :9,:27; `lock.svg` :10,:27; dashed `#81662e` :38; guard `node.state!=='locked'` :26 ✓.

5. **PaperDetails**: armed row + `data-testid="autofarm-stop"` :13; `.stage-vista` :18 (`backgroundSize:'100% 300%'` inline ✓); `<SlotView>` rewards :26; `.mode-block` :31; `.build-link`+`.challenge[data-testid=stage-start-button]` :32; `.notice` :35; geometry aside :39 (983,154/405×575) ✓.

6. **Open/close paths**: rail `exploration→openLeftPanel('stage_select')` `DongFuStage.vue:236`; `NAV_ACTIVE_PANEL.exploration` :252; icon `navigation-exploration-v2.png` :458; wheel `commandWheelCatalog.ts:194-198` `ALWAYS_AVAILABLE`; `useBuildingNavigation.openBuilding` :137-155 (check `isBetaBuildingSurface` :141 + `template.functionType` :152); `openLeftPanel` beta-gate `ui.ts:226-242`; `betaScopeSurface.ts:161` `stage_select:null` → luôn admit; `leftPanelMode` nằm trong `surfaceOpen` (`DongFuStage.vue:56-58`) → `df-scene--covered` chỉ ẩn `.df-board`/`.df-notice` :566-567 → `AutoFarmIndicator` (mount :492, testid :35) vẫn sống → **duplicate stop-control + duplicate testid** ✓.

7. **Dead handler**: `.exploration-scene{pointer-events:none}` `:390-400` + `> *{pointer-events:auto}` `:401-411` → `@click.self` trên root không bao giờ fire; backdrop-dismiss thực qua `DongFuStage.onSceneClick` :366-369 → `closeHomeOverlays` `ui.ts:258-263` ✓.

8. **Global CSS hits**: `.exploration-paper` dead-rules `:25,:99-103(exploration-title),:135-148(zone-title 72px UTM OngDoGia + reduced-motion :147-149),:177,:233,:239-241,:249-252,:253-256,:264-269,:278-280,:344-346,:390-411` — tất cả verify khớp; `.eyebrow{display:none}` :241; `.heading top:174` :240 vs scoped 156; `.stage-vista 48px` :250 vs scoped 64; `.notice:empty` :249; `.challenge` button-primary art :251-252; `.df-building[data-df-building='teleport_array']` :163 ✓.

9. **Two authorities**: local `selectedZoneId/selectedStageId/mode` refs (:103,:119,:199) + watcher reset 'manual' :203-205 vs persisted `ui.selectedZoneId/selectedStageId` (:169-171, transient) + `ui.battleRunMode` (:154, persisted localStorage — xác nhận comment `App.vue:125-135` + `ui.flags.test.ts:99` direct-write test) ✓. `startSelectedStage` :128-138 ghi cả store ✓. `CombatVictoryPanel.vue:71-113` progress-mode advance ✓.

10. **Models/data**: `StageSurfaceModel` fields `GameManagerStageOps.ts:54-71`; `getStageSurfaceModels` :108-130; `disabledReason = lockReason ?? busy` :192 → `locked.progress` map `disabledReasonLabel.ts`; `isBossFloor = bossEnemyId!==undefined && floor===10` :186-187; zones `Zones.ts:20-27` single `thanh_van` 30 stageIds (10 mortal+10 qi+10 foundation) → zones switcher dormant ✓; `subtitle = getCurrentRealm('mortal').name = 'Phàm Nhân'` (`data/realms/realm.ts:38`) ✓.

11. **Art map**: terrain `exploration-v2/terrain-three-realms-v1.png` (`ExplorationSurface.vue:40`) — file duy nhất trong dir ✓; `'ui-scenes'` bundle `AssetBundleCatalog.ts:619` + prefetch `'combat'` không chứa terrain ✓; paper-nine-slice `character-v2` reuse (:12 FidelityScene, :9,:12 PaperDetails) ✓; node-ring `skill-v2` :9; lock.svg :10; equipment.svg `explorationRewards.ts:13`; exploration.svg wheel `SLOT_SYMBOL` `DongFuStage.vue:120`; medallion `--home-nav-art` :195,:538; button-primary `--th-art-button-primary` `tien-hiep-ui.css:251-252` + `TienHiepUiAssets.ts:4-30`; paper-surface+panel-frame-v2 ::before/::after :233,:264-269 (mechanism `border-image:inherit` trên ::after đúng như report mô tả); `stage-node@1x/2x` chrome `huyen-kim-chrome.json:704-718` zero consumer ✓; `scene/map/exploration-map-{frame,mask}+chapter-divider` `StableSceneArt.ts:189-205` files tồn tại, zero consumer ✓; teleport_array v2 art dormant `useBuildingHeaderState.artPath` :36 ✓.

12. **Dormant paths**: `usePaperNavigation.ts` zero production consumer (chỉ `ui-preview/paperNavigation.ts:1` import `PAPER_NAV_IDS`) ✓; `LEFT_PANEL_NAV_ID.stage_select='exploration'` :79, `NAV_TARGETS.exploration→teleport_array` :56 ✓; preview `/legacy/ui-exploration.html` `previewRoutes.ts:2` → `ExplorationPreview.vue:78` mount `ExplorationFidelityScene preview` — đường duy nhất render `.preview-label` ✓; `DongFuFidelityScene`/`DongFuHomeContent` `.df-building` preview-only (production `DongFuStage` không render `.df-building`) ✓; `exploration.ts:9-10` cài `tien-hiep-ui.css` + `tien-hiep-secondary-ui.css` cho preview ✓.

13. **i18n**: grep xác nhận zero consumer (ngoài locales) của `panels.stageSelect.aria.filters`, `labels.zoneFilter|chapterFilter|floorPrefix|eliteChance|boss`, `sections.*`, `empty.noStages|selectStage`, `progress.title`; `exploration.navigation` zero consumer. Live keys `chapterPrefix|enemiesSuffix|bossNamePrefix|levelPrefix`, `locked.*`, `modes|modeHints|actions|archetypes`, `rewards.*` đều có consumer trong Surface/disabledReasonLabel/explorationRewards ✓.

14. **Misc**: `disabledReasonLabel.ts` (29 dòng) branches floor/realm/progress ✓; `ImperialScrollScene.vue:100` `.hk-scroll__close` + Esc + `@click.self` :47 — có nút X ✓; `StageSelectPanel.test.ts:32-37` mount `teleport-array` thủ công dù component không check ✓; `panelIds.ts:28` union `stage_select` ✓; `Building.ts:23` `functionType` union ✓; không file global CSS nào khác (`tien-hiep-secondary-ui.css`, `theme.css`, `pc-paper-scene.css`) động vào `.exploration*`/`.paper`/`.stage-node`/`.zone-title` ✓.
