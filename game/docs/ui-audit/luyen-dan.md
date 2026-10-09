# Panel: Luyện Đan (Đan Phòng / pill_room)

## 1. Mount chain — từ nav/route đến component gốc

**Lối vào LIVE (3 nguồn, tất cả đổ về `openBuilding('pill_room')`):**

- **Navigation rail trên Động Phủ** (lối chính): `DongFuStage.vue` render `aside.home-navigation-surface` (`:446-470`) với `NAV_ITEMS` chứa `'alchemy'` (`:204-208`) → `navAction` (`:280-290`) → `NAV_TARGET.alchemy = () => navigation.openBuilding('pill_room')` (`:234`). Active state qua `NAV_ACTIVE_PANEL.alchemy = 'pill_room'` (`:251`) trong `navActive` (`:267-278`); lock qua `navLocked` (`:217-224`). Icon rail = `/assets/ui/tien-hiep-2026-10/icons/navigation-alchemy-v2.png` (`:458`).
- **Command wheel**: slot `pill_room` ring 3 `buildingId:'pill_room'` trong `COMMAND_WHEEL_SLOTS` (`commandWheelCatalog.ts:200-206`) → `onWheelAction` (`DongFuStage.vue:340-358`) → `activateSlot` → `slot.buildingId → navigation.openBuilding` (`:322-334`, cụ thể `:325-326`). Symbol map `SLOT_SYMBOL.pill_room='alchemy'` (`DongFuStage.vue:111-122`, dòng `:121`); `slotActive` qua `template.functionType` (`:133-139`); `slotBadge` chấm dot khi status ready/upgradeable (`:144-153`).
- **Thiên Cơ board**: `useThienCoEntries.ts` — `active:pill_room` khi `getBuildingStatus()==='active'` và `getAlchemyJobs().length>0` (`:122-135`, `run: openBuilding('pill_room')`); `ready:` (`:111-120`) và `upgradeable:` (`:137-144`) generic paths. Board render qua `DongFuBoard.vue` trong stage (`:486-491`).

**Lối vào DORMANT / preview-only (không chạy production trên branch này):**

- **Plaque Đan Phòng**: `DongFuHomeContent.vue:41-65` render `.df-building[data-df-building='pill_room']` → `emit('action', building.id)`. File chỉ được mount bởi `fidelity/DongFuFidelityScene.vue` (comment tự nhận "Preview wrapper", `:2-5`) ← `ui-preview/DongFuPreview.vue`. `DongFuStage.vue` production KHÔNG import `DongFuHomeContent` và không render `.df-building` nào → toàn bộ plaque layer (art `hkChromeUrl('building-plaque')` `DongFuHomeContent.vue:15`, position pins `tien-hiep-ui.css:152-166`, HUD `.df-resources/.df-identity/.df-utility` rules `:167-176`, `BuildingTooltipContent` — comment tự nhận plaque là caller duy nhất `useTooltip.ts:176`) là dead trên production.
- **Paper-nav rail `usePaperNavigation.ts`**: `NAV_TARGETS.alchemy` (`:50`), `LEFT_PANEL_NAV_ID pill_room→'alchemy'` (`:77-81`), `navigate()→openBuilding` (`:127-133`) — importer duy nhất là `src/ui-preview/paperNavigation.ts`. Comment đầu file nói "shared … imperial scroll rail" nhưng rail thật (`home-navigation-surface` trên) tự chứa NAV_ITEMS — composable dormant.

**Funnel**: `openBuilding` (`useBuildingNavigation.ts:137-156`) → gate `isBetaBuildingSurface` (`betaScopeSurface.ts` map `BETA_BUILDING_FEATURES :104-112`, `pill_room:null` → beta-live; fn `:117-120`) → `template.functionType='pill_room'` (`src/data/building/buildings.ts:161`) → `ui.openLeftPanel` → gate `isBetaLeftPanelMode` (`stores/ui.ts:225-240`, map `BETA_LEFT_PANEL_FEATURES :152-163`, fn `betaScopeSurface.ts:169-171`). KHÔNG kiểm tra instance — panel mở kể cả khi chưa xây phòng (surface tự chặn brew, §2).

**Mount seam**: `ui.leftPanelMode='pill_room'` → `FunctionOverlayPanel.vue` `mode` (`:69-77`, có `isBetaLeftPanelMode` chokepoint) → `paperMode` (pill_room ∈ PAPER_MODES `:53-58`) → `<PillRoomPanel>` trong `<Transition name="th-panel-swap">` (`:112-118`) — mount NGOÀI imperial scroll; scrollMode chỉ còn 'exploration', legacyMode = worker_lodge/scripture/vendor (`:80-88`).

- `PillRoomPanel.vue:1-10` — chỉ `<AlchemySurface/>`.
- `AlchemySurface.vue:477-492` → `<SceneDesignCanvas overlay>` (fixed inset:0, transparent, `pointer-events:none`, canvas 1440×810 scale-to-fit — `SceneDesignCanvas.vue:29-43`) → `<AlchemyFidelityScene>` → 4 con: `AlchemyPaperRecipes / AlchemyPaperCauldron / AlchemyPaperDetails / AlchemyPaperQueue`.
- `GameRoot.vue:150` mount `FunctionOverlayPanel`; `App.vue:478` `registerAlchemyRecipes(alchemyRecipes)` lúc boot; provides `:516-518`.

**Chrome stage quanh panel** (ảnh hưởng trực tiếp): `df-scene--covered` khi `surfaceOpen` (`:416`) — ẩn `.df-board`/`.df-notice` (`:566-567`); `home-navigation-landscape-seam` img chỉ hiện khi surfaceOpen (`:471`); `.df-notice` + `flashNotice` (`:85-95,:493`); `onSceneClick` owner thật của backdrop-dismiss (`:365-369`, `INTERACTIVE_SELECTOR` gồm `[data-df-ui]`); window keydown bị gate `!surfaceOpen` — Tab/Backquote không bật rail/wheel khi panel mở (`:387-400`), Escape → `closeCommandWheel` (`:382-384`).

**Lối ra**: `@back` → `ui.closeHomeOverlays()` (`AlchemySurface.vue:490`); Escape qua `useDialogFocus` (`AlchemyFidelityScene.vue:35`); click nền qua `DongFuStage.onSceneClick` (`:366-369`) — `@click.self` trên scene là dead (§4).

**Đường preview**: `/legacy/ui-alchemy.html` (`previewRoutes.ts:1`) → `ui-preview/alchemy.ts` → `AlchemyPreview.vue` mount `AlchemyFidelityScene preview` + fixture (notice đổ text khi brew/cancel, `:37`).

## 2. UI logic inventory — mọi computed/store-read/emit/directive/props feed DOM

**AlchemySurface.vue** (adapter, owner toàn bộ domain state):
- `stateVersion`/`bumpState` reactivity seam (`:38`); `nowMs` ref + interval 500ms (`:40-48`) feed job countdown.
- `recipes` (`:56-72`): `getAlchemyRecipes()` filter `realmId===player.realmId && !retired && betaRecipeFamilyOfId(id)!==null`.
- `currentGrade`/`currentGradeLabel`/`currentGradeColor` (`:74-83`) → grade text + `var(--rank-color-N)` cho recipe rows + details.
- `selectedRecipeId`/`selectedRecipe` (`:85-89`); `selectRecipe` (`:108-118`) auto-pick variant cao nhất đủ số lượng; `watch(recipes)` immediate auto-select recipe đầu (`:120-125`).
- `variantRows` (`:135-152`): herbVariants → {materialId,label,icon,owned,enough} qua `materialBag.getAmount` + `materialIcon` (registry icon hoặc fallback `/assets/materials/linh_moc.png`, `:154-160` — file tồn tại).
- `preview` (`:162-175`): `previewAlchemyOutcome` → durationSeconds/fuelWoodAmount/spiritStoneCost/guarantees (scaled theo costMultiplier talent Hỏa Hầu Thông Thần).
- `fuelWoodRow` (`:179-206`): `buildProfessionMaterialId('wood', recipe.fuelWoodRealmId, variant.age)` — gỗ CÙNG realm + CÙNG tuổi thảo, khớp domain `resolveFuelWood` (`AlchemySystem.ts:355`, gọi `:572`).
- `spiritStoneRow` (`:209-213`): **luôn** đọc `SPIRIT_STONE_MATERIAL_ID`='spirit_stone_ha_pham' — xem §7 (tier mismatch).
- `jobs` (`:215-244`): `getAlchemyJobs()` filter beta-family (`:224` — CÙNG predicate domain dùng cho slot budget, xem note dưới) → {id,name,icon,progress%,remaining 'Xp'}.
- `maxJobSlots` (`:250-262`): `getCraftModifiers(instance,template).concurrentJobSlots`; 0 khi chưa xây.
- `pillRoomBuilt` (`:267-271`); `canBrew` (`:273-303`): built→recipe+herb→slots→herb enough→fuel→stone. **KHÔNG check specialIngredients/breakthrough**.
- `brewBlockReason` (`:310-340`): room_not_built→missing_herb→job_slots_full→missing_fuel_wood→missing_spirit_stone — **thiếu `missing_special_ingredient`, `realm_unavailable`, `retired`, `wrong_herb`** và sai thứ tự so với domain (§5,§7).
- `outcomeLabel` (`:344-364`): 4 shape outcome theo guaranteed/chance.
- `startJob` (`:372-390`) → `startAlchemyJob`; fail → `notificationStore.push('warning', alchemyErrorMessage(reason))` + `cue('ui.error')`; ok → `cue('craft.start')`; `bumpState`. `alchemyErrorMessage` (`:366-370`) map mọi reason → `alchemy.reason.*` key (đủ key cho cả realm_unavailable/missing_special_ingredient → toast vẫn nói đúng lý do SAU click).
- `cancelJob` (`:392-397`) → `cancelAlchemyJob` + `cue('ui.cancel')` — không notification, không confirm.
- Display model: `recipeChoices` (`:403-411`), `costRows` (`:413-435`, chỉ fuel_wood + spirit_stone), `recipeDisplay` (`:437-468`), `selectRecipeById` (`:470-473`).
- Props xuống scene (`:478-491`): `:recipes :recipe :variant :jobs :capacity notice=""` (hardcoded empty) + emits select/variant/brew/cancel/back.

**AlchemyFidelityScene.vue**: props (`:13-21`, `preview?:false`); emits (`:23-29`); `useDialogFocus` (`:35`); `herb` (`:37`) → cauldron; `paper` asset (`:39`); `BuildingUpgradeButton building-id="pill_room" class="alchemy-upgrade"` (`:49`); `@click.self="emit('back')"` (`:43`) — **dead** (§4).

**BuildingUpgradeButton.vue** (logic sống trong scene, report gốc bỏ qua): inject-optional GAME_MANAGER/STATE_VERSION/BUMP_STATE (`:22-25` — preview thiếu provider thì render rỗng, comment `:8-10`); `upgradeable` = `navigation.getBuildingStatus(id)==='upgradeable'` (`:30-38`); `costLabel` từ `useBuildingHeaderState.upgradeCostLabel` (`:40` → `useBuildingHeaderState.ts:50-55`, nguồn `quoteBuildingUpgrade`); click → `navigation.upgradeBuilding` (`:48`). Render `GameButton size="sm"` (`:45-52`) → classes `game-button game-button--primary game-button--sm` (`GameButton.vue:78-79`) → chịu global `.game-button` rules (`tien-hiep-ui.css:80-84` màu variant + `:disabled` grayscale, `:224-225` min-width 110/94px).

**useDialogFocus.ts** (gắn lên scene root): focus phần tử đầu khi mở (`:35-36`); Escape → onEscape (`:38-40`); Tab containment chặn `preventDefault`+`stopPropagation` để `DongFuStage` Tab-toggle không thấy (`:43-63`); document `mousedown` containment — preventDefault khi click ngoài card rơi vào unfocusable space (`:66-79`); restore focus về trigger khi đóng (`:80-88`).

**AlchemyPaperRecipes.vue**: props recipes/selected (`:4`); emit select (`:5`); `aria-pressed`, `data-recipe-id`, selection-mark '◆/›' (`:13-17`); empty `alchemy.emptyRecipes` (`:18`).

**AlchemyPaperDetails.vue**: props recipe/variant/notice (`:6`); emits variant/brew (`:8`); radio `name="alchemy-preview-herb"` (`:19`); `herb-option.selected/.insufficient` (`:19`); `dd.insufficient` khi `cost.enough===false` (`:20`); `alchemy.durationLabel` + `recipe.duration` (`:20`); `:disabled="recipe.brewDisabled"` (`:23`); `v-if="recipe.blockReason"` (`:24`); `<p class="notice" role="status">` luôn rỗng production (`:25`).

**AlchemyPaperQueue.vue**: jobs/capacity props (`:5`); emit cancel (`:7`); `percent()` clamp (`:11`); `role="progressbar"` (`:18`); `v-if="jobs.length < capacity"` empty-slot (`:19`) — **không hiện khi capacity=0** (§5).

**Stores/directives đụng DOM**: `usePlayerStore` (realmId), `useUiStore` (closeHomeOverlays, leftPanelMode, toggleCommandWheel), `useNotificationStore`, `useAudioStore` (5 cue: ui.error/craft.start/ui.cancel/ui.wheel.select), `useI18n`, `useDialogFocus`, `useStateVersion`, injects GAME_MANAGER/STATE_VERSION/BUMP_STATE (`App.vue:516-518`).

## 3. Art map — file art → element

**Live path:**
- `/assets/ui/huyen-kim/scene/character-v2/paper-nine-slice.png` — `.paper` big frame (border-image 300 fill/83px, `AlchemyFidelityScene.vue:39,44,65`); `.alchemy-details` + `.alchemy-details-empty` (`AlchemyPaperDetails.vue:10,12`, scene `:53`) — slice bị global đè (§4).
- `/assets/ui/huyen-kim/alchemy/alchemy-cauldron-prop@2x.png` — `.cauldron-art` (`AlchemyPaperCauldron.vue:7`). `@1x` tồn tại trên disk, không dùng.
- `/assets/pills/<family>.png` — recipe-row icon + details `recipe-icon` + queue job img (`pillIconFor` `AlchemySurface.vue:101-103`). 8 file có sẵn: tu_linh/hoi_linh/hoi_xuan/khai_linh/phi_van/thoi_the/to_cot/duong_than_dan. `thong_mach_dan`→`khai_linh_dan.png`, `truc_co_dan`→`to_cot_dan.png` (`pills.ts:86,:96` — comment ghi "no dedicated art yet").
- `/assets/materials/herbs/<herbBase>/<age>.png` — herb variant icons (8 herb dir × 5 age: decade/century/millennium/myriad_year/thuong_co; `materials.ts:234`, `materialIcon` `:154-160`). Fallback `/assets/materials/linh_moc.png` (tồn tại).
- `--th-art-button-primary` → `runtime/button-primary.png` — **brew-button** qua global (`tien-hiep-ui.css:237-238`, đè scoped).
- `/assets/ui/tien-hiep-2026-10/icons/navigation-alchemy-v2.png` — icon rail (`DongFuStage.vue:458`); rail chrome: `navigation-backing-dark-v3.png`/`navigation-landscape-seam-v1.png`/`navigation-medallion-v1.png` (`:195-198,:447,:471`).
- `/assets/ui/huyen-kim/symbols/alchemy.svg` — icon wheel slot + board entry qua `symbolUrl` (`dongFuUi.ts:12-14`; `DongFuWheel.vue:51`, `DongFuBoard.vue:16`).
- `/assets/buildings/dong-fu/v2/pill_room/base.png` — header art path của `useBuildingHeaderState` (`:36`; panel paper mode chỉ hiện text+cost).
- Building vista pill_room canvas 1254×1254 + hitbox + vfx anchors (`DongFuBuildingArt.ts:47-56`).

**Dormant / preview-only art:**
- `hkChromeUrl('building-plaque')` + `symbolUrl` trên `.df-building__*` — plaque layer preview-only (`DongFuHomeContent.vue:15,51-52`); pin `!important` `tien-hiep-ui.css:152-166` dormant theo.
- `--th-art-resource-pill-1x` → `runtime/resource-pill@1x.png` — `.df-resource` chips (`tien-hiep-ui.css:167`) — preview HUD (production dùng `pcPaperResourceUrl` chips `.home-design-currencies`, `DongFuStage.vue:430-435`).
- `/assets/ui/tien-hiep-2026-10/icons/alchemy.png` — chỉ `pcPaperIconUrl('alchemy')` trong preview `PaperArchetypePreview.vue:13`; entry trong `PC_PAPER_ICON_PATHS` manifest (`PcPaperIcons.ts:6`) nhưng không consumer production (rail dùng `navigation-*-v2.png`, wheel dùng svg).

**Dead/broken art path:**
- `--th-art-title-plaque` → `runtime/title-plaque.png`: gán cho `.alchemy-title` (`tien-hiep-ui.css:99-102`, reposition `:358-362`) — class không tồn tại trong scene mới (dùng `.title`) → title-plaque KHÔNG render trên Luyện Đan.
- `--th-art-world-vista` + `--th-art-paper-surface` qua `.alchemy-paper::before` (`:254,278-279,344`): dead — không element `.alchemy-paper` (§4).
- Fallback pill icon `/assets/pills/truc_co_dan.png` (`AlchemySurface.vue:102`): **file không tồn tại** trong `public/assets/pills/` → pill chưa register sẽ 404 broken-image.
- `HomeAlchemyArtPanel` (preview-only): `tien-hiep-2026-10/*-v1.png` set (divider, circle-frame, meridian-tube-lit, resource-crystal/jade) — chỉ `LandscapeDesignPreview.vue:8,66` mount.

## 4. Conflicts / layers — nơi 2 phiên bản UI cùng tồn tại

1. **`.alchemy-scene` pointer-events — contract CHỦ ĐÍCH, không phải war**: comment `tien-hiep-ui.css:381-389` mô tả nguyên cơ chế: scene root `pointer-events:none` để rail/stage nhận click xuyên qua, con `> *` re-enable (`:390-411`); click nền rơi xuống `DongFuStage.onSceneClick` xử lý. Hệ quả: `@click.self="emit('back')"` (`AlchemyFidelityScene.vue:43`) **không bao giờ fire** — dead handler, backdrop-dismiss do stage sở hữu (đúng design). Scoped `.alchemy-scene{pointer-events:auto}` (`:63`) thua `:is(#app,body)` nhưng không hại gì vì `> *` rule cover.
2. **`.paper` vs `.alchemy-paper` fork**: scene fidelity dùng class `.paper` (scoped `:65`, slice 300 fill/83px). TẤT CẢ rule `.alchemy-paper` global (`:25,177,239,253-256,278,344` — reposition 156px/1272px, cream+vista ::before, frame ::after) là **dead CSS** — class đổi tên nên big paper mất composite cream/vista mà `.inventory-paper` v.v. vẫn nhận.
3. **`.title` dual-style**: scoped `.title{left:231px top:174px font-size:34px italic}` (`:66`) bị global `.alchemy-scene .title` trong nhóm 72px đè font: UTM OngDoGia, gradient shine `th-title-shine` (`:135-146`; reduced-motion `:147-149`). Global KHÔNG đè left/top (hai block vị trí `.alchemy-title` `:99-102,:358-362` đều dead class) → title thực tế = vị trí scoped + skin global 72px — hybrid không file nào tự mô tả.
4. **`.brew-button` bị global chiếm**: scoped green `#315f49` + `3px double #b69c60` + `#fff0c9` (`AlchemyPaperDetails.vue:55-58`) bị `:is(.skill-upgrade,.technique-advance,.body-invest,.brew-button,...)` đè thành art `button-primary.png`, `border:0`, `color:#352713`, `font-size:20px` (`:237-238` + `:disabled` grayscale). Scoped chỉ còn flex-basis/margin/outline.
5. **`.alchemy-details` composite 2 layer**: scoped `border-image-slice:300 fill; width:35px` (`AlchemyPaperDetails.vue:33`) bị global đè `slice:240 320; width:28px` (`:233`) + `::before` flat `#f2e8d0` z-2 + `::after{border-image:inherit}` (`:264-269`). `.alchemy-details-empty` cùng cơ chế (`:243,264-269`). Slice 300→240 trên CÙNG art → frame details khác frame `.paper` (83px vs 28px) — 2 "phiên bản" của một art cùng màn hình.
6. **`.subtitle` đè vị trí**: scoped `top:192px` → global `top:184px` (`:242`).
7. **th-collection / pc-collection skin thứ 3**: `tien-hiep-collections.css` chứa dark-skin hoàn chỉnh cho alchemy (18 rule, gồm reposition subtitle/upgrade/cauldron/details) — **file KHÔNG được import** (`main.ts:5-11` chỉ nạp theme/huyen-kim.tokens/system-theme/tien-hiep-ui/secondary/auxiliary/pc-paper-production) VÀ không component nào gán class `th-collection`/`pc-collection` → dead stylesheet. Cùng trạng thái: `tien-hiep-outcomes.css`, `tien-hiep-entry.css`, `tien-hiep-forge.css`, `tien-hiep-progression.css` cũng không được import (0 rule alchemy — chỉ là dọn repo).
8. **Preview-vs-production css drift**: `ui-preview/alchemy.ts:6-9` chỉ nạp 4 css (theme/tokens/tien-hiep-ui/secondary — thiếu system-theme/auxiliary/pc-paper-production) → preview skin ≠ production skin cho cùng một scene.
9. **Old scene xoá sạch**: không còn file/reference AlchemyRecipeRail/AlchemyJobCard/AlchemyCauldronVista/AlchemyBrewCta… trong src. Locale keys `alchemy.bannerLeft/bannerRight/currentCauldron/herbCount/otherCosts/jobs/queueEmpty/navigation/duration` (9 key) còn trong `vi.json` nhưng 0 consumer → dead strings.
10. **`df-scene--covered` curtain**: khi panel mở, `.df-board` (Thiên Cơ) và `.df-notice` bị `display:none` (`:566-567`) — `flashNotice` (`:85-95`, vd `dongFu.unhandled` `:358`) không thể hiện trong lúc panel che — chrome bị mute có chủ đích.

## 5. Logic không có hình ảnh

- **`getBetaAlchemyRecipeModels`** (`GameManagerAlchemyOps.ts:298-406`): canonical beta surface model hoàn chỉnh — craftable verdict, specialIngredients sufficiency, breakthroughAvailable, spirit-stone theo realm tier (`:329-331`), activeJob map — **không UI nào consume** (AlchemySurface chỉ tham chiếu trong comment `:61`; consumer thật = test `betaScopeEconomyGates.test.ts:254-258` + `betaFrontendScopeExposure.test.ts:241`).
- **`brewBlockReason` thiếu + sai thứ tự**: domain `startAlchemyJob` trả `retired` → `realm_unavailable` (`GameManagerAlchemyOps.ts:141-151`) → `room_not_built` → `job_slots_full` → `wrong_herb` → `missing_fuel_wood` → `missing_herb` → `missing_spirit_stone` → `missing_special_ingredient` (`AlchemySystem.ts:540-590`). UI: room→herb→slots→fuel→stone. Khi domain reject bằng lý do UI không model, nút brew vẫn sáng (`canBrew` cũng không check) → click → chỉ toast warning (`:380`), không dòng lý do trên màn hình — hồi quy đúng bug M4 comment tự mô tả (`:305-309`). (Toast vẫn đúng text vì `alchemy.reason.realm_unavailable`/`missing_special_ingredient` có key sẵn trong vi.json + test `AlchemySurface.test.ts:115-138` bắt đủ key.)
- **specialIngredients hoàn toàn vô hình**: 2 recipe đặc biệt `alchemy_thong_mach_dan`/`alchemy_truc_co_dan` yêu cầu `yeu_dan_hung_giao ×1` (`alchemyRecipes.ts:54,:69`); costRows chỉ đổ fuel+stone (`:413-435`); `AlchemyCostRow`/`AlchemyRecipeDisplay` không có field special (`alchemyUi.ts:34-73`).
- **`breakthroughRealmId`** trên truc_co_dan (`alchemyRecipes.ts:62`) không render.
- **`notice=""` + `.notice` chiếm chỗ**: slot luôn rỗng production (`:485`) NHƯNG `.notice{min-height:16px}` (`AlchemyPaperDetails.vue:60`) → một hàng trống 16px luôn render; sibling scene có `.exploration-details .notice:empty{height:0}` (`tien-hiep-ui.css:249`) còn alchemy không có rule tương đương.
- **`@click.self` back-handler** — dead code (§4.1).
- **`preview` prop** — chỉ preview harness bật (`.preview-label` `:55,:71` + `alchemy.previewStamp`).
- **`empty-slot` không hiện khi `capacity=0`**: `v-if="jobs.length < capacity"` (`AlchemyPaperQueue.vue:19`) — chưa xây phòng `maxJobSlots=0` → `0<0` false → queue chỉ hiện "0 / 0" trơ trụi, không ô "Lò trống".
- **`room_not_built` + recipe list**: chưa xây phòng vẫn list đầy đủ + select được (openBuilding không gate instance) — block chỉ hiện ở nút brew/reason.
- **`useThienCoEntries` unfiltered count**: `getAlchemyJobs()` (`:98`) KHÔNG filter beta — job dormant (scope-hidden, domain "park": vẫn settle nhưng không hiện queue và KHÔNG ăn slot — `AlchemySystem.ts:546-552` filter `liveJobs` cùng predicate) vẫn đếm vào `alchemyJobs.length` (`:122`) → Thiên Cơ có thể báo "đang luyện X lò" khi queue trống.
- **State/timer**: `nowMs` tick 500ms (`:44-48`) chỉ feed `jobs` countdown — không element khác.
- **`BuildingUpgradeButton` preview-blind**: thiếu provides → render rỗng (`:8-10,:22-23`) — trong `/legacy/ui-alchemy.html` nút nâng cấp không bao giờ hiện dù fixture ở trạng thái nào.

## 6. Hình ảnh không có logic

- `.cauldron-shadow` (`AlchemyPaperCauldron.vue:9`) — blob gradient thuần trang trí.
- `.cauldron-hint` ("Đặt nguyên liệu vào đan lô") khi chưa chọn herb (`:9`) — display-only; vùng cauldron không interactive (không click/drop handler).
- `.selection-mark` '◆/›' (`AlchemyPaperRecipes.vue:16`) — decorative.
- `.empty-glyph` '◇' + `.empty-slot` (`AlchemyPaperQueue.vue:19`) — placeholder, không hành động.
- `.icon-frame`/`.herb-icon` viền khung — decorative.
- `.alchemy-details-empty` aside (`AlchemyFidelityScene.vue:53,:72`) — empty-state khi `recipe=null`; thực tế auto-select (`:120-125`) khiến nó gần như không bao giờ hiện trừ khi list rỗng (sai realm).
- Title-plaque art + `.alchemy-paper` ::before vista layer (dead §3,§4).
- `HomeAlchemyArtPanel.vue` — toàn bộ stage preview-only: connectors xoay geometry, `pulse` energized state, 4 thanh progress fake, `alchemy-start` chỉ toggle pulse — display model hoàn chỉnh không nối logic thật nào; mount qua `LandscapeDesignPreview.vue:66`, keys thuộc `ui-preview/*Messages` (alchemyPreviewMessages cho landscape-design, `alchemyMessages` cho ui-alchemy — 2 file messages riêng).
- `.home-design-profile`/`.home-design-currencies`/`.home-design-quest` chrome của stage vẫn render phía sau overlay (vùng ngoài paper) — sống nhưng không thuộc panel.

## 7. Open questions — cần chủ dự án quyết

1. **specialIngredients UI**: hiển thị `yeu_dan_hung_giao` trong costRows (và canBrew/blockReason check nó) hay giữ ẩn-by-design? Hiện tại nút brew sáng → domain reject → chỉ toast — đúng lớp bug M4 đã sửa cho các input khác.
2. **`getBetaAlchemyRecipeModels`**: canonical model đã resolve sẵn mọi gate (specials, breakthrough, stone tier) — port AlchemySurface sang consume nó (xóa re-derivation §2) hay xóa model? (Test arch đang giữ nó sống.)
3. **`.paper` rename có chủ đích?** Nếu vô tình, scene mất cream-vista composite 9 scene khác vẫn có; nếu chủ đích, xóa dead rules `.alchemy-paper`/`.alchemy-title` (`tien-hiep-ui.css:25,99-102,177,239,253-256,278,344,358-362`) + dormant plaque/HUD rules (`:152-176`) để audit sau không đọc nhầm.
4. **Spirit-stone tier**: UI đọc cứng `spirit_stone_ha_pham` (`:210`) còn domain `getSpiritStoneMaterialIdForRealmTier` đổi trung/thượng phẩm từ realm tier ≥4 (`SpiritStoneMaterial.ts:50-54`, `GameManagerAlchemyOps.ts:160,:329-331`). Latent bug — hiển thị sai số dư + sai canBrew ngay khi tier ≥4 mở.
5. **reason-order mismatch**: UI báo `missing_herb` trước slots/fuel; domain check `slots → herb-variant → fuel → herb → stone → special` (`AlchemySystem.ts:550-590`). Khi thiếu nhiều thứ, inline reason và toast nói 2 lý do khác nhau. Chọn một thứ tự chuẩn.
6. **Fallback pill icon `/assets/pills/truc_co_dan.png` 404** (`:102`) — đổi fallback sang file tồn tại (vd `tu_linh_dan.png` hoặc linh_moc)?
7. **Unimported css**: chủ đích nuôi `tien-hiep-collections.css` (alchemy skin hoàn chỉnh) hay xóa cùng `outcomes/entry/forge/progression.css`?
8. **Backdrop-dismiss owner**: giữ `@click.self` (dead, gây hiểu nhầm) hay xóa vì stage là owner thật theo contract :381-389?
9. **`yeu_dan_hung_giao` label/icon**: nếu câu 1 là "hiển thị", material có name/icon trong registry không — hay cần art mới trước?
10. **Thiên Cơ đếm job parked**: ẩn job dormant khỏi `active:pill_room` (filter cùng betaRecipeFamilyOfId) hay giữ (job vẫn settle thật)?
11. **`.notice` slot**: xóa hẳn (chỉ preview dùng) hay giữ + thêm `:empty` collapse như exploration? Liên quan `empty-slot` tại `capacity=0` — hiện "0 / 0" hay "Lò trống"?

## Adjudication — kết quả đối chiếu findings của reviewer

**Missed — chấp nhận (11/12):**

- **M1 rail production bị bỏ qua — ĐÚNG, nhận.** Verify: `usePaperNavigation.ts` chỉ có 1 importer `src/ui-preview/paperNavigation.ts` (grep toàn src); rail thật là `home-navigation-surface` trong `DongFuStage.vue` (NAV_ITEMS :204-208, NAV_TARGET.alchemy :234, NAV_ACTIVE_PANEL :251, icon `navigation-alchemy-v2.png` :458). Đã viết lại §1: 3 lối live (rail + wheel + Thiên Cơ), 2 lối dormant (plaque, paper-nav).
- **M2 `icons/alchemy.png` không phải icon wheel — ĐÚNG, nhận.** Wheel/board dùng `symbolUrl` svg (`DongFuWheel.vue:51`, `DongFuBoard.vue:16`); `pcPaperIconUrl('alchemy')` chỉ trong `PaperArchetypePreview.vue:13`. (Nuance: DongFuStage vẫn dùng `pcPaperIconUrl('character')` cho avatar — family sống, entry alchemy dormant.) Đã sửa §3.
- **M3 wheel slotActive/slotBadge sót — ĐÚNG, nhận.** Thật tại `DongFuStage.vue:133-153`. Đã thêm §1.
- **M4 BuildingUpgradeButton chain sót — ĐÚNG, nhận.** Verify `.building-upgrade > GameButton.game-button--primary--sm` chịu `:80-84,:224-225`; `useBuildingHeaderState` artPath `:36` + `upgradeCostLabel :50-55` (quoteBuildingUpgrade) + `useBuildingNavigation.upgradeBuilding`. Đã thêm §2.
- **M5 listeners/timers sót — ĐÚNG, nhận.** `useDialogFocus` có Escape `:38-40`, Tab-cycle `:43-63`, document mousedown containment `:66-79`, restore focus `:80-88`; `TICKER_MS=30_000` `useThienCoEntries.ts:29,:50-52`; DongFuStage keydown gate `!surfaceOpen` `:389,:397`. Đã thêm §2.
- **M6 `.notice` chiếm 16px — ĐÚNG, nhận.** `min-height:16px` `AlchemyPaperDetails.vue:60` vs `.exploration-details .notice:empty` reset `:249`. Đã thêm §5 + §7.11.
- **M7 empty-slot ẩn khi capacity=0 — ĐÚNG, nhận.** `0<0` → chỉ "0 / 0". Đã thêm §5.
- **M8 job scope-hidden ăn slot — SAI, BÁC.** `AlchemySystem.ts:546-550`: domain filter `liveJobs` bằng `betaRecipeFamilyOfId` — CÙNG predicate UI queue (`AlchemySurface.vue:224`), comment nói rõ parked jobs "may not occupy the live slot budget". Queue "0/1 mà job_slots_full" không xảy ra qua đường này. Phần đúng duy nhất (unfiltered count) đã có ở claim ThienCo của report gốc — giữ ở §5.
- **M9 dead locale keys — ĐÚNG, nhận, count=9.** Verify 0-use: bannerLeft, bannerRight, currentCauldron, herbCount, otherCosts, jobs, queueEmpty, navigation, duration. (`alchemy.paperNav` reviewer gợi ý không tồn tại trong vi.json — không tính.)
- **M10 chrome quanh panel — ĐÚNG, nhận.** `df-scene--covered` `:416,:566-567`, `home-navigation-landscape-seam` `:471`, `.df-notice`+`flashNotice` `:85-95,:493`, `onSceneClick`+`INTERACTIVE_SELECTOR` `:365-369`. Đã thêm §1 + §4.10.
- **M11 file trong scope chưa kể — ĐÚNG với sửa đường dẫn.** `AlchemySurface.test.ts` (live, chứa reason.* completeness `:115-138` — giải thích vì sao toast key đủ), `AlchemyPaperRecipes.test.ts`, `alchemyMessages.ts` (ui-alchemy) + `alchemyPreviewMessages.ts` (landscape-design) đúng là 2 file riêng. Sửa: `AlchemyJob.fixture.ts` nằm ở `src/core/alchemy/` (domain fixture cho save tests), KHÔNG phải `ui-preview/`. `getBetaAlchemyRecipeModels` consumer thật = `betaScopeEconomyGates.test.ts:254` + `betaFrontendScopeExposure.test.ts:241`. Đã thêm §5.
- **M12 outcomes.css không được import — ĐÚNG, nhận mở rộng.** `main.ts:5-11` thiếu cả `collections/outcomes/entry/forge/progression`; chỉ collections chứa rule alchemy (18). Đã gộp §4.7.

**Wrong — chấp nhận (7/7):**

- **W1 plaque preview-only — ĐÚNG, nhận.** `DongFuHomeContent` chỉ được `DongFuFidelityScene.vue` (tự nhận "Preview wrapper" :2-5) ← `DongFuPreview.vue` mount; `DongFuStage.vue` không import, không render `.df-building` (grep 0 kết quả ngoài preview/test). Kéo dormant: `hkChromeUrl('building-plaque')`, `.df-building*` pins `:152-166`, HUD rules `:167-176`, `BuildingTooltipContent` (`useTooltip.ts:176` comment sole-caller). §1 đã tách live/dormant.
- **W2 paper-nav dormant — ĐÚNG, nhận** (bằng chứng M1).
- **W3 sai file:line wheel — ĐÚNG, nhận với sửa nhỏ.** `commandWheelCatalog.ts` đúng 250 dòng, chỉ chứa `COMMAND_WHEEL_SLOTS` (pill_room :200-206); symbol/active thật ở `DongFuStage.vue` `SLOT_SYMBOL :111-122` + `slotActive :133-139` (reviewer ghi `:137-139` và tên `WHEEL_SLOTS` — sai nhẹ, đã đính chính).
- **W4 pointer-events là contract chủ đích — ĐÚNG, nhận.** Comment `tien-hiep-ui.css:381-389` mô tả đúng cơ chế cho MỌI fidelity scene; `@click.self` dead + stage owns dismiss vẫn đúng nhưng không phải "war". §4.1 đã viết lại.
- **W5 line cites lệch — ĐÚNG, nhận.** Đính chính: `previewRoutes.ts:1`; `betaScopeSurface.ts` building map `:104-112`+fn `:117-120`, left map `:152-163`+fn `:169-171`; `onSceneClick :366-369`; pills icon borrow `:86,:96`.
- **W6 sai consumer icon — ĐÚNG, nhận** (bằng chứng M2).
- **W7 "không UI consume" chỉ đúng production — ĐÚNG, nhận.** Model có test cover (`betaScopeEconomyGates:254`, `betaFrontendScopeExposure:241`); AlchemySurface chỉ nhắc trong comment `:61`. Đã ghi rõ §5.

**Tự phát hiện thêm trong pass đối chiếu:** `alchemy.paperNav` không tồn tại trong vi.json (reviewer ngụ ý nó là key thay thế — thật ra `paperNav.*` là nhóm keys riêng cấp top-level); `.df-resource` resource-pill (:167) cũng dormant vì HUD `.df-resources` chỉ sống trong DongFuHomeContent preview (production dùng `.home-design-currencies` + `pcPaperResourceUrl`).
