// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import appSource from '@/App.vue?raw'

const mountedStyles: HTMLStyleElement[] = []
const themeCss = readFileSync(resolve(process.cwd(), 'src/assets/theme.css'), 'utf8')
const rootThemeCss = themeCss.match(/:root\s*\{[\s\S]*?\}/)?.[0]

function mountStyles(css: string): void {
  const style = document.createElement('style')
  style.textContent = css.replace(/@import[^;]+;/g, '')
  document.head.appendChild(style)
  mountedStyles.push(style)
}

afterEach(() => {
  for (const style of mountedStyles.splice(0)) style.remove()
  document.body.className = ''
})

describe('ink-wash paper theme', () => {
  it('exposes the approved paper, brush, and pigment palette as runtime CSS tokens', () => {
    expect(rootThemeCss).toBeDefined()
    mountStyles(rootThemeCss ?? '')

    const root = getComputedStyle(document.documentElement)
    expect(root.getPropertyValue('--paper-50').trim()).toBe('#f5f0e4')
    expect(root.getPropertyValue('--brush-950').trim()).toBe('#171713')
    expect(root.getPropertyValue('--cinnabar').trim()).toBe('#b54432')
    expect(root.getPropertyValue('--mineral-jade').trim()).toBe('#668f78')
    expect(root.getPropertyValue('--paper-text').trim()).toBe('#211f1a')
  })

  it('uses white paper and dark ink for the non-world application fallback', () => {
    const appStyle = appSource.match(/<style>([\s\S]*?)<\/style>/)?.[1]
    expect(appStyle).toBeDefined()
    mountStyles(rootThemeCss ?? '')
    mountStyles(appStyle ?? '')

    const bodyStyle = getComputedStyle(document.body)
    expect(bodyStyle.background).toBe('var(--paper-50)')
    expect(bodyStyle.color).toBe('var(--paper-text)')

    const error = document.createElement('main')
    error.className = 'boot-error'
    document.body.appendChild(error)
    expect(getComputedStyle(error).background).toBe('var(--paper-50)')
    error.remove()
  })
})
