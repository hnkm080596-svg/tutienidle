# UI Primitives Refactor — Thiết kế (Hướng B)

Ngày: 2026-08-29
Trạng thái: Đã duyệt trong hội thoại brainstorming
Phạm vi: `game/src/components/` — không đổi logic gameplay, không đổi save, chỉ trình bày UI.

## Mục tiêu

Loại bỏ trùng lặp UI: 19 progress bar tự làm (ProgressBar.vue dùng 0 lần), ~25 nút tự làm, 6 tab switcher tự làm, ~25 section title, ~14 stat row, 13 empty state, 4 scene header. Xây lớp `common/primitives/` làm nguồn sự thật duy nhất cho các pattern này.

## Nguyên tắc primitives

- Props tối thiểu cho **hành vi** (active, disabled, value/max); **mọi visual qua CSS var** — nơi dùng override `style="--bar-from: var(--el-color)"` thay vì thêm prop.
- API cũ của GameButton/TabBar giữ nguyên (không phá 10+2 file đang dùng).
- House style thật (khảo sát 2026-08-28): track `--ink-700`, fill gradient `--jade → --chrome-300`, radius 3-4px — trở thành **default** của Bar.

## Cấu trúc mới

```
common/
  primitives/
    Bar.vue        # thanh fill ngang: value/max, height, pill, anchor(right), slot label
    Chip.vue       # pill chọn được: active, disabled, slot
    Eyebrow.vue    # section title uppercase: as, tone, tracking var
    StatRow.vue    # label — value row: label, tone, bordered, slot value
    EmptyState.vue # khối trống: size, framed, slot
  GameButton.vue   # + shape(circle), + accentVar (scene accent)
  TabBar.vue       # rebuild trên Chip; API cũ giữ; + layout grid/row, + slot prefix/suffix
  SceneHeader.vue  # composite: asset, scene, height, caption/title/subtitle, slot decoration
  ProgressBar.vue  # XÓA (0 usage)
```

## Bar (thay 17/19 bar tự làm)

- Props: `value`, `max`, `height` (8), `pill` (false), `anchor` ('left'|'right').
- CSS var: `--bar-track` (`--ink-700`), `--bar-from`/`--bar-to` (gradient fill, default `--jade → --chrome-300`), `--bar-height`, `--bar-radius`.
- Slot `label` giữa bar, `tabular-nums`.
- Giữ nguyên: ArtifactCombatSlot (mask dọc, không phải bar ngang).

## GameButton mở rộng

- `shape: 'rect'|'circle'` — nút "+" allocate stat.
- `accentVar: string` — fill đổ gradient từ CSS var (AlchemyView lửa, Spring azure).
- QuanKhiPanel crimson→ink gradient → chuẩn hóa `variant="danger"`.
- Migrate ~25 nút tự làm / ~20 file (kể cả BreakthroughRequirementPanel).

## TabBar + Chip

- Chip: `active`, `disabled`; `--chip-active-bg` var; công thức viền/text chuẩn.
- TabBar: giữ `tabs/modelValue/columns` + badge; thêm `layout: 'grid'|'row'` và slot `prefix` cho filter chip có label nhỏ/locked (StageSelect).
- Migrate: ScripturePavilion, StageSelect (mode + filter), Settings, SkillLoadoutStrip, BagPagination sort toggle.
- Giữ nguyên: AuthEntry underline, CommandWheel radial, CharacterCreation stepper.

## Text primitives

- Eyebrow: `as` (h3/h4/span), `tone` (chrome/muted); chuẩn hóa tracking .02–.13em → `--eyebrow-tracking` default .04em. Áp ~25 chỗ.
- StatRow: `label`, `tone` (default/positive/negative/muted — khớp tone Tooltip), `bordered`, slot `value`; value `tabular-nums`. Áp ~14 chỗ.
- EmptyState: `size` (sm/md/lg), `framed` (dashed), slot. Áp 13 chỗ.

## SceneHeader

- Props: `asset`, `scene` ('fire'|'portal'|'water'), `height`, `caption`, `title`, `subtitle`.
- `scene` → set `--scene-deep/-accent/-text/-text-soft` scope, map fire/portal/water token.
- Slot default = decoration riêng (forge-fire, vòng portal, orb) — cá tính từng panel giữ nguyên.
- Áp: EquipmentHallPanel, StageSelectPanel, SpiritSpringPanel, AlchemyView. BuildingPanelHeader giữ (thumbnail tròn — quá khác).
- Visual đích phải **không đổi** so với hiện tại (refactor thuần trình bày).

## Thứ tự 6 đợt (mỗi đợt = 1 commit, đủ type-check + build + test)

1. `primitives/` + Bar + xóa ProgressBar + migrate 13 file bar.
2. GameButton mở rộng + migrate ~25 nút.
3. Chip + TabBar rebuild + migrate 5 switcher.
4. Eyebrow + StatRow + migrate.
5. EmptyState + SceneHeader + migrate.
6. Cập nhật `docs/ui-components.md` + verify toàn bộ.

Test hiện có liên quan: RealmPanel, Settings, StageSelect, EquipmentHall, BagGrid, SlotView, DongFuScene, HomeBuildingIcons, DongFuCommandWheel — phải xanh sau MỖI đợt.

## Rủi ro & hạn chế

- Visual diff nhỏ có thể xảy ra nơi chuẩn hóa (tracking .04em, QuanKhi danger) — đã duyệt chủ đích.
- Tribulation bar dùng token scene riêng → override CSS var tại chỗ dùng, không thêm prop scene vào Bar (YAGNI).
- ElementPathList 3px + dynamic color: dùng `height` prop + `--bar-from` override — thử nghiệm trước khi migrate 12 file còn lại.
