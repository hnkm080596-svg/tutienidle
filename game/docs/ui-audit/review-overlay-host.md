## Missed

**Lớp CSS global cuối (report chỉ map tới secondary-ui):**
1. `assets/pc-paper-production.css` — stylesheet global CUỐI trong `main.ts:11` — viết lại đúng các class report gán cho secondary-ui: `:15-18` `.overlay-panel__card:not(.overlay-panel__card--system)` + 8 modal panel nhận `background:none;border:0;border-image:none;isolation:isolate`, đè `border-image:panel-frame-v2` của `tien-hiep-secondary-ui.css:14` (load trước, `main.ts:9`) → `::after { border-image: inherit }` tại `secondary-ui.css:127` kế thừa `none` (khung nine-slice thực tế bị tắt). `main.ts:5-11` thứ tự import đúng như report nhưng hệ quả cascade thì không.
2. `pc-paper-production.css:1` `@import './pc-paper-scene.css'` → `pc-paper-scene.css:1` `@import './pc-paper-type.css'`: cả hai sheet report xếp "chỉ preview/DongFuStage" thực ra nằm trong chuỗi global production.
3. `pc-paper-production.css:3` remap `--font-display/--font-body/--hk-font-display/--hk-font-ui` toàn app; `:5-14` restyle mọi `.game-button` (kể cả nút close của OverlayPanel `OverlayPanel.vue:90`) — gồm `:12` `.game-button>.ink-nine-slice{display:none}` = một lớp dead-DOM nữa report không kể; `:20` reskin lại `#global-tooltip` lần 3; `:52-61` `.feedback-dialog*`; `:21` `.pc-paper-scene{pointer-events:auto}`; `:67-69` `.hk-art-scene` box-sizing reset (đè `.df-scene.hk-art-scene` DongFuStage + mọi art-scene port); `:24-49` ~25 selector `.pc-settings-content .settings-panel*`.
4. `tien-hiep-auxiliary.css:77-80` — mọi `.overlay-panel__card` + modal `::before` nhận `background-image: var(--th-art-warm-landscape-header), var(--th-art-paper-surface)` — asset art-map chưa liệt kê; kèm `.tran-phap-panel*` `:2-40+`, `.artifact-panel` `:82`.
5. `tien-hiep-ui.css:10` `.scene-viewport:not(--overlay){background:#15221e}` đè nền canvas non-overlay (DongFuStage); `:105` `.hk-scroll__inner .game-button--secondary` đè màu nút trong scroll (nơi `BuildingUpgradeButton` render, `FunctionOverlayPanel.vue:144`); `:191-196` `.production-panel` (consumer duy nhất của scroll); `:322` `.inventory-scene .chip>.ink-nine-slice{visibility:hidden}` — thêm dead DOM.
6. `tien-hiep-secondary-ui.css:72-74` `.building-heading*` — override global của scoped block `FunctionOverlayPanel.vue:201-236` (report liệt kê nhiều override khác của cùng file nhưng bỏ nhóm này).

**Mount chain / writers sót:**
7. DongFuStage mount TRONG `MainScene.vue:18` (sibling `PhaserCanvas`), không phải con trực tiếp của `.game-root` — report §1/§4.15 phân tích `closeSidePanels` mà không chỉ ra vị trí này (đúng kết luận hẹp nhờ `@click.stop` `DongFuStage.vue:419`, nhưng thiếu căn cứ mount).
8. Writer sót: `RealmSurface.vue:107-109` `onQuanKhi()` → `ui.openStandalonePanel('quan_khi')` — quan_khi mở từ trong scene Realm, không chỉ qua tribulation receipt (`useTribulation.ts:105-109`).
9. `CombatSceneOverlay`/`TribulationSceneOverlay` `GameRoot.vue:177-178` — full-scene overlays mà `isFullSceneActive` phục vụ; report nhắc cơ chế nhưng không đếm mount.
10. Overlay/chrome ở App.vue ngoài report: `CombatPauseOverlay :1314` (`:inert`, `@continue` — layer combatPause=900 nằm DƯỚI panel=1800 trong `OverlayLayers.ts`), `BetaCompletionModal :1303-1306` (xem Wrong #1), `UpdateBanner :1391`, `ErrorScreen :1395`, `SaveIncompatibleScreen :1275` (saveGate 4000), `LoadingScreen :1289`, `OnboardingStage+AuthEntryScreen+CharacterCreationScreen :1262-1264`, `PhapTuLabBridge :1393` mount bất điều kiện (tự gate DEV `PhapTuLabBridge.vue:30-44`), thêm 2 `.authority-overlay` `:1364` (quitFlushOffer) + `:1380` (updateInstallFailed) ngoài `:1336,:1345`, style `.authority-overlay` `App.vue:1440`.
11. RouteMount witness ×3 `App.vue:1249,1258,1268` (boot/auth/error) — report chỉ đếm `GameRoot.vue:205`.

**Cơ chế curtain report chưa mổ:**
12. `PresentationTransitionOverlay.vue`: `transitionend` listeners + `safetyTimeout` `:89-130`; `lastActiveElement` save/restore `:141-151`; `defineExpose :177-181`; keydown là document **capture** listener `:154-175` (`capture:true :170`) → chạy trước bubble-phase `window` keydown của DongFuStage `:404-408`.

**Đường đóng panel thật của fidelity scenes:**
13. Report map `useDialogFocus onEscape` + `@click.self` chết nhưng không map cầu `@back`: surfaces forward `emit('back')` → `ui.closeHomeOverlays()` tại `SettingsSurface.vue:20`, `BodySurface.vue:19`, `TechniqueSurface.vue:20`, `SkillSurface.vue:15+17`, `CharacterSurface.vue:19`, `InventorySurface.vue:15` — đây là đường close production chính cho scene giấy.
14. `useDialogFocus.ts:48-49` — Tab cũng `preventDefault`+`stopPropagation`, không chỉ Escape (`:37-41`).

**Adapter pattern trong panels:**
15. Surfaces mount fidelity scenes với PROPS RỖNG + named slots: `QuestScene.vue:81` (`:quests="[]" :rewards="[]"`, data thật qua `#tabs/#list/#detail`), `InventorySurface.vue:71` (`:items="[]"`), `SettingsSurface.vue:17` (`:groups="[]"` + `#workspace` SettingsPanel) — scene shell chỉ là chrome; report mô tả như thể scene tự render data.
16. `FeedbackDialog` có 3 mount site: `DongFuStage.vue:497`, `SettingsPanel.vue:382`, `ErrorScreen.vue:192` — report không đếm consumer.
17. `BuildingUpgradeButton` `FunctionOverlayPanel.vue:6,:144,:187` — CTA nâng cấp trong cả slot `#header` scroll và `#header-actions` legacy; host logic report bỏ qua.
18. `AutoFarmIndicator` `DongFuStage.vue:492`; cue trực tiếp `cue('ui.wheel.select')` `:282,:332` ngoài `uiAudioBinding` (`uiAudioBinding.ts:44-69`); bind/unbind `App.vue:299/:1237`.
19. `NAV_LOCKED` cứng `['artifact','companion','guild','sect','portal']` `DongFuStage.vue:203-208` + `betaWheelSlots` gating `:109` (`betaScopeSurface.ts:92`) — wheel bị beta-filter; report chỉ nói `NAV_FEATURE_LOCKED :214-221`.
20. `.df-scene--covered` chỉ ẩn `.df-board`/`.df-notice` (`DongFuStage.vue:566-567`) — profile/currencies/quest card/rail vẫn hiện + bấm được dưới overlay trong suốt: chính là nửa cơ chế còn thiếu của §4.12.
21. Dead `#footer` slot `ImperialScrollScene.vue:115-117` — report chỉ flag `#overlay` `:123-125`.
22. `tien-hiep-entry.css` CÓ đường production: `AuthEntryScreen.vue:12` (auth scene mount `App.vue:1262-1264`) — report xếp vào nhóm không nạp.
23. CSS hoàn toàn mồ côi (0 importer, mạnh hơn "không trong main.ts"): `tien-hiep-collections.css`, `tien-hiep-outcomes.css`, `tien-hiep-forge.css`, `tien-hiep-progression.css`, `pc-paper-auxiliary-production.css`.
24. `qi-hall.css` import bởi `EquipmentHallPanel.vue:10` (+ RefineTab/WashTab) — stylesheet scoped theo panel không nằm trong inventory.
25. `installTienHiepUiAssets(document.documentElement)` `main.ts:59` — nguồn inject mọi biến `--th-art-*` mà global rules dùng; art-map chỉ cite manifest.
26. `noticeTimer`/`flashNotice` `DongFuStage.vue:82-95` + `.df-notice:empty{display:none}` `:569` — timer live nhưng report chỉ nhắc thoáng.
27. Dormant shells chưa kể: `PcPaperScene.vue`, `PcPaperDialog.vue`, `PcPaperChrome.vue` (chrome giấy hoàn chỉnh, chỉ sống ở ui-preview; PcPaperChrome chỉ được `PcPaperDialog.vue:14` mount).

## Wrong

1. **BetaCompletionModal host sai**: report §5 xếp vào nhóm "host sẵn trong GameRoot" — thực tế mount `App.vue:1303-1306`, ngoài GameRoot (trong ErrorBoundary).
2. **Contract closeHomeOverlays không đúng nguyên văn**: "mọi opener gọi closeHomeOverlays trước (`:209,219,233,239,252,272`)" — `toggleStandalonePanel` `stores/ui.ts:320-331` KHÔNG gọi. Không sập nhờ `toggleStandalonePanel` + `toggleLeft` đều **dead actions** (0 caller — chỉ `toggleCommandWheel` được gọi `DongFuStage.vue:399`) — nhưng claim invariant như viết là sai, và 2 action chết này cũng không được flag.
3. **Manifest sai số**: `ui/huyen-kim-chrome.json` có **44** asset đều `status:'ready'` — report ghi "43/43".
4. **Curtain `:inert` sai một nửa**: §4.14 "mount ngoài GameRoot nên không bị :inert" — sai: `App.vue:1320` bind `:inert="authorityOverlayActive"`; `inert` không phải prop khai báo (`PresentationTransitionOverlay.vue:21-30`) nên rơi xuống root `.pt-overlay` làm DOM attribute. (Phần keydown vẫn đúng — document capture listener không bị inert chặn.)
5. **`pc-paper-scene.css` claim sai**: "chỉ nạp trong `DongFuStage.vue:33` + preview pages" — còn được import bởi `PcPaperChrome.vue:2`, `PcPaperDialog.vue:3`, `PcPaperScene.vue:2` và transitively qua `pc-paper-production.css:1` → tải global trong production.
6. **`pc-paper-type.css` cũng được nạp** — transitively qua `pc-paper-scene.css:1` `@import`.
7. **PaperPanelNavigation consumer sai**: "chỉ còn trong PcPaperSceneActions/preview" — `PcPaperSceneActions.vue:5` chỉ `import type` (type-only); component được render duy nhất bởi `ui-preview/PaperPreviewSurface.vue:6`. Và `usePaperNavigation` (function) không caller nào kể cả preview — chỉ `PAPER_NAV_IDS` const được preview import.
8. **Layer ladder §4.14 thiếu tầng**: `OverlayLayers.ts:19-46` có `tooltip=2200`, `appError=3000`, `saveGate=4000`, `saveGateModal=4100` giữa authority(1950) và curtain(5000) — subsequence đúng thứ tự nhưng trình bày như thang đầy đủ là thiếu 4 layer.
9. (nhỏ) `FeedbackDialog.vue:362` cite lệch 1 dòng — Teleport `:361`, `variant="paper"` `:366`.

## Verified-ok

- `FunctionOverlayPanel.vue`: `mode` chokepoint `:69-77`; `PAPER_MODES :53-58`, `IMPERIAL_MODES :41-47` (chỉ 'exploration' sống trong scrollMode `:82-84`); `BUILDINGS :60-67`→`buildingId :89`→`useBuildingHeaderState :91`; `artBroken`/watch `:96-100`; `close() :102-104`; `th-panel-swap :113-118`; `ImperialScrollScene :122-155` (dup testid `:126`); `OverlayPanel :158-195` (dup testid `:163`, WorkerLodge/ScripturePavilion/Vendor `:190-194`); `@container :242-244`.
- `stores/ui.ts`: 4 field `:123,:125,:130,:135,:151`; `closeHomeOverlays :258-263`; beta gates `betaScopeSurface.ts:132-171` (worker_lodge→manualWorkforce `:159`); `enterCombatScene :350-352` không reset → panel sống qua combat (§4.10 đúng).
- `GameRoot.vue`: `MainScene @click :138`; `isFullSceneActive :70-72`; `mountedStandalone` lazy-once `:77-100` + Tam Phap bounce `:89-95`; idle warm `:110-123`; 9 lazy panels `:156-174`; chrome `:180-203`; `RouteMount :205`.
- Shells: `OverlayPanel.vue` props `:11-27` (layer 1800), `useDialogFocus :39`, scrim `@click.self :53`, InkNineSlice `:66-68`, `overlay-fade :120-127`, variant system dormant; `ImperialScrollScene.vue` scrim `:140`, `useDialogFocus :33`, transition `:319-365`, art urls `:38-42`, dead `#overlay :123-125`; `SceneDesignCanvas.vue` overlay `pointer-events:none :41-42`, `isolation:isolate :43`.
- Fidelity scenes: `useDialogFocus(rootRef, () => true, onEscape→back)` + `@click.self` chết do `tien-hiep-ui.css:390-411` (Exploration `:18,:21`; Character `:32` + comment lạc hậu `:46-49`; Technique `:21,:24`; Settings `:29,:33`) — §4.2 đúng.
- Writers: `NAV_TARGET :226-245`, `navAction :280-291`, `activateSlot :330-345`, `useBuildingNavigation.openBuilding :137-155` (fail-closed), `useThienCoEntries :77,:94` + CTA `:120,:134,:145`, `useTribulation :105-109`, `PhapTuLabBridge :33-44` (DEV+mock gate), `commandWheelCatalog.ts:88-246` (cite `:94-242` lệch nhẹ).
- `DongFuStage.vue`: `surfaceOpen :56-58`, `INTERACTIVE_SELECTOR :364` + `onSceneClick :366-369`, keydown gate `:380-401` + window `:404-408`, quest card `:433-445`, rail `:446-470`, seam `:471`, wheel `:480-485`, `FeedbackDialog :497`.
- Globals: `main.ts:5-11` thứ tự; `.hk-scroll__*` overrides `:86-91,:92,:104,:185-190,:262-263`; `.th-panel-swap :367-379`; pointer pass-through `:390-411`; `.paper-navigation*` dead rules `:11-24,:202-206,:353-357`; `secondary-ui.css:3-22,:124-137`; `OverlayLayers.ts:19-46` giá trị đúng.
- Teleports: `FeedbackDialog :361-366` (paper variant — caller duy nhất), `ConfirmModal :78-83`, `LoreCodexModal :30-33`, `GuestAbandonDialog :34-39`.
- Standalone shells: `SkillPathPanel :16`, `RealmPanel :14`, `TechniquePanel :14`, `BodyPanel :14`, `QuestPanel :30` (th-panel-swap + fidelity); `QuanKhiPanel :316`, `ArtifactPanel :140`, `TranPhapPanel :348`, `CompanionPanel :317` (OverlayPanel legacy).
- `useDialogFocus.ts`: Escape stopPropagation `:37-41`, mousedown guard `:73-79`, restore focus `:87,:99`; `uiAudioBinding.ts:44-69`; `useBuildingHeaderState.ts:36` artPath; `saveShapeValidation.ts:4822-4833` 'quan_khi' pin.