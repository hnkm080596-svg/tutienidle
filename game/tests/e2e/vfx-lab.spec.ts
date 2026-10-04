import { expect, test } from '@playwright/test'

test('existing Skill VFX Lab replays Hỏa Cầu without a save', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))

  await page.goto('/dev/skill-vfx.html?preset=hoa_cau_comet')
  await expect(page.locator('h1')).toBeVisible()
  await expect(page.locator('#preset')).toHaveValue('hoa_cau_comet')
  await expect(page.locator('#stage canvas')).toBeVisible()
  await expect(page.locator('#stats')).toContainText('fireball:')
  await expect(page.locator('#stats')).toContainText('complete', { timeout: 8_000 })
  await page.locator('#play').click()
  await expect(page.locator('#stats')).toContainText('portal', { timeout: 5_000 })
  await expect(page.locator('#stats')).toContainText('complete', { timeout: 8_000 })
  expect(errors).toEqual([])
})

test('Thi triển starts Hỏa Cầu playback even when the manual scrubber is visible', async ({ page }) => {
  await page.goto('/dev/skill-vfx.html?preset=hoa_cau_comet&manual=1')
  await page.waitForFunction(() => Boolean((window as Window & { __skillVfxLab?: unknown }).__skillVfxLab))
  await page.locator('#play').click()
  await expect(page.locator('#stats')).toContainText('portal', { timeout: 3_000 })
  await expect(page.locator('#stats')).toContainText('complete', { timeout: 8_000 })
})

test('Tam Muội aura stays on the Pháp Tu model independently of Hỏa Cầu playback', async ({ page }) => {
  await page.goto('/dev/skill-vfx.html?preset=hoa_cau_comet&manual=1')
  await page.waitForFunction(() => Boolean((window as Window & { __skillVfxLab?: unknown }).__skillVfxLab))
  const aura = page.locator('#tam-muoi-aura')
  const auraState = () => page.evaluate(() => window.__skillVfxLab!.snapshot() as unknown as {
    tamMuoiActive: boolean; auraFrame: number
  })
  await expect(aura).toBeVisible()
  await expect(aura).not.toBeChecked()
  await aura.check()
  await expect.poll(async () => (await auraState()).tamMuoiActive).toBe(true)
  await expect.poll(async () => (await auraState()).auraFrame).toBeGreaterThan(0)
  await aura.uncheck()
  await expect.poll(async () => (await auraState()).tamMuoiActive).toBe(false)
  await aura.check()
  await page.locator('#cancel').click()
  await expect(aura).not.toBeChecked()
  await expect.poll(async () => (await auraState()).tamMuoiActive).toBe(false)
})

test('Pháp Thế preview lights four calligraphy strokes then the whole glyph at stack five', async ({ page }) => {
  await page.goto('/dev/skill-vfx.html?preset=hoa_cau_comet&manual=1&tam_muoi=1')
  await page.waitForFunction(() => Boolean((window as Window & { __skillVfxLab?: unknown }).__skillVfxLab))
  const count = page.locator('#phap-the-stacks')
  await expect(count).toBeVisible()
  const snapshot = () => page.evaluate(() => window.__skillVfxLab!.snapshot() as unknown as {
    phapTheStacks: number; phapTheGlyphVisible: boolean; phapTheLitStrokes: number; phapTheFullGlow: boolean
    hoaTheVisible: boolean; hoaTheFrame: number
    phapTheGlyphScale: number; phapTheGlyphOffsetX: number; phapTheGlyphOffsetY: number
  })
  await count.selectOption('0')
  expect((await snapshot()).phapTheGlyphVisible).toBe(true)
  expect((await snapshot()).phapTheLitStrokes).toBe(0)
  expect((await snapshot()).hoaTheVisible).toBe(false)
  expect((await snapshot()).phapTheGlyphScale).toBeCloseTo(0.21)
  expect((await snapshot()).phapTheGlyphOffsetX).toBe(25)
  expect((await snapshot()).phapTheGlyphOffsetY).toBe(-240)
  await count.selectOption('4')
  await expect.poll(async () => (await snapshot()).phapTheStacks).toBe(4)
  expect((await snapshot()).phapTheLitStrokes).toBe(4)
  expect((await snapshot()).phapTheFullGlow).toBe(false)
  expect((await snapshot()).hoaTheVisible).toBe(false)
  await page.locator('#play').click()
  await expect.poll(async () => (await snapshot()).phapTheStacks).toBe(5)
  await expect.poll(async () => (await snapshot()).phapTheFullGlow).toBe(true)
  await expect.poll(async () => (await snapshot()).hoaTheVisible).toBe(true)
  // Stack five shows the Arcadia fire seal: authored reveal, then a looping burn tail.
  const firstFrame = (await snapshot()).hoaTheFrame
  await expect.poll(async () => (await snapshot()).hoaTheFrame).toBeGreaterThan(firstFrame)
  expect((await snapshot()).phapTheGlyphVisible).toBe(false)
})
