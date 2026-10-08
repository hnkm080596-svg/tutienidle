# Skeptical review — audit Luyện Thể (body)

Verified on `devin/artui-c0-foundation` @ 8ffc8e64, `game/`. Directory thật của `src/components/scenes/body/fidelity/` chỉ có 4 file: `BodyFidelityScene.vue`, `BodyPaperDetails.vue`, `BodyPaperFigure.vue`, `bodyUi.ts`.

## Missed

**Files trong scope report không hề nhắc:**
- `src/components/scenes/body/useBodySceneModel.ts` (465 dòng) — toàn bộ logic layer thật: `buildRefinementUnits` :78-143, `buildMeridianUnits` :145-232, `buildZhouTianUnits` :234-319 (gates/costs/canInvest/progress), milestone chips Tieu/Dai :382-395, `chapterLockHint` :413-429, `investActive` → `gameManager.realmAdvanceOps.investBodyChapter` :453-462 + `bumpState`.
- `src/components/scenes/body/bodySceneModel.ts` — view types (`BodyUnitView.status` 6 trạng thái gồm `realm_locked`/`complete`, :7-13).
- `src/components/scenes/body/fidelity/bodyUi.ts` — contract `BodyPaperModel/Unit/Chapter/Milestone/Extra/Cost`.
- `src/components/common/SceneDesignCanvas.vue` — overlay canvas 1440x810 scale + `pointer-events:none` trên viewport/canvas (:29-43) — nền của cơ chế click-through report bàn ở 4(d) nhưng không nhắc; mount tại BodySurface.vue:221. `ResizeObserver` live :20-22.
- `src/components/common/art/EquipmentEnergyTube.vue` — progress tube + animation `equipment-energy-flow` (:29-44), dùng tại BodyPaperDetails.vue:32.
- `src/ui-preview/bodyPreviewMessages.ts` — mock locale THỨ HAI dùng bởi `landscape-design.ts:12,19` (report chỉ kể `bodyMessages.ts` của standalone preview).

**Global CSS đè panel bỏ sót:**
- `tien-hiep-ui.css:134` `.body-heading {left:289px;top:97px;width:370px;max-width:none}` — lý do `style="width:auto"` inline ở BodyFidelityScene.vue:41; left/top trơ vì position static.
- Parchment landmine lớn hơn report nói: `.body-paper` còn bị css:25, :177/:253, :254-256/:278/:344 (`::before` gradient+vista, `::after` border-image) — `.body-panel` (:37) đổi tên thành `.body-paper` là hồi sinh cả cụm chrome.

**Art có logic không được map:**
- `body/process-{bi,nhuc,cot,huyet,tang,mach}-{lit,unlit}-v1.png` ×12 — `.body-chip-art` (BodyPaperFigure.vue:34-35,161).
- `body/galaxy-{core,orbit-circle,orbit-ellipse,stars}-{lit,unlit}-v1.png` ×8 — Chu Thiên figure (:88-95,143-154); lit theo `model.progress` (:96-97).
- `controls/equipment-divider-v1.png` — header production (:23,41), report chỉ gán mock :88.
- `navigation-{ren,khai,dan}-lit-v1.png` — `navIcon` card title (BodyPaperDetails.vue:15-16,22).
- `meridian-tube-lit-v1.png` — `.family-spine` xoay 90° (BodyFidelityScene.vue:44,79).
- `/assets/pills/khai_linh_dan.png` — cost icon Bát Mạch thật (pills.ts:86 → useBodySceneModel.ts:218-222); refinement/Chu Thiên cost không icon → `img v-if` không render (BodyPaperDetails.vue:42).
- `body/` pack CỐ TÌNH không warm — AssetBundleCatalog.ts:571-578 comment.

**Logic không hình ảnh bỏ sót:** `BodyChipView.hint` dead data (bodySceneModel.ts:35; không render — chips chỉ label+state, BodyPaperFigure.vue:162); `.body-gate` gate lines (BodyPaperDetails.vue:48); `.body-notice` aria-live + `noticeTimer` 3.2s (BodySurface.vue:41-47,215-217); `.body-milestone` Tieu/Dai (:164-165); `.unmet` cost đỏ (:41,83); `.body-caption` (:167); `preview` prop + `.body-preview-label` (FidelityScene.vue:15,62,85); `visibleMeridianNodes` ẨN node locked (:66-68) + `.meridian-flow` (:133,197); `mountedStandalone` keep-mounted (GameRoot.vue:77,96); `?locked` flag + `DongFuVista` + parallax `--df-x/y` + `back()` (BodyPreview.vue:14-16,62-64); `.pc-progression`-scoped dormant hooks `tien-hiep-progression.css:21-36` (`--meridian`/`--cycle` modifiers không tồn tại trong DOM → dead kép); `getQuanTheMechanic` progress `.body-extra__bar` (BodyPaperDetails.vue:52-55).

## Wrong

- **Component bịa**: `BodyChapterSeals.vue`/`BodyUnitRail.vue` không tồn tại (không có trong git history). Chapter nav = `EquipmentArtButton.family-pill` (BodyFidelityScene.vue:45-56); unit rail inline (BodyPaperFigure.vue:157-166).
- **Props contract bịa**: nhận `model`/`unit`/`notice`/`preview`, emits `back/chapter/select/invest` (:11-17; BodySurface.vue:222-231) — không phải `initialChapter/initialUnit/state/dispatch`.
- **Store/computed bịa**: `useBodyProgressionStore`, `chapterStates`, `unitRows`, `visibleUnits`, `MERIDIAN_VESSELS`, `ZHOU_TIAN_STEPS` đều không tồn tại (thật: `MERIDIANS` :32, `ZHOU_TIAN_*` :39-46; stores = `useUiStore`/`usePlayerStore`/`useStateVersion`/`useBodySceneModel`).
- **`dispatch('body.investRefinement')` sai** — `model.investActive` → `realmAdvanceOps.investBodyChapter` (useBodySceneModel.ts:453-462).
- **`.body-extra` ngược điều kiện**: render khi `discovered && !frozen` (BodySurface.vue:144-146,155-156); test chứng minh frozen → null (BodySurface.test.ts:273-281).
- **"production không vẽ galaxy orbs" sai**: cycle chapter render galaxy (BodyPaperFigure.vue:143-154); mock cùng id core/orbit (HomeBodyArtPanel.vue:74-81) — dust/arc/ribbon/spiral không ai dùng.
- **`controls/resource-${id}-v1.png` không dùng** — icon thật `/assets/pills/khai_linh_dan.png` (pills.ts:86).
- **`th-panel-swap` không keyed chapter**: mount-level BodyPanel.vue:14 (css:373-378); chapter flip không transition — `.body-page-*` chỉ trong file css chết.
- **`useDialogFocus` sai file**: BodyFidelityScene.vue:33, không phải BodySurface.
- **Gate locked "trong store" sai**: UI-side `selectChapter` từ chối (BodySurface.vue:203-211).
- **BodyPaperDetails props bịa**: `{model,unit,notice}` (:9); không có `stored/investReady/investHint/physique` hay `gainRows/costRows/stateLabel`; CTA `v-if="unit.actionLabel"` + `:disabled="unit.actionDisabled"` (:58).
- **`shared-paper-page` sai element**: `.body-panel` (:37) chứ không phải `.body-paper-scene`.
- **`closeSidePanels` cite lệch**: GameRoot.vue:130-131 + :138 (report :110-114).
- **`equipment-level-seal-v1` không phải chrome body**: `squareArt` không dùng.
- **`character-card-nine-slice-v2` tag "(runtime)" sai**: `controls/` PNG qua `equipmentArt()` (equipmentArt.ts:5-8; EquipmentArtCard.vue:3,23-24).
- **`tien-hiep-progression.css` mô tả sai**: đúng là dead (0 import) và có `.body-page-enter/leave` (:76-78), nhưng nội dung là `.pc-progression`-scoped restyles chứ không phải "layout body cũ".

## Verified-ok

- Mount chain: DongFuStage :205/:230/:258-264; ui.ts :151/:252-264/:324-330/:55-58; GameRoot :23/:77/:96/:116/:130-138/:174; BodyPanel :8/:14.
- `.body-invest` dual-chrome css:237-238 (1,1,0 > scoped 0,2,0); disabled override :238 vs :52.
- h1 72px shine thắng scoped (css:135-148 vs :74); `.body-heading p` padding css:150 → `.body-subtitle`.
- pointer-events :394/:405 → `@click.self` dead, click-through đóng panel; Escape sống.
- Dormant: `.body-title` :99/:358, `.body-paper` :133, `.body-info-frame` :233/:264-269.
- `tien-hiep-progression.css` 0 import — dead file.
- RealmPanel 0 refs. Preview path đúng (body.ts→BodyPreview+bodyMessages; previewRoutes:2; HomeBodyArtPanel 750 dòng).
- Unused art đúng list: galaxy-dust/orbit-arc/ribbon/spiral, meridian-junction/ring, silhouette-upper.
- AUTH-2 contract + test pins; locale đầy đủ; physique.grades=10; paperNav.body.
- `paper-surface` declared AssetBundleCatalog:598 + TienHiepUiAssets:16; atlas+cutout → generator build-tien-hiep-ui.mjs:~37-46.