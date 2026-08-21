import Phaser from 'phaser'
import type { EventBus } from '@/core/events/EventBus'
import type { BattlePositionsEvent, BattleEndEvent } from '@/core/battle/BattleEvents'
import { HERO_HOME_X, type EnemyLane } from '@/core/battle/BattleLane'
import { MISSILE_SPEED } from '@/core/combat/missile/MissileSystem'
import type { CombatEvent } from '@/core/combat/CombatEvent'
import { formatNumber } from '@/core/format/NumberFormatter'
import {
  DESIGN_HEIGHT,
  COMBAT_TOP_BAR_HEIGHT,
  COMBAT_STATUS_BAR_HEIGHT,
  COMBAT_EVENT_BAR_HEIGHT,
  COMBAT_CONTROL_BAR_HEIGHT,
} from '@/core/ui/DesignFrame'

const PLAYER_COLOR = 0x4a90d9
const ENEMY_COLOR = 0xd94a4a
const GROUND_COLOR = 0x1c1712
const SKY_COLOR = 0x11141c

// Player idle animation thật (2026-08-21) — thay Rectangle placeholder,
// CÙNG atlas/key MainScene.ts (Động Phủ) đã dùng từ 2026-08-20 (xem
// MainScene.ts's ghi chú) — TextureManager/AnimationManager của Phaser
// là GLOBAL theo Game instance (không riêng theo Scene), nên dùng
// chung key 'char-idle' để 2 scene chia sẻ đúng 1 bản load, không tải
// lại — mỗi bên tự guard qua textures.exists()/anims.exists() (xem
// preload()/create() bên dưới) vì Phaser re-chạy preload()/create()
// MỖI LẦN scene.start() được gọi lại (đổi Home <-> Combat liên tục mỗi
// trận), không phải 1 lần duy nhất lúc boot. Enemy CHƯA có atlas nào —
// vẫn giữ Rectangle màu (ENEMY_COLOR) như cũ.
const IDLE_KEY = 'char-idle'
const IDLE_SOURCE_SIZE = { w: 76, h: 112 }
const ANIMATION_FRAME_RATE = 8

const HIT_FLASH_COLOR = 0xff6b6b
const CRITICAL_FLASH_COLOR = 0xffffff
const CAST_GLOW_COLOR = 0xffffff
const MISSILE_COLOR_PLAYER = 0x8be9fd
const MISSILE_COLOR_ENEMY = 0xffb86c

// Cast Time (2026-08-21) — cast bar hiện phía TRÊN đầu unit (đối xứng
// với label tên hiện phía dưới), màu vàng tách hẳn khỏi mọi màu số nảy
// (đỏ/trắng/vàng chói của Chí Mạng) để không lẫn — dùng CÙNG gold nhạt
// hơn CRITICAL_DAMAGE_COLOR.
const CAST_BAR_BG_COLOR = 0x1c1712
const CAST_BAR_FILL_COLOR = 0xf4c542
const CAST_BAR_HEIGHT = 5
const CAST_BAR_OFFSET_Y = 10
const CAST_NAME_COLOR = '#f4c542'

// Nảy số sát thương (spec CombatUIredesign mục 10 — "Damage thông
// thường vẫn hiển thị trực tiếp trên enemy") — cùng nguồn dữ liệu
// event 'damage' mà CombatStatusBar.vue (thanh trạng thái) đang dùng
// để cập nhật HP bar, chỉ khác nơi tiêu thụ (Phaser vẽ số nảy lên thay
// vì Vue vẽ thanh máu) — 1 event, 2 cách thể hiện trực quan song song.
// Đỏ cho sát thương NHẬN vào (target là player), trắng cho sát thương
// GÂY RA (target là quái), vàng riêng cho đòn Chí Mạng bất kể chiều.
const DAMAGE_DEALT_COLOR = '#f4f4f0'
const DAMAGE_TAKEN_COLOR = '#ff6b6b'
const CRITICAL_DAMAGE_COLOR = '#ffd54f'

const CHARACTER_HEIGHT_RATIO = 0.22
const CHARACTER_WIDTH_RATIO = 0.45 // tỉ lệ so với chiều cao nhân vật

const GROUND_HEIGHT_RATIO = 0.1

const LANE_Y_OFFSET_RATIO: Record<EnemyLane, number> = {
  air: -1.6,
  ground: 0,
  underground: 0.4,
}

// Hero cố định X ≈ 12% chiều rộng battlefield (spec CombatUIredesign
// mục 6 — "X ≈ 10–15%") — KHÔNG tween pivot/zoom như MainScene.ts bản
// cũ nữa (đó là để né panel trái vẫn mở trong lúc combat; Combat Scene
// giờ chiếm toàn màn hình, không còn panel nào đè lên battlefield).
const HERO_PIVOT_RATIO = 0.12

const WORLD_VIEW_HALF_WIDTH = 300

// Sàn thời lượng 1 đoạn nội suy — tránh chia gần 0 nếu 2 lần cập nhật
// vị trí liên tiếp tới quá sát nhau.
const MIN_SEGMENT_DURATION_MS = 16

const PLAYER_ID = 'player'

interface CombatScenePayload {
  sourceId?: string
  targetId?: string
  skillId?: string
  // Cast Time (2026-08-21) — 'cast_start' đi kèm 2 field này (xem
  // BattleSystem.beginCast()): skillName để nảy chữ TÊN SKILL lên đầu
  // unit (khác 'cast' cũ — chỉ flash màu, không hiện tên), castTimeSeconds
  // để biết cast bar chạy trong bao lâu (tween duration).
  skillName?: string
  castTimeSeconds?: number
}

interface ResizeSize {
  width: number
  height: number
}

interface EntitySprite {
  // Player = Sprite thật (idle animation), enemy = Rectangle màu (chưa
  // có atlas riêng). `kind` phân biệt để biết dùng setFillStyle() hay
  // setTint()/clearTint() (flashColor()/resetVisual()) — mọi thao tác
  // position/scale/rotation/alpha khác đều dùng chung API (Transform
  // component có ở cả 2 loại GameObject).
  kind: 'rect' | 'sprite'
  rect: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Sprite
  label: Phaser.GameObjects.Text
  color: number
  offsetX: number
  lane: EnemyLane
}

interface PositionInterpolation {
  fromX: number
  toX: number
  segmentStart: number
  segmentDuration: number
}

interface CastBarSprite {
  bg: Phaser.GameObjects.Rectangle
  fill: Phaser.GameObjects.Rectangle
  widthPx: number
}

/**
 * Combat UI Redesign — battlefield riêng, TÁCH KHỎI MainScene.ts (Động
 * Phủ/Home) hoàn toàn. MainScene.ts gọi `this.scene.start('CombatScene')`
 * khi nhận 'battle_start' (xem MainScene.ts); scene này tự gọi
 * `this.scene.start('MainScene')` lại khi nhận 'combat_scene_exit' (Vue
 * emit khi người chơi bấm "Tiếp Tục"/"Về Động Phủ" ở CombatResultModal.vue
 * — xem stores/ui.ts's exitCombatScene()). Auto-refight KHÔNG cần
 * switch scene — chỉ 1 'battle_start' mới tới trong lúc scene này vẫn
 * đang active, xử lý y hệt lúc mới vào (xem onBattleStart()).
 *
 * CORE ↔ PHASER CHỈ GIAO TIẾP QUA EVENTBUS — kế thừa nguyên tắc từ
 * MainScene.ts, xem ghi chú ở đó cho lý do kỹ thuật (nội suy vị trí,
 * animation rời rạc...).
 */
export class CombatScene extends Phaser.Scene {
  private skyRect?: Phaser.GameObjects.Rectangle
  private groundRect?: Phaser.GameObjects.Rectangle

  private sprites = new Map<string, EntitySprite>()
  private interpolations = new Map<string, PositionInterpolation>()
  private castBars = new Map<string, CastBarSprite>()

  private dyingIds = new Set<string>()
  private playerDying = false

  private eventBus?: EventBus
  private boundHandlers: Array<[string, (event: CombatScenePayload) => void]> = []
  private positionsHandler = (event: BattlePositionsEvent) => this.onPositions(event)
  private battleEndHandler = () => this.onBattleEnd()
  private exitHandler = () => this.onExit()
  private damageHandler = (event: CombatEvent) => this.onDamageNumber(event)

  private canvasWidth = 0
  private canvasHeight = 0
  private groundY = 0
  private characterY = 0
  private characterWidth = 0
  private characterHeight = 0

  constructor() {
    super('CombatScene')
  }

  preload() {
    // Guard bằng textures.exists() — TextureManager global theo Game
    // instance, MainScene.ts thường đã load key này trước rồi (Động
    // Phủ luôn là scene đầu tiên), nhưng tự load lại nếu vì lý do gì
    // đó CombatScene chạy trước (an toàn, không phụ thuộc thứ tự scene).
    if (!this.textures.exists(IDLE_KEY)) {
      this.load.multiatlas(IDLE_KEY, 'assets/idle.json', 'assets')
    }
  }

  create() {
    this.skyRect = this.add.rectangle(0, 0, 0, 0, SKY_COLOR).setOrigin(0.5)
    this.groundRect = this.add.rectangle(0, 0, 0, 0, GROUND_COLOR).setOrigin(0.5)

    // AnimationManager cũng global — guard tương tự textures.exists()
    // ở preload(), tránh Phaser cảnh báo "animation key already exists"
    // khi MainScene.ts đã create() animation này trước.
    if (!this.anims.exists(IDLE_KEY)) {
      this.anims.create({
        key: IDLE_KEY,
        frames: this.anims.generateFrameNames(IDLE_KEY, { prefix: 'frame_', suffix: '.png', start: 0, end: 16, zeroPad: 3 }),
        frameRate: ANIMATION_FRAME_RATE,
        repeat: -1,
      })
    }

    this.applyBattlefieldLayout(this.scale.width, this.scale.height)

    // Scene này chỉ được start() SAU KHI 'battle_start' đã emit (xem
    // MainScene.ts) — quái/player đầu tiên đã tồn tại ở core rồi, chỉ
    // cần dựng sprite player ngay, quái tới qua 'positions' đầu tiên
    // như bình thường (y hệt MainScene.create() dựng sẵn player cho
    // Home Scene).
    const player = this.getOrCreateSprite(PLAYER_ID, PLAYER_COLOR, 'Player')

    this.snapInterpolationTarget(PLAYER_ID, HERO_HOME_X)
    this.positionSprite(player, HERO_HOME_X)

    this.scale.on('resize', (gameSize: ResizeSize) => {
      this.applyBattlefieldLayout(gameSize.width, gameSize.height)
    })

    this.subscribeCombatEvents()

    this.events.on('shutdown', () => this.unsubscribeCombatEvents())
  }

  update() {
    for (const [id, sprite] of this.sprites) {
      const visualX = this.getInterpolatedX(id)

      if (visualX === undefined) {
        continue
      }

      this.positionSprite(sprite, visualX)

      const castBar = this.castBars.get(id)

      if (castBar) {
        this.positionCastBar(sprite, castBar)
      }
    }
  }

  /**
   * Dành khoảng trên (Top Bar + Status Bar) và dưới (Event Bar +
   * Control Bar) cho DOM chrome của CombatSceneOverlay.vue (xem
   * DesignFrame.ts's COMBAT_*_HEIGHT) — battlefield thật (sky/ground/
   * nhân vật) chỉ vẽ trong khoảng CÒN LẠI ở giữa (spec mục 8 — 70-75%
   * chiều cao Combat Scene).
   */
  private applyBattlefieldLayout(width: number, height: number) {
    if (!this.skyRect || !this.groundRect) {
      return
    }

    this.canvasWidth = width
    this.canvasHeight = height

    const reservedTop = (height * (COMBAT_TOP_BAR_HEIGHT + COMBAT_STATUS_BAR_HEIGHT)) / DESIGN_HEIGHT
    const reservedBottom = (height * (COMBAT_EVENT_BAR_HEIGHT + COMBAT_CONTROL_BAR_HEIGHT)) / DESIGN_HEIGHT

    const battlefieldTop = reservedTop
    const battlefieldBottom = height - reservedBottom
    const battlefieldHeight = Math.max(0, battlefieldBottom - battlefieldTop)

    this.skyRect.setPosition(width / 2, battlefieldTop + battlefieldHeight / 2)
    this.skyRect.width = width
    this.skyRect.height = battlefieldHeight
    this.skyRect.updateDisplayOrigin()

    const groundHeight = battlefieldHeight * GROUND_HEIGHT_RATIO

    this.groundY = battlefieldBottom - groundHeight

    this.groundRect.setPosition(width / 2, this.groundY + groundHeight / 2)
    this.groundRect.width = width
    this.groundRect.height = groundHeight
    this.groundRect.updateDisplayOrigin()

    this.characterHeight = battlefieldHeight * CHARACTER_HEIGHT_RATIO
    this.characterWidth = this.characterHeight * CHARACTER_WIDTH_RATIO
    this.characterY = this.groundY - this.characterHeight / 2

    for (const sprite of this.sprites.values()) {
      this.applySpriteSize(sprite)
    }
  }

  // Rectangle (enemy) cần width/height + updateDisplayOrigin() (mutate
  // geometry trực tiếp); Sprite (player, idle animation) cần
  // setDisplaySize() với TỈ LỆ ĐÚNG khung hình gốc (IDLE_SOURCE_SIZE),
  // nếu không nhân vật sẽ méo hình khi ép cùng characterWidth/Height
  // hình vuông-ish của enemy (xem MainScene.ts's updateSpriteDisplaySize()
  // — cùng lý do).
  private applySpriteSize(sprite: EntitySprite) {
    if (sprite.kind === 'sprite') {
      const width = this.characterHeight * (IDLE_SOURCE_SIZE.w / IDLE_SOURCE_SIZE.h)
      const gameSprite = sprite.rect as Phaser.GameObjects.Sprite

      gameSprite.setDisplaySize(width, this.characterHeight)

      return
    }

    const rect = sprite.rect as Phaser.GameObjects.Rectangle

    rect.width = this.characterWidth
    rect.height = this.characterHeight
    rect.updateDisplayOrigin()
  }

  private worldToScreenX(worldX: number): number {
    return this.canvasWidth * HERO_PIVOT_RATIO + (worldX / WORLD_VIEW_HALF_WIDTH) * (this.canvasWidth / 2)
  }

  private positionSprite(sprite: EntitySprite, worldX: number) {
    const screenX = this.worldToScreenX(worldX) + sprite.offsetX
    const screenY = this.groundY - this.characterHeight / 2 + this.characterHeight * LANE_Y_OFFSET_RATIO[sprite.lane]

    sprite.rect.setPosition(screenX, screenY)
    sprite.label.setPosition(screenX, screenY + this.characterHeight / 2 + 4)
  }

  private getOrCreateSprite(id: string, color: number, labelText: string, lane: EnemyLane = 'ground'): EntitySprite {
    const existing = this.sprites.get(id)

    if (existing) {
      return existing
    }

    const label = this.add.text(0, 0, labelText, { fontSize: '14px', color: '#ffffff' }).setOrigin(0.5, 0)

    // CHỈ player có idle animation thật — enemy chưa có atlas riêng,
    // vẫn dùng Rectangle màu như cũ (xem EntitySprite.kind's ghi chú).
    if (id === PLAYER_ID) {
      const gameSprite = this.add.sprite(0, 0, IDLE_KEY, 'frame_000.png').play(IDLE_KEY)

      const sprite: EntitySprite = { kind: 'sprite', rect: gameSprite, label, color, offsetX: 0, lane }

      this.applySpriteSize(sprite)
      this.sprites.set(id, sprite)

      return sprite
    }

    const rect = this.add.rectangle(0, 0, this.characterWidth, this.characterHeight, color).setOrigin(0.5)

    const sprite: EntitySprite = { kind: 'rect', rect, label, color, offsetX: 0, lane }

    this.sprites.set(id, sprite)

    return sprite
  }

  private setInterpolationTarget(id: string, worldX: number) {
    const existing = this.interpolations.get(id)

    if (!existing) {
      this.snapInterpolationTarget(id, worldX)

      return
    }

    if (worldX === existing.toX) {
      return
    }

    const now = this.time.now
    const currentVisualX = this.interpolate(existing, now)
    const segmentDuration = Math.max(now - existing.segmentStart, MIN_SEGMENT_DURATION_MS)

    this.interpolations.set(id, {
      fromX: currentVisualX,
      toX: worldX,
      segmentStart: now,
      segmentDuration,
    })
  }

  private snapInterpolationTarget(id: string, worldX: number) {
    const now = this.time.now

    this.interpolations.set(id, { fromX: worldX, toX: worldX, segmentStart: now, segmentDuration: 1 })
  }

  private interpolate(entry: PositionInterpolation, now: number): number {
    const progress = Phaser.Math.Clamp((now - entry.segmentStart) / entry.segmentDuration, 0, 1)

    return Phaser.Math.Linear(entry.fromX, entry.toX, progress)
  }

  private getInterpolatedX(id: string): number | undefined {
    const entry = this.interpolations.get(id)

    if (!entry) {
      return undefined
    }

    return this.interpolate(entry, this.time.now)
  }

  private reconcileEnemySprites(enemies: { id: string; lane: EnemyLane }[]) {
    const currentIds = new Set(enemies.map(enemy => enemy.id))

    for (const enemy of enemies) {
      if (this.sprites.has(enemy.id)) {
        continue
      }

      this.getOrCreateSprite(enemy.id, ENEMY_COLOR, 'Enemy', enemy.lane)
    }

    for (const [id, sprite] of this.sprites) {
      if (id === PLAYER_ID || currentIds.has(id) || this.dyingIds.has(id)) {
        continue
      }

      sprite.rect.destroy()
      sprite.label.destroy()
      this.sprites.delete(id)
      this.interpolations.delete(id)
    }
  }

  private subscribeCombatEvents() {
    const eventBus = this.registry.get('eventBus') as EventBus | undefined

    if (!eventBus) {
      return
    }

    this.eventBus = eventBus

    this.boundHandlers = [
      ['attack', event => this.onAttack(event)],
      ['critical', event => this.onCritical(event)],
      ['hit', event => this.onHit(event)],
      ['dodge', event => this.onDodge(event)],
      ['cast', event => this.onCast(event)],
      ['cast_start', event => this.onCastStart(event)],
      ['cast_complete', event => this.onCastComplete(event)],
      ['death', event => this.onDeath(event)],
      ['battle_start', () => this.onBattleStart()],
    ]

    for (const [eventName, handler] of this.boundHandlers) {
      eventBus.on<CombatScenePayload>(eventName, handler)
    }

    eventBus.on<BattlePositionsEvent>('positions', this.positionsHandler)
    eventBus.on<BattleEndEvent>('battle_end', this.battleEndHandler)
    eventBus.on<void>('combat_scene_exit', this.exitHandler)
    eventBus.on<CombatEvent>('damage', this.damageHandler)
  }

  private unsubscribeCombatEvents() {
    if (!this.eventBus) {
      return
    }

    for (const [eventName, handler] of this.boundHandlers) {
      this.eventBus.off<CombatScenePayload>(eventName, handler)
    }

    this.boundHandlers = []

    this.eventBus.off<BattlePositionsEvent>('positions', this.positionsHandler)
    this.eventBus.off<BattleEndEvent>('battle_end', this.battleEndHandler)
    this.eventBus.off<void>('combat_scene_exit', this.exitHandler)
    this.eventBus.off<CombatEvent>('damage', this.damageHandler)
  }

  private spriteFor(id: string | undefined): EntitySprite | undefined {
    return id ? this.sprites.get(id) : undefined
  }

  private onPositions(event: BattlePositionsEvent) {
    this.reconcileEnemySprites(event.enemies)

    this.setInterpolationTarget(PLAYER_ID, event.playerX)

    for (const enemy of event.enemies) {
      this.setInterpolationTarget(enemy.id, enemy.x)
    }
  }

  // Trận kết thúc (thắng/thua) — dọn quái còn sót (trừ đang dở tween
  // chết), đưa player về giữa sân trừ khi đang dở tween chết. KHÔNG tự
  // rời scene ở đây — CombatResultModal.vue (Vue) quyết định lúc nào
  // rời (xem onExit()), vì cần đợi người chơi xem kết quả trước.
  private onBattleEnd() {
    this.reconcileEnemySprites([])

    if (!this.playerDying) {
      this.snapInterpolationTarget(PLAYER_ID, HERO_HOME_X)
    }
  }

  // Người chơi bấm "Tiếp Tục"/"Về Động Phủ" (CombatResultModal.vue) —
  // quay lại Home Scene.
  private onExit() {
    this.scene.start('MainScene')
  }

  private onAttack(event: CombatScenePayload) {
    const attacker = this.spriteFor(event.sourceId)

    if (attacker) {
      const isPlayer = event.sourceId === PLAYER_ID
      const dx = isPlayer ? 20 : -20

      this.tweens.add({
        targets: attacker,
        offsetX: attacker.offsetX + dx,
        duration: 100,
        yoyo: true,
        ease: 'Quad.easeOut',
      })
    }

    if (!event.sourceId || !event.targetId) {
      return
    }

    const sourceVisualX = this.getInterpolatedX(event.sourceId)
    const targetVisualX = this.getInterpolatedX(event.targetId)

    if (sourceVisualX === undefined || targetVisualX === undefined) {
      return
    }

    this.spawnMissileVisual(sourceVisualX, targetVisualX, event.sourceId === PLAYER_ID)
  }

  private spawnMissileVisual(sourceWorldX: number, targetWorldX: number, isPlayerSource: boolean) {
    const distance = Math.abs(targetWorldX - sourceWorldX)
    const durationMs = Math.max((distance / MISSILE_SPEED) * 1000, 1)

    const dot = this.add.circle(
      this.worldToScreenX(sourceWorldX),
      this.characterY,
      5,
      isPlayerSource ? MISSILE_COLOR_PLAYER : MISSILE_COLOR_ENEMY,
    )

    this.tweens.add({
      targets: dot,
      x: this.worldToScreenX(targetWorldX),
      duration: durationMs,
      ease: 'Linear',
      onComplete: () => dot.destroy(),
    })
  }

  // Nảy số sát thương — dùng CHUNG event 'damage' mà CombatStatusBar.vue
  // đọc để vẽ thanh HP (xem ghi chú DAMAGE_*_COLOR đầu file), nên số
  // nảy lên LUÔN khớp với thanh máu vừa hụt, không lệch nhịp. Chạy cho
  // CẢ 2 chiều — target là quái (player gây sát thương) hay target là
  // player (quái gây sát thương) đều qua đúng 1 handler này.
  private onDamageNumber(event: CombatEvent) {
    const target = this.spriteFor(event.targetId)

    if (!target || event.value === undefined || event.value <= 0) {
      return
    }

    const isDamageToPlayer = event.targetId === PLAYER_ID
    const color = event.critical ? CRITICAL_DAMAGE_COLOR : (isDamageToPlayer ? DAMAGE_TAKEN_COLOR : DAMAGE_DEALT_COLOR)

    this.showDamageNumber(target, event.value, color, event.critical ?? false)
  }

  // "Nảy số" thật sự — pop-in bằng Back.easeOut (bật nảy quá cỡ rồi
  // co về, khác easeOut tuyến tính của showFloatingText) rồi mới trôi
  // lên/mờ dần, tách biệt hẳn phần chữ "Chí Mạng!"/"Né!" (showFloatingText)
  // — jitter ngang nhỏ để 2 hiệu ứng không đè khít lên nhau khi cùng
  // 1 đòn vừa Chí Mạng vừa có sát thương.
  private showDamageNumber(sprite: EntitySprite, value: number, color: string, critical: boolean) {
    const jitterX = Phaser.Math.Between(-10, 10)
    const fontSize = critical ? 20 : 14

    const label = this.add
      .text(sprite.rect.x + jitterX, sprite.rect.y - sprite.rect.displayHeight / 2, `-${formatNumber(Math.round(value))}`, {
        fontSize: `${fontSize}px`,
        fontStyle: critical ? 'bold' : 'normal',
        color,
      })
      .setOrigin(0.5, 1)
      .setScale(0.4)

    this.tweens.add({
      targets: label,
      scale: 1,
      duration: 110,
      ease: 'Back.easeOut',
    })

    this.tweens.add({
      targets: label,
      y: label.y - 34,
      alpha: 0,
      delay: 110,
      duration: 480,
      ease: 'Quad.easeOut',
      onComplete: () => label.destroy(),
    })
  }

  private onCritical(event: CombatScenePayload) {
    const target = this.spriteFor(event.targetId)

    if (!target) {
      return
    }

    this.tweens.add({
      targets: target.rect,
      scaleX: 1.25,
      scaleY: 1.25,
      duration: 90,
      yoyo: true,
      ease: 'Quad.easeOut',
    })

    this.flashColor(target, CRITICAL_FLASH_COLOR, 120)
    this.showFloatingText(target, 'Chí Mạng!', '#ffd54f')
  }

  private onHit(event: CombatScenePayload) {
    const target = this.spriteFor(event.targetId)

    if (!target) {
      return
    }

    this.flashColor(target, HIT_FLASH_COLOR, 100)
  }

  private onDodge(event: CombatScenePayload) {
    const dodger = this.spriteFor(event.targetId)

    if (!dodger) {
      return
    }

    const isPlayer = event.targetId === PLAYER_ID
    const dx = isPlayer ? -18 : 18

    this.tweens.add({
      targets: dodger,
      offsetX: dodger.offsetX + dx,
      duration: 130,
      yoyo: true,
      ease: 'Quad.easeOut',
    })

    this.tweens.add({
      targets: dodger.rect,
      alpha: 0.55,
      duration: 130,
      yoyo: true,
      ease: 'Quad.easeOut',
    })

    this.showFloatingText(dodger, 'Né!', '#8be9fd')
  }

  private onCast(event: CombatScenePayload) {
    const caster = this.spriteFor(event.sourceId)

    if (!caster) {
      return
    }

    this.flashColor(caster, CAST_GLOW_COLOR, 160)
  }

  // Cast Time (2026-08-21) — skill có Skill.castTime > 0 (xem
  // BattleSystem.beginCast()) niệm trong 1 khoảng thời gian TRƯỚC khi
  // hiệu ứng thi triển — vẽ 1 thanh tiến độ phía trên đầu unit + nảy
  // TÊN skill lên (khác 'cast' cũ chỉ flash màu, không hiện chữ) để
  // người chơi biết unit đang niệm chiêu gì. Skill castTime=0 (MỌI
  // skill hiện có) không emit event này — vẫn dùng đúng 'cast' cũ.
  private onCastStart(event: CombatScenePayload) {
    const caster = this.spriteFor(event.sourceId)

    if (!caster || !event.sourceId || !event.castTimeSeconds || event.castTimeSeconds <= 0) {
      return
    }

    this.destroyCastBar(event.sourceId)

    const widthPx = this.characterWidth
    const y = caster.rect.y - caster.rect.displayHeight / 2 - CAST_BAR_OFFSET_Y

    const bg = this.add
      .rectangle(caster.rect.x, y, widthPx, CAST_BAR_HEIGHT, CAST_BAR_BG_COLOR)
      .setOrigin(0.5)
      .setStrokeStyle(1, 0x000000, 0.5)

    const fill = this.add
      .rectangle(caster.rect.x - widthPx / 2, y, widthPx - 2, CAST_BAR_HEIGHT - 2, CAST_BAR_FILL_COLOR)
      .setOrigin(0, 0.5)
      .setScale(0, 1)

    this.castBars.set(event.sourceId, { bg, fill, widthPx })

    this.tweens.add({
      targets: fill,
      scaleX: 1,
      duration: event.castTimeSeconds * 1000,
      ease: 'Linear',
    })

    if (event.skillName) {
      this.showFloatingText(caster, event.skillName, CAST_NAME_COLOR)
    }
  }

  private onCastComplete(event: CombatScenePayload) {
    if (event.sourceId) {
      this.destroyCastBar(event.sourceId)
    }
  }

  private positionCastBar(sprite: EntitySprite, castBar: CastBarSprite) {
    const y = sprite.rect.y - sprite.rect.displayHeight / 2 - CAST_BAR_OFFSET_Y

    castBar.bg.setPosition(sprite.rect.x, y)
    castBar.fill.setPosition(sprite.rect.x - castBar.widthPx / 2, y)
  }

  private destroyCastBar(id: string) {
    const castBar = this.castBars.get(id)

    if (!castBar) {
      return
    }

    this.tweens.killTweensOf(castBar.fill)
    castBar.bg.destroy()
    castBar.fill.destroy()
    this.castBars.delete(id)
  }

  private onDeath(event: CombatScenePayload) {
    const id = event.targetId

    if (!id) {
      return
    }

    const sprite = this.sprites.get(id)

    if (!sprite) {
      return
    }

    const isPlayer = id === PLAYER_ID

    if (isPlayer) {
      this.playerDying = true
    } else {
      this.dyingIds.add(id)
    }

    this.destroyCastBar(id)

    this.tweens.killTweensOf(sprite.rect)

    this.tweens.add({
      targets: sprite.rect,
      rotation: Math.PI / 2,
      alpha: 0,
      duration: 500,
      ease: 'Quad.easeIn',
      onComplete: () => {
        if (isPlayer) {
          return
        }

        sprite.label.destroy()
        sprite.rect.destroy()
        this.sprites.delete(id)
        this.dyingIds.delete(id)
        this.interpolations.delete(id)
      },
    })

    this.tweens.add({
      targets: sprite.label,
      alpha: 0,
      duration: 500,
    })
  }

  // Trận mới bắt đầu TRONG LÚC scene này vẫn đang active (Auto-refight,
  // xem CombatVictoryPanel.vue — không switch scene, chỉ reset tại
  // chỗ) hoặc lần đầu vào Combat Scene (create() đã tự dựng player,
  // hàm này reset lại về đúng trạng thái ban đầu cho chắc, no-op nếu
  // đã sạch sẵn).
  private onBattleStart() {
    const player = this.sprites.get(PLAYER_ID)

    if (player) {
      this.resetVisual(player)
    }

    this.playerDying = false
    this.snapInterpolationTarget(PLAYER_ID, HERO_HOME_X)

    for (const [id, sprite] of this.sprites) {
      if (id === PLAYER_ID) {
        continue
      }

      sprite.rect.destroy()
      sprite.label.destroy()
      this.sprites.delete(id)
      this.interpolations.delete(id)
    }

    this.dyingIds.clear()

    for (const id of [...this.castBars.keys()]) {
      this.destroyCastBar(id)
    }
  }

  private flashColor(sprite: EntitySprite, color: number, duration: number) {
    if (sprite.kind === 'sprite') {
      const gameSprite = sprite.rect as Phaser.GameObjects.Sprite

      gameSprite.setTint(color)

      this.time.delayedCall(duration, () => gameSprite.clearTint())

      return
    }

    const rect = sprite.rect as Phaser.GameObjects.Rectangle

    rect.setFillStyle(color)

    this.time.delayedCall(duration, () => {
      rect.setFillStyle(sprite.color)
    })
  }

  private showFloatingText(sprite: EntitySprite, text: string, color: string) {
    const label = this.add
      .text(sprite.rect.x, sprite.rect.y - sprite.rect.displayHeight / 2, text, { fontSize: '13px', color })
      .setOrigin(0.5, 1)

    this.tweens.add({
      targets: label,
      y: label.y - 24,
      alpha: 0,
      duration: 500,
      ease: 'Quad.easeOut',
      onComplete: () => label.destroy(),
    })
  }

  private resetVisual(sprite: EntitySprite) {
    this.tweens.killTweensOf(sprite.rect)
    this.tweens.killTweensOf(sprite)

    sprite.rect.setAlpha(1)
    sprite.rect.setRotation(0)
    sprite.rect.setScale(1)

    if (sprite.kind === 'sprite') {
      const gameSprite = sprite.rect as Phaser.GameObjects.Sprite

      gameSprite.clearTint()
    } else {
      const rect = sprite.rect as Phaser.GameObjects.Rectangle

      rect.setFillStyle(sprite.color)
    }

    sprite.offsetX = 0
  }
}
