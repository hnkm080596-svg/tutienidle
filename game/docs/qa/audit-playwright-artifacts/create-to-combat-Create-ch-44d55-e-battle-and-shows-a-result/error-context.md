# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: create-to-combat.spec.ts >> Create character to combat >> creates a character, starts a stage battle and shows a result
- Location: tests\e2e\create-to-combat.spec.ts:12:3

# Error details

```
Error: Combat result modal (victory/defeat) should appear

Combat result modal (victory/defeat) should appear

expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false

Call Log:
- Timeout 180000ms exceeded while waiting on the predicate
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - generic [ref=e4]:
      - generic:
        - generic [ref=e8]:
          - generic [ref=e9]: Thanh Vân • Động 1
          - generic [ref=e10]: 3 / 10 quái
        - complementary [ref=e11]
        - radiogroup "Chiến lược AI chọn mục tiêu" [ref=e12]:
          - generic [ref=e13]: AI Mục Tiêu
          - generic "Chọn mục tiêu có khoảng cách Chebyshev nhỏ nhất." [ref=e14] [cursor=pointer]:
            - radio "Gần nhất" [checked] [ref=e15]
            - generic [ref=e16]: Gần nhất
          - generic "Boss trước, sau đó xếp theo khoảng cách." [ref=e17] [cursor=pointer]:
            - radio "Ưu tiên Boss" [ref=e18]
            - generic [ref=e19]: Ưu tiên Boss
          - generic "Boss → Elite → thường, sau đó xếp theo khoảng cách." [ref=e20] [cursor=pointer]:
            - radio "Ưu tiên Elite" [ref=e21]
            - generic [ref=e22]: Ưu tiên Elite
          - generic "Chọn mục tiêu đang còn máu thấp nhất." [ref=e23] [cursor=pointer]:
            - radio "HP thấp nhất" [ref=e24]
            - generic [ref=e25]: HP thấp nhất
          - generic "Chọn mục tiêu đang còn máu cao nhất." [ref=e26] [cursor=pointer]:
            - radio "HP cao nhất" [ref=e27]
            - generic [ref=e28]: HP cao nhất
        - generic:
          - generic:
            - generic:
              - text: E2E Chiến Đầu 91/116
              - progressbar
          - generic:
            - generic: Hiệp 10/20
            - generic: Lượt tới
            - list:
              - listitem:
                - text: ▶ Sơn Khấu
                - progressbar
              - listitem:
                - text: E2E Chiến Đầu
                - progressbar
              - listitem:
                - text: Sơn Khấu
                - progressbar
              - listitem:
                - text: E2E Chiến Đầu
                - progressbar
              - listitem:
                - text: Sơn Khấu
                - progressbar
        - generic [ref=e29]:
          - button "Nhật ký ▾" [expanded] [ref=e30] [cursor=pointer]
          - paragraph [ref=e32]: "Lượt 1: player dùng generic_physical"
    - status
  - generic [ref=e33]:
    - generic "Toggle devtools panel" [ref=e34] [cursor=pointer]
    - generic "Toggle Component Inspector" [ref=e40] [cursor=pointer]
  - generic:
    - status [ref=e45]:
      - 'button "Đóng thông báo: Tinh Hoa Phàm Thể" [ref=e46] [cursor=pointer]': ×
      - generic [ref=e47]: T
      - generic [ref=e49]:
        - generic [ref=e50]: Nhận được
        - generic [ref=e51]: Tinh Hoa Phàm Thể
      - strong [ref=e52]: "+3"
    - status [ref=e53]:
      - 'button "Đóng thông báo: Thanh Vân Kiếm" [ref=e54] [cursor=pointer]': ×
      - generic [ref=e55]: T
      - generic [ref=e57]:
        - generic [ref=e58]: Nhận được
        - generic [ref=e59]: Cửu Phẩm · Thiên Chất · Thanh Vân Kiếm
      - strong [ref=e60]: "+1"
```

# Test source

```ts
  1  | import { expect, test } from '@playwright/test'
  2  | 
  3  | import { bootToGuestHome, createCharacterThroughUi, enterHome } from './helpers'
  4  | 
  5  | /**
  6  |  * E2E lifecycle spec 2/3 (tech-debt-test-coverage-plan.md §3.3) — tạo
  7  |  * nhân vật qua UI thật (tên → 1 thiên phú → phân bổ 5 điểm) → vào Động
  8  |  * Phủ → mở Truyền Tống Trận (chọn màn) → Bắt Đầu → chờ kết quả
  9  |  * Thắng/Thua hiện trên DOM (không assert pixel canvas).
  10 |  */
  11 | test.describe('Create character to combat', () => {
  12 |   test('creates a character, starts a stage battle and shows a result', async ({ page }) => {
  13 |     test.setTimeout(210_000)
  14 | 
  15 |     await bootToGuestHome(page)
  16 | 
  17 |     await createCharacterThroughUi(page, 'E2E Chiến Đầu')
  18 | 
  19 |     // Đã vào Động Phủ: LeftPanel chrome + command wheel exists (DOM, not canvas).
  20 |     await enterHome(page)
  21 | 
  22 |     // Mở màn chọn ải qua command wheel slot Truyền Tống Trận (data-wheel-slot attr).
  23 |     // Phaser canvas click risk: AVOID clicking the canvas character trigger; instead
  24 |     // use the keyboard shortcut Tab (DongFuCommandWheel.vue listens for Tab keydown)
  25 |     // to open the command wheel deterministically.
  26 |     await page.keyboard.press('Tab')
  27 | 
  28 |     const teleportSlot = page.locator('[data-wheel-slot="teleport_array"]')
  29 |     await expect(teleportSlot).toBeVisible({ timeout: 10_000 })
  30 |     await teleportSlot.click()
  31 | 
  32 |     // Stage select overlay opens (functionType 'stage_select').
  33 |     const overlay = page.getByTestId('function-overlay-panel')
  34 |     await expect(overlay).toBeVisible({ timeout: 10_000 })
  35 | 
  36 |     // A stage is auto-selected (selectFirstStageInChapter). Bắt Đầu should enable.
  37 |     const startButton = page.getByTestId('stage-start-button')
  38 |     await expect(startButton).toBeEnabled({ timeout: 10_000 })
  39 |     await startButton.click()
  40 | 
  41 |     // Combat scene takes over the full screen — top bar shows zone + progress text.
  42 |     const combatTopBar = page.locator('.combat-top-bar')
  43 |     await expect(combatTopBar).toBeVisible({ timeout: 15_000 })
  44 |     await expect(combatTopBar.getByText('quái')).toBeVisible()
  45 | 
  46 |     // Battle runs in REAL TIME (100ms tick). A fresh mortal character on stage 1
  47 |     // (116 enemies) reliably ends in DEFEAT after ~100s of combat (observed in
  48 |     // error snapshots: rewards Linh Thạch +9 granted along the way). Victory
  49 |     // (clearing all 116) would also be a valid end state. Poll generously.
  50 |     const resultModal = page.locator('.combat-result-modal')
  51 |     await expect
  52 |       .poll(async () => resultModal.isVisible(), {
  53 |         timeout: 180_000,
  54 |         message: 'Combat result modal (victory/defeat) should appear',
  55 |       })
> 56 |       .toBe(true)
     |        ^ Error: Combat result modal (victory/defeat) should appear
  57 | 
  58 |     // DOM assertion on the outcome — victory OR defeat, both end the battle.
  59 |     const victory = page.locator('.combat-victory-panel')
  60 |     const defeat = page.locator('.combat-defeat-panel')
  61 |     await expect
  62 |       .poll(async () => (await victory.isVisible()) || (await defeat.isVisible()), {
  63 |         timeout: 10_000,
  64 |         message: 'Victory or defeat panel visible',
  65 |       })
  66 |       .toBe(true)
  67 |   })
  68 | })
  69 | 
```