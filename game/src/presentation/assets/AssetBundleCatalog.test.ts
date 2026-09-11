import { describe, expect, it } from 'vitest'
import {
  enumerateResources,
  getBundleDescriptors,
  getBundlesForRoute,
  getCombatDescriptors,
  getCoreUiDescriptors,
  getHomeDescriptors,
  getTribulationDescriptors,
} from './AssetBundleCatalog'
import {
  ENEMY_TEMPLATE_IDS,
  PLAYER_TEXTURE_KEY,
  queueCombatAssets,
} from '@/game/support/CombatPreload'
import { GOURD_TEXTURE_KEY } from '@/game/support/RewardGourd'
import { resolveEnemyTextureKey } from '@/game/support/EnemyArt'
import { PLAYER_VISUAL_PROFILES } from '@/presentation/art/PlayerVisualProfiles'
import { animatedCombatEntities } from '@/presentation/art/CombatPresentationCatalogue'

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

    // Must contain animation sheet keys
    for (const { clips } of animatedCombatEntities()) {
      for (const clip of Object.values(clips)) {
        expect(catalogKeys.has(clip.sheetKey)).toBe(true)
      }
    }
  })

  it('tribulation descriptors contain char-cultivate multiatlas and ink-wash-ui atlas', () => {
    const descriptors = getTribulationDescriptors()
    const keys = descriptors.map((d) => d.key)
    expect(keys).toContain('char-cultivate')
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
    expect(keys).toContain('char-cultivate')
    expect(keys).toContain(PLAYER_TEXTURE_KEY)
  })
})
