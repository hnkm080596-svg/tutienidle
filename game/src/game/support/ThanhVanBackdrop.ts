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
  thanhVanLayerDepth,
  thanhVanLoadList,
  thanhVanTimeGrade,
  type ThanhVanVariant,
} from './ThanhVanArt'

export interface ThanhVanBackdropHandle {
  redraw(width: number, height: number): void

  destroy(): void

  /** Depth đang gắn cho từng texture key — test/kiểm chứng layout dùng. */
  depthByKey(): Map<string, number>
}

export function attachThanhVanBackdrop(
  scene: Phaser.Scene,

  variant: ThanhVanVariant,

  width: number,

  height: number,
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

  function redraw(canvasWidth: number, canvasHeight: number): void {
    for (const image of images) {
      image.setDisplaySize(canvasWidth, canvasHeight)

      image.setPosition(0, 0)
    }

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

  redraw(width, height)

  return { redraw, destroy, depthByKey }
}
