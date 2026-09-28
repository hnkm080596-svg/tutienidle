import { expect, test } from './fixtures'
import { assertNoBrowserErrors, collectBrowserErrors } from './helpers'
interface LabSnapshot { phase: string; impacts: number; completes: number; faults: number; active: number; allocated: number }
interface Lab { snapshot(): LabSnapshot; advance(ms: number): void; play(): void; cancel(): void }
declare global { interface Window { __skillVfxLab?: Lab } }
test('skill VFX lab uses the shared runner, cleans up, and never writes saves', async ({ page }) => {
  const errors = collectBrowserErrors(page)
  await page.goto('/dev/skill-vfx.html?manual=1')
  await expect(page.getByRole('heading', { name: 'Diễn võ · Phi Kiếm' })).toBeVisible()
  await expect(page.locator('canvas')).toBeVisible()
  await page.waitForFunction(() => Boolean(window.__skillVfxLab))
  const advance = (ms: number) => page.evaluate(value => window.__skillVfxLab!.advance(value), ms)
  await advance(369)
  expect(await page.evaluate(() => window.__skillVfxLab!.snapshot().impacts)).toBe(0)
  await page.locator('canvas').screenshot({ path: 'test-results/skill-vfx-flight.png' })
  await advance(1)
  expect(await page.evaluate(() => window.__skillVfxLab!.snapshot().impacts)).toBe(1)
  await page.locator('canvas').screenshot({ path: 'test-results/skill-vfx-impact.png' })
  await advance(80)
  await advance(80)
  await page.locator('canvas').screenshot({ path: 'test-results/skill-vfx-recall.png' })
  await advance(90)
  expect(await page.evaluate(() => window.__skillVfxLab!.snapshot())).toMatchObject({ completes: 1, active: 0, faults: 0 })
  for (const preset of ['slash', 'earth_shockwave', 'holy_radiance']) {
    await page.getByLabel('Kỹ năng').selectOption(preset)
    await page.getByRole('button', { name: 'Thi triển' }).click()
    await advance(1500)
    await advance(1500)
    expect(await page.evaluate(() => window.__skillVfxLab!.snapshot().active)).toBe(0)
  }
  await page.evaluate(() => {
    for (let i = 0; i < 100; i++) {
      window.__skillVfxLab!.play()
      window.__skillVfxLab!.advance(100)
      window.__skillVfxLab!.cancel()
    }
  })
  expect(await page.evaluate(() => window.__skillVfxLab!.snapshot())).toMatchObject({ active: 0, faults: 0 })
  expect(await page.evaluate(() => Object.keys(localStorage).filter(key => key.includes('tien-hiep-idle-save')))).toEqual([])
  assertNoBrowserErrors(errors)
})
test('low quality and reduced motion preserve the same milestones', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/dev/skill-vfx.html?manual=1&quality=low')
  await page.waitForFunction(() => Boolean(window.__skillVfxLab))
  expect(await page.evaluate(() => {
    window.__skillVfxLab!.advance(370)
    window.__skillVfxLab!.advance(250)
    return window.__skillVfxLab!.snapshot()
  })).toMatchObject({ impacts: 1, completes: 1, active: 0, faults: 0 })
})
