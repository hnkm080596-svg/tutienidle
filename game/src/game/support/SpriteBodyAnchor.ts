// SpriteBodyAnchor (player-body-anchor-reward-gourd-plan §5.2) — bộ giải
// thuần chuyển normalized anchor (0..1 của ảnh nguồn) sang screen
// coordinate, tính đủ: origin, display size, flipX, rotation và một hệ
// số scale bổ sung (nếu caller chưa bake depth scale vào display size).
//
// Pure module — không import Phaser; caller snapshot transform của
// GameObject thành `SpriteTransformSnapshot` rồi truyền vào đây. One-shot
// VFX giải đúng lúc spawn; sustained VFX gọi lại mỗi frame.

import type { NormalizedBodyAnchor } from './PlayerVisualProfiles'

export interface SpriteTransformSnapshot {
  /** Vị trí sprite trên màn hình (điểm origin). */
  x: number

  y: number

  displayWidth: number

  displayHeight: number

  /** Phaser origin — combat dùng foot (0.5, 1), home dùng center. */
  originX: number

  originY: number

  /** setFlipX(true) mirror texture quanh origin theo trục dọc. */
  flipX?: boolean

  /** Radian — walk sway/effect rotation xoay offset quanh origin. */
  rotation?: number

  /**
   * Hệ số nhân thêm cho offset (depth scale phối cảnh) khi display size
   * CHƯA gồm scale đó; mặc định 1.
   */
  extraScale?: number
}

export interface ResolvedBodyAnchor {
  x: number

  y: number
}

/** Mirror hoành độ anchor khi texture bị lật ngang. */
function mirroredAnchorX(anchorX: number): number {
  return 1 - anchorX
}

/**
 * Giải anchor → screen point:
 *   offset = ((anchor.x' - originX) × displayWidth,
 *             (anchor.y - originY) × displayHeight) × extraScale
 *   quay offset bằng rotation (nếu có), cộng vào vị trí sprite.
 */
export function resolveSpriteBodyAnchor(
  anchor: NormalizedBodyAnchor,

  sprite: SpriteTransformSnapshot,
): ResolvedBodyAnchor {
  const anchorX = sprite.flipX ? mirroredAnchorX(anchor.x) : anchor.x

  const extraScale = sprite.extraScale ?? 1

  let offsetX =
    (anchorX - sprite.originX) * sprite.displayWidth * extraScale

  let offsetY =
    (anchor.y - sprite.originY) * sprite.displayHeight * extraScale

  const rotation = sprite.rotation ?? 0

  if (rotation !== 0) {
    const cos = Math.cos(rotation)

    const sin = Math.sin(rotation)

    const rotatedX = offsetX * cos - offsetY * sin

    const rotatedY = offsetX * sin + offsetY * cos

    offsetX = rotatedX

    offsetY = rotatedY
  }

  return {
    x: sprite.x + offsetX,

    y: sprite.y + offsetY,
  }
}
