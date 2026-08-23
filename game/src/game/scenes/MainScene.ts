import Phaser from 'phaser'
import type { EventBus } from '@/core/events/EventBus'

const GROUND_COLOR = 0x1c1712
const SKY_COLOR = 0x11141c

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
const IDLE_KEY = 'char-idle'
const CULTIVATE_KEY = 'char-cultivate'
const IDLE_SOURCE_SIZE = { w: 76, h: 112 }
const CULTIVATE_SOURCE_SIZE = { w: 128, h: 132 }
const ANIMATION_FRAME_RATE = 8

interface ResizeSize {
  width: number
  height: number
}

interface PlayerSprite {
  sprite: Phaser.GameObjects.Sprite
  label: Phaser.GameObjects.Text
  sitting: boolean
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

  private canvasWidth = 0
  private canvasHeight = 0
  private groundY = 0
  private characterY = 0
  private characterHeight = 0

  constructor() {
    super('MainScene')
  }

  preload() {
    // load.multiatlas() (KHÔNG phải load.atlas()) — atlas TexturePacker
    // dạng "multi-atlas" tự khai `image` bên trong chính file .json
    // (xem asset-drop/idle.json's `textures[0].image`), multiatlas() tự
    // đọc field đó rồi ghép với `path` (tham số 3) để tìm ảnh, atlas()
    // thì bắt buộc truyền tay 1 textureURL nên không khớp shape này.
    if (!this.textures.exists(IDLE_KEY)) {
      this.load.multiatlas(IDLE_KEY, 'assets/idle.json', 'assets')
    }

    if (!this.textures.exists(CULTIVATE_KEY)) {
      this.load.multiatlas(CULTIVATE_KEY, 'assets/cultivate.json', 'assets')
    }
  }

  create() {
    // Rectangle (Shape) trong Phaser mặc định setOrigin(0, 0) (neo góc
    // trên-trái) khác với Sprite/Image — phải tự setOrigin(0.5) lại,
    // không thì rect chỉ hiện đúng 1/4 phía dưới-phải của vị trí mong
    // muốn (đã thấy qua Playwright).
    this.skyRect = this.add.rectangle(0, 0, 0, 0, SKY_COLOR).setOrigin(0.5)
    this.groundRect = this.add.rectangle(0, 0, 0, 0, GROUND_COLOR).setOrigin(0.5)

    // 17 frame mỗi atlas, đặt tên frame_000.png..frame_016.png (xác
    // nhận qua asset-drop/idle.json/cultivate.json) — Sprite (khác
    // Rectangle) đã mặc định setOrigin(0.5), không cần chỉnh tay.
    if (!this.anims.exists(IDLE_KEY)) {
      this.anims.create({
        key: IDLE_KEY,
        frames: this.anims.generateFrameNames(IDLE_KEY, { prefix: 'frame_', suffix: '.png', start: 0, end: 16, zeroPad: 3 }),
        frameRate: ANIMATION_FRAME_RATE,
        repeat: -1,
      })
    }

    if (!this.anims.exists(CULTIVATE_KEY)) {
      this.anims.create({
        key: CULTIVATE_KEY,
        frames: this.anims.generateFrameNames(CULTIVATE_KEY, { prefix: 'frame_', suffix: '.png', start: 0, end: 16, zeroPad: 3 }),
        frameRate: ANIMATION_FRAME_RATE,
        repeat: -1,
      })
    }

    const sprite = this.add.sprite(0, 0, IDLE_KEY, 'frame_000.png').play(IDLE_KEY)
    const label = this.add.text(0, 0, 'Player', { fontSize: '14px', color: '#ffffff' }).setOrigin(0.5, 0)

    this.player = { sprite, label, sitting: false }

    this.applyBackgroundLayout(this.scale.width, this.scale.height)

    this.scale.on('resize', (gameSize: ResizeSize) => {
      this.applyBackgroundLayout(gameSize.width, gameSize.height)
    })

    this.subscribeCombatEvents()

    this.events.on('shutdown', () => this.unsubscribeCombatEvents())
  }

  private applyBackgroundLayout(width: number, height: number) {
    if (!this.skyRect || !this.groundRect || !this.player) {
      return
    }

    this.canvasWidth = width
    this.canvasHeight = height

    this.skyRect.setPosition(width / 2, height / 2)
    this.skyRect.width = width
    this.skyRect.height = height
    // width/height gán trực tiếp KHÔNG tự cập nhật displayOrigin (chỉ
    // setSize() mới làm việc đó) — thiếu bước này thì rect chỉ hiện
    // đúng góc dưới-phải của vị trí mong muốn (đã thấy qua Playwright).
    this.skyRect.updateDisplayOrigin()

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

  // idle/cultivate là 2 atlas RIÊNG với sourceSize khác nhau (76x112 vs
  // 128x132, xem hằng số đầu file) — nếu setDisplaySize() cùng 1 width
  // cứng cho cả 2 thì 1 trong 2 sẽ méo hình. Luôn giữ characterHeight cố
  // định, tự suy width theo ĐÚNG tỉ lệ khung hình của sheet đang phát.
  private updateSpriteDisplaySize() {
    if (!this.player) {
      return
    }

    const sourceSize = this.player.sitting ? CULTIVATE_SOURCE_SIZE : IDLE_SOURCE_SIZE
    const width = this.characterHeight * (sourceSize.w / sourceSize.h)

    this.player.sprite.setDisplaySize(width, this.characterHeight)
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
  }

  private unsubscribeCombatEvents() {
    if (!this.eventBus) {
      return
    }

    this.eventBus.off<void>('battle_start', this.battleStartHandler)
    this.eventBus.off<void>('tribulation_started', this.tribulationStartHandler)
    this.eventBus.off<CultivationStateEvent>('cultivation_changed', this.cultivationHandler)
  }

  // Cultivation gating — đổi animation player sang "ngồi thiền" (sheet
  // cultivate + đổi label) khi isCultivating=true, trả lại idle khi
  // false.
  private onCultivationChanged(event: CultivationStateEvent) {
    if (!this.player) {
      return
    }

    this.player.sitting = event.isCultivating
    this.player.label.setText(event.isCultivating ? CULTIVATION_LABEL : 'Player')
    this.player.sprite.play(event.isCultivating ? CULTIVATE_KEY : IDLE_KEY)

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
