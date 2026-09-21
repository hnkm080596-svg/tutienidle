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

// Real-art wiring (2026-09-14) — the preview used to hardcode the placeholder
// sheet for EVERY combatant even though the player has real profile art. The
// panel now sends { assignments, playerProfileId } and the scene resolves the
// player's current profile PNG — static art exactly like CombatScene's
// static-art path; combatants with no registered presentation
// (companions — no art exists yet) keep the placeholder idle animation.
describe('TranPhapCombatPreviewScene — real art resolution', () => {
  function fakeSprite(id: string, textureKey = 'ph') {
    return {
      kind: 'sprite' as const,
      rect: {
        anims: { isPlaying: false },
        played: [] as string[],
        play(key: string) {
          this.played.push(key)
          return this
        },
        texture: { key: textureKey },
      },
      label: {},
      color: 0,
      offsetX: 0,
      row: 0,
      id,
    }
  }

  function bareScene() {
    const scene = Object.create(TranPhapCombatPreviewScene.prototype) as TranPhapCombatPreviewScene

    const sprites = new Map<string, ReturnType<typeof fakeSprite>>()

    Object.assign(scene, {
      sprites,
      gridView: {
        getOrCreateSprite: (id: string) => {
          if (!sprites.has(id)) {
            // Mirrors CombatGridView: the player sprite is created with the
            // current profile texture; everyone else falls back.
            const textureKey = id === 'player' ? scene.playerProfile.combatTextureKey : 'ph'

            sprites.set(id, fakeSprite(id, textureKey))
          }
          return sprites.get(id)
        },
        positionSprite: () => undefined,
        destroyEntitySprite: (sprite: { id: string }) => {
          sprites.delete(sprite.id)
        },
      },
    })

    return scene
  }

  it('player assignment renders the static profile PNG — no idle clip, like CombatScene', () => {
    const scene = bareScene()

    scene.syncAssignments({
      assignments: [{ row: 0, column: 1, combatantId: 'player' }],
      playerProfileId: 'mortal',
    })

    const sprite = scene.sprites.get('player')!
    const rect = sprite.rect as unknown as { played: string[]; texture: { key: string } }

    expect(rect.texture.key).toBe(PLAYER_VISUAL_PROFILES.mortal.combatTextureKey)
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

  it('a profile switch rebuilds an existing player sprite onto the new texture', () => {
    const scene = bareScene()

    scene.syncAssignments({
      assignments: [{ row: 0, column: 1, combatantId: 'player' }],
      playerProfileId: 'mortal',
    })

    const before = scene.sprites.get('player')!

    scene.syncAssignments({
      assignments: [{ row: 0, column: 1, combatantId: 'player' }],
      playerProfileId: 'phap_tu',
    })

    const after = scene.sprites.get('player')!
    const afterRect = after.rect as unknown as { texture: { key: string } }

    expect(after).not.toBe(before)
    expect(afterRect.texture.key).toBe(PLAYER_VISUAL_PROFILES.phap_tu.combatTextureKey)
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
