// combat-reward-gourd (ui-discoverability-refactor-plan.md sec3.2) - tach tu
// CombatScene.ts: HO LO HUT PHAN THUONG Bezier (placement/pulse/redraw +
// reward stream mote + resolve diem phat theo priority chest-anchor ->
// screen cache -> grid cache). Module nhan dependency tuong minh qua
// `scene` - moi cross-call di qua scene delegate de giu nguyen seam test
// (rewardStream test goi scene.resolveRewardSourcePoint /
// scene.onRewardParticle truc tiep tren Object.create instance).
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
import { DEPTH_OVERLAY_UI } from '@/game/support/BattleLayers'

import type { CombatScene } from '../CombatScene'

export class CombatRewardGourd {
  constructor(private readonly scene: CombatScene) {}

  /**
   * Tinh lai vi tri ho lo theo viewport hien hanh va cap nhat view.
   * Neo goc TRAI DUOI battlefield an toan - phia tren Event Bar +
   * Control Bar, KHONG neo theo grid Player. Art that (Image): origin =
   * normalized mouth anchor nen setPosition dat DUNG mieng; Graphics
   * placeholder: shapes ve tuong doi quanh mieng.
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

      // Scale goc sau setDisplaySize - pulse nhan len thay vi de so tuyet doi.
      this.scene.gourdBaseScale = { x: view.scaleX, y: view.scaleY }
    } else {
      this.scene.gourdBaseScale = { x: 1, y: 1 }

      this.redrawGourd()
    }
  }

  /** Placeholder Graphics thuan - khong asset AI, silhouette doc tot. */
  redrawGourd() {
    const graphics = this.scene.gourdGraphics

    if (!(graphics instanceof Phaser.GameObjects.Graphics)) {
      return
    }

    const { w: width, h: height } = GOURD_PLACEHOLDER_SIZE

    graphics.clear()

    // Than duoi (bau to) + than tren (bau nho) - tong ngoc sam.
    graphics.fillStyle(0x1d3a2c, 1)
    graphics.fillEllipse(0, height * 0.42, width * 0.84, height * 0.52)
    graphics.fillEllipse(0, height * 0.14, width * 0.6, height * 0.34)

    // Khoi bong nhe ben trai tao the tich.
    graphics.fillStyle(0x27503b, 1)
    graphics.fillEllipse(-width * 0.16, height * 0.4, width * 0.3, height * 0.36)

    // Mieng ho lo - anchor hut (0,0), vanh dong co + long toi.
    graphics.fillStyle(0x8a6a3a, 1)
    graphics.fillEllipse(0, 0, width * 0.44, height * 0.12)
    graphics.fillStyle(0x120c08, 1)
    graphics.fillEllipse(0, 0, width * 0.32, height * 0.075)

    // Day do tram quan quanh co + tua xuong than.
    graphics.lineStyle(2.5, 0xa33228, 0.95)
    graphics.strokeEllipse(0, height * 0.07, width * 0.5, height * 0.1)
    graphics.beginPath()
    graphics.moveTo(width * 0.18, height * 0.12)
    graphics.lineTo(width * 0.26, height * 0.3)
    graphics.moveTo(-width * 0.18, height * 0.12)
    graphics.lineTo(-width * 0.24, height * 0.32)
    graphics.strokePath()
  }

  /** Pulse DUNG MOT nhip moi reward event (plan sec6.3) - no tu mieng. */
  pulseGourd() {
    const view = this.scene.gourdGraphics

    if (!view) {
      return
    }

    this.scene.tweens.killTweensOf(view)

    view.setScale(this.scene.gourdBaseScale.x, this.scene.gourdBaseScale.y)

    const base = this.scene.gourdBaseScale

    // Proxy scale - nhan len tu scale goc (Image display-size != scale 1).
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

  /** Diem hut LIVE - luon la mieng ho lo, khong bao gio la Player (sec7.2). */
  gourMouthPoint(): { x: number; y: number } {
    return resolveGourdMouth(this.scene.gourdPlacement)
  }

  /**
   * Reward stream (plan sec7) - Bezier hut ve MIENG HO LO:
   * - Diem phat: chest anchor cua sprite nguon -> screen cache -> o grid
   *   cuoi cung (sprite da bi don van co nguon hop ly).
   * - Diem hut LIVE tu gourd mouth moi onUpdate: Player teleport giua
   *   tween KHONG anh huong quy dao; resize re-resolve dich moi.
   * - Tang toc nua sau (quad-in), co scale + xoay nho khi toi mieng.
   * - Pulse ho lo DUNG MOT nhip moi reward event (moc dai dien), khong
   *   pulse theo tung mote (sec6.3).
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
      // Mote nho tuong dong noi duoi nhau thanh dai linh khi; khoi tao
      // trong suot de stagger khong chong thanh cuc tai nguon.
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
        // Duoi lop gourd (DEPTH_OVERLAY_UI - 4) de hat "chui vao" mieng.
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
          // Dich + control giai LIVE - teleport/resize-safe (sec7.2).
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

          // Fade chi o doan cuoi khi chui vao mieng, giu than stream sang.
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

    // Pulse dai dien cho CA stream - mot nhip/event, khong theo mote.
    const totalFlightMs = baseDuration + (particleCount - 1) * 18 + 40

    this.scene.time.delayedCall(totalFlightMs, () => this.pulseGourd())
  }

  /**
   * Diem phat reward (plan sec7.1) - uu tien:
   * 1. body anchor 'centre' cua sprite nguon con ton tai - MOT rule cho moi
   *    entity (Spec C sec3.1), suy tu cell battlefield thay vi hand-authored
   *    table rieng cho Player;
   * 2. last-known screen position theo entity ID;
   * 3. o grid cuoi cung chieu qua projection hien hanh.
   */
  resolveRewardSourcePoint(sourceId: string): { x: number; y: number } | undefined {
    // Spec C sec3.1 - one rule for every entity. This used to branch: the player's
    // hand-authored `chest` anchor, and a hardcoded "~40% of height from the
    // feet" for everything else. The audit ruling behind that branch (never
    // borrow one character's proportions for another) is kept; what goes is the
    // second code path, because an anchor derived from the CELL borrows nothing.
    const bodyCentre = this.scene.bodyAnchorScreen(sourceId, 'centre')

    if (bodyCentre) {
      return bodyCentre
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

    // FIFO prune - cache phuc vu presentation, khong ro ri vo han qua
    // cac tran auto-refight dai.
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
