import { chromium } from '@playwright/test'
import { resolve } from 'node:path'

const url = process.argv[2]
if (!url) throw new Error('Supply the verified worktree dev-server URL')
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage()
const errors = []
page.on('pageerror', error => errors.push(error.message))
const output = resolve('docs/design/tien-hiep-ui-redesign-2026-10-05/runtime-evidence')
try {
  await page.goto(`${url}/ui-design-review.html`)
  await page.locator('.design-review-grid a').last().waitFor()
  const entries = await page.locator('.design-review-grid a').evaluateAll(links => links.map(link => ({
    href: link.getAttribute('href'), image: link.querySelector('img').getAttribute('src').split('/').at(-1),
  })))
  if (entries.length !== 32) throw new Error(`Expected 32 designs; found ${entries.length}`)
  for (const [width, height] of [[1672, 941], [1280, 720]]) {
    await page.setViewportSize({ width, height })
    for (const entry of entries) {
      await page.goto(`${url}${entry.href}`)
      await page.evaluate(async () => {
        await document.fonts.ready
        await Promise.all([...document.images].map(image => image.decode()))
        await document.fonts.load('400 20px "PC Paper Serif"', 'Đạo Lộ Nguyễn Thể')
        await document.fonts.load('700 56px "PC Paper Serif"', 'Cảnh Giới')
      })
      const loaded = await page.evaluate(() => [...document.fonts].some(face => face.family === 'PC Paper Serif' && face.status === 'loaded'))
      if (!loaded) throw new Error(`${entry.href}: shared font was not loaded`)
      const overflow = await page.locator('.scene-design-canvas button').evaluateAll(buttons => buttons.flatMap(button => {
        const rect = button.getBoundingClientRect()
        if (!rect.width || !rect.height) return []
        const host = button.closest('.pc-paper-inspector')?.getBoundingClientRect()
        const insideViewport = rect.left >= -1 && rect.top >= -1 && rect.right <= innerWidth + 1 && rect.bottom <= innerHeight + 1
        const insideInspector = !host || (rect.left >= host.left - 1 && rect.top >= host.top - 1 && rect.right <= host.right + 1 && rect.bottom <= host.bottom + 1)
        return insideViewport && insideInspector ? [] : [button.textContent.trim()]
      }))
      if (overflow.length) throw new Error(`${entry.href} at ${width}: overflowing controls ${overflow.join(', ')}`)
      await page.screenshot({ path: resolve(output, entry.image.replace('-1672.png', `-${width}.png`)) })
    }
    console.log(`Captured ${entries.length} designs at ${width}; shared font and images loaded`)
  }
  await page.setViewportSize({ width: 1672, height: 941 })
  await page.goto(`${url}/ui-design-review.html`)
  await page.evaluate(async () => {
    await document.fonts.ready
    await Promise.all([...document.images].map(image => image.decode()))
  })
  await page.screenshot({ path: resolve(output, 'design-review-index-1672.png') })
  if (errors.length) throw new Error(errors.join('\n'))
  console.log('All gallery designs captured without page errors')
} finally {
  await browser.close()
}
