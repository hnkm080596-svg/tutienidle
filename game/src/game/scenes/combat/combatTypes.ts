// combatTypes (ui-discoverability-refactor-plan.md sec.3.2) - kieu dung chung
// giua CombatScene orchestrator va cac combat module. Refactor thuan -
// dinh nghia DI CHUYEN tu CombatScene.ts, KHONG doi shape nao.
import type Phaser from 'phaser'

import type { LaneIndex } from '@/core/battle/BattleLane'

export interface EntitySprite {
  // Player = Sprite profile art, enemy = Sprite authored art hoac shared
  // placeholder (id ngoai batch). Rectangle chi con la double-fallback
  // khi ca placeholder texture cung thieu. `kind` phan biet de biet dung
  // setFillStyle() hay setTint()/clearTint() (flashColor()/resetVisual())
  // - moi thao tac position/scale/rotation/alpha khac deu dung chung API.
  kind: 'rect' | 'sprite'
  rect: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Sprite
  label: Phaser.GameObjects.Text
  color: number
  offsetX: number
  row: LaneIndex
  healthBar?: EnemyHealthBar

  /**
   * Kich thuoc nguon cua texture sprite nay - player theo profile hien
   * hanh (scene.playerSourceSize), enemy art batch 1254x1254. Bat buoc cho
   * moi kind='sprite' de setDisplaySize giu dung ti le khung hinh.
   */
  sourceSize?: { w: number; h: number }

  /**
   * How much of its authored box this sprite's art fills (Spec C sec.4.1).
   *
   * Undefined for a Rectangle fallback and for the Tran Phap preview panel,
   * where it defaults to a full box - those cases have no trimmed art.
   */
  extent?: { x: number; y: number; w: number; h: number }

  /**
   * The character's size on screen, as resolved by Spec C sec.4.3 - NOT the
   * sprite's box. Task 4's anchors read these, and storing them here is what
   * stops the two halves computing them differently.
   */
  personWidth?: number
  personHeight?: number

  // Combat AI rework (plan sec.12.1) + enemy art x2 (2026-08-26) - player
  // sprite x2, enemy PNG x2 (fallback Rectangle x1).
  sizeMultiplier: number

  // 2.5D presentation (2026-08-24) - bong ellipse tren mat dat (chi tao
  // o perspective), foot point + column float lan chieu gan nhat phuc vu
  // depth sort, va boost object cho tween pop (Chi Mang) KHONG dung vao
  // scale/geometry ma projection ghi moi frame.
  shadow?: Phaser.GameObjects.Ellipse
  boost: { value: number }

  /**
   * Spec B sec.4.3 - procedural idle motion for a `kind: 'static'` entity.
   *
   * A PLAIN OBJECT tweened separately from `rect`, for the same reason `boost`
   * is: `positionSprite()` writes the sprite's position from the projection
   * every frame, so a tween on `rect.y` would be overwritten within a frame.
   * The projection reads this offset instead.
   *
   * Absent on animated entities, which move because their frames do.
   */
  idle?: { offsetY: number }
  footY: number
  columnFloat: number
}

export interface EnemyHealthBar {
  background: Phaser.GameObjects.Rectangle
  fill: Phaser.GameObjects.Rectangle
  width: number
  currentHp: number
  maxHp: number
  isBoss: boolean
}

export interface CastBarSprite {
  bg: Phaser.GameObjects.Rectangle
  fill: Phaser.GameObjects.Rectangle
  widthPx: number
}

export interface PositionInterpolation {
  fromX: number
  toX: number
  segmentStart: number
  segmentDuration: number

  // Thoi diem snapshot tao segment (cadence do tu day).
  lastSnapshotAt: number
}
