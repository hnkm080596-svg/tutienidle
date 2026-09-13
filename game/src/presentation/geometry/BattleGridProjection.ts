// Projection layer 2.5D (2026-08-24) — lớp TOÁN HỌC THUẦN biến đổi giữa
// tọa độ gameplay lưới (row/column, xem BattleGrid.ts) và pixel màn hình.
//
// Nguyên tắc:
// - KHÔNG import Phaser, KHÔNG cầm GameObject — module này chỉ tính số,
//   unit test được không cần canvas.
// - KHÔNG thay đổi tọa độ gameplay: input/output đều là row (lane rời
//   rạc) + column liên tục theo ĐƠN VỊ CỘT y hệt 'positions'/'action_impact'
//   đang emit. Mọi damage/range/AOE vẫn nằm ở core qua BattleGrid.
// - 2 hiện thực cùng 1 interface:
//     + 'flat'        : lưới ô VUÔNG đồng đều + letterbox — sao chép CHÍNH
//                       XÁC công thức cũ của CombatScene.applyBattlefieldLayout()
//                       (cellSize = min((w-24)/COLS, availH/ROWS)...) để renderer
//                       cũ còn chạy nguyên vẹn sau feature flag.
//     + 'perspective' : mặt đất nghiêng có phối cảnh — hàng xa (row 0) nhỏ
//                       và dày đặc hơn, hàng gần (row R-1) to và thưa hơn;
//                       scale trả về kèm mỗi điểm để entity/VFX tự scale
//                       theo chiều sâu.
// - Anchor quy ước: gridToScreen() trả về ĐIỂM CHÂN ĐẤT (foot point) tại
//   TÂM ô — sprite neo origin (0.5, 1) vào đúng điểm đó ở chế độ
//   perspective; health bar/cast bar/label tự suy từ foot point.
//
// Toán phối cảnh (đóng form, invert chính xác để round-trip không trôi):
//   v = (row + 0.5) / ROWS              ∈ [0,1]  (0 = xa, 1 = gần)
//   u = (column + 0.5) / COLUMNS        ∈ [0,1]
//   denom(v) = q + (1 - q) * v          (q > 1)
//   f(v)     = v / denom(v)             → y = top + H * f(v)
//   scale(v) = 1 / denom(v)^2           (scale(gần) = 1, scale(xa) = 1/q²)
//   x = cx + (u - 0.5) * nearWidth * scale(v)
// Khoảng cách dọc giữa 2 hàng liền nhau ∝ f'(v) = q/denom² — cùng tỉ lệ
// với scale ngang ⇒ cell bị ép về hình chữ nhật MỘT TỈ LỆ NHẤT trên mọi
// hàng (nén đều như ảnh chụp thật, không méo lệch trục).
import { GRID_COLUMN_COUNT, GRID_ROW_COUNT, type CellArea } from '@/core/battle/BattleGrid'
import type { BattlefieldRenderMode } from './BattlefieldRenderMode'

/** Cường độ phối cảnh: q = 1 + strength; tỉ lệ rộng gần/xa = q². */
export const PERSPECTIVE_STRENGTH = 0.42

/**
 * Bố cục "nửa trên phong cảnh, nửa dưới con đường": trong băng trống
 * giữa 2 HUD, phần TRÊN (trời/núi chân trời) chiếm ratio này, phần DƯỚI
 * là mặt đường combat. Chỉ áp dụng cho perspective — flat giữ nguyên
 * băng full legacy.
 */
export const PERSPECTIVE_SCENERY_RATIO = 0.5

/** Lề hai bên khi tính bề rộng cạnh GẦN của lưới (đồng bộ gutter 24px cũ). */
export const PERSPECTIVE_SIDE_MARGIN = 12

/**
 * Chiều cao TỐI THIỂU của mặt đường (px) — scenery ratio 50% chỉ áp dụng
 * khi băng trống đủ cao; màn thấp/portrait ưu tiên road trước để nhân vật
 * không bị dính chùm. Khoảng 300–340px là ngưỡng đọc được của character
 * scale hiện hành.
 */
export const PERSPECTIVE_MIN_ROAD_HEIGHT = 320

export interface PerspectiveGeometry {
  /** Chân trời = đáy vùng phong cảnh = đỉnh mặt đường. */
  horizonY: number
  roadBottomY: number
  sceneryHeight: number
  roadHeight: number
}

/** Snapshot hình học layout phục vụ e2e/visual gate (không dùng gameplay). */
export interface BattlefieldGeometrySnapshot extends PerspectiveGeometry {
  viewportWidth: number
  viewportHeight: number
  topInset: number
  bottomInset: number
}

/**
 * Quyết định bố cục "nửa trên phong cảnh, nửa dưới con đường" với clamp
 * thích ứng: desired = 50% băng trống, nhưng road luôn giữ tối thiểu
 * PERSPECTIVE_MIN_ROAD_HEIGHT. Hàm thuần — test được không cần canvas.
 */
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

export interface ProjectionViewport {
  width: number
  height: number
  /** Khoảng reserved phía trên cho DOM chrome (Top+Status bar). */
  topInset: number
  /** Khoảng reserved phía dưới cho DOM chrome (Event+Control bar). */
  bottomInset: number
  /**
   * Khoảng reserved phía PHẢI cho skill dock panel mới (Combat Art
   * Pipeline spec §7.5) — mặc định 0 khi bỏ qua để mọi call site cũ
   * (chưa biết dock) không phải sửa gì.
   */
  rightInset?: number
}

export interface GridScreenPoint {
  x: number
  /** Điểm CHÂN ĐẤT tại tâm ô — foot anchor của sprite. */
  y: number
  /** Hệ số scale theo chiều sâu (hàng gần = 1, càng xa càng nhỏ). */
  scale: number
}

/** Row/column LIÊN TỤC (float) — caller tự làm tròn/clamp qua BattleGrid. */
export interface GridFloatPosition {
  row: number
  column: number
}

export interface CellPixelSize {
  width: number
  height: number
}

export interface ProjectionBounds {
  left: number
  top: number
  right: number
  bottom: number
  centerX: number
}

export interface FootprintPoint {
  x: number
  y: number
}

export interface BattleGridProjection {
  readonly mode: BattlefieldRenderMode
  readonly viewport: ProjectionViewport
  // Battlefield Perspective Panel (2026-09-06) — nguồn sự thật DUY NHẤT
  // cho kích thước lưới; combat-grid-view.ts's redrawGridLines() đọc trực
  // tiếp 2 field này thay vì import hằng số cứng, nên panel Trận Pháp
  // (6x6) và combat thật (10x16) dùng chung được 1 hàm vẽ lưới.
  readonly rows: number
  readonly columns: number

  gridToScreen(row: number, column: number): GridScreenPoint

  screenToGrid(x: number, y: number): GridFloatPosition

  /**
   * Nghịch đảo KHÔNG clamp: y ngoài mặt đường (vùng phong cảnh phía trên
   * chân trời hoặc dưới cạnh gần) trả về null thay vì "kẹt" về hàng biên
   * — caller (hover) kiểm tra containment TRƯỚC khi quy đổi.
   */
  screenToGridUnclamped(x: number, y: number): GridFloatPosition | null

  /**
   * Điểm màn hình có nằm TRÊN MẶT ĐƯỜNG (road polygon, gồm cả viền) không.
   * Sky/bên ngoài lưới → false. Đây là phép kiểm tra duy nhất caller cần
   * trước khi round/clamp về cell.
   */
  containsScreenPoint(x: number, y: number): boolean

  /** Kích thước pixel 1 ô TẠM hàng đó (perspective co dần về xa). */
  cellSizeAt(row: number): CellPixelSize

  /**
   * Tứ giác AOE chiếu lên mặt đất từ footprint lưới trong action_impact —
   * CHỈ dùng để VẼ decal/telegraph. Damage vẫn do core quyết định bằng
   * isInCellArea(); tuyệt đối không suy ngược damage từ polygon này.
   */
  footprintPolygon(area: CellArea): FootprintPoint[]

  bounds(): ProjectionBounds

  resize(viewport: ProjectionViewport): void
}

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value
}

function makeViewport(viewport: ProjectionViewport): Required<ProjectionViewport> {
  return {
    width: Math.max(1, viewport.width),
    height: Math.max(1, viewport.height),
    topInset: Math.max(0, viewport.topInset),
    bottomInset: Math.max(0, viewport.bottomInset),
    rightInset: Math.max(0, viewport.rightInset ?? 0),
  }
}

/**
 * Dựng footprint 4 đỉnh từ CellArea (đÃ gồm shape ở event action_impact).
 * Góc = tâm ô biên ± nửa cell ⇒ gọi gridToScreen với rowFloat/columnFloat
 * lệch .5 (công thức tuyến tính nên chính xác cả 2 mode).
 * Thứ tự kim đồng hồ: trên-trái → trên-phải → dưới-phải → dưới-trái.
 */
function buildFootprint(
  area: CellArea,
  project: (row: number, column: number) => GridScreenPoint,
): FootprintPoint[] {
  const rowTop = area.rowStart - 0.5
  const rowBottom = area.rowEnd + 0.5
  const colLeft = area.colStart - 0.5
  const colRight = area.colEnd + 0.5

  return [
    project(rowTop, colLeft),
    project(rowTop, colRight),
    project(rowBottom, colRight),
    project(rowBottom, colLeft),
  ].map((point) => ({ x: point.x, y: point.y }))
}

// ================= flat — PARITY với renderer cũ =================

class FlatGridProjection implements BattleGridProjection {
  readonly mode = 'flat' as const

  // makeViewport() chuẩn hóa mọi trường (default 0 cho rightInset) nên
  // instance lưu sẵn là bản Required — khai báo Required<ProjectionViewport>
  // thay vì interface gốc (rightInset? optional) để caller nội bộ không phải
  // xử lý undefined (TS2532 khi trừ thẳng vào availableWidth).
  viewport: Required<ProjectionViewport>
  readonly rows: number
  readonly columns: number

  private cellSizePx = 0
  private gridLeft = 0
  private gridTop = 0

  constructor(viewport: ProjectionViewport, rows: number = GRID_ROW_COUNT, columns: number = GRID_COLUMN_COUNT) {
    this.viewport = makeViewport(viewport)
    this.rows = rows
    this.columns = columns
    this.recalculate()
  }

  resize(viewport: ProjectionViewport): void {
    this.viewport = makeViewport(viewport)
    this.recalculate()
  }

  // Sao chép NGUYÊN VĂN công thức legacy của CombatScene cũ:
  //   cellSize = min((width - 24) / COLS, availHeight / ROWS)
  //   gridLeft = width/2 - gridPixelWidth/2
  //   gridTop  = battlefieldTop + (availHeight - gridPixelHeight)/2
  private recalculate(): void {
    // rightInset trừ thẳng vào bề rộng khả dụng — cùng cách xử lý insets
    // trên/dưới đã có, không đụng công thức chiều cao (parity legacy).
    const availableWidth = Math.max(0, this.viewport.width - this.viewport.rightInset)
    const availableHeight = Math.max(
      0,
      this.viewport.height - this.viewport.topInset - this.viewport.bottomInset,
    )

    // Clamp dưới 1px: availableWidth - 24 có thể ÂM khi rightInset rộng
    // + viewport hẹp (dock chiếm gần hết bề ngang) — nếu không chặn, số
    // âm này thắng Math.min trước số dương của chiều cao, cellSizePx ra
    // âm và gridToScreen() đảo ngược trục x (cột tăng → x giảm) thay vì
    // co lưới lại một cách hợp lý. Đồng bộ pattern Math.max(1, ...) đã
    // dùng ở nhánh perspective (xem nearWidth bên dưới).
    this.cellSizePx = Math.max(
      1,
      Math.min((availableWidth - 24) / this.columns, availableHeight / this.rows),
    )
    this.gridLeft = availableWidth / 2 - (this.cellSizePx * this.columns) / 2
    this.gridTop = this.viewport.topInset + (availableHeight - this.cellSizePx * this.rows) / 2
  }

  gridToScreen(row: number, column: number): GridScreenPoint {
    return {
      x: this.gridLeft + (column + 0.5) * this.cellSizePx,
      y: this.gridTop + (row + 0.5) * this.cellSizePx,
      scale: 1,
    }
  }

  screenToGrid(x: number, y: number): GridFloatPosition {
    return {
      row: (y - this.gridTop) / this.cellSizePx - 0.5,
      column: (x - this.gridLeft) / this.cellSizePx - 0.5,
    }
  }

  screenToGridUnclamped(x: number, y: number): GridFloatPosition | null {
    const bottom = this.gridTop + this.cellSizePx * this.rows

    if (y < this.gridTop || y > bottom) {
      return null
    }

    return this.screenToGrid(x, y)
  }

  containsScreenPoint(x: number, y: number): boolean {
    const hit = this.screenToGridUnclamped(x, y)

    if (!hit) {
      return false
    }

    return hit.column >= -0.5 && hit.column <= this.columns - 0.5
  }

  cellSizeAt(_row: number): CellPixelSize {
    return { width: this.cellSizePx, height: this.cellSizePx }
  }

  footprintPolygon(area: CellArea): FootprintPoint[] {
    return buildFootprint(area, (row, column) => this.gridToScreen(row, column))
  }

  bounds(): ProjectionBounds {
    return {
      left: this.gridLeft,
      top: this.gridTop,
      right: this.gridLeft + this.cellSizePx * this.columns,
      bottom: this.gridTop + this.cellSizePx * this.rows,
      // rightInset-aware: tâm của chính khoảng [left, right] đã bị co/dịch
      // ở trên — KHÔNG dùng viewport.width/2 (bỏ qua rightInset), khớp
      // pattern derive-từ-centerX đã đúng ở PerspectiveGridProjection.
      centerX: this.gridLeft + (this.cellSizePx * this.columns) / 2,
    }
  }
}

// ================= perspective — 2.5D =================

class PerspectiveGridProjection implements BattleGridProjection {
  readonly mode = 'perspective' as const

  // Cùng lý do với FlatGridProjection ở trên — bản lưu sẵn luôn Required.
  viewport: Required<ProjectionViewport>
  readonly rows: number
  readonly columns: number

  private q = 1 + PERSPECTIVE_STRENGTH
  private bandTop = 0
  private bandHeight = 1
  private nearWidth = 1
  private centerX = 0
  private minRoadHeight: number

  constructor(
    viewport: ProjectionViewport,
    rows: number = GRID_ROW_COUNT,
    columns: number = GRID_COLUMN_COUNT,
    minRoadHeight: number = PERSPECTIVE_MIN_ROAD_HEIGHT,
  ) {
    this.viewport = makeViewport(viewport)
    this.rows = rows
    this.columns = columns
    this.minRoadHeight = minRoadHeight
    this.recalculate()
  }

  resize(viewport: ProjectionViewport): void {
    this.viewport = makeViewport(viewport)
    this.recalculate()
  }

  private recalculate(): void {
    this.q = 1 + PERSPECTIVE_STRENGTH

    // Nửa trên băng trống = phong cảnh (trời/núi, vẽ bởi backdrop tới
    // chân trời = bandTop); nửa dưới = mặt đường combat — với clamp thích
    // ứng giữ mặt đường tối thiểu trên màn thấp/portrait.
    const geometry = computePerspectiveGeometry(this.viewport, this.minRoadHeight)

    this.bandTop = geometry.horizonY
    this.bandHeight = Math.max(1, geometry.roadHeight)

    // rightInset trừ vào bề rộng khả dụng TRƯỚC khi trừ margin hai bên —
    // cùng pattern availableWidth với flat; geometry chiều cao ở trên
    // không đụng tới (computePerspectiveGeometry chỉ nhận topInset/
    // bottomInset).
    const availableWidth = Math.max(0, this.viewport.width - this.viewport.rightInset)

    this.nearWidth = Math.max(1, availableWidth - PERSPECTIVE_SIDE_MARGIN * 2)
    this.centerX = availableWidth / 2
  }

  private denominatorAt(v: number): number {
    return this.q + (1 - this.q) * v
  }

  gridToScreen(row: number, column: number): GridScreenPoint {
    const v = clamp01((row + 0.5) / this.rows)
    const denominator = this.denominatorAt(v)
    const scale = 1 / (denominator * denominator)

    return {
      x: this.centerX + ((column + 0.5) / this.columns - 0.5) * this.nearWidth * scale,
      y: this.bandTop + this.bandHeight * (v / denominator),
      scale,
    }
  }

  screenToGrid(x: number, y: number): GridFloatPosition {
    const f = clamp01((y - this.bandTop) / this.bandHeight)
    // Nghịch đảo closed-form của f(v) = v/(q + (1-q)v):
    //   v = f*q / (1 - f*(1-q))   (mẫu số ≥ 1 nên không chia nhỏ vô hạn)
    const inverseDenominator = 1 - f * (1 - this.q)
    const v = (f * this.q) / inverseDenominator
    const denominator = this.denominatorAt(v)
    const scale = 1 / (denominator * denominator)

    return {
      row: v * this.rows - 0.5,
      column: ((x - this.centerX) / (this.nearWidth * scale) + 0.5) * this.columns - 0.5,
    }
  }

  screenToGridUnclamped(x: number, y: number): GridFloatPosition | null {
    if (y < this.bandTop || y > this.bandTop + this.bandHeight) {
      return null
    }

    return this.screenToGrid(x, y)
  }

  containsScreenPoint(x: number, y: number): boolean {
    const hit = this.screenToGridUnclamped(x, y)

    if (!hit) {
      return false
    }

    return hit.column >= -0.5 && hit.column <= this.columns - 0.5
  }

  cellSizeAt(row: number): CellPixelSize {
    const v = clamp01((row + 0.5) / this.rows)
    const scale = 1 / this.denominatorAt(v) ** 2

    return {
      width: (this.nearWidth / this.columns) * scale,
      // Chiều cao ô ∝ f'(v) = q/denom² — cùng hệ số scale với chiều ngang.
      height: (this.bandHeight / this.rows) * this.q * scale,
    }
  }

  footprintPolygon(area: CellArea): FootprintPoint[] {
    return buildFootprint(area, (row, column) => this.gridToScreen(row, column))
  }

  bounds(): ProjectionBounds {
    const farScale = 1 / (this.q * this.q)
    const farHalfWidth = (this.nearWidth / 2) * farScale
    const bottom = this.bandTop + this.bandHeight

    return {
      left: this.centerX - farHalfWidth,
      top: this.bandTop,
      right: this.centerX + farHalfWidth,
      bottom,
      centerX: this.centerX,
    }
  }
}

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
