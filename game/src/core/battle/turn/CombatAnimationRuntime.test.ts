import { describe, expect, it, vi } from 'vitest'
import { CombatAnimationRuntime } from './CombatAnimationRuntime'
import { TurnBattleSystem, type TurnBattle } from './TurnBattleSystem'
import { CombatSystem } from '../../combat/CombatSystem'
import { EventBus } from '../../events/EventBus'
import { createBaseStats } from '../../stats/StatBlock'
import type { CombatEntity } from '../../combat/CombatEntity'
import { toTurnBattleParticipant } from '../../game/TurnBattleAdapter'
import { GENERIC_PHYSICAL_BASIC } from '../../../data/skill/TurnBasicAttacks'
import { PHAN_KICH } from '../../../data/skill/TheTuSkills'

// Combat Runtime Separation (Task 1, 2026-09-07) — CombatAnimationRuntime
// owns the presentation-ack timing state extracted from GameManager (P17).
// Fixture below mirrors the createCombatant()/participant() convention
// already used by TurnBattleSystem.test.ts — a real CombatSystem +
// TurnBattleSystem so declareActorAction/applyActionImpact/completeAction
// run for real (no mocking the business logic the runtime delegates to).

function createCombatant(id: string, overrides: Partial<CombatEntity> = {}): CombatEntity {
  const stats = createBaseStats({ evasionRate: 0, dexterity: 0, criticalRate: 0 })

  return {
    id,
    name: id,
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
    row: 4,
    alive: true,
    ...overrides,
  } as CombatEntity
}

function fixture() {
  const eventBus = new EventBus()
  const combatSystem = new CombatSystem(eventBus)
  const turnBattleSystem = new TurnBattleSystem(combatSystem)

  const player = toTurnBattleParticipant(
    createCombatant('player', { type: 'player', x: 0, row: 4 }),
    0,
    GENERIC_PHYSICAL_BASIC,
  )
  const enemy = toTurnBattleParticipant(
    createCombatant('enemy', { type: 'enemy', x: 2, row: 4 }),
    1,
    GENERIC_PHYSICAL_BASIC,
  )

  const battle: TurnBattle = {
    players: [player],
    enemies: [enemy],
    state: 'fighting',
    totalTurnsElapsed: 0,
  }

  const runtime = new CombatAnimationRuntime({
    getTurnBattleSystem: () => turnBattleSystem,
    eventBus,
    getTurnBattle: () => battle,
  })

  return { runtime, battle, player, enemy, eventBus, turnBattleSystem }
}

describe('CombatAnimationRuntime', () => {
  it('reports idle animation state when no phase is pending', () => {
    const runtime = new CombatAnimationRuntime({
      getTurnBattleSystem: () => ({}) as never,
      eventBus: { emit: vi.fn() } as never,
      getTurnBattle: () => null,
    })

    expect(runtime.getAnimationState('player')).toBe('idle')
  })

  it('notifyReadyActor → pendingReadyActor set → getAnimationState reports standby + emits turn_ready', () => {
    const { runtime, player, eventBus } = fixture()

    const events: string[] = []
    eventBus.on('turn_ready', () => events.push('turn_ready'))

    runtime.notifyReadyActor(player)

    expect(runtime.getAnimationState('player')).toBe('standby')
    expect(runtime.isActionPlaybackWaiting()).toBe(true)
    expect(events).toContain('turn_ready')
  })

  it('acknowledgeTurnReady → declares action → getAnimationState reports standby + emits turn_cast_start', () => {
    const { runtime, player, eventBus } = fixture()

    const events: string[] = []
    eventBus.on('turn_cast_start', () => events.push('turn_cast_start'))

    runtime.notifyReadyActor(player)
    const token = runtime.getPendingPlaybackToken()!
    runtime.acknowledgeTurnReady(token)

    expect(runtime.getAnimationState('player')).toBe('standby')
    expect(events).toContain('turn_cast_start')
  })

  // character-art-infra: the payload's slotRole selects the authored clip
  // downstream (ult vs attack). It comes from reference-comparing
  // declared.action.slot against the actor's slot objects - a basic/slotless
  // declare reports 'basic', the ultimate slot reports 'ultimate'.
  it('turn_cast_start carries slotRole basic for a slotless/basic declare', () => {
    const { runtime, player, eventBus } = fixture()

    const roles: (string | undefined)[] = []
    eventBus.on('turn_cast_start', (payload) => roles.push((payload as { slotRole?: string }).slotRole))

    runtime.notifyReadyActor(player)
    runtime.acknowledgeTurnReady(runtime.getPendingPlaybackToken()!)

    expect(roles).toEqual(['basic'])
  })

  it('turn_cast_start carries slotRole ultimate when the declared slot IS actor.ultimate', () => {
    const { runtime, player, eventBus, turnBattleSystem } = fixture()

    const ultSlot = { skill: GENERIC_PHYSICAL_BASIC, remainingCooldownTurns: 0 }
    player.ultimate = ultSlot

    const realDeclare = turnBattleSystem.declareActorAction.bind(turnBattleSystem)
    vi.spyOn(turnBattleSystem, 'declareActorAction').mockImplementation((battle, actor) => {
      const declared = realDeclare(battle, actor)
      if (declared.action) {
        declared.action = { ...declared.action, slot: ultSlot }
      }
      return declared
    })

    const roles: (string | undefined)[] = []
    eventBus.on('turn_cast_start', (payload) => roles.push((payload as { slotRole?: string }).slotRole))

    runtime.notifyReadyActor(player)
    runtime.acknowledgeTurnReady(runtime.getPendingPlaybackToken()!)

    expect(roles).toEqual(['ultimate'])
  })

  // Clean-A2 R2-F7: a charge-RESOLVE turn carries no slot (action is null -
  // the slot was consumed at commit), but declared.chargedSkill IS the
  // slot's skill object. The resolve hit must report the same role the
  // commit did, or the resolve silently degrades ult->attack.
  it('turn_cast_start reports the charged slot role on the resolve turn', () => {
    const { runtime, player, eventBus, turnBattleSystem } = fixture()

    const ultSkill = { ...GENERIC_PHYSICAL_BASIC, id: 'charged_ult_test' }
    player.ultimate = { skill: ultSkill, remainingCooldownTurns: 0 }

    const realDeclare = turnBattleSystem.declareActorAction.bind(turnBattleSystem)
    vi.spyOn(turnBattleSystem, 'declareActorAction').mockImplementation((battle, actor) => {
      const declared = realDeclare(battle, actor)
      // Simulate the resolve turn: no action slot, chargedSkill present.
      declared.action = null
      ;(declared as { chargedSkill?: unknown }).chargedSkill = ultSkill
      return declared
    })

    const roles: (string | undefined)[] = []
    eventBus.on('turn_cast_start', (payload) => roles.push((payload as { slotRole?: string }).slotRole))

    runtime.notifyReadyActor(player)
    runtime.acknowledgeTurnReady(runtime.getPendingPlaybackToken()!)

    expect(roles).toEqual(['ultimate'])
  })

  // Clean-B F-CB2-02: a declared turn that is NOT a cast (charge-
  // continuation / skipped - action null AND chargedSkill null) reports
  // 'none' so presentation skips the attack tell instead of replaying it
  // every channeling turn.
  it('turn_cast_start reports none for a non-cast declared turn', () => {
    const { runtime, player, eventBus, turnBattleSystem } = fixture()

    const realDeclare = turnBattleSystem.declareActorAction.bind(turnBattleSystem)
    vi.spyOn(turnBattleSystem, 'declareActorAction').mockImplementation((battle, actor) => {
      const declared = realDeclare(battle, actor)
      // Simulate a charge-continuation turn: no action, no resolved charge.
      declared.action = null
      return declared
    })

    const roles: (string | undefined)[] = []
    eventBus.on('turn_cast_start', (payload) => roles.push((payload as { slotRole?: string }).slotRole))

    runtime.notifyReadyActor(player)
    runtime.acknowledgeTurnReady(runtime.getPendingPlaybackToken()!)

    expect(roles).toEqual(['none'])
  })

  it('acknowledgeActionImpact → applies impact → getAnimationState reports standby + emits action_impact', () => {
    const { runtime, player, eventBus } = fixture()

    const events: string[] = []
    eventBus.on('action_impact', () => events.push('action_impact'))

    runtime.notifyReadyActor(player)
    const token = runtime.getPendingPlaybackToken()!
    runtime.acknowledgeTurnReady(token)
    runtime.acknowledgeActionImpact(token)

    expect(runtime.getAnimationState('player')).toBe('standby')
    expect(events).toContain('action_impact')
  })

  it('acknowledgeActionComplete → clears pending phase, emits turn_standby_complete', () => {
    const { runtime, player, eventBus } = fixture()

    const events: string[] = []
    eventBus.on('turn_standby_complete', () => events.push('turn_standby_complete'))

    runtime.notifyReadyActor(player)
    const token = runtime.getPendingPlaybackToken()!
    runtime.acknowledgeTurnReady(token)
    runtime.acknowledgeActionImpact(token)
    runtime.acknowledgeActionComplete(token)

    expect(runtime.getAnimationState('player')).toBe('idle')
    expect(runtime.isActionPlaybackWaiting()).toBe(false)
    expect(events).toContain('turn_standby_complete')
  })

  // The RESOLVED payload owns presentation: composite/empowered lanes fire a
  // different skill than action.skill, so action_impact must emit
  // execution.resolvedSkill.presetId first, falling back to action.skill.
  it('action_impact emits resolvedSkill.presetId over the root skill preset', () => {
    const { runtime, player, eventBus, turnBattleSystem } = fixture()

    const emittedPresets: (string | undefined)[] = []
    eventBus.on('action_impact', (payload) => emittedPresets.push((payload as { presetId?: string }).presetId))

    const realDeclare = turnBattleSystem.declareActorAction.bind(turnBattleSystem)
    vi.spyOn(turnBattleSystem, 'declareActorAction').mockImplementation((battle, actor) => {
      const declared = realDeclare(battle, actor)
      if (declared.execution?.resolvedSkill) {
        declared.execution = {
          ...declared.execution,
          resolvedSkill: { ...declared.execution.resolvedSkill, presetId: 'holy_radiance' },
        }
      }
      return declared
    })

    runtime.notifyReadyActor(player)
    const token = runtime.getPendingPlaybackToken()!
    runtime.acknowledgeTurnReady(token)
    runtime.acknowledgeActionImpact(token)

    expect(emittedPresets).toContain('holy_radiance')
  })

  it('action_impact falls back to action.skill.presetId when resolvedSkill authors none', () => {
    const { runtime, player, eventBus, turnBattleSystem } = fixture()

    const emittedPresets: (string | undefined)[] = []
    eventBus.on('action_impact', (payload) => emittedPresets.push((payload as { presetId?: string }).presetId))

    const realDeclare = turnBattleSystem.declareActorAction.bind(turnBattleSystem)
    vi.spyOn(turnBattleSystem, 'declareActorAction').mockImplementation((battle, actor) => {
      const declared = realDeclare(battle, actor)
      if (declared.execution?.resolvedSkill) {
        declared.execution = {
          ...declared.execution,
          resolvedSkill: { ...declared.execution.resolvedSkill, presetId: undefined },
        }
      }
      if (declared.action?.skill) {
        declared.action = { ...declared.action, skill: { ...declared.action.skill, presetId: 'shadow_burst' } }
      }
      return declared
    })

    runtime.notifyReadyActor(player)
    const token = runtime.getPendingPlaybackToken()!
    runtime.acknowledgeTurnReady(token)
    runtime.acknowledgeActionImpact(token)

    expect(emittedPresets).toContain('shadow_burst')
  })

  it('acknowledgeTurnReady with a stale token is a no-op', () => {
    const { runtime, player } = fixture()

    runtime.notifyReadyActor(player)

    const currentToken = runtime.getPendingPlaybackToken()

    expect(currentToken).not.toBeNull()

    runtime.acknowledgeTurnReady('some-other-stale-token')

    // Stale ack ignored — actor still pending in the ready phase.
    expect(runtime.getAnimationState('player')).toBe('standby')
    expect(runtime.getPendingPlaybackToken()).toBe(currentToken)
  })

  it('AR-20: when presentation is active, acknowledgeTurnReady and acknowledgeActionImpact reject missing or stale tokens', () => {
    const { runtime, player } = fixture()

    runtime.setPresentationActive(true)
    runtime.notifyReadyActor(player)

    const readyToken = runtime.getPendingPlaybackToken()!
    expect(readyToken).toBeTruthy()

    // 1. Empty/missing token from presentation -> rejected
    runtime.acknowledgeTurnReady('')
    expect(runtime.getAnimationState('player')).toBe('standby')

    // 2. Mismatched token -> rejected
    runtime.acknowledgeTurnReady('wrong_token')
    expect(runtime.getAnimationState('player')).toBe('standby')

    // 3. Correct token -> accepted, enters cast
    runtime.acknowledgeTurnReady(readyToken)
    expect(runtime.getAnimationState('player')).toBe('standby')

    const impactToken = runtime.getPendingPlaybackToken()!
    expect(impactToken).toBeTruthy()

    // 4. Empty/missing token on impact -> rejected
    runtime.acknowledgeActionImpact('')
    expect(runtime.getAnimationState('player')).toBe('standby')

    // 5. Correct token on impact -> accepted, enters standby
    runtime.acknowledgeActionImpact(impactToken)
    expect(runtime.getAnimationState('player')).toBe('standby')
  })

  it('manual mode: pauseForManualActor holds the turn and mints a playback token', () => {
    // Manual routing is decided by the turn token at CLAIM time (spec 3.2),
    // so a manual player-team turn never enters the renderer ready phase at
    // all - it arrives here directly.
    const { runtime, player, eventBus } = fixture()

    const attackEvents: string[] = []
    eventBus.on('attack', () => attackEvents.push('attack'))

    runtime.setBattleManualMode(true)
    runtime.pauseForManualActor(player)

    expect(runtime.isAwaitingManualTurnChoice()).toBe(true)
    expect(runtime.getAwaitedManualActor()?.id).toBe('player')
    expect(runtime.isActionPlaybackWaiting()).toBe(false)
    expect(attackEvents).toEqual([])
  })

  it('acknowledgeTurnReady declares even with manual mode on (toggle is a boundary command)', () => {
    // Flipping the manual toggle mid-turn is an external command and takes
    // effect at the NEXT turn boundary (spec 9.1). A turn already in flight
    // must finish, never strand its pipeline waiting for a choice.
    const { runtime, player } = fixture()

    runtime.notifyReadyActor(player)
    runtime.setBattleManualMode(true)
    runtime.acknowledgeTurnReady(runtime.getPendingPlaybackToken()!)

    expect(runtime.isAwaitingManualTurnChoice()).toBe(false)
    expect(runtime.getAnimationState('player')).toBe('standby')
  })

  it('submitTurnChoice declares the paused manual turn and clears the pause', () => {
    // Both modes declare and wait: the resolution pipeline owns impact and
    // completion from here, so the runtime no longer resolves inline.
    const { runtime, player } = fixture()

    runtime.setBattleManualMode(true)
    runtime.pauseForManualActor(player)

    expect(runtime.isAwaitingManualTurnChoice()).toBe(true)

    const submitted = runtime.submitTurnChoice('basic')

    expect(submitted).toBe(true)
    expect(runtime.isAwaitingManualTurnChoice()).toBe(false)
    expect(runtime.isActionPlaybackWaiting()).toBe(true)
    expect(runtime.getAnimationState('player')).toBe('standby')
  })

  it('submitTurnChoice with no pending pause is a safe no-op (returns false)', () => {
    const { runtime } = fixture()

    expect(runtime.submitTurnChoice('basic')).toBe(false)
  })

  it('disabling manual mode mid-pause cancels the pause', () => {
    const { runtime, player } = fixture()

    runtime.setBattleManualMode(true)
    runtime.pauseForManualActor(player)

    expect(runtime.isAwaitingManualTurnChoice()).toBe(true)

    runtime.setBattleManualMode(false)

    expect(runtime.isAwaitingManualTurnChoice()).toBe(false)
    expect(runtime.isBattleManualMode()).toBe(false)
  })

  it('setPresentationActive(false) drains a pending ready-phase immediately (idempotent teardown)', () => {
    const { runtime, player } = fixture()

    runtime.setPresentationActive(true)
    runtime.notifyReadyActor(player)

    expect(runtime.isActionPlaybackWaiting()).toBe(true)

    runtime.setPresentationActive(false)

    expect(runtime.isActionPlaybackWaiting()).toBe(false)

    // Idempotent — calling again does nothing further.
    runtime.setPresentationActive(false)

    expect(runtime.isActionPlaybackWaiting()).toBe(false)
  })

  it('presentation deactivation auto-drains a queued execution — never parks a committed cast for manual input (cleanA11 INT)', () => {
    // A queued repeat/multicast execution is an already-committed cast
    // (and a reactive entry an already-PAID reaction). Manual mode must
    // not strand it in awaitedManualActor - it resolves exactly once
    // through the auto declare->impact->complete path.
    const { runtime, battle, player, enemy, turnBattleSystem } = fixture()

    battle.queuedExecutions = [
      { actorId: 'player', rootSkill: GENERIC_PHYSICAL_BASIC, source: 'repeat', multicastDepth: 0 },
    ]

    const ready = turnBattleSystem.tickPacing(battle, false)

    expect(ready?.id).toBe('player')
    expect(turnBattleSystem.isPendingQueuedExecution('player')).toBe(true)

    runtime.setBattleManualMode(true)
    runtime.setPresentationActive(true)
    runtime.notifyReadyActor(ready!)

    // Route away mid-ready: the pending entry must drain, not park.
    runtime.setPresentationActive(false)

    expect(runtime.isAwaitingManualTurnChoice()).toBe(false)
    expect(turnBattleSystem.isPendingQueuedExecution('player')).toBe(false)
    expect(enemy.entity.currentHp).toBeLessThan(enemy.entity.maxHp)
  })

  it('isPresentationActive reflects the last setPresentationActive() call', () => {
    const { runtime } = fixture()

    expect(runtime.isPresentationActive()).toBe(false)

    runtime.setPresentationActive(true)

    expect(runtime.isPresentationActive()).toBe(true)
  })

  it('resetPendingState clears ready/manual-pause phases at once', () => {
    const { runtime, player } = fixture()

    runtime.setBattleManualMode(true)
    runtime.pauseForManualActor(player)

    expect(runtime.isAwaitingManualTurnChoice()).toBe(true)

    runtime.resetPendingState()

    expect(runtime.isAwaitingManualTurnChoice()).toBe(false)
    expect(runtime.isActionPlaybackWaiting()).toBe(false)
    expect(runtime.getAwaitedManualActor()).toBeNull()
  })

  it('getPendingPlaybackToken is null when nothing is pending', () => {
    const { runtime } = fixture()

    expect(runtime.getPendingPlaybackToken()).toBeNull()
  })

  it('reads getTurnBattleSystem() live at call time, not a value captured at construction', () => {
    // Regression guard: GameManager reassigns its this.turnBattleSystem
    // field wholesale on restartTurnBattleCycle()/startStage() (new
    // instance carrying the live buff registry + spawnEnemy factory).
    // If CombatAnimationRuntime captured the instance by value instead of
    // through a getter, every acknowledge*/submitTurnChoice call would
    // silently keep using the FIRST (stale) instance forever.
    const eventBus = new EventBus()
    const combatSystem = new CombatSystem(eventBus)
    let turnBattleSystem = new TurnBattleSystem(combatSystem)

    const player = toTurnBattleParticipant(
      createCombatant('player', { type: 'player', x: 0, row: 4 }),
      0,
      GENERIC_PHYSICAL_BASIC,
    )
    const enemy = toTurnBattleParticipant(
      createCombatant('enemy', { type: 'enemy', x: 2, row: 4 }),
      1,
      GENERIC_PHYSICAL_BASIC,
    )
    const battle: TurnBattle = { players: [player], enemies: [enemy], state: 'fighting', totalTurnsElapsed: 0 }

    const runtime = new CombatAnimationRuntime({
      getTurnBattleSystem: () => turnBattleSystem,
      eventBus,
      getTurnBattle: () => battle,
    })

    // Reassign to a brand-new instance AFTER the runtime was constructed —
    // mirrors a stage restart happening mid-session.
    const nextTurnBattleSystem = new TurnBattleSystem(combatSystem)
    const declareSpy = vi.spyOn(nextTurnBattleSystem, 'declareActorAction')
    turnBattleSystem = nextTurnBattleSystem

    runtime.notifyReadyActor(player)
    const token = runtime.getPendingPlaybackToken()!
    runtime.acknowledgeTurnReady(token)

    expect(declareSpy).toHaveBeenCalled()
  })

  describe('Task 3: hold-safe action runtime and preparePresentationResume', () => {
    it('returns null from preparePresentationResume when no phase is pending', () => {
      const { runtime } = fixture()
      expect(runtime.preparePresentationResume()).toBeNull()
    })

    it('resumes pending ready phase, renews token, invalidates old token', () => {
      const { runtime, player } = fixture()
      runtime.setPresentationActive(true)
      runtime.notifyReadyActor(player)
      const oldToken = runtime.getPendingPlaybackToken()!

      const resume = runtime.preparePresentationResume()!
      expect(resume).toBeDefined()
      expect(resume.phase).toBe('ready')
      if (resume.phase === 'ready') {
        expect(resume.actorId).toBe(player.id)
        expect(resume.token).not.toBe(oldToken)

        // Old token rejected
        runtime.acknowledgeTurnReady(oldToken)
        expect(runtime.getAnimationState(player.id)).toBe('standby')

        // New token accepted
        runtime.acknowledgeTurnReady(resume.token)
        expect(runtime.getAnimationState(player.id)).toBe('standby')
      }
    })

    it('resumes pending cast phase, renews token, invalidates old token', () => {
      const { runtime, player } = fixture()
      runtime.setPresentationActive(true)
      runtime.notifyReadyActor(player)
      const readyToken = runtime.getPendingPlaybackToken()!
      runtime.acknowledgeTurnReady(readyToken)
      const oldCastToken = runtime.getPendingPlaybackToken()!
      expect(runtime.getAnimationState(player.id)).toBe('standby')

      const resume = runtime.preparePresentationResume()!
      expect(resume).toBeDefined()
      expect(resume.phase).toBe('cast')
      if (resume.phase === 'cast') {
        // The resumed variant carries the whole cast fact (impact-sync):
        // source/skill/targets/slotRole live inside resume.cast, and the
        // fresh admission token inside cast.ref - same as the live emit.
        expect(resume.cast.source.entityId).toBe(player.id)
        expect(resume.cast.resolvedSkillId).toBeDefined()
        expect(resume.cast.declaredTargets).toBeDefined()
        expect(resume.token).not.toBe(oldCastToken)
        // The replayed onSkillCast needs the same clip the live emit selected.
        expect(resume.cast.slotRole).toBe('basic')

        // Old token rejected
        runtime.acknowledgeActionImpact(oldCastToken)
        expect(runtime.getAnimationState(player.id)).toBe('standby')

        // New token accepted -> advances to standby
        runtime.acknowledgeActionImpact(resume.token)
        expect(runtime.getAnimationState(player.id)).toBe('standby')
      }
    })

    // Clean-A F-2: a resumed cast replays onSkillCast - without the role a
    // resumed ULTIMATE would draw the 'attack' clip instead of 'ult'.
    it('resumed cast carries slotRole ultimate when the pending declare used the ultimate slot', () => {
      const { runtime, player, turnBattleSystem } = fixture()
      runtime.setPresentationActive(true)

      const ultSlot = { skill: GENERIC_PHYSICAL_BASIC, remainingCooldownTurns: 0 }
      player.ultimate = ultSlot

      const realDeclare = turnBattleSystem.declareActorAction.bind(turnBattleSystem)
      vi.spyOn(turnBattleSystem, 'declareActorAction').mockImplementation((battle, actor) => {
        const declared = realDeclare(battle, actor)
        if (declared.action) {
          declared.action = { ...declared.action, slot: ultSlot }
        }
        return declared
      })

      runtime.notifyReadyActor(player)
      runtime.acknowledgeTurnReady(runtime.getPendingPlaybackToken()!)

      const resume = runtime.preparePresentationResume()!
      expect(resume.phase).toBe('cast')
      if (resume.phase === 'cast') {
        expect(resume.cast.slotRole).toBe('ultimate')
      }
    })

    it('resumes pending complete phase, renews token, completes action on new token', () => {
      const { runtime, player } = fixture()
      runtime.setPresentationActive(true)
      runtime.notifyReadyActor(player)
      runtime.acknowledgeTurnReady(runtime.getPendingPlaybackToken()!)
      runtime.acknowledgeActionImpact(runtime.getPendingPlaybackToken()!)
      const oldCompleteToken = runtime.getPendingPlaybackToken()!
      expect(runtime.getAnimationState(player.id)).toBe('standby')

      const resume = runtime.preparePresentationResume()!
      expect(resume).toBeDefined()
      expect(resume.phase).toBe('complete')
      if (resume.phase === 'complete') {
        expect(resume.actorId).toBe(player.id)
        expect(resume.targetIds).toBeDefined()
        expect(resume.token).not.toBe(oldCompleteToken)

        // Old token rejected
        runtime.acknowledgeActionComplete(oldCompleteToken)
        expect(runtime.isActionPlaybackWaiting()).toBe(true)

        // New token accepted -> completes
        runtime.acknowledgeActionComplete(resume.token)
        expect(runtime.isActionPlaybackWaiting()).toBe(false)
      }
    })

    // Impact-sync sec.65: the remaining resume pins in one flow -
    // requestId survives reattachment (per-action latches stay aligned)
    // while the token rotates; a resume parked AFTER impact carries no
    // cast fact at all, so the scene can never restart an animation that
    // already struck; damage lands exactly once; complete once.
    it('resume pins: requestId stable, no cast re-deliver after impact, damage once', () => {
      const { runtime, player, eventBus } = fixture()
      runtime.setPresentationActive(true)

      const emitted: Array<{ ref: { requestId: string; token: string } }> = []
      eventBus.on('skill_presentation_cast', (cast) => {
        emitted.push(cast as { ref: { requestId: string; token: string } })
      })
      let impacts = 0
      eventBus.on('action_impact', () => {
        impacts++
      })

      runtime.notifyReadyActor(player)
      runtime.acknowledgeTurnReady(runtime.getPendingPlaybackToken()!)
      // The pipeline's impact step owns the publication point - the unit
      // fixture has no pipeline, so it invokes the same seam the step does.
      expect(runtime.publishPendingCast()).toBe(true)
      expect(emitted).toHaveLength(1)
      // Idempotent re-publication for the same declared action is a no-op
      // only after the ACK consumed it - a second emit now replays the
      // cast, which canStart (scene side) rejects as a duplicate.
      const originalRequestId = emitted[0]!.ref.requestId

      // Reattach pre-impact: 'cast' resume restarts playback on a fresh
      // token but keeps the requestId the latches are keyed on.
      const resumeCast = runtime.preparePresentationResume()!
      expect(resumeCast.phase).toBe('cast')
      if (resumeCast.phase !== 'cast') throw new Error('resume must be cast phase')
      expect(resumeCast.cast.ref.requestId).toBe(originalRequestId)
      expect(resumeCast.cast.ref.token).not.toBe(emitted[0]!.ref.token)
      expect(resumeCast.cast.ref.token).toBe(resumeCast.token)

      // Stale pre-reattach token is dead; the renewed one lands impact.
      runtime.acknowledgeActionImpact(emitted[0]!.ref.token)
      expect(impacts).toBe(0)
      runtime.acknowledgeActionImpact(resumeCast.token)
      expect(impacts).toBe(1)

      // Reattach post-impact: 'complete' resume carries NO cast fact -
      // restart is structurally impossible at this phase.
      const resumeComplete = runtime.preparePresentationResume()!
      expect(resumeComplete.phase).toBe('complete')
      expect('cast' in resumeComplete).toBe(false)
      if (resumeComplete.phase === 'complete') {
        runtime.acknowledgeActionComplete(resumeComplete.token)
      }
      expect(runtime.isActionPlaybackWaiting()).toBe(false)
      expect(impacts).toBe(1)
    })

    it('resumes pending manual choice phase', () => {
      const { runtime, player } = fixture()
      runtime.setPresentationActive(true)
      runtime.setBattleManualMode(true)
      runtime.pauseForManualActor(player)

      expect(runtime.isAwaitingManualTurnChoice()).toBe(true)

      const resume = runtime.preparePresentationResume()!
      expect(resume).toBeDefined()
      expect(resume.phase).toBe('manual')
      if (resume.phase === 'manual') {
        expect(resume.actorId).toBe(player.id)
      }

      // Choice still works
      expect(runtime.submitTurnChoice('basic')).toBe(true)
      expect(runtime.isAwaitingManualTurnChoice()).toBe(false)
    })

    it('manual resume re-mints the playback token so pre-resume callbacks go stale (F-BX-44)', () => {
      const { runtime, player, eventBus } = fixture()
      runtime.setPresentationActive(true)
      runtime.setBattleManualMode(true)
      runtime.pauseForManualActor(player)

      const resolved: unknown[] = []
      eventBus.on('skill_presentation_resolved', (fact) => resolved.push(fact))

      // Every resume branch renews the token once per re-attachment so a
      // stale renderer callback quoting a pre-detach token cannot match;
      // manual was the only branch that skipped the re-mint.
      const resume = runtime.preparePresentationResume()!
      expect(resume.phase).toBe('manual')
      if (resume.phase !== 'manual') return
      expect(resume.actorId).toBe(player.id)

      const resumeAgain = runtime.preparePresentationResume()!
      expect(resumeAgain.phase).toBe('manual')
      if (resumeAgain.phase !== 'manual') return
      expect(resumeAgain.token).not.toBe(resume.token)

      // The choice declares with the freshly minted token.
      expect(runtime.submitTurnChoice('basic')).toBe(true)
      expect(runtime.isAwaitingManualTurnChoice()).toBe(false)
      expect(runtime.getPendingPlaybackToken()).toBe(resumeAgain.token)

      // A callback quoting the earlier resume's (now stale) token is
      // rejected; the current token still admits the impact.
      runtime.acknowledgeActionImpact(resume.token)
      expect(resolved).toHaveLength(0)
      runtime.acknowledgeActionImpact(resumeAgain.token)
      expect(resolved).toHaveLength(1)
    })

    it('rejects all acknowledgments and manual choice while isSessionBlocking is true', () => {
      let blocking = true
      const eventBus = new EventBus()
      const combatSystem = new CombatSystem(eventBus)
      const turnBattleSystem = new TurnBattleSystem(combatSystem)
      const player = toTurnBattleParticipant(
        createCombatant('player', { type: 'player', x: 0, row: 4 }),
        0,
        GENERIC_PHYSICAL_BASIC,
      )
      const enemy = toTurnBattleParticipant(
        createCombatant('enemy', { type: 'enemy', x: 2, row: 4 }),
        1,
        GENERIC_PHYSICAL_BASIC,
      )
      const battle: TurnBattle = { players: [player], enemies: [enemy], state: 'fighting', totalTurnsElapsed: 0 }

      const runtime = new CombatAnimationRuntime({
        getTurnBattleSystem: () => turnBattleSystem,
        eventBus,
        getTurnBattle: () => battle,
        isSessionBlocking: () => blocking,
      })

      runtime.setPresentationActive(true)
      runtime.notifyReadyActor(player)
      const token = runtime.getPendingPlaybackToken()!

      // Blocked: acknowledgeTurnReady is rejected
      runtime.acknowledgeTurnReady(token)
      expect(runtime.getAnimationState(player.id)).toBe('standby')

      // Unblock: acknowledgeTurnReady is accepted
      blocking = false
      runtime.acknowledgeTurnReady(token)
      expect(runtime.getAnimationState(player.id)).toBe('standby')

      // Blocked again: acknowledgeActionImpact is rejected
      blocking = true
      runtime.acknowledgeActionImpact(token)
      expect(runtime.getAnimationState(player.id)).toBe('standby')

      // Unblock: accepted
      blocking = false
      runtime.acknowledgeActionImpact(token)
      expect(runtime.getAnimationState(player.id)).toBe('standby')

      // Blocked again: acknowledgeActionComplete rejected
      blocking = true
      runtime.acknowledgeActionComplete(token)
      expect(runtime.isActionPlaybackWaiting()).toBe(true)

      // Unblock: accepted
      blocking = false
      runtime.acknowledgeActionComplete(token)
      expect(runtime.isActionPlaybackWaiting()).toBe(false)
    })

    it('detachPresentation("hold") preserves pending work without drain', () => {
      const { runtime, player, battle } = fixture()
      runtime.setPresentationActive(true)
      runtime.notifyReadyActor(player)
      expect(runtime.isActionPlaybackWaiting()).toBe(true)

      runtime.detachPresentation('hold')
      expect(runtime.isActionPlaybackWaiting()).toBe(true)
      expect(battle.totalTurnsElapsed).toBe(0)
    })

    it('detachPresentation("headless") drains pending work', () => {
      const { runtime, player, battle } = fixture()
      runtime.setPresentationActive(true)
      runtime.notifyReadyActor(player)
      expect(runtime.isActionPlaybackWaiting()).toBe(true)

      runtime.detachPresentation('headless')
      expect(runtime.isActionPlaybackWaiting()).toBe(false)
      expect(battle.totalTurnsElapsed).toBe(1)
      expect(runtime.isPresentationActive()).toBe(false)
    })

    it('drain gate resolves a queued execution inline under manual mode (unit pin)', () => {
    // Unit-level pin for the drain gate (manager-level coverage lives in
    // GameManagerTurnBattleOps.presentationReceipt.test.ts): a repeat /
    // multicast execution is force-claimed manualMode:false, so at drain
    // the claim owner decides - not the live flag. Parking it in
    // awaitedManualActor would orphan the committed payload and leave
    // residue on an IDLE token.
    const { runtime, battle, player, enemy, turnBattleSystem } = fixture()

    battle.queuedExecutions = [
      { actorId: 'player', rootSkill: GENERIC_PHYSICAL_BASIC, source: 'repeat', multicastDepth: 0 },
    ]
    const actor = turnBattleSystem.tickPacing(battle, false)

    expect(actor?.id).toBe('player')

    runtime.setBattleManualMode(true)
    runtime.notifyReadyActor(actor!)
    runtime.drainPendingPlayback()

    expect(runtime.isAwaitingManualTurnChoice()).toBe(false)
    expect(runtime.getAwaitedManualActor()).toBeNull()
    expect(runtime.isActionPlaybackWaiting()).toBe(false)
    expect(enemy.entity.currentHp).toBeLessThan(enemy.entity.maxHp)
    expect(battle.log?.at(-1)).toMatchObject({ actorId: 'player', skillId: 'generic_physical' })
  })

  it('drain gate resolves a committed reactive bypass inline under manual mode (unit pin)', () => {
    // Same contract for the reactive lane: a queued Phan/Tro counter is a
    // committed action (declareReactiveBypass carries a forced payload),
    // so drainPendingPlayback must not re-park it into awaitedManualActor
    // on the live manual flag alone.
    const { runtime, battle, player, enemy, turnBattleSystem } = fixture()

    player.reactivePayloads = { phan_kich: PHAN_KICH }
    battle.queuedFollowUps = [
      {
        actorId: 'player',
        executionKind: 'reactive_bypass',
        actionSource: 'counter',
        payloadSkillId: 'phan_kich',
        targetIds: ['enemy'],
      },
    ]
    const actor = turnBattleSystem.tickPacing(battle, false)

    expect(actor?.id).toBe('player')

    runtime.setBattleManualMode(true)
    runtime.notifyReadyActor(actor!)
    runtime.drainPendingPlayback()

    expect(runtime.isAwaitingManualTurnChoice()).toBe(false)
    expect(runtime.getAwaitedManualActor()).toBeNull()
    expect(runtime.isActionPlaybackWaiting()).toBe(false)
    expect(enemy.entity.currentHp).toBeLessThan(enemy.entity.maxHp)
    expect(battle.log?.at(-1)).toMatchObject({ actorId: 'player', skillId: 'phan_kich', targetIds: ['enemy'] })
  })

  it('drain gate resolves an in-flight charge tick inline under manual mode (unit pin)', () => {
    // Same contract for the charge lane: chargingTurnsRemaining +
    // pendingChargedSkillId on the participant are a committed claim (the
    // cast committed at charge-init and declareActorAction's !isCharging
    // gate never reads a manual choice mid-charge), so drainPendingPlayback
    // must not re-park the actor into awaitedManualActor on the live flag.
    const { runtime, battle, player, enemy } = fixture()

    player.chargingTurnsRemaining = 1
    player.pendingChargedSkillId = 'charged_ult'
    player.ultimate = {
      skill: {
        id: 'charged_ult',
        cooldownTurns: 0,
        chargeTurns: 1,
        damage: { kind: 'physical', multiplier: 5 },
        targeting: { shape: 'single' },
      },
      remainingCooldownTurns: 0,
    }

    runtime.setBattleManualMode(true)
    runtime.notifyReadyActor(player)
    runtime.drainPendingPlayback()

    expect(runtime.isAwaitingManualTurnChoice()).toBe(false)
    expect(runtime.getAwaitedManualActor()).toBeNull()
    expect(runtime.isActionPlaybackWaiting()).toBe(false)
    expect(player.chargingTurnsRemaining).toBeUndefined()
    expect(player.pendingChargedSkillId).toBeUndefined()
    expect(enemy.entity.currentHp).toBeLessThan(enemy.entity.maxHp)
    expect(battle.log?.at(-1)).toMatchObject({ actorId: 'player', skillId: 'charged_ult' })
  })

  it('resetPendingState clears playbackToken so late callbacks cannot match', () => {
      const { runtime, player } = fixture()
      runtime.setPresentationActive(true)
      runtime.notifyReadyActor(player)
      const token = runtime.getPendingPlaybackToken()!

      runtime.resetPendingState()
      expect(runtime.getPendingPlaybackToken()).toBeNull()

      // Late ready callback with old token
      runtime.acknowledgeTurnReady(token)
      expect(runtime.isActionPlaybackWaiting()).toBe(false)
    })
  })
})
