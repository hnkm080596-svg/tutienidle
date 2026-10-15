// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.resetModules() })

it('resolves packaged root-relative assets beside the Electron entry document', async () => {
  vi.stubEnv('VITE_ASSET_BASE_URL', '')
  vi.stubGlobal('location', { protocol: 'file:' })
  const { resolveAssetUrl } = await import('./AssetBaseUrl')
  expect(resolveAssetUrl('/assets/audio/ui/ui_panel_open.wav')).toBe('./assets/audio/ui/ui_panel_open.wav')
  expect(resolveAssetUrl('assets/icon.png')).toBe('assets/icon.png')
  expect(resolveAssetUrl('https://cdn.test/icon.png')).toBe('https://cdn.test/icon.png')
  expect(resolveAssetUrl('//cdn.test/icon.png')).toBe('//cdn.test/icon.png')
})

it('preserves browser same-origin and explicitly configured CDN paths', async () => {
  vi.stubEnv('VITE_ASSET_BASE_URL', '')
  vi.stubGlobal('location', { protocol: 'http:' })
  let resolver = await import('./AssetBaseUrl')
  expect(resolver.resolveAssetUrl('/assets/icon.png')).toBe('/assets/icon.png')
  vi.stubEnv('VITE_ASSET_BASE_URL', 'https://cdn.test/')
  vi.resetModules()
  resolver = await import('./AssetBaseUrl')
  expect(resolver.resolveAssetUrl('/assets/icon.png')).toBe('https://cdn.test/assets/icon.png')
})
