# UI Components — Đặc tả toàn bộ giao diện

> Cập nhật: 2026-08-29 (sau ink-wash nine-slice refactor)
> Nguồn sự thật về màu: `game/src/assets/theme.css` — theme **"Mực và Giấy Trắng"**

## Tổng quan

- **96 component Vue** chia theo 14 nhóm thư mục (xem mục lục).
- Stack: Vue 3 + TypeScript, CSS scoped thuần. Không UI library (Tailwind/Element Plus...), không preprocessor (Sass/Less).
- Riêng `App.vue` dùng `<style>` global (reset body + boot-error); `src/assets/theme.css` là biến theme toàn cục; mọi component còn lại dùng `<style scoped>`.
- Gần như **100% màu đi qua CSS variables** — hex/rgba cứng chỉ xuất hiện trong shadow và mask hiệu ứng.
- **Lớp primitives (mới 2026-08-29)**: `common/primitives/` (Bar, Chip, Eyebrow, StatRow, EmptyState) + composite `SceneHeader` là nguồn sự thật duy nhất cho 6 pattern từng bị trùng lặp (~90 đoạn CSS tự viết trên ~30 file đã được hợp nhất).
- Nguyên tắc primitives: **props chỉ điều khiển hành vi, mọi visual qua CSS var** — nơi dùng override `style="--bar-from: var(--el-color)"` thay vì thêm prop.

### Hệ UI thủy mặc 9-slice

UI không còn được xem như các hộp hiện đại đặt trên tranh. Khung, nút, panel và
backdrop là các nét mực/giấy nằm trong cùng một bức thủy mặc; chữ, số và trạng
thái tương tác vẫn được render sống để giữ khả năng đọc và accessibility.

- Nguồn metadata duy nhất: `src/assets/ink-wash-ui-slices.json`; API TypeScript:
  `src/assets/inkWashUi.ts`.
- Primitive Vue: `common/primitives/InkNineSlice.vue`; adapter Phaser:
  `game/support/InkWashUiPhaser.ts`.
- Runtime: PNG `@1x/@2x`, atlas Phaser 2048px có extrusion, và sáu overlay tranh
  trong `public/assets/ui/ink-wash/`.
- Màu vật liệu: giấy tuyên ấm trắng + mực carbon + wash xám khói. Chu sa, ngọc,
  thanh khoáng và kim nhạt chỉ là sắc tố semantic; không dùng bạc kim loại,
  neon, bevel hoặc glow hiện đại làm ngôn ngữ khung.

| Tier | Logical source | Slice | Vai trò |
| --- | ---: | ---: | --- |
| XS | 64×64 | 12 | viền mực nhỏ, chip, badge, vòng icon |
| S | 192×64 / 96×96 | 24×16 / 20 | button và slot |
| M | 192×192 | 32 | giấy card/tooltip và khung góc ấn |
| L | 320×320 | 48 | data surface tối và panel phong cảnh |
| XL | 512×512 | 80 | scroll/form dài, modal và nghi lễ toàn màn hình |

Quy tắc bắt buộc: corner cố định; edge center thẳng và yên; decoration không
được cắt qua slice line; frame có center alpha 0; paper/data surface dùng `fill`;
asset không chứa chữ/icon; decorative DOM luôn `aria-hidden` và
`pointer-events: none`. `InkWashBackdrop` chỉ nối bố cục bằng núi, sương, trúc
và ấn—không được che hoặc nhận input của nội dung.

## Mục lục

1. [Hệ màu chuẩn — theme.css](#1-hệ-màu-chuẩn--themecss)
2. [Primitives — common/primitives/ (5)](#2-primitives--commonprimitives-5)
3. [Common — common/ (20)](#3-common--common-20)
4. [Layout — layout/ (4)](#4-layout--layout-4)
5. [Panels — panels/ (22)](#5-panels--panels-22)
6. [Panel con — skill-path (5)](#6-panel-con--skill-path-5)
7. [Panel con — bag-sections (4)](#7-panel-con--bag-sections-4)
8. [Panel con — loadout-sections (4)](#8-panel-con--loadout-sections-4)
9. [Panel con — scripture (2)](#9-panel-con--scripture-2)
10. [Panel con — artifact (4)](#10-panel-con--artifact-4)
11. [Combat — game/combat/ (10)](#11-combat--gamecombat-10)
12. [Combat HUD — game/combat/hud/ (6)](#12-combat-hud--gamecombathud-6)
13. [Game / Scene — game/ (7)](#13-game--scene--game-7)
14. [Onboarding — onboarding/ (2)](#14-onboarding--onboarding-2)
15. [Quy ước pattern toàn UI](#15-quy-ước-pattern-toàn-ui)

---

## 1. Hệ màu chuẩn — theme.css

**Đường dẫn**: `game/src/assets/theme.css`. Font: _Noto Serif_ (`--font-display`) + _Be Vietnam Pro_ (`--font-body`), import Google Fonts.

### Thang nền mực (Ink)

| Token             | Hex       | Vai trò                                  |
| ----------------- | --------- | ---------------------------------------- |
| `--ink-950`       | `#0a0a0d` | Nền sâu nhất — viewport, input, track    |
| `--ink-900`       | `#131318` | Nền panel chính                          |
| `--ink-800`       | `#1b1b22` | Surface nổi — nút secondary, slot filled |
| `--ink-700`       | `#24242e` | Nút disabled, track bar                  |
| `--ink-line`      | `#33333f` | Viền chuẩn                               |
| `--ink-line-soft` | `#24242c` | Viền mềm                                 |

### Họ giấy và nét mực (các alias `--chrome-*` kế thừa)

| Token          | Hex       | Vai trò                                 |
| -------------- | --------- | --------------------------------------- |
| `--chrome-100` | `#f4f1ea` | Giấy sáng — title, corner               |
| `--chrome-300` | `#d9d4c7` | Giấy ngà — viền đang chọn, focus        |
| `--chrome-500` | `#b3ada0` | Mực nhạt — eyebrow, chi tiết ngoài      |
| `--chrome-700` | `#7c7870` | Mực chìm — disabled, chi tiết phụ       |

Tên `chrome` chỉ được giữ để tương thích component cũ; hệ mới không mô phỏng bạc
kim loại. Surface trung tính mới dùng trực tiếp `--paper-*`, `--brush-*`,
`--paper-text`, `--paper-line` và các pigment `--cinnabar`/`--mineral-*`.

(Vàng giờ **chỉ là màu dữ liệu**: `--gold-100..700` — rank 7 "kim", Nộ Khí, dot trạng thái.)

### Chữ / Semantic

| Token              | Hex       | Vai trò                           |
| ------------------ | --------- | --------------------------------- |
| `--text-primary`   | `#ebe6d9` | Chữ chính (giấy ngà)              |
| `--text-secondary` | `#b3ada0` | Chữ phụ / mô tả                   |
| `--text-muted`     | `#7c7870` | Chữ mờ / hint                     |
| `--jade`           | `#6fbf73` | Xanh ngọc — thành công, valid, MP |
| `--crimson`        | `#e5484d` | Đỏ — lỗi, nguy hiểm, thiếu        |
| `--azure`          | `#5b9bd5` | Xanh dương — info, bị chặn        |
| `--gold-500`       | `#ffd54f` | Nộ Khí / Kiếm Ý (combat resource) |
| `--hp-color`       | `#d8d5cc` | Trắng xám — fill HP combat        |

### Thang phẩm chất 9 bậc (SlotView/tooltip dùng chung)

`--rank-color-1` xám `#8a877e` · `2` bạc `#d8d5cc` · `3` lục `#6fbf73` · `4` thanh `#33d9d9` · `5` lam `#5b9bd5` · `6` tím `#9b7de3` · `7` kim `#ffd54f` · `8` xích `#ff6b4a` · `9` `#fff6d8` + `--rank-gradient-9` (gradient 7 màu vòng).
Alias: `--eq-quality-*` (9 bậc trang bị), `--grade-*` (Hoàng/Huyền/Địa/Thiên/Tiên → rank 1/3/5/7/9), `--affix-tier-1..5` (→ rank 1/3/5/7/9), `--affix-exalted` `#e8c74a`.

### Ngũ Hành + mở rộng

Mộc `#7cb342` · Hỏa `#e53935` · Thổ `#a1795a` · Kim `#cfd8dc` · Thủy `#42a5f5` · Hỗn Nguyên `#9b5de5` · Phong `#4dd0e1` · Lôi `#ffca28` — token `--el-*`.

### Scene tokens (palette theo khu chức năng)

| Khu                       | Token                          | Màu chủ đạo                                                                             |
| ------------------------- | ------------------------------ | --------------------------------------------------------------------------------------- |
| Khí Đường / Đan Phòng     | `--scene-fire-*`               | Ember cam (`deep #15100d`, `accent #e0a45b`, `text #f3cf8b`, `glow #ff6b1f`)            |
| Địa Giới (teleport)       | `--scene-portal-*`             | Teal (`deep #0c181c`, `accent #72c5d8`, `glow #49bdd2`)                                 |
| Linh Tuyền                | `--scene-water-*`              | Azure (`deep #0a1216`, `accent = --azure`, `text #d6ecf9`)                              |
| Sản Xuất — Lâm/Quáng/Động | `--scene-forest/mine/grotto-*` | Xanh rừng / nâu vàng / teal                                                             |
| Thiên Kiếp                | `--scene-tribulation-*`        | Xanh-tím (`deep #08101e`, `line #9edaff`, `time #7658d6`, `hp #d34c4c`, `glow #69bfff`) |

### Kích thước / hiệu ứng

| Token                             | Giá trị                                                                                                                                 |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `--radius-sm` / `--radius-md`     | `4px` / `8px`                                                                                                                           |
| `--shadow-panel`                  | `0 8px 24px rgba(0,0,0,0.45)`                                                                                                           |
| `--shadow-glow-chrome`            | `0 0 12px rgba(217,212,199,0.35)`                                                                                                       |
| `--scrim` / `--scrim-heavy`       | `rgba(8,9,13,.76)` / `rgba(5,5,8,.92)`                                                                                                  |
| `--focus-ring-chrome`             | `0 0 0 2px rgba(217,212,199,0.65)`                                                                                                      |
| `--space-1..6`                    | `4/8/12/16/24px` (không nhân ui-scale)                                                                                                  |
| `--text-xs…hero`                  | `12/13/14/15/16/18/20/24/32/96px` × `var(--ui-scale,1)` (set runtime qua Settings 90–125%)                                              |
| `--tap-min` / `--tap-comfortable` | `40px` / `44px` × ui-scale                                                                                                              |
| `--combat-*-h`                    | clamp chiều cao 4 bar combat (topbar 46–72 / status 44–68 / event 32–48 / control 48–76px)                                              |
| Class `.ornate-frame`             | Khung triện code-native kế thừa (outer `--chrome-500` + inner `--chrome-300` + corner `--chrome-100`); khung 9-slice mới ưu tiên `InkNineSlice` |
| Scrollbar                         | Ẩn toàn app (`scrollbar-width: none` + webkit) — panel vẫn scroll                                                                       |

---

## 2. Primitives — common/primitives/ (5)

Lớp atom, mỗi component đúng 1 pattern. Props = hành vi; visual = CSS var.

### Bar

- **Đường dẫn**: `game/src/components/common/primitives/Bar.vue`
- **Chức năng**: Thanh fill ngang **duy nhất** của toàn app — tu vi, EXP tier, production cycle, HP/MP/Nộ combat, countdown thiên kiếp, cast bar. `role="progressbar"` + aria đầy đủ.
- **Props**: `value`, `max`, `height` (default 8px), `pill` (radius 999px), `anchor` (`left`/`right` — thu từ phải cho Tribulation).
- **CSS var**: `--bar-track` (default `--ink-700`) · `--bar-from`/`--bar-to` (gradient fill; default **house style** `--jade → --chrome-300`; solid = from=to — HP `--hp-color`, Nộ `--gold-500`).
- **Đặc tả**: slot `label` giữa bar (`tabular-nums`, text-shadow); fill transition width 200ms. Thay 17/19 bar tự làm — riêng ArtifactCombatSlot (mask cooldown dọc) chủ đích không dùng.

### Chip

- **Đường dẫn**: `game/src/components/common/primitives/Chip.vue`
- **Chức năng**: Pill chọn được — atom cho TabBar và mọi filter/mode/spec switcher.
- **Props**: `active`, `disabled`.
- **CSS var**: `--chip-active-bg` (default transparent; Settings tint `--chrome-300 12%`, SkillLoadoutStrip `--ink-700`, StageSelect filter portal-teal).
- **Đặc tả**: idle `--ink-800` + viền `--ink-line-soft` + chữ `--text-secondary`; active viền `--chrome-300` + chữ `--chrome-100`; min-height `--tap-min`; focus ring bạc.

### Eyebrow

- **Đường dẫn**: `game/src/components/common/primitives/Eyebrow.vue`
- **Chức năng**: Section title uppercase — chuẩn hóa dải tracking .02–.13em cũ về 1 giá trị.
- **Props**: `as` (h3/h4/h5/span/p), `tone` (chrome/muted/inherit).
- **CSS var**: `--eyebrow-tracking` (default .04em).

### StatRow

- **Đường dẫn**: `game/src/components/common/primitives/StatRow.vue`
- **Chức năng**: Hàng label — value cho bảng chỉ số 2 cột (thay ~14 chỗ tự viết).
- **Props**: `label`, `tone` (default/positive/negative/warning/muted — khớp hệ tone Tooltip), `bordered`; slot value (chấp nhận span màu riêng).
- **Đặc tả**: value `tabular-nums` căn phải; tone positive `--jade` / negative `--crimson` / warning `--chrome-100` / muted `--text-muted`.

### EmptyState

- **Đường dẫn**: `game/src/components/common/primitives/EmptyState.vue`
- **Chức năng**: Khối trống centered — thay ~13 div empty tự viết.
- **Props**: `size` (sm 8px / md 16px / lg 24px padding), `framed` (viền dashed `--ink-line`).

---

## 3. Common — common/ (20)

### SceneHeader _(composite, 2026-08-29)_

- **Đường dẫn**: `game/src/components/common/SceneHeader.vue`
- **Chức năng**: Khối scene header dùng chung 4 panel có artwork (Khí Đường, Địa Giới, Linh Tuyền, Đan Phòng) — ảnh full-bleed + scrim + caption + slot decoration.
- **Props**: `asset`, `scene` (`fire`/`portal`/`water` → tự map cụm `--scene-deep/accent/text/text-soft/glow` scope), `height`, `objectPosition`, `imageOpacity`, `caption`.
- **Slots**: `decoration` (forge-fire, vòng portal, orb, lõi đan — cá tính từng panel) + default (nội dung chồng, StageSelect dùng row header).
- **Đặc tả**: caption bottom-left Noto Serif `--text-sm` letter-spacing .18em text-shadow; scrim gradient dọc mặc định (StageSelect override gradient ngang portal).

### GameButton

- **Đường dẫn**: `game/src/components/common/GameButton.vue`
- **Chức năng**: Nút chuẩn toàn game — spinner loading, hover nhấc nhẹ, 4 variant × 3 size × 2 shape.
- **Props**: `variant` (primary/secondary/danger/ghost), `size` (sm/md/lg), `shape` (rect/circle — nút icon tròn "+"), `accentVar` (tên CSS var — gradient accent scene, vd `--scene-fire-text` lò đan), `disabled`, `loading`, `type`.
- **Màu sắc**:
  - Primary: gradient `--chrome-100 → --chrome-500`, chữ `--ink-950`, hover glow `--shadow-glow-chrome`
  - Secondary: nền `--ink-800`, viền `--ink-line`, hover viền `--chrome-300`
  - Danger: nền `--crimson`, chữ `#fff`, hover glow đỏ
  - Ghost: trong suốt, chữ `--text-secondary`, hover `--chrome-100`
  - accentVar: gradient `var(--button-accent) → color-mix(accent 72%, --ink-950)`
- **Đặc tả**: radius `--radius-sm`; font-weight 700; sm `--tap-min` / md `--tap-comfortable` / lg +8px; disabled opacity .55; hover `translateY(-1px)`; spinner 12px 0.6s.

### GamePanel

- **Đường dẫn**: `game/src/components/common/GamePanel.vue`
- **Chức năng**: Panel nền chuẩn mọi khối nội dung — header (title + slot header-actions) + body slot.
- **Props**: `title?`, `variant` (default/compact/ornate), `padding` (none/sm/md).
- **Màu sắc**: default gradient `160deg --ink-900 → --ink-800` viền `--ink-line`; ornate gradient `--ink-950 → --ink-800` + `.ornate-frame`; title `--chrome-100`.
- **Đặc tả**: radius `--radius-md` (compact `--radius-sm`), shadow `--shadow-panel`; title Noto Serif `--text-panel-title` letter-spacing .04em.

### OverlayPanel

- **Đường dẫn**: `game/src/components/common/OverlayPanel.vue`
- **Chức năng**: Overlay dialog giữa màn hình dùng chung — click backdrop để đóng (khác ConfirmModal).
- **Props**: `open`, `title`, `width` (default `min(900px, 94vw)`), `height`, `layer` (z-index).
- **Màu sắc**: backdrop `--scrim` + blur 4px; card gradient `155deg --ink-800 → --ink-950` viền `1px --chrome-500`; h3 `--chrome-100`.
- **Đặc tả**: max-height 94vh, radius `--radius-md`, shadow `--shadow-panel`; nút ✕ vuông `--tap-min`; enter/leave `translateY(12px) scale(.985)` 0.2s.

### TabBar

- **Đường dẫn**: `game/src/components/common/TabBar.vue` — rebuild trên Chip (2026-08-29).
- **Chức năng**: Thanh tab điều hướng dạng grid, badge số tùy chọn (NotificationBadge).
- **Props**: `tabs` ({id, label, badge?}[]), `modelValue` (v-model), `columns`, `layout` (`grid` đều cột / `row` flex:1 từng chip).
- **Đặc tả**: item là Chip; badge offset `-4px`; gap `--space-1`.

### SlotView

- **Đường dẫn**: `game/src/components/common/SlotView.vue` (+ `SlotTypes.ts`)
- **Chức năng**: Ô item generic — icon PNG/monogram chữ, tint màu theo Quality rank (1–9), chip Phẩm, glyph validation ✓/✕/!, marker ● đang mặc/NEW, mũi tên so sánh ▲/▼, badge, số lượng xN, caption tên nhiều màu, veil khóa 🔒/disabled ⊘/spinner.
- **Props**: `item` (null = trống), `icon`, `nameSegments`, `equipmentQualityRank` (1–9), `rarityRank`, `state` (5 trục semantic), `badges`, `amount`...
- **Màu sắc**: surface trống `--slot-surface` (`--ink-900`) / có item `--slot-surface-raised` (`--ink-800`); viền theo `--slot-quality-color` (`--rank-color-N`); rank 9 glow + gradient 7 màu; valid `--jade`, invalid `--crimson`.
- **Đặc tả**: aspect-ratio 1:1, radius `--radius-sm`; icon 84%; glyph 13px top-left; chip 8px top-right; hover icon `translateY(-1px)`; dùng `aria-disabled` (giữ tooltip).

### Tooltip

- **Đường dẫn**: `game/src/components/common/Tooltip.vue`
- **Chức năng**: Tooltip global (Teleport + Floating UI) — kind: technique / graded item (Phẩm) / equipment (giữ Alt = advanced) / building / plain; accent động theo rank.
- **Màu sắc**: viền trái 3px accent (`--rank-color-N` → `--tooltip-accent`); nền gradient mực pha accent 12%; row tones: positive `--jade`, negative `--crimson`, warning `--chrome-100`, special `--affix-exalted`; tier 5 chữ gradient 7 màu.
- **Đặc tả**: max-width plain 240 / rich 320 / equipment 380px; icon-shell 54px; fade 35/30ms; prefers-reduced-motion.

### ToastContainer

- **Đường dẫn**: `game/src/components/common/ToastContainer.vue`
- **Chức năng**: Toast neo góc trên phải (Teleport) — toast loot icon + eyebrow "NHẬN ĐƯỢC" + tên nhiều màu + số lượng; số toast theo chiều cao màn hình.
- **Màu sắc**: nền `--ink-900` 96% alpha; viền trái 3px màu kind — loot `--jade`, craft/warning `--chrome-300`, save `--azure`, error `--crimson`.
- **Đặc tả**: `top/right: 24px; z-1500`; toast max-width 160px font `--text-xs`; enter slide `translateX(56px)` 0.4s.

### NotificationBadge

- **Đường dẫn**: `game/src/components/common/NotificationBadge.vue`
- **Chức năng**: Badge đỏ idle-game — dot (có/không) hoặc count ("99+").
- **Màu sắc**: nền `--crimson`, viền `--ink-950`, chữ `#fff`, glow đỏ.
- **Đặc tả**: radius `999px`; dot 9×9px; count min-width 16px.

### ActionFeedbackLog

- **Đường dẫn**: `game/src/components/common/ActionFeedbackLog.vue`
- **Chức năng**: "Nhật ký thao tác" — feedback action gameplay, neo góc dưới phải.
- **Màu sắc**: viền trái 3px `--entry-color` theo tone — success `--jade`, warning `--chrome-300`, error `--crimson`; nền `--ink-900` alpha.
- **Đặc tả**: `fixed; right/bottom: 24px; z-1200`; width `min(320px, 90vw)`; entry cũ opacity .75.

### ConfirmModal

- **Đường dẫn**: `game/src/components/common/ConfirmModal.vue`
- **Chức năng**: Modal xác nhận (thay `window.confirm`) — KHÔNG đóng khi click backdrop.
- **Props**: `open`, `title`, `message`, `confirmLabel`, `cancelLabel`, `danger`.
- **Màu sắc**: backdrop `--scrim` + blur 4px; card gradient `160deg --ink-950 → --ink-800` + `.ornate-frame`; nút qua GameButton.
- **Đặc tả**: card `min(420px, 92vw)`; `role="alertdialog"`.

### OfflineSummaryModal

- **Đường dẫn**: `game/src/components/common/OfflineSummaryModal.vue`
- **Chức năng**: "BẾ QUAN KẾT THÚC" — 2 StatRow (Thời gian, + Linh lực tone positive) + nút Tiếp Tục.
- **Đặc tả**: `z-1800`; GamePanel ornate; StatRow value 600 weight.

### LoadingScreen

- **Đường dẫn**: `game/src/components/common/LoadingScreen.vue`
- **Chức năng**: Màn boot "TIÊN HIỆP IDLE" + vòng pulse.
- **Màu sắc**: nền `--ink-950`; title `--chrome-100`; vòng `2px solid --chrome-100`.
- **Đặc tả**: full 100vw×100vh; pulse 36px scale .8↔1.1 1.1s infinite.

### ErrorBoundary / ErrorScreen

- **Đường dẫn**: `game/src/components/common/ErrorBoundary.vue` / `ErrorScreen.vue`
- **Chức năng**: Boundary = renderless, bắt lỗi cây con đẩy errorStore. Screen = overlay full-screen — Thử Lại / Về Trang Chủ.
- **Màu sắc** (Screen): backdrop `--scrim-heavy`; panel gradient mực + `.ornate-frame`; title **`--crimson`**.
- **Đặc tả**: `z-3000`; panel max 420px.

### SaveIncompatibleScreen

- **Đường dẫn**: `game/src/components/common/SaveIncompatibleScreen.vue`
- **Chức năng**: Full-screen khi save hỏng — Tải save / Nhập save / Xoá & bắt đầu mới (danger qua ConfirmModal).
- **Đặc tả**: `z-4000`; panel max 460px; input file ẩn phủ label.

### WorldAnnouncementOverlay

- **Đường dẫn**: `game/src/components/common/WorldAnnouncementOverlay.vue`
- **Chức năng**: Thông báo đại sự — tiêu đề lớn + body typewriter 28ms/ký tự, click đóng.
- **Màu sắc**: backdrop `--scrim-heavy`; title `--chrome-100` + glow 24px.
- **Đặc tả**: `z-2000`; title `--text-display-lg`.

### TutorialOverlay

- **Đường dẫn**: `game/src/components/common/TutorialOverlay.vue`
- **Chức năng**: Hướng dẫn lần đầu — progress "x / y", Bỏ Qua (ghost) / Tiếp Theo (primary).
- **Đặc tả**: `z-1900`; panel `min(420px, 92vw)`.

### PlayerPortrait

- **Đường dẫn**: `game/src/components/common/PlayerPortrait.vue`
- **Chức năng**: Ảnh PNG nhân vật — variant 'cultivate' (animation float/breathe/aura/qi-ring khi `animated`) hoặc 'portrait' (tĩnh).
- **Props**: `variant`, `height` (default 239), `animated`.
- **Màu sắc**: aura radial `--chrome-500` 22% blur 10px; qi-ring viền `--chrome-500` 42%.
- **Đặc tả**: float 6s; breathe 5s; qi-ring ellipse 3/1 6s; prefers-reduced-motion.

### BreakthroughRequirementPanel

- **Đường dẫn**: `game/src/components/common/BreakthroughRequirementPanel.vue`
- **Chức năng**: Panel Đột Phá trước Độ Kiếp — 1 slot vật phẩm, nút Luyện (Linh Thạch), Đóng / Độ Kiếp (GameButton).
- **Màu sắc**: slot viền `--ink-700` → ready `--jade`.

---

## 4. Layout — layout/ (4)

### GameRoot

- **Đường dẫn**: `game/src/components/layout/GameRoot.vue`
- **Chức năng**: Root layout — mount MainScene + mọi lớp chrome (panels, overlays, toasts, tooltip, modals); combat active thì ẩn chrome Động Phủ, hiện Combat/Tribulation overlay; click vùng trống đóng panel.
- **Màu sắc**: nền `--ink-950`; shadow popover `rgba(0,0,0,.68)`.
- **Đặc tả**: viewport 100vw×100vh overflow hidden; left panel absolute `clamp(360px, 30vw, 480px)` z-10, container query; ≤900px → `min(44vw, 400px)`; popover layer z-20.

### LeftPanel

- **Đường dẫn**: `game/src/components/layout/LeftPanel.vue`
- **Chức năng**: Drawer trái — CharacterPanel (hoặc Equipment 30% + content 70%).
- **Màu sắc**: nền `--ink-900`; viền phải `--ink-line`; shadow `--shadow-panel`.
- **Đặc tả**: slide `translateX(-100%)` + `blur(12px)` .28s ease.

### RightPanel

- **Đường dẫn**: `game/src/components/layout/RightPanel.vue`
- **Chức năng**: Drawer phải — EquipmentPaperdoll 30% + InventoryPanel 70%.
- **Đặc tả**: `clamp(340px, 27vw, 440px)`; slide `translateX(100%)` .28s; container query `right-panel`.

### FunctionOverlayPanel

- **Đường dẫn**: `game/src/components/layout/FunctionOverlayPanel.vue`
- **Chức năng**: Modal trung tâm điều phối 7 panel chức năng theo `ui.leftPanelMode` (Sản Xuất, Cài Đặt, Khí Đường, Đan Phòng, Linh Tuyền, Tàng Kinh Các, Địa Giới).
- **Đặc tả**: OverlayPanel `min(1120px, 94vw) × min(820px, 92vh)`.

---

## 5. Panels — panels/ (22)

### CharacterPanel

- **Đường dẫn**: `game/src/components/panels/CharacterPanel.vue`
- **Chức năng**: Panel Nhân Vật — chân dung + aura màu hệ nghề, tên/cảnh giới/Chiến Lực, Thiên Phú, 5 nhóm chỉ số (nút "+" = GameButton circle), bản đồ Ngũ Hành chip pentagram + Hỗn Nguyên, chip buff đan.
- **Màu sắc**: aura radial `--aura` (màu element, fallback `--chrome-500`); tier thiên phú → `--rank-color-1/3/5/7/8`.
- **Đặc tả**: figure 112×116px aura breathe 5s; chip absolute 260×310px ngũ giác.

### RealmPanel

- **Đường dẫn**: `game/src/components/panels/RealmPanel.vue`
- **Chức năng**: Overlay Cảnh Giới — chân dung animated, thanh Tu Vi (**Bar 24px pill, label trong bar**), nút đại đột phá (GameButton), 9 node cảnh giới, lưới passive.
- **Màu sắc**: node complete `--jade`, current `--chrome-300` + glow bạc; Bar default house style; override `--bar-track: --ink-950`.
- **Đặc tả**: OverlayPanel `min(1120px,94vw) × min(760px,90vh)`; node hình khiên `50% 50% 12px 12px` nối ::after.

### LuyenThePanel

- **Đường dẫn**: `game/src/components/panels/LuyenThePanel.vue`
- **Chức năng**: Overlay Luyện Thể — đầu tư Tinh Hoa theo tầng, toggle tự động, 6 tier (done/active/realm_locked/locked).
- **Primitives**: Bar 5px, GameButton secondary (invest), EmptyState lg.
- **Màu sắc**: active tier viền `--chrome-300`; khóa realm `--crimson`; auto label `--jade`.

### QuanKhiPanel

- **Đường dẫn**: `game/src/components/panels/QuanKhiPanel.vue`
- **Chức năng**: Overlay Quán Khí — chọn con đường tu luyện KHÔNG thể đổi (confirm danger); Kiếm Tu: chọn đường Kiếm Trận/Bạt Kiếm (reversible).
- **Primitives**: GameButton danger + **override gradient crimson chủ đích** (signaling nghi thức vĩnh viễn): `linear-gradient(180deg, --crimson, --ink-800)` viền `--chrome-500`; selected gradient jade + glow.
- **Đặc tả**: OverlayPanel 480px; nút full-width.

### SkillPathPanel

- **Đường dẫn**: `game/src/components/panels/SkillPathPanel.vue`
- **Chức năng**: Overlay Kỹ Năng 3 cột (1400px): trái SkillPathList/ElementPathList, giữa NodeTreePanel (Pháp Tu) hoặc SkillDetailView, phải SkillLoadoutStrip, đáy NodeInspector.
- **Màu sắc**: viền chia cột `--ink-line`; điểm Cảm Ngộ `--chrome-100`; cây ẩn Huy Kiếm: node `--jade` glow 18px.
- **Đặc tả**: grid `20% / auto / 22%`; node Huy Kiếm elip 112×72px.

### TechniquePanel

- **Đường dẫn**: `game/src/components/panels/TechniquePanel.vue`
- **Chức năng**: Overlay Tâm Pháp — thẻ hero (TechniqueSlotCard), thanh EXP tier (**Bar 5px**), nhóm Chiến Đấu/Tu Luyện (**Eyebrow + StatRow bordered**).
- **Đặc tả**: OverlayPanel `min(560px, 90vw)`.

### InventoryPanel / BagGrid

- **Đường dẫn**: `game/src/components/panels/InventoryPanel.vue` / `BagGrid.vue`
- **Chức năng**: InventoryPanel = wrapper mỏng. BagGrid = khung Hành Trang — header "Kho Vật / N" + **TabBar 3 tab** (Trang Bị/Nguyên Liệu/Đan Dược) đổi BagSection.
- **Đặc tả**: gần như không màu riêng — màu ở TabBar + section con.

### EquipmentHallPanel

- **Đường dẫn**: `game/src/components/panels/EquipmentHallPanel.vue`
- **Chức năng**: Khí Đường — rèn trang bị 4 tab (**TabBar**): Cường Hóa / Tẩy Luyện / Tinh Luyện / Hóa Luyện (multi-select + confirm 2 bước).
- **Primitives**: **SceneHeader fire 132px** (decoration: forge-fire + anvil ⚒), TabBar, GameButton, SlotView.
- **Màu sắc**: scene lửa — nền `--scene-fire-deep`, chữ `--scene-fire-text` `#f3cf8b`; thiếu chi phí `--crimson`; preview reward `--jade`.
- **Đặc tả**: ảnh `sepia(.18) saturate(1.25)`; forge-fire 85×95px animation 1.35s; grid slot `repeat(6, minmax(70px,1fr))` → 3 cột mobile.

### EquipmentPaperdoll

- **Đường dẫn**: `game/src/components/panels/EquipmentPaperdoll.vue`
- **Chức năng**: 6 slot trang bị lưới 3×2 — SlotView đầy đủ, click tháo đồ.
- **Đặc tả**: grid 3×2 gap 6px; slot vuông aspect 1:1; không màu riêng (token `--slot-*`).

### ArtifactPanel

- **Đường dẫn**: `game/src/components/panels/ArtifactPanel.vue`
- **Chức năng**: Overlay Bản Mệnh Pháp Bảo — ghép 4 con (Overview + ExperienceBar + GradeSection + PathCards); 2 **EmptyState lg** cho state chưa có definition / chưa thức tỉnh.
- **Đặc tả**: OverlayPanel `min(560px,92vw) × min(720px,88vh)`.

### QuestPanel

- **Đường dẫn**: `game/src/components/panels/QuestPanel.vue`
- **Chức năng**: Overlay Nhiệm Vụ — 2 nhóm (Hàng Ngày/Nhiệm Vụ), card + **Bar 6px** (override `--chrome-300` solid) + nút Nhận Thưởng (GameButton).
- **Đặc tả**: OverlayPanel 760×640.

### ProductionPanel

- **Đường dẫn**: `game/src/components/panels/ProductionPanel.vue`
- **Chức năng**: Sản Xuất — 3 card điểm tài nguyên (Lâm/Quáng/Động Thiên) sigil Hán (木/礦/藥), **Bar 8px** (fill transition .5s linear), Auto, nâng cấp; bọc BuildingConstructionGate.
- **Primitives**: Bar, GameButton (start sm primary / upgrade ghost / convert sm).
- **Màu sắc**: mỗi loại card 1 palette — forest/mine/grotto qua `--scene-forest/mine/grotto-*`; stats `--jade`.

### PillRoomPanel

- **Đường dẫn**: `game/src/components/panels/PillRoomPanel.vue`
- **Chức năng**: Đan Phòng — 2 tầng: AlchemyView (60%) + PillBagSection (40%).
- **Đặc tả**: chỉ viền chia `--ink-line` — màu ở 2 con.

### AlchemyView

- **Đường dẫn**: `game/src/components/panels/AlchemyView.vue`
- **Chức năng**: Luyện Đan 2 cột — **SceneHeader fire 150px** (lõi đan 丹) + 8 đan phương / preview, chi phí (**StatRow negative khi thiếu**), nút Bắt đầu luyện (GameButton **accentVar `--scene-fire-text`**), lò đang chạy (**Bar 6px**) + Huỷ (ghost).
- **Màu sắc**: scene lửa — nút luyện gradient vàng lửa; outcome `--jade`; thiếu/huỷ `--crimson`.

### SpiritSpringPanel

- **Đường dẫn**: `game/src/components/panels/SpiritSpringPanel.vue`
- **Chức năng**: Linh Tuyền — **SceneHeader water 210px** (orb animation) + **Bar 8px pill** (override `--scene-water-accent → --jade`) + Thu hoạch / đổi phẩm (GameButton override nền azure đặc).
- **Đặc tả**: orb 42px animation `spring-orb` 2.2s (nổi -8px + scale 1.08).

### StageSelectPanel

- **Đường dẫn**: `game/src/components/panels/StageSelectPanel.vue`
- **Chức năng**: Chọn trận — **SceneHeader portal 118px** (row copy + vòng 界) → filter Địa Giới/Cảnh Giới (**Chip portal-teal override**) → tầng map 5 cột → chế độ (**Chip ×3**: Thủ Công/Lặp Lại/Tự Động) → Bắt đầu (GameButton).
- **Màu sắc**: nền `--scene-portal-deep` teal; node boss/final `--crimson`; BOSS chữ `--crimson` 62% + white.
- **Đặc tả**: grid 5 cột node min-height 94px; 2 EmptyState (chưa có tầng sm / chọn tầng lg).

### ScripturePavilionPanel

- **Đường dẫn**: `game/src/components/panels/ScripturePavilionPanel.vue`
- **Chức năng**: Tàng Kinh Các — **TabBar layout row 2 tab** (Công Pháp / Lore) đổi TechniqueCodex / LoreCodex.
- **Đặc tả**: gần như không màu riêng — chỉ khung điều phối.

### LoreCodexModal

- **Đường dẫn**: `game/src/components/panels/LoreCodexModal.vue`
- **Chức năng**: Modal đọc lore item (Teleport) — nút Đóng (GameButton secondary sm).
- **Màu sắc**: backdrop `--scrim`; panel `--ink-900` viền `--chrome-500`.
- **Đặc tả**: `min(340px,92vw)` → max 480px, max-height 84vh; `white-space: pre-line`.

### SettingsPanel

- **Đường dẫn**: `game/src/components/panels/SettingsPanel.vue`
- **Chức năng**: Cài Đặt — save (lưu/tải/xuất/nhập/xoá qua ConfirmModal) + cỡ chữ UI 90–125% (**Chips** `--chip-active-bg: --chrome-300 12%`).
- **Đặc tả**: radius `--radius-sm`; input file ẩn phủ label.

### BuildingPanelHeader

- **Đường dẫn**: `game/src/components/panels/BuildingPanelHeader.vue`
- **Chức năng**: Header panel công trình — ảnh tròn, tên + cấp, nút Nâng (GameButton sm + viền `--chrome-300` riêng).
- **Màu sắc**: gradient ngang `--ink-900 → --ink-950`; artwork viền `--chrome-500` 40% + glow; cấp `--jade`.
- **Đặc tả**: min-height 88px; artwork 74×64px `border-radius: 50% 50% --radius-sm --radius-sm`.

### BuildingConstructionGate

- **Đường dẫn**: `game/src/components/panels/BuildingConstructionGate.vue`
- **Chức năng**: Gate công trình — chưa xây hiện màn khóa (icon chữ + chi phí + nút Xây Dựng GameButton); đã xây render slot.
- **Đặc tả**: màn khóa căn giữa cột; disabled opacity .5.

---

## 6. Panel con — skill-path (4)

### SkillPathList

- **Đường dẫn**: `game/src/components/panels/skill-path/SkillPathList.vue`
- **Chức năng**: Cột trái cho MỌI path — list skill nhóm theo cảnh giới (ElementPathList cũ đã gỡ 2026-08-29; mọi path dùng chung list này).
- **Màu sắc**: card `--ink-800`; selected nền `--chrome-300` 18% + viền `--chrome-300`.

### SkillDetailView

- **Đường dẫn**: `game/src/components/panels/skill-path/SkillDetailView.vue`
- **Chức năng**: Cột giữa path không Node Tree — chi tiết skill: tên, mô tả, nút Nâng Cấp (GameButton ghost + viền `--chrome-500`), bảng thông số (**StatRow bordered ×3**); EmptyState lg khi chưa chọn.
- **Đặc tả**: empty padding 40px.

### SkillLoadoutStrip

- **Đường dẫn**: `game/src/components/panels/skill-path/SkillLoadoutStrip.vue`
- **Chức năng**: Dải "Pháp Thuật Đang Vận Hành" — ô loadout (SlotView) mở RadialSkillSelector; nút specialization (**Chips** `--chip-active-bg: --ink-700`); slot khóa mờ opacity .45.
- **Đặc tả**: slot flex `1 1 30%` min-width 64px tự wrap.

### NodeInspector

- **Đường dẫn**: `game/src/components/panels/skill-path/NodeInspector.vue`
- **Chức năng**: Đáy SkillPathPanel — chi tiết node: badge cấp, trạng thái (Đã Lĩnh Ngộ `--jade` / Có Thể `--chrome-100` / Chưa Đủ `--text-muted`), lý do khóa `--crimson`, stat ảnh hưởng (**StatRow bordered**), nút Lĩnh Ngộ/Nâng Cấp (GameButton sm viền `--chrome-100`); EmptyState lg.
- **Đặc tả**: badge pill 999px.

---

## 7. Panel con — bag-sections (4)

### PillBagSection

- **Đường dẫn**: `game/src/components/panels/bag-sections/PillBagSection.vue`
- **Chức năng**: Grid đan dược — buff regen đang chạy deadline thật, tooltip đầy đủ, sort 4 mode + pagination, click uống đan.
- **Màu sắc**: buff box `--ink-800` viền `--jade`; giá trị `--jade`; đếm ngược `--chrome-500`.
- **Đặc tả**: grid responsive ResizeObserver (`--grid-columns` động); slot vuông 1:1; màu phẩm qua `--grade-*`.

### MaterialBagSection

- **Đường dẫn**: `game/src/components/panels/bag-sections/MaterialBagSection.vue`
- **Chức năng**: Grid nguyên liệu — sort 5 mode, Linh Thạch ghim đầu, tooltip phân loại/nguồn/niên đại; thuần hiển thị.
- **Đặc tả**: không màu riêng — SlotView + grade token.

### EquipmentBagSection

- **Đường dẫn**: `game/src/components/panels/bag-sections/EquipmentBagSection.vue`
- **Chức năng**: Grid trang bị chưa mặc — click mặc; tooltip Alt so sánh; sort 6 mode.
- **Đặc tả**: không màu riêng — rank qua SlotView.

### BagPaginationControls

- **Đường dẫn**: `game/src/components/panels/bag-sections/BagPaginationControls.vue`
- **Chức năng**: Footer chung 3 bag-section — pagination `‹ 1 2 3 ›` giữa + nút sort menu thả LÊN (mode/đảo chiều/reset); khung hẹp ẩn label.
- **Màu sắc**: page active gradient bạc; menu `--ink-900` viền `--chrome-500` shadow panel.
- **Đặc tả**: grid `1fr auto 1fr`; menu z-30; container query ≤420px; sort button tự viết (aria-haspopup + SVG inline — không phải chip cluster).

---

## 8. Panel con — loadout-sections (4)

### TechniqueSlotCard

- **Đường dẫn**: `game/src/components/panels/loadout-sections/TechniqueSlotCard.vue`
- **Chức năng**: Thẻ Tâm Pháp trang bị (thuần hiển thị) — SlotView + tên + badge tier + **Bar 4px** + "X/Y" hoặc "Viên Mãn"; biến thể `hero` layout dọc + badge "ĐANG TU LUYỆN".
- **Màu sắc**: badge tier viền `--chrome-500`; status `--jade`; Bar house style.
- **Đặc tả**: normal icon 56px / hero icon 46% width; v-tooltip cấu trúc.

### RadialSkillSelector

- **Đường dẫn**: `game/src/components/panels/loadout-sections/RadialSkillSelector.vue`
- **Chức năng**: Overlay chọn skill vòng tròn — skill viable xếp quanh tâm (trigonometry JS), tâm hiện slot + nút Gỡ.
- **Màu sắc**: backdrop `--scrim`; tâm `--ink-900` viền `2px --chrome-300` + glow; Gỡ `--crimson`; current `--jade`.
- **Đặc tả**: tâm 88px; item 72px; bán kính min 108px tự tính.

### NodeTreePanel

- **Đường dẫn**: `game/src/components/panels/loadout-sections/NodeTreePanel.vue`
- **Chức năng**: Cây node Pháp Tu theo branch — depth thật, node card click chọn, SVG SkillConnections, animation unlock 2 pha (flow 750ms → pulse/ring 500ms).
- **Màu sắc**: node `--ink-800`; purchased nền `--branch-color` 18%; viền theo `--branch-color` (màu hành); unlocking `--chrome-300` + glow 14px.
- **Đặc tả**: node 140px; tier cách 22px; locked opacity .5 vẫn click.

### SkillConnections

- **Đường dẫn**: `game/src/components/panels/loadout-sections/SkillConnections.vue`
- **Chức năng**: Layer SVG đường nối parent→child — 3 trạng thái locked/active/unlocking.
- **Màu sắc**: stroke `--branch-color` opacity .3/.75; unlocking `--chrome-300` 2.5px + drop-shadow.
- **Đặc tả**: bezier; unlocking `stroke-dasharray: 10 8` animation flow 750ms.

---

## 9. Panel con — scripture (2)

### TechniqueCodex

- **Đường dẫn**: `game/src/components/panels/scripture/TechniqueCodex.vue`
- **Chức năng**: Tab Công Pháp — 1 thẻ hero + grid SlotView mọi công pháp; chưa học "???" mờ không click.
- **Đặc tả**: slot 56px flex wrap; locked opacity .45 `pointer-events: none`.

### LoreCodex

- **Đường dẫn**: `game/src/components/panels/scripture/LoreCodex.vue`
- **Chức năng**: Tab Lore — grid item lore ĐÃ NHẶT; click mở LoreCodexModal; **EmptyState** khi rỗng.
- **Đặc tả**: grid slot 56px flex wrap.

---

## 10. Panel con — artifact (4)

### ArtifactOverview

- **Đường dẫn**: `game/src/components/panels/artifact/ArtifactOverview.vue`
- **Chức năng**: Vùng 1 — icon chữ "珠" (fallback chưa có art), tên pháp bảo + meta "Nghề · Phẩm".
- **Màu sắc**: icon radial `--chrome-500 → --ink-900` viền `--chrome-500` glow bạc.
- **Đặc tả**: icon tròn 64px.

### ArtifactExperienceBar

- **Đường dẫn**: `game/src/components/panels/artifact/ArtifactExperienceBar.vue`
- **Chức năng**: Vùng 2 — thanh EXP pháp bảo (**Bar 8px**) 3 trạng thái màu hóa qua override var: training `--chrome-300` / capped `--azure` / viên mãn `--jade`; track `--ink-950`.
- **Đặc tả**: head row + status message.

### ArtifactGradeSection

- **Đường dẫn**: `game/src/components/panels/artifact/ArtifactGradeSection.vue`
- **Chức năng**: Vùng 3 — bảng Phẩm / hệ số / thạch (**StatRow ×3**, value `--chrome-100` 600) + nút Nâng Phẩm (GameButton sm viền `--chrome-500`).
- **Đặc tả**: disabled trong suốt opacity .4.

### ArtifactPathCards

- **Đường dẫn**: `game/src/components/panels/artifact/ArtifactPathCards.vue`
- **Chức năng**: Vùng 4 — 3 card hướng Công/Thủ/Khống, milestone tầng 1/3/6/12/18 (dot unlock + tooltip); chọn reversible ngoài combat.
- **Màu sắc**: **path màu** qua `--path-color` — attack `--crimson` / defense `--azure` / control `--jade`; selected nền color-mix 16% + viền + glow; milestone unlocked nền `--path-color` 22%.
- **Đặc tả**: card cột; milestone flex:1 bo 3px; locked opacity .4.

---

## 11. Combat — game/combat/ (10)

### CombatSceneOverlay

- **Đường dẫn**: `game/src/components/game/combat/CombatSceneOverlay.vue`
- **Chức năng**: Khung xương UI Combat Scene — TopBar → StatusBar → battlefield (canvas xuyên qua + AiPanel/BuildHud) → EventBar → ControlBar + ResultModal + CountdownOverlay; ResizeObserver cấp `combatInsets` xuống Phaser.
- **Đặc tả**: `absolute inset 0 z-15` flex column; cao bar chuẩn hóa clamp (topbar 46–72 / status 44–68 / event 32–48 / control 48–76px).

### CombatTopBar

- **Đường dẫn**: `game/src/components/game/combat/CombatTopBar.vue`
- **Chức năng**: Thanh trên — tên Địa Giới • Màn + tiến độ quái.
- **Màu sắc**: nền `--ink-950` 70% + blur 6px; title `--chrome-100` Noto Serif.

### CombatStatusBar

- **Đường dẫn**: `game/src/components/game/combat/CombatStatusBar.vue`
- **Chức năng**: Thanh số liệu người chơi — HP (luôn), MP (Pháp Tu), tài nguyên Nộ/Kiếm Ý; **3 × Bar 14px** với label trong bar.
- **Màu sắc**: fill HP `--hp-color` / MP `--jade` / Nộ `--gold-500` (solid — `--bar-from = --bar-to`); track `--ink-900` viền `--ink-line`; label text-shadow đen.
- **Đặc tả**: cột player `min(260px, 30vw)`; fill .15s ease.

### CombatEventBar

- **Đường dẫn**: `game/src/components/game/combat/CombatEventBar.vue`
- **Chức năng**: Feed sự kiện đáng chú ý — phản ứng ngũ hành 🔥 / Chí Mạng 💥 / Hạ Gục ☠.
- **Đặc tả**: max 6 entry 3.5s; `pointer-events: none`.

### CombatControlBar

- **Đường dẫn**: `game/src/components/game/combat/CombatControlBar.vue`
- **Chức năng**: Thanh dưới — nút ✕ Thoát Trận (GameButton secondary, hover crimson) + modal xác nhận (2 GameButton: Ở Lại secondary / Thoát Trận danger); slider Bạt Kiếm 3–9s.
- **Màu sắc**: bar `--ink-950` đặc viền `--ink-line`; modal viền `--crimson`.

### CombatResultModal

- **Đường dẫn**: `game/src/components/game/combat/CombatResultModal.vue`
- **Chức năng**: Wrapper backdrop kết quả (chỉ trận Stage) — chọn Victory/Defeat panel.
- **Đặc tả**: `absolute inset 0 z-30` flex center; backdrop `--scrim`.

### CombatVictoryPanel

- **Đường dẫn**: `game/src/components/game/combat/CombatVictoryPanel.vue`
- **Chức năng**: "★ THẮNG ★" — rewards tích lũy; auto: Đánh Lại + đếm 3s (progress leo màn); manual: thêm Tiếp Tục.
- **Primitives**: 2 GameButton (primary Đánh Lại / secondary Tiếp Tục).
- **Màu sắc**: panel `--ink-900` **viền `--chrome-500`** (bạc = thắng); giá trị reward `--jade`.

### CombatDefeatPanel

- **Đường dẫn**: `game/src/components/game/combat/CombatDefeatPanel.vue`
- **Chức năng**: "☠ THẤT BẠI" — rewards; Tái Chiến (GameButton danger) + Về Động Phủ (secondary, hover crimson); auto repeat đếm 3s; fallback 10s.
- **Màu sắc**: panel `--ink-900` **viền `--crimson`**; title `--crimson`.

### CombatCountdownOverlay

- **Đường dẫn**: `game/src/components/game/combat/CombatCountdownOverlay.vue`
- **Chức năng**: Đếm ngược 3-2-1-Xuất Trận!
- **Màu sắc**: chữ `--chrome-100`; text-shadow kép glow 24px + đen.
- **Đặc tả**: `--text-hero` (96px) Noto Serif 700; animation pop `scale 1.6→1` .3s.

### CombatAiPanel

- **Đường dẫn**: `game/src/components/game/combat/CombatAiPanel.vue`
- **Chức năng**: Radio 5 chiến lược AI mục tiêu (Gần nhất/Ưu tiên Boss/Elite/HP thấp/HP cao) góc trái battlefield.
- **Màu sắc**: nền `--scrim` + blur 2px; radio `accent-color: --chrome-300`.
- **Đặc tả**: font `--text-xs`; option `--tap-min`; tĩnh.

---

## 12. Combat HUD — game/combat/hud/ (6)

### CombatBuildHud

- **Đường dẫn**: `game/src/components/game/combat/hud/CombatBuildHud.vue`
- **Chức năng**: Wrapper chọn HUD theo phái — `phap_tu` → PhapTu, `kiem_tu` → KiemTu, mặc định → Mortal.

### CombatSkillSlot

- **Đường dẫn**: `game/src/components/game/combat/hud/CombatSkillSlot.vue`
- **Chức năng**: Ô kỹ năng chung mọi phái — bọc SlotView + mask cooldown dọc, số đếm thập phân, **cast bar Bar 3px** chìa `bottom: -6px` (override `--bar-from = --bar-to = --jade`, transition .05s), chi phí góc, filter xám khi thiếu tài nguyên/out-of-range.
- **Đặc tả**: mask height % transition .1s; số đếm Noto Serif `--text-lg`.

### MortalCombatHud

- **Đường dẫn**: `game/src/components/game/combat/hud/MortalCombatHud.vue`
- **Chức năng**: HUD Phàm Nhân — đúng 1 ô lớn Trảm (cadence Attack Speed, mask nội suy mượt).
- **Đặc tả**: container + slot **88px**.

### PhapTuCombatHud

- **Đường dẫn**: `game/src/components/game/combat/hud/PhapTuCombatHud.vue`
- **Chức năng**: HUD Pháp Tu — 5 ô skill luôn dựng đủ (trống/khóa/unreleased hiện rõ) + 1 ArtifactCombatSlot.
- **Đặc tả**: flex wrap center gap `--space-2`; slot **72px**.

### KiemTuCombatHud

- **Đường dẫn**: `game/src/components/game/combat/hud/KiemTuCombatHud.vue`
- **Chức năng**: HUD Kiếm Tu — ô Ngự Kiếm (cadence) 88px đứng riêng + 2 kỹ năng chuỗi 72px nối "→" (vận kiếm), không copy dải 5 ô Pháp Tu.
- **Màu sắc**: link "→" `--chrome-300`.

### ArtifactCombatSlot

- **Đường dẫn**: `game/src/components/game/combat/hud/ArtifactCombatSlot.vue`
- **Chức năng**: Ô Bản Mệnh pháp bảo (Ngũ Hành Châu 珠) — KHÔNG dùng Bar (mask cooldown dọc riêng, height-driven); icon 珠, dot hành kế tiếp, badge stack khống chế / ★ sẵn sàng.
- **Màu sắc**: slot `--ink-800` viền `1px --el-color` (động theo hành kế); stacks `--crimson`; ready gradient bạc.

---

## 13. Game / Scene — game/ (7)

### PhaserCanvas

- **Đường dẫn**: `game/src/components/game/PhaserCanvas.vue`
- **Chức năng**: Phaser canvas wrapper duy nhất — 1 game transparent (arcade physics) chứa 3 scene [Main, Combat, Tribulation]; ResizeObserver; EventBus bridge.
- **Đặc tả**: `100% × 100%`; cleanup đầy đủ onUnmounted.

### MainScene

- **Đường dẫn**: `game/src/components/game/MainScene.vue`
- **Chức năng**: Container viewport — DongFuScene (DOM overlay) đè PhaserCanvas; combat thì DongFuScene ẩn.
- **Màu sắc**: nền `--ink-950`.

### DongFuScene

- **Đường dẫn**: `game/src/components/game/DongFuScene.vue`
- **Chức năng**: Thế giới home Động Phủ — nền art PNG (1672×941 cover) + fallback gradient CSS; Linh Nhãn 3 vòng trận pháp; 4 particle linh khí; nhân vật tu luyện là nút trigger command wheel; vignette.
- **Màu sắc**: sky gradient `#0a0a0d → #131318 → #1b1b22`; Linh Nhãn vòng `--chrome-500` 30–48% + outer `--azure` 25% glow blur 6px; motes `--chrome-100`; vignette `rgba(0,0,0,.5)`.
- **Đặc tả**: Linh Nhãn `perspective(320px) rotateX(64deg)` pulse 4.5s/3.2s; motes 3px 7s.

### HomeBuildingIcons

- **Đường dẫn**: `game/src/components/game/HomeBuildingIcons.vue`
- **Chức năng**: Hotspot các tòa nhà trên art — nút vô hình theo % tọa độ, hover outline + VFX theo loại + label cấp.
- **Màu sắc**: accent mỗi building — Đan Phòng `--el-fire`, Khí Đường `--crimson`, Trận Pháp `--chrome-500`, Linh Tuyền `--azure`, Tiền哨 `--text-muted`; outline/hover-label/glow color-mix theo accent.
- **Đặc tả**: hotspot ellipse `border-radius: 46%`; VFX 5 loại — portal 3 vòng xoay, alchemy/forge 3 dot bay, spring/gather ripple; prefers-reduced-motion tắt VFX.

### DongFuCommandWheel

- **Đường dẫn**: `game/src/components/game/DongFuCommandWheel.vue`
- **Chức năng**: Bảng lệnh command wheel 2 quỹ đạo tròn — click nhân vật mở; slot fan-out cung xoắn 112°, 2 vòng quay ngược chiều; backdrop/Escape/Tab đóng.
- **Màu sắc**: slot `--ink-900` 88% viền `--ink-line` → hover `--chrome-300`; **ring identity viền trái 3px**: ring1 `--chrome-500` / ring2 `--azure` / ring3 `--jade` / ring4 `--el-primordial`.
- **Đặc tả**: slot pill 999px min 57px; tâm left 50% top 66%; bán kính adaptive `clamp(96–340px)`; fan-out 320ms cubic-bezier transform chain giữ chữ thẳng.

### BuildingDetailPopover

- **Đường dẫn**: `game/src/components/game/BuildingDetailPopover.vue`
- **Chức năng**: Popover chi tiết building chưa xây — tên/mô tả/chi phí (**Eyebrow + StatRow tone negative khi thiếu**) + nút Xây Dựng (GameButton primary).
- **Màu sắc**: gradient mực + `.ornate-frame`; thiếu `--crimson` (qua StatRow negative).
- **Đặc tả**: radius `--radius-md`; min 260 / max 320px; max-height `calc(100vh - 48px)` scroll.

### TribulationSceneOverlay

- **Đường dẫn**: `game/src/components/game/tribulation/TribulationSceneOverlay.vue`
- **Chức năng**: Overlay Thiên Kiếp — đồng hồ đếm ngược + **2 Bar 8px**: time thu từ phải (`anchor="right"`, gradient `#7658d6 → #9edaff+white`) + HP (solid `#d34c4c`); track `--scene-tribulation-deep` viền `#9edaff`.
- **Đặc tả**: timer `--text-display-lg` 800 glow `#69bfff`; track `min(340px, 80vw)`; neo theo tỉ lệ viewport khớp Phaser; fill .15s linear; z-15.

---

## 14. Onboarding — onboarding/ (2)

### AuthEntryScreen

- **Đường dẫn**: `game/src/components/onboarding/AuthEntryScreen.vue`
- **Chức năng**: Đăng nhập/đăng ký (login ID + mật khẩu) hoặc guest (dừng Trúc Cơ).
- **Màu sắc**: nền radial 3 stop (chrome-700 8% tint → `--ink-900` → `--ink-950`) + lưới chấm 44px opacity .1 + 2 vòng sương `--chrome-500` blur 80px; card gradient mực + shadow kép; con dấu 仙 viền `--chrome-100`; tab underline active `--chrome-100` + gạch 2px `--chrome-500`; input focus viền `--chrome-300`; lỗi `--crimson`; dot server `--jade` glow.
- **Đặc tả**: card `min(390px, ...)` padding 34px; seal 54px xoay 45°; eyebrow letter-spacing .28em.

### CharacterCreationScreen

- **Đường dẫn**: `game/src/components/onboarding/CharacterCreationScreen.vue`
- **Chức năng**: Wizard 3 bước tạo nhân vật — Đạo danh → chọn Thiên Phú (reroll) → phân bổ 5 điểm căn cơ.
- **Màu sắc**: nền radial như AuthEntry; panel gradient mực + `.ornate-frame`; talent card selected viền `--chrome-300` + inset ring + glow 12%; tier thiên phú → `--rank-color-1/3/5/7/8`; counter hợp lệ `--jade`; lỗi `--crimson`.
- **Đặc tả**: stepper 26px tròn nối kẻ 1px; talent grid 3 cột min-height 128px hover `translateY(-2px)`.

---

## 15. Quy ước pattern toàn UI

> Sau primitives refactor (2026-08-29), các pattern từng bị ~90 chỗ tự viết đã **hợp nhất** về 1 nguồn sự thật. Bảng này là quy ước bắt buộc khi viết UI mới.

| Pattern                    | Nguồn sự thật                                                                | Ghi chú                                                                                                                        |
| -------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Progress bar**           | `primitives/Bar.vue`                                                         | house style: track `--ink-700` + fill `--jade → --chrome-300`; override qua `--bar-track/--bar-from/--bar-to`, solid = from=to |
| **Nút chính (CTA)**        | `GameButton` primary                                                         | gradient bạc `--chrome-100 → --chrome-500`, chữ `--ink-950`                                                                    |
| **Nút danger**             | `GameButton` danger                                                          | nền `--crimson` phẳng, chữ trắng                                                                                               |
| **Nút scene accent**       | `GameButton` + `accentVar`                                                   | gradient đổ từ CSS var scene (lò đan, linhduyền)                                                                               |
| **Nút icon tròn**          | `GameButton` + `shape="circle"`                                              | nút "+" allocate stat                                                                                                          |
| **Panel modal**            | gradient `160deg --ink-950 → --ink-800` + `.ornate-frame` + `--shadow-panel` | ConfirmModal, Error, Save, Tutorial...                                                                                         |
| **OverlayPanel**           | gradient `155deg --ink-800 → --ink-950` viền `--chrome-500`                  | mọi panel chức năng                                                                                                            |
| **Tab / filter chip**      | `primitives/Chip.vue` + `TabBar`                                             | công thức idle `--ink-800`/`--ink-line-soft`/`--text-secondary` → active `--chrome-300`/`--chrome-100` + `--chip-active-bg`    |
| **Section title**          | `primitives/Eyebrow.vue`                                                     | uppercase, `--eyebrow-tracking` .04em                                                                                          |
| **Stat row**               | `primitives/StatRow.vue`                                                     | value `tabular-nums`, tone jade/crimson/chrome/muted                                                                           |
| **Empty state**            | `primitives/EmptyState.vue`                                                  | size sm/md/lg, framed dashed                                                                                                   |
| **Scene header**           | `SceneHeader.vue`                                                            | asset + scene token map + slot decoration                                                                                      |
| **Thành công / thiếu sót** | `--jade` / `--crimson`                                                       | toàn UI                                                                                                                        |
| **Chữ số**                 | `font-variant-numeric: tabular-nums`                                         | mọi giá trị count/đếm                                                                                                          |
| **Accessibility**          | `--tap-min` 40px, focus ring bạc, aria role, prefers-reduced-motion          | toàn UI                                                                                                                        |

### Ngoại lệ có chủ đích (không dùng primitive)

- `ArtifactCombatSlot` — mask cooldown **dọc** height-driven, không phải bar ngang.
- `BagPaginationControls` sort button — nút đơn có `aria-haspopup` + SVG inline, không phải chip cluster.
- `AuthEntryScreen` tab underline + `CharacterCreationScreen` stepper + `DongFuCommandWheel` radial — chủ đích visual khác biệt.
- `QuanKhiPanel` nút chọn path — giữ gradient crimson (nghi thức không hoàn tác), override cục bộ trên GameButton danger.

### Điểm cần biết khi thêm UI mới

1. Bar/nút/chip/title/row/empty/scene-header: **dùng primitive trước**, chỉ override CSS var — không tự viết CSS mới.
2. Màu mới: thêm token vào `theme.css`, không hex cứng trong component.
3. Chiều cao nút bấm ≥ `--tap-min`; số liệu `tabular-nums`; animation tôn trọng `prefers-reduced-motion`.

---

## 16. Fit-refactor (2026-08-29) — panel tự co giãn mọi tỉ lệ

Spec đã được thực hiện qua branch `ui-fit-refactor` (merged 2026-08-29) — nguồn tham khảo: git history của branch.

### Nguyên tắc

- Panel = **ngân sách flex**: chrome (scene/tabs/header) co giãn bằng `clamp(vh)`, phần còn lại cho nội dung.
- **0 scrollbar**: scrollbar ẩn toàn cục (theme.css); list vô hạn → **phân trang đo ngân sách** (`usePanelPagination` — ResizeObserver đo chiều cao thật, pageSize reactive, tự lùi trang); vùng "đọc" (cây node, form) wheel-scroll ẩn thanh + fade-edge `.scrollfade`.
- **Container query đo theo CARD**: `.overlay-panel__card { container-type: inline-size }` — breakpoint panel con theo `@container overlay-panel (max-width: ...)`, không còn lệch viewport.
- Floor đọc được: `--text-xs`×ui-scale, hàng ≥ `--tap-min`.

### Thay đổi chính

- **OverlayPanel** body: `overflow: auto` → flex budget column (fit-engine).
- **SceneHeader**: `height` nhận chuỗi CSS; 4 scene chrome clamp vh (rèn 72–132, lò 88–150, portal 72–118, spring 96–210).
- **SkillPathPanel**: 3 cột stack dọc `@container 900px`; cột bên cap `min(20%/22%, 280/300px)`.
- **CharacterPanel**: pentagram container-relative (%, clamp 180–260px), tự co < 260px; pill-usage flex-wrap.
- **RealmPanel**: 9 node auto-fit `minmax(min(108px,100%),1fr)` — hết dead zone 901–957px.
- **Khí Đường Hóa Luyện + 2 codex (Technique/Lore)**: phân trang theo ngân sách chiều cao (`usePanelPagination`, row 55/62px).
- **Drawer**: floor 260px dưới 900px, full-width < 620px.
- **theme.css**: utility `.scrollfade` (mask fade-edge cho vùng wheel-scroll ẩn thanh).
- Composable mới: `src/composables/usePanelPagination.ts`.
