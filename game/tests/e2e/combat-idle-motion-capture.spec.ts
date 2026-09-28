/// <reference lib="dom" />
import { test, expect } from './fixtures'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { bootToGuestHome, createCharacterThroughUi, enterHome } from './helpers'

/**
 * QA visual capture (2026-09-11) - Spec B sec.9 criterion 10, updated for the
 * art-mode contract that replaced it (a7d7dc70, 2026-09-19), the
 * enemy-art-wave1 reskin amendment and the character-art-infra reskin
 * (2026-09-28):
 *
 * "Verified on screen: entities visibly live. A SCREENSHOT PROVES LAYOUT AND
 * NOTHING ELSE - motion needs a capture across frames, or watching it."
 *
 * ENTITY_ART_MODE is 'static': unmapped entities bob via tween and play NO
 * animation. The sanctioned exceptions are the reskin registries - mapped
 * NEWSPRITE enemies play authored atlas clips, and the player's visual
 * profile resolves to the `zuofeng` character atlas the same way - so this
 * spec samples the WHOLE first combat, not a fixed 2s window: floor 1's pool
 * is boar(w5, animated) + bandit(w3, static), and which species stand up
 * first is RNG. Sampling until combat ends (or the cap hits) makes "at least
 * one animated enemy actually animated" near-deterministic.
 *
 *  - the player plays an authored atlas clip (`zuofeng-*`) whose CURRENT
 *    FRAME changes - a frozen sprite reports a frame too;
 *  - every static enemy bobs within the declared amplitude and plays no
 *    animation (they are stills, the mode contract);
 *  - every animated enemy's CURRENT ATLAS FRAME must change;
 *  - at least one animated enemy must have appeared at all.
 */
/**
 * Mirrors `ENEMY_IDLE_AMPLITUDE_PX` in
 * `src/presentation/art/CombatPresentationCatalogue.ts`, copied rather than
 * imported ON PURPOSE: `tsconfig.node.json` compiles `tests/e2e/**` WITHOUT the
 * `@/*` path mapping, so importing app source from here drags that module and
 * everything it imports into a project that cannot resolve its own imports.
 * (Measured 2026-09-11 - it fails type-check while vitest, which uses Vite's
 * resolver, stays green, so the unit suite will not warn you.)
 *
 * The exact value is owned and asserted by
 * `tests/architecture/staticEntityMotion.test.ts`. What this number does here is
 * bound the bob, so a runaway amplitude is still caught on screen.
 */
const ENEMY_IDLE_AMPLITUDE_PX = 6

test.describe('Combat idle motion (static mode + wave-1 reskins)', () => {
  test('static entities bob; reskinned enemies play authored frames', async ({ page }) => {
    test.setTimeout(240_000)

    const outDir = path.join(process.cwd(), 'test-results', 'combat-idle-motion')
    fs.mkdirSync(outDir, { recursive: true })

    await bootToGuestHome(page)
    await createCharacterThroughUi(page, 'QA Idle Motion')
    await enterHome(page)

    await page.keyboard.press('Tab')
    const teleportSlot = page.locator('[data-wheel-slot="teleport_array"]')
    await expect(teleportSlot).toBeVisible({ timeout: 10_000 })
    await teleportSlot.click()

    const overlay = page.getByTestId('function-overlay-panel')
    await expect(overlay).toBeVisible({ timeout: 10_000 })

    const startButton = page.getByTestId('stage-start-button')
    await expect(startButton).toBeEnabled({ timeout: 10_000 })
    await startButton.click()

    // Let the wave materialise - sprites do not exist before this.
    await page.waitForTimeout(12_000)

    // Phase 0 - deterministic reskin probe. Floor-1's pool mixes a reskinned
    // species (boar, w5) with an unmapped one (bandit, w3), so WHICH shows up
    // is RNG - and the previous run proved a whole combat can pass with zero
    // reskinned spawns. The render+playback path is what this wave changed,
    // so drive it directly through the scene's own public surface:
    // getOrCreateSprite resolves 'mortal_wild_boar_*' -> tusked-mountain-boar
    // exactly like a real spawn does, then playCombatAnimation/beginDeath-
    // Sequence run the same calls onAttack/onDeath make. (onAttack itself is
    // NOT called - it would acknowledge the engine's pending playback token.)
    const probe = await page.evaluate(() => {
      const w = window as unknown as {
        __tutienPhaserGame?: { scene: { getScene(k: string): unknown } }
      }

      const scene = w.__tutienPhaserGame?.scene.getScene('CombatScene') as
        | {
            getOrCreateSprite(
              id: string,
              color: number,
              label: string,
              row: number,
              health?: { currentHp: number; maxHp: number; isBoss: boolean },
            ): {
              kind: string
              rect: {
                texture?: { key: string }
                frame?: { name: string }
                anims?: { currentAnim?: { key: string } }
              }
            }
            playCombatAnimation(sprite: unknown, id: string, name: string): void
            beginDeathSequence(sprite: unknown, id: string): void
            sprites: Map<string, unknown>
          }
        | undefined

      if (!scene) {
        return { error: 'CombatScene unreachable' }
      }

      const probeId = 'mortal_wild_boar_e2e_probe'
      const sprite = scene.getOrCreateSprite(probeId, 0xffffff, 'probe', 7, {
        currentHp: 1,
        maxHp: 1,
        isBoss: false,
      })

      return {
        kind: sprite.kind,
        textureKey: sprite.rect.texture?.key,
        frame: sprite.rect.frame?.name,
        idleAnim: sprite.rect.anims?.currentAnim?.key,
      }
    })

    expect(probe.error, 'probe: CombatScene not reachable').toBeUndefined()
    expect(probe.kind, 'probe sprite is not a Sprite').toBe('sprite')
    expect(
      probe.textureKey,
      `probe drew '${probe.textureKey}' - expected the boar atlas sheet`,
    ).toBe('tusked-mountain-boar-sheet-1')
    expect(probe.frame, 'probe did not draw its first idle frame').toBe(
      'tusked-mountain-boar-idle-001.png',
    )

    // Idle clip running, frames advancing.
    const idleAnimAtSpawn = await page.evaluate(() => {
      const w = window as unknown as {
        __tutienPhaserGame?: { scene: { getScene(k: string): unknown } }
      }
      const scene = w.__tutienPhaserGame?.scene.getScene('CombatScene') as {
        sprites: Map<string, { rect: { anims?: { currentAnim?: { key: string } } } }>
      }
      const s = scene.sprites.get('mortal_wild_boar_e2e_probe')
      return s?.rect.anims?.currentAnim?.key
    })

    expect(idleAnimAtSpawn, 'probe idle clip never started').toBe(
      'tusked-mountain-boar-idle',
    )

    const frameAt = () =>
      page.evaluate(() => {
        const w = window as unknown as {
          __tutienPhaserGame?: { scene: { getScene(k: string): unknown } }
        }
        const scene = w.__tutienPhaserGame?.scene.getScene('CombatScene') as {
          sprites: Map<
            string,
            { rect: { anims?: { currentFrame?: { textureFrame: string } } } }
          >
        }
        return scene.sprites.get('mortal_wild_boar_e2e_probe')?.rect.anims
          ?.currentFrame?.textureFrame
      })

    // Poll rather than fixed waits: frame ticks ride requestAnimationFrame,
    // which the host can starve under parallel suite load - the pin is the
    // frame advancing, not the wall-clock it happens on.
    const probeFrames = new Set<string | undefined>()

    for (let i = 0; i < 20 && probeFrames.size < 2; i++) {
      probeFrames.add(await frameAt())
      await page.waitForTimeout(250)
    }

    expect(
      probeFrames.size,
      `probe idle frames never advanced: ${[...probeFrames].join(',')}`,
    ).toBeGreaterThan(1)

    await page
      .locator('canvas')
      .first()
      .screenshot({ path: path.join(outDir, 'probe-idle.png') })

    // Attack clip: the same call onAttack makes for this sprite.
    const attackAnim = await page.evaluate(() => {
      const w = window as unknown as {
        __tutienPhaserGame?: { scene: { getScene(k: string): unknown } }
      }
      const scene = w.__tutienPhaserGame?.scene.getScene('CombatScene') as {
        sprites: Map<string, unknown>
        playCombatAnimation(sprite: unknown, id: string, name: string): void
      }
      const sprite = scene.sprites.get('mortal_wild_boar_e2e_probe')
      scene.playCombatAnimation(sprite, 'mortal_wild_boar_e2e_probe', 'attack')
      return (sprite as { rect: { anims?: { currentAnim?: { key: string } } } }).rect.anims
        ?.currentAnim?.key
    })

    expect(attackAnim, 'probe attack clip did not start').toBe(
      'tusked-mountain-boar-attack',
    )

    await page
      .locator('canvas')
      .first()
      .screenshot({ path: path.join(outDir, 'probe-attack.png') })

    // Death clip: beginDeathSequence is the real path onDeath takes.
    await page.evaluate(() => {
      const w = window as unknown as {
        __tutienPhaserGame?: { scene: { getScene(k: string): unknown } }
      }
      const scene = w.__tutienPhaserGame?.scene.getScene('CombatScene') as {
        sprites: Map<string, unknown>
        beginDeathSequence(sprite: unknown, id: string): void
      }
      const sprite = scene.sprites.get('mortal_wild_boar_e2e_probe')
      scene.beginDeathSequence(sprite, 'mortal_wild_boar_e2e_probe')
    })

    await page.waitForTimeout(1_500)

    const probeGone = await page.evaluate(() => {
      const w = window as unknown as {
        __tutienPhaserGame?: { scene: { getScene(k: string): unknown } }
      }
      const scene = w.__tutienPhaserGame?.scene.getScene('CombatScene') as {
        sprites: Map<string, unknown>
      }
      return !scene.sprites.has('mortal_wild_boar_e2e_probe')
    })

    expect(probeGone, 'probe sprite still present after death sequence').toBe(true)

    // Player probe (character-art-infra): the `ult` clip is the one authored
    // sequence combat may never fire on floor 1 (ult slot gating is deep
    // progression). Drive the same call onAttack makes for an ultimate cast -
    // play-once, then TRANSITION_DESTINATION lands it on standby.
    const ultAnim = await page.evaluate(() => {
      const w = window as unknown as {
        __tutienPhaserGame?: { scene: { getScene(k: string): unknown } }
      }
      const scene = w.__tutienPhaserGame?.scene.getScene('CombatScene') as {
        sprites: Map<string, unknown>
        playCombatAnimation(sprite: unknown, id: string, name: string): void
      }
      const sprite = scene.sprites.get('player')
      if (!sprite) return { anim: undefined as string | undefined }
      scene.playCombatAnimation(sprite, 'player', 'ult')
      return {
        anim: (sprite as { rect: { anims?: { currentAnim?: { key: string } } } }).rect
          .anims?.currentAnim?.key,
      }
    })

    expect(ultAnim.anim, `player ult clip did not start (got '${ultAnim.anim}')`).toBe(
      'zuofeng-ult',
    )

    await page
      .locator('canvas')
      .first()
      .screenshot({ path: path.join(outDir, 'player-ult.png') })

    // 14 frames at 10fps = 1.4s; give the completion listener margin. The
    // one-shot must have ENDED - which loop follows (standby vs idle) is the
    // live engine's call, so the pin is "settles on a loop", not a specific
    // destination. Poll rather than fixed-wait: live combat keeps running
    // and a natural cast may be mid-clip at any instant - especially now
    // that loop requests DEFER behind in-flight one-shots (F-CB2-01).
    await page.waitForFunction(
      () => {
        const w = window as unknown as {
          __tutienPhaserGame?: { scene: { getScene(k: string): unknown } }
        }
        const scene = w.__tutienPhaserGame?.scene.getScene('CombatScene') as {
          sprites: Map<string, { rect: { anims?: { currentAnim?: { key: string } } } }>
        }
        const key = scene.sprites.get('player')?.rect.anims?.currentAnim?.key
        return typeof key === 'string' && /^zuofeng-(idle|standby)$/.test(key)
      },
      undefined,
      { timeout: 12_000, polling: 200 },
    )


    type EnemySample = {
      id: string
      kind: string
      y: number
      footY: number
      anim: string | undefined
      frame: string | undefined
    }
    type Sample = {
      playerY: number | undefined
      playerFootY: number | undefined
      playerAnim: string | undefined
      playerFrame: string | undefined
      enemies: EnemySample[]
    }

    const sampleScene = async (): Promise<Sample> =>
      page.evaluate(() => {
        const w = window as unknown as {
          __tutienPhaserGame?: {
            scene: { getScene(key: string): unknown }
          }
        }

        const scene = w.__tutienPhaserGame?.scene.getScene('CombatScene') as
          | {
              sprites: Map<
                string,
                {
                  kind: string
                  rect: {
                    y: number
                    anims?: {
                      currentAnim?: { key: string }
                      currentFrame?: { textureFrame: string }
                    }
                  }
                  footY: number
                }
              >
            }
          | undefined

        if (!scene?.sprites) {
          throw new Error('CombatScene sprites not reachable')
        }

        let playerY: number | undefined
        let playerFootY: number | undefined
        let playerAnim: string | undefined
        let playerFrame: string | undefined
        const enemies: {
          id: string
          kind: string
          y: number
          footY: number
          anim: string | undefined
          frame: string | undefined
        }[] = []

        for (const [id, sprite] of scene.sprites) {
          if (id === 'player') {
            playerY = sprite.rect.y
            playerFootY = sprite.footY
            playerAnim = sprite.rect.anims?.currentAnim?.key
            playerFrame = sprite.rect.anims?.currentFrame?.textureFrame
            continue
          }

          // Record EVERY entity kind - a reskin that silently regressed to a
          // Rectangle must stay visible to the assertions below, not be
          // filtered out of the sample (Clean-R1 F7).
          enemies.push({
            id,
            kind: sprite.kind,
            y: sprite.rect.y,
            footY: sprite.footY,
            anim: sprite.rect.anims?.currentAnim?.key,
            frame: sprite.rect.anims?.currentFrame?.textureFrame,
          })
        }

        return { playerY, playerFootY, playerAnim, playerFrame, enemies }
      })

    const measureEntity = async () =>
      page.evaluate(() => {
        const w = window as unknown as {
          __tutienPhaserGame?: { scene: { getScene(k: string): unknown } }
        }

        const scene = w.__tutienPhaserGame?.scene.getScene('CombatScene') as {
          sprites: Map<
            string,
            {
              row: number
              personHeight?: number
              boost: { value: number }
              rect: {
                displayWidth: number
                displayHeight: number
                frame: { realWidth: number; realHeight: number }
              }
            }
          >
          projection?: { gridToScreen(row: number, col: number): { scale: number } }
        }

        const player = scene.sprites.get('player')
        if (!player) return undefined

        const at = (id: string) => {
          const s = scene.sprites.get(id)
          if (!s?.personHeight) return undefined
          const depth = scene.projection?.gridToScreen(s.row, 8).scale ?? 1
          // personHeight tracks boost deliberately (turn-ready pulse 1.15,
          // crit pop 1.25, spawn fade 0.7) - the assertion compares the
          // geometry class factors, so the transient modulation divides out.
          const boost = s.boost?.value || 1
          return s.personHeight / (depth * boost)
        }

        const enemyId = [...scene.sprites.keys()].find((k) => k !== 'player')

        return {
          displayWidth: player.rect.displayWidth,
          displayHeight: player.rect.displayHeight,
          authoredWidth: player.rect.frame.realWidth,
          authoredHeight: player.rect.frame.realHeight,
          playerPersonHeight: at('player'),
          enemyPersonHeight: enemyId ? at(enemyId) : undefined,
        }
      })

    const samples: Sample[] = []
    let animatedScreenshotTaken = false
    let measured: Awaited<ReturnType<typeof measureEntity>>

    // Sample across the whole floor-1 combat: 10 enemies spawn over time and
    // kills, so a reskinned boar is near-certain to appear - but not inside a
    // fixed early window, which is what the previous 6-sample version needed.
    for (let index = 0; index < 240; index++) {
      const sample = await sampleScene()

      samples.push(sample)

      if (!measured) {
        measured = await measureEntity()
      }

      const animatedNow = sample.enemies.some((enemy) => enemy.anim)

      if (animatedNow && !animatedScreenshotTaken) {
        animatedScreenshotTaken = true
        await page
          .locator('canvas')
          .first()
          .screenshot({ path: path.join(outDir, 'animated-enemy.png') })
      }

      if (sample.enemies.length === 0 && samples.length > 10) {
        // No enemies left standing - combat ended or is between waves.
        break
      }

      await page.waitForTimeout(500)
    }

    await page
      .locator('canvas')
      .first()
      .screenshot({ path: path.join(outDir, 'final.png') })

    fs.writeFileSync(path.join(outDir, 'samples.json'), JSON.stringify(samples, null, 2))

    // There has to be something to measure.
    const anyEnemies = samples.some((sample) => sample.enemies.length > 0)
    expect(anyEnemies, 'no enemy sprites on screen across the whole capture').toBe(true)

    // 1. Reskinned player (character-art-infra): the visual profile resolves
    //    to the `zuofeng` atlas and plays an authored clip whose frame must
    //    actually advance. Idle is the standing state; attack/ult may
    //    legitimately interleave while turns run.
    const playerSamples = samples.filter((sample) => sample.playerY !== undefined)

    expect(playerSamples.length, 'player sprite never sampled').toBeGreaterThan(0)

    for (const sample of playerSamples) {
      expect(
        sample.playerAnim,
        `reskinned player is not playing a zuofeng clip (got '${sample.playerAnim}')`,
      ).toMatch(/^zuofeng-(idle|standby|attack|ult|death|idle_to_standby|standby_to_idle)$/)
    }

    const playerFrames = new Set(playerSamples.map((sample) => sample.playerFrame))

    expect(
      playerFrames.size,
      'reskinned player is playing an animation but its frame never changed',
    ).toBeGreaterThan(1)

    // 2. Per-enemy contract by art kind.
    const enemyIds = [...new Set(samples.flatMap((sample) => sample.enemies.map((e) => e.id)))]
    // The phase-0 probe IS a reskinned enemy animated on screen - spawned
    // through getOrCreateSprite, idle frames advanced, attack/death ran the
    // same production calls. It is the deterministic proof for criterion 3:
    // natural spawns are identical code but RNG-gated (a fast-killed boar
    // can miss the 3-sample floor without any product defect).
    const animatedIds = new Set<string>(['mortal_wild_boar_e2e_probe'])

    for (const id of enemyIds) {
      const series = samples
        .map((sample) => sample.enemies.find((enemy) => enemy.id === id))
        .filter((entry): entry is NonNullable<typeof entry> => entry !== undefined)

      // Clean-R1 F7: a reskinned species must never appear as a Rectangle -
      // the sampler used to drop non-sprite kinds, hiding that regression.
      // Boar ids are floor-1's reskinned template (tusked-mountain-boar).
      if (id.startsWith('mortal_wild_boar')) {
        expect(
          series.every((entry) => entry.kind === 'sprite'),
          `${id}: reskinned enemy drew as a Rectangle at least once`,
        ).toBe(true)
      }

      // Spawned-and-died inside one tick is still evidence combat ran, but
      // too thin to measure motion on.
      if (series.length < 3) {
        continue
      }

      const animated = series.some((entry) => entry.anim)

      if (animated) {
        animatedIds.add(id)

        const frames = new Set(series.map((entry) => entry.frame))

        expect(
          frames.size,
          `${id}: reskinned enemy is playing an animation but its frame never changed`,
        ).toBeGreaterThan(1)

        continue
      }

      // Static enemy: the bob is the GAP between the body and the projected
      // ground. Enemies advance between rows during a battle, so the foot
      // point itself moves for reasons unrelated to breathing - the gap
      // isolates it.
      const lifts = series.map((entry) => entry.footY - entry.y)

      expect(
        Math.max(...lifts),
        `${id}: body never left the ground - static means still, not dead`,
      ).toBeGreaterThan(0)

      expect(
        Math.max(...lifts),
        `${id}: lifted further than the declared amplitude`,
      ).toBeLessThanOrEqual(ENEMY_IDLE_AMPLITUDE_PX + 0.5)

      expect(
        new Set(lifts.map((lift) => lift.toFixed(2))).size,
        `${id}: lift never changed`,
      ).toBeGreaterThan(1)
    }

    // 3. Wave-1 pin: at least one reskinned enemy animated on screen. The
    //    phase-0 probe provides it deterministically; natural boar spawns
    //    counted above only add evidence (fast kills can legitimately hide
    //    them from the 3-sample floor - boar w5 / bandit w3 is spawn RNG).
    expect(
      animatedIds.size,
      'no reskinned enemy was ever animated on screen (probe + floor-1 pool boar w5 / bandit w3)',
    ).toBeGreaterThan(0)

    // 4. The player is drawn at the aspect ratio its ART is authored in,
    //    and Spec C sec.7 criterion 3 - the CHARACTER heights match, not the
    //    box heights. Measured mid-loop above: after combat ends the scene's
    //    sprite map is gone, so these reads must not wait for it.
    expect(measured, 'player sprite never measurable during combat').toBeDefined()

    const drawnAspect = measured!.displayWidth / measured!.displayHeight
    const authoredAspect = measured!.authoredWidth / measured!.authoredHeight

    expect(
      drawnAspect / authoredAspect,
      `player drawn at aspect ${drawnAspect.toFixed(3)} but authored at ${authoredAspect.toFixed(3)}`,
    ).toBeCloseTo(1, 1)

    expect(measured!.playerPersonHeight, 'player has no resolved person height').toBeDefined()
    expect(measured!.enemyPersonHeight, 'enemy has no resolved person height').toBeDefined()

    expect(
      measured!.playerPersonHeight! / measured!.enemyPersonHeight!,
      `player ${measured!.playerPersonHeight!.toFixed(1)}px vs enemy ${measured!.enemyPersonHeight!.toFixed(1)}px, depth-normalised`,
    ).toBeCloseTo(1, 1)
  })
})
