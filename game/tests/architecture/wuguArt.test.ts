/**
 * Wugu Demon King binding (impact-sync sec.40-45, sec.68).
 *
 * The wugu atlas packs FIVE clips across FOUR sheets - the first variant
 * whose clips span sheets, which is why MonsterClipRange carries a sheet
 * index. Only idle/attack/death are declared runtime clips; enrage/stomp
 * stay packed-but-unbound until real gameplay skills reach for them.
 * co_thu binds the art; huyet_mong is a different beast and stays unbound.
 */
import { describe, expect, it } from 'vitest'
import { ENEMIES } from '@/data/enemy/Enemies'
import { HIDDEN_BEASTS } from '@/data/enemy/HiddenBeasts'
import { ENEMY_RESKIN_MAP, MONSTER_ART, resolveMonsterArtSlug } from '@/game/support/MonsterArt'
import { animatedArtFormFor } from '@/presentation/art/CombatPresentationCatalogue'

const wugu = MONSTER_ART['wugu-demon-king']!

describe('wugu-demon-king art variant', () => {
  it('pins the exact multi-sheet source layout', () => {
    // From the packed manifest: idle sheet-1, attack sheet-2 (23f),
    // death sheet-2 (1f). enrage sheet-3 + stomp sheet-4 exist on disk
    // but are deliberately NOT registered clips (sec.44).
    expect(wugu.clips.idle.sheetKey).toBe('wugu-demon-king-sheet-1')
    expect(wugu.clips.idle.firstFrame).toBe(1)
    expect(wugu.clips.idle.lastFrame).toBe(13)

    expect(wugu.clips.attack?.sheetKey).toBe('wugu-demon-king-sheet-2')
    expect(wugu.clips.attack?.firstFrame).toBe(1)
    expect(wugu.clips.attack?.lastFrame).toBe(23)

    expect(wugu.clips.death.sheetKey).toBe('wugu-demon-king-sheet-2')
    expect(wugu.clips.death.firstFrame).toBe(1)
    expect(wugu.clips.death.lastFrame).toBe(1)
  })

  it('does not runtime-bind the packed-but-unskillable clips', () => {
    // enrage/stomp ship in the atlas but have no declared gameplay skill -
    // registering them would invent art reachability the battle never asks
    // for. The range table has no such keys at all.
    const clips = wugu.clips as Record<string, unknown>
    expect('enrage' in clips).toBe(false)
    expect('stomp' in clips).toBe(false)
    expect('castClips' in wugu).toBe(false)
  })

  it('registers an animated form reachable under its own slug', () => {
    const clips = animatedArtFormFor('wugu-demon-king')
    expect(clips).toBeDefined()
    expect(clips!.attack?.impactFrameIndex).toBe(7)
  })
})

describe('hidden-beast reskin bindings', () => {
  it('co_thu resolves to wugu-demon-king', () => {
    expect(ENEMY_RESKIN_MAP.co_thu).toBe('wugu-demon-king')
    expect(HIDDEN_BEASTS.some((b) => b.id === 'co_thu')).toBe(true)
    expect(resolveMonsterArtSlug('co_thu')).toBe('wugu-demon-king')
    // Runtime ids carry a suffix - the prefix resolution holds.
    expect(resolveMonsterArtSlug('co_thu_abc123')).toBe('wugu-demon-king')
  })

  it('huyet_mong stays unbound - it is a different beast', () => {
    expect(HIDDEN_BEASTS.some((b) => b.id === 'huyet_mong')).toBe(true)
    expect(ENEMY_RESKIN_MAP.huyet_mong).toBeUndefined()
    expect(resolveMonsterArtSlug('huyet_mong')).not.toBe('wugu-demon-king')
  })

  it('enemy enumeration authority covers ENEMIES + HIDDEN_BEASTS (sec.45)', () => {
    // The reskin map must never name a template id that does not exist -
    // HIDDEN_BEASTS are legitimate reskin targets now, not just ENEMIES.
    const known = new Set([...ENEMIES, ...HIDDEN_BEASTS].map((e) => e.id))
    for (const templateId of Object.keys(ENEMY_RESKIN_MAP)) {
      expect(known.has(templateId), `ENEMY_RESKIN_MAP names unknown enemy '${templateId}'`).toBe(true)
    }
  })
})
