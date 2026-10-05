import { expect, test } from './fixtures'
import sharp from 'sharp'
import { assertNoBrowserErrors, bootToGuestHome, collectBrowserErrors, createCharacterThroughUi, enterHome, waitForPresentationIdle } from './helpers'

const evidence = 'docs/design/tien-hiep-ui-redesign-2026-10-05/runtime-evidence'

test('PC outcome and support fixtures retain visible data and interactions', async ({ page }) => {
  const errors = collectBrowserErrors(page)
  await page.setViewportSize({ width: 1672, height: 941 })
  for (const [id, root] of [['quest', '.quest-scene'], ['settings', '.pc-settings-root'], ['victory', '.victory-fidelity'], ['defeat', '.defeat-scene'], ['tribulation', '.tribulation-hud'], ['combat', '.combat-hud']]) {
    await page.goto(`/ui-${id}.html`)
    await expect(page.locator(root!)).toBeVisible()
    await page.screenshot({ path: `${evidence}/pc-rebuilt-${id}.png` })
    if (id === 'quest') {
      await page.locator('.quest-list button').first().click()
      await expect(page.locator('.quest-detail')).toBeVisible()
      await page.locator('.quest-detail .action').click()
      await expect(page.locator('.quest-notice')).not.toBeEmpty()
    }
    if (id === 'settings') {
      await page.locator('.settings-layout nav button').filter({ hasText: 'Âm Thanh' }).click()
      await expect(page.locator('.settings-workspace')).toContainText('Âm Thanh')
    }
    if (id === 'victory') {
      await expect(page.locator('.victory-header h1')).not.toBeEmpty()
      await page.locator('.victory-actions .retry').click()
      await expect(page.locator('.victory-notice')).not.toBeEmpty()
    }
    if (id === 'defeat') {
      await page.locator('.actions .retry').click()
      await expect(page.locator('.notice')).not.toBeEmpty()
    }
    if (id === 'tribulation') {
      await page.locator('.review-phases button').first().click()
      await expect(page.locator('.question-card')).toBeVisible()
      await page.locator('.answers button').first().click()
      await expect(page.locator('.answers button').first()).toHaveAttribute('aria-pressed', 'true')
    }
    if (id === 'combat') {
      await page.locator('.pause').click()
      await expect(page.locator('.pause')).toHaveAttribute('aria-pressed', 'true')
    }
  }
  assertNoBrowserErrors(errors)
})

test('production quest and settings retain their actual controls in the rebuilt workspace', async ({ page }) => {
  const errors = collectBrowserErrors(page)
  await page.setViewportSize({ width: 1672, height: 941 })
  await bootToGuestHome(page)
  await createCharacterThroughUi(page, 'Kiểm UI')
  await enterHome(page)
  await page.locator('[data-df-navigation="quest"]').click()
  await expect(page.locator('.quest-scene')).toBeVisible()
  await expect(page.locator('.quest-list-slot')).toBeVisible()
  await page.screenshot({ path: `${evidence}/pc-production-quest.png` })
  await page.keyboard.press('Escape')
  await page.locator('.df-utility').filter({ has: page.locator('img[src*="settings"]') }).click()
  await expect(page.locator('.settings-panel')).toBeVisible()
  await expect(page.getByTestId('settings-save-button')).toBeVisible()
  await page.getByTestId('settings-save-button').click()
  await page.screenshot({ path: `${evidence}/pc-production-settings.png` })
  await page.keyboard.press('Escape')
  await expect(page.locator('.pc-settings-root')).toHaveCount(0)
  assertNoBrowserErrors(errors)
})

test('shared PC dialogs keep readable paper chrome and close interactions', async ({ page }) => {
  const errors = collectBrowserErrors(page)
  await page.setViewportSize({ width: 1672, height: 941 })
  await page.goto('/ui-secondary.html')
  await page.locator('[data-preview-tab="system"]').click()
  for (const [id, root] of [['confirm', '.confirm-modal__panel'], ['offline', '.offline-summary__panel'], ['feedback', '.feedback-dialog'], ['lore', '.lore-modal__panel']]) {
    await page.locator(`[data-preview-dialog="${id}"]`).click()
    await expect(page.locator(root!)).toBeVisible()
    await page.waitForTimeout(450)
    await page.screenshot({ path: `${evidence}/pc-dialog-${id}.png` })
    if (id === 'offline' || id === 'confirm') {
      const { data, info } = await sharp(await page.locator(root!).screenshot()).removeAlpha().raw().toBuffer({ resolveWithObject: true })
      for (const pixel of [0, info.width - 1, (info.height - 1) * info.width, info.height * info.width - 1]) {
        const offset = pixel * info.channels
        // The surrounding dimmed world must show through all four exterior corners.
        expect(data[offset]! + data[offset + 1]! + data[offset + 2]!).toBeLessThan(450)
      }
    }
    if (id === 'lore') await page.locator('.lore-modal__close').click()
    else await page.keyboard.press('Escape')
    await expect(page.locator(root!)).toBeHidden()
  }
  assertNoBrowserErrors(errors)
})

test('PC composition fits the three target viewports and preserves real navigation guards', async ({ page }) => {
  test.setTimeout(180_000)
  const errors = collectBrowserErrors(page)
  await bootToGuestHome(page)
  await createCharacterThroughUi(page, 'Thanh Vân PC')
  await enterHome(page)
  await waitForPresentationIdle(page)
  await expect(page.locator('.df-wheel')).toBeHidden()
  await page.keyboard.press('Tab')
  await expect(page.locator('.df-wheel')).toBeHidden()
  await page.locator('.df-cultivator').click()
  await expect(page.locator('.df-wheel')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('.df-wheel')).toBeHidden()

  for (const [width, height] of [[1280, 720], [1672, 941], [1920, 1080]]) {
    await page.setViewportSize({ width: width!, height: height! })
    await page.screenshot({ path: `${evidence}/pc-home-${width}.png` })
    await page.locator('.df-identity').click()
    await expect(page.locator('.cf-scene')).toBeVisible()
    const stats = await page.locator('.cf-stats').boundingBox()
    const elements = await page.locator('.cf-element-summary').boundingBox()
    expect(elements!.y + elements!.height).toBeLessThanOrEqual(stats!.y + stats!.height + 1)
    const paper = await page.locator('.cf-scene .pc-paper-scene').boundingBox()
    expect(paper).not.toBeNull()
    expect(paper!.x).toBeGreaterThanOrEqual(0)
    expect(paper!.x + paper!.width).toBeLessThanOrEqual(width! + 1)
    expect(paper!.y + paper!.height).toBeLessThanOrEqual(height! + 1)
    await page.locator('.cf-scene .pc-paper-scene-actions > button').nth(1).click()
    const locked = page.locator('[data-nav-id="technique"]')
    await expect(locked).toHaveAttribute('aria-disabled', 'true')
    await locked.dispatchEvent('click')
    await expect(page.locator('.cf-scene')).toBeVisible()
    await expect(page.locator('.technique-paper-scene')).toHaveCount(0)
    await page.keyboard.press('Escape')
    await page.locator('.cf-stat').first().hover()
    await expect(page.getByRole('tooltip')).toBeVisible()
    await expect(page.getByRole('tooltip')).toHaveCSS('opacity', '1')
    await page.screenshot({ path: `${evidence}/pc-character-tooltip-${width}.png` })
    await page.locator('.cf-scene .pc-paper-scene-actions > button').nth(1).click()
    await page.locator('[data-nav-id="equipment"]').click()
    await expect(page.locator('.equipment-scene')).toBeVisible()
    const figure = await page.locator('.paperdoll__base canvas').boundingBox()
    const summary = await page.locator('.equipment-summary').boundingBox()
    expect(figure).not.toBeNull()
    expect(summary).not.toBeNull()
    expect(figure!.y + figure!.height).toBeLessThanOrEqual(summary!.y + 1)
    await page.screenshot({ path: `${evidence}/pc-equipment-${width}.png` })
    await page.keyboard.press('Escape')
    await expect(page.locator('.equipment-scene')).toHaveCount(0)
  }
  assertNoBrowserErrors(errors)
})

test('secondary PC fixture renders hidden surfaces without changing shipped beta gates', async ({ page }) => {
  test.setTimeout(120_000)
  const errors = collectBrowserErrors(page)
  await page.setViewportSize({ width: 1672, height: 941 })
  await page.goto('/ui-secondary.html')
  await expect(page.locator('.tran-phap-panel')).toBeVisible()
  await expect(page.locator('.tran-phap-panel__preview-canvas canvas')).toBeVisible()
  await page.locator('.tran-phap-panel__formation-button').filter({ hasText: 'Ngũ Hành Trận' }).click()
  await expect(page.locator('.tran-phap-panel__formation-button.is-selected strong')).toHaveText('Ngũ Hành Trận')
  await expect(page.locator('.tran-phap-panel__formation-button.is-selected small')).not.toBeEmpty()
  await expect(page.locator('.tran-phap-panel__formation-button.is-selected .is-lit')).toHaveCount(5)
  await expect(page.locator('.tran-phap-panel__confirm')).toBeEnabled()
  const card = page.locator('.tran-phap-panel__card').first()
  const slot = page.locator('.tran-phap-panel__cell--enabled').first()
  const dataTransfer = await page.evaluateHandle(() => new DataTransfer())
  await card.dispatchEvent('dragstart', { dataTransfer })
  await slot.dispatchEvent('dragover', { dataTransfer })
  await slot.dispatchEvent('drop', { dataTransfer })
  await expect(page.locator('.tran-phap-panel__cell--occupied')).toContainText('Thanh Vân')
  await page.screenshot({ path: `${evidence}/pc-secondary-formation.png` })
  await page.locator('.tran-phap-panel__confirm').click()
  // The authoring entry exposes presentation only; beta authority still rejects the hidden command.
  await expect(page.locator('.tran-phap-panel__confirm')).toBeDisabled()
  for (const id of ['companion', 'artifact', 'chieu_mo', 'duyen_phan', 'qua_tang']) {
    await page.locator(`[data-preview-tab="${id}"]`).click()
    await expect(page.locator('[role="dialog"]')).toBeVisible()
    await page.screenshot({ path: `${evidence}/pc-secondary-${id}.png` })
  }
  assertNoBrowserErrors(errors)
})

test('populated scene fixtures use the new PC skin for progression and collection', async ({ page }) => {
  test.setTimeout(120_000)
  const errors = collectBrowserErrors(page)
  await page.setViewportSize({ width: 1672, height: 941 })
  for (const [id, root] of [['technique', '.technique-paper-scene'], ['skill', '.skill-paper-scene'], ['inventory', '.inventory-scene'], ['body', '.body-paper-scene']]) {
    await page.goto(`/ui-${id}.html`)
    await expect(page.locator(root!)).toBeVisible()
    if (id === 'skill') {
      const workspace = await page.locator('.skill-paper-tree').boundingBox()
      for (const node of await page.locator('.skill-node').all()) {
        const bounds = await node.boundingBox()
        expect(bounds!.y).toBeGreaterThanOrEqual(workspace!.y)
        expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(workspace!.y + workspace!.height)
      }
    }
    await page.screenshot({ path: `${evidence}/pc-fixture-${id}.png` })
  }
  assertNoBrowserErrors(errors)
})

