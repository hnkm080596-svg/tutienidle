import { expect, test } from './fixtures'

import { bootToGuestHome, createCharacterThroughUi, enterHome } from './helpers'

// Monster attack VFX sweep (2026-10-04) - runtime evidence that the wired
// enemy attack types play the bound spritesheet on the correct frame at
// the target anchor, through the REAL pipeline (enemy declare ->
// skill_presentation_cast -> runner -> Phaser driver -> atlas sprite).
// mortal_dong_1 spawns only wild boars (attackPresetId 'slash'), so the
// first captured sheet is real authored data end-to-end; the remaining
// bindings are probed by swapping a live participant's basic.presetId so
// every wired type still resolves through the same production path.
test.describe('Monster attack VFX sweep', () => {
  test('bound sheets play on frame and anchor for every wired enemy attack type', async ({ page }) => {
    test.setTimeout(300_000)

    await bootToGuestHome(page)
    await createCharacterThroughUi(page, 'VFX Quái Vật')
    await enterHome(page)

    await page.keyboard.press('Tab')
    const teleportSlot = page.locator('[data-wheel-slot="teleport_array"]')
    await expect(teleportSlot).toBeVisible({ timeout: 10_000 })
    await teleportSlot.click()

    const overlay = page.locator('.exploration-scene')
    await expect(overlay).toBeVisible({ timeout: 10_000 })
    const startButton = page.getByTestId('stage-start-button')
    await expect(startButton).toBeEnabled({ timeout: 10_000 })
    await startButton.click()

    // Live turn battle handle.
    await expect.poll(async () =>
      page.evaluate(() => {
        const gm = (window as any).__tutienPhaserGame?.registry?.get('gameManager')
        return gm?.getTurnBattle()?.state ?? 'none'
      }), { timeout: 30_000 }).toBe('fighting')

    // Keep the player alive for the whole evidence window and install the
    // sheet-sprite recorder on the CombatScene display list.
    await page.evaluate(() => {
      const w = window as any
      const gm = w.__tutienPhaserGame.registry.get('gameManager')
      const battle = gm.getTurnBattle()
      const playerEntity = battle.players[0].entity
      playerEntity.stats = { ...playerEntity.stats, maxHp: 1_000_000_000 }
      playerEntity.baseStats = { ...playerEntity.baseStats, maxHp: 1_000_000_000 }
      playerEntity.maxHp = 1_000_000_000
      playerEntity.currentHp = 1_000_000_000

      w.__vfxProbe = { samples: [] }
      const scene = w.__tutienPhaserGame.scene.getScene('CombatScene')
      const scan = () => {
        if (w.__vfxProbe.samples.length > 6000) w.__vfxProbe.samples.splice(0, 2000)
        const list = scene.children.getAll ? scene.children.getAll() : []
        for (const obj of list) {
          const key = obj?.texture?.key
          if (typeof key === 'string' && key.startsWith('vfx-sheet')) {
            w.__vfxProbe.samples.push({
              key,
              frame: obj.frame?.name,
              x: Math.round(obj.x),
              y: Math.round(obj.y),
            })
          }
        }
        requestAnimationFrame(scan)
      }
      requestAnimationFrame(scan)
    })

    // The player sprite's screen position for the anchor-distance assertion.
    const playerAnchor = () =>
      page.evaluate(() => {
        const w = window as any
        const scene = w.__tutienPhaserGame.scene.getScene('CombatScene')
        const entry = scene.sprites?.get('player')
        const rect = entry?.rect
        if (!rect) return null
        return { x: Math.round(rect.x), y: Math.round(rect.y) }
      })

    const BINDINGS: ReadonlyArray<{
      presetId: string
      sheetKey: string
      firstFrame: number
      lastFrame: number
    }> = [
      { presetId: 'slash', sheetKey: 'vfx-sheet-slash-21', firstFrame: 0, lastFrame: 15 },
      { presetId: 'claw', sheetKey: 'vfx-sheet-sffxep-27', firstFrame: 4, lastFrame: 20 },
      { presetId: 'bite', sheetKey: 'vfx-sheet-sffxep-31', firstFrame: 0, lastFrame: 15 },
      { presetId: 'fire_burst', sheetKey: 'vfx-sheet-sffxep-09', firstFrame: 2, lastFrame: 20 },
      { presetId: 'water_surge', sheetKey: 'vfx-sheet-water-fx-10', firstFrame: 10, lastFrame: 44 },
      { presetId: 'earth_shockwave', sheetKey: 'vfx-sheet-earth-07', firstFrame: 0, lastFrame: 15 },
      { presetId: 'boss_ground_slam', sheetKey: 'vfx-sheet-explosion-10', firstFrame: 4, lastFrame: 34 },
    ]

    const samplesFor = (sheetKey: string) =>
      page.evaluate((key) => {
        const w = window as any
        return w.__vfxProbe.samples.filter((s: any) => s.key === key)
      }, sheetKey)

    const enemyParticipant = () =>
      page.evaluate(() => {
        const w = window as any
        const gm = w.__tutienPhaserGame.registry.get('gameManager')
        const battle = gm.getTurnBattle()
        const alive = battle?.enemies?.filter((e: any) => e.alive && e.entity.alive) ?? []
        return alive.map((e: any) => ({
          id: e.id,
          templateId: e.entity.templateId ?? e.entity.id,
          presetId: e.basic?.presetId ?? null,
        }))
      })

    // 1) Real authored data: boars on mortal_dong_1 carry attackPresetId
    // 'slash' - assert the bound sheet plays during their attacks.
    await expect.poll(async () => {
      const enemies = await enemyParticipant()
      return enemies.filter((e: any) => e.presetId === 'slash').length
    }, { timeout: 15_000 }).toBeGreaterThan(0)

    await expect.poll(async () => (await samplesFor('vfx-sheet-slash-21')).length,
      { timeout: 60_000 }).toBeGreaterThan(0)

    const assertBinding = async (presetId: string, sheetKey: string, firstFrame: number, lastFrame: number) => {
      // Swap a live enemy's basic preset so the next attack resolves the
      // requested sheet through the same declare -> present pipeline.
      await page.evaluate((preset) => {
        const w = window as any
        const gm = w.__tutienPhaserGame.registry.get('gameManager')
        const battle = gm.getTurnBattle()
        const alive = battle?.enemies?.filter((e: any) => e.alive && e.entity.alive) ?? []
        for (const enemy of alive) enemy.basic = { ...enemy.basic, presetId: preset }
      }, presetId)

      const before = (await samplesFor(sheetKey)).length
      await expect.poll(async () => (await samplesFor(sheetKey)).length,
        { timeout: 45_000 }).toBeGreaterThan(before)

      // Mid-window visual evidence for the run report: freeze the Phaser
      // loop while a sheet sprite is live, then screenshot — a plain
      // page.screenshot races the ~0.5s clip and lands after the sprite
      // is destroyed (WebGL canvas toDataURL reads back black without
      // preserveDrawingBuffer, so an in-page canvas grab is not viable).
      const freezeWhileLive = () =>
        page.evaluate((key) => {
          const w = window as any
          const scene = w.__tutienPhaserGame.scene.getScene('CombatScene')
          const list = scene.children.getAll ? scene.children.getAll() : []
          const live = list.some((obj: any) => obj?.texture?.key === key && obj.visible)
          if (!live) return false
          scene.sys.game.loop.sleep()
          return true
        }, sheetKey)
      await expect.poll(async () => freezeWhileLive(), { timeout: 45_000 }).toBe(true)
      await page.screenshot({ path: `test-results/vfx-sheet-${presetId}.jpg`, type: 'jpeg', quality: 70 })
      await page.evaluate(() => {
        const w = window as any
        w.__tutienPhaserGame.scene.getScene('CombatScene').sys.game.loop.wake()
      })

      const samples = await samplesFor(sheetKey)
      const frames = samples
        .map((s: any) => Number(String(s.frame).replace('frame_', '')))
        .filter((n: any) => Number.isFinite(n))
      expect(frames.length, `${presetId}: samples without frame_N`).toBeGreaterThan(0)
      for (const frame of frames) {
        expect(frame, `${presetId}: frame outside [${firstFrame},${lastFrame}]`).toBeGreaterThanOrEqual(firstFrame)
        expect(frame, `${presetId}: frame outside [${firstFrame},${lastFrame}]`).toBeLessThanOrEqual(lastFrame)
      }

      const anchor = await playerAnchor()
      expect(anchor, `${presetId}: player sprite rect missing`).not.toBeNull()
      const near = samples.filter(
        (s: any) => Math.abs(s.x - anchor!.x) <= 160 && Math.abs(s.y - anchor!.y) <= 160,
      )
      expect(near.length, `${presetId}: no sheet sample near the attacked player anchor`).toBeGreaterThan(0)
    }

    // 2) Remaining wired types through the same pipeline (data-level poke).
    for (const binding of BINDINGS) {
      await assertBinding(binding.presetId, binding.sheetKey, binding.firstFrame, binding.lastFrame)
    }

    // 3) Scripted boss special: authored presetId reaches the resolved
    // skill's presentation (water_surge over the basic attack's preset).
    await page.evaluate(() => {
      const w = window as any
      const gm = w.__tutienPhaserGame.registry.get('gameManager')
      const battle = gm.getTurnBattle()
      const alive = battle?.enemies?.filter((e: any) => e.alive && e.entity.alive) ?? []
      for (const enemy of alive) {
        enemy.basic = { ...enemy.basic, presetId: 'bite' }
        enemy.entity.specialAttacks = [{ everyNth: 1, damageMultiplier: 2, presetId: 'water_surge' }]
      }
    })

    const surgeBefore = (await samplesFor('vfx-sheet-water-fx-10')).length
    await expect.poll(async () => (await samplesFor('vfx-sheet-water-fx-10')).length,
      { timeout: 45_000 }).toBeGreaterThan(surgeBefore)
    await expect.poll(async () =>
      page.evaluate(() => {
        const w = window as any
        const scene = w.__tutienPhaserGame.scene.getScene('CombatScene')
        const list = scene.children.getAll ? scene.children.getAll() : []
        const live = list.some((obj: any) => obj?.texture?.key === 'vfx-sheet-water-fx-10' && obj.visible)
        if (!live) return false
        scene.sys.game.loop.sleep()
        return true
      }), { timeout: 45_000 }).toBe(true)
    await page.screenshot({ path: 'test-results/vfx-sheet-scripted-special.jpg', type: 'jpeg', quality: 70 })
    await page.evaluate(() => {
      const w = window as any
      w.__tutienPhaserGame.scene.getScene('CombatScene').sys.game.loop.wake()
    })
  })
})
