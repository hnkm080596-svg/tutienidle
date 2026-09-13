# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: presentation-routing.spec.ts >> Presentation routing regression (Task 1 baseline) >> stage start activates CombatScene and deactivates MainScene in Phaser
- Location: tests\e2e\presentation-routing.spec.ts:14:3

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false

Call Log:
- Timeout 15000ms exceeded while waiting on the predicate
```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e2]:
    - generic [ref=e4]:
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
      - dialog [ref=e17]:
        - banner [ref=e18]:
          - generic [ref=e21]:
            - paragraph [ref=e22]: Truyền Tống Trận
            - text: Cấp 1 / 1
        - generic [ref=e28]:
          - navigation "Chọn địa giới và chương" [ref=e29]:
            - generic [ref=e30]:
              - generic [ref=e31]: Địa Giới
              - button "Thanh Vân" [pressed] [ref=e32] [cursor=pointer]
            - generic [ref=e34]:
              - generic [ref=e35]: Cảnh Giới Khu Vực
              - button "Phàm Nhân" [pressed] [ref=e36] [cursor=pointer]
              - button "Luyện Khí" [ref=e38] [cursor=pointer]
              - button "Trúc Cơ" [ref=e40] [cursor=pointer]
          - generic [ref=e42]:
            - generic [ref=e43]:
              - heading "Chọn tầng" [level=4] [ref=e44]
              - generic [ref=e45]:
                - button "1 Tầng 1 Dã Trư · Sơn Khấu" [ref=e46] [cursor=pointer]:
                  - generic [ref=e47]: "1"
                  - generic [ref=e48]:
                    - strong [ref=e49]: Tầng 1
                    - generic [ref=e50]: Dã Trư · Sơn Khấu
                - button "2 Tầng 2 Hung Dã Trư · Hung Sơn Khấu" [ref=e51]:
                  - generic [ref=e52]: "2"
                  - generic [ref=e53]:
                    - strong [ref=e54]: Tầng 2
                    - generic [ref=e55]: Hung Dã Trư · Hung Sơn Khấu
                - button "3 Tầng 3 Hoang Cẩu · Man Hổ" [ref=e56]:
                  - generic [ref=e57]: "3"
                  - generic [ref=e58]:
                    - strong [ref=e59]: Tầng 3
                    - generic [ref=e60]: Hoang Cẩu · Man Hổ
                - button "4 Tầng 4 Hung Hoang Cẩu · Hung Man Hổ" [ref=e61]:
                  - generic [ref=e62]: "4"
                  - generic [ref=e63]:
                    - strong [ref=e64]: Tầng 4
                    - generic [ref=e65]: Hung Hoang Cẩu · Hung Man Hổ
                - button "5 Tầng 5 Thạch Miêu · Nê Ngưu" [ref=e66]:
                  - generic [ref=e67]: "5"
                  - generic [ref=e68]:
                    - strong [ref=e69]: Tầng 5
                    - generic [ref=e70]: Thạch Miêu · Nê Ngưu
                - button "6 Tầng 6 Hung Thạch Miêu · Hung Nê Ngưu" [ref=e71]:
                  - generic [ref=e72]: "6"
                  - generic [ref=e73]:
                    - strong [ref=e74]: Tầng 6
                    - generic [ref=e75]: Hung Thạch Miêu · Hung Nê Ngưu
                - button "7 Tầng 7 Ngân Hồ · Thiết Giáp Trư" [ref=e76]:
                  - generic [ref=e77]: "7"
                  - generic [ref=e78]:
                    - strong [ref=e79]: Tầng 7
                    - generic [ref=e80]: Ngân Hồ · Thiết Giáp Trư
                - button "8 Tầng 8 Hung Ngân Hồ · Hung Thiết Giáp Trư" [ref=e81]:
                  - generic [ref=e82]: "8"
                  - generic [ref=e83]:
                    - strong [ref=e84]: Tầng 8
                    - generic [ref=e85]: Hung Ngân Hồ · Hung Thiết Giáp Trư
                - button "9 Tầng 9 Thủy Lang · Cự Ngạc" [ref=e86]:
                  - generic [ref=e87]: "9"
                  - generic [ref=e88]:
                    - strong [ref=e89]: Tầng 9
                    - generic [ref=e90]: Thủy Lang · Cự Ngạc
                - button "10 Tầng 10 Hung Thủy Lang · Hung Cự Ngạc BOSS" [ref=e91]:
                  - generic [ref=e92]: "10"
                  - generic [ref=e93]:
                    - strong [ref=e94]: Tầng 10
                    - generic [ref=e95]: Hung Thủy Lang · Hung Cự Ngạc
                  - generic [ref=e96]: BOSS
            - generic [ref=e97]:
              - heading "Động 1" [level=4] [ref=e98]
              - paragraph [ref=e99]: Cửa hang đầu tiên nơi chân núi, Dã Trư và Sơn Khấu tranh nhau từng tấc đất — thử thách đầu đời của 1 phàm nhân.
              - generic [ref=e101]:
                - strong [ref=e102]: "10"
                - text: quái
              - generic [ref=e103]:
                - article [ref=e104]:
                  - generic [ref=e105]: D
                  - generic [ref=e106]:
                    - strong [ref=e107]: Dã Trư
                    - generic [ref=e108]: Lv.1 · Cận chiến
                - article [ref=e109]:
                  - generic [ref=e110]: S
                  - generic [ref=e111]:
                    - strong [ref=e112]: Sơn Khấu
                    - generic [ref=e113]: Lv.1 · Cận chiến · 10% Tinh Anh
              - generic [ref=e114]:
                - button "Thủ Công" [pressed] [ref=e115] [cursor=pointer]
                - button "Lặp Lại" [ref=e117] [cursor=pointer]
                - button "Tự Động Tiến Ải" [ref=e119] [cursor=pointer]
                - button "Tự Động Hoàn Mỹ" [disabled] [ref=e121]
              - paragraph [ref=e123]: Kết thúc trận và chờ bạn quyết định.
              - generic [ref=e124]:
                - button "Chỉnh Build" [ref=e125] [cursor=pointer]
                - button "Bắt Đầu" [active] [ref=e127] [cursor=pointer]
    - status [ref=e129]:
      - generic [ref=e132]: Đang tải...
  - generic [ref=e135]:
    - generic "Toggle devtools panel" [ref=e136] [cursor=pointer]
    - generic "Toggle Component Inspector" [ref=e142] [cursor=pointer]
```

# Test source

```ts
  1  | import { expect, test } from '@playwright/test'
  2  | 
  3  | import { bootToGuestHome, createCharacterThroughUi, enterHome } from './helpers'
  4  | 
  5  | /**
  6  |  * Presentation coordinator migration regression spec (Task 1 baseline).
  7  |  *
  8  |  * F14 finding: existing create-to-combat.spec.ts asserts DOM overlays only.
  9  |  * This spec adds the missing Phaser scene-state assertion: after clicking
  10 |  * stage-start, CombatScene must be active and MainScene must be inactive
  11 |  * in the actual Phaser scene manager.
  12 |  */
  13 | test.describe('Presentation routing regression (Task 1 baseline)', () => {
  14 |   test('stage start activates CombatScene and deactivates MainScene in Phaser', async ({ page }) => {
  15 |     test.setTimeout(120_000)
  16 | 
  17 |     page.on('console', (msg) => console.log('BROWSER:', msg.text()))
  18 | 
  19 |     await bootToGuestHome(page)
  20 |     await createCharacterThroughUi(page, 'E2E Presentation 01')
  21 |     await enterHome(page)
  22 | 
  23 |     // Open command wheel via Tab, then teleport_array slot -> stage select.
  24 |     await page.keyboard.press('Tab')
  25 |     const teleportSlot = page.locator('[data-wheel-slot="teleport_array"]')
  26 |     await expect(teleportSlot).toBeVisible({ timeout: 10_000 })
  27 |     await teleportSlot.click()
  28 | 
  29 |     const overlay = page.getByTestId('function-overlay-panel')
  30 |     await expect(overlay).toBeVisible({ timeout: 10_000 })
  31 | 
  32 |     const startButton = page.getByTestId('stage-start-button')
  33 |     await expect(startButton).toBeEnabled({ timeout: 10_000 })
  34 |     await startButton.click()
  35 | 
  36 |     // Assert immediately after click, BEFORE waiting for any result: the
  37 |     // Phaser scene manager must show CombatScene active and MainScene
  38 |     // inactive. This is the actual navigation contract the presentation
  39 |     // coordinator migration replaces.
  40 |     await expect
  41 |       .poll(() =>
  42 |         page.evaluate(() => {
  43 |           const game = (window as Window & {
  44 |             __tutienPhaserGame?: { scene: { isActive(key: string): boolean } }
  45 |           }).__tutienPhaserGame
  46 |           return (
  47 |             Boolean(game?.scene.isActive('CombatScene')) && !game?.scene.isActive('MainScene')
  48 |           )
  49 |         }),
  50 |       )
> 51 |       .toBe(true)
     |        ^ Error: expect(received).toBe(expected) // Object.is equality
  52 |   })
  53 | })
  54 | 
```