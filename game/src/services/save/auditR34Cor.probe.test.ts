// @vitest-environment node
// @ts-expect-error project omits Node ambient types by design (pattern: deadReferences.test.ts)
import { readFileSync } from 'node:fs'
// @ts-expect-error see above
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

// BETA SCOPE LOCK v2 - same seam as the r20-r33 probes: exercise the
// enabled implementation paths, not the dormant scope-hidden shells.
vi.mock('../../core/betaScope', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../core/betaScope')>()),
  isBetaFeature: () => true,
  isScopeHidden: () => false,
}))

import { createPinia, setActivePinia } from 'pinia'
import { createDefaultPlayer } from '../../core/player/Player'
import { GameManager } from '../../core/game/GameManager'
import { primeMortalCreationPick } from './GameSave.fixture'
import { buildGameSave } from './SaveSystem'
import { validateGameSaveShape } from './saveShapeValidation'
import type { GameSave } from './saveTypes'
import { useAppLifecycle } from '../../composables/useAppLifecycle'
import { advanceWorkerLanes } from '../../core/production/WorkerLaneAdvance'
import { THANH_VAN_PRODUCTION_SITES } from '../../core/production/ProductionCatalog'
import {
  CYCLE_BASE_SECONDS_BY_REALM,
  computeCycleSeconds,
} from '../../core/production/ProductionBalance'
import type { ProductionCycle } from '../../core/production/ProductionTypes'
import { materials } from '../../data/materials/materials'
import { equipment } from '../../data/equipment/equipment'
import { affixes } from '../../data/equipment/affixes'
import { buildings } from '../../data/building/buildings'
import { pills } from '../../data/pill/pills'
import { alchemyRecipes } from '../../data/alchemy/alchemyRecipes'
import { ManualClockSource } from '../../core/battle/turn/CombatClock'
import { defineEnemy } from '../../core/enemy/Enemy'
import { createBaseStats } from '../../core/stats/StatBlock'
import { CENTER_LANE_INDEX } from '../../core/battle/BattleLane'
import type { CombatEntity } from '../../core/combat/CombatEntity'
import type {
  CloudSaveLoadResult,
  CloudSaveWriteResult,
} from '../../services/cloudSave/CloudSaveService'

// ============================================================================
// QA probe - fixpoint r34 COR wave. Audits the r33 adjudication batch at
// db694183 (codex/hoa-cau-fireball-vfx):
//
//   (A) POST-ADMISSION UNLATCH - CLAIM CHECKED: simPaused re-baselines at
//       entry (:346) while resumeCombat('authority-pause') moved to the
//       success tail after authority.markReady() (:731-736). Enumerates
//       EVERY bootGame exit arm between them and asserts the reason stays
//       latched and enterGame is never reached.
//   (B) SIBLING-REASON PRESERVATION - the success-tail resume deletes only
//       'authority-pause'; tab-hidden / user-pause / not-revealed latches
//       survive a successful re-boot untouched.
//   (C) GHOST BATTLE SEAM (adjacent): a live battle frozen under
//       'authority-pause' survives the 'deleted'/requireCharacter arm, and
//       the NEXT successful boot's unlatch resumes that stale battle inside
//       a freshly created character's session - the requireCharacter arm
//       never abandons the in-flight battle.
//   (D) POST-MARKREADY TAIL: markReady ran, the latch cleared, and a sync
//       throw in clock.start()/enterGame leaves combat unfrozen with no
//       entry - the only exit arm that clears the reason without entering.
//   (E) Source pin on the success-tail ordering.
//   (F) INVERTED-PAIR DROP PARITY - boundary matrix for the flatMap arm:
//       -1/-0/+0/2^52-1/2^52, zero-span, NaN, +-Infinity; honest pairs park
//       or shift exactly as the .map arm did; the drop arm also eats rows
//       whose stamps are out-of-domain (the <= test wins over the
//       park-verbatim doctrine - safe direction, claim precision only).
//   (G) SLOT ACCOUNTING - a dropped lane frees a lane for the same-tick
//       re-seed (observe mode seeds before settling); surviving cycles keep
//       input order; assignedWorkers scalar is unrelated to cycle count.
//   (H) Mechanism re-pin: advanceWorkerLanes still ordering-denies a
//       restore-bypassing inverted feed.
//
// ASCII only (P15).
// ============================================================================

let currentMs = 1_725_160_000_000
const BOUND = 2 ** 52
const SITE_ID = THANH_VAN_PRODUCTION_SITES[0]!.siteId
const MORTAL_BASE_SECONDS = CYCLE_BASE_SECONDS_BY_REALM.mortal!
const MORTAL_CYCLE_MS = computeCycleSeconds(MORTAL_BASE_SECONDS, 1) * 1000

function registeredManager(): GameManager {
  const manager = new GameManager()
  manager.catalogOps.registerMaterials(materials)
  manager.catalogOps.registerEquipment(equipment)
  manager.catalogOps.registerAffixes(affixes)
  manager.catalogOps.registerBuildings(buildings)
  manager.catalogOps.registerPills(pills)
  manager.catalogOps.registerAlchemyRecipes(alchemyRecipes)
  return manager
}

function validWireSave(): GameSave {
  const writer = registeredManager()
  const player = createDefaultPlayer()
  writer.setActivePlayer(player)
  primeMortalCreationPick(player, writer.skillManager)
  return JSON.parse(JSON.stringify(buildGameSave(player, writer))) as GameSave
}

/** Production-side save shape needs the site's host building + capacity. */
function productionSiteWire(save: GameSave, cycles: ProductionCycle[]): GameSave {
  save.buildings = [
    { instanceId: 'bld_chq', buildingId: 'chi_hien_quan', level: 1, lastCollectedAt: 0 },
  ] as never
  ;(save.player as unknown as Record<string, unknown>).autoWorkerCapacity = 3
  save.productionSites = [
    {
      siteId: SITE_ID,
      level: 1,
      autoRestart: true,
      activeWorkerSlots: 1,
      workerCycles: cycles,
    },
  ] as never
  return save
}

function workerCycle(startedAtMs: number, completesAtMs: number, cycleId = 'cyc_probe'): ProductionCycle {
  return {
    cycleId,
    siteId: SITE_ID,
    collectionRealmId: 'mortal',
    siteLevelAtStart: 1,
    rewardTableVersion: 1,
    rollSeed: 1,
    startedAtMs,
    completesAtMs,
  }
}

function barePlayer(): CombatEntity {
  const stats = createBaseStats({ might: 0 })

  return {
    id: 'player',
    name: 'Player',
    type: 'player',
    baseStats: stats,
    stats,
    currentHp: stats.maxHp,
    maxHp: stats.maxHp,
    currentMp: stats.maxMp,
    currentWard: 0,
    turnsSinceLastHitLanded: Infinity,
    realmIndex: 0,
    x: 0,
    row: CENTER_LANE_INDEX,
    alive: true,
  }
}

function dummyEnemy() {
  return defineEnemy({
    id: 'r34_dummy',
    name: 'Dummy',
    level: 1,
    realmId: 'mortal',
    lane: 'ground',
    statsInput: {
      maxHp: 100_000,
      might: 0,
      attackSpeed: 1,
      criticalRate: 0,
      criticalDamage: 1.5,
      armor: 0,
    },
    rewards: { techniqueMastery: 0, spiritStone: 0 },
  })
}

function okLoad(): CloudSaveLoadResult {
  return {
    status: 'ok',
    save: validWireSave(),
    discardedEquipmentCount: 0,
    raw: '{}',
    revision: 1,
  }
}

const OK_SAVE: CloudSaveWriteResult = { status: 'ok', revision: 1 }

// ----------------------------------------------------------------------------
// Lifecycle harness: mirrors App.vue wiring with every seam mockable AFTER
// the first boot - coordinator.load / player.save / restoreGameSession are
// vi.fn()s the tests re-impl per arm. ManualClockSource keeps combat frames
// deterministic.
// ----------------------------------------------------------------------------

function lifecycleHarness(options: { capability?: 'local' | 'remote-authoritative' } = {}) {
  const capability = options.capability ?? 'local'
  const entryStage = ref('auth')
  let nextHandle = 1
  const liveIntervals = new Set<number>()
  const gameManager = registeredManager()
  const manualSource = new ManualClockSource()
  gameManager.setCombatClockSource(manualSource)
  const playerState = createDefaultPlayer()

  const boot = {
    startInitializing: vi.fn(),
    startSaveLoad: vi.fn(),
    requireCharacter: vi.fn(() => {
      entryStage.value = 'character'
    }),
    enterGame: vi.fn(() => {
      entryStage.value = 'game'
    }),
    showAuth: vi.fn(() => {
      entryStage.value = 'auth'
    }),
    fail: vi.fn(() => {
      entryStage.value = 'error'
    }),
  }
  const deps = {
    clock: {
      start: vi.fn(),
      stop: vi.fn(),
      nowSeconds: () => 0,
    },
    scheduleInterval: (_fn: () => void, _ms: number) => {
      const handle = nextHandle
      nextHandle += 1
      liveIntervals.add(handle)
      return handle
    },
    clearHandle: (handle: number) => {
      liveIntervals.delete(handle)
    },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    boot,
    coordinator: {
      capability,
      load: vi.fn(async () => okLoad()),
      save: vi.fn(),
      reset: vi.fn(async () => undefined),
    },
    authority: {
      canMutate: () => true,
      beginChecking: vi.fn(),
      markReady: vi.fn(),
      markFailed: vi.fn(),
      observeSaveResult: vi.fn(),
    },
    player: {
      save: vi.fn(async () => OK_SAVE),
      $state: playerState,
    },
    gameManager,
    tick: vi.fn(),
    offlineSummary: { show: vi.fn() },
    saveIssue: { report: vi.fn(), clear: vi.fn() },
    entryStage,
    restoreGameSession: vi.fn(() => ({ status: 'ok' })),
    persistPlayer: vi.fn(async () => ({ status: 'ok' })),
    onError: vi.fn(),
    unsupportedSaveNotice: vi.fn(),
    hardReset: vi.fn(),
  }
  const lifecycle = useAppLifecycle(deps as never)
  return {
    lifecycle,
    entryStage,
    liveIntervals,
    gameManager,
    deps,
    boot,
    playerState,
    manualSource,
  }
}

/**
 * Reach the r33-scenario pre-state: a live battle frozen under
 * 'authority-pause' after a successful boot. Every arm probe starts here.
 * For remote capability the first boot also runs the post-accrual commit
 * leg on the default ok save.
 */
async function latchAuthorityPause(h: ReturnType<typeof lifecycleHarness>) {
  expect(
    (await h.lifecycle.bootGame({ createNewCharacter: false })).status,
  ).toBe('entered')
  h.gameManager.startBattle(barePlayer(), dummyEnemy())
  expect(h.gameManager.getCombatClockState()).toBe('running')
  h.lifecycle.pauseSimulation()
  expect(h.gameManager.getCombatClockState()).toBe('frozen')
  expect(h.gameManager.getFreezeReasons()).toEqual(['authority-pause'])
}

/** Every assertion the latch contract makes about a non-entered arm. */
function assertLatchHeld(
  h: ReturnType<typeof lifecycleHarness>,
  enteredCalls = 1,
  markReadyCalls = 1,
) {
  expect(h.gameManager.getCombatClockState()).toBe('frozen')
  expect(h.gameManager.getFreezeReasons()).toEqual(['authority-pause'])
  expect(h.boot.enterGame).toHaveBeenCalledTimes(enteredCalls)
  expect(h.deps.authority.markReady).toHaveBeenCalledTimes(markReadyCalls)

  const steps = h.gameManager.getElapsedCombatSteps()
  h.manualSource.advance(1)
  expect(h.gameManager.getElapsedCombatSteps()).toBe(steps)
}

function setLoad(h: ReturnType<typeof lifecycleHarness>, result: () => CloudSaveLoadResult | Promise<CloudSaveLoadResult>) {
  ;(h.deps.coordinator.load as ReturnType<typeof vi.fn>).mockImplementation(
    async () => await result(),
  )
}

function setSave(h: ReturnType<typeof lifecycleHarness>, result: () => Promise<CloudSaveWriteResult>) {
  ;(h.deps.player.save as ReturnType<typeof vi.fn>).mockImplementation(async () => await result())
}

beforeEach(() => {
  setActivePinia(createPinia())
  currentMs = 1_725_160_000_000
  vi.spyOn(Date, 'now').mockImplementation(() => currentMs)
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ----------------------------------------------------------------------------
// (A) Exit-arm enumeration: every return path between the :346 re-baseline
//     and the :729 admission keeps 'authority-pause' latched and never
//     reaches enterGame.
// ----------------------------------------------------------------------------

describe('r34 COR - A: every boot exit arm keeps the authority-pause latch', () => {
  it('A1 load unavailable -> failed: latch held, no enterGame', async () => {
    const h = lifecycleHarness()
    await latchAuthorityPause(h)
    setLoad(h, () => ({
      status: 'unavailable',
      code: 'SERVER_ERROR',
      message: 'load failed',
      retryable: true,
    }))
    h.boot.showAuth()
    expect((await h.lifecycle.bootGame({ createNewCharacter: false })).status).toBe('failed')
    expect(h.boot.fail).toHaveBeenCalled()
    assertLatchHeld(h)
  })

  it('A2 load incompatible -> failed via saveIssue arm', async () => {
    const h = lifecycleHarness()
    await latchAuthorityPause(h)
    setLoad(h, () => ({ status: 'incompatible', raw: '{', foundVersion: 3 }) as never)
    h.boot.showAuth()
    expect((await h.lifecycle.bootGame({ createNewCharacter: false })).status).toBe('failed')
    expect(h.deps.saveIssue.report).toHaveBeenCalled()
    assertLatchHeld(h)
  })

  it('A3 load corrupted -> failed via saveIssue arm', async () => {
    const h = lifecycleHarness()
    await latchAuthorityPause(h)
    setLoad(h, () => ({ status: 'corrupted', raw: '{' }) as never)
    h.boot.showAuth()
    expect((await h.lifecycle.bootGame({ createNewCharacter: false })).status).toBe('failed')
    assertLatchHeld(h)
  })

  it('A4 load pending-conflict -> failed via quarantine surface', async () => {
    const h = lifecycleHarness({ capability: 'remote-authoritative' })
    await latchAuthorityPause(h)
    setLoad(h, () => ({ status: 'pending-conflict', currentRevision: 4, pendingRaw: '{}' }) as never)
    h.boot.showAuth()
    expect((await h.lifecycle.bootGame({ createNewCharacter: false })).status).toBe('failed')
    assertLatchHeld(h)
  })

  it('A5 load pending-quarantined -> failed via quarantine surface', async () => {
    const h = lifecycleHarness({ capability: 'remote-authoritative' })
    await latchAuthorityPause(h)
    setLoad(h, () => ({ status: 'pending-quarantined', reason: 'uncommittable', pendingRaw: '{}' }) as never)
    h.boot.showAuth()
    expect((await h.lifecycle.bootGame({ createNewCharacter: false })).status).toBe('failed')
    assertLatchHeld(h)
  })

  it('A6 load deleted -> require-character (no fail card, latch still held)', async () => {
    const h = lifecycleHarness({ capability: 'remote-authoritative' })
    await latchAuthorityPause(h)
    setLoad(h, () => ({ status: 'deleted' }) as never)
    h.boot.showAuth()
    expect((await h.lifecycle.bootGame({ createNewCharacter: false })).status).toBe('require-character')
    expect(h.boot.requireCharacter).toHaveBeenCalled()
    assertLatchHeld(h)
  })

  it('A7 load empty + no create flag -> require-character', async () => {
    const h = lifecycleHarness()
    await latchAuthorityPause(h)
    setLoad(h, () => ({ status: 'empty', revision: 0 }) as never)
    h.boot.showAuth()
    expect((await h.lifecycle.bootGame({ createNewCharacter: false })).status).toBe('require-character')
    assertLatchHeld(h)
  })

  it('A8 restore preflight rejected -> failed via recovery surface', async () => {
    const h = lifecycleHarness()
    await latchAuthorityPause(h)
    ;(h.deps.restoreGameSession as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      status: 'rejected',
      message: 'preflight denied',
    }))
    h.boot.showAuth()
    expect((await h.lifecycle.bootGame({ createNewCharacter: false })).status).toBe('failed')
    assertLatchHeld(h)
  })

  it('A9 remote commit data-refuse (SAVE_INVALID non-retryable) -> failed', async () => {
    const h = lifecycleHarness({ capability: 'remote-authoritative' })
    await latchAuthorityPause(h)
    setSave(h, async () => ({
      status: 'unavailable',
      message: 'refused',
      retryable: false,
      code: 'SAVE_INVALID',
    }) as never)
    h.boot.showAuth()
    expect((await h.lifecycle.bootGame({ createNewCharacter: false })).status).toBe('failed')
    assertLatchHeld(h)
  })

  it('A10 remote commit generic refuse (retryable) -> failed via onError', async () => {
    const h = lifecycleHarness({ capability: 'remote-authoritative' })
    await latchAuthorityPause(h)
    setSave(h, async () => ({ status: 'unavailable', message: 'flaky', retryable: true }) as never)
    h.boot.showAuth()
    expect((await h.lifecycle.bootGame({ createNewCharacter: false })).status).toBe('failed')
    expect(h.deps.onError).toHaveBeenCalled()
    assertLatchHeld(h)
  })

  it('A11 remote commit CAS conflict -> failed', async () => {
    const h = lifecycleHarness({ capability: 'remote-authoritative' })
    await latchAuthorityPause(h)
    setSave(h, async () => ({ status: 'conflict', currentRevision: 9 }) as never)
    h.boot.showAuth()
    expect((await h.lifecycle.bootGame({ createNewCharacter: false })).status).toBe('failed')
    assertLatchHeld(h)
  })

  it('A12 remote uninitialized + firstSave data-refuse -> failed', async () => {
    const h = lifecycleHarness({ capability: 'remote-authoritative' })
    await latchAuthorityPause(h)
    setLoad(h, () => ({
      status: 'uninitialized',
      character: { characterId: 'c1', name: 'n' },
      revision: 0,
    }) as never)
    setSave(h, async () => ({
      status: 'unavailable',
      message: 'refused',
      retryable: false,
      code: 'SAVE_TOO_LARGE',
    }) as never)
    h.boot.showAuth()
    expect((await h.lifecycle.bootGame({ createNewCharacter: true })).status).toBe('failed')
    assertLatchHeld(h)
  })

  it('A13 remote uninitialized + grant-phase throw -> failed via catch arm', async () => {
    const h = lifecycleHarness({ capability: 'remote-authoritative' })
    await latchAuthorityPause(h)
    setLoad(h, () => ({
      status: 'uninitialized',
      character: { characterId: 'c1', name: 'n' },
      revision: 0,
    }) as never)
    h.boot.showAuth()
    expect(
      (
        await h.lifecycle.bootGame({
          createNewCharacter: true,
          onNewCharacter: () => {
            throw new Error('grant injected fault')
          },
        })
      ).status,
    ).toBe('failed')
    assertLatchHeld(h)
  })

  it('A14 remote uninitialized + firstSave throw -> failed via catch arm', async () => {
    const h = lifecycleHarness({ capability: 'remote-authoritative' })
    await latchAuthorityPause(h)
    setLoad(h, () => ({
      status: 'uninitialized',
      character: { characterId: 'c1', name: 'n' },
      revision: 0,
    }) as never)
    setSave(h, async () => {
      throw new Error('save injected fault')
    })
    h.boot.showAuth()
    expect((await h.lifecycle.bootGame({ createNewCharacter: true })).status).toBe('failed')
    assertLatchHeld(h)
  })

  it('A15 generation fence: stopAll inside the load await -> skipped, latch held', async () => {
    const h = lifecycleHarness()
    await latchAuthorityPause(h)
    setLoad(h, async () => {
      h.lifecycle.stopAll()
      return okLoad()
    })
    h.boot.showAuth()
    expect((await h.lifecycle.bootGame({ createNewCharacter: false })).status).toBe('skipped')
    assertLatchHeld(h)
  })

  it('A16 bootInFlight: a second boot call while the first is pending -> skipped, latch held', async () => {
    const h = lifecycleHarness()
    await latchAuthorityPause(h)
    let release: (r: CloudSaveLoadResult) => void = () => undefined
    const gate = new Promise<CloudSaveLoadResult>((resolve) => {
      release = resolve
    })
    setLoad(h, () => gate)
    h.boot.showAuth()

    const first = h.lifecycle.bootGame({ createNewCharacter: false })
    const second = await h.lifecycle.bootGame({ createNewCharacter: false })
    expect(second.status).toBe('skipped')
    assertLatchHeld(h)

    release({ status: 'unavailable', message: 'x', retryable: true })
    expect((await first).status).toBe('failed')
    assertLatchHeld(h)
  })

  it('A17 grants-applied retry -> hardReset + skipped, latch held', async () => {
    const h = lifecycleHarness({ capability: 'remote-authoritative' })
    await latchAuthorityPause(h)
    setLoad(h, () => ({
      status: 'uninitialized',
      character: { characterId: 'c1', name: 'n' },
      revision: 0,
    }) as never)
    setSave(h, async () => ({ status: 'unavailable', message: 'flaky', retryable: true }) as never)
    h.boot.showAuth()

    // Boot A marks the grant transaction dirty then fails firstSave.
    expect((await h.lifecycle.bootGame({ createNewCharacter: true })).status).toBe('failed')
    assertLatchHeld(h)

    // Boot B with create=true must take the hardReset arm, never re-grant.
    expect((await h.lifecycle.bootGame({ createNewCharacter: true })).status).toBe('skipped')
    expect(h.deps.hardReset).toHaveBeenCalled()
    assertLatchHeld(h)
  })

  it('A18 contrast: a successful re-boot clears the latch and resumes the battle', async () => {
    const h = lifecycleHarness()
    await latchAuthorityPause(h)
    h.boot.showAuth()
    expect((await h.lifecycle.bootGame({ createNewCharacter: false })).status).toBe('entered')
    expect(h.deps.authority.markReady).toHaveBeenCalledTimes(2)
    expect(h.gameManager.getFreezeReasons()).toEqual([])
    expect(h.gameManager.getCombatClockState()).toBe('running')

    const steps = h.gameManager.getElapsedCombatSteps()
    h.manualSource.advance(1)
    expect(h.gameManager.getElapsedCombatSteps()).toBeGreaterThan(steps)
  })
})

// ----------------------------------------------------------------------------
// (B) Sibling reasons: the success-tail unlatch is scoped to
//     'authority-pause'; every other freeze reason survives.
// ----------------------------------------------------------------------------

describe('r34 COR - B: post-markReady unlatch preserves sibling reasons', () => {
  for (const sibling of ['tab-hidden', 'user-pause', 'not-revealed'] as const) {
    it(`successful re-boot keeps the '${sibling}' latch frozen`, async () => {
      const h = lifecycleHarness()
      await latchAuthorityPause(h)
      h.gameManager.freezeCombat(sibling)
      expect(h.gameManager.getFreezeReasons()).toEqual(['authority-pause', sibling])
      h.boot.showAuth()
      expect((await h.lifecycle.bootGame({ createNewCharacter: false })).status).toBe('entered')
      expect(h.gameManager.getFreezeReasons()).toEqual([sibling])
      expect(h.gameManager.getCombatClockState()).toBe('frozen')
    })
  }

  it('no latch + no battle: resumeCombat is a true no-op on a stopped clock', async () => {
    const h = lifecycleHarness()
    expect(h.gameManager.getCombatClockState()).toBe('stopped')
    expect((await h.lifecycle.bootGame({ createNewCharacter: false })).status).toBe('entered')
    expect(h.gameManager.getCombatClockState()).toBe('stopped')
    expect(h.gameManager.getFreezeReasons()).toEqual([])
  })

  it('resumeSimulation after a cleared re-boot is a no-op (flag was re-baselined)', async () => {
    const h = lifecycleHarness()
    await latchAuthorityPause(h)
    h.boot.showAuth()
    expect((await h.lifecycle.bootGame({ createNewCharacter: false })).status).toBe('entered')
    expect(h.lifecycle.isSimPaused()).toBe(false)
    h.gameManager.freezeCombat('user-pause')
    h.lifecycle.resumeSimulation()
    // The flag being false makes resumeSimulation return early - it must
    // not touch the user-pause latch it never owned.
    expect(h.gameManager.getFreezeReasons()).toEqual(['user-pause'])
  })
})

// ----------------------------------------------------------------------------
// (C) Adjacent seam: the stale battle across requireCharacter -> create.
// ----------------------------------------------------------------------------

describe('r34 COR - C: requireCharacter arm never abandons the in-flight battle', () => {
  it('the stale latched battle survives creation and RESUMES on the next successful unlatch', async () => {
    const h = lifecycleHarness()
    await latchAuthorityPause(h)
    const staleBattle = h.gameManager.getTurnBattle()
    expect(staleBattle).not.toBeNull()

    // Arm: the row was deleted -> requireCharacter. The latch holds
    // through the creation surface - the battle stays frozen.
    setLoad(h, () => ({ status: 'deleted' }) as never)
    h.boot.showAuth()
    expect((await h.lifecycle.bootGame({ createNewCharacter: false })).status).toBe(
      'require-character',
    )
    assertLatchHeld(h)
    expect(h.gameManager.getTurnBattle()).toBe(staleBattle)

    // The create boot (local synthetic empty - load never consulted)
    // commits firstSave and reaches the success tail: the unlatch clears
    // 'authority-pause' on the SAME clock the stale battle still owns.
    expect(
      (
        await h.lifecycle.bootGame({
          createNewCharacter: true,
          onNewCharacter: vi.fn(),
        })
      ).status,
    ).toBe('entered')
    expect(h.gameManager.getFreezeReasons()).toEqual([])
    expect(h.gameManager.getCombatClockState()).toBe('running')

    // The resumed clock drives the STALE battle - never abandoned, its
    // steps land inside the new character's session.
    expect(h.gameManager.getTurnBattle()).toBe(staleBattle)
    const steps = h.gameManager.getElapsedCombatSteps()
    h.manualSource.advance(2)
    expect(h.gameManager.getElapsedCombatSteps()).toBeGreaterThan(steps)

    // The ghost only dies when a fresh battle replaces it
    // (beginBattleCycle's stop()+start() clears everything).
    h.gameManager.startBattle(barePlayer(), dummyEnemy())
    expect(h.gameManager.getTurnBattle()).not.toBe(staleBattle)
  })
})

// ----------------------------------------------------------------------------
// (D) Post-markReady tail: admission opened, the latch cleared, then a sync
//     throw in clock.start()/enterGame leaves combat unfrozen with no
//     entry - the only exit path that clears the reason without entering.
// ----------------------------------------------------------------------------

describe('r34 COR - D: post-markReady tail throw leaves combat unlatched', () => {
  it('clock.start throwing after admission clears the latch and never enters', async () => {
    const h = lifecycleHarness()
    await latchAuthorityPause(h)
    h.boot.showAuth()
    ;(h.deps.clock.start as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('injected tail fault')
    })
    await expect(h.lifecycle.bootGame({ createNewCharacter: false })).rejects.toThrow(
      'injected tail fault',
    )

    // markReady ran (admission opened), the unlatch already fired, and
    // enterGame still shows only the FIRST boot's call: the combat clock
    // now runs behind a non-game surface with no re-latch path.
    expect(h.deps.authority.markReady).toHaveBeenCalledTimes(2)
    expect(h.boot.enterGame).toHaveBeenCalledTimes(1)
    expect(h.gameManager.getFreezeReasons()).toEqual([])
    expect(h.gameManager.getCombatClockState()).toBe('running')
    const steps = h.gameManager.getElapsedCombatSteps()
    h.manualSource.advance(1)
    expect(h.gameManager.getElapsedCombatSteps()).toBeGreaterThan(steps)
  })

  it('boot.enterGame throwing after admission leaves the same unlatched shape', async () => {
    const h = lifecycleHarness()
    await latchAuthorityPause(h)
    h.boot.showAuth()
    ;(h.boot.enterGame as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('injected enterGame fault')
    })
    await expect(h.lifecycle.bootGame({ createNewCharacter: false })).rejects.toThrow(
      'injected enterGame fault',
    )
    expect(h.deps.authority.markReady).toHaveBeenCalledTimes(2)
    expect(h.gameManager.getFreezeReasons()).toEqual([])
    expect(h.gameManager.getCombatClockState()).toBe('running')
  })
})

// ----------------------------------------------------------------------------
// (E) Source pin: ordering inside the success tail.
// ----------------------------------------------------------------------------

describe('r34 COR - E: source pin on the unlatch ordering', () => {
  it('resumeCombat sits after markReady and before clock.start/enterGame', () => {
    const source = readFileSync(
      fileURLToPath(new URL('../../composables/useAppLifecycle.ts', import.meta.url)),
      'utf-8',
    )
    const tail = source.indexOf('authority.markReady()')
    const unlatch = source.indexOf("gameManager.resumeCombat('authority-pause')", tail)
    const clockStart = source.indexOf('clock.start()', unlatch)
    const enterGame = source.indexOf('boot.enterGame()', unlatch)
    expect(tail).toBeGreaterThan(-1)
    expect(unlatch).toBeGreaterThan(tail)
    expect(clockStart).toBeGreaterThan(unlatch)
    expect(enterGame).toBeGreaterThan(clockStart)

    // The entry re-baseline still precedes every arm.
    const baseline = source.indexOf('simPaused = false', source.indexOf('async function bootGame'))
    expect(baseline).toBeGreaterThan(-1)
    expect(baseline).toBeLessThan(tail)
  })
})

// ----------------------------------------------------------------------------
// (F) restoreStates boundary matrix for the flatMap arm.
// ----------------------------------------------------------------------------

function restoreCycles(cycles: ProductionCycle[], restoreNow = currentMs): ProductionCycle[] {
  const manager = registeredManager()
  manager.productionSystem.restoreStates(
    [
      {
        siteId: SITE_ID,
        level: 1,
        autoRestart: true,
        activeWorkerSlots: 1,
        workerCycles: cycles,
      },
    ] as never,
    restoreNow,
  )
  return manager.productionSystem.getState(SITE_ID)!.workerCycles!
}

describe('r34 COR - F: flatMap arm boundary matrix', () => {
  const NOW = 1_725_160_000_000
  const rows: Array<{
    name: string
    started: number
    completes: number
    expect: 'drop' | 'park' | 'shift'
  }> = [
    { name: 'neg pair {-1,-1}', started: -1, completes: -1, expect: 'drop' },
    { name: 'zero-span {0,0}', started: 0, completes: 0, expect: 'drop' },
    { name: 'zero-span {-0,+0}', started: -0, completes: +0, expect: 'drop' },
    { name: 'zero-span {+0,-0}', started: +0, completes: -0, expect: 'drop' },
    { name: 'equal in-domain {T,T}', started: NOW - 1000, completes: NOW - 1000, expect: 'drop' },
    { name: 'inverted {T,T-1}', started: NOW - 500, completes: NOW - 501, expect: 'drop' },
    { name: 'started=0 completes=1 (ordered, not inverted)', started: 0, completes: 1, expect: 'park' },
    { name: 'max-domain equal {B-1,B-1}', started: BOUND - 1, completes: BOUND - 1, expect: 'drop' },
    { name: 'equal at bound {B,B} - inverted test eats out-of-domain', started: BOUND, completes: BOUND, expect: 'drop' },
    { name: '{-Inf,-Inf} - inverted test eats both-inf', started: -Infinity, completes: -Infinity, expect: 'drop' },
    { name: '{+Inf,+Inf}', started: Infinity, completes: Infinity, expect: 'drop' },
    { name: 'in-domain started + -Inf completes', started: 5, completes: -Infinity, expect: 'drop' },
    { name: '+Inf started + real completes', started: Infinity, completes: NOW + 5000, expect: 'drop' },
    { name: '-Inf started + real completes (not inverted)', started: -Infinity, completes: 5, expect: 'park' },
    { name: 'NaN pair', started: NaN, completes: NaN, expect: 'park' },
    { name: 'NaN started', started: NaN, completes: NOW, expect: 'park' },
    { name: 'NaN completes', started: NOW - 1000, completes: NaN, expect: 'park' },
    { name: 'real started + +Inf completes (not inverted; headroom deny)', started: NOW + 1000, completes: Infinity, expect: 'park' },
    { name: 'post-dated + over-bound span (headroom deny)', started: NOW + 1000, completes: NOW + 1000 + BOUND, expect: 'park' },
    { name: 'honest due pair parks verbatim', started: NOW - 2000, completes: NOW - 1000, expect: 'park' },
    { name: 'honest in-flight parks verbatim', started: NOW - 500, completes: NOW + 500, expect: 'park' },
    { name: 'post-dated honest pair shifts', started: NOW + 1000, completes: NOW + 2000, expect: 'shift' },
    { name: 'post-dated crafted 1ms span at B-1 shifts', started: BOUND - 1, completes: BOUND, expect: 'shift' },
    { name: 'post-dated near-bound 2ms span shifts', started: BOUND - 2, completes: BOUND - 1, expect: 'shift' },
  ]

  for (const row of rows) {
    it(`${row.name} -> ${row.expect}`, () => {
      const [cycle] = restoreCycles([workerCycle(row.started, row.completes)])
      if (row.expect === 'drop') {
        expect(cycle).toBeUndefined()
      } else if (row.expect === 'park') {
        expect(cycle).toBeDefined()
        expect(cycle!.startedAtMs).toBe(row.started)
        expect(cycle!.completesAtMs).toBe(row.completes)
      } else {
        expect(cycle).toBeDefined()
        // The authored span is preserved exactly across the re-ground.
        expect(cycle!.completesAtMs - cycle!.startedAtMs).toBe(row.completes - row.started)
        expect(cycle!.startedAtMs).toBe(currentMs)
      }
    })
  }

  it('drop also eats mixed-domain inverted rows: "out-of-domain parks verbatim" is not total', () => {
    // The comment claims out-of-domain stamps still park; the <= test
    // runs first and drops any pair that is also inverted, INCLUDING
    // pairs whose stamps are outside [0, 2^52). Safe direction (a drop
    // is strictly less harmful than a parked wedge), but the doctrine
    // text overstates park coverage.
    expect(restoreCycles([workerCycle(BOUND, BOUND)])).toHaveLength(0)
    expect(restoreCycles([workerCycle(5, -Infinity)])).toHaveLength(0)
    // Contrast: a non-inverted out-of-domain pair still parks verbatim
    // (started already due, so the shift arm never engages).
    const parked = restoreCycles([workerCycle(currentMs - 100, BOUND + 100)])[0]!
    expect(parked.completesAtMs).toBe(BOUND + 100)
  })

  it('survivor ordering: dropped rows do not reorder the kept lanes', () => {
    const survivors = restoreCycles([
      workerCycle(currentMs - 3000, currentMs + 2000, 'h_late'),
      workerCycle(currentMs - 100, currentMs - 200, 'inv'),
      workerCycle(currentMs - 4000, currentMs + 1000, 'h_early'),
    ])
    expect(survivors.map((c) => c.cycleId)).toEqual(['h_late', 'h_early'])
  })
})

// ----------------------------------------------------------------------------
// (G) Slot accounting after a drop: freed lane re-seeds, counts coherent.
// ----------------------------------------------------------------------------

describe('r34 COR - G: slot accounting after the drop', () => {
  it('a dropped lane frees a slot the SAME tick re-seeds; the healthy sibling settles', () => {
    const manager = registeredManager()
    manager.productionSystem.restoreStates(
      [
        {
          siteId: SITE_ID,
          level: 1,
          autoRestart: true,
          activeWorkerSlots: 2,
          workerCycles: [
            workerCycle(currentMs - 10_000, currentMs - 20_000, 'inv'),
            workerCycle(currentMs - 200_000, currentMs - 100_000, 'healthy'),
          ],
        },
      ] as never,
      currentMs,
    )
    expect(manager.productionSystem.getState(SITE_ID)!.workerCycles!).toHaveLength(1)

    manager.productionSystem.tickWorkers(
      currentMs,
      manager.materialBag,
      manager.materialRegistry,
      'mortal',
      2,
    )
    const cycles = manager.productionSystem.getState(SITE_ID)!.workerCycles!
    // The healthy due head settled (drain confirms the grant); the freed
    // second lane was re-seeded at this tick (observe mode seeds first).
    expect(manager.productionSystem.drainSettlementEvents().length).toBeGreaterThan(0)
    expect(cycles).toHaveLength(1)
    expect(cycles[0]!.startedAtMs).toBe(currentMs)
    expect(cycles[0]!.completesAtMs).toBeGreaterThan(cycles[0]!.startedAtMs)
    // The surviving stamps stay inside the persisted domain.
    expect(cycles[0]!.completesAtMs).toBeLessThan(BOUND)
    expect(cycles[0]!.startedAtMs).toBeGreaterThanOrEqual(0)
  })

  it('all-inverted + autoRestart: site re-seeds from empty lanes', () => {
    const manager = registeredManager()
    manager.productionSystem.restoreStates(
      [
        {
          siteId: SITE_ID,
          level: 1,
          autoRestart: true,
          activeWorkerSlots: 2,
          workerCycles: [
            workerCycle(100, 50, 'inv1'),
            workerCycle(200, 100, 'inv2'),
          ],
        },
      ] as never,
      currentMs,
    )
    expect(manager.productionSystem.getState(SITE_ID)!.workerCycles!).toHaveLength(0)

    manager.productionSystem.tickWorkers(
      currentMs,
      manager.materialBag,
      manager.materialRegistry,
      'mortal',
      2,
    )
    const cycles = manager.productionSystem.getState(SITE_ID)!.workerCycles!
    expect(cycles).toHaveLength(2)
    for (const c of cycles) {
      expect(c.completesAtMs).toBeGreaterThan(c.startedAtMs)
    }
  })

  it('all-inverted without autoRestart: site stays inert (no lanes to advance)', () => {
    const manager = registeredManager()
    manager.productionSystem.restoreStates(
      [
        {
          siteId: SITE_ID,
          level: 1,
          autoRestart: false,
          activeWorkerSlots: 2,
          workerCycles: [workerCycle(100, 50, 'inv')],
        },
      ] as never,
      currentMs,
    )
    manager.productionSystem.tickWorkers(
      currentMs,
      manager.materialBag,
      manager.materialRegistry,
      'mortal',
      2,
    )
    expect(manager.productionSystem.getState(SITE_ID)!.workerCycles!).toHaveLength(0)
  })

  it('scalar fields are untouched by the drop: assignedWorkers/activeWorkerSlots ride verbatim', () => {
    const manager = registeredManager()
    manager.productionSystem.restoreStates(
      [
        {
          siteId: SITE_ID,
          level: 2,
          autoRestart: true,
          activeWorkerSlots: 2,
          assignedWorkers: 5,
          workerCycles: [
            workerCycle(100, 50, 'inv'),
            workerCycle(currentMs - 50, currentMs + 500, 'ok'),
          ],
        },
      ] as never,
      currentMs,
    )
    const state = manager.productionSystem.getState(SITE_ID)!
    // Pre-tick snapshot keeps the persisted counts (cosmetic stale until
    // the allocator recomputes next tick - same as the .map arm).
    expect(state.assignedWorkers).toBe(5)
    expect(state.activeWorkerSlots).toBe(2)
    expect(state.workerCycles).toHaveLength(1)
  })

  it('a dropped lane cannot poison the next write: wire shape validates', () => {
    const manager = registeredManager()
    manager.productionSystem.restoreStates(
      [
        {
          siteId: SITE_ID,
          level: 1,
          autoRestart: true,
          activeWorkerSlots: 1,
          workerCycles: [workerCycle(100, 50, 'inv')],
        },
      ] as never,
      currentMs,
    )
    const persisted = manager.productionSystem.getState(SITE_ID)!.workerCycles!
    const shape = validateGameSaveShape(productionSiteWire(validWireSave(), persisted as never))
    expect(shape.ok).toBe(true)
  })
})

// ----------------------------------------------------------------------------
// (H) Mechanism re-pin: advanceWorkerLanes still ordering-denies a direct
//     (restore-bypassing) inverted feed at db694183.
// ----------------------------------------------------------------------------

describe('r34 COR - H: direct-feed ordering deny re-pin', () => {
  it('advanceWorkerLanes zero-advances a hand-fed inverted pair, preserving it verbatim', () => {
    const inverted = workerCycle(currentMs + 2000, currentMs + 1000, 'inv_feed')
    const result = advanceWorkerLanes({
      siteId: SITE_ID,
      collectionRealmId: 'mortal',
      siteLevel: 1,
      baseSeconds: MORTAL_BASE_SECONDS,
      cycleMs: MORTAL_CYCLE_MS,
      pending: [inverted],
      slots: 1,
      nowMs: currentMs,
      emptyLaneStartMs: currentMs,
      advanceMode: 'observe',
    })
    expect(result.completed).toHaveLength(0)
    expect(result.pending).toHaveLength(1)
    expect(result.pending[0]).toBe(inverted)
  })
})
