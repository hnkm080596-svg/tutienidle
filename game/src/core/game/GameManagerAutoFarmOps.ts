import { enemyToCombatEntity } from '../enemy/Enemy'
import type { EnemySystem } from '../enemy/EnemySystem'
import { DEFAULT_MAX_OFFLINE_SECONDS } from '../idle/GameClock'
import type { PlayerData } from '../player/Player'
import type { RewardReceiver } from '../reward/RewardSystem'
import { effectiveTotalEnemyCount } from '../stage/EffectiveEnemyCount'
import type { Stage } from '../stage/Stage'
import type { StageManager } from '../stage/StageManager'
import type { TemplateRegistry } from './TemplateRegistry'
import type { BattleLootSystem, RewardPendingEnemy } from './BattleLootSystem'
import type { StageWaveSystem } from './StageWaveSystem'

/**
 * Shared cycleSeconds guard (F2): a persisted perfectClearSeconds entry is
 * usable only when it is a finite number > 0. A malformed 0/NaN/Infinity
 * value must no-op BOTH the online tick and the offline settle - 0 turns
 * completedCycles into Infinity (unbounded reward loop), NaN poisons
 * lastCheckedMs forever.
 */
function isValidCycleSeconds(cycleSeconds: number | undefined): cycleSeconds is number {
  return cycleSeconds !== undefined && cycleSeconds > 0 && Number.isFinite(cycleSeconds)
}

/**
 * Auto-farm wall-clock cycle loop (spec 2026-09-04-stage-auto-farm, Task 4).
 * Extracted from GameManagerTurnBattleOps (Wave-2 large-file split); moved
 * verbatim.
 *
 * Auto-farm shares the SAME single-slot StageManager with
 * manual/repeat/progress (exclusivity uniform) but runs no
 * TurnBattleSystem and no animation - rewards roll by wall-clock through
 * BattleLootSystem.processDefeatedEnemies.
 *
 * Public access: `gameManager.turnBattleOps.autoFarmOps.*`.
 */
export class GameManagerAutoFarmOps {
  constructor(
    private readonly deps: {
      stageManager: StageManager
      stageTemplates: TemplateRegistry<Stage>
      battleLoot: BattleLootSystem
      stageWaves: StageWaveSystem
      enemySystem: EnemySystem
      buildPlayerRewardReceiver: (player: PlayerData) => RewardReceiver
    },
  ) {}

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
    const autoFarm = player.autoFarmStage

    if (autoFarm === null) {
      return
    }

    player.autoFarmStage = null

    // Release only the lease THIS farm holds — if the slot were ever
    // occupied by a different stage (a diverged-state bug), stopping the
    // farm must not kill an unrelated battle's lease.
    if (this.deps.stageManager.get()?.stageId === autoFarm.stageId) {
      this.deps.stageManager.stop()
    }
  }

  /**
   * Restore-time reconcile: persisted autoFarmStage is a durable lease
   * that must re-acquire the single StageManager slot on boot. startAutoFarm
   * is NOT the right entry — it resets lastCheckedMs to Date.now(), wiping
   * the offline remainder the settle just re-anchored. An unresolvable
   * stage (removed content / corrupt id) drops the dead lease rather than
   * leaving a farm armed-but-inert with a free slot.
   */
  reconcileAutoFarmRuntime(player: PlayerData): void {
    const autoFarm = player.autoFarmStage

    if (!autoFarm) {
      return
    }

    // Idempotent: a second restore of a same-farm payload sees the slot
    // already held by THIS farm stage — that IS the desired end state,
    // not a conflict (start() returns false for any occupied slot).
    if (this.deps.stageManager.get()?.stageId === autoFarm.stageId) {
      return
    }

    // Same precondition as startAutoFarm: a persisted lease for a stage
    // that was never perfect-cleared (crafted/foreign save) is a dead
    // lease — holding the slot would block manual stages while paying
    // nothing. Same for a missing/invalid cycle time: the tick can never
    // complete a cycle, so the farm would hold the slot inert forever.
    if (
      !player.perfectClearStageIds.includes(autoFarm.stageId) ||
      !isValidCycleSeconds(player.perfectClearSeconds[autoFarm.stageId])
    ) {
      player.autoFarmStage = null
      return
    }

    const stage = this.deps.stageTemplates.get(autoFarm.stageId)

    if (!stage || !this.deps.stageManager.start(stage)) {
      player.autoFarmStage = null
    }
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

    if (!isValidCycleSeconds(cycleSeconds)) {
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

    // T1-12 — anchor to now minus the UNSETTLED remainder, identical to
    // tickAutoFarm. A stale/corrupt persisted lastCheckedMs used to
    // survive this line untouched: the settle paid the whole capped
    // window, then the next online tickAutoFarm clamped (now - staleTs)
    // to the cap and paid the SAME window a second time (double-pay —
    // also triggered by any honest session longer than the 24h cap).
    autoFarm.lastCheckedMs = Date.now() - (elapsedMs - completedCycles * cycleMs)
  }

  /**
   * Tick auto-farm from the fixed-step loop: each completed cycle rolls its
   * reward through BattleLootSystem.processDefeatedEnemies (no
   * simulation). Partial cycle time carries over via lastCheckedMs.
   */
  tickAutoFarm(player: PlayerData) {
    const autoFarm = player.autoFarmStage

    if (!autoFarm) {
      return
    }

    // Fail-closed lease check (Mission B audit): persisted state and the
    // runtime slot must agree before rewards mint. A farm ticking without
    // its StageManager lease runs concurrent with a real battle that
    // shares the same BattleLootSystem session.
    if (this.deps.stageManager.get()?.stageId !== autoFarm.stageId) {
      return
    }

    const cycleSeconds = player.perfectClearSeconds[autoFarm.stageId]

    if (!isValidCycleSeconds(cycleSeconds)) {
      return
    }

    const now = Date.now()

    // A non-finite/negative persisted lastCheckedMs must recover, not
    // freeze the feature silently: NaN makes every later elapsedMs NaN.
    if (!Number.isFinite(autoFarm.lastCheckedMs) || autoFarm.lastCheckedMs < 0) {
      autoFarm.lastCheckedMs = now
    }

    const cycleMs = (cycleSeconds / 2) * 1000
    // A corrupt save can persist a small-positive lastCheckedMs — the
    // uncapped remainder (years of "elapsed" time) turned the reward loop
    // below into ~10^8 iterations per tick. Same bound as
    // settleAutoFarmOffline: one GameClock cap, no second constant.
    const elapsedMs = Math.min(now - autoFarm.lastCheckedMs, DEFAULT_MAX_OFFLINE_SECONDS * 1000)
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

    // Anchor to now minus the unsettled remainder: identical to
    // `+= completedCycles * cycleMs` when elapsed fit under the cap, but a
    // clamped (corrupt) timestamp forfeits the over-cap time instead of
    // re-paying a fresh 24h batch on every world tick.
    autoFarm.lastCheckedMs = now - (elapsedMs - completedCycles * cycleMs)
  }

  /**
   * Roll one auto-farm cycle: build pending-reward enemy entries from the
   * stage enemyPool and feed processDefeatedEnemies (bounty/talent/drops
   * identical to a real battle) - no TurnBattleSystem, no animation.
   */
  private rollAutoFarmCycleReward(player: PlayerData, stage: Stage) {
    this.deps.battleLoot.beginBattle()
    this.deps.battleLoot.setChannel('idle')
    this.deps.battleLoot.setSession(this.deps.buildPlayerRewardReceiver(player), player)

    // try/finally: a throw mid-cycle (e.g. createInstance on a missing
    // profession grade) must not leak 'idle' into the next real battle.
    try {
      const killedEntities: RewardPendingEnemy[] = []

      const rollTotalEnemyCount = effectiveTotalEnemyCount(stage)

      for (let i = 0; i < rollTotalEnemyCount; i++) {
        const isFinalSpawn = i === rollTotalEnemyCount - 1
        // Idle channel (spec v3 D5): never roll the tinh_anh tag - the
        // boss gate still applies unconditionally on floor 10.
        const template = this.deps.stageWaves.pickEnemyForTurnSpawn(stage, isFinalSpawn, { allowTags: false })

        if (!template) {
          continue
        }

        const entity = enemyToCombatEntity(this.deps.enemySystem.spawn(template))
        entity.alive = false

        killedEntities.push({ entity, rewardGranted: false })
      }

      // F3 honest contract: the idle channel has no live player entity in
      // combat, so the heal-on-kill target is an explicit null (opt-out) -
      // never a dead enemy standing in as `player`.
      this.deps.battleLoot.processDefeatedEnemies(killedEntities, null, stage)
    } finally {
      // Restore the default so a real battle started later in the same tick
      // is not silently farmed at idle rates.
      this.deps.battleLoot.setChannel('active')
    }
  }
}
