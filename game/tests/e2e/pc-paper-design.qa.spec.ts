import { expect, test } from './fixtures'

test('one paper composition renders the nine static visual examples at PC sizes', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  const failedAssets: string[] = []
  page.on('response', response => { if (response.status() >= 400 && response.url().includes('/assets/')) failedAssets.push(response.url()) })
  for (const [width, height] of [[1672, 941], [1280, 720]]) {
    await page.setViewportSize({ width: width!, height: height! })
    for (const example of ['inventory', 'body', 'equipment', 'graph', 'map', 'progression', 'list', 'settings', 'crafting']) {
      await page.goto(`/ui-design-system.html?example=${example}`)
      const shell = page.locator('.pc-paper-scene')
      await expect(shell).toHaveAttribute('data-design-example', example)
      await expect(shell).toHaveCSS('background-image', /shared-paper-page-v1\.png/)
      await expect(page.locator('.pc-paper-scene__header h1')).toBeVisible()
      if (example !== 'progression') {
      await expect(page.locator('.pc-paper-tabs button').first()).toHaveAttribute('aria-pressed', 'true')
      await page.locator('.pc-paper-tabs button').nth(1).click()
      await expect(page.locator('.pc-paper-tabs button').nth(1)).toHaveAttribute('aria-pressed', 'true')
      await page.locator('.pc-paper-tabs button').first().click()
      }
      await page.evaluate(async () => {
        await document.fonts.ready
        await Promise.all([...document.images].map(image => image.decode().catch(() => undefined)))
      })
      const inspectorActionsFit = await page.locator('.pc-paper-inspector .pc-paper-button').evaluateAll(buttons => buttons.every(button => {
        const panel = button.closest('.pc-paper-inspector')!.getBoundingClientRect()
        const action = button.getBoundingClientRect()
        return action.bottom <= panel.bottom + 1 && action.left >= panel.left - 1 && action.right <= panel.right + 1
      }))
      expect(inspectorActionsFit).toBe(true)
      const bounds = await shell.boundingBox()
      expect(bounds!.x).toBeGreaterThanOrEqual(-1)
      expect(bounds!.y).toBeGreaterThanOrEqual(-1)
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width! + 1)
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(height! + 1)
      await page.screenshot({ path: `docs/design/tien-hiep-ui-redesign-2026-10-05/runtime-evidence/design-paper-${example}-${width}.png` })
    }
  }
  expect(errors).toEqual([])
  expect(failedAssets).toEqual([])
})

test('character and cultivation scene designs render at both PC sizes', async ({ page }) => {
  const errors: string[] = []
  const failedAssets: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('response', response => { if (response.status() >= 400 && response.url().includes('/assets/')) failedAssets.push(response.url()) })
  for (const [width, height] of [[1672, 941], [1280, 720]]) {
    await page.setViewportSize({ width: width!, height: height! })
    for (const example of ['character', 'creation', 'technique', 'meridian', 'zhou']) {
      await page.goto(`/ui-character-progression-design.html?example=${example}`)
      await expect(page.locator('.pc-paper-scene')).toHaveAttribute('data-character-design', example)
      if (example === 'creation') {
        await page.locator('.cp-talent-choices button').nth(1).click()
        await expect(page.locator('.cp-talent-choices button').nth(1)).toHaveClass('selected')
      }
      await page.evaluate(async () => {
        await document.fonts.ready
        await Promise.all([...document.images].map(image => image.decode().catch(() => undefined)))
      })
      const actionsFit = await page.locator('.pc-paper-inspector .pc-paper-button').evaluateAll(buttons => buttons.every(button => {
        const panel = button.closest('.pc-paper-inspector')!.getBoundingClientRect()
        const action = button.getBoundingClientRect()
        return action.bottom <= panel.bottom + 1
      }))
      expect(actionsFit).toBe(true)
      await page.screenshot({ path: `docs/design/tien-hiep-ui-redesign-2026-10-05/runtime-evidence/design-paper-${example}-${width}.png` })
    }
  }
  expect(errors).toEqual([])
  expect(failedAssets).toEqual([])
})

test('body diagram effects respect reduced motion without changing geometry', async ({ page }) => {
  for (const [route, example] of [['ui-design-system', 'body'], ['ui-character-progression-design', 'meridian'], ['ui-character-progression-design', 'zhou']]) {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto(`/${route}.html?example=${example}`)
    const diagram = page.locator('.pc-body-diagram')
    await expect(diagram.locator('img')).toHaveAttribute('src', /body-diagram-v1\.png/)
    await expect(diagram).toHaveCSS('pointer-events', 'none')
    const aura = diagram.locator('.pc-acupoint-aura').first()
    await expect(aura).toHaveCSS('animation-name', 'pc-acupoint-breathe')
    const anchor = await aura.boundingBox()
    const frame = await aura.evaluate(element => getComputedStyle(element).backgroundPosition)
    await expect.poll(() => aura.evaluate(element => getComputedStyle(element).backgroundPosition)).not.toBe(frame)
    expect(await aura.boundingBox()).toEqual(anchor)
    const before = await diagram.boundingBox()
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await expect(aura).toHaveCSS('animation-name', 'none')
    await expect(aura).toHaveCSS('background-image', /acupoint-aura-poster\.png/)
    await expect(diagram.locator('.pc-body-diagram__trace')).toHaveCSS('animation-name', 'none')
    expect(await diagram.boundingBox()).toEqual(before)
  }
})




