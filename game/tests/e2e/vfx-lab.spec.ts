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
