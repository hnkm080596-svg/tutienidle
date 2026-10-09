# Panel: Cảnh Giới (RealmPanel)

## 1. Mount chain — từ nav/route đến component gốc

**Các cửa mở panel (4 đường):**

- **Command wheel** (wheel Backquote giữ lại): slot `realm` khai báo tại `commandWheelCatalog.ts:98-101` (`available: ALWAYS_AVAILABLE`, `disabledContext.realmReleaseUnavailable` `:64` — gate `BETA_WHEEL_SLOT_FEATURES.realm=null` `betaScopeSurface.ts:66`) → `activateSlot` → `ui.openStandalonePanel('realm')` — `DongFuStage.vue:330-344`; biểu tượng slot map qua `SLOT_SYMBOL.realm='realm'` (`DongFuStage.vue:113`).
- **Rail điều hướng landscape** (nav dọc của Động Phủ): `NAV_TARGET.realm` → `openStandalonePanel('realm')` — `DongFuStage.vue:232`; item trong `NAV_ITEMS` (`:205`), active qua `NAV_ACTIVE_STANDALONE.realm` (`:258-260`).
- **Rail giấy** `usePaperNavigation`: `NAV_TARGETS.realm = {kind:'standalone', panel:'realm'}` (`usePaperNavigation.ts:44`), `navigate()` → `openStandalonePanel` (`:124,129`); icon = `symbolUrl('realm')` (`:112`).
- **Thẻ Thiên Cơ Bảng** "Đột Phá": khi `canTriggerBreakthrough` đúng, entry `run: () => ui.openStandalonePanel('realm')` — `useThienCoEntries.ts:69-78`; icon `KIND_SYMBOL.breakthrough='realm'` (`DongFuStage.vue:171`).

**Cổng kiểm soát:** `ui.openStandalonePanel` chặn bằng `isBetaStandalonePanel` rồi `closeHomeOverlays()` + gán `standalonePanel='realm'` (`stores/ui.ts:244-255`). Realm luôn được admit vì `BETA_STANDALONE_PANEL_FEATURES.realm = null` (`core/betaScopeSurface.ts:134`), `featureAdmits(null)` → true (`betaScopeSurface.ts:41-46`).

**Mount:** watcher gom `panel` vào `mountedStandalone` (`layout/GameRoot.vue:77,96`) → `<RealmPanel v-if="mountedStandalone.has('realm')">` (`:158`). Panel là async component (`:16`), prefetch trên idle (`:111-118`).

**Chuỗi component (đường LIVE):**

- `panels/RealmPanel.vue:14` — wrapper rỗng: `<Transition name="th-panel-swap">` + `<RealmSurface v-if="ui.standalonePanel==='realm'">`.
- `scenes/realm/RealmSurface.vue:113-125` — `<SceneDesignCanvas overlay>` (canvas 1440×810 scale, `pointer-events:none` cả viewport lẫn canvas khi `overlay` — `common/SceneDesignCanvas.vue:4,41-42`; `ResizeObserver` tại `:21`) bọc `<RealmFidelityScene>`.
- `fidelity/RealmFidelityScene.vue:20-26` — `section.realm-paper-scene` → khung `.realm-paper` (div trang trí `aria-hidden`) + `<h1>` + `.realm-subtitle` + `RealmPaperMap` + `RealmPaperDetails` (+ nhãn preview khi `preview`).
- `fidelity/RealmPaperMap.vue:6-17` — `.realm-map` > `<img>` + các `button.realm-marker` theo `realmMapAnchors` (`realmUi.ts:45-49`, 18 tọa độ %), `slice(0, min(max,18))`.
- `fidelity/RealmPaperDetails.vue:13-29` — `.realm-details`: seal + tên cảnh giới + số tầng, thanh tiến độ, 2 dòng tu vi/tốc độ, list thiên phú, khối điều kiện đột phá, dòng "Đang xem", nút CTA, nút Quán Khí, dòng notice.

**Đường đóng:**

- Escape → `useDialogFocus(rootRef, () => true, {onEscape: emit('back')})` (`RealmFidelityScene.vue:16-17`) → `ui.closeHomeOverlays()` (`RealmSurface.vue:123`). **Caveat:** keydown gắn trên root `section` (`useDialogFocus.ts:65`), không phải document — Escape chỉ đóng khi focus còn nằm trong scene (mục 4.5).
- Click nền: root `.realm-paper-scene` bị `pointer-events:none` toàn cục (`tien-hiep-ui.css:390-402`) nên click rơi xuyên xuống `<MainScene @click="closeSidePanels">` → `ui.closeHomeOverlays()` (`layout/GameRoot.vue:130-138`) — nhưng chỉ ở mép canvas ngoài khung giấy (mục 4.5).
- Đổi panel qua rail/wheel → `openStandalonePanel` tự `closeHomeOverlays()` trước (`stores/ui.ts:252`).
- Nút CTA → `requirement.open()` (`RealmSurface.vue:103-106`) → `BreakthroughRequirementPanel`, modal `OverlayPanel` mount sẵn ở `layout/GameRoot.vue:201`.
- Nút Quán Khí → `ui.openStandalonePanel('quan_khi')` (`RealmSurface.vue:108-110`) → `QuanKhiPanel` (`layout/GameRoot.vue:160`), shell `OverlayPanel` (`QuanKhiPanel.vue:316`).

**Đường preview (không production):**

- `legacy/ui-realm.html` → `src/ui-preview/realm.ts` → `RealmPreview.vue` — mount `RealmFidelityScene` với model tĩnh + `DongFuVista` (`:20`), route map `ui-preview/previewRoutes.ts:2`.
- `ui-landscape-design.html` → `LandscapeDesignPreview.vue:66` → `HomeRealmArtPanel` — mock timeline ngang (biến thể thiết kế thứ ba).

## 2. UI logic inventory

**RealmPanel.vue** (`:10-14`): đọc `useUiStore`; chỉ render `RealmSurface` khi `standalonePanel==='realm'`.

**RealmSurface.vue** — bộ chuyển đổi dữ liệu → `RealmUiModel`:

- Stores: `useUiStore` (`:28`), `usePlayerStore` (`:29`), `useGameManager` + `useStateVersion` (`:30-31`), `useBreakthroughRequirementStore` (`:32`), `useRealmStatPassives` (`:15,33`).
- `selected` ref + `notice` ref + timer 3.2s (`:35-43`; timer clear trong `onBeforeUnmount` `:42`).
- `canBreakthrough` = `gameManager.realmAdvanceOps.canTriggerBreakthrough(player.$state)` (`:45`).
- `nextRealmSurface` = `betaNextRealmSurfaceFor` (`:46`) — null khi cảnh giới kế vượt trần release; `nextRealmName` (`:47`).
- `cultivationEta` = `(cultivationRequired - cultivation)/cultivationPerSecond` → `formatDuration` (`:49-54`).
- `model` (`:56-96`): `name` từ `getCurrentRealm(player.realmId)`; `currentFloor=player.realmLevel`; `maxFloor=realm.maxLevel`; `progress`/`progressLabel` từ `player.cultivationProgress` (getter `stores/player.ts:242-243`); `cultivation` = "x / y" (`formatNumber`); `rate` = `rateEta` hoặc `meta.rateValue` (rỗng khi rate≤0); `requirements` map từ `getBreakthroughRequirements` với label `requirements.level`/`chapterClear` (`:80-86`); `passives = realmStatPassiveRows` (`:87`); `ctaLabel` = Quán Khí khi mortal, Trúc Cơ khi qi_refining, còn lại `nextRealmName || majorFallback` (`:62-66`); `ctaVisible` = có `nextRealmSurface` (`:90`); `ctaEnabled` = `canBreakthrough` (`:91`); `quanKhiEntry` = `isActivePath(player,'sword') && !isScopeHidden('swordPath')` (`:94`; `CultivationPathSystem.ts:156`, `betaScope.ts:218`).
- Handlers: `onSelectFloor` → `selected` + `flashNotice('realm.viewing')` (`:98-101`); `onBreakthrough` → `requirement.open()` khi gate mở (`:103-106`); `onQuanKhi` → `openStandalonePanel('quan_khi')` (`:108-110`); `@back` → `closeHomeOverlays()` (`:123`).
- Prop kỳ lạ: `:selected="selected || model.currentFloor"` (`:117`) — floor 0 sẽ fallback (vô hại vì tầng bắt đầu từ 1).

**RealmFidelityScene.vue** (`:9-26`): props `model/selected/notice/preview`; emits `selectFloor/back/breakthrough/quanKhi`; `useDialogFocus` (focus-on-open vào focusable đầu tiên, Tab cycle, Escape, restore trigger — `useDialogFocus.ts:10-101`; kèm document-level `mousedown` containment `:73-79`); `paper` = url nine-slice (`:12`).

**RealmPaperMap.vue** (`:6-17`): props `current/selected/max`; `anchors` = `realmMapAnchors.slice(0, min(max,18))` (`:12`); mỗi marker là `<button>` với class `major`(÷3)/`reached`(≤current)/`current`/`selected`, `aria-pressed`, `aria-current='step'`, emit `select` (`:17`).

**RealmPaperDetails.vue** (`:6-29`): props `model/selected/notice`; `fill` = clamp progress (`:9`); `seal` url (`:10`); progressbar ARIA đầy đủ (`:16`); passives render `title=passive.description` (`:20`); requirements `dt/dd` + class `met` (`:22`); CTA `:disabled="!model.ctaEnabled"` (`:24`); nút Quán Khí `v-if="model.quanKhiEntry"` (`:27`); notice `role=status` (`:28`).

**realmUi.ts** (`:1-49`): contract `RealmUiModel` + `realmMapAnchors` — comment `maxLevel "12 for CORE realms"` (`:19`) đã cũ: tất cả realm giờ `maxLevel:18` (`data/realms/realm.ts:45-114`).

**Feed domain:** `getCurrentRealm/getNextRealm` (`core/realm/realmSystem.ts:3-21`), `CORE_REALM_LEVEL=12` (`:44`); `getBreakthroughRequirements` (`core/realm/BreakthroughGate.ts:44-73`) — mortal `[level]`, qi_refining `[level, chapterClear]`, transition đóng `[]`; `canTriggerBreakthrough` (`:75-77`); `betaNextRealmSurfaceFor` (`betaScopeSurface.ts:208-215`); `useRealmStatPassives` — chỉ passive đã cấp, lọc realm ẩn, chỉ modifier percent (`composables/useRealmStatPassives.ts`); `cultivationPerSecond` ghi mỗi tick (`core/cultivation/CultivationTick.ts:29,46`) — rate là số liệu sống.

**Cụm scene-05 CHẾT** (11 component không còn live importer — mọi tham chiếu còn lại đều nội bộ cây; ngoại lệ duy nhất: registry entry `betaScopeRenderedTokens.test.ts:167` liệt kê `RealmAscentNode.vue`):

- `RealmAscentMap.vue` — `<HuyenKimParallaxStack stack="realm-ascent">` (`:20`) + `RealmAscentTrack`; props `nodes/currentTier/nextTier/pathProgress/sealChar`.
- `RealmAscentTrack.vue` — scroll cột rung, `reversedNodes` (`:22-25`), `scrollTop=scrollHeight` onMounted (`:30-32`), trail + mist (`:36-56`).
- `RealmAscentNode.vue` — rung: medallion mask `rune-node` + số + banner dọc + seal chữ cái; state `is-current/complete/locked/next/future` (`:23-64`).
- `RealmDetailRail.vue` — rail `InkNineSlice surface-m-panel` + `<slot>` (`:9-11`).
- `RealmIdentityCard.vue` — thẻ `realm-card`: `HuyenKimSymbol name="realm"` + tên + `playerName` + `tierOf` (`:16-29`).
- `RealmCultivationBar.vue` — `<Bar>` + 2 chip rate/ETA + `RealmSectionTitle` (`:26-57`).
- `RealmPassiveList.vue` — `<article>` rows `InkNineSlice list-row` + effect/desc (`:20-33`).
- `RealmRequirementChips.vue` — chips `InkNineSlice seal-chip` tint jade/cinnabar + ✓/✗ (`:15-33`).
- `RealmActionBlock.vue` — gom `RealmSectionTitle` + `RealmRequirementChips` + `RealmBreakthroughCta`, map label `level/chapterClear` (`:30-55`).
- `RealmBreakthroughCta.vue` — `<GameButton variant=primary>` (`:16-25`).
- `RealmSectionTitle.vue` — heading + gem CSS (`:7-10`).

## 3. Art map

**Art đang LIVE:**

| Art file | Element dùng |
|---|---|
| `huyen-kim/scene/character-v2/paper-nine-slice.png` | `.realm-paper` `border-image-source` inline (`RealmFidelityScene.vue:12,21`) — realm mượn frame của scene character; slice/width/geometry bị CSS toàn cục viết đè (mục 4) |
| `huyen-kim/scene/realm-v2/ascension-path-six-landings-v2.png` | `<img.realm-map-art>` (`RealmPaperMap.vue:9,16`) — bản đồ 18 tầng, 6 đài chính (provenance `docs/design/realm-v2-art-provenance.md`) |
| `huyen-kim/symbols/realm.svg` | **HAI consumer sống:** `<img>` trong `.realm-seal` (`RealmPaperDetails.vue:10,14`) VÀ icon rail giấy `symbolUrl('realm')` (`usePaperNavigation.ts:112` → `dongFuUi.ts:12-14`) |
| `tien-hiep-2026-10/icons/navigation-realm-v2.png` | icon rail landscape 'realm' (`DongFuStage.vue:458` — `navigation-${id}-v2.png`; `pcPaperIconUrl` chỉ dùng cho avatar 'character' `:422`) |
| `var(--th-art-world-vista)` + `var(--th-art-paper-surface)` + gradient giấy | `.realm-paper::before` nền giấy (`tien-hiep-ui.css:253-256,278-280,344-346`) |
| `var(--th-art-button-primary)` | nền nút `.realm-cta` (`tien-hiep-ui.css:237`) |
| gradient text `th-title-shine` | tiêu đề `<h1>` (`tien-hiep-ui.css:135-149`) — plaque art chỉ còn trên selector ma `.realm-scene .realm-title` (`:99-103`) |
| Transition `th-panel-swap` | đổi panel (`tien-hiep-ui.css:373-379`; mount `RealmPanel.vue:14`) |
| scoped gold gradient + viền `#a5762e` | nút `.realm-quan-khi` (`RealmPaperDetails.vue:43-44`) — giữ scoped skin, không bị global reskin |

**Skin dormant thứ ba:** `src/assets/tien-hiep-progression.css` (93 dòng) restyle trực tiếp các class đang sống — `.realm-details`, `.realm-marker`, `.realm-map`, `.realm-cta`, `.realm-notice`, `.realm-seal`, `.realm-passives`, `.realm-progress`, `.realm-selection`, `.realm-identity` — dưới ancestor `.pc-progression`. **Hai lần chết:** 0 importer (main.ts:5-11 không nạp; cùng số phận `tien-hiep-collections/forge/outcomes.css` + `pc-paper-auxiliary-production.css`) VÀ 0 element nào emit class `.pc-progression` — import cũng vô dụng trừ khi đổi root class.

**Art đã giao nhưng KHÔNG còn đường render (thuộc cây chết):**

- Parallax `realm-ascent` 5 lớp `00-sky…04-low-mist` (`StableSceneArt.ts:111-138`) → chỉ `RealmAscentMap.vue:20` dùng.
- `rune-node@1x/2x` (manifest `ui/huyen-kim-chrome.json:366-370`, status ready) → mask `.realm-node__rune` (`RealmAscentNode.vue:23,44-46,54`).
- Chrome `surface-m-panel` (json `:46-50`) → `RealmDetailRail.vue:10`; `list-row` (`:506-510`) → `RealmPassiveList.vue:25`; `seal-chip` (`:226-230`) → `RealmRequirementChips.vue:22-26`.
- Symbol `realm` qua `HuyenKimSymbol` → `RealmIdentityCard.vue:21` (khác kênh với `symbolUrl` trên rail).
- Placeholder `art-needed` tự vẽ CSS: `realm-medallion` (`RealmIdentityCard.vue:19`), `realm-section-gem` (`RealmSectionTitle.vue:8`), `realm-node-medallion`/`realm-banner-plaque` (`RealmAscentNode.vue:53,59`), `realm-path-trail`/`realm-summit-mist` (`RealmAscentTrack.vue:43,45`), `realm-icon-flame`/`realm-icon-hourglass` (`RealmCultivationBar.vue:43,50`).

**Art preview-only (mock thứ ba):** `tien-hiep-2026-10/realm/landscape-{1,2,3}-v1.png` (`HomeRealmArtPanel.vue:46`), `meditation-v1.png`, `active-card-frame-v1.svg`, `shared-paper-page`, `equipment-divider` (catalog `AssetBundleCatalog.ts:677-679`).

## 4. Conflicts / layers — hai phiên bản cùng tồn tại

1. **Chiến tranh nine-slice khung giấy — thua trọn gói kể cả geometry.** Scoped `.realm-paper` đặt `left:94 top:123 w:1334 h:633`, `border-image-slice:300 fill`, `width:83px` (`RealmFidelityScene.vue:30`) — thông số đúng cho `paper-nine-slice.png`. Global ép hai lần: nhóm `:is(#app,body)` `:177-179` đặt `slice:240 320` (không `fill`) + `width:52px`, và `.realm-paper-scene .realm-paper` `:133` còn dời frame sang `left:156 / width:1272` — lệch 62px sang phải, hẹp hơn 62px so với thiết kế fidelity. `::before` nền giấy+vista (`:253-256,278-280,344-346`) + `::after border-image:inherit` (`:256`) vẽ lại tâm giấy. Source vẫn là nine-slice.png (inline style thắng) nhưng mọi thông số khung đều của spec `panel-frame-v2`.
2. **Tiêu đề bị viết đè gần hết.** Scoped `h1`: `position:absolute; left:231 top:166 font-size:30px italic` (`RealmFidelityScene.vue:31`); global ép `width:370 font-size:72` + gradient chữ + animation shine (`tien-hiep-ui.css:135-149`) và `left:289 top:97 z-index:6` (`:151`). **Sót lại:** `position:absolute` (global không khai báo position) — load-bearing: không có nó thì left/top/z-index global đều inert. Scoped còn đúng `position` + `margin:0` sống sót.
3. **Nút Đột Phá bị đổi skin, nút Quán Khí thì không — hai chrome trong cùng một pane.** Scoped `.realm-cta` vẽ gradient xanh ngọc + viền đôi vàng (`RealmPaperDetails.vue:46`); global ép `background:var(--th-art-button-primary)`, `border:0`, `color:#352713`, `font-size:20` (`tien-hiep-ui.css:237-238`). Nhưng `.realm-quan-khi` KHÔNG nằm trong danh sách `:is(...)` `:237` → giữ nguyên scoped gold gradient (`RealmPaperDetails.vue:43-44`) đứng cạnh CTA đã reskin — inconsistency ngay trong `.realm-details`.
4. **`@click.self` đóng panel là code chết + vùng giấy là dead click zone chiếm gần hết canvas.** Root `pointer-events:none` toàn cục (`tien-hiep-ui.css:390-402`, lý do `:385-389`: để rail bấm xuyên) đè luôn `pointer-events:auto` scoped (`RealmFidelityScene.vue:29`) → `click.self` (`:20`) không thể nổ. Nhưng `:403-411` restore `pointer-events:auto` cho MỌI `> *` — `.realm-paper` (aria-hidden, ~156→1428 × 123→756 trên canvas 1440×810) nuốt click. Hệ quả: backdrop-dismiss chỉ hoạt động ở mép canvas ngoài khung giấy; bấm vào "nền" giấy — vùng nhìn giống backdrop nhất — không làm gì cả.
5. **Escape gãy theo focus.** `useDialogFocus` gắn `keydown` lên root `section` (`useDialogFocus.ts:65`) và focus-on-open vào `.realm-marker` đầu tiên (section không tabindex → không focusable). Sau khi bấm vào vùng giấy unfocusable (trong card nên document-mousedown containment `:73-79` không `preventDefault`), `activeElement` về `<body>` → Escape không bubble qua scene root → panel không đóng. Handler window của `DongFuStage.vue:381-382` chỉ `closeCommandWheel()`. Comment "Same dialog contract… Escape closes" (`RealmFidelityScene.vue:14-15`) lệch sự thật hai đầu (click.self chết + Escape focus-fragile).
6. **Cây scene-05 chết nguyên.** 11 component (mục 2) không còn live importer: `RealmSurface` chỉ import `RealmFidelityScene` (`:23`). Ngoại lệ duy nhất: `tests/architecture/betaScopeRenderedTokens.test.ts:167` còn đăng ký `RealmAscentNode.vue` trong BENIGN token registry — xóa cây phải dọn entry này.
7. **Selector `.realm-scene`/`.realm-title` ma.** `tien-hiep-ui.css:25` `.realm-scene .realm-paper`, `:99-103` `.realm-scene .realm-title` (plaque art), `:358-361` nhóm `.realm-title` — không element nào mang class `realm-scene` (cây chết chỉ có `realm-scene__ascent`) cũng như không có `.realm-title` (live dùng `> h1` trần). Ba rule chết — kể cả plaque title art chỉ còn sống qua selector ma.
8. **Chrome hệ gen-1 chết.** `system-theme.css:291-314`: `.overlay-panel__card--system .realm-requirement/.realm-node/.realm-node__index` — hệ `OverlayPanel variant=system` đã gỡ khỏi RealmPanel; `.realm-node__index` không tồn tại cả trong gen-2 (gen-2 dùng `.realm-node__medallion b`). `theme.css:473-484` `.paper-on-sys` comment nhắc RealmPanel nhưng panel live không dùng class này.
9. **Hai hệ chrome chồng nhau trong một flow.** Bấm "Đột Phá"/"Quán Khí" từ scene giấy mới mở `BreakthroughRequirementPanel` + `QuanKhiPanel` — cả hai shell `OverlayPanel` modal cũ (`layout/GameRoot.vue:201`, `QuanKhiPanel.vue:316`). `ImperialScrollScene` cũng chưa chết toàn cục — vẫn sống qua `FunctionOverlayPanel` (`:5,122-155`, PAPER_MODES→scroll ở exploration).
10. **Clip risk `.realm-details`.** Hộp cố định `left:933 top:170 w:430 h:557` + `overflow:hidden` + bottom stack absolute (`quan-khi bottom:112`, `selection :90`, `cta :35`, `notice :0`) — nội dung in-flow (passives + requirements) dài lên bị nuốt/đè bởi bottom stack. Comment `RealmPaperDetails.vue:40-42` thừa nhận docking dance — hazard thật.
11. **`t('preview')` thiếu trong locale production.** `RealmFidelityScene.vue:25` render `t('preview')` — `vi.json`/`en.json` không có key top-level `preview` (chỉ `realmMessages.ts:22` của preview harness có). An toàn vì chỉ render khi prop `preview`, nhưng in nguyên "preview" nếu ai bật prop trong prod.
12. **Spec e2e pin vào DOM đã chết, đang sống nhờ skip.** `tests/e2e/ui-audit-progression-fixed.spec.ts:113-125,214` assert `getByRole('dialog',{name:'Cảnh Giới'})` (live root là `section` + aria-label, không role=dialog), `.realm-requirement`, `.realm-panel__cultivation-meta`, `.realm-node.is-current` — toàn contract gen-1/dead-tree. Chỉ sống nhờ `test.skip(!BETA_FEATURES.swordPath)` `:104` — lật flag là đỏ. Các spec khác tham chiếu realm ở mức data/wheel (không brittle): standing-slot-panel, tribulation-flow, technique-frozen-warning, cultivation-path-ritual.
13. **Comment/dữ liệu cũ sót:** `realmUi.ts:19` và `RealmPaperMap.vue:10-11` nói "CORE realms max 12" — mọi realm hiện `maxLevel:18` (`data/realms/realm.ts:45-114`); spec `huyen-kim-scene-layout-spec.md:117-126` mô tả cây scene-05 như hiện tại.
14. **Key dịch chết:** `panels.realm.nodes.*` (6 key) chỉ cây chết dùng; `tierOf` → chỉ `RealmIdentityCard.vue:29`; `sections.requirements` → chỉ `RealmActionBlock.vue:45`; `meta.etaLabel` → chỉ `RealmCultivationBar.vue:52`; `tierLine/ceilingNote/title` — 0 consumer; **`body` ({title,navAria}) — 0 consumer** (sót trong report gốc). `bodyRefinement/physique/meridian/zhouTian` sống qua `BodySurface`.

## 5. Logic không có hình ảnh

- **`selected` không đổi dữ liệu gì.** `onSelectFloor` (`RealmSurface.vue:98-101`) chỉ set `selected` + flash notice; `RealmPaperDetails` hiển thị dữ liệu cảnh giới HIỆN TẠI bất kể tầng nào được chọn — không có dữ liệu per-floor nào được feed. Spec yêu cầu "node = inspect level state" (`huyen-kim-scene-layout-spec.md:126`).
- **`betaRealmLadderNodes()` mồ côi** (`betaScopeSurface.ts:183-195`) + toàn bộ `REALM_PASSIVE_NODES` (`data/realm/RealmPassiveNodes.ts:30-41`): read-model thang cảnh giới không còn consumer production — chỉ tests + comment trong cây chết (`RealmAscentNode.vue:2`).
- **`betaHiddenRealmRecordFor`** (`betaScopeSurface.ts:223-232`) comment "for the RealmPanel section rows" nhưng thực tế chỉ `BodySurface.vue:20,144,155` gọi — comment lệch chủ đích.
- **`passive.description`** chỉ lộ qua `title` tooltip gốc (`RealmPaperDetails.vue:20`) — không có vùng mô tả thật như `realm-passive-row__desc` của cây chết (`RealmPassiveList.vue:30`).
- **`playerName`** — gen cũ hiển thị tên nhân vật trên realm-card (`RealmIdentityCard.vue:8,26`); scene mới không render tên người chơi.

## 6. Hình ảnh không có logic

- **18 nút `.realm-marker`**: đầy đủ chrome tương tác (button, click, `aria-pressed`/`aria-current`, hover/focus-visible — `RealmPaperMap.vue:17`) nhưng hành động duy nhất là đổi outline + dòng "Đang xem mốc tầng N" — decoration.
- **`realm-selection` + notice** trùng vai trò: cùng state `selected` được nói ba lần (outline marker, dòng `realm.viewing` `:23`, toast `.realm-notice` `:28`).
- **`.realm-preview-label`** (`RealmFidelityScene.vue:25`) — chỉ preview harness thấy.
- **`HomeRealmArtPanel`** (`ui-preview/HomeRealmArtPanel.vue:8-46`) — mock timeline ngang: nút "Nâng Tầng"/"Độ Kiếp" chỉ đổi `index`/`realm` local, không chạm gameplay; art landscape/meditation chỉ trưng.
- **Placeholder `art-needed`** trong cây chết — CSS vẽ tạm chờ art (8 slot, mục 3).
- **`tien-hiep-progression.css`** — skin dormant thứ ba (93 dòng) restyle đúng class live nhưng 0 importer + 0 `.pc-progression` emitter (mục 3).

## 7. Open questions

1. Nine-slice: có chủ đích để `.realm-paper` ăn spec chung `240/320/52` + geometry `left:156 w:1272` (`tien-hiep-ui.css:133,177`), hay nhóm `:is(...)` quét nhầm vào art `paper-nine-slice.png` vốn cần `300-fill/83` + `left:94 w:1334` (`RealmFidelityScene.vue:30`)? Frame hiện cắt sai khổ VÀ lệch vị trí.
2. Vùng giấy nuốt click + Escape gãy theo focus: fix bằng cách nào — cho `.realm-paper` `pointer-events:none` (mất border-image hit test nhưng art nằm ở `::after` cùng `pointer-events:none`), hay gắn Escape lên document?
3. Cây scene-05 (11 file + `RealmPassiveNodes` + `betaRealmLadderNodes` + art chrome đã giao + registry entry `betaScopeRenderedTokens.test.ts:167`): xóa, hay giữ làm reference cho bản "thang cảnh giới xuyên realm" sau này? Spec `huyen-kim-scene-layout-spec.md:117-126` vẫn mô tả nó là bản hiện tại.
4. Nút tầng: implement đúng "inspect level state" (mỗi tầng một dữ liệu riêng) hay gỡ hẳn `click`/ARIA-button để marker thuần trang trí?
5. `BreakthroughRequirementPanel` + `QuanKhiPanel` mở từ scene giấy vẫn dùng chrome `OverlayPanel` cũ — có trong kế hoạch reskin không?
6. Selector `.realm-scene`/`.realm-title` (`tien-hiep-ui.css:25,99,358`) + khối `system-theme.css:291-314` + `.paper-on-sys` comment — dọn hay giữ chờ chrome hệ quay lại?
7. `ctaLabel` mortal = "Quán Khí" (`RealmSurface.vue:62-63`) — nút này mở nghi thức nhập đạo (`chooseCultivationPath`) chứ không phải đột phá thường; giữ nhãn nghi thức hay đổi?
8. `tien-hiep-progression.css` (93 dòng reskin đúng class live, 0 importer + 0 `.pc-progression` emitter): skin thứ ba bị bỏ dở hay chờ wiring `.pc-progression` root? Quyết định chung với cụm outcomes/collections/forge/pc-paper-auxiliary-production.
9. `ui-audit-progression-fixed.spec.ts` pin DOM gen-1 đang trốn dưới `test.skip(swordPath)` — khi flag lật, spec đỏ ngay; viết lại trên contract fidelity hay xóa?

## Adjudication

**Missed — chấp nhận 12/12** (verify trực tiếp trên code @ 8ffc8e64):

1. `tien-hiep-progression.css` — ĐÚNG, hơn nữa: `.pc-progression` cũng 0 DOM emitter → sheet chết hai lần, không chỉ "dormant".
2. `:133` geometry override — ĐÚNG: `left:156 width:1272 border-image-width:52` vs scoped `94/123/1334/633`.
3. h1 `position:absolute` sống sót — ĐÚNG: global `:135-151` không khai báo position.
4. `pointer-events:auto` scoped bị đè — ĐÚNG (`RealmFidelityScene.vue:29` vs `:390-402`).
5. `.realm-paper` dead click zone — ĐÚNG: `:403` restore `> *` auto; paper là child trực tiếp, aria-hidden, phủ gần hết canvas.
6. Escape focus-fragile — ĐÚNG: keydown trên root (`useDialogFocus.ts:65`), section không tabindex, click giấy → focus về body; document mousedown containment `:73-79` tồn tại nhưng chỉ chặn click NGOÀI card.
7. e2e spec gen-1 DOM + `test.skip(swordPath)` :104 — ĐÚNG (`:113-117,125,214`); các spec khác reviewer liệt kê chỉ tham chiếu realm data/wheel, không brittle — giữ một dòng chú thích.
8. `betaScopeRenderedTokens.test.ts:167` — ĐÚNG (registry BENIGN theo path-string, không phải import — nhưng vẫn là external ref phải dọn khi xóa cây).
9. `.realm-quan-khi` thoát reskin `:237` — ĐÚNG: không có trong `:is()` list; giữ gold gradient `:43-44`.
10. Clip risk `.realm-details` — ĐÚNG: hộp cố định + `overflow:hidden` + bottom stack absolute; comment `:40-42` tự thừa nhận.
11. `panels.realm.body` dead — ĐÚNG: 0 consumer (đã scan `panels.realm.body` trừ `bodyRefinement`).
12. Điểm lẻ — ĐÚNG hết: catalog `:98-101` + `realmReleaseUnavailable` `:64`; `ResizeObserver` `SceneDesignCanvas.vue:21` (đường dẫn đúng: `common/`); `symbolUrl` → `realm.svg` 2 consumer; `ImperialScrollScene` sống qua `FunctionOverlayPanel`; `noticeTimer` cleanup `:42`.

**Wrong — chấp nhận 5/5:**

1. Rail icon = `navigation-realm-v2.png` (`DongFuStage.vue:458`), `pcPaperIconUrl` chỉ feed avatar 'character' `:422` — ĐÚNG.
2. `featureAdmits` ở `betaScopeSurface.ts:41-46` — ĐÚNG (`:166` là call site trong `isBetaStandalonePanel`; `:436` thuộc `betaScope.ts`).
3. h1 chỉ còn `position`/`margin` — ĐÚNG (trùng Missed #3).
4. "Chỉ tự tham chiếu" sai nhẹ — ĐÚNG (registry entry là external ref).
5. Lệch dòng — chấp nhận hướng sửa: `RealmAscentMap` parallax thực tế `:20` (report `:18`; reviewer `:19-20` cũng hơi rộng); `HomeRealmArtPanel` landscape `:46` (report `:11,36,64`); `useThienCoEntries` entry `:69-78`; `BreakthroughGate` `getBreakthroughRequirements` `:44-73` / `canTriggerBreakthrough` `:75-77` (reviewer `:68-73` cũng lệch nhẹ — số cuối đúng ở `:75`).

**Verified-ok của reviewer:** spot-check khớp (mount chain, model `:56-96`, feed domain, dead tree internals, CSS war lines, locale dead keys, preview paths, art paths, selected-no-feed). Không phát hiện thêm sai sót ngoài phần đã sửa.
