// EnemySpawnVfx (2026-08-24) — hiệu ứng "telegraph → xuất hiện" cho luồng
// spawn quái trong sân, cùng tổ chức với ActionImpactVfx:
// - MỘT handle/logical instance cho MỘT pending spawn: 2 Graphics (ground
//   pháp trận + cột linh khí thẳng đứng) và KHÔNG self-tween — update()
//   được scene drive theo progress từ SNAPSHOT positions (an toàn khi
//   scene vừa khởi tạo/resize/auto-repeat, xem BattlePositionsEvent).
// - Toạ độ chiếu LẤY MỚI mỗi lần paint qua projection.gridToScreen() —
//   resize giữa animation tự vẽ đúng vị trí mới.
// - complete(): flash ngắn rồi tự dọn; destroy(): dọn NGAY (battle reset/
//   scene shutdown). Upright depth do scene tính (uprightVfxDepth) để
//   không xuyên sai qua entity.
import Phaser from 'phaser'
import type {
  EnemySpawnVfxPresetId,
  PlayerSpawnVfxPresetId,
} from '@/core/battle/CombatAction'
import { DEPTH_GROUND_VFX } from './BattleLayers'
import type { BattleGridProjection } from './BattleGridProjection'

/** Preset spawn telegraph — quái theo cấp bậc + preset riêng cho Player. */
export type SpawnVfxPresetId = EnemySpawnVfxPresetId | PlayerSpawnVfxPresetId

interface SpawnPresetStyle {
  color: number
  radiusScale: number
}

const SPAWN_PRESET_STYLES: Record<SpawnVfxPresetId, SpawnPresetStyle> = {
  enemy_spawn: { color: 0x9cecff, radiusScale: 0.85 },
  elite_spawn: { color: 0xc9a2ff, radiusScale: 1.0 },
  boss_spawn: { color: 0xffd54f, radiusScale: 1.3 },
  player_spawn: { color: 0x6fb2ff, radiusScale: 1.15 },
}

export interface EnemySpawnVfxHandle {
  /** progress ∈ [0,1] từ snapshot positions — repaint toàn bộ hiệu ứng. */
  update(progress: number): void

  /** Flash materialize ngắn rồi TỰ destroy (gọi khi id rời snapshot). */
  complete(): void

  /** Dọn NGAY không flash (battle reset / scene shutdown). */
  destroy(): void
}

export interface EnemySpawnVfxParams {
  scene: Phaser.Scene
  projection: BattleGridProjection
  row: number
  column: number
  presetId: SpawnVfxPresetId
  /** Depth cột linh khí — scene tính bằng uprightVfxDepth (occlusion). */
  uprightDepth: number
}

export function spawnEnemySpawnVfx(params: EnemySpawnVfxParams): EnemySpawnVfxHandle {
  const { scene, projection, row, column, presetId, uprightDepth } = params

  const style = SPAWN_PRESET_STYLES[presetId] ?? SPAWN_PRESET_STYLES.enemy_spawn

  const ground = scene.add.graphics().setDepth(DEPTH_GROUND_VFX)
  const upright = scene.add.graphics().setDepth(uprightDepth).setBlendMode(Phaser.BlendModes.ADD)

  let destroyed = false
  let completed = false

  const paint = (progress: number) => {
    if (destroyed) {
      return
    }

    // Chiếu MỚI mỗi paint — resize/viewport đổi vẫn đúng ô.
    const anchor = projection.gridToScreen(row, column)
    const cell = projection.cellSizeAt(row)
    const radius = cell.width * 0.55 * style.radiusScale
    const p = Math.min(1, Math.max(0, progress))

    ground.clear()

    // Vòng pháp trận sát mặt đất: ellipse DẸT theo cell + fill sáng dần.
    ground.lineStyle(2, style.color, 0.35 + 0.55 * p)
    ground.strokeEllipse(anchor.x, anchor.y, radius * 2, radius * 0.8)
    ground.lineStyle(1.5, style.color, 0.25 + 0.45 * p)
    ground.strokeEllipse(anchor.x, anchor.y, radius * 1.2, radius * 0.5)

    if (p > 0.05) {
      ground.fillStyle(style.color, 0.14 * p)
      ground.fillEllipse(anchor.x, anchor.y, radius * 1.9 * p, radius * 0.76 * p)
    }

    // Pulse lan tỏa — 3 vòng trong suốt telegraph (p*3 chu kỳ).
    const pulsePhase = (p * 3) % 1

    if (p > 0.02 && pulsePhase > 0.01) {
      ground.lineStyle(2, style.color, 0.8 * (1 - pulsePhase))
      ground.strokeEllipse(
        anchor.x,
        anchor.y,
        radius * 2 * (0.35 + 0.85 * pulsePhase),
        radius * 0.8 * (0.35 + 0.85 * pulsePhase),
      )
    }

    // Lõi sáng dần chuẩn bị materialize.
    if (p > 0.6) {
      const coreAlpha = (p - 0.6) / 0.4

      ground.fillStyle(style.color, 0.5 * coreAlpha)
      ground.fillEllipse(anchor.x, anchor.y, radius * 0.9 * coreAlpha, radius * 0.36 * coreAlpha)
    }

    // Cột linh khí thẳng đứng — chùm hạt sáng bay lên dần theo p.
    upright.clear()

    const moteCount = 5

    for (let index = 0; index < moteCount; index++) {
      const seed = index / moteCount
      const rise = (((p * 1.6 + seed) % 1) + 1) % 1
      const moteY = anchor.y - rise * cell.height * 2.2
      const moteAlpha = (1 - rise) * 0.55
      const moteSize = (3 + (1 - rise) * 4) * style.radiusScale

      upright.fillStyle(style.color, moteAlpha)
      upright.fillEllipse(
        anchor.x + Math.sin((seed + p) * Math.PI * 2) * radius * 0.3,
        moteY,
        moteSize,
        moteSize * 1.8,
      )
    }

    // Đỉnh cột đậm dần gần materialize.
    if (p > 0.3) {
      upright.fillStyle(style.color, 0.35 * ((p - 0.3) / 0.7))
      upright.fillEllipse(anchor.x, anchor.y - cell.height * 2.2, radius * 0.5, radius * 0.9)
    }
  }

  const paintFlash = (fade: number) => {
    if (destroyed) {
      return
    }

    const anchor = projection.gridToScreen(row, column)
    const cell = projection.cellSizeAt(row)
    const radius = cell.width * 0.55 * style.radiusScale

    ground.clear()
    ground.fillStyle(style.color, 0.5 * (1 - fade))
    ground.fillEllipse(anchor.x, anchor.y, radius * (2 + fade), radius * (0.8 + fade * 0.4))

    upright.clear()
    upright.fillStyle(0xffffff, 0.75 * (1 - fade))
    upright.fillCircle(anchor.x, anchor.y - cell.height * 0.8, radius * (0.4 + fade * 0.9))
  }

  const destroy = () => {
    if (destroyed) {
      return
    }

    destroyed = true
    ground.destroy()
    upright.destroy()
  }

  paint(0)

  return {
    update(progress) {
      if (!completed) {
        paint(progress)
      }
    },

    complete() {
      if (completed || destroyed) {
        return
      }

      completed = true

      paintFlash(0)

      const state = { fade: 0 }

      scene.tweens.add({
        targets: state,
        fade: 1,
        duration: 180,
        ease: 'Quad.easeOut',
        onUpdate: () => paintFlash(state.fade),
        onComplete: destroy,
      })
    },

    destroy,
  }
}
