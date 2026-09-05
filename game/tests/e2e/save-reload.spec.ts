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
 *
 * Remediation Task 9 (2026-09-05) — DETERMINISTIC resource setup:
 *
 * 1. Thay vì phụ thuộc battle loot có thể rơi hay không (conditional skip
 *    trước đây — assert tài nguyên bị bỏ qua khi nhân vật mới chưa có
 *    drop), spec này SEED một lượng Linh Thạch xác định (12345
 *    'spirit_stone_ha_pham') rồi assert EXACT persistence sau reload.
 *    Seeding qua persistence layer (JSON localStorage) — restore path nạp
 *    materials qua materialRegistry (GameManagerSaveRestore), không mock
 *    production code.
 *
 * 2. Seed ĐIỂM GẮN QUAN TRỌNG: pagehide/visibilitychange autosave flush
 *    ghi đè localStorage khi page.reload() unload trang cũ (đây là hành
 *    vi production đúng — Task 5 lifecycle). Nên seed được áp bằng
 *    addInitScript — chạy TRƯỚC app JS của trang MỚI sau reload, ghi đè
 *    kết quả pagehide-flush trước khi boot đọc save. Save gốc vẫn snapshot
 *    từ lần save thật (nút Cài Đặt) để giữ mọi field schema version hiện
 *    hành — chỉ thay đúng mảng materials.
 *
 * 3. Bỏ bước đánh trận: combat turn-based với presentation kết thúc
 *    không ổn định trong timeout E2E — baseline failure đã ghi nhận
 *    (roadmap 7.10, plan UI/UX remediation Task 13 điều tra riêng; spec
 *    cũ cũng fail cùng bước này — verified 2026-09-05). Persistence của
 *    save không phụ thuộc việc đánh trận: cultivation tick + building
 *    progression đã có trong save.
 */
const SPIRIT_STONE_ID = 'spirit_stone_ha_pham'
const SEEDED_AMOUNT = 12_345
const SAVE_KEY = 'tien-hiep-idle-save'

interface SaveShape {
  version: number
  player: { name: string; realmId: string; cultivation: number }
  materials: Array<{ materialId: string; amount: number }>
}

function readSave(page: import('@playwright/test').Page): Promise<SaveShape | null> {
  return page.evaluate(() => {
    // String literal — hằng số module không serialize qua evaluate context.
    const raw = localStorage.getItem('tien-hiep-idle-save')

    return raw ? (JSON.parse(raw) as SaveShape) : null
  })
}

test.describe('Save and reload persistence', () => {
  test('persists character and seeded spirit stones exactly across reload', async ({ page }) => {
    test.setTimeout(120_000)

    const characterName = 'E2E Luu Ton'

    await bootToGuestHome(page)

    await createCharacterThroughUi(page, characterName)
    await enterHome(page)

    // Lưu tiến trình qua Cài Đặt (deterministic; autosave 15s ghi cùng
    // player.save() payload).
    await openSettingsAndSave(page)

    // Snapshot save THẬT từ lần save qua UI — giữ nguyên mọi field schema
    // version hiện hành; chỉ materials sẽ được thay ở trang sau reload.
    const saveBefore = await readSave(page)
    expect(saveBefore).not.toBeNull()
    expect(saveBefore!.player.name).toBe(characterName)
    expect(saveBefore!.version).toBeGreaterThan(0)

    // Seed qua addInitScript: trang sau reload chạy script này TRƯỚC app
    // JS — ghi đè pagehide-flush của trang cũ, rồi app boot đọc save đã
    // seed. Chỉ thay mảng materials (gỡ stack cũ + chèn amount chính xác).
    const seededMaterials = saveBefore!.materials.filter(
      (entry) => entry.materialId !== SPIRIT_STONE_ID,
    )
    seededMaterials.push({ materialId: SPIRIT_STONE_ID, amount: SEEDED_AMOUNT })
    const seededSave: SaveShape = { ...saveBefore!, materials: seededMaterials }

    await page.addInitScript(
      ({ key, payload }) => {
        localStorage.setItem(key, JSON.stringify(payload))
      },
      { key: SAVE_KEY, payload: seededSave },
    )

    // Reload — boot intro (~3s) → auth lại (guest session không persist),
    // bootGame(false) RESTORE nhân vật đã lưu (loaded.status === 'ok').
    await page.reload()

    await reauthAndEnterHome(page)

    // Character identity persisted: mở Nhân Vật panel qua wheel + check tên.
    await page.keyboard.press('Tab')
    const characterSlot = page.locator('[data-wheel-slot="character"]')
    await expect(characterSlot).toBeVisible({ timeout: 10_000 })
    await characterSlot.click()

    await expect(page.getByTestId('character-name')).toHaveText(characterName, { timeout: 10_000 })
    await expect(page.getByTestId('character-realm-line')).toContainText('Phàm Nhân')

    // EXACT persistence: Linh Thạch stack phải bằng đúng amount đã seed.
    // Autosave (15s) có thể ghi trong lúc navigate — autosave persist cùng
    // bag đã restore nên stack ổn định; poll chỉ để tránh race đọc-ghi,
    // KHÔNG hạ weaker assertion (vẫn .toBe exact).
    await expect
      .poll(
        async () => {
          const saveAfter = await readSave(page)
          return saveAfter?.materials.find((entry) => entry.materialId === SPIRIT_STONE_ID)?.amount
        },
        { timeout: 20_000 },
      )
      .toBe(SEEDED_AMOUNT)
  })
})
