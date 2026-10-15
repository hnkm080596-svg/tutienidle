import { expect, test, type Locator, type Page } from './fixtures'
import { createCharacterThroughUi, enterHome } from './helpers'

const VIEWPORTS = [
  { name: 'desktop', width: 1600, height: 900 },
  { name: 'compact', width: 1366, height: 768 },
  { name: 'tall', width: 900, height: 1200 },
] as const

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const geometry = await page.evaluate<{ clientWidth: number; scrollWidth: number }>(
    '({ clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth })',
  )
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth)
}

async function expectInsideViewport(locator: Locator, page: Page): Promise<void> {
  const box = await locator.boundingBox()
  const viewport = page.viewportSize()
  expect(box).not.toBeNull()
  expect(viewport).not.toBeNull()
  expect(box!.x).toBeGreaterThanOrEqual(-1)
  expect(box!.y).toBeGreaterThanOrEqual(-1)
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width + 1)
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height + 1)
}

test.describe('ink-wash UI visual smoke', () => {
  for (const viewport of VIEWPORTS) {
    test(`${viewport.name}: painting shell stays usable and inside the viewport`, async ({ page }, testInfo) => {
      await page.setViewportSize(viewport)
      await page.addInitScript(() => localStorage.clear())
      await page.goto('/')

      const auth = page.getByTestId('auth-screen')
      await expect(auth).toBeVisible({ timeout: 15_000 })
      await expectNoHorizontalOverflow(page)

      const primaryAction = auth.getByTestId('auth-guest-button')
      await expect(primaryAction).toBeVisible()
      const actionBox = await primaryAction.boundingBox()
      expect(actionBox).not.toBeNull()
      expect(actionBox!.width).toBeGreaterThanOrEqual(40)
      expect(actionBox!.height).toBeGreaterThanOrEqual(40)

      const authFrame = auth.getByTestId('login-opening')
      await expect(authFrame).toBeVisible()
      await expectInsideViewport(authFrame, page)
      await page.screenshot({
        path: testInfo.outputPath(`ink-wash-auth-${viewport.name}.png`),
        animations: 'disabled',
      })

      await primaryAction.click()
      const creation = page.getByTestId('character-creation-screen')
      await expect(creation).toBeVisible({ timeout: 15_000 })
      await expectNoHorizontalOverflow(page)
      await page.screenshot({
        path: testInfo.outputPath(`ink-wash-creation-${viewport.name}.png`),
        animations: 'disabled',
      })

      await createCharacterThroughUi(page, `Mặc${viewport.width}`)
      await enterHome(page)
      await expectNoHorizontalOverflow(page)

      await page.keyboard.press('`')
      const settingsSlot = page.locator('[data-wheel-slot="settings"]')
      await expect(settingsSlot).toBeVisible({ timeout: 10_000 })
      await settingsSlot.click()

      // Huyen Kim rebuild: settings owns the shared paper chrome -
      // nine-slice sheet + title on the overlay canvas.
      const panel = page.locator('.settings-scene').first()
      await expect(panel).toBeVisible()
      await expect(panel.locator('.game-panel')).toBeVisible()
      await expect(page.locator('.th-panel-swap-enter-active')).toHaveCount(0)
      const paperBox = await panel.locator('.game-panel').boundingBox()

      const headingBox = await panel.locator('.game-panel__title').boundingBox()
      const settingsBox = await panel.locator('.settings-panel').boundingBox()
      expect(paperBox).not.toBeNull()
      expect(headingBox).not.toBeNull()
      expect(settingsBox).not.toBeNull()
      // The title rides the paper's top band - both title and workspace
      // must sit inside the GamePanel sheet (within 1px sub-pixel scale tolerance).
      expect(headingBox!.x).toBeGreaterThanOrEqual(paperBox!.x - 1)
      expect(headingBox!.x + headingBox!.width).toBeLessThanOrEqual(paperBox!.x + paperBox!.width + 1)
      expect(settingsBox!.x).toBeGreaterThanOrEqual(paperBox!.x - 1)
      // Sectioned workspace: the autosave warning lives on the default
      // 'general' section; the ui-scale GameCard lives behind 'display'.
      await expect(panel.locator('.settings-panel__warning')).toBeVisible()
      await panel.locator('.settings-panel__nav-seal[data-section="display"]').click()
      await expect(panel.locator('.settings-panel__ui-scale .game-card__title')).toBeVisible()
      const sectionColor = await page.evaluate<string>(
        `getComputedStyle(document.querySelector('.settings-panel__ui-scale')).color`,
      )
      expect(sectionColor).toBe('rgb(243, 228, 196)')
      await page.screenshot({
        path: testInfo.outputPath(`ink-wash-home-${viewport.name}.png`),
        animations: 'disabled',
      })
    })
  }
})
