import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { describe, expect, it } from 'vitest'
import HuyenKimSymbol from './HuyenKimSymbol.vue'
describe('painted talent art keeps its authored color', () => {
  it('renders talent illustrations as an image rather than a tint mask', async () => {
    const html = await renderToString(createSSRApp(HuyenKimSymbol, { name: 'talent-thu_phat' }))
    expect(html).toContain('<img')
    expect(html).toContain('talents-painted-v1/thu_phat.webp')
    expect(html).not.toContain('hk-symbol--glyph')
  })
  it('keeps the normal navigation glyph contract', async () => {
    const html = await renderToString(createSSRApp(HuyenKimSymbol, { name: 'technique' }))
    expect(html).toContain('hk-symbol--glyph')
    expect(html).not.toContain('<img')
  })
})
