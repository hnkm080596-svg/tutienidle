# Panel: Luyện Thể (body)

Audit read-only trên `devin/artui-c0-foundation` @ 8ffc8e64, thư mục `game/`. Bản ở giữa đợt reskin "Huyền Kim scene 08" — production đã chuyển sang fidelity surface trong `src/components/scenes/body/fidelity/`; art cũ dạng parchment-scroll (`th-art-*`) ngưng dùng nhưng các rule CSS global vẫn tồn tại trong `src/assets/tien-hiep-ui.css` (import sống tại `src/main.ts:8`).

## 1. Mount chain — từ nav/route đến component gốc

- **Nav trigger**: `src/components/scenes/dong-fu/DongFuStage.vue:205` khai báo `'body'` trong `NAV_ITEMS`; `:230` `NAV_TARGET.body = () => ui.openStandalonePanel('body')`; `:258-264` `NAV_ACTIVE_STANDALONE` gắn icon `body` → panel `body`.
- **Store**: `src/stores/ui.ts:151` `standalonePanel` state; `:243-255` `openStandalonePanel` (guard `isBetaStandalonePanel` :248; `body: null` trong `BETA_STANDALONE_PANEL_FEATURES` — `betaScopeSurface.ts:143` — luôn được phép mở); `:258-263` `closeHomeOverlays()` null standalonePanel; `:320-331` `toggleStandalonePanel`. Comment `:55-58` xác nhận `'body'` là standalone panel canonical.
- **Mount**: `src/components/layout/GameRoot.vue:23` `defineAsyncComponent` import `../panels/BodyPanel.vue`; `:174` `<BodyPanel v-if="mountedStandalone.has('body')" />`; `:77/:96` `mountedStandalone` — panel mount 1 lần rồi giữ mounted cả session; `:116` idle-preload chunk. Click nền → `<MainScene @click="closeSidePanels">` (:138) → `ui.closeHomeOverlays()` (:130-131).
- **Panel gốc**: `src/components/panels/BodyPanel.vue` — wrapper 15 dòng: `<Transition name="th-panel-swap"><BodySurface v-if="ui.standalonePanel === 'body'" /></Transition>` (:14). Transition ở **mount-level**, không keyed theo chương.
- **Adapter**: `src/components/scenes/body/BodySurface.vue` — mount `<SceneDesignCanvas overlay>` (:221) bọc `BodyFidelityScene` với props `model`/`unit`/`notice` + emits `chapter`/`select`/`invest`/`back` (`@back="ui.closeHomeOverlays()"` :230).
- **Scene fidelity** (`src/components/scenes/body/fidelity/` — đúng 4 file): `BodyFidelityScene.vue` (shell + chapter pills), `BodyPaperFigure.vue` (figure art + unit rail), `BodyPaperDetails.vue` (thẻ chi tiết + CTA), `bodyUi.ts` (contract types). Chapter nav = `EquipmentArtButton.family-pill` (BodyFidelityScene:45-56) — **không tồn tại** `BodyChapterSeals.vue`/`BodyUnitRail.vue`.
- **Shared chrome**: `SceneDesignCanvas.vue` (1440x810 scaled canvas, `ResizeObserver` :20-22, overlay `pointer-events:none` :41-43), `EquipmentArtButton.vue`, `EquipmentArtCard.vue`, `EquipmentEnergyTube.vue` — tất cả trong `src/components/common/`.
- **Model layer**: `src/components/scenes/body/useBodySceneModel.ts` (465 dòng) + `bodySceneModel.ts` (view types) — toàn bộ logic đọc canonical chapters.
- **Preview paths song song**: `legacy/ui-body.html` → `src/ui-preview/body.ts` → `BodyPreview.vue` (dùng `bodyMessages.ts` + mount sẵn `BodyFidelityScene` production với mock model + `preview` prop); `ui-landscape-design.html` → `landscape-design.ts` → `LandscapeDesignPreview.vue:66` → `HomeBodyArtPanel.vue` (750 dòng, mock hoàn chỉnh riêng, dùng locale thứ hai `bodyPreviewMessages.ts` namespace `bp.*`).
- `RealmPanel`/`scenes/realm/` rút sạch body — grep `body|meridian|refinement` = 0 kết quả.

## 2. UI logic inventory — computed/store-read/emit/directive/props feed DOM

**BodySurface.vue** (adapter — 233 dòng):
- Stores/composables: `useUiStore()`, `usePlayerStore()`, `useStateVersion()`, `useBodySceneModel()`. Không có `useBodyProgressionStore`.
- Computed: `chapters` (map `model.chapters` → `BodyPaperChapter`, label qua `BODY_CHAPTER_LABEL_KEYS`, hint qua `bodyChapterSubtitleKey`); `pickedChapter`/`activeUiChapter`/`activeDomainChapter` (default = first unlocked incomplete :69-80); `activeModel`; `viewedUnit`; `units` (map `toUiUnit`); `milestones` (chips `milestone_*` :133-137); `extra` (AUTH-2 :141-170); `identity` (physique line cho refinement, subtitle cho chương khác :174-181); `paperModel`; `paperUnit`.
- `unitState()` :85-96 — gấp 6 status domain (`done/active/next/locked/realm_locked/complete`) xuống 3 state UI (`done/current/locked`); `realm_locked` → `locked`.
- `toUiUnit()` :98-127 — cost `amountLabel` hiển thị "Đã Đạt" khi `need===0`; `actionLabel` từ `bodyChapterCtaKey`; `actionDisabled: !unit.canInvest`.
- Functions: `selectChapter` **từ chối ở UI-side** khi `!chapter.unlocked` (:203-211 — không phải gate trong store); `selectUnit` → `model.selectUnit`; `invest()` → `model.investActive` → flash `.body-notice` qua `flashNotice` (timer 3.2s :41-47).
- `extra` :141-170 — render `.body-extra` **chỉ khi `record.discovered === true && record.frozen !== true`** (mortal → `hidden.mortal.*`; qi_refining → `hidden.qi.*` + `getQuanTheMechanic` progress/max). Record `frozen` hoặc chưa discover → `null`.

**useBodySceneModel.ts** (465 dòng — logic layer thật):
- `buildRefinementUnits` :78-143 — 6 tiers `BODY_REFINEMENT_TIERS`; status `done|active|realm_locked|locked`; gate `panels.realm.bodyRefinement.tierLock` khi realm_locked; cost = `TINH_HOA_PHAM_THE_MATERIAL_ID` (không icon); `canInvest = active && have > 0`; **filter `status !== 'locked'` :142** — tier chưa tới bị ẩn hẳn khỏi rail.
- `buildMeridianUnits` :145-232 — 8 `MERIDIANS` (data `src/data/realm/Meridians.ts`, `THONG_MACH_DAN_MATERIAL_ID = 'thong_mach_dan'` :11); page-gate theo `pageRealmId` (`panels.realm.meridian.pageLocked`); gates `realmGate`/`seqGate`; cost = Thông Mạch Đan **có icon** `pill.icon` (:218-222); `canInvest = pageUnlocked && seqUnlocked && next && owned >= cost && paced`; cùng filter `status !== 'locked'` :231.
- `buildZhouTianUnits` :234-319 — 1 unit `zhou_tian_next`; status `complete|locked|realm_locked|active`; `locked` → trả `[]` (:273-275); cost = `ZHOU_TIAN_CURRENCY_MATERIAL_ID` (không icon); `canInvest = active && owned >= need && need > 0`.
- Milestone chips `milestone_tieu`/`milestone_dai` push vào chips của Chu Thiên :382-395 (`isTieuChuThienReached`/`isDaiChuThienReached`).
- `chapterLockHint` :413-429 — chapter có `units.length === 0` → gate line thật (`meridian.pageLocked`/`zhouTian.locked`/`body.empty`) gán `model.lockHint`.
- `selectedUnitId` per-chapter :433-437; `viewedUnit` ưu tiên picked → actionable → first (:443-447); `investActive` → `gameManager.realmAdvanceOps.investBodyChapter` + `bumpState()` (:453-462).
- Exports `BODY_CHAPTER_LABEL_KEYS` (:327-331), `bodyChapterSubtitleKey`, `bodyChapterCtaKey` (CTA keys: `panels.body.actions.investRefinement`/`panels.realm.meridian.invest`/`panels.realm.zhouTian.invest` :339-343).

**bodySceneModel.ts** (53 dòng): `BodyUnitStatus` 6 trạng thái :7-13; `BodyGainView`/`BodyCostView` (có `icon?`)/`BodyChipView` (`hint` :35 — **dead data**, chips chỉ render label+state)/`BodyUnitView` (gates, actionable, canInvest, progress).

**bodyUi.ts** (73 dòng): `BodyPaperModel`/`BodyPaperUnit`/`BodyPaperChapter`/`BodyPaperMilestone`/`BodyPaperExtra`/`BodyPaperCost` — contract giữa adapter và scene; `BodyPaperUnit.state` chỉ 3 trạng thái; `actionLabel`/`actionDisabled` resolved sẵn.

**BodyFidelityScene.vue** (86 dòng):
- Props `{ model, unit, notice, preview?: false }` (:11-16); emits `{ back, chapter, select, invest }` (:17).
- `useDialogFocus(rootRef, () => true, { onEscape: () => emit('back') })` (:33) — focus-trap + Escape.
- `.body-paper-scene` root `@click.self="emit('back')"` (:36); `.body-panel` mang `shared-paper-page` background (:37).
- Chapter pills: `EquipmentArtButton.family-pill` per `model.chapters`, `:class="{ 'is-locked': !chapter.unlocked }"` (:49), `:gold` + `:aria-pressed` theo chapter active; icon `navArt(chapter.id, lit)` (:54); `.family-spine` xoay 90° (:44).
- `preview` prop → `<p class="body-preview-label">{{ t('body.preview') }}</p>` (:62).

**BodyPaperFigure.vue** (216 dòng):
- Props `{ model, selected }`; emit `select`.
- `unitState` map :14-18; `unitLit` :19; `REFINEMENT_LAYER` :23-30 (6 tiers → skin/muscle/vertebra/blood/heart/forehead); `litLayer` :31-32; `processArt` :34-35.
- Meridian: `MERIDIAN_POINTS` 8 điểm (:39-48) + `MERIDIAN_EDGES` (:49-57); `meridianNodes` lit khi done/current (:58-63); **`visibleMeridianNodes` filter `state !== 'locked'`** (:66-68) + `visibleMeridianEdges` (:69-72); `meridianLineStyle` xoay ống theo cạnh.
- Chu Thiên: `GALAXY` 6 mảnh core/orbit (:88-95); `galaxyLit = round(progress/100 * 6)` (:96); `starsLit` khi `progress > 70` (:97).
- Unit rail inline (:157-166): `.body-unit-chip` per unit (img `.body-chip-art` + label + `t('body.state.'+state)`); `.body-milestone` chips (:164-165); `.body-caption` label join + progressLabel (:102,:167).

**BodyPaperDetails.vue** (96 dòng):
- Props `{ model, unit, notice }` (:9); emit `invest`.
- `navIcon` = `navigation-{ren|khai|dan}-lit` theo chapter (:14-17) trong `.body-card-title`.
- Rows: `.body-stat-list` dt/dd per `unit.rows`; `.body-materials` per `unit.costs` (`img v-if="cost.icon"`, `.unmet` khi `!cost.met`); `.body-gate` per `unit.gates`; `EquipmentEnergyTube :fill="unit.progressPct ?? model.progress"` (:32).
- `.body-extra` block (:49-56): head title+stateLabel, description, `__bar` progress khi `progressMax`, `__count`.
- CTA: `EquipmentArtButton v-if="unit.actionLabel" gold class="body-invest" :disabled="unit.actionDisabled"` (:58).
- `.body-notice` aria-live (:63); fallback `model.lockHint ?? t('body.empty')` khi `unit === null` (:61).

**Locale**: toàn bộ key dùng (`body.*`, `panels.body.*`, `panels.realm.bodyRefinement|meridian|zhouTian.*`, `panels.realm.physique.*`, `hidden.mortal.*`, `hidden.qi.*`, `paperNav.body`) có trong `src/locales/vi.json` — verify script: 0 key thiếu; `physique.grades` đủ 10 cấp (pham→tien).

## 3. Art map — file art → element

Pack `public/assets/ui/tien-hiep-2026-10/` (resolve qua `resolveAssetUrl`/`equipmentArt()`):

| Art file | Element | Nơi |
|---|---|---|
| `source/shared-paper-page-v1.png` | nền `.body-panel` | BodyFidelityScene.vue:21,37 |
| `controls/equipment-divider-v1.png` | divider cạnh h1 | BodyFidelityScene.vue:23,41 (và mock HomeBodyArtPanel:88) |
| `body/navigation-{ren,khai,dan}-{lit,unlit}-v1.png` | icon con dấu chương (lit = active) | BodyFidelityScene.vue:28-30,54 |
| `body/navigation-{ren,khai,dan}-lit-v1.png` | icon `.body-card-title` | BodyPaperDetails.vue:15-16,22 |
| `body/meridian-tube-lit-v1.png` | `.family-spine` dọc (rotate 90°) | BodyFidelityScene.vue:44,79 |
| `body/silhouette-seated-v1.png` | figure nền + skin layer | BodyPaperFigure.vue:107,111 |
| `body/biceps-{left,right}-{lit,unlit}-v1.png` | lớp bắp tay | BodyPaperFigure.vue:113-114 |
| `body/anatomy-{blood,vertebra,heart}-{lit,unlit}-v1.png` | lớp huyết/sống/tim | BodyPaperFigure.vue:116,119,121 |
| `body/forehead-{ring,node}-{lit,unlit}-v1.png` | trán + 3 node | BodyPaperFigure.vue:122-127 |
| `body/meridian-{tube,node}-{lit,unlit}-v1.png` | ống mạch + node orb | BodyPaperFigure.vue:132,140 |
| `body/process-{bi,nhuc,cot,huyet,tang,mach}-{lit,unlit}-v1.png` ×12 | `.body-chip-art` trên chip | BodyPaperFigure.vue:34-35,161 |
| `body/galaxy-{core,orbit-circle,orbit-ellipse,stars}-{lit,unlit}-v1.png` ×8 | Chu Thiên figure; lit theo `model.progress`/`starsLit` | BodyPaperFigure.vue:88-97,143-154 |
| `controls/equipment-filter-{normal,hover,pressed,selected}-v2.png` | chrome `::before` `.equipment-art-button` (gold → selected) | EquipmentArtButton.vue:33,38,41,44,49 |
| `controls/character-card-nine-slice-v2.png` | border-image `::before` `.equipment-art-card` | EquipmentArtCard.vue:3,23-24 qua `equipmentArt()` (controls root, không phải runtime) |
| `runtime/button-primary.png` (`--th-art-button-primary`) | background **đè** `.body-invest` | tien-hiep-ui.css:237 |
| CSS gradient + `th-title-shine` | title h1 72px vàng background-clip | tien-hiep-ui.css:135-146 |
| `/assets/pills/khai_linh_dan.png` | icon cost Thông Mạch Đan (Bát Mạch) | pills.ts:86 → useBodySceneModel.ts:218-222 → `cost.icon` |

## 4. Conflicts / layers — 2 phiên bản UI cùng tồn tại

**(a) `.body-invest` dual-chrome — nặng nhất.** `tien-hiep-ui.css:237` `:is(#app,body) :is(…,.body-invest,…)` (specificity 1,1,0 > scoped 0,2,0) đặt `background: var(--th-art-button-primary) center/100% 100%; padding:10px 22px; color:#352713; border-radius:0` — đè `background:transparent` của `EquipmentArtButton.vue:23` và `padding:0` của `.body-invest` scoped (BodyPaperDetails:94). Kết quả nút Tu Luyện render **chồng 2 lớp chrome**: art `button-primary` cũ dưới + `equipment-filter-selected-v2` trong `::before` trên (filter PNG có alpha → lớp cũ lộ qua viền). Disabled: global `:238` `grayscale(.8);opacity:.65` thắng scoped `opacity:.45` (:52). `width:100%;height:44px` scoped vẫn sống (global không đặt). Lưu ý `.family-pill` **không** nằm trong selector :237 → pill chương không bị dual-chrome.

**(b) `.body-heading h1` scoped chết.** Global `css:135-145` (1,1,1): `width:370px;height:58px;font-size:72px;font-weight:400;color:transparent;background-clip:text;animation:th-title-shine;text-align:center`. Scoped `font-size:30px;font-weight:700;color:#35250f` (0,2,1) thua toàn bộ — chỉ inline `width:auto;text-align:left` + scoped `text-shadow` còn hiệu lực. Comment :70-72 tự thừa nhận "inherits the global 72px calligraphy treatment" → scoped rules là dead code; title render 72px vàng lấp lánh trong box 58px.

**(c) `.body-heading` + `.body-subtitle` kéo theo.** `css:134` `.body-heading{left:289px;top:97px;width:370px;max-width:none}` — left/top trơ vì element position static, nhưng `width:370px` áp → buộc inline `style="width:auto"` (:41). `css:150` `.body-heading p{padding:23px 40px 0}` (1,1,1) áp `.body-subtitle` → padding thừa so với layout margin-only (scoped :76).

**(d) `.body-paper-scene` pointer-events → `@click.self` dead.** `css:394` `:is(#app,body) .body-paper-scene{pointer-events:none}` (1,1,0) thắng scoped `.body-scene{pointer-events:auto}` (0,2,0) → root không bao giờ nhận click → `@click.self="emit('back')"` (:36) là **dead handler**. Đây là *cố ý* — comment css:381-389: scene root trong suốt click để rail nav bấm được; click nền xuyên qua `SceneDesignCanvas` overlay (`pointer-events:none` :41-43) xuống `MainScene @click` → `closeSidePanels` đóng panel — cùng kết quả dismiss. `> * { pointer-events:auto }` (:405-411) giữ tương tác trong `.body-panel`. Escape qua `useDialogFocus` vẫn sống.

**(e) Transition: `th-panel-swap` chỉ ở mount-level.** BodyPanel.vue:14 wrap `BodySurface v-if` — mở/đóng panel có transition (css:373-378); **đổi chương không có transition nào** (không `Transition`/`body-page-*` trong production).

**(f) CSS legacy dormant landmines:**
- `css:25` `.body-scene .body-paper` (position/size parchment gốc), `css:133` `.body-paper-scene .body-paper{left:156px;width:1272px;border-image-width:52px}`, `css:177` `:is(…,.body-paper,…)`, `css:253-256`/`278`/`344` (`::before` gradient+vista, `::after` border-image) — element hiện tại tên `.body-panel` (FidelityScene:37); đổi tên sang `.body-paper` là hồi sinh nguyên cụm parchment chrome.
- `css:99` `.body-scene .body-title` + `css:358` `:is(…,.body-title)` — không element mang `.body-title`.
- `css:233`/`264-269` `.body-info-frame` — frame chi tiết cũ, dormant hoàn toàn.
- `src/assets/tien-hiep-progression.css` (93 dòng) — **0 import trong repo** → dead file: `.pc-progression`-scoped restyles cho cả cụm panel (`.body-*` rules :9-11,:19-36,:92 + `.body-page-enter/leave` :76-78 "3-page flip"). Dead kép: `.body-paper-figure--meridian/--cycle` modifiers (:28-35) và `.body-material.unmet` (số ít, :92 — production dùng `.body-materials .unmet`) không có trong DOM dù file có sống.

**(g) Ba bản duyệt body song song.** Production `scenes/body/fidelity/*` (model thật); preview standalone `legacy/ui-body.html` → `BodyPreview.vue` (mock model + production component + `?locked` flag + `DongFuVista` + parallax `--df-x/y` + `back()` → `/legacy/ui-dong-fu.html`, locale `bodyMessages.ts` mirror `body.*`); design mock `HomeBodyArtPanel.vue` (750 dòng — implementation riêng cùng art ids: galaxy core/orbit :74-81, meridian tube/node :95,187,197, silhouette :113,121, navigation :106, divider :88) trong `ui-landscape-design.html` với locale riêng `bodyPreviewMessages.ts` (`bp.*`, merge tại `landscape-design.ts:12,19`).

**(h) `.body-extra` port.** BodySurface:8-9 comment ghi rõ hidden rows "port the same AUTH-2 discovery/frozen contract the retired detail panels owned" — panel cũ đã xóa, contract sống trong `.body-extra` + test pins (BodySurface.test.ts:270-291).

## 5. Logic không có hình ảnh

- `@click.self="emit('back')"` trên `.body-paper-scene` — dead vì `pointer-events:none` thắng scoped (4d); backdrop-dismiss vẫn xảy ra gián tiếp qua MainScene.
- Scoped `.body-heading h1 { font-size:30px; font-weight:700; color:#35250f }` — bị đè hoàn toàn, không bao giờ render (4b).
- `BodyChipView.hint` (bodySceneModel.ts:35; populate tại useBodySceneModel :116,:207,:284,:386,:392) — chips chỉ render label + state (Figure :162) → field **dead data** (milestones tận dụng chip shell chỉ để hiện label).
- `visibleMeridianNodes` filter (:66-68) — lớp phòng thủ thứ hai; thực tế `buildMeridianUnits` đã `filter(status !== 'locked')` :231 nên node locked hiếm khi tới được UI.
- `.body-notice` aria-live (:63,95) — text chỉ tồn tại 3.2s sau mỗi `invest()` (`flashNotice` :41-47); element luôn mounted với `min-height` giữ chỗ.
- `.body-gate` — gate lines (tierLock/pageLocked/realmGate/seqGate/zhouTian locked+realmLocked) render cinnabar :48,84.
- `.unmet` cost rows :41,83 — đỏ `#d98a6f`.
- `.body-milestone` :164-165 + `.body-caption` :167 — display-only, không tương tác.
- `preview` prop + `.body-preview-label` (:15,62,85) — chỉ `BodyPreview.vue` bật.
- `.meridian-flow` (:133,197) + `orbit-drift` + `th-title-shine` + `equipment-energy-flow` — animations có `@media prefers-reduced-motion` fallback (:213-215, css:147-149, EnergyTube :45-51).
- `isBetaStandalonePanel` mount-seam (GameRoot :85, ui.ts :248) — `body` map `null` feature → luôn mở được; guard chỉ có nghĩa với panel scope-hidden khác.
- `mountedStandalone` keep-mounted (GameRoot :77,96) — state scene (pickedChapter, selectedUnitId) sống qua đóng/mở.
- `getPhysiqueGrade`/`betaHiddenRealmRecordFor`/`getQuanTheMechanic` — pure reads; record hidden render không gì (đúng AUTH-2).
- Chapter pill `is-locked` chỉ đổi `opacity:.55` (:83) — click vẫn emit nhưng `selectChapter` từ chối lặng (BodySurface :203-211); test pin `is-locked` trên 2 seal sau (test :115-119).

## 6. Hình ảnh không có logic

**Art trong `body/` + trên disk nhưng production không dùng** (mock HomeBodyArtPanel cũng không đụng tới):
- `body/galaxy-dust-{lit,unlit}-v1.png`, `body/galaxy-orbit-arc-{lit,unlit}-v1.png`, `body/galaxy-ribbon-{lit,unlit}-v1.png`, `body/galaxy-spiral-{lit,unlit}-v1.png` — production chỉ vẽ core/orbit-circle/orbit-ellipse/stars.
- `body/meridian-junction-{lit,unlit}-v1.png`, `body/meridian-ring-{lit,unlit}-v1.png`.
- `body/silhouette-upper-v1.png` — production chỉ dùng `silhouette-seated` (cả mock cũng chỉ dùng seated :113,121).
- `body/source/*-atlas-v1.png` ×5 (biceps/body-process/galaxy/meridian/navigation) — nguồn cho generator `scripts/build-tien-hiep-ui.mjs`, không render trực tiếp.
- `source/paper-panel-cutout-v3.png` + `ink-panel-cutout-v3.png` (pack root `source/`) — input bake `runtime/page-paper|paper-panel|ink-panel.png` (build script :40-44).
- `controls/equipment-level-seal-v1.png` — chỉ render khi `squareArt` prop (EquipmentArtButton :56-61); body không dùng `square-art`.
- `controls/resource-{jade,coin,crystal,essence}-v1.png` — trong warmed list nhưng cost rows của body không dùng (icon duy nhất = pill khai_linh_dan).
- `runtime/paper-surface.png` — declared+warmed (AssetBundleCatalog :598, TienHiepUiAssets :16) và **được dùng ở scene khác** (`--th-art-paper-surface`: login-scroll css:257, warm header :279, secondary-ui :12,125, auxiliary :78, collections :14) — chỉ body scene không đụng (nó dùng `shared-paper-page-v1.png`).

**Warm ngược**: `huyen-kim/scene/body-v2/{mortal-horse-stance,qi-taichi,zhou-meditation}-v1.png` nằm trong `UI_SCENE_SINGLE_URLS` (:610-612) nhưng consumer duy nhất là `PaperSceneDesigns.vue:10` — design preview, không phải production. Ngược lại **toàn bộ `tien-hiep-2026-10/body/*.png` (50+ file đang dùng) không warm** — comment :571-572 ghi "registry entries with no live consumer (body/technique/map layers) stay unwarmed on purpose"; literal URLs được pin bởi `domArtLiteralCoverage` guard.

**DOM/CSS dormant**: `.body-title`, `.body-paper`, `.body-info-frame`, `.body-info-content`, `.body-page-enter/leave-*`, `.body-paper-figure--meridian/--cycle`, `.body-material` (số ít) — hooks không element mang.

## 7. Open questions

1. **`.body-invest` dual-chrome**: xóa `.body-invest` khỏi selector global css:237-238 để giữ chrome `equipment-filter` mới — hay việc chồng 2 lớp là cố ý?
2. **Title 72px vs 30px**: scoped viết 30px/700/#35250f nhưng global cho 72px shine — spec là cái nào? Nếu 72px đúng → xóa scoped dead rules; nếu không → siết selector `css:135` bỏ `.body-heading h1`.
3. **`.body-heading` legacy box**: css:134 `width:370px` + css:150 `p{padding}` buộc inline overrides — giữ inline hacks hay siết selector global?
4. **Legacy `.body-paper`/`.body-title`/`.body-info-*` cluster**: xóa hẳn khỏi selector lists (an toàn cho mọi scene) hay giữ? `.body-panel` đứng cách `.body-paper` một lần đổi tên là hồi sinh cả cụm chrome.
5. **`tien-hiep-progression.css`**: dead file 0-import — xóa hay giữ cho design review? Rules `.pc-progression` trong đó cũng dead-kép với DOM hiện tại.
6. **Galaxy dust/orbit-arc/ribbon/spiral + meridian-junction/ring + silhouette-upper**: gen xong chưa wire — chờ reskin tiếp hay bỏ sót?
7. **`@click.self=back` dead handler**: xóa (phụ thuộc hẳn MainScene click + Escape) hay đổi strategy pointer-events?
8. **`bodyMessages.ts` + `bodyPreviewMessages.ts` + `legacy/ui-body.html` + `HomeBodyArtPanel.vue`**: hai preview/locale song song còn phục vụ ai không, hay chỉ museum?
9. **Chip `hint` dead data**: viện cớ hiển thị ordinal hint (Tầng N/Mạch N/Bước N) hay cắt field khỏi `BodyChipView`?

## Adjudication

Verified tay trên `devin/artui-c0-foundation` @ 8ffc8e64. Reviewer đúng gần như toàn bộ — phần lớn §2/§3 của report gốc bịa symbol và đã được viết lại.

**Missed — ACCEPTED toàn bộ:**
- `useBodySceneModel.ts` (đúng 465 dòng; build*:78-143/:145-232/:234-319, milestones :382-395, chapterLockHint :413-429, investActive→realmAdvanceOps :453-462), `bodySceneModel.ts` (6 trạng thái :7-13), `bodyUi.ts` — logic layer thật report gốc không hề đọc.
- `SceneDesignCanvas.vue` (:41-43 overlay pointer-events, :20-22 ResizeObserver, mount :221) — cơ chế nền của click-through.
- `EquipmentEnergyTube.vue` (:32 dùng, animation :35-44).
- `bodyPreviewMessages.ts` — locale thứ hai `bp.*`, landscape-design.ts:12,19; HomeBodyArtPanel dùng nó.
- CSS bỏ sót: css:134 `.body-heading` (giải thích inline `width:auto`); cụm `.body-paper` :25/:133/:177/:253-256/:278/:344.
- Art bỏ sót: process-* ×12 → `.body-chip-art`; galaxy ×8 → Chu Thiên; divider → production header :23,41; navIcon → card title :15-16,22; meridian-tube-lit → `.family-spine`; `khai_linh_dan.png` → pills.ts:86; body pack unwarmed (:571-572).
- Logic-no-image bỏ sót: `BodyChipView.hint` dead, `.body-gate`, `.body-notice`+timer, `.body-milestone`, `.unmet`, `.body-caption`, `preview`+`.body-preview-label`, `visibleMeridianNodes`, `.meridian-flow`, `mountedStandalone`, `?locked`/`DongFuVista`/parallax/`back()` của BodyPreview, `.pc-progression` dormant hooks (dead kép `--meridian`/`--cycle`/`.body-material`), `.body-extra__bar` progress.

**Wrong — ACCEPTED toàn bộ:**
- `BodyChapterSeals.vue`/`BodyUnitRail.vue` không tồn tại (fidelity/ chỉ 4 file; chapter nav = `EquipmentArtButton.family-pill`, rail inline :157-166).
- Props contract bịa: thật `{model,unit,notice,preview}` + emits `back/chapter/select/invest` (:11-17).
- Stores bịa: `useUiStore`/`usePlayerStore`/`useStateVersion`/`useBodySceneModel`; data = `MERIDIANS` (:32), `ZHOU_TIAN_*` (:39-46) — không `useBodyProgressionStore`/`MERIDIAN_VESSELS`/`ZHOU_TIAN_STEPS`.
- `dispatch('body.investRefinement')` sai → `model.investActive` → `realmAdvanceOps.investBodyChapter`.
- `.body-extra` điều kiện ngược: render khi `discovered && !frozen` (:145,:156); test :273-281 chứng minh.
- Galaxy orbs production **có** vẽ (Figure :143-154; mock cùng ids :74-81) — unused chỉ là dust/arc/ribbon/spiral.
- `controls/resource-*` không dùng trong body; icon thật là pill png.
- `th-panel-swap` mount-level (BodyPanel :14, css :373-378) — không keyed chapter.
- `useDialogFocus` ở BodyFidelityScene :33, không phải BodySurface.
- Chapter lock từ chối ở UI `selectChapter` :203-211, không phải trong store.
- `BodyPaperDetails` props `{model,unit,notice}` :9; CTA `unit.actionLabel`/`unit.actionDisabled` :58.
- `shared-paper-page` trên `.body-panel` :37, không phải `.body-paper-scene`.
- `closeSidePanels` GameRoot :130-131 + :138 (report ghi :110-114).
- `equipment-level-seal-v1` chỉ `square-art` — body không dùng.
- `character-card-nine-slice-v2` là `controls/` PNG qua `equipmentArt()` (:5-8), không phải "runtime".
- `tien-hiep-progression.css` là `.pc-progression`-scoped restyles (93 dòng), không phải "layout body cũ".

**Verified-ok — giữ nguyên** (đã spot-check từng cite): mount chain, `.body-invest` dual-chrome (sửa specificity thành 1,1,0 > 0,2,0), h1 72px, `.body-heading p` padding, pointer-events dead handler, dormant `.body-title`/`.body-paper`/`.body-info-*`, progression.css 0-import, RealmPanel 0-refs, preview paths, unused art list, AUTH-2/test pins, locale 0-missing, physique.grades=10.

**Đính chính nhỏ (reviewer cũng chưa chuẩn):**
- `runtime/paper-surface.png` không hẳn "không logic" — nó sống qua `--th-art-paper-surface` ở scene khác (login-scroll css:257, warm header :279, secondary :12/:125, auxiliary :78, collections :14); chỉ body scene không dùng.
- `paper-panel-cutout-v3.png` nằm ở pack-root `source/` (không phải `body/source/`) — chỉ `body/source/*-atlas` mới ở dưới `body/`.
- `visibleMeridianNodes` ít khi lọc được gì trong thực tế (domain đã filter :231) — nó là lớp phòng thủ thứ hai chứ không phải cơ chế ẩn chính.
- `.family-pill` thoát khỏi selector :237 → chỉ `.body-invest` bị dual-chrome.
