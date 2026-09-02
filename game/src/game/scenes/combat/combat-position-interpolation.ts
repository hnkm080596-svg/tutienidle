// combat-position-interpolation (ui-discoverability-refactor-plan.md
// §3.2) — tách từ CombatScene.ts: nội suy vị trí X liên tục giữa 2
// snapshot 'positions' (segment tween theo thời gian thực, không phụ
// thuộc framerate). Module nhận dependency tường minh qua `scene`; state
// (Map interpolations) VẪN sống trên scene — test đọc trực tiếp
// scene.interpolations, giữ nguyên seam cũ.
import Phaser from 'phaser'

import type { CombatScene } from '../CombatScene'
import { MIN_SEGMENT_DURATION_MS } from './combatConstants'
import type { PositionInterpolation } from './combatTypes'

export class CombatPositionInterpolation {
  constructor(private readonly scene: CombatScene) {}

  setInterpolationTarget(id: string, worldX: number, cadenceMs?: number, snapshotAt?: number) {
    const existing = this.scene.interpolations.get(id)

    if (!existing) {
      this.snapInterpolationTarget(id, worldX, snapshotAt)

      return
    }

    if (worldX === existing.toX) {
      return
    }

    const now = this.scene.time.now
    const currentVisualX = this.interpolate(existing, now)
    // Cadence ưu tiên từ snapshot (khoảng cách 2 event 'positions'),
    // fallback: khoảng cách từ segment trước, clamp sàn.
    const segmentDuration = Math.max(cadenceMs ?? MIN_SEGMENT_DURATION_MS, MIN_SEGMENT_DURATION_MS)

    this.scene.interpolations.set(id, {
      fromX: currentVisualX,
      toX: worldX,
      segmentStart: now,
      segmentDuration,
      lastSnapshotAt: snapshotAt ?? now,
    })
  }

  snapInterpolationTarget(id: string, worldX: number, snapshotAt?: number) {
    const now = this.scene.time.now

    this.scene.interpolations.set(id, {
      fromX: worldX,
      toX: worldX,
      segmentStart: now,
      segmentDuration: 1,
      lastSnapshotAt: snapshotAt ?? now,
    })
  }

  interpolate(entry: PositionInterpolation, now: number): number {
    const progress = Phaser.Math.Clamp((now - entry.segmentStart) / entry.segmentDuration, 0, 1)

    return Phaser.Math.Linear(entry.fromX, entry.toX, progress)
  }

  getInterpolatedX(id: string): number | undefined {
    const entry = this.scene.interpolations.get(id)

    if (!entry) {
      return undefined
    }

    return this.interpolate(entry, this.scene.time.now)
  }
}
