# UI Components — Danh mục đặc tả toàn bộ giao diện

> Tài liệu liệt kê **toàn bộ 99 UI component Vue** của project kèm đường dẫn, chức năng, màu sắc đang dùng và đặc tả trực quan.
> Nguồn sự thật về màu: `game/src/assets/theme.css` (theme **"Mực & Bạc"** — Ink & Silver).
>
> - Stack: Vue 3 + TypeScript, CSS scoped thuần (89/90 file dùng `<style scoped>`; riêng `App.vue` dùng global).
> - Không dùng UI library (Tailwind/Element Plus...) hay preprocessor (Sass/Less).
> - Gần như **100% màu đi qua CSS variables** — hex cứng rất hiếm (chỉ shadow `rgba(0,0,0,…)`).

---

## Mục lục

1. [Hệ màu chuẩn (theme.css)](#1-hệ-màu-chuẩn-themecss)
2. [Common (21)](#2-common--game-srccomponentscommon)
3. [Layout (4)](#3-layout--game-srccomponentslayout)
4. [Panels (22)](#4-panels--game-srccomponentspanels)
5. [Panel con — skill-path (5)](#5-panel-con--skill-path)
6. [Panel con — bag-sections (4)](#6-panel-con--bag-sections)
7. [Panel con — loadout-sections (4)](#7-panel-con--loadout-sections)
8. [Panel con — scripture (2)](#8-panel-con--scripture)
9. [Panel con — artifact (4)](#9-panel-con--artifact)
10. [Combat (10)](#10-combat--game-srccomponentsgamecombat)
11. [Combat HUD (6)](#11-combat-hud--game-srccomponentsgamecombathud)
12. [Game / Scene (7)](#12-game--scene--game-srccomponentsgame)
13. [Onboarding (2)](#13-onboarding--game-srccomponentsonboarding)
14. [Pattern lặp lại trên toàn UI](#14-pattern-lặp-lại-trên-toàn-ui)

---

## 1. Hệ màu chuẩn (theme.css)

**Đường dẫn**: `game/src/assets/theme.css` — font: *Noto Serif* (display, `--font-display`) + *Be Vietnam Pro* (body, `--font-body`).

### Thang nền mực (Ink)
| Token | Hex | Vai trò |
|---|---|---|
| `--ink-950` | `#0a0a0d` | Nền sâu nhất — viewport, input, track |
| `--ink-900` | `#131318` | Nền panel chính |
| `--ink-800` | `#1b1b22` | Surface nổi — nút secondary, slot filled |
| `--ink-700` | `#24242e` | Nút disabled |
| `--ink-line` | `#33333f` | Viền chuẩn |
| `--ink-line-soft` | `#24242c` | Viền mềm |

### Họ bạc (Chrome) — thay cho vàng từ 2026-08-28
| Token | Hex | Vai trò |
|---|---|---|
| `--chrome-100` | `#f4f1ea` | Bạc trắng — nút chính, title, corner |
| `--chrome-300` | `#d9d4c7` | Bạc sáng — viền đang chọn, focus |
| `--chrome-500` | `#b3ada0` | Bạc — eyebrow, viền ngoài |
| `--chrome-700` | `#7c7870` | Bạc tối — disabled, tint nền onboarding |

### Chữ / Semantic
| Token | Hex | Vai trò |
|---|---|---|
| `--text-primary` | `#ebe6d9` | Chữ chính (giấy ngà) |
| `--text-secondary` | `#b3ada0` | Chữ phụ / mô tả |
| `--text-muted` | `#7c7870` | Chữ mờ / hint |
| `--jade` | `#6fbf73` | Xanh ngọc — thành công, valid, MP |
| `--crimson` | `#e5484d` | Đỏ — lỗi, nguy hiểm, thiếu |
| `--azure` | `#5b9bd5` | Xanh dương — info, bị chặn |
| `--gold-500` | `#ffd54f` | Vàng — CHỈ là màu dữ liệu (rank 7, Nộ Khí) |
| `--hp-color` | `#d8d5cc` | Trắng xám — fill HP combat |

### Thang phẩm chất 9 bậc (dùng chung mọi SlotView/tooltip)
`--rank-color-1` xám `#8a877e` · `2` bạc `#d8d5cc` · `3` lục `#6fbf73` · `4` thanh `#33d9d9` · `5` lam `#5b9bd5` · `6` tím `#9b7de3` · `7` kim `#ffd54f` · `8` xích `#ff6b4a` · `9` `#fff6d8` + `--rank-gradient-9` (gradient 7 màu vòng).
Alias: `--eq-quality-*` (9 bậc trang bị), `--grade-*` (Hoàng/Huyền/Địa/Thiên/Tiên → rank 1/3/5/7/9), `--affix-tier-1..5` (→ rank 1/3/5/7/9), `--affix-exalted` `#e8c74a`.

### Ngũ Hành + mở rộng
Mộc `#7cb342` · Hỏa `#e53935` · Thổ `#a1795a` · Kim `#cfd8dc` · Thủy `#42a5f5` · Hỗn Nguyên `#9b5de5` · Phong `#4dd0e1` · Lôi `#ffca28`.

### Scene tokens (palette theo khu chức năng)
| Khu | Token | Màu chủ đạo |
|---|---|---|
| Khí Đường / Đan Phòng | `--scene-fire-*` | Ember cam (`#15100d`, accent `#e0a45b`, text `#f3cf8b`) |
| Địa Giới (teleport) | `--scene-portal-*` | Teal (`#0c181c`, accent `#72c5d8`) |
| Linh Tuyền | `--scene-water-*` | Azure (`#0a1216`, accent `--azure`) |
| Sản Xuất — Lâm/Quáng/Động | `--scene-forest/mine/grotto-*` | Xanh rừng / nâu vàng / teal |
| Thiên Kiếp | `--scene-tribulation-*` | Xanh-tím (`#08101e`, line `#9edaff`, time `#7658d6`, hp `#d34c4c`) |

### Kích thước / hiệu ứng
| Token | Giá trị |
|---|---|
| `--radius-sm` / `--radius-md` | `4px` / `8px` |
| `--shadow-panel` | `0 8px 24px rgba(0,0,0,0.45)` |
| `--shadow-glow-chrome` | `0 0 12px rgba(217,212,199,0.35)` |
| `--scrim` / `--scrim-heavy` | `rgba(8,9,13,.76)` / `rgba(5,5,8,.92)` |
| `--focus-ring-chrome` | `0 0 0 2px rgba(217,212,199,0.65)` |
| `--space-1..6` | `4/8/12/16/24px` (không nhân ui-scale) |
| `--text-xs…hero` | `12/13/14/15/16/18/20/24/32/96px` × `var(--ui-scale,1)` (set runtime qua Settings) |
| `--tap-min` / `--tap-comfortable` | `40px` / `44px` × ui-scale |
| Class `.ornate-frame` | Khung triện 3 lớp bạc (outer `--chrome-500` + inner `--chrome-300` + corner `--chrome-100`) — thả `<span class="ornate-frame" />` là có |

---

## 2. Common — `game/src/components/common/`

### GameButton
- **Đường dẫn**: `game/src/components/common/GameButton.vue`
- **Chức năng**: Nút chuẩn toàn game — spinner loading, hover nhấc nhẹ.
- **Props**: `variant` (primary/secondary/danger/ghost), `size` (sm/md/lg), `disabled`, `loading`.
- **Màu sắc**:
  - Primary: gradient `--chrome-100 → --chrome-500`, chữ `--ink-950`, hover glow `--shadow-glow-chrome`
  - Secondary: nền `--ink-800`, viền `--ink-line`, hover viền `--chrome-300`
  - Danger: nền `--crimson`, chữ `#fff`, hover glow đỏ
  - Ghost: trong suốt, chữ `--text-secondary`, hover `--chrome-100`
- **Đặc tả**: radius `--radius-sm`; font-weight 700; sm `--tap-min`/md `--tap-comfortable`/lg +8px; disabled opacity .55; hover `translateY(-1px)`.

### GamePanel
- **Đường dẫn**: `game/src/components/common/GamePanel.vue`
- **Chức năng**: Panel nền chuẩn mọi khối nội dung — header (title + slot header-actions) + body slot.
- **Props**: `title?`, `variant` (default/compact/ornate), `padding` (none/sm/md).
- **Màu sắc**: default gradient `160deg --ink-900 → --ink-800`, viền `--ink-line`; ornate gradient `--ink-950 → --ink-800` + `.ornate-frame`; title `--chrome-100`.
- **Đặc tả**: radius `--radius-md` (compact `--radius-sm`), shadow `--shadow-panel`; title Noto Serif `--text-panel-title` letter-spacing .04em.

### OverlayPanel
- **Đường dẫn**: `game/src/components/common/OverlayPanel.vue`
- **Chức năng**: Overlay dialog giữa màn hình dùng chung — click backdrop để đóng (khác ConfirmModal).
- **Props**: `open`, `title`, `width` (default `min(900px, 94vw)`), `height`, `layer` (z-index).
- **Màu sắc**: backdrop `--scrim` + blur 4px; card gradient `155deg --ink-800 → --ink-950`, viền `1px --chrome-500`; h3 `--chrome-100`.
- **Đặc tả**: max-height 94vh, radius `--radius-md`, shadow `--shadow-panel`; nút ✕ vuông `--tap-min`; enter/leave `translateY(12px) scale(.985)` 0.2s.

### ProgressBar
- **Đường dẫn**: `game/src/components/common/ProgressBar.vue`
- **Chức năng**: Thanh tiến độ chuẩn — nhãn % tùy chọn.
- **Props**: `value`, `max`, `variant` (gold/jade/crimson/azure), `showLabel`.
- **Màu sắc**: track `--ink-800` viền `--ink-line-soft`; gold = gradient `--chrome-100 → --chrome-500` + glow; jade/crimson/azure = màu đặc; label `--text-primary` + text-shadow đen.
- **Đặc tả**: cao 10px (có label 14px), radius `999px`, transition width 200ms, đầy đủ aria `role="progressbar"`.

### TabBar
- **Đường dẫn**: `game/src/components/common/TabBar.vue`
- **Chức năng**: Thanh tab điều hướng dạng grid, badge số tùy chọn (NotificationBadge).
- **Props**: `tabs` ({id, label, badge?}[]), `modelValue` (v-model), `columns`.
- **Màu sắc**: item `--ink-800` viền `--ink-line-soft` chữ `--text-secondary`; active viền `--chrome-300` chữ `--chrome-100`.
- **Đặc tả**: grid `repeat(columns, 1fr)`; item `min-height: --tap-min`, radius `--radius-sm`, font `--text-xs`; badge offset `-4px`.

### SlotView
- **Đường dẫn**: `game/src/components/common/SlotView.vue` (+ `SlotTypes.ts`)
- **Chức năng**: Ô item generic — icon PNG/monogram chữ, tint màu theo Quality rank (1–9), chip Phẩm, glyph validation ✓/✕/!, marker ● đang mặc/NEW, mũi tên so sánh ▲/▼, badge, số lượng xN, caption tên nhiều màu, veil khóa 🔒/disabled ⊘/spinner.
- **Props**: `item` (null = trống), `icon`, `nameSegments`, `equipmentQualityRank` (1–9 → `--rank-color-N`), `rarityRank`, `state` (5 trục semantic), `badges`, `amount`...
- **Màu sắc**: surface trống `--slot-surface` (`--ink-900`) / có item `--slot-surface-raised` (`--ink-800`); viền theo `--slot-quality-color`; rank 9 glow + gradient 7 màu `--rank-gradient-9`; valid `--jade`, invalid `--crimson`; monogram nền `--ink-700`.
- **Đặc tả**: aspect-ratio 1:1, radius `--radius-sm`; icon chiếm 84%; glyph 13px top-left; chip 8px top-right; hover icon `translateY(-1px)`; dùng `aria-disabled` (giữ được tooltip).

### Tooltip
- **Đường dẫn**: `game/src/components/common/Tooltip.vue`
- **Chức năng**: Tooltip global (Teleport + Floating UI) — kind: technique / graded item (Phẩm) / equipment (Alt = advanced) / building / plain; accent động theo rank.
- **Props**: nội dung qua composable `useTooltip`; accent = `--rank-color-N` → biến `--tooltip-accent`.
- **Màu sắc**: viền trái 3px accent; nền gradient mực pha accent 12%; đường kẻ trên gradient accent; row tones: positive `--jade`, negative `--crimson`, warning `--chrome-100`, special `--affix-exalted`; tier 5 chữ gradient 7 màu.
- **Đặc tả**: max-width plain 240 / rich 320 / equipment 380px; icon-shell 54px; fade 35/30ms; tôn trọng prefers-reduced-motion.

### ToastContainer
- **Đường dẫn**: `game/src/components/common/ToastContainer.vue`
- **Chức năng**: Toast neo góc trên phải (Teleport) — toast loot có icon + eyebrow "NHẬN ĐƯỢC" + tên nhiều màu + số lượng; số toast theo chiều cao màn hình.
- **Props**: đọc từ `useNotificationStore`; màu theo kind — loot `--jade`, craft/upgrade/warning `--chrome-300`, save `--azure`, error `--crimson`.
- **Màu sắc**: nền `--ink-900` 96% alpha; viền trái 3px màu kind; icon shell gradient `--ink-700 → --ink-950`; segment max rank gradient 7 màu.
- **Đặc tả**: `top: 24px; right: 24px; z-1500`; toast max-width 160px, font `--text-xs`; enter slide `translateX(56px)` 0.4s.

### NotificationBadge
- **Đường dẫn**: `game/src/components/common/NotificationBadge.vue`
- **Chức năng**: Badge đỏ kiểu idle-game — dot (có/không) hoặc count (99+ khi vượt max).
- **Props**: `count`, `variant` (dot/count), `max` (99).
- **Màu sắc**: nền `--crimson`, viền `--ink-950`, chữ `#fff`, glow đỏ.
- **Đặc tả**: radius `999px`; dot 9×9px; count min-width 16px, font `--text-xs` 700.

### ActionFeedbackLog
- **Đường dẫn**: `game/src/components/common/ActionFeedbackLog.vue`
- **Chức năng**: "Nhật ký thao tác" — feedback các action gameplay (cường hóa/luyện đan/xây...), neo góc dưới phải.
- **Props**: đọc từ `useActionFeedbackStore`; tone entry: success/warning/error → biến `--entry-color`.
- **Màu sắc**: accent tone — success `--jade`, warning `--chrome-300`, error `--crimson`; nền `--ink-900` alpha; viền trái 3px `--entry-color`.
- **Đặc tả**: `fixed; right/bottom: 24px; z-1200`; width `min(320px, 90vw)`; entry cũ opacity .75.

### ConfirmModal
- **Đường dẫn**: `game/src/components/common/ConfirmModal.vue`
- **Chức năng**: Modal xác nhận (thay `window.confirm`) — KHÔNG đóng khi click backdrop (khác OverlayPanel).
- **Props**: `open`, `title`, `message`, `confirmLabel`, `cancelLabel`, `danger` (đổi nút confirm sang đỏ).
- **Màu sắc**: backdrop `--scrim` + blur 4px; card gradient `160deg --ink-950 → --ink-800` + `.ornate-frame`; title `--chrome-100`; message `--text-secondary`.
- **Đặc tả**: card `min(420px, 92vw)` radius `--radius-md`; title Noto Serif `--text-title`; `role="alertdialog"`; enter `translateY(12px) scale(.985)`.

### OfflineSummaryModal
- **Đường dẫn**: `game/src/components/common/OfflineSummaryModal.vue`
- **Chức năng**: "BẾ QUAN KẾT THÚC" — tổng kết thời gian + linh lực offline, 1 nút Tiếp Tục.
- **Props**: `elapsedSeconds`, `cultivation`; emit `close`.
- **Màu sắc**: GamePanel ornate (gradient mực + khung bạc); label `--text-secondary`, value `--text-primary`, gain `--jade`.
- **Đặc tả**: `z-1800` center; min-width `min(320px, 92vw)`; title Noto Serif `--text-title`.

### LoadingScreen
- **Đường dẫn**: `game/src/components/common/LoadingScreen.vue`
- **Chức năng**: Màn boot "TIÊN HIỆP IDLE" + vòng pulse.
- **Màu sắc**: nền `--ink-950`; title `--chrome-100`; vòng `2px solid --chrome-100`.
- **Đặc tả**: full 100vw×100vh center; title `--text-display` letter-spacing .12em; pulse 36px animation scale .8↔1.1 1.1s infinite.

### ErrorBoundary / ErrorScreen
- **Đường dẫn**: `game/src/components/common/ErrorBoundary.vue` / `ErrorScreen.vue`
- **Chức năng**: ErrorBoundary = renderless, bắt lỗi cây con đẩy vào errorStore. ErrorScreen = overlay full-screen khi có lỗi — Thử Lại / Về Trang Chủ.
- **Màu sắc** (ErrorScreen): backdrop `--scrim-heavy`; panel gradient `--ink-950 → --ink-800` + `.ornate-frame`; title **Đỏ `--crimson`**; message `--text-secondary`.
- **Đặc tả**: `z-3000`; panel max 420px; title Noto Serif `--text-title`.

### SaveIncompatibleScreen
- **Đường dẫn**: `game/src/components/common/SaveIncompatibleScreen.vue`
- **Chức năng**: Full-screen khi save hỏng/không tương thích — Tải save / Nhập save / Xoá & bắt đầu mới (danger, qua ConfirmModal).
- **Màu sắc**: nền `--ink-950`; panel gradient mực + `.ornate-frame`; title `--chrome-100`.
- **Đặc tả**: `z-4000`; panel max 460px; input file ẩn phủ label.

### WorldAnnouncementOverlay
- **Đường dẫn**: `game/src/components/common/WorldAnnouncementOverlay.vue`
- **Chức năng**: Thông báo đại sự — tiêu đề lớn + body gõ từng ký tự (typewriter 28ms), click đóng.
- **Màu sắc**: backdrop `--scrim-heavy`; title `--chrome-100` + glow 24px; body `--text-primary`.
- **Đặc tả**: `z-2000`; title `--text-display-lg` Noto Serif letter-spacing .08em; body `--text-lg` line-height 1.6.

### TutorialOverlay
- **Đường dẫn**: `game/src/components/common/TutorialOverlay.vue`
- **Chức năng**: Hướng dẫn lần đầu — từng bước, progress "x / y", Bỏ Qua / Tiếp Theo.
- **Màu sắc**: backdrop `--scrim`; panel gradient mực + `.ornate-frame`; title `--chrome-100`, progress `--text-muted`.
- **Đặc tả**: `z-1900`; panel `min(420px, 92vw)`; body line-height 1.55.

### PlayerPortrait
- **Đường dẫn**: `game/src/components/common/PlayerPortrait.vue`
- **Chức năng**: Ảnh PNG nhân vật — variant 'cultivate' (giữa Động Phủ, animation khi `animated`: float + breathe + aura pulse + vòng linh khí) hoặc 'portrait' (tĩnh).
- **Props**: `variant`, `height` (default 239), `animated`.
- **Màu sắc**: aura radial `--chrome-500` 22% blur 10px; vòng linh khí viền `--chrome-500` 42%.
- **Đặc tả**: float 6s `translateY(-4px)`; breathe 5s scale 1.015; qi-ring ellipse aspect 3/1 animation 6s; tôn trọng prefers-reduced-motion.

### BreakthroughRequirementPanel
- **Đường dẫn**: `game/src/components/common/BreakthroughRequirementPanel.vue`
- **Chức năng**: Panel Đột Phá trước Độ Kiếp — 1 slot vật phẩm yêu cầu, nút Luyện (Linh Thạch), Đóng / Độ Kiếp.
- **Màu sắc**: slot viền `--ink-700` → ready `--jade` chữ `--jade`; nút Độ Kiếp gradient bạc chữ `--ink-950`.
- **Đặc tả**: bọc OverlayPanel; mọi nút `min-height: --tap-min` radius `--radius-sm`.

---

## 3. Layout — `game/src/components/layout/`

### GameRoot
- **Đường dẫn**: `game/src/components/layout/GameRoot.vue`
- **Chức năng**: Root layout — mount MainScene + mọi lớp chrome (panels, overlays, toasts, tooltip, modals); combat active thì ẩn chrome Động Phủ, hiện Combat/Tribulation overlay; click vùng trống đóng panel.
- **Màu sắc**: nền `--ink-950`; shadow popover `rgba(0,0,0,.68)`.
- **Đặc tả**: viewport 100vw×100vh overflow hidden; left panel absolute `clamp(360px, 30vw, 480px)` z-10, container query; ≤900px → `min(44vw, 400px)`; popover layer z-20 grid center.

### LeftPanel
- **Đường dẫn**: `game/src/components/layout/LeftPanel.vue`
- **Chức năng**: Drawer trái trượt vào/ra — chứa CharacterPanel (hoặc Equipment 30% + content 70%).
- **Màu sắc**: nền `--ink-900`; viền phải `--ink-line`; shadow `--shadow-panel`.
- **Đặc tả**: flex column; animation slide `translateX(-100%)` + `blur(12px)` + opacity, transition .28s ease.

### RightPanel
- **Đường dẫn**: `game/src/components/layout/RightPanel.vue`
- **Chức năng**: Drawer phải — EquipmentPaperdoll 30% trên + InventoryPanel 70% dưới.
- **Màu sắc**: nền `--ink-900`; viền trái `--ink-line`; shadow `--shadow-panel`.
- **Đặc tả**: `clamp(340px, 27vw, 440px)` z-10; slide `translateX(100%)` .28s; container query `right-panel`.

### FunctionOverlayPanel
- **Đường dẫn**: `game/src/components/layout/FunctionOverlayPanel.vue`
- **Chức năng**: Modal trung tâm điều phối 7 panel chức năng theo `ui.leftPanelMode` (Sản Xuất, Cài Đặt, Khí Đường, Đan Phòng, Linh Tuyền, Tàng Kinh Các, Địa Giới).
- **Màu sắc**: không màu riêng — thừa OverlayPanel.
- **Đặc tả**: OverlayPanel `min(1120px, 94vw) × min(820px, 92vh)`; nội dung flex column full-height.

---

## 4. Panels — `game/src/components/panels/`

### CharacterPanel
- **Đường dẫn**: `game/src/components/panels/CharacterPanel.vue`
- **Chức năng**: Panel Nhân Vật — chân dung + aura màu hệ nghề, tên/cảnh giới/Chiến Lực, Thiên Phú, 5 nhóm chỉ số, bản đồ Ngũ Hành chip xếp pentagram + Hỗm Nguyên, chip buff đan.
- **Màu sắc**: aura radial `--aura` (màu element, fallback `--chrome-500`) opacity .35 blur 5px; header gradient `--ink-800 → --ink-900`; power `--chrome-100` + glow; tier thiên phú → `--rank-color-1/3/5/7/8`; nút + gradient bạc.
- **Đặc tả**: figure 112×116px, aura animation breathe 5s; chip Ngũ Hành absolute 260×310px; nút + tròn.

### RealmPanel
- **Đường dẫn**: `game/src/components/panels/RealmPanel.vue`
- **Chức năng**: Overlay Cảnh Giới — chân dung animated, thanh Tu Vi, nút đại đột phá, dải 9 node cảnh giới, lưới passive.
- **Màu sắc**: fill tu vi gradient `--jade → --chrome-300`; node complete `--jade`, current `--chrome-300` + glow bạc; nút đột phá gradient bạc, disabled grayscale.
- **Đặc tả**: OverlayPanel `min(1120px,94vw) × min(760px,90vh)`; thanh tu vi 24px radius 999px; 9 node hình khiên tròn `border-radius: 50% 50% 12px 12px` nối ::after.

### LuyenThePanel
- **Đường dẫn**: `game/src/components/panels/LuyenThePanel.vue`
- **Chức năng**: Overlay Luyện Thể — đầu tư Tinh Hoa Phàm Thể theo tầng tuần tự, toggle tự động, 6 tier (done/active/realm_locked/locked).
- **Màu sắc**: tier card `--ink-800` viền `--ink-line-soft`, active viền `--chrome-300`; fill gradient `--jade → --chrome-300`; khóa realm chữ `--crimson`; auto label `--jade`.
- **Đặc tả**: OverlayPanel 560px × 85vh; tier opacity phân tầng .55/.8/1; bar 5px.

### QuanKhiPanel
- **Đường dẫn**: `game/src/components/panels/QuanKhiPanel.vue`
- **Chức năng**: Overlay Quán Khí — chọn con đường tu luyện KHÔNG thể đổi (Pháp Tu/Kiếm Tu...), confirm danger.
- **Màu sắc**: nút chọn gradient **`--crimson → --ink-800`** (đỏ → mực — signaling quyết định vĩnh viễn), viền `--chrome-500`; hint `--text-muted`.
- **Đặc tả**: OverlayPanel 480px; nút full-width padding 10px font 700; disabled theo cooldown.

### SkillPathPanel
- **Đường dẫn**: `game/src/components/panels/SkillPathPanel.vue`
- **Chức năng**: Overlay Kỹ Năng 3 cột (1400px): trái SkillPathList/ElementPathList, giữa NodeTreePanel (Pháp Tu) hoặc SkillDetailView, phải SkillLoadoutStrip, đáy NodeInspector.
- **Màu sắc**: viền chia cột `--ink-line`; điểm Cảm Ngộ `--chrome-100`; cây ẩn Huy Kiếm: node `--jade` viền + glow 18px.
- **Đặc tả**: grid `20% / auto / 22%`; node Huy Kiếm elip 112×72px nối ::after.

### TechniquePanel
- **Đường dẫn**: `game/src/components/panels/TechniquePanel.vue`
- **Chức năng**: Overlay Tâm Pháp — thẻ hero công pháp đang trang bị (TechniqueSlotCard), thanh EXP tier, nhóm Chiến Đấu/Tu Luyện.
- **Màu sắc**: fill tier gradient `--jade → --chrome-300` trên track `--ink-700`; tiêu đề nhóm `--chrome-100`.
- **Đặc tả**: OverlayPanel `min(560px, 90vw)`; bar 5px bo 3px; row border-bottom soft.

### InventoryPanel / BagGrid
- **Đường dẫn**: `game/src/components/panels/InventoryPanel.vue` / `BagGrid.vue`
- **Chức năng**: InventoryPanel = wrapper mỏng. BagGrid = khung Hành Trang — header "Kho Vật / N" + TabBar 3 tab (Trang Bị/Nguyên Liệu/Đan Dược) đổi BagSection.
- **Màu sắc**: gần như không màu (title `--text-primary`, count `--text-muted`) — màu nằm ở TabBar + section con.
- **Đặc tả**: BagGrid cột flex gap 8px padding 8px.

### EquipmentHallPanel
- **Đường dẫn**: `game/src/components/panels/EquipmentHallPanel.vue`
- **Chức năng**: Khí Đường — rèn trang bị 4 tab: Cường Hóa / Tẩy Luyện / Tinh Luyện / Hóa Luyện (multi-select + confirm 2 bước).
- **Màu sắc**: **scene lửa** — nền `--scene-fire-deep` `#15100d`, chữ `--scene-fire-text` `#f3cf8b` (vàng lửa), viền `color-mix(--scene-fire-text-soft 35%)`; thiếu chi phí `--crimson`; preview reward `--jade`.
- **Đặc tả**: scene đầu 132px + ảnh `sepia(.18) saturate(1.25)`; quầng lửa 85×95px animation `forge-fire` 1.35s; grid slot `repeat(6, minmax(70px,1fr))` → 3 cột mobile.

### EquipmentPaperdoll
- **Đường dẫn**: `game/src/components/panels/EquipmentPaperdoll.vue`
- **Chức năng**: 6 slot trang bị (Mũ/Vòng cổ/Nhẫn/Vũ khí/Giáp/Giày) lưới 3×2 — SlotView đầy đủ, click tháo đồ.
- **Màu sắc**: không màu riêng — toàn bộ qua token `--slot-*` của SlotView.
- **Đặc tả**: grid 3 cột × 2 hàng gap 6px; slot-wrap vuông aspect-ratio 1.

### ArtifactPanel
- **Đường dẫn**: `game/src/components/panels/ArtifactPanel.vue`
- **Chức năng**: Overlay Bản Mệnh Pháp Bảo — ghép 4 con: Overview + ExperienceBar + GradeSection + PathCards; xử lý state Kiếm Tu/ chưa thức tỉnh.
- **Màu sắc**: tối thiểu — empty `--text-secondary`.
- **Đặc tả**: OverlayPanel `min(560px,92vw) × min(720px,88vh)`.

### QuestPanel
- **Đường dẫn**: `game/src/components/panels/QuestPanel.vue`
- **Chức năng**: Overlay Nhiệm Vụ — 2 nhóm (Hàng Ngày/Nhiệm Vụ), card + progress + nút Nhận Thưởng.
- **Màu sắc**: card `--ink-800` viền `--ink-line-soft`; fill `--chrome-300`; nút nhận gradient bạc.
- **Đặc tả**: OverlayPanel 760×640; bar 6px fill .2s.

### ProductionPanel
- **Đường dẫn**: `game/src/components/panels/ProductionPanel.vue`
- **Chức năng**: Sản Xuất — 3 card điểm tài nguyên (Lâm/Quáng/Động Thiên) sigil Hán (木/礦/藥), progress + Auto + nâng cấp; bọc BuildingConstructionGate.
- **Màu sắc**: mỗi loại card 1 palette — forest (xanh rừng), mine (nâu vàng), grotto (teal) qua `--scene-forest/mine/grotto-*`; stats `--jade`; sigil viền accent 38% + glow kép.
- **Đặc tả**: sigil tròn 56px; progress 8px fill `--jade → --chrome-300`; art card full-bleed margin âm.

### PillRoomPanel
- **Đường dẫn**: `game/src/components/panels/PillRoomPanel.vue`
- **Chức năng**: Đan Phòng — 2 tầng: AlchemyView (luyện đan 60%) + PillBagSection (túi đan 40%).
- **Màu sắc**: chỉ viền chia `--ink-line` — màu nằm ở 2 con.
- **Đặc tả**: flex cột 60/40.

### AlchemyView
- **Đường dẫn**: `game/src/components/panels/AlchemyView.vue`
- **Chức năng**: Luyện Đan 2 cột — lò (ảnh + lõi chữ 丹) + 8 đan phương / preview kết quả, chọn Linh Thảo niên đại, chi phí, nút Bắt đầu luyện, lò đang chạy.
- **Màu sắc**: **scene lửa** — nền radial `--scene-fire-glow` 13% + `--scene-fire-deep`; nút luyện gradient `--scene-fire-text → --scene-fire-text-soft` (vàng lửa) chữ `--ink-950`; outcome `--jade`; thiếu/huỷ `--crimson`.
- **Đặc tả**: lò 150px, lõi tròn 48px glow kép; row selected accent bar inset 3px + glow 14px; <760px xếp cột.

### SpiritSpringPanel
- **Đường dẫn**: `game/src/components/panels/SpiritSpringPanel.vue`
- **Chức năng**: Linh Tuyền — cảnh Linh Mạch + cầu nước, tích Luỹ Linh Thạch + Thu hoạch, card đổi phẩm Linh Thạch.
- **Màu sắc**: **scene nước** — radial `--scene-water-accent` (azure) 13%; orb 42px radial trắng→azure + glow kép; fill gradient azure → `--jade`; nút nền azure đặc.
- **Đặc tả**: scene 210px inset shadow đáy; orb animation `spring-orb` 2.2s (nổi -8px + scale 1.08); progress 8px radius 999px.

### StageSelectPanel
- **Đường dẫn**: `game/src/components/panels/StageSelectPanel.vue`
- **Chức năng**: Chọn trận — Địa Giới → Chương → tầng (map 5 cột) → chế độ (Thủ Công/Lặp Lại/Tự Động) → Bắt đầu; cột phải chi tiết + đội hình quái + boss.
- **Màu sắc**: **scene portal teal** — nền `--scene-portal-deep` `#0c181c` + radial glow 14%; node viền teal 28%, selected `--chrome-300`; boss/final `--crimson` (chữ BOSS `--crimson` 62% + white).
- **Đặc tả**: header scene 118px + portal tròn 64px chữ "界" glow kép; grid 5 cột node min-height 94px, số tầng vòng 34px; <760px dọc.

### ScripturePavilionPanel
- **Đường dẫn**: `game/src/components/panels/ScripturePavilionPanel.vue`
- **Chức năng**: Tàng Kinh Các — khung 2 tab (Công Pháp / Lore) đổi TechniqueCodex / LoreCodex.
- **Màu sắc**: tab `--ink-800` chữ `--text-secondary`; active viền `--chrome-300` chữ `--chrome-100`.
- **Đặc tả**: chip tab flex:1 min-height `--tap-min`.

### LoreCodexModal
- **Đường dẫn**: `game/src/components/panels/LoreCodexModal.vue`
- **Chức năng**: Modal đọc lore item (Teleport) — click self/Đóng để đóng.
- **Màu sắc**: backdrop `--scrim`; panel `--ink-900` viền `--chrome-500`; title `--chrome-100` Noto Serif.
- **Đặc tả**: `min(340px,92vw)` → max 480px, max-height 84vh scroll; fade .2s; `white-space: pre-line`.

### SettingsPanel
- **Đường dẫn**: `game/src/components/panels/SettingsPanel.vue`
- **Chức năng**: Cài Đặt — save (lưu/tải/xuất/nhập/xoá qua ConfirmModal) + cỡ chữ UI 90–125%.
- **Màu sắc**: nút scale `--ink-800`; active nền `--chrome-300` 12% viền `--chrome-300`; hint đã lưu `--jade`; warning banner nền `--chrome-500` 8%.
- **Đặc tả**: radius `--radius-sm`; input file ẩn phủ label; tap ≥ `--tap-min`.

### BuildingPanelHeader
- **Đường dẫn**: `game/src/components/panels/BuildingPanelHeader.vue`
- **Chức năng**: Header panel công trình — ảnh tròn, tên + cấp, nút Nâng kèm chi phí/điều kiện.
- **Màu sắc**: gradient ngang `--ink-900 → --ink-950`; artwork viền `--chrome-500` 40% + glow; eyebrow `--chrome-500`; cấp `--jade`; nút gradient bạc.
- **Đặc tả**: min-height 88px; artwork 74×64px `border-radius: 50% 50% --radius-sm --radius-sm` (trên tròn dưới vuông); <640px wrap.

### BuildingConstructionGate
- **Đường dẫn**: `game/src/components/panels/BuildingConstructionGate.vue`
- **Chức năng**: Gate công trình — chưa xây hiện màn khóa (icon chữ + chi phí + nút Xây Dựng); đã xây render slot.
- **Props**: `buildingId`; slot default.
- **Màu sắc**: icon khóa viền `--chrome-500` tròn 48px chữ `--chrome-100`; nút gradient bạc.
- **Đặc tả**: màn khóa căn giữa cột; disabled opacity .5.

---

## 5. Panel con — skill-path

### SkillPathList
- **Đường dẫn**: `game/src/components/panels/skill-path/SkillPathList.vue`
- **Chức năng**: Cột trái cho path KHÔNG có Node Tree (Kiếm Tu/Phàm) — list skill nhóm theo cảnh giới.
- **Màu sắc**: card `--ink-800` viền `--ink-line-soft`; selected nền `--chrome-300` 18% + viền `--chrome-300`.
- **Đặc tả**: card padding 8×10 radius `--radius-sm`; group ngăn border-bottom.

### ElementPathList
- **Đường dẫn**: `game/src/components/panels/skill-path/ElementPathList.vue`
- **Chức năng**: Cột trái Pháp Tu — chọn Hành (Hỏa/Mộc/Thủy/Kim/Thổ + Phong/Lôi khóa), progress màu theo hành.
- **Màu sắc**: card `--ink-800`; selected nền + viền + glow `--el-color`; bar fill + label `--el-color` (Hỏa `#e53935`, Mộc `#7cb342`, Thủy `#42a5f5`, Kim `#cfd8dc`, Thổ `#a1795a`...); locked opacity .55.
- **Đặc tả**: bar 3px bo 2px; locked có 🔒.

### SkillDetailView
- **Đường dẫn**: `game/src/components/panels/skill-path/SkillDetailView.vue`
- **Chức năng**: Cột giữa path không Node Tree — chi tiết skill: tên, mô tả, nút Nâng Cấp (Cảm Ngộ), bảng thông số.
- **Màu sắc**: nút ghost viền `--chrome-500` chữ `--chrome-100`; tên `--chrome-100` cỡ lg; rows `--text-secondary` viền `--ink-line-soft`.
- **Đặc tả**: empty state padding 40px center.

### SkillLoadoutStrip
- **Đường dẫn**: `game/src/components/panels/skill-path/SkillLoadoutStrip.vue`
- **Chức năng**: Dải "Pháp Thuật Đang Vận Hành" — ô loadout (SlotView) mở RadialSkillSelector; nút specialization; slot khóa mờ.
- **Màu sắc**: slot `--ink-800` viền `--ink-line-soft` → hover `--chrome-300`; spec active nền `--ink-700` viền `--chrome-300` chữ `--chrome-100`; locked opacity .45.
- **Đặc tả**: slot flex `1 1 30%` min-width 64px tự wrap.

### NodeInspector
- **Đường dẫn**: `game/src/components/panels/skill-path/NodeInspector.vue`
- **Chức năng**: Đáy SkillPathPanel — chi tiết node đang chọn: badge cấp, trạng thái (Đã Lĩnh Ngộ `--jade` / Có Thể `--chrome-100` / Chưa Đủ `--text-muted`), lý do khóa `--crimson`, nút Lĩnh Ngộ.
- **Màu sắc**: nền `--ink-800`; badge viền `--chrome-300` 55%; nút gradient bạc chữ `--ink-950`.
- **Đặc tả**: min-height 64px; badge pill 999px.

---

## 6. Panel con — bag-sections

### PillBagSection
- **Đường dẫn**: `game/src/components/panels/bag-sections/PillBagSection.vue`
- **Chức năng**: Grid đan dược — buff regen đang chạy với deadline thật, tooltip đầy đủ, sort 4 mode + pagination, click uống đan.
- **Màu sắc**: buff box `--ink-800` viền `--jade`; giá trị `--jade`; đếm ngược `--chrome-500`.
- **Đặc tả**: grid responsive ResizeObserver (`--grid-columns` động); slot vuông 1:1; đồng hồ 1s; màu phẩm qua `--grade-*`.

### MaterialBagSection
- **Đường dẫn**: `game/src/components/panels/bag-sections/MaterialBagSection.vue`
- **Chức năng**: Grid nguyên liệu — sort 5 mode, Linh Thạch ghim đầu, tooltip phân loại/nguồn/niên đại; thuần hiển thị.
- **Màu sắc**: KHÔNG màu riêng — màu do SlotView + grade token.
- **Đặc tả**: grid cột động, slot vuông.

### EquipmentBagSection
- **Đường dẫn**: `game/src/components/panels/bag-sections/EquipmentBagSection.vue`
- **Chức năng**: Grid trang bị chưa mặc — click để mặc; tooltip Alt so sánh đồ đang mặc; sort 6 mode.
- **Màu sắc**: KHÔNG màu riêng — rank qua SlotView.
- **Đặc tả**: grid cột động, slot vuông 1:1; marker 'equipped' nhỏ.

### BagPaginationControls
- **Đường dẫn**: `game/src/components/panels/bag-sections/BagPaginationControls.vue`
- **Chức năng**: Footer chung 3 bag-section — pagination `‹ 1 2 3 ›` giữa + nút sort menu thả LÊN (chọn mode, đảo chiều, reset); khung hẹp tự ẩn label.
- **Màu sắc**: nút `--ink-800` viền `--ink-line-soft`; page active gradient bạc; menu `--ink-900` viền `--chrome-500` shadow panel; sort active viền `--chrome-300`.
- **Đặc tả**: grid `1fr auto 1fr`; menu `bottom: calc(100% + 6px)` z-30; container query ≤420px ẩn label; icon SVG sort 14px inline.

---

## 7. Panel con — loadout-sections

### TechniqueSlotCard
- **Đường dẫn**: `game/src/components/panels/loadout-sections/TechniqueSlotCard.vue`
- **Chức năng**: Thẻ Tâm Pháp trang bị (thuần hiển thị) — SlotView + tên + badge tier + EXP + "X / Y" hoặc "Viên Mãn"; biến thể `hero` layout dọc + badge "ĐANG TU LUYỆN".
- **Màu sắc**: card `--ink-800` viền `--ink-line-soft`; badge tier viền `--chrome-500`; status `--jade`; fill gradient `--jade → --chrome-300`.
- **Đặc tả**: normal hàng ngang icon 56px; hero cột dọc icon 46% width; badge pill 999px; có v-tooltip.

### RadialSkillSelector
- **Đường dẫn**: `game/src/components/panels/loadout-sections/RadialSkillSelector.vue`
- **Chức năng**: Overlay chọn skill vòng tròn — skill viable xếp quanh tâm (thuần trigonometry JS), tâm hiện slot hiện tại + nút Gỡ.
- **Màu sắc**: backdrop `--scrim`; tâm `--ink-900` viền `2px --chrome-300` + glow bạc; nút Gỡ viền + chữ `--crimson`; current `--jade`; item hover viền `--chrome-300` chữ `--chrome-100`.
- **Đặc tả**: tâm tròn 88px; item tròn 72px theo `calc(50% ± radius)`; bán kính min 108px tự tính không tràn viewport.

### NodeTreePanel
- **Đường dẫn**: `game/src/components/panels/loadout-sections/NodeTreePanel.vue`
- **Chức năng**: Cây node Pháp Tu theo branch — tự tính depth thật, node card click chọn, vẽ SVG SkillConnections, animation unlock 2 pha (flow 750ms → pulse/ring 500ms).
- **Màu sắc**: node `--ink-800`; purchased nền `--branch-color` 18%; major/hover/selected viền `--branch-color` / `--chrome-300`; unlocking `--chrome-300` + glow 14px; branch color = màu hành truyền qua `--branch-color`.
- **Đặc tả**: node 140px; hàng tier cách 22px gap 10px; locked opacity .5 vẫn click được; keyframes `skill-node-pulse` + `skill-node-ring`.

### SkillConnections
- **Đường dẫn**: `game/src/components/panels/loadout-sections/SkillConnections.vue`
- **Chức năng**: Layer SVG vẽ đường nối parent→child theo toạ độ đo thật — 3 trạng thái locked/active/unlocking.
- **Màu sắc**: stroke `--branch-color` opacity .3 / active .75; unlocking `--chrome-300` 2.5px + drop-shadow.
- **Đặc tả**: path bezier; unlocking `stroke-dasharray: 10 8` animation `skill-connections-flow` 750ms (dashoffset 72→0 — năng lượng chảy).

---

## 8. Panel con — scripture

### TechniqueCodex
- **Đường dẫn**: `game/src/components/panels/scripture/TechniqueCodex.vue`
- **Chức năng**: Tab Công Pháp — 1 thẻ hero (đang trang bị) + grid SlotView mọi công pháp; chưa học hiện "???" mờ không click.
- **Màu sắc**: title nhóm `--chrome-100`; locked slot opacity .45 `pointer-events: none`.
- **Đặc tả**: slot cố định 56px flex wrap gap 6px; scroll dọc.

### LoreCodex
- **Đường dẫn**: `game/src/components/panels/scripture/LoreCodex.vue`
- **Chức năng**: Tab Lore — grid item lore ĐÃ NHẶT; click mở LoreCodexModal.
- **Màu sắc**: tối thiểu — empty `--text-muted`; còn lại do SlotView + modal.
- **Đặc tả**: grid slot 56px flex wrap gap 6px.

---

## 9. Panel con — artifact

### ArtifactOverview
- **Đường dẫn**: `game/src/components/panels/artifact/ArtifactOverview.vue`
- **Chức năng**: Vùng 1 — icon chữ "珠" (fallback chưa có art), tên pháp bảo + meta "Nghề · Phẩm".
- **Màu sắc**: icon nền radial `--chrome-500 → --ink-900` viền `--chrome-500` glow bạc; icon chữ `--chrome-100`; meta `--chrome-500`.
- **Đặc tả**: icon tròn 64px; flex hàng gap 12px.

### ArtifactExperienceBar
- **Đường dẫn**: `game/src/components/panels/artifact/ArtifactExperienceBar.vue`
- **Chức năng**: Vùng 2 — thanh EXP pháp bảo, 3 trạng thái màu hóa: training / capped_by_player / content_ceiling.
- **Màu sắc**: fill — training `--chrome-300` (bạc) / capped `--azure` (chờ chủ nhân) / viên mãn `--jade`; track `--ink-950`.
- **Đặc tả**: track 8px bo 4px; fill .2s ease.

### ArtifactGradeSection
- **Đường dẫn**: `game/src/components/panels/artifact/ArtifactGradeSection.vue`
- **Chức năng**: Vùng 3 — bảng Phẩm / hệ số / thạch + nút "Nâng Phẩm (N đá)".
- **Màu sắc**: nút gradient bạc; disabled trong suốt opacity .4; value `--chrome-100` 600.
- **Đặc tả**: row flex space-between; nút padding 10×14 radius `--radius-sm`.

### ArtifactPathCards
- **Đường dẫn**: `game/src/components/panels/artifact/ArtifactPathCards.vue`
- **Chức năng**: Vùng 4 — 3 card hướng Công/Thủ/Khống, milestone tầng 1/3/6/12/18 (dot unlock + tooltip); chọn reversible ngoài combat.
- **Màu sắc**: **path màu** — attack `--crimson` (đỏ) / defense `--azure` (lam) / control `--jade` (ngọc) qua `--path-color`; selected nền color-mix 16% + viền + glow; milestone unlocked nền `--path-color` 22%.
- **Đặc tả**: card cột; milestone hàng flex:1 bo 3px; locked opacity .4; disabled card .5.

---

## 10. Combat — `game/src/components/game/combat/`

### CombatSceneOverlay
- **Đường dẫn**: `game/src/components/game/combat/CombatSceneOverlay.vue`
- **Chức năng**: Khung xương UI Combat Scene — TopBar → StatusBar → battlefield (canvas xuyên qua + AiPanel/BuildHud) → EventBar → ControlBar + ResultModal + CountdownOverlay; ResizeObserver cấp `combatInsets` xuống Phaser.
- **Màu sắc**: không trực tiếp; font `--font-body`.
- **Đặc tả**: `absolute inset 0 z-15` flex column; cao bar chuẩn hóa: topbar `clamp(46, 4.8vh, 72px)` / status `clamp(44, 4.6vh, 68px)` / event `clamp(32, 3.4vh, 48px)` / control `clamp(48, 5.2vh, 76px)`.

### CombatTopBar
- **Đường dẫn**: `game/src/components/game/combat/CombatTopBar.vue`
- **Chức năng**: Thanh trên — tên Địa Giới • Màn + tiến độ quái spawned/total.
- **Màu sắc**: nền `--ink-950` 70% + blur 6px; viền đáy `--ink-line-soft`; title `--chrome-100`; progress `--text-secondary`.
- **Đặc tả**: padding 0 20px; title Noto Serif ellipsis nowrap.

### CombatStatusBar
- **Đường dẫn**: `game/src/components/game/combat/CombatStatusBar.vue`
- **Chức năng**: Thanh số liệu người chơi — HP (luôn), MP (Pháp Tu), tài nguyên (Nộ Khí/Kiếm Ý); đứng yên giá trị cuối khi kết thúc.
- **Màu sắc**: fill HP `--hp-color` `#d8d5cc` / MP `--jade` / Nộ `--gold-500`; track `--ink-900` viền `--ink-line`; label `--text-primary` + text-shadow đen.
- **Đặc tả**: bar 14px radius 7px (pill); fill .15s ease; cột player `min(260px, 30vw)`.

### CombatEventBar
- **Đường dẫn**: `game/src/components/game/combat/CombatEventBar.vue`
- **Chức năng**: Feed sự kiện đáng chú ý — phản ứng ngũ hành 🔥, Chí Mạng 💥, Hạ Gục ☠ (damage thường hiện trên canvas).
- **Màu sắc**: nền `--ink-950` 50%; item `--text-secondary` `--text-sm`.
- **Đặc tả**: max 6 entry lifetime 3.5s; TransitionGroup opacity .25s; nowrap; `pointer-events: none`.

### CombatControlBar
- **Đường dẫn**: `game/src/components/game/combat/CombatControlBar.vue`
- **Chức năng**: Thanh dưới — nút "✕ Thoát Trận" (chỉ trận Stage) + modal xác nhận (Ở Lại / Thoát Trận).
- **Màu sắc**: bar `--ink-950` đặc viền `--ink-line`; exit `--ink-800` viền `--ink-line-soft` → hover `--crimson`; modal OK nền `--crimson` chữ `--ink-950`; overlay `--scrim`.
- **Đặc tả**: exit radius `--radius-sm` padding 8×20; modal `min(320px, ...)` radius-md.

### CombatResultModal
- **Đường dẫn**: `game/src/components/game/combat/CombatResultModal.vue`
- **Chức năng**: Wrapper backdrop kết quả (chỉ trận Stage) — chọn Victory/Defeat panel theo state.
- **Màu sắc**: backdrop `--scrim`.
- **Đặc tả**: `absolute inset 0 z-30` flex center.

### CombatVictoryPanel
- **Đường dẫn**: `game/src/components/game/combat/CombatVictoryPanel.vue`
- **Chức năng**: "★ THẮNG ★" — rewards tích lũy; auto: Đánh Lại + đếm ngược 3s (progress mode leo màn kế); manual: thêm Tiếp Tục.
- **Màu sắc**: panel `--ink-900` **viền `--chrome-500`** (bạc = thắng); nút chính gradient bạc; giá trị reward `--jade`.
- **Đặc tả**: `min(420px, ...)` padding 28/32; rewards scroll `min(240px, 30vh)`; 2 nút flex-1.

### CombatDefeatPanel
- **Đường dẫn**: `game/src/components/game/combat/CombatDefeatPanel.vue`
- **Chức năng**: "☠ THẤT BẠI" — rewards (nếu có); Tái Chiến + Về Động Phủ; auto repeat đếm 3s; fallback 10s.
- **Màu sắc**: panel `--ink-900` **viền `--crimson`**; title `--crimson`; nút Tái Chiến nền `--crimson`; giá trị reward vẫn `--jade`.
- **Đặc tả**: mirror VictoryPanel — cùng kích thước/layout.

### CombatCountdownOverlay
- **Đường dẫn**: `game/src/components/game/combat/CombatCountdownOverlay.vue`
- **Chức năng**: Đếm ngược 3-2-1-Xuất Trận! (Stage + Tribulation).
- **Màu sắc**: chữ `--chrome-100`; text-shadow kép glow 24px + đen.
- **Đặc tả**: `--text-hero` (96px) Noto Serif 700 center z-12; animation pop `scale 1.6→1` .3s re-trigger mỗi số; `pointer-events: none`.

### CombatAiPanel
- **Đường dẫn**: `game/src/components/game/combat/CombatAiPanel.vue`
- **Chức năng**: Radio 5 chiến lược AI mục tiêu (Gần nhất/Ưu tiên Boss/Elite/HP thấp/HP cao) góc trái battlefield.
- **Màu sắc**: nền `--scrim` + blur 2px; viền `--ink-line`; radio `accent-color: --chrome-300`.
- **Đặc tả**: font `--text-xs`; option min-height `--tap-min`; tĩnh không animation.

---

## 11. Combat HUD — `game/src/components/game/combat/hud/`

### CombatBuildHud
- **Đường dẫn**: `game/src/components/game/combat/hud/CombatBuildHud.vue`
- **Chức năng**: Wrapper chọn HUD theo phái — `phap_tu` → PhapTuCombatHud, `kiem_tu` → KiemTuCombatHud, mặc định → MortalCombatHud.
- **Màu sắc**: không — hình thức do HUD con.

### CombatSkillSlot
- **Đường dẫn**: `game/src/components/game/combat/hud/CombatSkillSlot.vue`
- **Chức năng**: Ô kỹ năng dùng chung mọi phái — bọc SlotView + mask cooldown (fill từ dưới lên), số đếm, cast bar 3px, chi phí tài nguyên góc, filter xám khi thiếu tài nguyên/out-of-range.
- **Màu sắc**: mask `--ink-950` 72%; cast fill `--jade`; cost `--jade`; thiếu/out-of-range `filter: grayscale(.6); opacity: .7`.
- **Đặc tả**: mask height % transition .1s linear; số đếm Noto Serif `--text-lg` text-shadow; cast bar chìa `bottom: -6px`.

### MortalCombatHud
- **Đường dẫn**: `game/src/components/game/combat/hud/MortalCombatHud.vue`
- **Chức năng**: HUD Phàm Nhân — đúng 1 ô lớn Trảm (cadence Attack Speed, mask nội suy mượt).
- **Màu sắc**: thừa hưởng CombatSkillSlot.
- **Đặc tả**: container + slot đều **88px**.

### PhapTuCombatHud
- **Đường dẫn**: `game/src/components/game/combat/hud/PhapTuCombatHud.vue`
- **Chức năng**: HUD Pháp Tu — 5 ô skill luôn dựng đủ (trống/khóa/unreleased hiện rõ) + 1 ArtifactCombatSlot.
- **Màu sắc**: thừa hưởng con.
- **Đặc tả**: flex wrap center gap `--space-2`; slot **72px** (tổng ~400px).

### KiemTuCombatHud
- **Đường dẫn**: `game/src/components/game/combat/hud/KiemTuCombatHud.vue`
- **Chức năng**: HUD Kiếm Tu — ô Ngự Kiếm Thuật (cadence) đứng riêng + 2 kỹ năng chuỗi nối ký hiệu "→" (vận kiếm), không sao chép dải 5 ô Pháp Tu.
- **Màu sắc**: link "→" `--chrome-300` `--text-body`.
- **Đặc tả**: ô Ngự Kiếm **88px**, ô chuỗi **72px**.

### ArtifactCombatSlot
- **Đường dẫn**: `game/src/components/game/combat/hud/ArtifactCombatSlot.vue`
- **Chức năng**: Ô Bản Mệnh Pháp bảo (Ngũ Hành Châu 珠) — không phải skill slot; icon 珠, mask cooldown, dot hành kế tiếp, badge stack khống chế / ★ sẵn sàng 5 hành.
- **Màu sắc**: slot `--ink-800` viền `1px --el-color` (động theo hành kế: Mộc `#7cb342`...Hỗn Nguyên `#9b5de5`); stacks badge `--crimson`; ready gradient bạc; dot glow `--el-color`.
- **Đặc tả**: **tròn 48px** `border-radius: 50%` (khác skill vuông); dot 6px bottom; badge top-right.

---

## 12. Game / Scene — `game/src/components/game/`

### PhaserCanvas
- **Đường dẫn**: `game/src/components/game/PhaserCanvas.vue`
- **Chức năng**: Phaser canvas wrapper duy nhất — 1 game transparent (arcade physics) chứa 3 scene [Main, Combat, Tribulation]; ResizeObserver; EventBus bridge.
- **Màu sắc**: không (canvas transparent — nền do DOM sở hữu).
- **Đặc tả**: `100% × 100%`; cleanup đầy đủ onUnmounted.

### MainScene
- **Đường dẫn**: `game/src/components/game/MainScene.vue`
- **Chức năng**: Container viewport — DongFuScene (DOM overlay) đè trên PhaserCanvas; combat thì DongFuScene tự ẩn.
- **Màu sắc**: nền `--ink-950`.
- **Đặc tả**: `absolute inset 0` full viewport.

### DongFuScene
- **Đường dẫn**: `game/src/components/game/DongFuScene.vue`
- **Chức năng**: Thế giới home Động Phủ — nền art PNG (1672×941 cover) + fallback gradient CSS (sky/mountains/ground); Linh Nhãn 3 vòng trận pháp; 4 particle linh khí; nhân vật tu luyện là nút trigger command wheel; vignette.
- **Màu sắc**: sky gradient `#0a0a0d → #131318 → #1b1b22`; Linh Nhãn vòng `--chrome-500` 30–48% + outer `--azure` 25%, glow radial blur 6px; motes `--chrome-100` + glow; vignette radial `rgba(0,0,0,.5)`.
- **Đặc tả**: mountains `clip-path: polygon`; Linh Nhãn `perspective(320px) rotateX(64deg)` animation pulse 4.5s/3.2s; motes 3px animation 7s.

### HomeBuildingIcons
- **Đường dẫn**: `game/src/components/game/HomeBuildingIcons.vue`
- **Chức năng**: Hotspot các tòa nhà trên art Động Phủ — nút vô hình theo % tọa độ, hover outline + VFX theo loại + label cấp; mở popover/panel.
- **Màu sắc**: accent mỗi building — Đan Phòng `--el-fire`, Khí Đường `--crimson`, Trận Pháp `--chrome-500`, Linh Tuyền `--azure`, Tiền哨 `--text-muted`; outline/hover-label/glow đều color-mix theo accent.
- **Đặc tả**: hotspot ellipse `border-radius: 46%`; VFX 5 loại — portal 3 vòng xoay 1.8s, alchemy/forge 3 dot bay lên, spring/gather ripple scale .45→2.4; `prefers-reduced-motion` tắt VFX.

### DongFuCommandWheel
- **Đường dẫn**: `game/src/components/game/DongFuCommandWheel.vue`
- **Chức năng**: Bảng lệnh command wheel 2 quỹ đạo tròn — click nhân vật mở; slot fan-out cung xoắn 112°, 2 vòng quay ngược chiều; backdrop/Escape/Tab đóng; badge đột phá + dot nâng cấp.
- **Màu sắc**: slot `--ink-900` 88% viền `--ink-line` → hover `--chrome-300`; orbit viền `--chrome-500` 34%; **ring identity viền trái 3px**: ring1 `--chrome-500` / ring2 `--azure` / ring3 `--jade` / ring4 `--el-primordial` tím.
- **Đặc tả**: slot pill 999px min 57px; tâm wheel left 50% top 66%; bán kính adaptive `clamp(96–340px)`; fan-out 320ms cubic-bezier transform chain giữ chữ thẳng; z-8.

### BuildingDetailPopover
- **Đường dẫn**: `game/src/components/game/BuildingDetailPopover.vue`
- **Chức năng**: Popover chi tiết building **chưa xây** — tên/mô tả/chi phí (owned/amount) + nút Xây Dựng.
- **Màu sắc**: gradient mực `--ink-950 → --ink-800` + `.ornate-frame`; thiếu nguyên liệu `--crimson`; description `--text-secondary`.
- **Đặc tả**: radius `--radius-md`; min 260 / max 320px; max-height `calc(100vh - 48px)` scroll.

### TribulationSceneOverlay
- **Đường dẫn**: `game/src/components/game/tribulation/TribulationSceneOverlay.vue`
- **Chức năng**: Overlay Thiên Kiếp — đồng hồ đếm ngược sống sót + track thời gian thu hẹp từ phải + track HP + hint.
- **Màu sắc**: **palette riêng xanh-tím** — chữ `--scene-tribulation-text` `#e9f6ff`; track nền `#08101e` viền `#9edaff`; time fill gradient `#7658d6 → #9edaff+white`; HP fill `#d34c4c`; timer glow `#69bfff`.
- **Đặc tả**: timer `--text-display-lg` 800; track 8px radius 8px `min(340px, 80vw)`; neo theo tỉ lệ viewport khớp Phaser scene; fill .15s linear; z-15.

---

## 13. Onboarding — `game/src/components/onboarding/`

### AuthEntryScreen
- **Đường dẫn**: `game/src/components/onboarding/AuthEntryScreen.vue`
- **Chức năng**: Đăng nhập/đăng ký (login ID + mật khẩu) hoặc guest (dừng Trúc Cơ).
- **Màu sắc**: nền radial 3 stop (chrome-700 8% tint → `--ink-900` → `--ink-950`) + lưới chấm trang trí 44px opacity .1 + 2 vòng sương blur 80px `--chrome-500` opacity .1; card gradient mực + shadow kép; con dấu 仙 viền `--chrome-100`; tab active `--chrome-100` + gạch chân 2px `--chrome-500`; input focus viền `--chrome-300` + ring 8%; lỗi `--crimson`; dot server `--jade` glow.
- **Đặc tả**: card `min(390px, ...)` padding 34px; seal 54px xoay 45°; eyebrow letter-spacing .28em.

### CharacterCreationScreen
- **Đường dẫn**: `game/src/components/onboarding/CharacterCreationScreen.vue`
- **Chức năng**: Wizard 3 bước tạo nhân vật — Đạo danh → chọn Thiên Phú (reroll) → phân bổ 5 điểm căn cơ.
- **Màu sắc**: nền radial như AuthEntry; panel gradient mực + `.ornate-frame`; stepper active `--chrome-100`; talent card selected viền `--chrome-300` + inset ring + glow 12%; tier thiên phú → `--rank-color-1/3/5/7/8`; counter hợp lệ `--jade`; lỗi `--crimson`.
- **Đặc tả**: stepper 26px tròn nối kẻ 1px; talent grid 3 cột min-height 128px hover `translateY(-2px)`; panel max-width theo bước (name 560 / attribute 700px).

---

## 14. Pattern lặp lại trên toàn UI

| Pattern | Giá trị | Xuất hiện |
|---|---|---|
| **Nút chính (CTA)** | gradient `--chrome-100 → --chrome-500`, chữ `--ink-950` | GameButton primary, mọi nút Xây/Nâng/Đột phá/Nhận/Bắt đầu |
| **Nút danger** | nền `--crimson` phẳng, chữ trắng/#fff | GameButton danger, Tái Chiến, Thoát Trận |
| **Panel modal** | gradient `160deg --ink-950 → --ink-800` + `.ornate-frame` + `--shadow-panel` + radius `--radius-md` | ConfirmModal, Error, Save, Tutorial, Building popover... |
| **OverlayPanel** | gradient `155deg --ink-800 → --ink-950` viền `--chrome-500` | mọi panel chức năng |
| **Progress fill** | gradient `--jade → --chrome-300` | EXP, tu vi, tier, production |
| **Viền trái 3px accent** | màu theo kind/tone | Tooltip, Toast, ActionFeedbackLog |
| **Thành công / thiếu sót** | `--jade` / `--crimson` | toàn UI |
| **Scene palette** | 5 cụm token riêng (fire/portal/water/forest-mine-grotto/tribulation) | panel theo khu chức năng |
| **Chữ số** | `font-variant-numeric: tabular-nums` | mọi giá trị count/đếm |
| **Accessibility** | `--tap-min` 40px, focus ring bạc, aria role, prefers-reduced-motion | toàn UI |
