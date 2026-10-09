# Panel: Bản Đồ — `stage_select` (Thám Hiểm)

Scope: `game/src/components/panels/StageSelectPanel.vue`, `game/src/components/scenes/exploration/**` (gồm `fidelity/explorationUi.ts` — contract types của surface), chrome global `src/assets/tien-hiep-ui.css` + các stylesheet khác đụng `.exploration*`. Snapshot `devin/artui-c0-foundation` @ `8ffc8e64`.

## 1. Mount chain — từ nav/route đến component gốc

Đường live:

1. `App.vue` → `GameRoot.vue:150` — `<FunctionOverlayPanel/>` trong nhánh `v-if="!isFullSceneActive"` (:140); overlay chỉ sống trên route home.
2. `FunctionOverlayPanel.vue`:
   - `mode` computed (:69-77) là **gate mount-seam thứ hai**: `isBetaLeftPanelMode(value)` (:74) — kể cả caller ghi thẳng `ui.leftPanelMode` bỏ qua `openLeftPanel`, DOM vẫn không mount khi mode bị scope-đóng. Comment :71-73 ghi rõ "mount-seam chokepoint".
   - `PAPER_MODES` (:53-58) chứa `stage_select` → `<StageSelectPanel v-if="paperMode==='stage_select'">` :114 trong `Transition th-panel-swap` (:113-118).
   - `IMPERIAL_MODES` (:41-47) cũng liệt kê `stage_select` nhưng `scrollMode` (:82-84) loại PAPER_MODES → nhánh scroll dead. Template scroll cũng không có child `stage_select` nào (:152-154 chỉ render `ProductionPanel` cho `exploration`) — dead hai lớp.
   - `BUILDINGS.stage_select='teleport_array'` (:65) feed `useBuildingHeaderState(buildingId)` (:91) — computed chạy nhưng header chỉ render trong nhánh scroll/legacy (`#header` :131-150, `#heading` :170-184, `#header-actions` :186-188), không nhánh nào sống cho paper mode.
3. `StageSelectPanel.vue:17` — shell mỏng `<ExplorationSurface v-if="ui.leftPanelMode==='stage_select'">`; comment :2-9 ghi contract (open authority `leftPanelMode`, close `closeHomeOverlays()`) — và một câu stale về gate teleport_array (xem §5).
4. `ExplorationSurface.vue:456-470` — production adapter: `<SceneDesignCanvas overlay>` (canvas 1440×810 scale qua `ResizeObserver` `SceneDesignCanvas.vue:7,20-25`; `overlay` = transparent + `pointer-events:none` :37-43) bọc `<ExplorationFidelityScene>` với `:model :stage :notice` + emits `select/zone/mode/stop-farm/open-build/start/back` (`@back` → `ui.closeHomeOverlays()` :468).
5. `ExplorationFidelityScene.vue` — root `.exploration-scene` (:21) → `.paper` nine-slice (:12,:22); zones row `v-if="model.zones.length>1"` (:24-26); `.map-position` → `ExplorationPaperMap` (:28); `.progress` track + `aria-valuenow` (:29); `ExplorationPaperDetails` (:30); `.preview-label` khi prop `preview` (:31); `useDialogFocus(rootRef, ()=>true, {onEscape: emit('back')})` (:18).
6. `ExplorationPaperMap.vue` — `.exploration-map` 720×450 (:33): `.terrain` img (:22) + `.exploration-map-scroll` overflow-y (:23,:35); per-chapter band `.chapter.tone` cao 150px (:36); svg `viewBox 0 0 720 140` dashed `#81662e` (:25,:38); `.stage-node` 46px button (:26-28,:39).
7. `ExplorationPaperDetails.vue` — `.exploration-details` aside (absolute 983,154 / 405×575, :39): armed-farm row + `[data-testid=autofarm-stop]` (:13); `.stage-vista` (:18); enemies (:22-24); rewards qua `<SlotView>` (:26); `.mode-block` chips ngoài scroll (:31); `.build-link` + `.challenge[data-testid=stage-start-button]` (:32); `.notice` 35px (:35,:46).

Đường mở (open paths):

- Rail Động Phủ: `DongFuStage.vue:236` `exploration → ui.openLeftPanel('stage_select')` trong `NAV_TARGET`; active-map `NAV_ACTIVE_PANEL.exploration='stage_select'` (:252); icon `navigation-exploration-v2.png` (:458); cue `ui.wheel.select` trong `navAction` (:282) — cue chrome khi mở map.
- Wheel slot `teleport_array` (`commandWheelCatalog.ts:194-198`, `available: ALWAYS_AVAILABLE`) → `activateSlot` (`DongFuStage.vue:330-336`) → `useBuildingNavigation.openBuilding` (:136-155): `isBetaBuildingSurface` (:140, `teleport_array: null` trong `BETA_BUILDING_FEATURES` `betaScopeSurface.ts:109` → luôn admit) + `template.functionType==='stage_select'` (`buildings.ts` ~:191) → `openLeftPanel` (:151-152).
- `usePaperNavigation.ts` — nav id `exploration → building teleport_array` (:56), `LEFT_PANEL_NAV_ID.stage_select='exploration'` (:79): **không production consumer** (chỉ `ui-preview/paperNavigation.ts:1` import `PAPER_NAV_IDS`; `SettingsSurface.vue:4` chỉ nhắc trong comment, không import).
- Gates mở: `openLeftPanel` check `isBetaLeftPanelMode` (`stores/ui.ts:226-242`; `stage_select: null` trong `BETA_LEFT_PANEL_FEATURES` `betaScopeSurface.ts:161` → luôn admit) + gate mount-seam `FunctionOverlayPanel.vue:74` ở trên. **Không gate "teleport_array đã xây"** — vì default-built by design (xem §5/§7).
- Đóng: Esc (`useDialogFocus` `ExplorationFidelityScene.vue:18`, `useDialogFocus.ts:37-42`), `@back` → `closeHomeOverlays()` (`stores/ui.ts:258-263`), click nền trống `DongFuStage.onSceneClick` (:366-369, chỉ khi target không match `INTERACTIVE_SELECTOR` :364). Root `@click.self` → back bất lực (§4).

Đường dormant/fixture vẫn reachable:

- Preview page `/legacy/ui-exploration.html` (`previewRoutes.ts:2`) → `ui-preview/exploration.ts` (entry: cài `tien-hiep-ui.css` + `tien-hiep-secondary-ui.css` :9-10, `installTienHiepUiAssets` :11) → `ExplorationPreview.vue` + `explorationMessages.ts`: mount `ExplorationFidelityScene preview` bọc trong `SceneDesignCanvas` + `DongFuVista` + parallax `--df-x/--df-y` (:73-75) + `<Tooltip/>` (:78) — chrome preview-only. Fixture model có **2 zones** (:29: thanh_van unlocked + huyen_phong locked) → `.exploration-zones` row + `chooseZone` (:70, notice `navNotice`) được exercise ngay hôm nay trong preview; `preview` là đường duy nhất render `.preview-label`.
- `ImperialScrollScene` — không còn branch `stage_select` trong template (:152-154), chỉ chết qua PAPER_MODES shadow.
- `DongFuFidelityScene.vue` + `DongFuHomeContent.vue` `.df-building` plaque (:41-65: `data-df-building`, `emit('action', building.id)` :49) → emit chain `action(id)` qua FidelityScene (:80,:82,:90) → `openBuilding` — chỉ sống trong preview `ui-dong-fu` (`DongFuPreview.vue`); production `DongFuStage` không render `.df-building`. Global CSS `.df-building[data-df-building='teleport_array']` (`tien-hiep-ui.css:163`, left:126px top:306px) vì vậy chỉ style DOM preview.
- `useBuildingNavigation` cũng có `upgradeBuilding` — không liên quan map.

## 2. UI logic inventory — mọi nguồn feed DOM

Types contract (Missed-1): `fidelity/explorationUi.ts` (77 dòng) định nghĩa `ExplorationNode/Chapter/Zone/ModeChip/Reward/Detail/PaperModel` — shape đúng của props `model`/`stage`; comment inline giải thích state→render map ('perfect' → cleared+★, locked node mang `lockedHint` làm title vì không còn selectable).

Store reads/writes:

- `ui.leftPanelMode` — open authority (`stores/ui.ts:123`; `StageSelectPanel.vue:17`). Ghi lại ở `start()` perfect_farm success: `ui.leftPanelMode = null` (`ExplorationSurface.vue:247`) — **direct write bypass `closeHomeOverlays()`** (không dọn `characterOverlayOpen`/`standalonePanel`/`isCommandWheelOpen`, dù ở điểm đó chúng thường đã null).
- `ui.selectedZoneId` / `ui.selectedStageId` (`stores/ui.ts:169,:171`) — ghi bởi `startSelectedStage` (`useBattleActions.ts:131-132`) và auto-advance progress-mode `CombatVictoryPanel.vue:92` (rollback :95). Đọc bởi `CombatVictoryPanel.vue:44-48,:71-76`, `CombatIntroOverlay.vue:26-33`, `CombatDefeatPanel.vue:85,:93-98`, `CombatTopBar.vue:31-38`, `useVictorySceneModel.ts:33-37`. Surface giữ ref local trùng tên (`ExplorationSurface.vue:103,:119`) — hai nguồn truth song song.
- `ui.battleRunMode` (`stores/ui.ts:154`, persisted localStorage qua `installAutomationFlagsPersistence` — `App.vue:125-135`, `setBattleRunMode` :333-337, direct-write test `ui.flags.test.ts:99`) — ghi trong `startSelectedStage` (:133). **Readers thực tế**: `useBattleActions.ts:84` (repeat-retry), `CombatVictoryPanel.vue:71,:119,:129`, `CombatDefeatPanel.vue:142` — CombatTopBar/CombatIntroOverlay/useVictorySceneModel đọc `selectedStageId/selectedZoneId` chứ không phải battleRunMode (sai attribution trong draft gốc). Local `mode` ref (`ExplorationSurface.vue:199`) là authority pre-battle; watcher reset 'manual' khi đổi stage (:203-205, T4-38). **Residue**: `exitCombatToHome` (`useBattleActions.ts:110`) + `CombatVictoryPanel.vue:86,96,104,111` + `CombatDefeatPanel.vue:112` đều reset 'manual' → chỉ sống qua reload/localStorage hoặc đường thoát không qua exit.
- `ui.combatOrigin` (`stores/ui.ts:180`) — `enterCombatScene('stage')` ghi :351 (gọi từ `startSelectedStage` :135 + `startBattle` :85); đọc bởi `CombatResultModal.vue:20` + `CombatExitConfirmModal.vue:67` gate stage-only UI. Map viết mà không đọc.
- `ui.standalonePanel='skill'` — `openBuild` (`ExplorationSurface.vue:85-87`) **ghi trực tiếp, KHÔNG qua `openStandalonePanel`** (`ui.ts:244-255` vốn `closeHomeOverlays()` :252 trước): hệ quả `leftPanelMode==='stage_select'` vẫn true → ExplorationSurface vẫn mounted dưới SkillPathPanel (mount qua `mountedStandalone` watcher `GameRoot.vue:78-99` → `:156`); beta check vẫn được enforce ở mount seam (:85). Đóng skill → map lộ lại.
- `player.$state.autoFarmStage` → `armedFarmStage` (:124-131); `stopAutoFarm` → `autoFarmOps.stopAutoFarm` + cue `farm.stop` (:133-136).
- `player.$state.completedStageIds` (:192) → `zoneProgress` (:186-197, feed `.progress` + `aria-valuenow` + `progressLabel` "n/30"); `player.$state.perfectClearStageIds` (:208) → `isSelectedStagePerfectClear` gate `perfect_farm` (:229,:417) — hai field draft gốc sót.

GameManager read-models (contract DO-NOT-DERIVE, comment `ExplorationSurface.vue:4-6,91-93`):

- `gameManager.stageOps.getStageSurfaceModels(player.$state)` (:94) — `StageSurfaceModel{act,realmId,floor,state,isBossFloor,displayEnemy,rewardPreview,autoFarmAvailable,startAvailable,disabledReason}` (`GameManagerStageOps.ts:54-71`; assignments :182-192; `isBossFloor = bossEnemyId!==undefined && floor===10` :186-187; `disabledReason = lockReason ?? {kind:'busy'}` :192 → map `locked.progress` qua `disabledReasonLabel.ts`).
- **Fields model không consumer** (§5-worthy): `act` (:57,:182), `realmId` (:58,:183), `autoFarmAvailable` (:66,:190) — surface dùng `stage.chapter`/`stage.requiredRealmId`/`isSelectedStagePerfectClear` thay thế.
- `zoneRegistry.getAll()` (:89); `catalogOps.getStage` (:115,:130); `materialRegistry/equipmentRegistry/pillRegistry` trong `dropEntryReward` (:337-362); `getCurrentRealm` cho subtitle (:434-437) + chapter label (:146) + locked-hint realm (`disabledReasonLabel.ts`).

Local state/computed feed DOM:

- `notice` ref (:67) + `noticeTimer` `setTimeout(3200)` auto-clear (`flashNotice` :69-73) + cleanup `onBeforeUnmount` (:79-81) — `.notice` tự tắt sau 3.2s, draft gốc chỉ liệt kê ref.
- `selectedZoneId` (:103, init `zones[0]`) + watcher `selectFirstStageInZone` immediate (:176): chọn **stage không-locked đầu tiên** (frontier, :171) chứ không phải `stageIds[0]` — fallback `stageIds[0]` chỉ khi mọi stage locked (:172).
- `selectedStageId` (:119); `mode` (:199); `surfaceModels`/`modelById` (:94-95); `isZoneUnlocked` qua first-stage state (:97-101); `stagesInZone` (:109-117); `chapterOptions` từ `stage.chapter`/`requiredRealmId` (:138-152); `canStart` = zone unlocked + `selectedModel.startAvailable` (:211-217); `pickMode` chặn `perfect_farm` khi `!isSelectedStagePerfectClear` (:227-233); `start()` (:235-256) — `perfect_farm` → `startAutoFarm` + `ui.leftPanelMode=null` + cue `farm.arm` (:246) / thất bại → cue `ui.error` + `flashNotice(t('exploration.startFailed'))` (:249-250); mode khác → `startSelectedStage` (:255).
- `nodeState` map model-state → `cleared|current|available|locked` (:260-273); `nodePosition` zigzag `x:58+col*66, y:60+row*50+(col%2?17:0)`, 10 node/row (:277-281); `TONES=['','blue','violet']` (:283); `paperChapters` kèm `lockedHint` (:285-315); `paperStage` detail (:368-424); `paperZones`/`subtitle`/`paperModel` (:426-452).
- `explorationRewards.ts`: `rangeLabel`, `dropKindLabel`, `dropAmountText` (equipment → '×1'), `extraDropRows`, `plainRewardTooltip`, `EQUIPMENT_ANY_ICON` (:13), `KIND_LABEL_KEYS` (:15-20).

Emits/props/directives/listeners:

- `ExplorationFidelityScene` props `{model, stage, notice, preview?}`, emits `select/zone/mode/stopFarm/openBuild/start/back` (:9-10); root `@click.self="emit('back')"` (:21) — dead handler (§4).
- `ExplorationPaperMap` props `{chapters, terrain, selected}`, emit `select` (guard `node.state!=='locked'` :26); `aria-label` `exploration.stageLabel`, `aria-pressed`, `aria-disabled`, `:title` locked-hint (:26).
- `ExplorationPaperDetails` props `{model, stage, notice}`, emits `mode/start/openBuild/stopFarm` (:7); truyền `:tooltip` prop vào `SlotView` (:26) — directive `v-tooltip` sống **bên trong** `SlotView.vue:248` (`props.static ? undefined : tooltipContent`), không phải tại PaperDetails.
- `useDialogFocus` (`ExplorationFidelityScene.vue:18`): keydown trên card (`useDialogFocus.ts:65` — Esc :37-42 + Tab cycle :43-63, `stopPropagation` :48-49 chặn window-level listeners) + `document.addEventListener('mousedown')` (:79) keep-focus + restore trigger (:87,:99).
- `SceneDesignCanvas`: `ResizeObserver` trên `.scene-viewport` (:20-23) → `measure()` scale = min(w/1440, h/810) (:12-15) — live observer cho mọi overlay canvas.
- `DongFuStage` window keydown (`onKeydown` :380-401, add :404, remove :407): Esc → `closeCommandWheel` (:381-384); **Tab → `toggleRail()` (:389-392)** và **Backquote → `toggleCommandWheel()` (:397-399)** — cả hai gated `!surfaceOpen`: khi map mở, rail/wheel không toggle được (reviewer draft đảo Tab↔wheel; thực tế Tab=rail, `=wheel). Tương tác lồng: card-level Esc của `useDialogFocus` stopPropagation → Esc đóng map trước, không chạm wheel-close.
- `assetManager.prefetch(['combat'])` on-mount (:76) — warm 'combat' bundle; terrain/details art nằm ở bundle 'ui-scenes' (`AssetBundleCatalog.ts:619`), không prefetch.
- `stateVersion`/`bumpState` — `DongFuStage` dùng `useStateVersion` cho currency/quest (:300,:311); ExplorationSurface không subscribe stateVersion (model computed chỉ re-eval qua reactive deps của `$state`).

Tests: `StageSelectPanel.test.ts` (boss detail :56-101; armed farm+stop :104-119; refused start giữ panel :121-145; mode disarm :152-201) — mount building `teleport-array` thủ công (:32-37) dù không gate nào trong component; `fidelity/ExplorationPaperMap.test.ts`; `fidelity/explorationRewards.test.ts`.

## 3. Art map — file art → element

| Asset (dưới `public/`) | Element dùng | Ghi chú |
|---|---|---|
| `assets/ui/huyen-kim/scene/exploration-v2/terrain-three-realms-v1.png` | `.terrain` img (`ExplorationPaperMap.vue:22`); `.stage-vista` bg `backgroundSize:'100% 300%'` (`ExplorationPaperDetails.vue:18`); preview fixture cùng file (`ExplorationPreview.vue:28`) | `TERRAIN_SRC` `ExplorationSurface.vue:40`; bundle 'ui-scenes' `AssetBundleCatalog.ts:619`; prefetch 'combat' KHÔNG chứa nó |
| `assets/ui/huyen-kim/scene/character-v2/paper-nine-slice.png` | `.paper` `borderImageSource` (`ExplorationFidelityScene.vue:12,:22`); `.exploration-details` (`ExplorationPaperDetails.vue:9,:12`) | Art scene Nhân Vật reuse; details bị global ::before/::after phủ (§4) |
| `assets/ui/huyen-kim/scene/skill-v2/node-ring-v1.png` | `.node-ring` trên mọi stage node (`ExplorationPaperMap.vue:9,:27`) | Art scene Kỹ Năng reuse |
| `assets/ui/huyen-kim/symbols/lock.svg` | `.lock-mark` locked node (`ExplorationPaperMap.vue:10,:27`) | |
| `assets/ui/huyen-kim/symbols/equipment.svg` | `EQUIPMENT_ANY_ICON` (`explorationRewards.ts:13`) → `SlotView` icon; preview cùng icon (`ExplorationPreview.vue:40`) | |
| `assets/ui/huyen-kim/symbols/exploration.svg` | Wheel slot icon `teleport_array` (`DongFuStage.vue:120` `SLOT_SYMBOL`, `symbolUrl` `dongFuUi.ts`) | |
| `assets/ui/tien-hiep-2026-10/icons/navigation-exploration-v2.png` | Rail button Bản Đồ (`DongFuStage.vue:458` pattern `navigation-${id}-v2.png`) | |
| `assets/ui/tien-hiep-2026-10/controls/navigation-medallion-v1.png` | `--home-nav-art` rail button bg (`DongFuStage.vue:195,:538`) | entry chrome |
| `assets/ui/tien-hiep-2026-10/controls/navigation-landscape-seam-v1.png` | `.home-navigation-landscape-seam` img `v-if="surfaceOpen"` (`DongFuStage.vue:198,:471`) | chỉ xuất hiện đúng lúc map/panel mở — entry chrome của scope |
| `assets/ui/tien-hiep-2026-10/runtime/button-primary.png` | `.challenge` CTA qua `--th-art-button-primary` (`tien-hiep-ui.css:251-252`; var `TienHiepUiAssets.ts:12`) | đè scoped `#285e4b` + double-border :44 |
| `assets/ui/tien-hiep-2026-10/runtime/slot-frame.png` | `--th-art-slot-frame` → `--slot-bg-image` trên mọi `.slot-view` (`tien-hiep-ui.css:56-58`; `TienHiepUiAssets.ts:8`) | phủ background của mọi reward cell `<SlotView>` trong `.exploration-details` — draft gốc sót |
| `assets/ui/Slot/inv-slot-backdrop.png` | fallback `var(--slot-bg-image, url(inv-slot-backdrop.png))` (`SlotView.vue:361,:378`) | dormant tại scope này vì slot-frame override; còn vai trò fallback khi var absent |
| `assets/ui/tien-hiep-2026-10/runtime/paper-surface.png` + `panel-frame-v2.png` + `world-vista.png` | `--th-art-paper-surface`/`--th-art-world-vista` trong `::before` + frame `border-image` trên `::after` của `.exploration-details` (`tien-hiep-ui.css:233,:264-269`) | global skin chồng border-image component |
| `assets/ui/tien-hiep-2026-10/runtime/title-plaque.png` | `--th-art-title-plaque` trong rule `.exploration-title` (`tien-hiep-ui.css:99-103`; `TienHiepUiAssets.ts:10`) | rule dead — không element `.exploration-title` |
| `assets/ui/tien-hiep-2026-10/runtime/stage-node@1x/2x.png` | — **không consumer** | `huyen-kim-chrome.json:704-718` id `stage-node`, role "exploration stage node" — art render sẵn nhưng map dùng CSS circle + node-ring |
| `assets/ui/tien-hiep-2026-10/runtime/boss-seal@1x/2x.png` | — **không consumer** | `huyen-kim-chrome.json:686-702` id `boss-seal` "boss stage seal" — cùng loại chrome art chết; map chỉ dùng `.boss-label` text + rounded node (:26,:44) |
| `assets/ui/huyen-kim/scene/map/exploration-map-{frame,mask}@1x/2x.png` + `exploration-chapter-divider@1x/2x.png` | — **không consumer** | `StableSceneArt.ts:189-205` registrations cho composition `.stage-map` đã xóa — file còn trên disk |
| `assets/buildings/dong-fu/v2/teleport_array/base.png` (+ `locked-overlay`, `silhouette-mask`) | — dormant | chỉ render qua `useBuildingHeaderState.artPath` (`useBuildingHeaderState.ts:36`) trong nhánh scroll dead + preview plaques |

Global chrome khác động tới scope (ngoài bảng): `.zone-title` gradient-shine 'UTM OngDoGia' 72px + `color:transparent` (`tien-hiep-ui.css:135-146`, reduced-motion fallback `#8a6420` :147-149), `th-panel-swap` transition (:373-378), `.exploration-scene`/`> *` pointer-events split (:400,:411).

## 4. Conflicts / layers — 2+ phiên bản UI cùng tồn tại

- **`class .paper` vs `.exploration-paper`**: toàn bộ global paper-chrome nhắm `.exploration-scene .exploration-paper` / `:is(...,.exploration-paper,...)` (`tien-hiep-ui.css:25,:177,:239,:253-256,:278-280,:344-346`) — nhưng DOM render `class="paper"` (`ExplorationFidelityScene.vue:22`). Mọi rule này **dead trong scene này**; scoped `.paper` (left:94 top:123 1334×633, `border-image-width:83px`, :35) thắng mặc định. Nếu đổi class khớp chrome → paper nhảy sang left:156 w:1272 (:239) + skin ::before/::after global — 2 layout dựng sẵn cho 1 surface.
- **`.exploration-title` plaque**: global `tien-hiep-ui.css:99-103` style title-plaque (`--th-art-title-plaque`, 30px, left:192 top:97) — không element nào mang class này. Dead CSS cho title-plaque variant.
- **`.zone-title` dual-skin**: scoped `.zone-title` = 34px italic (:35) bị global đè thành 72px `UTM OngDoGia` `font-style:normal` `color:transparent` gradient-shine (`tien-hiep-ui.css:135-146`). Override live — hai tác giả skin cùng một element.
- **`.eyebrow` vẫn render nhưng bị giấu**: scene render `<p class="eyebrow">{{ t('exploration.title') }}` (:23) — global `display:none` (:241). Dead DOM còn i18n lookup mỗi mount.
- **`.heading` vị trí**: scoped `top:156` (:35) vs global `top:174` (`:240`) — global thắng.
- **`.exploration-details` dual skin**: component gắn `borderImageSource` paper-nine-slice (:9,:12) + scoped styles; global ghi đè `background:#f2e8d0` + `border-image-slice:240 320` + `border-image-width:28px` (:233) rồi đắp `::before`/`::after` layers (:264-269: ::before `#f2e8d0` z-2, ::after `border-image:inherit` z-1) → border-image inline của component trở thành nguồn frame, nội dung nằm trên ::before phẳng — hai hệ chrome chồng nhau.
- **`.stage-vista` height**: scoped 64px (:42) → global 48px (:250). **`.notice:empty` collapse**: global (:249) vs scoped reserve 35px (:46). **`.challenge`**: scoped solid `#285e4b` + 3px double `#bca264` (:44) → global `button-primary.png` + border:0 + `color:#352713` (:251-252).
- **`.exploration-scene { pointer-events:none }` + `> * { pointer-events:auto }`** (:400,:411): `@click.self="emit('back')"` trên root (:21) không bao giờ fire — dead handler; backdrop-dismiss thực chạy qua `DongFuStage.onSceneClick` → `closeHomeOverlays()` (:366-369). Hai owner cho cùng hành vi đóng.
- **Không có nút đóng hữu hình**: paper surface không render close-button nào — khác `ImperialScrollScene` có **cả** X (`.hk-scroll__close` :100-105) lẫn `@click.self` (:47) lẫn Esc (`useDialogFocus` :33). Chỉ Esc + click nền + rail nav cho Bản Đồ. UX regression so với scroll composition.
- **Duplicate armed-farm surface + duplicate testid**: `AutoFarmIndicator.vue` (mount `DongFuStage.vue:492`, `data-testid="autofarm-stop"` :35) vẫn render khi overlay mở — `df-scene--covered` (:416) chỉ ẩn `.df-board`/`.df-notice` (:566-567). Cùng lúc `ExplorationPaperDetails.vue:13` render `.exploration-armed` + `[data-testid=autofarm-stop]` thứ hai → hai stop-control cho một state, hai node cùng testid trong DOM.
- **IMPERIAL vs PAPER mode list**: `stage_select` nằm trong cả hai (:41-58) — `scrollMode` không bao giờ nhận giá trị này; `BUILDINGS` map + `useBuildingHeaderState('teleport_array')` (`artPath` :36, `artBroken` :96-100) + nhánh header (tên/level/`BuildingUpgradeButton` :131-150) vẫn computed mà không render — dead logic path còn sống.
- **`openBuild` overlay stacking**: ghi `ui.standalonePanel='skill'` trực tiếp (:86) bỏ qua `openStandalonePanel` → `leftPanelMode` không bị `closeHomeOverlays()` dọn → hai overlay cùng mount; đóng Kỹ Năng lộ lại Bản Đồ. (Beta admittance vẫn qua `GameRoot.vue:85`.)
- **Two selection authorities**: local `selectedZoneId/selectedStageId` refs (init zones[0] + frontier pick :103,:119,:170-176) vs persisted `ui.selectedZoneId/selectedStageId` (ghi lúc start + auto-advance victory) — map mở lại luôn đứng ở **frontier** (stage unlocked đầu tiên), không hydrate từ persisted state → lệch với ải combat vừa advance qua progress-mode.
- **Two mode authorities**: local `mode` reset 'manual' mỗi lần đổi stage (:203-205) vs `ui.battleRunMode` persisted — bình thường exit/victory/defeat paths đã reset 'manual' (`useBattleActions.ts:110`; `CombatVictoryPanel.vue:86,96,104,111`; `CombatDefeatPanel.vue:112`), residue chỉ qua reload (localStorage) hoặc đường tắt.
- **`exploration` naming collision**: `leftPanelMode==='exploration'` = Sản Xuất (`ProductionPanel`, :153); nav id `exploration` bind `stage_select` (rail :236) lẫn building `teleport_array` (paper-nav :56); `LEFT_PANEL_NAV_ID.stage_select='exploration'` (:79). Cùng từ khóa cho hai surface khác nhau.
- **Zones switcher dead trong prod, sống trong preview**: `zones` chỉ 1 zone `thanh_van` (30 stage = 10 mortal + 10 qi + 10 foundation, `Zones.ts:20-26`) → `model.zones.length>1` không bao giờ đúng trong prod → `.exploration-zones` row + `selectZone`/`paperZones`/`isZoneUnlocked` dormant; **nhưng** `ExplorationPreview.vue:29` dựng 2 zones → row vẫn render + `chooseZone` chạy trong preview hôm nay.
- **Scene art cũ chưa dọn**: `exploration-map-frame|mask|chapter-divider` (`StableSceneArt.ts:189-205`, PNG `scene/map/`) + chrome `stage-node` (`:704-718`) + `boss-seal` (`:686-702`) — đăng ký/render sẵn cho composition `.stage-map` đã xóa; không consumer.
- **Stylesheet mồ côi mang skin thứ ba**: `tien-hiep-collections.css` chứa full `.th-collection` skin cho `.exploration-scene`/`.exploration-paper`/`.zone-title`/`.exploration-map`/`.progress`/`.exploration-details` (:11,:110-111,:188-202) và `tien-hiep-progression.css` re-skin `.pc-progression .exploration-details` (:9) — **cả hai file 0 importer + 0 emitter** (`.th-collection`/`.pc-progression` không component nào emit) → dead hai lớp, nhưng vẫn là skin dựng sẵn thứ ba của surface.
- **`.paper-navigation*` global block** (`tien-hiep-ui.css:11-24,:185-186,:202-206,:353-357`): component `PaperPanelNavigation.vue` chỉ mount trong preview-only `PaperPreviewSurface.vue:6,:19`; production references (`ImperialScrollScene.vue:29`, `CharacterFidelityScene.vue:5`) là comments "no PaperPanelNavigation"; `PcPaperSceneActions.vue:5` chỉ import type. Chrome CSS chết theo đúng chủ đề nav-mode.

## 5. Logic không có hình ảnh — logic/state không render

- **Comment gate `teleport_array` stale**: `StageSelectPanel.vue:2-9` ghi "the teleport_array construction gate stays the domain admission check inside the surface" — `ExplorationSurface.vue` không check `buildingManager.getByBuildingId` nào (grep sạch); `openBuilding` chỉ check beta-scope + `functionType` (:136-155); `openLeftPanel` chỉ check `isBetaLeftPanelMode` (`ui.ts:228`); wheel slot `ALWAYS_AVAILABLE` (`commandWheelCatalog.ts:198`); `BETA_BUILDING_FEATURES.teleport_array=null` (`betaScopeSurface.ts:109`). Theo `useBuildingNavigation.ts:9-11` mọi building luôn có instance lv1 (default-built 2026-10-03) → gate xây-dựng **moot by design**, đây là comment stale chứ không hẳn "gate bị mất". Start-path cũng không check.
- `ui.selectedZoneId/selectedStageId`, `ui.combatOrigin` — viết bởi map, đọc bởi combat/result modals; vô hình trên map.
- `assetManager.prefetch(['combat'])` (:76) — vô hình; terrain/details art không nằm trong bundle này.
- `useDialogFocus` (Esc + Tab cycle + mousedown containment + focus restore) — vô hình.
- `noticeTimer` 3.2s auto-clear (:68-73) + `ResizeObserver` scale (`SceneDesignCanvas.vue:20-25`) + `window` keydown DongFuStage (:404) — vô hình.
- Root `@click.self` back-handler (:21) — dead logic (pointer-events).
- `.eyebrow` element (:23) — render nhưng `display:none` global.
- `.exploration-zones` + `paperZones`/`selectZone`/`isZoneUnlocked`/`zoneOptions` — dormant trong prod (single-zone), sống trong preview.
- IMPERIAL branch: header `useBuildingHeaderState` (`artPath` :36, `artBroken`/`watch` :96-100) + `BuildingUpgradeButton` teleport_array — computed chạy, không render.
- Read-model fields `act`/`realmId`/`autoFarmAvailable` — computed trong `modelFor` (:182-190) nhưng surface không đọc.
- Prop `preview` + `.preview-label` — dead trong prod, chỉ preview page.
- `subtitle = getCurrentRealm(zone.requiredRealmId)` (:434-437) → luôn 'Phàm Nhân' với zone duy nhất (`realm.ts:37-38`).
- Audio cues vô hình trong scope: `farm.arm` (:246), `ui.error` (:249), `farm.stop` (:135), rail `ui.wheel.select` (:282).
- Stale comments: `Stage.ts:21-25` nói `requiredRealmLevel` "CHỈ còn dùng để HIỂN THỊ số Tầng N (xem StageSelectPanel.vue)" — surface fidelity hiển thị `{chapter}-{floor} {name}` + `chapterPrefix·label`, field vẫn là floor-label fallback (:294,:391) nhưng pointer + phrasing "Tầng N" đã cũ; `primitives/Chip.vue:89-90` nói "SettingsPanel/StageSelectPanel tints" — PaperDetails dùng `<button class="mode-chip">` raw (:31), không dùng `<Chip>`.
- i18n keys chết trong `vi.json panels.stageSelect` (composition `.stage-map`/`stage-select__*` đã xóa): `aria.filters`, `labels.zoneFilter|chapterFilter|floorPrefix|eliteChance|boss`, `sections.selectFloor|enemies|rewards`, `empty.noStages|selectStage`, `progress.title` (~14 keys, grep zero consumer ngoài locales); keys sống: `chapterPrefix|enemiesSuffix|bossNamePrefix|levelPrefix`, `locked.*`, `modes|modeHints|actions|archetypes`, `rewards.*`. `exploration.navigation` (`vi.json:2193`) không production consumer — preview `t('navigation')` resolve qua `explorationMessages.ts:17` riêng.

## 6. Hình ảnh không có logic — art/DOM trưng bày, unwired

- `.stage-vista` (`PaperDetails.vue:18`, `aria-hidden`) — strip terrain decor, crop qua `backgroundSize 100% 300%`.
- `.chapter-label`/`.chapter.tone` bands — decor màu theo `TONES` index, không semantic/interaction.
- `.routes` svg dashed lines (:25) — decor; `edges` chỉ nối node kề (`ExplorationSurface.vue:312`), không phản ánh unlock-chain.
- `.node-enemy` text mờ dưới node (:27,:44) — decor chữ; `.boss-label` tương tự.
- `scene/map/exploration-map-*` + `exploration-chapter-divider` PNG + `StableSceneArt` registrations (:189-205) — art không consumer.
- `tien-hiep-2026-10/runtime/stage-node@1x/2x.png` (`huyen-kim-chrome.json:704-718`) + `boss-seal@1x/2x.png` (:686-702) — chrome art render sẵn cho stage node/boss, không consumer; map tự vẽ circle 46px + ring skill-v2.
- `PaperPanelNavigation.vue` + `.paper-navigation*` global CSS — component chỉ mount trong `PaperPreviewSurface` preview.
- `.exploration-paper`/`exploration-title` global CSS — rule cho DOM không tồn tại.
- `.exploration-zones` scoped styles + template row — DOM path không render trong prod (zones≤1).
- `.df-building` plaque `teleport_array` + global `.df-building[data-df-building='teleport_array']` (:163) — hotspot chỉ sống trong preview `ui-dong-fu`; preview vẫn render full plaque/symbol/name/upgrade-dot (`DongFuHomeContent.vue:41-65`) và emit `action(id)` → `openBuilding` thật.
- `inv-slot-backdrop.png` — dormant fallback phía sau `--slot-bg-image` override (`SlotView.vue:361,:378`).
- `tien-hiep-collections.css` + `tien-hiep-progression.css` `.exploration-*` rules — skin thứ ba, dead hai lớp (không importer/emitter).
- `teleport_array` building v2 art (`base.png`/`locked-overlay`/`silhouette-mask`) — chỉ qua dead scroll header/preview.

## 7. Open questions — cần chủ dự án quyết

1. Class `.paper` cố ý opt-out khỏi `.exploration-paper` chrome? Nếu không — đổi class kéo theo layout mới (left:156/1272 + global skin) và phải quyết cặp nào giữ.
2. Comment `StageSelectPanel.vue:2-9` mô tả gate "inside the surface" nhưng default-built làm gate moot by design — xóa comment cho khớp hiện trạng, hay muốn thật sự re-introduce admission check khi building system đổi?
3. Không nút đóng hữu hình trên paper surface (scroll có X + backdrop + Esc) — thiết kế hay sót?
4. `.eyebrow` — xóa DOM hay xóa CSS suppression?
5. Hai nguồn selection/mode (local refs vs `ui.selectedStageId/selectedZoneId`/`ui.battleRunMode`) — map có nên hydrate từ persisted state để mở lại đúng ải vừa đánh thay vì frontier?
6. `openBuild` direct-write `standalonePanel` để hai overlay sống song song — cố ý để quay lại map, hay nên qua `openStandalonePanel` (đóng hẳn)?
7. Duplicate `data-testid="autofarm-stop"` (AutoFarmIndicator vs `.exploration-armed`) + hai stop-control đồng thời — giữ cái nào?
8. Art `exploration-map-*`/`stage-node`/`boss-seal` + orphan sheets `tien-hiep-collections.css`/`tien-hiep-progression.css` — dọn registry/disk/files hay giữ chờ dùng lại?
9. i18n keys `stageSelect.*` chết (~14 keys) + `exploration.navigation` — dọn khi nào?
10. `exploration` dual meaning (Sản Xuất panel vs Bản Đồ nav id) — đổi tên nav id cho rõ?

## Adjudication — verify từng finding của reviewer

Legend: ACCEPT = đúng, dung vào report; ACCEPT w/ correction = đúng bản chất, sửa chi tiết; REJECT = sai khi verify.

**Missed (13/13 accepted):**

1. `explorationUi.ts` không liệt kê — ACCEPT. File 77 dòng định nghĩa toàn bộ contract surface; đã thêm vào scope + §2.
2. Listeners/timers — ACCEPT w/ corrections: `noticeTimer` 3200ms :68-73 ✓; `ResizeObserver` SceneDesignCanvas :7,:20-25 ✓; `useDialogFocus` mousedown :79 + card keydown :65 ✓; DongFuStage window keydown :404/:407 ✓ **nhưng reviewer đảo mapping**: thực tế Tab→`toggleRail` (:389-392), Backquote→`toggleCommandWheel` (:397-399); cả hai gated `!surfaceOpen` đúng như finding. Bổ sung Esc→`closeCommandWheel` (:381-384).
3. Store fields — ACCEPT: `completedStageIds` :192 + `perfectClearStageIds` :208 feed `zoneProgress`/perfect_farm gate; `ui.combatOrigin` :180 ghi :351 đọc `CombatResultModal.vue:20`/`CombatExitConfirmModal.vue:67`; `standalonePanel` write :86.
4. `openBuild` không đóng map — ACCEPT + nới rộng: bypass `closeHomeOverlays` (:252 trong `openStandalonePanel`) → hai overlay sống; beta vẫn enforce ở `GameRoot.vue:85` watcher. Cùng family: `ui.leftPanelMode=null` direct write :247.
5. Dead model fields — ACCEPT: `autoFarmAvailable` (:66 decl, :190 assign), `act` (:57,:182), `realmId` (:58,:183) — surface không đọc (dùng stage.chapter/requiredRealmId/perfectClear). Cite :172/:174 của reviewer là fn start, assignments :182-183.
6. Global CSS chưa map — ACCEPT: `.slot-view --slot-bg-image` :56-58 → slot-frame.png; `.paper-navigation*` :11-24,:185-186,:202-206,:353-357 — verified `PaperPanelNavigation` chỉ mount `PaperPreviewSurface.vue` (prod refs = comments/type-import); `.df-building` :163.
7. Art chưa map — ACCEPT: `boss-seal` `huyen-kim-chrome.json:686-702` zero consumer (file tồn tại `runtime/boss-seal@1x/2x.png`); `navigation-landscape-seam-v1.png` `DongFuStage.vue:198` render `v-if=surfaceOpen` :471; `slot-frame.png`; `inv-slot-backdrop.png` dormant fallback `SlotView.vue:361,:378`.
8. Preview 2-zone — ACCEPT: `ExplorationPreview.vue:29` thanh_van + huyen_phong → `.exploration-zones` reachable ngay trong preview.
9. Preview chrome — ACCEPT: `DongFuVista` :7 + parallax :73-75 + `Tooltip` :78.
10. Cues/comments — ACCEPT w/ corrections: `farm.arm` :246 + `ui.error` :249 ✓ (+ direct write `leftPanelMode=null` :247); rail `ui.wheel.select` :282 ✓ (cue dùng chung, cũng :332 wheel); `Chip.vue` đúng path là `components/common/primitives/Chip.vue:89-90` (reviewer viết `Chip.vue:90`); PaperDetails dùng `.mode-chip` raw :31 (không phải `.chip` :32 — cite lệch 1 dòng, ý đúng); `Stage.ts:21-25` partially stale (field vẫn floor-fallback :294,:391, pointer/phrasing cũ).
11. `zoneProgress` :186-197 — ACCEPT, đã thêm §2.
12. data-testid surfaces — ACCEPT (minor), fold vào §1 (`scene-viewport` testid `SceneDesignCanvas.vue:29`).
13. Gate beta thứ hai — ACCEPT w/ correction: gate ở `mode` computed `FunctionOverlayPanel.vue:74` dùng `isBetaLeftPanelMode` (không phải `isBetaFeatureEnabledForPlayer` trong `paperMode` như reviewer ghi); comment :71-73 xác nhận "mount-seam chokepoint".

**Wrong (9/9 accepted, 1 amplified):**

1. Gate teleport_array — ACCEPT: `useBuildingNavigation.ts:9-11` "moi building luon co instance lv1" → gate moot by design; comment `StageSelectPanel.vue:2-9` là stale. Report đã reframe §5 + Q2.
2. "init first stage zone 0" — ACCEPT: `selectFirstStageInZone` :170-176 chọn frontier (first non-locked), fallback `stageIds[0]` khi all-locked.
3. `battleRunMode` residue — ACCEPT: `exitCombatToHome` :110 + `CombatVictoryPanel` :86,96,104,111 + `CombatDefeatPanel` :112 reset 'manual'; residue chỉ qua reload/localStorage.
4. Line drifts — ACCEPT tất cả: `artPath` :36 (không :33); `stage-node` :704-718; `df-scene--covered` :566-567; `closeHomeOverlays` :258-263; `betaScopeSurface` `stage_select:null` :161; `StableSceneArt` path `src/presentation/huyenKim/`.
5. `v-tooltip` attribution — ACCEPT: directive `SlotView.vue:248`; `PaperDetails.vue:26` chỉ truyền `:tooltip` prop.
6. "Gate mở duy nhất" — ACCEPT (xem Missed #13).
7. `artPath` cite + dead header logic — ACCEPT: `artPath`/`artBroken`/`watch` :36,:96-100 dead-path tính cho header không render.
8. Close-button comparison — ACCEPT: `ImperialScrollScene` có X (:100-105) + `@click.self` (:47) + Esc (:33); paper chỉ Esc + backdrop qua `DongFuStage.onSceneClick`.
9. `.df-building` preview-only — ACCEPT: `DongFuHomeContent.vue:41-65` render full plaque + `emit('action',id)` :49 → chain `DongFuFidelityScene` :80,:82,:90 → `openBuilding`; chỉ preview `DongFuPreview.vue`.

**Self-found corrections (không có trong reviewer findings — verify khi đọc code):**

- Report gốc §2 liệt kê `CombatTopBar.vue:31-38`, `CombatIntroOverlay.vue:26-33`, `useVictorySceneModel.ts:34` là `battleRunMode` readers — SAI: cả ba đọc `ui.selectedStageId`/`selectedZoneId`. `battleRunMode` readers thực: `useBattleActions.ts:84`, `CombatVictoryPanel` :71,:119,:129, `CombatDefeatPanel` :142.
- Report gốc (verified-ok #14) nói "không file CSS global nào khác động vào `.exploration*`" — SAI: `tien-hiep-collections.css` (:11,:110-111,:188-202) + `tien-hiep-progression.css` (:9) đều chứa `.exploration-*` rules; cả hai file orphan (0 importer, 0 emitter `.th-collection`/`.pc-progression`) → dead hai lớp (khớp note của adjudicator trang-bi trong phase file).
- `usePaperNavigation` "zero production consumer" — đúng, nhưng `SettingsSurface.vue:4` có comment nhắc nó (không import); consumer thực chỉ `ui-preview/paperNavigation.ts`.
- `ImperialScrollScene` không chỉ bị PAPER_MODES shadow — template :152-154 không có branch `stage_select` nào (chỉ `ProductionPanel` cho `exploration`) → dead hai lớp.
