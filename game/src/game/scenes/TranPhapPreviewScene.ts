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

// 60 = khớp CHÍNH XÁC pitch giữa các ô CSS thật trong TranPhapPanel.vue
// (.tran-phap-panel__cell rộng 56px + gap 4px giữa các ô = 60px/ô) —
// nhờ vậy previewCellTopLeft() dưới đây trùng khít góc trái-trên của
// từng ô overlay HTML, không lệch dần theo index nữa.
export const PREVIEW_CELL_SIZE = 60
export const PREVIEW_GRID_SIZE = 6

const PREVIEW_IDLE_ANIMATION_KEY = 'tran-phap-preview-idle'

export function previewCellTopLeft(row: number, column: number): { x: number; y: number } {
  return { x: column * PREVIEW_CELL_SIZE, y: row * PREVIEW_CELL_SIZE }
}

export class TranPhapPreviewScene extends Phaser.Scene {
  // Bug fix (2026-09-06, user report "animation reset về 0 mỗi lần kéo-
  // thả 1 entity") — key theo combatantId thay vì mảng phẳng: sprite của
  // NHỮNG entity KHÔNG đổi (vẫn còn trong assignment mới, dù đổi ô hay
  // không) được GIỮ NGUYÊN object (chỉ reposition nếu đổi ô) thay vì
  // destroy() + tạo lại + play() lại từ đầu — animation chỉ thật sự reset
  // khi 1 entity MỚI xuất hiện hoặc panel đóng/mở lại (component re-mount
  // Phaser.Game mới, xem TranPhapPanel.vue).
  private spritesByCombatantId = new Map<string, Phaser.GameObjects.Sprite>()

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

  /**
   * Diff theo combatantId (KHÔNG xoá-dựng-lại toàn bộ như trước fix):
   * entity còn trong assignment mới → GIỮ sprite cũ, chỉ reposition nếu
   * đổi ô (animation KHÔNG bị ngắt/reset); entity biến mất → destroy;
   * entity mới xuất hiện → tạo sprite mới, play() từ frame 0 (đúng —
   * chưa từng animate trong panel này).
   */
  syncAssignments(assignments: FormationSlotAssignment[]): void {
    const nextIds = new Set(assignments.map((a) => a.combatantId))

    for (const [combatantId, sprite] of this.spritesByCombatantId) {
      if (!nextIds.has(combatantId)) {
        sprite.destroy()
        this.spritesByCombatantId.delete(combatantId)
      }
    }

    for (const assignment of assignments) {
      const { x, y } = previewCellTopLeft(assignment.row, assignment.column)
      const centerX = x + PREVIEW_CELL_SIZE / 2
      const centerY = y + PREVIEW_CELL_SIZE / 2

      const existing = this.spritesByCombatantId.get(assignment.combatantId)

      if (existing) {
        existing.setPosition(centerX, centerY)
        continue
      }

      const sprite = this.add.sprite(centerX, centerY, PLACEHOLDER_SHEET_KEY)

      sprite.setDisplaySize(PREVIEW_CELL_SIZE * 0.8, PREVIEW_CELL_SIZE * 0.8)
      sprite.play(PREVIEW_IDLE_ANIMATION_KEY)

      this.spritesByCombatantId.set(assignment.combatantId, sprite)
    }
  }
}
