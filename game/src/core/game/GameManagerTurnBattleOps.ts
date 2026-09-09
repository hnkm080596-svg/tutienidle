import {
  PresentationSession,
  type PresentationHold,
  type PresentationMode,
  type SessionPresentationPort,
  type SessionRef,
} from '../presentation/PresentationSession'
import type { Battle } from '../battle/Battle'
import { initKiemTuBattleResources } from '../battle/KiemTuResourceSystem'
import { resolveEnemySpawnPosition } from '../battle/EnemySpawnPlacement'
import { TurnBattleSystem, type TurnBattle } from '../battle/turn/TurnBattleSystem'
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

const BATTLE_FIXED_STEP_SECONDS = 0.1

// Cap on total catch-up time per update() call - avoids thousands of
// synchronous steps after long suspend/tab-throttle. Overflow is dropped for
// the combat/stage branch only; other systems receive the full real delta.
const BATTLE_MAX_CATCHUP_SECONDS = 30

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
    })
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

    return true
  }

  // --- Fixed-step driving loop ----------------------------------------------

  /**
   * The single battle driver (combat reference spec section 1): splits deltaSeconds
   * into fixed 0.1s pacing steps for the timer-countdown-reset-dependent
   * branch; capped at BATTLE_MAX_CATCHUP_SECONDS. Tribulation is NOT stepped
   * here (it owns its own closed-form catch-up - float-error note kept in
   * GameManager.update()).
   */
  updateBattleFixedStep(deltaSeconds: number) {
    let remaining = Math.min(deltaSeconds, BATTLE_MAX_CATCHUP_SECONDS)

    while (remaining > 0) {
      const step = Math.min(BATTLE_FIXED_STEP_SECONDS, remaining)

      remaining -= step

      // Unified flow: intro -> countdown -> fighting (gauge/wave/result).
      // Each 0.1s fixed step = 1 pacing tick; turn resolution instant.
      if (this.turnBattle) {
        if (this.presentationSession.isBlocking()) {
          // Held by the presentation coordinator: drop presentation-wait time
          // instead of accumulating catch-up. Single readiness authority.
        } else if (this.turnBattle.state === 'intro') {
          // Intro/transition: only decrement introTurnsRemaining and flip to
          // 'countdown' at 0 - NO combat logic in this phase.
          this.turnBattleSystem.tickIntro(this.turnBattle)

          // Snapshot emit so the overlay/scene observes the battle entering
          // intro (wired callee, silent caller is the P13 bug class).
          emitTurnBattleEntitySnapshot(this.deps.eventBus, this.turnBattle)
        } else if (this.turnBattle.state === 'countdown') {
          this.turnBattleSystem.tickCountdown(this.turnBattle)

          // Snapshot must ALSO run during countdown: CombatScene needs
          // countdownProgress each tick for the party telegraph 3-2-1.
          emitTurnBattleEntitySnapshot(this.deps.eventBus, this.turnBattle)
        } else if (this.turnBattle.state === 'fighting') {
          // Manual mode: peek actor - if it is a player actor AND manual mode
          // is on, PAUSE instead of resolving (enemy turns + auto mode resolve
          // normally). Waiting-for-ack holds the whole step.
          if (this.combatAnimationRuntime.isAwaitingManualTurnChoice()) {
            // Paused - still waiting for submitTurnChoice.
          } else if (
            this.combatAnimationRuntime.isPresentationActive() &&
            this.combatAnimationRuntime.isActionPlaybackWaiting()
          ) {
            // Action Playback Task 6 - waiting for a Phaser acknowledgement.
          } else {
            const readyActor = this.turnBattleSystem.tickPacing(
              this.turnBattle,
              !this.combatAnimationRuntime.isPresentationActive(),
            )

            if (readyActor !== null && this.combatAnimationRuntime.isPresentationActive()) {
              // Remediation Task 1 - fresh token per ready phase; stale
              // callbacks holding older tokens become no-ops.
              this.combatAnimationRuntime.notifyReadyActor(readyActor)
            } else if (
              readyActor !== null &&
              this.turnBattle.players.includes(readyActor) &&
              this.combatAnimationRuntime.isBattleManualMode() &&
              !this.combatAnimationRuntime.isAwaitingManualTurnChoice()
            ) {
              this.combatAnimationRuntime.pauseForManualActor(readyActor)
            }
          }

          // Combat Art Pipeline - emit the LIVE entity snapshot every fixed
          // step during 'fighting' regardless of which sub-branch ran (this
          // replaced the dead legacy 'positions' bridge).
          emitTurnBattleEntitySnapshot(this.deps.eventBus, this.turnBattle)
        }
      }

      // Auto-farm Task 4 - wall-clock reward roll (before the normal reward
      // flow; auto-farm has no turnBattle so the two paths never interact).
      const activePlayer = this.deps.getActivePlayer()

      if (activePlayer) {
        this.tickAutoFarm(activePlayer)
      }

      this.grantBattleRewardIfNeeded()
    }

    // Auto-repeat: victory + repeat on -> restart within the SAME call so
    // getBattle()?.state returns to fighting immediately after rewards
    // (matches the survival-mode semantics).
    if (
      this.turnBattle &&
      this.turnBattle.state === 'victory' &&
      this.turnBattleRepeatContinuously &&
      this.activeStageForTurnBattle !== null &&
      this.deps.stageManager.get() !== null
    ) {
      this.restartTurnBattleCycle()
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

  setBattleManualMode(enabled: boolean): void {
    this.combatAnimationRuntime.setBattleManualMode(enabled)
  }

  isBattleManualMode(): boolean {
    return this.combatAnimationRuntime.isBattleManualMode()
  }

  isAwaitingManualTurnChoice(): boolean {
    return this.combatAnimationRuntime.isAwaitingManualTurnChoice()
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

  getPresentationPort(): SessionPresentationPort {
    return this.presentationSession
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

  submitTurnChoice(role: TurnSkillSlotRole): boolean {
    return this.combatAnimationRuntime.submitTurnChoice(role)
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

    this.deps.battleLoot.processDefeatedEnemies(shimBattle)
  }
}
