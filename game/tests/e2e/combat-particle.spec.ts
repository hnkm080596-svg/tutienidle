import { expect, test } from '@playwright/test'

test('combat renders reward feedback without browser errors', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', error => pageErrors.push(error.message))

  await page.goto('/')
  await page.getByRole('button', { name: 'Bỏ Qua' }).click()
  await page.getByRole('button', { name: 'Menu' }).click()
  await page.getByText('Thám Hiểm', { exact: true }).click()
  await page.getByRole('button', { name: '1.1', exact: true }).click()
  await page.getByText('Lặp Lại', { exact: true }).click()
  await page.getByRole('button', { name: 'Bắt Đầu' }).click()

  await expect(page.locator('canvas')).toBeVisible()
  await expect(page.getByText('NHẬN ĐƯỢC').first()).toBeVisible({ timeout: 30_000 })
  await page.waitForTimeout(240)
  await page.screenshot({ path: test.info().outputPath('reward-particle.png') })

  expect(pageErrors).toEqual([])
})

test('can exit during countdown and start another stage battle', async ({ page }) => {
  const lifecycleErrors: string[] = []
  page.on('console', message => {
    if (message.type() === 'error' && /Texture key already in use|AnimationManager key already exists/.test(message.text())) {
      lifecycleErrors.push(message.text())
    }
  })

  await page.goto('/')
  await page.getByRole('button', { name: 'Bỏ Qua' }).click()
  await page.getByRole('button', { name: 'Menu' }).click()
  await page.getByText('Thám Hiểm', { exact: true }).click()
  await page.getByRole('button', { name: '1.1', exact: true }).click()
  await page.getByRole('button', { name: 'Bắt Đầu' }).click()

  await expect(page.locator('.combat-countdown-overlay')).toBeVisible()
  await page.locator('.combat-control-bar__exit').click()
  await page.locator('.combat-control-bar__confirm-ok').click()
  await expect(page.getByRole('button', { name: 'Menu' })).toBeVisible()

  await page.getByRole('button', { name: 'Menu' }).click()
  await page.getByText('Thám Hiểm', { exact: true }).click()
  await page.getByRole('button', { name: '1.1', exact: true }).click()
  await page.getByRole('button', { name: 'Bắt Đầu' }).click()
  await expect(page.locator('.combat-countdown-overlay')).toBeVisible()
  expect(lifecycleErrors).toEqual([])
})
