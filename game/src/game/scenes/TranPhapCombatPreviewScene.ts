// TranPhapCombatPreviewScene (Battlefield Slot spec, 2026-09-06) — thay
// TranPhapPreviewScene (2026-09-06, Hỗn Độn Trận visual test tooling):
// scene Phaser RIÊNG (Phaser.Game riêng, TextureManager riêng — không có
// nguy cơ đụng key dù dùng lại ĐÚNG PLACEHOLDER_SHEET_KEY), nhưng giờ
// implements CombatGridViewHost và dùng ĐÚNG CombatGridView mà combat
// thật dùng (spec §4) — thay vì tự viết lại logic sprite/animation. Vẽ
// lưới 6x6 ở 2.5D perspective (isPerspective: true — Battlefield
// Perspective Panel 2026-09-06) + 2 lớp nền sky/ground cho art thật sau này.
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
import {
  createBattleGridProjection,
  computePerspectiveGeometry,
  type BattleGridProjection,
} from '@/game/support/BattleGridProjection'
import type { FormationSlotAssignment } from '@/core/player/Player'
import type { LaneIndex } from '@/core/battle/BattleLane'
import { CombatGridView } from './combat/combat-grid-view'
import type { CombatGridViewHost } from './combat/CombatGridViewHost'
import type { EntitySprite } from './combat/combatTypes'

export const PREVIEW_CELL_SIZE = 60
export const PREVIEW_GRID_SIZE = 6
// PHẢI khớp CHÍNH XÁC với PANEL_CANVAS_WIDTH/HEIGHT trong TranPhapPanel.vue
// (Task 3, cùng plan) — 2 nơi định nghĩa vì .vue component và scene này
// không chia sẻ được scope; đổi 1 bên PHẢI đổi bên kia. Nếu lệch, canvas
// Phaser thật sẽ khác kích thước scene tự tính (méo layout nhưng không
// crash — an toàn nhưng sai hình).
export const PANEL_WIDTH = 420
export const PANEL_HEIGHT = 480
export const PERSPECTIVE_MIN_ROAD_HEIGHT_PANEL = 140

const PANEL_SKY_COLOR = 0x22283a
const PANEL_GROUND_COLOR = 0x1a1a1a

const PREVIEW_IDLE_ANIMATION_KEY = 'tran-phap-preview-idle'

export function previewCellTopLeft(row: number, column: number): { x: number; y: number } {
  return { x: column * PREVIEW_CELL_SIZE, y: row * PREVIEW_CELL_SIZE }
}

export class TranPhapCombatPreviewScene extends Phaser.Scene implements CombatGridViewHost {
  // Battlefield Perspective Panel (2026-09-06) — chuyển từ flat sang
  // perspective; combat-grid-view.ts's applySpriteSize()/positionSprite()
  // tự rẽ nhánh áp dụng applyEntityDepthScale() khi cờ này true (đã build
  // sẵn từ Part 1, không cần sửa gì thêm ở 2 hàm đó).
  readonly isPerspective = true
  projection: BattleGridProjection | undefined
  gridGraphics: Phaser.GameObjects.Graphics | undefined
  readonly usingArtBackdrop = false
  // arenaRect luôn undefined ở panel (chỉ combat thật's flat mode dùng nó
  // để CombatGridView.redrawGridLines() phân biệt flat/perspective qua
  // Boolean(this.host.arenaRect) — panel LUÔN perspective nên giữ
  // undefined là đúng, KHÔNG gán Rectangle nào vào field này).
  arenaRect: Phaser.GameObjects.Rectangle | undefined
  private skyLayer: Phaser.GameObjects.Rectangle | undefined
  private groundLayer: Phaser.GameObjects.Rectangle | undefined
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

    const geometry = computePerspectiveGeometry(
      { width: PANEL_WIDTH, height: PANEL_HEIGHT, topInset: 0, bottomInset: 0 },
      PERSPECTIVE_MIN_ROAD_HEIGHT_PANEL,
    )

    // 2 lớp nền phẳng (sky/ground) — KHÔNG dùng attachBattlefieldBackdrop()
    // của combat thật (sao/trăng/núi/đá quá cầu kỳ cho panel test, và
    // cũng hardcode GRID_ROW_COUNT/COLUMN_COUNT). Đặt tên rõ ràng để sau
    // này thay Rectangle bằng Image thật chỉ cần đổi loại GameObject, giữ
    // nguyên vị trí gọi.
    this.skyLayer = this.add.rectangle(0, 0, PANEL_WIDTH, geometry.horizonY, PANEL_SKY_COLOR).setOrigin(0, 0)
    this.groundLayer = this.add
      .rectangle(0, geometry.horizonY, PANEL_WIDTH, geometry.roadHeight, PANEL_GROUND_COLOR)
      .setOrigin(0, 0)

    this.projection = createBattleGridProjection(
      'perspective',
      { width: PANEL_WIDTH, height: PANEL_HEIGHT, topInset: 0, bottomInset: 0 },
      PREVIEW_GRID_SIZE,
      PREVIEW_GRID_SIZE,
      PERSPECTIVE_MIN_ROAD_HEIGHT_PANEL,
    )
    this.gridGraphics = this.add.graphics()
    this.gridView.redrawGridLines()

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
