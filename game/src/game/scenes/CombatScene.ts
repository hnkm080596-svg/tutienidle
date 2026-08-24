import Phaser from 'phaser'
import type { EventBus } from '@/core/events/EventBus'
import type {
  BattlePositionsEvent,
  BattleEndEvent,
  BattleRewardParticleEvent,
  ActionImpactEvent,
  StatusVfxAttachedEvent,
  StatusVfxUpdatedEvent,
  StatusVfxRemovedEvent,
} from '@/core/battle/BattleEvents'
import {
  GRID_ROW_COUNT,
  GRID_COLUMN_COUNT,
  VISIBLE_MAX_COLUMN,
  HERO_LANE_INDEX,
  HERO_GATE_COLUMNS,
  type LaneIndex,
} from '@/core/battle/BattleLane'
import { getCombatInsets } from '@/game/support/combatInsets'
import { getColumnFromWorldX, getLaneFromWorldY, type GridPosition } from '@/core/battle/BattleGrid'
import {
  createBattleGridProjection,
  type BattlefieldGeometrySnapshot,
  type BattleGridProjection,
} from '@/game/support/BattleGridProjection'
import {
  getBattlefieldRenderMode,
  type BattlefieldRenderMode,
} from '@/game/support/BattlefieldRenderMode'
import { spawnActionImpactVfx, toVector2Points } from '@/game/support/ActionImpactVfx'
import { spawnEnemySpawnVfx, type EnemySpawnVfxHandle } from '@/game/support/EnemySpawnVfx'
import {
  DEPTH_BACKGROUND,
  DEPTH_GROUND_GRID,
  DEPTH_GROUND_VFX,
  DEPTH_ENTITY_SHADOW,
  DEPTH_UPRIGHT_VFX,
  DEPTH_OVERLAY_UI,
  entitySpriteDepth,
  uprightVfxDepth,
} from '@/game/support/BattleLayers'
import {
  attachBattlefieldBackdrop,
  type BattlefieldBackdropHandle,
} from '@/game/support/BattlefieldBackdrop'
import type { CombatEvent } from '@/core/combat/CombatEvent'
import type { EntityVitalsChangedEvent } from '@/core/combat/EntityVitalsSystem'
import { formatNumber } from '@/core/format/NumberFormatter'
import {
  DESIGN_HEIGHT,
  COMBAT_TOP_BAR_HEIGHT,
  COMBAT_STATUS_BAR_HEIGHT,
  COMBAT_EVENT_BAR_HEIGHT,
  COMBAT_CONTROL_BAR_HEIGHT,
} from '@/core/ui/DesignFrame'
import { getCombatVfxPreset } from '@/data/vfx/CombatVfxPresets'
import { getStatusVfxPreset } from '@/data/vfx/StatusVfxPresets'

const PLAYER_COLOR = 0x4a90d9
const ENEMY_COLOR = 0xd94a4a

// Top-down 5-lane (2026-08-22) → 2.5D migration (2026-08-24): 'flat' giữ
// nguyên palette legacy sau feature flag (BattlefieldRenderMode.ts);
// 'perspective' chuyển sang BattlefieldBackdrop + lưới phối cảnh rất nhạt
// để texture đất làm chính, tránh lộ cảm giác bàn cờ 10 lane.
const ARENA_COLOR = 0x14161c
const LANE_DIVIDER_COLOR = 0x2a2d38
const PERSPECTIVE_GRID_COLOR = 0x8a94ad
const PERSPECTIVE_GRID_ALPHA = 0.14
const PERSPECTIVE_BORDER_COLOR = 0xaeb9d4
const PERSPECTIVE_BORDER_ALPHA = 0.3

// Bóng ellipse dưới chân — dẹt theo trục sâu, đậm vừa để tách unit khỏi
// mặt đất; luôn nằm ở lớp ENTITY_SHADOW dưới MỌI sprite.
const SHADOW_COLOR = 0x000000
const SHADOW_ALPHA = 0.32
const SHADOW_WIDTH_RATIO = 1.12
const SHADOW_HEIGHT_RATIO = 0.34

// Hover marker — vòng ellipse trên mặt đất đánh dấu ô pointer đang đứng,
// quy đổi NGƯỢC screen→grid bằng đúng helpers làm tròn của core nên ô
// hover luôn khớp ô targeting logic (migration gate: hover đúng cell).
const HOVER_MARKER_COLOR = 0x9cecff
const HOVER_MARKER_ALPHA = 0.55

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
const ENEMY_HP_BG_COLOR = 0x241b1b
const ENEMY_HP_FILL_COLOR = 0xc94b4b
const BOSS_HP_FILL_COLOR = 0xd4a72c
const ENEMY_HP_BAR_HEIGHT = 6
const ENEMY_HP_BAR_OFFSET_Y = 12

// Tỉ lệ theo CHIỀU CAO 1 HÀNG lane (không phải cả battlefield như side-
// view cũ) — 5 lane top-down (2026-08-22), nhân vật phải nhỏ hơn hẳn
// hàng của nó để còn chừa lề trên/dưới, không đè hàng kế bên.
const CHARACTER_HEIGHT_RATIO = 0.7
const CHARACTER_WIDTH_RATIO = 0.45 // tỉ lệ so với chiều cao nhân vật

// Hero cố định sát mép trái battlefield (top-down 5-lane, 2026-08-22 —
// thay layout side-view cũ có layout side-view cũ) — chừa 1
// lề nhỏ để sprite không bị cắt viền trái.

// Sàn thời lượng 1 đoạn nội suy — tránh chia gần 0 nếu 2 lần cập nhật
// vị trí liên tiếp tới quá sát nhau.
const MIN_SEGMENT_DURATION_MS = 16
const MAX_SEGMENT_DURATION_MS = 200

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
  row: LaneIndex
  healthBar?: EnemyHealthBar

  // 2.5D presentation (2026-08-24) — bóng ellipse trên mặt đất (chỉ tạo
  // ở perspective), foot point + column float lần chiếu gần nhất phục vụ
  // depth sort, và boost object cho tween pop (Chí Mạng) KHÔNG đụng vào
  // scale/geometry mà projection ghi mỗi frame.
  shadow?: Phaser.GameObjects.Ellipse
  boost: { value: number }
  footY: number
  columnFloat: number
}

interface EnemyHealthBar {
  background: Phaser.GameObjects.Rectangle
  fill: Phaser.GameObjects.Rectangle
  width: number
  currentHp: number
  maxHp: number
  isBoss: boolean
}

interface PositionInterpolation {
  fromX: number
  toX: number
  segmentStart: number
  segmentDuration: number

  // Thời điểm snapshot tạo segment (cadence đo từ đây).
  lastSnapshotAt: number
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
  // Chỉ tồn tại ở chế độ 'flat' (renderer legacy cần nền phẳng đặc);
  // 'perspective' thay bằng BattlefieldBackdrop hội tụ hậu cảnh.
  private arenaRect?: Phaser.GameObjects.Rectangle

  // Projection layer — nguồn DUY NHẤT cho mọi quy đổi grid↔screen kể cả
  // flat (2 mode cùng interface BattleGridProjection nên phần còn lại của
  // scene không cần biết mode đang chạy).
  private renderMode: BattlefieldRenderMode = getBattlefieldRenderMode()
  private projection?: BattleGridProjection
  private backdrop?: BattlefieldBackdropHandle
  private gridGraphics?: Phaser.GameObjects.Graphics
  private hoverMarker?: Phaser.GameObjects.Ellipse

  private sprites = new Map<string, EntitySprite>()
  private interpolations = new Map<string, PositionInterpolation>()
  private castBars = new Map<string, CastBarSprite>()

  // Combat Grid Rework — DOT VFX theo (targetId + ailmentId), bám target.
  private statuses = new Map<
    string,
    { targetId: string; icon: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text }
  >()

  private dyingIds = new Set<string>()
  private playerDying = false

  // Spawn telegraph (2026-08-24) — VFX handle theo pending enemy id:
  // reconcile từ SNAPSHOT positions.spawningEnemies (id biến mất =
  // materialize → flash + fade-in enemy sprite). Flat mode không chạy
  // (renderer legacy giữ nguyên hành vi cũ).
  private spawnVfxHandles = new Map<string, { handle: EnemySpawnVfxHandle; progress: number }>()
  private materializingIds = new Set<string>()

  private eventBus?: EventBus
  private boundHandlers: Array<[string, (event: CombatScenePayload) => void]> = []
  private positionsHandler = (event: BattlePositionsEvent) => this.onPositions(event)
  private battleEndHandler = () => this.onBattleEnd()
  private exitHandler = () => this.onExit()
  private damageHandler = (event: CombatEvent) => this.onDamageNumber(event)
  private actionImpactHandler = (event: ActionImpactEvent) => this.onActionImpact(event)
  private statusAttachHandler = (event: StatusVfxAttachedEvent) => this.onStatusAttached(event)
  private statusUpdateHandler = (event: StatusVfxUpdatedEvent) => this.onStatusUpdated(event)
  private statusRemoveHandler = (event: StatusVfxRemovedEvent) => this.onStatusRemoved(event)
  private vitalsHandler = (event: EntityVitalsChangedEvent) => this.onVitalsChanged(event)
  private rewardParticleHandler = (event: BattleRewardParticleEvent) => this.onRewardParticle(event)
  private pointerMoveHandler = (pointer: Phaser.Input.Pointer) => this.onPointerMove(pointer)

  private get isPerspective(): boolean {
    return this.renderMode === 'perspective'
  }

  // Combat Grid Rework — hình học lưới vuông (px), tính lại mỗi layout.
  // GIỮ LẠI làm mirror chẩn đoán/test: flat = giá trị legacy chính xác;
  // perspective = bounding box + bề rộng ô cạnh gần.
  private gridLeft = 0
  private gridTop = 0
  private cellSize = 0

  private pendingPositions?: BattlePositionsEvent
  private pendingCadence?: number
  private lastSnapshotAt?: number

  private canvasWidth = 0
  private canvasHeight = 0

  // Top-down 5-lane (2026-08-22) — tâm Y của mỗi hàng, length GRID_ROW_COUNT,
  // tính lại mỗi khi layout đổi (xem applyBattlefieldLayout()).
  private laneRowCenterY: number[] = []

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
    // Đọc flag MỖI LẦN create — đổi mode qua localStorage có hiệu lực ở
    // lần vào Combat kế tiếp (Home ↔ Combat là đủ, không cần reload).
    this.renderMode = getBattlefieldRenderMode()

    this.gridGraphics = this.add.graphics().setDepth(DEPTH_GROUND_GRID)

    if (this.isPerspective) {
      this.hoverMarker = this.add
        .ellipse(0, 0, 0, 0, HOVER_MARKER_COLOR, HOVER_MARKER_ALPHA)
        .setOrigin(0.5)
        .setVisible(false)
        .setDepth(DEPTH_GROUND_VFX)
    } else {
      this.arenaRect = this.add
        .rectangle(0, 0, 0, 0, ARENA_COLOR)
        .setOrigin(0.5)
        .setDepth(DEPTH_BACKGROUND)
    }

    // AnimationManager cũng global — guard tương tự textures.exists()
    // ở preload(), tránh Phaser cảnh báo "animation key already exists"
    // khi MainScene.ts đã create() animation này trước.
    if (!this.anims.exists(IDLE_KEY)) {
      this.anims.create({
        key: IDLE_KEY,
        frames: this.anims.generateFrameNames(IDLE_KEY, {
          prefix: 'frame_',
          suffix: '.png',
          start: 0,
          end: 16,
          zeroPad: 3,
        }),
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
    const player = this.getOrCreateSprite(PLAYER_ID, PLAYER_COLOR, 'Player', HERO_LANE_INDEX)

    this.snapInterpolationTarget(PLAYER_ID, 0)
    this.positionSprite(player, 0)

    // Lifecycle listeners dùng handler ỔN ĐỊNH + gỡ đúng lúc shutdown —
    // ScaleManager là game-level nên anonymous callback đăng ký mỗi
    // create() sẽ TÍCH TỤC qua các lần Home → Combat (N listener cùng
    // chạy mỗi resize). events.once đảm bảo shutdown handler tự gỡ.
    this.scale.on('resize', this.resizeHandler)

    // Hover 2.5D — quy đổi NGƯỢC screen→grid mỗi lần pointer di chuyển.
    this.input.on('pointermove', this.pointerMoveHandler)

    this.subscribeCombatEvents()

    this.events.once('shutdown', this.shutdownHandler)
  }

  private resizeHandler = (gameSize: ResizeSize) => {
    this.applyBattlefieldLayout(gameSize.width, gameSize.height)
  }

  private shutdownHandler = () => {
    this.scale.off('resize', this.resizeHandler)
    this.input.off('pointermove', this.pointerMoveHandler)
    this.unsubscribeCombatEvents()
    this.clearSceneState()
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

    // Combat Grid Rework — DOT icon bám theo target mỗi frame.
    this.updateStatusIconPositions()

    // Spawn telegraph — drive handle theo progress snapshot mới nhất.
    for (const entry of this.spawnVfxHandles.values()) {
      entry.handle.update(entry.progress)
    }

    // 2.5D depth sort — projected Y quyết định chính, column/entityId
    // chỉ phá hòa chống nhấp nháy; chỉ chạy ở perspective vì flat giữ
    // insertion order đúng như renderer cũ.
    if (this.isPerspective) {
      this.updateEntityDepths()
    }

    // Coalesce positions: apply ĐÚNG MỘT lần mỗi frame.
    if (this.pendingPositions) {
      const event = this.pendingPositions

      this.pendingPositions = undefined
      this.applyPendingPositions(event)
    }
  }

  /**
   * Depth sort entity sprite theo projected foot Y (gần đè xa). min/max
   * là BIÊN CỐ ĐỊNH của mặt đường (entityFootMinY/MaxY đặt từ
   * projection.bounds() mỗi layout) — KHÔNG tính lại từ tập entity đang
   * sống: spawn/death của 1 entity không remap depth của entity khác và
   * upright VFX (chốt depth lúc spawn) luôn cùng thước với entity.
   */
  private entityFootMinY = 0
  private entityFootMaxY = 1

  private updateEntityDepths() {
    for (const [id, sprite] of this.sprites) {
      sprite.rect.setDepth(
        entitySpriteDepth(
          sprite.footY,
          this.entityFootMinY,
          this.entityFootMaxY,
          sprite.columnFloat,
          id,
        ),
      )
    }
  }

  /**
   * Dành khoảng trên (Top Bar + Status Bar) và dưới (Event Bar +
   * Control Bar) cho DOM chrome của CombatSceneOverlay.vue (xem
   * DesignFrame.ts's COMBAT_*_HEIGHT) — battlefield thật chỉ vẽ trong
   * khoảng CÒN LẠI ở giữa.
   *
   * 2.5D migration — layout chỉ còn 2 việc:
   * 1. Dựng/resize projection (flat hoặc perspective theo flag) từ
   *    viewport + insets. Insets ưu tiên số ĐO THẬT của bar DOM qua
   *    getCombatInsets() (WS1), fallback công thức tỷ lệ legacy khi chưa
   *   có phép đo đầu tiên.
   * 2. Vẽ lại mọi lớp phụ thuộc hình học: nền, lưới, entity, chrome —
   *    NGAY TRONG LẦN GỌI để không có frame nào hiện vị trí stale.
   */
  private applyBattlefieldLayout(width: number, height: number) {
    // Guard chống resize bắn vào scene đang STOPPED: listener trên
    // ScaleManager (game-level) không tự gỡ khi shutdown, mà clearSceneState
    // đã null gridGraphics — dùng nó làm cờ "scene đang sống" thay cho
    // guard arenaRect của bản legacy.
    if (!this.gridGraphics) {
      return
    }

    this.canvasWidth = width
    this.canvasHeight = height

    const measuredInsets = getCombatInsets()
    const fallbackTop =
      (height * (COMBAT_TOP_BAR_HEIGHT + COMBAT_STATUS_BAR_HEIGHT)) / DESIGN_HEIGHT
    const fallbackBottom =
      (height * (COMBAT_EVENT_BAR_HEIGHT + COMBAT_CONTROL_BAR_HEIGHT)) / DESIGN_HEIGHT
    // Camera zoom của scene này LUÔN giữ 1 — mọi tọa độ combat là pixel
    // canvas, projection không cần bù transform (plan: zoom không ảnh
    // hưởng combat coordinates).
    this.cameras.main.setZoom(1)

    const viewport = {
      width,
      height,
      topInset: measuredInsets.measured ? measuredInsets.top : fallbackTop,
      bottomInset: measuredInsets.measured ? measuredInsets.bottom : fallbackBottom,
    }

    if (!this.projection) {
      this.projection = createBattleGridProjection(this.renderMode, viewport)
    } else {
      this.projection.resize(viewport)
    }

    if (this.isPerspective && !this.backdrop) {
      this.backdrop = attachBattlefieldBackdrop(this, this.projection)
    }

    const bounds = this.projection.bounds()

    // Mirror chẩn đoán/test — flat khớp chính xác số liệu legacy cũ.
    this.gridLeft = bounds.left
    this.gridTop = bounds.top
    this.cellSize = this.projection.cellSizeAt(GRID_ROW_COUNT - 1).width
    this.laneRowCenterY = Array.from(
      { length: GRID_ROW_COUNT },
      (_, row) => this.projection!.gridToScreen(row, 0).y,
    )

    if (this.arenaRect) {
      // Legacy: nền phẳng phủ TOÀN băng battlefield (kể cả letterbox).
      const bandHeight = Math.max(0, height - viewport.topInset - viewport.bottomInset)

      this.arenaRect.setPosition(width / 2, viewport.topInset + bandHeight / 2)
      this.arenaRect.width = width
      this.arenaRect.height = bandHeight
      this.arenaRect.updateDisplayOrigin()
    }

    // Kích thước cơ sở nhân vật: flat dùng ô vuông chuẩn (legacy).
    // Perspective dùng BỀ RỘNG ô cạnh gần làm thước — chiều cao ô đã bị
    // nén phối cảnh (và giờ nhỏ hơn nữa sau khi chia nửa phong cảnh),
    // không còn là thước đo hợp lý cho chiều cao người đứng.
    const nearCell = this.projection.cellSizeAt(GRID_ROW_COUNT - 1)
    const baseCell = this.isPerspective ? nearCell.width : this.cellSize

    this.characterHeight = Math.max(26, baseCell * 0.92)
    this.characterWidth = this.characterHeight * CHARACTER_WIDTH_RATIO

    this.redrawGridLines()
    this.backdrop?.redraw()

    // Mốc depth ban đầu cho upright VFX (trước frame entity đầu tiên):
    // full mặt đường theo projection hiện hành.
    this.entityFootMinY = bounds.top
    this.entityFootMaxY = bounds.bottom

    // Snapshot hình học cho e2e/visual gate — assertion bố cục (tỉ lệ
    // horizon, min road height) đọc từ đây thay vì đo pixel.
    this.game.registry.set('battlefieldGeometry', {
      viewportWidth: width,
      viewportHeight: height,
      topInset: viewport.topInset,
      bottomInset: viewport.bottomInset,
      horizonY: bounds.top,
      roadBottomY: bounds.bottom,
      sceneryHeight: bounds.top - viewport.topInset,
      roadHeight: bounds.bottom - bounds.top,
    } satisfies BattlefieldGeometrySnapshot)

    // Resize giữa trận: dựng lại vị trí NGAY, không đợi snapshot kế tiếp.
    this.hoverMarker?.setVisible(false)

    for (const [id, sprite] of this.sprites) {
      const entry = this.interpolations.get(id)

      this.applySpriteSize(sprite)
      this.positionSprite(sprite, entry ? this.interpolate(entry, this.time.now) : 0)
    }

    for (const [id, castBar] of this.castBars) {
      const sprite = this.sprites.get(id)

      if (sprite) {
        this.positionCastBar(sprite, castBar)
      }
    }

    this.updateStatusIconPositions()
  }

  /**
   * Vẽ lưới lane qua projection — cả 2 mode dùng chung 1 code path:
   * flat tự cho ra ô vuông đều khớp renderer cũ; perspective cho lưới
   * hội tụ về hậu cảnh với vạch RẤT NHẠT (texture đất trong backdrop là
   * chính, tránh cảm giác bàn cờ). KHÔNG bake vào background.
   */
  private redrawGridLines() {
    const graphics = this.gridGraphics
    const projection = this.projection

    if (!graphics || !projection) {
      return
    }

    graphics.clear()

    const isFlat = Boolean(this.arenaRect)

    graphics.lineStyle(
      1,
      isFlat ? LANE_DIVIDER_COLOR : PERSPECTIVE_GRID_COLOR,
      isFlat ? 0.55 : PERSPECTIVE_GRID_ALPHA,
    )

    for (let boundaryRow = 0; boundaryRow <= GRID_ROW_COUNT; boundaryRow++) {
      const rowFloat = boundaryRow - 0.5
      const left = projection.gridToScreen(rowFloat, -0.5)
      const right = projection.gridToScreen(rowFloat, GRID_COLUMN_COUNT - 0.5)

      graphics.beginPath()
      graphics.moveTo(left.x, left.y)
      graphics.lineTo(right.x, right.y)
      graphics.strokePath()
    }

    for (let boundaryColumn = 0; boundaryColumn <= GRID_COLUMN_COUNT; boundaryColumn++) {
      const columnFloat = boundaryColumn - 0.5
      const far = projection.gridToScreen(-0.5, columnFloat)
      const near = projection.gridToScreen(GRID_ROW_COUNT - 0.5, columnFloat)

      graphics.beginPath()
      graphics.moveTo(far.x, far.y)
      graphics.lineTo(near.x, near.y)
      graphics.strokePath()
    }

    if (!isFlat) {
      // Viền ngoài + vùng cổng hero nhấn nhẹ màu phe ta.
      const corners = [
        projection.gridToScreen(-0.5, -0.5),
        projection.gridToScreen(-0.5, GRID_COLUMN_COUNT - 0.5),
        projection.gridToScreen(GRID_ROW_COUNT - 0.5, GRID_COLUMN_COUNT - 0.5),
        projection.gridToScreen(GRID_ROW_COUNT - 0.5, -0.5),
      ]

      graphics.lineStyle(1.5, PERSPECTIVE_BORDER_COLOR, PERSPECTIVE_BORDER_ALPHA)
      graphics.strokePoints(toVector2Points(corners), true, true)

      const gatePolygon = projection.footprintPolygon({
        rowStart: 0,
        rowEnd: GRID_ROW_COUNT - 1,
        colStart: 0,
        colEnd: HERO_GATE_COLUMNS - 1,
      })

      graphics.fillStyle(PLAYER_COLOR, 0.05)
      graphics.fillPoints(toVector2Points(gatePolygon), true)
    }
  }

  // Rectangle (enemy) cần width/height + updateDisplayOrigin() (mutate
  // geometry trực tiếp); Sprite (player, idle animation) cần
  // setDisplaySize() với TỈ LỆ ĐÚNG khung hình gốc (IDLE_SOURCE_SIZE),
  // nếu không nhân vật sẽ méo hình khi ép cùng characterWidth/Height
  // hình vuông-ish của enemy (xem MainScene.ts's updateSpriteDisplaySize()
  // — cùng lý do).
  //
  // Perspective: baseline chỉ là kích thước ở hàng hiện hành — co giãn
  // theo chiều sâu diễn ra trong applyEntityDepthScale() mỗi lần chiếu.
  private applySpriteSize(sprite: EntitySprite) {
    if (this.isPerspective && this.projection) {
      this.applyEntityDepthScale(sprite, this.projection.gridToScreen(sprite.row, 0).scale)

      return
    }

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

    if (sprite.healthBar) {
      const width = this.characterWidth * (sprite.healthBar.isBoss ? 1.45 : 1.05)

      sprite.healthBar.width = width
      sprite.healthBar.background.setSize(width, ENEMY_HP_BAR_HEIGHT).updateDisplayOrigin()
      sprite.healthBar.fill.setSize(width, ENEMY_HP_BAR_HEIGHT - 2).updateDisplayOrigin()
      this.updateEnemyHealthBar(sprite, sprite.healthBar.currentHp, sprite.healthBar.maxHp)
    }
  }

  /**
   * Áp scale chiều sâu cho entity: kích thước = baseline × depthScale ×
   * boost (pop Chí Mạng), ghi vào GEOMETRY/scale của GameObject nên tween
   * cũ vẫn hoạt động; bóng ellipse dưới chân co giãn theo.
   */
  private applyEntityDepthScale(sprite: EntitySprite, depthScale: number) {
    const effectiveScale = Math.max(0.05, depthScale * sprite.boost.value)

    if (sprite.kind === 'sprite') {
      const height = this.characterHeight * effectiveScale
      const gameSprite = sprite.rect as Phaser.GameObjects.Sprite

      gameSprite.setDisplaySize(height * (IDLE_SOURCE_SIZE.w / IDLE_SOURCE_SIZE.h), height)
    } else {
      const rect = sprite.rect as Phaser.GameObjects.Rectangle

      rect.width = this.characterWidth * effectiveScale
      rect.height = this.characterHeight * effectiveScale
      rect.updateDisplayOrigin()

      if (sprite.healthBar) {
        const barWidth =
          this.characterWidth * effectiveScale * (sprite.healthBar.isBoss ? 1.45 : 1.05)

        sprite.healthBar.width = barWidth
        sprite.healthBar.background.setSize(barWidth, ENEMY_HP_BAR_HEIGHT).updateDisplayOrigin()
        sprite.healthBar.fill.setSize(barWidth, ENEMY_HP_BAR_HEIGHT - 2).updateDisplayOrigin()
        this.updateEnemyHealthBar(sprite, sprite.healthBar.currentHp, sprite.healthBar.maxHp)
      }
    }

    if (sprite.shadow) {
      const shadowWidth = this.characterWidth * effectiveScale * SHADOW_WIDTH_RATIO

      sprite.shadow.setSize(shadowWidth, shadowWidth * SHADOW_HEIGHT_RATIO)
    }
  }

  // Đỉnh đầu sprite theo anchor hiện hành — mọi chrome treo trên đầu
  // (HP bar / cast bar / DOT icon / text bay) đi qua đây để không phụ
  // thuộc origin (foot anchor ở perspective, center anchor ở flat).
  private entityHeadY(sprite: EntitySprite): number {
    const displayHeight = sprite.rect.displayHeight

    return this.isPerspective ? sprite.rect.y - displayHeight : sprite.rect.y - displayHeight / 2
  }

  private positionSprite(sprite: EntitySprite, worldColumn: number) {
    const projection = this.projection

    if (!projection) {
      return
    }

    const point = projection.gridToScreen(sprite.row, worldColumn)

    sprite.columnFloat = worldColumn

    // offsetX (lunge/né) tính bằng px chuẩn hóa ở hàng gần — nhân depth
    // scale để đòn đánh ở xa cũng lunge đúng tỷ lệ phối cảnh.
    const screenX = point.x + sprite.offsetX * point.scale

    if (this.isPerspective) {
      this.applyEntityDepthScale(sprite, point.scale)

      // Foot anchor: origin (0.5, 1) đặt tại điểm chân đất của ô.
      sprite.rect.setPosition(screenX, point.y)
      sprite.shadow?.setPosition(screenX, point.y)
      sprite.footY = point.y
      sprite.label.setPosition(screenX, point.y + 6)
    } else {
      // Flat giữ nguyên từng pixel hành vi legacy (center anchor); boost
      // Chí Mạng áp qua setScale vì geometry flat là tĩnh. setScale PHẢI
      // chạy vô điều kiện: tween yoyo kết thúc giữa 2 frame, frame kế
      // value===1 nhưng rect vẫn giữ scale frame trước nếu bỏ qua.
      sprite.rect.setPosition(screenX, point.y)
      sprite.rect.setScale(sprite.boost.value)
      sprite.label.setPosition(screenX, point.y + sprite.rect.displayHeight / 2 + 4)
    }

    if (sprite.healthBar) {
      const headY = this.entityHeadY(sprite) - ENEMY_HP_BAR_OFFSET_Y

      sprite.healthBar.background.setPosition(screenX, headY)
      sprite.healthBar.fill.setPosition(screenX - sprite.healthBar.width / 2, headY)
    }
  }

  private getOrCreateSprite(
    id: string,
    color: number,
    labelText: string,
    row: LaneIndex = HERO_LANE_INDEX,
    health?: { currentHp: number; maxHp: number; isBoss: boolean },
  ): EntitySprite {
    const existing = this.sprites.get(id)

    if (existing) {
      return existing
    }

    const label = this.add
      .text(0, 0, labelText, { fontSize: '14px', color: '#ffffff' })
      .setOrigin(0.5, 0)
      .setDepth(DEPTH_OVERLAY_UI + 1)

    // CHỈ player có idle animation thật — enemy chưa có atlas riêng,
    // vẫn dùng Rectangle màu như cũ (xem EntitySprite.kind's ghi chú).
    if (id === PLAYER_ID) {
      const gameSprite = this.add.sprite(0, 0, IDLE_KEY, 'frame_000.png').play(IDLE_KEY)

      this.physics.add.existing(gameSprite)

      if (this.isPerspective) {
        gameSprite.setOrigin(0.5, 1)
      }

      const sprite: EntitySprite = {
        kind: 'sprite',
        rect: gameSprite,
        label,
        color,
        offsetX: 0,
        row,
        boost: { value: 1 },
        footY: 0,
        columnFloat: 0,
      }

      if (this.isPerspective) {
        sprite.shadow = this.add
          .ellipse(0, 0, 10, 4, SHADOW_COLOR, SHADOW_ALPHA)
          .setDepth(DEPTH_ENTITY_SHADOW)
      }

      this.applySpriteSize(sprite)
      this.sprites.set(id, sprite)

      return sprite
    }

    const rect = this.add
      .rectangle(0, 0, this.characterWidth, this.characterHeight, color)
      .setOrigin(0.5)

    this.physics.add.existing(rect)

    // Quái hiện vẫn là Rectangle màu (chưa có atlas định hướng) — khi
    // có sprite riêng chỉ cần setFlipX(true) ở đây, không cần spritesheet
    // mới cho chiều ngược (plan: flip bằng Phaser).
    if (this.isPerspective) {
      rect.setOrigin(0.5, 1)
    }

    const healthBarWidth = this.characterWidth * (health?.isBoss ? 1.45 : 1.05)
    const background = this.add
      .rectangle(0, 0, healthBarWidth, ENEMY_HP_BAR_HEIGHT, ENEMY_HP_BG_COLOR)
      .setOrigin(0.5)
      .setStrokeStyle(1, health?.isBoss ? BOSS_HP_FILL_COLOR : 0x6b4545)
      .setDepth(DEPTH_OVERLAY_UI + 2)
    const fill = this.add
      .rectangle(
        0,
        0,
        healthBarWidth,
        ENEMY_HP_BAR_HEIGHT - 2,
        health?.isBoss ? BOSS_HP_FILL_COLOR : ENEMY_HP_FILL_COLOR,
      )
      .setOrigin(0, 0.5)
      .setDepth(DEPTH_OVERLAY_UI + 2)
    const healthBar: EnemyHealthBar = {
      background,
      fill,
      width: healthBarWidth,
      currentHp: health?.currentHp ?? 1,
      maxHp: health?.maxHp ?? 1,
      isBoss: health?.isBoss ?? false,
    }

    const sprite: EntitySprite = {
      kind: 'rect',
      rect,
      label,
      color,
      offsetX: 0,
      row,
      boost: { value: 1 },
      footY: 0,
      columnFloat: 0,
      healthBar,
    }

    if (this.isPerspective) {
      sprite.shadow = this.add
        .ellipse(0, 0, 10, 4, SHADOW_COLOR, SHADOW_ALPHA)
        .setDepth(DEPTH_ENTITY_SHADOW)
    }

    this.sprites.set(id, sprite)
    this.updateEnemyHealthBar(sprite, healthBar.currentHp, healthBar.maxHp)

    return sprite
  }

  private updateEnemyHealthBar(sprite: EntitySprite, currentHp: number, maxHp: number) {
    const healthBar = sprite.healthBar

    if (!healthBar) {
      return
    }

    healthBar.currentHp = currentHp
    healthBar.maxHp = maxHp

    const ratio = maxHp > 0 ? Phaser.Math.Clamp(currentHp / maxHp, 0, 1) : 0

    healthBar.fill.setScale(ratio, 1)
  }

  private destroyEntitySprite(sprite: EntitySprite) {
    sprite.shadow?.destroy()
    sprite.healthBar?.background.destroy()
    sprite.healthBar?.fill.destroy()
    sprite.label.destroy()
    sprite.rect.destroy()
  }

  private clearSceneState() {
    for (const status of this.statuses.values()) {
      status.icon.destroy()
      status.label.destroy()
    }

    this.statuses.clear()

    for (const entry of this.spawnVfxHandles.values()) {
      entry.handle.destroy()
    }

    this.spawnVfxHandles.clear()
    this.materializingIds.clear()

    this.sprites.clear()
    this.interpolations.clear()
    this.castBars.clear()
    this.dyingIds.clear()
    this.playerDying = false

    // Scene shutdown đã destroy children của display list — chỉ cần bỏ
    // tham chiếu để create() kế dựng lại sạch theo mode hiện hành.
    this.arenaRect = undefined
    this.gridGraphics = undefined
    this.hoverMarker = undefined
    this.backdrop = undefined
    this.projection = undefined
  }

  private setInterpolationTarget(
    id: string,
    worldX: number,
    cadenceMs?: number,
    snapshotAt?: number,
  ) {
    const existing = this.interpolations.get(id)

    if (!existing) {
      this.snapInterpolationTarget(id, worldX, snapshotAt)

      return
    }

    if (worldX === existing.toX) {
      return
    }

    const now = this.time.now
    const currentVisualX = this.interpolate(existing, now)
    // Cadence ưu tiên từ snapshot (khoảng cách 2 event 'positions'),
    // fallback: khoảng cách từ segment trước, clamp sàn.
    const segmentDuration = Math.max(cadenceMs ?? MIN_SEGMENT_DURATION_MS, MIN_SEGMENT_DURATION_MS)

    this.interpolations.set(id, {
      fromX: currentVisualX,
      toX: worldX,
      segmentStart: now,
      segmentDuration,
      lastSnapshotAt: snapshotAt ?? now,
    })
  }

  private snapInterpolationTarget(id: string, worldX: number, snapshotAt?: number) {
    const now = this.time.now

    this.interpolations.set(id, {
      fromX: worldX,
      toX: worldX,
      segmentStart: now,
      segmentDuration: 1,
      lastSnapshotAt: snapshotAt ?? now,
    })
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

  private reconcileEnemySprites(enemies: BattlePositionsEvent['enemies']) {
    const currentIds = new Set(enemies.map((enemy) => enemy.id))

    for (const enemy of enemies) {
      if (this.sprites.has(enemy.id)) {
        continue
      }

      const sprite = this.getOrCreateSprite(enemy.id, ENEMY_COLOR, enemy.name, enemy.row, enemy)

      // Vừa materialize từ telegraph — fade-in + scale 0.7→1 (bóng/máu/
      // tên chỉ hiện từ khoảnh khắc này, đúng spec spawn mới).
      if (this.materializingIds.has(enemy.id)) {
        this.materializingIds.delete(enemy.id)
        this.playMaterializeFadeIn(sprite)
      }
    }

    for (const [id, sprite] of this.sprites) {
      if (id === PLAYER_ID || currentIds.has(id) || this.dyingIds.has(id)) {
        continue
      }

      this.destroyEntitySprite(sprite)
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
      ['attack', (event) => this.onAttack(event)],
      ['critical', (event) => this.onCritical(event)],
      ['hit', (event) => this.onHit(event)],
      ['dodge', (event) => this.onDodge(event)],
      ['cast', (event) => this.onCast(event)],
      ['cast_start', (event) => this.onCastStart(event)],
      ['cast_complete', (event) => this.onCastComplete(event)],
      ['death', (event) => this.onDeath(event)],
      ['battle_start', () => this.onBattleStart()],
    ]

    for (const [eventName, handler] of this.boundHandlers) {
      eventBus.on<CombatScenePayload>(eventName, handler)
    }

    eventBus.on<BattlePositionsEvent>('positions', this.positionsHandler)
    eventBus.on<BattleEndEvent>('battle_end', this.battleEndHandler)
    eventBus.on<void>('combat_scene_exit', this.exitHandler)
    eventBus.on<CombatEvent>('damage', this.damageHandler)
    eventBus.on<ActionImpactEvent>('action_impact', this.actionImpactHandler)
    eventBus.on<StatusVfxAttachedEvent>('status_vfx_attached', this.statusAttachHandler)
    eventBus.on<StatusVfxUpdatedEvent>('status_vfx_updated', this.statusUpdateHandler)
    eventBus.on<StatusVfxRemovedEvent>('status_vfx_removed', this.statusRemoveHandler)
    eventBus.on<EntityVitalsChangedEvent>('entity_vitals_changed', this.vitalsHandler)
    eventBus.on<BattleRewardParticleEvent>('reward_particle', this.rewardParticleHandler)
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
    this.eventBus.off<ActionImpactEvent>('action_impact', this.actionImpactHandler)
    this.eventBus.off<StatusVfxAttachedEvent>('status_vfx_attached', this.statusAttachHandler)
    this.eventBus.off<StatusVfxUpdatedEvent>('status_vfx_updated', this.statusUpdateHandler)
    this.eventBus.off<StatusVfxRemovedEvent>('status_vfx_removed', this.statusRemoveHandler)
    this.eventBus.off<EntityVitalsChangedEvent>('entity_vitals_changed', this.vitalsHandler)
    this.eventBus.off<BattleRewardParticleEvent>('reward_particle', this.rewardParticleHandler)
  }

  private onRewardParticle(event: BattleRewardParticleEvent) {
    const source = this.spriteFor(event.sourceId)
    const player = this.spriteFor(PLAYER_ID)

    if (!source || !player) return

    // Điểm phát/hứng hạt: flat dùng tâm sprite (legacy); perspective
    // phát từ LÕNG người (foot anchor nên trừ bớt chiều cao hiển thị).
    const emitPoint = (sprite: EntitySprite) => ({
      x: sprite.rect.x,
      y: this.isPerspective ? sprite.rect.y - sprite.rect.displayHeight * 0.6 : sprite.rect.y,
    })

    const start = emitPoint(source)
    const end = emitPoint(player)
    const startX = start.x
    const startY = start.y
    const endX = end.x
    const endY = end.y
    const midpointX = (startX + endX) / 2
    const horizontalDistance = Math.abs(endX - startX)
    // Ưu tiên bounds projection (đúng band battlefield hiện hành sau
    // resize); fallback công thức tỷ lệ legacy khi chưa có projection.
    const bounds = this.projection?.bounds()
    const battlefieldTop = bounds
      ? bounds.top
      : (this.canvasHeight * (COMBAT_TOP_BAR_HEIGHT + COMBAT_STATUS_BAR_HEIGHT)) / DESIGN_HEIGHT
    const battlefieldBottom = bounds
      ? bounds.bottom
      : this.canvasHeight -
        (this.canvasHeight * (COMBAT_EVENT_BAR_HEIGHT + COMBAT_CONTROL_BAR_HEIGHT)) / DESIGN_HEIGHT
    const path =
      event.kind === 'insight'
        ? {
            controlX: midpointX - horizontalDistance * 0.06,
            controlY: Math.max(
              battlefieldTop + 24,
              Math.min(startY, endY) - Math.max(72, horizontalDistance * 0.28),
            ),
          }
        : event.kind === 'item'
          ? {
              controlX: midpointX,
              controlY: Math.max(
                battlefieldTop + 24,
                Math.min(startY, endY) - Math.max(48, horizontalDistance * 0.16),
              ),
            }
          : {
              controlX: midpointX + horizontalDistance * 0.05,
              controlY: Math.min(
                battlefieldBottom - 24,
                Math.max(startY, endY) + Math.max(42, horizontalDistance * 0.08),
              ),
            }
    const particleCount = event.kind === 'insight' ? 28 : 24

    // Nhiều hạt nối đuôi nhau trên cùng quỹ đạo tạo thành một dòng linh khí
    // liên tục. Mỗi hạt lệch nhẹ control point để dải sáng có độ sống, không
    // trông như một chuỗi chấm cứng nhắc.
    for (let index = 0; index < particleCount; index++) {
      // Không có "hạt đầu" kích thước lớn: toàn bộ effect là những mote nhỏ
      // tương đồng, chồng ánh sáng lên nhau thành một dải liên tục.
      const peakAlpha =
        event.kind === 'insight'
          ? Phaser.Math.FloatBetween(0.5, 0.75)
          : Phaser.Math.FloatBetween(0.72, 1)
      // Khởi tạo trong suốt để các mote đang chờ stagger không chồng thành
      // một cục tròn tại xác quái; alpha chỉ nở dần khi hạt thực sự bay.
      const mote = this.add
        .ellipse(
          startX,
          startY,
          Phaser.Math.FloatBetween(9, 14),
          Phaser.Math.FloatBetween(2.5, 4),
          event.color,
          1,
        )
        .setBlendMode(Phaser.BlendModes.ADD)
        // Lớp upright/air VFX — bay trên đầu mọi entity nhưng dưới chrome UI.
        .setDepth(DEPTH_UPRIGHT_VFX + 2)
        .setAlpha(0)

      const state = { progress: 0 }
      const localControlX = path.controlX + Phaser.Math.Between(-8, 8)
      const localControlY = path.controlY + Phaser.Math.Between(-10, 10)

      this.tweens.add({
        targets: state,
        progress: 1,
        delay: index * 20,
        duration: (event.kind === 'insight' ? 980 : 880) + Phaser.Math.Between(-45, 70),
        ease: 'Sine.easeInOut',
        onUpdate: () => {
          const t = state.progress
          const inverse = 1 - t
          mote.setPosition(
            inverse * inverse * startX + 2 * inverse * t * localControlX + t * t * endX,
            inverse * inverse * startY + 2 * inverse * t * localControlY + t * t * endY,
          )
          const tangentX = 2 * inverse * (localControlX - startX) + 2 * t * (endX - localControlX)
          const tangentY = 2 * inverse * (localControlY - startY) + 2 * t * (endY - localControlY)
          mote.setRotation(Math.atan2(tangentY, tangentX))
          mote.setAlpha(peakAlpha * Math.pow(Math.sin(Math.PI * t), 0.65))
          mote.setScale(0.8 + Math.sin(Math.PI * t) * 0.35)
        },
        onComplete: () => {
          this.tweens.add({
            targets: mote,
            alpha: 0,
            scale: 0.1,
            duration: 90,
            onComplete: () => mote.destroy(),
          })
        },
      })
    }
  }

  private spriteFor(id: string | undefined): EntitySprite | undefined {
    return id ? this.sprites.get(id) : undefined
  }

  // Combat Grid Rework — COALESCE: nhiều event 'positions' đồng bộ trong
  // 1 frame chỉ giữ snapshot MỚI NHẤT, apply ĐÚNG MỘT lần trong update().
  // Cadence = khoảng cách giữa 2 SNAPSHOT (lastSnapshotAt), clamp
  // [MIN_SEGMENT_DURATION_MS, MAX_SEGMENT_DURATION_MS].
  private onPositions(event: BattlePositionsEvent) {
    const now = this.time.now

    if (this.lastSnapshotAt !== undefined) {
      this.pendingCadence = Math.min(
        MAX_SEGMENT_DURATION_MS,
        Math.max(50, now - this.lastSnapshotAt),
      )
    }

    this.lastSnapshotAt = now
    this.pendingPositions = event
  }

  private applyPendingPositions(event: BattlePositionsEvent) {
    // Spawn VFX reconcile TRƯỚC enemy sprites: id rời spawningEnemies =
    // materialize xong → đánh dấu để sprite mới tạo dưới đây fade-in.
    this.reconcileSpawnVfx(event)

    this.reconcileEnemySprites(event.enemies)

    this.setInterpolationTarget(PLAYER_ID, event.playerX, this.pendingCadence, this.lastSnapshotAt)

    for (const enemy of event.enemies) {
      this.setInterpolationTarget(enemy.id, enemy.x, this.pendingCadence, this.lastSnapshotAt)
    }
  }

  /**
   * Reconcile telegraph spawn VFX theo SNAPSHOT (không event tức thời):
   * id mới → tạo handle; id còn → cập nhật progress; id MẤT → materialize
   * (flash ngắn + fade-in sprite) và dọn handle. Flat mode bỏ qua (renderer
   * legacy giữ hành vi cũ).
   */
  private reconcileSpawnVfx(event: BattlePositionsEvent) {
    if (!this.isPerspective) {
      return
    }

    const seen = new Set<string>()

    for (const spawning of event.spawningEnemies ?? []) {
      seen.add(spawning.id)

      const existing = this.spawnVfxHandles.get(spawning.id)

      if (existing) {
        existing.progress = spawning.progress

        continue
      }

      if (!this.projection) {
        continue
      }

      const handle = spawnEnemySpawnVfx({
        scene: this,
        projection: this.projection,
        row: spawning.row,
        column: spawning.column,
        presetId: spawning.presetId,
        uprightDepth: this.resolveUprightVfxDepth(spawning),
      })

      this.spawnVfxHandles.set(spawning.id, { handle, progress: spawning.progress })
    }

    for (const [id, entry] of [...this.spawnVfxHandles]) {
      if (seen.has(id)) {
        continue
      }

      this.spawnVfxHandles.delete(id)
      this.materializingIds.add(id)
      entry.handle.complete()
    }
  }

  /** Fade-in + scale 0.7→1 cho enemy vừa materialize (một lần duy nhất). */
  private playMaterializeFadeIn(sprite: EntitySprite) {
    sprite.boost.value = 0.7

    this.tweens.add({
      targets: sprite.boost,
      value: 1,
      duration: 200,
      ease: 'Quad.easeOut',
    })

    // Chỉ cần khả năng setAlpha — structural typing thay vì component
    // interface của Phaser 4 (gồm alphaTopLeft... không khớp GameObject).
    const alphaTargets: Array<{ target: { setAlpha(value: number): unknown }; final: number }> = []

    alphaTargets.push({ target: sprite.rect, final: 1 })
    alphaTargets.push({ target: sprite.label, final: 1 })

    if (sprite.shadow) {
      alphaTargets.push({ target: sprite.shadow, final: SHADOW_ALPHA })
    }

    if (sprite.healthBar) {
      alphaTargets.push({ target: sprite.healthBar.background, final: 1 })
      alphaTargets.push({ target: sprite.healthBar.fill, final: 1 })
    }

    for (const entry of alphaTargets) {
      entry.target.setAlpha(0)
    }

    const state = { t: 0 }

    this.tweens.add({
      targets: state,
      t: 1,
      duration: 200,
      ease: 'Quad.easeOut',
      onUpdate: () => {
        for (const entry of alphaTargets) {
          entry.target.setAlpha(entry.final * state.t)
        }
      },
      onComplete: () => {
        for (const entry of alphaTargets) {
          entry.target.setAlpha(entry.final)
        }
      },
    })
  }

  // Trận kết thúc (thắng/thua) — dọn quái còn sót (trừ đang dở tween
  // chết), đưa player về giữa sân trừ khi đang dở tween chết. KHÔNG tự
  // rời scene ở đây — CombatResultModal.vue (Vue) quyết định lúc nào
  // rời (xem onExit()), vì cần đợi người chơi xem kết quả trước.
  private onBattleEnd() {
    this.reconcileEnemySprites([])

    if (!this.playerDying) {
      this.snapInterpolationTarget(PLAYER_ID, 0)
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
    const color = event.critical
      ? CRITICAL_DAMAGE_COLOR
      : isDamageToPlayer
        ? DAMAGE_TAKEN_COLOR
        : DAMAGE_DEALT_COLOR

    this.showDamageNumber(target, event.value, color, event.critical ?? false)
  }

  private onVitalsChanged(event: EntityVitalsChangedEvent) {
    const sprite = this.spriteFor(event.entityId)

    if (sprite) {
      this.updateEnemyHealthBar(sprite, event.hpAfter, event.maxHp)
    }
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
      .text(
        sprite.rect.x + jitterX,
        this.entityHeadY(sprite),
        `-${formatNumber(Math.round(value))}`,
        {
          fontSize: `${fontSize}px`,
          fontStyle: critical ? 'bold' : 'normal',
          color,
        },
      )
      .setOrigin(0.5, 1)
      .setDepth(DEPTH_OVERLAY_UI + 6)
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

    // Pop qua boost object — projection ghi kích thước mỗi frame nên
    // tween scale trực tiếp sẽ bị ghi đè; boost nhân vào kích thước cuối
    // ở applyEntityDepthScale() (perspective) / setScale (flat).
    this.tweens.killTweensOf(target.boost)
    target.boost.value = 1

    this.tweens.add({
      targets: target.boost,
      value: 1.25,
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

    if (event.skillName) {
      this.showFloatingText(caster, event.skillName, CAST_NAME_COLOR)
    }
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
    const y = this.entityHeadY(caster) - CAST_BAR_OFFSET_Y

    const bg = this.add
      .rectangle(caster.rect.x, y, widthPx, CAST_BAR_HEIGHT, CAST_BAR_BG_COLOR)
      .setOrigin(0.5)
      .setStrokeStyle(1, 0x000000, 0.5)
      .setDepth(DEPTH_OVERLAY_UI + 3)

    const fill = this.add
      .rectangle(
        caster.rect.x - widthPx / 2,
        y,
        widthPx - 2,
        CAST_BAR_HEIGHT - 2,
        CAST_BAR_FILL_COLOR,
      )
      .setOrigin(0, 0.5)
      .setScale(0, 1)
      .setDepth(DEPTH_OVERLAY_UI + 3)

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
    const y = this.entityHeadY(sprite) - CAST_BAR_OFFSET_Y

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
    this.tweens.killTweensOf(sprite.boost)

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

        this.destroyEntitySprite(sprite)
        this.sprites.delete(id)
        this.dyingIds.delete(id)
        this.interpolations.delete(id)
      },
    })

    this.tweens.add({
      targets: [
        sprite.label,
        sprite.shadow,
        sprite.healthBar?.background,
        sprite.healthBar?.fill,
      ].filter(Boolean),
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
    this.snapInterpolationTarget(PLAYER_ID, 0)

    // Auto-repeat/trận mới trong cùng scene — dọn telegraph cũ (snapshot
    // mới của battle kế sẽ tạo handle sạch theo pendingEnemySpawns mới).
    for (const entry of this.spawnVfxHandles.values()) {
      entry.handle.destroy()
    }

    this.spawnVfxHandles.clear()
    this.materializingIds.clear()

    for (const [id, sprite] of this.sprites) {
      if (id === PLAYER_ID) {
        continue
      }

      this.destroyEntitySprite(sprite)
      this.sprites.delete(id)
      this.interpolations.delete(id)
    }

    this.dyingIds.clear()

    for (const id of [...this.castBars.keys()]) {
      this.destroyCastBar(id)
    }
  }

  // ================= Combat Grid Rework — VFX 2.5D theo space =================

  /**
   * MỘT action_impact = MỘT VFX instance (spawnActionImpactVfx): mọi
   * pulse/hit sống trong cùng 1 cặp Graphics + 1 timeline, không bao giờ
   * sinh GameObject theo hitCount/target. preset.space quyết định không
   * gian; polygon footprint CHỈ trình bày — damage do core quyết định.
   */
  private onActionImpact(event: ActionImpactEvent) {
    const projection = this.projection

    if (!projection) {
      return
    }

    const preset = getCombatVfxPreset(event.presetId)
    // MỘT action = MỘT VFX chính; multi-hit chỉ thêm pulse (spec mục 8).
    const pulses = Math.max(1, Math.min(6, event.hitCount))

    spawnActionImpactVfx({
      scene: this,
      projection,
      area: event.affectedArea,
      anchorCell: event.anchorCell,
      preset,
      pulses,
      uprightDepth: this.resolveUprightVfxDepth(event.anchorCell),
    })

    if (preset.screenShake) {
      this.cameras.main.shake(preset.screenShake.durationMs, preset.screenShake.intensity)
    }

    // affectedTargetIds chỉ phục vụ hit-flash — KHÔNG spawn effect sao.
    for (const targetId of event.landedTargetIds) {
      const sprite = this.spriteFor(targetId)

      if (sprite) {
        this.flashColor(sprite, preset.color, 90)
      }
    }
  }

  /**
   * Depth lớp upright cho impact tại anchorCell: cùng hệ với entity sprite
   * (foot Y) + bias nhỏ → effect đè đúng target của nó nhưng vẫn bị
   * entity hàng GẦN camera che (occlusion 2.5D). Flat mode giữ lớp
   * upright cố định như renderer cũ.
   */
  private resolveUprightVfxDepth(anchorCell: GridPosition): number {
    if (!this.isPerspective || !this.projection) {
      return DEPTH_UPRIGHT_VFX
    }

    const anchor = this.projection.gridToScreen(anchorCell.row, anchorCell.column)

    return uprightVfxDepth(anchor.y, this.entityFootMinY, this.entityFootMaxY, anchorCell.column)
  }

  private onStatusAttached(event: StatusVfxAttachedEvent) {
    if (this.statuses.has(event.statusInstanceId)) {
      return
    }

    const target = this.spriteFor(event.targetId)

    if (!target) {
      return
    }

    const headY = this.entityHeadY(target)
    const icon = this.add.rectangle(
      target.rect.x,
      headY - 14,
      9,
      9,
      getStatusVfxPreset(event.dotType).color,
    )

    icon.setAngle(45)
    icon.setDepth(DEPTH_OVERLAY_UI + 4)

    const label = this.add.text(icon.x, headY - 27, String(event.stacks), {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#ffd54f',
    })

    label.setOrigin(0.5, 0.5)
    label.setDepth(DEPTH_OVERLAY_UI + 5)

    this.statuses.set(event.statusInstanceId, { targetId: event.targetId, icon, label })
  }

  private onStatusUpdated(event: StatusVfxUpdatedEvent) {
    const status = this.statuses.get(event.statusInstanceId)

    status?.label.setText(String(event.stacks))
  }

  private onStatusRemoved(event: StatusVfxRemovedEvent) {
    const status = this.statuses.get(event.statusInstanceId)

    if (!status) {
      return
    }

    status.icon.destroy()
    status.label.destroy()
    this.statuses.delete(event.statusInstanceId)
  }

  // Input 2.5D — pointer quy đổi NGƯỢC screen→grid qua projection. Camera
  // combat luôn zoom 1 nên pixel canvas == pixel màn hình, không cần bù
  // transform; containsScreenPoint kiểm tra TRÊN MIỀN CHƯA clamp (sky/
  // ngoài cạnh gần → false) nên marker không bao giờ "kẹt" ở hàng biên
  // khi pointer nằm ngoài sân. Ô hover chuẩn hóa bằng chính helpers làm
  // tròn của core (getLaneFromWorldY/getColumnFromWorldX) để LUÔN khớp ô
  // targeting logic.
  private onPointerMove(pointer: Phaser.Input.Pointer) {
    const projection = this.projection
    const marker = this.hoverMarker

    if (!projection || !marker || !this.isPerspective) {
      return
    }

    if (!projection.containsScreenPoint(pointer.x, pointer.y)) {
      marker.setVisible(false)

      return
    }

    const hit = projection.screenToGrid(pointer.x, pointer.y)

    // hit.row/hit.column đã ở đúng ĐƠN VỊ của core (tâm ô = giá trị
    // nguyên) — truyền thẳng vào helpers làm tròn chuẩn của BattleGrid.
    const row = getLaneFromWorldY(hit.row)
    const column = getColumnFromWorldX(hit.column)
    const point = projection.gridToScreen(row, column)
    const cell = projection.cellSizeAt(row)

    marker.setSize(cell.width * 0.86, cell.height * 0.86)
    marker.setPosition(point.x, point.y)
    marker.setVisible(true)
  }

  private updateStatusIconPositions() {
    for (const status of this.statuses.values()) {
      const sprite = this.spriteFor(status.targetId)

      if (!sprite) {
        continue
      }

      const headY = this.entityHeadY(sprite)

      status.icon.setPosition(sprite.rect.x, headY - 14)
      status.label.setPosition(sprite.rect.x, headY - 27)
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
      .text(sprite.rect.x, this.entityHeadY(sprite), text, { fontSize: '13px', color })
      .setOrigin(0.5, 1)
      .setDepth(DEPTH_OVERLAY_UI + 6)

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
    this.tweens.killTweensOf(sprite.boost)

    sprite.rect.setAlpha(1)
    sprite.rect.setRotation(0)
    sprite.rect.setScale(1)
    sprite.label.setAlpha(1)
    sprite.shadow?.setAlpha(SHADOW_ALPHA)

    if (sprite.kind === 'sprite') {
      const gameSprite = sprite.rect as Phaser.GameObjects.Sprite

      gameSprite.clearTint()
      gameSprite.play(IDLE_KEY, true)
      this.applySpriteSize(sprite)
    } else {
      const rect = sprite.rect as Phaser.GameObjects.Rectangle

      rect.setFillStyle(sprite.color)
    }

    if (sprite.healthBar) {
      sprite.healthBar.background.setAlpha(1)
      sprite.healthBar.fill.setAlpha(1)
    }

    sprite.boost.value = 1
    sprite.offsetX = 0

    // Kích thước/foot point áp lại ngay để không chờ frame kế (reset
    // hiện chỉ dùng cho player).
    this.applySpriteSize(sprite)

    if (sprite === this.sprites.get(PLAYER_ID)) {
      const entry = this.interpolations.get(PLAYER_ID)

      if (entry) {
        this.positionSprite(sprite, entry.toX)
      }
    }
  }
}
