// Projection layer 2.5D — test THUẦN TOÁN không cần Phaser/canvas:
// - round-trip gridToScreen ∘ screenToGrid phải là đồng nhất trên toàn
//   domain lưới (kể cả cột spawn offscreen 16 và biên ±0.5).
// - resize phải giữ tính nghịch đảo và bám đúng insets viewport mới.
// - 'flat' phải tái tạo CHÍNH XÁC công thức legacy của CombatScene cũ
//   (cellSize = min((w-24)/COLS, availH/ROWS)...) — đây là bảo chứng
//   parity cho renderer cũ sau feature flag.
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

describe('BattleGridProjection — perspective', () => {
  it('round-trip gridToScreen → screenToGrid là đồng nhất (tolerance 1e-6)', () => {
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

  it('foot anchor: điểm trả về là chân đất tâm ô, scale giảm dần về xa', () => {
    const projection = createBattleGridProjection('perspective', VIEWPORT)

    const nearCenter = projection.gridToScreen(GRID_ROW_COUNT - 1, 0)
    const farCenter = projection.gridToScreen(0, 0)
    const q = 1 + PERSPECTIVE_STRENGTH

    // Hàng gần nằm DƯỚI hàng xa trên màn hình.
    expect(nearCenter.y).toBeGreaterThan(farCenter.y)
    expect(farCenter.y).toBeGreaterThanOrEqual(VIEWPORT.topInset)
    expect(nearCenter.y).toBeLessThanOrEqual(VIEWPORT.height - VIEWPORT.bottomInset)

    // Scale theo công thức đóng: 1/denom(v)² với v = (row+0.5)/ROWS —
    // tâm hàng cuối v=0.95, tâm hàng đầu v=0.05; mép dưới band (v=1)
    // chuẩn hóa đúng bằng 1.
    expect(nearCenter.scale).toBeCloseTo(1 / (q + (1 - q) * 0.95) ** 2, 9)
    expect(farCenter.scale).toBeCloseTo(1 / (q + (1 - q) * 0.05) ** 2, 9)
    expect(nearCenter.scale).toBeGreaterThan(farCenter.scale)
    expect(projection.gridToScreen(GRID_ROW_COUNT - 0.5, 0).scale).toBeCloseTo(1, 9)
  })

  it('foreground rộng hơn hậu cảnh — bề ngang lưới co lại khi lùi sâu', () => {
    const projection = createBattleGridProjection('perspective', VIEWPORT)

    const nearWidth = Math.abs(
      projection.gridToScreen(GRID_ROW_COUNT - 1, GRID_COLUMN_COUNT - 1).x -
        projection.gridToScreen(GRID_ROW_COUNT - 1, 0).x,
    )
    const farWidth = Math.abs(
      projection.gridToScreen(0, GRID_COLUMN_COUNT - 1).x - projection.gridToScreen(0, 0).x,
    )

    expect(nearWidth).toBeGreaterThan(farWidth * 1.5)

    // Cạnh gần khít viewport trừ margin hai bên.
    expect(nearWidth).toBeLessThanOrEqual(VIEWPORT.width - PERSPECTIVE_SIDE_MARGIN * 2 + 1e-6)
  })

  it('cellSizeAt co đều theo chiều sâu và giữ tỉ lệ cell', () => {
    const projection = createBattleGridProjection('perspective', VIEWPORT)

    const nearCell = projection.cellSizeAt(GRID_ROW_COUNT - 1)
    const farCell = projection.cellSizeAt(0)

    expect(nearCell.width).toBeGreaterThan(farCell.width)
    expect(nearCell.height).toBeGreaterThan(farCell.height)

    // Tỉ lệ h/w của cell KHÔNG đổi theo hàng (nén phối cảnh đồng nhất).
    const nearRatio = nearCell.height / nearCell.width
    const farRatio = farCell.height / farCell.width

    expect(nearRatio).toBeCloseTo(farRatio, 6)
  })

  it('screenToGrid clamp y ngoài band về biên row thay vì extrapolate', () => {
    const projection = createBattleGridProjection('perspective', VIEWPORT)

    expect(projection.screenToGrid(VIEWPORT.width / 2, -100).row).toBeCloseTo(-0.5, 9)
    expect(projection.screenToGrid(VIEWPORT.width / 2, VIEWPORT.height + 500).row).toBeCloseTo(
      GRID_ROW_COUNT - 0.5,
      9,
    )
  })

  it('bố cục "nửa trên phong cảnh, nửa dưới con đường" (clamp thích ứng ở màn thấp)', () => {
    // VIEWPORT 720p: băng trống 570px — desired scenery 285 nhưng road chỉ
    // còn 285 < min 320 ⇒ clamp về scenery 250 / road 320.
    const projection = createBattleGridProjection('perspective', VIEWPORT)
    const bounds = projection.bounds()

    expect(bounds.top).toBe(VIEWPORT.topInset + 570 - PERSPECTIVE_MIN_ROAD_HEIGHT)
    expect(bounds.bottom).toBe(VIEWPORT.height - VIEWPORT.bottomInset)
    expect(bounds.bottom - bounds.top).toBe(PERSPECTIVE_MIN_ROAD_HEIGHT)

    // Màn đủ cao: đúng 50/50 thuần.
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

    // Mặt đường luôn nằm TRONG băng trống, không tràn lên HUD.
    expect(bounds.top).toBeGreaterThanOrEqual(VIEWPORT.topInset)
  })

  it('adaptive scenery: màn thấp giữ road tối thiểu, màn cao giữ 50/50', () => {
    // Băng trống 470px — desired scenery 235 nhưng road chỉ còn 235 < min
    // 320 ⇒ clamp: scenery 150, road đủ 320.
    const shortViewport = { width: 1280, height: 640, topInset: 100, bottomInset: 70 }
    const shortGeometry = computePerspectiveGeometry(shortViewport)

    expect(shortGeometry.roadHeight).toBe(PERSPECTIVE_MIN_ROAD_HEIGHT)
    expect(shortGeometry.sceneryHeight).toBe(470 - PERSPECTIVE_MIN_ROAD_HEIGHT)

    // Băng trống dư địa (850px) — 50/50 chuẩn, chưa chạm clamp.
    const tallGeometry = computePerspectiveGeometry({
      width: 1600,
      height: 1000,
      topInset: 80,
      bottomInset: 70,
    })

    expect(tallGeometry.roadHeight).toBeCloseTo(850 * (1 - PERSPECTIVE_SCENERY_RATIO), 9)
    expect(tallGeometry.sceneryHeight).toBeCloseTo(850 * PERSPECTIVE_SCENERY_RATIO, 9)

    // Projection tiêu thụ geometry: road band khớp clamp.
    const shortProjection = createBattleGridProjection('perspective', shortViewport)
    const shortBounds = shortProjection.bounds()

    expect(shortBounds.bottom - shortBounds.top).toBe(PERSPECTIVE_MIN_ROAD_HEIGHT)
    expect(shortBounds.top).toBe(100 + 470 - PERSPECTIVE_MIN_ROAD_HEIGHT)
  })

  it('adaptive geometry: băng trống nhỏ hơn cả min road — scenery về 0, không âm', () => {
    const tinyViewport = { width: 640, height: 400, topInset: 60, bottomInset: 50 }
    const geometry = computePerspectiveGeometry(tinyViewport)

    expect(geometry.sceneryHeight).toBe(0)
    expect(geometry.horizonY).toBe(tinyViewport.topInset)
    expect(geometry.roadHeight).toBe(400 - 60 - 50)
  })

  it('containsScreenPoint: trong road → true; sky/bên ngoài lưới → false', () => {
    const projection = createBattleGridProjection('perspective', VIEWPORT)
    const bounds = projection.bounds()
    const roadY = bounds.top + (bounds.bottom - bounds.top) * 0.75
    const skyY = VIEWPORT.topInset + (bounds.top - VIEWPORT.topInset) / 2

    // Giữa sân.
    expect(projection.containsScreenPoint(VIEWPORT.width / 2, roadY)).toBe(true)

    // Vùng phong cảnh giữa 2 HUD (không được "kẹt" về hàng biên).
    expect(projection.containsScreenPoint(VIEWPORT.width / 2, skyY)).toBe(false)

    // Trên HUD / dưới sân.
    expect(projection.containsScreenPoint(VIEWPORT.width / 2, VIEWPORT.topInset - 10)).toBe(false)
    expect(projection.containsScreenPoint(VIEWPORT.width / 2, VIEWPORT.height - 5)).toBe(false)

    // Ngoài cạnh gần tại hàng cuối (trapezoid thu hẹp về xa).
    const nearHalfWidth = (VIEWPORT.width - PERSPECTIVE_SIDE_MARGIN * 2) / 2
    expect(
      projection.containsScreenPoint(VIEWPORT.width / 2 + nearHalfWidth + 8, bounds.bottom - 1),
    ).toBe(false)

    // Trong lưới ở hàng xa (cạnh hẹp) vẫn true.
    const farHalfWidth = nearHalfWidth / (1 + PERSPECTIVE_STRENGTH) ** 2
    expect(
      projection.containsScreenPoint(VIEWPORT.width / 2 + farHalfWidth - 4, bounds.top + 1),
    ).toBe(true)
  })

  it('screenToGridUnclamped: null ngoài mặt đường, round-trip trong sân', () => {
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

  it('resize: round-trip vẫn đúng và khung bám insets mới', () => {
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
    ['radius 1 (3×3)', { rowStart: 3, rowEnd: 5, colStart: 6, colEnd: 8 }],
    ['radius 2 (5×5)', { rowStart: 2, rowEnd: 6, colStart: 5, colEnd: 9 }],
  ])('footprintPolygon %s: 4 đỉnh hình thang khớp góc footprint', (_label, area) => {
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

describe('rightInset — reserves screen space on the right without changing height math', () => {
  it('flat mode: grid narrows and shifts left when rightInset is set', () => {
    const noInset = createBattleGridProjection('flat', { width: 1600, height: 900, topInset: 0, bottomInset: 0, rightInset: 0 })
    const withInset = createBattleGridProjection('flat', { width: 1600, height: 900, topInset: 0, bottomInset: 0, rightInset: 400 })

    const boundsNoInset = noInset.bounds()
    const boundsWithInset = withInset.bounds()

    expect(boundsWithInset.right).toBeLessThanOrEqual(1600 - 400)
    expect(boundsWithInset.right).toBeLessThan(boundsNoInset.right)

    // bounds().centerX phải phản ánh khoảng [left, right] ĐÃ co/dịch —
    // KHÔNG được báo tâm full-viewport (regression Important #1: centerX
    // trước đây tính thẳng từ viewport.width, bỏ qua rightInset).
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

    // Important #3: điểm giữa lệch KHÔNG chứng minh nearWidth co lại — chỉ
    // cần centerX dịch trái đã đủ làm x giảm ở cột 8/16 (hệ số +0.03125).
    // Đo SẢI NGANG giữa 2 cột biên (0 và 15) cùng hàng: nếu chỉ centerX
    // dịch mà nearWidth KHÔNG co (regression giả định trong review), span
    // này giữ nguyên. Phải THU HẸP thật sự khi rightInset có mặt.
    const spanNoInset = Math.abs(
      noInset.gridToScreen(GRID_ROW_COUNT - 1, GRID_COLUMN_COUNT - 1).x -
        noInset.gridToScreen(GRID_ROW_COUNT - 1, 0).x,
    )
    const spanWithInset = Math.abs(
      withInset.gridToScreen(GRID_ROW_COUNT - 1, GRID_COLUMN_COUNT - 1).x -
        withInset.gridToScreen(GRID_ROW_COUNT - 1, 0).x,
    )

    expect(spanWithInset).toBeLessThan(spanNoInset)

    // Khớp chính xác công thức kỳ vọng: nearWidth = availableWidth - 2*margin,
    // span đo ở row GRID_ROW_COUNT-1 nên còn nhân thêm scale(v=0.95) — chưa
    // = 1 (chỉ = 1 đúng tại mép dưới band v=1, xem test "foot anchor" phía
    // trên) — phải nhân đúng hệ số scale mới khớp gridToScreen thật.
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

describe('degenerate rightInset — width khả dụng gần/bằng 0 vẫn ra hình học hợp lệ', () => {
  it('flat: rightInset gần bằng viewport width vẫn cho cellSizePx dương, hữu hạn', () => {
    // availableWidth = 1600 - 1590 = 10 < 24 ⇒ (availableWidth - 24) ÂM
    // trước khi có clamp Math.max(1, ...) (Important #2) — cellSizePx sẽ
    // ra âm và đảo trục x thay vì co lưới hợp lý.
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

    // Trục x KHÔNG được đảo ngược: cột tăng ⇒ x phải tăng (hoặc giữ
    // nguyên ở size sàn 1px), không bao giờ giảm.
    const left = projection.gridToScreen(0, 0)
    const right = projection.gridToScreen(0, GRID_COLUMN_COUNT - 1)

    expect(right.x).toBeGreaterThanOrEqual(left.x)

    const bounds = projection.bounds()

    expect(Number.isFinite(bounds.left)).toBe(true)
    expect(Number.isFinite(bounds.right)).toBe(true)
    expect(bounds.right).toBeGreaterThanOrEqual(bounds.left)
  })

  it('perspective: rightInset gần bằng viewport width vẫn cho nearWidth dương, hữu hạn', () => {
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

  it('flat: rightInset == viewport width (availableWidth = 0) không throw và vẫn dương', () => {
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

describe('BattleGridProjection — flat (parity renderer cũ)', () => {
  it('tái tạo chính xác công thức layout legacy', () => {
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

    // worldToScreenX(x) cũ = gridLeft + (x + 0.5) * cellSize.
    expect(point.x).toBeCloseTo(expectedLeft + (7 + 0.5) * expectedCellSize, 9)
    // laneRowCenterY[row] cũ = gridTop + cellSize * (row + 0.5).
    expect(point.y).toBeCloseTo(expectedTop + (4 + 0.5) * expectedCellSize, 9)
    expect(point.scale).toBe(1)

    const bounds = projection.bounds()

    expect(bounds.left).toBe(expectedLeft)
    expect(bounds.top).toBe(expectedTop)
  })

  it('round-trip exact và screenToGrid khớp luật làm tròn core', () => {
    const projection = createBattleGridProjection('flat', VIEWPORT)

    for (const row of sampleRows()) {
      for (const column of sampleColumns()) {
        const screen = projection.gridToScreen(row, column)
        const back = projection.screenToGrid(screen.x, screen.y)

        expect(back.row).toBeCloseTo(row, 6)
        expect(back.column).toBeCloseTo(column, 6)
      }
    }

    // Tâm ô (r,c) quy ngược phải rơi đúng lane r / column c khi đi qua
    // CHÍNH helpers của core (getLaneFromWorldY/getColumnFromWorldX) —
    // cùng code path mà onPointerMove sẽ dùng.
    const center = projection.gridToScreen(3, 6)
    const hit = projection.screenToGrid(center.x, center.y)

    expect(getLaneFromWorldY(hit.row)).toBe(3)
    expect(getColumnFromWorldX(hit.column)).toBe(6)

    // Lệch nửa cell trong ô vẫn thuộc column đó (occupancy semantics).
    const offCenter = projection.screenToGrid(
      center.x + 0.3 * projection.cellSizeAt(0).width,
      center.y,
    )

    expect(getColumnFromWorldX(offCenter.column)).toBe(6)
  })

  it('resize flat giữ công thức legacy với viewport mới', () => {
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

  it('containsScreenPoint flat: trong lưới true, ngoài letterbox false', () => {
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
