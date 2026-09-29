import { describe, expect, it } from 'vitest'
import {
  PLAYER_VISUAL_PROFILES,
  getBodyAnchors,
  getCultivateTexture,
  resolvePlayerVisualProfileId,
} from '@/presentation/art/PlayerVisualProfiles'
import type { PlayerVisualProfileId } from '@/core/player/PlayerVisualForm'

// Player visual profile catalog (plan §4.1 + §9 unit tests):
// - chọn đúng profile theo realmId/cultivationPath;
// - dedicated art for kiem_tu/phap_tu cultivate (2026-09-27 hand-drawn
//   wave); the_tu keeps the mortal fallback until its set is drawn.
describe('PlayerVisualProfiles — resolvePlayerVisualProfileId', () => {
  it('Phàm Nhân (realm mortal, không path) → mortal', () => {
    expect(resolvePlayerVisualProfileId({ realmId: 'mortal' })).toBe('mortal')
    expect(resolvePlayerVisualProfileId({})).toBe('mortal')
  })

  it('spell → phap_tu; sword → kiem_tu', () => {
    expect(resolvePlayerVisualProfileId({ realmId: 'qi_refining', cultivationPath: 'spell' })).toBe(
      'phap_tu',
    )

    expect(resolvePlayerVisualProfileId({ realmId: 'qi_refining', cultivationPath: 'sword' })).toBe(
      'kiem_tu',
    )
  })

  it('giá trị lạ → fallback mortal', () => {
    expect(resolvePlayerVisualProfileId({ realmId: 'weird', cultivationPath: 'dao_si' })).toBe(
      'mortal',
    )
  })

  // T4-39 - the_tu is a valid CultivationPathId and must resolve its own
  // logical profile (art layer may still fall back to mortal textures).
  it('body -> the_tu', () => {
    expect(resolvePlayerVisualProfileId({ realmId: 'qi_refining', cultivationPath: 'body' })).toBe(
      'the_tu',
    )
  })

  // phap_tu_an collapsed into phap_tu + cultivationWay (save v66) - the
  // legacy id stays a mortal fallback, never revived.
  it('legacy phap_tu_an -> mortal fallback (not revived)', () => {
    expect(resolvePlayerVisualProfileId({ cultivationPath: 'phap_tu_an' })).toBe('mortal')
  })
})

describe('PlayerVisualProfiles - profile coverage', () => {
  it('every PlayerVisualProfileId has a presentation profile entry', () => {
    const ids = ['mortal', 'phap_tu', 'kiem_tu', 'the_tu'] as const

    for (const id of ids) {
      expect(PLAYER_VISUAL_PROFILES[id], `missing profile for '${id}'`).toBeDefined()
      expect(PLAYER_VISUAL_PROFILES[id].id).toBe(id)
    }
  })
})

describe('PlayerVisualProfiles — art binding policy', () => {
  it('kiem_tu có art riêng (combat static + cultivate)', () => {
    const kiemTu = PLAYER_VISUAL_PROFILES.kiem_tu
    const mortal = PLAYER_VISUAL_PROFILES.mortal

    expect(kiemTu.combatTextureKey).toBe('player-kiem-tu-v1')
    expect(kiemTu.combatTextureUrl).toBe(
      '/assets/characters/player/kiem-tu/player-kiem-tu-v1.png',
    )
    expect(kiemTu.combatTextureKey).not.toBe(mortal.combatTextureKey)
    expect(getCultivateTexture(kiemTu).key).toBe('player-kiem-tu-cultivate-v1')
    expect(getCultivateTexture(kiemTu).key).not.toBe(getCultivateTexture(mortal).key)
  })

  it('phap_tu có combat + cultivate art riêng (Ngũ Hành)', () => {
    const phapTu = PLAYER_VISUAL_PROFILES.phap_tu

    expect(phapTu.combatTextureKey).not.toBe(PLAYER_VISUAL_PROFILES.mortal.combatTextureKey)
    expect(getCultivateTexture(phapTu).key).toBe('player-phap-tu-cultivate-ngu-hanh-v1')
    expect(getCultivateTexture(phapTu).key).not.toBe(
      getCultivateTexture(PLAYER_VISUAL_PROFILES.mortal).key,
    )
  })

  it('the_tu vẫn fallback mortal (chưa có art riêng)', () => {
    const theTu = PLAYER_VISUAL_PROFILES.the_tu
    const mortal = PLAYER_VISUAL_PROFILES.mortal

    expect(theTu.combatTextureKey).toBe(mortal.combatTextureKey)
    expect(getCultivateTexture(theTu).key).toBe(getCultivateTexture(mortal).key)
  })

  it('mọi profile khai đủ 5 body anchor trong khoảng 0..1', () => {
    for (const profile of Object.values(PLAYER_VISUAL_PROFILES)) {
      for (const pose of ['combat', 'cultivate'] as const) {
        const anchors = getBodyAnchors(profile, pose)

        for (const [anchorId, anchor] of Object.entries(anchors)) {
          expect(anchor.x).toBeGreaterThanOrEqual(0)
          expect(anchor.x).toBeLessThanOrEqual(1)
          expect(anchor.y).toBeGreaterThanOrEqual(0)
          expect(anchor.y).toBeLessThanOrEqual(1)

          // Sanity — đủ 5 anchor id chuẩn.
          void anchorId
        }

        expect(Object.keys(anchors).sort()).toEqual(
          ['castHand', 'chest', 'feet', 'head', 'offHand'].sort(),
        )
      }
    }
  })
})

describe('PlayerVisualProfiles - Mortal sword art', () => {
  it('uses the ink-sword v2 asset and measured combat geometry', () => {
    const mortal = PLAYER_VISUAL_PROFILES.mortal

    expect(mortal.combatTextureKey).toBe('player-mortal-ink-sword-concept-v2')
    expect(mortal.combatTextureUrl).toBe(
      '/assets/characters/player/mortal/player-mortal-ink-sword-concept-v2.png',
    )
    expect(mortal.combatSourceSize).toEqual({ w: 1312, h: 1199 })
    expect(mortal.bodyAnchors).toEqual({
      head: { x: 0.55, y: 0.25 },
      chest: { x: 0.55, y: 0.46 },
      castHand: { x: 0.32, y: 0.62 },
      offHand: { x: 0.78, y: 0.47 },
      feet: { x: 0.55, y: 0.96 },
    })
  })
})
