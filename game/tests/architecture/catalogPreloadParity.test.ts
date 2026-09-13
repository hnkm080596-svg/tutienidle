/**
 * R14.6b guard — catalog/preload parity (roadmap R14, A10: "asset
 * resolution/preload enumeration derives from one canonical catalog").
 *
 * What exists already (AssetBundleCatalog.test.ts): catalog descriptors ⊇
 * keys queued by queueCombatAssets(). This file adds the missing direction
 * and the stray-load scan:
 *
 * - Exact key-set equality between queueCombatAssets() and the combat
 *   bundle — a divergence either way means a texture is loaded that the
 *   bundle manager does not know, or catalogued but never ensured for the
 *   transitional preload net.
 * - Every literal `load.*` URL in production source must be enumerated by
 *   some bundle — a hardcoded path that no bundle owns is an untracked load.
 * - Non-literal `load.*` call sites are pinned to the canonical feeders
 *   (queueCombatAssets descriptors, the catalog-driven AssetLoaderScene,
 *   canonical list functions). A new ad-hoc load site fails until it is
 *   routed through the catalog or consciously allowlisted.
 */
import { describe, expect, it } from 'vitest'
import { join } from 'node:path'
import { srcCorpus, SCAN_TIMEOUT } from './helpers/scanTs'
import { queueCombatAssets } from '@/game/support/CombatPreload'
import {
  enumerateResources,
  getCombatDescriptors,
} from '@/presentation/assets/AssetBundleCatalog'

const GAME_ROOT = process.cwd()
const ALL_BUNDLES = ['core-ui', 'home', 'combat', 'tribulation'] as const

function queuedCombatKeys(): Set<string> {
  const keys = new Set<string>()
  const fakeScene = {
    textures: { exists: () => false },
    load: {
      image: (key: string) => keys.add(key),
      atlas: (key: string) => keys.add(key),
    },
  } as never

  queueCombatAssets(fakeScene)

  return keys
}

describe('R14.6b — combat preload enumeration equals the combat bundle', () => {
  it('queueCombatAssets() and getCombatDescriptors() name the same key set', () => {
    const queued = queuedCombatKeys()
    const catalog = new Set(getCombatDescriptors().map((d) => d.key))

    expect([...queued].filter((k) => !catalog.has(k)), 'queued keys missing from catalog').toEqual([])
    expect([...catalog].filter((k) => !queued.has(k)), 'catalog keys never queued').toEqual([])
  })
})

describe('R14.6b — no stray preload enumeration outside the catalog', () => {
  it('every literal load.* URL belongs to an enumerated bundle', { timeout: SCAN_TIMEOUT }, () => {
    const catalogUrls = new Set<string>()

    for (const d of enumerateResources([...ALL_BUNDLES])) {
      for (const field of ['url', 'textureUrl', 'atlasUrl', 'jsonUrl', 'basePath'] as const) {
        const value = field in d ? (d as Record<string, string | undefined>)[field] : undefined
        if (value !== undefined) {
          catalogUrls.add(value.replace(/^\/+/, ''))
        }
      }
    }

    const corpus = srcCorpus(join(GAME_ROOT, 'src'))
    const loadCall = /\.load\.(?:image|atlas|spritesheet|multiatlas|audio|json)\s*\(([^)]*)\)/g
    const literalArg = /'([^']+)'|"([^"]+)"/g

    for (const file of corpus) {
      for (const call of file.text.matchAll(loadCall)) {
        for (const literal of call[1]!.matchAll(literalArg)) {
          const value = (literal[1] ?? literal[2]!).replace(/^\/+/, '')

          if (!value.includes('/')) {
            continue
          }

          expect(
            catalogUrls.has(value),
            `${file.fromSrc}: literal load URL "${value}" is not enumerated by any asset bundle`,
          ).toBe(true)
        }
      }
    }
  })

  it('non-literal load.* call sites are confined to canonical feeders', { timeout: SCAN_TIMEOUT }, () => {
    const corpus = srcCorpus(join(GAME_ROOT, 'src'))
    const loadCall = /\.load\.(?:image|atlas|spritesheet|multiatlas|audio|json)\s*\(([^)]*)\)/g

    // Files whose load.* calls are fed by canonical enumerations:
    // - CombatPreload: the transitional net, descriptor-fed (queueOnce).
    // - AssetLoaderScene: the catalog-driven loader itself.
    // - InkWashUiPhaser: atlas loader fed by its own exported URL constants.
    // - CombatScene: Thanh Van variant swap — args come from
    //   thanhVanLoadList(variant), the same source the catalog enumerates.
    // - TranPhapCombatPreviewScene: PLACEHOLDER_* constants declared by the
    //   combat presentation catalogue (enumerated in the combat bundle).
    // - TribulationScene: literal 'assets/cultivate.json' — in the
    //   tribulation bundle (checked by the literal-url test above).
    const allowedFeeders = new Set([
      'game/support/CombatPreload.ts',
      'game/scenes/AssetLoaderScene.ts',
      'game/support/InkWashUiPhaser.ts',
      'game/scenes/CombatScene.ts',
      'game/scenes/TranPhapCombatPreviewScene.ts',
      'game/scenes/TribulationScene.ts',
    ])

    for (const file of corpus) {
      for (const call of file.text.matchAll(loadCall)) {
        const args = call[1]!
        const hasLiteralPath = /'[^']*\/[^']*'|"[^"]*\/[^"]*"/.test(args)

        if (hasLiteralPath) {
          continue // covered by the literal-url test
        }

        expect(
          allowedFeeders.has(file.fromSrc),
          `${file.fromSrc}: dynamic load call ${call[0].slice(0, 60)}… is not a canonical feeder — route it through the asset catalog or add a reviewed exception`,
        ).toBe(true)
      }
    }
  })
})
