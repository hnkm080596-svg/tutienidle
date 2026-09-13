# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tribulation-flow.spec.ts >> Tribulation flow (P13 oracle, F1 regression) >> completed tribulation routes home and restores usable home chrome
- Location: tests\e2e\tribulation-flow.spec.ts:111:3

# Error details

```
Test timeout of 210000ms exceeded.
```

```
Error: locator.click: Test timeout of 210000ms exceeded.
Call log:
  - waiting for locator('.world-announcement')

```

# Page snapshot

```yaml
- generic [ref=f1e1]:
  - generic [ref=f1e2]:
    - generic [ref=f1e4]:
      - generic [ref=f1e5]:
        - generic:
          - generic:
            - generic:
              - generic:
                - button "Xem yêu cầu mở Đan Phòng":
                  - generic [ref=f1e6] [cursor=pointer]
                - generic:
                  - generic: Đan Phòng
                  - generic: Chưa mở
              - generic:
                - button "Mở Khai Vật Đường":
                  - generic [ref=f1e7] [cursor=pointer]
                - generic:
                  - generic: Khai Vật Đường
                  - generic: Cấp 1
              - generic:
                - button "Mở Truyền Tống Trận":
                  - generic [ref=f1e8] [cursor=pointer]
                - generic:
                  - generic: Truyền Tống Trận
                  - generic: Cấp 1
              - generic:
                - button "Xem yêu cầu mở Khí Đường":
                  - generic [ref=f1e9] [cursor=pointer]
                - generic:
                  - generic: Khí Đường
                  - generic: Chưa mở
              - generic:
                - button "Xem yêu cầu mở Ký Bảo Các":
                  - generic [ref=f1e10] [cursor=pointer]
                - generic:
                  - generic: Ký Bảo Các
                  - generic: Chưa mở
              - generic:
                - button "Xem yêu cầu mở Chiêu Hiền Quán":
                  - generic [ref=f1e11] [cursor=pointer]
                - generic:
                  - generic: Chiêu Hiền Quán
                  - generic: Chưa mở
          - button "Mở bảng lệnh Động Phủ" [ref=f1e12] [cursor=pointer]
      - dialog [ref=f1e17]:
        - banner [ref=f1e18]:
          - heading "Quán Khí" [level=3] [ref=f1e20]
        - generic [ref=f1e22]:
          - paragraph [ref=f1e23]: Chọn con đường tu luyện — quyết định này KHÔNG thể đổi lại.
          - generic [ref=f1e24]:
            - button "Bước Vào Pháp Tu — Đại Ngũ Hành Chân Quyết" [active] [ref=f1e25] [cursor=pointer]
            - button "Bước Vào Kiếm Tu — Ngự Kiếm Tâm Kinh" [ref=f1e27] [cursor=pointer]
    - status
  - generic [ref=f1e29]:
    - generic "Toggle devtools panel" [ref=f1e30] [cursor=pointer]
    - generic "Toggle Component Inspector" [ref=f1e36] [cursor=pointer]
```

# Test source

```ts
  132 |       ...saveBefore!,
  133 |       player: {
  134 |         ...saveBefore!.player,
  135 |         realmLevel: BREAKTHROUGH_GATE_LEVEL,
  136 |         cultivation: 0,
  137 |       },
  138 |     }
  139 | 
  140 |     // addInitScript overwrites the pagehide autosave flush before the new
  141 |     // boot reads the save (same ordering contract as save-reload.spec.ts).
  142 |     await page.addInitScript(
  143 |       ({ key, payload }) => {
  144 |         localStorage.setItem(key, JSON.stringify(payload))
  145 |       },
  146 |       { key: SAVE_KEY, payload: seededSave },
  147 |     )
  148 | 
  149 |     await page.reload()
  150 |     await reauthAndEnterHome(page)
  151 | 
  152 |     // Command wheel (Tab) -> Cảnh Giới slot -> RealmPanel -> "Quan Khi".
  153 |     await page.keyboard.press('Tab')
  154 |     const realmSlot = page.locator('[data-wheel-slot="realm"]')
  155 |     await expect(realmSlot).toBeVisible({ timeout: 10_000 })
  156 |     await realmSlot.click()
  157 | 
  158 |     const realmDialog = page.getByRole('dialog', { name: 'Cảnh Giới' })
  159 |     await expect(realmDialog).toBeVisible({ timeout: 15_000 })
  160 | 
  161 |     const breakthroughButton = realmDialog.getByRole('button', { name: 'Quán Khí' })
  162 |     await expect(breakthroughButton).toBeEnabled({ timeout: 10_000 })
  163 |     await breakthroughButton.click()
  164 | 
  165 |     // BreakthroughRequirementPanel ("Độ kiếp cũng là độ thân...") -> confirm
  166 |     // "Đã hiểu" -> triggerBreakthrough() -> runAdmitted('tribulation').
  167 |     const confirmDialog = page.getByRole('dialog', { name: /Độ kiếp cũng là độ thân/ })
  168 |     await expect(confirmDialog).toBeVisible({ timeout: 10_000 })
  169 |     await confirmDialog.getByRole('button', { name: 'Đã hiểu' }).click()
  170 | 
  171 |     // The tribulation route commits before the curtain reopens: the overlay
  172 |     // mounts once activeRoute is 'tribulation' AND the director has state.
  173 |     const tribulationUi = page.locator('.tribulation-ui')
  174 |     await expect(tribulationUi).toBeVisible({ timeout: 30_000 })
  175 | 
  176 |     // Phase 'idle' implies the session hold was released (coordinator step
  177 |     // 8), so director.update() below is no longer blocked.
  178 |     await waitForPresentationIdle(page)
  179 | 
  180 |     // Fast-forward to the outcome. Victory or defeat are both valid ends —
  181 |     // the oracle under test is the route-home wiring, not the survival
  182 |     // math. A fresh mortal at 'human' grade reliably survives the Quan Khi
  183 |     // lightning chapter, so this normally lands 'victory'.
  184 |     await expect
  185 |       .poll(() => advanceTribulation(page), {
  186 |         timeout: 30_000,
  187 |         message: 'TribulationDirector should reach victory/defeat once the session hold releases',
  188 |       })
  189 |       .toMatch(/victory|defeat|cleared/)
  190 | 
  191 |     // F1 oracle: the outcome tick must issue request({ target: 'home' }).
  192 |     // .command-wheel-layer only renders while the committed route is neither
  193 |     // 'combat' nor 'tribulation' (GameRoot.vue isFullSceneActive), so its
  194 |     // re-attachment IS the route-home witness — under F1 it never reappears.
  195 |     const wheelLayer = page.locator('.command-wheel-layer')
  196 |     try {
  197 |       await expect(wheelLayer).toBeAttached({ timeout: 30_000 })
  198 |     } catch (error) {
  199 |       // Diagnostic dump: coordinator phase/curtain, director state, scene
  200 |       // flags — tells a stuck transition apart from a consumed outcome.
  201 |       const diag = await page.evaluate(() => {
  202 |         const overlay = document.querySelector('[data-testid="presentation-overlay"]')
  203 |         const game = (window as Window & {
  204 |           __tutienPhaserGame?: {
  205 |             registry: { get(key: string): unknown }
  206 |             scene: { isActive(key: string): boolean }
  207 |           }
  208 |         }).__tutienPhaserGame
  209 |         const manager = game?.registry.get('gameManager') as GameManagerHandle | undefined
  210 |         return {
  211 |           phase: overlay?.getAttribute('data-phase'),
  212 |           curtain: overlay?.getAttribute('data-curtain'),
  213 |           tribulationState: manager?.tribulationDirector.getState()?.state ?? null,
  214 |           tribulationSceneActive: game?.scene.isActive('TribulationScene') ?? null,
  215 |           mainSceneActive: game?.scene.isActive('MainScene') ?? null,
  216 |           gameRootPresent: Boolean(document.querySelector('.game-root')),
  217 |           announcementVisible: Boolean(document.querySelector('.world-announcement')),
  218 |         }
  219 |       })
  220 |       console.log('DIAG:', JSON.stringify(diag))
  221 |       throw error
  222 |     }
  223 |     await expect(tribulationUi).toHaveCount(0)
  224 |     await waitForPresentationIdle(page)
  225 | 
  226 |     // The outcome's world announcement appears during the closed curtain
  227 |     // and auto-hides ~5s after show() (worldAnnouncement AUTO_CLOSE_MS).
  228 |     // It may already be gone on a slow machine, so click only if present,
  229 |     // then wait out the fade — no assertion on its visibility itself.
  230 |     const announcement = page.locator('.world-announcement')
  231 |     if (await announcement.isVisible()) {
> 232 |       await announcement.click()
      |                          ^ Error: locator.click: Test timeout of 210000ms exceeded.
  233 |     }
  234 |     await expect(announcement).toHaveCount(0, { timeout: 15_000 })
  235 | 
  236 |     // Chrome is usable again, not just mounted. The outcome may have opened
  237 |     // a standalone panel over home (Quan Khi path-choice on victory;
  238 |     // RealmPanel stays open on defeat). OverlayPanel closes on a scrim
  239 |     // click (@click.self) — its Escape hook only fires while focus is
  240 |     // inside the card, and QuanKhiPanel's choice buttons are disabled
  241 |     // during the tribulation cooldown, so a corner click is reliable.
  242 |     const openPanel = page.locator('.overlay-panel')
  243 |     if (await openPanel.isVisible().catch(() => false)) {
  244 |       await openPanel.click({ position: { x: 8, y: 8 } })
  245 |       await expect(openPanel).toHaveCount(0, { timeout: 10_000 })
  246 |     }
  247 | 
  248 |     await page.keyboard.press('Tab')
  249 |     const realmSlotAfter = page.locator('[data-wheel-slot="realm"]')
  250 |     await expect(realmSlotAfter).toBeVisible({ timeout: 10_000 })
  251 |     await realmSlotAfter.click()
  252 | 
  253 |     await expect(page.getByRole('dialog', { name: 'Cảnh Giới' })).toBeVisible({ timeout: 15_000 })
  254 | 
  255 |     assertNoBrowserErrors(collected)
  256 |   })
  257 | })
  258 | 
```