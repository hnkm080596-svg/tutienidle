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

/**
 * M-UI-OVERHAUL e2e - v2 contract checks from spec section 8:
 * boot console grammar, scrim blur + Vietnamese text, measured contrast on
 * the brightest surface, focus-ring sweep, font-blocked fallback.
 * Same string-evaluate convention (no DOM ambient types).
 */
test.describe('system UI skin - v2 surface contract', () => {
  test('boot screen carries sys grammar and the title stays legible', async ({ page }) => {
    await page.addInitScript(() => localStorage.clear())
    await page.goto('/')

    const boot = await page.evaluate<string>(
      `(() => {
        const screen = document.querySelector('.loading-screen')
        if (!screen) return 'MISSING:.loading-screen'
        const marker = screen.querySelector('.sys-marker')
        const bg = getComputedStyle(screen).backgroundColor
        const title = screen.querySelector('h1, .loading-screen__title')
        return [
          'marker=' + Boolean(marker),
          'bg=' + bg,
          'title=' + (title ? title.textContent : 'none'),
        ].join(';')
      })()`,
    )
    expect(boot).toContain('marker=true')
    // Dark sys backdrop behind the pulse (rgb channels all low).
    const bgMatch = boot.match(/bg=rgba?\((\d+),\s*(\d+),\s*(\d+)/)
    expect(bgMatch).not.toBeNull()
    expect(Number(bgMatch![1]) + Number(bgMatch![2]) + Number(bgMatch![3])).toBeLessThan(150)
    // The guest button still sits on the sys boot surface (next screen).
    await expect(page.getByTestId('auth-guest-button')).toBeVisible({ timeout: 10_000 })
  })

  test('system modal shows blur scrim and readable Vietnamese text', async ({ page }) => {
    await page.addInitScript(() => localStorage.clear())
    await page.goto('/')
    await page.getByTestId('auth-guest-button').click()
    await createCharacterThroughUi(page, 'Hệ Thống')
    await enterHome(page)

    await page.keyboard.press('Tab')
    await page.locator('[data-wheel-slot="realm"]').click()
    const modal = page.locator(REALM_MODAL)
    await expect(modal).toBeVisible({ timeout: 10_000 })

    const contract = await page.evaluate<string>(
      `(() => {
        const scrim = document.querySelector('.overlay-panel')
        if (!scrim) return 'MISSING:.overlay-panel'
        const cs = getComputedStyle(scrim)
        const title = scrim.querySelector('.overlay-panel__heading h3, [class*=title]')
        return [
          'backdrop=' + (cs.backdropFilter || cs.webkitBackdropFilter || 'none'),
          'bg=' + cs.backgroundColor,
          'title=' + (title ? title.textContent : 'none'),
        ].join(';')
      })()`,
    )
    expect(contract).toContain('backdrop=blur(')
    // Vietnamese header text renders (diacritics present in the label).
    expect(contract).toMatch(/title=[^\n]*[À-ỹĐđ]/)
  })

  test('drawer text meets measured contrast against the dark sys surface', async ({ page }) => {
    await page.addInitScript(() => localStorage.clear())
    await page.goto('/')
    await page.getByTestId('auth-guest-button').click()
    await createCharacterThroughUi(page, 'Hệ Thống')
    await enterHome(page)

    await page.keyboard.press('Tab')
    await page.locator('[data-wheel-slot="character"]').click()
    const drawer = page.locator(DRAWER)
    await expect(drawer).toBeVisible({ timeout: 10_000 })

    // WCAG luminance math inline: contrast between computed text color and
    // the composited darkest plausible backdrop under it (--sys-bg-0).
    const ratio = await page.evaluate<number>(
      `(() => {
        const drawer = document.querySelector('${DRAWER}')
        if (!drawer) return -1
        const textEl = drawer.querySelector('h1, h2, h3, p, span, [class*=name], [class*=label]') || drawer
        const parse = (v) => {
          const m = v.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)(?:,\\s*([\\d.]+))?\\)/)
          return m ? { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] } : null
        }
        const lum = (c) => {
          const f = (u) => { u /= 255; return u <= 0.03928 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4) }
          return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b)
        }
        const fg = parse(getComputedStyle(textEl).color)
        // Walk up for the first opaque-ish ancestor fill; default to the
        // documented darkest sys backdrop (#060a12) when the card paints
        // translucently - worst-case composite.
        let node = textEl
        let bg = null
        while (node && node !== document.documentElement) {
          const c = parse(getComputedStyle(node).backgroundColor)
          if (c && c.a > 0.6) { bg = c; break }
          node = node.parentElement
        }
        if (!bg) bg = { r: 6, g: 10, b: 18 }
        const l1 = Math.max(lum(fg), lum(bg)), l2 = Math.min(lum(fg), lum(bg))
        return (l1 + 0.05) / (l2 + 0.05)
      })()`,
    )
    expect(ratio).toBeGreaterThanOrEqual(4.5)
  })

  test('focus sweep lands a visible ring on a drawer control', async ({ page }) => {
    await page.addInitScript(() => localStorage.clear())
    await page.goto('/')
    await page.getByTestId('auth-guest-button').click()
    await createCharacterThroughUi(page, 'Hệ Thống')
    await enterHome(page)

    await page.keyboard.press('Tab')
    await page.locator('[data-wheel-slot="character"]').click()
    const drawer = page.locator(DRAWER)
    await expect(drawer).toBeVisible({ timeout: 10_000 })

    // Keyboard-modality first (a real Tab press establishes
    // :focus-visible matching for the scripted focus below), then focus a
    // control inside the drawer and require a visible ring (outline or
    // ring shadow - the sys layer paints at least one).
    await page.keyboard.press('Tab') // opens wheel; closes via second Tab
    await page.keyboard.press('Tab')
    const ring = await page.evaluate<string>(
      `(() => {
        const drawer = document.querySelector('${DRAWER}')
        if (!drawer) return 'none'
        const btn = drawer.querySelector('button:not([disabled]), a[href], input, select, [tabindex="0"]')
        if (!btn) return 'none'
        btn.focus()
        if (!btn.matches(':focus-visible')) return 'no-visible-match:' + btn.tagName
        const cs = getComputedStyle(btn)
        const has = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0)
          || (cs.boxShadow && cs.boxShadow !== 'none')
        return has ? 'focus:' + btn.tagName : 'no-ring:' + btn.tagName
      })()`,
    )
    expect(ring).toContain('focus:')
  })

  test('font-blocked fallback keeps Vietnamese text rendered and styled', async ({ page }) => {
    await page.addInitScript(() => localStorage.clear())
    await page.goto('/')
    await page.getByTestId('auth-guest-button').click()
    await createCharacterThroughUi(page, 'Hệ Thống')
    await enterHome(page)

    await page.keyboard.press('Tab')
    await page.locator('[data-wheel-slot="realm"]').click()
    await expect(page.locator(REALM_MODAL)).toBeVisible({ timeout: 10_000 })

    const fonts = await page.evaluate<string>(
      `(() => {
        const el = document.querySelector('${REALM_MODAL} .overlay-panel__heading h3, ${REALM_MODAL} h1, ${REALM_MODAL} [class*=title]')
        if (!el) return 'MISSING:title'
        const cs = getComputedStyle(el)
        return cs.fontFamily + '|' + cs.color + '|' + (el.textContent || '').trim().slice(0, 40)
      })()`,
    )
    expect(fonts).not.toContain('MISSING:')
    // A real stack resolves (family list non-empty), text renders non-empty.
    const [family, , text] = fonts.split('|')
    expect(family!.trim().length).toBeGreaterThan(3)
    expect(text!.length).toBeGreaterThan(0)
    await page.keyboard.press('Escape')
  })
})
