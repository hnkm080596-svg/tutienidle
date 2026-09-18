// TranPhapCombatPreviewScene (Battlefield Slot spec, 2026-09-06) — thay
// TranPhapPreviewScene (2026-09-06, formation combat preview tooling):
// scene Phaser RIÊNG (Phaser.Game riêng, TextureManager riêng — không có
// nguy cơ đụng key dù dùng lại ĐÚNG PLACEHOLDER_SHEET_KEY), nhưng giờ
// implements CombatGridViewHost và dùng ĐÚNG CombatGridView mà combat
// thật dùng (spec §4) — thay vì tự viết lại logic sprite/animation. Vẽ
// lưới 3x3 standing-slot ở 2.5D perspective (isPerspective: true —
// Battlefield Perspective Panel 2026-09-06) + 2 lớp nền sky/ground cho
// art thật sau này. Tương tác kéo-thả KHÔNG nằm ở đây — canvas này thuần
// hiển thị, overlay HTML trong suốt (TranPhapPanel.vue, không đổi) mới là
// drop target thật.
// Standing-slot rework (2026-09-07): grid resolution reads the shared
// STANDING_SLOT_COUNT (3) from BattlefieldRegions — single source of
// truth shared with FormationPlacement/EnemySpawnPlacement. Removed:
// PREVIEW_CELL_SIZE, PREVIEW_GRID_SIZE, previewCellTopLeft() (dead code).
import Phaser from 'phaser'
import {
  animatedCombatEntities,
  PLACEHOLDER_SHEET_KEY,
  PLACEHOLDER_STATIC_TEXTURE_KEY,
  PLACEHOLDER_STATIC_TEXTURE_URL,
  presentationFor,
  resolveCombatEntityKey,
} from '@/presentation/art/CombatPresentationCatalogue'
import { combatAnimationKey } from '@/presentation/art/CombatEntityPresentation'
import { ENTITY_ART_MODE } from '@/presentation/art/EntityArtMode'
import { registerClipCatalogue } from './combat/combat-animation-playback'
import { PLAYER_VISUAL_PROFILES, type PlayerVisualProfile } from '@/presentation/art/PlayerVisualProfiles'
import type { PlayerVisualProfileId } from '@/core/player/PlayerVisualForm'
import type { FormationAssignmentsPayload } from '@/presentation/contracts/regionEvents'
import { PLAYER_ID } from './combat/combatConstants'
import type { BattleGridProjection } from '@/presentation/geometry/BattleGridProjection'
import { STANDING_SLOT_COUNT } from '@/core/battle/BattlefieldRegions'
import type { FormationSlotAssignment } from '@/core/player/Player'
import type { LaneIndex } from '@/core/battle/BattleLane'
import { CombatGridView } from './combat/combat-grid-view'
import type { CombatGridViewHost } from './combat/CombatGridViewHost'
import type { EntitySprite } from './combat/combatTypes'
import { FORMATION_ASSIGNMENTS_EVENT } from '@/presentation/contracts/regionEvents'
import {
  createFormationProjection,
  formationPerspectiveGeometry,
  FORMATION_CANVAS_HEIGHT,
  FORMATION_CANVAS_WIDTH,
  FORMATION_MIN_ROAD_HEIGHT,
} from '@/presentation/geometry/FormationCanvasSpec'

// Canvas size has ONE owner now (V9): FormationCanvasSpec, under
// presentation/geometry. It used to be declared here and again in
// TranPhapPanel.vue, kept in sync by a comment -- which is not a mechanism.
// Re-exported under the old local names so every use site below reads the
// same as before.
export const PANEL_WIDTH = FORMATION_CANVAS_WIDTH
export const PANEL_HEIGHT = FORMATION_CANVAS_HEIGHT
// Re-exported for existing consumers; the value's owner is FormationCanvasSpec.
export const PERSPECTIVE_MIN_ROAD_HEIGHT_PANEL = FORMATION_MIN_ROAD_HEIGHT

const PANEL_SKY_COLOR = 0x22283a
const PANEL_GROUND_COLOR = 0x1a1a1a

export class TranPhapCombatPreviewScene extends Phaser.Scene implements CombatGridViewHost {
  // Battlefield Perspective Panel (2026-09-06) — chuyển từ flat sang
  // perspective; combat-grid-view.ts's applySpriteSize()/positionSprite()
  // tự rẽ nhánh áp dụng applyEntityDepthScale() khi cờ này true (đã build
  // sẵn từ Part 1, không cần sửa gì thêm ở 2 hàm đó).
  readonly isPerspective = true
  projection: BattleGridProjection | undefined
  gridGraphics: Phaser.GameObjects.Graphics | undefined
  readonly usingArtBackdrop = false
  // arenaRect luôn undefined ở panel (chỉ combat thật's flat mode dùng nó
  // để CombatGridView.redrawGridLines() phân biệt flat/perspective qua
  // Boolean(this.host.arenaRect) — panel LUÔN perspective nên giữ
  // undefined là đúng, KHÔNG gán Rectangle nào vào field này).
  arenaRect: Phaser.GameObjects.Rectangle | undefined
  private skyLayer: Phaser.GameObjects.Rectangle | undefined
  private groundLayer: Phaser.GameObjects.Rectangle | undefined
  // 0.8 x cell -- reproduces the sprite/cell ratio of the pre-perspective
  // scene (setDisplaySize(cell * 0.8, cell * 0.8)); cell size now comes
  // from the projection at STANDING_SLOT_COUNT resolution, not a fixed
  // PREVIEW_CELL_SIZE constant.
  characterWidth = (PANEL_WIDTH / STANDING_SLOT_COUNT) * 0.8
  characterHeight = (PANEL_WIDTH / STANDING_SLOT_COUNT) * 0.8
  // Không dùng khi isPerspective=false (applySpriteSize() nhánh flat đọc
  // characterWidth/Height trực tiếp) — giữ 1:1 để tránh chia 0 nếu code
  // sau này lỡ đọc tới.
  // The authored box of the placeholder atlas every combatant in this panel
  // draws. Was `{ w: 1, h: 1 }` — a square, which forced a 1.0 aspect onto art
  // authored at 200x350 and rendered every figure ~1.8x too wide. Same class of
  // defect as the player's in `combat-grid-view.ts`, found by the same
  // measurement on 2026-09-11: what a sprite DRAWS and what SIZES it had drifted
  // apart.
  // The player's visual form is DERIVED from the entity (player store getter
  // `visualProfileId` -> payload below), not hardcoded — the same id CombatScene
  // receives through the registry gate. `mortal` is only the pre-payload
  // default; syncAssignments() updates it on every assignments event.
  private currentProfileId: PlayerVisualProfileId = 'mortal'

  private activeProfile(): PlayerVisualProfile {
    return PLAYER_VISUAL_PROFILES[this.currentProfileId] ?? PLAYER_VISUAL_PROFILES.mortal
  }

  get playerSourceSize(): { w: number; h: number } {
    return { ...this.activeProfile().combatSourceSize }
  }

  get playerProfile(): { combatTextureKey: string } {
    return this.activeProfile()
  }
  sprites = new Map<string, EntitySprite>()
  entityFootMinY = 0
  entityFootMaxY = 1
  // resetVisual() không dùng ở panel — Map rỗng thoả type, .get() luôn
  // undefined (đã guard sẵn trong CombatGridView.resetVisual()).
  readonly interpolations = new Map<string, unknown>()

  private gridView!: CombatGridView

  constructor() {
    super('TranPhapCombatPreviewScene')
  }

  fallbackSpriteTextureKey(_id: string): string | undefined {
    // Double-fallback only: the catalogue's placeholder entry is what an
    // unregistered combatant resolves to; this fires only if THAT texture
    // failed to load. Same kind as the active mode, so even the last-resort
    // draw cannot mix static and animated art (uniformity, 2026-09-19).
    return ENTITY_ART_MODE === 'animated' ? PLACEHOLDER_SHEET_KEY : PLACEHOLDER_STATIC_TEXTURE_KEY
  }

  preload(): void {
    if (ENTITY_ART_MODE === 'animated') {
      // Every animated entity's sheet - panel combatants resolve through the
      // same catalogue CombatScene uses, so the same asset set covers them.
      // Dedupe by sheetKey: several entities share the placeholder atlas.
      const queued = new Set<string>()

      for (const { clips } of animatedCombatEntities()) {
        for (const clip of Object.values(clips)) {
          if (queued.has(clip.sheetKey)) {
            continue
          }

          queued.add(clip.sheetKey)
          this.load.atlas(clip.sheetKey, clip.sheetUrl, clip.atlasUrl)
        }
      }

      return
    }

    // Static mode - the placeholder silhouette plus every profile's combat
    // PNG (same source CombatScene's bundle queues).
    this.load.image(PLACEHOLDER_STATIC_TEXTURE_KEY, PLACEHOLDER_STATIC_TEXTURE_URL)

    for (const profile of Object.values(PLAYER_VISUAL_PROFILES)) {
      if (!this.textures.exists(profile.combatTextureKey)) {
        this.load.image(profile.combatTextureKey, profile.combatTextureUrl.replace(/^\/+/, ''))
      }
    }
  }

  create(): void {
    this.gridView = new CombatGridView(this)

    // V10 / §3.6 surface two: the shell addresses the REGION, not this object.
    // Subscribing here rather than exposing a method means the shell can send
    // what this file names and nothing else. Unsubscribed on shutdown, because
    // the emitter is the Game's and outlives a scene restart.
    this.game.events.on(FORMATION_ASSIGNMENTS_EVENT, this.assignmentsHandler)
    this.events.once('shutdown', () => {
      this.game.events.off(FORMATION_ASSIGNMENTS_EVENT, this.assignmentsHandler)
    })

    const geometry = formationPerspectiveGeometry()

    // 2 lớp nền phẳng (sky/ground) — KHÔNG dùng attachBattlefieldBackdrop()
    // của combat thật (sao/trăng/núi/đá quá cầu kỳ cho panel test, và
    // cũng hardcode GRID_ROW_COUNT/COLUMN_COUNT). Đặt tên rõ ràng để sau
    // này thay Rectangle bằng Image thật chỉ cần đổi loại GameObject, giữ
    // nguyên vị trí gọi.
    this.skyLayer = this.add.rectangle(0, 0, PANEL_WIDTH, geometry.horizonY, PANEL_SKY_COLOR).setOrigin(0, 0)
    this.groundLayer = this.add
      .rectangle(0, geometry.horizonY, PANEL_WIDTH, geometry.roadHeight, PANEL_GROUND_COLOR)
      .setOrigin(0, 0)

    // Same factory the shell calls (FormationCanvasSpec) — the five parameters
    // are declared once and neither layer restates them (§3.6.2).
    this.projection = createFormationProjection()
    this.gridGraphics = this.add.graphics()
    this.gridView.redrawGridLines()

    // Animated mode only: register every entity's clip set so startEntityIdle
    // can play `<entityKey>-idle` - same keys CombatScene would build, via the
    // shared helper (uniformity, 2026-09-19). Static mode registers nothing.
    if (ENTITY_ART_MODE === 'animated') {
      for (const { clips } of animatedCombatEntities()) {
        registerClipCatalogue(this.anims, clips)
      }
    }

  }

  /**
   * CombatGridViewHost - kick the entity's idle loop right after creation.
   * Resolves the SAME entity key the playback layer would (player -> profile
   * texture key, everything else -> enemy resolution or the placeholder) and
   * plays only when that entity is animated; static-mode entities get their
   * motion from the idle bob, exactly like combat (uniformity, 2026-09-19).
   */
  startEntityIdle(sprite: EntitySprite, id: string): void {
    if (sprite.kind !== 'sprite') {
      return
    }

    const entityKey =
      id === PLAYER_ID
        ? this.playerProfile.combatTextureKey
        : resolveCombatEntityKey(id)

    if (presentationFor(entityKey)?.kind !== 'animated') {
      return
    }

    const key = combatAnimationKey(entityKey, 'idle')

    if (this.anims.exists(key)) {
      ;(sprite.rect as Phaser.GameObjects.Sprite).play(key)
    }
  }

  /**
   * Diff theo combatantId qua chính CombatGridView.getOrCreateSprite() —
   * KHÔNG tự viết lại logic tạo/xoá sprite: entity còn trong assignment
   * mới → getOrCreateSprite() no-op nếu id đã có trong this.sprites (chỉ
   * reposition), animation KHÔNG bị ngắt/reset (đây chính là fix cho bug
   * "animation reset về 0 mỗi lần kéo-thả 1 entity", 2026-09-06); entity
   * biến mất → destroyEntitySprite() qua CombatGridView; entity mới xuất
   * hiện → getOrCreateSprite() tạo sprite mới, play() từ frame 0 (đúng —
   * chưa từng animate trong panel này).
   */
  private readonly assignmentsHandler = (
    payload: FormationSlotAssignment[] | FormationAssignmentsPayload,
  ) => this.syncAssignments(payload)

  syncAssignments(payload: FormationSlotAssignment[] | FormationAssignmentsPayload): void {
    // Phaser event payloads are untyped at runtime — accept the current
    // snapshot shape and the legacy bare array, ignore anything else.
    let assignments: FormationSlotAssignment[]
    let profileId: PlayerVisualProfileId | undefined

    if (Array.isArray(payload)) {
      assignments = payload
    } else if (payload && Array.isArray(payload.assignments)) {
      assignments = payload.assignments
      profileId = payload.playerProfileId
    } else {
      return
    }

    if (profileId && PLAYER_VISUAL_PROFILES[profileId]) {
      this.currentProfileId = profileId
    }

    const nextIds = new Set(assignments.map((a) => a.combatantId))

    for (const [id, sprite] of this.sprites) {
      if (!nextIds.has(id)) {
        this.gridView.destroyEntitySprite(sprite)
        this.sprites.delete(id)
      }
    }

    for (const assignment of assignments) {
      // The player's visual form can change while the panel is open (the
      // panel re-dispatches on player.visualProfileId changes). Rebuild the
      // sprite so it picks up the new profile PNG — same outcome as
      // CombatScene.applyPlayerVisualProfile's setTexture + re-size.
      if (assignment.combatantId === PLAYER_ID) {
        const existing = this.sprites.get(PLAYER_ID)

        // What the player sprite SHOULD be drawing right now, mode-aware:
        // the profile PNG in static mode, the idle sheet in animated mode
        // (comparing against combatTextureKey there would rebuild the sprite
        // on EVERY sync - its texture is the atlas, not the PNG).
        const presentation = presentationFor(this.playerProfile.combatTextureKey)
        const expectedTextureKey =
          presentation?.kind === 'animated'
            ? presentation.clips.idle.sheetKey
            : this.playerProfile.combatTextureKey

        if (
          existing &&
          existing.kind === 'sprite' &&
          (existing.rect as Phaser.GameObjects.Sprite).texture.key !== expectedTextureKey
        ) {
          this.gridView.destroyEntitySprite(existing)
          this.sprites.delete(PLAYER_ID)
        }
      }

      const sprite = this.gridView.getOrCreateSprite(
        assignment.combatantId,
        0x4caf50,
        assignment.combatantId,
        assignment.row as LaneIndex,
      )

      // Cell->cell drags reuse the existing sprite: getOrCreateSprite's
      // early-return keeps the ORIGINAL row, and positionSprite projects
      // gridToScreen(sprite.row, column) — refresh it or the unit draws in
      // its old cell while the DOM grid shows the new one.
      sprite.row = assignment.row as LaneIndex

      this.gridView.positionSprite(sprite, assignment.column)
    }
  }
}
