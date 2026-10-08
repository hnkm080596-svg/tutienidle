# Panel: Tooltip hệ thống

Phạm vi audit: `game/` trên branch `devin/artui-c0-foundation` (HEAD 8ffc8e64). Hệ tooltip DOM toàn cục (`v-tooltip` + `useTooltip` + `Tooltip.vue`) là đường live chính; ngoài ra còn 2 hệ song song: `.gear-tooltip` (fixture/dormant) và `StatusTooltip` (canvas Phaser, live trong combat). Bản này đã qua adjudication — mọi claim kiểm lại trên code; sửa chữa/bổ sung so với bản gốc ghi ở mục Adjudication cuối.

## 1. Mount chain — từ nav/route đến component gốc

- `main.ts:5-11` CSS load order: theme → huyen-kim.tokens → system-theme → tien-hiep-ui → tien-hiep-secondary-ui → tien-hiep-auxiliary → pc-paper-production. `pc-paper-production.css:1` `@import './pc-paper-scene.css'` → `pc-paper-scene.css:1` `@import './pc-paper-type.css'` → thực tế 9 stylesheet vào production bundle. `pc-paper-scene.css` còn được import trực tiếp bởi `PcPaperChrome.vue:2`, `PcPaperDialog.vue:3`, `PcPaperScene.vue:2`, `DongFuStage.vue:33`.
- `main.ts:59` `installTienHiepUiAssets(document.documentElement)` set `--th-art-*` (`TienHiepUiAssets.ts:25-30`) + `--pc-*` (`PcPaperControls.ts:8-16`) lên root. `main.ts:66` `app.directive('tooltip', vTooltip)` (import ở :13).
- `App.vue:1253-1265` nhánh auth/character-creation → `components/onboarding/OnboardingStage.vue:49` mount `<Tooltip contained/>` (Teleport `:disabled="contained"`, render in-place).
- `App.vue:1293` nhánh booted → `components/layout/GameRoot.vue` — `GameRoot.vue:24` import, `:180` mount `<Tooltip/>` (sau overlay combat/tribulation, trước `ToastContainer` :182). State tooltip singleton (module refs trong `useTooltip.ts`) nên 1 instance phục vụ mọi `v-tooltip`; hai mount point không bao giờ cùng render (nhánh App.vue loại trừ nhau).
- Bên trong GameRoot: `:150` `<FunctionOverlayPanel/>` → `:114` `<StageSelectPanel v-if="paperMode==='stage_select'">` → `ExplorationSurface:457` → `ExplorationFidelityScene:30` → `ExplorationPaperDetails` (reward tooltip endpoint); `:116` `<EquipmentHallPanel v-else-if="paperMode==='equipment_hall'">` → `:15` `<EquipmentSurface/>`. `LeftPanel.vue:17` → `CharacterSurface` → `CharacterFidelityScene` (stat + talent tooltips). Standalone panels lazy-load `GameRoot.vue:15-23` (SkillPath/Realm/QuanKhi/Quest/Artifact/TranPhap/Companion/Technique/Body) + `InventoryPanel.vue:12` → `InventorySurface` → `InventoryFidelityScene` (`.item-detail` live).
- Equipment tooltip path: `EquipmentSurface.vue:159` → `EquipmentPaperdollStage.vue:28` → `components/panels/EquipmentPaperdoll.vue`. `EquipmentSurface.vue` override toàn bộ slot của `EquipmentFidelityScene` (#doll :157, #summary :163, #tabs :174, #workspace :189) → default fixture (`EquipmentPaperItem`, `EquipmentPaperTooltip`) không render trong production.
- ui-preview (harness thiết kế): `CharacterPreview.vue:97`, `ExplorationPreview.vue:78`, `SecondaryPreview.vue:65` mount `<Tooltip/>`; `EquipmentPreview.vue` KHÔNG mount Tooltip và `ui-preview/equipment.ts` KHÔNG đăng ký `vTooltip` → hệ DOM tooltip vắng mặt ở equipment preview; `.gear-tooltip` chỉ sống ở đây. `ui-preview/auxiliary-design.ts` không import css nào.
- Preview css coverage: `character.ts:8-11`, `exploration.ts:7-10`, `equipment.ts`, `dong-fu.ts:7-10`, `alchemy.ts`, `body.ts`, `combat.ts`, `defeat.ts` chỉ import theme+tokens+tien-hiep-ui+secondary (thiếu system-theme + auxiliary + pc-paper-production); `secondary.ts:13-18` có thêm system-theme + auxiliary (chỉ thiếu pc-paper-production) → skin tooltip preview khác production ở nhiều mức.
- Combat (hệ riêng, không qua DOM tooltip): `game/scenes/combat/combat-vfx-spawner.ts:73-76,207` lazy-tạo `StatusTooltip` (`combat-status-tooltip.ts`) khi hover status icon.

## 2. UI logic inventory — mọi computed/store-read/emit/directive/props đang feed DOM

**Core plumbing**
- `composables/useTooltip.ts` (326 lines): union `TooltipContent` 8 kind — `plain` (kind optional :9-15), `technique` :57, `material|pill|talisman|formation` :83-84, `equipment` :128, `building` :164-178, `element` :186, `stat` :205, `talent` :222. Singleton refs `content`/`reference`/`ownerElement`/`hideTimer`; `TOOLTIP_HIDE_DELAY_MS = 30` :267. `showTooltip(value, owner, _immediate)` :274 — `_immediate` được directive truyền (3 args, `tooltip.ts:77`) nhưng body không đọc, `commit()` luôn chạy ngay. `showTooltip` cũng gắn `owner.setAttribute('aria-describedby','global-tooltip')` :282, gỡ ở :278 (owner cũ), :303 (hide commit), :320 (dismiss) → hệ live CÓ liên kết a11y host↔tooltip. `updateTooltip` chỉ ghi khi `ownerElement === owner` :288-292; `hideTooltip(owner, immediate)` delay 30ms :294-314 (immediate thật sự được dùng ở đây); `dismissTooltip` clear hết :316-322.
- `directives/tooltip.ts` (128 lines): `vTooltip` giữ bindings trong `WeakMap` :25. `keyboardModality` (:32) gate `focusin` — keydown Tab → true, pointerdown/mousedown → false (:40-44, capture=true) → focusin tooltip chỉ hiện khi đi bằng phím. Ba document listener này bind MỘT LẦN (`modalityBound` :33) và không bao giờ remove — permanent listener suốt vòng đời app (by design cho singleton; vẫn là live listener đáng ghi nhận). 5 element listener :91-95 (pointerenter/leave, focusin/out, keydown); Escape → `dismissTooltip` :85; `updated()` :98-105 luôn sync `state.value` nhưng chỉ `updateTooltip` khi `binding.value` truthy — edge: value v-tooltip chuyển falsy lúc card đang mở → card giữ nội dung cũ tới khi pointerleave/focusout; `unmounted()` :107-126 gỡ listener + `hideTooltip(el, true)`; `normalize()` :47-49 biến string thành `{description}`; `onPointerEnter` :64-70 guard `!state.value` → host value falsy không hiện gì.
- `components/common/Tooltip.vue` (331 lines): props `{contained:false}` :13. Computed `cardContent` (material/pill/talisman/formation/equipment → `ItemCardBody` :20-34), `comparePair` (:39-44 — equipped LEFT/viewing RIGHT), `techniqueContent`/`statContent`/`talentContent` :48-57, `visibleSections` (chỉ technique+stat :58-60), `maxWidthForKind` :66-71 (equipment 380 / element 300 / rich 320 / plain 240; pair 800 :97 — bind inline `maxWidth` qua size() middleware :91-99), `elementBannerUrl` :76-80, `qualityAccentColor` (`--grade-{qualityKey}` :120-123), `itemAuraColor` :130-139. `useFloating` :82-103 placement `right-start` (contained → `left-start` :84), strategy `fixed` (contained → `absolute` :85), offset 10, flip, shift padding 12, size middleware, `whileElementsMounted: autoUpdate` :86 — floating-ui subscribe scroll/resize/ResizeObserver chừng nào tooltip mở (live listener). z-index `OVERLAY_LAYERS.tooltip = 2200` (`core/presentation/OverlayLayers.ts:38`). Render `#global-tooltip` :152 qua Teleport→body (:148), `role="tooltip"` :154, `data-contained` :156, Transition `tooltip-fade`. Pair a11y: `role="group"` + `aria-label` equipped/viewing trên 2 card wrapper :167-171, label qua `i18n.global.t` :107-108. `InkNineSlice` `frame-xs-tooltip` :161 chỉ render `v-else-if="!contained"` (contained KHÔNG có nine-slice frame). Scoped css `.tooltip` + `--rich/--detailed/--aura` + `--element-*` + `[data-contained]` + fade.
- `.tooltip` scoped :252-258: `pointer-events: none` (card không bao giờ hover được → `TOOLTIP_HIDE_DELAY_MS=30` chỉ là cross-gap tolerance giữa 2 slot kề nhau) + `isolation: isolate` (load-bearing: giữ `::after { z-index:-1 }` của `secondary-ui.css:129` nằm trên background nhưng dưới content — mất nó thì dark panel rớt xuống dưới nền element).
- `components/common/ItemCardBody.vue` (233 lines): skeleton card chung — header `SlotView` static :58-64 truyền `:item="{}"` stub :61 (non-null → `filled=true` → seal + rarity edge luôn bật bất kể item thật), title tô `nameColorVar` hoặc rainbow `nameTone` (`item-card__title` :76 — KHÔNG có class `item-card__name`), badges slotLabel/gradeBadge/ownedBadge ("Sở hữu: N" chỉ khi >0 :41-45), sections/rows với gem ◆ + chip `T{tier}` + `range` + `delta` tones :86-96.
- `components/common/SlotView.vue` (826 lines): `filled = item !== null` :97; `tooltipContent = props.tooltip ?? {title: label, description}` :219-221; `v-tooltip` :248 — tắt khi `static` → mọi SlotView non-static là tooltip host (root render `<button>` thật :226 — luôn tab-focusable kể cả khi wrapper ngoài thiếu tabindex); variant `bag` → `InkNineSlice` `frame-s-slot` :254-259; span `comparison` :278-280 chỉ hiện khi `state.comparison` được set (production không set — xem mục 5).

**Builders**
- `composables/useEquipmentTooltip.ts` (267 lines): `statValuesByStat`, `computeEquipmentStatDeltas`, `getEquipmentComparisonTone` :48 (chỉ test của chính nó dùng), `EquipmentCompareContext`, `buildEquipmentTooltip` → `kind:'equipment'` :215; sections "Chỉ Số Chính"/"Chỉ Số Phụ"/"Rèn"; `nameColorVar --rank-color-{itemQualityRank*2-1}` :222, `nameTone 'tien'`, `slotPreview`, `gradeLine`, `compareWith` đệ quy depth-1 :255+.
- `composables/useMaterialTooltip.ts` (152 lines): `createMaterialTooltipBuilder(t)` → `buildMaterialTooltip` → `kind:'material'` :121; `nameColorVar --rank-color-{rank}`, `rarityRankScale 10` :137, `gradeRank` :144 (aura theo rank ramp khi không có gradeKey), `ownedCount` chỉ khi >0 :147.
- `composables/useTalentTooltip.ts` (33 lines): `TALENT_TAG_SYMBOLS` :9, `talentIconUrl` :18-19, `buildTalentTooltip` → `kind:'talent'` :24.

**Consumers LIVE (production)**
- `equipment`: `components/panels/EquipmentPaperdoll.vue:10` import builder, `tooltipBySlot` :151, `:tooltip` bind :277 (live qua `EquipmentSurface:159` → `EquipmentPaperdollStage:28`); `EquipmentBagSection.vue:55-184` build cell tooltip với compare context (equipped counterpart :64-71) + `quoteMainStatRange` gating, `:tooltip="cell?.tooltip"` bind :335; `equipment-hall/DissolveTab.vue:151-167` (call head :151, compare object :161-167); `equipment-hall/DecomposeTab.vue:11,:104` (cùng pattern gated builder — consumer live bị sót trong bản gốc); `equipment-hall/useEquippedRows.ts:104-115` (compare=undefined) — live qua `EnhanceTab.vue:28,41` / `WashTab.vue:20,42` / `RefineTab.vue:22,44`.
- `material`: `MaterialBagSection.vue:31,37` `createMaterialTooltipBuilder`, gọi :156/:239/:314, bind `:tooltip="cell?.tooltip"` :373; `ExplorationSurface.vue:321,:343` `buildMaterialTooltip` cho loot.
- `plain` rewards: `ExplorationSurface.vue:331,:352,:361,:380-381` (`explorationRewards.ts:56-62` `plainRewardTooltip` → `kind:'plain'` flatten rows → description) → DOM endpoint `scenes/exploration/fidelity/ExplorationPaperDetails.vue:26` `<SlotView :tooltip="reward.tooltip">` (chain qua `ExplorationFidelityScene.vue:30`).
- `pill`: `PillBagSection.vue:149` inline build `kind:'pill'` (`{Chất} - {Tên}`, sections Hiệu Ứng + useHint), bind :552.
- `stat`: `statSources.ts:252` `buildStatSourceTooltip` (kind:'stat') ← `CharacterFidelityStats.vue:39`, `CharacterFidelityDetails.vue:19`.
- `talent`: `useTalentTooltip.ts:24` ← `CharacterFidelityStats.vue:59` (fallback plain `{title,description}` :22 khi thiếu definition), `CharacterCreationScreen.vue:183` (contained path trong OnboardingStage; :74 reuse cùng builder cho detail aside).
- `plain` (string hoặc `{title, description}`): `CharacterFidelityIdentity.vue:37` (powerTooltip), `components/game/combat/hud/TurnCombatSkillBar.vue` `tooltipFor` :43 → bind :216, `anEmblemTooltip` :100-104 → `v-tooltip` bind :228, `orbTooltip` :140-144 → bind :192, `CombatSkillSlot.vue` `tooltipOverride` prop → `:tooltip="tooltip"` :149 → SlotView; `CompanionPanel.vue:402` (`pipTooltip`), `TranPhapPanel.vue:403` (`v-tooltip="card.label"`), `panels/bag-sections/BagPaginationControls.vue:167`, `worker-lodge/DuyenPhanTab.vue:148` (`row.disabledReason ? reasonText(row) : ''`), fallback `SlotView.tooltipContent` :219-221.

**Consumers DORMANT / orphan**
- `components/scenes/creation/` slice — dormant gần hết: `CreationChoiceTile.vue:21,:31` (`v-tooltip` trên display div + button), `TalentCard.vue:24` (`:tooltip="detail"` qua tile), `CreationStarterSlot.vue:27` (`:tooltip="{title,description}"` qua tile). `CreationChoiceTile` chỉ được import bởi TalentCard + CreationStarterSlot; `TalentCard` chỉ bởi `CreationTalentSection`; cả chuỗi 0 production importer (match "TalentCard" trong `CharacterCreationScreen.vue` chỉ là biến `selectedTalentCard`, không phải import). Cùng chết: `CreationChoiceGrid`, `CreationNameSection`/`CreationNameField`, `CreationTitleBlock`/`CreationSealStamp`, `CreationSceneLayout`, `CreationScrollShell`, `CreationBackButton`, `CreationFooter`, `CreationSectionHeader`. Chỉ `CreationSkillSymbol.vue` (qua `CombatFidelityControls.vue`) và `creationPreview.ts` (qua `CharacterCreationScreen.vue:11`) còn sống. Live creation screen dùng `<button v-tooltip>` trần :183, không qua tile.
- `element`: `CharacterFigureWheel.vue:97,114` — trên nhánh `CharacterScene` ← `panels/CharacterPanel.vue` (0 importer → cả subtree chết; `LeftPanel.vue:17` dùng `CharacterSurface` không dùng `CharacterPanel`).
- `technique`: `panels/skill-path/TechniqueSlotCard.vue:100` (`kind:'technique'`, `v-tooltip` :116) — file 0 importer.
- `talent` trên nhánh chết: `CharacterTalentSeals.vue:53` (cùng CharacterScene subtree).
- `plain` trên nhánh chết: `CharacterDerivedStats.vue:30`, `CharacterMainStatRow.vue:58`, `CharacterElementSummary.vue:38`, `panels/CharacterDetailCard.vue:50` (file orphan).
- `equipment` trên nhánh chết: `equipment-hall/EquipmentBagRail.vue:44-46,:74,:95` — file 0 importer; `scenes/equipment/detail/EquipmentItemDetail.vue` (241 lines, 0 importer) dùng `buildEquipmentTooltip` + `ItemCardBody` + nút equip/unequip.
- `talisman`, `formation`, `building`: **0 producer** trong repo — chỉ tồn tại trong union + nhánh render (`Tooltip.vue:188-198` building block + `tooltip__building-status` :301-302). `usePaperNavigation.ts:24,50,56` có `kind:'building'` khác là nav target union, không liên quan; file này cũng dormant (chỉ comment reference + `ui-preview/paperNavigation.ts` import `PAPER_NAV_IDS`).

**Hệ song song**
- `fidelity/equipmentUi.ts` (13 lines): interface `EquipmentDisplay` :1 (`tone` :11) + `EquipmentSocket` :13 — data contract của hệ `.gear-tooltip` (dùng bởi EquipmentPaperItem/PaperTooltip/FidelityScene/ForgeBatchBag).
- `EquipmentPaperTooltip.vue` (18 lines): `aside#equipment-tooltip.gear-tooltip` :8, border-image `panel-nine-slice.png` :5, scoped `position:absolute; left:716px; top:264px; width:306px` + `border-image-slice:360 fill` :16. Mount `EquipmentFidelityScene.vue:85` khi `inspecting` set; `inspecting` chỉ được gán bởi `@inspect` trên `EquipmentPaperItem` (:72 sockets + :81 bag grid — cả hai đều nằm trong default slots). Production `EquipmentSurface.vue` override hết slot → không PaperItem → `inspecting` không bao giờ set → `.gear-tooltip` dormant; live trong `EquipmentPreview.vue` (default slots, không override).
- `EquipmentPaperItem.vue:7` `aria-describedby='equipment-tooltip'` trỏ id chỉ tồn tại trên default slot — wiring chết theo hệ dormant (emit inspect/leave trên pointer/focus/Esc).
- `combat-status-tooltip.ts` (112 lines): `StatusTooltip` Phaser container, `TOOLTIP_WIDTH=120` :13, nền `0x241b1b`, viền `0xf4f4f0`, 2 dòng tên/stacks×lượt + extraLine :75-77; clamp viewport :48-52; `remainingTime` snapshot tại attach (comment header :5-6 — decay giữa 2 update không reflect vào tooltip đang mở). Live — hệ thứ ba, không qua `useTooltip`.
- `ui-preview/AuxiliaryDesignPreview.vue:54`: fixture `.pc-paper-inspector.aux-item-popup` role=tooltip — popup thiết kế, preview-only.

## 3. Art map — file art (assets/) + element dùng nó

- `public/assets/ui/elements/banner-{earth,fire,metal,primordial,water,wood}.png` (đủ 6) — `Tooltip.vue` `elementBannerUrl` :76-80 render `<img>` banner :160 cho `kind:'element'` (dormant cùng element kind).
- `frame-xs-tooltip` (`src/ui/huyen-kim-chrome.json:6-18`, status "ready", slices 21px) — `InkNineSlice` trong `Tooltip.vue:161` cho mọi non-element kind non-contained.
- `frame-s-slot` (manifest :26-38, ready, slices 25px) — `SlotView` variant `bag` :254-259 (icon slot trong card header + các lưới slot).
- `--th-art-panel-frame-v2` → `/assets/ui/tien-hiep-2026-10/runtime/panel-frame-v2.png` (`TienHiepUiAssets.ts:17`) — set làm `border-image` ở `tien-hiep-secondary-ui.css:35` rồi bị `border-image-source:none` giết ở `:128` → binding art chết trên production path (vẫn có tác dụng trên preview entries chỉ load secondary-ui).
- `--pc-inspector-art` → `controls/inspector-v1.png` (`PcPaperControls.ts:8-16`) — `pc-paper-production.css:20` `background-image` trên `#global-tooltip`; thực tế chỉ lộ ~7px viền ngoài vì `::after` `#15221e` (secondary-ui:129) phủ inset 7px.
- `.pc-paper-inspector` rules `pc-paper-scene.css:40-46` dùng cùng `--pc-inspector-art` — bundled vào production (qua @import chain) nhưng không có DOM consumer ngoài preview fixtures → dead CSS trong prod.
- `/assets/ui/huyen-kim/scene/dong-fu-v2/panel-nine-slice.png` — border-image của `.gear-tooltip` (EquipmentPaperTooltip.vue:5, dormant) + `.item-detail` (InventoryFidelityDetail.vue:8) + `::after` global `tien-hiep-ui.css:269` cho `.gear-tooltip`/`.inventory-scene .item-detail` (nửa `.item-detail` LIVE qua `InventoryFidelityDetail.vue:10-13` ← `InventoryFidelityScene:39,45` ← `InventorySurface` ← `InventoryPanel`).
- `tien-hiep-ui.css:232` `background:#15221ef5 + border-image-slice:240 320`, `:264` `background:transparent + isolation:isolate`, `:266-267` `::before` fill (`#f2e8d0` chung / `#15221e` riêng cho gear-tooltip+item-detail), `:269` `::after` border-image frame — nhóm `.gear-tooltip`/`.item-detail` + neighbors.
- Token ramps (`theme.css`): `--rank-color-1..10`, `--rank-gradient-10` (rainbow max-rank title + tier-5 labels), `--grade-hoang/huyen/dia/thien/tien` (qualityAccentColor, pill name color), `--affix-tier-1..5`, `--affix-exalted` (chip `T{tier}`), `--el-{wood,metal,water,earth,fire,primordial}` (element kind classes).
- Unimported css mang rule tooltip-class (0 importer, dead files): `tien-hiep-collections.css:102-111` (`.th-collection .item-detail` + `::before/::after display:none`) + `:245` (`.pc-collection .item-detail` inspector art); `tien-hiep-progression.css:12-18` (`.pc-progression .pc-paper-inspector` màu). `tien-hiep-outcomes.css`, `tien-hiep-forge.css`, `pc-paper-auxiliary-production.css` cũng 0 importer nhưng KHÔNG chứa rule tooltip-class nào (verified — chỉ là dead files). `tien-hiep-entry.css` CÓ importer (`AuthEntryScreen.vue:12`, live qua App.vue auth branch) — không thuộc nhóm unimported.
- Combat `StatusTooltip`: không dùng file art — vẽ rectangle + text Phaser.

## 4. Conflicts / layers — nơi 2 phiên bản UI cùng tồn tại

- **Bốn lớp chrome chồng lên `#global-tooltip`** (cùng specificity `:is(#app,body) #global-tooltip:not(.tooltip--element)`, quyết định bởi thứ tự load `main.ts:5-11`):
  1. `tien-hiep-secondary-ui.css:30-37` — nền `#15221e`, `border-image` panel-frame-v2 240 320/26px stretch, `box-shadow 0 8px 24px`, padding 22/24, `--hk-text-*` rebind.
  2. `secondary-ui.css:38` `> .ink-nine-slice { visibility:hidden }` bị `:130` `visibility:visible` đè (cùng specificity, sau hơn) → nine-slice HIỆN.
  3. `secondary-ui.css:39-46` (sót trong bản gốc) — `::before` accent bar reposition `inset: 25px auto 25px 15px` (đè scoped `12px auto 12px 5px`); `.tooltip__title` :40 → 18px; `.item-card__header/__section/__section-label/__row` :42-45 override chạy LIVE trên internals ItemCardBody (padding-bottom 9px, margin-top 12px/padding-top 10px, label 12px letter-spacing, row column-gap 18px + line-height 1.65); `.tooltip__icon-shell + .item-card__icon-shell` :46 → `background:#0b1512; border-color:#ac8c4f` — giết cream medallion scoped (`color-mix(#ebe3d2 82%)`) của technique/talent header lẫn card icon-shell.
  4. `tien-hiep-auxiliary.css:109` — `max-width:min(410px,100vw-24px)` + `padding:24px 28px` — max-width chết vì `Tooltip.vue` bind inline `max-width` theo `maxWidthForKind` (inline thắng stylesheet); padding sống (đồng nhất với pc-paper).
  5. `secondary-ui.css:128-129` — `background:transparent; border-image-source:none; box-shadow:none` (giết chính border-image+shadow bước 1) + `::after` `inset:7px; border-radius:12px; background:#15221e` panel tối.
  6. `pc-paper-production.css:20` — `background-image:var(--pc-inspector-art)` stretch 100%×100% + `border:0` + padding 24/28 + `color:#f1e1bd` + `font-family:var(--pc-font-body)` (đè family của bước 1; size 14px giữ).
  → Kết quả: inspector art chỉ lộ viền ~7px ngoài ::after, frame art `frame-xs-tooltip` vẽ đè lên → **hai lớp frame chồng nhau**; `box-shadow:none` giết `box-shadow` của `.tooltip--aura` (scoped thấp hơn specificity) → **feature aura item chết trong production**.
- **Dead CSS**: `secondary-ui.css:41` `.item-card__name` — class không tồn tại (thật là `item-card__title` `ItemCardBody.vue:76`) → rule resize 18px không bao giờ chạy.
- **`[data-contained]` bị global nuốt một nửa**: scoped `.tooltip[data-contained]` :267-269 (bg `#172c25`, border `#a58c53`, padding, title 16px) có specificity thấp hơn global → contained tooltip trong OnboardingStage mang inspector ring + ::after + padding/font của production; nhưng KHÔNG có nine-slice (`Tooltip.vue:161` `v-else-if="!contained"`) — sửa claim bản gốc "mang cả nine-slice". Chỉ khác layout (không teleport, absolute/left-start).
- **`tooltip--element` được miễn toàn bộ chrome global** (`:not(.tooltip--element)` ở mọi rule trên) → chỉ còn scoped look; kind dormant nên miễn này vô nghĩa trong prod.
- **Hệ `.gear-tooltip` song song**: scoped `EquipmentPaperTooltip.vue` `border-image-slice:360 fill` vs global `tien-hiep-ui.css:269` `::after` (slice `240 320`, không fill) — nếu live sẽ double-frame + sai lưới slice; dormant trong prod, nhưng `tien-hiep-ui.css` VẪN được preview entries import → trong EquipmentPreview global `::before`/`::after` đè lên scoped → fixture mang 2 lớp frame.
- **a11y**: `useTooltip.ts:282` CÓ gắn `aria-describedby='global-tooltip'` khi show (gỡ ở hide/dismiss) → hệ live liên kết host↔tooltip (sửa claim bản gốc "host DOM không liên kết"); chỉ `EquipmentPaperItem.vue:7` trỏ id dormant là chết.
- **Preview skin khác production theo mức**: preview 4-css (character/exploration/equipment/dong-fu/alchemy/body/combat/defeat) thiếu system-theme + auxiliary + pc-paper → tooltip preview = nine-slice + ::after dark + font-display + padding 22/24; `secondary.ts` có auxiliary (thiếu pc-paper) → thêm padding 24/28; production = đủ chuỗi (inspector ring + pc-font-body). EquipmentPreview còn thiếu cả `vTooltip` + `<Tooltip/>` mount.
- **`.item-detail` nửa sống nửa chết**: global `tien-hiep-ui.css:232,264-269` áp cho cả `.gear-tooltip` (dormant) lẫn `.inventory-scene .item-detail` (live qua `InventoryFidelityDetail`) — cùng một rule phục vụ 1 DOM live + 1 DOM dormant.
- Hai `<Tooltip/>` mount (GameRoot + OnboardingStage) chia sẻ singleton content — an toàn vì không cùng tồn tại; mọi trang ui-preview mount instance riêng vẫn dùng chung singleton state.

## 5. Logic không có hình ảnh — logic/state không render ra gì

- `kind:'building'` — interface `useTooltip.ts:164-178` + nhánh render `Tooltip.vue:188-198` + status classes :301-302: **không producer**. Caller dự kiến theo comment (:176) là "plaque layer DongFuHomeContent" — file đó preview-only và hiện cũng không build kind này.
- `kind:'talisman'`, `kind:'formation'` — union member `useTooltip.ts:84` + nhánh `ItemCardBody`/`cardContent`: **không producer** (không có TalismanBagSection/FormationBagSection).
- `kind:'technique'` — producer duy nhất `panels/skill-path/TechniqueSlotCard.vue:100` orphan → nhánh `techniqueContent` + header không render.
- `kind:'element'` — producer duy nhất `CharacterFigureWheel.vue:97,114` trên CharacterPanel/CharacterScene subtree orphan → nhánh element + banner img + `.tooltip--element-*` classes + global exemption `:not(.tooltip--element)` đều không với tới DOM.
- Toàn bộ `scenes/creation/` dormant slice (mục 2) — `TalentCard`/`CreationStarterSlot`/`CreationChoiceTile` tooltip hosts không render.
- `getEquipmentComparisonTone` (`useEquipmentTooltip.ts:48`) — export chỉ được dùng bởi test của chính nó.
- `SlotView` `state.comparison` chip — comment `EquipmentBagSection.vue:~106-110`: cố ý không set chờ UX toggle → span comparison không bao giờ hiện (dù `compareWith` pair-card trong Tooltip.vue thì LIVE qua compare context).
- `_immediate` param `showTooltip` (`useTooltip.ts:274`) — được truyền (`tooltip.ts:77`) nhưng body không đọc → param dead về mặt hành vi.
- `itemAuraColor` computed + class `.tooltip--aura` — tính live nhưng visual bị `box-shadow:none` giết (mục 4).
- Ba document listener `keydown`/`pointerdown`/`mousedown` (`tooltip.ts:40-44`) — permanent, không remove: phục vụ keyboardModality suốt đời app (live, đúng thiết kế singleton, nhưng đáng note khi audit listener footprint).
- Edge stale content (`tooltip.ts:103`): `binding.value` falsy lúc card mở → `updateTooltip` bị skip → card giữ nội dung cũ.
- `import { ref }` trong `Tooltip.vue` — chỉ dùng cho `floating` ref :14.
- `EquipmentItemDetail.vue` (241 lines) — nguyên file orphan: canonical content + `ItemCardBody` + quality seals + GameButton equip/unequip.
- `EquipmentBagRail.vue`, `panels/CharacterPanel.vue` subtree, `panels/CharacterDetailCard.vue`, `panels/skill-path/TechniqueSlotCard.vue` — file orphan, logic tooltip bên trong không render.
- `useEquippedRows.ts:104-115` — `compare=undefined` cho equipped rows (đúng thiết kế, nhánh compare trong builder không chạy cho các row này).
- `StatusTooltip` (Phaser): `remainingTime` snapshot tại attach — comment header `combat-status-tooltip.ts:5-6` ghi decay giữa 2 update không reflect vào tooltip đang mở.
- `CombatSkillSlot.vue:138-139` — `role`/`tabindex` trên wrapper chỉ bind khi `isTappable`; KHÔNG chặn focusin tooltip vì host v-tooltip là `<button>` gốc của SlotView bên trong (native focusable) — chi tiết đúng cần ghi nhận nhưng không phải "tooltip unreachable".
- `keyboardModality` gate — focusin tooltip chỉ hiện khi Tab; click-focus không hiện (đúng spec — tránh tooltip vô chủ khi programmatic focus).

## 6. Hình ảnh không có logic — art/DOM trưng bày, unwired

- `banner-{element}.png` × 6 + `.tooltip--element-*` scoped + `elementBannerUrl` — không producer → art treo.
- `panel-frame-v2` border-image binding (`secondary-ui.css:35`) — set rồi bị `border-image-source:none` giết ngay trong cùng file (`:128`) → hookup art chết trên production path.
- `--pc-inspector-art` (`pc-paper-production.css:20`) — background-image phủ kín rồi bị `::after #15221e` che ~95% → chỉ còn vai trò viền 7px.
- `.pc-paper-inspector` rules (`pc-paper-scene.css:40-46`) — bundled vào production qua `@import` nhưng không có DOM consumer ngoài preview fixtures → dead CSS trong prod.
- `.item-card__name` rule (`secondary-ui.css:41`) — selector chết.
- `.gear-tooltip` global `::before`/`::after` (`tien-hiep-ui.css:266-269`) + `:232` — nửa `.gear-tooltip` áp vào DOM dormant trong production (nửa `.item-detail` live).
- `EquipmentPaperTooltip.vue` DOM + art `panel-nine-slice.png` — chỉ fixture (`EquipmentFidelityScene.vue:85` + `EquipmentPreview.vue`); `aria-describedby` wiring cùng chết theo.
- `AuxiliaryDesignPreview.vue:54` `.pc-paper-inspector` — popup trưng bày, không logic; entry `auxiliary-design.ts` không import css nào → fixture sống nhờ scoped `aux-item-popup` + base styles, không phải pc-paper-scene rules.
- `EquipmentItemDetail.vue` — ItemCardBody + seals + buttons render trong file không mount.
- Lớp `.tooltip` scoped `[data-contained]` skin — bị global đè (mục 4) → "contained look" thành trưng bày.
- Unimported dead-file rules có class tooltip-adjacent: `tien-hiep-collections.css:102-111,:245` (`.item-detail` inspector variants), `tien-hiep-progression.css:12-18` (`.pc-paper-inspector` màu) — không file nào được import → CSS trưng bày.

## 7. Open questions — mâu thuẫn cần chủ dự án quyết

1. **Triple chrome**: inspector-art ring (pc-paper:20) + nine-slice frame-xs-tooltip (secondary-ui:130) + `::after` panel (secondary-ui:129) đang chồng lên nhau — thiết kế cuối cùng muốn giữ lớp nào? Nếu inspector art chỉ để làm viền 7px thì có chủ đích không?
2. **`box-shadow:none` giết `.tooltip--aura`** — aura item (quality glow) là bị vô hiệu cố ý hay là regression từ `secondary-ui.css:128`?
3. **Element kind dormant**: `CharacterPanel`/`CharacterScene` (medallion wheel + `kind:'element'` + talent seals + plain stat tooltips) sẽ bị xóa hẳn hay đợi port sang fidelity? Nếu xóa thì union `element` + banner art + exemption `:not(.tooltip--element)` trong 3 file css đi theo.
4. **`building`/`talisman`/`formation`/`technique` kinds**: giữ union + render branches cho hệ chưa build, hay prune để `TooltipContent` chỉ còn kind live?
5. **`contained` variant**: tooltip onboarding đang mang production chrome (trừ nine-slice) — chủ đích, hay global rules cũng nên exempt `[data-contained]` để giữ compact look?
6. **`.gear-tooltip` + `EquipmentPaperTooltip`**: hệ inspector song song chỉ sống trong preview — xóa cùng nửa `.gear-tooltip` của `tien-hiep-ui.css:232,266-269` (giữ nửa `.item-detail` live cho inventory), hay nâng cấp thành design chính thức?
7. **Hai cơ chế compare**: `SlotView.state.comparison` chip (tắt chờ UX toggle, `EquipmentBagSection.vue:~106-110`) vs `compareWith` pair-card (live trong bag hover) — giữ cả hai hay gộp?
8. **`EquipmentItemDetail.vue`**: file orphan có nút equip/unequip — xóa hay wire vào flow inspect mới?
9. **`max-width`**: `auxiliary.css:109` chết vì inline `maxWidthForKind` — nên xóa rule global hay bỏ inline binding?
10. **`StatusTooltip` (Phaser)**: hệ tooltip combat riêng với style `0x241b1b`/`0xf4f4f0` lệch hẳn skin huyen-kim — có port sang cùng chrome DOM hay giữ riêng cho canvas?
11. **`scenes/creation/` dormant slice**: xóa cả nhánh (kèm 2 tooltip host `TalentCard`/`CreationStarterSlot`/`CreationChoiceTile`) hay giữ cho port về sau?
12. **Stale content edge** (`tooltip.ts:103`): value falsy lúc card mở → card giữ nội dung cũ — cần hide thay vì giữ, hay chấp nhận edge này?
13. **`ItemCardBody :item="{}"` stub**: header card luôn render filled (seal + rarity edge) — cố ý theo preview design hay nên truyền item thật?

## Adjudication

Verify độc lập trên HEAD `8ffc8e64`. 24/25 findings của reviewer đúng hoặc đúng phần lớn; 1 finding reject ở phần kết luận.

### Missed — accepted (16/17)

1. **`scenes/creation/` dormant — ACCEPTED.** Verify: mọi file trong slice 0 production importer ngoài `CreationSkillSymbol.vue` (→ `CombatFidelityControls.vue`) và `creationPreview.ts` (→ `CharacterCreationScreen.vue:11`). Tooltip hosts: `TalentCard.vue:24` (`:tooltip="detail"`), `CreationStarterSlot.vue:27` (`:tooltip="{title,description}"`), `CreationChoiceTile.vue:21,:31` (`v-tooltip`). Note: match "TalentCard" trong `CharacterCreationScreen.vue` chỉ là biến `selectedTalentCard`, không phải import — slice vẫn dormant. Live screen dùng `<button v-tooltip>` trần :183. Đã merge vào §1/§2/§5.
2. **`ExplorationPaperDetails.vue:26` — ACCEPTED.** `<SlotView :tooltip="reward.tooltip">` là DOM endpoint cho reward tooltips (`ExplorationSurface:331/343/352/361/380-381` → `ExplorationFidelityScene:30` → PaperDetails). Đã thêm vào §1/§2.
3. **secondary-ui.css :39/:42-45/:46 — ACCEPTED.** `::before` reposition (đè scoped `12px auto 12px 5px`), `.item-card__header/__section/__section-label/__row` overrides live trên ItemCardBody internals, `.tooltip__icon-shell + .item-card__icon-shell` giết cream medallion. Đã thêm vào §4 layer list.
4. **pc-paper @import chain + `.pc-paper-inspector` dead — ACCEPTED.** `pc-paper-production.css:1` → `pc-paper-scene.css:1` → `pc-paper-type.css`; rules `.pc-paper-inspector` :40-46 bundled vào prod không consumer. `pc-paper-scene.css` còn import trực tiếp bởi PcPaperChrome:2/PcPaperDialog:3/PcPaperScene:2/DongFuStage:33. Đã thêm §1/§3/§6.
5. **Unimported css với tooltip rules — ACCEPTED có thu hẹp.** `tien-hiep-collections.css:102-111,:245` + `tien-hiep-progression.css:12-18` verified. Nhưng `tien-hiep-outcomes.css`, `tien-hiep-forge.css`, `pc-paper-auxiliary-production.css` KHÔNG chứa rule tooltip-class nào (grep verified rỗng) — chỉ là dead files. `tien-hiep-entry.css` CÓ importer (`AuthEntryScreen.vue:12`) → không unimported. Đã ghi đúng trong §3/§6.
6. **`fidelity/equipmentUi.ts` — ACCEPTED.** `EquipmentDisplay` :1 (`tone` :11) + `EquipmentSocket` :13 — data contract của hệ `.gear-tooltip`. Đã thêm §2.
7. **Document listeners permanent — ACCEPTED.** `tooltip.ts:40-44` bind `keydown`/`pointerdown`/`mousedown` capture=true một lần (`modalityBound`), không remove. Đã thêm §2/§5.
8. **`whileElementsMounted: autoUpdate` (`Tooltip.vue:86`) — ACCEPTED.** floating-ui subscribe scroll/resize/ResizeObserver khi mở. Đã thêm §2.
9. **`pointer-events: none` (`Tooltip.vue:258`) — ACCEPTED.** Card không hover được → 30ms là cross-gap tolerance. Đã thêm §2.
10. **`isolation: isolate` (:258) — ACCEPTED.** Load-bearing cho `::after { z-index:-1 }` (secondary-ui:129). Đã thêm §2.
11. **Stale content edge (`tooltip.ts:103`) — ACCEPTED.** `updated()` chỉ `updateTooltip` khi `binding.value` truthy → falsy value giữ card cũ. Đã thêm §2/§5/§7.
12. **`:item="{}"` stub (`ItemCardBody.vue:61`) — ACCEPTED.** `filled = item !== null` (SlotView:97) → `{}` luôn filled → seal + rarity edge luôn bật. Đã thêm §2/§7.
13. **Pair a11y (`Tooltip.vue:167-171,:107-108`) — ACCEPTED.** `role="group"` + `aria-label` qua `i18n.global.t`. Đã thêm §2.
14. **FunctionOverlayPanel chain — ACCEPTED.** `GameRoot:150` → `FunctionOverlayPanel:116` (`paperMode==='equipment_hall'`) → `EquipmentHallPanel:15` → `EquipmentSurface`; `:114` → `StageSelectPanel` → exploration path. Đã thêm §1.
15. **`ui-preview/equipment.ts` thiếu vTooltip + `<Tooltip/>` — ACCEPTED.** Entry chỉ import 4 css, không `.directive('tooltip')`; `EquipmentPreview.vue` không mount Tooltip. Đã thêm §1/§4.
16. **`ui-preview/auxiliary-design.ts` không import css — ACCEPTED.** `.pc-paper-inspector` fixture (AuxiliaryDesignPreview:54) không nhận `pc-paper-scene.css:40-46` qua entry này; sống nhờ scoped `aux-item-popup`. Đã thêm §1/§6.

### Missed — rejected / narrowed (1/17)

17. **`CombatSkillSlot.vue:138-139` role/tabindex gating — REJECT phần kết luận.** Đúng là wrapper `combat-skill-slot` chỉ bind `role`/`tabindex` khi `isTappable` (:138-139). Nhưng "→ focusin tooltip unreachable (pointer-only)" sai: host v-tooltip là `<button>` gốc của SlotView bên trong (`SlotView.vue:226,:248`) — native focusable, không phụ thuộc tabindex của wrapper. Keyboard Tab vẫn tới được button và focusin tooltip vẫn chạy. Ghi lại đúng mức ở §5.

### Wrong — accepted (8/8)

1. **`CreationChoiceTile` xếp LIVE — đúng là sai.** Chỉ được import bởi `TalentCard`/`CreationStarterSlot` (cả hai dormant) → dormant. Đã chuyển xuống nhóm dormant trong §2.
2. **`aria-describedby` — đúng là sai.** `useTooltip.ts:282` gắn `aria-describedby='global-tooltip'` khi show, gỡ :278/:303/:320 → hệ live CÓ link. Đã sửa §2/§4.
3. **`_immediate` "directive gọi 2 args" — đúng là sai.** `tooltip.ts:77` gọi `showTooltip(..., el, true)` (3 args); param vẫn dead trong body (`:274-286` không đọc `_immediate`, `commit()` chạy ngay). Đã sửa lý do trong §2/§5.
4. **Contained "mang nine-slice" — đúng là sai.** `Tooltip.vue:161` `v-else-if="!contained"` → contained không có nine-slice; vẫn nhận inspector ring + ::after + padding/font global. Đã sửa §4.
5. **Path panel-frame-v2 — đúng là sai.** Thật `TienHiepUiAssets.ts:17` → `/assets/ui/tien-hiep-2026-10/runtime/panel-frame-v2.png`. Đã sửa §3.
6. **Preview css generalization — đúng là lệch.** `secondary.ts:13-18` CÓ `system-theme.css` + `tien-hiep-auxiliary.css` (chỉ thiếu pc-paper-production); các entry 4-css còn thiếu `system-theme.css` (bản gốc không flag). Đã sửa §1/§4.
7. **Line drift — đúng.** `#global-tooltip` ở `Tooltip.vue:152` (:154 là `role="tooltip"`); `main.ts:13` là import, registration `app.directive` ở `:66`; `OnboardingStage` ở `components/onboarding/`. Đã sửa §1/§2.
8. **DissolveTab range — đúng.** Call head :151-152, compare context object :161-167. Đã sửa §2.

### Sửa/bổ sung thêm trong lúc verify (ngoài danh sách reviewer)

- `EquipmentPaperdoll.vue` thực tế ở `components/panels/` (không phải `scenes/equipment/`); chain live: `EquipmentSurface:159` → `EquipmentPaperdollStage:28` → `panels/EquipmentPaperdoll` — line refs :10/:151/:277 đúng.
- `TechniqueSlotCard.vue` ở `panels/skill-path/` (không phải `scenes/skill-path/`); `TurnCombatSkillBar`/`CombatSkillSlot` ở `components/game/combat/hud/` (không phải `components/scenes/combat/hud/`); `BagPaginationControls.vue` ở `panels/bag-sections/`.
- `equipment-hall/DecomposeTab.vue:11,:104` cũng là live equipment tooltip consumer (bản gốc chỉ liệt DissolveTab + useEquippedRows tabs).
- `usePaperNavigation.ts` dormant xác nhận: chỉ comment references + `ui-preview/paperNavigation.ts` import `PAPER_NAV_IDS` (const, không phải composable call); SettingsSurface mention chỉ là comment :4.
- `.item-detail` live chain xác nhận: `InventoryFidelityDetail` ← `InventoryFidelityScene` ← `InventorySurface` ← `InventoryPanel` (production).
- `.gear-tooltip` dormancy mechanism chính xác hơn: `inspecting` chỉ set từ `EquipmentPaperItem @inspect` trong default slots (`EquipmentFidelityScene:72,:81`); PaperTooltip mount :85 nằm NGOÀI slot nhưng chết vì trigger chỉ sống trong slots bị `EquipmentSurface` override hết.
- `DuyenPhanTab.vue:148` thật là `row.disabledReason ? reasonText(row) : ''` (bản gốc ghi `reasonText || ''` — cùng nghĩa falsy-off).
