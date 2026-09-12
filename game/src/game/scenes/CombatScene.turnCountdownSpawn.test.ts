// CombatScene.turnCountdownSpawn.test.ts
// @vitest-environment jsdom
//
// Regression test (Turn-Based Wave Redesign, 2026-09-06) against
// reintroducing the "player invisible in combat" bug fixed 2026-09-06
// (f179a2b) via the new countdown-telegraph hide-then-reveal path.
import { describe, expect, it, vi } from 'vitest'
import { createTestScene, type CombatSceneTestView } from './combat/combatTestHarness'
import type { EntitySprite } from './combat/combatTypes'
import { spawnEnemySpawnVfx } from '@/game/support/EnemySpawnVfx'
import type { TurnBattleEntitySnapshotEvent } from '@/core/battle/turn/TurnActionPresentationEvents'

// Task 9 — telegraph interpolation: reconcileTurnCountdownSpawn() no longer
// writes progress straight onto the VFX handle. It stores a TARGET; the
// handle is chased toward that target every render frame inside update(),
// exactly like positionInterp already does for sprite X. `spawnEnemySpawnVfx`
// is mocked here (both CombatScene.ts and combat-vfx-spawner.ts import the
// same real Phaser-drawing implementation) so the test can observe the
// handle's progress directly via a spy instead of parsing Graphics calls.
vi.mock('@/game/support/EnemySpawnVfx', () => ({
  spawnEnemySpawnVfx: vi.fn(),
}))

interface SpyHandle {
  lastProgress: number
  update: (progress: number) => void
  complete: () => void
  destroy: () => void
}

/**
 * Scene stubbed just enough for reconcileTurnCountdownSpawn() +
 * update()/advanceTelegraph() — deliberately NOT going through
 * onTurnBattleEntitySnapshot(), which also drives reconcileCombatantSprites()
 * / reconcileSpawnVfx() (real sprite + gridView creation, unrelated to the
 * telegraph-interpolation behaviour this test targets and not exercised by
 * any existing test in this file).
 */
function makeSceneWithCountdown() {
  // 'construct' (default) so class-field initializers run (statuses,
  // sprites, dotAccumulators, castBar, turnCountdownSpawnVfxHandles, …) —
  // update() touches many of them and a bare Object.create() instance
  // would have none of them.
  const scene = createTestScene() as CombatSceneTestView

  scene.projection = {} // truthy — reconcileTurnCountdownSpawn only checks presence.
  scene.renderMode = 'flat' // isPerspective=false — resolveUprightVfxDepth skips gridToScreen.

  // Task 9 fix round — the telegraph now derives its segment duration from
  // `this.time.now` (real elapsed time), same as positionInterp, instead of
  // a per-frame delta. Must be stubbed BEFORE the first
  // reconcileTurnCountdownSpawn() call below, which already reads it.
  scene.time = { now: 0 }

  const handles: SpyHandle[] = []

  vi.mocked(spawnEnemySpawnVfx).mockImplementation(() => {
    const handle: SpyHandle = {
      lastProgress: 0,
      update(progress: number) {
        handle.lastProgress = progress
      },
      complete: vi.fn(),
      destroy: vi.fn(),
    }

    handles.push(handle)

    return handle
  })

  scene.reconcileTurnCountdownSpawn(snapshotWithProgress(0))

  return { scene, handles }
}

function snapshotWithProgress(countdownProgress: number): TurnBattleEntitySnapshotEvent {
  return {
    players: [
      { id: 'player', name: 'Player', row: 4, column: 8, currentHp: 100, maxHp: 100, alive: true, isBoss: false },
    ],
    enemies: [],
    pendingEnemySpawns: [],
    phase: 'countdown',
    countdownProgress,
  }
}

describe('CombatScene party countdown telegraph visibility', () => {
  it('entityVisual.applyGating keeps a pending id hidden and reveals a non-pending id', () => {
    // 'construct' so entityVisual is a real CombatEntityVisualLifecycle —
    // this drives the same call the 'create' branch of
    // reconcileCombatantSprites() makes.
    const scene = createTestScene() as CombatSceneTestView

    scene.entityVisual.markPending(['player'])

    const visible: Record<string, boolean | undefined> = {}
    const makeSprite = (id: string) => ({
      rect: { setVisible: (value: boolean) => { visible[id] = value } },
      label: { setVisible: () => {} },
    })

    scene.entityVisual.applyGating('player', makeSprite('player') as unknown as EntitySprite)
    scene.entityVisual.applyGating('companion_1', makeSprite('companion_1') as unknown as EntitySprite)

    expect(visible['player']).toBe(false)
    expect(visible['companion_1']).toBe(true)
  })
})

describe('CombatScene party pre-spawn gating (2026-09-12 fix)', () => {
  // User report: the player art sat on the field while its own spawn
  // telegraph still ran. Root cause: 'intro' snapshots carry
  // countdownProgress === undefined, which used to fall into the flush
  // branch (empty pending set -> no-op), leaving the 'create' branch of
  // reconcileCombatantSprites() free to reveal the sprite immediately.
  // The phase field now separates "not yet counting down" from
  // "countdown finished".
  it('intro-phase snapshots mark the party pending WITHOUT spawning telegraph handles', () => {
    const scene = createTestScene() as CombatSceneTestView

    scene.projection = {}
    scene.renderMode = 'flat'
    scene.time = { now: 0 }

    vi.mocked(spawnEnemySpawnVfx).mockClear()

    scene.reconcileTurnCountdownSpawn({
      players: [
        { id: 'player', name: 'Player', row: 4, column: 8, currentHp: 100, maxHp: 100, alive: true, isBoss: false },
      ],
      enemies: [],
      pendingEnemySpawns: [],
      phase: 'intro',
      countdownProgress: undefined,
    })

    // Marked pending (so 'create' keeps it hidden) but NO telegraph — the
    // countdown phase owns handle spawning, not the intro.
    expect(scene.entityVisual.pending.has('player')).toBe(true)
    expect(scene.turnCountdownSpawnVfxHandles.size).toBe(0)
    expect(vi.mocked(spawnEnemySpawnVfx)).not.toHaveBeenCalled()
  })

  it('intro-marked ids still materialize at the flush even without a handle', () => {
    const scene = createTestScene() as CombatSceneTestView

    scene.projection = {}
    scene.renderMode = 'flat'
    scene.time = { now: 0 }

    // Pending from the intro window with NO handle (projection wasn't
    // ready) — the flush must still reveal it, or the sprite stays
    // invisible for the whole battle.
    scene.entityVisual.markPending(['player'])

    const visible: Record<string, boolean | undefined> = {}
    const labelVisible: Record<string, boolean | undefined> = {}
    const barVisible: Record<string, { background?: boolean; fill?: boolean }> = {}
    const makeSprite = (id: string, withHealthBar = false) => ({
      rect: { setVisible: (value: boolean) => { visible[id] = value } },
      label: { setVisible: (value: boolean) => { labelVisible[id] = value } },
      ...(withHealthBar
        ? {
            healthBar: {
              background: { setVisible: (value: boolean) => { (barVisible[id] ??= {}).background = value } },
              fill: { setVisible: (value: boolean) => { (barVisible[id] ??= {}).fill = value } },
            },
          }
        : {}),
    })

    scene.sprites.set('player', makeSprite('player') as unknown as EntitySprite)
    // A companion materialized in the snapshot but never pending — e.g.
    // the scene rebinds mid-'fighting' and never saw the gating window.
    // onBattleStart() hid it; this flush is the only reveal it gets.
    // Companions carry a healthBar - regression lock for the 2026-09-12
    // "floating HP bar" bug: the whole sprite must reveal, not just rect.
    scene.sprites.set('companion_1', makeSprite('companion_1', true) as unknown as EntitySprite)

    scene.reconcileTurnCountdownSpawn({
      players: [
        { id: 'companion_1', name: 'Companion', row: 3, column: 8, currentHp: 50, maxHp: 50, alive: true, isBoss: false },
      ],
      enemies: [],
      pendingEnemySpawns: [],
      phase: 'fighting',
      countdownProgress: undefined,
    })

    expect(visible['player']).toBe(true)
    expect(visible['companion_1']).toBe(true)
    expect(labelVisible['player']).toBe(true)
    expect(labelVisible['companion_1']).toBe(true)
    expect(barVisible['companion_1']).toEqual({ background: true, fill: true })
    expect(scene.entityVisual.pending.size).toBe(0)
  })

  it('countdown-phase snapshots also hide pre-materialized enemies — the party telegraph stays player-only', () => {
    const scene = createTestScene() as CombatSceneTestView

    scene.projection = {}
    scene.renderMode = 'flat'
    scene.time = { now: 0 }

    vi.mocked(spawnEnemySpawnVfx).mockClear()

    // A direct startBattle() that skipped 'intro' reaches 'countdown'
    // carrying an already-materialized enemy — it must join the same
    // hidden window as the party, or it pops in mid-countdown while the
    // player is still telegraphing.
    scene.reconcileTurnCountdownSpawn({
      players: [
        { id: 'player', name: 'Player', row: 4, column: 8, currentHp: 100, maxHp: 100, alive: true, isBoss: false },
      ],
      enemies: [
        { id: 'enemy_1', name: 'Enemy', row: 1, column: 2, currentHp: 50, maxHp: 50, alive: true, isBoss: false },
      ],
      pendingEnemySpawns: [],
      phase: 'countdown',
      countdownProgress: 0.5,
    })

    expect(scene.entityVisual.pending.has('enemy_1')).toBe(true)
    // Pending, but NO handle — spawnEnemySpawnVfx ran only for the player.
    expect(scene.turnCountdownSpawnVfxHandles.has('enemy_1')).toBe(false)
    expect(scene.turnCountdownSpawnVfxHandles.size).toBe(1)
    expect(vi.mocked(spawnEnemySpawnVfx)).toHaveBeenCalledTimes(1)
  })
})

describe('CombatScene party countdown telegraph interpolation (Task 9)', () => {
  // Fix round (review Finding 2) — the previous version of this test drove
  // `scene.update(0, 200)` as its "settle" step, which only *looked* like it
  // proved convergence: the old exponential-chase formula computed
  // `rate = Math.min(1, 200 / 120)`, which is exactly 1 for ANY delta >= 120,
  // so that single call snapped straight to the target regardless of the
  // interpolation math being correct. It never exercised a realistic run of
  // ~16ms frames, so it could not have caught the old formula's two real
  // defects: it never reaches its target (asymptotic decay) and it closes a
  // different fraction of the remaining distance per wall-clock window at
  // different frame rates (not frame-rate independent, per design doc §4.4).
  //
  // This test instead advances `scene.time.now` in realistic ~16ms steps
  // (matching Phaser's own render cadence) and asserts BOTH that the shown
  // value moves on intermediate frames AND that it lands EXACTLY (not
  // approximately) on the target once the segment has fully elapsed —
  // mirroring what CombatPositionInterpolation.interpolate() already
  // guarantees for sprite X (combat-position-interpolation.ts).
  it('interpolates the telegraph across realistic ~16ms frames and lands exactly on target', () => {
    const { scene, handles } = makeSceneWithCountdown()
    const [handle] = handles

    // New snapshot target arrives 100ms after the countdown started — the
    // segment duration is derived from that real inter-snapshot cadence
    // (same pattern as applyPendingPositions/onPositions' pendingCadence).
    scene.time.now = 100
    scene.reconcileTurnCountdownSpawn(snapshotWithProgress(0.5))

    const frameMs = 16
    const samples: number[] = []

    // Six ~16ms frames land at t=116..196 — inside the [100, 200) segment
    // window, so every sample must be a distinct, strictly increasing value
    // strictly between the segment's from (0) and to (0.5).
    for (let i = 1; i <= 6; i++) {
      scene.time.now = 100 + i * frameMs
      scene.update(0, frameMs)
      samples.push(handle?.lastProgress ?? Number.NaN)
    }

    expect(samples[0]).toBeGreaterThan(0)
    expect(samples[0]).toBeLessThan(0.5)

    for (let i = 1; i < samples.length; i++) {
      const current = samples[i] ?? Number.NaN
      const previous = samples[i - 1] ?? Number.NaN

      expect(current).toBeGreaterThan(previous)
    }

    // Past the full segment duration — clamped progress = 1, so the shown
    // value must equal the target EXACTLY, not merely close to it.
    scene.time.now = 100 + 100 + frameMs
    scene.update(0, frameMs)
    expect(handle?.lastProgress).toBe(0.5)
  })

  it('is a no-op frame-rate-independent chase: the same real time elapsed reaches the same progress at any frame rate (design doc §4.4)', () => {
    // Two scenes, same 100ms-cadence snapshot, driven at two different frame
    // rates for the SAME ~48ms of real wall-clock time. Frame-rate
    // independence means both must show the identical progress afterwards —
    // the old per-frame `deltaMs`-decay formula closed a measurably
    // different fraction of the gap at 60Hz (~16.7ms frames) than at 144Hz
    // (~6.9ms frames) over a fixed wall-clock window; this must not.
    const sixtyHz = makeSceneWithCountdown()
    const oneFortyFourHz = makeSceneWithCountdown()

    for (const { scene } of [sixtyHz, oneFortyFourHz]) {
      scene.time.now = 100
      scene.reconcileTurnCountdownSpawn(snapshotWithProgress(0.5))
    }

    // Both scenes take a DIFFERENT number of frames of a DIFFERENT size to
    // get there (3 frames of ~16.7ms vs 7 of ~6.9ms — different paths), but
    // both explicitly land their final frame on the SAME absolute
    // `time.now`. Since progress is `(now - segmentStart) / segmentDuration`
    // (absolute elapsed time), not an accumulation of per-frame deltas, the
    // path taken must not matter — only where `now` ends up.
    let now = 100

    for (let i = 0; i < 3; i++) {
      now += 16.7
      sixtyHz.scene.time.now = now
      sixtyHz.scene.update(0, 16.7)
    }

    sixtyHz.scene.time.now = 150
    sixtyHz.scene.update(0, 150 - now)

    now = 100

    for (let i = 0; i < 7; i++) {
      now += 6.9
      oneFortyFourHz.scene.time.now = now
      oneFortyFourHz.scene.update(0, 6.9)
    }

    oneFortyFourHz.scene.time.now = 150
    oneFortyFourHz.scene.update(0, 150 - now)

    expect(sixtyHz.handles[0]?.lastProgress).toBe(oneFortyFourHz.handles[0]?.lastProgress)
  })

  it('resets the interpolation state when the countdown flushes, so a refight starts from zero', () => {
    const { scene, handles } = makeSceneWithCountdown()

    scene.time.now = 100
    scene.reconcileTurnCountdownSpawn(snapshotWithProgress(0.9))
    scene.time.now = 300
    scene.update(0, 16)
    expect(handles[0]?.lastProgress).toBeCloseTo(0.9, 2)

    // Countdown ends — flush path clears handles and must also zero the
    // interpolation state, or the next battle's telegraph would start
    // mid-way instead of from 0.
    scene.reconcileTurnCountdownSpawn({
      players: [],
      enemies: [],
      pendingEnemySpawns: [],
      phase: 'fighting',
      countdownProgress: undefined,
    })

    expect(scene.telegraphTarget).toBe(0)
    expect(scene.telegraphShown).toBe(0)
  })
})

describe('CombatScene party countdown telegraph scene-teardown reset (Task 9 fix round, Finding 1)', () => {
  it('clearSceneState() destroys leaked handles and zeroes the telegraph, so a scene re-entered mid-countdown starts from zero', () => {
    const { scene, handles } = makeSceneWithCountdown()

    // Player is mid-countdown (never reaches the undefined/flush branch —
    // that only fires when the countdown actually completes) when they
    // leave combat entirely. Phaser reuses the Scene instance across
    // stop/restart, so whatever this leaves behind is what the NEXT battle
    // in this scene inherits.
    scene.time.now = 100
    scene.reconcileTurnCountdownSpawn(snapshotWithProgress(0.9))
    scene.time.now = 300
    scene.update(0, 16)
    expect(handles[0]?.lastProgress).toBeGreaterThan(0)
    expect(scene.turnCountdownSpawnVfxHandles.size).toBe(1)
    expect(scene.entityVisual.pending.size).toBe(1)

    scene.clearSceneState()

    expect(handles[0]?.destroy).toHaveBeenCalled()
    expect(scene.turnCountdownSpawnVfxHandles.size).toBe(0)
    expect(scene.entityVisual.pending.size).toBe(0)
    expect(scene.telegraphTarget).toBe(0)
    expect(scene.telegraphShown).toBe(0)

    // Re-entry: a fresh countdown on the same (reused) scene instance must
    // read as starting from zero, not resuming the previous battle's value.
    scene.reconcileTurnCountdownSpawn(snapshotWithProgress(0))
    scene.update(0, 16)
    expect(scene.telegraphTarget).toBe(0)
  })
})
