import { chromium } from '@playwright/test'
import { resolve } from 'node:path'

const url = process.argv[2]
if (!url) throw new Error('Supply the verified worktree dev-server URL')
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage()
const errors = []
page.on('pageerror', error => errors.push(error.message))
try {
  await page.setViewportSize({ width: 1672, height: 941 })
  await page.goto(`${url}/ui-design-review.html`)
  await page.locator('.design-review-grid a').last().waitFor()
  await page.evaluate(async () => {
    await document.fonts.ready
    await Promise.all([...document.images].map(image => image.decode()))
  })
  if (await page.locator('.design-review-grid a').count() < 12) {
    throw new Error('The visual review index is missing the original completed examples')
  }
  await page.screenshot({ path: resolve('docs/design/tien-hiep-ui-redesign-2026-10-05/runtime-evidence/design-review-index-1672.png') })
  for (const [width, height] of [[1672, 941], [1280, 720]]) {
    await page.setViewportSize({ width, height })
    for (const example of ['home', 'opening']) {
      await page.goto(`${url}/ui-landscape-design.html?example=${example}`)
      await page.locator(`[data-design-example="${example}"]`).waitFor()
      await page.evaluate(async () => {
        await document.fonts.ready
        await Promise.all([...document.images].map(image => image.decode()))
      })
      const controlsFit = await page.locator('.landscape-design button').evaluateAll(buttons => buttons.every(button => {
        const rect = button.getBoundingClientRect()
        return rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth + 1 && rect.bottom <= innerHeight + 1
      }))
      if (!controlsFit) throw new Error(`${example} controls overflow at ${width}`)
      const path = name => resolve(`docs/design/tien-hiep-ui-redesign-2026-10-05/runtime-evidence/design-landscape-${name}-${width}.png`)
      await page.screenshot({ path: path(example) })
      if (example === 'opening') {
        await page.locator('.opening-design-actions button').click()
        await page.getByPlaceholder('Nhập ID đạo hữu').waitFor()
        await page.screenshot({ path: path('entry-menu') })
      }
    }
  }
  if (errors.length) throw new Error(errors.join('\n'))
  console.log('Captured six landscape design states at two PC sizes; no page errors or overflowing buttons')
} finally {
  await browser.close()
}
