// ThanhVanBackdrop (thanh-van-dong-fu-art-production-plan.md §10-11) —
// gắn 7 ảnh modular (sky + 6 layer mùa) vào CombatScene, stretch full
// canvas: art được author trên cùng design frame (1672×941) nên giữ
// tương đối alignment với projection grid. Grading thời gian trong ngày
// phủ một lớp màu mờ phía trên stack.
//
// Depth (2026-08-26) — MỖI ảnh nhận depth tường minh theo texture key
// (thanhVanLayerDepth): sky < far mountains < midground < atmosphere
// < battle ground < foreground < grading; KHÔNG còn phụ thuộc thứ tự
// add vào display list (trước đây atmosphere bị đè lên battle ground).
import Phaser from 'phaser'
import { DEPTH_THANH_VAN_TIME_GRADE } from './BattleLayers'
import {
  THANH_VAN_CANVAS,
  thanhVanLayerDepth,
  thanhVanLoadList,
  thanhVanTimeGrade,
  type ThanhVanVariant,
} from './ThanhVanArt'

// Workstream H (gameplay-ui-feedback-responsive-cleanup-plan.md §11) — art
// được author trên khung THANH_VAN_CANVAS với đường chân trời cố định ở
// đúng giữa khung (khớp PERSPECTIVE_SCENERY_RATIO mặc định trong
// BattleGridProjection.ts). Neo layer theo tỉ lệ NÀY thay vì kéo méo full
// canvas — mọi viewport (kể cả màn thấp co road lớn hơn scenery qua
// PERSPECTIVE_MIN_ROAD_HEIGHT clamp) đều khớp chân đất thật (horizonY).
const THANH_VAN_HORIZON_FRACTION = 0.5

export interface ThanhVanBackdropHandle {
  /** horizonY optional để cùng shape với BattlefieldBackdropHandle; luôn truyền thật từ CombatScene. */
  redraw(width?: number, height?: number, horizonY?: number): void

  destroy(): void

  /** Depth đang gắn cho từng texture key — test/kiểm chứng layout dùng. */
  depthByKey(): Map<string, number>
}

export function attachThanhVanBackdrop(
  scene: Phaser.Scene,

  variant: ThanhVanVariant,

  width: number,

  height: number,

  horizonY: number,
): ThanhVanBackdropHandle {
  const entries = thanhVanLoadList(variant)

  const images = entries.map((entry) =>
    scene.add
      .image(0, 0, entry.key)
      .setOrigin(0, 0)
      .setDepth(thanhVanLayerDepth(entry.key)),
  )

  const depths = new Map<string, number>(
    entries.map((entry) => [entry.key, thanhVanLayerDepth(entry.key)]),
  )

  const grade = thanhVanTimeGrade(variant.time)

  const gradeOverlay = grade
    ? scene.add
        .rectangle(0, 0, width, height, grade.color, grade.alpha)
        .setOrigin(0, 0)
        .setDepth(DEPTH_THANH_VAN_TIME_GRADE)
    : undefined

  function redraw(
    canvasWidth: number = width,
    canvasHeight: number = height,
    targetHorizonY: number = canvasHeight * THANH_VAN_HORIZON_FRACTION,
  ): void {
    // Scale ĐỀU theo bề rộng (không méo tỉ lệ) — bù chênh lệch aspect
    // ratio bằng vị trí (offsetY), không phải bằng cách nén/giãn riêng
    // trục dọc.
    const scale = canvasWidth / THANH_VAN_CANVAS.w
    const scaledHeight = THANH_VAN_CANVAS.h * scale
    const offsetY = targetHorizonY - THANH_VAN_CANVAS.h * THANH_VAN_HORIZON_FRACTION * scale

    for (const image of images) {
      image.setDisplaySize(canvasWidth, scaledHeight)

      image.setPosition(0, offsetY)
    }

    // Lớp phủ màu grading vẫn phủ TRỌN canvas (không lệ thuộc horizon).
    gradeOverlay?.setSize(canvasWidth, canvasHeight)

    gradeOverlay?.setPosition(0, 0)
  }

  function destroy(): void {
    for (const image of images) {
      image.destroy()
    }

    gradeOverlay?.destroy()
  }

  function depthByKey(): Map<string, number> {
    return new Map(depths)
  }

  redraw(width, height, horizonY)

  return { redraw, destroy, depthByKey }
}
