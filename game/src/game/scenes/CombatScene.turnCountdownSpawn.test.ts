// CombatScene.turnCountdownSpawn.test.ts
// @vitest-environment jsdom
//
// Regression test (Turn-Based Wave Redesign, 2026-09-06) against
// reintroducing the "player invisible in combat" bug fixed 2026-09-06
// (f179a2b) via the new countdown-telegraph hide-then-reveal path.
import { describe, expect, it, vi } from 'vitest'
import { CombatScene } from './CombatScene'
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
    countdownProgress,
  }
}

describe('CombatScene party countdown telegraph visibility', () => {
  it('player/companion sprite stays hidden while countdownProgress is defined, and becomes visible once it is undefined', () => {
    const scene = Object.create(CombatScene.prototype) as CombatScene & {
      turnCountdownPendingIds: Set<string>
      sprites: Map<string, { rect: { setVisible: (visible: boolean) => void; visible?: boolean } }>
    }

    scene.turnCountdownPendingIds = new Set(['player'])

    let visible: boolean | undefined
    const rect = { setVisible: (value: boolean) => { visible = value } }

    scene.sprites = new Map([['player', { rect }]]) as unknown as Map<string, EntitySprite>

    // Simulate the 'create' branch's visibility line directly (unit-level,
    // no Phaser scene needed — same technique as CombatGridViewHost.test.ts).
    rect.setVisible(!scene.turnCountdownPendingIds.has('player'))
    expect(visible).toBe(false)

    // Countdown ends — reconcileTurnCountdownSpawn()'s flush path.
    scene.turnCountdownPendingIds.clear()
    rect.setVisible(true)
    expect(visible).toBe(true)
  })
})

describe('CombatScene party countdown telegraph interpolation (Task 9)', () => {
  it('interpolates the telegraph between snapshots instead of jumping', () => {
    const { scene, handles } = makeSceneWithCountdown()

    scene.reconcileTurnCountdownSpawn(snapshotWithProgress(0))
    scene.reconcileTurnCountdownSpawn(snapshotWithProgress(0.5))

    scene.update(0, 8)
    const [handle] = handles
    const midway = handle?.lastProgress

    expect(midway).toBeGreaterThan(0)
    expect(midway).toBeLessThan(0.5)

    scene.update(0, 200)
    expect(handle?.lastProgress).toBeCloseTo(0.5, 2)
  })

  it('resets the interpolation state when the countdown flushes, so a refight starts from zero', () => {
    const { scene, handles } = makeSceneWithCountdown()

    scene.reconcileTurnCountdownSpawn(snapshotWithProgress(0.9))
    scene.update(0, 200)
    expect(handles[0]?.lastProgress).toBeCloseTo(0.9, 2)

    // Countdown ends — flush path clears handles and must also zero the
    // interpolation state, or the next battle's telegraph would start
    // mid-way instead of from 0.
    scene.reconcileTurnCountdownSpawn({
      players: [],
      enemies: [],
      pendingEnemySpawns: [],
      countdownProgress: undefined,
    })

    expect(scene.telegraphTarget).toBe(0)
    expect(scene.telegraphShown).toBe(0)
  })
})
