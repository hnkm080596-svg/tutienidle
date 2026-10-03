# Art Requests — Scene 11 · Alchemy / Luyện Đan (Huyền Kim)

One row per art asset Minh must draw or confirm. Every scaffold surface marked `class="art-needed"` carries the same `data-art-id` shown here.

Reference: `game/docs/design/references/huyen-kim/scenes/11-alchemy.jpg`.
Design space: 1672×941 (runtime 1280×720, ×0.7655). Scene regions per `huyen-kim-scene-layout-spec.json` scene 11 — imperial-scroll shell, content area 288/176/1244/610.
Palette anchors: ink `#101718` · jade `#315f55` · muted gold `#b99a55` · ivory paper. Scene accent stays on the existing `--scene-fire-*` tokens.

## Region → component map

| Spec region (scene 11) | Box (design px) | Component |
|---|---|---|
| recipe-list | 288/176/380/540 z14 | `AlchemyRecipeRail` → `AlchemyRecipeRow` ×N |
| focal-cauldron | 684/176/420/360 z14 | `AlchemyCauldronVista` (cauldron prop + banners + sockets) |
| detail-panel | 1120/176/412/610 z14 | `AlchemyDetailRail` → `AlchemyRecipeHeader` / `AlchemyOutcomeBlock` / `AlchemyIngredientList` / `AlchemyCostBlock` / `AlchemyBrewCta` |
| job-queue | 288/724/824/118 z14 | `AlchemyJobQueue` → `AlchemyJobCard` ×N |
| side professions rail | ref left rail | imperial-scroll shell — **RESERVED** (siblings future, gathering → `gathering_outpost`) |

## Art inventory

| # | Component | data-art-id | Design-px size (w×h) | Type | Visual description (per ref) | Layer / stack order |
|---|-----------|-------------|----------------------|------|------------------------------|---------------------|
| 1 | `AlchemyRecipeRow` | `alchemy-pill-icon` | ~34×34 | prop | Glowing pill orb icon per recipe row (ref: red/gold pill spheres) | Left of row text |
| 2 | `AlchemyCauldronVista` | `alchemy-banner-left` | ~40×280 | prop | Hanging calligraphy banner L of cauldron — gold-on-ink vertical scroll ("" per ref; vi scaffold text wraps — final copy is the artwork) | flanking cauldron |
| 3 | `AlchemyCauldronVista` | `alchemy-banner-right` | ~40×280 | prop | Matching banner R ("" per ref) | flanking cauldron |
| 4 | `AlchemyCauldronVista` | `alchemy-ingredient-socket-1..5` | ~44×44 each | prop | Dark metal ingredient sockets in a gold rail under the cauldron ("Đặt Nguyên Liệu Vào Đan Lô") — decorative per Ruling 02 | under cauldron |
| 5 | `AlchemyCauldronVista` | `alchemy-socket-plus` | ~40×40 | prop | Dashed '+' socket add marker beside the ring | beside sockets |
| 6 | `AlchemyRecipeHeader` | `alchemy-recipe-icon` | ~68×68 | prop | Square recipe art tile in the detail header (ref: glowing pill vignette) | detail header left |
| 7 | `AlchemyJobCard` | `alchemy-job-icon` (suggestion) | ~40×40 | prop | Per-pill art on queue cards (ref shows pill icon + name×count) | job card left |
| 8 | Detail panel | `alchemy-chip-seal` (suggestion) | ~96×28 | chrome | Ref's "Tăng Tu Vi"/"Phẩm Đan" seal chips beside the recipe name — canonical has grade text only | detail header |

## Covered by delivered chrome (no drawing needed)

| Component surface | Delivered asset |
|---|---|
| Centerpiece cauldron | `alchemy-cauldron-prop` (delivered — e2e-pinned `img[src*=alchemy-cauldron-prop]`) |
| Scroll envelope, rollers, plaque, close, nav | shared `imperial-scroll` shell (sibling work) |
| Recipe rows / job cards | `list-row` grammar via `--scene-fire-*` rows |
| Job progress bar | `Bar` primitive (entity-bar family) |
| Brew CTA | `GameButton` w/ `--scene-fire-text` accent (button-ceremonial family) |

## Audit blocks NOT scaffolded

| Ref element | Verdict | Action |
|---|---|---|
| Profession side rail (Luyện Khí/Phù/Chế Tạp/Khám Tra/Thu Thập) | RESERVED — siblings future | Not scaffolded |
| Recipe filter chips (Tất Cả/Tăng CG/Trị Liệu/Thuộc Tính) | INVALID for beta — `AlchemyRecipe` has no category field | Not scaffolded |
| "Số Lượng Luyện" quantity stepper | INVALID — `startAlchemyJob` takes no quantity | Not scaffolded |
| Job-card ⏩ fast-forward chip | INVALID | Not scaffolded |
| "Mở thêm hàng chờ 200" paid unlock + "Tăng Hàng Chờ" card | INVALID — slots come from `pill_room` level only | Not scaffolded; flag below |

## Flagged ambiguities — coordinator decisions needed (not self-decided)

| Ref element | Finding | Action taken |
|---|---|---|
| Queue strip shows locked slots ("Mở thêm hàng chờ") + empty slot frames | Paid unlock is INVALID, but empty-slot *frames* could be presentational (spec says slots = `maxJobSlots`). | Rendered real jobs + capacity label "Hàng Chờ Luyện Đan (n/m)" + empty-state line; no slot frames. Flag: if empty-frame dressing wanted, it's pure chrome — coordinator call. |
| Ref queue strip shows job name "×3" quantity | `startAlchemyJob` has no quantity; one job = one brew. | Kept canonical name + ETA + progress + cancel. |
| Ref ingredient tiles in detail ("Nguyên Liệu Cần Thiết" 4-tile grid w/ owned/required counts) | Canonical herb-variant radio list carries the same data + selection semantics. | Kept canonical radios; a tile-grid variant is a presentation restyle — flagged. |
| Ref detail header chips "Tăng Tu Vi" + "Phẩm Đan" | No recipe-category/type field (categories INVALID); grade chip exists via `currentGradeLabel`. | Kept grade label only; `alchemy-chip-seal` suggestion row. |
| Fuel "Thay Đổi" (change) button | `fuelWoodRow` is derived from recipe+variant — no fuel-picker op exists. | Kept canonical row; flagged. |
| Banner copy | Ref couplets are 4-char (""/""); vi scaffold text is longer and wraps to 2 columns. | Temp art only — final banners are drawn calligraphy; flagged for Minh. |
