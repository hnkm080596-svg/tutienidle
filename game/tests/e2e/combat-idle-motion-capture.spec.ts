/// <reference lib="dom" />
import { test, expect } from './fixtures'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { bootToGuestHome, createCharacterThroughUi, enterHome } from './helpers'

/**
 * QA visual capture (2026-09-11) - Spec B sec.9 criterion 10.
 *
 * "Verified on screen: the player's idle animation plays, and enemies visibly
 * breathe. A SCREENSHOT PROVES LAYOUT AND NOTHING ELSE - motion needs a capture
 * across frames, or watching it."
 *
 * So this samples the live scene over time rather than asserting a picture:
 *
 *  - ENTITY_ART_MODE is 'static' (the 2026-09-19 uniformity switch): NO
 *    entity - player included - plays a clip. What used to be "the player's
 *    idle clip is running" is now "the player's idle BOB is running": every
 *    combatant's body sits ABOVE its own projected ground point by a varying
 *    amount within the declared amplitude (the bob lifts the body and leaves
 *    the feet, the shadow and the depth sort on the ground);
 *  - no combatant has an animation playing at all (sec.3.2 - they are stills).
 */
/**
 * Mirrors `ENEMY_IDLE_AMPLITUDE_PX` in
 * `src/presentation/art/CombatPresentationCatalogue.ts`, copied rather than
 * imported ON PURPOSE: `tsconfig.node.json` compiles `tests/e2e/**` WITHOUT the
 * `@/*` path mapping, so importing app source from here drags that module and
 * everything it imports into a project that cannot resolve its own imports.
 * (Measured 2026-09-11 — it fails type-check while vitest, which uses Vite's
 * resolver, stays green, so the unit suite will not warn you.)
 *
 * The exact value is owned and asserted by
 * `tests/architecture/staticEntityMotion.test.ts`. What this number does here is
 * bound the bob, so a runaway amplitude is still caught on screen.
 */
const ENEMY_IDLE_AMPLITUDE_PX = 6

// @capture: this spec also writes frame/screenshot artifacts to
// test-results/. It stays in the default e2e run because its assertions
// guard the real idle-motion contract, not capture-only output.
test.describe('Combat idle motion (Spec B §9.10)', { tag: '@capture' }, () => {
  test('player breathes via idle bob; static enemies bob without animating', async ({ page }) => {
    test.setTimeout(180_000)

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

    // Let the wave materialise — sprites do not exist before this.
    await page.waitForTimeout(12_000)

    type Sample = {
      playerAnim: string | undefined
      playerY: number | undefined
      playerFootY: number | undefined
      playerIdleOffsetY: number | undefined
      enemies: { id: string; y: number; footY: number; anim: string | undefined }[]
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
                  idle?: { offsetY: number }
                }
              >
            }
          | undefined

        if (!scene?.sprites) {
          throw new Error('CombatScene sprites not reachable')
        }

        let playerAnim: string | undefined
        let playerY: number | undefined
        let playerFootY: number | undefined
        let playerIdleOffsetY: number | undefined
        const enemies: { id: string; y: number; footY: number; anim: string | undefined }[] = []

        for (const [id, sprite] of scene.sprites) {
          if (sprite.kind !== 'sprite') {
            continue
          }

          if (id === 'player') {
            playerAnim = sprite.rect.anims?.currentAnim?.key
            playerY = sprite.rect.y
            playerFootY = sprite.footY
            playerIdleOffsetY = sprite.idle?.offsetY
            continue
          }

          enemies.push({
            id,
            y: sprite.rect.y,
            footY: sprite.footY,
            anim: sprite.rect.anims?.currentAnim?.key,
          })
        }

        return { playerAnim, playerY, playerFootY, playerIdleOffsetY, enemies }
      })

    const samples: Sample[] = []

    for (let index = 0; index < 6; index++) {
      samples.push(await sampleScene())

      await page
        .locator('canvas')
        .first()
        .screenshot({ path: path.join(outDir, `frame-${index}.png`) })

      await page.waitForTimeout(350)
    }

    fs.writeFileSync(path.join(outDir, 'samples.json'), JSON.stringify(samples, null, 2))

    // There has to be something to measure.
    expect(samples[0]!.enemies.length, 'no enemy sprites on screen').toBeGreaterThan(0)

    // 1. ENTITY_ART_MODE is 'static': the player is a still too, so no clip
    //    ever plays - `currentAnim` must stay absent. Its idle is the shared
    //    bob tween on `sprite.idle.offsetY`, which moves the body within
    //    [-amplitude, 0] regardless of combat actions - timing-robust proof
    //    of breathing that a one-frame screenshot cannot give.
    expect(samples[0]!.playerY, 'player sprite missing from scene.sprites').toBeDefined()
    expect(
      samples[0]!.playerAnim,
      `static mode must never play a player clip, got '${samples[0]!.playerAnim}'`,
    ).toBeFalsy()

    const playerOffsets = samples.map((sample) => sample.playerIdleOffsetY)

    expect(
      playerOffsets[0],
      'player has no idle bob state - static entities get sprite.idle at creation',
    ).toBeDefined()

    for (const offset of playerOffsets) {
      expect(
        offset! >= -(ENEMY_IDLE_AMPLITUDE_PX + 0.5) && offset! <= 0.5,
        `player idle offset ${offset} escaped the declared bob amplitude`,
      ).toBe(true)
    }

    expect(
      new Set(playerOffsets.map((offset) => offset!.toFixed(2))).size,
      `player bob never moved across ${samples.length} samples: ${playerOffsets.join(', ')}`,
    ).toBeGreaterThan(1)

    // 2. The player is drawn at the aspect ratio its ART is authored in.
    //
    //    The defect this pins, measured 2026-09-11: spec B moved what the
    //    sprite DRAWS (an atlas frame authored at 200x350) without moving what
    //    SIZES it (`PlayerVisualProfile.combatSourceSize`, 1312x1199), so the
    //    figure rendered 3.44x too wide. Nothing failed — every clip was
    //    correct, every frame advanced, and the proportions were nonsense.
    const shape = await page.evaluate(() => {
      const w = window as unknown as {
        __tutienPhaserGame?: { scene: { getScene(k: string): unknown } }
      }

      const scene = w.__tutienPhaserGame?.scene.getScene('CombatScene') as {
        sprites: Map<
          string,
          {
            rect: {
              displayWidth: number
              displayHeight: number
              frame: { realWidth: number; realHeight: number }
            }
          }
        >
      }

      const player = scene.sprites.get('player')!

      return {
        displayWidth: player.rect.displayWidth,
        displayHeight: player.rect.displayHeight,
        authoredWidth: player.rect.frame.realWidth,
        authoredHeight: player.rect.frame.realHeight,
      }
    })

    const drawnAspect = shape.displayWidth / shape.displayHeight
    const authoredAspect = shape.authoredWidth / shape.authoredHeight

    expect(
      drawnAspect / authoredAspect,
      `player drawn at aspect ${drawnAspect.toFixed(3)} but authored at ${authoredAspect.toFixed(3)}`,
    ).toBeCloseTo(1, 1)

    // 3. Spec C §7 criterion 3 — the CHARACTER heights match, not the box heights.
    //
    //    resolveEntityDisplaySize lands every entity's personHeight at
    //    nearCellWidth x (pointScale x boost) x classFactor x
    //    PERSON_HEIGHT_IN_CELLS, recomputed each projection pass. Dividing
    //    back out by the live projected scale x boost x classFactor leaves
    //    nearCellWidth x 1.84 for EVERY entity - species art, boss class and
    //    spawn-fade/crit-pop boosts all cancel. The scale is read at
    //    (row, columnFloat), the same point positionSprite() projects with.
    //
    //    Measured before this spec: player 91.1px against boar 123.0px, while
    //    both carried the same multiplier and the boar was the one further
    //    away. A box comparison would have passed that. Polled rather than
    //    sampled once - personHeight and boost are written on different
    //    seams inside a frame, so one read can catch a transient mid-tween.
    const canonicalHeightAt = () =>
      page.evaluate(() => {
        const w = window as unknown as {
          __tutienPhaserGame?: { scene: { getScene(k: string): unknown } }
        }

        const scene = w.__tutienPhaserGame?.scene.getScene('CombatScene') as {
          sprites: Map<
            string,
            {
              row: number
              columnFloat: number
              personHeight?: number
              boost: { value: number }
              sizeMultiplier: number
            }
          >
          projection?: { gridToScreen(row: number, col: number): { scale: number } }
        }

        const at = (id: string) => {
          const s = scene.sprites.get(id)

          if (!s?.personHeight) return undefined

          const pointScale = scene.projection?.gridToScreen(s.row, s.columnFloat).scale ?? 1
          const effectiveScale = Math.max(0.05, pointScale * s.boost.value)

          return s.personHeight / effectiveScale / (s.sizeMultiplier / 2)
        }

        const enemyId = [...scene.sprites.keys()].find((k) => k !== 'player')

        return { player: at('player'), enemy: enemyId === undefined ? undefined : at(enemyId) }
      })

    expect(
      (await canonicalHeightAt()).player,
      'player has no resolved person height',
    ).toBeDefined()

    // Undefined enemy (wave gap) or a frame-transient mismatch both read as
    // NaN - the poll resamples until the ratio lands or the budget expires.
    await expect
      .poll(async () => {
        const sample = await canonicalHeightAt()

        if (sample.player === undefined || sample.enemy === undefined) {
          return NaN
        }

        return sample.player / sample.enemy
      }, {
        timeout: 15_000,
        message: 'player/enemy canonical heights should converge (normalisation factor cancels all classes)',
      })
      .toBeCloseTo(1, 1)

    // 4. Every static enemy moved, and kept its feet on the ground.
    const enemyIds = samples[0]!.enemies.map((enemy) => enemy.id)

    for (const id of enemyIds) {
      const series = samples
        .map((sample) => sample.enemies.find((enemy) => enemy.id === id))
        .filter((entry): entry is NonNullable<typeof entry> => entry !== undefined)

      if (series.length < samples.length) {
        // Died mid-capture. Not a failure — combat is running.
        continue
      }

      // The bob is the GAP between the body and the projected ground. Measuring
      // it this way rather than as "body moved, feet did not" is deliberate:
      // enemies advance between rows during a battle, so the foot point moves
      // for a reason that has nothing to do with breathing. The gap isolates it.
      const lifts = series.map((entry) => entry.footY - entry.y)

      expect(
        Math.max(...lifts),
        `${id}: body never left the ground — static means still, not dead`,
      ).toBeGreaterThan(0)

      expect(
        Math.max(...lifts),
        `${id}: lifted further than the declared amplitude`,
      ).toBeLessThanOrEqual(ENEMY_IDLE_AMPLITUDE_PX + 0.5)

      expect(new Set(lifts.map((lift) => lift.toFixed(2))).size, `${id}: lift never changed`)
        .toBeGreaterThan(1)

      // 5. And it is a tween, not an animation (§3.2).
      for (const entry of series) {
        expect(entry.anim, `${id}: a static enemy is playing '${entry.anim}'`).toBeFalsy()
      }
    }
  })
})
