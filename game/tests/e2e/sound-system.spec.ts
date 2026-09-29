import { expect, test, type Page } from './fixtures'
import {
  bootToGuestHome,
  createCharacterThroughUi,
  enterHome,
  reauthAndEnterHome,
} from './helpers'

/**
 * Sound System e2e (P13/P14 runtime check).
 *
 * Probe: wraps AudioManager.playCue / crossfadeMusic in the live page (dev
 * module graph import resolves to the same singleton) and records every cue
 * id. Empty manifest slots then exercise the full real path (resolve ->
 * silent no-op / synth fallback) with no stubbing.
 *
 * Coverage:
 * 1. Guest click unlocks AudioContext; the pre-unlock desired music
 *    (music.menu/music.home) reaches crossfadeMusic.
 * 2. Button clicks + character creation fire ui.click / progress.* cues.
 * 3. Command wheel open fires ui.wheel.open (uiStore-driven).
 * 4. Combat domain events on the real eventBus produce combat.* cues
 *    (emit probe via the Phaser registry - full-battle pacing is out of
 *    scope for an audio smoke check).
 * 5. SettingsPanel channel sliders + reduced-shake toggle persist across
 *    reload.
 * 6. Zero console/page errors throughout.
 */

interface ProbeWindow {
  __audioCues?: string[]
  __audioMusic?: string[]
}

async function installProbe(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const w = window as unknown as ProbeWindow
    w.__audioCues = []
    w.__audioMusic = []
    // Non-literal specifier: this URL is resolved by the dev server inside
    // the page, not by the spec's own module graph.
    const specifier = '/src/core/audio/AudioManager.ts'
    const mod = (await import(/* @vite-ignore */ specifier)) as {
      AudioManager: {
        getInstance(): {
          playCue: (id: string) => void
          crossfadeMusic: (id: string, fadeMs: number) => void
        }
      }
    }
    const inst = mod.AudioManager.getInstance()
    const playCue = inst.playCue.bind(inst)
    inst.playCue = (id: string) => {
      w.__audioCues!.push(id)
      playCue(id)
    }
    const crossfade = inst.crossfadeMusic.bind(inst)
    inst.crossfadeMusic = (id: string, fadeMs: number) => {
      w.__audioMusic!.push(id)
      crossfade(id, fadeMs)
    }
  })
}

function cues(page: Page): Promise<string[]> {
  return page.evaluate(
    () => (window as unknown as ProbeWindow).__audioCues ?? [],
  )
}

function music(page: Page): Promise<string[]> {
  return page.evaluate(
    () => (window as unknown as ProbeWindow).__audioMusic ?? [],
  )
}

test.describe('Sound system', () => {
  test('cue attempts fire on gesture; sliders persist across reload', async ({ page }) => {
    test.setTimeout(240_000)

    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })
    page.on('pageerror', (err) => consoleErrors.push(String(err)))

    await page.goto('/')
    await installProbe(page)

    const auth = page.getByTestId('auth-screen')
    await expect(auth).toBeVisible({ timeout: 15_000 })
    await page.getByTestId('auth-guest-button').click()

    await createCharacterThroughUi(page, 'E2E Sound')
    await enterHome(page)

    // (1): route music reached the music slot (menu during auth, home after).
    const seenMusic = await music(page)
    expect(seenMusic.length).toBeGreaterThan(0)
    expect(seenMusic[seenMusic.length - 1]).toBe('music.home')

    // (2): gesture + creation cues.
    const seenCues = await cues(page)
    expect(seenCues).toContain('ui.click')
    expect(seenCues).toContain('progress.create')

    // (3): command wheel open.
    await page.locator('.home-player__trigger').click()
    const settingsSlot = page.locator('[data-wheel-slot="settings"]')
    await expect(settingsSlot).toBeVisible({ timeout: 10_000 })
    await expect.poll(async () => (await cues(page)).includes('ui.wheel.open')).toBe(true)

    // (4): combat cues via the real eventBus probe.
    await page.evaluate(() => {
      const w = window as unknown as {
        __tutienPhaserGame?: { registry: { get(key: string): unknown } }
      }
      const bus = w.__tutienPhaserGame?.registry.get('eventBus') as
        | { emit(type: string, event: unknown): void }
        | undefined
      if (!bus) throw new Error('eventBus not exposed in registry')
      bus.emit('hit', { type: 'hit', sourceId: 'player', targetId: 'enemy_1' })
      bus.emit('critical', { type: 'critical' })
      bus.emit('battle_end', { type: 'battle_end', state: 'victory' })
    })
    await expect.poll(async () => (await cues(page)).includes('combat.hit')).toBe(true)
    await expect.poll(async () => (await cues(page)).includes('combat.crit')).toBe(true)
    await expect.poll(async () => (await cues(page)).includes('combat.victory')).toBe(true)

    // (5): settings sliders + shake toggle.
    await settingsSlot.click()
    const panel = page.locator('.settings-panel')
    await expect(panel).toBeVisible({ timeout: 10_000 })

    const sfxSlider = page.getByTestId('settings-audio-sfxVolume')
    await expect(sfxSlider).toBeVisible()
    await sfxSlider.fill('30')
    const shakeToggle = page.getByTestId('settings-reduced-shake')
    await shakeToggle.click()
    await expect(shakeToggle).toHaveAttribute('aria-pressed', 'true')

    // Persist across reload: re-auth (same guest save), reopen settings.
    await page.reload()
    await reauthAndEnterHome(page)
    await page.locator('.home-player__trigger').click()
    const settingsSlot2 = page.locator('[data-wheel-slot="settings"]')
    await expect(settingsSlot2).toBeVisible({ timeout: 10_000 })
    await settingsSlot2.click()
    await expect(page.locator('.settings-panel')).toBeVisible({ timeout: 10_000 })

    await expect(page.getByTestId('settings-audio-sfxVolume')).toHaveValue('30')
    await expect(page.getByTestId('settings-reduced-shake')).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    // (6): clean console.
    expect(consoleErrors).toEqual([])
  })
})
