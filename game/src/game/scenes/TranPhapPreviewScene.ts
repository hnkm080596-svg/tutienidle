// TranPhapPreviewScene (Hỗn Độn Trận visual test tooling, 2026-09-06) —
// scene Phaser RIÊNG, độc lập hoàn toàn với CombatScene/MainScene thật
// (Phaser.Game riêng, TextureManager riêng — không có nguy cơ đụng key
// dù dùng lại ĐÚNG PLACEHOLDER_SHEET_KEY, vì đó là 1 Phaser.Game khác).
// Vẽ lưới 6x6 PHẲNG (không phối cảnh, không tái dùng
// BattleGridProjection.ts — quyết định thiết kế rõ ràng, xem spec
// 2026-09-06-hon-don-tran-visual-test-design.md §Non-Goals) + 1 layer
// background dự phòng cho art thật sau này + sprite animate tại từng ô
// đã gán trong TranPhapPanel.vue. Tương tác kéo-thả KHÔNG nằm ở đây —
// canvas này thuần hiển thị, overlay HTML trong suốt (Task 20, không
// đổi) mới là drop target thật.
import Phaser from 'phaser'
import {
  PLACEHOLDER_SHEET_KEY,
  PLACEHOLDER_SHEET_URL,
  PLACEHOLDER_FRAME_WIDTH,
  PLACEHOLDER_FRAME_HEIGHT,
  PLACEHOLDER_FRAME_COUNT,
  PLACEHOLDER_FRAME_RATE,
} from '@/game/support/CombatAnimationSet'
import type { FormationSlotAssignment } from '@/core/player/Player'

export const PREVIEW_CELL_SIZE = 64
export const PREVIEW_GRID_SIZE = 6

const PREVIEW_IDLE_ANIMATION_KEY = 'tran-phap-preview-idle'

export function previewCellTopLeft(row: number, column: number): { x: number; y: number } {
  return { x: column * PREVIEW_CELL_SIZE, y: row * PREVIEW_CELL_SIZE }
}

export class TranPhapPreviewScene extends Phaser.Scene {
  private sprites: Phaser.GameObjects.Sprite[] = []

  constructor() {
    super('TranPhapPreviewScene')
  }

  preload(): void {
    this.load.spritesheet(PLACEHOLDER_SHEET_KEY, PLACEHOLDER_SHEET_URL, {
      frameWidth: PLACEHOLDER_FRAME_WIDTH,
      frameHeight: PLACEHOLDER_FRAME_HEIGHT,
    })
  }

  create(): void {
    // Layer background — hiện tại chỉ 1 màu phẳng, để dành gắn ảnh thật
    // sau này (spec §4) mà không cần đổi cấu trúc scene.
    this.add
      .rectangle(0, 0, PREVIEW_CELL_SIZE * PREVIEW_GRID_SIZE, PREVIEW_CELL_SIZE * PREVIEW_GRID_SIZE, 0x1a1a1a)
      .setOrigin(0, 0)

    const grid = this.add.graphics()

    grid.lineStyle(1, 0x4caf50, 0.6)

    for (let i = 0; i <= PREVIEW_GRID_SIZE; i++) {
      grid.lineBetween(0, i * PREVIEW_CELL_SIZE, PREVIEW_CELL_SIZE * PREVIEW_GRID_SIZE, i * PREVIEW_CELL_SIZE)
      grid.lineBetween(i * PREVIEW_CELL_SIZE, 0, i * PREVIEW_CELL_SIZE, PREVIEW_CELL_SIZE * PREVIEW_GRID_SIZE)
    }

    if (!this.anims.exists(PREVIEW_IDLE_ANIMATION_KEY)) {
      this.anims.create({
        key: PREVIEW_IDLE_ANIMATION_KEY,
        frames: this.anims.generateFrameNumbers(PLACEHOLDER_SHEET_KEY, { start: 0, end: PLACEHOLDER_FRAME_COUNT - 1 }),
        frameRate: PLACEHOLDER_FRAME_RATE,
        repeat: -1,
      })
    }
  }

  /** Xoá hết sprite cũ, dựng lại đúng theo assignment hiện tại — đơn giản, đủ dùng cho panel test (không cần diff tối ưu như combat thật). */
  syncAssignments(assignments: FormationSlotAssignment[]): void {
    for (const sprite of this.sprites) {
      sprite.destroy()
    }

    this.sprites = assignments.map((assignment) => {
      const { x, y } = previewCellTopLeft(assignment.row, assignment.column)

      const sprite = this.add.sprite(x + PREVIEW_CELL_SIZE / 2, y + PREVIEW_CELL_SIZE / 2, PLACEHOLDER_SHEET_KEY)

      sprite.setDisplaySize(PREVIEW_CELL_SIZE * 0.8, PREVIEW_CELL_SIZE * 0.8)
      sprite.play(PREVIEW_IDLE_ANIMATION_KEY)

      return sprite
    })
  }
}
