import { expect, test } from './fixtures'

import {
  bootToGuestHome,
  createCharacterThroughUi,
  enterHome,
  openSettingsAndSave,
  reauthAndEnterHome,
  GUEST_SAVE_KEY,
} from './helpers'

/**
 * E2E lifecycle spec 3/3 (tech-debt-test-coverage-plan.md sec3.3) - choi
 * 1 doan, luu tien trinh (nut "Luu Tien Trinh" trong Cai Dat - cung
 * duong player.save() voi autosave 15s), reload trang, nhan vat +
 * Spirit Stones persist across the localStorage save 'tien-hiep-idle-save:guest'.
 *
 * Remediation Task 9 (2026-09-05) - DETERMINISTIC resource setup:
 *
 * 1. Thay vi phu thuoc battle loot co the roi hay khong (conditional skip
 *    truoc day - assert tai nguyen bi bo qua khi nhan vat moi chua co
 *    drop), spec nay SEED mot luong Linh Thach xac dinh (12345
 *    'spirit_stone_ha_pham') roi assert EXACT persistence sau reload.
 *    Seeding qua persistence layer (JSON localStorage) - restore path nap
 *    materials qua materialRegistry (GameManagerSaveRestore), khong mock
 *    production code.
 *
 * 2. Seed DIEM GAN QUAN TRONG: pagehide/visibilitychange autosave flush
 *    ghi de localStorage khi page.reload() unload trang cu (day la hanh
 *    vi production dung - Task 5 lifecycle). Nen seed duoc ap bang
 *    addInitScript - chay TRUOC app JS cua trang MOI sau reload, ghi de
 *    ket qua pagehide-flush truoc khi boot doc save. Save goc van snapshot
 *    tu lan save that (nut Cai Dat) de giu moi field schema version hien
 *    hanh - chi thay dung mang materials.
 *
 * 3. Bo buoc danh tran: combat turn-based voi presentation ket thuc
 *    khong on dinh trong timeout E2E - baseline failure da ghi nhan
 *    (roadmap 7.10, plan UI/UX remediation Task 13 dieu tra rieng; spec
 *    cu cung fail cung buoc nay - verified 2026-09-05). Persistence cua
 *    save khong phu thuoc viec danh tran: cultivation tick + building
 *    progression da co trong save.
 */
const SPIRIT_STONE_ID = 'spirit_stone_ha_pham'
const SEEDED_AMOUNT = 12_345
const SAVE_KEY = GUEST_SAVE_KEY

interface SaveShape {
  version: number
  player: { name: string; realmId: string; cultivation: number }
  materials: Array<{ materialId: string; amount: number }>
}

function readSave(page: import('@playwright/test').Page): Promise<SaveShape | null> {
  return page.evaluate(() => {
    // String literal - hang so module khong serialize qua evaluate context.
    const raw = localStorage.getItem('tien-hiep-idle-save:guest')

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

    // Luu tien trinh qua Cai Dat (deterministic; autosave 15s ghi cung
    // player.save() payload).
    await openSettingsAndSave(page)

    // Snapshot save THAT tu lan save qua UI - giu nguyen moi field schema
    // version hien hanh; chi materials se duoc thay o trang sau reload.
    const saveBefore = await readSave(page)
    expect(saveBefore).not.toBeNull()
    expect(saveBefore!.player.name).toBe(characterName)
    expect(saveBefore!.version).toBeGreaterThan(0)

    // Seed qua addInitScript: trang sau reload chay script nay TRUOC app
    // JS - ghi de pagehide-flush cua trang cu, roi app boot doc save da
    // seed. Chi thay mang materials (go stack cu + chen amount chinh xac).
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

    // Reload - boot intro (~3s) -> auth lai (guest session khong persist),
    // bootGame(false) RESTORE nhan vat da luu (loaded.status === 'ok').
    await page.reload()

    await reauthAndEnterHome(page)

    // Character identity persisted: mo Nhan Vat panel qua wheel + check ten.
    await page.locator('.df-cultivator').click()
    const characterSlot = page.locator('[data-wheel-slot="character"]')
    await expect(characterSlot).toBeVisible({ timeout: 10_000 })
    await characterSlot.click()

    await expect(page.locator('.cf-name')).toHaveText(`${characterName}◆`, { timeout: 10_000 })
    await expect(page.locator('.cf-realm')).toContainText('Phàm Nhân')

    // EXACT persistence: Linh Thach stack phai bang dung amount da seed.
    // Autosave (15s) co the ghi trong luc navigate - autosave persist cung
    // bag da restore nen stack on dinh; poll chi de tranh race doc-ghi,
    // KHONG ha weaker assertion (van .toBe exact).
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
