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
import { SKILL_CORE_NODES } from '../../../data/progression/SkillCoreNodes'
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
import {
  TribulationOutcomeService,
  type TribulationOutcomeResult,
  type TribulationPlayerWriter,
} from '../../tribulation/TribulationOutcomeService'
import { reconcileTalentEntitlement } from '../../talent/TalentEntitlement'
import type { TalentEntitlementDecision } from '../../talent/TalentEntitlement'
import type { BodyChapterId } from '../../realm/body/BodyChapter'
import type { CompanionGiftRecord } from '../../../data/companion/Companions'
import type { ClaimCompanionGiftResult } from '../../game/GameManagerCompanionOps'

export interface EarlyGameSessionOptions {
  seed: number
  /** Already-valid creation profile (validated at the service/UI boundary). */
  profile: EarlyGameCreationProfile
  /** Fixed session clock for wall-clock reads (timed effects). */
  nowMs?: number
  /** M-F-JOURNEY - when set, the session player IS owner.$state from
   * construction (the suite owns a real usePlayerStore; this file stays
   * stores-free). Required by the settle/drain/entitlement seams:
   * resolveVictory writes absent optional PlayerData keys, and those
   * only reflect through a store-instance write (TribulationPlayerWriter). */
  playerOwner?: GameSessionPlayerOwner & TribulationPlayerWriter
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
 * means kills aren't trustworthy - either the terminal battle wasn't
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
  // M-F-JOURNEY - TC-era persisted surface. Wall-clock content stays
  // normalized OUT (perfectClearSeconds, autoFarmStage.lastCheckedMs,
  // entitlement offer draws) per the M0 census - volatile fields break
  // same-seed replay.
  bodyProgression: {
    body_refinement: { completedTiers: number; currentTierProgress: number }
    meridian: { openedIds: string[] }
    zhou_tian: { circulation: number }
  }
  physiqueGrade: string
  highestFoundationAchieved: string | null
  pendingTalentEntitlement: { realmId: string } | null
  technique: {
    grade: number
    rank: number
    gradeHistory: Record<number, { finalRank: number; completionState: string }>
  } | null
  artifact: {
    artifactId: string
    realmId: string
    realmLevel: number
    experience: number
    grade: string
  } | null
  companionGifts: Array<{ id: string; definitionId: string; claimed: boolean }>
  perfectClearStageIds: string[]
  autoFarmStageId: string | null
  bodyPerfection: { discoveredMaterials: string[]; perfectedRealmIds: string[] }
  hiddenBeastKills: Record<string, number>
  hiddenChannelCycles: Array<{ siteId: string; cycles: Record<string, number> }>
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
  /** M-F-JOURNEY - the suite-supplied store owner (option). Held so the
   * writer seams route absent-key writes through the store instance -
   * the only shape that reflects them (TribulationPlayerWriter). */
  private playerOwner: (GameSessionPlayerOwner & TribulationPlayerWriter) | undefined

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
    catalog.registerProgressionNodes(SKILL_CORE_NODES)
    catalog.registerQuests(QUESTS)

    this.playerOwner = options.playerOwner
    this.player = options.playerOwner?.$state ?? createDefaultPlayer()
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
   * M-D parity lifecycle (spec sec.3.1, pinned ordering):
   *   pre-stage drain -> essenceBefore -> startStage/battle ->
   *   rewards settle -> essenceAfter/tinhHoaGained -> terminal counters
   *   -> post-terminal drain.
   * `options.onBattleAdvance` (M-F-JOURNEY Leg I): invoked per consumed
   * combat step - the caller may advance wall clock (vi.setSystemTime)
   * so wall-clock-measured records like perfectClearSeconds are
   * produced by their real writer with a consumable value. */
  runStage(
    stageId: string,
    options?: { onBattleAdvance?: (consumedSteps: number) => void },
  ): StageRunResult {
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
          options?.onBattleAdvance?.(advances)
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
   * (triggerBreakthroughAction) refuses an ineligible player BEFORE
   * reaching startTribulation (mortal: level 12; qi_refining per M-QI-02:
   * level 12 + chapter-final stage clear). The session mirrors that
   * contract so a journey can't drive a tribulation the game would
   * never admit. */
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

  /** M-F-JOURNEY - the settle HALF of the production outcome contract
   * (checkTribulationOutcomeAction's domain half; runTribulation never
   * settles): binds + applies the committed outcome ONCE via the
   * record's receipt slot. Repeated pre-resolution calls return the
   * same bound receipt without re-applying (receipt dedup). Contains NO
   * drain - production defers director.clear() until the entitlement
   * resolves; pair with drainTribulationOutcome(). Requires a
   * playerOwner-constructed session: resolveVictory's writer contract
   * needs the store shape for absent-key writes. */
  settleTribulationOutcome(): TribulationOutcomeResult | null {
    if (this.playerOwner === undefined || this.player !== this.playerOwner.$state) {
      throw new Error('settleTribulationOutcome requires construction with playerOwner')
    }
    return new TribulationOutcomeService().settleOutcome(
      this.playerOwner,
      this.gameManager,
      this.gameManager.tribulationDirector,
    )
  }

  /** M-F-JOURNEY - the post-settle drain half of
   * checkTribulationOutcomeAction (useTribulation.ts): reconcile prunes
   * a record holding no legal decision -> while pendingTalentEntitlement
   * stays unresolved the drain is DEFERRED (the committed outcome is
   * retained, director.clear() does NOT run) -> post-resolution the
   * drain clears the director exactly once. Returns whether the drain
   * executed. */
  drainTribulationOutcome(): boolean {
    const writer = this.writer()
    reconcileTalentEntitlement(writer)
    if (writer.pendingTalentEntitlement !== undefined) {
      return false
    }
    this.gameManager.tribulationDirector.clear()
    return true
  }

  /** M-F-JOURNEY - the entitlement modal's commit seam: the op grants
   * ONE result (a legal NEW offer or an UPGRADE) and clears the record.
   * An off-pool/illegal decision returns false and the record stays
   * pending - rejection is part of the contract (spec leg B phase-a). */
  resolveTalentEntitlement(decision: TalentEntitlementDecision): boolean {
    return this.gameManager.realmAdvanceOps.resolveTalentEntitlement(this.writer(), decision)
  }

  /** The settle/drain write target: the owner store while the session
   * player IS its $state (absent-key write semantics), else the live
   * PlayerData (a post-restore owner reassignment keeps parity). */
  private writer(): TribulationPlayerWriter | PlayerData {
    return this.playerOwner !== undefined && this.player === this.playerOwner.$state
      ? this.playerOwner
      : this.player
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

  /** M-F-JOURNEY - generalized chapter invest: the op reads the
   * chapter's currency + aux bags (material OR pill - thong_mach_dan
   * lives in pillBag) and debits ONLY what the chapter consumed. A
   * chapter-gate failure (locked chain link, pace gate, missing aux)
   * returns a real 0, not a seam veto - rejections are assertable. */
  investChapter(chapterId: BodyChapterId): number {
    const consumed = this.gameManager.realmAdvanceOps.investBodyChapter(
      this.player,
      chapterId,
    )
    const totals = this.simRunTotals
    if (
      chapterId === 'body_refinement' &&
      totals.bodyCompletedAtSeconds == null &&
      getBodyRefinementCompletedTiers(this.player) >= BODY_REFINEMENT_TIERS.length
    ) {
      totals.bodyCompletedAtSeconds = totals.battleSeconds + totals.idleCultivationSeconds
    }
    return consumed
  }

  /** Invest held Tinh Hoa Pham The into body refinement - shorthand
   * for investChapter('body_refinement') (the M-D callers' idiom). */
  investRefinement(): number {
    return this.investChapter('body_refinement')
  }

  /** M-F-JOURNEY - typed pill-bag read/write over the registered
   * catalog. holdPill is a FIXTURE seam (spec S4 seeded inputs -
   * day-paced economies like thong_mach_dan cannot be acquired
   * in-suite): it adds through the real bag API but does NOT ride the
   * notifyMaterialGained landing funnel - a seed is setup, not an
   * acquisition event. */
  pillAmount(id: string): number {
    return this.gameManager.pillBag.getAmount(id)
  }

  /** Returns the post-add held amount (the bags' own add() reports
   * overflow, which fixture callers never need). */
  holdPill(id: string, amount: number): number {
    this.gameManager.pillBag.add(this.gameManager.pillRegistry.get(id), amount)
    return this.pillAmount(id)
  }

  /** M-F-JOURNEY - same fixture seam for the material bag. Returns the
   * amount actually held (stackLimit clamps - callers chunk large
   * seeds through repeated hold+invest). */
  holdMaterial(id: string, amount: number): number {
    this.gameManager.materialBag.add(
      this.gameManager.materialRegistry.get(id),
      amount,
    )
    return this.materialAmount(id)
  }

  /** M-F-JOURNEY - gift-mail seams (SettlementGiftInbox): records read
   * off the persisted slice; claim rides the real op gate (domain
   * unlocked + record known + beta-claimable). */
  giftRecords(): readonly CompanionGiftRecord[] {
    return this.player.companionGifts
  }

  claimGift(id: string): ClaimCompanionGiftResult {
    return this.gameManager.companionOps.claimCompanionGift(id)
  }

  /** M-F-JOURNEY - perfect-clear reads: the record is authored by
   * recordPerfectClearIfEligible inside a real victory; cycleSeconds
   * stays raw (a volatile wall-clock value - asserted for validity,
   * not equality). */
  perfectClearOf(stageId: string): { recorded: boolean; cycleSeconds?: number } {
    return {
      recorded: this.player.perfectClearStageIds.includes(stageId),
      cycleSeconds: this.player.perfectClearSeconds[stageId],
    }
  }

  /** M-F-JOURNEY - the auto-farm start button's domain half: gates on
   * the recorded perfect clear + valid cycle seconds; sets the durable
   * autoFarmStage lease on success. */
  startAutoFarm(stageId: string): boolean {
    return this.gameManager.turnBattleOps.autoFarmOps.startAutoFarm(this.player, stageId)
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
      // A restored owner that is a full store also satisfies the writer
      // contract - keep writer seams (settle/drain/entitlement) usable
      // post-restore on store-backed sessions.
      this.playerOwner = this.isWriterOwner(playerOwner) ? playerOwner : undefined
    }
    return result
  }

  /** M-F-JOURNEY - structural check: a full store satisfies the writer
   * contract (PlayerData fields + setEquipmentModifiers); a minimal
   * GameSessionPlayerOwner does not. */
  private isWriterOwner(
    owner: GameSessionPlayerOwner,
  ): owner is GameSessionPlayerOwner & TribulationPlayerWriter {
    return 'realmId' in owner && 'baseStats' in owner && 'selectedTalentIds' in owner
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
      bodyProgression: {
        body_refinement: {
          completedTiers: p.bodyProgression.body_refinement.completedTiers,
          currentTierProgress: p.bodyProgression.body_refinement.currentTierProgress,
        },
        meridian: { openedIds: [...p.bodyProgression.meridian.openedIds] },
        zhou_tian: { circulation: p.bodyProgression.zhou_tian.circulation },
      },
      physiqueGrade: p.physiqueGrade,
      highestFoundationAchieved: p.highestFoundationAchieved ?? null,
      // Entitlement offers draw on Math.random by contract (volatility
      // normalized out); realmId alone is deterministic.
      pendingTalentEntitlement:
        p.pendingTalentEntitlement === undefined
          ? null
          : { realmId: p.pendingTalentEntitlement.realmId },
      technique: (() => {
        const active = this.gameManager.techniqueManager.getActive()
        return active === undefined
          ? null
          : {
              grade: active.grade,
              rank: active.rank,
              // Inner records copied too - a mutating consumer must not
              // alias live technique state through the snapshot.
              gradeHistory: Object.fromEntries(
                Object.entries(active.gradeHistory).map(([key, value]) => [
                  key,
                  { ...value },
                ]),
              ),
            }
      })(),
      artifact:
        p.artifact === undefined
          ? null
          : {
              artifactId: p.artifact.artifactId,
              realmId: p.artifact.realmId,
              realmLevel: p.artifact.realmLevel,
              experience: p.artifact.experience,
              grade: p.artifact.grade,
            },
      companionGifts: p.companionGifts.map((gift) => ({
        id: gift.id,
        definitionId: gift.definitionId,
        claimed: gift.claimed,
      })),
      perfectClearStageIds: [...p.perfectClearStageIds].sort(),
      autoFarmStageId: p.autoFarmStage?.stageId ?? null,
      bodyPerfection: {
        discoveredMaterials: [...p.bodyPerfection.discoveredMaterials],
        perfectedRealmIds: [...p.bodyPerfection.perfectedRealmIds],
      },
      hiddenBeastKills: { ...p.hiddenBeastKills },
      // Restore seeds every site state; a live session's are lazy, so
      // the SITE LIST is session-history noise - only sites carrying a
      // recorded cycle count are parity content (empty == []).
      hiddenChannelCycles: this.gameManager.productionSystem
        .getAllStates()
        .filter(
          (state) => Object.keys(state.hiddenChannelCycles ?? {}).length > 0,
        )
        .map((state) => ({
          siteId: state.siteId,
          cycles: { ...(state.hiddenChannelCycles ?? {}) },
        })),
    }
  }
}
