import { expect, test } from './fixtures'

import { bootToGuestHome, createCharacterThroughUi, enterHome } from './helpers'

/**
 * Presentation coordinator migration regression spec (Task 1 baseline).
 *
 * F14 finding: existing create-to-combat.spec.ts asserts DOM overlays only.
 * This spec adds the missing Phaser scene-state assertion: after clicking
 * stage-start, CombatScene must be active and MainScene must be inactive
 * in the actual Phaser scene manager.
 */
test.describe('Presentation routing regression (Task 1 baseline)', () => {
  test('stage start activates CombatScene and deactivates MainScene in Phaser', async ({ page }) => {
    test.setTimeout(120_000)

    page.on('console', (msg) => console.log('BROWSER:', msg.text()))

    await bootToGuestHome(page)
    await createCharacterThroughUi(page, 'E2E Presentation 01')
    await enterHome(page)

    // Open command wheel via Tab, then teleport_array slot -> stage select.
    await page.keyboard.press('Tab')
    const teleportSlot = page.locator('[data-wheel-slot="teleport_array"]')
    await expect(teleportSlot).toBeVisible({ timeout: 10_000 })
    await teleportSlot.click()

    const overlay = page.getByTestId('function-overlay-panel')
    await expect(overlay).toBeVisible({ timeout: 10_000 })

    const startButton = page.getByTestId('stage-start-button')
    await expect(startButton).toBeEnabled({ timeout: 10_000 })
    await startButton.click()

    // Assert immediately after click, BEFORE waiting for any result: the
    // Phaser scene manager must show CombatScene active and MainScene
    // inactive. This is the actual navigation contract the presentation
    // coordinator migration replaces.
    await expect
      .poll(() =>
        page.evaluate(() => {
          const game = (window as Window & {
            __tutienPhaserGame?: { scene: { isActive(key: string): boolean } }
          }).__tutienPhaserGame
          return (
            Boolean(game?.scene.isActive('CombatScene')) && !game?.scene.isActive('MainScene')
          )
        }),
      )
      .toBe(true)
  })
})
