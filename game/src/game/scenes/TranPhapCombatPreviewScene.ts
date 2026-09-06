// TranPhapCombatPreviewScene (Battlefield Slot spec, 2026-09-06) — thay
// TranPhapPreviewScene (2026-09-06, Hỗn Độn Trận visual test tooling):
// scene Phaser RIÊNG (Phaser.Game riêng, TextureManager riêng — không có
// nguy cơ đụng key dù dùng lại ĐÚNG PLACEHOLDER_SHEET_KEY), nhưng giờ
// implements CombatGridViewHost và dùng ĐÚNG CombatGridView mà combat
// thật dùng (spec §4) — thay vì tự viết lại logic sprite/animation. Vẽ
// lưới 6x6 PHẲNG (isPerspective: false — 2.5D là spec riêng sau này,
// KHÔNG làm ở đây) + 1 layer background dự phòng cho art thật sau này.
// Tương tác kéo-thả KHÔNG nằm ở đây — canvas này thuần hiển thị, overlay
// HTML trong suốt (TranPhapPanel.vue, không đổi) mới là drop target thật.
import Phaser from 'phaser'
import {
  PLACEHOLDER_SHEET_KEY,
  PLACEHOLDER_SHEET_URL,
  PLACEHOLDER_FRAME_WIDTH,
  PLACEHOLDER_FRAME_HEIGHT,
  PLACEHOLDER_FRAME_COUNT,
  PLACEHOLDER_FRAME_RATE,
} from '@/game/support/CombatAnimationSet'
import type { BattleGridProjection } from '@/game/support/BattleGridProjection'
import type { FormationSlotAssignment } from '@/core/player/Player'
import type { LaneIndex } from '@/core/battle/BattleLane'
import { CombatGridView } from './combat/combat-grid-view'
import type { CombatGridViewHost } from './combat/CombatGridViewHost'
import type { EntitySprite } from './combat/combatTypes'

export const PREVIEW_CELL_SIZE = 60
export const PREVIEW_GRID_SIZE = 6

const PREVIEW_IDLE_ANIMATION_KEY = 'tran-phap-preview-idle'

export function previewCellTopLeft(row: number, column: number): { x: number; y: number } {
  return { x: column * PREVIEW_CELL_SIZE, y: row * PREVIEW_CELL_SIZE }
}

export class TranPhapCombatPreviewScene extends Phaser.Scene implements CombatGridViewHost {
  readonly isPerspective = false
  projection: BattleGridProjection | undefined
  gridGraphics: Phaser.GameObjects.Graphics | undefined
  readonly usingArtBackdrop = false
  arenaRect: Phaser.GameObjects.Rectangle | undefined
  // 0.8 × cell (KHÔNG bằng PREVIEW_CELL_SIZE thẳng) — characterWidth/Height
  // ở đây LÀ kích thước sprite hiển thị mong muốn (applySpriteSize()'s
  // flat formula: displayHeight = characterHeight × sizeMultiplier, và
  // sizeMultiplier của nhánh fallback panel dùng là 1, xem combat-grid-
  // view.ts Task 2 Step 3) — 0.8 tái tạo ĐÚNG tỉ lệ sprite/ô của
  // TranPhapPreviewScene cũ (`setDisplaySize(PREVIEW_CELL_SIZE * 0.8,
  // PREVIEW_CELL_SIZE * 0.8)`), không để sprite to lấn sang ô kế bên.
  characterWidth = PREVIEW_CELL_SIZE * 0.8
  characterHeight = PREVIEW_CELL_SIZE * 0.8
  // Không dùng khi isPerspective=false (applySpriteSize() nhánh flat đọc
  // characterWidth/Height trực tiếp) — giữ 1:1 để tránh chia 0 nếu code
  // sau này lỡ đọc tới.
  readonly playerSourceSize = { w: 1, h: 1 }
  readonly playerProfile = { combatTextureKey: PLACEHOLDER_SHEET_KEY }
  sprites = new Map<string, EntitySprite>()
  entityFootMinY = 0
  entityFootMaxY = 1
  // resetVisual() không dùng ở panel — Map rỗng thoả type, .get() luôn
  // undefined (đã guard sẵn trong CombatGridView.resetVisual()).
  readonly interpolations = new Map<string, unknown>()

  private gridView!: CombatGridView

  constructor() {
    super('TranPhapCombatPreviewScene')
  }

  fallbackSpriteTextureKey(_id: string): string | undefined {
    return PLACEHOLDER_SHEET_KEY
  }

  preload(): void {
    this.load.spritesheet(PLACEHOLDER_SHEET_KEY, PLACEHOLDER_SHEET_URL, {
      frameWidth: PLACEHOLDER_FRAME_WIDTH,
      frameHeight: PLACEHOLDER_FRAME_HEIGHT,
    })
  }

  create(): void {
    this.gridView = new CombatGridView(this)

    // Layer background — hiện tại chỉ 1 màu phẳng, để dành gắn ảnh thật
    // sau này mà không cần đổi cấu trúc scene.
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
   * Diff theo combatantId qua chính CombatGridView.getOrCreateSprite() —
   * KHÔNG tự viết lại logic tạo/xoá sprite: entity còn trong assignment
   * mới → getOrCreateSprite() no-op nếu id đã có trong this.sprites (chỉ
   * reposition), animation KHÔNG bị ngắt/reset (đây chính là fix cho bug
   * "animation reset về 0 mỗi lần kéo-thả 1 entity", 2026-09-06); entity
   * biến mất → destroyEntitySprite() qua CombatGridView; entity mới xuất
   * hiện → getOrCreateSprite() tạo sprite mới, play() từ frame 0 (đúng —
   * chưa từng animate trong panel này).
   */
  syncAssignments(assignments: FormationSlotAssignment[]): void {
    const nextIds = new Set(assignments.map((a) => a.combatantId))

    for (const [id, sprite] of this.sprites) {
      if (!nextIds.has(id)) {
        this.gridView.destroyEntitySprite(sprite)
        this.sprites.delete(id)
      }
    }

    for (const assignment of assignments) {
      const sprite = this.gridView.getOrCreateSprite(
        assignment.combatantId,
        0x4caf50,
        assignment.combatantId,
        assignment.row as LaneIndex,
      )

      if (sprite.kind === 'sprite' && !(sprite.rect as Phaser.GameObjects.Sprite).anims.isPlaying) {
        ;(sprite.rect as Phaser.GameObjects.Sprite).play(PREVIEW_IDLE_ANIMATION_KEY)
      }

      this.gridView.positionSprite(sprite, assignment.column)
    }
  }
}
