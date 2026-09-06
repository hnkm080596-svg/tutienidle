// combat-grid-view (ui-discoverability-refactor-plan.md Â§3.2) â€” tÃ¡ch tá»«
// CombatScene.ts: 2.5D GRID PROJECTION, depth layers, entity sprite
// lifecycle/size/position. Module nháº­n dependency tÆ°á»ng minh qua `scene`
// â€” má»i cross-call Ä‘i qua scene delegate Ä‘á»ƒ giá»¯ seam test.
import Phaser from 'phaser'

import type { LaneIndex } from '@/core/battle/BattleLane'
import { GRID_ROW_COUNT, GRID_COLUMN_COUNT, HERO_COLUMN, HERO_LANE_INDEX } from '@/core/battle/BattleLane'
import { toVector2Points } from '@/game/support/ActionImpactVfx'
import { ENEMY_SOURCE_SIZE, resolveEnemyTextureKey } from '@/game/support/EnemyArt'
import { PLAYER_TEXTURE_KEY } from '@/game/support/CombatPreload'
import { DEPTH_ENTITY_SHADOW, DEPTH_OVERLAY_UI, entitySpriteDepth } from '@/game/support/BattleLayers'

import type { CombatGridViewHost } from './CombatGridViewHost'
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

// BÃ³ng ellipse dÆ°á»›i chÃ¢n â€” dáº¹t theo trá»¥c sÃ¢u (copy tá»« CombatScene).
const SHADOW_WIDTH_RATIO = 1.12
const SHADOW_HEIGHT_RATIO = 0.34

export class CombatGridView {
  constructor(private readonly host: CombatGridViewHost) {}

  redrawGridLines() {
    const graphics = this.host.gridGraphics
    const projection = this.host.projection

    if (!graphics || !projection) {
      return
    }

    graphics.clear()

    // Thanh VÃ¢n art mount (yÃªu cáº§u 2026-08-26) â€” art Ä‘Ã£ cÃ³ battle-ground
    // riÃªng ("No layer contains a battle grid") nÃªn KHÃ”NG váº½ Ä‘Æ°á»ng chia Ã´
    // Ä‘Ã¨ lÃªn; giá»¯ grid Ä‘á»™ng cho flat mode dev fallback.
    if (this.host.usingArtBackdrop) {
      return
    }

    const isFlat = Boolean(this.host.arenaRect)

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
      // Viá»n ngoÃ i + vÃ¹ng cá»•ng hero nháº¥n nháº¹ mÃ u phe ta.
      const corners = [
        projection.gridToScreen(-0.5, -0.5),
        projection.gridToScreen(-0.5, GRID_COLUMN_COUNT - 0.5),
        projection.gridToScreen(GRID_ROW_COUNT - 0.5, GRID_COLUMN_COUNT - 0.5),
        projection.gridToScreen(GRID_ROW_COUNT - 0.5, -0.5),
      ]

      graphics.lineStyle(1.5, PERSPECTIVE_BORDER_COLOR, PERSPECTIVE_BORDER_ALPHA)
      graphics.strokePoints(toVector2Points(corners), true, true)

      // Cá»•ng phÃ²ng thá»§ phá»§ Má»ŒI hÃ ng Táº I Cá»˜NG cá»•ng (plan Â§2.2).
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

  // Rectangle (enemy) cáº§n width/height + updateDisplayOrigin() (mutate
  // geometry trá»±c tiáº¿p); Sprite (player) cáº§n setDisplaySize() vá»›i Tá»ˆ Lá»†
  // ÄÃšNG cá»§a artwork gá»‘c (playerSourceSize theo profile hiá»‡n hÃ nh â€”
  // body-anchor plan Â§4.3), náº¿u khÃ´ng nhÃ¢n váº­t sáº½ mÃ©o hÃ¬nh khi Ã©p cÃ¹ng
  // characterWidth/Height hÃ¬nh vuÃ´ng-ish cá»§a enemy.
  //
  // Perspective: baseline chá»‰ lÃ  kÃ­ch thÆ°á»›c á»Ÿ hÃ ng hiá»‡n hÃ nh â€” co giÃ£n
  // theo chiá»u sÃ¢u diá»…n ra trong applyEntityDepthScale() má»—i láº§n chiáº¿u.
  applySpriteSize(sprite: EntitySprite) {
    if (this.host.isPerspective && this.host.projection) {
      this.applyEntityDepthScale(sprite, this.host.projection.gridToScreen(sprite.row, 0).scale)

      return
    }

    if (sprite.kind === 'sprite') {
      const width =
        this.host.characterHeight *
        sprite.sizeMultiplier *
        ((sprite.sourceSize ?? this.host.playerSourceSize).w / (sprite.sourceSize ?? this.host.playerSourceSize).h)
      const gameSprite = sprite.rect as Phaser.GameObjects.Sprite

      gameSprite.setDisplaySize(width, this.host.characterHeight * sprite.sizeMultiplier)

      return
    }

    const rect = sprite.rect as Phaser.GameObjects.Rectangle

    rect.width = this.host.characterWidth
    rect.height = this.host.characterHeight
    rect.updateDisplayOrigin()

    if (sprite.healthBar) {
      const width = this.host.characterWidth * (sprite.healthBar.isBoss ? 1.45 : 1.05)

      sprite.healthBar.width = width
      sprite.healthBar.background.setSize(width, ENEMY_HP_BAR_HEIGHT).updateDisplayOrigin()
      sprite.healthBar.fill.setSize(width, ENEMY_HP_BAR_HEIGHT - 2).updateDisplayOrigin()
      this.updateEnemyHealthBar(sprite, sprite.healthBar.currentHp, sprite.healthBar.maxHp)
    }
  }

  /**
   * Ãp scale chiá»u sÃ¢u cho entity: kÃ­ch thÆ°á»›c = baseline Ã— depthScale Ã—
   * sizeMultiplier (player Ã—2, enemy PNG Ã—2 â€” multiplier NHÃ‚N Má»˜T Láº¦N
   * duy nháº¥t táº¡i Ä‘Ã¢y, khÃ´ng cá»™ng dá»“n qua resize/tween) Ã— boost (pop ChÃ­
   * Máº¡ng/spawn fade-in), ghi vÃ o GEOMETRY/scale cá»§a GameObject nÃªn tween
   * cÅ© váº«n hoáº¡t Ä‘á»™ng; bÃ³ng ellipse dÆ°á»›i chÃ¢n co giÃ£n theo.
   */
  applyEntityDepthScale(sprite: EntitySprite, depthScale: number) {
    const effectiveScale = Math.max(0.05, depthScale * sprite.boost.value)
    const multiplier = sprite.sizeMultiplier

    if (sprite.kind === 'sprite') {
      const height = this.host.characterHeight * effectiveScale * multiplier
      const gameSprite = sprite.rect as Phaser.GameObjects.Sprite

      gameSprite.setDisplaySize(height * ((sprite.sourceSize ?? this.host.playerSourceSize).w / (sprite.sourceSize ?? this.host.playerSourceSize).h), height)
    } else {
      const rect = sprite.rect as Phaser.GameObjects.Rectangle

      rect.width = this.host.characterWidth * effectiveScale
      rect.height = this.host.characterHeight * effectiveScale
      rect.updateDisplayOrigin()

      if (sprite.healthBar) {
        const barWidth =
          this.host.characterWidth * effectiveScale * (sprite.healthBar.isBoss ? 1.45 : 1.05)

        sprite.healthBar.width = barWidth
        sprite.healthBar.background.setSize(barWidth, ENEMY_HP_BAR_HEIGHT).updateDisplayOrigin()
        sprite.healthBar.fill.setSize(barWidth, ENEMY_HP_BAR_HEIGHT - 2).updateDisplayOrigin()
        this.updateEnemyHealthBar(sprite, sprite.healthBar.currentHp, sprite.healthBar.maxHp)
      }
    }

    if (sprite.shadow) {
      const shadowWidth = this.host.characterWidth * effectiveScale * multiplier * SHADOW_WIDTH_RATIO

      sprite.shadow.setSize(shadowWidth, shadowWidth * SHADOW_HEIGHT_RATIO)
    }
  }

  // Äá»‰nh Ä‘áº§u sprite theo anchor hiá»‡n hÃ nh â€” má»i chrome treo trÃªn Ä‘áº§u
  // (HP bar / cast bar / DOT icon / text bay) Ä‘i qua Ä‘Ã¢y Ä‘á»ƒ khÃ´ng phá»¥
  // thuá»™c origin (foot anchor á»Ÿ perspective, center anchor á»Ÿ flat).
  entityHeadY(sprite: EntitySprite): number {
    const displayHeight = sprite.rect.displayHeight

    return this.host.isPerspective ? sprite.rect.y - displayHeight : sprite.rect.y - displayHeight / 2
  }

  positionSprite(sprite: EntitySprite, worldColumn: number, _id = '') {
    const projection = this.host.projection

    if (!projection) {
      return
    }

    const point = projection.gridToScreen(sprite.row, worldColumn)

    sprite.columnFloat = worldColumn

    // offsetX (lunge/recoil/nÃ©) tÃ­nh báº±ng px chuáº©n hÃ³a á»Ÿ hÃ ng gáº§n â€” nhÃ¢n
    // depth scale Ä‘á»ƒ Ä‘Ã²n Ä‘Ã¡nh á»Ÿ xa cÅ©ng Ä‘Ãºng tá»· lá»‡ phá»‘i cáº£nh. Walk sway/
    // bob/tilt ÄÃƒ XÃ“A Háº¾N (2026-08-26): di chuyá»ƒn bÃ¬nh thÆ°á»ng luÃ´n Ä‘áº·t
    // sprite táº¡i tá»a Ä‘á»™ chiáº¿u tháº³ng, rotation 0 (chá»‰ death tween xoay).
    const screenX = point.x + sprite.offsetX * point.scale
    const screenY = point.y

    if (this.host.isPerspective) {
      this.applyEntityDepthScale(sprite, point.scale)

      // Foot anchor: origin (0.5, 1) Ä‘áº·t táº¡i Ä‘iá»ƒm chÃ¢n Ä‘áº¥t cá»§a Ã´.
      sprite.rect.setPosition(screenX, screenY)
      sprite.shadow?.setPosition(screenX, point.y)
      sprite.footY = point.y
      sprite.label.setPosition(screenX, point.y + 6)
    } else {
      // Flat giá»¯ nguyÃªn tá»«ng pixel hÃ nh vi legacy (center anchor); boost
      // ChÃ­ Máº¡ng Ã¡p qua setScale vÃ¬ geometry flat lÃ  tÄ©nh. setScale PHáº¢I
      // cháº¡y vÃ´ Ä‘iá»u kiá»‡n: tween yoyo káº¿t thÃºc giá»¯a 2 frame, frame káº¿
      // value===1 nhÆ°ng rect váº«n giá»¯ scale frame trÆ°á»›c náº¿u bá» qua.
      sprite.rect.setPosition(screenX, screenY)
      sprite.rect.setScale(sprite.boost.value)
      sprite.label.setPosition(screenX, point.y + sprite.rect.displayHeight / 2 + 4)
    }

    if (sprite.healthBar) {
      const headY = this.entityHeadY(sprite) - ENEMY_HP_BAR_OFFSET_Y

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
    const existing = this.host.sprites.get(id)

    if (existing) {
      return existing
    }

    const label = this.host.add
      .text(0, 0, labelText, { fontSize: '14px', color: '#ffffff' })
      .setOrigin(0.5, 0)
      .setDepth(DEPTH_OVERLAY_UI + 1)

    // Player dÃ¹ng artwork theo PROFILE hiá»‡n hÃ nh (body-anchor plan Â§4.3);
    // enemy chÆ°a cÃ³ atlas riÃªng, váº«n dÃ¹ng Rectangle mÃ u nhÆ° cÅ© (xem
    // EntitySprite.kind's ghi chÃº).
    if (id === PLAYER_ID) {
      const textureKey = this.host.textures.exists(this.host.playerProfile.combatTextureKey)
        ? this.host.playerProfile.combatTextureKey
        : PLAYER_TEXTURE_KEY

      const gameSprite = this.host.add.sprite(0, 0, textureKey)

      this.host.physics.add.existing(gameSprite)

      if (this.host.isPerspective) {
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

      if (this.host.isPerspective) {
        sprite.shadow = this.host.add
          .ellipse(0, 0, 10, 4, SHADOW_COLOR, SHADOW_ALPHA)
          .setDepth(DEPTH_ENTITY_SHADOW)
      }

      this.applySpriteSize(sprite)
      this.host.sprites.set(id, sprite)

      return sprite
    }

    // Enemy: Sprite art batch Mortal khi cÃ³ texture khá»›p id (mortal-
    // enemy-art-batch-plan.md), fallback Rectangle mÃ u cho id ngoÃ i
    // batch (test fixture / realm khÃ¡c chÆ°a cÃ³ art).
    const enemyTextureKey = resolveEnemyTextureKey(id)

    if (enemyTextureKey && this.host.textures.exists(enemyTextureKey)) {
      const gameSprite = this.host.add.sprite(0, 0, enemyTextureKey)

      this.host.physics.add.existing(gameSprite)

      if (this.host.isPerspective) {
        gameSprite.setOrigin(0.5, 1)
      }

      const healthBarWidth = this.host.characterWidth * (health?.isBoss ? 1.45 : 1.05)
      const background = this.host.add
        .rectangle(0, 0, healthBarWidth, ENEMY_HP_BAR_HEIGHT, ENEMY_HP_BG_COLOR)
        .setOrigin(0.5)
        .setStrokeStyle(1, health?.isBoss ? BOSS_HP_FILL_COLOR : 0x6b4545)
        .setDepth(DEPTH_OVERLAY_UI + 2)
      const fill = this.host.add
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
        // Enemy art x2; Boss Ã—2 quy táº¯c enemy thÆ°á»ng (2026-09-05) â€” khÃ´ng
        // cÃ²n dÃ¹ng CÃ™NG multiplier nhÆ° trÆ°á»›c (xem
        // CombatScene.enemyScale.test.ts). BÃ³ng ellipse dÆ°á»›i chÃ¢n nhÃ¢n
        // theo cÃ¹ng multiplier trong applyEntityDepthScale().
        sizeMultiplier: health?.isBoss ? BOSS_DISPLAY_SCALE_MULTIPLIER : ENEMY_DISPLAY_SCALE_MULTIPLIER,
        boost: { value: 1 },
        footY: 0,
        columnFloat: 0,
        healthBar,
      }

      if (this.host.isPerspective) {
        sprite.shadow = this.host.add
          .ellipse(0, 0, 10, 4, SHADOW_COLOR, SHADOW_ALPHA)
          .setDepth(DEPTH_ENTITY_SHADOW)
      }

      this.host.sprites.set(id, sprite)
      this.applySpriteSize(sprite)
      this.updateEnemyHealthBar(sprite, healthBar.currentHp, healthBar.maxHp)

      return sprite
    }

    // Host fallback (Battlefield Slot spec §4) — combat thật trả undefined
    // ở đây LUÔN (xem CombatScene.fallbackSpriteTextureKey()), giữ nguyên
    // 100% hành vi Rectangle fallback cho enemy ngoài batch Mortal. Panel
    // Trận Pháp (TranPhapCombatPreviewScene) trả về sheet placeholder
    // dùng chung — mọi combatant của panel render qua nhánh này, animate
    // được thay vì Rectangle tĩnh.
    const fallbackTextureKey = this.host.fallbackSpriteTextureKey(id)

    if (fallbackTextureKey && this.host.textures.exists(fallbackTextureKey)) {
      const gameSprite = this.host.add.sprite(0, 0, fallbackTextureKey)

      this.host.physics.add.existing(gameSprite)

      if (this.host.isPerspective) {
        gameSprite.setOrigin(0.5, 1)
      }

      const sprite: EntitySprite = {
        kind: 'sprite',
        rect: gameSprite,
        label,
        color,
        offsetX: 0,
        row,
        // sizeMultiplier: 1 (KHÔNG ENEMY_DISPLAY_SCALE_MULTIPLIER) — nhánh
        // này chỉ có panel Trận Pháp chạm tới (combat thật luôn nhận
        // fallbackSpriteTextureKey() === undefined, xem branch trước đó);
        // panel tự set characterWidth/Height BẰNG ĐÚNG kích thước sprite
        // mong muốn (0.8 × cell, xem TranPhapCombatPreviewScene, Task 4) —
        // applySpriteSize()'s flat formula là characterHeight ×
        // sizeMultiplier, nên multiplier phải là 1 để không nhân đôi kích
        // thước đã tính sẵn.
        sizeMultiplier: 1,
        boost: { value: 1 },
        footY: 0,
        columnFloat: 0,
      }

      if (this.host.isPerspective) {
        sprite.shadow = this.host.add
          .ellipse(0, 0, 10, 4, SHADOW_COLOR, SHADOW_ALPHA)
          .setDepth(DEPTH_ENTITY_SHADOW)
      }

      this.host.sprites.set(id, sprite)
      this.applySpriteSize(sprite)

      return sprite
    }

    const rect = this.host.add
      .rectangle(0, 0, this.host.characterWidth, this.host.characterHeight, color)
      .setOrigin(0.5)

    this.host.physics.add.existing(rect)

    // QuÃ¡i hiá»‡n váº«n lÃ  Rectangle mÃ u (chÆ°a cÃ³ atlas Ä‘á»‹nh hÆ°á»›ng) â€” khi
    // cÃ³ sprite riÃªng chá»‰ cáº§n setFlipX(true) á»Ÿ Ä‘Ã¢y, khÃ´ng cáº§n spritesheet
    // má»›i cho chiá»u ngÆ°á»£c (plan: flip báº±ng Phaser).
    if (this.host.isPerspective) {
      rect.setOrigin(0.5, 1)
    }

    const healthBarWidth = this.host.characterWidth * (health?.isBoss ? 1.45 : 1.05)
    const background = this.host.add
      .rectangle(0, 0, healthBarWidth, ENEMY_HP_BAR_HEIGHT, ENEMY_HP_BG_COLOR)
      .setOrigin(0.5)
      .setStrokeStyle(1, health?.isBoss ? BOSS_HP_FILL_COLOR : 0x6b4545)
      .setDepth(DEPTH_OVERLAY_UI + 2)
    const fill = this.host.add
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
      // Fallback Rectangle: giá»¯ nguyÃªn size 1 cho quÃ¡i thÆ°á»ng (chÆ°a cÃ³ art) Ä‘á»ƒ
      // khÃ´ng Ä‘á»•i hÃ¬nh áº£nh hiá»‡n táº¡i; nhÆ°ng Boss váº«n pháº£i to hÆ¡n quÃ¡i thÆ°á»ng dÃ¹
      // rÆ¡i vÃ o nhÃ¡nh fallback â€” náº¿u khÃ´ng sáº½ NHá»Ž HÆ N quÃ¡i thÆ°á»ng cÃ³ texture
      // (2x), ngÆ°á»£c háº³n Ã½ Ä‘á»“ "Boss to hÆ¡n" (review round 1, task 9.5).
      sizeMultiplier: health?.isBoss ? BOSS_DISPLAY_SCALE_MULTIPLIER : 1,
      boost: { value: 1 },
      footY: 0,
      columnFloat: 0,
      healthBar,
    }

    if (this.host.isPerspective) {
      sprite.shadow = this.host.add
        .ellipse(0, 0, 10, 4, SHADOW_COLOR, SHADOW_ALPHA)
        .setDepth(DEPTH_ENTITY_SHADOW)
    }

    this.host.sprites.set(id, sprite)
    this.updateEnemyHealthBar(sprite, healthBar.currentHp, healthBar.maxHp)

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
    for (const [id, sprite] of this.host.sprites) {
      sprite.rect.setDepth(
        entitySpriteDepth(
          sprite.footY,
          this.host.entityFootMinY,
          this.host.entityFootMaxY,
          sprite.columnFloat,
          id,
        ),
      )
    }
  }

  resetVisual(sprite: EntitySprite) {
    this.host.tweens.killTweensOf(sprite.rect)
    this.host.tweens.killTweensOf(sprite)
    this.host.tweens.killTweensOf(sprite.boost)

    sprite.rect.setAlpha(1)
    sprite.rect.setRotation(0)
    sprite.rect.setScale(1)
    sprite.label.setAlpha(1)
    sprite.shadow?.setAlpha(SHADOW_ALPHA)

    if (sprite.kind === 'sprite') {
      const gameSprite = sprite.rect as Phaser.GameObjects.Sprite

      gameSprite.clearTint()
      this.applySpriteSize(sprite)
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

    // KÃ­ch thÆ°á»›c/foot point Ã¡p láº¡i ngay Ä‘á»ƒ khÃ´ng chá» frame káº¿ (reset
    // hiá»‡n chá»‰ dÃ¹ng cho player).
    this.applySpriteSize(sprite)

    if (sprite === this.host.sprites.get(PLAYER_ID)) {
      // PositionInterpolation (không unknown) — resetVisual chỉ đọc toX;
      // CombatScene thật giữ Map<string, PositionInterpolation>, panel
      // giữ Map rỗng (get luôn undefined, block này không chạy).
      const entry = this.host.interpolations.get(PLAYER_ID) as
        | { toX: number }
        | undefined

      if (entry) {
        this.positionSprite(sprite, entry.toX, PLAYER_ID)
      }
    }
  }
}
