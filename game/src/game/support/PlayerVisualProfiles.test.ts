import { describe, expect, it } from 'vitest'
import {
  PLAYER_VISUAL_PROFILES,
  getBodyAnchors,
  getCultivateTexture,
  resolvePlayerVisualProfileId,
} from './PlayerVisualProfiles'

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
})

describe('PlayerVisualProfiles — fallback policy', () => {
  it('kiem_tu tái dùng toàn bộ texture Phàm Nhân', () => {
    const kiemTu = PLAYER_VISUAL_PROFILES.kiem_tu
    const mortal = PLAYER_VISUAL_PROFILES.mortal

    expect(kiemTu.combatTextureKey).toBe(mortal.combatTextureKey)
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
