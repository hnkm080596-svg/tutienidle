// @vitest-environment node
// @ts-expect-error project omits Node ambient types by design (pattern: deadReferences.test.ts)
import { readFileSync } from 'node:fs'
// @ts-expect-error see above
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

// BETA SCOPE LOCK v2 - same seam as the r20-r31 probes: exercise the
// enabled implementation paths, not the dormant scope-hidden shells.
vi.mock('../../core/betaScope', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../core/betaScope')>()),
  isBetaFeature: () => true,
  isScopeHidden: () => false,
}))

import { createPinia, setActivePinia } from 'pinia'
import { createDefaultPlayer } from '../../core/player/Player'
import type { PlayerData } from '../../core/player/Player'
import { GameManager } from '../../core/game/GameManager'
import { primeMortalCreationPick } from './GameSave.fixture'
import { buildGameSave } from './SaveSystem'
import { validateGameSaveShape } from './saveShapeValidation'
import type { GameSave } from './saveTypes'
import { useAppLifecycle } from '../../composables/useAppLifecycle'
import { advanceWorkerLanes } from '../../core/production/WorkerLaneAdvance'
import type { ProductionCycle } from '../../core/production/ProductionTypes'
import { ManualClockSource } from '../../core/battle/turn/CombatClock'
import { defineEnemy } from '../../core/enemy/Enemy'
import { createBaseStats } from '../../core/stats/StatBlock'
import { CENTER_LANE_INDEX } from '../../core/battle/BattleLane'
import type { CombatEntity } from '../../core/combat/CombatEntity'
import { equipment } from '../../data/equipment/equipment'
import { affixes } from '../../data/equipment/affixes'
import { buildings } from '../../data/building/buildings'
import { pills } from '../../data/pill/pills'
import { alchemyRecipes } from '../../data/alchemy/alchemyRecipes'
import type { PersistentTimedEffect } from '../../core/player/PersistentTimedEffect'
import { scopeHiddenPillFamilyOfId } from '../../core/betaScope'

// ============================================================================
// QA probe - fixpoint r32 INT wave. Audits the r31 adjudication batch at
// 1d27aee4 for INTEGRATION COHERENCE - whether the r31-corrected layers still
// agree with every real consumer and seam:
//
//   (R) simPaused re-baseline vs the PAIRED combat-side latch: r31-INT-1
//       added `simPaused = false` at bootGame's head so a latch surviving
//       the terminal -> acknowledge -> re-auth -> re-enter chain cannot
//       disarm later pauses. But the pause contract is TWO latches - the
//       composable flag AND the CombatClock reasons set ('authority-pause').
//       bootGame re-baselines the flag only; resumeCombat('authority-pause')
//       fires exclusively inside resumeSimulation(), which the cleared flag
//       now dead-ends. A battle frozen at terminal-pause time re-mounts
//       frozen forever - invisible wedge, no 'authority-pause' UI.
//   (E) escape pins: the two ways the orphaned reason still clears
//       (beginBattleCycle's stop()+start(); a later pause+resume pair).
//   (C) coherence pins on the r31 fixes themselves: deny-return shape
//       preserves pending verbatim at every arm (not just the empty case
//       r31 probed); applyTimedEffect's min(2^52-1, now) clamp vs the
//       validator's appliedAtMs <= lastSavedAt pin - a pushed record must
//       re-validate (the pre-clamp future stamp would wedge every write).
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
    id: 'r32_dummy',
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
// (R) The lifecycle harness mirrors App.vue wiring: bootGame -> entered,
// pauseSimulation latches simPaused + freezes CombatClock under
// 'authority-pause', acknowledgeAuthority -> showAuth -> re-auth -> bootGame.
// ManualClockSource keeps the clock deterministic - state transitions are
// what matter, not elapsed time.
// ----------------------------------------------------------------------------

function lifecycleHarness() {
  const entryStage = ref('auth')
  let nextHandle = 1
  const liveIntervals = new Set<number>()
  const wire = validWireSave()
  const gameManager = registeredManager()
  gameManager.setCombatClockSource(new ManualClockSource())
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
      load: vi.fn(async () => ({ status: 'ok' as const, save: wire, raw: '{}', revision: 1 })),
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
  return { lifecycle, entryStage, liveIntervals, gameManager, deps, boot, playerState }
}

describe('auditR32 INT probe - orphaned authority-pause freeze across re-entry (R)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    currentMs = 1_725_160_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => currentMs)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('R1 re-entry leaves the paused battle frozen - the combat latch survives the cleared simPaused', async () => {
    const { lifecycle, gameManager, boot } = lifecycleHarness()
    const resumeSpy = vi.spyOn(gameManager, 'resumeCombat')

    // Boot 1 -> entered; a live battle owns a running CombatClock.
    expect((await lifecycle.bootGame({ createNewCharacter: false })).status).toBe('entered')
    lifecycle.startAutosave()
    gameManager.startBattle(barePlayer(), dummyEnemy())
    expect(gameManager.getTurnBattle()).not.toBeNull()
    expect(gameManager.getCombatClockState()).toBe('running')

    // Terminal authority pause (the remote cascade's onPause('terminal')
    // and the local coded-refuse arm share this exact call): latches the
    // flag and freezes the combat channel under 'authority-pause'.
    lifecycle.pauseSimulation()
    expect(lifecycle.isSimPaused()).toBe(true)
    expect(gameManager.getCombatClockState()).toBe('frozen')
    expect(gameManager.getFreezeReasons()).toContain('authority-pause')

    // acknowledgeAuthority -> bootFlow.showAuth() -> onAuthenticated ->
    // bootGame(false): the r31 re-baseline clears simPaused, the sim clock
    // restarts, the tick loop re-arms - but nothing clears the paired
    // combat-side latch (resumeCombat only fires inside resumeSimulation).
    boot.showAuth()
    expect((await lifecycle.bootGame({ createNewCharacter: false })).status).toBe('entered')
    lifecycle.startAutosave()
    expect(lifecycle.isSimPaused()).toBe(false)
    expect(lifecycle.getTickHandle()).toBeDefined()

    // ORPHAN: the battle paused at terminal time is still mounted
    // (restore never touches turnBattle) and still frozen - a live sim
    // runs behind a combat channel that can never advance. resumeCombat
    // was never called and cannot be: resumeSimulation's !simPaused gate
    // now dead-ends it.
    expect(gameManager.getTurnBattle()).not.toBeNull()
    expect(gameManager.getCombatClockState()).toBe('frozen')
    expect(gameManager.getFreezeReasons()).toContain('authority-pause')
    expect(resumeSpy).not.toHaveBeenCalled()
    lifecycle.resumeSimulation()
    expect(gameManager.getCombatClockState()).toBe('frozen')
    expect(gameManager.getFreezeReasons()).toContain('authority-pause')
    expect(resumeSpy).not.toHaveBeenCalled()
  })

  it('R2 escape pins - the orphan only clears via a fresh battle stop() or a later pause+resume pair', async () => {
    const { lifecycle, gameManager, boot } = lifecycleHarness()

    expect((await lifecycle.bootGame({ createNewCharacter: false })).status).toBe('entered')
    gameManager.startBattle(barePlayer(), dummyEnemy())
    lifecycle.pauseSimulation()
    boot.showAuth()
    expect((await lifecycle.bootGame({ createNewCharacter: false })).status).toBe('entered')
    expect(gameManager.getFreezeReasons()).toContain('authority-pause')

    // Escape 1: any later pause+resume pair - resume deletes the reason by
    // name. This is why the wedge self-heals only when the authority layer
    // happens to pause again; it cannot heal on entry by itself.
    lifecycle.pauseSimulation()
    lifecycle.resumeSimulation()
    expect(gameManager.getFreezeReasons()).not.toContain('authority-pause')
    expect(gameManager.getCombatClockState()).toBe('running')

    // Escape 2 (re-orbit): pause+re-enter again, then a NEW battle - the
    // beginBattleCycle stop()+start() clears every reason.
    lifecycle.pauseSimulation()
    expect(gameManager.getFreezeReasons()).toContain('authority-pause')
    boot.showAuth()
    await lifecycle.bootGame({ createNewCharacter: false })
    expect(gameManager.getFreezeReasons()).toContain('authority-pause')
    gameManager.startBattle(barePlayer(), dummyEnemy())
    expect(gameManager.getFreezeReasons()).not.toContain('authority-pause')
    expect(gameManager.getCombatClockState()).toBe('running')
  })

  it('R3 ordering pin - bootGame re-baselines simPaused without any resumeCombat pair (source pin)', () => {
    const source = readFileSync(
      fileURLToPath(new URL('../../composables/useAppLifecycle.ts', import.meta.url)),
      'utf-8',
    )
    const bootStart = source.indexOf('async function bootGame')
    const bootEnd = source.indexOf('// --- Essence stream state', bootStart)
    const bootBody = source.slice(bootStart, bootEnd)
    expect(bootBody).toContain('simPaused = false')
    expect(bootBody).not.toContain('resumeCombat')
    // stopAll() never clears the combat latch either.
    const stopStart = source.indexOf('function stopAll')
    const stopBody = source.slice(stopStart, stopStart + 1200)
    expect(stopBody).not.toContain('resumeCombat')
    expect(stopBody).not.toContain('freezeCombat')
  })
})

// ----------------------------------------------------------------------------
// (C1) Deny-return shape: the r31 negative-window deny must preserve pending
// verbatim - callers assign result.pending back to state.workerCycles, so a
// deny that truncated the array would delete honest in-flight lanes.
// ----------------------------------------------------------------------------

describe('auditR32 INT probe - deny-return shape vs caller write-back (C1)', () => {
  const CYCLE_MS = 3_600_000

  const parkedCycle: ProductionCycle = {
    cycleId: 'cyc_parked',
    siteId: 'thanh_van_lam',
    collectionRealmId: REALM,
    siteLevelAtStart: 1,
    rewardTableVersion: 1,
    rollSeed: 7,
    startedAtMs: currentMs,
    completesAtMs: currentMs + CYCLE_MS,
  }

  it('negative emptyLaneStartMs denies with pending verbatim - no data loss, no truncation', () => {
    const result = advanceWorkerLanes({
      siteId: 'thanh_van_lam',
      collectionRealmId: REALM,
      siteLevel: 1,
      baseSeconds: 3600,
      cycleMs: CYCLE_MS,
      pending: [parkedCycle],
      slots: 1,
      nowMs: currentMs,
      emptyLaneStartMs: -1,
      advanceMode: 'deadline',
      budgetMs: CYCLE_MS * 10,
    })

    // Zero-advance shape: callers write result.pending back verbatim, so
    // the deny must hand back the input untouched - the parked in-domain
    // cycle survives for the next honest tick.
    expect(result.pending).toEqual([parkedCycle])
    expect(result.completed).toHaveLength(0)
    expect(result.seededPending).toHaveLength(0)
    expect(result.forfeited).toBe(0)
    expect(result.consumedBudgetMs).toBe(0)
  })

  it('same verbatim preservation when nowMs itself is out of domain', () => {
    const result = advanceWorkerLanes({
      siteId: 'thanh_van_lam',
      collectionRealmId: REALM,
      siteLevel: 1,
      baseSeconds: 3600,
      cycleMs: CYCLE_MS,
      pending: [parkedCycle],
      slots: 1,
      nowMs: 2 ** 52, // out-of-domain clock
      emptyLaneStartMs: currentMs,
      advanceMode: 'deadline',
      budgetMs: CYCLE_MS * 10,
    })

    expect(result.pending).toEqual([parkedCycle])
    expect(result.completed).toHaveLength(0)
  })
})

// ----------------------------------------------------------------------------
// (C2) applyTimedEffect push-arm clamp vs the validator's two pins:
// appliedAtMs must sit in |x| < 2^52 AND <= lastSavedAt (write marker is
// Date.now()). The r31 clamp min(2^52-1, now) guarantees both; expiresAtMs
// keeps the bare magnitude clamp - the persisted domain it actually has.
// ----------------------------------------------------------------------------

describe('auditR32 INT probe - applyTimedEffect clamp vs write-gate pins (C2)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    currentMs = 1_725_160_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => currentMs)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function regenSource(): { pillId: string; realmId: string; effect: Partial<PersistentTimedEffect> } {
    // Live regen family only: hoi_xuan_dan is retired/scope-hidden, and a
    // dormant-family claim is rejected at the gate outright (F-TC6-8).
    const pill = pills.find(
      (entry) =>
        entry.realmId !== undefined &&
        entry.effects.some((e) => e.type === 'regen') &&
        scopeHiddenPillFamilyOfId(entry.id) === null,
    )!
    const regen = pill.effects.find((e) => e.type === 'regen')!

    return {
      pillId: pill.id,
      realmId: pill.realmId!,
      effect: {
        sourceItemId: pill.id,
        effectGroup: regen.effectGroup ?? 'pill_regen',
        durationStackable: regen.stackable ?? false,
        modifiers: [],
      },
    }
  }

  it('crafted future appliedAtMs clamps to Date.now() - the pushed record passes its own write gate', () => {
    const gameManager = registeredManager()
    const player = createDefaultPlayer()
    const source = regenSource()
    player.realmId = source.realmId as PlayerData['realmId']

    gameManager.effectOps.applyTimedEffect(player, {
      id: 'r32_crafted',
      ...source.effect,
      appliedAtMs: 9_000_000_000_000_000, // ~284e3 years future - crafted
      expiresAtMs: 9_000_000_000_000_000, // above the 2^52 bound
    } as PersistentTimedEffect)

    const pushed = player.persistentTimedEffects.find((effect) => effect.id === 'r32_crafted')!

    // appliedAtMs clamped to min(2^52-1, now) = now; expiresAtMs clamped
    // to the bare magnitude bound 2^52-1.
    expect(pushed.appliedAtMs).toBe(currentMs)
    expect(pushed.expiresAtMs).toBe(2 ** 52 - 1)

    // The point of the clamp: a save written right after the push must
    // re-validate - the raw 9e15 stamp would have wedged on BOTH
    // |x| < 2^52 and appliedAtMs <= lastSavedAt. (The pill-regen branch
    // binds no expires window at admission - the far-future expiry is
    // bounded at the restore seam by boundTimedEffectClocks instead.)
    const save = buildGameSave(player as PlayerData, gameManager)
    const shape = validateGameSaveShape(save)
    expect(shape.ok).toBe(true)
    expect(
      shape.issues.every((issue) => !issue.path.includes('persistentTimedEffects')),
    ).toBe(true)
  })

  it('crafted negative appliedAtMs clamps only at the magnitude floor - the field domain is signed', () => {
    const gameManager = registeredManager()
    const player = createDefaultPlayer()
    const source = regenSource()
    player.realmId = source.realmId as PlayerData['realmId']

    gameManager.effectOps.applyTimedEffect(player, {
      id: 'r32_neg',
      ...source.effect,
      appliedAtMs: -9_000_000_000_000_000,
      expiresAtMs: currentMs + 60_000,
      modifiers: [],
    } as PersistentTimedEffect)

    const pushed = player.persistentTimedEffects.find((effect) => effect.id === 'r32_neg')!
    // Sign kept, magnitude clamped: -(2^52-1). appliedAtMs is provenance
    // (write-only after persistence; the merge arms read expiresAtMs
    // only) - the validator's magnitude + <= lastSavedAt pins both pass.
    expect(pushed.appliedAtMs).toBe(-(2 ** 52 - 1))
    const save = buildGameSave(player as PlayerData, gameManager)
    expect(validateGameSaveShape(save).ok).toBe(true)
  })

  it('tu_linh_tran push clamp does NOT reach the tighter writer bound - ceiling pin', () => {
    const gameManager = registeredManager()
    const player = createDefaultPlayer()
    player.realmId = 'qi_refining' as PlayerData['realmId']

    gameManager.effectOps.applyTimedEffect(player, {
      id: 'r32_tlt',
      sourceItemId: 'tu_linh_tran',
      effectGroup: 'tu_linh_tran',
      cultivationSpeedPercent: 0.25, // authored TU_LINH_TRAN_BUFF_PERCENT ceiling
      appliedAtMs: currentMs,
      expiresAtMs: 9_000_000_000_000_000, // clamps to 2^52-1
      modifiers: [],
    })

    const pushed = player.persistentTimedEffects.find((effect) => effect.id === 'r32_tlt')!
    expect(pushed.expiresAtMs).toBe(2 ** 52 - 1)

    // The magnitude clamp saves the |x| < 2^52 pin but NOT the TLT
    // writer bound (expires <= lastSavedAt + 24h + 7d) - a crafted
    // far-future TLT expiry wedges the write gate on the refuse arm.
    // Unreachable honestly: the only TLT writer (activateTuLinhTran)
    // stamps now + authored 24h. Ceiling documented, not a finding.
    const save = buildGameSave(player as PlayerData, gameManager)
    const shape = validateGameSaveShape(save)
    expect(shape.ok).toBe(false)
    expect(
      shape.issues.some(
        (issue) => issue.path.includes('persistentTimedEffects') && issue.message.includes('vượt biên writer'),
      ),
    ).toBe(true)
  })
})
