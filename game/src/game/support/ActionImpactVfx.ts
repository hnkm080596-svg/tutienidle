// Shared VFX geometry helpers. The spawnActionImpactVfx production path was
// removed when skill presentation moved to the cue-driven runner; the vector
// conversion below is still consumed by combat-grid-view footprint rendering.
import Phaser from 'phaser'

/** Graphics.fillPoints/strokePoints want Vector2[] - convert at the boundary. */
export function toVector2Points(points: Array<{ x: number; y: number }>): Phaser.Math.Vector2[] {
  return points.map((point) => new Phaser.Math.Vector2(point.x, point.y))
}
