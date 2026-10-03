import Phaser from 'phaser'
import type { EventBus } from '@/core/events/EventBus'
import { readOptionalGate } from '@/presentation/gate/PresentationGate'

const GROUND_COLOR = 0x1c1712
const SKY_COLOR = 0x11141c

// (2026-08-26) Art base Dong Phu chuyen han ve DOM: DongFuScene.vue mount
// thanh-van-dong-fu-base.png lam lop nen cover-fit. Overlay DOM opaque
// do de len canvas nen image trong scene nay KHONG BAO GIO nhin thay -
// pipeline Phaser bi go de khong duy tri hai nguon su that song song;
// skyRect/groundRect giu lai chi lam fallback khi canvas trong.

const CHARACTER_HEIGHT_RATIO = 0.22

const GROUND_HEIGHT_RATIO = 0.1
// Ground CHAM DAY canvas - tinh tu GROUND_HEIGHT_RATIO thay vi
// hardcode de luon dung bat ke sau nay doi do day ground.
const GROUND_Y_RATIO = 1 - GROUND_HEIGHT_RATIO

const PLAYER_ID = 'player'

// Cultivation gating (2026-08-14, rework 2026-08-20) - emit tu
// App.vue's tick() moi khi isFighting doi trang thai (KHONG con nut
// bam thu cong), xem ghi chu Player.ts's PlayerData.isCultivating.
interface CultivationStateEvent {
  isCultivating: boolean
}

const CULTIVATION_LABEL = 'Đang Tu Luyện'

// Sprite animation that (2026-08-20, thay Rectangle placeholder) - 2
// atlas TexturePacker "multi-atlas" rieng (idle/cultivate), moi cai tu
// khai `image` trong chinh file .json nen dung load.multiatlas() thay
// vi load.atlas() (atlas() can truyen tay 1 textureURL, multiatlas()
// tu doc `image` field). 17 frame moi ben, dat ten frame_000..frame_016
// (xac nhan qua asset-drop/idle.json, cultivate.json). 2 sheet co
// sourceSize khac nhau (idle 76x112, cultivate 128x132) - PHAI tinh
// lai width hien thi theo dung ti le tung sheet moi lan doi animation,
// neu khong nhan vat se meo hinh luc chuyen idle<->cultivate (xem
// updateSpriteDisplaySize()).
// Player visual profile (body-anchor plan sec4.3) - Home dung art MOI
// theo profile: dung = combat texture, kiet gia = cultivate texture
// (static PNG thay animation atlas). Kich thuoc nguon doc LIVE tu
// texture (getSourceImage) nen doi profile/texture khong can bang so
// cung nua.
import {
  PLAYER_VISUAL_PROFILES,
  getCultivateTexture,
  resolvePlayerVisualProfileId,
  type PlayerVisualProfileId,
} from '@/presentation/art/PlayerVisualProfiles'
import { ENTITY_ART_MODE } from '@/presentation/art/EntityArtMode'
import {
  animatedArtFormFor,
  resolvePlayerEntityKey,
} from '@/presentation/art/CombatPresentationCatalogue'
import { resolveCharacterArtSlugs } from '@/game/support/CharacterArt'
import { combatAnimationKey } from '@/presentation/art/CombatEntityPresentation'
import { registerClipCatalogue } from './combat/combat-animation-playback'
import type { CultivationWayId } from '@/core/player/CultivationPathKit'

// 'char-cultivate' is the legacy 17-frame bridge multiatlas - the sitting
// pose in ANIMATED mode until player atlases carry a cultivate clip
// (uniformity plan, 2026-09-19). Its authored sourceSize is 128x132.
const CULTIVATE_BRIDGE_KEY = 'char-cultivate'
const CULTIVATE_BRIDGE_SOURCE_SIZE = { w: 128, h: 132 }

interface ResizeSize {
  width: number
  height: number
}

interface PlayerSprite {
  sprite: Phaser.GameObjects.Sprite

  label: Phaser.GameObjects.Text

  sitting: boolean

  profileId: PlayerVisualProfileId
}

/**
 * Combat UI Redesign - scene nay gio CHI render Dong Phu luc idle (nen
 * troi/dat + nhan vat dung/ngoi thien tai HERO_HOME_X) - moi thu lien
 * quan chien dau that (quai, missile, animation attack/critical/hit/
 * dodge/cast/death, camera framing) da doi han sang CombatScene.ts
 * (xem file do). Scene nay CHI con 1 viec khi 'battle_start' toi:
 * chuyen han qua CombatScene (`this.scene.start('CombatScene')`) -
 * KHONG tu ve combat nua.
 *
 * Player KHONG di chuyen/noi suy gi trong scene nay nua (khac truoc -
 * 'positions' chi emit luc battle dang fighting, ma luc do scene nay
 * da bi stop() roi) - vi tri/kich thuoc chi phu thuoc canvas size
 * (applyBackgroundLayout) va trang thai ngoi thien (onCultivationChanged).
 *
 * Van can lang nghe resize du GameRoot.vue la 1 frame co dinh + CSS
 * transform: container that (clientWidth/Height) co the la 0 dung
 * luc PhaserCanvas.vue khoi tao Phaser.Game() (race voi luc trinh
 * duyet layout xong style to tien) - PhaserCanvas.vue dung
 * ResizeObserver de bao lai kich thuoc that ngay sau do.
 */
export class MainScene extends Phaser.Scene {
  private skyRect?: Phaser.GameObjects.Rectangle
  private groundRect?: Phaser.GameObjects.Rectangle

  private player?: PlayerSprite

  private eventBus?: EventBus

  // Armed/unarmed discriminator + hidden-way cultivate pick (art-seam
  // wave, user rulings Q2/Q3). Both are scene-level facts read from the
  // registry gate - true matches the armed resolver default when absent.
  private playerArmed = true
  private playerCultivationWay?: CultivationWayId

  private cultivationHandler = (event: CultivationStateEvent) => this.onCultivationChanged(event)
  private playerVisualProfileHandler = () => {
    if (!this.player) {
      return
    }

    const registryProfileId = readOptionalGate(this.registry, 'playerVisualProfileId')
    const registryArmed = readOptionalGate(this.registry, 'playerVisualArmed')

    if (registryArmed !== undefined) {
      this.playerArmed = registryArmed
    }

    this.playerCultivationWay = readOptionalGate(this.registry, 'playerCultivationWay')

    if (registryProfileId && PLAYER_VISUAL_PROFILES[registryProfileId]) {
      this.player.profileId = registryProfileId
    }

    this.refreshPlayerTexture()

    this.updateSpriteDisplaySize()
  }

  // Lifecycle listeners dung handler ON DINH (audit H3, model theo
  // CombatScene) - ScaleManager la game-level nen anonymous callback
  // dang ky moi create() KHONG bi go boi scene shutdown, TICH TUY qua
  // cac lan Home <-> Combat (N listener chay tren GameObjects da destroy
  // moi resize). events.once dam bao shutdown handler tu go dung mot
  // lan ma khong tich luy.
  private resizeHandler = (gameSize: ResizeSize) => {
    this.applyBackgroundLayout(gameSize.width, gameSize.height)
  }

  private shutdownHandler = () => {
    this.unsubscribeCombatEvents()
    this.scale.off('resize', this.resizeHandler)

    // Audit fix 2026-08-31 - null refs scene-scoped: (a) resize callback lo trung
    // giua shutdown khong mutate dead GameObjects (applyBackgroundLayout da co
    // null guard), (b) closure khong giu scene state khoi GC qua cac lan restart.
    this.skyRect = undefined
    this.groundRect = undefined
    this.player = undefined
    this.eventBus = undefined
  }

  private canvasWidth = 0
  private canvasHeight = 0
  private groundY = 0
  private characterY = 0
  private characterHeight = 0

  constructor() {
    super('MainScene')
  }

  preload() {
    // Eager combat preload removed (Task 13). Assets are ensured by AssetBundleManager before scene activation.
  }

  private initTransitionId = 0
  private initGameGeneration = 0

  init(data?: { transitionId?: number; gameGeneration?: number }): void {
    this.initTransitionId = data?.transitionId ?? 0
    this.initGameGeneration = data?.gameGeneration ?? 0
  }

  create() {
    // Rectangle (Shape) trong Phaser mac dinh setOrigin(0, 0) (neo goc
    // tren-trai) khac voi Sprite/Image - phai tu setOrigin(0.5) lai,
    // khong thi rect chi hien dung 1/4 phia duoi-phai cua vi tri mong
    // muon (da thay qua Playwright).
    this.skyRect = this.add.rectangle(0, 0, 0, 0, SKY_COLOR).setOrigin(0.5)
    this.groundRect = this.add.rectangle(0, 0, 0, 0, GROUND_COLOR).setOrigin(0.5)

    // Player visual profile (plan sec4.3) - static texture theo profile;
    // KHONG con animation atlas idle/cultivate o scene nay.
    const registryProfileId = readOptionalGate(this.registry, 'playerVisualProfileId')
    const registryArmed = readOptionalGate(this.registry, 'playerVisualArmed')

    if (registryArmed !== undefined) {
      this.playerArmed = registryArmed
    }

    this.playerCultivationWay = readOptionalGate(this.registry, 'playerCultivationWay')

    const profileId =
      registryProfileId && PLAYER_VISUAL_PROFILES[registryProfileId]
        ? registryProfileId
        : resolvePlayerVisualProfileId({})

    const sprite = this.add.sprite(0, 0, PLAYER_VISUAL_PROFILES[profileId].combatTextureKey)
    // FE-06 - authored player name on the nameplate (was literal 'Player').
    const playerName =
      readOptionalGate(this.registry, 'gameManager')?.getActivePlayerName?.() ?? 'Player'
    const label = this.add.text(0, 0, playerName, { fontSize: '14px', color: '#ffffff' }).setOrigin(0.5, 0)

    this.player = { sprite, label, sitting: false, profileId }

    if (ENTITY_ART_MODE === 'animated') {
      // Register every profile's clip set (the profile can switch while Home
      // is alive - playerVisualProfileHandler swaps profileId) plus the
      // cultivate bridge loop, then kick the standing pose's idle.
      for (const profile of Object.values(PLAYER_VISUAL_PROFILES)) {
        // Every mapped slug registers (armed AND unarmed) - a mid-scene
        // profile/basic-skill change must not hit unregistered anim keys.
        const entityKeys = new Set([
          ...resolveCharacterArtSlugs(profile.id),
          resolvePlayerEntityKey(profile.id, profile.combatTextureKey, {
            armed: this.playerArmed,
          }),
        ])

        for (const entityKey of entityKeys) {
          const clips = animatedArtFormFor(entityKey)

          if (clips) {
            registerClipCatalogue(this.anims, clips)
          }
        }
      }

      if (!this.anims.exists(CULTIVATE_BRIDGE_KEY)) {
        this.anims.create({
          key: CULTIVATE_BRIDGE_KEY,
          frames: this.anims.generateFrameNames(CULTIVATE_BRIDGE_KEY, {
            prefix: 'frame_',
            suffix: '.png',
            start: 0,
            end: 16,
            zeroPad: 3,
          }),
          frameRate: 8,
          repeat: -1,
        })
      }

      this.playCurrentPoseClip()
    }

    this.applyBackgroundLayout(this.scale.width, this.scale.height)

    this.scale.on('resize', this.resizeHandler)

    this.subscribeCombatEvents()

    const adapter = readOptionalGate(this.registry, 'sceneAdapter')
    adapter?.reportReady({
      transitionId: this.initTransitionId,
      gameGeneration: this.initGameGeneration,
    })

    this.events.once('shutdown', this.shutdownHandler)
  }

  private applyBackgroundLayout(width: number, height: number) {
    if (!this.skyRect || !this.groundRect || !this.player) {
      return
    }

    this.canvasWidth = width
    this.canvasHeight = height

    this.groundY = height * GROUND_Y_RATIO
    const groundHeight = height * GROUND_HEIGHT_RATIO

    this.groundRect.setPosition(width / 2, this.groundY + groundHeight / 2)
    this.groundRect.width = width
    this.groundRect.height = groundHeight
    this.groundRect.updateDisplayOrigin()

    this.characterHeight = height * CHARACTER_HEIGHT_RATIO
    this.characterY = this.groundY - this.characterHeight / 2

    this.updateSpriteDisplaySize()
    this.positionPlayer()
  }

  // Static art theo profile - sourceSize doc LIVE tu texture hien hanh
  // (moi profile/art co kich thuoc nguon khac nhau), giu characterHeight
  // co dinh va tu suy width theo dung ti le. Animated mode reads the active
  // CLIP's authored sourceSize - the atlas texture's own image is the whole
  // sheet, which would produce a nonsense aspect.
  private updateSpriteDisplaySize() {
    if (!this.player) {
      return
    }

    if (ENTITY_ART_MODE === 'animated') {
      const sourceSize = this.currentClipSourceSize()
      const width = this.characterHeight * (sourceSize.w / Math.max(1, sourceSize.h))

      this.player.sprite.setDisplaySize(width, this.characterHeight)
      return
    }

    const sourceImage = this.textures.get(this.player.sprite.texture.key).getSourceImage()

    const sourceWidth = 'width' in sourceImage ? Number(sourceImage.width) : 1

    const sourceHeight = 'height' in sourceImage ? Number(sourceImage.height) : 1

    const width = this.characterHeight * (sourceWidth / Math.max(1, sourceHeight))

    this.player.sprite.setDisplaySize(width, this.characterHeight)
  }

  /** Texture key theo profile + pose dang hien thi (plan sec4.1 bang). */
  private textureKeyForCurrentPose(): string {
    if (!this.player) {
      return PLAYER_VISUAL_PROFILES.mortal.combatTextureKey
    }

    const profile = PLAYER_VISUAL_PROFILES[this.player.profileId]

    return this.player.sitting
      ? getCultivateTexture(profile, this.playerCultivationWay).key
      : profile.combatTextureKey
  }

  /**
   * The authored sourceSize of whatever the player is drawing right now,
   * animated mode only: the pose's clip, or the cultivate bridge's 128x132
   * box when the profile has no cultivate clip yet.
   */
  private currentClipSourceSize(): { w: number; h: number } {
    const profile = this.player
      ? PLAYER_VISUAL_PROFILES[this.player.profileId]
      : PLAYER_VISUAL_PROFILES.mortal
    const clips = animatedArtFormFor(
      resolvePlayerEntityKey(profile.id, profile.combatTextureKey, {
        armed: this.playerArmed,
      }),
    )

    if (this.player?.sitting) {
      return clips?.cultivate?.sourceSize ?? CULTIVATE_BRIDGE_SOURCE_SIZE
    }

    return clips?.idle.sourceSize ?? { w: 1, h: 1 }
  }

  /**
   * Animated mode - the pose is a CLIP, not a texture: standing plays the
   * profile's idle loop, sitting plays its cultivate clip when authored or
   * the shared bridge multiatlas when it is not. Playing an animation also
   * swaps the sprite onto that clip's sheet, so no setTexture is needed.
   */
  private playCurrentPoseClip() {
    if (!this.player) {
      return
    }

    const profile = PLAYER_VISUAL_PROFILES[this.player.profileId]
    // Reskin-aware (F-CB2-05): resolve the character slug, not the legacy
    // profile texture key, so dormant animated mode renders the same art
    // combat does.
    const entityKey = resolvePlayerEntityKey(profile.id, profile.combatTextureKey, {
      armed: this.playerArmed,
    })
    const clips = animatedArtFormFor(entityKey)
    const key = this.player.sitting
      ? (clips?.cultivate?.key ?? CULTIVATE_BRIDGE_KEY)
      : clips
        ? combatAnimationKey(entityKey, 'idle')
        : undefined

    if (key && this.anims.exists(key) && this.player.sprite.anims.currentAnim?.key !== key) {
      this.player.sprite.play(key)
    }
  }

  private refreshPlayerTexture() {
    if (!this.player) {
      return
    }

    if (ENTITY_ART_MODE === 'animated') {
      this.playCurrentPoseClip()
      return
    }

    const key = this.textureKeyForCurrentPose()

    if (this.textures.exists(key) && this.player.sprite.texture.key !== key) {
      this.player.sprite.setTexture(key)
    }
  }

  // Player luon dung giua Home Scene (HERO_HOME_X = 0, xem BattleLane.ts)
  // - khong di chuyen/noi suy gi o day nua (khac luc combat, xem class
  // doc), nen world 0 map thang vao chinh giua canvas. Chieu cao hien
  // thi gio LUON characterHeight (animation cultivate tu ve dang ngoi
  // that, khong can co rect gia nhu ban Rectangle cu).
  private positionPlayer() {
    if (!this.player) {
      return
    }

    const screenX = this.canvasWidth / 2
    const screenY = this.groundY - this.characterHeight / 2

    this.player.sprite.setPosition(screenX, screenY)
    this.player.label.setPosition(screenX, screenY + this.characterHeight / 2 + 4)
  }

  private subscribeCombatEvents() {
    const eventBus = readOptionalGate(this.registry, 'eventBus')

    if (!eventBus) {
      return
    }

    this.eventBus = eventBus

    eventBus.on<CultivationStateEvent>('cultivation_changed', this.cultivationHandler)
    // Player visual profile bridge (plan sec4.2) - doi hinh thai ap dung
    // texture NGAY cho pose dang hien thi.
    eventBus.on('player_visual_profile_changed', this.playerVisualProfileHandler)
  }

  private unsubscribeCombatEvents() {
    if (!this.eventBus) {
      return
    }

    this.eventBus.off<CultivationStateEvent>('cultivation_changed', this.cultivationHandler)
    this.eventBus.off('player_visual_profile_changed', this.playerVisualProfileHandler)
  }

  // Cultivation gating - doi TEXTURE tinh sang art kiet gia (theo profile
  // hien hanh) khi isCultivating=true, tra lai art dung khi false (plan
  // sec4.3: static swap thay animation atlas cu).
  private onCultivationChanged(event: CultivationStateEvent) {
    if (!this.player) {
      return
    }

    this.player.sitting = event.isCultivating

    const playerName =
      readOptionalGate(this.registry, 'gameManager')?.getActivePlayerName?.() ?? 'Player'
    this.player.label.setText(event.isCultivating ? CULTIVATION_LABEL : playerName)

    this.refreshPlayerTexture()

    this.updateSpriteDisplaySize()
    this.positionPlayer()
  }
}
