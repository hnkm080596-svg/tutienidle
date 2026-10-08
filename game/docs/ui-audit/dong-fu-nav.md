# Panel: Động Phủ — nav rail + overlay flow

## 1. Mount chain — từ nav/route đến component gốc

- `App.vue:1293` — `<GameRoot v-if="isBooted" :inert="authorityOverlayActive">`: toàn bộ chrome game chỉ mount sau boot; `:inert` khoá mọi input vào game-root (rail, wheel, scene) khi authority overlay hiện — gate quan trọng.
- `GameRoot.vue:138` — `<MainScene @click="closeSidePanels">` (click nền Phaser → `ui.closeHomeOverlays()`, `GameRoot.vue:130-132`).
- `MainScene.vue:18` — `<DongFuStage>` mount trước `<PhaserCanvas>` (L20); DongFuStage là DOM overlay `position:fixed` nằm trên canvas Phaser trong suốt (comment L12-17).
- `DongFuStage.vue:412` — `<SceneDesignCanvas v-if="!stageActive">` → `<main class="df-scene hk-art-scene landscape-design">` (L413-495): stage tự ẩn khi route = combat/tribulation (`useStageActive`, `composables/useStageActive.ts:16-19` — authority duy nhất là coordinator route).
- `SceneDesignCanvas.vue` — `.scene-viewport` fixed inset:0 (L37, template L29-33), không z-index → thứ tự DOM quyết định stacking; prop `overlay` (L4) → variant trong suốt + pointer-events:none (L41-42). Mỗi canvas chạy một `ResizeObserver` đo viewport để scale (L16-25) — sống suốt session trên stage + mọi overlay surface.
- Các nhánh overlay mount trong `GameRoot.vue` cùng `.game-root`:
  - `GameRoot.vue:149` `<LeftPanel>` → `LeftPanel.vue:16-19` Transition `th-panel-swap` → `CharacterSurface` (characterOverlayOpen + tab='character') hoặc `InventoryPanel` → `InventorySurface`.
  - `GameRoot.vue:150` `<FunctionOverlayPanel>` → mode từ `ui.leftPanelMode` lọc `isBetaLeftPanelMode` + loại 'character'/'inventory' (`FunctionOverlayPanel.vue:69-77`):
    - `paperMode` (L79-81) → `StageSelectPanel`/`PillRoomPanel`/`EquipmentHallPanel`/`SettingsSurface` (L114-117) — mỗi cái mount `SceneDesignCanvas overlay` + fidelity scene (ví dụ `ExplorationSurface.vue:456` cho StageSelectPanel).
    - `scrollMode` (L82-84) → `ImperialScrollScene` (L122-155), chỉ còn 'exploration' (ProductionPanel, L153).
    - `legacyMode` (L85-87) → `OverlayPanel` (L158-195): worker_lodge / scripture_pavilion / vendor.
  - `GameRoot.vue:77-100` — `mountedStandalone` lazy-once Set + watcher beta-gate + technique bounce (L85-97); `GameRoot.vue:156-174` mount SkillPathPanel/RealmPanel/QuanKhiPanel/QuestPanel/ArtifactPanel/TranPhapPanel/CompanionPanel/TechniquePanel/BodyPanel. Idle-warm chunk imports `GameRoot.vue:110-123`.
  - Chrome hệ thống trong GameRoot: `Tooltip`/`ToastContainer`/`ActionFeedbackLog`/`WorldAnnouncementOverlay` (L180-186), `OfflineSummaryModal` (L188-193), `TalentEntitlementModal` (L199), `BreakthroughRequirementPanel` (L201), `TutorialOverlay` (L203), `CombatSceneOverlay`/`TribulationSceneOverlay` (L177-178), `RouteMount` (L205 → witness `RouteMount.vue:17-33`).
  - Chrome app-level ngoài GameRoot (`App.vue`): `DevToolsPanel` L1297 (dev-gated), `BetaCompletionModal` L1303-1306, `CombatPauseOverlay` L1314, `PresentationTransitionOverlay` L1318-1328 (curtain), authority overlays L1336-1389 (reconnecting/terminal/quitFlush/updateInstallFailed), `UpdateBanner` L1391, `PhapTuLabBridge` L1393, `ErrorScreen` L1395.
- Rail → `NAV_TARGET` (`DongFuStage.vue:226-245`) → `ui.openLeftPanel`/`ui.openStandalonePanel`/`navigation.openBuilding`/`feedbackOpen` → state → các nhánh overlay trên render scene tương ứng.
- Wheel → `ui.isCommandWheelOpen` → `<DongFuWheel :open>` (`DongFuStage.vue:480-485`) bên trong cùng canvas stage.
- Chrome sống thêm trong stage: `AutoFarmIndicator` (`DongFuStage.vue:492` → `AutoFarmIndicator.vue:31` `v-if="armedStageName"`).
- **Cơ chế dialog thật của mọi overlay**: `useDialogFocus` (`composables/useDialogFocus.ts:10-100`) — focus-on-open + lưu trigger (L24-36), Escape→`onEscape`+stopPropagation (L37-42), Tab containment preventDefault+stopPropagation (L43-64, chặn luôn window Tab của stage), mousedown containment document-level giữ focus trong card (L73-79), restore trigger khi đóng (L87,99). ~20 consumer production: OverlayPanel, ImperialScrollScene, ConfirmModal, OfflineSummaryModal, BetaCompletionModal, TalentEntitlementModal, TutorialOverlay, GuestAbandonDialog, CombatExitConfirmModal + 11 fidelity scene root (character/skill/realm/technique/body/alchemy/inventory/equipment/quest/settings/exploration) — Escape đóng overlay đi qua đây (→ emit('close'/'back') → closeHomeOverlays), không qua `onKeydown` của stage.
- FeedbackDialog mount 3 chỗ độc lập: `DongFuStage.vue:497` (rail 'feedback'), `SettingsPanel.vue:382` (qua `SettingsFeedbackSection @open` L353 — reachable bên trong settings paper surface), `ErrorScreen.vue:192`. Cả ba `<Teleport to="body">` (`FeedbackDialog.vue:362`) — thoát stacking context `.game-root`, nằm trên mọi overlay canvas.

## 2. UI logic inventory — mọi computed/store-read/emit/directive/props đang feed DOM

**DongFuStage.vue**
- `surfaceOpen` = leftPanelMode||characterOverlayOpen||standalonePanel (L56-58) → class `df-scene--covered` (L416), gate Tab/Backquote (L389-397), v-if seam (L471), watch đóng feedback (L67-69).
- Local refs: `feedbackOpen` (L60), `boardOpen=true` (L61), `railCollapsed` (L62), `railIndicator` (L63), `notice`+timer 3200ms (L82-95).
- `toggleRail`/`onRailTransitionEnd` (L71-80): indicator chỉ bật sau transition 'transform'.
- Wheel: `disabledContext` (L100-107) → `renderedSlots` = `betaWheelSlots().filter(available)` (L109) → `SLOT_SYMBOL` (L111-127), `slotDisabledReason` (L129-131), `slotActive` (L133-142), `slotBadge` (L144-153), `slotAction`→`wheelActions` (L155-166) → props `actions/selected/open` cho `DongFuWheel`.
- Board: `KIND_SYMBOL` (L170-176) + `boardEntries` từ `useThienCoEntries` (L178-188) → `DongFuBoard` props `entries/open` + emit `toggle/action` (L486-491).
- Rail: `NAV_LOCKED` 5 id tương lai (L203), `NAV_ITEMS` 21 id (L204-208), `NAV_FEATURE_LOCKED` formation→'tran_phap' (L214-216), `navLocked` (L217-221), `NAV_TARGET` (L226-245), `NAV_ACTIVE_PANEL`/`NAV_ACTIVE_STANDALONE`/`navActive` (L249-278), `navAction` (L280-291, cue 'ui.wheel.select' — `AudioCueManifest.ts:263` — + đóng feedback + home=closeHomeOverlays).
- Chrome: `sceneStyle` background + `--home-nav-art` + pc controls (L191-196), `navBackingUrl`/`navSeamUrl` (L197-198); `realmName` (L296), `currencyChips`+`CHIP_ICON` map index→icon (L298-307), `trackedQuest`/`questCard` (L309-325), `profileProgress` (L327).
- `activateSlot` (L330-345), `onWheelAction` thử Thien Co entry → wheel slot → flashNotice (L347-359).
- `INTERACTIVE_SELECTOR`/`onSceneClick` (L364-369): click rỗng (kể cả xuyên lỗ overlay) → closeHomeOverlays; `@click.stop` trên `<main>` (L419).
- `onKeydown` (L380-401): Escape→closeCommandWheel; Tab→toggleRail; '`'→toggleCommandWheel; cả hai gate `!stageActive&&!surfaceOpen` (+`!feedbackOpen` cho wheel); chặn editable/modifier. Listener add/remove L403-408.
- `AutoFarmIndicator`: `armedStageName` (L16-23) → render label + nút Stop (domain command `autoFarmOps.stopAutoFarm`, L25-27) — header comment nói "sống trong GameRoot" đã lạc hậu (thực tế nằm trong `.df-scene`).

**stores/ui.ts (open/close flow)**
- `toggleLeft` L199-224 (character/inventory → `characterOverlayOpen`+`characterSceneTab`, reset `activeBagTab`); `openLeftPanel` L226-242; `openStandalonePanel` L244-255; `closeHomeOverlays` L258-263 (dọn 4 field); `toggleCommandWheel` L265-274; `closeCommandWheel` L276-278; `toggleStandalonePanel` L320-331; beta gates qua `isBetaLeftPanelMode`/`isBetaStandalonePanel`.
- **Dead actions**: `toggleLeft` và `toggleStandalonePanel` không còn caller production nào (grep toàn repo chỉ thấy định nghĩa + một comment trong `tests/architecture/betaScopeRenderedTokens.test.ts:145`) — rail chỉ dùng `openLeftPanel`/`openStandalonePanel`.
- Union id: `LeftPanelMode`/`StandalonePanel` trong `presentation/contracts/panelIds.ts:19-47`.

**FunctionOverlayPanel.vue**
- `TITLE_KEYS` (L25-34), `IMPERIAL_MODES`/`PAPER_MODES` (L41-58), `BUILDINGS` mode→buildingId (L60-67), `mode` beta-gate (L69-77), ba computed mode (L79-87), `useBuildingHeaderState` (L91) + `artBroken` reset theo artPath (L96-100), `close`→closeHomeOverlays (L102-104).

**useThienCoEntries.ts** — `entries` computed đọc realmAdvanceOps/questOps/alchemyOps/building status, sort theo `PRIORITY`, `MAX_ENTRIES=4` (L28) + `TICKER_MS=30_000` (L29) + `setInterval` cập nhật `nowMs` (L49-53) — listener sống suốt session cho countdown lò đan; `isBetaBuildingSurface` chặn entry cho building scope-hidden (L104).

**useDialogFocus.ts** — như §1: owner thật của Escape/Tab/pointer-containment trên mọi dialog + fidelity scene; `onEscape` callback do consumer truyền (`emit('close')` ở OverlayPanel/ImperialScrollScene, `emit('back')` ở 11 fidelity scene).

**OverlayLayers.ts** — scale z-index app-level đầy đủ: combatPause 900 → CombatPauseOverlay; feedback 1200 → ActionFeedbackLog; panel 1800 → OverlayPanel/ImperialScrollScene/ConfirmModal/GuestAbandonDialog (mặc định `layer` của OverlayPanel + ImperialScrollScene); announcement 1850 → WorldAnnouncementOverlay; toast 1870 → ToastContainer; modal 1900 → OfflineSummaryModal/LoreCodexModal/TutorialOverlay + default của FeedbackDialog (`FeedbackDialog.vue:52`); authority 1950 → 4 overlay `App.vue:1336-1389`; tooltip 2200 → Tooltip; appError 3000 → ErrorScreen; saveGate 4000 → SaveIncompatibleScreen; saveGateModal 4100 → ConfirmModal của save gate; curtain 5000 → PresentationTransitionOverlay (TOPMOST).

**z-order nội bộ `.df-scene`** (trong stacking context riêng của stage canvas): `.home-navigation-toggle`/`.home-navigation-collapse` z-24 (`DongFuStage.vue:516,518`) > `.home-navigation-surface` z-23 (L511) > `.home-navigation-landscape-seam` z-22 (L514) > `.auto-farm-indicator` z-12 (`AutoFarmIndicator.vue:46`) > `.df-board` z-5 (`DongFuBoard.vue:24`) > `.pc-paper-scene__frame` z-4 (`pc-paper-scene.css:15`) > `.df-wheel` z-3 (`DongFuWheel.vue:58`). Khung viền vàng z-4 vẽ ĐÈ lên wheel z-3.

**Phụ trợ**: `useBuildingNavigation` openBuilding beta-gate `isBetaBuildingSurface` + functionType→openLeftPanel (`useBuildingNavigation.ts:137-155`), getBuildingStatus badge (L81-107); `useThienCoEntries` entries max4 (L28,150-152); `useCurrencyChips` chips spirit stones 3 tier + companion (ẩn khi `isBetaFeature('companion')` off).

## 3. Art map — file art → element

- `/assets/ui/tien-hiep-2026-10/source/world-vista-warm-v1.png` — nền scene qua `sceneStyle` (`DongFuStage.vue:191-195`).
- `controls/navigation-medallion-v1.png` — `--home-nav-art`, ::before mỗi nút rail (L195 + scoped L538).
- `controls/navigation-backing-dark-v3.png` — `<img class="home-navigation-backing">` (L447).
- `controls/navigation-landscape-seam-v1.png` — seam chỉ khi surfaceOpen (L471).
- `icons/navigation-<id>-v2.png` ×21 — icon nút rail (L458); đủ 21 id NAV_ITEMS. **Mồ côi trong scope**: `navigation-forge-v2.png` (22 file navigation nhưng NAV_ITEMS chỉ 21 — 'forge' chỉ là PcPaperIcon id, không có rail item), `controls/navigation-backing-v1.png`, `navigation-backing-dark-v2.png`, `navigation-connector-v1.png` (chỉ dark-v3 + seam + medallion được dùng).
- `icons/character.png` — avatar (L422, `PcPaperIcons.ts:8-10`).
- `controls/resource-{crystal,jade,coin,essence}-v1.png` — chip tiền tệ (L430, `PcPaperControls.ts:3-6`); `CHIP_ICON` map theo INDEX không theo id (L298).
- `pcPaperControlStyles` — --pc-secondary-button cho `PcPaperButton` chip (L194, `pc-paper-scene.css:36`).
- Wheel: `huyen-kim/symbols/<symbol>.svg` (`dongFuUi.ts:12-14`); frame orb bị global đè thành `--th-art-orb-frame` (`tien-hiep-ui.css:65-69`) + label đổi skin (L70).
- Board: `surface-l-drawer` nine-slice (`DongFuBoard.vue:11`, center 'transparent' → cream ::before global lộ ra), `--th-art-button-primary` cho `.df-board__go` (global L79), cream `#f0e4c9` ::before (global L261).
- Header building: `useBuildingHeaderState.ts:36` → `/assets/buildings/dong-fu/v2/{buildingId}/base.png` (gathering_outpost/equipment_hall/pill_room/chi_hien_quan/teleport_array/vendor — đủ dir trên disk) cho `building-heading__art` (FunctionOverlayPanel L133-139, L172-178) + `BuildingUpgradeButton` slot.
- Legacy shell: `surface-m-panel` + `frame-m-modal` (`OverlayPanel.vue:66-68`) — bị `tien-hiep-secondary-ui.css:17` hide slice + `L124-127` cream ::before.
- Scroll shell: imperial-scroll-body/roller, scroll-title-plaque, paper-grain-tile, corner/cloud-ornament, frame-xl-ceremony, icon-button-utility (`ImperialScrollScene.vue:38-42,57-105`).
- FeedbackDialog → `<Teleport to="body">` + OverlayPanel variant='paper' → `surface-xl-scroll` (`FeedbackDialog.vue:362-372`, `OverlayPanel.vue:67`).
- Art CHẾT trong prod (chỉ preview): `dong-fu-v2/rear|foreground|cultivator.png` (`dongFuUi.ts:4-10`), `building-plaque` (`DongFuHomeContent.vue:15` — consumer duy nhất của hkChromeUrl id này), `df-art-frame` (`DongFuArtFrame`), `.paper-navigation` rail art `--th-art-navigation-rail` (`tien-hiep-ui.css:14` + restyle `L353-357`).

## 4. Conflicts / layers — hai phiên bản UI cùng tồn tại

1. **Rail mới vs wheel cũ sống song song**: cả hai cùng route vào cùng store nhưng list khác nhau — rail = `NAV_ITEMS` tay (21 id, locked-xám), wheel = `betaWheelSlots().filter(available)` (catalog + scope filter, thứ tự/đích lệch: wheel có teleport_array/chi_hien_quan/scripture_pavilion/phap_bao-gated, rail không). Wheel KHÔNG còn đường chuột: chỉ Backquote (`DongFuStage.vue:397-400`); nút cultivator toggle cũ chết cùng DongFuHomeContent. Comment L5/L98 tự nhận "pending redesign".
2. **Rail switching không nhất quán theo vỏ overlay**: 11 scene giấy có `pointer-events:none` ở root + `> *` auto (`tien-hiep-ui.css:390-411`) nên click xuyên xuống rail — cơ chế "đổi panel từ rail" hoạt động. Nhưng `.hk-scroll` (`ImperialScrollScene.vue:47,133-142` scrim absolute inset:0, nuốt click) và `.overlay-panel` (`OverlayPanel.vue:53,98` z=1800, absolute inset:0) CHE rail hoàn toàn: mode 'exploration' (Sản Xuất), 'worker_lodge', 'scripture_pavilion', 'vendor' + standalone **`quan_khi`** (OverlayPanel, `QuanKhiPanel.vue:316`) → rail biến mất khỏi tầm click. (Sửa từ bản gốc: artifact/tran_phap/companion cũng dùng OverlayPanel nhưng `isBetaStandalonePanel` chặn mount — `ui.ts:244-255` + `GameRoot.vue:84-96` — nên không reachable trong beta; rail 'artifact'/'companion' đã disabled bởi NAV_LOCKED, 'formation' bởi NAV_FEATURE_LOCKED.)
3. **Global `.df-*` đè scoped trong chính scene mới**: `tien-hiep-ui.css` ::is(#app,body) (specificity 1,x,0 > scoped) áp vào `.df-scene` landscape-design: orb wheel đổi sang `--th-art-orb-frame` + mất radial-gradient/border (L65-69), label wheel đổi skin (L70), `.df-board` background→transparent + ::before cream + padding 24/25 (L229,260-261) đè nine-slice surface-l-drawer, `.df-board__heading` #30291d + 24px non-italic (L76,230) đè scoped italic gold 25px + stage `:deep` 20px (L563), `.df-board__go` mất clip-path lục giác → art nút painted (L79). Comment trong file nói rõ đây là "Rail over panels" fix (L381-389) cho scene roots — phần `.df-*` còn lại là skin preview kéo theo.
4. **Dead selectors trong global**: `.df-board .df-art-frame` (L75,228,352), `.df-vista` (L60-61), `.df-cultivator` (L62-64), `.df-building*` kèm `!important` toạ độ (L152-166), `.df-location` (L71-73,176,226-227), `.df-quest` (L235,270-271), `.df-resources/.df-identity/.df-utilities/.df-progress/.df-utility*` (L167-175), `.hk-scroll .hk-scroll__rail` (L185-186 — zero element trong codebase) — không element production nào mang các class này (chỉ còn trong tree preview DongFuVista/DongFuHomeContent/DongFuHud/DongFuArtFrame).
5. **Hai bộ chrome currency**: `.home-design-currencies` PcPaperButton (L428-432) vs `CurrencyHud.vue` + `DongFuResourcePill.vue` — không mount ở đâu trong prod (chỉ `CurrencyHud.test.ts`; header comment vẫn nói "pinned to Dong Fu home chrome").
6. **Header building 2 skin**: `building-heading` scoped FunctionOverlayPanel (dark ramp `--surface-text`, L235) bị `tien-hiep-secondary-ui.css:72-74` đè thành paper ramp (#352a1b/#675637) — comment scoped về "ink header tối" đã lạc hậu sau khi global lật card sang cream (secondary L124-127 ::before + L17 hide slice).
7. **`df-scene--covered` suppression chọn lọc + hở**: chỉ giấu `.df-board`+`.df-notice` (L566-567). `AutoFarmIndicator` KHÔNG bị giấu — vẫn render ở top-right (nằm trên mép paper từ y<123 nên nhìn thấy rõ). `.home-design-profile`/`home-design-currencies`/`home-design-quest`/rail vẫn mount: profile+currencies (top:14, dưới ~110) nằm trên mép trên paper (top:123) → vẫn thấy + click được; quest card sliver y∈[85,123] rơi qua lỗ overlay → vẫn click mở quest standalone; rail strip x<156 vẫn click được (xem #8). Phần còn lại là dead-DOM dưới paper.
8. **Vùng chết của rail dưới paper sheet**: paper sheet là direct child → `> *{pointer-events:auto}` → tờ giấy span x∈[156,1428] (global L25-26: left:156 + width:1272) nuốt click. Rail buttons span x∈[55,290] → chỉ strip icon x∈[55,156] còn click được; nhãn chữ (~134/235px ≈ 57% bề mặt nút) chết dưới mép trái paper. Cơ chế "đổi panel từ rail" chỉ còn nửa nút.
9. **`mountedStandalone` không bao giờ unmount** (`GameRoot.vue:77-96`): panel standalone đã mở 1 lần tồn tại suốt session — DOM lớn + watchers (gồm `useDialogFocus` listeners) ngủ sau mỗi panel từng dùng.
10. `pc-paper-scene__frame` (`DongFuStage.vue:494`): khung viền vàng inset:5px vẽ đè toàn scene home (z-4, TRÊN wheel z-3), class thuộc hệ pc-paper-scene trong khi root là `.df-scene` — 1 element lạc loài, global rule `pc-paper-scene.css:15` vẫn match.
11. **NAV_ACTIVE kép**: `navActive` đọc 3 nguồn khác nhau (characterOverlayOpen+tab, leftPanelMode qua NAV_ACTIVE_PANEL, standalonePanel qua NAV_ACTIVE_STANDALONE) — cùng một khái niệm "đang mở", 3 bản đồ tay dễ lệch; 'exploration'(Bản Đồ)→stage_select còn 'production'(Sản Xuất)→mode 'exploration' — hai nghĩa của chữ "exploration" đảo nhau.
12. **Escape hai lớp**: stage `onKeydown` Escape→`closeCommandWheel` (DongFuStage L381-383) trong khi overlay Escape→`useDialogFocus.onEscape`→emit close/back (stopPropagation — stage không thấy). Hoạt động đúng nhưng hai owner cho cùng một phím; tương tự Tab bị dialog containment chặn kể cả khi stage không gate.
13. **`@click.self` + scoped `pointer-events:auto` chết trên fidelity roots**: 11 scene (alchemy/body/cf/equipment/exploration/inventory/quest/realm/settings/skill/technique) có `@click.self="emit('back')"` + scoped `pointer-events:auto` trên root — cả hai vô nghĩa vì global `:is(#app,body)` set `pointer-events:none` luôn thắng (click.self không bao giờ fire; comment CharacterFidelityScene L48 "doubles as the outside-paper close" lạc hậu). Dismiss thực tế đi qua `onSceneClick` của stage.
14. **Teleport escape hatch**: `FeedbackDialog` Teleport ra `body` → thoát cả `.game-root` lẫn bố cục design-canvas → layer modal 1900 áp trực tiếp lên root stacking context (kể cả trên overlay panels), khác hẳn các surface anh em.

## 5. Logic không có hình ảnh — logic/state không render ra gì

- `DongFuWheel :selected="null"` (`DongFuStage.vue:482`) — prop selected luôn null → `is-selected`/aria-pressed styling unreachable (`DongFuWheel.vue:40,45,74`).
- `slotBadge`/`slotActive` chỉ nuôi wheel; rail không có cơ chế badge/dot → `navigation.getBuildingStatus` + `canTriggerBreakthrough` không hiện hình trên rail (rail chỉ có active/locked).
- `disabledContext` (L100-107) tính artifact/companion/formation unlock cho các slot bị scope-filter — chi phí computed cho slot không render khi beta ẩn.
- `toggleLeft`/`toggleStandalonePanel` trong `ui.ts` — zero caller production (dead store API, xem §2).
- `usePaperNavigation` + `PAPER_NAV_IDS`/`NAV_TARGETS`/`activeId` (`usePaperNavigation.ts:29-143`) — adapter rail giấy hoàn chỉnh, không còn surface nào import ngoài ui-preview; `SettingsSurface.vue:4` comment vẫn ghi "usePaperNavigation wiring" (stale — chỉ là chữ trong comment).
- `RING_3_BUILDING_IDS` (`commandWheelCatalog.ts:248-250`) — export cho hotspot layer đã chết (không còn hotspot production; field `ring` trong catalog cũng mồ côi vì wheel giờ single-ring).
- `DongFuHomeContent` emit `upgrade` (L61-62) + emit `toggleWheel` (L70-72) + badge 'upgrade' của `DongFuUiBuilding` (`dongFuUi.ts:22-23`) — đường nâng cấp + toggle wheel từ plaque, không host production nào nối.
- `onWheelAction` nhánh `entries.find` + `slot` → cùng một handler cho cả board CTA và wheel; fallback `flashNotice` chỉ nổi khi id không khớp gì (`DongFuStage.vue:347-359`).
- `LeftPanelMode 'worker_lodge'` trong type `LeftPanelModeMarker` (`DongFuStage.vue:257`) — không NAV_ACTIVE_PANEL nào gán, rail không có id này; marker dư thừa.
- `isCommandWheelOpen` vẫn trong store + toggleCommandWheel/closeCommandWheel (ui.ts:265-278) nhưng trigger duy nhất còn là Backquote — toàn bộ API wheel chỉ phục vụ 1 phím.
- Tree dormant hoàn chỉnh (không importer production — chỉ ui-preview/test/comment): `DongFuFidelityScene.vue` → `DongFuHomeContent.vue` → `DongFuHud.vue`/`DongFuArtFrame.vue`, `DongFuVista.vue`, `hud/DongFuResourcePill.vue`, `game/CurrencyHud.vue`, `common/PcPaperScene.vue`/`PcPaperSceneActions.vue`/`PcPaperDialog.vue`/`PcPaperChrome.vue`/`PaperPanelNavigation.vue`. (`useTooltip.ts:161,176` chỉ nhắc DongFuHomeContent trong comment.)
- Locale keys chết: `dongFu.toggleWheel`/`buildingHint`/`sceneTitle`/`sceneSubtitle` — chỉ còn consumer DongFuHomeContent (dormant) + `ui-preview/dongFuMessages.ts`.
- Thêm từ §1: `mountedStandalone` giữ watch `useDialogFocus` sống cho mọi panel đã từng mở — logic chạy nền không hình (focus watch của root vẫn active dù surface ẩn, vì `() => true`).

## 6. Hình ảnh không có logic — art/DOM trưng bày, unwired

- `NAV_LOCKED` guild/sect/portal (+artifact/companion): nút render icon + label + `:disabled`, không có `NAV_TARGET` → vĩnh viễn là ảnh mờ cho đến khi ai thêm target (`DongFuStage.vue:203-208,226-245`). `NAV_FEATURE_LOCKED` formation→'tran_phap' khóa theo feature thay vì hardcode.
- `home-navigation-landscape-seam` (L471): ảnh seam thuần trang trí v-if surfaceOpen, pointer-events:none.
- `pc-paper-scene__frame` (L494): khung trang trí không hành vi (nhưng z-4 nằm TRÊN wheel z-3).
- `DongFuBoard` heading/chevron (DongFuBoard.vue:12) + entries — vẫn render nhưng `df-board` position bị stage đặt `top:290px` (L562) — board Thiên Cơ "parked" chờ redesign; vẫn bị `df-scene--covered` giấu khi overlay mở.
- Icon `feedback`/`production`/`vendor` vẫn là PNG điều hướng generic (navigation-*-v2) — các nút này mở dialog/panel thật nhưng icon không phản ánh nội dung đích (vendor=Th��ơng Hội mở VendorPanel legacy, không phải building plaque).
- `DongFuResourcePill.vue` + `CurrencyHud.vue` — bộ chip tài nguyên vẽ đẹp, không mount.
- `.df-building__upgrade` CSS (DongFuHomeContent.vue:132-134) — affordance nâng cấp chỉ sống trong preview.
- `.home-navigation-toggle`/`collapse` — z-24 trên cùng của scene, chỉ hiện/ẩn theo railCollapsed + transitionend (indicator L473-479) — hoạt động đúng nhưng là chrome hoàn toàn custom (không accessibility role).
- `building-heading__art` <img> — render khi `header.template` có + `!artBroken`; nằm trong scroll/legacy header (không phải paper scene nào có header building riêng — paper modes không hiện building heading).

## 7. Open questions — mâu thuẫn cần chủ dự án quyết

1. **Wheel giữ hay xoá?** Comment ghi "stays until its redesign lands" (L5,98-99) nhưng thực tế wheel chỉ mở bằng Backquote — người chơi chuột không bao giờ thấy nó. Nếu rail là đích cuối, wheel + `SLOT_SYMBOL`/`wheelActions`/`commandWheelCatalog` chỉ còn nợ kỹ thuật (cùng `isCommandWheelOpen` API + `RING_3_BUILDING_IDS` + locale `toggleWheel`).
2. **Rail switching: chuẩn nào?** Scene giấy cho rail xuyên click (nhưng vùng chết [156,290] cắt nửa nút — sửa hit-test hay thu hẹp rail?), scroll/legacy che rail — nâng exploration/worker_lodge/scripture_pavilion/vendor lên paper surface hay chấp nhận 2 chế độ? Hiện 'vendor' (rail-reachable) mở panel che rail — mâu thuẫn trực tiếp.
3. **Global `.df-*` còn cần không?** Các rule đang đè art lên wheel/board của scene mới (orb-frame, cream ::before, heading, label). Có nên scope lại vào `.df-scene:not(.landscape-design)` hay xoá khi preview scene được update? (Phần lớn là dead selector cho tree preview — xoá cùng dormant tree?)
4. **Chính sách locked khác nhau giữa rail và wheel**: rail hiện mục tương lai dạng xám-tới (`NAV_LOCKED` + `NAV_FEATURE_LOCKED`), wheel ẩn hẳn slot scope-hidden (betaWheelSlots). Một chuẩn "tease" hay "hide"?
5. **`df-scene--covered` giấu board+notice nhưng giữ quest/profile/currencies/autofarm**: chủ đích (chrome tài nguyên + quest tracker muốn lộ) hay sót — `AutoFarmIndicator` nên vào danh sách ẩn? Sliver quest card [85,123] còn click được là intended?
6. **`mountedStandalone` lazy-once forever**: mở 'body' một lần → TechniqueSurface/BodySurface DOM+watchers+useDialogFocus sống mãi. Có chủ đích giữ state (comment nói giữ close-transition + state) hay nên unmount on close?
7. **Tab = rail**: Tab là phím a11y mặc định của browser (focus) — dùng Tab toggle rail chặn luôn focus-cycle của trang (`event.preventDefault` L390). Chấp nhận trade-off? (Đối lập: dialog containment cũng chặn Tab — hai chủ sở hữu cùng một phím.)
8. **`NAV_ACTIVE_PANEL` naming**: 'exploration'(Bản Đồ)→stage_select còn 'production'(Sản Xuất)→leftPanelMode 'exploration' — hai nghĩa của chữ "exploration" đảo nhau giữa rail label và mode id; đổi tên mode cho rõ hay giữ legacy key?
9. **Dormant tree + assets**: giữ làm reference hay xoá — CurrencyHud/DongFuResourcePill/toàn bộ fidelity preview tree (DongFuFidelityScene/HomeContent/Hud/Vista/ArtFrame) + PcPaper*/PaperPanelNavigation + usePaperNavigation + icon art mồ côi (forge/backing-v1/dark-v2/connector-v1)?
10. **FeedbackDialog 3 instance**: rail (`feedbackOpen` local), SettingsPanel (section support), ErrorScreen — cùng Teleport ra body. Có nên gom về một owner (ui store field) để tránh 3 cờ open rời?

## Adjudication

Verify độc lập trên `devin/artui-c0-foundation` @ 8ffc8e64 (clone mới trên VM — repo không có sẵn, đã clone `~/repos/tutienidle`).

**Missed — ACCEPT cả 17:**

1. AutoFarmIndicator — CONFIRMED: mount `DongFuStage.vue:492`, `v-if="armedStageName"` (L31), z-12 (L46), var cũ `--ink-950/--paper-line/--paper-text` (L51-55); `df-scene--covered` chỉ giấu board+notice (L566-567) → vẫn vẽ lộ trên mép paper. Header comment nói "sống trong GameRoot" đã lạc hậu.
2. useDialogFocus — CONFIRMED: cơ chế Escape/Tab/pointer-containment/focus-restore thật (L24-99); ~20 consumer production (grep: OverlayPanel, ImperialScrollScene, ConfirmModal, OfflineSummaryModal, BetaCompletionModal, TalentEntitlementModal, TutorialOverlay, GuestAbandonDialog, CombatExitConfirmModal + 11 fidelity scene). Report gốc chỉ ghi `Escape→closeCommandWheel` — sót lớp dialog containment Tab + Escape overlay.
3. `@click.self` dead trên fidelity roots — CONFIRMED: 11 scene mang `@click.self="emit('back')"`; root bị global `pointer-events:none` (tien-hiep-ui.css:390-400) → click.self không bao giờ fire. Comment `CharacterFidelityScene.vue:48` mô tả chức năng đã chết.
4. Scoped `pointer-events:auto` dead — CONFIRMED: `CharacterFidelityScene.vue:49` + `SettingsFidelityScene.vue:47`; global `:is(#app,body)` (specificity 1,1,0) luôn thắng scoped (0,2,0).
5. ThienCo timer 30s — CONFIRMED: `TICKER_MS` L29, `setInterval` L49-53 (trong onMounted), clear L55-59.
6. ResizeObserver — CONFIRMED: `SceneDesignCanvas.vue:16-25`, observe viewport mỗi canvas instance.
7. FeedbackDialog thứ hai/ba — CONFIRMED: `SettingsPanel.vue:382` (mở qua `SettingsFeedbackSection @open` L353, reachable vì `SettingsSurface.vue:19` mount SettingsPanel trong settings paper) + `ErrorScreen.vue:192`.
8. Teleport body — CONFIRMED: `FeedbackDialog.vue:362`.
9. App-level chrome — CONFIRMED: DevToolsPanel L1297, BetaCompletionModal L1303-1306, CombatPauseOverlay L1314, PresentationTransitionOverlay L1318-1328, authority overlays L1336-1389, UpdateBanner L1391, PhapTuLabBridge L1393, ErrorScreen L1395; GameRoot L180-203 Tooltip/Toast/ActionFeedbackLog/WorldAnnouncement/OfflineSummary/TalentEntitlement/BreakthroughRequirement/Tutorial.
10. Layer→consumer map — CONFIRMED: đọc `OverlayLayers.ts` đầy đủ (feedback 1200, announcement 1850, toast 1870, authority 1950, tooltip 2200, appError 3000, saveGate 4000, saveGateModal 4100, curtain 5000) — report gốc chỉ map panel+modal.
11. z-order `.df-scene` — CONFIRMED: toggle/collapse z-24 (L516,518) > rail z-23 (L511) > seam z-22 (L514) > autofarm z-12 > board z-5 > frame z-4 > wheel z-3; frame vẽ đè wheel.
12. Dead store API — CONFIRMED: `toggleLeft`/`toggleStandalonePanel` zero production caller (chỉ comment trong `tests/architecture/betaScopeRenderedTokens.test.ts:145`). Cite "ui.test.ts" của reviewer không đúng tên file nhưng claim đúng.
13. Vùng chết rail — CONFIRMED theo geometry: paper `left:156;width:1272` (global L26/L133/L239) vs rail buttons `[55,290]` (`.home-navigation-surface` left:18 + nav inset 8 + padding-left 29 + button width 235, scoped L511,520,522) → nhãn ~57% bề mặt nút chết; strip icon [55,156] sống.
14. Dormant tree — CONFIRMED bằng importer grep: DongFuVista→DongFuFidelityScene(preview), DongFuHud→DongFuHomeContent, DongFuFidelityScene→chỉ ui-preview/DongFuPreview, DongFuResourcePill→CurrencyHud, CurrencyHud→chỉ test, DongFuArtFrame→DongFuHomeContent, DongFuHomeContent→DongFuFidelityScene(+comment useTooltip), PcPaperScene/Dialog/Chrome/PaperPanelNavigation→chỉ ui-preview/test, PcPaperSceneActions→zero importer.
15. Art mồ côi — CONFIRMED trên disk: icons/ có 22 `navigation-*-v2.png` gồm `navigation-forge-v2.png` (không có 'forge' trong NAV_ITEMS); controls/ có `navigation-backing-v1.png`, `navigation-backing-dark-v2.png`, `navigation-connector-v1.png` không được dùng (chỉ dark-v3 `DongFuStage.vue:197`).
16. Locale chết — CONFIRMED: `dongFu.toggleWheel/buildingHint/sceneTitle/sceneSubtitle` chỉ còn DongFuHomeContent + `ui-preview/dongFuMessages.ts`.
17. Header art building — CONFIRMED: `useBuildingHeaderState.ts:36` artPath `/assets/buildings/dong-fu/v2/{id}/base.png`; dir tồn tại cho mọi BUILDINGS map (gathering_outpost/equipment_hall/pill_room/chi_hien_quan/teleport_array/vendor).

**Wrong — ACCEPT cả 6:**

1. §4#2 standalone rail-blockers — CONFIRMED sai cho beta: `BETA_STANDALONE_PANEL_FEATURES` (`betaScopeSurface.ts:132-143`) bind artifact→'artifact', tran_phap→'formation', companion→'companion' (scope-hidden) + `openStandalonePanel`/`mountedStandalone` fail closed. Trong 6 standalone reachable, chỉ `quan_khi` dùng OverlayPanel (`QuanKhiPanel.vue:316`); skill/realm/quest/technique/body đều paper scene (click-through). Đã sửa §4#2.
2. §4#7 dead-DOM quá rộng — CONFIRMED: quest card `top:85` vs paper `top:123` → sliver [85,123] click được (mở quest standalone); rail strip x<156 sống; profile/currencies (top:14) trên mép paper → sống. Đã viết lại §4#7-8 với geometry chính xác.
3. `:inert` — CONFIRMED: `App.vue:1293` có `:inert="authorityOverlayActive"`. Đã thêm vào mount chain.
4. SceneDesignCanvas cite — CONFIRMED: template L29-33, `.scene-viewport` fixed L37, overlay variant L41-42, prop overlay L4. Đã sửa cite.
5. useThienCoEntries cite — CONFIRMED: MAX_ENTRIES L28, TICKER_MS L29, interval L49-53 (không phải "L26-34" gộp). Đã sửa cite + thêm timer.
6. secondary-css cite — CONFIRMED trivia: `::before` cream tại `tien-hiep-secondary-ui.css:124-127` (không phải L125 đơn lẻ). Đã sửa cite.

**Phát hiện bổ sung trong lúc verify (đã fold vào report):** `.hk-scroll .hk-scroll__rail` (tien-hiep-ui.css:185-186) là dead selector — zero element trong codebase; `useTooltip.ts:161,176` chỉ nhắc DongFuHomeContent trong comment (không phải live edge); `ui.wheel.select` cue tồn tại `AudioCueManifest.ts:263` (live, không dead); `ExplorationSurface.vue:456` được mount bởi StageSelectPanel → ví dụ overlay canvas của report đúng production path; `spirit_spring` có dir art v2 nhưng không có BUILDINGS map (không reachable qua header art).

**Verdict cuối:** report gốc ~95% citations chính xác nhưng thiếu 1 chrome sống (AutoFarmIndicator), toàn bộ cơ chế dialog (useDialogFocus ×20), Teleport của FeedbackDialog, timer/observer sống, dead store actions, vùng chết rail, và phóng đại 2 claim hành vi (§4#2 beta-unreachable, §4#7 dead-DOM). Đã vá tất cả vào bản trên.
