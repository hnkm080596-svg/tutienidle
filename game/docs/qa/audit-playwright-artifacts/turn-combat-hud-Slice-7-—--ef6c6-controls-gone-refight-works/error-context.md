# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: turn-combat-hud.spec.ts >> Slice 7 — turn combat HUD >> battle runs, combat slots render, legacy controls gone, refight works
- Location: tests\e2e\turn-combat-hud.spec.ts:29:3

# Error details

```
Test timeout of 210000ms exceeded.
```

```
Error: expect(locator).toBeVisible() failed

Locator: locator('.combat-victory-panel').or(locator('.combat-defeat-panel'))
Expected: visible
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 120000ms
  - waiting for locator('.combat-victory-panel').or(locator('.combat-defeat-panel'))
  - Test timeout of 210000ms exceeded.

```

```yaml
- text: Thanh Vân • Động 1 6 / 10 quái
- complementary
- radiogroup "Chiến lược AI chọn mục tiêu":
  - text: AI Mục Tiêu
  - radio "Gần nhất" [checked]
  - text: Gần nhất
  - radio "Ưu tiên Boss"
  - text: Ưu tiên Boss
  - radio "Ưu tiên Elite"
  - text: Ưu tiên Elite
  - radio "HP thấp nhất"
  - text: HP thấp nhất
  - radio "HP cao nhất"
  - text: HP cao nhất
- text: E2E Turn HUD 82/116
- progressbar
- text: Hiệp 15/20 Lượt tới
- list:
  - listitem:
    - text: ▶ Dã Trư
    - progressbar
  - listitem:
    - text: E2E Turn HUD
    - progressbar
  - listitem:
    - text: Sơn Khấu
    - progressbar
  - listitem:
    - text: Dã Trư
    - progressbar
  - listitem:
    - text: E2E Turn HUD
    - progressbar
- button "Nhật ký ▾" [expanded]
- paragraph: "Lượt 1: player dùng generic_physical → mortal_mountain_bandit_a227b194-56e6-49db-9ed1-f84de5ff5cec"
- status
- img
- img
- status:
  - 'button "Đóng thông báo: Tinh Hoa Phàm Thể"': ×
  - text: T Nhận được Tinh Hoa Phàm Thể
  - strong: "+3"
- status:
  - 'button "Đóng thông báo: Thanh Vân Quán"': ×
  - text: T Nhận được Cửu Phẩm · Địa Chất · Thanh Vân Quán
  - strong: "+1"
```

# Test source

```ts
  21  |  * Outcome (fix round 1, freeze-fix review, 2026-09-06): trận Tầng 1 CÓ
  22  |  * THỂ kết thúc Thắng hoặc Thua (giống create-to-combat.spec.ts đã ghi
  23  |  * nhận từ 2026-08-29 — nhân vật phàm nhân mới tạo trên Tầng 1 thường
  24  |  * Thua sau ~100s). Assertion chấp nhận cả 2 kết quả — chỉ khẳng định
  25  |  * trận ĐÃ kết thúc (result panel hiện) + HUD hoạt động đúng, không còn
  26  |  * giả định "luôn Thắng" (gate flaky trước đây).
  27  |  */
  28  | test.describe('Slice 7 — turn combat HUD', () => {
  29  |   test('battle runs, combat slots render, legacy controls gone, refight works', async ({ page }) => {
  30  |     test.setTimeout(210_000)
  31  | 
  32  |     await bootToGuestHome(page)
  33  |     await createCharacterThroughUi(page, 'E2E Turn HUD')
  34  |     await enterHome(page)
  35  | 
  36  |     // Open stage select via keyboard Tab (deterministic) and start battle 1.
  37  |     await page.keyboard.press('Tab')
  38  | 
  39  |     const teleportSlot = page.locator('[data-wheel-slot="teleport_array"]')
  40  |     await expect(teleportSlot).toBeVisible({ timeout: 10_000 })
  41  |     await teleportSlot.click()
  42  | 
  43  |     const overlay = page.getByTestId('function-overlay-panel')
  44  |     await expect(overlay).toBeVisible({ timeout: 10_000 })
  45  | 
  46  |     const startButton = page.getByTestId('stage-start-button')
  47  |     await expect(startButton).toBeEnabled({ timeout: 10_000 })
  48  | 
  49  |     // Task 11 (UI/UX remediation, 2026-09-07) — assert HUD qua RUNTIME
  50  |     // event probe (event bus thật qua registry) thay vì DOM polling: trận
  51  |     // có thể kết thúc rất nhanh (char mới 1-hit-killed — gameplay thật,
  52  |     // không phải defect), DOM poll 100ms lỡ窗口 render ngắn. Event probe
  53  |     // bắt MỌI snapshot event bất kể tốc độ — bằng chứng chắc chắn hơn.
  54  |     await page.evaluate(() => {
  55  |       const w = window as unknown as {
  56  |         __tutienPhaserGame?: { registry: { get(key: string): unknown } }
  57  |         __hudProbe: { snapshots: number; fightingSnapshots: number }
  58  |       }
  59  | 
  60  |       w.__hudProbe = { snapshots: 0, fightingSnapshots: 0 }
  61  | 
  62  |       const bus = w.__tutienPhaserGame?.registry.get('eventBus') as
  63  |         | { on(eventName: string, handler: (event: unknown) => void): void }
  64  |         | undefined
  65  | 
  66  |       if (!bus) {
  67  |         throw new Error('eventBus chưa expose trong registry')
  68  |       }
  69  | 
  70  |       bus.on('turn_battle_entity_snapshot', (raw) => {
  71  |         const event = raw as { countdownProgress?: number }
  72  |         const probe = (w as unknown as { __hudProbe: { snapshots: number; fightingSnapshots: number } }).__hudProbe
  73  | 
  74  |         probe.snapshots++
  75  | 
  76  |         if (event.countdownProgress === undefined) {
  77  |           probe.fightingSnapshots++
  78  |         }
  79  |       })
  80  |     })
  81  | 
  82  |     await startButton.click()
  83  | 
  84  |     // Battle 1 runs to a result panel (victory OR defeat - stage 1 can
  85  |     // legitimately end either way, see note above).
  86  |     const victory = page.locator('.combat-victory-panel')
  87  |     const defeat = page.locator('.combat-defeat-panel')
  88  |     await expect(victory.or(defeat)).toBeVisible({ timeout: 120_000 })
  89  | 
  90  |     // Snapshot events phải chảy (engine ↔ scene wiring sống) — gồm cả
  91  |     // fighting phase (countdownProgress undefined) nhiều tick.
  92  |     const hudProbe = await page.evaluate(() => {
  93  |       const w = window as unknown as { __hudProbe?: { snapshots: number; fightingSnapshots: number } }
  94  | 
  95  |       return w.__hudProbe
  96  |     })
  97  | 
  98  |     expect(hudProbe?.snapshots ?? 0, 'turn_battle_entity_snapshot phải được phát').toBeGreaterThan(5)
  99  |     expect(
  100 |       hudProbe?.fightingSnapshots ?? 0,
  101 |       'snapshot fighting phase phải chạy (HUD mount window tồn tại)',
  102 |     ).toBeGreaterThan(2)
  103 | 
  104 |     // Legacy Kiếm Tu controls must be GONE (retired in Task 7).
  105 |     await expect(page.locator('.kiem-tu-combat-hud__ult')).toHaveCount(0)
  106 |     await expect(page.getByText('Nhịp Tụ Lực')).toHaveCount(0)
  107 | 
  108 |     // Refight — regression guard for the StageManager-release fix. Both
  109 |     // outcome panels have a `__retry` button (same class suffix) — click
  110 |     // whichever is visible.
  111 |     const retryButton = (await victory.isVisible())
  112 |       ? page.locator('.combat-victory-panel__retry')
  113 |       : page.locator('.combat-defeat-panel__retry')
  114 |     await retryButton.click()
  115 |     await expect(victory.or(defeat)).toBeHidden({ timeout: 15_000 })
  116 | 
  117 |     // Battle 2 eventually resolves (no crash, no error screen). Refight
  118 |     // KHÔNG assert slot DOM nữa — có thể thua nhanh trước khi poll kịp
  119 |     // nhìn (gameplay thật, xem comment Task 11 ở trên — wiring đã được
  120 |     // assert bằng event probe ở trận 1).
> 121 |     await expect(victory.or(defeat)).toBeVisible({
      |                                      ^ Error: expect(locator).toBeVisible() failed
  122 |       timeout: 120_000,
  123 |     })
  124 | 
  125 |     // No error boundary triggered.
  126 |     await expect(page.locator('.error-screen')).toHaveCount(0)
  127 |   })
  128 | })
  129 | 
```