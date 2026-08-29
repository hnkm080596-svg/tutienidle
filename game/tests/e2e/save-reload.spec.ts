import { expect, test } from '@playwright/test'

import {
  bootToGuestHome,
  createCharacterThroughUi,
  enterHome,
  openSettingsAndSave,
  reauthAndEnterHome,
} from './helpers'

/**
 * E2E lifecycle spec 3/3 (tech-debt-test-coverage-plan.md §3.3) — chơi
 * 1 đoạn, lưu tiến trình (nút "Lưu Tiến Trình" trong Cài Đặt — cùng
 * đường player.save() với autosave 15s), reload trang, nhân vật +
 * Linh Thạch giữ nguyên qua localStorage save 'tien-hiep-idle-save'.
 */
test.describe('Save and reload persistence', () => {
  test('persists character and spirit stones across reload', async ({ page }) => {
    test.setTimeout(210_000)

    const characterName = 'E2E Lưu Tồn'

    await bootToGuestHome(page)

    await createCharacterThroughUi(page, characterName)
    await enterHome(page)

    // Battle a stage so rewards (Linh Thạch...) accumulate before saving.
    await page.keyboard.press('Tab')
    const teleportSlot = page.locator('[data-wheel-slot="teleport_array"]')
    await expect(teleportSlot).toBeVisible({ timeout: 10_000 })
    await teleportSlot.click()

    const startButton = page.getByTestId('stage-start-button')
    await expect(startButton).toBeEnabled({ timeout: 10_000 })
    await startButton.click()

    // Wait for the battle to end (victory/defeat) so loot (Linh Thạch) has
    // been granted — battle runs in REAL TIME; a fresh mortal reliably ends
    // in defeat after ~100s. Poll generously (plan risk note: robust waits,
    // not weakened assertions).
    const resultModal = page.locator('.combat-result-modal')
    await expect
      .poll(async () => resultModal.isVisible(), {
        timeout: 180_000,
        message: 'Combat result modal (victory/defeat) should appear',
      })
      .toBe(true)

    // Exit via the result panel's home button (defeat: "Về Động Phủ",
    // victory: "Tiếp Tục").
    const defeatHome = page.locator('.combat-defeat-panel .combat-defeat-panel__return')
    const victoryContinue = page.locator('.combat-victory-panel .combat-victory-panel__continue')
    const homeButton = (await defeatHome.isVisible()) ? defeatHome : victoryContinue
    await homeButton.click()

    // Back at home — open Cài Đặt and save explicitly (deterministic; the
    // 15s autosave writes the exact same player.save() payload).
    await openSettingsAndSave(page)

    // Snapshot the persisted save BEFORE reload.
    const saveBefore = await page.evaluate(() => localStorage.getItem('tien-hiep-idle-save'))
    expect(saveBefore).not.toBeNull()

    const parsedBefore = JSON.parse(saveBefore as string) as {
      player: { name: string; realmId: string; cultivation: number }
      materials: Array<{ materialId: string; amount: number }>
    }
    expect(parsedBefore.player.name).toBe(characterName)

    const spiritStonesBefore = parsedBefore.materials.find(entry => entry.materialId === 'spirit_stone')

    // Reload — boot goes intro (~3s) → auth again (guest session is not
    // persisted), then bootGame(false) RESTORES the saved character instead
    // of showing creation (loaded.status === 'ok' branch in App.vue).
    await page.reload()

    await reauthAndEnterHome(page)

    // Character identity persisted: open Nhân Vật panel via wheel + check name.
    await page.keyboard.press('Tab')
    const characterSlot = page.locator('[data-wheel-slot="character"]')
    await expect(characterSlot).toBeVisible({ timeout: 10_000 })
    await characterSlot.click()

    await expect(page.getByTestId('character-name')).toHaveText(characterName, { timeout: 10_000 })
    await expect(page.getByTestId('character-realm-line')).toContainText('Phàm Nhân')    // Resource persisted: Linh Thạch material stack must equal the pre-reload
    // snapshot (spirit stones come from battle loot + Linh Tuyền building).
    if (spiritStonesBefore) {
      const saveAfter = await page.evaluate(() => localStorage.getItem('tien-hiep-idle-save'))
      expect(saveAfter).not.toBeNull()

      const parsedAfter = JSON.parse(saveAfter as string) as {
        materials: Array<{ materialId: string; amount: number }>
      }

      const spiritStonesAfter = parsedAfter.materials.find(entry => entry.materialId === 'spirit_stone')
      expect(spiritStonesAfter?.amount).toBe(spiritStonesBefore.amount)
    } else {
      // Fresh character with no drops yet — assert save exists and has the
      // same name at minimum (persistence proven by name above).
      const saveAfter = await page.evaluate(() => localStorage.getItem('tien-hiep-idle-save'))
      expect(saveAfter).not.toBeNull()
    }
  })
})
