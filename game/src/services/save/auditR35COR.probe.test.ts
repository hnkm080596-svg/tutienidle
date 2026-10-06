// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { createDefaultPlayer, type PlayerData } from '../../core/player/Player'
import { GameManager } from '../../core/game/GameManager'
import type { GameManager as GameManagerType } from '../../core/game/GameManager'
import { ManualClockSource } from '../../core/battle/turn/CombatClock'
import { startAStage } from '../../core/game/__fixtures__/startAStage'
import { defineEnemy } from '../../core/enemy/Enemy'
import type { Stage } from '../../core/stage/Stage'
import { useAppLifecycle } from '../../composables/useAppLifecycle'
import { OnlineSessionController } from '../session/OnlineSessionController'
import { buildGameSave, restoreGameSession } from './SaveSystem'
import type { GameSave } from './SaveSystem'
import { primeMortalCreationPick } from './GameSave.fixture'
import { usePlayerStore } from '../../stores/player'
import { SPIRIT_STONE_MATERIAL_ID } from '../../core/material/SpiritStoneMaterial'
import { materials } from '../../data/materials/materials'
import { equipment } from '../../data/equipment/equipment'
import { affixes } from '../../data/equipment/affixes'
import { buildings } from '../../data/building/buildings'
import { pills } from '../../data/pill/pills'
import { alchemyRecipes } from '../../data/alchemy/alchemyRecipes'

// ============================================================================
// QA probe - fixpoint r35 COR wave. Blind adversarial audit of the r34
// adjudication at b1ffef6c. Sections:
//
//   (A) bootGame discard coverage: every arm that reaches markReady pays
//       discardStaleBattle exactly once BEFORE admission; the skipped arms
//       (generation fences) keep the frozen zombie untouched.
//   (B) discardInFlightBattle completeness + silence: every observable
//       binding dies, nothing emits (session.end / stopRepeat /
//       enemyManager.clear are all pure field writes - the canMutate
//       ordering concern is moot because no listener can ever fire).
//   (C) tail throw: the catch's freezeCombat lands on a STOPPED clock
//       (discard already ran), so freeze no-ops - deny direction either
//       way; pins clock 'stopped' + reasons [] after a tail rejection.
//   (D) r35-COR-F1: reconnect 'replaced' live-replacement - the sibling
//       seam the boot-only discard does NOT cover. OnlineSessionController.
//       attemptReconnect -> App.vue onResume -> restoreGameSession mutates
//       player.$state IN PLACE while the frozen in-flight TurnBattle keeps
//       its bindings on that same object -> resumeSimulation unlatches the
//       ghost -> its kills bank into the RESTORED character. Repro via the
//       real controller + real restore + real store.
//   (E) stale-read leftovers: turnRuntime / turnBattleSystem survive the
//       discard (only observational accessors reach them - getBattleBuffs
//       "[] outside battle" contract violated for dead-battle ids).
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

/** A boot-loadable save wired through the same shape the boot arm admits. */
function loadableSave() {
  const writer = registeredManager()
  const player = createDefaultPlayer()
  writer.setActivePlayer(player)
  primeMortalCreationPick(player, writer.skillManager)
  return JSON.parse(JSON.stringify(buildGameSave(player, writer)))
}

/** A stage battle bound to an explicit player (fixture variant). */
function startStageWith(manager: GameManager, player: PlayerData): void {
  const enemy = defineEnemy({
    id: 'r35_dummy',
    name: 'R35 Dummy',
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

  const stage: Stage = {
    id: 'r35_stage',
    name: 'r35_stage',
    description: '',
    floor: 1,
    enemyPool: [{ enemyId: 'r35_dummy', weight: 1 }],
    totalEnemyCount: 1,
    waves: [1],
    spawnIntervalSeconds: 0,
  }

  manager.catalogOps.registerEnemyTemplates([enemy])
  manager.catalogOps.registerStages([stage])
  manager.setActivePlayer(player)
  if (!manager.turnBattleOps.startStage(player, stage, false)) {
    throw new Error('probe stage failed to start')
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
// (A) Discard coverage: exactly once, before markReady, on every success arm.
// ----------------------------------------------------------------------------

describe('r35 COR - A: discardStaleBattle coverage on every arm reaching markReady', () => {
  it("ok-restore arm: discard runs exactly once, strictly before markReady; post-boot the battle is gone and the clock is 'stopped'", async () => {
    const manager = registeredManager()
    manager.setCombatClockSource(new ManualClockSource())
    startAStage(manager)
    manager.freezeCombat('authority-pause')
    expect(manager.getTurnBattle()).not.toBeNull()

    const discardSpy = vi.spyOn(manager, 'discardStaleBattle')
    const stubs = lifecycleStubs()
    stubs.entryStage.value = 'auth'
    stubs.coordinator.load = vi.fn(async () => ({
      status: 'ok' as const,
      save: loadableSave(),
      revision: 1,
    }))

    const lifecycle = useAppLifecycle({ ...stubs, gameManager: manager } as never)
    const outcome = await lifecycle.bootGame({ createNewCharacter: false })

    expect(outcome.status).toBe('entered')
    expect(discardSpy).toHaveBeenCalledTimes(1)
    expect(stubs.authority.markReady).toHaveBeenCalledTimes(1)
    expect(discardSpy.mock.invocationCallOrder[0]!).toBeLessThan(
      stubs.authority.markReady.mock.invocationCallOrder[0]!,
    )
    expect(manager.getTurnBattle()).toBeNull()
    expect(manager.getCombatClockState()).toBe('stopped')
    expect(manager.getFreezeReasons()).toEqual([])
    lifecycle.stopAll()
  })

  it('local synthetic-empty create arm: same discard contract (once, before markReady)', async () => {
    const manager = registeredManager()
    manager.setCombatClockSource(new ManualClockSource())
    startAStage(manager)
    manager.freezeCombat('authority-pause')

    const discardSpy = vi.spyOn(manager, 'discardStaleBattle')
    const stubs = lifecycleStubs()
    stubs.entryStage.value = 'character'
    // coordinator.load stays 'empty' - bootGame takes the create arm.
    stubs.player.save = vi.fn(async () => ({ status: 'ok' as const, revision: 1 }))

    const lifecycle = useAppLifecycle({ ...stubs, gameManager: manager } as never)
    const outcome = await lifecycle.bootGame({ createNewCharacter: true, onNewCharacter: vi.fn() })

    expect(outcome.status).toBe('entered')
    expect(discardSpy).toHaveBeenCalledTimes(1)
    expect(stubs.authority.markReady).toHaveBeenCalledTimes(1)
    expect(discardSpy.mock.invocationCallOrder[0]!).toBeLessThan(
      stubs.authority.markReady.mock.invocationCallOrder[0]!,
    )
    expect(manager.getTurnBattle()).toBeNull()
    expect(manager.getCombatClockState()).toBe('stopped')
    lifecycle.stopAll()
  })

  it('generation-fence early exit does NOT pay the discard: a skipped boot keeps the frozen zombie (r33 doctrine)', async () => {
    const manager = registeredManager()
    manager.setCombatClockSource(new ManualClockSource())
    startAStage(manager)
    manager.freezeCombat('authority-pause')

    const discardSpy = vi.spyOn(manager, 'discardStaleBattle')
    const stubs = lifecycleStubs()
    stubs.entryStage.value = 'character'
    let resolveSave: ((value: { status: 'ok'; revision: number }) => void) | undefined
    stubs.player.save = vi.fn(
      () => new Promise<{ status: 'ok'; revision: number }>((resolve) => {
        resolveSave = resolve
      }),
    )

    const lifecycle = useAppLifecycle({ ...stubs, gameManager: manager } as never)
    const pending = lifecycle.bootGame({ createNewCharacter: true, onNewCharacter: vi.fn() })
    await vi.waitFor(() => {
      expect(stubs.player.save).toHaveBeenCalledTimes(1)
    })
    lifecycle.stopAll()
    resolveSave!({ status: 'ok', revision: 1 })
    const outcome = await pending

    expect(outcome.status).toBe('skipped')
    expect(discardSpy).not.toHaveBeenCalled()
    expect(stubs.authority.markReady).not.toHaveBeenCalled()
    expect(manager.getTurnBattle()).not.toBeNull()
    expect(manager.getFreezeReasons()).toContain('authority-pause')
  })
})

// ----------------------------------------------------------------------------
// (B) discardInFlightBattle completeness + silence.
// ----------------------------------------------------------------------------

describe('r35 COR - B: discardInFlightBattle teardown surface', () => {
  it('clears every observable binding and emits no events (silent teardown)', () => {
    const manager = registeredManager()
    manager.setCombatClockSource(new ManualClockSource())
    startAStage(manager)
    manager.freezeCombat('authority-pause')
    expect(manager.getTurnBattle()).not.toBeNull()
    expect(manager.stageManager.getActive()).not.toBeNull()

    const emitSpy = vi.spyOn(manager.eventBus, 'emit')
    manager.discardStaleBattle()

    expect(manager.getTurnBattle()).toBeNull()
    expect(manager.getCurrentPresentationSession()).toBeNull()
    expect(manager.stageManager.getActive()).toBeNull()
    expect(manager.turnBattleOps.getStageProgress()).toBeNull()
    expect(manager.getCombatClockState()).toBe('stopped')
    expect(manager.getFreezeReasons()).toEqual([])
    // Silence: nothing is emitted during the teardown - no terminal
    // battle_end, no session event, no repeat event. Every step is a pure
    // field write, so the canMutate ordering concern is vacuous.
    expect(emitSpy).not.toHaveBeenCalled()
  })

  it('a second discard on an empty surface is a no-op (idempotent)', () => {
    const manager = registeredManager()
    manager.setCombatClockSource(new ManualClockSource())

    expect(() => manager.discardStaleBattle()).not.toThrow()
    expect(manager.getTurnBattle()).toBeNull()
    expect(manager.getCombatClockState()).toBe('stopped')
  })
})

// ----------------------------------------------------------------------------
// (C) Tail throw: the catch re-latch lands on a stopped clock (deny direction).
// ----------------------------------------------------------------------------

describe('r35 COR - C: tail try/catch on a discarded battle', () => {
  it("enterGame throwing rejects the boot; the catch's freezeCombat no-ops on the stopped clock", async () => {
    const manager = registeredManager()
    manager.setCombatClockSource(new ManualClockSource())
    startAStage(manager)
    manager.freezeCombat('authority-pause')

    const stubs = lifecycleStubs()
    stubs.entryStage.value = 'auth'
    stubs.coordinator.load = vi.fn(async () => ({
      status: 'ok' as const,
      save: loadableSave(),
      revision: 1,
    }))
    stubs.boot.enterGame = vi.fn(() => {
      throw new Error('router boom')
    })

    const lifecycle = useAppLifecycle({ ...stubs, gameManager: manager } as never)
    await expect(lifecycle.bootGame({ createNewCharacter: false })).rejects.toThrow('router boom')

    // The discard already ran -> the clock is 'stopped', so the catch's
    // freezeCombat('authority-pause') is a no-op: reasons stay empty and
    // no zombie freeze can resurrect a dead battle. Deny direction.
    expect(manager.getCombatClockState()).toBe('stopped')
    expect(manager.getFreezeReasons()).toEqual([])
    expect(manager.getTurnBattle()).toBeNull()
    expect(stubs.boot.fail).not.toHaveBeenCalled()
    lifecycle.stopAll()
  })

  it('markReady throwing: discard already ran, so combat stays stopped (not frozen) after rejection', async () => {
    const manager = registeredManager()
    manager.setCombatClockSource(new ManualClockSource())
    startAStage(manager)
    manager.freezeCombat('authority-pause')

    const stubs = lifecycleStubs()
    stubs.entryStage.value = 'auth'
    stubs.coordinator.load = vi.fn(async () => ({
      status: 'ok' as const,
      save: loadableSave(),
      revision: 1,
    }))
    stubs.authority.markReady = vi.fn(() => {
      throw new Error('listener boom')
    })

    const lifecycle = useAppLifecycle({ ...stubs, gameManager: manager } as never)
    await expect(lifecycle.bootGame({ createNewCharacter: false })).rejects.toThrow('listener boom')

    expect(manager.getCombatClockState()).toBe('stopped')
    expect(manager.getFreezeReasons()).toEqual([])
    expect(manager.getTurnBattle()).toBeNull()
    lifecycle.stopAll()
  })
})

// ----------------------------------------------------------------------------
// (D) r35-COR-F1 - reconnect 'replaced' seam: restoreGameSession mutates
//     player.$state in place while the latched battle's bindings point at
//     that same object; resumeSimulation then unlatches the ghost and its
//     resolution writes into the restored character.
// ----------------------------------------------------------------------------

describe('r35 COR - D: reconnect live-replacement ghost battle', () => {
  it('reconnect with replaced lineage resumes the pre-pause battle whose bindings now point at the restored character', async () => {
    const manager = registeredManager()
    const combatSource = new ManualClockSource()
    manager.setCombatClockSource(combatSource)

    const store = usePlayerStore()
    // Char A (the LIVE session owner): battle binds this exact $state object.
    startStageWith(manager, store.$state as PlayerData)
    expect(manager.getTurnBattle()).not.toBeNull()

    // Char B save: same shape, distinguishable content.
    const writer = registeredManager()
    const charB = createDefaultPlayer()
    writer.setActivePlayer(charB)
    primeMortalCreationPick(charB, writer.skillManager)
    charB.skillInsight = 7
    const saveB = JSON.parse(JSON.stringify(buildGameSave(charB, writer))) as GameSave

    const stubs = lifecycleStubs()
    stubs.entryStage.value = 'game'
    const lifecycle = useAppLifecycle({ ...stubs, gameManager: manager } as never)

    const intervals: Array<() => void> = []
    let restoreRan = false
    const controller = new OnlineSessionController({
      probe: async () => ({ status: 'ok' as const }),
      monotonicNow: () => 0,
      scheduleInterval: (cb) => (intervals.push(cb), intervals.length),
      clearHandle: vi.fn(),
      // The remote head moved while we were paused (another device /
      // replayed journal) -> reconnect reports 'replaced' with the
      // authoritative payload, exactly as reconnectPipeline does.
      reconnect: async () => ({
        status: 'resumed' as const,
        lineage: 'replaced' as const,
        save: saveB,
        serverAuthority: { serverNowMs: currentMs },
      }),
      onPause: () => lifecycle.pauseSimulation(),
      // Verbatim App.vue:704 onResume arm: restore in place, then resume.
      onResume: (lineage, save, serverAuthority) => {
        if (lineage === 'replaced' && save) {
          const restored = restoreGameSession(store as never, manager, save, {
            kind: 'live-replacement',
            nowMs: serverAuthority?.serverNowMs ?? Date.now(),
          })
          restoreRan = restored.status === 'ok'
        }
        lifecycle.resumeSimulation()
      },
    })

    controller.beginChecking()
    controller.markReady()
    expect(controller.authorityState).toBe('ready')

    // Authority drops mid-battle (heartbeat timeout): pauseSimulation
    // freezes combat under 'authority-pause'.
    controller.pause('heartbeat-timeout')
    await vi.waitFor(() => expect(controller.authorityState).toBe('ready'))

    expect(restoreRan).toBe(true)
    // The restore landed: $state now carries char B content in place.
    expect(store.$state.skillInsight).toBe(7)

    // THE DEFECT: the pre-pause battle was never discarded. It is still
    // bound to store.$state (same object identity, replaced content) and
    // resumeSimulation unlatched it back to 'running'.
    const ghost = manager.getTurnBattle()!
    expect(ghost).not.toBeNull()
    expect(manager.getCombatClockState()).toBe('running')
    expect(
      (manager.turnBattleOps as unknown as { playerDataForTurnBattle: unknown })
        .playerDataForTurnBattle,
    ).toBe(store.$state)

    // Observable write: drive the ghost to fighting, kill its enemy, and
    // the dead battle banks spirit stones into the restored character's
    // material bag (in-place-restored, same instance the stale receiver
    // still points at).
    combatSource.advance(6) // intro(20) + countdown(30) + fighting steps
    expect(ghost.state).toBe('fighting')
    const stonesBefore = manager.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)
    ghost.enemies[0]!.entity.alive = false
    combatSource.advance(1)
    expect(manager.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)).toBeGreaterThan(stonesBefore)

    lifecycle.stopAll()
  })

  it("contrast pin: 'same' lineage resume legitimately unlatches the battle (no restore ran)", async () => {
    const manager = registeredManager()
    const combatSource = new ManualClockSource()
    manager.setCombatClockSource(combatSource)

    const store = usePlayerStore()
    startStageWith(manager, store.$state as PlayerData)

    const stubs = lifecycleStubs()
    stubs.entryStage.value = 'game'
    const lifecycle = useAppLifecycle({ ...stubs, gameManager: manager } as never)

    const controller = new OnlineSessionController({
      probe: async () => ({ status: 'ok' as const }),
      monotonicNow: () => 0,
      scheduleInterval: () => 1,
      clearHandle: vi.fn(),
      reconnect: async () => ({ status: 'resumed' as const, lineage: 'same' as const }),
      onPause: () => lifecycle.pauseSimulation(),
      onResume: () => lifecycle.resumeSimulation(),
    })

    controller.beginChecking()
    controller.markReady()
    controller.pause('heartbeat-timeout')
    await vi.waitFor(() => expect(controller.authorityState).toBe('ready'))

    expect(manager.getTurnBattle()).not.toBeNull()
    expect(manager.getCombatClockState()).toBe('running')
    lifecycle.stopAll()
  })
})

// ----------------------------------------------------------------------------
// (E) Stale-read leftovers: per-battle machinery survives the discard.
// ----------------------------------------------------------------------------

describe('r35 COR - E: post-discard stale machinery reads', () => {
  it("getTurnBattleSystem()/getBattleBuffs() still reach the dead battle's runtime after discard", () => {
    const manager = registeredManager()
    manager.setCombatClockSource(new ManualClockSource())
    startAStage(manager)

    const deadEngine = manager.turnBattleOps.getTurnBattleSystem()
    expect(deadEngine).not.toBeNull()

    manager.discardStaleBattle()

    expect(manager.getTurnBattle()).toBeNull()
    // Stale reads: the minted engine + runtime are never detached. Only
    // observational consumers reach them (theBarBridge polls
    // getBattleBuffs; getTurnBattleSystem is @internal) - every write
    // path guards on getTurnBattle() !== null first.
    expect(manager.turnBattleOps.getTurnBattleSystem()).toBe(deadEngine)
    expect(() => manager.getBattleBuffs('any-entity-id')).not.toThrow()
  })
})
