import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { describe, expect, it } from 'vitest'
import LoginSceneVista from './LoginSceneVista.vue'
import { LOGIN_ART } from './loginArt'

describe('approved auth opening art', () => {
  it('renders the shared approved backdrop and standing mortal', async () => {
    const html = await renderToString(createSSRApp(LoginSceneVista))
    expect(html).toContain('src="/assets/ui/tien-hiep-2026-10/auth-opening/backdrop-clean-v1.png"')
    expect(html).toContain('src="/assets/ui/tien-hiep-2026-10/auth-opening/mortal-wind-strip-v1.png"')
    expect(html).not.toContain('/login-v2/cultivator.png')
  })

  it('exports stable backdrop, mortal and right-facing crane URLs for the loader', () => {
    const art = LOGIN_ART as Record<string, string>
    for (const [key, filename] of Object.entries({ backdrop: 'backdrop-clean-v1.png', mortal: 'mortal-wind-strip-v1.png', crane: 'crane-flight-strip-v1.png' })) {
      expect(art[key]).toBe(`/assets/ui/tien-hiep-2026-10/auth-opening/${filename}`)
    }
  })
})
