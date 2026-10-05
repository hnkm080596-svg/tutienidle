import { expect, test } from './fixtures'
import { bootToGuestHome, createCharacterThroughUi, enterHome, collectBrowserErrors, assertNoBrowserErrors } from './helpers'

const evidence = 'docs/design/tien-hiep-ui-redesign-2026-10-05/runtime-evidence'
test('production progression paper preserves selections and release admission', async ({ page }) => {
  test.setTimeout(180_000)
  const errors = collectBrowserErrors(page)
  await bootToGuestHome(page)
  await createCharacterThroughUi(page, 'Progression QA')
  await enterHome(page)
  for (const [width, height] of [[1280,720],[1672,941]]) {
    await page.setViewportSize({ width:width!, height:height! })
    for (const kind of ['realm','body','skill']) {
      await page.evaluate(async kind => {
        const { useUiStore } = await import(/* @vite-ignore */ String('/src/stores/ui.ts'))
        useUiStore().openStandalonePanel(kind as 'realm' | 'body' | 'skill')
      }, kind)
      const root = page.locator(`.pc-progression--${kind}`)
      await expect(root).toBeVisible()
      await expect(root.locator('.pc-paper-scene')).toBeVisible()
      if (kind === 'realm') {
        await root.locator('.realm-marker').nth(1).click()
        await expect(root.locator('.realm-marker').nth(1)).toHaveAttribute('aria-pressed','true')
        await expect(root.locator('.realm-notice')).not.toBeEmpty()
      }
      if (kind === 'body') {
        await root.locator('.body-unit-rail button').last().click()
        await expect(root.locator('.body-unit-rail button').last()).toHaveAttribute('aria-pressed','true')
        await expect(root.locator('.pc-body-diagram > img')).toBeVisible()
      }
      if (kind === 'skill' && await root.locator('.skill-positioned-node').count()) {
        await root.locator('.skill-positioned-node').first().click()
        await expect(root.locator('.skill-paper-details')).toBeVisible()
      }
      await page.screenshot({ path:`${evidence}/wire-progression-${kind}-${width}.png` })
      await root.locator('.pc-paper-scene-actions button').last().click()
      await expect(root.locator('[data-nav-id="technique"]')).toHaveAttribute('aria-disabled','true')
      await root.locator('[data-nav-id="technique"]').dispatchEvent('click')
      await expect(root).toBeVisible()
      await page.keyboard.press('Escape')
      await page.keyboard.press('Escape')
      await expect(root).toHaveCount(0)
    }
    await page.evaluate(async () => {
      const { useUiStore } = await import(/* @vite-ignore */ String('/src/stores/ui.ts'))
      useUiStore().openLeftPanel('stage_select')
    })
    const exploration = page.locator('.pc-progression--exploration')
    await expect(exploration).toBeVisible()
    await exploration.locator('[data-stage-id]').filter({ hasNot: page.locator('.lock-mark') }).first().click()
    await expect(page.getByTestId('stage-start-button')).toBeVisible()
    await page.screenshot({ path:`${evidence}/wire-progression-exploration-${width}.png` })
    await page.keyboard.press('Escape')
  }
  assertNoBrowserErrors(errors)
})
