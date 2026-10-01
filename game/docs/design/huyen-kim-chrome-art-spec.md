# Huyền Kim Sơn Thủy — UI chrome drawing spec (cho Minh vẽ)

Nguồn slot duy nhất: `game/src/ui/huyen-kim-chrome.json`. Mỗi slot cần **1 PNG sheet** (hoặc 2: `@1x` + `@2x` nếu muốn sắc nét retina). File đặt tại `game/public/assets/ui/huyen-kim/<id>@1x.png` và `<id>@2x.png` (2x gấp đôi kích thước 1x). Khi file vào, coordinator flip `status: pending → ready` trong manifest — không cần sửa code.

## Quy tắc chung

- PNG nền trong suốt; nội dung vẽ kín khung `sourceWidth × sourceHeight` (không chừa viền trong suốt ngoài).
- `slices` = vùng mép KHÔNG được kéo giãn khi component co giãn — vẽ họa tiết góc/viền trong vùng đó, phần giữa phải kéo được (fill) hoặc trong suốt (transparent).
- `tintable: true` → vẽ **đen-trắng/đơn sắc** (grayscale, alpha giữ hình) — game tô màu bằng token (jade/gold/cinnabar/ink) cho từng state; `false` → vẽ màu thật.
- `edgeMode: stretch` → mép kéo dài theo trục; giữ họa tiết mép đều/kéo được.
- States (hover/pressed/selected/disabled/locked) hiện do TOKEN điều khiển — không cần vẽ sheet cho từng state trừ khi muốn variant riêng (báo coordinator thêm slot).

## Danh sách slot (20)

| id | Vai trò | 1x size | slices L/R/T/B | tint |
|---|---|---|---|---|
| frame-xs-tooltip | Khung tooltip/popup nhỏ | 96×96 | 20/20/20/20 | ✓ |
| frame-s-slot | Ô item/icon | 96×96 | 20/20/20/20 | ✓ |
| surface-m-panel | Thân panel Study | 256×256 | 32/32/32/32 | — |
| frame-m-modal | Khung modal feature | 256×256 | 40/40/40/40 | — |
| surface-l-drawer | Drawer / thẻ Thiên Cơ Bảng | 384×384 | 48/48/48/48 | — |
| surface-xl-scroll | Cuộn lễ (victory/nhật ký/dialog) | 512×640 | 64/64/96/96 | — |
| frame-xl-ceremony | Khung lễ (đột phá/tribulation) | 512×512 | 72/72/72/72 | — |
| button-compact | Nút compact (combat rail) | 160×56 | 28/28/16/16 | ✓ |
| button-standard | Nút thường (Study) | 192×72 | 32/32/20/20 | ✓ |
| button-ceremonial | CTA chính (Đột Phá/Nhập Trận) | 256×96 | 40/40/24/24 | ✓ |
| icon-button-utility | Nút tròn top-bar (mail/bag/settings) | 96×96 | 30/30/30/30 | ✓ |
| seal-chip | Ấn nhỏ (talent/yêu cầu) | 128×48 | 24/24/14/14 | ✓ |
| resource-pill | Viên đếm tài nguyên top-bar | 160×48 | 24/24/14/14 | — |
| entity-bar | Thanh HP entity (tint jade/cinnabar) | 192×32 | 20/20/10/10 | ✓ |
| divider-ornament | Gạch ngang có hoa văn giữa | 256×16 | 96/96/4/4 | ✓ |
| scrollbar | Track+thumb scrollbar | 32×128 | 12/12/24/24 | ✓ |
| dao-luan-center | Mặt huy chương trung tâm Đạo Luân | 192×192 | full-bleed | — |
| dao-luan-node | Nút vòng Đạo Luân (inner/outer) | 96×96 | full-bleed | ✓ |
| rune-node | Đỉnh đồ thị node (tint theo state) | 64×64 | full-bleed | ✓ |
| tab-seal | Ấn tab/nav | 96×64 | 20/20/16/16 | ✓ |

## HOLD — chưa vẽ

| id | Lý do |
|---|---|
| frame-s-slot | `SlotView` cố tình KHÔNG dùng slice (họa tiết lặp trên lưới dày gây clutter). Chỉ vẽ khi có consumer chủ đích (icon cell combat/equipment) — coordinator sẽ báo. |
| scrollbar | App đang ẩn scrollbar toàn cục (`scrollbar-width: none` trong theme.css). Chỉ vẽ khi một surface bật lại scrollbar có chủ đích. |

## Wiring pending (slot đã spec, consumer chưa wire)

- `icon-button-utility`: `GameButton` shape=`circle` hiện bypass chrome art — đang wire trong PR primitives.
- `resource-pill`: `CurrencyHud` chưa dùng slot này — đang wire trong PR navigation.
- `button-ceremonial`: `tintable: true` — vẽ **grayscale**, game tự tô gold/cinnabar theo variant (primary/danger). Đừng vẽ màu thật.

## Palette tham chiếu (token)

- Huyền surfaces: `#0B0F0D / #131B17 / #1B2621` (dark lacquer–dark jade, không đen thuần)
- Viền: `#2A352F` muted · `#7A6234` active · `#E8C35A` ceremony
- Ngọc `#3FA68B` · Kim `#C99A4A → #E8C35A → #F4D98B` · Chu Sa `#B54432` · Ngà `#EDE6D6` · Mực khóa `#5B6266`
- Tintable sheet: vẽ grayscale — game tự tô jade/gold/cinnabar/ink.

## Ưu tiên vẽ trước (master-screen gating)

M1 Động Phủ: dao-luan-center, dao-luan-node, surface-l-drawer (Thiên Cơ Bảng), icon-button-utility, resource-pill.
M2/M5: surface-m-panel, button-standard, frame-xs-tooltip, entity-bar.
M8 combat: entity-bar, button-compact.
Còn lại theo sau.
