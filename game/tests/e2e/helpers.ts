import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

// Spec F8 - guest sessions bind the shared ':guest' save slot; page.evaluate
// bodies below carry this as a string literal because Playwright cannot
// serialize module-scope values into the browser context.
export const GUEST_SAVE_KEY = 'tien-hiep-idle-save:guest'

/**
 * Boot the app fresh: goto '/', wait out the intro loading screen (~3s in
 * App.vue), then click "Chơi ngay" (guest auth).
 *
 * NOTE: intentionally NO localStorage-clearing init script — Playwright
 * gives each test a fresh context (empty localStorage already), and an
 * init script would also run on page.reload(), wiping the save the
 * save-reload spec needs to restore.
 *
 * Leaves the page on the character-creation screen.
 */
export async function bootToGuestHome(page: Page): Promise<void> {
  await page.goto('/')

  const auth = page.getByTestId('auth-screen')
  await expect(auth).toBeVisible({ timeout: 15_000 })

  // "Chơi ngay" (guest) skips credentials; MockAuthService resolves after 250ms.
  await page.getByTestId('auth-guest-button').click()
}

/**
 * Creates a character through the ONE unified screen (BETA-CREATION):
 * name + 1 talent + 1 starting-skill pick -> finish. The attribute
 * allocation step no longer exists - base stats default to 1/1/1/1/1.
 *
 * Prerequisite: guest auth done (bootToGuestHome).
 */
export async function createCharacterThroughUi(page: Page, name: string): Promise<void> {
  const creation = page.getByTestId('character-creation-screen')
  await expect(creation).toBeVisible({ timeout: 15_000 })

  // Name - validation runs on input; the finish gate needs a valid name.
  await page.getByTestId('creation-name-input').fill(name)

  // Talent - pick the first available card (exactly one required).
  const talentCards = creation.locator('[data-testid^="creation-talent-"]')
  await expect(talentCards.first()).toBeVisible({ timeout: 10_000 })
  await talentCards.first().click()

  // Starting skill - tram (Huy Kiem) keeps the historical basic.
  await page.getByTestId('creation-skill-tram').click()

  // Finish - enabled once name + talent + skill are all satisfied.
  await expect(page.getByTestId('creation-finish')).toBeEnabled({ timeout: 5_000 })
  await page.getByTestId('creation-finish').click()
}

/**
 * Blocks until no presentation transition is in flight: the curtain is open,
 * gameplay input is unlocked and the route has committed.
 */
export async function waitForPresentationIdle(page: Page, timeout = 30_000): Promise<void> {
  const overlay = page.getByTestId('presentation-overlay')

  await expect(overlay).toHaveAttribute('data-phase', 'idle', { timeout })
  await expect(overlay).toHaveAttribute('data-curtain', 'opened', { timeout })
}

/**
 * Wait for the game home (Động Phủ) to be visible after character creation.
 * The home appears when entryStage === 'game' and isBooted === true.
 * Dismisses the tutorial overlay if it appears.
 */
export async function enterHome(page: Page): Promise<void> {
  await expect(page.locator('.game-root')).toBeVisible({ timeout: 30_000 })

  // The Home DOM mounts BEHIND the closed curtain, and the curtain locks
  // pointer/keyboard input until the transition is revealed and released.
  // Interacting before that is a race, so wait for the coordinator to settle.
  await waitForPresentationIdle(page)

  // Tutorial overlay (z-index 1900) blocks all pointer events. Dismiss it.
  const tutorial = page.locator('.tutorial-overlay')
  if (await tutorial.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await page.getByRole('button', { name: 'Bỏ Qua' }).click()
    await expect(tutorial).not.toBeVisible({ timeout: 5_000 })
  }

  // Offline summary modal (only shows when >60s offline) would also block.
  const offlineModal = page.locator('.offline-summary')
  if (await offlineModal.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await offlineModal.getByRole('button', { name: 'Tiếp Tục' }).click()
    await expect(offlineModal).not.toBeVisible({ timeout: 5_000 })
  }
}

/**
 * After a reload the app goes intro → auth again (entryStage 'intro').
 * Authenticate as guest again; bootGame(false) restores the saved character
 * (it does NOT create a new one when a valid save exists).
 */
export async function reauthAndEnterHome(page: Page): Promise<void> {
  const auth = page.getByTestId('auth-screen')
  await expect(auth).toBeVisible({ timeout: 15_000 })
  await page.getByTestId('auth-guest-button').click()

  await enterHome(page)
}

/**
 * Open the Cài Đặt panel and click the manual save button.
 */
export async function openSettingsAndSave(page: Page): Promise<void> {
  // Tab to open command wheel, then click Cài Đặt slot.
  await page.keyboard.press('Tab')
  const settingsSlot = page.locator('[data-wheel-slot="settings"]')
  await expect(settingsSlot).toBeVisible({ timeout: 10_000 })
  await settingsSlot.click()

  // Settings overlay opens → click "Lưu Tiến Trình".
  const saveButton = page.getByTestId('settings-save-button')
  await expect(saveButton).toBeVisible({ timeout: 10_000 })
  await saveButton.click()
}

/**
 * UI/UX QA remediation (Task 10, 2026-09-07) — shared fixture helpers:
 * console/pageerror/request-failure gate + keyboard journey support.
 */

/** Loại lỗi cho phép (documented intentional) — thêm theo evidence. */
const ALLOWED_CONSOLE_PATTERNS: RegExp[] = [
  // Devtools panel dev-only warnings
  /^\\[vite\\]/,
]

/**
 * Đăng ký listener thu thập console error/pageerror/request failure ngay
 * sau khi tạo page — gọi ĐẦU TIÊN trong test. Assert bằng
 * assertNoBrowserErrors() ở cuối test.
 */
export function collectBrowserErrors(page: import('@playwright/test').Page): {
  errors: string[]
  pageErrors: string[]
  failedRequests: string[]
} {
  const errors: string[] = []
  const pageErrors: string[] = []
  const failedRequests: string[] = []

  page.on('console', (message) => {
    if (message.type() === 'error' && !ALLOWED_CONSOLE_PATTERNS.some((pattern) => pattern.test(message.text()))) {
      errors.push(message.text())
    }
  })

  page.on('pageerror', (error) => {
    pageErrors.push(String(error))
  })

  page.on('requestfailed', (request) => {
    failedRequests.push(`${request.url()} — ${request.failure()?.errorText ?? 'unknown'}`)
  })

  return { errors, pageErrors, failedRequests }
}

/**
 * Assert 0 unexpected console/page errors. Failed requests chỉ báo cáo
 * (dev server asset 404 được cover bởi network-failure spec riêng).
 */
export function assertNoBrowserErrors(collected: {
  errors: string[]
  pageErrors: string[]
}): void {
  expect(collected.pageErrors, 'không được có uncaught page error').toEqual([])
  expect(collected.errors, 'không được có console error ngoài allowlist').toEqual([])
}
