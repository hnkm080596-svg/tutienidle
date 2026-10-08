# Panel: Động Phủ — vista/stage

Phạm vi audit: nhánh `devin/artui-c0-foundation` (snapshot `8ffc8e64`), toàn bộ đường dẫn sống + đường dẫn ngủ/legacy vẫn import được trong `game/`. Đọc code, không chạy app. Đã qua vòng adjudication: mọi cite đối chiếu lại với code thật.

## 1. Mount chain — từ nav/route đến component gốc

```
main.ts ── App.vue ── GameRoot.vue ── MainScene.vue ──┬─ DongFuStage.vue (DOM, SceneDesignCanvas)
                                                    └─ PhaserCanvas.vue ─ Phaser.Game ─ game/scenes/MainScene.ts
```

- `src/main.ts:5-11` load 7 CSS global theo thứ tự: `theme.css`, `huyen-kim.tokens.css`, `system-theme.css`, `tien-hiep-ui.css`, `tien-hiep-secondary-ui.css`, `tien-hiep-auxiliary.css`, `pc-paper-production.css`. Riêng `pc-paper-scene.css` do `DongFuStage.vue:33` tự import (không qua main.ts). Ba file secondary/auxiliary/system-theme không chứa selector `.df-*`/`.home-*`; `tien-hiep-secondary-ui.css:27-28` chỉ có rule `.game-button--*` scoped dưới overlay/modal panel — không đụng chrome của stage.
- `src/App.vue:1291-1293`: `<GameRoot v-if="isBooted" :inert="authorityOverlayActive" />` — GameRoot chỉ mount sau boot; `isBooted` set ở `App.vue:1084`, inert khi overlay quyền lực (reconnect/terminal) chiếm (`App.vue:820-821`).
- `App.vue:915` `tick()` — chạy mỗi 1s qua `startTickLoop` (`useAppLifecycle.ts:236-254`, `TICK_INTERVAL_MS = 1_000` tại `SpeedSettings.ts:10`): bump `stateVersion` (`App.vue:1013` → provide ở `App.vue:517-518`) và emit `cultivation_changed` (`App.vue:955`). Đây là producer gốc cho cả `useGameState` bridge lẫn subscription `cultivation_changed` của `MainScene.ts`.
- `src/components/layout/GameRoot.vue:138`: `<MainScene @click="closeSidePanels" />` → `ui.closeHomeOverlays()` (`GameRoot.vue:130-132`). Panels overlay (LeftPanel, FunctionOverlayPanel, standalone panels, CombatSceneOverlay, TribulationSceneOverlay) là sibling, ẩn/hiện theo route (`GameRoot.vue:140-178`). Trên đó là lớp chrome toàn cục render ĐÈ lên stage khi bắn: `Tooltip`, `ToastContainer`, `ActionFeedbackLog`, `WorldAnnouncementOverlay`, `OfflineSummaryModal`, `TalentEntitlementModal`, `BreakthroughRequirementPanel`, `TutorialOverlay` (`GameRoot.vue:180-203`) + `RouteMount` renderless. `GameRoot.vue:78-100` watch `standalonePanel` (chokepoint scope-gate + bounce toast `panels.hkNav.techniqueLocked`); `GameRoot.vue:110-123` `requestIdleCallback` warm lazy panel chunks.
- `src/components/game/MainScene.vue:11-21`: `.main-scene` (absolute inset:0, nền `--ink-950`) chứa `<DongFuStage />` (mount thường trực, không v-if) rồi `<PhaserCanvas />`. Comment `MainScene.vue:12-17`: DongFuStage là DOM overlay `position:fixed` vẽ TRÊN canvas Phaser trong suốt.
- `src/components/scenes/dong-fu/DongFuStage.vue:412`: `<SceneDesignCanvas v-if="!stageActive">` — viewport `position:fixed; inset:0` nền `#111c21` (global override `#15221e` tại `tien-hiep-ui.css:10`) + canvas thiết kế 1440×810 scale đều qua ResizeObserver (`SceneDesignCanvas.vue:4-25,37`). Toàn bộ vista + chrome sống nằm trong canvas này. **Chú ý:** v-if chỉ gỡ SceneDesignCanvas khỏi template — component DongFuStage vẫn mounted, nên `FeedbackDialog` (ngoài v-if, teleport ra `body` — `FeedbackDialog.vue:362`), keydown listener (`DongFuStage.vue:403-408`), `setInterval` 30s của `useThienCoEntries` (`useThienCoEntries.ts:46-53`) và `noticeTimer` đều SỐNG xuyên combat/tribulation.
- `src/components/game/PhaserCanvas.vue:143-166`: `useDynamicRegion` tạo 1 Phaser.Game duy nhất, `transparent:true` (169), dynamic-import 4 scene `[AssetLoaderScene, MainScene, CombatScene, TribulationScene]` (150-164). File scene thứ 5 `game/scenes/TranPhapCombatPreviewScene.ts` tồn tại nhưng KHÔNG được đăng ký. `seedRegion` (56-139) ghi gate `eventBus`, `gameManager`, `sceneAdapter`, `bundleManager`, đăng ký 3 bar reader (`registerKiemBarReader`/`registerTheBarReader`/`registerHoTheReader`, ~91-97) và — quan trọng — `publishProfile()` + `watch` (103-131) chính là producer emit `player_visual_profile_changed` mà `MainScene.ts` subscribe. `onBooted` gán `window.__tutienPhaserGame` (~190) và reset ở `onTeardown` (~211); watch retry `routeAdapter.transitionId` (~231-240) tự `region.start()` lại khi boot lỗi. `.phaser-canvas` 100%×100% không position → nằm dưới mọi sibling có position (~263-266).
- `src/presentation/host/useDynamicRegion.ts:315-333`: ResizeObserver trên container gọi `game.scale.resize` → kích `MainScene.resizeHandler` (`MainScene.ts:148-150`). Hai ResizeObserver song song: một scale DOM canvas (SceneDesignCanvas), một resize Phaser game.
- `src/game/scenes/MainScene.ts`: Phaser scene 'MainScene' — nền rect trời/đất + sprite player + nameplate. **Hai đường render tách biệt theo `ENTITY_ART_MODE`** (`EntityArtMode.ts:16` = `'static'`, compile-time): đường static (texture swap theo profile/pose) là đường chạy thật; toàn bộ nhánh animated (`MainScene.ts:219-258` registerClipCatalogue + CULTIVATE_BRIDGE_KEY, `playCurrentPoseClip` 368-390, `currentClipSourceSize` ~345-360, nhánh animated của `updateSpriteDisplaySize` 308-313 + `refreshPlayerTexture` 397-400) là dead code compile-time — không bao giờ chạy. Doc comment `MainScene.ts:86-91` nói scene tự `this.scene.start('CombatScene')` khi 'battle_start' — **stale**: không dòng code nào làm vậy; mechanism thật là `PhaserSceneAdapter.ts:171` `game.scene.start(sceneKey)` theo `PRIMARY_SCENE_ROUTES` (`PhaserSceneAdapter.ts:16-17`, `{home,combat,tribulation}→scene`).
- Route gate: `useStageActive` (`composables/useStageActive.ts:9-19`) → true khi activeRoute 'combat'|'tribulation' → `v-if` gỡ DOM stage. Mount witness: `RouteMount.vue` renderless.
- Hai đường đóng overlay khác nhau: `@click.stop` trên `main.df-scene` (`DongFuStage.vue:419`) chặn bubble — click trong canvas chạy `onSceneClick` (→`closeHomeOverlays` nếu không trúng `INTERACTIVE_SELECTOR`); click vào letterbox của `.scene-viewport` (vùng ngoài canvas scaled) bubble lên `GameRoot.closeSidePanels`. Hai handler cùng đích nhưng hai đường riêng.

## 2. UI logic inventory — mọi computed/store-read/emit/directive/props feed DOM

**DongFuStage.vue (script 1-408, template 411-498):**

Stores/composables:
- `useUiStore()` → `leftPanelMode`, `characterOverlayOpen`, `characterSceneTab`, `standalonePanel`, `isCommandWheelOpen`, `closeHomeOverlays`, `openLeftPanel`, `openStandalonePanel`, `toggleCommandWheel`, `closeCommandWheel` (`stores/ui.ts:123-277`).
- `usePlayerStore()` → `name`, `realmId`, `realmLevel`, `cultivationProgress`, `autoFarmStage`, `duyenPhan`.
- `useGameManager()` + `useStateVersion()` → `realmAdvanceOps.canTriggerBreakthrough`, `questOps.getBetaQuestSurfaceModels`, `alchemyOps`, `materialBag` (bridge tick `useGameState.ts:32-41`, producer = tick 1s ở App.vue).
- `useStageActive()` (route combat/tribulation), `useBuildingNavigation()` (openBuilding/getBuildingPresentation/getBuildingStatus), `useThienCoEntries()` (bảng Thiên Cơ; interval 30s `useThienCoEntries.ts:29,46-53` — chạy nền kể cả trong combat vì component không unmount), `useCurrencyChips()`.
- `useAudioStore().cue('ui.wheel.select')` — side-effect phát âm trên mọi click rail (`DongFuStage.vue:282`, trong `navAction`) và slot wheel (`DongFuStage.vue:332`, trong `activateSlot`).

Computed/ref feed DOM trực tiếp:
- `surfaceOpen` (56-58) = `leftPanelMode || characterOverlayOpen || standalonePanel` → class `df-scene--covered` (416) + `v-if` seam img (471). Không chứa `isCommandWheelOpen`/`feedbackOpen`.
- `feedbackOpen` (60), `boardOpen` (61, **mặc định true**), `railCollapsed` (62), `railIndicator` (63) — indicator chỉ hiện sau `transitionend` transform (78-80).
- `watch(surfaceOpen)` (67-69) → surface mở thì đóng dialog feedback.
- `notice` + `noticeTimer` (82-95) → `.df-notice`, flash 3.2s.
- Wheel: `disabledContext` (100-107, cờ domain + release), `renderedSlots` = `betaWheelSlots().filter(available)` (109), `SLOT_SYMBOL` (111-127), `slotDisabledReason` (129), `slotActive` (133-142), `slotBadge` (144-153: 'alert' breakthrough / 'dot' ready|upgradeable), `slotAction` (155), `wheelActions` (166) → props `DongFuWheel` (481-485: `actions`, `selected=null`, `open=ui.isCommandWheelOpen`, `@action=onWheelAction`).
- Board: `KIND_SYMBOL` (170-176), `boardEntries` (178-188) → `DongFuBoard` (486-491).
- `onWheelAction` (347-359): tra `entries` (board) trước, rồi slots, cuối `flashNotice(t('dongFu.unhandled'))` — chung namespace id giữa board entry ('quest','breakthrough','ready:*'…) và slot id ('quest','realm'…).
- Vista/chrome: `sceneBackground` (191), `sceneStyle` (192-196: bg + `pcPaperControlStyles()` + `--home-nav-art`), `navBackingUrl` (197), `navSeamUrl` (198).
- Rail: `NAV_LOCKED` 5 id ngủ (203), `NAV_ITEMS` 21 id (204-208), `NAV_FEATURE_LOCKED` formation→'tran_phap' (214-216), `navLocked` (217-221), `NAV_TARGET` (226-245), `NAV_ACTIVE_PANEL` (249-256), `NAV_ACTIVE_STANDALONE` (258-265), `navActive` (267-278), `navAction` (280-291: cue `ui.wheel.select`, id≠feedback thì đóng dialog, home→closeHomeOverlays), `toggleRail` (71-76).
- Header/quest: `realmName` (296), `CHIP_ICON` map theo INDEX `{0:crystal,1:jade,2:coin,3:essence}` (298), `currencyChips` (299-307), `trackedQuest` (309-313), `questCard` (315-325), `profileProgress` (327).
- Input: `INTERACTIVE_SELECTOR` (364), `onSceneClick` (366-369), `isEditableTarget` (371-378), `onKeydown` (380-401: Escape→`closeCommandWheel()` — không đóng panel/dialog; Tab→`toggleRail()` khi `!stageActive&&!surfaceOpen`; Backquote→`ui.toggleCommandWheel()` khi `!stageActive&&!surfaceOpen&&!feedbackOpen`), listener mount/unmount (403-408).
- `data-hk-scene="dong-fu"` (415) — marker inert: cùng pattern `ImperialScrollScene.vue:47`, `AuthEntryScreen.vue:161`, `CreationSceneLayout.vue:2`, nhưng grep toàn repo không có selector CSS hay `querySelector`/`getAttribute` nào đọc `[data-hk-scene]`.

DOM (template): `header.home-design-profile` (421-427), `.home-design-currencies` (428-432), `button.home-design-quest` (433-445 — **nút thật**: `@click="ui.openStandalonePanel('quest')"` tại 439), `aside.home-navigation-surface` (446-470), seam img (471), toggle `»` (472-479), `<DongFuWheel>` (480-485), `<DongFuBoard>` (486-491), `<AutoFarmIndicator>` (492), `.df-notice` (493), `.pc-paper-scene__frame` (494), `<FeedbackDialog>` ngoài v-if (497) — teleport `body`, layer `OVERLAY_LAYERS.modal`, render unscaled ngoài hệ tọa độ 1440×810.

**Con sống:**

- `fidelity/DongFuWheel.vue`: props `actions/selected/open` (5); `nodes` computed đặt orb trên vòng r=187 tâm 210 (14-27); `activate` chặn `disabledReason` (28-31); DOM `.df-wheel/.df-wheel__orbit/.df-node/.df-node__orb/img/.df-node__badge(--dot|--alert)/.df-node__label` (33-55).
- `fidelity/DongFuBoard.vue`: props `entries/open` (5); emit `action/toggle` (6); `InkNineSlice chrome-id="surface-l-drawer"` (11).
- `components/game/AutoFarmIndicator.vue`: `armedStageName` từ `player.autoFarmStage` + `catalogOps.getStage().name` (16-23); `stopAutoFarm` (25-27); DOM `.auto-farm-indicator` + GameButton `variant="danger"` (31-38) — nút này chịu `.game-button` reskin global.
- `components/common/FeedbackDialog.vue`: props open/layer/initialDescription (42-56), emit close; `<Teleport to="body">` (362); autosave draft sessionStorage (149-195).
- `components/common/SceneDesignCanvas.vue`: props width/height/overlay; ResizeObserver → scale (4-25).
- `components/common/PcPaperButton.vue`: props variant/icon; emit click — chip tài nguyên là nút thật nhưng **không có @click** (429-431 → nút trưng bày).

**Phaser `game/scenes/MainScene.ts`:** `skyRect/groundRect` (192-193), player sprite + label (211-217), gate `playerVisualProfileId/Armed/CultivationWay` (197-209), nhánh animated gating `ENTITY_ART_MODE==='animated'` — compile-time dead (219-258, 308-313, 345-360, 368-390, 397-400), `applyBackgroundLayout` (275-296), `updateSpriteDisplaySize` (303-325 — chỉ nhánh static chạy), `textureKeyForCurrentPose` (328-338), `refreshPlayerTexture` (392-407 — chỉ nhánh static), `positionPlayer` (414-424), subscribe `cultivation_changed` + `player_visual_profile_changed` (426-448), `onCultivationChanged` (453-468), `resizeHandler` (148-150), `shutdownHandler` (152-163), `reportReady` (266-270).

**Pipeline ngủ vẫn import được:**
- `useCurrencyChips.ts:32-68`: spirit-stone 3 bậc + companionChips (gated `isBetaFeature('companion')` → luôn [] trong beta).
- `useThienCoEntries.ts:61-153`: entries từ breakthrough/quest claimable/building status, lọc `isBetaBuildingSurface`, max 4.
- `data/ui/commandWheelCatalog.ts:88-245`: 15 slot đầy đủ; `betaWheelSlots()` (`core/betaScopeSurface.ts:92-94`) lọc scope; `talisman_slot` được admit (`betaScopeSurface.ts:70` null) nhưng `available=NEVER_AVAILABLE` → lọc ra ở `renderedSlots`.
- `isBetaStandalonePanel`/`isBetaBuildingSurface` (`betaScopeSurface.ts:118-170`) fail-closed; `chi_hien_quan`→'manualWorkforce' (76).
- `useBuildingNavigation.ts`: `openBuilding` fail-closed (137-155); `getBuildingStatus` locked>ready>active>upgradeable (81-107); `upgradeBuilding` (115-135, caller ngoài scope chỉ `BuildingUpgradeButton.vue` trong panels).
- `DongFuBuildingArt.ts`: `DONG_FU_BUILDING_IDS` sống (import `useThienCoEntries.ts:6`); **`DONG_FU_BUILDING_ART` + `dongFuBuildingAssetUrls` + `dongFuSeasonOverlayUrl` vẫn CHẠY** — được `AssetBundleCatalog.ts:803-809` gọi khi build 'ui-scenes' warm list; phần chết thật chỉ là geometry metadata (pixel bounds/hitbox/placement, 48-134) và `dongFuBuildingTimeClass` (151-153).
- `DongFuArt.ts` + `DongFuStackLoader.ts`: 12 layer modular theo season/time — sống qua `AssetBundleCatalog.ts:256-262` ('home' bundle, `peekThanhVanVariant()` chọn variant hiện hành) + `784-791` ('ui-scenes' enumerate full matrix). `selectNextThanhVanVariant` (`ThanhVanBackdropArt.ts:104`) được `CombatScene.ts:2367` gọi thật để rotate variant sau mỗi battle — phần rotation của pipeline modular vẫn sống, chỉ phần *render* Dong Fu không còn consumer.
- `fidelity/dongFuUi.ts`: `DONG_FU_ART` (5-10), `symbolUrl` (12-14 — SỐNG qua Wheel/Board); `DongFuUiModel` + `frameMetadata` chỉ preview.
- `fidelity/DongFuFidelityScene.vue` (root `.df-scene`, line 25), `DongFuVista.vue`, `DongFuHud.vue`, `DongFuHomeContent.vue`, `DongFuArtFrame.vue` — chỉ `ui-preview/DongFuPreview.vue` mount; entry `legacy/ui-dong-fu.html` **vẫn tồn tại** và vẫn `<script src="/src/ui-preview/dong-fu.ts">` → preview vẫn serve được ở đường dẫn legacy, không mồ côi. Fixture i18n riêng `ui-preview/dongFuMessages.ts`.
- `components/game/CurrencyHud.vue` + `hud/DongFuResourcePill.vue` — không ai mount ngoài `CurrencyHud.test.ts` → chết.
- `ui-preview/LandscapeDesignPreview.vue` — mock được duyệt mà DongFuStage chép verbatim (entry `ui-landscape-design.html` còn sống ở root).

## 3. Art map — file art + element dùng nó

**Sống (render trong DongFuStage):**

| Art | Đường dẫn | Element | Cite |
|---|---|---|---|
| Vista nền | `/assets/ui/tien-hiep-2026-10/source/world-vista-warm-v1.png` | `main.df-scene.landscape-design` background 100% stretch | DongFuStage.vue:191-194, 508 |
| Medallion nút rail | `controls/navigation-medallion-v1.png` | `--home-nav-art` → `button::before` mỗi nav item | DongFuStage.vue:195, 538 |
| Backing rail | `controls/navigation-backing-dark-v3.png` | `img.home-navigation-backing` | DongFuStage.vue:197,447,513 |
| Seam khi panel mở | `controls/navigation-landscape-seam-v1.png` | `img.home-navigation-landscape-seam` | DongFuStage.vue:198,471,514 |
| 21 icon rail | `icons/navigation-{id}-v2.png` | `img` trong nav button (22 file tồn tại cho 21 id) | DongFuStage.vue:458 |
| Avatar | `icons/character.png` (pcPaperIconUrl) | `.home-design-avatar img` | DongFuStage.vue:422; PcPaperIcons.ts |
| 4 icon tài nguyên | `controls/resource-{crystal,jade,coin,essence}-v1.png` | `img` trong chip | DongFuStage.vue:298,430; PcPaperControls.ts:3-6 |
| Button secondary | `controls/button-secondary-v1.png` | `--pc-secondary-button` → `::before` chip + nút Stop auto-farm | DongFuStage.vue:194; pc-paper-scene.css:36; pc-paper-production.css:9 |
| Orb frame | `tien-hiep-2026-10/runtime/orb-frame.png` | `--th-art-orb-frame` → `.df-node__orb` (global) | tien-hiep-ui.css:65-68; TienHiepUiAssets.ts |
| Board chrome | `runtime/surface-l-drawer@1x/@2x.png` | `InkNineSlice` trong DongFuBoard | DongFuBoard.vue:11; ui/huyen-kim-chrome.json:86-99 (status ready, center transparent) |
| Symbols SVG | `huyen-kim/symbols/*.svg` | orb img + board icon qua `symbolUrl()` | dongFuUi.ts:12-14; DongFuWheel.vue:51; DongFuBoard.vue:16 |
| Frame CSS | — | `.pc-paper-scene__frame` viền 1px | DongFuStage.vue:494; pc-paper-scene.css:15 |
| Font | `/assets/fonts/source-serif-4/{regular,bold}.ttf` | `--pc-font-body/title` toàn chrome stage | pc-paper-type.css:6,13 |
| `--pc-primary-button` | `controls/button-primary-v1.png` | set trên scene root; rule `.pc-paper-button::before`/`.game-button::before` có đọc nhưng **luôn thua** modifier `--secondary`/`--danger` trong stage → không render px nào | DongFuStage.vue:194; pc-paper-scene.css:34; pc-paper-production.css:6,9 |
| `--pc-slot-art`, `--pc-inspector-art` | `item-slot-v1.png`, `inspector-v1.png` | set trên scene root; **không consumer trong stage** (`.pc-paper-slot`/`.pc-paper-inspector` chỉ trong ui-preview; `#global-tooltip` đọc `--pc-inspector-art` ở `pc-paper-production.css:20` nhưng teleport ra body, ngoài `.df-scene`) | DongFuStage.vue:194; pc-paper-scene.css:40,47 |

**Global CSS đụng DOM sống:** `.scene-viewport` nền (tien-hiep-ui.css:10); `.df-scene .df-node__orb` (65-69: thay gradient+shadow bằng orb-frame art) + media `prefers-reduced-motion` (197-199); `.df-node__label` (70); `.df-scene .df-board` (74, 229, 260-261 + `::before` kem), `.df-board__heading/__copy/__empty/__entry/__go` (76-79, 230: `--th-art-button-primary` CTA); `.ink-nine-slice--hk.ink-nine-slice--hk-frame{box-shadow:none}` (85 — đụng board vì `surface-l-drawer` center transparent → class hk-frame); `.game-button` base + modifier (`tien-hiep-ui.css:80-84`, `pc-paper-production.css:5-14` — đụng nút Stop `AutoFarmIndicator`); `.feedback-dialog` block (`pc-paper-production.css:52-61` — dialog teleported); `.th-panel-swap-*` transitions (`tien-hiep-ui.css:373-378` — panel overlay đè stage); `.hk-art-scene` box-sizing (`pc-paper-production.css:67-69` — root sống mang class này, DongFuStage.vue:414); khối "Rail over panels" (`tien-hiep-ui.css:381-411`: scene-root overlay `pointer-events:none`, children `auto` — cơ chế giữ rail bấm được dưới panel).

**Ngủ/chỉ preview:** `huyen-kim/scene/dong-fu-v2/*` → Vista/HomeContent/ArtFrame; `runtime/{building-plaque,avatar-frame,resource-pill,icon-button-utility,identity-plate,title-plaque}*` → Hud/HomeContent/CurrencyHud/ResourcePill; `backgrounds/dong-fu/modular/**` ~48MB + `buildings/dong-fu/v2/**` ~24MB + season overlays → warm thật mỗi session qua `AssetBundleCatalog.ts` ('home' required + 'ui-scenes' prefetch), không renderer nào dùng; multiatlas `char-cultivate` 17 frame trong bundle 'tribulation' (`AssetBundleCatalog.ts:241-249`) phục vụ nhánh animated đã chết; `navigation-backing-v1.png`, `navigation-connector-v1.png`, `button-primary.png`… không selector nào tham chiếu trong scope.

## 4. Conflicts / layers — 2 phiên bản UI cùng tồn tại

1. **Hai nguồn art vista**: stage sống vẽ 1 PNG `world-vista-warm-v1.png` (191), trong khi pipeline modular 12-layer (~48MB) + sprite building (~24MB) vẫn warm mỗi session (`AssetBundleCatalog.ts:254-262, 784-810`) — tải thật, không renderer dùng. Comment `MainScene.ts` còn nhắc asset vista cũ — stale.
2. **Hai quest card**: `.home-design-quest` sống (433-445, click → QuestPanel) vs `.df-quest` chỉ preview (`DongFuHomeContent.vue`) + CSS global `.df-quest` còn nguyên (`tien-hiep-ui.css:235, 270-271`).
3. **Hai resource strip**: `.home-design-currencies` sống vs `CurrencyHud.vue`/`DongFuResourcePill.vue` chết trong tree; `useCurrencyChips.ts:2-3` vẫn ghi comment "HUD và pill strip giống nhau".
4. **Ba lớp điều hướng building**: rail NAV_TARGET vs wheel catalog vs plaque `.df-building` chỉ preview. Comment `commandWheelCatalog.ts:247` còn nói "hotspot layer dung chung danh sach nay" — hotspot layer không còn trong production.
5. **Global reskin đè scoped**: `.df-node__orb` scoped (DongFuWheel.vue:65) thua `:is(#app,body) .df-scene .df-node__orb` (65-68); `.df-board` scoped vs global (74, 229-230, 260-261): heading `var(--df-gold-light)` thua `#30291d` global.
6. **Phaser MainScene**: đường static (sky/ground/sprite/label/texture-swap/subscribe) chạy thật nhưng **vô hình** — SceneDesignCanvas opaque `inset:0` che kín (comment 9-12 tự thừa nhận); đường animated là **dead code compile-time** (`ENTITY_ART_MODE='static'`), không chạy chứ không phải "chạy vô hình". Doc comment 86-91 mô tả mechanism `scene.start` đã dời sang `PhaserSceneAdapter` — stale doc.
7. **CHIP_ICON theo index** (298): 0→crystal,1→jade,2→coin,3→essence — lệch thứ tự mock (`jade,coin,crystal,essence`, `LandscapeDesignPreview.vue:58`) và đổi icon nếu `useCurrencyChips` đổi thứ tự; index 3 không tới trong beta.
8. **`v-if="!stageActive"` ngoại lệ**: FeedbackDialog mount ngoài v-if + teleport body (497, `FeedbackDialog.vue:362`); keydown listener + interval 30s của `useThienCoEntries` vẫn sống trong combat/tribulation vì component không unmount.
9. **`surfaceOpen` vs wheel**: wheel không thuộc surfaceOpen — rail/Tab/Backquote khóa khi panel mở (389-400); board + notice bị `df-scene--covered` ẩn (566-567); rail + profile + currencies + quest card vẫn hiển thị/bấm được dưới overlay panel (by design "rail over panels", `tien-hiep-ui.css:381-411`).
10. **`selected` chết**: `:selected="null"` (482) → `.is-selected` không bao giờ đúng; prop chỉ còn ý nghĩa ở preview.
11. **Namespace id chung**: `onWheelAction` tra entries trước slots (347-359) — 'quest' tồn tại cả hai phía; hôm nay trùng kết quả nhưng dễ lệch.
12. **Chip là button không hành động**: `PcPaperButton` chip currency không `@click` (429-431) — nút giả; quest card thì là nút thật → bất đối xứng trong cùng chrome.
13. **`.df-scene` shared selector**: global `.df-scene .df-*` áp cả cho preview (`DongFuFidelityScene` root `.df-scene`, line 25) lẫn production — một rule CSS nuôi hai thế hệ UI.
14. **Hai đường dismiss**: `@click.stop` trên `.df-scene` (419) tách click-canvas (`onSceneClick`) khỏi click-letterbox (`GameRoot.closeSidePanels`) — cùng gọi `closeHomeOverlays()` nhưng qua hai handler; thêm `.df-scene` riêng có `onSceneClick` với `INTERACTIVE_SELECTOR` filter.
15. **Audio cue đồng nhất**: `ui.wheel.select` phát trên cả rail nav (282) lẫn wheel slot (332) — một cue cho hai loại hành động; không cue cho quest card/board/toggle.
16. **MainScene.vue mount thường trực**: `<DongFuStage />` không v-if — toàn bộ script (listeners, timers, watchers) sống xuyên combat; chỉ template bị cắt. (Đã merge vào mục 8 nhưng là conflict sâu hơn: "v-if gỡ stage" chỉ gỡ DOM, không gỡ logic.)

## 5. Logic không có hình ảnh — logic/state không render ra gì

- Toàn bộ output **static** của `game/scenes/MainScene.ts` (sky/ground rect, sprite, label, `onCultivationChanged`, `playerVisualProfileHandler`, `positionPlayer`) — render dưới DOM opaque, không khung hình nào cho người chơi thấy (canvas chỉ lộ khi CombatScene thay thế).
- Toàn bộ nhánh **animated** của MainScene.ts — dead compile-time theo `ENTITY_ART_MODE='static'` (`EntityArtMode.ts:16`); atlas `char-cultivate` vẫn ship trong bundle 'tribulation'.
- `CHIP_ICON[3]` 'essence' + `companionChips` (`useCurrencyChips.ts:47-66`) — gated `isBetaFeature('companion')`, không render; `player.duyenPhan`/`duyenPhan.shortName` theo đó cũng không render.
- `slot.talisman_slot` (`commandWheelCatalog.ts:150-155`) — scope-admit nhưng `available()` false → logic disable/badge chạy nhưng không có DOM.
- `wheelActions`'s `selected`/`is-selected` — luôn null.
- `DongFuHomeContent`'s `upgrade` emit + badge 'upgrade' (`dongFuUi.ts:23`) — chỉ preview; `useBuildingNavigation.upgradeBuilding` không caller trong scope.
- `phap_bao`/`formation_slot`/`companion_roster` `disabledReason` context — slot bị beta-filter trước (`betaScopeSurface.ts:69-72`) nên tooltip lock không bao giờ hiện trong beta.
- `RING_3_BUILDING_IDS` export (`commandWheelCatalog.ts:248-250`) — không consumer sống (hotspot layer đã xóa).
- `data-hk-scene="dong-fu"` (415) — marker không consumer trong scope.
- `initTransitionId`/`initGameGeneration`/`reportReady` (MainScene.ts:179-185, 266-270) — lifecycle, không hình ảnh.
- `railIndicator` — chỉ điều khiển nút `»` 30×88px.
- `stateVersion`/`bumpState` + `useThienCoEntries` 30s ticker — reactivity bridge, không render trực tiếp (ticker còn chạy nền xuyên combat).
- `publishProfile`/`__tutienPhaserGame`/transitionId retry (PhaserCanvas) — producer/debug plumbing, đúng vai trò.
- `peekThanhVanVariant` trong 'home' descriptor — chọn variant để warm art chết; `selectNextThanhVanVariant` sống nhưng phục vụ combat backdrop (`CombatScene.ts:2367`), ngoài vista.

## 6. Hình ảnh không có logic — art/DOM trưng bày, unwired

- `.pc-paper-scene__frame` (494) — viền trang trí.
- `.home-navigation-landscape-seam` (471) — seam trang trí khi surfaceOpen.
- `.df-wheel__orbit` — vòng trang trí aria-hidden (DongFuWheel.vue:35).
- `＋` trong chip currency (430) — trang trí; nút chip không action.
- Toàn bộ `DongFuFidelityScene/DongFuVista/DongFuHud/DongFuHomeContent/DongFuArtFrame` — cảnh hoàn chỉnh phục vụ trang preview legacy (`legacy/ui-dong-fu.html` còn serve `ui-preview/dong-fu.ts`) — không mồ côi nhưng chỉ sống ở preview.
- `CurrencyHud.vue` + `DongFuResourcePill.vue` — strip hoàn chỉnh không mount.
- `.opening-design-*`, `.home-design-footer` CSS (`LandscapeDesignPreview.vue:78-105`) — DOM/CSS mock.
- `--pc-slot-art`/`--pc-inspector-art` trên scene root (194) — không consumer trong stage (tooltip đọc `--pc-inspector-art` ở body-level, ngoài `.df-scene`). `--pc-primary-button` match rule nhưng luôn bị modifier secondary/danger ghi đè — hiệu quả như chết trong stage này.
- `.df-node__badge--upgrade` trong type (`dongFuUi.ts:23`) — `slotBadge` chỉ trả 'alert'|'dot' → CSS badge upgrade không render (DongFuWheel.vue:68-69 chỉ dot/alert).
- `.df-building__upgrade`/`__dot--alert` + hàng chục selector global `.df-*` (`tien-hiep-ui.css:60-79,152-176,226-235,270-271`) — DOM preview-only.
- `home-design-quest .is-claimable` box-shadow — CSS nối `questCard.claimable` đúng (không chết).
- `.df-board__chevron` ‹/› + `.is-collapsed` — nối `boardOpen` đúng.

## 7. Open questions — cần chủ dự án quyết

1. **~72MB art chết vẫn ship + warm mỗi session** (`backgrounds/dong-fu/modular` 48MB trong 'home' required + 'ui-scenes'; `buildings/dong-fu/v2` 24MB trong 'ui-scenes'): xóa khỏi `AssetBundleCatalog` hay giữ chờ redesign vista? Kèm `char-cultivate` multiatlas trong 'tribulation' phục vụ nhánh animated đã chết.
2. **Wheel chỉ mở bằng Backquote, rail chỉ bằng Tab** (389-400) — thiết bị touch/web không phím không mở được wheel. Chờ redesign wheel hay cần nút mở tạm?
3. **Building hotspots đã mất khỏi vista sống** — rail thay thế; giữ `DongFuHomeContent`/`df-building` cho preview (entry `legacy/ui-dong-fu.html` vẫn sống) hay dọn luôn (kèm `DongFuBuildingArt` geometry + `.df-building` global rules)?
4. **Phaser MainScene**: đường static vẫn tạo/animate sprite vô hình mỗi frame (subscribe event, setPosition mỗi resize); đường animated đã chết compile-time. Strip GameObjects chỉ giữ lifecycle/handoff, hay giữ "fallback" như comment 9-12? Và sửa doc comment 86-91 (mechanism scene.start đã dời sang `PhaserSceneAdapter:171`).
5. **CHIP_ICON theo index lệch mock** — gán icon theo `chip.id` thay vị trí?
6. **`CurrencyHud`/`DongFuResourcePill`/fidelity scene** — trang preview legacy vẫn vào được; xóa file hay giữ đúc kết?
7. **`surfaceOpen` giữ profile/currencies/quest/rail hiển thị dưới overlay** — đúng ý đồ "rail over panels" hay muốn ẩn hết chrome khi panel mở (hiện chỉ board+notice ẩn)?
8. **FeedbackDialog + keydown + ticker 30s sống xuyên combat/tribulation** — move vào trong `v-if="!stageActive"` hoặc unmount script-side?
9. **Escape chỉ đóng wheel, không đóng panel/dialog** — thêm close-all trên Escape?
10. **Chip currency là `<button>` không hành động** trong khi quest card là nút thật — đổi chip thành non-button, hay wire mở panel tài nguyên?
11. **`onWheelAction` namespace chung board/slot** — tách hai handler hay giữ tra cứu hai giai đoạn?
12. **`TranPhapCombatPreviewScene.ts`** — file scene thứ 5 không đăng ký trong `PhaserCanvas`; giữ cho test hay xóa?

## Adjudication — reviewer findings đã đối chiếu

**Missed — chấp nhận 16/16** (đã tự verify từng cite; chỉnh nhỏ khi ghi vào report):

1. CSS chain thiếu `system-theme.css`/`tien-hiep-secondary-ui.css`/`tien-hiep-auxiliary.css` — **Đúng** (`main.ts:7-10`); bổ sung: 3 file không chứa selector `.df-*`/`.home-*`; `pc-paper-scene.css` do `DongFuStage.vue:33` import.
2. Audio cue `ui.wheel.select` — **Đúng** (`DongFuStage.vue:282,332`).
3. FeedbackDialog teleport — **Đúng** (`FeedbackDialog.vue:362` `Teleport to="body"`, layer `OVERLAY_LAYERS.modal` tại :52).
4. `@click.stop` trên `.df-scene` + hai đường dismiss — **Đúng** (`DongFuStage.vue:419`; `GameRoot.vue:130-138`; `SceneDesignCanvas.vue` viewport fixed inset:0 để lại letterbox).
5. Quest card `@click="ui.openStandalonePanel('quest')"` — **Đúng** (`DongFuStage.vue:439`).
6. Animated pipeline dead compile-time — **Đúng** (`EntityArtMode.ts:16` = 'static'; gates tại `MainScene.ts:219,308,397`; `char-cultivate` ship ở `AssetBundleCatalog.ts:241-249`).
7. ResizeObserver của `useDynamicRegion` — **Đúng** (`useDynamicRegion.ts` `observe()` → `live.scale.resize`, ~315-333).
8. Producer/subscriber PhaserCanvas — **Đúng** (bar readers ~91-97; `publishProfile`+watch emit `player_visual_profile_changed` 103-131; `__tutienPhaserGame` ~190/211; retry-watch `transitionId` ~231-240).
9. `App.vue:915` tick 1s — **Đúng** (emit `cultivation_changed` :955, `bumpState` :1013; `TICK_INTERVAL_MS=1_000` `SpeedSettings.ts:10`; `startTickLoop` `useAppLifecycle.ts:236`).
10. Chrome sibling đè stage — **Đúng** (`GameRoot.vue:180-203`; warm idle 110-123; techniqueLocked bounce 78-100).
11. Global CSS bổ sung — **Đúng** (hk-frame box-shadow:none :85; `.game-button` rules `tien-hiep-ui.css:80-84`+`pc-paper-production.css:5-14`; reduced-motion orb :197-199; `.feedback-dialog` `pc-paper-production.css:52-61`; `.th-panel-swap-*` :373-378; fonts `pc-paper-type.css:6,13`).
12. `TranPhapCombatPreviewScene.ts` không đăng ký — **Đúng** (file tồn tại; `scenes` list `PhaserCanvas.vue:150-164` chỉ 4 scene).
13. `ui-preview/dongFuMessages.ts` — **Đúng** (file tồn tại).
14. `data-hk-scene="dong-fu"` inert — **Đúng** (:415; grep không có reader `[data-hk-scene]` trong CSS/TS; các scene khác set cùng pattern là convention marker, không phải consumer của dong-fu).
15. Variant rotation sống — **Đúng một phần**: `peekThanhVanVariant` chạy trong descriptor 'home' (`AssetBundleCatalog.ts:255`) và 'ui-scenes' enumerate full matrix (786-791); `selectNextThanhVanVariant` thật sự được gọi bởi `CombatScene.ts:2367` (combat backdrop, ngoài vista nhưng chứng minh pipeline không hoàn toàn chết).
16. Interval `useThienCoEntries` chạy xuyên combat — **Đúng** (`DongFuStage` mount thường trực trong `MainScene.vue`; v-if chỉ gỡ `SceneDesignCanvas`; ticker `useThienCoEntries.ts:29,46-53`).

**Wrong — chấp nhận 5/6, từ chối 1:**

1. "Preview orphaned" — **Chấp nhận (report sai)**: `legacy/ui-dong-fu.html` tồn tại và vẫn load `/src/ui-preview/dong-fu.ts` → fidelity scene còn entry sống. Đã sửa §2/§6/§7.3.
2. Ba biến `--pc-*` "không ai dùng" — **Chấp nhận có chỉnh**: `--pc-secondary-button` sống (chip secondary + nút danger); `--pc-primary-button` có rule match (`.pc-paper-button::before`, `.game-button::before`) nhưng luôn thua modifier trong stage → thực tế không render; `--pc-slot-art`/`--pc-inspector-art` không consumer trong stage (`#global-tooltip` đọc `--pc-inspector-art` nhưng ở body, ngoài `.df-scene`).
3. "Pipeline Phaser chạy vô hình" — **Chấp nhận có chỉnh**: đường static chạy-vô-hình; đường animated là dead code compile-time, không chạy. Đã tách ở §4.6/§5.
4. "`DongFuBuildingArt` chỉ constant còn sống" — **Chấp nhận (report tự mâu thuẫn)**: `DONG_FU_BUILDING_ART`/`dongFuBuildingAssetUrls`/`dongFuSeasonOverlayUrl` chạy thật trong warm list `AssetBundleCatalog.ts:803-809`; chết thật chỉ geometry + `dongFuBuildingTimeClass`.
5. `.df-notice` va chạm — **Chấp nhận (lo ngại vô cớ)**: không rule global `.df-notice`; hai định nghĩa scoped per-component không thể đụng nhau. Đã gỡ khỏi conflicts.
6. Mechanism combat transition — **Chấp nhận (doc stale)**: `MainScene.ts` không có `scene.start` nào; `PhaserSceneAdapter.ts:171` start theo `PRIMARY_SCENE_ROUTES` (:16-17). Đã sửa §1/§4.6.
