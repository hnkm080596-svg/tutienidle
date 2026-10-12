import { expect, test } from './fixtures'
import { bootToGuestHome, createCharacterThroughUi, enterHome, openSettingsAndSave, reauthAndEnterHome } from './helpers'

test('world tick and saved epoch ignore forward and backward device-clock edits', async ({ page }) => {
  await bootToGuestHome(page)
  await createCharacterThroughUi(page, 'Time Authority QA')
  await enterHome(page)
  const read = () => page.evaluate(async () => {
    const url = '/src/stores/player.ts'
    const { usePlayerStore } = await import(/* @vite-ignore */ url)
    const player = usePlayerStore()
    const game = (window as unknown as {
      __tutienPhaserGame?: { registry: { get(key: string): unknown } }
    }).__tutienPhaserGame
    const manager = game?.registry.get('gameManager') as { time: { now(): number } } | undefined
    if (!manager) throw new Error('Live game manager missing')
    return { now: manager.time.now(), cultivation: player.cultivation, name: player.name }
  })
  const before = await read()
  await expect.poll(async () => (await read()).cultivation).toBeGreaterThan(before.cultivation)
  for (const offset of [86_400_000, -86_400_000]) {
    await page.evaluate(offsetMs => {
      // Date changes independently; performance and runtime timers keep running.
      const nativeNow = Date.prototype.getTime
      Date.now = () => nativeNow.call(new Date()) + offsetMs
    }, offset)
    const start = await read()
    await expect.poll(async () => (await read()).cultivation).toBeGreaterThan(start.cultivation)
    if (offset > 0) await openSettingsAndSave(page)
    else await page.getByTestId('settings-save-button').click()
    const savedAt = await page.evaluate(() => {
      const raw = localStorage.getItem('tien-hiep-idle-save:guest')
      if (!raw) throw new Error('Saved snapshot missing')
      return (JSON.parse(raw) as { player: { lastSavedAt: number } }).player.lastSavedAt
    })
    expect(savedAt).toBeGreaterThanOrEqual(before.now)
    expect(savedAt - before.now).toBeLessThan(60_000)
  }
  await page.screenshot({ path: 'test-results/time-authority-live.png' })
  const priorReload = await read()
  await page.reload()
  await reauthAndEnterHome(page)
  const restored = await read()
  expect(restored.name).toBe('Time Authority QA')
  expect(restored.cultivation).toBeGreaterThanOrEqual(priorReload.cultivation)
  expect(restored.now - before.now).toBeLessThan(60_000)
  await expect.poll(async () => (await read()).cultivation).toBeGreaterThan(restored.cultivation)
})
