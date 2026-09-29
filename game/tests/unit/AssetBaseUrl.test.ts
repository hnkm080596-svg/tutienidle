import { describe, expect, it } from 'vitest'

import { getAssetBaseUrl, resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'

// The env is baked at build time - in this test context VITE_ASSET_BASE_URL is
// unset, so resolution must be an identity transform (same-origin default).
describe('resolveAssetUrl', () => {
  it('is identity when VITE_ASSET_BASE_URL is unset', () => {
    expect(getAssetBaseUrl()).toBe('')
    expect(resolveAssetUrl('/assets/enemies/mortal/slime.png')).toBe(
      '/assets/enemies/mortal/slime.png',
    )
    expect(resolveAssetUrl('assets/ui/ink-wash/atlas/ink-wash-ui.png')).toBe(
      'assets/ui/ink-wash/atlas/ink-wash-ui.png',
    )
  })

  it('passes absolute/data/blob urls through unchanged regardless of base', () => {
    expect(resolveAssetUrl('https://cdn.example.com/x.png')).toBe(
      'https://cdn.example.com/x.png',
    )
    expect(resolveAssetUrl('//cdn.example.com/x.png')).toBe('//cdn.example.com/x.png')
    expect(resolveAssetUrl('data:image/png;base64,AAAA')).toBe('data:image/png;base64,AAAA')
    expect(resolveAssetUrl('blob:https://app/x-y')).toBe('blob:https://app/x-y')
  })
})
