// TranPhapCombatPreviewScene (Battlefield Slot spec, 2026-09-06) - thay
// TranPhapPreviewScene (2026-09-06, formation combat preview tooling):
// scene Phaser RIENG (Phaser.Game rieng, TextureManager rieng - khong co
// nguy co dung key du dung lai DUNG PLACEHOLDER_SHEET_KEY), nhung gio
// implements CombatGridViewHost va dung DUNG CombatGridView ma combat
// that dung (spec sec4) - thay vi tu viet lai logic sprite/animation. Ve
// luoi 3x3 standing-slot o 2.5D perspective (isPerspective: true -
// Battlefield Perspective Panel 2026-09-06) + 2 lop nen sky/ground cho
// art that sau nay. Tuong tac keo-tha KHONG nam o day - canvas nay thuan
// hien thi, overlay HTML trong suot (TranPhapPanel.vue, khong doi) moi la
// drop target that.
// Standing-slot rework (2026-09-07): grid resolution reads the shared
// STANDING_SLOT_COUNT (3) from BattlefieldRegions - single source of
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
  resolvePlayerEntityKey,
  staticArtFormFor,
} from '@/presentation/art/CombatPresentationCatalogue'
import { MONSTER_ART } from '@/game/support/MonsterArt'
import { CHARACTER_ART } from '@/game/support/CharacterArt'
import { atlasClipsOf, combatAnimationKey } from '@/presentation/art/CombatEntityPresentation'
import { ENTITY_ART_MODE } from '@/presentation/art/EntityArtMode'
import { registerClipCatalogue } from './combat/combat-animation-playback'
import { PLAYER_VISUAL_PROFILES, type PlayerVisualProfile } from '@/presentation/art/PlayerVisualProfiles'
import type { PlayerVisualProfileId } from '@/core/player/PlayerVisualForm'
import type { FormationAssignmentsPayload } from '@/presentation/contracts/regionEvents'
import { PLAYER_ID } from './combat/combatConstants'
import { PLAYER_TEXTURE_KEY } from '@/game/support/CombatPreload'
import type { BattleGridProjection } from '@/presentation/geometry/BattleGridProjection'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
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

const PANEL_SKY_COLOR = 0xe8dbc0
const PANEL_GROUND_COLOR = 0xd6c6a0

export class TranPhapCombatPreviewScene extends Phaser.Scene implements CombatGridViewHost {
  // Battlefield Perspective Panel (2026-09-06) - chuyen tu flat sang
  // perspective; combat-grid-view.ts's applySpriteSize()/positionSprite()
  // tu re nhanh ap dung applyEntityDepthScale() khi co nay true (da build
  // san tu Part 1, khong can sua gi them o 2 ham do).
  readonly isPerspective = true
  projection: BattleGridProjection | undefined
  gridGraphics: Phaser.GameObjects.Graphics | undefined
  readonly usingArtBackdrop = false
  // arenaRect luon undefined o panel (chi combat that's flat mode dung no
  // de CombatGridView.redrawGridLines() phan biet flat/perspective qua
  // Boolean(this.host.arenaRect) - panel LUON perspective nen giu
  // undefined la dung, KHONG gan Rectangle nao vao field nay).
  arenaRect: Phaser.GameObjects.Rectangle | undefined
  private skyLayer: Phaser.GameObjects.Rectangle | undefined
  private groundLayer: Phaser.GameObjects.Rectangle | undefined
  // 0.8 x cell -- reproduces the sprite/cell ratio of the pre-perspective
  // scene (setDisplaySize(cell * 0.8, cell * 0.8)); cell size now comes
  // from the projection at STANDING_SLOT_COUNT resolution, not a fixed
  // PREVIEW_CELL_SIZE constant.
  characterWidth = (PANEL_WIDTH / STANDING_SLOT_COUNT) * 0.8
  characterHeight = (PANEL_WIDTH / STANDING_SLOT_COUNT) * 0.8
  // Khong dung khi isPerspective=false (applySpriteSize() nhanh flat doc
  // characterWidth/Height truc tiep) - giu 1:1 de tranh chia 0 neu code
  // sau nay lo doc toi.
  // The authored box of the placeholder atlas every combatant in this panel
  // draws. Was `{ w: 1, h: 1 }` - a square, which forced a 1.0 aspect onto art
  // authored at 200x350 and rendered every figure ~1.8x too wide. Same class of
  // defect as the player's in `combat-grid-view.ts`, found by the same
  // measurement on 2026-09-11: what a sprite DRAWS and what SIZES it had drifted
  // apart.
  // The player's visual form is DERIVED from the entity (player store getter
  // `visualProfileId` -> payload below), not hardcoded - the same id CombatScene
  // receives through the registry gate. `mortal` is only the pre-payload
  // default; syncAssignments() updates it on every assignments event.
  private currentProfileId: PlayerVisualProfileId = 'mortal'
  // Armed pick rides the same assignments payload (art-seam wave): the
  // panel must not rebuild the sprite on the wrong variant after a
  // basic-skill change. Undefined keeps the armed resolver default.
  private currentArmed: boolean | undefined

  private activeProfile(): PlayerVisualProfile {
    return PLAYER_VISUAL_PROFILES[this.currentProfileId] ?? PLAYER_VISUAL_PROFILES.mortal
  }

  get playerArmed(): boolean | undefined {
    return this.currentArmed
  }

  get playerSourceSize(): { w: number; h: number } {
    return { ...this.activeProfile().combatSourceSize }
  }

  get playerProfile(): { id: string; combatTextureKey: string } {
    return this.activeProfile()
  }
  sprites = new Map<string, EntitySprite>()
  entityFootMinY = 0
  entityFootMaxY = 1
  // resetVisual() khong dung o panel - Map rong thoa type, .get() luon
  // undefined (da guard san trong CombatGridView.resetVisual()).
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
        for (const clip of atlasClipsOf(clips)) {
          if (queued.has(clip.sheetKey)) {
            continue
          }

          queued.add(clip.sheetKey)
          this.load.atlas(clip.sheetKey, resolveAssetUrl(clip.sheetUrl), resolveAssetUrl(clip.atlasUrl))
        }
      }

      return
    }

    // Static mode - the placeholder silhouette plus every profile's combat
    // PNG (same source CombatScene's bundle queues).
    this.load.image(PLACEHOLDER_STATIC_TEXTURE_KEY, resolveAssetUrl(PLACEHOLDER_STATIC_TEXTURE_URL))

    for (const profile of Object.values(PLAYER_VISUAL_PROFILES)) {
      if (!this.textures.exists(profile.combatTextureKey)) {
        this.load.image(profile.combatTextureKey, resolveAssetUrl(profile.combatTextureUrl))
      }
    }

    // Character reskin sheets (character-art-infra): the panel only shows
    // party combatants and the player is always one, so its atlas is needed
    // here even under the static global mode (per-entity animated override).
    // Monster sheets stay combat-only - a reskinned enemy in this panel falls
    // back to its avatar via the atlas-miss branch (loaded below).
    const characterSheets = new Set<string>()

    for (const variant of Object.values(CHARACTER_ART)) {
      for (const range of [
        ...Object.values(variant.clips),
        ...Object.values(variant.castClips ?? {}),
      ]) {
        if (range === undefined || characterSheets.has(range.sheetKey) || this.textures.exists(range.sheetKey)) {
          continue
        }

        characterSheets.add(range.sheetKey)
        this.load.atlas(range.sheetKey, resolveAssetUrl(range.sheetUrl), resolveAssetUrl(range.atlasUrl))
      }
    }

    // Reskin avatar fallbacks - the static form CombatGridView draws on an
    // atlas miss, for both registries.
    for (const variant of [...Object.values(MONSTER_ART), ...Object.values(CHARACTER_ART)]) {
      if (!this.textures.exists(variant.avatarKey)) {
        this.load.image(variant.avatarKey, resolveAssetUrl(variant.avatarUrl))
      }
    }
  }

  create(): void {
    this.gridView = new CombatGridView(this)

    // V10 / sec3.6 surface two: the shell addresses the REGION, not this object.
    // Subscribing here rather than exposing a method means the shell can send
    // what this file names and nothing else. Unsubscribed on shutdown, because
    // the emitter is the Game's and outlives a scene restart.
    this.game.events.on(FORMATION_ASSIGNMENTS_EVENT, this.assignmentsHandler)
    this.events.once('shutdown', () => {
      this.game.events.off(FORMATION_ASSIGNMENTS_EVENT, this.assignmentsHandler)
    })

    const geometry = formationPerspectiveGeometry()

    // 2 lop nen phang (sky/ground) - KHONG dung attachBattlefieldBackdrop()
    // cua combat that (sao/trang/nui/da qua cau ky cho panel test, va
    // cung hardcode GRID_ROW_COUNT/COLUMN_COUNT). Dat ten ro rang de sau
    // nay thay Rectangle bang Image that chi can doi loai GameObject, giu
    // nguyen vi tri goi.
    this.skyLayer = this.add.rectangle(0, 0, PANEL_WIDTH, geometry.horizonY, PANEL_SKY_COLOR).setOrigin(0, 0).setAlpha(0)
    this.groundLayer = this.add
      .rectangle(0, geometry.horizonY, PANEL_WIDTH, geometry.roadHeight, PANEL_GROUND_COLOR)
      .setOrigin(0, 0)
      .setAlpha(0)

    // Same factory the shell calls (FormationCanvasSpec) - the five parameters
    // are declared once and neither layer restates them (sec3.6.2).
    this.projection = createFormationProjection()
    this.gridGraphics = this.add.graphics()
    this.gridView.redrawGridLines()

    // Same enumeration CombatScene registers from: in 'animated' mode the
    // whole roster, in 'static' mode exactly the reskin override sets - so
    // startEntityIdle can play `<entityKey>-idle` on reskinned combatants too
    // (uniformity, 2026-09-19; reskin amendments 2026-09-28).
    for (const { clips } of animatedCombatEntities()) {
      registerClipCatalogue(this.anims, clips)
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
        ? resolvePlayerEntityKey(this.playerProfile.id, this.playerProfile.combatTextureKey, {
            armed: this.currentArmed,
          })
        : resolveCombatEntityKey(id)

    if (presentationFor(entityKey)?.kind !== 'animated') {
      return
    }

    const key = combatAnimationKey(entityKey, 'idle')

    // Atlas-miss registers the clip name with zero frames - exists() is true
    // but play() throws on frames[0]; treat an empty clip as missing.
    if (this.anims.exists(key) && this.anims.get?.(key)?.frames.length !== 0) {
      ;(sprite.rect as Phaser.GameObjects.Sprite).play(key)
    }
  }

  /**
   * Diff theo combatantId qua chinh CombatGridView.getOrCreateSprite() -
   * KHONG tu viet lai logic tao/xoa sprite: entity con trong assignment
   * moi -> getOrCreateSprite() no-op neu id da co trong this.sprites (chi
   * reposition), animation KHONG bi ngat/reset (day chinh la fix cho bug
   * "animation reset ve 0 moi lan keo-tha 1 entity", 2026-09-06); entity
   * bien mat -> destroyEntitySprite() qua CombatGridView; entity moi xuat
   * hien -> getOrCreateSprite() tao sprite moi, play() tu frame 0 (dung -
   * chua tung animate trong panel nay).
   */
  private readonly assignmentsHandler = (
    payload: FormationSlotAssignment[] | FormationAssignmentsPayload,
  ) => this.syncAssignments(payload)

  syncAssignments(payload: FormationSlotAssignment[] | FormationAssignmentsPayload): void {
    // Phaser event payloads are untyped at runtime - accept the current
    // snapshot shape and the legacy bare array, ignore anything else.
    let assignments: FormationSlotAssignment[]
    let profileId: PlayerVisualProfileId | undefined

    if (Array.isArray(payload)) {
      assignments = payload
    } else if (payload && Array.isArray(payload.assignments)) {
      assignments = payload.assignments
      profileId = payload.playerProfileId
      if (typeof payload.playerArmed === 'boolean') {
        this.currentArmed = payload.playerArmed
      }
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
      // sprite so it picks up the new profile PNG - same outcome as
      // CombatScene.applyPlayerVisualProfile's setTexture + re-size.
      if (assignment.combatantId === PLAYER_ID) {
        const existing = this.sprites.get(PLAYER_ID)

        // What the player sprite is ALLOWED to be drawing right now: the
        // profile PNG in static mode; in animated mode the whole draw chain
        // getOrCreateSprite resolves (idle sheet -> avatar on atlas-miss ->
        // shared fallback) - rejecting any layer rebuilds the sprite on
        // EVERY sync even though its texture is correct for the state.
        const mappedKey = resolvePlayerEntityKey(
          this.playerProfile.id,
          this.playerProfile.combatTextureKey,
          { armed: this.currentArmed },
        )
        const presentation = presentationFor(mappedKey)
        const acceptableTextureKeys = new Set<string>()

        if (presentation?.kind === 'animated') {
          acceptableTextureKeys.add(presentation.clips.idle.sheetKey)

          const staticForm = staticArtFormFor(mappedKey)

          if (staticForm) {
            acceptableTextureKeys.add(staticForm.texture.textureKey)
          }

          // The grid-view terminal chain can legitimately leave the sprite
          // on the profile PNG when both atlas and avatar miss - it is a
          // real draw-chain output, not a stale texture (Clean-A2 R2-F2).
          acceptableTextureKeys.add(this.playerProfile.combatTextureKey)

          const fallbackKey = this.fallbackSpriteTextureKey(PLAYER_ID)

          if (fallbackKey) {
            acceptableTextureKeys.add(fallbackKey)
          }
        } else {
          acceptableTextureKeys.add(this.playerProfile.combatTextureKey)

          // grid-view:450 can also draw PLAYER_TEXTURE_KEY for an unmapped
          // profile whose PNG never loaded (Clean-B2 CR2-F5).
          acceptableTextureKeys.add(PLAYER_TEXTURE_KEY)

          const fallbackKey = this.fallbackSpriteTextureKey(PLAYER_ID)

          if (fallbackKey) {
            acceptableTextureKeys.add(fallbackKey)
          }
        }

        if (
          existing &&
          existing.kind === 'sprite' &&
          !acceptableTextureKeys.has((existing.rect as Phaser.GameObjects.Sprite).texture.key)
        ) {
          this.gridView.destroyEntitySprite(existing)
          this.sprites.delete(PLAYER_ID)
        }
      }

      // The DOM slot owns the localized label; avoid a second raw-id label on the canvas.
      const sprite = this.gridView.getOrCreateSprite(
        assignment.combatantId,
        0x4caf50,
        '',
        assignment.row as LaneIndex,
      )

      // Cell->cell drags reuse the existing sprite: getOrCreateSprite's
      // early-return keeps the ORIGINAL row, and positionSprite projects
      // gridToScreen(sprite.row, column) - refresh it or the unit draws in
      // its old cell while the DOM grid shows the new one.
      sprite.row = assignment.row as LaneIndex

      this.gridView.positionSprite(sprite, assignment.column)
    }
  }
}
