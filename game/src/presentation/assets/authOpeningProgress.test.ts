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

  it('loads Stage 1 (cloud curtain and crane strip) completely before starting Stage 2+ and reports accurate progress', async () => {
    const resources = enumerateResources(getBundlesForRoute('auth'))
    const totalCount = resources.length
    const startedUrls: string[] = []
    const resolvers: Array<() => void> = []
    const progress: AssetLoadProgress[] = []
    const manager = new AssetBundleManager({
      domImageLoader: (url) =>
        new Promise<void>((resolve) => {
          startedUrls.push(url)
          resolvers.push(resolve)
        }),
    })
    const loading = manager.ensureFor(
      { target: 'auth' },
      new AbortController().signal,
      (value) => progress.push(value),
    )

    // Initially, only Stage 1 (cloud-curtain-v1.png + crane-flight-strip-v1.png) has started.
    expect(progress.at(-1)).toEqual({ completed: 0, total: totalCount })
    expect(startedUrls).toEqual([
      '/assets/ui/tien-hiep-2026-10/auth-opening/cloud-curtain-v1.png',
      '/assets/ui/tien-hiep-2026-10/auth-opening/crane-flight-strip-v1.png',
    ])

    // Resolving the cloud curtain alone updates progress to 1, and Stage 2 still waits for crane.
    resolvers[0]!()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(progress.at(-1)).toEqual({ completed: 1, total: totalCount })
    expect(startedUrls).toHaveLength(2)

    // Resolving the crane strip completes Stage 1 and unlocks Stage 2 (backdrop + login scroll).
    resolvers[1]!()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(progress.at(-1)).toEqual({ completed: 2, total: totalCount })
    expect(startedUrls.length).toBeGreaterThan(2)
    expect(startedUrls[2]).toBe('/assets/ui/tien-hiep-2026-10/auth-opening/backdrop-clean-v1.png')

    // Drain remaining stages in waves until all resources complete.
    let resolvedIndex = 2
    while (resolvedIndex < totalCount) {
      const waveEnd = resolvers.length
      expect(waveEnd).toBeGreaterThan(resolvedIndex)
      while (resolvedIndex < waveEnd) {
        resolvers[resolvedIndex++]!()
      }
      await new Promise((resolve) => setTimeout(resolve, 0))
    }

    await loading
    expect(progress.at(-1)).toEqual({ completed: totalCount, total: totalCount })
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
