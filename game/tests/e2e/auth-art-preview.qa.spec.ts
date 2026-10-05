import { test, expect } from './fixtures'

test('art preview drawers never scroll the scene and close outside without a close button', async ({ page }) => {
  await page.setViewportSize({ width: 1672, height: 941 })
  await page.goto('/ui-auth-preview.html')
  await page.getByTestId('opening-login-button').waitFor()
  await page.evaluate(() => {
    const scene = document.querySelector<HTMLElement>('[data-testid="auth-art-preview"]')!
    scene.dataset.maximumScroll = '0'
    const start = performance.now()
    const sample = () => {
      scene.dataset.maximumScroll = String(Math.max(Number(scene.dataset.maximumScroll), scene.scrollLeft))
      if (performance.now() - start < 1000) requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)
  })
  await page.getByTestId('opening-login-button').click()
  await page.waitForTimeout(1100)
  await expect(page.getByTestId('auth-art-preview')).toHaveAttribute('data-maximum-scroll', '0')
  await expect(page.getByTestId('entry-drawer-close')).toHaveCount(0)
  await page.locator('#auth-input-id').fill('ab')
  await expect(page.locator('#auth-input-id')).toHaveAttribute('aria-invalid', 'true')
  await page.mouse.click(100, 200)
  await expect(page.getByTestId('entry-drawer')).toHaveCount(0)
  await page.getByTestId('opening-register-button').click()
  await expect(page.locator('.auth-tabs')).toHaveCount(0)
  await expect(page.locator('#auth-tab-register')).toHaveText('Đăng ký')
  await page.waitForTimeout(400)
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('entry-drawer')).toHaveCount(0)
  await page.getByTestId('opening-settings-button').click()
  await page.getByTestId('preview-audio-musicVolume').fill('35')
  await page.mouse.click(100, 200)
  await expect(page.getByTestId('entry-drawer')).toHaveCount(0)
  await page.getByTestId('opening-settings-button').click()
  await expect(page.getByTestId('preview-audio-musicVolume')).toHaveValue('35')
  await page.mouse.click(100, 200)
  await expect(page.getByTestId('entry-drawer')).toHaveCount(0)
  await page.getByTestId('opening-exit-button').click()
  await page.getByTestId('preview-exit-confirm').click()
  await expect(page.locator('.preview-exited')).toBeVisible()
  const gameKeys = await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('tien-hiep')))
  expect(gameKeys).toEqual([])
})


