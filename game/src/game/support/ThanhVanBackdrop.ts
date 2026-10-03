// ThanhVanBackdrop (thanh-van-dong-fu-art-production-plan.md sec10-11) -
// gan 7 anh modular (sky + 6 layer mua) vao CombatScene, stretch full
// canvas: art duoc author tren cung design frame (1672x941) nen giu
// tuong doi alignment voi projection grid. Grading thoi gian trong ngay
// phu mot lop mau mo phia tren stack.
//
// Depth (2026-08-26) - MOI anh nhan depth tuong minh theo texture key
// (thanhVanLayerDepth): sky < far mountains < midground < atmosphere
// < battle ground < foreground < grading; KHONG con phu thuoc thu tu
// add vao display list (truoc day atmosphere bi de len battle ground).
import Phaser from 'phaser'
import { DEPTH_THANH_VAN_TIME_GRADE } from './BattleLayers'
import {
  THANH_VAN_CANVAS,
  thanhVanLayerDepth,
  thanhVanLoadList,
  thanhVanTimeGrade,
  type ThanhVanVariant,
} from './ThanhVanArt'

// Workstream H (gameplay-ui-feedback-responsive-cleanup-plan.md sec11) - art
// duoc author tren khung THANH_VAN_CANVAS voi duong chan troi co dinh o
// dung giua khung (khop PERSPECTIVE_SCENERY_RATIO mac dinh trong
// BattleGridProjection.ts). Neo layer theo ti le NAY thay vi keo meo full
// canvas - moi viewport (ke ca man thap co road lon hon scenery qua
// PERSPECTIVE_MIN_ROAD_HEIGHT clamp) deu khop chan dat that (horizonY).
const THANH_VAN_HORIZON_FRACTION = 0.5

export interface ThanhVanBackdropHandle {
  /** horizonY optional de cung shape voi BattlefieldBackdropHandle; luon truyen that tu CombatScene. */
  redraw(width?: number, height?: number, horizonY?: number): void

  destroy(): void

  /** Depth dang gan cho tung texture key - test/kiem chung layout dung. */
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
    // Scale DEU theo be rong (khong meo ti le) - bu chenh lech aspect
    // ratio bang vi tri (offsetY), khong phai bang cach nen/gian rieng
    // truc doc.
    const scale = canvasWidth / THANH_VAN_CANVAS.w
    const scaledHeight = THANH_VAN_CANVAS.h * scale
    const offsetY = targetHorizonY - THANH_VAN_CANVAS.h * THANH_VAN_HORIZON_FRACTION * scale

    for (const image of images) {
      image.setDisplaySize(canvasWidth, scaledHeight)

      image.setPosition(0, offsetY)
    }

    // Lop phu mau grading van phu TRON canvas (khong le thuoc horizon).
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
