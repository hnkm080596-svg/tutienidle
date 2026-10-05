// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import {
  PANEL_WIDTH,
  PANEL_HEIGHT,
  PERSPECTIVE_MIN_ROAD_HEIGHT_PANEL,
  TranPhapCombatPreviewScene,
} from './TranPhapCombatPreviewScene'
import { STANDING_SLOT_COUNT } from '@/core/battle/BattlefieldRegions'
import { PLAYER_VISUAL_PROFILES } from '@/presentation/art/PlayerVisualProfiles'
import type Phaser from 'phaser'
import type { LaneIndex } from '@/core/battle/BattleLane'
import type { EntitySprite } from './combat/combatTypes'
import {
  presentationFor,
  resolvePlayerEntityKey,
} from '@/presentation/art/CombatPresentationCatalogue'

describe('TranPhapCombatPreviewScene — perspective geometry constant (Battlefield Perspective Panel, 2026-09-06)', () => {
  it('PANEL_WIDTH/PANEL_HEIGHT khớp CHÍNH XÁC với canvas Phaser thật trong TranPhapPanel.vue (420x480)', () => {
    expect(PANEL_WIDTH).toBe(420)
    expect(PANEL_HEIGHT).toBe(480)
  })

  it('PERSPECTIVE_MIN_ROAD_HEIGHT_PANEL nhỏ hơn hằng số combat thật (320) — panel cần sàn thấp hơn cho canvas nhỏ', () => {
    expect(PERSPECTIVE_MIN_ROAD_HEIGHT_PANEL).toBeLessThan(320)
  })
})

describe('TranPhapCombatPreviewScene — standing-slot grid size (standing-slot rework, 2026-09-07)', () => {
  it('panel grid resolution reads the shared STANDING_SLOT_COUNT (3x3), not a local constant', () => {
    expect(STANDING_SLOT_COUNT).toBe(3)
  })
})

// Real-art wiring (2026-09-14) - the preview used to hardcode the placeholder
// sheet for EVERY combatant even though the player has real profile art. The
// panel now sends { assignments, playerProfileId } and the scene resolves the
// player's current profile PNG - static art exactly like CombatScene's
// static-art path; combatants with no registered presentation
// (companions - no art exists yet) keep the placeholder idle animation.
describe('TranPhapCombatPreviewScene — real art resolution', () => {
  function fakeSprite(id: string, textureKey = 'ph'): EntitySprite {
    const played: string[] = []
    const rect = {
      anims: { isPlaying: false },
      played,
      play(key: string) {
        played.push(key)
        return rect
      },
      texture: { key: textureKey },
    } as unknown as Phaser.GameObjects.Sprite

    // `id` is not part of EntitySprite - the test's destroyEntitySprite stub
    // tracks rebuilds by it, mirroring what the real grid view knows from
    // its map key.
    const sprite = {
      kind: 'sprite' as const,
      rect,
      label: {} as Phaser.GameObjects.Text,
      color: 0,
      offsetX: 0,
      row: 0 as LaneIndex,
      sizeMultiplier: 1,
      boost: { value: 1 },
      footY: 0,
      columnFloat: 0,
      id,
    }

    return sprite
  }

  // The texture the REAL CombatGridView draws for the player today:
  // resolvePlayerEntityKey -> presentation -> idle sheet for animated
  // reskins, the profile PNG for static/unmapped profiles.
  function playerDrawTextureKey(profile: { id: string; combatTextureKey: string }): string {
    const presentation = presentationFor(resolvePlayerEntityKey(profile.id, profile.combatTextureKey))

    return presentation?.kind === 'animated'
      ? presentation.clips.idle.sheetKey
      : profile.combatTextureKey
  }

  function bareScene() {
    const scene = Object.create(TranPhapCombatPreviewScene.prototype) as TranPhapCombatPreviewScene & {
      destroyCalls: string[]
    }

    const sprites = new Map<string, ReturnType<typeof fakeSprite>>()

    Object.assign(scene, {
      sprites,
      destroyCalls: [] as string[],
      gridView: {
        getOrCreateSprite: (id: string) => {
          if (!sprites.has(id)) {
            // Mirrors CombatGridView's real draw chain: a reskin-mapped
            // profile draws its animated presentation's idle sheet, an
            // unmapped one the profile PNG; everyone else falls back.
            const textureKey =
              id === 'player' ? playerDrawTextureKey(scene.playerProfile) : 'ph'

            sprites.set(id, fakeSprite(id, textureKey))
          }
          return sprites.get(id)
        },
        positionSprite: () => undefined,
        destroyEntitySprite: (sprite: { id: string }) => {
          scene.destroyCalls.push(sprite.id)
          sprites.delete(sprite.id)
        },
      },
    })

    return scene
  }

  it('player assignment renders the reskinned idle sheet — mortal maps to pham_nhan', () => {
    const scene = bareScene()

    scene.syncAssignments({
      assignments: [{ row: 0, column: 1, combatantId: 'player' }],
      playerProfileId: 'mortal',
    })

    const sprite = scene.sprites.get('player')!
    const rect = sprite.rect as unknown as { played: string[]; texture: { key: string } }

    expect(rect.texture.key).toBe('pham_nhan-sheet-1')
    expect(rect.played).toEqual([])
  })

  it('playerProfileId switches which profile texture the scene reports', () => {
    const scene = bareScene()

    expect(scene.playerProfile.combatTextureKey).toBe(
      PLAYER_VISUAL_PROFILES.mortal.combatTextureKey,
    )

    scene.syncAssignments({ assignments: [], playerProfileId: 'phap_tu' })

    expect(scene.playerProfile.combatTextureKey).toBe(
      PLAYER_VISUAL_PROFILES.phap_tu.combatTextureKey,
    )
  })

  it('a profile switch between different-slug profiles rebuilds the sprite', () => {
    // mortal->pham_nhan, phap_tu->phap_tu_shared:
    // the acceptable texture set differs either side of the switch, so the
    // stale sheet must be rebuilt onto the new variant's idle sheet.
    const scene = bareScene()

    scene.syncAssignments({
      assignments: [{ row: 0, column: 1, combatantId: 'player' }],
      playerProfileId: 'mortal',
    })

    scene.syncAssignments({
      assignments: [{ row: 0, column: 1, combatantId: 'player' }],
      playerProfileId: 'phap_tu',
    })

    expect(scene.destroyCalls).toEqual(['player'])
    expect(
      (scene.sprites.get('player')!.rect as Phaser.GameObjects.Sprite).texture.key,
    ).toBe('phap_tu_shared-sheet-1')
  })

  // character-art-infra: the rebuild guard must accept every texture the
  // draw chain can legitimately produce - the idle sheet, the avatar on
  // atlas-miss, or the shared fallback - and rebuild ONLY on a foreign one.
  it('a player sprite already drawing a valid texture survives sync (no destroy)', () => {
    const scene = bareScene()

    // The acceptable set covers EVERY draw-chain output: idle sheet, avatar
    // on atlas-miss, the profile PNG on double-miss (grid-view terminal
    // fallback), the shared placeholder. Missing any one would rebuild the
    // sprite on every sync under that failure mode.
    for (const textureKey of ['pham_nhan-sheet-1', 'pham_nhan-avatar', 'player-mortal-pham-nhan-v1']) {
      scene.sprites.clear()
      scene.destroyCalls.length = 0
      scene.sprites.set('player', fakeSprite('player', textureKey))

      scene.syncAssignments({
        assignments: [{ row: 0, column: 1, combatantId: 'player' }],
        playerProfileId: 'mortal',
      })

      expect(scene.destroyCalls, `sprite on '${textureKey}' was destroyed on sync`).toEqual([])
      expect((scene.sprites.get('player')!.rect as Phaser.GameObjects.Sprite).texture.key).toBe(textureKey)
    }
  })

  it('a player sprite on a stale texture is rebuilt on sync', () => {
    const scene = bareScene()

    scene.sprites.set('player', fakeSprite('player', 'player-kiem-tu-old-png'))

    scene.syncAssignments({
      assignments: [{ row: 0, column: 1, combatantId: 'player' }],
      playerProfileId: 'mortal',
    })

    expect(scene.destroyCalls).toEqual(['player'])
    expect((scene.sprites.get('player')!.rect as Phaser.GameObjects.Sprite).texture.key).toBe('pham_nhan-sheet-1')
  })

  it('companion without registered presentation resolves placeholder art of the active mode', () => {
    const scene = bareScene()

    scene.syncAssignments({
      assignments: [{ row: 1, column: 0, combatantId: 'tran_mac' }],
      playerProfileId: 'mortal',
    })

    const sprite = scene.sprites.get('tran_mac')!
    const played = (sprite.rect as unknown as { played: string[] }).played

    // ENTITY_ART_MODE is 'static' today: the placeholder is a PNG and no clip
    // plays. In 'animated' mode startEntityIdle would play the placeholder
    // entity's idle key - the grid view, not syncAssignments, kicks that off.
    expect(played).toEqual([])
  })

  it('startEntityIdle no-ops in static mode — placeholder is a PNG, not a clip', () => {
    const scene = bareScene()

    scene.syncAssignments({
      assignments: [{ row: 1, column: 0, combatantId: 'tran_mac' }],
      playerProfileId: 'mortal',
    })

    const sprite = scene.sprites.get('tran_mac')!

    scene.startEntityIdle(sprite as never, 'tran_mac')

    const played = (sprite.rect as unknown as { played: string[] }).played

    expect(played).toEqual([])
  })

  // Clean-A F-5: atlas-miss registers the clip name with zero frames -
  // exists() reports true but play() throws on frames[0]. Same guard class
  // as combat playCombatAnimation/beginDeathSequence.
  it('startEntityIdle skips a zero-frame clip — empty registered anim is treated as missing', () => {
    const scene = bareScene()

    scene.syncAssignments({
      assignments: [{ row: 1, column: 0, combatantId: 'player' }],
      playerProfileId: 'mortal',
    })

    const sprite = scene.sprites.get('player')!
    const played = (sprite.rect as unknown as { played: string[] }).played

    scene.anims = {
      exists: () => true,
      get: () => ({ frames: [] }),
    } as never

    scene.startEntityIdle(sprite as never, 'player')

    expect(played).toEqual([])
  })

  it('cell->cell move updates the sprite row — preview shows the unit in the new cell', () => {
    const scene = bareScene()

    scene.syncAssignments({
      assignments: [{ row: 0, column: 1, combatantId: 'player' }],
      playerProfileId: 'mortal',
    })

    // Drag the same combatant to a different row. getOrCreateSprite returns
    // the existing sprite (it ignores the row argument on that path), so
    // syncAssignments must refresh sprite.row or positionSprite projects
    // the STALE row and the unit draws in the old cell while the DOM grid
    // shows the new one.
    scene.syncAssignments({
      assignments: [{ row: 2, column: 1, combatantId: 'player' }],
      playerProfileId: 'mortal',
    })

    expect(scene.sprites.get('player')!.row).toBe(2)
  })

  it('legacy array payload still works (playerProfileId optional)', () => {
    const scene = bareScene()

    scene.syncAssignments([{ row: 0, column: 0, combatantId: 'player' }])

    expect(scene.sprites.has('player')).toBe(true)
  })
})
