// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import {
  PREVIEW_CELL_SIZE,
  previewCellTopLeft,
  PANEL_WIDTH,
  PANEL_HEIGHT,
  PERSPECTIVE_MIN_ROAD_HEIGHT_PANEL,
} from './TranPhapCombatPreviewScene'

describe('previewCellTopLeft', () => {
  it('maps local (0,0) to the pixel origin', () => {
    expect(previewCellTopLeft(0, 0)).toEqual({ x: 0, y: 0 })
  })

  it('maps local (5,5) to the bottom-right cell, offset by 5 full cells', () => {
    expect(previewCellTopLeft(5, 5)).toEqual({ x: 5 * PREVIEW_CELL_SIZE, y: 5 * PREVIEW_CELL_SIZE })
  })

  it('row drives y, column drives x (not swapped)', () => {
    expect(previewCellTopLeft(1, 0)).toEqual({ x: 0, y: PREVIEW_CELL_SIZE })
    expect(previewCellTopLeft(0, 1)).toEqual({ x: PREVIEW_CELL_SIZE, y: 0 })
  })
})


describe('TranPhapCombatPreviewScene — perspective geometry constant (Battlefield Perspective Panel, 2026-09-06)', () => {
  it('PANEL_WIDTH/PANEL_HEIGHT khớp CHÍNH XÁC với canvas Phaser thật trong TranPhapPanel.vue (420x480)', () => {
    expect(PANEL_WIDTH).toBe(420)
    expect(PANEL_HEIGHT).toBe(480)
  })

  it('PERSPECTIVE_MIN_ROAD_HEIGHT_PANEL nhỏ hơn hằng số combat thật (320) — panel cần sàn thấp hơn cho canvas nhỏ', () => {
    expect(PERSPECTIVE_MIN_ROAD_HEIGHT_PANEL).toBeLessThan(320)
  })
})
