import { expect, test, type Page } from '@playwright/test'

// Update (2026-08-24) — boot giờ đi qua AuthEntryScreen + màn tạo nhân
// vật (tính năng online-auth). Helper này vào game bằng chế độ KHÁCH và
// hoàn tất 3 bước Khai Mệnh nhanh, rồi trả về đúng trạng thái "Động Phủ
// + tutorial đang mở" mà 2 test bên dưới kỳ vọng.
async function enterGameAsGuest(page: Page) {
  await page.goto('/')

  // Intro 3s → AuthEntryScreen. Chế độ khách không cần ID/mật khẩu.
  await page.getByRole('button', { name: /Chơi ngay/ }).click()

  // Bước 1 — đạo danh duy nhất theo lần chạy (mock auth luôn trống tên).
  await page.getByPlaceholder('Nhập đạo danh…').fill(`e2e-dao-hanh-${Date.now().toString(36)}`)
  await page.getByRole('button', { name: 'Tiếp tục' }).click()

  // Bước 2 — chọn đúng 3/9 thiên phú của lượt roll.
  const talentCards = page.locator('.talent-card')
  await expect(talentCards).toHaveCount(9)
  for (let index = 0; index < 3; index++) {
    await talentCards.nth(index).click()
  }
  await page.getByRole('button', { name: 'Xác nhận thiên phú' }).click()

  // Bước 3 — phân bổ đủ 5 điểm (cùng 1 chỉ số cho nhanh), lập mệnh.
  const plusButton = page.locator('.counter button').last()
  for (let index = 0; index < 5; index++) {
    await plusButton.click()
  }
  await page.getByRole('button', { name: 'Bước vào tiên đồ' }).click()

  // Game boot xong → tutorial hiện "Bỏ Qua".
  await page.getByRole('button', { name: 'Bỏ Qua' }).click()
}

test('combat renders reward feedback without browser errors', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))

  await enterGameAsGuest(page)
  await page.getByRole('button', { name: 'Menu' }).click()
  await page.getByText('Thám Hiểm', { exact: true }).click()
  await page.getByRole('button', { name: '1.1', exact: true }).click()
  await page.getByText('Lặp Lại', { exact: true }).click()
  await page.getByRole('button', { name: 'Bắt Đầu' }).click()

  await expect(page.locator('canvas')).toBeVisible()
  await expect(page.getByText('NHẬN ĐƯỢC').first()).toBeVisible({ timeout: 30_000 })
  await page.waitForTimeout(240)
  await page.screenshot({ path: test.info().outputPath('reward-particle.png') })

  expect(pageErrors).toEqual([])
})

test('can exit during countdown and start another stage battle', async ({ page }) => {
  const lifecycleErrors: string[] = []
  page.on('console', (message) => {
    if (
      message.type() === 'error' &&
      /Texture key already in use|AnimationManager key already exists/.test(message.text())
    ) {
      lifecycleErrors.push(message.text())
    }
  })

  await enterGameAsGuest(page)
  await page.getByRole('button', { name: 'Menu' }).click()
  await page.getByText('Thám Hiểm', { exact: true }).click()
  await page.getByRole('button', { name: '1.1', exact: true }).click()
  await page.getByRole('button', { name: 'Bắt Đầu' }).click()

  await expect(page.locator('.combat-countdown-overlay')).toBeVisible()
  await page.locator('.combat-control-bar__exit').click()
  await page.locator('.combat-control-bar__confirm-ok').click()
  await expect(page.getByRole('button', { name: 'Menu' })).toBeVisible()

  await page.getByRole('button', { name: 'Menu' }).click()
  await page.getByText('Thám Hiểm', { exact: true }).click()
  await page.getByRole('button', { name: '1.1', exact: true }).click()
  await page.getByRole('button', { name: 'Bắt Đầu' }).click()
  await expect(page.locator('.combat-countdown-overlay')).toBeVisible()
  expect(lifecycleErrors).toEqual([])
})

// Migration gate 2.5D — renderer flat (legacy) phải còn chạy sạch sau
// feature flag, kể cả ở viewport LỆCH 16:9 (1280×800) nơi insets DOM
// đo thật khác công thức tỷ lệ.
test('legacy flat renderer still boots and fights via feature flag', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('tutienidle.battlefieldRenderMode', 'flat')
  })

  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))

  await page.setViewportSize({ width: 1280, height: 800 })
  await enterGameAsGuest(page)
  await page.getByRole('button', { name: 'Menu' }).click()
  await page.getByText('Thám Hiểm', { exact: true }).click()
  await page.getByRole('button', { name: '1.1', exact: true }).click()
  await page.getByRole('button', { name: 'Bắt Đầu' }).click()

  await expect(page.locator('canvas')).toBeVisible()
  await expect(page.getByText('NHẬN ĐƯỢC').first()).toBeVisible({ timeout: 30_000 })
  await page.screenshot({ path: test.info().outputPath('flat-renderer.png') })

  expect(pageErrors).toEqual([])
})

// Migration gate 2.5D (P3) — perspective phải giữ bố cục "nửa trên phong
// cảnh, nửa dưới con đường" ở NHIỀU viewport và sống sót resize GIỮA TRẬN
// (projection dựng lại, không lỗi runtime). Bố cục assert bằng GEOMETRY
// snapshot từ registry (horizon ratio + min road height), screenshot chỉ
// là artifact cho QA so mắt.
interface BattlefieldGeometry {
  viewportWidth: number
  viewportHeight: number
  topInset: number
  bottomInset: number
  horizonY: number
  roadBottomY: number
}

function readBattlefieldGeometry(page: Page): Promise<BattlefieldGeometry | null> {
  return page.evaluate(() => {
    const host = window as unknown as {
      __tutienPhaserGame?: { registry: { get: (key: string) => unknown } }
    }

    return (host.__tutienPhaserGame?.registry.get('battlefieldGeometry') ??
      null) as BattlefieldGeometry | null
  })
}

test.describe('perspective layout across viewports', () => {
  for (const viewport of [
    { width: 1600, height: 900 },
    { width: 1280, height: 720 },
  ]) {
    test(`boots, fights and survives mid-battle resize at ${viewport.width}×${viewport.height}`, async ({
      page,
    }) => {
      const pageErrors: string[] = []
      page.on('pageerror', (error) => pageErrors.push(error.message))

      await page.setViewportSize(viewport)
      await enterGameAsGuest(page)
      await page.getByRole('button', { name: 'Menu' }).click()
      await page.getByText('Thám Hiểm', { exact: true }).click()
      await page.getByRole('button', { name: '1.1', exact: true }).click()
      await page.getByRole('button', { name: 'Bắt Đầu' }).click()

      await expect(page.locator('canvas')).toBeVisible()
      await expect(page.locator('.combat-countdown-overlay')).toBeVisible()

      // Geometric regression — đọc snapshot layout CombatScene expose qua
      // registry (PhaserCanvas expose game trên window).
      const geometry = await readBattlefieldGeometry(page)

      expect(geometry).not.toBeNull()
      expect(geometry!.viewportHeight).toBe(viewport.height)

      const available = geometry!.viewportHeight - geometry!.topInset - geometry!.bottomInset
      const expectedHorizon =
        geometry!.topInset + Math.min(available * 0.5, Math.max(0, available - 320))

      // Horizon đúng bố cục scenery/road (clamp adaptive nếu màn thấp).
      expect(Math.abs(geometry!.horizonY - expectedHorizon)).toBeLessThanOrEqual(1.5)

      // Road không bao giờ mỏng hơn ngưỡng tối thiểu.
      expect(geometry!.roadBottomY - geometry!.horizonY).toBeGreaterThanOrEqual(320 - 1.5)

      await page.screenshot({
        path: test.info().outputPath(`perspective-${viewport.width}x${viewport.height}.png`),
      })

      // Resize GIỮA TRẬN — projection phải dựng lại ngay, không lỗi.
      await page.setViewportSize({ width: viewport.height, height: viewport.width })
      await page.waitForTimeout(400)
      await expect(page.locator('canvas')).toBeVisible()

      const geometryAfterResize = await readBattlefieldGeometry(page)

      expect(geometryAfterResize).not.toBeNull()
      expect(geometryAfterResize!.viewportHeight).toBe(viewport.width)
      expect(
        geometryAfterResize!.roadBottomY - geometryAfterResize!.horizonY,
      ).toBeGreaterThanOrEqual(320 - 1.5)

      await page.screenshot({
        path: test
          .info()
          .outputPath(`perspective-${viewport.height}x${viewport.width}-after-resize.png`),
      })

      expect(pageErrors).toEqual([])
    })
  }
})
