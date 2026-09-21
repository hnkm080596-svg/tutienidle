import Phaser from 'phaser'
import type { EventBus } from '@/core/events/EventBus'
import { readOptionalGate } from '@/presentation/gate/PresentationGate'
import type { EntityVitalsChangedEvent, VitalsChangeReason } from '@/core/combat/EntityVitalsSystem'
import { formatNumber } from '@/core/format/NumberFormatter'
import {
  addInkWashNineSlice,
  queueInkWashUiAtlas,
} from '@/game/support/InkWashUiPhaser'
import { queueTribulationAssets } from '@/game/support/TribulationPreload'
import { ENTITY_ART_MODE } from '@/presentation/art/EntityArtMode'
import {
  getCultivateTexture,
  PLAYER_VISUAL_PROFILES,
} from '@/presentation/art/PlayerVisualProfiles'

// 'char-cultivate' is the legacy 17-frame bridge multiatlas - the cultivate
// presentation in ANIMATED mode until player atlases carry a cultivate clip
// (uniformity plan, 2026-09-19). Static mode draws the profile cultivate PNG.
const CULTIVATE_KEY = 'char-cultivate'
const FRAME_RATE = 8

interface ResizeSize {
  width: number
  height: number
}

const DAMAGE_REASONS: ReadonlySet<VitalsChangeReason> = new Set([
  'damage',
  'dot',
  'heavenly_tribulation',
  'reaction',
  'reflection',
  'ward_break',
])

// T6-54 - hp actually lost by the player on a damage-type vitals event, or
// null when the event must not render a "-N" number. Presentation reads the
// authoritative hpBefore/hpAfter delta, never event.amount (pre-absorb).
export function vitalsDamageAmount(event: EntityVitalsChangedEvent): number | null {
  if (event.entityId !== 'player') return null
  if (!DAMAGE_REASONS.has(event.reason)) return null
  const lost = event.hpBefore - event.hpAfter
  return lost > 0 ? lost : null
}

export class TribulationScene extends Phaser.Scene {
  private player?: Phaser.GameObjects.Sprite
  private viewportFrame?: Phaser.GameObjects.NineSlice
  private eventBus?: EventBus
  private lightningHandler = () => this.strikeLightning()
  private vitalsHandler = (event: EntityVitalsChangedEvent) => {
    // Bất Tử Thể có thể cứu player sau event killed=true (CombatSystem
    // phát event hiệu chỉnh killed=false ngay sau guard) — alpha phải
    // phản ánh trạng thái CUỐI của event, không chỉ chiều chết.
    if (event.entityId === 'player') this.player?.setAlpha(event.killed ? 0.35 : 1)
    const damage = vitalsDamageAmount(event)
    if (damage !== null) this.showDamage(damage)
  }
  private resizeHandler = (gameSize: ResizeSize) => {
    this.viewportFrame?.setSize(Math.max(0, gameSize.width - 24), Math.max(0, gameSize.height - 24))
  }
  private shutdownHandler = () => {
    this.scale.off('resize', this.resizeHandler)
    this.viewportFrame = undefined
    this.unsubscribe()
  }

  private initTransitionId = 0
  private initSessionId?: number
  private initGameGeneration = 0

  constructor() {
    super('TribulationScene')
  }

  init(data?: { transitionId?: number; sessionId?: number; gameGeneration?: number }): void {
    // Assign unconditionally: a (re)start without data must reset the READY
    // identity echo, never leak the previous session's.
    this.initTransitionId = data?.transitionId ?? 0
    this.initSessionId = data?.sessionId
    this.initGameGeneration = data?.gameGeneration ?? 0
  }

  preload() {
    // Descriptor-fed (A10): the mode-appropriate cultivate art is whatever
    // the 'tribulation' bundle enumerates - cultivate PNG in static mode,
    // the char-cultivate bridge multiatlas in animated mode.
    queueTribulationAssets(this)
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

    if (ENTITY_ART_MODE === 'animated') {
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
    } else {
      // Static mode - the profile's cultivate PNG; size from the live source
      // image so a differently-shaped artwork never distorts.
      const registryProfileId = readOptionalGate(this.registry, 'playerVisualProfileId')
      const profile =
        (registryProfileId && PLAYER_VISUAL_PROFILES[registryProfileId]) ||
        PLAYER_VISUAL_PROFILES.mortal
      const textureKey = getCultivateTexture(profile).key

      this.player = this.add.sprite(width / 2, height * 0.62, textureKey)

      const source = this.textures.get(textureKey).getSourceImage()
      const sourceW = 'width' in source ? Number(source.width) : 128
      const sourceH = 'height' in source ? Number(source.height) : 132

      this.player.setDisplaySize(132 * (sourceW / Math.max(1, sourceH)), 132)
    }

    const bus = readOptionalGate(this.registry, 'eventBus')
    if (bus) {
      this.eventBus = bus
      bus.on('tribulation_lightning', this.lightningHandler)
      bus.on<EntityVitalsChangedEvent>('entity_vitals_changed', this.vitalsHandler)
    }

    this.scale.on('resize', this.resizeHandler)

    const adapter = readOptionalGate(this.registry, 'sceneAdapter')
    adapter?.reportReady({
      transitionId: this.initTransitionId,
      sessionId: this.initSessionId,
      gameGeneration: this.initGameGeneration,
    })

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

  private showDamage(hpDamage: number) {
    if (!this.player) return
    const text = this.add.text(this.player.x, this.player.y - 80, `-${formatNumber(Math.round(hpDamage))}`, {
      fontSize: '22px', fontStyle: 'bold', color: '#ff8b8b',
    }).setOrigin(0.5)
    this.tweens.add({ targets: text, y: text.y - 42, alpha: 0, duration: 650, onComplete: () => text.destroy() })
  }

  private unsubscribe() {
    this.eventBus?.off('tribulation_lightning', this.lightningHandler)
    this.eventBus?.off<EntityVitalsChangedEvent>('entity_vitals_changed', this.vitalsHandler)
  }
}
