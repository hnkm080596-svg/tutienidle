// combat-reward-gourd (ui-discoverability-refactor-plan.md §3.2) — tách từ
// CombatScene.ts: HỒ LÔ HÚT PHẦN THƯỞNG Bezier (placement/pulse/redraw +
// reward stream mote + resolve điểm phát theo priority chest-anchor →
// screen cache → grid cache). Module nhận dependency tường minh qua
// `scene` — mọi cross-call đi qua scene delegate để giữ nguyên seam test
// (rewardStream test gọi scene.resolveRewardSourcePoint /
// scene.onRewardParticle trực tiếp trên Object.create instance).
import Phaser from 'phaser'

import type { BattleRewardParticleEvent } from '@/core/battle/BattleEvents'
import type { LaneIndex } from '@/core/battle/BattleLane'
import {
  GOURD_MOUTH_ANCHOR,
  GOURD_PLACEHOLDER_SIZE,
  computeGourdPlacement,
  easeRewardProgress,
  resolveGourdMouth,
  resolveRewardControlPoint,
  rewardMoteScale,
  rewardSwirlOffset,
} from '@/game/support/RewardGourd'
import { resolveSpriteBodyAnchor } from '@/game/support/SpriteBodyAnchor'
import { getBodyAnchors } from '@/game/support/PlayerVisualProfiles'
import { DEPTH_OVERLAY_UI } from '@/game/support/BattleLayers'

import type { CombatScene } from '../CombatScene'
import { ENEMY_NEUTRAL_BODY_ANCHOR, PLAYER_ID } from './combatConstants'

export class CombatRewardGourd {
  constructor(private readonly scene: CombatScene) {}

  /**
   * Tính lại vị trí hồ lô theo viewport hiện hành và cập nhật view.
   * Neo góc TRÁI DƯỚI battlefield an toàn — phía trên Event Bar +
   * Control Bar, KHÔNG neo theo grid Player. Art thật (Image): origin =
   * normalized mouth anchor nên setPosition đặt ĐÚNG miệng; Graphics
   * placeholder: shapes vẽ tương đối quanh miệng.
   */
  refreshRewardGourd(canvasHeight: number, bottomInset: number) {
    this.scene.gourdPlacement = computeGourdPlacement({ canvasHeight, bottomInset })

    const view = this.scene.gourdGraphics

    if (!view) {
      return
    }

    const mouth = resolveGourdMouth(this.scene.gourdPlacement)

    view.setPosition(mouth.x, mouth.y)

    if (view instanceof Phaser.GameObjects.Image) {
      view.setOrigin(GOURD_MOUTH_ANCHOR.x, GOURD_MOUTH_ANCHOR.y)

      view.setDisplaySize(GOURD_PLACEHOLDER_SIZE.w, GOURD_PLACEHOLDER_SIZE.h)

      // Scale gốc sau setDisplaySize — pulse nhân lên thay vì đè số tuyệt đối.
      this.scene.gourdBaseScale = { x: view.scaleX, y: view.scaleY }
    } else {
      this.scene.gourdBaseScale = { x: 1, y: 1 }

      this.redrawGourd()
    }
  }

  /** Placeholder Graphics thuần — không asset AI, silhouette đọc tốt. */
  redrawGourd() {
    const graphics = this.scene.gourdGraphics

    if (!(graphics instanceof Phaser.GameObjects.Graphics)) {
      return
    }

    const { w: width, h: height } = GOURD_PLACEHOLDER_SIZE

    graphics.clear()

    // Thân dưới (bầu to) + thân trên (bầu nhỏ) — tông ngọc sẫm.
    graphics.fillStyle(0x1d3a2c, 1)
    graphics.fillEllipse(0, height * 0.42, width * 0.84, height * 0.52)
    graphics.fillEllipse(0, height * 0.14, width * 0.6, height * 0.34)

    // Khối bóng nhẹ bên trái tạo thể tích.
    graphics.fillStyle(0x27503b, 1)
    graphics.fillEllipse(-width * 0.16, height * 0.4, width * 0.3, height * 0.36)

    // Miệng hồ lô — anchor hút (0,0), vành đồng cổ + lòng tối.
    graphics.fillStyle(0x8a6a3a, 1)
    graphics.fillEllipse(0, 0, width * 0.44, height * 0.12)
    graphics.fillStyle(0x120c08, 1)
    graphics.fillEllipse(0, 0, width * 0.32, height * 0.075)

    // Dây đỏ trầm quấn quanh cổ + tua xuống thân.
    graphics.lineStyle(2.5, 0xa33228, 0.95)
    graphics.strokeEllipse(0, height * 0.07, width * 0.5, height * 0.1)
    graphics.beginPath()
    graphics.moveTo(width * 0.18, height * 0.12)
    graphics.lineTo(width * 0.26, height * 0.3)
    graphics.moveTo(-width * 0.18, height * 0.12)
    graphics.lineTo(-width * 0.24, height * 0.32)
    graphics.strokePath()
  }

  /** Pulse ĐÚNG MỘT nhịp mỗi reward event (plan §6.3) — nở từ miệng. */
  pulseGourd() {
    const view = this.scene.gourdGraphics

    if (!view) {
      return
    }

    this.scene.tweens.killTweensOf(view)

    view.setScale(this.scene.gourdBaseScale.x, this.scene.gourdBaseScale.y)

    const base = this.scene.gourdBaseScale

    // Proxy scale — nhân lên từ scale gốc (Image display-size ≠ scale 1).
    const pulse = { value: 1 }

    this.scene.tweens.add({
      targets: pulse,

      value: 1.12,

      duration: 90,

      yoyo: true,

      ease: 'Quad.easeOut',

      onUpdate: () => {
        view.setScale(base.x * pulse.value, base.y * pulse.value)
      },

      onComplete: () => {
        view.setScale(base.x, base.y)
      },
    })
  }

  /** Điểm hút LIVE — luôn là miệng hồ lô, không bao giờ là Player (§7.2). */
  gourMouthPoint(): { x: number; y: number } {
    return resolveGourdMouth(this.scene.gourdPlacement)
  }

  /**
   * Reward stream (plan §7) — Bezier hút về MIỆNG HỒ LÔ:
   * - Điểm phát: chest anchor của sprite nguồn → screen cache → ô grid
   *   cuối cùng (sprite đã bị dọn vẫn có nguồn hợp lý).
   * - Điểm hút LIVE từ gourd mouth mỗi onUpdate: Player teleport giữa
   *   tween KHÔNG ảnh hưởng quỹ đạo; resize re-resolve đích mới.
   * - Tăng tốc nửa sau (quad-in), co scale + xoáy nhỏ khi tới miệng.
   * - Pulse hồ lô ĐÚNG MỘT nhịp mỗi reward event (mốc đại diện), không
   *   pulse theo từng mote (§6.3).
   */
  onRewardParticle(event: BattleRewardParticleEvent) {
    const start = this.scene.resolveRewardSourcePoint(event.sourceId)

    if (!start) {
      return
    }

    const startX = start.x
    const startY = start.y
    const kind = event.kind
    const particleCount = kind === 'insight' ? 26 : kind === 'item' ? 22 : 18
    const controlFor = resolveRewardControlPoint(start, kind)
    const baseDuration = kind === 'insight' ? 950 : 850
    const seedBase = Math.random()
    const peakAlpha =
      kind === 'insight' ? Phaser.Math.FloatBetween(0.55, 0.78) : Phaser.Math.FloatBetween(0.75, 1)

    for (let index = 0; index < particleCount; index++) {
      // Mote nhỏ tương đồng nối đuôi nhau thành dải linh khí; khởi tạo
      // trong suốt để stagger không chồng thành cục tại nguồn.
      const mote = this.scene.add
        .ellipse(
          startX,
          startY,
          Phaser.Math.FloatBetween(8, 13),
          Phaser.Math.FloatBetween(2.5, 4),
          event.color,
          1,
        )
        .setBlendMode(Phaser.BlendModes.ADD)
        // Dưới lớp gourd (DEPTH_OVERLAY_UI - 4) để hạt "chui vào" miệng.
        .setDepth(DEPTH_OVERLAY_UI - 6)
        .setAlpha(0)

      const state = { progress: 0 }
      const swirlSeed = seedBase + index * 0.37

      this.scene.tweens.add({
        targets: state,
        progress: 1,
        delay: index * 18,
        duration: baseDuration + Phaser.Math.Between(-40, 60),
        ease: 'Linear',
        onUpdate: () => {
          // Đích + control giải LIVE — teleport/resize-safe (§7.2).
          const end = this.gourMouthPoint()
          const control = controlFor(end)
          const p = easeRewardProgress(state.progress)
          const inverse = 1 - p

          const swirl = rewardSwirlOffset(p, swirlSeed)

          const curveX =
            inverse * inverse * startX + 2 * inverse * p * control.x + p * p * end.x

          const curveY =
            inverse * inverse * startY + 2 * inverse * p * control.y + p * p * end.y

          mote.setPosition(curveX + swirl.x, curveY + swirl.y)

          const tangentX = 2 * inverse * (control.x - startX) + 2 * p * (end.x - control.x)

          const tangentY = 2 * inverse * (control.y - startY) + 2 * p * (end.y - control.y)

          mote.setRotation(Math.atan2(tangentY, tangentX))

          // Fade chỉ ở đoạn cuối khi chui vào miệng, giữ thân stream sáng.
          mote.setAlpha(peakAlpha * (p > 0.85 ? (1 - p) / 0.15 : 1))

          mote.setScale(rewardMoteScale(p))
        },
        onComplete: () => {
          this.scene.tweens.add({
            targets: mote,
            alpha: 0,
            scale: 0.1,
            duration: 80,
            onComplete: () => mote.destroy(),
          })
        },
      })
    }

    // Pulse đại diện cho CẢ stream — một nhịp/event, không theo mote.
    const totalFlightMs = baseDuration + (particleCount - 1) * 18 + 40

    this.scene.time.delayedCall(totalFlightMs, () => this.pulseGourd())
  }

  /**
   * Điểm phát reward (plan §7.1) — ưu tiên:
   * 1. body anchor của sprite nguồn còn tồn tại (Player dùng catalog
   *    anchor 'chest' của profile; enemy KHÔNG có catalog anchor nên
   *    dùng điểm thân trung tính suy ra từ sprite bounds — audit P0-3,
   *    không bao giờ áp Player anchor cho enemy);
   * 2. last-known screen position theo entity ID;
   * 3. ô grid cuối cùng chiếu qua projection hiện hành.
   */
  resolveRewardSourcePoint(sourceId: string): { x: number; y: number } | undefined {
    const source = this.scene.spriteFor(sourceId)

    if (source) {
      const snapshot = {
        x: source.rect.x,

        y: source.rect.y,

        displayWidth: source.rect.displayWidth,

        displayHeight: source.rect.displayHeight,

        originX: 0.5,

        originY: this.scene.isPerspective ? 1 : 0.5,

        flipX: false,

        rotation: source.rect.rotation,
      }

      if (sourceId === PLAYER_ID) {
        return resolveSpriteBodyAnchor(
          getBodyAnchors(this.scene.playerProfile, 'combat').chest,
          snapshot,
        )
      }

      // Enemy/rect fallback — điểm thân trung tính (~40% chiều cao từ
      // chân) suy thuần từ bounds sprite, ĐỘC LẬP với Player profile.
      return resolveSpriteBodyAnchor(ENEMY_NEUTRAL_BODY_ANCHOR, snapshot)
    }

    const cachedScreen = this.scene.lastKnownScreenPositions.get(sourceId)

    if (cachedScreen) {
      return { x: cachedScreen.x, y: cachedScreen.y }
    }

    const cachedGrid = this.scene.lastKnownGridPositions.get(sourceId)

    if (cachedGrid && this.scene.projection) {
      const point = this.scene.projection.gridToScreen(cachedGrid.row, cachedGrid.column)

      return { x: point.x, y: point.y }
    }

    return undefined
  }

  trackSourceScreenPosition(id: string, sprite: EntitySpriteLike) {
    this.scene.lastKnownScreenPositions.set(id, { x: sprite.rect.x, y: sprite.rect.y })

    // FIFO prune — cache phục vụ presentation, không rò rỉ vô hạn qua
    // các trận auto-refight dài.
    if (this.scene.lastKnownScreenPositions.size > this.scene.maxTrackedSourcePositions) {
      const oldest = this.scene.lastKnownScreenPositions.keys().next().value

      if (oldest !== undefined && oldest !== id) {
        this.scene.lastKnownScreenPositions.delete(oldest)
      }
    }
  }

  trackSourceGridPosition(id: string, row: LaneIndex, column: number) {
    this.scene.lastKnownGridPositions.set(id, { row, column })

    if (this.scene.lastKnownGridPositions.size > this.scene.maxTrackedSourcePositions) {
      const oldest = this.scene.lastKnownGridPositions.keys().next().value

      if (oldest !== undefined && oldest !== id) {
        this.scene.lastKnownGridPositions.delete(oldest)
      }
    }
  }
}

interface EntitySpriteLike {
  rect: { x: number; y: number }
}
