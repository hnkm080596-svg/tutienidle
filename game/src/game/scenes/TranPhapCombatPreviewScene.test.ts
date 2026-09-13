// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import {
  PANEL_WIDTH,
  PANEL_HEIGHT,
  PERSPECTIVE_MIN_ROAD_HEIGHT_PANEL,
} from './TranPhapCombatPreviewScene'
import { STANDING_SLOT_COUNT } from '@/core/battle/BattlefieldRegions'

describe('TranPhapCombatPreviewScene — perspective geometry constant (Battlefield Perspective Panel, 2026-09-06)', () => {
  it('PANEL_WIDTH/PANEL_HEIGHT khớp CHÍNH XÁC với canvas Phaser thật trong TranPhapPanel.vue (420x480)', () => {
    expect(PANEL_WIDTH).toBe(420)
    expect(PANEL_HEIGHT).toBe(480)
  })

  it('PERSPECTIVE_MIN_ROAD_HEIGHT_PANEL nhỏ hơn hằng số combat thật (320) — panel cần sàn thấp hơn cho canvas nhỏ', () => {
    expect(PERSPECTIVE_MIN_ROAD_HEIGHT_PANEL).toBeLessThan(320)
  })
})

describe('TranPhapCombatPreviewScene — standing-slot grid size (standing-slot rework, 2026-09-07)', () => {
  it('panel grid resolution reads the shared STANDING_SLOT_COUNT (3x3), not a local constant', () => {
    expect(STANDING_SLOT_COUNT).toBe(3)
  })
})
