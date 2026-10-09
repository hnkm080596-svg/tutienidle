# Final review — Overlay Host audit (devin/artui-c0-foundation @8ffc8e64)

## Wrong

- **W1 — §1/§4.10 "không nơi nào reset panel state khi route rời home" là sai.** `useBattleActions.ts:134` ghi thẳng `ui.leftPanelMode = null` trong `startSelectedStage` (path StageSelectPanel → combat). Phần sống sót qua combat thực tế chỉ là `standalonePanel` + `characterOverlayOpen` + wheel (wheel không thể mở khi surface open). Còn bất đối xứng: `startBattle` (`:83-85`, cùng file) gọi `enterCombatScene` mà KHÔNG reset leftPanelMode. §7.1 cần thu hẹp về "standalone/character overlay sống qua combat; left panel chết ở entry stage_select".
- **W2 — §1 "mutual exclusion an toàn vì chỉ dead actions bypass" là sai.** Có writer live bypass action layer: `ExplorationSurface.vue:86` `openBuild()` → `ui.standalonePanel = 'skill'` (direct write, không qua `openStandalonePanel`, không `closeHomeOverlays`). ExplorationSurface mount trong `StageSelectPanel.vue:17` khi `leftPanelMode='stage_select'` → bấm "build link" (`ExplorationPaperDetails.vue:32`) để `leftPanelMode` đứng nguyên VÀ `standalonePanel='skill'` → StageSelectPanel (paper) + SkillPathPanel mount đồng thời — hai overlay cùng sống, phá contract "exactly one surface" mà report kết luận không thể sập.
- **W3 — cite sai line:** `useBuildingHeaderState.ts` `artPath` nằm ở `:36`, report ghi `:28`.
- **W4 — cite lệch 1 dòng:** `DevToolsPanel` self-gate `isMaster` thực tế ở `:286` (button) và `:289` (aside); report ghi `:287,:290`.
- **W5 — §1 "FeedbackDialog 3 mount site" thiếu 1:** `ui-preview/SecondaryPreview.vue:63` là site thứ 4 (preview-only). Đồng thời `SecondaryPreview.vue:34` gọi `ui.closeHomeOverlays()` — writer phía preview report không liệt kê.

## Missed

- **M1 — importer production của `pc-paper-scene.css` bị sót.** `DongFuStage.vue:33` `import '@/assets/pc-paper-scene.css'` là importer component production duy nhất (3 importer còn lại là PcPaper* dormant, cộng `@import` chain). Kết luận "global production" vẫn đúng nhưng mount-chain inventory thiếu đường nạp độc lập này — gỡ `pc-paper-production.css` cũng không rút sheet ra khỏi build.
- **M2 — danh sách Teleport-to-body thiếu 3 chrome.** `Tooltip.vue:148`, `ToastContainer.vue:113`, `ActionFeedbackLog.vue:39` cũng `<Teleport to="body">` — tức chrome block `GameRoot.vue:180-203` thực tế thoát `.game-root` về body root stacking (đúng tinh thần `OverlayLayers.ts:6-7` comment). Report chỉ liệt kê 4 teleport (Feedback/Confirm/Lore/Abandon).
- **M3 — `PcBodyMeridianOverlay.vue` 0 production consumer.** Component overlay trong `components/common/` chỉ được `PcPaperScene.test.ts:6,:38` tham chiếu — cùng class dead-code với `PcPaperSceneActions` mà report đã bắt, nhưng file này sót.
- **M4 — direct-write close path thứ hai trong ExplorationSurface.** `ExplorationSurface.vue:247` `ui.leftPanelMode = null` khi auto-farm arm thành công — một close path nữa bypass `closeHomeOverlays` (cùng kiểu W1, nhưng entry perfect_farm).
- **M5 — CSS inventory thiếu 3 sheet ngoài `assets/`-chain.** `art/vfx/pc-paper-meridian/acupoint-aura.css` (importer `PcBodyDiagram.vue:3`); `scenes/login/loginFields.css` (scoped-src `LoginPasswordField.vue:27`, `LoginIdField.vue:24`); `scenes/creation/art-needed.css` — 0 importer → file mồ côi thứ 6 ngoài list 5 file report nêu.
- **M6 — ConfirmModal owner-layer chưa ghi:** `SaveIncompatibleScreen` mount ConfirmModal riêng (layer `saveGateModal` 4100 trong `OverlayLayers.ts:44`) — ladder §4.14 có tầng nhưng không gán consumer; save-gate modal là phần "backdrop layers" của scope.

## Verified-ok (spot-checked, không re-litigate adjudicated)

- App.vue mount map :1249-:1395 + `.authority-overlay` style `:1440` + `bindUiAudio :299`/`:1237` — đúng từng dòng.
- GameRoot.vue: isFullSceneActive :70-72, mountedStandalone watch :77-100 (bounce technique :89-95), warm :110-123, v-if :140-175 (9 standalone :156-174), chrome NGOÀI v-if :180-203, RouteMount :205, closeSidePanels :130-132.
- FunctionOverlayPanel.vue: mode :69-77, PAPER :53-58, IMPERIAL :41-47, BUILDINGS :60-67, artBroken :96/:98-100, TITLE_KEYS :25-34, testid trùng :126/:163, @container unnamed :242-244.
- OverlayPanel.vue: props :11-27 (panel=1800 :25), cardEl :33-38, useDialogFocus :39, scrim @click.self :53, InkNineSlice :66-68, container-name :99, overlay-fade :120-123, variant system dormant :55-59.
- ImperialScrollScene.vue: props :17-25, useDialogFocus :33, scrim rgba(6,8,12,.34)+blur2 :140-141, slots #header/#footer/#overlay :109-125, hk-scroll :319-365, reduced :374-397, art refs :38-42/:57-104, R9 comment :29-30.
- useDialogFocus.ts: Esc stopPropagation :38-41, Tab prevent+stop :48-49, mousedown guard :73-79, restore :87/:99.
- stores/ui.ts: 4 state :123-:151, closeHomeOverlays :258-263, openLeftPanel :226-242, openStandalonePanel :244-255, toggleStandalonePanel KHÔNG close :320-331, enterCombatScene :350-352.
- DongFuStage.vue: NAV_ITEMS :204-208, NAV_LOCKED :203, NAV_FEATURE_LOCKED :214-216, NAV_TARGET :226-245, NAV_ACTIVE_* :249-265, navActive :267-278, navAction :280-291, activateSlot :330-345 (closeCommandWheel :333), onWheelAction :347-359, INTERACTIVE_SELECTOR :364, onSceneClick :366-369, keydown :380-401, window listener :403-408, surfaceOpen :56-58 + watch :67-69, flashNotice :82-95, mount :412-497, covered CSS :566-567, :569.
- betaScopeSurface.ts: wheel map :64-78, standalone map :132-144, left map :152-163 (worker_lodge→manualWorkforce :159), betaWheelSlots :92, isBeta* :118/:165/:169. betaFeatureFlags all-false :31-43.
- PresentationTransitionOverlay.vue: props :20-34 (no inert), transitionend×2+safety600 :86-137, focus :141-151, keydown capture :170, expose :177-181, .presentation-overlay :186, pointer-events :261-267, curtain :272-290.
- OverlayLayers.ts: 12 tầng :19-46 đúng số. huyen-kim-chrome.json: 44 asset all-ready.
- Surface close bridges ×11 + panel closes (QuanKhi:221, Artifact:135, TranPhap:250, Companion:312) + direct mount cites (Skill:16, Realm:14, Technique:14, Body:14, Quest:30 + `:rows` thật, QuanKhi:316, Artifact:140, TranPhap:348, Companion:317).
- Global CSS: ui.css :10/:86-105/:185-196/:262-263/:322/:367-411; secondary :3-22/:72-74/:124-137; auxiliary :77-80; production :3/:5-14/:15-18 (đúng "9 selector KHÔNG gồm lore-modal")/:20-21.
- usePaperNavigation 0 production caller; PaperPanelNavigation chỉ PaperPreviewSurface:6,:19; PcPaperSceneActions 0 mount site toàn repo; orphan CSS ×5 đúng.
