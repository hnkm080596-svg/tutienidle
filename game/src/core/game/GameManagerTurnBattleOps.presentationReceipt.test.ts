import { afterEach, describe, expect, it, vi } from 'vitest'
import { GameManager } from './GameManager'
import { startAStage } from './__fixtures__/startAStage'
import { ManualClockSource, COMBAT_STEP_SECONDS } from '../battle/turn/CombatClock'
import { ANIMATION_FALLBACK_MS } from './GameManagerTurnBattleOps'
import { PHAN_KICH } from '../../data/skill/TheTuSkills'

afterEach(() => vi.useRealTimers())
function setup() {
  vi.useFakeTimers()
  const manager = new GameManager()
  const clock = new ManualClockSource()
  manager.setCombatClockSource(clock)
  manager.setPresentationActive(true)
  manager.setPresentationMode('interactive')
  startAStage(manager)
  const port = manager.getPresentationPort()
  const initial = port.hold(port.getCurrentSession()!)!
  port.attach(initial)
  port.release(initial)
  clock.advance(COMBAT_STEP_SECONDS * 260)
  return { manager, clock }
}
describe('production presentation handshake first proof', () => {
  it('publishes cast before result while headless pipeline settles synchronously', () => {
    const manager = new GameManager()
    const clock = new ManualClockSource()
    manager.setCombatClockSource(clock)
    const events: string[] = []
    manager.eventBus.on('skill_presentation_cast', () => events.push('cast'))
    manager.eventBus.on('skill_presentation_resolved', () => events.push('resolved'))
    startAStage(manager)
    clock.advance(COMBAT_STEP_SECONDS * 70)
    expect(events.length).toBeGreaterThanOrEqual(2)
    expect(events.slice(0, 2)).toEqual(['cast', 'resolved'])
    manager.abandonBattle()
  })
  it('publishes detached frozen cast and sealed result with stable resume identity', () => {
    const { manager } = setup()
    const casts: unknown[] = []
    const batches: unknown[] = []
    manager.eventBus.on('skill_presentation_cast', (value) => casts.push(value))
    manager.eventBus.on('skill_presentation_resolved', (value) => batches.push(value))
    manager.acknowledgeTurnReady(manager.getPendingPlaybackToken()!)
    expect(casts).toHaveLength(1)
    const cast = casts[0] as {
      ref: { sessionId: number; requestId: string; token: string }
      source: object
      declaredTargets: object[]
    }
    expect(Object.isFrozen(cast)).toBe(true)
    expect(Object.isFrozen(cast.source)).toBe(true)
    expect(cast.ref.sessionId).toBe(manager.getPresentationPort().getCurrentSession()!.sessionId)
    const resume = manager.preparePresentationResume() as unknown as { cast: typeof cast }
    expect(resume.cast.ref.requestId).toBe(cast.ref.requestId)
    expect(resume.cast.ref.token).not.toBe(cast.ref.token)
    manager.acknowledgeActionImpact(manager.getPendingPlaybackToken()!)
    expect(batches).toHaveLength(1)
    const batch = batches[0] as {
      sealed: boolean
      groups: { groupId: string; outcomes: { kind: string; operationId: string }[] }[]
    }
    expect(batch.sealed).toBe(true)
    expect(Object.isFrozen(batch.groups[0]!.outcomes)).toBe(true)
    expect(batch.groups[0]!.outcomes.some((o) => o.kind === 'hit' && !!o.operationId)).toBe(true)
    manager.acknowledgeActionComplete(manager.getPendingPlaybackToken()!)
    manager.abandonBattle()
  })
  it('preserves a held pending pipeline beyond watchdog and resumes once', () => {
    const { manager, clock } = setup()
    const port = manager.getPresentationPort()
    const session = port.getCurrentSession()!
    const hold = port.hold(session)!
    vi.advanceTimersByTime(16001)
    expect(manager.getTurnTokenState()).not.toBe('IDLE')
    expect(manager.getTurnBattle()!.totalTurnsElapsed).toBe(0)
    expect(port.attach(hold)).toBe(true)
    expect(port.release(hold)).toBe(true)
    const resume = manager.preparePresentationResume()!
    expect(resume.phase).toBe('ready')
    const token = manager.getPendingPlaybackToken()!
    manager.acknowledgeTurnReady(token)
    manager.acknowledgeActionImpact(token)
    manager.acknowledgeActionComplete(token)
    expect(manager.getTurnTokenState()).toBe('IDLE')
    expect(manager.getTurnBattle()!.totalTurnsElapsed).toBe(1)
    clock.advance(COMBAT_STEP_SECONDS * 200)
    expect(manager.getTurnTokenState()).not.toBe('IDLE')
    manager.abandonBattle()
  })
  it('drains pending playback mechanically at the deferral cap so the held turn completes', () => {
    const { manager } = setup()
    const port = manager.getPresentationPort()
    const hold = port.hold(port.getCurrentSession()!)!
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    // Under the cap the blocking re-arm keeps deferring without diagnostics.
    vi.advanceTimersByTime(ANIMATION_FALLBACK_MS * 7)
    expect(warn).not.toHaveBeenCalled()
    expect(manager.getTurnTokenState()).not.toBe('IDLE')

    // At the cap the runtime drains the pending playback inline - the same
    // settle the deactivation path performs - so the parked 'ready' step and
    // the rest of the pipeline complete even though the session stays held.
    vi.advanceTimersByTime(ANIMATION_FALLBACK_MS)
    expect(warn).toHaveBeenCalledTimes(1)
    const messages = warn.mock.calls.map((call) => String(call[0])).join(' ')
    expect(messages).toContain("step 'ready'")
    expect(messages).toContain('draining pending playback')
    expect(manager.getTurnBattle()!.totalTurnsElapsed).toBe(1)
    expect(manager.getTurnTokenState()).toBe('IDLE')

    // The drain runs once: more held time does not re-arm or warn again.
    vi.advanceTimersByTime(ANIMATION_FALLBACK_MS * 8)
    expect(warn).toHaveBeenCalledTimes(1)
    warn.mockRestore()

    // Unblocking later finds nothing pending: nothing replays, nothing
    // wedges, and the battle simply continues.
    expect(port.attach(hold)).toBe(true)
    expect(port.release(hold)).toBe(true)
    expect(manager.preparePresentationResume()).toBeNull()
    expect(manager.getTurnTokenState()).toBe('IDLE')
    manager.abandonBattle()
  })
  it('drain resolves an auto-claimed queued execution under manual mode - no manual-pause residue', () => {
    const { manager, clock } = setup()
    const port = manager.getPresentationPort()
    const battle = manager.getTurnBattle()!

    // The player's committed cast earns a follow-up execution; manual mode
    // makes every NEW player turn pause for input. repeatCasts is set on a
    // copy - the default basic is a shared module constant.
    const participant = battle.players[0]!
    participant.basic = { ...participant.basic!, repeatCasts: 1 }
    manager.setBattleManualMode(true)

    // Each ack is phase-gated, so one trio completes whichever phase is
    // parked - the renderer handshake, driven manually.
    const driveParkedTurn = () => {
      const token = manager.getPendingPlaybackToken()

      if (token) {
        manager.acknowledgeTurnReady(token)
        manager.acknowledgeActionImpact(token)
        manager.acknowledgeActionComplete(token)
      }
    }

    // Finish the turn setup() left parked at 'ready' so the manual flag
    // lands at the turn boundary.
    driveParkedTurn()
    expect(manager.getTurnTokenState()).toBe('IDLE')

    // Run the clock until the player's manual pause: queued executions and
    // enemy turns resolve through the manual handshakes in between. The
    // manual flag itself lands at the first fighting step's boundary drain.
    for (let i = 0; i < 400 && !manager.isAwaitingManualTurnChoice(); i++) {
      driveParkedTurn()

      if (manager.getTurnTokenState() === 'IDLE') {
        clock.advance(COMBAT_STEP_SECONDS)
      }
    }

    expect(manager.isAwaitingManualTurnChoice()).toBe(true)
    expect(manager.consumeAwaitedActorId()).toBe('player')

    // The committed first cast resolves through the normal handshake; its
    // completeAction queues the repeat execution.
    expect(manager.submitTurnChoice('basic')).toBe(true)
    driveParkedTurn()
    driveParkedTurn()
    expect(manager.getTurnTokenState()).toBe('IDLE')

    // The repeat claims as an AUTO turn - claim-time manualMode:false -
    // and parks at 'ready' even with manual mode on. (A real player turn
    // would pause at AWAITING_INPUT and never produce this phase.)
    clock.advance(COMBAT_STEP_SECONDS)
    const resume = manager.preparePresentationResume()
    expect(resume?.phase).toBe('ready')
    expect(resume && 'actorId' in resume && resume.actorId).toBe('player')

    // Renderer never acks: hold the session past the deferral cap so the
    // parked ready step drains mechanically.
    const hold = port.hold(port.getCurrentSession()!)!
    vi.advanceTimersByTime(ANIMATION_FALLBACK_MS * 8)

    // The drain must consult the claim owner - pendingQueuedExecution -
    // and resolve the committed payload inline. The bug misrouted it into
    // awaitedManualActor on the live battleManualMode flag alone: token
    // IDLE with a stale manual pause parked on it.
    expect(manager.getTurnTokenState()).toBe('IDLE')
    expect(manager.consumeAwaitedActorId()).toBeNull()
    expect(manager.preparePresentationResume()).toBeNull()

    // A queued repeat resolves on the parent's turn counter - the latest
    // player pair proving the committed payload ran rather than being
    // orphaned until a later declare drops or hijacks it.
    const playerEntries = (battle.log ?? []).filter((entry) => entry.actorId === 'player')
    expect(playerEntries.length).toBeGreaterThanOrEqual(2)
    expect(playerEntries[playerEntries.length - 1]!.turn)
      .toBe(playerEntries[playerEntries.length - 2]!.turn)

    // Reveal the session: no residue means a stray submit is refused, and
    // the battle walks on to the player's next real manual pause.
    expect(port.attach(hold)).toBe(true)
    expect(port.release(hold)).toBe(true)
    expect(manager.submitTurnChoice('basic')).toBe(false)
    for (let i = 0; i < 400 && !manager.isAwaitingManualTurnChoice(); i++) {
      driveParkedTurn()

      if (manager.getTurnTokenState() === 'IDLE') {
        clock.advance(COMBAT_STEP_SECONDS)
      }
    }

    expect(manager.isAwaitingManualTurnChoice()).toBe(true)
    manager.abandonBattle()
  })
  it('manual mode: a queued player reactive bypass claims AUTO - no AWAITING_INPUT pause', () => {
    // Claim-time exemption (the reactive sibling of the queued-exec lane):
    // a Phan/Tro counter declares through declareReactiveBypass with a
    // forced payload, so the claim must force manualMode:false - an
    // AWAITING_INPUT pause would solicit a manual choice the declare then
    // silently discards.
    const { manager, clock } = setup()
    const battle = manager.getTurnBattle()!
    const participant = battle.players[0]!
    const enemyId = battle.enemies[0]!.id
    participant.reactivePayloads = { phan_kich: PHAN_KICH }

    const driveParkedTurn = () => {
      const token = manager.getPendingPlaybackToken()

      if (token) {
        manager.acknowledgeTurnReady(token)
        manager.acknowledgeActionImpact(token)
        manager.acknowledgeActionComplete(token)
      }
    }

    // Finish the turn setup() left parked at 'ready', then enable manual
    // mode - the token is IDLE, so the flag applies immediately.
    driveParkedTurn()
    expect(manager.getTurnTokenState()).toBe('IDLE')
    manager.setBattleManualMode(true)

    // The next fighting step dequeues the committed entry BEFORE gauge
    // order and claims it.
    battle.queuedFollowUps = [
      {
        actorId: 'player',
        executionKind: 'reactive_bypass',
        actionSource: 'counter',
        payloadSkillId: 'phan_kich',
        targetIds: [enemyId],
      },
    ]
    clock.advance(COMBAT_STEP_SECONDS)

    // No manual pause: it parks at 'ready' like any auto claim.
    expect(manager.isAwaitingManualTurnChoice()).toBe(false)
    const resume = manager.preparePresentationResume()
    expect(resume?.phase).toBe('ready')
    expect(resume && 'actorId' in resume && resume.actorId).toBe('player')

    // The forced payload resolves through the normal handshake.
    driveParkedTurn()
    expect(manager.getTurnTokenState()).toBe('IDLE')
    // skillId is the proof the forced payload ran - targetIds only lists
    // landed targets, so an evasion dodge would make it RNG-dependent.
    expect(battle.log?.at(-1)).toMatchObject({ actorId: 'player', skillId: 'phan_kich' })
    manager.abandonBattle()
  })
  it('cap drain resolves a committed reactive bypass under manual mode - no manual-pause residue', () => {
    // Drain-time end-to-end pin: with manual on, the reactive entry still
    // auto-claims and parks at 'ready'; when the session stays held past
    // the deferral cap the mechanical drain must resolve it inline rather
    // than re-park it into awaitedManualActor on the live flag.
    const { manager, clock } = setup()
    const port = manager.getPresentationPort()
    const battle = manager.getTurnBattle()!
    const participant = battle.players[0]!
    const enemyId = battle.enemies[0]!.id
    participant.reactivePayloads = { phan_kich: PHAN_KICH }

    const driveParkedTurn = () => {
      const token = manager.getPendingPlaybackToken()

      if (token) {
        manager.acknowledgeTurnReady(token)
        manager.acknowledgeActionImpact(token)
        manager.acknowledgeActionComplete(token)
      }
    }

    driveParkedTurn()
    expect(manager.getTurnTokenState()).toBe('IDLE')
    manager.setBattleManualMode(true)

    battle.queuedFollowUps = [
      {
        actorId: 'player',
        executionKind: 'reactive_bypass',
        actionSource: 'counter',
        payloadSkillId: 'phan_kich',
        targetIds: [enemyId],
      },
    ]
    clock.advance(COMBAT_STEP_SECONDS)
    expect(manager.isAwaitingManualTurnChoice()).toBe(false)

    // Renderer never acks: hold the session past the deferral cap so the
    // parked ready step drains mechanically.
    const hold = port.hold(port.getCurrentSession()!)!
    vi.advanceTimersByTime(ANIMATION_FALLBACK_MS * 8)

    // Token drained to IDLE with no manual-pause residue, and the
    // committed payload actually executed rather than being orphaned.
    expect(manager.getTurnTokenState()).toBe('IDLE')
    expect(manager.consumeAwaitedActorId()).toBeNull()
    expect(manager.preparePresentationResume()).toBeNull()
    expect(battle.log?.at(-1)).toMatchObject({ actorId: 'player', skillId: 'phan_kich' })

    // Reveal the session: nothing replays and the battle walks on to the
    // player's next real manual pause.
    expect(port.attach(hold)).toBe(true)
    expect(port.release(hold)).toBe(true)
    for (let i = 0; i < 400 && !manager.isAwaitingManualTurnChoice(); i++) {
      driveParkedTurn()

      if (manager.getTurnTokenState() === 'IDLE') {
        clock.advance(COMBAT_STEP_SECONDS)
      }
    }

    expect(manager.isAwaitingManualTurnChoice()).toBe(true)
    manager.abandonBattle()
  })
  it('rescue-commit of a stranded manual turn survives a cap drain in the flag-flip window', () => {
    // setBattleManualMode(false) rescue: the stranded turn commits to AUTO
    // synchronously (submitChoice + beginTurnPipeline) while the flag-off
    // itself stays boundary-queued. A drain inside that window must
    // consult the claim, not the stale live flag - a committed claim is
    // never re-parked as manual.
    const { manager, clock } = setup()
    const port = manager.getPresentationPort()
    const battle = manager.getTurnBattle()!
    manager.setBattleManualMode(true)

    const driveParkedTurn = () => {
      const token = manager.getPendingPlaybackToken()

      if (token) {
        manager.acknowledgeTurnReady(token)
        manager.acknowledgeActionImpact(token)
        manager.acknowledgeActionComplete(token)
      }
    }

    for (let i = 0; i < 400 && !manager.isAwaitingManualTurnChoice(); i++) {
      driveParkedTurn()

      if (manager.getTurnTokenState() === 'IDLE') {
        clock.advance(COMBAT_STEP_SECONDS)
      }
    }

    expect(manager.isAwaitingManualTurnChoice()).toBe(true)
    const turnsBefore = battle.totalTurnsElapsed ?? 0

    // Hold the session first so the rescued pipeline parks at 'ready' and
    // the cap drain lands inside the boundary-queued flag window.
    const hold = port.hold(port.getCurrentSession()!)!
    manager.setBattleManualMode(false)
    vi.advanceTimersByTime(ANIMATION_FALLBACK_MS * 8)

    expect(manager.getTurnTokenState()).toBe('IDLE')
    expect(manager.consumeAwaitedActorId()).toBeNull()
    expect(manager.preparePresentationResume()).toBeNull()
    // The rescued turn actually ran to completion - not dropped.
    expect(battle.totalTurnsElapsed).toBe(turnsBefore + 1)

    // Reveal the session: nothing replays, and with manual off the
    // battle keeps auto-resolving turns - parked steps ack, the manual
    // pause never returns.
    expect(port.attach(hold)).toBe(true)
    expect(port.release(hold)).toBe(true)
    for (let i = 0; i < 40; i++) {
      driveParkedTurn()

      if (manager.getTurnTokenState() === 'IDLE') {
        clock.advance(COMBAT_STEP_SECONDS)
      }

      expect(manager.isAwaitingManualTurnChoice()).toBe(false)
    }

    expect(battle.totalTurnsElapsed).toBeGreaterThan(turnsBefore + 1)
    manager.abandonBattle()
  })
  // Impact-sync sec.64: the publication order is the contract - cast
  // publication always precedes the sealed result batch, in every claim/
  // presentation combination. Manual is exercised as itself, never as an
  // auto variant.
  it('publication order holds across auto/manual x interactive/headless (sec.64)', () => {
    for (const manual of [false, true]) {
      for (const interactive of [false, true]) {
        const manager = new GameManager()
        const clock = new ManualClockSource()
        manager.setCombatClockSource(clock)
        const events: string[] = []
        manager.eventBus.on('skill_presentation_cast', () => events.push('cast'))
        manager.eventBus.on('skill_presentation_resolved', () => events.push('resolved'))
        if (interactive) {
          manager.setPresentationActive(true)
          manager.setPresentationMode('interactive')
          startAStage(manager)
          // An interactive pipeline only mints playback work once a
          // session has attached - the attach/release handshake every
          // production handshake test performs.
          const port = manager.getPresentationPort()
          const hold = port.hold(port.getCurrentSession()!)!
          port.attach(hold)
          port.release(hold)
        } else {
          startAStage(manager)
        }

        const driveParked = () => {
          const token = manager.getPendingPlaybackToken()
          if (token) {
            manager.acknowledgeTurnReady(token)
            manager.acknowledgeActionImpact(token)
            manager.acknowledgeActionComplete(token)
          }
        }

        if (manual) {
          manager.setBattleManualMode(true)
          for (let i = 0; i < 400 && !manager.isAwaitingManualTurnChoice(); i++) {
            driveParked()
            if (manager.getTurnTokenState() === 'IDLE') {
              clock.advance(COMBAT_STEP_SECONDS)
            }
          }
          expect(manager.isAwaitingManualTurnChoice()).toBe(true)
          events.length = 0
          expect(manager.submitTurnChoice('basic')).toBe(true)
          driveParked()
        } else {
          events.length = 0
          for (let i = 0; i < 300 && events.length < 2; i++) {
            driveParked()
            clock.advance(COMBAT_STEP_SECONDS)
          }
          driveParked()
        }

        expect(
          events.length,
          `${manual ? 'manual' : 'auto'} x ${interactive ? 'interactive' : 'headless'} produced ${JSON.stringify(events)}`,
        ).toBeGreaterThanOrEqual(2)
        expect(
          events.slice(0, 2),
          `${manual ? 'manual' : 'auto'} x ${interactive ? 'interactive' : 'headless'}`,
        ).toEqual(['cast', 'resolved'])
        manager.abandonBattle()
      }
    }
  })
  // Impact-sync sec.60: the impact step is ALREADY parked when the cast
  // fact lands - an ACK delivered inside the cast subscriber settles that
  // exact step (impact applies exactly once) and the pipeline moves to
  // complete. This is the real early-ACK path the renderer drives.
  it('an ACK inside the cast subscriber settles the parked impact step exactly once', () => {
    const { manager } = setup()
    let impacts = 0
    let completes = 0
    manager.eventBus.on('action_impact', () => {
      impacts++
    })
    manager.eventBus.on('turn_battle_step_complete', () => {
      completes++
    })
    manager.eventBus.on('skill_presentation_cast', () => {
      manager.acknowledgeActionImpact(manager.getPendingPlaybackToken()!)
    })
    manager.acknowledgeTurnReady(manager.getPendingPlaybackToken()!)
    expect(impacts).toBe(1)
    manager.acknowledgeActionComplete(manager.getPendingPlaybackToken()!)
    expect(manager.getTurnTokenState()).toBe('IDLE')
    expect(manager.getTurnBattle()!.totalTurnsElapsed).toBe(1)
    manager.abandonBattle()
  })
  it('accepts synchronous complete from impact observer without losing pipeline settlement', () => {
    const { manager } = setup()
    let impacts = 0
    manager.eventBus.on('action_impact', () => {
      impacts++
      manager.acknowledgeActionComplete(manager.getPendingPlaybackToken()!)
    })
    manager.acknowledgeTurnReady(manager.getPendingPlaybackToken()!)
    manager.acknowledgeActionImpact(manager.getPendingPlaybackToken()!)
    expect(impacts).toBe(1)
    expect(manager.getTurnTokenState()).toBe('IDLE')
    expect(manager.getTurnBattle()!.totalTurnsElapsed).toBe(1)
    manager.abandonBattle()
  })
})
