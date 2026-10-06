// @vitest-environment node
// @ts-expect-error project omits Node ambient types by design (pattern: deadReferences.test.ts)
import { readFileSync } from 'node:fs'
// @ts-expect-error see above
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

// BETA SCOPE LOCK v2 - same seam as the r20-r32 probes: exercise the
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
import { settleProductionOffline } from '../../core/production/ProductionOffline'
import type { ProductionCycle, ProductionSiteState } from '../../core/production/ProductionTypes'
import { computeCycleSeconds } from '../../core/production/ProductionBalance'
import { ManualClockSource } from '../../core/battle/turn/CombatClock'
import { defineEnemy } from '../../core/enemy/Enemy'
import { createBaseStats } from '../../core/stats/StatBlock'
import { CENTER_LANE_INDEX } from '../../core/battle/BattleLane'
import type { CombatEntity } from '../../core/combat/CombatEntity'
import { MaterialBag } from '../../core/material/MaterialBag'
import { MaterialRegistry } from '../../core/material/MaterialRegistry'
import { getActiveCultivationSpeedPercent } from '../../core/economy/TuLinhTranBalance'
import { TU_LINH_TRAN_DURATION_MS } from '../../core/economy/TuLinhTranBalance'
import { equipment } from '../../data/equipment/equipment'
import { affixes } from '../../data/equipment/affixes'
import { buildings } from '../../data/building/buildings'
import { pills } from '../../data/pill/pills'
import { alchemyRecipes } from '../../data/alchemy/alchemyRecipes'
import type { ActiveAlchemyJob } from '../../core/alchemy/AlchemySystem'
import type { PersistentTimedEffect } from '../../core/player/PersistentTimedEffect'

// ============================================================================
// QA probe - fixpoint r33 INT wave. Audits the r32 adjudication batch at
// a014b7fb for INTEGRATION COHERENCE - whether the r32-corrected layers
// still agree with each other and every real consumer:
//
//   (R) bootGame's eager resumeCombat('authority-pause') vs UNPROVEN
//       admission - the r32-INT-1 fix clears the combat latch at boot
//       ENTRY, before load/commit/save arms resolve. Every fail arm then
//       mounts the terminal surface with the combat clock UNFROZEN and
//       no re-freeze path (pauseSimulation is entryStage==='game' gated,
//       resumeSimulation only deletes reasons) - the r30-INT-1 channel
//       reopened on the retry-fail edge. Mid-boot awaits (coordinator
//       .load, the post-accrual commit, firstSave) also yield to the RAF
//       feed: steps land while admission is still unproven.
//   (C1) mintedSpanMs admitted-input contract - the headroom now
//       denominates max(cycleMs, authored span); both real callers pass
//       the coherent pair so nothing honest tightens.
//   (C2) drop-vs-park three-policy asymmetry - alchemy drops inverted
//       pairs, production parks them (site-wide freeze + write refuse),
//       quest normalize-clamps - all deny-direction, inconsistent only
//       for unreachable crafted shapes.
//   (C3) expiresCeiling classification key (effectGroup) vs validator
//       TLT pin key (sourceItemId) + tickTimedEffects consumer coherence.
//   (C4) seeded-head field-epoch re-stamp ordering - uniform per-pair
//       shift; a parked head's deadline-mode successors anchor on the
//       persisted due, so the pair can never go out of order.
// ============================================================================

let currentMs = 1_725_160_000_000
const REALM = 'mortal'

function registeredManager(): GameManager {
  const manager = new GameManager()
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

// Minimal live battle - raw-entity test policy, same shape as
// GameManager.laneAssignment.test.ts (no catalogs needed).
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
    id: 'r33_dummy',
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

// ----------------------------------------------------------------------------
// (R) The lifecycle harness mirrors App.vue wiring. `loadStatus` selects
// which boot arm resolves. ManualClockSource keeps combat deterministic.
// The load stub advances the combat source mid-boot to prove the window
// between resumeCombat and admission is live.
// ----------------------------------------------------------------------------

function lifecycleHarness() {
  const entryStage = ref('auth')
  let nextHandle = 1
  const liveIntervals = new Set<number>()
  const wire = validWireSave()
  const gameManager = registeredManager()
  const manualSource = new ManualClockSource()
  gameManager.setCombatClockSource(manualSource)
  const playerState = createDefaultPlayer()
  const clockStateDuringLoad: string[] = []
  // Mutable load status + per-call side effect - a test flips these
  // between boots to reach the fail arms.
  const loadControl = {
    status: 'ok' as 'ok' | 'unavailable',
    duringLoad: undefined as undefined | (() => void),
  }
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
    clock: { start: vi.fn(), stop: vi.fn(), update: vi.fn() },
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
      capability: 'local',
      load: vi.fn(async () => {
        // Boot has already run its entry-side effects (beginChecking,
        // resumeCombat) when this await resolves - same position a real
        // network load holds.
        clockStateDuringLoad.push(gameManager.getCombatClockState())
        loadControl.duringLoad?.()
        if (loadControl.status === 'unavailable') {
          return {
            status: 'unavailable' as const,
            code: 'SERVER_ERROR' as const,
            message: 'load failed',
            retryable: true,
          }
        }
        return { status: 'ok' as const, save: wire, raw: '{}', revision: 1 }
      }),
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
      save: vi.fn(async () => ({ status: 'ok' as const, revision: 1 })),
      $state: playerState,
    },
    gameManager,
    tick: vi.fn(),
    offlineSummary: { show: vi.fn() },
    saveIssue: { report: vi.fn(), clear: vi.fn() },
    entryStage,
    // Mocked seam - production restoreGameSession never touches the
    // battle/combatClock either, so the live battle below survives a
    // re-boot exactly as it would in the app.
    restoreGameSession: vi.fn(() => ({ status: 'ok' })),
    persistPlayer: vi.fn(async () => ({ status: 'ok' })),
    onError: vi.fn(),
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
    clockStateDuringLoad,
    loadControl,
  }
}

describe('auditR33 INT probe - eager resumeCombat vs unproven boot admission (R)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    currentMs = 1_725_160_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => currentMs)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('R1 failed re-boot leaves combat UNFROZEN behind the error surface - the reason clears at entry, nothing re-latches', async () => {
    const { lifecycle, gameManager, boot, manualSource, loadControl, entryStage } =
      lifecycleHarness()

    // Boot 1 -> entered; a live battle owns a running CombatClock.
    expect((await lifecycle.bootGame({ createNewCharacter: false })).status).toBe('entered')
    lifecycle.startAutosave()
    gameManager.startBattle(barePlayer(), dummyEnemy())
    expect(gameManager.getCombatClockState()).toBe('running')

    // Terminal authority pause: latches simPaused + freezes combat under
    // 'authority-pause' - the two-part latch.
    lifecycle.pauseSimulation()
    expect(gameManager.getCombatClockState()).toBe('frozen')
    expect(gameManager.getFreezeReasons()).toEqual(['authority-pause'])

    // Acknowledge -> auth -> re-auth; the retry load FAILS. r32 clears the
    // reason at bootGame ENTRY - before admission is proven - and no fail
    // arm re-freezes (pauseSimulation is entryStage==='game' gated; the
    // boot fail arms never call it).
    loadControl.status = 'unavailable'
    boot.showAuth()
    expect(
      (await lifecycle.bootGame({ createNewCharacter: false })).status,
    ).toBe('failed')
    expect(boot.fail).toHaveBeenCalled()
    expect(entryStage.value).toBe('error')

    // BUG: the terminal card is mounted while the combat channel is open.
    // The same in-flight battle now counts steps again behind 'error'.
    expect(gameManager.getTurnBattle()).not.toBeNull()
    expect(gameManager.getCombatClockState()).toBe('running')
    expect(gameManager.getFreezeReasons()).toEqual([])

    const stepsBefore = gameManager.getElapsedCombatSteps()
    manualSource.advance(1)
    expect(gameManager.getElapsedCombatSteps()).toBeGreaterThan(stepsBefore)
  })

  it('R2 the unlatch is live DURING the boot awaits - frames inside the load window step the battle pre-admission', async () => {
    const { lifecycle, gameManager, boot, manualSource, clockStateDuringLoad, loadControl } =
      lifecycleHarness()

    // Reach 'game' once, run a battle, latch the terminal pause. The
    // second boot's load await advances the SAME ManualClockSource the
    // singleton gameManager already listens to.
    expect((await lifecycle.bootGame({ createNewCharacter: false })).status).toBe('entered')
    lifecycle.startAutosave()
    gameManager.startBattle(barePlayer(), dummyEnemy())
    lifecycle.pauseSimulation()
    expect(gameManager.getCombatClockState()).toBe('frozen')

    const stepsBefore = gameManager.getElapsedCombatSteps()
    loadControl.duringLoad = () => manualSource.advance(2)
    boot.showAuth()

    expect((await lifecycle.bootGame({ createNewCharacter: false })).status).toBe('entered')

    // While the awaited coordinator.load() was in flight the clock was
    // already 'running' - the source frames emitted steps BEFORE
    // markReady/enterGame granted admission.
    expect(clockStateDuringLoad[1]).toBe('running')
    expect(gameManager.getElapsedCombatSteps()).toBeGreaterThan(stepsBefore)
  })

  it('R3 source pin - resumeCombat sits at bootGame ENTRY, before every admission arm (load, markReady, enterGame)', () => {
    const source = readFileSync(
      fileURLToPath(new URL('../../composables/useAppLifecycle.ts', import.meta.url)),
      'utf-8',
    )
    const bootStart = source.indexOf('async function bootGame')
    const bootEnd = source.indexOf('return { status:', source.indexOf('authority.markReady()'))
    const bootBody = source.slice(bootStart, bootEnd)

    const resumeAt = bootBody.indexOf("resumeCombat('authority-pause')")
    const loadAt = bootBody.indexOf('coordinator.load()')
    const readyAt = bootBody.indexOf('authority.markReady()')

    expect(resumeAt).toBeGreaterThan(-1)
    expect(loadAt).toBeGreaterThan(-1)
    expect(readyAt).toBeGreaterThan(-1)
    // The unlatch runs BEFORE the load await and BEFORE admission is
    // marked - the fail arms below it can never re-latch.
    expect(resumeAt).toBeLessThan(loadAt)
    expect(resumeAt).toBeLessThan(readyAt)
  })

  it('R4 contrast pin - a SUCCESSFUL re-boot must clear the latch (the r32-INT-1 intent still holds)', async () => {
    const { lifecycle, gameManager, boot } = lifecycleHarness()

    expect((await lifecycle.bootGame({ createNewCharacter: false })).status).toBe('entered')
    gameManager.startBattle(barePlayer(), dummyEnemy())
    lifecycle.pauseSimulation()
    expect(gameManager.getCombatClockState()).toBe('frozen')

    boot.showAuth()
    expect((await lifecycle.bootGame({ createNewCharacter: false })).status).toBe('entered')

    // Intended behavior: the surviving battle resumes after a successful
    // re-entry (the reason is cleared, the clock counts again).
    expect(gameManager.getTurnBattle()).not.toBeNull()
    expect(gameManager.getFreezeReasons()).not.toContain('authority-pause')
    expect(gameManager.getCombatClockState()).toBe('running')
  })
})

// ----------------------------------------------------------------------------
// (C1) mintedSpanMs admitted-input contract: r32 denominates the LARGER of
// caller cycleMs and the authored span the mint actually persists. Both
// real callers (tickWorkers, settleWorkersOffline) pass the coherent pair
// - only a hypothetical incoherent third caller feels the tighten.
// ----------------------------------------------------------------------------

describe('auditR33 INT probe - mintedSpanMs contract vs callers (C1)', () => {
  const AUTHORED_MS = computeCycleSeconds(100, 1) * 1000 // mortal base, level 1

  it('incoherent caller (cycleMs < authored span) now denies at the bound it actually mints at', () => {
    const nearBound = 2 ** 52 - AUTHORED_MS / 2 // admits under cycleMs-only headroom
    const result = advanceWorkerLanes({
      siteId: 'thanh_van_lam',
      collectionRealmId: REALM,
      siteLevel: 1,
      baseSeconds: 100,
      cycleMs: 1_000, // incoherent: far below the authored span
      pending: [],
      slots: 1,
      nowMs: nearBound,
      emptyLaneStartMs: nearBound,
      advanceMode: 'deadline',
      budgetMs: AUTHORED_MS * 10,
    })

    // r32 denominates the authored span -> the minted completesAtMs would
    // land >= 2^52 -> zero-advance deny, pending preserved verbatim.
    expect(result.completed).toHaveLength(0)
    expect(result.pending).toHaveLength(0)
    expect(result.seededPending).toHaveLength(0)
    // Under the OLD guard (denominated by cycleMs=1000) this same call
    // admitted and minted a persisted stamp >= 2^52.
    expect(nearBound + 1_000 < 2 ** 52).toBe(true)
    expect(nearBound + AUTHORED_MS >= 2 ** 52).toBe(true)
  })

  it('coherent pair behaves identically at the same boundary (no honest tightening)', () => {
    const nearBound = 2 ** 52 - AUTHORED_MS / 2
    const result = advanceWorkerLanes({
      siteId: 'thanh_van_lam',
      collectionRealmId: REALM,
      siteLevel: 1,
      baseSeconds: 100,
      cycleMs: AUTHORED_MS, // coherent: same value both callers compute
      pending: [],
      slots: 1,
      nowMs: nearBound,
      emptyLaneStartMs: nearBound,
      advanceMode: 'deadline',
      budgetMs: AUTHORED_MS * 10,
    })

    expect(result.completed).toHaveLength(0)
    expect(result.pending).toHaveLength(0)
  })

  it('in-domain incoherent call still mints the AUTHORED span on the persisted head (dual-source contract, unchanged)', () => {
    const result = advanceWorkerLanes({
      siteId: 'thanh_van_lam',
      collectionRealmId: REALM,
      siteLevel: 1,
      baseSeconds: 100,
      cycleMs: 1_000, // cursor dues step by 1s; persisted span is authored
      pending: [],
      slots: 1,
      nowMs: currentMs,
      emptyLaneStartMs: currentMs,
      advanceMode: 'deadline',
      budgetMs: AUTHORED_MS * 10,
    })

    expect(result.pending).toHaveLength(1)
    const head = result.pending[0]!
    // buildProductionCycle stamps startMs + authored span - NOT startMs +
    // cycleMs. The lane cursor due (start + 1000) is internal-only; the
    // persisted deadline is the validator-pinned authored span. Reachable
    // only via a hypothetical third caller; both real callers are
    // coherent, so this asymmetry is a doc note, not a defect.
    expect(head.completesAtMs - head.startedAtMs).toBe(AUTHORED_MS)
    expect(head.completesAtMs - head.startedAtMs).not.toBe(1_000)
  })
})

// ----------------------------------------------------------------------------
// (C2) drop-vs-park three-policy asymmetry: alchemy DROPS inverted pairs
// at the boundary; production PARKS them (advanceWorkerLanes then
// zero-advances the whole site); quest normalize-clamps its marker. All
// deny-direction; reachable shapes only come from ungated feeds since the
// validator refuses inverted pairs at admission (F-A11-4 / F-A11-5).
// ----------------------------------------------------------------------------

describe('auditR33 INT probe - drop-vs-park-vs-clamp policy trio (C2)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.spyOn(Date, 'now').mockImplementation(() => currentMs)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  const honestCycle = (overrides: Partial<ProductionCycle>): ProductionCycle => ({
    cycleId: 'cyc_honest',
    siteId: 'thanh_van_lam',
    collectionRealmId: REALM,
    siteLevelAtStart: 1,
    rewardTableVersion: 1,
    rollSeed: 7,
    startedAtMs: currentMs - 50_000,
    completesAtMs: currentMs - 40_000,
    ...overrides,
  })

  it('alchemy drops the inverted pair; production parks it and the site freezes INCLUDING honest siblings', () => {
    const gameManager = registeredManager()

    // Alchemy: inverted pair dropped at the boundary - job gone silently.
    gameManager.alchemySystem.restoreJobs([
      {
        jobId: 'job_inv',
        recipeId: alchemyRecipes[0]!.id,
        pillId: 'p',
        herbMaterialId: 'h',
        startedAtMs: currentMs,
        completesAtMs: currentMs - 1, // inverted
        roomLevelAtStart: 1,
        reservation: {} as ActiveAlchemyJob['reservation'],
      },
    ])
    expect(gameManager.alchemySystem.getJobs()).toHaveLength(0)

    // Production: same shape parks VERBATIM on the site...
    gameManager.productionSystem.restoreStates(
      [
        {
          siteId: 'thanh_van_lam',
          level: 1,
          autoRestart: true,
          activeWorkerSlots: 1,
          assignedWorkers: 1,
          workerCycles: [
            honestCycle({ cycleId: 'cyc_inv', startedAtMs: currentMs, completesAtMs: currentMs - 1 }),
            honestCycle({ cycleId: 'cyc_ok' }),
          ],
        },
      ],
      currentMs,
    )

    const parked = gameManager.productionSystem.getState('thanh_van_lam')
    expect(parked?.workerCycles).toHaveLength(2)

    // ...and the mechanism-wide ordering guard then zero-advances the
    // whole site - the honest sibling lane is frozen with it (deny).
    const tickResult = gameManager.productionSystem.getState('thanh_van_lam')
    expect(tickResult?.workerCycles?.[0]?.completesAtMs).toBe(currentMs - 1)

    const advanced = advanceWorkerLanes({
      siteId: 'thanh_van_lam',
      collectionRealmId: REALM,
      siteLevel: 1,
      baseSeconds: 100,
      cycleMs: computeCycleSeconds(100, 1) * 1000,
      pending: parked!.workerCycles!,
      slots: 2,
      nowMs: currentMs,
      emptyLaneStartMs: currentMs,
      advanceMode: 'observe',
    })
    expect(advanced.completed).toHaveLength(0)
    expect(advanced.pending).toHaveLength(2) // nothing discharged

    // And the parked pair self-refuses the next save write (F-A11-4).
    // This is the documented parked-stamp residual: deny-direction but
    // it wedges the channel that carries it.
    const save = buildGameSave(createDefaultPlayer(), gameManager)
    ;(save.productionSites as ProductionSiteState[]).find(
      (site) => site.siteId === 'thanh_van_lam',
    )!.workerCycles = parked!.workerCycles
    const shape = validateGameSaveShape(save)
    expect(shape.ok).toBe(false)
    expect(
      shape.issues.some((issue) => issue.message.includes('sau startedAtMs')),
    ).toBe(true)
  })

  it('quest normalize-clamps the third policy (lastDailyResetAtMs > now -> now)', () => {
    const gameManager = registeredManager()
    gameManager.questManager.restore(
      {
        active: [],
        completedOnceIds: [],
        lastDailyResetAtMs: currentMs + 86_400_000, // crafted future
      },
      currentMs,
    )
    const state = gameManager.questManager.getState()
    expect(state.lastDailyResetAtMs).toBe(currentMs)
  })
})

// ----------------------------------------------------------------------------
// (C3) expiresCeiling classification: the WRITER keys on effectGroup, the
// VALIDATOR keys on sourceItemId='tu_linh_tran' (+ a separate group-match
// pin). A record claiming the TLT source with another group is rejected
// on the group pin regardless of expiry, so the key mismatch can only
// narrow, never admit. tickTimedEffects and the percent getter gate on
// the same expiresAtMs > now - coerced stamps are dead on arrival for
// both consumers.
// ----------------------------------------------------------------------------

describe('auditR33 INT probe - expiresCeiling keys + consumer coherence (C3)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.spyOn(Date, 'now').mockImplementation(() => currentMs)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('writer classifies TLT by effectGroup: sourceItemId=TLT + foreign group gets the NON-TLT ceiling', () => {
    const gameManager = registeredManager()
    const player = createDefaultPlayer()

    gameManager.effectOps.applyTimedEffect(player, {
      id: 'r33_xkey',
      sourceItemId: 'tu_linh_tran',
      effectGroup: 'other_group', // foreign group -> non-TLT ceiling
      appliedAtMs: currentMs,
      expiresAtMs: 9_000_000_000_000_000,
      modifiers: [],
    } as PersistentTimedEffect)

    const pushed = player.persistentTimedEffects.find((e) => e.id === 'r33_xkey')!
    // Non-TLT ceiling (2^52-1) applied - the writer keyed on effectGroup.
    expect(pushed.expiresAtMs).toBe(2 ** 52 - 1)

    // The validator enters the TLT branch on sourceItemId, then rejects
    // on the effectGroup mismatch pin - the record can never load, so
    // the looser writer ceiling is moot for this crafted shape.
    const save = buildGameSave(player, gameManager)
    const shape = validateGameSaveShape(save)
    expect(
      shape.issues.some((issue) =>
        issue.path.includes('persistentTimedEffects'),
      ),
    ).toBe(true)
  })

  it('group=TLT with a foreign sourceItemId still clamps at the TLT ceiling (over-narrow, deny direction)', () => {
    const gameManager = registeredManager()
    const player = createDefaultPlayer()

    gameManager.effectOps.applyTimedEffect(player, {
      id: 'r33_xkey2',
      sourceItemId: 'some_other_source',
      effectGroup: 'tu_linh_tran',
      appliedAtMs: currentMs,
      expiresAtMs: 9_000_000_000_000_000,
      modifiers: [],
    } as PersistentTimedEffect)

    const pushed = player.persistentTimedEffects.find((e) => e.id === 'r33_xkey2')!
    expect(pushed.expiresAtMs).toBe(
      currentMs + TU_LINH_TRAN_DURATION_MS + 7 * 86_400_000,
    )
  })

  it('dead-on-arrival coerced stamps: neither tickTimedEffects nor the percent getter sees them', () => {
    const gameManager = registeredManager()
    const player = createDefaultPlayer()

    // Non-finite expires coerces to the clamped applied stamp - dead.
    gameManager.effectOps.applyTimedEffect(player, {
      id: 'r33_dead',
      sourceItemId: 'tu_linh_tran',
      effectGroup: 'tu_linh_tran',
      cultivationSpeedPercent: 0.25,
      appliedAtMs: currentMs,
      expiresAtMs: Number.NaN,
      modifiers: [],
    } as PersistentTimedEffect)

    const pushed = player.persistentTimedEffects.find((e) => e.id === 'r33_dead')!
    expect(pushed.expiresAtMs).toBe(pushed.appliedAtMs)
    expect(getActiveCultivationSpeedPercent(player.persistentTimedEffects, currentMs)).toBe(0)
    expect(gameManager.effectOps.tickTimedEffects(player, currentMs)).toBe(1)
    expect(player.persistentTimedEffects).toHaveLength(0)
  })

  it('stackable NaN span is a no-extension (expires untouched), not a NaN wedge', () => {
    const gameManager = registeredManager()
    const player = createDefaultPlayer()
    const expiry = currentMs + 60_000

    gameManager.effectOps.applyTimedEffect(player, {
      id: 'r33_stack',
      sourceItemId: 'pill_x',
      effectGroup: 'pill_regen',
      durationStackable: true,
      appliedAtMs: currentMs,
      expiresAtMs: expiry,
      modifiers: [],
    } as PersistentTimedEffect)

    gameManager.effectOps.applyTimedEffect(player, {
      id: 'r33_stack_again',
      sourceItemId: 'pill_x',
      effectGroup: 'pill_regen',
      durationStackable: true,
      appliedAtMs: currentMs,
      expiresAtMs: Number.NaN, // crafted non-finite span
      modifiers: [],
    } as PersistentTimedEffect)

    const pushed = player.persistentTimedEffects.find((e) => e.id === 'r33_stack')!
    expect(Number.isFinite(pushed.expiresAtMs)).toBe(true)
    expect(pushed.expiresAtMs).toBe(expiry) // no extension on a NaN span
  })
})

// ----------------------------------------------------------------------------
// (C4) seeded-head field-epoch re-stamp: the +shift applies per PAIR
// (uniform delta -> ordering pin preserved); a head that cannot shift
// cleanly keeps settle-epoch stamps (parked). Successors of a parked head
// mint later from due + cycleMs - the chain can never interleave epochs
// inside one pair.
// ----------------------------------------------------------------------------

describe('auditR33 INT probe - seeded re-stamp ordering (C4)', () => {
  const SITE: ProductionSiteState = {
    siteId: 'thanh_van_lam',
    level: 1,
    autoRestart: true,
    activeWorkerSlots: 1,
    assignedWorkers: 1,
    workerCycles: [],
  }

  function offlineDeps(states: Map<string, ProductionSiteState>) {
    const gameManager = registeredManager()
    return {
      states,
      getSiteDefinition: (siteId: string) =>
        gameManager.productionSystem.getSiteDefinition(siteId),
      grantCycleRewards: vi.fn(),
    }
  }

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('honest-skew shift: seeded head moves +delta as a PAIR, stays validator-admissible', () => {
    vi.spyOn(Date, 'now').mockImplementation(() => currentMs + 50_000)
    const state: ProductionSiteState = { ...SITE, workerCycles: [] }
    const states = new Map([[state.siteId, state]])
    const deps = offlineDeps(states)

    const cycleMs = computeCycleSeconds(100, 1) * 1000 // 100_000
    settleProductionOffline(deps, new MaterialBag(), new MaterialRegistry(), REALM, currentMs, {
      workerCapacity: 1,
      offlineSinceMs: currentMs - 5 * cycleMs, // 5 cycles in the window
      workerAssignments: new Map([[state.siteId, 1]]),
      rng: () => 0.5,
    })

    // Window paid 5 cycles; the seeded pending head sits one span ahead.
    expect(state.workerCycles).toHaveLength(1)
    const head = state.workerCycles![0]!
    const expectedStart = currentMs - 5 * cycleMs + 5 * cycleMs // last due
    // Shifted by fieldEpochShift = Date.now() - nowMs = 50_000.
    expect(head.startedAtMs).toBe(expectedStart + 50_000)
    expect(head.completesAtMs).toBe(expectedStart + 50_000 + cycleMs)
    // Uniform delta -> ordering pin intact; started lands <= field-now so
    // the next write's startedAtMs <= lastSavedAt pin holds.
    expect(head.completesAtMs).toBeGreaterThan(head.startedAtMs)
    expect(head.startedAtMs).toBeLessThanOrEqual(currentMs + 50_000)
  })

  it('crafted-far clock parks the head VERBATIM (deny) - ordering inside the pair never breaks', () => {
    const farNow = 2 ** 52 - 10_000
    vi.spyOn(Date, 'now').mockImplementation(() => farNow)
    const state: ProductionSiteState = { ...SITE, workerCycles: [] }
    const states = new Map([[state.siteId, state]])
    const deps = offlineDeps(states)

    const cycleMs = computeCycleSeconds(100, 1) * 1000
    settleProductionOffline(deps, new MaterialBag(), new MaterialRegistry(), REALM, currentMs, {
      workerCapacity: 1,
      offlineSinceMs: currentMs - 5 * cycleMs,
      workerAssignments: new Map([[state.siteId, 1]]),
      rng: () => 0.5,
    })

    expect(state.workerCycles).toHaveLength(1)
    const head = state.workerCycles![0]!
    const expectedStart = currentMs - 5 * cycleMs + 5 * cycleMs
    // completesAtMs + shift >= 2^52 -> the pair keeps settle-epoch
    // stamps verbatim (no partial pair, no out-of-order mint).
    expect(head.startedAtMs).toBe(expectedStart)
    expect(head.completesAtMs).toBe(expectedStart + cycleMs)
    expect(head.completesAtMs).toBeGreaterThan(head.startedAtMs)
  })
})
