// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { createDefaultPlayer } from '../../core/player/Player'
import { GameManager } from '../../core/game/GameManager'
import type { GameManager as GameManagerType } from '../../core/game/GameManager'
import { ManualClockSource } from '../../core/battle/turn/CombatClock'
import { startAStage } from '../../core/game/__fixtures__/startAStage'
import { useAppLifecycle } from '../../composables/useAppLifecycle'
import { buildGameSave, restoreGameSession } from './SaveSystem'
import { primeMortalCreationPick } from './GameSave.fixture'
import { materials } from '../../data/materials/materials'
import { equipment } from '../../data/equipment/equipment'
import { affixes } from '../../data/equipment/affixes'
import { buildings } from '../../data/building/buildings'
import { pills } from '../../data/pill/pills'
import { alchemyRecipes } from '../../data/alchemy/alchemyRecipes'
import { usePlayerStore } from '../../stores/player'
import { defineEnemy } from '../../core/enemy/Enemy'
import type { Stage } from '../../core/stage/Stage'

// ============================================================================
// QA probe - fixpoint r35 INT wave. Integration-coherence audit of the r34
// adjudication at b1ffef6c:
//
//   (A) r35-INT-1 - the 'replaced' reconnect-resume seam. App.vue:704-737
//       onResume runs restoreGameSession (rebinds player.$state in place)
//       then lifecycle.resumeSimulation() -> resumeCombat('authority-pause')
//       with NO discardStaleBattle: the same rebind-then-unlatch shape
//       r34-COR-F1 closed on bootGame, still open on this sibling arm. The
//       ghost battle resumes stepping on the rebound character's channel.
//   (B) 'entered' boot discard completeness - every binding the discard owns
//       is observed cleared (battle, stage lease, enemies, clock, reasons).
//   (C) Fail-arm / tail-throw deny-direction pins: a failed boot keeps the
//       frozen zombie (lease included); a tail throw post-discard cannot
//       re-latch a 'stopped' clock.
//   (D) Silent-discard vs terminal-abandon asymmetry survives the
//       discardInFlightBattle refactor: discard emits no battle_end,
//       abandon still emits exactly one.
//
// ASCII only (P15).
// ============================================================================

let currentMs = 1_725_160_000_000

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

function lifecycleStubs() {
  const intervals: Array<() => void> = []
  return {
    intervals,
    clock: { start: vi.fn(), stop: vi.fn(), nowSeconds: () => 0 },
    scheduleInterval: (cb: () => void) => (intervals.push(cb), intervals.length),
    clearHandle: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    boot: {
      startSaveLoad: vi.fn(),
      startInitializing: vi.fn(),
      enterGame: vi.fn(),
      fail: vi.fn(),
      requireCharacter: vi.fn(),
      showAuth: vi.fn(),
    },
    coordinator: {
      load: vi.fn(async () => ({ status: 'empty' as const, revision: 0 as const })) as {
        (data?: unknown): Promise<Record<string, unknown>>
      },
      save: vi.fn(async () => ({ status: 'ok' as const, revision: 1 })),
      reset: vi.fn(),
      capability: 'local-only' as const,
    },
    player: { save: vi.fn(), restoreFromSave: vi.fn(), $state: {} },
    authority: {
      canMutate: vi.fn(() => true),
      beginChecking: vi.fn(),
      markReady: vi.fn(),
      markFailed: vi.fn(),
      observeSaveResult: vi.fn(),
    },
    tick: vi.fn(),
    gameManager: {
      eventBus: { on: vi.fn(), off: vi.fn() },
    } as unknown as GameManagerType,
    offlineSummary: { show: vi.fn() },
    saveIssue: { report: vi.fn() },
    entryStage: ref('game'),
    restoreGameSession: vi.fn(() => ({ status: 'ok' })),
    persistPlayer: vi.fn(async () => ({ status: 'ok', revision: 1 })),
    onError: vi.fn(),
    unsupportedSaveNotice: vi.fn(),
    hardReset: vi.fn(),
  }
}

function buildSaveFor(playerName: string) {
  const writer = registeredManager()
  const player = { ...createDefaultPlayer(), name: playerName }
  writer.setActivePlayer(player)
  primeMortalCreationPick(player, writer.skillManager)
  return JSON.parse(JSON.stringify(buildGameSave(player, writer)))
}

// startAStage binds its own PlayerData; this variant binds the Pinia store's
// $state - the object restoreGameSession mutates in place - so the probe can
// show the post-rebind read-through.
function startStoreStage(manager: GameManager, store: ReturnType<typeof usePlayerStore>) {
  const stage: Stage = {
    id: 'fixture_stage',
    name: 'fixture_stage',
    description: '',
    floor: 1,
    enemyPool: [{ enemyId: 'fixture_stage_dummy', weight: 1 }],
    totalEnemyCount: 1,
    waves: [1],
    spawnIntervalSeconds: 0,
  }
  const enemy = defineEnemy({
    id: 'fixture_stage_dummy',
    name: 'Fixture Dummy',
    level: 1,
    realmId: 'mortal',
    lane: 'ground',
    statsInput: {
      maxHp: 1_000_000,
      might: 0,
      attackSpeed: 1,
      criticalRate: 0,
      criticalDamage: 1.5,
      armor: 0,
    },
    rewards: { techniqueMastery: 0, spiritStone: 0 },
  })
  manager.catalogOps.registerEnemyTemplates([enemy])
  manager.catalogOps.registerStages([stage])
  manager.setActivePlayer(store.$state)
  if (!manager.turnBattleOps.startStage(store.$state, stage, true)) {
    throw new Error('startStoreStage failed to start fixture_stage')
  }
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
// (A) r35-INT-1 - 'replaced' reconnect-resume resumes the ghost battle
// ----------------------------------------------------------------------------

describe('r35 INT - A: onResume replaced-arm rebinds $state then unlatches with no discard', () => {
  it('replaced-resume: the frozen battle unlatches and keeps stepping on the rebound character', async () => {
    const manager = registeredManager()
    const combatSource = new ManualClockSource()
    manager.setCombatClockSource(combatSource)

    const playerStore = usePlayerStore()
    startStoreStage(manager, playerStore)
    const ghostOwnerName = playerStore.$state.name // store default
    expect(manager.getTurnBattle()).not.toBeNull()
    expect(manager.getTurnBattle()!.players[0]!.entity.name).toBe(ghostOwnerName)

    // Model the revealed battle: a watched stage farm carries no
    // 'not-revealed' latch (the fresh-session hold is interactive-mode
    // only and this probe mounts no coordinator). Clearing it upfront is
    // identical to the coordinator's release() path.
    manager.resumeCombat('not-revealed')
    expect(manager.getCombatClockState()).toBe('running')

    // Authority pause mid-battle: App.vue onPause -> pauseSimulation
    // latches simPaused and 'authority-pause' on the live clock. The
    // battle stays bound - the warhead r34 closed is armed here.
    const stubs = lifecycleStubs()
    stubs.entryStage.value = 'game'
    const lifecycle = useAppLifecycle({ ...stubs, gameManager: manager } as never)
    lifecycle.pauseSimulation()
    expect(manager.getCombatClockState()).toBe('frozen')
    expect(manager.getFreezeReasons()).toContain('authority-pause')

    // The reconnect lands 'replaced': the remote head revision moved
    // while paused (second device / journal reconcile). App.vue:718 runs
    // the real restore seam - restoreFromSave mutates $state IN PLACE,
    // so the stale battle's playerDataForTurnBattle binding now reads
    // the replacement character.
    const replacementSave = buildSaveFor('Ke Tiec Quyen')
    const restored = restoreGameSession(
      playerStore,
      manager,
      replacementSave,
      { kind: 'live-replacement', nowMs: currentMs },
    )
    expect(restored.status).toBe('ok')
    expect(playerStore.$state.name).toBe('Ke Tiec Quyen')

    // App.vue:736 - the arm resumes combat with NO discardStaleBattle.
    lifecycle.resumeSimulation()

    // DEFECT (mechanism chain, executed): the ghost battle is running,
    // still carrying the dead owner's entity snapshot while its data
    // channel ($state) is the replacement character.
    expect(manager.getCombatClockState()).toBe('running')
    expect(manager.getTurnBattle()).not.toBeNull()
    expect(manager.getTurnBattle()!.players[0]!.entity.name).toBe(ghostOwnerName)
    // The data channel IS the rebound object - $state identity survived
    // the in-place restore, so every write the ghost makes lands on the
    // replacement character.
    expect(manager.getTurnBattle()!.players[0]!.entity.name).not.toBe(
      playerStore.$state.name,
    )

    // The clock steps the ghost - and the stage lease is still armed, so
    // auto-repeat keeps farming the dead stage against the new owner.
    combatSource.advance(1)
    expect(manager.getElapsedCombatSteps()).toBeGreaterThan(0)
    expect(manager.turnBattleOps.getStageProgress()).not.toBeNull()

    lifecycle.stopAll()
  })

  it('control - same-lineage resume on UNREBOUND state resumes correctly (no discard needed)', async () => {
    const manager = registeredManager()
    const combatSource = new ManualClockSource()
    manager.setCombatClockSource(combatSource)

    const playerStore = usePlayerStore()
    startStoreStage(manager, playerStore)
    manager.resumeCombat('not-revealed')

    const stubs = lifecycleStubs()
    stubs.entryStage.value = 'game'
    const lifecycle = useAppLifecycle({ ...stubs, gameManager: manager } as never)
    lifecycle.pauseSimulation()
    expect(manager.getCombatClockState()).toBe('frozen')

    // 'same' lineage: revision unchanged, no rebind - the frozen battle's
    // bindings still describe the live character, so unlatching is the
    // correct contract here.
    lifecycle.resumeSimulation()
    expect(manager.getCombatClockState()).toBe('running')
    combatSource.advance(1)
    expect(manager.getElapsedCombatSteps()).toBeGreaterThan(0)
    expect(manager.getTurnBattle()!.players[0]!.entity.name).toBe(playerStore.$state.name)

    lifecycle.stopAll()
  })

  it('sibling-latch hygiene on the same seam: a user-pause survives the authority unlatch', async () => {
    const manager = registeredManager()
    manager.setCombatClockSource(new ManualClockSource())
    const playerStore = usePlayerStore()
    startStoreStage(manager, playerStore)
    manager.resumeCombat('not-revealed')

    manager.freezeCombat('user-pause')
    const stubs = lifecycleStubs()
    stubs.entryStage.value = 'game'
    const lifecycle = useAppLifecycle({ ...stubs, gameManager: manager } as never)
    lifecycle.pauseSimulation()

    lifecycle.resumeSimulation()

    // resumeCombat deletes ONLY 'authority-pause'; the user latch holds
    // the battle frozen - consistent with the boot contract.
    expect(manager.getCombatClockState()).toBe('frozen')
    expect(manager.getFreezeReasons()).toContain('user-pause')
    lifecycle.stopAll()
  })
})

// ----------------------------------------------------------------------------
// (B) 'entered' boot: the discard clears every binding it owns
// ----------------------------------------------------------------------------

describe('r35 INT - B: entered-boot discard completeness', () => {
  it('successful boot: battle, stage lease, enemies, clock and reasons all cleared', async () => {
    const manager = registeredManager()
    const combatSource = new ManualClockSource()
    manager.setCombatClockSource(combatSource)
    startAStage(manager)
    // Let the wave spawn its enemy before the latch lands (intro +
    // countdown run first) - the discard has to clear the spawned set,
    // not just the binding.
    for (let i = 0; i < 40 && manager.enemyManager.getAll().length === 0; i++) {
      combatSource.advance(1)
    }
    manager.freezeCombat('authority-pause')

    // Pre-boot: live battle, armed stage lease, spawned enemy.
    expect(manager.getTurnBattle()).not.toBeNull()
    expect(manager.turnBattleOps.getStageProgress()).not.toBeNull()
    expect(manager.enemyManager.getAll().length).toBeGreaterThan(0)

    const stubs = lifecycleStubs()
    stubs.entryStage.value = 'auth'
    const save = buildSaveFor('Vo Danh Hai')
    stubs.coordinator.load = vi.fn(async () => ({
      status: 'ok' as const,
      save,
      revision: 1,
    }))
    stubs.boot.enterGame = vi.fn(() => {
      stubs.entryStage.value = 'game'
    })
    const lifecycle = useAppLifecycle({ ...stubs, gameManager: manager } as never)

    const outcome = await lifecycle.bootGame({ createNewCharacter: false })
    expect(outcome.status).toBe('entered')

    // discardInFlightBattle clear-set - every consumer reads idle state.
    expect(manager.getTurnBattle()).toBeNull()
    expect(manager.getCombatClockState()).toBe('stopped')
    expect(manager.getFreezeReasons()).toEqual([])
    expect(manager.turnBattleOps.getStageProgress()).toBeNull()
    expect(manager.enemyManager.getAll()).toHaveLength(0)
    expect(manager.getActiveTurnBattleStage()).toBeNull()

    // Post-discard the clock source still fires but nothing can step.
    const stepsAfterBoot = manager.getElapsedCombatSteps()
    combatSource.advance(1)
    expect(manager.getElapsedCombatSteps()).toBe(stepsAfterBoot)

    lifecycle.stopAll()
  })
})

// ----------------------------------------------------------------------------
// (C) deny-direction pins: failed boot keeps the zombie; tail throw cannot
// re-latch a stopped clock
// ----------------------------------------------------------------------------

describe('r35 INT - C: fail-arm and tail-throw deny direction', () => {
  it('failed boot: discard never runs - the frozen zombie and its lease survive untouched', async () => {
    const manager = registeredManager()
    const combatSource = new ManualClockSource()
    manager.setCombatClockSource(combatSource)
    startAStage(manager)
    for (let i = 0; i < 40 && manager.enemyManager.getAll().length === 0; i++) {
      combatSource.advance(1)
    }
    manager.freezeCombat('authority-pause')
    const enemiesBefore = manager.enemyManager.getAll().length
    const stepsBefore = manager.getElapsedCombatSteps()

    const stubs = lifecycleStubs()
    stubs.entryStage.value = 'auth'
    stubs.coordinator.load = vi.fn(async () => ({
      status: 'unavailable' as const,
      message: 'down',
      retryable: true,
    }))
    stubs.boot.fail = vi.fn(() => {
      stubs.entryStage.value = 'error'
    })
    const lifecycle = useAppLifecycle({ ...stubs, gameManager: manager } as never)

    const outcome = await lifecycle.bootGame({ createNewCharacter: false })

    expect(outcome.status).toBe('failed')
    // r33 doctrine: only 'entered' pays the discard - the zombie keeps
    // its battle, its lease, its enemies and its freeze reasons.
    expect(manager.getTurnBattle()).not.toBeNull()
    expect(manager.getCombatClockState()).toBe('frozen')
    expect(manager.getFreezeReasons()).toContain('authority-pause')
    expect(manager.turnBattleOps.getStageProgress()).not.toBeNull()
    expect(manager.enemyManager.getAll()).toHaveLength(enemiesBefore)

    // The frozen zombie cannot step - the clock source fires on a latched
    // clock and nothing advances.
    combatSource.advance(1)
    expect(manager.getElapsedCombatSteps()).toBe(stepsBefore)

    lifecycle.stopAll()
  })

  it('tail throw post-discard: the catch re-latch no-ops on the stopped clock (r34-COR-F2)', async () => {
    const manager = registeredManager()
    const combatSource = new ManualClockSource()
    manager.setCombatClockSource(combatSource)
    startAStage(manager)
    manager.freezeCombat('authority-pause')

    const stubs = lifecycleStubs()
    stubs.entryStage.value = 'auth'
    const save = buildSaveFor('Vo Danh Hai')
    stubs.coordinator.load = vi.fn(async () => ({
      status: 'ok' as const,
      save,
      revision: 1,
    }))
    stubs.boot.enterGame = vi.fn(() => {
      throw new Error('route fault')
    })
    const lifecycle = useAppLifecycle({ ...stubs, gameManager: manager } as never)

    await expect(lifecycle.bootGame({ createNewCharacter: false })).rejects.toThrow('route fault')

    // markReady already committed admission; the catch's
    // freezeCombat('authority-pause') hit a 'stopped' clock and no-oped -
    // deny direction on both sides of the discard.
    expect(stubs.authority.markReady).toHaveBeenCalledTimes(1)
    expect(manager.getTurnBattle()).toBeNull()
    expect(manager.getCombatClockState()).toBe('stopped')
    expect(manager.getFreezeReasons()).toEqual([])

    const stepsAfterRejection = manager.getElapsedCombatSteps()
    combatSource.advance(1)
    expect(manager.getElapsedCombatSteps()).toBe(stepsAfterRejection)

    lifecycle.stopAll()
  })
})

// ----------------------------------------------------------------------------
// (D) silent-discard vs terminal-abandon asymmetry intact after the refactor
// ----------------------------------------------------------------------------

describe('r35 INT - D: discard emits no terminal; abandon still emits exactly one', () => {
  it('discardStaleBattle is silent; abandonBattle emits one battle_end and retains the terminal battle', () => {
    const manager = registeredManager()
    manager.setCombatClockSource(new ManualClockSource())
    const ends: string[] = []
    manager.eventBus.on<{ type: string; state: string }>('battle_end', (event) => {
      ends.push(event.state)
    })

    startAStage(manager)
    manager.discardStaleBattle()
    // No terminal event on a silent discard - nothing consumed a start.
    expect(ends).toEqual([])
    expect(manager.getTurnBattle()).toBeNull()
    expect(manager.getCombatClockState()).toBe('stopped')

    startAStage(manager)
    expect(manager.abandonBattle()).toBe(true)
    // The abandon contract is unchanged by the shared teardown: one
    // terminal event, terminal battle retained for result consumers.
    expect(ends).toEqual(['defeat'])
    expect(manager.getTurnBattle()!.state).toBe('defeat')
    expect(manager.getCombatClockState()).toBe('stopped')
  })
})
