/// <reference lib="dom" />
import { test, expect } from './fixtures'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { bootToGuestHome, createCharacterThroughUi, enterHome } from './helpers'

/**
 * QA visual capture (2026-09-11) — Spec B §9 criterion 10.
 *
 * "Verified on screen: the player's idle animation plays, and enemies visibly
 * breathe. A SCREENSHOT PROVES LAYOUT AND NOTHING ELSE — motion needs a capture
 * across frames, or watching it."
 *
 * So this samples the live scene over time rather than asserting a picture:
 *
 *  - the player's CURRENT ATLAS FRAME must change (its idle clip is running);
 *  - every static enemy's body must sit ABOVE its own projected ground point by
 *    a varying amount within the declared amplitude (the bob lifts the body and
 *    leaves the feet, the shadow and the depth sort on the ground);
 *  - no static enemy has an animation playing at all (§3.2 — they are stills).
 *
 * The numbered placeholder frames make the human half easy: if the number on the
 * player changes between the captured screenshots and the enemies move without
 * their own number changing, both halves are correct.
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

test.describe('Combat idle motion (Spec B §9.10)', () => {
  test('player frames advance; static enemies bob without animating', async ({ page }) => {
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
      playerFrame: string | undefined
      playerAnim: string | undefined
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
                }
              >
            }
          | undefined

        if (!scene?.sprites) {
          throw new Error('CombatScene sprites not reachable')
        }

        let playerFrame: string | undefined
        let playerAnim: string | undefined
        const enemies: { id: string; y: number; footY: number; anim: string | undefined }[] = []

        for (const [id, sprite] of scene.sprites) {
          if (sprite.kind !== 'sprite') {
            continue
          }

          if (id === 'player') {
            playerFrame = sprite.rect.anims?.currentFrame?.textureFrame
            playerAnim = sprite.rect.anims?.currentAnim?.key
            continue
          }

          enemies.push({
            id,
            y: sprite.rect.y,
            footY: sprite.footY,
            anim: sprite.rect.anims?.currentAnim?.key,
          })
        }

        return { playerFrame, playerAnim, enemies }
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

    // 1. The player's idle clip is running, and its frames ADVANCE. A frozen
    //    sprite reports a frame too — only a change proves playback.
    expect(samples[0]!.playerAnim, 'player is playing no animation').toBeTruthy()

    const playerFrames = new Set(samples.map((sample) => sample.playerFrame))

    expect(
      playerFrames.size,
      `player frame never changed across ${samples.length} samples: ${[...playerFrames].join(', ')}`,
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
    // Measured before this spec: player 91.1px against boar 123.0px, while both
    // carried the same multiplier and the boar was the one further away. A box
    // comparison would have passed that.
    const heights = await page.evaluate(() => {
      const w = window as unknown as {
        __tutienPhaserGame?: { scene: { getScene(k: string): unknown } }
      }

      const scene = w.__tutienPhaserGame?.scene.getScene('CombatScene') as {
        sprites: Map<string, { row: number; personHeight?: number }>
        projection?: { gridToScreen(row: number, col: number): { scale: number } }
      }

      const at = (id: string) => {
        const s = scene.sprites.get(id)

        if (!s?.personHeight) return undefined

        // Normalise out perspective so two entities on different rows compare.
        const depth = scene.projection?.gridToScreen(s.row, 8).scale ?? 1

        return s.personHeight / depth
      }

      const enemyId = [...scene.sprites.keys()].find((k) => k !== 'player') as string

      return { player: at('player'), enemy: at(enemyId) }
    })

    expect(heights.player, 'player has no resolved person height').toBeDefined()
    expect(heights.enemy, 'enemy has no resolved person height').toBeDefined()

    expect(
      heights.player! / heights.enemy!,
      `player ${heights.player!.toFixed(1)}px vs enemy ${heights.enemy!.toFixed(1)}px, depth-normalised`,
    ).toBeCloseTo(1, 1)

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
