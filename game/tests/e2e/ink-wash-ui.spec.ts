import { expect, test, type Locator, type Page } from '@playwright/test'
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

      const panel = page.locator('.overlay-panel__card').first()
      await expect(panel).toBeVisible()
      await expect(panel.locator('[data-ink-slice="frame-xl-ceremony"]').first()).toBeVisible()

      // Flake fix (2026-09-01): overlay-fade enter transition chạy
      // transform .22s sau khi visible — boundingBox đọc ngay làm
      // heading-offset >= 32 fail ngẫu nhiên (compact/tall dễ miss
      // timing hơn). Chờ panel transform ổn định trước khi đo.
      // Flake fix (2026-09-01): overlay-fade enter transition chạy
      // transform .22s sau khi visible — boundingBox đọc ngay làm
      // heading-offset >= 32 fail ngẫu nhiên (compact/tall dễ miss
      // timing hơn). Chờ panel transform ổn định trước khi đo.
      // String-based evaluate (no DOM ambient types in e2e tsconfig).
      await page.waitForFunction(
        `(() => {
          const card = document.querySelector('.overlay-panel__card')

          if (!card) {
            return false
          }

          const transform = window.getComputedStyle(card).transform

          // 'none' hoặc identity matrix = transition đã xong.
          return transform === 'none' || transform === 'matrix(1, 0, 0, 1, 0, 0)'
        })()`,
        undefined,
        { timeout: 5_000 },
      )

      const panelBox = await panel.boundingBox()
      const headingBox = await panel.locator('.overlay-panel__heading').boundingBox()
      const settingsBox = await panel.locator('.settings-panel').boundingBox()
      expect(panelBox).not.toBeNull()
      expect(headingBox).not.toBeNull()
      expect(settingsBox).not.toBeNull()
      expect(headingBox!.y - panelBox!.y).toBeGreaterThanOrEqual(32)
      expect(settingsBox!.x - panelBox!.x).toBeGreaterThanOrEqual(28)
      const settingsColors = await page.evaluate<{ warning: string; heading: string }>(
        `({
          warning: getComputedStyle(document.querySelector('.settings-panel__warning')).color,
          heading: getComputedStyle(document.querySelector('.settings-panel__ui-scale h4')).color,
        })`,
      )
      expect(settingsColors).toEqual({ warning: 'rgb(94, 90, 80)', heading: 'rgb(33, 31, 26)' })
      await page.screenshot({
        path: testInfo.outputPath(`ink-wash-home-${viewport.name}.png`),
        animations: 'disabled',
      })
    })
  }
})
