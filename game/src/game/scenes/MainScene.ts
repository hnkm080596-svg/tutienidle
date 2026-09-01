import Phaser from 'phaser'
import type { EventBus } from '@/core/events/EventBus'
import { queueCombatAssets } from '@/game/support/CombatPreload'

const GROUND_COLOR = 0x1c1712
const SKY_COLOR = 0x11141c

// (2026-08-26) Art base Động Phủ chuyển hẳn về DOM: DongFuScene.vue mount
// thanh-van-dong-fu-base.png làm lớp nền cover-fit. Overlay DOM opaque
// đó đè lên canvas nên image trong scene này KHÔNG BAO GIỜ nhìn thấy —
// pipeline Phaser bị gỡ để không duy trì hai nguồn sự thật song song;
// skyRect/groundRect giữ lại chỉ làm fallback khi canvas trống.

const CHARACTER_HEIGHT_RATIO = 0.22

const GROUND_HEIGHT_RATIO = 0.1
// Ground CHẠM ĐÁY canvas — tính từ GROUND_HEIGHT_RATIO thay vì
// hardcode để luôn đúng bất kể sau này đổi độ dày ground.
const GROUND_Y_RATIO = 1 - GROUND_HEIGHT_RATIO

const PLAYER_ID = 'player'

// Cultivation gating (2026-08-14, rework 2026-08-20) — emit từ
// App.vue's tick() mỗi khi isFighting đổi trạng thái (KHÔNG còn nút
// bấm thủ công), xem ghi chú Player.ts's PlayerData.isCultivating.
interface CultivationStateEvent {
  isCultivating: boolean
}

const CULTIVATION_LABEL = 'Đang Tu Luyện'

// Sprite animation thật (2026-08-20, thay Rectangle placeholder) — 2
// atlas TexturePacker "multi-atlas" riêng (idle/cultivate), mỗi cái tự
// khai `image` trong chính file .json nên dùng load.multiatlas() thay
// vì load.atlas() (atlas() cần truyền tay 1 textureURL, multiatlas()
// tự đọc `image` field). 17 frame mỗi bên, đặt tên frame_000..frame_016
// (xác nhận qua asset-drop/idle.json, cultivate.json). 2 sheet có
// sourceSize khác nhau (idle 76x112, cultivate 128x132) — PHẢI tính
// lại width hiển thị theo đúng tỉ lệ từng sheet mỗi lần đổi animation,
// nếu không nhân vật sẽ méo hình lúc chuyển idle<->cultivate (xem
// updateSpriteDisplaySize()).
// Player visual profile (body-anchor plan §4.3) — Home dùng art MỚI
// theo profile: đứng = combat texture, kiết già = cultivate texture
// (static PNG thay animation atlas). Kích thước nguồn đọc LIVE từ
// texture (getSourceImage) nên đổi profile/texture không cần bảng số
// cứng nữa.
import {
  PLAYER_VISUAL_PROFILES,
  getCultivateTexture,
  resolvePlayerVisualProfileId,
  type PlayerVisualProfileId,
} from '@/game/support/PlayerVisualProfiles'

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
 * Combat UI Redesign — scene này giờ CHỈ render Động Phủ lúc idle (nền
 * trời/đất + nhân vật đứng/ngồi thiền tại HERO_HOME_X) — mọi thứ liên
 * quan chiến đấu thật (quái, missile, animation attack/critical/hit/
 * dodge/cast/death, camera framing) đã dời hẳn sang CombatScene.ts
 * (xem file đó). Scene này CHỈ còn 1 việc khi 'battle_start' tới:
 * chuyển hẳn qua CombatScene (`this.scene.start('CombatScene')`) —
 * KHÔNG tự vẽ combat nữa.
 *
 * Player KHÔNG di chuyển/nội suy gì trong scene này nữa (khác trước —
 * 'positions' chỉ emit lúc battle đang fighting, mà lúc đó scene này
 * đã bị stop() rồi) — vị trí/kích thước chỉ phụ thuộc canvas size
 * (applyBackgroundLayout) và trạng thái ngồi thiền (onCultivationChanged).
 *
 * Vẫn cần lắng nghe resize dù GameRoot.vue là 1 frame cố định + CSS
 * transform: container thật (clientWidth/Height) có thể là 0 đúng
 * lúc PhaserCanvas.vue khởi tạo Phaser.Game() (race với lúc trình
 * duyệt layout xong style tổ tiên) — PhaserCanvas.vue dùng
 * ResizeObserver để báo lại kích thước thật ngay sau đó.
 */
export class MainScene extends Phaser.Scene {
  private skyRect?: Phaser.GameObjects.Rectangle
  private groundRect?: Phaser.GameObjects.Rectangle

  private player?: PlayerSprite

  private eventBus?: EventBus
  private battleStartHandler = () => this.onBattleStart()
  private tribulationStartHandler = () => this.scene.start('TribulationScene')
  private cultivationHandler = (event: CultivationStateEvent) => this.onCultivationChanged(event)
  private playerVisualProfileHandler = () => {
    if (!this.player) {
      return
    }

    const registryProfileId = this.registry.get('playerVisualProfileId') as
      | PlayerVisualProfileId
      | undefined

    if (registryProfileId && PLAYER_VISUAL_PROFILES[registryProfileId]) {
      this.player.profileId = registryProfileId
    }

    this.refreshPlayerTexture()

    this.updateSpriteDisplaySize()
  }

  // Lifecycle listeners dùng handler ỔN ĐỊNH (audit H3, model theo
  // CombatScene) — ScaleManager là game-level nên anonymous callback
  // đăng ký mỗi create() KHÔNG bị gỡ bởi scene shutdown, TÍCH TỤY qua
  // các lần Home ↔ Combat (N listener chạy trên GameObjects đã destroy
  // mỗi resize). events.once đảm bảo shutdown handler tự gỡ đúng một
  // lần mà không tích lũy.
  private resizeHandler = (gameSize: ResizeSize) => {
    this.applyBackgroundLayout(gameSize.width, gameSize.height)
  }

  private shutdownHandler = () => {
    this.unsubscribeCombatEvents()
    this.scale.off('resize', this.resizeHandler)

    // Audit fix 2026-08-31 — null refs scene-scoped: (a) resize callback lỡ trúng
    // giữa shutdown không mutate dead GameObjects (applyBackgroundLayout đã có
    // null guard), (b) closure không giữ scene state khỏi GC qua các lần restart.
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
    // Eager-load toàn bộ texture combat (thanh-van variant phiên + gourd +
    // 20 art quái + player profiles) NGAY LÚC BOOT — CombatScene.start()
    // lần ĐẦU (ngay sau 'battle_start') sẽ có loader queue rỗng, create()
    // chạy gần như tức thời nên không bỏ lỡ phase spawn telegraph
    // (fix "lần đầu vào combat không thấy spawn animation", 2026-08-26).
    queueCombatAssets(this)
  }

  create() {
    // Rectangle (Shape) trong Phaser mặc định setOrigin(0, 0) (neo góc
    // trên-trái) khác với Sprite/Image — phải tự setOrigin(0.5) lại,
    // không thì rect chỉ hiện đúng 1/4 phía dưới-phải của vị trí mong
    // muốn (đã thấy qua Playwright).
    this.skyRect = this.add.rectangle(0, 0, 0, 0, SKY_COLOR).setOrigin(0.5)
    this.groundRect = this.add.rectangle(0, 0, 0, 0, GROUND_COLOR).setOrigin(0.5)

    // Player visual profile (plan §4.3) — static texture theo profile;
    // KHÔNG còn animation atlas idle/cultivate ở scene này.
    const registryProfileId = this.registry.get('playerVisualProfileId') as
      | PlayerVisualProfileId
      | undefined

    const profileId =
      registryProfileId && PLAYER_VISUAL_PROFILES[registryProfileId]
        ? registryProfileId
        : resolvePlayerVisualProfileId({})

    const sprite = this.add.sprite(0, 0, PLAYER_VISUAL_PROFILES[profileId].combatTextureKey)
    const label = this.add.text(0, 0, 'Player', { fontSize: '14px', color: '#ffffff' }).setOrigin(0.5, 0)

    this.player = { sprite, label, sitting: false, profileId }

    this.applyBackgroundLayout(this.scale.width, this.scale.height)

    this.scale.on('resize', this.resizeHandler)

    this.subscribeCombatEvents()

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

  // Static art theo profile — sourceSize đọc LIVE từ texture hiện hành
  // (mỗi profile/art có kích thước nguồn khác nhau), giữ characterHeight
  // cố định và tự suy width theo đúng tỉ lệ.
  private updateSpriteDisplaySize() {
    if (!this.player) {
      return
    }

    const sourceImage = this.textures.get(this.player.sprite.texture.key).getSourceImage()

    const sourceWidth = 'width' in sourceImage ? Number(sourceImage.width) : 1

    const sourceHeight = 'height' in sourceImage ? Number(sourceImage.height) : 1

    const width = this.characterHeight * (sourceWidth / Math.max(1, sourceHeight))

    this.player.sprite.setDisplaySize(width, this.characterHeight)
  }

  /** Texture key theo profile + pose đang hiển thị (plan §4.1 bảng). */
  private textureKeyForCurrentPose(): string {
    if (!this.player) {
      return PLAYER_VISUAL_PROFILES.mortal.combatTextureKey
    }

    const profile = PLAYER_VISUAL_PROFILES[this.player.profileId]

    return this.player.sitting
      ? getCultivateTexture(profile).key
      : profile.combatTextureKey
  }

  private refreshPlayerTexture() {
    if (!this.player) {
      return
    }

    const key = this.textureKeyForCurrentPose()

    if (this.textures.exists(key) && this.player.sprite.texture.key !== key) {
      this.player.sprite.setTexture(key)
    }
  }

  // Player luôn đứng giữa Home Scene (HERO_HOME_X = 0, xem BattleLane.ts)
  // — không di chuyển/nội suy gì ở đây nữa (khác lúc combat, xem class
  // doc), nên world 0 map thẳng vào chính giữa canvas. Chiều cao hiển
  // thị giờ LUÔN characterHeight (animation cultivate tự vẽ dáng ngồi
  // thật, không cần co rect giả như bản Rectangle cũ).
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
    const eventBus = this.registry.get('eventBus') as EventBus | undefined

    if (!eventBus) {
      return
    }

    this.eventBus = eventBus

    eventBus.on<void>('battle_start', this.battleStartHandler)
    eventBus.on<void>('tribulation_started', this.tribulationStartHandler)
    eventBus.on<CultivationStateEvent>('cultivation_changed', this.cultivationHandler)
    // Player visual profile bridge (plan §4.2) — đổi hình thái áp dụng
    // texture NGAY cho pose đang hiển thị.
    eventBus.on('player_visual_profile_changed', this.playerVisualProfileHandler)
  }

  private unsubscribeCombatEvents() {
    if (!this.eventBus) {
      return
    }

    this.eventBus.off<void>('battle_start', this.battleStartHandler)
    this.eventBus.off<void>('tribulation_started', this.tribulationStartHandler)
    this.eventBus.off<CultivationStateEvent>('cultivation_changed', this.cultivationHandler)
    this.eventBus.off('player_visual_profile_changed', this.playerVisualProfileHandler)
  }

  // Cultivation gating — đổi TEXTURE tĩnh sang art kiết già (theo profile
  // hiện hành) khi isCultivating=true, trả lại art đứng khi false (plan
  // §4.3: static swap thay animation atlas cũ).
  private onCultivationChanged(event: CultivationStateEvent) {
    if (!this.player) {
      return
    }

    this.player.sitting = event.isCultivating

    this.player.label.setText(event.isCultivating ? CULTIVATION_LABEL : 'Player')

    this.refreshPlayerTexture()

    this.updateSpriteDisplaySize()
    this.positionPlayer()
  }

  // Combat UI Redesign — 1 trận thật sự bắt đầu (kể cả Auto tự nối
  // trận) — Home Scene không còn tự vẽ combat nữa, chuyển hẳn quyền
  // render qua CombatScene (xem class doc). Phaser tự stop() scene này
  // khi start() scene khác.
  private onBattleStart() {
    this.scene.start('CombatScene')
  }
}
