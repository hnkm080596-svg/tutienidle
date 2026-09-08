// R5 (AR-29) — CombatPositionInterpolation encapsulates its own private interpolations map.
// Manages smooth X-position interpolation segments between 'positions' snapshots.
import Phaser from 'phaser'

import type { CombatScene } from '../CombatScene'
import { MIN_SEGMENT_DURATION_MS } from './combatConstants'
import type { PositionInterpolation } from './combatTypes'

export class CombatPositionInterpolation {
  private interpolationsMap = new Map<string, PositionInterpolation>()

  get interpolations(): Map<string, PositionInterpolation> {
    return this.interpolationsMap
  }

  set interpolations(map: Map<string, PositionInterpolation>) {
    this.interpolationsMap = map
  }

  constructor(private readonly scene: CombatScene) {}

  setInterpolationTarget(id: string, worldX: number, cadenceMs?: number, snapshotAt?: number) {
    const existing = this.interpolationsMap.get(id)

    if (!existing) {
      this.snapInterpolationTarget(id, worldX, snapshotAt)
      return
    }

    if (worldX === existing.toX) {
      return
    }

    const now = this.scene.time.now
    const currentVisualX = this.interpolate(existing, now)
    const segmentDuration = Math.max(cadenceMs ?? MIN_SEGMENT_DURATION_MS, MIN_SEGMENT_DURATION_MS)

    this.interpolationsMap.set(id, {
      fromX: currentVisualX,
      toX: worldX,
      segmentStart: now,
      segmentDuration,
      lastSnapshotAt: snapshotAt ?? now,
    })
  }

  snapInterpolationTarget(id: string, worldX: number, snapshotAt?: number) {
    const now = this.scene.time.now

    this.interpolationsMap.set(id, {
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
    const entry = this.interpolationsMap.get(id)

    if (!entry) {
      return undefined
    }

    return this.interpolate(entry, this.scene.time.now)
  }

  delete(id: string): void {
    this.interpolationsMap.delete(id)
  }

  clear(): void {
    this.interpolationsMap.clear()
  }
}
