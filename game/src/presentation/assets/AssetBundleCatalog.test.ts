import { describe, expect, it } from 'vitest'
import {
  enumerateResources,
  getBundleDescriptors,
  getBundlesForRoute,
  getCombatDescriptors,
  getCoreUiDescriptors,
  getHomeDescriptors,
  getTribulationDescriptors,
  type AssetResourceDescriptor,
} from './AssetBundleCatalog'
import { AUDIO_CUES } from '@/core/audio/AudioCueManifest'
import { descriptorsMatch } from './AssetBundleManager'
import {
  ENEMY_TEMPLATE_IDS,
  PLAYER_TEXTURE_KEY,
  queueCombatAssets,
} from '@/game/support/CombatPreload'
import { GOURD_TEXTURE_KEY } from '@/game/support/RewardGourd'
import { resolveEnemyTextureKey } from '@/game/support/EnemyArt'
import { PLAYER_VISUAL_PROFILES } from '@/presentation/art/PlayerVisualProfiles'
import { animatedCombatEntities } from '@/presentation/art/CombatPresentationCatalogue'
import { ENTITY_ART_MODE } from '@/presentation/art/EntityArtMode'
import { atlasClipsOf } from '@/presentation/art/CombatEntityPresentation'

describe('AssetBundleCatalog', () => {
  it('core-ui contains ink-wash-ui atlas descriptor', () => {
    const descriptors = getCoreUiDescriptors()
    expect(descriptors).toHaveLength(1)
    expect(descriptors[0]!.kind).toBe('atlas')
    expect(descriptors[0]!.key).toBe('ink-wash-ui')
  })

  it('Home contains player standing/cultivate textures and Dong Fu layers, but NOT enemies or gourd', () => {
    const descriptors = getHomeDescriptors()
    const keys = new Set(descriptors.map((d) => d.key))

    // Must contain player profile keys
    for (const profile of Object.values(PLAYER_VISUAL_PROFILES)) {
      expect(keys.has(profile.combatTextureKey)).toBe(true)
      if (profile.cultivateTextureKey) {
        expect(keys.has(profile.cultivateTextureKey)).toBe(true)
      }
    }

    // Must contain Dong Fu layers (dom-image)
    const domLayers = descriptors.filter((d) => d.kind === 'dom-image')
    expect(domLayers.length).toBe(10)

    // MUST NOT contain enemies or gourd (lazy asset preservation)
    expect(keys.has(GOURD_TEXTURE_KEY)).toBe(false)
    for (const templateId of ENEMY_TEMPLATE_IDS) {
      const enemyKey = resolveEnemyTextureKey(templateId)
      if (enemyKey) {
        expect(keys.has(enemyKey)).toBe(false)
      }
    }
  })

  it('combat descriptors match the keys queued by queueCombatAssets wrapper', () => {
    const queuedKeys = new Set<string>()
    const fakeScene = {
      textures: { exists: () => false },
      load: {
        image: (key: string) => queuedKeys.add(key),
        atlas: (key: string) => queuedKeys.add(key),
      },
    } as never

    queueCombatAssets(fakeScene)

    const descriptors = getCombatDescriptors()
    const catalogKeys = new Set(descriptors.map((d) => d.key))

    // Every key queued by the legacy wrapper must be enumerated by catalog
    for (const key of queuedKeys) {
      expect(catalogKeys.has(key)).toBe(true)
    }

    // Must contain animation sheet keys - castClips sheets included.
    for (const { clips } of animatedCombatEntities()) {
      for (const clip of atlasClipsOf(clips)) {
        expect(catalogKeys.has(clip.sheetKey)).toBe(true)
      }
    }
  })

  it('tribulation descriptors carry the mode-appropriate cultivate art plus ink-wash-ui atlas', () => {
    const descriptors = getTribulationDescriptors()
    const keys = descriptors.map((d) => d.key)

    if (ENTITY_ART_MODE === 'animated') {
      // The legacy 17-frame bridge multiatlas IS the cultivate presentation.
      expect(keys).toContain('char-cultivate')
    } else {
      // Static mode draws the profile cultivate PNGs (mortal shared art).
      for (const profile of Object.values(PLAYER_VISUAL_PROFILES)) {
        if (profile.cultivateTextureKey) {
          expect(keys).toContain(profile.cultivateTextureKey)
        }
      }
      expect(keys).not.toContain('char-cultivate')
    }

    expect(keys).toContain('ink-wash-ui')
  })

  it('routes that render before a Phaser host exists require no Phaser bundle', () => {
    // Regression: 'core-ui' is a Phaser atlas. Requiring it for boot/auth/
    // character/error made those transitions wait on a loader scene that only
    // exists once PhaserCanvas mounts - they timed out and left the
    // coordinator stuck off-route for the rest of the session.
    expect(getBundlesForRoute('boot')).toEqual([])
    expect(getBundlesForRoute('auth')).toEqual([])
    expect(getBundlesForRoute('character')).toEqual([])
    expect(getBundlesForRoute('error')).toEqual([])
  })

  it('Phaser-backed routes require core-ui plus their own bundle', () => {
    expect(getBundlesForRoute('home')).toEqual(['core-ui', 'home'])
    expect(getBundlesForRoute('combat')).toEqual(['core-ui', 'combat'])
    expect(getBundlesForRoute('tribulation')).toEqual(['core-ui', 'tribulation'])
  })

  it('enumerateResources deduplicates keys across combined bundles', () => {
    const enumerated = enumerateResources(['core-ui', 'home', 'combat', 'tribulation'])
    const keys = enumerated.map((d) => d.key)
    const uniqueKeys = new Set(keys)

    expect(keys.length).toBe(uniqueKeys.size)
    expect(keys).toContain('ink-wash-ui')
    if (ENTITY_ART_MODE === 'animated') {
      expect(keys).toContain('char-cultivate')
    }
    expect(keys).toContain(PLAYER_TEXTURE_KEY)
  })
})


describe('W4 dom-audio lane', () => {
  // Mutating the manifest for the test is safe: audioDescriptorsFor reads it
  // lazily inside getBundleDescriptors, and we restore in finally.
  function injectCue(id: string, src: string | readonly string[]) {
    const cues = AUDIO_CUES as Record<string, (typeof AUDIO_CUES)[string]>
    const orig = cues[id]
    cues[id] = { ...orig!, src }
    return () => {
      if (orig) cues[id] = orig
      else delete cues[id]
    }
  }

  it('audio bundles enumerate only manifest rows with non-empty src', () => {
    expect(getBundleDescriptors('audio-core')).toEqual([])
    expect(getBundleDescriptors('audio-combat')).toEqual([])
    expect(getBundleDescriptors('audio-tribulation')).toEqual([])

    const restore = injectCue('combat.hit', 'assets/audio/sfx/combat/hit.ogg')
    try {
      expect(getBundleDescriptors('audio-core')).toEqual([])
      const combat = getBundleDescriptors('audio-combat')
      const row = combat.find((d) => d.key === 'assets/audio/sfx/combat/hit.ogg')
      expect(row).toBeDefined()
      expect(row!.kind).toBe('dom-audio')
      expect((row as { urls: readonly string[] }).urls).toEqual([
        'assets/audio/sfx/combat/hit.ogg',
      ])
      expect((row as { optional: boolean }).optional).toBe(true)
    } finally {
      restore()
    }
  })

  it('array src becomes one descriptor per src (variant rows)', () => {
    const restore = injectCue('ui.click', ['a.ogg', 'a.mp3'])
    try {
      const descs = getBundleDescriptors('audio-core')
      const a = descs.find((d) => d.key === 'a.ogg')
      const b = descs.find((d) => d.key === 'a.mp3')
      expect((a as { urls: readonly string[] }).urls).toEqual(['a.ogg'])
      expect((b as { urls: readonly string[] }).urls).toEqual(['a.mp3'])
    } finally {
      restore()
    }
  })

  it('descriptorsMatch compares dom-audio urls arrays', () => {
    const a: AssetResourceDescriptor = {
      kind: 'dom-audio',
      key: 'ui.click',
      urls: ['x.ogg'],
      optional: true,
    }
    const same: AssetResourceDescriptor = { ...a, urls: ['x.ogg'] }
    const diff: AssetResourceDescriptor = { ...a, urls: ['y.ogg'] }
    const longer: AssetResourceDescriptor = { ...a, urls: ['x.ogg', 'x.mp3'] }
    expect(descriptorsMatch(a, same)).toBe(true)
    expect(descriptorsMatch(a, diff)).toBe(false)
    expect(descriptorsMatch(a, longer)).toBe(false)
  })

  it('audio bundles never appear in getBundlesForRoute', () => {
    for (const route of ['boot', 'auth', 'character', 'home', 'combat', 'tribulation', 'error'] as const) {
      for (const bundle of getBundlesForRoute(route)) {
        expect(bundle.startsWith('audio-')).toBe(false)
      }
    }
  })
})
