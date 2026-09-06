# Battlefield Perspective Panel — 2.5D cho Trận Pháp Panel (Part 2 of 4) Design

## Problem

Panel Trận Pháp (`TranPhapCombatPreviewScene`, kết quả của Part 1 —
`docs/superpowers/specs/2026-09-06-battlefield-slot-shared-gridview-design.md`)
hiện vẽ lưới 6x6 **phẳng** (không phối cảnh) — quyết định thiết kế rõ ràng
của Hỗn Độn Trận ban đầu ("không cần phối cảnh hay gì hết"). User giờ muốn
panel có "cái nhìn 2.5D như trong trận đánh thật" — cùng cảm giác hàng
xa/gần khác kích thước như `CombatScene` thật đang có qua
`BattleGridProjection.ts`'s `PerspectiveGridProjection`.

Trở ngại: `BattleGridProjection.ts` hardcode `GRID_ROW_COUNT`/
`GRID_COLUMN_COUNT` (10x16, từ `@/core/battle/BattleGrid`) trực tiếp vào
công thức toán chiếu tọa độ — không nhận lưới kích thước khác. Tương tự,
`combat-grid-view.ts`'s `redrawGridLines()` cũng hardcode 2 hằng số này
(qua `@/core/battle/BattleLane`) để vẽ đường lưới, và còn vẽ thêm một dải
tô màu "cổng phòng thủ" tại cột `HERO_COLUMN` — cơ chế hình ảnh dành riêng
cho combat real-time cũ (quái tiếp cận/tấn công cổng), nay đã lỗi thời vì
combat đã chuyển sang turn-based (không còn khái niệm "cổng" quái tiến vào).

## Goals

1. `BattleGridProjection` (`Flat`/`PerspectiveGridProjection`) nhận
   `rows`/`columns` tùy chỉnh — combat thật tiếp tục dùng 10x16 (hành vi
   không đổi), panel dùng 6x6.
2. `PerspectiveGridProjection`'s "chiều cao tối thiểu mặt đường"
   (`PERSPECTIVE_MIN_ROAD_HEIGHT`, hiện cứng 320px cho màn hình combat to)
   trở thành tham số tùy chỉnh — panel dùng một giá trị nhỏ hơn phù hợp
   với canvas nhỏ của nó.
3. `redrawGridLines()` dùng chung được cho cả combat thật và panel: đọc
   `rows`/`columns` từ chính `projection` (không còn import hằng số cứng),
   và bỏ hẳn đoạn vẽ "cổng phòng thủ" (obsolete với turn-based) — chỉ còn
   kẻ ô lưới + viền ngoài (perspective mode).
4. Panel canvas lớn hơn (420x480, từ 360x360) để có đủ không gian thể
   hiện chiều sâu phối cảnh.
5. Panel có nền 2 lớp phẳng (sky phía trên đường chân trời, ground phía
   dưới) thay vì 1 màu đơn sắc phủ toàn canvas — đặt tên/cấu trúc sao cho
   sau này thay bằng 2 ảnh nghệ thuật thật (`Image`) chỉ cần swap texture,
   không đổi cấu trúc scene.
6. `TranPhapCombatPreviewScene` chuyển `isPerspective: true`, sprite tự
   động scale theo chiều sâu qua cơ chế sẵn có của `CombatGridView`
   (không cần sửa `getOrCreateSprite`/`positionSprite`/`applySpriteSize` —
   các hàm này đã rẽ nhánh theo `host.isPerspective` từ Part 1).

## Non-Goals

- Không thêm ảnh nghệ thuật thật (sao/trăng/núi/đá như
  `BattlefieldBackdrop.ts`'s bản procedural cho combat thật) — panel vẫn
  là công cụ test, chỉ 2 rectangle màu phẳng, chừa chỗ cho art thật sau.
- Không đổi layout CSS xung quanh panel (formation cards, roster queue) —
  chỉ đổi kích thước chính canvas Phaser.
- Không đổi hành vi/pixel-parity của combat thật — mọi tham số mới đều có
  giá trị mặc định = hành vi hiện tại khi gọi không truyền thêm đối số.
- Không động vào wave spawn hay spawn VFX (Part 3, Part 4 — sequence riêng).
- Không xóa hằng số `HERO_COLUMN` (vẫn dùng cho gameplay ở
  `PartyFormation.ts`/`BattleLane.ts`/`EnemyAttackSystem.ts`) — chỉ xóa
  đoạn code VẼ dải tô màu cổng trong `redrawGridLines()`.

## Design

### 1. `BattleGridProjection.ts` — tham số hóa rows/columns/minRoadHeight

`computePerspectiveGeometry()` nhận thêm tham số tùy chọn:

```ts
export function computePerspectiveGeometry(
  viewport: ProjectionViewport,
  minRoadHeight: number = PERSPECTIVE_MIN_ROAD_HEIGHT,
): PerspectiveGeometry {
  const availableHeight = Math.max(1, viewport.height - viewport.topInset - viewport.bottomInset)
  const desiredScenery = availableHeight * PERSPECTIVE_SCENERY_RATIO
  const maxScenery = Math.max(0, availableHeight - minRoadHeight)
  const sceneryHeight = Math.min(desiredScenery, maxScenery)

  return {
    horizonY: viewport.topInset + sceneryHeight,
    roadBottomY: viewport.topInset + availableHeight,
    sceneryHeight,
    roadHeight: availableHeight - sceneryHeight,
  }
}
```

`FlatGridProjection`/`PerspectiveGridProjection` nhận `rows`/`columns` qua
constructor, lưu thành field riêng, và **mọi** chỗ dùng
`GRID_ROW_COUNT`/`GRID_COLUMN_COUNT` module-level bên trong 2 class này đổi
thành `this.rows`/`this.columns`. `PerspectiveGridProjection` nhận thêm
`minRoadHeight` (mặc định `PERSPECTIVE_MIN_ROAD_HEIGHT`), truyền xuống
`computePerspectiveGeometry()`.

`BattleGridProjection` interface (dùng bởi cả 2 class và mọi consumer
ngoài) thêm 2 field readonly:

```ts
export interface BattleGridProjection {
  readonly mode: BattlefieldRenderMode
  readonly viewport: ProjectionViewport
  readonly rows: number
  readonly columns: number
  // ... (không đổi phần còn lại)
}
```

Đây là nguồn sự thật DUY NHẤT cho kích thước lưới — `redrawGridLines()`
(mục 2) đọc trực tiếp từ `projection.rows`/`projection.columns`, không cần
thêm field nào vào `CombatGridViewHost` (interface Part 1 đã chốt giữ
nguyên, không mở rộng).

`createBattleGridProjection()` nhận thêm 2 tham số tùy chọn, mặc định =
lưới combat thật (giữ nguyên mọi call site hiện có — kể cả ~30 chỗ trong
test files — không cần sửa):

```ts
export function createBattleGridProjection(
  mode: BattlefieldRenderMode,
  viewport: ProjectionViewport,
  rows: number = GRID_ROW_COUNT,
  columns: number = GRID_COLUMN_COUNT,
  minRoadHeight: number = PERSPECTIVE_MIN_ROAD_HEIGHT,
): BattleGridProjection {
  return mode === 'perspective'
    ? new PerspectiveGridProjection(viewport, rows, columns, minRoadHeight)
    : new FlatGridProjection(viewport, rows, columns)
}
```

`CombatScene.ts:842`'s call site (`createBattleGridProjection(this.renderMode, viewport)`)
**không đổi** — vẫn 2 đối số, tự nhận default 10x16/320px, hành vi
pixel-parity 100%.

### 2. `combat-grid-view.ts`'s `redrawGridLines()` — dùng chung, bỏ gate decor

Thay mọi `GRID_ROW_COUNT`/`GRID_COLUMN_COUNT` trong hàm này bằng
`projection.rows`/`projection.columns`; xóa import 2 hằng số này (và
`HERO_COLUMN`) khỏi đầu file — `HERO_LANE_INDEX` vẫn giữ (dùng ở nơi khác
trong file, dòng 256, không liên quan gate).

Khối code bị xóa (nằm trong nhánh `if (!isFlat)`, chỉ phần TÔ MÀU CỔNG —
phần vẽ viền ngoài `strokePoints` NGAY TRƯỚC nó vẫn giữ nguyên vì là viền
hợp lệ của mọi perspective mode, không riêng gì combat):

```ts
// XÓA đoạn này (obsolete — turn-based không còn khái niệm "cổng"):
// Cổng phòng thủ phủ MỌI hàng TẠI CỘNG cổng (plan §2.2).
const gatePolygon = projection.footprintPolygon({
  rowStart: 0,
  rowEnd: GRID_ROW_COUNT - 1,
  colStart: HERO_COLUMN,
  colEnd: HERO_COLUMN,
})

graphics.fillStyle(PLAYER_COLOR, 0.05)
graphics.fillPoints(toVector2Points(gatePolygon), true)
```

Hàm sau khi sửa (đầy đủ, thay thế toàn bộ `redrawGridLines()` hiện tại):

```ts
redrawGridLines() {
  const graphics = this.scene.gridGraphics
  const projection = this.scene.projection

  if (!graphics || !projection) {
    return
  }

  graphics.clear()

  if (this.scene.usingArtBackdrop) {
    return
  }

  const isFlat = Boolean(this.scene.arenaRect)

  graphics.lineStyle(
    1,
    isFlat ? LANE_DIVIDER_COLOR : PERSPECTIVE_GRID_COLOR,
    isFlat ? 0.55 : PERSPECTIVE_GRID_ALPHA,
  )

  for (let boundaryRow = 0; boundaryRow <= projection.rows; boundaryRow++) {
    const rowFloat = boundaryRow - 0.5
    const left = projection.gridToScreen(rowFloat, -0.5)
    const right = projection.gridToScreen(rowFloat, projection.columns - 0.5)

    graphics.beginPath()
    graphics.moveTo(left.x, left.y)
    graphics.lineTo(right.x, right.y)
    graphics.strokePath()
  }

  for (let boundaryColumn = 0; boundaryColumn <= projection.columns; boundaryColumn++) {
    const columnFloat = boundaryColumn - 0.5
    const far = projection.gridToScreen(-0.5, columnFloat)
    const near = projection.gridToScreen(projection.rows - 0.5, columnFloat)

    graphics.beginPath()
    graphics.moveTo(far.x, far.y)
    graphics.lineTo(near.x, near.y)
    graphics.strokePath()
  }

  if (!isFlat) {
    const corners = [
      projection.gridToScreen(-0.5, -0.5),
      projection.gridToScreen(-0.5, projection.columns - 0.5),
      projection.gridToScreen(projection.rows - 0.5, projection.columns - 0.5),
      projection.gridToScreen(projection.rows - 0.5, -0.5),
    ]

    graphics.lineStyle(1.5, PERSPECTIVE_BORDER_COLOR, PERSPECTIVE_BORDER_ALPHA)
    graphics.strokePoints(toVector2Points(corners), true, true)
  }
}
```

`PLAYER_COLOR`/`toVector2Points` vẫn còn dùng ở nơi khác trong file
(kiểm tra trước khi xóa import nếu implementer thấy unused — thực tế
`toVector2Points` vẫn cần cho `corners`, `PLAYER_COLOR` có thể trở thành
unused import riêng trong file này, cần xóa nếu vậy).

### 3. Panel size + backdrop 2 lớp

`TranPhapPanel.vue`: canvas Phaser đổi từ `360x360` thành `420x480` (đổi
`width`/`height` truyền vào `new Phaser.Game({...})` — không đổi CSS
layout formation cards/roster queue xung quanh, canvas chỉ to hơn tại
đúng vị trí hiện tại).

`TranPhapCombatPreviewScene.ts` thêm hằng số riêng:

```ts
const PERSPECTIVE_MIN_ROAD_HEIGHT_PANEL = 140
```

Trong `create()`, thay vì vẽ 1 rectangle nền phủ toàn canvas như hiện tại,
vẽ 2 rectangle dựa trên `computePerspectiveGeometry()`:

```ts
const geometry = computePerspectiveGeometry(
  { width: PANEL_WIDTH, height: PANEL_HEIGHT, topInset: 0, bottomInset: 0 },
  PERSPECTIVE_MIN_ROAD_HEIGHT_PANEL,
)

this.skyLayer = this.add
  .rectangle(0, 0, PANEL_WIDTH, geometry.horizonY, PANEL_SKY_COLOR)
  .setOrigin(0, 0)

this.groundLayer = this.add
  .rectangle(0, geometry.horizonY, PANEL_WIDTH, geometry.roadHeight, PANEL_GROUND_COLOR)
  .setOrigin(0, 0)
```

(`PANEL_SKY_COLOR`/`PANEL_GROUND_COLOR` — 2 hằng số màu mới, ví dụ
`0x22283a`/`0x1a1a1a` — implementer chọn 2 tông khác biệt rõ ràng để
horizon dễ nhận ra khi test.) `skyLayer`/`groundLayer` là 2 field
`Phaser.GameObjects.Rectangle` trên scene — đặt tên rõ để việc thay bằng
`Image` thật sau này (Part ngoài phạm vi 4 part hiện tại) chỉ cần đổi loại
GameObject, giữ nguyên vị trí gọi trong `create()`.

### 4. `TranPhapCombatPreviewScene` chuyển sang perspective

`isPerspective` (từ Part 1's `CombatGridViewHost.isPerspective`) đổi từ
`false` thành `true`. `projection` khởi tạo qua:

```ts
this.projection = createBattleGridProjection(
  'perspective',
  { width: PANEL_WIDTH, height: PANEL_HEIGHT, topInset: 0, bottomInset: 0 },
  PREVIEW_GRID_SIZE, // 6
  PREVIEW_GRID_SIZE, // 6
  PERSPECTIVE_MIN_ROAD_HEIGHT_PANEL,
)
```

Grid lines vẽ qua `this.gridView.redrawGridLines()` (đã generalize ở mục
2) thay vì code vẽ `Graphics` thủ công 6x6 hiện tại trong scene. Sprite
positioning/sizing tiếp tục qua `this.gridView.positionSprite()`/
`getOrCreateSprite()` không đổi gì thêm — các hàm này đã tự đọc
`host.isPerspective` để rẽ nhánh áp dụng `applyEntityDepthScale()` (built
sẵn từ Part 1, xem `combat-grid-view.ts:123-128`).

## Testing

- `BattleGridProjection.test.ts`: thêm test case gọi
  `createBattleGridProjection('perspective', viewport, 6, 6)` xác nhận
  `gridToScreen(0, 0)` và `gridToScreen(5, 5)` cho scale khác nhau (hàng xa
  nhỏ hơn hàng gần) đúng tỷ lệ dự kiến cho lưới 6x6 (không phải 10x16).
  Test case gọi `computePerspectiveGeometry(viewport, 140)` xác nhận
  `roadHeight >= 140`.
- `combat-grid-view.test.ts`: test case `redrawGridLines()` với fake host
  chiếu lưới 6x6 xác nhận số lần gọi `graphics.moveTo/lineTo` khớp 7 hàng +
  7 cột ranh giới (rows=6 → 7 boundary lines) thay vì 11/17 của thật —
  xác nhận hàm đã đọc `projection.rows/columns` thay vì hằng số cứng. Test
  case xác nhận KHÔNG còn gọi `graphics.fillPoints` (gate polygon đã xóa)
  bằng cách spy `fillPoints` và assert `not.toHaveBeenCalled()`.
- `TranPhapCombatPreviewScene.test.ts`: giữ nguyên test hiện có của
  `previewCellTopLeft` (không đổi — vẫn hàm tọa độ ô overlay HTML, độc lập
  với phối cảnh Phaser canvas).
- Manual Playwright: mở panel Trận Pháp, xác nhận nhìn thấy đường chân
  trời (sky/ground 2 màu), lưới hội tụ về phía xa, kéo-thả 1 test
  companion vào ô hàng gần (row 5) và 1 ô hàng xa (row 0) — sprite hàng xa
  phải nhỏ hơn rõ rệt so với sprite hàng gần.

## Self-Review

- **Placeholder scan**: không còn "TBD"/"TODO" nào trong spec.
- **Internal consistency**: mục 1 nói `CombatGridViewHost` KHÔNG mở rộng —
  mục 2 xác nhận đúng, chỉ dùng `projection.rows/columns`. Nhất quán.
- **Scope check**: spec chỉ đụng 3 file (`BattleGridProjection.ts`,
  `combat-grid-view.ts`, `TranPhapCombatPreviewScene.ts`) + CSS canvas
  size trong `TranPhapPanel.vue` — đủ nhỏ cho 1 implementation plan duy
  nhất, không cần chia nhỏ thêm.
- **Ambiguity check**: màu sky/ground cụ thể chưa chốt số hex — đã ghi rõ
  "implementer chọn 2 tông khác biệt rõ ràng" thay vì để mơ hồ hoàn toàn;
  đây là quyết định thẩm mỹ nhỏ, không ảnh hưởng logic, chấp nhận được ở
  mức tự do có kiểm soát này.
