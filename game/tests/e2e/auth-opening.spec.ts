import { expect, test } from './fixtures'

// Production entry path; delay a required image instead of faking progress.
test('cold boot keeps the same scene, hides the mortal under clouds and reveals a usable menu', async ({ page }, testInfo) => {
  let release!: () => void
  const gate = new Promise<void>((resolve) => { release = resolve })
  await page.route('**/auth-opening/mortal-wind-strip-v1.png', async (route) => { await gate; await route.continue() })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  const curtain = page.getByTestId('auth-opening-curtain')
  await expect(curtain).toBeVisible()
  await expect(page.locator('.loading-screen')).toHaveCount(0)
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', /^(?:[0-9]|[1-9][0-9])$/)
  const vista = await page.locator('[data-hk-region="vista"]').elementHandle()
  await expect.poll(async () => page.locator('.auth-opening-track__fill').evaluate((element) => {
    const track = element.parentElement!
    return Math.abs(element.getBoundingClientRect().width / track.clientWidth - Number(track.getAttribute('aria-valuenow')) / 100)
  })).toBeLessThan(0.12)
  await page.screenshot({ path: testInfo.outputPath('01-cloud-loading.png') })
  release()
  await expect(curtain).toHaveCount(0)
  expect(await page.evaluate((node) => node === document.querySelector('[data-hk-region="vista"]'), vista)).toBe(true)
  await expect(page.getByTestId('presentation-overlay')).toHaveAttribute('data-phase', 'idle')
  await expect(page.getByTestId('opening-login-button')).toBeVisible()
  await page.getByTestId('opening-login-button').click()
  await expect(page.locator('#auth-input-id')).toBeVisible()
  await expect.poll(() => page.locator('.login-drawer-layer').evaluate((element) => getComputedStyle(element).opacity)).toBe('1')
  await page.screenshot({ path: testInfo.outputPath('02-auth-drawer.png') })
  await page.getByTestId('opening-settings-button').click()
  await expect(page.locator('.login-side-drawer')).toBeVisible()
})

test('required art failure stays actionable and retry opens the same auth scene', async ({ page }) => {
  let fail = true
  await page.route('**/auth-opening/mortal-wind-strip-v1.png', (route) => fail ? route.abort('failed') : route.continue())
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('presentation-retry-button')).toBeVisible()
  await expect(page.getByTestId('auth-opening-curtain')).toBeVisible()
  fail = false
  await page.getByTestId('presentation-retry-button').click()
  await expect(page.getByTestId('auth-opening-curtain')).toHaveCount(0)
  await expect.poll(() => page.locator('.login-vista__mortal img').evaluate((element) => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
  await expect(page.getByTestId('opening-login-button')).toBeVisible()
  await page.getByTestId('opening-login-button').click()
  await expect(page.locator('#auth-input-id')).toBeVisible()
})

test('reduced motion reveals directly and auth-to-creation retains its environment', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await expect(page.getByTestId('auth-opening-curtain')).toHaveCount(0)
  await expect(page.getByTestId('presentation-overlay')).toHaveAttribute('data-phase', 'idle')
  const vista = await page.locator('[data-hk-region="vista"]').elementHandle()
  await page.getByTestId('auth-guest-button').click()
  await expect(page.getByTestId('character-creation-screen')).toBeVisible()
  expect(await page.evaluate((node) => node === document.querySelector('[data-hk-region="vista"]'), vista)).toBe(true)
  await expect(page.getByTestId('auth-opening-curtain')).toHaveCount(0)
})

test('a failed reveal can retry after auth has already committed', async ({ page }) => {
  await page.addInitScript(() => {
    const original = Element.prototype.animate
    let fail = true
    Element.prototype.animate = function (...args: Parameters<Element['animate']>) {
      if (fail && this.classList.contains('auth-opening-cloud')) {
        fail = false
        throw new Error('Controlled reveal failure')
      }
      return original.apply(this, args)
    }
  })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('presentation-retry-button')).toBeVisible()
  await expect(page.getByTestId('auth-screen')).toBeAttached()
  await page.getByTestId('presentation-retry-button').click()
  await expect(page.getByTestId('auth-opening-curtain')).toHaveCount(0)
  await expect(page.getByTestId('presentation-overlay')).toHaveAttribute('data-phase', 'idle')
  await page.getByTestId('opening-login-button').click()
  await expect(page.locator('#auth-input-id')).toBeVisible()
})

test('auth composition stays inside the scaled frame at smaller viewport sizes', async ({ page }, testInfo) => {
  await page.goto('/')
  await expect(page.getByTestId('auth-opening-curtain')).toHaveCount(0)
  await expect(page.getByTestId('opening-exit-button')).toBeVisible()
  for (const viewport of [{ width: 1280, height: 800 }, { width: 960, height: 540 }]) {
    await page.setViewportSize(viewport)
    await expect.poll(async () => page.locator('.scene-design-canvas').evaluate((element) => {
      const rect = element.getBoundingClientRect()
      return rect.left >= -1 && rect.right <= innerWidth + 1 && rect.top >= -1 && rect.bottom <= innerHeight + 1
    })).toBe(true)
    const mortal = await page.locator('.login-vista__mortal').boundingBox()
    const menu = await page.locator('.login-opening__actions').boundingBox()
    expect(mortal!.x + mortal!.width).toBeLessThan(menu!.x)
    await page.screenshot({ path: testInfo.outputPath(`auth-${viewport.width}.png`) })
    await page.getByTestId('opening-login-button').click()
    await expect(page.locator('#auth-input-id')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('.login-drawer-layer')).not.toHaveClass(/login-drawer-layer--open/)
  }
})

test('saved reduced-motion preference also suppresses menu entrances', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.addInitScript(() => localStorage.setItem('tutien-reduced-motion', 'true'))
  await page.goto('/')
  await expect(page.getByTestId('auth-opening-curtain')).toHaveCount(0)
  await expect.poll(() => page.getByTestId('opening-login-button').evaluate((element) => getComputedStyle(element).animationName)).toBe('none')
})

test('slow mounted image decoding completes before the reveal animation deadline starts', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLImageElement.prototype.decode
    HTMLImageElement.prototype.decode = async function () {
      if (this.closest('.login-vista__mortal')) await new Promise((resolve) => setTimeout(resolve, 1150))
      return original.call(this)
    }
  })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('auth-opening-curtain')).toHaveCount(0)
  await expect(page.getByTestId('presentation-overlay')).toHaveAttribute('data-phase', 'idle')
  await expect(page.getByTestId('presentation-retry-button')).toHaveCount(0)
  await page.getByTestId('opening-login-button').click()
  await expect(page.locator('#auth-input-id')).toBeVisible()
})

test('mounted wordmark readiness is included before the cloud reveal', async ({ page }) => {
  await page.addInitScript(() => {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src')!
    const original = descriptor.set!
    Object.defineProperty(HTMLImageElement.prototype, 'src', { ...descriptor, set(this: HTMLImageElement, value: string) {
      const url = this.classList.contains('login-logo__wordmark') && !value.includes('qa-mounted-logo') ? `${value}?qa-mounted-logo=1` : value
      original.call(this, url)
    } })
  })
  let release!: () => void
  const gate = new Promise<void>((resolve) => { release = resolve })
  await page.route('**/wordmark.png?qa-mounted-logo=1', async (route) => { await gate; await route.continue() })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await page.getByTestId('auth-screen').waitFor({ state: 'attached' })
  // Deliberate latency attack: hold beyond the reveal animation, below READY deadline.
  await page.waitForTimeout(1400)
  await expect(page.getByTestId('auth-opening-curtain')).toBeVisible()
  await expect(page.getByTestId('presentation-overlay')).toHaveAttribute('data-phase', 'awaiting-ready')
  release()
  await expect(page.getByTestId('auth-opening-curtain')).toHaveCount(0)
  await expect.poll(() => page.locator('.login-logo__wordmark').evaluate((element) => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
  await page.getByTestId('opening-login-button').click()
  await expect(page.locator('#auth-input-id')).toBeVisible()
})


test('supplied sheets crop all 41 authored frames and crane bob stays independent of progress', async ({ page }) => {
  let release!: () => void
  const gate = new Promise<void>((resolve) => { release = resolve })
  await page.route('**/auth-opening/mortal-wind-strip-v1.png', async (route) => { await gate; await route.continue() })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.auth-opening-crane canvas')).toBeVisible()
  const crane = page.locator('.auth-opening-crane')
  await expect.poll(() => crane.locator('canvas').evaluate((element) => {
    const canvas = element as HTMLCanvasElement
    return canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data.some((value, index) => index % 4 === 3 && value > 0)
  }), { timeout: 2000 }).toBe(true)
  await expect.poll(() => crane.locator('img').evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBe(212)
  const bob = await crane.evaluate((element) => {
    const inner = element.querySelector('.auth-opening-crane__bob')!
    const animation = inner.getAnimations()[0]!
    animation.pause()
    animation.currentTime = 0
    const initial = new DOMMatrix(getComputedStyle(inner).transform)
    animation.currentTime = 375
    const raised = new DOMMatrix(getComputedStyle(inner).transform)
    return { rise: raised.m42 - initial.m42, outerY: getComputedStyle(element).transform }
  })
  expect(bob.rise).toBeLessThan(-7)
  expect(bob.outerY).toBe('matrix(1, 0, 0, 1, -77.5, 0)')
  release()
  await expect(page.getByTestId('auth-opening-curtain')).toHaveCount(0)
  const canvas = page.locator('.login-vista__mortal canvas')
  const initial = await canvas.boundingBox()
  const baselines = new Set<number>()
  const seenFrames = new Set<string>()
  for (let sample = 0; sample < 65; sample++) {
    const pixels = await canvas.evaluate((element) => {
      const target = element as HTMLCanvasElement
      const context = target.getContext('2d')!
      const pixels = context.getImageData(0, 0, target.width, target.height).data
      let bottom = -1
      let fingerprint = 0
      for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i + 3]! > 0) bottom = Math.floor(i / 4 / target.width)
        fingerprint = (Math.imul(fingerprint, 31) + pixels[i]!) | 0
      }
      return { bottom, fingerprint: String(fingerprint), transform: getComputedStyle(target).transform }
    })
    expect(pixels.transform).toBe('none')
    baselines.add(pixels.bottom)
    seenFrames.add(pixels.fingerprint)
    expect(await canvas.boundingBox()).toEqual(initial)
    await page.waitForTimeout(55)
  }
  expect([...baselines]).toEqual([189])
  expect(seenFrames.size).toBeGreaterThan(30)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.waitForTimeout(100)
  const still = await canvas.evaluate((element) => (element as HTMLCanvasElement).toDataURL())
  await page.waitForTimeout(200)
  expect(await canvas.evaluate((element) => (element as HTMLCanvasElement).toDataURL()) === still).toBe(true)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.evaluate(() => { localStorage.setItem('tutien-reduced-motion', 'true'); document.documentElement.dataset.reducedMotion = 'true' })
  await page.waitForTimeout(100)
  const savedStill = await canvas.evaluate((element) => (element as HTMLCanvasElement).toDataURL())
  await page.waitForTimeout(200)
  expect(await canvas.evaluate((element) => (element as HTMLCanvasElement).toDataURL()) === savedStill).toBe(true)
})





