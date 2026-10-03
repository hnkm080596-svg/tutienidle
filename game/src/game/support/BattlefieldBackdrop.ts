// Background 2.5D (2026-08-24) - nen chien truong ve THU TUC (procedural)
// theo mat phang nghieng, tach khoi luoi gameplay:
// - foreground RONG hon hau canh: quad dat no rong ra hai ben ve phia gan.
// - duong dan + da moi truong HOI TU ve diem bien mat ngang chan troi.
// - KHONG bao gio ve san o luoi vao background - grid la lop dong rieng
//   (CombatScene ve lai moi lan layout/resize qua projection).
// - dom texture dat rai theo phan phoi phoi canh de 10 lane khong lo cam
//   giac ban co (mat do + kich thuoc dom tang dan ve gan).
//
// Deterministic: moi yeu to ngau nhien dung mulberry32 voi seed co dinh =>
// redraw sau resize cho cung hinh khoi - screenshot parity giua cac lan
// chup cung viewport.
import type Phaser from 'phaser'
import { GRID_COLUMN_COUNT, GRID_ROW_COUNT } from '@/core/battle/BattleGrid'
import { DEPTH_BACKGROUND } from './BattleLayers'
import {
  PERSPECTIVE_STRENGTH,
  PERSPECTIVE_SIDE_MARGIN,
  type BattleGridProjection,
} from '@/presentation/geometry/BattleGridProjection'

/** Dat mo rong ra ngoai luoi (he so tren nua be rong canh gan). */
const GROUND_EXTEND = 1.35

const SKY_TOP_COLOR = 0x0b0e17
const SKY_HORIZON_COLOR = 0x241a26
const RIDGE_FAR_COLOR = 0x151a29
const RIDGE_NEAR_COLOR = 0x1b2133
const GROUND_FAR_COLOR = 0x272f42
const GROUND_NEAR_COLOR = 0x141824
const PATH_COLOR = 0x465066
const SPECKLE_COLORS = [0x2c3448, 0x1b2130, 0x39415a] as const
const ROCK_COLOR = 0x11151f
const MOON_COLOR = 0xe8e2cf

function mulberry32(seed: number): () => number {
  let state = seed >>> 0

  return () => {
    state = (state + 0x6d2b79f5) >>> 0

    let t = state

    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
export interface BattlefieldBackdropHandle {
  /** width/height/horizonY optional - procedural backdrop bo qua (doc thang projection), art mount dung de neo layer vao horizonY that. */
  redraw(width?: number, height?: number, horizonY?: number): void

  destroy(): void
}

export function attachBattlefieldBackdrop(
  scene: Phaser.Scene,
  projection: BattleGridProjection,
): BattlefieldBackdropHandle {
  const graphics = scene.add.graphics().setDepth(DEPTH_BACKGROUND)

  function drawSky(bounds: { top: number; bottom: number }): void {
    const { width } = projection.viewport

    graphics.fillGradientStyle(
      SKY_TOP_COLOR,
      SKY_TOP_COLOR,
      SKY_HORIZON_COLOR,
      SKY_HORIZON_COLOR,
      1,
    )
    graphics.fillRect(0, 0, width, bounds.top + 2)

    // Sao - day ve phia troi cao, mo dan xuong chan troi.
    const random = mulberry32(0x51a75)

    for (let index = 0; index < 90; index++) {
      const x = random() * width
      const y = random() * random() * bounds.top * 0.92
      const size = 0.8 + random() * 1.6

      graphics.fillStyle(0xd8e2ff, 0.12 + random() * 0.45)
      graphics.fillCircle(x, y, size)
    }

    // Trang + quang sang.
    const moonX = width * 0.82
    const moonY = bounds.top * 0.26
    const moonRadius = Math.max(10, bounds.top * 0.09)

    graphics.fillStyle(MOON_COLOR, 0.08)
    graphics.fillCircle(moonX, moonY, moonRadius * 2.3)
    graphics.fillStyle(MOON_COLOR, 0.9)
    graphics.fillCircle(moonX, moonY, moonRadius)
  }

  function drawRidges(bounds: { top: number; bottom: number }): void {
    const { width } = projection.viewport

    const layers: Array<{ color: number; amplitudeRatio: number; seed: number; segments: number }> =
      [
        { color: RIDGE_FAR_COLOR, amplitudeRatio: 0.34, seed: 1013, segments: 16 },
        { color: RIDGE_NEAR_COLOR, amplitudeRatio: 0.2, seed: 4099, segments: 11 },
      ]

    for (const layer of layers) {
      const random = mulberry32(layer.seed)
      const baseY = bounds.top
      const amplitude = bounds.top * layer.amplitudeRatio
      const step = width / layer.segments

      graphics.fillStyle(layer.color, 1)
      graphics.beginPath()
      graphics.moveTo(0, baseY)

      for (let index = 0; index <= layer.segments; index++) {
        const peakHeight = amplitude * (0.35 + random() * 0.65)

        graphics.lineTo(index * step, baseY - peakHeight)
        graphics.lineTo((index + 0.55) * step, baseY - peakHeight * 0.22)
      }

      graphics.lineTo(width, baseY)
      graphics.lineTo(width, bounds.bottom)
      graphics.lineTo(0, bounds.bottom)
      graphics.closePath()
      graphics.fillPath()
    }
  }

  function drawGroundPlane(bounds: {
    top: number
    bottom: number
    left: number
    right: number
  }): void {
    const { width } = projection.viewport
    // Nua be rong quad dat tai canh GAN - no rong hon luoi mot chut de
    // luoi khong troi nhu hon dao; canh xa tu thu nho theo q2 nen moi
    // duong doc cua quad hoi tu dung huong diem bien mat.
    const nearHalfWidth = Math.min(
      width / 2 - PERSPECTIVE_SIDE_MARGIN / 2,
      ((bounds.right - bounds.left) / 2) * GROUND_EXTEND * (1 + PERSPECTIVE_STRENGTH) ** 2,
    )
    const farHalfWidth = nearHalfWidth / (1 + PERSPECTIVE_STRENGTH) ** 2
    const centerX = (bounds.left + bounds.right) / 2

    // Gradient theo truc doc polygon: DINH = far edge (mau sang mo suong
    // phoi canh), DAY = near edge (dam) - tham so fillGradientStyle theo
    // thu tu top->bottom nen FAR phai dung truoc.
    graphics.fillGradientStyle(
      GROUND_FAR_COLOR,
      GROUND_FAR_COLOR,
      GROUND_NEAR_COLOR,
      GROUND_NEAR_COLOR,
      1,
    )
    graphics.beginPath()
    graphics.moveTo(centerX - nearHalfWidth, bounds.bottom)
    graphics.lineTo(centerX - farHalfWidth, bounds.top)
    graphics.lineTo(centerX + farHalfWidth, bounds.top)
    graphics.lineTo(centerX + nearHalfWidth, bounds.bottom)
    graphics.closePath()
    graphics.fillPath()

    // Duong dan tren mat duong - endpoint lay THANG tu projection nen
    // hoi tu dung theo far edge cua luoi (canh xa con rong), KHONG tu noi
    // suy ve mot vanishing point rieng gay lech luat voi grid. Cac cot
    // chon lech pha de khong de len vach luoi; spread nam trong bien an
    // toan cua quad dat mo rong (|u - 0.5| <= 0.65).
    graphics.lineStyle(1, PATH_COLOR, 0.2)

    for (const column of [-2.7, 0.9, 4.2, 7.6, 10.8, 14.3, 17.9]) {
      const near = projection.gridToScreen(GRID_ROW_COUNT - 0.5, column)
      const far = projection.gridToScreen(-0.5, column)

      graphics.beginPath()
      graphics.moveTo(near.x, near.y)
      graphics.lineTo(far.x, far.y)
      graphics.strokePath()
    }
  }

  function drawGroundSpecklesAndRocks(bounds: { top: number }): void {
    const random = mulberry32(0xbeef01)

    // Dom texture dat - phan bo theo u/v roi di qua projection nen tu co
    // nho va day dac ve xa dung luat phoi canh.
    for (let index = 0; index < 240; index++) {
      const depthBias = random() ** 1.45
      const row = depthBias * (GRID_ROW_COUNT - 1) - 0.5
      const column = (random() - 0.5) * GRID_COLUMN_COUNT * GROUND_EXTEND - 0.5
      const point = projection.gridToScreen(row, column)

      if (point.y < bounds.top) {
        continue
      }

      const size = (1.2 + random() * 2.6) * (0.55 + point.scale)

      graphics.fillStyle(
        SPECKLE_COLORS[index % SPECKLE_COLORS.length] ?? 0x2c3448,
        0.12 + random() * 0.18,
      )
      graphics.fillEllipse(point.x, point.y, size, size * 0.38)
    }

    // Da moi truong hai bien - to o foreground, ti hon o hau canh.
    for (let index = 0; index < 9; index++) {
      const side = index % 2 === 0 ? -1 : 1
      const depthBias = 0.12 + random() * 0.88
      const row = depthBias * (GRID_ROW_COUNT - 1) - 0.5
      const column = side * (GRID_COLUMN_COUNT * (0.44 + random() * 0.07)) - 0.5
      const point = projection.gridToScreen(row, column)
      const scale = 0.6 + point.scale
      const rockWidth = (7 + random() * 13) * scale

      graphics.fillStyle(ROCK_COLOR, 0.9)
      graphics.beginPath()
      graphics.moveTo(point.x - rockWidth / 2, point.y)
      graphics.lineTo(point.x - rockWidth * 0.12, point.y - rockWidth * (0.55 + random() * 0.3))
      graphics.lineTo(point.x + rockWidth * 0.3, point.y - rockWidth * 0.2)
      graphics.lineTo(point.x + rockWidth / 2, point.y)
      graphics.closePath()
      graphics.fillPath()
    }
  }

  function redraw(): void {
    const bounds = projection.bounds()

    graphics.clear()
    drawSky(bounds)
    drawRidges(bounds)
    drawGroundPlane(bounds)
    drawGroundSpecklesAndRocks(bounds)
  }

  function destroy(): void {
    graphics.destroy()
  }

  redraw()

  return { redraw, destroy }
}
