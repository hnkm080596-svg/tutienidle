# Panel: Nhiệm Vụ (QuestPanel + quest tracker trên home)

## 1. Mount chain — từ nav/route đến component gốc, file nào chứa gì

`App.vue:63,1293` mount `GameRoot` khi `isBooted`. `src/components/layout/GameRoot.vue`:
- `18` — `const QuestPanel = defineAsyncComponent(() => import('../panels/QuestPanel.vue'))` (lazy chunk)
- `117` — `void import('../panels/QuestPanel.vue')` warm-up lúc idle (`:110-123` requestIdleCallback)
- `77-100` — `mountedStandalone = reactive(Set)` + `watch(ui.standalonePanel, {immediate:true})`: panel standalone mount một lần khi mở lần đầu rồi giữ mounted mãi; có 2 lớp gate: `isBetaStandalonePanel(panel)` (`:85`) + riêng `'technique'` bounce kèm toast (`:89-95`)
- `140` — toàn bộ khối standalone panel nằm dưới `<template v-if="!isFullSceneActive">` (ẩn khi combat/tribulation)
- `162` — `<QuestPanel v-if="mountedStandalone.has('quest')" />`

Đường mở — tất cả đều đi qua `ui.openStandalonePanel('quest')` (`src/stores/ui.ts:243-255`: beta-gate `isBetaStandalonePanel` → `closeHomeOverlays()` → set `standalonePanel`; `closeHomeOverlays` `:258-263` clear leftPanelMode/characterOverlayOpen/standalonePanel/commandWheel; `toggleStandalonePanel` `:319-331` toggle). `'quest'` trong union `StandalonePanel` tại `src/presentation/contracts/panelIds.ts:41`; `BETA_STANDALONE_PANEL_FEATURES.quest = null` (`betaScopeSurface.ts:136`) → luôn admit.

Các cửa mở production (đã grep toàn src — chỉ 4 đường):
- **Nav rail home**: `DongFuStage.vue` — `'quest'` trong `NAV_ITEMS` (`:206`), `NAV_TARGET.quest → openStandalonePanel('quest')` (`:237`), active qua `NAV_ACTIVE_STANDALONE.quest` (`:258-265`), icon `navigation-quest-v2.png` (`:458`).
- **Quest tracker home** (thẻ góc phải trên): `DongFuStage.vue:433-445` — button `.home-design-quest`, `v-if="questCard"`, `@click="ui.openStandalonePanel('quest')"` (`:439`).
- **Command wheel** (Backquote): `commandWheelCatalog.ts:113-119` slot `quest` ring 2, `ALWAYS_AVAILABLE`, target standalone `'quest'`; `betaWheelSlots()` lọc qua `BETA_WHEEL_SLOT_FEATURES.quest = null` (`betaScopeSurface.ts:68,84-90`) — cổng beta THỨ HAI riêng cho wheel; `DongFuStage.vue:109` `renderedSlots` → `:166` `wheelActions` → `activateSlot` `:330-345` → `DongFuWheel` `:480-485`.
- **Thiên Cơ Bảng**: `useThienCoEntries.ts:81-96` — entry `id:'quest'` chỉ push khi `claimable > 0`; `claimable` đếm qua `getActiveQuests().filter(canClaimQuest)` (domain call trực tiếp, KHÔNG qua surface models); `run: openStandalonePanel('quest')`; render bởi `DongFuBoard` (`DongFuStage.vue:178-188,486-491`).

**Cửa mở hư cấu trong bản gốc (đã xoá):** `usePaperNavigation.ts`/`PaperPanelNavigation.vue` KHÔNG có consumer production nào — chỉ `src/ui-preview/paperNavigation.ts:1` + `src/ui-preview/PaperPreviewSurface.vue:6,19`. `ImperialScrollScene.vue:29-30` và `CharacterFidelityScene.vue:5-6` chỉ là comment R9; `PcPaperSceneActions.vue:5` chỉ type-import và bản thân nó không ai mount (component mồ côi chứa menu nav tới 'quest' — dead UI).

Sau store: `src/components/panels/QuestPanel.vue` (31 dòng, seam mỏng):
- `22-26` — `rows` computed touch `stateVersion` để recompute sau claim (`bumpState()`)
- `30` — `<Transition name="th-panel-swap"><QuestScene v-if="ui.standalonePanel === 'quest'" :rows="rows"/></Transition>` — panel mounted mãi nhưng scene con remount mỗi lần mở → selection/scroll/focus reset mỗi lần.

`src/components/scenes/quest/QuestScene.vue` (119 dòng) — owner thật:
- `80-102` — `<SceneDesignCanvas overlay>` (variant overlay `SceneDesignCanvas.vue:37-43` = canvas 1440×810 scale, transparent, `pointer-events:none`) bọc `<QuestFidelityScene :quests="[]" :selected="undefined" filter="all" :rewards="[]" notice="" @back="ui.closeHomeOverlays()">`, inject 3 slot: `#tabs`→`QuestGroupTabs`, `#list`→`QuestList`, `#detail`→`QuestDetailPanel`.

Read-model: `GameManagerQuestOps.ts:104-167` `getBetaQuestSurfaceModels()` — active quests → lọc `cadence==='once'` (`:122-124`) → `betaQuestSurfaceFor` (`betaScopeQuestDomain.ts:225-254` — **hardcode `cadence:'once'` :231**, không đọc từ quest data) → sort theo `mainlineChainOrder` walk (`:169-178`, chain tuyến tính → depth = thứ tự hiển thị; member walk không tới append cuối) → splice `lockedPreview` của quest chain đầu tiên không active lẫn không completed (`:154-164`, vị trí = số chain quest có model). `canClaimQuest` `:213-225`, `claimQuest` `:227-274` — claim xong gọi `reconcileActiveQuests` `:266-270` (quest kế trong chain admit ngay trong cùng gesture) + toast `Hoàn thành: {name}` `:260`.

Data: `src/data/quest/quests.ts` — 21 quest: 15 `chainId:'mainline'` (gồm cả `collect_tu_linh_thao_1`, `collect_qi_refining_ore_decade_1`; main_07 realm-gate `qi_refining` :86, main_15 gate `foundation_establishment` :168) + 6 ngoài chain (`kill_wild_wolf_10` gate qi_refining + 5 quest foundation). Daily đã xoá hẳn (`:182-186` comment).

## 2. UI logic inventory — computed/store-read/emit/directive/props feed DOM

**QuestPanel.vue**: `rows` computed (`:22`); props xuống QuestScene.

**QuestScene.vue**: `MODEL_CADENCES=['once']` (`:32`); `activeCadence` ref `'all'` (`:34`); `cadences` computed lọc cadence xuất hiện trong rows (`:36-42`); `visibleRows` filter theo cadence (`:44-48`); `selectedQuestId` + `watch(visibleRows,{immediate:true})` auto-chọn `list[0]` khi selection rơi ra ngoài (`:62-70` — KHÔNG loại row locked, xem mục 5); `selectCadence` guard id lạ (`:57-60`); `onClaim(id)` → `claimQuest` + `bumpState()` (`:72-76`).

**QuestFidelityScene.vue** (shell 77 dòng): props `quests/selected/filter/rewards/notice/preview` (`:16-23`) — production truyền literal rỗng → inert; emits `select/filter/action/back` (`:25`) — production chỉ bind `@back`; `filters=['all','once','active','ready','claimed']` (`:27`) chỉ xài trong fallback slot; `useDialogFocus(rootRef, () => true, {onEscape: emit('back')})` (`:33-34`) — open luôn true → contract đầy đủ (`useDialogFocus.ts:24-90`): **focus-on-open** (focus focusable đầu tiên `:36`), **Tab-cycle containment** (`:43-63`, preventDefault+stopPropagation — comment `:46-47` nói rõ để chặn Tab-toggle của DongFuStage), **Escape→onEscape** (`:38-41`), **document.mousedown containment** (`:73-79` — mousedown ngoài card bị preventDefault giữ focus trong scene; click vẫn fire → rail dưới vẫn đổi panel được), **restore trigger** khi đóng (`:87`) + cleanup onBeforeUnmount `:92-100`; `paper` = `paper-nine-slice.png` (`:29`); `@click.self="emit('back')"` (`:38`) — **dead** (mục 4.3).

**tabs/QuestGroupTabs.vue**: props `{cadences,active,onSelect}` (`:16-20`); pill `InkNineSlice chrome-id="seal-chip"` (`:35-41,54-60`); label `tabs.all` + `cadence.${cadence}`.

**list/QuestList.vue**: props `{rows,selectedId,onSelect}`; `firstChainRowId` computed (`:20-22`) chèn divider `.quest-list__group` 'Chính Tuyến' (`:29-31`); scrollfade mask (`:61`).

**list/QuestRow.vue**: `complete` = claimed || progress≥target (`:26-28`); `claimable` = `claim.available && !claim.claimed` (`:29`); `locked` = `lockedPreview!==undefined` (`:30`); `lockReasons` từ `afterQuestName` + `requiredRealmId`→`getCurrentRealm().name` (`:32-47`); locked row `tabindex=-1`, `aria-disabled`, click no-op (`:56-58`); class `is-selected/is-claimable/is-claimed/is-locked` (`:54`); cadence chip + chain chip `groups.mainline` + done chip (`:81-92`); state `✕/✓/n-m` (`:100-104`); `InkNineSlice` `list-row`+`seal-chip` (`:60-66,82-88`); locked row render desc = lockReasons thay mô tả (`:94-96`).

**detail/QuestDetailPanel.vue**: `InkNineSlice surface-m-panel` + `entity-bar`; `EmptyState` khi `row==null` (`:63-65`); `QuestDetailVista`, name/desc, `QuestObjectiveList`, `QuestRewardRow`, `QuestClaimCta`. Comment `:5-7`: 'Loi Dan' + 'Tiep Tuc' RESERVED.

**detail/QuestObjectiveList.vue**: `FLAG_LABEL_KEYS` map `QUEST_FLAG_ALCHEMY_CRAFTED`→`flags.alchemyCrafted` (`:20-22`); label = flag ?? `targetLabel` ?? `anyEnemy` (`:25-31`); turn-in tra `materialRegistry` (`:35-44`); `min(progress,target)/target`.

**detail/QuestRewardRow.vue**: `Array.isArray` guard (`:29`); icon `materialRegistry/pillRegistry.get().icon` (`:37-46`); label = `reward.name` ?? `panels.quest.rewards.${kind}` (`:48-51`); fallback token art-needed `reward-icon` (`:70`); `x{{formatNumber}}` (`:71`).

**detail/QuestClaimCta.vue**: `claim/claimed/disabled` (`:21-23`); `note` = `bagShortfall` khi `disabledReason==='missing-turnin-items'` && có turnIn, `reasonIncomplete` khi `'incomplete'` (`:25-36`); `GameButton size="lg"` label `Đã Nhận`/`Nhận Thưởng` (`:42-49`).

**detail/QuestSectionPlaque.vue**: h3 + `InkNineSlice section-plaque` layer='frame' + text (44 dòng).

**DongFuStage.vue (chrome live)**: `surfaceOpen` = leftPanelMode||characterOverlayOpen||standalonePanel (`:56-58`); `watch(surfaceOpen)` auto-đóng FeedbackDialog khi panel mở (`:67-69`); `noticeTimer` setTimeout 3.2s (`:83-95`); `trackedQuest` = model claim.available đầu tiên hoặc `models[0]` (`:309-313`); `questCard` {name,`n/m`,claimable,percent} (`:315-325`); `window.addEventListener('keydown',onKeydown)` (`:403-408`): Escape→closeCommandWheel (`:381-384`), Tab→toggleRail và Backquote→toggleCommandWheel đều gate `!stageActive && !surfaceOpen` (`:389-400` — wheel/rail không mở khi quest đang che); `onSceneClick` (`:366-369`) click trúng vùng trống (không `button,a,input,...,[data-df-ui]`) → `closeHomeOverlays()` — đây là backdrop-dismiss THẬT thay cho `@click.self` chết của scene.

**Dormant/preview-only**: `QuestFidelityDetail.vue` + `questUi.ts` (`QuestDisplay` fixture interface) — chỉ fallback slot; `DongFuHomeContent.vue:96-109` `.df-quest` tracker cũ (mount bởi `DongFuFidelityScene` ← `ui-preview/DongFuPreview.vue:4,42`); `PaperPanelNavigation.vue`/`usePaperNavigation.ts`/`PcPaperSceneActions.vue` — rail nav scene-preview, không production caller; `PcPaperLandmark.vue` — component mồ côi khác (cùng họ icon `pcPaperIconUrl`); `QuestObjectiveArt.vue`, `HomeQuestArtPanel.vue`, `QuestPreview.vue`/`quest.ts` — chuỗi preview.

## 3. Art map — file art + element dùng

| Art | Đường dẫn | Element |
|---|---|---|
| Khung giấy panel | `/assets/ui/huyen-kim/scene/character-v2/paper-nine-slice.png` | `.quest-paper` inline `borderImageSource` (`QuestFidelityScene.vue:29,39`) — art mượn từ scene character |
| Nền giấy trong | `var(--th-art-paper-surface)` (qua `::before` :278-280) | `.quest-paper::before` global |
| Viền giấy | `border-image: inherit` → cùng PNG trên vẽ LẶP LẠI một lần nữa | `.quest-paper::after` (`tien-hiep-ui.css:256`) |
| Row surface | `/assets/ui/tien-hiep-2026-10/runtime/list-row@2x.png` | `InkNineSlice chrome-id="list-row"` (`QuestRow.vue:60-66`) — manifest READY |
| Cadence chip / tab pill | `runtime/seal-chip@2x.png` | `QuestRow.vue:82-88`, `QuestGroupTabs.vue:35-41,54-60` — READY |
| Detail surface | `runtime/surface-m-panel@2x.png` | `QuestDetailPanel.vue:31-37` — READY |
| Detail head bar | `runtime/entity-bar@2x.png` | `QuestDetailPanel.vue:44-50` — READY |
| Section plaque | `runtime/section-plaque@2x.png` | `QuestSectionPlaque.vue` — READY |
| Nút claim | `runtime/button-ceremonial@2x.png` | `GameButton size="lg"` trong `QuestClaimCta` |
| Ribbon cadence — **READY nhưng không ai dùng** | `runtime/ceremony-ribbon@1x/2x.png` (`huyen-kim-chrome.json:806-815`, `AssetBundleCatalog.ts:608`, `pack.json:173-174`) | không consumer — có thể phục vụ `quest-cadence-ribbon` |
| Glyph quest | `/assets/ui/huyen-kim/symbols/quest.svg` — **2 cơ chế**: (a) CSS mask tint `currentColor` qua `HuyenKimSymbol` — `QuestRow.vue:76` thumb, `QuestDetailVista.vue:22` vista mark; (b) `<img :src="symbolUrl('quest')">` (`dongFuUi.ts:12-13`) — `DongFuWheel.vue:51`, `DongFuBoard.vue:16`, tracker cũ `DongFuHomeContent.vue:106` kèm `filter: invert(87%) sepia(41%) saturate(480%) hue-rotate(350deg)` | xem trái |
| Vista detail | **không có art** — CSS gradient jade ridgeline + gold halo | `.quest-detail-vista__art` art-needed `quest-vista` (`QuestDetailVista.vue:17-22,42-50`) |
| Ribbon cadence (DOM) | **không có art** — CSS `var(--cinnabar)` + `writing-mode:vertical-rl` + clip-path | `.quest-detail-vista__ribbon` art-needed `quest-cadence-ribbon` (`QuestDetailVista.vue:23-27`) |
| Thumb row | **không có art** — tile jade + glyph | `.quest-row__thumb` art-needed `quest-row-thumb` (`QuestRow.vue:71-76`) |
| Reward icon | `materialRegistry.get(itemId).icon` / `pillRegistry` (`/assets/materials/*`, `/assets/pills/*`); fallback token chữ art-needed `reward-icon` | `QuestRewardRow.vue:37-70` |
| Icon nav production | `/assets/ui/tien-hiep-2026-10/icons/navigation-quest-v2.png` | nav rail `DongFuStage.vue:458` |
| Icon quest đời cũ | `/assets/ui/tien-hiep-2026-10/icons/quest.png` — trong `PC_PAPER_ICON_PATHS` (`PcPaperIcons.ts:3-9`); **không render production** (nav dùng v2), render ở preview: `PaperArchetypePreview.vue:16`, `LandscapeDesignPreview.vue:54`, `CollectionCraftDesignPreview.vue:61` | `pcPaperIconUrl('quest')` |
| Chrome rail home | `navigation-medallion-v1.png` (`--home-nav-art` `:195`), `navigation-backing-dark-v3.png` (`:197`), `navigation-landscape-seam-v1.png` (`:198`, chỉ hiện khi `surfaceOpen` `:471`), bg `world-vista-warm-v1.png` (`:191`) | `.home-design-quest` nằm trong cụm chrome này |
| Title plaque | `var(--th-art-title-plaque)` | `.quest-title` — rule thắng `:99-103` (mục 4.1) |
| Preview-only | fixture `dong-fu-v2/rear.png` làm ảnh quest (`finalPreviewFixtures.ts:9`), reward icon `linh_khoang.png`+`tu_linh_dan.png` (`QuestPreview.vue:14`); medallion/banner/objective art `HomeQuestArtPanel.vue`; `navigation-medallion-v1.png` trong `QuestCategoryArtButton` | `/legacy/ui-quest.html`, `LandscapeDesignPreview.vue:66` |

## 4. Conflicts / layers — hai phiên bản UI cùng tồn tại

1. **`.quest-title` — 4 rule (không phải 3)**: scoped `QuestFidelityScene.vue:56` (left:235,top:165,font 32/700,#35250f,text-shadow) vs global `:358-361` (`:is(#app,body) :is(.equipment-title,.quest-title,...)` — left:207,top:151,#30210f,bg none,35px) vs `:135-148` (`:is(#app,body) .quest-title` — font 72px,color:transparent,gradient+`background-clip:text`,shine) vs `:99-103` (`:is(#app,body) .quest-scene .quest-title` — left:192,top:97,370×58,pad 11/40,font 30,#f3e0b5,center,`background:var(--th-art-title-plaque)`,z-6). Specificity: `:99` = 1-2-0 **thắng toàn bộ** geometry+color+font-size+background (cả shorthand lẫn `background-clip` — bị reset về border-box, KHÔNG clip vào chữ). Còn lại chỉ sống: `font-family:'UTM OngDoGia'` + `font-style/weight` từ `:135`, `animation:th-title-shine` (áp dụng nhưng **inert** — bg-size 100%×100% không pan được; reduced-motion tắt ở `:148`), `text-shadow` từ scoped. Kết quả live: plaque PNG + chữ vàng phẳng 30px UTM — máy gradient/shine chỉ là dead payload.

2. **`.quest-paper` — 6 cụm rule**: scoped `:55` (left:94,top:123,w1334,h633,`border-image-slice:300 fill`,width 83px,drop-shadow) vs global `:25-27` (spec 1-2-0: left:156,w1272,border-image-width:52px), `:177-180` (1-1-0: `border-image-slice:240 320` — **mất `fill`** → miếng giữa bị bỏ, + background gradient+world-vista), `:253` (1-1-0, sau → `background:transparent` ghi đè :177 + `isolation:isolate`), `:254-255` (`::before`: inset 14px,radius 20px,bg gradient+vista,z -1 → `:255` sửa z → -2), `:256` (`::after`: inset 0,`border-image:inherit` → **vẽ lại đúng khung nine-slice lần 2** trùng element), `:278-280` (`::before` bg → paper-surface repeat), `:344-346` (`::before` inset → 2px, radius → 3px). Net: khung PNG vẽ 2 lần (element + ::after), nền paper-surface trong ::before.

3. **`.quest-scene` pointer-events**: scoped `:53` `pointer-events:auto` + `@click.self` (`:38`) vs global `:390-411` — `.quest-scene{pointer-events:none}` + `> *{pointer-events:auto}`. Root không bao giờ là click-target → `@click.self` **dead**; backdrop click rơi xuống `DongFuStage.onSceneClick` `:366-369` cũng `closeHomeOverlays()` — cùng outcome, wiring trong scene là dead code. Đây là **pattern R9 áp cho cả 11 scene class** (cf/skill/realm/technique/body/alchemy/inventory/equipment/quest/settings/exploration — comment `:381-389`), không phải quest lạc loài.

4. **QuestFidelityScene dual-mode**: production fill đủ 3 slot → toàn bộ fallback DOM chết: `nav.tabs` 5 filter `all/once/active/ready/claimed` (`:43`), `.quest-list` fixture `<img :src="quest.image">` (`:44`), `QuestFidelityDetail` (`:44` — file dormant, dùng `VictoryFidelityRewards`), props `quests/selected/filter/rewards/notice/preview` + emits `select/filter/action` không ai nghe trong production. Hai implementation list+detail cùng class `.quest-list`/`.quest-detail` (scoped tách nhưng trùng tên — dễ nhầm khi đọc CSS chết).

5. **2 quest tracker song song**: live `.home-design-quest` (`DongFuStage.vue:433-445` + scoped `:552-558`) vs dormant `.df-quest` (`DongFuHomeContent.vue:96-109` + scoped `:140-145`) — production `DongFuStage` mount `DongFuWheel`/`DongFuBoard` trực tiếp, KHÔNG mount `DongFuHomeContent` (chỉ `DongFuFidelityScene` ← `DongFuPreview.vue` xài). CSS global cho tracker cũ còn: `tien-hiep-ui.css:235` (bg đặc + border) tự bị `:270-271` xoá (bg transparent + `::before` paint) — dead cùng component. `DongFuWheel`/`DongFuBoard` chính chúng cũng mount kép: live trong stage + dormant trong HomeContent (`:76-85`).

6. **2 sheet CSS reskin chết — chết kép**: `tien-hiep-outcomes.css` (`:3-31` — layer `.quest-scene.th-outcome-surface`: `display:none` trên `.quest-row>.ink-nine-slice` `:8`, `.quest-detail__surface` `:14`, `.quest-detail__head>.ink-nine-slice` `:20`, `.quest-section-plaque>.ink-nine-slice` `:27`; inject `--th-art-world-vista-warm` vào `.quest-detail-vista__art` `:17`; override pill/row/objective `:7-31`) và `tien-hiep-collections.css` (`:209-210` style `.quest-preview`/`.quest-notice`, `:258-280` `.pc-collection` quest overrides + `--pc-inspector-art`). `main.ts:5-11` chỉ import 7 sheet (không có 2 file này); **và không file .vue/.ts nào gán class `.th-outcome-surface`/`.pc-collection`** — chết cả ở lớp import lẫn lớp selector. Đây là cả một phương án reskin thứ hai bị bỏ dở.

7. **Cadence strip vô nghĩa**: `MODEL_CADENCES=['once']` (`QuestScene.vue:32`) + `betaQuestSurfaceFor` hardcode `cadence:'once'` (`betaScopeQuestDomain.ts:231`) → `QuestGroupTabs` chỉ render 'Tất Cả' + 1 pill 'Một Lần' lọc về cùng list; `selectCadence` guard (`:57-60`) là nhánh không-thể-xảy-ra. Locale `panels.quest.groups.daily`/`groups.once` dead keys — chỉ `groups.mainline` được render (2 chỗ: `QuestList.vue:30` divider + `QuestRow.vue:91` chain chip). Preview `questPreview.*` có groups Ngày/Tuần/Thành Tựu — không nguồn production.

8. **Giữ-alive nửa vời**: `QuestPanel` mounted mãi (`GameRoot.vue:77-100`), `QuestScene` `v-if` remount mỗi lần mở → selection + scroll + focus reset; chỉ giữ lại warm chunk + focus-restore của `useDialogFocus`. `th-panel-swap` transition (`tien-hiep-ui.css:373-379`) diễn giữa các panel.

9. **Chrome khi quest mở**: `.df-scene--covered` (`DongFuStage.vue:416` khi `surfaceOpen`) ẩn `.df-board`+`.df-notice` (`:566-567`) → entry quest trên Thiên Cơ Bảng biến mất lúc panel mở; nhưng `.home-design-quest` tracker + rail vẫn hiển thị/bấm được bên dưới (scene root pointer-events:none cho click xuyên qua) — tracker click lúc này gọi `openStandalonePanel('quest')` lại = no-op.

## 5. Logic không có hình ảnh — logic/state không render ra gì

- `QuestFidelityScene` props `quests/selected/filter/rewards/notice` + emits `select/filter/action` + `filters[]` + `preview` — inert trong production (props literal rỗng, emit không ai nghe).
- `useDialogFocus` trên quest scene (`() => true`): focus-on-open, Tab-cycle, mousedown containment, restore-trigger — toàn bộ listener sống nhưng vô hình (chỉ Escape có hiệu ứng nhìn thấy: đóng panel).
- `selectCadence` guard cadence lạ (`QuestScene.vue:57-60`) — dead branch; `cadences` computed (`:36-42`) luôn ≤1 phần tử.
- `betaQuestSurfaceFor` hardcode `cadence:'once'` (`:231`) — cột cadence trên model là hằng, không phải data.
- `useThienCoEntries.ts:81-96` — chỉ render khi `claimable>0` (đúng thiết kế, logic không hình khi 0).
- `QuestRow` `aria-pressed`/`aria-disabled`/`tabindex=-1` (`:55-57`) — a11y state trên row locked: không focus, không click.
- `lockedPreview` detail-side **không hoàn toàn vắng**: watcher `QuestScene.vue:62-70` auto-chọn `visibleRows[0]` không loại locked → khi splice đặt preview ở index 0 (không còn chain quest nào có model — vd đã claim hết chain hiện tại, `GameManagerQuestOps.ts:158-163`), detail render đúng row locked: name/desc/objectives/rewards + CTA 'Nhận Thưởng' disabled + note 'Chưa đủ tiến độ mục tiêu' — **nhưng lý do khoá (afterQuestName/realm) chỉ render ở row, detail không đọc `lockedPreview`** (`QuestDetailPanel`/`QuestClaimCta` không ref tới field). Click row locked không mở detail được (`QuestRow.vue:58`) — chỉ vào được qua auto-select index 0.
- `data-hk-region`/`art-needed`/`data-art-id` markers — hook tooling, không render.
- `questCard.claimable` chỉ thêm glow `.is-claimable` (`DongFuStage.vue:552-558`); click tracker **mở panel chứ không claim**.
- `trackedQuest` fallback `models[0]` (`:309-313`): nếu list chỉ còn row lockedPreview (claim hết), tracker vẫn hiện quest bị khoá `0/N` — edge case.
- `th-title-shine` animation trên `.quest-title` — áp dụng nhưng inert (plaque bg-size 100% không pan); `DongFuStage` keydown Tab/Backquote gate `!surfaceOpen` (`:389-400`) — tồn tại nhưng câm khi quest mở; `watch(surfaceOpen)` đóng FeedbackDialog (`:67-69`).

## 6. Hình ảnh không có logic — art/DOM trưng bày, unwired

- `.quest-row__thumb` (`QuestRow.vue:71-76`): tile + glyph chung cho mọi row — không theo quest; art-needed `quest-row-thumb`.
- `.quest-detail-vista__art` + `__ribbon` (`QuestDetailVista.vue:17-27`): placeholder gradient + ribbon chữ; art-needed `quest-vista`/`quest-cadence-ribbon` (trong khi `ceremony-ribbon` READY nằm sẵn trong manifest, không ai wire).
- `quest-rewards__token` (`QuestRewardRow.vue:70`): token chữ khi reward không icon — placeholder.
- `.quest-notice` (`QuestFidelityScene.vue:48`): `role="status"` luôn rỗng production. `.quest-preview` (`:47`): `v-if="preview"`, production không truyền → chết.
- Preview harness: `QuestPreview.vue`/`quest.ts` (route `/legacy/ui-quest.html` ← `previewRoutes.ts:2`; entry html `legacy/ui-quest.html` → `quest.ts` import `tien-hiep-ui.css` nên cascade global y hệt), `questFixtures` `<img>` per-quest (`finalPreviewFixtures.ts:9` rear.png), `HomeQuestArtPanel.vue` (mock 3 cột medallion + energy-tube, mount tại `LandscapeDesignPreview.vue:66`), `QuestObjectiveArt.vue` (chỉ HomeQuestArtPanel xài), `QuestFidelityDetail.vue`.
- `LandscapeDesignPreview.vue:59` mock `.home-design-quest` thứ hai (`<aside>` non-interactive + scoped `:97-100` copy styles) + `:54` tools row icon quest; `PaperArchetypePreview.vue:16` icon quest; `CollectionCraftDesignPreview.vue:61` icon quest trên quest rows.
- `QuestCategoryArtButton.vue` — tên quest nhưng generic; consumer production duy nhất `SettingsNavRail.vue:5,33` (scene Settings); còn `HomeQuestArtPanel.vue:26` + `HomeSupportArtPanel.vue:19` (preview).
- `PaperPanelNavigation.vue` + `usePaperNavigation.ts` + `PcPaperSceneActions.vue` + `PcPaperLandmark.vue` — rail/landmark machinery, 0 consumer production.
- `panels.quest.groups.daily`/`groups.once`, `questPreview.*` locale keys — không DOM production đọc.

## 7. Open questions — cần chủ dự án quyết

1. `tien-hiep-outcomes.css` + `tien-hiep-collections.css`: lớp reskin quest thứ hai bị bỏ dở (không import + class gốc `.th-outcome-surface`/`.pc-collection` không ai gán) — xoá file hay còn dùng cho pass sau?
2. `.df-quest` tracker cũ trong `DongFuHomeContent` (+ `.df-quest` global :235/:270-271): giữ lại layout đó hay tracker chuẩn giờ là `.home-design-quest`? Kèm `DongFuWheel`/`DongFuBoard` mount kép trong HomeContent.
3. `QuestFidelityScene` giữ interface fixture phục vụ `/legacy/ui-quest.html` — tách component preview riêng hay chấp nhận production truyền props rỗng + emit không ai nghe?
4. Cadence strip: `MODEL_CADENCES=['once']` + domain hardcode `cadence:'once'` — pin tạm chờ daily/weekly quay lại, hay bỏ hẳn pill row?
5. Tracker click = mở panel (không claim trực tiếp) — đúng ý đồ? Nếu có, thêm nút claim nhanh khi `claimable`?
6. Row `lockedPreview`: hiện trong list, không click được, nhưng vẫn lọt vào detail khi đứng index 0 (auto-select) — và detail không hiển thị lý do khoá. Muốn detail hiện `lockedAfter`/`lockedRealm` + ẩn CTA 'Nhận Thưởng' disabled không?
7. `.quest-title`: cascade hiện cho plaque + chữ vàng phẳng (phần gradient/shine của `:135` chết gần hết — chỉ còn font + animation inert). Ý đồ cuối là giữ plaque, hay gỡ hẳn rule `:135-148`/`:358-361` cho sạch?
8. `ceremony-ribbon` READY trong manifest nhưng không consumer — wire vào `quest-cadence-ribbon` luôn hay chờ art riêng của Minh?
9. `icons/quest.png` (đời cũ) chỉ còn preview dùng qua `pcPaperIconUrl` — giữ trong `PC_PAPER_ICON_PATHS` preload hay tách?

## Adjudication

Verify lại từng Missed/Wrong của reviewer trên code @ `devin/artui-c0-foundation` (clone mới, grep + đọc file trực tiếp):

**Missed 1 — rail preview-only: ACCEPT.** `usePaperNavigation`/`PaperPanelNavigation` chỉ còn trong `src/ui-preview/*`; 3 'mount' là comment R9 (`ImperialScrollScene.vue:29-30`, `CharacterFidelityScene.vue:5-6`) hoặc type-import (`PcPaperSceneActions.vue:5`). Cửa mở thứ 5 trong bản gốc là hư cấu → đã xoá khỏi mount chain.

**Missed 2 — `PcPaperSceneActions.vue` mồ côi: ACCEPT.** grep toàn src: 0 importer; nó chứa đường nav tới 'quest' nhưng bản thân là dead UI → ghi vào dormant.

**Missed 3 + Wrong 4 — pattern rail-less uniform: ACCEPT.** Rule `pointer-events:none` root + `> *` auto áp cho cả 11 scene class (`tien-hiep-ui.css:390-411`), comment R9 giải thích rõ; quest đi theo pattern chung, không phải ngoại lệ → viết lại mục 4.3 + xoá claim 'khác hẳn siblings'.

**Missed 4 — `.quest-title` có 4 rule: ACCEPT.** `:358-361` tồn tại (`:is(.equipment-title,.quest-title,...)`, spec 1-1-0 — thua `:99` 1-2-0 trên mọi property).

**Missed 5 — `.quest-paper` sót 3 cụm rule: ACCEPT.** `:177-180` (slice 240 320 — kèm phát hiện thêm: mất `fill` so với scoped `300 fill`), `:253-255` (bg transparent + ::before z-2), `:344-346` (::before inset 2px/radius 3px). Bản gốc cũng sót `::after` vẽ lặp khung.

**Missed 6 — collections.css `:209-210`: ACCEPT.** Style `.quest-preview`/`.quest-notice` trong `.pc-collection`; sheet vẫn chết (không import + class không ai gán — chết kép).

**Missed 7 — `useDialogFocus` tả thiếu: ACCEPT.** `useDialogFocus.ts:24-90` có focus-on-open, Tab-cycle, mousedown containment, restore-trigger — không chỉ Escape.

**Missed 8 — listener/timer DongFuStage: ACCEPT.** `window keydown :403-408` (Backquote wheel, Tab rail — cả hai gate `!surfaceOpen`), `watch(surfaceOpen) :67-69`, `noticeTimer :83-95`, `onSceneClick :366-369` là backdrop-dismiss thật.

**Missed 9 — `.df-scene--covered`: ACCEPT.** `:566-567` ẩn board+notice khi surfaceOpen; tracker+rail vẫn clickable bên dưới; tracker re-click = no-op.

**Missed 10 — `BETA_WHEEL_SLOT_FEATURES.quest=null` :68: ACCEPT.** Cổng beta thứ hai cho wheel slot.

**Missed 11 — art sót: ACCEPT có sửa.** `ceremony-ribbon` READY-unused ✓; fixture `linh_khoang`+`tu_linh_dan` ✓. **NHƯNG** claim '`icons/quest.png` không ai ref' là sai: nó nằm trong `PC_PAPER_ICON_PATHS` và render qua `pcPaperIconUrl('quest')` ở 3 preview (`PaperArchetypePreview:16`, `LandscapeDesignPreview:54`, `CollectionCraftDesignPreview:61`) — đúng phải nói 'không render production' chứ không phải orphan.

**Missed 12 — preview khác chứa quest UI: ACCEPT** (+ tự bổ sung `CollectionCraftDesignPreview:61` và scoped `.home-design-quest` copy `:97-100` trong LandscapeDesignPreview).

**Missed 13 — `quest.svg` 2 cơ chế: ACCEPT.** Mask `currentColor` (HuyenKimSymbol) vs `<img>` + filter invert/sepia (wheel/board/tracker cũ).

**Wrong 1 — mount chain rail: ACCEPT** (cùng Missed 1).

**Wrong 2 — cascade `.quest-title`: ACCEPT phần chính, REJECT chi tiết.** Đúng là `:99-103` thắng geometry+color+font-size+background (gradient thua) — sửa lại mục 4.1. Nhưng claim 'plaque bị clip vào trong nét chữ' của reviewer là sai: `background-clip:text` ở spec 1-1-0 thua shorthand `background` của `:99` (1-2-0) → clip về border-box, plaque vẽ như khung thường. Thứ thật sự sống từ `:135`: font-family UTM OngDoGia + animation th-title-shine (inert vì bg 100%×100% không pan) + font-weight 400 (thắng scoped 700); scoped chỉ còn `text-shadow`.

**Wrong 3 — 'không bao giờ thấy lockedPreview' quá tuyệt đối: ACCEPT.** Watcher `QuestScene.vue:62-70` auto-chọn `list[0]` không lọc locked; splice index = số chain quest có model → preview đứng index 0 khi không còn chain quest active → detail render (CTA disabled, không lý do khoá). Giữ chi tiết đúng của bản gốc: click row vẫn no-op và detail không đọc `lockedPreview`.

Tự bổ sung (không nằm trong findings): `betaQuestSurfaceFor` hardcode `cadence:'once'` (:231) — strip cadence vô nghĩa ở cả tầng domain; `claimQuest → reconcileActiveQuests` (:266-270) admit quest kế ngay trong claim; `useThienCoEntries` đếm claimable qua `getActiveQuests`+`canClaimQuest` chứ không qua surface models; main_07/main_15 là mainline realm-gated (lý do khoá realm tồn tại trong chain); `PcPaperLandmark.vue` mồ côi; `HomeSupportArtPanel.vue:19` cũng xài `QuestCategoryArtButton`.
