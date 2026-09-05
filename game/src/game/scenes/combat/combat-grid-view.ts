// combat-grid-view (ui-discoverability-refactor-plan.md §3.2) — tách từ
// CombatScene.ts: 2.5D GRID PROJECTION, depth layers, entity sprite
// lifecycle/size/position. Module nhận dependency tường minh qua `scene`
// — mọi cross-call đi qua scene delegate để giữ seam test.
import Phaser from 'phaser'

import type { LaneIndex } from '@/core/battle/BattleLane'
import { GRID_ROW_COUNT, GRID_COLUMN_COUNT, HERO_COLUMN, HERO_LANE_INDEX } from '@/core/battle/BattleLane'
import { toVector2Points } from '@/game/support/ActionImpactVfx'
import { ENEMY_SOURCE_SIZE, resolveEnemyTextureKey } from '@/game/support/EnemyArt'
import { PLAYER_TEXTURE_KEY } from '@/game/support/CombatPreload'
import { DEPTH_ENTITY_SHADOW, DEPTH_OVERLAY_UI, entitySpriteDepth } from '@/game/support/BattleLayers'

import type { CombatScene } from '../CombatScene'
import {
  BOSS_DISPLAY_SCALE_MULTIPLIER,
  BOSS_HP_FILL_COLOR,
  ENEMY_DISPLAY_SCALE_MULTIPLIER,
  ENEMY_HP_BAR_HEIGHT,
  ENEMY_HP_BAR_OFFSET_Y,
  ENEMY_HP_BG_COLOR,
  ENEMY_HP_FILL_COLOR,
  LANE_DIVIDER_COLOR,
  PERSPECTIVE_BORDER_ALPHA,
  PERSPECTIVE_BORDER_COLOR,
  PERSPECTIVE_GRID_ALPHA,
  PERSPECTIVE_GRID_COLOR,
  PLAYER_COLOR,
  PLAYER_DISPLAY_SCALE_MULTIPLIER,
  PLAYER_ID,
  SHADOW_ALPHA,
  SHADOW_COLOR,
} from './combatConstants'
import type { EnemyHealthBar, EntitySprite } from './combatTypes'

// Bóng ellipse dưới chân — dẹt theo trục sâu (copy từ CombatScene).
const SHADOW_WIDTH_RATIO = 1.12
const SHADOW_HEIGHT_RATIO = 0.34

export class CombatGridView {
  constructor(private readonly scene: CombatScene) {}

  redrawGridLines() {
    const graphics = this.scene.gridGraphics
    const projection = this.scene.projection

    if (!graphics || !projection) {
      return
    }

    graphics.clear()

    // Thanh Vân art mount (yêu cầu 2026-08-26) — art đã có battle-ground
    // riêng ("No layer contains a battle grid") nên KHÔNG vẽ đường chia ô
    // đè lên; giữ grid động cho flat mode dev fallback.
    if (this.scene.usingArtBackdrop) {
      return
    }

    const isFlat = Boolean(this.scene.arenaRect)

    graphics.lineStyle(
      1,
      isFlat ? LANE_DIVIDER_COLOR : PERSPECTIVE_GRID_COLOR,
      isFlat ? 0.55 : PERSPECTIVE_GRID_ALPHA,
    )

    for (let boundaryRow = 0; boundaryRow <= GRID_ROW_COUNT; boundaryRow++) {
      const rowFloat = boundaryRow - 0.5
      const left = projection.gridToScreen(rowFloat, -0.5)
      const right = projection.gridToScreen(rowFloat, GRID_COLUMN_COUNT - 0.5)

      graphics.beginPath()
      graphics.moveTo(left.x, left.y)
      graphics.lineTo(right.x, right.y)
      graphics.strokePath()
    }

    for (let boundaryColumn = 0; boundaryColumn <= GRID_COLUMN_COUNT; boundaryColumn++) {
      const columnFloat = boundaryColumn - 0.5
      const far = projection.gridToScreen(-0.5, columnFloat)
      const near = projection.gridToScreen(GRID_ROW_COUNT - 0.5, columnFloat)

      graphics.beginPath()
      graphics.moveTo(far.x, far.y)
      graphics.lineTo(near.x, near.y)
      graphics.strokePath()
    }

    if (!isFlat) {
      // Viền ngoài + vùng cổng hero nhấn nhẹ màu phe ta.
      const corners = [
        projection.gridToScreen(-0.5, -0.5),
        projection.gridToScreen(-0.5, GRID_COLUMN_COUNT - 0.5),
        projection.gridToScreen(GRID_ROW_COUNT - 0.5, GRID_COLUMN_COUNT - 0.5),
        projection.gridToScreen(GRID_ROW_COUNT - 0.5, -0.5),
      ]

      graphics.lineStyle(1.5, PERSPECTIVE_BORDER_COLOR, PERSPECTIVE_BORDER_ALPHA)
      graphics.strokePoints(toVector2Points(corners), true, true)

      // Cổng phòng thủ phủ MỌI hàng TẠI CỘNG cổng (plan §2.2).
      const gatePolygon = projection.footprintPolygon({
        rowStart: 0,
        rowEnd: GRID_ROW_COUNT - 1,
        colStart: HERO_COLUMN,
        colEnd: HERO_COLUMN,
      })

      graphics.fillStyle(PLAYER_COLOR, 0.05)
      graphics.fillPoints(toVector2Points(gatePolygon), true)
    }
  }

  // Rectangle (enemy) cần width/height + updateDisplayOrigin() (mutate
  // geometry trực tiếp); Sprite (player) cần setDisplaySize() với TỈ LỆ
  // ĐÚNG của artwork gốc (playerSourceSize theo profile hiện hành —
  // body-anchor plan §4.3), nếu không nhân vật sẽ méo hình khi ép cùng
  // characterWidth/Height hình vuông-ish của enemy.
  //
  // Perspective: baseline chỉ là kích thước ở hàng hiện hành — co giãn
  // theo chiều sâu diễn ra trong applyEntityDepthScale() mỗi lần chiếu.
  applySpriteSize(sprite: EntitySprite) {
    if (this.scene.isPerspective && this.scene.projection) {
      this.scene.applyEntityDepthScale(sprite, this.scene.projection.gridToScreen(sprite.row, 0).scale)

      return
    }

    if (sprite.kind === 'sprite') {
      const width =
        this.scene.characterHeight *
        sprite.sizeMultiplier *
        ((sprite.sourceSize ?? this.scene.playerSourceSize).w / (sprite.sourceSize ?? this.scene.playerSourceSize).h)
      const gameSprite = sprite.rect as Phaser.GameObjects.Sprite

      gameSprite.setDisplaySize(width, this.scene.characterHeight * sprite.sizeMultiplier)

      return
    }

    const rect = sprite.rect as Phaser.GameObjects.Rectangle

    rect.width = this.scene.characterWidth
    rect.height = this.scene.characterHeight
    rect.updateDisplayOrigin()

    if (sprite.healthBar) {
      const width = this.scene.characterWidth * (sprite.healthBar.isBoss ? 1.45 : 1.05)

      sprite.healthBar.width = width
      sprite.healthBar.background.setSize(width, ENEMY_HP_BAR_HEIGHT).updateDisplayOrigin()
      sprite.healthBar.fill.setSize(width, ENEMY_HP_BAR_HEIGHT - 2).updateDisplayOrigin()
      this.scene.updateEnemyHealthBar(sprite, sprite.healthBar.currentHp, sprite.healthBar.maxHp)
    }
  }

  /**
   * Áp scale chiều sâu cho entity: kích thước = baseline × depthScale ×
   * sizeMultiplier (player ×2, enemy PNG ×2 — multiplier NHÂN MỘT LẦN
   * duy nhất tại đây, không cộng dồn qua resize/tween) × boost (pop Chí
   * Mạng/spawn fade-in), ghi vào GEOMETRY/scale của GameObject nên tween
   * cũ vẫn hoạt động; bóng ellipse dưới chân co giãn theo.
   */
  applyEntityDepthScale(sprite: EntitySprite, depthScale: number) {
    const effectiveScale = Math.max(0.05, depthScale * sprite.boost.value)
    const multiplier = sprite.sizeMultiplier

    if (sprite.kind === 'sprite') {
      const height = this.scene.characterHeight * effectiveScale * multiplier
      const gameSprite = sprite.rect as Phaser.GameObjects.Sprite

      gameSprite.setDisplaySize(height * ((sprite.sourceSize ?? this.scene.playerSourceSize).w / (sprite.sourceSize ?? this.scene.playerSourceSize).h), height)
    } else {
      const rect = sprite.rect as Phaser.GameObjects.Rectangle

      rect.width = this.scene.characterWidth * effectiveScale
      rect.height = this.scene.characterHeight * effectiveScale
      rect.updateDisplayOrigin()

      if (sprite.healthBar) {
        const barWidth =
          this.scene.characterWidth * effectiveScale * (sprite.healthBar.isBoss ? 1.45 : 1.05)

        sprite.healthBar.width = barWidth
        sprite.healthBar.background.setSize(barWidth, ENEMY_HP_BAR_HEIGHT).updateDisplayOrigin()
        sprite.healthBar.fill.setSize(barWidth, ENEMY_HP_BAR_HEIGHT - 2).updateDisplayOrigin()
        this.scene.updateEnemyHealthBar(sprite, sprite.healthBar.currentHp, sprite.healthBar.maxHp)
      }
    }

    if (sprite.shadow) {
      const shadowWidth = this.scene.characterWidth * effectiveScale * multiplier * SHADOW_WIDTH_RATIO

      sprite.shadow.setSize(shadowWidth, shadowWidth * SHADOW_HEIGHT_RATIO)
    }
  }

  // Đỉnh đầu sprite theo anchor hiện hành — mọi chrome treo trên đầu
  // (HP bar / cast bar / DOT icon / text bay) đi qua đây để không phụ
  // thuộc origin (foot anchor ở perspective, center anchor ở flat).
  entityHeadY(sprite: EntitySprite): number {
    const displayHeight = sprite.rect.displayHeight

    return this.scene.isPerspective ? sprite.rect.y - displayHeight : sprite.rect.y - displayHeight / 2
  }

  positionSprite(sprite: EntitySprite, worldColumn: number, _id = '') {
    const projection = this.scene.projection

    if (!projection) {
      return
    }

    const point = projection.gridToScreen(sprite.row, worldColumn)

    sprite.columnFloat = worldColumn

    // offsetX (lunge/recoil/né) tính bằng px chuẩn hóa ở hàng gần — nhân
    // depth scale để đòn đánh ở xa cũng đúng tỷ lệ phối cảnh. Walk sway/
    // bob/tilt ĐÃ XÓA HẾN (2026-08-26): di chuyển bình thường luôn đặt
    // sprite tại tọa độ chiếu thẳng, rotation 0 (chỉ death tween xoay).
    const screenX = point.x + sprite.offsetX * point.scale
    const screenY = point.y

    if (this.scene.isPerspective) {
      this.scene.applyEntityDepthScale(sprite, point.scale)

      // Foot anchor: origin (0.5, 1) đặt tại điểm chân đất của ô.
      sprite.rect.setPosition(screenX, screenY)
      sprite.shadow?.setPosition(screenX, point.y)
      sprite.footY = point.y
      sprite.label.setPosition(screenX, point.y + 6)
    } else {
      // Flat giữ nguyên từng pixel hành vi legacy (center anchor); boost
      // Chí Mạng áp qua setScale vì geometry flat là tĩnh. setScale PHẢI
      // chạy vô điều kiện: tween yoyo kết thúc giữa 2 frame, frame kế
      // value===1 nhưng rect vẫn giữ scale frame trước nếu bỏ qua.
      sprite.rect.setPosition(screenX, screenY)
      sprite.rect.setScale(sprite.boost.value)
      sprite.label.setPosition(screenX, point.y + sprite.rect.displayHeight / 2 + 4)
    }

    if (sprite.healthBar) {
      const headY = this.scene.entityHeadY(sprite) - ENEMY_HP_BAR_OFFSET_Y

      sprite.healthBar.background.setPosition(screenX, headY)
      sprite.healthBar.fill.setPosition(screenX - sprite.healthBar.width / 2, headY)
    }
  }

  getOrCreateSprite(
    id: string,
    color: number,
    labelText: string,
    row: LaneIndex = HERO_LANE_INDEX,
    health?: { currentHp: number; maxHp: number; isBoss: boolean },
  ): EntitySprite {
    const existing = this.scene.sprites.get(id)

    if (existing) {
      return existing
    }

    const label = this.scene.add
      .text(0, 0, labelText, { fontSize: '14px', color: '#ffffff' })
      .setOrigin(0.5, 0)
      .setDepth(DEPTH_OVERLAY_UI + 1)

    // Player dùng artwork theo PROFILE hiện hành (body-anchor plan §4.3);
    // enemy chưa có atlas riêng, vẫn dùng Rectangle màu như cũ (xem
    // EntitySprite.kind's ghi chú).
    if (id === PLAYER_ID) {
      const textureKey = this.scene.textures.exists(this.scene.playerProfile.combatTextureKey)
        ? this.scene.playerProfile.combatTextureKey
        : PLAYER_TEXTURE_KEY

      const gameSprite = this.scene.add.sprite(0, 0, textureKey)

      this.scene.physics.add.existing(gameSprite)

      if (this.scene.isPerspective) {
        gameSprite.setOrigin(0.5, 1)
      }

      const sprite: EntitySprite = {
        kind: 'sprite',
        rect: gameSprite,
        label,
        color,
        offsetX: 0,
        row,
        sizeMultiplier: PLAYER_DISPLAY_SCALE_MULTIPLIER,
        boost: { value: 1 },
        footY: 0,
        columnFloat: 0,
      }

      if (this.scene.isPerspective) {
        sprite.shadow = this.scene.add
          .ellipse(0, 0, 10, 4, SHADOW_COLOR, SHADOW_ALPHA)
          .setDepth(DEPTH_ENTITY_SHADOW)
      }

      this.scene.applySpriteSize(sprite)
      this.scene.sprites.set(id, sprite)

      return sprite
    }

    // Enemy: Sprite art batch Mortal khi có texture khớp id (mortal-
    // enemy-art-batch-plan.md), fallback Rectangle màu cho id ngoài
    // batch (test fixture / realm khác chưa có art).
    const enemyTextureKey = resolveEnemyTextureKey(id)

    if (enemyTextureKey && this.scene.textures.exists(enemyTextureKey)) {
      const gameSprite = this.scene.add.sprite(0, 0, enemyTextureKey)

      this.scene.physics.add.existing(gameSprite)

      if (this.scene.isPerspective) {
        gameSprite.setOrigin(0.5, 1)
      }

      const healthBarWidth = this.scene.characterWidth * (health?.isBoss ? 1.45 : 1.05)
      const background = this.scene.add
        .rectangle(0, 0, healthBarWidth, ENEMY_HP_BAR_HEIGHT, ENEMY_HP_BG_COLOR)
        .setOrigin(0.5)
        .setStrokeStyle(1, health?.isBoss ? BOSS_HP_FILL_COLOR : 0x6b4545)
        .setDepth(DEPTH_OVERLAY_UI + 2)
      const fill = this.scene.add
        .rectangle(
          0,
          0,
          healthBarWidth,
          ENEMY_HP_BAR_HEIGHT - 2,
          health?.isBoss ? BOSS_HP_FILL_COLOR : ENEMY_HP_FILL_COLOR,
        )
        .setOrigin(0, 0.5)
        .setDepth(DEPTH_OVERLAY_UI + 2)
      const healthBar: EnemyHealthBar = {
        background,
        fill,
        width: healthBarWidth,
        currentHp: health?.currentHp ?? 1,
        maxHp: health?.maxHp ?? 1,
        isBoss: health?.isBoss ?? false,
      }

      const sprite: EntitySprite = {
        kind: 'sprite',
        rect: gameSprite,
        label,
        color,
        offsetX: 0,
        row,
        sourceSize: { ...ENEMY_SOURCE_SIZE },
        // Enemy art x2; Boss ×2 quy tắc enemy thường (2026-09-05) — không
        // còn dùng CÙNG multiplier như trước (xem
        // CombatScene.enemyScale.test.ts). Bóng ellipse dưới chân nhân
        // theo cùng multiplier trong applyEntityDepthScale().
        sizeMultiplier: health?.isBoss ? BOSS_DISPLAY_SCALE_MULTIPLIER : ENEMY_DISPLAY_SCALE_MULTIPLIER,
        boost: { value: 1 },
        footY: 0,
        columnFloat: 0,
        healthBar,
      }

      if (this.scene.isPerspective) {
        sprite.shadow = this.scene.add
          .ellipse(0, 0, 10, 4, SHADOW_COLOR, SHADOW_ALPHA)
          .setDepth(DEPTH_ENTITY_SHADOW)
      }

      this.scene.sprites.set(id, sprite)
      this.scene.applySpriteSize(sprite)
      this.scene.updateEnemyHealthBar(sprite, healthBar.currentHp, healthBar.maxHp)

      return sprite
    }

    const rect = this.scene.add
      .rectangle(0, 0, this.scene.characterWidth, this.scene.characterHeight, color)
      .setOrigin(0.5)

    this.scene.physics.add.existing(rect)

    // Quái hiện vẫn là Rectangle màu (chưa có atlas định hướng) — khi
    // có sprite riêng chỉ cần setFlipX(true) ở đây, không cần spritesheet
    // mới cho chiều ngược (plan: flip bằng Phaser).
    if (this.scene.isPerspective) {
      rect.setOrigin(0.5, 1)
    }

    const healthBarWidth = this.scene.characterWidth * (health?.isBoss ? 1.45 : 1.05)
    const background = this.scene.add
      .rectangle(0, 0, healthBarWidth, ENEMY_HP_BAR_HEIGHT, ENEMY_HP_BG_COLOR)
      .setOrigin(0.5)
      .setStrokeStyle(1, health?.isBoss ? BOSS_HP_FILL_COLOR : 0x6b4545)
      .setDepth(DEPTH_OVERLAY_UI + 2)
    const fill = this.scene.add
      .rectangle(
        0,
        0,
        healthBarWidth,
        ENEMY_HP_BAR_HEIGHT - 2,
        health?.isBoss ? BOSS_HP_FILL_COLOR : ENEMY_HP_FILL_COLOR,
      )
      .setOrigin(0, 0.5)
      .setDepth(DEPTH_OVERLAY_UI + 2)
    const healthBar: EnemyHealthBar = {
      background,
      fill,
      width: healthBarWidth,
      currentHp: health?.currentHp ?? 1,
      maxHp: health?.maxHp ?? 1,
      isBoss: health?.isBoss ?? false,
    }

    const sprite: EntitySprite = {
      kind: 'rect',
      rect,
      label,
      color,
      offsetX: 0,
      row,
      // Fallback Rectangle: giữ nguyên size 1 cho quái thường (chưa có art) để
      // không đổi hình ảnh hiện tại; nhưng Boss vẫn phải to hơn quái thường dù
      // rơi vào nhánh fallback — nếu không sẽ NHỎ HƠN quái thường có texture
      // (2x), ngược hẳn ý đồ "Boss to hơn" (review round 1, task 9.5).
      sizeMultiplier: health?.isBoss ? BOSS_DISPLAY_SCALE_MULTIPLIER : 1,
      boost: { value: 1 },
      footY: 0,
      columnFloat: 0,
      healthBar,
    }

    if (this.scene.isPerspective) {
      sprite.shadow = this.scene.add
        .ellipse(0, 0, 10, 4, SHADOW_COLOR, SHADOW_ALPHA)
        .setDepth(DEPTH_ENTITY_SHADOW)
    }

    this.scene.sprites.set(id, sprite)
    this.scene.updateEnemyHealthBar(sprite, healthBar.currentHp, healthBar.maxHp)

    return sprite
  }

  updateEnemyHealthBar(sprite: EntitySprite, currentHp: number, maxHp: number) {
    const healthBar = sprite.healthBar

    if (!healthBar) {
      return
    }

    healthBar.currentHp = currentHp
    healthBar.maxHp = maxHp

    const ratio = maxHp > 0 ? Phaser.Math.Clamp(currentHp / maxHp, 0, 1) : 0

    healthBar.fill.setScale(ratio, 1)
  }

  destroyEntitySprite(sprite: EntitySprite) {
    sprite.shadow?.destroy()
    sprite.healthBar?.background.destroy()
    sprite.healthBar?.fill.destroy()
    sprite.label.destroy()
    sprite.rect.destroy()
  }

  updateEntityDepths() {
    for (const [id, sprite] of this.scene.sprites) {
      sprite.rect.setDepth(
        entitySpriteDepth(
          sprite.footY,
          this.scene.entityFootMinY,
          this.scene.entityFootMaxY,
          sprite.columnFloat,
          id,
        ),
      )
    }
  }

  resetVisual(sprite: EntitySprite) {
    this.scene.tweens.killTweensOf(sprite.rect)
    this.scene.tweens.killTweensOf(sprite)
    this.scene.tweens.killTweensOf(sprite.boost)

    sprite.rect.setAlpha(1)
    sprite.rect.setRotation(0)
    sprite.rect.setScale(1)
    sprite.label.setAlpha(1)
    sprite.shadow?.setAlpha(SHADOW_ALPHA)

    if (sprite.kind === 'sprite') {
      const gameSprite = sprite.rect as Phaser.GameObjects.Sprite

      gameSprite.clearTint()
      this.scene.applySpriteSize(sprite)
    } else {
      const rect = sprite.rect as Phaser.GameObjects.Rectangle

      rect.setFillStyle(sprite.color)
    }

    if (sprite.healthBar) {
      sprite.healthBar.background.setAlpha(1)
      sprite.healthBar.fill.setAlpha(1)
    }

    sprite.boost.value = 1
    sprite.offsetX = 0

    // Kích thước/foot point áp lại ngay để không chờ frame kế (reset
    // hiện chỉ dùng cho player).
    this.scene.applySpriteSize(sprite)

    if (sprite === this.scene.sprites.get(PLAYER_ID)) {
      const entry = this.scene.interpolations.get(PLAYER_ID)

      if (entry) {
        this.scene.positionSprite(sprite, entry.toX, PLAYER_ID)
      }
    }
  }
}
