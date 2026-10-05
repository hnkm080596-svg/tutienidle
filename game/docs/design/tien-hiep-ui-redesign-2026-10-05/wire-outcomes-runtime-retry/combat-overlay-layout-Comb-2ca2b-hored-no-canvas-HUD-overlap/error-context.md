# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: combat-overlay-layout.spec.ts >> Combat overlay layout (T8.3) >> desktop: panels anchored, no canvas-HUD overlap
- Location: tests\e2e\combat-overlay-layout.spec.ts:45:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator:  locator('[data-wheel-slot="teleport_array"]')
Expected: visible
Received: hidden
Timeout:  10000ms

Call log:
  - Expect "toBeVisible" locator('[data-wheel-slot="teleport_array"]') with timeout 10000ms
  - waiting for locator('[data-wheel-slot="teleport_array"]')
    22 × locator resolved to <button data-v-da4de6bf="" class="df-node__orb" aria-pressed="false" data-wheel-slot="teleport_array">…</button>
       - unexpected value "hidden"

```

```yaml
- main "Động Phủ":
  - button "Khí Đường"
  - button "Đan Phòng"
  - button "Truyền Tống Trận"
  - button "Sản Xuất"
  - button "Ký Bảo Các"
  - button "Ẩn / hiện vòng chức năng"
  - button "T83 desktop Phàm Nhân · Tầng 1 130 / 600":
    - strong: T83 desktop
    - text: Phàm Nhân · Tầng 1 130 / 600
  - text: 0 0 0
  - button "Thư"
  - button "Túi"
  - button "Cài"
  - complementary:
    - button "Thu gọn Thiên Cơ Bảng" [expanded]: Thiên Cơ Bảng
    - paragraph: Đạo tâm an nhiên — chưa có việc gấp.
  - text: THANH VÂN ĐỘNG THIÊN Một niệm thanh tĩnh · Vạn pháp quy nguyên
  - 'button "Nhiệm vụ đang theo dõi: Săn Mồi Đầu Tiên"':
    - strong: Săn Mồi Đầu Tiên
    - text: 0/3
  - navigation "Động Phủ":
    - button "Nhân Vật"
    - button "Cảnh Giới"
    - button "Kỹ Năng"
    - button "Nhiệm Vụ"
    - button "Truyền Tống Trận"
    - button "Đan Phòng"
    - button "Sản Xuất"
    - button "Khí Đường"
    - button "Tàng Kinh Các"
    - button "Cài Đặt"
- status
- img
- img
```

# Test source

```ts
  1   | import { expect, test, type Page } from './fixtures'
  2   | 
  3   | import { bootToGuestHome, createCharacterThroughUi, enterHome } from './helpers'
  4   | 
  5   | /**
  6   |  * T8.3 (2026-09-02) - combat overlay layout smoke: sau khi vao tran,
  7   |  * cac panel overlay neo DUNG vi tri va khong de nhau:
  8   |  * - root phu toan viewport (full-canvas coverage)
  9   |  * - AI panel (bang chon muc tieu) neo trai-tren, nam trong battlefield
  10  |  * - Build HUD neo giua-duoi, khong xam pham vung HUD canvas trai-duoi
  11  |  * Chay o 3 viewports (desktop/compact/tall) - screenshot kem theo.
  12  |  * Khong assert pixel canvas - chi DOM geometry (boundingBox).
  13  |  */
  14  | const VIEWPORTS = [
  15  |   { name: 'desktop', width: 1600, height: 900 },
  16  |   { name: 'compact', width: 1366, height: 768 },
  17  |   { name: 'tall', width: 900, height: 1200 },
  18  | ] as const
  19  | 
  20  | /** Vao duoc tran: guest -> tao NV -> home -> teleport -> Bat dau. */
  21  | async function enterBattle(page: Page, name: string): Promise<void> {
  22  |   await bootToGuestHome(page)
  23  |   await createCharacterThroughUi(page, name)
  24  |   await enterHome(page)
  25  | 
  26  |   await page.keyboard.press('Tab')
  27  | 
  28  |   const teleportSlot = page.locator('[data-wheel-slot="teleport_array"]')
> 29  |   await expect(teleportSlot).toBeVisible({ timeout: 10_000 })
      |                              ^ Error: expect(locator).toBeVisible() failed
  30  |   await teleportSlot.click()
  31  | 
  32  |   const overlay = page.getByTestId('function-overlay-panel')
  33  |   await expect(overlay).toBeVisible({ timeout: 10_000 })
  34  | 
  35  |   const startButton = page.getByTestId('stage-start-button')
  36  |   await expect(startButton).toBeEnabled({ timeout: 10_000 })
  37  |   await startButton.click()
  38  | 
  39  |   const combatTopBar = page.locator('.combat-top-bar')
  40  |   await expect(combatTopBar).toBeVisible({ timeout: 15_000 })
  41  | }
  42  | 
  43  | test.describe('Combat overlay layout (T8.3)', () => {
  44  |   for (const viewport of VIEWPORTS) {
  45  |     test(`${viewport.name}: panels anchored, no canvas-HUD overlap`, async ({ page }, testInfo) => {
  46  |       test.setTimeout(120_000)
  47  |       await page.setViewportSize(viewport)
  48  | 
  49  |       await enterBattle(page, `T83 ${viewport.name}`)
  50  | 
  51  |       // Root phu toan viewport (T8.1 regression guard - tung bi xoa styles).
  52  |       const root = page.locator('.combat-scene-overlay')
  53  |       await expect(root).toBeVisible()
  54  |       const rootBox = await root.boundingBox()
  55  |       expect(rootBox).not.toBeNull()
  56  |       expect(rootBox!.width).toBe(viewport.width)
  57  |       expect(rootBox!.height).toBe(viewport.height)
  58  | 
  59  |       // AI panel neo trai-tren, NAM TRONG viewport (khong tran flow).
  60  |       const aiPanel = page.locator('.combat-scene-overlay__ai-panel')
  61  |       await expect(aiPanel).toBeVisible()
  62  |       const aiBox = await aiPanel.boundingBox()
  63  |       expect(aiBox).not.toBeNull()
  64  |       expect(aiBox!.x).toBeGreaterThanOrEqual(0)
  65  |       expect(aiBox!.y).toBeGreaterThanOrEqual(0)
  66  |       expect(aiBox!.x + aiBox!.width).toBeLessThanOrEqual(viewport.width)
  67  |       expect(aiBox!.y + aiBox!.height).toBeLessThanOrEqual(viewport.height)
  68  | 
  69  |       // Combat Art Pipeline Task 7 (2026-09-05) - Build HUD + skill bar roi
  70  |       // slot bottom-center cu (class `combat-scene-overlay__build-hud`, da
  71  |       // XOA) vao CombatSkillDockPanel.vue (`.combat-skill-dock-panel`), dock
  72  |       // neo MEP PHAI. Vung HUD canvas trai-duoi: chi content-co-chua (con
  73  |       // dock thuc - TurnCombatSkillBar) moi can ne, con container tu no da o
  74  |       // ben phai nen khong de trai-duoi - do con dau tien thay vi container.
  75  |       //
  76  |       // Layout fix (2026-09-06) - dock KHONG con full-height (top:0) nhu
  77  |       // comment cu mo ta: de len enemy counter mep phai cua TopBar la bug
  78  |       // da duoc review phat hien. Nay `top: var(--combat-topbar-h)` - dock
  79  |       // bat dau ngay duoi TopBar. Assert them: dock khong con bat dau o
  80  |       // y=0 ma bat dau tu (hoac sau) mep duoi TopBar that.
  81  |       const combatTopBar = page.locator('.combat-top-bar')
  82  |       const topBarBox = await combatTopBar.boundingBox()
  83  |       expect(topBarBox).not.toBeNull()
  84  | 
  85  |       const skillDock = page.locator('.combat-skill-dock-panel')
  86  |       await expect(skillDock).toBeVisible()
  87  |       const hudBox = await skillDock.boundingBox()
  88  |       expect(hudBox).not.toBeNull()
  89  |       expect(hudBox!.y + hudBox!.height).toBeLessThanOrEqual(viewport.height)
  90  |       expect(hudBox!.y).toBeGreaterThanOrEqual(topBarBox!.y + topBarBox!.height)
  91  | 
  92  |       const contentBox = await skillDock.locator('*').first().boundingBox()
  93  |       expect(contentBox).not.toBeNull()
  94  |       // Spec 13 player-hud zone is canvas-left TOP (16/72 of 1672x941) -
  95  |       // the dock is right-edge so the guard still only needs the left
  96  |       // strip + spec band height.
  97  |       const canvasHudZoneRight = 350
  98  |       const canvasHudZoneBottom = viewport.height * (202 / 941)
  99  |       const overlapsCanvasHud =
  100 |         contentBox!.x < canvasHudZoneRight &&
  101 |         contentBox!.x + contentBox!.width > 0 &&
  102 |         contentBox!.y < canvasHudZoneBottom
  103 |       expect(overlapsCanvasHud, 'Skill dock content must not overlap canvas HUD zone (top-left)').toBe(false)
  104 | 
  105 |       await page.screenshot({
  106 |         path: testInfo.outputPath(`overlay-${viewport.name}.png`),
  107 |         animations: 'disabled',
  108 |       })
  109 |     })
  110 |   }
  111 | })
  112 | 
```