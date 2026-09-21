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
import { SeededCombatRng } from '../../battle/runtime/rng/SeededCombatRng'
import { GameManager } from '../../game/GameManager'
import { createDefaultPlayer, type PlayerData } from '../../player/Player'
import { canBreakthrough, breakthrough } from '../../cultivation/CultivationSystem'
import { cultivateTick } from '../../cultivation/CultivationTick'
import { driveTurnBattleToTerminal } from '../BattleDriver'
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
  readonly player: PlayerData
  readonly nowMs: number
  readonly seedValue: number

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

  /** Advance cultivation through the shared production tick (fixed clock). */
  cultivate(seconds: number): number {
    return cultivateTick(this.player, seconds, this.nowMs)
  }

  breakthroughIfReady(): boolean {
    if (!canBreakthrough(this.player)) return false
    return breakthrough(this.player)
  }

  /** Real stage entry + clock-driven battle; rewards settle on the
   * combat clock (completedStageIds, loot) before this returns. */
  runStage(stageId: string): StageRunResult {
    const stage = this.gameManager.catalogOps.getStage(stageId)
    if (!stage) return 'missing'
    if (!this.gameManager.catalogOps.isStageUnlocked(stageId, this.player)) {
      return 'locked'
    }
    if (!this.gameManager.turnBattleOps.startStage(this.player, stage)) {
      return 'refused'
    }
    // Shared deterministic driver (P6-M1) - the same stepping loop as
    // the disposable benchmark battles; this host counts clock advances.
    let advances = 0
    return driveTurnBattleToTerminal({
      gameManager: this.gameManager,
      clock: this.clock,
      maxConsumedSteps: MAX_DRIVE_STEPS,
      countSteps: () => advances,
      advanceChunkSeconds: COMBAT_STEP_SECONDS,
      onMissingBattle: () => 'defeat',
      onAdvance: () => {
        advances++
      },
    })
  }

  /** Real Quan Khi drive: tickOps.update + scripted correct answers. */
  runTribulation(targetRealmId: string): TribulationRunResult {
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
    return this.gameManager.progressionOps.allocateAttributePoint(this.player, stat)
  }

  /** Invest held Tinh Hoa Pham The into body refinement - the
   * material -> tier -> stats growth link, through the real op. */
  investRefinement(): number {
    return this.gameManager.realmAdvanceOps.investBodyChapter(this.player, 'body_refinement')
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
