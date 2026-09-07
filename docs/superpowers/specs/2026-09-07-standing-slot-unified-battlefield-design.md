# Standing Slot 3x3 + Unified Battlefield Rendering (Part 5) Design

## Problem

Bốn vấn đề độc lập nhưng liên quan chặt tới cùng một vùng code
(`BattlefieldRegions.ts`, `TranPhapPanel.vue`, `TranPhapCombatPreviewScene.ts`,
`combat-grid-view.ts`) được gom vào một spec duy nhất theo yêu cầu user:

1. **Độ phân giải vùng đặt quân quá mịn.** Mỗi bên (player/enemy) hiện có
   `PLAYER_SIDE_REGION`/`ENEMY_SIDE_REGION` — 2 hộp 6x6 (36 ô mỗi bên) bên
   trong lưới chiến trường thật 10x16. User muốn gộp mỗi cục 2x2 ô cũ
   thành 1 "vị trí đứng" duy nhất, còn lại đúng 3 hàng dọc × 3 hàng ngang
   (9 vị trí đứng) mỗi bên.
2. **Trận Pháp panel và CombatScene "mỗi nơi một kiểu".** `CombatScene`
   (combat thật) và `TranPhapCombatPreviewScene` (panel Trận Pháp) đều
   dùng chung `CombatGridView`/`BattleGridProjection` để vẽ 2.5D — đây là
   phần đã nhất quán từ Part 1/2. Nhưng panel tự bootstrap một
   `Phaser.Game` RIÊNG, cấu hình lệch với bản combat thật, và giữ một
   không gian toạ độ cục bộ (`PREVIEW_GRID_SIZE`, độc lập với
   `PLAYER_SIDE_REGION`) — hai hằng số cùng giá trị nhưng không cùng
   nguồn, dễ trôi lệch nhau qua thời gian.
3. **Lỗi thật khi thả quân vào panel**, xác nhận qua đọc code (không cần
   tái hiện bằng browser vì nguyên nhân đã rõ 100% từ diff cấu hình):
   - `PhaserCanvas.vue:120-133` (bootstrap combat thật) có
     `physics: { default: 'arcade', arcade: {...} }`.
   - `TranPhapPanel.vue:215-222` (bootstrap panel) **không có field
     `physics` nào cả**.
   - `CombatGridView.getOrCreateSprite()` gọi vô điều kiện
     `this.host.physics.add.existing(gameSprite)` cho MỌI nhánh tạo sprite
     (player, enemy có texture, và nhánh fallback texture — nhánh panel
     luôn đi qua). Với panel, `this.physics` là `undefined` (plugin Arcade
     Physics chưa từng đăng ký) → `TypeError: Cannot read properties of
     undefined (reading 'add')` ngay lần đầu bất kỳ quân nào được thả vào
     ô. Đây chính là lỗi user báo cáo.
   - Test hiện tại (`combat-grid-view.test.ts:55`) mock sẵn
     `physics: { add: { existing: vi.fn() } }` nên suite xanh không phát
     hiện được — bug này đúng loại P14 (Playwright/browser check) được
     sinh ra để bắt.
4. **Trạng thái ô không phân biệt được hover/occupied/enabled.**
   `.tran-phap-panel__cell--enabled` và `--occupied` (TranPhapPanel.vue:391-395)
   dùng CHUNG một style (chỉ đổi `border-color`, không có nền/icon riêng).
   Vì trận pháp test-only (`HON_DON_TRAN`) mở TOÀN BỘ ô cùng lúc, hiệu ứng
   thị giác là "cả mảng lưới xanh đồng loạt" thay vì từng ô phản hồi trạng
   thái riêng — đúng như user mô tả ("xanh mặt phẳng 2D" thay vì
   "slot hover/used").
5. **Không có rào chắn cho tiếng Việt lẻ tẻ ngoài i18n.** User yêu cầu:
   nơi DUY NHẤT được phép xuất hiện tiếng Việt là UI/UX, và phải đi qua
   cổng i18n (`vue-i18n`) — không hardcode string tiếng Việt trong
   template/script. Rule tổng quát đã thêm vào `AGENTS.md` (P15: comment
   tiếng Anh, P16: text UI qua i18n). Spec này áp dụng cụ thể P16 cho
   `TranPhapPanel.vue` — file đang có 3 chuỗi hardcode
   (`title="Trận Pháp"`, `"Lưu Trận Pháp"`,
   `"[TEST-ONLY] Cấp 5 Companion Test"`).

## Goals

1. Thêm `standingSlotPosition(region, slotRow, slotColumn)` +
   `STANDING_SLOT_COUNT = 3` vào `BattlefieldRegions.ts` — nguồn sự thật
   DUY NHẤT cho việc quy đổi 1 trong 9 "vị trí đứng" ra toạ độ tuyệt đối
   (`GridPosition`) trong lưới 10x16 thật. Toán khoảng cách/AOE/targeting
   không đổi — chúng chỉ nhận `GridPosition` đã resolve, y hệt cách chúng
   đang nhận `resolvePartyFormation()`/`resolveEnemySpawnPosition()`.
2. `FormationPlacement.ts`'s `localCellToAbsolute()` và
   `EnemySpawnPlacement.ts`'s `resolveEnemySpawnPosition()` (nhánh random)
   dùng `standingSlotPosition()` thay vì cộng thẳng toạ độ liên tục.
   Nhánh Boss giữ nguyên `centerOfRegion()` (đã trùng khớp đúng slot giữa).
3. `TranPhapCombatPreviewScene.ts` xoá hằng số cục bộ `PREVIEW_GRID_SIZE`,
   import thẳng `STANDING_SLOT_COUNT` từ `BattlefieldRegions.ts` — một
   nguồn duy nhất cho "panel vẽ đúng 3x3 mà chiến trường thật dùng", thay
   vì hai hằng số trùng giá trị nhưng khai báo độc lập.
4. Sửa bootstrap `Phaser.Game` của panel (`TranPhapPanel.vue`) để có cùng
   khối `physics: { default: 'arcade', arcade: { gravity: {x:0,y:0},
   debug:false } }` như `PhaserCanvas.vue` — khắc phục lỗi throw khi thả
   quân, đồng thời xoá luôn 1 điểm "mỗi nơi một kiểu" giữa 2 bootstrap.
5. Phân biệt rõ 3 trạng thái ô trong CSS overlay:
   - `enabled` (ô hợp lệ, còn trống): giữ border xanh, KHÔNG nền.
   - `occupied` (đã có quân đứng): thêm nền fill xanh nhạt
     (`background: color-mix` hoặc rgba cố định dựa trên `--jade`) để phân
     biệt rõ với `enabled`, kèm giữ label combatantId hiện có.
   - `hover` (đang kéo quân tới): giữ inset ring hiện tại, không đổi.
6. Di chuyển 3 chuỗi hardcode tiếng Việt trong `TranPhapPanel.vue`
   (`"Trận Pháp"`, `"Lưu Trận Pháp"`, `"[TEST-ONLY] Cấp 5 Companion Test"`)
   vào i18n locale resource cục bộ của component (`useI18n({ useScope:
   'local' })`, đúng pattern `BagGrid.vue` đang dùng), theo P16.
7. `data/formation/TranPhap.ts`'s `allLocalCells()`: vòng lặp `0..5` →
   `0..2` (36 → 9 ô), sửa comment liên quan.

## Non-Goals

- **Không vẽ marker/overlay 9 ô lên lưới combat thật** (đã chốt với user)
  — `CombatScene` (10x16) giữ nguyên 100% hình ảnh hiện có; thay đổi chỉ
  nằm ở logic CHỌN vị trí (tập điểm hợp lệ thu hẹp còn 9/bên).
- **Không hợp nhất 2 `Phaser.Game` thành 1 instance dùng chung** giữa
  combat thật và panel — 2 DOM container/lifecycle khác nhau (panel là
  overlay có thể mở/đóng độc lập với combat), rủi ro cao, không cần thiết
  để đạt goal "nhất quán" — chỉ cần cấu hình bootstrap KHỚP nhau (Goal 4)
  là đủ để hết bug và hết "mỗi nơi một kiểu" về mặt cấu hình.
- **Không migrate toàn bộ backlog tiếng Việt hardcode của cả codebase**
  sang i18n — P16 áp dụng tại đây CHỈ cho `TranPhapPanel.vue` (file đang
  sửa trong spec này). Phần còn lại của codebase là backlog riêng, không
  đụng tới (P10 — không sửa ngoài phạm vi).
- **Không re-author nội dung `TRAN_PHAP_FORMATIONS`** — hiện chỉ có đúng 1
  formation TEST-ONLY (`HON_DON_TRAN`, mở toàn bộ ô), đổi cận vòng lặp là
  đủ, không cần thiết kế formation thật nào trong spec này.
- **Không đổi kiểu dữ liệu `FormationSlotAssignment.row`/`.column`** — vẫn
  là local slot index (0-2), chỉ đổi Ý NGHĨA (slot thay vì ô liên tục) và
  hàm quy đổi ra toạ độ tuyệt đối.

## Design

### 1. Standing Slot — nguồn sự thật cho vị trí đứng

`game/src/core/battle/BattlefieldRegions.ts` thêm:

```ts
export const STANDING_SLOT_COUNT = 3

// Merge each old 2x2 block into one standing slot, anchored at the first
// physical row/column of the pair (offsets 0, 2, 4 across a 6-wide
// region). Distance/AOE math is untouched -- it only ever consumes the
// resolved GridPosition, same as it already does today via
// resolvePartyFormation()/resolveEnemySpawnPosition().
export function standingSlotPosition(
  region: BattlefieldUsableRegion,
  slotRow: number,
  slotColumn: number,
): GridPosition {
  return {
    row: (region.rowMin + slotRow * 2) as LaneIndex,
    column: region.columnMin + slotColumn * 2,
  }
}
```

`BATTLEFIELD_ROW_RANGE` (3-8, 6 hàng) và cả 2 region (6 cột) đều chia hết
cho `STANDING_SLOT_COUNT * 2 = 6` nên 3 slot mỗi trục cách đều nhau 2 ô —
không lệch tâm, không cần làm tròn.

`centerOfRegion()` giữ nguyên — với 4 giá trị hiện tại
(`rowMin=3,rowMax=8` → `floor(5.5)=5`; `columnMin=0,columnMax=5` →
`floor(2.5)=2`; `columnMin=7,columnMax=12` → `floor(9.5)=9`), kết quả
LUÔN trùng đúng anchor của slot giữa (slot index 1) theo công thức trên —
đã verify bằng tay, không cần sửa gì ở Boss branch.

### 2. Nơi cắm vào (mechanical)

| File | Đổi gì |
|---|---|
| `BattlefieldRegions.ts` | + `standingSlotPosition()`, `STANDING_SLOT_COUNT` |
| `FormationPlacement.ts` | `localCellToAbsolute()` gọi `standingSlotPosition(PLAYER_SIDE_REGION, cell.row, cell.column)` |
| `EnemySpawnPlacement.ts` | Nhánh random: `randomIntInclusive(0, STANDING_SLOT_COUNT - 1)` cho slotRow/slotColumn rồi `standingSlotPosition()`. Nhánh Boss giữ `centerOfRegion()` |
| `TranPhapCombatPreviewScene.ts` | Xoá `export const PREVIEW_GRID_SIZE = 6`, import `STANDING_SLOT_COUNT` từ `BattlefieldRegions.ts`, dùng thay cho mọi chỗ cũ dùng `PREVIEW_GRID_SIZE`. Xoá `previewCellTopLeft()` (dead code, xác nhận 0 call site production, chỉ còn dùng trong test file của chính nó) |
| `TranPhapPanel.vue` | Xoá import `PREVIEW_CELL_SIZE`/`PREVIEW_GRID_SIZE` (dead + nay không còn tồn tại), import `STANDING_SLOT_COUNT` cho vòng lặp overlay grid. Thêm `physics` block vào `new Phaser.Game({...})`. Sửa CSS `--occupied`. Chuyển 3 chuỗi hardcode qua i18n |
| `TranPhap.ts` | `allLocalCells()`: `0..5` → `0..2`, sửa comment "36 ô/6x6" → "9 ô/3x3" |
| `combat-grid-view.test.ts` | Không đổi logic — mock `physics` đã đúng, chỉ verify không có regression |

### 3. Fix crash: khớp bootstrap Phaser.Game

```ts
// TranPhapPanel.vue
previewGame = new Phaser.Game({
  type: Phaser.AUTO,
  parent: previewContainerRef.value,
  width: PANEL_CANVAS_WIDTH,
  height: PANEL_CANVAS_HEIGHT,
  transparent: true,
  physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 0 }, debug: false } },
  scene: [TranPhapCombatPreviewSceneClass],
})
```

Đây là fix tối thiểu, đúng nguyên nhân gốc (xác nhận qua diff 2 file, không
phải đoán) — không cần sửa gì trong `combat-grid-view.ts` hay
`CombatGridViewHost`.

### 4. Fix phân biệt trạng thái ô

```css
.tran-phap-panel__cell--enabled {
  opacity: 1;
  border-color: var(--jade, #4caf50);
}

.tran-phap-panel__cell--occupied {
  opacity: 1;
  border-color: var(--jade, #4caf50);
  background: rgba(76, 175, 80, 0.22); /* --jade at low alpha -- distinguishes "occupied" from "enabled, empty" */
}

.tran-phap-panel__cell--hover {
  opacity: 1;
  border-color: var(--jade, #4caf50);
  box-shadow: 0 0 0 2px var(--jade, #4caf50) inset;
}
```

### 5. i18n cho `TranPhapPanel.vue`

Theo pattern `BagGrid.vue` (`useI18n({ useScope: 'local' })` + file resource
cục bộ cạnh component, hoặc khối `<i18n>` tuỳ convention hiện có của
project — kiểm tra lại cách `BagGrid.vue` khai báo resource lúc viết plan
task cụ thể). 3 khoá cần thêm:

- `panels.tranPhap.title` = "Trận Pháp"
- `panels.tranPhap.confirm` = "Lưu Trận Pháp"
- `panels.tranPhap.grantTest` = "[TEST-ONLY] Cấp 5 Companion Test"

## Testing

- `BattlefieldRegions.test.ts`: test mới cho `standingSlotPosition()` (9
  tổ hợp slot × 2 region = 18 case, hoặc test theo công thức + vài mốc).
- `EnemySpawnPlacement.test.ts`: cập nhật assertion nhánh random — kết quả
  giờ chỉ có thể là 1 trong 9 vị trí cố định/bên thay vì bất kỳ đâu trong
  36 ô.
- `FormationPlacement.test.ts` / `PartyFormation.test.ts` /
  `GameManager.partyFormation.test.ts`: cập nhật input/expected theo
  local slot 0-2 thay vì 0-5.
- `GameManager.laneAssignment.test.ts`,
  `GameManager.turnBattleEnemyWavePosition.test.ts`: rà lại assertion nếu
  có phụ thuộc dải giá trị 6x6 cũ.
- `TranPhap.test.ts`: 9 ô thay vì 36.
- `TranPhapCombatPreviewScene.test.ts`: xoá test của `previewCellTopLeft()`
  (dead code bị xoá), cập nhật `PREVIEW_GRID_SIZE` → `STANDING_SLOT_COUNT`
  ở mọi assertion còn lại liên quan tới kích thước lưới.
- **P14 (Playwright, bắt buộc — đây chính là loại thay đổi rule đó sinh
  ra để bắt):** mở panel Trận Pháp thật trong Edge, chọn Hỗn Độn Trận, kéo
  thả player + ít nhất 1 companion vào 2 ô khác nhau, xác nhận: (a) không
  còn lỗi console khi thả, (b) ô occupied có nền phân biệt rõ với ô
  enabled trống, (c) lưới overlay đúng 3x3 (9 ô), (d) canvas Phaser vẽ
  đúng 3x3 phối cảnh khớp theo.

## Global Constraints

- Không đổi công thức toán combat (Chebyshev distance, AOE, targeting) —
  chúng chỉ tiêu thụ `GridPosition` đã resolve.
- Lưới combat thật (`CombatScene`, 10x16) giữ nguyên 100% hình ảnh hiện
  tại — không thêm marker/overlay nào cho 9 vị trí đứng.
- Comment mới viết bằng tiếng Anh (P15, `AGENTS.md`).
- Chuỗi UI mới trong `TranPhapPanel.vue` đi qua i18n, không hardcode (P16,
  `AGENTS.md`).
- Không sửa file ngoài phạm vi bảng ở mục "Nơi cắm vào" (P10).
- Không thêm dependency mới.

## Notes / Suggestions (ngoài phạm vi spec này)

- Lệch kích thước canvas Phaser (420x480 phối cảnh) so với lưới CSS
  overlay kéo-thả (đã review ở phiên trước, tồn tại từ Part 2) VẪN CÒN
  sau spec này — chỉ đổi số ô (6x6→3x3), không đổi việc 2 lớp không khớp
  kích thước/hình dạng. Cần 1 spec riêng nếu muốn overlay tự tính vị trí
  từ `projection.gridToScreen()`.
- Backlog i18n cho phần còn lại của UI (ngoài `TranPhapPanel.vue`) là một
  migration lớn, nên tách thành spec/plan riêng nếu user muốn làm tiếp
  theo diện rộng.
