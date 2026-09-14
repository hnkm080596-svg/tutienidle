import { test as base } from '@playwright/test'

/**
 * Suite-wide network independence (E2E baseline repair, 2026-09-14).
 *
 * src/assets/theme.css:10 @imports a Google Fonts stylesheet at runtime.
 * Where external requests are blocked (the 2026-09-14 audit environment
 * answered with ERR_NETWORK_ACCESS_DENIED) the failed stylesheet surfaces
 * as a console error — which trips collectBrowserErrors() /
 * assertNoBrowserErrors() in gated specs — and a request that hangs
 * instead of failing stalls page load for EVERY spec.
 *
 * Fulfilling the stylesheet request with an empty 200 keeps the suite
 * deterministic offline: no @font-face rules are registered, so the
 * browser never requests fonts.gstatic.com binaries, and every font stack
 * in theme.css already carries system fallbacks (--font-display /
 * --font-body). Asserted behavior does not depend on font glyphs.
 *
 * Product question (tracked in docs/qa/2026-09-14-e2e-baseline.md):
 * self-hosting the fonts would benefit real offline players too — that is
 * a product decision; this fixture only removes the test-suite's
 * dependence on external network reachability.
 */
export const test = base.extend<{ stubExternalFonts: void }>({
  // Auto fixture: installs the route on each test's page before the test
  // body runs (before the first page.goto), so no spec can race it.
  stubExternalFonts: [
    async ({ page }, use) => {
      await page.route('https://fonts.googleapis.com/**', (route) =>
        route.fulfill({ status: 200, contentType: 'text/css', body: '' }),
      )
      await use()
    },
    { auto: true },
  ],
})

export { expect } from '@playwright/test'
export type { Locator, Page } from '@playwright/test'
