import { describe, expect, it } from 'vitest'
import { AssetBundleManager, type AssetLoadProgress } from './AssetBundleManager'
import { enumerateResources, getBundlesForRoute } from './AssetBundleCatalog'

describe('auth opening required resource progress', () => {
  it('requires DOM-only opening art before auth can be revealed', () => {
    const resources = enumerateResources(getBundlesForRoute('auth'))
    expect(resources.length).toBeGreaterThan(3)
    expect(resources.every((resource) => resource.kind === 'dom-image')).toBe(true)
    expect(resources.some((resource) => resource.kind === 'dom-image' && resource.url.includes('mortal'))).toBe(true)
  })

  it('reports actual completed loads and never counts a pending image', async () => {
    const resolvers: Array<() => void> = []
    const progress: AssetLoadProgress[] = []
    const manager = new AssetBundleManager({
      domImageLoader: () => new Promise<void>((resolve) => resolvers.push(resolve)),
    })
    const loading = manager.ensureFor({ target: 'auth' }, new AbortController().signal, (value) => progress.push(value))
    expect(progress.at(-1)).toEqual({ completed: 0, total: resolvers.length })
    expect(resolvers.length).toBeGreaterThan(3)
    resolvers[0]!()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(progress.at(-1)).toEqual({ completed: 1, total: resolvers.length })
    for (const resolve of resolvers.slice(1)) resolve()
    await loading
    expect(progress.at(-1)).toEqual({ completed: resolvers.length, total: resolvers.length })
  })

  it('rejects failures without claiming complete and can retry', async () => {
    let fail = true
    const progress: AssetLoadProgress[] = []
    const manager = new AssetBundleManager({ domImageLoader: async () => { if (fail) throw new Error('offline') } })
    await expect(manager.ensureFor({ target: 'auth' }, new AbortController().signal, (value) => progress.push(value))).rejects.toThrow('offline')
    expect(progress.at(-1)!.completed).toBeLessThan(progress.at(-1)!.total)
    fail = false
    await manager.ensureFor({ target: 'auth' }, new AbortController().signal, (value) => progress.push(value))
    expect(progress.at(-1)!.completed).toBe(progress.at(-1)!.total)
  })
})
