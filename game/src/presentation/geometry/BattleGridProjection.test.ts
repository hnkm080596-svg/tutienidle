// Projection layer 2.5D - test THUAN TOAN khong can Phaser/canvas:
// - round-trip gridToScreen o screenToGrid phai la dong nhat tren toan
//   domain luOi (ke ca cot spawn offscreen 16 va bien +/-0.5).
// - resize phai giu tinh nghIch dao va bam dung insets viewport mOi.
// - 'flat' phai tai tao CHINH XAC cong thuc legacy cua CombatScene cu
//   (cellSize = min((w-24)/COLS, availH/ROWS)...) - day la bao chung
//   parity cho renderer cu sau feature flag.
import { describe, expect, it } from 'vitest'
import {
  GRID_COLUMN_COUNT,
  GRID_ROW_COUNT,
  getColumnFromWorldX,
  getLaneFromWorldY,
} from '@/core/battle/BattleGrid'
import {
  computePerspectiveGeometry,
  createBattleGridProjection,
  PERSPECTIVE_MIN_ROAD_HEIGHT,
  PERSPECTIVE_SCENERY_RATIO,
  PERSPECTIVE_SIDE_MARGIN,
  PERSPECTIVE_STRENGTH,
  type BattleGridProjection,
} from './BattleGridProjection'

const VIEWPORT = { width: 1280, height: 720, topInset: 80, bottomInset: 70 }

function sampleRows(): number[] {
  return [-0.5, 0, 2.25, 4, 6.5, 9, 9.5]
}

function sampleColumns(): number[] {
  return [-0.5, 0, 3.7, 8, 12.4, 15, 16]
}

describe('BattleGridProjection â€” perspective', () => {
  it('round-trip gridToScreen â†’ screenToGrid lÃ  Ä‘á»“ng nháº¥t (tolerance 1e-6)', () => {
    const projection = createBattleGridProjection('perspective', VIEWPORT)

    for (const row of sampleRows()) {
      for (const column of sampleColumns()) {
        const screen = projection.gridToScreen(row, column)
        const back = projection.screenToGrid(screen.x, screen.y)

        expect(back.row).toBeCloseTo(row, 6)
        expect(back.column).toBeCloseTo(column, 6)
      }
    }
  })

  it('foot anchor: Ä‘iá»ƒm tráº£ vá» lÃ  chÃ¢n Ä‘áº¥t tÃ¢m Ã´, scale giáº£m dáº§n vá» xa', () => {
    const projection = createBattleGridProjection('perspective', VIEWPORT)

    const nearCenter = projection.gridToScreen(GRID_ROW_COUNT - 1, 0)
    const farCenter = projection.gridToScreen(0, 0)
    const q = 1 + PERSPECTIVE_STRENGTH

    // HA ng gaosecn nao+/-m DAE-a"sI hA ng xa trAan mA n hA!nh.
    expect(nearCenter.y).toBeGreaterThan(farCenter.y)
    expect(farCenter.y).toBeGreaterThanOrEqual(VIEWPORT.topInset)
    expect(nearCenter.y).toBeLessThanOrEqual(VIEWPORT.height - VIEWPORT.bottomInset)

    // Scale theo cong thuc dong: 1/denom(v)2 vOi v = (row+0.5)/ROWS -
    // tam hang cuoi v=0.95, tam hang dau v=0.05; mep duOi band (v=1)
    // chuan hoa dung bang 1.
    expect(nearCenter.scale).toBeCloseTo(1 / (q + (1 - q) * 0.95) ** 2, 9)
    expect(farCenter.scale).toBeCloseTo(1 / (q + (1 - q) * 0.05) ** 2, 9)
    expect(nearCenter.scale).toBeGreaterThan(farCenter.scale)
    expect(projection.gridToScreen(GRID_ROW_COUNT - 0.5, 0).scale).toBeCloseTo(1, 9)
  })

  it('foreground rá»™ng hÆ¡n háº­u cáº£nh â€” bá» ngang lÆ°á»›i co láº¡i khi lÃ¹i sÃ¢u', () => {
    const projection = createBattleGridProjection('perspective', VIEWPORT)

    const nearWidth = Math.abs(
      projection.gridToScreen(GRID_ROW_COUNT - 1, GRID_COLUMN_COUNT - 1).x -
        projection.gridToScreen(GRID_ROW_COUNT - 1, 0).x,
    )
    const farWidth = Math.abs(
      projection.gridToScreen(0, GRID_COLUMN_COUNT - 1).x - projection.gridToScreen(0, 0).x,
    )

    expect(nearWidth).toBeGreaterThan(farWidth * 1.5)

    // Canh gan khit viewport tru margin hai ben.
    expect(nearWidth).toBeLessThanOrEqual(VIEWPORT.width - PERSPECTIVE_SIDE_MARGIN * 2 + 1e-6)
  })

  it('cellSizeAt co Ä‘á»u theo chiá»u sÃ¢u vÃ  giá»¯ tá»‰ lá»‡ cell', () => {
    const projection = createBattleGridProjection('perspective', VIEWPORT)

    const nearCell = projection.cellSizeAt(GRID_ROW_COUNT - 1)
    const farCell = projection.cellSizeAt(0)

    expect(nearCell.width).toBeGreaterThan(farCell.width)
    expect(nearCell.height).toBeGreaterThan(farCell.height)

    // Ti le h/w cua cell KHONG doi theo hang (nen phoi canh dong nhat).
    const nearRatio = nearCell.height / nearCell.width
    const farRatio = farCell.height / farCell.width

    expect(nearRatio).toBeCloseTo(farRatio, 6)
  })

  it('screenToGrid clamp y ngoÃ i band vá» biÃªn row thay vÃ¬ extrapolate', () => {
    const projection = createBattleGridProjection('perspective', VIEWPORT)

    expect(projection.screenToGrid(VIEWPORT.width / 2, -100).row).toBeCloseTo(-0.5, 9)
    expect(projection.screenToGrid(VIEWPORT.width / 2, VIEWPORT.height + 500).row).toBeCloseTo(
      GRID_ROW_COUNT - 0.5,
      9,
    )
  })

  it('bá»‘ cá»¥c "ná»­a trÃªn phong cáº£nh, ná»­a dÆ°á»›i con Ä‘Æ°á»ng" (clamp thÃ­ch á»©ng á»Ÿ mÃ n tháº¥p)', () => {
    // VIEWPORT 720p: bang trong 570px - desired scenery 285 nhung road chi
    // con 285 < min 320 => clamp ve scenery 250 / road 320.
    const projection = createBattleGridProjection('perspective', VIEWPORT)
    const bounds = projection.bounds()

    expect(bounds.top).toBe(VIEWPORT.topInset + 570 - PERSPECTIVE_MIN_ROAD_HEIGHT)
    expect(bounds.bottom).toBe(VIEWPORT.height - VIEWPORT.bottomInset)
    expect(bounds.bottom - bounds.top).toBe(PERSPECTIVE_MIN_ROAD_HEIGHT)

    // Man du cao: dung 50/50 thuan.
    const tallProjection = createBattleGridProjection('perspective', {
      width: 1600,
      height: 1000,
      topInset: 80,
      bottomInset: 70,
    })
    const tallBounds = tallProjection.bounds()
    const tallAvailable = 1000 - 80 - 70

    expect(tallBounds.top).toBeCloseTo(80 + tallAvailable * PERSPECTIVE_SCENERY_RATIO, 9)
    expect(tallBounds.bottom - tallBounds.top).toBeCloseTo(
      tallAvailable * (1 - PERSPECTIVE_SCENERY_RATIO),
      9,
    )

    // Mat duong luon nam TRONG bang trong, khong tran len HUD.
    expect(bounds.top).toBeGreaterThanOrEqual(VIEWPORT.topInset)
  })

  it('adaptive scenery: mÃ n tháº¥p giá»¯ road tá»‘i thiá»ƒu, mÃ n cao giá»¯ 50/50', () => {
    // Bang trong 470px - desired scenery 235 nhung road chi con 235 < min
    // 320 => clamp: scenery 150, road du 320.
    const shortViewport = { width: 1280, height: 640, topInset: 100, bottomInset: 70 }
    const shortGeometry = computePerspectiveGeometry(shortViewport)

    expect(shortGeometry.roadHeight).toBe(PERSPECTIVE_MIN_ROAD_HEIGHT)
    expect(shortGeometry.sceneryHeight).toBe(470 - PERSPECTIVE_MIN_ROAD_HEIGHT)

    // Bang trong du dIa (850px) - 50/50 chuan, chua cham clamp.
    const tallGeometry = computePerspectiveGeometry({
      width: 1600,
      height: 1000,
      topInset: 80,
      bottomInset: 70,
    })

    expect(tallGeometry.roadHeight).toBeCloseTo(850 * (1 - PERSPECTIVE_SCENERY_RATIO), 9)
    expect(tallGeometry.sceneryHeight).toBeCloseTo(850 * PERSPECTIVE_SCENERY_RATIO, 9)

    // Projection tieu thu geometry: road band khOp clamp.
    const shortProjection = createBattleGridProjection('perspective', shortViewport)
    const shortBounds = shortProjection.bounds()

    expect(shortBounds.bottom - shortBounds.top).toBe(PERSPECTIVE_MIN_ROAD_HEIGHT)
    expect(shortBounds.top).toBe(100 + 470 - PERSPECTIVE_MIN_ROAD_HEIGHT)
  })

  it('adaptive geometry: bÄƒng trá»‘ng nhá» hÆ¡n cáº£ min road â€” scenery vá» 0, khÃ´ng Ã¢m', () => {
    const tinyViewport = { width: 640, height: 400, topInset: 60, bottomInset: 50 }
    const geometry = computePerspectiveGeometry(tinyViewport)

    expect(geometry.sceneryHeight).toBe(0)
    expect(geometry.horizonY).toBe(tinyViewport.topInset)
    expect(geometry.roadHeight).toBe(400 - 60 - 50)
  })

  it('containsScreenPoint: trong road â†’ true; sky/bÃªn ngoÃ i lÆ°á»›i â†’ false', () => {
    const projection = createBattleGridProjection('perspective', VIEWPORT)
    const bounds = projection.bounds()
    const roadY = bounds.top + (bounds.bottom - bounds.top) * 0.75
    const skyY = VIEWPORT.topInset + (bounds.top - VIEWPORT.topInset) / 2

    // Giua san.
    expect(projection.containsScreenPoint(VIEWPORT.width / 2, roadY)).toBe(true)

    // Vung phong canh giua 2 HUD (khong duoc "ket" ve hang bien).
    expect(projection.containsScreenPoint(VIEWPORT.width / 2, skyY)).toBe(false)

    // Tren HUD / duOi san.
    expect(projection.containsScreenPoint(VIEWPORT.width / 2, VIEWPORT.topInset - 10)).toBe(false)
    expect(projection.containsScreenPoint(VIEWPORT.width / 2, VIEWPORT.height - 5)).toBe(false)

    // Ngoai canh gan tai hang cuoi (trapezoid thu hep ve xa).
    const nearHalfWidth = (VIEWPORT.width - PERSPECTIVE_SIDE_MARGIN * 2) / 2
    expect(
      projection.containsScreenPoint(VIEWPORT.width / 2 + nearHalfWidth + 8, bounds.bottom - 1),
    ).toBe(false)

    // Trong luOi o hang xa (canh hep) van true.
    const farHalfWidth = nearHalfWidth / (1 + PERSPECTIVE_STRENGTH) ** 2
    expect(
      projection.containsScreenPoint(VIEWPORT.width / 2 + farHalfWidth - 4, bounds.top + 1),
    ).toBe(true)
  })

  it('screenToGridUnclamped: null ngoÃ i máº·t Ä‘Æ°á»ng, round-trip trong sÃ¢n', () => {
    const projection = createBattleGridProjection('perspective', VIEWPORT)
    const bounds = projection.bounds()

    expect(projection.screenToGridUnclamped(VIEWPORT.width / 2, bounds.top - 20)).toBeNull()
    expect(projection.screenToGridUnclamped(VIEWPORT.width / 2, bounds.bottom + 20)).toBeNull()

    const inside = projection.screenToGridUnclamped(
      VIEWPORT.width / 2,
      bounds.top + (bounds.bottom - bounds.top) * 0.4,
    )

    expect(inside).not.toBeNull()
    expect(inside!.row).toBeGreaterThan(-0.5)
    expect(inside!.row).toBeLessThan(GRID_ROW_COUNT - 0.5)

    const screen = projection.gridToScreen(inside!.row, inside!.column)

    expect(screen.x).toBeCloseTo(VIEWPORT.width / 2, 6)
    expect(screen.y).toBeCloseTo(bounds.top + (bounds.bottom - bounds.top) * 0.4, 6)
  })

  it('resize: round-trip váº«n Ä‘Ãºng vÃ  khung bÃ¡m insets má»›i', () => {
    const projection: BattleGridProjection = createBattleGridProjection('perspective', VIEWPORT)
    const resized = { width: 1920, height: 1080, topInset: 120, bottomInset: 90 }

    projection.resize(resized)

    expect(projection.viewport).toEqual({
      ...resized,
      topInset: 120,
      bottomInset: 90,
      rightInset: 0,
    })

    for (const row of [0, 3.3, 5, 7.75, 9]) {
      for (const column of [0, 5.5, 11.2, 15]) {
        const screen = projection.gridToScreen(row, column)
        const back = projection.screenToGrid(screen.x, screen.y)

        expect(back.row).toBeCloseTo(row, 6)
        expect(back.column).toBeCloseTo(column, 6)
      }
    }

    const availableHeight = resized.height - resized.topInset - resized.bottomInset
    const bounds = projection.bounds()

    expect(bounds.top).toBeCloseTo(
      resized.topInset + availableHeight * PERSPECTIVE_SCENERY_RATIO,
      9,
    )
    expect(bounds.bottom).toBe(resized.height - resized.bottomInset)
    expect(bounds.right - bounds.left).toBeLessThanOrEqual(resized.width)
  })

  it.each([
    ['1 cell (radius 0)', { rowStart: 4, rowEnd: 4, colStart: 7, colEnd: 7 }],
    ['radius 1 (3Ã—3)', { rowStart: 3, rowEnd: 5, colStart: 6, colEnd: 8 }],
    ['radius 2 (5Ã—5)', { rowStart: 2, rowEnd: 6, colStart: 5, colEnd: 9 }],
  ])('footprintPolygon %s: 4 Ä‘á»‰nh hÃ¬nh thang khá»›p gÃ³c footprint', (_label, area) => {
    const projection = createBattleGridProjection('perspective', VIEWPORT)
    const polygon = projection.footprintPolygon(area)

    expect(polygon).toHaveLength(4)

    const topWidth = polygon[1]!.x - polygon[0]!.x
    const bottomWidth = polygon[2]!.x - polygon[3]!.x

    expect(topWidth).toBeGreaterThan(0)
    expect(bottomWidth).toBeGreaterThan(topWidth)

    const topLeft = projection.gridToScreen(area.rowStart - 0.5, area.colStart - 0.5)
    const bottomRight = projection.gridToScreen(area.rowEnd + 0.5, area.colEnd + 0.5)

    expect(polygon[0]!.x).toBeCloseTo(topLeft.x, 9)
    expect(polygon[0]!.y).toBeCloseTo(topLeft.y, 9)
    expect(polygon[2]!.x).toBeCloseTo(bottomRight.x, 9)
    expect(polygon[2]!.y).toBeCloseTo(bottomRight.y, 9)
  })
})

describe('rightInset â€” reserves screen space on the right without changing height math', () => {
  it('flat mode: grid narrows and shifts left when rightInset is set', () => {
    const noInset = createBattleGridProjection('flat', { width: 1600, height: 900, topInset: 0, bottomInset: 0, rightInset: 0 })
    const withInset = createBattleGridProjection('flat', { width: 1600, height: 900, topInset: 0, bottomInset: 0, rightInset: 400 })

    const boundsNoInset = noInset.bounds()
    const boundsWithInset = withInset.bounds()

    expect(boundsWithInset.right).toBeLessThanOrEqual(1600 - 400)
    expect(boundsWithInset.right).toBeLessThan(boundsNoInset.right)

    // bounds().centerX phai phan anh khoang [left, right] DA co/dIch -
    // KHONG duoc bao tam full-viewport (regression Important #1: centerX
    // truOc day tinh thang tu viewport.width, bo qua rightInset).
    expect(boundsWithInset.centerX).toBeCloseTo(
      (boundsWithInset.left + boundsWithInset.right) / 2,
      9,
    )
    expect(boundsWithInset.centerX).toBeLessThan(boundsNoInset.centerX)
  })

  it('perspective mode: centerX shifts left AND nearWidth narrows when rightInset is set', () => {
    const noInset = createBattleGridProjection('perspective', { width: 1600, height: 900, topInset: 0, bottomInset: 0, rightInset: 0 })
    const withInset = createBattleGridProjection('perspective', { width: 1600, height: 900, topInset: 0, bottomInset: 0, rightInset: 400 })

    const pointNoInset = noInset.gridToScreen(9, 8) // near row, mid column
    const pointWithInset = withInset.gridToScreen(9, 8)

    expect(pointWithInset.x).toBeLessThan(pointNoInset.x)

    // Important #3: diem giua lech KHONG chung minh nearWidth co lai - chi
    // can centerX dIch trai da du lam x giam o cot 8/16 (he so +0.03125).
    // Do SAI NGANG giua 2 cot bien (0 va 15) cung hang: neu chi centerX
    // dIch ma nearWidth KHONG co (regression gia dInh trong review), span
    // nay giu nguyen. Phai THU HEP that su khi rightInset co mat.
    const spanNoInset = Math.abs(
      noInset.gridToScreen(GRID_ROW_COUNT - 1, GRID_COLUMN_COUNT - 1).x -
        noInset.gridToScreen(GRID_ROW_COUNT - 1, 0).x,
    )
    const spanWithInset = Math.abs(
      withInset.gridToScreen(GRID_ROW_COUNT - 1, GRID_COLUMN_COUNT - 1).x -
        withInset.gridToScreen(GRID_ROW_COUNT - 1, 0).x,
    )

    expect(spanWithInset).toBeLessThan(spanNoInset)

    // KhOp chinh xac cong thuc ky vong: nearWidth = availableWidth - 2*margin,
    // span do o row GRID_ROW_COUNT-1 nen con nhan them scale(v=0.95) - chua
    // = 1 (chi = 1 dung tai mep duOi band v=1, xem test "foot anchor" phia
    // tren) - phai nhan dung he so scale mOi khOp gridToScreen that.
    const q = 1 + PERSPECTIVE_STRENGTH
    const v = (GRID_ROW_COUNT - 1 + 0.5) / GRID_ROW_COUNT
    const scaleAtNearRow = 1 / (q + (1 - q) * v) ** 2
    const expectedNearWidthWithInset = 1600 - 400 - PERSPECTIVE_SIDE_MARGIN * 2
    const expectedSpanWithInset =
      (expectedNearWidthWithInset * scaleAtNearRow * (GRID_COLUMN_COUNT - 1)) / GRID_COLUMN_COUNT

    expect(spanWithInset).toBeCloseTo(expectedSpanWithInset, 6)
  })

  it('defaults rightInset to 0 when omitted (backward compatible)', () => {
    const withDefault = createBattleGridProjection('flat', { width: 1600, height: 900, topInset: 0, bottomInset: 0 } as never)
    const explicitZero = createBattleGridProjection('flat', { width: 1600, height: 900, topInset: 0, bottomInset: 0, rightInset: 0 })

    expect(withDefault.bounds()).toEqual(explicitZero.bounds())
  })
})

describe('degenerate rightInset â€” width kháº£ dá»¥ng gáº§n/báº±ng 0 váº«n ra hÃ¬nh há»c há»£p lá»‡', () => {
  it('flat: rightInset gáº§n báº±ng viewport width váº«n cho cellSizePx dÆ°Æ¡ng, há»¯u háº¡n', () => {
    // availableWidth = 1600 - 1590 = 10 < 24 => (availableWidth - 24) AM
    // truOc khi co clamp Math.max(1, ...) (Important #2) - cellSizePx se
    // ra am va dao truc x thay vi co luOi hop ly.
    const projection = createBattleGridProjection('flat', {
      width: 1600,
      height: 900,
      topInset: 0,
      bottomInset: 0,
      rightInset: 1590,
    })
    const cell = projection.cellSizeAt(0)

    expect(cell.width).toBeGreaterThan(0)
    expect(Number.isFinite(cell.width)).toBe(true)
    expect(cell.height).toBeGreaterThan(0)
    expect(Number.isFinite(cell.height)).toBe(true)

    // Truc x KHONG duoc dao nguoc: cot tang => x phai tang (hoac giu
    // nguyen o size san 1px), khong bao gio giam.
    const left = projection.gridToScreen(0, 0)
    const right = projection.gridToScreen(0, GRID_COLUMN_COUNT - 1)

    expect(right.x).toBeGreaterThanOrEqual(left.x)

    const bounds = projection.bounds()

    expect(Number.isFinite(bounds.left)).toBe(true)
    expect(Number.isFinite(bounds.right)).toBe(true)
    expect(bounds.right).toBeGreaterThanOrEqual(bounds.left)
  })

  it('perspective: rightInset gáº§n báº±ng viewport width váº«n cho nearWidth dÆ°Æ¡ng, há»¯u háº¡n', () => {
    const projection = createBattleGridProjection('perspective', {
      width: 1600,
      height: 900,
      topInset: 0,
      bottomInset: 0,
      rightInset: 1590,
    })
    const cell = projection.cellSizeAt(GRID_ROW_COUNT - 1)

    expect(cell.width).toBeGreaterThan(0)
    expect(Number.isFinite(cell.width)).toBe(true)
    expect(cell.height).toBeGreaterThan(0)
    expect(Number.isFinite(cell.height)).toBe(true)

    const left = projection.gridToScreen(GRID_ROW_COUNT - 1, 0)
    const right = projection.gridToScreen(GRID_ROW_COUNT - 1, GRID_COLUMN_COUNT - 1)

    expect(right.x).toBeGreaterThanOrEqual(left.x)

    const bounds = projection.bounds()

    expect(Number.isFinite(bounds.left)).toBe(true)
    expect(Number.isFinite(bounds.right)).toBe(true)
    expect(bounds.right).toBeGreaterThanOrEqual(bounds.left)
  })

  it('flat: rightInset == viewport width (availableWidth = 0) khÃ´ng throw vÃ  váº«n dÆ°Æ¡ng', () => {
    const projection = createBattleGridProjection('flat', {
      width: 1600,
      height: 900,
      topInset: 0,
      bottomInset: 0,
      rightInset: 1600,
    })
    const cell = projection.cellSizeAt(0)

    expect(cell.width).toBeGreaterThan(0)
    expect(Number.isFinite(cell.width)).toBe(true)
  })
})

describe('BattleGridProjection â€” flat (parity renderer cÅ©)', () => {
  it('tÃ¡i táº¡o chÃ­nh xÃ¡c cÃ´ng thá»©c layout legacy', () => {
    const projection = createBattleGridProjection('flat', VIEWPORT)
    const availableHeight = VIEWPORT.height - VIEWPORT.topInset - VIEWPORT.bottomInset
    const expectedCellSize = Math.min(
      (VIEWPORT.width - 24) / GRID_COLUMN_COUNT,
      availableHeight / GRID_ROW_COUNT,
    )
    const expectedLeft = VIEWPORT.width / 2 - (expectedCellSize * GRID_COLUMN_COUNT) / 2
    const expectedTop =
      VIEWPORT.topInset + (availableHeight - expectedCellSize * GRID_ROW_COUNT) / 2

    const point = projection.gridToScreen(4, 7)

    // worldToScreenX(x) cu = gridLeft + (x + 0.5) * cellSize.
    expect(point.x).toBeCloseTo(expectedLeft + (7 + 0.5) * expectedCellSize, 9)
    // laneRowCenterY[row] cu = gridTop + cellSize * (row + 0.5).
    expect(point.y).toBeCloseTo(expectedTop + (4 + 0.5) * expectedCellSize, 9)
    expect(point.scale).toBe(1)

    const bounds = projection.bounds()

    expect(bounds.left).toBe(expectedLeft)
    expect(bounds.top).toBe(expectedTop)
  })

  it('round-trip exact vÃ  screenToGrid khá»›p luáº­t lÃ m trÃ²n core', () => {
    const projection = createBattleGridProjection('flat', VIEWPORT)

    for (const row of sampleRows()) {
      for (const column of sampleColumns()) {
        const screen = projection.gridToScreen(row, column)
        const back = projection.screenToGrid(screen.x, screen.y)

        expect(back.row).toBeCloseTo(row, 6)
        expect(back.column).toBeCloseTo(column, 6)
      }
    }

    // Tam o (r,c) quy nguoc phai roi dung lane r / column c khi di qua
    // CHINH helpers cua core (getLaneFromWorldY/getColumnFromWorldX) -
    // cung code path ma onPointerMove se dung.
    const center = projection.gridToScreen(3, 6)
    const hit = projection.screenToGrid(center.x, center.y)

    expect(getLaneFromWorldY(hit.row)).toBe(3)
    expect(getColumnFromWorldX(hit.column)).toBe(6)

    // Lech nua cell trong o van thuoc column do (occupancy semantics).
    const offCenter = projection.screenToGrid(
      center.x + 0.3 * projection.cellSizeAt(0).width,
      center.y,
    )

    expect(getColumnFromWorldX(offCenter.column)).toBe(6)
  })

  it('resize flat giá»¯ cÃ´ng thá»©c legacy vá»›i viewport má»›i', () => {
    const projection = createBattleGridProjection('flat', VIEWPORT)
    const resized = { width: 800, height: 600, topInset: 40, bottomInset: 40 }

    projection.resize(resized)

    const availableHeight = resized.height - resized.topInset - resized.bottomInset
    const expectedCellSize = Math.min(
      (resized.width - 24) / GRID_COLUMN_COUNT,
      availableHeight / GRID_ROW_COUNT,
    )

    expect(projection.cellSizeAt(0).width).toBeCloseTo(expectedCellSize, 9)
    expect(projection.cellSizeAt(0).height).toBeCloseTo(expectedCellSize, 9)
  })

  it('containsScreenPoint flat: trong lÆ°á»›i true, ngoÃ i letterbox false', () => {
    const projection = createBattleGridProjection('flat', VIEWPORT)
    const bounds = projection.bounds()
    const midY = bounds.top + (bounds.bottom - bounds.top) / 2

    expect(projection.containsScreenPoint(bounds.left + 10, midY)).toBe(true)
    expect(projection.containsScreenPoint(bounds.right - 10, midY)).toBe(true)
    expect(projection.containsScreenPoint(bounds.left - 10, midY)).toBe(false)
    expect(projection.containsScreenPoint(VIEWPORT.width / 2, bounds.top - 10)).toBe(false)
    expect(projection.containsScreenPoint(VIEWPORT.width / 2, bounds.bottom + 10)).toBe(false)
  })
})

describe('BattleGridProjection â€” configurable grid size (Battlefield Perspective Panel, 2026-09-06)', () => {
  it('createBattleGridProjection sem Ä‘á»‘i sá»‘ rows/columns â†’ máº·c Ä‘á»‹nh 10x16 nhÆ° combat tháº­t (parity)', () => {
    const projection = createBattleGridProjection('perspective', VIEWPORT)

    expect(projection.rows).toBe(GRID_ROW_COUNT)
    expect(projection.columns).toBe(GRID_COLUMN_COUNT)
  })

  it('createBattleGridProjection vá»›i rows=6, columns=6 â†’ gridToScreen dÃ¹ng ÄÃšNG lÆ°á»›i 6x6, khÃ´ng pháº£i 10x16', () => {
    const small = createBattleGridProjection('perspective', VIEWPORT, 6, 6)

    expect(small.rows).toBe(6)
    expect(small.columns).toBe(6)

    // Hang gan (row 5) phai co scale LON HON hang xa (row 0) - xac nhan
    // cong thuc doc this.rows (6) chu khong phai hang so 10 cung: neu doc
    // 10 thi v(5) = 0.55 thay vi 0.9167, scale phan bo hoan toan khac.
    // (Luu y: scale chi dat dung 1 tai mep duoi v=1 - tam o cuoi
    // v = 5.5/6 ~ 0.917 nen scale < 1, dung theo cong thuc blend combat.)
    const near = small.gridToScreen(5, 0)
    const far = small.gridToScreen(0, 0)

    expect(far.scale).toBeLessThan(near.scale)
    expect(near.scale).toBeCloseTo(1 / (1 + 0.42 * (1 - 5.5 / 6)) ** 2, 6)
  })

  it('flat mode vá»›i rows=6, columns=6 â†’ cellSizeAt() tÃ­nh theo lÆ°á»›i nhá», Ã´ to hÆ¡n lÆ°á»›i 10x16 vá»›i cÃ¹ng viewport', () => {
    const bigGrid = createBattleGridProjection('flat', VIEWPORT)
    const smallGrid = createBattleGridProjection('flat', VIEWPORT, 6, 6)

    expect(smallGrid.cellSizeAt(0).width).toBeGreaterThan(bigGrid.cellSizeAt(0).width)
  })

  it('computePerspectiveGeometry vá»›i minRoadHeight tÃ¹y chá»‰nh â†’ roadHeight tÃ´n trá»ng sÃ n má»›i thay vÃ¬ 320 máº·c Ä‘á»‹nh', () => {
    const shortViewport = { width: 420, height: 480, topInset: 0, bottomInset: 0 }

    const defaultFloor = computePerspectiveGeometry(shortViewport)
    const customFloor = computePerspectiveGeometry(shortViewport, 140)

    expect(customFloor.roadHeight).toBeGreaterThanOrEqual(140)
    // san mac dInh (320) tren viewport 480px cao buoc roadHeight sat muc
    // san 320 - chung minh tham so minRoadHeight THUC SU doi ket qua,
    // khong phai no-op.
    expect(defaultFloor.roadHeight).not.toBeCloseTo(customFloor.roadHeight, 0)
  })

  it('createBattleGridProjection vá»›i minRoadHeight tÃ¹y chá»‰nh truyá»n xuá»‘ng PerspectiveGridProjection (khÃ´ng pháº£i bá»‹ bá» qua)', () => {
    const shortViewport = { width: 420, height: 480, topInset: 0, bottomInset: 0 }
    const projection = createBattleGridProjection('perspective', shortViewport, 6, 6, 140)

    // bounds().top ~ horizonY - voi san THAP hon (140 < 320), scenery
    // duoc chiem nhieu hon truoc khi cham san -> horizonY CAO hon (so lon
    // hon = thap hon tren man hinh). Nguoc chieu voi san 320 buoc
    // horizonY sat dinh (scenery nen).
    const defaultFloorProjection = createBattleGridProjection('perspective', shortViewport, 6, 6)

    expect(projection.bounds().top).toBeGreaterThan(defaultFloorProjection.bounds().top)
  })
})
