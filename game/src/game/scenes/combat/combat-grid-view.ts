// combat-grid-view (ui-discoverability-refactor-plan.md Â§3.2) â€” tÃ¡ch tá»«
// CombatScene.ts: 2.5D GRID PROJECTION, depth layers, entity sprite
// lifecycle/size/position. Module nháº­n dependency tÆ°á»ng minh qua `scene`
// â€” má»i cross-call Ä‘i qua scene delegate Ä‘á»ƒ giá»¯ seam test.
import Phaser from 'phaser'

import type { LaneIndex } from '@/core/battle/BattleLane'
import { HERO_LANE_INDEX } from '@/core/battle/BattleLane'
import { toVector2Points } from '@/game/support/ActionImpactVfx'
import { ENEMY_SOURCE_SIZE, resolveEnemyTextureKey } from '@/game/support/EnemyArt'
import { PLAYER_TEXTURE_KEY } from '@/game/support/CombatPreload'
import {
  atlasFrameName,
  PLACEHOLDER_ENTITY_KEY,
  presentationFor,
} from '@/presentation/art/CombatPresentationCatalogue'
import { resolveEntityDisplaySize } from '@/presentation/geometry/combatEntityScale'
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
  PLAYER_DISPLAY_SCALE_MULTIPLIER,
  PLAYER_ID,
  SHADOW_ALPHA,
  SHADOW_COLOR,
} from './combatConstants'
import type { EnemyHealthBar, EntitySprite } from './combatTypes'

/**
 * The untrimmed box the player's art is authored in.
 *
 * An ANIMATED entity draws atlas frames, so its size must come from the clip's
 * `sourceSize`, not from the entity's static PNG. A static entity keeps its
 * texture's own size. `undefined` falls back to `host.playerSourceSize`, which
 * is what a profile with no catalogue entry gets — the pre-existing behaviour.
 */
function playerArtSourceSize(entityKey: string): { w: number; h: number } | undefined {
  const presentation = presentationFor(entityKey)

  if (presentation?.kind === 'animated') {
    return { ...presentation.clips.idle.sourceSize }
  }

  if (presentation?.kind === 'static') {
    return { ...presentation.texture.sourceSize }
  }

  return undefined
}

/** The art's own box inside its authored frame, for the entity being drawn. */
function artExtentFor(entityKey: string): { x: number; y: number; w: number; h: number } | undefined {
  const presentation = presentationFor(entityKey)

  if (presentation?.kind === 'animated') {
    return { ...presentation.clips.idle.extent }
  }

  if (presentation?.kind === 'static') {
    return { ...presentation.texture.extent }
  }

  return undefined
}

/**
 * Start phase for one entity's idle bob, in ms within its own cycle.
 *
 * A PLAIN rolling hash is not enough here, and that is a measured fact rather
 * than a precaution: runtime enemy ids share a long template prefix and differ
 * only in their tail, so `hash * 31 + char` leaves adjacent ids one apart, and
 * one part in 100000 of a 2.2s period rounds to the same millisecond. Two wolves
 * spawned in a row then breathe in perfect lockstep — the exact failure the
 * jitter exists to prevent.
 *
 * The finalizer below (xorshift-multiply, as in MurmurHash3's avalanche) makes a
 * one-character difference change the whole value.
 */
function phaseDelayMs(id: string, periodMs: number): number {
  let hash = 0

  for (let index = 0; index < id.length; index++) {
    hash = (Math.imul(hash, 31) + id.charCodeAt(index)) | 0
  }

  hash ^= hash >>> 16
  hash = Math.imul(hash, 0x85ebca6b)
  hash ^= hash >>> 13

  return Math.abs(hash) % Math.max(1, Math.round(periodMs))
}

// BÃ³ng ellipse dÆ°á»›i chÃ¢n â€” dáº¹t theo trá»¥c sÃ¢u (copy tá»« CombatScene).
const SHADOW_WIDTH_RATIO = 1.12
const SHADOW_HEIGHT_RATIO = 0.34

/**
 * Synthetic extent for a Rectangle-fallback entity — it has no authored art
 * box, so its anchors are sized as if the art filled the whole box (Finding 1,
 * final whole-branch review). Only `personWidth`/`personHeight` are read from
 * the result; `boxWidth`/`boxHeight` are discarded since Rectangle DRAWING
 * stays on its own pre-existing formula (see the comment at each call site).
 */
const RECT_ANCHOR_EXTENT: NonNullable<EntitySprite['extent']> = { x: 0, y: 0, w: 1, h: 1 }

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

    for (let boundaryRow = 0; boundaryRow <= projection.rows; boundaryRow++) {
      const rowFloat = boundaryRow - 0.5
      const left = projection.gridToScreen(rowFloat, -0.5)
      const right = projection.gridToScreen(rowFloat, projection.columns - 0.5)

      graphics.beginPath()
      graphics.moveTo(left.x, left.y)
      graphics.lineTo(right.x, right.y)
      graphics.strokePath()
    }

    for (let boundaryColumn = 0; boundaryColumn <= projection.columns; boundaryColumn++) {
      const columnFloat = boundaryColumn - 0.5
      const far = projection.gridToScreen(-0.5, columnFloat)
      const near = projection.gridToScreen(projection.rows - 0.5, columnFloat)

      graphics.beginPath()
      graphics.moveTo(far.x, far.y)
      graphics.lineTo(near.x, near.y)
      graphics.strokePath()
    }

    if (!isFlat) {
      // Viá»n ngoÃ i + vÃ¹ng cá»•ng hero nháº¥n nháº¹ mÃ u phe ta.
      const corners = [
        projection.gridToScreen(-0.5, -0.5),
        projection.gridToScreen(-0.5, projection.columns - 0.5),
        projection.gridToScreen(projection.rows - 0.5, projection.columns - 0.5),
        projection.gridToScreen(projection.rows - 0.5, -0.5),
      ]

      graphics.lineStyle(1.5, PERSPECTIVE_BORDER_COLOR, PERSPECTIVE_BORDER_ALPHA)
      graphics.strokePoints(toVector2Points(corners), true, true)

      // Viền ngoài lưới perspective — dùng chung cho combat thật lẫn panel.
      // (Cổng phòng thủ HERO_COLUMN đã XÓA 2026-09-06: obsolete, cơ chế
      // real-time cũ "quái tiếp cận cổng" không còn tồn tại dưới turn-based.)
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
  /**
   * Spec C §4.3 — one place that turns a sprite into a size.
   *
   * `sizeMultiplier` is the OLD field and keeps its stored values (2 for a
   * person, 4 for a boss); `classFactor` is what the resolver speaks, where a
   * person is 1. Halving here rather than renaming the field keeps this task to
   * one responsibility (P9).
   *
   * Callers pass `extent` explicitly rather than this method reading
   * `sprite.extent` itself: a Rectangle fallback (see `RECT_ANCHOR_EXTENT`
   * below) has no `extent` of its own but still needs a personHeight/Width
   * for its body anchors, so it passes a synthetic full-box extent. Every
   * call site already has the right value in hand (either narrowed from
   * `sprite.extent` behind an `if`, or the Rectangle literal), so no cast is
   * needed here.
   *
   * The two `sprite.kind === 'sprite'` callers only reach this when
   * `sprite.extent` is defined — see the ruling in the task brief: the Tran
   * Phap preview panel's host-fallback sprites have no `extent` and must
   * keep their pre-existing flat formula unchanged, because that panel
   * precomputes its own characterWidth/Height and a classFactor of 0.5
   * (sizeMultiplier 1) would halve every sprite in it.
   */
  private entityDisplaySize(
    sprite: EntitySprite,
    depthScale: number,
    extent: NonNullable<EntitySprite['extent']>,
  ) {
    const sourceSize = sprite.sourceSize ?? this.host.playerSourceSize

    return resolveEntityDisplaySize({
      nearCellWidth: this.host.projection
        ? this.host.projection.cellSizeAt(this.host.projection.rows - 1).width
        : this.host.characterHeight,
      depthScale,
      classFactor: sprite.sizeMultiplier / 2,
      extent,
      sourceSize,
    })
  }

  applySpriteSize(sprite: EntitySprite) {
    if (this.host.isPerspective && this.host.projection) {
      this.applyEntityDepthScale(sprite, this.host.projection.gridToScreen(sprite.row, 0).scale)

      return
    }

    if (sprite.kind === 'sprite') {
      const gameSprite = sprite.rect as Phaser.GameObjects.Sprite

      if (sprite.extent) {
        const size = this.entityDisplaySize(sprite, 1, sprite.extent)

        gameSprite.setDisplaySize(size.boxWidth, size.boxHeight)
        sprite.personHeight = size.personHeight
        sprite.personWidth = size.personWidth

        return
      }

      const width =
        this.host.characterHeight *
        sprite.sizeMultiplier *
        ((sprite.sourceSize ?? this.host.playerSourceSize).w / (sprite.sourceSize ?? this.host.playerSourceSize).h)

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

    // Finding 1 (final whole-branch review): a Rectangle has no `extent`, so
    // it never went through `entityDisplaySize` and `bodyBoxFor` fell back to
    // `characterHeight` — half the resolver's real personHeight and with no
    // depth factor. Anchors must be uniform across sprite/rect/static per the
    // design's own claim (Spec C §3.1), so compute them here too. This does
    // NOT touch how the Rectangle is DRAWN — `rect.width/height` above stay
    // untouched because TranPhapCombatPreviewScene renders through this same
    // path and precomputes its own sizing (see `entityDisplaySize`'s doc).
    const anchorSize = this.entityDisplaySize(sprite, 1, RECT_ANCHOR_EXTENT)

    sprite.personWidth = anchorSize.personWidth
    sprite.personHeight = anchorSize.personHeight
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
      const gameSprite = sprite.rect as Phaser.GameObjects.Sprite

      if (sprite.extent) {
        const size = this.entityDisplaySize(sprite, effectiveScale, sprite.extent)

        gameSprite.setDisplaySize(size.boxWidth, size.boxHeight)
        sprite.personHeight = size.personHeight
        sprite.personWidth = size.personWidth
      } else {
        const height = this.host.characterHeight * effectiveScale * multiplier

        gameSprite.setDisplaySize(height * ((sprite.sourceSize ?? this.host.playerSourceSize).w / (sprite.sourceSize ?? this.host.playerSourceSize).h), height)
      }
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

      // Finding 1 (final whole-branch review): see the matching comment in
      // applySpriteSize() — same reasoning, but here `effectiveScale` is the
      // depth factor this branch already computed (depthScale × boost), so
      // the Rectangle's anchors scale with depth exactly like a sprite's do.
      // rect.width/height above are left untouched (drawing stays as-is).
      const anchorSize = this.entityDisplaySize(sprite, effectiveScale, RECT_ANCHOR_EXTENT)

      sprite.personWidth = anchorSize.personWidth
      sprite.personHeight = anchorSize.personHeight
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

    // Spec B §4.3 — the idle bob, in SCREEN pixels and deliberately NOT scaled
    // by `point.scale`. Scaling it by depth is more correct perspective and was
    // explicitly not wanted: a far enemy is already small, and shrinking its
    // motion too makes it read as frozen.
    //
    // Applied to the BODY only. `footY`, the shadow and the depth sort all stay
    // on `point.y`, so a breathing enemy keeps its feet and its shadow planted
    // and never changes draw order mid-breath.
    const screenY = point.y + (sprite.idle?.offsetY ?? 0)

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
      const entityKey = this.host.textures.exists(this.host.playerProfile.combatTextureKey)
        ? this.host.playerProfile.combatTextureKey
        : PLAYER_TEXTURE_KEY
      const presentation = presentationFor(entityKey)

      // Same draw resolution as the enemy branch below: a static entity
      // renders its PNG, an animated entity renders the first frame of its
      // idle sheet.
      const drawKey =
        presentation?.kind === 'static'
          ? presentation.texture.textureKey
          : presentation?.kind === 'animated'
            ? presentation.clips.idle.sheetKey
            : entityKey
      const drawFrame =
        presentation?.kind === 'animated'
          ? atlasFrameName(presentation.clips.idle, presentation.clips.idle.firstFrame)
          : undefined

      const gameSprite = this.host.add.sprite(0, 0, drawKey, drawFrame)

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
        // The box the art this sprite DRAWS is authored in — not the entity's
        // static PNG.
        //
        // Measured defect, 2026-09-11: the player's display size came from
        // `playerSourceSize` (the profile PNG, 1312x1199) while the sprite drew
        // an atlas frame authored at 200x350, so `applySpriteSize` forced a
        // 1.094 aspect onto 0.571 art — 3.44x too wide on screen. Spec B moved
        // what the sprite draws and left what sizes it behind.
        sourceSize: playerArtSourceSize(this.host.playerProfile.combatTextureKey),
        extent: artExtentFor(this.host.playerProfile.combatTextureKey),
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
      this.startIdleMotion(sprite, id, entityKey)
      this.host.startEntityIdle(sprite, id)

      return sprite
    }

    // Enemy: authored PNG khi id khop batch Mortal (mortal-enemy-art-batch-
    // plan.md); id ngoai batch roi ve placeholder entity CUNG MODE
    // (uniformity 2026-09-19) - Rectangle chi con la double-fallback khi ca
    // placeholder texture cung thieu.
    const enemyEntityKey = resolveEnemyTextureKey(id) ?? PLACEHOLDER_ENTITY_KEY
    const presentation = presentationFor(enemyEntityKey)

    // What the sprite draws: a static entity renders its PNG; an animated
    // entity renders the first frame of its idle sheet.
    const drawKey =
      presentation?.kind === 'static'
        ? presentation.texture.textureKey
        : presentation?.kind === 'animated'
          ? presentation.clips.idle.sheetKey
          : undefined
    const drawFrame =
      presentation?.kind === 'animated'
        ? atlasFrameName(presentation.clips.idle, presentation.clips.idle.firstFrame)
        : undefined

    if (drawKey && presentation && this.host.textures.exists(drawKey)) {
      const gameSprite = this.host.add.sprite(0, 0, drawKey, drawFrame)

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
        sourceSize:
          presentation.kind === 'static'
            ? { ...presentation.texture.sourceSize }
            : { ...presentation.clips.idle.sourceSize },
        extent: artExtentFor(enemyEntityKey),
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
      this.startIdleMotion(sprite, id, enemyEntityKey)
      this.host.startEntityIdle(sprite, id)

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

  /**
   * Spec B §4.3/§6 B6 — start the idle bob for a `kind: 'static'` entity.
   *
   * §3.2 described enemies as static "như hiện tại". They were not: walk sway/
   * bob/tilt were deleted outright on 2026-08-26, leaving rotation 0 and a
   * straight projected position. So "static plus a slight shake" is a TARGET
   * state, and this is the half that had to be added rather than removed.
   *
   * It costs no art — the whole point of the economy in §3.2.
   *
   * PHASE comes from the runtime id, not from the texture key, and that
   * distinction is the difference between working and not: five `mortal_wild_boar`
   * share one texture key, so a per-key phase would make a row of five wolves
   * breathe as one organism — which reads worse than not breathing at all. The
   * catalogue varies the PERIOD per species; the delay below varies the phase per
   * individual.
   */
  private startIdleMotion(sprite: EntitySprite, id: string, textureKey: string): void {
    const presentation = presentationFor(textureKey)

    if (presentation?.kind !== 'static') {
      return
    }

    const { amplitudePx, periodMs } = presentation.idleMotion

    sprite.idle = { offsetY: 0 }

    this.host.tweens.add({
      targets: sprite.idle,
      offsetY: -amplitudePx,
      duration: periodMs / 2,
      delay: phaseDelayMs(id, periodMs),
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })
  }

  /** Whole-combatant visibility: body, label, shadow and health bar toggle
   * together. Callers must not touch sprite.rect.setVisible directly. */
  setSpriteVisible(sprite: EntitySprite, visible: boolean) {
    sprite.rect.setVisible(visible)
    sprite.label.setVisible(visible)
    sprite.shadow?.setVisible(visible)
    sprite.healthBar?.background.setVisible(visible)
    sprite.healthBar?.fill.setVisible(visible)
  }

  destroyEntitySprite(sprite: EntitySprite) {
    // The idle tween targets a plain object, so it survives the GameObject and
    // would keep running against a destroyed sprite's offset forever.
    if (sprite.idle) {
      this.host.tweens.killTweensOf(sprite.idle)
    }

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
