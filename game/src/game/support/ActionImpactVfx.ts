// VFX impact 2.5D (2026-08-24) — invariant "MỘT action_impact = MỘT VFX
// instance": mọi pulse/hit của cùng 1 lần dùng skill sống trong CÙNG một
// cặp Graphics (ground + upright) và MỘT timeline tween. Multi-hit chỉ
// đổi số pulse BÊN TRONG timeline, không bao giờ sinh thêm GameObject
// theo hitCount/target.
//
// Phân tầng không gian theo preset.space:
// - ground_projected → chỉ lớp GROUND (decal footprint + vòng phép).
// - upright          → chỉ lớp UPRIGHT (ring nở + core bay lên).
// - hybrid           → cả hai trong cùng 1 timeline.
// - default          → an toàn rơi về ground-only, không mất feedback.
//
// areaScale CHỈ dùng cho phần TRANG TRÍ (vòng phép, upright radius,
// glow) — footprint polygon luôn khớp 1:1 với affectedArea của gameplay,
// tuyệt đối không scale theo areaScale để tránh decal lệch vùng damage.
import Phaser from 'phaser'
import type { CellArea, GridPosition } from '@/core/battle/BattleGrid'
import type { CombatVfxPreset } from '@/data/vfx/CombatVfxPresets'
import { DEPTH_GROUND_VFX } from './BattleLayers'
import type { BattleGridProjection } from './BattleGridProjection'

export interface ActionImpactVfxParams {
  scene: Phaser.Scene
  projection: BattleGridProjection
  area: CellArea
  anchorCell: GridPosition
  preset: CombatVfxPreset
  /** Số pulse (multi-hit) — timeline nội bộ, không tạo instance mới. */
  pulses: number
  /**
   * Depth lớp upright do scene tính theo foot Y của anchor (cùng hệ với
   * entity) để entity hàng GẦN camera che được effect hàng xa.
   */
  uprightDepth: number
}

/**
 * Remediation Task 2 (2026-09-05) — completion handle: caller (CombatScene)
 * acknowledge engine từ handle này thay vì tự tính duration (bị trùng).
 * complete() idempotent — tween onComplete và caller gọi ai trước cũng chỉ
 * fire đúng 1 lần.
 */
export interface ActionImpactVfxHandle {
  complete: () => void
}

/** Graphics.fillPoints/strokePoints muốn Vector2[] — quy đổi tại biên. */
export function toVector2Points(points: Array<{ x: number; y: number }>): Phaser.Math.Vector2[] {
  return points.map((point) => new Phaser.Math.Vector2(point.x, point.y))
}

/** Bán kính impact thẳng đứng — điểm duy nhất areaScale tác động chiều rộng. */
export function computeUprightRadius(cellWidth: number, areaScale: number): number {
  return Math.max(16, cellWidth * 0.55 * Math.max(0.25, areaScale))
}

export function spawnActionImpactVfx(
  params: ActionImpactVfxParams,
  onComplete?: () => void,
): ActionImpactVfxHandle {
  const { scene, projection, area, anchorCell, preset, pulses, uprightDepth } = params

  const space = preset.space
  // ĐÚNG KHÔNG GIAN: upright KHÔNG bao giờ vẽ ground decal (slash/claw/
  // wind_blade không để vết trên đất), ground_projected KHÔNG có lớp
  // thẳng đứng, hybrid có cả hai. Space lạ ('attached'/'screen' rơi vào
  // làm impact) fallback về ground để không mất feedback.
  const wantsUpright = space === 'upright' || space === 'hybrid'
  const wantsGround = !wantsUpright || space === 'hybrid'

  const polygon = projection.footprintPolygon(area)
  const anchor = projection.gridToScreen(anchorCell.row, anchorCell.column)
  const cell = projection.cellSizeAt(anchorCell.row)
  const vectors = toVector2Points(polygon)

  const ground = wantsGround ? scene.add.graphics().setDepth(DEPTH_GROUND_VFX) : null
  const upright = wantsUpright ? scene.add.graphics().setDepth(uprightDepth) : null

  const pulseCount = Math.max(1, Math.min(6, pulses))
  const radius = computeUprightRadius(cell.width, preset.areaScale)
  const centerY = anchor.y - radius * 0.9

  const paint = (t: number) => {
    const scaled = Math.min(t, 1) * pulseCount
    const pulseIndex = Math.min(pulseCount - 1, Math.floor(scaled))
    const phase = Math.min(1, scaled - pulseIndex)
    // Envelope 0→1→0 trong MỖI pulse — multi-hit nhấp nháy đúng số hit.
    const envelope = Math.sin(Math.PI * phase)

    if (ground) {
      ground.clear()
      ground.fillStyle(preset.color, 0.15 * envelope)
      ground.fillPoints(vectors, true)
      ground.lineStyle(2, preset.color, 0.85 * envelope)
      ground.strokePoints(vectors, true, true)

      // Vòng phép trang trí — NƠI DUY NHẤT areaScale nở rộng, nằm tại tâm ô.
      ground.lineStyle(2, preset.color, 0.7 * envelope)
      ground.strokeEllipse(
        anchor.x,
        anchor.y,
        cell.width * 0.72 * preset.areaScale,
        cell.height * 0.72 * preset.areaScale,
      )
      ground.strokeEllipse(
        anchor.x,
        anchor.y,
        cell.width * 0.4 * preset.areaScale,
        cell.height * 0.4 * preset.areaScale,
      )
    }

    if (upright) {
      upright.clear()
      upright.lineStyle(3, preset.color, 0.95 * (1 - phase))
      upright.strokeCircle(anchor.x, centerY, radius * (0.55 + 0.75 * phase))
      upright.fillStyle(preset.color, 0.85 * (1 - phase))
      upright.fillCircle(anchor.x, centerY - 6 - phase * radius * 0.9, radius * 0.3)
    }
  }

  paint(0)

  const state = { t: 0 }

  // Remediation Task 2 — idempotent completion: tween onComplete và
  // handle.complete() gọi ai trước cũng fire callback đúng 1 lần.
  let completed = false

  const finish = () => {
    if (completed) {
      return
    }

    completed = true

    ground?.destroy()
    upright?.destroy()

    onComplete?.()
  }

  scene.tweens.add({
    targets: state,
    t: 1,
    duration: Math.max(1, preset.durationMs) * pulseCount,
    ease: 'Linear',
    onUpdate: () => paint(state.t),
    onComplete: finish,
  })

  return {
    complete: finish,
  }
}
