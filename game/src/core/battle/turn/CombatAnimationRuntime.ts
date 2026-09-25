import { TurnBattleSystem, type TurnBattle, type TurnBattleParticipant, type TurnDeclaredAction } from './TurnBattleSystem'
import type { ForcedTurnChoice } from './TurnSkillAction'
import { emitTurnReady, emitTurnCastStart, emitTurnActionImpact, emitTurnStandbyComplete } from './TurnActionPresentationEvents'
import type { EventBus } from '../../events/EventBus'
import type { CombatAnimationName } from '../CombatAnimationTypes'
import { buildSkillCastPresentation, freezePresentation, sealSkillPresentation, type SkillCastPresentation, type SkillPresentationResolved } from './SkillPresentationFacts'

export type ResumePlayback =
  | Readonly<{ phase: 'ready'; token: string; actorId: string }>
  | Readonly<{ phase: 'cast'; token: string; actorId: string; skillId: string; targetIds: readonly string[]; cast: SkillCastPresentation }>
  | Readonly<{ phase: 'complete'; token: string; actorId: string; targetIds: readonly string[]; resolved: SkillPresentationResolved }>
  | Readonly<{ phase: 'manual'; actorId: string }>

/**
 * Combat Runtime Separation (2026-09-07, AGENTS.md P17) — owns the
 * presentation-ack timing state that used to live directly as loose private
 * fields on GameManager: 5-phase state machine (ready -> cast -> impact ->
 * complete) and the manual-mode pause.
 *
 * Readiness is NOT owned here. PresentationSession (held per interactive
 * session by the presentation coordinator) is the single readiness
 * authority; this runtime only asks it via deps.isSessionBlocking().
 *
 * This class's only job is TIMING — advance/hold the phase, pick the
 * current animation state, and signal Phaser via the event bus. It owns
 * NONE of the actual combat logic (targeting, damage, wave triggers) —
 * every mutation still routes through the injected TurnBattleSystem, whose
 * business-logic methods this class merely calls at the same points the
 * original inline GameManager code did. Ack contract (the public methods
 * CombatScene.ts calls) is unchanged — only ownership moved.
 */
export class CombatAnimationRuntime {
  constructor(
    private readonly deps: {
      // Live getter, NOT a captured value — GameManager reassigns its
      // this.turnBattleSystem field wholesale on every restartTurnBattleCycle()/
      // startStage() (new instance carries the live buff registry +
      // spawnEnemy factory). Capturing the instance by value at
      // construction time would silently freeze every acknowledge*/
      // submitTurnChoice call onto the FIRST (registry-less) instance
      // forever — same live-reference requirement as getTurnBattle() below.
      getTurnBattleSystem: () => TurnBattleSystem
      eventBus: EventBus
      getTurnBattle: () => TurnBattle | null
      isSessionBlocking?: () => boolean
      getSessionId?: () => number
      /**
       * Combat Turn Mechanism (2026-09-10 spec section 4.1a) — the runtime
       * reports that an asynchronous step FINISHED without knowing what a
       * pipeline is. Each hook fires as the last statement of its ack body,
       * so battle state is already applied when the pipeline advances.
       */
      stepCompletionSink?: { onReady(): void; onImpact(): void; onComplete(): void }
    },
  ) {}

  // --- Slice 7 (Completion Task 10) — manual mode --------------------------

  private battleManualMode = false

  /**
   * Actor phe player đang bị PAUSE chờ manual choice (manual mode), hoặc
   * null khi không pause (auto mode, lượt enemy, hoặc chưa tới lượt).
   * Reset khi battle kết thúc/restart.
   */
  private awaitedManualActor: TurnBattleParticipant | null = null

  /** Bật/tắt manual mode. Tắt giữa lúc đang chờ choice → hủy pause, engine tự chạy tiếp. */
  setBattleManualMode(enabled: boolean): void {
    this.battleManualMode = enabled

    if (!enabled) {
      this.awaitedManualActor = null
    }
  }

  isBattleManualMode(): boolean {
    return this.battleManualMode
  }

  /**
   * The runtime's LOCAL record that it is holding an actor for a manual
   * choice. It is bookkeeping for identity (which actor, which token), not the
   * authority: whether combat is awaiting input is answered by the turn token
   * (see GameManagerTurnBattleOps.isAwaitingManualTurnChoice, which is what
   * GameManager and the UI read). Kept public for this class's own tests.
   */
  isAwaitingManualTurnChoice(): boolean {
    return this.awaitedManualActor !== null
  }

  /** The actor currently paused awaiting a manual choice, or null. Used by
   * GameManager's consumeAwaitedActorId()/buildTurnSkillPresentation(). */
  getAwaitedManualActor(): TurnBattleParticipant | null {
    return this.awaitedManualActor
  }

  // --- Action Playback Task 6 (2026-09-05) — presentation orchestration ---

  /**
   * false (mặc định): fixed-step tick resolve turn ngay lập tức (mọi
   * headless test không đổi). true (CombatScene mount): engine chạy 5-phase
   * state machine — ready → cast → impact → complete — chờ Phaser
   * acknowledge qua 3 method dưới trước khi sang bước kế.
   */
  private presentationActive = false

  /** Tick đã peek actor ready, chờ acknowledgeTurnReady(). */
  private pendingReadyActor: TurnBattleParticipant | null = null

  /** Đã declare action, chờ acknowledgeActionImpact(). */
  private pendingDeclaredAction: { actor: TurnBattleParticipant; declared: TurnDeclaredAction; cast: SkillCastPresentation } | null = null

  /** Đã áp damage, chờ acknowledgeActionComplete(). */
  private pendingImpact: { actor: TurnBattleParticipant; declared: TurnDeclaredAction; targetIds: string[]; resolved: SkillPresentationResolved } | null = null
  private requestSequence = 0
  private publishingImpact = false
  private deferredCompleteToken: string | undefined

  private declarePresentation(actor: TurnBattleParticipant, declared: TurnDeclaredAction): SkillCastPresentation {
    return buildSkillCastPresentation({ sessionId: this.deps.getSessionId?.() ?? 0, requestId: `skill-request-${++this.requestSequence}`, token: this.playbackToken }, actor, declared)
  }

  // Remediation Task 1 (2026-09-05) — playback token: mỗi lần phase tiến
  // tới 'ready' sinh 1 token mới; stale ack (token cũ) là no-op, chặn
  // callback Phaser muộn đụng action/battle khác (cross-battle mutation).
  private playbackToken = ''
  private playbackTokenSeq = 0

  private nextPlaybackToken(): string {
    this.playbackTokenSeq += 1
    this.playbackToken = `playback-${this.playbackTokenSeq}`

    return this.playbackToken
  }

  /** Test/UI đọc token hiện tại của phase đang chờ (null nếu không pending). */
  getPendingPlaybackToken(): string | null {
    return this.pendingReadyActor !== null || this.pendingDeclaredAction !== null || this.pendingImpact !== null
      ? this.playbackToken
      : null
  }

  isPresentationActive(): boolean {
    return this.presentationActive
  }

  /**
   * Explicit playback-mode switch. `false` is the intentional headless path
   * and keeps the historical drain contract (see handlePresentationDeactivated).
   * A renderer FAILURE must never come through here - it uses
   * detachPresentation('hold'), which preserves pending work.
   */
  setPresentationActive(active: boolean): void {
    this.presentationActive = active

    if (!active) {
      this.handlePresentationDeactivated()
    }
  }

  /** Rời CombatScene giữa chừng — hoàn tất pending phases ngay lập tức
   * (headless path) để trận không bị treo. */
  handlePresentationDeactivated(): void {
    const battle = this.deps.getTurnBattle()
    const turnBattleSystem = this.deps.getTurnBattleSystem()

    if (this.pendingReadyActor && battle) {
      const actor = this.pendingReadyActor
      this.pendingReadyActor = null

      // Defect Task 4 (2026-09-05) — manual player ở ready-phase KHÔNG
      // được auto-resolve bằng AI khi rời scene: chuyển vào
      // awaitedManualActor giữ choice chờ submitTurnChoice (cùng nhánh
      // với acknowledgeTurnReady()).
      const isManualActor = this.battleManualMode && battle.players.includes(actor)

      if (isManualActor) {
        this.awaitedManualActor = actor
      } else {
        const declared = turnBattleSystem.declareActorAction(battle, actor)
        const { targetIds } = turnBattleSystem.applyActionImpact(battle, declared)
        turnBattleSystem.completeAction(battle, actor, declared, targetIds)
      }
    } else if (this.pendingDeclaredAction && battle) {
      const { actor, declared } = this.pendingDeclaredAction
      this.pendingDeclaredAction = null

      const { targetIds } = turnBattleSystem.applyActionImpact(battle, declared)
      turnBattleSystem.completeAction(battle, actor, declared, targetIds)
    } else if (this.pendingImpact && battle) {
      const { actor, declared, targetIds } = this.pendingImpact
      this.pendingImpact = null

      turnBattleSystem.completeAction(battle, actor, declared, targetIds)
    }

    // Leaving the scene mid-turn must not park the resolution pipeline: the
    // pending phases above were just drained, so every step this turn is
    // waiting on is reported complete, in order. Signals with nothing parked
    // behind them are no-ops.
    this.deps.stepCompletionSink?.onReady()
    this.deps.stepCompletionSink?.onImpact()
    this.deps.stepCompletionSink?.onComplete()
  }

  /**
   * A renderer acknowledgement is outstanding. This is NOT a second copy of
   * "a turn is in flight" (the token owns that): it is false during a manual
   * wait and false while the pipeline runs a mechanical step, and it is what
   * tells a caller which of the three handshake signals is still owed.
   */
  isActionPlaybackWaiting(): boolean {
    return this.pendingReadyActor !== null || this.pendingDeclaredAction !== null || this.pendingImpact !== null
  }

  /** Phaser gọi khi ready flourish xong → declare action, phát 'turn_cast_start'. */
  acknowledgeTurnReady(token?: string): void {
    if (this.deps.isSessionBlocking?.()) {
      return
    }

    // R5 (AR-20) — require identity at public boundary; reject missing, empty, or mismatched token.
    if (!token || token !== this.playbackToken) {
      return
    }

    const battle = this.deps.getTurnBattle()

    if (!this.pendingReadyActor || !battle) {
      return
    }

    const actor = this.pendingReadyActor
    this.pendingReadyActor = null

    // No manual branch here any more. Manual routing is decided by the turn
    // token at CLAIM time (spec section 3.2), before any ready phase exists,
    // so a ready phase always belongs to an auto turn. Flipping the manual
    // toggle mid-turn is an external command and takes effect at the next turn
    // boundary (spec section 9.1) — it must not strand the turn in flight.
    const declared = this.deps.getTurnBattleSystem().declareActorAction(battle, actor)
    const cast = this.declarePresentation(actor, declared)
    this.pendingDeclaredAction = { actor, declared, cast }

    emitTurnCastStart(this.deps.eventBus, actor.id, declared.skillId, declared.affected.map((target) => target.id))

    this.deps.stepCompletionSink?.onReady()
    this.deps.eventBus.emit('skill_presentation_cast', cast)
  }

  /** Phaser gọi tại impact frame (lunge tween xong) → áp damage, phát VFX. */
  acknowledgeActionImpact(token?: string): void {
    if (this.deps.isSessionBlocking?.()) {
      return
    }

    // R5 (AR-20) — require identity at public boundary; reject missing, empty, or mismatched token.
    if (!token || token !== this.playbackToken) {
      return
    }

    const battle = this.deps.getTurnBattle()

    if (!this.pendingDeclaredAction || !battle) {
      return
    }

    const { actor, declared, cast } = this.pendingDeclaredAction
    this.pendingDeclaredAction = null

    const { targetIds, extraImpacts, presentationGroups } = this.deps.getTurnBattleSystem().applyActionImpact(battle, declared)
    const resolved = sealSkillPresentation(cast.ref, presentationGroups)
    this.pendingImpact = { actor, declared, targetIds, resolved }
    this.publishingImpact = true

    const primaryTargetId = targetIds[0] ?? declared.affected[0]?.id ?? ''
    const anchorEntity =
      battle.players.find((member) => member.id === primaryTargetId)?.entity ??
      battle.enemies.find((enemy) => enemy.id === primaryTargetId)?.entity

    const row = anchorEntity?.row ?? 0
    const column = Math.round(anchorEntity?.x ?? 0)

    emitTurnActionImpact(this.deps.eventBus, {
      actionId: `${actor.id}-${battle.totalTurnsElapsed ?? 0}`,
      sourceId: actor.id,
      primaryTargetId,
      anchorCell: { row, column },
      affectedArea: {
        shape: declared.action?.targeting.shape ?? 'single',
        rowStart: row,
        rowEnd: row,
        colStart: column,
        colEnd: column,
      },
      affectedTargetIds: declared.affected.map((target) => target.id),
      landedTargetIds: targetIds,
      dodgedTargetIds: declared.affected
        .filter((target) => !targetIds.includes(target.id))
        .map((target) => target.id),
      hitCount: 1,
      presetId: declared.action?.skill?.presetId,
    })

    // Kiem Tu Reimagined Task 6 — each provider-returned extra impact
    // (combo payload) emits its OWN action_impact with its own preset,
    // so the fired combo is a distinct presentation event (K11).
    for (const extra of extraImpacts) {
      const extraPrimaryId = extra.landedTargetIds[0] ?? extra.targetIds[0] ?? ''
      const extraAnchor =
        battle.players.find((member) => member.id === extraPrimaryId)?.entity ??
        battle.enemies.find((enemy) => enemy.id === extraPrimaryId)?.entity
      const extraRow = extraAnchor?.row ?? row
      const extraCol = Math.round(extraAnchor?.x ?? column)

      emitTurnActionImpact(this.deps.eventBus, {
        actionId: `${actor.id}-${battle.totalTurnsElapsed ?? 0}-extra-${extraPrimaryId}`,
        sourceId: actor.id,
        primaryTargetId: extraPrimaryId,
        anchorCell: { row: extraRow, column: extraCol },
        affectedArea: {
          shape: extra.targeting?.shape ?? 'single',
          rowStart: extraRow,
          rowEnd: extraRow,
          colStart: extraCol,
          colEnd: extraCol,
        },
        affectedTargetIds: extra.targetIds,
        landedTargetIds: extra.landedTargetIds,
        dodgedTargetIds: extra.targetIds.filter((id) => !extra.landedTargetIds.includes(id)),
        hitCount: extra.hitCount,
        presetId: extra.presetId,
      })
    }

    this.deps.stepCompletionSink?.onImpact()
    this.deps.eventBus.emit('skill_presentation_resolved', resolved)
    this.publishingImpact = false
    const completeToken = this.deferredCompleteToken
    this.deferredCompleteToken = undefined
    if (completeToken) this.acknowledgeActionComplete(completeToken)
  }

  /** Phaser gọi khi VFX tween xong → turn cleanup, phát standby tail. */
  acknowledgeActionComplete(token?: string): void {
    if (this.publishingImpact) {
      if (token === this.playbackToken) this.deferredCompleteToken = token
      return
    }
    if (this.deps.isSessionBlocking?.()) {
      return
    }

    // R5 (AR-20) — require identity at public boundary; reject missing, empty, or mismatched token.
    if (!token || token !== this.playbackToken) {
      return
    }

    const battle = this.deps.getTurnBattle()

    if (!this.pendingImpact || !battle) {
      return
    }

    const { actor, declared, targetIds } = this.pendingImpact
    this.pendingImpact = null

    this.deps.getTurnBattleSystem().completeAction(battle, actor, declared, targetIds)

    emitTurnStandbyComplete(this.deps.eventBus, actor.id)

    this.deps.stepCompletionSink?.onComplete()
  }

  /**
   * UI submit choice cho lượt đang pause. Trả false nếu không có pause
   * (no-op an toàn — choice bị bỏ, không crash).
   */
  submitTurnChoice(choice: ForcedTurnChoice): boolean {
    if (this.deps.isSessionBlocking?.()) {
      return false
    }

    const battle = this.deps.getTurnBattle()

    if (!this.awaitedManualActor || !battle) {
      return false
    }

    const actor = this.awaitedManualActor
    this.awaitedManualActor = null

    // BOTH modes declare and wait. The resolution pipeline owns the rest of
    // the turn (impact, then complete) and drives those acknowledgements
    // itself when no renderer is attached, so a manual turn takes exactly the
    // same path as an auto one from here on. Resolving inline would give
    // turn-end a second owner, which is the defect the turn spec removes.
    const declared = this.deps.getTurnBattleSystem().declareActorAction(battle, actor, choice)
    const cast = this.declarePresentation(actor, declared)
    this.pendingDeclaredAction = { actor, declared, cast }

    emitTurnCastStart(this.deps.eventBus, actor.id, declared.skillId, declared.affected.map((target) => target.id))
    this.deps.eventBus.emit('skill_presentation_cast', cast)

    return true
  }

  /** Called by GameManager's tick loop when tickPacing() returns a ready
   * actor while presentationActive is true — replaces the inline block
   * previously at GameManager.ts:3659-3668. */
  notifyReadyActor(actor: TurnBattleParticipant): void {
    this.pendingReadyActor = actor
    this.playbackToken = this.nextPlaybackToken()

    emitTurnReady(this.deps.eventBus, actor.id)
  }

  /**
   * Called when the turn token routes a claim to AWAITING_INPUT (spec section
   * 3.2), in BOTH modes. Nothing is resolved: tickPacing never resolves a turn
   * any more, so the actor's turn is genuinely still pending here and stays
   * pending until submitTurnChoice(). The clock is frozen meanwhile by the
   * token's own freeze reason, not by this flag.
   */
  pauseForManualActor(actor: TurnBattleParticipant): void {
    this.awaitedManualActor = actor

    // A manual turn no longer passes through notifyReadyActor, so mint the
    // playback token here: submitTurnChoice's declare phase is the first thing
    // Phaser will acknowledge for this turn and it needs an identity to quote.
    this.playbackToken = this.nextPlaybackToken()

    // The ready flourish belongs to the CLAIM, not to the action: manual mode
    // gates the primary action, never the presentation (spec section 7), so the
    // actor announces its turn here exactly as an auto actor does.
    //
    // The cue is emitted WITHOUT entering the pending-ready phase, and that is
    // load-bearing rather than an omission. notifyReadyActor() would also set
    // pendingReadyActor, and CombatScene.onTurnReady() calls
    // acknowledgeTurnReady() when its flourish tween completes - which now
    // declares unconditionally. A manual turn would therefore auto-declare the
    // DEFAULT skill the moment the animation ended, before the player chose,
    // and submitTurnChoice would then declare a second time. Emitting the cue
    // alone lets the flourish play while that late ack lands on a null
    // pendingReadyActor and is the no-op it should be.
    emitTurnReady(this.deps.eventBus, actor.id)
  }

  /** Which animation clip an actor should currently show, derived purely
   * from which phase (if any) is pending for it. Any pending phase means
   * the actor is engaged - 'standby'; the transition clips that lead in
   * and out are fired by the phase-change EVENTS at the playback layer,
   * not by this state query (uniform contract, 2026-09-19). */
  getAnimationState(actorId: string): CombatAnimationName {
    if (this.pendingReadyActor?.id === actorId) {
      return 'standby'
    }

    if (this.pendingDeclaredAction?.actor.id === actorId) {
      return 'standby'
    }

    if (this.pendingImpact?.actor.id === actorId) {
      return 'standby'
    }

    return 'idle'
  }

  /** Clears every pending phase + manual pause. Called on stage restart
   * flows (fresh startStage and the auto-repeat restartTurnBattleCycle) so
   * a new TurnBattle never inherits stale playback state from the previous
   * one. */
  resetPendingState(): void {
    this.awaitedManualActor = null
    this.pendingReadyActor = null
    this.pendingDeclaredAction = null
    this.pendingImpact = null
    this.playbackToken = ''
    this.publishingImpact = false
    this.deferredCompleteToken = undefined
  }

  /**
   * Detaches presentation under the specified policy:
   * - 'hold': preserves pending work and keeps presentation active; does NOT drain.
   * - 'headless': explicitly deactivates presentation mode and drains pending phases.
   */
  detachPresentation(policy: 'hold' | 'headless'): void {
    if (policy === 'hold') {
      this.presentationActive = true
    } else if (policy === 'headless') {
      this.presentationActive = false
      this.handlePresentationDeactivated()
    }
  }

  /**
   * Inspects pending action playback state and prepares a resume payload.
   * Renews the playback token once for each re-attachment attempt so old callbacks become stale.
   * Returns null if no phase is pending.
   */
  preparePresentationResume(): ResumePlayback | null {
    if (this.pendingReadyActor) {
      const token = this.nextPlaybackToken()
      return {
        phase: 'ready',
        token,
        actorId: this.pendingReadyActor.id,
      }
    }

    if (this.pendingDeclaredAction) {
      const token = this.nextPlaybackToken()
      const cast = freezePresentation({ ...this.pendingDeclaredAction.cast, ref: { ...this.pendingDeclaredAction.cast.ref, token } })
      this.pendingDeclaredAction.cast = cast
      return {
        phase: 'cast',
        cast,
        token,
        actorId: this.pendingDeclaredAction.actor.id,
        skillId: this.pendingDeclaredAction.declared.skillId,
        targetIds: this.pendingDeclaredAction.declared.affected.map((target) => target.id),
      }
    }

    if (this.pendingImpact) {
      const token = this.nextPlaybackToken()
      const resolved = freezePresentation({ ...this.pendingImpact.resolved, ref: { ...this.pendingImpact.resolved.ref, token } })
      this.pendingImpact.resolved = resolved
      return {
        phase: 'complete',
        resolved,
        token,
        actorId: this.pendingImpact.actor.id,
        targetIds: [...this.pendingImpact.targetIds],
      }
    }

    if (this.awaitedManualActor) {
      return {
        phase: 'manual',
        actorId: this.awaitedManualActor.id,
      }
    }

    return null
  }
}
