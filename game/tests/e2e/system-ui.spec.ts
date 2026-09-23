import { expect, test } from './fixtures'
import { createCharacterThroughUi, enterHome } from './helpers'

/**
 * M-UI-SYSTEM e2e - rim-authority contract + reduced-motion over the
 * wave-1 system surfaces (spec 4.1.1 / plan Task 8 Step 2):
 *   character drawer -> .sys-surface present + sole .sys-rim--live;
 *   open a system modal -> sole rim on the modal; close it -> the rim is
 *   gone from the modal; mounted-but-closed modal holds no claim; Escape
 *   closes; reduced-motion emulation stops sys animation.
 *
 * String-based evaluate everywhere - the e2e tsconfig has no DOM ambient
 * types (same convention as ink-wash-ui.spec.ts).
 */

const LIVE_RIM = '.sys-rim--live'
const DRAWER = '.left-panel.sys-surface'
const REALM_MODAL = '.overlay-panel--system'

async function liveRimCount(page: import('./fixtures').Page): Promise<number> {
  return page.evaluate<number>(`document.querySelectorAll('${LIVE_RIM}').length`)
}

async function liveRimInside(page: import('./fixtures').Page, selector: string): Promise<number> {
  // Count includes the element itself - the drawer carries .sys-rim--live
  // on its root; the modal carries it on the inner SysPanel card.
  return page.evaluate<number>(
    `(() => {
      const el = document.querySelector('${selector}')
      if (!el) return -1
      return el.querySelectorAll('${LIVE_RIM}').length + (el.matches('${LIVE_RIM}') ? 1 : 0)
    })()`,
  )
}

test.describe('system UI skin - rim authority', () => {
  test('drawer and system modal hand the single live rim back and forth', async ({ page }) => {
    await page.addInitScript(() => localStorage.clear())
    await page.goto('/')
    await page.getByTestId('auth-guest-button').click()
    await createCharacterThroughUi(page, 'Hệ Thống')
    await enterHome(page)

    // Character drawer open -> sys surface + sole live rim on the drawer.
    await page.keyboard.press('Tab')
    await page.locator('[data-wheel-slot="character"]').click()
    const drawer = page.locator(DRAWER)
    await expect(drawer).toBeVisible({ timeout: 10_000 })
    expect(await liveRimCount(page)).toBe(1)
    expect(await liveRimInside(page, DRAWER)).toBe(1)

    // Open the realm modal (OverlayPanel variant=system): sole rim moves
    // to the modal; the drawer's claim is released with its v-if. Wait for
    // the drawer's unmount to flush before counting (render settles async).
    await page.keyboard.press('Tab')
    await page.locator('[data-wheel-slot="realm"]').click()
    const modal = page.locator(REALM_MODAL)
    await expect(modal).toBeVisible({ timeout: 10_000 })
    await expect(drawer).toHaveCount(0)
    expect(await liveRimCount(page)).toBe(1)
    expect(await liveRimInside(page, REALM_MODAL)).toBe(1)

    // Escape closes the modal -> no live rim anywhere (drawer closed when
    // the standalone panel opened).
    await page.keyboard.press('Escape')
    await expect(modal).toBeHidden({ timeout: 10_000 })
    expect(await liveRimCount(page)).toBe(0)

    // Re-open the character drawer -> rim returns to it. The realm panel
    // stays mounted-but-closed (mountedStandalone set): it must hold NO
    // claim, i.e. still zero rims inside its subtree.
    await page.keyboard.press('Tab')
    await page.locator('[data-wheel-slot="character"]').click()
    await expect(drawer).toBeVisible({ timeout: 10_000 })
    expect(await liveRimCount(page)).toBe(1)
    expect(await liveRimInside(page, DRAWER)).toBe(1)
    // -1 = overlay element fully unmounted by v-if; 0 = mounted, no rim.
    expect(await liveRimInside(page, REALM_MODAL)).toBeLessThanOrEqual(0)

    // Re-open the already-mounted modal -> activation promotes it back to
    // sole live-rim owner (same drawer-unmount flush wait as above).
    await page.keyboard.press('Tab')
    await page.locator('[data-wheel-slot="realm"]').click()
    await expect(modal).toBeVisible({ timeout: 10_000 })
    await expect(drawer).toHaveCount(0)
    expect(await liveRimCount(page)).toBe(1)
    expect(await liveRimInside(page, REALM_MODAL)).toBe(1)
    await page.keyboard.press('Escape')
  })

  test('a nested system modal answers Escape, not the background card', async ({ page }) => {
    await page.addInitScript(() => localStorage.clear())
    await page.goto('/')
    await page.getByTestId('auth-guest-button').click()
    await createCharacterThroughUi(page, 'Hệ Thống')
    await enterHome(page)

    // Settings (ink OverlayPanel) -> reload opens a nested SysModalBase
    // confirm inside the settings card subtree. Clicking the modal scrim
    // must not move focus to the background card: Escape then closes only
    // the confirm, and the settings overlay stays open (QA regression -
    // useDialogFocus pointer containment).
    await page.keyboard.press('Tab')
    await page.locator('[data-wheel-slot="settings"]').click()
    const settingsCard = page.locator('.overlay-panel__card').first()
    await expect(settingsCard).toBeVisible({ timeout: 10_000 })
    await page.getByRole('button', { name: /Tải Lại|reload/i }).first().click()
    const confirmModal = page.locator('.sys-modal')
    await expect(confirmModal).toBeVisible({ timeout: 10_000 })

    await page.mouse.click(40, 400)
    await page.keyboard.press('Escape')
    await expect(confirmModal).toBeHidden({ timeout: 10_000 })
    await expect(settingsCard).toBeVisible({ timeout: 10_000 })
    await page.keyboard.press('Escape')
  })

  test('reduced-motion emulation stills all sys layer animation', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.addInitScript(() => localStorage.clear())
    await page.goto('/')
    await page.getByTestId('auth-guest-button').click()
    await createCharacterThroughUi(page, 'Hệ Thống')
    await enterHome(page)

    await page.keyboard.press('Tab')
    await page.locator('[data-wheel-slot="character"]').click()
    await expect(page.locator(DRAWER)).toBeVisible({ timeout: 10_000 })

    // Every animated sys pseudo-element must compute to animation-name: none
    // under prefers-reduced-motion (spec 4.2 - corners and a static border
    // survive, motion does not).
    const names = await page.evaluate<string[]>(
      `(() => {
        const probes = []
        const push = (sel, pseudo) => {
          const el = document.querySelector(sel)
          if (!el) { probes.push('MISSING:' + sel); return }
          probes.push(sel + '::' + pseudo + '=' + getComputedStyle(el, pseudo).animationName)
        }
        push('.sys-rim--live', '::before')
        push('.sys-scanlines', '::before')
        return probes
      })()`,
    )
    for (const line of names) {
      expect(line).not.toContain('MISSING:')
      expect(line).toMatch(/=none$/)
    }
  })
})
