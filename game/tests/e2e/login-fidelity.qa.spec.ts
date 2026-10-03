import { test, expect, type Page } from './fixtures'
import { waitForPresentationIdle } from './helpers'

test.use({ channel: 'msedge', viewport: { width: 1280, height: 720 } })

async function bootLogin(page: Page) {
  await page.goto('/')
  await expect(page.getByTestId('auth-screen')).toBeVisible()
  await waitForPresentationIdle(page)
  await page.locator('.login-scroll__art').evaluate((image: HTMLImageElement) => image.decode())
}

async function positions(page: Page) {
  return page.locator('#auth-input-password, [data-hk-region="primary-action"], [data-testid="auth-guest-button"], [data-hk-region="locale-chips"]').evaluateAll((elements) =>
    elements.map((element) => {
      const rect = element.getBoundingClientRect()
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
    }),
  )
}

test('login messages never move the password, actions or language controls', async ({ page }) => {
  await bootLogin(page)
  const before = await positions(page)
  await page.locator('#auth-input-id').fill('a')
  await expect(page.locator('#auth-error-id')).toBeVisible()
  expect(await positions(page)).toEqual(before)
  await page.locator('#auth-input-id').fill('valid_name')
  await expect(page.locator('#auth-error-id')).toHaveCount(0)
  expect(await positions(page)).toEqual(before)
  await expect(page.locator('[data-hk-region="divider"]')).toHaveCount(0)
  expect(await page.locator('.auth-card__content').evaluate(element => element.scrollHeight <= element.clientHeight)).toBe(true)
  const locale = await page.locator('.login-locale').boundingBox()
  expect(locale!.y + locale!.height).toBeLessThan(720)
  await page.getByTestId('auth-locale-en').click()
  await page.locator('#auth-input-id').fill('')
  const english = await positions(page)
  await page.locator('#auth-input-id').fill('a')
  await expect(page.locator('#auth-error-id')).toBeVisible()
  expect(await positions(page)).toEqual(english)
})

test('login retains password reveal, accessible tabs and guest entry', async ({ page }) => {
  await bootLogin(page)
  const password = page.locator('#auth-input-password')
  await password.fill('preview123')
  await page.getByRole('button', { name: 'Hiện mật khẩu' }).click()
  await expect(password).toHaveAttribute('type', 'text')
  await expect(password).toHaveValue('preview123')
  await page.getByRole('button', { name: 'Hiện mật khẩu' }).click()
  await expect(password).toHaveAttribute('type', 'password')
  await page.locator('#auth-tab-login').focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.locator('#auth-tab-register')).toBeFocused()
  await expect(password).toHaveAttribute('autocomplete', 'new-password')
  await page.keyboard.press('ArrowLeft')
  await expect(page.locator('#auth-tab-login')).toBeFocused()
  await expect(password).toHaveAttribute('autocomplete', 'current-password')
  await page.getByTestId('auth-guest-button').click()
  await expect(page.getByTestId('character-creation-screen')).toBeVisible()
})

test('desktop layouts keep the complete form and languages on paper; foreground follows parallax', async ({ page }) => {
  await bootLogin(page)
  for (const [width, height] of [[1280, 720], [1440, 810], [1920, 1080]] as const) {
    await page.setViewportSize({ width, height })
    await expect.poll(() => page.locator('.auth-card__content').evaluate(element => element.scrollHeight <= element.clientHeight)).toBe(true)
    const footer = await page.locator('.auth-card__footer').boundingBox()
    const content = await page.locator('.auth-card__content').boundingBox()
    expect(content!.y + content!.height).toBeLessThan(footer!.y)
    expect(footer!.y + footer!.height).toBeLessThan(height)
    await page.screenshot({ path: `docs/qa/huyen-kim-reference-fidelity/evidence/login-v2-${width}.png` })
  }
  await page.mouse.move(10, 10)
  const foreground = page.locator('.hk-parallax-stack__foreground')
  const landscape = page.locator('[data-depth="L5"]')
  await expect.poll(async () => (await foreground.getAttribute('style')) === (await landscape.getAttribute('style'))).toBe(true)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(foreground).toHaveAttribute('style', /translate3d\(0px, 0px, 0(?:px)?\)/)
  await expect(landscape).toHaveAttribute('style', /translate3d\(0px, 0px, 0(?:px)?\)/)
})
