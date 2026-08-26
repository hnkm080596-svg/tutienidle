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
  PlayerTeleportedEvent,
} from '@/core/battle/BattleEvents'
import {
  GRID_ROW_COUNT,
  GRID_COLUMN_COUNT,
  VISIBLE_MAX_COLUMN,
  HERO_COLUMN,
  HERO_LANE_INDEX,
  type LaneIndex,
} from '@/core/battle/BattleLane'
import { getCombatInsets } from '@/game/support/combatInsets'
import type { GridPosition } from '@/core/battle/BattleGrid'
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
import {
  spawnEnemySpawnVfx,
  type EnemySpawnVfxHandle,
} from '@/game/support/EnemySpawnVfx'
import {
  ENEMY_SOURCE_SIZE,
  enemyTextureUrl,
  resolveEnemyTextureKey,
} from '@/game/support/EnemyArt'
import {
  PLAYER_VISUAL_PROFILES,
  getBodyAnchors,
  resolvePlayerVisualProfileId,
  type PlayerBodyAnchorId,
  type PlayerVisualProfile,
  type PlayerVisualProfileId,
} from '@/game/support/PlayerVisualProfiles'
import { resolveSpriteBodyAnchor } from '@/game/support/SpriteBodyAnchor'
import {
  GOURD_MOUTH_ANCHOR,
  GOURD_PLACEHOLDER_SIZE,
  GOURD_TEXTURE_KEY,
  GOURD_TEXTURE_URL,
  computeGourdPlacement,
  easeRewardProgress,
  resolveGourdMouth,
  resolveRewardControlPoint,
  rewardMoteScale,
  rewardSwirlOffset,
} from '@/game/support/RewardGourd'
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
import {
  peekThanhVanVariant,
  selectNextThanhVanVariant,
  commitThanhVanVariant,
  thanhVanLoadList,
  type ThanhVanVariant,
} from '@/game/support/ThanhVanArt'
import { attachThanhVanBackdrop, type ThanhVanBackdropHandle } from '@/game/support/ThanhVanBackdrop'
import { PLAYER_TEXTURE_KEY, queueCombatAssets } from '@/game/support/CombatPreload'
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

// Combat uses the static mortal artwork. MainScene keeps its existing atlas;
// the scenes intentionally use separate texture keys and presentations.
// Key/URL sống ở support/CombatPreload.ts (dùng chung 2 scene — fix spawn
// animation lần đầu, xem file đó).
const PLAYER_SOURCE_SIZE = { w: 1244, h: 1264 }

const ATTACK_LUNGE_PX = 8
const HIT_RECOIL_PX = 6
const ATTACK_LUNGE_DURATION_MS = 75
const HIT_RECOIL_DURATION_MS = 65

/** DoT text flush 3 lần/giây (plan §7.2) — cửa sổ gom 333,33ms. */
const DOT_TEXT_FLUSH_INTERVAL_MS = 1000 / 3

/**
 * Format số DoT hiển thị (hàm thuần, test trực tiếp) — tổng ≥1 làm tròn
 * qua formatter chung; 0<x<1 hiện 1 chữ số thập phân với sàn 0.1 nên
 * KHÔNG bao giờ render "-0.0" (fix 2026-08-26).
 */
export function formatDotDamageText(value: number): string {
  const rounded = Math.round(value)

  if (Math.abs(rounded) >= 1) {
    return `-${formatNumber(rounded)}`
  }

  const tenth = Math.max(1, Math.round(Math.abs(value) * 10)) / 10

  return `-${tenth.toFixed(1)}`
}

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

// Combat AI rework (plan §12.1) — avatar Player LỚN GẤP ĐÔI enemy: chỉ
// nhân lên PLAYER sprite, không đụng enemy/VFX footprint. Kích thước cuối
// = source aspect ratio × base character size × multiplier × depth scale.
const PLAYER_DISPLAY_SCALE_MULTIPLIER = 2

// Enemy art x2 (yêu cầu 2026-08-26) — PNG quái hiển thị GẤP ĐÔI: nhân
// đúng MỘT LẦN tại sizeMultiplier, KHÔNG cộng dồn vào depth scale hay
// spawn tween (boost). Áp cho enemy DÙNG PNG (kind='sprite', kể cả Boss
// — cùng quy tắc); fallback Rectangle giữ kích thước cũ vì không phải
// "hình ảnh enemy".
const ENEMY_DISPLAY_SCALE_MULTIPLIER = 2

// Hero cố định sát mép trái battlefield (top-down 5-lane, 2026-08-22 —
// thay layout side-view cũ có layout side-view cũ) — chừa 1
// lề nhỏ để sprite không bị cắt viền trái.

// Sàn thời lượng 1 đoạn nội suy — tránh chia gần 0 nếu 2 lần cập nhật
// vị trí liên tiếp tới quá sát nhau.
const MIN_SEGMENT_DURATION_MS = 16
const MAX_SEGMENT_DURATION_MS = 200

const PLAYER_ID = 'player'

// Audit P0-3 — anchor THÂN TRUNG TÍNH cho enemy reward particle,
// chuẩn hoá theo bounds của chính sprite enemy (0.5, ~0.4 từ chân).
// Enemy không có catalog anchor như Player (PlayerVisualProfiles) nên
// KHÔNG ĐƯỢC mượn anchor Player — vị trí particle không được đổi khi
// Player đổi visual profile.
const ENEMY_NEUTRAL_BODY_ANCHOR = { x: 0.5, y: 0.4 } as const

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
  // Player visual profile bridge (body-anchor plan §4.2) — event
  // 'player_visual_profile_changed' gửi kèm ID hình thái mới.
  profileId?: string
}

interface ResizeSize {
  width: number
  height: number
}

interface EntitySprite {
  // Player = Sprite profile art, enemy = Sprite Mortal art batch HOẶC
  // Rectangle màu (id ngoài batch). `kind` phân biệt để biết dùng
  // setFillStyle() hay setTint()/clearTint() (flashColor()/resetVisual())
  // — mọi thao tác position/scale/rotation/alpha khác đều dùng chung API.
  kind: 'rect' | 'sprite'
  rect: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Sprite
  label: Phaser.GameObjects.Text
  color: number
  offsetX: number
  row: LaneIndex
  healthBar?: EnemyHealthBar

  /**
   * Kích thước nguồn của texture sprite này — player theo profile hiện
   * hành (this.playerSourceSize), enemy art batch 1254². Bắt buộc cho
   * mọi kind='sprite' để setDisplaySize giữ đúng tỉ lệ khung hình.
   */
  sourceSize?: { w: number; h: number }

  // Combat AI rework (plan §12.1) + enemy art x2 (2026-08-26) — player
  // sprite ×2, enemy PNG ×2 (fallback Rectangle ×1).
  sizeMultiplier: number

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

  /** Variant Thanh Vân đang dùng (season/time, override qua localStorage). */
  // Variant Thanh Vân của PHIÊN — peek (cache module) trả preset cố định
  // spring/morning lúc boot; battle_end chọn + swap variant kế tiếp.
  private thanhVanVariant: ThanhVanVariant = peekThanhVanVariant()

  /** true giữa battle_start và battle_end — cấm swap backdrop giữa trận. */
  private inBattle = false

  /**
   * Generation token cho background: battle_end cấp token mới cho lần
   * load hiện hành, battle_start tăng token để callback load cũ không
   * bao giờ swap nhầm vào giữa trận (yêu cầu 2026-08-26).
   */
  private backdropGeneration = 0

  /** true khi nền là art modular — grid lines/border không vẽ đè lên art. */
  private usingArtBackdrop = false
  private gridGraphics?: Phaser.GameObjects.Graphics

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

  // Player spawn telegraph (plan §12.2) — handle DUY NHẤT cho telegraph
  // của avatar (preset 'player_spawn'); playerMaterialized false = KHÔNG
  // hiện Player sprite. Pending telegraph và materialized sprite loại
  // trừ nhau để không render hai lần.
  private playerSpawnHandle?: EnemySpawnVfxHandle
  private playerMaterialized = true

  // ================= Player visual profile (body-anchor plan §4) ======
  // Profile hiện hành — đọc từ Phaser registry lúc create() và cập nhật
  // qua event 'player_visual_profile_changed' (bridge ở PhaserCanvas.vue).
  private playerProfileId: PlayerVisualProfileId = 'mortal'
  private playerProfile: PlayerVisualProfile = PLAYER_VISUAL_PROFILES.mortal

  /** Kích thước nguồn của texture combat đang gắn trên player sprite. */
  private playerSourceSize = { ...PLAYER_VISUAL_PROFILES.mortal.combatSourceSize }

  /**
   * Static texture thay atlas idle — art profile là PNG tĩnh, KHÔNG play
   * animation; resetVisual() phải bỏ qua .play().
   */
  private playerUsesStaticTexture = true

  // Debug body anchors (plan §5.4) — dev-only, bật qua
  // localStorage['debug.playerBodyAnchors']='1'; không có UI production.
  private readonly debugBodyAnchorsEnabled =
    typeof window !== 'undefined' && window.localStorage?.getItem('debug.playerBodyAnchors') === '1'
  private debugAnchorGraphics?: Phaser.GameObjects.Graphics

  // ================= Reward gourd + stream state (plan §6/§7) =========
  private gourdPlacement = computeGourdPlacement({ canvasHeight: 0, bottomInset: 0 })

  /**
   * View hồ lô: Image art thật khi texture sẵn sàng (plan §8), fallback
   * Graphics placeholder nếu thiếu. Cùng API setPosition/scale/destroy
   * nên pulse/placement dùng chung.
   */
  private gourdGraphics?: Phaser.GameObjects.Image | Phaser.GameObjects.Graphics

  /** Scale gốc sau setDisplaySize — pulse nhân lên, không đè tuyệt đối. */
  private gourdBaseScale = { x: 1, y: 1 }

  private gourdPulseTween?: Phaser.Tweens.Tween

  /** Bottom inset gần nhất (Event+Control bar) — create() dựng view muộn cần re-position. */
  private gourdBottomInset = 0

  /**
   * Vị trí screen GẦN NHẤT của mọi sprite (update trong positionSprite)
   * — nguồn dự phòng cho reward particle khi sprite nguồn đã bị dọn.
   */
  private lastKnownScreenPositions = new Map<string, { x: number; y: number }>()

  /** Ô grid gần nhất theo snapshot positions — fallback cuối cùng. */
  private lastKnownGridPositions = new Map<string, { row: LaneIndex; column: number }>()

  private readonly maxTrackedSourcePositions = 64

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
  private playerTeleportedHandler = (event: PlayerTeleportedEvent) => this.onPlayerTeleported(event)
  private playerVisualProfileHandler = (event: CombatScenePayload) => {
    const profileId = event.profileId as PlayerVisualProfileId | undefined

    if (profileId && PLAYER_VISUAL_PROFILES[profileId]) {
      this.applyPlayerVisualProfile(profileId)
    }
  }
  private debugAnchorHandler = () => this.drawDebugBodyAnchors()

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
    // Toàn bộ texture combat dùng chung 1 helper với MainScene (eager
    // preload lúc boot — fix "lần đầu vào combat không thấy spawn
    // animation", xem support/CombatPreload.ts).
    queueCombatAssets(this)
  }

  create() {
    // Đọc flag MỖI LẦN create — đổi mode qua localStorage có hiệu lực ở
    // lần vào Combat kế tiếp (Home ↔ Combat là đủ, không cần reload).
    this.renderMode = getBattlefieldRenderMode()

    this.gridGraphics = this.add.graphics().setDepth(DEPTH_GROUND_GRID)

    if (!this.isPerspective) {
      this.arenaRect = this.add
        .rectangle(0, 0, 0, 0, ARENA_COLOR)
        .setOrigin(0.5)
        .setDepth(DEPTH_BACKGROUND)
    }

    this.applyBattlefieldLayout(this.scale.width, this.scale.height)

    // Player visual profile (body-anchor plan §4.2) — đọc SNAPSHOT từ
    // registry TRƯỚC khi dựng sprite để không bỏ lỡ trạng thái khi scene
    // khởi động; cập nhật về sau qua event
    // 'player_visual_profile_changed' (subscribeCombatEvents).
    const registryProfileId = this.registry.get('playerVisualProfileId') as
      | PlayerVisualProfileId
      | undefined

    if (registryProfileId && PLAYER_VISUAL_PROFILES[registryProfileId]) {
      this.applyPlayerVisualProfile(registryProfileId)
    }

    // Reward gourd (plan §6 + §8) — art thật nếu texture sẵn sàng,
    // fallback Graphics placeholder. Dựng MỘT LẦN mỗi create();
    // auto-refight KHÔNG tạo lại hồ lô và streams cũ tự hoàn tất vào
    // đúng miệng nó (§7.4).
    if (!this.gourdGraphics) {
      if (this.textures.exists(GOURD_TEXTURE_KEY)) {
        this.gourdGraphics = this.add.image(0, 0, GOURD_TEXTURE_KEY)
      } else {
        this.gourdGraphics = this.add.graphics()
      }

      this.gourdGraphics.setDepth(DEPTH_OVERLAY_UI - 4)
    }

    this.refreshRewardGourd(this.canvasHeight, this.gourdBottomInset)

    // Scene này chỉ được start() SAU KHI 'battle_start' đã emit (xem
    // MainScene.ts) — quái/player đầu tiên đã tồn tại ở core rồi. Player
    // sprite dựng NGAY nhưng ẨN cho tới khi snapshot báo materialize
    // (plan §12.2): pending telegraph và materialized sprite loại trừ
    // nhau. Quái tới qua 'positions' đầu tiên như bình thường.
    const player = this.getOrCreateSprite(PLAYER_ID, PLAYER_COLOR, 'Player', HERO_LANE_INDEX)

    player.rect.setVisible(false)

    this.playerMaterialized = false
    this.snapInterpolationTarget(PLAYER_ID, HERO_COLUMN)
    this.positionSprite(player, HERO_COLUMN)

    // Lifecycle listeners dùng handler ỔN ĐỊNH + gỡ đúng lúc shutdown —
    // ScaleManager là game-level nên anonymous callback đăng ký mỗi
    // create() sẽ TÍCH TỤC qua các lần Home → Combat (N listener cùng
    // chạy mỗi resize). events.once đảm bảo shutdown handler tự gỡ.
    this.scale.on('resize', this.resizeHandler)


    this.subscribeCombatEvents()

    // Late-join replay (fix spawn animation lần đầu, 2026-08-26): nếu
    // scene start MUỘN so với battle_start, phát lại snapshot positions
    // mới nhất từ registry (bridge trong PhaserCanvas.vue) để reconcile
    // telegraph/spawn theo đúng phase đang chạy. Snapshot stale (>2s)
    // bỏ qua — trận kế tiếp tự có snapshot tươi trong ~100ms.
    const snapshot = this.registry.get('lastBattlePositionsSnapshot') as
      | { event: BattlePositionsEvent; at: number }
      | undefined

    if (snapshot && performance.now() - snapshot.at < 2000) {
      this.onPositions(snapshot.event)
    }

    // Vòng đời background (2026-08-26): KHÔNG rotate ở đây nữa — trận
    // đầu dùng đúng preset đã preload lúc boot; variant kế tiếp được
    // chọn + load + swap tại battle_end (xem onBattleEnd()).
    this.inBattle = true

    this.events.once('shutdown', this.shutdownHandler)
  }

  private resizeHandler = (gameSize: ResizeSize) => {
    this.applyBattlefieldLayout(gameSize.width, gameSize.height)
  }

  private shutdownHandler = () => {
    this.scale.off('resize', this.resizeHandler)
    this.unsubscribeCombatEvents()
    this.clearSceneState()
  }

  update() {
    for (const [id, sprite] of this.sprites) {
      const visualX = this.getInterpolatedX(id)

      if (visualX === undefined) {
        continue
      }

      this.positionSprite(sprite, visualX, id)

      // Reward stream fallback cache (plan §7.1) — last-known screen
      // position per entity, dùng khi sprite nguồn đã bị dọn trước khi
      // reward particle được render.
      this.trackSourceScreenPosition(id, sprite)

      const castBar = this.castBars.get(id)

      if (castBar) {
        this.positionCastBar(sprite, castBar)
      }
    }

    // Combat Grid Rework — DOT icon bám theo target mỗi frame.
    this.updateStatusIconPositions()

    // Debug body anchors (plan §5.4, dev-only).
    if (this.debugBodyAnchorsEnabled) {
      this.drawDebugBodyAnchors()
    }

    // DoT presentation (§7.2) — flush bucket đến hạn mỗi frame.
    this.flushDueDotTexts()

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
      // Thanh Vân art mount (thanh-van-dong-fu-art-production-plan) —
      // ưu tiên modular layers (sky + 6 layer mùa); texture thiếu thì
      // fallback procedural backdrop cũ. Flat mode giữ procedural.
      const allTexturesReady = thanhVanLoadList(this.thanhVanVariant).every((entry) =>
        this.textures.exists(entry.key),
      )

      if (allTexturesReady) {
        this.backdrop = attachThanhVanBackdrop(
          this,

          this.thanhVanVariant,

          width,

          height,
        )

        this.usingArtBackdrop = true
      } else {
        this.backdrop = attachBattlefieldBackdrop(this, this.projection)

        this.usingArtBackdrop = false
      }
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

    this.backdrop?.redraw(width, height)

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

    for (const [id, sprite] of this.sprites) {
      const entry = this.interpolations.get(id)

      this.applySpriteSize(sprite)
      this.positionSprite(sprite, entry ? this.interpolate(entry, this.time.now) : 0, id)
    }

    for (const [id, castBar] of this.castBars) {
      const sprite = this.sprites.get(id)

      if (sprite) {
        this.positionCastBar(sprite, castBar)
      }
    }

    this.updateStatusIconPositions()

    // Reward gourd (plan §6.2) — neo safe-area theo canvas + bottom inset,
    // tính lại trong MỌI lần layout/resize.
    this.gourdBottomInset = viewport.bottomInset

    this.refreshRewardGourd(height, viewport.bottomInset)
  }

  // ================= Reward gourd placeholder (body-anchor plan §6) ====

  /**
   * Tính lại vị trí hồ lô theo viewport hiện hành và cập nhật view.
   * Neo góc TRÁI DƯỚI battlefield an toàn — phía trên Event Bar +
   * Control Bar, KHÔNG neo theo grid Player. Art thật (Image): origin =
   * normalized mouth anchor nên setPosition đặt ĐÚNG miệng; Graphics
   * placeholder: shapes vẽ tương đối quanh miệng.
   */
  private refreshRewardGourd(canvasHeight: number, bottomInset: number) {
    this.gourdPlacement = computeGourdPlacement({ canvasHeight, bottomInset })

    const view = this.gourdGraphics

    if (!view) {
      return
    }

    const mouth = resolveGourdMouth(this.gourdPlacement)

    view.setPosition(mouth.x, mouth.y)

    if (view instanceof Phaser.GameObjects.Image) {
      view.setOrigin(GOURD_MOUTH_ANCHOR.x, GOURD_MOUTH_ANCHOR.y)

      view.setDisplaySize(GOURD_PLACEHOLDER_SIZE.w, GOURD_PLACEHOLDER_SIZE.h)

      // Scale gốc sau setDisplaySize — pulse nhân lên thay vì đè số tuyệt đối.
      this.gourdBaseScale = { x: view.scaleX, y: view.scaleY }
    } else {
      this.gourdBaseScale = { x: 1, y: 1 }

      this.redrawGourd()
    }
  }

  /** Placeholder Graphics thuần — không asset AI, silhouette đọc tốt. */
  private redrawGourd() {
    const graphics = this.gourdGraphics

    if (!(graphics instanceof Phaser.GameObjects.Graphics)) {
      return
    }

    const { w: width, h: height } = GOURD_PLACEHOLDER_SIZE

    graphics.clear()

    // Thân dưới (bầu to) + thân trên (bầu nhỏ) — tông ngọc sẫm.
    graphics.fillStyle(0x1d3a2c, 1)
    graphics.fillEllipse(0, height * 0.42, width * 0.84, height * 0.52)
    graphics.fillEllipse(0, height * 0.14, width * 0.6, height * 0.34)

    // Khối bóng nhẹ bên trái tạo thể tích.
    graphics.fillStyle(0x27503b, 1)
    graphics.fillEllipse(-width * 0.16, height * 0.4, width * 0.3, height * 0.36)

    // Miệng hồ lô — anchor hút (0,0), vành đồng cổ + lòng tối.
    graphics.fillStyle(0x8a6a3a, 1)
    graphics.fillEllipse(0, 0, width * 0.44, height * 0.12)
    graphics.fillStyle(0x120c08, 1)
    graphics.fillEllipse(0, 0, width * 0.32, height * 0.075)

    // Dây đỏ trầm quấn quanh cổ + tua xuống thân.
    graphics.lineStyle(2.5, 0xa33228, 0.95)
    graphics.strokeEllipse(0, height * 0.07, width * 0.5, height * 0.1)
    graphics.beginPath()
    graphics.moveTo(width * 0.18, height * 0.12)
    graphics.lineTo(width * 0.26, height * 0.3)
    graphics.moveTo(-width * 0.18, height * 0.12)
    graphics.lineTo(-width * 0.24, height * 0.32)
    graphics.strokePath()
  }

  /** Pulse ĐÚNG MỘT nhịp mỗi reward event (plan §6.3) — nở từ miệng. */
  private pulseGourd() {
    const view = this.gourdGraphics

    if (!view) {
      return
    }

    this.tweens.killTweensOf(view)

    view.setScale(this.gourdBaseScale.x, this.gourdBaseScale.y)

    const base = this.gourdBaseScale

    // Proxy scale — nhân lên từ scale gốc (Image display-size ≠ scale 1).
    const pulse = { value: 1 }

    this.tweens.add({
      targets: pulse,

      value: 1.12,

      duration: 90,

      yoyo: true,

      ease: 'Quad.easeOut',

      onUpdate: () => {
        view.setScale(base.x * pulse.value, base.y * pulse.value)
      },

      onComplete: () => {
        view.setScale(base.x, base.y)
      },
    })
  }

  /** Điểm hút LIVE — luôn là miệng hồ lô, không bao giờ là Player (§7.2). */
  private gourMouthPoint(): { x: number; y: number } {
    return resolveGourdMouth(this.gourdPlacement)
  }

  // ================= Player visual profile + body anchors =============

  /**
   * Đổi hình thái Player (plan §4.3): thay texture + kích thước nguồn +
   * bảng anchor nhưng GIỮ NGUYÊN entity, position interpolation, HP/VFX
   * state — chỉ "lột xác" presentation.
   */
  private applyPlayerVisualProfile(profileId: PlayerVisualProfileId) {
    const profile = PLAYER_VISUAL_PROFILES[profileId] ?? PLAYER_VISUAL_PROFILES.mortal

    this.playerProfileId = profile.id

    this.playerProfile = profile

    this.playerSourceSize = { ...profile.combatSourceSize }

    this.playerUsesStaticTexture = true

    const sprite = this.sprites.get(PLAYER_ID)

    if (sprite && sprite.kind === 'sprite') {
      const gameSprite = sprite.rect as Phaser.GameObjects.Sprite

      if (this.textures.exists(profile.combatTextureKey)) {
        gameSprite.setTexture(profile.combatTextureKey)
      }

      this.applySpriteSize(sprite)
    }
  }

  /** Snapshot transform hiện hành của player sprite cho anchor resolver. */
  private playerTransformSnapshot():
    | Parameters<typeof resolveSpriteBodyAnchor>[1]
    | undefined {
    const sprite = this.sprites.get(PLAYER_ID)

    if (!sprite || sprite.kind !== 'sprite') {
      return undefined
    }

    return {
      x: sprite.rect.x,

      y: sprite.rect.y,

      displayWidth: sprite.rect.displayWidth,

      displayHeight: sprite.rect.displayHeight,

      originX: 0.5,

      originY: this.isPerspective ? 1 : 0.5,

      flipX: false,

      rotation: sprite.rect.rotation,
    }
  }

  /**
   * Body anchor → screen point (plan §5.2). One-shot VFX gọi đúng lúc
   * spawn; sustained VFX gọi lại mỗi frame để bám tay khi bob/lunge/
   * recoil (transform snapshot đọc live).
   */
  private getPlayerBodyAnchorScreen(
    anchorId: PlayerBodyAnchorId,
  ): { x: number; y: number } | undefined {
    const transform = this.playerTransformSnapshot()

    if (!transform) {
      return undefined
    }

    return resolveSpriteBodyAnchor(getBodyAnchors(this.playerProfile, 'combat')[anchorId], transform)
  }

  /**
   * Debug mode (plan §5.4) — dev-only, bật qua
   * localStorage['debug.playerBodyAnchors']='1'; vẽ chấm màu tại từng
   * body anchor mỗi frame. Không có UI production nào đụng tới.
   */
  private drawDebugBodyAnchors() {
    if (!this.debugBodyAnchorsEnabled) {
      return
    }

    if (!this.debugAnchorGraphics) {
      this.debugAnchorGraphics = this.add.graphics().setDepth(DEPTH_OVERLAY_UI + 7)
    }

    const graphics = this.debugAnchorGraphics

    graphics.clear()

    const colors: Record<PlayerBodyAnchorId, number> = {
      head: 0xffffff,
      chest: 0x00ffff,
      castHand: 0xff8800,
      offHand: 0x0088ff,
      feet: 0xff00ff,
    }

    for (const anchorId of Object.keys(colors) as PlayerBodyAnchorId[]) {
      const point = this.getPlayerBodyAnchorScreen(anchorId)

      if (!point) {
        continue
      }

      graphics.fillStyle(colors[anchorId], 0.9)

      graphics.fillCircle(point.x, point.y, 3)
    }
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

    // Thanh Vân art mount (yêu cầu 2026-08-26) — art đã có battle-ground
    // riêng ("No layer contains a battle grid") nên KHÔNG vẽ đường chia ô
    // đè lên; giữ grid động cho flat mode dev fallback.
    if (this.usingArtBackdrop) {
      return
    }

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

      // Cổng phòng thủ phủ MỌI hàng TẠI CỘNG cổng (plan §2.2).
      const gatePolygon = projection.footprintPolygon({
        rowStart: 0,
        rowEnd: GRID_ROW_COUNT - 1,
        colStart: HERO_COLUMN,
        colEnd: HERO_COLUMN,
      })

      graphics.fillStyle(PLAYER_COLOR, 0.05)
      graphics.fillPoints(toVector2Points(gatePolygon), true)
    }
  }

  // Rectangle (enemy) cần width/height + updateDisplayOrigin() (mutate
  // geometry trực tiếp); Sprite (player) cần setDisplaySize() với TỈ LỆ
  // ĐÚNG của artwork gốc (playerSourceSize theo profile hiện hành —
  // body-anchor plan §4.3),
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
      const width =
        this.characterHeight *
        sprite.sizeMultiplier *
        ((sprite.sourceSize ?? this.playerSourceSize).w / (sprite.sourceSize ?? this.playerSourceSize).h)
      const gameSprite = sprite.rect as Phaser.GameObjects.Sprite

      gameSprite.setDisplaySize(width, this.characterHeight * sprite.sizeMultiplier)

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
   * sizeMultiplier (player ×2, enemy PNG ×2 — multiplier NHÂN MỘT LẦN
   * duy nhất tại đây, không cộng dồn qua resize/tween) × boost (pop Chí
   * Mạng/spawn fade-in), ghi vào GEOMETRY/scale của GameObject nên tween
   * cũ vẫn hoạt động; bóng ellipse dưới chân co giãn theo.
   */
  private applyEntityDepthScale(sprite: EntitySprite, depthScale: number) {
    const effectiveScale = Math.max(0.05, depthScale * sprite.boost.value)
    const multiplier = sprite.sizeMultiplier

    if (sprite.kind === 'sprite') {
      const height = this.characterHeight * effectiveScale * multiplier
      const gameSprite = sprite.rect as Phaser.GameObjects.Sprite

      gameSprite.setDisplaySize(height * ((sprite.sourceSize ?? this.playerSourceSize).w / (sprite.sourceSize ?? this.playerSourceSize).h), height)
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
      const shadowWidth = this.characterWidth * effectiveScale * multiplier * SHADOW_WIDTH_RATIO

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

  private trackSourceScreenPosition(id: string, sprite: EntitySprite) {
    this.lastKnownScreenPositions.set(id, { x: sprite.rect.x, y: sprite.rect.y })

    // FIFO prune — cache phục vụ presentation, không rò rỉ vô hạn qua
    // các trận auto-refight dài.
    if (this.lastKnownScreenPositions.size > this.maxTrackedSourcePositions) {
      const oldest = this.lastKnownScreenPositions.keys().next().value

      if (oldest !== undefined && oldest !== id) {
        this.lastKnownScreenPositions.delete(oldest)
      }
    }
  }

  private trackSourceGridPosition(id: string, row: LaneIndex, column: number) {
    this.lastKnownGridPositions.set(id, { row, column })

    if (this.lastKnownGridPositions.size > this.maxTrackedSourcePositions) {
      const oldest = this.lastKnownGridPositions.keys().next().value

      if (oldest !== undefined && oldest !== id) {
        this.lastKnownGridPositions.delete(oldest)
      }
    }
  }

  private positionSprite(sprite: EntitySprite, worldColumn: number, _id = '') {
    const projection = this.projection

    if (!projection) {
      return
    }

    const point = projection.gridToScreen(sprite.row, worldColumn)

    sprite.columnFloat = worldColumn

    // offsetX (lunge/recoil/né) tính bằng px chuẩn hóa ở hàng gần — nhân
    // depth scale để đòn đánh ở xa cũng đúng tỷ lệ phối cảnh. Walk sway/
    // bob/tilt đã XÓA HẴN (2026-08-26): di chuyển bình thường luôn đặt
    // sprite tại tọa độ chiếu thẳng, rotation 0 (chỉ death tween xoay).
    const screenX = point.x + sprite.offsetX * point.scale
    const screenY = point.y

    if (this.isPerspective) {
      this.applyEntityDepthScale(sprite, point.scale)

      // Foot anchor: origin (0.5, 1) đặt tại điểm chân đất của ô.
      sprite.rect.setPosition(screenX, screenY)
      sprite.shadow?.setPosition(screenX, point.y)
      sprite.footY = point.y
      sprite.label.setPosition(screenX, point.y + 6)
    } else {
      // Flat giữ nguyên từng pixel hành vi legacy (center anchor); boost
      // Chí Mạng áp qua setScale vì geometry flat là tĩnh. setScale PHẢI
      // chạy vô điều kiện: tween yoyo kết thúc giữa 2 frame, frame kế
      // value===1 nhưng rect vẫn giữ scale frame trước nếu bỏ qua.
      sprite.rect.setPosition(screenX, screenY)
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

    // Player dùng artwork theo PROFILE hiện hành (body-anchor plan §4.3);
    // enemy chưa có atlas riêng, vẫn dùng Rectangle màu như cũ (xem
    // EntitySprite.kind's ghi chú).
    if (id === PLAYER_ID) {
      const textureKey = this.textures.exists(this.playerProfile.combatTextureKey)
        ? this.playerProfile.combatTextureKey
        : PLAYER_TEXTURE_KEY

      const gameSprite = this.add.sprite(0, 0, textureKey)

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
        sizeMultiplier: PLAYER_DISPLAY_SCALE_MULTIPLIER,
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

    // Enemy: Sprite art batch Mortal khi có texture khớp id (mortal-
    // enemy-art-batch-plan.md), fallback Rectangle màu cho id ngoài
    // batch (test fixture / realm khác chưa có art).
    const enemyTextureKey = resolveEnemyTextureKey(id)

    if (enemyTextureKey && this.textures.exists(enemyTextureKey)) {
      const gameSprite = this.add.sprite(0, 0, enemyTextureKey)

      this.physics.add.existing(gameSprite)

      if (this.isPerspective) {
        gameSprite.setOrigin(0.5, 1)
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
        kind: 'sprite',
        rect: gameSprite,
        label,
        color,
        offsetX: 0,
        row,
        sourceSize: { ...ENEMY_SOURCE_SIZE },
        // Enemy art x2 — PNG quái hiển thị gấp đôi (kể cả Boss); bóng
        // ellipse dưới chân nhân theo cùng multiplier trong
        // applyEntityDepthScale().
        sizeMultiplier: ENEMY_DISPLAY_SCALE_MULTIPLIER,
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
      this.applySpriteSize(sprite)
      this.updateEnemyHealthBar(sprite, healthBar.currentHp, healthBar.maxHp)

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
      sizeMultiplier: 1,
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

    this.playerSpawnHandle?.destroy()
    this.playerSpawnHandle = undefined
    this.playerMaterialized = true

    this.sprites.clear()
    this.interpolations.clear()
    this.castBars.clear()
    this.dyingIds.clear()
    this.playerDying = false

    // DoT accumulator (§7.2) — dọn khi scene shutdown.
    this.dotAccumulators?.clear()

    // Reward gourd + caches (plan §7.4) — dọn sạch khi scene shutdown;
    // auto-refight (onBattleStart) cố ý KHÔNG đụng vào đây để streams
    // đã sinh hoàn tất vào miệng hồ lô.
    this.gourdGraphics?.destroy()

    this.gourdGraphics = undefined

    this.gourdPulseTween?.remove()
    this.gourdPulseTween = undefined

    this.debugAnchorGraphics?.destroy()

    this.debugAnchorGraphics = undefined

    this.lastKnownScreenPositions.clear()
    this.lastKnownGridPositions.clear()

    // Scene shutdown đã destroy children của display list — chỉ cần bỏ
    // tham chiếu để create() kế dựng lại sạch theo mode hiện hành.
    this.arenaRect = undefined
    this.gridGraphics = undefined
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
      ['player_visual_profile_changed', (event) => this.playerVisualProfileHandler(event)],
    ]

    for (const [eventName, handler] of this.boundHandlers) {
      eventBus.on<CombatScenePayload>(eventName, handler)
    }

    eventBus.on<BattlePositionsEvent>('positions', this.positionsHandler)
    eventBus.on<PlayerTeleportedEvent>('player_teleported', this.playerTeleportedHandler)
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
    this.eventBus.off<PlayerTeleportedEvent>('player_teleported', this.playerTeleportedHandler)
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

  /**
   * Reward stream (plan §7) — Bézier hút về MIỆNG HỒ LÔ:
   * - Điểm phát: chest anchor của sprite nguồn → screen cache → ô grid
   *   cuối cùng (sprite đã bị dọn vẫn có nguồn hợp lý).
   * - Điểm hút LIVE từ gourd mouth mỗi onUpdate: Player teleport giữa
   *   tween KHÔNG ảnh hưởng quỹ đạo; resize re-resolve đích mới.
   * - Tăng tốc nửa sau (quad-in), co scale + xoáy nhỏ khi tới miệng.
   * - Pulse hồ lô ĐÚNG MỘT nhịp mỗi reward event (mốc đại diện), không
   *   pulse theo từng mote (§6.3).
   */
  private onRewardParticle(event: BattleRewardParticleEvent) {
    const start = this.resolveRewardSourcePoint(event.sourceId)

    if (!start) {
      return
    }

    const startX = start.x
    const startY = start.y
    const kind = event.kind
    const particleCount = kind === 'insight' ? 26 : kind === 'item' ? 22 : 18
    const controlFor = resolveRewardControlPoint(start, kind)
    const baseDuration = kind === 'insight' ? 950 : 850
    const seedBase = Math.random()
    const peakAlpha =
      kind === 'insight' ? Phaser.Math.FloatBetween(0.55, 0.78) : Phaser.Math.FloatBetween(0.75, 1)

    for (let index = 0; index < particleCount; index++) {
      // Mote nhỏ tương đồng nối đuôi nhau thành dải linh khí; khởi tạo
      // trong suốt để stagger không chồng thành cục tại nguồn.
      const mote = this.add
        .ellipse(
          startX,
          startY,
          Phaser.Math.FloatBetween(8, 13),
          Phaser.Math.FloatBetween(2.5, 4),
          event.color,
          1,
        )
        .setBlendMode(Phaser.BlendModes.ADD)
        // Dưới lớp gourd (DEPTH_OVERLAY_UI - 4) để hạt "chui vào" miệng.
        .setDepth(DEPTH_OVERLAY_UI - 6)
        .setAlpha(0)

      const state = { progress: 0 }
      const swirlSeed = seedBase + index * 0.37

      this.tweens.add({
        targets: state,
        progress: 1,
        delay: index * 18,
        duration: baseDuration + Phaser.Math.Between(-40, 60),
        ease: 'Linear',
        onUpdate: () => {
          // Đích + control giải LIVE — teleport/resize-safe (§7.2).
          const end = this.gourMouthPoint()
          const control = controlFor(end)
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

          // Fade chỉ ở đoạn cuối khi chui vào miệng, giữ thân stream sáng.
          mote.setAlpha(peakAlpha * (p > 0.85 ? (1 - p) / 0.15 : 1))

          mote.setScale(rewardMoteScale(p))
        },
        onComplete: () => {
          this.tweens.add({
            targets: mote,
            alpha: 0,
            scale: 0.1,
            duration: 80,
            onComplete: () => mote.destroy(),
          })
        },
      })
    }

    // Pulse đại diện cho CẢ stream — một nhịp/event, không theo mote.
    const totalFlightMs = baseDuration + (particleCount - 1) * 18 + 40

    this.time.delayedCall(totalFlightMs, () => this.pulseGourd())
  }

  /**
   * Điểm phát reward (plan §7.1) — ưu tiên:
   * 1. body anchor của sprite nguồn còn tồn tại (Player dùng catalog
   *    anchor 'chest' của profile; enemy KHÔNG có catalog anchor nên
   *    dùng điểm thân trung tính suy ra từ sprite bounds — audit P0-3,
   *    không bao giờ áp Player anchor cho enemy);
   * 2. last-known screen position theo entity ID;
   * 3. ô grid cuối cùng chiếu qua projection hiện hành.
   */
  private resolveRewardSourcePoint(sourceId: string): { x: number; y: number } | undefined {
    const source = this.spriteFor(sourceId)

    if (source) {
      const snapshot = {
        x: source.rect.x,

        y: source.rect.y,

        displayWidth: source.rect.displayWidth,

        displayHeight: source.rect.displayHeight,

        originX: 0.5,

        originY: this.isPerspective ? 1 : 0.5,

        flipX: false,

        rotation: source.rect.rotation,
      }

      if (sourceId === PLAYER_ID) {
        return resolveSpriteBodyAnchor(
          getBodyAnchors(this.playerProfile, 'combat').chest,
          snapshot,
        )
      }

      // Enemy/rect fallback — điểm thân trung tính (~40% chiều cao từ
      // chân) suy thuần từ bounds sprite, ĐỘC LẬP với Player profile.
      return resolveSpriteBodyAnchor(ENEMY_NEUTRAL_BODY_ANCHOR, snapshot)
    }

    const cachedScreen = this.lastKnownScreenPositions.get(sourceId)

    if (cachedScreen) {
      return { x: cachedScreen.x, y: cachedScreen.y }
    }

    const cachedGrid = this.lastKnownGridPositions.get(sourceId)

    if (cachedGrid && this.projection) {
      const point = this.projection.gridToScreen(cachedGrid.row, cachedGrid.column)

      return { x: point.x, y: point.y }
    }

    return undefined
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

    // Player spawn reconcile (plan §12.2): playerMaterialized false =
    // ẩn sprite; playerSpawn hiện = vẽ telegraph tại projected cell;
    // telegraph biến mất = materialize → hiện sprite với fade-in.
    this.reconcilePlayerSpawn(event)

    this.reconcileEnemySprites(event.enemies)

    // Grid fallback cache (plan §7.1 mức 3) — ô cuối cùng theo snapshot
    // positions, dùng khi cả sprite lẫn screen cache đã mất.
    for (const enemy of event.enemies) {
      this.trackSourceGridPosition(enemy.id, enemy.row, enemy.x)
    }

    const playerSprite = this.sprites.get(PLAYER_ID)

    if (playerSprite && playerSprite.row !== event.playerRow) {
      // Teleport qua snapshot (fallback khi lỡ miss event riêng):
      // snap tức thời, KHÔNG tween qua hàng trung gian.
      playerSprite.row = event.playerRow
      this.snapInterpolationTarget(PLAYER_ID, event.playerX)
      this.positionSprite(playerSprite, event.playerX)
    }

    this.setInterpolationTarget(PLAYER_ID, event.playerX, this.pendingCadence, this.lastSnapshotAt)

    for (const enemy of event.enemies) {
      this.setInterpolationTarget(enemy.id, enemy.x, this.pendingCadence, this.lastSnapshotAt)
    }
  }

  /**
   * Reconcile telegraph spawn của PLAYER theo SNAPSHOT (plan §12.2).
   * Flat mode vẫn chạy visibility (ẩn/hiện sprite) nhưng bỏ VFX telegraph
   * như enemy spawn.
   */
  private reconcilePlayerSpawn(event: BattlePositionsEvent) {
    const sprite = this.sprites.get(PLAYER_ID)

    if (!event.playerMaterialized) {
      this.playerMaterialized = false

      if (sprite) {
        sprite.rect.setVisible(false)
      }

      // Telegraph tại projected cell (4,1) — chỉ perspective vẽ VFX.
      if (this.isPerspective && event.playerSpawn && this.projection) {
        if (!this.playerSpawnHandle) {
          this.playerSpawnHandle = spawnEnemySpawnVfx({
            scene: this,
            projection: this.projection,
            row: event.playerSpawn.row,
            column: event.playerSpawn.column,
            presetId: event.playerSpawn.presetId,
            uprightDepth: this.resolveUprightVfxDepth({
              row: event.playerSpawn.row,
              column: event.playerSpawn.column,
            }),
          })
        } else {
          this.playerSpawnHandle.update(event.playerSpawn.progress)
        }
      } else if (this.playerSpawnHandle) {
        this.playerSpawnHandle.update(event.playerSpawn?.progress ?? 0)
      }

      return
    }

    // Materialize: kết thúc telegraph rồi hiện sprite (loại trừ nhau).
    this.playerSpawnHandle?.complete()
    this.playerSpawnHandle = undefined

    if (!this.playerMaterialized && sprite) {
      sprite.rect.setVisible(true)
      this.playMaterializeFadeIn(sprite)
    }

    this.playerMaterialized = true
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

  // Trận kết thúc (thắng/thua) — KHÔNG dọn quái, KHÔNG snap player về
  // cột cổng: giữ vị trí cuối của player/enemy dưới overlay kết quả
  // (2026-08-26). KHÔNG tự rời scene ở đây — chỉ 'combat_scene_exit'
  // (CombatResultModal.vue → onExit()) mới chuyển về MainScene; "Đánh
  // Lại"/auto-refight đi qua 'battle_start' → onBattleStart() reset
  // presentation tại chỗ. Việc còn lại ở đây: chọn + load trước variant
  // nền cho trận KẾ TIẾP và dọn DoT accumulator.
  private onBattleEnd() {
    this.inBattle = false

    // DoT accumulator (§7.2) — trận đã xong, bucket cũ không được rò
    // sang text của trận kế tiếp.
    this.dotAccumulators.clear()

    this.prepareThanhVanBackdropForNextBattle()
  }

  /**
   * Teleport AI (plan §12.3) — nhận player_teleported: HỦY interpolation,
   * snap NGAY tới projected position mới (không tween qua hàng trung gian),
   * cập nhật depth/scale/label/cast bar/status icon ngay, rồi gọi hook
   * placeholder VFX.
   */
  private onPlayerTeleported(event: PlayerTeleportedEvent) {
    const sprite = this.sprites.get(PLAYER_ID)

    if (!sprite || event.sourceId !== PLAYER_ID) {
      return
    }

    sprite.row = event.to.row

    this.tweens.killTweensOf(sprite)
    sprite.offsetX = 0
    this.snapInterpolationTarget(PLAYER_ID, event.to.column)
    this.positionSprite(sprite, event.to.column, PLAYER_ID)

    const castBar = this.castBars.get(PLAYER_ID)

    if (castBar) {
      this.positionCastBar(sprite, castBar)
    }

    if (this.isPerspective) {
      this.updateEntityDepths()
    }

    this.updateStatusIconPositions()

    this.playTeleportVfx(event.from, event.to)
  }

  /**
   * Hook placeholder VFX teleport (plan §2.5 — đợt này KHÔNG tự thiết kế
   * VFX): flash alpha ngắn làm tín hiệu trực quan tối thiểu; thay bằng
   * hiệu ứng thật ở đợt sau qua cùng điểm neo from/to này.
   */
  private playTeleportVfx(_from: GridPosition, to: GridPosition) {
    const projection = this.projection
    const sprite = this.sprites.get(PLAYER_ID)

    if (!projection || !sprite || !this.isPerspective) {
      return
    }

    void to

    this.tweens.add({
      targets: sprite.rect,
      alpha: { from: 0.35, to: 1 },
      duration: 140,
      ease: 'Quad.easeOut',
    })
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
      const dx = isPlayer ? ATTACK_LUNGE_PX : -ATTACK_LUNGE_PX

      this.playHorizontalImpulse(attacker, dx, ATTACK_LUNGE_DURATION_MS)
    }
  }

  private playHorizontalImpulse(sprite: EntitySprite, distance: number, duration: number) {
    // Attack, recoil and dodge all own the same presentation channel. Resetting
    // before a new impulse prevents rapid events from accumulating a permanent
    // horizontal drift.
    this.tweens.killTweensOf(sprite)
    sprite.offsetX = 0

    this.tweens.add({
      targets: sprite,
      offsetX: distance,
      duration,
      yoyo: true,
      ease: 'Quad.easeOut',
      onComplete: () => {
        sprite.offsetX = 0
      },
    })
  }

  // Nảy số sát thương — dùng CHUNG event 'damage' mà CombatStatusBar.vue
  // đọc để vẽ thanh HP (xem ghi chú DAMAGE_*_COLOR đầu file), nên số
  // nảy lên LUÔN khớp với thanh máu vừa hụt, không lệch nhịp. Chạy cho
  // CẢ 2 chiều — target là quái (player gây sát thương) hay target là
  // player (quái gây sát thương) đều qua đúng 1 handler này.
  //
  // DoT presentation (combat-skill-flow-element-power-dot-plan.md §7) —
  // tick DoT (event có effectId) KHÔNG hiện text ngay: gom vào
  // accumulator theo khóa `targetId|effectId|sourceId`, mỗi 333.33ms
  // flush ĐÚNG 1 text/khóa ở anchor thấp hơn + depth thấp hơn direct hit.
  private onDamageNumber(event: CombatEvent) {
    const target = this.spriteFor(event.targetId)

    if (!target || event.value === undefined || event.value <= 0) {
      return
    }

    // Gameplay không đổi tick rate (§7.1) — chỉ giảm tần suất trình diễn.
    if (event.effectId) {
      this.accumulateDotText(event)

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

  /** Bộ gom DoT — khóa `targetId|effectId|sourceId`, cửa sổ 1/3 giây. */
  private dotAccumulators = new Map<string, { value: number; nextFlushAt: number }>()

  private accumulateDotText(event: CombatEvent) {
    const key = `${event.targetId}|${event.effectId ?? ''}|${event.sourceId ?? ''}`

    let bucket = this.dotAccumulators.get(key)

    if (!bucket) {
      bucket = { value: 0, nextFlushAt: this.time.now + DOT_TEXT_FLUSH_INTERVAL_MS }

      this.dotAccumulators.set(key, bucket)
    }

    bucket.value += event.value ?? 0
  }

  /** Flush các bucket đã đến hạn — MỖI KHÓA đúng 1 text (§7.2). */
  private flushDueDotTexts() {
    this.dotAccumulators ??= new Map()

    for (const [key, bucket] of [...this.dotAccumulators]) {
      if (this.time.now < bucket.nextFlushAt) {
        continue
      }

      this.dotAccumulators.delete(key)

      const targetId = key.split('|')[0]

      const target = targetId ? this.spriteFor(targetId) : undefined

      if (!target || bucket.value <= 0) {
        continue
      }

      const isDamageToPlayer = targetId === PLAYER_ID

      this.showDotDamageNumber(target, bucket.value, isDamageToPlayer ? DAMAGE_TAKEN_COLOR : DAMAGE_DEALT_COLOR)
    }
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

  /**
   * Format text DoT đã gom (§7.2, tách hàm thuần để test trực tiếp) —
   * tổng ≥1 làm tròn theo formatter hiện có; số nhỏ (|x|<1) hiện 1 chữ
   * số thập phân với SÀN 0.1 nên KHÔNG BAO GIỜ hiện "-0.0" (fix
   * 2026-08-26: trước đây 0<x<0.05 render thành "-0.0").
   */
  private showDotDamageNumber(sprite: EntitySprite, value: number, color: string) {
    const display = formatDotDamageText(value)

    const footY = this.isPerspective ? sprite.rect.y : sprite.rect.y + sprite.rect.displayHeight / 2

    const label = this.add
      .text(sprite.rect.x + Phaser.Math.Between(-6, 6), footY - 4, display, {
        fontSize: '12px',
        color,
      })
      .setOrigin(0.5, 1)
      .setDepth(DEPTH_OVERLAY_UI + 5)
      .setScale(0.6)

    this.tweens.add({
      targets: label,
      scale: 1,
      alpha: 0.9,
      duration: 90,
      ease: 'Quad.easeOut',
    })

    this.tweens.add({
      targets: label,
      y: label.y - 18,
      alpha: 0,
      delay: 140,
      duration: 380,
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

    const isPlayer = event.targetId === PLAYER_ID
    const recoilX = isPlayer ? -HIT_RECOIL_PX : HIT_RECOIL_PX

    this.playHorizontalImpulse(target, recoilX, HIT_RECOIL_DURATION_MS)
  }

  private onDodge(event: CombatScenePayload) {
    const dodger = this.spriteFor(event.targetId)

    if (!dodger) {
      return
    }

    const isPlayer = event.targetId === PLAYER_ID
    const dx = isPlayer ? -18 : 18

    this.playHorizontalImpulse(dodger, dx, 130)

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

    // DoT accumulator (§7.2) — xóa bucket của target chết.
    for (const key of [...this.dotAccumulators.keys()]) {
      if (key.split('|')[0] === id) {
        this.dotAccumulators.delete(key)
      }
    }

    this.destroyCastBar(id)

    this.tweens.killTweensOf(sprite.rect)
    this.tweens.killTweensOf(sprite)
    this.tweens.killTweensOf(sprite.boost)
    sprite.offsetX = 0

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

  // Trận mới bắt đầu TRONG LÚC scene này vẫn đang active (Auto-refight
  // sau victory/defeat, xem CombatVictoryPanel.vue — KHÔNG đi qua
  // MainScene) hoặc lần đầu vào Combat Scene (create() đã tự dựng
  // player, hàm này reset lại về đúng trạng thái ban đầu cho chắc,
  // no-op nếu đã sạch sẵn).
  private onBattleStart() {
    this.inBattle = true

    // Vòng đời background (2026-08-26): trận mới bắt đầu — HỦY mọi lần
    // load backdrop còn treo của battle_end trước (generation cũ) để
    // callback không swap giữa trận; nền hiện tại giữ nguyên tới
    // battle_end KẾ TIẾP.
    this.backdropGeneration++

    // DoT accumulator (§7.2) — trận mới, dọn bucket cũ.
    this.dotAccumulators.clear()

    const player = this.sprites.get(PLAYER_ID)

    if (player) {
      this.resetVisual(player)

      // Trận mới = Player lại đi qua telegraph spawn (plan §12.2): ẩn
      // sprite tới khi snapshot báo materialize, snap về cột cổng.
      player.rect.setVisible(false)

      this.playerMaterialized = false
      this.snapInterpolationTarget(PLAYER_ID, HERO_COLUMN)
      this.positionSprite(player, HERO_COLUMN)
    }

    this.playerDying = false

    // Scene restart / trận mới trong cùng scene — dọn Player spawn VFX cũ.
    this.playerSpawnHandle?.destroy()
    this.playerSpawnHandle = undefined

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
        this.positionSprite(sprite, entry.toX, PLAYER_ID)
      }
    }
  }

  // ================= Background lifecycle (battle_end) =================

  /**
   * Vòng đời background mới (2026-08-26) — gọi DUY NHẤT tại battle_end:
   * chọn ngẫu nhiên variant KẾ TIẾP khác variant hiện tại (selectNext
   * tránh trùng từng chiều), load thiếu asset NGAY LÚC overlay kết quả
   * đang hiện rồi swap nguyên khối — không flash, không đụng nền trong
   * lúc trận còn/đang đánh lại.
   *
   * - Load xong TRƯỚC trận kế: swap ngay (an toàn — battle đã hết).
   * - Trận mới bắt đầu TRƯỚC khi load xong: generation token cũ bị vô
   *   hiệu (onBattleStart++), KHÔNG swap giữa trận; nền hiện tại giữ
   *   nguyên tới battle_end kế tiếp.
   */
  private prepareThanhVanBackdropForNextBattle() {
    // Flat mode không có art backdrop để swap; scene stub/test thiếu
    // loader cũng bỏ qua an toàn.
    if (!this.isPerspective || !this.textures || !this.load) {
      return
    }

    const desired = selectNextThanhVanVariant(this.thanhVanVariant)

    const sameVariant =
      desired.season === this.thanhVanVariant.season &&
      desired.time === this.thanhVanVariant.time

    if (sameVariant && this.backdrop) {
      return
    }

    const missing = thanhVanLoadList(desired).filter((entry) => !this.textures.exists(entry.key))

    if (missing.length === 0) {
      this.swapThanhVanBackdrop(desired)

      return
    }

    for (const entry of missing) {
      this.load.image(entry.key, entry.url)
    }

    const generation = ++this.backdropGeneration

    // Guard scene chết giữa lúc tải: handler kiểm tra scene còn active.
    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      if (!this.scene || !this.sys.isActive()) {
        return
      }

      // Chỉ lần yêu cầu MỚI NHẤT được swap, và chỉ khi chưa có trận mới
      // (onBattleStart đã tăng token).
      if (generation === this.backdropGeneration && !this.inBattle) {
        this.swapThanhVanBackdrop(desired)
      }
    })

    this.load.start()
  }

  /** Huỷ backdrop Thanh Vân hiện hành và dựng lại từ texture đã load. */
  private swapThanhVanBackdrop(variant: ThanhVanVariant) {
    this.thanhVanVariant = variant

    commitThanhVanVariant(variant)

    this.backdrop?.destroy()

    this.backdrop = attachThanhVanBackdrop(this, variant, this.canvasWidth, this.canvasHeight)

    this.usingArtBackdrop = true

    // Grid lines đã tắt khi dùng art backdrop — gọi lại cho chắc (không
    // vẽ gì khi usingArtBackdrop=true).
    this.redrawGridLines()
  }
}