import Phaser from 'phaser'
import type { EventBus } from '@/core/events/EventBus'
import { readOptionalGate } from '@/presentation/gate/PresentationGate'
import type { EntityVitalsChangedEvent, VitalsChangeReason } from '@/core/combat/EntityVitalsSystem'
import { formatNumber } from '@/core/format/NumberFormatter'
import {
  queueInkWashUiAtlas,
} from '@/game/support/InkWashUiPhaser'
import { queueTribulationAssets } from '@/game/support/TribulationPreload'
import { TRIBULATION_SCENE_ASSET_IDS } from '@/presentation/assets/AssetBundleCatalog'
import { applyScreenShake } from '@/presentation/vfx/screenShakePolicy'
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

const TRIBULATION_ART_WIDTH = 1672
const TRIBULATION_ART_HEIGHT = 941

// Depth contract: rect bg < storm-far < dais < player < storm-near <
// vignette < lightning(10)/damage text < title(21). Runtime
// characters, strikes, meters and results stay gameplay-owned above.
const TRIBULATION_DEPTH = {
  stormFar: 1,
  dais: 2,
  player: 3,
  stormNear: 4,
  vignette: 5,
  title: 21,
} as const

export class TribulationScene extends Phaser.Scene {
  private player?: Phaser.GameObjects.Sprite
  private envImages: Phaser.GameObjects.Image[] = []
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
    this.layoutEnvironment(gameSize.width, gameSize.height)
  }
  private shutdownHandler = () => {
    this.scale.off('resize', this.resizeHandler)
    this.envImages = []
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

    // Huyen Kim tribulation-environment-kit (stable art, A10 catalog-fed):
    // storm-far + dais sit behind the runtime character, storm-near and
    // the sky vignette ride above it. The placeholder ink dais circle is
    // retired - the stable dais is the canonical substrate now.
    for (const assetId of TRIBULATION_SCENE_ASSET_IDS) {
      const key = `hk-${assetId}`
      if (!this.textures.exists(key)) continue
      const image = this.add.image(0, 0, key)
      if (assetId === 'tribulation-storm-far') image.setDepth(TRIBULATION_DEPTH.stormFar).setOrigin(0.5, 0)
      else if (assetId === 'tribulation-dais') image.setDepth(TRIBULATION_DEPTH.dais).setOrigin(0.5, 1)
      else if (assetId === 'tribulation-storm-near') image.setDepth(TRIBULATION_DEPTH.stormNear).setOrigin(0.5, 0)
      else image.setDepth(TRIBULATION_DEPTH.vignette).setOrigin(0.5, 0.5)
      this.envImages.push(image)
    }
    this.layoutEnvironment(width, height)

    // No chrome frame: the tribulation scene is route-owned full-bleed
    // storm vista (spec 14), not a scroll - a ceremony frame around the
    // viewport read as a stray ring.
    this.add.text(width / 2, height * 0.17, 'THIÊN KIẾP', {
      fontFamily: 'serif', fontSize: '32px', color: '#ddecff', letterSpacing: 8,
    }).setOrigin(0.5).setShadow(0, 0, '#72bfff', 16).setDepth(TRIBULATION_DEPTH.title)

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
        .setDepth(TRIBULATION_DEPTH.player)
    } else {
      // Static mode - the profile's cultivate PNG; size from the live source
      // image so a differently-shaped artwork never distorts.
      const registryProfileId = readOptionalGate(this.registry, 'playerVisualProfileId')
      const cultivationWay = readOptionalGate(this.registry, 'playerCultivationWay')
      const profile =
        (registryProfileId && PLAYER_VISUAL_PROFILES[registryProfileId]) ||
        PLAYER_VISUAL_PROFILES.mortal
      const textureKey = getCultivateTexture(profile, cultivationWay).key

      this.player = this.add.sprite(width / 2, height * 0.62, textureKey)
        .setDepth(TRIBULATION_DEPTH.player)

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

  /**
   * Environment layout (stable art contract): storm bands contain-fit the
   * canvas width anchored north; the dais contain-fits width anchored
   * south; the vignette cover-fits the whole canvas centered.
   */
  private layoutEnvironment(width: number, height: number): void {
    const widthScale = width / TRIBULATION_ART_WIDTH
    const coverScale = Math.max(widthScale, height / TRIBULATION_ART_HEIGHT)

    for (const image of this.envImages) {
      const key = image.texture.key
      if (key === 'hk-tribulation-sky-vignette') {
        image.setDisplaySize(TRIBULATION_ART_WIDTH * coverScale, TRIBULATION_ART_HEIGHT * coverScale)
        image.setPosition(width / 2, height / 2)
      } else if (key === 'hk-tribulation-dais') {
        image.setDisplaySize(TRIBULATION_ART_WIDTH * widthScale, TRIBULATION_ART_HEIGHT * widthScale)
        image.setPosition(width / 2, height)
      } else {
        image.setDisplaySize(TRIBULATION_ART_WIDTH * widthScale, TRIBULATION_ART_HEIGHT * widthScale)
        image.setPosition(width / 2, 0)
      }
    }
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
    applyScreenShake(this.cameras.main, 160, 0.012)
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
