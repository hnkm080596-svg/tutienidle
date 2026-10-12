import { expect, test } from './fixtures'
import { bootToGuestHome, createCharacterThroughUi, enterHome } from './helpers'

test('audit observes combat transition through the production deadline', async ({ page }, testInfo) => {
  test.setTimeout(180_000)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text())
  })
  try {
    await bootToGuestHome(page)
    await createCharacterThroughUi(page, 'Audit Chuyen Canh')
    await enterHome(page)
    await page.keyboard.press('`')
    await page.locator('[data-wheel-slot="teleport_array"]').click()
    await expect(page.locator('.exploration-scene')).toBeVisible()
    await page.getByTestId('stage-start-button').click()
    await page.waitForFunction(() => {
      const overlay = document.querySelector('[data-testid="presentation-overlay"]')
      return document.querySelector('.combat-top-bar') !== null || overlay?.getAttribute('data-phase') === 'failed'
    }, undefined, { timeout: 90_000 })
    await expect(page.locator('.combat-top-bar')).toBeVisible()
  } finally {
    await testInfo.attach('transition-observation', {
      body: JSON.stringify({ errors, phase: await page.getByTestId('presentation-overlay').getAttribute('data-phase') }, null, 2),
      contentType: 'application/json',
    })
  }
})
