import type { Battle } from '../battle/Battle'
import type { TurnBattle } from '../battle/turn/TurnBattleSystem'
import type { EventBus } from '../events/EventBus'
import type { PlayerData } from '../player/Player'
import type { Stage } from '../stage/Stage'
import type { BattleLootSystem } from './BattleLootSystem'
import type { StageWaveSystem } from './StageWaveSystem'

/**
 * Per-kill reward grant + victory/defeat terminal for the live turn battle.
 * Extracted from GameManagerTurnBattleOps (Wave-2 large-file split); moved
 * verbatim.
 *
 * Owns the two reward-flow flags exclusively:
 * - rewardsGranted: enemy ids already paid this cycle;
 * - battleEndEmitted: the victory/defeat terminal ran once this cycle.
 * The battle owner calls resetRewardState() wherever a fresh cycle starts
 * (startStage refight, auto-repeat restart).
 *
 * Public access: `gameManager.turnBattleOps.rewardOps.*`.
 */
export class GameManagerBattleRewardOps {
  private rewardsGranted = new Set<string>()
  private battleEndEmitted = false

  constructor(
    private readonly deps: {
      // Live reads into the battle owner's state - reassigned per battle.
      getTurnBattle: () => TurnBattle | null
      getActiveStage: () => Stage | null
      getPlayerData: () => PlayerData | null
      getStartedAtMs: () => number | null
      getRepeatContinuously: () => boolean
      battleLoot: BattleLootSystem
      stageWaves: StageWaveSystem
      eventBus: EventBus
      bankPassiveCarry: (player: PlayerData) => void
    },
  ) {}

  /** Fresh-cycle reset - called by the battle owner on stage start/restart. */
  resetRewardState(): void {
    this.rewardsGranted.clear()
    this.battleEndEmitted = false
  }

  grantBattleRewardIfNeeded() {
    // Rewards are read from TurnBattle (the only engine).
    if (this.deps.getTurnBattle()) {
      this.grantTurnBattleRewards()
    }
  }

  private grantTurnBattleRewards() {
    const turnBattle = this.deps.getTurnBattle()

    if (!turnBattle) {
      return
    }

    const killedIds = turnBattle.enemies
      .filter(
        (enemy) => !enemy.entity.alive && !this.rewardsGranted.has(enemy.entity.id),
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
      rewardGranted: this.rewardsGranted.has(enemy.entity.id),
    }))

    const shimBattle = {
      player: turnBattle.players[0]?.entity,
      enemies: shimEnemies,
    } as unknown as Battle

    this.deps.battleLoot.processDefeatedEnemies(shimBattle)

    for (const enemyId of killedIds) {
      this.rewardsGranted.add(enemyId)
    }

    // Victory/defeat terminal: emit battle_end EXACTLY ONCE per cycle and
    // release StageManager.active (otherwise the next startStage/Rematch
    // fails forever in-session - smoke-test regression 2026-09-04). Auto-repeat
    // does NOT stop - restartTurnBattleCycle reuses the active stage.
    if (
      (turnBattle.state === 'victory' || turnBattle.state === 'defeat') &&
      !this.battleEndEmitted
    ) {
      this.battleEndEmitted = true

      // M2 - Pha Giap carry: bank a fraction of the passive's stacks for
      // the next battle, whatever the outcome (plan Slice 6: "bank at
      // battle end regardless of outcome"). Exactly-once is guaranteed by
      // battleEndEmitted above; the write is an overwrite so a later
      // re-entry cannot double-count.
      const playerData = this.deps.getPlayerData()
      if (playerData) {
        this.deps.bankPassiveCarry(playerData)
      }

      if (!this.deps.getRepeatContinuously()) {
        this.deps.stageWaves.stopRepeat()
      }

      if (turnBattle.state === 'victory') {
        this.deps.eventBus.emit('battle_end', { type: 'battle_end', state: 'victory' })

        this.recordPerfectClearIfEligible(turnBattle)

        // Stage completion: push completedStageIds exactly once per stage
        // (auto-repeat still pushes - the player did complete the stage).
        const stage = this.deps.getActiveStage()

        if (
          playerData &&
          stage &&
          !playerData.completedStageIds.includes(stage.id)
        ) {
          playerData.completedStageIds.push(stage.id)
        }
      }
    }
  }

  /**
   * Perfect clear (spec v3 D1): every party member must still be alive at
   * the victory tick AND the battle must end within the stage's fixed
   * perfectClearTurnLimit - counted in ROUNDS (roundsElapsed), not actor
   * actions, so wave size does not inflate the count. HP-loss is not
   * consulted. Only the ACTIVE mode can ever evaluate this (idle runs no
   * battle). Records perfectClearStageIds + perfectClearSeconds ONCE -
   * the first achievement is never overwritten (B4).
   */
  private recordPerfectClearIfEligible(turnBattle: TurnBattle) {
    const stage = this.deps.getActiveStage()
    const player = this.deps.getPlayerData()

    if (!stage || !player || stage.perfectClearTurnLimit === undefined) {
      return
    }

    if (player.perfectClearStageIds.includes(stage.id)) {
      return
    }

    const everyoneAlive =
      turnBattle.players.length > 0 && turnBattle.players.every((member) => member.entity.alive)

    const isPerfectClear =
      everyoneAlive && (turnBattle.roundsElapsed ?? 0) < stage.perfectClearTurnLimit

    if (!isPerfectClear) {
      return
    }

    const startedAtMs = this.deps.getStartedAtMs() ?? Date.now()
    const clearSeconds = Math.max(0, (Date.now() - startedAtMs) / 1000)

    player.perfectClearStageIds.push(stage.id)
    player.perfectClearSeconds[stage.id] = clearSeconds
  }
}
