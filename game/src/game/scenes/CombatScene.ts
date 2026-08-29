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
import { CombatDamageText } from './combat/combat-damage-text'
import { CombatCastBar } from './combat/combat-cast-bar'
import { CombatGridView } from './combat/combat-grid-view'
import { CombatVfxSpawner } from './combat/combat-vfx-spawner'
import { CombatRewardGourd } from './combat/combat-reward-gourd'

const PLAYER_COLOR = 0x4a90d9
const ENEMY_COLOR = 0xd94a4a

// Top-down 5-lane (2026-08-22) Ã¢â€ â€™ 2.5D migration (2026-08-24): 'flat' giÃ¡Â»Â¯
// nguyÃƒÂªn palette legacy sau feature flag (BattlefieldRenderMode.ts);
// 'perspective' chuyÃ¡Â»Æ’n sang BattlefieldBackdrop + lÃ†Â°Ã¡Â»â€ºi phÃ¡Â»â€˜i cÃ¡ÂºÂ£nh rÃ¡ÂºÂ¥t nhÃ¡ÂºÂ¡t
// Ã„â€˜Ã¡Â»Æ’ texture Ã„â€˜Ã¡ÂºÂ¥t lÃƒÂ m chÃƒÂ­nh, trÃƒÂ¡nh lÃ¡Â»â„¢ cÃ¡ÂºÂ£m giÃƒÂ¡c bÃƒÂ n cÃ¡Â»Â 10 lane.
const ARENA_COLOR = 0x14161c
const LANE_DIVIDER_COLOR = 0x2a2d38
const PERSPECTIVE_GRID_COLOR = 0x8a94ad
const PERSPECTIVE_GRID_ALPHA = 0.14
const PERSPECTIVE_BORDER_COLOR = 0xaeb9d4
const PERSPECTIVE_BORDER_ALPHA = 0.3

// BÃƒÂ³ng ellipse dÃ†Â°Ã¡Â»â€ºi chÃƒÂ¢n Ã¢â‚¬â€ dÃ¡ÂºÂ¹t theo trÃ¡Â»Â¥c sÃƒÂ¢u, Ã„â€˜Ã¡ÂºÂ­m vÃ¡Â»Â«a Ã„â€˜Ã¡Â»Æ’ tÃƒÂ¡ch unit khÃ¡Â»Âi
// mÃ¡ÂºÂ·t Ã„â€˜Ã¡ÂºÂ¥t; luÃƒÂ´n nÃ¡ÂºÂ±m Ã¡Â»Å¸ lÃ¡Â»â€ºp ENTITY_SHADOW dÃ†Â°Ã¡Â»â€ºi MÃ¡Â»Å’I sprite.
const SHADOW_COLOR = 0x000000
const SHADOW_ALPHA = 0.32
const SHADOW_WIDTH_RATIO = 1.12
const SHADOW_HEIGHT_RATIO = 0.34

// Combat uses the static mortal artwork. MainScene keeps its existing atlas;
// the scenes intentionally use separate texture keys and presentations.
// Key/URL sÃ¡Â»â€˜ng Ã¡Â»Å¸ support/CombatPreload.ts (dÃƒÂ¹ng chung 2 scene Ã¢â‚¬â€ fix spawn
// animation lÃ¡ÂºÂ§n Ã„â€˜Ã¡ÂºÂ§u, xem file Ã„â€˜ÃƒÂ³).
const PLAYER_SOURCE_SIZE = { w: 1244, h: 1264 }

const ATTACK_LUNGE_PX = 8
const HIT_RECOIL_PX = 6
const ATTACK_LUNGE_DURATION_MS = 75
const HIT_RECOIL_DURATION_MS = 65

/** DoT text flush 3 lÃ¡ÂºÂ§n/giÃƒÂ¢y (plan Ã‚Â§7.2) Ã¢â‚¬â€ cÃ¡Â»Â­a sÃ¡Â»â€¢ gom 333,33ms. */
const DOT_TEXT_FLUSH_INTERVAL_MS = 1000 / 3

/**
 * Format sÃ¡Â»â€˜ DoT hiÃ¡Â»Æ’n thÃ¡Â»â€¹ (hÃƒÂ m thuÃ¡ÂºÂ§n, test trÃ¡Â»Â±c tiÃ¡ÂºÂ¿p) Ã¢â‚¬â€ tÃ¡Â»â€¢ng Ã¢â€°Â¥1 lÃƒÂ m trÃƒÂ²n
 * qua formatter chung; 0<x<1 hiÃ¡Â»â€¡n 1 chÃ¡Â»Â¯ sÃ¡Â»â€˜ thÃ¡ÂºÂ­p phÃƒÂ¢n vÃ¡Â»â€ºi sÃƒÂ n 0.1 nÃƒÂªn
 * KHÃƒâ€NG bao giÃ¡Â»Â render "-0.0" (fix 2026-08-26).
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

// Cast Time (2026-08-21) Ã¢â‚¬â€ cast bar hiÃ¡Â»â€¡n phÃƒÂ­a TRÃƒÅ N Ã„â€˜Ã¡ÂºÂ§u unit (Ã„â€˜Ã¡Â»â€˜i xÃ¡Â»Â©ng
// vÃ¡Â»â€ºi label tÃƒÂªn hiÃ¡Â»â€¡n phÃƒÂ­a dÃ†Â°Ã¡Â»â€ºi), mÃƒÂ u vÃƒÂ ng tÃƒÂ¡ch hÃ¡ÂºÂ³n khÃ¡Â»Âi mÃ¡Â»Âi mÃƒÂ u sÃ¡Â»â€˜ nÃ¡ÂºÂ£y
// (Ã„â€˜Ã¡Â»Â/trÃ¡ÂºÂ¯ng/vÃƒÂ ng chÃƒÂ³i cÃ¡Â»Â§a ChÃƒÂ­ MÃ¡ÂºÂ¡ng) Ã„â€˜Ã¡Â»Æ’ khÃƒÂ´ng lÃ¡ÂºÂ«n Ã¢â‚¬â€ dÃƒÂ¹ng CÃƒâ„¢NG gold nhÃ¡ÂºÂ¡t
// hÃ†Â¡n CRITICAL_DAMAGE_COLOR.
const CAST_BAR_BG_COLOR = 0x1c1712
const CAST_BAR_FILL_COLOR = 0xf4c542
const CAST_BAR_HEIGHT = 5
const CAST_BAR_OFFSET_Y = 10
const CAST_NAME_COLOR = '#f4c542'

// NÃ¡ÂºÂ£y sÃ¡Â»â€˜ sÃƒÂ¡t thÃ†Â°Ã†Â¡ng (spec CombatUIredesign mÃ¡Â»Â¥c 10 Ã¢â‚¬â€ "Damage thÃƒÂ´ng
// thÃ†Â°Ã¡Â»Âng vÃ¡ÂºÂ«n hiÃ¡Â»Æ’n thÃ¡Â»â€¹ trÃ¡Â»Â±c tiÃ¡ÂºÂ¿p trÃƒÂªn enemy") Ã¢â‚¬â€ cÃƒÂ¹ng nguÃ¡Â»â€œn dÃ¡Â»Â¯ liÃ¡Â»â€¡u
// event 'damage' mÃƒÂ  CombatStatusBar.vue (thanh trÃ¡ÂºÂ¡ng thÃƒÂ¡i) Ã„â€˜ang dÃƒÂ¹ng
// Ã„â€˜Ã¡Â»Æ’ cÃ¡ÂºÂ­p nhÃ¡ÂºÂ­t HP bar, chÃ¡Â»â€° khÃƒÂ¡c nÃ†Â¡i tiÃƒÂªu thÃ¡Â»Â¥ (Phaser vÃ¡ÂºÂ½ sÃ¡Â»â€˜ nÃ¡ÂºÂ£y lÃƒÂªn thay
// vÃƒÂ¬ Vue vÃ¡ÂºÂ½ thanh mÃƒÂ¡u) Ã¢â‚¬â€ 1 event, 2 cÃƒÂ¡ch thÃ¡Â»Æ’ hiÃ¡Â»â€¡n trÃ¡Â»Â±c quan song song.
// Ã„ÂÃ¡Â»Â cho sÃƒÂ¡t thÃ†Â°Ã†Â¡ng NHÃ¡ÂºÂ¬N vÃƒÂ o (target lÃƒÂ  player), trÃ¡ÂºÂ¯ng cho sÃƒÂ¡t thÃ†Â°Ã†Â¡ng
// GÃƒâ€šY RA (target lÃƒÂ  quÃƒÂ¡i), vÃƒÂ ng riÃƒÂªng cho Ã„â€˜ÃƒÂ²n ChÃƒÂ­ MÃ¡ÂºÂ¡ng bÃ¡ÂºÂ¥t kÃ¡Â»Æ’ chiÃ¡Â»Âu.
const DAMAGE_DEALT_COLOR = '#f4f4f0'
const DAMAGE_TAKEN_COLOR = '#ff6b6b'
const ENEMY_HP_BG_COLOR = 0x241b1b
const ENEMY_HP_FILL_COLOR = 0xc94b4b
const BOSS_HP_FILL_COLOR = 0xd4a72c
const ENEMY_HP_BAR_HEIGHT = 6

// TÃ¡Â»â€° lÃ¡Â»â€¡ theo CHIÃ¡Â»â‚¬U CAO 1 HÃƒâ‚¬NG lane (khÃƒÂ´ng phÃ¡ÂºÂ£i cÃ¡ÂºÂ£ battlefield nhÃ†Â° side-
// view cÃ…Â©) Ã¢â‚¬â€ 5 lane top-down (2026-08-22), nhÃƒÂ¢n vÃ¡ÂºÂ­t phÃ¡ÂºÂ£i nhÃ¡Â»Â hÃ†Â¡n hÃ¡ÂºÂ³n
// hÃƒÂ ng cÃ¡Â»Â§a nÃƒÂ³ Ã„â€˜Ã¡Â»Æ’ cÃƒÂ²n chÃ¡Â»Â«a lÃ¡Â»Â trÃƒÂªn/dÃ†Â°Ã¡Â»â€ºi, khÃƒÂ´ng Ã„â€˜ÃƒÂ¨ hÃƒÂ ng kÃ¡ÂºÂ¿ bÃƒÂªn.
const CHARACTER_WIDTH_RATIO = 0.45 // tÃ¡Â»â€° lÃ¡Â»â€¡ so vÃ¡Â»â€ºi chiÃ¡Â»Âu cao nhÃƒÂ¢n vÃ¡ÂºÂ­t

// Combat AI rework (plan Ã‚Â§12.1) Ã¢â‚¬â€ avatar Player LÃ¡Â»Å¡N GÃ¡ÂºÂ¤P Ã„ÂÃƒâ€I enemy: chÃ¡Â»â€°
// nhÃƒÂ¢n lÃƒÂªn PLAYER sprite, khÃƒÂ´ng Ã„â€˜Ã¡Â»Â¥ng enemy/VFX footprint. KÃƒÂ­ch thÃ†Â°Ã¡Â»â€ºc cuÃ¡Â»â€˜i
// = source aspect ratio Ãƒâ€” base character size Ãƒâ€” multiplier Ãƒâ€” depth scale.
const PLAYER_DISPLAY_SCALE_MULTIPLIER = 2

// Enemy art x2 (yÃƒÂªu cÃ¡ÂºÂ§u 2026-08-26) Ã¢â‚¬â€ PNG quÃƒÂ¡i hiÃ¡Â»Æ’n thÃ¡Â»â€¹ GÃ¡ÂºÂ¤P Ã„ÂÃƒâ€I: nhÃƒÂ¢n
// Ã„â€˜ÃƒÂºng MÃ¡Â»ËœT LÃ¡ÂºÂ¦N tÃ¡ÂºÂ¡i sizeMultiplier, KHÃƒâ€NG cÃ¡Â»â„¢ng dÃ¡Â»â€œn vÃƒÂ o depth scale hay
// spawn tween (boost). ÃƒÂp cho enemy DÃƒâ„¢NG PNG (kind='sprite', kÃ¡Â»Æ’ cÃ¡ÂºÂ£ Boss
// Ã¢â‚¬â€ cÃƒÂ¹ng quy tÃ¡ÂºÂ¯c); fallback Rectangle giÃ¡Â»Â¯ kÃƒÂ­ch thÃ†Â°Ã¡Â»â€ºc cÃ…Â© vÃƒÂ¬ khÃƒÂ´ng phÃ¡ÂºÂ£i
// "hÃƒÂ¬nh Ã¡ÂºÂ£nh enemy".
const ENEMY_DISPLAY_SCALE_MULTIPLIER = 2

// Hero cÃ¡Â»â€˜ Ã„â€˜Ã¡Â»â€¹nh sÃƒÂ¡t mÃƒÂ©p trÃƒÂ¡i battlefield (top-down 5-lane, 2026-08-22 Ã¢â‚¬â€
// thay layout side-view cÃ…Â© cÃƒÂ³ layout side-view cÃ…Â©) Ã¢â‚¬â€ chÃ¡Â»Â«a 1
// lÃ¡Â»Â nhÃ¡Â»Â Ã„â€˜Ã¡Â»Æ’ sprite khÃƒÂ´ng bÃ¡Â»â€¹ cÃ¡ÂºÂ¯t viÃ¡Â»Ân trÃƒÂ¡i.

// SÃƒÂ n thÃ¡Â»Âi lÃ†Â°Ã¡Â»Â£ng 1 Ã„â€˜oÃ¡ÂºÂ¡n nÃ¡Â»â„¢i suy Ã¢â‚¬â€ trÃƒÂ¡nh chia gÃ¡ÂºÂ§n 0 nÃ¡ÂºÂ¿u 2 lÃ¡ÂºÂ§n cÃ¡ÂºÂ­p nhÃ¡ÂºÂ­t
// vÃ¡Â»â€¹ trÃƒÂ­ liÃƒÂªn tiÃ¡ÂºÂ¿p tÃ¡Â»â€ºi quÃƒÂ¡ sÃƒÂ¡t nhau.
const MIN_SEGMENT_DURATION_MS = 16
const MAX_SEGMENT_DURATION_MS = 200

const PLAYER_ID = 'player'

// Audit P0-3 Ã¢â‚¬â€ anchor THÃƒâ€šN TRUNG TÃƒÂNH cho enemy reward particle,
// chuÃ¡ÂºÂ©n hoÃƒÂ¡ theo bounds cÃ¡Â»Â§a chÃƒÂ­nh sprite enemy (0.5, ~0.4 tÃ¡Â»Â« chÃƒÂ¢n).
// Enemy khÃƒÂ´ng cÃƒÂ³ catalog anchor nhÃ†Â° Player (PlayerVisualProfiles) nÃƒÂªn
// KHÃƒâ€NG Ã„ÂÃ†Â¯Ã¡Â»Â¢C mÃ†Â°Ã¡Â»Â£n anchor Player Ã¢â‚¬â€ vÃ¡Â»â€¹ trÃƒÂ­ particle khÃƒÂ´ng Ã„â€˜Ã†Â°Ã¡Â»Â£c Ã„â€˜Ã¡Â»â€¢i khi
// Player Ã„â€˜Ã¡Â»â€¢i visual profile.

// Internal (module boundary â€” combat/* Ä‘á»c qua scene ref).
export interface CombatScenePayload {
  sourceId?: string
  targetId?: string
  skillId?: string
  // Cast Time (2026-08-21) Ã¢â‚¬â€ 'cast_start' Ã„â€˜i kÃƒÂ¨m 2 field nÃƒÂ y (xem
  // BattleSystem.beginCast()): skillName Ã„â€˜Ã¡Â»Æ’ nÃ¡ÂºÂ£y chÃ¡Â»Â¯ TÃƒÅ N SKILL lÃƒÂªn Ã„â€˜Ã¡ÂºÂ§u
  // unit (khÃƒÂ¡c 'cast' cÃ…Â© Ã¢â‚¬â€ chÃ¡Â»â€° flash mÃƒÂ u, khÃƒÂ´ng hiÃ¡Â»â€¡n tÃƒÂªn), castTimeSeconds
  // Ã„â€˜Ã¡Â»Æ’ biÃ¡ÂºÂ¿t cast bar chÃ¡ÂºÂ¡y trong bao lÃƒÂ¢u (tween duration).
  skillName?: string
  castTimeSeconds?: number
  // Player visual profile bridge (body-anchor plan Ã‚Â§4.2) Ã¢â‚¬â€ event
  // 'player_visual_profile_changed' gÃ¡Â»Â­i kÃƒÂ¨m ID hÃƒÂ¬nh thÃƒÂ¡i mÃ¡Â»â€ºi.
  profileId?: string
}

interface ResizeSize {
  width: number
  height: number
}

interface EntitySprite {
  // Player = Sprite profile art, enemy = Sprite Mortal art batch HOÃ¡ÂºÂ¶C
  // Rectangle mÃƒÂ u (id ngoÃƒÂ i batch). `kind` phÃƒÂ¢n biÃ¡Â»â€¡t Ã„â€˜Ã¡Â»Æ’ biÃ¡ÂºÂ¿t dÃƒÂ¹ng
  // setFillStyle() hay setTint()/clearTint() (flashColor()/resetVisual())
  // Ã¢â‚¬â€ mÃ¡Â»Âi thao tÃƒÂ¡c position/scale/rotation/alpha khÃƒÂ¡c Ã„â€˜Ã¡Â»Âu dÃƒÂ¹ng chung API.
  kind: 'rect' | 'sprite'
  rect: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Sprite
  label: Phaser.GameObjects.Text
  color: number
  offsetX: number
  row: LaneIndex
  healthBar?: EnemyHealthBar

  /**
   * KÃƒÂ­ch thÃ†Â°Ã¡Â»â€ºc nguÃ¡Â»â€œn cÃ¡Â»Â§a texture sprite nÃƒÂ y Ã¢â‚¬â€ player theo profile hiÃ¡Â»â€¡n
   * hÃƒÂ nh (this.playerSourceSize), enemy art batch 1254Ã‚Â². BÃ¡ÂºÂ¯t buÃ¡Â»â„¢c cho
   * mÃ¡Â»Âi kind='sprite' Ã„â€˜Ã¡Â»Æ’ setDisplaySize giÃ¡Â»Â¯ Ã„â€˜ÃƒÂºng tÃ¡Â»â€° lÃ¡Â»â€¡ khung hÃƒÂ¬nh.
   */
  sourceSize?: { w: number; h: number }

  // Combat AI rework (plan Ã‚Â§12.1) + enemy art x2 (2026-08-26) Ã¢â‚¬â€ player
  // sprite Ãƒâ€”2, enemy PNG Ãƒâ€”2 (fallback Rectangle Ãƒâ€”1).
  sizeMultiplier: number

  // 2.5D presentation (2026-08-24) Ã¢â‚¬â€ bÃƒÂ³ng ellipse trÃƒÂªn mÃ¡ÂºÂ·t Ã„â€˜Ã¡ÂºÂ¥t (chÃ¡Â»â€° tÃ¡ÂºÂ¡o
  // Ã¡Â»Å¸ perspective), foot point + column float lÃ¡ÂºÂ§n chiÃ¡ÂºÂ¿u gÃ¡ÂºÂ§n nhÃ¡ÂºÂ¥t phÃ¡Â»Â¥c vÃ¡Â»Â¥
  // depth sort, vÃƒÂ  boost object cho tween pop (ChÃƒÂ­ MÃ¡ÂºÂ¡ng) KHÃƒâ€NG Ã„â€˜Ã¡Â»Â¥ng vÃƒÂ o
  // scale/geometry mÃƒÂ  projection ghi mÃ¡Â»â€”i frame.
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

  // ThÃ¡Â»Âi Ã„â€˜iÃ¡Â»Æ’m snapshot tÃ¡ÂºÂ¡o segment (cadence Ã„â€˜o tÃ¡Â»Â« Ã„â€˜ÃƒÂ¢y).
  lastSnapshotAt: number
}

interface CastBarSprite {
  bg: Phaser.GameObjects.Rectangle
  fill: Phaser.GameObjects.Rectangle
  widthPx: number
}

/**
 * Combat UI Redesign Ã¢â‚¬â€ battlefield riÃƒÂªng, TÃƒÂCH KHÃ¡Â»Å½I MainScene.ts (Ã„ÂÃ¡Â»â„¢ng
 * PhÃ¡Â»Â§/Home) hoÃƒÂ n toÃƒÂ n. MainScene.ts gÃ¡Â»Âi `this.scene.start('CombatScene')`
 * khi nhÃ¡ÂºÂ­n 'battle_start' (xem MainScene.ts); scene nÃƒÂ y tÃ¡Â»Â± gÃ¡Â»Âi
 * `this.scene.start('MainScene')` lÃ¡ÂºÂ¡i khi nhÃ¡ÂºÂ­n 'combat_scene_exit' (Vue
 * emit khi ngÃ†Â°Ã¡Â»Âi chÃ†Â¡i bÃ¡ÂºÂ¥m "TiÃ¡ÂºÂ¿p TÃ¡Â»Â¥c"/"VÃ¡Â»Â Ã„ÂÃ¡Â»â„¢ng PhÃ¡Â»Â§" Ã¡Â»Å¸ CombatResultModal.vue
 * Ã¢â‚¬â€ xem stores/ui.ts's exitCombatScene()). Auto-refight KHÃƒâ€NG cÃ¡ÂºÂ§n
 * switch scene Ã¢â‚¬â€ chÃ¡Â»â€° 1 'battle_start' mÃ¡Â»â€ºi tÃ¡Â»â€ºi trong lÃƒÂºc scene nÃƒÂ y vÃ¡ÂºÂ«n
 * Ã„â€˜ang active, xÃ¡Â»Â­ lÃƒÂ½ y hÃ¡Â»â€¡t lÃƒÂºc mÃ¡Â»â€ºi vÃƒÂ o (xem onBattleStart()).
 *
 * CORE Ã¢â€ â€ PHASER CHÃ¡Â»Ë† GIAO TIÃ¡ÂºÂ¾P QUA EVENTBUS Ã¢â‚¬â€ kÃ¡ÂºÂ¿ thÃ¡Â»Â«a nguyÃƒÂªn tÃ¡ÂºÂ¯c tÃ¡Â»Â«
 * MainScene.ts, xem ghi chÃƒÂº Ã¡Â»Å¸ Ã„â€˜ÃƒÂ³ cho lÃƒÂ½ do kÃ¡Â»Â¹ thuÃ¡ÂºÂ­t (nÃ¡Â»â„¢i suy vÃ¡Â»â€¹ trÃƒÂ­,
 * animation rÃ¡Â»Âi rÃ¡ÂºÂ¡c...).
 */
export class CombatScene extends Phaser.Scene {
  // ui-discoverability-refactor-plan.md Ã‚Â§3.2 Ã¢â‚¬â€ module tÃƒÂ¡ch khÃ¡Â»Âi god-class,
  // khÃ¡Â»Å¸i tÃ¡ÂºÂ¡o LAZY (Object.create(CombatScene.prototype) trong test KHÃƒâ€NG
  // chÃ¡ÂºÂ¡y field initializer Ã¢â‚¬â€ getter an toÃƒÂ n cho cÃ¡ÂºÂ£ test lÃ¡ÂºÂ«n runtime).
  private _damageText?: CombatDamageText

  private get damageText(): CombatDamageText {
    this._damageText ??= new CombatDamageText(this)

    return this._damageText
  }

  private _castBar?: CombatCastBar

  private get castBar(): CombatCastBar {
    this._castBar ??= new CombatCastBar(this)

    return this._castBar
  }

  private _gridView?: CombatGridView

  private get gridView(): CombatGridView {
    this._gridView ??= new CombatGridView(this)

    return this._gridView
  }

  private _vfxSpawner?: CombatVfxSpawner

  private get vfxSpawner(): CombatVfxSpawner {
    this._vfxSpawner ??= new CombatVfxSpawner(this)

    return this._vfxSpawner
  }

  private _rewardGourd?: CombatRewardGourd

  private get rewardGourd(): CombatRewardGourd {
    this._rewardGourd ??= new CombatRewardGourd(this)

    return this._rewardGourd
  }
  // ChÃ¡Â»â€° tÃ¡Â»â€œn tÃ¡ÂºÂ¡i Ã¡Â»Å¸ chÃ¡ÂºÂ¿ Ã„â€˜Ã¡Â»â„¢ 'flat' (renderer legacy cÃ¡ÂºÂ§n nÃ¡Â»Ân phÃ¡ÂºÂ³ng Ã„â€˜Ã¡ÂºÂ·c);
  // 'perspective' thay bÃ¡ÂºÂ±ng BattlefieldBackdrop hÃ¡Â»â„¢i tÃ¡Â»Â¥ hÃ¡ÂºÂ­u cÃ¡ÂºÂ£nh.
  arenaRect?: Phaser.GameObjects.Rectangle

  // Projection layer Ã¢â‚¬â€ nguÃ¡Â»â€œn DUY NHÃ¡ÂºÂ¤T cho mÃ¡Â»Âi quy Ã„â€˜Ã¡Â»â€¢i gridÃ¢â€ â€screen kÃ¡Â»Æ’ cÃ¡ÂºÂ£
  // flat (2 mode cÃƒÂ¹ng interface BattleGridProjection nÃƒÂªn phÃ¡ÂºÂ§n cÃƒÂ²n lÃ¡ÂºÂ¡i cÃ¡Â»Â§a
  // scene khÃƒÂ´ng cÃ¡ÂºÂ§n biÃ¡ÂºÂ¿t mode Ã„â€˜ang chÃ¡ÂºÂ¡y).
  private renderMode: BattlefieldRenderMode = getBattlefieldRenderMode()
  projection?: BattleGridProjection
  private backdrop?: BattlefieldBackdropHandle

  /** Variant Thanh VÃƒÂ¢n Ã„â€˜ang dÃƒÂ¹ng (season/time, override qua localStorage). */
  // Variant Thanh VÃƒÂ¢n cÃ¡Â»Â§a PHIÃƒÅ N Ã¢â‚¬â€ peek (cache module) trÃ¡ÂºÂ£ preset cÃ¡Â»â€˜ Ã„â€˜Ã¡Â»â€¹nh
  // spring/morning lÃƒÂºc boot; battle_end chÃ¡Â»Ân + swap variant kÃ¡ÂºÂ¿ tiÃ¡ÂºÂ¿p.
  private thanhVanVariant: ThanhVanVariant = peekThanhVanVariant()

  /** true giÃ¡Â»Â¯a battle_start vÃƒÂ  battle_end Ã¢â‚¬â€ cÃ¡ÂºÂ¥m swap backdrop giÃ¡Â»Â¯a trÃ¡ÂºÂ­n. */
  private inBattle = false

  /**
   * Generation token cho background: battle_end cÃ¡ÂºÂ¥p token mÃ¡Â»â€ºi cho lÃ¡ÂºÂ§n
   * load hiÃ¡Â»â€¡n hÃƒÂ nh, battle_start tÃ„Æ’ng token Ã„â€˜Ã¡Â»Æ’ callback load cÃ…Â© khÃƒÂ´ng
   * bao giÃ¡Â»Â swap nhÃ¡ÂºÂ§m vÃƒÂ o giÃ¡Â»Â¯a trÃ¡ÂºÂ­n (yÃƒÂªu cÃ¡ÂºÂ§u 2026-08-26).
   */
  private backdropGeneration = 0

  /** true khi nÃ¡Â»Ân lÃƒÂ  art modular Ã¢â‚¬â€ grid lines/border khÃƒÂ´ng vÃ¡ÂºÂ½ Ã„â€˜ÃƒÂ¨ lÃƒÂªn art. */
  usingArtBackdrop = false
  gridGraphics?: Phaser.GameObjects.Graphics

  sprites = new Map<string, EntitySprite>()
  interpolations = new Map<string, PositionInterpolation>()
  castBars = new Map<string, CastBarSprite>()

  // Combat Grid Rework Ã¢â‚¬â€ DOT VFX theo (targetId + ailmentId), bÃƒÂ¡m target.
  statuses = new Map<
    string,
    { targetId: string; icon: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text }
  >()

  private dyingIds = new Set<string>()
  private playerDying = false

  // Spawn telegraph (2026-08-24) Ã¢â‚¬â€ VFX handle theo pending enemy id:
  // reconcile tÃ¡Â»Â« SNAPSHOT positions.spawningEnemies (id biÃ¡ÂºÂ¿n mÃ¡ÂºÂ¥t =
  // materialize Ã¢â€ â€™ flash + fade-in enemy sprite). Flat mode khÃƒÂ´ng chÃ¡ÂºÂ¡y
  // (renderer legacy giÃ¡Â»Â¯ nguyÃƒÂªn hÃƒÂ nh vi cÃ…Â©).
  spawnVfxHandles = new Map<string, { handle: EnemySpawnVfxHandle; progress: number }>()
  materializingIds = new Set<string>()

  // Player spawn telegraph (plan Ã‚Â§12.2) Ã¢â‚¬â€ handle DUY NHÃ¡ÂºÂ¤T cho telegraph
  // cÃ¡Â»Â§a avatar (preset 'player_spawn'); playerMaterialized false = KHÃƒâ€NG
  // hiÃ¡Â»â€¡n Player sprite. Pending telegraph vÃƒÂ  materialized sprite loÃ¡ÂºÂ¡i
  // trÃ¡Â»Â« nhau Ã„â€˜Ã¡Â»Æ’ khÃƒÂ´ng render hai lÃ¡ÂºÂ§n.
  playerSpawnHandle?: EnemySpawnVfxHandle
  playerMaterialized = true

  // ================= Player visual profile (body-anchor plan Ã‚Â§4) ======
  // Profile hiÃ¡Â»â€¡n hÃƒÂ nh Ã¢â‚¬â€ Ã„â€˜Ã¡Â»Âc tÃ¡Â»Â« Phaser registry lÃƒÂºc create() vÃƒÂ  cÃ¡ÂºÂ­p nhÃ¡ÂºÂ­t
  // qua event 'player_visual_profile_changed' (bridge Ã¡Â»Å¸ PhaserCanvas.vue).
  private playerProfileId: PlayerVisualProfileId = 'mortal'
  playerProfile: PlayerVisualProfile = PLAYER_VISUAL_PROFILES.mortal

  /** KÃƒÂ­ch thÃ†Â°Ã¡Â»â€ºc nguÃ¡Â»â€œn cÃ¡Â»Â§a texture combat Ã„â€˜ang gÃ¡ÂºÂ¯n trÃƒÂªn player sprite. */
  playerSourceSize = { ...PLAYER_VISUAL_PROFILES.mortal.combatSourceSize }

  /**
   * Static texture thay atlas idle Ã¢â‚¬â€ art profile lÃƒÂ  PNG tÃ„Â©nh, KHÃƒâ€NG play
   * animation; resetVisual() phÃ¡ÂºÂ£i bÃ¡Â»Â qua .play().
   */
  private playerUsesStaticTexture = true

  // Debug body anchors (plan Ã‚Â§5.4) Ã¢â‚¬â€ dev-only, bÃ¡ÂºÂ­t qua
  // localStorage['debug.playerBodyAnchors']='1'; khÃƒÂ´ng cÃƒÂ³ UI production.
  readonly debugBodyAnchorsEnabled =
    typeof window !== 'undefined' && window.localStorage?.getItem('debug.playerBodyAnchors') === '1'
  debugAnchorGraphics?: Phaser.GameObjects.Graphics

  // ================= Reward gourd + stream state (plan Ã‚Â§6/Ã‚Â§7) =========
  gourdPlacement = computeGourdPlacement({ canvasHeight: 0, bottomInset: 0 })

  /**
   * View hÃ¡Â»â€œ lÃƒÂ´: Image art thÃ¡ÂºÂ­t khi texture sÃ¡ÂºÂµn sÃƒÂ ng (plan Ã‚Â§8), fallback
   * Graphics placeholder nÃ¡ÂºÂ¿u thiÃ¡ÂºÂ¿u. CÃƒÂ¹ng API setPosition/scale/destroy
   * nÃƒÂªn pulse/placement dÃƒÂ¹ng chung.
   */
  gourdGraphics?: Phaser.GameObjects.Image | Phaser.GameObjects.Graphics

  /** Scale gÃ¡Â»â€˜c sau setDisplaySize Ã¢â‚¬â€ pulse nhÃƒÂ¢n lÃƒÂªn, khÃƒÂ´ng Ã„â€˜ÃƒÂ¨ tuyÃ¡Â»â€¡t Ã„â€˜Ã¡Â»â€˜i. */
  gourdBaseScale = { x: 1, y: 1 }

  gourdPulseTween?: Phaser.Tweens.Tween

  /** Bottom inset gÃ¡ÂºÂ§n nhÃ¡ÂºÂ¥t (Event+Control bar) Ã¢â‚¬â€ create() dÃ¡Â»Â±ng view muÃ¡Â»â„¢n cÃ¡ÂºÂ§n re-position. */
  gourdBottomInset = 0

  /**
   * VÃ¡Â»â€¹ trÃƒÂ­ screen GÃ¡ÂºÂ¦N NHÃ¡ÂºÂ¤T cÃ¡Â»Â§a mÃ¡Â»Âi sprite (update trong positionSprite)
   * Ã¢â‚¬â€ nguÃ¡Â»â€œn dÃ¡Â»Â± phÃƒÂ²ng cho reward particle khi sprite nguÃ¡Â»â€œn Ã„â€˜ÃƒÂ£ bÃ¡Â»â€¹ dÃ¡Â»Ân.
   */
  lastKnownScreenPositions = new Map<string, { x: number; y: number }>()

  /** Ãƒâ€ grid gÃ¡ÂºÂ§n nhÃ¡ÂºÂ¥t theo snapshot positions Ã¢â‚¬â€ fallback cuÃ¡Â»â€˜i cÃƒÂ¹ng. */
  lastKnownGridPositions = new Map<string, { row: LaneIndex; column: number }>()

  readonly maxTrackedSourcePositions = 64

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

  // Internal (module boundary Ã¢â‚¬â€ combat/* Ã„â€˜Ã¡Â»Âc qua scene ref).
  get isPerspective(): boolean {
    return this.renderMode === 'perspective'
  }

  // Combat Grid Rework Ã¢â‚¬â€ hÃƒÂ¬nh hÃ¡Â»Âc lÃ†Â°Ã¡Â»â€ºi vuÃƒÂ´ng (px), tÃƒÂ­nh lÃ¡ÂºÂ¡i mÃ¡Â»â€”i layout.
  // GIÃ¡Â»Â® LÃ¡ÂºÂ I lÃƒÂ m mirror chÃ¡ÂºÂ©n Ã„â€˜oÃƒÂ¡n/test: flat = giÃƒÂ¡ trÃ¡Â»â€¹ legacy chÃƒÂ­nh xÃƒÂ¡c;
  // perspective = bounding box + bÃ¡Â»Â rÃ¡Â»â„¢ng ÃƒÂ´ cÃ¡ÂºÂ¡nh gÃ¡ÂºÂ§n.
  private gridLeft = 0
  private gridTop = 0
  private cellSize = 0

  private pendingPositions?: BattlePositionsEvent
  private pendingCadence?: number
  private lastSnapshotAt?: number

  private canvasWidth = 0
  private canvasHeight = 0

  // Top-down 5-lane (2026-08-22) Ã¢â‚¬â€ tÃƒÂ¢m Y cÃ¡Â»Â§a mÃ¡Â»â€”i hÃƒÂ ng, length GRID_ROW_COUNT,
  // tÃƒÂ­nh lÃ¡ÂºÂ¡i mÃ¡Â»â€”i khi layout Ã„â€˜Ã¡Â»â€¢i (xem applyBattlefieldLayout()).
  laneRowCenterY: number[] = []

  characterWidth = 0
  characterHeight = 0

  constructor() {
    super('CombatScene')
  }

  preload() {
    // ToÃƒÂ n bÃ¡Â»â„¢ texture combat dÃƒÂ¹ng chung 1 helper vÃ¡Â»â€ºi MainScene (eager
    // preload lÃƒÂºc boot Ã¢â‚¬â€ fix "lÃ¡ÂºÂ§n Ã„â€˜Ã¡ÂºÂ§u vÃƒÂ o combat khÃƒÂ´ng thÃ¡ÂºÂ¥y spawn
    // animation", xem support/CombatPreload.ts).
    queueCombatAssets(this)
  }

  create() {
    // Ã„ÂÃ¡Â»Âc flag MÃ¡Â»â€“I LÃ¡ÂºÂ¦N create Ã¢â‚¬â€ Ã„â€˜Ã¡Â»â€¢i mode qua localStorage cÃƒÂ³ hiÃ¡Â»â€¡u lÃ¡Â»Â±c Ã¡Â»Å¸
    // lÃ¡ÂºÂ§n vÃƒÂ o Combat kÃ¡ÂºÂ¿ tiÃ¡ÂºÂ¿p (Home Ã¢â€ â€ Combat lÃƒÂ  Ã„â€˜Ã¡Â»Â§, khÃƒÂ´ng cÃ¡ÂºÂ§n reload).
    this.renderMode = getBattlefieldRenderMode()

    this.gridGraphics = this.add.graphics().setDepth(DEPTH_GROUND_GRID)

    if (!this.isPerspective) {
      this.arenaRect = this.add
        .rectangle(0, 0, 0, 0, ARENA_COLOR)
        .setOrigin(0.5)
        .setDepth(DEPTH_BACKGROUND)
    }

    this.applyBattlefieldLayout(this.scale.width, this.scale.height)

    // Player visual profile (body-anchor plan Ã‚Â§4.2) Ã¢â‚¬â€ Ã„â€˜Ã¡Â»Âc SNAPSHOT tÃ¡Â»Â«
    // registry TRÃ†Â¯Ã¡Â»Å¡C khi dÃ¡Â»Â±ng sprite Ã„â€˜Ã¡Â»Æ’ khÃƒÂ´ng bÃ¡Â»Â lÃ¡Â»Â¡ trÃ¡ÂºÂ¡ng thÃƒÂ¡i khi scene
    // khÃ¡Â»Å¸i Ã„â€˜Ã¡Â»â„¢ng; cÃ¡ÂºÂ­p nhÃ¡ÂºÂ­t vÃ¡Â»Â sau qua event
    // 'player_visual_profile_changed' (subscribeCombatEvents).
    const registryProfileId = this.registry.get('playerVisualProfileId') as
      | PlayerVisualProfileId
      | undefined

    if (registryProfileId && PLAYER_VISUAL_PROFILES[registryProfileId]) {
      this.applyPlayerVisualProfile(registryProfileId)
    }

    // Reward gourd (plan Ã‚Â§6 + Ã‚Â§8) Ã¢â‚¬â€ art thÃ¡ÂºÂ­t nÃ¡ÂºÂ¿u texture sÃ¡ÂºÂµn sÃƒÂ ng,
    // fallback Graphics placeholder. DÃ¡Â»Â±ng MÃ¡Â»ËœT LÃ¡ÂºÂ¦N mÃ¡Â»â€”i create();
    // auto-refight KHÃƒâ€NG tÃ¡ÂºÂ¡o lÃ¡ÂºÂ¡i hÃ¡Â»â€œ lÃƒÂ´ vÃƒÂ  streams cÃ…Â© tÃ¡Â»Â± hoÃƒÂ n tÃ¡ÂºÂ¥t vÃƒÂ o
    // Ã„â€˜ÃƒÂºng miÃ¡Â»â€¡ng nÃƒÂ³ (Ã‚Â§7.4).
    if (!this.gourdGraphics) {
      if (this.textures.exists(GOURD_TEXTURE_KEY)) {
        this.gourdGraphics = this.add.image(0, 0, GOURD_TEXTURE_KEY)
      } else {
        this.gourdGraphics = this.add.graphics()
      }

      this.gourdGraphics.setDepth(DEPTH_OVERLAY_UI - 4)
    }

    this.refreshRewardGourd(this.canvasHeight, this.gourdBottomInset)

    // Scene nÃƒÂ y chÃ¡Â»â€° Ã„â€˜Ã†Â°Ã¡Â»Â£c start() SAU KHI 'battle_start' Ã„â€˜ÃƒÂ£ emit (xem
    // MainScene.ts) Ã¢â‚¬â€ quÃƒÂ¡i/player Ã„â€˜Ã¡ÂºÂ§u tiÃƒÂªn Ã„â€˜ÃƒÂ£ tÃ¡Â»â€œn tÃ¡ÂºÂ¡i Ã¡Â»Å¸ core rÃ¡Â»â€œi. Player
    // sprite dÃ¡Â»Â±ng NGAY nhÃ†Â°ng Ã¡ÂºÂ¨N cho tÃ¡Â»â€ºi khi snapshot bÃƒÂ¡o materialize
    // (plan Ã‚Â§12.2): pending telegraph vÃƒÂ  materialized sprite loÃ¡ÂºÂ¡i trÃ¡Â»Â«
    // nhau. QuÃƒÂ¡i tÃ¡Â»â€ºi qua 'positions' Ã„â€˜Ã¡ÂºÂ§u tiÃƒÂªn nhÃ†Â° bÃƒÂ¬nh thÃ†Â°Ã¡Â»Âng.
    const player = this.getOrCreateSprite(PLAYER_ID, PLAYER_COLOR, 'Player', HERO_LANE_INDEX)

    player.rect.setVisible(false)

    this.playerMaterialized = false
    this.snapInterpolationTarget(PLAYER_ID, HERO_COLUMN)
    this.positionSprite(player, HERO_COLUMN)

    // Lifecycle listeners dÃƒÂ¹ng handler Ã¡Â»â€N Ã„ÂÃ¡Â»Å NH + gÃ¡Â»Â¡ Ã„â€˜ÃƒÂºng lÃƒÂºc shutdown Ã¢â‚¬â€
    // ScaleManager lÃƒÂ  game-level nÃƒÂªn anonymous callback Ã„â€˜Ã„Æ’ng kÃƒÂ½ mÃ¡Â»â€”i
    // create() sÃ¡ÂºÂ½ TÃƒÂCH TÃ¡Â»Â¤C qua cÃƒÂ¡c lÃ¡ÂºÂ§n Home Ã¢â€ â€™ Combat (N listener cÃƒÂ¹ng
    // chÃ¡ÂºÂ¡y mÃ¡Â»â€”i resize). events.once Ã„â€˜Ã¡ÂºÂ£m bÃ¡ÂºÂ£o shutdown handler tÃ¡Â»Â± gÃ¡Â»Â¡.
    this.scale.on('resize', this.resizeHandler)


    this.subscribeCombatEvents()

    // Late-join replay (fix spawn animation lÃ¡ÂºÂ§n Ã„â€˜Ã¡ÂºÂ§u, 2026-08-26): nÃ¡ÂºÂ¿u
    // scene start MUÃ¡Â»ËœN so vÃ¡Â»â€ºi battle_start, phÃƒÂ¡t lÃ¡ÂºÂ¡i snapshot positions
    // mÃ¡Â»â€ºi nhÃ¡ÂºÂ¥t tÃ¡Â»Â« registry (bridge trong PhaserCanvas.vue) Ã„â€˜Ã¡Â»Æ’ reconcile
    // telegraph/spawn theo Ã„â€˜ÃƒÂºng phase Ã„â€˜ang chÃ¡ÂºÂ¡y. Snapshot stale (>2s)
    // bÃ¡Â»Â qua Ã¢â‚¬â€ trÃ¡ÂºÂ­n kÃ¡ÂºÂ¿ tiÃ¡ÂºÂ¿p tÃ¡Â»Â± cÃƒÂ³ snapshot tÃ†Â°Ã†Â¡i trong ~100ms.
    const snapshot = this.registry.get('lastBattlePositionsSnapshot') as
      | { event: BattlePositionsEvent; at: number }
      | undefined

    if (snapshot && performance.now() - snapshot.at < 2000) {
      this.onPositions(snapshot.event)
    }

    // VÃƒÂ²ng Ã„â€˜Ã¡Â»Âi background (2026-08-26): KHÃƒâ€NG rotate Ã¡Â»Å¸ Ã„â€˜ÃƒÂ¢y nÃ¡Â»Â¯a Ã¢â‚¬â€ trÃ¡ÂºÂ­n
    // Ã„â€˜Ã¡ÂºÂ§u dÃƒÂ¹ng Ã„â€˜ÃƒÂºng preset Ã„â€˜ÃƒÂ£ preload lÃƒÂºc boot; variant kÃ¡ÂºÂ¿ tiÃ¡ÂºÂ¿p Ã„â€˜Ã†Â°Ã¡Â»Â£c
    // chÃ¡Â»Ân + load + swap tÃ¡ÂºÂ¡i battle_end (xem onBattleEnd()).
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

      // Reward stream fallback cache (plan Ã‚Â§7.1) Ã¢â‚¬â€ last-known screen
      // position per entity, dÃƒÂ¹ng khi sprite nguÃ¡Â»â€œn Ã„â€˜ÃƒÂ£ bÃ¡Â»â€¹ dÃ¡Â»Ân trÃ†Â°Ã¡Â»â€ºc khi
      // reward particle Ã„â€˜Ã†Â°Ã¡Â»Â£c render.
      this.trackSourceScreenPosition(id, sprite)

      const castBar = this.castBars.get(id)

      if (castBar) {
        this.positionCastBar(sprite, castBar)
      }
    }

    // Combat Grid Rework Ã¢â‚¬â€ DOT icon bÃƒÂ¡m theo target mÃ¡Â»â€”i frame.
    this.updateStatusIconPositions()

    // Debug body anchors (plan Ã‚Â§5.4, dev-only).
    if (this.debugBodyAnchorsEnabled) {
      this.drawDebugBodyAnchors()
    }

    // DoT presentation (Ã‚Â§7.2) Ã¢â‚¬â€ flush bucket Ã„â€˜Ã¡ÂºÂ¿n hÃ¡ÂºÂ¡n mÃ¡Â»â€”i frame.
    this.flushDueDotTexts()

    // Spawn telegraph Ã¢â‚¬â€ drive handle theo progress snapshot mÃ¡Â»â€ºi nhÃ¡ÂºÂ¥t.
    for (const entry of this.spawnVfxHandles.values()) {
      entry.handle.update(entry.progress)
    }

    // 2.5D depth sort Ã¢â‚¬â€ projected Y quyÃ¡ÂºÂ¿t Ã„â€˜Ã¡Â»â€¹nh chÃƒÂ­nh, column/entityId
    // chÃ¡Â»â€° phÃƒÂ¡ hÃƒÂ²a chÃ¡Â»â€˜ng nhÃ¡ÂºÂ¥p nhÃƒÂ¡y; chÃ¡Â»â€° chÃ¡ÂºÂ¡y Ã¡Â»Å¸ perspective vÃƒÂ¬ flat giÃ¡Â»Â¯
    // insertion order Ã„â€˜ÃƒÂºng nhÃ†Â° renderer cÃ…Â©.
    if (this.isPerspective) {
      this.updateEntityDepths()
    }

    // Coalesce positions: apply Ã„ÂÃƒÅ¡NG MÃ¡Â»ËœT lÃ¡ÂºÂ§n mÃ¡Â»â€”i frame.
    if (this.pendingPositions) {
      const event = this.pendingPositions

      this.pendingPositions = undefined
      this.applyPendingPositions(event)
    }
  }

  /**
   * Depth sort entity sprite theo projected foot Y (gÃ¡ÂºÂ§n Ã„â€˜ÃƒÂ¨ xa). min/max
   * lÃƒÂ  BIÃƒÅ N CÃ¡Â»Â Ã„ÂÃ¡Â»Å NH cÃ¡Â»Â§a mÃ¡ÂºÂ·t Ã„â€˜Ã†Â°Ã¡Â»Âng (entityFootMinY/MaxY Ã„â€˜Ã¡ÂºÂ·t tÃ¡Â»Â«
   * projection.bounds() mÃ¡Â»â€”i layout) Ã¢â‚¬â€ KHÃƒâ€NG tÃƒÂ­nh lÃ¡ÂºÂ¡i tÃ¡Â»Â« tÃ¡ÂºÂ­p entity Ã„â€˜ang
   * sÃ¡Â»â€˜ng: spawn/death cÃ¡Â»Â§a 1 entity khÃƒÂ´ng remap depth cÃ¡Â»Â§a entity khÃƒÂ¡c vÃƒÂ 
   * upright VFX (chÃ¡Â»â€˜t depth lÃƒÂºc spawn) luÃƒÂ´n cÃƒÂ¹ng thÃ†Â°Ã¡Â»â€ºc vÃ¡Â»â€ºi entity.
   */
  entityFootMinY = 0
  entityFootMaxY = 1

  updateEntityDepths() {
    this.gridView.updateEntityDepths()
  }

  /**
   * DÃƒÂ nh khoÃ¡ÂºÂ£ng trÃƒÂªn (Top Bar + Status Bar) vÃƒÂ  dÃ†Â°Ã¡Â»â€ºi (Event Bar +
   * Control Bar) cho DOM chrome cÃ¡Â»Â§a CombatSceneOverlay.vue (xem
   * DesignFrame.ts's COMBAT_*_HEIGHT) Ã¢â‚¬â€ battlefield thÃ¡ÂºÂ­t chÃ¡Â»â€° vÃ¡ÂºÂ½ trong
   * khoÃ¡ÂºÂ£ng CÃƒâ€™N LÃ¡ÂºÂ I Ã¡Â»Å¸ giÃ¡Â»Â¯a.
   *
   * 2.5D migration Ã¢â‚¬â€ layout chÃ¡Â»â€° cÃƒÂ²n 2 viÃ¡Â»â€¡c:
   * 1. DÃ¡Â»Â±ng/resize projection (flat hoÃ¡ÂºÂ·c perspective theo flag) tÃ¡Â»Â«
   *    viewport + insets. Insets Ã†Â°u tiÃƒÂªn sÃ¡Â»â€˜ Ã„ÂO THÃ¡ÂºÂ¬T cÃ¡Â»Â§a bar DOM qua
   *    getCombatInsets() (WS1), fallback cÃƒÂ´ng thÃ¡Â»Â©c tÃ¡Â»Â· lÃ¡Â»â€¡ legacy khi chÃ†Â°a
   *   cÃƒÂ³ phÃƒÂ©p Ã„â€˜o Ã„â€˜Ã¡ÂºÂ§u tiÃƒÂªn.
   * 2. VÃ¡ÂºÂ½ lÃ¡ÂºÂ¡i mÃ¡Â»Âi lÃ¡Â»â€ºp phÃ¡Â»Â¥ thuÃ¡Â»â„¢c hÃƒÂ¬nh hÃ¡Â»Âc: nÃ¡Â»Ân, lÃ†Â°Ã¡Â»â€ºi, entity, chrome Ã¢â‚¬â€
   *    NGAY TRONG LÃ¡ÂºÂ¦N GÃ¡Â»Å’I Ã„â€˜Ã¡Â»Æ’ khÃƒÂ´ng cÃƒÂ³ frame nÃƒÂ o hiÃ¡Â»â€¡n vÃ¡Â»â€¹ trÃƒÂ­ stale.
   */
  private applyBattlefieldLayout(width: number, height: number) {
    // Guard chÃ¡Â»â€˜ng resize bÃ¡ÂºÂ¯n vÃƒÂ o scene Ã„â€˜ang STOPPED: listener trÃƒÂªn
    // ScaleManager (game-level) khÃƒÂ´ng tÃ¡Â»Â± gÃ¡Â»Â¡ khi shutdown, mÃƒÂ  clearSceneState
    // Ã„â€˜ÃƒÂ£ null gridGraphics Ã¢â‚¬â€ dÃƒÂ¹ng nÃƒÂ³ lÃƒÂ m cÃ¡Â»Â "scene Ã„â€˜ang sÃ¡Â»â€˜ng" thay cho
    // guard arenaRect cÃ¡Â»Â§a bÃ¡ÂºÂ£n legacy.
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
    // Camera zoom cÃ¡Â»Â§a scene nÃƒÂ y LUÃƒâ€N giÃ¡Â»Â¯ 1 Ã¢â‚¬â€ mÃ¡Â»Âi tÃ¡Â»Âa Ã„â€˜Ã¡Â»â„¢ combat lÃƒÂ  pixel
    // canvas, projection khÃƒÂ´ng cÃ¡ÂºÂ§n bÃƒÂ¹ transform (plan: zoom khÃƒÂ´ng Ã¡ÂºÂ£nh
    // hÃ†Â°Ã¡Â»Å¸ng combat coordinates).
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

    const bounds = this.projection.bounds()

    if (this.isPerspective && !this.backdrop) {
      // Thanh VÃƒÂ¢n art mount (thanh-van-dong-fu-art-production-plan) Ã¢â‚¬â€
      // Ã†Â°u tiÃƒÂªn modular layers (sky + 6 layer mÃƒÂ¹a); texture thiÃ¡ÂºÂ¿u thÃƒÂ¬
      // fallback procedural backdrop cÃ…Â©. Flat mode giÃ¡Â»Â¯ procedural.
      const allTexturesReady = thanhVanLoadList(this.thanhVanVariant).every((entry) =>
        this.textures.exists(entry.key),
      )

      if (allTexturesReady) {
        this.backdrop = attachThanhVanBackdrop(
          this,

          this.thanhVanVariant,

          width,

          height,

          bounds.top,
        )

        this.usingArtBackdrop = true
      } else {
        this.backdrop = attachBattlefieldBackdrop(this, this.projection)

        this.usingArtBackdrop = false
      }
    }

    // Mirror chÃ¡ÂºÂ©n Ã„â€˜oÃƒÂ¡n/test Ã¢â‚¬â€ flat khÃ¡Â»â€ºp chÃƒÂ­nh xÃƒÂ¡c sÃ¡Â»â€˜ liÃ¡Â»â€¡u legacy cÃ…Â©.
    this.gridLeft = bounds.left
    this.gridTop = bounds.top
    this.cellSize = this.projection.cellSizeAt(GRID_ROW_COUNT - 1).width
    this.laneRowCenterY = Array.from(
      { length: GRID_ROW_COUNT },
      (_, row) => this.projection!.gridToScreen(row, 0).y,
    )

    if (this.arenaRect) {
      // Legacy: nÃ¡Â»Ân phÃ¡ÂºÂ³ng phÃ¡Â»Â§ TOÃƒâ‚¬N bÃ„Æ’ng battlefield (kÃ¡Â»Æ’ cÃ¡ÂºÂ£ letterbox).
      const bandHeight = Math.max(0, height - viewport.topInset - viewport.bottomInset)

      this.arenaRect.setPosition(width / 2, viewport.topInset + bandHeight / 2)
      this.arenaRect.width = width
      this.arenaRect.height = bandHeight
      this.arenaRect.updateDisplayOrigin()
    }

    // KÃƒÂ­ch thÃ†Â°Ã¡Â»â€ºc cÃ†Â¡ sÃ¡Â»Å¸ nhÃƒÂ¢n vÃ¡ÂºÂ­t: flat dÃƒÂ¹ng ÃƒÂ´ vuÃƒÂ´ng chuÃ¡ÂºÂ©n (legacy).
    // Perspective dÃƒÂ¹ng BÃ¡Â»â‚¬ RÃ¡Â»ËœNG ÃƒÂ´ cÃ¡ÂºÂ¡nh gÃ¡ÂºÂ§n lÃƒÂ m thÃ†Â°Ã¡Â»â€ºc Ã¢â‚¬â€ chiÃ¡Â»Âu cao ÃƒÂ´ Ã„â€˜ÃƒÂ£ bÃ¡Â»â€¹
    // nÃƒÂ©n phÃ¡Â»â€˜i cÃ¡ÂºÂ£nh (vÃƒÂ  giÃ¡Â»Â nhÃ¡Â»Â hÃ†Â¡n nÃ¡Â»Â¯a sau khi chia nÃ¡Â»Â­a phong cÃ¡ÂºÂ£nh),
    // khÃƒÂ´ng cÃƒÂ²n lÃƒÂ  thÃ†Â°Ã¡Â»â€ºc Ã„â€˜o hÃ¡Â»Â£p lÃƒÂ½ cho chiÃ¡Â»Âu cao ngÃ†Â°Ã¡Â»Âi Ã„â€˜Ã¡Â»Â©ng.
    const nearCell = this.projection.cellSizeAt(GRID_ROW_COUNT - 1)
    const baseCell = this.isPerspective ? nearCell.width : this.cellSize

    this.characterHeight = Math.max(26, baseCell * 0.92)
    this.characterWidth = this.characterHeight * CHARACTER_WIDTH_RATIO

    this.redrawGridLines()

    this.backdrop?.redraw(width, height, bounds.top)

    // MÃ¡Â»â€˜c depth ban Ã„â€˜Ã¡ÂºÂ§u cho upright VFX (trÃ†Â°Ã¡Â»â€ºc frame entity Ã„â€˜Ã¡ÂºÂ§u tiÃƒÂªn):
    // full mÃ¡ÂºÂ·t Ã„â€˜Ã†Â°Ã¡Â»Âng theo projection hiÃ¡Â»â€¡n hÃƒÂ nh.
    this.entityFootMinY = bounds.top
    this.entityFootMaxY = bounds.bottom

    // Snapshot hÃƒÂ¬nh hÃ¡Â»Âc cho e2e/visual gate Ã¢â‚¬â€ assertion bÃ¡Â»â€˜ cÃ¡Â»Â¥c (tÃ¡Â»â€° lÃ¡Â»â€¡
    // horizon, min road height) Ã„â€˜Ã¡Â»Âc tÃ¡Â»Â« Ã„â€˜ÃƒÂ¢y thay vÃƒÂ¬ Ã„â€˜o pixel.
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

    // Resize giÃ¡Â»Â¯a trÃ¡ÂºÂ­n: dÃ¡Â»Â±ng lÃ¡ÂºÂ¡i vÃ¡Â»â€¹ trÃƒÂ­ NGAY, khÃƒÂ´ng Ã„â€˜Ã¡Â»Â£i snapshot kÃ¡ÂºÂ¿ tiÃ¡ÂºÂ¿p.

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

    // Reward gourd (plan Ã‚Â§6.2) Ã¢â‚¬â€ neo safe-area theo canvas + bottom inset,
    // tÃƒÂ­nh lÃ¡ÂºÂ¡i trong MÃ¡Â»Å’I lÃ¡ÂºÂ§n layout/resize.
    this.gourdBottomInset = viewport.bottomInset

    this.refreshRewardGourd(height, viewport.bottomInset)
  }

  // ================= Reward gourd placeholder (body-anchor plan Ã‚Â§6) ====

  /**
   * TÃƒÂ­nh lÃ¡ÂºÂ¡i vÃ¡Â»â€¹ trÃƒÂ­ hÃ¡Â»â€œ lÃƒÂ´ theo viewport hiÃ¡Â»â€¡n hÃƒÂ nh vÃƒÂ  cÃ¡ÂºÂ­p nhÃ¡ÂºÂ­t view.
   * Neo gÃƒÂ³c TRÃƒÂI DÃ†Â¯Ã¡Â»Å¡I battlefield an toÃƒÂ n Ã¢â‚¬â€ phÃƒÂ­a trÃƒÂªn Event Bar +
   * Control Bar, KHÃƒâ€NG neo theo grid Player. Art thÃ¡ÂºÂ­t (Image): origin =
   * normalized mouth anchor nÃƒÂªn setPosition Ã„â€˜Ã¡ÂºÂ·t Ã„ÂÃƒÅ¡NG miÃ¡Â»â€¡ng; Graphics
   * placeholder: shapes vÃ¡ÂºÂ½ tÃ†Â°Ã†Â¡ng Ã„â€˜Ã¡Â»â€˜i quanh miÃ¡Â»â€¡ng.
   */
  refreshRewardGourd(canvasHeight: number, bottomInset: number) {
    this.rewardGourd.refreshRewardGourd(canvasHeight, bottomInset)
  }

  /** Placeholder Graphics thuÃ¡ÂºÂ§n Ã¢â‚¬â€ khÃƒÂ´ng asset AI, silhouette Ã„â€˜Ã¡Â»Âc tÃ¡Â»â€˜t. */
  redrawGourd() {
    this.rewardGourd.redrawGourd()
  }

  /** Pulse Ã„ÂÃƒÅ¡NG MÃ¡Â»ËœT nhÃ¡Â»â€¹p mÃ¡Â»â€”i reward event (plan Ã‚Â§6.3) Ã¢â‚¬â€ nÃ¡Â»Å¸ tÃ¡Â»Â« miÃ¡Â»â€¡ng. */
  pulseGourd() {
    this.rewardGourd.pulseGourd()
  }

  /** Ã„ÂiÃ¡Â»Æ’m hÃƒÂºt LIVE Ã¢â‚¬â€ luÃƒÂ´n lÃƒÂ  miÃ¡Â»â€¡ng hÃ¡Â»â€œ lÃƒÂ´, khÃƒÂ´ng bao giÃ¡Â»Â lÃƒÂ  Player (Ã‚Â§7.2). */
  gourMouthPoint(): { x: number; y: number } {
    return this.rewardGourd.gourMouthPoint()
  }

  // ================= Player visual profile + body anchors =============

  /**
   * Ã„ÂÃ¡Â»â€¢i hÃƒÂ¬nh thÃƒÂ¡i Player (plan Ã‚Â§4.3): thay texture + kÃƒÂ­ch thÃ†Â°Ã¡Â»â€ºc nguÃ¡Â»â€œn +
   * bÃ¡ÂºÂ£ng anchor nhÃ†Â°ng GIÃ¡Â»Â® NGUYÃƒÅ N entity, position interpolation, HP/VFX
   * state Ã¢â‚¬â€ chÃ¡Â»â€° "lÃ¡Â»â„¢t xÃƒÂ¡c" presentation.
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

  /** Snapshot transform hiÃ¡Â»â€¡n hÃƒÂ nh cÃ¡Â»Â§a player sprite cho anchor resolver. */
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
   * Body anchor Ã¢â€ â€™ screen point (plan Ã‚Â§5.2). One-shot VFX gÃ¡Â»Âi Ã„â€˜ÃƒÂºng lÃƒÂºc
   * spawn; sustained VFX gÃ¡Â»Âi lÃ¡ÂºÂ¡i mÃ¡Â»â€”i frame Ã„â€˜Ã¡Â»Æ’ bÃƒÂ¡m tay khi bob/lunge/
   * recoil (transform snapshot Ã„â€˜Ã¡Â»Âc live).
   */
  getPlayerBodyAnchorScreen(
    anchorId: PlayerBodyAnchorId,
  ): { x: number; y: number } | undefined {
    const transform = this.playerTransformSnapshot()

    if (!transform) {
      return undefined
    }

    return resolveSpriteBodyAnchor(getBodyAnchors(this.playerProfile, 'combat')[anchorId], transform)
  }

  /**
   * Debug mode (plan Ã‚Â§5.4) Ã¢â‚¬â€ dev-only, bÃ¡ÂºÂ­t qua
   * localStorage['debug.playerBodyAnchors']='1'; vÃ¡ÂºÂ½ chÃ¡ÂºÂ¥m mÃƒÂ u tÃ¡ÂºÂ¡i tÃ¡Â»Â«ng
   * body anchor mÃ¡Â»â€”i frame. KhÃƒÂ´ng cÃƒÂ³ UI production nÃƒÂ o Ã„â€˜Ã¡Â»Â¥ng tÃ¡Â»â€ºi.
   */
  drawDebugBodyAnchors() {
    this.vfxSpawner.drawDebugBodyAnchors()
  }

  /**
   * VÃ¡ÂºÂ½ lÃ†Â°Ã¡Â»â€ºi lane qua projection Ã¢â‚¬â€ cÃ¡ÂºÂ£ 2 mode dÃƒÂ¹ng chung 1 code path:
   * flat tÃ¡Â»Â± cho ra ÃƒÂ´ vuÃƒÂ´ng Ã„â€˜Ã¡Â»Âu khÃ¡Â»â€ºp renderer cÃ…Â©; perspective cho lÃ†Â°Ã¡Â»â€ºi
   * hÃ¡Â»â„¢i tÃ¡Â»Â¥ vÃ¡Â»Â hÃ¡ÂºÂ­u cÃ¡ÂºÂ£nh vÃ¡Â»â€ºi vÃ¡ÂºÂ¡ch RÃ¡ÂºÂ¤T NHÃ¡ÂºÂ T (texture Ã„â€˜Ã¡ÂºÂ¥t trong backdrop lÃƒÂ 
   * chÃƒÂ­nh, trÃƒÂ¡nh cÃ¡ÂºÂ£m giÃƒÂ¡c bÃƒÂ n cÃ¡Â»Â). KHÃƒâ€NG bake vÃƒÂ o background.
   */
  redrawGridLines() {
    this.gridView.redrawGridLines()
  }

  // Rectangle (enemy) cÃ¡ÂºÂ§n width/height + updateDisplayOrigin() (mutate
  // geometry trÃ¡Â»Â±c tiÃ¡ÂºÂ¿p); Sprite (player) cÃ¡ÂºÂ§n setDisplaySize() vÃ¡Â»â€ºi TÃ¡Â»Ë† LÃ¡Â»â€ 
  // Ã„ÂÃƒÅ¡NG cÃ¡Â»Â§a artwork gÃ¡Â»â€˜c (playerSourceSize theo profile hiÃ¡Â»â€¡n hÃƒÂ nh Ã¢â‚¬â€
  // body-anchor plan Ã‚Â§4.3),
  // nÃ¡ÂºÂ¿u khÃƒÂ´ng nhÃƒÂ¢n vÃ¡ÂºÂ­t sÃ¡ÂºÂ½ mÃƒÂ©o hÃƒÂ¬nh khi ÃƒÂ©p cÃƒÂ¹ng characterWidth/Height
  // hÃƒÂ¬nh vuÃƒÂ´ng-ish cÃ¡Â»Â§a enemy (xem MainScene.ts's updateSpriteDisplaySize()
  // Ã¢â‚¬â€ cÃƒÂ¹ng lÃƒÂ½ do).
  //
  // Perspective: baseline chÃ¡Â»â€° lÃƒÂ  kÃƒÂ­ch thÃ†Â°Ã¡Â»â€ºc Ã¡Â»Å¸ hÃƒÂ ng hiÃ¡Â»â€¡n hÃƒÂ nh Ã¢â‚¬â€ co giÃƒÂ£n
  // theo chiÃ¡Â»Âu sÃƒÂ¢u diÃ¡Â»â€¦n ra trong applyEntityDepthScale() mÃ¡Â»â€”i lÃ¡ÂºÂ§n chiÃ¡ÂºÂ¿u.
  applySpriteSize(sprite: EntitySprite) {
    this.gridView.applySpriteSize(sprite)
  }

  /**
   * ÃƒÂp scale chiÃ¡Â»Âu sÃƒÂ¢u cho entity: kÃƒÂ­ch thÃ†Â°Ã¡Â»â€ºc = baseline Ãƒâ€” depthScale Ãƒâ€”
   * sizeMultiplier (player Ãƒâ€”2, enemy PNG Ãƒâ€”2 Ã¢â‚¬â€ multiplier NHÃƒâ€šN MÃ¡Â»ËœT LÃ¡ÂºÂ¦N
   * duy nhÃ¡ÂºÂ¥t tÃ¡ÂºÂ¡i Ã„â€˜ÃƒÂ¢y, khÃƒÂ´ng cÃ¡Â»â„¢ng dÃ¡Â»â€œn qua resize/tween) Ãƒâ€” boost (pop ChÃƒÂ­
   * MÃ¡ÂºÂ¡ng/spawn fade-in), ghi vÃƒÂ o GEOMETRY/scale cÃ¡Â»Â§a GameObject nÃƒÂªn tween
   * cÃ…Â© vÃ¡ÂºÂ«n hoÃ¡ÂºÂ¡t Ã„â€˜Ã¡Â»â„¢ng; bÃƒÂ³ng ellipse dÃ†Â°Ã¡Â»â€ºi chÃƒÂ¢n co giÃƒÂ£n theo.
   */
  applyEntityDepthScale(sprite: EntitySprite, depthScale: number) {
    this.gridView.applyEntityDepthScale(sprite, depthScale)
  }

  // Ã„ÂÃ¡Â»â€°nh Ã„â€˜Ã¡ÂºÂ§u sprite theo anchor hiÃ¡Â»â€¡n hÃƒÂ nh Ã¢â‚¬â€ mÃ¡Â»Âi chrome treo trÃƒÂªn Ã„â€˜Ã¡ÂºÂ§u
  // (HP bar / cast bar / DOT icon / text bay) Ã„â€˜i qua Ã„â€˜ÃƒÂ¢y Ã„â€˜Ã¡Â»Æ’ khÃƒÂ´ng phÃ¡Â»Â¥
  // thuÃ¡Â»â„¢c origin (foot anchor Ã¡Â»Å¸ perspective, center anchor Ã¡Â»Å¸ flat).
  // Internal (module boundary).
  entityHeadY(sprite: EntitySprite): number {
    const displayHeight = sprite.rect.displayHeight

    return this.isPerspective ? sprite.rect.y - displayHeight : sprite.rect.y - displayHeight / 2
  }

  trackSourceScreenPosition(id: string, sprite: EntitySprite) {
    this.rewardGourd.trackSourceScreenPosition(id, sprite)
  }

  trackSourceGridPosition(id: string, row: LaneIndex, column: number) {
    this.rewardGourd.trackSourceGridPosition(id, row, column)
  }

  positionSprite(sprite: EntitySprite, worldColumn: number, _id = '') {
    this.gridView.positionSprite(sprite, worldColumn, _id)
  }

  getOrCreateSprite(
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

    // Player dÃƒÂ¹ng artwork theo PROFILE hiÃ¡Â»â€¡n hÃƒÂ nh (body-anchor plan Ã‚Â§4.3);
    // enemy chÃ†Â°a cÃƒÂ³ atlas riÃƒÂªng, vÃ¡ÂºÂ«n dÃƒÂ¹ng Rectangle mÃƒÂ u nhÃ†Â° cÃ…Â© (xem
    // EntitySprite.kind's ghi chÃƒÂº).
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

    // Enemy: Sprite art batch Mortal khi cÃƒÂ³ texture khÃ¡Â»â€ºp id (mortal-
    // enemy-art-batch-plan.md), fallback Rectangle mÃƒÂ u cho id ngoÃƒÂ i
    // batch (test fixture / realm khÃƒÂ¡c chÃ†Â°a cÃƒÂ³ art).
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
        // Enemy art x2 Ã¢â‚¬â€ PNG quÃƒÂ¡i hiÃ¡Â»Æ’n thÃ¡Â»â€¹ gÃ¡ÂºÂ¥p Ã„â€˜ÃƒÂ´i (kÃ¡Â»Æ’ cÃ¡ÂºÂ£ Boss); bÃƒÂ³ng
        // ellipse dÃ†Â°Ã¡Â»â€ºi chÃƒÂ¢n nhÃƒÂ¢n theo cÃƒÂ¹ng multiplier trong
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

    // QuÃƒÂ¡i hiÃ¡Â»â€¡n vÃ¡ÂºÂ«n lÃƒÂ  Rectangle mÃƒÂ u (chÃ†Â°a cÃƒÂ³ atlas Ã„â€˜Ã¡Â»â€¹nh hÃ†Â°Ã¡Â»â€ºng) Ã¢â‚¬â€ khi
    // cÃƒÂ³ sprite riÃƒÂªng chÃ¡Â»â€° cÃ¡ÂºÂ§n setFlipX(true) Ã¡Â»Å¸ Ã„â€˜ÃƒÂ¢y, khÃƒÂ´ng cÃ¡ÂºÂ§n spritesheet
    // mÃ¡Â»â€ºi cho chiÃ¡Â»Âu ngÃ†Â°Ã¡Â»Â£c (plan: flip bÃ¡ÂºÂ±ng Phaser).
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

  updateEnemyHealthBar(sprite: EntitySprite, currentHp: number, maxHp: number) {
    this.gridView.updateEnemyHealthBar(sprite, currentHp, maxHp)
  }

  destroyEntitySprite(sprite: EntitySprite) {
    this.gridView.destroyEntitySprite(sprite)
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

    // DoT accumulator (Ã‚Â§7.2) Ã¢â‚¬â€ dÃ¡Â»Ân khi scene shutdown.
    this.dotAccumulators?.clear()

    // Reward gourd + caches (plan Ã‚Â§7.4) Ã¢â‚¬â€ dÃ¡Â»Ân sÃ¡ÂºÂ¡ch khi scene shutdown;
    // auto-refight (onBattleStart) cÃ¡Â»â€˜ ÃƒÂ½ KHÃƒâ€NG Ã„â€˜Ã¡Â»Â¥ng vÃƒÂ o Ã„â€˜ÃƒÂ¢y Ã„â€˜Ã¡Â»Æ’ streams
    // Ã„â€˜ÃƒÂ£ sinh hoÃƒÂ n tÃ¡ÂºÂ¥t vÃƒÂ o miÃ¡Â»â€¡ng hÃ¡Â»â€œ lÃƒÂ´.
    this.gourdGraphics?.destroy()

    this.gourdGraphics = undefined

    this.gourdPulseTween?.remove()
    this.gourdPulseTween = undefined

    this.debugAnchorGraphics?.destroy()

    this.debugAnchorGraphics = undefined

    this.lastKnownScreenPositions.clear()
    this.lastKnownGridPositions.clear()

    // Scene shutdown Ã„â€˜ÃƒÂ£ destroy children cÃ¡Â»Â§a display list Ã¢â‚¬â€ chÃ¡Â»â€° cÃ¡ÂºÂ§n bÃ¡Â»Â
    // tham chiÃ¡ÂºÂ¿u Ã„â€˜Ã¡Â»Æ’ create() kÃ¡ÂºÂ¿ dÃ¡Â»Â±ng lÃ¡ÂºÂ¡i sÃ¡ÂºÂ¡ch theo mode hiÃ¡Â»â€¡n hÃƒÂ nh.
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
    // Cadence Ã†Â°u tiÃƒÂªn tÃ¡Â»Â« snapshot (khoÃ¡ÂºÂ£ng cÃƒÂ¡ch 2 event 'positions'),
    // fallback: khoÃ¡ÂºÂ£ng cÃƒÂ¡ch tÃ¡Â»Â« segment trÃ†Â°Ã¡Â»â€ºc, clamp sÃƒÂ n.
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

  reconcileEnemySprites(enemies: BattlePositionsEvent['enemies']) {
    const currentIds = new Set(enemies.map((enemy) => enemy.id))

    for (const enemy of enemies) {
      if (this.sprites.has(enemy.id)) {
        continue
      }

      const sprite = this.getOrCreateSprite(enemy.id, ENEMY_COLOR, enemy.name, enemy.row, enemy)

      // VÃ¡Â»Â«a materialize tÃ¡Â»Â« telegraph Ã¢â‚¬â€ fade-in + scale 0.7Ã¢â€ â€™1 (bÃƒÂ³ng/mÃƒÂ¡u/
      // tÃƒÂªn chÃ¡Â»â€° hiÃ¡Â»â€¡n tÃ¡Â»Â« khoÃ¡ÂºÂ£nh khÃ¡ÂºÂ¯c nÃƒÂ y, Ã„â€˜ÃƒÂºng spec spawn mÃ¡Â»â€ºi).
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
   * Reward stream (plan Ã‚Â§7) Ã¢â‚¬â€ BÃƒÂ©zier hÃƒÂºt vÃ¡Â»Â MIÃ¡Â»â€ NG HÃ¡Â»â€™ LÃƒâ€:
   * - Ã„ÂiÃ¡Â»Æ’m phÃƒÂ¡t: chest anchor cÃ¡Â»Â§a sprite nguÃ¡Â»â€œn Ã¢â€ â€™ screen cache Ã¢â€ â€™ ÃƒÂ´ grid
   *   cuÃ¡Â»â€˜i cÃƒÂ¹ng (sprite Ã„â€˜ÃƒÂ£ bÃ¡Â»â€¹ dÃ¡Â»Ân vÃ¡ÂºÂ«n cÃƒÂ³ nguÃ¡Â»â€œn hÃ¡Â»Â£p lÃƒÂ½).
   * - Ã„ÂiÃ¡Â»Æ’m hÃƒÂºt LIVE tÃ¡Â»Â« gourd mouth mÃ¡Â»â€”i onUpdate: Player teleport giÃ¡Â»Â¯a
   *   tween KHÃƒâ€NG Ã¡ÂºÂ£nh hÃ†Â°Ã¡Â»Å¸ng quÃ¡Â»Â¹ Ã„â€˜Ã¡ÂºÂ¡o; resize re-resolve Ã„â€˜ÃƒÂ­ch mÃ¡Â»â€ºi.
   * - TÃ„Æ’ng tÃ¡Â»â€˜c nÃ¡Â»Â­a sau (quad-in), co scale + xoÃƒÂ¡y nhÃ¡Â»Â khi tÃ¡Â»â€ºi miÃ¡Â»â€¡ng.
   * - Pulse hÃ¡Â»â€œ lÃƒÂ´ Ã„ÂÃƒÅ¡NG MÃ¡Â»ËœT nhÃ¡Â»â€¹p mÃ¡Â»â€”i reward event (mÃ¡Â»â€˜c Ã„â€˜Ã¡ÂºÂ¡i diÃ¡Â»â€¡n), khÃƒÂ´ng
   *   pulse theo tÃ¡Â»Â«ng mote (Ã‚Â§6.3).
   */
  private onRewardParticle(event: BattleRewardParticleEvent) {
    this.rewardGourd.onRewardParticle(event)
  }

  /**
   * Ã„ÂiÃ¡Â»Æ’m phÃƒÂ¡t reward (plan Ã‚Â§7.1) Ã¢â‚¬â€ Ã†Â°u tiÃƒÂªn:
   * 1. body anchor cÃ¡Â»Â§a sprite nguÃ¡Â»â€œn cÃƒÂ²n tÃ¡Â»â€œn tÃ¡ÂºÂ¡i (Player dÃƒÂ¹ng catalog
   *    anchor 'chest' cÃ¡Â»Â§a profile; enemy KHÃƒâ€NG cÃƒÂ³ catalog anchor nÃƒÂªn
   *    dÃƒÂ¹ng Ã„â€˜iÃ¡Â»Æ’m thÃƒÂ¢n trung tÃƒÂ­nh suy ra tÃ¡Â»Â« sprite bounds Ã¢â‚¬â€ audit P0-3,
   *    khÃƒÂ´ng bao giÃ¡Â»Â ÃƒÂ¡p Player anchor cho enemy);
   * 2. last-known screen position theo entity ID;
   * 3. ÃƒÂ´ grid cuÃ¡Â»â€˜i cÃƒÂ¹ng chiÃ¡ÂºÂ¿u qua projection hiÃ¡Â»â€¡n hÃƒÂ nh.
   */
  resolveRewardSourcePoint(sourceId: string): { x: number; y: number } | undefined {
    return this.rewardGourd.resolveRewardSourcePoint(sourceId)
  }

  // Internal (module boundary).
  spriteFor(id: string | undefined): EntitySprite | undefined {
    return id ? this.sprites.get(id) : undefined
  }

  // Combat Grid Rework Ã¢â‚¬â€ COALESCE: nhiÃ¡Â»Âu event 'positions' Ã„â€˜Ã¡Â»â€œng bÃ¡Â»â„¢ trong
  // 1 frame chÃ¡Â»â€° giÃ¡Â»Â¯ snapshot MÃ¡Â»Å¡I NHÃ¡ÂºÂ¤T, apply Ã„ÂÃƒÅ¡NG MÃ¡Â»ËœT lÃ¡ÂºÂ§n trong update().
  // Cadence = khoÃ¡ÂºÂ£ng cÃƒÂ¡ch giÃ¡Â»Â¯a 2 SNAPSHOT (lastSnapshotAt), clamp
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
    // Spawn VFX reconcile TRÃ†Â¯Ã¡Â»Å¡C enemy sprites: id rÃ¡Â»Âi spawningEnemies =
    // materialize xong Ã¢â€ â€™ Ã„â€˜ÃƒÂ¡nh dÃ¡ÂºÂ¥u Ã„â€˜Ã¡Â»Æ’ sprite mÃ¡Â»â€ºi tÃ¡ÂºÂ¡o dÃ†Â°Ã¡Â»â€ºi Ã„â€˜ÃƒÂ¢y fade-in.
    this.reconcileSpawnVfx(event)

    // Player spawn reconcile (plan Ã‚Â§12.2): playerMaterialized false =
    // Ã¡ÂºÂ©n sprite; playerSpawn hiÃ¡Â»â€¡n = vÃ¡ÂºÂ½ telegraph tÃ¡ÂºÂ¡i projected cell;
    // telegraph biÃ¡ÂºÂ¿n mÃ¡ÂºÂ¥t = materialize Ã¢â€ â€™ hiÃ¡Â»â€¡n sprite vÃ¡Â»â€ºi fade-in.
    this.reconcilePlayerSpawn(event)

    this.reconcileEnemySprites(event.enemies)

    // Grid fallback cache (plan Ã‚Â§7.1 mÃ¡Â»Â©c 3) Ã¢â‚¬â€ ÃƒÂ´ cuÃ¡Â»â€˜i cÃƒÂ¹ng theo snapshot
    // positions, dÃƒÂ¹ng khi cÃ¡ÂºÂ£ sprite lÃ¡ÂºÂ«n screen cache Ã„â€˜ÃƒÂ£ mÃ¡ÂºÂ¥t.
    for (const enemy of event.enemies) {
      this.trackSourceGridPosition(enemy.id, enemy.row, enemy.x)
    }

    const playerSprite = this.sprites.get(PLAYER_ID)

    if (playerSprite && playerSprite.row !== event.playerRow) {
      // Teleport qua snapshot (fallback khi lÃ¡Â»Â¡ miss event riÃƒÂªng):
      // snap tÃ¡Â»Â©c thÃ¡Â»Âi, KHÃƒâ€NG tween qua hÃƒÂ ng trung gian.
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
   * Reconcile telegraph spawn cÃ¡Â»Â§a PLAYER theo SNAPSHOT (plan Ã‚Â§12.2).
   * Flat mode vÃ¡ÂºÂ«n chÃ¡ÂºÂ¡y visibility (Ã¡ÂºÂ©n/hiÃ¡Â»â€¡n sprite) nhÃ†Â°ng bÃ¡Â»Â VFX telegraph
   * nhÃ†Â° enemy spawn.
   */
  reconcilePlayerSpawn(event: BattlePositionsEvent) {
    this.vfxSpawner.reconcilePlayerSpawn(event)
  }

  /**
   * Reconcile telegraph spawn VFX theo SNAPSHOT (khÃƒÂ´ng event tÃ¡Â»Â©c thÃ¡Â»Âi):
   * id mÃ¡Â»â€ºi Ã¢â€ â€™ tÃ¡ÂºÂ¡o handle; id cÃƒÂ²n Ã¢â€ â€™ cÃ¡ÂºÂ­p nhÃ¡ÂºÂ­t progress; id MÃ¡ÂºÂ¤T Ã¢â€ â€™ materialize
   * (flash ngÃ¡ÂºÂ¯n + fade-in sprite) vÃƒÂ  dÃ¡Â»Ân handle. Flat mode bÃ¡Â»Â qua (renderer
   * legacy giÃ¡Â»Â¯ hÃƒÂ nh vi cÃ…Â©).
   */
  reconcileSpawnVfx(event: BattlePositionsEvent) {
    this.vfxSpawner.reconcileSpawnVfx(event)
  }

  /** Fade-in + scale 0.7Ã¢â€ â€™1 cho enemy vÃ¡Â»Â«a materialize (mÃ¡Â»â„¢t lÃ¡ÂºÂ§n duy nhÃ¡ÂºÂ¥t). */
  playMaterializeFadeIn(sprite: EntitySprite) {
    this.vfxSpawner.playMaterializeFadeIn(sprite)
  }

  // TrÃ¡ÂºÂ­n kÃ¡ÂºÂ¿t thÃƒÂºc (thÃ¡ÂºÂ¯ng/thua) Ã¢â‚¬â€ KHÃƒâ€NG dÃ¡Â»Ân quÃƒÂ¡i, KHÃƒâ€NG snap player vÃ¡Â»Â
  // cÃ¡Â»â„¢t cÃ¡Â»â€¢ng: giÃ¡Â»Â¯ vÃ¡Â»â€¹ trÃƒÂ­ cuÃ¡Â»â€˜i cÃ¡Â»Â§a player/enemy dÃ†Â°Ã¡Â»â€ºi overlay kÃ¡ÂºÂ¿t quÃ¡ÂºÂ£
  // (2026-08-26). KHÃƒâ€NG tÃ¡Â»Â± rÃ¡Â»Âi scene Ã¡Â»Å¸ Ã„â€˜ÃƒÂ¢y Ã¢â‚¬â€ chÃ¡Â»â€° 'combat_scene_exit'
  // (CombatResultModal.vue Ã¢â€ â€™ onExit()) mÃ¡Â»â€ºi chuyÃ¡Â»Æ’n vÃ¡Â»Â MainScene; "Ã„ÂÃƒÂ¡nh
  // LÃ¡ÂºÂ¡i"/auto-refight Ã„â€˜i qua 'battle_start' Ã¢â€ â€™ onBattleStart() reset
  // presentation tÃ¡ÂºÂ¡i chÃ¡Â»â€”. ViÃ¡Â»â€¡c cÃƒÂ²n lÃ¡ÂºÂ¡i Ã¡Â»Å¸ Ã„â€˜ÃƒÂ¢y: chÃ¡Â»Ân + load trÃ†Â°Ã¡Â»â€ºc variant
  // nÃ¡Â»Ân cho trÃ¡ÂºÂ­n KÃ¡ÂºÂ¾ TIÃ¡ÂºÂ¾P vÃƒÂ  dÃ¡Â»Ân DoT accumulator.
  onBattleEnd() {
    this.inBattle = false

    // DoT accumulator (Ã‚Â§7.2) Ã¢â‚¬â€ trÃ¡ÂºÂ­n Ã„â€˜ÃƒÂ£ xong, bucket cÃ…Â© khÃƒÂ´ng Ã„â€˜Ã†Â°Ã¡Â»Â£c rÃƒÂ²
    // sang text cÃ¡Â»Â§a trÃ¡ÂºÂ­n kÃ¡ÂºÂ¿ tiÃ¡ÂºÂ¿p.
    this.dotAccumulators.clear()

    this.prepareThanhVanBackdropForNextBattle()
  }

  /**
   * Teleport AI (plan Ã‚Â§12.3) Ã¢â‚¬â€ nhÃ¡ÂºÂ­n player_teleported: HÃ¡Â»Â¦Y interpolation,
   * snap NGAY tÃ¡Â»â€ºi projected position mÃ¡Â»â€ºi (khÃƒÂ´ng tween qua hÃƒÂ ng trung gian),
   * cÃ¡ÂºÂ­p nhÃ¡ÂºÂ­t depth/scale/label/cast bar/status icon ngay, rÃ¡Â»â€œi gÃ¡Â»Âi hook
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
   * Hook placeholder VFX teleport (plan Ã‚Â§2.5 Ã¢â‚¬â€ Ã„â€˜Ã¡Â»Â£t nÃƒÂ y KHÃƒâ€NG tÃ¡Â»Â± thiÃ¡ÂºÂ¿t kÃ¡ÂºÂ¿
   * VFX): flash alpha ngÃ¡ÂºÂ¯n lÃƒÂ m tÃƒÂ­n hiÃ¡Â»â€¡u trÃ¡Â»Â±c quan tÃ¡Â»â€˜i thiÃ¡Â»Æ’u; thay bÃ¡ÂºÂ±ng
   * hiÃ¡Â»â€¡u Ã¡Â»Â©ng thÃ¡ÂºÂ­t Ã¡Â»Å¸ Ã„â€˜Ã¡Â»Â£t sau qua cÃƒÂ¹ng Ã„â€˜iÃ¡Â»Æ’m neo from/to nÃƒÂ y.
   */
  playTeleportVfx(_from: GridPosition, to: GridPosition) {
    this.vfxSpawner.playTeleportVfx(_from, to)
  }

  // NgÃ†Â°Ã¡Â»Âi chÃ†Â¡i bÃ¡ÂºÂ¥m "TiÃ¡ÂºÂ¿p TÃ¡Â»Â¥c"/"VÃ¡Â»Â Ã„ÂÃ¡Â»â„¢ng PhÃ¡Â»Â§" (CombatResultModal.vue) Ã¢â‚¬â€
  // quay lÃ¡ÂºÂ¡i Home Scene.
  private onExit() {
    this.scene.start('MainScene')
  }

  onAttack(event: CombatScenePayload) {
    const attacker = this.spriteFor(event.sourceId)

    if (attacker) {
      const isPlayer = event.sourceId === PLAYER_ID
      const dx = isPlayer ? ATTACK_LUNGE_PX : -ATTACK_LUNGE_PX

      this.playHorizontalImpulse(attacker, dx, ATTACK_LUNGE_DURATION_MS)
    }
  }

  playHorizontalImpulse(sprite: EntitySprite, distance: number, duration: number) {
    this.vfxSpawner.playHorizontalImpulse(sprite, distance, duration)
  }

  // NÃ¡ÂºÂ£y sÃ¡Â»â€˜ sÃƒÂ¡t thÃ†Â°Ã†Â¡ng Ã¢â‚¬â€ dÃƒÂ¹ng CHUNG event 'damage' mÃƒÂ  CombatStatusBar.vue
  // Ã„â€˜Ã¡Â»Âc Ã„â€˜Ã¡Â»Æ’ vÃ¡ÂºÂ½ thanh HP (xem ghi chÃƒÂº DAMAGE_*_COLOR Ã„â€˜Ã¡ÂºÂ§u file), nÃƒÂªn sÃ¡Â»â€˜
  // nÃ¡ÂºÂ£y lÃƒÂªn LUÃƒâ€N khÃ¡Â»â€ºp vÃ¡Â»â€ºi thanh mÃƒÂ¡u vÃ¡Â»Â«a hÃ¡Â»Â¥t, khÃƒÂ´ng lÃ¡Â»â€¡ch nhÃ¡Â»â€¹p. ChÃ¡ÂºÂ¡y cho
  // CÃ¡ÂºÂ¢ 2 chiÃ¡Â»Âu Ã¢â‚¬â€ target lÃƒÂ  quÃƒÂ¡i (player gÃƒÂ¢y sÃƒÂ¡t thÃ†Â°Ã†Â¡ng) hay target lÃƒÂ 
  // player (quÃƒÂ¡i gÃƒÂ¢y sÃƒÂ¡t thÃ†Â°Ã†Â¡ng) Ã„â€˜Ã¡Â»Âu qua Ã„â€˜ÃƒÂºng 1 handler nÃƒÂ y.
  //
  // DoT presentation (combat-skill-flow-element-power-dot-plan.md Ã‚Â§7) Ã¢â‚¬â€
  // tick DoT (event cÃƒÂ³ effectId) KHÃƒâ€NG hiÃ¡Â»â€¡n text ngay: gom vÃƒÂ o
  // accumulator theo khÃƒÂ³a `targetId|effectId|sourceId`, mÃ¡Â»â€”i 333.33ms
  // flush Ã„ÂÃƒÅ¡NG 1 text/khÃƒÂ³a Ã¡Â»Å¸ anchor thÃ¡ÂºÂ¥p hÃ†Â¡n + depth thÃ¡ÂºÂ¥p hÃ†Â¡n direct hit.
  private onDamageNumber(event: CombatEvent) {
    this.damageText.handleDamageEvent(event)
  }

  /** BÃ¡Â»â„¢ gom DoT Ã¢â‚¬â€ khÃƒÂ³a `targetId|effectId|sourceId`, cÃ¡Â»Â­a sÃ¡Â»â€¢ 1/3 giÃƒÂ¢y. */
  // Internal (module boundary).
  dotAccumulators = new Map<string, { value: number; nextFlushAt: number }>()


  /** Flush cÃƒÂ¡c bucket Ã„â€˜ÃƒÂ£ Ã„â€˜Ã¡ÂºÂ¿n hÃ¡ÂºÂ¡n Ã¢â‚¬â€ MÃ¡Â»â€“I KHÃƒâ€œA Ã„â€˜ÃƒÂºng 1 text (Ã‚Â§7.2). */
  private flushDueDotTexts() {
    this.damageText.flushDueDotTexts()
  }

  private onVitalsChanged(event: EntityVitalsChangedEvent) {
    const sprite = this.spriteFor(event.entityId)

    if (sprite) {
      this.updateEnemyHealthBar(sprite, event.hpAfter, event.maxHp)
    }
  }

  // "NÃ¡ÂºÂ£y sÃ¡Â»â€˜" thÃ¡ÂºÂ­t sÃ¡Â»Â± Ã¢â‚¬â€ pop-in bÃ¡ÂºÂ±ng Back.easeOut (bÃ¡ÂºÂ­t nÃ¡ÂºÂ£y quÃƒÂ¡ cÃ¡Â»Â¡ rÃ¡Â»â€œi
  // co vÃ¡Â»Â, khÃƒÂ¡c easeOut tuyÃ¡ÂºÂ¿n tÃƒÂ­nh cÃ¡Â»Â§a showFloatingText) rÃ¡Â»â€œi mÃ¡Â»â€ºi trÃƒÂ´i
  // lÃƒÂªn/mÃ¡Â»Â dÃ¡ÂºÂ§n, tÃƒÂ¡ch biÃ¡Â»â€¡t hÃ¡ÂºÂ³n phÃ¡ÂºÂ§n chÃ¡Â»Â¯ "ChÃƒÂ­ MÃ¡ÂºÂ¡ng!"/"NÃƒÂ©!" (showFloatingText)
  // Ã¢â‚¬â€ jitter ngang nhÃ¡Â»Â Ã„â€˜Ã¡Â»Æ’ 2 hiÃ¡Â»â€¡u Ã¡Â»Â©ng khÃƒÂ´ng Ã„â€˜ÃƒÂ¨ khÃƒÂ­t lÃƒÂªn nhau khi cÃƒÂ¹ng
  // 1 Ã„â€˜ÃƒÂ²n vÃ¡Â»Â«a ChÃƒÂ­ MÃ¡ÂºÂ¡ng vÃ¡Â»Â«a cÃƒÂ³ sÃƒÂ¡t thÃ†Â°Ã†Â¡ng.
  // Internal (module boundary).
  showDamageNumber(sprite: EntitySprite, value: number, color: string, critical: boolean) {
    this.damageText.showDamageNumber(sprite, value, color, critical)
  }

  /**
   * Format text DoT Ã„â€˜ÃƒÂ£ gom (Ã‚Â§7.2, tÃƒÂ¡ch hÃƒÂ m thuÃ¡ÂºÂ§n Ã„â€˜Ã¡Â»Æ’ test trÃ¡Â»Â±c tiÃ¡ÂºÂ¿p) Ã¢â‚¬â€
   * tÃ¡Â»â€¢ng Ã¢â€°Â¥1 lÃƒÂ m trÃƒÂ²n theo formatter hiÃ¡Â»â€¡n cÃƒÂ³; sÃ¡Â»â€˜ nhÃ¡Â»Â (|x|<1) hiÃ¡Â»â€¡n 1 chÃ¡Â»Â¯
   * sÃ¡Â»â€˜ thÃ¡ÂºÂ­p phÃƒÂ¢n vÃ¡Â»â€ºi SÃƒâ‚¬N 0.1 nÃƒÂªn KHÃƒâ€NG BAO GIÃ¡Â»Å“ hiÃ¡Â»â€¡n "-0.0" (fix
   * 2026-08-26: trÃ†Â°Ã¡Â»â€ºc Ã„â€˜ÃƒÂ¢y 0<x<0.05 render thÃƒÂ nh "-0.0").
   */
  // Internal (module boundary).
  showDotDamageNumber(sprite: EntitySprite, value: number, color: string) {
    this.damageText.showDotDamageNumber(sprite, value, color)
  }

  onCritical(event: CombatScenePayload) {
    const target = this.spriteFor(event.targetId)

    if (!target) {
      return
    }

    // Pop qua boost object Ã¢â‚¬â€ projection ghi kÃƒÂ­ch thÃ†Â°Ã¡Â»â€ºc mÃ¡Â»â€”i frame nÃƒÂªn
    // tween scale trÃ¡Â»Â±c tiÃ¡ÂºÂ¿p sÃ¡ÂºÂ½ bÃ¡Â»â€¹ ghi Ã„â€˜ÃƒÂ¨; boost nhÃƒÂ¢n vÃƒÂ o kÃƒÂ­ch thÃ†Â°Ã¡Â»â€ºc cuÃ¡Â»â€˜i
    // Ã¡Â»Å¸ applyEntityDepthScale() (perspective) / setScale (flat).
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
    this.showFloatingText(target, 'ChÃƒÂ­ MÃ¡ÂºÂ¡ng!', '#ffd54f')
  }

  onHit(event: CombatScenePayload) {
    const target = this.spriteFor(event.targetId)

    if (!target) {
      return
    }

    this.flashColor(target, HIT_FLASH_COLOR, 100)

    const isPlayer = event.targetId === PLAYER_ID
    const recoilX = isPlayer ? -HIT_RECOIL_PX : HIT_RECOIL_PX

    this.playHorizontalImpulse(target, recoilX, HIT_RECOIL_DURATION_MS)
  }

  onDodge(event: CombatScenePayload) {
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

    this.showFloatingText(dodger, 'NÃƒÂ©!', '#8be9fd')
  }

  onCast(event: CombatScenePayload) {
    const caster = this.spriteFor(event.sourceId)

    if (!caster) {
      return
    }

    this.flashColor(caster, CAST_GLOW_COLOR, 160)

    if (event.skillName) {
      this.showFloatingText(caster, event.skillName, CAST_NAME_COLOR)
    }
  }

  // Cast Time (2026-08-21) Ã¢â‚¬â€ skill cÃƒÂ³ Skill.castTime > 0 (xem
  // BattleSystem.beginCast()) niÃ¡Â»â€¡m trong 1 khoÃ¡ÂºÂ£ng thÃ¡Â»Âi gian TRÃ†Â¯Ã¡Â»Å¡C khi
  // hiÃ¡Â»â€¡u Ã¡Â»Â©ng thi triÃ¡Â»Æ’n Ã¢â‚¬â€ vÃ¡ÂºÂ½ 1 thanh tiÃ¡ÂºÂ¿n Ã„â€˜Ã¡Â»â„¢ phÃƒÂ­a trÃƒÂªn Ã„â€˜Ã¡ÂºÂ§u unit + nÃ¡ÂºÂ£y
  // TÃƒÅ N skill lÃƒÂªn (khÃƒÂ¡c 'cast' cÃ…Â© chÃ¡Â»â€° flash mÃƒÂ u, khÃƒÂ´ng hiÃ¡Â»â€¡n chÃ¡Â»Â¯) Ã„â€˜Ã¡Â»Æ’
  // ngÃ†Â°Ã¡Â»Âi chÃ†Â¡i biÃ¡ÂºÂ¿t unit Ã„â€˜ang niÃ¡Â»â€¡m chiÃƒÂªu gÃƒÂ¬. Skill castTime=0 (MÃ¡Â»Å’I
  // skill hiÃ¡Â»â€¡n cÃƒÂ³) khÃƒÂ´ng emit event nÃƒÂ y Ã¢â‚¬â€ vÃ¡ÂºÂ«n dÃƒÂ¹ng Ã„â€˜ÃƒÂºng 'cast' cÃ…Â©.
  private onCastStart(event: CombatScenePayload) {
    this.castBar.onCastStart(event)
  }

  onCastComplete(event: CombatScenePayload) {
    if (event.sourceId) {
      this.destroyCastBar(event.sourceId)
    }
  }

  positionCastBar(sprite: EntitySprite, castBar: CastBarSprite) {
    this.castBar.positionCastBar(sprite, castBar)
  }

  destroyCastBar(id: string) {
    this.castBar.destroyCastBar(id)
  }

  onDeath(event: CombatScenePayload) {
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

    // DoT accumulator (Ã‚Â§7.2) Ã¢â‚¬â€ xÃƒÂ³a bucket cÃ¡Â»Â§a target chÃ¡ÂºÂ¿t.
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

  // TrÃ¡ÂºÂ­n mÃ¡Â»â€ºi bÃ¡ÂºÂ¯t Ã„â€˜Ã¡ÂºÂ§u TRONG LÃƒÅ¡C scene nÃƒÂ y vÃ¡ÂºÂ«n Ã„â€˜ang active (Auto-refight
  // sau victory/defeat, xem CombatVictoryPanel.vue Ã¢â‚¬â€ KHÃƒâ€NG Ã„â€˜i qua
  // MainScene) hoÃ¡ÂºÂ·c lÃ¡ÂºÂ§n Ã„â€˜Ã¡ÂºÂ§u vÃƒÂ o Combat Scene (create() Ã„â€˜ÃƒÂ£ tÃ¡Â»Â± dÃ¡Â»Â±ng
  // player, hÃƒÂ m nÃƒÂ y reset lÃ¡ÂºÂ¡i vÃ¡Â»Â Ã„â€˜ÃƒÂºng trÃ¡ÂºÂ¡ng thÃƒÂ¡i ban Ã„â€˜Ã¡ÂºÂ§u cho chÃ¡ÂºÂ¯c,
  // no-op nÃ¡ÂºÂ¿u Ã„â€˜ÃƒÂ£ sÃ¡ÂºÂ¡ch sÃ¡ÂºÂµn).
  onBattleStart() {
    this.inBattle = true

    // VÃƒÂ²ng Ã„â€˜Ã¡Â»Âi background (2026-08-26): trÃ¡ÂºÂ­n mÃ¡Â»â€ºi bÃ¡ÂºÂ¯t Ã„â€˜Ã¡ÂºÂ§u Ã¢â‚¬â€ HÃ¡Â»Â¦Y mÃ¡Â»Âi lÃ¡ÂºÂ§n
    // load backdrop cÃƒÂ²n treo cÃ¡Â»Â§a battle_end trÃ†Â°Ã¡Â»â€ºc (generation cÃ…Â©) Ã„â€˜Ã¡Â»Æ’
    // callback khÃƒÂ´ng swap giÃ¡Â»Â¯a trÃ¡ÂºÂ­n; nÃ¡Â»Ân hiÃ¡Â»â€¡n tÃ¡ÂºÂ¡i giÃ¡Â»Â¯ nguyÃƒÂªn tÃ¡Â»â€ºi
    // battle_end KÃ¡ÂºÂ¾ TIÃ¡ÂºÂ¾P.
    this.backdropGeneration++

    // DoT accumulator (Ã‚Â§7.2) Ã¢â‚¬â€ trÃ¡ÂºÂ­n mÃ¡Â»â€ºi, dÃ¡Â»Ân bucket cÃ…Â©.
    this.dotAccumulators.clear()

    const player = this.sprites.get(PLAYER_ID)

    if (player) {
      this.resetVisual(player)

      // TrÃ¡ÂºÂ­n mÃ¡Â»â€ºi = Player lÃ¡ÂºÂ¡i Ã„â€˜i qua telegraph spawn (plan Ã‚Â§12.2): Ã¡ÂºÂ©n
      // sprite tÃ¡Â»â€ºi khi snapshot bÃƒÂ¡o materialize, snap vÃ¡Â»Â cÃ¡Â»â„¢t cÃ¡Â»â€¢ng.
      player.rect.setVisible(false)

      this.playerMaterialized = false
      this.snapInterpolationTarget(PLAYER_ID, HERO_COLUMN)
      this.positionSprite(player, HERO_COLUMN)
    }

    this.playerDying = false

    // Scene restart / trÃ¡ÂºÂ­n mÃ¡Â»â€ºi trong cÃƒÂ¹ng scene Ã¢â‚¬â€ dÃ¡Â»Ân Player spawn VFX cÃ…Â©.
    this.playerSpawnHandle?.destroy()
    this.playerSpawnHandle = undefined

    // Auto-repeat/trÃ¡ÂºÂ­n mÃ¡Â»â€ºi trong cÃƒÂ¹ng scene Ã¢â‚¬â€ dÃ¡Â»Ân telegraph cÃ…Â© (snapshot
    // mÃ¡Â»â€ºi cÃ¡Â»Â§a battle kÃ¡ÂºÂ¿ sÃ¡ÂºÂ½ tÃ¡ÂºÂ¡o handle sÃ¡ÂºÂ¡ch theo pendingEnemySpawns mÃ¡Â»â€ºi).
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

  // ================= Combat Grid Rework Ã¢â‚¬â€ VFX 2.5D theo space =================

  /**
   * MÃ¡Â»ËœT action_impact = MÃ¡Â»ËœT VFX instance (spawnActionImpactVfx): mÃ¡Â»Âi
   * pulse/hit sÃ¡Â»â€˜ng trong cÃƒÂ¹ng 1 cÃ¡ÂºÂ·p Graphics + 1 timeline, khÃƒÂ´ng bao giÃ¡Â»Â
   * sinh GameObject theo hitCount/target. preset.space quyÃ¡ÂºÂ¿t Ã„â€˜Ã¡Â»â€¹nh khÃƒÂ´ng
   * gian; polygon footprint CHÃ¡Â»Ë† trÃƒÂ¬nh bÃƒÂ y Ã¢â‚¬â€ damage do core quyÃ¡ÂºÂ¿t Ã„â€˜Ã¡Â»â€¹nh.
   */
  private onActionImpact(event: ActionImpactEvent) {
    this.vfxSpawner.onActionImpact(event)
  }

  /**
   * Depth lÃ¡Â»â€ºp upright cho impact tÃ¡ÂºÂ¡i anchorCell: cÃƒÂ¹ng hÃ¡Â»â€¡ vÃ¡Â»â€ºi entity sprite
   * (foot Y) + bias nhÃ¡Â»Â Ã¢â€ â€™ effect Ã„â€˜ÃƒÂ¨ Ã„â€˜ÃƒÂºng target cÃ¡Â»Â§a nÃƒÂ³ nhÃ†Â°ng vÃ¡ÂºÂ«n bÃ¡Â»â€¹
   * entity hÃƒÂ ng GÃ¡ÂºÂ¦N camera che (occlusion 2.5D). Flat mode giÃ¡Â»Â¯ lÃ¡Â»â€ºp
   * upright cÃ¡Â»â€˜ Ã„â€˜Ã¡Â»â€¹nh nhÃ†Â° renderer cÃ…Â©.
   */
  resolveUprightVfxDepth(anchorCell: GridPosition): number {
    return this.vfxSpawner.resolveUprightVfxDepth(anchorCell)
  }

  private onStatusAttached(event: StatusVfxAttachedEvent) {
    this.vfxSpawner.onStatusAttached(event)
  }

  private onStatusUpdated(event: StatusVfxUpdatedEvent) {
    this.vfxSpawner.onStatusUpdated(event)
  }

  private onStatusRemoved(event: StatusVfxRemovedEvent) {
    this.vfxSpawner.onStatusRemoved(event)
  }


  updateStatusIconPositions() {
    this.vfxSpawner.updateStatusIconPositions()
  }

  flashColor(sprite: EntitySprite, color: number, duration: number) {
    this.vfxSpawner.flashColor(sprite, color, duration)
  }

  // Internal (module boundary).
  showFloatingText(sprite: EntitySprite, text: string, color: string) {
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

  resetVisual(sprite: EntitySprite) {
    this.gridView.resetVisual(sprite)
  }

  // ================= Background lifecycle (battle_end) =================

  /**
   * VÃƒÂ²ng Ã„â€˜Ã¡Â»Âi background mÃ¡Â»â€ºi (2026-08-26) Ã¢â‚¬â€ gÃ¡Â»Âi DUY NHÃ¡ÂºÂ¤T tÃ¡ÂºÂ¡i battle_end:
   * chÃ¡Â»Ân ngÃ¡ÂºÂ«u nhiÃƒÂªn variant KÃ¡ÂºÂ¾ TIÃ¡ÂºÂ¾P khÃƒÂ¡c variant hiÃ¡Â»â€¡n tÃ¡ÂºÂ¡i (selectNext
   * trÃƒÂ¡nh trÃƒÂ¹ng tÃ¡Â»Â«ng chiÃ¡Â»Âu), load thiÃ¡ÂºÂ¿u asset NGAY LÃƒÅ¡C overlay kÃ¡ÂºÂ¿t quÃ¡ÂºÂ£
   * Ã„â€˜ang hiÃ¡Â»â€¡n rÃ¡Â»â€œi swap nguyÃƒÂªn khÃ¡Â»â€˜i Ã¢â‚¬â€ khÃƒÂ´ng flash, khÃƒÂ´ng Ã„â€˜Ã¡Â»Â¥ng nÃ¡Â»Ân trong
   * lÃƒÂºc trÃ¡ÂºÂ­n cÃƒÂ²n/Ã„â€˜ang Ã„â€˜ÃƒÂ¡nh lÃ¡ÂºÂ¡i.
   *
   * - Load xong TRÃ†Â¯Ã¡Â»Å¡C trÃ¡ÂºÂ­n kÃ¡ÂºÂ¿: swap ngay (an toÃƒÂ n Ã¢â‚¬â€ battle Ã„â€˜ÃƒÂ£ hÃ¡ÂºÂ¿t).
   * - TrÃ¡ÂºÂ­n mÃ¡Â»â€ºi bÃ¡ÂºÂ¯t Ã„â€˜Ã¡ÂºÂ§u TRÃ†Â¯Ã¡Â»Å¡C khi load xong: generation token cÃ…Â© bÃ¡Â»â€¹ vÃƒÂ´
   *   hiÃ¡Â»â€¡u (onBattleStart++), KHÃƒâ€NG swap giÃ¡Â»Â¯a trÃ¡ÂºÂ­n; nÃ¡Â»Ân hiÃ¡Â»â€¡n tÃ¡ÂºÂ¡i giÃ¡Â»Â¯
   *   nguyÃƒÂªn tÃ¡Â»â€ºi battle_end kÃ¡ÂºÂ¿ tiÃ¡ÂºÂ¿p.
   */
  private prepareThanhVanBackdropForNextBattle() {
    // Flat mode khÃƒÂ´ng cÃƒÂ³ art backdrop Ã„â€˜Ã¡Â»Æ’ swap; scene stub/test thiÃ¡ÂºÂ¿u
    // loader cÃ…Â©ng bÃ¡Â»Â qua an toÃƒÂ n.
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

    // Guard scene chÃ¡ÂºÂ¿t giÃ¡Â»Â¯a lÃƒÂºc tÃ¡ÂºÂ£i: handler kiÃ¡Â»Æ’m tra scene cÃƒÂ²n active.
    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      if (!this.scene || !this.sys.isActive()) {
        return
      }

      // ChÃ¡Â»â€° lÃ¡ÂºÂ§n yÃƒÂªu cÃ¡ÂºÂ§u MÃ¡Â»Å¡I NHÃ¡ÂºÂ¤T Ã„â€˜Ã†Â°Ã¡Â»Â£c swap, vÃƒÂ  chÃ¡Â»â€° khi chÃ†Â°a cÃƒÂ³ trÃ¡ÂºÂ­n mÃ¡Â»â€ºi
      // (onBattleStart Ã„â€˜ÃƒÂ£ tÃ„Æ’ng token).
      if (generation === this.backdropGeneration && !this.inBattle) {
        this.swapThanhVanBackdrop(desired)
      }
    })

    this.load.start()
  }

  /** HuÃ¡Â»Â· backdrop Thanh VÃƒÂ¢n hiÃ¡Â»â€¡n hÃƒÂ nh vÃƒÂ  dÃ¡Â»Â±ng lÃ¡ÂºÂ¡i tÃ¡Â»Â« texture Ã„â€˜ÃƒÂ£ load. */
  private swapThanhVanBackdrop(variant: ThanhVanVariant) {
    this.thanhVanVariant = variant

    commitThanhVanVariant(variant)

    this.backdrop?.destroy()

    this.backdrop = attachThanhVanBackdrop(
      this,
      variant,
      this.canvasWidth,
      this.canvasHeight,
      this.projection?.bounds().top ?? this.canvasHeight / 2,
    )

    this.usingArtBackdrop = true

    // Grid lines Ã„â€˜ÃƒÂ£ tÃ¡ÂºÂ¯t khi dÃƒÂ¹ng art backdrop Ã¢â‚¬â€ gÃ¡Â»Âi lÃ¡ÂºÂ¡i cho chÃ¡ÂºÂ¯c (khÃƒÂ´ng
    // vÃ¡ÂºÂ½ gÃƒÂ¬ khi usingArtBackdrop=true).
    this.redrawGridLines()
  }
}





