// @vitest-environment node
// Guards for the 'ui-chrome'/'ui-scenes' art bundles:
// - every descriptor URL names a real file under public/ (a typo in a
//   raw-path literal would otherwise surface only as a runtime 404),
// - 'ui-scenes' never enters getBundlesForRoute - it is ~120MB and must
//   warm via artWarmWiring, not inside a transition's asset deadline.
// @ts-expect-error The project intentionally omits Node ambient types; Vitest supplies this at runtime.
import { existsSync } from 'node:fs'
// @ts-expect-error The project intentionally omits Node ambient types; Vitest supplies this at runtime.
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Route } from '../PresentationContracts'
import { SKILL_ICON_MANIFEST } from '@/data/skill/SkillIconManifest'
import {
  getBundlesForRoute,
  getUiChromeDescriptors,
  getUiSceneDescriptors,
} from './AssetBundleCatalog'

// @ts-expect-error Node ambient types are supplied by Vitest at runtime.
const PUBLIC_ROOT = join(process.cwd(), 'public')
const ALL_ROUTES: readonly Route[] = [
  'boot',
  'auth',
  'character',
  'home',
  'combat',
  'tribulation',
  'error',
]

describe('ui art bundles', () => {
  it("every 'ui-chrome'/'ui-scenes' descriptor resolves to a file under public/", () => {
    // SkillIconManifest deliberately declares icons whose placeholder PNGs
    // may not be dropped yet (they render as the slot monogram). The
    // manifest stays the warm authority; its URLs are presence-exempt.
    const manifestDeclared = new Set(Object.values(SKILL_ICON_MANIFEST))
    const missing: string[] = []
    for (const d of [...getUiChromeDescriptors(), ...getUiSceneDescriptors()]) {
      if (d.kind !== 'dom-image') continue
      if (manifestDeclared.has(d.url)) continue
      const path = d.url.startsWith('/') ? d.url.slice(1) : d.url
      if (!existsSync(join(PUBLIC_ROOT, path))) missing.push(d.url)
    }
    expect(missing).toEqual([])
  })

  it('chrome stays the small deadline-bound lane; scenes carries the mass', () => {
    const chrome = getUiChromeDescriptors()
    const scenes = getUiSceneDescriptors()
    expect(chrome.length).toBeGreaterThan(0)
    expect(scenes.length).toBeGreaterThan(0)
    expect(chrome.length).toBeLessThan(scenes.length)
  })

  it("'ui-scenes' never rides a transition deadline", () => {
    for (const route of ALL_ROUTES) {
      expect(getBundlesForRoute(route)).not.toContain('ui-scenes')
    }
  })
})
