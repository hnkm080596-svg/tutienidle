import { expect, test, type Page } from '@playwright/test'

/**
 * Boot hiện hành (2026-08): Intro → AuthEntryScreen (guest) → Character
 * Creation (nhân vật mới) → Home. Helper dùng chung cho cả 2 test.
 */
async function enterGame(page: Page) {
  await page.goto('/')

  // Boot hiện hành đi thẳng AuthEntryScreen (intro "Bỏ Qua" đã gỡ trong
  // online-auth pass) — đăng nhập tiến trình khách ("Chơi ngay").
  await page.getByRole('button', { name: /Chơi ngay/i }).click()

  // Nhân vật mới → màn Tạo Nhân Vật 3 bước. Nếu localStorage còn profile
  // (chạy lại cục bộ) bước này không xuất hiện → bỏ qua an toàn.
  const nameInput = page.locator('.name-step input')

  if (await nameInput.waitFor({ state: 'visible', timeout: 8_000 }).then(() => true).catch(() => false)) {
    await nameInput.fill('Đạo Hữu E2E')
    await page.getByRole('button', { name: 'Tiếp tục' }).click()

    // Chọn đúng 3 thiên phú.
    const talents = page.locator('.talent-card')
    await talents.first().waitFor()
    await talents.nth(0).click()
    await talents.nth(1).click()
    await talents.nth(2).click()
    await page.getByRole('button', { name: 'Xác nhận thiên phú' }).click()

    // Phân phối hết 5 điểm Căn Cố (mặc định của nhân vật mới): bấm "+"
    // của dòng đầu đúng 5 lần rồi "Bước vào tiên đạo".
    const firstPlus = page.locator('.attribute-row').first().locator('button').last()

    for (let index = 0; index < 5; index++) {
      await firstPlus.click()
    }

    await page.locator('.panel-actions button.primary').click()
  }

  // Home hiện Tutorial Overlay lần đầu — bỏ qua để tới UI chính.
  const tutorialSkip = page.getByRole('button', { name: 'Bỏ Qua' })

  if (await tutorialSkip.waitFor({ state: 'visible', timeout: 4_000 }).then(() => true).catch(() => false)) {
    await tutorialSkip.click()
  }

  await expect(page.getByRole('button', { name: 'Menu' })).toBeVisible({ timeout: 30_000 })
}

test('combat renders reward feedback without browser errors', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', error => pageErrors.push(error.message))

  await enterGame(page)

  await page.getByRole('button', { name: 'Menu' }).click()
  await page.getByText('Thám Hiểm', { exact: true }).click()
  await page.getByRole('button', { name: '1.1', exact: true }).click()
  await page.getByText('Lặp Lại', { exact: true }).click()
  await page.getByRole('button', { name: 'Bắt Đầu' }).click()

  await expect(page.locator('canvas')).toBeVisible()
  await expect(page.getByText('NHẬN ĐƯỢC').first()).toBeVisible({ timeout: 45_000 })
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

  await enterGame(page)

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
