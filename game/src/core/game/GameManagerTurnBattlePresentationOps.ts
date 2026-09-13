import type { EventBus } from '../events/EventBus'
import {
  PresentationSession,
  type PresentationMode,
  type SessionPresentationPort,
  type SessionRef,
} from '../presentation/PresentationSession'
import type { TurnBattle, TurnBattleSystem } from '../battle/turn/TurnBattleSystem'
import {
  CombatAnimationRuntime,
  type ResumePlayback,
} from '../battle/turn/CombatAnimationRuntime'
import {
  buildTurnBattleEntitySnapshot,
  type TurnBattleEntitySnapshotEvent,
} from '../battle/turn/TurnActionPresentationEvents'
import type { TurnSkillPresentationEntry } from '../combat/CombatSkillPresentation'
import { buildTurnSkillPresentation } from '../combat/CombatSkillPresentation'

/**
 * The three renderer signals the pipeline's asynchronous steps wait on.
 * Presentation owns this contract: the signals ARE renderer reports.
 */
export type TurnStepSignal = 'ready' | 'impact' | 'complete'

/**
 * Presentation facade for the turn battle (Wave-2 GameManagerTurnBattleOps
 * split; moved verbatim). Owns the presentation object graph:
 *
 * - PresentationSession - interactive-session hold/attach/release lifecycle;
 * - CombatAnimationRuntime - the presentation-ack timing state machine;
 * - presentationMode flag ('headless' | 'interactive').
 *
 * The scheduling core (clock/token/pipeline) reaches the owned objects via
 * the public `runtime`/`session` fields; this ops also carries the facade
 * methods GameManager forwards (ack tokens, session queries, snapshot).
 * Commands that drive the turn token or pipeline (setBattleManualMode,
 * submitTurnChoice) stay in the scheduling core - they are not pure
 * presentation reads.
 *
 * Public access: `gameManager.turnBattleOps.presentationOps.*`.
 */
export class GameManagerTurnBattlePresentationOps {
  readonly session: PresentationSession
  readonly runtime: CombatAnimationRuntime

  private presentationMode: PresentationMode = 'headless'

  constructor(
    private readonly deps: {
      sessionAllocator?: { allocate(): number }
      eventBus: EventBus
      // Live getters - turnBattleSystem/turnBattle are REASSIGNED wholesale
      // by the battle owner (restartTurnBattleCycle/startStage), so
      // capturing by value would freeze the runtime onto the first
      // registry-less instance.
      getTurnBattleSystem: () => TurnBattleSystem
      getBattle: () => TurnBattle | null
      // The clock's 'not-revealed' freeze reason re-evaluates after every
      // session transition (owned by the scheduling core).
      syncOffScreenFreeze: () => void
      // Pipeline settle for parked steps - deferred back into the core.
      settleStep: (signal: TurnStepSignal) => void
    },
  ) {
    this.session = new PresentationSession(deps.sessionAllocator)

    this.runtime = new CombatAnimationRuntime({
      getTurnBattleSystem: deps.getTurnBattleSystem,
      eventBus: deps.eventBus,
      getBattle: deps.getBattle,
      isSessionBlocking: () => this.session.isBlocking(),
      stepCompletionSink: {
        onReady: () => this.deps.settleStep('ready'),
        onImpact: () => this.deps.settleStep('impact'),
        onComplete: () => this.deps.settleStep('complete'),
      },
    })
  }

  setPresentationMode(mode: PresentationMode): void {
    this.presentationMode = mode
  }

  getPresentationMode(): PresentationMode {
    return this.presentationMode
  }

  getCurrentPresentationSession(): SessionRef | null {
    return this.session.getCurrentSession()
  }

  /**
   * The port the presentation coordinator drives. Every transition that can
   * change whether the battle is on screen re-evaluates the clock's
   * `not-revealed` freeze reason, so readiness reaches combat time through the
   * reason set and nowhere else.
   */
  getPresentationPort(): SessionPresentationPort {
    return {
      getCurrentSession: () => this.session.getCurrentSession(),
      isCurrentSession: (session) => this.session.isCurrentSession(session),
      hold: (session) => this.withOffScreenSync(() => this.session.hold(session)),
      attach: (token) => this.withOffScreenSync(() => this.session.attach(token)),
      release: (token) => this.withOffScreenSync(() => this.session.release(token)),
      detach: (token, policy) =>
        this.withOffScreenSync(() => this.session.detach(token, policy)),
    }
  }

  private withOffScreenSync<T>(operation: () => T): T {
    const result = operation()

    this.deps.syncOffScreenFreeze()

    return result
  }

  /** True while the current interactive session is held by the coordinator. */
  isAwaitingPresentationLayer(): boolean {
    return this.session.isBlocking()
  }

  /**
   * Pure snapshot query for presentation reconciliation (Task 4).
   * Validates sessionId, emits zero events, changes zero state, returns detached plain data.
   */
  getCombatPresentationSnapshot(sessionId: number): {
    sessionId: number
    entities: TurnBattleEntitySnapshotEvent
  } | null {
    const currentSession = this.session.getCurrentSession()
    if (!currentSession || currentSession.sessionId !== sessionId || currentSession.kind !== 'combat') {
      return null
    }

    const battle = this.deps.getBattle()

    if (!battle) {
      return null
    }

    return {
      sessionId,
      entities: buildTurnBattleEntitySnapshot(battle),
    }
  }

  getPendingPlaybackToken(): string | null {
    return this.runtime.getPendingPlaybackToken()
  }

  preparePresentationResume(): ResumePlayback | null {
    return this.runtime.preparePresentationResume()
  }

  setPresentationActive(active: boolean): void {
    this.runtime.setPresentationActive(active)
  }

  isActionPlaybackWaiting(): boolean {
    return this.runtime.isActionPlaybackWaiting()
  }

  /** Phaser gọi khi ready flourish xong → declare action, phát 'attack'. */
  acknowledgeTurnReady(token?: string): void {
    this.runtime.acknowledgeTurnReady(token)
  }

  /** Phaser gọi tại impact frame (lunge tween xong) → áp damage, phát VFX. */
  acknowledgeActionImpact(token?: string): void {
    this.runtime.acknowledgeActionImpact(token)
  }

  /** Phaser gọi khi VFX tween xong → turn cleanup, phát standby tail. */
  acknowledgeActionComplete(token?: string): void {
    this.runtime.acknowledgeActionComplete(token)
  }

  consumeAwaitedActorId(): string | null {
    return this.runtime.getAwaitedManualActor()?.id ?? null
  }

  isBattleManualMode(): boolean {
    return this.runtime.isBattleManualMode()
  }

  /**
   * Slice 7 — presentation facade: buildTurnSkillPresentation cho trận
   * turn hiện tại (isPlayerTurnPaused = manual pause đang chờ choice).
   * Party (Task 10): khi pause, presentation theo PAUSED ACTOR (bất kỳ
   * party member nào), không cố định players[0].
   */
  buildTurnSkillPresentation(
    battle: TurnBattle,
    isPlayerTurnPaused: boolean,
  ): {
    basic: TurnSkillPresentationEntry
    special: TurnSkillPresentationEntry
    ultimate: TurnSkillPresentationEntry
  } {
    return buildTurnSkillPresentation(
      battle,
      isPlayerTurnPaused,
      isPlayerTurnPaused
        ? (this.runtime.getAwaitedManualActor() ?? undefined)
        : undefined,
    )
  }
}
