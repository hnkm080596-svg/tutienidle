import { describe, expect, it } from 'vitest'
import {
  CULTIVATE_TEXTURE_OVERRIDES,
  PLAYER_VISUAL_PROFILES,
  getBodyAnchors,
  getCultivateTexture,
  resolvePlayerVisualProfileId,
} from '@/presentation/art/PlayerVisualProfiles'
import { CHARACTER_RESKIN_MAP } from '@/game/support/CharacterArt'
import type { PlayerVisualProfileId } from '@/core/player/PlayerVisualForm'

// Player visual profile catalog (plan sec4.1 + sec9 unit tests):
// - chon dung profile theo realmId/cultivationPath;
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

    expect(phapTu.combatTextureKey).toBe('player-phap-tu-ngu-hanh-v1')
    expect(phapTu.combatTextureUrl).toBe(
      '/assets/characters/player/phap-tu/player-phap-tu-ngu-hanh-v1.png',
    )
    expect(phapTu.combatSourceSize).toEqual({ w: 732, h: 756 })
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

          // Sanity - du 5 anchor id chuan.
          void anchorId
        }

        expect(Object.keys(anchors).sort()).toEqual(
          ['castHand', 'chest', 'feet', 'head', 'offHand'].sort(),
        )
      }
    }
  })
})

describe('PlayerVisualProfiles - reskin art family', () => {
  // Art-seam wave (Q4, 2026-09-29): one entity = one art family - each
  // profile's combat static is the PNG of the variant its reskin resolves
  // to (armed pick for the {armed,unarmed} mortal pair).
  it('profile combat statics match their reskin family', () => {
    expect(PLAYER_VISUAL_PROFILES.mortal.combatTextureKey).toContain('pham-nhan')
    expect(PLAYER_VISUAL_PROFILES.phap_tu.combatTextureKey).toContain('ngu-hanh')

    // The binding side agrees: mortal's armed slug IS pham_nhan, phap_tu's
    // sole slug is ngu_hanh - the static key echoes the same family name.
    const mortalBinding = CHARACTER_RESKIN_MAP.mortal
    expect(typeof mortalBinding === 'object' && mortalBinding.armed).toBe('pham_nhan')
    expect(CHARACTER_RESKIN_MAP.phap_tu).toBe('ngu_hanh')
  })
})

describe('PlayerVisualProfiles - hidden-way cultivate override', () => {
  it('Vạn Đạo (hidden_spell_pathway) picks the dedicated PNG over the profile cultivate', () => {
    const override = CULTIVATE_TEXTURE_OVERRIDES.hidden_spell_pathway

    expect(override).toEqual({
      key: 'player-phap-tu-an-cultivate-van-dao-v1',
      url: '/assets/characters/player/phap-tu/player-phap-tu-an-cultivate-van-dao-v1.png',
      sourceSize: { w: 1254, h: 1254 },
      extent: { x: 0, y: 0.039075, w: 1, h: 0.960925 },
    })

    const phapTu = PLAYER_VISUAL_PROFILES.phap_tu

    expect(getCultivateTexture(phapTu, 'hidden_spell_pathway')).toEqual({
      key: override!.key,
      url: override!.url,
      sourceSize: { w: 1254, h: 1254 },
    })

    // The override is way-keyed, not profile-keyed: any profile asked with
    // the hidden way resolves the same override.
    expect(getCultivateTexture(PLAYER_VISUAL_PROFILES.mortal, 'hidden_spell_pathway').key).toBe(
      override!.key,
    )

    // A non-hidden way falls back to the profile's own cultivate chain.
    expect(getCultivateTexture(phapTu, 'spell_pathway').key).toBe(
      'player-phap-tu-cultivate-ngu-hanh-v1',
    )
    expect(getCultivateTexture(phapTu).key).toBe('player-phap-tu-cultivate-ngu-hanh-v1')
  })
})

describe('PlayerVisualProfiles - Mortal sword art', () => {
  it('uses the reskin-matched pham_nhan static and measured combat geometry', () => {
    const mortal = PLAYER_VISUAL_PROFILES.mortal

    expect(mortal.combatTextureKey).toBe('player-mortal-pham-nhan-v1')
    expect(mortal.combatTextureUrl).toBe(
      '/assets/characters/player/mortal/player-mortal-pham-nhan-v1.png',
    )
    expect(mortal.combatSourceSize).toEqual({ w: 744, h: 744 })
    expect(mortal.bodyAnchors).toEqual({
      head: { x: 0.55, y: 0.25 },
      chest: { x: 0.55, y: 0.46 },
      castHand: { x: 0.32, y: 0.62 },
      offHand: { x: 0.78, y: 0.47 },
      feet: { x: 0.55, y: 0.96 },
    })
  })
})
