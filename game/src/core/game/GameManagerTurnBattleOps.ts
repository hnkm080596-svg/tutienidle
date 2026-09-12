import {
  PresentationSession,
  type PresentationMode,
  type SessionPresentationPort,
  type SessionRef,
} from '../presentation/PresentationSession'
import type { Battle } from '../battle/Battle'
import { initKiemTuBattleResources } from '../battle/KiemTuResourceSystem'
import { resolveEnemySpawnPosition } from '../battle/EnemySpawnPlacement'
import {
  TurnBattleSystem,
  type TurnBattle,
  type TurnBattleParticipant,
} from '../battle/turn/TurnBattleSystem'
import {
  CombatClock,
  ManualClockSource,
  type ClockSource,
  type CombatClockState,
  type FreezeReason,
} from '../battle/turn/CombatClock'
import { TurnToken, type TokenState } from '../battle/turn/TurnToken'
import { TurnPipeline } from '../battle/turn/TurnPipeline'
import { CombatAnimationRuntime, type ResumePlayback } from '../battle/turn/CombatAnimationRuntime'
export type { ResumePlayback } from '../battle/turn/CombatAnimationRuntime'
import { TurnBuffSystem } from '../battle/turn/TurnBuffSystem'
import { TurnReactionManager } from '../battle/turn/TurnReactionManager'
import type { TurnSkillDefinition, TurnSkillSlotRole } from '../battle/turn/TurnSkillAction'
import {
  emitTurnBattleEntitySnapshot,
  buildTurnBattleEntitySnapshot,
  type TurnBattleEntitySnapshotEvent,
} from '../battle/turn/TurnActionPresentationEvents'
import { enemyToCombatEntity } from '../enemy/Enemy'
import type { Enemy } from '../enemy/Enemy'
import type { CombatEntity } from '../combat/CombatEntity'
import { effectiveTotalEnemyCount } from '../stage/EffectiveEnemyCount'
import { effectiveWaves } from '../stage/EffectiveWaves'
import type { Stage } from '../stage/Stage'
import { DEFAULT_MAX_OFFLINE_SECONDS } from '../idle/GameClock'
import { BASIC_ATTACKS_BY_BUILD, GENERIC_PHYSICAL_BASIC } from '../../data/skill/TurnBasicAttacks'
import { REACTION_PATH_POOL } from '../../data/skill/TurnReactionPathSkills'
import { TRAN_PHAP_FORMATIONS } from '../../data/formation/TranPhap'
import { TURN_BUFF_REGISTRY } from '../../data/buff/TurnBuffRegistry'
import type { TurnBuffDefinition } from '../battle/turn/TurnBuffTypes'
import type { PlayerData } from '../player/Player'
import { playerToCombatEntity } from '../player/Player'
import { getKiemYPermanent } from '../player/KiemYSystem'
import type { Stats } from '../stats/StatBlock'
import { DEFAULT_PARTY_FORMATION } from './PartyFormation'
import { resolvePartyFormation } from './FormationPlacement'
import { toTurnBattleParticipant } from './TurnBattleAdapter'
import { companionToCombatEntity } from '../companion/CompanionCombat'
import { COMPANIONS } from '../../data/companion/Companions'
import type { EventBus } from '../events/EventBus'
import type { BattleLootSystem } from './BattleLootSystem'
import type { StageWaveSystem } from './StageWaveSystem'
import type { StageManager } from '../stage/StageManager'
import type { EnemySystem } from '../enemy/EnemySystem'
import type { EnemyManager } from '../enemy/EnemyManager'
import type { CombatSystem } from '../combat/CombatSystem'
import type { SurviveLethalGuard } from '../talent/SurviveLethalGuard'
import type { RewardReceiver } from '../reward/RewardSystem'
import type { ElementType } from '../element/ElementType'
import type { TemplateRegistry } from './TemplateRegistry'
import type { SkillRuntimeStats } from '../skill/SkillRuntimeStats'
import type { TurnSkillPresentationEntry } from '../combat/CombatSkillPresentation'
import { buildTurnSkillPresentation } from '../combat/CombatSkillPresentation'

/**
 * Turn-Based Wave Redesign (2026-09-06) - shared between buildTurnBattle()
 * (initial countdownTurnsRemaining) and TurnActionPresentationEvents's
 * countdownProgress computation.
 * R5 (AR-24): Exported from TurnBattleConstants to eliminate upward dependency.
 */
import { COUNTDOWN_TOTAL_TICKS, INTRO_TOTAL_TICKS } from '../battle/turn/TurnBattleConstants'
export { COUNTDOWN_TOTAL_TICKS, INTRO_TOTAL_TICKS }

/**
 * Combat Turn Mechanism spec section 4.1a - how long a parked ANIMATION or
 * SEMANTIC_VFX step waits for the renderer before completing itself.
 *
 * This is not an optimisation. It is what stops a destroyed sprite, a
 * cancelled tween or a texture that failed to load from parking the pipeline
 * forever, which would leave the turn token non-IDLE and the combat clock
 * frozen for the rest of the session.
 */
export const ANIMATION_FALLBACK_MS = 4000

/** The three renderer signals the pipeline's asynchronous steps wait on. */
type TurnStepSignal = 'ready' | 'impact' | 'complete'

/**
 * Turn-battle runtime Ops (C2 GameManager split, 2026-09-08) - owns the
 * turn-based battle lifecycle extracted verbatim from GameManager.ts:
 *
 * 1. TurnBattle construction (party formation, companions, tran-phap buff,
 *    spawn placement) + the restart auto-repeat cycle.
 * 2. The fixed-step driving loop (intro/countdown/fighting pacing, snapshot
 *    emit, manual-mode pause) - the single driver named by the combat
 *    reference spec section 1.
 * 3. Reward flow (per-kill grant, victory terminal, perfect-clear record)
 *    and the auto-farm wall-clock cycle loop.
 *
 * This is an orchestrator per AGENTS.md A5: it sequences validated calls
 * into the owners (TurnBattleSystem for resolution, CombatAnimationRuntime
 * for presentation-ack timing, BattleLootSystem for loot) and does not
 * re-implement domain rules. All state moved here with the methods that
 * used it; GameManager keeps thin delegates with the unchanged public API.
 */
export class GameManagerTurnBattleOps {
  private turnBattleSystem: TurnBattleSystem
  private turnBattle: TurnBattle | null = null

  /** Template of the most recently spawned stage enemy (spawn factory fallback). */
  private lastStageEnemyTemplate: Enemy | null = null

  /** Repeat-continuously flag from startStage - drives the auto-repeat cycle. */
  private turnBattleRepeatContinuously = false

  private activeStageForTurnBattle: Stage | null = null
  private playerDataForTurnBattle: PlayerData | null = null

  /** Wall-clock timestamp at stage start (Hoan My clearSeconds normalization). */
  private turnBattleStartedAtMs: number | null = null

  private turnBattleRewardsGranted = new Set<string>()
  private turnBattleEndEmitted = false

  private readonly combatAnimationRuntime: CombatAnimationRuntime
  private readonly presentationSession: PresentationSession
  private presentationMode: PresentationMode = 'headless'
  private isStageStarting = false

  // --- Turn engine (2026-09-10 combat-turn-mechanism spec) ----------------
  //
  // Combat's own clock, the single turn token, and the single resolution
  // pipeline. The clock counts for itself from an injected ClockSource; the
  // token is the sole authority on whether a turn is in flight; the pipeline
  // is the sole owner of turn-end. The default source is manual so a headless
  // GameManager (tests, tools) advances only when a caller says so.
  private combatClock = new CombatClock(new ManualClockSource())
  private readonly turnToken = new TurnToken()
  private readonly pipeline = new TurnPipeline(() => this.onTurnDrained())
  private detachClockStep: (() => void) | null = null
  private detachTokenListener: (() => void) | null = null

  /** Completion callbacks for the steps currently parked on a renderer signal. */
  private pendingStepDone: Partial<Record<TurnStepSignal, () => void>> = {}

  /** Fallback timers owned by the parked steps, cleared when a turn restarts. */
  private pendingStepTimers: Array<ReturnType<typeof setTimeout>> = []

  /**
   * Commands arrive on wall-clock time; battle state changes on turn
   * boundaries. Queueing them gives exactly one instant at which combat state
   * may change from outside, and at that instant no action is in flight
   * (spec section 9).
   */
  private boundaryQueue: Array<() => void> = []

  constructor(private readonly deps: {
    eventBus: EventBus
    combatSystem: CombatSystem
    battleLoot: BattleLootSystem
    stageWaves: StageWaveSystem
    stageManager: StageManager
    enemySystem: EnemySystem
    enemyManager: EnemyManager
    enemyTemplates: TemplateRegistry<Enemy>
    stageTemplates: TemplateRegistry<Stage>
    surviveLethalGuard: SurviveLethalGuard
    sessionAllocator?: { allocate(): number }
    // Live player/registry reads - GameManager owns these authorities; the
    // ops only reads through accessors (A3: no duplicate state ownership).
    getActivePlayer: () => PlayerData | undefined
    getSkillRuntimeStats: (player: PlayerData) => SkillRuntimeStats
    // SkillManager level snapshot for playerToCombatEntity (owned by GameManager).
    getSkillLevels: () => Record<string, number>
    // PassiveSystem owns per-battle passive stacks; ops requests the reset.
    resetPassiveStacks: () => void
    buildPlayerRewardReceiver: (player: PlayerData) => RewardReceiver
    getPhapTuThuanElement: () => ElementType | undefined
    // Resolve special/ultimate via the Skill converter + effective skill.
    resolvePlayerSpecialUltimate: (
      player: PlayerData,
    ) => { special?: TurnSkillDefinition; ultimate?: TurnSkillDefinition }
  }) {
    this.turnBattleSystem = new TurnBattleSystem(deps.combatSystem)
    this.presentationSession = new PresentationSession(deps.sessionAllocator)

    // Live getters for turnBattleSystem/turnBattle are required: both are
    // REASSIGNED wholesale by restartTurnBattleCycle()/startStage(), so
    // capturing by value would freeze the runtime onto the first
    // registry-less instance (same rationale as the original inline wiring).
    this.combatAnimationRuntime = new CombatAnimationRuntime({
      getTurnBattleSystem: () => this.turnBattleSystem,
      eventBus: deps.eventBus,
      getBattle: () => this.turnBattle,
      syncLegacyBattleState: () => {},
      isSessionBlocking: () => this.presentationSession.isBlocking(),
      stepCompletionSink: {
        onReady: () => this.settleStep('ready'),
        onImpact: () => this.settleStep('impact'),
        onComplete: () => this.settleStep('complete'),
      },
    })

    this.detachClockStep = this.combatClock.onStep((steps) => this.advanceCombat(steps))
    this.attachTurnTokenToClock()
  }

  // --- Combat clock, turn token, resolution pipeline ----------------------

  /**
   * Swap the source combat counts from. The browser installs a
   * RafClockSource so combat advances at render cadence; tests install a
   * ManualClockSource. Nothing is banked across the swap.
   */
  setCombatClockSource(source: ClockSource): void {
    const wasRunning = this.combatClock.getState() !== 'stopped'

    this.combatClock.stop()
    this.detachClockStep?.()
    this.combatClock = new CombatClock(source)
    this.detachClockStep = this.combatClock.onStep((steps) => this.advanceCombat(steps))
    this.attachTurnTokenToClock()

    if (wasRunning) {
      this.combatClock.start()
      this.syncOffScreenFreeze()
    }
  }

  freezeCombat(reason: FreezeReason): void {
    this.combatClock.freeze(reason)
  }

  resumeCombat(reason: FreezeReason): void {
    this.combatClock.resume(reason)
  }

  getCombatClockState(): CombatClockState {
    return this.combatClock.getState()
  }

  /**
   * Steps the clock has EMITTED, which is not always the number consumed:
   * CombatClock counts a whole batch before invoking its listener, and
   * advanceCombat then drops the rest of that batch the moment a step freezes
   * or stops the clock. Diagnostic only - do not treat it as a turn counter.
   */
  getElapsedCombatSteps(): number {
    return this.combatClock.getElapsedSteps()
  }

  getFreezeReasons(): readonly FreezeReason[] {
    return this.combatClock.getFreezeReasons()
  }

  /** @internal - for tests and the dev inspector, never for gameplay code. */
  getTurnTokenState(): TokenState {
    return this.turnToken.getState()
  }

  /**
   * The single predicate for "a turn is in flight". The clock learns about it
   * through a freeze reason, not through a mirrored flag.
   */
  isTurnInFlight(): boolean {
    return this.turnToken.getState() !== 'IDLE'
  }

  /**
   * The token's state IS the clock's `turn-in-flight` freeze reason. This is
   * the only channel through which the turn engine affects time (spec section
   * 10); no other code adds or removes that reason.
   */
  private attachTurnTokenToClock(): void {
    this.detachTokenListener?.()

    this.detachTokenListener = this.turnToken.onStateChange((state) => {
      if (state === 'IDLE') {
        this.combatClock.resume('turn-in-flight')
      } else {
        this.combatClock.freeze('turn-in-flight')
      }
    })
  }

  /**
   * The battle not being on screen is a freeze REASON, not a branch inside the
   * step. A held interactive session means the presentation coordinator has
   * not revealed the battle yet, so combat must not count.
   */
  private syncOffScreenFreeze(): void {
    if (this.presentationSession.isBlocking()) {
      this.combatClock.freeze('not-revealed')
    } else {
      this.combatClock.resume('not-revealed')
    }
  }

  private advanceCombat(steps: number): void {
    for (let i = 0; i < steps; i += 1) {
      // A step may claim the token (which freezes the clock) or end the battle
      // (which stops it). The remaining steps of this batch were earned before
      // that happened and are DROPPED, not spent: spending them would tick the
      // gauge while a turn is in flight, the exact thing the token exists to
      // prevent, and banking them would be catch-up, which the spec forbids.
      if (this.combatClock.getState() !== 'running') {
        return
      }

      this.stepTurnBattle()
    }
  }

  /**
   * One combat step. Called only by CombatClock - never by the world tick.
   *
   * The former `presentationSession.isBlocking()` branch is gone: a held
   * session means the battle is not on screen, which is an off-screen reason
   * that stops the clock upstream (`not-revealed`). The former
   * waiting-for-acknowledgement branches are gone too - while a turn is in
   * flight the clock is frozen, so no step arrives at all.
   */
  private stepTurnBattle(): void {
    const battle = this.turnBattle

    if (!battle) {
      return
    }

    if (battle.state === 'intro') {
      // Intro/transition: only decrement introTurnsRemaining and flip to
      // 'countdown' at 0 - NO combat logic in this phase, and the turn token
      // cannot be claimed here (spec section 3.3).
      this.turnBattleSystem.tickIntro(battle)
      emitTurnBattleEntitySnapshot(this.deps.eventBus, battle)
    } else if (battle.state === 'countdown') {
      // Snapshot must ALSO run during countdown: CombatScene needs
      // countdownProgress each step for the party telegraph 3-2-1.
      this.turnBattleSystem.tickCountdown(battle)
      emitTurnBattleEntitySnapshot(this.deps.eventBus, battle)
    } else if (battle.state === 'fighting') {
      this.drainBoundaryQueueIfIdle()

      // tickPacing NEVER resolves a turn any more, in ANY mode. Resolution is
      // the pipeline's job; leaving `resolve = !isPresentationActive()` here
      // would give turn-end a second owner, which is the defect this spec
      // exists to remove.
      const readyActor = this.turnBattleSystem.tickPacing(battle, false)

      if (readyActor !== null) {
        this.turnToken.claim({
          actorId: readyActor.id,
          isPlayerTeam: battle.players.includes(readyActor),
          manualMode: this.combatAnimationRuntime.isBattleManualMode(),
        })

        if (this.turnToken.getState() === 'AWAITING_INPUT') {
          this.combatAnimationRuntime.pauseForManualActor(readyActor)
          emitTurnBattleEntitySnapshot(this.deps.eventBus, battle)

          return
        }

        this.beginTurnPipeline(readyActor, 'ready')
      }

      // Combat Art Pipeline - emit the LIVE entity snapshot every step during
      // 'fighting'. Read through the field: a headless turn can resolve inside
      // beginTurnPipeline above and auto-repeat can replace the battle.
      if (this.turnBattle) {
        emitTurnBattleEntitySnapshot(this.deps.eventBus, this.turnBattle)
      }
    }

    this.settleCombatOutcome()
  }

  /**
   * External command boundary (spec section 9). A command never mutates
   * battle state at the moment it arrives:
   *
   * - No battle at all -> nothing to protect, run immediately.
   * - Token already IDLE -> we ARE at a boundary right now, run immediately.
   * - Otherwise a turn is in flight -> queue it; drainBoundaryQueueIfIdle()
   *   flushes it the next time the token reports IDLE.
   */
  enqueueAtTurnBoundary(command: () => void): void {
    if (!this.turnBattle) {
      command()
      return
    }

    if (this.turnToken.getState() === 'IDLE') {
      command()
      return
    }

    this.boundaryQueue.push(command)
  }

  /**
   * Task 10 seam: external commands are drained exactly once, at the turn
   * boundary, before the next gauge check (spec section 9.2). The call site
   * exists at the top of stepTurnBattle's 'fighting' branch so the boundary
   * has one place and only one place: the clock is frozen whenever the token
   * is not idle, so a step only ever arrives here when the token IS idle,
   * which is precisely the instant after RESOLVING -> IDLE and before the
   * next IDLE -> CLAIMED.
   */
  private drainBoundaryQueueIfIdle(): void {
    if (this.boundaryQueue.length === 0) {
      return
    }

    if (this.turnToken.getState() !== 'IDLE') {
      return
    }

    const queued = this.boundaryQueue
    this.boundaryQueue = []

    for (const command of queued) {
      command()
    }
  }

  /**
   * One turn = one pipeline. The three asynchronous steps map onto the
   * handshake CombatAnimationRuntime already exposes (ready -> impact ->
   * complete); the mechanical idle-check completes inline.
   *
   * `from` is 'impact' for a manual turn: submitTurnChoice has already run the
   * ready and cast phases with the player's chosen skill, so replaying the
   * ready step would ask for a flourish that already happened.
   */
  private beginTurnPipeline(actor: TurnBattleParticipant, from: 'ready' | 'impact'): void {
    // Safe here and only here: never called from inside a running step's
    // run(), so the drain loop has no live reference to reset out from under.
    this.clearPendingSteps()
    this.pipeline.reset()

    if (from === 'ready') {
      this.pipeline.push({
        kind: 'animation',
        actorId: actor.id,
        animationId: 'action',
        run: (done) => {
          this.awaitStep('ready', done)
          this.combatAnimationRuntime.notifyReadyActor(actor)
          this.settleHeadlessStep('ready')
        },
      })
    }

    this.pipeline.push({
      kind: 'semantic-vfx',
      run: (done) => {
        this.awaitStep('impact', done)
        this.settleHeadlessStep('impact')
      },
    })

    this.pipeline.push({
      kind: 'semantic-vfx',
      run: (done) => {
        this.awaitStep('complete', done)
        this.settleHeadlessStep('complete')
      },
    })

    this.pipeline.push({ kind: 'idle-check', run: (done) => done() })

    this.pipeline.drain()
  }

  /**
   * Parks a step until the renderer reports the matching signal, or until the
   * fallback fires (spec section 4.1a). Whichever comes first wins;
   * TurnPipeline makes the completion idempotent, so the loser is harmless.
   *
   * The fallback plays the renderer's part before completing the step. A bare
   * `done()` would satisfy the letter of 4.1a - no hang - while skipping the
   * step's mechanical work entirely: no declare, no impact, and above all no
   * completeAction, so the actor's gauge is never consumed and the very next
   * combat step re-claims the SAME turn, forever. A step that completes has to
   * mean the turn made progress.
   */
  private awaitStep(signal: TurnStepSignal, done: () => void): void {
    const timer = setTimeout(() => {
      this.pendingStepDone[signal] = undefined
      this.driveStepWork(signal)
      done()
    }, ANIMATION_FALLBACK_MS)

    this.pendingStepTimers.push(timer)

    this.pendingStepDone[signal] = () => {
      clearTimeout(timer)
      done()
    }
  }

  private settleStep(signal: TurnStepSignal): void {
    const settle = this.pendingStepDone[signal]
    this.pendingStepDone[signal] = undefined
    settle?.()
  }

  private clearPendingSteps(): void {
    for (const timer of this.pendingStepTimers) {
      clearTimeout(timer)
    }

    this.pendingStepTimers = []
    this.pendingStepDone = {}
  }

  /**
   * Play the renderer's part for one step. The three acknowledge* bodies ARE
   * the step's mechanical work - they are exactly the three calls
   * resolveActorTurn used to make inline (declareActorAction ->
   * applyActionImpact -> completeAction), so this is what makes a step's
   * completion mean the turn advanced.
   *
   * Two callers, for two different reasons: the headless path (no renderer
   * will ever report) and the fallback timer (a renderer that should have
   * reported and did not).
   */
  private driveStepWork(signal: TurnStepSignal): void {
    const token = this.combatAnimationRuntime.getPendingPlaybackToken() ?? undefined

    if (signal === 'ready') {
      this.combatAnimationRuntime.acknowledgeTurnReady(token)
    } else if (signal === 'impact') {
      this.combatAnimationRuntime.acknowledgeActionImpact(token)
    } else {
      this.combatAnimationRuntime.acknowledgeActionComplete(token)
    }
  }

  /**
   * Headless: no renderer will ever report this step, so the engine plays
   * Phaser's part immediately and the step completes inside its own run().
   * Headless resolution is therefore unchanged in substance; what changed is
   * that the PIPELINE owns the ordering in both modes.
   */
  private settleHeadlessStep(signal: TurnStepSignal): void {
    if (this.combatAnimationRuntime.isPresentationActive()) {
      return
    }

    this.driveStepWork(signal)
  }

  /**
   * Turn-end. Reached only when the pipeline is empty and nothing is parked,
   * which is what "the turn is over" means (spec section 8).
   */
  private onTurnDrained(): void {
    const battle = this.turnBattle

    if (!battle || this.turnToken.getState() !== 'RESOLVING') {
      return
    }

    // The battle's own phase is the authority on whether combat is over.
    // A live players/enemies headcount would read COMBAT_OVER between waves,
    // when every spawned enemy is dead and the next wave has not arrived yet.
    const bothSidesAlive = battle.state !== 'victory' && battle.state !== 'defeat'

    // resolve() moves the token, and the token's own listener is what tells
    // the clock to resume - there is no second channel here on purpose.
    this.turnToken.resolve({ bothSidesAlive })

    if (this.turnToken.getState() === 'COMBAT_OVER') {
      // Spec section 9.2: a victory or defeat never passes through
      // abandonBattle, so a command queued in the last turn of THIS battle
      // must be dropped here - draining it at the next boundary would apply
      // it to whatever battle starts next, not the one it was queued against.
      this.boundaryQueue = []
      this.settleCombatOutcome()
    }
  }

  /**
   * Rewards, the victory/defeat terminal and the auto-repeat restart. These
   * follow the BATTLE, so they run on the combat clock: combat-over STOPS that
   * clock, and anything left behind on the world tick would never fire.
   */
  private settleCombatOutcome(): void {
    this.grantBattleRewardIfNeeded()

    const battle = this.turnBattle

    if (!battle || (battle.state !== 'victory' && battle.state !== 'defeat')) {
      return
    }

    // Auto-repeat: victory + repeat on -> restart in place, exactly where the
    // world-tick loop used to do it at the end of updateBattleFixedStep().
    if (
      battle.state === 'victory' &&
      this.turnBattleRepeatContinuously &&
      this.activeStageForTurnBattle !== null &&
      this.deps.stageManager.get() !== null
    ) {
      this.restartTurnBattleCycle()
      this.resetTurnEngine()

      return
    }

    // Spec section 8: combat-over STOPS the clock. It does not freeze it - the
    // battle is over and nothing more will advance.
    this.combatClock.stop()
  }

  /** Per-battle reset (spec section 3.3 / blocker A5): a token left in
   * COMBAT_OVER would reject the next battle's first claim and freeze it
   * permanently. */
  private resetTurnEngine(): void {
    this.clearPendingSteps()
    this.pipeline.reset()
    this.turnToken.reset()
  }

  // --- Battle state queries ---------------------------------------------

  getTurnBattle(): TurnBattle | null {
    return this.turnBattle
  }

  /**
   * Pure snapshot query for presentation reconciliation (Task 4).
   * Validates sessionId, emits zero events, changes zero state, returns detached plain data.
   */
  getCombatPresentationSnapshot(sessionId: number): {
    sessionId: number
    entities: TurnBattleEntitySnapshotEvent
  } | null {
    const currentSession = this.presentationSession.getCurrentSession()
    if (!currentSession || currentSession.sessionId !== sessionId || currentSession.kind !== 'combat') {
      return null
    }

    if (!this.turnBattle) {
      return null
    }

    return {
      sessionId,
      entities: buildTurnBattleEntitySnapshot(this.turnBattle),
    }
  }

  /** TurnBattle cast to the read-only Battle shape legacy consumers expect. */
  getBattle(): Battle | null {
    return (this.turnBattle as unknown as Battle) ?? null
  }

  // --- Battle start -------------------------------------------------------

  spawnEnemy(template: Enemy): Enemy {
    return this.deps.enemySystem.spawn(template)
  }

  startBattle(player: CombatEntity, enemy: Enemy) {
    const enemyEntity = enemyToCombatEntity(this.deps.enemySystem.spawn(enemy))

    // Reset defaults - startBattleWithPlayer() sets the real session right
    // after. Direct startBattle() (no PlayerData) has no reward receiver and
    // no talent session; in-battle passive stacks reset every battle.
    this.deps.battleLoot.beginBattle()
    this.deps.resetPassiveStacks()
    this.deps.combatSystem.setSurviveLethalSession(null)

    this.turnBattle = this.buildTurnBattle(player, [enemyEntity])

    // C1 parity - Kiem bar init used to run inside legacy battleSystem.start().
    initKiemTuBattleResources(
      this.turnBattle.players[0]!.entity,
      this.deps.getActivePlayer()?.kiemTuRoute,
      this.deps.getActivePlayer() ? getKiemYPermanent(this.deps.getActivePlayer()!.bossKillCount) : 0,
    )

    if (!this.isStageStarting) {
      const activeSession = this.presentationSession.getCurrentSession()
      if (activeSession) {
        this.presentationSession.end(activeSession)
      }
      const session: SessionRef = {
        kind: 'combat',
        sessionId: this.presentationSession.allocate(),
      }
      this.presentationSession.begin(session, this.presentationMode)
      if (this.presentationMode === 'interactive') {
        this.presentationSession.hold(session)
      }
      this.deps.eventBus.emit('presentation_session_started', session)
    }

    // A fresh battle owns a fresh boundary queue too - same reasoning as the
    // startStage/abandonBattle clears (spec section 9.2): nothing queued
    // against a previous battle (or against no battle at all) may drain into
    // this one. startBattle() has no production caller today besides
    // startStage (which already clears the queue itself before reaching
    // here), but this keeps the invariant true of the method itself rather
    // than of its only current caller.
    this.boundaryQueue = []

    // A fresh battle owns a fresh turn engine and a fresh clock run. startStage
    // does the same again after it rebuilds the battle; both are idempotent.
    this.resetTurnEngine()
    this.combatClock.stop()
    this.combatClock.start()
    this.syncOffScreenFreeze()
  }

  startBattleWithPlayer(player: PlayerData, playerStats: Stats, enemy: Enemy) {
    // DESIGN: all combat stats (incl. skill runtime stats) snapshot at battle
    // start; purchases/loadout changes mid-battle take effect next battle.
    const playerEntity = playerToCombatEntity(
      player,
      playerStats,
      this.deps.getSkillRuntimeStats(player),
      this.deps.getSkillLevels(),
    )

    this.startBattle(playerEntity, enemy)

    this.deps.battleLoot.setSession(this.deps.buildPlayerRewardReceiver(player), player)

    // Bat Tu The (talent-direction-choice-plan section 6) - reset the
    // survive-lethal charge per battle from the player's talents, then attach
    // the session for combatSystem.killIfDead(). players[0] is the human
    // player (companions append after index 0 in buildTurnBattle).
    this.deps.surviveLethalGuard.beginBattle(player.selectedTalentIds)
    this.deps.combatSystem.setSurviveLethalSession({
      playerEntityId: playerEntity.id,
      guard: this.deps.surviveLethalGuard,
      // v4 (spec 2026-09-03 section 4.1) - Bat Tu The cleanse/grant on save,
      // wired to the LIVE turn-based player pool (Phase A0 cutover).
      surviveEffects: {
        buffSystem: new TurnBuffSystem(this.turnBattle!.players[0]!.buffs),
        registry: TURN_BUFF_REGISTRY,
        grantBuffId: 'tu_sinh_ngo',
        cleanseDebuffs: true,
      },
    })
  }

  // --- Turn-battle construction (moved verbatim from GameManager) ----------

  private resolvePlayerBasicAttack(player: PlayerData): TurnSkillDefinition {
    if (player.cultivationPath === 'kiem_tu') {
      return BASIC_ATTACKS_BY_BUILD.kiem_tu!
    }

    if (player.cultivationPath === 'phap_tu') {
      const element = this.deps.getPhapTuThuanElement() ?? 'fire'
      return BASIC_ATTACKS_BY_BUILD[`phap_tu_${element}`] ?? GENERIC_PHYSICAL_BASIC
    }

    return GENERIC_PHYSICAL_BASIC
  }

  /**
   * Bug fix (2026-09-06, user report) - mid-battle wave spawns must go
   * through resolveEnemySpawnPosition() exactly like the first enemy in
   * buildTurnBattle(); shared helper keeps both spawn closures aligned.
   */
  private placeSpawnedEnemy(entity: CombatEntity, occupiedSlots?: Set<string>): CombatEntity {
    const position = resolveEnemySpawnPosition(
      {
        isBoss: entity.isBoss ?? false,
        random: Math.random,
      },
      undefined,
      occupiedSlots,
    )

    entity.row = position.row
    entity.x = position.column

    return entity
  }

  private buildTurnBattle(playerEntity: CombatEntity, enemyEntities: CombatEntity[]): TurnBattle {
    const playerPath = this.deps.getActivePlayer()

    // Party placement (Tran Phap spec sections 6-7) - positions read from the
    // player's real formationLoadout via resolvePartyFormation(), falling
    // back to DEFAULT_PARTY_FORMATION when unconfigured.
    const formation = playerPath ? resolvePartyFormation(playerPath) : DEFAULT_PARTY_FORMATION

    const playerSlot = formation.find((slot) => slot.combatantId === 'player')

    if (playerSlot) {
      playerEntity.row = playerSlot.row
      playerEntity.x = playerSlot.column
    }

    const playerParticipant = toTurnBattleParticipant(
      playerEntity,
      0,
      playerPath ? this.resolvePlayerBasicAttack(playerPath) : GENERIC_PHYSICAL_BASIC,
      playerPath?.cultivationPath,
      playerPath ? this.deps.resolvePlayerSpecialUltimate(playerPath) : undefined,
    )

    // Companion Roster - each companion in player.companions is rebuilt as a
    // fresh CombatEntity/participant per battle. Missing definition or missing
    // formation slot is skipped instead of crashing the battle.
    const companionParticipants = (playerPath?.companions ?? []).flatMap((instance, index) => {
      const definition = COMPANIONS.find((candidate) => candidate.id === instance.definitionId)
      const slot = formation.find((entry) => entry.combatantId === instance.definitionId)

      if (!definition || !slot) {
        return []
      }

      const entity = companionToCombatEntity(instance, definition)

      entity.row = slot.row
      entity.x = slot.column

      return [toTurnBattleParticipant(entity, index + 100, definition.basic)]
    })

    // Tran Phap buff - the active formation applies ONE shared buff to the
    // whole party at battle start. Unknown buff definition ids are caught and
    // skipped (graceful, review Task 19) instead of crashing the battle.
    if (playerPath?.formationLoadout) {
      const formationDefinition = TRAN_PHAP_FORMATIONS.find(
        (candidate) => candidate.id === playerPath.formationLoadout!.formationId,
      )

      if (formationDefinition) {
        let buffDefinition: TurnBuffDefinition | undefined

        try {
          buffDefinition = TURN_BUFF_REGISTRY.get(formationDefinition.buff.definitionId)
        } catch {
          buffDefinition = undefined
        }

        if (buffDefinition) {
          for (const participant of [playerParticipant, ...companionParticipants]) {
            new TurnBuffSystem(participant.buffs).apply(
              buffDefinition,
              participant.entity,
              participant.entity,
              TURN_BUFF_REGISTRY,
            )
          }
        }
      }
    }

    // Spawn placement (Combat Art Pipeline sections 6/7) - standing positions, no
    // movement. Bosses always center; regular enemies random within region.
    const enemyParticipants = enemyEntities.map((enemyEntity, index) => {
      const position = resolveEnemySpawnPosition({
        isBoss: enemyEntity.isBoss ?? false,
        random: Math.random,
      })

      enemyEntity.row = position.row
      enemyEntity.x = position.column

      return toTurnBattleParticipant(enemyEntity, index + 1, GENERIC_PHYSICAL_BASIC)
    })

    return {
      players: [playerParticipant, ...companionParticipants],
      enemies: enemyParticipants,
      state: 'intro',
      introTurnsRemaining: INTRO_TOTAL_TICKS,
      countdownTurnsRemaining: COUNTDOWN_TOTAL_TICKS,
      totalTurnsElapsed: 0,
    }
  }

  /**
   * Auto-repeat cycle (Completion Task 8): build a fresh TurnBattle after
   * victory when repeatContinuously is on - keep player participants (HP/
   * resources carry over like the survival-mode restartCycle), fresh enemies
   * via the spawnEnemy factory.
   */
  private restartTurnBattleCycle() {
    const previous = this.turnBattle

    if (!previous || !this.activeStageForTurnBattle) {
      return
    }

    const stageRef = this.activeStageForTurnBattle

    this.turnBattleRewardsGranted.clear()
    this.turnBattleEndEmitted = false
    this.combatAnimationRuntime.resetPendingState()

    this.turnBattle = {
      players: previous.players,
      enemies: [],
      // Auto-repeat cycles within a stage do NOT re-countdown (countdown
      // happens only at stage start) - survival restartCycle goes straight
      // to fighting.
      state: 'fighting',
      totalTurnsElapsed: 0,
      wave: {
        totalEnemyCount: effectiveTotalEnemyCount(stageRef),
        spawnedCount: 0,
        waves: effectiveWaves(stageRef),
        waveIndex: 0,
        pendingEnemySpawns: [],
      },
    }

    this.turnBattleSystem = new TurnBattleSystem(
      this.deps.combatSystem,
      10_000,
      TURN_BUFF_REGISTRY,
      (occupiedSlots?: Set<string>) => {
        const isFinalSpawn =
          (this.turnBattle?.wave?.spawnedCount ?? 0) + 1 >= effectiveTotalEnemyCount(stageRef)
        const template =
          this.deps.stageWaves.pickEnemyForTurnSpawn(stageRef, isFinalSpawn) ??
          this.lastStageEnemyTemplate

        if (!template) {
          throw new Error(`TurnBattle spawnEnemy: no template available for stage ${stageRef.id}`)
        }

        this.lastStageEnemyTemplate = template

        return toTurnBattleParticipant(
          this.placeSpawnedEnemy(enemyToCombatEntity(this.deps.enemySystem.spawn(template)), occupiedSlots),
          this.turnBattle?.enemies.length ?? 0,
          GENERIC_PHYSICAL_BASIC,
        )
      },
      REACTION_PATH_POOL, // Phase A4 - marker special's 2-pick pool now live
      new TurnReactionManager(this.deps.eventBus),
    )
  }

  // --- Stage / HUD progress ------------------------------------------------

  startStage(
    player: PlayerData,
    playerStats: Stats,
    stage: Stage,
    repeatContinuously = false,
  ): boolean {
    this.isStageStarting = true
    let started = false
    try {
      started = this.deps.stageWaves.start(player, playerStats, stage, repeatContinuously)
    } finally {
      this.isStageStarting = false
    }

    if (!started) {
      return false
    }

    const activeSession = this.presentationSession.getCurrentSession()
    if (activeSession) {
      this.presentationSession.end(activeSession)
    }

    this.turnBattleRepeatContinuously = repeatContinuously
    this.activeStageForTurnBattle = stage
    this.playerDataForTurnBattle = player

    // Slice 6 cutover (Completion Task 8): the stage runs on TurnBattle -
    // wave config + spawnEnemy factory wrap pickEnemyForTurnSpawn. The first
    // bootstrap enemy spawned via launchBattle -> startBattle ->
    // buildTurnBattle is removed here so EVERY enemy (incl. the first) spawns
    // through the wave telegraph per the 2026-09-06 redesign.
    if (this.turnBattle) {
      // Gameplay fixes (2026-09-05): reset per-battle flags at every fresh
      // startStage - otherwise the 2nd refight inherits turnBattleEndEmitted
      // and its victory terminal never fires.
      this.turnBattleRewardsGranted.clear()
      this.turnBattleEndEmitted = false
      this.combatAnimationRuntime.resetPendingState()
      this.turnBattleStartedAtMs = Date.now()

      // Despawn the bootstrap enemy from EnemySystem too (not only
      // turnBattle.enemies) so victory-despawn assertions stay clean.
      for (const bootstrap of this.turnBattle.enemies) {
        this.deps.enemySystem.despawn(bootstrap.entity.id)
      }
      this.turnBattle.enemies = []
      this.turnBattle.wave = {
        totalEnemyCount: effectiveTotalEnemyCount(stage),
        spawnedCount: 0,
        waves: effectiveWaves(stage),
        waveIndex: 0,
        pendingEnemySpawns: [],
      }

      const stageRef = stage

      this.turnBattleSystem = new TurnBattleSystem(
        this.deps.combatSystem,
        10_000,
        TURN_BUFF_REGISTRY,
        (occupiedSlots?: Set<string>) => {
          // isFinalSpawn: the last spawn of the stage is the boss (floor 10).
          // The factory runs BEFORE resolveNextStep increments spawnedCount,
          // so the post-spawn total = spawnedCount + 1.
          const isFinalSpawn =
            (this.turnBattle?.wave?.spawnedCount ?? 0) + 1 >= effectiveTotalEnemyCount(stageRef)
          const template =
            this.deps.stageWaves.pickEnemyForTurnSpawn(stageRef, isFinalSpawn) ??
            this.lastStageEnemyTemplate

          if (!template) {
            throw new Error(`TurnBattle spawnEnemy: no template available for stage ${stageRef.id}`)
          }

          this.lastStageEnemyTemplate = template

          return toTurnBattleParticipant(
            this.placeSpawnedEnemy(enemyToCombatEntity(this.deps.enemySystem.spawn(template)), occupiedSlots),
            this.turnBattle?.enemies.length ?? 1,
            GENERIC_PHYSICAL_BASIC,
          )
        },
        REACTION_PATH_POOL, // Phase A4 - marker special's 2-pick pool now live
        new TurnReactionManager(this.deps.eventBus),
      )
    }

    const session: SessionRef = {
      kind: 'combat',
      sessionId: this.presentationSession.allocate(),
    }
    this.presentationSession.begin(session, this.presentationMode)
    if (this.presentationMode === 'interactive') {
      this.presentationSession.hold(session)
    }
    this.deps.eventBus.emit('presentation_session_started', session)

    // A fresh battle owns a fresh boundary queue: nothing queued against the
    // previous fight (or against no fight at all) should drain into this one.
    this.boundaryQueue = []

    // The battle is built: give it a clean turn engine and start its clock.
    // stop() before start() matters - the previous battle may have stopped the
    // clock at combat-over, and stop() is what clears the stale freeze reasons.
    this.resetTurnEngine()
    this.combatClock.stop()
    this.combatClock.start()
    this.syncOffScreenFreeze()

    return true
  }

  // Phase A0 (2026-09-07) - HUD progress composed from the LIVE turn battle:
  // `alive` from turnBattle.enemies (legacy list was always empty), `spawned`
  // from wave.spawnedCount (StageManager's counter was stale at 1), `total`
  // stays StageWaveSystem-sourced.
  getStageProgress(): { spawned: number; total: number; alive: number } | null {
    const progress = this.deps.stageWaves.getProgress()

    if (!progress) {
      return null
    }

    return {
      spawned: this.turnBattle?.wave?.spawnedCount ?? progress.spawned,
      total: progress.total,
      alive: this.turnBattle?.enemies.filter((enemy) => enemy.entity.alive).length ?? 0,
    }
  }

  // --- Abandon --------------------------------------------------------------

  abandonBattle(): boolean {
    // TurnBattle is the source of truth for "battle in progress"; 'intro'
    // also counts as in-progress (2026-09-07 plan Task 4).
    const turnActive =
      !!this.turnBattle &&
      this.turnBattle.state !== 'victory' &&
      this.turnBattle.state !== 'defeat'

    if (!turnActive) {
      return false
    }

    const session = this.presentationSession.getCurrentSession()
    if (session) {
      this.presentationSession.end(session)
    }

    this.combatAnimationRuntime.resetPendingState()

    if (this.turnBattle) {
      this.turnBattle.state = 'defeat'
    }
    this.deps.stageWaves.stopRepeat()

    this.deps.eventBus.emit('battle_end', { type: 'battle_end', state: 'defeat' })

    // Audit fix 2026-08-31 - surviving enemies + pending spawns are dropped
    // without a victory flow; clear here exactly where the battle is
    // destroyed (StageWave auto-repeat spawns the next battle right after
    // victory, so victory itself must not clear).
    this.deps.enemyManager.clear()

    // The battle is destroyed: stop counting for it and drop any turn that was
    // in flight, including its parked fallback timers. Anything queued
    // against this battle is destroyed with it (spec section 9.2).
    this.boundaryQueue = []
    this.resetTurnEngine()
    this.combatClock.stop()

    return true
  }

  // --- Fixed-step driving loop ----------------------------------------------

  /**
   * The WORLD-tick half of what used to be one loop. Combat left it: the
   * battle now advances on CombatClock at render cadence (see stepTurnBattle),
   * because splitting the world's 1 Hz interval into ten 0.1s steps inside a
   * single JS frame delivered a three-second countdown to Phaser as three
   * bursts of ten.
   *
   * Auto-farm did NOT leave. It is a wall-clock reward cycle
   * (perfectClearSeconds / lastCheckedMs) with no turnBattle at all, owned by
   * the world clock, and its cadence is deliberately unchanged. It read
   * Date.now() on every one of the old fixed steps, so calling it once per
   * world tick settles exactly the same cycles.
   */
  updateBattleFixedStep(_deltaSeconds: number) {
    const activePlayer = this.deps.getActivePlayer()

    if (activePlayer) {
      this.tickAutoFarm(activePlayer)
    }
  }

  // --- Reward flow ------------------------------------------------------------

  private grantBattleRewardIfNeeded() {
    // Rewards are read from TurnBattle (the only engine).
    if (this.turnBattle) {
      this.grantTurnBattleRewards()
    }
  }

  private grantTurnBattleRewards() {
    const turnBattle = this.turnBattle

    if (!turnBattle) {
      return
    }

    const killedIds = turnBattle.enemies
      .filter(
        (enemy) => !enemy.entity.alive && !this.turnBattleRewardsGranted.has(enemy.entity.id),
      )
      .map((enemy) => enemy.entity.id)

    if (killedIds.length === 0 && turnBattle.state === 'fighting') {
      return
    }

    // Slice 6 cutover: build a Battle-shape shim from TurnBattle so
    // processDefeatedEnemies handles bounty/heal-on-kill/talent exactly like
    // the old system without modifying BattleLootSystem.
    const shimEnemies = turnBattle.enemies.map((enemy) => ({
      entity: enemy.entity,
      rewardGranted: this.turnBattleRewardsGranted.has(enemy.entity.id),
    }))

    const shimBattle = {
      player: turnBattle.players[0]?.entity,
      enemies: shimEnemies,
    } as unknown as Battle

    this.deps.battleLoot.processDefeatedEnemies(shimBattle)

    for (const enemyId of killedIds) {
      this.turnBattleRewardsGranted.add(enemyId)
    }

    // Victory/defeat terminal: emit battle_end EXACTLY ONCE per cycle and
    // release StageManager.active (otherwise the next startStage/Rematch
    // fails forever in-session - smoke-test regression 2026-09-04). Auto-repeat
    // does NOT stop - restartTurnBattleCycle reuses the active stage.
    if (
      (turnBattle.state === 'victory' || turnBattle.state === 'defeat') &&
      !this.turnBattleEndEmitted
    ) {
      this.turnBattleEndEmitted = true

      if (!this.turnBattleRepeatContinuously) {
        this.deps.stageWaves.stopRepeat()
      }

      if (turnBattle.state === 'victory') {
        this.deps.eventBus.emit('battle_end', { type: 'battle_end', state: 'victory' })

        this.recordPerfectClearIfEligible(turnBattle)

        // Stage completion: push completedStageIds exactly once per stage
        // (auto-repeat still pushes - the player did complete the stage).
        if (
          this.playerDataForTurnBattle &&
          this.activeStageForTurnBattle &&
          !this.playerDataForTurnBattle.completedStageIds.includes(this.activeStageForTurnBattle.id)
        ) {
          this.playerDataForTurnBattle.completedStageIds.push(this.activeStageForTurnBattle.id)
        }
      }
    }
  }

  /**
   * Auto-farm spec Task 3 (2026-09-04) - Hoan My: team HP loss <= 75% AND
   * turns < stage.perfectClearTurnLimit -> record perfectClearStageIds +
   * perfectClearSeconds ONCE (first achievement is never overwritten).
   */
  private recordPerfectClearIfEligible(turnBattle: TurnBattle) {
    const stage = this.activeStageForTurnBattle
    const player = this.playerDataForTurnBattle

    if (!stage || !player || stage.perfectClearTurnLimit === undefined) {
      return
    }

    if (player.perfectClearStageIds.includes(stage.id)) {
      return
    }

    const entity = turnBattle.players[0]?.entity

    if (!entity) {
      return
    }

    const hpLossPercent = ((entity.maxHp - entity.currentHp) / entity.maxHp) * 100

    const isPerfectClear =
      hpLossPercent <= 75 && (turnBattle.totalTurnsElapsed ?? 0) < stage.perfectClearTurnLimit

    if (!isPerfectClear) {
      return
    }

    const startedAtMs = this.turnBattleStartedAtMs ?? Date.now()
    const clearSeconds = Math.max(0, (Date.now() - startedAtMs) / 1000)

    player.perfectClearStageIds.push(stage.id)
    player.perfectClearSeconds[stage.id] = clearSeconds
  }

  // --- Presentation facade (moved verbatim) -----------------------------------

  /**
   * Manual-mode toggle is listed as an external command in spec section 9.1,
   * so the flag itself - which gates whether the NEXT claimed turn pauses for
   * a choice - queues to the boundary like any other.
   *
   * The stranding rescue below is deliberately NOT part of that deferred
   * body. It resolves the turn ALREADY in flight, the same role
   * submitTurnChoice plays for a turn the player answers themselves (spec
   * section 9.2 exempts that for the same reason) - and unlike
   * submitTurnChoice, deferring it would be self-defeating: the rescue is
   * the only thing that can move a stranded AWAITING_INPUT token to IDLE, so
   * queuing it to "wait for IDLE" would wait forever.
   */
  setBattleManualMode(enabled: boolean): void {
    const stranded = enabled ? null : this.combatAnimationRuntime.getAwaitedManualActor()

    // Turning manual off mid-wait must not strand the token in AWAITING_INPUT
    // - that would freeze the clock for the rest of the battle waiting for a
    // choice the UI no longer offers. The claimed turn becomes an auto turn.
    if (stranded && this.turnToken.getState() === 'AWAITING_INPUT') {
      this.turnToken.submitChoice()
      this.beginTurnPipeline(stranded, 'ready')
    }

    this.enqueueAtTurnBoundary(() => {
      this.combatAnimationRuntime.setBattleManualMode(enabled)
    })
  }

  isBattleManualMode(): boolean {
    return this.combatAnimationRuntime.isBattleManualMode()
  }

  /**
   * Derived from the token, which is the sole authority on whether combat is
   * inside a turn (spec section 2). The runtime still remembers WHICH actor is
   * waiting - that is identity, not a second copy of this fact.
   */
  isAwaitingManualTurnChoice(): boolean {
    return this.turnToken.getState() === 'AWAITING_INPUT'
  }

  setPresentationMode(mode: PresentationMode): void {
    this.presentationMode = mode
  }

  getPresentationMode(): PresentationMode {
    return this.presentationMode
  }

  getCurrentPresentationSession(): SessionRef | null {
    return this.presentationSession.getCurrentSession()
  }

  /**
   * The port the presentation coordinator drives. Every transition that can
   * change whether the battle is on screen re-evaluates the clock's
   * `not-revealed` freeze reason, so readiness reaches combat time through the
   * reason set and nowhere else.
   */
  getPresentationPort(): SessionPresentationPort {
    return {
      getCurrentSession: () => this.presentationSession.getCurrentSession(),
      hold: (session) => this.withOffScreenSync(() => this.presentationSession.hold(session)),
      attach: (token) => this.withOffScreenSync(() => this.presentationSession.attach(token)),
      release: (token) => this.withOffScreenSync(() => this.presentationSession.release(token)),
      detach: (token, policy) =>
        this.withOffScreenSync(() => this.presentationSession.detach(token, policy)),
    }
  }

  private withOffScreenSync<T>(operation: () => T): T {
    const result = operation()

    this.syncOffScreenFreeze()

    return result
  }

  /** True while the current interactive session is held by the coordinator. */
  isAwaitingPresentationLayer(): boolean {
    return this.presentationSession.isBlocking()
  }

  getPendingPlaybackToken(): string | null {
    return this.combatAnimationRuntime.getPendingPlaybackToken()
  }

  preparePresentationResume(): ResumePlayback | null {
    return this.combatAnimationRuntime.preparePresentationResume()
  }

  setPresentationActive(active: boolean): void {
    this.combatAnimationRuntime.setPresentationActive(active)
  }

  isActionPlaybackWaiting(): boolean {
    return this.combatAnimationRuntime.isActionPlaybackWaiting()
  }

  acknowledgeTurnReady(token?: string): void {
    this.combatAnimationRuntime.acknowledgeTurnReady(token)
  }

  acknowledgeActionImpact(token?: string): void {
    this.combatAnimationRuntime.acknowledgeActionImpact(token)
  }

  acknowledgeActionComplete(token?: string): void {
    this.combatAnimationRuntime.acknowledgeActionComplete(token)
  }

  /**
   * submitTurnChoice is NOT an external command: it is consumed by the
   * AWAITING_INPUT state and never queued past it (spec section 9.2). The
   * runtime declares the chosen action; from there the turn runs the same
   * pipeline an auto turn does, starting at the impact step because the ready
   * and cast phases have just happened.
   */
  submitTurnChoice(role: TurnSkillSlotRole): boolean {
    const actor = this.combatAnimationRuntime.getAwaitedManualActor()
    const accepted = this.combatAnimationRuntime.submitTurnChoice(role)

    if (!accepted || !actor) {
      return accepted
    }

    if (this.turnToken.getState() === 'AWAITING_INPUT') {
      this.turnToken.submitChoice()
    }

    this.beginTurnPipeline(actor, 'impact')

    return true
  }

  consumeAwaitedActorId(): string | null {
    return this.combatAnimationRuntime.getAwaitedManualActor()?.id ?? null
  }

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
        ? (this.combatAnimationRuntime.getAwaitedManualActor() ?? undefined)
        : undefined,
    )
  }

  // --- Auto-farm (spec 2026-09-04-stage-auto-farm, Task 4) ---------------------

  /**
   * Enable auto-farm for a stage that reached Hoan My. Shares the SAME
   * single-slot StageManager with manual/repeat/progress (exclusivity
   * uniform) - no TurnBattleSystem, no animation; reward rolls by wall-clock.
   */
  startAutoFarm(player: PlayerData, stageId: string): boolean {
    if (!player.perfectClearStageIds.includes(stageId)) {
      return false
    }

    if (this.deps.stageManager.get() !== null) {
      return false
    }

    const stage = this.deps.stageTemplates.get(stageId)

    if (!stage) {
      return false
    }

    if (!this.deps.stageManager.start(stage)) {
      return false
    }

    player.autoFarmStage = { stageId, lastCheckedMs: Date.now() }

    return true
  }

  stopAutoFarm(player: PlayerData): void {
    if (player.autoFarmStage === null) {
      return
    }

    player.autoFarmStage = null
    this.deps.stageManager.stop()
  }

  /**
   * Auto-farm Task 5 - offline catch-up on save restore: roll rewards for
   * cycles elapsed offline (the ONE exception where combat rewards are
   * granted offline). Online cycle time (perfectClearSeconds/2); leftover
   * time carries via lastCheckedMs advancing by exactly the settled part.
   *
   * Remediation Task 3 (2026-09-05) - BOUNDED settlement:
   * - elapsedOfflineSeconds clamped by DEFAULT_MAX_OFFLINE_SECONDS (24h -
   *   the single GameClock source, no second cap invented here).
   * - cycleSeconds <= 0 / non-finite -> safe no-op (blocks Infinity cycles
   *   from malformed saves - evidence: infinite-loop timeout in tests).
   */
  settleAutoFarmOffline(player: PlayerData, elapsedOfflineSeconds: number): void {
    const autoFarm = player.autoFarmStage

    if (!autoFarm) {
      return
    }

    const cycleSeconds = player.perfectClearSeconds[autoFarm.stageId]

    if (cycleSeconds === undefined || !(cycleSeconds > 0) || !Number.isFinite(cycleSeconds)) {
      return
    }

    const cappedElapsedSeconds = Math.min(
      Math.max(0, elapsedOfflineSeconds),
      DEFAULT_MAX_OFFLINE_SECONDS,
    )

    const cycleMs = (cycleSeconds / 2) * 1000
    const elapsedMs = cappedElapsedSeconds * 1000
    const completedCycles = Math.floor(elapsedMs / cycleMs)

    if (completedCycles <= 0) {
      return
    }

    const stage = this.deps.stageTemplates.get(autoFarm.stageId)

    if (!stage) {
      return
    }

    for (let i = 0; i < completedCycles; i++) {
      this.rollAutoFarmCycleReward(player, stage)
    }

    autoFarm.lastCheckedMs += completedCycles * cycleMs
  }

  /**
   * Tick auto-farm from the fixed-step loop: each completed cycle rolls its
   * reward through the BattleLootSystem shim (no simulation). Partial cycle
   * time carries over via lastCheckedMs.
   */
  private tickAutoFarm(player: PlayerData) {
    const autoFarm = player.autoFarmStage

    if (!autoFarm) {
      return
    }

    const cycleSeconds = player.perfectClearSeconds[autoFarm.stageId]

    if (cycleSeconds === undefined) {
      return
    }

    const cycleMs = (cycleSeconds / 2) * 1000
    const now = Date.now()
    const elapsedMs = now - autoFarm.lastCheckedMs
    const completedCycles = Math.floor(elapsedMs / cycleMs)

    if (completedCycles <= 0) {
      return
    }

    const stage = this.deps.stageTemplates.get(autoFarm.stageId)

    if (!stage) {
      return
    }

    for (let i = 0; i < completedCycles; i++) {
      this.rollAutoFarmCycleReward(player, stage)
    }

    autoFarm.lastCheckedMs += completedCycles * cycleMs
  }

  /**
   * Roll one auto-farm cycle: build a "dead enemies" shim from the stage
   * enemyPool and reuse processDefeatedEnemies (bounty/heal-on-kill/talent
   * identical to a real battle) - no TurnBattleSystem, no animation.
   */
  private rollAutoFarmCycleReward(player: PlayerData, stage: Stage) {
    this.deps.battleLoot.beginBattle()
    this.deps.battleLoot.setSession(this.deps.buildPlayerRewardReceiver(player), player)

    const killedEntities: { entity: CombatEntity; rewardGranted: boolean }[] = []

    const rollTotalEnemyCount = effectiveTotalEnemyCount(stage)

    for (let i = 0; i < rollTotalEnemyCount; i++) {
      const isFinalSpawn = i === rollTotalEnemyCount - 1
      const template = this.deps.stageWaves.pickEnemyForTurnSpawn(stage, isFinalSpawn)

      if (!template) {
        continue
      }

      const entity = enemyToCombatEntity(this.deps.enemySystem.spawn(template))
      entity.alive = false

      killedEntities.push({ entity, rewardGranted: false })
    }

    // Player shim: only processDefeatedEnemies's heal-on-kill branch reads
    // it - a non-alive entity is an inert placeholder (heal math inert).
    const shimBattle = {
      player: killedEntities[0]?.entity,
      enemies: killedEntities,
    } as unknown as Battle

    this.deps.battleLoot.processDefeatedEnemies(shimBattle, stage)
  }
}
