// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules() })

it('routes CSS art through the configured asset origin before views mount', async () => {
  vi.stubEnv('VITE_ASSET_BASE_URL', 'https://assets.example.test/')
  vi.resetModules()
  const { installTienHiepUiAssets } = await import('./TienHiepUiAssets')
  const root = document.createElement('div')
  installTienHiepUiAssets(root)
  expect(root.style.getPropertyValue('--th-art-panel-frame-v2')).toBe('url("https://assets.example.test/assets/ui/tien-hiep-2026-10/runtime/panel-frame-v2.png")')
  expect(root.style.getPropertyValue('--th-art-world-vista')).toContain('https://assets.example.test/assets/')
})

it('keeps same-origin CSS art when no asset origin is configured', async () => {
  vi.stubEnv('VITE_ASSET_BASE_URL', '')
  vi.resetModules()
  const { installTienHiepUiAssets } = await import('./TienHiepUiAssets')
  const root = document.createElement('div')
  installTienHiepUiAssets(root)
  expect(root.style.getPropertyValue('--th-art-navigation-rail')).toBe('url("/assets/ui/tien-hiep-2026-10/runtime/navigation-rail.png")')
})
