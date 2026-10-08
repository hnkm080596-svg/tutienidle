# Panel: Cài Đặt

Audit branch `devin/artui-c0-foundation` @ `8ffc8e64`, root `game/`. Settings đang ở giữa reskin: shell fidelity mới (`SettingsFidelityScene`) bọc panel thật (`SettingsPanel`), song song còn preview fixtures, một skin PC-paper production đè toàn cục (`pc-paper-production.css`), và một biến thể CSS dormant (`tien-hiep-outcomes.css` — file không được bundle).

## 1. Mount chain

**Đường sống (in-game):**

1. `src/components/scenes/dong-fu/DongFuStage.vue` — `NAV_ITEMS` chứa `'settings'` (L207), `NAV_TARGET['settings'] → ui.openLeftPanel('settings')` (L240), `NAV_ACTIVE_PANEL` map settings→'settings' (L255), icon `navigation-settings-v2` (L458). Command wheel: `src/data/ui/commandWheelCatalog.ts` L238-243 slot `{id:'settings', ring:4, target:{kind:'left_panel',mode:'settings'}, available:ALWAYS_AVAILABLE}`.
2. `src/stores/ui.ts` — state `leftPanelMode`; `openLeftPanel(mode)` gate qua `isBetaLeftPanelMode` (L226-242). `src/core/betaScopeSurface.ts` `BETA_LEFT_PANEL_FEATURES.settings = null` (~L156, luôn admit), `isBetaLeftPanelMode` (~L169).
3. `src/components/layout/GameRoot.vue` L10 import + L150 mount `<FunctionOverlayPanel/>` (sibling của `LeftPanel`, NGOÀI cây `DongFuStage` — DongFuStage sống trong `MainScene` L18).
4. `src/components/layout/FunctionOverlayPanel.vue` — `TITLE_KEYS['settings']` (L27); `'settings'` nằm trong cả `IMPERIAL_MODES` (L41-47) lẫn `PAPER_MODES` (L53-58) → mount ngoài scroll shell; `mode` computed beta-gate (L69-77); L113-118 `<Transition name="th-panel-swap">` + `<SettingsSurface v-else-if="paperMode==='settings'"/>`; `close()` → `ui.closeHomeOverlays()` (L102-104).
5. `src/components/scenes/settings/SettingsSurface.vue` (23 dòng) — `SceneDesignCanvas` overlay → `SettingsFidelityScene` với `:groups="[]" active="" notice="" @back="ui.closeHomeOverlays()"` → slot `#workspace` → `<SettingsPanel/>`. Comment L4 nhắc "usePaperNavigation wiring" nhưng file không import nó (stale comment).
6. `src/components/common/SceneDesignCanvas.vue` (44 dòng) — canvas thiết kế 1440×810; `ResizeObserver` (L21, guard `typeof ResizeObserver` cho jsdom) đo + scale; prop `overlay` → `.scene-viewport--overlay` transparent + pointer-events pass-through.
7. `src/components/scenes/settings/fidelity/SettingsFidelityScene.vue` (67 dòng) — khung giấy `.settings-paper` (inline `borderImageSource` L24 = `character-v2/paper-nine-slice.png`), `.settings-title`, `.settings-content` chứa slot workspace; `useDialogFocus(rootRef, ()=>true, {onEscape: emit('back')})` (L29); `@click.self=emit('back')` trên `.settings-scene` (L33); default slot = preview DOM (nav `['all','audio','display','storage','support']` + `SettingsFidelitySection` + `.settings-actions`, L38) — không render ở production vì slot luôn được lấp; `.settings-notice` (L42) render `notice=""`; `.settings-preview` (L41) gated bởi prop `preview` (false ở prod).
8. `src/components/panels/SettingsPanel.vue` (450 dòng) — grid `.settings-panel` (nav | `.settings-panel__workspace.scrollfade`), mount `SettingsNavRail` + 7 section + dialogs.

**Đường sống thứ hai (pre-login):** `src/components/scenes/login/LoginOpening.vue` — nút `PcPaperButton data-testid="opening-settings-button"` → `emit('settings')` (~L17); `src/components/onboarding/AuthEntryScreen.vue` (KHÔNG phải `scenes/login/`) — `@settings="drawer = 'settings'"` (~L166) → `LoginSideDrawer` → `LoginSettingsContent` (~L184) tái dùng 3 section thật (Audio/UiScale/Language) trong thẻ mực tối. Tab `'auth'` của cùng drawer còn mount `LoginLocaleChips`.

**Đường dormant/preview (vẫn reachable qua `game/legacy/ui-*.html` + entry `src/ui-preview/settings.ts`):**

- `src/ui-preview/SettingsPreview.vue` → `SettingsFidelityScene` `preview` + seed giả {master:80, music:60, effects:70, musicOn, effectsOn, scale:'100', language:'vi', motion:false}; action storage/support chỉ set notice — mock thuần. Entry `src/ui-preview/settings.ts` L5 dùng bundle i18n riêng `settingsMessages` (`ui-preview/settingsMessages.ts` — spread `remainingMessages.vi`; `settingsPreview.*` block ở `remainingMessages.ts` L15 khớp taxonomy fixture).
- `src/components/scenes/settings/fidelity/SettingsFidelitySection.vue` — renderer control range/toggle/select cho fixture; consumer ngoài preview: `src/ui-preview/remainingPreview.test.ts` L9-10 import + mount (L41-44).
- `src/ui-preview/HomeSupportArtPanel.vue` (33 dòng) — mock panel settings đầy đủ (sound toggle + 4 channel range + shake/motion toggle + scale 80/100/120 + quality + language + reset); `LandscapeDesignPreview.vue` mount khi `activePanel==='settings'||'feedback'`.
- `src/ui-preview/AuthPreviewSettings.vue` (49 dòng) — mock khác: nút on/off `PcPaperButton` + range từng kênh + reducedShake checkbox + TÁI DÙNG `SettingsUiScaleSection`/`SettingsLanguageSection` thật (trộn mock+real); dùng bởi `AuthInteractivePreview.vue`.
- `src/ui-preview/AuxiliaryDesignPreview.vue` (96 dòng) — ví dụ 'settings' với categories + volume refs riêng.
- `src/composables/usePaperNavigation.ts` — `PAPER_NAV_IDS` có 'settings' (L40), `NAV_TARGETS.settings → {kind:'left_panel',mode:'settings'}` (L58), `NAV_LABEL_KEY` L61-73 (`settings→paperNav.settings` L72), `LEFT_PANEL_NAV_ID` L78-84 (`settings→settings` L83), API `items`/`navigate`/`activeId` (L92-142, navigate gọi `ui.openLeftPanel`). Chỉ preview/type-import còn tham chiếu (`ui-preview/paperNavigation.ts` L1 import `PAPER_NAV_IDS`); production đã bỏ in-panel nav theo comment "R9 ruling" (`ImperialScrollScene.vue` L29-30, `CharacterFidelityScene.vue` L5). `PaperPanelNavigation.vue` + `PcPaperSceneActions.vue` cùng chết theo.

**Bundle CSS production (main.ts L5-11):** `theme.css` → `huyen-kim.tokens.css` → `system-theme.css` → `tien-hiep-ui.css` → `tien-hiep-secondary-ui.css` → `tien-hiep-auxiliary.css` → `pc-paper-production.css` → (`@import` `pc-paper-scene.css` → `pc-paper-type.css`). `installTienHiepUiAssets(document.documentElement)` (main.ts L59) set `--pc-*` + `--th-art-*` lên `:root` (`TienHiepUiAssets.ts` L25-29). `tien-hiep-outcomes.css` KHÔNG nằm trong chuỗi này và không `@import` nào kéo nó.

## 2. UI logic inventory

**`SettingsPanel.vue`:**

- Stores/refs: `usePlayerStore`, `useGameManager`, `useNotificationStore`, `useI18n` (L30-33).
- `remoteAuthoritative = cloudSaveCoordinator.capability==='remote-authoritative'` (L40) — gate account section + nhánh import cloud.
- `pendingConfirm` ref + `requestConfirm/resolvePendingConfirm/cancelPendingConfirm` (L45-58) — modal xác nhận dùng chung cho reload/import/reset/logout.
- `uiScale` ref (`loadUiScale`) + `handleUiScale`→`saveUiScale` (L61-66); `handleLocale`→`saveLocale` (L68-70).
- `lastSavedLabel` ref (L72) → render L380 `.settings-panel__hint` — grid-placed vào hàng 2/cột 1 (dưới nav, không nằm trong workspace).
- `updates = useActiveUpdates()` + `updateState`/`updatePhase`/`updateProgressPercent` computeds (L76-79); `retryInstall`/`later`/`installFailed` không nối tới UI nào.
- `feedbackOpen` ref → `<FeedbackDialog :open>` (L83, 382).
- `handleSave` (L88-106): `player.save(gameManager)` → `observeAuthoritySaveResult` → `notification.push('save'|'error')` + cập nhật `lastSavedLabel`.
- `handleLoad` (L108-119): confirm → `window.location.reload()` (comment ghi `restoreFromSave` additive → reload là đường an toàn).
- `handleExport` (L123-150): await save → `cloudSaveCoordinator.readCachedSave()` fallback `getRawSave()` → `exportSaveToFile(raw,{source:'cloud'|'local',revision})`.
- `handleImportFile` (L152-204): FileReader; remote → `validateRecoveryData` → `exportSaveToFile(normalized,{source:'recovery-import'})` (chỉ validate, không đụng cloud); local → `importSaveRaw` → reload hoặc toast lỗi.
- `handleReset` (L206-219): confirm danger → `window.dispatchEvent(new Event(SAVE_RESET_REQUEST_EVENT))` → `App.vue` L893 `resetSaveFromSettings` (listener L1163/remove L1228).
- Account: `storedAccount` ref (`remoteAuthoritative ? readSupabaseSession() : null`, L226), `accountIsGuest`, `pendingUpgradeLoginId`, `showAccountUpgrade`, `refreshStoredAccount` (L234-236); `logoutDialog` ref `'none'|'abandon'|'unsynced'` + `logoutBusy` (L241-242); `startLogout` (guest→dialog 'abandon'; else confirm→`runLogout`, L244-256); `runLogout`→`requestSessionLogout({acknowledgeUnsynced})`→'done'|'unsynced' (L258-275); `onAbandonUpgrade`, `onAbandonExport`→`handleExport` (L277-284).
- `activeSection` ref `'general'|'display'|'audio'|'account'|'update'|'support'` + `onSelectSection` (L289-294); `navSections` computed — account chỉ khi `remoteAuthoritative`, update chỉ khi `updateState!==null && phase!=='unsupported'` (L295-309).
- `sliderTrackUrl`/`sliderThumbUrl` qua `hkChromeUrl('slider-track'/'slider-thumb')` + `sliderChromeStyle` → class `has-hk-slider` + `--hk-slider-track/--hk-slider-thumb` trên root `.settings-panel` (L312-321, mount L325) — trùng vai trò với computed riêng trong `SettingsAudioSection`.
- Template: sections v-if theo `activeSection` (L336-377): Save@general; UiScale+Language@display; Audio@audio; Feedback+Build@support; Account@account (remote-only); Update@update (gated). Hint L380, `FeedbackDialog` L382, `ConfirmModal` chính L384-391, `GuestAbandonDialog` L395-402, `ConfirmModal` thứ hai cho 'unsynced' L406-414.
- Scoped CSS L418-450: grid `minmax(140px,190px) 1fr`; rule `@container (max-width:760px)` collapse sang hàng (L441-444) — dead vì không có ancestor `container-type` trong chuỗi mount production (trùng warning của chính `FunctionOverlayPanel` L238-241).

**`SettingsNavRail.vue` (61 dòng):** `QuestCategoryArtButton` per section; `SECTION_ICON` provisional (L17-24): general→settings, display→realm, audio→feedback, account→character, update→production, support→guild; icon URL `navigation-{icon}-v2.png` (L25-26). Giữ contract `.settings-panel__nav`/`data-section`/`.is-active` (class `settings-panel__nav-seal` trên nút L36) cho test.

**Sections** (đều ở `src/components/scenes/settings/`, bọc `SettingsSectionFrame` + `data-hk-region`):

- `SettingsSaveSection.vue` (86): note autosave + 5 action `GameButton` (save/reload/export/import qua hidden file input/reset-danger); scoped `.settings-panel__actions` flex-col `width:100%` — bị global đè thành grid 2 cột (`tien-hiep-ui.css` L244-246).
- `SettingsUiScaleSection.vue` (55): Chips × `UI_SCALE_OPTIONS`, emit select.
- `SettingsLanguageSection.vue` (60): note + Chips × `LOCALE_OPTIONS`, `data-testid="settings-locale-*"`.
- `SettingsAudioSection.vue` (179): slider master + `AUDIO_CHANNELS` {music,sfx,ui} (L13-17) với `:disabled="!audio.enabled"` (L57,77) — nhưng KHÔNG có control on/off; `audio.enabled`/`setEnabled` không có UI production (comment L2-3 vẫn liệt kê "on/off" trong bộ control dự kiến). `sliderChromeStyle` riêng (L28-37) bắt buộc cho drawer login tái dùng section không qua panel; scoped `.has-hk-slider` range chrome (L132-173) consume `--hk-slider-track/--hk-slider-thumb`; Chip `reducedShake` (L86-94, class `settings-panel__audio-toggle`).
- `SettingsAccountSection.vue` (74): note + `GuestUpgradeCard` + nút upgrade/logout `GameButton` (testid `settings-upgrade-button`, `settings-logout-button`).
- `SettingsFeedbackSection.vue` (33): note + `settings-feedback-button` → emit('open').
- `SettingsBuildSection.vue` (63): 7 `BUILD_ROWS` từ `BUILD_IDENTITY` (version/build/commit/schema/environment/channel/builtAt testids).
- `SettingsUpdateSection.vue` (105): status line theo phase (available/downloading/downloaded/checking/unavailable/error) + nút download/cancel/install/check; check disabled khi checking/installing.
- `SettingsSectionFrame.vue` (48): h4 + `.settings-panel__plaque.art-needed` TEMP ART (`data-art-id="settings-section-plaque"`, radial-gradient + dashed outline L36-47) — art thật `section-plaque@1x/2x.png` đã có + manifest 'ready' (`huyen-kim-chrome.json` L466-484) nhưng chưa wire.

**Supporting stores/composables/listeners:**

- `src/stores/audio.ts` — `enabled` (default true ~L84), `masterVolume` 0.7, channel {music,sfx,ui}, `reducedShake`; persist `tutienidle.audio.v2` (+fallback v1); actions `setEnabled` (L117-121)/`setMasterVolume`/`setChannelVolume`/`setReducedShake`/`hydrateManager`/`unlock`.
- `src/composables/useUpdates.ts` — singleton `boundSurface` (`bindUpdateSurface` do `App.vue` ~L792 gọi, unbind ~L1226); handle expose `state/installFailed/candidateVersion/check/download/cancelDownload/install/retryInstall/later/dispose`.
- `src/composables/useDialogFocus.ts` — focus-trap + Escape + mousedown-outside-cancel: keydown listener gắn trên card element (L65; Escape→`onEscape` L38-41, Tab cycle L43-63), `document.addEventListener('mousedown', handler)` L73-79 (preventDefault khi target ngoài card), cleanup L81-88/92-99. Dùng bởi FidelityScene và các dialog.
- `ConfirmModal` (`components/common/`) — `.confirm-modal__panel` L83 + `confirm-modal__title` L93, `InkNineSlice` `surface-xl-scroll` + `frame-m-modal` (L90-91), không mount `PcPaperChrome`. `GuestAbandonDialog` (`components/panels/`) — `.abandon-modal__panel` L39, cùng cặp InkNineSlice. `FeedbackDialog` (`components/common/`) — `OverlayPanel variant="paper"` (L363-372) → `.overlay-panel__card` không mang `--system`; `.feedback-dialog` L373; InkNineSlice `surface-xl-scroll`+`frame-m-modal` (OverlayPanel L66-68). `GameButton` — `.game-button` + mount `InkNineSlice v-if="chromeSlot"` L85 + SFX `ui.click`. `Chip` — mount `InkNineSlice` L50, `--chip-active-bg` override được. `QuestCategoryArtButton` — bg `navigation-medallion-v1.png` + icon img 42px.
- `.scrollfade` utility — `theme.css` L541-546: `--scrollfade-color: var(--ink-900)` + `mask-image` fade hai đầu — áp trên `.settings-panel__workspace` (L335), fade mực đậm trên nền giấy sáng.

**`LoginSettingsContent.vue` (51 dòng):** mount `SettingsAudioSection` + `SettingsUiScaleSection` + `SettingsLanguageSection` trong `LoginSideDrawer`; `uiScale` ref riêng + `saveUiScale`/`saveLocale`; `:deep()` dark retheme L28-42 + block UNSCOPED global chip `:is(#app,body) .login-settings-content .chip.chip` L45-51 (bắt buộc vì `tien-hiep-ui.css` L52 pin màu `.chip.chip` ở id-specificity). `LoginSideDrawer` — InkNineSlice `surface-l-drawer`, `container-type:inline-size` trên `__content` (L53), header-button CSS (L50) dead vì template chỉ render h2.

**`pc-paper-production.css` — lớp skin thứ ba, live trong production** (import main.ts L11; nội dung chi tiết ở §4 mục mới): remap font `:root` (L4), reskin `.game-button` toàn cục (L5-14), strip chrome của confirm/abandon/overlay modal (L15-19), reskin `.feedback-dialog` (L52-61), `.pc-paper-scene{pointer-events:auto}` (L21), `.hk-art-scene` box-sizing reset (L67-69), và một block settings hoàn chỉnh nhưng dormant dưới `.pc-settings-content` (L23-49).

## 3. Art map

| Art file | Element dùng | Đường dẫn |
|---|---|---|
| `huyen-kim/scene/character-v2/paper-nine-slice.png` | `.settings-paper` border-image (inline `borderImageSource` L24; slice scoped bị global đè `tien-hiep-ui.css` L177-180) | `SettingsFidelityScene.vue` |
| `tien-hiep-2026-10/controls/navigation-medallion-v1.png` | bg mỗi nút nav section | `QuestCategoryArtButton.vue` L6 |
| `tien-hiep-2026-10/icons/navigation-{settings,realm,feedback,character,production,guild}-v2.png` | icon 6 section (5/6 mượn glyph) | `SettingsNavRail.vue` L17-26 |
| `tien-hiep-2026-10/runtime/slider-track@{1x,2x}.png` | `--hk-slider-track` → range track | `SettingsAudioSection.vue` L28-37/L132-173; `SettingsPanel.vue` L312-321; `LoginSettingsContent.vue` L38-39; manifest L606-612 |
| `tien-hiep-2026-10/runtime/slider-thumb@{1x,2x}.png` | `--hk-slider-thumb` → range thumb | như trên; manifest L626-632 |
| `tien-hiep-2026-10/runtime/section-plaque@{1x,2x}.png` | **KHÔNG wire** — frame vẫn dùng `.art-needed` placeholder | `huyen-kim-chrome.json` L466-484 'ready'; `SettingsSectionFrame.vue` L13 |
| `tien-hiep-2026-10/controls/button-primary-v1.png` → `--pc-primary-button` | `::before` border-image của MỌI `.game-button` (chrome thật production) | `pc-paper-production.css` L6; var inject `PcPaperControls.ts` L12 qua `installTienHiepUiAssets` L26 |
| `tien-hiep-2026-10/controls/button-secondary-v1.png` → `--pc-secondary-button` | `::before` của game-button secondary/danger/ghost + chip trong `.pc-settings-content` (dormant) | `pc-paper-production.css` L9-10, L45; var `PcPaperControls.ts` L13 |
| `tien-hiep-2026-10/controls/inspector-v1.png` → `--pc-inspector-art` | chỉ trong block dormant `__workspace` + `#global-tooltip` L20 | `PcPaperControls.ts` L14 |
| manifest `button-*` slots (`huyen-kim-chrome.json`) | `InkNineSlice` trong `GameButton` L85 — load nhưng **bị `display:none`** bởi `pc-paper-production.css` L12 → không bao giờ hiển thị | `GameButton.vue` L57-85 |
| CSS var `--th-art-title-plaque` (`title-plaque.png`) | `.settings-title` band art — RULE THẮNG (xem §4.2) | `tien-hiep-ui.css` L99-103; var inject `TienHiepUiAssets.ts` L10 |
| CSS var `--th-art-paper-surface` | `.settings-paper::before` tile | `tien-hiep-ui.css` L278-280, inset L345-347 |
| CSS var `--th-art-world-vista` | paper background dưới border-image (all-papers rule) | `tien-hiep-ui.css` L177-180 |
| `InkNineSlice` skins `surface-xl-scroll`, `frame-m-modal` | ConfirmModal ×2, GuestAbandonDialog, FeedbackDialog (qua OverlayPanel paper) | `SettingsPanel.vue` L384-414; `OverlayPanel.vue` L66-68 |
| `InkNineSlice` `surface-l-drawer` | LoginSideDrawer (settings pre-login) | `LoginSideDrawer.vue` |
| `InkNineSlice` `surface-m-panel`+`frame-m-modal` trong `.chip` | chip chrome — bị `display:none` trong `.pc-settings-content` (dead) + `.feedback-dialog` (live) | `Chip.vue` L50; `pc-paper-production.css` L47, L61 |
| `symbols/{id}.svg` | icon rail preview | `ui-preview/paperNavigation.ts` |
| `source/shared-paper-page-v1.png` | preview-only paper | ui-preview |
| Font 'PC Paper Serif' (`source-serif-4/*.ttf`) | `--pc-font-body/--pc-font-title` ở `:root` → remap `--font-display/--font-body/--hk-font-display/--hk-font-ui` TOÀN CỤC | `pc-paper-type.css` L1-18; `pc-paper-production.css` L4 |

## 4. Conflicts / layers

1. **`.settings-paper` geometry duel (đã sửa mô tả)** — scoped `left:94px; top:123px; width:1334px; height:633px; border-image-slice:300 fill; border-image-width:83px; filter:drop-shadow` (`SettingsFidelityScene.vue` L49) vs global `left:156px; width:1272px; border-image-width:52px` (`tien-hiep-ui.css` L25-26, spec (1,2,0)) + `border-image-slice:240 320` + `background: gradient+vista` (L177-180, spec (1,1,0)). Global đè `left/width/border-image-width/border-image-slice` — keyword `fill` rơi → tâm nine-slice trong suốt lộ `::before` tile + background vista. Scoped `top:123px`, `height:633px`, `filter`, `position`, `border:0 solid transparent` VẪN SỐNG (không rule global nào đụng) — không phải "toàn bộ rect chết".
2. **`.settings-title` — cascade 4 lớp, kết quả thật là plaque band (đã sửa hoàn toàn)** — L99-103 `:is(#app,body) .settings-scene .settings-title` spec (1,2,0) CAO NHẤT → mọi property nó khai THẮNG: `left:192;top:97;width:370;height:58;padding:11px 40px;font-size:30px;color:#f3e0b5;background:var(--th-art-title-plaque);z-index:6`. L135-145 `:is(#app,body) .settings-title` spec (1,1,0) chỉ còn hiệu lực ở property L99 không khai: `font-family:UTM OngDoGia`, `font-weight:400`, `font-style`, `animation:th-title-shine` (inert — plaque bg-size 100% nên `background-position` không lộ). Cả `color:transparent` lẫn `background-clip:text` của L135 đều THUA (color bị #f3e0b5 đè; `background` shorthand của L99 reset `background-clip` về border-box ở spec cao hơn). L358-361 flat rule spec (1,1,0) — CHẾT toàn phần cho settings (và 5 title class còn lại trong selector). Scoped L50 chỉ sót `position:absolute`, `margin:0`, `text-shadow`. ⇒ Visual: title plaque band chuẩn design ở 192/97 — KHÔNG phẳng, KHÔNG clip-shine; report gốc đọc nhầm rule thua (L358) thành rule thắng.
3. **`@click.self` backdrop-dismiss chết** — global L390-411 set `pointer-events:none` trên `.settings-scene` + `auto` trên children → click rơi vào void không bao giờ tới scene root; dismiss thực tế do handler empty-space của `DongFuStage` (comment CSS L381-389) + Escape qua `useDialogFocus`. Scoped `pointer-events:auto` + `@click.self` là dead code.
4. **`.settings-panel__actions` layout**: scoped `flex-direction:column; width:100%` trong `SettingsSaveSection` (và Account/Update) bị global `display:grid; grid-template-columns:repeat(2,minmax(0,1fr))` + `.settings-panel__danger` span (`tien-hiep-ui.css` L244-246) đè — mọi section dưới `.settings-content` render grid 2 cột dù scoped muốn cột dọc.
5. **Slider chrome tính 2 nơi** — `SettingsPanel` root set `has-hk-slider` + `--hk-slider-*` (L312-321/L325) VÀ `SettingsAudioSection` tự tính lại (L28-37/L43-44). Cả hai "hoạt động" cho production (vars kế thừa), nhưng panel-level là redundant — section-level bắt buộc vì drawer login tái dùng section mà không qua panel (comment L24-27 của section giải thích lý do).
6. **Taxonomy fixture vs production** — default slot của `SettingsFidelityScene` (L38) dùng nav `['all','audio','display','storage','support']`; production dùng `['general','display','audio','account','update','support']`. Hai model section khác nhau sống trong cùng component; fixture chỉ xuất hiện khi slot trống (preview). i18n `settingsPreview.*` tồn tại trong `vi.json` L2282-2301 (và `remainingMessages.ts` L15) — production cũng resolve được dù DOM không render.
7. **`pc-paper-production.css` — skin thứ ba live trong production (BỔ SUNG, sót lớn nhất của report gốc)**:
   - **`:root` font remap (L4)**: `--font-display:var(--pc-font-title);--font-body:var(--pc-font-body);--hk-font-display;--hk-font-ui` → 'PC Paper Serif' thay thế mọi consumer của 4 var này trong toàn app, gồm `.settings-scene` font-family (scoped L47), `.settings-layout nav button` (L57), `ConfirmModal`/`GuestAbandonDialog` `--font-body`, mọi `--hk-font-*` consumer. Live, không phải dormant.
   - **`.game-button` reskin toàn cục (L5-14)**: `background:transparent`, `::before` border-image `var(--pc-primary-button)` (L6), `--primary→color:#302718`, secondary/danger/ghost→`#f2e1ba`+`--pc-secondary-button` art, **L12 `.game-button>.ink-nine-slice{display:none}`** ẩn luôn manifest slice `GameButton.vue` L85 mount. Vars resolve vì `installTienHiepUiAssets` set lên `document.documentElement` (main.ts L59 → `TienHiepUiAssets.ts` L26 → `pcPaperControlStyles()` `PcPaperControls.ts` L12-14). ⇒ Mọi GameButton trong SettingsPanel + trong dialog (confirm/unsynced/abandon/feedback) vẽ PC border-image, không phải `button-*` manifest.
   - **Modal strip (L15-19)**: `:is(.overlay-panel__card:not(--system),.confirm-modal__panel,.abandon-modal__panel,...)` → `background:none;border:0;color:#302718;font-family:var(--pc-font-body)` đè scoped chrome của `ConfirmModal` L83/`GuestAbandonDialog` L39/`FeedbackDialog` qua `overlay-panel__card` (variant 'paper', không `--system`). Child rule `>.pc-paper-chrome` (L18) KHÔNG match gì — cả 3 modal dùng `InkNineSlice` không mount `PcPaperChrome` (chỉ `PcPaperDialog` dùng). `confirm-modal__title` cũng bị đổi font (L19).
   - **`.feedback-dialog` reskin (L52-61)**: input/actions/chip + `.chip>.ink-nine-slice{display:none}` (L61) — live trong settings.
   - **Dormant block `.pc-settings-content` (L23-49)**: skin settings hoàn chỉnh thứ ba — panel grid `230px minmax(0,1fr)` (L24), `__nav-seal` border-image + `.is-active` (L26-27), `__nav-glyph` (L28-29), `__workspace` inspector-art (L30), `__section`/`h4`/`__plaque{display:none}` (L31-33), `__warning` (L34), `__actions` grid (L35), `__import` border-image (L36-38), `__audio-row/volume/toggle` (L39-42), chip+ui-scale+language restyle (L43-47), `__hint` (L48), `.pc-settings-root .settings-notice` (L49). Grep toàn `src/`: `pc-settings-content`/`pc-settings-root` **không nơi nào gán** → cả block chết. `__nav-glyph` còn chết hai lần — class không tồn tại trong bất cứ `.vue` nào (rail dùng `<img>` trần trong `QuestCategoryArtButton`).
   - **`.pc-paper-scene{pointer-events:auto}` (L21)** + **`.hk-art-scene` box-sizing reset (L67-69)** — liên quan lớp phủ; `DongFuStage` root mang `hk-art-scene` (L412) nên rule box-sizing live (ngoài scope settings nhưng cùng file).
   - `@import` chain: `pc-paper-production.css` L1 → `pc-paper-scene.css` (toàn bộ `.pc-paper-*` grammar, hầu hết dormant ở prod vì chỉ `PcPaperScene`/`PcPaperDialog`/preview mount class này) → `pc-paper-type.css` (`@font-face` + `:root --pc-font-*` L15-18).
8. **`th-outcome-surface` dormant hai lần (đã sửa)** — `tien-hiep-outcomes.css` L39-44 reskin `.settings-scene.th-outcome-surface` (`.settings-panel`, `__nav`, `__nav-seal`, `__workspace`, `.settings-layout`); class `th-outcome-surface` không được gán ở đâu trong `src/` VÀ file không được import bởi `main.ts` lẫn bất cứ `@import`/entry preview nào → cả file không vào bundle, block settings chết hai lần.
9. **Icon mượn** — `SECTION_ICON` map (`SettingsNavRail` L17-24): 5/6 icon là glyph của domain khác (display→realm, audio→feedback, account→character, update→production, support→guild — provisional).
10. **`@container (max-width:760px)` collapse rule** (`SettingsPanel` scoped L441-444) — không ancestor nào trong chuỗi production khai `container-type` → rule chết (FunctionOverlayPanel L238-241 tự ghi nhận cùng vấn đề).
11. **Bốn mock settings UI song song** — `SettingsPreview` (fixture), `HomeSupportArtPanel`, `AuthPreviewSettings`, `AuxiliaryDesignPreview` — mỗi cái một model state riêng; `AuthPreviewSettings` còn trộn mock + section thật.
12. **Ba bộ chọn ngôn ngữ trên màn auth** — `LoginLocaleChips` (trong tab 'auth' của drawer) + `SettingsLanguageSection` (trong tab 'settings' của cùng drawer, qua `LoginSettingsContent`) + cùng section đó trong panel in-game.
13. **`LoginSideDrawer` header-button CSS** — style nút đóng (L50) nhưng template chỉ render h2; đóng bằng scrim/Escape.
14. **`lastSavedLabel` placement** — `.settings-panel__hint` (L380) là sibling sau các section, grid-fall vào cột nav chứ không nằm trong workspace với control save (trong block dormant pc thì có rule `grid-column:2` — `pc-paper-production.css` L48).
15. **Stale comment** — `SettingsSurface.vue` L4 nhắc wiring `usePaperNavigation` không còn tồn tại trong file.

## 5. Logic không có hình ảnh

- **`audio.enabled` / `setEnabled` không có control production** — sliders chỉ `:disabled="!audio.enabled"` (`SettingsAudioSection` L57,77); nếu persisted `enabled=false` thì không đường UI nào bật lại (mock `AuthPreviewSettings.vue` L20 có toggle nhưng preview-only). Key i18n `panels.settings.audio.on/off` tồn tại (`vi.json` L857-858) nhưng không được render.
- **`updates.retryInstall` / `updates.later` / `installFailed`/`candidateVersion`** — expose trong `useUpdates` handle nhưng `SettingsUpdateSection` không wire nút nào cho chúng (chỉ download/cancel/install/check).
- **`usePaperNavigation` composable + `PaperPanelNavigation.vue` + `PcPaperSceneActions.vue`** — production-dead; chỉ preview dùng (`ui-preview/paperNavigation.ts` import `PAPER_NAV_IDS`; navigate/activeId logic đầy đủ nhưng không consumer production).
- **`pendingUpgradeLoginId`/`showAccountUpgrade`** — auto-mở `GuestUpgradeCard` khi có pending upgrade, nhưng cả account block ẩn khi `!remoteAuthoritative` (web/local) → logic dormant trên bản local.
- **`SettingsFidelitySection` control renderer** (range/toggle/select) — logic render cho fixture slot + `remainingPreview.test.ts`; production không bao giờ đi qua.
- **Fidelity props `groups`/`active`/`notice`** — nhận `[]`/`''`/`''` từ `SettingsSurface` → pipeline prop→DOM chết (emits `select/update/action` của default slot cũng không ai nghe).
- **`emit('back')` qua `@click.self`** — dead path (xem §4.3); chỉ Escape còn sống.
- **Beta gate `BETA_LEFT_PANEL_FEATURES.settings=null`** — logic gate tồn tại nhưng trivially true.
- **`logoutDialog='unsynced'`** — cần cloud trả 'unsynced'; trên local build nhánh này unreachable.

## 6. Hình ảnh không có logic

- **Skin settings thứ ba trong `pc-paper-production.css` L23-49** — bộ reskin `.pc-settings-content` hoàn chỉnh (grid, nav-seal border-image, inspector workspace, audio rows, chips) không DOM nào mang class; kèm selector `.settings-panel__nav-glyph` (L28-29) trỏ vào class không tồn tại ở bất cứ `.vue` nào — chết hai lần.
- **`th-outcome-surface` CSS block** — một skin settings vẽ sẵn (`tien-hiep-outcomes.css` L2-4, L39-44) không DOM nào mang class VÀ file không vào bundle (không import).
- **`section-plaque` art ready nhưng không wire** — `huyen-kim-chrome.json` status 'ready' (L466-484), PNG `@1x/2x` tồn tại, nhưng `SettingsSectionFrame.vue` L13 vẫn render `.settings-panel__plaque.art-needed` (radial-gradient + dashed outline, L36-47) trên mọi section header. Block dormant pc còn có `__plaque{display:none}` (L33) — skin kia giấu plaque hẳn.
- **`.settings-notice`** — `<p role=status>` render `notice=''` → element rỗng chiếm chỗ trong chrome (`.pc-settings-root .settings-notice` L49 là biến thể dormant).
- **`.settings-preview`** — DOM gated bởi prop `preview`, false ở prod; label `t('preview')` chỉ resolve qua bundle preview (`remainingMessages` L4) — `vi.json` không có key top-level này.
- **Fixture default-slot DOM** (nav buttons + control rows + `.settings-actions` storage/support) — `SettingsFidelityScene.vue` L38; không render ở prod nhưng ship trong bundle.
- **`button-*` manifest slices trong `GameButton`** — vẫn load qua `hkChromeUrl`+`InkNineSlice` (L85) nhưng `.game-button>.ink-nine-slice{display:none}` (`pc-paper-production.css` L12) giấu toàn bộ → "hình ảnh" người chơi thấy là `::before` border-image PC.
- **Mock controls trong preview panels** — `HomeSupportArtPanel` (toggle/sliders chỉ set `notice`), `AuthPreviewSettings` (enabled toggle trên mock state), `AuxiliaryDesignPreview` settings grid — trông tương tác được nhưng không đụng store.
- **`has-hk-slider` + `--hk-slider-*` trên root `.settings-panel`** — class/vars ở panel root không trực tiếp tô slider nào (chỉ cung cấp vars kế thừa); phần "hình" thật nằm ở chrome section-level.
- **`.login-side-drawer__header button` CSS** — style nút đóng không có element.

## 7. Open questions

1. Nút bật/tắt âm thanh: cố ý lược hay rớt trong reskin? Comment `SettingsAudioSection` L2-3 liệt kê "on/off" trong bộ control dự kiến; state + i18n key đã có.
2. `section-plaque` đã ready — wire vào `SettingsSectionFrame` hay giữ `.art-needed`?
3. Fixture taxonomy `all/storage` trong `SettingsFidelityScene` lệch production `general/account/update` — xóa fixture hay realign? (`settingsPreview.*` trong `vi.json` ship cả production bundle.)
4. `th-outcome-surface` settings block — file không bundle + class không gán: xóa file hay giữ cho variant tương lai?
5. `.pc-settings-content` skin thứ ba (`pc-paper-production.css` L23-49) — reskin được duyệt rồi bỏ dở, hay variant định dùng? `__nav-glyph` selector chỉ tồn tại trong CSS → mock gốc có glyph element chưa port?
6. Icon mượn cho 5/6 section — chờ glyph riêng hay chốt borrow?
7. Backdrop-dismiss `@click.self` chết sau pointer-events fix — cố ý bỏ click-outside để đóng panel?
8. Hai+ bộ chọn ngôn ngữ trên auth (LoginLocaleChips vs drawer settings) — giữ cả?
9. Ownership `.settings-panel__actions`: global 2-col grid vs scoped flex vs dormant pc-grid — chuẩn nào để section mới theo?
10. Panel-level `has-hk-slider`/`sliderChromeStyle` redundant sau khi section tự tính — xóa?
11. `@container` collapse rule — cần khai `container-type` hay xóa rule chết?
12. `:root` font remap (`pc-paper-production.css` L4) — 'PC Paper Serif' toàn cục là ý đồ chốt hay tàn dư port? Settings chrome + dialog đều đang render font này.

## Adjudication

Verify lại từng finding trên clone @ 8ffc8e64, `game/`:

**Missed — chấp nhận 8/8** (kèm hiệu chỉnh nhỏ):

1. **`pc-paper-production.css` sót skin thứ ba — ĐÚNG, chấp nhận.** File import ở `main.ts` L11; dormant block `.pc-settings-content` L23-49 đúng như mô tả; `pc-settings-content`/`pc-settings-root`/`settings-panel__nav-glyph` grep toàn `src/` không có DOM consumer; rules live L5-14/L15-19/L52-61/L21/L67-69 xác nhận đánh vào GameButton/ConfirmModal/GuestAbandonDialog/FeedbackDialog (`.confirm-modal__panel` L83, `.abandon-modal__panel` L39, `.overlay-panel__card` không `--system` vì FeedbackDialog dùng `variant="paper"`, `.feedback-dialog` L373; `PcPaperChrome` chỉ trong `PcPaperDialog`). **Hiệu chỉnh đường inject**: `--pc-*` được `installTienHiepUiAssets(document.documentElement)` (main.ts L59 → `TienHiepUiAssets.ts` L26 → `pcPaperControlStyles()`) set lên `:root` — `PcPaperControls.ts` L12-14 chỉ khai báo, không tự inject. Bổ sung reviewer bỏ sót trong chính file: `:root` font remap L4 live toàn cục.
2. **`tien-hiep-outcomes.css` chết hai lần — ĐÚNG.** Không nằm trong imports `main.ts` L5-11; zero `@import`/entry reference trong toàn repo; `th-outcome-surface` zero match trong `.vue`/`.ts`.
3. **`remainingPreview.test.ts` consumer — ĐÚNG** (import `SettingsFidelitySection` L9-10, mount trong test L41-44).
4. **`usePaperNavigation` thiếu chi tiết — ĐÚNG.** `LEFT_PANEL_NAV_ID` L78-84 (settings→settings L83); `NAV_LABEL_KEY` thực tế L61-73 (report gốc ghi nhầm L83); `items`/`navigate`/`activeId` L92-142.
5. **Listener `useDialogFocus` — ĐÚNG, hiệu chỉnh**: keydown gắn trên card element (L65), `document` `mousedown` L73-79 — không phải cả hai trên document. `SceneDesignCanvas` ResizeObserver L21 xác nhận. Không có `setInterval` trong scope.
6. **`.scrollfade` nguồn `theme.css` L541-546 — ĐÚNG** (`--scrollfade-color: var(--ink-900)` + mask fade).
7. **Bundle `settingsMessages` — ĐÚNG, kèm nuance**: `ui-preview/settings.ts` L5 import `settingsMessages`; `settingsPreview.*` ở `remainingMessages.ts` L15 khớp taxonomy fixture; `vi.json` L2282-2301 CŨNG chứa `settingsPreview.*` → production resolve được (dù DOM không render); chỉ `t('preview')` (SettingsFidelityScene L41) thuần preview — `vi.json` không có key top-level `preview`.
8. **Entry pre-login `opening-settings-button` — ĐÚNG** (`LoginOpening.vue` ~L17 `data-testid="opening-settings-button"` → `emit('settings')`).

**Wrong — chấp nhận 6/6** (một cái chấp nhận có mở rộng):

1. **Sai path `AuthEntryScreen.vue` — ĐÚNG.** File thực ở `components/onboarding/`; nội dung cite (drawer settings, LoginSettingsContent) khớp.
2. **Sai path `SettingsFidelitySection.vue` — ĐÚNG.** File thực ở `components/scenes/settings/fidelity/` — là cây component production, không phải `ui-preview/`.
3. **§4.2 sai cơ chế `.settings-title` — ĐÚNG về specificity, nhưng reviewer cũng sai một nửa kết quả.** L99-103 spec (1,2,0) thắng toàn bộ property nó khai — vị trí/size/màu thật là 192/97, 370×58, 30px, #f3e0b5 (không phải 207/151, 35px, #30210f của L358); L358 chết. NHƯNG kết luận "không plaque band" của cả report lẫn reviewer đều sai: `background` shorthand của L99 reset `background-clip` về border-box ở spec (1,2,0) → `background-clip:text` của L135 không áp dụng; `color:transparent` cũng thua #f3e0b5. ⇒ Plaque art + chữ sáng opaque render bình thường — đúng design plaque band. Đã viết lại §4.2.
4. **§4.1 quá tay "toàn bộ rect/slice chết" — ĐÚNG.** `top:123px`, `height:633px`, `filter:drop-shadow`, `position`, `border` scoped sống; chỉ `left/width/border-image-width/slice` bị đè.
5. **Art map GameButton gây hiểu nhầm — ĐÚNG.** `.game-button>.ink-nine-slice{display:none}` (`pc-paper-production.css` L12) giấu manifest slice; chrome nhìn thấy là `::before` border-image `button-primary/secondary-v1.png` (vars `:root` qua `installTienHiepUiAssets`).
6. **Line drift — ĐÚNG.** SettingsPanel `<style scoped>` mở L418 (CSS L418-449/450); `NAV_ITEMS` `'settings'` ở L207; `openLeftPanel` L226-228+.
