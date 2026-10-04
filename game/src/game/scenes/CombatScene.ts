import Phaser from 'phaser'
import type { ResumePlayback } from '@/core/battle/turn/CombatAnimationRuntime'
import type { ActorAnchorFact, SkillCastPresentation, SkillPresentationResolved } from '@/core/battle/turn/SkillPresentationFacts'
import { SkillPresentationRunner } from '@/presentation/skills/SkillPresentationRunner'
import { PhaserSkillVfxDriver } from '@/game/support/skill-vfx/PhaserSkillVfxDriver'
import { HoaCauFireballPresentation, hoaCauHandAnchor, isHoaCauFireballCast } from '@/game/support/skill-vfx/HoaCauFireballPresentation'
import { TamMuoiAuraPresentation, isTamMuoiAuraCast } from '@/game/support/skill-vfx/TamMuoiAuraPresentation'
import { HOA_CAU_REFERENCE_IMPACT_MS } from '@/game/support/skill-vfx/HoaCauFireballTimeline'
import { getSkillPresentationRecipe } from '@/data/vfx/SkillPresentationRecipes'
import type { EventBus, EventHandler } from '@/core/events/EventBus'
import {
  readOptionalGate,
  writeGate,
  type DomainCommandPort,
} from '@/presentation/gate/PresentationGate'
import type {
  BattlePositionsEvent,
  BattleEndEvent,
  BattleRewardParticleEvent,
  StatusVfxAttachedEvent,
  StatusVfxUpdatedEvent,
  StatusVfxRemovedEvent,
  ReactionVfxResolvedEvent,
} from '@/core/battle/BattleEvents'
import { REACTION_DISPLAY_NAMES } from '@/data/reaction/ReactionDefinitions'
import {
  GRID_ROW_COUNT,
  GRID_COLUMN_COUNT,
  VISIBLE_MAX_COLUMN,
  HERO_COLUMN,
  HERO_LANE_INDEX,
  type LaneIndex,
} from '@/core/battle/BattleLane'
import { getCombatInsets, getFallbackCombatInsets } from '@/presentation/geometry/combatInsets'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import { PlayerHudLayer } from './combat/PlayerHudLayer'
import { readKiemBar } from '@/presentation/bridges/kiemBarBridge'
import { readTheBar } from '@/presentation/bridges/theBarBridge'
import type { GridPosition } from '@/core/battle/BattleGrid'
import {
  createBattleGridProjection,
  type BattlefieldGeometrySnapshot,
  type BattleGridProjection,
} from '@/presentation/geometry/BattleGridProjection'
import {
  getBattlefieldRenderMode,
  type BattlefieldRenderMode,
} from '@/presentation/geometry/BattlefieldRenderMode'
import type { EnemySpawnVfxHandle } from '@/game/support/EnemySpawnVfx'

import {
  PLAYER_VISUAL_PROFILES,
  type PlayerVisualProfile,
  type PlayerVisualProfileId,
} from '@/presentation/art/PlayerVisualProfiles'
import {
  bodyAnchor,
  type AnchorPoint,
  type BodyAnchorId,
  type BodyBox,
} from '@/presentation/geometry/combatBodyAnchors'
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
import { animatedCombatAnimationSets } from '@/game/support/CombatPreload'
import { clipImpactMs, UNMARKED_CAST_CLIP_FRAME_LIMIT } from '@/presentation/art/CombatEntityPresentation'
import type {
  CombatAnimationCatalogue,
  CombatAnimationName,
} from '@/presentation/art/CombatEntityPresentation'

import type { CombatEvent } from '@/core/combat/CombatEvent'
import type { CombatHealEvent, EntityVitalsChangedEvent } from '@/core/combat/EntityVitalsSystem'
import { formatNumber } from '@/core/format/NumberFormatter'
import { CombatDamageText } from './combat/combat-damage-text'
import { CombatCastBar } from './combat/combat-cast-bar'
import { CombatGridView } from './combat/combat-grid-view'
import { CombatVfxSpawner, type SpawnVfxSnapshot } from './combat/combat-vfx-spawner'
import { CombatRewardGourd } from './combat/combat-reward-gourd'
import { CombatEssenceStream } from './combat/combat-essence-stream'
import { CombatPositionInterpolation } from './combat/combat-position-interpolation'
import { CombatPlayerVisual } from './combat/combat-player-visual'
import { CombatEntityVisualLifecycle } from './combat/combat-entity-visual-lifecycle'
import { CombatTelegraph } from './combat/combat-telegraph'
import { CombatAnimationPlayback } from './combat/combat-animation-playback'
import { CombatActionFeedback } from './combat/combat-action-feedback'
import {
  BUFF_ATTACH_COLOR,
  DEBUFF_ATTACH_COLOR,
  MIN_SEGMENT_DURATION_MS,
  PLAYER_COLOR,
  PLAYER_ID,
  DOT_TEXT_FLUSH_INTERVAL_MS,
  DAMAGE_DEALT_COLOR,
  DAMAGE_TAKEN_COLOR,
  LANE_DIVIDER_COLOR,
  PERSPECTIVE_GRID_COLOR,
  PERSPECTIVE_GRID_ALPHA,
  PERSPECTIVE_BORDER_COLOR,
  PERSPECTIVE_BORDER_ALPHA,
  SHADOW_WIDTH_RATIO,
  SHADOW_HEIGHT_RATIO,
  CHARACTER_WIDTH_RATIO,
} from './combat/combatConstants'
import type { PositionInterpolation } from './combat/combatTypes'
import type { CombatGridViewHost } from './combat/CombatGridViewHost'
import { CombatSnapshotReconcile } from './combat/combat-snapshot-reconcile'
import type { TurnBattleEntitySnapshotEvent } from '@/core/battle/turn/TurnActionPresentationEvents'
import { applyScreenShake } from '@/presentation/vfx/screenShakePolicy'

export { formatDotDamageText } from './combat/combatTextFormat'



// Top-down 5-lane (2026-08-22) a+' 2.5D migration (2026-08-24): 'flat' gia"-
// nguyAan palette legacy sau feature flag (BattlefieldRenderMode.ts);
// 'perspective' chuya"fn sang BattlefieldBackdrop + lAEdega">i pha"'i caoGBPnh raoJPYt nhao!t
// A'a"f texture A'aoJPYt lA m chAnh, trA!nh la"(TM) caoGBPm giA!c bA n ca" 10 lane.
const ARENA_COLOR = 0x14161c

/** DoT text flush 3 laosecn/giAcy (plan Asec7.2) aEUR" ca"a sa"* gom 333,33ms. */

// Cast Time (2026-08-21) aEUR" cast bar hia"+n phAa TRASN A'aosecu unit (A'a"'i xa"(c)ng
// va">i label tAan hia"+n phAa dAEdega">i), mA u vA ng tA!ch hao3n kha"i ma"i mA u sa"' naoGBPy
// (A'a"/trao-ng/vA ng chA3i ca"seca ChA Mao!ng) A'a"f khA'ng lao"n aEUR" dA1ng CA(TM)NG gold nhao!t
// hAE!n CRITICAL_DAMAGE_COLOR.

// NaoGBPy sa"' sA!t thAEdegAE!ng (spec CombatUIredesign ma"JPYc 10 aEUR" "Damage thA'ng
// thAEdega"ng vao"n hia"fn tha"< tra"+/-c tiao?p trAan enemy") aEUR" cA1ng ngua""n da"- lia"+u
// event 'damage' mA  CombatStatusBar.vue (thanh trao!ng thA!i) A'ang dA1ng
// A'a"f caop nhaot HP bar, cha"o/oo khA!c nAE!i tiAau tha"JPY (Phaser vao1/2 sa"' naoGBPy lAan thay
// vA! Vue vao1/2 thanh mA!u) aEUR" 1 event, 2 cA!ch tha"f hia"+n tra"+/-c quan song song.
// Aa" cho sA!t thAEdegAE!ng NHao!N vA o (target lA  player), trao-ng cho sA!t thAEdegAE!ng
// GAfaEURsY RA (target lAfA  quAfA!i), vAfA ng riAfAang cho A"aEUR AfA2n ChAfA MA!AoA!ng bA!AoAJPYt kA!A"AE' chiA!A"Au.
// Ta"o/oo la"+ theo CHIa"EURU CAO 1 HAEURNG lane (khA'ng phaoGBPi caoGBP battlefield nhAEdeg side-
// view cA(c)) aEUR" 5 lane top-down (2026-08-22), nhAcn vaot phaoGBPi nha" hAE!n hao3n
// hA ng ca"seca nA3 A'a"f cA2n cha""a la" trAan/dAEdega">i, khA'ng A'A" hA ng kao? bAan.

// Combat AI rework (plan Asec12.1) aEUR" avatar Player La"sN Gao*P AA"I enemy: cha"o/oo
// nhAcn lAan PLAYER sprite, khA'ng A'a"JPYng enemy/VFX footprint. KAch thAEdega">c cua"'i
// = source aspect ratio A- base character size A- multiplier A- depth scale.
// Enemy art x2 (yAau caosecu 2026-08-26) aEUR" PNG quA!i hia"fn tha"< Gao*P AA"I: nhAcn
// A'Aong Ma" T Lao|N tao!i sizeMultiplier, KHA"NG ca"(TM)ng da""n vA o depth scale hay
// spawn tween (boost). Ap cho enemy DA(TM)NG PNG (kind='sprite', ka"f caoGBP Boss
// aEUR" cA1ng quy tao-c); fallback Rectangle gia"- kAch thAEdega">c cA(c) vA! khA'ng phaoGBPi
// "hA!nh aoGBPnh enemy".
// Hero ca"' A'a"<nh sA!t mA(c)p trA!i battlefield (top-down 5-lane, 2026-08-22 aEUR"
// thay layout side-view cA(c) cA3 layout side-view cA(c)) aEUR" cha""a 1
// la" nha" A'a"f sprite khA'ng ba"< cao-t via"n trA!i.


// Audit P0-3 Aca'!aEUR anchor THAfaEURsN TRUNG TAfANH cho enemy reward particle,
// chuao(c)n hoA! theo bounds ca"seca chAnh sprite enemy (0.5, ~0.4 ta"" chAcn).
// Enemy khA'ng cA3 catalog anchor nhAEdeg Player (PlayerVisualProfiles) nAan
// KHA"NG AAE-a"cC mAEdega"GBPn anchor Player aEUR" va"< trA particle khA'ng A'AEdega"GBPc A'a"*i khi
// Player A'a"*i visual profile.

// Internal (module boundary - combat/* doc qua scene ref).
export interface CombatScenePayload {
  sourceId?: string
  targetId?: string
  skillId?: string
  /** Kit slot the cast came from - lets the renderer pick the authored ult
   *  clip for ultimate casts. 'none' marks a declared turn that is not a
   *  slot cast at all (charge-continuation/skipped turns): no lunge, no
   *  clip, just the impact ack pacing (Clean-B F-CB2-02). */
  slotRole?: 'basic' | 'special' | 'ultimate' | 'none'
  // Player visual profile bridge (body-anchor plan Asec4.2) aEUR" event
  // 'player_visual_profile_changed' ga"i kA"m ID hA!nh thA!i ma">i.
  profileId?: string
  // Armed/unarmed discriminator (art-seam wave, user ruling Q2): mortal
  // resolves 'pham_nhan' when armed, 'pham_nhan_unarmed' when not. Absent
  // keeps the current state.
  armed?: boolean
}

interface ResizeSize {
  width: number
  height: number
}

interface EntitySprite {
  // Player = Sprite profile art, enemy = Sprite Mortal art batch HOaoPC
  // Rectangle mA u (id ngoA i batch). `kind` phAcn bia"+t A'a"f biao?t dA1ng
  // setFillStyle() hay setTint()/clearTint() (flashColor()/resetVisual())
  // aEUR" ma"i thao tA!c position/scale/rotation/alpha khA!c A'a"u dA1ng chung API.
  kind: 'rect' | 'sprite'
  rect: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Sprite
  label: Phaser.GameObjects.Text
  color: number
  offsetX: number
  row: LaneIndex
  healthBar?: EnemyHealthBar

  /**
   * KAch thAEdega">c ngua""n ca"seca texture sprite nA y aEUR" player theo profile hia"+n
   * hA nh (this.playerSourceSize), enemy art batch 1254A2. Bao-t bua"(TM)c cho
   * ma"i kind='sprite' A'a"f setDisplaySize gia"- A'Aong ta"o/oo la"+ khung hA!nh.
   */
  sourceSize?: { w: number; h: number }

  // How much of its authored box this sprite's art fills (Spec C sec4.1) --
  // duplicated from combatTypes.ts's EntitySprite (see the note above on why
  // this local interface mirrors that one); combat-grid-view.ts writes this
  // field onto objects stored in `sprites`, which is typed against THIS
  // interface, so it must declare the field too (final whole-branch review,
  // Finding 2).
  extent?: { x: number; y: number; w: number; h: number }

  // The character's size on screen, as resolved by Spec C section 4.3 -- NOT
  // the sprite's box. bodyBoxFor() reads these; combat-grid-view.ts's sizing
  // methods write them (declared on combatTypes.ts's EntitySprite, the type
  // that module imports -- this local interface mirrors the same shape
  // since `sprites` here is typed against it instead).
  personWidth?: number
  personHeight?: number

  // Combat AI rework (plan Asec12.1) + enemy art x2 (2026-08-26) aEUR" player
  // sprite A-2, enemy PNG A-2 (fallback Rectangle A-1).
  sizeMultiplier: number

  // 2.5D presentation (2026-08-24) aEUR" bA3ng ellipse trAan mao*t A'aoJPYt (cha"o/oo tao!o
  // a"Y perspective), foot point + column float laosecn chiao?u gaosecn nhaoJPYt pha"JPYc va"JPY
  // depth sort, vA  boost object cho tween pop (ChA Mao!ng) KHA"NG A'a"JPYng vA o
  // scale/geometry mA  projection ghi ma"-i frame.
  shadow?: Phaser.GameObjects.Ellipse
  boost: { value: number }
  // Mirrors combatTypes.ts EntitySprite (see the note above): procedural
  // idle-bob target (Clean-A3 A-9 mirror drift), the pending one-shot
  // transition listener removed selectively on profile swap (Clean-B2
  // IN3-F1), and the deferred loop / pre-clip base texture used by
  // playCombatAnimation's deferral + restore paths (Clean-B F-CB2-01/03).
  idle?: { offsetY: number }
  pendingTransitionListener?: (anim: Phaser.Animations.Animation) => void
  deferredLoopRequest?: CombatAnimationName
  pendingBaseTextureKey?: string
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

interface CastBarSprite {
  bg: Phaser.GameObjects.Rectangle
  fill: Phaser.GameObjects.Rectangle
  widthPx: number
}

/**
 * Combat UI Redesign -- dedicated battlefield scene, fully DECOUPLED from
 * MainScene.ts (Cave/Home). MainScene.ts calls `this.scene.start('CombatScene')`
 * on 'battle_start' (see MainScene.ts); this scene calls
 * `this.scene.start('MainScene')` back on 'combat_scene_exit' (the Vue emit
 * when the player presses "Continue"/"Back to Cave" in CombatResultModal.vue
 * -- see stores/ui.ts's exitCombatScene()). Auto-refight needs NO scene
 * switch -- a fresh 'battle_start' arriving while this scene is still
 * active is handled exactly like first entry (see onBattleStart()).
 *
 * CORE RULE -- PHASER TALKS ONLY THROUGH THE EVENTBUS -- inherited from
 * MainScene.ts; see the note there for the technical rationale
 * (position interpolation, discrete animation...).
 */
export class CombatScene extends Phaser.Scene implements CombatGridViewHost {
  // ui-discoverability-refactor-plan.md Asec3.2 aEUR" module tA!ch kha"i god-class,
  // kha"Yi tao!o LAZY (Object.create(CombatScene.prototype) trong test KHA"NG
  // chao!y field initializer aEUR" getter an toA n cho caoGBP test lao"n runtime).
  private _damageText?: CombatDamageText

  private get damageText(): CombatDamageText {
    this._damageText ??= new CombatDamageText(this)

    return this._damageText
  }

  // 6A-T4/T5 - HUD player trong canvas; lazy nhu damageText de
  // Object.create(prototype) test khong chay field initializer.
  // Setter cho test stub (prototype object cho phep gan fake hud).
  private _playerHud?: PlayerHudLayer

  get playerHud(): PlayerHudLayer | undefined {
    return this._playerHud
  }

  set playerHud(hud: PlayerHudLayer | undefined) {
    this._playerHud = hud
  }

  private ensurePlayerHud(): PlayerHudLayer {
    this._playerHud ??= new PlayerHudLayer(this, {
      width: this.scale.width,
      height: this.scale.height,
    })

    return this._playerHud
  }

  private _castBar?: CombatCastBar

  private get castBar(): CombatCastBar {
    this._castBar ??= new CombatCastBar(this)

    return this._castBar
  }

  private _gridView?: CombatGridView

  // Public: CombatEntityVisualLifecycle applies visibility decisions
  // through the grid view, which owns the sprite parts.
  get gridView(): CombatGridView {
    this._gridView ??= new CombatGridView(this)

    return this._gridView
  }

  private _vfxSpawner?: CombatVfxSpawner

  // Internal (module boundary - combat-action-feedback/snapshot-reconcile
  // drive VFX spawns through this owner).
  get vfxSpawner(): CombatVfxSpawner {
    this._vfxSpawner ??= new CombatVfxSpawner(this)

    return this._vfxSpawner
  }

  // Action feedback + ack pacing (Wave-3 split) - lazy nhu cac module tren.
  private _actionFeedback?: CombatActionFeedback

  private get actionFeedback(): CombatActionFeedback {
    this._actionFeedback ??= new CombatActionFeedback(this)

    return this._actionFeedback
  }

  private _rewardGourd?: CombatRewardGourd

  private get rewardGourd(): CombatRewardGourd {
    this._rewardGourd ??= new CombatRewardGourd(this)

    return this._rewardGourd
  }

  // Task 8 (perf-optimize-pass phan 2) - noi suy vi tri X + hinh thai
  // Player/body-anchor, cung pattern lazy getter voi cac module tren.
  private _positionInterp?: CombatPositionInterpolation

  // Internal (module boundary - combat-animation-playback deletes entries).
  get positionInterp(): CombatPositionInterpolation {
    this._positionInterp ??= new CombatPositionInterpolation(() => this.time.now)

    return this._positionInterp
  }

  // Animation playback + death sequence (Wave-3 split) - lazy nhu cac
  // module tren.
  private _animationPlayback?: CombatAnimationPlayback

  private get animationPlayback(): CombatAnimationPlayback {
    this._animationPlayback ??= new CombatAnimationPlayback(this)

    return this._animationPlayback
  }

  private _playerVisual?: CombatPlayerVisual

  private get playerVisual(): CombatPlayerVisual {
    this._playerVisual ??= new CombatPlayerVisual(this)

    return this._playerVisual
  }

  // Countdown telegraph chase (Wave-3 split) - lazy nhu cac module tren.
  private _telegraph?: CombatTelegraph

  // Internal (module boundary - combat-snapshot-reconcile drives the chase).
  get telegraph(): CombatTelegraph {
    this._telegraph ??= new CombatTelegraph(this)

    return this._telegraph
  }

  // Snapshot->sprite reconcile (Wave-3 split) - lazy nhu cac module tren.
  private _snapshotReconcile?: CombatSnapshotReconcile

  private get snapshotReconcile(): CombatSnapshotReconcile {
    this._snapshotReconcile ??= new CombatSnapshotReconcile(this)

    return this._snapshotReconcile
  }

  // Entity Visual Lifecycle (roadmap "CombatScene rule") - one owner of
  // per-combatant sprite visibility state (pending / materializing /
  // visible + the legacy player materialized flag). Eager field: pure
  // state container, safe to construct before Phaser systems exist.
  readonly entityVisual = new CombatEntityVisualLifecycle(this)
  // Cha"o/oo ta""n tao!i a"Y chao? A'a"(TM) 'flat' (renderer legacy caosecn na"n phao3ng A'ao*c);
  // 'perspective' thay bao+/-ng BattlefieldBackdrop ha"(TM)i ta"JPY haou caoGBPnh.
  // Battlefield Slot (2026-09-06) - required-property `| undefined` de
  // thoa CombatGridViewHost (ngu nghia giu nguyen, CombatGridView tu guard).
  arenaRect: Phaser.GameObjects.Rectangle | undefined

  // Projection layer aEUR" ngua""n DUY NHao*T cho ma"i quy A'a"*i grida+"screen ka"f caoGBP
  // flat (2 mode cA1ng interface BattleGridProjection nAan phaosecn cA2n lao!i ca"seca
  // scene khA'ng caosecn biao?t mode A'ang chao!y).
  private renderMode: BattlefieldRenderMode = getBattlefieldRenderMode()
  // Battlefield Slot (2026-09-06) - khai bao required-property kieu
  // `| undefined` (thay `?:`) de thoa CombatGridViewHost: ngu nghia giong
  // het (co luc undefined), chi khac cho interface yeu cau property luon
  // TON TAI tren type (CombatGridView tu guard truoc khi doc).
  projection: BattleGridProjection | undefined
  private backdrop?: BattlefieldBackdropHandle

  /** Variant Thanh VAcn A'ang dA1ng (season/time, override qua localStorage). */
  // Variant Thanh VAcn ca"seca PHIASN aEUR" peek (cache module) traoGBP preset ca"' A'a"<nh
  // spring/morning lAoc boot; battle_end cha"n + swap variant kao? tiao?p.
  private thanhVanVariant: ThanhVanVariant = peekThanhVanVariant()

  /** true gia"-a battle_start vA  battle_end aEUR" caoJPYm swap backdrop gia"-a traon. */
  private inBattle = false

  /**
   * Generation token cho background: battle_end caoJPYp token ma">i cho laosecn
   * load hia"+n hA nh, battle_start tAfng token A'a"f callback load cA(c) khA'ng
   * bao gia" swap nhaosecm vA o gia"-a traon (yAau caosecu 2026-08-26).
   */
  private backdropGeneration = 0

  /** true khi na"n lA  art modular aEUR" grid lines/border khA'ng vao1/2 A'A" lAan art. */
  usingArtBackdrop = false
  // Battlefield Slot (2026-09-06) - required-property `| undefined` de
  // thoa CombatGridViewHost (ngu nghia giu nguyen, CombatGridView tu guard).
  gridGraphics: Phaser.GameObjects.Graphics | undefined

  sprites = new Map<string, EntitySprite>()

  // R5 (AR-29) / S3 - encapsulated helpers own their maps. Scene exposes
  // read-only views; mutation goes through the helpers' owned
  // setInterpolationTarget/snap/delete/clear and cast-bar API.
  get interpolations(): ReadonlyMap<string, PositionInterpolation> {
    return this.positionInterp.interpolations
  }

  get castBars(): ReadonlyMap<string, CastBarSprite> {
    return this.castBar.castBars
  }

  // Combat Grid Rework aEUR" DOT VFX theo (targetId + ailmentId), bA!m target.
  statuses = new Map<
    string,
    {
      targetId: string
      buffId: string
      polarity: 'buff' | 'debuff'
      permanent: boolean
      stacks: number
      buffName?: string
      remainingTime?: number
      icon: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Arc
      stackLabel: Phaser.GameObjects.Text
    }
  >()

  // Internal (module boundary - combat/combat-animation-playback.ts owns the
  // death sequence; reconcile reads these to skip in-flight deaths).
  dyingIds = new Set<string>()
  playerDying = false

  // Combat Art Pipeline Task 5 (2026-09-05) - id sprite DA BIET theo phe,
  // rieng cho luong 'turn_battle_entity_snapshot' (KHONG dung chung voi
  // reconcileEnemySprites()/this.sprites - neu dung chung, side nay co the
  // xoa nham sprite cua side kia vi ca hai deu luu chung trong `this.sprites`).
  // Cap nhat lai sau moi lan planCombatantSpriteReconciliation() chay.
  // Internal (module boundary - combat-snapshot-reconcile owns the sets).
  knownTurnBattlePlayerIds = new Set<string>()
  knownTurnBattleEnemyIds = new Set<string>()

  // Spawn telegraph (2026-08-24) aEUR" VFX handle theo pending enemy id:
  // reconcile ta"" SNAPSHOT positions.spawningEnemies (id biao?n maoJPYt =
  // materialize a+' flash + fade-in enemy sprite). Flat mode khA'ng chao!y
  // (renderer legacy gia"- nguyAan hA nh vi cA(c)).
  spawnVfxHandles = new Map<string, { handle: EnemySpawnVfxHandle; progress: number }>()
  // The materialize marks that used to sit here moved to entityVisual
  // (combat-entity-visual-lifecycle.ts), the one visibility-state owner.

  // Party countdown telegraph (Turn-Based Wave Redesign, 2026-09-06) -
  // handle rieng cho player + companion luc dem 3->2->1, TACH KHOI
  // spawnVfxHandles (danh cho enemy wave telegraph) vi lifecycle khac han:
  // moi thanh vien party materialize CUNG LUC theo 1 countdownProgress
  // chung, khong phai tung id mot nhu enemy. KHONG dung
  // reconcilePlayerSpawn() (danh rieng cho legacy real-time, single-id) -
  // xem spec sec6b ly do tach biet hoan toan.
  turnCountdownSpawnVfxHandles = new Map<string, EnemySpawnVfxHandle>()
  // Pre-combat gating ids moved to entityVisual (pending set).

  // Task 9 (telegraph interpolation) - countdownProgress from the snapshot is
  // a TARGET, not a frame to paint. The chase state (target/shown/segment/
  // snapshotAt) lives inside combat/combat-telegraph.ts; the read-only
  // passthroughs below exist for existing observers (same pattern as
  // castBars/interpolations).
  get telegraphTarget(): number {
    return this.telegraph.target
  }

  get telegraphShown(): number {
    return this.telegraph.shown
  }

  // Player spawn telegraph (plan Asec12.2) aEUR" handle DUY NHao*T cho telegraph
  // ca"seca avatar (preset 'player_spawn'); entityVisual.playerMaterialized false = KHA"NG
  // hia"+n Player sprite. Pending telegraph vA  materialized sprite loao!i
  // tra"" nhau A'a"f khA'ng render hai laosecn.
  playerSpawnHandle?: EnemySpawnVfxHandle
  // The playerMaterialized flag moved to entityVisual.playerMaterialized.

  // ================= Player visual profile (body-anchor plan Asec4) ======
  // Profile hia"+n hA nh aEUR" A'a"c ta"" Phaser registry lAoc create() vA  caop nhaot
  // qua event 'player_visual_profile_changed' (bridge a"Y PhaserCanvas.vue).
  // Task 8 - public: combat-player-visual.ts ghi truc tiep qua scene ref.
  playerProfileId: PlayerVisualProfileId = 'mortal'
  playerProfile: PlayerVisualProfile = PLAYER_VISUAL_PROFILES.mortal

  // Armed/unarmed pick for the mortal reskin (user ruling Q2, 2026-09-29):
  // tram => armed 'pham_nhan'; linh_bao/huy_quyen => 'pham_nhan_unarmed'.
  // True matches the resolver's canonical default when the gate is absent.
  // Internal (module boundary - combat-animation-playback, grid view).
  playerArmed = true

  /** KAch thAEdega">c ngua""n ca"seca texture combat A'ang gao-n trAan player sprite. */
  playerSourceSize = { ...PLAYER_VISUAL_PROFILES.mortal.combatSourceSize }

  // Debug body anchors (plan Asec5.4) aEUR" dev-only, baot qua
  // localStorage['debug.playerBodyAnchors']='1'; khA'ng cA3 UI production.
  readonly debugBodyAnchorsEnabled =
    typeof window !== 'undefined' && window.localStorage?.getItem('debug.playerBodyAnchors') === '1'
  debugAnchorGraphics?: Phaser.GameObjects.Graphics

  // ================= Reward gourd + stream state (plan Asec6/Asec7) =========
  gourdPlacement = computeGourdPlacement({ canvasHeight: 0, bottomInset: 0 })

  /**
   * View ha"" lA': Image art thaot khi texture saoun sA ng (plan Asec8), fallback
   * Graphics placeholder nao?u thiao?u. CA1ng API setPosition/scale/destroy
   * nAan pulse/placement dA1ng chung.
   */
  gourdGraphics?: Phaser.GameObjects.Image | Phaser.GameObjects.Graphics

  /** Scale ga"'c sau setDisplaySize aEUR" pulse nhAcn lAan, khA'ng A'A" tuya"+t A'a"'i. */
  gourdBaseScale = { x: 1, y: 1 }

  gourdPulseTween?: Phaser.Tweens.Tween

  /** Bottom inset gaosecn nhaoJPYt (Event+Control bar) aEUR" create() da"+/-ng view mua"(TM)n caosecn re-position. */
  gourdBottomInset = 0

  /**
   * Va"< trA screen Gao|N NHao*T ca"seca ma"i sprite (update trong positionSprite)
   * aEUR" ngua""n da"+/- phA2ng cho reward particle khi sprite ngua""n A'AGBP ba"< da"n.
   */
  lastKnownScreenPositions = new Map<string, { x: number; y: number }>()

  /** A" grid gaosecn nhaoJPYt theo snapshot positions aEUR" fallback cua"'i cA1ng. */
  lastKnownGridPositions = new Map<string, { row: LaneIndex; column: number }>()

  readonly maxTrackedSourcePositions = 64

  private eventBus?: EventBus
  // OPT-09 (roadmap.md sec8.3): mot danh sach [eventName, handler] duy nhat -
  // subscribe/unsubscribe cung lap qua no nen khong the lech nhau (truoc
  // day co 10 entry trong mang nay + 12 dong on/off thu cong song song,
  // them event vao ben nay ma quen ben kia khong co gi bao loi).
  private boundHandlers: Array<[string, EventHandler<never>]> = []
  private debugAnchorHandler = () => this.drawDebugBodyAnchors()
  // Action Playback Task 7 (2026-09-05) - GameManager bridge (set trong
  // subscribeCombatEvents tu registry; scene KHONG import truc tiep).
  // Internal (module boundary - combat-action-feedback paces engine acks).
  gameManagerRef?: DomainCommandPort

  private _skillPlayback?: SkillPresentationRunner
  private _skillVfxDriver?: PhaserSkillVfxDriver
  private _hoaCauPresentation?: HoaCauFireballPresentation
  private _tamMuoiAuraPresentation?: TamMuoiAuraPresentation

  private get hoaCauPresentation(): HoaCauFireballPresentation {
    if (!this._hoaCauPresentation) {
      this._hoaCauPresentation = new HoaCauFireballPresentation({
        anchor: fact => (fact.entityId === PLAYER_ID && this.sprites.get(fact.entityId)?.kind === 'sprite'
          && this.sprites.get(fact.entityId)?.sourceSize?.w === 244
          ? hoaCauHandAnchor(this.sprites.get(fact.entityId)!.rect as Phaser.GameObjects.Sprite)
          : this.bodyAnchorScreen(fact.entityId, fact.entityId === PLAYER_ID ? 'front' : 'centre'))
          ?? this.lastKnownScreenPositions?.get(fact.entityId)
          ?? this.projection?.gridToScreen(fact.row, fact.column),
        depth: fact => {
          const foot = this.projection?.gridToScreen(fact.row, fact.column)
          return this.isPerspective && foot
            ? uprightVfxDepth(foot.y, this.entityFootMinY, this.entityFootMaxY, fact.column)
            : DEPTH_UPRIGHT_VFX
        },
        createSprite: (key, frame) => this.add.image(0, 0, key, frame),
        isCurrent: ref => this.gameManagerRef?.getPendingPlaybackToken() === ref.token,
        reducedMotion: typeof matchMedia === 'function'
          && matchMedia('(prefers-reduced-motion: reduce)').matches,
      })
    }
    return this._hoaCauPresentation
  }

  private get tamMuoiAuraPresentation(): TamMuoiAuraPresentation {
    if (!this._tamMuoiAuraPresentation) {
      this._tamMuoiAuraPresentation = new TamMuoiAuraPresentation({
        anchor: fact => {
          const sprite = this.sprites.get(fact.entityId)
          const box = this.bodyBoxFor(fact.entityId)
          if (!sprite || !box) return undefined
          return { x: box.footX, y: box.footY, scale: box.personHeight / 256, depth: sprite.rect.depth }
        },
        createSprite: (key, frame) => {
          const image = this.add.image(0, 0, key, frame).setOrigin(0.5, 1)
          return {
            setFrame: value => image.setFrame(value),
            setPosition: (x, y) => image.setPosition(x, y),
            setVisible: value => image.setVisible(value),
            setScale: (x, y = x) => image.setScale(x, y),
            setAngle: value => image.setAngle(value),
            setAlpha: value => image.setAlpha(value),
            setDepth: value => image.setDepth(value),
            setBlendAdd: additive => image.setBlendMode(additive ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL),
            destroy: () => image.destroy(),
          }
        },
        isCurrent: ref => this.gameManagerRef?.getPendingPlaybackToken() === ref.token,
        reducedMotion: typeof matchMedia === 'function'
          && matchMedia('(prefers-reduced-motion: reduce)').matches,
      })
    }
    return this._tamMuoiAuraPresentation
  }

  private get skillPlayback(): SkillPresentationRunner {
    if (!this._skillPlayback) {
      const reducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
      const anchorPoint = (fact: ActorAnchorFact) =>
        this.bodyAnchorScreen(fact.entityId, 'centre')
          ?? this.lastKnownScreenPositions?.get(fact.entityId)
          ?? this.projection?.gridToScreen(fact.row, fact.column)
      this._skillVfxDriver = new PhaserSkillVfxDriver({
        graphics: () => this.add.graphics(),
        sprite: key => this.add.image(0, 0, key),
        anchor: anchorPoint,
        ground: fact => this.projection?.gridToScreen(fact.row, fact.column),
        // Monster attack VFX sweep (2026-10-04) - 'sheet' cue sprite factory.
        // Undefined return = texture not loaded (headless, missing bundle);
        // the cue then quietly leaves the analytic primitives in place.
        sprite: (key, frame) =>
          this.textures.exists(key) ? this.add.image(0, 0, key, frame) : undefined,
        uprightDepth: fact => {
          const foot = this.projection?.gridToScreen(fact.row, fact.column)
          return this.isPerspective && foot
            ? uprightVfxDepth(foot.y, this.entityFootMinY, this.entityFootMaxY, fact.column)
            : DEPTH_UPRIGHT_VFX
        },
        // The impulse slides the sprite's offsetX channel so it never fights
        // per-frame position writes; direction follows the declared anchor
        // vector, with the scene facing convention as the no-target fallback.
        // Direction comes from the playback-scoped cast the driver passes
        // through (context.cast) - there is deliberately no scene-level copy:
        // 'complete'-phase resumes never re-deliver onSkillCast, so an
        // event-scoped field could go stale next to the runner's context.
        actorImpulse: (fact, durationMs, impulsePx, cast) => {
          const sprite = this.spriteFor(fact.entityId)
          if (!sprite) return
          const origin = cast ? anchorPoint(cast.source) : undefined
          const destination = cast?.declaredTargets[0]
            ? anchorPoint(cast.declaredTargets[0])
            : undefined
          const direction = origin && destination && destination.x !== origin.x
            ? Math.sign(destination.x - origin.x)
            : fact.entityId === PLAYER_ID ? 1 : -1
          this.playHorizontalImpulse(sprite, direction * impulsePx, durationMs)
        },
        cameraImpulse: (durationMs, intensity) => applyScreenShake(this.cameras.main, durationMs, intensity, false),
      }, reducedMotion ? 'low' : 'standard', reducedMotion)
      this._skillPlayback = new SkillPresentationRunner(this._skillVfxDriver, getSkillPresentationRecipe,
        error => { console.warn('[SkillPresentation]', error) })
    }
    return this._skillPlayback
  }

  /** Read-only diagnostics; never used to control combat. */
  get skillVfxDebug() {
    return { playback: this._skillPlayback?.snapshot,
      pool: this._skillVfxDriver?.stats ?? { allocated: 0, active: 0, capacity: 24 } }
  }

  /**
   * The ONE cast-acknowledgement driver (impact-sync): admission -> play
   * the authored clip the cast resolves to -> hand the runner THAT clip's
   * authored impact moment. Three cases share one rule - the timing clip
   * IS the played clip (I5):
   *
   * - playback.clip set: start() runs on clipImpactMs(clip); the impact
   *   ACK lands on the authored contact frame.
   * - source 'none' (static entity, slotRole 'none', or every candidate
   *   unplayable): start() runs on recipe timing - unchanged semantics.
   * - canStart false (stale replay or duplicate same-ref emit): nothing
   *   plays and nothing restarts.
   */
  private onSkillCast(cast: SkillCastPresentation): void {
    const port = this.gameManagerRef
    if (!port || !this.skillPlayback.canStart(cast, port)) return

    const sprite = this.spriteFor(cast.source.entityId)
    const playback = sprite
      ? this.animationPlayback.startCastPlayback(sprite, cast.source.entityId, cast)
      : { source: 'none' as const }

    const fireballCast = isHoaCauFireballCast(cast)
    const auraCast = isTamMuoiAuraCast(cast)
    const castMs = playback.clip ? clipImpactMs(playback.clip)
      : fireballCast ? HOA_CAU_REFERENCE_IMPACT_MS : undefined

    // Unmarked-policy art debt (plan sec.33): a long clip with no authored
    // impact frame plays but reports its impact at clip end - flag it so
    // the marker gap surfaces in logs instead of silently shipping.
    if (
      playback.clip &&
      playback.clip.impactFrameIndex === undefined &&
      playback.clip.lastFrame - playback.clip.firstFrame + 1 > UNMARKED_CAST_CLIP_FRAME_LIMIT
    ) {
      console.warn(
        `[ImpactSync] unmarked cast clip '${playback.clip.key}' (${playback.clip.lastFrame - playback.clip.firstFrame + 1}f) - impact resolves at clip end; author a marker`,
      )
    }

    this.skillPlayback.start(cast, port, castMs === undefined ? undefined : { castMs })
    if (fireballCast) {
      const timing = castMs !== undefined && castMs > 0 && castMs < 4000
        ? castMs : getSkillPresentationRecipe(cast.presetId).castMs
      this.hoaCauPresentation.start(cast, timing)
    }
    if (auraCast) {
      const timing = castMs !== undefined && castMs > 0 && castMs < 4000
        ? castMs : getSkillPresentationRecipe(cast.presetId).castMs
      this.tamMuoiAuraPresentation.start(cast, timing)
    }
  }

  private onSkillResolved(resolved: SkillPresentationResolved): void {
    this._hoaCauPresentation?.resolve(resolved)
    this._tamMuoiAuraPresentation?.resolve(resolved)
    this._skillPlayback?.resolve(resolved)
  }

  private getCombatEventBindings(): Array<[string, EventHandler<never>]> {
    return [
      ['skill_presentation_cast', (event: SkillCastPresentation) => this.onSkillCast(event)],
      ['skill_presentation_resolved', (event: SkillPresentationResolved) => this.onSkillResolved(event)],
      ['critical', (event: CombatScenePayload) => this.onCritical(event)],
      ['hit', (event: CombatScenePayload) => this.onHit(event)],
      ['dodge', (event: CombatScenePayload) => this.onDodge(event)],
      // ARCH-014 (M12) - retired bindings: 'cast', 'cast_start',
      // 'cast_complete', 'positions' and 'player_teleported' have NO live
      // producer anywhere
      // in the production graph (the legacy real-time BattleSystem that
      // emitted them was deleted; the turn engine has no cast-time or
      // teleport mechanism). Equivalent behavior is already covered:
      // positions -> 'turn_battle_entity_snapshot' reconcile +
      // getCombatPresentationSnapshot() late-join; teleports/column moves
      // -> the same snapshot path (snapInterpolationTarget). Of the kept
      // handler methods only onPositions still has callers - create()'s
      // 'lastBattlePositionsSnapshot' gate fallback (below) and the
      // positionSmoothing/hudWiring/turnCountdownSpawn tests invoke it
      // directly. M13: onCastStart/onCastComplete/onPlayerTeleported (and
      // their exclusive delegates CombatCastBar.onCastStart/CastStartEvent,
      // actionFeedback.onCastComplete, playTeleportVfx, PlayerTeleportedEvent)
      // deleted - zero bindings, zero tests, zero standalone callers.
      // M13 review: 'cast' joined them - its sole emitter was the retired
      // SkillEffectResolver; onCast/actionFeedback.onCast and the
      // skillName/castTimeSeconds payload fields are gone too.
      ['death', (event: CombatScenePayload) => this.onDeath(event)],
      [
        'player_visual_profile_changed',
        (event: CombatScenePayload) => {
          const profileId = event.profileId as PlayerVisualProfileId | undefined

          if (typeof event.armed === 'boolean') {
            this.playerArmed = event.armed
          }

          if (profileId && PLAYER_VISUAL_PROFILES[profileId]) {
            this._hoaCauPresentation?.cancel()
            this._tamMuoiAuraPresentation?.cancel()
            this.applyPlayerVisualProfile(profileId)
          }
        },
      ],
      [
        'turn_battle_entity_snapshot',
        (event: TurnBattleEntitySnapshotEvent) => this.onTurnBattleEntitySnapshot(event),
      ],
      ['battle_end', () => this.onBattleEnd()],
      ['damage', (event: CombatEvent) => this.onDamageNumber(event)],
      // 6A-T2 (2026-09-01) - floating kill/heal.
      [
        'kill',
        (event: CombatEvent) => {
          const sprite = this.spriteFor(event.targetId)

          if (sprite) {
            this.damageText.showKillText(sprite)
          }
        },
      ],
      [
        'heal',
        (event: CombatHealEvent) => {
          const sprite = this.spriteFor(event.targetId)

          if (sprite && event.value > 0) {
            this.damageText.showHealText(sprite, event.value)
          }
        },
      ],
      ['turn_ready', (event: { actorId: string }) => this.onTurnReady(event)],
      ['turn_standby_complete', (event: { actorId: string }) => this.onTurnStandbyComplete(event)],
      ['status_vfx_attached', (event: StatusVfxAttachedEvent) => this.onStatusAttached(event)],
      ['status_vfx_updated', (event: StatusVfxUpdatedEvent) => this.onStatusUpdated(event)],
      ['status_vfx_removed', (event: StatusVfxRemovedEvent) => this.onStatusRemoved(event)],
      ['reaction_resolved', (event: ReactionVfxResolvedEvent) => this.onReactionResolved(event)],
      ['entity_vitals_changed', (event: EntityVitalsChangedEvent) => this.onVitalsChanged(event)],
      ['reward_particle', (event: BattleRewardParticleEvent) => this.onRewardParticle(event)],
    ]
  }

  // Internal (module boundary aEUR" combat/* A'a"c qua scene ref).
  get isPerspective(): boolean {
    return this.renderMode === 'perspective'
  }

  // Combat Grid Rework aEUR" hA!nh ha"c lAEdega">i vuA'ng (px), tAnh lao!i ma"-i layout.
  // GIa"(R) Lao I lA m mirror chao(c)n A'oA!n/test: flat = giA! tra"< legacy chAnh xA!c;
  // perspective = bounding box + ba" ra"(TM)ng A' cao!nh gaosecn.
  private gridLeft = 0
  private gridTop = 0
  private cellSize = 0

  // Internal (module boundary - combat-snapshot-reconcile coalesces
  // 'positions' events; update() consumes pendingPositions once per frame).
  pendingPositions?: BattlePositionsEvent
  pendingCadence?: number
  lastSnapshotAt?: number

  private canvasWidth = 0
  private canvasHeight = 0

  // Top-down 5-lane (2026-08-22) aEUR" tAcm Y ca"seca ma"-i hA ng, length GRID_ROW_COUNT,
  // tAnh lao!i ma"-i khi layout A'a"*i (xem applyBattlefieldLayout()).
  laneRowCenterY: number[] = []

  characterWidth = 0
  characterHeight = 0

  constructor() {
    super('CombatScene')
  }

  preload() {
    // No loader work: AssetBundleManager ensures the 'combat' bundle before
    // this scene is ever activated (coordinator 'loading' phase), and the
    // catalog/parity tests pin the bundle to queueCombatAssets' enumeration.
    // Verified 2026-09-16: cold combat entry queued 0 textures with the
    // transitional net still wired, and every sprite/backdrop rendered.
  }

  private initTransitionId = 0
  private initSessionId?: number
  private initGameGeneration = 0

  init(data?: { transitionId?: number; sessionId?: number; gameGeneration?: number }): void {
    // Assign unconditionally: a (re)start without data must reset the READY
    // identity echo, never leak the previous session's.
    this.initTransitionId = data?.transitionId ?? 0
    this.initSessionId = data?.sessionId
    this.initGameGeneration = data?.gameGeneration ?? 0
  }

  create() {
    // Aa"c flag Ma"-I Lao|N create aEUR" A'a"*i mode qua localStorage cA3 hia"+u la"+/-c a"Y
    // laosecn vA o Combat kao? tiao?p (Home a+" Combat lA  A'a"sec, khA'ng caosecn reload).
    this.renderMode = getBattlefieldRenderMode()

    this.gridGraphics = this.add.graphics().setDepth(DEPTH_GROUND_GRID)

    if (!this.isPerspective) {
      this.arenaRect = this.add
        .rectangle(0, 0, 0, 0, ARENA_COLOR)
        .setOrigin(0.5)
        .setDepth(DEPTH_BACKGROUND)
    }

    this.applyBattlefieldLayout(this.scale.width, this.scale.height)

    // Player visual profile (body-anchor plan Asec4.2) aEUR" A'a"c SNAPSHOT ta""
    // registry TRAE-a"sC khi da"+/-ng sprite A'a"f khA'ng ba" la"! trao!ng thA!i khi scene
    // kha"Yi A'a"(TM)ng; caop nhaot va" sau qua event
    // 'player_visual_profile_changed' (subscribeCombatEvents).
    const registryProfileId = readOptionalGate(this.registry, 'playerVisualProfileId')
    const registryArmed = readOptionalGate(this.registry, 'playerVisualArmed')

    if (registryArmed !== undefined) {
      this.playerArmed = registryArmed
    }

    if (registryProfileId && PLAYER_VISUAL_PROFILES[registryProfileId]) {
      this.applyPlayerVisualProfile(registryProfileId)
    }

    // Spec B sec3.2 (2026-09-11) - register animations for ANIMATED entities
    // only. This used to walk every combat entity; enemies are `kind: 'static'`
    // now, and registering their clips would leave a loaded gun beside
    // playCombatAnimation(). The combat bundle enumerates its atlases from
    // the same list, so the two can never name different keys - bundle
    // ensure completes before scene activation, so these sheetKey textures
    // are already present at create().
    for (const { entityKey, clips } of animatedCombatAnimationSets()) {
      this.registerCombatAnimations(entityKey, clips)
    }

    // Reward gourd (plan Asec6 + Asec8) aEUR" art thaot nao?u texture saoun sA ng,
    // fallback Graphics placeholder. Da"+/-ng Ma" T Lao|N ma"-i create();
    // auto-refight KHA"NG tao!o lao!i ha"" lA' vA  streams cA(c) ta"+/- hoA n taoJPYt vA o
    // A'Aong mia"+ng nA3 (Asec7.4).
    if (!this.gourdGraphics) {
      if (this.textures.exists(GOURD_TEXTURE_KEY)) {
        this.gourdGraphics = this.add.image(0, 0, GOURD_TEXTURE_KEY)
      } else {
        this.gourdGraphics = this.add.graphics()
      }

      this.gourdGraphics.setDepth(DEPTH_OVERLAY_UI - 4)
    }

    this.refreshRewardGourd(this.canvasHeight, this.gourdBottomInset)

    // Scene nA y cha"o/oo A'AEdega"GBPc start() SAU KHI 'battle_start' A'AGBP emit (xem
    // MainScene.ts) aEUR" quA!i/player A'aosecu tiAan A'AGBP ta""n tao!i a"Y core ra""i. Player
    // sprite da"+/-ng NGAY nhAEdegng ao"N cho ta">i khi snapshot bA!o materialize
    // (plan Asec12.2): pending telegraph vA  materialized sprite loao!i tra""
    // nhau. QuA!i ta">i qua 'positions' A'aosecu tiAan nhAEdeg bA!nh thAEdega"ng.
    const playerName =
      readOptionalGate(this.registry, 'gameManager')?.getActivePlayerName?.() ?? 'Player'
    const player = this.getOrCreateSprite(PLAYER_ID, PLAYER_COLOR, playerName, HERO_LANE_INDEX)

    this.entityVisual.hidePlayer(player)

    // Spec B sec4.5/sec6 B7 (2026-09-11) - `idle` finally has a call site. It was
    // built for every entity and never played in combat at all (sec2.3): the
    // player stood on a single frozen frame between turns. This is the default
    // state, played the moment the sprite exists, and the one every other clip
    // returns to.
    this.playCombatAnimation(player, PLAYER_ID, 'idle')

    this.snapInterpolationTarget(PLAYER_ID, HERO_COLUMN)
    this.positionSprite(player, HERO_COLUMN)

    // Lifecycle listeners dA1ng handler a""N Aa"SNH + ga"! A'Aong lAoc shutdown aEUR"
    // ScaleManager lA  game-level nAan anonymous callback A'Afng kA1/2 ma"-i
    // create() sao1/2 TACH Ta"*C qua cA!c laosecn Home a+' Combat (N listener cA1ng
    // chao!y ma"-i resize). events.once A'aoGBPm baoGBPo shutdown handler ta"+/- ga"!.
    this.scale.on('resize', this.resizeHandler)

    this.subscribeCombatEvents()

    // 6A-T4 - HUD player trong canvas (HP/MP/Kiem) - tao mot lan cho
    // doi scene; hien thi/an theo inBattle qua battle_start/battle_end.
    this.ensurePlayerHud()

    // Initial snapshot reconciliation via GameManager query (Task 4/10)
    const gameManager = readOptionalGate(this.registry, 'gameManager')

    if (this.initSessionId && gameManager?.getCombatPresentationSnapshot) {
      const initialSnapshot = gameManager.getCombatPresentationSnapshot(this.initSessionId)
      if (initialSnapshot) {
        this.onTurnBattleEntitySnapshot(initialSnapshot.entities)
      }
    } else {
      // Fallback for standalone/legacy tests that don't supply sessionId
      const snapshot = readOptionalGate(this.registry, 'lastBattlePositionsSnapshot')

      if (snapshot && performance.now() - snapshot.at < 2000) {
        this.onPositions(snapshot.event)
      }
    }

    this.inBattle = true
    // This create() runs AFTER 'battle_start' already emitted (see above),
    // so inBattle only becomes true here - the setVisible must run under
    // the true flag or the HUD stays hidden until the first
    // vitals_changed / a refight's battle_start reveals it.
    this._playerHud?.setVisible(this.inBattle)

    // Report READY to adapter
    const adapter = readOptionalGate(this.registry, 'sceneAdapter')
    adapter?.reportReady({
      transitionId: this.initTransitionId,
      sessionId: this.initSessionId,
      gameGeneration: this.initGameGeneration,
    })

    // Apply resume playback if re-attaching to an in-flight action
    this.applyResumePlayback(gameManager?.preparePresentationResume?.())

    this.events.once('shutdown', this.shutdownHandler)
  }

  private resizeHandler = (gameSize: ResizeSize) => {
    this.applyBattlefieldLayout(gameSize.width, gameSize.height)
    // 6A-T5 - HUD re-layout theo viewport moi (flexible rule).
    this.playerHud?.layout(gameSize.width, gameSize.height)
  }

  private shutdownHandler = () => {
    this.scale.off('resize', this.resizeHandler)
    this.unsubscribeCombatEvents()
    this.clearSceneState()
  }

  update(_time: number, delta: number) {
    this._hoaCauPresentation?.update(delta)
    this._tamMuoiAuraPresentation?.update(delta)
    this._skillPlayback?.update(delta)
    for (const [id, sprite] of this.sprites) {
      const visualX = this.getInterpolatedX(id)

      if (visualX === undefined) {
        continue
      }

      this.positionSprite(sprite, visualX, id)

      // Reward stream fallback cache (plan Asec7.1) aEUR" last-known screen
      // position per entity, dA1ng khi sprite ngua""n A'AGBP ba"< da"n trAEdega">c khi
      // reward particle A'AEdega"GBPc render.
      this.trackSourceScreenPosition(id, sprite)

      const castBar = this.castBars.get(id)

      if (castBar) {
        this.positionCastBar(sprite, castBar)
      }
    }

    // Combat Grid Rework aEUR" DOT icon bA!m theo target ma"-i frame.
    this.updateStatusIconPositions()

    // Debug body anchors (plan Asec5.4, dev-only).
    if (this.debugBodyAnchorsEnabled) {
      this.drawDebugBodyAnchors()
    }

    // DoT presentation (Asec7.2) aEUR" flush bucket A'ao?n hao!n ma"-i frame.
    this.flushDueDotTexts()

    // Spawn telegraph aEUR" drive handle theo progress snapshot ma">i nhaoJPYt.
    for (const entry of this.spawnVfxHandles.values()) {
      entry.handle.update(entry.progress)
    }

    // 2.5D depth sort aEUR" projected Y quyao?t A'a"<nh chAnh, column/entityId
    // cha"o/oo phA! hA2a cha"'ng nhaoJPYp nhA!y; cha"o/oo chao!y a"Y perspective vA! flat gia"-
    // insertion order A'Aong nhAEdeg renderer cA(c).
    if (this.isPerspective) {
      this.updateEntityDepths()
    }

    // Coalesce positions: apply AAsNG Ma" T laosecn ma"-i frame.
    if (this.pendingPositions) {
      const event = this.pendingPositions

      this.pendingPositions = undefined
      this.applyPendingPositions(event)
    }

    // 9.4 - Kiem bar (Kiem The / Kiem Y tam) poll MOI frame.
    this.pollKiemBar()

    // Task 16 - The bar (Phap Tu) same poll pattern.
    this.pollTheBar()

    // Task 9 - party countdown telegraph chases its snapshot target on
    // Phaser's own render clock, independent of how often CombatClock
    // happens to publish a new countdownProgress (game/docs/superpowers/
    // specs/2026-09-10-combat-realtime-turn-authority-design.md sec5.2a,
    // sec4.4 frame-rate independence).
    this.telegraph.advance()
  }

  // 9.4 - Kiem bar poll moi frame tu reader dang ky trong PhaserCanvas
  // (chi noi co gameManager - xem kiemBarBridge.ts). null = an bar.
  // registry thieu (stub/scene chua init) coi nhu "khong co reader".
  private pollKiemBar(): void {
    const kiem = this.registry ? readKiemBar(this.registry) : null

    if (kiem) {
      this.playerHud?.updateKiem(kiem.current, kiem.max, kiem.label)
    } else {
      this.playerHud?.updateKiem(0, 0, '')
    }

    // The Tu Reimagined (T22) - Son Nhac Ho The shield layer rides the
    // same poll; absent/undefined hides the layer (updateExternalWard's
    // hasPool gate), separate from the resource bar entirely.
    this.playerHud?.updateExternalWard(kiem?.externalWard?.current ?? 0, kiem?.externalWard?.max ?? 0)
  }

  // Task 16 - The bar poll moi frame tu reader dang ky trong
  // PhaserCanvas (chi noi co gameManager - xem theBarBridge.ts).
  // null = an bar (khong phai spell / khong battle / chua chon hanh).
  private pollTheBar(): void {
    const the = this.registry ? readTheBar(this.registry) : null

    if (the) {
      this.playerHud?.updateThe(the.current, the.max, the.threshold, the.phapTheActive, {
        hasThamFocus: the.thamTargetId !== undefined,
        quanTheActive: the.quanTheActive,
        reactionDebt: the.reactionDebt,
        quaThe: the.quaThe,
      })
    } else {
      this.playerHud?.updateThe(0, 0, 0, false)
    }
  }

  /**
   * Depth sort entity sprite theo projected foot Y (gA!AoAsecn A"aEUR AfA" xa). min/max
   * lAfA  BIAfA N CA!A"A A"AA!A"A NH cA!A"Aseca mA!AoA*t A"aEUR A+AdegA!A"Ang (entityFootMinY/MaxY A"aEUR A!AoA*t tA!A"A"
   * projection.bounds() mA!A"aEUR"i layout) Aca'!aEUR KHAfaEURNG tAfAnh lA!AoA!i tA!A"A" tA!AoAp entity A"aEUR ang
   * sA!A"aEUR ng: spawn/death cA!A"Aseca 1 entity khAfA'ng remap depth cA!A"Aseca entity khAfA!c vAfA
   * upright VFX (chA!A"aEUR t depth lAfAoc spawn) luAfA'n cAfA1ng thA+AdegA!A"aEURoc vA!A"aEURoi entity.
   */
  entityFootMinY = 0
  entityFootMaxY = 1

  updateEntityDepths() {
    this.gridView.updateEntityDepths()
  }

  /**
   * DA nh khoaoGBPng trAan (Top Bar + Status Bar) vA  dAEdega">i (Event Bar +
   * Control Bar) cho DOM chrome ca"seca CombatSceneOverlay.vue (xem
   * DesignFrame.ts's COMBAT_*_HEIGHT) aEUR" battlefield thaot cha"o/oo vao1/2 trong
   * khoaoGBPng CA'N Lao I a"Y gia"-a.
   *
   * 2.5D migration aEUR" layout cha"o/oo cA2n 2 via"+c:
   * 1. Da"+/-ng/resize projection (flat hoao*c perspective theo flag) ta""
   *    viewport + insets. Insets AEdegu tiAan sa"' AO THao!T ca"seca bar DOM qua
   *    getCombatInsets() (WS1), fallback cA'ng tha"(c)c ta"* la"+ legacy khi chAEdega
   *   cA3 phA(c)p A'o A'aosecu tiAan.
   * 2. Vao1/2 lao!i ma"i la">p pha"JPY thua"(TM)c hA!nh ha"c: na"n, lAEdega">i, entity, chrome aEUR"
   *    NGAY TRONG Lao|N Ga"OEI A'a"f khA'ng cA3 frame nA o hia"+n va"< trA stale.
   */
  private applyBattlefieldLayout(width: number, height: number) {
    // Guard cha"'ng resize bao-n vA o scene A'ang STOPPED: listener trAan
    // ScaleManager (game-level) khA'ng ta"+/- ga"! khi shutdown, mA  clearSceneState
    // A'AGBP null gridGraphics aEUR" dA1ng nA3 lA m ca" "scene A'ang sa"'ng" thay cho
    // guard arenaRect ca"seca baoGBPn legacy.
    if (!this.gridGraphics) {
      return
    }

    this.canvasWidth = width
    this.canvasHeight = height

    const measuredInsets = getCombatInsets()
    // ui-discoverability-refactor-plan.md sec3.3 - fallback insets mot nguon
    // (combatInsets.getFallbackCombatInsets) thay vi hang COMBAT_*_HEIGHT
    // trung lap giua DesignFrame va CSS clamp().
    const fallbackInsets = getFallbackCombatInsets(height)
    // Camera zoom ca"seca scene nA y LUA"N gia"- 1 aEUR" ma"i ta"a A'a"(TM) combat lA  pixel
    // canvas, projection khA'ng caosecn bA1 transform (plan: zoom khA'ng aoGBPnh
    // hAEdega"Yng combat coordinates).
    this.cameras.main.setZoom(1)

    const viewport = {
      width,
      height,
      topInset: measuredInsets.measured ? measuredInsets.top : fallbackInsets.top,
      bottomInset: measuredInsets.measured ? measuredInsets.bottom : fallbackInsets.bottom,
      rightInset: measuredInsets.measured ? measuredInsets.right : fallbackInsets.right,
    }

    if (!this.projection) {
      this.projection = createBattleGridProjection(this.renderMode, viewport)
    } else {
      this.projection.resize(viewport)
    }

    const bounds = this.projection.bounds()

    if (this.isPerspective && !this.backdrop) {
      // Thanh VAcn art mount (thanh-van-dong-fu-art-production-plan) aEUR"
      // AEdegu tiAan modular layers (sky + 6 layer mA1a); texture thiao?u thA!
      // fallback procedural backdrop cA(c). Flat mode gia"- procedural.
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

    // Mirror chao(c)n A'oA!n/test aEUR" flat kha">p chAnh xA!c sa"' lia"+u legacy cA(c).
    this.gridLeft = bounds.left
    this.gridTop = bounds.top
    this.cellSize = this.projection.cellSizeAt(GRID_ROW_COUNT - 1).width
    const projection = this.projection
    this.laneRowCenterY = Array.from(
      { length: GRID_ROW_COUNT },
      (_, row) => projection.gridToScreen(row, 0).y,
    )

    if (this.arenaRect) {
      // Legacy: na"n phao3ng pha"sec TOAEURN bAfng battlefield (ka"f caoGBP letterbox).
      const bandHeight = Math.max(0, height - viewport.topInset - viewport.bottomInset)

      this.arenaRect.setPosition(width / 2, viewport.topInset + bandHeight / 2)
      this.arenaRect.width = width
      this.arenaRect.height = bandHeight
      this.arenaRect.updateDisplayOrigin()
    }

    // KAch thAEdega">c cAE! sa"Y nhAcn vaot: flat dA1ng A' vuA'ng chuao(c)n (legacy).
    // Perspective dA1ng Ba"EUR Ra" NG A' cao!nh gaosecn lA m thAEdega">c aEUR" chia"u cao A' A'AGBP ba"<
    // nA(c)n pha"'i caoGBPnh (vA  gia" nha" hAE!n na"-a sau khi chia na"a phong caoGBPnh),
    // khA'ng cA2n lA  thAEdega">c A'o ha"GBPp lA1/2 cho chia"u cao ngAEdega"i A'a"(c)ng.
    const nearCell = this.projection.cellSizeAt(GRID_ROW_COUNT - 1)
    const baseCell = this.isPerspective ? nearCell.width : this.cellSize

    this.characterHeight = Math.max(26, baseCell * 0.92)
    this.characterWidth = this.characterHeight * CHARACTER_WIDTH_RATIO

    this.redrawGridLines()

    this.backdrop?.redraw(width, height, bounds.top)

    // Ma"'c depth ban A'aosecu cho upright VFX (trAEdega">c frame entity A'aosecu tiAan):
    // full mao*t A'AEdega"ng theo projection hia"+n hA nh.
    this.entityFootMinY = bounds.top
    this.entityFootMaxY = bounds.bottom

    // Snapshot hA!nh ha"c cho e2e/visual gate aEUR" assertion ba"' ca"JPYc (ta"o/oo la"+
    // horizon, min road height) A'a"c ta"" A'Acy thay vA! A'o pixel.
    writeGate(this.game.registry, 'battlefieldGeometry', {
      viewportWidth: width,
      viewportHeight: height,
      topInset: viewport.topInset,
      bottomInset: viewport.bottomInset,
      horizonY: bounds.top,
      roadBottomY: bounds.bottom,
      sceneryHeight: bounds.top - viewport.topInset,
      roadHeight: bounds.bottom - bounds.top,
    } satisfies BattlefieldGeometrySnapshot)

    // Resize gia"-a traon: da"+/-ng lao!i va"< trA NGAY, khA'ng A'a"GBPi snapshot kao? tiao?p.

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

    // Reward gourd (plan Asec6.2) aEUR" neo safe-area theo canvas + bottom inset,
    // tAnh lao!i trong Ma"OEI laosecn layout/resize.
    this.gourdBottomInset = viewport.bottomInset

    this.refreshRewardGourd(height, viewport.bottomInset)
  }

  // ================= Reward gourd placeholder (body-anchor plan Asec6) ====

  /**
   * TAnh lao!i va"< trA ha"" lA' theo viewport hia"+n hA nh vA  caop nhaot view.
   * Neo gA3c TRAI DAE-a"sI battlefield an toA n aEUR" phAa trAan Event Bar +
   * Control Bar, KHA"NG neo theo grid Player. Art thaot (Image): origin =
   * normalized mouth anchor nAan setPosition A'ao*t AAsNG mia"+ng; Graphics
   * placeholder: shapes vao1/2 tAEdegAE!ng A'a"'i quanh mia"+ng.
   */
  refreshRewardGourd(canvasHeight: number, bottomInset: number) {
    this.rewardGourd.refreshRewardGourd(canvasHeight, bottomInset)
  }

  /** Placeholder Graphics thuaosecn aEUR" khA'ng asset AI, silhouette A'a"c ta"'t. */
  redrawGourd() {
    this.rewardGourd.redrawGourd()
  }

  /** Pulse AAsNG Ma" T nha"<p ma"-i reward event (plan Asec6.3) aEUR" na"Y ta"" mia"+ng. */
  pulseGourd() {
    this.rewardGourd.pulseGourd()
  }

  /** Aia"fm hAot LIVE aEUR" luA'n lA  mia"+ng ha"" lA', khA'ng bao gia" lA  Player (Asec7.2). */
  gourMouthPoint(): { x: number; y: number } {
    return this.rewardGourd.gourMouthPoint()
  }

  // ================= Player visual profile + body anchors =============

  // Task 8 (perf-optimize-pass phan 2) - logic day du chuyen sang
  // combat/combat-player-visual.ts (doi hinh thai Player + resolver
  // body-anchor); wrapper giu nguyen chu ky public cho combat-vfx-spawner.ts.
  private applyPlayerVisualProfile(profileId: PlayerVisualProfileId) {
    this.playerVisual.applyPlayerVisualProfile(profileId)
  }

  /**
   * Spec C sec4.2 - a body anchor in screen space, for any entity.
   *
   * Replaces getPlayerBodyAnchorScreen(), which could only answer for the
   * player and read a hand-authored table describing the profile's static PNG
   * rather than the art actually on screen.
   *
   * Works for a Rectangle fallback as well as a Sprite: the anchors describe a
   * notional body standing in a cell, and a Rectangle stands in one too.
   */
  bodyAnchorScreen(entityId: string, id: BodyAnchorId): AnchorPoint | undefined {
    const box = this.bodyBoxFor(entityId)

    return box ? bodyAnchor(id, box) : undefined
  }

  private bodyBoxFor(entityId: string): BodyBox | undefined {
    const sprite = this.sprites.get(entityId)

    if (!sprite) {
      return undefined
    }

    // Fall back to the character baseline when the grid view has not sized this
    // sprite yet (first frame after spawn). Better an anchor at the default body
    // size than none at all.
    const personHeight = sprite.personHeight ?? this.characterHeight
    const personWidth = sprite.personWidth ?? this.characterWidth

    return {
      footX: sprite.rect.x,
      footY: sprite.footY,
      personWidth,
      personHeight,
      facing: entityId === PLAYER_ID ? 'right' : 'left',
    }
  }

  /**
   * Debug mode (plan Asec5.4) aEUR" dev-only, baot qua
   * localStorage['debug.playerBodyAnchors']='1'; vao1/2 chaoJPYm mA u tao!i ta""ng
   * body anchor ma"-i frame. KhA'ng cA3 UI production nA o A'a"JPYng ta">i.
   */
  drawDebugBodyAnchors() {
    this.vfxSpawner.drawDebugBodyAnchors()
  }

  /**
   * VA!AoA1/2 lA+AdegA!A"aEURoi lane qua projection Aca'!aEUR cA!AoAGBP 2 mode dAfA1ng chung 1 code path:
   * flat tA!A"A+/- cho ra AfA' vuAfA'ng A"aEUR A!A"Au khA!A"aEURop renderer cA...A(c); perspective cho lA+AdegA!A"aEURoi
   * hA!A"a"ci tA!A"AJPY vA!A"A hA!AoAu cA!AoAGBPnh vA!A"aEURoi vA!AoA!ch RA!AoA*T NHA!AoA T (texture A"aEUR A!AoAJPYt trong backdrop lAfA
   * chAfAnh, trAfA!nh cA!AoAGBPm giAfA!c bAfA n cA!A"A). KHAfaEURNG bake vAfA o background.
   */
  redrawGridLines() {
    this.gridView.redrawGridLines()
  }

  // Rectangle (enemy) caosecn width/height + updateDisplayOrigin() (mutate
  // geometry trA!A"A+/-c tiA!AoA?p); Sprite (player) cA!AoAsecn setDisplaySize() vA!A"aEURoi TA!A"E+ LA!A"aEUR
  // AAsNG ca"seca artwork ga"'c (playerSourceSize theo profile hia"+n hA nh aEUR"
  // body-anchor plan Asec4.3),
  // nao?u khA'ng nhAcn vaot sao1/2 mA(c)o hA!nh khi A(c)p cA1ng characterWidth/Height
  // hA!nh vuA'ng-ish ca"seca enemy (xem MainScene.ts's updateSpriteDisplaySize()
  // aEUR" cA1ng lA1/2 do).
  //
  // Perspective: baseline cha"o/oo lA  kAch thAEdega">c a"Y hA ng hia"+n hA nh aEUR" co giAGBPn
  // theo chia"u sAcu dia"...n ra trong applyEntityDepthScale() ma"-i laosecn chiao?u.
  applySpriteSize(sprite: EntitySprite) {
    this.gridView.applySpriteSize(sprite)
  }

  /**
   * AfAp scale chiA!A"Au sAfAcu cho entity: kAfAch thA+AdegA!A"aEURoc = baseline AfaEUR" depthScale AfaEUR"
   * sizeMultiplier (player AfaEUR"2, enemy PNG AfaEUR"2 Aca'!aEUR multiplier NHAfaEURsN MA!A"EoeT LA!AoA|N
   * duy nhA!AoAJPYt tA!AoA!i A"aEUR AfAcy, khAfA'ng cA!A"a"cng dA!A"aEURoen qua resize/tween) AfaEUR" boost (pop ChAfA
   * MA!AoA!ng/spawn fade-in), ghi vAfA o GEOMETRY/scale cA!A"Aseca GameObject nAfAan tween
   * cA...A(c) vA!AoA"n hoA!AoA!t A"aEUR A!A"a"cng; bAfA3ng ellipse dA+AdegA!A"aEURoi chAfAcn co giAfAGBPn theo.
   */
  applyEntityDepthScale(sprite: EntitySprite, depthScale: number) {
    this.gridView.applyEntityDepthScale(sprite, depthScale)
  }

  // Aa"o/oonh A'aosecu sprite theo anchor hia"+n hA nh aEUR" ma"i chrome treo trAan A'aosecu
  // (HP bar / cast bar / DOT icon / text bay) A'i qua A'Acy A'a"f khA'ng pha"JPY
  // thua"(TM)c origin (foot anchor a"Y perspective, center anchor a"Y flat).
  // Internal (module boundary).
  entityHeadY(sprite: EntitySprite): number {
    return this.gridView.entityHeadY(sprite)
  }

  // CombatGridViewHost (Battlefield Slot spec sec.1) - combat that resolves
  // entity art qua catalogue (unknown -> placeholder texture), nen day chi
  // con la double-fallback khi ca placeholder cung thieu. Panel Tran Phap
  // (TranPhapCombatPreviewScene) override ham nay de tra ve sheet/texture
  // placeholder dung chung theo mode.
  fallbackSpriteTextureKey(_id: string): string | undefined {
    return undefined
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

  // Task 8 (perf-optimize-pass phan 2) - logic day du chuyen sang
  // combat/combat-grid-view.ts (da co san getOrCreateSprite tuong duong
  // - chi con thieu wiring); wrapper giu nguyen chu ky public.
  //
  // Combat Art Pipeline Task 9 (2026-09-05) - id CHET roi TAI XUAT HIEN
  // (spawn lai) trong luc sprite cu con dang cho death animation hoan tat
  // (deferred cleanup, xem beginDeathSequence()): finalize NGAY sprite cu o
  // DAY truoc khi tao sprite moi. Khong co buoc nay, gridView.getOrCreateSprite()
  // se thay `this.sprites.has(id)` van true (sprite cu chua bi xoa) va TRA VE
  // NGUYEN sprite dang chet cho entity moi - roi callback ANIMATION_COMPLETE/
  // tween cua lan chet truoc destroy() NHAM sprite cua entity moi (orphan/
  // double-destroy dung nhu review Task 5 canh bao).
  getOrCreateSprite(
    id: string,
    color: number,
    labelText: string,
    row: LaneIndex = HERO_LANE_INDEX,
    health?: { currentHp: number; maxHp: number; isBoss: boolean },
  ): EntitySprite {
    if (this.dyingIds.has(id)) {
      this.forceFinalizeDeath(id)
    }

    return this.gridView.getOrCreateSprite(id, color, labelText, row, health)
  }

  /**
   * Don NGAY sprite dang o giua death sequence (animation/tween chua xong) -
   * dung khi id do tai xuat hien (xem getOrCreateSprite()) de tranh
   * beginDeathSequence() cu dong cua nham sprite moi sau nay. Don gian hon
   * beginDeathSequence(): khong can cho gi ca, huy NGAY.
   */
  // Internal (module boundary - combat-animation-playback).
  private forceFinalizeDeath(id: string): void {
    this.animationPlayback.forceFinalizeDeath(id)
  }

  updateEnemyHealthBar(sprite: EntitySprite, currentHp: number, maxHp: number) {
    this.gridView.updateEnemyHealthBar(sprite, currentHp, maxHp)
  }

  destroyEntitySprite(sprite: EntitySprite) {
    this.gridView.destroyEntitySprite(sprite)
  }

  /**
   * Combat Art Pipeline Task 9 (2026-09-05) - dang ky Phaser
   * Animation cho MOT entity (player theo profile, hoac enemy theo texture
   * key) tu animation set da build san. `this.anims` la AnimationManager
   * DUNG CHUNG toan Game (khong rieng theo scene) nen guard `exists()` bat
   * buoc - goi lai nhieu lan qua cac tran/scene KHONG duoc tao trung key.
   */
  // `entityKey` khong dung truc tiep trong than ham (moi clip da tu mang
  // du key/sheetKey) - giu tham so vi chu ky khop cach goi tai create() va
  // de log/mo rong sau nay (vd. gan nhan loi khi generateFrameNumbers rong).
  // Internal (module boundary - combat-animation-playback).
  private registerCombatAnimations(entityKey: string, clips: CombatAnimationCatalogue): void {
    this.animationPlayback.registerCombatAnimations(entityKey, clips)
  }

  /**
   * Map runtime id (PLAYER_ID or enemy id '<templateId>_<uuid>') to the
   * entity key used as animation clip prefix - matches how CombatPreload
   * builds animation sets (player by active profile, enemy by
   * resolveEnemyTextureKey()). Unknown enemies resolve to the shared
   * placeholder entity key; undefined only for actors with no animation
   * set at all - caller must guard before calling sprite.play().
   */
  // Internal (module boundary - combat-animation-playback).
  private entityAnimationKeyPrefix(actorId: string): string | undefined {
    return this.animationPlayback.entityAnimationKeyPrefix(actorId)
  }

  /**
   * Spec B sec3.2 - is this entity's art ANIMATED, or a still image?
   *
   * One question, asked of the catalogue, in the one place that plays clips.
   * A static entity is not a degraded animated one: it has no clips at all, and
   * asking for one is a no-op rather than a fallback.
   */
  // Internal (module boundary - combat-animation-playback).
  private isAnimatedEntity(entityKey: string): boolean {
    return this.animationPlayback.isAnimatedEntity(entityKey)
  }

  /**
   * Phat 1 animation clip cho actor NEU sprite la Sprite that (kind ===
   * 'sprite') VA clip do da duoc registerCombatAnimations() dang ky -
   * no-op an toan cho Rectangle fallback (enemy ngoai batch) hoac clip
   * chua/khong ton tai (test fixture khong stub this.anims day du).
   *
   * Spec B sec3.2 (2026-09-11) - AND the entity's art is animated. Before this,
   * an enemy taking its turn played the 32-frame placeholder, which SWAPPED its
   * texture from its own Mortal PNG to a numbered stick figure for the length of
   * the clip. Enemies are static now; their motion is the bob in
   * `combat-grid-view.ts`.
   */
  // Internal (module boundary - combat-animation-playback).
  playCombatAnimation(
    sprite: EntitySprite,
    actorId: string | undefined,
    name: CombatAnimationName,
  ): void {
    this.animationPlayback.playCombatAnimation(sprite, actorId, name)
  }

  // CombatGridViewHost - kick idle right after sprite creation. No-op for
  // static-mode entities (playCombatAnimation guards on kind); animated-mode
  // entities would otherwise sit on a frozen first frame until their first
  // turn (uniformity, 2026-09-19).
  startEntityIdle(sprite: EntitySprite, id: string): void {
    this.playCombatAnimation(sprite, id, 'idle')
  }

  private clearSceneState() {
    this._skillPlayback?.cancel()
    this._hoaCauPresentation?.destroy()
    this._hoaCauPresentation = undefined
    this._tamMuoiAuraPresentation?.destroy()
    this._tamMuoiAuraPresentation = undefined
    this._skillVfxDriver?.destroy()
    this._skillPlayback = undefined
    this._skillVfxDriver = undefined
    for (const status of this.statuses.values()) {
      status.icon.destroy()
      status.stackLabel.destroy()
    }

    this.statuses.clear()
    this.vfxSpawner.statusTooltip?.hide()
    this.floatedStatusKeys?.clear()

    for (const entry of this.spawnVfxHandles.values()) {
      entry.handle.destroy()
    }

    this.spawnVfxHandles.clear()
    this.entityVisual.clear()

    // Task 9 fix round (Finding 1) - the party countdown telegraph has its
    // own handle map/pending-ids set, separate from spawnVfxHandles above,
    // and was never cleared here. Phaser reuses the Scene instance across
    // stop/restart, so leaving this out let a player who left mid-countdown
    // and re-entered combat carry a leaked handle plus a stale non-zero
    // telegraphShown into the next battle - exactly what telegraph.reset()
    // exists to prevent on a normal countdown-end flush.
    for (const handle of this.turnCountdownSpawnVfxHandles.values()) {
      handle.destroy()
    }

    this.turnCountdownSpawnVfxHandles.clear()
    this.telegraph.reset()

    // 6A-T4/T5 - HUD don khi scene shutdown (battle_end KHONG destroy -
    // chi shutdown moi huy; restart scene tao lai).
    this._playerHud?.destroy()
    this._playerHud = undefined

    this.playerSpawnHandle?.destroy()
    this.playerSpawnHandle = undefined
    this.entityVisual.markPlayerMaterialized()

    this.sprites.clear()
    this.positionInterp.clear()
    this.castBar.clear()
    this.dyingIds.clear()
    this.playerDying = false

    // DoT accumulator (Asec7.2) aEUR" da"n khi scene shutdown.
    this.dotAccumulators?.clear()

    // Reward gourd + caches (plan Asec7.4) aEUR" da"n sao!ch khi scene shutdown;
    // auto-refight (onBattleStart) ca"' A1/2 KHA"NG A'a"JPYng vA o A'Acy A'a"f streams
    // A'AGBP sinh hoA n taoJPYt vA o mia"+ng ha"" lA'.
    this.gourdGraphics?.destroy()

    this.gourdGraphics = undefined

    this.gourdPulseTween?.remove()
    this.gourdPulseTween = undefined

    this.debugAnchorGraphics?.destroy()

    this.debugAnchorGraphics = undefined

    this.lastKnownScreenPositions.clear()
    this.lastKnownGridPositions.clear()

    // Essence stream (2026-08-30) - motes la scene children bi destroy
    // cung display list; bo cache de create() ke dung lai (arrival
    // callback giu nguyen qua closure eventBus).
    this._essenceStream = undefined

    // Scene shutdown A'AfAGBP destroy children cA!A"Aseca display list Aca'!aEUR chA!A" cA!AoAsecn bA!A"
    // tham chiao?u A'a" create() kao? da"+/-ng lao!i sao!ch theo mode hia"+n hA!nh.
    this.arenaRect = undefined
    this.gridGraphics = undefined
    this.backdrop = undefined
    this.projection = undefined
  }

  // Task 8 (perf-optimize-pass phan 2) - logic day du chuyen sang
  // combat/combat-position-interpolation.ts; wrapper giu nguyen chu ky
  // (+ private, vi chi dung noi bo CombatScene) cho cac call site cu.
  private setInterpolationTarget(
    id: string,
    worldX: number,
    cadenceMs?: number,
    snapshotAt?: number,
  ) {
    this.positionInterp.setInterpolationTarget(id, worldX, cadenceMs, snapshotAt)
  }

  private snapInterpolationTarget(id: string, worldX: number, snapshotAt?: number) {
    this.positionInterp.snapInterpolationTarget(id, worldX, snapshotAt)
  }

  private interpolate(entry: PositionInterpolation, now: number): number {
    return this.positionInterp.interpolate(entry, now)
  }

  private getInterpolatedX(id: string): number | undefined {
    return this.positionInterp.getInterpolatedX(id)
  }

  // Internal (module boundary - combat-snapshot-reconcile).
  reconcileEnemySprites(enemies: BattlePositionsEvent['enemies']) {
    this.snapshotReconcile.reconcileEnemySprites(enemies)
  }

  // Internal (module boundary - combat-snapshot-reconcile).
  private onTurnBattleEntitySnapshot(event: TurnBattleEntitySnapshotEvent) {
    this.snapshotReconcile.onTurnBattleEntitySnapshot(event)
  }

  // Internal (module boundary - combat-snapshot-reconcile).
  private reconcileTurnCountdownSpawn(event: TurnBattleEntitySnapshotEvent) {
    this.snapshotReconcile.reconcileTurnCountdownSpawn(event)
  }


  private subscribeCombatEvents() {
    const eventBus = readOptionalGate(this.registry, 'eventBus')

    if (!eventBus) {
      return
    }

    this.eventBus = eventBus
    this.boundHandlers = this.getCombatEventBindings()

    for (const [eventName, handler] of this.boundHandlers) {
      eventBus.on(eventName, handler)
    }

    // Action Playback Task 7 (2026-09-05) - bat presentation mode: turn
    // engine cho Phaser ack qua 3 signal (ready flourish -> impact frame ->
    // VFX tween complete) thay vi resolve instant headless.
    // Remediation Task 1+2 - bridge cung expose token getter; ack tu VFX
    // completion gan token de stale callback bi engine tu choi.
    this.gameManagerRef = readOptionalGate(this.registry, 'gameManager')
  }

  private unsubscribeCombatEvents() {
    if (!this.eventBus) {
      return
    }

    for (const [eventName, handler] of this.boundHandlers) {
      this.eventBus.off(eventName, handler)
    }

    this.boundHandlers = []
    this.eventBus = undefined
    this.gameManagerRef = undefined
  }

  /**
   * Reward stream (plan Asec7) aEUR" BA(c)zier hAot va" MIa"+NG Ha"' LA":
   * - Aia"fm phA!t: chest anchor ca"seca sprite ngua""n a+' screen cache a+' A' grid
   *   cua"'i cA1ng (sprite A'AGBP ba"< da"n vao"n cA3 ngua""n ha"GBPp lA1/2).
   * - Aia"fm hAot LIVE ta"" gourd mouth ma"-i onUpdate: Player teleport gia"-a
   *   tween KHA"NG aoGBPnh hAEdega"Yng qua"1 A'ao!o; resize re-resolve A'Ach ma">i.
   * - TAfng ta"'c na"a sau (quad-in), co scale + xoA!y nha" khi ta">i mia"+ng.
   * - Pulse ha"" lA' AAsNG Ma" T nha"<p ma"-i reward event (ma"'c A'ao!i dia"+n), khA'ng
   *   pulse theo ta""ng mote (Asec6.3).
   */
  private onRewardParticle(event: BattleRewardParticleEvent) {
    // Tinh Hoa Pham The (2026-08-30) - stream tim bay VE NGUOI CHOI thay
    // vi ho lo; mote cuoi hoan tat moi phat 'essence_stream_arrival' de
    // App.vue nap tien do Luyen The. Khong resolve duoc diem phat (sprite
    // nguon da don + cache rong) -> phat arrival NGAY, khong bao gio ket
    // tinh hoa trong bag vi thieu presentation.
    if (event.kind === 'essence') {
      const start = this.resolveRewardSourcePoint(event.sourceId)

      if (start) {
        this.essenceStream.play(start.x, start.y)
      } else {
        this.eventBus?.emit<undefined>('essence_stream_arrival', undefined)
      }

      return
    }

    this.rewardGourd.onRewardParticle(event)
  }

  private _essenceStream?: CombatEssenceStream

  private get essenceStream(): CombatEssenceStream {
    this._essenceStream ??= new CombatEssenceStream(this, () => {
      this.eventBus?.emit<undefined>('essence_stream_arrival', undefined)
    })

    return this._essenceStream
  }

  /**
   * Aia"fm phA!t reward (plan Asec7.1) aEUR" AEdegu tiAan:
   * 1. body anchor ca"seca sprite ngua""n cA2n ta""n tao!i (Player dA1ng catalog
   *    anchor 'chest' ca"seca profile; enemy KHA"NG cA3 catalog anchor nAan
   *    dA1ng A'ia"fm thAcn trung tAnh suy ra ta"" sprite bounds aEUR" audit P0-3,
   *    khA'ng bao gia" A!p Player anchor cho enemy);
   * 2. last-known screen position theo entity ID;
   * 3. A' grid cua"'i cA1ng chiao?u qua projection hia"+n hA nh.
   */
  resolveRewardSourcePoint(sourceId: string): { x: number; y: number } | undefined {
    return this.rewardGourd.resolveRewardSourcePoint(sourceId)
  }

  // Internal (module boundary).
  spriteFor(id: string | undefined): EntitySprite | undefined {
    return id ? this.sprites.get(id) : undefined
  }

  // Combat Grid Rework aEUR" COALESCE: nhia"u event 'positions' A'a""ng ba"(TM) trong
  // 1 frame cha"o/oo gia"- snapshot Ma"sI NHao*T, apply AAsNG Ma" T laosecn trong update().
  // Cadence = khoaoGBPng cA!ch gia"-a 2 SNAPSHOT (lastSnapshotAt), clamp
  // [MIN_SEGMENT_DURATION_MS, MAX_SEGMENT_DURATION_MS].
  // Internal (module boundary - combat-snapshot-reconcile).
  private onPositions(event: BattlePositionsEvent) {
    this.snapshotReconcile.onPositions(event)
  }

  // Internal (module boundary - combat-snapshot-reconcile).
  private applyPendingPositions(event: BattlePositionsEvent) {
    this.snapshotReconcile.applyPendingPositions(event)
  }

  /**
   * Reconcile telegraph spawn ca"seca PLAYER theo SNAPSHOT (plan Asec12.2).
   * Flat mode vao"n chao!y visibility (ao(c)n/hia"+n sprite) nhAEdegng ba" VFX telegraph
   * nhAEdeg enemy spawn.
   */
  reconcilePlayerSpawn(event: BattlePositionsEvent) {
    this.vfxSpawner.reconcilePlayerSpawn(event)
  }

  /**
   * Reconcile telegraph spawn VFX theo SNAPSHOT (khong event tuc thoi):
   * id moi -> tao handle; id con -> cap nhat progress; id MAT -> materialize
   * (flash ngan + fade-in sprite) va don handle. Flat mode bo qua (renderer
   * legacy giu hanh vi cu). Turn-Based Wave Redesign (2026-09-06) - kieu
   * tham so narrow xuong SpawnVfxSnapshot (subset BattlePositionsEvent);
   * turn-based snapshot path goi qua dung delegate nay.
   */
  reconcileSpawnVfx(event: SpawnVfxSnapshot) {
    this.vfxSpawner.reconcileSpawnVfx(event)
  }

  /** Fade-in + scale 0.7a+'1 cho enemy va""a materialize (ma"(TM)t laosecn duy nhaoJPYt). */
  playMaterializeFadeIn(sprite: EntitySprite) {
    this.vfxSpawner.playMaterializeFadeIn(sprite)
  }

  // Traon kao?t thAoc (thao-ng/thua) aEUR" KHA"NG da"n quA!i, KHA"NG snap player va"
  // ca"(TM)t ca"*ng: gia"- va"< trA cua"'i ca"seca player/enemy dAEdega">i overlay kao?t quaoGBP
  // (2026-08-26). KHA"NG ta"+/- ra"i scene a"Y A'Acy aEUR" cha"o/oo 'combat_scene_exit'
  // (CombatResultModal.vue a+' onExit()) ma">i chuya"fn va" MainScene; "AA!nh
  // Lao!i"/auto-refight A'i qua 'battle_start' a+' onBattleStart() reset
  // presentation tao!i cha"-. Via"+c cA2n lao!i a"Y A'Acy: cha"n + load trAEdega">c variant
  // na"n cho traon Kao3/4 TIao3/4P vA  da"n DoT accumulator.
  onBattleEnd() {
    this._hoaCauPresentation?.cancel()
    this._tamMuoiAuraPresentation?.cancel()
    // 6A-T5 - HUD theo doi battle end.
    this._playerHud?.setVisible(false)
    this.inBattle = false

    // DoT accumulator (Asec7.2) aEUR" traon A'AGBP xong, bucket cA(c) khA'ng A'AEdega"GBPc rA2
    // sang text ca"seca traon kao? tiao?p.
    this.dotAccumulators.clear()

    this.prepareThanhVanBackdropForNextBattle()
  }

  playHorizontalImpulse(sprite: EntitySprite, distance: number, duration: number) {
    this.vfxSpawner.playHorizontalImpulse(sprite, distance, duration)
  }

  // NaoGBPy sa"' sA!t thAEdegAE!ng aEUR" dA1ng CHUNG event 'damage' mA  CombatStatusBar.vue
  // A'a"c A'a"f vao1/2 thanh HP (xem ghi chAo DAMAGE_*_COLOR A'aosecu file), nAan sa"'
  // naoGBPy lAan LUA"N kha">p va">i thanh mA!u va""a ha"JPYt, khA'ng la"+ch nha"<p. Chao!y cho
  // CA!AoAc 2 chiA!A"Au Aca'!aEUR target lAfA  quAfA!i (player gAfAcy sAfA!t thA+AdegA+A!ng) hay target lAfA
  // player (quA!i gAcy sA!t thAEdegAE!ng) A'a"u qua A'Aong 1 handler nA y.
  //
  // DoT presentation (combat-skill-flow-element-power-dot-plan.md Asec7) aEUR"
  // tick DoT (event cA3 effectId) KHA"NG hia"+n text ngay: gom vA o
  // accumulator theo khA3a `targetId|effectId|sourceId`, ma"-i 333.33ms
  // flush AAsNG 1 text/khA3a a"Y anchor thaoJPYp hAE!n + depth thaoJPYp hAE!n direct hit.
  private onDamageNumber(event: CombatEvent) {
    this.damageText.handleDamageEvent(event)
  }

  /** Ba"(TM) gom DoT aEUR" khA3a `targetId|effectId|sourceId`, ca"a sa"* 1/3 giAcy. */
  // Internal (module boundary).
  dotAccumulators = new Map<string, { value: number; nextFlushAt: number }>()

  /** Flush cA!c bucket A'AGBP A'ao?n hao!n aEUR" Ma"-I KHA"A A'Aong 1 text (Asec7.2). */
  private flushDueDotTexts() {
    this.damageText.flushDueDotTexts()
  }

  private onVitalsChanged(event: EntityVitalsChangedEvent) {
    const sprite = this.spriteFor(event.entityId)

    if (sprite) {
      this.updateEnemyHealthBar(sprite, event.hpAfter, event.maxHp)
    }

    // 6A-T5 - HUD player (entityId === PLAYER_ID) cap nhat tu vitals.
    if (event.entityId === PLAYER_ID) {
      this.playerHud?.updateHp(event.hpAfter, event.maxHp)

      if (event.maxMp > 0) {
        this.playerHud?.updateMp(event.mpAfter, event.maxMp)
      }
    }
  }

  /**
   * 6A-T5 - exit zone trong canvas click -> bridge sang DOM confirm
   * modal (T6) qua eventBus. KHONG mo modal truc tiep tu scene.
   */
  // NOTE (2026-09-28): intentional seam - no production caller wires a
  // canvas exit-zone click today; the DOM CombatTopBar exit button emits
  // the same 'combat_exit_request' event directly. Keep for a future
  // in-canvas exit affordance; do not call from production UI code.
  requestCombatExit() {
    this.eventBus?.emit('combat_exit_request', undefined)
  }

  // "NaoGBPy sa"'" thaot sa"+/- aEUR" pop-in bao+/-ng Back.easeOut (baot naoGBPy quA! ca"! ra""i
  // co va", khA!c easeOut tuyao?n tAnh ca"seca showFloatingText) ra""i ma">i trA'i
  // lAan/ma" daosecn, tA!ch bia"+t hao3n phaosecn cha"- "ChA Mao!ng!"/"NA(c)!" (showFloatingText)
  // aEUR" jitter ngang nha" A'a"f 2 hia"+u a"(c)ng khA'ng A'A" khAt lAan nhau khi cA1ng
  // 1 A'A2n va""a ChA Mao!ng va""a cA3 sA!t thAEdegAE!ng.
  // Internal (module boundary).
  showDamageNumber(sprite: EntitySprite, value: number, color: string, critical: boolean) {
    this.damageText.showDamageNumber(sprite, value, color, critical)
  }

  /**
   * Format text DoT A'AGBP gom (Asec7.2, tA!ch hA m thuaosecn A'a"f test tra"+/-c tiao?p) aEUR"
   * ta"*ng ao/ooJPY1 lA m trA2n theo formatter hia"+n cA3; sa"' nha" (|x|<1) hia"+n 1 cha"-
   * sa"' thaop phAcn va">i SAEURN 0.1 nAan KHA"NG BAO GIa"oe hia"+n "-0.0" (fix
   * 2026-08-26: trAEdega">c A'Acy 0<x<0.05 render thA nh "-0.0").
   */
  // Internal (module boundary).
  showDotDamageNumber(sprite: EntitySprite, value: number, color: string) {
    this.damageText.showDotDamageNumber(sprite, value, color)
  }

  // Internal (module boundary - combat-action-feedback).
  onCritical(event: CombatScenePayload) {
    this.actionFeedback.onCritical(event)
  }

  // Internal (module boundary - combat-action-feedback).
  onHit(event: CombatScenePayload) {
    this.actionFeedback.onHit(event)
  }

  // Internal (module boundary - combat-action-feedback).
  onDodge(event: CombatScenePayload) {
    this.actionFeedback.onDodge(event)
  }

  positionCastBar(sprite: EntitySprite, castBar: CastBarSprite) {
    this.castBar.positionCastBar(sprite, castBar)
  }

  destroyCastBar(id: string) {
    this.castBar.destroyCastBar(id)
  }

  onDeath(event: CombatScenePayload) {
    this.animationPlayback.onDeath(event)
  }

  /**
   * Combat Art Pipeline Task 9 (2026-09-05) - dung chung boi onDeath() (event
   * 'death' that) va reconcileCombatantSprites() (fallback khi entity mat
   * khoi snapshot ma khong co event rieng): danh dau dying, don DoT/cast bar,
   * phat animation '-death' NEU sprite la Sprite that + clip da dang ky, va
   * HOAN destroy toi khi CA tween xoay/mo CU lan animation (neu co) deu xong
   * - spec sec9: cleanup khong duoc cat ngang animation chet. Khong co
   * animation hop le -> animDone giu true ngay tu dau, hanh vi y het truoc
   * Task 9 (chi cho tween).
   *
   * Player KHONG BAO GIO bi destroy o day (giu vi tri cuoi duoi overlay ket
   * qua, xem onBattleEnd) - chi tween/animation chay, isPlayer chan nhanh
   * destroy trong finalize().
   */
  // Internal (module boundary - combat-animation-playback owns the death
  // sequence; scene delegate kept for reconcile fallback + test seams).
  beginDeathSequence(sprite: EntitySprite, id: string): void {
    this.animationPlayback.beginDeathSequence(sprite, id)
  }

  // Traon ma">i bao-t A'aosecu TRONG LAsC scene nA y vao"n A'ang active (Auto-refight
  // sau victory/defeat, xem CombatVictoryPanel.vue aEUR" KHA"NG A'i qua
  // MainScene) hoao*c laosecn A'aosecu vA o Combat Scene (create() A'AGBP ta"+/- da"+/-ng
  // player, hA m nA y reset lao!i va" A'Aong trao!ng thA!i ban A'aosecu cho chao-c,
  // no-op nao?u A'AGBP sao!ch saoun).
  onBattleStart(options?: { rebind?: boolean }) {
    this._skillPlayback?.cancel()
    this._hoaCauPresentation?.cancel()
    this._tamMuoiAuraPresentation?.cancel()
    // 'rebind' = in-place reattach to the SAME battle/session: the
    // driver's per-action camera latch survives so a 'complete'-phase
    // resume cannot refire an already-fired camera impulse. Anything else
    // is a new battle and gets the full reset.
    this._skillVfxDriver?.reset(options?.rebind ? 'rebind' : 'battle')
    this.inBattle = true

    // 6A-T5 - HUD hien khi vao tran.
    this._playerHud?.setVisible(true)

    // VA2ng A'a"i background (2026-08-26): traon ma">i bao-t A'aosecu aEUR" Ha"|Y ma"i laosecn
    // load backdrop cA2n treo ca"seca battle_end trAEdega">c (generation cA(c)) A'a"f
    // callback khA'ng swap gia"-a traon; na"n hia"+n tao!i gia"- nguyAan ta">i
    // battle_end Kao3/4 TIao3/4P.
    this.backdropGeneration++

    // DoT accumulator (Asec7.2) aEUR" traon ma">i, da"n bucket cA(c).
    this.dotAccumulators.clear()

    // Audit fix 2026-08-31 - status VFX icons cua tran truoc (DoT con tick khi
    // battle end, khong co status_vfx_removed event) khong duoc don o day tung
    // khien icon cu dong bang tren man qua auto-refight trong cung scene.
    for (const status of this.statuses.values()) {
      status.icon.destroy()
      status.stackLabel.destroy()
    }

    this.statuses.clear()
    this.vfxSpawner.statusTooltip?.hide()
    this.floatedStatusKeys?.clear()

    // A new battle resurrects the player: clear the dying flag BEFORE the
    // idle replay below - playCombatAnimation gates on playerDying so death
    // owns the channel, and without this ordering the restart replay is
    // swallowed by that very guard.
    this.playerDying = false

    const player = this.sprites.get(PLAYER_ID)

    if (player) {
      this.resetVisual(player)

      // resetVisual restores transform/alpha but not animation state - a
      // death clip frozen on its last frame would carry into the new
      // battle. Replay the default state the same way create() does.
      this.playCombatAnimation(player, PLAYER_ID, 'idle')

      // Traon ma">i = Player lao!i A'i qua telegraph spawn (plan Asec12.2): ao(c)n
      // sprite ta">i khi snapshot bA!o materialize, snap va" ca"(TM)t ca"*ng.
      this.entityVisual.hidePlayer(player)

      this.snapInterpolationTarget(PLAYER_ID, HERO_COLUMN)
      this.positionSprite(player, HERO_COLUMN)
    }

    // Scene restart / same-scene refight - clean stale Player spawn VFX.
    this.playerSpawnHandle?.destroy()
    this.playerSpawnHandle = undefined

    // Auto-repeat/traon ma">i trong cA1ng scene aEUR" da"n telegraph cA(c) (snapshot
    // ma">i ca"seca battle kao? sao1/2 tao!o handle sao!ch theo pendingEnemySpawns ma">i).
    for (const entry of this.spawnVfxHandles.values()) {
      entry.handle.destroy()
    }

    this.spawnVfxHandles.clear()
    this.entityVisual.clear()

    // QA 2026-09-10 Task 9 follow-up (R14.4 guard): the party countdown
    // telegraph handle map was NOT cleared here - the old reasoning relied
    // on the turn engine always publishing a flush snapshot before combat
    // proper, a cross-system invariant enforced nowhere. A forced start
    // that skips that snapshot would carry a leaked handle and stale
    // telegraph progress into the new battle. Clear it here, same as
    // shutdown does.
    for (const handle of this.turnCountdownSpawnVfxHandles.values()) {
      handle.destroy()
    }

    this.turnCountdownSpawnVfxHandles.clear()
    this.telegraph.reset()

    for (const [id, sprite] of this.sprites) {
      if (id === PLAYER_ID) {
        continue
      }

      this.destroyEntitySprite(sprite)
      this.sprites.delete(id)
      this.positionInterp.delete(id)
    }

    this.dyingIds.clear()

    this.castBar.clear()
  }

  /**
   * Rebinds an active CombatScene to a new domain session without destroying the scene or Game.
   * Resets visual state, reconciles with the session's initial snapshot, and reports READY.
   */
  rebindSession(context: { transitionId: number; sessionId?: number; gameGeneration: number }): void {
    // Same-session rebind = renderer reattach to the live battle (session
    // ids are minted per battle launch); a different session means a new
    // battle arrived over the same scene and the reset is a battle start.
    // Latent coupling (documented, not fixed): both this sessionId check and
    // the driver's skill-request-N camera latch key on counters monotonic
    // only within one GameManager lifetime - a GameManager swap under a live
    // CombatScene would restart both sequences and realign these guards.
    const isSameSessionRebind =
      context.sessionId !== undefined && context.sessionId === this.initSessionId

    this.initTransitionId = context.transitionId
    this.initSessionId = context.sessionId
    this.initGameGeneration = context.gameGeneration

    this.onBattleStart({ rebind: isSameSessionRebind })

    const gameManager = readOptionalGate(this.registry, 'gameManager')

    if (context.sessionId && gameManager?.getCombatPresentationSnapshot) {
      const snapshot = gameManager.getCombatPresentationSnapshot(context.sessionId)
      if (snapshot) {
        this.onTurnBattleEntitySnapshot(snapshot.entities)
      }
    }

    const adapter = readOptionalGate(this.registry, 'sceneAdapter')
    adapter?.reportReady(context)

    this.applyResumePlayback(gameManager?.preparePresentationResume?.())
  }

  private applyResumePlayback(resume: ResumePlayback | null | undefined): void {
    if (!resume) {
      return
    }

    if (resume.phase === 'ready') {
      this.onTurnReady({ actorId: resume.actorId })
    } else if (resume.phase === 'cast') {
      // The cast fact is the whole resume (impact-sync): the fresh token
      // inside cast.ref drives admission, the same requestId keeps action
      // latches aligned, and startCastPlayback resolves the same clip the
      // live emit did - one domain impact either way.
      this.onSkillCast(resume.cast)
    } else if (resume.phase === 'complete') {
      const port = this.gameManagerRef
      if (port) this.skillPlayback.resumeResolved(resume.resolved, port)
    }
    // 'manual' intentionally falls through: a parked manual choice has no
    // renderer ack phase to replay - awaitedManualActor and the
    // AWAITING_INPUT token still hold the turn engine-side, and the choice
    // affordance re-derives from isAwaitingManualTurnChoice()/submitTurnChoice.
  }

  /**
   * Action Playback Task 7 (2026-09-05) - 'turn_ready': short flash/pulse
   * tren sprite actor roi acknowledgeTurnReady() trong onComplete (5-phase
   * machine buoc 1 -> 2). Placeholder visual don gian theo plan (khong
   * designed visual - polish sau).
   */
  // Internal (module boundary - combat-action-feedback).
  private onTurnReady(event: { actorId: string }) {
    this.actionFeedback.onTurnReady(event)
  }

  /**
   * Action Playback Task 7 (2026-09-05) - 'turn_standby_complete': tail
   * event (completeAction DA chay truoc khi event toi) - presentation-only
   * bookkeeping, KHONG ack gi (khong con wait-gate).
   */
  // Internal (module boundary - combat-action-feedback).
  private onTurnStandbyComplete(event: { actorId: string }) {
    this.actionFeedback.onTurnStandbyComplete(event)
  }

  /**
   * Depth la">p upright cho impact tao!i anchorCell: cA1ng ha"+ va">i entity sprite
   * (foot Y) + bias nha" a+' effect A'A" A'Aong target ca"seca nA3 nhAEdegng vao"n ba"<
   * entity hA ng Gao|N camera che (occlusion 2.5D). Flat mode gia"- la">p
   * upright ca"' A'a"<nh nhAEdeg renderer cA(c).
   */
  resolveUprightVfxDepth(anchorCell: GridPosition): number {
    return this.vfxSpawner.resolveUprightVfxDepth(anchorCell)
  }

  // Buff bar (2026-09-02) - floating text ten hieu ung CHI lan dau
  // attach theo (targetId:buffId) - 2 nguon cung buff id chi floating 1
  // lan; stack tang khong floating lai. Clear o 2 cleanup sites.
  // Internal (module boundary - combat-action-feedback owns attach-float dedup).
  floatedStatusKeys = new Set<string>()

  // Internal (module boundary - combat-action-feedback).
  private onStatusAttached(event: StatusVfxAttachedEvent) {
    this.actionFeedback.onStatusAttached(event)
  }

  private onStatusUpdated(event: StatusVfxUpdatedEvent) {
    this.vfxSpawner.onStatusUpdated(event)
  }

  private onStatusRemoved(event: StatusVfxRemovedEvent) {
    this.vfxSpawner.onStatusRemoved(event)
  }

  // Canonical-seals S5.3 -- observational reaction payoff: float the
  // reaction's display name over the reaction target. Presentation only
  // (the event is a drained journal entry, never an input).
  private onReactionResolved(event: ReactionVfxResolvedEvent) {
    const sprite = this.spriteFor(event.targetId)

    if (!sprite) {
      return
    }

    this.showFloatingText(
      sprite,
      REACTION_DISPLAY_NAMES[event.reactionId] ?? event.reactionId,
      event.relation === 'sinh' ? '#7ee787' : '#ff9d5c',
    )
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
   * VA2ng A'a"i background ma">i (2026-08-26) aEUR" ga"i DUY NHao*T tao!i battle_end:
   * cha"n ngao"u nhiAan variant Kao3/4 TIao3/4P khA!c variant hia"+n tao!i (selectNext
   * trA!nh trA1ng ta""ng chia"u), load thiao?u asset NGAY LAsC overlay kao?t quaoGBP
   * A'ang hia"+n ra""i swap nguyAan kha"'i aEUR" khA'ng flash, khA'ng A'a"JPYng na"n trong
   * lAoc traon cA2n/A'ang A'A!nh lao!i.
   *
   * - Load xong TRAE-a"sC traon kao?: swap ngay (an toA n aEUR" battle A'AGBP hao?t).
   * - Traon ma">i bao-t A'aosecu TRAE-a"sC khi load xong: generation token cA(c) ba"< vA'
   *   hia"+u (onBattleStart++), KHA"NG swap gia"-a traon; na"n hia"+n tao!i gia"-
   *   nguyAan ta">i battle_end kao? tiao?p.
   */
  private prepareThanhVanBackdropForNextBattle() {
    // Flat mode khA'ng cA3 art backdrop A'a"f swap; scene stub/test thiao?u
    // loader cA(c)ng ba" qua an toA n.
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
      this.load.image(entry.key, resolveAssetUrl(entry.url))
    }

    const generation = ++this.backdropGeneration

    // Guard scene chao?t gia"-a lAoc taoGBPi: handler kia"fm tra scene cA2n active.
    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      if (!this.scene || !this.sys.isActive()) {
        return
      }

      // Cha"o/oo laosecn yAau caosecu Ma"sI NHao*T A'AEdega"GBPc swap, vA  cha"o/oo khi chAEdega cA3 traon ma">i
      // (onBattleStart A'AGBP tAfng token).
      if (generation === this.backdropGeneration && !this.inBattle) {
        this.swapThanhVanBackdrop(desired)
      }
    })

    this.load.start()
  }

  /** Hua"* backdrop Thanh VAcn hia"+n hA nh vA  da"+/-ng lao!i ta"" texture A'AGBP load. */
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

    // Grid lines A'AGBP tao-t khi dA1ng art backdrop aEUR" ga"i lao!i cho chao-c (khA'ng
    // vao1/2 gA! khi usingArtBackdrop=true).
    this.redrawGridLines()
  }
}
