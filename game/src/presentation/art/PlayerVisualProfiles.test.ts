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
// - fallback an toàn cho kiem_tu (chưa có art riêng) và giá trị lạ.
describe('PlayerVisualProfiles — resolvePlayerVisualProfileId', () => {
  it('Phàm Nhân (realm mortal, không path) → mortal', () => {
    expect(resolvePlayerVisualProfileId({ realmId: 'mortal' })).toBe('mortal')
    expect(resolvePlayerVisualProfileId({})).toBe('mortal')
  })

  it('phap_tu → phap_tu; kiem_tu → kiem_tu', () => {
    expect(resolvePlayerVisualProfileId({ realmId: 'qi_refining', cultivationPath: 'phap_tu' })).toBe(
      'phap_tu',
    )

    expect(resolvePlayerVisualProfileId({ realmId: 'qi_refining', cultivationPath: 'kiem_tu' })).toBe(
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
  it('the_tu -> the_tu', () => {
    expect(resolvePlayerVisualProfileId({ realmId: 'qi_refining', cultivationPath: 'the_tu' })).toBe(
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

describe('PlayerVisualProfiles — fallback policy', () => {
  it('kiem_tu tái dùng toàn bộ texture Phàm Nhân', () => {
    const kiemTu = PLAYER_VISUAL_PROFILES.kiem_tu
    const mortal = PLAYER_VISUAL_PROFILES.mortal

    expect(kiemTu.combatTextureKey).toBe(mortal.combatTextureKey)
    expect(kiemTu.combatTextureUrl).toBe(mortal.combatTextureUrl)
    expect(kiemTu.combatSourceSize).toEqual(mortal.combatSourceSize)
    expect(kiemTu.bodyAnchors).toEqual(mortal.bodyAnchors)
    expect(getCultivateTexture(kiemTu).key).toBe(getCultivateTexture(mortal).key)
  })

  it('phap_tu có combat art riêng, cultivate fallback Phàm Nhân', () => {
    const phapTu = PLAYER_VISUAL_PROFILES.phap_tu

    expect(phapTu.combatTextureKey).not.toBe(PLAYER_VISUAL_PROFILES.mortal.combatTextureKey)
    expect(getCultivateTexture(phapTu).key).toBe(
      getCultivateTexture(PLAYER_VISUAL_PROFILES.mortal).key,
    )
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
