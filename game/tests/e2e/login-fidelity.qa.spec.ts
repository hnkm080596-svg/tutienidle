import { test, expect, type Page } from './fixtures'
import { waitForPresentationIdle } from './helpers'

// QA evidence runs on Edge (Windows QA box); PLAYWRIGHT_CHANNEL picks
// another channel on machines without it (e.g. 'chromium' on Linux).
test.use({ channel: process.env.PLAYWRIGHT_CHANNEL ?? 'msedge', viewport: { width: 1280, height: 720 } })

async function bootLogin(page: Page) {
  await page.goto('/')
  await expect(page.getByTestId('auth-screen')).toBeVisible()
  await waitForPresentationIdle(page)
  await page.locator('[data-hk-region="logo-block"] img').evaluate((image: HTMLImageElement) => image.decode())
}

async function openLoginDrawer(page: Page) {
  await page.getByTestId('opening-login-button').click()
  await expect(page.getByTestId('entry-drawer')).toBeVisible()
}

type Rect = { x: number; y: number; width: number; height: number }

async function positions(page: Page): Promise<Rect[]> {
  return page.locator('#auth-input-password, [data-hk-region="primary-action"], .login-locale').evaluateAll((elements) =>
    elements.map((element) => {
      const rect = element.getBoundingClientRect()
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
    }),
  )
}

// Layout churn is a real defect; fractional pixel wobble from reflow is
// not. Compare boxes with a 1px tolerance.
function expectRectsSame(actual: Rect[], expected: Rect[]) {
  expect(actual.length).toBe(expected.length)
  actual.forEach((rect, i) => {
    for (const key of ['x', 'y', 'width', 'height'] as const) {
      expect(Math.abs(rect[key] - expected[i][key])).toBeLessThanOrEqual(1)
    }
  })
}

test('login messages never move the password, submit or language controls', async ({ page }) => {
  await bootLogin(page)
  await openLoginDrawer(page)
  const before = await positions(page)
  await page.locator('#auth-input-id').fill('a')
  await expect(page.locator('#auth-error-id')).toBeVisible()
  expectRectsSame(await positions(page), before)
  await page.locator('#auth-input-id').fill('valid_name')
  await expect(page.locator('#auth-error-id')).toHaveCount(0)
  expectRectsSame(await positions(page), before)
  expect(
    await page.locator('.login-side-drawer__content').evaluate(element => element.scrollHeight <= element.clientHeight + 1),
  ).toBe(true)
  const locale = await page.locator('.login-locale').boundingBox()
  expect(locale!.y + locale!.height).toBeLessThan(720)
  await page.getByTestId('auth-locale-en').click()
  await page.locator('#auth-input-id').fill('')
  const english = await positions(page)
  await page.locator('#auth-input-id').fill('a')
  await expect(page.locator('#auth-error-id')).toBeVisible()
  expectRectsSame(await positions(page), english)
})

test('login retains password reveal, mode autocomplete and guest entry', async ({ page }) => {
  await bootLogin(page)
  await openLoginDrawer(page)
  const password = page.locator('#auth-input-password')
  await password.fill('preview123')
  const reveal = page.locator('.auth-field__reveal')
  await reveal.click()
  await expect(password).toHaveAttribute('type', 'text')
  await expect(password).toHaveValue('preview123')
  await reveal.click()
  await expect(password).toHaveAttribute('type', 'password')
  await expect(password).toHaveAttribute('autocomplete', 'current-password')

  // Mode switching happens via the opening menu: closing the login drawer
  // and opening the register drawer must flip the autocomplete contract.
  await page.getByTestId('entry-drawer-close').click()
  await page.getByTestId('opening-register-button').click()
  await expect(page.locator('#auth-input-password')).toHaveAttribute('autocomplete', 'new-password')

  await page.getByTestId('entry-drawer-close').click()
  await page.getByTestId('auth-guest-button').click()
  await expect(page.getByTestId('character-creation-screen')).toBeVisible()
})

test('desktop layouts keep the complete drawer content on paper', async ({ page }) => {
  await bootLogin(page)
  await openLoginDrawer(page)
  for (const [width, height] of [[1280, 720], [1440, 810], [1920, 1080]] as const) {
    await page.setViewportSize({ width, height })
    await expect
      .poll(() =>
        page.locator('.login-side-drawer__content').evaluate(element => element.scrollHeight <= element.clientHeight + 1),
      )
      .toBe(true)
    const drawer = await page.getByTestId('entry-drawer').boundingBox()
    expect(drawer!.y + drawer!.height).toBeLessThanOrEqual(height + 1)
    await page.screenshot({ path: `docs/qa/huyen-kim-reference-fidelity/evidence/login-v3-${width}.png` })
  }
})
