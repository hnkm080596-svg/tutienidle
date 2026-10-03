// Projection layer 2.5D (2026-08-24) - lop TOAN HOC THUAN bien doi giua
// toa do gameplay luoi (row/column, xem BattleGrid.ts) va pixel man hinh.
//
// Nguyen tac:
// - KHONG import Phaser, KHONG cam GameObject - module nay chi tinh so,
//   unit test duoc khong can canvas.
// - KHONG thay doi toa do gameplay: input/output deu la row (lane roi
//   rac) + column lien tuc theo DON VI COT y het 'positions'/'action_impact'
//   dang emit. Moi damage/range/AOE van nam o core qua BattleGrid.
// - 2 hien thuc cung 1 interface:
//     + 'flat'        : luoi o VUONG dong deu + letterbox - sao chep CHINH
//                       XAC cong thuc cu cua CombatScene.applyBattlefieldLayout()
//                       (cellSize = min((w-24)/COLS, availH/ROWS)...) de renderer
//                       cu con chay nguyen ven sau feature flag.
//     + 'perspective' : mat dat nghieng co phoi canh - hang xa (row 0) nho
//                       va day dac hon, hang gan (row R-1) to va thua hon;
//                       scale tra ve kem moi diem de entity/VFX tu scale
//                       theo chieu sau.
// - Anchor quy uoc: gridToScreen() tra ve DIEM CHAN DAT (foot point) tai
//   TAM o - sprite neo origin (0.5, 1) vao dung diem do o che do
//   perspective; health bar/cast bar/label tu suy tu foot point.
//
// Toan phoi canh (dong form, invert chinh xac de round-trip khong troi):
//   v = (row + 0.5) / ROWS              in [0,1]  (0 = xa, 1 = gan)
//   u = (column + 0.5) / COLUMNS        in [0,1]
//   denom(v) = q + (1 - q) * v          (q > 1)
//   f(v)     = v / denom(v)             -> y = top + H * f(v)
//   scale(v) = 1 / denom(v)^2           (scale(gan) = 1, scale(xa) = 1/q2)
//   x = cx + (u - 0.5) * nearWidth * scale(v)
// Khoang cach doc giua 2 hang lien nhau ~ f'(v) = q/denom2 - cung ti le
// voi scale ngang => cell bi ep ve hinh chu nhat MOT TI LE NHAT tren moi
// hang (nen deu nhu anh chup that, khong meo lech truc).
import { GRID_COLUMN_COUNT, GRID_ROW_COUNT, type CellArea } from '@/core/battle/BattleGrid'
import type { BattlefieldRenderMode } from './BattlefieldRenderMode'

/** Cuong do phoi canh: q = 1 + strength; ti le rong gan/xa = q2. */
export const PERSPECTIVE_STRENGTH = 0.42

/**
 * Bo cuc "nua tren phong canh, nua duoi con duong": trong bang trong
 * giua 2 HUD, phan TREN (troi/nui chan troi) chiem ratio nay, phan DUOI
 * la mat duong combat. Chi ap dung cho perspective - flat giu nguyen
 * bang full legacy.
 */
export const PERSPECTIVE_SCENERY_RATIO = 0.5

/** Le hai ben khi tinh be rong canh GAN cua luoi (dong bo gutter 24px cu). */
export const PERSPECTIVE_SIDE_MARGIN = 12

/**
 * Chieu cao TOI THIEU cua mat duong (px) - scenery ratio 50% chi ap dung
 * khi bang trong du cao; man thap/portrait uu tien road truoc de nhan vat
 * khong bi dinh chum. Khoang 300-340px la nguong doc duoc cua character
 * scale hien hanh.
 */
export const PERSPECTIVE_MIN_ROAD_HEIGHT = 320

export interface PerspectiveGeometry {
  /** Chan troi = day vung phong canh = dinh mat duong. */
  horizonY: number
  roadBottomY: number
  sceneryHeight: number
  roadHeight: number
}

/** Snapshot hinh hoc layout phuc vu e2e/visual gate (khong dung gameplay). */
export interface BattlefieldGeometrySnapshot extends PerspectiveGeometry {
  viewportWidth: number
  viewportHeight: number
  topInset: number
  bottomInset: number
}

/**
 * Quyet dinh bo cuc "nua tren phong canh, nua duoi con duong" voi clamp
 * thich ung: desired = 50% bang trong, nhung road luon giu toi thieu
 * PERSPECTIVE_MIN_ROAD_HEIGHT. Ham thuan - test duoc khong can canvas.
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
  /** Khoang reserved phia tren cho DOM chrome (Top+Status bar). */
  topInset: number
  /** Khoang reserved phia duoi cho DOM chrome (Event+Control bar). */
  bottomInset: number
  /**
   * Khoang reserved phia PHAI cho skill dock panel moi (Combat Art
   * Pipeline spec sec7.5) - mac dinh 0 khi bo qua de moi call site cu
   * (chua biet dock) khong phai sua gi.
   */
  rightInset?: number
}

export interface GridScreenPoint {
  x: number
  /** Diem CHAN DAT tai tam o - foot anchor cua sprite. */
  y: number
  /** He so scale theo chieu sau (hang gan = 1, cang xa cang nho). */
  scale: number
}

/** Row/column LIEN TUC (float) - caller tu lam tron/clamp qua BattleGrid. */
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
  // Battlefield Perspective Panel (2026-09-06) - nguon su that DUY NHAT
  // cho kich thuoc luoi; combat-grid-view.ts's redrawGridLines() doc truc
  // tiep 2 field nay thay vi import hang so cung, nen panel Tran Phap
  // (6x6) va combat that (10x16) dung chung duoc 1 ham ve luoi.
  readonly rows: number
  readonly columns: number

  gridToScreen(row: number, column: number): GridScreenPoint

  screenToGrid(x: number, y: number): GridFloatPosition

  /**
   * Nghich dao KHONG clamp: y ngoai mat duong (vung phong canh phia tren
   * chan troi hoac duoi canh gan) tra ve null thay vi "ket" ve hang bien
   * - caller (hover) kiem tra containment TRUOC khi quy doi.
   */
  screenToGridUnclamped(x: number, y: number): GridFloatPosition | null

  /**
   * Diem man hinh co nam TREN MAT DUONG (road polygon, gom ca vien) khong.
   * Sky/ben ngoai luoi -> false. Day la phep kiem tra duy nhat caller can
   * truoc khi round/clamp ve cell.
   */
  containsScreenPoint(x: number, y: number): boolean

  /** Kich thuoc pixel 1 o TAM hang do (perspective co dan ve xa). */
  cellSizeAt(row: number): CellPixelSize

  /**
   * Tu giac AOE chieu len mat dat tu footprint luoi trong action_impact -
   * CHI dung de VE decal/telegraph. Damage van do core quyet dinh bang
   * isInCellArea(); tuyet doi khong suy nguoc damage tu polygon nay.
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
 * Dung footprint 4 dinh tu CellArea (dA gom shape o event action_impact).
 * Goc = tam o bien +/- nua cell => goi gridToScreen voi rowFloat/columnFloat
 * lech .5 (cong thuc tuyen tinh nen chinh xac ca 2 mode).
 * Thu tu kim dong ho: tren-trai -> tren-phai -> duoi-phai -> duoi-trai.
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

// ================= flat - PARITY voi renderer cu =================

class FlatGridProjection implements BattleGridProjection {
  readonly mode = 'flat' as const

  // makeViewport() chuan hoa moi truong (default 0 cho rightInset) nen
  // instance luu san la ban Required - khai bao Required<ProjectionViewport>
  // thay vi interface goc (rightInset? optional) de caller noi bo khong phai
  // xu ly undefined (TS2532 khi tru thang vao availableWidth).
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

  // Sao chep NGUYEN VAN cong thuc legacy cua CombatScene cu:
  //   cellSize = min((width - 24) / COLS, availHeight / ROWS)
  //   gridLeft = width/2 - gridPixelWidth/2
  //   gridTop  = battlefieldTop + (availHeight - gridPixelHeight)/2
  private recalculate(): void {
    // rightInset tru thang vao be rong kha dung - cung cach xu ly insets
    // tren/duoi da co, khong dung cong thuc chieu cao (parity legacy).
    const availableWidth = Math.max(0, this.viewport.width - this.viewport.rightInset)
    const availableHeight = Math.max(
      0,
      this.viewport.height - this.viewport.topInset - this.viewport.bottomInset,
    )

    // Clamp duoi 1px: availableWidth - 24 co the AM khi rightInset rong
    // + viewport hep (dock chiem gan het be ngang) - neu khong chan, so
    // am nay thang Math.min truoc so duong cua chieu cao, cellSizePx ra
    // am va gridToScreen() dao nguoc truc x (cot tang -> x giam) thay vi
    // co luoi lai mot cach hop ly. Dong bo pattern Math.max(1, ...) da
    // dung o nhanh perspective (xem nearWidth ben duoi).
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
      // rightInset-aware: tam cua chinh khoang [left, right] da bi co/dich
      // o tren - KHONG dung viewport.width/2 (bo qua rightInset), khop
      // pattern derive-tu-centerX da dung o PerspectiveGridProjection.
      centerX: this.gridLeft + (this.cellSizePx * this.columns) / 2,
    }
  }
}

// ================= perspective - 2.5D =================

class PerspectiveGridProjection implements BattleGridProjection {
  readonly mode = 'perspective' as const

  // Cung ly do voi FlatGridProjection o tren - ban luu san luon Required.
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

    // Nua tren bang trong = phong canh (troi/nui, ve boi backdrop toi
    // chan troi = bandTop); nua duoi = mat duong combat - voi clamp thich
    // ung giu mat duong toi thieu tren man thap/portrait.
    const geometry = computePerspectiveGeometry(this.viewport, this.minRoadHeight)

    this.bandTop = geometry.horizonY
    this.bandHeight = Math.max(1, geometry.roadHeight)

    // rightInset tru vao be rong kha dung TRUOC khi tru margin hai ben -
    // cung pattern availableWidth voi flat; geometry chieu cao o tren
    // khong dung toi (computePerspectiveGeometry chi nhan topInset/
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
    // Nghich dao closed-form cua f(v) = v/(q + (1-q)v):
    //   v = f*q / (1 - f*(1-q))   (mau so >= 1 nen khong chia nho vo han)
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
      // Chieu cao o ~ f'(v) = q/denom2 - cung he so scale voi chieu ngang.
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
