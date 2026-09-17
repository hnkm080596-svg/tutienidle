import type { SessionRef } from '../presentation/PresentationSession'
import { isBattleInProgress } from '../battle/BattleTypes'
import { BATTLE_CYCLE_POLICIES, type BattleCyclePolicy } from '../battle/BattleCyclePolicy'
import type { ProgressionNode } from '../progression/ProgressionNode'
import type { CultivationPathRuntime } from '../player/CultivationPathRuntime'
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
import type { CombatRng } from '../battle/contracts/rng'
import type { CombatEntityId } from '../battle/contracts/ids'
import { FunctionCombatRng } from '../battle/runtime/rng/FunctionCombatRng'
import { CombatOperationExecutor } from '../battle/runtime/scheduler/CombatOperationExecutor'
import { CombatScheduler } from '../battle/runtime/scheduler/CombatScheduler'
import { CombatSystemDamageAdapter } from '../battle/runtime/scheduler/adapters/CombatSystemDamageAdapter'
import { CombatSystemHealAdapter } from '../battle/runtime/scheduler/adapters/CombatSystemHealAdapter'
import { ActionGaugeAdapter } from '../battle/runtime/scheduler/adapters/ActionGaugeAdapter'
import { EntityResourceAdapter } from '../battle/runtime/scheduler/adapters/EntityResourceAdapter'
import { VitalsShieldAdapter } from '../battle/runtime/scheduler/adapters/VitalsShieldAdapter'
export type { ResumePlayback } from '../battle/turn/CombatAnimationRuntime'
import { BuffSystem } from '../buff/BuffSystem'
import { TurnReactionManager } from '../battle/turn/TurnReactionManager'
import type { TurnSkillDefinition, ForcedTurnChoice } from '../battle/turn/TurnSkillAction'
import { emitTurnBattleEntitySnapshot } from '../battle/turn/TurnActionPresentationEvents'
import {
  diffAndEmitTurnStatusVfx,
  type TurnStatusSnapshotEntry,
} from '../battle/turn/TurnStatusPresentationEvents'
import { enemyToCombatEntity } from '../enemy/Enemy'
import type { Enemy } from '../enemy/Enemy'
import type { CombatEntity } from '../combat/CombatEntity'
import type { SurviveLethalSource } from '../combat/CombatSystem'
import { effectiveTotalEnemyCount } from '../stage/EffectiveEnemyCount'
import { effectiveWaves } from '../stage/EffectiveWaves'
import type { Stage } from '../stage/Stage'

import { GENERIC_PHYSICAL_BASIC } from '../../data/skill/TurnBasicAttacks'
import { TRAN_PHAP_FORMATIONS } from '../../data/formation/TranPhap'
import { BUFF_REGISTRY } from '../../data/buff/BuffRegistry'
import type { Buff, BuffDefinition } from '../buff/BuffTypes'
import type { FormationLoadout, PlayerData } from '../player/Player'
import { playerToCombatEntity } from '../player/Player'
import type { Stats } from '../stats/StatBlock'
import type { StatModifier } from '../stats/StatCalculator'
import { DEFAULT_PARTY_FORMATION } from './PartyFormation'
import { commitFormationLoadout, resolvePartyFormation } from './FormationPlacement'
import { toTurnBattleParticipant } from './TurnBattleAdapter'
import { companionToCombatEntity } from '../companion/CompanionCombat'
import { resolveCompanionSkillKit } from '../companion/CompanionProgression'
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

import type { TemplateRegistry } from './TemplateRegistry'


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
import type { TurnStepSignal } from './GameManagerTurnBattlePresentationOps'
import { GameManagerTurnBattlePresentationOps } from './GameManagerTurnBattlePresentationOps'
import { GameManagerBattleRewardOps } from './GameManagerBattleRewardOps'
import { GameManagerAutoFarmOps } from './GameManagerAutoFarmOps'

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

  // Reward-flow flags (rewardsGranted set + battleEndEmitted) live in
  // rewardOps - the terminal/grant flow owns them exclusively.

  // Phase A6 (9.5 #7) — last-emitted status snapshot + the battle instance
  // it belongs to. Persistent across steps so construction-time buffs emit
  // attach on first observation; a replaced battle resets via identity.
  private statusVfxSnapshot = new Map<string, TurnStatusSnapshotEntry>()
  private statusVfxBattle: TurnBattle | null = null

  // Wave-2 sub-splits: presentation facade owns CombatAnimationRuntime +
  // PresentationSession + mode; rewardOps owns the grant/terminal flags;
  // autoFarmOps owns the wall-clock farm cycle (no battle state).
  readonly presentationOps: GameManagerTurnBattlePresentationOps
  readonly rewardOps: GameManagerBattleRewardOps
  readonly autoFarmOps: GameManagerAutoFarmOps

  private isStageStarting = false

  /** The Stage object mid-launch - tunneled to the inner beginBattleCycle
   * call (the launch chain startStage -> stageWaves.start -> launchBattle
   * cannot pass it through). Set/cleared around stageWaves.start only. */
  private pendingLaunchStage: Stage | null = null

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

  /**
   * 9.5 #9 — engine-side cast notification, filtered to the primary
   * player. The engine reports every committed cast (enemy, companion,
   * player); only players[0] writes into the skillCastCounts/skillLevels
   * mirror via deps.recordPrimaryPlayerCast. Reads this.turnBattle live:
   * players[0]'s participant identity is rebuilt per battle.
   */
  private readonly onSkillCast = (actor: TurnBattleParticipant, skillId: string): void => {
    if (actor === this.turnBattle?.players[0]) {
      this.deps.recordPrimaryPlayerCast?.(skillId)
    }
  }

  /**
   * ARCH-002 (M7) — battle-scoped live-modifier provider handed to
   * TurnBattleSystem. Only the primary player has a runtime modifier
   * channel today (passive stacks, persistent pool, timed/socket
   * effects); companions and enemies return []. The closure reads the
   * aggregation owner live, so mid-battle stack/expiry changes fold at
   * the next effective-stat refresh.
   */
  private readonly liveStatModifiers = (entity: CombatEntity): StatModifier[] => {
    if (entity.id !== 'player') {
      return []
    }

    const player = this.deps.getActivePlayer()

    return player ? this.deps.getLiveBattleModifiers(player) : []
  }

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
    // SkillManager level snapshot for playerToCombatEntity (owned by GameManager).
    getSkillLevels: () => Record<string, number>
    // PassiveSystem owns per-battle passive stacks; ops requests the reset.
    resetPassiveStacks: () => void
    // ARCH-002 (M7) — resolved-base authority for the battle snapshot:
    // GameManager wires resolvePlayerFinalStats(player,
    // effectOps.getBattleBaseModifiers(player)). Called INSIDE the
    // post-reset window so ephemeral stacks can never bake into baseStats.
    resolvePlayerStats: (player: PlayerData) => Stats
    // ARCH-002 (M7) — live runtime modifiers for the engine's
    // liveStatModifiers provider (passive stacks, persistent pool,
    // timed/socket effects). Same owner as the menu aggregation
    // (GameManagerPersistentEffectOps) — never a second calculator.
    getLiveBattleModifiers: (player: PlayerData) => StatModifier[]
    // M2 — Pha Giap carry: bank/seed the bound passive's stacks across
    // battles (PassiveSystem owns the stacks; PlayerData owns the bank).
    bankPassiveCarry: (player: PlayerData) => void
    seedPassiveCarry: (player: PlayerData) => void
    buildPlayerRewardReceiver: (player: PlayerData) => RewardReceiver
    // Mission C Task 9 — the cultivation-path boundary: GameManager wires
    // the registry resolver; this ops consumes the runtime interface and
    // never branches on path/way identity (guard:
    // tests/architecture/battleLifecyclePathBoundary.test.ts).
    resolvePathRuntime: (player: PlayerData) => CultivationPathRuntime
    // 9.5 #9 — committed-cast sink for the PRIMARY player only
    // (SkillSystem.recordCast; engine fires for every actor, ops filters
    // to turnBattle.players[0] so companion/enemy casts never write into
    // the player's skillCastCounts/skillLevels mirror).
    recordPrimaryPlayerCast?: (skillId: string) => void
    // Kiem Tu Reimagined Task 11 — registered node defs for the path
    // runtime's collectors (combo capstones, cascade unlocks). Read-only
    // access; the registry remains GameManager-owned (A3).
    getProgressionNodes: () => readonly ProgressionNode[]
    /**
     * Mission C Task 8 — mints the session RNG for ONE battle cycle
     * (combat-contract M4: typed CombatRng, consumed via roll()/
     * rollChance()). Scope boundary: only combat rolls consume it
     * (combat formulas, proc chances, spawn placement, pool/tag/
     * hidden-beast picks, engine rolls). Loot/alchemy/pill economy
     * randomness stays on Math.random deliberately — a seeded battle
     * must not pin drops.
     */
    createBattleRng?: () => CombatRng
  }) {
    this.turnBattleSystem = new TurnBattleSystem(
      deps.combatSystem,
      10_000,
      // ARCH-002 (M7) — non-stage battles still need the live buff
      // registry: skill appliesBuff branches (kim_giap/dia_tru self-buffs,
      // target debuffs) no-op silently without it. Stage-path systems
      // below already pass BUFF_REGISTRY.
      BUFF_REGISTRY,
      undefined,
      undefined,
      this.onSkillCast,
      this.liveStatModifiers,
      this.combatRng,
      this.combatScheduler,
    )
    // Presentation facade (Wave-2 split) - owns the PresentationSession +
    // CombatAnimationRuntime + mode flag. Deferred closures keep the
    // runtime reading the LIVE turnBattleSystem/turnBattle (both are
    // reassigned wholesale by restartTurnBattleCycle()/startStage()) and
    // route step completion back into this core's pipeline settleStep.
    this.presentationOps = new GameManagerTurnBattlePresentationOps({
      sessionAllocator: deps.sessionAllocator,
      eventBus: deps.eventBus,
      getTurnBattleSystem: () => this.turnBattleSystem,
      getTurnBattle: () => this.turnBattle,
      syncOffScreenFreeze: () => this.syncOffScreenFreeze(),
      settleStep: (signal) => this.settleStep(signal),
    })

    this.rewardOps = new GameManagerBattleRewardOps({
      getTurnBattle: () => this.turnBattle,
      getActiveStage: () => this.activeStageForTurnBattle,
      getPlayerData: () => this.playerDataForTurnBattle,
      getStartedAtMs: () => this.turnBattleStartedAtMs,
      getRepeatContinuously: () => this.turnBattleRepeatContinuously,
      battleLoot: deps.battleLoot,
      stageWaves: deps.stageWaves,
      eventBus: deps.eventBus,
      bankPassiveCarry: deps.bankPassiveCarry,
    })

    this.autoFarmOps = new GameManagerAutoFarmOps({
      stageManager: deps.stageManager,
      stageTemplates: deps.stageTemplates,
      battleLoot: deps.battleLoot,
      stageWaves: deps.stageWaves,
      enemySystem: deps.enemySystem,
      buildPlayerRewardReceiver: deps.buildPlayerRewardReceiver,
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
    if (this.presentationOps.session.isBlocking()) {
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
        // Task 11 — a queued repeat/multicast execution is NOT a turn
        // choice: manual mode must not park it awaiting input (the cast
        // was already committed; the follow-up resolves automatically).
        const isQueuedExecution = this.turnBattleSystem.isPendingQueuedExecution(readyActor.id)

        this.turnToken.claim({
          actorId: readyActor.id,
          isPlayerTeam: battle.players.includes(readyActor),
          manualMode: isQueuedExecution ? false : this.presentationOps.runtime.isBattleManualMode(),
        })

        if (this.turnToken.getState() === 'AWAITING_INPUT') {
          this.presentationOps.runtime.pauseForManualActor(readyActor)
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
        // Phase A6 (9.5 #7) — status-icon feed. `before` is the LAST-EMITTED
        // snapshot for this battle instance (empty on first observation:
        // buffs applied at construction/intro/countdown attach then). A
        // replaced battle (auto-repeat) resets to empty — the scene clears
        // stale icons itself on battle transition, and emitting removed
        // events for a dead battle would be noise.
        const statusBefore =
          this.statusVfxBattle === this.turnBattle
            ? this.statusVfxSnapshot
            : new Map<string, TurnStatusSnapshotEntry>()
        this.statusVfxSnapshot = diffAndEmitTurnStatusVfx(
          this.deps.eventBus,
          this.turnBattle,
          statusBefore,
        )
        this.statusVfxBattle = this.turnBattle
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
          this.presentationOps.runtime.notifyReadyActor(actor)
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
    const token = this.presentationOps.runtime.getPendingPlaybackToken() ?? undefined

    if (signal === 'ready') {
      this.presentationOps.runtime.acknowledgeTurnReady(token)
    } else if (signal === 'impact') {
      this.presentationOps.runtime.acknowledgeActionImpact(token)
    } else {
      this.presentationOps.runtime.acknowledgeActionComplete(token)
    }
  }

  /**
   * Headless: no renderer will ever report this step, so the engine plays
   * Phaser's part immediately and the step completes inside its own run().
   * Headless resolution is therefore unchanged in substance; what changed is
   * that the PIPELINE owns the ordering in both modes.
   */
  private settleHeadlessStep(signal: TurnStepSignal): void {
    if (this.presentationOps.runtime.isPresentationActive()) {
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
    this.rewardOps.grantBattleRewardIfNeeded()

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

      return
    }

    // Spec section 8: combat-over STOPS the clock. It does not freeze it - the
    // battle is over and nothing more will advance.
    this.combatClock.stop()
  }

  // --- Battle state queries ---------------------------------------------

  getTurnBattle(): TurnBattle | null {
    return this.turnBattle
  }

  /**
   * Whether a turn battle is actively in progress (intro/countdown/
   * fighting). The TurnBattle object is retained after victory/defeat so
   * consumers can read the terminal result — callers that need an
   * in-combat gate must use this query, not `getTurnBattle() !== null`.
   */
  isTurnBattleInProgress(): boolean {
    return this.turnBattle !== null && isBattleInProgress(this.turnBattle.state)
  }

  /**
   * The stage that launched the CURRENT turn battle (null for non-stage
   * battles like tribulation). Read-only query — combat UI needs the
   * launching stage's own fields (perfectClearTurnLimit for the round
   * indicator), not the UI selection, which may point elsewhere.
   */
  getActiveTurnBattleStage(): Stage | null {
    return this.activeStageForTurnBattle
  }


  /**
   * F4 (architecture-qa-repairs) - validating owner for the Tran Phap
   * loadout commit. TranPhapPanel routes its draft here instead of writing
   * player.formationLoadout directly; the validation rules live in
   * FormationPlacement.commitFormationLoadout, next to the
   * resolvePartyFormation() consumer whose assumptions they guard.
   * Returns false without mutating the player when the draft is invalid.
   */
  setFormationLoadout(player: PlayerData, loadout: FormationLoadout): boolean {
    return commitFormationLoadout(player, loadout)
  }

  // --- Battle start -------------------------------------------------------

  spawnEnemy(template: Enemy): Enemy {
    return this.deps.enemySystem.spawn(template)
  }

  /**
   * Monotonic cycle id (Task 5): every beginBattleCycle bumps it, so stale
   * pending state from a previous battle can be diagnosed against the
   * current cycle. Diagnostic surface only - the token guard remains the
   * mutation authority.
   */
  private battleGeneration = 0

  /**
   * Mission C Task 8 — the session RNG for the CURRENT cycle, re-typed
   * to CombatRng by combat-contract M4. Minted by beginBattleCycle from
   * deps.createBattleRng; every combat roll reads it (combat formulas
   * via combatSystem.setRandomSource, engine rolls via the
   * TurnBattleSystem ctor param, spawn placement + pool/tag/
   * hidden-beast picks via the spawn closures). Downstream helpers that
   * still take `() => number` receive `() => rng.roll()` — identical
   * consumption order.
   */
  // Lazy default — a stored `Math.random` reference would bypass
  // vi.spyOn interception. Re-minted per cycle by mintCycleRng().
  private combatRng: CombatRng = new FunctionCombatRng(() => Math.random())

  /**
   * Test/dev seam mirroring setCombatClockSource: swap the factory that
   * mints each cycle's session RNG. Applies from the NEXT cycle.
   */
  setBattleRngFactory(factory: (() => CombatRng) | undefined): void {
    this.battleRngFactoryOverride = factory
  }

  private battleRngFactoryOverride: (() => CombatRng) | undefined

  /**
   * Mission C Task 9 — dev/test seam mirroring setBattleRngFactory: swap
   * the path-runtime resolver (a test registers a fake_path runtime the
   * shipped registry does not know). `undefined` restores the registry.
   */
  setPathRuntimeResolver(resolver: ((player: PlayerData) => CultivationPathRuntime) | undefined): void {
    this.pathRuntimeOverride = resolver
  }

  private pathRuntimeOverride: ((player: PlayerData) => CultivationPathRuntime) | undefined

  private resolvePathRuntime(player: PlayerData): CultivationPathRuntime {
    return (this.pathRuntimeOverride ?? this.deps.resolvePathRuntime)(player)
  }

  private mintCycleRng(): void {
    // The built-in fallback wraps a LAZY Math.random closure in a
    // FunctionCombatRng — storing `Math.random` by reference would
    // bypass vi.spyOn interception (the sanctioned spy seam).
    this.combatRng =
      (this.battleRngFactoryOverride ?? this.deps.createBattleRng)?.() ??
      new FunctionCombatRng(() => Math.random())
    // CombatSystem keeps its `() => number` seam — the wrapper forwards
    // to THIS mint's stream (capture the object, not the mutable field).
    const rng = this.combatRng
    this.deps.combatSystem.setRandomSource(() => rng.roll())
  }

  /**
   * Combat-contract M4 — the per-cycle operation scheduler + executor.
   * CONSTRUCTED but DORMANT: no authored ops route through it until the
   * buff/skill cutover lands; TurnBattleSystem receives it as a ctor
   * dep alongside the cycle CombatRng. Every lookup closes over the
   * LIVE turnBattle (read at call time — the field is reassigned
   * wholesale per cycle) so op target ids resolve to the same objects
   * the engine mutates.
   */
  private combatScheduler: CombatScheduler | undefined

  private mintCycleScheduler(): void {
    const resolveParticipant = (
      id: CombatEntityId,
    ): TurnBattleParticipant | undefined => {
      const battle = this.turnBattle
      if (battle === null) {
        return undefined
      }
      return (
        battle.players.find((participant) => participant.id === id) ??
        battle.enemies.find((participant) => participant.id === id)
      )
    }
    const resolveEntity = (id: CombatEntityId): CombatEntity | undefined =>
      resolveParticipant(id)?.entity

    const executor = new CombatOperationExecutor({
      damage: new CombatSystemDamageAdapter(this.deps.combatSystem, resolveEntity, {
        // M3 carryover — the same resolution declareActorAction hands
        // BuffSystem.update (the DoT SOURCE's own pool), so authored
        // dotRecovery triggers stay reachable on legacy_dot ops.
        resolveSourceBuffs: (id: CombatEntityId): readonly Buff[] | undefined =>
          resolveParticipant(id)?.buffs.getAll(),
      }),
      heal: new CombatSystemHealAdapter(this.deps.combatSystem, resolveEntity),
      gauge: new ActionGaugeAdapter((id) => resolveParticipant(id), resolveEntity),
      resource: new EntityResourceAdapter(resolveEntity),
      shield: new VitalsShieldAdapter(this.deps.combatSystem.vitals, resolveEntity),
      // buffs port stays unwired until the buff2 authority lands.
    })

    this.combatScheduler = new CombatScheduler(executor, {
      preconditions: {
        isAlive: (id) => resolveParticipant(id)?.entity.alive ?? false,
        getBuffInstance: (instanceId) => {
          // Legacy Buff.id is the DEFINITION id (the per-instance key is
          // (id, sourceId)); a real BuffInstanceId arrives with the buff
          // authority cutover. Until then this is a fail-closed
          // best-effort: a wrong first match fails the batch's
          // expected-source/target/stacks check (stale skip), never a
          // wrong execute.
          const battle = this.turnBattle
          if (battle === null) {
            return undefined
          }
          for (const participant of [...battle.players, ...battle.enemies]) {
            const buff = participant.buffs.getAll().find((entry) => entry.id === instanceId)
            if (buff !== undefined) {
              return { sourceId: buff.sourceId, targetId: buff.targetId, stacks: buff.stacks }
            }
          }
          return undefined
        },
      },
    })
  }

  getBattleGeneration(): number {
    return this.battleGeneration
  }

  /**
   * Cycle-entry teardown shared by beginBattleCycle and abandonBattle:
   * drops every piece of state parked on the PREVIOUS cycle before new
   * state is built (or after the old battle is destroyed). Order matters:
   * pending fallback timers die first, then the engine/presentation/token
   * layer, then the command queue. Per-battle engine reset is mandatory
   * (spec section 3.3 / blocker A5): a token left in COMBAT_OVER would
   * reject the next battle's first claim and freeze it permanently.
   */
  private clearCycleEntryState(): void {
    this.clearPendingSteps()
    this.pipeline.reset()
    this.turnToken.reset()
    this.presentationOps.runtime.resetPendingState()
    this.boundaryQueue = []
  }

  /**
   * THE one battle-lifecycle owner (Mission C, spec C2). Every entry path
   * - startBattle (test/devtools), startBattleWithPlayer (fresh/stage via
   * the stageWaves launch chain), restartTurnBattleCycle (repeat) -
   * funnels here exactly once; callers contribute only validation and
   * post-entry glue. The canonical order:
   *
   *   1. Cycle-entry teardown (clearCycleEntryState) + generation bump.
   *   2. Per-policy domain resets (reward once-guards, loot session,
   *      survive session, passive stacks BEFORE the stats snapshot).
   *   3. Player side: the same bootstrap for fresh/stage/repeat -
   *      resolve stats, build entity, snapshot maxThe.
   *   4. Battle assembly: buildTurnBattle + entry state + stage wave
   *      rebuild + fresh TurnBattleSystem.
   *   5. Player wiring: seedPassiveCarry, loot session, survive-lethal
   *      session (talent guard + Bat Tu source).
   *   6. Presentation session (non-stage kinds only; startStage owns its
   *      own post-block session work, repeat preserves the live session).
   *   7. Clock restart.
   */
  private beginBattleCycle(
    policy: BattleCyclePolicy,
    request: {
      player?: PlayerData
      playerEntity?: CombatEntity
      initialEnemy?: Enemy
      /** 'repeat' carries the preserved stage; 'stage' reads StageManager. */
      stage?: Stage
    },
  ): void {
    // 1. Session/pending teardown - BEFORE any new state is built.
    this.clearCycleEntryState()
    this.battleGeneration += 1

    // Mint the cycle's session RNG here so EVERY roll below - spawn
    // placement, enemy-pool picks, engine rolls, combat formulas - reads
    // one source. Scope guard (spec C3): loot/alchemy/pill economy
    // randomness intentionally stays on Math.random; only the battle
    // session is seeded. A stage launch pre-mints in startStage (the
    // wave system's first-enemy pick runs before this call), so the
    // nested beginBattleCycle inside a launch chain does not re-mint.
    if (!this.isStageStarting) {
      this.mintCycleRng()
    }

    // 2. Per-policy domain resets. ARCH-014 (M12): a fresh battle owns a
    // fresh terminal once-guard - a battle started after any terminal would
    // otherwise inherit battleEndEmitted=true and never publish battle_end.
    this.rewardOps.resetRewardState()

    if (!policy.preserveLootSession) {
      this.deps.battleLoot.beginBattle()
    }

    this.deps.combatSystem.setSurviveLethalSession(null)

    // ARCH-002 (M7) - ephemeral passive state resets BEFORE the resolved
    // snapshot is taken; live runtime modifiers reach entity.stats through
    // the engine's provider each refresh instead.
    this.deps.resetPassiveStacks()

    if (!policy.preserveStageBinding) {
      // Stage-aggregate state belongs to the stage that set it - a
      // non-stage battle drops the binding, the repeat arm and the run
      // timer so nothing stale leaks into an unrelated battle.
      this.activeStageForTurnBattle = null
      this.turnBattleRepeatContinuously = false
      this.turnBattleStartedAtMs = null
    }

    // 3. Player side.
    let playerEntity: CombatEntity | null = null

    if (request.player) {
      const playerStats = this.deps.resolvePlayerStats(request.player)

      playerEntity = playerToCombatEntity(
        request.player,
        playerStats,
        this.deps.getSkillLevels(),
      )

      // Task 8 - snapshot the query-derived The cap (truong_the nodes,
      // 'no' route). Non-phap_tu paths resolve to MAX_THE; the field
      // stays the clamp source for this battle instance only.
      playerEntity.maxThe = this.resolvePathRuntime(request.player).resolveMaxThe(request.player)
    } else if (request.playerEntity) {
      playerEntity = request.playerEntity
    }

    if (!playerEntity) {
      return
    }

    // 4. Battle assembly.
    const enemyEntities: CombatEntity[] = []

    if (request.initialEnemy) {
      enemyEntities.push(enemyToCombatEntity(this.deps.enemySystem.spawn(request.initialEnemy)))
    }

    this.turnBattle = this.buildTurnBattle(playerEntity, enemyEntities)
    this.turnBattle.state = policy.entryState

    const stageRef =
      request.stage ??
      (policy.kind === 'stage' ? this.pendingLaunchStage : null)

    if (stageRef) {
      // Wave-driven battle: the bootstrap enemy spawned above (the stage
      // launch chain always supplies one) is removed so EVERY enemy -
      // including the first - spawns through the wave telegraph per the
      // 2026-09-06 redesign. Despawn it from EnemySystem too (not only
      // turnBattle.enemies) so victory-despawn assertions stay clean.
      for (const bootstrap of this.turnBattle.enemies) {
        this.deps.enemySystem.despawn(bootstrap.entity.id)
      }
      this.turnBattle.enemies = []
      this.turnBattle.wave = {
        totalEnemyCount: effectiveTotalEnemyCount(stageRef),
        spawnedCount: 0,
        waves: effectiveWaves(stageRef),
        waveIndex: 0,
        pendingEnemySpawns: [],
      }
    }

    // A fresh cycle owns a fresh engine - its private pending fields
    // (reactive entries, queued executions, gauge deltas, manual options)
    // can never carry across a boundary. The operation scheduler mints
    // alongside it (M4 - constructed but dormant until the buff/skill
    // cutover routes authored ops through it).
    this.mintCycleScheduler()
    this.turnBattleSystem = new TurnBattleSystem(
      this.deps.combatSystem,
      10_000,
      BUFF_REGISTRY,
      stageRef ? this.buildStageSpawnFactory(stageRef) : undefined,
      stageRef ? new TurnReactionManager(this.deps.eventBus) : undefined,
      this.onSkillCast,
      this.liveStatModifiers,
      this.combatRng,
      this.combatScheduler,
    )

    // ARCH-002 (M7) - fold construction-time buffs (formation Tran Phap)
    // and the live runtime modifiers into entity.stats immediately, so no
    // dependent read can observe the pre-buff base.
    this.turnBattleSystem.refreshEffectiveStats(this.turnBattle)

    // 5. Player wiring (player battles only - a raw-entity 'test' battle
    // has no reward receiver and no talent session).
    const player = request.player ?? null
    this.playerDataForTurnBattle = policy.preserveStageBinding
      ? (player ?? this.playerDataForTurnBattle)
      : player

    if (player) {
      // M2 - Pha Giap carry: re-seed banked stacks AFTER the per-battle
      // reset above, then fold them into entity.stats so no read can
      // observe a pre-seed view.
      this.deps.seedPassiveCarry(player)
      this.turnBattleSystem.refreshEffectiveStats(this.turnBattle)

      this.deps.battleLoot.setSession(this.deps.buildPlayerRewardReceiver(player), player)

      // Bat Tu The - reset the survive-lethal charge per battle from the
      // player's talents, then attach the session for
      // combatSystem.killIfDead(). players[0] is the human player
      // (companions append after index 0 in buildTurnBattle).
      this.deps.surviveLethalGuard.beginBattle(player.selectedTalentIds)

      // The Tu Reimagined - Cuong Chien's Bat Tu Ba The ultimate is the
      // FIRST line of survival; the talent guard is the extra life once
      // the ult is spent/on cooldown.
      const playerParticipant = this.turnBattle.players[0]
      const extraSurviveSources = playerParticipant
        ? this.resolvePathRuntime(player).buildSurviveSources?.(player, playerParticipant)
        : undefined

      this.deps.combatSystem.setSurviveLethalSession({
        playerEntityId: playerEntity.id,
        guard: this.deps.surviveLethalGuard,
        // v4 - Bat Tu The cleanse/grant on save, wired to the LIVE
        // turn-based player pool.
        surviveEffects: playerParticipant
          ? {
              buffSystem: new BuffSystem(playerParticipant.buffs),
              registry: BUFF_REGISTRY,
              grantBuffId: 'tu_sinh_ngo',
              cleanseDebuffs: true,
            }
          : undefined,
        extraSources: extraSurviveSources?.length ? extraSurviveSources : undefined,
      })
    }

    // 6. Presentation session for non-stage kinds. startStage ends/begins
    // its own session in the post-launch block; 'repeat' keeps the running
    // session (the stage launch already opened it).
    if (policy.kind === 'fresh' || policy.kind === 'test') {
      const activeSession = this.presentationOps.session.getCurrentSession()
      if (activeSession) {
        this.presentationOps.session.end(activeSession)
      }
      const session: SessionRef = {
        kind: 'combat',
        sessionId: this.presentationOps.session.allocate(),
      }
      this.presentationOps.session.begin(session, this.presentationOps.getPresentationMode())
      if (this.presentationOps.getPresentationMode() === 'interactive') {
        this.presentationOps.session.hold(session)
      }
      this.deps.eventBus.emit('presentation_session_started', session)
    }

    // 7. A fresh battle owns a fresh clock run. stop() before start()
    // matters - the previous battle may have stopped the clock at
    // combat-over, and stop() is what clears the stale freeze reasons.
    this.combatClock.stop()
    this.combatClock.start()
    this.syncOffScreenFreeze()
  }

  /**
   * Stage-bound spawnEnemy factory (was duplicated across startStage and
   * restartTurnBattleCycle). isFinalSpawn: the last spawn of the stage is
   * the boss - the factory runs BEFORE resolveNextStep increments
   * spawnedCount, so the post-spawn total = spawnedCount + 1.
   */
  private buildStageSpawnFactory(
    stageRef: Stage,
  ): (occupiedSlots?: Set<string>) => TurnBattleParticipant {
    return (occupiedSlots?: Set<string>) => {
      const isFinalSpawn =
        (this.turnBattle?.wave?.spawnedCount ?? 0) + 1 >= effectiveTotalEnemyCount(stageRef)
      const template =
        this.deps.stageWaves.pickEnemyForTurnSpawn(stageRef, isFinalSpawn, { rng: () => this.combatRng.roll() }) ??
        this.lastStageEnemyTemplate

      if (!template) {
        throw new Error(`TurnBattle spawnEnemy: no template available for stage ${stageRef.id}`)
      }

      this.lastStageEnemyTemplate = template

      return toTurnBattleParticipant(
        this.placeSpawnedEnemy(
          enemyToCombatEntity(this.deps.enemySystem.spawn(template)),
          occupiedSlots,
        ),
        this.turnBattle?.enemies.length ?? 0,
        GENERIC_PHYSICAL_BASIC,
      )
    }
  }

  startBattle(player: CombatEntity, enemy: Enemy) {
    // 'test' for raw-entity/devtools starts; a nested call inside a stage
    // launch is part of the 'stage' cycle (isStageStarting).
    this.beginBattleCycle(
      this.isStageStarting ? BATTLE_CYCLE_POLICIES.stage : BATTLE_CYCLE_POLICIES.test,
      { playerEntity: player, initialEnemy: enemy },
    )
  }

  startBattleWithPlayer(player: PlayerData, enemy: Enemy) {
    this.beginBattleCycle(
      this.isStageStarting ? BATTLE_CYCLE_POLICIES.stage : BATTLE_CYCLE_POLICIES.fresh,
      { player, initialEnemy: enemy },
    )
  }

  // --- Turn-battle construction (moved verbatim from GameManager) ----------

  /**
   * Bug fix (2026-09-06, user report) - mid-battle wave spawns must go
   * through resolveEnemySpawnPosition() exactly like the first enemy in
   * buildTurnBattle(); shared helper keeps both spawn closures aligned.
   */
  private placeSpawnedEnemy(entity: CombatEntity, occupiedSlots?: Set<string>): CombatEntity {
    const position = resolveEnemySpawnPosition(
      {
        isBoss: entity.isBoss ?? false,
        random: () => this.combatRng.roll(),
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

    // Mission C Task 9 — ALL path integration resolves through the
    // runtime boundary; no path/way predicate may appear below.
    const pathRuntime = playerPath ? this.resolvePathRuntime(playerPath) : undefined

    const playerParticipant = toTurnBattleParticipant(
      playerEntity,
      0,
      pathRuntime?.resolveBasic(playerPath!) ?? GENERIC_PHYSICAL_BASIC,
      pathRuntime?.resolveStatDomains(playerPath!),
      pathRuntime?.resolveSpecialUltimate(playerPath!),
    )

    // Dynamic-basic provider (Kiem Pho orbs / Ngu Kiem Dao multi-instance)
    // — OWNS the basic slot where a path supplies one; preset cursor/log
    // live in the provider closure, not PlayerData. Rolls consume the
    // session RNG — the captured object (not the mutable field) so the
    // provider stays bound to THIS cycle's stream exactly like the
    // retired closure hand-off did.
    const cycleRng = this.combatRng
    const dynamicBasic = pathRuntime?.buildDynamicBasic?.(
      playerPath!,
      this.deps.getProgressionNodes(),
      () => cycleRng.roll(),
    )
    if (dynamicBasic) {
      playerParticipant.dynamicBasic = dynamicBasic
    }

    // Emblem/marker slot overrides (Ngu Kiem Dao — spec §5.4: display
    // lanes, never resolvable actions).
    const emblemSlots = pathRuntime?.emblemSlots?.()
    if (emblemSlots?.special) {
      playerParticipant.special = { skill: emblemSlots.special, remainingCooldownTurns: 0 }
    }
    if (emblemSlots?.ultimate) {
      playerParticipant.ultimate = { skill: emblemSlots.ultimate, remainingCooldownTurns: 0 }
    }

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

      // Resolved per-instance kit (companion-gacha Task 8): unlockThresholds
      // gate special/ultimate, constellation skill_override perks applied.
      const kit = resolveCompanionSkillKit(definition, instance)

      return [
        toTurnBattleParticipant(entity, index + 100, kit.basic, undefined, {
          special: kit.special,
          ultimate: kit.ultimate,
        }),
      ]
    })

    // Tran Phap buff - the active formation applies ONE shared buff to the
    // whole party at battle start. Unknown buff definition ids are caught and
    // skipped (graceful, review Task 19) instead of crashing the battle.
    if (playerPath?.formationLoadout) {
      const formationDefinition = TRAN_PHAP_FORMATIONS.find(
        (candidate) => candidate.id === playerPath.formationLoadout!.formationId,
      )

      if (formationDefinition) {
        let buffDefinition: BuffDefinition | undefined

        try {
          buffDefinition = BUFF_REGISTRY.get(formationDefinition.buff.definitionId)
        } catch {
          buffDefinition = undefined
        }

        if (buffDefinition) {
          for (const participant of [playerParticipant, ...companionParticipants]) {
            new BuffSystem(participant.buffs).apply(
              buffDefinition,
              participant.entity,
              participant.entity,
              BUFF_REGISTRY,
            )
          }
        }
      }
    }

    // The Tu Reimagined (plan Task 6) — emblem/build-time buff channel:
    // any participant slot def carrying grantsBuffsAtBuild applies those
    // participant-local def clones to its owner (phan_chinh emblem ->
    // permanent Reflection buff). Self-applied, no registry lookup —
    // the defs are already node-adjusted clones from buildTheTuKit.
    for (const participant of [playerParticipant, ...companionParticipants]) {
      const buildBuffs = [
        ...(participant.basic?.grantsBuffsAtBuild ?? []),
        ...(participant.special?.skill.grantsBuffsAtBuild ?? []),
        ...(participant.ultimate?.skill.grantsBuffsAtBuild ?? []),
      ]

      for (const definition of buildBuffs) {
        new BuffSystem(participant.buffs).apply(
          definition,
          participant.entity,
          participant.entity,
          BUFF_REGISTRY,
        )
      }
    }

    // Spawn placement (Combat Art Pipeline sections 6/7) - standing positions, no
    // movement. Bosses always center; regular enemies random within region.
    const enemyParticipants = enemyEntities.map((enemyEntity, index) => {
      const position = resolveEnemySpawnPosition({
        isBoss: enemyEntity.isBoss ?? false,
        random: () => this.combatRng.roll(),
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
      roundsElapsed: 0,
      actedThisRound: [],
    }
  }

  /**
   * Auto-repeat cycle - fresh-battle contract (spec C1 / Mission C): the
   * repeat delegates to beginBattleCycle like every other entry path; the
   * repeat policy preserves ONLY the stage aggregate (binding, repeat arm,
   * run timer, loot session) while every battle-scoped field rebuilds.
   */
  private restartTurnBattleCycle() {
    const stage = this.activeStageForTurnBattle
    const player = this.playerDataForTurnBattle

    if (!this.turnBattle || !stage || !player) {
      return
    }

    this.beginBattleCycle(BATTLE_CYCLE_POLICIES.repeat, { player, stage })
  }

  // --- Stage / HUD progress ------------------------------------------------

  startStage(
    player: PlayerData,
    stage: Stage,
    repeatContinuously = false,
  ): boolean {
    this.isStageStarting = true
    this.pendingLaunchStage = stage
    // Pre-mint the cycle RNG: stageWaves.start picks the launch enemy
    // BEFORE the nested beginBattleCycle runs, so the mint must happen
    // here or the launch pick escapes the session boundary.
    this.mintCycleRng()
    let started = false
    try {
      started = this.deps.stageWaves.start(player, stage, repeatContinuously, {
        rng: () => this.combatRng.roll(),
      })
    } finally {
      this.isStageStarting = false
      this.pendingLaunchStage = null
    }

    if (!started) {
      return false
    }

    // The launch chain (stageWaves.start -> launchBattle ->
    // startBattleWithPlayer -> beginBattleCycle) already ran the full
    // canonical cycle with the 'stage' policy - wave config, stage spawn
    // factory, fresh engine, clock. This post-block contributes ONLY the
    // stage-aggregate extras (Mission C: the innermost call owns the
    // cycle; never re-invoke the canonical sequence here).
    const activeSession = this.presentationOps.session.getCurrentSession()
    if (activeSession) {
      this.presentationOps.session.end(activeSession)
    }

    this.turnBattleRepeatContinuously = repeatContinuously
    this.activeStageForTurnBattle = stage
    this.playerDataForTurnBattle = player
    this.turnBattleStartedAtMs = Date.now()

    const session: SessionRef = {
      kind: 'combat',
      sessionId: this.presentationOps.session.allocate(),
    }
    this.presentationOps.session.begin(session, this.presentationOps.getPresentationMode())
    if (this.presentationOps.getPresentationMode() === 'interactive') {
      this.presentationOps.session.hold(session)
    }
    this.deps.eventBus.emit('presentation_session_started', session)

    // The cycle's clock start ran inside beginBattleCycle before this
    // session existed - a held interactive session must freeze it now
    // or combat ticks while the battle is not revealed.
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

    const session = this.presentationOps.session.getCurrentSession()
    if (session) {
      this.presentationOps.session.end(session)
    }

    this.presentationOps.runtime.resetPendingState()

    if (this.turnBattle) {
      this.turnBattle.state = 'defeat'
    }
    this.deps.stageWaves.stopRepeat()

    // M2 — Pha Giap carry: retreat also banks (plan Slice 6 — battle end
    // regardless of outcome).
    if (this.playerDataForTurnBattle) {
      this.deps.bankPassiveCarry(this.playerDataForTurnBattle)
    }

    // ARCH-014 (M12) — ONE terminal publisher: rewardOps owns every
    // 'battle_end' emission (victory, natural defeat, abandon). The shared
    // once-guard both publishes and stamps the flag, so a duplicate
    // terminal can never slip through if the clock were ever restarted.
    this.rewardOps.emitAbandonEnd()

    // Audit fix 2026-08-31 - surviving enemies + pending spawns are dropped
    // without a victory flow; clear here exactly where the battle is
    // destroyed (StageWave auto-repeat spawns the next battle right after
    // victory, so victory itself must not clear).
    this.deps.enemyManager.clear()

    // The battle is destroyed: drop any turn that was in flight,
    // including its parked fallback timers, and anything queued against
    // this battle (spec section 9.2). Same teardown block beginBattleCycle
    // runs on entry - the pending-clear cannot drift.
    this.clearCycleEntryState()
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
      this.autoFarmOps.tickAutoFarm(activePlayer)
    }
  }

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
    const stranded = enabled ? null : this.presentationOps.runtime.getAwaitedManualActor()

    // Turning manual off mid-wait must not strand the token in AWAITING_INPUT
    // - that would freeze the clock for the rest of the battle waiting for a
    // choice the UI no longer offers. The claimed turn becomes an auto turn.
    if (stranded && this.turnToken.getState() === 'AWAITING_INPUT') {
      this.turnToken.submitChoice()
      this.beginTurnPipeline(stranded, 'ready')
    }

    this.enqueueAtTurnBoundary(() => {
      this.presentationOps.runtime.setBattleManualMode(enabled)
    })
  }

  /**
   * Derived from the token, which is the sole authority on whether combat is
   * inside a turn (spec section 2). The runtime still remembers WHICH actor is
   * waiting - that is identity, not a second copy of this fact.
   */
  isAwaitingManualTurnChoice(): boolean {
    return this.turnToken.getState() === 'AWAITING_INPUT'
  }

  /**
   * submitTurnChoice is NOT an external command: it is consumed by the
   * AWAITING_INPUT state and never queued past it (spec section 9.2). The
   * runtime declares the chosen action; from there the turn runs the same
   * pipeline an auto turn does, starting at the impact step because the ready
   * and cast phases have just happened.
   */
  submitTurnChoice(choice: ForcedTurnChoice): boolean {
    const actor = this.presentationOps.runtime.getAwaitedManualActor()
    const accepted = this.presentationOps.runtime.submitTurnChoice(choice)

    if (!accepted || !actor) {
      return accepted
    }

    if (this.turnToken.getState() === 'AWAITING_INPUT') {
      this.turnToken.submitChoice()
    }

    this.beginTurnPipeline(actor, 'impact')

    return true
  }

}
