# Panel: Wheel cũ (vòng chức năng Động Phủ + vòng Ngũ Hành nhân vật)

Audit trên `devin/artui-c0-foundation` @ 8ffc8e64, read-only, chỉ đọc code. (Đã adjudicate: report gốc + review findings — chi tiết cuối file.)

**Phạm vi 2 cái 'wheel' khác nhau:**
- **Wheel A — vòng chức năng Động Phủ** (`DongFuWheel.vue`): radial menu mở panel. **Còn sống** trong production, mở bằng phím `` ` ``.
- **Wheel B — vòng Ngũ Hành** (`CharacterFigureWheel.vue`): 5 huy hiệu hành quay quanh tượng đứng + Hỗn Nguyên. **Đã chết** — toàn bộ nhánh mount đã bị thay bằng fidelity scene, và `PlayerPortrait` chết theo.

## 1. Mount chain

### Wheel A (DongFuWheel) — LIVE qua 2 đường

**Production:**
```
main.ts:59 installTienHiepUiAssets, :66 vTooltip, :82 app.mount
  → App.vue:1293 <GameRoot v-if="isBooted"> (components/layout/GameRoot.vue:4)
    → MainScene.vue:18 <DongFuStage/>
      → SceneDesignCanvas v-if="!stageActive" (DongFuStage.vue:412)
        → <DongFuWheel> (DongFuStage.vue:480-485)
```
- Gate hiển thị: `useStageActive()` (composables/useStageActive.ts — file 20 dòng) — wheel chết cùng cả stage khi route = combat/tribulation (:18-19).
- Open state: `ui.isCommandWheelOpen` (stores/ui.ts:135) → prop `open` (DongFuStage.vue:483) → `v-show` (DongFuWheel.vue:34).
- **Đường mở duy nhất trong production: phím Backquote** — `onKeydown` (DongFuStage.vue:397-400), gate `!stageActive && !surfaceOpen && !feedbackOpen`. Escape đóng (:381-383). `toggleCommandWheel`/`closeCommandWheel` chỉ được gọi từ DongFuStage (:399,:333,:382 — grep không caller khác). Click nền trống đóng qua `onSceneClick`→`ui.closeHomeOverlays` (:366-369, ui.ts:258-263).
- Nút `df-cultivator` bấm-mở-wheel **không tồn tại trong production** — comment store (ui.ts:132-134 "mo/dong bang click nhan vat tu luyen") đã cũ.

**Preview (standalone page):**
```
ui-preview/dong-fu.ts:14 → DongFuPreview.vue:42
  → DongFuFidelityScene.vue:27-36 <DongFuHomeContent>
    → <DongFuWheel> (DongFuHomeContent.vue:76-81)
    → <DongFuBoard> (DongFuHomeContent.vue:85-91)   [board cũng mount ở đây]
```
- Wheel/board open state local `shallowRef(true)` ×2 (DongFuFidelityScene.vue:15-16), toggle qua nút cultivator (DongFuHomeContent.vue:68-75) → emit `toggleWheel` (:34), `toggleBoard` (:35).

**Test:** `DongFuWheel.test.ts:34-50` mount trực tiếp; `betaConsumerLeak.probes.test.ts:21,107` mount **DongFuStage thật** để probe badge (selector `[data-wheel-slot="character"] .df-node__badge` :127); `ui.test.ts:15,21` (flag wheel); `uiAudioBinding.test.ts:68-74` (wheel cues); **25 spec e2e** dùng locator `[data-wheel-slot=...]` (helpers.ts:113 + 44 hit khác trong tests/).

### DongFuHomeContent — CHỈ preview (comment trong file nói sai)

- Header tự ghi "shared by the ui-dong-fu preview ... and the production DongFuStage (read-model adapter)" (DongFuHomeContent.vue:2-5) — **SAI**: `DongFuStage.vue` không import nó (chỉ import DongFuWheel/DongFuBoard/type DongFuUiAction ở :39-41). Consumers thật: `DongFuFidelityScene.vue:10,27` + `DongFuHomeContent.test.ts:12`.
- `DongFuFidelityScene.vue:4-5` mắc **cùng lỗi**: "Production mounts the same content through DongFuStage" — production không mount (reviewer sót, giờ bắt được).
- Hệ quả: mọi vùng trong file này — plaque công trình `df-building` (:42-66), nút `df-cultivator` (:68-75), `df-location` (:92-95), `df-quest` (:96-109), `df-notice` (:110), DongFuHud (:82-84), DongFuBoard kèm `occluded` (:85-91) — **không render trong game thật**. Production DongFuStage tự vẽ chrome `home-design-*` inline (:421-445) + nav rail (:446-470) + mount Board riêng (:486-491).

### Wheel B (CharacterFigureWheel) — DEAD

```
CharacterPanel.vue:2,11 → CharacterScene.vue:4,20 → CharacterFigureWheel
```
- `CharacterPanel.vue` **không được import bởi file production nào** — chỉ `CharacterPanel.stats.test.ts:10` và `CharacterPanel.betaScope.test.ts:15`. Các hit khác (`CharacterDetailCard.vue:8`, `QuanKhiPanel.vue:3,7`, `ElementLabels.ts`, `StatLabels.ts`, `CultivationPathKit.ts`, `Player.ts`) đều là comment.
- Mount production thật của scene Nhân Vật: `LeftPanel.vue:4,17` → `CharacterSurface.vue:33,277` → `CharacterFidelityScene` → `CharacterFidelityIdentity.vue:8,32` → `CharacterFidelityFigure` (sprite động `EntitySpriteCanvas` :15,:37, KHÔNG có huy hiệu hành — comment CharacterSurface.vue:8-9: "The five element discs were removed").
- Preview `CharacterPreview.vue:6,96` cũng dùng `CharacterFidelityScene`, không dùng scene cũ.
- Cùng chết theo: `CharacterScene.vue` + sibling `CharacterIdentityHeader/CharacterTalentSeals/CharacterMainStats/CharacterMainStatRow/CharacterElementSummary/CharacterDerivedStats/CharacterSectionPlaque.vue` — mỗi file chỉ được tham chiếu trong cụm (grep: consumer duy nhất là CharacterScene hoặc lẫn nhau), ngoại trừ `CharacterSurface.vue` (live, LeftPanel) và manifest list trong `betaFrontendScopeExposure.test.ts:204-209` (chỉ là danh sách path, không phải consumer).
- **`PlayerPortrait.vue` chết theo cây** (đính chính review): chỉ 2 template consumer — `CharacterFigureWheel.vue:105` + `CharacterIdentityHeader.vue:44`, cả hai đều chết. `ArtifactOverview.vue:4` chỉ nhắc trong comment; còn lại là test (`PlayerPortrait.test.ts`, `b18ConsumerHonesty.qa.test.ts:19,190-194` SSR test cho variant 'cultivate') + comment trong `AssetBundleCatalog.ts:205,634`.

## 2. UI logic inventory

### DongFuWheel.vue (79 dòng — thin shell)
| Logic | Vị trí | Feed vào |
|---|---|---|
| props `actions/selected/open` | :5 | v-show + v-for |
| emit `action[id]` | :6 | host route |
| computed `nodes` — tọa độ 1 vòng RING_RADIUS=187, tâm 210,210, chia đều 360/N (comment :8-13 giải thích bỏ 2-ring vì orb chồng click) | :14-27 | `:style` left/top từng node (:41) |
| `activate()` chặn khi `disabledReason` | :28-31 | click orb (:49) |
| classes `is-selected/is-active/is-disabled` | :40 | style trạng thái |
| `symbolUrl(node.symbol)` | :51 | `<img>` orb |
| badge `dot/alert` (union type có 'upgrade' nhưng wheel không có CSS `--upgrade` — xem §4.10) | :51, :67-69 | chấm góc orb |
| `data-wheel-slot` attr | :48 | **test hook live** — 45 hit trong tests/ (25 spec e2e + arch probe mount DongFuStage thật) |
| i18n `dongFu.aria`, `t(node.labelKey)` | :34, :53 | label |
| **Hit-test**: `.df-wheel` + `.df-node` `pointer-events:none` (:58,:64), chỉ `.df-node__orb` auto (:65) — click vào khoảng trống BÊN TRONG vành wheel rơi xuống `<main>` → `onSceneClick` → `closeHomeOverlays` → đóng wheel. Orb là `<button>` nên click trúng orb thoát sớm khỏi INTERACTIVE_SELECTOR (không đóng wheel). | :58-65 | hành vi đóng |

### DongFuStage.vue — adapter production của wheel (570 dòng)
| Logic | Vị trí |
|---|---|
| `disabledContext` (unlock predicates artifact/companion/formation/realm) | :100-107 |
| `renderedSlots = betaWheelSlots().filter(available)` | :109 |
| `SLOT_SYMBOL` map id→symbol svg (15 id) | :111-127 |
| `slotDisabledReason` / `slotActive` / `slotBadge` (alert khi canTriggerBreakthrough :145-146; dot khi building ready/upgradeable :148-151) | :129-153 |
| `slotAction` + `wheelActions` computed | :155-166 |
| `activateSlot` — cue `ui.wheel.select` :332, `ui.closeCommandWheel` :333, openBuilding / openLeftPanel / openStandalonePanel | :330-345 |
| `onWheelAction` — route chung cho wheel VÀ board entries: entry ưu tiên trước slot (:348-352), fallback `flashNotice(t('dongFu.unhandled'))` (:358) | :347-359 |
| `surfaceOpen` gate (wheel/board/rail khoá khi panel che) | :56-58 |
| `feedbackOpen` ref + `watch(surfaceOpen)` đóng dialog khi panel mở (mutual exclusion) | :60, :67-69 |
| `boardOpen = ref(true)` — Thiên Cơ Bảng **mở sẵn** khi vào home (preview cũng `shallowRef(true)` :16) | :61 |
| Rail collapse: `railCollapsed`/`railIndicator` :62-63, `toggleRail` :71-76, `onRailTransitionEnd` :78-80 + `@transitionend` :446, nút `«` :462-469 / `»` :472-479, Tab toggle :389-393 | :62-80 |
| `notice`/`flashNotice`/`noticeTimer` — ref + `window.setTimeout` 3200ms, cleanup `onBeforeUnmount` :93-95 | :82-95 |
| Keyboard: `` ` `` toggle (:397-400), Esc (:381-383), Tab rail (:389-393); window listener mount/unmount :403-408 | :380-408 |
| `INTERACTIVE_SELECTOR` + `onSceneClick` — vùng "interactive" = `button, a, input, select, textarea, [role=button], [data-df-ui]`; `data-df-ui` gắn trên `home-design-profile`/`home-design-currencies`/`home-navigation-surface`/`df-notice` (:421,:428,:446,:493) → click lên chrome không đóng wheel/panel; click nền trống (kể cả trong vành wheel) đóng hết | :364-369 |
| `navActive` — rail đã xử lý đúng case character (`ui.characterOverlayOpen && ui.characterSceneTab === id` :271) mà `slotActive` của wheel thiếu — xem §4.5 | :267-278 |
| `navAction` — cue `ui.wheel.select` (:282) + `feedbackOpen=false` khi không phải feedback (:285) | :280-291 |
| Currency/quest/profile: `CHIP_ICON` :298, `currencyChips` :299-307, `trackedQuest`/`questCard` :309-325, `profileProgress` :327 | :296-327 |
| Mounts khác trong scene: `AutoFarmIndicator` (:38,:492), `FeedbackDialog` (:37,:497), `pc-paper-scene__frame` overlay trang trí (:494) | |
| Root attrs: `class="df-scene hk-art-scene landscape-design"`, `data-hk-scene="dong-fu"`, `:class` covered/rail-collapsed | :414-416 |

### dongFuUi.ts — pure types + art constants (59 dòng, không logic runtime)
`DONG_FU_ART` (:5-10), `frameMetadata` (:2,11), `symbolUrl` (:12-14), interfaces `DongFuUiAction/Building/Opportunity/Quest/Model` (:15-59).
- **Consumers sống ngoài cây wheel**: `usePaperNavigation.ts:17` (icon: symbolUrl(id) :112 — feed SettingsSurface rail), `CharacterFidelityStats.vue:7,28`, `DongFuBoard.vue:4,16`, `DongFuHomeContent.vue:13`, `DongFuHud.vue:5` → file KHÔNG xoá theo wheel.

### Catalog + store
- `COMMAND_WHEEL_SLOTS` **15 slot** (data/ui/commandWheelCatalog.ts:88-245): 3 ring1 + 5 ring2 + 5 ring3 + 2 ring4 — field `ring` (:19) giờ chỉ còn nghĩa comment; layout render 1 vòng (DongFuWheel.vue:8-13).
- `betaWheelSlots()` (betaScopeSurface.ts:92-94) + `BETA_WHEEL_SLOT_FEATURES` (:64-80): `phap_bao→artifact`, `formation_slot→formation`, `companion_roster→companion`, `chi_hien_quan→manualWorkforce` bound feature đang `false` hết (betaFeatureFlags.ts:31-43) → không render; `talisman_slot` bound `null` (:70) → admitted nhưng `NEVER_AVAILABLE` (:154, def :67) → lọc tiếp. **Live wheel = 10 slot**: character, realm, skill, quest, teleport_array, pill_room, gathering_outpost, equipment_hall, scripture_pavilion, settings.
- `ui.ts`: `isCommandWheelOpen` (:135), `toggleCommandWheel` (:265-274, gọi closeHomeOverlays trước khi mở), `closeCommandWheel` (:276-278), `closeHomeOverlays` (:258-263 đóng cả leftPanelMode/characterOverlayOpen/standalonePanel/wheel).
- `uiAudioBinding.ts:61-62` — `isCommandWheelOpen` diff → cue `ui.wheel.open/close` (`flush:'sync'` :67); manifest `src/core/audio/AudioCueManifest.ts:261-263` có `ui.wheel.open/close/select`.

### CharacterFigureWheel.vue (DEAD — 319 dòng, vẫn liệt kê cho đầy đủ)
`chosenKit` beta-lock (:27-33), `characterAuraColor`→`--aura` (:36-38, :73), `heroElement`/`heroDiscUrl` (:39-46), `elementRows` đọc `player.finalStats` power/resistance/penetration (:49-58), `primordialDiscUrl` + 3 URL formation (:62-67), `v-tooltip` kind 'element' ×6 (:97 v-for, :114 primordial), `PlayerPortrait` (:105-109, PORTRAIT_HEIGHT :69), pentagon positioning `element-node--*` (:238-242).

## 3. Art map

### Wheel A
| Art | Nguồn | Element |
|---|---|---|
| `/assets/ui/huyen-kim/symbols/{id}.svg` (53 file, gồm technique.svg — tồn tại) | `symbolUrl` dongFuUi.ts:12-14 | `<img>` trong orb (DongFuWheel.vue:51) — tint CSS filter :66 |
| Orb CSS: radial-gradient + 2 viền + glow | DongFuWheel.vue:65 | `.df-node__orb` — **bị global đè** |
| `orb-frame.png` (tien-hiep-2026-10/runtime) | `--th-art-orb-frame` qua SKIN_ART TienHiepUiAssets.ts:9, inject `root.style.setProperty('--th-art-*')` :26-30, install main.ts:59 | global rule `tien-hiep-ui.css:65-68` thay background+border+shadow scoped |
| Vành orbit: thuần CSS (1 solid + 1 dashed ::after) | DongFuWheel.vue:59-60 | `.df-wheel__orbit` — `aria-hidden` |
| Badge dot/alert: CSS radial + keyframe `df-badge-pulse` | DongFuWheel.vue:67-70 | `.df-node__badge` |
| Backdrop production của wheel: `world-vista-warm-v1.png` | `sceneBackground` :191 → `sceneStyle` :192-196 → `:style` :418 | `<main>` — report gốc sót ảnh nền này |

### Chrome preview-only (DongFuHomeContent + siblings)
| Art | Nguồn | Element |
|---|---|---|
| `building-plaque` via `hkChromeUrl` (ui/huyenKimChrome.ts:74) | HomeContent:15 | `.df-building__plaque` :51 |
| `cultivator.png` (DONG_FU_ART, dongFuUi.ts:8) | HomeContent:74, Hud:16 | `.df-cultivator img` + `.df-portrait__art` |
| `panel-nine-slice.png` + .json slices | `DongFuArtFrame` trong `df-quest` | dongFuUi.ts:2,9; HomeContent:105 |
| `rear.png/foreground.png` vista 2 lớp parallax | DongFuVista.vue:6-8 | preview only (production dùng world-vista-warm thay thế) |
| `avatar-frame`, `identity-plate`, `resource-pill`, `icon-button-utility` qua `hkChromeUrl`/`InkNineSlice` | DongFuHud.vue:7,15,21,26 | HUD preview |
| `surface-l-drawer` qua `InkNineSlice` | DongFuBoard.vue:11 | board — **live cả hai đường** |

### Chrome production quanh wheel (global + stage art — report gốc sót)
| Art | Nguồn | Element |
|---|---|---|
| `navigation-medallion-v1.png` | `--home-nav-art` sceneStyle :195 → `::before` :538 | rail button backdrop ×21 |
| `navigation-backing-dark-v3.png` | `navBackingUrl` :197 → :447 | rail backing |
| `navigation-{id}-v2.png` ×21 | `resolveAssetUrl` :458 | rail icons |
| `navigation-landscape-seam-v1.png` | `navSeamUrl` :198 → :471 (v-if surfaceOpen) | seam khi panel che |
| `pcPaperIconUrl('character')` avatar | :422 | `home-design-avatar` |
| `pcPaperResourceUrl` crystal/jade/coin/essence | CHIP_ICON :298 → :430 | currency chips |

### Wheel B (dead)
`el-{wood,fire,earth,metal,water,primordial}.png` + `el-formation-{orbs,ring,star}.png` (tồn tại trong public/assets/ui/elements/, warm sẵn ở AssetBundleCatalog.ts:547-555), `banner-*.png` cho element tooltip (Tooltip.vue:78 `elementBannerUrl`, `<img>` :160, CSS :304-325), SVG pentagram inline (:86-88), backdrop moon/clouds/dais thuần CSS (:75-80,133-175), `PlayerPortrait` (:105 — cũng chết theo).

### Global CSS trong scope
- `tien-hiep-ui.css:65-68` `.df-scene .df-node__orb` — đè background/border/shadow của scoped orb. Specificity thật: `:is(#app,body)` lấy `#app` → selector (1,2,0) vs scoped (0,1,0) — global thắng (report gốc ghi (0,3,0), con số sai nhưng kết luận đúng). Áp cho CẢ production lẫn preview vì cả hai root đều mang class `df-scene` (DongFuStage.vue:414, DongFuFidelityScene.vue:25).
- `.df-node__label` :70 — đè label scoped.
- `.df-board` :74-79, :228-230, :260-261, :352 — 4 lớp đè lên board scoped (DongFuBoard.vue:24).
- `.df-building` :152-166 — kích thước + vị trí `!important` theo `data-df-building` id (ghi đè `building.x/y` trong model) — chỉ chạm preview.
- `.df-cultivator` :62; `.df-cultivator .player-portrait` :63-64 — **không trúng ai**: markup `.df-cultivator` chỉ chứa `<img>` thuần (HomeContent:74), PlayerPortrait chỉ sống trong cây character đã chết → 2 rule chết. `.df-vista__front` display:none :61, `.df-vista__shade` :60 — chỉ preview.
- `.df-location` :71-73, :176, :226-227; `.df-quest` :235, :270-271; `.df-resources/.df-identity/.df-progress/.df-utilities/.df-utility` :167-175 — chỉ preview.
- `tien-hiep-ui.css:197-199` `@media (prefers-reduced-motion:reduce)` → `.df-scene .df-node__orb { transition:none }` :198 — tương đương scoped :78, không đè trong điều kiện thường.
- **`tien-hiep-ui.css:381-411` "Rail over panels"** — 11 scene root overlay (`.cf-scene`,`.skill-paper-scene`,`.realm-paper-scene`,`.technique-paper-scene`,`.body-paper-scene`,`.alchemy-scene`,`.inventory-scene`,`.equipment-scene`,`.quest-scene`,`.settings-scene`,`.exploration-scene`) `pointer-events:none` + `> *` auto (:390-411). Comment :381-389: sửa rail-switching bị scene `@click.self` nuốt; hệ quả trong scope: click backdrop của MỌI panel overlay lọt xuống `onSceneClick` → `closeHomeOverlays` → **đóng luôn wheel** (wheel tự đóng, không cần CSS ẩn).
- **`pc-paper-production.css:67-69`** (import main.ts:11) — `:is(#app,body) :is(.hk-art-scene,.hk-art-scene *,...::before/::after) { box-sizing:border-box }` — áp lên TOÀN cây scene production vì root mang `hk-art-scene` (:414); preview FidelityScene root chỉ `df-scene` (:25) nên rule là production-only. (Scoped `.df-scene :deep(*)` :504 reset trùng cho scene này; rule global phục vụ mọi `.hk-art-scene` khác — vd ImperialScrollScene.)
- `.df-notice` — production có element (DongFuStage.vue:493, `data-df-ui`) + rule `.df-scene--covered :deep(.df-board), :deep(.df-notice)` ẩn khi panel che (:566-567) + `:empty{display:none}` :569. **Không có rule tương tự cho `.df-wheel`** — wheel đóng qua store nên không cần.

## 4. Conflicts / layers

1. **Hai hệ điều hướng song song trong production**: nav rail mới `home-independent-navigation` **21 item** (16 + 5 locked, DongFuStage.vue:203-208, 448-461) và wheel 10 slot (mount :480) mở CÙNG panel. Comment :5 tự ghi "command wheel stays mounted alongside (Backquote) pending its redesign" — chủ dự án biết, đang để tạm. Khác biệt: rail có feedback/inventory/exploration/production/vendor/body/technique + 5 locked; wheel có scripture_pavilion + building ids thay label scene.
2. **Global skin đè scoped skin của wheel**: orb trong game thật render `orb-frame.png`, không phải gradient scoped — code scoped :65 gần như chết (chỉ còn transition/hover/disabled của nó sống vì global không set). Hover scoped (:74) vẫn áp lên drawn frame.
3. **`DongFuHomeContent` + `DongFuFidelityScene` stale comment** (mục 1): 2 file nói production mount chung — không đúng; toàn bộ plaque building + cultivator toggle là preview-only, trong khi `commandWheelCatalog.ts:5-7` còn nói "hotspot layer va wheel cung doc catalog" — hotspot layer đó không còn trong production (stage không render `df-building`).
4. **Catalog giữ cấu trúc 4 ring, render chỉ 1 ring**: field `ring` (:14,:19) + comment 4-vòng (:77-87) là di tích layout cũ; không consumer đọc `ring`.
5. **Orb `character` không bao giờ `is-active`**: catalog :94 `target={kind:'left_panel',mode:'character'}` → `slotActive` :135 so `ui.leftPanelMode==='character'`; nhưng `openLeftPanel` route 'character'→`characterOverlayOpen`+`characterSceneTab` (ui.ts:226-241, nhánh :232-237) → `leftPanelMode==='character'` không bao giờ đúng. Rail `navActive` :269-271 đã có fix cho chính case này — wheel thiếu bản vá tương đương.
6. **`commandWheelOrbit.ts` dead module**: `getCommandWheelOrbitDirection` không ai import (chỉ manifest QA docs/qa/runs/*/manifest.json + comment frontendImportDirection.test.ts:96).
7. **`RING_3_BUILDING_IDS` dead export** (commandWheelCatalog.ts:247-250): tự nhận "hotspot layer dung chung" nhưng không có importer.
8. **Cây nhân vật cũ chết nguyên khối mở rộng** (mục 1): `CharacterPanel` + `CharacterScene` + `CharacterFigureWheel` + 7 sibling + **`PlayerPortrait`** (2 template consumer đều trong cây chết) — test `CharacterPanel.stats/betaScope.test.ts` + `PlayerPortrait.test.ts` + `b18ConsumerHonesty.qa.test.ts:190` (SSR 'cultivate' DEFECT test) vẫn chạy giữ coverage ảo cho code không render.
9. **`onWheelAction` xử lý cả board entry** (:347-359): wheel và Thiên Cơ Bảng share 1 router — entry ưu tiên trước slot (:348-352), id nào không khớp cả hai → `flashNotice(dongFu.unhandled)` :358 (producer `.df-notice` vừa là live logic vừa là cơ chế báo router nuốt id).
10. **Badge 'upgrade' không reachable trên node wheel nhưng union không chết**: type `DongFuUiAction.badge` (dongFuUi.ts:21-23) ghi rõ 'upgrade' = "(building plaques only)"; consumer thật = `DongFuUiBuilding`→`df-building__upgrade` (DongFuHomeContent.vue:55-64 + test :63-66). Phần chết: `slotBadge` (DongFuStage.vue:144-153) chỉ trả dot/alert + `DongFuWheel.vue:67-69` không có CSS `--upgrade` → trên node wheel nó unreachable.
11. **Cue `ui.wheel.select` dùng lại cho rail** (DongFuStage.vue:282): click rail nghe tiếng wheel — đúng hay nhầm tùy ý đồ audio.
12. **`selected` prop luôn null trong production** (DongFuStage.vue:482) — trạng thái `is-selected` chỉ sáng ở preview; production dùng `is-active` (slotActive :133-142).
13. **`data-wheel-slot` là test hook live, KHÔNG phải marker chết** (đính chính report gốc): 45 usage trong tests/ — 25 spec e2e (helpers.ts:113, beta-journey, create-to-combat, presentation-routing, save-reload, system-ui, ...) + `betaConsumerLeak.probes.test.ts:127` mount DongFuStage thật test badge breakthrough. Xoá = gãy hàng chục test.
14. **Hit-test wheel dạy đường đóng gián tiếp**: `.df-wheel`/`.df-node` none + orb auto → vùng trống giữa các orb cũng là "nền trống" đóng wheel (kết hợp INTERACTIVE_SELECTOR :364 + pointer-events :58-65 + rail-over-panels :381-411 cho overlay scenes).

## 5. Logic không có hình ảnh

- `commandWheelOrbit.ts` — toàn file chết (trên).
- `CommandWheelSlot.ring`, `CommandWheelRing` type (:14), `RING_3_BUILDING_IDS` (:247-250) — metadata/exports không render.
- `disabledContext.realmReleaseUnavailable` + `RELEASE_UNAVAILABLE_REASON` (catalog :75, stage :106): UI path unreachable trong beta (3 slot dùng nó — phap_bao :137, formation_slot :171, companion_roster :188 — đều bị `betaWheelSlots` lọc trước khi tới `disabledReason`); **nhưng symbol không chết hoàn toàn** — `ReleasePolicy.artifactDeferred.test.ts` import nó cho boundary suite (comment :73-74).
- `CharacterFigureWheel` toàn bộ computed (:27-67) + `PlayerPortrait` — logic đúng nhưng không mount.
- `ElementTooltipContent` (useTooltip.ts:186-199, union member :246) — producer `v-tooltip kind:'element'` duy nhất là node element trong CharacterFigureWheel (chết) → kind 'element' + `elementBannerUrl` (Tooltip.vue:78,:160) + CSS banner :304-325 chờ producer.
- `model.utilities`/`resources`/`buildings`/`quest`/`opportunities` của `DongFuUiModel` (:43-59) — chỉ preview feed; production build UI trực tiếp từ read-model riêng (currencyChips/questCard/boardEntries), chỉ tái dùng `DongFuUiAction` cho wheelActions + boardEntries map.
- `slotActive` phân nhánh `left_panel`/`standalone`/`buildingId` (:133-142) không phủ `characterOverlayOpen` → orb character không is-active (§4.5); rail `navActive` :267-278 đã vá đúng chỗ này.
- `useDialogFocus` Tab-cycle stopPropagation (:46-48, comment tự gọi tên "DongFuStage Tab toggle") né window listener của stage — phòng thủ, không render.
- `flashNotice` + `noticeTimer` (:82-95): live logic — producer `.df-notice` chỉ khi router nuốt id (mục §4.9) hoặc các caller khác; style `.df-notice:empty{display:none}` :569 che khi rỗng.
- `toggleRail`/`railIndicator`/`onRailTransitionEnd` (:71-80) — logic collapse rail; hiện « » nút (:462-479) — logic này CÓ hình (sai phân loại ở đây? không — nó là logic phụ trợ của rail, liệt kê cho đủ).

## 6. Hình ảnh không có logic

- `.df-wheel__orbit` (DongFuWheel.vue:35): vành trang trí `aria-hidden`, không ràng state.
- `pc-paper-scene__frame` (:494): overlay khung trang trí `aria-hidden`.
- `home-navigation-landscape-seam` (:471): chỉ hiện khi `surfaceOpen` — seam ảnh thuần.
- Preview-only: `df-buildings` parallax theo `--df-x/--df-y` (HomeContent :114; pointer chỉ có ở FidelityScene :17-21,:25), `df-location` thơ mộc (:92-95), `df-quest` fixture (`DongFuPreview.vue:34` hardcode `claimable:false`), `df-vista` 2 lớp + shade.
- `CharacterFigureWheel`: backdrop moon/clouds/dais CSS (:75-80), SVG pentagram (:86-88), 3 vòng formation `<img>` (:83-85), `figure-wheel__disc` (:104) — `aria-hidden` trưng bày; toàn cụm chết cùng scene.
- `DongFuArtFrame`/`InkNineSlice` chrome (df-quest :105, board :11, hud :15,21,26) — render khung vẽ, không đọc state ngoài props.
- `DongFuResourcePill.vue` + `CurrencyHud.vue`: HUD resource cũ — CurrencyHud chỉ còn mount trong `CurrencyHud.test.ts` (MaterialBagSection:129 chỉ comment; useCurrencyChips.ts:2 là comment trích nguồn) → DongFuResourcePill chết theo (:14,:31). Strip currency production giờ là `home-design-currencies` + PcPaperButton (:428-432).
- `.df-cultivator .player-portrait` rules (:63-64 global) — CSS không có DOM target (mục §3).

## 7. Open questions (cần chủ dự án quyết)

1. Wheel cũ giữ hay bỏ? Comment stage :5 nói "stays until its redesign lands" — rail đã phủ hết đích; nếu bỏ: kéo theo xoá `isCommandWheelOpen`, catalog ring/orbit, `ui.wheel.*` cues, Backquote handler — **NHƯNG giữ `data-wheel-slot` hoặc port locator test trước** (hook đang neo 25 spec e2e + arch probe).
2. Orb skin: scoped gradient (file fidelity) hay `--th-art-orb-frame` (tien-hiep-ui.css global) là chuẩn? Hiện global thắng âm thầm — nếu scoped là ý đồ, cần gỡ rule :65-68; nếu global là ý đồ, CSS scoped :65-66 nên xoá cho đỡ mâu thuẫn.
3. Xoá cây character cũ mở rộng (`CharacterPanel` + `CharacterScene` + `CharacterFigureWheel` + 7 sibling + **`PlayerPortrait`** + test đi kèm) hay giữ làm dormant? Giữ = test suite đang "bảo vệ" code chết (kể cả DEFECT test b18:190).
4. `DongFuHomeContent` + `DongFuFidelityScene` comment production-adapter sai ở CẢ HAI — sửa comment hay thật sự gắn lại vào stage (thiết kế plaque building/nút cultivator còn muốn không?).
5. Slot 'character' không bao giờ `is-active` do overlay dùng `characterOverlayOpen` không phải `leftPanelMode` — port fix `navActive` (:269-271) xuống `slotActive` (:133-142) hay chấp nhận?
6. `talisman_slot` (catalog :151-155, bound null feature) + nhánh tooltip release-hidden (RELEASE_UNAVAILABLE_REASON được test import) — giữ làm dormant có chủ đích?
7. `badge:'upgrade'` union member trên wheel node unreachable — thêm CSS `--upgrade` cho wheel hay thu hẹp union xuống building-only?

## Adjudication

Verify trên code @ 8ffc8e64, từng finding đối chiếu file:dòng trực tiếp.

### Wrong — accept 7/7

1. **`data-wheel-slot` là test hook live — ACCEPT.** Grep: 45 hit trong tests/, 25 file spec e2e (helpers.ts:113 `[data-wheel-slot="settings"]`, beta-journey, create-to-combat, presentation-routing, save-reload, system-ui, ui-audit-progression-fixed, ...), `betaConsumerLeak.probes.test.ts:21,107,127` mount DongFuStage thật + probe badge. Report gốc "marker chết" sai — đã sửa §2, §4.13, §7.1.
2. **Catalog 15 slot không phải 13 — ACCEPT.** Đếm trực tiếp: :91,:98,:105,:114,:125,:151,:161,:178,:194,:201,:208,:215,:222,:231,:239 = 15. "Live = 10" vẫn đúng (15 − 4 feature-bound − talisman NEVER_AVAILABLE).
3. **Rail 21 item không phải 20 — ACCEPT.** NAV_ITEMS :204-208 = 16 literal + `...NAV_LOCKED` 5 (:203) = 21; v-for :450 render hết.
4. **Cite ui.ts lệch — ACCEPT.** `openLeftPanel` (hàm wheel gọi qua `activateSlot` :341) nằm :226-241, nhánh 'character'→`characterOverlayOpen` :232-237. Report trích :206-216 là `toggleLeft` — hàm khác. Kết luận đúng, sửa cite §4.5.
5. **useStageActive.ts ":1-30" — ACCEPT.** File 20 dòng (route check :18-19). Nội dung claim đúng.
6. **badge 'upgrade' nuance — ACCEPT.** dongFuUi.ts:21-22 comment "(building plaques only)"; consumer `df-building__upgrade` HomeContent:55-64 + test :63-66. Union không chết — chỉ unreachable trên node wheel (slotBadge không trả + không CSS). Đã sửa §2/§4.10/§7.7.
7. **DongFuFidelityScene.vue:4-5 cùng comment sai — ACCEPT.** Verify trực tiếp: "Production mounts the same content through DongFuStage" — sai giống HomeContent:2-5. Đã thêm §1.

### Missed — accept 19/20, reject 1

1. `notice`/`flashNotice`/`noticeTimer` :82-95 + unhandled fallback :358 + `:empty{display:none}` :569 — ACCEPT (thêm §2, §4.9, §5).
2. `watch(surfaceOpen)` đóng feedbackOpen :67-69 — ACCEPT.
3. `boardOpen = ref(true)` :61 + preview `shallowRef(true)` :16 — board mở sẵn — ACCEPT.
4. Rail collapse đầy đủ: `railCollapsed`/`railIndicator` :62-63, `toggleRail` :71-76, `onRailTransitionEnd` :78-80, `@transitionend` :446, « :462-469, » :472-479, Tab :389-393 — ACCEPT.
5. `INTERACTIVE_SELECTOR` :364 + `data-df-ui` ×4 (:421,:428,:446,:493) — cơ chế click-through quyết định đường đóng wheel — ACCEPT.
6. Hit-test wheel: `.df-wheel`/`.df-node` none + `.df-node__orb` auto (:58,:64,:65) → vùng trống trong vành cũng đóng — ACCEPT.
7. Mounts sót: `AutoFarmIndicator` :38,:492; `FeedbackDialog` :37,:497 (+`feedbackOpen` :60); `pc-paper-scene__frame` :494 — ACCEPT.
8. Backdrop production `world-vista-warm-v1.png` :191 → sceneStyle :418 — ACCEPT.
9. Rail art: medallion `--home-nav-art` :195/:538; backing :197/:447; icon `navigation-{id}-v2.png` :458 — ACCEPT.
10. Currency/avatar art: `pcPaperIconUrl('character')` :422; `pcPaperResourceUrl` CHIP_ICON :298 → :430 — ACCEPT.
11. `pc-paper-production.css:67-69` box-sizing `.hk-art-scene` subtree (main.ts:11, root :414) — ACCEPT, bổ sung nuance: preview root chỉ `df-scene` (FidelityScene :25) → production-only; scoped `:deep(*)` :504 trùng chức năng cho scene này.
12. `tien-hiep-ui.css:381-411` rail-over-panels: 11 scene root `pointer-events:none` + `> *` auto — đường đóng wheel gián tiếp qua backdrop overlay — ACCEPT.
13. Reduced-motion `transition:none` :197-199; `.df-cultivator .player-portrait` :63-64 không trúng DOM nào — ACCEPT.
14. `symbolUrl` consumers sống: `usePaperNavigation.ts:17,:112` + `CharacterFidelityStats.vue:7,:28` — dongFuUi.ts không xoá theo wheel — ACCEPT.
15. `navActive` :267-278 đã vá case character (:271) mà `slotActive` thiếu — làm §4.5 sắc hơn — ACCEPT.
16. Test consumers: `ui.test.ts:15,21`, `uiAudioBinding.test.ts:68-74`, `betaConsumerLeak:21,107,127`, 25 spec e2e — ACCEPT.
17. `RELEASE_UNAVAILABLE_REASON` được `ReleasePolicy.artifactDeferred.test.ts` import (comment :73-74) — symbol không chết dù UI path unreachable — ACCEPT.
18. `DongFuBoard` mount CẢ preview (HomeContent:85-91) lẫn production (:486-491) — report §1 sót nhánh preview — ACCEPT.
19. **`PlayerPortrait` "vẫn live ở ArtifactOverview.vue" — REJECT.** ArtifactOverview.vue:4 chỉ là comment "(cung tinh than fallback cua PlayerPortrait...)", không import. Template consumer thật của `<PlayerPortrait`: chỉ CharacterFigureWheel:105 + CharacterIdentityHeader:44 — cả hai chết. Kết luận đúng hơn: PlayerPortrait **chết theo cây** (đã sửa §1, §4.8, §6, §7.3). Consumer còn lại: test riêng + b18ConsumerHonesty SSR test + comment.
20. `data-hk-scene="dong-fu"` + `hk-art-scene` attrs :414-415 — ACCEPT (hook định danh + chủ thể của rule box-sizing #11).

### Tự phát hiện thêm khi verify (không có trong report/review)

- Specificity đúng của `:is(#app,body) .df-scene .df-node__orb` = (1,2,0) (lấy max của `:is`), report ghi (0,3,0) — kết luận "global thắng" không đổi.
- `home-design-quest` :433-445 không có `data-df-ui` nhưng là `<button>` → đã nằm trong INTERACTIVE_SELECTOR.
- `AudioCueManifest` đúng đường `src/core/audio/` (report ghi "src/presentation/audio/" ngầm định sai path).
- Tooltip.vue banner: `elementBannerUrl` :78 + `<img>` :160 + CSS block :304-325 (`.tooltip__banner` :325) — report trích ":313-319" lệch khoảng.
