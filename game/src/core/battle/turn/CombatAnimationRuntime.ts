import { TurnBattleSystem, type TurnBattle, type TurnBattleParticipant, type TurnDeclaredAction } from './TurnBattleSystem'
import type { TurnSkillSlotRole } from './TurnSkillAction'
import { PresentationGate } from './PresentationGate'
import { emitTurnReady, emitTurnCastStart, emitTurnActionImpact, emitTurnStandbyComplete } from './TurnActionPresentationEvents'
import type { EventBus } from '../../events/EventBus'
import type { CombatAnimationName } from '../../../game/support/CombatAnimationSet'

/**
 * Combat Runtime Separation (2026-09-07, AGENTS.md P17) — owns the
 * presentation-ack timing state that used to live directly as loose private
 * fields on GameManager: 5-phase state machine (ready -> cast -> impact ->
 * complete), the manual-mode pause, and the boot-race PresentationGate.
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
      // forever — same live-reference requirement as getBattle() below.
      getTurnBattleSystem: () => TurnBattleSystem
      eventBus: EventBus
      getBattle: () => TurnBattle | null
      syncLegacyBattleState: () => void
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

  /** Đang pause chờ player chọn skill cho lượt của chính mình? */
  isAwaitingManualTurnChoice(): boolean {
    return this.awaitedManualActor !== null
  }

  /** Actor đang bị pause chờ manual choice, hoặc null. Dùng cho
   * consumeAwaitedActorId()/buildTurnSkillPresentation() bên GameManager. */
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

  /** Defect Task 3 (2026-09-05) — boot-race gate: chờ CombatScene mount lần
  * đầu (hoặc safety-net timeout) trước khi tick battle — chặn headless-
  * resolve toàn bộ trận 1 trước Phaser kịp mount. */
  private readonly presentationGate = new PresentationGate()

  /** Called once at real-app boot ONLY (App.vue) — never from test fixtures. */
  expectPresentationLayer(): void {
    this.presentationGate.expect()
  }

  /** True while the very first Phaser boot hasn't finished mounting CombatScene yet. */
  isAwaitingPresentationLayer(): boolean {
    return this.presentationGate.isBlocking()
  }

  /** Tick đã peek actor ready, chờ acknowledgeTurnReady(). */
  private pendingReadyActor: TurnBattleParticipant | null = null

  /** Đã declare action, chờ acknowledgeActionImpact(). */
  private pendingDeclaredAction: { actor: TurnBattleParticipant; declared: TurnDeclaredAction } | null = null

  /** Đã áp damage, chờ acknowledgeActionComplete(). */
  private pendingImpact: { actor: TurnBattleParticipant; declared: TurnDeclaredAction; targetIds: string[] } | null = null

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

  setPresentationActive(active: boolean): void {
    this.presentationActive = active

    if (active) {
      // Defect Task 3 — Phaser mounted lần đầu: mở boot-race gate (sticky).
      this.presentationGate.markReady()
    } else {
      this.handlePresentationDeactivated()
    }
  }

  /** Rời CombatScene giữa chừng — hoàn tất pending phases ngay lập tức
   * (headless path) để trận không bị treo. */
  handlePresentationDeactivated(): void {
    const battle = this.deps.getBattle()
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
  }

  isActionPlaybackWaiting(): boolean {
    return this.pendingReadyActor !== null || this.pendingDeclaredAction !== null || this.pendingImpact !== null
  }

  /** Phaser gọi khi ready flourish xong → declare action, phát 'attack'. */
  acknowledgeTurnReady(token?: string): void {
    // Remediation Task 1 — stale token (khớp token của action cũ) là no-op.
    if (token !== undefined && token !== this.playbackToken) {
      return
    }

    const battle = this.deps.getBattle()

    if (!this.pendingReadyActor || !battle) {
      return
    }

    const actor = this.pendingReadyActor
    this.pendingReadyActor = null

    if (this.battleManualMode && battle.players.includes(actor)) {
      // Slice 7 manual-choice flow giữ nguyên — pause chờ submitTurnChoice.
      this.awaitedManualActor = actor
      return
    }

    const declared = this.deps.getTurnBattleSystem().declareActorAction(battle, actor)
    this.pendingDeclaredAction = { actor, declared }

    emitTurnCastStart(this.deps.eventBus, actor.id, declared.skillId, declared.affected.map((target) => target.id))
  }

  /** Phaser gọi tại impact frame (lunge tween xong) → áp damage, phát VFX. */
  acknowledgeActionImpact(token?: string): void {
    // Remediation Task 1 — stale token là no-op.
    if (token !== undefined && token !== this.playbackToken) {
      return
    }

    const battle = this.deps.getBattle()

    if (!this.pendingDeclaredAction || !battle) {
      return
    }

    const { actor, declared } = this.pendingDeclaredAction
    this.pendingDeclaredAction = null

    const { targetIds } = this.deps.getTurnBattleSystem().applyActionImpact(battle, declared)
    this.pendingImpact = { actor, declared, targetIds }

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

    this.deps.syncLegacyBattleState()
  }

  /** Phaser gọi khi VFX tween xong → turn cleanup, phát standby tail. */
  acknowledgeActionComplete(token?: string): void {
    // Remediation Task 1 — stale token là no-op.
    if (token !== undefined && token !== this.playbackToken) {
      return
    }

    const battle = this.deps.getBattle()

    if (!this.pendingImpact || !battle) {
      return
    }

    const { actor, declared, targetIds } = this.pendingImpact
    this.pendingImpact = null

    this.deps.getTurnBattleSystem().completeAction(battle, actor, declared, targetIds)

    emitTurnStandbyComplete(this.deps.eventBus, actor.id)

    this.deps.syncLegacyBattleState()
  }

  /**
   * UI submit choice cho lượt đang pause. Trả false nếu không có pause
   * (no-op an toàn — choice bị bỏ, không crash).
   */
  submitTurnChoice(role: TurnSkillSlotRole): boolean {
    const battle = this.deps.getBattle()

    if (!this.awaitedManualActor || !battle) {
      return false
    }

    const actor = this.awaitedManualActor
    this.awaitedManualActor = null

    if (this.presentationActive) {
      // Action Playback Task 6 — declare thay vì resolve ngay; impact
      // áp khi Phaser acknowledge (cùng 5-phase machine như auto path).
      const declared = this.deps.getTurnBattleSystem().declareActorAction(battle, actor, role)
      this.pendingDeclaredAction = { actor, declared }

      emitTurnCastStart(this.deps.eventBus, actor.id, declared.skillId, declared.affected.map((target) => target.id))

      return true
    }

    this.deps.getTurnBattleSystem().resolveActorTurn(battle, actor, role)

    this.deps.syncLegacyBattleState()

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

  /** Called by GameManager's tick loop for the headless (presentationActive
   * false) manual-mode path — tickPacing() already resolved the actor's
   * turn synchronously (resolve=true), this only sets the UI-facing pause
   * flag gating subsequent ticks until submitTurnChoice(). Mirrors the
   * inline `this.awaitedManualActor = readyActor` previously at
   * GameManager.ts's updateBattleFixedStep() 'fighting' branch. */
  pauseForManualActor(actor: TurnBattleParticipant): void {
    this.awaitedManualActor = actor
  }

  /** Which animation clip an actor should currently show, derived purely
   * from which phase (if any) is pending for it. */
  getAnimationState(actorId: string): CombatAnimationName {
    if (this.pendingReadyActor?.id === actorId) {
      return 'ready'
    }

    if (this.pendingDeclaredAction?.actor.id === actorId) {
      return 'cast'
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
  }
}
