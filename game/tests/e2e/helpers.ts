import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

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
 * Tạo nhân vật qua 3 bước UI thực: tên → chọn thiên phú → phân bổ điểm
 * thuộc tính → "Bước vào tiên đồ".
 *
 * Prerequisite: guest auth done (bootToGuestHome).
 */
export async function createCharacterThroughUi(page: Page, name: string): Promise<void> {
  const creation = page.getByTestId('character-creation-screen')
  await expect(creation).toBeVisible({ timeout: 15_000 })

  // Step 1: name
  await page.getByTestId('creation-name-input').fill(name)
  // Validation chạy theo input event — fill() set value qua input event,
  // nhưng nút enable computed có thể lệch 1 tick; expect-enabled thay vì
  // click-retry (best practice: explicit state assertion).
  await expect(page.getByTestId('creation-continue-name')).toBeEnabled({ timeout: 5_000 })
  await page.getByTestId('creation-continue-name').click()

  // Step 2: talent selection — pick the first available talent card.
  const talentCards = creation.locator('[data-testid^="creation-talent-"]')
  await expect(talentCards.first()).toBeVisible({ timeout: 10_000 })
  await talentCards.first().click()

  await page.getByTestId('creation-confirm-talent').click()

  // Step 3: attribute distribution — give each stat exactly 1 point (5 total).
  const buttons = creation.locator('[data-testid^="creation-attribute-plus-"]')
  const count = await buttons.count()
  // There are 5 attributes; if we have >=5, click each once.
  for (let i = 0; i < Math.min(count, 5); i++) {
    await buttons.nth(i).click()
  }

  // Finish — "Bước vào tiên đồ" triggers onCharacterCreated → bootGame(true).
  await page.getByTestId('creation-finish').click()
}

/**
 * Wait for the game home (Động Phủ) to be visible after character creation.
 * The home appears when entryStage === 'game' and isBooted === true.
 * Dismisses the tutorial overlay if it appears.
 */
export async function enterHome(page: Page): Promise<void> {
  await expect(page.locator('.game-root')).toBeVisible({ timeout: 30_000 })

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
