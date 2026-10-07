// @vitest-environment node
// @ts-expect-error project omits Node ambient types by design (pattern: deadReferences.test.ts)
import { readFileSync } from 'node:fs'
// @ts-expect-error see above
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { GameManager } from '../../core/game/GameManager'
import { ManualClockSource, COMBAT_STEP_SECONDS } from '../../core/battle/turn/CombatClock'
import { ANIMATION_FALLBACK_MS } from '../../core/game/GameManagerTurnBattleOps'
import { startAStage } from '../../core/game/__fixtures__/startAStage'
import { OVERLAY_LAYERS } from '../../core/presentation/OverlayLayers'
import { useCombatPause } from '../../composables/useCombatPause'
import { EarlyGameSession } from '../../core/simulation/earlygame/EarlyGameSession'
import { getRequiredCultivation } from '../../core/realm/realmSystem'
import { buildGameSave } from './SaveSystem'
import { usePlayerStore } from '../../stores/player'
import { materials } from '../../data/materials/materials'
import { equipment } from '../../data/equipment/equipment'
import { affixes } from '../../data/equipment/affixes'
import { buildings } from '../../data/building/buildings'
import { pills } from '../../data/pill/pills'
import { alchemyRecipes } from '../../data/alchemy/alchemyRecipes'

// ============================================================================
// QA probe - fixpoint r37 INT wave. Blind integration-coherence audit of the
// r36 adjudication at 796df2ee (codex/hoa-cau-fireball-vfx). The r36 batch
// changed: (F1) step-7 carry filters 'user-pause', (F2) setCombatClockSource
// preserves the reason set verbatim, (F3) the admin-latch arm splices its
// fired handle, (F5) pendingStepGeneration epoch kills queued stale
// fallbacks, (F4) App.vue stateVersion watch tears down the stale curtain,
// (F6) EarlyGameSession.restoreCheckpoint discards before re-pointing.
//
//   (A) INT-1 - the epoch guard vs EVERY stale-callback window. A fallback
//       dequeued into the macrotask queue before its clearTimeout is the
//       only shape that can fire "stale". Same generation (map entry
//       already consumed by the real settle): must be a no-op - the
//       runtime's pending* phase guards reject the drive and done() is
//       idempotent via parkedOn mismatch. Cross generation (a
//       beginTurnPipeline/discard bumped the epoch): the closure must
//       early-return before touching the map or re-arming a timer.
//   (B) INT-2 - the 'user-pause' filter under MIXED latch sets and the
//       non-repeat terminal teardown.
//   (C) INT-3 - source swap while a session holds 'not-revealed': the
//       verbatim carry lands on the new clock, and the port's own
//       sync-off-screen pass still owns unlatching it post-swap.
//   (D) INT-4 - the curtain seam: OVERLAY_LAYERS pin plus the composable
//       contract (post-discard the isCombatActive gate blocks any re-latch,
//       so the stale flag is the only residue the App.vue watch owns).
//   (E) INT-5 - restoreCheckpoint mid-stage: the in-place $state rewrite
//       kills the live battle, releases the stage lease, and the journey
//       re-enters combat cleanly on the restored owner.
//   (F) INT-6 - r36-AUT-1 bounds: a stale playback token survives neither a
//       discard nor a battle replacement, and the ACK drain is bounded to
//       the in-flight turn's residual (one declare/impact/complete each).
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
  turnBattleSystem: {
    declareActorAction: (battle: unknown, actor: unknown) => unknown
  }
}

function opsInternals(manager: GameManager): OpsInternals {
  return manager.turnBattleOps as unknown as OpsInternals
}

/**
 * A parked interactive battle, non-repeat: ManualClockSource, presentation
 * active + interactive, one turn claimed and parked on its 'ready' step.
 */
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

/** Same park but with the auto-repeat flag so a terminal turn restarts. */
function parkRepeatGhost(manager: GameManager) {
  const clock = new ManualClockSource()
  manager.setCombatClockSource(clock)
  manager.setPresentationActive(true)
  manager.setPresentationMode('interactive')
  const player = startAStage(manager, { repeatContinuously: true })
  const port = manager.getPresentationPort()
  const hold = port.hold(port.getCurrentSession()!)!
  port.attach(hold)
  port.release(hold)
  clock.advance(COMBAT_STEP_SECONDS * 260)

  const battle = manager.getTurnBattle()
  expect(battle).not.toBeNull()
  expect(manager.getTurnTokenState()).not.toBe('IDLE')
  return { player, battle: battle!, clock, port }
}

/**
 * Drive the public renderer ACK surface until `until` holds or the pending
 * playback drains. Each acknowledge consumes only its own pending stage.
 * The awaits flush the microtask drain: settleStep -> done() -> pipeline ->
 * onTurnDrained -> settleCombatOutcome all run as promise continuations.
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
 * Captured setTimeout callbacks. The only channel that can fire a fallback
 * "stale" is a callback already dequeued into the macrotask queue when
 * clearTimeout ran - modelled by invoking the captured callback manually.
 * clearTimeout on the captured handle first consumes the fake-timer slot so
 * nothing fires twice. Install BEFORE the turn claims so the parked
 * fallback is in the list.
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
// (A) INT-1 - the cycle-epoch guard vs the queued stale callback.
// ----------------------------------------------------------------------------
describe('r37 INT - A: the queued stale fallback can touch nothing, in either generation', () => {
  it('same generation: a dequeued stale fallback is a provable no-op - the parked settle survives, the drive rejects on consumed pending*', async () => {
    vi.useFakeTimers()
    captureTimeouts()
    const manager = registeredManager()
    const { battle } = parkGhost(manager)
    const runtime = opsInternals(manager).turnBattleSystem
    const declareSpy = vi.spyOn(runtime, 'declareActorAction')

    // The 'ready' step is parked: its fallback is the last armed callback.
    const readyFallback = capturedCallbacks.at(-1)!
    const token = manager.getPendingPlaybackToken()!

    // The real renderer ACK lands first: settleStep consumes the parked
    // settle (clearTimeout + done), the pipeline advances to 'impact',
    // which arms its own fallback - same generation.
    manager.acknowledgeTurnReady(token)
    await flushMicrotasks()
    expect(declareSpy).toHaveBeenCalledTimes(1)
    const impactFallback = capturedCallbacks.at(-1)!
    expect(impactFallback).not.toBe(readyFallback)
    expect(opsInternals(manager).pendingStepDone['impact']).toBeTypeOf('function')

    // The 'ready' fallback was already dequeued before its clearTimeout -
    // it fires now, same generation, map entry gone.
    clearTimeout(readyFallback.handle)
    readyFallback.cb()
    await flushMicrotasks()

    // No second declare (pendingReadyActor consumed -> ACK reject), the
    // 'impact' settle was NOT wiped, and no extra timer was armed.
    expect(declareSpy).toHaveBeenCalledTimes(1)
    expect(opsInternals(manager).pendingStepDone['impact']).toBeTypeOf('function')
    expect(manager.getPendingPlaybackToken()).not.toBeNull()
    expect(manager.getTurnTokenState()).not.toBe('IDLE')

    // The live 'impact' channel still completes the step normally.
    await driveAcks(manager, () => manager.getTurnTokenState() === 'IDLE')
    expect(manager.getTurnTokenState()).toBe('IDLE')
    expect(battle.state).toBe('fighting')
    manager.discardStaleBattle()
  })

  it('same generation, post-drain: a stale complete fallback after the turn resolved cannot re-arm, re-drive, or wedge the token', async () => {
    vi.useFakeTimers()
    captureTimeouts()
    const manager = registeredManager()
    parkGhost(manager)
    const runtime = opsInternals(manager).turnBattleSystem
    const declareSpy = vi.spyOn(runtime, 'declareActorAction')

    await driveAcks(manager, () => manager.getTurnTokenState() === 'IDLE')
    expect(manager.getTurnTokenState()).toBe('IDLE')

    const staleComplete = capturedCallbacks.at(-1)!
    const handlesBefore = opsInternals(manager).pendingStepTimers.length
    const timersBefore = vi.getTimerCount()

    // Fires between the settle and the next beginTurnPipeline bump - same
    // generation, but every pending* is consumed and the pipeline parkedOn
    // is null: driveStepWork rejects on a missing token and done() no-ops.
    clearTimeout(staleComplete.handle)
    staleComplete.cb()
    await flushMicrotasks()

    expect(manager.getTurnTokenState()).toBe('IDLE')
    expect(declareSpy).toHaveBeenCalledTimes(1)
    expect(opsInternals(manager).pendingStepTimers.length).toBe(handlesBefore)
    expect(vi.getTimerCount()).toBe(timersBefore)
    manager.discardStaleBattle()
  })

  it('cross generation: the bumped epoch early-returns BEFORE the admin arm - a stale callback under a latch arms no timer at all', async () => {
    vi.useFakeTimers()
    captureTimeouts()
    const manager = registeredManager()
    const { clock } = parkGhost(manager)

    await driveAcks(manager, () => manager.getTurnTokenState() === 'IDLE')
    expect(manager.getTurnTokenState()).toBe('IDLE')

    // The drained turn's last armed callback is generation N. The next
    // claim -> beginTurnPipeline -> clearPendingSteps bumps to N+1.
    const staleCb = capturedCallbacks.at(-1)!
    clock.advance(COMBAT_STEP_SECONDS * 400)
    expect(manager.getTurnTokenState()).not.toBe('IDLE')
    const liveCb = capturedCallbacks.at(-1)!
    expect(liveCb).not.toBe(staleCb)

    manager.freezeCombat('authority-pause')

    // Stale generation: early return - not even the admin-latch re-arm.
    // (Consume the fake-timer slot first - the dequeue model - so the
    // delta below measures only what the callback itself does.)
    clearTimeout(staleCb.handle)
    const timersBeforeStale = vi.getTimerCount()
    staleCb.cb()
    expect(vi.getTimerCount()).toBe(timersBeforeStale)

    // Control: the LIVE callback under the same latch does re-arm
    // (splice fired handle + push live one) - proving the stale path
    // never reached the arm.
    clearTimeout(liveCb.handle)
    const timersBeforeLive = vi.getTimerCount()
    liveCb.cb()
    expect(vi.getTimerCount()).toBe(timersBeforeLive + 1)
    expect(manager.getTurnTokenState()).not.toBe('IDLE')

    manager.discardStaleBattle()
  })

  it('the isBlocking deferral arm leaves its fired handle unspliced - bounded residue: the cap drains the step and clearPendingSteps wipes all', async () => {
    vi.useFakeTimers()
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
    expect(manager.getPendingPlaybackToken()).not.toBeNull()

    // Re-hold the session: isBlocking() true, so each parked step's
    // fallback defers via setTimeout until deferredMs hits
    // AWAIT_STEP_DEFERRAL_CAP_MS (8 x FALLBACK), then drains pending
    // playback mechanically.
    const rehold = port.hold(port.getCurrentSession()!)!
    port.attach(rehold)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const ops = opsInternals(manager)

    // Enough windows for all three steps' own deferral rounds (each
    // awaitStep has a fresh deferredMs closure).
    vi.advanceTimersByTime(ANIMATION_FALLBACK_MS * 40)
    await flushMicrotasks()

    // The turn resolves mechanically despite the never-releasing session.
    expect(manager.getTurnTokenState()).toBe('IDLE')
    expect(warn).toHaveBeenCalled()

    // Residue is bounded: at most ~8 dead handles per parked step (one per
    // deferral fire; the deferral arm does not splice), so across three
    // steps the array stays under 30 - vs the pre-F3 admin arm which grew
    // unboundedly on a wedge. clearPendingSteps still wipes wholesale.
    expect(ops.pendingStepTimers.length).toBeLessThanOrEqual(30)
    manager.abandonBattle()
    expect(ops.pendingStepTimers.length).toBe(0)
    port.release(rehold)
    warn.mockRestore()
  })
})

// ----------------------------------------------------------------------------
// (B) INT-2 - 'user-pause' owner-scoped carry under MIXED latch sets, and the
// non-repeat terminal teardown.
// ----------------------------------------------------------------------------
describe('r37 INT - B: the user-pause filter composes with the surviving latch owners', () => {
  it("mixed latch carry: 'user-pause' + 'authority-pause' -> the new battle keeps only the session-scoped latch", async () => {
    vi.useFakeTimers()
    const manager = registeredManager()
    const { battle: oldBattle } = parkRepeatGhost(manager)

    oldBattle.enemies[0]!.entity.currentHp = 1
    manager.freezeCombat('user-pause')
    manager.freezeCombat('authority-pause')
    // 'turn-in-flight' is latched too (the claim is live) - the restart's
    // turnToken.reset() releases it before the step-7 snapshot.
    expect(manager.getFreezeReasons()).toEqual(
      expect.arrayContaining(['user-pause', 'authority-pause']),
    )

    await driveAcks(manager, () => manager.getTurnBattle() !== oldBattle)
    expect(manager.getTurnBattle()).not.toBe(oldBattle)

    // The filter drops only the battle-scoped reason; the session-scoped
    // latch carries verbatim, and its own owner still releases it.
    expect(manager.getFreezeReasons()).toEqual(['authority-pause'])
    expect(manager.getCombatClockState()).toBe('frozen')
    manager.resumeCombat('authority-pause')
    expect(manager.getCombatClockState()).toBe('running')
    manager.discardStaleBattle()
  })

  it("mixed latch carry: 'user-pause' + 'tab-hidden' -> only 'tab-hidden' survives", async () => {
    vi.useFakeTimers()
    const manager = registeredManager()
    const { battle: oldBattle } = parkRepeatGhost(manager)

    oldBattle.enemies[0]!.entity.currentHp = 1
    manager.freezeCombat('user-pause')
    manager.freezeCombat('tab-hidden')

    await driveAcks(manager, () => manager.getTurnBattle() !== oldBattle)

    expect(manager.getFreezeReasons()).toEqual(['tab-hidden'])
    manager.resumeCombat('tab-hidden')
    expect(manager.getCombatClockState()).toBe('running')
    manager.discardStaleBattle()
  })

  it('non-repeat combat-over under user-pause: stop() clears every reason - no carry seam exists outside the restart arm', async () => {
    vi.useFakeTimers()
    const manager = registeredManager()
    const { battle } = parkGhost(manager)

    battle.enemies[0]!.entity.currentHp = 1
    manager.freezeCombat('user-pause')

    await driveAcks(manager, () => battle.state !== 'fighting')

    expect(battle.state).toBe('victory')
    expect(manager.getCombatClockState()).toBe('stopped')
    expect(manager.getFreezeReasons()).toEqual([])
    // Terminal turn resolves the token to COMBAT_OVER, not IDLE.
    expect(manager.getTurnTokenState()).toBe('COMBAT_OVER')
  })
})

// ----------------------------------------------------------------------------
// (C) INT-3 - setCombatClockSource verbatim preserve vs 'not-revealed' ownership.
// ----------------------------------------------------------------------------
describe('r37 INT - C: source swap preserves latches and the session still owns not-revealed', () => {
  it('swap while the session holds the battle: not-revealed + turn-in-flight carry, and releasing the session unlatches post-swap', () => {
    vi.useFakeTimers()
    const manager = registeredManager()
    const { port } = parkGhost(manager)

    // Claimed turn ('turn-in-flight'), then re-hold + attach the session
    // so 'not-revealed' latches on top (release requires attach).
    const rehold = port.hold(port.getCurrentSession()!)!
    port.attach(rehold)
    expect(manager.getFreezeReasons()).toEqual(
      expect.arrayContaining(['turn-in-flight', 'not-revealed']),
    )

    manager.setCombatClockSource(new ManualClockSource())

    // The verbatim preserve lands both on the NEW clock - and the swap's
    // own syncOffScreenFreeze re-derives: still blocking, so it stays.
    expect(manager.getFreezeReasons()).toEqual(
      expect.arrayContaining(['turn-in-flight', 'not-revealed']),
    )
    expect(manager.getCombatClockState()).toBe('frozen')
    expect(manager.getTurnTokenState()).not.toBe('IDLE')

    // Post-swap the port still owns 'not-revealed': releasing the hold
    // unlatches it on the new clock while 'turn-in-flight' (the token's
    // latch, rebound not re-claimed) holds until the turn drains.
    port.release(rehold)
    expect(manager.getFreezeReasons()).toEqual(['turn-in-flight'])

    manager.discardStaleBattle()
  })

  it('double swap mid-turn preserves the latch set on both hops and the turn still drains after release', async () => {
    vi.useFakeTimers()
    const manager = registeredManager()
    const { battle } = parkGhost(manager)

    manager.freezeCombat('user-pause')
    manager.setCombatClockSource(new ManualClockSource())
    manager.setCombatClockSource(new ManualClockSource())

    expect(manager.getFreezeReasons()).toEqual(['turn-in-flight', 'user-pause'])
    expect(manager.getCombatClockState()).toBe('frozen')

    manager.resumeCombat('user-pause')
    expect(manager.getFreezeReasons()).toEqual(['turn-in-flight'])

    await driveAcks(manager, () => manager.getTurnTokenState() === 'IDLE')
    expect(manager.getTurnTokenState()).toBe('IDLE')
    expect(battle.state).toBe('fighting')
    manager.discardStaleBattle()
  })
})

// ----------------------------------------------------------------------------
// (D) INT-4 - the curtain teardown: layer pin + the composable contract.
// ----------------------------------------------------------------------------
describe('r37 INT - D: the Continue curtain cannot cover non-combat surfaces for long', () => {
  it('OVERLAY_LAYERS pin: the pause overlay stays strictly below the presentation curtain', () => {
    expect(OVERLAY_LAYERS.combatPause).toBeLessThan(OVERLAY_LAYERS.curtain)
  })

  it('useCombatPause post-discard: the stale flag is the only residue - the isCombatActive gate blocks any re-latch on a dead clock', () => {
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
      isCombatActive: () => manager.getCombatClockState() !== 'stopped',
    })

    // Hidden while fighting: isPaused + the 'tab-hidden' latch, same as App.
    visibility = 'hidden'
    listeners.get('visibilitychange')!()
    expect(isPaused.value).toBe(true)
    expect(manager.getFreezeReasons()).toContain('tab-hidden')

    // A discard kills the latch but cannot reach the flag - the exact
    // seam r36-INT-2's App.vue watch owns.
    manager.discardStaleBattle()
    expect(manager.getCombatClockState()).toBe('stopped')
    expect(manager.getFreezeReasons()).toEqual([])
    expect(isPaused.value).toBe(true)

    // Self-heal on Continue still works on the stopped clock.
    continueBattle()
    expect(isPaused.value).toBe(false)

    // And no re-latch is possible post-teardown: a hidden transition on a
    // stopped clock is gated by isCombatActive, so the flag stays down
    // (App.vue's watch clears any residue within one tick regardless).
    listeners.get('visibilitychange')!()
    expect(isPaused.value).toBe(false)
    expect(manager.getFreezeReasons()).toEqual([])
  })

  it('the App.vue watch still binds stateVersion -> reason check -> flag clear -> v-if binding (source pin refresh)', () => {
    const source = readFileSync(
      fileURLToPath(new URL('../../App.vue', import.meta.url)),
      'utf-8',
    )
    const watchAt = source.indexOf('watch(stateVersion')
    const pauseCheck = source.indexOf('isCombatPaused.value', watchAt)
    const reasonCheck = source.indexOf("getFreezeReasons().includes('tab-hidden')", watchAt)
    const clearAt = source.indexOf('isCombatPaused.value = false', watchAt)

    expect(watchAt).toBeGreaterThan(-1)
    expect(pauseCheck).toBeGreaterThan(watchAt)
    expect(reasonCheck).toBeGreaterThan(pauseCheck)
    expect(clearAt).toBeGreaterThan(reasonCheck)
    expect(source.indexOf('v-if="isCombatPaused"')).toBeGreaterThan(-1)
  })
})

// ----------------------------------------------------------------------------
// (E) INT-5 - restoreCheckpoint mid-battle: discard + lease release + re-entry.
// ----------------------------------------------------------------------------
describe('r37 INT - E: EarlyGameSession.restoreCheckpoint discards the live battle and the journey re-enters cleanly', () => {
  const PINNED = {
    name: 'probe',
    talentIds: ['hap_linh'],
  }

  it('restore on a session mid-stage-battle kills the battle, frees the stage lease, and runStage works post-restore', { timeout: 60000 }, () => {
    vi.useFakeTimers()
    vi.setSystemTime(currentMs)

    // First session builds a checkpoint that can win mortal_dong_1
    // (pinned starter needs the initiation kit: grind 12 -> ritual ->
    // allocate -> victory, same recipe as MortalChapterJourney leg A).
    const first = new EarlyGameSession({ seed: 11, profile: PINNED })
    while (first.player.realmLevel < 12) {
      const req = getRequiredCultivation(first.player.realmId, first.player.realmLevel)
      first.cultivate(req / first.player.cultivationPerSecond + 1)
      expect(first.breakthroughIfReady()).toBe(true)
    }
    expect(first.performRitual('spell', 'spell_pathway')).toBe(true)
    while (first.allocateAttribute('strength')) { /* str to cap */ }
    while (first.allocateAttribute('vitality')) { /* rest to vit */ }
    expect(first.runStage('mortal_dong_1')).toBe('victory')
    const save = buildGameSave(first.player, first.gameManager)

    // Second session parks MID-STAGE: a live 'fighting' battle object and
    // a held stage lease. (Headless turns drain inline, so the token reads
    // IDLE between claims - a modest advance keeps the weak pinned profile
    // alive and fighting, not yet resolved to combat-over.)
    const second = new EarlyGameSession({ seed: 31, profile: PINNED })
    const stage = second.gameManager.catalogOps.getStage('mortal_dong_1')
    expect(stage).toBeDefined()
    const entered = second.gameManager.turnBattleOps.startStage(second.player, stage!)
    expect(entered).toBe(true)
    expect(second.gameManager.getTurnBattle()).not.toBeNull()
    expect(second.gameManager.turnBattleOps.getStageProgress()).not.toBeNull()

    ;(second as unknown as { clock: ManualClockSource }).clock.advance(
      COMBAT_STEP_SECONDS * 80,
    )
    expect(second.gameManager.getTurnBattle()!.state).toBe('fighting')
    expect(second.gameManager.turnBattleOps.getStageProgress()).not.toBeNull()

    const owner = usePlayerStore()
    const result = second.restoreCheckpoint(save, owner)
    expect(result.status).toBe('ok')

    // The r36-AUT-3 seam: the battle and its stage lease die with the
    // pre-restore contents, the claimed token resets, the clock stops.
    expect(second.gameManager.getTurnBattle()).toBeNull()
    expect(second.gameManager.getCombatClockState()).toBe('stopped')
    expect(second.gameManager.getFreezeReasons()).toEqual([])
    expect(second.gameManager.getTurnTokenState()).toBe('IDLE')
    expect(second.gameManager.turnBattleOps.getStageProgress()).toBeNull()
    expect(second.player).toBe(owner.$state)

    // The restored journey re-enters combat on the checkpoint profile:
    // the stage lease is free, the new battle binds the restored owner.
    expect(second.runStage('mortal_dong_1')).toBe('victory')
    expect(second.player.completedStageIds).toContain('mortal_dong_1')
  })

  it('a REJECTED restore does not discard: the live mid-stage battle and its claimed turn survive intact', { timeout: 60000 }, () => {
    vi.useFakeTimers()
    vi.setSystemTime(currentMs)

    const first = new EarlyGameSession({ seed: 11, profile: PINNED })
    const save = buildGameSave(first.player, first.gameManager)
    // Incoherent-save recipe from TrucCoJourney (fails restore preflight):
    // progressed zhou_tian past the meridian gate + post-mortal realm.
    save.player.realmId = 'foundation_establishment'
    delete save.player.mortalBasicSkillId
    save.player.bodyProgression.zhou_tian.completed = 2

    const second = new EarlyGameSession({ seed: 31, profile: PINNED })
    const stage = second.gameManager.catalogOps.getStage('mortal_dong_1')
    expect(second.gameManager.turnBattleOps.startStage(second.player, stage!)).toBe(true)
    // A few steps in - headless turns drain inline so the token reads IDLE
    // between claims; the live battle + held lease are the seam state.
    ;(second as unknown as { clock: ManualClockSource }).clock.advance(
      COMBAT_STEP_SECONDS * 80,
    )
    const liveBattle = second.gameManager.getTurnBattle()
    expect(liveBattle).not.toBeNull()
    expect(liveBattle!.state).toBe('fighting')
    expect(second.gameManager.turnBattleOps.getStageProgress()).not.toBeNull()

    const owner = usePlayerStore()
    const result = second.restoreCheckpoint(save, owner)
    expect(result.status).toBe('rejected')

    // No $state rewrite happened, so nothing is discarded: the battle
    // object, its fighting state, and the stage lease all survive
    // untouched - the discard is gated on a SUCCESSFUL restore.
    expect(second.gameManager.getTurnBattle()).toBe(liveBattle)
    expect(liveBattle!.state).toBe('fighting')
    expect(second.gameManager.turnBattleOps.getStageProgress()).not.toBeNull()
    expect(second.player).not.toBe(owner.$state)
  })
})

// ----------------------------------------------------------------------------
// (F) INT-6 - r36-AUT-1 bounds: the ACK channel under a latch is bounded to
// the in-flight turn's residual and cannot cross an owner.
// ----------------------------------------------------------------------------
describe('r37 INT - F: finish-the-swing bounds hold', () => {
  it('a stale playback token cannot drive work on the post-discard replacement battle', async () => {
    vi.useFakeTimers()
    const manager = registeredManager()
    parkGhost(manager)
    const staleToken = manager.getPendingPlaybackToken()!

    manager.discardStaleBattle()
    expect(manager.getTurnBattle()).toBeNull()

    // New battle, new turn, new minted token. The stale one must reject on
    // BOTH guards (!battle was the discard path; token mismatch now).
    const clock = new ManualClockSource()
    manager.setCombatClockSource(clock)
    startAStage(manager)
    const port = manager.getPresentationPort()
    const hold = port.hold(port.getCurrentSession()!)!
    port.attach(hold)
    port.release(hold)
    clock.advance(COMBAT_STEP_SECONDS * 260)
    expect(manager.getPendingPlaybackToken()).not.toBeNull()
    expect(manager.getPendingPlaybackToken()).not.toBe(staleToken)

    const runtime = opsInternals(manager).turnBattleSystem
    const declareSpy = vi.spyOn(runtime, 'declareActorAction')

    manager.acknowledgeTurnReady(staleToken)
    manager.acknowledgeActionImpact(staleToken)
    manager.acknowledgeActionComplete(staleToken)
    await flushMicrotasks()

    expect(declareSpy).not.toHaveBeenCalled()
    expect(manager.getPendingPlaybackToken()).not.toBeNull()
    manager.discardStaleBattle()
  })

  it('the ACK drain under an administrative latch is bounded to the in-flight residual - post-drain repeats are inert', async () => {
    vi.useFakeTimers()
    const manager = registeredManager()
    parkGhost(manager)
    const runtime = opsInternals(manager).turnBattleSystem
    const declareSpy = vi.spyOn(runtime, 'declareActorAction')
    const token = manager.getPendingPlaybackToken()!

    manager.freezeCombat('authority-pause')

    // The claimed turn completes under the latch (finish-the-swing):
    // ready -> impact -> complete, each consumed exactly once.
    manager.acknowledgeTurnReady(token)
    manager.acknowledgeActionImpact(token)
    manager.acknowledgeActionComplete(token)
    await flushMicrotasks()

    expect(manager.getTurnTokenState()).toBe('IDLE')
    expect(declareSpy).toHaveBeenCalledTimes(1)
    expect(manager.getFreezeReasons()).toEqual(['authority-pause'])

    // Replays of the same token after the residual drained are inert:
    // pending* consumed AND the token no longer pending.
    manager.acknowledgeTurnReady(token)
    manager.acknowledgeActionImpact(token)
    manager.acknowledgeActionComplete(token)
    await flushMicrotasks()
    expect(declareSpy).toHaveBeenCalledTimes(1)
    expect(manager.getTurnTokenState()).toBe('IDLE')

    manager.discardStaleBattle()
  })
})
