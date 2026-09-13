# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: accessibility.spec.ts >> Keyboard accessibility journey >> auth + character creation operable by keyboard only
- Location: tests\e2e\accessibility.spec.ts:12:3

# Error details

```
Error: không được có console error ngoài allowlist

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 3

- Array []
+ Array [
+   "Failed to load resource: net::ERR_NETWORK_ACCESS_DENIED",
+ ]
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - generic [ref=e5]:
      - generic:
        - generic:
          - generic:
            - generic:
              - button "Xem yêu cầu mở Đan Phòng":
                - generic [ref=e6] [cursor=pointer]
              - generic:
                - generic: Đan Phòng
                - generic: Chưa mở
            - generic:
              - button "Mở Khai Vật Đường":
                - generic [ref=e7] [cursor=pointer]
              - generic:
                - generic: Khai Vật Đường
                - generic: Cấp 1
            - generic:
              - button "Mở Truyền Tống Trận":
                - generic [ref=e8] [cursor=pointer]
              - generic:
                - generic: Truyền Tống Trận
                - generic: Cấp 1
            - generic:
              - button "Xem yêu cầu mở Khí Đường":
                - generic [ref=e9] [cursor=pointer]
              - generic:
                - generic: Khí Đường
                - generic: Chưa mở
            - generic:
              - button "Xem yêu cầu mở Ký Bảo Các":
                - generic [ref=e10] [cursor=pointer]
              - generic:
                - generic: Ký Bảo Các
                - generic: Chưa mở
            - generic:
              - button "Xem yêu cầu mở Chiêu Hiền Quán":
                - generic [ref=e11] [cursor=pointer]
              - generic:
                - generic: Chiêu Hiền Quán
                - generic: Chưa mở
        - button "Mở bảng lệnh Động Phủ" [ref=e12] [cursor=pointer]
    - status
  - generic [ref=e16]:
    - generic "Toggle devtools panel" [ref=e17] [cursor=pointer]
    - generic "Toggle Component Inspector" [ref=e23] [cursor=pointer]
```

# Test source

```ts
  81  |   // The Home DOM mounts BEHIND the closed curtain, and the curtain locks
  82  |   // pointer/keyboard input until the transition is revealed and released.
  83  |   // Interacting before that is a race, so wait for the coordinator to settle.
  84  |   await waitForPresentationIdle(page)
  85  | 
  86  |   // Tutorial overlay (z-index 1900) blocks all pointer events. Dismiss it.
  87  |   const tutorial = page.locator('.tutorial-overlay')
  88  |   if (await tutorial.isVisible({ timeout: 5_000 }).catch(() => false)) {
  89  |     await page.getByRole('button', { name: 'Bỏ Qua' }).click()
  90  |     await expect(tutorial).not.toBeVisible({ timeout: 5_000 })
  91  |   }
  92  | 
  93  |   // Offline summary modal (only shows when >60s offline) would also block.
  94  |   const offlineModal = page.locator('.offline-summary')
  95  |   if (await offlineModal.isVisible({ timeout: 3_000 }).catch(() => false)) {
  96  |     await offlineModal.getByRole('button', { name: 'Tiếp Tục' }).click()
  97  |     await expect(offlineModal).not.toBeVisible({ timeout: 5_000 })
  98  |   }
  99  | }
  100 | 
  101 | /**
  102 |  * After a reload the app goes intro → auth again (entryStage 'intro').
  103 |  * Authenticate as guest again; bootGame(false) restores the saved character
  104 |  * (it does NOT create a new one when a valid save exists).
  105 |  */
  106 | export async function reauthAndEnterHome(page: Page): Promise<void> {
  107 |   const auth = page.getByTestId('auth-screen')
  108 |   await expect(auth).toBeVisible({ timeout: 15_000 })
  109 |   await page.getByTestId('auth-guest-button').click()
  110 | 
  111 |   await enterHome(page)
  112 | }
  113 | 
  114 | /**
  115 |  * Open the Cài Đặt panel and click the manual save button.
  116 |  */
  117 | export async function openSettingsAndSave(page: Page): Promise<void> {
  118 |   // Tab to open command wheel, then click Cài Đặt slot.
  119 |   await page.keyboard.press('Tab')
  120 |   const settingsSlot = page.locator('[data-wheel-slot="settings"]')
  121 |   await expect(settingsSlot).toBeVisible({ timeout: 10_000 })
  122 |   await settingsSlot.click()
  123 | 
  124 |   // Settings overlay opens → click "Lưu Tiến Trình".
  125 |   const saveButton = page.getByTestId('settings-save-button')
  126 |   await expect(saveButton).toBeVisible({ timeout: 10_000 })
  127 |   await saveButton.click()
  128 | }
  129 | 
  130 | /**
  131 |  * UI/UX QA remediation (Task 10, 2026-09-07) — shared fixture helpers:
  132 |  * console/pageerror/request-failure gate + keyboard journey support.
  133 |  */
  134 | 
  135 | /** Loại lỗi cho phép (documented intentional) — thêm theo evidence. */
  136 | const ALLOWED_CONSOLE_PATTERNS: RegExp[] = [
  137 |   // Devtools panel dev-only warnings
  138 |   /^\\[vite\\]/,
  139 | ]
  140 | 
  141 | /**
  142 |  * Đăng ký listener thu thập console error/pageerror/request failure ngay
  143 |  * sau khi tạo page — gọi ĐẦU TIÊN trong test. Assert bằng
  144 |  * assertNoBrowserErrors() ở cuối test.
  145 |  */
  146 | export function collectBrowserErrors(page: import('@playwright/test').Page): {
  147 |   errors: string[]
  148 |   pageErrors: string[]
  149 |   failedRequests: string[]
  150 | } {
  151 |   const errors: string[] = []
  152 |   const pageErrors: string[] = []
  153 |   const failedRequests: string[] = []
  154 | 
  155 |   page.on('console', (message) => {
  156 |     if (message.type() === 'error' && !ALLOWED_CONSOLE_PATTERNS.some((pattern) => pattern.test(message.text()))) {
  157 |       errors.push(message.text())
  158 |     }
  159 |   })
  160 | 
  161 |   page.on('pageerror', (error) => {
  162 |     pageErrors.push(String(error))
  163 |   })
  164 | 
  165 |   page.on('requestfailed', (request) => {
  166 |     failedRequests.push(`${request.url()} — ${request.failure()?.errorText ?? 'unknown'}`)
  167 |   })
  168 | 
  169 |   return { errors, pageErrors, failedRequests }
  170 | }
  171 | 
  172 | /**
  173 |  * Assert 0 unexpected console/page errors. Failed requests chỉ báo cáo
  174 |  * (dev server asset 404 được cover bởi network-failure spec riêng).
  175 |  */
  176 | export function assertNoBrowserErrors(collected: {
  177 |   errors: string[]
  178 |   pageErrors: string[]
  179 | }): void {
  180 |   expect(collected.pageErrors, 'không được có uncaught page error').toEqual([])
> 181 |   expect(collected.errors, 'không được có console error ngoài allowlist').toEqual([])
      |                                                                           ^ Error: không được có console error ngoài allowlist
  182 | }
  183 | 
```