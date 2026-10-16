import Phaser from 'phaser'
import type { EventBus } from '@/core/events/EventBus'
import { readOptionalGate } from '@/presentation/gate/PresentationGate'
import type { EntityVitalsChangedEvent, VitalsChangeReason } from '@/core/combat/EntityVitalsSystem'
import { formatNumber } from '@/core/format/NumberFormatter'
import {
  queueInkWashUiAtlas,
} from '@/game/support/InkWashUiPhaser'
import { queueTribulationAssets } from '@/game/support/TribulationPreload'
import {
  TRIBULATION_LIGHTNING_VFX_KEY,
  TRIBULATION_SCENE_ASSET_IDS,
} from '@/presentation/assets/AssetBundleCatalog'
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

// 5 consecutive lightning strike segments across the 42-frame Lightning_Tribulation atlas.
// Playing segments 0 -> 1 -> 2 -> 3 -> 4 across each 5-strike wave plays the full
// spritesheet in exact order while keeping every visual bolt 1:1 with an HP deduction.
const LIGHTNING_STRIKE_SEGMENTS: ReadonlyArray<{
  readonly key: string
  readonly start: number
  readonly end: number
  readonly frameRate: number
  readonly originX: number
}> = [
  { key: 'vfx-tribulation-lightning-0', start: 3, end: 8, frameRate: 10, originX: 0.31 },
  { key: 'vfx-tribulation-lightning-1', start: 10, end: 15, frameRate: 10, originX: 0.72 },
  { key: 'vfx-tribulation-lightning-2', start: 16, end: 21, frameRate: 10, originX: 0.4 },
  { key: 'vfx-tribulation-lightning-3', start: 23, end: 28, frameRate: 10, originX: 0.58 },
  { key: 'vfx-tribulation-lightning-4', start: 30, end: 38, frameRate: 14, originX: 0.5 },
]

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
// Vertical offset from the bottom of tribulation-dais@1x.png (1672x941) to the
// center of its circular golden rune platform (y = 545 -> 396px from bottom).
const DAIS_SURFACE_OFFSET_FROM_BOTTOM = 396

// Depth contract: rect bg < storm-far < dais < player < storm-near <
// vignette < lightning(10)/damage text < title(21). Runtime
// characters, strikes, meters and results stay gameplay-owned above.
const TRIBULATION_DEPTH = {
  stormFar: 1,
  dais: 2,
  player: 3,
  stormNear: 4,
  vignette: 5,
  lightning: 10,
  damageText: 12,
  title: 21,
} as const

export class TribulationScene extends Phaser.Scene {
  private player?: Phaser.GameObjects.Sprite
  private playerAspect = 128 / 132
  private playerDisplayHeight = 200
  private daisSurfaceY = 420
  private strikeSegmentIndex = 0
  private envImages: Phaser.GameObjects.Image[] = []
  private eventBus?: EventBus
  private lightningHandler = (payload?: { isFinalStrike?: boolean }) =>
    this.strikeLightning(payload?.isFinalStrike)
  private vitalsHandler = (event: EntityVitalsChangedEvent) => {
    // Bat Tu The co the cuu player sau event killed=true (CombatSystem
    // phat event hieu chinh killed=false ngay sau guard) - alpha phai
    // phan anh trang thai CUOI cua event, khong chi chieu chet.
    if (event.entityId === 'player') this.player?.setAlpha(event.killed ? 0.35 : 1)
    const damage = vitalsDamageAmount(event)
    if (damage !== null) this.showDamage(damage)
  }
  private resizeHandler = (gameSize: ResizeSize) => {
    this.layoutEnvironment(gameSize.width, gameSize.height)
  }
  private shutdownHandler = () => {
    this.scale.off('resize', this.resizeHandler)
    if (this.player) {
      this.tweens?.killTweensOf(this.player)
    }
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
    this.strikeSegmentIndex = 0
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

    if (ENTITY_ART_MODE === 'animated') {
      if (!this.anims.exists(CULTIVATE_KEY)) {
        this.anims.create({
          key: CULTIVATE_KEY,
          frames: this.anims.generateFrameNames(CULTIVATE_KEY, { prefix: 'frame_', suffix: '.png', start: 0, end: 16, zeroPad: 3 }),
          frameRate: FRAME_RATE,
          repeat: -1,
        })
      }

      this.playerAspect = 128 / 132
      this.player = this.add.sprite(width / 2, height * 0.5, CULTIVATE_KEY, 'frame_000.png')
        .play(CULTIVATE_KEY)
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

      this.player = this.add.sprite(width / 2, height * 0.5, textureKey)
        .setDepth(TRIBULATION_DEPTH.player)

      const source = this.textures.get(textureKey).getSourceImage()
      const sourceW = 'width' in source ? Number(source.width) : 128
      const sourceH = 'height' in source ? Number(source.height) : 132
      this.playerAspect = sourceW / Math.max(1, sourceH)
    }

    this.ensureLightningAnimations()
    this.layoutEnvironment(width, height)

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

  private ensureLightningAnimations(): void {
    if (!this.textures.exists(TRIBULATION_LIGHTNING_VFX_KEY)) {
      return
    }
    for (const seg of LIGHTNING_STRIKE_SEGMENTS) {
      if (this.anims.exists(seg.key)) continue
      const frames: Phaser.Types.Animations.AnimationFrame[] = []
      for (let i = seg.start; i <= seg.end; i++) {
        frames.push({ key: TRIBULATION_LIGHTNING_VFX_KEY, frame: `frame_${i}` })
      }
      this.anims.create({
        key: seg.key,
        frames,
        frameRate: seg.frameRate,
        repeat: 0,
      })
    }
  }

  /**
   * Environment layout (stable art contract): storm bands contain-fit the
   * canvas width anchored north; the dais contain-fits width anchored
   * south; the vignette cover-fits the whole canvas centered. Also positions
   * and scales the character right above the golden rune circle on the stone
   * dais with a gentle levitation tween.
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

    this.daisSurfaceY = Math.round(height - DAIS_SURFACE_OFFSET_FROM_BOTTOM * widthScale)
    this.playerDisplayHeight = Math.round(Math.max(196, 236 * widthScale))

    if (this.player) {
      const displayW = Math.round(this.playerDisplayHeight * this.playerAspect)
      // Place character's seated base hovering above the center of the golden rune array on the dais.
      const baseY = Math.round(this.daisSurfaceY - this.playerDisplayHeight * 0.32)
      this.player.setDisplaySize(displayW, this.playerDisplayHeight)
      this.player.setPosition(width / 2, baseY)

      this.tweens?.killTweensOf(this.player)
      this.tweens?.add({
        targets: this.player,
        y: baseY - 12,
        duration: 1650,
        ease: 'Sine.easeInOut',
        yoyo: true,
        repeat: -1,
      })
    }
  }

  private strikeLightning(isFinalStrike?: boolean) {
    if (!this.player) return

    const segIndex = isFinalStrike
      ? LIGHTNING_STRIKE_SEGMENTS.length - 1
      : this.strikeSegmentIndex % LIGHTNING_STRIKE_SEGMENTS.length
    this.strikeSegmentIndex += 1
    const segment = LIGHTNING_STRIKE_SEGMENTS[segIndex]!

    if (this.textures.exists(TRIBULATION_LIGHTNING_VFX_KEY)) {
      this.ensureLightningAnimations()
      const boltHeight = Math.max(420, Math.round(this.daisSurfaceY + 90))
      const boltWidth = Math.round(boltHeight * 0.85)
      const impactY = Math.round(this.daisSurfaceY + 12)

      // Base sprite + additive glow overlay for vivid heavenly lightning contrast
      const boltBase = this.add
        .sprite(this.player.x, impactY, TRIBULATION_LIGHTNING_VFX_KEY, `frame_${segment.start}`)
        .setOrigin(segment.originX, 0.84)
        .setDisplaySize(boltWidth, boltHeight)
        .setDepth(TRIBULATION_DEPTH.lightning)

      const boltGlow = this.add
        .sprite(this.player.x, impactY, TRIBULATION_LIGHTNING_VFX_KEY, `frame_${segment.start}`)
        .setOrigin(segment.originX, 0.84)
        .setDisplaySize(boltWidth, boltHeight)
        .setDepth(TRIBULATION_DEPTH.lightning + 1)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(0xdff8ff)

      boltBase.play(segment.key)
      boltGlow.play(segment.key)

      boltBase.once('animationcomplete', () => boltBase.destroy())
      boltGlow.once('animationcomplete', () => boltGlow.destroy())
    } else {
      const bolt = this.add.graphics().setDepth(TRIBULATION_DEPTH.lightning).setBlendMode(Phaser.BlendModes.ADD)
      bolt.lineStyle(6, 0xeaf7ff, 1).beginPath().moveTo(this.player.x, 0)
      for (let y = 25; y < this.player.y; y += 25) {
        bolt.lineTo(this.player.x + Phaser.Math.Between(-24, 24), y)
      }
      bolt.lineTo(this.player.x, this.player.y).strokePath()
      this.tweens?.add({ targets: bolt, alpha: 0, duration: 260, onComplete: () => bolt.destroy() })
    }

    const isHeavy = segIndex === LIGHTNING_STRIKE_SEGMENTS.length - 1
    this.cameras.main.flash(isHeavy ? 120 : 75, 175, 225, 255, false)
    applyScreenShake(this.cameras.main, isHeavy ? 200 : 120, isHeavy ? 0.015 : 0.009)
    this.player.setTint(0xd8f4ff)
    this.time.delayedCall(120, () => this.player?.clearTint())
  }

  private showDamage(hpDamage: number) {
    if (!this.player) return
    const jitterX = Phaser.Math.Between(-28, 28)
    const text = this.add.text(
      this.player.x + jitterX,
      this.player.y - Math.round(this.playerDisplayHeight * 0.48),
      `-${formatNumber(Math.round(hpDamage))}`,
      {
        fontSize: '24px',
        fontStyle: 'bold',
        color: '#ff8b8b',
        stroke: '#1a0505',
        strokeThickness: 4,
      },
    ).setOrigin(0.5).setDepth(TRIBULATION_DEPTH.damageText)
    this.tweens?.add({ targets: text, y: text.y - 46, alpha: 0, duration: 650, onComplete: () => text.destroy() })
  }

  private unsubscribe() {
    this.eventBus?.off('tribulation_lightning', this.lightningHandler)
    this.eventBus?.off<EntityVitalsChangedEvent>('entity_vitals_changed', this.vitalsHandler)
  }
}
