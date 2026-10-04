// StableSceneArt registry - guards the stable-art contract: parallax
// stacks keep manifest order/drift and no provenance/banned path can
// leak into runtime URLs. On-disk file existence is covered by the
// pack validator (generate-scene-extension.mjs --check).
import { describe, expect, it } from 'vitest'
import {
  stableParallaxStack,
  stableSceneArtUrl,
  stableSceneLayer,
  stableSymbolUrl,
  STABLE_PARALLAX_STACK_IDS,
  STABLE_SYMBOL_IDS,
} from './StableSceneArt'

describe('StableSceneArt registry', () => {
  it('exposes exactly the three contract parallax stacks', () => {
    expect(STABLE_PARALLAX_STACK_IDS).toEqual(['auth-creation', 'realm-ascent', 'skill-tree'])
  })

  it.each([
    ['auth-creation', ['00-sky', '01-far-mountains', '02-mid-landscape', '03-focal-architecture', '04-low-mist', '05-foreground']],
    ['realm-ascent', ['00-sky', '01-far-mountains', '02-mid-ascent', '03-summit-architecture', '04-low-mist']],
    ['skill-tree', ['00-sky', '01-far-mountains', '02-celestial-field', '03-atmosphere']],
  ] as const)('orders the %s stack per the extension contract', (stackId, suffixes) => {
    const layers = stableParallaxStack(stackId)

    expect(layers.map((layer) => layer.outputBase.split('/').pop())).toEqual([...suffixes])
    expect(layers.map((layer) => layer.parallax.order)).toEqual(suffixes.map((_, index) => index))
  })

  it('keeps near layers drifting more than far layers (contract order)', () => {
    for (const stackId of STABLE_PARALLAX_STACK_IDS) {
      const layers = stableParallaxStack(stackId)
      for (let index = 1; index < layers.length; index++) {
        const prev = layers.at(index - 1)
        const next = layers.at(index)
        expect(next?.parallax.maxDriftPx.x ?? -1).toBeGreaterThanOrEqual(prev?.parallax.maxDriftPx.x ?? 0)
        expect(next?.parallax.maxDriftPx.y ?? -1).toBeGreaterThanOrEqual(prev?.parallax.maxDriftPx.y ?? 0)
      }
      // L0 is the opaque static base.
      expect(layers[0]?.alpha).toBe(false)
      expect(layers[0]?.parallax.maxDriftPx).toEqual({ x: 0, y: 0 })
    }
  })

  it('resolves only shipped @1x/@2x PNG pairs — never _source or master composites', () => {
    const allIds = [
      ...STABLE_PARALLAX_STACK_IDS.flatMap((stackId) => stableParallaxStack(stackId).map((layer) => layer.assetId)),
      'body-cultivation-figure', 'body-meridian-overlay', 'technique-display-plinth',
      'equipment-paperdoll-base', 'exploration-map-frame', 'exploration-map-mask',
      'exploration-chapter-divider', 'tribulation-storm-far', 'tribulation-storm-near',
      'tribulation-dais', 'tribulation-sky-vignette',
    ]

    for (const assetId of allIds) {
      for (const density of ['@1x', '@2x'] as const) {
        const url = stableSceneArtUrl(assetId, density)
        expect(url).toMatch(/^\/assets\/ui\/huyen-kim\//)
        expect(url).toContain(`${density}.png`)
        expect(url).not.toContain('_source')
        expect(url).not.toContain('master')
      }
    }
  })

  it('serves srcset-ready urls on stack layers', () => {
    const layer = stableParallaxStack('realm-ascent').at(0)
    expect(layer?.src1x).toContain('@1x.png')
    expect(layer?.src2x).toContain('@2x.png')
  })

  it('rejects unknown asset ids', () => {
    expect(() => stableSceneLayer('not-a-layer')).toThrow(/unknown asset id/)
    expect(() => stableSceneArtUrl('not-a-layer')).toThrow(/unknown asset id/)
  })

  it('maps every declared symbol to its shipped SVG url', () => {
    expect(STABLE_SYMBOL_IDS).toHaveLength(53)
    for (const id of STABLE_SYMBOL_IDS) {
      expect(stableSymbolUrl(id)).toBe(`/assets/ui/huyen-kim/symbols/${id}.svg`)
    }
  })
})
