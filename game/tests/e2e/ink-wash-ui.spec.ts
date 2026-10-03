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
  expect(box!.x).toBeGreaterThanOrEqual(0)
  expect(box!.y).toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width)
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height)
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

      const primaryAction = auth.locator('.primary-action')
      const actionBox = await primaryAction.boundingBox()
      expect(actionBox).not.toBeNull()
      expect(actionBox!.width).toBeGreaterThanOrEqual(40)
      expect(actionBox!.height).toBeGreaterThanOrEqual(40)

      const authFrame = auth.locator('[data-ink-slice="frame-xl-ceremony"]').first()
      await expect(authFrame).toBeVisible()
      await expectInsideViewport(authFrame, page)
      await page.screenshot({
        path: testInfo.outputPath(`ink-wash-auth-${viewport.name}.png`),
        animations: 'disabled',
      })

      await page.getByTestId('auth-guest-button').click()
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

      await page.keyboard.press('Tab')
      const settingsSlot = page.locator('[data-wheel-slot="settings"]')
      await expect(settingsSlot).toBeVisible({ timeout: 10_000 })
      await settingsSlot.click()

      // Huyen Kim rebuild: settings rides the imperial scroll shell -
      // envelope + body/frame slices replace the old overlay card.
      const panel = page.locator('.hk-scroll__envelope').first()
      await expect(panel).toBeVisible()
      await expect(panel.locator('[data-hk-slice="imperial-scroll-body"]').first()).toBeVisible()
      await expect(panel.locator('[data-hk-slice="frame-xl-ceremony"]').first()).toBeVisible()

      // The scroll's reveal is clip-path (paper) + opacity (chrome), not
      // transform - wait for the unfold signature to land before measuring.
      // String-based evaluate (no DOM ambient types in e2e tsconfig).
      await page.waitForFunction(
        `(() => {
          const clip = document.querySelector('.hk-scroll__clip')
          if (!clip) return false
          return window.getComputedStyle(clip).clipPath === 'inset(0px)'
        })()`,
        undefined,
        { timeout: 5_000 },
      )

      const panelBox = await panel.boundingBox()
      const headingBox = await panel.locator('.hk-scroll__title').boundingBox()
      const settingsBox = await panel.locator('.settings-panel').boundingBox()
      expect(panelBox).not.toBeNull()
      expect(headingBox).not.toBeNull()
      expect(settingsBox).not.toBeNull()
      // The title plaque rides the envelope's top band - its text must be
      // horizontally centered inside the envelope and the settings
      // workspace must clear the nav-rail column on the left.
      expect(headingBox!.x).toBeGreaterThanOrEqual(panelBox!.x)
      expect(headingBox!.x + headingBox!.width).toBeLessThanOrEqual(panelBox!.x + panelBox!.width)
      expect(settingsBox!.x - panelBox!.x).toBeGreaterThanOrEqual(28)
      // Sectioned workspace: the autosave warning lives on the default
      // 'general' section; the ui-scale heading is behind 'display'.
      const settingsColors = await page.evaluate<{ warning: string }>(
        `({ warning: getComputedStyle(document.querySelector('.settings-panel__warning')).color })`,
      )
      await panel.locator('.settings-panel__nav-seal[data-section="display"]').click()
      const headingColor = await page.evaluate<string>(
        `getComputedStyle(document.querySelector('.settings-panel__ui-scale h4')).color`,
      )
      // .settings-panel .paper-on-dark remaps --paper-text* onto the
      // dark-surface ramp: heading = --surface-text, warning =
      // --surface-text-soft.
      expect(settingsColors.warning).toBe('rgb(168, 164, 152)')
      expect(headingColor).toBe('rgb(232, 228, 220)')
      await page.screenshot({
        path: testInfo.outputPath(`ink-wash-home-${viewport.name}.png`),
        animations: 'disabled',
      })
    })
  }
})
