# UI Fit Refactor — Panel tự co giãn mọi tỉ lệ, 0 scrollbar

Ngày: 2026-08-29 · Branch: `ui-fit-refactor` · Hướng A "Fit Budget" (đã duyệt)

## Mục tiêu
1. Panel là **ngân sách flex** — chrome co giãn (clamp vh), nội dung lấp đầy phần còn lại.
2. **0 scrollbar** nội bộ: nội dung fit bằng grid auto-fit + container query đo theo CARD (không phải viewport — sửa lỗi breakpoint lệch gốc tọa độ).
3. Vượt ngân sách → **phân trang** (pattern BagGrid), không scroll.
4. Floor đọc được: chữ ≥ `--text-xs`×ui-scale, hàng ≥ `--tap-min`; dưới floor → paginate thay vì ép co.

## 5 đợt (mỗi đợt: type-check + build + test + commit)
1. **OverlayPanel fit-engine**: body bỏ `overflow: auto` → `flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; overflow: hidden`; card thêm `container-type: inline-size; container-name: overlay-panel`.
2. **Chrome co giãn**: mọi khối cố định px (scene rèn 132px, lò đan 150px, portal 118px, spring 210px) → `clamp(min, Xvh, max)`.
3. **Nội dung fit**: grid `auto-fit minmax(min(NNNpx,100%),1fr)` (mẫu ProductionPanel); SkillPathPanel stack 3 cột `@container overlay-panel (max-width: 900px)`; CharacterPanel pentagram scale theo container; dead zone RealmPanel bỏ.
4. **Phân trang + drawer floor**: các list vượt ngân sách tái dùng BagPaginationControls; LeftPanel/RightPanel <900px có width floor.
5. **Sweep 0-scrollbar + docs**: quét `overflow: auto/scroll` còn sót trong panels → thay bằng fit/pagination; cập nhật ui-components.md.

## Ranh giới
- Không phá: combat insets (đã đo bằng ResizeObserver), art-space hotspot (chính xác sẵn), bag grid RO (tốt sẵn).
- Toast/Tooltip/Log được phép scroll không (fixed, ngoài panel) — giữ nguyên.
- GameRoot drawers giữ kiến trúc neo, chỉ thêm floor.
