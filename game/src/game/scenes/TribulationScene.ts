import Phaser from 'phaser'
import type { EventBus } from '@/core/events/EventBus'
import type { EntityVitalsChangedEvent } from '@/core/combat/EntityVitalsSystem'
import type { CombatEvent } from '@/core/combat/CombatEvent'
import { formatNumber } from '@/core/format/NumberFormatter'
import {
  addInkWashNineSlice,
  queueInkWashUiAtlas,
} from '@/game/support/InkWashUiPhaser'

const CULTIVATE_KEY = 'char-cultivate'
const FRAME_RATE = 8

interface ResizeSize {
  width: number
  height: number
}

export class TribulationScene extends Phaser.Scene {
  private player?: Phaser.GameObjects.Sprite
  private viewportFrame?: Phaser.GameObjects.NineSlice
  private eventBus?: EventBus
  private lightningHandler = () => this.strikeLightning()
  private damageHandler = (event: CombatEvent) => this.showDamage(event)
  private vitalsHandler = (event: EntityVitalsChangedEvent) => {
    // Bất Tử Thể có thể cứu player sau event killed=true (CombatSystem
    // phát event hiệu chỉnh killed=false ngay sau guard) — alpha phải
    // phản ánh trạng thái CUỐI của event, không chỉ chiều chết.
    if (event.entityId === 'player') this.player?.setAlpha(event.killed ? 0.35 : 1)
  }
  private exitHandler = () => this.scene.start('MainScene')
  private resizeHandler = (gameSize: ResizeSize) => {
    this.viewportFrame?.setSize(gameSize.width - 24, gameSize.height - 24)
  }
  private shutdownHandler = () => {
    this.scale.off('resize', this.resizeHandler)
    this.viewportFrame = undefined
    this.unsubscribe()
  }

  constructor() {
    super('TribulationScene')
  }

  preload() {
    if (!this.textures.exists(CULTIVATE_KEY)) {
      this.load.multiatlas(CULTIVATE_KEY, 'assets/cultivate.json', 'assets')
    }
    queueInkWashUiAtlas(this)
  }

  create() {
    const { width, height } = this.scale
    this.add.rectangle(width / 2, height / 2, width, height, 0x050812)
    this.viewportFrame = addInkWashNineSlice(this, {
      id: 'frame-xl-ceremony',
      x: 12,
      y: 12,
      width: width - 24,
      height: height - 24,
      origin: 0,
    })
    this.add.circle(width / 2, height * 0.62, Math.min(width, height) * 0.2, 0x273064, 0.35)
      .setStrokeStyle(3, 0x879cff, 0.7)
    this.add.text(width / 2, height * 0.17, 'THIÊN KIẾP', {
      fontFamily: 'serif', fontSize: '32px', color: '#ddecff', letterSpacing: 8,
    }).setOrigin(0.5).setShadow(0, 0, '#72bfff', 16)

    if (!this.anims.exists(CULTIVATE_KEY)) {
      this.anims.create({
        key: CULTIVATE_KEY,
        frames: this.anims.generateFrameNames(CULTIVATE_KEY, { prefix: 'frame_', suffix: '.png', start: 0, end: 16, zeroPad: 3 }),
        frameRate: FRAME_RATE,
        repeat: -1,
      })
    }

    this.player = this.add.sprite(width / 2, height * 0.62, CULTIVATE_KEY, 'frame_000.png')
      .play(CULTIVATE_KEY)
      .setDisplaySize(128, 132)

    const bus = this.registry.get('eventBus') as EventBus | undefined
    if (bus) {
      this.eventBus = bus
      bus.on('tribulation_lightning', this.lightningHandler)
      bus.on<CombatEvent>('damage', this.damageHandler)
      bus.on<EntityVitalsChangedEvent>('entity_vitals_changed', this.vitalsHandler)
      bus.on('tribulation_scene_exit', this.exitHandler)
    }

    this.scale.on('resize', this.resizeHandler)
    this.events.once('shutdown', this.shutdownHandler)
  }

  private strikeLightning() {
    if (!this.player) return
    const bolt = this.add.graphics().setDepth(10).setBlendMode(Phaser.BlendModes.ADD)
    bolt.lineStyle(6, 0xeaf7ff, 1).beginPath().moveTo(this.player.x, 0)
    for (let y = 25; y < this.player.y; y += 25) {
      bolt.lineTo(this.player.x + Phaser.Math.Between(-24, 24), y)
    }
    bolt.lineTo(this.player.x, this.player.y).strokePath()
    this.cameras.main.flash(90, 170, 210, 255, false)
    this.cameras.main.shake(160, 0.012)
    this.player.setTint(0xd8f4ff)
    this.time.delayedCall(150, () => this.player?.clearTint())
    this.tweens.add({ targets: bolt, alpha: 0, duration: 260, onComplete: () => bolt.destroy() })
  }

  private showDamage(event: CombatEvent) {
    if (!this.player || event.targetId !== 'player' || !event.value) return
    const text = this.add.text(this.player.x, this.player.y - 80, `-${formatNumber(Math.round(event.value))}`, {
      fontSize: '22px', fontStyle: 'bold', color: '#ff8b8b',
    }).setOrigin(0.5)
    this.tweens.add({ targets: text, y: text.y - 42, alpha: 0, duration: 650, onComplete: () => text.destroy() })
  }

  private unsubscribe() {
    this.eventBus?.off('tribulation_lightning', this.lightningHandler)
    this.eventBus?.off<CombatEvent>('damage', this.damageHandler)
    this.eventBus?.off<EntityVitalsChangedEvent>('entity_vitals_changed', this.vitalsHandler)
    this.eventBus?.off('tribulation_scene_exit', this.exitHandler)
  }
}
