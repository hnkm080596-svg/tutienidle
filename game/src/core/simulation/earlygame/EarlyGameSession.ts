// P6-M1 - persistent early-game session: ONE GameManager, ONE player,
// driven through production seams from character creation to qi_refining.
// Same tooling rule as BattleSimulation: headless orchestrator, reads
// public surfaces only, nothing on the gameplay path may import it.
//
// Determinism (M0 census, docs/architecture/2026-09-23-early-progression-
// inventory.md): combat rolls ride SeededCombatRng via the battle-RNG
// factory; the session clock is fixed (cultivateTick timed-effect reads,
// building timestamps); loot/economy Math.random stays unseeded BY
// DESIGN (a seeded battle must not pin drops) - fingerprints therefore
// normalize material drops and volatile ids/timestamps out.
import { ManualClockSource, COMBAT_STEP_SECONDS } from '../../battle/turn/CombatClock'
import {
  restoreGameSession,
  type GameSessionPlayerOwner,
  type RestoreGameSessionResult,
} from '../../../services/save/SaveSystem'
import type { GameSave } from '../../../services/save/saveTypes'
import { SeededCombatRng } from '../../battle/runtime/rng/SeededCombatRng'
import { GameManager } from '../../game/GameManager'
import { createDefaultPlayer, type PlayerData } from '../../player/Player'
import { canBreakthrough, breakthrough } from '../../cultivation/CultivationSystem'
import { cultivateTick } from '../../cultivation/CultivationTick'
import { driveTurnBattleToTerminal } from '../BattleDriver'
import { getBodyRefinementCompletedTiers } from '../../realm/body/BodyProgressionSystem'
import {
  BODY_REFINEMENT_TIERS,
  TINH_HOA_PHAM_THE_MATERIAL_ID,
} from '../../../data/realm/BodyRefinement'
import type { CultivationPathId, CultivationWayId } from '../../player/CultivationPathKit'
import {
  applyCreationProfile,
  bootstrapEarlyGamePlayer,
  type EarlyGameCreationProfile,
} from '../../game/EarlyGameBootstrap'
import { SKILLS } from '../../../data/skill/Skills'
import { TECHNIQUES } from '../../../data/technique/Techniques'
import { PHAP_TU_NODES } from '../../../data/progression/PhapTuNodes'
import { PHAP_TU_AN_NODES } from '../../../data/progression/PhapTuAnNodes'
import { KIEM_TU_NODES } from '../../../data/progression/KiemTuNodes'
import { THE_TU_NODES } from '../../../data/progression/TheTuNodes'
import { THE_TU_AN_NODES } from '../../../data/progression/TheTuAnNodes'
import { ENEMIES } from '../../../data/enemy/Enemies'
import { STAGES } from '../../../data/stage/Stages'
import { materials } from '../../../data/materials/materials'
import { zones } from '../../../data/stage/Zones'
import { equipment } from '../../../data/equipment/equipment'
import { affixes } from '../../../data/equipment/affixes'
import { pills } from '../../../data/pill/pills'
import { buffs } from '../../../data/buff/buffs'
import { talismans } from '../../../data/talisman/talismans'
import { formations } from '../../../data/formation/formations'
import { alchemyRecipes } from '../../../data/alchemy/alchemyRecipes'
import { buildings } from '../../../data/building/buildings'
import { QUESTS } from '../../../data/quest/quests'

export interface EarlyGameSessionOptions {
  seed: number
  /** Already-valid creation profile (validated at the service/UI boundary). */
  profile: EarlyGameCreationProfile
  /** Fixed session clock for wall-clock reads (timed effects). */
  nowMs?: number
}

export type StageRunResult = 'victory' | 'defeat' | 'refused' | 'locked' | 'missing' | 'timeout'
export type TribulationRunResult = 'victory' | 'defeat' | 'refused'

/** M-D: cumulative measurement counters maintained at session authority.
 * Canonical loop steps call runStage/cultivate/allocateAttribute/
 * investRefinement/breakthroughIfReady INTERNALLY - per-run or
 * final-bag reads cannot reconstruct these totals (essence is consumed
 * by internal invests, allocations happen inside growth steps). */
export interface SimRunTotals {
  stageRuns: number
  victories: number
  defeats: number
  enemiesDefeated: number
  battleSeconds: number
  idleCultivationSeconds: number
  tinhHoaGained: number
  attributePointsEarned: number
  attributePointsSpent: number
  uncountedStageRuns: number
  bodyCompletedAtSeconds: number | null
}

/** M-D: per-run record populated at runStage terminal. `counted:false`
 * means kills aren't trustworthy — either the terminal battle wasn't
 * readable (missing-battle defeat) or the result was non-terminal
 * ('timeout': dead entries in a live battle never settled loot, so they
 * must not count). Flagged so a measurement can't treat 0 as a real
 * count. */
export interface StageRunStats {
  result: StageRunResult
  enemiesDefeated: number
  counted: boolean
}

/** Normalized regression surface - volatile fields (entity ids, battle
 * durations, timestamps, material drops) are excluded per M0 census. */
export interface EarlyGameSnapshot {
  realmId: string
  realmLevel: number
  cultivation: number
  cultivationPerSecond: number
  totalCultivationGained: number
  skillInsight: number
  totalSkillInsightGained: number
  cultivationInsightAccumulator: number
  attributePoints: number
  cultivationPath: string | null
  cultivationWay: string | null
  completedStageIds: string[]
  nodeLevels: Record<string, number>
  tribulationState: string | null
}

const MAX_DRIVE_STEPS = 4000
const MAX_TRIBULATION_TICKS = 2000

export class EarlyGameSession {
  readonly gameManager: GameManager
  readonly clock: ManualClockSource
  // M-C: NOT readonly - restoreCheckpoint() swaps it for the restored
  // player object (restore semantics = replacement, not merge).
  player: PlayerData
  readonly nowMs: number
  readonly seedValue: number

  // M-D sim-only seams (simulation infrastructure, never production
  // ops): production-parity flag + measurement counters. Parity OFF by
  // default keeps MortalChapterJourney/EarlyGameLoop behavior identical.
  combatCultivationParity = false
  readonly simRunTotals: SimRunTotals = {
    stageRuns: 0,
    victories: 0,
    defeats: 0,
    enemiesDefeated: 0,
    battleSeconds: 0,
    idleCultivationSeconds: 0,
    tinhHoaGained: 0,
    attributePointsEarned: 0,
    attributePointsSpent: 0,
    uncountedStageRuns: 0,
    bodyCompletedAtSeconds: null,
  }
  lastRunStats: StageRunStats | null = null
  /** True while a runStage drive is in flight - distinguishes parity
   * cultivation (inside battleSeconds) from idle cultivation. */
  private inStageDrive = false

  constructor(options: EarlyGameSessionOptions) {
    this.nowMs = options.nowMs ?? 1_700_000_000_000
    this.seedValue = options.seed
    this.gameManager = new GameManager()
    this.clock = new ManualClockSource()
    this.gameManager.turnBattleOps.setCombatClockSource(this.clock)
    this.gameManager.turnBattleOps.setBattleRngFactory(
      () => new SeededCombatRng(options.seed),
    )
    // Loot/economy drops ride a SEPARATE seeded stream (a seeded battle
    // must not pin drops) - session-scoped so replay is deterministic.
    const lootRng = new SeededCombatRng(options.seed ^ 0x9e3779b9)
    this.gameManager.setLootRng(() => lootRng.roll())
    // The production registration set (App.vue module scope) - the loop
    // must run the SAME catalogs the game does, or drops/buffs/equipment
    // silently no-op.
    const catalog = this.gameManager.catalogOps
    catalog.registerMaterials(materials)
    catalog.registerSkillTemplates(SKILLS)
    catalog.registerTechniqueTemplates(TECHNIQUES)
    catalog.registerEnemyTemplates(ENEMIES)
    catalog.registerStages(STAGES)
    catalog.registerZones(zones)
    catalog.registerEquipment(equipment)
    catalog.registerAffixes(affixes)
    catalog.registerPills(pills)
    catalog.registerBuffs(buffs)
    catalog.registerTalismans(talismans)
    catalog.registerFormations(formations)
    catalog.registerAlchemyRecipes(alchemyRecipes)
    catalog.registerBuildings(buildings)
    catalog.registerProgressionNodes(PHAP_TU_NODES)
    catalog.registerProgressionNodes(PHAP_TU_AN_NODES)
    catalog.registerProgressionNodes(KIEM_TU_NODES)
    catalog.registerProgressionNodes(THE_TU_NODES)
    catalog.registerProgressionNodes(THE_TU_AN_NODES)
    catalog.registerQuests(QUESTS)

    this.player = createDefaultPlayer()
    applyCreationProfile(this.player, options.profile)
    bootstrapEarlyGamePlayer(this.gameManager, this.player)
    this.gameManager.setActivePlayer(this.player)
  }

  /** Advance cultivation through the shared production tick (fixed clock).
   * M-D: counts as idle cultivation only when NOT inside a runStage
   * drive - parity advances are already inside battleSeconds. */
  cultivate(seconds: number): number {
    if (!this.inStageDrive) {
      this.simRunTotals.idleCultivationSeconds += seconds
    }
    return cultivateTick(this.player, seconds, this.nowMs)
  }

  breakthroughIfReady(): boolean {
    const before = this.player.attributePoints
    if (!canBreakthrough(this.player)) return false
    const ok = breakthrough(this.player)
    if (ok) {
      this.simRunTotals.attributePointsEarned += this.player.attributePoints - before
    }
    return ok
  }

  /** M-D measurement read - material bag amount via the typed API. */
  materialAmount(id: string): number {
    return this.gameManager.materialBag.getAmount(id)
  }

  /** Real stage entry + clock-driven battle; rewards settle on the
   * combat clock (completedStageIds, loot) before this returns.
   * M-D parity lifecycle (spec §3.1, pinned ordering):
   *   pre-stage drain -> essenceBefore -> startStage/battle ->
   *   rewards settle -> essenceAfter/tinhHoaGained -> terminal counters
   *   -> post-terminal drain. */
  runStage(stageId: string): StageRunResult {
    const stage = this.gameManager.catalogOps.getStage(stageId)
    if (!stage) return 'missing'
    if (!this.gameManager.catalogOps.isStageUnlocked(stageId, this.player)) {
      return 'locked'
    }
    if (this.combatCultivationParity) {
      this.drainRefinement()
    }
    const essenceBefore = this.materialAmount(TINH_HOA_PHAM_THE_MATERIAL_ID)
    if (!this.gameManager.turnBattleOps.startStage(this.player, stage)) {
      return 'refused'
    }
    // Shared deterministic driver (P6-M1) - the same stepping loop as
    // the disposable benchmark battles; this host counts clock advances.
    // Parity: per consumed combat step, cultivate + auto-breakthrough -
    // the same work App.vue's frame loop does during battles.
    let advances = 0
    this.inStageDrive = true
    let result: StageRunResult
    try {
      result = driveTurnBattleToTerminal({
        gameManager: this.gameManager,
        clock: this.clock,
        maxConsumedSteps: MAX_DRIVE_STEPS,
        countSteps: () => advances,
        advanceChunkSeconds: COMBAT_STEP_SECONDS,
        onMissingBattle: () => 'defeat',
        onAdvance: () => {
          advances++
          if (this.combatCultivationParity) {
            this.cultivate(COMBAT_STEP_SECONDS)
            this.breakthroughIfReady()
          }
        },
      })
    } finally {
      this.inStageDrive = false
    }

    const essenceAfter = this.materialAmount(TINH_HOA_PHAM_THE_MATERIAL_ID)
    this.simRunTotals.tinhHoaGained += essenceAfter - essenceBefore

    const totals = this.simRunTotals
    totals.stageRuns++
    totals.battleSeconds += advances * COMBAT_STEP_SECONDS
    if (result === 'victory') totals.victories++
    if (result === 'defeat') totals.defeats++

    // Kill accounting over the LIVE turnBattle.enemies: rewardOps feeds
    // processDefeatedEnemies a mapped copy, so dead participants remain
    // in the live array with entity.alive === false. Pending telegraphs
    // are never in enemies. Only TERMINAL results count - a 'timeout'
    // leaves a live battle whose dead entries never settled loot.
    const battle = this.gameManager.getTurnBattle()
    const counted = battle != null && (result === 'victory' || result === 'defeat')
    const kills = counted
      ? battle.enemies.filter((enemy) => !enemy.entity.alive).length
      : 0
    totals.enemiesDefeated += kills
    if (!counted) totals.uncountedStageRuns++
    this.lastRunStats = { result, enemiesDefeated: kills, counted }

    if (this.combatCultivationParity) {
      this.drainRefinement()
    }
    return result
  }

  /** Real Quan Khi drive: tickOps.update + scripted correct answers.
   * M-C: canTriggerBreakthrough precheck first - the production entry
   * (triggerBreakthroughAction) refuses below realmLevel 12 BEFORE
   * reaching startTribulation; the session mirrors that contract so a
   * journey can't drive a tribulation the game would never admit. */
  runTribulation(targetRealmId: string): TribulationRunResult {
    if (!this.gameManager.realmAdvanceOps.canTriggerBreakthrough(this.player)) {
      return 'refused'
    }
    if (!this.gameManager.startTribulation(this.player, targetRealmId)) {
      return 'refused'
    }
    let ticks = 0
    while (
      this.gameManager.tribulationDirector.getState()?.state === 'ongoing' &&
      ticks++ < MAX_TRIBULATION_TICKS
    ) {
      this.gameManager.tickOps.update(1)
      const q = this.gameManager.tribulationDirector.getState()?.currentQuestion
      if (q) this.gameManager.tribulationDirector.answerQuestion(q.correctAnswerIndex)
    }
    const committed = this.gameManager.tribulationDirector.getCommittedOutcome()
    if (committed) return committed.outcome
    return this.gameManager.tribulationDirector.getState()?.state === 'victory'
      ? 'victory'
      : 'defeat'
  }

  performRitual(path: CultivationPathId, way: CultivationWayId): boolean {
    return this.gameManager.realmAdvanceOps.chooseCultivationPath(path, way, this.player)
  }

  purchaseNode(nodeId: string): boolean {
    return this.gameManager.progressionOps.purchaseNode(nodeId, this.player)
  }

  allocateAttribute(stat: Parameters<GameManager['progressionOps']['allocateAttributePoint']>[1]): boolean {
    const ok = this.gameManager.progressionOps.allocateAttributePoint(this.player, stat)
    if (ok) this.simRunTotals.attributePointsSpent++
    return ok
  }

  /** Invest held Tinh Hoa Pham The into body refinement - the
   * material -> tier -> stats growth link, through the real op.
   * M-D: the first call that completes all tiers records
   * bodyCompletedAtSeconds at the CURRENT T_wall instant - covers
   * parity drains AND explicit sim invests, so a tier completing in a
   * pre-stage drain isn't timestamped late by the battle that follows. */
  investRefinement(): number {
    const consumed = this.gameManager.realmAdvanceOps.investBodyChapter(
      this.player,
      'body_refinement',
    )
    const totals = this.simRunTotals
    if (
      totals.bodyCompletedAtSeconds == null &&
      getBodyRefinementCompletedTiers(this.player) >= BODY_REFINEMENT_TIERS.length
    ) {
      totals.bodyCompletedAtSeconds = totals.battleSeconds + totals.idleCultivationSeconds
    }
    return consumed
  }

  /** M-D: production auto-invest parity - GameManagerTickOps.update()
   * invests every world tick; a parity runStage drains before and after
   * each battle to the same end state (stage-boundary granularity). */
  private drainRefinement(): void {
    while (this.investRefinement() > 0) { /* consume until dry */ }
  }

  /** Equip every unequipped bag item into its slot (best-first by item
   * level). The gear loop is part of real progression - the canonical
   * loop must exercise it, not bypass with raw stat grants. */
  equipAll(): number {
    const bag = this.gameManager.equipmentBag.getAll()
    const sorted = [...bag].sort((a, b) => (b.realmLevel ?? 0) - (a.realmLevel ?? 0))
    let equipped = 0
    for (const item of sorted) {
      if (item.equipped) continue
      if (this.gameManager.equipmentOps.equipItem(item.instanceId, this.player).ok) {
        equipped++
      }
    }
    return equipped
  }

  /** M-C save/restore checkpoint leg: the REAL production restore path
   * (restoreGameSession, SaveSystem.ts) - the seam only wraps it and
   * re-points the session at the restored player $state; it does NOT
   * reimplement player restoration and does NOT own the player owner:
   * the caller supplies a fresh owner (the suite uses a real Pinia
   * store, keeping stores/* out of this simulation file). The previous
   * player reference is abandoned (restore = replacement, not merge);
   * continuing a journey on it would alias stale state. */
  restoreCheckpoint(
    save: GameSave,
    playerOwner: GameSessionPlayerOwner,
  ): RestoreGameSessionResult {
    const result = restoreGameSession(playerOwner, this.gameManager, save)
    if (result.status === 'ok') {
      this.player = playerOwner.$state
    }
    return result
  }

  snapshot(): EarlyGameSnapshot {
    const p = this.player
    return {
      realmId: p.realmId,
      realmLevel: p.realmLevel,
      cultivation: p.cultivation,
      cultivationPerSecond: p.cultivationPerSecond,
      totalCultivationGained: p.totalCultivationGained,
      skillInsight: p.skillInsight,
      totalSkillInsightGained: p.totalSkillInsightGained,
      cultivationInsightAccumulator: p.cultivationInsightAccumulator,
      attributePoints: p.attributePoints,
      cultivationPath: p.cultivationPath ?? null,
      cultivationWay: p.cultivationWay ?? null,
      completedStageIds: [...p.completedStageIds].sort(),
      nodeLevels: { ...p.nodeLevels },
      tribulationState:
        this.gameManager.tribulationDirector.getCommittedOutcome()?.outcome ??
        this.gameManager.tribulationDirector.getState()?.state ??
        null,
    }
  }
}
