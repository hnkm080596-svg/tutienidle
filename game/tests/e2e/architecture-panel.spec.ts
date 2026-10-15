import { expect, test } from './fixtures'
import { bootToGuestHome, createCharacterThroughUi, enterHome } from './helpers'

test('Architecture owns upgrades and expedition replay consumes live progress', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await bootToGuestHome(page)
  await createCharacterThroughUi(page, 'Architecture QA')
  await enterHome(page)
  if (await page.locator('.home-navigation-toggle').isVisible()) await page.locator('.home-navigation-toggle').click()
  await page.getByRole('button', { name: 'Kiến Trúc', exact: true }).click()
  await expect(page.getByTestId('architecture-building-card')).toHaveCount(6)
  await expect(page.locator('.overlay-panel')).toHaveCount(0)
  await expect(page.locator('[data-building-id="vendor"]')).toHaveCount(0)
  await expect(page.locator('[data-building-id="chi_hien_quan"]')).toHaveCount(0)
  await expect(page.locator('[data-building-id="gathering_outpost"]')).toHaveCount(0)
  const room = page.locator('[data-building-id="pill_room"]')
  await room.locator('.architecture-card__actions button').click()
  await expect(room).toContainText('Cấp 1/9')
  await expect(page.locator('.architecture-notice[role="status"]')).toBeVisible()
  await page.screenshot({ path: 'test-results/architecture-panel-live.png' })
  await page.keyboard.press('Escape')
  const armed = await page.evaluate(async () => {
    const url = '/src/stores/player.ts'
    const { usePlayerStore } = await import(/* @vite-ignore */ url)
    const player = usePlayerStore()
    const runtime = (window as unknown as { __tutienPhaserGame: { registry: { get(key: string): unknown } } }).__tutienPhaserGame
    const manager = runtime.registry.get('gameManager') as { catalogOps: { getStage(id: string): { id: string } | undefined }; turnBattleOps: { autoFarmOps: { startAutoFarm(player: unknown, stageId: string): boolean } } }
    const stageUrl = '/src/data/stage/stages.ts'
    const { STAGES } = await import(/* @vite-ignore */ stageUrl)
    const stage = manager.catalogOps.getStage(STAGES[0].id)
    if (!stage) throw new Error('No authored stage')
    player.perfectClearStageIds.push(stage.id)
    player.perfectClearSeconds[stage.id] = 5
    return manager.turnBattleOps.autoFarmOps.startAutoFarm(player.$state, stage.id)
  })
  expect(armed).toBe(true)
  const replay = page.getByTestId('expedition-battle-stage')
  await expect(replay).toBeVisible()
  const progress = replay.getByRole('progressbar')
  const initial = await progress.getAttribute('aria-valuenow')
  await expect.poll(() => progress.getAttribute('aria-valuenow')).not.toBe(initial)
  await expect(replay.locator('.actor')).toHaveCount(2)
  await page.screenshot({ path: 'test-results/expedition-battle-live.png' })
  if (await page.locator('.home-navigation-toggle').isVisible()) await page.locator('.home-navigation-toggle').click()
  await page.getByRole('button', { name: 'Kiến Trúc', exact: true }).click()
  await expect(replay).toBeHidden()
  await page.keyboard.press('Escape')
  await expect(replay).toBeVisible()
  await replay.getByTestId('autofarm-stop').click()
  await expect(replay).toHaveCount(0)
  expect(errors).toEqual([])
})

test('Pill Room merges active batches and refunds unfinished units', async ({ page }) => {
  await bootToGuestHome(page)
  await createCharacterThroughUi(page, 'Kiln QA')
  await enterHome(page)
  const seeded = await page.evaluate(async () => {
    const playerUrl = '/src/stores/player.ts'
    const betaUrl = '/src/core/betaScope.ts'
    const { usePlayerStore } = await import(/* @vite-ignore */ playerUrl)
    const { betaRecipeFamilyOfId } = await import(/* @vite-ignore */ betaUrl)
    const player = usePlayerStore()
    type Recipe = { id: string; realmId: string; herbAmount: number; herbVariants: { materialId: string; age: string }[]; fuelWoodRealmId: string; specialIngredients?: { materialId: string; amount: number }[] }
    const runtime = (window as unknown as { __tutienPhaserGame: { registry: { get(key: string): unknown } } }).__tutienPhaserGame
    const manager = runtime.registry.get('gameManager') as {
      alchemyOps: { getAlchemyRecipes(): Recipe[]; startAlchemyJob(id: string, herb: string, player: unknown): { ok: boolean }; getAlchemyQueueState(): { waitingJobs: unknown[]; activeJob: unknown; maxQueueSlots: number } };
      materialRegistry: { get(id: string): unknown };
      materialBag: { add(material: unknown, amount: number): number; getAmount(id: string): number };
    }
    const recipe = manager.alchemyOps.getAlchemyRecipes().find(item => item.realmId === player.realmId && betaRecipeFamilyOfId(item.id) !== null)
    if (!recipe) throw new Error('No playable alchemy recipe')
    const herb = recipe.herbVariants[0]!
    const ids = [herb.materialId, 'material_spirit_stone', 'bui_go', 'luyen_dan_tinh_hoa', ...(recipe.specialIngredients ?? []).map(item => item.materialId)]
    for (const id of ids) manager.materialBag.add(manager.materialRegistry.get(id), 1000)
    const jobs = Array.from({ length: 4 }, () => manager.alchemyOps.startAlchemyJob(recipe.id, herb.materialId, player.$state).ok)
    const beforeRejected = manager.materialBag.getAmount(herb.materialId)
    const rejected = manager.alchemyOps.startAlchemyJob(recipe.id, herb.materialId, player.$state).ok
    const afterRejected = manager.materialBag.getAmount(herb.materialId)
    return { jobs, rejected, beforeRejected, afterRejected, herbId: herb.materialId, herbAmount: recipe.herbAmount }
  })
  expect(seeded.jobs).toEqual([true, true, true, true])
  expect(seeded.rejected).toBe(true)
  expect(seeded.afterRejected).toBe(seeded.beforeRejected - seeded.herbAmount)
  if (await page.locator('.home-navigation-toggle').isVisible()) await page.locator('.home-navigation-toggle').click()
  await page.getByRole('button', { name: 'Luyện Đan', exact: true }).click()
  const queue = page.locator('.alchemy-jobs')
  await expect(queue.locator('.job-card:has(.job-card__cancel)')).toHaveCount(1)
  await page.screenshot({ path: 'test-results/alchemy-serial-queue-live.png' })
  await queue.locator('.job-card__cancel').first().click()
  await expect(queue.locator('.job-card:has(.job-card__cancel)')).toHaveCount(0)
  const amountAfterRefund = await page.evaluate(id => {
    const runtime = (window as unknown as { __tutienPhaserGame: { registry: { get(key: string): unknown } } }).__tutienPhaserGame
    const manager = runtime.registry.get('gameManager') as { materialBag: { getAmount(id: string): number } }
    return manager.materialBag.getAmount(id)
  }, seeded.herbId)
  expect(amountAfterRefund).toBe(seeded.afterRejected + 5 * seeded.herbAmount)
})


