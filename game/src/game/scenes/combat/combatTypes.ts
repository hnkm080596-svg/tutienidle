// combatTypes (ui-discoverability-refactor-plan.md §3.2) — kiểu dùng chung
// giữa CombatScene orchestrator và các combat module. Refactor thuần —
// định nghĩa DI CHUYỂN từ CombatScene.ts, KHÔNG đổi shape nào.
import type Phaser from 'phaser'

import type { LaneIndex } from '@/core/battle/BattleLane'

export interface EntitySprite {
  // Player = Sprite profile art, enemy = Sprite Mortal art batch HOẶC
  // Rectangle màu (id ngoài batch). `kind` phân biệt để biết dùng
  // setFillStyle() hay setTint()/clearTint() (flashColor()/resetVisual())
  // — mọi thao tác position/scale/rotation/alpha khác đều dùng chung API.
  kind: 'rect' | 'sprite'
  rect: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Sprite
  label: Phaser.GameObjects.Text
  color: number
  offsetX: number
  row: LaneIndex
  healthBar?: EnemyHealthBar

  /**
   * Kích thước nguồn của texture sprite này — player theo profile hiện
   * hành (scene.playerSourceSize), enemy art batch 1254². Bắt buộc cho
   * mọi kind='sprite' để setDisplaySize giữ đúng tỉ lệ khung hình.
   */
  sourceSize?: { w: number; h: number }

  // Combat AI rework (plan §12.1) + enemy art x2 (2026-08-26) — player
  // sprite ×2, enemy PNG ×2 (fallback Rectangle ×1).
  sizeMultiplier: number

  // 2.5D presentation (2026-08-24) — bóng ellipse trên mặt đất (chỉ tạo
  // ở perspective), foot point + column float lần chiếu gần nhất phục vụ
  // depth sort, và boost object cho tween pop (Chí Mạng) KHÔNG đụng vào
  // scale/geometry mà projection ghi mỗi frame.
  shadow?: Phaser.GameObjects.Ellipse
  boost: { value: number }
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

  // Thời điểm snapshot tạo segment (cadence đo từ đây).
  lastSnapshotAt: number
}
