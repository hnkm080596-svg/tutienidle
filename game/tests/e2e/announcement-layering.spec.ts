import { expect, test } from '@playwright/test'
import { bootToGuestHome, createCharacterThroughUi, enterHome } from './helpers'

/**
 * T4-35 P14 - the world announcement is ambient chrome: while one is
 * firing, a blocking modal (offline summary here) must still be
 * interactable. Regression: OVERLAY_LAYERS.announcement used to sit at
 * 2000, ABOVE modal (1900), so the announcement scrim swallowed every
 * click aimed at the dialog for up to 5s.
 *
 * Both stores are reached through the mounted Vue app
 * (`#app.__vue_app__` -> `$pinia` internals) - same "no new production
 * surface" principle as the window.__tutienPhaserGame seam.
 */
test.describe('announcement layering (T4-35)', () => {
  test('offline summary stays clickable while an announcement is firing', async ({ page }) => {
    await bootToGuestHome(page)
    await createCharacterThroughUi(page, 'Layer Test')
    await enterHome(page)

    await page.evaluate(() => {
      const appRoot = document.getElementById('app') as HTMLElement & {
        __vue_app__?: { config: { globalProperties: { $pinia?: { _s: Map<string, { show: (...args: unknown[]) => void }> } } } }
      }
      const pinia = appRoot.__vue_app__?.config.globalProperties.$pinia
      const announcements = pinia?._s.get('worldAnnouncement')
      const offline = pinia?._s.get('offlineSummary') as unknown as { show(data: unknown): void } | undefined

      if (!announcements || !offline) {
        throw new Error('pinia stores unreachable')
      }

      announcements.show('Thiên đạo thông báo', 'Một lời nhắn dài để kiểm tra lớp phủ')
      offline.show({ elapsedSeconds: 120, cultivation: 600 })
    })

    const announcement = page.locator('.world-announcement')
    const modal = page.locator('.offline-summary')
    await expect(announcement).toBeVisible()
    await expect(modal).toBeVisible()

    // The real assertion: a click at the modal's continue button must
    // reach the modal (elementFromPoint is the browser's own hit-test,
    // immune to z-index bookkeeping errors a locator click would mask).
    const hit = await page.evaluate(() => {
      const button = document.querySelector('.offline-summary__continue')

      if (!button) return 'missing-button'

      const rect = button.getBoundingClientRect()
      const el = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)

      return el === button || button.contains(el) ? 'modal' : el?.className.toString() ?? 'null'
    })

    expect(hit).toBe('modal')

    // And the button actually works through the stacked overlays.
    await modal.locator('.offline-summary__continue').click()
    await expect(modal).toBeHidden()

    // Announcement itself still owns its ambient contract: click dismisses.
    await expect(announcement).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(announcement).toBeHidden()
  })
})
