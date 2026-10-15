import { expect, test, type Page } from './fixtures'
import {
  bootToGuestHome,
  createCharacterThroughUi,
  enterHome,
  waitForPresentationIdle,
  collectBrowserErrors,
  assertNoBrowserErrors,
} from './helpers'

test.use({ channel: 'msedge' })

async function enterCombat(page: Page) {
  await bootToGuestHome(page)
  await createCharacterThroughUi(page, 'Ceremony QA')
  await enterHome(page)
  await page.keyboard.press('`')
  await page.locator('[data-wheel-slot="teleport_array"]').click()
  await page.getByTestId('stage-start-button').click()
  await expect(page.locator('.combat-top-bar')).toBeVisible({ timeout: 30_000 })
  await waitForPresentationIdle(page)
}

// Fixture-injected terminal state exercises the real production modal and
// controllers. This is UI coverage, not proof of gameplay reward settlement.
async function presentResult(
  page: Page,
  outcome: 'victory' | 'defeat',
  many = false,
  auto = false,
) {
  await page.evaluate(
    async ({ outcome, many, auto, uiUrl }) => {
      const { useUiStore } = await import(/* @vite-ignore */ uiUrl)
      const ui = useUiStore()
      const game = (
        window as Window & { __tutienPhaserGame?: { registry: { get(key: string): unknown } } }
      ).__tutienPhaserGame
      const manager = game?.registry.get('gameManager') as
        | {
            getTurnBattle(): { state: string } | null
            abandonBattle(): boolean
            getBattleRewardSummary(): {
              spiritStone: number
              techniqueMastery: number
              skillInsight: number
              artifactInsight: number
              items: { itemId: string; kind: 'material'; name: string; amount: number }[]
            }
          }
        | undefined
      if (!manager?.getTurnBattle()) throw new Error('Real stage battle required')
      // Close the real active lease and pending presentation through its
      // owner before substituting the result's display-only fixture.
      manager.abandonBattle()
      ui.battleRunMode = auto ? 'repeat' : 'manual'
      const summary = manager.getBattleRewardSummary()
      summary.spiritStone = 128
      summary.techniqueMastery = 24
      summary.skillInsight = 8
      summary.artifactInsight = 0
      summary.items = many
        ? Array.from({ length: 16 }, (_, i) => ({
            itemId: `qa-${i}`,
            kind: 'material',
            name: `Chiến lợi phẩm thử ${i + 1}`,
            amount: i + 1,
          }))
        : []
      manager.getTurnBattle()!.state = outcome
    },
    { outcome, many, auto, uiUrl: '/src/stores/ui.ts' },
  )
  await expect(page.locator('.result-ceremony')).toHaveAttribute('data-outcome', outcome)
}

test('production variant: staged rewards, overflow, skip, retry, defeat and return', async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000)
  const errors = collectBrowserErrors(page)
  await enterCombat(page)
  // Runtime sampling starts before the terminal fixture, so even a busy
  // Playwright process cannot miss the short count-up interval.
  await page.evaluate(() => {
    const samples: string[] = []
    const timer = window.setInterval(() => {
      const text = document.querySelector('[data-reward-id="spirit_stone"]')?.textContent
      if (text) samples.push(text.trim())
    }, 30)
    ;(
      window as Window & { __ceremonySamples?: { samples: string[]; timer: number } }
    ).__ceremonySamples = { samples, timer }
  })
  await presentResult(page, 'victory', true)
  const result = page.locator('.result-ceremony')
  await expect(result.locator('.ceremony-title__art')).toHaveAttribute(
    'src',
    /victory-v2\/victory-title-v1\.png/,
  )
  await expect(result).toHaveAttribute('data-complete', 'true')
  await expect(result.locator('.ceremony-title__art')).toHaveJSProperty('complete', true)
  expect(await result.locator('.ceremony-title__art').evaluate(el => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
  expect(await result.locator('.result-ceremony__paper').evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(242, 232, 208)')
  expect(await result.evaluate(el => getComputedStyle(el, '::before').content)).toBe('none')
  const sampled = await page.evaluate(() => {
    const probe = (window as Window & { __ceremonySamples?: { samples: string[]; timer: number } })
      .__ceremonySamples!
    window.clearInterval(probe.timer)
    return probe.samples
  })
  expect(sampled).toContain('+0')
  expect(sampled.some((value) => value !== '+0' && value !== '+128')).toBe(true)
  await expect(result.locator('[data-reward-id="spirit_stone"]')).toHaveText('+128')
  await page.screenshot({ path: testInfo.outputPath('victory-desktop.png') })

  for (const viewport of [
    { width: 900, height: 600 },
    { width: 480, height: 800 },
  ]) {
    await page.setViewportSize(viewport)
    const dialogBox = await result.boundingBox()
    expect(dialogBox!.x).toBeGreaterThanOrEqual(0)
    expect(dialogBox!.y).toBeGreaterThanOrEqual(0)
    expect(dialogBox!.y + dialogBox!.height).toBeLessThanOrEqual(viewport.height + 1)
    const ledger = result.locator('.ceremony-ledger__rows')
    expect(await ledger.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true)
    await ledger.evaluate((el) => {
      el.scrollTop = el.scrollHeight
    })
    await expect(ledger.locator('li').last()).toBeInViewport()
    await expect(result.locator('.combat-victory-panel__retry')).toBeInViewport()
    await page.screenshot({
      path: testInfo.outputPath(`victory-${viewport.width}x${viewport.height}.png`),
    })
  }

  await page.setViewportSize({ width: 1600, height: 900 })
  await result.locator('.combat-victory-panel__retry').click()
  await expect(result).toBeHidden({ timeout: 20_000 })
  await waitForPresentationIdle(page)
  await presentResult(page, 'defeat')
  await expect(result.locator('.result-ceremony__hint')).toHaveCount(0)
  await expect(result.locator('.ceremony-title__art')).toHaveAttribute(
    'src',
    /defeat-v2\/defeat-title-v1\.png/,
  )
  // An early click only reveals, preserving the terminal state until the
  // player's next deliberate action.
  await result.locator('.combat-defeat-panel__return').click()
  await expect(result).toHaveAttribute('data-complete', 'true')
  await expect(result).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('defeat-desktop.png') })
  await page.keyboard.press('Tab')
  expect(await result.evaluate((el) => el.contains(document.activeElement))).toBe(true)
  await result.locator('.combat-defeat-panel__return').click()
  await expect(result).toBeHidden({ timeout: 20_000 })
  await waitForPresentationIdle(page)
  assertNoBrowserErrors(errors)
})

test('reduced motion and auto retry use the same production result path', async ({ page }) => {
  test.setTimeout(150_000)
  const errors = collectBrowserErrors(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await enterCombat(page)
  await presentResult(page, 'victory', false, true)
  const result = page.locator('.result-ceremony')
  await expect(result).toHaveAttribute('data-complete', 'true')
  await expect(result.locator('[data-reward-id="spirit_stone"]')).toHaveText('+128')
  await expect(result.locator('[role="status"]')).toBeVisible()
  // The fixture does not close the stage domain's terminal bookkeeping.
  // A refused repeat must recover to manual controls, never remain at 0s.
  await expect(async () => {
    const hidden = !(await result.isVisible())
    const recovered = await result.locator('.combat-victory-panel__retry').isVisible()
    expect(hidden || recovered).toBe(true)
  }).toPass({ timeout: 15_000 })
  assertNoBrowserErrors(errors)
})
