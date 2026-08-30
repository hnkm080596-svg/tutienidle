import Phaser from 'phaser'
import { DEPTH_OVERLAY_UI } from '@/game/support/BattleLayers'
import { easeRewardProgress, rewardMoteScale, rewardSwirlOffset } from '@/game/support/RewardGourd'
import type { CombatScene } from '../CombatScene'
import { PLAYER_ID } from './combatConstants'

const ESSENCE_PARTICLE_COUNT = 18
const ESSENCE_FLIGHT_DURATION = 850
const ESSENCE_MOTE_DELAY = 16
const ESSENCE_ARC_HEIGHT = 72

export class CombatEssenceStream {
  private activeCount = 0
  private readonly arrivalCallback: () => void

  constructor(
    private readonly scene: CombatScene,
    arrivalCallback: () => void,
  ) {
    this.arrivalCallback = arrivalCallback
  }

  play(startX: number, startY: number): void {
    this.activeCount++
    const particleCount = ESSENCE_PARTICLE_COUNT
    const baseDuration = ESSENCE_FLIGHT_DURATION
    const seedBase = Math.random()

    let remaining = particleCount

    for (let index = 0; index < particleCount; index++) {
      const mote = this.scene.add
        .ellipse(
          startX,
          startY,
          Phaser.Math.FloatBetween(6, 10),
          Phaser.Math.FloatBetween(2, 3.5),
          0xc792ea,
          1,
        )
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(DEPTH_OVERLAY_UI - 6)
        .setAlpha(0)

      const state = { progress: 0 }
      const swirlSeed = seedBase + index * 0.37

      this.scene.tweens.add({
        targets: state,
        progress: 1,
        delay: index * ESSENCE_MOTE_DELAY,
        duration: baseDuration + Phaser.Math.Between(-30, 30),
        ease: 'Linear',
        onUpdate: () => {
          const end = this.scene.resolveRewardSourcePoint(PLAYER_ID)
          if (!end) return

          const dx = end.x - startX
          const control = {
            x: (startX + end.x) / 2,
            y: Math.min(startY, end.y) - Math.max(ESSENCE_ARC_HEIGHT, Math.abs(dx) * 0.16),
          }

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

          mote.setAlpha(0.7 * (p > 0.85 ? (1 - p) / 0.15 : 1))
          mote.setScale(rewardMoteScale(p))
        },
        onComplete: () => {
          this.scene.tweens.add({
            targets: mote,
            alpha: 0,
            scale: 0.1,
            duration: 60,
            onComplete: () => mote.destroy(),
          })

          remaining--
          if (remaining <= 0) {
            this.activeCount--
            this.arrivalCallback()
          }
        },
      })
    }
  }
}