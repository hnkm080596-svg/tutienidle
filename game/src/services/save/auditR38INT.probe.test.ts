// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { GameManager } from '../../core/game/GameManager'
import { ManualClockSource, COMBAT_STEP_SECONDS } from '../../core/battle/turn/CombatClock'
import { ANIMATION_FALLBACK_MS } from '../../core/game/GameManagerTurnBattleOps'
import { startAStage } from '../../core/game/__fixtures__/startAStage'
import { defineEnemy } from '../../core/enemy/Enemy'
import { useCombatPause } from '../../composables/useCombatPause'
import { materials } from '../../data/materials/materials'
import { equipment } from '../../data/equipment/equipment'
import { affixes } from '../../data/equipment/affixes'
import { buildings } from '../../data/building/buildings'
import { pills } from '../../data/pill/pills'
import { alchemyRecipes } from '../../data/alchemy/alchemyRecipes'

// ============================================================================
// QA probe - fixpoint r38 INT wave. Blind integration-coherence audit of the
// r37 adjudication at de4c4fb4 (code 9881bc0b, codex/hoa-cau-fireball-vfx).
// The r37 batch changed: (F1) live-handles-only pendingStepTimers on the
// deferral/cap-drain/settle arms, (F2) same-generation ===undefined settled
// check in the awaitStep fallback, (F3) abandonBattle emits battle_end after
// teardown, (F4) setCombatClockSource strips a foreign 'turn-in-flight' on an
// IDLE token, (F5) pendingManualMode intent slot re-landed by
// dropBoundaryQueue, (F6) App.vue isCombatActive requires a live battle.
//
//   (A) The settled check vs the drain/settle chain. A cap-drained step's
//       parked settle entry is consumed by drainPendingPlayback through
//       settleStep; a queued fallback for that step must then die on the
//       ===undefined check without re-arming or re-driving. Also the last
//       live-handles-only gap: the dead/terminal arm consumes the entry but
//       parks its fired handle.
//   (B) Emit-after-teardown vs a re-minting listener. Inside abandonBattle's
//       emit the world is already torn down; a synchronous re-mint must
//       survive and get its own once-guard. Sibling: beginBattleCycle's
//       PRE-commit emit (a different emit site of the same event) has no
//       post-emit guard - a nested fresh/test mint is silently orphaned
//       while a nested stage mint is refused by the outer lease.
//   (C) 'turn-in-flight' strip on source swap vs the token listener: a
//       foreign latch on an IDLE token is stripped; a legit non-IDLE latch
//       carries and the rebound listener still owns its lifecycle.
//   (D) pendingManualMode vs every queue mutation: drop-land on combat
//       over and on abandon, drain-land mid battle, immediate-land at an
//       IDLE boundary, double-toggle last intent wins on the drop path.
//   (E) The battle-presence gate on REAL manager states: frozen+battle
//       true, stopped+null false, stopped+defeat false; and the
//       frozen+battleless zombie cannot be produced - freeze no-ops on a
//       stopped clock.
//   (F) r37-COR-5 bound: an armed curtain outlives its latch only as
//       residue - abandon clears 'tab-hidden' via stop(), the composable
//       flag remains armed, and continueBattle stays a live self-heal
//       channel on the dead clock.
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

interface OpsInternals {
  pendingStepTimers: Array<ReturnType<typeof setTimeout>>
  pendingStepDone: Record<string, (() => void) | undefined>
  pendingManualMode: boolean | null
  boundaryQueue: Array<() => void>
  turnBattleSystem: {
    declareActorAction: (battle: unknown, actor: unknown) => unknown
  }
}

function opsInternals(manager: GameManager): OpsInternals {
  return manager.turnBattleOps as unknown as OpsInternals
}

/** A parked interactive battle, non-repeat, one turn parked on 'ready'. */
function parkGhost(manager: GameManager) {
  const clock = new ManualClockSource()
  manager.setCombatClockSource(clock)
  manager.setPresentationActive(true)
  manager.setPresentationMode('interactive')
  const player = startAStage(manager)
  const port = manager.getPresentationPort()
  const hold = port.hold(port.getCurrentSession()!)!
  port.attach(hold)
  port.release(hold)
  clock.advance(COMBAT_STEP_SECONDS * 260)

  const battle = manager.getTurnBattle()
  expect(battle).not.toBeNull()
  expect(manager.getTurnTokenState()).not.toBe('IDLE')
  expect(manager.getPendingPlaybackToken()).not.toBeNull()
  return { player, battle: battle!, clock, port }
}

/**
 * Drive the renderer ACK surface until `until` holds. Each acknowledge
 * consumes only its own pending stage; the awaits flush the microtask
 * drain (settleStep -> done -> pipeline -> onTurnDrained).
 */
async function driveAcks(
  manager: GameManager,
  until?: () => boolean,
  budget = 80,
): Promise<void> {
  for (let i = 0; i < budget; i += 1) {
    if (until?.()) return
    const token = manager.getPendingPlaybackToken()
    if (token === null) {
      if (!until) return
      await Promise.resolve()
      continue
    }
    manager.acknowledgeTurnReady(token)
    manager.acknowledgeActionImpact(token)
    manager.acknowledgeActionComplete(token)
    await Promise.resolve()
  }
}

/**
 * Captured setTimeout callbacks - a callback already dequeued into the
 * macrotask queue when clearTimeout ran is the only shape that can fire a
 * fallback "stale"; modelled by invoking the captured callback manually
 * (after clearTimeout on its handle consumes the fake-timer slot).
 */
let capturedCallbacks: Array<{ handle: ReturnType<typeof setTimeout>; cb: () => void }> = []

function captureTimeouts(): void {
  const inner = globalThis.setTimeout
  vi.spyOn(globalThis, 'setTimeout').mockImplementation(
    ((cb: () => void, ms?: number) => {
      const handle = inner(cb, ms)
      capturedCallbacks.push({ handle, cb })
      return handle
    }) as typeof setTimeout,
  )
}

async function flushMicrotasks(rounds = 8): Promise<void> {
  for (let i = 0; i < rounds; i += 1) {
    await Promise.resolve()
  }
}

function makeDummyEnemy(id: string) {
  return defineEnemy({
    id,
    name: id,
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
}

beforeEach(() => {
  setActivePinia(createPinia())
  currentMs = 1_725_160_000_000
  vi.spyOn(Date, 'now').mockImplementation(() => currentMs)
  vi.spyOn(Math, 'random').mockReturnValue(0)
  capturedCallbacks = []
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

// ----------------------------------------------------------------------------
// (A) F1+F2 - the ===undefined settled check vs the drain/settle chain.
// ----------------------------------------------------------------------------
describe('r38 INT - A: the settled check composes with drainPendingPlayback', () => {
  it('cap-drain consumes the parked settle through settleStep and a post-drain stale callback dies on ===undefined', async () => {
    vi.useFakeTimers()
    captureTimeouts()
    const manager = registeredManager()
    const clock = new ManualClockSource()
    manager.setCombatClockSource(clock)
    manager.setPresentationActive(true)
    manager.setPresentationMode('interactive')
    startAStage(manager)
    const port = manager.getPresentationPort()
    const hold = port.hold(port.getCurrentSession()!)!
    port.attach(hold)
    port.release(hold)
    clock.advance(COMBAT_STEP_SECONDS * 260)
    expect(manager.getTurnTokenState()).not.toBe('IDLE')

    // Re-hold the session so the fallback parks in the deferral arm; at
    // the cap it drains the pending playback mechanically - the parked
    // settle entry stays armed FOR the drain (F1 note) and the drain's
    // own settle chain consumes it via settleStep.
    const rehold = port.hold(port.getCurrentSession()!)!
    port.attach(rehold)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    vi.advanceTimersByTime(ANIMATION_FALLBACK_MS * 40)
    await flushMicrotasks()

    expect(warn).toHaveBeenCalled()
    expect(manager.getTurnTokenState()).toBe('IDLE')

    // Every parked settle was consumed - none is left armed after the
    // drain, and the array holds no defined entries.
    const ops = opsInternals(manager)
    expect(Object.values(ops.pendingStepDone).every((entry) => entry === undefined)).toBe(true)
    expect(ops.pendingStepTimers.length).toBeLessThanOrEqual(1)

    // The dequeued-fallback shape on the DRAIN path: a callback for a
    // drained signal fires post-consume - the ===undefined check kills
    // it before the dead-battle arm, the latch arm, or a re-drive.
    const staleCb = capturedCallbacks.at(-1)!
    const timersBefore = vi.getTimerCount()
    const doneKeysBefore = Object.keys(ops.pendingStepDone).length
    staleCb.cb()
    await flushMicrotasks()

    expect(vi.getTimerCount()).toBe(timersBefore)
    expect(Object.keys(ops.pendingStepDone).length).toBe(doneKeysBefore)
    expect(Object.values(ops.pendingStepDone).every((entry) => entry === undefined)).toBe(true)
    expect(manager.getTurnTokenState()).toBe('IDLE')

    manager.discardStaleBattle()
    port.release(rehold)
    warn.mockRestore()
  })

  it('the dead/terminal arm consumes the entry but leaves its fired handle parked (bounded: next clearPendingSteps sweeps it)', async () => {
    vi.useFakeTimers()
    captureTimeouts()
    const manager = registeredManager()
    const { battle } = parkGhost(manager)
    const ops = opsInternals(manager)

    const readyFallback = capturedCallbacks.at(-1)!
    expect(ops.pendingStepDone['ready']).toBeTypeOf('function')
    const handlesBefore = ops.pendingStepTimers.length

    // Terminal battle + live entry: the dead-battle arm wipes the entry
    // and returns - it does NOT splice its just-fired handle.
    battle.state = 'defeat'
    clearTimeout(readyFallback.handle)
    readyFallback.cb()

    expect(ops.pendingStepDone['ready']).toBeUndefined()
    // Residue: the fired handle stays parked until clearPendingSteps.
    expect(ops.pendingStepTimers.length).toBe(handlesBefore)

    // The next turn's claim (or the discard below) runs
    // clearPendingSteps, which sweeps the residue wholesale.
    manager.discardStaleBattle()
    expect(ops.pendingStepTimers.length).toBe(0)
  })
})

// ----------------------------------------------------------------------------
// (B) F3 - emit-after-teardown vs a re-minting battle_end listener.
// ----------------------------------------------------------------------------
describe('r38 INT - B: the moved abandon emit vs re-minting listeners', () => {
  it('a battle_end listener minting a new stage mid-emit sees the torn-down world and the mint survives', () => {
    vi.useFakeTimers()
    const manager = registeredManager()
    const { battle: abandonedBattle } = parkGhost(manager)

    let nested: unknown = null
    const seen: string[] = []
    manager.eventBus.on('battle_end', (event: { state: string }) => {
      seen.push(event.state)
      // Ordering evidence (F3): at emit time the teardown tail already
      // ran - clock stopped, cycle entry state cleared - and the only
      // battle reference left is the defeat-marked outgoing one.
      expect(manager.getCombatClockState()).toBe('stopped')
      expect(manager.getTurnBattle()).toBe(abandonedBattle)
      expect(abandonedBattle.state).toBe('defeat')

      // A synchronous re-mint mid-emit: under pre-r37 ordering this mint
      // landed before the teardown tail and was torn into a zombie.
      const player = startAStage(manager, { stageId: 'fixture_nested' })
      expect(player).toBeTruthy()
      nested = manager.getTurnBattle()
    })

    expect(manager.abandonBattle()).toBe(true)

    expect(seen).toEqual(['defeat'])
    expect(nested).not.toBeNull()
    // The mint survived: it is the live battle, at its own 'intro' entry
    // state on a running (or turn-latched) clock - not a stopped zombie.
    expect(manager.getTurnBattle()).toBe(nested)
    expect(manager.getTurnBattle()!.state).toBe('intro')
    expect(manager.getCombatClockState()).not.toBe('stopped')

    manager.discardStaleBattle()
  })

  it('the once-guard is per-cycle: a nested mint inside the emit emits exactly once for ITS OWN terminal', () => {
    vi.useFakeTimers()
    const manager = registeredManager()
    parkGhost(manager)

    const seen: string[] = []
    manager.eventBus.on('battle_end', (event: { state: string }) => {
      seen.push(event.state)
      if (seen.length === 1) {
        // Re-mint inside the first emit - resetRewardState clears the
        // once-guard for the new cycle.
        startAStage(manager, { stageId: 'fixture_nested' })
      }
    })

    expect(manager.abandonBattle()).toBe(true)
    expect(seen).toEqual(['defeat'])

    // The nested cycle owns a fresh once-guard: its own abandon emits
    // exactly once more (not suppressed, not duplicated).
    expect(manager.abandonBattle()).toBe(true)
    expect(seen).toEqual(['defeat', 'defeat'])

    manager.discardStaleBattle()
  })

  it('sibling seam (r38-INT-L1): the PRE-commit emit in beginBattleCycle has no re-mint guard - a nested fresh mint is silently orphaned', () => {
    vi.useFakeTimers()
    const manager = registeredManager()
    const { player, battle: outgoing } = parkGhost(manager)

    // The pre-commit emit is a different emit site of the same event:
    // it runs BEFORE the incoming cycle's committed mint, and nothing
    // re-reads turnBattle between them.
    let nested: unknown = null
    manager.eventBus.on('battle_end', () => {
      // Mid-emit the outgoing battle is already defeat-marked but the
      // clock teardown has NOT run yet (unlike the abandon path).
      expect(manager.getTurnBattle()).toBe(outgoing)
      manager.startBattleWithPlayer(player, makeDummyEnemy('fixture_nested_enemy'))
      nested = manager.getTurnBattle()
    })

    // A fresh-cycle mint over a live fighting battle - the implicit end
    // path emits the outgoing battle's 'defeat' pre-commit.
    manager.startBattleWithPlayer(player, makeDummyEnemy('fixture_outer_enemy'))

    expect(nested).not.toBeNull()
    expect(nested).not.toBe(outgoing)
    // The nested mint is discarded wholesale by the outer commit: it is
    // alive but unreachable - the emit is not re-mint-safe on this arm.
    expect(manager.getTurnBattle()).not.toBe(nested)
    expect(manager.getTurnBattle()).not.toBe(outgoing)
    expect(manager.getTurnBattle()!.state).not.toBe('defeat')

    manager.discardStaleBattle()
  })
})

// ----------------------------------------------------------------------------
// (C) F4 - 'turn-in-flight' strip on source swap vs the token listener.
// ----------------------------------------------------------------------------
describe('r38 INT - C: the IDLE-token strip vs the rebound listener', () => {
  it('a foreign turn-in-flight on an IDLE token is stripped on swap and the next claim re-latches cleanly', async () => {
    vi.useFakeTimers()
    const manager = registeredManager()
    parkGhost(manager)

    await driveAcks(manager, () => manager.getTurnTokenState() === 'IDLE')
    expect(manager.getTurnTokenState()).toBe('IDLE')
    expect(manager.getFreezeReasons()).toEqual([])

    // Foreign plant: freezeCombat can write the reason while the token
    // is IDLE - no token transition owns this latch on the old clock.
    manager.freezeCombat('turn-in-flight')
    expect(manager.getFreezeReasons()).toEqual(['turn-in-flight'])

    manager.setCombatClockSource(new ManualClockSource())

    // The strip fired: nothing carried, the new clock runs, and the
    // foreign reason can never wedge it (no transition would resume it).
    expect(manager.getFreezeReasons()).toEqual([])
    expect(manager.getCombatClockState()).toBe('running')

    // Lifecycle continuity: the NEXT claim re-freezes the reason on the
    // new clock through the rebound listener and resolves it on IDLE.
    const clock2 = new ManualClockSource()
    manager.setCombatClockSource(clock2)
    clock2.advance(COMBAT_STEP_SECONDS * 260)
    expect(manager.getTurnTokenState()).not.toBe('IDLE')
    expect(manager.getFreezeReasons()).toContain('turn-in-flight')

    await driveAcks(manager, () => manager.getTurnTokenState() === 'IDLE')
    expect(manager.getFreezeReasons()).toEqual([])
    manager.discardStaleBattle()
  })

  it('a legit non-IDLE latch carries across the swap and the rebound listener still owns its release', async () => {
    vi.useFakeTimers()
    const manager = registeredManager()
    parkGhost(manager)

    // The parked turn latched 'turn-in-flight' through the listener -
    // carrying it is what keeps the wall-clock fallback gated.
    expect(manager.getFreezeReasons()).toContain('turn-in-flight')
    expect(manager.getTurnTokenState()).not.toBe('IDLE')

    manager.setCombatClockSource(new ManualClockSource())
    expect(manager.getFreezeReasons()).toEqual(['turn-in-flight'])
    expect(manager.getCombatClockState()).toBe('frozen')

    // The rebound listener releases the carried latch on ->IDLE on the
    // NEW clock - the strip check did not break ownership.
    await driveAcks(manager, () => manager.getTurnTokenState() === 'IDLE')
    expect(manager.getTurnTokenState()).toBe('IDLE')
    expect(manager.getFreezeReasons()).toEqual([])
    expect(manager.getCombatClockState()).toBe('running')

    manager.discardStaleBattle()
  })
})

// ----------------------------------------------------------------------------
// (D) F5 - pendingManualMode vs every boundaryQueue mutation.
// ----------------------------------------------------------------------------
describe('r38 INT - D: the intent slot lands on every queue-death path', () => {
  it('a toggle queued in the FINAL turn drops at combat-over and re-lands the flag', async () => {
    vi.useFakeTimers()
    const manager = registeredManager()
    const { battle } = parkGhost(manager)
    const ops = opsInternals(manager)

    // Queued, not applied: spec 9.1 - the flip must not hijack the turn
    // in flight (acknowledgeTurnReady reads the live flag).
    manager.setBattleManualMode(true)
    expect(manager.isBattleManualMode()).toBe(false)
    expect(ops.pendingManualMode).toBe(true)
    expect(ops.boundaryQueue.length).toBe(1)

    // The parked turn is the last one: the queued closure dies undrained
    // with the queue - dropBoundaryQueue re-lands the slot's intent.
    battle.enemies[0]!.entity.currentHp = 1
    await driveAcks(manager, () => battle.state !== 'fighting')

    expect(battle.state).toBe('victory')
    expect(manager.getTurnTokenState()).toBe('COMBAT_OVER')
    expect(manager.isBattleManualMode()).toBe(true)
    expect(ops.pendingManualMode).toBeNull()
    expect(ops.boundaryQueue.length).toBe(0)

    manager.discardStaleBattle()
  })

  it('double-toggle on the drop path lands the LAST intent, both orders', async () => {
    vi.useFakeTimers()
    const manager = registeredManager()
    const { battle } = parkGhost(manager)
    const ops = opsInternals(manager)

    manager.setBattleManualMode(true)
    manager.setBattleManualMode(false)
    expect(ops.pendingManualMode).toBe(false)
    expect(ops.boundaryQueue.length).toBe(2)

    battle.enemies[0]!.entity.currentHp = 1
    await driveAcks(manager, () => battle.state !== 'fighting')
    expect(manager.isBattleManualMode()).toBe(false)
    expect(ops.pendingManualMode).toBeNull()

    // Reverse order on a fresh battle: the drop re-lands true.
    startAStage(manager, { stageId: 'fixture_second' })
    manager.setPresentationActive(true)
    const port = manager.getPresentationPort()
    const secondHold = port.hold(port.getCurrentSession()!)!
    port.attach(secondHold)
    port.release(secondHold)
    const clock2 = new ManualClockSource()
    manager.setCombatClockSource(clock2)
    clock2.advance(COMBAT_STEP_SECONDS * 260)
    const battle2 = manager.getTurnBattle()!
    expect(manager.getTurnTokenState()).not.toBe('IDLE')

    manager.setBattleManualMode(false)
    manager.setBattleManualMode(true)
    expect(ops.pendingManualMode).toBe(true)

    battle2.enemies[0]!.entity.currentHp = 1
    await driveAcks(manager, () => battle2.state !== 'fighting')
    expect(manager.isBattleManualMode()).toBe(true)
    expect(ops.pendingManualMode).toBeNull()

    manager.discardStaleBattle()
  })

  it('a toggle queued mid-battle drains at the next IDLE boundary and clears the slot itself', async () => {
    vi.useFakeTimers()
    const manager = registeredManager()
    const { clock } = parkGhost(manager)
    const ops = opsInternals(manager)

    manager.setBattleManualMode(true)
    expect(ops.pendingManualMode).toBe(true)

    await driveAcks(manager, () => manager.getTurnTokenState() === 'IDLE')
    // The boundary is the next fighting-branch step: the queue drains,
    // the closure lands the flag AND clears the slot.
    clock.advance(COMBAT_STEP_SECONDS)

    expect(manager.isBattleManualMode()).toBe(true)
    expect(ops.pendingManualMode).toBeNull()
    expect(ops.boundaryQueue.length).toBe(0)

    manager.discardStaleBattle()
  })

  it('a toggle queued then abandoned re-lands through clearCycleEntryState, and the next battle reads the flag at claim time', async () => {
    vi.useFakeTimers()
    const manager = registeredManager()
    parkGhost(manager)
    const ops = opsInternals(manager)

    manager.setBattleManualMode(true)
    expect(ops.pendingManualMode).toBe(true)

    expect(manager.abandonBattle()).toBe(true)
    // The teardown drop re-landed the session-scoped intent: the flag
    // survives the battle it was queued against.
    expect(manager.isBattleManualMode()).toBe(true)
    expect(ops.pendingManualMode).toBeNull()
    expect(ops.boundaryQueue.length).toBe(0)

    // The next battle's claim-time read (tickPacing -> isBattleManualMode)
    // sees the re-landed value.
    startAStage(manager, { stageId: 'fixture_third' })
    expect(manager.isBattleManualMode()).toBe(true)

    manager.discardStaleBattle()
  })

  it('an IDLE-boundary toggle lands immediately and leaves no slot residue', async () => {
    vi.useFakeTimers()
    const manager = registeredManager()
    const { clock } = parkGhost(manager)
    const ops = opsInternals(manager)

    await driveAcks(manager, () => manager.getTurnTokenState() === 'IDLE')

    // Token IDLE -> enqueueAtTurnBoundary runs the closure synchronously:
    // flag flips now, the slot returns to null inside the same call.
    manager.setBattleManualMode(true)
    expect(manager.isBattleManualMode()).toBe(true)
    expect(ops.pendingManualMode).toBeNull()
    expect(ops.boundaryQueue.length).toBe(0)

    manager.discardStaleBattle()
    void clock
  })
})

// ----------------------------------------------------------------------------
// (E) F6 - the battle-presence gate on real manager states.
// ----------------------------------------------------------------------------
describe('r38 INT - E: isCombatActive on real clock/battle shapes', () => {
  const isCombatActive = (manager: GameManager) =>
    manager.getCombatClockState() !== 'stopped' && manager.getTurnBattle() !== null

  it('frozen+battle is active; discard, abandon, and a stopped-clock refreeze all land inactive', async () => {
    vi.useFakeTimers()
    const manager = registeredManager()
    const { battle } = parkGhost(manager)

    // The pre-fix zombie class needed a frozen clock with no battle;
    // every reachable shape below must read inactive only through the
    // stopped arm (nothing but defense in depth on the battle arm).
    expect(manager.getCombatClockState()).toBe('frozen')
    expect(manager.getTurnBattle()).not.toBeNull()
    expect(isCombatActive(manager)).toBe(true)

    // Post-abandon the dead battle object remains but the clock stopped:
    // inactive through the stopped arm - identical under both gates.
    expect(manager.abandonBattle()).toBe(true)
    expect(manager.getTurnBattle()).toBe(battle)
    expect(manager.getCombatClockState()).toBe('stopped')
    expect(isCombatActive(manager)).toBe(false)

    // The frozen+battleless zombie cannot be produced: freeze is a no-op
    // on a stopped clock, so nothing can re-latch without a battle.
    manager.freezeCombat('authority-pause')
    manager.freezeCombat('tab-hidden')
    expect(manager.getCombatClockState()).toBe('stopped')
    expect(manager.getFreezeReasons()).toEqual([])

    // Discard lands the same inactive shape.
    const manager2 = registeredManager()
    parkGhost(manager2)
    manager2.discardStaleBattle()
    expect(manager2.getCombatClockState()).toBe('stopped')
    expect(manager2.getTurnBattle()).toBeNull()
    expect(isCombatActive(manager2)).toBe(false)
  })

  it('the gate cannot wedge the curtain ON a live battle: hidden arms only while a battle exists', async () => {
    vi.useFakeTimers()
    const manager = registeredManager()
    parkGhost(manager)

    let visibility = 'visible'
    const listeners = new Map<string, () => void>()
    const documentStub = {
      get visibilityState() {
        return visibility
      },
      addEventListener: (type: string, handler: () => void) => {
        listeners.set(type, handler)
      },
      removeEventListener: (type: string) => {
        listeners.delete(type)
      },
    }
    vi.stubGlobal('document', documentStub)

    const { isPaused, continueBattle } = useCombatPause(manager, {
      isCombatActive: () => isCombatActive(manager),
    })

    // Frozen mid-turn battle: the curtain arms and latches.
    visibility = 'hidden'
    listeners.get('visibilitychange')!()
    expect(isPaused.value).toBe(true)
    expect(manager.getFreezeReasons()).toContain('tab-hidden')

    continueBattle()
    expect(isPaused.value).toBe(false)
    expect(manager.getFreezeReasons()).not.toContain('tab-hidden')

    // Post-discard (stopped + null) a hidden transition cannot re-arm.
    manager.discardStaleBattle()
    listeners.get('visibilitychange')!()
    expect(isPaused.value).toBe(false)
    expect(manager.getFreezeReasons()).toEqual([])
  })
})

// ----------------------------------------------------------------------------
// (F) r37-COR-5 bound - the armed curtain's residue is self-healable.
// ----------------------------------------------------------------------------
describe('r38 INT - F: the bump-starved curtain bound', () => {
  it('abandon clears the latch but not the flag; continueBattle is the live self-heal on a dead clock', async () => {
    vi.useFakeTimers()
    const manager = registeredManager()
    parkGhost(manager)

    let visibility = 'visible'
    const listeners = new Map<string, () => void>()
    const documentStub = {
      get visibilityState() {
        return visibility
      },
      addEventListener: (type: string, handler: () => void) => {
        listeners.set(type, handler)
      },
      removeEventListener: (type: string) => {
        listeners.delete(type)
      },
    }
    vi.stubGlobal('document', documentStub)

    const { isPaused, continueBattle } = useCombatPause(manager, {
      isCombatActive: () =>
        manager.getCombatClockState() !== 'stopped' && manager.getTurnBattle() !== null,
    })

    visibility = 'hidden'
    listeners.get('visibilitychange')!()
    expect(isPaused.value).toBe(true)
    expect(manager.getFreezeReasons()).toContain('tab-hidden')

    // Abandon: combatClock.stop() clears 'tab-hidden' but cannot reach
    // the composable flag - the accepted residue (the App.vue watch owns
    // the clear on the next stateVersion bump).
    expect(manager.abandonBattle()).toBe(true)
    expect(manager.getCombatClockState()).toBe('stopped')
    expect(manager.getFreezeReasons()).toEqual([])
    expect(isPaused.value).toBe(true)

    // Bound held: the armed flag still has a live unlatch channel even
    // on the dead clock - resumeCombat on 'stopped' is a no-op.
    continueBattle()
    expect(isPaused.value).toBe(false)
    expect(manager.getFreezeReasons()).toEqual([])

    // And no re-arm is possible afterwards (dead clock fails the gate).
    listeners.get('visibilitychange')!()
    expect(isPaused.value).toBe(false)
  })
})
