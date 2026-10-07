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

Locator: getByTestId('auth-screen')
Expected: visible
Timeout: 15000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByTestId('auth-screen') with timeout 15000ms
  - waiting for getByTestId('auth-screen')

```

```yaml
- img
- text: "[plugin:vite:import-analysis] Failed to resolve import \"@/assets/pc-paper-auxiliary-production.css\" from \"src/components/layout/FunctionOverlayPanel.vue\". Does the file exist? E:/tutienidle/.agent-worktrees/hoa-cau-fireball-vfx/game/src/components/layout/FunctionOverlayPanel.vue:2:7 15 | /* Injection by vite-plugin-vue-inspector End */ 16 | import { defineComponent as _defineComponent } from \"vue\"; 17 | import \"@/assets/pc-paper-auxiliary-production.css\"; | ^ 18 | import { computed, ref, watch } from \"vue\"; 19 | import { useI18n } from \"vue-i18n\"; at TransformPluginContext._formatLog (file:///E:/tutienidle/.agent-worktrees/hoa-cau-fireball-vfx/game/node_modules/vite/dist/node/chunks/node.js:31147:39) at TransformPluginContext.error (file:///E:/tutienidle/.agent-worktrees/hoa-cau-fireball-vfx/game/node_modules/vite/dist/node/chunks/node.js:31144:14) at normalizeUrl (file:///E:/tutienidle/.agent-worktrees/hoa-cau-fireball-vfx/game/node_modules/vite/dist/node/chunks/node.js:28083:18) at async file:///E:/tutienidle/.agent-worktrees/hoa-cau-fireball-vfx/game/node_modules/vite/dist/node/chunks/node.js:28153:30 at async Promise.all (index 2) at async TransformPluginContext.transform (file:///E:/tutienidle/.agent-worktrees/hoa-cau-fireball-vfx/game/node_modules/vite/dist/node/chunks/node.js:28119:4) at async file:///E:/tutienidle/.agent-worktrees/hoa-cau-fireball-vfx/game/node_modules/vite-plugin-inspect/dist/shared/vite-plugin-inspect.Fv_Ybe1U.mjs:403:17 at async EnvironmentPluginContainer.transform (file:///E:/tutienidle/.agent-worktrees/hoa-cau-fireball-vfx/game/node_modules/vite/dist/node/chunks/node.js:30932:14) at async loadAndTransform (file:///E:/tutienidle/.agent-worktrees/hoa-cau-fireball-vfx/game/node_modules/vite/dist/node/chunks/node.js:20671:26) at async viteTransformMiddleware (file:///E:/tutienidle/.agent-worktrees/hoa-cau-fireball-vfx/game/node_modules/vite/dist/node/chunks/node.js:25205:20) Click outside, press Esc key, or fix the code to dismiss. You can also disable this overlay by setting"
- code: server.hmr.overlay
- text: to
- code: "false"
- text: in
- code: vite.config.ts
- text: .
```

# Test source

```ts
  1   | import type { Page } from '@playwright/test'
  2   | import { expect } from '@playwright/test'
  3   | 
  4   | // Spec F8 - guest sessions bind the shared ':guest' save slot; page.evaluate
  5   | // bodies below carry this as a string literal because Playwright cannot
  6   | // serialize module-scope values into the browser context.
  7   | export const GUEST_SAVE_KEY = 'tien-hiep-idle-save:guest'
  8   | 
  9   | /**
  10  |  * Boot the app fresh: goto '/', wait out the intro loading screen (~3s in
  11  |  * App.vue), then click "Choi ngay" (guest auth).
  12  |  *
  13  |  * NOTE: intentionally NO localStorage-clearing init script - Playwright
  14  |  * gives each test a fresh context (empty localStorage already), and an
  15  |  * init script would also run on page.reload(), wiping the save the
  16  |  * save-reload spec needs to restore.
  17  |  *
  18  |  * Leaves the page on the character-creation screen.
  19  |  */
  20  | export async function bootToGuestHome(page: Page): Promise<void> {
  21  |   await page.goto('/')
  22  | 
  23  |   const auth = page.getByTestId('auth-screen')
> 24  |   await expect(auth).toBeVisible({ timeout: 15_000 })
      |                      ^ Error: expect(locator).toBeVisible() failed
  25  |   await page.getByTestId('auth-begin-button').click()
  26  | 
  27  |   // "Choi ngay" (guest) skips credentials; MockAuthService resolves after 250ms.
  28  |   await page.getByTestId('auth-guest-button').click()
  29  | }
  30  | 
  31  | /**
  32  |  * Creates a character through the ONE unified screen (BETA-CREATION):
  33  |  * name + 1 talent pick -> finish. The attribute allocation step and the
  34  |  * mortal starter-skill pick no longer exist - base stats default to
  35  |  * 1/1/1/1/1 and tram remains the default basic.
  36  |  *
  37  |  * Prerequisite: guest auth done (bootToGuestHome).
  38  |  */
  39  | export async function createCharacterThroughUi(page: Page, name: string): Promise<void> {
  40  |   const creation = page.getByTestId('character-creation-screen')
  41  |   await expect(creation).toBeVisible({ timeout: 15_000 })
  42  | 
  43  |   // Name - validation runs on input; the finish gate needs a valid name.
  44  |   await page.getByTestId('creation-name-input').fill(name)
  45  | 
  46  |   // Talent - pick the first available card (exactly one required).
  47  |   const talentCards = creation.locator('[data-testid^="creation-talent-"]')
  48  |   await expect(talentCards.first()).toBeVisible({ timeout: 10_000 })
  49  |   await talentCards.first().click()
  50  | 
  51  |   // Finish - enabled once name + talent are both satisfied.
  52  |   await expect(page.getByTestId('creation-finish')).toBeEnabled({ timeout: 5_000 })
  53  |   await page.getByTestId('creation-finish').click()
  54  | }
  55  | 
  56  | /**
  57  |  * Blocks until no presentation transition is in flight: the curtain is open,
  58  |  * gameplay input is unlocked and the route has committed.
  59  |  */
  60  | export async function waitForPresentationIdle(page: Page, timeout = 30_000): Promise<void> {
  61  |   const overlay = page.getByTestId('presentation-overlay')
  62  | 
  63  |   await expect(overlay).toHaveAttribute('data-phase', 'idle', { timeout })
  64  |   await expect(overlay).toHaveAttribute('data-curtain', 'opened', { timeout })
  65  | }
  66  | 
  67  | /**
  68  |  * Wait for the game home (Dong Phu) to be visible after character creation.
  69  |  * The home appears when entryStage === 'game' and isBooted === true.
  70  |  * Dismisses the tutorial overlay if it appears.
  71  |  */
  72  | export async function enterHome(page: Page): Promise<void> {
  73  |   await expect(page.locator('.game-root')).toBeVisible({ timeout: 30_000 })
  74  | 
  75  |   // The Home DOM mounts BEHIND the closed curtain, and the curtain locks
  76  |   // pointer/keyboard input until the transition is revealed and released.
  77  |   // Interacting before that is a race, so wait for the coordinator to settle.
  78  |   await waitForPresentationIdle(page)
  79  | 
  80  |   // Tutorial overlay (z-index 1900) blocks all pointer events. Dismiss it.
  81  |   const tutorial = page.locator('.tutorial-overlay')
  82  |   if (await tutorial.isVisible({ timeout: 5_000 }).catch(() => false)) {
  83  |     await page.getByRole('button', { name: 'Bỏ Qua' }).click()
  84  |     await expect(tutorial).not.toBeVisible({ timeout: 5_000 })
  85  |   }
  86  | 
  87  |   // Offline summary modal (only shows when >60s offline) would also block.
  88  |   const offlineModal = page.locator('.offline-summary')
  89  |   if (await offlineModal.isVisible({ timeout: 3_000 }).catch(() => false)) {
  90  |     await offlineModal.getByRole('button', { name: 'Tiếp Tục' }).click()
  91  |     await expect(offlineModal).not.toBeVisible({ timeout: 5_000 })
  92  |   }
  93  | }
  94  | 
  95  | /**
  96  |  * After a reload the app goes intro -> auth again (entryStage 'intro').
  97  |  * Authenticate as guest again; bootGame(false) restores the saved character
  98  |  * (it does NOT create a new one when a valid save exists).
  99  |  */
  100 | export async function reauthAndEnterHome(page: Page): Promise<void> {
  101 |   const auth = page.getByTestId('auth-screen')
  102 |   await expect(auth).toBeVisible({ timeout: 15_000 })
  103 |   await page.getByTestId('auth-begin-button').click()
  104 |   await page.getByTestId('auth-guest-button').click()
  105 | 
  106 |   await enterHome(page)
  107 | }
  108 | 
  109 | /**
  110 |  * Open the Cai Dat panel and click the manual save button.
  111 |  */
  112 | export async function openSettingsAndSave(page: Page): Promise<void> {
  113 |   // The player figure explicitly opens the wheel.
  114 |   await page.locator('.df-cultivator').click()
  115 |   const settingsSlot = page.locator('[data-wheel-slot="settings"]')
  116 |   await expect(settingsSlot).toBeVisible({ timeout: 10_000 })
  117 |   await settingsSlot.click()
  118 | 
  119 |   // Settings overlay opens -> click "Luu Tien Trinh".
  120 |   const saveButton = page.getByTestId('settings-save-button')
  121 |   await expect(saveButton).toBeVisible({ timeout: 10_000 })
  122 |   await saveButton.click()
  123 | }
  124 | 
```